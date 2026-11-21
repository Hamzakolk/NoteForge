NoteForge - Drive sync (step 1)

1. Put your OAuth file next to drive_sync.py and name it client_secret.json
   (the file you downloaded from Google Cloud, renamed).
   Do NOT share this file or upload it to GitHub.
2. pip install -r requirements.txt
3. python drive_sync.py
   First run opens a browser to sign in with your Google account.
   Next runs reuse the saved token (in %USERPROFILE%\.noteforge).

Notes are saved in %USERPROFILE%\.noteforge\notes and synced to Drive folder "NoteForge".
Deleting a note is not synced yet.
