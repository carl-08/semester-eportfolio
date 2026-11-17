# Emerging Technologies files

The nine existing PDFs remain in `pdfs/` with their original names and are listed in this folder's `manifest.json`. Their titles, categories, and short descriptions were checked against the document text. Dates are only included where the PDF identifies a submission date.

The manifest also contains the verified course profile, shared student profile details, and coursework-supported skills. Skills should cite one or more local evidence files.

Use `node tools/archive-manager.mjs` from the project root to add, edit, remove, or list records. New entries are written to the manifest. The source file is copied, not moved. Removing a record only removes its manifest entry and leaves both copies of the file intact.

The current Emerging Technologies categories are: Cloud Architecture, AWS Core Services, AWS Security, Projects and Practical Applications, and Pricing and Billing. Covers stay in `covers/`; other supported files added through the manager go in `files/`.

The `finalProject` manifest entry contains information verified from the Emerging Final Project presentation, cost estimate, phase evidence folders, and demo video in Google Drive. Add objectives, personal contribution, challenges, or reflection only when verified or supplied by the student; do not infer them from the architecture or the group folder name.
