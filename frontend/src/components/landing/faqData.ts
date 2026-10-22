import type { LandingLocale } from './copy';

/**
 * Conteúdo da página /faq (pt/es/en). Fontes: FAQ_ONBOARDING_WHATSAPP.md,
 * AGENTIFY_KNOWLEDGE_BASE.md e a FAQ da landing (copy.ts). Cada resposta abre
 * com a resposta direta. O JSON-LD FAQPage é gerado destes mesmos dados.
 */
export interface FaqCategory { id: string; title: string; items: { q: string; a: string }[] }
export interface FaqPageCopy {
  meta: { title: string; description: string };
  h1: string;
  intro: string;
  indexLabel: string;
  searchLabel: string;
  searchPlaceholder: string;
  noResults: string;
  results: (n: number) => string;
  updated: string;
  ctaTitle: string;
  ctaSub: string;
  ctaButton: string;
  ctaContact: string;
  categories: FaqCategory[];
}

const pt: FaqPageCopy = {
  meta: {
    title: 'Perguntas frequentes sobre o Agentfy e o WhatsApp com IA',
    description: 'Respostas diretas sobre preços, créditos, API oficial da Meta, risco de ban, RGPD, MB WAY, passagem para humano e tempo de configuração do Agentfy no WhatsApp.',
  },
  h1: 'Perguntas frequentes',
  intro: 'Tudo o que costumam perguntar antes de ligar um agente de IA ao WhatsApp: preços, créditos, a API oficial da Meta, dados na UE, pagamentos e o que acontece quando o cliente quer falar com uma pessoa.',
  indexLabel: 'Categorias',
  searchLabel: 'Pesquisar nas perguntas',
  searchPlaceholder: 'Pesquisar, por exemplo MB WAY ou ban',
  noResults: 'Nenhuma pergunta encontrada. Escreve-nos e respondemos no mesmo dia útil.',
  results: (n) => (n === 1 ? '1 pergunta encontrada' : `${n} perguntas encontradas`),
  updated: 'Atualizado em outubro de 2026',
  ctaTitle: 'Ainda tens dúvidas?',
  ctaSub: 'Cria a conta grátis com 1.000 créditos e testa com o teu negócio, ou escreve-nos.',
  ctaButton: 'Criar conta grátis',
  ctaContact: 'Falar com a equipa',
  categories: [
    {
      id: 'comecar', title: 'Começar e configurar',
      items: [
        { q: 'Quanto tempo demora a criar um agente?', a: 'Menos de 10 minutos com o assistente de criação. Descreves o negócio, dás-lhe o menu ou a lista de preços (PDF, Word, Excel, link ou vídeo do YouTube) e ele escreve as regras e sugere as skills. Podes ajustar tudo depois, a qualquer momento.' },
        { q: 'Preciso de saber programar?', a: 'Não. A plataforma foi desenhada para donos de negócio, por isso não escreves código. O assistente faz as perguntas certas, e a ligação ao WhatsApp faz-se com um clique em "Continuar com Facebook / Meta".' },
        { q: 'Posso usar o número de WhatsApp que já tenho?', a: 'Sim, mas esse número deixa de funcionar na app WhatsApp normal. Ao ligares à API oficial, o mesmo número não pode estar também na app, por isso, se quiseres manter a app, usa um segundo número (um segundo SIM ou VoIP) para o agente.' },
        { q: 'Como ligo o WhatsApp Business ao agente?', a: 'No separador WhatsApp do agente, clica em "Continuar com Facebook / Meta" e segue o popup da Meta. Crias (ou escolhes) a tua conta WhatsApp Business, confirmas o número com um código por SMS ou chamada, e o token fica guardado automaticamente. Depois envias uma mensagem de teste.' },
        { q: 'Posso testar antes de ligar o número real?', a: 'Sim. O plano Free dá 1.000 créditos, sem cartão, e a Meta disponibiliza um número de teste gratuito em Meta for Developers. Podes ainda fazer conversas de teste no próprio painel antes de ativar o agente.' },
      ],
    },
    {
      id: 'whatsapp', title: 'WhatsApp, API oficial e Meta',
      items: [
        { q: 'O meu número corre risco de ser banido?', a: 'Não. Ligamo-nos pela WhatsApp Cloud API oficial da Meta, a mesma que a Meta dá às grandes marcas, e nunca por automações que imitam o WhatsApp Web, que são essas que levam a bans. O número fica registado em teu nome e as mensagens proativas respeitam os limites diários e mensais que defines.' },
        { q: 'A Meta cobra pelas mensagens? Quem paga?', a: 'Quem paga é o dono do número, diretamente à Meta, no cartão que regista na conta WhatsApp Business. Desde 1 de outubro de 2026 a Meta cobra as respostas acima de 1.000 por número por mês, cerca de €0,014 por mensagem em Portugal. O Agentfy não cobra nada a mais: os créditos cobrem só a IA e enviar mensagens não consome créditos.' },
        { q: 'Preciso de uma página de Facebook ou de verificar a empresa?', a: 'Para testar não. Basta uma conta pessoal de Facebook para autenticar; se não tiveres Business Manager, o fluxo cria-o. Para enviar a números fora da tua lista de teste, a Meta pede a verificação da empresa, que demora normalmente 1 a 3 dias úteis.' },
        { q: 'Porque não usar só o agente de IA da Meta?', a: 'Porque o agente da Meta responde a perguntas, e um negócio que vende precisa de mais. O Agentfy junta Telegram e chat do site, encomendas com pagamento e ecrã da cozinha, marcações na tua agenda, passagem para humano com resumo, escolha do modelo de IA, white-label para agências e dados na UE.' },
        { q: 'O agente responde 24 horas por dia?', a: 'Sim, a qualquer hora, 7 dias por semana. Se preferires, defines o horário de funcionamento por canal e uma mensagem automática para fora de horas.' },
      ],
    },
    {
      id: 'canais', title: 'Canais e idiomas',
      items: [
        { q: 'Que canais o agente cobre?', a: 'WhatsApp, Instagram, Telegram e o chat do teu site, todos com o mesmo agente, o mesmo conhecimento e as mesmas regras. Todas as conversas, encomendas e contactos ficam num só painel, com histórico e CRM.' },
        { q: '1 agente corresponde a 1 número de WhatsApp?', a: 'Sim. Cada agente está ligado a um número de WhatsApp dedicado, e o mesmo agente pode responder também no Instagram, no Telegram e no chat do site. Se tens vários pontos de venda, o plano Business tem 3 agentes e o Enterprise 10, com agentes extra em qualquer plano pago.' },
        { q: 'Como ligo o Instagram?', a: 'Precisas de uma conta Instagram Business ou Creator ligada a uma Página de Facebook que administras. No separador Instagram do agente, clicas em "Continuar com Facebook", escolhes a Página e aceitas as permissões. A API de mensagens do Instagram não tem custo por mensagem.' },
        { q: 'Em que idiomas responde?', a: 'Português, inglês, espanhol, francês, alemão, italiano, neerlandês e árabe, automaticamente e sem configuração. O agente responde no idioma em que o cliente escreve.' },
      ],
    },
    {
      id: 'planos', title: 'Planos, créditos e preços',
      items: [
        { q: 'O que é um crédito?', a: 'É a unidade de consumo da plataforma: 1 crédito corresponde a cerca de 1.000 tokens no Claude Haiku. O Sonnet e o GPT-4o gastam 3 vezes mais, o Opus 5 vezes. Uma conversa média (3 a 5 trocas) usa 30 a 50 créditos e um pedido completo com pagamento 50 a 80, e para estimar usa-se cerca de 40 créditos por conversa.' },
        { q: 'Quanto custa o Agentfy?', a: 'O plano Free custa €0 e dá 1.000 créditos uma só vez. O Starter custa €49 por mês (18.000 créditos, cerca de 450 conversas), o Business €129 (49.000 créditos, 3 agentes) e o Enterprise €349 (134.000 créditos, 10 agentes e white-label incluído). No Brasil os planos estão em reais e a assinatura paga-se por PIX ou cartão.' },
        { q: 'O que acontece quando os créditos acabam?', a: 'O agente deixa de responder até renovares ou acrescentares créditos. Recebes avisos aos 30% e aos 10%, e podes comprar pacotes de 5.000 créditos (€14 a €16, conforme o plano) ou mudar para um plano maior.' },
        { q: 'Como escolho o plano certo?', a: 'Multiplica as conversas do mês por cerca de 40 créditos. Até uns 450 conversas por mês o Starter chega, até uns 1.250 ou mais de um número o Business, e acima disso, com vários pontos de venda, franquias ou agências, o Enterprise.' },
        { q: 'Posso cancelar quando quiser?', a: 'Sim, a qualquer momento e sem fidelização. Os créditos do mês já pagos não são reembolsados.' },
      ],
    },
    {
      id: 'pagamentos', title: 'Encomendas e pagamentos',
      items: [
        { q: 'O agente recebe pedidos e cobra com MB WAY?', a: 'Sim. Com a skill Vendas e Delivery o agente monta o carrinho na conversa, e com a skill Pagamentos gera a referência MB WAY, Multibanco ou PIX e confirma sozinho quando o pagamento chega. O pedido segue para o ecrã da cozinha.' },
        { q: 'Como pago a assinatura do Agentfy?', a: 'Na Europa com MB WAY, Multibanco ou cartão, e no Brasil com PIX ou cartão. O plano fica ativo quando o pagamento é confirmado.' },
        { q: 'O agente reconhece clientes que já compraram?', a: 'Sim. Com a skill Vendas e Delivery o agente lê o histórico de pedidos desse número de WhatsApp e personaliza a conversa com os favoritos do cliente, além de sugerir upselling no momento certo.' },
        { q: 'O agente faz marcações?', a: 'Sim. A skill de marcações liga à tua Google Calendar, propõe só horários livres, confirma com o cliente e envia um lembrete na véspera.' },
      ],
    },
    {
      id: 'privacidade', title: 'Dados, RGPD e segurança',
      items: [
        { q: 'Onde ficam os meus dados?', a: 'Em servidores na União Europeia, em conformidade com o RGPD. Os dados são cifrados com AES-256 em trânsito e em repouso, com backups diários automáticos.' },
        { q: 'Posso exportar ou apagar os dados dos meus clientes?', a: 'Sim, a pedido. Fazemos a exportação e a eliminação dos dados, e a página Eliminação de Dados explica como pedir a remoção da tua conta e das conversas.' },
        { q: 'A conta tem autenticação de dois fatores?', a: 'Sim, a autenticação de dois fatores (Google Authenticator) está disponível em todas as contas. Nos planos Business e superiores há ainda um registo de todas as ações feitas na conta.' },
        { q: 'O Agentfy usa as minhas conversas para treinar modelos?', a: 'As conversas servem para o agente responder ao teu negócio e para o teu histórico e CRM. Os detalhes de tratamento, finalidades e bases legais estão na Política de Privacidade.' },
      ],
    },
    {
      id: 'equipa', title: 'Equipa, humanos e suporte',
      items: [
        { q: 'E se o cliente quiser falar com uma pessoa?', a: 'O agente passa a conversa à tua equipa com um resumo do que o cliente quer, o humor e o histórico. Isto acontece quando o cliente pede, quando o agente não tem confiança suficiente ou quando deteta frustração, e o copiloto sugere respostas enquanto a tua equipa fala com o cliente.' },
        { q: 'Posso ter o agente com a minha marca?', a: 'Sim, com o white-label: portal com o teu logo, cores e domínio, sem referências ao Agentfy. Está incluído no Enterprise e é um add-on no Starter e no Business, pensado para agências que revendem.' },
        { q: 'Como é o suporte?', a: 'No Free há documentação online, no Starter suporte por email, no Business email prioritário e no Enterprise SLA de 24 horas. Podes escrever a qualquer altura para contact@solutions.shaklabs.tech.' },
        { q: 'Posso entrar com o Facebook?', a: 'Sim. No ecrã de entrada tens "Continuar com Facebook", e também podes associar o Facebook mais tarde, no teu perfil.' },
      ],
    },
  ],
};

const es: FaqPageCopy = {
  meta: {
    title: 'Preguntas frecuentes sobre Agentfy y WhatsApp con IA',
    description: 'Respuestas directas sobre precios, créditos, API oficial de Meta, riesgo de baneo, RGPD, pagos, traspaso a una persona y tiempo de configuración de Agentfy.',
  },
  h1: 'Preguntas frecuentes',
  intro: 'Todo lo que suelen preguntar antes de conectar un agente de IA a WhatsApp: precios, créditos, la API oficial de Meta, datos en la UE, pagos y qué pasa cuando el cliente quiere hablar con una persona.',
  indexLabel: 'Categorías',
  searchLabel: 'Buscar en las preguntas',
  searchPlaceholder: 'Buscar, por ejemplo pagos o baneo',
  noResults: 'No hay preguntas que coincidan. Escríbenos y respondemos el mismo día laborable.',
  results: (n) => (n === 1 ? '1 pregunta encontrada' : `${n} preguntas encontradas`),
  updated: 'Actualizado en octubre de 2026',
  ctaTitle: '¿Sigues con dudas?',
  ctaSub: 'Crea la cuenta gratis con 1.000 créditos y pruébalo con tu negocio, o escríbenos.',
  ctaButton: 'Crear cuenta gratis',
  ctaContact: 'Hablar con el equipo',
  categories: [
    {
      id: 'empezar', title: 'Empezar y configurar',
      items: [
        { q: '¿Cuánto tarda en crearse un agente?', a: 'Menos de 10 minutos con el asistente de creación. Describes el negocio, le das la carta o la lista de precios (PDF, Word, Excel, enlace o vídeo de YouTube) y él escribe las reglas y sugiere las skills. Puedes ajustarlo todo después, cuando quieras.' },
        { q: '¿Necesito saber programar?', a: 'No. La plataforma está pensada para dueños de negocio, así que no escribes código. El asistente te hace las preguntas adecuadas y la conexión con WhatsApp se hace con un clic en "Continuar con Facebook / Meta".' },
        { q: '¿Puedo usar el número de WhatsApp que ya tengo?', a: 'Sí, pero ese número deja de funcionar en la app normal de WhatsApp. Al conectarlo a la API oficial, el mismo número no puede estar también en la app; si quieres conservarla, usa un segundo número (otra SIM o VoIP) para el agente.' },
        { q: '¿Cómo conecto WhatsApp Business al agente?', a: 'En la pestaña WhatsApp del agente, pulsa "Continuar con Facebook / Meta" y sigue el popup de Meta. Creas (o eliges) tu cuenta de WhatsApp Business, confirmas el número con un código por SMS o llamada y el token se guarda solo. Después envías un mensaje de prueba.' },
        { q: '¿Puedo probar antes de conectar el número real?', a: 'Sí. El plan Free da 1.000 créditos sin tarjeta y Meta ofrece un número de prueba gratuito en Meta for Developers. También puedes hacer conversaciones de prueba en el propio panel antes de activar el agente.' },
      ],
    },
    {
      id: 'whatsapp', title: 'WhatsApp, API oficial y Meta',
      items: [
        { q: '¿Mi número corre riesgo de ser baneado?', a: 'No. Nos conectamos por la WhatsApp Cloud API oficial de Meta, la misma que Meta da a las grandes marcas, y nunca con automatizaciones que imitan WhatsApp Web, que son las que provocan baneos. El número queda registrado a tu nombre y los mensajes proactivos respetan los límites diarios y mensuales que defines.' },
        { q: '¿Meta cobra por los mensajes? ¿Quién paga?', a: 'Paga el dueño del número, directamente a Meta, con la tarjeta que registra en la cuenta de WhatsApp Business. Desde el 1 de octubre de 2026 Meta cobra las respuestas por encima de 1.000 por número y mes, unos 0,014 € por mensaje en Portugal. Agentfy no cobra nada extra: los créditos cubren solo la IA y enviar mensajes no consume créditos.' },
        { q: '¿Necesito una página de Facebook o verificar la empresa?', a: 'Para probar no. Basta una cuenta personal de Facebook para autenticarte; si no tienes Business Manager, el flujo lo crea. Para enviar a números fuera de tu lista de prueba, Meta pide la verificación de la empresa, que suele tardar de 1 a 3 días laborables.' },
        { q: '¿Por qué no usar solo el agente de IA de Meta?', a: 'Porque el agente de Meta responde preguntas, y un negocio que vende necesita más. Agentfy suma Telegram y chat web, pedidos con pago y pantalla de cocina, citas en tu agenda, traspaso a una persona con resumen, elección del modelo de IA, white-label para agencias y datos en la UE.' },
        { q: '¿El agente responde las 24 horas?', a: 'Sí, a cualquier hora, los 7 días de la semana. Si prefieres, defines el horario por canal y un mensaje automático fuera de horario.' },
      ],
    },
    {
      id: 'canales', title: 'Canales e idiomas',
      items: [
        { q: '¿Qué canales cubre el agente?', a: 'WhatsApp, Instagram, Telegram y el chat de tu web, todos con el mismo agente, el mismo conocimiento y las mismas reglas. Todas las conversaciones, pedidos y contactos quedan en un solo panel, con historial y CRM.' },
        { q: '¿1 agente equivale a 1 número de WhatsApp?', a: 'Sí. Cada agente está conectado a un número de WhatsApp propio y el mismo agente también puede responder en Instagram, Telegram y el chat web. Si tienes varios puntos de venta, el plan Business incluye 3 agentes y el Enterprise 10, con agentes extra en cualquier plan de pago.' },
        { q: '¿Cómo conecto Instagram?', a: 'Necesitas una cuenta de Instagram Business o Creator vinculada a una Página de Facebook que administres. En la pestaña Instagram del agente pulsas "Continuar con Facebook", eliges la Página y aceptas los permisos. La API de mensajes de Instagram no tiene coste por mensaje.' },
        { q: '¿En qué idiomas responde?', a: 'Portugués, inglés, español, francés, alemán, italiano, neerlandés y árabe, de forma automática y sin configurar nada. El agente responde en el idioma en que escribe el cliente.' },
      ],
    },
    {
      id: 'planes', title: 'Planes, créditos y precios',
      items: [
        { q: '¿Qué es un crédito?', a: 'Es la unidad de consumo de la plataforma: 1 crédito equivale a unos 1.000 tokens en Claude Haiku. Sonnet y GPT-4o gastan 3 veces más y Opus 5 veces. Una conversación media (3 a 5 intercambios) usa de 30 a 50 créditos y un pedido completo con pago de 50 a 80; para estimar se cuentan unos 40 créditos por conversación.' },
        { q: '¿Cuánto cuesta Agentfy?', a: 'El plan Free cuesta 0 € y da 1.000 créditos una sola vez. Starter cuesta 49 € al mes (18.000 créditos, unas 450 conversaciones), Business 129 € (49.000 créditos, 3 agentes) y Enterprise 349 € (134.000 créditos, 10 agentes y white-label incluido). En Brasil los planes están en reales y la suscripción se paga con PIX o tarjeta.' },
        { q: '¿Qué pasa cuando se acaban los créditos?', a: 'El agente deja de responder hasta que renueves o añadas créditos. Recibes avisos al 30 % y al 10 %, y puedes comprar paquetes de 5.000 créditos (de 14 € a 16 € según el plan) o pasar a un plan mayor.' },
        { q: '¿Cómo elijo el plan adecuado?', a: 'Multiplica las conversaciones del mes por unos 40 créditos. Hasta unas 450 conversaciones al mes basta Starter, hasta unas 1.250 o más de un número Business, y por encima, con varios puntos de venta, franquicias o agencias, Enterprise.' },
        { q: '¿Puedo cancelar cuando quiera?', a: 'Sí, en cualquier momento y sin permanencia. Los créditos del mes ya pagado no se reembolsan.' },
      ],
    },
    {
      id: 'pagos', title: 'Pedidos y pagos',
      items: [
        { q: '¿El agente toma pedidos y cobra?', a: 'Sí. Con la skill Ventas y Delivery el agente arma el carrito en la conversación, y con la skill Pagos genera la referencia MB WAY, Multibanco o PIX y confirma solo cuando llega el pago. El pedido pasa a la pantalla de cocina.' },
        { q: '¿Cómo pago la suscripción de Agentfy?', a: 'En Europa con MB WAY, Multibanco o tarjeta, y en Brasil con PIX o tarjeta. El plan se activa cuando se confirma el pago.' },
        { q: '¿El agente reconoce a clientes que ya compraron?', a: 'Sí. Con la skill Ventas y Delivery el agente lee el historial de pedidos de ese número de WhatsApp y personaliza la conversación con los favoritos del cliente, además de proponer venta cruzada en el momento justo.' },
        { q: '¿El agente agenda citas?', a: 'Sí. La skill de citas se conecta a tu Google Calendar, propone solo huecos libres, confirma con el cliente y envía un recordatorio el día antes.' },
      ],
    },
    {
      id: 'privacidad', title: 'Datos, RGPD y seguridad',
      items: [
        { q: '¿Dónde se guardan mis datos?', a: 'En servidores de la Unión Europea, conforme al RGPD. Los datos se cifran con AES-256 en tránsito y en reposo y hay copias de seguridad diarias automáticas.' },
        { q: '¿Puedo exportar o borrar los datos de mis clientes?', a: 'Sí, a petición. Hacemos la exportación y la eliminación de datos, y la página Eliminación de Datos explica cómo pedir el borrado de tu cuenta y de las conversaciones.' },
        { q: '¿La cuenta tiene autenticación en dos pasos?', a: 'Sí, la autenticación de dos factores (Google Authenticator) está disponible en todas las cuentas. En los planes Business y superiores hay además un registro de todas las acciones de la cuenta.' },
        { q: '¿Agentfy usa mis conversaciones para entrenar modelos?', a: 'Las conversaciones sirven para que el agente responda por tu negocio y para tu historial y CRM. Los detalles del tratamiento, las finalidades y las bases legales están en la Política de Privacidad.' },
      ],
    },
    {
      id: 'equipo', title: 'Equipo, personas y soporte',
      items: [
        { q: '¿Y si el cliente quiere hablar con una persona?', a: 'El agente pasa la conversación a tu equipo con un resumen de lo que quiere el cliente, su estado de ánimo y el historial. Ocurre cuando el cliente lo pide, cuando el agente no tiene confianza suficiente o cuando detecta frustración, y el copiloto sugiere respuestas mientras tu equipo habla con el cliente.' },
        { q: '¿Puedo tener el agente con mi marca?', a: 'Sí, con el white-label: portal con tu logo, colores y dominio, sin referencias a Agentfy. Está incluido en Enterprise y es un add-on en Starter y Business, pensado para agencias que revenden.' },
        { q: '¿Cómo es el soporte?', a: 'En Free hay documentación online, en Starter soporte por email, en Business email prioritario y en Enterprise SLA de 24 horas. Puedes escribir cuando quieras a contact@solutions.shaklabs.tech.' },
        { q: '¿Puedo entrar con Facebook?', a: 'Sí. En la pantalla de acceso tienes "Continuar con Facebook" y también puedes asociar Facebook más tarde desde tu perfil.' },
      ],
    },
  ],
};

const en: FaqPageCopy = {
  meta: {
    title: 'Agentfy FAQ: WhatsApp AI agent pricing, API and data',
    description: 'Straight answers on pricing, credits, the official Meta API, ban risk, GDPR, payments, human handover and setup time for the Agentfy WhatsApp AI agent.',
  },
  h1: 'Frequently asked questions',
  intro: 'Everything people ask before connecting an AI agent to WhatsApp: pricing, credits, the official Meta API, EU data, payments and what happens when a customer wants to talk to a person.',
  indexLabel: 'Categories',
  searchLabel: 'Search the questions',
  searchPlaceholder: 'Search, for example payments or ban',
  noResults: 'No matching questions. Write to us and we reply the same working day.',
  results: (n) => (n === 1 ? '1 question found' : `${n} questions found`),
  updated: 'Updated October 2026',
  ctaTitle: 'Still have questions?',
  ctaSub: 'Create a free account with 1,000 credits and try it with your business, or write to us.',
  ctaButton: 'Create free account',
  ctaContact: 'Talk to the team',
  categories: [
    {
      id: 'getting-started', title: 'Getting started and setup',
      items: [
        { q: 'How long does it take to create an agent?', a: 'Under 10 minutes with the setup assistant. You describe the business, give it your menu or price list (PDF, Word, Excel, a link or a YouTube video) and it writes the rules and suggests the skills. You can adjust everything afterwards, any time.' },
        { q: 'Do I need to know how to code?', a: 'No. The platform is built for business owners, so there is no code to write. The assistant asks the right questions and connecting WhatsApp takes one click on "Continue with Facebook / Meta".' },
        { q: 'Can I use the WhatsApp number I already have?', a: 'Yes, but that number stops working in the regular WhatsApp app. Once it is connected to the official API the same number cannot also stay in the app, so if you want to keep the app, use a second number (another SIM or VoIP) for the agent.' },
        { q: 'How do I connect WhatsApp Business to the agent?', a: 'In the agent\'s WhatsApp tab, click "Continue with Facebook / Meta" and follow the Meta popup. You create (or pick) your WhatsApp Business account, confirm the number with a code by SMS or call, and the token is saved automatically. Then you send a test message.' },
        { q: 'Can I test before connecting my real number?', a: 'Yes. The Free plan gives 1,000 credits with no card, and Meta provides a free test number in Meta for Developers. You can also run test conversations in the dashboard before turning the agent on.' },
      ],
    },
    {
      id: 'whatsapp', title: 'WhatsApp, official API and Meta',
      items: [
        { q: 'Could my number get banned?', a: 'No. We connect through Meta\'s official WhatsApp Cloud API, the same one Meta gives large brands, and never through automations that imitate WhatsApp Web, which are the ones that cause bans. The number is registered in your name and proactive messages respect the daily and monthly caps you set.' },
        { q: 'Does Meta charge for messages? Who pays?', a: 'The number\'s owner pays Meta directly, on the card registered in the WhatsApp Business account. Since 1 October 2026 Meta charges for replies above 1,000 per number per month, about €0.014 per message in Portugal. Agentfy adds nothing on top: credits cover only the AI, and sending messages does not use credits.' },
        { q: 'Do I need a Facebook Page or a verified business?', a: 'Not to test. A personal Facebook account is enough to authenticate, and if you have no Business Manager the flow creates one. To message numbers outside your test list, Meta asks for business verification, which usually takes 1 to 3 working days.' },
        { q: 'Why not just use Meta\'s own AI agent?', a: 'Because Meta\'s agent answers questions, and a business that sells needs more. Agentfy adds Telegram and website chat, orders with payment and a kitchen screen, bookings in your calendar, human handover with a summary, a choice of AI model, white-label for agencies and EU data.' },
        { q: 'Does the agent answer 24 hours a day?', a: 'Yes, at any hour, 7 days a week. If you prefer, you set opening hours per channel and an automatic after-hours message.' },
      ],
    },
    {
      id: 'channels', title: 'Channels and languages',
      items: [
        { q: 'Which channels does the agent cover?', a: 'WhatsApp, Instagram, Telegram and your website chat, all with the same agent, the same knowledge and the same rules. Every conversation, order and contact lands in one dashboard, with history and CRM.' },
        { q: 'Is 1 agent equal to 1 WhatsApp number?', a: 'Yes. Each agent is linked to one dedicated WhatsApp number, and the same agent can also answer on Instagram, Telegram and website chat. With several points of sale, Business includes 3 agents and Enterprise 10, with extra agents on any paid plan.' },
        { q: 'How do I connect Instagram?', a: 'You need an Instagram Business or Creator account linked to a Facebook Page you administer. In the agent\'s Instagram tab you click "Continue with Facebook", pick the Page and accept the permissions. The Instagram messaging API has no per-message fee.' },
        { q: 'Which languages does it answer in?', a: 'Portuguese, English, Spanish, French, German, Italian, Dutch and Arabic, automatically and with no setup. The agent replies in the language the customer writes in.' },
      ],
    },
    {
      id: 'plans', title: 'Plans, credits and pricing',
      items: [
        { q: 'What is a credit?', a: 'It is the platform\'s unit of usage: 1 credit is about 1,000 tokens on Claude Haiku. Sonnet and GPT-4o use 3 times as much and Opus 5 times. An average conversation (3 to 5 exchanges) uses 30 to 50 credits and a complete order with payment 50 to 80; for estimates, count about 40 credits per conversation.' },
        { q: 'How much does Agentfy cost?', a: 'The Free plan costs €0 and gives 1,000 credits once. Starter is €49 a month (18,000 credits, about 450 conversations), Business €129 (49,000 credits, 3 agents) and Enterprise €349 (134,000 credits, 10 agents and white-label included). In Brazil plans are priced in reais and the subscription is paid by PIX or card.' },
        { q: 'What happens when credits run out?', a: 'The agent stops replying until you renew or add credits. You get warnings at 30% and 10%, and you can buy packs of 5,000 credits (€14 to €16 depending on the plan) or move to a larger plan.' },
        { q: 'How do I choose the right plan?', a: 'Multiply your monthly conversations by about 40 credits. Up to roughly 450 conversations a month Starter is enough, up to about 1,250 or more than one number Business, and above that, with several locations, franchises or agencies, Enterprise.' },
        { q: 'Can I cancel any time?', a: 'Yes, at any moment and with no lock-in. Credits for a month already paid are not refunded.' },
      ],
    },
    {
      id: 'payments', title: 'Orders and payments',
      items: [
        { q: 'Does the agent take orders and collect payment?', a: 'Yes. With the Sales and Delivery skill the agent builds the cart in the chat, and with the Payments skill it generates the MB WAY, Multibanco or PIX reference and confirms by itself when the payment arrives. The order then goes to the kitchen screen.' },
        { q: 'How do I pay for my Agentfy subscription?', a: 'In Europe with MB WAY, Multibanco or card, and in Brazil with PIX or card. The plan is activated when the payment is confirmed.' },
        { q: 'Does the agent recognise returning customers?', a: 'Yes. With the Sales and Delivery skill the agent reads that WhatsApp number\'s order history and personalises the chat around the customer\'s favourites, and offers upselling at the right moment.' },
        { q: 'Can the agent book appointments?', a: 'Yes. The booking skill connects to your Google Calendar, proposes only free slots, confirms with the customer and sends a reminder the day before.' },
      ],
    },
    {
      id: 'privacy', title: 'Data, GDPR and security',
      items: [
        { q: 'Where is my data stored?', a: 'On servers in the European Union, in line with GDPR. Data is encrypted with AES-256 in transit and at rest, with automatic daily backups.' },
        { q: 'Can I export or delete my customers\' data?', a: 'Yes, on request. We handle data export and deletion, and the Data Deletion page explains how to ask for your account and conversations to be removed.' },
        { q: 'Does the account support two-factor authentication?', a: 'Yes, two-factor authentication (Google Authenticator) is available on every account. Business and higher plans also keep a log of every action taken in the account.' },
        { q: 'Does Agentfy use my conversations to train models?', a: 'Conversations are used so the agent can answer for your business and for your history and CRM. The details of processing, purposes and legal bases are in the Privacy Policy.' },
      ],
    },
    {
      id: 'team', title: 'Team, humans and support',
      items: [
        { q: 'What if the customer wants to talk to a person?', a: 'The agent hands the chat to your team with a summary of what the customer wants, their mood and the history. It happens when the customer asks, when the agent is not confident enough or when it detects frustration, and the copilot suggests replies while your team talks to the customer.' },
        { q: 'Can I have the agent under my own brand?', a: 'Yes, with white-label: a portal with your logo, colours and domain, with no mention of Agentfy. It is included in Enterprise and an add-on on Starter and Business, built for agencies that resell.' },
        { q: 'What is support like?', a: 'Free has online documentation, Starter email support, Business priority email and Enterprise a 24-hour SLA. You can write any time to contact@solutions.shaklabs.tech.' },
        { q: 'Can I sign in with Facebook?', a: 'Yes. The sign-in screen has "Continue with Facebook", and you can also link Facebook later from your profile.' },
      ],
    },
  ],
};

export const FAQ_PAGE: Record<LandingLocale, FaqPageCopy> = { pt, es, en };
