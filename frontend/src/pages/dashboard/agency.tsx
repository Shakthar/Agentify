import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/router';
import AppLayout from '../../components/app/AppLayout';
import { EmptyState, InlineError, KpiStrip, PageHeader, Panel, Pill, PillTone, Skeleton, Tabs, cx } from '../../components/app/ui';
import apiFetch from '../../utils/api';

interface SubAccount {
  id: string;
  name: string;
  email: string;
  plan: 'free' | 'starter' | 'business' | 'enterprise';
  subscriptionStatus: string;
  isActive: boolean;
  createdAt: string;
  _count?: { agents: number };
}

interface Branding {
  agencyName: string;
  agencyBrandColor: string;
  agencyLogoUrl: string;
}

const STATUS_TONE: Record<string, PillTone> = { active: 'pos', trial: 'accent', pending_payment: 'warn', suspended: 'neg' };
const STATUS_LABEL: Record<string, string> = { active: 'Ativa', trial: 'Em teste', pending_payment: 'Pagamento pendente', suspended: 'Suspensa' };

export default function AgencyPage() {
  const router = useRouter();
  const [tab, setTab] = useState<'accounts' | 'branding'>('accounts');
  const [accounts, setAccounts] = useState<SubAccount[]>([]);
  const [branding, setBranding] = useState<Branding>({ agencyName: '', agencyBrandColor: '#6366f1', agencyLogoUrl: '' });
  const [loading, setLoading] = useState(true);
  const [forbidden, setForbidden] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [msg, setMsg] = useState('');

  // New account form
  const [showForm, setShowForm] = useState(false);
  const [formData, setFormData] = useState({ name: '', email: '', password: '', companyName: '', plan: 'starter' as SubAccount['plan'] });
  const [creating, setCreating] = useState(false);
  const [formErr, setFormErr] = useState('');

  // Branding save
  const [brandingSaving, setBrandingSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setLoadError(false);
    try {
      const [{ data: subRes }, { data: brandRes }] = await Promise.all([
        apiFetch.get('/api/agency/subaccounts'),
        apiFetch.get('/api/agency/branding'),
      ]);
      setAccounts(subRes.subaccounts ?? []);
      setBranding({ agencyName: brandRes.agencyName ?? '', agencyBrandColor: brandRes.agencyBrandColor ?? '#6366f1', agencyLogoUrl: brandRes.agencyLogoUrl ?? '' });
    } catch (e: any) {
      if (e?.response?.status === 403 || e?.message?.includes('403')) setForbidden(true);
      else setLoadError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault();
    setCreating(true); setFormErr('');
    try {
      const { data: sub } = await apiFetch.post('/api/agency/subaccounts', formData);
      setAccounts(prev => [sub, ...prev]);
      setShowForm(false);
      setFormData({ name: '', email: '', password: '', companyName: '', plan: 'starter' });
      setMsg('Subconta criada');
      setTimeout(() => setMsg(''), 3000);
    } catch (e: any) {
      setFormErr(e?.response?.data?.error ?? e?.message ?? 'Erro ao criar subconta.');
    } finally {
      setCreating(false);
    }
  };

  const handleChangePlan = async (subId: string, plan: SubAccount['plan']) => {
    try {
      const { data: updated } = await apiFetch.patch(`/api/agency/subaccounts/${subId}`, { plan });
      setAccounts(prev => prev.map(a => a.id === subId ? { ...a, plan: updated.plan } : a));
    } catch { alert('Erro ao alterar plano.'); }
  };

  const handleToggleActive = async (subId: string, isActive: boolean) => {
    try {
      if (!isActive) {
        await apiFetch.delete(`/api/agency/subaccounts/${subId}`);
        setAccounts(prev => prev.map(a => a.id === subId ? { ...a, isActive: false, subscriptionStatus: 'suspended' } : a));
      } else {
        const { data: updated } = await apiFetch.patch(`/api/agency/subaccounts/${subId}`, { isActive: true, subscriptionStatus: 'active' });
        setAccounts(prev => prev.map(a => a.id === subId ? { ...a, ...updated } : a));
      }
    } catch { alert('Erro.'); }
  };

  const handleSaveBranding = async (e: React.FormEvent) => {
    e.preventDefault();
    setBrandingSaving(true);
    try {
      const { data: updated } = await apiFetch.patch('/api/agency/branding', branding);
      setBranding(updated);
      setMsg('Marca guardada');
      setTimeout(() => setMsg(''), 2000);
    } catch { setMsg('Erro ao guardar.'); }
    finally { setBrandingSaving(false); }
  };

  if (loading) return (
    <AppLayout>
      <PageHeader title="Agência" subtitle="A carregar subcontas…" />
      <div className="space-y-3">{[0, 1, 2, 3].map(i => <Skeleton key={i} className="h-14 w-full" />)}</div>
    </AppLayout>
  );

  if (forbidden) return (
    <AppLayout>
      <PageHeader title="Agência" />
      <div className="max-w-xl">
        <EmptyState
          title="Disponível no plano Agência"
          body="Inclui subcontas separadas para cada cliente, a sua marca em vez da Agentfy e um painel centralizado."
          action={<button onClick={() => router.push('/dashboard/plans')} className="btn-primary">Ver planos</button>}
        />
      </div>
    </AppLayout>
  );

  const activeCount = accounts.filter(a => a.isActive).length;
  const agentCount = accounts.reduce((s, a) => s + (a._count?.agents ?? 0), 0);
  const label = 'label mb-1 block';

  return (
    <AppLayout wide>
      <PageHeader
        title="Agência"
        subtitle="Subcontas dos seus clientes e a marca que elas mostram."
        actions={tab === 'accounts' && <button onClick={() => setShowForm(true)} className="btn-primary">Nova subconta</button>}
      />

      {msg && <p role="status" className="mb-3 text-sm text-app-pos">{msg}</p>}
      {loadError && <div className="mb-4"><InlineError message="Não foi possível carregar a agência." onRetry={load} /></div>}

      <div className="mb-6">
        <KpiStrip items={[
          { label: 'Subcontas', value: accounts.length },
          { label: 'Ativas', value: activeCount, caption: accounts.length - activeCount > 0 ? `${accounts.length - activeCount} suspensa${accounts.length - activeCount > 1 ? 's' : ''}` : 'Todas ativas', tone: 'default' },
          { label: 'Agentes nas subcontas', value: agentCount },
          { label: 'Média por subconta', value: accounts.length ? (agentCount / accounts.length).toLocaleString('pt-PT', { maximumFractionDigits: 1 }) : '—', caption: 'agentes' },
        ]} />
      </div>

      <Tabs<'accounts' | 'branding'> label="Secções da agência" value={tab} onChange={setTab} tabs={[{ id: 'accounts', label: 'Subcontas', count: accounts.length }, { id: 'branding', label: 'Marca' }]} />

      {showForm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 p-4" role="dialog" aria-modal="true" aria-label="Nova subconta">
          <form onSubmit={handleCreate} className="w-full max-w-md space-y-4 rounded-2xl border border-app-edge bg-app-sheet p-6 shadow-2xl">
            <div className="flex items-center justify-between">
              <h2 className="text-base font-semibold text-app-ink">Nova subconta</h2>
              <button type="button" onClick={() => setShowForm(false)} className="btn-ghost -mr-2 h-8 px-2">Fechar</button>
            </div>
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
              <div>
                <label className={label}>Nome do responsável</label>
                <input className="input" required value={formData.name} onChange={e => setFormData(f => ({ ...f, name: e.target.value }))} />
              </div>
              <div>
                <label className={label}>Empresa</label>
                <input className="input" value={formData.companyName} onChange={e => setFormData(f => ({ ...f, companyName: e.target.value }))} />
              </div>
              <div className="sm:col-span-2">
                <label className={label}>Email</label>
                <input type="email" className="input" required value={formData.email} onChange={e => setFormData(f => ({ ...f, email: e.target.value }))} />
              </div>
              <div>
                <label className={label}>Palavra-passe</label>
                <input type="password" className="input" required minLength={8} value={formData.password} onChange={e => setFormData(f => ({ ...f, password: e.target.value }))} placeholder="Mínimo 8 caracteres" />
              </div>
              <div>
                <label className={label}>Plano</label>
                <select className="input" value={formData.plan} onChange={e => setFormData(f => ({ ...f, plan: e.target.value as SubAccount['plan'] }))}>
                  <option value="free">Free</option>
                  <option value="starter">Starter</option>
                  <option value="business">Business</option>
                  <option value="enterprise">Enterprise</option>
                </select>
              </div>
            </div>
            {formErr && <p className="text-sm text-app-neg">{formErr}</p>}
            <div className="flex gap-2 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="btn-secondary flex-1">Cancelar</button>
              <button type="submit" className="btn-primary flex-1" disabled={creating}>{creating ? 'A criar…' : 'Criar subconta'}</button>
            </div>
          </form>
        </div>
      )}

      {tab === 'accounts' && (
        accounts.length === 0 ? (
          <EmptyState
            title="Ainda não há subcontas"
            body="Crie a primeira para um cliente ou projeto. Fica com a sua marca."
            action={<button onClick={() => setShowForm(true)} className="btn-primary">Criar primeira subconta</button>}
          />
        ) : (
          <div className="overflow-hidden rounded-xl border border-app-edge">
            <table className="w-full table-fixed text-sm">
              <thead>
                <tr className="text-xs text-app-muted">
                  <th scope="col" className="px-5 py-3 text-left font-medium">Cliente</th>
                  <th scope="col" className="hidden w-44 px-3 py-3 text-left font-medium sm:table-cell">Plano</th>
                  <th scope="col" className="hidden w-36 px-3 py-3 text-left font-medium md:table-cell">Estado</th>
                  <th scope="col" className="hidden w-24 px-3 py-3 text-right font-medium md:table-cell">Agentes</th>
                  <th scope="col" className="hidden w-36 px-3 py-3 text-right font-medium lg:table-cell">Criada</th>
                  <th scope="col" className="w-36 px-5 py-3 text-right font-medium"><span className="sr-only">Ações</span></th>
                </tr>
              </thead>
              <tbody>
                {accounts.map(a => (
                  <tr key={a.id} className="border-t border-app-rule">
                    <td className={cx('max-w-0 px-5 py-3.5', !a.isActive && 'opacity-60')}>
                      <span className="block truncate font-medium text-app-ink">{a.name}</span>
                      <span className="block truncate text-xs text-app-muted">{a.email}</span>
                    </td>
                    <td className="hidden px-3 py-3.5 sm:table-cell">
                      <select
                        value={a.plan}
                        onChange={e => handleChangePlan(a.id, e.target.value as SubAccount['plan'])}
                        aria-label={`Plano de ${a.name}`}
                        className="input h-9 w-full cursor-pointer py-0 pr-8"
                      >
                        <option value="free">Free</option>
                        <option value="starter">Starter</option>
                        <option value="business">Business</option>
                        <option value="enterprise">Enterprise</option>
                      </select>
                    </td>
                    <td className="hidden px-3 py-3.5 md:table-cell">
                      <Pill tone={STATUS_TONE[a.subscriptionStatus] ?? 'neutral'} dot>{STATUS_LABEL[a.subscriptionStatus] ?? a.subscriptionStatus}</Pill>
                    </td>
                    <td className="num hidden px-3 py-3.5 text-right text-app-ink md:table-cell">{a._count?.agents ?? 0}</td>
                    <td className="num hidden whitespace-nowrap px-3 py-3.5 text-right text-app-muted lg:table-cell">{new Date(a.createdAt).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' })}</td>
                    <td className="px-5 py-3.5 text-right">
                      <button onClick={() => handleToggleActive(a.id, !a.isActive)} className="whitespace-nowrap text-sm font-medium text-app-muted underline-offset-2 hover:text-app-ink hover:underline">
                        {a.isActive ? 'Suspender' : 'Reativar'}
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )
      )}

      {tab === 'branding' && (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,32rem)_minmax(0,1fr)]">
          <form onSubmit={handleSaveBranding} className="space-y-5">
            <p className="text-sm text-app-muted">Aplicada às subcontas que criar: veem a plataforma com o seu nome e cor, não os da Agentfy.</p>
            <div>
              <label className={label}>Nome da agência</label>
              <input className="input" placeholder="Ex.: Minha Agência Digital" value={branding.agencyName} onChange={e => setBranding(b => ({ ...b, agencyName: e.target.value }))} />
            </div>
            <div>
              <label className={label}>Cor principal</label>
              <div className="flex items-center gap-2">
                <input type="color" aria-label="Escolher cor" value={branding.agencyBrandColor} onChange={e => setBranding(b => ({ ...b, agencyBrandColor: e.target.value }))} className="h-10 w-12 cursor-pointer rounded-lg border border-app-edge bg-app-sheet p-1" />
                <input className="input num flex-1" placeholder="#6366f1" value={branding.agencyBrandColor} onChange={e => setBranding(b => ({ ...b, agencyBrandColor: e.target.value }))} />
              </div>
            </div>
            <div>
              <label className={label}>URL do logótipo</label>
              <input type="url" className="input" placeholder="https://…" value={branding.agencyLogoUrl} onChange={e => setBranding(b => ({ ...b, agencyLogoUrl: e.target.value }))} />
            </div>
            <button type="submit" className="btn-primary" disabled={brandingSaving}>{brandingSaving ? 'A guardar…' : 'Guardar marca'}</button>
          </form>

          <Panel title="Como as subcontas a veem" className="self-start">
            <div className="rounded-lg border border-app-rule p-4">
              <div className="flex items-center gap-3">
                {branding.agencyLogoUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={branding.agencyLogoUrl} alt="Pré-visualização do logótipo" className="h-8 max-w-[8rem] object-contain" onError={e => (e.currentTarget.style.display = 'none')} />
                ) : (
                  <span className="h-8 w-8 rounded-md" style={{ background: branding.agencyBrandColor }} aria-hidden="true" />
                )}
                <span className="text-base font-semibold text-app-ink">{branding.agencyName || 'Nome da agência'}</span>
              </div>
              <div className="mt-4 flex items-center gap-3">
                <span className="inline-flex h-9 items-center rounded-lg px-4 text-sm font-semibold text-white" style={{ background: branding.agencyBrandColor }}>Criar agente</span>
                <span className="text-sm font-medium" style={{ color: branding.agencyBrandColor }}>Ver conversas</span>
              </div>
            </div>
          </Panel>
        </div>
      )}
    </AppLayout>
  );
}
