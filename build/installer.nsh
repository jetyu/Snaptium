!macro customUnInit
  DetailPrint "Force closing NoteWizard Application..."
  
  nsExec::Exec 'taskkill /F /IM "NoteWizard.exe"'
  
  Sleep 500
!macroend
