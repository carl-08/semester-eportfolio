# Artificial Intelligence II files

Keep PDFs, Python scripts, and Jupyter notebooks in `pdfs/`. Put cover images in `covers/`.

Run `node tools/archive-manager.mjs scan ai` from the project root after adding files anywhere in this subject folder. The scanner registers new `.pdf`, `.py`, and `.ipynb` files with relative paths and readable filename-based titles. New files start in `Other` until their contents are reviewed. It keeps existing manifest metadata and does not move, rename, or overwrite files.

The page reads each record's title, category, optional description/date, and relative file path from `manifest.json`. Use `node tools/archive-manager.mjs add` for other supported file types or `node tools/archive-manager.mjs edit` to update a listing.

Categories: Activities, Assignments, Projects, Research, Presentations, and Other.
