' MedFlow - Inicializador silencioso (Windows)
' Executa o Iniciar-MedFlow.cmd sem abrir janela do terminal.
Option Explicit

Dim shell, cmd, workDir
Set shell = CreateObject("WScript.Shell")

workDir = CreateObject("Scripting.FileSystemObject").GetParentFolderName(WScript.ScriptFullName)
cmd = """" & workDir & "\Iniciar-MedFlow.cmd" & """"

' 0 = oculto, False = nao aguarda terminar (mantem o servidor rodando)
shell.CurrentDirectory = workDir
shell.Run cmd, 0, False
