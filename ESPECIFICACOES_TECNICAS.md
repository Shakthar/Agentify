# 🏗️ ESPECIFICAÇÕES TÉCNICAS - AGENTFY

## 📋 Índice
1. [Stack Tecnológico](#stack-tecnológico)
2. [Arquitetura](#arquitetura)
3. [Base de Dados](#base-de-dados)
4. [APIs e Endpoints](#apis-e-endpoints)
5. [Segurança](#segurança)
6. [Performance](#performance)
7. [Escalabilidade](#escalabilidade)

---

## 🛠️ Stack Tecnológico

### Backend
- **Runtime:** Node.js (v18+)
- **Framework:** Express.js
- **Linguagem:** TypeScript
- **ORM:** Prisma
- **BD:** PostgreSQL (Supabase)
- **Autenticação:** JWT + Refresh Tokens
- **Fila de Mensagens:** BullMQ + Redis
- **LLMs:** Claude (Anthropic), GPT-4o (OpenAI), Gemini (Google)
- **WhatsApp:** Evolution API (self-hosted)
- **Pagamentos:** Stripe
- **Email:** SendGrid

### Frontend
- **Framework:** Next.js 14
- **Biblioteca UI:** React 18
- **Styling:** Tailwind CSS
- **State Management:** Zustand
- **HTTP Client:** Axios
- **Markdown:** React Markdown
- **Gráficos:** Recharts
- **Ícones:** Lucide React

### Infraestrutura
- **Backend Deploy:** Railway / Render
- **Frontend Deploy:** Vercel
- **Database:** Supabase (PostgreSQL + pgvector)
- **Storage:** Supabase Storage (para KBs)
- **Cache:** Redis (Upstash)
- **CDN:** Vercel Edge Network

---

## 🏛️ Arquitetura

### Estrutura de Pastas

```
Agentify/
├── backend/
│   ├── src/
│   │   ├── index.ts                    # Entry point
│   │   ├── routes/
│   │   │   ├── auth.ts                 # Auth endpoints
│   │   │   ├── agents.ts               # Agent CRUD
│   │   │   ├── conversations.ts        # Conversation management
│   │   │   ├── billing.ts              # Billing/Credits
│   │   │   └── skills.ts               # Skills configuration
│   │   ├── middleware/
│   │   │   ├── auth.ts                 # JWT verification
│   │   │   ├── rateLimit.ts            # Rate limiting
│   │   │   └── errorHandler.ts         # Global error handling
│   │   ├── lib/
│   │   │   ├── prisma.ts               # Prisma client
│   │   │   ├── supabase.ts             # Supabase client
│   │   │   ├── auth.ts                 # Auth utilities
│   │   │   ├── encryption.ts           # AES-256-GCM
│   │   │   └── llm.ts                  # LLM routing
│   │   ├── workers/
│   │   │   ├── whatsapp.ts             # WhatsApp message queue
│   │   │   ├── email.ts                # Email queue
│   │   │   └── webhook.ts              # Webhook processor
│   │   ├── utils/
│   │   │   ├── validators.ts           # Input validation
│   │   │   ├── sanitizers.ts           # XSS/Injection prevention
│   │   │   └── logger.ts               # Logging
│   │   └── types/
│   │       └── index.ts                # TypeScript types
│   ├── prisma/
│   │   └── schema.prisma               # Database schema
│   ├── .env                            # Environment variables
│   └── package.json

├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── _app.tsx                # App wrapper
│   │   │   ├── index.tsx               # Home/Auth
│   │   │   ├── dashboard/
│   │   │   │   ├── index.tsx           # Dashboard
│   │   │   │   ├── agents.tsx          # Agent list
│   │   │   │   ├── create.tsx          # Create agent
│   │   │   │   ├── [id].tsx            # Agent detail
│   │   │   │   ├── billing.tsx         # Billing page
│   │   │   │   └── analytics.tsx       # Analytics
│   │   │   └── api/
│   │   │       └── [...].ts            # API routes
│   │   ├── components/
│   │   │   ├── AgentCreator.tsx        # Agent creation wizard
│   │   │   ├── ChatWidget.tsx          # Chat interface
│   │   │   ├── SkillConfig.tsx         # Skill configuration
│   │   │   ├── BillingPlans.tsx        # Pricing cards
│   │   │   └── Navigation.tsx          # Header/Sidebar
│   │   ├── hooks/
│   │   │   ├── useAuth.ts              # Auth hook
│   │   │   ├── useAgent.ts             # Agent management
│   │   │   └── useApi.ts               # API calls wrapper
│   │   ├── utils/
│   │   │   ├── api.ts                  # API client
│   │   │   ├── auth.ts                 # Auth utilities
│   │   │   └── constants.ts            # Constants
│   │   ├── styles/
│   │   │   └── globals.css             # Global styles
│   │   └── types/
│   │       └── index.ts                # TypeScript types
│   ├── .env.local                      # Environment variables
│   └── package.json
```

### Fluxo de Dados

```
Cliente (Browser)
    ↓
Next.js Frontend (port 3000)
    ↓
API Express.js (port 3001)
    ↓
├── Prisma ORM
│   └── PostgreSQL/Supabase
├── Redis Cache
│   └── BullMQ Queue
├── LLM APIs
│   ├── Anthropic (Claude)
│   ├── OpenAI (GPT-4o)
│   └── Google (Gemini)
└── External Services
    ├── Stripe
    ├── SendGrid
    ├── Evolution API
    └── Supabase Storage
```

---

## 🗄️ Base de Dados

### Modelos Prisma (11 tabelas)

#### 1. **Tenant** (Cliente/Organização)
```prisma
model Tenant {
  id                      String
  name                    String
  email                   String @unique
  passwordHash            String
  companyName             String?
  domain                  String? @unique
  plan                    String  // free, starter, pro, business, enterprise
  creditsTotal            Int
  creditsUsed             Int
  encryptionKey           String  // AES-256 key
  stripeCustomerId        String? @unique
  monthlyRecurringRevenue Float
  createdAt               DateTime
  updatedAt               DateTime
  deletedAt               DateTime?
  
  agents                  Agent[]
  conversations           Conversation[]
  creditLogs              CreditLog[]
  knowledgeBases          KnowledgeBase[]
  auditLogs               AuditLog[]
}
```

#### 2. **Agent** (Agente IA)
```prisma
model Agent {
  id                  String
  tenantId            String
  name                String
  description         String?
  systemPrompt        String
  model               String  // claude-sonnet-4, gpt-4o, etc
  temperature         Float
  maxTokens           Int
  whatsappEnabled     Boolean
  whatsappNumber      String?
  webChatEnabled      Boolean
  emailEnabled        Boolean
  skillHandoff        Boolean
  skillDataCollection Boolean
  skillScheduling     Boolean
  skillFileUpload     Boolean
  skillHumorDetection Boolean
  offHoursMessage     String?
  totalConversations  Int
  totalMessages       Int
  isActive            Boolean
  createdAt           DateTime
  updatedAt           DateTime
  
  tenant              Tenant @relation(fields: [tenantId], references: [id])
  conversations       Conversation[]
  knowledgeBase       KnowledgeBase?
  creditAllocation    CreditAllocation?
}
```

#### 3. **Conversation** (Conversa)
```prisma
model Conversation {
  id                  String
  tenantId            String
  agentId             String
  channelType         String  // whatsapp, web, email
  externalId          String?
  visitorId           String?
  summary             String?
  sentiment           Float?  // -1.0 a +1.0
  urgency             String?
  resolved            Boolean
  handedOffToHuman    Boolean
  humanAgent          String?
  modelUsed           String?
  tokensUsed          Int
  creditsUsed         Int
  createdAt           DateTime
  updatedAt           DateTime
  closedAt            DateTime?
  
  tenant              Tenant @relation(fields: [tenantId], references: [id])
  agent               Agent @relation(fields: [agentId], references: [id])
  messages            Message[]
}
```

#### 4. **Message** (Mensagem - Encriptada)
```prisma
model Message {
  id                  String
  conversationId      String
  role                String  // user, assistant
  content             String  // AES-256-GCM encriptado
  contentIV           String? // Initialization vector
  tokens              Int
  model               String?
  timestamp           DateTime
  
  conversation        Conversation @relation(fields: [conversationId], references: [id])
}
```

#### 5-11. **Outras tabelas**
- CreditLog: Histórico de consumo de créditos
- CreditAllocation: Alocação de créditos por agente
- RefreshToken: Refresh tokens revogáveis
- KnowledgeBase: Base de conhecimento por agente
- Document: Documentos na KB
- Embedding: Embeddings pgvector
- StripeEvent: Webhooks do Stripe
- AuditLog: Logs de auditoria

---

## 🔌 APIs e Endpoints

### Autenticação
```
POST   /api/auth/signup              # Registar
POST   /api/auth/login               # Login
POST   /api/auth/refresh             # Refresh token
POST   /api/auth/logout              # Logout
POST   /api/auth/reset-password      # Reset password
```

### Agentes
```
GET    /api/agents                   # Listar agentes
POST   /api/agents                   # Criar agente
GET    /api/agents/:id               # Detalhe do agente
PATCH  /api/agents/:id               # Editar agente
DELETE /api/agents/:id               # Apagar agente
POST   /api/agents/:id/test          # Testar agente
```

### Conversas
```
GET    /api/conversations            # Listar conversas
GET    /api/conversations/:id        # Detalhe da conversa
POST   /api/conversations/:id/messages  # Nova mensagem
GET    /api/conversations/:id/messages  # Histórico
```

### Créditos
```
GET    /api/credits                  # Saldo de créditos
GET    /api/credits/usage            # Consumo por agente
POST   /api/credits/add              # Adicionar créditos
```

### Billing
```
GET    /api/billing/plans            # Listar planos
POST   /api/billing/subscribe        # Subscrever plano
GET    /api/billing/invoice          # Listar faturas
GET    /api/billing/usage            # Uso de recursos
```

### Skills
```
GET    /api/skills                   # Listar skills disponíveis
POST   /api/agents/:id/skills        # Ativar skill
PATCH  /api/agents/:id/skills/:name  # Configurar skill
```

---

## 🔐 Segurança

### Implementado
- ✅ **AES-256-GCM** encriptação por tenant
- ✅ **JWT** com algoritmo HS256 fixo
- ✅ **Refresh Tokens** como hash SHA-256 em httpOnly cookies
- ✅ **SSRF bloqueado** em skills
- ✅ **Rate limiting** em todas as rotas
- ✅ **XSS prevention** com sanitização
- ✅ **CSRF tokens** em cookies
- ✅ **RLS** (Row Level Security) em Supabase
- ✅ **SQL injection prevention** com Prisma parameterized queries
- ✅ **GDPR compliance** - dados apagáveis

### Headers de Segurança
```
Content-Security-Policy: default-src 'self'
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
Strict-Transport-Security: max-age=31536000
```

---

## ⚡ Performance

### Otimizações
- **Next.js Image Optimization** - imagens redimensionadas automaticamente
- **Code Splitting** - lazy loading de componentes
- **Redis Cache** - cache de queries frequentes
- **Database Indexing** - índices em campos de busca
- **CDN** - Vercel Edge Network para assets estáticos
- **Compression** - gzip/brotli em respostas HTTP

### Métricas Alvo
- **First Load JS:** < 80 KB
- **Time to Interactive:** < 3s
- **Largest Contentful Paint:** < 2.5s
- **Cumulative Layout Shift:** < 0.1

---

## 🚀 Escalabilidade

### Horizontal
- Backend stateless → múltiplas instâncias
- Load balancer entre chaves API de LLMs
- BullMQ com múltiplos workers

### Vertical
- PostgreSQL pooled connections (pgbouncer)
- Redis clustering (Upstash)
- Aumentar recursos de compute

### Limites
- Max 30 agentes por tenant (Starter)
- Max 20 conversations simultâneas por agente
- Rate limit: 100 req/min por tenant

---

## 📦 Deployment

### Ambiente Local
```bash
cd backend && npm run dev
cd frontend && npm run dev
```

### Staging
```bash
Backend:  https://agentfy-backend-staging.railway.app
Frontend: https://agentfy-frontend-staging.vercel.app
```

### Produção
```bash
Backend:  https://agentfy-backend.railway.app (ou Render)
Frontend: https://agentfy.tech
```

---

## 🔧 Variáveis de Ambiente

### Backend (.env)
```
DATABASE_URL=postgresql://...
JWT_SECRET=...
ENCRYPTION_KEY=...
SUPABASE_URL=...
SUPABASE_ANON_KEY=...
OPENAI_API_KEY=...
ANTHROPIC_API_KEY=...
STRIPE_SECRET_KEY=...
STRIPE_WEBHOOK_SECRET=...
SENDGRID_API_KEY=...
REDIS_URL=...
```

### Frontend (.env.local)
```
NEXT_PUBLIC_API_URL=http://localhost:3001
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
```

