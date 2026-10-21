/**
 * Initial MOSSI integration boundary. No connector or identity has been verified.
 * Keep this server-owned: browser fields and public catalogue records cannot
 * establish internal reuse, repository policy, or review evidence.
 */
export function getStudioWorkflow() {
  return {
    name: "MOSSI Studio",
    phase: "Integration foundation",
    status: "blocked" as const,
    integrations: [
      { id: "identity", name: "Enterprise identity", status: "not_connected" as const, purpose: "Derive the contributor's identity and authorized knowledge scope." },
      { id: "registry", name: "Internal capability registry", status: "not_connected" as const, purpose: "Find existing capabilities and owners before proposing new work." },
      { id: "openmetadata", name: "OpenMetadata", status: "not_connected" as const, purpose: "Search authorized enterprise data metadata, not imported public documentation." },
      { id: "knowledge", name: "Enterprise second brain", status: "not_connected" as const, purpose: "Retrieve permission-scoped enterprise guidance with citations." },
      { id: "standards", name: "Monorepo standards and Global schemas", status: "unverified" as const, purpose: "Read pinned templates, canonical schemas, language policy, and renderer YAML contracts." },
      { id: "gitlab", name: "GitLab contribution and review", status: "not_connected" as const, purpose: "Submit contract-first merge requests and observe existing owner and CI decisions." },
    ],
    languagePolicy: {
      status: "unverified" as const,
      allowedLanguages: [] as string[],
      suggestedLanguages: ["TypeScript", "Python"],
    },
    delivery: {
      status: "unverified" as const,
      repositoryUrl: "https://gitlab.example.com/mossi/monorepo",
      repositoryPlaceholder: true,
      pipeline: "GitLab CI → OCI → Flux → Kubernetes",
      capabilityPath: "apps/<capability>/",
      viewPath: "views/*.yaml",
      contractReview: "Repository-owned review of the exact contract revision before implementation; policy not yet verified.",
    },
    actions: {
      canSearchInternal: false,
      canDraftGovernedContract: false,
      canGenerateImplementation: false,
      canOpenMergeRequest: false,
    },
    blockers: [
      "Verify MOSSI's repository, authoritative templates, supported languages, canonical schemas, and shared-renderer YAML contract.",
      "Connect enterprise identity and permission-scoped registry, OpenMetadata, and second-brain discovery.",
      "Verify GitLab contract-review rules and authorize a narrowly scoped contribution integration.",
      "Unavailable internal discovery is not evidence that a capability does not exist.",
    ],
  };
}

export const STUDIO_CONTRIBUTION_MESSAGE =
  "Standalone prototype planning and source downloads are disabled in MOSSI Studio. Complete authorized internal reuse and repository-backed contract review, then contribute through the monorepo merge-request path. These integrations are not connected; no code was generated or deployed.";
