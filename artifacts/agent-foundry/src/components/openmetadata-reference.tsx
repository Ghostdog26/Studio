import { useState } from 'react';
import type { KnowledgeDocument } from '@workspace/api-client-react';
import { Button, Field, inputClass, Panel, SectionTitle } from '@/components/foundry-ui';
import { OPENMETADATA_SOURCE_PREFIX } from '@/lib/knowledge-source';

// Selection is the existing standardsVersion/templateId contract, not a second grant mechanism.
export function OpenMetadataReference({ documents, onRead, onAsk }: {
  documents: KnowledgeDocument[]; onRead: (doc: KnowledgeDocument) => void; onAsk: (query: string) => void;
}) {
  const [kind, setKind] = useState('agent');
  const [copied, setCopied] = useState(false);
  const selection = { standardsVersion: '1.1.0', templateId: `openmetadata-${kind}`, query: 'What does OpenMetadata supply, and how should builders use schemas, APIs and MCP references safely?' };
  const references = documents.filter(doc => doc.source.startsWith(OPENMETADATA_SOURCE_PREFIX));
  return <Panel className="mb-5 p-5 md:p-6" data-testid="openmetadata-profile">
    <SectionTitle meta={<span className="text-xs text-muted-foreground">REFERENCE ONLY · NOT CONNECTED</span>}>OpenMetadata enterprise context</SectionTitle>
    <p className="mb-3 text-sm text-muted-foreground">Versioned catalogue guidance for schemas, business semantics, REST APIs and MCP references. No enterprise instance or live catalogue data is connected. A catalogue record is not a connected, healthy, callable or approved server.</p>
    <div className="grid gap-4 md:grid-cols-2">
      <div className="min-w-0">
        <Field label="Builder integration profile" hint="Profile 1.0.0 · standards 1.1.0 · portable across Cloudflare and NVIDIA OpenShell.">
          <select className={inputClass} value={kind} onChange={event => { setKind(event.target.value); setCopied(false); }} data-testid="select-openmetadata-profile">
            <option value="agent">OpenMetadata · Agent</option><option value="server">OpenMetadata · MCP server</option><option value="app">OpenMetadata · MCP App</option>
          </select>
        </Field>
        <pre className="my-3 overflow-x-auto rounded-lg bg-muted p-3 text-xs" data-testid="openmetadata-selection">{JSON.stringify(selection, null, 2)}</pre>
        <div className="flex flex-wrap gap-2">
          <Button kind="secondary" onClick={() => { void navigator.clipboard.writeText(JSON.stringify(selection, null, 2)).then(() => setCopied(true), () => setCopied(false)); }}>{copied ? 'Copied' : 'Copy context selection'}</Button>
          <Button kind="quiet" onClick={() => onAsk(selection.query)}>Ask about OpenMetadata</Button>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">This selects a reference profile, not access. An operator must publish the standards and grant this version, template and approved documents to the initiating workspace/user before using foundry.generation.context. Runtime execution stays blocked or disconnected.</p>
      </div>
      <div className="min-w-0 space-y-2">
        <p className="text-xs text-muted-foreground">Sources inspected at upstream revision 3fbd4d9ce6840dbe52b0c25a46c0d93e57b6a508; installed-release compatibility is unknown.</p>
        {references.length ? references.map(doc => <button key={doc.id} onClick={() => onRead(doc)} className="block w-full rounded-lg border border-border p-3 text-left text-sm hover:bg-muted">{doc.title}<span className="mt-1 block text-xs text-muted-foreground">Read source links and version qualifications</span></button>) : <p className="text-sm text-muted-foreground">Reference documents are not available in the shared library. An operator can import them with openmetadata:import; restricted documents remain hidden.</p>}
      </div>
    </div>
  </Panel>;
}
