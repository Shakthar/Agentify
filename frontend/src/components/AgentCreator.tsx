import { useState, FormEvent } from 'react';
import { useRouter } from 'next/router';
import { useAgent } from '../hooks/useAgent';
import { useAuth } from '../hooks/useAuth';
import { ROUTES, AVAILABLE_MODELS_BY_PLAN } from '../utils/constants';
import api from '../utils/api';

const STEP_LABELS = ['Descrever', 'Rever IA', 'Modelo', 'Skills', 'Confirmar'];

const TEMPLATES = [
  {
    label: 'Suporte ao Cliente',
    icon: '🎧',
    description: 'Loja online de roupas femininas. Respondemos a dúvidas sobre encomendas, devoluções, tamanhos e disponibilidade de stock.',
  },
  {
    label: 'Vendas / SDR',
    icon: '💼',
    description: 'Software B2B de gestão de frotas para empresas de logística. O agente qualifica leads, explica funcionalidades e agenda demos.',
  },
  {
    label: 'FAQ / Knowledge Base',
    icon: '📚',
    description: 'Clínica de medicina estética. O agente responde perguntas frequentes sobre tratamentos, preços, preparação e cuidados pós-procedimento.',
  },
  {
    label: 'Agendamento',
    icon: '📅',
    description: 'Barbearia com 3 barbeiros. O agente ajuda clientes a agendar cortes, ver disponibilidade e receber confirmações.',
  },
];

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
  };
}

const DEFAULT_FORM: FormData = {
  name: '',
  description: '',
  systemPrompt: '',
  model: 'auto',
  temperature: 0.7,
  maxTokens: 2000,
  skills: { handoff: true, dataCollection: true, scheduling: false, fileUpload: false },
};

export default function AgentCreator() {
  const router = useRouter();
  const { createAgent } = useAgent();
  const { tenant } = useAuth();

  const [step, setStep] = useState(0);
  const [businessDescription, setBusinessDescription] = useState('');
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState<string | null>(null);
  const [form, setForm] = useState<FormData>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const plan = tenant?.plan ?? 'free';
  const models = AVAILABLE_MODELS_BY_PLAN[plan] ?? AVAILABLE_MODELS_BY_PLAN.free;

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
      router.push(ROUTES.agentDetail(agent.id));
    } catch (err: unknown) {
      const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error ?? 'Erro ao criar agente';
      setError(msg);
      setSaving(false);
    }
  };

  const back = () => setStep((s) => Math.max(s - 1, 0));
  const next = () => setStep((s) => Math.min(s + 1, 4));

  return (
    <div className="max-w-2xl mx-auto">
      {/* Step indicator */}
      <div className="flex items-center gap-1 mb-8 overflow-x-auto pb-1">
        {STEP_LABELS.map((label, i) => (
          <div key={label} className="flex items-center gap-1 shrink-0">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
              i < step ? 'bg-brand-600 text-white' :
              i === step ? 'bg-brand-100 text-brand-700 border-2 border-brand-500' :
              'bg-gray-100 text-gray-400'
            }`}>
              {i < step ? '✓' : i + 1}
            </div>
            <span className={`text-xs whitespace-nowrap ${i === step ? 'text-brand-700 font-medium' : 'text-gray-400'}`}>
              {label}
            </span>
            {i < STEP_LABELS.length - 1 && <div className="w-6 h-px bg-gray-200 mx-1" />}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit}>

        {/* STEP 0: Descrever negócio */}
        {step === 0 && (
          <div className="space-y-5">
            <div className="card">
              <h2 className="text-lg font-semibold mb-1">Descreve o teu negócio</h2>
              <p className="text-sm text-gray-500 mb-4">
                A IA vai gerar automaticamente o nome, descrição e system prompt do agente.
              </p>
              <textarea
                className="input resize-none"
                rows={6}
                value={businessDescription}
                onChange={(e) => setBusinessDescription(e.target.value)}
                placeholder="Ex: Loja online de calçado desportivo. Vendemos Nike, Adidas e New Balance. O agente deve ajudar clientes com dúvidas sobre tamanhos, prazos de entrega e trocas/devoluções. Tom amigável e informal."
              />
              <div className="flex justify-between items-center mt-1">
                <p className={`text-xs ${businessDescription.length < 20 ? 'text-gray-400' : 'text-green-600'}`}>
                  {businessDescription.length} / 2000 {businessDescription.length < 20 ? `(mín. 20)` : '✓'}
                </p>
              </div>
              {generateError && (
                <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2 mt-3">
                  {generateError}
                </p>
              )}
              <button
                type="button"
                className="btn-primary w-full mt-4 py-3"
                onClick={handleGenerate}
                disabled={businessDescription.trim().length < 20 || generating}
              >
                {generating ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                    A gerar com IA...
                  </span>
                ) : '✨ Gerar agente com IA'}
              </button>
            </div>

            {/* Templates */}
            <div>
              <p className="text-xs text-gray-500 mb-2 font-medium uppercase tracking-wide">Templates de exemplo</p>
              <div className="grid grid-cols-2 gap-2">
                {TEMPLATES.map((t) => (
                  <button
                    key={t.label}
                    type="button"
                    onClick={() => setBusinessDescription(t.description)}
                    className="text-left p-3 rounded-lg border border-gray-200 hover:border-brand-300 hover:bg-brand-50 transition-colors"
                  >
                    <p className="text-sm font-medium">{t.icon} {t.label}</p>
                    <p className="text-xs text-gray-400 mt-0.5 line-clamp-2">{t.description}</p>
                  </button>
                ))}
              </div>
            </div>

            <div className="text-center">
              <button
                type="button"
                onClick={() => { setForm(DEFAULT_FORM); setStep(1); }}
                className="text-sm text-gray-400 hover:text-gray-600 underline"
              >
                Prefiro escrever manualmente
              </button>
            </div>
          </div>
        )}

        {/* STEP 1: Rever / editar sugestão IA */}
        {step === 1 && (
          <div className="card space-y-5">
            <div className="flex items-center gap-2 mb-1">
              <span className="bg-brand-100 text-brand-700 text-xs px-2 py-0.5 rounded-full font-medium">✨ Gerado por IA</span>
              <h2 className="text-lg font-semibold">Rever e editar</h2>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome *</label>
              <input className="input" value={form.name} onChange={(e) => update('name', e.target.value)} maxLength={100} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
              <input className="input" value={form.description} onChange={(e) => update('description', e.target.value)} maxLength={500} />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                System Prompt
                <span className="text-xs text-gray-400 font-normal ml-2">Podes editar livremente</span>
              </label>
              <textarea
                className="input resize-none font-mono text-xs leading-relaxed"
                rows={12}
                value={form.systemPrompt}
                onChange={(e) => update('systemPrompt', e.target.value)}
              />
              <p className="text-xs text-gray-400 mt-1">{form.systemPrompt.length} / 10000</p>
            </div>
          </div>
        )}

        {/* STEP 2: Modelo */}
        {step === 2 && (
          <div className="card space-y-5">
            <h2 className="text-lg font-semibold">Modelo de IA</h2>
            <div className="space-y-2">
              {models.map((m) => (
                <label key={m.value} className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  form.model === m.value ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:bg-gray-50'
                }`}>
                  <input type="radio" className="accent-brand-600 mt-0.5 shrink-0" checked={form.model === m.value} onChange={() => update('model', m.value)} />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium">{m.label}</span>
                      {m.badge && <span className="text-xs bg-brand-100 text-brand-700 px-2 py-0.5 rounded-full">{m.badge}</span>}
                    </div>
                    <p className="text-xs text-gray-500 mt-0.5">{m.description}</p>
                  </div>
                </label>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Temperatura: <span className="text-brand-600">{form.temperature}</span>
                </label>
                <input type="range" min="0" max="2" step="0.1" value={form.temperature}
                  onChange={(e) => update('temperature', parseFloat(e.target.value))}
                  className="w-full accent-brand-600" />
                <div className="flex justify-between text-xs text-gray-400 mt-0.5">
                  <span>Preciso</span><span>Criativo</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Máx. tokens</label>
                <select className="input" value={form.maxTokens} onChange={(e) => update('maxTokens', parseInt(e.target.value))}>
                  {[500, 1000, 2000, 4000, 8000].map((v) => <option key={v} value={v}>{v}</option>)}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* STEP 3: Skills */}
        {step === 3 && (
          <div className="card space-y-4">
            <h2 className="text-lg font-semibold">Skills</h2>
            {([
              { key: 'handoff',        label: 'Handoff com resumo IA',  desc: 'Escala para humano com resumo automático' },
              { key: 'dataCollection', label: 'Recolha de dados',       desc: 'Formulário conversacional estruturado' },
              { key: 'scheduling',     label: 'Agendamento',            desc: 'Integração Google Calendar / Calendly' },
              { key: 'fileUpload',     label: 'Envio de ficheiros',     desc: 'Permite enviar PDFs e documentos' },
            ] as { key: keyof FormData['skills']; label: string; desc: string }[]).map(({ key, label, desc }) => (
              <label key={key} className={`flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-colors ${
                form.skills[key] ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:bg-gray-50'
              }`}>
                <input type="checkbox" className="accent-brand-600 w-4 h-4"
                  checked={form.skills[key]} onChange={(e) => updateSkill(key, e.target.checked)} />
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-gray-500">{desc}</p>
                </div>
              </label>
            ))}
          </div>
        )}

        {/* STEP 4: Confirmar */}
        {step === 4 && (
          <div className="card space-y-4">
            <h2 className="text-lg font-semibold">Confirmar criação</h2>
            <dl className="space-y-3 text-sm">
              {[
                { label: 'Nome',        value: form.name },
                { label: 'Descrição',   value: form.description || '—' },
                { label: 'Modelo',      value: form.model },
                { label: 'Temperatura', value: String(form.temperature) },
                { label: 'Máx. tokens', value: String(form.maxTokens) },
              ].map(({ label, value }) => (
                <div key={label} className="flex gap-2">
                  <dt className="text-gray-500 w-28 shrink-0">{label}</dt>
                  <dd className="font-medium text-gray-900">{value}</dd>
                </div>
              ))}
              <div className="flex gap-2">
                <dt className="text-gray-500 w-28 shrink-0">Skills</dt>
                <dd className="flex flex-wrap gap-1">
                  {Object.entries(form.skills).filter(([, v]) => v).map(([k]) => (
                    <span key={k} className="bg-brand-100 text-brand-700 text-xs px-2 py-0.5 rounded-full">{k}</span>
                  ))}
                  {Object.values(form.skills).every((v) => !v) && <span className="text-gray-400 text-xs">Nenhuma</span>}
                </dd>
              </div>
            </dl>
            <div className="bg-gray-50 rounded-lg p-3 mt-2">
              <p className="text-xs font-medium text-gray-500 mb-1">System Prompt</p>
              <p className="text-xs text-gray-700 whitespace-pre-wrap line-clamp-8 font-mono leading-relaxed">{form.systemPrompt}</p>
            </div>
            {error && (
              <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">{error}</p>
            )}
          </div>
        )}

        {/* Navigation */}
        <div className="flex justify-between mt-6">
          {step > 0 ? (
            <button type="button" className="btn-secondary" onClick={back}>Voltar</button>
          ) : <div />}

          {step === 0 ? null : step < 4 ? (
            <button
              type="button"
              className="btn-primary"
              onClick={next}
              disabled={step === 1 && (form.name.length < 1 || form.systemPrompt.length < 10)}
            >
              Continuar
            </button>
          ) : (
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? (
                <span className="flex items-center gap-2">
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  A criar...
                </span>
              ) : 'Criar agente'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
