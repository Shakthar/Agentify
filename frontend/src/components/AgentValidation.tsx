/**
 * AgentValidation — Skill "Validação": allow-list de contactos aprovados.
 *
 * Quando ativa, só números de telefone (WhatsApp/Telegram) presentes nesta
 * lista podem falar com o agente — os restantes recebem uma recusa automática
 * sem consumir créditos nem chegar à IA. Não se aplica ao Instagram (a Graph
 * API do Instagram só devolve o PSID do remetente, nunca um número de telefone).
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import api from '../utils/api';
import { Agent } from '../types';

interface AllowedContact {
  id: string;
  phone: string;
  label?: string | null;
  createdAt: string;
}

interface ContactsResponse {
  contacts: AllowedContact[];
  total: number;
}

interface ImportResult {
  total: number;
  imported: number;
  duplicates: number;
  invalid: number;
}

interface Props {
  agent: Agent;
  onAgentUpdate: (updated: Agent) => void;
}

const DEFAULT_BLOCKED_MESSAGE =
  'Este número não está autorizado a usar este agente. Contacta o responsável do negócio se achas que isto é um engano.';

export default function AgentValidation({ agent, onAgentUpdate }: Props) {
  const active = !!agent.skillValidationEnabled;

  const [toggling, setToggling] = useState(false);
  const [contacts, setContacts] = useState<AllowedContact[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(false);
  const [listError, setListError] = useState<string | null>(null);

  const [newPhone, setNewPhone] = useState('');
  const [newLabel, setNewLabel] = useState('');
  const [adding, setAdding] = useState(false);
  const [addMsg, setAddMsg] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState<string | null>(null);

  const [msgDraft, setMsgDraft] = useState(agent.validationBlockedMessage ?? '');
  const [savingMsg, setSavingMsg] = useState(false);

  // Sincroniza o rascunho da mensagem se o agente mudar por fora (ex.: troca de agente)
  useEffect(() => { setMsgDraft(agent.validationBlockedMessage ?? ''); }, [agent.id, agent.validationBlockedMessage]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setListError(null);
    try {
      const { data } = await api.get<ContactsResponse>(`/api/agents/${agent.id}/validation/contacts`);
      setContacts(data.contacts);
      setTotal(data.total);
    } catch {
      setListError('Erro ao carregar contactos.');
    } finally {
      setLoading(false);
    }
  }, [agent.id]);

  useEffect(() => {
    if (active) void refresh();
  }, [active, refresh]);

  const handleToggle = async () => {
    setToggling(true);
    try {
      const { data } = await api.patch<Agent>(`/api/agents/${agent.id}`, { skillValidationEnabled: !active });
      onAgentUpdate(data);
    } catch {
      // falha silenciosa — o toggle simplesmente não muda de estado
    } finally {
      setToggling(false);
    }
  };

  const handleSaveMessage = async () => {
    setSavingMsg(true);
    try {
      const { data } = await api.patch<Agent>(`/api/agents/${agent.id}`, { validationBlockedMessage: msgDraft });
      onAgentUpdate(data);
    } catch {
      // ignora — o utilizador pode voltar a sair do campo para tentar de novo
    } finally {
      setSavingMsg(false);
    }
  };

  const handleAddContact = async () => {
    if (!newPhone.trim()) return;
    setAdding(true);
    setAddMsg(null);
    try {
      await api.post(`/api/agents/${agent.id}/validation/contacts`, {
        phone: newPhone.trim(),
        label: newLabel.trim() || undefined,
      });
      setNewPhone('');
      setNewLabel('');
      setAddMsg('✓ Contacto adicionado');
      await refresh();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setAddMsg(`Erro: ${msg ?? 'falha ao adicionar contacto'}`);
    } finally {
      setAdding(false);
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!confirm('Remover este contacto da lista de aprovados?')) return;
    try {
      await api.delete(`/api/agents/${agent.id}/validation/contacts/${contactId}`);
      await refresh();
    } catch {
      alert('Erro ao remover o contacto');
    }
  };

  const handleImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportMsg(null);
    const form = new FormData();
    form.append('file', file);
    try {
      const { data } = await api.post<ImportResult>(`/api/agents/${agent.id}/validation/contacts/import`, form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setImportMsg(
        `✓ ${data.imported} importado${data.imported === 1 ? '' : 's'} · ${data.duplicates} já existia${data.duplicates === 1 ? '' : 'm'} · ${data.invalid} inválido${data.invalid === 1 ? '' : 's'}`
      );
      if (fileInputRef.current) fileInputRef.current.value = '';
      await refresh();
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setImportMsg(`Erro: ${msg ?? 'falha ao importar ficheiro'}`);
    } finally {
      setImporting(false);
    }
  };

  const ok = (m: string) => m.startsWith('✓');
  const msgText = (m: string) => m.replace(/^✓\s*/, '');

  return (
    <li className="border-t border-app-rule py-4 first:border-t-0 first:pt-0">
      <div className="flex items-start gap-4">
        <div className="min-w-0 flex-1">
          <span className="text-sm font-semibold text-app-ink">Só contactos aprovados</span>
          <p className="mt-1 text-sm text-app-muted">
            Só os números aprovados (WhatsApp e Telegram) falam com o agente. Os outros recebem uma recusa automática, sem gastar
            créditos. Não se aplica ao Instagram, porque a Meta não mostra o número de quem escreve.
          </p>
        </div>
        <button
          type="button"
          role="switch"
          aria-checked={active}
          onClick={handleToggle}
          disabled={toggling}
          aria-label={active ? 'Desativar Validação de contactos' : 'Ativar Validação de contactos'}
          className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full px-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent/40 disabled:opacity-60 ${active ? 'bg-app-accent' : 'bg-app-control'}`}
        >
          <span className={`h-5 w-5 rounded-full bg-app-sheet transition-transform ${active ? 'translate-x-5' : 'translate-x-0'}`} />
        </button>
      </div>

      {active && (
        <div className="mt-4 space-y-5 border-t border-app-rule pt-4">
          {/* Mensagem de recusa */}
          <div>
            <label htmlFor="valBlockedMsg" className="mb-1 block text-sm font-medium text-app-ink">Mensagem de recusa</label>
            <textarea
              id="valBlockedMsg"
              className="input h-20 resize-y"
              placeholder={DEFAULT_BLOCKED_MESSAGE}
              value={msgDraft}
              onChange={(e) => setMsgDraft(e.target.value)}
              onBlur={handleSaveMessage}
              disabled={savingMsg}
            />
            <p className="mt-1 text-xs text-app-faint">Enviada no máximo uma vez por dia ao mesmo contacto. Em branco, usa a mensagem padrão. Guarda-se ao sair do campo.</p>
          </div>

          {/* Adicionar contacto */}
          <div>
            <span className="mb-1 block text-sm font-medium text-app-ink">Adicionar contacto</span>
            <div className="flex flex-wrap gap-2">
              <input
                type="text"
                aria-label="Número de telefone"
                value={newPhone}
                onChange={(e) => setNewPhone(e.target.value)}
                placeholder="Telefone (ex: 351912345678)"
                className="input num min-w-[180px] flex-1"
                disabled={adding}
              />
              <input
                type="text"
                aria-label="Nome ou etiqueta"
                value={newLabel}
                onChange={(e) => setNewLabel(e.target.value)}
                placeholder="Nome (opcional)"
                className="input min-w-[140px] flex-1"
                disabled={adding}
              />
              <button type="button" onClick={handleAddContact} disabled={adding || !newPhone.trim()} className="btn-secondary">
                {adding ? 'A adicionar…' : 'Adicionar'}
              </button>
            </div>
            {addMsg && <p role="status" className={`mt-1 text-xs ${ok(addMsg) ? 'text-app-pos' : 'text-app-neg'}`}>{msgText(addMsg)}</p>}
          </div>

          {/* Importar ficheiro */}
          <div>
            <label htmlFor="valImport" className="mb-1 block text-sm font-medium text-app-ink">Importar de ficheiro</label>
            <p className="mb-2 text-xs text-app-faint">Ficheiro .csv ou .txt: uma coluna com o número e, se quiser, outra com o nome. No Excel ou Sheets, exporte como CSV.</p>
            <input
              id="valImport"
              ref={fileInputRef}
              type="file"
              accept=".csv,.txt"
              onChange={handleImport}
              disabled={importing}
              className="block w-full cursor-pointer text-sm text-app-muted file:mr-3 file:h-9 file:rounded-lg file:border file:border-solid file:border-app-control file:bg-app-sheet file:px-4 file:text-sm file:font-semibold file:text-app-ink hover:file:bg-app-raised disabled:opacity-50"
            />
            {importing && <p className="mt-1 text-xs text-app-muted">A importar…</p>}
            {importMsg && <p role="status" className={`mt-1 text-xs ${ok(importMsg) ? 'text-app-pos' : 'text-app-neg'}`}>{msgText(importMsg)}</p>}
          </div>

          {/* Lista de contactos aprovados */}
          <div>
            <div className="mb-2 flex items-center justify-between">
              <span className="text-sm font-medium text-app-ink">Contactos aprovados <span className="num font-normal text-app-faint">{total}</span></span>
              <button type="button" onClick={() => void refresh()} className="text-sm font-semibold text-app-accent hover:underline">Atualizar</button>
            </div>
            {listError && (
              <div className="flex flex-wrap items-center gap-3 rounded-lg bg-app-neg-soft px-3 py-2 text-sm text-app-neg">
                <span>Não foi possível carregar os contactos.</span>
                <button type="button" onClick={() => void refresh()} className="font-semibold underline underline-offset-2">Tentar de novo</button>
              </div>
            )}
            {loading && (
              <div className="space-y-2" aria-label="A carregar">
                <span className="block h-4 w-2/3 rounded bg-app-raised" />
                <span className="block h-4 w-1/2 rounded bg-app-raised" />
              </div>
            )}
            {!loading && contacts.length === 0 && !listError && (
              <p className="rounded-lg border border-dashed border-app-edge px-4 py-3 text-sm text-app-muted">Ainda não há contactos aprovados. Adicione um acima ou importe um ficheiro.</p>
            )}
            {contacts.length > 0 && (
              <div className="max-h-64 overflow-y-auto rounded-lg border border-app-edge">
                <table className="w-full text-sm">
                  <tbody>
                    {contacts.map((c, i) => (
                      <tr key={c.id} className={i > 0 ? 'border-t border-app-rule' : ''}>
                        <td className="num whitespace-nowrap px-3 py-2 text-app-ink">+{c.phone}</td>
                        <td className="truncate px-3 py-2 text-app-muted">{c.label ?? '—'}</td>
                        <td className="px-3 py-2 text-right">
                          <button
                            type="button"
                            onClick={() => void handleDeleteContact(c.id)}
                            aria-label={`Remover +${c.phone}`}
                            className="rounded px-2 py-1 text-xs font-semibold text-app-muted transition-colors hover:bg-app-neg-soft hover:text-app-neg"
                          >
                            Remover
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </li>
  );
}
