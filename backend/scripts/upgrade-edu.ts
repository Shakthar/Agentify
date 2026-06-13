import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
p.tenant.findFirst({ where: { email: 'edu.cmg@gmail.com' } })
  .then(t => {
    if (!t) throw new Error('Tenant não encontrado para edu.cmg@gmail.com');
    console.log('Tenant atual:', t.name, '| plano:', t.plan);
    return p.tenant.update({ where: { id: t.id }, data: { plan: 'business', creditsTotal: 15000 } });
  })
  .then(t => console.log('✓ Atualizado:', t.name, '| plano:', t.plan, '| credits:', t.creditsTotal))
  .catch(console.error)
  .finally(() => p.$disconnect());
