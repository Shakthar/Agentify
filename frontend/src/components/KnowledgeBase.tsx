/**
 * KnowledgeBase — Componente de gestão da base de conhecimento de um agente.
 *
 * Permite:
 *  - Upload de ficheiros (PDF, DOCX, CSV, TXT, MD)
 *  - Adicionar URL (YouTube / website)
 *  - Colar texto livre
 *  - Ver lista de documentos com estado e progresso
 *  - Reingerir ou apagar documentos
 *  - Ver o progresso de armazenamento por plano
 */

import { useEffect, useRef, useState, useCallback } from 'react';
import api from '../utils/api';

// ── Tipos ──────────────────────────────────────────────────────────────────

interface KBDocument {
  id: string;
  type: 'pdf' | 'docx' | 'csv' | 'text' | 'youtube' | 'website';
  fileName?: string;
  sourceUrl?: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  error?: string;
  chunkCount: number;
  contentBytes: number;
  createdAt: string;
}

interface KBListResponse {
  documents: KBDocument[];
  total: number;
  storageUsedBytes: number;
  storageLimitBytes: number;
  plan: string;
}

interface Props {
  agentId: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────

function fmtBytes(b: number): string {
  if (b >= 1_073_741_824) return `${(b / 1_073_741_824).toFixed(1)} GB`;
  if (b >= 1_048_576) return `${(b / 1_048_576).toFixed(1)} MB`;
  if (b >= 1024) return `${(b / 1024).toFixed(0)} KB`;
  return `${b} B`;
}

function typeIcon(t: KBDocument['type']) {
  const map: Record<string, string> = {
    pdf: 'PDF', docx: 'Word', csv: 'CSV', text: 'Texto',
    youtube: 'YouTube', website: 'Site',
  };
  return map[t] ?? 'Ficheiro';
}

const PILL = 'inline-flex items-center whitespace-nowrap rounded-full px-2.5 py-0.5 text-xs font-medium';

function statusBadge(doc: KBDocument) {
  switch (doc.status) {
    case 'completed':
      return <span className={`${PILL} bg-app-pos-soft text-app-pos`}>Pronto</span>;
    case 'processing':
      return <span className={`${PILL} bg-app-accent-soft text-app-accent`}>A processar</span>;
    case 'pending':
      return <span className={`${PILL} bg-app-raised text-app-muted`}>Na fila</span>;
    case 'failed':
      return <span className={`${PILL} bg-app-neg-soft text-app-neg`} title={doc.error ?? ''}>Falhou</span>;
  }
}

function Msg({ m }: { m: string | null }) {
  if (!m) return null;
  const ok = m.startsWith('✓');
  return <p role="status" className={`rounded-lg px-3 py-2 text-sm ${ok ? 'bg-app-pos-soft text-app-pos' : 'bg-app-neg-soft text-app-neg'}`}>{m.replace(/^✓\s*/, '')}</p>;
}

// ── Componente ─────────────────────────────────────────────────────────────

export default function KnowledgeBase({ agentId }: Props) {
  const [docs, setDocs] = useState<KBDocument[]>([]);
  const [storageUsed, setStorageUsed] = useState(0);
  const [storageLimit, setStorageLimit] = useState(10 * 1024 * 1024);
  const [plan, setPlan] = useState('free');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Tabs de adição
  type AddMode = 'file' | 'url' | 'text' | 'enrich';
  const [addMode, setAddMode] = useState<AddMode>('file');

  // Enriquecer com IA — a IA lê o system prompt + a KB atual e gera perguntas de esclarecimento
  const [enrichQuestions, setEnrichQuestions] = useState<string[] | null>(null);
  const [enrichAnswers, setEnrichAnswers] = useState<Record<number, string>>({});
  const [enrichLoading, setEnrichLoading] = useState(false);
  const [enrichSubmitting, setEnrichSubmitting] = useState(false);
  const [enrichMsg, setEnrichMsg] = useState<string | null>(null);

  // File upload
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);

  // URL
  const [urlType, setUrlType] = useState<'youtube' | 'website'>('website');
  const [urlVal, setUrlVal] = useState('');
  const [addingUrl, setAddingUrl] = useState(false);
  const [urlMsg, setUrlMsg] = useState<string | null>(null);

  // Texto
  const [textTitle, setTextTitle] = useState('');
  const [textContent, setTextContent] = useState('');
  const [addingText, setAddingText] = useState(false);
  const [textMsg, setTextMsg] = useState<string | null>(null);

  // ── Fetch ───────────────────────────────────────────────────────────────

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get<KBListResponse>(`/api/agents/${agentId}/knowledge`);
      setDocs(data.documents);
      setStorageUsed(data.storageUsedBytes);
      setStorageLimit(data.storageLimitBytes);
      setPlan(data.plan);
      setError(null);
    } catch {
      setError('Erro ao carregar a base de conhecimento');
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  // Carga inicial
  useEffect(() => {
    void refresh();
  }, [agentId]);

  // Polling separado — só arranca quando há documentos pendentes
  useEffect(() => {
    const hasPending = docs.some((d) => d.status === 'pending' || d.status === 'processing');
    if (!hasPending) return;
    const interval = setInterval(() => { void refresh(); }, 5000);
    return () => clearInterval(interval);
  }, [docs, refresh]);

  // ── Upload de ficheiro ──────────────────────────────────────────────────

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadMsg(null);
    const form = new FormData();
    form.append('file', file);
    try {
      await api.post(`/api/agents/${agentId}/knowledge/upload`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setUploadMsg('✓ Ficheiro adicionado e a ser processado');
      if (fileInputRef.current) fileInputRef.current.value = '';
      await refresh();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setUploadMsg(`Erro: ${msg ?? 'falha no upload'}`);
    } finally {
      setUploading(false);
    }
  };

  // ── Adicionar URL ───────────────────────────────────────────────────────

  const handleAddUrl = async () => {
    if (!urlVal.trim()) return;
    setAddingUrl(true);
    setUrlMsg(null);
    try {
      await api.post(`/api/agents/${agentId}/knowledge/url`, { type: urlType, url: urlVal.trim() });
      setUrlMsg('✓ URL adicionado e a ser processado');
      setUrlVal('');
      await refresh();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setUrlMsg(`Erro: ${msg ?? 'URL inválido ou inacessível'}`);
    } finally {
      setAddingUrl(false);
    }
  };

  // ── Adicionar texto ─────────────────────────────────────────────────────

  const handleAddText = async () => {
    if (!textContent.trim()) return;
    setAddingText(true);
    setTextMsg(null);
    try {
      await api.post(`/api/agents/${agentId}/knowledge/text`, { title: textTitle || undefined, text: textContent });
      setTextMsg('✓ Texto adicionado e a ser processado');
      setTextTitle('');
      setTextContent('');
      await refresh();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setTextMsg(`Erro: ${msg ?? 'falha ao adicionar texto'}`);
    } finally {
      setAddingText(false);
    }
  };

  // ── Enriquecer com IA ───────────────────────────────────────────────────

  const handleGenerateEnrichQuestions = async () => {
    setEnrichLoading(true);
    setEnrichMsg(null);
    try {
      const { data } = await api.post<{ questions: string[] }>(`/api/agents/${agentId}/knowledge/enrich/questions`);
      setEnrichQuestions(data.questions);
      setEnrichAnswers({});
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setEnrichMsg(`Erro: ${msg ?? 'falha ao gerar perguntas'}`);
    } finally {
      setEnrichLoading(false);
    }
  };

  const handleSubmitEnrichAnswers = async () => {
    if (!enrichQuestions) return;
    const answers = enrichQuestions
      .map((question, i) => ({ question, answer: (enrichAnswers[i] ?? '').trim() }))
      .filter((a) => a.answer.length > 0);
    if (answers.length === 0) {
      setEnrichMsg('Responde a pelo menos uma pergunta antes de guardar.');
      return;
    }
    setEnrichSubmitting(true);
    setEnrichMsg(null);
    try {
      await api.post(`/api/agents/${agentId}/knowledge/enrich/answers`, { answers });
      setEnrichMsg('✓ Respostas adicionadas à base de conhecimento');
      setEnrichQuestions(null);
      setEnrichAnswers({});
      await refresh();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setEnrichMsg(`Erro: ${msg ?? 'falha ao guardar respostas'}`);
    } finally {
      setEnrichSubmitting(false);
    }
  };

  // ── Ações sobre documentos ──────────────────────────────────────────────

  const handleDelete = async (docId: string) => {
    if (!confirm('Apagar este documento da base de conhecimento?')) return;
    try {
      await api.delete(`/api/agents/${agentId}/knowledge/${docId}`);
      await refresh();
    } catch {
      alert('Erro ao apagar o documento');
    }
  };

  const handleReingest = async (docId: string) => {
    try {
      await api.post(`/api/agents/${agentId}/knowledge/${docId}/reingest`);
      await refresh();
    } catch {
      alert('Erro ao reiniciar a ingestão');
    }
  };

  // ── Render ──────────────────────────────────────────────────────────────

  const storagePercent = storageLimit > 0 ? Math.min(100, Math.round((storageUsed / storageLimit) * 100)) : 0;
  const storageColor = storagePercent >= 90 ? 'bg-app-neg' : storagePercent >= 70 ? 'bg-app-warn' : 'bg-app-accent';

  if (loading) {
    return (
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,1fr)_420px]" aria-busy="true" aria-label="A carregar a base de conhecimento">
        <div className="space-y-3">
          <span className="block h-6 w-1/3 rounded bg-app-raised" />
          <span className="block h-14 w-full rounded-xl bg-app-raised" />
          <span className="block h-14 w-full rounded-xl bg-app-raised" />
        </div>
        <span className="block h-64 w-full rounded-xl bg-app-raised" />
      </div>
    );
  }

  const MODES: { id: AddMode; label: string }[] = [
    { id: 'file', label: 'Ficheiro' },
    { id: 'url', label: 'Link' },
    { id: 'text', label: 'Texto' },
    { id: 'enrich', label: 'Perguntas da IA' },
  ];
  const ready = docs.filter((d) => d.status === 'completed').length;

  return (
    <div className="grid grid-cols-1 items-start gap-6 lg:grid-cols-[minmax(0,1fr)_420px] lg:gap-8">
      {/* O que o agente sabe */}
      <section className="min-w-0">
        <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h2 className="text-base font-semibold text-app-ink">O que o agente sabe</h2>
            <p className="mt-1 text-sm text-app-muted">Ementa, preços, horários, alergénios, políticas da casa. O agente consulta isto antes de responder.</p>
          </div>
          <button type="button" onClick={() => void refresh()} className="text-sm font-semibold text-app-accent hover:underline">Atualizar</button>
        </div>

        {/* Armazenamento */}
        <div className="mb-4 rounded-xl border border-app-edge px-4 py-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2 text-sm">
            <span className="text-app-muted"><span className="num font-semibold text-app-ink">{ready}</span> de <span className="num">{docs.length}</span> fontes prontas</span>
            <span className="num text-app-muted">{fmtBytes(storageUsed)} de {fmtBytes(storageLimit)} <span className="capitalize text-app-faint">· plano {plan}</span></span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-app-raised" role="meter" aria-valuemin={0} aria-valuemax={100} aria-valuenow={storagePercent} aria-label="Armazenamento usado">
            <div className={`h-full rounded-full ${storageColor}`} style={{ width: `${storagePercent}%` }} />
          </div>
          {storagePercent >= 90 && (
            <p className="mt-2 text-sm font-medium text-app-neg">O espaço está quase cheio. Apague fontes antigas ou mude de plano.</p>
          )}
        </div>

        <div className="overflow-hidden rounded-xl border border-app-edge bg-app-sheet">
          {error && (
            <div className="m-4 flex flex-wrap items-center gap-3 rounded-lg bg-app-neg-soft px-4 py-3 text-sm text-app-neg">
              <span>Não foi possível carregar a base de conhecimento.</span>
              <button type="button" onClick={() => void refresh()} className="font-semibold underline underline-offset-2">Tentar de novo</button>
            </div>
          )}

          {docs.length === 0 && !error && (
            <div className="px-5 py-8">
              <p className="text-sm font-semibold text-app-ink">O agente ainda não sabe nada sobre o negócio.</p>
              <p className="mt-1 text-sm text-app-muted">Comece pela ementa em PDF ou pelo link do site. Leva um minuto a processar.</p>
            </div>
          )}

          <ul>
            {docs.map((doc, i) => (
              <li key={doc.id} className={`flex items-start gap-4 px-5 py-4 ${i > 0 ? 'border-t border-app-rule' : ''}`}>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-app-ink">{doc.fileName ?? doc.sourceUrl ?? 'Sem título'}</p>
                  <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-app-muted">
                    <span>{typeIcon(doc.type)}</span>
                    {doc.contentBytes > 0 && <span className="num">{fmtBytes(doc.contentBytes)}</span>}
                    {doc.status === 'completed' && <span className="num">{doc.chunkCount} excertos</span>}
                    <span className="num text-app-faint">{new Date(doc.createdAt).toLocaleDateString('pt-PT')}</span>
                  </div>
                  {doc.status === 'failed' && doc.error && (
                    <p className="mt-1 text-sm text-app-neg">{doc.error}</p>
                  )}
                </div>
                <div className="flex shrink-0 flex-col items-end gap-2 sm:flex-row sm:items-center">
                  {statusBadge(doc)}
                  <div className="flex gap-1">
                    {(doc.status === 'failed' || doc.status === 'completed') && (
                      <button type="button" onClick={() => void handleReingest(doc.id)} className="btn-ghost h-8 px-2 text-xs">
                        {doc.status === 'failed' ? 'Tentar de novo' : 'Reprocessar'}
                      </button>
                    )}
                    <button type="button" onClick={() => void handleDelete(doc.id)} className="btn-ghost h-8 px-2 text-xs hover:text-app-neg">Apagar</button>
                  </div>
                </div>
              </li>
            ))}
          </ul>
        </div>
      </section>

      {/* Ensinar o agente */}
      <section className="rounded-xl border border-app-edge bg-app-sheet lg:sticky lg:top-4">
        <div className="px-5 pt-4">
          <h2 className="text-base font-semibold text-app-ink">Acrescentar conhecimento</h2>
        </div>
        <div role="tablist" aria-label="Forma de acrescentar" className="mt-3 flex gap-4 overflow-x-auto border-b border-app-rule px-5">
          {MODES.map((m) => (
            <button
              key={m.id}
              type="button"
              role="tab"
              aria-selected={addMode === m.id}
              onClick={() => setAddMode(m.id)}
              className={`-mb-px shrink-0 border-b-2 pb-2.5 text-sm font-medium transition-colors ${addMode === m.id ? 'border-app-ink text-app-ink' : 'border-transparent text-app-muted hover:text-app-ink'}`}
            >
              {m.label}
            </button>
          ))}
        </div>

        <div className="space-y-4 p-5">
          {addMode === 'file' && (
            <>
              <p className="text-sm text-app-muted">PDF, Word, CSV, TXT ou Markdown, até 10 MB. Começa a processar assim que escolher o ficheiro.</p>
              <input
                ref={fileInputRef}
                type="file"
                aria-label="Ficheiro"
                accept=".pdf,.docx,.csv,.txt,.md"
                onChange={handleFileUpload}
                disabled={uploading}
                className="block w-full cursor-pointer text-sm text-app-muted file:mr-3 file:h-9 file:rounded-lg file:border file:border-solid file:border-app-control file:bg-app-sheet file:px-4 file:text-sm file:font-semibold file:text-app-ink hover:file:bg-app-raised disabled:opacity-50"
              />
              {uploading && <p className="text-sm text-app-muted">A enviar…</p>}
              <Msg m={uploadMsg} />
            </>
          )}

          {addMode === 'url' && (
            <>
              <p className="text-sm text-app-muted">O agente lê a página do site ou a transcrição do vídeo.</p>
              <div className="flex flex-col gap-2 sm:flex-row">
                <select
                  aria-label="Tipo de link"
                  value={urlType}
                  onChange={(e) => setUrlType(e.target.value as 'youtube' | 'website')}
                  className="input h-auto py-2 sm:w-36"
                >
                  <option value="website">Site</option>
                  <option value="youtube">YouTube</option>
                </select>
                <input
                  type="url"
                  aria-label="Endereço"
                  value={urlVal}
                  onChange={(e) => setUrlVal(e.target.value)}
                  placeholder={urlType === 'youtube' ? 'https://youtube.com/watch?v=…' : 'https://restaurante.pt/ementa'}
                  className="input flex-1"
                  disabled={addingUrl}
                />
              </div>
              <button type="button" onClick={handleAddUrl} disabled={addingUrl || !urlVal.trim()} className="btn-secondary">
                {addingUrl ? 'A adicionar…' : 'Adicionar link'}
              </button>
              <Msg m={urlMsg} />
            </>
          )}

          {addMode === 'text' && (
            <>
              <input
                type="text"
                aria-label="Título"
                value={textTitle}
                onChange={(e) => setTextTitle(e.target.value)}
                placeholder="Título (opcional), ex.: Política de reservas"
                className="input"
                disabled={addingText}
              />
              <textarea
                aria-label="Texto"
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder="Cole aqui o que o agente deve saber: pratos do dia, alergénios, regras de cancelamento…"
                rows={10}
                className="input resize-y leading-relaxed"
                disabled={addingText}
              />
              <div className="flex items-center justify-between gap-3">
                <span className="num text-xs text-app-faint">{textContent.length.toLocaleString('pt-PT')} / 1 000 000 caracteres</span>
                <button type="button" onClick={handleAddText} disabled={addingText || !textContent.trim()} className="btn-secondary">
                  {addingText ? 'A adicionar…' : 'Adicionar texto'}
                </button>
              </div>
              <Msg m={textMsg} />
            </>
          )}

          {addMode === 'enrich' && (
            <>
              {!enrichQuestions && (
                <>
                  <p className="text-sm text-app-muted">
                    A IA lê as instruções do agente e o que já está aqui, e faz-lhe as perguntas que os clientes provavelmente vão fazer e
                    ainda não têm resposta.
                  </p>
                  <button type="button" onClick={handleGenerateEnrichQuestions} disabled={enrichLoading} className="btn-secondary">
                    {enrichLoading ? 'A preparar perguntas…' : 'Gerar perguntas'}
                  </button>
                </>
              )}

              {enrichQuestions && (
                <div className="space-y-4">
                  {enrichQuestions.map((q, i) => (
                    <div key={i}>
                      <label htmlFor={`enrich${i}`} className="mb-1 block text-sm font-medium text-app-ink"><span className="num text-app-faint">{i + 1}.</span> {q}</label>
                      <textarea
                        id={`enrich${i}`}
                        value={enrichAnswers[i] ?? ''}
                        onChange={(e) => setEnrichAnswers((prev) => ({ ...prev, [i]: e.target.value }))}
                        placeholder="A sua resposta"
                        rows={2}
                        className="input resize-y"
                      />
                    </div>
                  ))}
                  <div className="flex flex-wrap gap-2">
                    <button type="button" onClick={handleSubmitEnrichAnswers} disabled={enrichSubmitting} className="btn-secondary">
                      {enrichSubmitting ? 'A guardar…' : 'Guardar respostas'}
                    </button>
                    <button type="button" onClick={() => { setEnrichQuestions(null); setEnrichAnswers({}); setEnrichMsg(null); }} className="btn-ghost">
                      Cancelar
                    </button>
                  </div>
                </div>
              )}

              <Msg m={enrichMsg} />
            </>
          )}
        </div>
      </section>
    </div>
  );
}
