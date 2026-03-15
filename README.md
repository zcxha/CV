# CV Chunk Studio (Offline GUI Resume Generator)

This is a lightweight GUI tool for building targeted resumes during mass applications:

- Store your full experience/skills library once ("chunks")
- For each job, create a profile and select only the relevant chunks (A + C, exclude B)
- Export to Markdown, plain text, Word-friendly `.doc`, or print to PDF

## Run

Requirements: Node.js.

```powershell
node server.js
```

Open `http://127.0.0.1:5173` in your browser.

## Storage

- Data is stored in the browser (LocalStorage) under key `cv_chunk_studio:v1`
- Use **Backup JSON** regularly to keep a portable copy
- Use **Restore JSON** to move to a new machine/browser

## Export

- Markdown: `resume.md`
- Plain text: `resume.txt`
- Word: `resume.doc` (HTML-based, opens in Word/WPS)
- PDF: click **Print / Save PDF** and choose "Save as PDF" in the browser print dialog

