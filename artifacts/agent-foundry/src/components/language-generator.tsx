import { useEffect, useMemo, useState } from 'react';
import { Link } from 'wouter';
import { getListMcpCatalogueQueryKey, getListMcpSdksQueryKey, useGenerateLanguageMcpPackage, useListMcpCatalogue, useListMcpSdks, type LanguageMcpPackage, type LanguageMcpPackageInputLanguage, type LanguageMcpPackageInputTarget, type McpComponent } from '@workspace/api-client-react';
import { AlertTriangle, BookOpen, Download, ExternalLink, FileCode2, GitBranch, Languages, Wand2 } from 'lucide-react';
import { Button, ErrorState, Field, inputClass, Notice, Panel, textareaClass } from '@/components/foundry-ui';

const LANGS: { id: LanguageMcpPackageInputLanguage; label: string }[] = [
  { id: 'typescript', label: 'TypeScript' }, { id: 'javascript', label: 'JavaScript' }, { id: 'python', label: 'Python' }, { id: 'go', label: 'Go' },
  { id: 'csharp', label: 'C#' }, { id: 'rust', label: 'Rust' }, { id: 'ruby', label: 'Ruby' }, { id: 'java', label: 'Java' },
  { id: 'swift', label: 'Swift' }, { id: 'php', label: 'PHP' }, { id: 'kotlin', label: 'Kotlin' },
];
const workerdCapable = (l: string) => l === 'typescript' || l === 'javascript';
const targetLabel = (t: string) => (t === 'cloudflare' ? 'Cloudflare Workers (workerd)' : 'NVIDIA OpenShell (native / OCI package)');

function downloadArchive(pkg: LanguageMcpPackage) {
  const bin = atob(pkg.archiveBase64);
  const bytes = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
  const url = URL.createObjectURL(new Blob([bytes], { type: 'application/gzip' }));
  const a = document.createElement('a');
  a.href = url; a.download = pkg.filename; document.body.appendChild(a); a.click(); a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function LanguageGenerator({ components }: { components: McpComponent[] }) {
  const servers = components.filter((c) => c.kind === 'server');
  const sdks = useListMcpSdks({ query: { queryKey: getListMcpSdksQueryKey(), staleTime: 10 * 60_000 } });
  const catParams = { focus: 'priority' as const, page: 1, pageSize: 1 };
  const cats = useListMcpCatalogue(catParams, { query: { queryKey: getListMcpCatalogueQueryKey(catParams), staleTime: 10 * 60_000 } });
  const generate = useGenerateLanguageMcpPackage();
  const [componentId, setComponentId] = useState<number | ''>('');
  const [language, setLanguage] = useState<LanguageMcpPackageInputLanguage>('python');
  const [target, setTarget] = useState<LanguageMcpPackageInputTarget>('openshell');
  const [instructions, setInstructions] = useState('');
  const [categories, setCategories] = useState<string[]>([]);
  const [result, setResult] = useState<{ key: string; pkg: LanguageMcpPackage } | null>(null);
  const [openFile, setOpenFile] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const dir = sdks.data;
  const sdk = dir?.sdks.find((s) => s.language === language);
  const allowedTargets = useMemo(() => (sdk?.targets ?? []).filter((t) => t === 'openshell' || workerdCapable(language)), [sdk, language]);
  const selKey = `${componentId}|${language}|${target}`;
  const resetRef = generate.reset;

  useEffect(() => { if (componentId === '' && servers.length) setComponentId(servers[0].id); else if (componentId !== '' && !servers.some((s) => s.id === componentId)) setComponentId(servers[0]?.id ?? ''); }, [servers, componentId]);
  useEffect(() => { if (allowedTargets.length && !allowedTargets.includes(target)) setTarget(allowedTargets.includes('openshell') ? 'openshell' : allowedTargets[0]); }, [allowedTargets, target]);
  useEffect(() => { setResult(null); setError(null); setOpenFile(0); resetRef(); }, [selKey, resetRef]);

  const shown = result && result.key === selKey ? result.pkg : null;
  const priority = cats.data?.priorityCategories ?? [];
  const toggleCat = (n: string) => setCategories((c) => (c.includes(n) ? c.filter((x) => x !== n) : c.length >= 12 ? c : [...c, n]));

  const run = () => {
    if (componentId === '' || !allowedTargets.includes(target)) return;
    const key = selKey;
    setError(null); setResult(null);
    generate.mutate({ data: { componentId, language, target, instructions: instructions.trim() ? instructions.trim().slice(0, 3000) : undefined, categories: categories.length ? categories : undefined } }, {
      onSuccess: (pkg) => { setResult({ key, pkg }); setOpenFile(0); },
      onError: () => setError('Generation failed. The service rejected the request or the AI draft could not be produced. Nothing was saved.'),
    });
  };

  return (
    <Panel className="mb-5 overflow-hidden" >
      <div className="flex flex-col gap-3 border-b border-border px-5 py-4 md:flex-row md:items-start md:justify-between md:px-6">
        <div className="flex items-start gap-3">
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent text-primary"><Languages size={18} /></div>
          <div>
            <h2 className="text-sm font-bold">Multi-language server source (optional, AI-assisted)</h2>
            <p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">Draft a server project from a saved definition using an official MCP SDK. Output is an unverified AI draft: it is not built, not deployed, and not approved. MCP apps remain TypeScript only and use the deterministic downloads on each card.</p>
          </div>
        </div>
        {dir && <div className="foundry-mono shrink-0 space-y-0.5 text-[9.5px] uppercase tracking-wider text-muted-foreground md:text-right" data-testid="text-spec-provenance">
          <div>Protocol <span className="text-foreground">{dir.protocolVersion}</span></div>
          <div>Spec rev <span className="text-foreground">{dir.specificationRevision.slice(0, 10)}</span></div>
          <div className="flex gap-2 md:justify-end normal-case tracking-normal"><a href={dir.specificationRepository} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline" data-testid="link-spec-repo"><ExternalLink size={10} />Specification</a><a href={dir.organizationUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline" data-testid="link-mcp-org"><ExternalLink size={10} />Official org</a>{dir.specificationKnowledgeId != null && <Link href={`/knowledge?document=${dir.specificationKnowledgeId}`} className="inline-flex items-center gap-1 text-primary hover:underline" data-testid="link-spec-knowledge"><BookOpen size={10} />Wiki</Link>}</div>
        </div>}
      </div>
      {sdks.isLoading ? <div className="grid gap-3 p-5 md:grid-cols-3">{[1, 2, 3].map((i) => <div key={i} className="h-14 animate-pulse rounded-lg bg-muted" />)}</div>
        : sdks.isError || !dir ? <div className="p-5"><ErrorState label="Could not load the official MCP SDK directory." onRetry={() => { void sdks.refetch(); }} /></div>
        : !servers.length ? <div className="px-6 py-5 text-xs text-muted-foreground">Save at least one MCP <span className="font-semibold text-foreground">server</span> definition to draft language-specific source. App definitions are TypeScript-only for now.</div>
        : <div className="grid gap-0 lg:grid-cols-[minmax(0,380px)_minmax(0,1fr)]">
          <div className="space-y-4 border-b border-border p-5 lg:border-b-0 lg:border-r md:px-6">
            <Field label="Saved server definition"><select value={componentId} onChange={(e) => setComponentId(Number(e.target.value))} className={inputClass} data-testid="select-gen-component">{servers.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}</select></Field>
            <div className="grid grid-cols-2 gap-3">
              <Field label="Language"><select value={language} onChange={(e) => setLanguage(e.target.value as LanguageMcpPackageInputLanguage)} className={inputClass} data-testid="select-gen-language">{LANGS.map((l) => <option key={l.id} value={l.id} disabled={!dir.sdks.some((s) => s.language === l.id)}>{l.label}</option>)}</select></Field>
              <Field label="Target"><select value={target} onChange={(e) => setTarget(e.target.value as LanguageMcpPackageInputTarget)} className={inputClass} data-testid="select-gen-target" disabled={!allowedTargets.length}>{allowedTargets.map((t) => <option key={t} value={t}>{t === 'cloudflare' ? 'Cloudflare' : 'OpenShell'}</option>)}</select></Field>
            </div>
            {sdk ? <div className="rounded-lg bg-muted/60 px-3 py-2.5 text-[10.5px] leading-relaxed" data-testid="text-sdk-provenance">
              <div className="flex items-center gap-1.5 font-semibold"><GitBranch size={11} className="text-primary" />{sdk.label}<span className="foundry-mono ml-auto text-[9px] text-muted-foreground">tier {sdk.tier}</span></div>
              <div className="foundry-mono mt-1 text-[9.5px] text-muted-foreground">rev {sdk.sourceRevision.slice(0, 12)}</div>
              <div className="mt-1 flex gap-3"><a href={sdk.repository} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline" data-testid="link-sdk-repo"><ExternalLink size={10} />Official SDK repo</a>{sdk.knowledgeId != null && <Link href={`/knowledge?document=${sdk.knowledgeId}`} className="inline-flex items-center gap-1 text-primary hover:underline" data-testid="link-sdk-knowledge"><BookOpen size={10} />Wiki</Link>}</div>
              {!workerdCapable(language) && <div className="mt-1.5 text-muted-foreground">{targetLabel('openshell')} only. This language does not run on Cloudflare workerd and will not be converted to another language.</div>}
            </div> : <Notice tone="error">No official SDK listed for this language.</Notice>}
            <Field label="Additional instructions" hint={`${instructions.length}/3000 characters. Optional.`}><textarea value={instructions} maxLength={3000} onChange={(e) => setInstructions(e.target.value)} className={textareaClass} data-testid="input-gen-instructions" /></Field>
            <div>
              <div className="mb-1.5 text-xs font-semibold">Review standards to apply <span className="font-normal text-muted-foreground">({categories.length}/12, optional)</span></div>
              {cats.isLoading ? <div className="h-16 animate-pulse rounded-lg bg-muted" /> : cats.isError ? <button type="button" onClick={() => { void cats.refetch(); }} className="text-[11px] font-semibold text-destructive underline" data-testid="button-retry-categories">Could not load priority categories. Retry</button>
                : <div className="flex flex-wrap gap-1.5">{priority.map((p) => { const on = categories.includes(p.name); return <button key={p.name} type="button" aria-pressed={on} onClick={() => toggleCat(p.name)} data-testid={`chip-gen-category-${p.name}`} className={`rounded-full border px-2.5 py-1 text-[10.5px] font-medium transition ${on ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:bg-muted'}`}>{p.name}</button>; })}</div>}
            </div>
            <Button onClick={run} disabled={generate.isPending || !sdk || !allowedTargets.includes(target)} testId="button-generate-language">{generate.isPending ? 'Drafting source...' : <><Wand2 size={14} />Draft {LANGS.find((l) => l.id === language)?.label} source</>}</Button>
          </div>
          <div className="min-w-0 p-5 md:px-6">
            {error && <div className="flex flex-col items-start gap-2"><Notice tone="error">{error}</Notice><Button kind="secondary" onClick={run} testId="button-retry-generate">Retry</Button></div>}
            {generate.isPending ? <div className="space-y-2"><div className="h-5 w-1/3 animate-pulse rounded bg-muted" /><div className="h-3 w-2/3 animate-pulse rounded bg-muted" /><div className="mt-3 h-64 animate-pulse rounded-lg bg-muted" /></div>
              : shown ? <GeneratedView pkg={shown} openFile={openFile} setOpenFile={setOpenFile} />
              : !error && <div className="grid h-full min-h-48 place-items-center rounded-xl border border-dashed border-border text-center"><div className="max-w-xs px-4"><FileCode2 size={20} className="mx-auto mb-2 text-muted-foreground" /><p className="text-xs font-semibold">No draft for this selection.</p><p className="mt-1 text-[11px] text-muted-foreground">Changing the definition, language, or target clears any previous draft so archives are never mismatched.</p></div></div>}
          </div>
        </div>}
    </Panel>
  );
}

export function GeneratedView({ pkg, openFile, setOpenFile }: { pkg: LanguageMcpPackage; openFile: number; setOpenFile: (i: number) => void }) {
  const file = pkg.files[openFile];
  return (
    <div data-testid="panel-generated-package">
      <div className="mb-3 flex flex-wrap items-center gap-1.5">
        <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-semibold text-amber-800" data-testid="status-ai-draft"><AlertTriangle size={11} />Unverified AI draft</span>
        <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold text-muted-foreground" data-testid="status-build">Build: {pkg.buildStatus.replace('-', ' ')}</span>
        <span className="rounded-full bg-muted px-2.5 py-1 text-[10px] font-semibold text-muted-foreground" data-testid="status-deploy">Deployment: {pkg.deploymentStatus.replace('-', ' ')}</span>
        <button type="button" onClick={() => downloadArchive(pkg)} data-testid="button-download-generated" className="ml-auto inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[11px] font-semibold hover:bg-muted"><Download size={13} />{pkg.filename}</button>
      </div>
      <dl className="mb-3 grid gap-x-4 gap-y-2 rounded-lg bg-muted/50 p-3 text-[10.5px] sm:grid-cols-2">
        <div className="sm:col-span-2"><dt className="foundry-mono text-[8.5px] uppercase tracking-[0.14em] text-muted-foreground">Source digest</dt><dd className="foundry-mono break-all" data-testid="text-source-digest">{pkg.sourceDigest}</dd></div>
        <div><dt className="foundry-mono text-[8.5px] uppercase tracking-[0.14em] text-muted-foreground">Language / target</dt><dd>{pkg.language} / {targetLabel(pkg.target)}</dd></div>
        <div><dt className="foundry-mono text-[8.5px] uppercase tracking-[0.14em] text-muted-foreground">Protocol / spec rev</dt><dd className="foundry-mono">{pkg.protocolVersion} / {pkg.specificationRevision.slice(0, 10)}</dd></div>
        <div className="sm:col-span-2"><dt className="foundry-mono text-[8.5px] uppercase tracking-[0.14em] text-muted-foreground">SDK</dt><dd><a href={pkg.sdkRepository} target="_blank" rel="noreferrer" className="text-primary hover:underline">{pkg.sdkRepository}</a> <span className="foundry-mono text-muted-foreground">@ {pkg.sdkSourceRevision.slice(0, 12)}</span></dd></div>
        <div className="sm:col-span-2"><dt className="foundry-mono text-[8.5px] uppercase tracking-[0.14em] text-muted-foreground">Review standards requested (not verified)</dt><dd>{pkg.appliedCategories.length ? pkg.appliedCategories.join(', ') : 'None'}</dd></div>
      </dl>
      <div className="overflow-hidden rounded-lg border border-border">
        <div className="flex gap-1 overflow-x-auto border-b border-border bg-muted/40 p-1.5">{pkg.files.map((f, i) => <button key={f.path} type="button" onClick={() => setOpenFile(i)} data-testid={`tab-generated-file-${i}`} className={`foundry-mono shrink-0 rounded px-2 py-1 text-[10px] ${i === openFile ? 'bg-card font-semibold text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{f.path}</button>)}</div>
        {file ? <pre className="foundry-mono max-h-[420px] overflow-auto whitespace-pre bg-[#202a31] p-3.5 text-[10.5px] leading-relaxed text-[#d9e4dc]" data-testid="text-generated-file">{file.content}</pre> : <div className="p-4 text-xs text-muted-foreground">The package contains no files.</div>}
      </div>
      <p className="mt-2 text-[10px] leading-relaxed text-muted-foreground">Review every file before use. Agent Foundry has not compiled, tested, executed, or audited this source.</p>
    </div>
  );
}
