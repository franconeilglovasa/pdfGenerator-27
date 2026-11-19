# Random PDF Studio

A small static web app that generates random PDFs entirely in your browser.

- Random title + body for every document
- Never more than **500 words** per PDF (including the title)
- Generate 1–25 at once: one PDF downloads directly, several come as a ZIP
- No server, no dependencies, no network calls, no storage

## Run it

Open `index.html` in any modern browser. That's it.

Optionally serve it over HTTP:

```powershell
# Node
npx --yes serve .

# or Python
python -m http.server 8000
```

## How the "no storage" part works

The PDF bytes are built in JavaScript inside the page, turned into a `Blob`, and handed
to the browser's download mechanism. Nothing is uploaded, written to a temp directory, or
kept after the tab is closed or refreshed. Closing the page discards the in-memory copies,
so there is no file on the machine that needs deleting.

## Files

| File | Purpose |
| --- | --- |
| `index.html` | Page structure |
| `styles.css` | Styling |
| `app/content.js` | Random title/body generator with the 500-word cap |
| `app/pdf.js` | Dependency-free PDF writer (A4, Helvetica) |
| `app/zip.js` | Dependency-free ZIP writer for multi-file downloads |
| `app/main.js` | UI wiring, download handling, cleanup |

## Notes

- PDFs are text-only, using the standard Helvetica fonts built into every PDF reader.
- Word counting is whitespace-based, so punctuation-joined words count as one.
- Everything is ASCII, so no font embedding is required.