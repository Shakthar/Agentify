import { useRouter } from 'next/router';
import Head from 'next/head';
import { useEffect, useState } from 'react';
import { API_URL } from '../../utils/constants';
import PublicChatWidget, { readableOn } from '../../components/PublicChatWidget';

interface AgentPublicData {
  agentId: string;
  agentName: string;
  agentDescription?: string;
  companyName: string;
  tenantId: string;
  brandColor: string;
  logoUrl: string | null;
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
      <div className="flex min-h-screen flex-col items-center justify-center bg-mist p-8 text-center text-ink" style={{ colorScheme: 'light' }}>
        <h1 className="text-xl font-semibold">Página não encontrada</h1>
        <p className="mt-2 text-sm text-ink-mute">Este assistente não está disponível publicamente.</p>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-mist" style={{ colorScheme: 'light' }} role="status" aria-label="A carregar">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-line border-t-brand-600" />
      </div>
    );
  }

  const brand = data.brandColor || '#2346D8';
  const onBrand = readableOn(brand);

  return (
    <>
      <Head>
        <title>{data.companyName} · {data.agentName}</title>
        <meta name="description" content={data.agentDescription ?? `Fale com ${data.agentName}`} />
        <meta name="color-scheme" content="light" />
      </Head>
      <div className="flex h-[100dvh] flex-col bg-mist text-ink" style={{ colorScheme: 'light' }}>
        <header className="border-b border-line bg-white px-4 py-3 sm:px-6">
          <div className="mx-auto flex max-w-2xl items-center gap-3 sm:px-4">
            {data.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.logoUrl} alt="" className="h-9 max-w-[9rem] object-contain" />
            ) : (
              <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-semibold" style={{ backgroundColor: brand, color: onBrand }} aria-hidden="true">
                {data.companyName.charAt(0).toUpperCase()}
              </span>
            )}
            <div className="min-w-0 leading-tight">
              <h1 className="truncate text-base font-semibold">{data.companyName}</h1>
              <p className="truncate text-xs text-ink-mute">{data.agentName}{data.agentDescription ? ` · ${data.agentDescription}` : ''}</p>
            </div>
          </div>
        </header>

        <main className="mx-auto flex min-h-0 w-full max-w-2xl flex-1 flex-col sm:px-4 sm:py-4">
          <div className="min-h-0 flex-1 overflow-hidden bg-white sm:rounded-2xl sm:border sm:border-line">
            <PublicChatWidget agentId={data.agentId} agentName={data.agentName} conversationId="" brandColor={brand} bare />
          </div>
        </main>
      </div>
    </>
  );
}
