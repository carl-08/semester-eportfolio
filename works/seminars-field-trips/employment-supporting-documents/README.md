# Employment Supporting Documents

This folder is separate from the Seminars and Field Trips document and photo folders. Its records are stored in the `employmentWorks` list in the parent `manifest.json`.

## Categories

Place files in one of these category folders:

- `certificate-of-employment/`
- `work-schedule/`
- `employment-verification/`
- `other-supporting-evidence/`

Supported file types are PDF, DOCX, XLSX, PNG, JPG, and JPEG. Files placed directly in this folder use **Other Supporting Evidence**.

Files placed directly in this folder use **Other Supporting Evidence**, except filenames containing `CompanyID`, which the scanner places under **Employment Verification**.

To register new files from the local workflow, run:

```powershell
node tools/archive-manager.mjs scan employment
```

Or run `node tools/archive-manager.mjs add` and choose **Employment Supporting Documents**. The local manager copies selected files into this folder; it does not edit the source files or upload anything to GitHub.

GitHub Pages serves published files publicly. Include only documents and filenames that are meant to be public. Employment records are listed without descriptions or dates by default.
