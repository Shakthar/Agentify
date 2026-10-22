/**
 * Textos da landing (identidade "Azulejo", out/2026) em PT-PT, ES e EN.
 * O locale vem do roteamento i18n do Next (/, /es, /en). Preços e créditos
 * NÃO vivem aqui: vêm de utils/pricing.ts, a fonte única.
 */
export type LandingLocale = 'pt' | 'es' | 'en';

export interface DemoScenario {
  id: string;
  label: string;
  business: string;
  hour: string;
  messages: { from: 'customer' | 'agent'; text: string; time: string }[];
  resultLabel: string;
  resultText: string;
  resultMeta: string;
}

export interface LandingCopy {
  meta: { title: string; description: string; ogLocale: string };
  nav: { how: string; compare: string; sectors: string; pricing: string; faq: string; login: string; cta: string; menu: string };
  hero: { title: string; sub: string; cta: string; secondary: string; checks: string[] };
  demo: { tablist: string; online: string; placeholder: string; scenarios: DemoScenario[] };
  omni: { title: string; sub: string; channels: { name: string; desc: string }[]; inboxNote: string };
  how: { title: string; steps: { time: string; title: string; desc: string }[] };
  vsMeta: {
    eyebrowless: string;
    title: string;
    sub: string;
    colTopic: string;
    colUs: string;
    colThem: string;
    rows: { topic: string; us: string; them: string }[];
    footnote: string;
  };
  diffs: { title: string; items: { title: string; desc: string }[] };
  handoff: { title: string; desc: string; cardLabel: string; cardText: string; cardMeta: string; copilot: string };
  antiBan: { title: string; desc: string; points: { title: string; desc: string }[] };
  pricing: {
    title: string;
    sub: string;
    currencyEUR: string;
    currencyBRL: string;
    free: string;
    month: string;
    conversations: string;
    credits: string;
    creditsOnce: string;
    agents: (n: number) => string;
    popular: string;
    plans: Record<'free' | 'starter' | 'business' | 'enterprise', { cta: string; features: string[] }>;
    salesCta: string;
    addonsTitle: string;
    addons: { title: string; desc: string }[];
    footnote: string;
    creditExplainer: string;
  };
  sectors: { title: string; sub: string; items: { slug: string; title: string; desc: string }[]; more: string };
  faq: { title: string; items: { q: string; a: string }[] };
  cta: { title: string; sub: string; button: string };
  footer: { privacy: string; terms: string; deletion: string; made: string };
}

const pt: LandingCopy = {
  meta: {
    title: 'Agentfy — Agente de IA para WhatsApp, Instagram e Telegram',
    description:
      'Agente de IA no teu WhatsApp: atende, recebe encomendas com MB WAY, faz marcações e passa a conversa à equipa. Também no Instagram e Telegram. Pronto em 10 min.',
    ogLocale: 'pt_PT',
  },
  nav: { how: 'Como funciona', compare: 'Porquê Agentfy', sectors: 'Setores', pricing: 'Preços', faq: 'Perguntas', login: 'Entrar', cta: 'Criar o meu agente', menu: 'Menu' },
  hero: {
    title: 'O teu WhatsApp vende. Mesmo fechado.',
    sub: 'Atende, vende e marca por ti. Um agente de IA no teu número de sempre, treinado com o teu menu, preços e regras. Recebe encomendas, faz marcações e passa a conversa à tua equipa quando é preciso. No Instagram, no Telegram e no teu site também.',
    cta: 'Criar grátis em 10 minutos',
    secondary: 'Ver porque não chega a IA da Meta',
    checks: ['API oficial da Meta, sem risco de ban', 'Dados na UE · RGPD', 'Sem cartão no plano Free'],
  },
  demo: {
    tablist: 'Exemplos por setor',
    online: 'online',
    placeholder: 'Mensagem',
    scenarios: [
      {
        id: 'restaurant', label: 'Restaurante', business: 'Tasca do Largo', hour: '23:12',
        messages: [
          { from: 'customer', text: 'Boa noite! Ainda fazem entregas?', time: '23:12' },
          { from: 'agent', text: 'Boa noite! Até às 23:45, sim. Hoje há arroz de pato e bacalhau à Brás. O que te apetece?', time: '23:12' },
          { from: 'customer', text: '2 arroz de pato e uma salada mista, para a Rua do Sol 14', time: '23:13' },
          { from: 'agent', text: 'Fica 31,50 € com entrega. Envio o pedido de pagamento MB WAY?', time: '23:13' },
          { from: 'customer', text: 'Sim, obrigado', time: '23:14' },
        ],
        resultLabel: 'Encomenda confirmada', resultText: 'Nº 215 · 31,50 € · pago com MB WAY', resultMeta: 'Já no ecrã da cozinha',
      },
      {
        id: 'clinic', label: 'Clínica', business: 'Clínica Dentária Sorriso', hour: '21:40',
        messages: [
          { from: 'customer', text: 'Olá, queria marcar uma limpeza', time: '21:40' },
          { from: 'agent', text: 'Olá! Tenho quinta às 10:00 ou sexta às 17:30 com a Dra. Marta. Qual prefere?', time: '21:40' },
          { from: 'customer', text: 'Sexta às 17:30', time: '21:41' },
          { from: 'agent', text: 'Marcado! Envio um lembrete na véspera. Precisa de fatura com NIF?', time: '21:41' },
        ],
        resultLabel: 'Marcação criada', resultText: 'Sexta 17:30 · Limpeza · Dra. Marta', resultMeta: 'Na Google Calendar',
      },
      {
        id: 'salon', label: 'Salão', business: 'Studio Lua', hour: '08:05',
        messages: [
          { from: 'customer', text: 'Bom dia, quanto custam madeixas?', time: '08:05' },
          { from: 'agent', text: 'Bom dia! A partir de 45 €, depende do comprimento. Tem cabelo pelos ombros ou mais comprido?', time: '08:05' },
          { from: 'customer', text: 'Pelos ombros. Sábado dá?', time: '08:06' },
          { from: 'agent', text: 'Sábado às 11:00 com a Inês. Fica reservado.', time: '08:06' },
        ],
        resultLabel: 'Reserva feita', resultText: 'Sábado 11:00 · Madeixas · Inês', resultMeta: 'Lembrete automático',
      },
      {
        id: 'shop', label: 'Loja online', business: 'Casa Linho', hour: '14:22',
        messages: [
          { from: 'customer', text: 'A minha encomenda ainda não chegou', time: '14:22' },
          { from: 'agent', text: 'Peço desculpa! A encomenda 1093 saiu ontem e chega amanhã. Quer o código de seguimento?', time: '14:22' },
          { from: 'customer', text: 'É a segunda vez que atrasa, estou farto', time: '14:23' },
          { from: 'agent', text: 'Tem toda a razão. Vou passar já à Sofia, da nossa equipa, com o resumo do problema.', time: '14:23' },
        ],
        resultLabel: 'Passagem para humano', resultText: 'Cliente irritado · atraso repetido', resultMeta: 'Sofia avisada com o resumo',
      },
    ],
  },
  omni: {
    title: 'Omnichat: um agente, todos os canais',
    sub: 'O mesmo agente, com o mesmo conhecimento e as mesmas regras, responde onde os teus clientes estão. Configuras uma vez.',
    channels: [
      { name: 'WhatsApp', desc: 'O teu número, pela API oficial' },
      { name: 'Instagram', desc: 'Mensagens diretas da conta Business' },
      { name: 'Telegram', desc: 'Bot com o nome do teu negócio' },
      { name: 'Chat do site', desc: 'Um widget ou um link público' },
    ],
    inboxNote: 'Todas as conversas, encomendas e contactos ficam num só painel, com histórico e CRM.',
  },
  how: {
    title: 'Do zero ao primeiro pedido numa tarde',
    steps: [
      { time: '2 min', title: 'Descreve o negócio', desc: 'O assistente faz-te as perguntas certas e escreve as regras do agente por ti.' },
      { time: '3 min', title: 'Dá-lhe o teu menu', desc: 'PDF, Word, Excel, um link, o teu site ou um vídeo do YouTube. Ele aprende o que vendes e a que preço.' },
      { time: '3 min', title: 'Liga os canais', desc: 'Entras com a conta Meta e o agente fica no teu WhatsApp Business. Instagram, Telegram e o chat do site no mesmo passo.' },
      { time: '2 min', title: 'Testa e ativa', desc: 'Conversas de teste, horário de funcionamento e quem recebe as passagens para humano.' },
    ],
  },
  vsMeta: {
    eyebrowless: '',
    title: 'Porque não usar só a IA da Meta?',
    sub: 'A Meta já tem um agente de IA no WhatsApp Business. Serve para responder a perguntas. Um negócio que vende precisa de mais.',
    colTopic: '',
    colUs: 'Agentfy',
    colThem: 'IA da Meta (Business AI)',
    rows: [
      { topic: 'Canais', us: 'WhatsApp, Instagram, Telegram e o chat do teu site, num só agente', them: 'Só WhatsApp e Instagram' },
      { topic: 'Encomendas e pagamentos', us: 'Carrinho na conversa, MB WAY e Multibanco, ecrã da cozinha e estado da entrega', them: 'Sugere produtos; a encomenda e o pagamento ficam do teu lado' },
      { topic: 'Passagem para humano', us: 'Resumo, humor do cliente e sugestões de resposta para a tua equipa', them: 'O agente deixa de responder e, ao retomar, perde o contexto da conversa' },
      { topic: 'Treino', us: 'PDF, Word, Excel, sites e YouTube, com tabelas e preços', them: 'Ficha do negócio fixa, FAQs e ficheiros; CSV e tabelas em PDF dão erro' },
      { topic: 'Modelo de IA', us: 'Escolhes Claude ou GPT, ou deixas o auto-routing poupar créditos', them: 'Só o modelo da Meta' },
      { topic: 'Preço', us: 'Créditos com valor em conversas, em € ou R$', them: 'Planos Premium do WhatsApp Business ou tokens faturados pela Meta' },
      { topic: 'Para agências', us: 'White-label com a tua marca e domínio', them: 'Não existe' },
      { topic: 'Os teus dados', us: 'Na UE, com exportação e eliminação a pedido', them: 'Na infraestrutura da Meta' },
    ],
    footnote: 'Comparação com base na documentação pública da Meta e de parceiros oficiais, outubro de 2026.',
  },
  diffs: {
    title: 'O que nos separa dos outros',
    items: [
      { title: 'Feito em Portugal, para Portugal e Brasil', desc: 'Português de Portugal de verdade, MB WAY e Multibanco, faturação em € e preços em R$ para o Brasil.' },
      { title: 'Encomendas de ponta a ponta', desc: 'Carrinho, upselling, pagamento, ecrã da cozinha e estado do pedido para o cliente, sem outro sistema.' },
      { title: 'Marcações na tua agenda', desc: 'Liga à Google Calendar, propõe horários livres e confirma.' },
      { title: 'Poupa até 60% em IA', desc: 'O auto-routing manda as mensagens simples para modelos leves e as difíceis para os melhores.' },
      { title: 'Horário de funcionamento', desc: 'Decides quando o agente fala e o que diz fora de horas, por canal.' },
      { title: 'Revende com a tua marca', desc: 'Agências criam agentes para clientes com white-label, domínio próprio e margem sua.' },
    ],
  },
  handoff: {
    title: 'Quando o cliente se irrita, a tua equipa entra com o resumo na mão',
    desc: 'O agente deteta frustração ou pedidos fora do guião e passa a conversa a uma pessoa com o que o cliente quer, o humor e o histórico.',
    cardLabel: 'Passagem para humano',
    cardText: 'Encomenda 214 chegou fria. Quer reembolso ou nova entrega.',
    cardMeta: 'Humor: irritado · 6 encomendas desde março',
    copilot: 'O copiloto sugere respostas à tua equipa enquanto ela fala com o cliente.',
  },
  antiBan: {
    title: 'O teu número não corre risco de ban',
    desc: 'Ligamo-nos pela API oficial da Meta para empresas, nunca por automações que imitam o WhatsApp Web.',
    points: [
      { title: 'API oficial', desc: 'A mesma WhatsApp Cloud API que a Meta dá às grandes marcas.' },
      { title: 'Limites de envio', desc: 'Nas mensagens proativas defines um teto diário e mensal. Nunca há picos que pareçam spam.' },
      { title: 'O número é teu', desc: 'Fica registado em teu nome na Meta. Não guardamos sessões paralelas.' },
    ],
  },
  pricing: {
    title: 'Paga por conversas, não por surpresas',
    sub: 'Cada plano diz quantas conversas cabem. Quanto maior o plano, mais barato fica cada crédito.',
    currencyEUR: '€ Europa',
    currencyBRL: 'R$ Brasil',
    free: 'Grátis',
    month: '/mês',
    conversations: 'conversas',
    credits: 'créditos/mês',
    creditsOnce: 'créditos (uma vez)',
    agents: (n) => (n === 1 ? '1 agente' : `${n} agentes`),
    popular: 'Mais escolhido',
    plans: {
      free: { cta: 'Começar grátis', features: ['1 número de WhatsApp', 'Chat do site', 'Base de conhecimento', 'Passagem para humano e recolha de dados', 'Modelos: Haiku / GPT-mini'] },
      starter: { cta: 'Começar agora', features: ['1 número de WhatsApp', 'Chat do site', 'Upload de ficheiros', 'Add-ons: Vendas e Delivery¹, Pagamentos, Marcações', 'Modelos: + Claude Sonnet', 'Suporte por email'] },
      business: { cta: 'Escolher Business', features: ['3 números de WhatsApp', 'Pagamentos, Marcações e Feedback incluídos', 'Deteção de humor', 'Acesso à API', 'Modelos: + GPT-4o', 'Histórico de 1 ano'] },
      enterprise: { cta: 'Falar com vendas', features: ['10 números de WhatsApp', 'Todas as skills (exceto Vendas¹ e à medida)', 'Claude Opus', 'White-label incluído', 'SLA 24h', 'Histórico ilimitado'] },
    },
    salesCta: 'Falar com vendas',
    addonsTitle: 'Add-ons em qualquer plano pago',
    addons: [
      { title: 'Créditos extra', desc: 'Pacotes de 5.000 créditos' },
      { title: 'Mais agentes', desc: 'Acrescenta agentes sem mudar de plano' },
      { title: 'White-label', desc: 'Portal com a tua marca, sem Agentfy' },
      { title: 'Rollover (em breve)', desc: 'Passa créditos não usados para o mês seguinte' },
    ],
    footnote: '¹ Vendas e Delivery inclui pedidos, upselling, cliente recorrente e ecrã da cozinha. As tarifas de mensagens da Meta, quando existem, são faturadas pela Meta ao dono do número.',
    creditExplainer: '1 conversa ≈ 40 créditos (3 a 5 trocas). Um pedido completo com pagamento ≈ 50 a 80.',
  },
  sectors: {
    title: 'Feito para o teu tipo de negócio',
    sub: 'Modelos prontos com as perguntas, regras e skills certas para cada setor.',
    items: [
      { slug: 'restaurantes', title: 'Restaurantes e delivery', desc: 'Encomendas, menu do dia, zonas de entrega e MB WAY.' },
      { slug: 'clinicas', title: 'Clínicas', desc: 'Marcações, lembretes e triagem de pedidos.' },
      { slug: 'saloes', title: 'Salões e estética', desc: 'Preços, disponibilidade e reservas.' },
      { slug: 'lojas', title: 'Lojas online', desc: 'Estado de encomendas, trocas e devoluções.' },
    ],
    more: 'Ver como funciona',
  },
  faq: {
    title: 'Perguntas frequentes',
    items: [
      { q: 'O que é um crédito?', a: 'É a unidade de consumo da plataforma. 1 crédito ≈ 1.000 tokens no Claude Haiku (Sonnet e GPT-4o consomem 3×, Opus 5×). Uma conversa média (3 a 5 trocas) usa 30 a 50 créditos e um pedido completo com pagamento 50 a 80. O envio de mensagens não consome créditos: as tarifas da Meta são faturadas pela Meta ao dono do número.' },
      { q: 'O que acontece quando os créditos acabam?', a: 'O agente deixa de responder. Recebes avisos aos 30% e aos 10%. Podes comprar pacotes de 5.000 créditos ou mudar para um plano com mais créditos.' },
      { q: 'Porque não usar só o agente de IA da Meta?', a: 'O agente da Meta responde a perguntas no WhatsApp e no Instagram. O Agentfy junta a isso o Telegram e o chat do site, encomendas com pagamento e ecrã da cozinha, marcações na tua agenda, passagem para humano com resumo e copiloto, escolha do modelo de IA e white-label para agências, com os dados na UE.' },
      { q: '1 agente = 1 WhatsApp?', a: 'Sim. Cada agente está ligado a um número de WhatsApp. O mesmo agente pode também responder no Instagram, no Telegram e no chat do site.' },
      { q: 'Quanto tempo demora a criar um agente?', a: 'Menos de 10 minutos com o assistente de criação. Ele recolhe a informação do negócio, escreve as regras e sugere as skills. Podes ajustar tudo depois.' },
      { q: 'Como ligo o meu WhatsApp Business?', a: 'Na aba WhatsApp do agente, clica em "Continuar com Facebook / Meta", autentica-te e o número fica ligado sem copiar tokens. Há também uma configuração manual.' },
      { q: 'O meu número corre risco de ser banido?', a: 'Não. Usamos a WhatsApp Cloud API oficial da Meta, nunca automações não oficiais. O número fica em teu nome e as mensagens proativas respeitam os limites que defines.' },
      { q: 'Posso definir um horário em que o agente não trabalha?', a: 'Sim. Em cada canal defines janelas para dias úteis e fins de semana e, se quiseres, uma mensagem automática para fora de horas.' },
      { q: 'Posso adicionar mais agentes sem mudar de plano?', a: 'Sim. No Starter até 2 extra, no Business até 7 extra e no Enterprise sem limite, com preço por agente por mês.' },
      { q: 'Posso entrar com o Facebook?', a: 'Sim. No ecrã de entrada tens "Continuar com Facebook". Também podes associar o Facebook mais tarde, no teu perfil.' },
    ],
  },
  cta: { title: 'Abre o teu WhatsApp ao mundo esta tarde', sub: 'Conta grátis com 1.000 créditos para testar. Sem cartão.', button: 'Criar conta grátis' },
  footer: { privacy: 'Política de Privacidade', terms: 'Termos de Serviço', deletion: 'Eliminação de Dados', made: 'Feito em Portugal · RGPD' },
};

const es: LandingCopy = {
  meta: {
    title: 'Agentfy — Agente de IA para WhatsApp, Instagram y Telegram',
    description:
      'Agente de IA en tu WhatsApp: atiende, toma pedidos con pago, agenda citas y pasa la conversación al equipo. También en Instagram y Telegram. Listo en 10 min.',
    ogLocale: 'es_ES',
  },
  nav: { how: 'Cómo funciona', compare: 'Por qué Agentfy', sectors: 'Sectores', pricing: 'Precios', faq: 'Preguntas', login: 'Entrar', cta: 'Crear mi agente', menu: 'Menú' },
  hero: {
    title: 'Tu WhatsApp vende. Incluso cerrado.',
    sub: 'Atiende, vende y agenda por ti. Un agente de IA en tu número de siempre, entrenado con tu carta, precios y reglas. Toma pedidos, agenda citas y pasa la conversación a tu equipo cuando hace falta. También en Instagram, Telegram y tu web.',
    cta: 'Crear gratis en 10 minutos',
    secondary: 'Por qué no basta la IA de Meta',
    checks: ['API oficial de Meta, sin riesgo de bloqueo', 'Datos en la UE · RGPD', 'Sin tarjeta en el plan Free'],
  },
  demo: {
    tablist: 'Ejemplos por sector',
    online: 'en línea',
    placeholder: 'Mensaje',
    scenarios: [
      {
        id: 'restaurant', label: 'Restaurante', business: 'Casa Lola', hour: '23:12',
        messages: [
          { from: 'customer', text: '¡Buenas noches! ¿Todavía hacéis entregas?', time: '23:12' },
          { from: 'agent', text: '¡Buenas noches! Hasta las 23:45, sí. Hoy hay arroz negro y croquetas caseras. ¿Qué te apetece?', time: '23:12' },
          { from: 'customer', text: '2 arroces negros y una ensalada, a la calle del Sol 14', time: '23:13' },
          { from: 'agent', text: 'Son 31,50 € con entrega, pagas al recibirlo. ¿Lo confirmo?', time: '23:13' },
          { from: 'customer', text: 'Sí, confírmalo', time: '23:14' },
        ],
        resultLabel: 'Pedido confirmado', resultText: 'N.º 215 · 31,50 € · pago a la entrega', resultMeta: 'Ya en la pantalla de cocina',
      },
      {
        id: 'clinic', label: 'Clínica', business: 'Clínica Dental Sonrisa', hour: '21:40',
        messages: [
          { from: 'customer', text: 'Hola, quería pedir cita para una limpieza', time: '21:40' },
          { from: 'agent', text: '¡Hola! Tengo el jueves a las 10:00 o el viernes a las 17:30 con la Dra. Marta. ¿Cuál prefieres?', time: '21:40' },
          { from: 'customer', text: 'El viernes a las 17:30', time: '21:41' },
          { from: 'agent', text: '¡Hecho! Te mando un recordatorio el día antes.', time: '21:41' },
        ],
        resultLabel: 'Cita creada', resultText: 'Viernes 17:30 · Limpieza · Dra. Marta', resultMeta: 'En Google Calendar',
      },
      {
        id: 'salon', label: 'Salón', business: 'Studio Luna', hour: '08:05',
        messages: [
          { from: 'customer', text: 'Buenos días, ¿cuánto cuestan unas mechas?', time: '08:05' },
          { from: 'agent', text: '¡Buenos días! Desde 45 €, según el largo. ¿Llevas el pelo por los hombros o más largo?', time: '08:05' },
          { from: 'customer', text: 'Por los hombros. ¿El sábado puede ser?', time: '08:06' },
          { from: 'agent', text: 'El sábado a las 11:00 con Inés. Queda reservado.', time: '08:06' },
        ],
        resultLabel: 'Reserva hecha', resultText: 'Sábado 11:00 · Mechas · Inés', resultMeta: 'Recordatorio automático',
      },
      {
        id: 'shop', label: 'Tienda online', business: 'Casa Lino', hour: '14:22',
        messages: [
          { from: 'customer', text: 'Mi pedido todavía no ha llegado', time: '14:22' },
          { from: 'agent', text: '¡Lo siento! El pedido 1093 salió ayer y llega mañana. ¿Quieres el número de seguimiento?', time: '14:22' },
          { from: 'customer', text: 'Es la segunda vez que se retrasa, estoy harto', time: '14:23' },
          { from: 'agent', text: 'Tienes toda la razón. Te paso ahora con Sofía, de nuestro equipo, con el resumen del problema.', time: '14:23' },
        ],
        resultLabel: 'Paso a una persona', resultText: 'Cliente molesto · retraso repetido', resultMeta: 'Sofía avisada con el resumen',
      },
    ],
  },
  omni: {
    title: 'Omnichat: un agente, todos los canales',
    sub: 'El mismo agente, con el mismo conocimiento y las mismas reglas, responde donde están tus clientes. Lo configuras una vez.',
    channels: [
      { name: 'WhatsApp', desc: 'Tu número, por la API oficial' },
      { name: 'Instagram', desc: 'Mensajes directos de la cuenta Business' },
      { name: 'Telegram', desc: 'Bot con el nombre de tu negocio' },
      { name: 'Chat web', desc: 'Un widget o un enlace público' },
    ],
    inboxNote: 'Todas las conversaciones, pedidos y contactos en un solo panel, con historial y CRM.',
  },
  how: {
    title: 'De cero al primer pedido en una tarde',
    steps: [
      { time: '2 min', title: 'Describe tu negocio', desc: 'El asistente te hace las preguntas correctas y escribe las reglas del agente por ti.' },
      { time: '3 min', title: 'Dale tu carta', desc: 'PDF, Word, Excel, un enlace, tu web o un vídeo de YouTube. Aprende qué vendes y a qué precio.' },
      { time: '3 min', title: 'Conecta los canales', desc: 'Entras con tu cuenta de Meta y el agente queda en tu WhatsApp Business. Instagram, Telegram y el chat web en el mismo paso.' },
      { time: '2 min', title: 'Prueba y activa', desc: 'Conversaciones de prueba, horario y quién recibe los pasos a una persona.' },
    ],
  },
  vsMeta: {
    eyebrowless: '',
    title: '¿Por qué no usar solo la IA de Meta?',
    sub: 'Meta ya tiene un agente de IA en WhatsApp Business. Sirve para responder preguntas. Un negocio que vende necesita más.',
    colTopic: '',
    colUs: 'Agentfy',
    colThem: 'IA de Meta (Business AI)',
    rows: [
      { topic: 'Canales', us: 'WhatsApp, Instagram, Telegram y el chat de tu web, en un solo agente', them: 'Solo WhatsApp e Instagram' },
      { topic: 'Pedidos y pagos', us: 'Carrito en la conversación, cobro (MB WAY y Multibanco en Portugal), pantalla de cocina y estado de entrega', them: 'Sugiere productos; el pedido y el pago quedan de tu lado' },
      { topic: 'Paso a una persona', us: 'Resumen, estado de ánimo del cliente y respuestas sugeridas para tu equipo', them: 'El agente deja de responder y, al retomar, pierde el contexto' },
      { topic: 'Entrenamiento', us: 'PDF, Word, Excel, webs y YouTube, con tablas y precios', them: 'Ficha de negocio fija, FAQs y archivos; CSV y tablas en PDF fallan' },
      { topic: 'Modelo de IA', us: 'Eliges Claude o GPT, o el auto-routing ahorra créditos', them: 'Solo el modelo de Meta' },
      { topic: 'Precio', us: 'Créditos con su valor en conversaciones, en € o R$', them: 'Planes Premium de WhatsApp Business o tokens facturados por Meta' },
      { topic: 'Para agencias', us: 'Marca blanca con tu marca y dominio', them: 'No existe' },
      { topic: 'Tus datos', us: 'En la UE, con exportación y borrado a petición', them: 'En la infraestructura de Meta' },
    ],
    footnote: 'Comparación basada en la documentación pública de Meta y de socios oficiales, octubre de 2026.',
  },
  diffs: {
    title: 'Lo que nos separa del resto',
    items: [
      { title: 'Hecho en la Península', desc: 'Español y portugués nativos, facturación en € y precios en R$ para Brasil.' },
      { title: 'Pedidos de principio a fin', desc: 'Carrito, venta cruzada, pago, pantalla de cocina y estado del pedido para el cliente.' },
      { title: 'Citas en tu agenda', desc: 'Se conecta a Google Calendar, propone huecos libres y confirma.' },
      { title: 'Ahorra hasta un 60% en IA', desc: 'El auto-routing manda los mensajes simples a modelos ligeros y los difíciles a los mejores.' },
      { title: 'Horario de atención', desc: 'Decides cuándo habla el agente y qué dice fuera de horario, por canal.' },
      { title: 'Revende con tu marca', desc: 'Las agencias crean agentes para clientes con marca blanca, dominio propio y su margen.' },
    ],
  },
  handoff: {
    title: 'Cuando el cliente se enfada, tu equipo entra con el resumen en la mano',
    desc: 'El agente detecta frustración o peticiones fuera de guion y pasa la conversación a una persona con lo que quiere el cliente, su estado de ánimo y el historial.',
    cardLabel: 'Paso a una persona',
    cardText: 'El pedido 214 llegó frío. Quiere reembolso o nueva entrega.',
    cardMeta: 'Ánimo: molesto · 6 pedidos desde marzo',
    copilot: 'El copiloto sugiere respuestas a tu equipo mientras habla con el cliente.',
  },
  antiBan: {
    title: 'Tu número no corre riesgo de bloqueo',
    desc: 'Nos conectamos por la API oficial de Meta para empresas, nunca con automatizaciones que imitan WhatsApp Web.',
    points: [
      { title: 'API oficial', desc: 'La misma WhatsApp Cloud API que Meta da a las grandes marcas.' },
      { title: 'Límites de envío', desc: 'En los mensajes proactivos fijas un tope diario y mensual.' },
      { title: 'El número es tuyo', desc: 'Queda registrado a tu nombre en Meta.' },
    ],
  },
  pricing: {
    title: 'Paga por conversaciones, no por sorpresas',
    sub: 'Cada plan dice cuántas conversaciones caben. Cuanto mayor el plan, más barato el crédito.',
    currencyEUR: '€ Europa',
    currencyBRL: 'R$ Brasil',
    free: 'Gratis',
    month: '/mes',
    conversations: 'conversaciones',
    credits: 'créditos/mes',
    creditsOnce: 'créditos (una vez)',
    agents: (n) => (n === 1 ? '1 agente' : `${n} agentes`),
    popular: 'El más elegido',
    plans: {
      free: { cta: 'Empezar gratis', features: ['1 número de WhatsApp', 'Chat web', 'Base de conocimiento', 'Paso a persona y recogida de datos', 'Modelos: Haiku / GPT-mini'] },
      starter: { cta: 'Empezar ahora', features: ['1 número de WhatsApp', 'Chat web', 'Subida de archivos', 'Add-ons: Ventas y Delivery¹, Pagos, Citas', 'Modelos: + Claude Sonnet', 'Soporte por email'] },
      business: { cta: 'Elegir Business', features: ['3 números de WhatsApp', 'Pagos, Citas y Feedback incluidos', 'Detección de ánimo', 'Acceso a la API', 'Modelos: + GPT-4o', 'Historial de 1 año'] },
      enterprise: { cta: 'Hablar con ventas', features: ['10 números de WhatsApp', 'Todas las skills (salvo Ventas¹ y a medida)', 'Claude Opus', 'Marca blanca incluida', 'SLA 24h', 'Historial ilimitado'] },
    },
    salesCta: 'Hablar con ventas',
    addonsTitle: 'Add-ons en cualquier plan de pago',
    addons: [
      { title: 'Créditos extra', desc: 'Paquetes de 5.000 créditos' },
      { title: 'Más agentes', desc: 'Añade agentes sin cambiar de plan' },
      { title: 'Marca blanca', desc: 'Portal con tu marca, sin Agentfy' },
      { title: 'Rollover (pronto)', desc: 'Pasa créditos no usados al mes siguiente' },
    ],
    footnote: '¹ Ventas y Delivery incluye pedidos, venta cruzada, cliente recurrente y pantalla de cocina. Las tarifas de mensajes de Meta, cuando existen, las factura Meta al dueño del número.',
    creditExplainer: '1 conversación ≈ 40 créditos (3 a 5 mensajes). Un pedido completo con pago ≈ 50 a 80.',
  },
  sectors: {
    title: 'Hecho para tu tipo de negocio',
    sub: 'Plantillas con las preguntas, reglas y skills correctas para cada sector.',
    items: [
      { slug: 'restaurantes', title: 'Restaurantes y delivery', desc: 'Pedidos, menú del día y zonas de entrega.' },
      { slug: 'clinicas', title: 'Clínicas', desc: 'Citas, recordatorios y triaje.' },
      { slug: 'saloes', title: 'Salones y estética', desc: 'Precios, disponibilidad y reservas.' },
      { slug: 'lojas', title: 'Tiendas online', desc: 'Estado de pedidos, cambios y devoluciones.' },
    ],
    more: 'Ver cómo funciona',
  },
  faq: {
    title: 'Preguntas frecuentes',
    items: [
      { q: '¿Qué es un crédito?', a: 'La unidad de consumo de la plataforma. 1 crédito ≈ 1.000 tokens en Claude Haiku (Sonnet y GPT-4o consumen 3×, Opus 5×). Una conversación media (3 a 5 mensajes) usa 30 a 50 créditos. Enviar mensajes no consume créditos: las tarifas de Meta las factura Meta al dueño del número.' },
      { q: '¿Qué pasa cuando se acaban los créditos?', a: 'El agente deja de responder. Recibes avisos al 30% y al 10%. Puedes comprar paquetes de 5.000 créditos o subir de plan.' },
      { q: '¿Por qué no usar solo el agente de IA de Meta?', a: 'El agente de Meta responde preguntas en WhatsApp e Instagram. Agentfy añade Telegram y el chat web, pedidos con pago y pantalla de cocina, citas en tu agenda, paso a persona con resumen y copiloto, elección del modelo de IA y marca blanca para agencias, con los datos en la UE.' },
      { q: '¿1 agente = 1 WhatsApp?', a: 'Sí. Cada agente se conecta a un número de WhatsApp y puede responder también en Instagram, Telegram y el chat web.' },
      { q: '¿Cuánto se tarda en crear un agente?', a: 'Menos de 10 minutos con el asistente de creación.' },
      { q: '¿Cómo conecto mi WhatsApp Business?', a: 'En la pestaña WhatsApp del agente pulsa "Continuar con Facebook / Meta", autentícate y el número queda conectado sin copiar tokens.' },
      { q: '¿Mi número corre riesgo de bloqueo?', a: 'No. Usamos la WhatsApp Cloud API oficial de Meta, nunca automatizaciones no oficiales.' },
      { q: '¿Puedo fijar un horario?', a: 'Sí. En cada canal defines franjas para días laborables y fines de semana y, si quieres, un mensaje automático fuera de horario.' },
      { q: '¿Puedo añadir más agentes sin cambiar de plan?', a: 'Sí, con un precio por agente al mes según tu plan.' },
      { q: '¿Puedo entrar con Facebook?', a: 'Sí, con el botón "Continuar con Facebook" en la pantalla de acceso.' },
    ],
  },
  cta: { title: 'Abre tu WhatsApp al mundo esta tarde', sub: 'Cuenta gratis con 1.000 créditos para probar. Sin tarjeta.', button: 'Crear cuenta gratis' },
  footer: { privacy: 'Política de privacidad', terms: 'Términos del servicio', deletion: 'Eliminación de datos', made: 'Hecho en Portugal · RGPD' },
};

const en: LandingCopy = {
  meta: {
    title: 'Agentfy — AI agent for WhatsApp, Instagram and Telegram',
    description:
      'AI agent on your WhatsApp: answers, takes orders with payment, books appointments and hands over to your team. Also on Instagram and Telegram. Ready in 10 min.',
    ogLocale: 'en_GB',
  },
  nav: { how: 'How it works', compare: 'Why Agentfy', sectors: 'Industries', pricing: 'Pricing', faq: 'FAQ', login: 'Log in', cta: 'Create my agent', menu: 'Menu' },
  hero: {
    title: 'Your WhatsApp sells. Even when closed.',
    sub: 'It answers, sells and books for you. An AI agent on the number you already use, trained on your menu, prices and rules. It takes orders, books appointments and hands the chat to your team when needed. On Instagram, Telegram and your website too.',
    cta: 'Start free in 10 minutes',
    secondary: "Why Meta's AI isn't enough",
    checks: ['Official Meta API, no ban risk', 'EU data · GDPR', 'No card on the Free plan'],
  },
  demo: {
    tablist: 'Examples by industry',
    online: 'online',
    placeholder: 'Message',
    scenarios: [
      {
        id: 'restaurant', label: 'Restaurant', business: 'The Corner Kitchen', hour: '23:12',
        messages: [
          { from: 'customer', text: 'Hi! Are you still delivering?', time: '23:12' },
          { from: 'agent', text: "Hi! Until 23:45, yes. Tonight's specials are duck rice and fish pie. What would you like?", time: '23:12' },
          { from: 'customer', text: '2 duck rice and a side salad to 14 Sun Street', time: '23:13' },
          { from: 'agent', text: "That's €31.50 with delivery, pay on arrival. Shall I confirm it?", time: '23:13' },
          { from: 'customer', text: 'Yes, confirm it', time: '23:14' },
        ],
        resultLabel: 'Order confirmed', resultText: 'No. 215 · €31.50 · pay on delivery', resultMeta: 'Already on the kitchen screen',
      },
      {
        id: 'clinic', label: 'Clinic', business: 'Smile Dental Clinic', hour: '21:40',
        messages: [
          { from: 'customer', text: "Hi, I'd like to book a cleaning", time: '21:40' },
          { from: 'agent', text: 'Hi! I have Thursday at 10:00 or Friday at 17:30 with Dr Marta. Which suits you?', time: '21:40' },
          { from: 'customer', text: 'Friday at 17:30', time: '21:41' },
          { from: 'agent', text: "Booked! I'll send you a reminder the day before.", time: '21:41' },
        ],
        resultLabel: 'Appointment booked', resultText: 'Friday 17:30 · Cleaning · Dr Marta', resultMeta: 'In Google Calendar',
      },
      {
        id: 'salon', label: 'Salon', business: 'Studio Luna', hour: '08:05',
        messages: [
          { from: 'customer', text: 'Morning, how much are highlights?', time: '08:05' },
          { from: 'agent', text: 'Good morning! From €45, depending on length. Is your hair shoulder length or longer?', time: '08:05' },
          { from: 'customer', text: 'Shoulder length. Saturday?', time: '08:06' },
          { from: 'agent', text: "Saturday at 11:00 with Inês. You're booked in.", time: '08:06' },
        ],
        resultLabel: 'Booking made', resultText: 'Saturday 11:00 · Highlights · Inês', resultMeta: 'Automatic reminder',
      },
      {
        id: 'shop', label: 'Online shop', business: 'Linen House', hour: '14:22',
        messages: [
          { from: 'customer', text: "My order still hasn't arrived", time: '14:22' },
          { from: 'agent', text: 'Sorry about that! Order 1093 shipped yesterday and arrives tomorrow. Want the tracking code?', time: '14:22' },
          { from: 'customer', text: "That's the second delay, I'm fed up", time: '14:23' },
          { from: 'agent', text: "You're absolutely right. I'm passing you to Sofia on our team with a summary of the issue.", time: '14:23' },
        ],
        resultLabel: 'Handed to a person', resultText: 'Upset customer · repeated delay', resultMeta: 'Sofia notified with summary',
      },
    ],
  },
  omni: {
    title: 'Omnichat: one agent, every channel',
    sub: 'The same agent, with the same knowledge and rules, answers wherever your customers are. Set it up once.',
    channels: [
      { name: 'WhatsApp', desc: 'Your own number, via the official API' },
      { name: 'Instagram', desc: 'Direct messages on your Business account' },
      { name: 'Telegram', desc: 'A bot with your business name' },
      { name: 'Website chat', desc: 'A widget or a public link' },
    ],
    inboxNote: 'Every conversation, order and contact in one dashboard, with history and CRM.',
  },
  how: {
    title: 'From zero to first order in an afternoon',
    steps: [
      { time: '2 min', title: 'Describe your business', desc: 'The setup assistant asks the right questions and writes the agent rules for you.' },
      { time: '3 min', title: 'Give it your menu', desc: 'PDF, Word, Excel, a link, your website or a YouTube video. It learns what you sell and for how much.' },
      { time: '3 min', title: 'Connect the channels', desc: 'Sign in with Meta and the agent is on your WhatsApp Business number. Instagram, Telegram and website chat in the same step.' },
      { time: '2 min', title: 'Test and go live', desc: 'Test chats, opening hours and who receives handovers.' },
    ],
  },
  vsMeta: {
    eyebrowless: '',
    title: "Why not just use Meta's AI?",
    sub: 'Meta now has an AI agent in WhatsApp Business. It answers questions. A business that sells needs more.',
    colTopic: '',
    colUs: 'Agentfy',
    colThem: 'Meta Business AI',
    rows: [
      { topic: 'Channels', us: 'WhatsApp, Instagram, Telegram and your website chat, in one agent', them: 'WhatsApp and Instagram only' },
      { topic: 'Orders and payments', us: 'Cart in the chat, payments (MB WAY and Multibanco in Portugal), kitchen screen and delivery status', them: 'Suggests products; ordering and payment are up to you' },
      { topic: 'Human handover', us: "Summary, customer mood and suggested replies for your team", them: 'The agent stops replying and loses the context when it takes back over' },
      { topic: 'Training', us: 'PDF, Word, Excel, websites and YouTube, including tables and prices', them: 'Fixed business profile, FAQs and files; CSV and PDF tables fail' },
      { topic: 'AI model', us: 'Choose Claude or GPT, or let auto-routing save credits', them: "Meta's model only" },
      { topic: 'Pricing', us: 'Credits shown as conversations, in € or R$', them: 'WhatsApp Business Premium tiers or tokens billed by Meta' },
      { topic: 'For agencies', us: 'White-label with your brand and domain', them: 'Not available' },
      { topic: 'Your data', us: 'In the EU, with export and deletion on request', them: "On Meta's infrastructure" },
    ],
    footnote: 'Comparison based on public documentation from Meta and official partners, October 2026.',
  },
  diffs: {
    title: 'What sets us apart',
    items: [
      { title: 'Built in Portugal for Europe and Brazil', desc: 'Native Portuguese and Spanish, euro invoicing and BRL pricing for Brazil.' },
      { title: 'Orders end to end', desc: 'Cart, upselling, payment, kitchen screen and order status for the customer.' },
      { title: 'Bookings in your calendar', desc: 'Connects to Google Calendar, offers free slots and confirms.' },
      { title: 'Save up to 60% on AI', desc: 'Auto-routing sends simple messages to light models and hard ones to the best.' },
      { title: 'Opening hours', desc: 'Decide when the agent talks and what it says after hours, per channel.' },
      { title: 'Resell under your brand', desc: 'Agencies build agents for clients with white-label, their own domain and their own margin.' },
    ],
  },
  handoff: {
    title: 'When a customer gets upset, your team steps in with the summary in hand',
    desc: 'The agent spots frustration or off-script requests and hands the chat to a person with what the customer wants, their mood and the history.',
    cardLabel: 'Human handover',
    cardText: 'Order 214 arrived cold. Wants a refund or a new delivery.',
    cardMeta: 'Mood: upset · 6 orders since March',
    copilot: 'The copilot suggests replies to your team while they talk to the customer.',
  },
  antiBan: {
    title: 'No risk of your number being banned',
    desc: "We connect through Meta's official business API, never through tools that imitate WhatsApp Web.",
    points: [
      { title: 'Official API', desc: 'The same WhatsApp Cloud API Meta gives to big brands.' },
      { title: 'Sending limits', desc: 'Set daily and monthly caps for proactive messages.' },
      { title: 'Your number stays yours', desc: 'It stays registered to you at Meta.' },
    ],
  },
  pricing: {
    title: 'Pay for conversations, not surprises',
    sub: 'Each plan tells you how many conversations it covers. The bigger the plan, the cheaper each credit.',
    currencyEUR: '€ Europe',
    currencyBRL: 'R$ Brazil',
    free: 'Free',
    month: '/mo',
    conversations: 'conversations',
    credits: 'credits/mo',
    creditsOnce: 'credits (one-off)',
    agents: (n) => (n === 1 ? '1 agent' : `${n} agents`),
    popular: 'Most popular',
    plans: {
      free: { cta: 'Start free', features: ['1 WhatsApp number', 'Website chat', 'Knowledge base', 'Human handover and data capture', 'Models: Haiku / GPT-mini'] },
      starter: { cta: 'Get started', features: ['1 WhatsApp number', 'Website chat', 'File uploads', 'Add-ons: Sales & Delivery¹, Payments, Bookings', 'Models: + Claude Sonnet', 'Email support'] },
      business: { cta: 'Choose Business', features: ['3 WhatsApp numbers', 'Payments, Bookings and Feedback included', 'Mood detection', 'API access', 'Models: + GPT-4o', '1-year history'] },
      enterprise: { cta: 'Talk to sales', features: ['10 WhatsApp numbers', 'All skills (except Sales¹ and custom)', 'Claude Opus', 'White-label included', '24h SLA', 'Unlimited history'] },
    },
    salesCta: 'Talk to sales',
    addonsTitle: 'Add-ons on any paid plan',
    addons: [
      { title: 'Extra credits', desc: 'Packs of 5,000 credits' },
      { title: 'More agents', desc: 'Add agents without changing plan' },
      { title: 'White-label', desc: 'Portal with your brand, no Agentfy' },
      { title: 'Rollover (soon)', desc: 'Carry unused credits to next month' },
    ],
    footnote: "¹ Sales & Delivery includes orders, upselling, returning customers and kitchen screen. Meta's messaging fees, where they apply, are billed by Meta to the number's owner.",
    creditExplainer: '1 conversation ≈ 40 credits (3 to 5 messages). A full order with payment ≈ 50 to 80.',
  },
  sectors: {
    title: 'Made for your kind of business',
    sub: 'Templates with the right questions, rules and skills for each industry.',
    items: [
      { slug: 'restaurantes', title: 'Restaurants and delivery', desc: 'Orders, daily menu and delivery zones.' },
      { slug: 'clinicas', title: 'Clinics', desc: 'Appointments, reminders and triage.' },
      { slug: 'saloes', title: 'Salons and beauty', desc: 'Prices, availability and bookings.' },
      { slug: 'lojas', title: 'Online shops', desc: 'Order status, exchanges and returns.' },
    ],
    more: 'See how it works',
  },
  faq: {
    title: 'Frequently asked questions',
    items: [
      { q: 'What is a credit?', a: "The platform's unit of usage. 1 credit ≈ 1,000 tokens on Claude Haiku (Sonnet and GPT-4o use 3×, Opus 5×). An average conversation (3 to 5 messages) uses 30 to 50 credits. Sending messages doesn't use credits: Meta's fees are billed by Meta to the number's owner." },
      { q: 'What happens when credits run out?', a: 'The agent stops replying. You get warnings at 30% and 10%. You can buy packs of 5,000 credits or upgrade.' },
      { q: "Why not just use Meta's AI agent?", a: "Meta's agent answers questions on WhatsApp and Instagram. Agentfy adds Telegram and website chat, orders with payment and a kitchen screen, bookings in your calendar, human handover with summary and copilot, a choice of AI model and white-label for agencies, with data kept in the EU." },
      { q: '1 agent = 1 WhatsApp number?', a: 'Yes. Each agent is linked to one WhatsApp number and can also answer on Instagram, Telegram and website chat.' },
      { q: 'How long does it take to create an agent?', a: 'Under 10 minutes with the setup assistant.' },
      { q: 'How do I connect WhatsApp Business?', a: 'In the agent\'s WhatsApp tab, click "Continue with Facebook / Meta", sign in and the number is connected without copying tokens.' },
      { q: 'Could my number get banned?', a: "No. We use Meta's official WhatsApp Cloud API, never unofficial automations." },
      { q: 'Can I set opening hours?', a: 'Yes. Per channel you set weekday and weekend windows and, optionally, an after-hours auto-reply.' },
      { q: 'Can I add agents without changing plan?', a: 'Yes, for a monthly price per agent depending on your plan.' },
      { q: 'Can I sign in with Facebook?', a: 'Yes, with "Continue with Facebook" on the sign-in screen.' },
    ],
  },
  cta: { title: 'Open your WhatsApp to the world this afternoon', sub: 'Free account with 1,000 credits to try. No card.', button: 'Create free account' },
  footer: { privacy: 'Privacy Policy', terms: 'Terms of Service', deletion: 'Data Deletion', made: 'Made in Portugal · GDPR' },
};

export const LANDING_COPY: Record<LandingLocale, LandingCopy> = { pt, es, en };

export function landingLocale(locale: string | undefined): LandingLocale {
  return locale === 'es' || locale === 'en' ? locale : 'pt';
}
