import { useState, useEffect, FormEvent } from 'react';
import { useRouter } from 'next/router';
import { useAgent } from '../hooks/useAgent';
import { cx } from './app/ui';
import { useAuth } from '../hooks/useAuth';
import { ROUTES, AVAILABLE_MODELS_BY_PLAN } from '../utils/constants';
import api from '../utils/api';

const STEP_LABELS = ['Descrever', 'Rever IA', 'Modelo', 'Skills', 'Confirmar'];

const TEMPLATES = [
  {
    label: 'Suporte ao Cliente',
    description: 'Loja online de roupas femininas. Respondemos a dúvidas sobre encomendas, devoluções, tamanhos e disponibilidade de stock.',
  },
  {
    label: 'Vendas / SDR',
    description: 'Software B2B de gestão de frotas para empresas de logística. O agente qualifica leads, explica funcionalidades e agenda demos.',
  },
  {
    label: 'FAQ / Knowledge Base',
    description: 'Clínica de medicina estética. O agente responde perguntas frequentes sobre tratamentos, preços, preparação e cuidados pós-procedimento.',
  },
  {
    label: 'Agendamento',
    description: 'Barbearia com 3 barbeiros. O agente ajuda clientes a agendar cortes, ver disponibilidade e receber confirmações.',
  },
];

const SKILL_NAMES: Record<string, string> = {
  handoff: 'Handoff',
  dataCollection: 'Recolha de dados',
  scheduling: 'Agendamento',
  fileUpload: 'Envio de ficheiros',
  humorDetection: 'Deteção de humor',
  payments: 'Pagamentos',
  orders: 'Pedidos',
};

interface FormData {
  name: string;
  description: string;
  systemPrompt: string;
  model: string;
  temperature: number;
  maxTokens: number;
  skills: {
    handoff: boolean;
    dataCollection: boolean;
    scheduling: boolean;
    fileUpload: boolean;
    humorDetection: boolean;
    payments: boolean;
    orders: boolean;
  };
}

const DEFAULT_FORM: FormData = {
  name: '',
  description: '',
  systemPrompt: '',
  model: 'auto',
  temperature: 0.7,
  maxTokens: 2000,
  skills: { handoff: true, dataCollection: true, scheduling: false, fileUpload: false, humorDetection: false, payments: false, orders: false },
};

export default function AgentCreator() {
  const router = useRouter();
  const { createAgent } = useAgent();
  const { tenant } = useAuth();

  const [step, setStep] = useState(0);
  const [businessDescription, setBusinessDescription] = useState('');
  const [templateSystemPrompt, setTemplateSystemPrompt] = useState<string | null>(null);
  const [templateName, setTemplateName] = useState<string | null>(null);

  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [documentText, setDocumentText] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const plan = tenant?.plan ?? 'free';
  const models = AVAILABLE_MODELS_BY_PLAN[plan] ?? AVAILABLE_MODELS_BY_PLAN.free;

  // Ler template da query string (vindo de /dashboard/prompts)
  useEffect(() => {
    if (!router.isReady) return;
    const qs = router.query.systemPrompt as string | undefined;
    const qt = router.query.templateName as string | undefined;
    if (qs && qs.length > 10) {
      setTemplateSystemPrompt(qs);
      if (qt) setTemplateName(qt);
      // Pre-preenche o system prompt e salta para step 1 para o utilizador editar
      setForm(prev => ({ ...prev, systemPrompt: qs }));
      // Manter em step 0 para o utilizador ainda descrever o negocio antes de gerar
    }
  }, [router.isReady, router.query]);

  const update = (field: keyof FormData, value: unknown) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const updateSkill = (key: keyof FormData['skills'], value: boolean) =>
    setForm((prev) => ({ ...prev, skills: { ...prev.skills, [key]: value } }));

  const handleGenerate = async () => {
    if (businessDescription.trim().length < 20) return;
    setGenerating(true);
    setGenerateError(null);
    try {
      const { data } = await api.post('/api/suggest/suggest', {
        businessDescription: businessDescription.trim(),
        ...(templateSystemPrompt ? { templateSystemPrompt } : {}),
      });
      setForm((prev) => ({
        ...prev,
        name: data.name,
        description: data.description,
        systemPrompt: data.systemPrompt,
        model: models.find((m) => m.value === data.suggestedModel) ? data.suggestedModel : models[0].value,
        temperature: data.temperature ?? 0.7,
      }));
      setStep(1);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Erro ao gerar sugestão';
      setGenerateError(msg);
    } finally {
      setGenerating(false);
    }
  };

  const handleGenerateFromDocument = async (file: File) => {
    setUploadingDoc(true);
    setGenerateError(null);
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('language', 'pt');
      const { data } = await api.post('/api/suggest/suggest-from-document', form, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      setForm((prev) => ({
        ...prev,
        name: data.name,
        description: data.description,
        systemPrompt: data.systemPrompt,
        model: models.find((m) => m.value === data.suggestedModel) ? data.suggestedModel : models[0].value,
        temperature: data.temperature ?? 0.7,
      }));
      setDocumentText(data.documentText ?? null);
      setStep(1);
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Erro ao gerar agente a partir do documento';
      setGenerateError(msg);
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const agent = await createAgent({
        name: form.name,
        description: form.description || undefined,
        systemPrompt: form.systemPrompt,
        model: form.model,
        temperature: form.temperature,
        maxTokens: form.maxTokens,
        skills: form.skills,
      });
      // Se o agente foi criado a partir de um documento, semeia a base de conhecimento com
      // o texto original — melhor esforço, não bloqueia a navegação se falhar.
      if (documentText) {
        api.post(`/api/agents/${agent.id}/knowledge/text`, {
          title: 'Documento original',
          text: documentText,
        }).catch(() => { /* a KB pode ser preenchida manualmente depois, se isto falhar */ });
      }
      router.push(ROUTES.agentDetail(agent.id));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Erro ao criar agente';
      setError(msg);
      setSaving(false);
    }
  };

  const back = () => setStep((s) => Math.max(s - 1, 0));
  const next = () => setStep((s) => Math.min(s + 1, 4));

  const cleanLabel = (l: string) => l.replace(/^[^A-Za-z0-9\u00C0-\u024F]+/, '');
  const selectedModel = models.find((m) => m.value === form.model);
  const planLabel = plan.charAt(0).toUpperCase() + plan.slice(1);
  const creditsLeft = tenant ? Math.max(0, tenant.creditsTotal - tenant.creditsUsed) : null;
  const activeSkills = Object.entries(form.skills).filter(([, v]) => v).map(([k]) => SKILL_NAMES[k] ?? k);
  const previewName = form.name.trim() || 'O seu agente';
  const previewGreeting = form.description.trim()
    ? `Olá! Sou o assistente de ${previewName}. ${form.description.trim()}`
    : `Olá! Sou o assistente de ${previewName}. Em que posso ajudar?`;
  const nowHm = new Date().toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });

  const fieldLabel = 'mb-1 block text-sm font-medium text-app-ink';
  const sectionTitle = 'text-base font-semibold text-app-ink';

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_340px]">
      <div className="min-w-0">
        {/* Passos */}
        <ol className="mb-6 grid grid-cols-5 gap-2" aria-label="Passos">
          {STEP_LABELS.map((label, i) => (
            <li key={label} aria-current={i === step ? 'step' : undefined}>
              <div className={cx('h-0.5 rounded-full', i <= step ? 'bg-app-ink' : 'bg-app-rule')} />
              <p className={cx('mt-2 truncate text-xs', i === step ? 'font-semibold text-app-ink' : i < step ? 'text-app-muted' : 'text-app-faint')}>
                <span className="num">{i + 1}</span> {label}
              </p>
            </li>
          ))}
        </ol>

        <form onSubmit={handleSubmit}>
          {/* STEP 0: Descrever negócio */}
          {step === 0 && (
            <div className="space-y-8">
              {templateSystemPrompt && (
                <div className="rounded-lg bg-app-accent-soft px-4 py-3 text-sm text-app-ink">
                  <span className="font-semibold">Modelo &quot;{templateName ?? 'Setor'}&quot; carregado.</span>{' '}
                  Descreva o negócio e a IA adapta-o com os dados reais, substituindo os campos genéricos.
                </div>
              )}
              <section>
                <h2 className={sectionTitle}>Descreva o negócio</h2>
                <p className="mb-3 mt-1 text-sm text-app-muted">
                  {templateSystemPrompt ? 'A IA adapta o modelo ao seu negócio, preenchendo todos os detalhes.' : 'A IA escreve o nome, a descrição e as instruções do agente.'}
                </p>
                <textarea
                  className="input resize-none"
                  rows={6}
                  value={businessDescription}
                  onChange={(e) => setBusinessDescription(e.target.value)}
                  maxLength={2000}
                  placeholder="Ex: Tasca em Alfama com 40 lugares. Fazemos reservas, menu do dia e take-away. O agente responde a horários, alergénios e reservas, em tom simpático."
                />
                <p className={cx('num mt-1 text-xs', businessDescription.length < 20 ? 'text-app-faint' : 'text-app-pos')}>
                  {businessDescription.length} / 2000{businessDescription.length < 20 ? ' (mínimo 20)' : ''}
                </p>
                {generateError && <p className="mt-3 rounded-lg bg-app-neg-soft px-3 py-2 text-sm text-app-neg">{generateError}</p>}
                <div className="mt-4 flex flex-wrap items-center gap-4">
                  <button type="button" className="btn-primary" onClick={handleGenerate} disabled={businessDescription.trim().length < 20 || generating}>
                    {generating ? (
                      <span className="flex items-center justify-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        A gerar…
                      </span>
                    ) : 'Gerar agente com IA'}
                  </button>
                  <button type="button" onClick={() => { setForm(DEFAULT_FORM); setStep(1); }} className="text-sm text-app-muted underline underline-offset-2 hover:text-app-ink">
                    Prefiro escrever manualmente
                  </button>
                </div>
              </section>

              <section>
                <p className="mb-2 text-xs text-app-muted">Ou parta de um exemplo</p>
                <div className="grid gap-2 sm:grid-cols-2">
                  {TEMPLATES.map((t) => (
                    <button
                      key={t.label}
                      type="button"
                      onClick={() => setBusinessDescription(t.description)}
                      className="rounded-lg border border-app-edge p-3 text-left transition-colors hover:bg-app-raised"
                    >
                      <p className="text-sm font-medium text-app-ink">{t.label}</p>
                      <p className="mt-0.5 line-clamp-2 text-xs text-app-muted">{t.description}</p>
                    </button>
                  ))}
                </div>
              </section>

              <section className="border-t border-app-rule pt-6">
                <h2 className={sectionTitle}>Ou carregue um documento</h2>
                <p className="mb-3 mt-1 text-sm text-app-muted">
                  Manual de procedimentos, FAQ, lista de preços ou catálogo (PDF, Word, CSV ou texto). O agente é construído só com o que lá estiver.
                </p>
                <label className={cx('btn-secondary cursor-pointer', uploadingDoc && 'pointer-events-none opacity-60')}>
                  {uploadingDoc ? (
                    <span className="flex items-center gap-2">
                      <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                      A ler o documento…
                    </span>
                  ) : 'Carregar documento'}
                  <input
                    type="file"
                    accept=".pdf,.docx,.csv,.txt,.md"
                    className="hidden"
                    disabled={uploadingDoc}
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      e.target.value = '';
                      if (file) handleGenerateFromDocument(file);
                    }}
                  />
                </label>
              </section>
            </div>
          )}

          {/* STEP 1: Rever / editar sugestão IA */}
          {step === 1 && (
            <div className="space-y-5">
              <div>
                <h2 className={sectionTitle}>Rever e editar</h2>
                <p className="mt-1 text-sm text-app-muted">Texto sugerido pela IA. Edite à vontade; a pré-visualização ao lado atualiza.</p>
              </div>
              <div>
                <label className={fieldLabel}>Nome *</label>
                <input className="input" value={form.name} onChange={(e) => update('name', e.target.value)} maxLength={100} />
              </div>
              <div>
                <label className={fieldLabel}>Descrição</label>
                <input className="input" value={form.description} onChange={(e) => update('description', e.target.value)} maxLength={500} />
              </div>
              <div>
                <label className={fieldLabel}>Instruções (system prompt)</label>
                <textarea
                  className="input resize-none font-mono text-xs leading-relaxed"
                  rows={12}
                  value={form.systemPrompt}
                  onChange={(e) => update('systemPrompt', e.target.value)}
                />
                <p className="num mt-1 text-xs text-app-faint">{form.systemPrompt.length} / 10000</p>
              </div>
            </div>
          )}

          {/* STEP 2: Modelo */}
          {step === 2 && (
            <div className="space-y-6">
              <h2 className={sectionTitle}>Modelo de IA</h2>
              <div className="overflow-hidden rounded-xl border border-app-edge">
                {models.map((m, i) => (
                  <label key={m.value} className={cx('flex cursor-pointer items-start gap-3 p-4 transition-colors', i > 0 && 'border-t border-app-rule', form.model === m.value ? 'bg-app-accent-soft' : 'hover:bg-app-raised')}>
                    <input type="radio" className="mt-1 shrink-0 accent-[rgb(var(--app-accent))]" checked={form.model === m.value} onChange={() => update('model', m.value)} />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-medium text-app-ink">{cleanLabel(m.label)}</span>
                        {m.badge && <span className="rounded-full bg-app-raised px-2 py-0.5 text-xs text-app-muted">{m.badge}</span>}
                      </div>
                      <p className="mt-0.5 text-xs text-app-muted">{m.description}</p>
                    </div>
                  </label>
                ))}
              </div>
              <div className="grid gap-5 sm:grid-cols-2">
                <div>
                  <label className={fieldLabel}>Temperatura: <span className="num text-app-accent">{form.temperature}</span></label>
                  <input type="range" min="0" max="2" step="0.1" value={form.temperature} onChange={(e) => update('temperature', parseFloat(e.target.value))} className="w-full accent-[rgb(var(--app-accent))]" />
                  <div className="mt-0.5 flex justify-between text-xs text-app-faint"><span>Preciso</span><span>Criativo</span></div>
                </div>
                <div>
                  <label className={fieldLabel}>Máx. tokens por resposta</label>
                  <select className="input" value={form.maxTokens} onChange={(e) => update('maxTokens', parseInt(e.target.value))}>
                    {[500, 1000, 2000, 4000, 8000].map((v) => <option key={v} value={v}>{v}</option>)}
                  </select>
                </div>
              </div>
            </div>
          )}

          {/* STEP 3: Skills */}
          {step === 3 && (() => {
            const planOrder = ['free', 'starter', 'business', 'enterprise'];
            const planIdx = planOrder.indexOf(plan);
            const SKILLS_DEF = [
              { key: 'handoff'        as keyof FormData['skills'], label: 'Handoff com resumo IA', desc: 'Escala para uma pessoa com resumo automático da conversa.', minPlan: 'free',    addonPrice: null as string | null },
              { key: 'dataCollection' as keyof FormData['skills'], label: 'Recolha de dados',      desc: 'Formulário conversacional para captar contactos e pedidos.', minPlan: 'free',    addonPrice: null },
              { key: 'scheduling'     as keyof FormData['skills'], label: 'Agendamento',           desc: 'Marca reuniões e reservas via Google Calendar ou Calendly.', minPlan: 'starter', addonPrice: '€7/mês' },
              { key: 'fileUpload'     as keyof FormData['skills'], label: 'Envio de ficheiros',    desc: 'Envia PDFs, catálogos e ementas na conversa.', minPlan: 'starter', addonPrice: '€5/mês' },
              { key: 'humorDetection' as keyof FormData['skills'], label: 'Deteção de humor',      desc: 'Lê o sentimento do cliente e adapta o tom das respostas.', minPlan: 'starter', addonPrice: '€9/mês' },
              { key: 'payments'       as keyof FormData['skills'], label: 'Pagamentos (MB Way)',   desc: 'Cobra por MB Way na própria conversa. Custo por transação.', minPlan: 'starter', addonPrice: '+€15/mês' },
              { key: 'orders'         as keyof FormData['skills'], label: 'Pedidos / KDS',         desc: 'Painel de encomendas em tempo real para a cozinha.', minPlan: 'starter', addonPrice: null },
            ];
            return (
              <div>
                <h2 className={sectionTitle}>Skills</h2>
                <p className="mb-4 mt-1 text-sm text-app-muted">Ligue só o que o agente precisa. As que o plano {planLabel} não inclui podem ser ativadas como addon depois de criar o agente.</p>
                <ul className="overflow-hidden rounded-xl border border-app-edge">
                  {SKILLS_DEF.map(({ key, label, desc, minPlan, addonPrice }, i) => {
                    const locked = planIdx < planOrder.indexOf(minPlan);
                    const active = form.skills[key];
                    return (
                      <li key={key} className={cx('flex items-start gap-4 p-4', i > 0 && 'border-t border-app-rule')}>
                        <div className="min-w-0 flex-1">
                          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                            <span className={cx('text-sm font-medium', locked ? 'text-app-muted' : 'text-app-ink')}>{label}</span>
                            {minPlan === 'free' && <span className="text-xs text-app-pos">Incluída</span>}
                            {locked && addonPrice && <span className="text-xs text-app-warn">Addon {addonPrice}</span>}
                            {locked && !addonPrice && <span className="text-xs text-app-faint">Plano {minPlan.charAt(0).toUpperCase() + minPlan.slice(1)}+</span>}
                          </div>
                          <p className="mt-0.5 text-xs text-app-muted">{desc}</p>
                        </div>
                        <button
                          type="button"
                          role="switch"
                          aria-checked={active && !locked}
                          disabled={locked}
                          onClick={() => !locked && updateSkill(key, !active)}
                          aria-label={(active ? 'Desativar ' : 'Ativar ') + label}
                          className={cx('mt-0.5 flex h-6 w-11 shrink-0 items-center rounded-full px-0.5 transition-colors', active && !locked ? 'justify-end' : 'justify-start', locked ? 'cursor-not-allowed bg-app-raised opacity-60' : active ? 'bg-app-accent' : 'bg-app-control')}
                        >
                          <span className="h-5 w-5 rounded-full bg-app-sheet" />
                        </button>
                      </li>
                    );
                  })}
                </ul>
              </div>
            );
          })()}

          {/* STEP 4: Confirmar */}
          {step === 4 && (
            <div className="space-y-5">
              <h2 className={sectionTitle}>Confirmar criação</h2>
              <dl className="divide-y divide-app-rule border-y border-app-rule text-sm">
                {[
                  { label: 'Nome', value: form.name },
                  { label: 'Descrição', value: form.description || '—' },
                  { label: 'Modelo', value: selectedModel ? cleanLabel(selectedModel.label) : form.model },
                  { label: 'Temperatura', value: String(form.temperature) },
                  { label: 'Máx. tokens', value: String(form.maxTokens) },
                  { label: 'Skills', value: activeSkills.length ? activeSkills.join(', ') : 'Nenhuma' },
                ].map(({ label, value }) => (
                  <div key={label} className="flex gap-4 py-2.5">
                    <dt className="w-28 shrink-0 text-app-muted">{label}</dt>
                    <dd className="min-w-0 font-medium text-app-ink">{value}</dd>
                  </div>
                ))}
              </dl>
              <div className="rounded-lg bg-app-raised p-3">
                <p className="mb-1 text-xs font-medium text-app-muted">Instruções</p>
                <p className="line-clamp-8 whitespace-pre-wrap font-mono text-xs leading-relaxed text-app-ink">{form.systemPrompt}</p>
              </div>
              {error && <p className="rounded-lg bg-app-neg-soft px-3 py-2 text-sm text-app-neg">{error}</p>}
            </div>
          )}

          {/* Navegação */}
          {step > 0 && (
            <div className="mt-8 border-t border-app-rule pt-4">
              <div className="flex items-center justify-between gap-3">
                <button type="button" className="btn-secondary" onClick={back}>Voltar</button>
                {step < 4 ? (
                  <button type="button" className="btn-primary" onClick={next} disabled={step === 1 && (form.name.length < 1 || form.systemPrompt.length < 10)}>
                    Continuar
                  </button>
                ) : (
                  <button type="submit" className="btn-primary" disabled={saving}>
                    {saving ? (
                      <span className="flex items-center gap-2">
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" />
                        A criar…
                      </span>
                    ) : 'Criar agente'}
                  </button>
                )}
              </div>
              <p className="num mt-3 text-xs text-app-muted">
                Plano {planLabel}
                {creditsLeft !== null && <> · {creditsLeft.toLocaleString('pt-PT')} créditos disponíveis</>}
                {' '}· {models.length} modelo{models.length !== 1 ? 's' : ''} no plano
              </p>
            </div>
          )}
        </form>
      </div>

      {/* Pré-visualização */}
      <aside className="lg:sticky lg:top-6 lg:self-start" aria-label="Pré-visualização">
        <p className="mb-2 text-xs text-app-muted">Pré-visualização no WhatsApp (exemplo)</p>
        <div className="overflow-hidden rounded-xl border border-app-edge">
          <div className="flex items-center gap-3 bg-wa-header px-4 py-2.5 text-white">
            <span className="flex h-8 w-8 items-center justify-center rounded-full bg-white/20 text-sm font-semibold">{previewName[0]?.toUpperCase()}</span>
            <div className="min-w-0">
              <p className="truncate text-sm font-medium">{previewName}</p>
              <p className="text-xs text-white/80">online</p>
            </div>
          </div>
          <div className="space-y-2 bg-wa-wall px-3 py-4">
            <div className="ml-auto max-w-[80%] rounded-lg rounded-tr-sm bg-wa-bubble px-3 py-1.5 text-sm text-wa-text">
              Boa tarde, têm mesa para hoje?
              <span className="num ml-2 text-xs text-wa-meta">{nowHm}</span>
            </div>
            <div className="max-w-[85%] rounded-lg rounded-tl-sm bg-white px-3 py-1.5 text-sm text-wa-text">
              {previewGreeting}
              <span className="num ml-2 text-xs text-wa-meta">{nowHm}</span>
            </div>
          </div>
        </div>

        <dl className="mt-4 space-y-2 text-sm">
          <div className="flex justify-between gap-3"><dt className="text-app-muted">Modelo</dt><dd className="truncate font-medium text-app-ink">{selectedModel ? cleanLabel(selectedModel.label) : '—'}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-app-muted">Skills ligadas</dt><dd className="num font-medium text-app-ink">{activeSkills.length}</dd></div>
          <div className="flex justify-between gap-3"><dt className="text-app-muted">Plano</dt><dd className="font-medium text-app-ink">{planLabel}</dd></div>
          {creditsLeft !== null && (
            <div className="flex justify-between gap-3"><dt className="text-app-muted">Créditos disponíveis</dt><dd className="num font-medium text-app-ink">{creditsLeft.toLocaleString('pt-PT')}</dd></div>
          )}
        </dl>
      </aside>
    </div>
  );
}
