import Head from 'next/head';
import Link from 'next/link';
import Logo from '../components/Logo';

export default function DataDeletion() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-12 px-4">
      <Head>
        <title>Instruções de Eliminação de Dados — Agentfy</title>
        <meta name="description" content="Como solicitar a eliminação dos seus dados pessoais da plataforma Agentfy, em conformidade com o RGPD e os requisitos da Meta." />
      </Head>

      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <Link href="/" className="inline-flex justify-center mb-6">
            <Logo size={40} />
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Eliminação de Dados</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Instruções para pedido de apagamento de dados pessoais</p>
        </div>

        {/* Content */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-8 space-y-8 text-gray-700 dark:text-gray-300 text-sm leading-relaxed">

          <section className="bg-blue-50 dark:bg-blue-900/20 border border-blue-200 dark:border-blue-800 rounded-xl p-4">
            <p className="text-blue-800 dark:text-blue-300 font-medium">
              Em conformidade com o Art. 17.º do RGPD («direito a ser esquecido») e com os requisitos da
              Meta Platforms (para integrações via WhatsApp Business API / Facebook Login), pode solicitar
              o apagamento de todos os seus dados pessoais da plataforma Agentfy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-4">Como solicitar a eliminação dos seus dados</h2>
            <p className="mb-4">Tem <strong>três formas</strong> de submeter o seu pedido:</p>

            {/* Option 1 */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-4">
              <div className="flex items-center gap-3 mb-3">
                <span className="w-8 h-8 bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-400 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">1</span>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Através da sua conta (método mais rápido)</h3>
              </div>
              <ol className="list-decimal list-inside space-y-1 text-gray-600 dark:text-gray-400 ml-2">
                <li>Inicie sessão em <a href="https://agentfy.tech" className="text-brand-600 hover:underline dark:text-brand-400">agentfy.tech</a></li>
                <li>Aceda a <strong>Perfil → Configurações de conta</strong></li>
                <li>Clique em <strong>«Eliminar conta e dados»</strong></li>
                <li>Confirme o pedido introduzindo a sua palavra-passe</li>
              </ol>
            </div>

            {/* Option 2 */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4 mb-4">
              <div className="flex items-center gap-3 mb-3">
                <span className="w-8 h-8 bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-400 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">2</span>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Por email</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-2">
                Envie um email para{' '}
                <a href="mailto:privacy@agentfy.tech?subject=Pedido%20de%20Elimina%C3%A7%C3%A3o%20de%20Dados" className="text-brand-600 hover:underline dark:text-brand-400">
                  privacy@agentfy.tech
                </a>{' '}
                com o assunto <strong>«Pedido de Eliminação de Dados»</strong> incluindo:
              </p>
              <ul className="list-disc list-inside space-y-1 text-gray-600 dark:text-gray-400 ml-2">
                <li>O seu nome completo</li>
                <li>O endereço de email associado à conta</li>
                <li>Identificação dos dados específicos que pretende eliminar (ou «todos os dados»)</li>
              </ul>
            </div>

            {/* Option 3 */}
            <div className="border border-gray-200 dark:border-gray-700 rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <span className="w-8 h-8 bg-brand-100 dark:bg-brand-900/40 text-brand-700 dark:text-brand-400 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">3</span>
                <h3 className="font-semibold text-gray-900 dark:text-gray-100">Para utilizadores que acederam via integração Meta (WhatsApp / Facebook)</h3>
              </div>
              <p className="text-gray-600 dark:text-gray-400 mb-2">
                Se interagiu com um agente Agentfy através do WhatsApp ou outra plataforma Meta e pretende que os
                dados dessa interação sejam eliminados:
              </p>
              <ol className="list-decimal list-inside space-y-1 text-gray-600 dark:text-gray-400 ml-2">
                <li>Envie o seu pedido para{' '}
                  <a href="mailto:privacy@agentfy.tech?subject=Pedido%20RGPD%20-%20Dados%20WhatsApp" className="text-brand-600 hover:underline dark:text-brand-400">
                    privacy@agentfy.tech
                  </a>
                </li>
                <li>Indique o número de telefone WhatsApp ou o identificador utilizado</li>
                <li>Indique o nome do agente / empresa com quem interagiu (se souber)</li>
              </ol>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">O que acontece após o pedido</h2>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">✓</span>
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">Confirmação imediata</p>
                  <p className="text-gray-500 dark:text-gray-400">Receberá um email de confirmação do pedido no prazo de 48 horas</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">✓</span>
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">Apagamento no prazo de 30 dias</p>
                  <p className="text-gray-500 dark:text-gray-400">Todos os dados pessoais identificados serão eliminados dos nossos sistemas ativos no prazo máximo de 30 dias, em conformidade com o Art. 17.º do RGPD</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">✓</span>
                <div>
                  <p className="font-medium text-gray-900 dark:text-gray-100">Notificação de conclusão</p>
                  <p className="text-gray-500 dark:text-gray-400">Será notificado por email quando o processo de eliminação estiver concluído, com indicação do que foi apagado</p>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Dados que podem ser retidos por obrigação legal</h2>
            <p className="mb-2">
              Nos termos da legislação europeia e portuguesa, alguns dados podem ser retidos mesmo após o pedido de eliminação:
            </p>
            <ul className="space-y-1 list-disc list-inside text-gray-600 dark:text-gray-400">
              <li><strong>Dados de faturação e registos contabilísticos:</strong> 10 anos (Art. 52.º do Código do IRC)</li>
              <li><strong>Dados necessários para defesa de direitos em litígios pendentes</strong></li>
              <li><strong>Dados exigidos por autoridades reguladoras ou judiciais</strong></li>
            </ul>
            <p className="mt-2 text-gray-500 dark:text-gray-400 text-xs">
              Nestes casos, os dados são isolados e utilizados exclusivamente para o fim legal específico.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">Reclamações</h2>
            <p>
              Se não estiver satisfeito com a forma como tratamos o seu pedido, tem o direito de apresentar
              reclamação à autoridade supervisora competente:
            </p>
            <div className="mt-3 bg-gray-50 dark:bg-gray-800 rounded-lg p-4">
              <p className="font-medium text-gray-900 dark:text-gray-100">Comissão Nacional de Proteção de Dados (CNPD)</p>
              <p className="text-gray-600 dark:text-gray-400">
                Website:{' '}
                <a href="https://www.cnpd.pt" target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline dark:text-brand-400">
                  www.cnpd.pt
                </a>
              </p>
              <p className="text-gray-600 dark:text-gray-400">Email: <a href="mailto:geral@cnpd.pt" className="text-brand-600 hover:underline dark:text-brand-400">geral@cnpd.pt</a></p>
            </div>
          </section>

          <section className="border-t border-gray-200 dark:border-gray-700 pt-6">
            <p className="text-xs text-gray-500 dark:text-gray-400">
              <strong>Contacto de Privacidade:</strong>{' '}
              <a href="mailto:privacy@agentfy.tech" className="text-brand-600 hover:underline dark:text-brand-400">privacy@agentfy.tech</a>
              {' '}· ShakLabs, Lda. · Portugal
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-gray-400 dark:text-gray-600 space-x-4">
          <Link href="/" className="hover:text-gray-600 dark:hover:text-gray-400">← Voltar à aplicação</Link>
          <span>·</span>
          <Link href="/privacy-policy" className="hover:text-gray-600 dark:hover:text-gray-400">Política de Privacidade</Link>
          <span>·</span>
          <Link href="/terms-of-service" className="hover:text-gray-600 dark:hover:text-gray-400">Termos de Serviço</Link>
        </div>
      </div>
    </div>
  );
}
