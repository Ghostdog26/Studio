import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getGetOverviewQueryKey, getListAgentsQueryKey, useCreateAgent, useDeleteAgent, useListAgents, useUpdateAgent, type Agent } from '@workspace/api-client-react';
import { ArrowUpRight, Bot, Braces, Pencil, Plus, Sparkles, Trash2 } from 'lucide-react';
import { AddButton, Button, EmptyState, ErrorState, Field, inputClass, Modal, Notice, PageHeading, Panel, SectionTitle, StatusPill, textareaClass, codeTextareaClass } from '@/components/foundry-ui';

type AgentFields = { name: string; description: string; model: string; runtime: string; instructions: string; inputSchema: string; status: string };
const defaultFields: AgentFields = { name: '', description: '', model: '', runtime: 'portable', instructions: '', inputSchema: '{\n  "type": "object",\n  "properties": {}\n}', status: 'draft' };
const fromAgent = (agent: Agent): AgentFields => ({ name: agent.name, description: agent.description, model: agent.model, runtime: agent.runtime, instructions: agent.instructions, inputSchema: JSON.stringify(agent.inputSchema, null, 2), status: agent.status });

export default function AgentsPage() {
  const queryClient = useQueryClient();
  const agents = useListAgents();
  const create = useCreateAgent();
  const update = useUpdateAgent();
  const remove = useDeleteAgent();
  const [editing, setEditing] = useState<Agent | 'new' | null>(null);
  const [fields, setFields] = useState<AgentFields>(defaultFields);
  const [feedback, setFeedback] = useState<{ text: string; error?: boolean } | null>(null);
  const invalidate = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: getListAgentsQueryKey() }),
    queryClient.invalidateQueries({ queryKey: getGetOverviewQueryKey() }),
  ]);
  const startCreate = () => { setFields(defaultFields); setEditing('new'); setFeedback(null); };
  const startEdit = (agent: Agent) => { setFields(fromAgent(agent)); setEditing(agent); setFeedback(null); };
  const set = (key: keyof AgentFields, value: string) => setFields((current) => ({ ...current, [key]: value }));
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);
    let schema: Record<string, unknown>;
    try { schema = JSON.parse(fields.inputSchema) as Record<string, unknown>; }
    catch { setFeedback({ text: 'Input schema must be valid JSON.', error: true }); return; }
    const payload = { name: fields.name.trim(), description: fields.description.trim(), model: fields.model.trim(), runtime: fields.runtime as 'cloudflare' | 'nvidia' | 'portable', instructions: fields.instructions, inputSchema: schema };
    if (!payload.name) { setFeedback({ text: 'Agent name is required.', error: true }); return; }
    const onSuccess = () => { void invalidate(); setEditing(null); setFeedback({ text: 'Agent definition saved.' }); };
    const onError = () => setFeedback({ text: 'Could not save the agent definition.', error: true });
    if (editing === 'new') create.mutate({ data: payload }, { onSuccess, onError });
    else if (editing) update.mutate({ id: editing.id, data: { ...payload, status: fields.status as 'draft' | 'active' } }, { onSuccess, onError });
  };
  const deleteAgent = (agent: Agent) => {
    if (!window.confirm(`Delete agent “${agent.name}”?`)) return;
    remove.mutate({ id: agent.id }, { onSuccess: () => { void invalidate(); setFeedback({ text: 'Agent definition deleted.' }); }, onError: () => setFeedback({ text: 'Could not delete this agent.', error: true }) });
  };
  return (
    <>
      <PageHeading eyebrow="Standardized agent factory" title="Make agents portable." description="Turn team practices into repeatable agent definitions—with explicit instructions, input contracts, and runtime intent." action={<AddButton onClick={startCreate}>New agent</AddButton>} />
      {feedback && <Notice tone={feedback.error ? 'error' : 'success'}>{feedback.text}</Notice>}
      {agents.isLoading ? <div className="grid gap-4 lg:grid-cols-2">{[1, 2, 3, 4].map((i) => <div key={i} className="h-52 animate-pulse rounded-xl bg-muted" />)}</div> : agents.isError ? <ErrorState onRetry={() => { void agents.refetch(); }} /> : agents.data?.length ? <div className="grid gap-4 lg:grid-cols-2">{agents.data.map((agent) => <Panel key={agent.id} className="overflow-hidden" data-testid={`agent-card-${agent.id}`}><div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4"><div className="flex min-w-0 items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent text-primary"><Bot size={19} /></div><div className="min-w-0"><h2 className="foundry-display text-lg font-semibold">{agent.name}</h2><p className="mt-1 text-xs leading-relaxed text-muted-foreground">{agent.description || 'No description provided.'}</p></div></div><StatusPill value={agent.status} /></div><div className="grid grid-cols-2 gap-x-4 gap-y-3 px-5 py-4"><div><div className="foundry-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Model</div><div className="mt-1 text-xs font-semibold">{agent.model || 'Not specified'}</div></div><div><div className="foundry-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Runtime intent</div><div className="mt-1 text-xs font-semibold capitalize">{agent.runtime}</div></div><div className="col-span-2"><div className="foundry-mono mb-1.5 text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Input schema</div><div className="foundry-mono line-clamp-2 rounded-lg bg-[#202a31] px-3 py-2 text-[10px] leading-relaxed text-[#d9e4dc]">{JSON.stringify(agent.inputSchema)}</div></div><div className="col-span-2"><div className="foundry-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Instructions</div><p className="mt-1 line-clamp-2 text-[11px] leading-relaxed text-muted-foreground">{agent.instructions}</p></div></div><div className="flex items-center justify-between border-t border-border bg-background/50 px-5 py-3"><span className="foundry-mono text-[9px] text-muted-foreground">UPDATED {new Date(agent.updatedAt).toLocaleDateString()}</span><div className="flex gap-1"><button onClick={() => startEdit(agent)} aria-label={`Edit ${agent.name}`} data-testid={`button-edit-agent-${agent.id}`} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"><Pencil size={13} />Edit</button><button onClick={() => deleteAgent(agent)} aria-label={`Delete ${agent.name}`} data-testid={`button-delete-agent-${agent.id}`} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] font-semibold text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 size={13} />Delete</button></div></div></Panel>)}</div> : <EmptyState icon={Sparkles} title="Your agent factory is unconfigured." detail="Create the first standardized definition with a runtime target and JSON Schema input contract." action={<AddButton onClick={startCreate}>Create first agent</AddButton>} />}
      {editing && <Modal title={editing === 'new' ? 'Create agent' : `Edit ${editing.name}`} onClose={() => setEditing(null)}><form onSubmit={submit} className="space-y-4"><div className="grid gap-4 sm:grid-cols-2"><Field label="Agent name"><input required value={fields.name} onChange={(event) => set('name', event.target.value)} className={inputClass} data-testid="input-agent-name" /></Field><Field label="Model"><input value={fields.model} onChange={(event) => set('model', event.target.value)} className={inputClass} placeholder="Model identifier" data-testid="input-agent-model" /></Field></div><Field label="Description"><textarea value={fields.description} onChange={(event) => set('description', event.target.value)} className={textareaClass} data-testid="input-agent-description" /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Runtime intent" hint="Portable definitions are not live-connected to an execution provider."><select value={fields.runtime} onChange={(event) => set('runtime', event.target.value)} className={inputClass} data-testid="select-agent-runtime"><option value="portable">Portable</option><option value="cloudflare">Cloudflare</option><option value="nvidia">NVIDIA</option></select></Field>{editing !== 'new' && <Field label="Definition status"><select value={fields.status} onChange={(event) => set('status', event.target.value)} className={inputClass} data-testid="select-agent-status"><option value="draft">Draft</option><option value="active">Active</option></select></Field>}</div><Field label="Instructions"><textarea value={fields.instructions} onChange={(event) => set('instructions', event.target.value)} className={textareaClass} data-testid="input-agent-instructions" /></Field><Field label="Input JSON Schema" hint="Enter a JSON object describing the agent input contract."><div className="relative"><Braces size={14} className="absolute right-3 top-3 text-[#90cdb0]" /><textarea required value={fields.inputSchema} onChange={(event) => set('inputSchema', event.target.value)} className={codeTextareaClass} data-testid="input-agent-schema" /></div></Field><div className="flex justify-end gap-2 border-t border-border pt-4"><Button kind="secondary" onClick={() => setEditing(null)}>Cancel</Button><Button type="submit" disabled={create.isPending || update.isPending} testId="button-save-agent">{create.isPending || update.isPending ? 'Saving…' : 'Save definition'}<ArrowUpRight size={13} /></Button></div></form></Modal>}
    </>
  );
}
