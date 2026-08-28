# FAQ — Onboarding Agentify (WhatsApp & Instagram)

## "Quero um agente para atender a minha loja. Tenho um número que já está no WhatsApp. O que faço?"

### ⚠️ Antes de começar — lê isto primeiro

O número que usas no WhatsApp pessoal ou no WhatsApp Business (app) **vai ser desligado da app** quando o ligares à API do Agentify. Não é possível ter o mesmo número no WhatsApp normal E no Agentify ao mesmo tempo.

**Solução se não quiseres perder o número atual no telefone:** usa um número diferente (ex: um número de VoIP, um segundo SIM, ou um número novo) para o Agentify, e mantém o teu número pessoal como está.

---

### Passo a passo completo

**1. Cria a tua conta no Agentify**
Regista-te em [agentfy.shaklabs.tech](https://agentfy.shaklabs.tech) e cria o teu agente.

**2. Vai ao tab WhatsApp do agente**
No painel do agente, clica no tab "📱 WhatsApp".

**3. Clica em "Continuar com Facebook / Meta"**
Um popup da Meta vai abrir. Segue os passos:

- Faz login com a tua conta do Facebook (a mesma que usas para a página da empresa, se tiveres)
- Se não tens conta de Facebook Business Manager, o flow vai criar uma automaticamente
- Cria uma WhatsApp Business Account (WABA) — é gratuito
- Adiciona o teu número de telefone
- Recebe o código de verificação por **SMS ou chamada** e confirma
- Aceita que o número vai sair do WhatsApp app

**4. Configuração automática**
Após completar o flow, o token de acesso é guardado automaticamente no Agentify. O Phone Number ID também é pré-preenchido.

**5. Guarda a configuração**
Confirma os dados e clica em "💾 Guardar configuração WhatsApp".

**6. ⚠️ Adiciona um método de pagamento na Meta (obrigatório até 30 set. 2026)**
A partir de 1 de outubro de 2026, a Meta cobra por cada mensagem enviada pelo agente. Sem método de pagamento registado, a Meta **para de entregar mensagens** nessa data.

- Vai a [business.facebook.com/latest/billing_hub/payment_methods](https://business.facebook.com/latest/billing_hub/payment_methods/)
- Adiciona um cartão de crédito/débito (Visa ou Mastercard) ou pede crédito a prazo à Meta
- Seleciona a tua WhatsApp Business Account (a que criaste no passo 3)

Custo médio por conversa (cliente escreve primeiro): **€0,014/mensagem (Portugal)** ou **€0,006/mensagem (Brasil)** — uma conversa típica de 8 mensagens custa menos de €0,12.

#### Preços por mensagem (Utility) — vigente desde 1 jul. 2026

Fonte: Meta Rate Card EUR, effective July 1, 2026. Todos os valores em **EUR por mensagem**.

**União Europeia**

| País | Utility (€/msg) | Marketing (€/msg) |
|---|---|---|
| Alemanha | €0,0456 | €0,1131 |
| França | €0,0248 | €0,0712 |
| Itália | €0,0248 | €0,0658 |
| Países Baixos | €0,0414 | €0,1323 |
| Espanha | €0,0166 | €0,0585 |
| Polónia | €0,0101 | €0,0303 |
| Roménia | €0,0239 | €0,0712 |
| Hungria | €0,0289 | €0,0712 |
| Portugal, Irlanda, Áustria, Bélgica, Dinamarca, Finlândia, Grécia, Luxemburgo, Malta, Suécia *(Rest of Western Europe)* | €0,0142 | €0,0490 |
| Bulgária, Croácia, Chipre, Rep. Checa, Estónia, Letónia, Lituânia, Eslováquia, Eslovénia *(Rest of Central & Eastern Europe)* | €0,0175 | €0,0712 |

**América do Sul**

| País | Utility (€/msg) | Marketing (€/msg) |
|---|---|---|
| Brasil | €0,0056 | €0,0518 |
| Argentina | €0,0216 | €0,0512 |
| Chile | €0,0166 | €0,0736 |
| Peru | €0,0166 | €0,0582 |
| Colômbia | €0,0008 | €0,0104 |
| Bolívia, Equador, Paraguai, Uruguai, Venezuela, etc. *(Rest of Latin America)* | €0,0094 | €0,0612 |

> **Nota:** "Utility" aplica-se a mensagens iniciadas pelo agente em resposta a uma ação do cliente (ex: confirmação de pedido, marcação de consulta). "Marketing" aplica-se a mensagens promocionais enviadas por iniciativa da empresa. Quando o **cliente escreve primeiro**, as respostas dentro da janela de 24h são cobradas como **service** (€n/a até out. 2026, depois equiparadas a utility). Volume elevado tem descontos de até 25% — ver [tabela de tiers](https://developers.facebook.com/docs/whatsapp/pricing/volume-tiers).

**7. Pronto — o teu agente já responde!**
Envia uma mensagem de teste para o número e verifica que o agente responde.

---

### Perguntas frequentes

**O meu WhatsApp pessoal vai deixar de funcionar?**
Só se usares o mesmo número. Se usares um número diferente para o Agentify, o teu WhatsApp pessoal não é afetado.

**Preciso de uma página do Facebook?**
Não é obrigatório. Precisas apenas de uma conta do Facebook pessoal para autenticar com o Meta Business.

**O que é o WhatsApp Business Account (WABA)?**
É uma conta empresarial do WhatsApp criada pela Meta — gratuita. É ela que permite ligar o número à API.

**Quanto custa enviar mensagens?**
As mensagens em que o **cliente escreve primeiro** são gratuitas até setembro 2026. A partir de outubro 2026, custam cerca de €0,014/mensagem (Portugal) ou $0,007/mensagem (Brasil). Uma conversa típica custa menos de €0,12. Ver preços atualizados em: developers.facebook.com/documentation/business-messaging/whatsapp/pricing

**Quem paga as mensagens à Meta — eu ou o Agentify?**
**Tu (o cliente).** O pagamento é feito diretamente à Meta pela tua WhatsApp Business Account. O Agentify cobra a sua subscrição separadamente. Cada um paga à sua plataforma.

**O meu número precisa de estar verificado?**
Para começar a testar, não. Para enviar para números fora da tua lista de teste, a conta Meta Business precisa de estar verificada (processo de verificação de empresa no Meta Business Manager — pode demorar 1-3 dias úteis).

**O agente pode responder 24/7?**
Sim. O Agentify responde automaticamente a qualquer hora do dia, 7 dias por semana.

**E se precisar de falar com um humano?**
O agente tem suporte a handoff — quando não consegue resolver, transfere a conversa para um agente humano e notifica-te.

**Posso testar antes de ligar o número real?**
Sim. A Meta fornece um número de teste gratuito em Meta for Developers → WhatsApp → API Setup que podes usar para testar antes de usar o teu número real.

---

### Problemas comuns

| Problema | Solução |
|---|---|
| "O número já está associado a uma conta WhatsApp" | O número precisa de ser removido do WhatsApp app primeiro (Definições → Conta → Apagar conta) |
| Não recebo o SMS de verificação | Pede verificação por chamada telefónica em vez de SMS |
| Popup da Meta fecha sem completar | Verifica se o teu browser bloqueia popups — permite para agentfy.shaklabs.tech |
| Token inválido após ligar | Tenta de novo o botão "Continuar com Facebook / Meta" — o token anterior pode ter expirado |
| Conta Meta não verificada — não consigo enviar | Faz a verificação de empresa em business.facebook.com/settings → Informações da empresa |

---

---

# FAQ — Onboarding Instagram no Agentify

## "Quero que o agente responda automaticamente às mensagens diretas e comentários do meu Instagram. O que faço?"

### ⚠️ Antes de começar — requisitos

Para ligar o Instagram ao Agentify precisas de:

- Uma conta **Instagram Business** ou **Creator** (não funciona com conta pessoal)
- Essa conta ligada a uma **Página do Facebook** (obrigatório pela Meta)
- Ser **Administrador** dessa Página do Facebook

Se a tua conta for pessoal: Instagram app → Definições → Conta → Mudar para conta profissional → Empresa.

---

### Passo a passo completo

**1. Liga o Instagram à tua Página do Facebook**
No Instagram: Definições → Conta → Contas vinculadas → Facebook → seleciona a tua Página.
Se não tens Página, cria uma gratuita em [facebook.com/pages/create](https://facebook.com/pages/create).

**2. Vai ao tab Instagram do agente**
Em [agentfy.shaklabs.tech](https://agentfy.shaklabs.tech), abre o teu agente → tab **📸 Instagram**.

**3. Clica em "Continuar com Facebook"**
Um popup abre. Segue os passos:
- Faz login com a tua conta do Facebook
- Seleciona a Página ligada ao teu Instagram Business
- Aceita as permissões de mensagens e comentários

**4. Ligação automática**
Após fechar o popup, o token é guardado automaticamente. O Instagram Account ID é preenchido.
Confirma que o toggle está **Ativo** e clica em **"💾 Guardar configuração Instagram"**.

**5. Configura o Webhook na Meta (uma vez)**
Para receber DMs e comentários, a Meta precisa de saber onde enviar as notificações:
- Vai a [developers.facebook.com](https://developers.facebook.com) → a tua app → Instagram → Webhooks
- Callback URL: `https://agentify-production-8d3a.up.railway.app/api/webhooks/instagram`
- Verify Token: `agentify_instagram_verify_2025`
- Subscreve os campos: `messages` e `comments`

**6. Pronto — o agente já responde!**
Envia uma DM de teste para o teu Instagram Business e verifica que o agente responde automaticamente.

---

### O que o agente faz no Instagram

| Funcionalidade | Descrição |
|---|---|
| **DMs automáticas** | Responde a mensagens diretas dentro de segundos |
| **Comentários automáticos** | Responde a comentários em posts do negócio |
| **Handoff humano** | Quando não consegue resolver, notifica o responsável |
| **Publicação de conteúdo** | Pode publicar posts/imagens quando instruído via chat |
| **Relatórios de insights** | Analisa métricas da conta e gera relatórios de desempenho |

---

### Perguntas frequentes

**Preciso de pagar à Meta para usar o Instagram?**
Não. A API de mensagens do Instagram é **gratuita** — ao contrário do WhatsApp, a Meta não cobra por mensagem no Instagram.

**A minha conta Instagram pessoal vai ser afetada?**
Não. O Agentify só acede à conta Instagram Business/Creator — nunca a contas pessoais.

**O agente responde a todos os comentários?**
Sim, a todos os comentários em posts da conta Business, exceto os enviados pela própria conta (ignora os próprios replies).

**E se o cliente escrever em inglês ou outra língua?**
O agente responde no mesmo idioma da mensagem recebida — adapta-se automaticamente ao idioma do cliente.

**O popup do Facebook fecha sem completar — o que faço?**
Verifica se o browser bloqueia popups para agentfy.shaklabs.tech (permite nas definições do browser).

**Quem paga ao Agentify?**
Tu (o cliente do Agentify). O Instagram não cobra nada à Meta pelo uso da API de DMs.

---

### Problemas comuns

| Problema | Solução |
|---|---|
| Popup fecha sem completar | Permite popups para agentfy.shaklabs.tech no browser |
| "Instagram não ligado à Página" | Liga a conta Instagram à Página do Facebook nas definições do Instagram |
| Não recebo DMs no agente | Verifica se o Webhook está configurado e se o campo `messages` está subscrito |
| Agente não responde a comentários | Verifica se o campo `comments` está subscrito no Webhook |
| Token expirado | Volta ao tab Instagram e clica de novo em "Continuar com Facebook" |
| Conta não é Business | Muda para conta Business/Creator nas definições do Instagram |
