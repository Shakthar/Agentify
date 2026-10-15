# 🤖 Agentfy - Plataforma Global de Agentes IA

**Agentfy** é uma plataforma SaaS para criar, treinar e vender agentes de IA especializados em atendimento ao cliente.

## ✨ Features Principais

### Para Clientes (Revendedores)
- 🎯 **Criador de Agentes com IA** — descreve o negócio em linguagem natural, a IA gera tudo automaticamente
- 💬 **Multi-canal nativo** — WhatsApp, Chat web, Email, Instagram (roadmap)
- 🧠 **Análise de humor** — detecta frustração e escala para humano automaticamente
- 📚 **Treino com múltiplas fontes** — PDFs, Word, Excel, YouTube, websites
- 🔄 **Auto-routing de modelos** — começa com Haiku barato, sobe para Sonnet quando necessário
- 💳 **Billing flexível** — créditos por agente, consumo configurável
- 🎯 **Handoff inteligente** — resumo automático da conversa antes de escalar

### Para Administrador (Você)
- 📊 **Analytics em tempo real** — consumo por cliente, margem, churn prediction
- 💰 **Dashboard financeiro** — MRR, LTV, custo de LLM vs receita
- 🛡️ **Segurança enterprise** — AES-256-GCM, GDPR, RLS, chaves por tenant
- 🌍 **White-label** — seus clientes revendem com própria marca
- 📈 **Marketplace de agentes** (roadmap) — templates prontos para vender

---

## 🏗️ Arquitetura

```
┌─────────────┐     ┌──────────────┐     ┌─────────────┐
│   Frontend  │────▶│   Backend    │────▶│  Supabase   │
│  (Next.js)  │     │  (Node.js)   │     │ (PostgreSQL)│
└─────────────┘     └──────────────┘     └─────────────┘
                            │
                            ├─▶ LLM APIs (Claude, GPT-4o, Gemini)
                            ├─▶ Stripe (Billing)
                            ├─▶ SendGrid (Email)
                            └─▶ Evolution API (WhatsApp)
```

### Stack Tecnológico
- **Frontend**: Next.js 14, React 18, Tailwind CSS
- **Backend**: Node.js, Express, TypeScript, Prisma ORM
- **Database**: PostgreSQL (Supabase), pgvector para embeddings
- **LLM**: Claude 3.5 Sonnet (default), suporte para GPT-4o, Gemini, Groq
- **Billing**: Stripe
- **Infra**: Railway (backend), Vercel (frontend), Upstash Redis

---

## 🚀 Quick Start

### Pré-requisitos
- Node.js 18+
- npm ou pnpm
- Git

### 1. Clone e setup
```bash
git clone https://github.com/Shakthar/Agentify.git
cd Agentify

# Ler instruções completas de setup
cat SETUP.md
```

### 2. Backend
```bash
cd backend
npm install
cp .env.example .env
# Preencher .env com credenciais do Supabase e APIs
npm run prisma:push
npm run dev
# Backend rodando em http://localhost:3001
```

### 3. Frontend
```bash
cd frontend
npm install
cp .env.local.example .env.local
npm run dev
# Frontend rodando em http://localhost:3000
```

### 4. Primeira vez
- Ir a http://localhost:3000
- Registar conta
- Criar um agente via "Agent Creator" ou "Wizard"
- Testar no preview

---

## 💰 Planos & Preços (v2 — out/2026)

Calculados para **40% de margem bruta** no pior caso (cliente consome todos os créditos). Modelo de custos: `backend/scripts/pricing-model.mjs`. Fonte de verdade: `backend/src/lib/platformConfig.ts` (backend) e `frontend/src/utils/pricing.ts` (frontend). Catálogo comercial completo: `AGENTIFY_KNOWLEDGE_BASE.md`.

| Plano | Europa (€) | Créditos | Brasil (R$) | Créditos | Agentes |
|-------|-----------|----------|-------------|----------|---------|
| **Free** | €0 | 1.000 (uma vez) | R$0 | 1.000 (uma vez) | 1 |
| **Starter** | €49/mês | 18.000 | R$197/mês | 12.500 | 1 |
| **Business** | €129/mês | 49.000 | R$497/mês | 33.000 | 3 |
| **Enterprise** | €349/mês | 134.000 | R$1.297/mês | 88.000 | 10 |

- 1 crédito ≈ 1.000 tokens Haiku (Sonnet/GPT-4o ×3, Opus ×5) · ~40 créditos por conversa média
- Mensagens WhatsApp/Instagram/Telegram não consomem créditos; as tarifas da Meta são faturadas pela Meta ao dono do número (cartão registado no onboarding)
- Pacote extra de 5.000 créditos: €16/€15/€14 · R$89/R$84/R$79
- Add-ons (skills, agentes extra, white-label): ver tabela na página Planos e no Knowledge Base
- Tenants em BRL (`Tenant.billingCurrency = 'BRL'`) pagam por PIX (confirmação manual) ou cartão — migração `backend/prisma/migrations/add_billing_currency.sql`

---

## 🔐 Segurança

✅ **Implementado:**
- Encriptação AES-256-GCM por tenant (dados em repouso)
- TLS 1.3 em trânsito
- JWT com expiração curta + refresh tokens revogáveis
- RLS (Row-Level Security) em todas as tabelas
- Validação SSRF em skills
- Rate limiting em todas as rotas
- Sanitização de inputs e outputs
- GDPR: direito a ser esquecido, dados portáteis

🔍 **Auditado:**
- 20/20 testes de segurança passaram
- Sem vulnerabilidades críticas ou altas abertas
- Pen-tested contra prompt injection

---

## 📊 Modelos de IA Suportados

| Modelo | Créditos por 1K tokens | Incluído em |
|--------|-----------------------|------------|
| **Claude Haiku 4.5** | 1 | Todos |
| **GPT-4o mini** | 1 | Todos |
| **Claude Sonnet 4.5** | 3 | Starter+ |
| **GPT-4o** | 3 | Business+ |
| **Claude Opus 4.5** | 5 | Enterprise |

**Auto-routing:** O agente começa com Haiku, muda automaticamente para Sonnet em perguntas complexas.

---

## 📁 Estrutura do Projeto

```
agentify/
├── backend/               # API Node.js + Prisma
├── frontend/              # Next.js + React
├── docs/                  # Documentação
├── SETUP.md               # Instruções de setup
└── README.md              # Este ficheiro
```

**Documentação completa:**
- `docs/ARCHITECTURE.md` — Design técnico detalhado
- `docs/SKILLS.md` — Todas as skills disponíveis
- `docs/API.md` — Referência de endpoints
- `docs/DEPLOYMENT.md` — Deploy em produção
- `docs/SECURITY.md` — Auditorias e mitigações

---

## 🎯 Roadmap

### Q1 2025
- ✅ MVP com criador de agentes
- ✅ Multi-canal (WhatsApp + Web)
- ✅ Análise de humor
- 🔄 Forum para comunidade (em progresso)

### Q2 2025
- 🔲 Instagram Messaging
- 🔲 Marketplace de agentes prontos
- 🔲 Custom domains para white-label
- 🔲 API pública

### Q3 2025
- 🔲 Agentes com memória persistente (long-term)
- 🔲 Video understanding
- 🔲 Integrações com 50+ ferramentas

---

## 🤝 Contribuir

Este projeto está em desenvolvimento ativo. PRs e issues são bem-vindas!

```bash
# Criar branch para feature
git checkout -b feature/sua-feature

# Fazer commit com mensagens claras
git commit -m "feat: descrição clara da mudança"

# Push e abrir PR
git push origin feature/sua-feature
```

---

## 📧 Suporte

- **Email:** support@agentfy.tech
- **Forum:** agentfy.tech/forum
- **Discord:** [link] (em breve)

---

## 📄 Licença

MIT License — Vê `LICENSE` para detalhes.

---

## 👨‍💼 Autor

**Shakthar** — Desenvolvido em Portugal 🇵🇹

**Créditos:** Arquitetura, code, design e estratégia por Claude (Anthropic).

---

## 🔔 Status do Projeto

| Item | Status | Notas |
|------|--------|-------|
| Backend Core | ✅ Pronto | 25+ ficheiros implementados |
| Frontend Core | 🔄 Em progresso | Componentes base prontos |
| Segurança | ✅ Auditado | Sem vulnerabilidades abertas |
| Supabase | ✅ Configurado | Pronto para produção |
| Stripe Integration | ✅ Pronto | Webhooks implementados |
| WhatsApp | ✅ Base pronta | Evolution API integrada |
| Analytics | 🔄 Em progresso | Dashboard admin em desenvolvimento |
| Forum | 🔄 Planeado | Ferramentas base prontas |

---

**Última actualização:** 2025-06-03  
**Versão:** 1.0.0-beta

🚀 **Pronto para começar?** Vê `SETUP.md` para instruções passo-a-passo!
