import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
const p = new PrismaClient();
p.tenant.findFirst({
  where: { email: 'edu.cmg@gmail.com' },
  select: { vatNumber: true, phone: true, addressCity: true, plan: true }
}).then(t => console.log(JSON.stringify(t)))
  .catch(e => console.error('Error:', e.message))
  .finally(() => p.$disconnect());
