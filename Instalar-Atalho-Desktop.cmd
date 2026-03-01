@echo off
setlocal
cd /d "%~dp0"

echo.
echo [MedFlow] Criando atalhos na Area de Trabalho...
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0windows\Criar-Atalho-AreaDeTrabalho.ps1"

if errorlevel 1 (
  echo.
  echo [MedFlow] Nao foi possivel criar o atalho automaticamente.
  echo Dica 1: clique com o botao direito neste arquivo e escolha "Executar como administrador".
  echo Dica 2: verifique se o PowerShell nao esta bloqueado por politica da empresa.
  pause
  exit /b 1
)

echo.
echo [MedFlow] Pronto!
echo - Use o atalho "MedFlow" para iniciar sem abrir o terminal (recomendado para usuario final).
echo - Use o atalho "MedFlow (Console)" para suporte/diagnostico.
pause
endlocal
