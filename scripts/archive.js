(() => {
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.body.classList.add("js-ready");

  if (!reducedMotion) {
    document.body.classList.add("is-entering");
    window.setTimeout(() => document.body.classList.remove("is-entering"), 520);
  }

  const menuButton = document.querySelector(".menu-toggle");
  const navigation = document.querySelector(".main-nav");
  if (menuButton && navigation) {
    const closeMenu = () => {
      menuButton.setAttribute("aria-expanded", "false");
      menuButton.setAttribute("aria-label", "Open navigation");
      navigation.classList.remove("is-open");
    };
    menuButton.addEventListener("click", () => {
      const opening = menuButton.getAttribute("aria-expanded") !== "true";
      menuButton.setAttribute("aria-expanded", String(opening));
      menuButton.setAttribute("aria-label", opening ? "Close navigation" : "Open navigation");
      navigation.classList.toggle("is-open", opening);
    });
    navigation.addEventListener("click", (event) => {
      if (event.target.closest("a")) closeMenu();
    });
    document.addEventListener("keydown", (event) => {
      if (event.key === "Escape") closeMenu();
    });
  }

  const revealItems = document.querySelectorAll(".reveal");
  if (!reducedMotion && "IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries, currentObserver) => {
      entries.forEach((entry) => {
        if (entry.isIntersecting) {
          entry.target.classList.add("is-visible");
          currentObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.12 });
    revealItems.forEach((item) => observer.observe(item));
  } else {
    revealItems.forEach((item) => item.classList.add("is-visible"));
  }

  const cursorOrb = document.querySelector(".cursor-orb");
  const finePointer = window.matchMedia("(hover: hover) and (pointer: fine)").matches;
  if (cursorOrb && finePointer && !reducedMotion) {
    document.body.classList.add("has-pointer");
    let cursorFrame = 0;
    window.addEventListener("pointermove", (event) => {
      if (event.pointerType !== "mouse") return;
      if (cursorFrame) cancelAnimationFrame(cursorFrame);
      cursorFrame = requestAnimationFrame(() => {
        cursorOrb.style.left = `${event.clientX}px`;
        cursorOrb.style.top = `${event.clientY}px`;
      });
    }, { passive: true });
    document.addEventListener("pointerover", (event) => {
      document.body.classList.toggle("pointer-over-link", Boolean(event.target.closest("a, button, select")));
    });
  }

  const parallaxTarget = document.querySelector("[data-parallax] svg");
  if (parallaxTarget && finePointer && !reducedMotion) {
    const frame = document.querySelector("[data-parallax]");
    frame.addEventListener("pointermove", (event) => {
      if (event.pointerType !== "mouse") return;
      const bounds = frame.getBoundingClientRect();
      const x = (event.clientX - bounds.left) / bounds.width - .5;
      const y = (event.clientY - bounds.top) / bounds.height - .5;
      parallaxTarget.style.translate = `${(x * 8).toFixed(1)}px ${(y * 8).toFixed(1)}px`;
    }, { passive: true });
    frame.addEventListener("pointerleave", () => { parallaxTarget.style.translate = "0 0"; });
  }

  if (!reducedMotion) {
    document.addEventListener("click", (event) => {
      const link = event.target.closest("a[href]");
      if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
      if (link.target) return;
      const destination = new URL(link.href, window.location.href);
      if (destination.origin !== window.location.origin || destination.pathname === window.location.pathname || destination.hash) return;
      event.preventDefault();
      document.body.classList.add("is-leaving");
      window.setTimeout(() => window.location.assign(destination.href), 150);
    });
  }

  const escapeHTML = (value = "") => String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[character]);

  const subjectKey = document.body.dataset.subject;
  const manifestPath = subjectKey && window.ARCHIVE_MANIFESTS?.[subjectKey];
  if (!subjectKey || !manifestPath) return;

  const list = document.getElementById("document-list");
  const emptyState = document.getElementById("empty-state");
  const searchInput = document.getElementById("work-search");
  const categoryFilter = document.getElementById("category-filter");
  const sortSelect = document.getElementById("work-sort");
  const count = document.getElementById("result-count");
  const timeline = document.getElementById("timeline-list");
  const dialog = document.getElementById("pdf-dialog");
  const employmentList = document.getElementById("employment-document-list");
  const employmentEmptyState = document.getElementById("employment-empty-state");
  const employmentSearchInput = document.getElementById("employment-work-search");
  const employmentCategoryFilter = document.getElementById("employment-category-filter");
  const employmentSortSelect = document.getElementById("employment-work-sort");
  const employmentCount = document.getElementById("employment-result-count");
  const fieldTripList = document.getElementById("field-trip-document-list");
  const supportingList = document.getElementById("supporting-document-list");
  if (!list || !emptyState || !searchInput || !categoryFilter || !sortSelect || !count || !dialog) return;

  const collectionLists = [list, fieldTripList, supportingList].filter(Boolean);
  const archiveGroups = subjectKey === "seminars" ? [
    { key: "seminars", list },
    { key: "field-trips", list: fieldTripList },
    { key: "supporting", list: supportingList }
  ].filter((group) => group.list) : [];

  const categoriesBySubject = {
    ai: ["Laboratory Activities", "Programming Exercises", "Assignments", "Practical Examinations", "Research", "Other"],
    emerging: [
      "Cloud Architecture", "AWS Core Services", "AWS Security",
      "Projects and Practical Applications", "Pricing and Billing"
    ],
    seminars: []
  };
  const categories = categoriesBySubject[subjectKey] || categoriesBySubject.ai;
  let allWorks = [];
  let employmentWorks = [];
  let activities = [];
  let currentPdf = null;
  let currentLoadingTask = null;
  let currentPdfTask = null;
  let viewerToken = 0;
  let currentPage = 1;
  let manualZoom = 1;
  let activeScale = 1;
  let fitWidth = true;
  let pdfjsPromise = null;
  let pageSlots = [];
  let renderObserver = null;
  let visibilityObserver = null;
  let renderQueue = [];
  let activePageRenders = 0;
  let pdfTextCache = [];
  let searchMatches = [];
  let searchCursor = -1;
  let searchQuery = "";
  let searchToken = 0;

  const viewer = dialog.querySelector(".pdf-viewer-shell");
  const viewerBody = document.getElementById("pdf-viewer-body");
  const viewerStatus = document.getElementById("pdf-viewer-status");
  const pageStack = document.getElementById("pdf-page-stack");
  const viewerError = document.getElementById("pdf-viewer-error");
  const errorMessage = document.getElementById("pdf-error-message");
  const fallbackLink = document.getElementById("pdf-fallback-link");
  const imagePreview = document.getElementById("pdf-image-preview");
  const sourcePreview = document.getElementById("source-preview");
  const toolbar = dialog.querySelector(".pdf-toolbar");
  const pageCount = document.getElementById("pdf-page-count");
  const zoomLevel = document.getElementById("pdf-zoom-level");
  const previousButton = document.getElementById("pdf-previous");
  const nextButton = document.getElementById("pdf-next");
  const zoomOutButton = document.getElementById("pdf-zoom-out");
  const zoomInButton = document.getElementById("pdf-zoom-in");
  const fitButton = document.getElementById("pdf-fit-width");
  const fullscreenButton = document.getElementById("pdf-fullscreen");
  const pdfSearchInput = document.getElementById("pdf-search");
  const pdfSearchButton = document.getElementById("pdf-search-run");
  const pdfSearchPrevious = document.getElementById("pdf-search-prev");
  const pdfSearchNext = document.getElementById("pdf-search-next");
  const pdfSearchCount = document.getElementById("pdf-search-count");
  const titleNode = document.getElementById("pdf-dialog-title");
  const closeButton = dialog.querySelector(".pdf-dialog-close");
  const updateFullscreenButton = () => {
    const active = document.fullscreenElement === viewer || dialog.classList.contains("is-fullscreen-fallback");
    fullscreenButton.setAttribute("aria-pressed", String(active));
    fullscreenButton.setAttribute("aria-label", active ? "Exit fullscreen" : "Enter fullscreen");
  };

  const manifestUrl = new URL(manifestPath, document.baseURI);
  const resolveManifestFile = (file) => {
    try { return new URL(file, manifestUrl).href; } catch { return ""; }
  };
  const safeExternalUrl = (value) => {
    if (!value) return "";
    try {
      const url = new URL(value);
      return url.protocol === "https:" || url.protocol === "http:" ? url.href : "";
    } catch { return ""; }
  };
  const getExtension = (path = "") => path.split("?")[0].split("#")[0].split(".").pop()?.toLowerCase() || "";

  const setEmptyState = (kind, message) => {
    if (kind === "collection") {
      emptyState.hidden = true;
      return;
    }
    emptyState.hidden = false;
    emptyState.dataset.empty = kind;
    const heading = emptyState.querySelector(".empty-copy h3");
    const paragraph = emptyState.querySelector(".empty-copy p");
    const code = emptyState.querySelector(".empty-code");
    if (kind === "loading") {
      code.textContent = "CATALOGUE / LOAD";
      heading.textContent = "Loading records.";
      paragraph.textContent = "The subject catalogue is being opened.";
    } else if (kind === "error") {
      code.textContent = "CATALOGUE / ERROR";
      heading.textContent = "The catalogue could not be loaded.";
      paragraph.textContent = message || "Refresh the page and try again.";
    } else if (kind === "filtered") {
      code.textContent = "NO MATCH / 00";
      heading.textContent = "No records match this view.";
      paragraph.textContent = "Try a different search or choose another category to see more of the collection.";
    }
  };

  for (const category of [...new Set([...categories, ...allWorks.map((work) => work.category)])]) {
    if ([...categoryFilter.options].some((option) => option.value.toLowerCase() === category.toLowerCase())) continue;
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    categoryFilter.append(option);
  }

  const normalizeWork = (work, fallbackCategory = categories[0] || "Supporting Documents") => {
    const file = typeof work.file === "string" ? work.file : "";
    const type = String(work.type || getExtension(file)).toLowerCase();
    return {
      ...work,
      type,
      category: String(work.category || fallbackCategory),
      fileUrl: file ? resolveManifestFile(file) : "",
      externalUrl: safeExternalUrl(work.externalUrl)
    };
  };

  const renderAiArtifactDetails = (work, filename) => {
    const reflection = work.reflection && typeof work.reflection === "object" ? work.reflection : {};
    const fields = [];
    if (String(work.description || "").trim()) fields.push(["Description / purpose", work.description]);
    if (String(reflection.learning || "").trim()) fields.push(["What I learned", reflection.learning]);
    if (String(reflection.challenges || "").trim()) fields.push(["Challenges encountered", reflection.challenges]);
    if (String(reflection.goalConnection || "").trim()) fields.push(["Connection to goals", reflection.goalConnection]);
    if (work.fileUrl) {
      fields.push(["Supporting evidence", `<a href="${escapeHTML(work.fileUrl)}" target="_blank" rel="noopener noreferrer">${escapeHTML(filename)}</a>`, true]);
    }
    if (!fields.length) return "";
    return `<details class="ai-artifact-details">
      <summary>Artifact details</summary>
      <dl class="ai-field-list">
        ${fields.map(([label, value, isHtml]) => `<div><dt>${escapeHTML(label)}</dt><dd>${isHtml ? value : escapeHTML(value).replace(/\n/g, "<br>")}</dd></div>`).join("")}
      </dl>
    </details>`;
  };

  const renderEmergingArtifactDetails = (work, filename) => {
    const fields = [];
    if (String(work.description || "").trim()) fields.push(["Description", work.description]);
    if (work.fileUrl) {
      fields.push(["Supporting evidence", `<a href="${escapeHTML(work.fileUrl)}" target="_blank" rel="noopener noreferrer">${escapeHTML(filename)}</a>`, true]);
    }
    if (!fields.length) return "";
    return `<details class="et-artifact-details">
      <summary>Artifact details</summary>
      <dl class="et-field-list">
        ${fields.map(([label, value, isHtml]) => `<div><dt>${escapeHTML(label)}</dt><dd>${isHtml ? value : escapeHTML(value).replace(/\n/g, "<br>")}</dd></div>`).join("")}
      </dl>
    </details>`;
  };

  const makeDocumentRow = (work, options = {}) => {
    const title = escapeHTML(work.title || "");
    const category = escapeHTML(work.category);
    const format = escapeHTML(work.type ? work.type.toUpperCase() : "LINK");
    const filename = work.file?.split("/").pop() || work.title || "";
    const date = options.showDate === false || !work.date
      ? ""
      : `<time datetime="${escapeHTML(work.date)}">${escapeHTML(work.date)}</time>`;
    const filenameFact = options.showFilename && work.file ? `<span class="document-filename">FILE ${escapeHTML(filename)}</span>` : "";
    const tag = escapeHTML(options.tag || (subjectKey === "ai" ? "AI—II" : subjectKey === "emerging" ? "ET—026" : "SFT—026"));
    let openAction = "";
    if (work.fileUrl && work.type === "pdf") {
      openAction = `<button class="document-open" type="button" data-preview-url="${escapeHTML(work.fileUrl)}" data-preview-kind="pdf" data-preview-title="${title}" data-preview-name="${escapeHTML(filename)}">Open Document <span aria-hidden="true">↗</span></button>`;
    } else if (work.fileUrl && ["ai", "seminars"].includes(subjectKey) && ["png", "jpg", "jpeg"].includes(work.type)) {
      openAction = `<button class="document-open" type="button" data-preview-url="${escapeHTML(work.fileUrl)}" data-preview-kind="image" data-preview-title="${title}" data-preview-name="${escapeHTML(filename)}">Open Image <span aria-hidden="true">↗</span></button>`;
    } else if (work.fileUrl && subjectKey === "ai" && ["py", "ipynb"].includes(work.type)) {
      const previewKind = work.type === "py" ? "code" : "notebook";
      const previewLabel = work.type === "py" ? "Open Code" : "Open Notebook";
      openAction = `<button class="document-open" type="button" data-preview-url="${escapeHTML(work.fileUrl)}" data-preview-kind="${previewKind}" data-preview-title="${title}" data-preview-name="${escapeHTML(filename)}">${previewLabel} <span aria-hidden="true">↗</span></button>`;
    } else if (work.fileUrl) {
      openAction = `<a class="document-open" href="${escapeHTML(work.fileUrl)}" target="_blank" rel="noopener noreferrer">Open Document <span aria-hidden="true">↗</span></a>`;
    } else if (work.externalUrl) {
      openAction = `<a class="document-open" href="${escapeHTML(work.externalUrl)}" target="_blank" rel="noopener noreferrer">Open Document <span aria-hidden="true">↗</span></a>`;
    }
    const artifactDetails = subjectKey === "ai"
      ? renderAiArtifactDetails(work, filename)
      : subjectKey === "emerging" ? renderEmergingArtifactDetails(work, filename) : "";
    const isImage = ["png", "jpg", "jpeg"].includes(work.type);
    const iconKind = work.type === "pdf" ? "is-pdf" : work.type === "py" ? "is-code" : work.type === "ipynb" ? "is-notebook" : isImage ? "is-image" : "";
    const iconLabel = work.type === "pdf" ? "PDF" : work.type === "py" ? "PY" : work.type === "ipynb" ? "NB" : isImage ? "IMG" : format.slice(0, 3);
    const subjectRowClass = subjectKey === "ai" ? " ai-document-row" : subjectKey === "emerging" ? " et-document-row" : "";
    return `<article class="document-row${subjectRowClass}">
      <span class="document-file-icon ${iconKind}" aria-hidden="true"><span>${iconLabel}</span></span>
      <div class="document-main"><h3>${title}</h3><div class="document-facts"><span class="document-category">${category}</span><span class="document-type">${format}</span>${date}${filenameFact}</div></div>
      <span class="document-code" aria-hidden="true">${tag}</span>
      <div class="document-actions">${openAction}</div>
      ${artifactDetails}
    </article>`;
  };

  const sortWorks = (works, control = sortSelect) => {
    const mode = control.value;
    return works.sort((a, b) => {
      if (mode.startsWith("date")) {
        if (!a.date && b.date) return 1;
        if (a.date && !b.date) return -1;
        const dateOrder = String(a.date || "").localeCompare(String(b.date || ""));
        if (dateOrder) return mode === "date-desc" ? -dateOrder : dateOrder;
      }
      return String(a.title || "").localeCompare(String(b.title || ""), undefined, { sensitivity: "base" });
    });
  };

  const archiveGroupFor = (work) => {
    const category = String(work.category || "").trim().toLocaleLowerCase();
    if (category === "seminars") return "seminars";
    if (category === "field trips") return "field-trips";
    return "supporting";
  };

  const renderWorks = () => {
    const query = searchInput.value.trim().toLocaleLowerCase();
    const selectedCategory = categoryFilter.value.toLocaleLowerCase();
    const filtered = allWorks.filter((work) => {
      const matchesCategory = selectedCategory === "all" || work.category.toLocaleLowerCase() === selectedCategory;
      const reflection = work.reflection && typeof work.reflection === "object" ? work.reflection : {};
      const aiMetadata = subjectKey === "ai" ? Object.values(reflection) : [];
      const searchable = [work.title, work.description, work.category, work.date, work.file?.split("/").pop(), ...(work.tags || []), ...aiMetadata].join(" ").toLocaleLowerCase();
      return matchesCategory && (!query || searchable.includes(query));
    });
    if (subjectKey === "seminars") {
      const sorted = sortWorks([...filtered], sortSelect);
      archiveGroups.forEach((group) => {
        const groupedWorks = sorted.filter((work) => archiveGroupFor(work) === group.key);
        group.list.innerHTML = groupedWorks.map((work) => makeDocumentRow(work, {
          showFilename: ["png", "jpg", "jpeg"].includes(work.type)
        })).join("");
      });
    } else {
      list.innerHTML = sortWorks(filtered, sortSelect).map((work) => makeDocumentRow(work)).join("");
    }
    count.textContent = `${filtered.length} ${filtered.length === 1 ? "RECORD" : "RECORDS"}`;
    if (filtered.length) emptyState.hidden = true;
    else if (allWorks.length) setEmptyState("filtered");
    else setEmptyState("collection");
  };

  const setEmploymentEmptyState = (kind) => {
    if (!employmentEmptyState) return;
    if (kind === "collection") {
      employmentEmptyState.hidden = true;
      return;
    }
    employmentEmptyState.hidden = false;
    employmentEmptyState.dataset.empty = kind;
    const heading = employmentEmptyState.querySelector(".empty-copy h3");
    const paragraph = employmentEmptyState.querySelector(".empty-copy p");
    const code = employmentEmptyState.querySelector(".empty-code");
    if (kind === "loading") {
      code.textContent = "EMPLOYMENT / LOAD";
      heading.textContent = "Loading employment records.";
      paragraph.textContent = "The supporting document list is being opened.";
    } else if (kind === "error") {
      code.textContent = "EMPLOYMENT / ERROR";
      heading.textContent = "Employment records could not be loaded.";
      paragraph.textContent = "Refresh the page and try again.";
    } else if (kind === "filtered") {
      code.textContent = "NO MATCH / 00";
      heading.textContent = "No employment records match this view.";
      paragraph.textContent = "Try another file name or choose a different category.";
    }
  };

  const renderEmploymentWorks = () => {
    if (!employmentList || !employmentEmptyState || !employmentSearchInput || !employmentCategoryFilter || !employmentSortSelect || !employmentCount) return;
    const query = employmentSearchInput.value.trim().toLocaleLowerCase();
    const selectedCategory = employmentCategoryFilter.value.toLocaleLowerCase();
    const filtered = employmentWorks.filter((work) => {
      const matchesCategory = selectedCategory === "all" || work.category.toLocaleLowerCase() === selectedCategory;
      const searchable = [work.title, work.category, work.type, work.file?.split("/").pop(), ...(work.tags || [])].join(" ").toLocaleLowerCase();
      return matchesCategory && (!query || searchable.includes(query));
    });
    employmentList.innerHTML = sortWorks(filtered, employmentSortSelect)
      .map((work) => makeDocumentRow(work, { tag: "EMP—DOCS", showFilename: true }))
      .join("");
    employmentCount.textContent = `${filtered.length} ${filtered.length === 1 ? "RECORD" : "RECORDS"}`;
    if (filtered.length) employmentEmptyState.hidden = true;
    else if (employmentWorks.length) setEmploymentEmptyState("filtered");
    else setEmploymentEmptyState("collection");
  };

  const renderActivities = () => {
    if (!timeline) return;
    const timelineSection = timeline.closest(".timeline-section");
    if (!timelineSection) return;
    const workActivities = allWorks
      .filter((work) => subjectKey === "seminars"
        ? Boolean(work.date) && ["seminars", "field trips", "event documentation"].includes(work.category.toLocaleLowerCase())
        : subjectKey === "ai"
          ? ["activities", "laboratory activities", "programming exercises"].includes(work.category.toLocaleLowerCase())
          : work.category.toLocaleLowerCase() === "activities")
      .map((work) => ({ id: work.id, title: work.title, description: work.description || "", date: work.date || "" }));
    const activityMap = new Map();
    [...activities, ...workActivities].forEach((activity) => {
      const key = activity.id || `${activity.date || ""}|${activity.title || ""}`;
      if (!activityMap.has(key)) activityMap.set(key, activity);
    });
    const sorted = [...activityMap.values()]
      .filter((activity) => activity && activity.title)
      .sort((a, b) => String(b.date || "").localeCompare(String(a.date || "")));
    if (!sorted.length) {
      timeline.replaceChildren();
      timelineSection.hidden = true;
      return;
    }
    timelineSection.hidden = false;
    timeline.innerHTML = sorted.map((activity) => {
      const date = activity.date ? `<time class="timeline-date" datetime="${escapeHTML(activity.date)}">${escapeHTML(activity.date)}</time>` : "";
      const description = activity.description ? `<p>${escapeHTML(activity.description)}</p>` : "";
      return `<article class="timeline-item">${date}<div class="timeline-body"><h3>${escapeHTML(activity.title)}</h3>${description}</div><span class="timeline-mark" aria-hidden="true"></span></article>`;
    }).join("");
  };

  const renderAiPortfolio = (manifest) => {
    if (subjectKey !== "ai") return;
    const course = manifest.course && typeof manifest.course === "object" ? manifest.course : {};
    const aboutMe = manifest.aboutMe && typeof manifest.aboutMe === "object" ? manifest.aboutMe : {};
    const finalProject = manifest.finalProject && typeof manifest.finalProject === "object" ? manifest.finalProject : {};
    const setText = (id, value) => {
      const element = document.getElementById(id);
      if (!element) return;
      const text = String(value || "").trim();
      if (!text) {
        element.closest(".ai-about-field")?.remove();
        return;
      }
      element.textContent = text;
    };
    const setList = (id, values) => {
      const element = document.getElementById(id);
      if (!element) return;
      const items = Array.isArray(values) ? values.filter((value) => value && String(value).trim()) : [];
      if (!items.length) {
        element.closest(".ai-about-field")?.remove();
        return;
      }
      element.innerHTML = items.map((value) => `<li>${escapeHTML(value)}</li>`).join("");
    };
    const evidenceList = (items) => {
      const records = Array.isArray(items) ? items : [];
      const links = records.map((item) => {
        if (!item || typeof item !== "object") return "";
        const href = item.file ? resolveManifestFile(item.file) : safeExternalUrl(item.url);
        if (!href) return "";
        const label = item.title || item.file?.split("/").pop() || href;
        return `<li><a href="${escapeHTML(href)}" target="_blank" rel="noopener noreferrer">${escapeHTML(label)}</a></li>`;
      }).filter(Boolean);
      return links.join("");
    };
    const recordFields = (fields) => {
      const populatedFields = fields.filter(([, value]) => String(value || "").trim());
      if (!populatedFields.length) return "";
      return `<dl class="ai-record-fields">${populatedFields.map(([label, value]) => `
        <div><dt>${escapeHTML(label)}</dt><dd>${escapeHTML(value).replace(/\n/g, "<br>")}</dd></div>`).join("")}
      </dl>`;
    };
    const renderRecords = (id, records, renderRecord) => {
      const element = document.getElementById(id);
      if (!element) return;
      const entries = Array.isArray(records) ? records.filter((record) => record && typeof record === "object") : [];
      const rendered = entries.map(renderRecord).filter(Boolean);
      element.innerHTML = rendered.length ? `<div class="ai-entry-list">${rendered.join("")}</div>` : "";
      const section = element.closest("section");
      if (section) section.hidden = !rendered.length;
    };
    setText("ai-course-title", course.title);
    setText("ai-student-name", course.studentName);
    setText("ai-program", course.program);
    setText("ai-course-code", course.courseCode);
    setText("ai-school-year", course.academicYear);
    setText("ai-semester", course.semester);
    setText("ai-about-name", course.studentName);
    setText("ai-about-program", course.program);
    setText("ai-about-introduction", aboutMe.introduction);
    setList("ai-about-interests", aboutMe.interests);

    renderRecords("ai-achievements-list", manifest.achievements, (entry) => {
      const title = String(entry.title || entry.name || "").trim();
      if (!title) return "";
      const fields = [
        ["Type", entry.type],
        ["Issuing organization", entry.issuer],
        ["Completion date", entry.date],
        ["Description", entry.description]
      ];
      const evidence = evidenceList(entry.evidence);
      const evidenceFields = evidence
        ? `<dl class="ai-record-fields"><div><dt>Supporting evidence</dt><dd><ul>${evidence}</ul></dd></div></dl>`
        : "";
      return `<article class="ai-record"><h3>${escapeHTML(title)}</h3>${recordFields(fields)}${evidenceFields}</article>`;
    });

    renderRecords("ai-skills-list", manifest.skills, (entry) => {
      const title = String(entry.name || "").trim();
      if (!title) return "";
      const fields = [
        ["Skill area", entry.category],
        ["Evidence summary", entry.selfAssessment]
      ];
      const evidence = evidenceList(entry.evidence);
      const evidenceFields = evidence
        ? `<dl class="ai-record-fields"><div><dt>Supporting evidence</dt><dd><ul>${evidence}</ul></dd></div></dl>`
        : "";
      return `<article class="ai-record"><h3>${escapeHTML(title)}</h3>${recordFields(fields)}${evidenceFields}</article>`;
    });

    const finalTitle = document.getElementById("ai-final-title");
    if (finalTitle) finalTitle.textContent = String(finalProject.title || "").trim();
    const finalFields = document.getElementById("ai-final-project-fields");
    if (finalFields) {
      const rows = [
        ["Description", finalProject.description],
        ["Objectives", finalProject.objectives],
        ["Technologies", finalProject.technologies],
        ["Contribution", finalProject.contribution],
        ["Challenge", finalProject.challenge],
        ["Learning and reflection", finalProject.reflection],
        ["Results", finalProject.results]
      ].filter(([, value]) => Array.isArray(value)
        ? value.some((item) => item && String(item).trim())
        : String(value || "").trim());
      finalFields.innerHTML = rows.map(([label, value]) => {
        const content = Array.isArray(value)
          ? `<ul>${value.filter((item) => item && String(item).trim()).map((item) => `<li>${escapeHTML(item)}</li>`).join("")}</ul>`
          : escapeHTML(value).replace(/\n/g, "<br>");
        return `<div><dt>${escapeHTML(label)}</dt><dd>${content}</dd></div>`;
      }).join("");
    }
  };

  const renderEmergingPortfolio = (manifest) => {
    if (subjectKey !== "emerging") return;
    const course = manifest.course && typeof manifest.course === "object" ? manifest.course : {};
    const aboutMe = manifest.aboutMe && typeof manifest.aboutMe === "object" ? manifest.aboutMe : {};
    const finalProject = manifest.finalProject && typeof manifest.finalProject === "object" ? manifest.finalProject : {};
    const setText = (id, value) => {
      const element = document.getElementById(id);
      if (!element) return;
      const text = String(value || "").trim();
      if (!text) {
        (element.closest(".et-about-field, .et-course-facts div") || element).remove();
        return;
      }
      element.textContent = text;
    };
    const setList = (id, values) => {
      const element = document.getElementById(id);
      if (!element) return;
      const items = Array.isArray(values) ? values.filter((value) => value && String(value).trim()) : [];
      if (!items.length) {
        element.closest(".et-about-field")?.remove();
        return;
      }
      element.innerHTML = items.map((value) => `<li>${escapeHTML(value)}</li>`).join("");
    };
    const evidenceList = (items) => {
      const records = Array.isArray(items) ? items : [];
      return records.map((item) => {
        if (!item || typeof item !== "object") return "";
        const href = item.file ? resolveManifestFile(item.file) : safeExternalUrl(item.url);
        if (!href) return "";
        const label = item.title || item.file?.split("/").pop() || href;
        return `<li><a href="${escapeHTML(href)}" target="_blank" rel="noopener noreferrer">${escapeHTML(label)}</a></li>`;
      }).filter(Boolean).join("");
    };
    const renderFieldRows = (fields) => {
      const rows = fields.filter(([, value]) => Array.isArray(value)
        ? value.some((item) => item && String(item).trim())
        : String(value || "").trim());
      return rows.map(([label, value]) => {
        const content = Array.isArray(value)
          ? `<ul>${value.filter((item) => item && String(item).trim()).map((item) => `<li>${escapeHTML(item)}</li>`).join("")}</ul>`
          : escapeHTML(value).replace(/\n/g, "<br>");
        return `<div><dt>${escapeHTML(label)}</dt><dd>${content}</dd></div>`;
      }).join("");
    };
    const recordFields = (fields) => {
      const rows = renderFieldRows(fields);
      return rows ? `<dl class="et-record-fields">${rows}</dl>` : "";
    };

    setText("et-course-title", course.title);
    setText("et-course-code", course.courseCode);
    setText("et-student-name", course.studentName);
    setText("et-program", course.program);
    setText("et-about-name", course.studentName);
    setText("et-about-program", course.program);
    setText("et-about-introduction", aboutMe.introduction);
    setList("et-about-interests", aboutMe.interests);

    const skillsList = document.getElementById("et-skills-list");
    const skills = Array.isArray(manifest.skills) ? manifest.skills : [];
    if (skillsList) {
      const records = skills.map((entry) => {
        const title = String(entry?.name || "").trim();
        if (!title) return "";
        const fields = [
          ["Skill area", entry.category],
          ["Evidence summary", entry.description]
        ];
        const evidence = evidenceList(entry.evidence);
        const evidenceFields = evidence
          ? `<dl class="et-record-fields"><div><dt>Supporting evidence</dt><dd><ul>${evidence}</ul></dd></div></dl>`
          : "";
        return `<article class="et-record"><h4>${escapeHTML(title)}</h4>${recordFields(fields)}${evidenceFields}</article>`;
      }).filter(Boolean);
      skillsList.innerHTML = records.length ? `<div class="et-entry-list">${records.join("")}</div>` : "";
      const section = skillsList.closest(".et-skills-list-section");
      if (section) section.hidden = !records.length;
    }

    const finalSection = document.getElementById("final-project");
    const finalTitle = document.getElementById("et-final-title");
    const title = String(finalProject.title || "").trim();
    if (finalTitle) finalTitle.textContent = title;
    if (finalSection) finalSection.hidden = !title;
    const subtitle = document.getElementById("et-final-subtitle");
    if (subtitle) {
      const text = String(finalProject.subtitle || "").trim();
      subtitle.textContent = text;
      subtitle.hidden = !text;
    }
    const finalFields = document.getElementById("et-final-fields");
    if (finalFields) {
      const rows = [
        ["Description", finalProject.description],
        ["Objectives", finalProject.objectives],
        ["Technologies", finalProject.technologies],
        ["Personal contribution", finalProject.contribution],
        ["Challenge", finalProject.challenge],
        ["Learning and reflection", finalProject.reflection],
        ["Results", finalProject.results],
        ["Cost estimate", finalProject.costEstimate]
      ];
      finalFields.innerHTML = renderFieldRows(rows);
    }

    const finalEvidence = document.getElementById("et-final-evidence");
    if (finalEvidence) {
      const evidence = evidenceList(finalProject.evidence);
      finalEvidence.innerHTML = evidence ? `<span>Supporting evidence</span><ul>${evidence}</ul>` : "";
      finalEvidence.hidden = !evidence;
    }
    const folderLink = document.querySelector(".et-final-actions .final-project-link:not(.et-demo-link)");
    const folderUrl = safeExternalUrl(finalProject.folderUrl);
    if (folderLink) {
      if (folderUrl) folderLink.href = folderUrl;
      else folderLink.hidden = true;
    }
    const demoLink = document.getElementById("et-demo-link");
    const demoUrl = safeExternalUrl(finalProject.demonstrationVideoUrl);
    if (demoLink) {
      if (demoUrl) demoLink.href = demoUrl;
      else demoLink.hidden = true;
    }
  };

  const PDFJS_VERSION = "6.5.438";
  const PDFJS_BASE = `https://cdn.jsdelivr.net/npm/pdfjs-dist@${PDFJS_VERSION}/`;
  const loadPdfJs = () => {
    if (!pdfjsPromise) {
      pdfjsPromise = import(`${PDFJS_BASE}build/pdf.mjs`).then((library) => {
        library.GlobalWorkerOptions.workerSrc = `${PDFJS_BASE}build/pdf.worker.mjs`;
        return library;
      });
    }
    return pdfjsPromise;
  };

  const updateToolbar = () => {
    const pageTotal = currentPdf?.numPages || 0;
    pageCount.textContent = pageTotal ? `${currentPage} / ${pageTotal}` : "— / —";
    previousButton.disabled = !pageTotal || currentPage <= 1;
    nextButton.disabled = !pageTotal || currentPage >= pageTotal;
    zoomOutButton.disabled = !pageTotal;
    zoomInButton.disabled = !pageTotal;
    fitButton.disabled = !pageTotal;
    zoomLevel.textContent = `${Math.round(activeScale * 100)}%`;
    if (!pageTotal) {
      pdfSearchButton.disabled = true;
      pdfSearchPrevious.disabled = true;
      pdfSearchNext.disabled = true;
    } else {
      pdfSearchButton.disabled = false;
      pdfSearchPrevious.disabled = !searchMatches.length;
      pdfSearchNext.disabled = !searchMatches.length;
    }
  };

  const setPageLoading = (slot) => {
    slot.status.hidden = false;
    slot.status.textContent = `PAGE ${String(slot.number).padStart(2, "0")} / READY TO LOAD`;
    slot.canvas.hidden = true;
    slot.canvas.width = 0;
    slot.canvas.height = 0;
    slot.canvas.style.width = "";
    slot.canvas.style.height = "";
    slot.element.style.width = "";
    slot.element.style.aspectRatio = "var(--pdf-page-ratio)";
    slot.rendered = false;
    slot.error = false;
  };

  const queuePageRender = (slot) => {
    if (!currentPdf || !slot || slot.rendered || slot.rendering || slot.queued || slot.error || !slot.nearViewport) return;
    slot.queued = true;
    renderQueue.push(slot);
    pumpRenderQueue();
  };

  const renderPageSlot = async (slot) => {
    if (!currentPdf || slot.documentToken !== viewerToken) return;
    const token = viewerToken;
    slot.status.hidden = false;
    slot.status.textContent = `LOADING PAGE ${String(slot.number).padStart(2, "0")}`;
    try {
      const page = await currentPdf.getPage(slot.number);
      if (token !== viewerToken || !currentPdf || !slot.nearViewport) return;
      if (!pdfTextCache[slot.number - 1]) {
        const textContent = await page.getTextContent();
        if (token !== viewerToken || !currentPdf || !slot.nearViewport) return;
        const text = textContent.items.map((item) => item.str || "").join(" ");
        pdfTextCache[slot.number - 1] = { text, lower: text.toLocaleLowerCase() };
      }
      slot.accessibleText.textContent = `Page ${slot.number} of ${currentPdf.numPages}. ${pdfTextCache[slot.number - 1].text}`;
      const naturalViewport = page.getViewport({ scale: 1 });
      const availableWidth = Math.max(240, viewerBody.clientWidth - 48);
      const scale = fitWidth ? Math.min(3, availableWidth / naturalViewport.width) : manualZoom;
      const viewport = page.getViewport({ scale });
      if (slot.number === currentPage) activeScale = scale;
      slot.element.style.width = `${Math.ceil(viewport.width)}px`;
      slot.element.style.aspectRatio = "auto";
      slot.canvas.width = Math.ceil(viewport.width * Math.min(window.devicePixelRatio || 1, 2));
      slot.canvas.height = Math.ceil(viewport.height * Math.min(window.devicePixelRatio || 1, 2));
      slot.canvas.style.width = `${Math.ceil(viewport.width)}px`;
      slot.canvas.style.height = `${Math.ceil(viewport.height)}px`;
      slot.canvas.setAttribute("aria-label", `PDF page ${slot.number} of ${currentPdf.numPages}`);
      slot.canvas.hidden = false;
      slot.status.hidden = true;
      const outputScale = Math.min(window.devicePixelRatio || 1, 2);
      const renderTask = page.render({
        canvasContext: slot.canvas.getContext("2d", { alpha: false }),
        viewport,
        transform: outputScale === 1 ? null : [outputScale, 0, 0, outputScale, 0, 0]
      });
      slot.renderTask = renderTask;
      await renderTask.promise;
      if (token !== viewerToken) return;
      slot.rendered = true;
      updateToolbar();
    } catch (error) {
      if (error?.name === "RenderingCancelledException") return;
      if (token === viewerToken) {
        slot.error = true;
        slot.canvas.hidden = true;
        slot.status.hidden = false;
        slot.status.textContent = `PAGE ${String(slot.number).padStart(2, "0")} COULD NOT BE RENDERED`;
      }
    } finally {
      slot.renderTask = null;
    }
  };

  const pumpRenderQueue = () => {
    while (currentPdf && activePageRenders < 2 && renderQueue.length) {
      const slot = renderQueue.shift();
      slot.queued = false;
      if (!slot.nearViewport || slot.rendered || slot.rendering || slot.error || slot.documentToken !== viewerToken) continue;
      slot.rendering = true;
      activePageRenders += 1;
      renderPageSlot(slot).finally(() => {
        slot.rendering = false;
        activePageRenders = Math.max(0, activePageRenders - 1);
        if (slot.pendingRerender) {
          slot.pendingRerender = false;
          if (slot.nearViewport && slot.documentToken === viewerToken) {
            if (slot.rendered) setPageLoading(slot);
            queuePageRender(slot);
          }
        } else if (slot.nearViewport && !slot.rendered && !slot.error && slot.documentToken === viewerToken) {
          queuePageRender(slot);
        }
        pumpRenderQueue();
      });
    }
  };

  const evictDistantPages = () => {
    pageSlots.forEach((slot) => {
      if (Math.abs(slot.number - currentPage) <= 3 || slot.nearViewport || (!slot.rendered && !slot.rendering)) return;
      if (slot.renderTask) {
        slot.pendingRerender = false;
        try { slot.renderTask.cancel(); } catch { /* An already finished page needs no action. */ }
      }
      setPageLoading(slot);
    });
  };

  const observePageStack = () => {
    renderObserver?.disconnect();
    visibilityObserver?.disconnect();
    renderObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const slot = pageSlots[Number(entry.target.dataset.page) - 1];
        if (!slot) return;
        slot.nearViewport = entry.isIntersecting;
        if (entry.isIntersecting) queuePageRender(slot);
      });
      pumpRenderQueue();
    }, { root: viewerBody, rootMargin: "950px 0px", threshold: 0 });
    visibilityObserver = new IntersectionObserver((entries) => {
      entries.forEach((entry) => {
        const slot = pageSlots[Number(entry.target.dataset.page) - 1];
        if (slot) {
          slot.visible = entry.isIntersecting;
          slot.visibilityRatio = entry.intersectionRatio;
        }
      });
      const visible = pageSlots.filter((slot) => slot.visible).sort((a, b) => b.visibilityRatio - a.visibilityRatio)[0];
      if (visible && visible.number !== currentPage) {
        currentPage = visible.number;
        updateToolbar();
      }
      evictDistantPages();
    }, { root: viewerBody, threshold: [0, .15, .5, .85] });
    pageSlots.forEach((slot) => {
      renderObserver.observe(slot.element);
      visibilityObserver.observe(slot.element);
    });
  };

  const createPageStack = async (token) => {
    const firstPage = await currentPdf.getPage(1);
    if (token !== viewerToken) return;
    const dimensions = firstPage.getViewport({ scale: 1 });
    const placeholderWidth = Math.max(240, viewerBody.clientWidth - 48);
    const fragment = document.createDocumentFragment();
    pageSlots = [];
    for (let number = 1; number <= currentPdf.numPages; number += 1) {
      const element = document.createElement("section");
      element.className = "pdf-page-shell";
      element.dataset.page = String(number);
      element.setAttribute("aria-label", `Page ${number}`);
      element.style.setProperty("--pdf-placeholder-width", `${placeholderWidth}px`);
      element.style.setProperty("--pdf-page-ratio", `${dimensions.width} / ${dimensions.height}`);
      const status = document.createElement("p");
      status.className = "pdf-page-placeholder";
      status.textContent = `PAGE ${String(number).padStart(2, "0")} / READY TO LOAD`;
      const pageCanvas = document.createElement("canvas");
      pageCanvas.className = "pdf-page-canvas";
      pageCanvas.setAttribute("role", "img");
      pageCanvas.setAttribute("aria-label", `PDF page ${number} of ${currentPdf.numPages}`);
      pageCanvas.hidden = true;
      const accessibleText = document.createElement("div");
      accessibleText.className = "sr-only";
      element.append(status, pageCanvas, accessibleText);
      fragment.append(element);
      pageSlots.push({
        number,
        element,
        status,
        canvas: pageCanvas,
        accessibleText,
        rendered: false,
        rendering: false,
        queued: false,
        nearViewport: false,
        visible: false,
        visibilityRatio: 0,
        error: false,
        renderTask: null,
        documentToken: token,
        pendingRerender: false
      });
    }
    pageStack.replaceChildren(fragment);
    pageStack.hidden = false;
    viewerStatus.hidden = true;
    observePageStack();
    currentPage = 1;
    const firstSlot = pageSlots[0];
    firstSlot.nearViewport = true;
    queuePageRender(firstSlot);
    updateToolbar();
  };

  const rerenderNearbyPages = () => {
    pageSlots.forEach((slot) => {
      if (!slot.nearViewport && Math.abs(slot.number - currentPage) > 2) return;
      slot.error = false;
      if (slot.rendering) {
        slot.pendingRerender = true;
        if (slot.renderTask) {
          try { slot.renderTask.cancel(); } catch { /* The page may have finished between checks. */ }
        }
        return;
      }
      if (slot.renderTask) {
        slot.pendingRerender = true;
        try { slot.renderTask.cancel(); } catch { /* The page may have finished between checks. */ }
      } else if (slot.rendered) {
        setPageLoading(slot);
        slot.nearViewport = true;
        queuePageRender(slot);
      } else {
        slot.nearViewport = true;
        queuePageRender(slot);
      }
    });
  };

  const goToPage = (number) => {
    if (!currentPdf) return;
    currentPage = Math.min(currentPdf.numPages, Math.max(1, number));
    const slot = pageSlots[currentPage - 1];
    if (slot) {
      slot.nearViewport = true;
      queuePageRender(slot);
      slot.element.scrollIntoView({ behavior: reducedMotion ? "auto" : "smooth", block: "start" });
    }
    updateToolbar();
  };

  const resetViewer = () => {
    viewerToken += 1;
    searchToken += 1;
    renderObserver?.disconnect();
    visibilityObserver?.disconnect();
    renderObserver = null;
    visibilityObserver = null;
    pageSlots.forEach((slot) => {
      if (slot.renderTask) {
        try { slot.renderTask.cancel(); } catch { /* Closing an already rendered page needs no action. */ }
      }
      slot.canvas.width = 0;
      slot.canvas.height = 0;
    });
    renderQueue = [];
    pageStack.replaceChildren();
    pageStack.hidden = true;
    pageSlots = [];
    if (currentLoadingTask) {
      const oldTask = currentLoadingTask;
      currentLoadingTask = null;
      try { Promise.resolve(oldTask.destroy?.()).catch(() => {}); } catch { /* A closed loading task needs no further cleanup. */ }
    }
    if (document.fullscreenElement === viewer) {
      try { Promise.resolve(document.exitFullscreen?.()).catch(() => {}); } catch { /* The viewer is closing. */ }
    }
    if (currentPdf) {
      currentPdf = null;
    }
    if (currentPdfTask) {
      const oldPdfTask = currentPdfTask;
      currentPdfTask = null;
      try { Promise.resolve(oldPdfTask.destroy?.()).catch(() => {}); } catch { /* A closed PDF needs no further cleanup. */ }
    }
    dialog.classList.remove("is-fullscreen-fallback");
    updateFullscreenButton();
    imagePreview.hidden = true;
    imagePreview.removeAttribute("src");
    if (sourcePreview) {
      sourcePreview.hidden = true;
      sourcePreview.replaceChildren();
    }
    viewerStatus.hidden = false;
    viewerStatus.textContent = "Choose a document to open it here.";
    viewerError.hidden = true;
    toolbar.hidden = false;
    pageCount.textContent = "— / —";
    zoomLevel.textContent = "100%";
    previousButton.disabled = true;
    nextButton.disabled = true;
    zoomOutButton.disabled = true;
    zoomInButton.disabled = true;
    fitButton.disabled = true;
    pdfSearchInput.value = "";
    pdfSearchCount.textContent = "SEARCH TEXT";
    pdfSearchButton.disabled = true;
    pdfSearchPrevious.disabled = true;
    pdfSearchNext.disabled = true;
    pdfTextCache = [];
    searchMatches = [];
    searchCursor = -1;
    searchQuery = "";
    currentPage = 1;
    activeScale = 1;
    manualZoom = 1;
    fitWidth = true;
  };

  const showViewerError = (message) => {
    viewerStatus.hidden = true;
    pageStack.hidden = true;
    imagePreview.hidden = true;
    if (sourcePreview) sourcePreview.hidden = true;
    errorMessage.textContent = message;
    viewerError.hidden = false;
  };

  const showDialog = () => {
    if (typeof dialog.showModal === "function") dialog.showModal();
    else dialog.setAttribute("open", "");
  };

  const openPreview = async (url, kind, title, filename) => {
    resetViewer();
    const token = viewerToken;
    const previewTitles = { pdf: "PDF READER", image: "IMAGE PREVIEW", code: "PYTHON SOURCE", notebook: "JUPYTER NOTEBOOK" };
    titleNode.textContent = `${title} / ${previewTitles[kind] || "FILE PREVIEW"}`;
    fallbackLink.href = url;
    fallbackLink.textContent = kind === "pdf" ? "Open original PDF" : "Open original file";
    showDialog();

    if (kind === "image") {
      toolbar.hidden = true;
      imagePreview.alt = title;
      imagePreview.onload = () => { if (token === viewerToken) viewerStatus.hidden = true; };
      imagePreview.onerror = () => { if (token === viewerToken) showViewerError("This image could not be opened in the preview."); };
      imagePreview.src = url;
      imagePreview.hidden = false;
      viewerStatus.textContent = "Loading image preview…";
      return;
    }

    if (kind === "code" || kind === "notebook") {
      toolbar.hidden = true;
      if (!sourcePreview) {
        showViewerError("This source preview is unavailable.");
        return;
      }
      viewerStatus.textContent = kind === "code" ? "Loading Python source…" : "Loading notebook cells…";
      try {
        const response = await fetch(url);
        if (!response.ok) throw new Error(`File request returned ${response.status}`);
        const content = await response.text();
        if (token !== viewerToken) return;
        sourcePreview.replaceChildren();
        if (kind === "code") {
          const pre = document.createElement("pre");
          const code = document.createElement("code");
          code.textContent = content;
          pre.append(code);
          sourcePreview.append(pre);
        } else {
          const notebook = JSON.parse(content);
          const note = document.createElement("p");
          note.className = "source-preview-note";
          note.textContent = "Markdown and code cells are shown. Saved output cells are omitted.";
          sourcePreview.append(note);
          const cells = Array.isArray(notebook.cells) ? notebook.cells : [];
          cells.forEach((cell, index) => {
            if (!cell || !["markdown", "code"].includes(cell.cell_type)) return;
            const section = document.createElement("section");
            section.className = `source-preview-cell is-${cell.cell_type}`;
            const heading = document.createElement("h3");
            heading.textContent = `${cell.cell_type === "code" ? "CODE" : "MARKDOWN"} / ${String(index + 1).padStart(2, "0")}`;
            const pre = document.createElement("pre");
            const code = document.createElement("code");
            const cellSource = Array.isArray(cell.source) ? cell.source.join("") : String(cell.source || "");
            code.textContent = cellSource;
            pre.append(code);
            section.append(heading, pre);
            sourcePreview.append(section);
          });
          if (!cells.length) throw new Error("Notebook has no readable cells.");
        }
        viewerStatus.hidden = true;
        sourcePreview.hidden = false;
      } catch (error) {
        if (token !== viewerToken) return;
        showViewerError("This source file could not be previewed.");
      }
      return;
    }

    viewerStatus.textContent = "Loading document…";
    try {
      const library = await loadPdfJs();
      if (token !== viewerToken) return;
      const task = library.getDocument({
        url,
        cMapUrl: `${PDFJS_BASE}cmaps/`,
        cMapPacked: true,
        standardFontDataUrl: `${PDFJS_BASE}standard_fonts/`
      });
      currentLoadingTask = task;
      const loadedPdf = await task.promise;
      if (token !== viewerToken) {
        loadedPdf.destroy().catch(() => {});
        return;
      }
      currentPdf = loadedPdf;
      currentPdfTask = task;
      currentLoadingTask = null;
      currentPage = 1;
      manualZoom = 1;
      fitWidth = true;
      pdfTextCache = Array(currentPdf.numPages).fill(null);
      await createPageStack(token);
      updateToolbar();
    } catch (error) {
      if (token !== viewerToken) return;
      showViewerError("This PDF is missing, unreadable, or PDF.js could not load.");
    }
  };

  const changeZoom = (amount) => {
    if (!currentPdf) return;
    if (fitWidth) {
      manualZoom = activeScale || 1;
      fitWidth = false;
    }
    manualZoom = Math.min(3, Math.max(.5, manualZoom + amount));
    rerenderNearbyPages();
    updateToolbar();
  };

  const findDocumentMatches = async (direction = 0) => {
    if (!currentPdf) return;
    const query = pdfSearchInput.value.trim().toLocaleLowerCase();
    if (!query) {
      pdfSearchCount.textContent = "ENTER SEARCH TEXT";
      pdfSearchInput.focus();
      return;
    }
    if (query === searchQuery && searchMatches.length && direction !== 0) {
      searchCursor = (searchCursor + direction + searchMatches.length) % searchMatches.length;
      const match = searchMatches[searchCursor];
      pdfSearchCount.textContent = `${searchCursor + 1} / ${searchMatches.length} · PAGE ${match.page}`;
      goToPage(match.page);
      return;
    }

    const requestToken = ++searchToken;
    searchQuery = query;
    searchMatches = [];
    searchCursor = -1;
    pdfSearchCount.textContent = "SEARCHING…";
    pdfSearchPrevious.disabled = true;
    pdfSearchNext.disabled = true;
    try {
      for (let number = 1; number <= currentPdf.numPages; number += 1) {
        if (requestToken !== searchToken || !currentPdf) return;
        if (!pdfTextCache[number - 1]) {
          const page = await currentPdf.getPage(number);
          const content = await page.getTextContent();
          const text = content.items.map((item) => item.str || "").join(" ");
          pdfTextCache[number - 1] = { text, lower: text.toLocaleLowerCase() };
        }
        const text = pdfTextCache[number - 1].lower;
        let offset = 0;
        let found = text.indexOf(query, offset);
        while (found !== -1) {
          searchMatches.push({ page: number, offset: found });
          offset = found + Math.max(1, query.length);
          found = text.indexOf(query, offset);
        }
        pdfSearchCount.textContent = `INDEXING ${number} / ${currentPdf.numPages}`;
      }
      if (requestToken !== searchToken) return;
      if (!searchMatches.length) {
        pdfSearchCount.textContent = "NO MATCHES";
        updateToolbar();
        return;
      }
      searchCursor = direction < 0 ? searchMatches.length - 1 : 0;
      const match = searchMatches[searchCursor];
      pdfSearchCount.textContent = `${searchCursor + 1} / ${searchMatches.length} · PAGE ${match.page}`;
      pdfSearchPrevious.disabled = false;
      pdfSearchNext.disabled = false;
      goToPage(match.page);
    } catch (error) {
      if (requestToken === searchToken) pdfSearchCount.textContent = "TEXT SEARCH UNAVAILABLE";
    }
  };

  searchInput.addEventListener("input", renderWorks);
  categoryFilter.addEventListener("change", renderWorks);
  sortSelect.addEventListener("change", renderWorks);
  if (employmentSearchInput) employmentSearchInput.addEventListener("input", renderEmploymentWorks);
  if (employmentCategoryFilter) employmentCategoryFilter.addEventListener("change", renderEmploymentWorks);
  if (employmentSortSelect) employmentSortSelect.addEventListener("change", renderEmploymentWorks);
  const handleDocumentPreview = (event) => {
    const openButton = event.target.closest("[data-preview-url]");
    if (!openButton) return;
    openPreview(openButton.dataset.previewUrl, openButton.dataset.previewKind, openButton.dataset.previewTitle, openButton.dataset.previewName);
  };
  collectionLists.forEach((collectionList) => collectionList.addEventListener("click", handleDocumentPreview));
  if (employmentList) employmentList.addEventListener("click", handleDocumentPreview);

  previousButton.addEventListener("click", () => goToPage(currentPage - 1));
  nextButton.addEventListener("click", () => goToPage(currentPage + 1));
  zoomOutButton.addEventListener("click", () => changeZoom(-.1));
  zoomInButton.addEventListener("click", () => changeZoom(.1));
  fitButton.addEventListener("click", () => {
    fitWidth = true;
    rerenderNearbyPages();
    updateToolbar();
  });
  pdfSearchButton.addEventListener("click", () => findDocumentMatches(0));
  pdfSearchPrevious.addEventListener("click", () => findDocumentMatches(-1));
  pdfSearchNext.addEventListener("click", () => findDocumentMatches(1));
  pdfSearchInput.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
      event.preventDefault();
      findDocumentMatches(event.shiftKey ? -1 : 0);
    }
  });
  fullscreenButton.addEventListener("click", async () => {
    if (dialog.classList.contains("is-fullscreen-fallback")) {
      dialog.classList.remove("is-fullscreen-fallback");
      updateFullscreenButton();
      return;
    }
    if (document.fullscreenElement) {
      try { await document.exitFullscreen(); } catch { /* Fall back to the expanded dialog below. */ }
    } else if (typeof viewer.requestFullscreen === "function") {
      try { await viewer.requestFullscreen(); } catch { /* Use the in-page fullscreen view when native fullscreen is blocked. */ }
    }
    if (!document.fullscreenElement) dialog.classList.add("is-fullscreen-fallback");
    updateFullscreenButton();
  });
  document.addEventListener("fullscreenchange", updateFullscreenButton);
  closeButton.addEventListener("click", () => {
    if (typeof dialog.close === "function" && dialog.open) dialog.close();
    else {
      dialog.removeAttribute("open");
      resetViewer();
    }
  });
  dialog.addEventListener("click", (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener("close", resetViewer);
  window.addEventListener("resize", () => {
    if (!dialog.open || !currentPdf) return;
    if (fitWidth) rerenderNearbyPages();
    else {
      pageSlots.forEach((slot) => {
        if (slot.nearViewport && slot.rendered) {
          setPageLoading(slot);
          queuePageRender(slot);
        }
      });
    }
  }, { passive: true });

  const loadManifest = async () => {
    setEmptyState("loading");
    if (employmentEmptyState) setEmploymentEmptyState("loading");
    try {
      const response = await fetch(manifestUrl, { cache: "no-cache" });
      if (!response.ok) throw new Error(`Manifest request returned ${response.status}`);
      const manifest = await response.json();
      allWorks = Array.isArray(manifest.works) ? manifest.works.filter((item) => item && typeof item === "object").map(normalizeWork) : [];
      employmentWorks = Array.isArray(manifest.employmentWorks)
        ? manifest.employmentWorks.filter((item) => item && typeof item === "object").map((work) => normalizeWork(work, "Other Supporting Evidence"))
        : [];
      activities = Array.isArray(manifest.activities) ? manifest.activities : [];
      for (const category of new Set(allWorks.map((work) => work.category))) {
        if ([...categoryFilter.options].some((option) => option.value.toLowerCase() === category.toLowerCase())) continue;
        const option = document.createElement("option");
        option.value = category;
        option.textContent = category;
        categoryFilter.append(option);
      }
      if (employmentCategoryFilter) {
        for (const category of new Set(employmentWorks.map((work) => work.category))) {
          if ([...employmentCategoryFilter.options].some((option) => option.value.toLowerCase() === category.toLowerCase())) continue;
          const option = document.createElement("option");
          option.value = category;
          option.textContent = category;
          employmentCategoryFilter.append(option);
        }
      }
      renderWorks();
      renderEmploymentWorks();
      renderActivities();
      renderAiPortfolio(manifest);
      renderEmergingPortfolio(manifest);
    } catch (error) {
      count.textContent = "CATALOGUE ERROR";
      list.innerHTML = "";
      setEmptyState("error");
      if (employmentCount) employmentCount.textContent = "CATALOGUE ERROR";
      if (employmentList) employmentList.innerHTML = "";
      if (employmentEmptyState) setEmploymentEmptyState("error");
      if (subjectKey === "seminars") collectionLists.slice(1).forEach((collectionList) => { collectionList.innerHTML = ""; });
    }
  };

  loadManifest();
})();
