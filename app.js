/* CV Chunk Studio
 * - Offline-friendly: uses LocalStorage only.
 * - "Chunks" are stored once in a library; profiles store per-job selections.
 */

const STORAGE_KEY = "cv_chunk_studio:v1";
const PERSONAL_INFO_FIELDS = [
  { key: "fullName", label: "Full Name", placeholder: "e.g. Li Si" },
  { key: "headline", label: "Headline", placeholder: "e.g. Backend Engineer / AI Infra Intern" },
  { key: "phone", label: "Phone", placeholder: "e.g. +86 138-0000-0000" },
  { key: "email", label: "Email", placeholder: "e.g. name@example.com" },
  { key: "location", label: "Location", placeholder: "e.g. Shanghai" },
  { key: "website", label: "Website", placeholder: "e.g. https://example.com" },
  { key: "github", label: "GitHub", placeholder: "e.g. github.com/username" },
  { key: "linkedin", label: "LinkedIn", placeholder: "e.g. linkedin.com/in/username" },
];

function nowIso() {
  return new Date().toISOString();
}

function newId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `id_${Date.now()}_${Math.random().toString(16).slice(2)}`;
}

function clampText(value) {
  if (typeof value !== "string") return "";
  return value.replaceAll("\r\n", "\n");
}

function normalizePersonalInfo(info) {
  const safe = info && typeof info === "object" ? info : {};
  const out = {};
  for (const field of PERSONAL_INFO_FIELDS) {
    out[field.key] = clampText(safe[field.key]).trim();
  }
  return out;
}

function personalInfoLines(info) {
  const contact = [info.phone, info.email, info.location].filter(Boolean).join(" | ");
  const links = [info.website, info.github, info.linkedin].filter(Boolean).join(" | ");
  return {
    name: info.fullName || "Resume",
    headline: info.headline || "",
    contact,
    links,
  };
}

function defaultState() {
  const initialProfileId = newId();
  return {
    version: 1,
    personalInfo: normalizePersonalInfo(),
    education: "",
    internships: [],
    projects: [],
    skills: [],
    evaluations: [],
    profiles: [
      {
        id: initialProfileId,
        name: "Default",
        selection: {
          internships: [],
          projects: [],
          skills: [],
          evaluations: [],
        },
        createdAt: nowIso(),
        updatedAt: nowIso(),
      },
    ],
    ui: {
      activeProfileId: initialProfileId,
    },
  };
}

function normalizeState(parsed) {
  const base = defaultState();
  const safe = parsed && typeof parsed === "object" ? parsed : {};
  const merged = { ...base, ...safe };
  merged.personalInfo = normalizePersonalInfo(merged.personalInfo);
  merged.education = clampText(merged.education);
  merged.internships = Array.isArray(merged.internships) ? merged.internships : [];
  merged.projects = Array.isArray(merged.projects) ? merged.projects : [];
  merged.skills = Array.isArray(merged.skills) ? merged.skills : [];
  merged.evaluations = Array.isArray(merged.evaluations) ? merged.evaluations : [];
  merged.profiles = Array.isArray(merged.profiles) && merged.profiles.length ? merged.profiles : base.profiles;
  merged.ui = merged.ui && typeof merged.ui === "object" ? merged.ui : base.ui;

  for (const p of merged.profiles) {
    if (!p.selection || typeof p.selection !== "object") {
      p.selection = { internships: [], projects: [], skills: [], evaluations: [] };
    }
    p.selection.internships = Array.isArray(p.selection.internships) ? p.selection.internships : [];
    p.selection.projects = Array.isArray(p.selection.projects) ? p.selection.projects : [];
    p.selection.skills = Array.isArray(p.selection.skills) ? p.selection.skills : [];
    p.selection.evaluations = Array.isArray(p.selection.evaluations) ? p.selection.evaluations : [];
  }

  if (!merged.ui.activeProfileId || !merged.profiles.some((p) => p.id === merged.ui.activeProfileId)) {
    merged.ui.activeProfileId = merged.profiles[0].id;
  }
  return merged;
}

function loadState() {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return defaultState();
    return normalizeState(JSON.parse(raw));
  } catch {
    return defaultState();
  }
}

function saveState(state) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
}

function bytesApprox(str) {
  // UTF-16 code units * 2. Rough estimate for LocalStorage.
  return (str?.length ?? 0) * 2;
}

function escapeHtml(s) {
  return String(s)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function downloadText(filename, mime, text) {
  const blob = new Blob([text], { type: `${mime};charset=utf-8` });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function profileById(state, id) {
  return state.profiles.find((p) => p.id === id) || state.profiles[0];
}

function upsertById(list, item) {
  const idx = list.findIndex((x) => x.id === item.id);
  if (idx >= 0) list[idx] = item;
  else list.unshift(item);
}

function removeById(list, id) {
  const idx = list.findIndex((x) => x.id === id);
  if (idx >= 0) list.splice(idx, 1);
}

function fmtItemMeta(item) {
  const org = (item.org || "").trim();
  const dateRange = (item.dateRange || "").trim();
  const parts = [org, dateRange].filter(Boolean);
  return parts.join("  |  ");
}

function normalizeLines(s) {
  const lines = clampText(s)
    .split("\n")
    .map((x) => x.trim())
    .filter(Boolean);
  return lines;
}

function buildResumeModel(state) {
  const profile = profileById(state, state.ui.activeProfileId);
  const getSelected = (kind, ids) => {
    const source = state[kind];
    const byId = new Map(source.map((x) => [x.id, x]));
    return ids.map((id) => byId.get(id)).filter(Boolean);
  };

  return {
    personalInfo: normalizePersonalInfo(state.personalInfo),
    education: clampText(state.education).trim(),
    internships: getSelected("internships", profile.selection.internships),
    projects: getSelected("projects", profile.selection.projects),
    skills: getSelected("skills", profile.selection.skills),
    evaluations: getSelected("evaluations", profile.selection.evaluations),
  };
}

function renderMarkdown(model) {
  const out = [];
  const push = (s = "") => out.push(s);
  const info = personalInfoLines(model.personalInfo);

  push(`# ${info.name}`);
  if (info.headline) push(info.headline);
  if (info.contact) push(info.contact);
  if (info.links) push(info.links);
  push("");

  push("## Education");
  push(model.education ? model.education : "_(empty)_");
  push("");

  push("## Internships");
  if (!model.internships.length) {
    push("_(none)_");
  } else {
    for (const it of model.internships) {
      const title = (it.title || "").trim() || "(Untitled)";
      const meta = fmtItemMeta(it);
      push(`### ${title}${meta ? `  \n${meta}` : ""}`);
      const duties = normalizeLines(it.duties);
      if (duties.length) {
        for (const line of duties) push(`- ${line}`);
      } else {
        push("- _(no duties)_");
      }
      push("");
    }
  }
  push("");

  push("## Projects");
  if (!model.projects.length) {
    push("_(none)_");
  } else {
    for (const it of model.projects) {
      const title = (it.title || "").trim() || "(Untitled)";
      const meta = fmtItemMeta(it);
      push(`### ${title}${meta ? `  \n${meta}` : ""}`);
      const duties = normalizeLines(it.duties);
      if (duties.length) {
        for (const line of duties) push(`- ${line}`);
      } else {
        push("- _(no details)_");
      }
      push("");
    }
  }
  push("");

  push("## Skills");
  if (!model.skills.length) {
    push("_(none)_");
  } else {
    for (const s of model.skills) {
      const text = (s.text || "").trim();
      if (text) push(`- ${text}`);
    }
  }
  push("");

  push("## Self Evaluation");
  if (!model.evaluations.length) {
    push("_(none)_");
  } else {
    for (const e of model.evaluations) {
      const text = (e.text || "").trim();
      if (text) push(`- ${text}`);
    }
  }
  push("");

  return out.join("\n");
}

function renderPlainText(model) {
  const out = [];
  const push = (s = "") => out.push(s);
  const info = personalInfoLines(model.personalInfo);

  push(info.name);
  if (info.headline) push(info.headline);
  if (info.contact) push(info.contact);
  if (info.links) push(info.links);
  push("");

  const head = (t) => {
    push(t);
    push("".padEnd(Math.max(10, t.length), "-"));
  };

  head("Education");
  push(model.education ? model.education : "(empty)");
  push("");

  head("Internships");
  if (!model.internships.length) push("(none)");
  for (const it of model.internships) {
    const title = (it.title || "").trim() || "(Untitled)";
    const meta = fmtItemMeta(it);
    push(title);
    if (meta) push(meta);
    for (const line of normalizeLines(it.duties)) push(`* ${line}`);
    push("");
  }

  head("Projects");
  if (!model.projects.length) push("(none)");
  for (const it of model.projects) {
    const title = (it.title || "").trim() || "(Untitled)";
    const meta = fmtItemMeta(it);
    push(title);
    if (meta) push(meta);
    for (const line of normalizeLines(it.duties)) push(`* ${line}`);
    push("");
  }

  head("Skills");
  if (!model.skills.length) push("(none)");
  for (const s of model.skills) {
    const text = (s.text || "").trim();
    if (text) push(`* ${text}`);
  }
  push("");

  head("Self Evaluation");
  if (!model.evaluations.length) push("(none)");
  for (const e of model.evaluations) {
    const text = (e.text || "").trim();
    if (text) push(`* ${text}`);
  }
  push("");

  return out.join("\n");
}

function renderDocHtml(model) {
  const css = `
    body{font-family:Calibri,Arial,sans-serif;color:#111;margin:36px;}
    h1{font-size:18pt;margin:0 0 14px;}
    h2{font-size:14pt;margin:18px 0 8px;border-bottom:1px solid #ddd;padding-bottom:4px;}
    h3{font-size:12pt;margin:14px 0 6px;}
    .hero{margin-bottom:18px;}
    .hero h1{margin-bottom:4px;}
    .hero-line{font-size:11pt;line-height:1.4;margin:2px 0;}
    .meta{color:#555;font-size:10.5pt;margin-top:2px;}
    ul{margin:6px 0 10px 18px;}
    li{margin:2px 0;}
    pre{white-space:pre-wrap;font-family:inherit;font-size:11pt;line-height:1.35;margin:0;}
  `;
  const info = personalInfoLines(model.personalInfo);

  const sectionLines = (text) => escapeHtml(clampText(text)).replaceAll("\n", "<br/>");

  const itemToHtml = (it) => {
    const title = escapeHtml((it.title || "").trim() || "(Untitled)");
    const meta = escapeHtml(fmtItemMeta(it));
    const duties = normalizeLines(it.duties);
    const dutyHtml = duties.length
      ? `<ul>${duties.map((d) => `<li>${escapeHtml(d)}</li>`).join("")}</ul>`
      : "<div>(no details)</div>";
    return `
      <h3>${title}</h3>
      ${meta ? `<div class="meta">${meta}</div>` : ""}
      ${dutyHtml}
    `;
  };

  const bullets = (items) => {
    const lines = items.map((x) => (x.text || "").trim()).filter(Boolean);
    return `<ul>${lines.map((t) => `<li>${escapeHtml(t)}</li>`).join("")}</ul>`;
  };

  return `<!doctype html>
<html><head>
  <meta charset="utf-8"/>
  <title>Resume</title>
  <style>${css}</style>
</head>
<body>
  <div class="hero">
    <h1>${escapeHtml(info.name)}</h1>
    ${info.headline ? `<div class="hero-line">${escapeHtml(info.headline)}</div>` : ""}
    ${info.contact ? `<div class="hero-line">${escapeHtml(info.contact)}</div>` : ""}
    ${info.links ? `<div class="hero-line">${escapeHtml(info.links)}</div>` : ""}
  </div>
  <h2>Education</h2>
  <pre>${sectionLines(model.education || "(empty)")}</pre>

  <h2>Internships</h2>
  ${model.internships.length ? model.internships.map(itemToHtml).join("") : "<div>(none)</div>"}

  <h2>Projects</h2>
  ${model.projects.length ? model.projects.map(itemToHtml).join("") : "<div>(none)</div>"}

  <h2>Skills</h2>
  ${model.skills.length ? bullets(model.skills) : "<div>(none)</div>"}

  <h2>Self Evaluation</h2>
  ${model.evaluations.length ? bullets(model.evaluations) : "<div>(none)</div>"}
</body></html>`;
}

function openPrintWindow(docHtml) {
  const w = window.open("", "_blank", "noopener,noreferrer");
  if (!w) {
    alert("Popup blocked. Please allow popups for this site to print/export PDF.");
    return;
  }
  w.document.open();
  w.document.write(docHtml);
  w.document.close();
  const tryPrint = () => {
    try {
      w.focus();
      w.print();
    } catch {
      // ignore
    }
  };
  w.addEventListener("load", tryPrint);
  setTimeout(tryPrint, 250);
}

function setActiveView(view) {
  const views = ["library", "generate", "settings"];
  for (const v of views) {
    const el = document.getElementById(`view-${v}`);
    const nav = document.querySelector(`.nav-item[data-view="${v}"]`);
    const active = v === view;
    el.hidden = !active;
    nav.setAttribute("aria-selected", active ? "true" : "false");
  }
}

function renderList(container, items, kind) {
  container.innerHTML = "";
  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "item";
    empty.textContent = "No items yet.";
    container.appendChild(empty);
    return;
  }

  for (const it of items) {
    const el = document.createElement("div");
    el.className = "item";
    const title =
      kind === "skills" || kind === "evaluations"
        ? (it.text || "").trim() || "(empty)"
        : (it.title || "").trim() || "(Untitled)";
    const meta = kind === "skills" || kind === "evaluations" ? "" : fmtItemMeta(it);
    el.innerHTML = `
      <div class="item-row">
        <div>
          <div class="item-title">${escapeHtml(title)}</div>
          ${meta ? `<div class="item-sub">${escapeHtml(meta)}</div>` : `<div class="item-sub"> </div>`}
        </div>
        <div class="item-actions">
          <button class="btn" type="button" data-action="edit" data-id="${escapeHtml(it.id)}">Edit</button>
          <button class="btn btn-danger" type="button" data-action="delete" data-id="${escapeHtml(it.id)}">Delete</button>
        </div>
      </div>
    `;
    el.addEventListener("click", (ev) => {
      const btn = ev.target.closest("button[data-action]");
      if (!btn) return;
      const action = btn.getAttribute("data-action");
      const id = btn.getAttribute("data-id");
      if (action === "edit") openEditDialog(kind, id);
      if (action === "delete") deleteItem(kind, id);
    });
    container.appendChild(el);
  }
}

function renderPicklist(container, items, kind, state) {
  const profile = profileById(state, state.ui.activeProfileId);
  const selected = new Set(profile.selection[kind]);

  container.innerHTML = "";
  if (!items.length) {
    const empty = document.createElement("div");
    empty.className = "pickrow";
    empty.innerHTML = `<div></div><div class="pickmeta">No items in library.</div>`;
    container.appendChild(empty);
    return;
  }

  for (const it of items) {
    const row = document.createElement("label");
    row.className = "pickrow";
    const title =
      kind === "skills" || kind === "evaluations"
        ? (it.text || "").trim() || "(empty)"
        : (it.title || "").trim() || "(Untitled)";
    const meta = kind === "skills" || kind === "evaluations" ? "" : fmtItemMeta(it);
    row.innerHTML = `
      <input type="checkbox" ${selected.has(it.id) ? "checked" : ""} data-id="${escapeHtml(it.id)}"/>
      <div>
        <div><strong>${escapeHtml(title)}</strong></div>
        ${meta ? `<div class="pickmeta">${escapeHtml(meta)}</div>` : ""}
      </div>
    `;
    row.querySelector("input").addEventListener("change", (ev) => {
      const id = ev.target.getAttribute("data-id");
      toggleSelection(kind, id, ev.target.checked);
    });
    container.appendChild(row);
  }
}

let state = loadState();

function syncInputValue(id, value) {
  const el = document.getElementById(id);
  if (el && document.activeElement !== el) el.value = value || "";
}

function readPersonalInfoForm() {
  const info = {};
  for (const field of PERSONAL_INFO_FIELDS) {
    info[field.key] = clampText(document.getElementById(`personal_${field.key}`).value);
  }
  return normalizePersonalInfo(info);
}

function rerenderAll() {
  // Library view
  for (const field of PERSONAL_INFO_FIELDS) {
    syncInputValue(`personal_${field.key}`, state.personalInfo[field.key]);
  }
  syncInputValue("educationText", state.education);
  renderList(document.getElementById("listInternships"), state.internships, "internships");
  renderList(document.getElementById("listProjects"), state.projects, "projects");
  renderList(document.getElementById("listSkills"), state.skills, "skills");
  renderList(document.getElementById("listEvaluations"), state.evaluations, "evaluations");

  // Profile selector
  const sel = document.getElementById("profileSelect");
  sel.innerHTML = "";
  for (const p of state.profiles) {
    const opt = document.createElement("option");
    opt.value = p.id;
    opt.textContent = p.name;
    sel.appendChild(opt);
  }
  sel.value = state.ui.activeProfileId;

  // Generate view picklists
  renderPicklist(document.getElementById("pickInternships"), state.internships, "internships", state);
  renderPicklist(document.getElementById("pickProjects"), state.projects, "projects", state);
  renderPicklist(document.getElementById("pickSkills"), state.skills, "skills", state);
  renderPicklist(document.getElementById("pickEvaluations"), state.evaluations, "evaluations", state);

  // Preview
  const model = buildResumeModel(state);
  const md = renderMarkdown(model);
  document.getElementById("markdownPreview").value = md;

  // Stats
  const raw = localStorage.getItem(STORAGE_KEY) || "";
  const lines = [];
  const personalInfoFilled = Object.values(state.personalInfo).filter(Boolean).length;
  lines.push(`Key: ${STORAGE_KEY}`);
  lines.push(`Approx bytes: ${bytesApprox(raw).toLocaleString()}`);
  lines.push(`Personal info fields: ${personalInfoFilled}/${PERSONAL_INFO_FIELDS.length}`);
  lines.push(`Internships: ${state.internships.length}`);
  lines.push(`Projects: ${state.projects.length}`);
  lines.push(`Skills: ${state.skills.length}`);
  lines.push(`Self eval: ${state.evaluations.length}`);
  lines.push(`Profiles: ${state.profiles.length}`);
  document.getElementById("storageStats").textContent = lines.join("\n");
}

function openEditDialog(kind, idOrNull) {
  const dialog = document.getElementById("editDialog");
  const form = document.getElementById("editForm");
  const fields = document.getElementById("dialogFields");
  const title = document.getElementById("dialogTitle");
  const subtitle = document.getElementById("dialogSubtitle");
  const inputKind = document.getElementById("editKind");
  const inputId = document.getElementById("editId");
  const btnDelete = document.getElementById("btnDialogDelete");

  inputKind.value = kind;

  const isSimpleText = kind === "skills" || kind === "evaluations";
  const list = state[kind];
  const existing = idOrNull ? list.find((x) => x.id === idOrNull) : null;
  const isNew = !existing;
  const id = existing?.id ?? newId();
  inputId.value = id;

  title.textContent = `${isNew ? "Add" : "Edit"} ${kind}`;
  subtitle.textContent = isSimpleText ? "Single-line chunk" : "Structured chunk";
  btnDelete.style.display = isNew ? "none" : "inline-flex";
  btnDelete.onclick = () => {
    deleteItem(kind, id);
    dialog.close();
  };

  fields.innerHTML = "";

  const mkField = (label, fieldId, opts = {}) => {
    const wrap = document.createElement("div");
    wrap.className = `field${opts.wide ? " wide" : ""}`;
    wrap.innerHTML = `<label for="${escapeHtml(fieldId)}">${escapeHtml(label)}</label>`;
    let control;
    if (opts.multiline) {
      control = document.createElement("textarea");
      control.className = "textarea";
      control.rows = opts.rows ?? 6;
    } else {
      control = document.createElement("input");
      control.className = "input";
      control.type = "text";
    }
    control.id = fieldId;
    control.value = opts.value ?? "";
    if (opts.placeholder) control.placeholder = opts.placeholder;
    wrap.appendChild(control);
    return wrap;
  };

  if (isSimpleText) {
    fields.appendChild(
      mkField("Text", "field_text", {
        wide: true,
        value: existing?.text ?? "",
        placeholder: kind === "skills" ? "e.g. Rust / CUDA / SQL / PyTorch..." : "e.g. Fast learner, strong ownership...",
      }),
    );
  } else {
    fields.appendChild(
      mkField("Name", "field_title", { value: existing?.title ?? "", placeholder: "e.g. Backend Intern / Project A" }),
    );
    fields.appendChild(mkField("Org", "field_org", { value: existing?.org ?? "", placeholder: "e.g. Company / Lab / Team" }));
    fields.appendChild(
      mkField("Date Range", "field_dateRange", { value: existing?.dateRange ?? "", placeholder: "e.g. 2025.06 - 2025.09" }),
    );
    fields.appendChild(
      mkField("Duties / Details (one per line)", "field_duties", {
        wide: true,
        multiline: true,
        rows: 9,
        value: existing?.duties ?? "",
        placeholder: "One responsibility per line.\nUse measurable outcomes when possible.",
      }),
    );
  }

  form.onsubmit = (ev) => {
    ev.preventDefault();
    if (ev.submitter?.value === "cancel") {
      dialog.close();
      return;
    }
    saveDialogItem();
    dialog.close();
  };

  dialog.showModal();
}

function saveDialogItem() {
  const kind = document.getElementById("editKind").value;
  const id = document.getElementById("editId").value;
  const isSimpleText = kind === "skills" || kind === "evaluations";

  const existing = state[kind].find((x) => x.id === id);
  const base = existing || { id, createdAt: nowIso() };

  let item;
  if (isSimpleText) {
    const text = clampText(document.getElementById("field_text").value).trim();
    item = { ...base, id, text, updatedAt: nowIso() };
  } else {
    const title = clampText(document.getElementById("field_title").value).trim();
    const org = clampText(document.getElementById("field_org").value).trim();
    const dateRange = clampText(document.getElementById("field_dateRange").value).trim();
    const duties = clampText(document.getElementById("field_duties").value);
    item = { ...base, id, title, org, dateRange, duties, updatedAt: nowIso() };
  }

  upsertById(state[kind], item);
  saveState(state);
  rerenderAll();
}

function deleteItem(kind, id) {
  if (!confirm("Delete this item? This cannot be undone.")) return;
  removeById(state[kind], id);
  for (const p of state.profiles) {
    const arr = p.selection[kind];
    p.selection[kind] = arr.filter((x) => x !== id);
    p.updatedAt = nowIso();
  }
  saveState(state);
  rerenderAll();
}

function toggleSelection(kind, id, checked) {
  const profile = profileById(state, state.ui.activeProfileId);
  const arr = profile.selection[kind];
  const has = arr.includes(id);
  if (checked && !has) arr.push(id);
  if (!checked && has) profile.selection[kind] = arr.filter((x) => x !== id);
  profile.updatedAt = nowIso();
  saveState(state);
  rerenderAll();
}

function newProfile() {
  const name = prompt("Profile name (per-job selection):", "New Profile");
  if (!name) return;
  const trimmed = name.trim();
  if (!trimmed) return;
  if (state.profiles.some((p) => p.name.toLowerCase() === trimmed.toLowerCase())) {
    alert("A profile with that name already exists.");
    return;
  }
  const id = newId();
  state.profiles.push({
    id,
    name: trimmed,
    selection: { internships: [], projects: [], skills: [], evaluations: [] },
    createdAt: nowIso(),
    updatedAt: nowIso(),
  });
  state.ui.activeProfileId = id;
  saveState(state);
  rerenderAll();
}

function renameProfile() {
  const profile = profileById(state, state.ui.activeProfileId);
  const name = prompt("Rename profile:", profile.name);
  if (!name) return;
  const trimmed = name.trim();
  if (!trimmed) return;
  if (state.profiles.some((p) => p.id !== profile.id && p.name.toLowerCase() === trimmed.toLowerCase())) {
    alert("A profile with that name already exists.");
    return;
  }
  profile.name = trimmed;
  profile.updatedAt = nowIso();
  saveState(state);
  rerenderAll();
}

function deleteProfile() {
  if (state.profiles.length <= 1) {
    alert("You must keep at least one profile.");
    return;
  }
  const profile = profileById(state, state.ui.activeProfileId);
  if (!confirm(`Delete profile "${profile.name}"? This only removes the selection set.`)) return;
  state.profiles = state.profiles.filter((p) => p.id !== profile.id);
  state.ui.activeProfileId = state.profiles[0].id;
  saveState(state);
  rerenderAll();
}

function backupJson() {
  downloadText(
    `cv-chunk-studio-backup-${new Date().toISOString().slice(0, 10)}.json`,
    "application/json",
    JSON.stringify(state, null, 2),
  );
}

function restoreJsonFromFile(file) {
  const reader = new FileReader();
  reader.onload = () => {
    try {
      const parsed = JSON.parse(String(reader.result || ""));
      if (!parsed || typeof parsed !== "object") throw new Error("Invalid JSON");
      if (!confirm("Restore will replace your current local data. Continue?")) return;
      state = normalizeState(parsed);
      saveState(state);
      rerenderAll();
      alert("Restore complete.");
    } catch (e) {
      alert(`Restore failed: ${e?.message || e}`);
    }
  };
  reader.readAsText(file, "utf-8");
}

function resetAll() {
  if (!confirm("Reset all local data? This cannot be undone.")) return;
  localStorage.removeItem(STORAGE_KEY);
  state = loadState();
  rerenderAll();
}

function wireUi() {
  document.querySelectorAll(".nav-item").forEach((btn) => {
    btn.addEventListener("click", () => setActiveView(btn.getAttribute("data-view")));
  });

  let personalInfoSaveTimer = null;
  const persistPersonalInfo = () => {
    state.personalInfo = readPersonalInfoForm();
    saveState(state);
  };
  for (const field of PERSONAL_INFO_FIELDS) {
    const input = document.getElementById(`personal_${field.key}`);
    input.addEventListener("input", () => {
      state.personalInfo[field.key] = clampText(input.value);
      if (personalInfoSaveTimer) clearTimeout(personalInfoSaveTimer);
      personalInfoSaveTimer = setTimeout(() => {
        state.personalInfo = readPersonalInfoForm();
        saveState(state);
      }, 220);
    });
  }
  document.getElementById("btnSavePersonalInfo").addEventListener("click", () => {
    if (personalInfoSaveTimer) clearTimeout(personalInfoSaveTimer);
    persistPersonalInfo();
    rerenderAll();
  });

  let educationSaveTimer = null;
  const educationEl = document.getElementById("educationText");
  const persistEducation = () => {
    state.education = clampText(educationEl.value);
    saveState(state);
  };
  educationEl.addEventListener("input", () => {
    state.education = clampText(educationEl.value);
    if (educationSaveTimer) clearTimeout(educationSaveTimer);
    educationSaveTimer = setTimeout(() => saveState(state), 220);
  });
  document.getElementById("btnSaveEducation").addEventListener("click", () => {
    if (educationSaveTimer) clearTimeout(educationSaveTimer);
    persistEducation();
    rerenderAll();
  });

  document.getElementById("btnAddInternship").addEventListener("click", () => openEditDialog("internships", null));
  document.getElementById("btnAddProject").addEventListener("click", () => openEditDialog("projects", null));
  document.getElementById("btnAddSkill").addEventListener("click", () => openEditDialog("skills", null));
  document.getElementById("btnAddEvaluation").addEventListener("click", () => openEditDialog("evaluations", null));

  const profileSelect = document.getElementById("profileSelect");
  profileSelect.addEventListener("change", () => {
    state.ui.activeProfileId = profileSelect.value;
    saveState(state);
    rerenderAll();
  });

  document.getElementById("btnNewProfile").addEventListener("click", newProfile);
  document.getElementById("btnRenameProfile").addEventListener("click", renameProfile);
  document.getElementById("btnDeleteProfile").addEventListener("click", deleteProfile);

  document.getElementById("btnCopyMarkdown").addEventListener("click", async () => {
    const text = document.getElementById("markdownPreview").value;
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      document.getElementById("markdownPreview").select();
      document.execCommand("copy");
    }
  });

  document.getElementById("btnDownloadMd").addEventListener("click", () => {
    const model = buildResumeModel(state);
    downloadText("resume.md", "text/markdown", renderMarkdown(model));
  });

  document.getElementById("btnDownloadTxt").addEventListener("click", () => {
    const model = buildResumeModel(state);
    downloadText("resume.txt", "text/plain", renderPlainText(model));
  });

  document.getElementById("btnDownloadDoc").addEventListener("click", () => {
    const model = buildResumeModel(state);
    const html = renderDocHtml(model);
    downloadText("resume.doc", "application/msword", html);
  });

  document.getElementById("btnPrintPdf").addEventListener("click", () => {
    const model = buildResumeModel(state);
    const html = renderDocHtml(model);
    openPrintWindow(html);
  });

  document.getElementById("btnBackup").addEventListener("click", backupJson);
  document.getElementById("btnRestore").addEventListener("click", () => document.getElementById("fileRestore").click());
  document.getElementById("fileRestore").addEventListener("change", (ev) => {
    const file = ev.target.files?.[0];
    ev.target.value = "";
    if (file) restoreJsonFromFile(file);
  });

  document.getElementById("btnResetAll").addEventListener("click", resetAll);
}

wireUi();
rerenderAll();
