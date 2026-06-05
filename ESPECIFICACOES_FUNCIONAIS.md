# 📋 ESPECIFICAÇÕES FUNCIONAIS - AGENTFY

## 🎯 Visão Geral

**Agentfy** é uma plataforma SaaS global para criar, configurar e vender agentes IA de atendimento ao cliente.

**Slogan:** "Transforme seu atendimento com agentes IA inteligentes"

---

## 👥 Personas

### 1. **Owner/Admin da Plataforma**
- Responsável por gestão global
- Acesso a analytics de todos os clientes
- Gestão de planos e preços

### 2. **Tenant (Cliente)**
- Compra um plano da plataforma
- Cria e configura agentes
- Gerencia conversas
- Monitora usage e créditos

### 3. **End User (Visitante)**
- Interage com o chatbot
- Faz perguntas
- Solicita atendimento humano

---

## 🔄 User Flows

### Flow 1: Registar e Criar Primeiro Agente

```
1. Visitante clica "Sign Up"
2. Preenche email + senha
3. Verifica email (link de confirmação)
4. Faz login
5. Sistema sugere: "Criar primeiro agente?"
6. Clica "Create Agent"
7. Wizard:
   a) Descreve o negócio (textarea)
   b) Sistema sugere nome + tipo
   c) Seleciona modelo (Haiku, Sonnet, GPT-4o)
   d) Configura skills (opcionais)
   e) Preview do system prompt
8. Clica "Deploy"
9. Sucesso! Agente disponível em chat widget
```

### Flow 2: Usar o Agente (Como End User)

```
1. Visitante acessa website com widget embedded
2. Clica no chat (canto inferior direito)
3. Widget abre
4. Escreve pergunta
5. Agente responde
6. Sentimento detectado:
   - Positivo ✅
   - Frustrado 😞 → Sistema detecta e avisa
   - Furioso 😡 → Escalamento automático
7. Se escalada:
   a) Mensagem para human agent
   b) Resumo IA automático da conversa
   c) Contexto completo para human
8. Human responde
9. Conversa arquivada
```

### Flow 3: Gestão de Créditos

```
Tenant acessa Dashboard:
1. Vê saldo atual: "2,340 créditos"
2. Vê uso por agente:
   - Agent A: 340 créditos (Haiku mostly)
   - Agent B: 1,200 créditos (Sonnet)
   - Agent C: 800 créditos (GPT-4o)
3. Alertas:
   - 70% consumido → Email
   - 80% consumido → Banner
   - 90% consumido → Notificação push
4. Pode:
   a) Comprar créditos avulso (€3,90 a €499)
   b) Fazer upgrade de plano
   c) Ativar rollover (2x créditos + €20/mês)
```

### Flow 4: Análise de Conversa

```
Admin acessa Analytics:
1. Filtra por agente + período
2. Vê:
   - Total de conversas: 1,240
   - Taxa de resolução: 87%
   - Tempo médio: 2m 34s
   - Sentimento médio: +0.65
   - Escalações: 34 (2.7%)
3. Exporta relatório PDF
```

---

## 🎨 Features por Tier

### Free (€0/mês)
- 3 agentes
- 3,000 créditos/mês
- Modelos: Haiku, GPT-4o mini
- Skills: Detecção de idioma
- Limite: 100 conversas/mês

### Starter (€39/mês)
- ✅ 10 agentes
- ✅ 10,000 créditos/mês
- ✅ +Sonnet 4
- ✅ Skills: Handoff, Data Collection, Scheduling, File Upload
- ✅ Analytics básico
- ✅ White-label: +€10/mês

### Pro (€89/mês)
- ✅ 20 agentes
- ✅ 30,000 créditos/mês
- ✅ +GPT-4o
- ✅ Humor Detection + Auto-escalate
- ✅ Respostas rápidas (botões)
- ✅ Analytics avançado
- ✅ API access

### Business (€159/mês)
- ✅ 30 agentes
- ✅ 60,000 créditos/mês
- ✅ +Gemini, Llama 3.3
- ✅ Integrações: CRM, Ticketing, E-commerce
- ✅ Custom domain white-label
- ✅ Prioridade suporte

### Enterprise (€259/mês + scale)
- ✅ 30+ agentes (escalável)
- ✅ 75,000+ créditos
- ✅ Opus 4 exclusivo
- ✅ Todas as integrações
- ✅ SLA 99.9%
- ✅ Dedicated account manager

---

## 🛠️ Skills (Funcionalidades)

### Built-in (Sem Custo Extra)

#### 1. **Handoff com Resumo IA**
- Quando agente escala para human
- Sistema gera automaticamente:
  - Nome do cliente
  - Problema principal
  - O que foi tentado
  - Estado atual
  - Nível de urgência
  - Ação sugerida
  - Info-chave
- Email enviado com resumo + histórico completo

#### 2. **Recolha de Dados (Data Collection)**
- Formulário conversacional
- Exemplo: "Qual é o seu email?"
- Sistema extrai automaticamente estruturado
- Integra com formulário

#### 3. **Agendamento (Scheduling)**
- Integração: Google Calendar, Calendly
- Agente: "Quer agendar uma chamada?"
- User vê slots disponíveis
- Agendamento criado automaticamente

#### 4. **Envio de Ficheiro**
- Agente pode enviar:
  - PDFs
  - Documentos
  - Screenshots
- Sistema valida mime-type (segurança)

#### 5. **Detecção de Idioma Automática**
- Sistema detecta idioma do user
- Agente responde no mesmo idioma
- Suporta: PT, EN, ES, FR, DE, IT, NL, RU, ZH, JA, KO

#### 6. **Mensagem Fora de Horário**
- Admin configura: "Estamos online 9-17h"
- Fora desse horário: mensagem automática
- "Olá! Estamos offline, mas responderemos amanhã."

#### 7. **Resumo de Conversa**
- User pode solicitar: "Resumo desta conversa"
- Sistema gera automaticamente

#### 8. **Classificação de Urgência**
- Sistema detecta nível: Low, Medium, High, Critical
- Alertas para human agents

#### 9. **Análise de Humor + Auto-Escalate** (Pro+)
- 8 estados: Muito Positivo, Positivo, Neutro, Frustrado, Irritado, Furioso, Desistente, Vulnerável
- Score: -1.0 a +1.0
- Auto-escalate se: Irritado, Furioso, Desistente
- Visible no dashboard

#### 10. **Respostas Rápidas (Botões)** (Pro+)
- Admin configura botões de resposta rápida
- User clica em vez de escrever
- Exemplo: "👍 Sim" "👎 Não" "🤷 Talvez"

---

### Add-ons Pagos (Por Agente/Mês)

| Skill | Preço | Descrição |
|-------|-------|-----------|
| **Actualização CRM** | €20 | Sync com HubSpot/Salesforce |
| **Estado de Pedido** | €15 | Integração Shopify/WooCommerce |
| **Criação de Ticket** | €10 | Zendesk/Freshdesk |
| **Consulta de Preços** | €10 | Tabela de preços dinâmica |
| **Email Automático** | €12 | SendGrid/Mailchimp |
| **Webhook Personalizado** | €25 | POST para teu servidor |

---

## 📊 Dashboard Tenant

### Home
- Status dos agentes (Online/Offline)
- Últimas conversas
- Alerts (créditos baixos, escalações)

### Agents
- Lista de agentes com stats
- Criar novo
- Editar/Deletar
- Test agent

### Conversations
- Listar todas as conversas
- Filtrar por agente
- Ver transcripts completos (encriptados)
- Exportar conversa

### Analytics
- Gráficos de conversas por dia
- Taxa de resolução
- Tempo médio de resposta
- Sentimento ao longo do tempo
- Modelos mais usados
- Custos vs receita

### Billing
- Plano atual
- Upgrade/Downgrade
- Histórico de faturas
- Método de pagamento
- Consumo de créditos em tempo real

### Settings
- Perfil da empresa
- Integração WhatsApp
- Chave API
- Webhooks
- Logs de auditoria

---

## 🔄 Auto-Routing de Modelos (Pro+)

Sistema classifica cada mensagem automaticamente:

```
Intenção Detectada    → Modelo      → Créditos
────────────────────────────────────────────────
SIMPLE_FAQ            → Haiku       → 1 cr
KNOWLEDGE_LOOKUP      → Haiku       → 1 cr
SCHEDULING            → Sonnet      → 5 cr
COMPLAINT             → Sonnet      → 5 cr
TECHNICAL_ISSUE       → GPT-4o      → 8 cr
COMPLEX_LOGIC         → Opus 4      → 15 cr
```

**Resultado:** ~60% mensagens em Haiku = **40-60% economia de créditos**

---

## 🤖 Agente-Criador de Agentes

User descreve o negócio em linguagem natural:
```
"Preciso de um agente para suporte de e-commerce.
Deve responder sobre pedidos, devoluções e promoções.
Tem que ser simpático e nunca prometer coisas."
```

Sistema:
1. ✅ Gera system prompt automaticamente (Sonnet)
2. ✅ Sugere skills a ativar
3. ✅ Escolhe modelo recomendado
4. ✅ Apresenta preview
5. ✅ User aprova ou ajusta

**Custo:** ~2-3 créditos por conversa

---

## 📚 Base de Conhecimento

### Fontes Suportadas
- PDF (com OCR se necessário)
- Word (.docx)
- Excel (.xlsx)
- PowerPoint (.pptx)
- CSV
- YouTube (transcrição automática)
- URLs (web scraper)
- Texto direto (copy-paste)

### Processamento
1. User faz upload
2. Sistema extrai texto
3. Divide em chunks (500 tokens)
4. Cria embeddings (pgvector)
5. Indexa em Supabase
6. Agente pode consultar via semantic search

### Busca
- Semântica (vetorial)
- Keyword (BM25)
- Híbrida (combinação)

---

## 💰 Modelo Financeiro

### Receita
- Subscrições mensais
- Créditos avulso
- Add-ons de skills
- White-label (€50-100/mês)
- Marketplace de agentes (futuro)

### Custos
- LLM APIs (Anthropic, OpenAI, Google)
- Infraestrutura (Supabase, Railway/Render, Vercel)
- SendGrid (emails)
- Stripe (2.9% + €0.30/transação)
- Support (helpdesk, forum)

### Margem Esperada
| Plano | Receita | Custo LLM | Custo Infra | Margem |
|-------|---------|-----------|-------------|--------|
| Starter | €39 | €10 | €1.50 | €27.50 (70%) |
| Pro | €89 | €30 | €2.50 | €56.50 (63%) |
| Business | €159 | €80 | €4 | €75 (47%) |
| Enterprise | €259 | €100 | €7 | €152 (59%) |

---

## 🔮 Roadmap (Futuro)

### MVP (Atual)
- ✅ Criar/editar agentes
- ✅ Chat widget
- ✅ WhatsApp integration
- ✅ Billing com Stripe
- ✅ Analytics básico

### V1.1 (1-2 meses)
- Marketplace de agentes pré-configurados
- API publica completa
- Webhooks avançados
- Integração Zapier

### V2.0 (3-6 meses)
- Agentes multilingues
- Fine-tuning de modelos
- Voice (call center)
- Video support

### V3.0 (6-12 meses)
- Agentes colaborativos (multi-agent)
- Blockchain verification
- Enterprise SLA
- Regional data centers

