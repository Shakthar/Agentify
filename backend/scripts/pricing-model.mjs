/**
 * Modelo de precificação Agentfy — calcula créditos por plano para uma margem bruta alvo.
 * Uso:  node backend/scripts/pricing-model.mjs
 *
 * CPV (custo dos serviços) considerado, por plano e por mês, no pior caso (cliente usa 100% dos créditos):
 *   1. IA: créditos × custo de 1 crédito (1 crédito = 1.000 tokens Haiku-equivalentes; os multiplicadores
 *      dos outros modelos em TOKEN_COSTS estão alinhados ao custo real, por isso o custo/crédito é ~igual).
 *   2. Taxa de pagamento: % + fixo por cobrança.
 *   3. Infra alocada por conta (servidor, BD, Evolution, storage).
 * Margem bruta = (preço − CPV) / preço. Preços sem IVA.
 */
const TARGET_MARGIN = 0.40;
const USD_EUR = 0.93;   // conservador (encarece custos em USD)
const BRL_PER_EUR = 5.61; // PTAX 14/10/2026
// Haiku 4.5: $1 input / $5 output por milhão. Mix assumido: 85% input / 15% output.
const COST_PER_CREDIT_EUR = ((0.85 * 1 + 0.15 * 5) / 1000) * USD_EUR; // ≈ €0,00149
const PAYMENT_FEE_PCT = 0.025, PAYMENT_FEE_FIXED_EUR = 0.25;
const INFRA_PER_ACCOUNT_EUR = 1.0;

const plans = {
  EUR: { starter: 49, business: 129, enterprise: 349 },
  BRL: { starter: 197, business: 497, enterprise: 1297 },
};

const floor500 = (n) => Math.floor(n / 500) * 500;
console.log(`Custo por crédito: €${COST_PER_CREDIT_EUR.toFixed(5)}  |  margem alvo ${TARGET_MARGIN * 100}%\n`);
for (const [cur, table] of Object.entries(plans)) {
  for (const [plan, price] of Object.entries(table)) {
    const priceEur = cur === 'BRL' ? price / BRL_PER_EUR : price;
    const fixed = priceEur * PAYMENT_FEE_PCT + PAYMENT_FEE_FIXED_EUR + INFRA_PER_ACCOUNT_EUR;
    const budget = priceEur * (1 - TARGET_MARGIN) - fixed;
    const credits = floor500(budget / COST_PER_CREDIT_EUR);
    const cogs = credits * COST_PER_CREDIT_EUR + fixed;
    const margin = (priceEur - cogs) / priceEur;
    const per1k = (price / credits) * 1000;
    console.log(`${cur} ${plan.padEnd(10)} preço ${String(price).padStart(5)}  créditos ${String(credits).padStart(7)}  CPV €${cogs.toFixed(2).padStart(7)}  margem ${(margin * 100).toFixed(1)}%  preço/1k créditos ${per1k.toFixed(2)} ${cur}`);
  }
}

// Pacotes de créditos extra (5.000 créditos)
console.log('\nPacotes extra de 5.000 créditos:');
for (const [cur, price] of [['EUR', 16], ['EUR', 15], ['EUR', 14], ['BRL', 89], ['BRL', 84], ['BRL', 79]]) {
  const priceEur = cur === 'BRL' ? price / BRL_PER_EUR : price;
  const cogs = 5000 * COST_PER_CREDIT_EUR + priceEur * PAYMENT_FEE_PCT + PAYMENT_FEE_FIXED_EUR;
  console.log(`  ${cur} ${price}: margem ${(((priceEur - cogs) / priceEur) * 100).toFixed(1)}%`);
}

// Mensagens WhatsApp Cloud API acima das 1.000 grátis/número/mês (tarifa Meta "service")
console.log('\nCréditos por mensagem WhatsApp (API oficial, acima de 1.000/mês):');
const revenuePerCredit = 49 / 17500; // ≈ receita média por crédito
for (const [pais, custo] of [['BR (R$0,035)', 0.035 / BRL_PER_EUR], ['PT/UE (€0,0142)', 0.0142]]) {
  console.log(`  ${pais}: ${Math.ceil(custo / ((1 - TARGET_MARGIN) * revenuePerCredit))} créditos`);
}
