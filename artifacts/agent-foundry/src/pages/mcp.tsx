import { useState, type FormEvent } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { getGetOverviewQueryKey, getListComponentsQueryKey, useCreateComponent, useDeleteComponent, useListComponents, useUpdateComponent, type McpComponent } from '@workspace/api-client-react';
import { Boxes, Braces, Cable, Layers3, Pencil, Server, Smartphone, Trash2 } from 'lucide-react';
import { AddButton, Button, EmptyState, ErrorState, Field, inputClass, Modal, Notice, PageHeading, Panel, SectionTitle, StatusPill, textareaClass, codeTextareaClass } from '@/components/foundry-ui';

type ComponentFields = { name: string; description: string; kind: string; transport: string; jsonSchema: string; status: string };
const initialFields: ComponentFields = { name: '', description: '', kind: 'server', transport: '', jsonSchema: '{\n  "type": "object",\n  "properties": {}\n}', status: 'draft' };
const fieldsFrom = (component: McpComponent): ComponentFields => ({ name: component.name, description: component.description, kind: component.kind, transport: component.transport, jsonSchema: JSON.stringify(component.jsonSchema, null, 2), status: component.status });

export default function McpPage() {
  const queryClient = useQueryClient();
  const components = useListComponents();
  const create = useCreateComponent();
  const update = useUpdateComponent();
  const remove = useDeleteComponent();
  const [editing, setEditing] = useState<McpComponent | 'new' | null>(null);
  const [fields, setFields] = useState<ComponentFields>(initialFields);
  const [feedback, setFeedback] = useState<{ text: string; error?: boolean } | null>(null);
  const invalidate = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: getListComponentsQueryKey() }),
    queryClient.invalidateQueries({ queryKey: getGetOverviewQueryKey() }),
  ]);
  const openCreate = () => { setFields(initialFields); setEditing('new'); setFeedback(null); };
  const openEdit = (component: McpComponent) => { setFields(fieldsFrom(component)); setEditing(component); setFeedback(null); };
  const set = (key: keyof ComponentFields, value: string) => setFields((current) => ({ ...current, [key]: value }));
  const submit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);
    let schema: Record<string, unknown>;
    try { schema = JSON.parse(fields.jsonSchema) as Record<string, unknown>; }
    catch { setFeedback({ text: 'JSON Schema must be valid JSON.', error: true }); return; }
    const payload = { name: fields.name.trim(), description: fields.description.trim(), kind: fields.kind as 'server' | 'app', transport: fields.transport.trim(), jsonSchema: schema };
    if (!payload.name) { setFeedback({ text: 'Component name is required.', error: true }); return; }
    const onSuccess = () => { void invalidate(); setEditing(null); setFeedback({ text: 'MCP component definition saved.' }); };
    const onError = () => setFeedback({ text: 'Could not save the MCP component definition.', error: true });
    if (editing === 'new') create.mutate({ data: payload }, { onSuccess, onError });
    else if (editing) update.mutate({ id: editing.id, data: { ...payload, status: fields.status as 'draft' | 'ready' } }, { onSuccess, onError });
  };
  const deleteComponent = (component: McpComponent) => {
    if (!window.confirm(`Delete MCP definition “${component.name}”?`)) return;
    remove.mutate({ id: component.id }, { onSuccess: () => { void invalidate(); setFeedback({ text: 'MCP component definition deleted.' }); }, onError: () => setFeedback({ text: 'Could not delete this component.', error: true }) });
  };
  return (
    <>
      <PageHeading eyebrow="Prototype definitions" title="MCP drafts, not approved contracts." description="Preserved prototype server and app definitions. They are not MOSSI contracts; owner review happens in the repository once GitLab is connected." action={<AddButton onClick={openCreate}>New component</AddButton>} />
      {feedback && <Notice tone={feedback.error ? 'error' : 'success'}>{feedback.text}</Notice>}
      <Panel className="mb-5 flex flex-col gap-4 p-5 md:flex-row md:items-center md:justify-between md:px-6"><div className="flex items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-accent text-primary"><Cable size={18} /></div><div><h2 className="text-sm font-bold">Package and language generation is retired here</h2><p className="mt-1 max-w-2xl text-xs leading-relaxed text-muted-foreground">Source archives and multi-language generation are blocked by the server (MOSSI_CONTRIBUTION_REQUIRED). Contributions go to the monorepo through a contract-first merge request, starting in Contribute.</p></div></div><div className="foundry-mono shrink-0 rounded-md bg-muted px-3 py-2 text-[9px] uppercase tracking-wider text-muted-foreground">Prototype only</div></Panel>
      {components.isLoading ? <div className="grid gap-4 lg:grid-cols-2">{[1, 2, 3].map((i) => <div key={i} className="h-56 animate-pulse rounded-xl bg-muted" />)}</div> : components.isError ? <ErrorState onRetry={() => { void components.refetch(); }} /> : components.data?.length ? <div className="grid gap-4 lg:grid-cols-2">{components.data.map((component) => { const KindIcon = component.kind === 'server' ? Server : Smartphone; return <Panel key={component.id} className="overflow-hidden" data-testid={`component-card-${component.id}`}><div className="flex items-start justify-between gap-4 border-b border-border px-5 py-4"><div className="flex min-w-0 items-start gap-3"><div className="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-muted text-foreground"><KindIcon size={18} /></div><div><div className="mb-1 flex items-center gap-2"><h2 className="foundry-display text-lg font-semibold">{component.name}</h2><span className="rounded-md bg-muted px-1.5 py-0.5 text-[9px] font-semibold uppercase">{component.kind}</span></div><p className="text-xs leading-relaxed text-muted-foreground">{component.description || 'No description provided.'}</p></div></div><StatusPill value={component.status} /></div><div className="grid grid-cols-[1fr_auto] gap-4 px-5 py-4"><div><div className="foundry-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Transport</div><div className="mt-1 flex items-center gap-1.5 text-xs font-semibold"><Cable size={13} className="text-primary" />{component.transport || 'Not specified'}</div></div><div className="text-right"><div className="foundry-mono text-[9px] uppercase tracking-[0.14em] text-muted-foreground">Updated</div><div className="mt-1 text-[11px] text-muted-foreground">{new Date(component.updatedAt).toLocaleDateString()}</div></div><div className="col-span-2"><div className="foundry-mono mb-1.5 flex items-center gap-1 text-[9px] uppercase tracking-[0.14em] text-muted-foreground"><Braces size={11} />JSON Schema</div><pre className="foundry-mono max-h-28 overflow-auto rounded-lg bg-[#202a31] p-3 text-[10px] leading-relaxed text-[#d9e4dc]">{JSON.stringify(component.jsonSchema, null, 2)}</pre></div></div><div className="flex flex-col gap-3 border-t border-border bg-background/50 px-4 py-3 sm:flex-row sm:items-center sm:justify-between"><span className="foundry-mono text-[9.5px] uppercase tracking-wider text-muted-foreground" data-testid={`text-prototype-${component.id}`}>Prototype definition · not reviewed</span><div className="flex justify-end gap-1"><button onClick={() => openEdit(component)} aria-label={`Edit ${component.name}`} data-testid={`button-edit-component-${component.id}`} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] font-semibold text-muted-foreground hover:bg-muted hover:text-foreground"><Pencil size={13} />Edit</button><button onClick={() => deleteComponent(component)} aria-label={`Delete ${component.name}`} data-testid={`button-delete-component-${component.id}`} className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-2 text-[11px] font-semibold text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 size={13} />Delete</button></div></div></Panel>; })}</div> : <EmptyState icon={Boxes} title="No MCP components defined yet." detail="Add a server or app definition with a transport and JSON Schema contract." action={<AddButton onClick={openCreate}>Create first component</AddButton>} />}
      {editing && <Modal title={editing === 'new' ? 'Create MCP component' : `Edit ${editing.name}`} onClose={() => setEditing(null)}><form onSubmit={submit} className="space-y-4"><Field label="Name"><input required value={fields.name} onChange={(event) => set('name', event.target.value)} className={inputClass} data-testid="input-component-name" /></Field><Field label="Description"><textarea value={fields.description} onChange={(event) => set('description', event.target.value)} className={textareaClass} data-testid="input-component-description" /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Kind"><select value={fields.kind} onChange={(event) => set('kind', event.target.value)} className={inputClass} data-testid="select-component-kind"><option value="server">MCP server</option><option value="app">MCP app</option></select></Field><Field label="Transport" hint="Transport label accepted by the service."><input value={fields.transport} onChange={(event) => set('transport', event.target.value)} className={inputClass} data-testid="input-component-transport" /></Field>{editing !== 'new' && <Field label="Definition status"><select value={fields.status} onChange={(event) => set('status', event.target.value)} className={inputClass} data-testid="select-component-status"><option value="draft">Draft</option><option value="ready">Ready</option></select></Field>}</div><Field label="JSON Schema" hint="Use a JSON object. This contract is stored as part of the component definition."><div className="relative"><Layers3 size={14} className="absolute right-3 top-3 text-[#90cdb0]" /><textarea required value={fields.jsonSchema} onChange={(event) => set('jsonSchema', event.target.value)} className={codeTextareaClass} data-testid="input-component-schema" /></div></Field><div className="flex justify-end gap-2 border-t border-border pt-4"><Button kind="secondary" onClick={() => setEditing(null)}>Cancel</Button><Button type="submit" disabled={create.isPending || update.isPending} testId="button-save-component">{create.isPending || update.isPending ? 'Saving…' : 'Save component'}</Button></div></form></Modal>}
    </>
  );
}
