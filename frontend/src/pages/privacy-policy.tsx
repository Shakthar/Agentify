import Head from 'next/head';
import Link from 'next/link';
import Logo from '../components/Logo';

export default function PrivacyPolicy() {
  return (
    <div className="min-h-screen bg-gray-50 dark:bg-gray-950 py-12 px-4">
      <Head>
        <title>Política de Privacidade — Agentfy</title>
        <meta name="description" content="Política de Privacidade da Agentfy, em conformidade com o RGPD (Regulamento Geral sobre a Proteção de Dados)." />
      </Head>

      <div className="max-w-3xl mx-auto">
        {/* Header */}
        <div className="text-center mb-10">
          <Link href="/" className="inline-flex justify-center mb-6">
            <Logo size={40} />
          </Link>
          <h1 className="text-3xl font-bold text-gray-900 dark:text-gray-100">Política de Privacidade</h1>
          <p className="text-sm text-gray-500 dark:text-gray-400 mt-2">Última atualização: 11 de junho de 2025</p>
        </div>

        {/* Content */}
        <div className="bg-white dark:bg-gray-900 rounded-2xl shadow-sm border border-gray-200 dark:border-gray-800 p-8 space-y-8 text-gray-700 dark:text-gray-300 text-sm leading-relaxed">

          <section>
            <p>
              A <strong>ShakLabs, Lda.</strong> («ShakLabs», «nós» ou «nosso»), responsável pela plataforma <strong>Agentfy</strong> disponível em{' '}
              <a href="https://agentfy.tech" className="text-brand-600 hover:underline dark:text-brand-400">agentfy.tech</a>,
              está comprometida em proteger a sua privacidade e os seus dados pessoais, em plena conformidade com o
              Regulamento (UE) 2016/679 (RGPD) e a legislação portuguesa aplicável.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">1. Responsável pelo Tratamento</h2>
            <ul className="space-y-1 list-none">
              <li><strong>Entidade:</strong> ShakLabs, Lda.</li>
              <li><strong>Sede:</strong> Portugal</li>
              <li><strong>Email de Privacidade:</strong>{' '}
                <a href="mailto:privacy@agentfy.tech" className="text-brand-600 hover:underline dark:text-brand-400">privacy@agentfy.tech</a>
              </li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">2. Dados Pessoais Recolhidos</h2>
            <p className="mb-3">Recolhemos os seguintes dados pessoais:</p>
            <div className="overflow-x-auto">
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="bg-gray-50 dark:bg-gray-800">
                    <th className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-left font-semibold">Categoria</th>
                    <th className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-left font-semibold">Dados</th>
                    <th className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-left font-semibold">Finalidade</th>
                    <th className="border border-gray-200 dark:border-gray-700 px-3 py-2 text-left font-semibold">Base Legal (RGPD)</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">Conta</td>
                    <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">Nome, email, empresa, palavra-passe (hash)</td>
                    <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">Autenticação e prestação do serviço</td>
                    <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">Execução de contrato — Art. 6.º, n.º 1, al. b)</td>
                  </tr>
                  <tr className="bg-gray-50 dark:bg-gray-800/50">
                    <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">Faturação</td>
                    <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">Dados de pagamento (MB Way / referências), NIF</td>
                    <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">Processamento de pagamentos e cumprimento fiscal</td>
                    <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">Obrigação legal — Art. 6.º, n.º 1, al. c)</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">Conversas IA</td>
                    <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">Mensagens trocadas com agentes IA</td>
                    <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">Funcionamento dos agentes IA e histórico</td>
                    <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">Execução de contrato — Art. 6.º, n.º 1, al. b)</td>
                  </tr>
                  <tr className="bg-gray-50 dark:bg-gray-800/50">
                    <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">Documentos / Conhecimento</td>
                    <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">Ficheiros carregados para base de conhecimento</td>
                    <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">Treino e operação dos agentes IA</td>
                    <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">Execução de contrato — Art. 6.º, n.º 1, al. b)</td>
                  </tr>
                  <tr>
                    <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">Técnicos</td>
                    <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">Endereço IP, logs de acesso, agente de utilizador</td>
                    <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">Segurança e deteção de fraude</td>
                    <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">Interesse legítimo — Art. 6.º, n.º 1, al. f)</td>
                  </tr>
                  <tr className="bg-gray-50 dark:bg-gray-800/50">
                    <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">WhatsApp / Integrações</td>
                    <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">Número de telefone, mensagens via WhatsApp Business API</td>
                    <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">Comunicação através de integrações configuradas pelo utilizador</td>
                    <td className="border border-gray-200 dark:border-gray-700 px-3 py-2">Execução de contrato — Art. 6.º, n.º 1, al. b)</td>
                  </tr>
                </tbody>
              </table>
            </div>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">3. Subcontratantes e Transferências Internacionais</h2>
            <p className="mb-3">Utilizamos os seguintes subcontratantes para prestar o serviço:</p>
            <ul className="space-y-2 list-disc list-inside">
              <li><strong>Supabase</strong> (PostgreSQL / armazenamento) — UE / EEE</li>
              <li><strong>Railway / Vercel</strong> (alojamento) — EUA; transferência ao abrigo das Cláusulas Contratuais Tipo da UE (SCCs)</li>
              <li><strong>OpenAI / Anthropic / Google</strong> (modelos de linguagem) — EUA; transferência ao abrigo das SCCs</li>
              <li><strong>Meta Platforms</strong> (WhatsApp Business API) — EUA; transferência ao abrigo das SCCs</li>
              <li><strong>Ifthenpay</strong> (processamento de pagamentos) — Portugal / UE</li>
            </ul>
            <p className="mt-3">
              Todas as transferências para países terceiros são efetuadas com as garantias adequadas previstas no Capítulo V do RGPD.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">4. Prazo de Conservação</h2>
            <ul className="space-y-1 list-disc list-inside">
              <li><strong>Dados de conta:</strong> enquanto a conta estiver ativa + 30 dias após eliminação</li>
              <li><strong>Dados de faturação e faturas:</strong> 10 anos (obrigação legal fiscal — Art. 52.º do Código do IRC)</li>
              <li><strong>Conversas e documentos:</strong> enquanto a conta estiver ativa; eliminados no prazo de 30 dias após pedido de eliminação</li>
              <li><strong>Logs técnicos:</strong> 90 dias</li>
            </ul>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">5. Os Seus Direitos (RGPD, Arts. 15.º–22.º)</h2>
            <p className="mb-3">Tem os seguintes direitos em relação aos seus dados pessoais:</p>
            <ul className="space-y-2 list-disc list-inside">
              <li><strong>Direito de acesso</strong> — obter confirmação e cópia dos dados tratados</li>
              <li><strong>Direito de retificação</strong> — corrigir dados inexatos ou incompletos</li>
              <li><strong>Direito ao apagamento («direito a ser esquecido»)</strong> — solicitar a eliminação dos seus dados</li>
              <li><strong>Direito à limitação do tratamento</strong> — suspender temporariamente o tratamento</li>
              <li><strong>Direito à portabilidade</strong> — receber os dados num formato estruturado e legível por máquina</li>
              <li><strong>Direito de oposição</strong> — opor-se ao tratamento baseado em interesse legítimo</li>
              <li><strong>Direito de não sujeição a decisões automatizadas</strong> — não ser sujeito a decisões exclusivamente automatizadas com efeitos significativos</li>
            </ul>
            <p className="mt-3">
              Para exercer os seus direitos, contacte-nos em{' '}
              <a href="mailto:privacy@agentfy.tech" className="text-brand-600 hover:underline dark:text-brand-400">privacy@agentfy.tech</a>.
              Responderemos no prazo de <strong>30 dias</strong>. Tem ainda o direito de apresentar reclamação à{' '}
              <strong>Comissão Nacional de Proteção de Dados (CNPD)</strong> em{' '}
              <a href="https://www.cnpd.pt" target="_blank" rel="noopener noreferrer" className="text-brand-600 hover:underline dark:text-brand-400">www.cnpd.pt</a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">6. Segurança dos Dados</h2>
            <p>
              Implementamos medidas de segurança técnicas e organizativas adequadas, incluindo: encriptação AES-256-GCM
              para dados sensíveis, hash bcrypt (fator 12) para palavras-passe, TLS em todas as comunicações,
              autenticação de dois fatores (TOTP) disponível e controlo de acesso baseado em funções.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">7. Cookies e Tecnologias Similares</h2>
            <p>
              Utilizamos apenas cookies estritamente necessários para o funcionamento da plataforma (sessão de autenticação).
              Não utilizamos cookies de rastreamento ou publicidade. Não é necessário banner de consentimento de cookies
              para estes cookies essenciais, nos termos do Art. 5.º, n.º 3, da Diretiva ePrivacy.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">8. Dados de Menores</h2>
            <p>
              A Agentfy é uma plataforma B2B destinada a empresas e profissionais. Não recolhemos intencionalmente
              dados de menores de 16 anos. Se tomar conhecimento de que um menor nos forneceu dados pessoais,
              contacte-nos imediatamente em{' '}
              <a href="mailto:privacy@agentfy.tech" className="text-brand-600 hover:underline dark:text-brand-400">privacy@agentfy.tech</a>.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">9. Alterações a Esta Política</h2>
            <p>
              Podemos atualizar esta política periodicamente. Quando o fizermos, atualizamos a data no topo deste documento
              e, em caso de alterações materiais, notificamos os utilizadores por email com pelo menos 30 dias de antecedência.
            </p>
          </section>

          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mb-3">10. Contacto</h2>
            <p>
              Para qualquer questão relacionada com privacidade ou proteção de dados:{' '}
              <a href="mailto:privacy@agentfy.tech" className="text-brand-600 hover:underline dark:text-brand-400">privacy@agentfy.tech</a>
            </p>
          </section>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-gray-400 dark:text-gray-600 space-x-4">
          <Link href="/" className="hover:text-gray-600 dark:hover:text-gray-400">← Voltar à aplicação</Link>
          <span>·</span>
          <Link href="/terms-of-service" className="hover:text-gray-600 dark:hover:text-gray-400">Termos de Serviço</Link>
          <span>·</span>
          <Link href="/data-deletion" className="hover:text-gray-600 dark:hover:text-gray-400">Eliminação de Dados</Link>
        </div>
      </div>
    </div>
  );
}
