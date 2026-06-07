import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
p.tenant.update({
  where: { email: 'edu.cmg@gmail.com' },
  data: { plan: 'starter', creditsTotal: 10000 }
}).then(t => console.log('Updated:', t.email, 'plan=', t.plan, 'credits=', t.creditsTotal))
  .catch(console.error)
  .finally(() => p.$disconnect());
