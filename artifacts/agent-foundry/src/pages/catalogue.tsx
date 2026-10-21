import { useEffect, useRef, useState } from 'react';
import { Link } from 'wouter';
import { keepPreviousData } from '@tanstack/react-query';
import { getGetMcpCatalogueEntryQueryKey, getListMcpCatalogueQueryKey, useGetMcpCatalogueEntry, useListMcpCatalogue, type McpCatalogueEntry, type McpCatalogueFacet, type McpCategoryStandard, type ListMcpCatalogueFocus } from '@workspace/api-client-react';
import { BookOpen, Check, ClipboardList, ListOrdered, ShieldCheck, ChevronLeft, ChevronRight, Copy, ExternalLink, Library, Search, X } from 'lucide-react';
import { Button, EmptyState, ErrorState, inputClass, Notice, PageHeading, Panel } from '@/components/foundry-ui';

const PAGE_SIZE = 24;

function FacetSelect({ label, value, facets, onChange, testId }: { label: string; value: string; facets: McpCatalogueFacet[]; onChange: (v: string) => void; testId: string }) {
  return (
    <label className="block min-w-0">
      <span className="foundry-mono mb-1 block text-[9px] uppercase tracking-[0.16em] text-muted-foreground">{label}</span>
      <select value={value} onChange={(e) => onChange(e.target.value)} className={`${inputClass} py-2 text-xs`} data-testid={testId}>
        <option value="">All</option>
        {facets.map((f) => <option key={f.name} value={f.name}>{f.name} ({f.count})</option>)}
      </select>
    </label>
  );
}

function Tags({ values, tone = 'muted' }: { values: string[]; tone?: 'muted' | 'accent' }) {
  if (!values.length) return null;
  return <>{values.map((v) => <span key={v} className={`rounded-md px-1.5 py-0.5 text-[9px] font-medium ${tone === 'accent' ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}`}>{v}</span>)}</>;
}

function Row({ entry, active, onSelect }: { entry: McpCatalogueEntry; active: boolean; onSelect: () => void }) {
  return (
    <button type="button" onClick={onSelect} data-testid={`row-catalogue-${entry.id}`} aria-pressed={active}
      className={`block w-full border-b border-border px-4 py-3 text-left transition-colors last:border-b-0 ${active ? 'bg-accent/60' : 'hover:bg-muted/50'}`}>
      <div className="flex items-center gap-2">
        <span className={`h-1.5 w-1.5 shrink-0 rounded-full ${active ? 'bg-primary' : 'bg-border'}`} />
        <span className="truncate text-[13px] font-semibold">{entry.name}</span>
        {entry.officialListed && <span className="shrink-0 rounded border border-primary/25 px-1 text-[9px] font-semibold text-primary" title="Marked official in the upstream list. Not verified by MOSSI Studio.">Listed official</span>}
        {entry.knowledgeId != null && <BookOpen size={11} className="ml-auto shrink-0 text-muted-foreground" aria-label="Has knowledge document" />}
      </div>
      <p className="mt-1 line-clamp-2 pl-3.5 text-[11px] leading-relaxed text-muted-foreground">{entry.description || 'No description in source list.'}</p>
      <div className="mt-1.5 flex flex-wrap gap-1 pl-3.5"><Tags values={entry.categories.slice(0, 2)} tone="accent" /><Tags values={entry.languages} /><Tags values={entry.scopes} /></div>
    </button>
  );
}

function Detail({ id, onClose }: { id: number; onClose: () => void }) {
  const detail = useGetMcpCatalogueEntry(id, { query: { enabled: !!id, queryKey: getGetMcpCatalogueEntryQueryKey(id), staleTime: 5 * 60_000 } });
  const [copy, setCopy] = useState<'idle' | 'ok' | 'fail'>('idle');
  const timer = useRef<number | undefined>(undefined);
  useEffect(() => { setCopy('idle'); }, [id]);
  useEffect(() => () => window.clearTimeout(timer.current), []);
  const copyBrief = async (text: string) => {
    window.clearTimeout(timer.current);
    try {
      if (!navigator.clipboard) throw new Error('unavailable');
      await navigator.clipboard.writeText(text);
      setCopy('ok');
      timer.current = window.setTimeout(() => setCopy('idle'), 2400);
    } catch { setCopy('fail'); }
  };
  if (detail.isLoading) return <div className="space-y-3 p-5"><div className="h-6 w-1/2 animate-pulse rounded bg-muted" /><div className="h-3 w-full animate-pulse rounded bg-muted" /><div className="h-3 w-4/5 animate-pulse rounded bg-muted" /><div className="mt-4 h-48 animate-pulse rounded-lg bg-muted" /></div>;
  if (detail.isError || !detail.data) return <div className="p-5"><ErrorState label="Could not load this catalogue entry." onRetry={() => { void detail.refetch(); }} /></div>;
  const { entry, builderBrief, standardsKnowledgeId, sourceUrl, reviewStandards } = detail.data;
  const meta: [string, string[]][] = [['Categories', entry.categories], ['Languages', entry.languages], ['Scope (service connected)', entry.scopes], ['Platforms', entry.platforms]];
  return (
    <div data-testid="panel-catalogue-detail">
      <div className="flex items-start justify-between gap-3 border-b border-border px-5 py-4">
        <div className="min-w-0">
          <div className="foundry-mono mb-1 text-[9px] uppercase tracking-[0.16em] text-primary">Reference entry #{entry.id}</div>
          <h2 className="foundry-display break-words text-xl font-bold" data-testid="text-entry-name">{entry.name}</h2>
          <div className="mt-2 flex flex-wrap gap-1.5">
            <span className="rounded-full bg-muted px-2 py-0.5 text-[9px] font-semibold capitalize text-muted-foreground" data-testid="status-review">{entry.reviewStatus}</span>
            {entry.officialListed && <span className="rounded-full bg-primary/10 px-2 py-0.5 text-[9px] font-semibold text-primary">Marked official upstream</span>}
          </div>
        </div>
        <button onClick={onClose} aria-label="Close details" data-testid="button-close-detail" className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><X size={16} /></button>
      </div>
      <div className="space-y-5 px-5 py-4">
        <p className="text-sm leading-relaxed">{entry.description || 'No description in source list.'}</p>
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
          {meta.map(([label, vals]) => <div key={label}><dt className="foundry-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">{label}</dt><dd className="mt-1 flex flex-wrap gap-1">{vals.length ? <Tags values={vals} /> : <span className="text-[11px] text-muted-foreground">Not listed</span>}</dd></div>)}
        </dl>
        <div className="flex flex-wrap gap-2">
          <a href={entry.url} target="_blank" rel="noreferrer" data-testid="link-entry-source" className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[11px] font-semibold hover:bg-muted"><ExternalLink size={13} />Original repository</a>
          {entry.knowledgeId != null
            ? <Link href={`/knowledge?document=${entry.knowledgeId}`} data-testid="link-entry-knowledge" className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[11px] font-semibold hover:bg-muted"><BookOpen size={13} />Knowledge document</Link>
            : <span className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-dashed border-border px-3 text-[11px] text-muted-foreground"><BookOpen size={13} />No knowledge document</span>}
          <Link href="/builder" data-testid="link-entry-builder" className="inline-flex min-h-9 items-center gap-1.5 rounded-lg bg-primary px-3 text-[11px] font-semibold text-primary-foreground hover:brightness-95"><ChevronRight size={13} />Start MOSSI contribution</Link>
          {standardsKnowledgeId != null && <Link href={`/knowledge?document=${standardsKnowledgeId}`} data-testid="link-standards-knowledge" className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border bg-card px-3 text-[11px] font-semibold hover:bg-muted"><Library size={13} />Builder standards</Link>}
        </div>
        <ReviewStandards standards={reviewStandards} />
        <div>
          <div className="mb-2 flex items-center justify-between gap-2">
            <div><div className="text-xs font-semibold">AI builder brief</div><div className="text-[10px] text-muted-foreground">Paste into an AI builder as grounded context.</div></div>
            <Button kind={copy === 'ok' ? 'secondary' : 'primary'} onClick={() => { void copyBrief(builderBrief); }} testId="button-copy-brief">{copy === 'ok' ? <><Check size={14} />Copied</> : <><Copy size={14} />Copy brief</>}</Button>
          </div>
          {copy === 'fail' && <Notice tone="error">Clipboard access was blocked by the browser. Select the brief text below and copy it manually.</Notice>}
          <pre className="foundry-mono max-h-80 overflow-auto whitespace-pre-wrap rounded-lg bg-[#202a31] p-3.5 text-[10.5px] leading-relaxed text-[#d9e4dc]" data-testid="text-builder-brief">{builderBrief}</pre>
        </div>
        <p className="border-t border-border pt-3 text-[10px] leading-relaxed text-muted-foreground">Imported from <a href={sourceUrl} target="_blank" rel="noreferrer" className="underline underline-offset-2">the upstream list</a> at revision <span className="foundry-mono">{entry.sourceRevision.slice(0, 10)}</span> on {new Date(entry.importedAt).toLocaleDateString()}. This is a reference listing only; it has not been reviewed, installed, or approved.</p>
      </div>
    </div>
  );
}

function ReviewStandards({ standards }: { standards: McpCategoryStandard[] }) {
  if (!standards.length) return <div className="rounded-lg border border-dashed border-border px-3.5 py-3 text-[11px] text-muted-foreground" data-testid="text-no-standards">No priority-category review standard applies to this entry's categories. General builder standards still apply.</div>;
  return (
    <div data-testid="section-review-standards">
      <div className="mb-2 flex items-start gap-2">
        <ShieldCheck size={15} className="mt-0.5 text-primary" />
        <div><div className="text-xs font-semibold">Required review standards</div><div className="text-[10px] leading-relaxed text-muted-foreground">These checks are requirements a builder must satisfy. None have been audited or completed for this entry.</div></div>
      </div>
      <div className="space-y-3">
        {standards.map((st) => (
          <div key={st.category} className="overflow-hidden rounded-lg border border-border" data-testid={`standard-${st.category}`}>
            <div className="flex flex-wrap items-center gap-2 border-b border-border bg-muted/40 px-3.5 py-2.5">
              <span className="text-[12px] font-semibold">{st.category}</span>
              <span className="foundry-mono rounded bg-card px-1.5 text-[9px] text-muted-foreground">v{st.version}</span>
              <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[9px] font-semibold text-amber-800">Required, not audited</span>
              {st.knowledgeId != null
                ? <Link href={`/knowledge?document=${st.knowledgeId}`} className="ml-auto inline-flex items-center gap-1 text-[10px] font-semibold text-primary hover:underline" data-testid={`link-standard-knowledge-${st.category}`}><BookOpen size={11} />Wiki guidance</Link>
                : <span className="ml-auto text-[10px] text-muted-foreground">No wiki guidance linked</span>}
            </div>
            <p className="px-3.5 pt-2.5 text-[11px] leading-relaxed text-muted-foreground">{st.summary}</p>
            <ol className="divide-y divide-border">
              {st.checks.map((c) => (
                <li key={c.id} className="px-3.5 py-2.5" data-testid={`check-${c.id}`}>
                  <div className="flex gap-2"><span className="foundry-mono shrink-0 text-[9px] text-primary">{c.id}</span><span className="text-[11.5px] font-medium leading-relaxed">{c.requirement}</span></div>
                  <dl className="mt-1.5 grid gap-1.5 pl-1 sm:grid-cols-2">
                    <div><dt className="foundry-mono text-[8.5px] uppercase tracking-[0.14em] text-muted-foreground">Evidence required</dt><dd className="text-[10.5px] leading-relaxed">{c.evidence}</dd></div>
                    <div><dt className="foundry-mono text-[8.5px] uppercase tracking-[0.14em] text-muted-foreground">Acceptance test</dt><dd className="text-[10.5px] leading-relaxed">{c.acceptanceTest}</dd></div>
                  </dl>
                </li>
              ))}
            </ol>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function CataloguePage() {
  const [searchInput, setSearchInput] = useState('');
  const [search, setSearch] = useState('');
  const [category, setCategory] = useState('');
  const [language, setLanguage] = useState('');
  const [scope, setScope] = useState('');
  const [focus, setFocus] = useState<ListMcpCatalogueFocus>('all');
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<number | null>(null);

  useEffect(() => {
    const t = window.setTimeout(() => { const v = searchInput.trim().slice(0, 200); setSearch((cur) => { if (cur !== v) setPage(1); return v; }); }, 280);
    return () => window.clearTimeout(t);
  }, [searchInput]);

  const params = { search: search || undefined, category: category || undefined, language: language || undefined, scope: scope || undefined, focus, page, pageSize: PAGE_SIZE };
  const list = useListMcpCatalogue(params, { query: { queryKey: getListMcpCatalogueQueryKey(params), staleTime: 2 * 60_000, placeholderData: keepPreviousData } });
  const data = list.data;
  const pages = data ? Math.max(1, Math.ceil(data.total / data.pageSize)) : 1;
  const filtered = !!(focus === 'priority' || search || category || language || scope);
  const setFilter = (fn: (v: string) => void) => (v: string) => { fn(v); setPage(1); };
  const clear = () => { setFocus('all'); setSearchInput(''); setSearch(''); setCategory(''); setLanguage(''); setScope(''); setPage(1); };

  return (
    <>
      <PageHeading eyebrow="External reference library" title="Public inspiration, not internal reuse." description="This is not the MOSSI capability registry. A searchable directory of community MCP server references from awesome-mcp-servers, each linked to its source and the shared knowledge base. Listings are unreviewed references, not approved integrations, and selecting one never satisfies the internal reuse check."
        action={data && <div className="foundry-mono text-right text-[10px] uppercase tracking-wider text-muted-foreground"><div><span className="text-lg font-semibold text-foreground" data-testid="text-catalogue-total">{data.catalogueTotal.toLocaleString()}</span> entries</div><div>{data.knowledgeCount.toLocaleString()} in knowledge{data.sourceRevision ? ` · rev ${data.sourceRevision.slice(0, 7)}` : ''}</div>{data.importedAt && <div>imported {new Date(data.importedAt).toLocaleDateString()}</div>}</div>} />
      <Panel className="mb-4 grid gap-3 p-4 md:grid-cols-[minmax(0,2fr)_repeat(3,minmax(0,1fr))]">
        <label className="block">
          <span className="foundry-mono mb-1 block text-[9px] uppercase tracking-[0.16em] text-muted-foreground">Search</span>
          <div className="relative"><Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" /><input type="search" value={searchInput} maxLength={200} onChange={(e) => setSearchInput(e.target.value)} placeholder="Name, description, service..." className={`${inputClass} py-2 pl-9 text-xs`} data-testid="input-catalogue-search" /></div>
        </label>
        <FacetSelect label="Category" value={category} facets={data?.categories ?? []} onChange={setFilter(setCategory)} testId="select-category" />
        <FacetSelect label="Language" value={language} facets={data?.languages ?? []} onChange={setFilter(setLanguage)} testId="select-language" />
        <FacetSelect label="Scope" value={scope} facets={data?.scopes ?? []} onChange={setFilter(setScope)} testId="select-scope" />
      </Panel>
      <Panel className="mb-4 p-4" >
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex items-start gap-2"><ListOrdered size={15} className="mt-0.5 text-primary" /><div><div className="text-xs font-semibold">Priority review areas</div><div className="text-[10px] text-muted-foreground">Twelve areas with rigorous review standards. Pick one to filter, or show priority entries first. Every other category stays available in the Category filter.</div></div></div>
          <div className="inline-flex shrink-0 rounded-lg border border-border bg-muted/50 p-0.5" role="group" aria-label="Ordering">
            {(['all', 'priority'] as const).map((f) => <button key={f} type="button" aria-pressed={focus === f} onClick={() => { setFocus(f); setPage(1); }} data-testid={`button-focus-${f}`} className={`rounded-md px-3 py-1.5 text-[11px] font-semibold transition ${focus === f ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'}`}>{f === 'all' ? 'All entries' : 'Priority areas'}</button>)}
          </div>
        </div>
        <div className="mt-3 flex flex-wrap gap-1.5" data-testid="list-priority-categories">
          {list.isLoading ? Array.from({ length: 12 }, (_, i) => <div key={i} className="h-7 w-28 animate-pulse rounded-full bg-muted" />)
            : (data?.priorityCategories ?? []).map((pc) => { const on = category === pc.name; return <button key={pc.name} type="button" aria-pressed={on} onClick={() => setFilter(setCategory)(on ? '' : pc.name)} data-testid={`chip-priority-${pc.name}`} className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-medium transition ${on ? 'border-primary bg-primary text-primary-foreground' : 'border-border bg-card hover:border-primary/40 hover:bg-accent/50'}`}>{pc.name}<span className={`foundry-mono text-[9px] ${on ? 'opacity-80' : 'text-muted-foreground'}`}>{pc.count}</span></button>; })}
          {!list.isLoading && data && data.priorityCategories.length === 0 && <span className="inline-flex items-center gap-1.5 text-[11px] text-muted-foreground"><ClipboardList size={12} />No priority categories reported by the catalogue.</span>}
        </div>
      </Panel>
      <div className={`grid gap-4 ${selected ? 'lg:grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)]' : ''}`}>
        <Panel className="min-w-0 overflow-hidden">
          <div className="flex items-center justify-between gap-2 border-b border-border px-4 py-2.5 text-[11px] text-muted-foreground">
            <span data-testid="text-result-count">{data ? <><span className="font-semibold text-foreground">{data.total.toLocaleString()}</span> {filtered ? 'matching' : 'total'}</> : 'Loading entries'}{list.isFetching && !list.isLoading && <span className="ml-2 text-primary">updating</span>}</span>
            {filtered && <button onClick={clear} className="font-semibold text-primary hover:underline" data-testid="button-clear-filters">Clear filters</button>}
          </div>
          {list.isLoading ? <div>{Array.from({ length: 8 }, (_, i) => <div key={i} className="border-b border-border px-4 py-3"><div className="h-3.5 w-2/5 animate-pulse rounded bg-muted" /><div className="mt-2 h-2.5 w-4/5 animate-pulse rounded bg-muted" /></div>)}</div>
            : list.isError ? <div className="p-4"><ErrorState label="Could not load the catalogue." onRetry={() => { void list.refetch(); }} /></div>
            : !data || data.catalogueTotal === 0 ? <div className="p-4"><EmptyState icon={Library} title="The catalogue has not been imported yet." detail="Once the upstream list is imported, server references will appear here." /></div>
            : data.items.length === 0 ? <div className="p-4"><EmptyState icon={Search} title="No entries match these filters." detail="Try a broader search term or remove a filter." action={<Button kind="secondary" onClick={clear}>Clear filters</Button>} /></div>
            : <div className={`transition-opacity ${list.isPlaceholderData ? 'opacity-60' : ''}`}>{data.items.map((e) => <Row key={e.id} entry={e} active={selected === e.id} onSelect={() => setSelected(e.id)} />)}</div>}
          {data && data.total > 0 && <div className="flex items-center justify-between border-t border-border px-4 py-2.5">
            <Button kind="quiet" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} testId="button-prev-page"><ChevronLeft size={14} />Prev</Button>
            <span className="foundry-mono text-[10px] text-muted-foreground" data-testid="text-page">Page {data.page} / {pages}</span>
            <Button kind="quiet" disabled={page >= pages} onClick={() => setPage((p) => Math.min(pages, p + 1))} testId="button-next-page">Next<ChevronRight size={14} /></Button>
          </div>}
        </Panel>
        {selected && <Panel className="min-w-0 self-start overflow-hidden lg:sticky lg:top-20"><Detail id={selected} onClose={() => setSelected(null)} /></Panel>}
      </div>
    </>
  );
}
