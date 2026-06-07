import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import axios from 'axios';
import { API_URL } from '../../utils/constants';

interface PortalData {
  companyName: string;
  domain: string | null;
  agents: { id: string; name: string; description: string | null }[];
}

export default function WhitelabelPortal() {
  const router = useRouter();
  const { tenantId } = router.query;
  const [data, setData] = useState<PortalData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!tenantId || typeof tenantId !== 'string') return;
    axios.get<PortalData>(`${API_URL}/api/public/portal/${tenantId}`)
      .then(({ data }) => setData(data))
      .catch(() => setError('Portal não encontrado ou sem agentes ativos.'))
      .finally(() => setLoading(false));
  }, [tenantId]);

  const companyName = data?.companyName ?? 'Portal';

  return (
    <div className="min-h-screen bg-gradient-to-br from-gray-50 to-blue-50 dark:from-gray-900 dark:to-gray-800 flex flex-col">
      <Head><title>{companyName} — Assistente Virtual</title></Head>

      {/* Header */}
      <header className="bg-white dark:bg-gray-900 shadow-sm border-b border-gray-200 dark:border-gray-700">
        <div className="max-w-4xl mx-auto px-6 py-4 flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center text-white font-bold text-lg shadow">
            {companyName[0] ?? 'A'}
          </div>
          <div>
            <h1 className="text-lg font-bold text-gray-900 dark:text-gray-100">{companyName}</h1>
            <p className="text-xs text-gray-500 dark:text-gray-400">Assistente Virtual</p>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="flex-1 max-w-4xl mx-auto w-full px-6 py-12">
        {loading && (
          <div className="flex flex-col items-center gap-3 py-20">
            <div className="w-8 h-8 border-2 border-blue-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-400 text-sm">A carregar...</p>
          </div>
        )}

        {error && (
          <div className="text-center py-20">
            <p className="text-gray-400 text-sm">{error}</p>
          </div>
        )}

        {data && data.agents.length === 0 && (
          <div className="text-center py-20">
            <p className="text-gray-400 text-sm">Nenhum assistente disponível de momento.</p>
          </div>
        )}

        {data && data.agents.length > 0 && (
          <>
            <div className="text-center mb-10">
              <h2 className="text-2xl font-bold text-gray-900 dark:text-gray-100">Como podemos ajudar?</h2>
              <p className="text-gray-500 dark:text-gray-400 mt-2">Seleciona o assistente mais adequado para a tua questão.</p>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
              {data.agents.map((agent) => (
                <button
                  key={agent.id}
                  onClick={() => router.push(`/chat/${agent.id}`)}
                  className="bg-white dark:bg-gray-800 rounded-2xl p-6 text-left shadow-sm border border-gray-200 dark:border-gray-700 hover:shadow-md hover:border-blue-300 dark:hover:border-blue-600 transition-all group"
                >
                  <div className="w-12 h-12 rounded-xl bg-gradient-to-br from-blue-100 to-blue-200 dark:from-blue-900/40 dark:to-blue-800/40 flex items-center justify-center text-blue-700 dark:text-blue-300 font-bold text-xl mb-4 group-hover:scale-105 transition-transform">
                    {agent.name[0]}
                  </div>
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 mb-1">{agent.name}</h3>
                  {agent.description && (
                    <p className="text-sm text-gray-500 dark:text-gray-400 line-clamp-2">{agent.description}</p>
                  )}
                  <div className="mt-4 flex items-center text-sm text-blue-600 dark:text-blue-400 font-medium gap-1 group-hover:gap-2 transition-all">
                    <span>Conversar</span>
                    <span>→</span>
                  </div>
                </button>
              ))}
            </div>
          </>
        )}
      </main>

      {/* Footer — no "Powered by" for whitelabel feel */}
      <footer className="text-center py-4 text-xs text-gray-300 dark:text-gray-600">
        © {new Date().getFullYear()} {companyName}
      </footer>
    </div>
  );
}
