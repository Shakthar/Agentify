import 'dotenv/config';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  // Check if expenses already seeded
  const existing = await prisma.platformExpense.count();
  if (existing > 0) {
    console.log(`Platform expenses already seeded (${existing} records). Skipping.`);
    return;
  }

  const expenses = [
    {
      category: 'hosting',
      description: 'Railway (backend API)',
      amount: 20,
      recurring: true,
      period: 'monthly',
    },
    {
      category: 'hosting',
      description: 'Supabase Pro (database)',
      amount: 25,
      recurring: true,
      period: 'monthly',
    },
    {
      category: 'hosting',
      description: 'Vercel Pro (frontend)',
      amount: 20,
      recurring: true,
      period: 'monthly',
    },
    {
      category: 'api',
      description: 'Anthropic API (Claude)',
      amount: 5,
      recurring: true,
      period: 'monthly',
    },
    {
      category: 'api',
      description: 'OpenAI API (GPT)',
      amount: 5,
      recurring: true,
      period: 'monthly',
    },
  ];

  for (const expense of expenses) {
    const created = await prisma.platformExpense.create({ data: expense });
    console.log(`Created: ${created.description} (€${created.amount}/month)`);
  }

  console.log('\nPlatform expenses seeded successfully!');
  console.log('Total monthly baseline: €' + expenses.reduce((s, e) => s + e.amount, 0));
}

main()
  .catch((e) => { console.error(e); process.exit(1); })
  .finally(() => prisma.$disconnect());
