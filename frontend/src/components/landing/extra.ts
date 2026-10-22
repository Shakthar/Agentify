import type { LandingLocale } from './copy';

/** Textos extra da landing redesenhada: fragmentos de produto, navegação partilhada e páginas legais. */
export interface ExtraCopy {
  navFaq: string;
  faqAll: string;
  footerFaq: string;
  footerNote: string;
  backToTop: string;
  toc: string;
  updated: string;
  home: string;
  signup: string;
  marqueeLabel: string;
  dash: {
    title: string;
    sample: string;
    today: string;
    stats: { label: string; value: string; delta: string }[];
    chartTitle: string;
    channels: { name: string; value: number }[];
    handoffLabel: string;
  };
  inbox: { title: string; rows: { channel: string; who: string; text: string; time: string; tag?: string }[] };
  kitchen: { title: string; cols: { name: string; tickets: { n: string; lines: string[]; meta: string; paid?: boolean }[] }[]; paid: string };
  cta: { label: string; placeholder: string; example: string; hint: string };
}

const pt: ExtraCopy = {
  navFaq: 'FAQ',
  faqAll: 'Ver todas as perguntas',
  footerFaq: 'Perguntas frequentes',
  footerNote: 'Agente de IA para WhatsApp, Instagram, Telegram e chat do site.',
  backToTop: 'Voltar ao topo',
  toc: 'Neste documento',
  updated: 'Última atualização',
  home: 'Página inicial',
  signup: 'Criar conta',
  marqueeLabel: 'Integra com WhatsApp, Instagram, Telegram, MB WAY, Multibanco, Google Calendar, Claude e GPT.',
  dash: {
    title: 'Painel',
    sample: 'Exemplo',
    today: 'Hoje',
    stats: [
      { label: 'Conversas', value: '148', delta: '+12%' },
      { label: 'Encomendas', value: '37', delta: '+8%' },
      { label: 'Pagas com MB WAY', value: '1.284 €', delta: '+15%' },
      { label: 'Passadas à equipa', value: '6', delta: '4 resolvidas' },
    ],
    chartTitle: 'Conversas por canal',
    channels: [{ name: 'WhatsApp', value: 96 }, { name: 'Instagram', value: 31 }, { name: 'Chat do site', value: 14 }, { name: 'Telegram', value: 7 }],
    handoffLabel: 'Humor do cliente: irritado',
  },
  inbox: {
    title: 'Caixa de entrada',
    rows: [
      { channel: 'WhatsApp', who: 'Tasca do Largo', text: '2 arroz de pato e uma salada mista', time: '23:13' },
      { channel: 'Instagram', who: 'inesfigueira', text: 'Têm mesa para sábado às 20h?', time: '22:41' },
      { channel: 'Telegram', who: 'Marta R.', text: 'Qual é o horário de amanhã?', time: '21:07' },
      { channel: 'Chat do site', who: 'Visitante', text: 'Fazem entregas em Oeiras?', time: '19:52', tag: 'Passada à equipa' },
    ],
  },
  kitchen: {
    title: 'Ecrã da cozinha',
    paid: 'Pago',
    cols: [
      { name: 'Novo', tickets: [{ n: '215', lines: ['2× Arroz de pato', '1× Salada mista'], meta: 'Rua do Sol 14 · 31,50 €', paid: true }] },
      { name: 'A preparar', tickets: [{ n: '214', lines: ['1× Bacalhau à Brás'], meta: 'Levantamento · 12,00 €', paid: true }] },
      { name: 'Pronto', tickets: [{ n: '213', lines: ['3× Pastel de nata'], meta: 'Entrega · 4,50 €' }] },
    ],
  },
  cta: { label: 'Nome do teu negócio', placeholder: 'Ex.: Tasca do Largo', example: 'Tasca do Largo', hint: 'Fica já guardado quando criares a conta.' },
};

const es: ExtraCopy = {
  navFaq: 'FAQ',
  faqAll: 'Ver todas las preguntas',
  footerFaq: 'Preguntas frecuentes',
  footerNote: 'Agente de IA para WhatsApp, Instagram, Telegram y chat web.',
  backToTop: 'Volver arriba',
  toc: 'En este documento',
  updated: 'Última actualización',
  home: 'Página de inicio',
  signup: 'Crear cuenta',
  marqueeLabel: 'Se integra con WhatsApp, Instagram, Telegram, MB WAY, Multibanco, Google Calendar, Claude y GPT.',
  dash: {
    title: 'Panel',
    sample: 'Ejemplo',
    today: 'Hoy',
    stats: [
      { label: 'Conversaciones', value: '148', delta: '+12 %' },
      { label: 'Pedidos', value: '37', delta: '+8 %' },
      { label: 'Pagados con MB WAY', value: '1.284 €', delta: '+15 %' },
      { label: 'Pasadas al equipo', value: '6', delta: '4 resueltas' },
    ],
    chartTitle: 'Conversaciones por canal',
    channels: [{ name: 'WhatsApp', value: 96 }, { name: 'Instagram', value: 31 }, { name: 'Chat web', value: 14 }, { name: 'Telegram', value: 7 }],
    handoffLabel: 'Ánimo del cliente: enfadado',
  },
  inbox: {
    title: 'Bandeja de entrada',
    rows: [
      { channel: 'WhatsApp', who: 'Tasca do Largo', text: '2 arroz de pato y una ensalada mixta', time: '23:13' },
      { channel: 'Instagram', who: 'inesfigueira', text: '¿Tenéis mesa el sábado a las 20h?', time: '22:41' },
      { channel: 'Telegram', who: 'Marta R.', text: '¿Cuál es el horario de mañana?', time: '21:07' },
      { channel: 'Chat web', who: 'Visitante', text: '¿Hacéis entregas en Oeiras?', time: '19:52', tag: 'Pasada al equipo' },
    ],
  },
  kitchen: {
    title: 'Pantalla de cocina',
    paid: 'Pagado',
    cols: [
      { name: 'Nuevo', tickets: [{ n: '215', lines: ['2× Arroz de pato', '1× Ensalada mixta'], meta: 'Rua do Sol 14 · 31,50 €', paid: true }] },
      { name: 'Preparando', tickets: [{ n: '214', lines: ['1× Bacalao a la Brás'], meta: 'Recogida · 12,00 €', paid: true }] },
      { name: 'Listo', tickets: [{ n: '213', lines: ['3× Pastel de nata'], meta: 'Entrega · 4,50 €' }] },
    ],
  },
  cta: { label: 'Nombre de tu negocio', placeholder: 'Ej.: Tasca do Largo', example: 'Tasca do Largo', hint: 'Se guarda al crear la cuenta.' },
};

const en: ExtraCopy = {
  navFaq: 'FAQ',
  faqAll: 'See all questions',
  footerFaq: 'FAQ',
  footerNote: 'AI agent for WhatsApp, Instagram, Telegram and website chat.',
  backToTop: 'Back to top',
  toc: 'In this document',
  updated: 'Last updated',
  home: 'Home',
  signup: 'Create account',
  marqueeLabel: 'Works with WhatsApp, Instagram, Telegram, MB WAY, Multibanco, Google Calendar, Claude and GPT.',
  dash: {
    title: 'Dashboard',
    sample: 'Sample',
    today: 'Today',
    stats: [
      { label: 'Conversations', value: '148', delta: '+12%' },
      { label: 'Orders', value: '37', delta: '+8%' },
      { label: 'Paid with MB WAY', value: '€1,284', delta: '+15%' },
      { label: 'Handed to the team', value: '6', delta: '4 resolved' },
    ],
    chartTitle: 'Conversations by channel',
    channels: [{ name: 'WhatsApp', value: 96 }, { name: 'Instagram', value: 31 }, { name: 'Website chat', value: 14 }, { name: 'Telegram', value: 7 }],
    handoffLabel: 'Customer mood: upset',
  },
  inbox: {
    title: 'Inbox',
    rows: [
      { channel: 'WhatsApp', who: 'Tasca do Largo', text: '2 duck rice and a mixed salad', time: '23:13' },
      { channel: 'Instagram', who: 'inesfigueira', text: 'Do you have a table Saturday at 8pm?', time: '22:41' },
      { channel: 'Telegram', who: 'Marta R.', text: 'What are tomorrow\'s opening hours?', time: '21:07' },
      { channel: 'Website chat', who: 'Visitor', text: 'Do you deliver to Oeiras?', time: '19:52', tag: 'Handed to the team' },
    ],
  },
  kitchen: {
    title: 'Kitchen screen',
    paid: 'Paid',
    cols: [
      { name: 'New', tickets: [{ n: '215', lines: ['2× Duck rice', '1× Mixed salad'], meta: 'Rua do Sol 14 · €31.50', paid: true }] },
      { name: 'Preparing', tickets: [{ n: '214', lines: ['1× Bacalhau à Brás'], meta: 'Pickup · €12.00', paid: true }] },
      { name: 'Ready', tickets: [{ n: '213', lines: ['3× Custard tart'], meta: 'Delivery · €4.50' }] },
    ],
  },
  cta: { label: 'Your business name', placeholder: 'E.g. Tasca do Largo', example: 'Tasca do Largo', hint: 'Saved for you when you create the account.' },
};

export const EXTRA: Record<LandingLocale, ExtraCopy> = { pt, es, en };
