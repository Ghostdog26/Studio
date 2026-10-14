import { gzipSync } from "node:zlib";

export type McpPackageTarget = "cloudflare" | "openshell";

export interface McpPackageDefinition {
  id: number;
  name: string;
  description: string;
  kind: "server" | "app";
  transport: string;
  jsonSchema: Record<string, unknown>;
}

interface PackageFile {
  path: string;
  content: string;
}

function packageSlug(value: string): string {
  const slug = value
    .normalize("NFKD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48);
  return slug || "mcp-component";
}

function toolName(value: string): string {
  return (
    value
      .normalize("NFKD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-zA-Z0-9_-]+/g, "_")
      .replace(/^_+|_+$/g, "")
      .slice(0, 64) || "generated_tool"
  );
}

function jsonLiteral(value: unknown): string {
  return JSON.stringify(value)
    .replaceAll("<", "\\u003c")
    .replaceAll("\u2028", "\\u2028")
    .replaceAll("\u2029", "\\u2029");
}

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function zodExpression(schema: unknown, path = "input"): string {
  if (!schema || typeof schema !== "object" || Array.isArray(schema)) {
    throw new Error(`Unsupported JSON Schema at ${path}.`);
  }

  const value = schema as Record<string, unknown>;
  const type = value.type;

  if (type === "object") {
    const properties =
      value.properties && typeof value.properties === "object"
        ? (value.properties as Record<string, unknown>)
        : {};
    const required = new Set(
      Array.isArray(value.required)
        ? value.required.filter((item): item is string => typeof item === "string")
        : [],
    );
    const entries = Object.entries(properties).map(([key, property]) => {
      const expression = zodExpression(property, `${path}.${key}`);
      return `${jsonLiteral(key)}: ${required.has(key) ? expression : `${expression}.optional()`}`;
    });
    return `z.object({ ${entries.join(", ")} })`;
  }

  if (type === "array") {
    if (!value.items) {
      throw new Error(`Array schema at ${path} must declare items.`);
    }
    return `z.array(${zodExpression(value.items, `${path}[]`)})`;
  }

  if (Array.isArray(value.enum) && value.enum.length > 0) {
    if (value.enum.length === 1) {
      return `z.literal(${jsonLiteral(value.enum[0])})`;
    }
    if (
      value.enum.every((item) => typeof item === "string") &&
      value.enum.length > 1
    ) {
      return `z.enum(${jsonLiteral(value.enum)})`;
    }
    const options = value.enum.map((item) => `z.literal(${jsonLiteral(item)})`);
    return `z.union([${options.join(", ")}])`;
  }

  let expression: string;
  switch (type) {
    case "string":
      expression = "z.string()";
      if (typeof value.minLength === "number") {
        expression += `.min(${value.minLength})`;
      }
      if (typeof value.maxLength === "number") {
        expression += `.max(${value.maxLength})`;
      }
      if (value.format === "email") {
        expression += ".email()";
      } else if (value.format === "uri") {
        expression += ".url()";
      }
      return expression;
    case "number":
      expression = "z.number()";
      if (typeof value.minimum === "number") {
        expression += `.min(${value.minimum})`;
      }
      if (typeof value.maximum === "number") {
        expression += `.max(${value.maximum})`;
      }
      return expression;
    case "integer":
      expression = "z.number().int()";
      if (typeof value.minimum === "number") {
        expression += `.min(${value.minimum})`;
      }
      if (typeof value.maximum === "number") {
        expression += `.max(${value.maximum})`;
      }
      return expression;
    case "boolean":
      return "z.boolean()";
    case "null":
      return "z.null()";
    default:
      throw new Error(`Unsupported JSON Schema type at ${path}.`);
  }
}

function uiSource(component: McpPackageDefinition, name: string): string {
  return `import { App } from "@modelcontextprotocol/ext-apps";
import "./style.css";

const toolName = ${jsonLiteral(name)};
const inputSchema = ${jsonLiteral(component.jsonSchema)};
const form = document.querySelector<HTMLFormElement>("#tool-form")!;
const result = document.querySelector<HTMLPreElement>("#result")!;
const app = new App({ name: ${jsonLiteral(component.name)}, version: "1.0.0" }, {});

function show(value: unknown) {
  result.textContent = typeof value === "string" ? value : JSON.stringify(value, null, 2);
}

app.ontoolinput = ({ arguments: args }) => {
  for (const [key, value] of Object.entries(args ?? {})) {
    const field = form.elements.namedItem(key);
    if (field instanceof HTMLInputElement && field.type === "checkbox") {
      field.checked = Boolean(value);
    } else if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
      field.value = typeof value === "string" ? value : JSON.stringify(value);
    }
  }
};
app.ontoolresult = (toolResult) => show(toolResult);

form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const args: Record<string, unknown> = {};
  const properties = (inputSchema.properties ?? {}) as Record<string, Record<string, unknown>>;
  for (const [key, property] of Object.entries(properties)) {
    const field = form.elements.namedItem(key);
    if (field instanceof HTMLInputElement && field.type === "checkbox") {
      args[key] = field.checked;
    } else if (field instanceof HTMLInputElement && field.type === "number") {
      args[key] = field.value === "" ? undefined : Number(field.value);
    } else if (field instanceof HTMLInputElement || field instanceof HTMLTextAreaElement) {
      const raw = field.value.trim();
      if (raw === "" && !form.querySelector<HTMLInputElement>(\`[name="\${key}"]\`)?.required) continue;
      if (property.type === "object" || property.type === "array") {
        try { args[key] = JSON.parse(raw); }
        catch { show(\`Enter valid JSON for \${key}.\`); return; }
      } else {
        args[key] = raw;
      }
    }
  }

  result.textContent = "Running…";
  try {
    show(await app.callServerTool({ name: toolName, arguments: args }));
  } catch (error) {
    show(error instanceof Error ? error.message : String(error));
  }
});

void app.connect().catch((error) => show(\`Host connection failed: \${String(error)}\`));
`;
}

const UI_CSS = `
:root { color-scheme: light; font: 15px/1.5 Inter, ui-sans-serif, system-ui, sans-serif; color: #18252b; background: #f5f7f5; }
* { box-sizing: border-box; }
body { margin: 0; padding: 24px; }
main { max-width: 620px; margin: 0 auto; }
.eyebrow { color: #337b5a; font: 700 10px/1.3 ui-monospace, monospace; letter-spacing: .16em; }
h1 { margin: 12px 0 6px; font-size: 28px; line-height: 1.15; }
.description { color: #5d696c; margin: 0 0 22px; }
form { display: grid; gap: 14px; }
label { display: grid; gap: 6px; font-size: 12px; font-weight: 650; }
input, textarea { width: 100%; border: 1px solid #d6dfda; border-radius: 9px; padding: 10px 12px; font: inherit; background: white; }
textarea { min-height: 88px; resize: vertical; }
button { border: 0; border-radius: 9px; background: #245e43; color: white; padding: 11px 16px; font: inherit; font-weight: 700; cursor: pointer; }
pre { margin-top: 18px; padding: 14px; border-radius: 10px; background: #e9eeeb; white-space: pre-wrap; overflow-wrap: anywhere; }
`;

function sharedFiles(
  component: McpPackageDefinition,
  target: McpPackageTarget,
): PackageFile[] {
  const slug = packageSlug(component.name);
  const tool = toolName(component.name);
  const schemaExpression = zodExpression(component.jsonSchema);
  const resourceUri = `ui://${slug}/mcp-app.html`;
  const hasUi = component.kind === "app";
  const appRegistration = hasUi
    ? `
  registerAppTool(
    server,
    ${jsonLiteral(tool)},
    {
      title: ${jsonLiteral(component.name)},
      description: ${jsonLiteral(component.description || component.name)},
      inputSchema: ${schemaExpression},
      _meta: { ui: { resourceUri: ${jsonLiteral(resourceUri)} } },
    },
    runTool,
  );
  registerAppResource(
    server,
    ${jsonLiteral(component.name)},
    ${jsonLiteral(resourceUri)},
    { mimeType: RESOURCE_MIME_TYPE },
    async () => ({
      contents: [{ uri: ${jsonLiteral(resourceUri)}, mimeType: RESOURCE_MIME_TYPE, text: appHtml }],
    }),
  );`
    : `
  server.registerTool(
    ${jsonLiteral(tool)},
    {
      title: ${jsonLiteral(component.name)},
      description: ${jsonLiteral(component.description || component.name)},
      inputSchema: ${schemaExpression},
    },
    runTool,
  );`;

  const importAppHelpers = hasUi
    ? `import { registerAppResource, registerAppTool, RESOURCE_MIME_TYPE } from "@modelcontextprotocol/ext-apps/server";\n`
    : "";
  const nodeHtmlSource = hasUi
    ? `import { readFileSync } from "node:fs";\nimport { fileURLToPath } from "node:url";\nconst appHtml = readFileSync(fileURLToPath(new URL("../dist/mcp-app.html", import.meta.url)), "utf8");\n`
    : "";
  const workerHtmlSource = hasUi
    ? `import appHtml from "../dist/mcp-app.html?raw";\n`
    : "";

  const serverCore = (htmlSource: string) => `${importAppHelpers}import { McpServer } from "@modelcontextprotocol/server";
import { z } from "zod";
${htmlSource}

export interface RuntimeEnv {
  FOUNDRY_API_BASE_URL?: string;
  FOUNDRY_API_TOKEN?: string;
}

async function runTool(args: Record<string, unknown>, env: RuntimeEnv) {
  const query = typeof args.query === "string" ? args.query : undefined;
  if (!query) {
    return {
      content: [{ type: "text" as const, text: JSON.stringify({ received: args }, null, 2) }],
      structuredContent: { received: args },
    };
  }

  const baseUrl = (env.FOUNDRY_API_BASE_URL ?? "http://127.0.0.1:8080/api").replace(/\\/$/, "");
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (env.FOUNDRY_API_TOKEN) headers.authorization = \`Bearer \${env.FOUNDRY_API_TOKEN}\`;
  const response = await fetch(\`\${baseUrl}/knowledge/query\`, {
    method: "POST",
    headers,
    body: JSON.stringify({ query }),
  });
  if (!response.ok) {
    throw new Error(\`Agent Foundry knowledge query failed with HTTP \${response.status}.\`);
  }
  const result: unknown = await response.json();
  return {
    content: [{ type: "text" as const, text: JSON.stringify(result, null, 2) }],
    structuredContent: result as Record<string, unknown>,
  };
}

export function createServer(env: RuntimeEnv = {}) {
  const server = new McpServer({ name: ${jsonLiteral(component.name)}, version: "1.0.0" });
  const runToolWithEnv = (args: Record<string, unknown>) => runTool(args, env);
${appRegistration.replaceAll("runTool,", "runToolWithEnv,")}
  return server;
}

export const definition = {
  id: ${component.id},
  kind: ${jsonLiteral(component.kind)},
  transport: ${jsonLiteral(component.transport)},
  name: ${jsonLiteral(component.name)},
  inputSchema: ${jsonLiteral(component.jsonSchema)},
};
`;

  const uiFiles = hasUi
    ? [
        {
          path: "mcp-app.html",
          content: `<!doctype html>
<html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>${escapeHtml(component.name)}</title></head><body><main><p class="eyebrow">AGENT FOUNDRY · MCP APP</p><h1>${escapeHtml(component.name)}</h1><p class="description">${escapeHtml(component.description || "Interactive MCP app generated from a JSON Schema definition.")}</p><form id="tool-form">${Object.entries(
            component.jsonSchema.properties &&
              typeof component.jsonSchema.properties === "object"
              ? (component.jsonSchema.properties as Record<string, unknown>)
              : {},
          )
            .map(([key, property]) => {
              const value = (property ?? {}) as Record<string, unknown>;
              const required = Array.isArray(component.jsonSchema.required)
                ? component.jsonSchema.required.includes(key)
                : false;
              const input =
                value.type === "object" || value.type === "array"
                  ? `<textarea name="${escapeHtml(key)}" ${required ? "required" : ""} placeholder="Enter JSON"></textarea>`
                  : `<input name="${escapeHtml(key)}" type="${value.type === "integer" || value.type === "number" ? "number" : value.type === "boolean" ? "checkbox" : "text"}" ${required ? "required" : ""} />`;
              return `<label>${escapeHtml(key)}${required ? " *" : ""}${input}</label>`;
            })
            .join("")}<button type="submit">Run tool</button></form><pre id="result" role="status">Connect to an MCP Apps host to run this tool.</pre></main><script type="module" src="/src/ui.ts"></script></body></html>`,
        },
        { path: "src/ui.ts", content: uiSource(component, tool) },
        { path: "src/style.css", content: UI_CSS },
        {
          path: "vite.ui.config.ts",
          content: `import { defineConfig } from "vite";
import { viteSingleFile } from "vite-plugin-singlefile";

export default defineConfig({
  plugins: [viteSingleFile()],
  build: {
    outDir: "dist",
    emptyOutDir: false,
    rollupOptions: { input: "mcp-app.html" },
  },
});
`,
        },
      ]
    : [];

  const cloudflareFiles: PackageFile[] = [
    {
      path: "package.json",
      content: JSON.stringify(
        {
          name: `agent-foundry-${slug}-cloudflare`,
          private: true,
          type: "module",
          scripts: {
            "build:ui": hasUi
              ? "vite build --config vite.ui.config.ts"
              : "node -e \"process.exit(0)\"",
            build: "npm run build:ui && vite build --config vite.config.ts",
            dev: "npm run build:ui && vite dev --config vite.config.ts",
            deploy: "npm run build && wrangler deploy",
            typecheck: "tsc --noEmit",
          },
          dependencies: {
            "@modelcontextprotocol/server": "^2.3.1",
            ...(hasUi ? { "@modelcontextprotocol/ext-apps": "^2.0.3" } : {}),
            zod: "^4.5.4",
          },
          devDependencies: {
            "@cloudflare/vite-plugin": "^1.64.0",
            "@cloudflare/workers-types": "^5.20260729.1",
            "@types/node": "^26.0.1",
            "@types/react": "^19.2.17",
            "@vitejs/plugin-react": "^6.0.3",
            typescript: "^6.0.3",
            vite: "^8.1.0",
            wrangler: "^4.145.0",
            ...(hasUi ? { "vite-plugin-singlefile": "^2.3.3" } : {}),
          },
        },
        null,
        2,
      ),
    },
    {
      path: "src/server.ts",
      content: `${serverCore(workerHtmlSource)}
`,
    },
    {
      path: "src/worker.ts",
      content: `import { createMcpHandler } from "@modelcontextprotocol/server";
import { createServer, type RuntimeEnv } from "./server";

export interface Env extends RuntimeEnv {}

export default {
  fetch(request: Request, env: Env, ctx: ExecutionContext): Promise<Response> {
    return createMcpHandler(() => createServer(env))(request, env, ctx);
  },
} satisfies ExportedHandler<Env>;
`,
    },
    {
      path: "vite.config.ts",
      content: `import { defineConfig } from "vite";
import { cloudflare } from "@cloudflare/vite-plugin";

export default defineConfig({
  plugins: [cloudflare()],
  build: { emptyOutDir: false },
});
`,
    },
    {
      path: "wrangler.jsonc",
      content: JSON.stringify(
        {
          name: `agent-foundry-${slug}`,
          main: "src/worker.ts",
          compatibility_date: "2026-10-14",
          compatibility_flags: ["nodejs_compat"],
          vars: {
            FOUNDRY_API_BASE_URL: "https://replace-with-your-agent-foundry-host/api",
          },
        },
        null,
        2,
      ),
    },
    {
      path: ".dev.vars.example",
      content:
        "FOUNDRY_API_BASE_URL=http://127.0.0.1:8080/api\nFOUNDRY_API_TOKEN=\n",
    },
    {
      path: "tsconfig.json",
      content: JSON.stringify(
        {
          compilerOptions: {
            target: "ES2022",
            module: "ESNext",
            moduleResolution: "Bundler",
            strict: true,
            skipLibCheck: true,
            noEmit: true,
            types: ["@cloudflare/workers-types"],
          },
          include: ["src/**/*.ts"],
        },
        null,
        2,
      ),
    },
    ...uiFiles,
    {
      path: "README.md",
      content: cloudflareReadme(component, tool, hasUi),
    },
  ];

  const openshellFiles: PackageFile[] = [
    {
      path: "package.json",
      content: JSON.stringify(
        {
          name: `agent-foundry-${slug}-openshell`,
          private: true,
          type: "module",
          scripts: {
            "build:ui": hasUi
              ? "vite build --config vite.ui.config.ts"
              : "node -e \"process.exit(0)\"",
            build: `${hasUi ? "vite build --config vite.ui.config.ts && " : ""}tsc -p tsconfig.json`,
            start: "node dist/main.js",
            dev: `${hasUi ? "npm run build:ui && " : ""}tsx src/main.ts`,
          },
          dependencies: {
            "@modelcontextprotocol/express": "^2.0.2",
            "@modelcontextprotocol/node": "^2.1.1",
            "@modelcontextprotocol/server": "^2.3.1",
            ...(hasUi ? { "@modelcontextprotocol/ext-apps": "^2.0.3" } : {}),
            cors: "^2.8.6",
            express: "^5.2.1",
            zod: "^4.5.4",
          },
          devDependencies: {
            "@types/cors": "^2.8.19",
            "@types/express": "^5.0.6",
            "@types/node": "^26.0.1",
            tsx: "^4.23.0",
            typescript: "^6.0.3",
            ...(hasUi
              ? { vite: "^8.1.0", "vite-plugin-singlefile": "^2.3.3" }
              : {}),
          },
        },
        null,
        2,
      ),
    },
    {
      path: "tsconfig.json",
      content: JSON.stringify(
        {
          compilerOptions: {
            target: "ES2022",
            module: "NodeNext",
            moduleResolution: "NodeNext",
            strict: true,
            skipLibCheck: true,
            outDir: "dist",
            rootDir: "src",
            types: ["node"],
          },
          include: ["src/**/*.ts"],
        },
        null,
        2,
      ),
    },
    {
      path: "src/server.ts",
      content: `${serverCore(nodeHtmlSource)}
`,
    },
    {
      path: "src/main.ts",
      content: `import { NodeStreamableHTTPServerTransport } from "@modelcontextprotocol/node";
import { createMcpExpressApp } from "@modelcontextprotocol/express";
import cors from "cors";
import type { Request, Response } from "express";
import { createServer } from "./server.js";

const port = Number(process.env.PORT ?? "3001");
if (!Number.isInteger(port) || port < 1 || port > 65535) {
  throw new Error("PORT must be a valid TCP port.");
}

const app = createMcpExpressApp({ host: "127.0.0.1" });
app.use(cors());
app.all("/mcp", async (req: Request, res: Response) => {
  const server = createServer({
    FOUNDRY_API_BASE_URL: process.env.FOUNDRY_API_BASE_URL,
    FOUNDRY_API_TOKEN: process.env.FOUNDRY_API_TOKEN,
  });
  const transport = new NodeStreamableHTTPServerTransport({
    sessionIdGenerator: undefined,
  });
  res.on("close", () => {
    void transport.close();
    void server.close();
  });
  try {
    await server.connect(transport);
    await transport.handleRequest(req, res, req.body);
  } catch (error) {
    process.stderr.write(\`MCP request failed: \${String(error)}\\n\`);
    if (!res.headersSent) {
      res.status(500).json({
        jsonrpc: "2.0",
        error: { code: -32603, message: "Internal server error" },
        id: null,
      });
    }
  }
});

app.listen(port, "127.0.0.1", () => {
  process.stdout.write(\`MCP server listening on port \${port}/mcp\\n\`);
});
`,
    },
    {
      path: "Dockerfile",
      content: `FROM node:22-alpine AS build
WORKDIR /app
COPY package.json ./
RUN npm install
COPY . .
RUN npm run build

FROM node:22-alpine
ENV NODE_ENV=production
ENV PORT=3001
WORKDIR /app
COPY package.json ./
RUN npm install --omit=dev && npm cache clean --force
COPY --from=build /app/dist ./dist
EXPOSE 3001
CMD ["node", "dist/main.js"]
`,
    },
    {
      path: ".dockerignore",
      content: "node_modules\ndist\n.env\n.dev.vars\n",
    },
    {
      path: ".env.example",
      content:
        "PORT=3001\nFOUNDRY_API_BASE_URL=http://127.0.0.1:8080/api\nFOUNDRY_API_TOKEN=\n",
    },
    ...uiFiles,
    {
      path: "README.md",
      content: openShellReadme(component, tool, hasUi),
    },
  ];

  const files = target === "cloudflare" ? cloudflareFiles : openshellFiles;
  return files;
}

export function generateMcpPackage(
  component: McpPackageDefinition,
  target: McpPackageTarget,
) {
  if (!component.jsonSchema || component.jsonSchema.type !== "object") {
    throw new Error("MCP component input schema must have type object.");
  }
  const files = sharedFiles(component, target);
  const slug = packageSlug(component.name);
  return {
    filename: `agent-foundry-${slug}-${target}.tar.gz`,
    buffer: createTarGzip(files),
  };
}

function cloudflareReadme(
  component: McpPackageDefinition,
  tool: string,
  hasUi: boolean,
): string {
  return `# ${component.name} — Cloudflare Workers

Generated from MCP definition ${component.id}. The package serves the \`${tool}\` tool over Streamable HTTP${hasUi ? " and registers an MCP App UI resource" : ""}.

## Run locally

\`\`\`sh
npm install
cp .dev.vars.example .dev.vars
npm run dev
\`\`\`

The MCP endpoint is \`http://localhost:5173/mcp\`. It calls Agent Foundry's knowledge-query API when the input schema includes a \`query\` field. Set \`FOUNDRY_API_BASE_URL\` to a reachable Agent Foundry API.

## Deploy

\`\`\`sh
npm run deploy
\`\`\`

Authenticate Wrangler with your Cloudflare account first. Set the production API URL in \`wrangler.jsonc\` and configure \`FOUNDRY_API_TOKEN\` as a Worker secret if the API requires it:

\`\`\`sh
npx wrangler secret put FOUNDRY_API_TOKEN
\`\`\`

Do not expose an unauthenticated Agent Foundry API to the public internet. The starter does not add OAuth or tenant authorization; add that before production use.
`;
}

function openShellReadme(
  component: McpPackageDefinition,
  tool: string,
  hasUi: boolean,
): string {
  const slug = packageSlug(component.name);
  return `# ${component.name} — NVIDIA OpenShell

Generated from MCP definition ${component.id}. The package runs a Streamable HTTP MCP endpoint${hasUi ? " and registers an MCP App UI resource" : ""}. OpenShell provides the isolated sandbox; this package does not install or start an OpenShell gateway.

## Build the container

\`\`\`sh
docker build -t agent-foundry-${slug}:latest .
\`\`\`

## Run in an OpenShell sandbox

An OpenShell gateway must already be installed, running, and selected. Create a sandbox from the image:

\`\`\`sh
openshell sandbox create \\
  --name agent-foundry-${slug} \\
  --from agent-foundry-${slug}:latest \\
  --expose 3001 \\
  --detach \\
  -- node dist/main.js
\`\`\`

OpenShell prints the service address. Connect an MCP client to its \`/mcp\` endpoint. This is an HTTP server, not a local stdio subprocess.

Set \`FOUNDRY_API_BASE_URL\` and \`FOUNDRY_API_TOKEN\` in the sandbox environment using your gateway's approved secret and policy workflow. The default sandbox policy may block external API calls; allow only the Agent Foundry API host that the tool needs.

## Tool behavior

The generated \`${tool}\` tool calls Agent Foundry's knowledge query API when the saved schema includes a string \`query\` property. Other schemas return the validated arguments as structured content, ready for you to replace with a domain-specific handler in \`src/server.ts\`.

This starter does not add OAuth or tenant authorization. Do not expose a development API or send enterprise data until the API is protected with your access-control policy.
`;
}

function createTarGzip(files: PackageFile[]): Buffer {
  const blocks: Buffer[] = [];
  const encoder = new TextEncoder();

  for (const file of files) {
    const name = encoder.encode(file.path);
    if (name.byteLength > 100) {
      throw new Error(`Generated package path is too long: ${file.path}`);
    }
    const data = Buffer.from(file.content, "utf8");
    const header = Buffer.alloc(512);
    name.forEach((byte, index) => header.writeUInt8(byte, index));
    writeOctal(header, 100, 8, 0o644);
    writeOctal(header, 108, 8, 0);
    writeOctal(header, 116, 8, 0);
    writeOctal(header, 124, 12, data.byteLength);
    writeOctal(header, 136, 12, 0);
    header.fill(0x20, 148, 156);
    header.write("0", 156, "ascii");
    header.write("ustar\0", 257, "ascii");
    header.write("00", 263, "ascii");
    header.write("root", 265, "ascii");
    header.write("root", 297, "ascii");
    const checksum = header.reduce((sum, byte) => sum + byte, 0);
    writeOctal(header, 148, 8, checksum);
    blocks.push(header, data);
    const remainder = data.byteLength % 512;
    if (remainder) {
      blocks.push(Buffer.alloc(512 - remainder));
    }
  }

  blocks.push(Buffer.alloc(1024));
  return gzipSync(Buffer.concat(blocks));
}

function writeOctal(buffer: Buffer, offset: number, length: number, value: number) {
  const text = Math.floor(value).toString(8).padStart(length - 1, "0");
  buffer.write(`${text}\0`, offset, length, "ascii");
}
