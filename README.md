# ARCHIVE / 026

Static academic portfolio for Carl Jhimuel Madanglog. It can be deployed from the repository root on GitHub Pages.

## Local preview

Requires Node.js 18 or newer. From this folder, run:

```powershell
node tools/serve.mjs
```

Then open `http://localhost:8765/`. The preview server only serves local files on this computer.

## Add and manage academic files

Run:

```powershell
node tools/archive-manager.mjs
```

The menu can add a file or external link, edit listing metadata, remove a listing without deleting its file, or show existing records. Files are copied into the matching subject folder; the source file is left in place. Duplicate file contents and duplicate external links are rejected.

Supported uploads are PDF, DOCX, PPTX, XLSX, PNG, JPG, JPEG, and ZIP for the existing subject collections. Seminars & Field Trips accepts PDF, DOCX, PPTX, PNG, JPG, and JPEG. Employment supporting documents accept PDF, DOCX, XLSX, PNG, JPG, and JPEG and are kept in a separate folder and manifest list within Seminars & Field Trips.

To register files placed directly in the Seminars & Field Trips folders, run `node tools/archive-manager.mjs scan seminars`. Files in category folders use filename titles and folder categories; review the records and add dates or descriptions when known.

Employment records can be added through the local manager by choosing **Employment Supporting Documents**, or scanned from its dedicated folder with `node tools/archive-manager.mjs scan employment`. They are stored under `works/seminars-field-trips/employment-supporting-documents/` and listed in `employmentWorks` in the same manifest. GitHub Pages makes published files and their filenames publicly accessible, so add only documents and names intended for public viewing.

The portfolio itself is static. PDF.js renders complete documents as a continuous, lazy-loaded page stack with text search. The pinned `pdfjs-dist` release is loaded from jsDelivr; document listings and downloads work as regular same-site files on GitHub Pages.
