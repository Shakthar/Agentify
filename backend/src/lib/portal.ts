/**
 * Devolve a URL base do portal para um tenant.
 * Prioridade: tenant.domain (white-label) → FRONTEND_URL env → default plataforma.
 */
import prisma from './prisma.js';

const PLATFORM_URL = process.env.FRONTEND_URL || 'https://agentify.shaklabs.tech';

export async function getPortalUrl(tenantId: string): Promise<string> {
  try {
    const tenant = await prisma.tenant.findUnique({
      where: { id: tenantId },
      select: { domain: true },
    });
    if (tenant?.domain) return `https://${tenant.domain}`;
  } catch { /* ignore — fallback to default */ }
  return PLATFORM_URL;
}
