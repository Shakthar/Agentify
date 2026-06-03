# 🚀 AGENTFY - SETUP COMPLETO

## 1️⃣ Preparar o Supabase

### Credenciais fornecidas:
```
URL: https://xxgciwhibhqwifqtuzta.supabase.co
Publishable Key: sb_publishable_AO2xIazT9Sztvzsw7Ubgrw_rDflqL8A
Database URL: postgresql://postgres:TmW@E#.3&MyK,vR@db.xxgciwhibhqwifqtuzta.supabase.co:5432/postgres
Database password: TmW@E#.3&MyK,vR
```

### ⚠️ SEGURANÇA CRÍTICA - REGENERAR CREDENCIAIS DEPOIS DO SETUP:
Assim que o projeto estiver em funcionamento:
1. Ir a Supabase Dashboard → Settings → Database
2. Regenerar a senha do utilizador `postgres`
3. Regenerar a `SERVICE_KEY` em Settings → API
4. Atualizar o `.env` com as novas chaves
5. Fazer commit com as credenciais novas (nunca commitir credenciais antigas)

---

## 2️⃣ Setup Local (Desenvolvimento)

### Clone do repositório:
```bash
git clone https://github.com/Shakthar/Agentify.git
cd Agentify
```

### Backend Setup:
```bash
cd backend

# Instalar dependências
npm install

# Copiar e preencher as variáveis de ambiente
cp .env.example .env

# No .env, preencher:
# DATABASE_URL=postgresql://postgres:TmW@E#.3&MyK,vR@db.xxgciwhibhqwifqtuzta.supabase.co:6543/postgres?pgbouncer=true
# SUPABASE_URL=https://xxgciwhibhqwifqtuzta.supabase.co
# SUPABASE_ANON_KEY=sb_publishable_AO2xIazT9Sztvzsw7Ubgrw_rDflqL8A
# JWT_SECRET=[gerar com: openssl rand -base64 32]
# ENCRYPTION_KEY=[gerar com: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"]

# Gerar cliente Prisma
npm run prisma:generate

# Criar tabelas no Supabase
npm run prisma:push

# Iniciar servidor de desenvolvimento
npm run dev
```

### Frontend Setup:
```bash
cd frontend

# Instalar dependências
npm install

# Copiar e preencher variáveis
cp .env.local.example .env.local

# NEXT_PUBLIC_API_URL=http://localhost:3001
# NEXT_PUBLIC_SUPABASE_URL=https://xxgciwhibhqwifqtuzta.supabase.co
# NEXT_PUBLIC_SUPABASE_ANON_KEY=sb_publishable_AO2xIazT9Sztvzsw7Ubgrw_rDflqL8A

# Iniciar dev server
npm run dev
# Abrir http://localhost:3000
```

---

## 3️⃣ Estrutura do Projeto

```
agentify/
├── backend/
│   ├── src/
│   │   ├── index.ts                    # Entrada da API
│   │   ├── lib/                        # Lógica compartilhada
│   │   │   ├── encryption.ts           # AES-256-GCM por tenant
│   │   │   ├── credits.ts              # Sistema de créditos
│   │   │   ├── security.ts             # Validações de segurança
│   │   │   ├── model-router.ts         # Auto-routing de IAs
│   │   │   ├── document-processor.ts   # Treino (PDF, YouTube, etc)
│   │   │   ├── knowledge.ts            # RAG com embeddings
│   │   │   ├── email.ts                # SendGrid templates
│   │   │   └── logger.ts               # Pino + sanitização
│   │   ├── routes/
│   │   │   ├── auth.ts                 # Login, registro, JWT
│   │   │   ├── agents.ts               # CRUD de agentes
│   │   │   ├── chat.ts                 # Chat com LLM + créditos
│   │   │   ├── agent-creator.ts        # O agente que cria agentes
│   │   │   ├── skills.ts               # Configuração de skills
│   │   │   ├── credits.ts              # Gestão de créditos
│   │   │   ├── billing.ts              # Stripe webhooks
│   │   │   ├── knowledge.ts            # Base de conhecimento
│   │   │   ├── admin.ts                # Dashboard do admin
│   │   │   └── gdpr.ts                 # Remoção de dados
│   │   ├── workers/
│   │   │   ├── whatsapp.worker.ts      # Processa fila de WA
│   │   │   └── jobs/
│   │   │       ├── monthly-reset.ts    # Reset de créditos
│   │   │       └── churn-prediction.ts # Análise de churn
│   │   └── middleware/
│   │       ├── auth.ts                 # JWT validation
│   │       ├── rateLimit.ts            # Rate limiting
│   │       └── errorHandler.ts         # Erro global
│   ├── prisma/
│   │   ├── schema.prisma               # BD completa
│   │   └── migrations/                 # Histórico de alterações
│   ├── .env.example
│   ├── package.json
│   └── tsconfig.json
│
├── frontend/
│   ├── src/
│   │   ├── pages/
│   │   │   ├── auth/
│   │   │   │   ├── login.tsx
│   │   │   │   └── signup.tsx
│   │   │   ├── dashboard/
│   │   │   │   ├── agents/[id]/edit.tsx
│   │   │   │   ├── agents/create/wizard.tsx
│   │   │   │   ├── agents/create/agent-creator.tsx
│   │   │   │   └── analytics.tsx
│   │   │   ├── billing/
│   │   │   │   ├── plans.tsx
│   │   │   │   ├── usage.tsx
│   │   │   │   └── invoice.tsx
│   │   │   ├── admin/
│   │   │   │   ├── customers.tsx
│   │   │   │   ├── usage-analytics.tsx
│   │   │   │   └── churn-prediction.tsx
│   │   │   └── forum/
│   │   │       ├── threads.tsx
│   │   │       └── [id].tsx
│   │   ├── components/
│   │   │   ├── AgentCreator.tsx         # Chat para criar agentes
│   │   │   ├── AgentWizard.tsx          # Wizard manual
│   │   │   ├── SkillConfigurator.tsx    # Config de skills
│   │   │   ├── ChatPreview.tsx          # Preview do agente
│   │   │   └── PricingTable.tsx         # Tabela de planos
│   │   ├── hooks/
│   │   │   ├── useAuth.ts
│   │   │   ├── useAgent.ts
│   │   │   └── useCredits.ts
│   │   └── utils/
│   │       ├── api.ts                  # Cliente HTTP
│   │       └── encryption.ts           # Crypto no browser
│   ├── .env.local.example
│   ├── package.json
│   └── next.config.js
│
├── docs/
│   ├── ARCHITECTURE.md                  # Guia técnico
│   ├── SKILLS.md                        # Documentação de skills
│   ├── API.md                           # Referência de API
│   ├── DEPLOYMENT.md                    # Deploy em produção
│   └── SECURITY.md                      # Auditorias de segurança
│
├── .gitignore
├── .env.example (root)
└── README.md
```

---

## 4️⃣ Checklist de Setup

### ✅ Supabase
- [ ] Criar projeto Supabase (já feito)
- [ ] Copiar credenciais
- [ ] Configurar RLS em todas as tabelas
- [ ] Configurar Supabase Vault para secrets
- [ ] Testar conexão com `psql`

### ✅ Backend
- [ ] Instalar dependências (`npm install`)
- [ ] Gerar Prisma (`npm run prisma:generate`)
- [ ] Preencher `.env` com credenciais
- [ ] Deploy schema (`npm run prisma:push`)
- [ ] Testar rotas básicas (`npm run dev`)

### ✅ Frontend
- [ ] Instalar dependências
- [ ] Preencher `.env.local`
- [ ] Testar autenticação
- [ ] Testar criação de agente

### ✅ GitHub
- [ ] Fazer clone do repositório
- [ ] Criar `.env` e `.env.local` (nunca commitir)
- [ ] Fazer primeiro commit
- [ ] Configurar Actions para CI/CD

---

## 5️⃣ Testar a Plataforma Localmente

### Backend está ok?
```bash
curl http://localhost:3001/health
# Deve retornar: { "status": "ok", "version": "1.0.0" }
```

### Frontend está ok?
```bash
# Abrir http://localhost:3000
# Deve carregar página de login
```

### Criar primeiro agente:
1. Ir a http://localhost:3000/auth/signup
2. Registar com email qualquer
3. Ir a Dashboard → Create Agent
4. Escolher Agent Creator (chat) ou Wizard (manual)
5. Seguir os passos

---

## 6️⃣ Deploy em Produção (Depois)

### Backend → Railway
```bash
railway login
railway link # Selecciona o projeto
railway up
```

### Frontend → Vercel
```bash
npm install -g vercel
vercel --prod
```

### Domínio
```bash
# Criar subdomínio agents.shaklabs.tech
# Apontar CNAME para Vercel + Railway
```

---

## 7️⃣ Variáveis de Ambiente Importantes

| Variável | Onde gerar | Crítico? |
|----------|-----------|---------|
| `JWT_SECRET` | `openssl rand -base64 32` | ✅ SIM |
| `ENCRYPTION_KEY` | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` | ✅ SIM |
| `ANTHROPIC_API_KEY` | console.anthropic.com | ✅ SIM |
| `STRIPE_SECRET_KEY` | dashboard.stripe.com | ✅ SIM |
| `DATABASE_URL` | Supabase Settings → Database | ✅ SIM |
| `REDIS_URL` | Upstash.com | Para produção |

---

## ⚠️ Próximos Passos

1. **Fazer clone** do repositório GitHub
2. **Setup local** seguindo as instruções acima
3. **Testar** a plataforma em `http://localhost:3000`
4. **Regenerar credenciais** no Supabase (importantíssimo por segurança)
5. **Deploy** em produção (Railway + Vercel)

---

Pronto? Começa pelo passo 1 e diz-me se algo não funciona! 🚀
