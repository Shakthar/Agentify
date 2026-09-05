import { useState, useRef, useEffect } from 'react';

interface Message {
  role: 'user' | 'bot';
  text: string;
}

// ─── Knowledge base (FAQ rápido, respostas inline) ─────────────────────────────
// Para ligar a uma IA real, substitui a função `getBotResponse` por uma chamada à tua API.
const FAQ: Array<{ keywords: string[]; answer: string }> = [
  {
    keywords: ['crédito', 'credito', 'custa', 'preço', 'preco', 'quanto'],
    answer: `Os créditos são a unidade de consumo da plataforma.\n\n• Conversa simples: ~5–10 créditos\n• Pedido com pagamento: ~25–30 créditos\n• Auto-routing poupa até 60% automaticamente\n\nPreços:\n• Free: 1.000 créditos (únicos)\n• Starter €59/mês: 5.000 créditos\n• Business €159/mês: 15.000 créditos\n• Enterprise €399/mês: 40.000 créditos`,
  },
  {
    keywords: ['plano', 'planos', 'starter', 'business', 'enterprise', 'free', 'gratis', 'grátis'],
    answer: `Temos 4 planos:\n\n🆓 **Free** — €0 (1.000 créditos únicos, 1 agente)\n🔵 **Starter** — €59/mês (5.000 créditos, 1 agente)\n🟠 **Business** — €159/mês (15.000 créditos, 3 agentes)\n🟢 **Enterprise** — €399/mês (40.000 créditos, 10 agentes)\n\nTodos os planos incluem WhatsApp + Chat Web.`,
  },
  {
    keywords: ['ligar whatsapp', 'conectar whatsapp', 'configurar whatsapp', 'ativar whatsapp', 'número de whatsapp', 'numero de whatsapp'],
    answer: `Dentro do agente, na aba **WhatsApp**, clica em "Continuar com Facebook / Meta":\n\n1. Autentica com a tua conta Meta\n2. O agente fica ligado ao teu número WhatsApp Business automaticamente (sem copiar tokens)\n3. Confirma o Phone Number ID e introduz o PIN de 6 dígitos, se for pedido\n\nTambém há uma opção de configuração manual (Meta for Developers → produto WhatsApp), para quem prefere gerir o token diretamente.\n\n1 agente = 1 número WhatsApp, mas um agente pode estar ligado a múltiplas plataformas (site, Shopify, etc.) em simultâneo.`,
  },
  {
    keywords: ['ligar instagram', 'conectar instagram', 'configurar instagram', 'ativar instagram', 'conta de instagram', 'conta do instagram'],
    answer: `Dentro do agente, na aba **Instagram**, clica em "Continuar com Facebook":\n\n1. Abre-se um popup de autenticação com o Facebook\n2. Depois de aceitares, o agente fica ligado à tua conta Instagram Business automaticamente (sem copiar tokens)\n\nA conta do Instagram precisa de ser do tipo Business/Criador e estar ligada a uma Página do Facebook. Também há uma opção manual (Meta for Developers), para quem prefere.`,
  },
  {
    keywords: ['horário', 'horario', 'fora de horário', 'fora de horario', 'expediente', 'horário de funcionamento', 'horario de funcionamento', 'não trabalhar', 'nao trabalhar', 'pausar agente', 'agente não responder', 'agente nao responder'],
    answer: `Sim! Em cada canal (**WhatsApp**, **Instagram** e **Telegram**) tens um bloco "🕐 Horário de funcionamento" na respetiva aba do agente:\n\n1. Ativa o horário e escolhe o fuso horário\n2. Define uma janela para dias de semana e/ou fins de semana (ex: 09:00–18:00)\n3. Opcionalmente, escreve uma mensagem automática para quando alguém escrever fora desse horário\n\nFora da janela definida, o agente não responde normalmente — só envia a mensagem automática, se a tiveres configurado.`,
  },
  {
    keywords: ['banido', 'banimento', 'bloqueado', 'bloquear número', 'bloquear numero', 'risco whatsapp', 'ban whatsapp', 'suspenso', 'conta suspensa'],
    answer: `Não te preocupes — o Agentfy usa exclusivamente a **API oficial da Meta para empresas** (WhatsApp Cloud API) para ligar o teu número, nunca automações não-oficiais que simulam o WhatsApp Web (a causa mais comum de bloqueios).\n\nO número fica sempre registado em teu nome na Meta, e as mensagens proativas (iniciadas pelo agente) respeitam os limites diário/mensal que tu configuras, para nunca gerar picos que pareçam spam.`,
  },
  {
    keywords: ['entrar com facebook', 'login com facebook', 'login pelo facebook', 'criar conta com facebook', 'registar com facebook', 'associar facebook', 'associar conta do facebook', 'associar a conta do facebook'],
    answer: `Sim! No ecrã de login/registo tens o botão "Continuar com Facebook" — cria conta ou entra automaticamente com o teu perfil do Facebook.\n\nJá tens conta com email/password? Também podes associar a tua conta do Facebook depois, na aba de **Perfil** — útil se o email do Facebook for diferente do email da tua conta Agentify.`,
  },
  {
    keywords: ['código', 'codigo', 'programar', 'técnico', 'tecnico', 'it', 'desenvolv'],
    answer: `Não precisas de saber programar! 🎉\n\nO assistente de criação faz-te perguntas sobre o teu negócio e configura tudo automaticamente — nome, personalidade, skills e base de conhecimento.\n\nA maioria dos clientes fica operacional em menos de 10 minutos.`,
  },
  {
    keywords: ['rollover', 'acumular', 'sobrar', 'transferir', 'guardar'],
    answer: `🔜 Ainda não, mas está a caminho! O addon **Rollover** vai permitir transferir créditos não usados para o mês seguinte:\n\n• Pagarás 85% do valor dos créditos restantes (15% de desconto)\n• Créditos rollover válidos 2 meses\n• Disponível 1 vez por mês\n• Não disponível no plano Free\n\nPor agora, os créditos não usados não transitam de mês.`,
  },
  {
    keywords: ['agente', 'agentes', 'adicionar', 'extra', 'mais agente'],
    answer: `Podes adicionar agentes extra sem mudar de plano:\n\n• Starter: +€20/agente/mês (máx 3 total)\n• Business: +€15/agente/mês (máx 10 total)\n• Enterprise: +€10/agente/mês (ilimitados)`,
  },
  {
    keywords: ['pagamento', 'mbway', 'mb way', 'pix', 'multibanco', 'pagar'],
    answer: `O agente aceita pagamentos diretamente no WhatsApp:\n\n• MB Way (Portugal)\n• PIX (Brasil)\n• Referência Multibanco\n• Outros métodos configuráveis\n\nA skill de Pagamentos está incluída no Business e Enterprise. No Starter é disponível como addon por €15/mês.`,
  },
  {
    keywords: ['gdpr', 'rgpd', 'segurança', 'seguranca', 'dados', 'privacidade'],
    answer: `O Agentfy é 100% GDPR/RGPD compliant:\n\n• Encriptação AES-256\n• Servidores na EU\n• Exportação e eliminação de dados a pedido\n• Auditoria disponível (Enterprise)\n• Backups diários automáticos`,
  },
  {
    keywords: ['whitelabel', 'white-label', 'marca', 'revend', 'minha marca'],
    answer: `Sim, o White-label permite disponibilizar a plataforma com a tua marca:\n\n• Starter: +€5/agente/mês\n• Business: +€3/agente/mês\n• Enterprise: incluído\n\nOs teus clientes acedem com o teu logo, cores e domínio — sem qualquer referência ao Agentfy.`,
  },
  {
    keywords: ['brasil', 'brazil', 'brasil', 'português do brasil', 'pt-br'],
    answer: `Sim, o Agentfy funciona no Brasil! 🇧🇷\n\n• Suporte a PIX\n• WhatsApp com números brasileiros\n• Responde em Português do Brasil\n• A plataforma detecta automaticamente o idioma do cliente`,
  },
  {
    keywords: ['suporte', 'contacto', 'contactar', 'ajuda', 'email', 'falar'],
    answer: `Podes contactar-nos por email:\n\n📧 contact@solutions.shaklabs.tech\n\nTemos também suporte prioritário para planos Business e Enterprise, com SLA de 24h garantido no Enterprise.`,
  },
  {
    keywords: ['cancelar', 'contrato', 'fidelidade', 'desistir', 'sair'],
    answer: `Não há contratos de fidelidade! Podes cancelar a qualquer momento.\n\nOs créditos restantes do mês corrente não são reembolsados, mas não existe qualquer penalização ou período mínimo.`,
  },
  {
    keywords: ['tempo', 'demora', 'rapido', 'rápido', 'criar', 'começar', 'comecar'],
    answer: `Com o assistente de criação IA, demora menos de **10 minutos** a ter o teu agente ativo! 🚀\n\n1. Responde às perguntas do assistente sobre o teu negócio\n2. Faz upload dos teus documentos / menu / lista de preços\n3. Conecta o teu número de WhatsApp\n\nE está pronto a responder clientes.`,
  },
];

function getBotResponse(userText: string): string {
  const lower = userText.toLowerCase();
  const match = FAQ.find(f => f.keywords.some(k => lower.includes(k)));
  if (match) return match.answer;

  // Fallback genérico
  return `Obrigado pela tua pergunta! Para obter uma resposta mais detalhada, entra em contacto connosco:\n\n📧 contact@solutions.shaklabs.tech\n\nPodes também consultar os nossos planos em https://agentfy.shaklabs.tech/#pricing`;
}

// ─── Widget ───────────────────────────────────────────────────────────────────
export default function SupportWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      role: 'bot',
      text: 'Olá! 👋 Sou o assistente do Agentfy. Como posso ajudar?\n\nPodes perguntar sobre planos, créditos, WhatsApp, GDPR, addons ou qualquer outra dúvida.',
    },
  ]);
  const [input, setInput] = useState('');
  const [thinking, setThinking] = useState(false);
  const [unread, setUnread] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setUnread(0);
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    if (open) bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, open]);

  const send = async () => {
    const text = input.trim();
    if (!text || thinking) return;
    setInput('');
    setMessages(prev => [...prev, { role: 'user', text }]);
    setThinking(true);

    // Simula latência de API (~600ms)
    await new Promise(r => setTimeout(r, 600));
    const reply = getBotResponse(text);
    setMessages(prev => [...prev, { role: 'bot', text: reply }]);
    setThinking(false);
    if (!open) setUnread(n => n + 1);
  };

  const handleKey = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); send(); }
  };

  return (
    <div className="fixed bottom-6 right-6 z-50 flex flex-col items-end gap-3">
      {/* Chat panel */}
      {open && (
        <div className="w-80 sm:w-96 bg-white dark:bg-gray-900 rounded-2xl shadow-2xl border border-gray-200 dark:border-gray-700 flex flex-col overflow-hidden"
          style={{ maxHeight: '70vh' }}>
          {/* Header */}
          <div className="bg-brand-600 px-4 py-3 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-full bg-white/20 flex items-center justify-center text-base">🤖</div>
              <div>
                <p className="text-white text-sm font-semibold leading-tight">Suporte Agentfy</p>
                <p className="text-brand-200 text-[14px]">Responde em segundos</p>
              </div>
            </div>
            <button onClick={() => setOpen(false)} className="text-white/70 hover:text-white text-xl leading-none">×</button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3 bg-gray-50 dark:bg-gray-800">
            {messages.map((m, i) => (
              <div key={i} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs leading-relaxed whitespace-pre-line shadow-sm
                  ${m.role === 'user'
                    ? 'bg-brand-600 text-white rounded-br-none'
                    : 'bg-white dark:bg-gray-700 text-gray-800 dark:text-gray-200 rounded-bl-none border border-gray-100 dark:border-gray-600'}`}>
                  {m.text}
                </div>
              </div>
            ))}
            {thinking && (
              <div className="flex justify-start">
                <div className="bg-white dark:bg-gray-700 border border-gray-100 dark:border-gray-600 rounded-xl rounded-bl-none px-3 py-2 shadow-sm">
                  <div className="flex gap-1 items-center h-4">
                    {[0, 1, 2].map(d => (
                      <span key={d} className="w-1.5 h-1.5 rounded-full bg-gray-400 dark:bg-gray-400 animate-bounce" style={{ animationDelay: `${d * 0.15}s` }} />
                    ))}
                  </div>
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-2.5 bg-white dark:bg-gray-900 border-t border-gray-100 dark:border-gray-700 flex gap-2">
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              onKeyDown={handleKey}
              placeholder="Escreve a tua pergunta..."
              className="flex-1 text-xs bg-gray-100 dark:bg-gray-800 text-gray-800 dark:text-gray-200 placeholder-gray-400 rounded-lg px-3 py-2 outline-none border border-transparent focus:border-brand-300 dark:focus:border-brand-700 transition-colors"
            />
            <button
              onClick={send}
              disabled={!input.trim() || thinking}
              className="bg-brand-600 hover:bg-brand-700 disabled:opacity-40 text-white rounded-lg px-3 py-2 text-sm transition-colors"
            >
              ↑
            </button>
          </div>
        </div>
      )}

      {/* Toggle button */}
      <button
        onClick={() => setOpen(o => !o)}
        className="w-14 h-14 rounded-full bg-brand-600 hover:bg-brand-700 text-white shadow-lg shadow-brand-200 dark:shadow-brand-900 flex items-center justify-center text-2xl transition-all hover:scale-105 active:scale-95 relative"
        aria-label="Abrir suporte"
      >
        {open ? '×' : '💬'}
        {!open && unread > 0 && (
          <span className="absolute -top-1 -right-1 w-5 h-5 rounded-full bg-red-500 text-white text-[14px] font-bold flex items-center justify-center">
            {unread}
          </span>
        )}
      </button>
    </div>
  );
}
