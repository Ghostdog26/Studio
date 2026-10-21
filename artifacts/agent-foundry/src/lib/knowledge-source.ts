// These are persisted importer identities, not product branding. Match only known
// managed sources: never rewrite user-authored source text or the stored document.
export const OPENMETADATA_SOURCE_PREFIX = 'Agent Foundry managed OpenMetadata reference | ';
const CATEGORY_SOURCE_PREFIX = 'Agent Foundry priority MCP standards | ';
const MCP_STANDARDS_SOURCE = 'Agent Foundry MCP architecture guidance';

export function knowledgeSourceLabel(source: string): string {
  if (source === MCP_STANDARDS_SOURCE) return 'MOSSI Studio MCP architecture guidance';
  for (const prefix of [OPENMETADATA_SOURCE_PREFIX, CATEGORY_SOURCE_PREFIX]) {
    if (source.startsWith(prefix)) return `MOSSI Studio${source.slice('Agent Foundry'.length)}`;
  }
  return source;
}
