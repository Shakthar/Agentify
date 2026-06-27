import { useState } from 'react';
import { useRouter } from 'next/router';
import Navigation from '../../components/Navigation';

interface Prompt {
  id: string;
  name: string;
  sector: string;
  description: string;
  prompt: string;
  tags: string[];
}

const LIBRARY: Prompt[] = [
  {
    id: 'restaurant',
    name: 'Restaurante & Delivery',
    sector: 'Alimentação',
    description: 'Tira pedidos, informa menu e horários, gere reservas.',
    tags: ['restaurante', 'delivery', 'pedidos'],
    prompt: `És o assistente virtual do {nome_negocio}. O teu nome é {nome_agente}.

Responsabilidades:
- Apresentar o menu e responder a dúvidas sobre pratos, ingredientes e alergénios
- Aceitar pedidos de delivery e recolha (take-away)
- Informar sobre horários de funcionamento: {horarios}
- Gerir reservas de mesa (confirmar disponibilidade e recolher dados)
- Comunicar promoções e pratos do dia

Tom de voz: Simpático, eficiente e acolhedor. Usa emojis com moderação (🍕🥗).

Quando não souberes a resposta, diz: "Deixa-me verificar com a equipa e já te respondo!" e faz handoff para o humano.

Informações do negócio:
- Nome: {nome_negocio}
- Morada: {morada}
- Telefone: {telefone}
- Website: {website}`,
  },
  {
    id: 'ecommerce',
    name: 'Loja Online / E-commerce',
    sector: 'Retail',
    description: 'Suporte pós-venda, rastreio de encomendas, devoluções.',
    tags: ['loja', 'ecommerce', 'encomendas', 'devoluções'],
    prompt: `És o assistente de suporte da {nome_negocio}. O teu nome é {nome_agente}.

Responsabilidades:
- Ajudar com dúvidas sobre produtos, tamanhos, disponibilidade e preços
- Rastrear encomendas usando o número de pedido fornecido pelo cliente
- Explicar a política de devoluções: {politica_devolucoes}
- Processar pedidos de troca ou devolução (recolher dados e criar ticket)
- Informar sobre prazos de entrega: {prazo_entrega}

Tom de voz: Profissional, empático e solucionador. Foca em resolver o problema do cliente no primeiro contacto.

Quando não conseguires resolver, escalona para a equipa humana com um resumo do problema.

Não tens acesso direto ao sistema de encomendas — pede sempre o número de pedido ao cliente antes de qualquer consulta.`,
  },
  {
    id: 'clinic',
    name: 'Clínica / Saúde',
    sector: 'Saúde',
    description: 'Marcações, informações sobre serviços, preparação para consultas.',
    tags: ['clínica', 'saúde', 'consultas', 'marcações'],
    prompt: `És o assistente virtual da {nome_negocio}. O teu nome é {nome_agente}.

Responsabilidades:
- Agendar, remarcar e cancelar consultas
- Informar sobre especialidades disponíveis e médicos: {especialidades}
- Explicar como se preparar para exames ou consultas
- Indicar documentação necessária (cartão de saúde, prescrições, etc.)
- Informar sobre seguros e formas de pagamento

Tom de voz: Calmo, profissional e empático. Este é um contexto de saúde — nunca dês conselhos médicos.

IMPORTANTE: Nunca diagnostiques sintomas. Para questões médicas, diz sempre: "Para qualquer dúvida clínica, por favor fala diretamente com o teu médico."

Horários de funcionamento: {horarios}
Contacto de urgência: {contacto_urgencia}`,
  },
  {
    id: 'realestate',
    name: 'Imobiliária',
    sector: 'Imobiliário',
    description: 'Qualifica leads, agenda visitas, informa sobre imóveis.',
    tags: ['imobiliária', 'imóveis', 'visitas', 'arrendamento', 'compra'],
    prompt: `És o assistente virtual da {nome_negocio}, agência imobiliária. O teu nome é {nome_agente}.

Responsabilidades:
- Qualificar potenciais clientes (comprador, vendedor ou arrendatário)
- Apresentar imóveis disponíveis e responder a questões sobre características
- Agendar visitas com os consultores
- Recolher dados de contacto para seguimento

Qualificação de leads — perguntar sempre:
1. Procura para compra ou arrendamento?
2. Qual a tipologia e zona preferencial?
3. Qual o orçamento disponível?
4. Qual o prazo para a decisão?

Tom de voz: Profissional, confiante e orientado para o cliente.

Quando um lead estiver qualificado, faz handoff para o consultor disponível com o resumo das necessidades.`,
  },
  {
    id: 'gym',
    name: 'Ginásio / Fitness',
    sector: 'Fitness',
    description: 'Inscrições, horários de aulas, planos e promoções.',
    tags: ['ginásio', 'fitness', 'aulas', 'memberships'],
    prompt: `És o assistente virtual do {nome_negocio}. O teu nome é {nome_agente}.

Responsabilidades:
- Informar sobre planos de membership e preços: {planos}
- Partilhar horários de aulas de grupo: {horarios_aulas}
- Ajudar com inscrições e renovações
- Responder a questões sobre equipamentos e instalações
- Informar sobre personal trainers disponíveis

Tom de voz: Enérgico, motivador e acolhedor. Usa emojis desportivos com moderação (💪🏃).

Promoções ativas: {promocoes}

Para inscrições ou visitas gratuitas, recolhe nome, email e telemóvel do interessado.`,
  },
  {
    id: 'b2b-saas',
    name: 'SaaS / B2B Tech',
    sector: 'Tecnologia',
    description: 'Suporte técnico, onboarding, qualificação de demos.',
    tags: ['saas', 'tech', 'suporte', 'b2b', 'demos'],
    prompt: `És o assistente de suporte da {nome_negocio}. O teu nome é {nome_agente}.

Responsabilidades:
- Ajudar utilizadores com dúvidas técnicas sobre o produto
- Guiar no processo de onboarding e configuração inicial
- Qualificar pedidos de demo (empresa, tamanho, caso de uso)
- Direcionares para documentação relevante: {link_docs}
- Criar tickets de suporte para problemas técnicos complexos

Tom de voz: Técnico mas acessível. Confiante e focado em resolver problemas de forma eficiente.

Quando um utilizador reportar um bug ou problema técnico, recolhe sempre:
1. Descrição do problema
2. Passos para reproduzir
3. Screenshot ou mensagem de erro (se houver)
4. Browser/dispositivo utilizado

Escalona para a equipa técnica se não conseguires resolver em 3 trocas de mensagens.`,
  },
];

const SECTORS = ['Todos', ...Array.from(new Set(LIBRARY.map(p => p.sector)))];

export default function PromptsPage() {
  const router = useRouter();
  const [filterSector, setFilterSector] = useState('Todos');
  const [search, setSearch] = useState('');
  const [copied, setCopied] = useState('');
  const [expanded, setExpanded] = useState<string | null>(null);

  const filtered = LIBRARY.filter(p => {
    const matchSector = filterSector === 'Todos' || p.sector === filterSector;
    const matchSearch = !search || p.name.toLowerCase().includes(search.toLowerCase()) ||
      p.description.toLowerCase().includes(search.toLowerCase()) ||
      p.tags.some(t => t.includes(search.toLowerCase()));
    return matchSector && matchSearch;
  });

  const copyPrompt = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(''), 2000);
  };

  const usePrompt = (p: Prompt) => {
    // Pass template as system prompt to the create-agent page where the AI assistant refines it
    router.push({
      pathname: '/dashboard/create',
      query: { systemPrompt: p.prompt, templateName: p.name },
    });
  };

  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950">
      <Navigation />
      <main className="max-w-5xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">📚 Biblioteca de Templates</h1>
            <p className="text-sm text-gray-500 dark:text-gray-400 mt-0.5">
              Escolhe um template base e o assistente IA adapta-o ao teu negócio específico.
            </p>
          </div>
          <button onClick={() => router.back()} className="btn-secondary text-sm">← Voltar</button>
        </div>

        {/* Tip banner */}
        <div className="mb-6 p-3 bg-brand-50 dark:bg-brand-900/20 border border-brand-200 dark:border-brand-800 rounded-lg flex items-start gap-2 text-sm text-brand-700 dark:text-brand-300">
          <span className="shrink-0 text-base">💡</span>
          <span>Clica em <strong>Usar template →</strong> para abrir o criador de agentes com este prompt pré-preenchido. O assistente IA vai ajudar a personalizá-lo para o teu negócio.</span>
        </div>

        {/* Filters */}
        <div className="flex flex-col sm:flex-row gap-2 mb-5">
          <input
            className="input flex-1"
            placeholder="Pesquisar templates…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
          <div className="flex gap-1 flex-wrap">
            {SECTORS.map(s => (
              <button
                key={s}
                onClick={() => setFilterSector(s)}
                className={`text-xs px-3 py-1.5 rounded-full border transition-colors ${
                  filterSector === s
                    ? 'bg-brand-600 text-white border-brand-600'
                    : 'border-gray-300 dark:border-gray-600 text-gray-600 dark:text-gray-400 hover:border-brand-400'
                }`}
              >
                {s}
              </button>
            ))}
          </div>
        </div>

        {/* Grid */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map(p => (
            <div key={p.id} className="card space-y-3">
              <div>
                <div className="flex items-start justify-between gap-2 mb-1">
                  <h3 className="font-semibold text-gray-900 dark:text-gray-100 text-sm">{p.name}</h3>
                  <span className="text-[10px] px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-400 rounded-full shrink-0">{p.sector}</span>
                </div>
                <p className="text-xs text-gray-500 dark:text-gray-400">{p.description}</p>
                <div className="flex flex-wrap gap-1 mt-2">
                  {p.tags.map(t => (
                    <span key={t} className="text-[10px] px-1.5 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-500 dark:text-gray-300 rounded">{t}</span>
                  ))}
                </div>
              </div>

              {expanded === p.id && (
                <pre className="text-xs bg-gray-50 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded p-3 whitespace-pre-wrap font-mono leading-relaxed max-h-48 overflow-y-auto">
                  {p.prompt}
                </pre>
              )}

              <div className="flex gap-2 pt-1">
                <button
                  onClick={() => setExpanded(expanded === p.id ? null : p.id)}
                  className="btn-secondary text-xs flex-1"
                >
                  {expanded === p.id ? '▲ Ocultar' : '▼ Ver prompt'}
                </button>
                <button
                  onClick={() => copyPrompt(p.prompt, p.id)}
                  className="btn-secondary text-xs px-3"
                  title="Copiar prompt"
                >
                  {copied === p.id ? '✓' : '📋'}
                </button>
                <button
                  onClick={() => usePrompt(p)}
                  className="btn-primary text-xs px-3 whitespace-nowrap"
                >
                  Usar template →
                </button>
              </div>
            </div>
          ))}
        </div>

        {filtered.length === 0 && (
          <div className="card text-center py-12">
            <p className="text-gray-400 text-sm">Nenhum template encontrado.</p>
          </div>
        )}
      </main>
    </div>
  );
}
