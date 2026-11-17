# Emerging Technologies files

The nine existing PDFs remain in `pdfs/` with their original names and are listed in this folder's `manifest.json`. Their titles, categories, and short descriptions were checked against the document text. Dates are only included where the PDF identifies a submission date.

Use `node tools/archive-manager.mjs` from the project root to add, edit, remove, or list records. New entries are written to the manifest. The source file is copied, not moved. Removing a record only removes its manifest entry and leaves both copies of the file intact.

Emerging Technologies categories are: AWS Cloud Fundamentals, AWS Core Services, AWS Security, Cloud Architecture, AWS Academy Laboratories, Pricing and Billing, Certification Review, and Projects and Practical Applications. Covers stay in `covers/`; other supported files added through the manager go in `files/`.

The Google Drive link on the subject page is a separate Emerging Technologies final project submission. It is not part of the local document catalogue.
