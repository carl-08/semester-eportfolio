# Artificial Intelligence II files

Keep coursework PDFs, Python scripts, and Jupyter notebooks in `pdfs/`. The About Me portrait is `covers/Madanglog_ProfPic.jpg`; the original copy supplied at `works/Madanglog_ProfPic.jpg` remains unchanged.

Run `node tools/archive-manager.mjs scan ai` from the project root after adding files anywhere in this subject folder. The scanner registers `.pdf`, `.py`, and `.ipynb` files with relative paths and readable filename-based titles. New files start in `Other` until their contents are reviewed. It keeps existing manifest metadata and does not move, rename, or overwrite files.

The AI II page is organized into Welcome, About Me, Learning Artifacts, Achievements & Skills, and Final Project. Its course metadata is:

- Artificial Intelligence II
- CPE 314-401G
- Bachelor of Science in Computer Engineering
- 1st Semester (SEM 1), SY 2026–2027

The `course` object holds those verified fields. Use `aboutMe` for the verified `introduction` and `interests`. Omit personal fields that have not been supplied.

Each `works` entry supports an optional verified `date` in `YYYY-MM-DD` format, a verified description, and reflection fields for `learning`, `challenges`, and `goalConnection`. Omit dates and reflections that have not been verified or supplied.

Use `achievements` only for documented certificates or accomplishments, with `title`, `type`, `issuer`, `date`, `description`, and evidence. The AWS Academy NLP training certificate is included from its uploaded file; preserve its verified fields and source evidence. Use `skills` for evidence-linked coursework or experience; describe the evidence without claiming an unsupported level of proficiency. Evidence items can use a relative `file` path or an `http(s)` `url`, with an optional `title`.

The separate `finalProject` object supports `title`, `description`, `objectives`, `technologies`, `contribution`, `challenge`, `reflection`, and `results`. Keep it separate from ordinary coursework and include only verified project information.

AI II categories in the manager are: Laboratory Activities, Programming Exercises, Assignments, Practical Examinations, Research, and Other. Use only categories supported by the actual files. Do not infer the AI II course code from details in an unrelated research proposal.
