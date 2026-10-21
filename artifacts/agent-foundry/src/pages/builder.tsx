import { useRef, useState, type ReactNode } from 'react';
import { Link } from 'wouter';
import { useCheckStudioReuse, type StudioBlockedResponse } from '@workspace/api-client-react';
import { Check, CircleDot, FlaskConical, KeyRound, Library, Lock, RotateCcw, ScanSearch, ShieldAlert } from 'lucide-react';
import { Button, Notice, PageHeading, Panel, textareaClass } from '@/components/foundry-ui';
import { blockedFrom, PolicyFacts, ReadinessPanel, useStudioWorkflow } from '@/components/studio-readiness';

type StepState = 'done' | 'active' | 'blocked' | 'locked';

function Step({ n, title, state, children }: { n: string; title: string; state: StepState; children: ReactNode }) {
  const dot = state === 'done' ? 'border-primary bg-primary text-primary-foreground' : state === 'active' ? 'border-primary bg-card text-primary' : state === 'blocked' ? 'border-amber-500 bg-amber-50 text-amber-800' : 'border-border bg-muted text-muted-foreground';
  return (
    <li className="relative grid grid-cols-[36px_minmax(0,1fr)] gap-4 pb-8 last:pb-0" data-testid={`step-${n}`}>
      <span className="absolute bottom-0 left-[17px] top-10 w-px bg-border" aria-hidden />
      <div className={`foundry-mono z-[1] grid h-9 w-9 place-items-center rounded-full border text-[11px] font-semibold ${dot}`}>{state === 'done' ? <Check size={15} /> : state === 'locked' ? <Lock size={13} /> : state === 'blocked' ? <ShieldAlert size={14} /> : n}</div>
      <div className="min-w-0">
        <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2 pt-1.5"><h2 className={`foundry-display text-lg font-semibold ${state === 'locked' ? 'text-muted-foreground' : ''}`}>{title}</h2><span className="foundry-mono text-[9.5px] uppercase tracking-[0.14em] text-muted-foreground" data-testid={`status-step-${n}`}>{state}</span></div>
        {children}
      </div>
    </li>
  );
}

const Locked = ({ text }: { text: string }) => <div className="rounded-lg border border-dashed border-border px-4 py-3 text-[11.5px] leading-relaxed text-muted-foreground">{text}</div>;

export default function BuilderPage() {
  const wf = useStudioWorkflow();
  const reuse = useCheckStudioReuse();
  // Goal lives in memory only: never persisted or logged.
  const [goal, setGoal] = useState('');
  const [result, setResult] = useState<{ goal: string; blocked: StudioBlockedResponse | null; error: string | null } | null>(null);
  const liveGoal = useRef('');
  const goalT = goal.trim();
  liveGoal.current = goalT;
  const valid = goalT.length >= 8 && goalT.length <= 2000;

  const run = async () => {
    if (!valid || reuse.isPending) return;
    const sent = goalT;
    try {
      await reuse.mutateAsync({ data: { goal: sent } });
      // A 2xx would mean real results exist; this phase has no such contract, so treat as unexpected.
      if (liveGoal.current === sent) setResult({ goal: sent, blocked: null, error: 'Unexpected response: no reuse result contract exists yet. Nothing is concluded.' });
    } catch (e) {
      if (liveGoal.current !== sent) return;
      const b = blockedFrom(e);
      setResult({ goal: sent, blocked: b, error: b ? null : 'The reuse check could not be reached. No search was made and nothing is concluded.' });
    }
  };

  const shown = result && result.goal === goalT ? result : null;
  const reset = () => { setGoal(''); setResult(null); reuse.reset(); };
  const w = shown?.blocked?.workflow ?? wf.data;

  return (
    <>
      <PageHeading eyebrow="MOSSI Studio · Contribute" title="Reuse first. Contract next. Then a merge request." description="Describe what you need. MOSSI Studio checks internal capabilities before anything new is proposed, then hands a contract to repository owners for review. Phase one: internal integrations are not connected, so each step reports exactly where it is blocked."
        action={<Button kind="secondary" onClick={reset} disabled={reuse.isPending} testId="button-reset-contribution"><RotateCcw size={14} />Start over</Button>} />

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_340px]">
        <ol className="min-w-0">
          <Step n="01" title="Describe the goal" state={shown ? 'done' : 'active'}>
            <Panel className="p-5">
              <p className="mb-3 flex gap-2.5 text-[12.5px] leading-relaxed text-muted-foreground"><CircleDot size={14} className="mt-0.5 shrink-0 text-primary" />State the outcome, who uses it, and which systems or data it touches. This text stays in this tab and is not saved.</p>
              <textarea value={goal} maxLength={2000} onChange={(e) => setGoal(e.target.value)} placeholder="e.g. Field teams need to look up open maintenance orders by site, read-only." className={textareaClass} data-testid="input-goal" />
              <div className="mt-1 flex justify-between text-[10px] text-muted-foreground"><span>{goalT.length < 8 ? `At least 8 characters (${goalT.length}/8)` : 'Ready to check reuse'}</span><span className="foundry-mono">{goal.length}/2000</span></div>
              <div className="mt-3 flex gap-2 rounded-lg border border-amber-300/60 bg-amber-50 px-3 py-2.5 text-[11px] text-amber-900"><KeyRound size={14} className="mt-0.5 shrink-0" />Do not paste credentials, tokens, or sensitive sample records.</div>
              <div className="mt-4"><Button onClick={() => { void run(); }} disabled={!valid || reuse.isPending} testId="button-check-reuse">{reuse.isPending ? 'Checking readiness...' : <><ScanSearch size={14} />Check internal reuse</>}</Button></div>
            </Panel>
          </Step>

          <Step n="02" title="Search for internal reuse" state={reuse.isPending ? 'active' : shown ? 'blocked' : 'locked'}>
            {reuse.isPending ? <div className="h-28 animate-pulse rounded-xl bg-muted" /> : !shown ? (
              result ? <Locked text="Your goal changed since the last check. Run it again for the current wording." /> : <Locked text="Submit a goal to run the internal reuse check." />
            ) : shown.blocked ? (
              <Panel className="border-amber-300/70 p-5" >
                <div className="flex items-start gap-3" data-testid="reuse-blocked">
                  <ShieldAlert size={18} className="mt-0.5 shrink-0 text-amber-700" />
                  <div className="min-w-0">
                    <div className="foundry-mono text-[9.5px] uppercase tracking-[0.14em] text-amber-800" data-testid="text-blocked-code">{shown.blocked.code}</div>
                    <p className="mt-1 text-sm font-semibold">Discovery is blocked. No enterprise query was made.</p>
                    <p className="mt-1 text-[12px] leading-relaxed text-muted-foreground" data-testid="text-blocked-error">{shown.blocked.error}</p>
                    <p className="mt-3 text-[11.5px] leading-relaxed">This is not a "nothing exists" result. Until the registry, OpenMetadata, and knowledge sources are connected, MOSSI Studio cannot say whether this capability already exists, so a new-capability proposal stays locked.</p>
                  </div>
                </div>
              </Panel>
            ) : <div><Notice tone="error">{shown.error}</Notice><Button kind="secondary" onClick={() => { void run(); }} testId="button-retry-reuse">Retry</Button></div>}
            <div className="mt-3 flex items-center gap-2 text-[11px] text-muted-foreground"><Library size={12} />Looking for outside inspiration? The <Link href="/catalogue" className="text-primary underline" data-testid="link-external-catalogue">external catalogue</Link> is a public reference only and never satisfies this check.</div>
          </Step>

          <Step n="03" title="Draft the contract" state="locked">
            <Locked text="Locked until reuse is decided with real evidence. Contracts will be drafted from pinned repository standards and templates, referencing canonical schemas, and labelled unapproved." />
          </Step>
          <Step n="04" title="Owner review of the contract" state="locked">
            <Locked text={w ? `Proposed: ${w.delivery.contractReview}. Review happens in GitLab under repository rules; MOSSI Studio has no approve button.` : 'Review happens in GitLab under repository rules; MOSSI Studio has no approve button.'} />
          </Step>
          <Step n="05" title="Implementation merge request" state="locked">
            <Locked text={w ? `Proposed destination ${w.delivery.capabilityPath}, views at ${w.delivery.viewPath}. No archive download, no language picker, no deploy control.` : 'No archive download, no language picker, no deploy control.'} />
          </Step>
          <Step n="06" title="Hand off to CI and delivery" state="locked">
            <Locked text={w ? `${w.delivery.pipeline} owns build and release (unverified). MOSSI Studio will only report observed status.` : 'Existing CI and delivery own build and release.'} />
          </Step>
        </ol>

        <aside className="space-y-4">
          <ReadinessPanel compact />
          {wf.data && <Panel className="p-5"><div className="foundry-mono mb-3 text-[9.5px] uppercase tracking-[0.16em] text-primary">Policy, as proposed</div><PolicyFacts workflow={wf.data} /></Panel>}
          <Link href="/prototype/builder" className="flex items-start gap-3 rounded-xl border border-dashed border-border p-4 text-[11px] text-muted-foreground transition hover:border-primary/40" data-testid="link-prototype-builder"><FlaskConical size={15} className="mt-0.5 shrink-0" /><span>Earlier guided-builder journey is preserved, read-only in practice, under Legacy builder.</span></Link>
        </aside>
      </div>
    </>
  );
}
