# Plano: A/B Testing de Prompts em Produção

> Estado: **plano de arquitetura apenas — nada disto está implementado**. Documento para orientar uma implementação futura, conforme pedido explicitamente ("organize para fazer" — item inspirado nas *Insights* da Sierra e nas *Experiments* da Decagon).

## 1. Objetivo

Hoje, quando um dono de negócio quer testar duas versões de um `systemPrompt` (ex: tom mais formal vs. mais casual, ou uma skill de vendas com abordagem diferente), a única forma é editar o agente e comparar "a olho" ao longo do tempo — sem grupo de controlo, sem significância estatística, e arriscando piorar a experiência de todos os clientes de uma vez se a nova versão for pior.

O objetivo deste plano é permitir:

1. Correr duas (ou mais) variantes de um agente em simultâneo, cada uma a receber uma fatia do tráfego real.
2. Medir automaticamente as métricas que já existem no produto (taxa de resolução, avaliação do cliente, handoff rate, tempo de resposta, créditos gastos) por variante.
3. Decidir com confiança qual variante "ganhou", com o mínimo de fricção para o dono do negócio.

## 2. Modelo de dados (novo)

Duas entidades novas, adicionadas ao `schema.prisma`:

```
model PromptExperiment {
  id            String   @id @default(cuid())
  tenantId      String
  agentId       String
  name          String
  status        String   @default("draft") // draft | running | paused | completed
  trafficSplit  Json     // { variantId: percentagem }, tem de somar 100
  primaryMetric String   @default("resolution") // resolution | rating | handoff_rate
  startedAt     DateTime?
  endedAt       DateTime?
  createdAt     DateTime @default(now())
  updatedAt     DateTime @updatedAt

  variants      PromptVariant[]
}

model PromptVariant {
  id             String   @id @default(cuid())
  experimentId   String
  label          String   // "Controlo", "Variante B", etc.
  systemPrompt   String   @db.Text
  temperature    Float?
  isControl      Boolean  @default(false)
  createdAt      DateTime @default(now())

  experiment     PromptExperiment @relation(fields: [experimentId], references: [id], onDelete: Cascade)
  assignments    ExperimentAssignment[]
}

// Guarda a atribuição de cada conversa a uma variante — permite reconstruir
// os resultados por variante sem alterar o modelo Conversation em si.
model ExperimentAssignment {
  id             String   @id @default(cuid())
  experimentId   String
  variantId      String
  conversationId String   @unique
  createdAt      DateTime @default(now())

  variant        PromptVariant @relation(fields: [variantId], references: [id], onDelete: Cascade)
}
```

Nota: `ExperimentAssignment` é uma tabela separada em vez de campos na `Conversation` para não sujar o modelo principal com um conceito que só interessa a quem está a testar prompts — e para permitir apagar experiências antigas sem tocar no histórico de conversas.

## 3. Atribuição de variante (assignment)

- **Ponto de decisão**: no início de `sendMessage()`, antes de montar o `systemPrompt`, se o agente tiver uma `PromptExperiment` com `status: 'running'`:
  1. Se a conversa já tem uma `ExperimentAssignment` (mensagens seguintes da mesma conversa), reutiliza a mesma variante — **nunca troca de variante a meio de uma conversa**.
  2. Se é a primeira mensagem da conversa, atribui uma variante por *hashing consistente* do `visitorId` (ou `conversationId` quando não há visitorId) contra o `trafficSplit` — o mesmo visitante cai sempre no mesmo grupo em experiências futuras, o que evita "contaminação" entre variantes.
- O `systemPrompt` usado na chamada ao LLM passa a vir da variante atribuída, não do `agent.systemPrompt` diretamente (o `agent.systemPrompt` continua a ser o "controlo" por omissão sempre que não há experiência ativa).

## 4. Recolha de métricas

Como o produto já mede tudo o que precisamos por conversa (`resolved`, `handedOffToHuman`, `rating`, `creditsUsed`, `tokensUsed` — e, com o trabalho feito nesta ronda, também `needsReview` e a taxa de resolução real), a recolha de métricas por variante **não precisa de nenhuma pipeline nova**: é uma agregação sobre `Conversation` fazendo `JOIN` com `ExperimentAssignment`.

Métrica por variante (calculado on-demand, sem tabela de agregados pré-computados numa primeira fase):

- Nº de conversas atribuídas
- Taxa de resolução (igual à fórmula já implementada em `finalizeConversationClosure`)
- Avaliação média (`AVG(rating)`)
- Taxa de handoff (`% handedOffToHuman = true`)
- Taxa de revisão QA (`% needsReview = true`)
- Créditos médios gastos por conversa

## 5. Significância estatística

Para não deixar o dono do negócio "adivinhar" se a diferença é real ou ruído:

- Usar um teste de proporções (ex: teste Z de duas proporções, ou o intervalo de Wilson) sobre a métrica primária escolhida (`primaryMetric`), comparando cada variante contra o controlo.
- Mostrar sempre o tamanho da amostra e um aviso explícito enquanto `n < 30` por variante ("ainda é cedo para tirar conclusões").
- Não declarar vencedor automaticamente — mostrar o resultado estatístico e deixar a decisão de promover a variante ao dono do negócio (uma automatização de "promover sozinho ao atingir 95% de confiança" pode ser uma fase 2, nunca a primeira).

## 6. Segurança / guardrails

- **Limite de exposição**: por omissão, uma experiência nova nunca deve começar com mais de 50% do tráfego numa variante não-controlo — evita que uma variante pior arruíne a maioria das conversas antes de haver dados.
- **Paragem automática**: se uma variante não-controlo tiver uma taxa de handoff ou `needsReview` significativamente pior que o controlo depois de uma amostra mínima (ex: 20 conversas), pausar automaticamente essa variante e notificar o dono do negócio — o princípio "fail-safe", não "fail-open".
- **Sem experiências em cascata**: só uma `PromptExperiment` pode estar `running` por agente de cada vez, para não complicar a atribuição nem a leitura dos resultados.

## 7. Interface (fase de implementação futura, não coberta em detalhe aqui)

- Nova aba "Experiências" no dashboard do agente (paralela a "Skills"), com:
  - Criar experiência: nome, variantes (cada uma com o seu `systemPrompt`, pode partir de uma cópia do prompt atual), split de tráfego.
  - Ver resultados: tabela comparativa por variante com as métricas da secção 4, e o resultado do teste estatístico da secção 5.
  - Ações: pausar, retomar, terminar e "promover" (copia o `systemPrompt` da variante vencedora para `agent.systemPrompt` e termina a experiência).

## 8. Faseamento sugerido

1. **Fase 1 — fundação**: modelos de dados + lógica de atribuição em `sendMessage()` + endpoint de leitura de resultados (sem UI de criação ainda, criação via seed/admin). Objetivo: validar que a atribuição consistente e a agregação de métricas funcionam com dados reais.
2. **Fase 2 — UI de gestão**: aba "Experiências" completa no dashboard, permitindo criar/pausar/terminar sem intervenção manual na base de dados.
3. **Fase 3 — guardrails automáticos**: paragem automática de variantes más e alertas (reaproveitando o `alertEmail`/`alertHandoffThreshold` que já existem no modelo `Agent`).
4. **Fase 4 (opcional)**: extensão para testar não só `systemPrompt`, mas também `model` e `temperature` como variantes independentes — mede-se ao mesmo tempo qualidade e custo.

## 9. O que este plano deliberadamente NÃO inclui

- Multi-armed bandit (afetação dinâmica de tráfego para a variante que está a ganhar) — poderosa, mas adiciona complexidade estatística que só se justifica com volume de conversas elevado. Fica como possível fase 5.
- Testes de UI/UX do próprio widget de chat — este plano cobre apenas o conteúdo do `systemPrompt`, não o front-end do chat.
