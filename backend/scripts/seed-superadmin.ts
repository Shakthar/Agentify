/**
 * Seed script: cria/atualiza o superadmin Eduardo Gonçalves.
 * Usage: npx tsx scripts/seed-superadmin.ts
 */
import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';
import crypto from 'crypto';

const prisma = new PrismaClient();

async function main() {
  const email = 'edu.cmg@gmail.com';
  const name = 'Eduardo Gonçalves';
  const password = 'Agentfy@Admin2026!'; // mudar após primeiro login

  const existing = await prisma.tenant.findUnique({ where: { email } });

  if (existing) {
    await prisma.tenant.update({
      where: { email },
      data: { isAdmin: true, name },
    });
    console.log(`✅ Superadmin atualizado: ${email} (isAdmin=true)`);
  } else {
    const passwordHash = await bcrypt.hash(password, 12);
    const encryptionKey = crypto.randomBytes(32).toString('hex');

    const tenant = await prisma.tenant.create({
      data: {
        name,
        email,
        passwordHash,
        plan: 'enterprise',
        creditsTotal: 999999,
        encryptionKey,
        isAdmin: true,
      },
    });

    await prisma.creditLog.create({
      data: { tenantId: tenant.id, amount: 999999, reason: 'signup-bonus' },
    });

    console.log(`✅ Superadmin criado: ${email}`);
    console.log(`   Password inicial: ${password}`);
    console.log(`   ⚠️  Muda a password após o primeiro login!`);
  }
}

main().catch(console.error).finally(() => prisma.$disconnect());
