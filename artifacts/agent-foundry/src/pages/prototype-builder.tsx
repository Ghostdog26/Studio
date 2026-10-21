import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Link, useSearch } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import {
  getGetMcpCatalogueEntryQueryKey, getListComponentsQueryKey, getListMcpSdksQueryKey,
  useCreateComponent, useDiscoverBuilderApproaches, useDraftBuilderDefinition, useGenerateLanguageMcpPackage,
  useGetMcpCatalogueEntry, useListComponents, useListMcpSdks,
  type BuilderDiscovery, type BuilderPlan, type BuilderPlanInputLanguage, type BuilderPlanInputTarget, type BuilderPlanInputTransport,
  type LanguageMcpPackage, type McpCatalogueEntry,
} from '@workspace/api-client-react';
import { BookOpen, Check, CircleDot, Compass, ExternalLink, FileCheck2, GitBranch, KeyRound, Library, Lock, RotateCcw, Save, Search, ShieldAlert, Wand2 } from 'lucide-react';
import { Button, ErrorState, Field, inputClass, Notice, PageHeading, Panel, textareaClass, codeTextareaClass } from '@/components/foundry-ui';
import { GeneratedView } from '@/components/language-generator';

const LANGS: { id: BuilderPlanInputLanguage; label: string }[] = [
  { id: 'typescript', label: 'TypeScript' }, { id: 'javascript', label: 'JavaScript' }, { id: 'python', label: 'Python' }, { id: 'go', label: 'Go' },
  { id: 'csharp', label: 'C#' }, { id: 'rust', label: 'Rust' }, { id: 'ruby', label: 'Ruby' }, { id: 'java', label: 'Java' },
  { id: 'swift', label: 'Swift' }, { id: 'php', label: 'PHP' }, { id: 'kotlin', label: 'Kotlin' },
];
const LANG_IDS = LANGS.map((l) => l.id) as string[];
const workerdCapable = (l: string) => l === 'typescript' || l === 'javascript';
const EXAMPLES = [
  'Let us build a developer MCP server tool today that reads GitHub pull requests and summarises review comments.',
  'An MCP server that lets analysts query a PostgreSQL database with read-only access.',
  'A tool that searches our internal documentation and returns cited passages.',
  'Help me build an MCP server for browser automation to capture page screenshots.',
];
// Keep the pre-rebrand key/version so existing journeys remain available.
const STORAGE_KEY = 'agent-foundry.builder.journey';
const STORAGE_VERSION = 1;

type Ref = { id: number; name: string; url: string; sourceRevision: string };
type Config = { language: BuilderPlanInputLanguage; target: BuilderPlanInputTarget; transport: BuilderPlanInputTransport; dataSource: string; authRequirements: string };
type Draft = { planKey: string; plan: BuilderPlan; name: string; description: string; schemaText: string };
type Saved = { id: number; fingerprint: string; planKey: string };
type Journey = { goal: string; selected: Ref | null; config: Config; draft: Draft | null; saved: Saved | null };

const EMPTY: Journey = { goal: '', selected: null, config: { language: 'typescript', target: 'openshell', transport: 'stdio', dataSource: '', authRequirements: '' }, draft: null, saved: null };

const isObj = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);
const isStr = (v: unknown): v is string => typeof v === 'string';

function parseStored(raw: string | null): Journey {
  if (!raw) return EMPTY;
  try {
    const d: unknown = JSON.parse(raw);
    if (!isObj(d) || d.v !== STORAGE_VERSION || !isObj(d.j)) return EMPTY;
    const j = d.j;
    const goal = isStr(j.goal) ? j.goal.slice(0, 2000) : '';
    let selected: Ref | null = null;
    if (isObj(j.selected) && typeof j.selected.id === 'number' && isStr(j.selected.name) && isStr(j.selected.url) && isStr(j.selected.sourceRevision)) selected = { id: j.selected.id, name: j.selected.name, url: j.selected.url, sourceRevision: j.selected.sourceRevision };
    const c = isObj(j.config) ? j.config : {};
    const config: Config = {
      language: isStr(c.language) && LANG_IDS.includes(c.language) ? (c.language as BuilderPlanInputLanguage) : EMPTY.config.language,
      target: c.target === 'cloudflare' || c.target === 'openshell' ? c.target : EMPTY.config.target,
      transport: c.transport === 'stdio' || c.transport === 'streamable-http' ? c.transport : EMPTY.config.transport,
      dataSource: isStr(c.dataSource) ? c.dataSource.slice(0, 1000) : '',
      authRequirements: isStr(c.authRequirements) ? c.authRequirements.slice(0, 1000) : '',
    };
    let draft: Draft | null = null;
    const dr = j.draft;
    if (isObj(dr) && isStr(dr.planKey) && isStr(dr.name) && isStr(dr.description) && isStr(dr.schemaText) && isObj(dr.plan) && isObj(dr.plan.definition)
      && dr.plan.definition.kind === 'server' && ['stdio', 'streamable-http'].includes(String(dr.plan.definition.transport))
      && isStr(dr.plan.referenceUrl) && isStr(dr.plan.referenceRevision) && isStr(dr.plan.sdkRepository) && isStr(dr.plan.specificationRevision)
      && isStr(dr.plan.generationInstructions) && Array.isArray(dr.plan.categories) && dr.plan.categories.every(isStr)
      && Array.isArray(dr.plan.reviewNotes) && dr.plan.reviewNotes.every(isStr)) {
      draft = { planKey: dr.planKey, plan: dr.plan as unknown as BuilderPlan, name: dr.name, description: dr.description, schemaText: dr.schemaText };
    }
    let saved: Saved | null = null;
    if (isObj(j.saved) && typeof j.saved.id === 'number' && isStr(j.saved.fingerprint) && isStr(j.saved.planKey)) saved = { id: j.saved.id, fingerprint: j.saved.fingerprint, planKey: j.saved.planKey };
    return { goal, selected, config, draft, saved };
  } catch { return EMPTY; }
}

function loadJourney(): Journey {
  try { return parseStored(window.sessionStorage.getItem(STORAGE_KEY)); } catch { return EMPTY; }
}

function validateSchema(text: string): { ok: true; value: Record<string, unknown> } | { ok: false; error: string } {
  let v: unknown;
  try { v = JSON.parse(text); } catch { return { ok: false, error: 'Schema is not valid JSON.' }; }
  if (!isObj(v)) return { ok: false, error: 'Top level must be a JSON object.' };
  if (v.type !== 'object') return { ok: false, error: 'Top-level "type" must be "object".' };
  if (!isObj(v.properties)) return { ok: false, error: 'Schema needs a "properties" object.' };
  if (v.required !== undefined) {
    if (!Array.isArray(v.required) || !v.required.every(isStr)) return { ok: false, error: '"required" must be an array of strings.' };
    const props = v.properties as Record<string, unknown>;
    const missing = (v.required as string[]).filter((r) => !Object.hasOwn(props, r));
    if (missing.length) return { ok: false, error: `"required" lists undefined properties: ${missing.join(', ')}.` };
  }
  return { ok: true, value: v };
}

const planKeyOf = (goal: string, sel: Ref | null, c: Config) => JSON.stringify([goal.trim(), sel?.id ?? null, c.language, c.target, c.transport, c.dataSource.trim(), c.authRequirements.trim()]);
function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (isObj(value)) return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value) ?? 'null';
}
const fingerprintOf = (d: Draft) => JSON.stringify([d.planKey, d.name.trim(), d.description.trim(), d.schemaText.trim()]);
const errMsg = (e: unknown, fallback: string) => (e instanceof Error && e.message ? `${fallback} (${e.message.slice(0, 200)})` : fallback);

function Step({ n, title, state, children, aside }: { n: string; title: string; state: 'done' | 'active' | 'locked'; children: ReactNode; aside?: ReactNode }) {
  return (
    <li className="relative grid grid-cols-[36px_minmax(0,1fr)] gap-4 pb-8 last:pb-0" data-testid={`step-${n}`}>
      <span className="absolute left-[17px] top-10 bottom-0 w-px bg-border last:hidden" aria-hidden />
      <div className={`foundry-mono z-[1] grid h-9 w-9 place-items-center rounded-full border text-[11px] font-semibold ${state === 'done' ? 'border-primary bg-primary text-primary-foreground' : state === 'active' ? 'border-primary bg-card text-primary' : 'border-border bg-muted text-muted-foreground'}`}>
        {state === 'done' ? <Check size={15} /> : state === 'locked' ? <Lock size={13} /> : n}
      </div>
      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 pt-1.5">
          <h2 className={`foundry-display text-lg font-semibold ${state === 'locked' ? 'text-muted-foreground' : ''}`}>{title}</h2>
          {aside}
        </div>
        {children}
      </div>
    </li>
  );
}

function Guide({ children }: { children: ReactNode }) {
  return <div className="mb-3 flex gap-2.5 text-[12.5px] leading-relaxed text-muted-foreground"><CircleDot size={14} className="mt-0.5 shrink-0 text-primary" /><div>{children}</div></div>;
}

function Locked({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-border px-4 py-3 text-[11.5px] text-muted-foreground">{text}</div>;
}

export default function BuilderPage() {
  const qc = useQueryClient();
  const search = useSearch();
  const [j, setJ] = useState<Journey>(loadJourney);
  const [discovery, setDiscovery] = useState<{ goal: string; data: BuilderDiscovery } | null>(null);
  const [discoverError, setDiscoverError] = useState<string | null>(null);
  const [planError, setPlanError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [genError, setGenError] = useState<string | null>(null);
  const [pkg, setPkg] = useState<{ key: string; pkg: LanguageMcpPackage } | null>(null);
  const [openFile, setOpenFile] = useState(0);
  const saving = useRef(false);

  const discover = useDiscoverBuilderApproaches();
  const draftPlan = useDraftBuilderDefinition();
  const create = useCreateComponent();
  const generate = useGenerateLanguageMcpPackage();
  const sdks = useListMcpSdks({ query: { queryKey: getListMcpSdksQueryKey(), staleTime: 10 * 60_000 } });
  const components = useListComponents({ query: { queryKey: getListComponentsQueryKey(), enabled: !!j.saved, staleTime: 0, refetchInterval: 15_000 } });

  // Persist small journey metadata only (no generated code, archives, or credentials).
  useEffect(() => {
    try { window.sessionStorage.setItem(STORAGE_KEY, JSON.stringify({ v: STORAGE_VERSION, j })); } catch { /* storage unavailable */ }
  }, [j]);

  // Live keys, read by async handlers to reject stale results.
  const goalT = j.goal.trim();
  const planKey = planKeyOf(j.goal, j.selected, j.config);
  const liveRef = useRef({ goalT, planKey, fingerprint: '' });
  const draft = j.draft && j.draft.planKey === planKey ? j.draft : null;
  const fingerprint = draft ? fingerprintOf(draft) : '';
  liveRef.current = { goalT, planKey, fingerprint };

  // Catalogue preselection via ?catalogueId=
  const preId = useMemo(() => { const n = Number(new URLSearchParams(search).get('catalogueId')); return Number.isInteger(n) && n > 0 ? n : 0; }, [search]);
  const pre = useGetMcpCatalogueEntry(preId, { query: { enabled: !!preId, queryKey: getGetMcpCatalogueEntryQueryKey(preId), staleTime: 5 * 60_000 } });
  const preApplied = useRef(0);
  useEffect(() => {
    const e = pre.data?.entry;
    if (!e || preApplied.current === e.id) return;
    preApplied.current = e.id;
    setJ((cur) => (cur.selected?.id === e.id ? cur : { ...cur, selected: { id: e.id, name: e.name, url: e.url, sourceRevision: e.sourceRevision } }));
  }, [pre.data]);

  // Selected entry detail (knowledge + standards links)
  const selId = j.selected?.id ?? 0;
  const detail = useGetMcpCatalogueEntry(selId, { query: { enabled: !!selId, queryKey: getGetMcpCatalogueEntryQueryKey(selId), staleTime: 5 * 60_000 } });

  // SDK restrictions
  const dir = sdks.data;
  const sdk = dir?.sdks.find((s) => s.language === j.config.language);
  const allowedTargets = useMemo(() => (sdk?.targets ?? []).filter((t) => t === 'openshell' || workerdCapable(j.config.language)) as BuilderPlanInputTarget[], [sdk, j.config.language]);
  useEffect(() => {
    if (allowedTargets.length && !allowedTargets.includes(j.config.target)) setJ((cur) => ({ ...cur, config: { ...cur.config, target: allowedTargets.includes('openshell') ? 'openshell' : allowedTargets[0] } }));
  }, [allowedTargets, j.config.target]);
  useEffect(() => {
    if (j.config.target === 'cloudflare' && j.config.transport !== 'streamable-http') setJ((cur) => ({ ...cur, config: { ...cur.config, transport: 'streamable-http' } }));
  }, [j.config.target, j.config.transport]);

  // Saved definition verification
  const savedComp = j.saved ? components.data?.find((c) => c.id === j.saved!.id) : undefined;
  const savedDeleted = !!j.saved && components.isSuccess && !savedComp;
  const savedMatches = !!j.saved && !!draft && j.saved.fingerprint === fingerprint;
  const editedAfterSave = !!j.saved && !!draft && !savedMatches;

  const genKey = j.saved ? `${j.saved.id}|${j.config.language}|${j.config.target}|${planKey}|${fingerprint}|${savedComp?.updatedAt ?? ''}` : '';
  const genKeyRef = useRef(genKey);
  genKeyRef.current = genKey;
  const shownPkg = pkg && pkg.key === genKey ? pkg.pkg : null;

  const setGoal = (goal: string) => setJ((cur) => ({ ...cur, goal: goal.slice(0, 2000) }));
  const setConfig = (patch: Partial<Config>) => setJ((cur) => ({ ...cur, config: { ...cur.config, ...patch } }));
  const select = (e: McpCatalogueEntry) => setJ((cur) => ({ ...cur, selected: { id: e.id, name: e.name, url: e.url, sourceRevision: e.sourceRevision } }));
  const editDraft = (patch: Partial<Pick<Draft, 'name' | 'description' | 'schemaText'>>) => setJ((cur) => (cur.draft ? { ...cur, draft: { ...cur.draft, ...patch } } : cur));

  const reset = () => {
    try { window.sessionStorage.removeItem(STORAGE_KEY); } catch { /* ignore */ }
    setJ(EMPTY); setDiscovery(null); setPkg(null); setDiscoverError(null); setPlanError(null); setSaveError(null); setGenError(null);
    discover.reset(); draftPlan.reset(); create.reset(); generate.reset();
  };

  const runDiscover = async () => {
    if (discover.isPending || goalT.length < 8) return;
    const sent = goalT;
    setDiscoverError(null);
    try {
      const data = await discover.mutateAsync({ data: { goal: sent } });
      if (liveRef.current.goalT !== sent) return;
      setDiscovery({ goal: sent, data });
    } catch (e) { if (liveRef.current.goalT === sent) setDiscoverError(errMsg(e, 'Matching failed. Nothing was selected.')); }
  };

  const runPlan = async () => {
    if (draftPlan.isPending || !j.selected || goalT.length < 8 || !allowedTargets.includes(j.config.target)) return;
    const key = planKey;
    const c = j.config;
    setPlanError(null);
    try {
      const plan = await draftPlan.mutateAsync({ data: { goal: goalT, catalogueId: j.selected.id, language: c.language, target: c.target, transport: c.transport, dataSource: c.dataSource.trim() || undefined, authRequirements: c.authRequirements.trim() || undefined } });
      if (liveRef.current.planKey !== key) return;
      setJ((cur) => ({ ...cur, draft: { planKey: key, plan, name: plan.definition.name, description: plan.definition.description, schemaText: JSON.stringify(plan.definition.jsonSchema, null, 2) } }));
    } catch (e) { if (liveRef.current.planKey === key) setPlanError(errMsg(e, 'The AI definition draft could not be produced. Nothing was saved.')); }
  };

  const schemaCheck = draft ? validateSchema(draft.schemaText) : null;
  const workspaceMatches = !!savedComp && !!draft && !!schemaCheck?.ok
    && savedComp.name === draft.name.trim() && savedComp.description === draft.description.trim()
    && savedComp.kind === 'server' && savedComp.transport === draft.plan.definition.transport
    && canonical(savedComp.jsonSchema) === canonical(schemaCheck.value);
  const canSave = !!draft && !!draft.name.trim() && !!schemaCheck?.ok && !savedMatches;

  const runSave = async () => {
    if (!draft || !schemaCheck?.ok || saving.current || create.isPending || savedMatches) return;
    saving.current = true;
    const fp = fingerprint;
    const key = draft.planKey;
    setSaveError(null);
    try {
      const comp = await create.mutateAsync({ data: { name: draft.name.trim(), description: draft.description.trim(), kind: draft.plan.definition.kind, transport: draft.plan.definition.transport, jsonSchema: schemaCheck.value } });
      await qc.invalidateQueries({ queryKey: getListComponentsQueryKey() });
      // Record the save regardless of later edits, so it is never duplicated silently.
      setJ((cur) => ({ ...cur, saved: { id: comp.id, fingerprint: fp, planKey: key } }));
      setPkg(null);
    } catch (e) { setSaveError(errMsg(e, 'Saving failed. No definition was created.')); }
    finally { saving.current = false; }
  };

  const canGenerate = !!j.saved && !!draft && savedMatches && !!savedComp && workspaceMatches && !savedDeleted && allowedTargets.includes(j.config.target);
  const runGenerate = async () => {
    if (!canGenerate || generate.isPending || !j.saved || !draft) return;
    const key = genKey;
    setGenError(null); setPkg(null);
    try {
      const out = await generate.mutateAsync({ data: { componentId: j.saved.id, language: j.config.language, target: j.config.target, instructions: draft.plan.generationInstructions || undefined, categories: draft.plan.categories.length ? draft.plan.categories.slice(0, 12) : undefined } });
      if (genKeyRef.current !== key) return;
      setPkg({ key, pkg: out }); setOpenFile(0);
    } catch (e) { if (genKeyRef.current === key) setGenError(errMsg(e, 'Package generation failed. Your saved definition is unchanged; retry will reuse it.')); }
  };

  const discoveryShown = discovery && discovery.goal === goalT ? discovery.data : null;
  const s1 = goalT.length >= 8 ? 'done' : 'active';
  const s2 = j.selected ? 'done' : goalT.length >= 8 || preId ? 'active' : 'locked';
  const s3 = draft ? 'done' : j.selected && goalT.length >= 8 ? 'active' : 'locked';
  const s4 = savedMatches ? 'done' : draft ? 'active' : 'locked';
  const s5 = shownPkg ? 'done' : canGenerate ? 'active' : 'locked';

  return (
    <>
      <PageHeading eyebrow="Legacy prototype · inactive" title="Prototype builder, preserved." description="Your earlier journey is kept exactly as saved in this browser. Server-side matching, drafting, and package generation are now blocked (MOSSI_CONTRIBUTION_REQUIRED), so actions here will fail by design. Use Contribute for the MOSSI workflow."
        action={<Button kind="secondary" onClick={reset} disabled={discover.isPending || draftPlan.isPending || create.isPending || generate.isPending} testId="button-reset-journey"><RotateCcw size={14} />New journey</Button>} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_300px]">
        <ol className="min-w-0">
          <Step n="01" title="What do you want to build?" state={s1}>
            <Panel className="p-5">
              <Guide>Describe the goal in your own words. The assistant compares it with catalogue references; it does not chat or invent servers.</Guide>
              <textarea value={j.goal} maxLength={2000} onChange={(e) => setGoal(e.target.value)} placeholder="e.g. let us build a developer MCP server tool today that..." className={textareaClass} data-testid="input-goal" />
              <div className="mt-1 flex justify-between text-[10px] text-muted-foreground"><span>{goalT.length < 8 ? `At least 8 characters (${goalT.length}/8)` : 'Ready to match'}</span><span className="foundry-mono">{j.goal.length}/2000</span></div>
              <div className="mt-3 flex flex-wrap gap-1.5">
                {EXAMPLES.map((ex, i) => <button key={i} type="button" onClick={() => setGoal(ex)} data-testid={`button-example-goal-${i}`} className="rounded-full border border-border bg-card px-3 py-1 text-left text-[10.5px] text-muted-foreground transition hover:border-primary/40 hover:text-foreground">{ex.length > 64 ? `${ex.slice(0, 62)}...` : ex}</button>)}
              </div>
              <div className="mt-4"><Button onClick={() => { void runDiscover(); }} disabled={discover.isPending || goalT.length < 8} testId="button-discover">{discover.isPending ? 'Matching catalogue...' : <><Compass size={14} />Find matching references</>}</Button></div>
            </Panel>
          </Step>

          <Step n="02" title="Choose a catalogue reference" state={s2} aside={j.selected && <span className="foundry-mono text-[10px] text-muted-foreground">selected #{j.selected.id}</span>}>
            {preId > 0 && pre.isLoading && <Notice tone="info">Loading catalogue entry #{preId} from the link you followed...</Notice>}
            {preId > 0 && pre.isError && <Notice tone="error">Catalogue entry #{preId} could not be loaded. Choose a reference below instead.</Notice>}
            {discoverError && <div className="mb-3"><Notice tone="error">{discoverError}</Notice><Button kind="secondary" onClick={() => { void runDiscover(); }} testId="button-retry-discover">Retry</Button></div>}
            {discover.isPending ? <div className="space-y-2">{[1, 2, 3].map((i) => <div key={i} className="h-20 animate-pulse rounded-xl bg-muted" />)}</div>
              : discoveryShown ? (
                <div>
                  <Guide><span data-testid="text-discovery-message">{discoveryShown.message}</span></Guide>
                  {discoveryShown.options.length === 0
                    ? <div className="rounded-xl border border-dashed border-border bg-card/60 p-6 text-center" data-testid="empty-discovery"><Search size={18} className="mx-auto mb-2 text-muted-foreground" /><p className="text-sm font-semibold">No catalogue reference matched this goal.</p><p className="mx-auto mt-1 max-w-sm text-xs text-muted-foreground">Try naming the service or data you want to connect, or browse the <Link href="/catalogue" className="text-primary underline">catalogue</Link> and start from an entry.</p></div>
                    : <div className="space-y-2">{discoveryShown.options.map((o) => {
                      const on = j.selected?.id === o.reference.id;
                      return (
                        <button key={o.reference.id} type="button" onClick={() => select(o.reference)} aria-pressed={on} data-testid={`option-reference-${o.reference.id}`} className={`block w-full rounded-xl border p-4 text-left transition ${on ? 'border-primary bg-accent/50' : 'border-border bg-card hover:border-primary/40'}`}>
                          <div className="flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${on ? 'bg-primary' : 'bg-border'}`} /><span className="text-[13px] font-semibold">{o.reference.name}</span><span className="foundry-mono ml-auto text-[9.5px] text-muted-foreground">#{o.reference.id} · rev {o.reference.sourceRevision.slice(0, 7)}</span></div>
                          <p className="mt-1.5 pl-4 text-[11.5px] leading-relaxed">{o.rationale}</p>
                          {o.considerations.length > 0 && <ul className="mt-1.5 list-disc space-y-0.5 pl-8 text-[10.5px] text-muted-foreground">{o.considerations.map((c, i) => <li key={i}>{c}</li>)}</ul>}
                        </button>
                      );
                    })}</div>}
                </div>
              ) : discovery && !j.selected ? <Locked text="Your goal changed since the last match. Run matching again to see options for the current wording." />
              : !j.selected ? <Locked text="Write a goal and run matching to see real catalogue references." /> : null}
            {j.selected && (
              <Panel className="mt-3 p-4" >
                <div className="flex flex-wrap items-center gap-2"><FileCheck2 size={15} className="text-primary" /><span className="text-sm font-semibold" data-testid="text-selected-name">{j.selected.name}</span><span className="foundry-mono text-[10px] text-muted-foreground">#{j.selected.id} · rev {j.selected.sourceRevision.slice(0, 10)}</span></div>
                <div className="mt-2 flex flex-wrap gap-3 text-[11px]">
                  <a href={j.selected.url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-primary hover:underline" data-testid="link-selected-source"><ExternalLink size={11} />Original repository</a>
                  {detail.data?.entry.knowledgeId != null && <Link href={`/knowledge?document=${detail.data.entry.knowledgeId}`} className="inline-flex items-center gap-1 text-primary hover:underline" data-testid="link-selected-knowledge"><BookOpen size={11} />Knowledge document</Link>}
                  {detail.data?.standardsKnowledgeId != null && <Link href={`/knowledge?document=${detail.data.standardsKnowledgeId}`} className="inline-flex items-center gap-1 text-primary hover:underline" data-testid="link-selected-standards"><Library size={11} />Builder standards</Link>}
                  {detail.data && detail.data.reviewStandards.length > 0 && <span className="text-muted-foreground">{detail.data.reviewStandards.length} review standard{detail.data.reviewStandards.length > 1 ? 's' : ''} apply (not audited)</span>}
                </div>
                <p className="mt-2 text-[10px] text-muted-foreground">Unreviewed reference listing. Selecting it does not install or endorse it.</p>
              </Panel>
            )}
          </Step>

          <Step n="03" title="Configure the package" state={s3}>
            {!j.selected || goalT.length < 8 ? <Locked text="Choose a reference (and keep a goal of at least 8 characters) to configure." /> : (
              <Panel className="p-5">
                {sdks.isLoading ? <div className="h-24 animate-pulse rounded-lg bg-muted" /> : sdks.isError || !dir ? <ErrorState label="Could not load the official MCP SDK directory." onRetry={() => { void sdks.refetch(); }} /> : (
                  <div className="space-y-4">
                    <div className="grid gap-3 sm:grid-cols-3">
                      <Field label="Language"><select value={j.config.language} onChange={(e) => setConfig({ language: e.target.value as BuilderPlanInputLanguage })} className={inputClass} data-testid="select-builder-language">{LANGS.map((l) => <option key={l.id} value={l.id} disabled={!dir.sdks.some((s) => s.language === l.id)}>{l.label}</option>)}</select></Field>
                      <Field label="Target"><select value={j.config.target} onChange={(e) => setConfig({ target: e.target.value as BuilderPlanInputTarget })} className={inputClass} disabled={!allowedTargets.length} data-testid="select-builder-target">{allowedTargets.map((t) => <option key={t} value={t}>{t === 'cloudflare' ? 'Cloudflare Workers' : 'NVIDIA OpenShell'}</option>)}</select></Field>
                      <Field label="Transport"><select value={j.config.transport} onChange={(e) => setConfig({ transport: e.target.value as BuilderPlanInputTransport })} className={inputClass} data-testid="select-builder-transport"><option value="stdio" disabled={j.config.target === 'cloudflare'}>stdio</option><option value="streamable-http">Streamable HTTP</option></select></Field>
                    </div>
                    {sdk ? <div className="rounded-lg bg-muted/60 px-3 py-2.5 text-[10.5px]" data-testid="text-builder-sdk">
                      <div className="flex items-center gap-1.5 font-semibold"><GitBranch size={11} className="text-primary" />{sdk.label}<span className="foundry-mono ml-auto text-[9px] text-muted-foreground">tier {sdk.tier} · rev {sdk.sourceRevision.slice(0, 12)}</span></div>
                      <a href={sdk.repository} target="_blank" rel="noreferrer" className="mt-1 inline-flex items-center gap-1 text-primary hover:underline"><ExternalLink size={10} />Official SDK repository</a>
                      {j.config.target === 'cloudflare' && <div className="mt-1 text-muted-foreground">Cloudflare workerd cannot host stdio servers, so transport is fixed to Streamable HTTP.</div>}
                      {!workerdCapable(j.config.language) && <div className="mt-1 text-muted-foreground">OpenShell only. This language does not run on Cloudflare workerd.</div>}
                    </div> : <Notice tone="error">No official SDK is listed for this language.</Notice>}
                    <Field label="Data source (optional)" hint={`${j.config.dataSource.length}/1000. Describe the system, not its address or credentials.`}><textarea value={j.config.dataSource} maxLength={1000} onChange={(e) => setConfig({ dataSource: e.target.value })} className={textareaClass} data-testid="input-data-source" /></Field>
                    <Field label="Authentication requirements (optional)" hint={`${j.config.authRequirements.length}/1000. e.g. "OAuth with read-only repo scope".`}><textarea value={j.config.authRequirements} maxLength={1000} onChange={(e) => setConfig({ authRequirements: e.target.value })} className={textareaClass} data-testid="input-auth-requirements" /></Field>
                    <div className="flex gap-2 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2.5 text-[11px] text-amber-900"><KeyRound size={14} className="mt-0.5 shrink-0" />Do not paste secrets, tokens, or passwords here. Credentials are configured separately in the deployment environment, never in this builder.</div>
                    {planError && <div><Notice tone="error">{planError}</Notice></div>}
                    {j.draft && !draft && <Notice tone="info">Your goal, reference, or configuration changed since the last draft. Draft again to get a definition that matches the current inputs.</Notice>}
                    <Button onClick={() => { void runPlan(); }} disabled={draftPlan.isPending || !sdk || !allowedTargets.includes(j.config.target)} testId="button-draft-definition">{draftPlan.isPending ? 'Drafting definition...' : <><Wand2 size={14} />{draft ? 'Redraft definition' : 'Draft definition with AI'}</>}</Button>
                  </div>
                )}
              </Panel>
            )}
          </Step>

          <Step n="04" title="Review and save the definition" state={s4} aside={draft && <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[10px] font-semibold text-amber-800">AI draft, unsaved until you save</span>}>
            {draftPlan.isPending ? <div className="h-64 animate-pulse rounded-xl bg-muted" /> : !draft ? <Locked text="Draft a definition in step 03 to review it here." /> : (
              <Panel className="p-5">
                <div className="space-y-4">
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Field label="Name"><input value={draft.name} onChange={(e) => editDraft({ name: e.target.value })} className={inputClass} data-testid="input-definition-name" /></Field>
                    <Field label="Kind / transport"><div className="foundry-mono rounded-lg border border-border bg-muted/50 px-3 py-2.5 text-xs">{draft.plan.definition.kind} / {draft.plan.definition.transport}</div></Field>
                  </div>
                  <Field label="Description"><textarea value={draft.description} onChange={(e) => editDraft({ description: e.target.value })} className={textareaClass} data-testid="input-definition-description" /></Field>
                  <Field label="Input JSON schema"><textarea value={draft.schemaText} onChange={(e) => editDraft({ schemaText: e.target.value })} spellCheck={false} className={`${codeTextareaClass} min-h-56`} data-testid="input-definition-schema" /></Field>
                  {schemaCheck && !schemaCheck.ok && <Notice tone="error">{schemaCheck.error}</Notice>}
                  {draft.plan.reviewNotes.length > 0 && <div className="rounded-lg border border-border p-3"><div className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold"><ShieldAlert size={13} className="text-primary" />Review notes</div><ul className="list-disc space-y-1 pl-5 text-[11px] leading-relaxed text-muted-foreground">{draft.plan.reviewNotes.map((n, i) => <li key={i}>{n}</li>)}</ul></div>}
                  <dl className="grid gap-x-4 gap-y-2 rounded-lg bg-muted/50 p-3 text-[10.5px] sm:grid-cols-2" data-testid="text-plan-provenance">
                    <div className="sm:col-span-2"><dt className="foundry-mono text-[8.5px] uppercase tracking-[0.14em] text-muted-foreground">Reference</dt><dd><a href={draft.plan.referenceUrl} target="_blank" rel="noreferrer" className="break-all text-primary hover:underline">{draft.plan.referenceUrl}</a> <span className="foundry-mono text-muted-foreground">@ {draft.plan.referenceRevision.slice(0, 10)}</span></dd></div>
                    <div><dt className="foundry-mono text-[8.5px] uppercase tracking-[0.14em] text-muted-foreground">SDK</dt><dd><a href={draft.plan.sdkRepository} target="_blank" rel="noreferrer" className="break-all text-primary hover:underline">{draft.plan.sdkRepository}</a></dd></div>
                    <div><dt className="foundry-mono text-[8.5px] uppercase tracking-[0.14em] text-muted-foreground">Spec revision</dt><dd className="foundry-mono">{draft.plan.specificationRevision.slice(0, 10)}</dd></div>
                    <div className="sm:col-span-2"><dt className="foundry-mono text-[8.5px] uppercase tracking-[0.14em] text-muted-foreground">Review standards to apply (not verified)</dt><dd>{draft.plan.categories.length ? draft.plan.categories.join(', ') : 'None'}</dd></div>
                  </dl>
                  {saveError && <Notice tone="error">{saveError}</Notice>}
                  {editedAfterSave && <Notice tone="info">You edited the definition after saving it as #{j.saved!.id}. The saved copy is unchanged. Save again to create a new definition from these edits, or edit #{j.saved!.id} on the <Link href="/mcp" className="underline">MCP components</Link> page.</Notice>}
                  {savedMatches && <Notice tone="success">Saved as definition #{j.saved!.id}. Saving records a draft in the workspace; it is not a release approval.</Notice>}
                  <div className="flex flex-wrap items-center gap-3">
                    <Button onClick={() => { void runSave(); }} disabled={!canSave || create.isPending} testId="button-save-definition">{create.isPending ? 'Saving...' : <><Save size={14} />{editedAfterSave ? 'Save as new definition' : savedMatches ? 'Saved' : 'Save definition'}</>}</Button>
                    <span className="text-[10.5px] text-muted-foreground">Saving is not release approval.</span>
                  </div>
                </div>
              </Panel>
            )}
          </Step>

          <Step n="05" title="Generate the source package" state={s5}>
            {j.saved && components.isLoading && <div className="mb-3 h-10 animate-pulse rounded-lg bg-muted" />}
            {j.saved && components.isError && <div className="mb-3"><ErrorState label="Could not verify the saved definition." onRetry={() => { void components.refetch(); }} /></div>}
            {savedDeleted && <Notice tone="error">Saved definition #{j.saved!.id} no longer exists in the workspace. It may have been deleted. Save the definition again to continue.</Notice>}
            {savedComp && draft && savedMatches && !workspaceMatches && <Notice tone="error">The workspace definition changed after your review. Review it on MCP components, or save this draft as a new definition before generating.</Notice>}
            {savedComp && draft && savedMatches && !workspaceMatches && <Button kind="secondary" onClick={() => setJ((cur) => ({ ...cur, saved: null }))} testId="button-save-new-after-change">Keep this draft and save a new definition</Button>}
            {savedDeleted && <div className="mb-3"><Button kind="secondary" onClick={() => setJ((cur) => ({ ...cur, saved: null }))} testId="button-forget-deleted">Forget deleted definition</Button></div>}
            {!canGenerate && !shownPkg ? <Locked text={!j.saved ? 'Save the reviewed definition first.' : editedAfterSave ? 'The editor no longer matches the saved definition. Save the edits as a new definition to generate from them.' : !draft ? 'Inputs changed since the save. Redraft and save to continue.' : 'Waiting for saved definition verification.'} /> : (
              <Panel className="p-5">
                {savedComp && <div className="mb-3 rounded-lg border border-border p-3 text-[11px]" data-testid="panel-saved-definition"><div className="flex items-center gap-2"><span className="font-semibold">{savedComp.name}</span><span className="foundry-mono text-muted-foreground">#{savedComp.id} · {savedComp.status} · updated {new Date(savedComp.updatedAt).toLocaleString()}</span></div><p className="mt-1 text-muted-foreground">{savedComp.description || 'No description.'}</p><p className="mt-1 text-[10px] text-muted-foreground">Generating from the workspace copy, {LANGS.find((l) => l.id === j.config.language)?.label} for {j.config.target === 'cloudflare' ? 'Cloudflare Workers' : 'NVIDIA OpenShell'}.</p></div>}
                {genError && <Notice tone="error">{genError}</Notice>}
                <Button onClick={() => { void runGenerate(); }} disabled={!canGenerate || generate.isPending} testId="button-generate-package">{generate.isPending ? 'Generating package...' : <><Wand2 size={14} />{genError ? 'Retry generation' : shownPkg ? 'Regenerate package' : 'Generate package with AI'}</>}</Button>
                <div className="mt-4">{generate.isPending ? <div className="h-64 animate-pulse rounded-lg bg-muted" /> : shownPkg ? <GeneratedView pkg={shownPkg} openFile={openFile} setOpenFile={setOpenFile} /> : null}</div>
              </Panel>
            )}
          </Step>
        </ol>

        <aside className="space-y-4 xl:sticky xl:top-20 xl:self-start">
          <Panel className="p-4">
            <div className="foundry-mono mb-3 text-[9px] uppercase tracking-[0.18em] text-primary">Journey ledger</div>
            <dl className="space-y-2.5 text-[11px]">
              <div><dt className="text-muted-foreground">Reference</dt><dd className="font-semibold" data-testid="text-ledger-reference">{j.selected ? `${j.selected.name} (#${j.selected.id})` : 'None yet'}</dd></div>
              <div><dt className="text-muted-foreground">Configuration</dt><dd className="foundry-mono">{j.config.language} / {j.config.target} / {j.config.transport}</dd></div>
              <div><dt className="text-muted-foreground">Definition</dt><dd data-testid="text-ledger-definition">{savedMatches ? `Saved #${j.saved!.id}` : draft ? 'Unsaved AI draft' : 'Not drafted'}</dd></div>
              <div><dt className="text-muted-foreground">Package</dt><dd>{shownPkg ? 'Draft generated (this session only)' : 'Not generated'}</dd></div>
            </dl>
          </Panel>
          <Panel className="p-4">
            <div className="foundry-mono mb-2 text-[9px] uppercase tracking-[0.18em] text-muted-foreground">What has not happened</div>
            <p className="text-[10.5px] leading-relaxed text-muted-foreground">No build, protocol test, security review, or release review has been run on anything here. This builder never runs, deploys, or approves packages; the existing runtime safety gate is unchanged.</p>
          </Panel>
          <p className="px-1 text-[10px] leading-relaxed text-muted-foreground">Progress is kept in this browser tab (goal, selection, configuration, unsaved draft, saved id). Generated source is never stored. New journey clears it without touching saved definitions.</p>
        </aside>
      </div>
    </>
  );
}
