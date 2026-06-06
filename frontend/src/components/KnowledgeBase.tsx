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
    pdf: '📄', docx: '📝', csv: '📊', text: '📃',
    youtube: '▶️', website: '🌐',
  };
  return map[t] ?? '📎';
}

function statusBadge(doc: KBDocument) {
  switch (doc.status) {
    case 'completed':
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">✓ Indexado ({doc.chunkCount} chunks)</span>;
    case 'processing':
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-blue-100 text-blue-700 animate-pulse">⟳ A processar…</span>;
    case 'pending':
      return <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-yellow-100 text-yellow-700">⏳ Na fila</span>;
    case 'failed':
      return (
        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700" title={doc.error ?? ''}>
          ✕ Falhou
        </span>
      );
  }
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
  type AddMode = 'file' | 'url' | 'text';
  const [addMode, setAddMode] = useState<AddMode>('file');

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

  useEffect(() => {
    void refresh();
    // Polling automático enquanto há documentos a processar
    const interval = setInterval(() => {
      if (docs.some((d) => d.status === 'pending' || d.status === 'processing')) {
        void refresh();
      }
    }, 4000);
    return () => clearInterval(interval);
  }, [refresh, docs]);

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
  const storageColor = storagePercent >= 90 ? 'bg-red-500' : storagePercent >= 70 ? 'bg-yellow-400' : 'bg-blue-500';

  if (loading) {
    return <div className="p-6 text-sm text-gray-500 animate-pulse">A carregar base de conhecimento…</div>;
  }

  return (
    <div className="space-y-6">
      {/* Barra de armazenamento */}
      <div className="bg-white border border-gray-200 rounded-xl p-4">
        <div className="flex justify-between items-baseline mb-2">
          <span className="text-sm font-medium text-gray-700">Armazenamento da KB</span>
          <span className="text-xs text-gray-500 capitalize">{plan}</span>
        </div>
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <div className={`h-2 rounded-full transition-all ${storageColor}`} style={{ width: `${storagePercent}%` }} />
        </div>
        <p className="mt-1.5 text-xs text-gray-500 text-right">
          {fmtBytes(storageUsed)} / {fmtBytes(storageLimit)} usados
        </p>
        {storagePercent >= 90 && (
          <p className="mt-1 text-xs text-red-600 font-medium">Armazenamento quase esgotado. Faça upgrade do plano.</p>
        )}
      </div>

      {/* Painel de adição */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {/* Tabs */}
        <div className="flex border-b border-gray-100">
          {(['file', 'url', 'text'] as AddMode[]).map((m) => {
            const labels: Record<AddMode, string> = { file: '📎 Ficheiro', url: '🔗 URL', text: '✏️ Texto' };
            return (
              <button
                key={m}
                onClick={() => setAddMode(m)}
                className={`flex-1 py-2.5 text-sm font-medium transition-colors ${
                  addMode === m
                    ? 'bg-blue-50 text-blue-700 border-b-2 border-blue-600'
                    : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                }`}
              >
                {labels[m]}
              </button>
            );
          })}
        </div>

        <div className="p-4 space-y-3">
          {/* Upload de ficheiro */}
          {addMode === 'file' && (
            <div>
              <p className="text-xs text-gray-500 mb-2">Formatos suportados: PDF, DOCX, CSV, TXT, MD · Máximo 10 MB</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".pdf,.docx,.csv,.txt,.md"
                onChange={handleFileUpload}
                disabled={uploading}
                className="block w-full text-sm text-gray-700 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer disabled:opacity-50"
              />
              {uploading && <p className="text-xs text-blue-600 mt-1 animate-pulse">A enviar…</p>}
              {uploadMsg && (
                <p className={`text-xs mt-1 ${uploadMsg.startsWith('✓') ? 'text-green-600' : 'text-red-600'}`}>{uploadMsg}</p>
              )}
            </div>
          )}

          {/* URL */}
          {addMode === 'url' && (
            <div className="space-y-2">
              <div className="flex gap-2">
                <select
                  value={urlType}
                  onChange={(e) => setUrlType(e.target.value as 'youtube' | 'website')}
                  className="border border-gray-200 rounded-lg text-sm px-2 py-2 text-gray-700 bg-white"
                >
                  <option value="website">Website</option>
                  <option value="youtube">YouTube</option>
                </select>
                <input
                  type="url"
                  value={urlVal}
                  onChange={(e) => setUrlVal(e.target.value)}
                  placeholder={urlType === 'youtube' ? 'https://youtube.com/watch?v=...' : 'https://exemplo.com/artigo'}
                  className="flex-1 border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                  disabled={addingUrl}
                />
                <button
                  onClick={handleAddUrl}
                  disabled={addingUrl || !urlVal.trim()}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {addingUrl ? '…' : 'Adicionar'}
                </button>
              </div>
              {urlMsg && (
                <p className={`text-xs ${urlMsg.startsWith('✓') ? 'text-green-600' : 'text-red-600'}`}>{urlMsg}</p>
              )}
            </div>
          )}

          {/* Texto */}
          {addMode === 'text' && (
            <div className="space-y-2">
              <input
                type="text"
                value={textTitle}
                onChange={(e) => setTextTitle(e.target.value)}
                placeholder="Título (opcional)"
                className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400"
                disabled={addingText}
              />
              <textarea
                value={textContent}
                onChange={(e) => setTextContent(e.target.value)}
                placeholder="Cole aqui o texto que o agente deve aprender…"
                rows={5}
                className="w-full border border-gray-200 rounded-lg text-sm px-3 py-2 focus:outline-none focus:ring-2 focus:ring-blue-400 resize-y"
                disabled={addingText}
              />
              <div className="flex justify-between items-center">
                <span className="text-xs text-gray-400">{textContent.length.toLocaleString()} / 1 000 000 carateres</span>
                <button
                  onClick={handleAddText}
                  disabled={addingText || !textContent.trim()}
                  className="px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-medium hover:bg-blue-700 disabled:opacity-50 transition-colors"
                >
                  {addingText ? '…' : 'Adicionar'}
                </button>
              </div>
              {textMsg && (
                <p className={`text-xs ${textMsg.startsWith('✓') ? 'text-green-600' : 'text-red-600'}`}>{textMsg}</p>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Lista de documentos */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 flex justify-between items-center">
          <span className="text-sm font-medium text-gray-700">{docs.length} documento{docs.length !== 1 ? 's' : ''}</span>
          <button onClick={() => void refresh()} className="text-xs text-gray-400 hover:text-gray-700">↻ Atualizar</button>
        </div>

        {error && <p className="p-4 text-sm text-red-600">{error}</p>}

        {docs.length === 0 && !error && (
          <p className="p-6 text-sm text-gray-400 text-center">Nenhum documento ainda. Adicione um ficheiro, URL ou texto acima.</p>
        )}

        <ul className="divide-y divide-gray-50">
          {docs.map((doc) => (
            <li key={doc.id} className="px-4 py-3 flex items-start gap-3">
              <span className="text-lg mt-0.5 select-none">{typeIcon(doc.type)}</span>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-800 truncate">
                  {doc.fileName ?? doc.sourceUrl ?? 'Sem título'}
                </p>
                <div className="mt-0.5 flex flex-wrap gap-2 items-center">
                  {statusBadge(doc)}
                  {doc.contentBytes > 0 && (
                    <span className="text-xs text-gray-400">{fmtBytes(doc.contentBytes)}</span>
                  )}
                  {doc.status === 'failed' && doc.error && (
                    <span className="text-xs text-red-500 truncate max-w-xs" title={doc.error}>{doc.error}</span>
                  )}
                </div>
              </div>
              <div className="flex gap-1 shrink-0">
                {(doc.status === 'failed' || doc.status === 'completed') && (
                  <button
                    onClick={() => void handleReingest(doc.id)}
                    title="Reingerir"
                    className="p-1.5 rounded text-gray-400 hover:text-blue-600 hover:bg-blue-50 transition-colors text-sm"
                  >
                    ↺
                  </button>
                )}
                <button
                  onClick={() => void handleDelete(doc.id)}
                  title="Apagar"
                  className="p-1.5 rounded text-gray-400 hover:text-red-600 hover:bg-red-50 transition-colors text-sm"
                >
                  ✕
                </button>
              </div>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
