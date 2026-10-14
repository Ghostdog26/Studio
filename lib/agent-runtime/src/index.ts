export type RuntimeId = "cloudflare" | "nvidia";

export interface AgentRunRequest {
  agentId: number;
  input: Record<string, unknown>;
}

export interface AgentRunResult {
  runId: string;
  runtime: RuntimeId;
  status: "queued" | "running" | "completed" | "failed";
  output?: Record<string, unknown>;
}

export interface RuntimeAdapter {
  readonly id: RuntimeId;
  readonly name: string;
  readonly description: string;
  readonly features: string[];
  isConfigured(): boolean;
  run(request: AgentRunRequest): Promise<AgentRunResult>;
}

abstract class UnconfiguredAdapter implements RuntimeAdapter {
  abstract readonly id: RuntimeId;
  abstract readonly name: string;
  abstract readonly description: string;
  abstract readonly features: string[];

  isConfigured(): boolean {
    return false;
  }

  async run(_request: AgentRunRequest): Promise<AgentRunResult> {
    throw new Error(
      `${this.name} is not connected. Configure this runtime adapter before starting agent runs.`,
    );
  }
}

export class CloudflareRuntimeAdapter extends UnconfiguredAdapter {
  readonly id = "cloudflare" as const;
  readonly name = "Cloudflare";
  readonly description =
    "Portable adapter contract for edge execution and durable multiplayer state.";
  readonly features = [
    "Durable multiplayer state",
    "Edge execution",
    "Workspace coordination",
  ];
}

export class NvidiaOpenShellRuntimeAdapter extends UnconfiguredAdapter {
  readonly id = "nvidia" as const;
  readonly name = "NVIDIA OpenShell";
  readonly description =
    "Portable adapter contract for isolated, policy-aware agent execution.";
  readonly features = [
    "Isolated agent execution",
    "Policy-aware tools",
    "Portable agent definitions",
  ];
}

export const runtimeAdapters: RuntimeAdapter[] = [
  new CloudflareRuntimeAdapter(),
  new NvidiaOpenShellRuntimeAdapter(),
];
