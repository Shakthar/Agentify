import { useState, useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import dynamic from 'next/dynamic';
import axios from 'axios';
import { API_URL } from '../../utils/constants';

// dynamic import para evitar SSR com socket.io
const PublicChatWidget = dynamic(() => import('../../components/PublicChatWidget'), { ssr: false });

interface StartResponse {
  conversationId: string;
  agentName: string;
  agentId: string;
}

/**
 * Página pública de chat para visitantes.
 * URL: /chat/[agentId]
 * Pode ser embutida num iframe: <iframe src="https://app.agentfy.com/chat/AGENT_ID" />
 * Ou usada como link direto enviado a clientes.
 */
export default function PublicChatPage() {
  const router = useRouter();
  const { agentId } = router.query;

  const [state, setState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [agentName, setAgentName] = useState('Assistente');
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    if (!agentId || typeof agentId !== 'string') return;

    const visitorId = `v_${Math.random().toString(36).slice(2)}`;

    axios
      .post<StartResponse>(`${API_URL}/api/chat/start`, { agentId, visitorId })
      .then(({ data }) => {
        setConversationId(data.conversationId);
        setAgentName(data.agentName);
        setState('ready');
      })
      .catch(() => {
        setErrorMsg('Não foi possível ligar ao agente. Por favor tente mais tarde.');
        setState('error');
      });
  }, [agentId]);

  return (
    <div className="min-h-screen bg-gray-50 flex items-center justify-center p-4">
      <Head><title>Agentfy — {agentName}</title></Head>
      <div className="w-full max-w-md h-[600px]">
        {state === 'loading' && (
          <div className="flex flex-col items-center justify-center h-full gap-3">
            <div className="w-8 h-8 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-gray-400 text-sm">A ligar ao agente...</p>
          </div>
        )}

        {state === 'error' && (
          <div className="flex flex-col items-center justify-center h-full gap-3 text-center">
            <p className="text-gray-500 text-sm">{errorMsg}</p>
          </div>
        )}

        {state === 'ready' && conversationId && (
          <PublicChatWidget
            agentId={agentId as string}
            agentName={agentName}
            conversationId={conversationId}
          />
        )}
      </div>

      {/* Powered by */}
      <p className="fixed bottom-3 right-4 text-xs text-gray-300">
        Powered by <span className="text-brand-400 font-medium">Agentfy</span>
      </p>
    </div>
  );
}
