# 🔗 CONECTAR GITHUB & SUPABASE - Passo a Passo

## 1️⃣ Preparar o GitHub Localmente

### Clonar o repositório para local:
```bash
git clone https://github.com/Shakthar/Agentify.git
cd Agentify

# Se o repositório está vazio, pode ignorar o erro de ficheiros
```

### Ou se preferir usar a pasta que já temos:
```bash
cd agentfy-complete
git init
git remote add origin https://github.com/Shakthar/Agentify.git
git branch -M main
```

### Verificar configuração do Git:
```bash
git config user.name "Seu Nome"
git config user.email "seu.email@shaklabs.tech"

# Global (para todos os projetos)
git config --global user.name "Seu Nome"
git config --global user.email "seu.email@shaklabs.tech"
```

---

## 2️⃣ Preparar o `.env` com Credenciais do Supabase

### Criar backend/.env:
```bash
cd backend

# Copiar template
cp .env.example .env

# Editar o ficheiro e preencher OBRIGATORIAMENTE:
nano .env
# Ou use um editor qualquer
```

### Preencher com as credenciais do Supabase que me deu:
```env
# Database
DATABASE_URL="postgresql://postgres:TmW@E#.3&MyK,vR@db.xxgciwhibhqwifqtuzta.supabase.co:6543/postgres?pgbouncer=true"
SUPABASE_URL="https://xxgciwhibhqwifqtuzta.supabase.co"
SUPABASE_ANON_KEY="sb_publishable_AO2xIazT9Sztvzsw7Ubgrw_rDflqL8A"
SUPABASE_SERVICE_KEY="[COPIAR DE SUPABASE SETTINGS → API → Service role key]"

# JWT (gerar novos)
JWT_SECRET="[EXECUTAR: openssl rand -base64 32]"
JWT_REFRESH_SECRET="[EXECUTAR: openssl rand -base64 32]"

# Encryption
ENCRYPTION_KEY="[EXECUTAR: node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"]"

# APIs (deixar como está por agora, usar teste depois)
ANTHROPIC_API_KEY="sk-ant-[COLOCAR_SUA_CHAVE]"
OPENAI_API_KEY="sk-[COLOCAR_SUA_CHAVE]"

# Admin (temporário para desenvolvimento)
ADMIN_API_KEY="[GERAR_UMA_CHAVE_ALEATÓRIA]"
ADMIN_EMAIL="seu.email@shaklabs.tech"

# Stripe (deixar vazio por agora)
STRIPE_SECRET_KEY=""
STRIPE_PUBLISHABLE_KEY=""

# Redis (deixar vazio, opcional para dev)
REDIS_URL=""

# Outros
NODE_ENV="development"
PORT="3001"
FRONTEND_URL="http://localhost:3000"
API_URL="http://localhost:3001"
```

### Gerar chaves criptográficas:
```bash
# JWT_SECRET
openssl rand -base64 32

# ENCRYPTION_KEY
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"
```

### Criar frontend/.env.local:
```bash
cd ../frontend
cp .env.local.example .env.local

# Preencher:
NEXT_PUBLIC_API_URL="http://localhost:3001"
NEXT_PUBLIC_SUPABASE_URL="https://xxgciwhibhqwifqtuzta.supabase.co"
NEXT_PUBLIC_SUPABASE_ANON_KEY="sb_publishable_AO2xIazT9Sztvzsw7Ubgrw_rDflqL8A"
```

---

## 3️⃣ Testar Conexão com Supabase

### Verificar se consegue conectar à BD:
```bash
cd backend

# Verificar se psql está instalado
psql --version

# Conectar à BD (com a connection string)
psql "postgresql://postgres:TmW@E#.3&MyK,vR@db.xxgciwhibhqwifqtuzta.supabase.co:5432/postgres"

# Se conectar com sucesso, escrever \q para sair
# Se der erro, pode ser:
# - Firewall bloqueando
# - Credenciais erradas
# - BD não existe
```

### Se não tem psql, pode testar via Node.js:
```bash
# Instalar apenas Prisma
npm install @prisma/client

# Criar ficheiro de teste: test-db.js
cat > test-db.js << 'EOF'
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  try {
    const result = await prisma.$queryRaw`SELECT NOW()`;
    console.log("✅ Conexão bem-sucedida!", result);
  } catch (e) {
    console.log("❌ Erro:", e.message);
  }
  await prisma.$disconnect();
}

main();
EOF

# Rodar
node test-db.js
```

---

## 4️⃣ Deploy da Base de Dados (Schema Prisma)

### Instalar dependências:
```bash
cd backend
npm install
```

### Gerar cliente Prisma:
```bash
npm run prisma:generate
```

### Deploy do schema na BD:
```bash
npm run prisma:push
# Isto cria todas as tabelas no Supabase
```

### Verificar se as tabelas foram criadas:
```bash
# Voltar a conectar
psql "postgresql://postgres:TmW@E#.3&MyK,vR@db.xxgciwhibhqwifqtuzta.supabase.co:5432/postgres"

# Listar tabelas
\dt

# Deve mostrar: users, tenants, agents, conversations, credits, etc.

# Sair
\q
```

---

## 5️⃣ Fazer o Push para GitHub

### Do diretório raiz do projeto:
```bash
cd /caminho/para/agentify

# 1. Verificar estado
git status
# Deve mostrar todos os ficheiros não rastreados

# 2. Adicionar tudo (menos .env!)
git add .
git status
# Verificar se .env NÃO está listado (deve estar no .gitignore)

# 3. Commit inicial
git commit -m "feat: initial commit - MVP Agentfy

- Backend completo com Express + Prisma
- Frontend base com Next.js
- Sistema de créditos e billing
- Agente-criador de agentes
- Segurança auditada
- Multi-LLM support"

# 4. Push para main
git push -u origin main

# ✅ Pronto! Verificar em https://github.com/Shakthar/Agentify
```

---

## 6️⃣ Configurar o GitHub para Segurança

### Proteger a branch main:
1. Ir a https://github.com/Shakthar/Agentify/settings/branches
2. Clicar em "Add rule"
3. Branch name pattern: `main`
4. ✅ Require pull request reviews
5. ✅ Require status checks to pass
6. ✅ Include administrators

### Adicionar Secrets para CI/CD (depois):
1. Settings → Secrets and variables → Actions
2. Adicionar:
   - `DATABASE_URL`
   - `SUPABASE_SERVICE_KEY`
   - `ANTHROPIC_API_KEY`

---

## 7️⃣ Testar o Servidor Localmente

### Terminal 1 - Backend:
```bash
cd backend
npm run dev
# Deve mostrar: Server running on http://localhost:3001
```

### Terminal 2 - Frontend:
```bash
cd frontend
npm run dev
# Deve mostrar: ▲ Next.js 14.0.0
# Abrir http://localhost:3000
```

### Terminal 3 - Testes:
```bash
# Testar API backend
curl http://localhost:3001/health
# Resposta esperada: {"status":"ok","version":"1.0.0"}

# Testar frontend
curl http://localhost:3000
# Deve retornar HTML do Next.js
```

---

## ⚠️ CRÍTICO - Regenerar Credenciais Após Setup

Assim que tudo estiver funcionando:

### 1. Supabase - Regenerar Senha:
1. Ir a https://app.supabase.com/project/xxgciwhibhqwifqtuzta/settings/database
2. Clicar em "Reset" ao lado de "Database password"
3. Copiar a nova senha
4. Atualizar `backend/.env` com `DATABASE_URL` novo

### 2. Supabase - Regenerar Service Key:
1. Ir a Settings → API
2. Clicar em "Rotate Key" para Service role key
3. Copiar a nova chave
4. Atualizar `backend/.env` com `SUPABASE_SERVICE_KEY` novo

### 3. GitHub - Fazer Commit com Credenciais Novas:
```bash
git add backend/.env
git commit -m "chore: update supabase credentials"
git push
```

⚠️ **Nunca commitir credenciais antigas!**

---

## 📋 Checklist Final

- [ ] Git configurado localmente (`git config user.name`)
- [ ] Repositório clonado do GitHub
- [ ] `backend/.env` preenchido com credenciais Supabase
- [ ] `frontend/.env.local` preenchido
- [ ] Conexão à BD testada (psql ou Node.js)
- [ ] Schema Prisma deployed (`npm run prisma:push`)
- [ ] Código pushed para GitHub
- [ ] Backend rodando em `http://localhost:3001`
- [ ] Frontend rodando em `http://localhost:3000`
- [ ] Consegue fazer login (criar conta no signup)
- [ ] ⚠️ Credenciais do Supabase regeneradas e atualizadas

---

## 🆘 Troubleshooting

### "Connection refused" ao conectar Supabase
- [ ] Verificar se DATABASE_URL está correcta
- [ ] Testar: `psql "postgresql://..."` (copiar URL inteira do .env)
- [ ] Verificar firewall
- [ ] Contactar suporte Supabase

### "Module not found" no backend
```bash
cd backend
npm install
npm run prisma:generate
```

### "CORS error" entre frontend e backend
- Verificar `FRONTEND_URL` no `.env` do backend
- Verificar `API_URL` no `.env.local` do frontend
- Ambos devem estar correctos

### ".env not found"
```bash
cd backend
cp .env.example .env
# Preencher o .env
```

---

**Próximo passo:** Quando tudo funcionar localmente, avisa e começamos o deploy em produção! 🚀
