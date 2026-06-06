import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Navigation from '../../components/Navigation';
import AgentCreator from '../../components/AgentCreator';
import { useAuth } from '../../hooks/useAuth';
import { ROUTES } from '../../utils/constants';

export default function CreateAgentPage() {
  const router = useRouter();
  const { tenant } = useAuth();

  useEffect(() => {
    if (!tenant) router.replace(ROUTES.home);
  }, [tenant]);

  if (!tenant) return null;

  return (
    <div className="flex min-h-screen">
      <Head><title>Agentfy — Novo Agente</title></Head>
      <Navigation />
      <main className="flex-1 p-8 overflow-y-auto">
        <div className="max-w-2xl mx-auto">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Criar Agente</h1>
            <p className="text-gray-500 text-sm mt-1">Configure um novo agente IA em 4 passos</p>
          </div>
          <AgentCreator />
        </div>
      </main>
    </div>
  );
}
