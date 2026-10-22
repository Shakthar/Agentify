# Agentfy app: regras de layout (out/2026)

Estilo "framed sheet" (skill design-taste-frontend, app-screens). Lê isto antes de mexer numa página da app.

- **Moldura:** todas as páginas de `/dashboard/*` usam `<AppLayout>` (`src/components/app/AppLayout.tsx`). Não renderizar `<Navigation />` nem wrappers `min-h-screen bg-gray-50` nas páginas. `wide` para páginas com tabelas/gráficos largos.
- **Tokens de cor (só estes):** `bg-app-frame` (moldura), `bg-app-sheet` (folha/cartões), `bg-app-raised` (degrau de tom), `border-app-edge` (bordas de painel), `border-app-rule` (linhas de tabela/divisórias), `border-app-control` (controlos), `text-app-ink` (texto principal), `text-app-muted` (secundário), `text-app-faint` (meta), `app-accent`/`app-accent-ink`/`app-accent-soft` (cobalto: só na ação primária, no dado principal e em links), `app-pos`/`app-neg`/`app-warn` (+ `-soft`) para estado. Funcionam em claro e escuro. **Proibido:** `gray-*`, `brand-*`, `green-*`, `red-*`, `yellow-*`, `blue-*`, `dark:` em páginas da app (os tokens já tratam do escuro); gradientes; sombras em repouso; emoji; ícones em quadrados/círculos coloridos; "Olá 👋".
- **Primitivas:** `src/components/app/ui.tsx`: `PageHeader` (h1 substantivo + frase cinza + ações), `Panel`, `KpiStrip` (KPIs como tipo num contentor dividido; nunca cartões com ícone), `Pill` (estado), `Tabs` (sublinhado), `EmptyState`, `Skeleton`, `InlineError`. Classes: `.btn-primary` (uma por ecrã), `.btn-secondary`, `.btn-ghost`, `.input`, `.card`, `.num` (tabular).
- **Tipo:** a escala do Tailwind está a 1,4× (pedido do cliente). h1 = `text-xl font-semibold`; títulos de painel `text-base font-semibold`; corpo `text-sm`; meta `text-xs`. Números com `.num`, alinhados à direita em colunas.
- **Tabelas:** sem zebra, sem faixa no cabeçalho; cabeçalho `text-xs text-app-muted` em sentence case; linhas com `border-t border-app-rule`; identidade com mais largura; uma marca de estado por linha; ação da linha visível só onde é preciso.
- **Estados:** carregar = `Skeleton` no tamanho real; vazio = `EmptyState` com o próximo passo; erro = `InlineError` dentro do bloco, com "Tentar de novo". Zero aparece como 0; em falta = "—".
- **Telemóvel:** a moldura desaparece; tabelas viram linhas de duas linhas; nada de scroll horizontal da página.
- **Movimento:** só feedback (hover, `active:scale-[0.97]` já está nos botões, foco visível). Nada de entradas animadas.
- **Português de Portugal** nas páginas da app (como hoje: "tens/estás" → usar "você"/impessoal neutro é preferível, mas manter o registo existente da página).
- **Não mudar lógica, chamadas à API, rotas ou props.** Só layout, estilo e texto de interface.
