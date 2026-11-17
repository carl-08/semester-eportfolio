#!/usr/bin/env node
import { createHash } from "node:crypto";
import { copyFile, mkdir, readFile, readdir, rename, stat, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const SUBJECTS = {
  ai: { label: "Artificial Intelligence II", folder: "artificial-intelligence-ii" },
  emerging: { label: "Emerging Technologies", folder: "emerging-technologies" },
  seminars: { label: "Seminars & Field Trips", folder: "seminars-field-trips" },
  employment: { label: "Employment Supporting Documents", folder: "seminars-field-trips", field: "employmentWorks" }
};
const CATEGORIES = {
  ai: ["Activities", "Assignments", "Projects", "Research", "Presentations", "Other"],
  emerging: [
    "AWS Cloud Fundamentals", "AWS Core Services", "AWS Security", "Cloud Architecture",
    "AWS Academy Laboratories", "Pricing and Billing", "Certification Review", "Projects and Practical Applications"
  ],
  seminars: ["Seminars", "Field Trips", "Event Documentation", "Certificates", "Photos and Media", "Supporting Documents"],
  employment: ["Certificate of Employment", "Work Schedule", "Employment Verification", "Other Supporting Evidence"]
};
const SUPPORTED = new Set([".pdf", ".docx", ".pptx", ".xlsx", ".png", ".jpg", ".jpeg", ".zip"]);
const SEMINAR_SUPPORTED = new Set([".pdf", ".docx", ".pptx", ".png", ".jpg", ".jpeg"]);
const EMPLOYMENT_SUPPORTED = new Set([".pdf", ".docx", ".xlsx", ".png", ".jpg", ".jpeg"]);
const AI_SOURCE_FORMATS = new Set([".py", ".ipynb"]);
const SEMINAR_CATEGORY_FOLDERS = {
  Seminars: "seminars",
  "Field Trips": "field-trips",
  "Event Documentation": "event-documentation",
  Certificates: "certificates",
  "Photos and Media": "photos-and-media",
  "Supporting Documents": "supporting-documents"
};
const EMPLOYMENT_CATEGORY_FOLDERS = {
  "Certificate of Employment": "certificate-of-employment",
  "Work Schedule": "work-schedule",
  "Employment Verification": "employment-verification",
  "Other Supporting Evidence": "other-supporting-evidence"
};
const rl = createInterface({ input, output });

const ask = async (label, fallback = "") => {
  const suffix = fallback ? ` [${fallback}]` : "";
  const answer = (await rl.question(`${label}${suffix}: `)).trim();
  return answer || fallback;
};

const subjectFrom = (value) => {
  const key = String(value || "").toLowerCase();
  return SUBJECTS[key] ? key : null;
};

const recordsFieldFor = (subject) => SUBJECTS[subject].field || "works";
const storedSubjectFor = (subject) => subject === "employment" ? "seminars" : subject;
const recordsFor = (manifest, subject) => Array.isArray(manifest[recordsFieldFor(subject)]) ? manifest[recordsFieldFor(subject)] : [];
const allManifestWorks = (manifest) => [...(manifest.works || []), ...(manifest.employmentWorks || [])];

const manifestPathFor = (subject) => path.join(ROOT, "works", SUBJECTS[subject].folder, "manifest.json");

async function readManifest(subject) {
  const manifestPath = manifestPathFor(subject);
  try {
    return JSON.parse(await readFile(manifestPath, "utf8"));
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
    return { subject: storedSubjectFor(subject), works: [], activities: [], employmentWorks: [] };
  }
}

async function writeManifest(subject, manifest) {
  const manifestPath = manifestPathFor(subject);
  const directory = path.dirname(manifestPath);
  await mkdir(directory, { recursive: true });
  const temporaryPath = path.join(directory, `.manifest-${process.pid}.tmp`);
  await writeFile(temporaryPath, `${JSON.stringify(manifest, null, 2)}\n`, "utf8");
  await rename(temporaryPath, manifestPath);
}

const slugify = (value) => String(value).normalize("NFKD").toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "record";
const sha256 = async (file) => createHash("sha256").update(await readFile(file)).digest("hex");
const validDate = (value) => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.valueOf()) && date.toISOString().slice(0, 10) === value;
};
const cleanExternalUrl = (value) => {
  if (!value) return "";
  const url = new URL(value);
  if (!['http:', 'https:'].includes(url.protocol)) throw new Error("External links must use http or https.");
  return url.href;
};

function printWorks(manifest, subject) {
  const works = recordsFor(manifest, subject);
  console.log(`\n${SUBJECTS[subject].label}: ${works.length} record(s)`);
  if (!works.length) console.log("  No records yet.");
  for (const work of works) console.log(`  ${work.id}  |  ${work.title}  |  ${work.category}  |  ${work.file || work.externalUrl || "no file"}`);
}

async function chooseSubject() {
  console.log("\n1. Artificial Intelligence II (ai)\n2. Emerging Technologies (emerging)\n3. Seminars & Field Trips (seminars)\n4. Employment Supporting Documents (employment)");
  while (true) {
    const choice = await ask("Choose a collection (1/2/3/4 or ai/emerging/seminars/employment)");
    const subject = subjectFrom(choice === "1" ? "ai" : choice === "2" ? "emerging" : choice === "3" ? "seminars" : choice === "4" ? "employment" : choice);
    if (subject) return subject;
    console.log("Enter 1, 2, 3, 4, ai, emerging, seminars, or employment.");
  }
}

async function chooseCategory(subject, fallback = "") {
  const categories = CATEGORIES[subject];
  console.log(categories.map((category, index) => `  ${index + 1}. ${category}`).join("\n"));
  while (true) {
    const fallbackIndex = categories.indexOf(fallback);
    const choice = await ask("Choose a category number", fallbackIndex >= 0 ? String(fallbackIndex + 1) : "");
    const index = Number(choice) - 1;
    if (categories[index]) return categories[index];
    console.log("Choose one of the listed numbers.");
  }
}

async function uniqueTarget(directory, filename, sourcePath, manifest) {
  const extension = path.extname(filename);
  const stem = path.basename(filename, extension);
  let candidate = filename;
  let sequence = 2;
  while (true) {
    const absolute = path.join(directory, candidate);
    try {
      await stat(absolute);
      const relative = path.posix.join(path.basename(path.dirname(directory)), path.basename(directory), candidate);
      const listed = allManifestWorks(manifest).some((work) => work.file === relative || work.file?.endsWith(`/${candidate}`));
      if (listed) {
        const same = await sha256(sourcePath) === await sha256(absolute);
        if (same) throw new Error("A matching file is already registered. No duplicate record was added.");
      }
      candidate = `${stem}-${sequence}${extension}`;
      sequence += 1;
    } catch (error) {
      if (error.code === "ENOENT") return candidate;
      throw error;
    }
  }
}

async function addRecord() {
  const subject = await chooseSubject();
  const manifest = await readManifest(subject);
  const existingWorks = recordsFor(manifest, subject);
  const sourcePrompt = subject === "employment" ? "Path to a local file" : "Path to a local file (leave blank for a link-only record)";
  const sourceInput = (await ask(sourcePrompt)).replace(/^['"]|['"]$/g, "");
  const sourcePath = sourceInput ? path.resolve(process.cwd(), sourceInput) : "";
  if (subject === "employment" && !sourcePath) throw new Error("Choose a local employment document to add.");
  let extension = "";
  if (sourcePath) {
    const sourceStats = await stat(sourcePath);
    if (!sourceStats.isFile()) throw new Error("The selected path is not a file.");
    extension = path.extname(sourcePath).toLowerCase();
    const supported = subject === "employment"
      ? EMPLOYMENT_SUPPORTED.has(extension)
      : subject === "seminars"
        ? SEMINAR_SUPPORTED.has(extension)
        : SUPPORTED.has(extension) || (subject === "ai" && AI_SOURCE_FORMATS.has(extension));
    if (!supported) throw new Error(`Unsupported file format: ${extension || "unknown"}.`);
    const digest = await sha256(sourcePath);
    for (const item of allManifestWorks(manifest)) {
      if (!item.file) continue;
      const existingPath = path.join(path.dirname(manifestPathFor(subject)), ...item.file.split("/"));
      try {
        if (await sha256(existingPath) === digest) throw new Error("This file is already registered in the subject manifest.");
      } catch (error) {
        if (error.message.includes("already registered")) throw error;
        if (error.code !== "ENOENT") throw error;
      }
    }
  }

  const category = await chooseCategory(subject);
  const title = subject === "employment" && sourcePath
    ? path.basename(sourcePath, path.extname(sourcePath))
    : await ask("Document title");
  if (!title) throw new Error("A title is required.");
  let description = "";
  let date = "";
  let externalUrl = "";
  if (subject !== "employment") {
    description = await ask("Description (optional)");
    date = await ask("Submission date YYYY-MM-DD (optional)");
    if (date && !validDate(date)) throw new Error("Use a real date in YYYY-MM-DD format or leave it blank.");
    externalUrl = cleanExternalUrl(await ask("External URL (optional)"));
  }
  if (!sourcePath && (subject === "employment" || !externalUrl)) throw new Error("Add a local file or an external URL.");
  if (externalUrl && allManifestWorks(manifest).some((item) => item.externalUrl === externalUrl)) {
    throw new Error("This external URL is already registered.");
  }

  const work = {
    id: slugify(title),
    title,
    category,
    type: extension ? extension.slice(1) : "link"
  };
  if (description) work.description = description;
  if (date) work.date = date;
  if (externalUrl) work.externalUrl = externalUrl;

  let copied = false;
  if (sourcePath) {
    const subjectDirectory = path.dirname(manifestPathFor(subject));
    const categoryFolder = subject === "seminars" ? SEMINAR_CATEGORY_FOLDERS[category] : "";
    const employmentCategoryFolder = subject === "employment" ? EMPLOYMENT_CATEGORY_FOLDERS[category] : "";
    const isImage = [".png", ".jpg", ".jpeg"].includes(extension);
    const subfolder = subject === "employment"
      ? path.posix.join("employment-supporting-documents", employmentCategoryFolder)
      : subject === "seminars"
        ? path.posix.join(isImage ? "photos" : "documents", categoryFolder)
        : extension === ".pdf" || (subject === "ai" && AI_SOURCE_FORMATS.has(extension)) ? "pdfs" : isImage ? "covers" : "files";
    const targetDirectory = path.join(subjectDirectory, ...subfolder.split("/"));
    await mkdir(targetDirectory, { recursive: true });
    const fileName = await uniqueTarget(targetDirectory, path.basename(sourcePath), sourcePath, manifest);
    const absoluteTarget = path.join(targetDirectory, fileName);
    try {
      await copyFile(sourcePath, absoluteTarget, 1);
      copied = true;
    } catch (error) {
      if (error.code !== "EEXIST") throw error;
      throw new Error("The destination file already exists. No existing file was overwritten.");
    }
    work.file = `${subfolder}/${fileName}`.replace(/\\/g, "/");
    if (isImage && subject !== "seminars" && subject !== "employment") work.cover = work.file;
  }

  const ids = new Set(existingWorks.map((item) => item.id));
  const baseId = work.id;
  let suffix = 2;
  while (ids.has(work.id)) work.id = `${baseId}-${suffix++}`;
  manifest.subject = storedSubjectFor(subject);
  manifest[recordsFieldFor(subject)] = [...existingWorks, work];
  manifest.activities = manifest.activities || [];
  await writeManifest(storedSubjectFor(subject), manifest);
  console.log(`\nAdded “${title}” to ${SUBJECTS[subject].label}.`);
  if (copied) console.log("The source file was copied; the original source file was left in place.");
}

async function editRecord() {
  const subject = await chooseSubject();
  const manifest = await readManifest(subject);
  const works = recordsFor(manifest, subject);
  printWorks(manifest, subject);
  const id = await ask("Record ID to edit");
  const work = works.find((item) => item.id === id);
  if (!work) throw new Error("That record ID was not found.");
  work.title = await ask("Title (blank keeps current)", work.title);
  work.category = await chooseCategory(subject, work.category || "");
  if (subject === "employment") {
    manifest.subject = "seminars";
    await writeManifest("seminars", manifest);
    console.log(`Updated employment listing ${work.id}. Its attached file and private metadata were left unchanged.`);
    return;
  }
  work.description = await ask("Description (enter - to clear)", work.description || "");
  if (work.description === "-") delete work.description;
  const date = await ask("Date YYYY-MM-DD (enter - to clear)", work.date || "");
  if (date === "-") delete work.date;
  else if (date && !validDate(date)) throw new Error("Use a real date in YYYY-MM-DD format or leave it blank.");
  else if (date) work.date = date;
  const url = await ask("External URL (enter - to clear)", work.externalUrl || "");
  if (url === "-") delete work.externalUrl;
  else if (url) work.externalUrl = cleanExternalUrl(url);
  await writeManifest(storedSubjectFor(subject), manifest);
  console.log(`Updated listing ${work.id}. Its attached file was left unchanged.`);
}

async function removeListing() {
  const subject = await chooseSubject();
  const manifest = await readManifest(subject);
  const works = recordsFor(manifest, subject);
  printWorks(manifest, subject);
  const id = await ask("Record ID to remove from the listing");
  const work = works.find((item) => item.id === id);
  if (!work) throw new Error("That record ID was not found.");
  const confirmation = await ask(`Remove listing “${work.title}”? Type yes to confirm`);
  if (confirmation.toLowerCase() !== "yes") {
    console.log("No changes made.");
    return;
  }
  manifest[recordsFieldFor(subject)] = works.filter((item) => item.id !== id);
  manifest.subject = storedSubjectFor(subject);
  await writeManifest(storedSubjectFor(subject), manifest);
  console.log("The manifest entry was removed. The stored document and its original source were not deleted.");
}

async function listRecords(subjectArg = "") {
  const subject = subjectFrom(subjectArg) || await chooseSubject();
  printWorks(await readManifest(subject), subject);
}

function titleFromFilename(filename) {
  const stem = path.basename(filename, path.extname(filename));
  return stem
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/\b[a-z]/g, (letter) => letter.toUpperCase());
}

function seminarTitleFromFilename(filename) {
  return titleFromFilename(filename)
    .replace(/^Seminars?\s+/i, "")
    .replace(/\bFieldtrips\b/gi, "Field Trips")
    .replace(/\bHitech\b/gi, "Hi-Tech")
    .replace(/\bSchneiderelectric\b/gi, "Schneider Electric");
}

async function findAiFiles(directory, subjectDirectory, results = []) {
  let entries = [];
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return results;
    throw error;
  }
  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await findAiFiles(absolutePath, subjectDirectory, results);
      continue;
    }
    const extension = path.extname(entry.name).toLowerCase();
    if (!entry.isFile() || ![".pdf", ...AI_SOURCE_FORMATS].includes(extension)) continue;
    results.push({
      file: path.relative(subjectDirectory, absolutePath).split(path.sep).join("/"),
      filename: entry.name,
      extension
    });
  }
  return results;
}

async function scanAiFiles() {
  const subject = "ai";
  const subjectDirectory = path.dirname(manifestPathFor(subject));
  const scanDirectory = subjectDirectory;
  const manifest = await readManifest(subject);
  const works = Array.isArray(manifest.works) ? manifest.works : [];
  const knownFiles = new Set(works.filter((work) => typeof work.file === "string").map((work) => work.file.replace(/\\/g, "/").toLowerCase()));
  const ids = new Set(works.map((work) => work.id).filter(Boolean));
  const files = await findAiFiles(scanDirectory, subjectDirectory);
  const additions = [];

  for (const file of files) {
    const key = file.file.toLowerCase();
    if (knownFiles.has(key)) continue;
    const title = titleFromFilename(file.filename) || "Untitled record";
    const baseId = slugify(title);
    let id = baseId;
    let suffix = 2;
    while (ids.has(id)) id = `${baseId}-${suffix++}`;
    ids.add(id);
    knownFiles.add(key);
    additions.push({
      id,
      title,
      category: "Other",
      type: file.extension.slice(1),
      file: file.file
    });
  }

  if (!additions.length) {
    console.log(`AI 2 scan complete. No new PDFs, Python files, or notebooks were found in ${path.relative(ROOT, scanDirectory).split(path.sep).join("/")}.`);
    return;
  }

  manifest.subject = subject;
  manifest.works = [...works, ...additions];
  manifest.activities = Array.isArray(manifest.activities) ? manifest.activities : [];
  await writeManifest(subject, manifest);
  console.log(`AI 2 scan added ${additions.length} file(s):`);
  for (const work of additions) console.log(`  ${work.title}  |  ${work.type.toUpperCase()}  |  ${work.file}`);
  console.log("New records use the Other category until their contents are reviewed. Existing metadata was kept.");
}

async function findSupportedFiles(directory, subjectDirectory, supportedExtensions, results = []) {
  let entries = [];
  try {
    entries = await readdir(directory, { withFileTypes: true });
  } catch (error) {
    if (error.code === "ENOENT") return results;
    throw error;
  }
  for (const entry of entries) {
    const absolutePath = path.join(directory, entry.name);
    if (entry.isDirectory()) {
      await findSupportedFiles(absolutePath, subjectDirectory, supportedExtensions, results);
      continue;
    }
    const extension = path.extname(entry.name).toLowerCase();
    if (!entry.isFile() || !supportedExtensions.has(extension)) continue;
    results.push({
      file: path.relative(subjectDirectory, absolutePath).split(path.sep).join("/"),
      filename: entry.name,
      extension
    });
  }
  return results;
}

async function scanSeminarFiles() {
  const subject = "seminars";
  const subjectDirectory = path.dirname(manifestPathFor(subject));
  const manifest = await readManifest(subject);
  const works = Array.isArray(manifest.works) ? manifest.works : [];
  const knownFiles = new Set(works
    .filter((work) => typeof work.file === "string")
    .map((work) => work.file.replace(/\\/g, "/").toLowerCase()));
  const ids = new Set(works.map((work) => work.id).filter(Boolean));
  const roots = ["documents", "photos"].map((folder) => path.join(subjectDirectory, folder));
  const files = (await Promise.all(roots.map((directory) => findSupportedFiles(directory, subjectDirectory, SEMINAR_SUPPORTED)))).flat();
  const additions = [];

  for (const file of files) {
    const key = file.file.toLowerCase();
    if (knownFiles.has(key)) continue;
    const folders = file.file.split("/").slice(0, -1);
    const filename = file.filename.toLocaleLowerCase();
    const category = Object.entries(SEMINAR_CATEGORY_FOLDERS)
      .find(([, folder]) => folders.includes(folder))?.[0]
      || (filename.startsWith("seminars_") ? "Seminars" : filename.startsWith("fieldtrips_") ? "Field Trips" : "")
      || (file.file.startsWith("photos/") ? "Photos and Media" : "Supporting Documents");
    const title = seminarTitleFromFilename(file.filename) || "Untitled record";
    const baseId = slugify(title);
    let id = baseId;
    let suffix = 2;
    while (ids.has(id)) id = `${baseId}-${suffix++}`;
    ids.add(id);
    knownFiles.add(key);
    additions.push({ id, title, category, type: file.extension.slice(1), file: file.file });
  }

  if (!additions.length) {
    console.log(`Seminars & Field Trips scan complete. No new supported files were found in ${path.relative(ROOT, subjectDirectory).split(path.sep).join("/")}/documents or /photos.`);
    return;
  }

  manifest.subject = subject;
  manifest.works = [...works, ...additions];
  manifest.activities = Array.isArray(manifest.activities) ? manifest.activities : [];
  await writeManifest(subject, manifest);
  console.log(`Seminars & Field Trips scan added ${additions.length} file(s):`);
  for (const work of additions) console.log(`  ${work.title}  |  ${work.category}  |  ${work.type.toUpperCase()}  |  ${work.file}`);
  console.log("Filename titles and folder categories were used. Add dates and descriptions after reviewing each item.");
}

async function scanEmploymentFiles() {
  const subject = "employment";
  const storedSubject = "seminars";
  const subjectDirectory = path.dirname(manifestPathFor(storedSubject));
  const employmentDirectory = path.join(subjectDirectory, "employment-supporting-documents");
  const manifest = await readManifest(storedSubject);
  const works = Array.isArray(manifest.employmentWorks) ? manifest.employmentWorks : [];
  const knownFiles = new Set(works
    .filter((work) => typeof work.file === "string")
    .map((work) => work.file.replace(/\\/g, "/").toLowerCase()));
  const ids = new Set(allManifestWorks(manifest).map((work) => work.id).filter(Boolean));
  const files = await findSupportedFiles(employmentDirectory, subjectDirectory, EMPLOYMENT_SUPPORTED);
  const additions = [];

  for (const file of files) {
    const key = file.file.toLowerCase();
    if (knownFiles.has(key)) continue;
    const folders = file.file.split("/").slice(0, -1);
    const compactFilename = file.filename.toLocaleLowerCase().replace(/[^a-z0-9]/g, "");
    const category = Object.entries(EMPLOYMENT_CATEGORY_FOLDERS)
      .find(([, folder]) => folders.includes(folder))?.[0]
      || (compactFilename.includes("companyid") ? "Employment Verification" : "")
      || "Other Supporting Evidence";
    const title = titleFromFilename(file.filename) || "Untitled record";
    const baseId = slugify(title);
    let id = baseId;
    let suffix = 2;
    while (ids.has(id)) id = `${baseId}-${suffix++}`;
    ids.add(id);
    knownFiles.add(key);
    additions.push({ id, title, category, type: file.extension.slice(1), file: file.file });
  }

  if (!additions.length) {
    console.log("Employment scan complete. No new supported documents were found in works/seminars-field-trips/employment-supporting-documents/.");
    return;
  }

  manifest.subject = storedSubject;
  manifest.employmentWorks = [...works, ...additions];
  manifest.activities = Array.isArray(manifest.activities) ? manifest.activities : [];
  await writeManifest(storedSubject, manifest);
  console.log(`Employment scan added ${additions.length} file(s):`);
  for (const work of additions) console.log(`  ${work.title}  |  ${work.category}  |  ${work.type.toUpperCase()}  |  ${work.file}`);
  console.log("Only filenames, categories, and file types were added. No document contents or descriptions were read.");
}

async function main() {
  const command = (process.argv[2] || "").toLowerCase();
  if (command === "--help" || command === "-h") {
    console.log("Usage: node tools/archive-manager.mjs [list [ai|emerging|seminars|employment] | scan ai|seminars|employment | add | edit | remove]");
    return;
  }
  if (command === "scan") {
    const subject = subjectFrom(process.argv[3] || "");
    if (subject === "ai") return scanAiFiles();
    if (subject === "seminars") return scanSeminarFiles();
    if (subject === "employment") return scanEmploymentFiles();
    throw new Error("Use `scan ai`, `scan seminars`, or `scan employment` to sync supported files from the matching collection folders.");
  }
  if (command === "list") return listRecords(process.argv[3] || "");
  if (command && !["add", "edit", "remove"].includes(command)) throw new Error("Unknown command. Use --help for usage.");

  let choice = command;
  while (true) {
    if (!choice) {
      console.log("\nARCHIVE / 026 — LOCAL FILE MANAGER\n1. Add file or link\n2. Edit listing metadata\n3. Remove listing only\n4. List records\n5. Exit");
      choice = await ask("Choose 1–5");
    }
    if (choice === "1" || choice === "add") await addRecord();
    else if (choice === "2" || choice === "edit") await editRecord();
    else if (choice === "3" || choice === "remove") await removeListing();
    else if (choice === "4" || choice === "list") await listRecords();
    else if (choice === "5" || choice === "exit") break;
    else console.log("Choose 1, 2, 3, 4, or 5.");
    if (command) break;
    choice = "";
  }
}

main().catch((error) => {
  console.error(`\nError: ${error.message}`);
  process.exitCode = 1;
}).finally(() => rl.close());
