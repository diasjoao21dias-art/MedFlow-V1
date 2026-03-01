# MedFlow - Criar atalhos na Área de Trabalho
# - "MedFlow" (silencioso): inicia sem abrir janela do terminal
# - "MedFlow (Console)" (opcional): inicia mostrando logs no terminal

$ErrorActionPreference = 'Stop'

$projectRoot = Split-Path -Parent $PSScriptRoot
$targetVbs = Join-Path $projectRoot 'Iniciar-MedFlow.vbs'
$targetCmdConsole = Join-Path $projectRoot 'Iniciar-MedFlow-Console.cmd'
$icon = Join-Path $PSScriptRoot 'medflow.ico'

if (!(Test-Path $targetVbs)) { throw "Arquivo alvo nao encontrado: $targetVbs" }
if (!(Test-Path $icon)) { throw "Icone nao encontrado: $icon" }

$desktop = [Environment]::GetFolderPath('Desktop')

function New-Shortcut($shortcutPath, $targetPath, $arguments, $workingDir, $iconPath, $description) {
  $wsh = New-Object -ComObject WScript.Shell
  $sc = $wsh.CreateShortcut($shortcutPath)
  $sc.TargetPath = $targetPath
  if ($arguments) { $sc.Arguments = $arguments }
  if ($workingDir) { $sc.WorkingDirectory = $workingDir }
  if ($iconPath) { $sc.IconLocation = "$iconPath,0" }
  $sc.WindowStyle = 1
  $sc.Description = $description
  $sc.Save()
}

# Atalho principal (silencioso) -> wscript.exe "Iniciar-MedFlow.vbs"
$wscript = Join-Path $env:WINDIR 'System32\wscript.exe'
$shortcutMain = Join-Path $desktop 'MedFlow.lnk'
New-Shortcut -shortcutPath $shortcutMain -targetPath $wscript -arguments """$targetVbs""" -workingDir $projectRoot -iconPath $icon -description 'Iniciar MedFlow (silencioso)'

# Atalho opcional com console (para suporte)
if (Test-Path $targetCmdConsole) {
  $shortcutConsole = Join-Path $desktop 'MedFlow (Console).lnk'
  New-Shortcut -shortcutPath $shortcutConsole -targetPath $targetCmdConsole -arguments $null -workingDir $projectRoot -iconPath $icon -description 'Iniciar MedFlow (com console)'
}

Write-Host "Atalhos criados na Área de Trabalho:" -ForegroundColor Green
Write-Host " - $shortcutMain"
if (Test-Path $targetCmdConsole) { Write-Host " - $shortcutConsole" }
