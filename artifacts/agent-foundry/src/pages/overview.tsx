import { useGetOverview, useHealthCheck } from '@workspace/api-client-react';
import { Link } from 'wouter';
import { Activity, ArrowUpRight, BrainCircuit, Boxes, Cpu, Database, FileText, Sparkles } from 'lucide-react';
import { PageHeading, Panel, SectionTitle, StatusPill, ErrorState, Button } from '@/components/foundry-ui';

function Metric({ label, value, caption, icon: Icon, accent }: { label: string; value: string | number; caption: string; icon: typeof FileText; accent?: boolean }) {
  return <Panel className="relative overflow-hidden p-5"><div className="flex items-start justify-between"><div><div className="foundry-mono text-[9px] uppercase tracking-[0.16em] text-muted-foreground">{label}</div><div className={`foundry-display mt-3 text-3xl font-bold ${accent ? 'text-primary' : ''}`}>{value}</div><div className="mt-1.5 text-[11px] text-muted-foreground">{caption}</div></div><div className="grid h-9 w-9 place-items-center rounded-lg bg-muted text-muted-foreground"><Icon size={17} /></div></div><div className="absolute bottom-0 left-0 h-[2px] w-full bg-gradient-to-r from-primary/60 via-primary/10 to-transparent" /></Panel>;
}

export default function OverviewPage() {
  const overview = useGetOverview();
  const health = useHealthCheck();
  if (overview.isLoading) return <div className="space-y-6"><div className="h-32 animate-pulse rounded-xl bg-muted" /><div className="grid grid-cols-2 gap-4 lg:grid-cols-4">{[1, 2, 3, 4].map((n) => <div key={n} className="h-28 animate-pulse rounded-xl bg-muted" />)}</div></div>;
  if (overview.isError || !overview.data) return <ErrorState onRetry={() => { void overview.refetch(); }} />;
  const data = overview.data;
  const runtimes = data.runtimes ?? [];
  const activities = data.recentActivity ?? [];
  return (
    <>
      <PageHeading eyebrow="Control Plane" title="Build from shared context." description="Bring enterprise knowledge, governed capability definitions, and standards together for reviewable AI delivery. Runtime adapters remain separate from live execution." action={<div className="flex items-center gap-2 rounded-lg border border-border bg-card px-3 py-2 text-xs"><span className={`h-2 w-2 rounded-full ${health.data?.status ? 'bg-primary' : 'bg-amber-500'}`} /><span className="font-semibold">{health.data?.status ? 'API operational' : 'Checking API'}</span></div>} />
      <div className="mb-7 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Metric label="Knowledge base" value={data.knowledgeCount} caption="shared source documents" icon={BrainCircuit} accent />
        <Metric label="Agent factory" value={data.agentCount} caption="standardized definitions" icon={Sparkles} />
        <Metric label="MCP components" value={data.componentCount} caption="server and app definitions" icon={Boxes} />
        <Metric label="Knowledge queries" value={data.queryCount} caption={`${(data.cacheHitRate * 100).toFixed(1)}% cache hit rate`} icon={Database} />
      </div>
      <div className="grid gap-5 lg:grid-cols-[1.2fr_0.8fr]">
        <Panel className="p-5 md:p-6">
          <SectionTitle meta={<span className="foundry-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Integration readiness</span>}>Runtime adapters</SectionTitle>
          <p className="mb-5 max-w-xl text-xs leading-relaxed text-muted-foreground">Definitions are portable across execution targets. Both adapters are ready to integrate, but neither is connected for live execution.</p>
          <div className="grid gap-3 sm:grid-cols-2">
            {runtimes.length ? runtimes.map((runtime) => <div key={runtime.id} className="rounded-xl border border-border bg-background/70 p-4" data-testid={`runtime-overview-${runtime.id}`}><div className="mb-3 flex items-center justify-between"><div className="flex items-center gap-2 text-sm font-semibold"><Cpu size={16} className="text-primary" />{runtime.name}</div><StatusPill value={runtime.status} /></div><p className="text-[11px] leading-relaxed text-muted-foreground">{runtime.description}</p><div className="mt-3 flex flex-wrap gap-1.5">{runtime.features.map((feature) => <span key={feature} className="rounded-md bg-muted px-2 py-1 text-[9px] text-muted-foreground">{feature}</span>)}</div></div>) : <p className="text-xs text-muted-foreground">No runtime adapter data returned.</p>}
          </div>
          <Link href="/runtimes" className="mt-5 inline-flex items-center gap-1.5 text-xs font-semibold text-primary">Read runtime readiness <ArrowUpRight size={14} /></Link>
        </Panel>
        <Panel className="p-5 md:p-6">
          <SectionTitle meta={<Activity size={15} className="text-muted-foreground" />}>Recent activity</SectionTitle>
          {activities.length ? <div className="divide-y divide-border">{activities.map((item) => <div key={item.id} data-testid={`activity-item-${item.id}`} className="flex gap-3 py-3 first:pt-0 last:pb-0"><div className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-primary" /><div className="min-w-0 flex-1"><p className="text-xs font-medium leading-relaxed">{item.label}</p><div className="foundry-mono mt-1 text-[9px] uppercase tracking-[0.12em] text-muted-foreground">{item.kind} <span className="px-1">/</span>{new Date(item.createdAt).toLocaleString()}</div></div></div>)}</div> : <div className="py-10 text-center text-xs text-muted-foreground">Activity will appear here as this workspace changes.</div>}
        </Panel>
      </div>
      <div className="mt-5 grid gap-5 md:grid-cols-3">
        {[
          { href: '/knowledge', title: 'Capture team knowledge', text: 'Create a trusted shared second brain, then query it with cited answers.', icon: BrainCircuit },
          { href: '/agents', title: 'Standardize agents', text: 'Shape reusable instructions, schemas, model choices, and runtime intent.', icon: Sparkles },
          { href: '/mcp', title: 'Compose MCP components', text: 'Define portable servers and apps with explicit JSON Schema contracts.', icon: Boxes },
        ].map((item) => {
          const Icon = item.icon;
          return <Link key={item.href} href={item.href} className="group flex items-start gap-3 rounded-xl border border-border bg-card p-4 transition hover:border-primary/40"><div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-accent text-primary"><Icon size={17} /></div><div className="min-w-0"><h3 className="text-xs font-bold">{item.title}</h3><p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{item.text}</p></div><ArrowUpRight size={14} className="ml-auto shrink-0 text-muted-foreground transition group-hover:text-primary" /></Link>;
        })}
      </div>
    </>
  );
}
