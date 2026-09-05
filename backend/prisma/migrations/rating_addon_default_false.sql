-- Migration: "Recolha de Feedback" (avaliacao pos-conversa) passa a ser uma skill
-- do agente (addon pago no Free/Starter, incluida sem custo no Business/Enterprise)
-- em vez de vir ligada por omissao para todos. So muda o DEFAULT para agentes
-- novos - agentes ja existentes mantem o valor atual de ratingEnabled.
-- Run this on Supabase SQL Editor (https://supabase.com/dashboard/project/_/sql)

ALTER TABLE "Agent" ALTER COLUMN "ratingEnabled" SET DEFAULT false;
