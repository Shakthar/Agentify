import Link from 'next/link';
import LegalLayout from '../components/landing/LegalLayout';

const TOC = [
    { id: 's1', label: 'Como solicitar a eliminação dos seus dados' },
    { id: 's2', label: 'O que acontece após o pedido' },
    { id: 's3', label: 'Dados que podem ser retidos por obrigação legal' },
    { id: 's4', label: 'Reclamações' },
];

export default function DataDeletion() {
  return (
    <LegalLayout
      title={'Eliminação de dados pessoais: pedido de apagamento | Agentfy'}
      description={'Como pedir a eliminação dos teus dados pessoais na plataforma Agentfy, em conformidade com o RGPD e os requisitos da Meta: passos, prazos e contacto de apoio.'}
      path="/data-deletion"
      h1={'Eliminação de Dados'}
      subtitle={'Instruções para pedido de apagamento de dados pessoais'}
      toc={TOC}
    >
      <div className="space-y-12">


          <section className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-blue-800 font-medium">
              Em conformidade com o Art. 17.º do RGPD («direito a ser esquecido») e com os requisitos da
              Meta Platforms (para integrações via WhatsApp Business API / Facebook Login), pode solicitar
              o apagamento de todos os seus dados pessoais da plataforma Agentfy.
            </p>
          </section>

          <section>
            <h2 id="s1">Como solicitar a eliminação dos seus dados</h2>
            <p className="mb-4">Tem <strong>três formas</strong> de submeter o seu pedido:</p>

            {/* Option 1 */}
            <div className="border border-line rounded-xl p-4 mb-4">
              <div className="flex items-center gap-3 mb-3">
                <span className="w-8 h-8 bg-brand-100 text-brand-700 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">1</span>
                <h3 className="font-semibold text-ink">Através da sua conta (método mais rápido)</h3>
              </div>
              <ol className="list-decimal list-inside space-y-1 text-ink-soft ml-2">
                <li>Inicie sessão em <a href="https://agentfy.shaklabs.tech" className="text-brand-600 hover:underline">agentfy.shaklabs.tech</a></li>
                <li>Aceda a <strong>Perfil → Configurações de conta</strong></li>
                <li>Clique em <strong>«Eliminar conta e dados»</strong></li>
                <li>Confirme o pedido introduzindo a sua palavra-passe</li>
              </ol>
            </div>

            {/* Option 2 */}
            <div className="border border-line rounded-xl p-4 mb-4">
              <div className="flex items-center gap-3 mb-3">
                <span className="w-8 h-8 bg-brand-100 text-brand-700 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">2</span>
                <h3 className="font-semibold text-ink">Por email</h3>
              </div>
              <p className="text-ink-soft mb-2">
                Envie um email para{' '}
                <a href="mailto:contact@solutions.shaklabs.tech?subject=Pedido%20de%20Elimina%C3%A7%C3%A3o%20de%20Dados" className="text-brand-600 hover:underline">
                  contact@solutions.shaklabs.tech
                </a>{' '}
                com o assunto <strong>«Pedido de Eliminação de Dados»</strong> incluindo:
              </p>
              <ul className="list-disc list-inside space-y-1 text-ink-soft ml-2">
                <li>O seu nome completo</li>
                <li>O endereço de email associado à conta</li>
                <li>Identificação dos dados específicos que pretende eliminar (ou «todos os dados»)</li>
              </ul>
            </div>

            {/* Option 3 */}
            <div className="border border-line rounded-xl p-4">
              <div className="flex items-center gap-3 mb-3">
                <span className="w-8 h-8 bg-brand-100 text-brand-700 rounded-full flex items-center justify-center font-bold text-sm flex-shrink-0">3</span>
                <h3 className="font-semibold text-ink">Para utilizadores que acederam via integração Meta (WhatsApp / Facebook)</h3>
              </div>
              <p className="text-ink-soft mb-2">
                Se interagiu com um agente Agentfy através do WhatsApp ou outra plataforma Meta e pretende que os
                dados dessa interação sejam eliminados:
              </p>
              <ol className="list-decimal list-inside space-y-1 text-ink-soft ml-2">
                <li>Envie o seu pedido para{' '}
                  <a href="mailto:contact@solutions.shaklabs.tech?subject=Pedido%20RGPD%20-%20Dados%20WhatsApp" className="text-brand-600 hover:underline">
                    contact@solutions.shaklabs.tech
                  </a>
                </li>
                <li>Indique o número de telefone WhatsApp ou o identificador utilizado</li>
                <li>Indique o nome do agente / empresa com quem interagiu (se souber)</li>
              </ol>
            </div>
          </section>

          <section>
            <h2 id="s2">O que acontece após o pedido</h2>
            <div className="space-y-3">
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">✓</span>
                <div>
                  <p className="font-medium text-ink">Confirmação imediata</p>
                  <p className="text-ink-soft">Receberá um email de confirmação do pedido no prazo de 48 horas</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">✓</span>
                <div>
                  <p className="font-medium text-ink">Apagamento no prazo de 30 dias</p>
                  <p className="text-ink-soft">Todos os dados pessoais identificados serão eliminados dos nossos sistemas ativos no prazo máximo de 30 dias, em conformidade com o Art. 17.º do RGPD</p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <span className="w-6 h-6 bg-green-100 text-green-700 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 mt-0.5">✓</span>
                <div>
                  <p className="font-medium text-ink">Notificação de conclusão</p>
                  <p className="text-ink-soft">Será notificado por email quando o processo de eliminação estiver concluído, com indicação do que foi apagado</p>
                </div>
              </div>
            </div>
          </section>

          <section>
            <h2 id="s3">Dados que podem ser retidos por obrigação legal</h2>
            <p className="mb-2">
              Nos termos da legislação europeia e portuguesa, alguns dados podem ser retidos mesmo após o pedido de eliminação:
            </p>
            <ul className="space-y-1 list-disc list-inside text-ink-soft">
              <li><strong>Dados de faturação e registos contabilísticos:</strong> 10 anos (Art. 52.º do Código do IRC)</li>
              <li><strong>Dados necessários para defesa de direitos em litígios pendentes</strong></li>
              <li><strong>Dados exigidos por autoridades reguladoras ou judiciais</strong></li>
            </ul>
            <p className="mt-2 text-ink-soft text-xs">
              Nestes casos, os dados são isolados e utilizados exclusivamente para o fim legal específico.
            </p>
          </section>

          <section>
            <h2 id="s4">Reclamações</h2>
            <p>
              Se não estiver satisfeito com a forma como tratamos o seu pedido, tem o direito de apresentar
              reclamação à autoridade supervisora competente:
            </p>
            <div className="mt-3 bg-mist rounded-lg p-4">
              <p className="font-medium text-ink">Comissão Nacional de Proteção de Dados (CNPD)</p>
              <p className="text-ink-soft">
                Website:{' '}
                <a href="https://www.cnpd.pt" target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline">
                  www.cnpd.pt
                </a>
              </p>
              <p className="text-ink-soft">Email: <a href="mailto:geral@cnpd.pt" className="text-brand-600 hover:underline">geral@cnpd.pt</a></p>
            </div>
          </section>

          <section className="border-t border-line pt-6">
            <p className="text-xs text-ink-soft">
              <strong>Contacto de Privacidade:</strong>{' '}
              <a href="mailto:contact@solutions.shaklabs.tech" className="text-brand-600 hover:underline">contact@solutions.shaklabs.tech</a>
              {' '}· ShakLabs, Lda. · Portugal
            </p>
          </section>
        
      </div>
    </LegalLayout>
  );
}
