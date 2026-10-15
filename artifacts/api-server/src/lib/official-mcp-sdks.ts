export const OFFICIAL_SPEC_REPOSITORY = "https://github.com/modelcontextprotocol/modelcontextprotocol";
export const OFFICIAL_SPEC_KNOWLEDGE_SOURCE = "Official MCP specification source";
export const OFFICIAL_SDK_SOURCE_PREFIX = "Official MCP SDK source | ";

export const OFFICIAL_SDKS = [
  { language: "typescript", label: "TypeScript", repo: "typescript-sdk", tier: 1, extension: ".ts", dependencyHint: "@modelcontextprotocol/" },
  { language: "javascript", label: "JavaScript", repo: "typescript-sdk", tier: 1, extension: ".js", dependencyHint: "@modelcontextprotocol/" },
  { language: "python", label: "Python", repo: "python-sdk", tier: 1, extension: ".py", dependencyHint: "mcp" },
  { language: "go", label: "Go", repo: "go-sdk", tier: 1, extension: ".go", dependencyHint: "github.com/modelcontextprotocol/go-sdk" },
  { language: "csharp", label: "C#", repo: "csharp-sdk", tier: 1, extension: ".cs", dependencyHint: "ModelContextProtocol" },
  { language: "rust", label: "Rust", repo: "rust-sdk", tier: 1, extension: ".rs", dependencyHint: "rmcp" },
  { language: "ruby", label: "Ruby", repo: "ruby-sdk", tier: 1, extension: ".rb", dependencyHint: "mcp" },
  { language: "java", label: "Java", repo: "java-sdk", tier: 2, extension: ".java", dependencyHint: "modelcontextprotocol" },
  { language: "swift", label: "Swift", repo: "swift-sdk", tier: 3, extension: ".swift", dependencyHint: "swift-sdk" },
  { language: "php", label: "PHP", repo: "php-sdk", tier: 3, extension: ".php", dependencyHint: "mcp" },
  { language: "kotlin", label: "Kotlin", repo: "kotlin-sdk", tier: 3, extension: ".kt", dependencyHint: "modelcontextprotocol" },
] as const;

export interface OfficialMcpSnapshot {
  specificationRevision: string;
  protocolVersion: string;
  sdks: { repo: string; sourceRevision: string }[];
  assetHashes?: Record<string, string>;
}

export function sdkTargets(language: string): ("cloudflare" | "openshell")[] {
  return language === "typescript" || language === "javascript" ? ["cloudflare", "openshell"] : ["openshell"];
}
