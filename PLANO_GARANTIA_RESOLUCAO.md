# Plano: Garantia de Taxa de Resolução (Plano Enterprise)

> Estado: **plano apenas — nada disto está implementado além da métrica de base**. Documento de handoff para outro membro da equipa continuar a partir daqui. Inspirado no modelo da Tidio (ponto 7 da lista de "steal-worthy features").

## 0. O que já existe hoje (feito nesta ronda anterior)

A parte técnica de base já está pronta e em produção:

- `finalizeConversationClosure()` (em `backend/src/services/conversations.service.ts`) calcula `averageResolution` como uma métrica real: conversas fechadas **sem** handoff para humano, dividido pelo total de conversas fechadas. Antes disto, o campo existia no schema mas nunca era recalculado — estava sempre no valor por omissão.
- Este número já aparece no dashboard do agente (card "Taxa de resolução").
- A avaliação pós-atendimento (1-5 estrelas) e a sinalização automática de QA (`needsReview`/`reviewReason`) também já existem e podem servir de sinais complementares à taxa de resolução pura.

O que falta é tudo o que transforma esta métrica numa **garantia comercial**: os termos, o modelo de dados do compromisso em si, o mecanismo de crédito/reembolso, e a UI para o cliente Enterprise ver o estado da garantia.

## 1. A minha sugestão de termos (para validação de negócio)

Isto é uma proposta de produto, não uma decisão fechada — os números finais (percentagens, valores de crédito, redação legal do contrato) precisam de validação por quem trata de comercial/legal/financeiro na Shaklabs antes de qualquer anúncio público. Não sou advogado nem consultor financeiro; o que se segue é uma sugestão de desenho técnico e de produto para servir de ponto de partida à conversa.

**A. Só para o plano Enterprise, e só depois de um período de baseline.**
Não recomendo comprometer uma percentagem concreta (ex: "garantimos 85% de resolução") sem primeiro medir a taxa real em produção durante 60-90 dias com clientes atuais. O risco de prometer um número otimista e depois ter de pagar crédito a torto e a direito é real. Sugestão de sequência: (1) correr a métrica em modo "silencioso" durante 2-3 meses recolhendo dados reais por agente/setor de negócio, (2) definir o valor da garantia como um percentil conservador da distribuição observada (ex: o valor que 80% dos agentes Enterprise já superam hoje), não um número aspiracional.

**B. Crédito na fatura, nunca reembolso em dinheiro.**
Reembolsar dinheiro tem implicações fiscais/contabilísticas mais pesadas e pode ser lido como produto financeiro. Um crédito percentual na fatura do mês seguinte é o padrão do setor (é o que a Tidio faz) e é mais simples de automatizar e de reverter em caso de disputa.

**C. Amostra mínima antes da garantia se aplicar.**
Ex: mínimo de 100 conversas fechadas no mês. Sem isto, um agente novo ou com pouco tráfego pode cair abaixo do limiar por puro ruído estatístico (3 conversas más em 5 no mês) e gerar créditos injustificados.

**D. Janela de medição mensal, alinhada ao ciclo de faturação.**
Mais simples de comunicar ("este mês ficaste abaixo do combinado, o próximo tem X% de desconto") e mais fácil de reconciliar com o Stripe/sistema de faturação já existente.

**E. Exclusões explícitas no contrato.**
Conversas que o próprio cliente marcou como teste, conversas fora do período de faturação, e possivelmente conversas onde o cliente alterou o `systemPrompt` a meio do mês de forma disruptiva (para não penalizar a Shaklabs por uma mudança do próprio cliente). Isto precisa de redação legal cuidadosa — é o ponto onde mais recomendo revisão de um advogado antes de publicar.

**F. Sem promessa de "100%" nunca.**
Qualquer redação de marketing deve deixar claro que é uma taxa mínima garantida, não uma promessa de perfeição — para gerir expectativas e reduzir risco de reclamação.

## 2. Modelo de dados sugerido (novo, para quem for implementar)

```prisma
model ResolutionGuarantee {
  id                String    @id @default(cuid())
  tenantId          String
  agentId           String
  thresholdPercent  Float     // ex: 0.80 = garante 80%
  minSampleSize     Int       @default(100)
  creditPercent     Float     // ex: 0.15 = 15% de desconto na fatura seguinte
  status            String    @default("active") // active | paused | cancelled
  enrolledAt        DateTime  @default(now())
  createdAt         DateTime  @default(now())
  updatedAt         DateTime  @updatedAt

  tenant            Tenant    @relation(fields: [tenantId], references: [id], onDelete: Cascade)
  agent             Agent     @relation(fields: [agentId], references: [id], onDelete: Cascade)
  evaluations       GuaranteeEvaluation[]
}

// Um registo por mês/agente, calculado pelo job de fecho de ciclo de faturação
model GuaranteeEvaluation {
  id                  String    @id @default(cuid())
  guaranteeId         String
  periodStart         DateTime
  periodEnd           DateTime
  totalClosed         Int
  resolvedWithoutHandoff Int
  actualRate          Float
  metThreshold        Boolean
  creditApplied       Boolean   @default(false)
  creditAmountCents   Int?
  stripeCreditId      String?   // referência ao crédito aplicado no Stripe
  createdAt           DateTime  @default(now())

  guarantee           ResolutionGuarantee @relation(fields: [guaranteeId], references: [id], onDelete: Cascade)
  @@unique([guaranteeId, periodStart])
}
```

## 3. O que falta construir (lista para quem pegar nisto)

1. **Job mensal de avaliação**: um cron/scheduled job que, no fecho do ciclo de faturação de cada tenant Enterprise com `ResolutionGuarantee` ativa, calcula `actualRate` sobre o período (reaproveitando exatamente a mesma fórmula de `finalizeConversationClosure`, mas filtrada por período e por agente), e cria o `GuaranteeEvaluation`.
2. **Aplicação do crédito**: se `metThreshold === false` e `totalClosed >= minSampleSize`, criar um crédito no Stripe (Stripe tem um objeto `Credit Note` / `Customer Balance Transaction` próprio para isto) e guardar a referência.
3. **Notificação**: email automático ao cliente a explicar o que aconteceu (taxa observada vs. garantida, valor do crédito aplicado) — reaproveitar o sistema de emails já existente (o mesmo usado para `alertEmail`).
4. **UI no dashboard**: um card ou aba "Garantia" a mostrar o histórico de avaliações mensais, o valor atual, e se o limiar foi cumprido.
5. **Fluxo de adesão**: como é que um tenant Enterprise ativa isto — automático ao fazer upgrade para Enterprise, ou opt-in manual com um botão "Ativar garantia"? Sugiro opt-in manual pelo menos na fase 1, para não criar compromissos silenciosos.
6. **Painel interno (admin)**: visibilidade agregada de quantos créditos estão a ser emitidos por mês, para a equipa perceber rapidamente se o limiar está calibrado corretamente ou a sair caro demais.

## 4. Faseamento sugerido

1. **Fase 0 (já feita)**: métrica real de `averageResolution` em produção.
2. **Fase 1 — recolha de baseline**: 60-90 dias a observar a métrica real por agente Enterprise, sem qualquer garantia pública, só para calibrar `thresholdPercent` com dados reais.
3. **Fase 2 — modelo de dados + job mensal**: implementar `ResolutionGuarantee`/`GuaranteeEvaluation`, o job de fecho de ciclo, e a integração com o Stripe para o crédito. Sem UI de cliente ainda — ativação manual pela equipa para os primeiros clientes-piloto.
4. **Fase 3 — UI de cliente + opt-in self-service**: card no dashboard, fluxo de ativação, email de notificação.
5. **Fase 4 — lançamento público**: só depois de validado com clientes-piloto durante pelo menos um ciclo de faturação completo, e com os termos finais revistos por quem trata de legal/comercial.

## 5. Nota final

O maior risco aqui não é técnico — é comprometer um número antes de ter dados suficientes para saber se é sustentável. Recomendo fortemente não avançar para a Fase 2 sem primeiro correr a Fase 1 (mesmo que informalmente, só a olhar para o dashboard das contas Enterprise atuais). A parte de redação contratual (secção 1.E) deve mesmo passar por revisão legal antes de qualquer cliente ver a palavra "garantia" em contrato.
