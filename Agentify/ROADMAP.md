# 🗺️ ROADMAP - AGENTFY

## ✅ MVP (Atual - v0.1)

### Backend
- [x] Autenticação JWT + Refresh Tokens
- [x] CRUD de Agentes
- [x] Schema Prisma (11 modelos)
- [x] Encriptação AES-256-GCM
- [x] Rate limiting
- [x] Middleware de autenticação
- [x] Health check endpoint

### Frontend
- [x] Página de login/signup
- [x] Dashboard básico
- [x] Home/landing page
- [x] Deploy em Vercel

### Infraestrutura
- [x] Supabase database
- [x] GitHub repository
- [x] Vercel deployment
- [x] Environment variables

---

## 🔧 FASE 1 (Semanas 1-2)

### Features Core
- [ ] **Chat Widget Funcional**
  - [ ] WebSocket para real-time
  - [ ] Styling customizável
  - [ ] Sanitização XSS
  - [ ] Histórico persistente

- [ ] **Integração com LLMs**
  - [ ] Claude (Anthropic) ✅ parcial
  - [ ] OpenAI (GPT-4o)
  - [ ] Load balancing entre chaves
  - [ ] Fallback automático

- [ ] **Sistema de Créditos**
  - [ ] Cálculo por mensagem
  - [ ] Pool de créditos por agente
  - [ ] Alertas em 70%, 80%, 90%
  - [ ] Histórico de consumo

- [ ] **Análise de Conversa**
  - [ ] Detecção de sentimento (Haiku)
  - [ ] Geração de resumo automático
  - [ ] Classificação de urgência
  - [ ] Histórico indexado

### Backend Endpoints
- [ ] POST /api/conversations/:id/messages
- [ ] GET /api/conversations/:id
- [ ] GET /api/credits
- [ ] POST /api/agents/:id/test

### UI Components
- [ ] ChatWidget (React)
- [ ] MessageBubble
- [ ] InputForm
- [ ] SentimentIndicator

---

## 📊 FASE 2 (Semanas 3-4)

### Features de Engagement
- [ ] **Skills (Habilidades)**
  - [ ] Handoff com resumo IA ✅ design
  - [ ] Data Collection (formulário conversacional)
  - [ ] Scheduling (Google Calendar/Calendly)
  - [ ] File Upload/Download

- [ ] **Auto-Routing de Modelos** (Pro+)
  - [ ] Classificação de intenção
  - [ ] Seleção automática de modelo
  - [ ] Logging de decisões

- [ ] **Análise de Humor** (Pro+)
  - [ ] 8 estados emocionais
  - [ ] Score de -1.0 a +1.0
  - [ ] Auto-escalate automático
  - [ ] Dashboard visual

### Billing
- [ ] Integração Stripe
- [ ] Webhook handlers
- [ ] Subscription management
- [ ] Invoice history

### Analytics
- [ ] Dashboard de métricas
- [ ] Gráficos por período
- [ ] Export PDF
- [ ] Comparação ao longo do tempo

---

## 🤖 FASE 3 (Semanas 5-6)

### WhatsApp Integration
- [ ] Evolution API setup (self-hosted)
- [ ] Message queuing (BullMQ)
- [ ] Webhook handling
- [ ] Media support (imagens, documentos)
- [ ] Batch sending

### Integrações de Skills
- [ ] **CRM:**
  - [ ] HubSpot sync
  - [ ] Salesforce sync
  - [ ] Custom webhook

- [ ] **E-commerce:**
  - [ ] Shopify order lookup
  - [ ] WooCommerce integration
  - [ ] Inventory check

- [ ] **Ticketing:**
  - [ ] Zendesk auto-create
  - [ ] Freshdesk integration
  - [ ] Status tracking

### Knowledge Base
- [ ] File upload (PDF, Word, Excel, etc)
- [ ] OCR para documentos scaneados
- [ ] Semantic search com pgvector
- [ ] Chunking automático
- [ ] Update/Delete documentos

---

## 🎨 FASE 4 (Semanas 7-8)

### UI/UX Polishing
- [ ] Design system completo
- [ ] Dark mode
- [ ] Mobile responsive
- [ ] Accessibility (WCAG 2.1)

### Agente-Criador de Agentes
- [ ] Wizard interativo
- [ ] IA suggestion (Sonnet)
- [ ] Preview de system prompt
- [ ] Templates pré-configurados

### Admin Dashboard (Futura)
- [ ] MRR e margem por cliente
- [ ] Distribuição de uso por modelo
- [ ] Churn prediction
- [ ] Custom reports

### Marketplace (Roadmap)
- [ ] Agentes pré-configurados
- [ ] Rating/Review system
- [ ] Comissão para criadores

---

## 🚀 FASE 5+ (Futuro)

### Voice & Video
- [ ] Call center integration
- [ ] Voice recognition
- [ ] Video chat support
- [ ] Transcription

### Advanced Features
- [ ] Multi-agent conversations
- [ ] Agent fine-tuning
- [ ] Custom model training
- [ ] Blockchain verification (?)

### Enterprise
- [ ] On-premise deployment
- [ ] Custom SLA
- [ ] Dedicated support
- [ ] White-label completo
- [ ] Regional data centers

---

## 📅 Timeline Estimado

```
AGORA
  ↓
Semana 1: Chat Widget + LLMs ✅
  ↓
Semana 2: Créditos + Analytics
  ↓
Semana 3: Skills + Billing
  ↓
Semana 4: WhatsApp + Integrações
  ↓
Semana 5: KB + Polish UI
  ↓
Semana 6: Launch MVP 🚀
  ↓
Semana 7+: Features avançadas
```

---

## 🎯 Métricas de Sucesso (MVP)

- [ ] 100 signups primeira semana
- [ ] 10% activation rate (10 agentes criados)
- [ ] 90% uptime
- [ ] < 500ms avg response time
- [ ] Net Promoter Score (NPS) > 40
- [ ] Churn < 5%/mês

---

## 🔴 Critical Path

1. ✅ Backend structure
2. ✅ Frontend structure
3. ✅ Auth + DB schema
4. ⏳ LLM integration (próxima)
5. ⏳ Chat widget
6. ⏳ Créditos system
7. ⏳ WhatsApp
8. 🚀 Launch

---

## 💡 Ideias Futuras

- Agentes com memória a longo prazo
- Personagem/voz customizável
- Templates de industry
- Integração com Zapier
- API pública
- Webhooks avançados
- Forum de comunidade
- Agente de ajuda (meta-agente)

