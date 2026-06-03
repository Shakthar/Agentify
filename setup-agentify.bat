@echo off
REM AGENTFY - SETUP AUTOMÁTICO (WINDOWS BATCH)
REM Copia este script para C:\Dev\setup-agentify.bat
REM E executa com duplo-clique ou: cmd.exe /k setup-agentify.bat

setlocal enabledelayedexpansion

cls
echo.
echo ╔════════════════════════════════════════════════════════════════╗
echo ║          AGENTFY - SETUP AUTOMÁTICO (WINDOWS)                ║
echo ╚════════════════════════════════════════════════════════════════╝
echo.

REM Verificar Node.js
echo 🔍 Verificando Node.js...
node --version >nul 2>&1
if errorlevel 1 (
    echo ❌ Node.js não encontrado!
    echo Instala de: https://nodejs.org/
    pause
    exit /b 1
)
for /f "tokens=*" %%i in ('node --version') do set NODE_VERSION=%%i
echo ✅ Node.js encontrado: %NODE_VERSION%
echo.

REM Pasta
set AGENTIFY_PATH=C:\Dev\Agentify
if not exist "%AGENTIFY_PATH%" (
    echo ❌ Pasta %AGENTIFY_PATH% não encontrada!
    echo Cria a pasta e coloca os ficheiros do Agentify lá.
    pause
    exit /b 1
)
echo ✅ Pasta encontrada: %AGENTIFY_PATH%
echo.

REM BACKEND NPM INSTALL
echo ┌──────────────────────────────────────────────────────────────┐
echo │ PASSO 1: npm install (backend) - ~5 minutos                 │
echo └──────────────────────────────────────────────────────────────┘
echo.

cd /d "%AGENTIFY_PATH%\backend"
echo 📦 Instalando dependências backend...
call npm install
if errorlevel 1 (
    echo ❌ Erro no npm install (backend)!
    pause
    exit /b 1
)
echo ✅ Backend pronto!
echo.

REM FRONTEND NPM INSTALL
echo ┌──────────────────────────────────────────────────────────────┐
echo │ PASSO 2: npm install (frontend) - ~5 minutos                │
echo └──────────────────────────────────────────────────────────────┘
echo.

cd /d "%AGENTIFY_PATH%\frontend"
echo 📦 Instalando dependências frontend...
call npm install
if errorlevel 1 (
    echo ❌ Erro no npm install (frontend)!
    pause
    exit /b 1
)
echo ✅ Frontend pronto!
echo.

REM PRISMA PUSH
echo ┌──────────────────────────────────────────────────────────────┐
echo │ PASSO 3: npm run prisma:push - Criar tabelas Supabase       │
echo └──────────────────────────────────────────────────────────────┘
echo.

cd /d "%AGENTIFY_PATH%\backend"
echo 🗄️  Criando tabelas no Supabase...
call npm run prisma:push
if errorlevel 1 (
    echo ⚠️  Erro no prisma push (pode ser erro de conexão)
    echo Tenta manualmente: cd "%AGENTIFY_PATH%\backend" ^&^& npm run prisma:push
) else (
    echo ✅ Tabelas criadas com sucesso!
)
echo.

REM SUMMARY
echo ╔════════════════════════════════════════════════════════════════╗
echo ║                    ✅ SETUP COMPLETO!                          ║
echo ╚════════════════════════════════════════════════════════════════╝
echo.
echo 🚀 Para começar, abre 2 terminais:
echo.
echo   Terminal 1 - BACKEND:
echo     cd %AGENTIFY_PATH%\backend
echo     npm run dev
echo     Porta: http://localhost:3001
echo.
echo   Terminal 2 - FRONTEND:
echo     cd %AGENTIFY_PATH%\frontend
echo     npm run dev
echo     Porta: http://localhost:3000
echo.
echo 📖 Lê ESTADO_FINAL.md para próximos passos
echo.
pause
