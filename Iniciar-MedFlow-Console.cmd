@echo off
setlocal
cd /d "%~dp0"
REM Abre o servidor mostrando logs no console (para suporte/diagnostico)
call Iniciar-MedFlow.cmd
endlocal
