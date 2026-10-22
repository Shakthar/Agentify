import { useEffect, useState, useCallback } from 'react';
import AppLayout from '../../components/app/AppLayout';
import { EmptyState, InlineError, PageHeader, Pill, PillTone, Skeleton, cx } from '../../components/app/ui';
import apiFetch from '../../utils/api';

interface CrmContact {
  id: string;
  tenantId: string;
  agentId: string | null;
  phone: string | null;
  name: string | null;
  email: string | null;
  status: 'lead' | 'cliente' | 'inativo' | 'vip';
  tags: string[];
  notes: string | null;
  firstSeenAt: string;
  lastSeenAt: string;
  totalConversations: number;
  totalMessages: number;
  avgSentiment: number | null;
}

const STATUS_TONE: Record<string, PillTone> = { lead: 'accent', cliente: 'pos', inativo: 'neutral', vip: 'warn' };
const STATUS_LABELS: Record<string, string> = { lead: 'Lead', cliente: 'Cliente', inativo: 'Inativo', vip: 'VIP' };

const fmtDate = (iso: string) => new Date(iso).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short', year: 'numeric' });

export default function CrmPage() {
  const [contacts, setContacts] = useState<CrmContact[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState('');
  const [selected, setSelected] = useState<CrmContact | null>(null);
  const [editNotes, setEditNotes] = useState('');
  const [editTags, setEditTags] = useState('');
  const [editStatus, setEditStatus] = useState('');
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState('');
  const [error, setError] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const params = new URLSearchParams();
      if (search) params.set('search', search);
      if (filterStatus) params.set('status', filterStatus);
      const { data } = await apiFetch.get(`/api/crm?${params}`);
      setContacts(data.contacts ?? []);
      setTotal(data.total ?? 0);
    } catch { setError(true); }
    finally { setLoading(false); }
  }, [search, filterStatus]);

  useEffect(() => { load(); }, [load]);

  const handleSync = async () => {
    setSyncing(true);
    try {
      const { data: r } = await apiFetch.post('/api/crm/sync');
      setMsg(`Sincronizado — ${r.upserted ?? 0} contactos atualizados`);
      setTimeout(() => setMsg(''), 3000);
      load();
    } catch { setMsg('Erro ao sincronizar'); }
    finally { setSyncing(false); }
  };

  const openContact = (c: CrmContact) => {
    setSelected(c);
    setEditNotes(c.notes ?? '');
    setEditTags((c.tags ?? []).join(', '));
    setEditStatus(c.status);
  };

  const handleSave = async () => {
    if (!selected) return;
    setSaving(true);
    try {
      const tagsArr = editTags.split(',').map(t => t.trim()).filter(Boolean);
      const { data: updated } = await apiFetch.patch(`/api/crm/${selected.id}`, { notes: editNotes, tags: tagsArr, status: editStatus });
      setContacts(prev => prev.map(c => c.id === updated.id ? updated : c));
      setSelected(updated);
      setMsg('Guardado');
      setTimeout(() => setMsg(''), 2000);
    } catch { setMsg('Erro ao guardar'); }
    finally { setSaving(false); }
  };

  const sentimentLabel = (v: number | null) => {
    if (v === null) return '—';
    if (v >= 0.6) return 'Positivo';
    if (v >= 0.3) return 'Neutro';
    return 'Negativo';
  };

  const title = (c: CrmContact) => c.name ?? c.phone ?? 'Anónimo';
  const sub = (c: CrmContact) => [c.name ? c.phone : null, c.email].filter(Boolean).join(' · ');

  return (
    <AppLayout wide>
      <PageHeader
        title="Contactos"
        subtitle={loading ? 'A carregar…' : `${total.toLocaleString('pt-PT')} ${total === 1 ? 'contacto' : 'contactos'} reunidos das conversas`}
        actions={
          <button onClick={handleSync} disabled={syncing} className="btn-primary">
            {syncing ? 'A sincronizar…' : 'Sincronizar conversas'}
          </button>
        }
      />

      <div className="mb-4 flex flex-col gap-2 sm:flex-row" role="search">
        <input
          className="input flex-1"
          placeholder="Pesquisar por nome, telemóvel ou email"
          aria-label="Pesquisar contactos"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <select className="input pr-9 sm:w-60" aria-label="Filtrar por estado" value={filterStatus} onChange={e => setFilterStatus(e.target.value)}>
          <option value="">Todos os estados</option>
          <option value="lead">Lead</option>
          <option value="cliente">Cliente</option>
          <option value="vip">VIP</option>
          <option value="inativo">Inativo</option>
        </select>
      </div>

      {msg && <p role="status" className="mb-3 text-sm text-app-pos">{msg}</p>}

      <div className="flex items-start gap-5">
        <section className={cx('min-w-0 flex-1 overflow-hidden rounded-xl border border-app-edge bg-app-sheet', selected && 'hidden lg:block')}>
          {error ? (
            <div className="p-4"><InlineError message="Não foi possível carregar os contactos." onRetry={load} /></div>
          ) : loading ? (
            <div className="divide-y divide-app-rule">
              {[0, 1, 2, 3, 4].map(i => (
                <div key={i} className="flex items-center gap-4 px-5 py-4">
                  <div className="flex-1 space-y-2"><Skeleton className="h-4 w-44" /><Skeleton className="h-3 w-60" /></div>
                  <Skeleton className="h-4 w-20" />
                </div>
              ))}
            </div>
          ) : contacts.length === 0 ? (
            <div className="p-5">
              <EmptyState
                title={search || filterStatus ? 'Nenhum contacto corresponde à pesquisa' : 'Ainda não há contactos'}
                body={search || filterStatus ? 'Experimente outro termo ou limpe o filtro de estado.' : 'Sincronize as conversas para importar os clientes que já falaram com os seus agentes.'}
              />
            </div>
          ) : (
            <table className="w-full table-fixed text-sm">
              <thead>
                <tr className="text-xs text-app-muted">
                  <th scope="col" className="px-5 py-3 text-left font-medium">Contacto</th>
                  <th scope="col" className="hidden w-28 px-3 py-3 text-left font-medium sm:table-cell">Estado</th>
                  <th scope="col" className="hidden w-64 px-3 py-3 text-left font-medium xl:table-cell">Etiquetas</th>
                  <th scope="col" className="hidden w-28 px-3 py-3 text-right font-medium md:table-cell">Conversas</th>
                  <th scope="col" className="w-40 whitespace-nowrap px-5 py-3 text-right font-medium">Último contacto</th>
                </tr>
              </thead>
              <tbody>
                {contacts.map(c => (
                  <tr
                    key={c.id}
                    onClick={() => openContact(c)}
                    className={cx('cursor-pointer border-t border-app-rule transition-colors hover:bg-app-raised', selected?.id === c.id && 'bg-app-raised')}
                  >
                    <td className="max-w-0 px-5 py-3.5">
                      <button type="button" onClick={e => { e.stopPropagation(); openContact(c); }} className="block max-w-full text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent/40">
                        <span className="block truncate font-medium text-app-ink">{title(c)}</span>
                        {sub(c) && <span className="block truncate text-xs text-app-muted">{sub(c)}</span>}
                      </button>
                    </td>
                    <td className="hidden px-3 py-3.5 sm:table-cell"><Pill tone={STATUS_TONE[c.status]} dot>{STATUS_LABELS[c.status]}</Pill></td>
                    <td className="hidden px-3 py-3.5 xl:table-cell">
                      <div className="flex gap-1 overflow-hidden">
                        {(c.tags ?? []).slice(0, 1).map(t => <span key={t} className="whitespace-nowrap rounded bg-app-raised px-1.5 py-0.5 text-xs text-app-muted">{t}</span>)}
                        {(c.tags ?? []).length > 1 && <span className="num text-xs text-app-faint">+{c.tags.length - 1}</span>}
                      </div>
                    </td>
                    <td className="num hidden px-3 py-3.5 text-right text-app-ink md:table-cell">{c.totalConversations}</td>
                    <td className="num whitespace-nowrap px-5 py-3.5 text-right text-app-muted">{fmtDate(c.lastSeenAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>

        {selected && (
          <aside className="w-full shrink-0 rounded-xl border border-app-edge bg-app-sheet lg:w-[24rem]" aria-label="Detalhe do contacto">
            <div className="flex items-start justify-between gap-3 border-b border-app-rule px-5 py-4">
              <div className="min-w-0">
                <h2 className="truncate text-base font-semibold text-app-ink">{title(selected)}</h2>
                {selected.phone && selected.name && <p className="num text-xs text-app-muted">{selected.phone}</p>}
                {selected.email && <p className="truncate text-xs text-app-muted">{selected.email}</p>}
              </div>
              <button onClick={() => setSelected(null)} className="btn-ghost -mr-2 h-8 px-2" aria-label="Fechar detalhe">Fechar</button>
            </div>

            <dl className="grid grid-cols-3 divide-x divide-app-rule border-b border-app-rule text-sm">
              <div className="px-5 py-3"><dt className="text-xs text-app-muted">Conversas</dt><dd className="num text-lg font-semibold text-app-ink">{selected.totalConversations}</dd></div>
              <div className="px-4 py-3"><dt className="text-xs text-app-muted">Mensagens</dt><dd className="num text-lg font-semibold text-app-ink">{selected.totalMessages}</dd></div>
              <div className="px-4 py-3"><dt className="text-xs text-app-muted">Tom</dt><dd className="text-sm font-semibold leading-8 text-app-ink">{sentimentLabel(selected.avgSentiment)}</dd></div>
            </dl>

            <div className="space-y-4 p-5">
              <p className="num text-xs text-app-faint">
                Primeiro contacto {fmtDate(selected.firstSeenAt)} · último {fmtDate(selected.lastSeenAt)}
              </p>
              <div>
                <label htmlFor="crm-status" className="label mb-1 block">Estado</label>
                <select id="crm-status" className="input" value={editStatus} onChange={e => setEditStatus(e.target.value)}>
                  <option value="lead">Lead</option>
                  <option value="cliente">Cliente</option>
                  <option value="vip">VIP</option>
                  <option value="inativo">Inativo</option>
                </select>
              </div>
              <div>
                <label htmlFor="crm-tags" className="label mb-1 block">Etiquetas, separadas por vírgula</label>
                <input id="crm-tags" className="input" placeholder="ex.: urgente, renovação, produto A" value={editTags} onChange={e => setEditTags(e.target.value)} />
              </div>
              <div>
                <label htmlFor="crm-notes" className="label mb-1 block">Notas internas</label>
                <textarea id="crm-notes" className="input h-28 resize-none" placeholder="Visíveis apenas para a equipa" value={editNotes} onChange={e => setEditNotes(e.target.value)} />
              </div>
              <button onClick={handleSave} disabled={saving} className="btn-secondary w-full">
                {saving ? 'A guardar…' : 'Guardar alterações'}
              </button>
            </div>
          </aside>
        )}
      </div>
    </AppLayout>
  );
}
