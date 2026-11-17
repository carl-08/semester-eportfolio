# Seminars & Field Trips

This combined collection stores academic seminars, educational trips, industry visits, event records, and related materials.

## Folders

- `covers/` — optional collection artwork; these files are not added to the document list.
- `documents/` — PDFs, DOCX files, and PPTX files, grouped into category folders.
- `photos/` — PNG, JPG, and JPEG files, grouped into category folders.
- `manifest.json` — the records shown on the collection page.

## Categories

Use these category folder names so the local scanner can assign the matching display category:

- `seminars/`
- `field-trips/`
- `event-documentation/`
- `certificates/`
- `photos-and-media/`
- `supporting-documents/`

For example, put a seminar PDF in `documents/seminars/` or event photos in `photos/event-documentation/`. Files placed directly in `documents/` are listed as Supporting Documents. Files placed directly in `photos/` are listed as Photos and Media, unless the filename starts with `SEMINARS_` or `FIELDTRIPS_`, which assigns the matching category.

Supported file types: PDF, PNG, JPG/JPEG, DOCX, and PPTX. New files can be copied into these folders and registered with:

```powershell
node tools/archive-manager.mjs scan seminars
```

The scanner uses the filename for the title and the folder for the category. Review each record and add any known date or description with the local archive manager. Original files are not moved, renamed, or deleted by the scanner.
