import type { LandingLocale } from './copy';

/** Páginas de setor (/para/[slug]) — SEO por tipo de negócio, em pt/es/en. */
export interface SectorPage {
  slug: string;
  scenarioId: string;
  copy: Record<LandingLocale, { title: string; description: string; h1: string; intro: string; points: { title: string; desc: string }[] }>;
}

export const SECTORS: SectorPage[] = [
  {
    slug: 'restaurantes',
    scenarioId: 'restaurant',
    copy: {
      pt: {
        title: 'WhatsApp com IA para restaurantes e delivery | Agentfy',
        description: 'Recebe encomendas pelo WhatsApp a qualquer hora: o agente mostra o menu, calcula o total com entrega, cobra por MB WAY e envia o pedido para a cozinha.',
        h1: 'Encomendas pelo WhatsApp, mesmo com a cozinha a mil',
        intro: 'O agente conhece o teu menu, os pratos do dia, as zonas e o mínimo de entrega. Fecha o pedido, cobra e manda-o para o ecrã da cozinha, enquanto a tua equipa cozinha.',
        points: [
          { title: 'Menu sempre certo', desc: 'Carrega o PDF ou a fotografia da ementa. Atualizas quando mudas os pratos.' },
          { title: 'Pagamento na conversa', desc: 'MB WAY e Multibanco antes de o pedido entrar na cozinha.' },
          { title: 'Ecrã da cozinha', desc: 'Os pedidos aparecem ao vivo num link que abres em qualquer tablet.' },
          { title: 'Upselling simpático', desc: 'Sugere a sobremesa ou a bebida certa, sem ser insistente.' },
        ],
      },
      es: {
        title: 'WhatsApp con IA para restaurantes y delivery | Agentfy',
        description: 'Recibe pedidos por WhatsApp a cualquier hora: el agente muestra la carta, calcula el total con entrega, cobra con MB WAY y manda el pedido directo a cocina.',
        h1: 'Pedidos por WhatsApp, aunque la cocina vaya a tope',
        intro: 'El agente conoce tu carta, los platos del día, las zonas y el mínimo de entrega. Cierra el pedido y lo manda a la pantalla de cocina mientras tu equipo cocina.',
        points: [
          { title: 'Carta siempre al día', desc: 'Sube el PDF o una foto de la carta y actualízala cuando cambies platos.' },
          { title: 'Cobro en la conversación', desc: 'MB WAY y Multibanco en Portugal; pago a la entrega en el resto.' },
          { title: 'Pantalla de cocina', desc: 'Los pedidos aparecen en directo en un enlace que abres en cualquier tablet.' },
          { title: 'Venta cruzada amable', desc: 'Sugiere el postre o la bebida adecuada, sin agobiar.' },
        ],
      },
      en: {
        title: 'WhatsApp AI agent for restaurants and delivery | Agentfy',
        description: 'Take WhatsApp orders at any hour: the AI agent shows the menu, totals the order with delivery, collects payment with MB WAY and sends it to the kitchen.',
        h1: 'WhatsApp orders, even when the kitchen is slammed',
        intro: 'The agent knows your menu, daily specials, delivery zones and minimums. It closes the order and sends it to the kitchen screen while your team cooks.',
        points: [
          { title: 'Menu always right', desc: 'Upload the PDF or a photo of the menu and update it when dishes change.' },
          { title: 'Payment in the chat', desc: 'MB WAY and Multibanco in Portugal; pay on delivery elsewhere.' },
          { title: 'Kitchen screen', desc: 'Orders appear live on a link you open on any tablet.' },
          { title: 'Friendly upselling', desc: 'Suggests the right dessert or drink without being pushy.' },
        ],
      },
    },
  },
  {
    slug: 'clinicas',
    scenarioId: 'clinic',
    copy: {
      pt: {
        title: 'WhatsApp com IA para clínicas: marcações | Agentfy',
        description: 'Marcações pelo WhatsApp ligadas à Google Calendar: o agente propõe apenas horários livres, envia lembrete na véspera e passa à receção o que for clínico.',
        h1: 'Marcações pelo WhatsApp sem ocupar a receção',
        intro: 'O agente vê a agenda, propõe horários livres por médico ou serviço, confirma e lembra o paciente na véspera. Perguntas clínicas passam para a equipa.',
        points: [
          { title: 'Agenda real', desc: 'Ligado à Google Calendar: só propõe horários livres.' },
          { title: 'Menos faltas', desc: 'Lembrete automático na véspera de cada consulta.' },
          { title: 'Triagem com cuidado', desc: 'Sintomas ou urgências vão logo para uma pessoa, com resumo.' },
          { title: 'Dados na UE', desc: 'Servidores na UE, RGPD, exportação e eliminação a pedido.' },
        ],
      },
      es: {
        title: 'WhatsApp con IA para clínicas: gestión de citas | Agentfy',
        description: 'Citas por WhatsApp conectadas a Google Calendar: el agente propone únicamente huecos libres, envía recordatorio el día antes y pasa a recepción lo clínico.',
        h1: 'Citas por WhatsApp sin saturar la recepción',
        intro: 'El agente consulta la agenda, propone huecos libres por profesional o servicio, confirma y recuerda la cita el día antes. Las dudas clínicas pasan al equipo.',
        points: [
          { title: 'Agenda real', desc: 'Conectado a Google Calendar: solo propone huecos libres.' },
          { title: 'Menos ausencias', desc: 'Recordatorio automático el día antes.' },
          { title: 'Triaje con cuidado', desc: 'Síntomas o urgencias pasan enseguida a una persona, con resumen.' },
          { title: 'Datos en la UE', desc: 'Servidores en la UE, RGPD, exportación y borrado a petición.' },
        ],
      },
      en: {
        title: 'WhatsApp AI agent for clinics: appointment booking | Agentfy',
        description: 'Book appointments on WhatsApp via Google Calendar: the AI agent offers free slots, reminds patients the day before and hands clinical questions to reception.',
        h1: 'WhatsApp bookings without tying up reception',
        intro: 'The agent checks the calendar, offers free slots by practitioner or service, confirms and reminds the patient the day before. Clinical questions go to your team.',
        points: [
          { title: 'Real calendar', desc: 'Linked to Google Calendar: it only offers free slots.' },
          { title: 'Fewer no-shows', desc: 'Automatic reminder the day before.' },
          { title: 'Careful triage', desc: 'Symptoms or urgent cases go straight to a person, with a summary.' },
          { title: 'EU data', desc: 'EU servers, GDPR, export and deletion on request.' },
        ],
      },
    },
  },
  {
    slug: 'saloes',
    scenarioId: 'salon',
    copy: {
      pt: {
        title: 'WhatsApp com IA para salões, estética e beleza | Agentfy',
        description: 'O agente responde a preços e disponibilidade no WhatsApp, faz reservas na tua agenda e envia lembretes automáticos, enquanto a equipa trabalha com as clientes.',
        h1: 'O teu salão a marcar clientes enquanto trabalhas',
        intro: 'Preços, duração de cada serviço e a agenda de cada profissional. O agente responde no WhatsApp e no Instagram e marca sem interromper quem está a cortar.',
        points: [
          { title: 'Preços sem dúvidas', desc: 'Responde com a tua tabela e pergunta o que falta para dar o valor certo.' },
          { title: 'Agenda por profissional', desc: 'Marca com quem o cliente prefere, na duração certa.' },
          { title: 'Instagram incluído', desc: 'As mensagens diretas recebem a mesma resposta rápida.' },
          { title: 'Lembretes', desc: 'Menos faltas com lembrete automático.' },
        ],
      },
      es: {
        title: 'WhatsApp con IA para salones, estética y belleza | Agentfy',
        description: 'El agente responde precios y disponibilidad por WhatsApp, hace reservas en tu agenda y envía recordatorios automáticos mientras el equipo atiende a clientas.',
        h1: 'Tu salón agendando clientes mientras trabajas',
        intro: 'Precios, duración de cada servicio y la agenda de cada profesional. El agente responde en WhatsApp e Instagram y agenda sin interrumpir a quien está cortando.',
        points: [
          { title: 'Precios claros', desc: 'Responde con tu tarifa y pregunta lo necesario para dar el precio correcto.' },
          { title: 'Agenda por profesional', desc: 'Agenda con quien prefiere el cliente, con la duración correcta.' },
          { title: 'Instagram incluido', desc: 'Los mensajes directos reciben la misma respuesta rápida.' },
          { title: 'Recordatorios', desc: 'Menos ausencias con recordatorio automático.' },
        ],
      },
      en: {
        title: 'WhatsApp AI agent for salons and beauty care | Agentfy',
        description: 'The AI agent answers prices and availability on WhatsApp, books appointments in your calendar and sends automatic reminders while your team looks after clients.',
        h1: 'Your salon booking clients while you work',
        intro: 'Prices, service durations and each stylist’s calendar. The agent answers on WhatsApp and Instagram and books without interrupting whoever is cutting.',
        points: [
          { title: 'Clear prices', desc: 'Answers from your price list and asks what it needs to quote correctly.' },
          { title: 'Calendar per stylist', desc: 'Books with the customer’s preferred stylist, for the right duration.' },
          { title: 'Instagram included', desc: 'Direct messages get the same fast answer.' },
          { title: 'Reminders', desc: 'Fewer no-shows with automatic reminders.' },
        ],
      },
    },
  },
  {
    slug: 'lojas',
    scenarioId: 'shop',
    copy: {
      pt: {
        title: 'WhatsApp com IA para lojas online e e-commerce | Agentfy',
        description: 'O agente responde ao estado das encomendas, trocas e devoluções no WhatsApp, de dia e de noite, e passa à tua equipa os clientes insatisfeitos com o resumo.',
        h1: 'Apoio ao cliente da tua loja, 24 horas por dia',
        intro: '“Onde está a minha encomenda?”, trocas, tamanhos e devoluções. O agente responde com as tuas políticas e passa a conversa à equipa quando o cliente precisa de uma pessoa.',
        points: [
          { title: 'Políticas na ponta da língua', desc: 'Trocas, devoluções e prazos a partir dos teus documentos.' },
          { title: 'Deteção de irritação', desc: 'Clientes zangados vão para a equipa com resumo e histórico.' },
          { title: 'Todos os canais', desc: 'WhatsApp, Instagram, Telegram e chat do site com a mesma resposta.' },
          { title: 'Contactos no CRM', desc: 'Cada conversa fica registada com os dados do cliente.' },
        ],
      },
      es: {
        title: 'WhatsApp con IA para tiendas online y e-commerce | Agentfy',
        description: 'El agente responde sobre estado de pedidos, cambios y devoluciones por WhatsApp las 24 horas y pasa a tu equipo a los clientes molestos con el resumen del caso.',
        h1: 'Atención al cliente de tu tienda, 24 horas al día',
        intro: '“¿Dónde está mi pedido?”, cambios, tallas y devoluciones. El agente responde con tus políticas y pasa la conversación al equipo cuando el cliente necesita una persona.',
        points: [
          { title: 'Políticas al detalle', desc: 'Cambios, devoluciones y plazos a partir de tus documentos.' },
          { title: 'Detección de enfado', desc: 'Los clientes molestos pasan al equipo con resumen e historial.' },
          { title: 'Todos los canales', desc: 'WhatsApp, Instagram, Telegram y chat web con la misma respuesta.' },
          { title: 'Contactos en el CRM', desc: 'Cada conversación queda registrada con los datos del cliente.' },
        ],
      },
      en: {
        title: 'WhatsApp AI agent for online shops and e-commerce | Agentfy',
        description: 'The AI agent answers order status, exchanges and returns on WhatsApp 24 hours a day and hands unhappy customers to your team with a summary of the issue.',
        h1: 'Customer support for your shop, around the clock',
        intro: '“Where is my order?”, exchanges, sizes and returns. The agent answers from your policies and hands the chat to your team when a customer needs a person.',
        points: [
          { title: 'Policies at its fingertips', desc: 'Exchanges, returns and lead times from your own documents.' },
          { title: 'Frustration detection', desc: 'Upset customers go to your team with a summary and history.' },
          { title: 'Every channel', desc: 'WhatsApp, Instagram, Telegram and website chat with the same answers.' },
          { title: 'Contacts in the CRM', desc: 'Every conversation is logged with the customer’s details.' },
        ],
      },
    },
  },
];
