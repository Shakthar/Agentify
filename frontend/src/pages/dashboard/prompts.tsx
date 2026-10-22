import { useState } from 'react';
import { useRouter } from 'next/router';
import AppLayout from '../../components/app/AppLayout';
import { EmptyState, PageHeader, cx } from '../../components/app/ui';

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

  const current = filtered.find(p => p.id === expanded) ?? filtered[0] ?? null;

  return (
    <AppLayout wide>
      <PageHeader
        title="Modelos de agente"
        subtitle="Escolha um ponto de partida; o assistente IA adapta-o ao seu negócio."
        actions={current && <button onClick={() => usePrompt(current)} className="btn-primary">Usar este modelo</button>}
      />

      <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center" role="search">
        <input
          className="input sm:max-w-xs"
          placeholder="Pesquisar modelos"
          aria-label="Pesquisar modelos"
          value={search}
          onChange={e => setSearch(e.target.value)}
        />
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Setor">
          {SECTORS.map(s => (
            <button
              key={s}
              onClick={() => setFilterSector(s)}
              aria-pressed={filterSector === s}
              className={cx(
                'h-8 rounded-full border px-3 text-xs font-medium transition-colors',
                filterSector === s ? 'border-app-ink bg-app-ink text-app-sheet' : 'border-app-control text-app-muted hover:text-app-ink',
              )}
            >
              {s}
            </button>
          ))}
        </div>
      </div>

      {filtered.length === 0 ? (
        <EmptyState title="Nenhum modelo corresponde à pesquisa" body="Experimente outro termo ou escolha Todos os setores." />
      ) : (
        <div className="grid items-start gap-6 lg:grid-cols-[minmax(0,26rem)_minmax(0,1fr)]">
          <ul className="overflow-hidden rounded-xl border border-app-edge bg-app-sheet" aria-label="Modelos">
            {filtered.map((p, i) => {
              const active = current?.id === p.id;
              return (
                <li key={p.id} className={i > 0 ? 'border-t border-app-rule' : ''}>
                  <button
                    onClick={() => setExpanded(p.id)}
                    aria-current={active}
                    className={cx('block w-full px-5 py-3.5 text-left transition-colors hover:bg-app-raised focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-app-accent/40', active && 'bg-app-raised')}
                  >
                    <span className="flex items-baseline justify-between gap-3">
                      <span className={cx('font-medium', active ? 'text-app-accent' : 'text-app-ink')}>{p.name}</span>
                      <span className="shrink-0 text-xs text-app-faint">{p.sector}</span>
                    </span>
                    <span className="mt-0.5 block text-sm text-app-muted">{p.description}</span>
                  </button>
                </li>
              );
            })}
          </ul>

          {current && (
            <section className="min-w-0 rounded-xl border border-app-edge bg-app-sheet lg:sticky lg:top-6" aria-label={`Prompt de ${current.name}`}>
              <div className="flex items-start justify-between gap-3 border-b border-app-rule px-5 py-4">
                <div className="min-w-0">
                  <h2 className="text-base font-semibold text-app-ink">{current.name}</h2>
                  <div className="mt-1.5 flex flex-wrap gap-1">
                    {current.tags.map(t => <span key={t} className="rounded bg-app-raised px-1.5 py-0.5 text-xs text-app-muted">{t}</span>)}
                  </div>
                </div>
                <button onClick={() => copyPrompt(current.prompt, current.id)} className="btn-secondary h-9 shrink-0 px-3 text-xs" title="Copiar prompt">
                  {copied === current.id ? 'Copiado' : 'Copiar prompt'}
                </button>
              </div>
              <pre className="max-h-[32rem] overflow-y-auto whitespace-pre-wrap break-words px-5 py-4 font-mono text-xs leading-relaxed text-app-ink">{current.prompt}</pre>
              <p className="border-t border-app-rule px-5 py-3 text-xs text-app-faint">
                Os campos entre chavetas, como <span className="font-mono">{'{nome_negocio}'}</span>, são preenchidos no criador de agentes.
              </p>
            </section>
          )}
        </div>
      )}
    </AppLayout>
  );
}
