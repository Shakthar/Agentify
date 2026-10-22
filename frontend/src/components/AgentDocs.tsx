import { useState, useEffect, useRef, useCallback } from 'react';
import api from '../utils/api';

interface AgentDoc {
  id: string;
  name: string;
  description?: string;
  fileName: string;
  mimeType: string;
  fileSize: number;
  fileUrl: string;
  createdAt: string;
}

interface Props { agentId: string }

function fmtBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1024 / 1024).toFixed(1)} MB`;
}

function mimeIcon(mime: string) {
  if (mime === 'application/pdf') return 'PDF';
  if (mime.startsWith('image/')) return 'Imagem';
  if (mime.includes('word')) return 'Word';
  if (mime.includes('excel') || mime.includes('spreadsheet')) return 'Excel';
  return 'Ficheiro';
}

export default function AgentDocs({ agentId }: Props) {
  const [docs, setDocs] = useState<AgentDoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadMsg, setUploadMsg] = useState<string | null>(null);
  const [docName, setDocName] = useState('');
  const [docDesc, setDocDesc] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const refresh = useCallback(async () => {
    try {
      const { data } = await api.get(`/api/agents/${agentId}/docs`);
      setDocs(data.docs);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [agentId]);

  useEffect(() => { void refresh(); }, [agentId]);

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setUploadMsg(null);
    const form = new FormData();
    form.append('file', file);
    form.append('name', docName.trim() || file.name);
    if (docDesc.trim()) form.append('description', docDesc.trim());
    try {
      await api.post(`/api/agents/${agentId}/docs`, form, { headers: { 'Content-Type': 'multipart/form-data' } });
      setUploadMsg('✓ Documento carregado com sucesso');
      setDocName('');
      setDocDesc('');
      if (fileInputRef.current) fileInputRef.current.value = '';
      void refresh();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Erro ao carregar';
      setUploadMsg(`✗ ${msg}`);
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (docId: string, name: string) => {
    if (!confirm(`Apagar "${name}"?`)) return;
    try {
      await api.delete(`/api/agents/${agentId}/docs/${docId}`);
      setDocs((prev) => prev.filter((d) => d.id !== docId));
    } catch {
      alert('Erro ao apagar documento');
    }
  };

  if (loading) {
    return (
      <div className="space-y-3" aria-busy="true" aria-label="A carregar documentos">
        <span className="block h-5 w-1/3 rounded bg-app-raised" />
        <span className="block h-16 w-full rounded-xl bg-app-raised" />
        <span className="block h-16 w-full rounded-xl bg-app-raised" />
      </div>
    );
  }

  const ok = uploadMsg?.startsWith('✓');

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] lg:gap-10">
      {/* Upload */}
      <div className="space-y-4">
        <div>
          <h2 className="text-base font-semibold text-app-ink">Documentos para enviar</h2>
          <p className="mt-1 text-sm text-app-muted">
            Ficheiros que o agente envia quando o cliente pede: a ementa, o menu de grupos, a tabela de preços. Pelo WhatsApp vai o
            ficheiro; no chat do site, o link.
          </p>
        </div>
        <div className="space-y-3 rounded-xl border border-app-edge p-4">
          <div>
            <label htmlFor="docName" className="mb-1 block text-sm font-medium text-app-ink">Nome</label>
            <input id="docName" type="text" value={docName} onChange={(e) => setDocName(e.target.value)} placeholder="Ex.: Ementa de outono" className="input" />
            <p className="mt-1 text-xs text-app-faint">Opcional. Em branco, usa o nome do ficheiro.</p>
          </div>
          <div>
            <label htmlFor="docDesc" className="mb-1 block text-sm font-medium text-app-ink">Quando enviar</label>
            <input id="docDesc" type="text" value={docDesc} onChange={(e) => setDocDesc(e.target.value)} placeholder="Ex.: quando pedem a ementa ou os preços" className="input" />
            <p className="mt-1 text-xs text-app-faint">Opcional. Ajuda o agente a escolher o ficheiro certo.</p>
          </div>
          <div>
            <label htmlFor="docFile" className="mb-1 block text-sm font-medium text-app-ink">Ficheiro</label>
            <input
              id="docFile"
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.doc,.png,.jpg,.jpeg,.webp,.txt,.xlsx,.xls"
              onChange={handleUpload}
              disabled={uploading}
              className="block w-full cursor-pointer text-sm text-app-muted file:mr-3 file:h-9 file:rounded-lg file:border file:border-solid file:border-app-control file:bg-app-sheet file:px-4 file:text-sm file:font-semibold file:text-app-ink hover:file:bg-app-raised disabled:opacity-50"
            />
            <p className="mt-1 text-xs text-app-faint">PDF, Word, imagens, TXT ou Excel, até 20 MB. Carrega assim que escolher.</p>
          </div>
          {uploading && <p className="text-sm text-app-muted">A carregar…</p>}
          {uploadMsg && (
            <p role="status" className={`rounded-lg px-3 py-2 text-sm ${ok ? 'bg-app-pos-soft text-app-pos' : 'bg-app-neg-soft text-app-neg'}`}>{uploadMsg.replace(/^[✓✗]\s*/, '')}</p>
          )}
        </div>
      </div>

      {/* Lista */}
      <section className="self-start overflow-hidden rounded-xl border border-app-edge bg-app-sheet">
        <div className="flex items-center justify-between px-5 py-3">
          <span className="text-sm font-semibold text-app-ink">
            <span className="num">{docs.length}</span> documento{docs.length !== 1 ? 's' : ''} disponíve{docs.length !== 1 ? 'is' : 'l'}
          </span>
          <button type="button" onClick={() => void refresh()} className="text-sm font-semibold text-app-accent hover:underline">Atualizar</button>
        </div>

        {docs.length === 0 ? (
          <p className="border-t border-app-rule px-5 py-6 text-sm text-app-muted">
            Ainda não há documentos. Carregue a ementa em PDF: é o que os clientes pedem mais vezes.
          </p>
        ) : (
          <ul>
            {docs.map((doc) => (
              <li key={doc.id} className="flex items-center gap-4 border-t border-app-rule px-5 py-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold text-app-ink">{doc.name}</p>
                  {doc.description && <p className="truncate text-sm text-app-muted">{doc.description}</p>}
                  <p className="mt-0.5 truncate text-xs text-app-faint">{mimeIcon(doc.mimeType)} · {doc.fileName} · <span className="num">{fmtBytes(doc.fileSize)}</span></p>
                </div>
                <div className="flex shrink-0 items-center gap-1">
                  <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer" className="btn-ghost h-8 px-2">Abrir ↗</a>
                  <button type="button" onClick={() => void handleDelete(doc.id, doc.name)} className="btn-ghost h-8 px-2 hover:text-app-neg">Apagar</button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
