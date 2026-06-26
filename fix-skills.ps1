$p = (Get-ChildItem 'c:\Dev\Agentify\frontend\src\pages\dashboard\' -Filter '*id*')[0].FullName
$old = [System.IO.File]::ReadAllText($p)
$s = $old.IndexOf('          {/* ⚡ Skills */}')
$e = $old.IndexOf('          {/* Edit */}')
Write-Host "s=$s e=$e"

$skillsBlock = @'
          {/* ⚡ Skills */}
          {activeTab === 'skills' && (() => {
            const plan = tenant.plan as string ?? 'free';
            const planOrder = ['free','starter','pro','business','enterprise'];
            const planIdx = planOrder.indexOf(plan);

            const handleToggleSkill = async (field: string, current: boolean) => {
              setSkillsSaving(true); setSkillsMsg('');
              try {
                const updated = await updateAgent(agent.id, { [field]: !current });
                setAgent(updated);
                setSkillsMsg('Guardado!');
                setTimeout(() => setSkillsMsg(''), 2000);
              } catch { setSkillsMsg('Erro ao guardar.'); }
              finally { setSkillsSaving(false); }
            };

            // Flex-based toggle pill — no absolute positioning, always aligned
            function TogglePill({ active, locked, disabled, onClick, label }: {
              active: boolean; locked: boolean; disabled: boolean; onClick: () => void; label: string;
            }) {
              return (
                <button
                  type="button"
                  disabled={disabled}
                  onClick={onClick}
                  aria-label={label}
                  className={[
                    'shrink-0 w-11 h-6 rounded-full transition-colors duration-200 overflow-hidden flex items-center px-0.5',
                    locked ? 'opacity-40 cursor-not-allowed' : '',
                    active && !locked ? 'bg-brand-600' : 'bg-gray-300 dark:bg-gray-600',
                  ].join(' ')}
                >
                  <span className={[
                    'w-5 h-5 rounded-full bg-white shadow-sm transition-transform duration-200',
                    active && !locked ? 'translate-x-5' : 'translate-x-0',
                  ].join(' ')} />
                </button>
              );
            }

            const SKILLS_DEF = [
              { key: 'skillHandoff',        label: 'Handoff para humano',  icon: '🔀', desc: 'Transfere a conversa para um agente humano com resumo automático.',            minPlan: 'free',    field: 'skillHandoff',        addonPrice: null as string | null },
              { key: 'skillDataCollection', label: 'Recolha de dados',     icon: '📋', desc: 'Recolhe informação estruturada do utilizador (formulários conversacionais).', minPlan: 'free',    field: 'skillDataCollection', addonPrice: null },
              { key: 'skillScheduling',     label: 'Agendamento',          icon: '📅', desc: 'Agenda consultas, reuniões ou serviços automaticamente.',                      minPlan: 'starter', field: 'skillScheduling',     addonPrice: '€7/mês' },
              { key: 'skillFileUpload',     label: 'Envio de ficheiros',   icon: '📁', desc: 'Permite ao agente enviar documentos, catálogos e ficheiros ao utilizador.',    minPlan: 'starter', field: 'skillFileUpload',     addonPrice: '€5/mês' },
              { key: 'skillHumorDetection', label: 'Deteção de humor',     icon: '😊', desc: 'Analisa o sentimento do utilizador e adapta o tom do agente.',                 minPlan: 'pro',     field: 'skillHumorDetection', addonPrice: '€9/mês' },
            ];

            const MB_WAY: Record<string, { monthly: string | null; credits: string | null }> = {
              free:       { monthly: null,         credits: null },
              starter:    { monthly: '+€25/mês',   credits: '50 crd/transação' },
              pro:        { monthly: '+€15/mês',   credits: '35 crd/transação' },
              business:   { monthly: '+€5/mês',    credits: '20 crd/transação' },
              enterprise: { monthly: 'Incluído',   credits: '10 crd/transação' },
            };
            const mbway = MB_WAY[plan] ?? MB_WAY.free;
            const mbwayAvail = mbway.monthly !== null;

            const wlIncl = planIdx >= planOrder.indexOf('business');
            const wlAddon = plan === 'starter' ? '€5/mês' : plan === 'pro' ? '€3/mês' : null;
            const wlAvail = wlIncl || wlAddon !== null;
            const wlActive = agent.whitelabelEnabled;
            const wlUrl = typeof window !== 'undefined' ? `${window.location.origin}/w/${agent.id}` : `/w/${agent.id}`;

            function PlanBadge({ plan: p, label }: { plan: string; label: string }) {
              const cls = p === 'free'     ? 'bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-400'
                : p === 'starter'          ? 'bg-sky-100 dark:bg-sky-900/30 text-sky-700 dark:text-sky-400'
                : p === 'pro'              ? 'bg-purple-100 dark:bg-purple-900/30 text-purple-700 dark:text-purple-400'
                : 'bg-brand-100 dark:bg-brand-900/30 text-brand-700 dark:text-brand-400';
              return <span className={`text-[10px] px-1.5 py-0.5 rounded-full font-medium ${cls}`}>{label}</span>;
            }

            return (
              <div className="space-y-4">
                <div className="card">
                  <div className="mb-4">
                    <h3 className="text-sm font-semibold text-gray-900 dark:text-gray-100">⚡ Skills do agente</h3>
                    <p className="text-xs text-gray-400 mt-0.5">Ativa ou desativa capacidades. Skills com 🔒 requerem upgrade ou addon.</p>
                  </div>
                  {skillsMsg && <p className="text-xs text-green-600 dark:text-green-400 mb-3">{skillsMsg}</p>}
                  <div className="divide-y divide-gray-100 dark:divide-gray-800">

                    {/* Toggleable per-agent skills */}
                    {SKILLS_DEF.map((sk) => {
                      const minIdx = planOrder.indexOf(sk.minPlan);
                      const locked = planIdx < minIdx;
                      const active = !!((agent as unknown as Record<string, unknown>)[sk.field]);
                      return (
                        <div key={sk.key} className="flex items-start gap-3 py-3">
                          <span className="text-lg shrink-0 w-7 text-center mt-0.5">{sk.icon}</span>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center justify-between gap-2 mb-1">
                              <div className="flex items-center gap-1.5 flex-wrap">
                                <span className="text-sm font-medium text-gray-800 dark:text-gray-200">{sk.label}</span>
                                {sk.minPlan === 'free' && <PlanBadge plan="free" label="Grátis" />}
                                {locked && sk.addonPrice && <span className="text-[10px] bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 px-1.5 py-0.5 rounded-full font-medium">Addon {sk.addonPrice}</span>}
                                {locked && !sk.addonPrice && <span className="text-[10px] bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded-full">🔒 {sk.minPlan[0].toUpperCase() + sk.minPlan.slice(1)}+</span>}
                                {!locked && sk.minPlan !== 'free' && <PlanBadge plan={sk.minPlan} label={sk.minPlan[0].toUpperCase() + sk.minPlan.slice(1) + '+'} />}
                                {active && !locked && <span className="text-[10px] text-green-600 dark:text-green-400">● Ativa</span>}
                              </div>
                              <TogglePill active={active} locked={locked} disabled={skillsSaving} onClick={() => handleToggleSkill(sk.field, active)} label={(active ? 'Desativar ' : 'Ativar ') + sk.label} />
                            </div>
                            <p className="text-xs text-gray-500 dark:text-gray-400 leading-snug">{sk.desc}</p>
                            {locked && sk.addonPrice && <button onClick={() => router.push('/dashboard/plans')} className="mt-1 text-[11px] text-orange-600 dark:text-orange-400 hover:underline">Ativar addon {sk.addonPrice} →</button>}
                            {locked && !sk.addonPrice && <button onClick={() => router.push('/dashboard/plans')} className="mt-1 text-[11px] text-brand-600 dark:text-brand-400 hover:underline">Upgrade para {sk.minPlan} →</button>}
                          </div>
                        </div>
                      );
                    })}

                    {/* Pagamentos MB Way */}
                    <div className="flex items-start gap-3 py-3">
                      <span className="text-lg shrink-0 w-7 text-center mt-0.5">💳</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">Pagamentos MB Way</span>
                            {!mbwayAvail && <span className="text-[10px] bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded-full">🔒 Starter+</span>}
                            {mbwayAvail && mbway.monthly !== 'Incluído' && <span className="text-[10px] bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 px-1.5 py-0.5 rounded-full font-medium">{mbway.monthly}</span>}
                            {mbwayAvail && mbway.monthly === 'Incluído' && <PlanBadge plan="enterprise" label="Incluído" />}
                            {mbwayAvail && mbway.credits && <span className="text-[10px] bg-blue-100 dark:bg-blue-900/30 text-blue-700 dark:text-blue-400 px-1.5 py-0.5 rounded-full">{mbway.credits}</span>}
                          </div>
                          <TogglePill active={mbwayAvail} locked={!mbwayAvail} disabled onClick={() => { if (!mbwayAvail) router.push('/dashboard/plans'); }} label="Pagamentos MB Way" />
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 leading-snug">Cobra via MB Way diretamente na conversa. Mensalidade + créditos por transação.</p>
                        {!mbwayAvail && <button onClick={() => router.push('/dashboard/plans')} className="mt-1 text-[11px] text-orange-600 dark:text-orange-400 hover:underline">Ativar no Starter+ →</button>}
                      </div>
                    </div>

                    {/* Pedidos / KDS */}
                    <div className="flex items-start gap-3 py-3">
                      <span className="text-lg shrink-0 w-7 text-center mt-0.5">🧾</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">Pedidos / KDS</span>
                            {!mbwayAvail && <span className="text-[10px] bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded-full">🔒 Starter+</span>}
                            {mbwayAvail && <span className="text-[10px] text-green-600 dark:text-green-400">● Ativo</span>}
                          </div>
                          <TogglePill active={mbwayAvail} locked={!mbwayAvail} disabled onClick={() => { if (mbwayAvail) router.push('/dashboard/orders/live'); }} label="Pedidos KDS" />
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 leading-snug">Painel KDS em tempo real. Requer Pagamentos MB Way ativos.</p>
                        {mbwayAvail && (
                          <div className="flex flex-wrap gap-3 mt-1">
                            <button onClick={() => router.push('/dashboard/orders/live')} className="text-[11px] text-brand-600 dark:text-brand-400 hover:underline">Abrir KDS →</button>
                            <button onClick={() => navigator.clipboard.writeText(`${typeof window !== 'undefined' ? window.location.origin : ''}/orders/${agent.id}`).catch(() => {})} className="text-[11px] text-gray-500 dark:text-gray-400 hover:underline">🔗 Link público</button>
                          </div>
                        )}
                      </div>
                    </div>

                    {/* Portal White-label */}
                    <div className="flex items-start gap-3 py-3">
                      <span className="text-lg shrink-0 w-7 text-center mt-0.5">🎨</span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2 mb-1">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            <span className="text-sm font-medium text-gray-800 dark:text-gray-200">Portal White-label</span>
                            {!wlAvail && <span className="text-[10px] bg-gray-200 dark:bg-gray-700 text-gray-500 dark:text-gray-400 px-1.5 py-0.5 rounded-full">🔒 Starter+</span>}
                            {wlAvail && !wlIncl && wlAddon && <span className="text-[10px] bg-orange-100 dark:bg-orange-900/40 text-orange-700 dark:text-orange-300 px-1.5 py-0.5 rounded-full font-medium">Addon {wlAddon}/agente</span>}
                            {wlIncl && <PlanBadge plan="business" label="Incluído" />}
                            {wlActive && <span className="text-[10px] text-green-600 dark:text-green-400">● Ativa</span>}
                          </div>
                          <TogglePill active={wlActive} locked={!wlAvail} disabled={skillsSaving || !wlAvail} onClick={() => handleToggleSkill('whitelabelEnabled', wlActive)} label={wlActive ? 'Desativar White-label' : 'Ativar White-label'} />
                        </div>
                        <p className="text-xs text-gray-500 dark:text-gray-400 leading-snug">Página pública do agente com a tua marca, sem branding Agentfy.</p>
                        {wlActive && <a href={wlUrl} target="_blank" rel="noopener noreferrer" className="mt-1 inline-block text-[11px] text-brand-600 dark:text-brand-400 hover:underline font-mono">{wlUrl} ↗</a>}
                        {wlAvail && !wlIncl && !wlActive && <button onClick={() => router.push('/dashboard/plans')} className="mt-1 text-[11px] text-orange-600 dark:text-orange-400 hover:underline">Ativar addon por {wlAddon}/agente →</button>}
                        {!wlAvail && <button onClick={() => router.push('/dashboard/plans')} className="mt-1 text-[11px] text-brand-600 dark:text-brand-400 hover:underline">Upgrade para Starter+ →</button>}
                      </div>
                    </div>

                  </div>
                </div>

                {planIdx < planOrder.indexOf('business') && (
                  <div className="card p-4 bg-gradient-to-r from-orange-50 to-amber-50 dark:from-orange-900/20 dark:to-amber-900/20 border border-orange-200 dark:border-orange-800">
                    <p className="text-sm font-semibold text-orange-700 dark:text-orange-300 mb-1">⚡ Addons e upgrades disponíveis</p>
                    <p className="text-xs text-gray-500 dark:text-gray-400 mb-3">Ativa skills individualmente como addons mensais, ou faz upgrade do plano para as incluir todas.</p>
                    <button onClick={() => router.push('/dashboard/plans')} className="btn-primary text-sm">Ver planos e addons →</button>
                  </div>
                )}
              </div>
            );
          })()}

'@

$new = $old.Substring(0, $s) + $skillsBlock + $old.Substring($e)
[System.IO.File]::WriteAllText($p, $new, [System.Text.Encoding]::UTF8)
Write-Host "Done. Old=$($old.Length) New=$($new.Length)"
