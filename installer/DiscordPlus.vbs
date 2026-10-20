' Discord+ launcher: runs launcher.ps1 (next to this file) without a console window.
' Arguments are passed through, e.g.:  wscript.exe DiscordPlus.vbs -Flavor Discord -Mode check
Dim fso, shell, dir, args, i
Set fso = CreateObject("Scripting.FileSystemObject")
dir = fso.GetParentFolderName(WScript.ScriptFullName)
args = ""
For i = 0 To WScript.Arguments.Count - 1
    ' Re-quote every argument: WScript strips the quotes, and install paths may contain spaces.
    args = args & " """ & WScript.Arguments(i) & """"
Next
Set shell = CreateObject("WScript.Shell")
shell.Run "powershell.exe -NoProfile -ExecutionPolicy Bypass -WindowStyle Hidden -File """ & dir & "\launcher.ps1""" & args, 0, False
