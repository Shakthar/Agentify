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
  if (mime === 'application/pdf') return '📄';
  if (mime.startsWith('image/')) return '🖼️';
  if (mime.includes('word')) return '📝';
  if (mime.includes('excel') || mime.includes('spreadsheet')) return '📊';
  return '📎';
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

  if (loading) return <div className="p-6 text-sm text-gray-500 dark:text-gray-400 animate-pulse">A carregar documentos…</div>;

  return (
    <div className="space-y-6">
      {/* Explicação */}
      <div className="card bg-blue-50 dark:bg-blue-900/20 border-blue-200 dark:border-blue-700">
        <p className="text-sm text-blue-800 dark:text-blue-300">
          <strong>Como funciona:</strong> os ficheiros aqui carregados ficam disponíveis para o agente enviar directamente aos clientes quando solicitado.
          O agente conhece os nomes e descrições — basta o cliente pedir (ex: <em>"podes enviar-me o menu?"</em>) e o agente envia o PDF automaticamente pelo WhatsApp ou disponibiliza o link no chat web.
        </p>
      </div>

      {/* Upload */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl p-4 space-y-3">
        <p className="text-sm font-medium text-gray-700 dark:text-gray-200">Adicionar documento</p>
        <input
          type="text"
          value={docName}
          onChange={(e) => setDocName(e.target.value)}
          placeholder="Nome do documento (opcional — usa o nome do ficheiro se em branco)"
          className="w-full border border-gray-200 dark:border-gray-600 rounded-lg text-sm px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <input
          type="text"
          value={docDesc}
          onChange={(e) => setDocDesc(e.target.value)}
          placeholder="Descrição breve (opcional — ajuda o agente a saber quando enviar)"
          className="w-full border border-gray-200 dark:border-gray-600 rounded-lg text-sm px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-400"
        />
        <input
          ref={fileInputRef}
          type="file"
          accept=".pdf,.docx,.doc,.png,.jpg,.jpeg,.webp,.txt,.xlsx,.xls"
          onChange={handleUpload}
          disabled={uploading}
          className="block w-full text-sm text-gray-700 dark:text-gray-300 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100 cursor-pointer disabled:opacity-50"
        />
        <p className="text-xs text-gray-400 dark:text-gray-500">PDF, DOCX, imagens, TXT, XLSX · Máx. 20 MB</p>
        {uploading && <p className="text-xs text-blue-600 animate-pulse">A carregar…</p>}
        {uploadMsg && (
          <p className={`text-xs ${uploadMsg.startsWith('✓') ? 'text-green-600' : 'text-red-600'}`}>{uploadMsg}</p>
        )}
      </div>

      {/* Lista */}
      <div className="bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-xl overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-100 dark:border-gray-700 flex justify-between items-center">
          <span className="text-sm font-medium text-gray-700 dark:text-gray-200">
            {docs.length} documento{docs.length !== 1 ? 's' : ''} disponíve{docs.length !== 1 ? 'is' : 'l'}
          </span>
          <button onClick={() => void refresh()} className="text-xs text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">↻ Atualizar</button>
        </div>

        {docs.length === 0 ? (
          <p className="p-6 text-sm text-gray-400 dark:text-gray-500 text-center">
            Nenhum documento ainda. Carrega um ficheiro acima.
          </p>
        ) : (
          <ul className="divide-y divide-gray-50 dark:divide-gray-700">
            {docs.map((doc) => (
              <li key={doc.id} className="px-4 py-3 flex items-center gap-3">
                <span className="text-xl select-none">{mimeIcon(doc.mimeType)}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 dark:text-gray-100 truncate">{doc.name}</p>
                  {doc.description && (
                    <p className="text-xs text-gray-500 dark:text-gray-400 truncate">{doc.description}</p>
                  )}
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-0.5">{doc.fileName} · {fmtBytes(doc.fileSize)}</p>
                </div>
                <div className="flex gap-2 shrink-0">
                  <a
                    href={doc.fileUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="p-1.5 rounded text-gray-400 dark:text-gray-500 hover:text-blue-600 hover:bg-blue-50 dark:hover:bg-blue-900/30 transition-colors text-sm"
                    title="Abrir"
                  >
                    ↗
                  </a>
                  <button
                    onClick={() => void handleDelete(doc.id, doc.name)}
                    className="p-1.5 rounded text-gray-400 dark:text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors text-sm"
                    title="Apagar"
                  >
                    ✕
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
