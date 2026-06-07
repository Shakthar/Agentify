import { useRouter } from 'next/router';
import Head from 'next/head';
import { useEffect, useState } from 'react';
import { API_URL } from '../../utils/constants';
import PublicChatWidget from '../../components/PublicChatWidget';

interface AgentPublicData {
  agentId: string;
  agentName: string;
  agentDescription?: string;
  companyName: string;
  tenantId: string;
}

export default function WhitelabelAgentPage() {
  const router = useRouter();
  const { agentId } = router.query;
  const [data, setData] = useState<AgentPublicData | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!agentId || typeof agentId !== 'string') return;
    fetch(`${API_URL}/api/public/agent/${agentId}`)
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then(setData)
      .catch(() => setError(true));
  }, [agentId]);

  if (error) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-8 text-center">
        <p className="text-5xl mb-4">🤖</p>
        <h1 className="text-xl font-bold text-gray-700">Página não encontrada</h1>
        <p className="text-gray-500 text-sm mt-2">Este agente não está disponível publicamente.</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <>
      <Head>
        <title>{data.agentName} — {data.companyName}</title>
        <meta name="description" content={data.agentDescription ?? `Fala com ${data.agentName}`} />
      </Head>
      <div className="min-h-screen flex flex-col bg-gray-50">
        {/* Branded header */}
        <header className="bg-white border-b border-gray-200 px-6 py-4">
          <div className="max-w-2xl mx-auto flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
              <span className="text-white text-sm font-bold">
                {data.companyName.charAt(0).toUpperCase()}
              </span>
            </div>
            <div>
              <p className="text-xs text-gray-500 leading-tight">{data.companyName}</p>
              <h1 className="text-sm font-semibold text-gray-900 leading-tight">{data.agentName}</h1>
            </div>
          </div>
        </header>

        {/* Chat */}
        <main className="flex-1 flex flex-col max-w-2xl mx-auto w-full px-0 sm:px-4 py-4">
          <div className="flex-1 bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
            <PublicChatWidget agentId={data.agentId} agentName={data.agentName} conversationId="" />
          </div>
        </main>
      </div>
    </>
  );
}
