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

  return (
    <div className="flex items-start gap-3 py-3">
      <span className="text-lg shrink-0 w-7 text-center mt-0.5">🛡️</span>
      <div className="flex-1 min-w-0">
        <div className="flex items-center justify-between gap-2 mb-1">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">Validação de contactos</span>
            {active && <span className="text-[14px] text-green-600 dark:text-green-400">● Ativa</span>}
          </div>
          <button
            type="button"
            onClick={handleToggle}
            disabled={toggling}
            aria-label={active ? 'Desativar Validação de contactos' : 'Ativar Validação de contactos'}
            className={`shrink-0 w-11 h-6 rounded-full transition-colors duration-200 flex items-center px-0.5 ${active ? 'bg-brand-600' : 'bg-gray-300 dark:bg-gray-600'}`}
          >
            <span className={`w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200 ${active ? 'translate-x-5' : 'translate-x-0'}`} />
          </button>
        </div>
        <p className="text-xs text-gray-500 dark:text-gray-400 leading-snug">
          Só números de telefone aprovados (WhatsApp e Telegram) podem falar com o agente — os restantes recebem uma
          recusa automática sem consumir créditos. Não se aplica ao Instagram (a Meta não expõe o número do remetente aí).
        </p>

        {active && (
          <div className="mt-4 space-y-4 border-t border-gray-100 dark:border-gray-700 pt-4">
            {/* Mensagem de recusa */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Mensagem de recusa</label>
              <textarea
                className="input w-full h-16 resize-none text-sm"
                placeholder={DEFAULT_BLOCKED_MESSAGE}
                value={msgDraft}
                onChange={(e) => setMsgDraft(e.target.value)}
                onBlur={handleSaveMessage}
                disabled={savingMsg}
              />
              <p className="text-[14px] text-gray-400 mt-1">Enviada no máximo 1x por dia ao mesmo contacto. Deixa em branco para usar a mensagem padrão.</p>
            </div>

            {/* Adicionar contacto */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Adicionar contacto</label>
              <div className="flex flex-wrap gap-2">
                <input
                  type="text"
                  value={newPhone}
                  onChange={(e) => setNewPhone(e.target.value)}
                  placeholder="Nº de telefone (ex: 351912345678)"
                  className="flex-1 min-w-[180px] border border-gray-200 dark:border-gray-600 rounded-lg text-sm px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-400"
                  disabled={adding}
                />
                <input
                  type="text"
                  value={newLabel}
                  onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="Nome/etiqueta (opcional)"
                  className="flex-1 min-w-[140px] border border-gray-200 dark:border-gray-600 rounded-lg text-sm px-3 py-2 bg-white dark:bg-gray-700 text-gray-900 dark:text-gray-100 placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-brand-400"
                  disabled={adding}
                />
                <button
                  onClick={handleAddContact}
                  disabled={adding || !newPhone.trim()}
                  className="px-4 py-2 rounded-lg bg-brand-600 text-white text-sm font-medium hover:bg-brand-700 disabled:opacity-50 transition-colors"
                >
                  {adding ? '…' : 'Adicionar'}
                </button>
              </div>
              {addMsg && <p className={`text-xs mt-1 ${addMsg.startsWith('✓') ? 'text-green-600' : 'text-red-600'}`}>{addMsg}</p>}
            </div>

            {/* Importar ficheiro */}
            <div>
              <label className="block text-xs font-medium text-gray-700 dark:text-gray-300 mb-1">Importar de ficheiro</label>
              <p className="text-[14px] text-gray-400 mb-2">Ficheiro .csv ou .txt — uma coluna com o número, opcionalmente uma segunda com o nome. Exporta o teu Excel/Sheets como CSV.</p>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.txt"
                onChange={handleImport}
                disabled={importing}
                className="block w-full text-sm text-gray-700 dark:text-gray-300 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:text-sm file:font-medium file:bg-brand-50 file:text-brand-700 hover:file:bg-brand-100 cursor-pointer disabled:opacity-50"
              />
              {importing && <p className="text-xs text-brand-600 mt-1 animate-pulse">A importar…</p>}
              {importMsg && <p className={`text-xs mt-1 ${importMsg.startsWith('✓') ? 'text-green-600' : 'text-red-600'}`}>{importMsg}</p>}
            </div>

            {/* Lista de contactos aprovados */}
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-xs font-medium text-gray-700 dark:text-gray-300">Contactos aprovados ({total})</label>
                <button onClick={() => void refresh()} className="text-[14px] text-gray-400 dark:text-gray-500 hover:text-gray-700 dark:hover:text-gray-300">↻ Atualizar</button>
              </div>
              {listError && <p className="text-xs text-red-600">{listError}</p>}
              {loading && <p className="text-xs text-gray-400 animate-pulse">A carregar…</p>}
              {!loading && contacts.length === 0 && !listError && (
                <p className="text-xs text-gray-400 dark:text-gray-500 italic">Nenhum contacto aprovado ainda — adiciona um acima ou importa um ficheiro.</p>
              )}
              {contacts.length > 0 && (
                <div className="border border-gray-200 dark:border-gray-700 rounded-lg overflow-hidden max-h-64 overflow-y-auto">
                  <table className="w-full text-sm">
                    <tbody className="divide-y divide-gray-100 dark:divide-gray-700">
                      {contacts.map((c) => (
                        <tr key={c.id}>
                          <td className="px-3 py-2 font-mono text-gray-700 dark:text-gray-200 whitespace-nowrap">+{c.phone}</td>
                          <td className="px-3 py-2 text-gray-500 dark:text-gray-400 truncate">{c.label ?? '—'}</td>
                          <td className="px-3 py-2 text-right">
                            <button
                              onClick={() => void handleDeleteContact(c.id)}
                              title="Remover"
                              className="p-1 rounded text-gray-400 dark:text-gray-500 hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                            >
                              ✕
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
      </div>
    </div>
  );
}
