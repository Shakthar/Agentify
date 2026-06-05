import { useState, FormEvent } from 'react';
import { useRouter } from 'next/router';
import { useAgent } from '../hooks/useAgent';
import { useAuth } from '../hooks/useAuth';
import { ROUTES, AVAILABLE_MODELS_BY_PLAN } from '../utils/constants';

const STEP_LABELS = ['Básico', 'Modelo', 'Skills', 'Revisão'];

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
  model: 'claude-haiku-3',
  temperature: 0.7,
  maxTokens: 2000,
  skills: { handoff: true, dataCollection: true, scheduling: false, fileUpload: false },
};

export default function AgentCreator() {
  const router = useRouter();
  const { createAgent } = useAgent();
  const { tenant } = useAuth();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormData>(DEFAULT_FORM);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const plan = tenant?.plan ?? 'free';
  const models = AVAILABLE_MODELS_BY_PLAN[plan] ?? AVAILABLE_MODELS_BY_PLAN.free;

  const update = (field: keyof FormData, value: unknown) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const updateSkill = (key: keyof FormData['skills'], value: boolean) =>
    setForm((prev) => ({ ...prev, skills: { ...prev.skills, [key]: value } }));

  const next = () => setStep((s) => Math.min(s + 1, 3));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  const canProceed = () => {
    if (step === 0) return form.name.length >= 1 && form.systemPrompt.length >= 10;
    return true;
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
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="max-w-2xl mx-auto">
      {/* Steps */}
      <div className="flex items-center gap-2 mb-8">
        {STEP_LABELS.map((label, i) => (
          <div key={label} className="flex items-center gap-2">
            <div className={`w-7 h-7 rounded-full flex items-center justify-center text-sm font-bold transition-colors ${
              i < step ? 'bg-brand-600 text-white' : i === step ? 'bg-brand-100 text-brand-700 border-2 border-brand-500' : 'bg-gray-100 text-gray-400'
            }`}>
              {i < step ? '✓' : i + 1}
            </div>
            <span className={`text-sm ${i === step ? 'text-brand-700 font-medium' : 'text-gray-400'}`}>{label}</span>
            {i < STEP_LABELS.length - 1 && <div className="w-8 h-px bg-gray-200" />}
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        {/* Step 0 — Básico */}
        {step === 0 && (
          <div className="card space-y-5">
            <h2 className="text-lg font-semibold">Informações básicas</h2>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Nome do agente *</label>
              <input
                className="input"
                value={form.name}
                onChange={(e) => update('name', e.target.value)}
                placeholder="Ex: Suporte ao Cliente"
                maxLength={100}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Descrição</label>
              <input
                className="input"
                value={form.description}
                onChange={(e) => update('description', e.target.value)}
                placeholder="Breve descrição do agente"
                maxLength={500}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">System Prompt *</label>
              <textarea
                className="input resize-none"
                rows={8}
                value={form.systemPrompt}
                onChange={(e) => update('systemPrompt', e.target.value)}
                placeholder="Você é um assistente de suporte ao cliente da [Empresa]. Seu objetivo é ajudar os utilizadores com dúvidas sobre..."
              />
              <p className="text-xs text-gray-400 mt-1">{form.systemPrompt.length} / 10000 caracteres</p>
            </div>
          </div>
        )}

        {/* Step 1 — Modelo */}
        {step === 1 && (
          <div className="card space-y-5">
            <h2 className="text-lg font-semibold">Modelo de IA</h2>
            <div className="space-y-2">
              {models.map((m) => (
                <label key={m.value} className={`flex items-center gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                  form.model === m.value ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:bg-gray-50'
                }`}>
                  <input
                    type="radio"
                    className="accent-brand-600"
                    checked={form.model === m.value}
                    onChange={() => update('model', m.value)}
                  />
                  <span className="text-sm font-medium">{m.label}</span>
                </label>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4 pt-2">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Temperatura: <span className="text-brand-600">{form.temperature}</span>
                </label>
                <input
                  type="range" min="0" max="2" step="0.1"
                  value={form.temperature}
                  onChange={(e) => update('temperature', parseFloat(e.target.value))}
                  className="w-full accent-brand-600"
                />
                <div className="flex justify-between text-xs text-gray-400">
                  <span>Preciso</span><span>Criativo</span>
                </div>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Máx. tokens</label>
                <select
                  className="input"
                  value={form.maxTokens}
                  onChange={(e) => update('maxTokens', parseInt(e.target.value))}
                >
                  {[500, 1000, 2000, 4000, 8000].map((v) => (
                    <option key={v} value={v}>{v}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>
        )}

        {/* Step 2 — Skills */}
        {step === 2 && (
          <div className="card space-y-4">
            <h2 className="text-lg font-semibold">Skills</h2>
            {([
              { key: 'handoff', label: 'Handoff com resumo IA', desc: 'Escala para humano com resumo automático' },
              { key: 'dataCollection', label: 'Recolha de dados', desc: 'Formulário conversacional estruturado' },
              { key: 'scheduling', label: 'Agendamento', desc: 'Integração Google Calendar / Calendly' },
              { key: 'fileUpload', label: 'Envio de ficheiros', desc: 'Permite enviar PDFs e documentos' },
            ] as { key: keyof FormData['skills']; label: string; desc: string }[]).map(({ key, label, desc }) => (
              <label key={key} className={`flex items-center gap-4 p-4 rounded-lg border cursor-pointer transition-colors ${
                form.skills[key] ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:bg-gray-50'
              }`}>
                <input
                  type="checkbox"
                  className="accent-brand-600 w-4 h-4"
                  checked={form.skills[key]}
                  onChange={(e) => updateSkill(key, e.target.checked)}
                />
                <div>
                  <p className="text-sm font-medium">{label}</p>
                  <p className="text-xs text-gray-500">{desc}</p>
                </div>
              </label>
            ))}
          </div>
        )}

        {/* Step 3 — Revisão */}
        {step === 3 && (
          <div className="card space-y-4">
            <h2 className="text-lg font-semibold">Revisão</h2>
            <dl className="space-y-3 text-sm">
              <div className="flex gap-2">
                <dt className="text-gray-500 w-28 shrink-0">Nome</dt>
                <dd className="font-medium">{form.name}</dd>
              </div>
              {form.description && (
                <div className="flex gap-2">
                  <dt className="text-gray-500 w-28 shrink-0">Descrição</dt>
                  <dd>{form.description}</dd>
                </div>
              )}
              <div className="flex gap-2">
                <dt className="text-gray-500 w-28 shrink-0">Modelo</dt>
                <dd className="font-medium">{form.model}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-gray-500 w-28 shrink-0">Temperatura</dt>
                <dd>{form.temperature}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-gray-500 w-28 shrink-0">Máx. tokens</dt>
                <dd>{form.maxTokens}</dd>
              </div>
              <div className="flex gap-2">
                <dt className="text-gray-500 w-28 shrink-0">Skills</dt>
                <dd className="flex flex-wrap gap-1">
                  {Object.entries(form.skills).filter(([, v]) => v).map(([k]) => (
                    <span key={k} className="bg-brand-100 text-brand-700 text-xs px-2 py-0.5 rounded-full">{k}</span>
                  ))}
                </dd>
              </div>
            </dl>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs font-medium text-gray-500 mb-1">System Prompt</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap line-clamp-6">{form.systemPrompt}</p>
            </div>
          </div>
        )}

        {error && (
          <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-4 py-3 mt-4">{error}</p>
        )}

        {/* Navigation buttons */}
        <div className="flex justify-between mt-6">
          {step > 0 ? (
            <button type="button" className="btn-secondary" onClick={back}>Voltar</button>
          ) : (
            <div />
          )}
          {step < 3 ? (
            <button type="button" className="btn-primary" onClick={next} disabled={!canProceed()}>
              Continuar
            </button>
          ) : (
            <button type="submit" className="btn-primary" disabled={saving}>
              {saving ? 'A criar...' : 'Criar agente'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
