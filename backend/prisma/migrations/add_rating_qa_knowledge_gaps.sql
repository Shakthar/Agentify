-- Migration: avaliação pós-atendimento automática (awaitingRating), QA automático de
-- conversas (needsReview/reviewReason), resumo de handoff persistido (handoffSummary),
-- e deteção de lacunas na base de conhecimento (tabela KnowledgeGap).
-- Run this on Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)

ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "awaitingRating" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "needsReview" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "reviewReason" TEXT;
ALTER TABLE "Conversation" ADD COLUMN IF NOT EXISTS "handoffSummary" TEXT;

CREATE TABLE IF NOT EXISTS "KnowledgeGap" (
  "id"             TEXT NOT NULL,
  "tenantId"       TEXT NOT NULL,
  "agentId"        TEXT NOT NULL,
  "conversationId" TEXT,
  "question"       TEXT NOT NULL,
  "occurrences"    INTEGER NOT NULL DEFAULT 1,
  "status"         TEXT NOT NULL DEFAULT 'open',
  "createdAt"      TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  "updatedAt"      TIMESTAMP(3) NOT NULL DEFAULT NOW(),
  CONSTRAINT "KnowledgeGap_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "KnowledgeGap_tenantId_idx" ON "KnowledgeGap"("tenantId");
CREATE INDEX IF NOT EXISTS "KnowledgeGap_agentId_idx" ON "KnowledgeGap"("agentId");

ALTER TABLE "KnowledgeGap"
  ADD CONSTRAINT "KnowledgeGap_tenantId_fkey"
  FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "KnowledgeGap"
  ADD CONSTRAINT "KnowledgeGap_agentId_fkey"
  FOREIGN KEY ("agentId") REFERENCES "Agent"("id") ON DELETE CASCADE ON UPDATE CASCADE;
