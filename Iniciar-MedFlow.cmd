@echo off
setlocal

REM ==============================================================
REM  MedFlow - Atalho de Inicializacao (Windows)
REM  - Se node_modules nao existir, roda npm install
REM  - Inicia o sistema com: npm run dev
REM  - Abre o navegador em: http://localhost:5000
REM ==============================================================

cd /d "%~dp0"

if not exist "node_modules\" (
  echo [MedFlow] Dependencias nao encontradas. Instalando...
  echo.
  call npm install
  if errorlevel 1 (
    echo.
    echo [MedFlow] Falha ao instalar dependencias. Verifique se o Node.js/NPM estao instalados.
    pause
    exit /b 1
  )
)

REM abre o navegador alguns segundos depois (sem travar o terminal)
powershell -NoProfile -ExecutionPolicy Bypass -Command "Start-Sleep -Seconds 3; Start-Process 'http://localhost:5000'" >nul 2>nul

echo.
echo [MedFlow] Iniciando... (Ctrl + C para parar)
echo.

call npm run dev

endlocal
