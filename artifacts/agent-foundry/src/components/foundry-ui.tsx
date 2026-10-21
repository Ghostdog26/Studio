import { type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'wouter';
import {
  Activity,
  Boxes,
  BrainCircuit,
  ChevronRight,
  CircleHelp,
  Cpu,
  FileText,
  Library,
  FlaskConical,
  Gauge,
  Hammer,
  Layers3,
  Plus,
  Radio,
  Sparkles,
  X,
} from 'lucide-react';

export const navItems = [
  { href: '/', label: 'Overview', icon: Gauge },
  { href: '/builder', label: 'Contribute', icon: Hammer },
  { href: '/catalogue', label: 'External catalogue', icon: Library },
  { href: '/knowledge', label: 'Reference knowledge', icon: BrainCircuit },
  { href: '/agents', label: 'Agent prototypes', icon: Sparkles },
  { href: '/mcp', label: 'MCP prototypes', icon: Boxes },
  { href: '/runtimes', label: 'Delivery context', icon: Cpu },
  { href: '/prototype/builder', label: 'Legacy builder', icon: FlaskConical },
];

export function Shell({ children, path }: { children: ReactNode; path: string }) {
  return (
    <div className="min-h-[100dvh] md:grid md:grid-cols-[248px_minmax(0,1fr)]">
      <aside className="hidden min-h-[100dvh] flex-col bg-sidebar text-sidebar-foreground md:flex">
        <div className="flex items-center gap-3 px-7 pb-8 pt-7">
          <div className="grid h-10 w-10 place-items-center rounded-xl bg-sidebar-primary text-sidebar-primary-foreground">
            <Layers3 size={21} strokeWidth={2.3} />
          </div>
          <div>
            <div className="foundry-display text-lg font-bold tracking-tight">MOSSI Studio</div>
            <div className="foundry-mono mt-0.5 text-[9px] uppercase tracking-[0.19em] text-sidebar-foreground/55">Capability contributions</div>
          </div>
        </div>
        <div className="px-4">
          <div className="foundry-mono mb-2 px-3 text-[9px] uppercase tracking-[0.19em] text-sidebar-foreground/40">Workspace</div>
          <nav className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon;
              const active = path === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  data-testid={`link-nav-${item.label.toLowerCase().replaceAll(' ', '-')}`}
                  className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-[13px] font-medium transition-colors ${
                    active ? 'bg-sidebar-accent text-sidebar-accent-foreground' : 'text-sidebar-foreground/70 hover:bg-sidebar-accent/70 hover:text-sidebar-foreground'
                  }`}
                >
                  <Icon size={16} strokeWidth={1.8} />
                  <span>{item.label}</span>
                  {active && <span className="ml-auto h-1.5 w-1.5 rounded-full bg-sidebar-primary" />}
                </Link>
              );
            })}
          </nav>
        </div>
        <div className="mt-auto px-4 pb-5">
          <div className="mb-4 rounded-xl border border-sidebar-border bg-sidebar-accent/45 p-4">
            <div className="flex items-center gap-2 text-xs font-semibold">
              <Radio size={14} className="text-sidebar-primary" />
              Integrations pending
            </div>
            <p className="mt-2 text-[11px] leading-relaxed text-sidebar-foreground/60">Registry, identity, knowledge, and GitLab are not connected. Discovery reports blocked, never empty.</p>
            <Link href="/builder" className="mt-3 inline-flex items-center gap-1 text-[11px] font-semibold text-sidebar-primary">
              Workflow readiness <ChevronRight size={13} />
            </Link>
          </div>
          <div className="flex items-center justify-between border-t border-sidebar-border px-2 pt-4 text-[10px] text-sidebar-foreground/45">
            <span>MOSSI STUDIO · PHASE 1</span>
            <span className="foundry-mono">v0.1</span>
          </div>
        </div>
      </aside>
      <div className="min-w-0">
        <header className="sticky top-0 z-20 flex h-14 items-center justify-between border-b border-border/80 bg-background/95 px-5 backdrop-blur md:px-10">
          <div className="flex items-center gap-2 md:hidden">
            <div className="grid h-8 w-8 place-items-center rounded-lg bg-sidebar text-sidebar-primary"><Layers3 size={17} /></div>
            <span className="foundry-display text-sm font-bold">MOSSI Studio</span>
          </div>
          <div className="hidden items-center gap-2 text-[11px] text-muted-foreground md:flex">
            <span>MOSSI</span><span className="text-border">/</span><span className="font-medium text-foreground">REUSE · CONTRACT · MERGE REQUEST</span>
          </div>
          <div className="flex items-center gap-2">
            <span className="foundry-mono hidden text-[10px] uppercase tracking-wider text-muted-foreground sm:inline">Unverified integrations</span>
            <div className="ml-2 grid h-8 w-8 place-items-center rounded-full border border-border bg-card text-muted-foreground"><CircleHelp size={15} /></div>
          </div>
        </header>
        <nav className="flex gap-1 overflow-x-auto border-b border-border bg-card px-3 py-2 md:hidden">
          {navItems.map((item) => {
            const Icon = item.icon;
            return <Link key={item.href} href={item.href} className={`flex shrink-0 items-center gap-1.5 rounded-md px-3 py-2 text-xs ${path === item.href ? 'bg-accent font-semibold text-accent-foreground' : 'text-muted-foreground'}`}><Icon size={14} />{item.label}</Link>;
          })}
        </nav>
        <main className="page-enter mx-auto w-full max-w-[1440px] px-5 pb-12 pt-8 md:px-10 md:pt-10">{children}</main>
      </div>
    </div>
  );
}

export function PageHeading({ eyebrow, title, description, action }: { eyebrow: string; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="mb-8 flex flex-col justify-between gap-5 border-b border-border pb-6 sm:flex-row sm:items-end">
      <div>
        <div className="foundry-mono mb-2 text-[10px] uppercase tracking-[0.18em] text-primary">{eyebrow}</div>
        <h1 className="foundry-display text-3xl font-bold leading-tight text-foreground md:text-[38px]">{title}</h1>
        <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{description}</p>
      </div>
      {action && <div className="shrink-0">{action}</div>}
    </div>
  );
}

export function Button({ children, onClick, kind = 'primary', type = 'button', disabled, testId }: { children: ReactNode; onClick?: () => void; kind?: 'primary' | 'secondary' | 'quiet' | 'danger'; type?: 'button' | 'submit'; disabled?: boolean; testId?: string }) {
  const colors = {
    primary: 'bg-primary text-primary-foreground hover:brightness-95',
    secondary: 'border border-border bg-card text-foreground hover:bg-muted',
    quiet: 'text-muted-foreground hover:bg-muted hover:text-foreground',
    danger: 'border border-destructive/30 bg-destructive/10 text-destructive hover:bg-destructive/15',
  };
  return <button type={type} onClick={onClick} disabled={disabled} data-testid={testId} className={`inline-flex min-h-9 items-center justify-center gap-2 rounded-lg px-3.5 text-xs font-semibold transition disabled:cursor-not-allowed disabled:opacity-55 ${colors[kind]}`}>{children}</button>;
}

export function AddButton({ children, onClick }: { children: ReactNode; onClick: () => void }) {
  return <Button onClick={onClick} testId="button-add"><Plus size={15} />{children}</Button>;
}

export function Panel({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <section className={`rounded-xl border border-card-border bg-card shadow-sm ${className}`}>{children}</section>;
}

export function SectionTitle({ children, meta }: { children: ReactNode; meta?: ReactNode }) {
  return <div className="mb-4 flex items-center justify-between"><h2 className="foundry-display text-lg font-semibold">{children}</h2>{meta}</div>;
}

export function StatusPill({ value }: { value: string }) {
  const good = ['active', 'ready', 'adapter-ready'].includes(value);
  const tone = good ? 'bg-primary/10 text-primary' : value === 'not-connected' ? 'bg-amber-100 text-amber-800' : 'bg-muted text-muted-foreground';
  const label = value.replaceAll('-', ' ');
  return <span data-testid={`status-${value}`} className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-[10px] font-semibold capitalize ${tone}`}><span className={`h-1.5 w-1.5 rounded-full ${good ? 'bg-primary' : value === 'not-connected' ? 'bg-amber-600' : 'bg-muted-foreground'}`} />{label}</span>;
}

export function Notice({ children, tone = 'success' }: { children: ReactNode; tone?: 'success' | 'error' | 'info' }) {
  const color = tone === 'error' ? 'border-destructive/25 bg-destructive/5 text-destructive' : tone === 'info' ? 'border-border bg-muted/50 text-muted-foreground' : 'border-primary/20 bg-primary/5 text-primary';
  return <div role={tone === 'error' ? 'alert' : 'status'} data-testid={`notice-${tone}`} className={`mb-4 rounded-lg border px-4 py-3 text-xs ${color}`}>{children}</div>;
}

export function ErrorState({ onRetry, label = 'Could not load this workspace data.' }: { onRetry: () => void; label?: string }) {
  return <div className="rounded-xl border border-destructive/25 bg-card p-7 text-center"><div className="mx-auto mb-3 grid h-10 w-10 place-items-center rounded-full bg-destructive/10 text-destructive"><Activity size={18} /></div><p className="text-sm font-semibold">{label}</p><p className="mt-1 text-xs text-muted-foreground">The server did not return a usable response.</p><Button kind="secondary" onClick={onRetry}>Retry</Button></div>;
}

export function EmptyState({ title, detail, icon = FileText, action }: { title: string; detail: string; icon?: typeof FileText; action?: ReactNode }) {
  const Icon = icon;
  return <div className="rounded-xl border border-dashed border-border bg-card/60 px-6 py-12 text-center"><div className="mx-auto mb-3 grid h-11 w-11 place-items-center rounded-xl bg-muted text-muted-foreground"><Icon size={19} /></div><h3 className="text-sm font-semibold">{title}</h3><p className="mx-auto mt-1 max-w-sm text-xs leading-relaxed text-muted-foreground">{detail}</p>{action && <div className="mt-4">{action}</div>}</div>;
}

export function Modal({ title, children, onClose }: { title: string; children: ReactNode; onClose: () => void }) {
  return createPortal(<div className="fixed inset-0 z-50 flex items-end justify-center bg-foreground/35 p-0 backdrop-blur-[2px] sm:items-center sm:p-5" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) onClose(); }}><div role="dialog" aria-modal="true" aria-label={title} className="max-h-[94dvh] w-full overflow-y-auto rounded-t-2xl border border-border bg-background p-5 shadow-2xl sm:max-w-2xl sm:rounded-2xl sm:p-7"><div className="mb-5 flex items-start justify-between gap-4"><div><div className="foundry-mono mb-1 text-[9px] uppercase tracking-[0.18em] text-primary">Workspace definition</div><h2 className="foundry-display text-2xl font-bold">{title}</h2></div><button aria-label="Close dialog" data-testid="button-close-dialog" onClick={onClose} className="rounded-lg p-2 text-muted-foreground hover:bg-muted"><X size={17} /></button></div>{children}</div></div>, document.body);
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return <label className="block space-y-1.5"><span className="text-xs font-semibold">{label}</span>{children}{hint && <span className="block text-[10px] leading-relaxed text-muted-foreground">{hint}</span>}</label>;
}

export const inputClass = 'w-full rounded-lg border border-input bg-background px-3 py-2.5 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15';
export const textareaClass = `${inputClass} min-h-24 resize-y leading-relaxed`;
export const codeTextareaClass = 'foundry-mono min-h-40 w-full rounded-lg border border-input bg-[#202a31] px-3.5 py-3 text-xs leading-relaxed text-[#d9e4dc] outline-none focus:border-primary focus:ring-2 focus:ring-primary/20';
