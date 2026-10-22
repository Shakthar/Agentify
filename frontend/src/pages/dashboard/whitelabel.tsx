import { useState, useEffect } from 'react';
import Head from 'next/head';
import { useRouter } from 'next/router';
import AppLayout from '../../components/app/AppLayout';
import { EmptyState, KpiStrip, PageHeader, Panel, Pill, Skeleton, Tabs } from '../../components/app/ui';
import { useAuth } from '../../hooks/useAuth';
import { useAgent } from '../../hooks/useAgent';
import api from '../../utils/api';
import { Agent, Plan, PLAN_LABELS } from '../../types';

const PLAN_ORDER = ['free', 'starter', 'business', 'enterprise'];
/** Preço do addon por agente e por mês, em euros (null = indisponível, 0 = incluído). */
const WL_ADDON_PRICE: Record<string, number | null> = { free: null, starter: 5, business: 3, enterprise: 0 };

type Tab = 'agents' | 'domain' | 'branding';

export default function WhitelabelPage() {
  const { tenant, loadMe } = useAuth();
  const { agents, fetchAgents, updateAgent, loading } = useAgent();
  const router = useRouter();

  const [activeTab, setActiveTab] = useState<Tab>('agents');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [errMsg, setErrMsg] = useState('');

  // Branding fields
  const [brandColor, setBrandColor] = useState(tenant?.brandColor ?? '#3b57f0');
  const [logoUrl, setLogoUrl] = useState(tenant?.logoUrl ?? '');
  const [companyName, setCompanyName] = useState(tenant?.companyName ?? '');

  // Domain fields
  const [domain, setDomain] = useState(tenant?.domain ?? '');

  useEffect(() => { fetchAgents(0, 100); }, [fetchAgents]);
  useEffect(() => {
    if (tenant) {
      setBrandColor(tenant.brandColor ?? '#3b57f0');
      setLogoUrl(tenant.logoUrl ?? '');
      setCompanyName(tenant.companyName ?? '');
      setDomain(tenant.domain ?? '');
    }
  }, [tenant]);

  if (!tenant) return null;

  const plan = tenant.plan as string;
  const planIdx = PLAN_ORDER.indexOf(plan);
  const addonPrice = WL_ADDON_PRICE[plan] ?? null;
  const canUseWhitelabel = planIdx >= PLAN_ORDER.indexOf('starter');
  const wlAgents = agents.filter((a) => a.whitelabelEnabled);

  const flash = (ok: boolean, text: string) => {
    if (ok) { setMsg(text); setTimeout(() => setMsg(''), 3000); }
    else { setErrMsg(text); setTimeout(() => setErrMsg(''), 5000); }
  };

  const handleToggleWL = async (agent: Agent) => {
    try {
      const updated = await updateAgent(agent.id, { whitelabelEnabled: !agent.whitelabelEnabled });
      // refresh list
      await fetchAgents(0, 100);
      flash(true, agent.whitelabelEnabled ? 'White-label desativado' : `White-label ativado. URL: /w/${updated.id}`);
    } catch {
      flash(false, 'Erro ao atualizar agente.');
    }
  };

  const handleSaveBranding = async () => {
    setSaving(true); setMsg(''); setErrMsg('');
    try {
      await api.put('/api/auth/profile', {
        companyName: companyName || undefined,
        brandColor: brandColor || undefined,
        logoUrl: logoUrl || undefined,
      });
      await loadMe();
      flash(true, 'Marca guardada');
    } catch {
      flash(false, 'Erro ao guardar a marca.');
    } finally { setSaving(false); }
  };

  const handleSaveDomain = async () => {
    setSaving(true); setMsg(''); setErrMsg('');
    try {
      await api.put('/api/auth/profile', {
        domain: domain.trim() || undefined,
      });
      await loadMe();
      flash(true, 'Domínio guardado');
    } catch {
      flash(false, 'Erro ao guardar o domínio. Verifique se não está em uso por outra conta.');
    } finally { setSaving(false); }
  };

  const BASE_URL = 'agentfy.shaklabs.tech';
  const eur = (v: number) => v.toLocaleString('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  const displayName = companyName || tenant.companyName || 'A sua empresa';
  const previewHost = domain || BASE_URL;
  const labelCls = 'label mb-1 block';
  const hint = 'mb-2 text-xs text-app-faint';

  return (
    <AppLayout wide>
      <Head><title>Agentfy · White-label</title></Head>
      <PageHeader
        title="White-label"
        subtitle="Páginas públicas de chat com a sua marca, sem Agentfy à vista."
        actions={<Pill tone="neutral">Plano {PLAN_LABELS[plan as Plan] ?? plan}</Pill>}
      />

      {!canUseWhitelabel ? (
        <div className="max-w-xl">
          <EmptyState
            title="Disponível a partir do plano Starter"
            body="O white-label é um extra de 5 € por agente e por mês. Inclui domínio próprio e a sua cor e logótipo nas páginas públicas."
            action={<button onClick={() => router.push('/dashboard/plans')} className="btn-primary">Ver planos</button>}
          />
        </div>
      ) : (
        <>
          <div className="mb-6">
            <KpiStrip items={[
              { label: 'Agentes com white-label', value: wlAgents.length, caption: `de ${agents.length}` },
              { label: 'Custo mensal estimado', value: addonPrice === null ? '—' : eur(addonPrice * wlAgents.length), caption: addonPrice === 0 ? 'Incluído no plano' : addonPrice ? `${eur(addonPrice)} por agente` : undefined },
              { label: 'Domínio ativo', value: <span className="block truncate text-base leading-9">{previewHost}</span> },
            ]} />
          </div>

          <Tabs<Tab>
            label="Definições de white-label"
            value={activeTab}
            onChange={setActiveTab}
            tabs={[{ id: 'agents', label: 'Agentes' }, { id: 'domain', label: 'Domínio' }, { id: 'branding', label: 'Marca' }]}
          />

          {msg && <p role="status" className="mb-4 rounded-lg bg-app-pos-soft px-4 py-2 text-sm text-app-pos">{msg}</p>}
          {errMsg && <p role="alert" className="mb-4 rounded-lg bg-app-neg-soft px-4 py-2 text-sm text-app-neg">{errMsg}</p>}

          <div className="grid items-start gap-8 lg:grid-cols-[minmax(0,1fr)_22rem] xl:grid-cols-[minmax(0,1fr)_26rem]">
            <div className="min-w-0">
              {activeTab === 'agents' && (
                <div>
                  <p className="mb-3 text-sm text-app-muted">
                    Ative o white-label em cada agente.{addonPrice ? ` ${eur(addonPrice)} por agente e por mês.` : ''}
                  </p>
                  {loading && agents.length === 0 && <div className="space-y-2">{[0, 1, 2].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>}
                  {agents.length > 0 && (
                    <ul className="overflow-hidden rounded-xl border border-app-edge">
                      {agents.map((agent, idx) => {
                        const wlUrl = `${previewHost}/w/${agent.id}`;
                        return (
                          <li key={agent.id} className={`flex items-center gap-4 px-5 py-3.5 ${idx > 0 ? 'border-t border-app-rule' : ''}`}>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <span className="truncate font-medium text-app-ink">{agent.name}</span>
                                {!agent.isActive && <Pill>Inativo</Pill>}
                              </div>
                              {agent.whitelabelEnabled ? (
                                <p className="mt-0.5 flex items-center gap-2 text-xs text-app-muted">
                                  <span className="truncate">{wlUrl}</span>
                                  <a href={`https://${wlUrl}`} target="_blank" rel="noopener noreferrer" className="shrink-0 font-medium text-app-accent hover:underline">Abrir</a>
                                </p>
                              ) : (
                                agent.description && <p className="mt-0.5 truncate text-xs text-app-muted">{agent.description}</p>
                              )}
                            </div>
                            <button
                              role="switch"
                              aria-checked={!!agent.whitelabelEnabled}
                              aria-label={`White-label em ${agent.name}`}
                              onClick={() => handleToggleWL(agent)}
                              className={`relative h-6 w-11 shrink-0 rounded-full transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent/40 ${agent.whitelabelEnabled ? 'bg-app-accent' : 'bg-app-control'}`}
                            >
                              <span className={`absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-app-sheet transition-transform ${agent.whitelabelEnabled ? 'translate-x-5' : ''}`} />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                  {agents.length === 0 && !loading && (
                    <EmptyState title="Ainda não há agentes" body="Crie um agente para lhe dar uma página pública com a sua marca." action={<button onClick={() => router.push('/dashboard/create')} className="btn-primary">Criar agente</button>} />
                  )}
                </div>
              )}

              {activeTab === 'domain' && (
                <div className="max-w-xl space-y-6">
                  <div>
                    <p className="text-sm font-semibold text-app-ink">Endereço por omissão</p>
                    <p className="mt-1 text-sm text-app-muted">Sem domínio próprio, as páginas ficam em <span className="num text-app-ink">{BASE_URL}/w/[agente]</span>.</p>
                  </div>
                  <div>
                    <label htmlFor="wl-domain" className={labelCls}>Domínio personalizado</label>
                    <p className={hint}>Por exemplo chat.minha-empresa.pt, sem https://</p>
                    <input id="wl-domain" className="input" placeholder="chat.minha-empresa.pt" value={domain} onChange={(e) => setDomain(e.target.value.replace(/^https?:\/\//, '').trim())} />
                    <button onClick={handleSaveDomain} disabled={saving} className="btn-primary mt-3">{saving ? 'A guardar…' : 'Guardar domínio'}</button>
                  </div>

                  <Panel title="Configurar o DNS">
                    <p className="mb-3 text-sm text-app-muted">No seu fornecedor de DNS (GoDaddy, Cloudflare, etc.) adicione este registo:</p>
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-xs text-app-muted">
                          <th scope="col" className="py-2 pr-4 text-left font-medium">Tipo</th>
                          <th scope="col" className="py-2 pr-4 text-left font-medium">Nome</th>
                          <th scope="col" className="py-2 text-left font-medium">Valor</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr className="border-t border-app-rule">
                          <td className="py-2.5 pr-4 font-medium text-app-ink">CNAME</td>
                          <td className="py-2.5 pr-4 text-app-ink break-all">{domain || 'chat'}</td>
                          <td className="py-2.5 text-app-ink break-all">cname.vercel-dns.com</td>
                        </tr>
                      </tbody>
                    </table>
                    <ul className="mt-4 list-disc space-y-1 pl-5 text-sm text-app-muted">
                      <li>Depois do DNS, envie o domínio para <span className="text-app-ink">contact@solutions.shaklabs.tech</span> para ser ativado.</li>
                      <li>As conversas continuam a passar pelo servidor Agentfy; o domínio serve só a página pública.</li>
                      <li>O HTTPS é configurado automaticamente.</li>
                      <li>A propagação do DNS pode demorar até 48 horas.</li>
                    </ul>
                  </Panel>
                </div>
              )}

              {activeTab === 'branding' && (
                <div className="max-w-xl space-y-5">
                  <div>
                    <label htmlFor="wl-name" className={labelCls}>Nome da empresa</label>
                    <p className={hint}>Aparece no cabeçalho das páginas white-label.</p>
                    <input id="wl-name" className="input" value={companyName} onChange={(e) => setCompanyName(e.target.value)} placeholder="Minha Empresa Lda." />
                  </div>
                  <div>
                    <label htmlFor="wl-color" className={labelCls}>Cor principal</label>
                    <p className={hint}>Botões e destaques nas páginas públicas.</p>
                    <div className="flex items-center gap-3">
                      <input type="color" aria-label="Escolher cor" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} className="h-10 w-12 cursor-pointer rounded-lg border border-app-edge bg-app-sheet p-1" />
                      <input id="wl-color" className="input num w-36" value={brandColor} onChange={(e) => setBrandColor(e.target.value)} placeholder="#3b57f0" maxLength={7} />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="wl-logo" className={labelCls}>URL do logótipo</label>
                    <p className={hint}>Endereço público de uma imagem PNG ou SVG, de preferência 200 × 60 px.</p>
                    <input id="wl-logo" className="input" value={logoUrl} onChange={(e) => setLogoUrl(e.target.value)} placeholder="https://minha-empresa.pt/logo.png" />
                  </div>
                  <button onClick={handleSaveBranding} disabled={saving} className="btn-primary">{saving ? 'A guardar…' : 'Guardar marca'}</button>
                </div>
              )}
            </div>

            {/* Pré-visualização em direto do widget com a marca */}
            <aside aria-label="Pré-visualização" className="lg:sticky lg:top-6">
              <p className="mb-2 text-sm text-app-muted">Pré-visualização em direto</p>
              <div className="overflow-hidden rounded-xl border border-app-edge bg-app-raised p-3">
                <div className="mb-2 truncate rounded-md bg-app-sheet px-3 py-1 text-xs text-app-muted">{previewHost}/w/…</div>
                <div className="overflow-hidden rounded-lg bg-white text-[#13213C]">
                  <div className="flex items-center gap-3 border-b px-4 py-3" style={{ borderColor: '#E3E8F2' }}>
                    {logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={logoUrl} alt="Logótipo" className="h-8 max-w-[8rem] object-contain" onError={(e) => (e.currentTarget.style.display = 'none')} />
                    ) : (
                      <span className="flex h-8 w-8 items-center justify-center rounded-full text-sm font-semibold text-white" style={{ backgroundColor: brandColor }}>
                        {displayName.charAt(0).toUpperCase()}
                      </span>
                    )}
                    <div className="min-w-0 leading-tight">
                      <p className="truncate text-sm font-semibold">{displayName}</p>
                      <p className="text-xs text-[#5B6680]">Assistente virtual</p>
                    </div>
                  </div>
                  <div className="space-y-2 bg-[#F4F6FA] px-4 py-4">
                    <p className="max-w-[80%] rounded-2xl rounded-bl-md bg-white px-3 py-2 text-sm">Olá! Em que posso ajudar?</p>
                    <p className="ml-auto max-w-[80%] rounded-2xl rounded-br-md px-3 py-2 text-sm text-white" style={{ backgroundColor: brandColor }}>Têm mesa para sexta?</p>
                    <p className="max-w-[80%] rounded-2xl rounded-bl-md bg-white px-3 py-2 text-sm">Sim, a que horas?</p>
                  </div>
                  <div className="flex items-center gap-2 border-t px-3 py-3" style={{ borderColor: '#E3E8F2' }}>
                    <span className="flex-1 rounded-full bg-[#F4F6FA] px-3 py-2 text-sm text-[#5B6680]">Escreva uma mensagem</span>
                    <span className="rounded-full px-4 py-2 text-sm font-semibold text-white" style={{ backgroundColor: brandColor }}>Enviar</span>
                  </div>
                </div>
              </div>
            </aside>
          </div>
        </>
      )}
    </AppLayout>
  );
}
