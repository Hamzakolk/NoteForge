const ICONS = {
  feather: '<svg viewBox="0 0 24 24"><path d="M20 4c-7 0-12 4-13 11l-2 5 5-2c7-1 10-6 10-14z"/><path d="M4 20l8-8"/></svg>',
  notes: '<svg viewBox="0 0 24 24"><rect x="5" y="3" width="14" height="18" rx="2"/><path d="M8 8h8M8 12h8M8 16h5"/></svg>',
  clock: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/></svg>',
  lock: '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>',
  unlock: '<svg viewBox="0 0 24 24"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 7.5-2"/></svg>',
  trash: '<svg viewBox="0 0 24 24"><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/></svg>',
  calendar: '<svg viewBox="0 0 24 24"><rect x="3" y="5" width="18" height="16" rx="2"/><path d="M3 10h18M8 3v4M16 3v4"/></svg>',
  check: '<svg viewBox="0 0 24 24"><rect x="4" y="4" width="16" height="16" rx="3"/><path d="M8 12l3 3 5-6"/></svg>',
  snippet: '<svg viewBox="0 0 24 24"><path d="M13 2L4 14h7l-1 8 9-12h-7z"/></svg>',
  palette: '<svg viewBox="0 0 24 24"><path d="M12 3a9 9 0 0 0 0 18c1.5 0 2-1 1.5-2s0-2 1.5-2H17a4 4 0 0 0 4-4 9 9 0 0 0-9-10z"/><circle cx="7.5" cy="10" r="1"/><circle cx="12" cy="7" r="1"/><circle cx="16.5" cy="10" r="1"/></svg>',
  gear: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9l2.1 2.1M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/></svg>',
  plus: '<svg viewBox="0 0 24 24"><path d="M12 5v14M5 12h14"/></svg>',
  bold: '<svg viewBox="0 0 24 24"><path d="M7 4h7a4 4 0 0 1 0 8H7zM7 12h8a4 4 0 0 1 0 8H7z"/></svg>',
  italic: '<svg viewBox="0 0 24 24"><path d="M19 4h-9M14 20H5M15 4L9 20"/></svg>',
  heading: '<svg viewBox="0 0 24 24"><path d="M4 5v14M20 5v14M4 12h16"/></svg>',
  list: '<svg viewBox="0 0 24 24"><path d="M9 6h11M9 12h11M9 18h11"/><circle cx="4" cy="6" r="1"/><circle cx="4" cy="12" r="1"/><circle cx="4" cy="18" r="1"/></svg>',
  quote: '<svg viewBox="0 0 24 24"><path d="M4 6v12M9 8h11M9 12h11M9 16h8"/></svg>',
  code: '<svg viewBox="0 0 24 24"><path d="M8 7l-5 5 5 5M16 7l5 5-5 5M14 4l-4 16"/></svg>',
  link: '<svg viewBox="0 0 24 24"><path d="M10 13a5 5 0 0 0 7 0l3-3a5 5 0 0 0-7-7l-1 1"/><path d="M14 11a5 5 0 0 0-7 0l-3 3a5 5 0 0 0 7 7l1-1"/></svg>',
  restore: '<svg viewBox="0 0 24 24"><path d="M4 12a8 8 0 1 0 3-6.3M4 4v5h5"/></svg>',
};

const THEMES = [
  { id: "dark", label: "Dark", c: ["#0E1019", "#7C5CFF"] },
  { id: "light", label: "Light", c: ["#F4F5FA", "#5B8CFF"] },
  { id: "ocean", label: "Ocean", c: ["#071A24", "#22C3D6"] },
  { id: "forest", label: "Forest", c: ["#0C1A12", "#3DDC84"] },
  { id: "sunset", label: "Sunset", c: ["#1E120F", "#FF7A45"] },
  { id: "neon", label: "Neon", c: ["#07050F", "#FF2EC4"] },
];

const $ = (id) => document.getElementById(id);
const api = () => window.pywebview && window.pywebview.api;
const esc = (t) => String(t).replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));

let state = { notes: [], trash_count: 0, data: { snippets: {}, todos: [], events: [], theme: "dark" }, status: "" };
let view = "all";
let openTabs = [];
let active = null;        // open note name, or trash file name when in trash view
let activeIsTrash = false;
let locked = false;
let dirty = false;
let saveTimer = null;
let calDate = new Date();
let showPreview = false;
let trashItems = [];

// ----- icons -----
function paintIcons() {
  document.querySelectorAll("[data-ico]").forEach((el) => { el.innerHTML = ICONS[el.dataset.ico] || ""; });
}

// ----- markdown preview -----
function inline(s) {
  return s.replace(/\*\*(.+?)\*\*/g, "<b>$1</b>").replace(/\*(.+?)\*/g, "<i>$1</i>")
    .replace(/`(.+?)`/g, "<code>$1</code>").replace(/\[(.+?)\]\((.+?)\)/g, '<a href="$2">$1</a>');
}
function renderMd(src) {
  return src.split("\n").map((raw) => {
    const l = esc(raw);
    if (/^### /.test(l)) return `<h3>${inline(l.slice(4))}</h3>`;
    if (/^## /.test(l)) return `<h2>${inline(l.slice(3))}</h2>`;
    if (/^# /.test(l)) return `<h1>${inline(l.slice(2))}</h1>`;
    if (/^- \[x\] /i.test(l)) return `<div class="ck on">✔ ${inline(l.slice(6))}</div>`;
    if (/^- \[ \] /.test(l)) return `<div class="ck">☐ ${inline(l.slice(6))}</div>`;
    if (/^- /.test(l)) return `<div>• ${inline(l.slice(2))}</div>`;
    if (/^> /.test(l)) return `<blockquote>${inline(l.slice(2))}</blockquote>`;
    if (l.trim() === "") return "<br>";
    return `<p>${inline(l)}</p>`;
  }).join("");
}
function updatePreview() { $("preview").innerHTML = renderMd($("editor").value); }

// ----- counts -----
function updateCounts() {
  const t = $("editor").value;
  const words = t.trim() ? t.trim().split(/\s+/).length : 0;
  $("counts").textContent = `Words: ${words} | Characters: ${t.length}`;
  $("line").textContent = `Line: ${t.slice(0, $("editor").selectionStart).split("\n").length}`;
}

// ----- lists -----
function renderNoteList() {
  const q = $("find").value.trim().toLowerCase();
  let list = state.notes.filter((n) => n.name.toLowerCase().includes(q));
  if (view === "recent") list = list.slice(0, 8);
  if (view === "locked") list = list.filter((n) => n.locked);
  $("notelist").innerHTML = list.map((n) =>
    `<div class="note-row ${n.name === active && !activeIsTrash ? "on" : ""}" data-name="${esc(n.name)}">
       <i>${n.locked ? ICONS.lock : ICONS.notes}</i>${esc(n.name.replace(/\.(md|txt)$/, ""))}</div>`).join("")
    || `<div class="muted" style="padding:6px 10px">Nothing here</div>`;
  $("cnt-all").textContent = state.notes.length;
  $("cnt-recent").textContent = Math.min(8, state.notes.length);
  $("cnt-locked").textContent = state.notes.filter((n) => n.locked).length;
  $("cnt-trash").textContent = state.trash_count;
  document.querySelectorAll("[data-view]").forEach((b) => b.classList.toggle("active", b.dataset.view === view));
}

async function renderTrashList() {
  trashItems = await api().list_trash();
  $("notelist").innerHTML = trashItems.map((t) =>
    `<div class="note-row ${t.name === active && activeIsTrash ? "on" : ""}" data-trash="${esc(t.name)}">
       <i>${ICONS.trash}</i>${esc(t.title.replace(/\.(md|txt)$/, ""))}</div>`).join("")
    || `<div class="muted" style="padding:6px 10px">Trash is empty</div>`;
}

// ----- tabs -----
function renderTabs() {
  $("tabbar").innerHTML = openTabs.map((n) =>
    `<div class="tab ${n === active && !activeIsTrash ? "active" : ""}" data-name="${esc(n)}">${esc(n.replace(/\.(md|txt)$/, ""))}<span class="x" data-close="${esc(n)}">✕</span></div>`).join("");
}

// ----- editor -----
function showLock(title, hint, buttons) {
  $("lock-title").textContent = title;
  $("lock-hint").textContent = hint;
  $("lock-actions").innerHTML = buttons.map((b) => `<button class="${b.cls}" data-act="${b.act}">${b.label}</button>`).join("");
  $("lockscreen").classList.remove("hidden");
}
function hideLock() { $("lockscreen").classList.add("hidden"); }

async function openNote(name) {
  if (active && !activeIsTrash && dirty) await flush();
  if (!openTabs.includes(name)) openTabs.push(name);
  active = name;
  activeIsTrash = false;
  await loadActive();
}

async function loadActive() {
  const r = await api().read_note(active);
  locked = r.locked;
  $("editor").value = r.text;
  $("editor").readOnly = locked;
  dirty = false;
  $("saved").textContent = "Saved";
  if (locked) {
    showLock("This note is locked", "Enter the password to open it.", [
      { cls: "primary", act: "unlock", label: "Unlock" },
    ]);
  } else {
    hideLock();
  }
  $("lock-btn").innerHTML = `<i>${locked ? ICONS.unlock : ICONS.lock}</i> ${locked ? "Remove lock" : "Lock"}`;
  renderTabs();
  renderNoteList();
  updatePreview();
  updateCounts();
}

async function openTrash(name) {
  active = name;
  activeIsTrash = true;
  locked = false;
  $("editor").readOnly = true;
  $("editor").value = await api().read_trash(name);
  showLock("Deleted note", "Restore it to edit, or delete it forever.", [
    { cls: "primary", act: "restore", label: "Restore" },
    { cls: "ghost", act: "forever", label: "Delete forever" },
  ]);
  renderTabs();
  renderTrashList();
  updatePreview();
  updateCounts();
}

async function closeTab(name) {
  if (active === name && dirty) await flush();
  if (active === name) await api().relock_note(name);
  openTabs = openTabs.filter((n) => n !== name);
  if (active === name) {
    active = openTabs[openTabs.length - 1] || null;
    activeIsTrash = false;
    if (active) return loadActive();
    $("editor").value = "";
    hideLock();
  }
  renderTabs();
}

async function flush() {
  if (!active || activeIsTrash || !dirty || locked) return;
  $("saved").textContent = "Saving...";
  const t = await api().save_note(active, $("editor").value);
  dirty = false;
  $("saved").textContent = t === "locked" ? "Locked" : `Saved ${t}`;
}

function scheduleSave() {
  if (locked || activeIsTrash) return;
  dirty = true;
  $("saved").textContent = "Unsaved";
  clearTimeout(saveTimer);
  saveTimer = setTimeout(flush, 800);
}

// ----- formatting and snippets -----
const FORMATS = {
  bold: ["**", "**"], italic: ["*", "*"], h1: ["# ", ""], list: ["- ", ""],
  check: ["- [ ] ", ""], quote: ["> ", ""], code: ["`", "`"], link: ["[", "](url)"],
};
function applyFormat(key) {
  if (locked || activeIsTrash) return;
  const ed = $("editor");
  const [pre, post] = FORMATS[key];
  const s = ed.selectionStart, e = ed.selectionEnd;
  const sel = ed.value.slice(s, e);
  ed.value = ed.value.slice(0, s) + pre + sel + post + ed.value.slice(e);
  ed.focus();
  ed.selectionStart = s + pre.length;
  ed.selectionEnd = s + pre.length + sel.length;
  scheduleSave(); updatePreview(); updateCounts();
}
function expandSnippet(ev) {
  if (locked || activeIsTrash) return;
  const ed = $("editor");
  if (ev.key !== " " && ev.key !== "Enter") return;
  const before = ed.value.slice(0, ed.selectionStart);
  const m = before.match(/(\S+)$/);
  const snip = m && state.data.snippets[m[1]];
  if (!snip) return;
  ev.preventDefault();
  const start = before.length - m[1].length;
  ed.value = ed.value.slice(0, start) + snip + ed.value.slice(ed.selectionStart);
  ed.selectionStart = ed.selectionEnd = start + snip.length;
  scheduleSave(); updatePreview();
}

// ----- password prompt -----
function askPassword(title) {
  return new Promise((resolve) => {
    $("pw-title").textContent = title;
    $("pw-input").value = "";
    const dlg = $("pw-dialog");
    const done = (v) => { dlg.close(); resolve(v); };
    $("pw-ok").onclick = () => done($("pw-input").value);
    $("pw-cancel").onclick = () => done(null);
    $("pw-input").onkeydown = (e) => { if (e.key === "Enter") done($("pw-input").value); };
    dlg.showModal();
    $("pw-input").focus();
  });
}

// ----- lock actions -----
async function onLockAction(act) {
  if (act === "unlock") {
    const pw = await askPassword("Password");
    if (pw === null) return;
    const ok = await api().unlock_note(active, pw);
    if (!ok) return showLock("Wrong password", "Try again.", [{ cls: "primary", act: "unlock", label: "Unlock" }]);
    return loadActive();
  }
  if (act === "restore") {
    await api().restore_note(active);
    active = null;
    await refresh();
    return;
  }
  if (act === "forever") {
    await api().delete_forever(active);
    active = null;
    await refresh();
    return;
  }
}

async function toggleLock() {
  if (activeIsTrash || !active) return;
  if (locked) {
    const pw = await askPassword("Enter password to remove the lock");
    if (pw === null) return;
    if (!(await api().unlock_note(active, pw))) return alert("Wrong password");
    await api().remove_lock(active);
    return loadActive();
  }
  const pw = await askPassword("Set a password for this note");
  if (!pw) return;
  await flush();
  await api().lock_note(active, pw);
  return loadActive();
}

// ----- theme, snippets, calendar, todo -----
function renderThemes() {
  const cur = state.data.theme || "dark";
  document.body.dataset.theme = cur;
  $("theme-row").innerHTML = THEMES.map((t) =>
    `<button class="theme-chip ${t.id === cur ? "on" : ""}" data-theme="${t.id}">
       <div class="sw" style="background:linear-gradient(135deg,${t.c[0]},${t.c[1]})"></div>${t.label}</button>`).join("");
}
function renderSnippets() {
  $("snip-list").innerHTML = Object.entries(state.data.snippets || {}).map(([k, v]) =>
    `<div><b>${esc(k)}</b><span>→</span><span>${esc(v)}</span></div>`).join("");
}
function todayKey(d) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
function renderCalendar() {
  const y = calDate.getFullYear(), m = calDate.getMonth();
  $("cal-title").textContent = calDate.toLocaleString("en", { month: "long", year: "numeric" });
  const first = new Date(y, m, 1).getDay();
  const days = new Date(y, m + 1, 0).getDate();
  const today = todayKey(new Date());
  const evDates = new Set((state.data.events || []).map((e) => e.date));
  let html = ["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((x) => `<div class="dow">${x}</div>`).join("");
  for (let i = 0; i < first; i++) html += "<div></div>";
  for (let d = 1; d <= days; d++) {
    const key = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const cls = ["day", key === today ? "today" : "", evDates.has(key) ? "ev" : ""].join(" ");
    html += `<div class="${cls}">${d}</div>`;
  }
  $("cal-grid").innerHTML = html;
  $("cal-events").innerHTML = (state.data.events || []).slice(0, 4).map((e) =>
    `<div><b>${esc(e.title)}</b><br><small>${esc(e.date)} · ${esc(e.time)}</small></div>`).join("");
}
function renderTodos() {
  $("todo-list").innerHTML = (state.data.todos || []).map((t, i) =>
    `<div class="${t.done ? "done" : ""}" data-i="${i}"><input type="checkbox" ${t.done ? "checked" : ""}><span>${esc(t.text)}</span></div>`).join("");
}
async function saveData(key, value) {
  state.data[key] = value;
  await api().save_data(key, value);
}

// ----- refresh -----
async function refresh() {
  const a = api();
  if (!a) return;
  state = await a.get_state();
  const names = state.notes.map((n) => n.name);
  openTabs = openTabs.filter((n) => names.includes(n));
  if (!activeIsTrash && active && !names.includes(active)) active = null;
  if (view === "trash") await renderTrashList(); else renderNoteList();
  renderThemes(); renderSnippets(); renderCalendar(); renderTodos();
  renderTabs();
  $("sync-text").textContent = state.status || "Not synced yet";
  $("sync-status").textContent = "Sync: " + (state.status ? state.status.replace(/^sync:\s*/, "") : "idle");
  $("cnt-trash").textContent = state.trash_count;
}

function setView(v) {
  view = v;
  document.querySelectorAll("[data-view]").forEach((b) => b.classList.toggle("active", b.dataset.view === v));
  if (v === "trash") renderTrashList(); else renderNoteList();
}

// ----- wiring -----
function wire() {
  paintIcons();
  $("editor").addEventListener("input", () => { scheduleSave(); updatePreview(); updateCounts(); });
  $("editor").addEventListener("keyup", updateCounts);
  $("editor").addEventListener("click", updateCounts);
  $("editor").addEventListener("keydown", expandSnippet);
  document.querySelectorAll("[data-fmt]").forEach((b) => b.onclick = () => applyFormat(b.dataset.fmt));
  $("lock-btn").onclick = toggleLock;
  $("lock-actions").onclick = (e) => { const b = e.target.closest("[data-act]"); if (b) onLockAction(b.dataset.act); };
  $("toggle-preview").onclick = () => {
    showPreview = !showPreview;
    $("preview-pane").classList.toggle("hidden", !showPreview);
    updatePreview();
  };
  $("new-note").onclick = async () => {
    const name = await api().new_note();
    view = "all";
    await refresh();
    openNote(name);
  };
  $("tabbar").onclick = (e) => {
    const c = e.target.closest("[data-close]");
    if (c) return closeTab(c.dataset.close);
    const t = e.target.closest("[data-name]");
    if (t) openNote(t.dataset.name);
  };
  $("notelist").onclick = (e) => {
    const t = e.target.closest("[data-trash]");
    if (t) return openTrash(t.dataset.trash);
    const n = e.target.closest("[data-name]");
    if (n) openNote(n.dataset.name);
  };
  document.querySelectorAll("[data-view]").forEach((b) => b.onclick = () => setView(b.dataset.view));
  $("find").oninput = () => (view === "trash" ? renderTrashList() : renderNoteList());
  $("sync-btn").onclick = async () => { $("sync-text").textContent = "Syncing..."; state.status = await api().sync_now(); renderAll(); };
  $("theme-row").onclick = async (e) => {
    const b = e.target.closest("[data-theme]");
    if (!b) return;
    state.data.theme = b.dataset.theme;
    await api().set_theme(b.dataset.theme);
    renderThemes();
  };
  $("cal-prev").onclick = () => { calDate = new Date(calDate.getFullYear(), calDate.getMonth() - 1, 1); renderCalendar(); };
  $("cal-next").onclick = () => { calDate = new Date(calDate.getFullYear(), calDate.getMonth() + 1, 1); renderCalendar(); };
  $("snip-add").onclick = async () => {
    const k = prompt("Shortcut (for example: sig)");
    if (!k) return;
    const v = prompt("Expands to");
    if (v === null) return;
    await saveData("snippets", { ...state.data.snippets, [k]: v });
    renderSnippets();
  };
  $("todo-input").addEventListener("keydown", async (e) => {
    if (e.key !== "Enter" || !e.target.value.trim()) return;
    const list = [...(state.data.todos || []), { text: e.target.value.trim(), done: false }];
    e.target.value = "";
    await saveData("todos", list);
    renderTodos();
  });
  $("todo-list").onchange = async (e) => {
    const i = +e.target.closest("[data-i]").dataset.i;
    const list = state.data.todos.map((t, j) => (j === i ? { ...t, done: e.target.checked } : t));
    await saveData("todos", list);
    renderTodos();
  };
  document.querySelectorAll("[data-go]").forEach((b) => b.onclick = () => {
    const el = $(b.dataset.go === "todo" ? "todo" : b.dataset.go);
    if (el) el.scrollIntoView({ behavior: "smooth", block: "center" });
  });
  $("open-settings").onclick = () => $("settings-dialog").showModal();
  $("set-close").onclick = () => $("settings-dialog").close();
  $("set-sync").onclick = async () => { state.status = await api().sync_now(); refresh(); };
  $("set-reset").onclick = async () => { await api().reset_login(); $("settings-dialog").close(); refresh(); };

  // trash toolbar: empty trash from the trash view
  $("find").addEventListener("dblclick", async () => {
    if (view === "trash" && confirm("Empty trash forever?")) { await api().empty_trash(); activeIsTrash = false; active = null; refresh(); }
  });
  setInterval(refresh, 4000);
}

window.addEventListener("pywebviewready", async () => {
  wire();
  await refresh();
  if (state.notes.length) openNote(state.notes[0].name);
});
