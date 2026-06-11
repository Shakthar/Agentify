import Head from 'next/head';
import Link from 'next/link';
import Logo from '../components/Logo';

export default function TermsOfService() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-12 px-4">
      <Head>
        <title>Termos de Serviço — Agentfy</title>
        <meta name="description" content="Termos e Condições de utilização da plataforma Agentfy." />
      </Head>

      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <Link href="/" className="inline-flex justify-center mb-6">
            <Logo size={40} />
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Termos de Serviço</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Última atualização: 11 de junho de 2025</p>
        </div>

        {/* Content */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-8 space-y-8 text-gray-700 dark:text-gray-300 text-sm leading-relaxed">

          <section>
            <p>
              Bem-vindo à <strong>Agentfy</strong>, uma plataforma SaaS de agentes de inteligência artificial
              desenvolvida e operada pela <strong>ShakLabs, Lda.</strong> («ShakLabs», «nós»), com sede em Portugal.
              Ao criar uma conta ou utilizar os nossos serviços, aceita os presentes Termos de Serviço («Termos»).
              Leia-os atentamente antes de utilizar a plataforma.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">1. Definições</h2>
            <ul className="space-y-2 list-disc list-inside">
              <li><strong>«Plataforma»</strong> — o software e serviços Agentfy disponíveis em agentfy.tech</li>
              <li><strong>«Utilizador» / «Cliente»</strong> — a empresa ou profissional que contrata o serviço</li>
              <li><strong>«Utilizador Final»</strong> — as pessoas que interagem com os agentes IA configurados pelo Cliente</li>
              <li><strong>«Agente IA»</strong> — assistente automatizado criado e configurado pelo Cliente na Plataforma</li>
              <li><strong>«Créditos»</strong> — unidades de consumo debitadas por cada interação com modelos de linguagem</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">2. Descrição do Serviço</h2>
            <p className="mb-3">
              A Agentfy é uma plataforma SaaS que permite às empresas criar, configurar e gerir agentes de IA,
              integrar bases de conhecimento, e implementar esses agentes em múltiplos canais (web, WhatsApp, entre outros).
            </p>
            <p>
              O serviço é prestado em regime de «software as a service» (SaaS) mediante subscrição de plano mensal ou
              aquisição de créditos. O acesso está condicionado ao pagamento em dia.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">3. Elegibilidade e Registo</h2>
            <ul className="space-y-1 list-disc list-inside">
              <li>Deve ter pelo menos 18 anos e capacidade legal para celebrar contratos</li>
              <li>As informações fornecidas no registo devem ser verdadeiras, precisas e atualizadas</li>
              <li>Cada conta é pessoal e intransmissível sem consentimento escrito da ShakLabs</li>
              <li>É responsável por todas as atividades realizadas na sua conta</li>
              <li>Deve notificar-nos imediatamente de qualquer acesso não autorizado em <a href="mailto:support@agentfy.tech" className="text-brand-600 hover:underline dark:text-brand-400">support@agentfy.tech</a></li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">4. Planos, Créditos e Faturação</h2>
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">4.1 Planos de Subscrição</h3>
            <p className="mb-3">
              Os planos disponíveis, preços e respetivos limites são descritos na página de Planos da Plataforma.
              Os preços incluem IVA à taxa legal aplicável, quando devida.
            </p>
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">4.2 Créditos</h3>
            <p className="mb-3">
              Cada interação com modelos de linguagem consome créditos. Os créditos não utilizados no mês de subscrição
              não transitam para o período seguinte, salvo indicação expressa no plano contratado.
            </p>
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">4.3 Pagamentos</h3>
            <p className="mb-3">
              Os pagamentos são processados via MB Way (Ifthenpay). O serviço pode ser suspenso caso o pagamento
              não seja processado no prazo definido.
            </p>
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">4.4 Direito de Rescisão (UE)</h3>
            <p>
              Nos termos da Diretiva (UE) 2019/2161 e do Decreto-Lei n.º 84/2021, os consumidores têm direito
              a resolver o contrato no prazo de 14 dias a contar da data de subscrição, sem necessidade de indicar
              o motivo. Para planos empresariais (B2B), este direito não se aplica na medida em que o serviço
              tenha sido prestado com o seu consentimento expresso.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">5. Uso Aceitável</h2>
            <p className="mb-3">Compromete-se a não utilizar a Plataforma para:</p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Atividades ilegais ou fraudulentas</li>
              <li>Gerar ou disseminar conteúdo ilegal, ofensivo, discriminatório ou que infrinja direitos de terceiros</li>
              <li>Enviar spam, conteúdo de phishing ou comunicações não solicitadas em massa</li>
              <li>Tentar aceder ou danificar sistemas informáticos de terceiros</li>
              <li>Manipular ou enganar utilizadores finais de forma prejudicial</li>
              <li>Violar os Termos de Serviço da Meta Platforms para utilização da WhatsApp Business API</li>
              <li>Infringir direitos de propriedade intelectual de terceiros</li>
              <li>Processar categorias especiais de dados (dados de saúde, dados biométricos, etc.) sem medidas adicionais acordadas por escrito</li>
            </ul>
            <p className="mt-3">
              Reservamo-nos o direito de suspender ou terminar contas que violem estas regras, sem aviso prévio
              em casos de violações graves.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">6. Responsabilidade pela IA e pelo Conteúdo</h2>
            <p className="mb-3">
              Os agentes IA são alimentados por modelos de linguagem de terceiros (OpenAI, Anthropic, Google, entre outros).
              O Cliente é inteiramente responsável por:
            </p>
            <ul className="space-y-1 list-disc list-inside">
              <li>Configurar os agentes de forma adequada e legal</li>
              <li>O conteúdo carregado para as bases de conhecimento</li>
              <li>As respostas geradas pelos agentes perante os seus utilizadores finais</li>
              <li>Garantir que a utilização dos agentes cumpre a regulamentação aplicável ao seu setor</li>
            </ul>
            <p className="mt-3">
              A ShakLabs não é responsável por conteúdos gerados por IA que contenham imprecisões,
              alucinações ou que não correspondam às expetativas do utilizador final.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">7. Propriedade Intelectual</h2>
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">7.1 Propriedade da ShakLabs</h3>
            <p className="mb-3">
              A Plataforma, o seu código, design, marcas e documentação são propriedade exclusiva da ShakLabs
              e protegidos por direitos de autor e outros direitos de propriedade intelectual.
            </p>
            <h3 className="font-medium text-gray-900 dark:text-gray-100 mb-2">7.2 Conteúdo do Cliente</h3>
            <p>
              O Cliente mantém todos os direitos sobre o conteúdo que carrega (documentos, dados, bases de
              conhecimento). Concede à ShakLabs uma licença limitada, não exclusiva e não transferível,
              exclusivamente para prestar o serviço contratado.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">8. Disponibilidade e Suporte</h2>
            <p className="mb-3">
              Comprometemo-nos a manter a Plataforma disponível com um objetivo de <strong>99,5% de uptime mensal</strong>.
              Interrupções programadas para manutenção serão comunicadas com pelo menos 24 horas de antecedência.
              Interrupções não programadas serão comunicadas o mais rapidamente possível.
            </p>
            <p>
              Suporte técnico disponível via email em <a href="mailto:support@agentfy.tech" className="text-brand-600 hover:underline dark:text-brand-400">support@agentfy.tech</a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">9. Limitação de Responsabilidade</h2>
            <p className="mb-3">
              Na máxima extensão permitida pela lei aplicável:
            </p>
            <ul className="space-y-1 list-disc list-inside">
              <li>A ShakLabs não é responsável por danos indiretos, lucros cessantes, perda de dados ou danos reputacionais</li>
              <li>A responsabilidade total da ShakLabs perante o Cliente está limitada ao valor pago nos 3 meses anteriores ao evento que deu origem ao dano</li>
              <li>A Plataforma é fornecida «tal como está» («as is»), sem garantias implícitas de adequação a fins específicos</li>
            </ul>
            <p className="mt-3 text-xs text-gray-500 dark:text-gray-400">
              As limitações acima não se aplicam em casos de dolo, negligência grave ou violação de direitos
              do consumidor protegidos por lei imperativa da União Europeia ou portuguesa.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">10. Rescisão</h2>
            <p className="mb-3">
              <strong>Pelo Cliente:</strong> Pode cancelar a subscrição a qualquer momento a partir das definições da conta.
              O acesso mantém-se até ao fim do período pago.
            </p>
            <p>
              <strong>Pela ShakLabs:</strong> Podemos suspender ou terminar a conta por violação dos presentes Termos,
              por falta de pagamento ou por imposição legal, com notificação prévia salvo em casos de violação grave.
              Em caso de rescisão por nossa iniciativa sem justa causa, reembolsaremos os créditos não utilizados
              proporcionalmente.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">11. Proteção de Dados</h2>
            <p>
              O tratamento de dados pessoais é regido pela nossa{' '}
              <Link href="/privacy-policy" className="text-brand-600 hover:underline dark:text-brand-400">Política de Privacidade</Link>,
              que constitui parte integrante dos presentes Termos.
              Para tratamentos de dados em nome do Cliente (na qualidade de subcontratante), as partes celebrarão
              um Acordo de Tratamento de Dados (DPA) nos termos do Art. 28.º do RGPD, mediante pedido.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">12. Alterações aos Termos</h2>
            <p>
              Podemos atualizar estes Termos. Notificaremos os Clientes por email com pelo menos{' '}
              <strong>30 dias de antecedência</strong> sobre alterações materiais. A continuação da utilização da
              Plataforma após essa data constitui aceitação dos novos Termos. Se não concordar com as alterações,
              pode rescindir a subscrição antes da entrada em vigor.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">13. Lei Aplicável e Foro Competente</h2>
            <p>
              Os presentes Termos são regidos pela lei portuguesa e pelo direito da União Europeia.
              Para resolução de litígios, as partes elegem o foro da comarca de Lisboa, sem prejuízo do
              direito dos consumidores de recorrerem ao tribunal da sua residência habitual ou a meios
              alternativos de resolução de litígios (RAL) disponíveis em{' '}
              <a href="https://www.consumidor.gov.pt" target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline dark:text-brand-400">
                consumidor.gov.pt
              </a>.
            </p>
          </section>

          <section className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">14. Contacto</h2>
            <div className="space-y-1 text-gray-600 dark:text-gray-400">
              <p><strong>ShakLabs, Lda.</strong> · Portugal</p>
              <p>Email geral: <a href="mailto:hello@agentfy.tech" className="text-brand-600 hover:underline dark:text-brand-400">hello@agentfy.tech</a></p>
              <p>Suporte: <a href="mailto:support@agentfy.tech" className="text-brand-600 hover:underline dark:text-brand-400">support@agentfy.tech</a></p>
              <p>Privacidade: <a href="mailto:privacy@agentfy.tech" className="text-brand-600 hover:underline dark:text-brand-400">privacy@agentfy.tech</a></p>
            </div>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-gray-400 dark:text-gray-600 space-x-4">
          <Link href="/" className="hover:text-gray-600 dark:hover:text-gray-400">← Voltar à aplicação</Link>
          <span>·</span>
          <Link href="/privacy-policy" className="hover:text-gray-600 dark:hover:text-gray-400">Política de Privacidade</Link>
          <span>·</span>
          <Link href="/data-deletion" className="hover:text-gray-600 dark:hover:text-gray-400">Eliminação de Dados</Link>
        </div>
      </div>
    </div>
  );
}
