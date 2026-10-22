-- Migration: analytics do site público (PageView). Idempotente.
-- Também aplicada no arranque por src/lib/schemaGuard.ts.
CREATE TABLE IF NOT EXISTS "PageView" (
  "id" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "path" VARCHAR(300) NOT NULL,
  "referrerHost" TEXT,
  "utmSource" TEXT,
  "utmMedium" TEXT,
  "utmCampaign" TEXT,
  "locale" TEXT,
  "country" VARCHAR(2),
  "device" TEXT NOT NULL,
  "visitorHash" TEXT NOT NULL,
  "isBot" BOOLEAN NOT NULL DEFAULT false,
  CONSTRAINT "PageView_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "PageView_createdAt_idx" ON "PageView"("createdAt");
CREATE INDEX IF NOT EXISTS "PageView_path_idx" ON "PageView"("path");
