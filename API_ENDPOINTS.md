# 🔌 DOCUMENTAÇÃO DE API - AGENTFY

## Base URL
```
http://localhost:3001  (desenvolvimento)
https://api.agentfy.tech  (produção)
```

## Autenticação
```
Header: Authorization: Bearer {JWT_TOKEN}
```

---

## 🔐 AUTH - Autenticação

### POST /api/auth/signup
Registar novo tenant

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!",
  "companyName": "Minha Empresa",
  "name": "João Silva"
}
```

**Response:** 201
```json
{
  "id": "tenant_123",
  "email": "user@example.com",
  "companyName": "Minha Empresa",
  "plan": "free",
  "creditsTotal": 3000,
  "token": "eyJhbGc...",
  "refreshToken": "eyJhbGc..."
}
```

---

### POST /api/auth/login
Login

**Request:**
```json
{
  "email": "user@example.com",
  "password": "SecurePass123!"
}
```

**Response:** 200
```json
{
  "token": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "tenant": { ... }
}
```

---

### POST /api/auth/refresh
Renovar token expirado

**Response:** 200
```json
{
  "token": "eyJhbGc...",
  "refreshToken": "eyJhbGc..."
}
```

---

## 🤖 AGENTS - Agentes

### GET /api/agents
Listar todos os agentes do tenant

**Query Params:**
- `skip`: 0
- `take`: 10
- `search`: (opcional) filtro por nome

**Response:** 200
```json
{
  "agents": [
    {
      "id": "agent_123",
      "name": "Suporte",
      "description": "Agente de suporte ao cliente",
      "model": "claude-sonnet-4",
      "isActive": true,
      "totalConversations": 45,
      "totalMessages": 234,
      "createdAt": "2024-06-03T10:00:00Z"
    }
  ],
  "total": 1
}
```

---

### POST /api/agents
Criar novo agente

**Request:**
```json
{
  "name": "Suporte",
  "description": "Agente de suporte",
  "systemPrompt": "Você é um assistente de suporte...",
  "model": "claude-sonnet-4",
  "temperature": 0.7,
  "maxTokens": 2000,
  "skills": {
    "handoff": true,
    "dataCollection": true,
    "scheduling": true
  }
}
```

**Response:** 201
```json
{
  "id": "agent_123",
  "name": "Suporte",
  "systemPrompt": "Você é um assistente...",
  "model": "claude-sonnet-4",
  "isActive": true,
  "createdAt": "2024-06-03T10:00:00Z"
}
```

---

### GET /api/agents/:id
Detalhe do agente

**Response:** 200
```json
{
  "id": "agent_123",
  "name": "Suporte",
  "description": "...",
  "systemPrompt": "...",
  "model": "claude-sonnet-4",
  "temperature": 0.7,
  "maxTokens": 2000,
  "whatsappEnabled": false,
  "webChatEnabled": true,
  "emailEnabled": false,
  "skills": {
    "handoff": true,
    "dataCollection": true,
    "scheduling": true,
    "fileUpload": true
  },
  "statistics": {
    "totalConversations": 45,
    "totalMessages": 234,
    "averageResolution": 0.87,
    "averageResponseTime": "2m 34s"
  },
  "createdAt": "2024-06-03T10:00:00Z",
  "updatedAt": "2024-06-03T15:30:00Z"
}
```

---

### PATCH /api/agents/:id
Editar agente

**Request:**
```json
{
  "name": "Suporte Premium",
  "description": "Agente de suporte avançado",
  "systemPrompt": "Novo prompt...",
  "temperature": 0.5
}
```

**Response:** 200
```json
{
  "id": "agent_123",
  "name": "Suporte Premium",
  ...
}
```

---

### DELETE /api/agents/:id
Apagar agente

**Response:** 204 (No Content)

---

### POST /api/agents/:id/test
Testar agente com uma mensagem

**Request:**
```json
{
  "message": "Olá, como funciona o vosso serviço?"
}
```

**Response:** 200
```json
{
  "response": "Olá! Bem-vindo ao nosso serviço...",
  "tokensUsed": 145,
  "creditsUsed": 1,
  "model": "claude-sonnet-4"
}
```

---

## 💬 CONVERSATIONS - Conversas

### GET /api/conversations
Listar conversas

**Query Params:**
- `agentId`: (obrigatório)
- `status`: open, closed, escalated
- `skip`: 0
- `take`: 20

**Response:** 200
```json
{
  "conversations": [
    {
      "id": "conv_123",
      "agentId": "agent_123",
      "channelType": "web",
      "visitorId": "visitor_abc",
      "summary": "Pergunta sobre integração com Stripe",
      "sentiment": 0.7,
      "resolved": false,
      "totalMessages": 5,
      "createdAt": "2024-06-03T10:00:00Z",
      "updatedAt": "2024-06-03T10:15:00Z"
    }
  ],
  "total": 1
}
```

---

### GET /api/conversations/:id
Detalhe da conversa (com histórico)

**Response:** 200
```json
{
  "id": "conv_123",
  "agentId": "agent_123",
  "channelType": "web",
  "visitorId": "visitor_abc",
  "visitorName": "João",
  "visitorEmail": "joao@example.com",
  "summary": "Pergunta sobre integração com Stripe",
  "sentiment": 0.7,
  "urgency": "medium",
  "resolved": false,
  "handedOffToHuman": false,
  "messages": [
    {
      "id": "msg_1",
      "role": "user",
      "content": "Como integro com Stripe?",
      "timestamp": "2024-06-03T10:00:00Z"
    },
    {
      "id": "msg_2",
      "role": "assistant",
      "content": "Para integrar com Stripe, você pode...",
      "model": "claude-sonnet-4",
      "tokensUsed": 145,
      "timestamp": "2024-06-03T10:00:30Z"
    }
  ],
  "createdAt": "2024-06-03T10:00:00Z",
  "updatedAt": "2024-06-03T10:15:00Z"
}
```

---

### POST /api/conversations/:id/messages
Enviar mensagem (nova resposta do agente)

**Request:**
```json
{
  "message": "Como posso integrar?"
}
```

**Response:** 200
```json
{
  "userMessage": {
    "id": "msg_1",
    "role": "user",
    "content": "Como posso integrar?",
    "timestamp": "2024-06-03T10:00:00Z"
  },
  "agentResponse": {
    "id": "msg_2",
    "role": "assistant",
    "content": "Para integrar com Stripe...",
    "model": "claude-sonnet-4",
    "tokensUsed": 145,
    "creditsUsed": 1,
    "timestamp": "2024-06-03T10:00:30Z"
  },
  "conversationUpdated": {
    "sentiment": 0.6,
    "shouldEscalate": false
  }
}
```

---

## 💳 CREDITS - Créditos

### GET /api/credits
Saldo de créditos do tenant

**Response:** 200
```json
{
  "totalCredits": 10000,
  "usedCredits": 3456,
  "availableCredits": 6544,
  "plan": "starter",
  "resetDate": "2024-07-03T00:00:00Z",
  "allocation": {
    "agent_123": { "allocated": 5000, "used": 2000 },
    "agent_456": { "allocated": 5000, "used": 1456 }
  }
}
```

---

### POST /api/credits/add
Comprar créditos avulso

**Request:**
```json
{
  "amount": 5000,  // 5000 créditos
  "plan": "5k_credits"  // ou 10k_credits, 25k_credits
}
```

**Response:** 200
```json
{
  "stripeSessionUrl": "https://checkout.stripe.com/pay/...",
  "creditPackage": {
    "credits": 5000,
    "price": 3.90
  }
}
```

---

## 📊 ANALYTICS - Analytics

### GET /api/analytics
Analytics geral do tenant

**Query Params:**
- `agentId`: (opcional) filtro por agente
- `period`: day, week, month, year
- `from`: data início (ISO 8601)
- `to`: data fim (ISO 8601)

**Response:** 200
```json
{
  "period": {
    "from": "2024-05-03T00:00:00Z",
    "to": "2024-06-03T23:59:59Z"
  },
  "conversations": {
    "total": 245,
    "perDay": [50, 45, 38, 42, ...],
    "avgPerDay": 41.5
  },
  "messages": {
    "total": 1234,
    "avgPerConversation": 5.0
  },
  "sentiment": {
    "average": 0.62,
    "distribution": {
      "veryPositive": "12%",
      "positive": "35%",
      "neutral": "28%",
      "frustrated": "18%",
      "angry": "7%"
    }
  },
  "resolution": {
    "rate": 0.87,  // 87%
    "avgTime": "2m 34s",
    "escalations": 18
  },
  "models": {
    "haiku": { "count": 789, "cost": 7.89 },
    "sonnet": { "count": 345, "cost": 17.25 },
    "gpt4o": { "count": 100, "cost": 8.00 }
  },
  "costs": {
    "llmCost": 33.14,
    "infraCost": 2.50,
    "totalCost": 35.64
  }
}
```

---

## ⚙️ SKILLS - Habilidades

### GET /api/skills
Listar skills disponíveis

**Response:** 200
```json
{
  "builtin": [
    {
      "id": "handoff",
      "name": "Handoff com Resumo",
      "description": "Escalar para human com resumo automático",
      "availableIn": "starter",
      "cost": 0
    },
    {
      "id": "humorDetection",
      "name": "Detecção de Humor",
      "description": "Detectar sentimento e escalar automaticamente",
      "availableIn": "pro",
      "cost": 0
    }
  ],
  "addons": [
    {
      "id": "crm_hubspot",
      "name": "Atualização CRM (HubSpot)",
      "description": "Sync automático com HubSpot",
      "cost": 20,
      "costPer": "agente/mês"
    }
  ]
}
```

---

### POST /api/agents/:id/skills
Ativar skill no agente

**Request:**
```json
{
  "skillId": "handoff",
  "config": {
    "escalationLevel": "frustrated"
  }
}
```

**Response:** 200
```json
{
  "id": "agent_123",
  "skills": {
    "handoff": {
      "enabled": true,
      "config": { "escalationLevel": "frustrated" }
    }
  }
}
```

---

## 🔗 WEBHOOKS

### Webhook: conversation.escalated
Quando uma conversa é escalada

**Payload:**
```json
{
  "event": "conversation.escalated",
  "timestamp": "2024-06-03T10:30:00Z",
  "data": {
    "conversationId": "conv_123",
    "agentId": "agent_123",
    "reason": "frustrated_sentiment",
    "summary": "Cliente está irritado com resposta anterior...",
    "visitorName": "João",
    "visitorEmail": "joao@example.com",
    "history": [ ... ]
  }
}
```

---

### Webhook: credits.low
Quando créditos caem abaixo de threshold

**Payload:**
```json
{
  "event": "credits.low",
  "timestamp": "2024-06-03T10:30:00Z",
  "data": {
    "tenantId": "tenant_123",
    "currentCredits": 1200,
    "threshold": 1500,
    "percentageUsed": 80
  }
}
```

---

## Códigos de Erro

| Código | Mensagem | Solução |
|--------|----------|---------|
| 400 | Bad Request | Validar JSON |
| 401 | Unauthorized | Token inválido/expirado |
| 403 | Forbidden | Sem permissão |
| 404 | Not Found | Recurso não existe |
| 429 | Too Many Requests | Rate limit atingido |
| 500 | Server Error | Erro do servidor |

