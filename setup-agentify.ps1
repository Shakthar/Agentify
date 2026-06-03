# AGENTFY - SCRIPT DE SETUP AUTOMÁTICO (WINDOWS)
# Copia este script para C:\Dev\setup-agentify.ps1
# E executa: powershell -ExecutionPolicy Bypass -File C:\Dev\setup-agentify.ps1

Write-Host "╔════════════════════════════════════════════════════════════════╗"
Write-Host "║          AGENTFY - SETUP AUTOMÁTICO (WINDOWS)                ║"
Write-Host "╚════════════════════════════════════════════════════════════════╝"
Write-Host ""

# Verificar se Node.js está instalado
Write-Host "🔍 Verificando Node.js..."
try {
    $nodeVersion = node --version
    Write-Host "✅ Node.js encontrado: $nodeVersion"
} catch {
    Write-Host "❌ Node.js não encontrado! Instala de: https://nodejs.org/"
    exit 1
}

# Criar pasta se não existir
$agentifyPath = "C:\Dev\Agentify"
if (-not (Test-Path $agentifyPath)) {
    Write-Host "❌ Pasta $agentifyPath não encontrada!"
    Write-Host "Cria a pasta e coloca os ficheiros do Agentify lá."
    exit 1
}

Write-Host "✅ Pasta encontrada: $agentifyPath"
Write-Host ""

# PASSO 1: BACKEND NPM INSTALL
Write-Host "┌──────────────────────────────────────────────────────────────┐"
Write-Host "│ PASSO 1: npm install (backend) - ~5 minutos                 │"
Write-Host "└──────────────────────────────────────────────────────────────┘"
Write-Host ""

Set-Location "$agentifyPath\backend"
Write-Host "📦 Instalando dependências backend..."
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erro no npm install (backend)!"
    exit 1
}
Write-Host "✅ Backend pronto!"
Write-Host ""

# PASSO 2: FRONTEND NPM INSTALL
Write-Host "┌──────────────────────────────────────────────────────────────┐"
Write-Host "│ PASSO 2: npm install (frontend) - ~5 minutos                │"
Write-Host "└──────────────────────────────────────────────────────────────┘"
Write-Host ""

Set-Location "$agentifyPath\frontend"
Write-Host "📦 Instalando dependências frontend..."
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Erro no npm install (frontend)!"
    exit 1
}
Write-Host "✅ Frontend pronto!"
Write-Host ""

# PASSO 3: PRISMA PUSH
Write-Host "┌──────────────────────────────────────────────────────────────┐"
Write-Host "│ PASSO 3: npm run prisma:push - Criar tabelas Supabase       │"
Write-Host "└──────────────────────────────────────────────────────────────┘"
Write-Host ""

Set-Location "$agentifyPath\backend"
Write-Host "🗄️  Criando tabelas no Supabase..."
npm run prisma:push
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Erro no prisma push (pode ser erro de conexão)"
    Write-Host "Tenta manualmente: cd $agentifyPath\backend && npm run prisma:push"
} else {
    Write-Host "✅ Tabelas criadas com sucesso!"
}
Write-Host ""

# SUMMARY
Write-Host "╔════════════════════════════════════════════════════════════════╗"
Write-Host "║                    ✅ SETUP COMPLETO!                          ║"
Write-Host "╚════════════════════════════════════════════════════════════════╝"
Write-Host ""
Write-Host "🚀 Para começar, abre 2 terminais:"
Write-Host ""
Write-Host "  Terminal 1 - BACKEND:"
Write-Host "    cd $agentifyPath\backend"
Write-Host "    npm run dev"
Write-Host "    Porta: http://localhost:3001"
Write-Host ""
Write-Host "  Terminal 2 - FRONTEND:"
Write-Host "    cd $agentifyPath\frontend"
Write-Host "    npm run dev"
Write-Host "    Porta: http://localhost:3000"
Write-Host ""
Write-Host "📖 Lê ESTADO_FINAL.md para próximos passos"
Write-Host ""
