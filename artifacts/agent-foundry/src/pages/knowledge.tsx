import { useEffect, useRef, useState } from 'react';
import { useSearch } from 'wouter';
import { useQueryClient } from '@tanstack/react-query';
import { getGetOverviewQueryKey, getListKnowledgeQueryKey, useCreateKnowledge, useDeleteKnowledge, useListKnowledge, useQueryKnowledge, useUpdateKnowledge, type KnowledgeDocument } from '@workspace/api-client-react';
import { BookOpen, Check, Clock3, Pencil, Search, Trash2 } from 'lucide-react';
import { AddButton, Button, EmptyState, ErrorState, Field, inputClass, Modal, Notice, PageHeading, Panel, SectionTitle, textareaClass } from '@/components/foundry-ui';
import { OpenMetadataReference } from '@/components/openmetadata-reference';
import { knowledgeSourceLabel } from '@/lib/knowledge-source';

type DocFields = { title: string; content: string; source: string; tags: string };
const emptyDoc: DocFields = { title: '', content: '', source: '', tags: '' };
const asFields = (doc: KnowledgeDocument): DocFields => ({ title: doc.title, content: doc.content, source: doc.source ?? '', tags: doc.tags.join(', ') });
const asPayload = (fields: DocFields) => ({ title: fields.title.trim(), content: fields.content.trim(), source: fields.source.trim(), tags: fields.tags.split(',').map((tag) => tag.trim()).filter(Boolean) });

export default function KnowledgePage() {
  const queryClient = useQueryClient();
  const allDocuments = useListKnowledge();
  const create = useCreateKnowledge();
  const update = useUpdateKnowledge();
  const remove = useDeleteKnowledge();
  const runQuery = useQueryKnowledge();
  const [editing, setEditing] = useState<KnowledgeDocument | null | 'new'>(null);
  const [fields, setFields] = useState<DocFields>(emptyDoc);
  const [query, setQuery] = useState('');
  const [visibleDocuments, setVisibleDocuments] = useState(24);
  const docs = { ...allDocuments, data: allDocuments.data?.slice(0, visibleDocuments) };
  const [feedback, setFeedback] = useState<{ text: string; error?: boolean } | null>(null);
  const answer = runQuery.data;
  const searchString = useSearch();
  const deepLinkId = Number(new URLSearchParams(searchString).get('document')) || null;
  const [reading, setReading] = useState<KnowledgeDocument | null>(null);
  const openedFor = useRef<number | null>(null);
  useEffect(() => {
    if (!deepLinkId || !allDocuments.data || openedFor.current === deepLinkId) return;
    openedFor.current = deepLinkId;
    const match = allDocuments.data.find((doc) => doc.id === deepLinkId);
    if (match) setReading(match); else setFeedback({ text: `Knowledge document #${deepLinkId} was not found.`, error: true });
  }, [deepLinkId, allDocuments.data]);
  const refresh = () => Promise.all([
    queryClient.invalidateQueries({ queryKey: getListKnowledgeQueryKey() }),
    queryClient.invalidateQueries({ queryKey: getGetOverviewQueryKey() }),
  ]);
  const openNew = () => { setFields(emptyDoc); setEditing('new'); setFeedback(null); };
  const openEdit = (doc: KnowledgeDocument) => { setFields(asFields(doc)); setEditing(doc); setFeedback(null); };
  const submitDoc = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFeedback(null);
    const payload = asPayload(fields);
    if (!payload.title || !payload.content) { setFeedback({ text: 'Title and content are required.', error: true }); return; }
    const onSuccess = () => { void refresh(); setEditing(null); setFeedback({ text: 'Knowledge document saved.' }); };
    const onError = () => setFeedback({ text: 'Could not save this document. Review the fields and try again.', error: true });
    if (editing === 'new') create.mutate({ data: payload }, { onSuccess, onError });
    else if (editing) update.mutate({ id: editing.id, data: payload }, { onSuccess, onError });
  };
  const deleteDoc = (doc: KnowledgeDocument) => {
    if (!window.confirm(`Delete “${doc.title}” from the shared knowledge base?`)) return;
    remove.mutate({ id: doc.id }, { onSuccess: () => { void refresh(); setFeedback({ text: 'Document removed from shared knowledge.' }); }, onError: () => setFeedback({ text: 'Could not delete the document.', error: true }) });
  };
  const submitQuery = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (query.trim().length < 2) { setFeedback({ text: 'Enter at least two characters to query knowledge.', error: true }); return; }
    setFeedback(null);
    runQuery.mutate({ data: { query: query.trim() } }, { onError: () => setFeedback({ text: 'Knowledge query failed. Try again in a moment.', error: true }) });
  };
  const set = (key: keyof DocFields, value: string) => setFields((current) => ({ ...current, [key]: value }));
  return (
    <>
      <PageHeading eyebrow="Shared second brain" title="Knowledge, with receipts." description="Keep durable team context in one place. Ask a question and inspect the exact sources behind the response." action={<AddButton onClick={openNew}>Add document</AddButton>} />
      {feedback && <Notice tone={feedback.error ? 'error' : 'success'}>{feedback.text}</Notice>}
      <OpenMetadataReference documents={allDocuments.data ?? []} onRead={setReading} onAsk={setQuery} />
      <div className="grid gap-5 xl:grid-cols-[0.92fr_1.08fr]">
        <Panel className="p-5 md:p-6">
          <SectionTitle meta={<span className="foundry-mono text-[10px] text-muted-foreground">{allDocuments.data?.length ?? '—'} DOCUMENTS</span>}>Knowledge library</SectionTitle>
          {allDocuments.data && allDocuments.data.length > visibleDocuments && <div className="mb-3 flex items-center justify-between gap-2 text-xs text-muted-foreground"><span>Showing {visibleDocuments} of {allDocuments.data.length} documents. Catalogue links open any reference directly.</span><Button kind="quiet" onClick={() => setVisibleDocuments((count) => count + 24)} testId="button-more-knowledge">Show more</Button></div>}
          {docs.isLoading ? <div className="space-y-3">{[1, 2, 3].map((i) => <div key={i} className="h-24 animate-pulse rounded-lg bg-muted" />)}</div> : docs.isError ? <ErrorState onRetry={() => { void docs.refetch(); }} /> : docs.data?.length ? <div className="space-y-2">{docs.data.map((doc) => <article key={doc.id} data-testid={`knowledge-document-${doc.id}`} className="rounded-xl border border-border bg-background/70 p-4"><div className="flex items-start justify-between gap-3"><div className="min-w-0"><h3 className="text-sm font-semibold leading-snug">{doc.title}</h3><p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{doc.content}</p></div><div className="flex shrink-0 gap-1"><button aria-label={`Edit ${doc.title}`} data-testid={`button-edit-document-${doc.id}`} onClick={() => openEdit(doc)} className="rounded-md p-2 text-muted-foreground hover:bg-muted hover:text-foreground"><Pencil size={14} /></button><button aria-label={`Delete ${doc.title}`} data-testid={`button-delete-document-${doc.id}`} onClick={() => deleteDoc(doc)} className="rounded-md p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive"><Trash2 size={14} /></button></div></div><div className="mt-3 flex flex-wrap items-center gap-1.5">{doc.source && <span className="mr-1 inline-flex items-center gap-1 text-[10px] text-muted-foreground"><BookOpen size={11} />{knowledgeSourceLabel(doc.source)}</span>}{doc.tags.map((tag) => <span key={tag} className="rounded-md bg-accent px-2 py-1 text-[9px] font-medium text-accent-foreground">{tag}</span>)}<span className="ml-auto inline-flex items-center gap-1 text-[9px] text-muted-foreground"><Clock3 size={10} />{new Date(doc.updatedAt).toLocaleDateString()}</span></div></article>)}</div> : <EmptyState icon={BookOpen} title="The shared brain is ready for its first note." detail="Add a document with its source and tags so answers can be grounded in team context." action={<AddButton onClick={openNew}>Add first document</AddButton>} />}
        </Panel>
        <div className="space-y-5">
          <Panel className="overflow-hidden">
            <div className="border-b border-border bg-[#26343a] px-5 py-4 text-[#f0f0e8] md:px-6"><div className="foundry-mono mb-1 text-[9px] uppercase tracking-[0.17em] text-[#90cdb0]">Cited retrieval</div><h2 className="foundry-display text-xl font-semibold">Ask the workspace</h2><p className="mt-1 text-[11px] text-[#c1cbc5]">Retrieval, answer, and evidence in one pass.</p></div>
            <form onSubmit={submitQuery} className="p-5 md:p-6"><Field label="Question"><div className="flex gap-2"><input value={query} onChange={(event) => setQuery(event.target.value)} className={inputClass} placeholder="What do we know about…" data-testid="input-knowledge-query" /><Button type="submit" disabled={runQuery.isPending} testId="button-run-query"><Search size={14} />{runQuery.isPending ? 'Asking' : 'Ask'}</Button></div></Field>{runQuery.isPending && <div className="mt-5 space-y-2"><div className="h-3 w-3/4 animate-pulse rounded bg-muted" /><div className="h-3 w-full animate-pulse rounded bg-muted" /><div className="h-3 w-2/3 animate-pulse rounded bg-muted" /></div>}</form>
          </Panel>
          {answer && <Panel className="p-5 md:p-6" data-testid="knowledge-answer"><div className="mb-4 flex flex-wrap items-center justify-between gap-2"><SectionTitle>Answer</SectionTitle><div className="flex gap-1.5"><span className={`rounded-full px-2.5 py-1 text-[9px] font-semibold ${answer.cached ? 'bg-primary/10 text-primary' : 'bg-muted text-muted-foreground'}`}>{answer.cached ? 'Cache hit' : 'Fresh retrieval'}</span><span className={`rounded-full px-2.5 py-1 text-[9px] font-semibold ${answer.reranked ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'}`}>{answer.reranked ? 'Reranked' : 'Not reranked'}</span></div></div><p className="whitespace-pre-wrap text-sm leading-7 text-foreground">{answer.answer}</p><div className="mt-5 border-t border-border pt-4"><div className="mb-3 flex items-center gap-2 text-xs font-semibold"><Check size={14} className="text-primary" />Sources returned by the server <span className="foundry-mono ml-auto text-[9px] text-muted-foreground">{answer.sources.length} CITED</span></div>{answer.sources.length ? <div className="space-y-2">{answer.sources.map((source) => <div key={source.id} className="rounded-lg border border-border bg-background/60 p-3" data-testid={`knowledge-source-${source.id}`}><div className="flex items-center justify-between gap-3"><span className="text-xs font-semibold">{source.title}</span><span className="foundry-mono text-[9px] text-primary">score {source.score.toFixed(3)}</span></div><p className="mt-1.5 text-[11px] leading-relaxed text-muted-foreground">{source.excerpt}</p></div>)}</div> : <p className="text-xs text-muted-foreground">No source records were returned.</p>}</div></Panel>}
        </div>
      </div>
      {reading && <Modal title={reading.title} onClose={() => setReading(null)}><div data-testid={`knowledge-reader-${reading.id}`}><div className="mb-4 flex flex-wrap items-center gap-1.5">{reading.source && <span className="mr-1 inline-flex items-center gap-1 text-[10px] text-muted-foreground"><BookOpen size={11} />{knowledgeSourceLabel(reading.source)}</span>}{reading.tags.map((tag) => <span key={tag} className="rounded-md bg-accent px-2 py-1 text-[9px] font-medium text-accent-foreground">{tag}</span>)}</div><p className="whitespace-pre-wrap text-sm leading-7">{reading.content}</p><div className="mt-5 flex justify-end border-t border-border pt-4"><Button kind="secondary" onClick={() => setReading(null)}>Close</Button></div></div></Modal>}
      {editing && <Modal title={editing === 'new' ? 'Add knowledge document' : 'Edit document'} onClose={() => setEditing(null)}><form onSubmit={submitDoc} className="space-y-4"><Field label="Title"><input required value={fields.title} onChange={(event) => set('title', event.target.value)} className={inputClass} data-testid="input-document-title" /></Field><Field label="Content"><textarea required value={fields.content} onChange={(event) => set('content', event.target.value)} className={textareaClass} data-testid="input-document-content" /></Field><div className="grid gap-4 sm:grid-cols-2"><Field label="Source"><input value={fields.source} onChange={(event) => set('source', event.target.value)} className={inputClass} placeholder="Optional origin" data-testid="input-document-source" /></Field><Field label="Tags" hint="Separate tags with commas."><input value={fields.tags} onChange={(event) => set('tags', event.target.value)} className={inputClass} placeholder="product, policy" data-testid="input-document-tags" /></Field></div><div className="flex justify-end gap-2 border-t border-border pt-4"><Button kind="secondary" onClick={() => setEditing(null)}>Cancel</Button><Button type="submit" disabled={create.isPending || update.isPending} testId="button-save-document">{create.isPending || update.isPending ? 'Saving…' : 'Save document'}</Button></div></form></Modal>}
    </>
  );
}
