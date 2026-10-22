import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useRouter } from 'next/router';
import Head from 'next/head';
import Link from 'next/link';
import AppLayout from '../../components/app/AppLayout';
import { EmptyState, KpiStrip, Panel, Pill, Skeleton, Tabs, cx } from '../../components/app/ui';
import ChatWidget from '../../components/ChatWidget';
import KnowledgeBase from '../../components/KnowledgeBase';
import AgentValidation from '../../components/AgentValidation';
import AgentDocs from '../../components/AgentDocs';
import Orders from '../../components/Orders';
import ConversationHistory from '../../components/ConversationHistory';
import { useAuth } from '../../hooks/useAuth';
import { useAgent } from '../../hooks/useAgent';
import { ROUTES, API_URL, AVAILABLE_MODELS_BY_PLAN } from '../../utils/constants';
import { Agent } from '../../types';
import api from '../../utils/api';

const WEBHOOK_URL = `${API_URL}/api/webhooks/whatsapp`;
const INSTAGRAM_WEBHOOK_URL = `${API_URL}/api/webhooks/instagram`;

type TabKey = 'overview' | 'chat' | 'edit' | 'embed' | 'whatsapp' | 'instagram' | 'telegram' | 'knowledge' | 'docs' | 'orders' | 'history' | 'skills' | 'integrations' | 'leads';
const TAB_KEYS: TabKey[] = ['overview', 'chat', 'edit', 'embed', 'whatsapp', 'instagram', 'telegram', 'knowledge', 'docs', 'orders', 'history', 'skills', 'integrations', 'leads'];
const CHANNEL_TABS: TabKey[] = ['whatsapp', 'instagram', 'telegram', 'embed'];

const int = (v: number) => v.toLocaleString('pt-PT');

/** Tira o emoji inicial das mensagens de estado e devolve o tom certo. */
function readStatus(msg: string): { tone: 'pos' | 'neg' | 'warn'; text: string } {
  const t = msg.trim();
  const strip = (s: string) => s.replace(/^(?:[☀-➿️]|[\uD83C-\uD83E][\uDC00-\uDFFF]|\s)+/, '');
  if (t.startsWith('❌') || /^erro/i.test(t) || t.includes('Erro ao')) return { tone: 'neg', text: strip(t) };
  if (t.startsWith('⚠')) return { tone: 'warn', text: strip(t) };
  if (/PIN deve/.test(t)) return { tone: 'neg', text: t };
  return { tone: 'pos', text: strip(t) };
}

function StatusLine({ msg, className }: { msg: string; className?: string }) {
  if (!msg) return null;
  const { tone, text } = readStatus(msg);
  return (
    <p role="status" className={cx('rounded-lg px-3 py-2 text-sm', tone === 'neg' ? 'bg-app-neg-soft text-app-neg' : tone === 'warn' ? 'bg-app-warn-soft text-app-warn' : 'bg-app-pos-soft text-app-pos', className)}>
      {text}
    </p>
  );
}

/** Remove emoji decorativo de rótulos que vêm de constantes partilhadas. */
const plain = (s: string) => s.replace(/[☀-➿️]|[\uD83C-\uD83E][\uDC00-\uDFFF]/g, '').trim();

function CopyBox({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false);
  const copy = () => {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };
  return (
    <div>
      <p className="mb-1 text-xs text-app-muted">{label}</p>
      <div className="flex items-stretch gap-2">
        <pre className="min-w-0 flex-1 overflow-x-auto whitespace-pre-wrap break-all rounded-lg border border-app-edge bg-app-raised px-3 py-2 font-mono text-xs text-app-ink">{value}</pre>
        <button type="button" onClick={copy} className="btn-secondary h-auto shrink-0 px-3 text-xs">
          {copied ? 'Copiado' : 'Copiar'}
        </button>
      </div>
    </div>
  );
}

/** Interruptor: tinta de acento quando ligado, cinza de controlo quando desligado. */
function Switch({ checked, onChange, label, disabled, locked }: { checked: boolean; onChange: () => void; label: string; disabled?: boolean; locked?: boolean }) {
  const on = checked && !locked;
  return (
    <button
      type="button"
      role="switch"
      aria-checked={on}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={cx(
        'relative inline-flex h-6 w-11 shrink-0 items-center rounded-full px-0.5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-app-accent/40',
        on ? 'bg-app-accent' : 'bg-app-control',
        locked ? 'cursor-not-allowed opacity-50' : disabled ? 'opacity-60' : '',
      )}
    >
      <span className={cx('h-5 w-5 rounded-full bg-app-sheet transition-transform', on ? 'translate-x-5' : 'translate-x-0')} />
    </button>
  );
}

/** Linha de definições: coluna de rótulo (~40%) com título e descrição; controlo à direita. */
function SettingsRow({ title, description, children, aside }: { title: ReactNode; description?: ReactNode; children: ReactNode; aside?: ReactNode }) {
  return (
    <div className="grid grid-cols-1 gap-4 border-t border-app-rule py-6 first:border-t-0 first:pt-0 md:grid-cols-[minmax(0,2fr)_minmax(0,3fr)] md:gap-10">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <h3 className="text-sm font-semibold text-app-ink">{title}</h3>
          {aside}
        </div>
        {description && <div className="mt-1 text-sm text-app-muted">{description}</div>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

function Field({ label, hint, htmlFor, children }: { label: ReactNode; hint?: ReactNode; htmlFor?: string; children: ReactNode }) {
  return (
    <div>
      <label htmlFor={htmlFor} className="mb-1 block text-sm font-medium text-app-ink">{label}</label>
      {children}
      {hint && <p className="mt-1 text-xs text-app-faint">{hint}</p>}
    </div>
  );
}

/** Barra de gravação no fim de uma vista de definições: um só "Guardar" por vista. */
function SaveBar({ children, status }: { children: ReactNode; status?: ReactNode }) {
  return (
    <div className="mt-2 flex flex-col gap-3 border-t border-app-rule pt-5 sm:flex-row sm:items-center sm:justify-end">
      {status && <div className="sm:mr-auto">{status}</div>}
      <div className="flex flex-wrap items-center gap-2">{children}</div>
    </div>
  );
}

function Code({ children }: { children: ReactNode }) {
  return <code className="rounded bg-app-raised px-1 font-mono text-[0.9em] text-app-ink">{children}</code>;
}

interface ScheduleProps {
  idPrefix: string;
  enabled: boolean; setEnabled: (fn: (v: boolean) => boolean) => void;
  tz: string; setTz: (v: string) => void;
  wdEnabled: boolean; setWdEnabled: (v: boolean) => void;
  wdStart: string; setWdStart: (v: string) => void;
  wdEnd: string; setWdEnd: (v: string) => void;
  weEnabled: boolean; setWeEnabled: (v: boolean) => void;
  weStart: string; setWeStart: (v: string) => void;
  weEnd: string; setWeEnd: (v: string) => void;
  offMsg: string; setOffMsg: (v: string) => void;
}

/** Horário de atendimento do canal (igual nos três canais). */
function ScheduleFields(p: ScheduleProps) {
  const range = (label: string, id: string, on: boolean, setOn: (v: boolean) => void, start: string, setStart: (v: string) => void, end: string, setEnd: (v: string) => void) => (
    <div className="space-y-2">
      <label htmlFor={id} className="flex items-center gap-2 text-sm text-app-ink">
        <input type="checkbox" id={id} checked={on} onChange={(e) => setOn(e.target.checked)} className="h-4 w-4 rounded accent-app-accent" />
        {label}
      </label>
      {on && (
        <div className="ml-6 flex flex-wrap items-center gap-2">
          <input type="time" aria-label={`${label}: início`} className="input w-40" value={start} onChange={(e) => setStart(e.target.value)} />
          <span className="text-sm text-app-muted">até</span>
          <input type="time" aria-label={`${label}: fim`} className="input w-40" value={end} onChange={(e) => setEnd(e.target.value)} />
          {start > end && <span className="text-xs text-app-faint">passa da meia-noite</span>}
        </div>
      )}
    </div>
  );
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm text-app-ink">{p.enabled ? 'Só responde dentro do horário' : 'Responde a qualquer hora'}</span>
        <Switch checked={p.enabled} onChange={() => p.setEnabled((v) => !v)} label="Limitar a um horário" />
      </div>
      {p.enabled && (
        <div className="space-y-4 rounded-lg border border-app-edge p-4">
          <Field label="Fuso horário" htmlFor={`${p.idPrefix}Tz`}>
            <select id={`${p.idPrefix}Tz`} className="input h-auto py-2" value={p.tz} onChange={(e) => p.setTz(e.target.value)}>
              <option value="Europe/Lisbon">Europe/Lisbon (Portugal)</option>
              <option value="America/Sao_Paulo">America/Sao_Paulo (Brasil)</option>
              <option value="America/Argentina/Buenos_Aires">America/Buenos_Aires</option>
              <option value="America/Santiago">America/Santiago (Chile)</option>
              <option value="UTC">UTC</option>
            </select>
          </Field>
          {range('Dias úteis (seg–sex)', `${p.idPrefix}WdEnabled`, p.wdEnabled, p.setWdEnabled, p.wdStart, p.setWdStart, p.wdEnd, p.setWdEnd)}
          {range('Fim de semana (sáb–dom)', `${p.idPrefix}WeEnabled`, p.weEnabled, p.setWeEnabled, p.weStart, p.setWeStart, p.weEnd, p.setWeEnd)}
          <Field label="Mensagem fora de horas" hint="Opcional. Se ficar vazio, as mensagens fora de horas ficam sem resposta." htmlFor={`${p.idPrefix}Off`}>
            <input id={`${p.idPrefix}Off`} className="input" placeholder="Ex.: Estamos fechados. Respondemos a partir das 12h." value={p.offMsg} onChange={(e) => p.setOffMsg(e.target.value)} />
          </Field>
        </div>
      )}
    </div>
  );
}

/** "Configurar manualmente": disclosure discreto para o caminho técnico. */
function ManualSetup({ children }: { children: ReactNode }) {
  return (
    <details className="group rounded-lg border border-app-edge">
      <summary className="flex cursor-pointer list-none items-center justify-between gap-3 px-4 py-3 text-sm font-semibold text-app-ink [&::-webkit-details-marker]:hidden">
        Configurar manualmente
        <svg className="h-3 w-3 text-app-muted transition-transform group-open:rotate-90" viewBox="0 0 8 8" fill="currentColor" aria-hidden="true"><path d="M2 0l4 4-4 4V0z" /></svg>
      </summary>
      <div className="space-y-6 border-t border-app-rule px-4 py-5">{children}</div>
    </details>
  );
}

function Step({ n, title, children }: { n: number; title: ReactNode; children: ReactNode }) {
  return (
    <div>
      <h4 className="mb-2 text-sm font-semibold text-app-ink">
        <span className="num mr-2 text-app-faint">{n}.</span>{title}
      </h4>
      <div className="space-y-3 text-sm text-app-muted">{children}</div>
    </div>
  );
}

export default function AgentDetailPage() {
  const router = useRouter();
  const { id } = router.query;
  const { tenant } = useAuth();
  const { updateAgent, toggleAgent, deleteAgent } = useAgent();
  const [agent, setAgent] = useState<Agent | null>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // A aba ativa vive no URL (?tab=...), para poder ser partilhada e sobreviver ao recarregar.
  const [activeTab, setActiveTabState] = useState<TabKey>('overview');
  const setActiveTab = (t: TabKey) => {
    setActiveTabState(t);
    if (router.query.tab !== t) {
      router.replace({ pathname: router.pathname, query: { ...router.query, tab: t } }, undefined, { shallow: true, scroll: false });
    }
  };
  useEffect(() => {
    if (!router.isReady) return;
    const t = router.query.tab;
    if (typeof t === 'string' && (TAB_KEYS as string[]).includes(t)) setActiveTabState(t as TabKey);
  }, [router.isReady, router.query.tab]);
  const [skillsSaving, setSkillsSaving] = useState(false);
  const [skillsMsg, setSkillsMsg] = useState('');
  const [editForm, setEditForm] = useState<Partial<Agent>>({});
  const [error, setError] = useState<string | null>(null);
  // WhatsApp state
  const [phoneId, setPhoneId] = useState('');
  // Guarda sempre o valor mais recente de phoneId, sem sofrer do problema de closure
  // obsoleta do React — necessário porque o callback do FB.login() é criado antes do
  // evento postMessage do Embedded Signup atualizar o state.
  const phoneIdRef = useRef('');
  // Mesma lógica para o waba_id (WhatsApp Business Account ID) — necessário para o
  // backend subscrever a app aos webhooks desta WABA específica (sem isto, a Meta
  // nunca envia eventos de mensagens recebidas para o nosso endpoint, mesmo com o
  // número já registado/ativo — o número liga "com sucesso" mas ninguém responde).
  const wabaIdRef = useRef('');
  const [notifyPhone, setNotifyPhone] = useState('');
  const [wpEnabled, setWpEnabled] = useState(false);
  const [wpToken, setWpToken] = useState('');
  const [wpTokenVisible, setWpTokenVisible] = useState(false);
  const [wpSaving, setWpSaving] = useState(false);
  const [wpMsg, setWpMsg] = useState('');
  const [wpTokenOk, setWpTokenOk] = useState(true);
  const [wpRegPin, setWpRegPin] = useState('');
  const [wpRegSaving, setWpRegSaving] = useState(false);
  const [wpRegMsg, setWpRegMsg] = useState('');
  const [tmSaving, setTmSaving] = useState(false);
  const [intSaving, setIntSaving] = useState(false);
  const [intMsg, setIntMsg] = useState('');
  // WhatsApp schedule state
  const [wpSchedEnabled, setWpSchedEnabled] = useState(false);
  const [wpSchedTz, setWpSchedTz] = useState('Europe/Lisbon');
  const [wpSchedWdStart, setWpSchedWdStart] = useState('18:00');
  const [wpSchedWdEnd, setWpSchedWdEnd] = useState('08:59');
  const [wpSchedWdEnabled, setWpSchedWdEnabled] = useState(true);
  const [wpSchedWeEnabled, setWpSchedWeEnabled] = useState(false);
  const [wpSchedWeStart, setWpSchedWeStart] = useState('00:00');
  const [wpSchedWeEnd, setWpSchedWeEnd] = useState('23:59');
  const [wpOffMsg, setWpOffMsg] = useState('');
  // Instagram state
  const [igAccountId, setIgAccountId] = useState('');
  const [igEnabled, setIgEnabled] = useState(false);
  // NOTA (12/09/2026): removido o campo manual de Access Token — a conta Instagram
  // Login guarda sempre o token via OAuth (ver handleInstagramConnect). Um campo
  // manual aqui permitia sobrepor esse token com um valor no formato errado
  // (ex: um token EAA... do Facebook, incompatível com graph.instagram.com),
  // causando "(#190) Cannot parse access token" ao enviar DMs.
  const [igSaving, setIgSaving] = useState(false);
  const [igMsg, setIgMsg] = useState('');
  // Instagram schedule state
  const [igSchedEnabled, setIgSchedEnabled] = useState(false);
  const [igSchedTz, setIgSchedTz] = useState('Europe/Lisbon');
  const [igSchedWdStart, setIgSchedWdStart] = useState('18:00');
  const [igSchedWdEnd, setIgSchedWdEnd] = useState('08:59');
  const [igSchedWdEnabled, setIgSchedWdEnabled] = useState(true);
  const [igSchedWeEnabled, setIgSchedWeEnabled] = useState(false);
  const [igSchedWeStart, setIgSchedWeStart] = useState('00:00');
  const [igSchedWeEnd, setIgSchedWeEnd] = useState('23:59');
  const [igOffMsg, setIgOffMsg] = useState('');
  // Telegram state
  const [tgEnabled, setTgEnabled] = useState(false);
  const [tgUsername, setTgUsername] = useState('');
  const [tgBotToken, setTgBotToken] = useState('');
  const [tgBotTokenVisible, setTgBotTokenVisible] = useState(false);
  const [tgBotTokenConfigured, setTgBotTokenConfigured] = useState(false);
  const [tgSaving, setTgSaving] = useState(false);
  const [tgMsg, setTgMsg] = useState('');
  // Telegram schedule state
  const [tgSchedEnabled, setTgSchedEnabled] = useState(false);
  const [tgSchedTz, setTgSchedTz] = useState('Europe/Lisbon');
  const [tgSchedWdStart, setTgSchedWdStart] = useState('18:00');
  const [tgSchedWdEnd, setTgSchedWdEnd] = useState('08:59');
  const [tgSchedWdEnabled, setTgSchedWdEnabled] = useState(true);
  const [tgSchedWeEnabled, setTgSchedWeEnabled] = useState(false);
  const [tgSchedWeStart, setTgSchedWeStart] = useState('00:00');
  const [tgSchedWeEnd, setTgSchedWeEnd] = useState('23:59');
  const [tgOffMsg, setTgOffMsg] = useState('');
  // Leads / briefing state
  const [briefingHistory, setBriefingHistory] = useState<Array<{role: 'user' | 'assistant'; content: string}>>([]);
  const [briefingInput, setBriefingInput] = useState('');
  const [briefingLoading, setBriefingLoading] = useState(false);
  const [briefingStats, setBriefingStats] = useState<{conversations: number; pending: number; handoffs: number; leads: number; flagged: number} | null>(null);
  const [briefingFlagged, setBriefingFlagged] = useState<Array<{id: string; visitor: string; channel: string; date: string}>>([]);
  // Google Calendar state
  const [gcalConnected, setGcalConnected] = useState(false);
  const [gcalEmail, setGcalEmail] = useState('');
  const [gcalLoading, setGcalLoading] = useState(false);
  // Instagram Login (OAuth)
  const [igConnecting, setIgConnecting] = useState(false);
  // WhatsApp Embedded Signup
  const [esConnecting, setEsConnecting] = useState(false);
  const [esMsg, setEsMsg] = useState('');

  useEffect(() => {
    if (!tenant) { router.replace(ROUTES.home); return; }
    if (!id) return;
    api.get(`/api/agents/${id}`).then(({ data }) => {
      setAgent(data);
      setEditForm({ name: data.name, description: data.description, systemPrompt: data.systemPrompt, model: data.model, temperature: data.temperature, maxTokens: data.maxTokens });
      setPhoneId(data.whatsappNumber ?? '');
      setNotifyPhone(data.notifyPhone ?? '');
      setWpEnabled(data.whatsappEnabled ?? false);
      // token is write-only — never returned from API, leave blank
      setIgAccountId(data.instagramAccountId ?? '');
      setIgEnabled(data.instagramEnabled ?? false);
      // instagram token is also write-only
      // Load WhatsApp schedule
      const wps = data.whatsappSchedule as { enabled?: boolean; timezone?: string; weekdays?: { start: string; end: string } | null; weekends?: { start: string; end: string } | null } | null;
      if (wps) {
        setWpSchedEnabled(wps.enabled ?? false);
        setWpSchedTz(wps.timezone ?? 'Europe/Lisbon');
        setWpSchedWdEnabled(wps.weekdays !== null && wps.weekdays !== undefined);
        if (wps.weekdays) { setWpSchedWdStart(wps.weekdays.start); setWpSchedWdEnd(wps.weekdays.end); }
        setWpSchedWeEnabled(wps.weekends !== null && wps.weekends !== undefined);
        if (wps.weekends) { setWpSchedWeStart(wps.weekends.start); setWpSchedWeEnd(wps.weekends.end); }
      }
      setWpOffMsg(data.offHoursMessage ?? '');
      // Load Instagram schedule
      const igs = data.instagramSchedule as { enabled?: boolean; timezone?: string; weekdays?: { start: string; end: string } | null; weekends?: { start: string; end: string } | null } | null;
      if (igs) {
        setIgSchedEnabled(igs.enabled ?? false);
        setIgSchedTz(igs.timezone ?? 'Europe/Lisbon');
        setIgSchedWdEnabled(igs.weekdays !== null && igs.weekdays !== undefined);
        if (igs.weekdays) { setIgSchedWdStart(igs.weekdays.start); setIgSchedWdEnd(igs.weekdays.end); }
        setIgSchedWeEnabled(igs.weekends !== null && igs.weekends !== undefined);
        if (igs.weekends) { setIgSchedWeStart(igs.weekends.start); setIgSchedWeEnd(igs.weekends.end); }
      }
      setIgOffMsg((data as any).instagramOffHoursMessage ?? '');
      // Load Telegram
      setTgEnabled((data as any).telegramEnabled ?? false);
      setTgUsername((data as any).telegramUsername ?? '');
      setTgBotTokenConfigured((data as any).telegramBotTokenConfigured ?? false);
      // bot token is write-only — never returned from API, leave blank
      const tgs = (data as any).telegramSchedule as { enabled?: boolean; timezone?: string; weekdays?: { start: string; end: string } | null; weekends?: { start: string; end: string } | null } | null;
      if (tgs) {
        setTgSchedEnabled(tgs.enabled ?? false);
        setTgSchedTz(tgs.timezone ?? 'Europe/Lisbon');
        setTgSchedWdEnabled(tgs.weekdays !== null && tgs.weekdays !== undefined);
        if (tgs.weekdays) { setTgSchedWdStart(tgs.weekdays.start); setTgSchedWdEnd(tgs.weekdays.end); }
        setTgSchedWeEnabled(tgs.weekends !== null && tgs.weekends !== undefined);
        if (tgs.weekends) { setTgSchedWeStart(tgs.weekends.start); setTgSchedWeEnd(tgs.weekends.end); }
      }
      setTgOffMsg((data as any).telegramOffHoursMessage ?? '');
    }).catch(() => router.replace(ROUTES.agents)).finally(() => setLoading(false));
    api.get('/api/webhooks/whatsapp/status').then(({ data }) => setWpTokenOk(data.configured)).catch(() => {});
  }, [tenant, id]);

  // Handle ?gcal=success redirect from Google OAuth callback
  useEffect(() => {
    if (!router.isReady) return;
    const { gcal, email } = router.query as { gcal?: string; email?: string };
    if (gcal === 'success' && email) {
      setGcalConnected(true);
      setGcalEmail(decodeURIComponent(email));
      setActiveTabState('integrations');
      const q: Record<string, string | string[] | undefined> = { ...router.query, tab: 'integrations' };
      delete q.gcal; delete q.email;
      router.replace({ pathname: router.pathname, query: q }, undefined, { shallow: true });
    }
    if (gcal === 'error') {
      setActiveTabState('integrations');
      const q: Record<string, string | string[] | undefined> = { ...router.query, tab: 'integrations' };
      delete q.gcal;
      router.replace({ pathname: router.pathname, query: q }, undefined, { shallow: true });
    }
    // Instagram Login OAuth callback
    const { ig, igId, name: igName, warn } = router.query as { ig?: string; igId?: string; name?: string; warn?: string };
    if (ig === 'success' && igId) {
      setIgAccountId(igId);
      setIgEnabled(true);
      if (warn === 'webhook_subscribe_failed') {
        setIgMsg(`⚠️ Conta Instagram ligada${igName ? ` (${decodeURIComponent(igName)})` : ''}, mas não foi possível ativar os webhooks — confirma se a permissão instagram_business_manage_messages já está aprovada no App Review.`);
      } else {
        setIgMsg(`✅ Conta Instagram ligada${igName ? ` (${decodeURIComponent(igName)})` : ''}! Verifica e guarda.`);
      }
      setActiveTabState('instagram');
      const q: Record<string, string | string[] | undefined> = { ...router.query, tab: 'instagram' };
      delete q.ig; delete q.igId; delete q.name; delete q.warn;
      router.replace({ pathname: router.pathname, query: q }, undefined, { shallow: true });
    }
    if (ig === 'error') {
      setIgMsg('❌ Erro ao ligar conta Instagram. Tenta novamente ou introduz os dados manualmente.');
      setActiveTabState('instagram');
      const q: Record<string, string | string[] | undefined> = { ...router.query, tab: 'instagram' };
      delete q.ig; delete q.reason;
      router.replace({ pathname: router.pathname, query: q }, undefined, { shallow: true });
    }
  }, [router.isReady, router.query]);

  // Load Google Calendar connection status when integrations tab opens
  useEffect(() => {
    if (activeTab !== 'integrations' || !agent) return;
    api.get(`/api/integrations/google/status?agentId=${agent.id}`)
      .then(({ data }) => { if (data.connected) { setGcalConnected(true); setGcalEmail(data.email ?? ''); } })
      .catch(() => {});
  }, [activeTab, agent?.id]);

  // Listener persistente para Embedded Signup session logging
  useEffect(() => {
    const onFbMessage = (event: MessageEvent) => {
      if (event.origin !== 'https://www.facebook.com') return;
      try {
        const d = JSON.parse(String(event.data));
        if (d.type === 'WA_EMBEDDED_SIGNUP') {
          if (d.event === 'CANCEL') {
            console.log('[EmbeddedSignup] Cancelado no passo:', d.data?.current_step);
          } else {
            // Dados do flow: phone_number_id, waba_id, business_id
            console.log('[EmbeddedSignup] Dados da sessão:', d.data);
            if (d.data?.phone_number_id) {
              setPhoneId(d.data.phone_number_id);
              phoneIdRef.current = d.data.phone_number_id;
            }
            if (d.data?.waba_id) {
              wabaIdRef.current = d.data.waba_id;
            }
          }
        }
      } catch {}
    };
    window.addEventListener('message', onFbMessage);
    return () => window.removeEventListener('message', onFbMessage);
  }, []);

  // Load briefing when Leads tab opens (first time only)
  useEffect(() => {
    if (activeTab !== 'leads' || !agent || briefingHistory.length > 0) return;
    handleBriefingSend();
  }, [activeTab, agent?.id]);

  const handleSave = async () => {
    if (!agent) return;
    setSaving(true);
    setError(null);
    try {
      const updated = await updateAgent(agent.id, editForm);
      setAgent(updated);
      setActiveTab('overview');
    } catch (err: unknown) {
      setError((err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Erro ao guardar');
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async () => {
    if (!agent) return;
    await toggleAgent(agent.id);
    setAgent((prev) => prev ? { ...prev, isActive: !prev.isActive } : null);
  };

  const handleBriefingSend = async (userMsg?: string) => {
    if (!agent || briefingLoading) return;
    const message = userMsg ?? briefingInput.trim();
    setBriefingLoading(true);
    const newHistory: Array<{role: 'user' | 'assistant'; content: string}> = userMsg
      ? briefingHistory
      : [...briefingHistory, { role: 'user', content: message }];
    if (!userMsg && message) setBriefingHistory(newHistory);
    setBriefingInput('');
    try {
      const { data } = await api.post(`/api/agents/${agent.id}/briefing`, {
        message: message || undefined,
        history: userMsg ? [] : briefingHistory,
      });
      setBriefingHistory(h => [...(userMsg ? [] : h.filter(m => m.content !== message || m.role !== 'user')), ...(message && !userMsg ? [{ role: 'user' as const, content: message }] : []), { role: 'assistant' as const, content: data.reply }]);
      if (data.stats) setBriefingStats(data.stats);
      if (data.flagged) setBriefingFlagged(data.flagged);
    } catch {
      setBriefingHistory(h => [...h, { role: 'assistant' as const, content: '❌ Erro ao obter briefing. Tenta novamente.' }]);
    } finally {
      setBriefingLoading(false);
    }
  };

  // Instagram Login (11/09/2026): autenticação direta com a conta Instagram,
  // sem SDK de popup nem Página do Facebook — apenas um redirect OAuth normal,
  // igual ao Google Calendar (ver handleGcalConnect).
  const handleInstagramConnect = async () => {
    if (!agent) return;
    setIgConnecting(true);
    setIgMsg('');
    try {
      const { data } = await api.get(`/api/integrations/instagram/auth?agentId=${agent.id}`);
      window.location.href = data.url;
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Erro ao iniciar OAuth do Instagram';
      setIgMsg(`❌ ${msg}`);
      setIgConnecting(false);
    }
  };

  const launchWhatsAppSignup = () => {
    if (!agent) return;
    const win = window as unknown as { FB?: { login: (cb: (r: { authResponse?: { code: string } }) => void, opts: object) => void } };
    if (!win.FB) { setEsMsg('❌ SDK do Facebook ainda não carregou. Aguarda e tenta de novo.'); return; }
    setEsConnecting(true);
    setEsMsg('');
    win.FB!.login((response) => {
      if (response.authResponse) {
        const code = response.authResponse.code;
        // Envia também o phone_number_id e o waba_id capturados pelo listener de
        // postMessage (onFbMessage) — sem o phone_number_id o backend nunca gravava
        // o número no agente (Passo 4 falhava); sem o waba_id o backend nunca
        // subscrevia a app aos webhooks desta WABA, e por isso a Meta nunca envia
        // notificações de mensagens recebidas (o número liga e ativa, mas ninguém
        // responde a quem escreve).
        api.post(`/api/agents/${agent.id}/whatsapp/embedded-signup`, {
          code,
          phoneNumberId: phoneIdRef.current || undefined,
          wabaId: wabaIdRef.current || undefined,
        })
          .then(({ data: result }) => {
            if (result.phoneNumberId) {
              setPhoneId(result.phoneNumberId);
              phoneIdRef.current = result.phoneNumberId;
            }
            // O backend já trata do Passo 4 sozinho (gera um PIN e ativa o número na
            // Meta API assim que recebe o Phone Number ID) — não é preciso pedir ao
            // dono do negócio para fazer mais nada manualmente.
            if (!result.phoneNumberId) {
              setEsMsg('⚠️ WhatsApp ligado, mas não recebemos o Phone Number ID automaticamente — confirma-o no Passo 3 (abre "ou configura manualmente"), clica em Guardar e depois em Registar número no Passo 4.');
            } else if (!result.subscribed) {
              setEsMsg(`⚠️ WhatsApp ligado e número ativado, mas não foi possível subscrever os webhooks (${result.subscribeError ?? 'erro desconhecido'}) — o agente não vai receber mensagens. Tenta ligar novamente ou contacta o suporte.`);
            } else if (result.registered) {
              setEsMsg(`✅ WhatsApp ligado e ativado! Guarda este PIN num sítio seguro — só é preciso se um dia migrares este número para outro fornecedor: ${result.pin}`);
            } else {
              setEsMsg(`⚠️ WhatsApp ligado e número associado, mas a ativação automática falhou (${result.registerError ?? 'erro desconhecido'}). Abre "ou configura manualmente" e usa o Passo 4 para tentar registar com um PIN à tua escolha.`);
            }
            setWpEnabled(true);
          })
          .catch((err: unknown) => {
            const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Erro ao trocar token';
            setEsMsg(`❌ ${msg}`);
          })
          .finally(() => setEsConnecting(false));
      } else {
        setEsMsg('');
        setEsConnecting(false);
      }
    }, {
      config_id: '1759697078405304',
      response_type: 'code',
      override_default_response_type: true,
      extras: { version: 'v4' },
    });
  };

  const handleGcalConnect = async () => {
    if (!agent) return;
    setGcalLoading(true);
    try {
      const { data } = await api.get(`/api/integrations/google/auth?agentId=${agent.id}`);
      window.location.href = data.url;
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Erro ao iniciar OAuth';
      alert(msg);
      setGcalLoading(false);
    }
  };

  const handleGcalDisconnect = async () => {
    if (!agent || !confirm('Desligar conta Google deste agente?')) return;
    await api.delete(`/api/integrations/google?agentId=${agent.id}`);
    setGcalConnected(false);
    setGcalEmail('');
  };

  const handleRegisterWhatsApp = async () => {
    if (!agent) return;
    if (!/^\d{6}$/.test(wpRegPin)) { setWpRegMsg('PIN deve ter exactamente 6 dígitos numéricos.'); return; }
    setWpRegSaving(true); setWpRegMsg('');
    try {
      await api.post(`/api/agents/${agent.id}/whatsapp/register`, { pin: wpRegPin });
      setWpRegMsg('✅ Número registado com sucesso! Já pode receber e enviar mensagens.');
      setWpRegPin('');
    } catch (err: unknown) {
      // O backend pode devolver dois formatos: um erro de validação simples
      // ({ error: "mensagem" }, ex: "Phone Number ID não configurado") ou um erro
      // vindo da própria Meta API ({ error: "Erro da Meta API", details: {...} }).
      // Antes só líamos o segundo formato, por isso erros de validação apareciam
      // sempre como "Falha ao registar na Meta API", escondendo a causa real.
      const data = (err as { response?: { data?: { error?: string; details?: { error?: { message?: string } } } } })?.response?.data;
      const msg = data?.details?.error?.message ?? data?.error ?? 'Falha ao registar na Meta API';
      setWpRegMsg(`Erro: ${msg}`);
    } finally {
      setWpRegSaving(false);
    }
  };

  const buildSchedulePayload = (
    enabled: boolean, tz: string,
    wdEnabled: boolean, wdStart: string, wdEnd: string,
    weEnabled: boolean, weStart: string, weEnd: string,
  ) => ({
    enabled,
    timezone: tz,
    weekdays: wdEnabled ? { start: wdStart, end: wdEnd } : null,
    weekends: weEnabled ? { start: weStart, end: weEnd } : null,
  });

  const handleSaveWhatsApp = async () => {
    if (!agent) return;
    setWpSaving(true);
    try {
      const payload: Record<string, unknown> = {
        whatsappNumber: phoneId,
        whatsappEnabled: wpEnabled,
        notifyPhone: notifyPhone || undefined,
        offHoursMessage: wpOffMsg || undefined,
        whatsappSchedule: buildSchedulePayload(wpSchedEnabled, wpSchedTz, wpSchedWdEnabled, wpSchedWdStart, wpSchedWdEnd, wpSchedWeEnabled, wpSchedWeStart, wpSchedWeEnd),
      };
      if (wpToken.trim()) payload.whatsappToken = wpToken.trim();
      const updated = await updateAgent(agent.id, payload);
      setAgent(updated);
      setWpMsg('Guardado com sucesso!');
      setTimeout(() => setWpMsg(''), 3000);
    } catch {
      setWpMsg('Erro ao guardar.');
    } finally {
      setWpSaving(false);
    }
  };

  const handleSaveInstagram = async () => {
    if (!agent) return;
    setIgSaving(true);
    setIgMsg('');
    try {
      const payload: Record<string, unknown> = {
        instagramAccountId: igAccountId,
        instagramEnabled: igEnabled,
        notifyPhone: notifyPhone || undefined,
        instagramOffHoursMessage: igOffMsg || undefined,
        instagramSchedule: buildSchedulePayload(igSchedEnabled, igSchedTz, igSchedWdEnabled, igSchedWdStart, igSchedWdEnd, igSchedWeEnabled, igSchedWeStart, igSchedWeEnd),
      };
      const updated = await updateAgent(agent.id, payload);
      setAgent(updated);
      setIgMsg('Guardado com sucesso!');
      setTimeout(() => setIgMsg(''), 3000);
    } catch {
      setIgMsg('Erro ao guardar.');
    } finally {
      setIgSaving(false);
    }
  };

  const handleSaveTelegram = async () => {
    if (!agent) return;
    setTgSaving(true);
    setTgMsg('');
    try {
      const payload: Record<string, unknown> = {
        telegramEnabled: tgEnabled,
        telegramOffHoursMessage: tgOffMsg || undefined,
        telegramSchedule: buildSchedulePayload(tgSchedEnabled, tgSchedTz, tgSchedWdEnabled, tgSchedWdStart, tgSchedWdEnd, tgSchedWeEnabled, tgSchedWeStart, tgSchedWeEnd),
      };
      if (tgBotToken.trim()) payload.telegramBotToken = tgBotToken.trim();
      const updated = await updateAgent(agent.id, payload);
      setAgent(updated);
      setTgUsername(updated.telegramUsername ?? '');
      setTgBotTokenConfigured(updated.telegramBotTokenConfigured ?? false);
      setTgBotToken('');
      setTgMsg('✅ Guardado com sucesso!');
      setTimeout(() => setTgMsg(''), 3000);
    } catch (err: unknown) {
      const message = (err as { response?: { data?: { error?: string } } })?.response?.data?.error;
      setTgMsg(`❌ ${message ?? 'Erro ao guardar.'}`);
    } finally {
      setTgSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!agent) return;
    if (!confirm(`Eliminar agente "${agent.name}"?`)) return;
    await deleteAgent(agent.id);
    router.push(ROUTES.agents);
  };

  if (!tenant) return null;
  if (loading || !agent) {
    return (
      <AppLayout wide>
        <Head><title>Agente · Agentfy</title></Head>
        <div className="mb-6 space-y-3" aria-busy="true" aria-label="A carregar o agente">
          <Skeleton className="h-4 w-20" />
          <Skeleton className="h-7 w-72" />
          <Skeleton className="h-4 w-96 max-w-full" />
        </div>
        <Skeleton className="mb-5 h-8 w-full" />
        <Skeleton className="h-[106px] w-full rounded-xl" />
      </AppLayout>
    );
  }

  const handleToggleTestMode = async () => {
    if (agent.testMode) {
      if (!confirm('Ativar modo produção? Pagamentos passarão a ser reais e os agendamentos usarão a agenda real. Confirmas?')) return;
    }
    setTmSaving(true);
    try {
      const updated = await updateAgent(agent.id, { testMode: !agent.testMode });
      setAgent(updated);
    } catch { /* ignore */ }
    finally { setTmSaving(false); }
  };

  // ─── Dados derivados (só apresentação) ───
  const plan = (tenant.plan as string) ?? 'free';
  const modelList = AVAILABLE_MODELS_BY_PLAN[plan] ?? AVAILABLE_MODELS_BY_PLAN.free;
  const modelInfo = modelList.find((m) => m.value === agent.model);
  const planOrder = ['free', 'starter', 'business', 'enterprise'];
  const planIdx = planOrder.indexOf(plan);
  const isAdmin = !!tenant.isAdmin; // admins bypass all plan/addon gates (test mode)
  const planName = (p: string) => p[0].toUpperCase() + p.slice(1);

  const handleToggleSkill = async (field: string, current: boolean) => {
    setSkillsSaving(true); setSkillsMsg('');
    try {
      const updated = await updateAgent(agent.id, { [field]: !current });
      setAgent(updated);
      setSkillsMsg('Guardado!');
      setTimeout(() => setSkillsMsg(''), 2000);
    } catch { setSkillsMsg('Erro ao guardar.'); }
    finally { setSkillsSaving(false); }
  };

  const handleSaveIntegrations = async (patch: Record<string, unknown>) => {
    setIntSaving(true); setIntMsg('');
    try {
      const updated = await updateAgent(agent.id, patch);
      setAgent(updated);
      setIntMsg('Guardado!');
      setTimeout(() => setIntMsg(''), 2000);
    } catch { setIntMsg('Erro ao guardar.'); }
    finally { setIntSaving(false); }
  };

  type Sched = { enabled?: boolean; weekdays?: { start: string; end: string } | null; weekends?: { start: string; end: string } | null } | null | undefined;
  const scheduleText = (s: Sched) => {
    if (!s || !s.enabled) return 'Responde 24 horas por dia';
    const parts: string[] = [];
    if (s.weekdays) parts.push(`dias úteis ${s.weekdays.start}–${s.weekdays.end}`);
    if (s.weekends) parts.push(`fim de semana ${s.weekends.start}–${s.weekends.end}`);
    return parts.length ? `Responde ${parts.join(', ')}` : 'Horário sem dias definidos';
  };
  const a = agent as Agent & { whatsappSchedule?: Sched; instagramSchedule?: Sched; telegramSchedule?: Sched };

  type ChannelState = { key: TabKey; name: string; tone: 'pos' | 'neutral' | 'warn'; state: string; detail: string };
  const channels: ChannelState[] = [
    {
      key: 'whatsapp', name: 'WhatsApp',
      ...(agent.whatsappEnabled && agent.whatsappNumber
        ? { tone: !wpTokenOk && !agent.whatsappTokenConfigured ? 'warn' as const : 'pos' as const, state: !wpTokenOk && !agent.whatsappTokenConfigured ? 'Falta token' : 'Ligado', detail: scheduleText(a.whatsappSchedule) }
        : agent.whatsappNumber
          ? { tone: 'neutral' as const, state: 'Pausado', detail: 'Número associado, respostas desligadas' }
          : { tone: 'neutral' as const, state: 'Por ligar', detail: 'Ligue o número de WhatsApp Business' }),
    },
    {
      key: 'instagram', name: 'Instagram',
      ...(agent.instagramEnabled && agent.instagramAccountId
        ? { tone: 'pos' as const, state: 'Ligado', detail: scheduleText(a.instagramSchedule) }
        : agent.instagramAccountId
          ? { tone: 'neutral' as const, state: 'Pausado', detail: 'Conta associada, respostas desligadas' }
          : { tone: 'neutral' as const, state: 'Por ligar', detail: 'Responda às mensagens diretas' }),
    },
    {
      key: 'telegram', name: 'Telegram',
      ...(agent.telegramEnabled && agent.telegramBotTokenConfigured
        ? { tone: 'pos' as const, state: 'Ligado', detail: agent.telegramUsername ? `@${agent.telegramUsername} · ${scheduleText(a.telegramSchedule).toLowerCase()}` : scheduleText(a.telegramSchedule) }
        : agent.telegramBotTokenConfigured
          ? { tone: 'neutral' as const, state: 'Pausado', detail: agent.telegramUsername ? `@${agent.telegramUsername}, respostas desligadas` : 'Bot associado, respostas desligadas' }
          : { tone: 'neutral' as const, state: 'Por ligar', detail: 'Basta um bot criado no @BotFather' }),
    },
    {
      key: 'embed', name: 'Site',
      ...(agent.webChatEnabled
        ? { tone: 'pos' as const, state: 'Disponível', detail: 'Chat no seu site ou por link direto' }
        : { tone: 'neutral' as const, state: 'Desligado', detail: 'Chat no seu site ou por link direto' }),
    },
  ];
  const liveChannels = channels.filter((c) => c.tone === 'pos').length;

  const activeSkills = [
    agent.skillHandoff && 'Passar a uma pessoa',
    agent.skillDataCollection && 'Recolha de dados',
    agent.skillScheduling && 'Marcações',
    agent.skillFileUpload && 'Envio de ficheiros',
    agent.skillHumorDetection && 'Deteção de humor',
    agent.skillVendas && 'Vendas e pedidos',
    agent.ratingEnabled && 'Pedido de avaliação',
    agent.skillValidationEnabled && 'Só contactos aprovados',
  ].filter(Boolean) as string[];

  const needsReview = agent.needsReviewCount ?? 0;
  const gaps = agent.knowledgeGapCount ?? 0;
  const isChannelTab = CHANNEL_TABS.includes(activeTab);

  const TABS: { id: TabKey | 'channels'; label: string; count?: number }[] = [
    { id: 'overview', label: 'Visão geral' },
    { id: 'history', label: 'Conversas', count: needsReview > 0 ? needsReview : undefined },
    { id: 'leads', label: 'Leads' },
    { id: 'orders', label: 'Pedidos' },
    { id: 'knowledge', label: 'Conhecimento', count: gaps > 0 ? gaps : undefined },
    { id: 'channels', label: 'Canais' },
    { id: 'integrations', label: 'Automação' },
    { id: 'skills', label: 'Capacidades' },
    { id: 'edit', label: 'Configuração' },
  ];

  const origin = typeof window !== 'undefined' ? window.location.origin : 'https://app.agentfy.com';

  return (
    <AppLayout wide>
      <Head><title>{agent.name} · Agentfy</title></Head>

      {/* ─── Cabeçalho do objeto ─── */}
      <header className="mb-6">
        <Link href={ROUTES.agents} className="mb-2 inline-flex items-center gap-1 text-sm text-app-muted hover:text-app-ink">
          <span aria-hidden="true">←</span> Agentes
        </Link>
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="min-w-0 truncate text-xl font-semibold tracking-tight text-app-ink">{agent.name}</h1>
              <Pill tone={agent.isActive ? 'pos' : 'neutral'} dot>{agent.isActive ? 'A responder' : 'Pausado'}</Pill>
              {agent.testMode && <Pill tone="warn">Modo de teste</Pill>}
            </div>
            <p className="mt-1 text-sm text-app-muted">
              {agent.description || plain(modelInfo?.label ?? agent.model)}
              <span className="text-app-faint"> · </span>
              <span className="num">{liveChannels}</span> de {channels.length} canais ligados
            </p>
          </div>
          <div className="flex shrink-0 flex-wrap items-center gap-2">
            <button type="button" onClick={() => setActiveTab('chat')} className="btn-secondary">Testar agente</button>
            <button type="button" onClick={handleToggle} className="btn-secondary">{agent.isActive ? 'Pausar' : 'Retomar'}</button>
            <button type="button" onClick={handleDelete} className="btn-ghost text-app-neg hover:text-app-neg">Eliminar</button>
          </div>
        </div>
      </header>

      <Tabs<TabKey | 'channels'>
        label="Secções do agente"
        tabs={TABS}
        value={isChannelTab ? 'channels' : activeTab === 'docs' ? 'knowledge' : activeTab}
        onChange={(t) => setActiveTab(t === 'channels' ? (isChannelTab ? activeTab : 'whatsapp') : t)}
      />

      {/* ─── Visão geral ─── */}
      {activeTab === 'overview' && (
        <div className="space-y-6">
          <KpiStrip
            items={[
              { label: 'Conversas', value: int(agent.totalConversations ?? 0), caption: `${int(agent.totalMessages ?? 0)} mensagens trocadas` },
              { label: 'Resolvidas sem a equipa', value: `${Math.round((agent.averageResolution ?? 0) * 100)}%`, caption: 'Fechadas sem passar a uma pessoa' },
              {
                label: 'Avaliação média',
                value: agent.averageRating != null ? <>{agent.averageRating.toFixed(1).replace('.', ',')}<span className="text-base font-normal text-app-faint"> / 5</span></> : '—',
                caption: (agent.ratingCount ?? 0) > 0 ? `${int(agent.ratingCount ?? 0)} avaliaç${agent.ratingCount === 1 ? 'ão' : 'ões'}` : 'Ainda sem avaliações',
              },
              {
                label: 'Receita gerada',
                value: (agent.revenueGenerated ?? 0).toLocaleString('pt-PT', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }),
                caption: (agent.paidOrdersCount ?? 0) > 0 ? `${int(agent.paidOrdersCount ?? 0)} pedido${agent.paidOrdersCount === 1 ? '' : 's'} pago${agent.paidOrdersCount === 1 ? '' : 's'}` : 'Sem pedidos pagos',
              },
            ]}
          />

          {(needsReview > 0 || gaps > 0) && (
            <section className="rounded-xl border border-app-edge bg-app-sheet" aria-label="A precisar de atenção">
              <h2 className="px-5 pt-4 text-base font-semibold text-app-ink">A precisar de atenção</h2>
              <ul className="mt-2">
                {needsReview > 0 && (
                  <li className="flex flex-wrap items-center justify-between gap-3 border-t border-app-rule px-5 py-3">
                    <span className="text-sm text-app-ink">
                      <span className="num font-semibold text-app-warn">{int(needsReview)}</span> conversa{needsReview === 1 ? '' : 's'} sinalizada{needsReview === 1 ? '' : 's'} para revisão
                    </span>
                    <button type="button" onClick={() => setActiveTab('history')} className="text-sm font-semibold text-app-accent hover:underline">Rever conversas</button>
                  </li>
                )}
                {gaps > 0 && (
                  <li className="flex flex-wrap items-center justify-between gap-3 border-t border-app-rule px-5 py-3">
                    <span className="text-sm text-app-ink">
                      <span className="num font-semibold text-app-warn">{int(gaps)}</span> pergunta{gaps === 1 ? '' : 's'} a que o agente não soube responder
                    </span>
                    <button type="button" onClick={() => setActiveTab('knowledge')} className="text-sm font-semibold text-app-accent hover:underline">Completar conhecimento</button>
                  </li>
                )}
              </ul>
            </section>
          )}

          <div className="grid grid-cols-1 items-start gap-4 lg:grid-cols-[minmax(0,1fr)_400px]">
            {/* Canais: leitura num relance */}
            <section className="min-w-0 rounded-xl border border-app-edge bg-app-sheet">
              <div className="flex items-center justify-between gap-3 px-5 pt-4">
                <h2 className="text-base font-semibold text-app-ink">Canais</h2>
                <span className="text-sm text-app-muted"><span className="num">{liveChannels}</span> a responder</span>
              </div>
              <ul className="mt-2">
                {channels.map((c) => (
                  <li key={c.key} className="border-t border-app-rule">
                    <button type="button" onClick={() => setActiveTab(c.key)} className="flex w-full items-center gap-4 px-5 py-3.5 text-left transition-colors hover:bg-app-raised">
                      <span className={cx('h-2 w-2 shrink-0 rounded-full', c.tone === 'pos' ? 'bg-app-pos' : c.tone === 'warn' ? 'bg-app-warn' : 'bg-app-control')} aria-hidden="true" />
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm font-semibold text-app-ink">{c.name}</span>
                        <span className="block truncate text-xs text-app-muted">{c.detail}</span>
                      </span>
                      <Pill tone={c.tone}>{c.state}</Pill>
                      <span className="hidden text-sm text-app-faint sm:inline" aria-hidden="true">›</span>
                    </button>
                  </li>
                ))}
              </ul>
            </section>

            <div className="flex min-w-0 flex-col gap-4">
              <Panel title="Modelo" action={<button type="button" onClick={() => setActiveTab('edit')} className="font-semibold text-app-accent hover:underline">Alterar</button>}>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-sm font-semibold text-app-ink">{plain(modelInfo?.label ?? agent.model)}</span>
                  {modelInfo?.badge && <Pill tone="accent">{modelInfo.badge}</Pill>}
                </div>
                {modelInfo?.description && <p className="mt-1 text-sm text-app-muted">{modelInfo.description}</p>}
                <dl className="mt-4 grid grid-cols-2 gap-4 border-t border-app-rule pt-4">
                  <div><dt className="text-xs text-app-muted">Temperatura</dt><dd className="num mt-0.5 text-sm font-semibold text-app-ink">{agent.temperature}</dd></div>
                  <div><dt className="text-xs text-app-muted">Máx. tokens por resposta</dt><dd className="num mt-0.5 text-sm font-semibold text-app-ink">{int(agent.maxTokens)}</dd></div>
                </dl>
              </Panel>

              <Panel title="Capacidades ativas" action={<button type="button" onClick={() => setActiveTab('skills')} className="font-semibold text-app-accent hover:underline">Gerir</button>}>
                {activeSkills.length ? (
                  <ul className="flex flex-wrap gap-2">
                    {activeSkills.map((s) => <li key={s}><Pill>{s}</Pill></li>)}
                  </ul>
                ) : (
                  <p className="text-sm text-app-muted">Nenhuma ligada. O agente só conversa e responde a perguntas.</p>
                )}
              </Panel>
            </div>
          </div>

          <Panel title="Instruções do agente" action={<button type="button" onClick={() => setActiveTab('edit')} className="font-semibold text-app-accent hover:underline">Editar</button>}>
            {agent.systemPrompt ? (
              <pre className="max-h-80 overflow-y-auto whitespace-pre-wrap font-sans text-sm leading-relaxed text-app-ink">{agent.systemPrompt}</pre>
            ) : (
              <EmptyState title="Ainda sem instruções." body="Diga ao agente como falar com os clientes, o que vende e o que deve evitar." />
            )}
          </Panel>
        </div>
      )}

      {/* ─── Testar ─── */}
      {activeTab === 'chat' && (
        <div className="max-w-3xl">
          <p className="mb-4 text-sm text-app-muted">Fale com o agente como se fosse um cliente. As conversas de teste não chegam aos canais.</p>
          <ChatWidget agentId={agent.id} tenantId={tenant.id} />
        </div>
      )}

      {/* ─── Capacidades ─── */}
      {activeTab === 'skills' && (() => {
        const SKILLS_DEF = [
          { key: 'skillHandoff',        label: 'Passar a uma pessoa', desc: 'Transfere a conversa para alguém da equipa, com um resumo do que já foi dito.', minPlan: 'free',    field: 'skillHandoff',        addonPrice: null as string | null },
          { key: 'skillDataCollection', label: 'Recolha de dados',    desc: 'Pede nome, contacto e outros dados ao cliente durante a conversa.',            minPlan: 'free',    field: 'skillDataCollection', addonPrice: null },
          { key: 'skillScheduling',     label: 'Marcações',           desc: 'Marca mesas, consultas ou serviços sem intervenção da equipa.',                minPlan: 'starter', field: 'skillScheduling',     addonPrice: '€7/mês' },
          { key: 'skillFileUpload',     label: 'Envio de ficheiros',  desc: 'Envia a ementa, tabela de preços ou catálogo quando o cliente pede.',          minPlan: 'starter', field: 'skillFileUpload',     addonPrice: '€8/mês' },
          { key: 'skillHumorDetection', label: 'Deteção de humor',    desc: 'Percebe quando o cliente está irritado e ajusta o tom.',                       minPlan: 'starter', field: 'skillHumorDetection', addonPrice: '€9/mês' },
        ];

        const MB_WAY: Record<string, { monthly: string | null; credits: string | null }> = {
          free:       { monthly: null,          credits: null },
          starter:    { monthly: '+€15/mês',  credits: '50 crd/transação' },
          business:   { monthly: 'Incluído',   credits: '20 crd/transação' },
          enterprise: { monthly: 'Incluído',   credits: '10 crd/transação' },
        };
        const mbway = MB_WAY[plan] ?? MB_WAY.free;
        const mbwayAvail = mbway.monthly !== null;

        const wlIncl = isAdmin || planIdx >= planOrder.indexOf('enterprise');
        const wlAddon = plan === 'starter' ? '€5/mês' : plan === 'business' ? '€3/mês' : null;
        const wlAvail = isAdmin || wlIncl || wlAddon !== null;
        const wlActive = agent.whitelabelEnabled;
        const wlUrl = `${origin}/w/${agent.id}`;

        const vendasActive = agent.skillVendas;
        const vendasAvail = isAdmin || planIdx >= planOrder.indexOf('starter');
        const vendasPrice = plan === 'enterprise' ? '€15' : plan === 'business' ? '€20' : '€25';

        const fbIncl = isAdmin || planIdx >= planOrder.indexOf('business');
        const fbActive = !!agent.ratingEnabled;

        const linkCls = 'text-sm font-semibold text-app-accent hover:underline';
        const SkillRow = ({ label, tags, desc, control, extra }: { label: string; tags?: ReactNode; desc: ReactNode; control: ReactNode; extra?: ReactNode }) => (
          <li className="flex items-start gap-4 border-t border-app-rule py-4 first:border-t-0 first:pt-0">
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <span className="text-sm font-semibold text-app-ink">{label}</span>
                {tags}
              </div>
              <p className="mt-1 text-sm text-app-muted">{desc}</p>
              {extra && <div className="mt-2 flex flex-wrap gap-x-4 gap-y-1">{extra}</div>}
            </div>
            {control}
          </li>
        );

        return (
          <div className="max-w-5xl">
            <SettingsRow
              title="Modo"
              aside={<Pill tone={agent.testMode ? 'warn' : 'pos'}>{agent.testMode ? 'Teste' : 'Produção'}</Pill>}
              description={agent.testMode
                ? 'Pagamentos em sandbox e marcações na agenda de testes. Nada do que o agente faz é real.'
                : 'Pagamentos reais e agenda real. Confirme que tudo está bem configurado.'}
            >
              <button type="button" onClick={handleToggleTestMode} disabled={tmSaving} className="btn-secondary">
                {tmSaving ? 'A guardar…' : agent.testMode ? 'Passar a produção' : 'Voltar ao modo de teste'}
              </button>
            </SettingsRow>

            <SettingsRow title="Observação ao vivo" description="Veja as conversas a decorrer, atualizadas de 5 em 5 segundos. Só leitura.">
              <button type="button" onClick={() => router.push(`/dashboard/agents/${agent.id}/observe`)} className="btn-secondary">Abrir observação</button>
            </SettingsRow>

            <SettingsRow
              title="Capacidades"
              description={<>Ligue ou desligue o que o agente pode fazer. As alterações guardam-se logo.{skillsMsg && <StatusLine msg={skillsMsg} className="mt-3" />}</>}
            >
              <ul className="rounded-xl border border-app-edge px-5 py-4">
                {SKILLS_DEF.map((sk) => {
                  const minIdx = planOrder.indexOf(sk.minPlan);
                  const locked = !isAdmin && planIdx < minIdx;
                  const active = !!((agent as unknown as Record<string, unknown>)[sk.field]);
                  return (
                    <SkillRow
                      key={sk.key}
                      label={sk.label}
                      tags={<>
                        {sk.minPlan === 'free' && <Pill>Grátis</Pill>}
                        {locked && sk.addonPrice && <Pill tone="warn">Extra {sk.addonPrice}</Pill>}
                        {locked && !sk.addonPrice && <Pill>{planName(sk.minPlan)}+</Pill>}
                        {!locked && sk.minPlan !== 'free' && <Pill>{planName(sk.minPlan)}+</Pill>}
                      </>}
                      desc={sk.desc}
                      control={<Switch checked={active} locked={locked} disabled={skillsSaving} onChange={() => handleToggleSkill(sk.field, active)} label={(active ? 'Desativar ' : 'Ativar ') + sk.label} />}
                      extra={locked ? (
                        sk.addonPrice
                          ? <button type="button" onClick={() => router.push('/dashboard/plans')} className={linkCls}>Ativar extra {sk.addonPrice}</button>
                          : <button type="button" onClick={() => router.push('/dashboard/plans')} className={linkCls}>Mudar para {sk.minPlan}</button>
                      ) : undefined}
                    />
                  );
                })}

                <SkillRow
                  label="Pagamentos MB Way"
                  tags={<>
                    {!mbwayAvail && <Pill>Starter+</Pill>}
                    {mbwayAvail && mbway.monthly !== 'Incluído' && <Pill tone="warn">{mbway.monthly}</Pill>}
                    {mbwayAvail && mbway.monthly === 'Incluído' && <Pill>Incluído</Pill>}
                    {mbwayAvail && mbway.credits && <Pill>{mbway.credits}</Pill>}
                  </>}
                  desc="Cobra por MB Way dentro da conversa. Mensalidade mais créditos por transação."
                  control={<Switch checked={mbwayAvail} locked={!isAdmin && !mbwayAvail} disabled={!isAdmin && !mbwayAvail} onChange={() => { if (!mbwayAvail && !isAdmin) router.push('/dashboard/plans'); }} label="Pagamentos MB Way" />}
                  extra={!mbwayAvail ? <button type="button" onClick={() => router.push('/dashboard/plans')} className={linkCls}>Ativar no Starter+</button> : undefined}
                />

                <SkillRow
                  label="Vendas, entregas e cozinha"
                  tags={<>
                    {!vendasAvail && <Pill>Starter+</Pill>}
                    {vendasAvail && <Pill tone="warn">Extra +{vendasPrice}/mês</Pill>}
                  </>}
                  desc="Trata o cliente pelo nome, sugere o habitual a quem volta e propõe acompanhamentos. Inclui o ecrã da cozinha em tempo real."
                  control={<Switch checked={vendasActive} locked={!vendasAvail} disabled={skillsSaving || !vendasAvail} onChange={() => handleToggleSkill('skillVendas', vendasActive)} label={vendasActive ? 'Desativar Vendas' : 'Ativar Vendas'} />}
                  extra={<>
                    {!vendasAvail && <button type="button" onClick={() => router.push('/dashboard/plans')} className={linkCls}>Mudar para Starter+</button>}
                    {vendasAvail && !vendasActive && <button type="button" onClick={() => router.push('/dashboard/plans')} className={linkCls}>Ativar extra +{vendasPrice}/mês</button>}
                    {vendasActive && <button type="button" onClick={() => setActiveTab('orders')} className={linkCls}>Ver pedidos</button>}
                    {vendasActive && <a href="/dashboard/orders/live" target="_blank" rel="noopener noreferrer" className="text-sm text-app-muted hover:text-app-ink hover:underline">Ecrã da cozinha ↗</a>}
                  </>}
                />

                <SkillRow
                  label="Página com a sua marca"
                  tags={<>
                    {!wlAvail && <Pill>Starter+</Pill>}
                    {wlAvail && !wlIncl && wlAddon && <Pill tone="warn">Extra {wlAddon} por agente</Pill>}
                    {wlIncl && <Pill>Incluído</Pill>}
                  </>}
                  desc="Página pública do agente com o nome e as cores do negócio, sem a marca Agentfy."
                  control={<Switch checked={wlActive} locked={!wlAvail} disabled={skillsSaving || !wlAvail} onChange={() => handleToggleSkill('whitelabelEnabled', wlActive)} label={wlActive ? 'Desativar White-label' : 'Ativar White-label'} />}
                  extra={<>
                    {wlActive && <a href={wlUrl} target="_blank" rel="noopener noreferrer" className="break-all font-mono text-sm text-app-accent hover:underline">{wlUrl} ↗</a>}
                    {wlAvail && !wlIncl && !wlActive && <button type="button" onClick={() => router.push('/dashboard/plans')} className={linkCls}>Ativar extra por {wlAddon}/agente</button>}
                    {!wlAvail && <button type="button" onClick={() => router.push('/dashboard/plans')} className={linkCls}>Mudar para Starter+</button>}
                  </>}
                />

                <SkillRow
                  label="Pedido de avaliação"
                  tags={<>
                    {!fbIncl && <Pill tone="warn">Extra €4/mês</Pill>}
                    {fbIncl && <Pill>Incluído</Pill>}
                  </>}
                  desc="Quando a conversa fecha, o agente pede uma nota de 1 a 5 ao cliente. As notas aparecem nas Conversas."
                  control={<Switch checked={fbActive} disabled={skillsSaving} onChange={() => handleToggleSkill('ratingEnabled', fbActive)} label={fbActive ? 'Desativar Recolha de Feedback' : 'Ativar Recolha de Feedback'} />}
                  extra={!fbIncl && !fbActive ? <button type="button" onClick={() => router.push('/dashboard/plans')} className={linkCls}>Ativar extra €4/mês</button> : undefined}
                />

                {/* Validação: allow-list de contactos aprovados (WhatsApp + Telegram) */}
                <AgentValidation agent={agent} onAgentUpdate={setAgent} />
              </ul>
            </SettingsRow>

            {planIdx < planOrder.indexOf('business') && (
              <SettingsRow title="Extras e planos" description="Ative capacidades uma a uma como extras mensais, ou mude de plano para as ter todas incluídas.">
                <button type="button" onClick={() => router.push('/dashboard/plans')} className="btn-secondary">Ver planos e extras</button>
              </SettingsRow>
            )}
          </div>
        );
      })()}

      {/* ─── Configuração ─── */}
      {activeTab === 'edit' && (
        <div className="max-w-5xl">
          <SettingsRow title="Identidade" description="O nome aparece na lista de agentes e pode ser usado pelo agente para se apresentar.">
            <div className="space-y-4">
              <Field label="Nome" htmlFor="agName">
                <input id="agName" className="input" value={editForm.name ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, name: e.target.value }))} />
              </Field>
              <Field label="Descrição" hint="Só para a equipa. Ex.: Encomendas e reservas pelo WhatsApp." htmlFor="agDesc">
                <input id="agDesc" className="input" value={editForm.description ?? ''} onChange={(e) => setEditForm((f) => ({ ...f, description: e.target.value }))} />
              </Field>
            </div>
          </SettingsRow>

          <SettingsRow
            title="Instruções"
            description={<>
              Como o agente fala, o que vende, horários, regras da casa. Escreva como explicaria a um funcionário novo.
              <button type="button" onClick={() => router.push('/dashboard/prompts')} className="mt-2 block font-semibold text-app-accent hover:underline">Ver biblioteca de instruções</button>
            </>}
          >
            <textarea
              aria-label="Instruções do agente"
              className="input min-h-[22rem] resize-y font-sans leading-relaxed"
              rows={16}
              value={editForm.systemPrompt ?? ''}
              onChange={(e) => setEditForm((f) => ({ ...f, systemPrompt: e.target.value }))}
            />
            <p className="num mt-1 text-right text-xs text-app-faint">{int((editForm.systemPrompt ?? '').length)} caracteres</p>
          </SettingsRow>

          <SettingsRow title="Modelo de IA" description="O Automático escolhe o modelo mais adequado a cada conversa. Os modelos maiores gastam mais créditos.">
            <div className="overflow-hidden rounded-xl border border-app-edge">
              {modelList.map((m, i) => {
                const sel = editForm.model === m.value;
                return (
                  <label key={m.value} className={cx('flex cursor-pointer items-start gap-3 px-4 py-3 transition-colors', i > 0 && 'border-t border-app-rule', sel ? 'bg-app-accent-soft' : 'hover:bg-app-raised')}>
                    <input type="radio" name="model" className="mt-1 shrink-0 accent-app-accent" checked={sel} onChange={() => setEditForm((f) => ({ ...f, model: m.value }))} />
                    <span className="min-w-0 flex-1">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-sm font-semibold text-app-ink">{plain(m.label)}</span>
                        {m.badge && <Pill tone="accent">{m.badge}</Pill>}
                      </span>
                      <span className="mt-0.5 block text-sm text-app-muted">{m.description}</span>
                    </span>
                  </label>
                );
              })}
            </div>
          </SettingsRow>

          <SettingsRow title="Estilo de resposta" description="Temperatura baixa dá respostas mais previsíveis; alta, mais variadas. O máximo de tokens limita o comprimento de cada resposta.">
            <div className="grid gap-5 sm:grid-cols-2">
              <Field label={<>Temperatura <span className="num font-normal text-app-muted">{editForm.temperature ?? agent.temperature}</span></>} htmlFor="agTemp">
                <input
                  id="agTemp"
                  type="range" min="0" max="2" step="0.1"
                  value={editForm.temperature ?? agent.temperature}
                  onChange={(e) => setEditForm((f) => ({ ...f, temperature: parseFloat(e.target.value) }))}
                  className="mt-2 w-full accent-app-accent"
                />
                <div className="mt-0.5 flex justify-between text-xs text-app-faint"><span>Preciso</span><span>Criativo</span></div>
              </Field>
              <Field label="Máx. tokens" htmlFor="agTokens">
                <select id="agTokens" className="input h-auto py-2" value={editForm.maxTokens ?? agent.maxTokens} onChange={(e) => setEditForm((f) => ({ ...f, maxTokens: parseInt(e.target.value) }))}>
                  {[500, 1000, 2000, 4000, 8000].map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </Field>
            </div>
          </SettingsRow>

          <SaveBar status={error ? <StatusLine msg={`❌ ${error}`} /> : undefined}>
            <button type="button" className="btn-secondary" onClick={() => setActiveTab('overview')}>Cancelar</button>
            <button type="button" className="btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'A guardar…' : 'Guardar alterações'}</button>
          </SaveBar>
        </div>
      )}

      {/* ─── Conhecimento ─── */}
      {(activeTab === 'knowledge' || activeTab === 'docs') && agent && (
        <div className="space-y-10">
          <KnowledgeBase agentId={agent.id} />
          {/* ─── Documentos enviáveis ─── */}
          <div className="border-t border-app-rule pt-8">
            <AgentDocs agentId={agent.id} />
          </div>
        </div>
      )}

      {/* ─── Pedidos ─── */}
      {activeTab === 'orders' && agent && (
        <div className="space-y-6">
          <section className="grid overflow-hidden rounded-xl border border-app-edge bg-app-sheet md:grid-cols-2">
            <div className="p-5">
              <h2 className="text-sm font-semibold text-app-ink">Ecrã da cozinha (com sessão)</h2>
              <p className="mt-1 text-sm text-app-muted">Para si e para a equipa: mover pedidos entre estados e filtrar por agente.</p>
              <a href="/dashboard/orders/live" target="_blank" rel="noopener noreferrer" className="mt-3 inline-block text-sm font-semibold text-app-accent hover:underline">Abrir ecrã da cozinha ↗</a>
            </div>
            <div className="border-t border-app-rule p-5 md:border-l md:border-t-0">
              <h2 className="text-sm font-semibold text-app-ink">Ecrã da cozinha (sem sessão)</h2>
              <p className="mb-3 mt-1 text-sm text-app-muted">Abra num tablet na cozinha ou no balcão. Não pede login.</p>
              <CopyBox value={`${origin}/orders/${agent.id}`} label="Link público" />
            </div>
          </section>
          <Orders agentId={agent.id} plan={tenant.plan ?? 'free'} />
        </div>
      )}

      {/* ─── Canais ─── */}
      {isChannelTab && (
        <div className="grid grid-cols-1 gap-6 md:grid-cols-[220px_minmax(0,1fr)] lg:gap-10">
          <nav aria-label="Canais" className="-mx-1 flex gap-1 overflow-x-auto md:mx-0 md:flex-col">
            {channels.map((c) => {
              const on = activeTab === c.key;
              return (
                <button
                  key={c.key}
                  type="button"
                  onClick={() => setActiveTab(c.key)}
                  aria-current={on ? 'page' : undefined}
                  className={cx('flex shrink-0 items-center gap-3 rounded-lg px-3 py-2.5 text-left transition-colors', on ? 'bg-app-raised' : 'hover:bg-app-raised')}
                >
                  <span className={cx('h-2 w-2 shrink-0 rounded-full', c.tone === 'pos' ? 'bg-app-pos' : c.tone === 'warn' ? 'bg-app-warn' : 'bg-app-control')} aria-hidden="true" />
                  <span className="min-w-0">
                    <span className={cx('block text-sm', on ? 'font-semibold text-app-ink' : 'font-medium text-app-ink')}>{c.name}</span>
                    <span className="block whitespace-nowrap text-xs text-app-muted">{c.state}</span>
                  </span>
                </button>
              );
            })}
          </nav>

          <div className="min-w-0">
            {/* ─── Site ─── */}
            {activeTab === 'embed' && (() => {
              const chatUrl = `${origin}/chat/${agent.id}`;
              const iframe = `<iframe\n  src="${chatUrl}"\n  width="420"\n  height="600"\n  style="border:none; border-radius:16px; box-shadow:0 4px 24px rgba(0,0,0,.15);"\n  title="${agent.name}"\n></iframe>`;
              const widget = `<!-- Agentfy Chat Widget -->\n<script>\n(function(){\n  var btn=document.createElement('div');\n  btn.style='position:fixed;bottom:24px;right:24px;width:56px;height:56px;border-radius:50%;background:#6d28d9;cursor:pointer;display:flex;align-items:center;justify-content:center;box-shadow:0 4px 16px rgba(0,0,0,.2);z-index:9999';\n  btn.innerHTML='<svg width=28 height=28 fill=none viewBox=\"0 0 24 24\"><path fill=#fff d=\"M12 2a10 10 0 0 1 10 10c0 5.52-4.48 10-10 10a9.96 9.96 0 0 1-5.06-1.37L2 22l1.38-4.88A9.96 9.96 0 0 1 2 12 10 10 0 0 1 12 2Z\"/></svg>';\n  var frame=document.createElement('iframe');\n  frame.src='${chatUrl}';\n  frame.style='position:fixed;bottom:96px;right:24px;width:420px;height:600px;border:none;border-radius:16px;box-shadow:0 8px 32px rgba(0,0,0,.18);z-index:9998;display:none';\n  var open=false;\n  btn.onclick=function(){open=!open;frame.style.display=open?'block':'none';btn.style.background=open?'#4c1d95':'#6d28d9';};\n  document.body.appendChild(frame);\n  document.body.appendChild(btn);\n})();\n</script>`;
              return (
                <div>
                  <SettingsRow title="Link direto" description="Partilhe no Instagram, no Google ou num QR code na mesa.">
                    <CopyBox value={chatUrl} label="Link do chat" />
                    <a href={chatUrl} target="_blank" rel="noopener noreferrer" className="btn-secondary mt-3">Abrir noutro separador ↗</a>
                  </SettingsRow>
                  <SettingsRow title="Botão flutuante" aside={<Pill tone="accent">Recomendado</Pill>} description={<>Cole antes de <Code>&lt;/body&gt;</Code>. Aparece como um botão redondo no canto inferior direito do site.</>}>
                    <CopyBox value={widget} label="Código JavaScript" />
                  </SettingsRow>
                  <SettingsRow title="Janela embutida" description="Cole este HTML no sítio da página onde quer o chat.">
                    <CopyBox value={iframe} label="Código HTML" />
                  </SettingsRow>
                  <SettingsRow title="Onde colar" description="Os construtores de sites mais comuns.">
                    <dl className="space-y-3 text-sm">
                      <div><dt className="font-semibold text-app-ink">WordPress</dt><dd className="text-app-muted">Plugin WPCode, com o código do botão flutuante.</dd></div>
                      <div><dt className="font-semibold text-app-ink">Shopify</dt><dd className="text-app-muted">Online Store → Themes → Edit code → theme.liquid, antes de <Code>&lt;/body&gt;</Code>.</dd></div>
                      <div><dt className="font-semibold text-app-ink">Wix / Squarespace</dt><dd className="text-app-muted">Bloco “HTML Embed” com o código da janela embutida.</dd></div>
                    </dl>
                  </SettingsRow>
                </div>
              );
            })()}

            {/* ─── WhatsApp ─── */}
            {activeTab === 'whatsapp' && (
              <div>
                <SettingsRow
                  title="Ligação"
                  aside={<Pill tone={channels[0].tone}>{channels[0].state}</Pill>}
                  description="Entre com a conta Meta do negócio e escolha o número de WhatsApp Business. Não é preciso copiar tokens."
                >
                  <div className="space-y-4">
                    {agent.whatsappNumber && <p className="text-sm text-app-muted">Phone Number ID <span className="num font-mono text-app-ink">{agent.whatsappNumber}</span></p>}
                    <StatusLine msg={esMsg} />
                    <button type="button" onClick={launchWhatsAppSignup} disabled={esConnecting} className={agent.whatsappNumber ? 'btn-secondary' : 'btn-primary'}>
                      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true"><path d="M24 12.073c0-6.627-5.373-12-12-12s-12 5.373-12 12c0 5.99 4.388 10.954 10.125 11.854v-8.385H7.078v-3.47h3.047V9.43c0-3.007 1.792-4.669 4.533-4.669 1.312 0 2.686.235 2.686.235v2.953H15.83c-1.491 0-1.956.925-1.956 1.874v2.25h3.328l-.532 3.47h-2.796v8.385C19.612 23.027 24 18.062 24 12.073z"/></svg>
                      {esConnecting ? 'A ligar…' : agent.whatsappNumber ? 'Voltar a ligar com a Meta' : 'Continuar com Facebook'}
                    </button>
                    <ManualSetup>
                      <Step n={1} title="Conta Meta for Developers">
                        <ol className="list-inside list-decimal space-y-1.5">
                          <li>Em <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" className="text-app-accent underline">developers.facebook.com</a>, crie uma app do tipo <strong className="text-app-ink">Business</strong>.</li>
                          <li>Adicione o produto <strong className="text-app-ink">WhatsApp</strong> à app.</li>
                          <li>Em <em>WhatsApp → Getting Started</em>, copie o <strong className="text-app-ink">Phone Number ID</strong> (número longo, não é o telefone).</li>
                          <li>Gere um <strong className="text-app-ink">Access Token</strong> (temporário para testes ou permanente via System User).</li>
                        </ol>
                      </Step>
                      <Step n={2} title="Webhook no Meta">
                        <p>Em <em>WhatsApp → Configuration → Webhook</em>:</p>
                        <CopyBox value={WEBHOOK_URL} label="Callback URL" />
                        <CopyBox value="agentify_whatsapp_verify_2025" label="Verify Token" />
                        <p className="text-xs text-app-faint">Subscreva o campo <Code>messages</Code>.</p>
                      </Step>
                      <Step n={3} title="Ligar este agente">
                        <Field label="Phone Number ID" hint="ID numérico do Meta." htmlFor="wpPhoneId">
                          <input id="wpPhoneId" className="input" placeholder="ex: 123456789012345" value={phoneId} onChange={(e) => setPhoneId(e.target.value)} />
                        </Field>
                        <Field label="Token deste agente" hint="Opcional. Use quando o número pertence a uma conta Meta diferente da principal. Gera-se em Meta for Developers → App → WhatsApp → API Setup." htmlFor="wpToken">
                          <div className="relative">
                            <input
                              id="wpToken"
                              className="input pr-20"
                              type={wpTokenVisible ? 'text' : 'password'}
                              placeholder={agent?.whatsappTokenConfigured ? '••••••••  (já configurado; deixe vazio para manter)' : 'EAAxxxxxxx… (Access Token do Meta)'}
                              value={wpToken}
                              onChange={(e) => setWpToken(e.target.value)}
                              autoComplete="off"
                            />
                            <button type="button" onClick={() => setWpTokenVisible(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 px-1 text-xs font-semibold text-app-muted hover:text-app-ink">
                              {wpTokenVisible ? 'Ocultar' : 'Mostrar'}
                            </button>
                          </div>
                        </Field>
                        <p className="text-xs text-app-faint">O ID e o token guardam-se com o botão “Guardar alterações” no fim da página.</p>
                      </Step>
                      <Step n={4} title="Ativar o número na Meta">
                        <p>Depois de verificar o número no WhatsApp Manager, falta ativá-lo pela API. Sem este passo fica “pending” para sempre.</p>
                        <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                          <div className="flex-1">
                            <Field label="PIN de 6 dígitos" hint="Escolha livremente: passa a ser a verificação em dois passos do número." htmlFor="wpPin">
                              <input
                                id="wpPin"
                                className="input num"
                                type="password"
                                inputMode="numeric"
                                maxLength={6}
                                placeholder="123456"
                                value={wpRegPin}
                                onChange={(e) => setWpRegPin(e.target.value.replace(/\D/g, '').slice(0, 6))}
                                autoComplete="off"
                              />
                            </Field>
                          </div>
                          <button type="button" onClick={handleRegisterWhatsApp} disabled={wpRegSaving || wpRegPin.length !== 6} className="btn-secondary sm:mb-6">
                            {wpRegSaving ? 'A registar…' : 'Registar número'}
                          </button>
                        </div>
                        <StatusLine msg={wpRegMsg} />
                      </Step>
                    </ManualSetup>
                  </div>
                </SettingsRow>

                <SettingsRow title="Respostas automáticas" description="Com isto desligado o número continua ligado, mas o agente não responde.">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm text-app-ink">{wpEnabled ? 'O agente responde no WhatsApp' : 'Desligadas'}</span>
                    <Switch checked={wpEnabled} onChange={() => setWpEnabled((v) => !v)} label="Respostas no WhatsApp" />
                  </div>
                </SettingsRow>

                <SettingsRow title="Avisos para o dono" description="Número de WhatsApp que recebe um alerta a cada pedido pago.">
                  <input aria-label="Número de notificação" className="input num" placeholder="ex: 351912345678" value={notifyPhone} onChange={(e) => setNotifyPhone(e.target.value)} />
                </SettingsRow>

                <SettingsRow title="Horário" description="Ponha o agente a atender só quando a casa está fechada, ou só em certas horas.">
                  <ScheduleFields
                    idPrefix="wp"
                    enabled={wpSchedEnabled} setEnabled={setWpSchedEnabled}
                    tz={wpSchedTz} setTz={setWpSchedTz}
                    wdEnabled={wpSchedWdEnabled} setWdEnabled={setWpSchedWdEnabled}
                    wdStart={wpSchedWdStart} setWdStart={setWpSchedWdStart}
                    wdEnd={wpSchedWdEnd} setWdEnd={setWpSchedWdEnd}
                    weEnabled={wpSchedWeEnabled} setWeEnabled={setWpSchedWeEnabled}
                    weStart={wpSchedWeStart} setWeStart={setWpSchedWeStart}
                    weEnd={wpSchedWeEnd} setWeEnd={setWpSchedWeEnd}
                    offMsg={wpOffMsg} setOffMsg={setWpOffMsg}
                  />
                </SettingsRow>

                <SaveBar status={<StatusLine msg={wpMsg} />}>
                  <button type="button" onClick={handleSaveWhatsApp} disabled={wpSaving} className="btn-primary">
                    {wpSaving ? 'A guardar…' : 'Guardar alterações'}
                  </button>
                </SaveBar>
              </div>
            )}

            {/* ─── Instagram ─── */}
            {activeTab === 'instagram' && (
              <div>
                <SettingsRow
                  title="Ligação"
                  aside={<Pill tone={channels[1].tone}>{channels[1].state}</Pill>}
                  description="Entre com a conta de Instagram profissional (Business ou Creator). Não precisa de Página do Facebook."
                >
                  <div className="space-y-4">
                    {agent.instagramAccountId && <p className="text-sm text-app-muted">Conta <span className="num font-mono text-app-ink">{agent.instagramAccountId}</span></p>}
                    <StatusLine msg={igMsg} />
                    <button type="button" onClick={handleInstagramConnect} disabled={igConnecting} className={agent.instagramAccountId ? 'btn-secondary' : 'btn-primary'}>
                      <svg viewBox="0 0 24 24" className="h-4 w-4 fill-current" aria-hidden="true"><path d="M12 2.163c3.204 0 3.584.012 4.85.07 3.252.148 4.771 1.691 4.919 4.919.058 1.265.069 1.645.069 4.849 0 3.205-.012 3.584-.069 4.849-.149 3.225-1.664 4.771-4.919 4.919-1.266.058-1.644.07-4.85.07-3.204 0-3.584-.012-4.849-.07-3.26-.149-4.771-1.699-4.919-4.92-.058-1.265-.07-1.644-.07-4.849 0-3.204.013-3.583.07-4.849.149-3.227 1.664-4.771 4.919-4.919 1.266-.057 1.645-.069 4.849-.069zM12 0C8.741 0 8.333.014 7.053.072 2.695.272.273 2.69.073 7.052.014 8.333 0 8.741 0 12c0 3.259.014 3.668.072 4.948.2 4.358 2.618 6.78 6.98 6.98C8.333 23.986 8.741 24 12 24c3.259 0 3.668-.014 4.948-.072 4.354-.2 6.782-2.618 6.979-6.98.059-1.28.073-1.689.073-4.948 0-3.259-.014-3.667-.072-4.947-.196-4.354-2.617-6.78-6.979-6.98C15.668.014 15.259 0 12 0zm0 5.838a6.162 6.162 0 1 0 0 12.324 6.162 6.162 0 0 0 0-12.324zM12 16a4 4 0 1 1 0-8 4 4 0 0 1 0 8zm6.406-11.845a1.44 1.44 0 1 0 0 2.881 1.44 1.44 0 0 0 0-2.881z"/></svg>
                      {igConnecting ? 'A redirecionar…' : agent.instagramAccountId ? 'Voltar a ligar o Instagram' : 'Continuar com Instagram'}
                    </button>
                    <ManualSetup>
                      <Step n={1} title="Conta Meta for Developers">
                        <ol className="list-inside list-decimal space-y-1.5">
                          <li>Em <a href="https://developers.facebook.com" target="_blank" rel="noopener noreferrer" className="text-app-accent underline">developers.facebook.com</a>, crie (ou use) uma app do tipo <strong className="text-app-ink">Business</strong>.</li>
                          <li>Adicione o produto <strong className="text-app-ink">Instagram</strong> (API setup with Instagram Login). Não precisa de Página do Facebook.</li>
                          <li>Ligue a conta <strong className="text-app-ink">Instagram Business ou Creator</strong> ao produto.</li>
                          <li>Copie o <strong className="text-app-ink">Instagram Account ID</strong> (ex.: 17841400008460056), ou use o botão acima, que o preenche sozinho.</li>
                          <li>O token de acesso também vem pelo botão acima e renova-se a cada 60 dias.</li>
                        </ol>
                      </Step>
                      <Step n={2} title="Webhook no Meta">
                        <p>Em <em>Instagram → Webhooks</em>:</p>
                        <CopyBox value={INSTAGRAM_WEBHOOK_URL} label="Callback URL" />
                        <CopyBox value="agentify_instagram_verify_2025" label="Verify Token" />
                        <p className="text-xs text-app-faint">Subscreva o campo <Code>messages</Code>.</p>
                        <p className="rounded-lg bg-app-warn-soft px-3 py-2 text-sm text-app-warn">Para receber mensagens diretas, a app Meta tem de estar em modo <strong>Live</strong> e com a permissão <Code>instagram_business_manage_messages</Code> aprovada.</p>
                      </Step>
                      <Step n={3} title="Ligar este agente">
                        <Field label="Instagram Account ID" hint="O token é sempre gerido pelo botão “Continuar com Instagram”, para não ser trocado por engano por um token incompatível." htmlFor="igAcc">
                          <input id="igAcc" className="input" placeholder="ex: 17841400008460056" value={igAccountId} onChange={(e) => setIgAccountId(e.target.value)} />
                        </Field>
                      </Step>
                    </ManualSetup>
                  </div>
                </SettingsRow>

                <SettingsRow title="Respostas automáticas" description="Com isto desligado a conta continua ligada, mas o agente não responde.">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm text-app-ink">{igEnabled ? 'O agente responde no Instagram' : 'Desligadas'}</span>
                    <Switch checked={igEnabled} onChange={() => setIgEnabled((v) => !v)} label="Respostas no Instagram" />
                  </div>
                </SettingsRow>

                <SettingsRow title="Avisos para o dono" description="Quando o agente passa a conversa a uma pessoa, envia o resumo por WhatsApp para este número. Também recebe os pedidos.">
                  <input aria-label="Número de notificação WhatsApp" className="input num" placeholder="ex: 351912345678" value={notifyPhone} onChange={(e) => setNotifyPhone(e.target.value)} />
                </SettingsRow>

                <SettingsRow title="Horário" description="Ponha o agente a atender só quando a casa está fechada, ou só em certas horas.">
                  <ScheduleFields
                    idPrefix="ig"
                    enabled={igSchedEnabled} setEnabled={setIgSchedEnabled}
                    tz={igSchedTz} setTz={setIgSchedTz}
                    wdEnabled={igSchedWdEnabled} setWdEnabled={setIgSchedWdEnabled}
                    wdStart={igSchedWdStart} setWdStart={setIgSchedWdStart}
                    wdEnd={igSchedWdEnd} setWdEnd={setIgSchedWdEnd}
                    weEnabled={igSchedWeEnabled} setWeEnabled={setIgSchedWeEnabled}
                    weStart={igSchedWeStart} setWeStart={setIgSchedWeStart}
                    weEnd={igSchedWeEnd} setWeEnd={setIgSchedWeEnd}
                    offMsg={igOffMsg} setOffMsg={setIgOffMsg}
                  />
                </SettingsRow>

                <SaveBar status={<StatusLine msg={igMsg} />}>
                  <button type="button" onClick={handleSaveInstagram} disabled={igSaving} className="btn-primary">
                    {igSaving ? 'A guardar…' : 'Guardar alterações'}
                  </button>
                </SaveBar>
              </div>
            )}

            {/* ─── Telegram ─── */}
            {activeTab === 'telegram' && (
              <div>
                <SettingsRow
                  title="Ligação"
                  aside={<Pill tone={channels[2].tone}>{channels[2].state}</Pill>}
                  description="Não precisa de conta Meta nem de webhooks: basta um bot do Telegram, criado em segundos."
                >
                  <div className="space-y-5">
                    <Step n={1} title="Criar o bot">
                      <ol className="list-inside list-decimal space-y-1.5">
                        <li>No Telegram, procure <strong className="text-app-ink">@BotFather</strong> (o bot oficial para criar bots).</li>
                        <li>Envie <Code>/newbot</Code> e siga as instruções. O username tem de terminar em <Code>bot</Code>.</li>
                        <li>O @BotFather devolve um <strong className="text-app-ink">token</strong> (ex.: <Code>123456789:AAExxxx…</Code>). Copie-o.</li>
                      </ol>
                    </Step>
                    <Step n={2} title="Colar o token">
                      <div className="relative">
                        <input
                          aria-label="Token do bot"
                          className="input pr-20"
                          type={tgBotTokenVisible ? 'text' : 'password'}
                          placeholder={tgBotTokenConfigured ? '••••••••  (já configurado; deixe vazio para manter)' : '123456789:AAExxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxxx'}
                          value={tgBotToken}
                          onChange={(e) => setTgBotToken(e.target.value)}
                          autoComplete="off"
                        />
                        <button type="button" onClick={() => setTgBotTokenVisible(v => !v)} className="absolute right-2 top-1/2 -translate-y-1/2 px-1 text-xs font-semibold text-app-muted hover:text-app-ink">
                          {tgBotTokenVisible ? 'Ocultar' : 'Mostrar'}
                        </button>
                      </div>
                      {tgUsername && <p className="text-sm text-app-pos">Bot ligado: @{tgUsername}</p>}
                    </Step>
                  </div>
                </SettingsRow>

                <SettingsRow title="Respostas automáticas" description="Com isto desligado o bot continua ligado, mas o agente não responde.">
                  <div className="flex items-center justify-between gap-4">
                    <span className="text-sm text-app-ink">{tgEnabled ? 'O agente responde no Telegram' : 'Desligadas'}</span>
                    <Switch checked={tgEnabled} onChange={() => setTgEnabled((v) => !v)} label="Respostas no Telegram" />
                  </div>
                </SettingsRow>

                <SettingsRow title="Horário" description="Ponha o agente a atender só quando a casa está fechada, ou só em certas horas.">
                  <ScheduleFields
                    idPrefix="tg"
                    enabled={tgSchedEnabled} setEnabled={setTgSchedEnabled}
                    tz={tgSchedTz} setTz={setTgSchedTz}
                    wdEnabled={tgSchedWdEnabled} setWdEnabled={setTgSchedWdEnabled}
                    wdStart={tgSchedWdStart} setWdStart={setTgSchedWdStart}
                    wdEnd={tgSchedWdEnd} setWdEnd={setTgSchedWdEnd}
                    weEnabled={tgSchedWeEnabled} setWeEnabled={setTgSchedWeEnabled}
                    weStart={tgSchedWeStart} setWeStart={setTgSchedWeStart}
                    weEnd={tgSchedWeEnd} setWeEnd={setTgSchedWeEnd}
                    offMsg={tgOffMsg} setOffMsg={setTgOffMsg}
                  />
                </SettingsRow>

                <SaveBar status={<StatusLine msg={tgMsg} />}>
                  <button type="button" onClick={handleSaveTelegram} disabled={tgSaving} className="btn-primary">
                    {tgSaving ? 'A guardar…' : 'Guardar alterações'}
                  </button>
                </SaveBar>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ─── Leads ─── */}
      {activeTab === 'leads' && agent && (
        <div className="space-y-6">
          {briefingStats ? (
            <KpiStrip
              items={[
                { label: 'Conversas', value: int(briefingStats.conversations), caption: 'Últimas 48 horas' },
                { label: 'Pendentes', value: int(briefingStats.pending), caption: 'Sem resposta final', tone: briefingStats.pending > 0 ? 'warn' : 'default' },
                { label: 'Passadas à equipa', value: int(briefingStats.handoffs), caption: 'Pediram uma pessoa' },
                { label: 'Leads no CRM', value: int(briefingStats.leads), caption: `${int(briefingStats.flagged ?? 0)} à espera de resposta` },
              ]}
            />
          ) : briefingLoading ? (
            <Skeleton className="h-[106px] w-full rounded-xl" />
          ) : null}

          {briefingFlagged.length > 0 && (
            <section className="rounded-xl border border-app-edge bg-app-sheet">
              <div className="flex items-center justify-between gap-3 px-5 pt-4">
                <h2 className="text-base font-semibold text-app-ink">À espera da sua resposta</h2>
                <Pill tone="warn">{int(briefingFlagged.length)}</Pill>
              </div>
              <ul className="mt-2">
                {briefingFlagged.map(f => (
                  <li key={f.id} className="flex flex-wrap items-center justify-between gap-3 border-t border-app-rule px-5 py-3">
                    <div className="min-w-0">
                      <span className="block truncate text-sm font-semibold text-app-ink">{f.visitor}</span>
                      <span className="block text-xs text-app-muted">{f.channel} · {new Date(f.date).toLocaleDateString('pt-PT')}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button type="button" onClick={() => setActiveTab('history')} className="btn-ghost h-8 text-app-accent hover:text-app-accent">Ver conversa</button>
                      <button
                        type="button"
                        onClick={async () => {
                          await api.patch(`/api/agents/${agent.id}/conversations/${f.id}/unflag`);
                          setBriefingFlagged(prev => prev.filter(x => x.id !== f.id));
                          setBriefingStats(prev => prev ? {...prev, flagged: Math.max(0, (prev.flagged ?? 1) - 1)} : prev);
                        }}
                        className="btn-ghost h-8"
                      >Marcar como visto</button>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <Panel
            title="Resumo do agente"
            action={
              <button
                type="button"
                onClick={() => { setBriefingHistory([]); setBriefingStats(null); setBriefingFlagged([]); handleBriefingSend(); }}
                disabled={briefingLoading}
                className="font-semibold text-app-accent hover:underline disabled:opacity-50"
              >
                Atualizar
              </button>
            }
          >
            <div className="mb-4 max-h-[28rem] space-y-3 overflow-y-auto pr-1" aria-live="polite">
              {briefingHistory.length === 0 && briefingLoading && (
                <div className="space-y-2" aria-label="A analisar conversas">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-4 w-2/3" />
                  <Skeleton className="h-4 w-1/2" />
                </div>
              )}
              {briefingHistory.length === 0 && !briefingLoading && (
                <p className="text-sm text-app-muted">Peça um resumo das conversas recentes ou pergunte algo sobre os clientes.</p>
              )}
              {briefingHistory.map((msg, i) => (
                <div key={i} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={cx('max-w-[85%] whitespace-pre-wrap rounded-xl px-4 py-2.5 text-sm leading-relaxed', msg.role === 'user' ? 'bg-app-accent text-app-accent-ink' : 'bg-app-raised text-app-ink')}>
                    {msg.role === 'assistant' ? readStatus(msg.content).text : msg.content}
                  </div>
                </div>
              ))}
              {briefingLoading && briefingHistory.length > 0 && (
                <div className="flex justify-start">
                  <div className="rounded-xl bg-app-raised px-4 py-2.5 text-sm text-app-muted">A pensar…</div>
                </div>
              )}
            </div>
            <form onSubmit={(e) => { e.preventDefault(); handleBriefingSend(); }} className="flex gap-2">
              <input
                aria-label="Pergunta ao agente"
                className="input flex-1"
                placeholder="Ex.: Há clientes à espera de resposta hoje?"
                value={briefingInput}
                onChange={(e) => setBriefingInput(e.target.value)}
                disabled={briefingLoading}
              />
              <button type="submit" disabled={briefingLoading || !briefingInput.trim()} className="btn-primary">Enviar</button>
            </form>
          </Panel>
          <div className="flex flex-wrap gap-x-5 gap-y-1 text-sm">
            <button type="button" onClick={() => setActiveTab('history')} className="font-semibold text-app-accent hover:underline">Ver todas as conversas</button>
            <button type="button" onClick={() => router.push('/dashboard/crm')} className="font-semibold text-app-accent hover:underline">Abrir CRM</button>
          </div>
        </div>
      )}

      {/* ─── Conversas ─── */}
      {activeTab === 'history' && agent && (
        <div>
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <p className="text-sm text-app-muted">Todas as conversas deste agente, em todos os canais.</p>
            <a href={`/api/agents/${agent.id}/export-csv`} download className="btn-secondary">Exportar CSV</a>
          </div>
          <ConversationHistory agentId={agent.id} />
        </div>
      )}

      {/* ─── Automação (integrações) ─── */}
      {activeTab === 'integrations' && (() => {
        const COST_PER_MSG = 0.06; // EUR estimado por mensagem proativa WhatsApp
        return (
          <div className="max-w-5xl">
            <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
              <p className="text-sm text-app-muted">As alterações nesta página guardam-se sozinhas.</p>
              <div className="min-h-[2rem]">{intSaving ? <span className="text-sm text-app-muted">A guardar…</span> : <StatusLine msg={intMsg} />}</div>
            </div>

            <SettingsRow title="Idioma" description="O agente deteta o idioma do cliente e responde no mesmo. Pode também fixar um idioma.">
              <select aria-label="Idioma das respostas" className="input h-auto py-2 sm:max-w-xs" value={agent.languageMode ?? 'auto'} onChange={(e) => handleSaveIntegrations({ languageMode: e.target.value })}>
                <option value="auto">Automático (o do cliente)</option>
                <option value="pt">Português</option>
                <option value="en">English</option>
                <option value="es">Español</option>
                <option value="fr">Français</option>
                <option value="de">Deutsch</option>
                <option value="it">Italiano</option>
              </select>
            </SettingsRow>

            <SettingsRow
              title="Mensagens proativas"
              description="O agente inicia conversas no WhatsApp: confirmações de reserva, lembretes, seguimento de pedidos."
            >
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-app-ink">{agent.proactiveEnabled ? 'Ligadas' : 'Desligadas'}</span>
                  <Switch checked={agent.proactiveEnabled} onChange={() => handleSaveIntegrations({ proactiveEnabled: !agent.proactiveEnabled })} label="Mensagens proativas" />
                </div>
                <div className="rounded-lg bg-app-warn-soft px-4 py-3 text-sm text-app-warn">
                  <p className="font-semibold">Cada mensagem tem custo real</p>
                  <p className="mt-1">A Meta cobra cerca de €{COST_PER_MSG.toFixed(2)} por mensagem proativa. Defina limites: o agente para sozinho quando chega ao máximo.</p>
                </div>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Máximo por dia" htmlFor="pmDay">
                    <input id="pmDay" type="number" min={1} max={500} className="input num"
                      value={agent.proactiveMaxPerDay}
                      onChange={(e) => setAgent(a => a ? { ...a, proactiveMaxPerDay: Number(e.target.value) } : a)}
                      onBlur={(e) => handleSaveIntegrations({ proactiveMaxPerDay: Number(e.target.value) })}
                    />
                  </Field>
                  <Field label="Máximo por mês" htmlFor="pmMonth">
                    <input id="pmMonth" type="number" min={1} max={5000} className="input num"
                      value={agent.proactiveMonthBudget}
                      onChange={(e) => setAgent(a => a ? { ...a, proactiveMonthBudget: Number(e.target.value) } : a)}
                      onBlur={(e) => handleSaveIntegrations({ proactiveMonthBudget: Number(e.target.value) })}
                    />
                  </Field>
                </div>
                <dl className="grid grid-cols-2 gap-4 rounded-lg border border-app-edge p-4 text-sm">
                  <div>
                    <dt className="text-xs text-app-muted">Custo máximo estimado</dt>
                    <dd className="num mt-0.5 font-semibold text-app-ink">€{(agent.proactiveMaxPerDay * COST_PER_MSG * 30).toFixed(0)}/mês <span className="font-normal text-app-faint">pelo limite diário</span></dd>
                    <dd className="num text-xs text-app-faint">€{(agent.proactiveMonthBudget * COST_PER_MSG).toFixed(0)} pelo limite mensal</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-app-muted">Enviadas</dt>
                    <dd className="num mt-0.5 font-semibold text-app-ink">{int(agent.proactiveSentToday ?? 0)} hoje</dd>
                    <dd className="num text-xs text-app-faint">{int(agent.proactiveSentMonth ?? 0)} este mês</dd>
                  </div>
                </dl>
                <p className="text-xs text-app-faint">Estimativa a €{COST_PER_MSG} por mensagem. O valor real varia com o país e o tipo de mensagem.</p>
              </div>
            </SettingsRow>

            <SettingsRow title="Seguimento automático" description="Envia uma mensagem algumas horas depois de uma conversa acabar sem pedido. Usa a janela gratuita de 24 horas da Meta.">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-app-ink">{agent.followUpEnabled ? 'Ligado' : 'Desligado'}</span>
                  <Switch checked={agent.followUpEnabled} onChange={() => handleSaveIntegrations({ followUpEnabled: !agent.followUpEnabled })} label="Seguimento automático" />
                </div>
                {agent.followUpEnabled && (
                  <>
                    <Field label="Enviar ao fim de (horas)" hint="Até 23 horas, para ficar dentro da janela gratuita." htmlFor="fuHours">
                      <input id="fuHours" type="number" min={1} max={23} className="input num w-32"
                        value={agent.followUpHours}
                        onChange={(e) => setAgent(a => a ? { ...a, followUpHours: Number(e.target.value) } : a)}
                        onBlur={(e) => handleSaveIntegrations({ followUpHours: Number(e.target.value) })}
                      />
                    </Field>
                    <Field label="Mensagem" hint={<>Use {'{nome}'} para pôr o nome do cliente.</>} htmlFor="fuMsg">
                      <textarea id="fuMsg" className="input h-24 resize-y" placeholder="Ex.: Olá {nome}! Ficou com alguma dúvida sobre a encomenda?"
                        value={agent.followUpMessage ?? ''}
                        onChange={(e) => setAgent(a => a ? { ...a, followUpMessage: e.target.value } : a)}
                        onBlur={(e) => handleSaveIntegrations({ followUpMessage: e.target.value })}
                      />
                    </Field>
                  </>
                )}
              </div>
            </SettingsRow>

            <SettingsRow title="Alertas por email" description="Avisos quando algo corre mal e um relatório semanal com os números do agente.">
              <div className="space-y-4">
                <Field label="Email para alertas" htmlFor="alEmail">
                  <input id="alEmail" type="email" className="input" placeholder="gerencia@restaurante.pt"
                    defaultValue={agent.alertEmail ?? ''}
                    onBlur={(e) => handleSaveIntegrations({ alertEmail: e.target.value || undefined })}
                  />
                </Field>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Avisar se passar à equipa mais de" hint="Conversas por dia." htmlFor="alHand">
                    <input id="alHand" type="number" min={1} className="input num" placeholder="ex: 5"
                      defaultValue={agent.alertHandoffThreshold ?? ''}
                      onBlur={(e) => handleSaveIntegrations({ alertHandoffThreshold: e.target.value ? Number(e.target.value) : undefined })}
                    />
                  </Field>
                  <Field label="Avisar se resolver menos de" hint="Percentagem de conversas." htmlFor="alRes">
                    <input id="alRes" type="number" min={1} max={100} className="input num" placeholder="ex: 60"
                      defaultValue={agent.alertResolutionThreshold ?? ''}
                      onBlur={(e) => handleSaveIntegrations({ alertResolutionThreshold: e.target.value ? Number(e.target.value) : undefined })}
                    />
                  </Field>
                </div>
                <label className="flex cursor-pointer items-center gap-2 text-sm text-app-ink">
                  <input type="checkbox" checked={agent.alertWeeklyReport} onChange={(e) => handleSaveIntegrations({ alertWeeklyReport: e.target.checked })} className="h-4 w-4 rounded accent-app-accent" />
                  Receber o relatório semanal
                </label>
              </div>
            </SettingsRow>

            <SettingsRow title="CRM de contactos" description="Junta todos os clientes que falaram com o agente, com notas, etiquetas e histórico. Extra, incluído no plano White-label.">
              <div className="flex items-center justify-between gap-4">
                {agent.crmEnabled
                  ? <button type="button" onClick={() => router.push('/dashboard/crm')} className="btn-secondary">Abrir CRM</button>
                  : <span className="text-sm text-app-ink">Desligado</span>}
                <Switch checked={agent.crmEnabled} onChange={() => handleSaveIntegrations({ crmEnabled: !agent.crmEnabled })} label="CRM de contactos" />
              </div>
            </SettingsRow>

            <SettingsRow title="Google Calendar" description="Liga a agenda real do negócio. Com isto ligado, as marcações usam a disponibilidade verdadeira.">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-app-ink">{agent.calendarEnabled ? 'Ligado' : 'Desligado'}</span>
                  <Switch checked={agent.calendarEnabled} onChange={() => handleSaveIntegrations({ calendarEnabled: !agent.calendarEnabled })} label="Google Calendar" />
                </div>
                {agent.calendarEnabled && (
                  <>
                    <Field label="Calendar ID" hint="primary, ou o email da agenda." htmlFor="gcalId">
                      <input id="gcalId" className="input" placeholder="ex: primary ou reservas@gmail.com"
                        defaultValue={agent.calendarId ?? ''}
                        onBlur={(e) => handleSaveIntegrations({ calendarId: e.target.value || undefined })}
                      />
                    </Field>
                    {gcalConnected ? (
                      <div className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-app-edge px-4 py-3">
                        <span className="flex items-center gap-2 text-sm text-app-ink"><Pill tone="pos" dot>Ligado</Pill>{gcalEmail}</span>
                        <button type="button" onClick={handleGcalDisconnect} className="text-sm font-semibold text-app-neg hover:underline">Desligar</button>
                      </div>
                    ) : (
                      <button type="button" onClick={handleGcalConnect} disabled={gcalLoading} className="btn-secondary">
                        {gcalLoading ? 'A redirecionar…' : 'Ligar conta Google'}
                      </button>
                    )}
                  </>
                )}
              </div>
            </SettingsRow>

            <SettingsRow title="Instagram DM" description="Responde às mensagens diretas no Instagram, com a mesma API Meta do WhatsApp.">
              <div className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <span className="text-sm text-app-ink">{agent.instagramEnabled ? 'Ligado' : 'Desligado'}</span>
                  <Switch checked={agent.instagramEnabled} onChange={() => handleSaveIntegrations({ instagramEnabled: !agent.instagramEnabled })} label="Instagram DM" />
                </div>
                {agent.instagramEnabled && (
                  <Field label="Instagram Account ID" hint={<>Preenche-se sozinho ao ligar em <button type="button" onClick={() => setActiveTab('instagram')} className="font-semibold text-app-accent hover:underline">Canais › Instagram</button>. Só mude em casos especiais.</>} htmlFor="intIgAcc">
                    <input id="intIgAcc" className="input" placeholder="ex: 17841400008460056"
                      defaultValue={agent.instagramAccountId ?? ''}
                      onBlur={(e) => handleSaveIntegrations({ instagramAccountId: e.target.value || undefined })}
                    />
                  </Field>
                )}
              </div>
            </SettingsRow>
          </div>
        );
      })()}
    </AppLayout>
  );
}
