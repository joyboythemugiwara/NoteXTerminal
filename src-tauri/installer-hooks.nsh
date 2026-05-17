; "Open in NoteXTerminal" shell verbs for folders, folder backgrounds, drives, and files.
; HKCU matches installer currentUser scope. %V = clicked path.
; NoWorkingDirectory keeps Explorer from overriding %V (System32 on Drive).

!macro NSIS_HOOK_POSTINSTALL
  ; 1. Folder Right-click
  WriteRegStr HKCU "Software\Classes\Directory\shell\OpenInNoteXTerminal" "" "Open in NoteXTerminal"
  WriteRegStr HKCU "Software\Classes\Directory\shell\OpenInNoteXTerminal" "Icon" '"$INSTDIR\NoteXTerminal.exe",0'
  WriteRegStr HKCU "Software\Classes\Directory\shell\OpenInNoteXTerminal" "NoWorkingDirectory" ""
  WriteRegStr HKCU "Software\Classes\Directory\shell\OpenInNoteXTerminal\command" "" '"$INSTDIR\NoteXTerminal.exe" "%V"'

  ; 2. Folder Background Right-click
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\OpenInNoteXTerminal" "" "Open in NoteXTerminal"
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\OpenInNoteXTerminal" "Icon" '"$INSTDIR\NoteXTerminal.exe",0'
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\OpenInNoteXTerminal" "NoWorkingDirectory" ""
  WriteRegStr HKCU "Software\Classes\Directory\Background\shell\OpenInNoteXTerminal\command" "" '"$INSTDIR\NoteXTerminal.exe" "%V"'

  ; 3. Drive Right-click
  WriteRegStr HKCU "Software\Classes\Drive\shell\OpenInNoteXTerminal" "" "Open in NoteXTerminal"
  WriteRegStr HKCU "Software\Classes\Drive\shell\OpenInNoteXTerminal" "Icon" '"$INSTDIR\NoteXTerminal.exe",0'
  WriteRegStr HKCU "Software\Classes\Drive\shell\OpenInNoteXTerminal" "NoWorkingDirectory" ""
  WriteRegStr HKCU "Software\Classes\Drive\shell\OpenInNoteXTerminal\command" "" '"$INSTDIR\NoteXTerminal.exe" "%V"'

  ; 4. Generic File Right-click (opens parent dir)
  WriteRegStr HKCU "Software\Classes\*\shell\OpenInNoteXTerminal" "" "Open in NoteXTerminal"
  WriteRegStr HKCU "Software\Classes\*\shell\OpenInNoteXTerminal" "Icon" '"$INSTDIR\NoteXTerminal.exe",0'
  WriteRegStr HKCU "Software\Classes\*\shell\OpenInNoteXTerminal" "NoWorkingDirectory" ""
  WriteRegStr HKCU "Software\Classes\*\shell\OpenInNoteXTerminal\command" "" '"$INSTDIR\NoteXTerminal.exe" "%W"'
!macroend

!macro NSIS_HOOK_POSTUNINSTALL
  DeleteRegKey HKCU "Software\Classes\Directory\shell\OpenInNoteXTerminal"
  DeleteRegKey HKCU "Software\Classes\Directory\Background\shell\OpenInNoteXTerminal"
  DeleteRegKey HKCU "Software\Classes\Drive\shell\OpenInNoteXTerminal"
  DeleteRegKey HKCU "Software\Classes\*\shell\OpenInNoteXTerminal"
!macroend
