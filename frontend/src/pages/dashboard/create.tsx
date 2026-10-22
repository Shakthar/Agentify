import { useEffect } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import AppLayout from '../../components/app/AppLayout';
import { PageHeader } from '../../components/app/ui';
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
    <AppLayout>
      <Head><title>Agentfy — Novo Agente</title></Head>
      <PageHeader
        title="Criar agente"
        subtitle="Cinco passos: descreva o negócio, reveja o que a IA escreveu e confirme."
        back={{ href: ROUTES.agents, label: 'Agentes' }}
      />
      <AgentCreator />
    </AppLayout>
  );
}
