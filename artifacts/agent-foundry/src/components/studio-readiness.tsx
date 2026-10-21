import { getGetStudioWorkflowQueryKey, useGetStudioWorkflow, type StudioBlockedResponse, type StudioWorkflow } from '@workspace/api-client-react';
import { CircleSlash, GitMerge, ShieldQuestion } from 'lucide-react';
import { ErrorState, Panel } from '@/components/foundry-ui';

export function useStudioWorkflow() {
  return useGetStudioWorkflow({ query: { queryKey: getGetStudioWorkflowQueryKey(), staleTime: 60_000, refetchOnMount: 'always' } });
}

/** Reads a StudioBlockedResponse from a generated ApiError envelope (data) without trusting shape. */
export function blockedFrom(e: unknown): StudioBlockedResponse | null {
  if (typeof e !== 'object' || e === null) return null;
  const rec = e as { data?: unknown; body?: unknown };
  const d = (rec.data ?? rec.body) as Partial<StudioBlockedResponse> | undefined;
  if (d && typeof d === 'object' && (d.code === 'MOSSI_INTEGRATION_REQUIRED' || d.code === 'MOSSI_CONTRIBUTION_REQUIRED') && typeof d.error === 'string') return d as StudioBlockedResponse;
  return null;
}

const label = (s: string) => s.replaceAll('_', ' ');

export function IntegrationList({ workflow }: { workflow: StudioWorkflow }) {
  return (
    <ul className="divide-y divide-border">
      {workflow.integrations.map((i) => (
        <li key={i.id} className="flex items-start gap-3 py-3 first:pt-0 last:pb-0" data-testid={`integration-${i.id}`}>
          <span className={`mt-1 grid h-5 w-5 shrink-0 place-items-center rounded-full ${i.status === 'not_connected' ? 'bg-amber-100 text-amber-800' : 'bg-muted text-muted-foreground'}`}>{i.status === 'not_connected' ? <CircleSlash size={11} /> : <ShieldQuestion size={11} />}</span>
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline justify-between gap-2"><span className="text-[12.5px] font-semibold">{i.name}</span><span className="foundry-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground" data-testid={`status-integration-${i.id}`}>{label(i.status)}</span></div>
            <p className="mt-0.5 text-[11px] leading-relaxed text-muted-foreground">{i.purpose}</p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export function PolicyFacts({ workflow }: { workflow: StudioWorkflow }) {
  const lp = workflow.languagePolicy;
  const d = workflow.delivery;
  const rows: [string, string][] = [
    [d.repositoryPlaceholder ? 'Repository (placeholder)' : 'Repository', d.repositoryUrl],
    ['Allowed languages', lp.allowedLanguages.length ? lp.allowedLanguages.join(', ') : 'None verified'],
    ['Suggested (not policy)', lp.suggestedLanguages.join(', ') || 'None'],
    ['Pipeline (proposed)', d.pipeline],
    ['Capability path', d.capabilityPath],
    ['View path', d.viewPath],
    ['Contract review', d.contractReview],
  ];
  return (
    <dl className="grid gap-x-4 gap-y-2.5 text-[11px] sm:grid-cols-[150px_minmax(0,1fr)]" data-testid="policy-facts">
      {rows.map(([k, v]) => <div key={k} className="contents"><dt className="foundry-mono text-[9.5px] uppercase tracking-[0.12em] text-muted-foreground sm:pt-0.5">{k}</dt><dd className="foundry-mono break-words">{v}</dd></div>)}
      <div className="contents"><dt className="foundry-mono text-[9.5px] uppercase tracking-[0.12em] text-muted-foreground">Verification</dt><dd className="text-amber-800">{d.repositoryPlaceholder && 'Repository URL is a placeholder only; no connection or repository writes are enabled. '}Language policy {lp.status}; delivery {d.status} against the MOSSI repository.</dd></div>
    </dl>
  );
}

export function ReadinessPanel({ compact = false }: { compact?: boolean }) {
  const wf = useStudioWorkflow();
  if (wf.isLoading) return <div className="h-64 animate-pulse rounded-xl bg-muted" data-testid="readiness-loading" />;
  if (wf.isError || !wf.data) return <ErrorState label="Could not load MOSSI Studio readiness." onRetry={() => { void wf.refetch(); }} />;
  const w = wf.data;
  return (
    <Panel className="overflow-hidden">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border bg-amber-50/60 px-5 py-4">
        <div className="flex items-center gap-2.5"><GitMerge size={16} className="text-amber-800" /><div><div className="text-sm font-bold" data-testid="text-workflow-name">{w.name}</div><div className="foundry-mono text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground">{w.phase}</div></div></div>
        <span className="rounded-full bg-amber-100 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-wide text-amber-900" data-testid="status-workflow">{w.status}</span>
      </div>
      <div className={`grid gap-6 p-5 ${compact ? '' : 'lg:grid-cols-2'}`}>
        <div><div className="foundry-mono mb-3 text-[9.5px] uppercase tracking-[0.16em] text-primary">Integrations</div><IntegrationList workflow={w} /></div>
        {!compact && <div><div className="foundry-mono mb-3 text-[9.5px] uppercase tracking-[0.16em] text-primary">Policy, as proposed</div><PolicyFacts workflow={w} />
          {w.blockers.length > 0 && <ul className="mt-5 space-y-1.5 border-t border-border pt-4 text-[11px] leading-relaxed" data-testid="list-blockers">{w.blockers.map((b, i) => <li key={i} className="flex gap-2"><span className="mt-1.5 h-1 w-1 shrink-0 rounded-full bg-amber-600" />{b}</li>)}</ul>}
        </div>}
      </div>
    </Panel>
  );
}
