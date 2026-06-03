const DB_NAME = "time-ledger-db";
const DB_VERSION = 1;
const ACTIVE_KEY = "activeSession";
const defaultCategories = [
  { id: "homework", name: "写作业", color: "#6f947f", icon: "pen", sortOrder: 0, archived: false },
  { id: "ai-study", name: "AI讨论学习", color: "#7ea4c9", icon: "brain", sortOrder: 1, archived: false },
  { id: "rest", name: "水（休息）", color: "#c8ad7b", icon: "cup", sortOrder: 2, archived: false },
  { id: "hobby", name: "发展爱好", color: "#a37aa0", icon: "palette", sortOrder: 3, archived: false },
];
const iconOptions = ["pen", "brain", "cup", "palette", "book", "star", "music", "walk"];
const paletteOptions = ["#6f947f", "#7ea4c9", "#c8ad7b", "#a37aa0", "#c86d72", "#5f8f92", "#8f8067", "#7b86bd"];
const iconSvg = {
  pen: '<path d="M15 4l5 5L8 21H3v-5L15 4z"/><path d="M13 6l5 5"/><path d="M3 21h9"/>',
  brain: '<path d="M9 4a3 3 0 0 0-3 3v.4A3.2 3.2 0 0 0 4 10.4 3.4 3.4 0 0 0 6 17v.3A3.7 3.7 0 0 0 12 20V4a3 3 0 0 0-3-3z"/><path d="M15 4a3 3 0 0 1 3 3v.4a3.2 3.2 0 0 1 2 3A3.4 3.4 0 0 1 18 17v.3A3.7 3.7 0 0 1 12 20V4a3 3 0 0 1 3-3z"/>',
  cup: '<path d="M4 8h12v7a4 4 0 0 1-4 4H8a4 4 0 0 1-4-4V8z"/><path d="M16 10h2a3 3 0 0 1 0 6h-2"/><path d="M7 3v2"/><path d="M11 3v2"/><path d="M15 3v2"/>',
  palette: '<path d="M12 3a9 9 0 0 0 0 18h2a2 2 0 0 0 1-3.73 1.5 1.5 0 0 1 .75-2.8H17a6 6 0 0 0 0-12h-5z"/><circle cx="7.5" cy="10" r=".9"/><circle cx="10" cy="7" r=".9"/><circle cx="14" cy="7" r=".9"/><circle cx="17" cy="10" r=".9"/>',
  book: '<path d="M4 5.5A2.5 2.5 0 0 1 6.5 3H20v17H6.5A2.5 2.5 0 0 1 4 17.5z"/><path d="M4 17.5A2.5 2.5 0 0 0 6.5 20H20"/><path d="M8 7h8"/>',
  star: '<path d="M12 3l2.7 5.5 6.1.9-4.4 4.3 1 6-5.4-2.8-5.4 2.8 1-6-4.4-4.3 6.1-.9L12 3z"/>',
  music: '<path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>',
  walk: '<path d="M13 4a1.7 1.7 0 1 1 0 3.4A1.7 1.7 0 0 1 13 4z"/><path d="M12 8l-2 4 3 2 1 6"/><path d="M10 12l-3 2"/><path d="M13 14l4 1"/><path d="M9 20l2-5"/>',
};
const state = {
  categories: [],
  entries: [],
  active: null,
  selectedDate: dateKey(new Date()),
};
let dbPromise;

const els = {
  grid: document.getElementById("categoryGrid"),
  activeText: document.getElementById("activeText"),
  activeDuration: document.getElementById("activeDuration"),
  activeDot: document.getElementById("activeDot"),
  modalRoot: document.getElementById("modalRoot"),
};

function openDb() {
  if (dbPromise) return dbPromise;
  dbPromise = new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onupgradeneeded = () => {
      const db = request.result;
      if (!db.objectStoreNames.contains("categories")) db.createObjectStore("categories", { keyPath: "id" });
      if (!db.objectStoreNames.contains("entries")) {
        const entries = db.createObjectStore("entries", { keyPath: "id" });
        entries.createIndex("startedAt", "startedAt");
        entries.createIndex("categoryId", "categoryId");
      }
      if (!db.objectStoreNames.contains("meta")) db.createObjectStore("meta");
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
  return dbPromise;
}

function req(request) {
  return new Promise((resolve, reject) => {
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

async function store(name, mode) {
  const db = await openDb();
  return db.transaction(name, mode).objectStore(name);
}

async function txDone(tx) {
  return new Promise((resolve, reject) => {
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
}

async function getCategories() {
  const categoryStore = await store("categories", "readonly");
  const categories = await req(categoryStore.getAll());
  if (categories.length) return sortCategories(categories);
  await saveCategories(defaultCategories);
  return defaultCategories;
}

async function saveCategories(categories) {
  const db = await openDb();
  const tx = db.transaction("categories", "readwrite");
  const categoryStore = tx.objectStore("categories");
  categories.forEach((category) => categoryStore.put(category));
  await txDone(tx);
}

async function saveCategory(category) {
  const categoryStore = await store("categories", "readwrite");
  await req(categoryStore.put(category));
}

async function getEntries() {
  const entryStore = await store("entries", "readonly");
  return req(entryStore.getAll());
}

async function addEntry(entry) {
  const entryStore = await store("entries", "readwrite");
  await req(entryStore.put(entry));
}

async function getActiveSession() {
  const metaStore = await store("meta", "readonly");
  return (await req(metaStore.get(ACTIVE_KEY))) || null;
}

async function setActiveSession(active) {
  const metaStore = await store("meta", "readwrite");
  if (active) await req(metaStore.put(active, ACTIVE_KEY));
  else await req(metaStore.delete(ACTIVE_KEY));
}

async function clearEntries() {
  const db = await openDb();
  const tx = db.transaction(["entries", "meta"], "readwrite");
  tx.objectStore("entries").clear();
  tx.objectStore("meta").delete(ACTIVE_KEY);
  await txDone(tx);
}

function uid(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function sortCategories(categories) {
  return [...categories].sort((a, b) => a.sortOrder - b.sortOrder);
}

function msBetween(startedAt, endedAt = new Date().toISOString()) {
  return Math.max(0, new Date(endedAt).getTime() - new Date(startedAt).getTime());
}

function formatDuration(ms) {
  const minutes = Math.floor(ms / 60000);
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours <= 0) return `${rest}分钟`;
  return `${hours}小时${String(rest).padStart(2, "0")}分钟`;
}

function formatClock(value) {
  return new Intl.DateTimeFormat("zh-CN", { hour: "2-digit", minute: "2-digit", hour12: false }).format(new Date(value));
}

function dateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function sameLocalDay(value, key) {
  return dateKey(new Date(value)) === key;
}

function dayBounds(key) {
  const start = new Date(`${key}T00:00:00`);
  const end = new Date(start);
  end.setDate(start.getDate() + 1);
  return [start.getTime(), end.getTime()];
}

function svgIcon(name, size = 54) {
  return `<svg class="category-icon" width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${iconSvg[name] || iconSvg.star}</svg>`;
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

function virtualEntries() {
  if (!state.active) return state.entries;
  return [
    ...state.entries,
    {
      id: "active-preview",
      categoryId: state.active.categoryId,
      startedAt: state.active.startedAt,
      endedAt: new Date().toISOString(),
      durationMs: msBetween(state.active.startedAt),
    },
  ];
}

function entriesForDate(selectedDate) {
  const [dayStart, dayEnd] = dayBounds(selectedDate);
  return virtualEntries()
    .map((entry) => {
      const start = new Date(entry.startedAt).getTime();
      const end = new Date(entry.endedAt).getTime();
      const clippedStart = Math.max(start, dayStart);
      const clippedEnd = Math.min(end, dayEnd);
      if (clippedEnd <= clippedStart) return null;
      return { ...entry, durationMs: clippedEnd - clippedStart };
    })
    .filter(Boolean);
}

async function stopActive() {
  if (!state.active) return;
  const endedAt = new Date().toISOString();
  const entry = {
    id: uid("entry"),
    categoryId: state.active.categoryId,
    startedAt: state.active.startedAt,
    endedAt,
    durationMs: msBetween(state.active.startedAt, endedAt),
  };
  if (entry.durationMs >= 1000) {
    await addEntry(entry);
    state.entries.push(entry);
  }
  await setActiveSession(null);
  state.active = null;
  render();
}

async function toggleCategory(category) {
  if (state.active?.categoryId === category.id) {
    await stopActive();
    return;
  }
  if (state.active) await stopActive();
  state.active = { categoryId: category.id, startedAt: new Date().toISOString() };
  await setActiveSession(state.active);
  render();
}

function render() {
  const activeCategory = state.categories.find((category) => category.id === state.active?.categoryId);
  els.activeText.textContent = activeCategory ? `正在${activeCategory.name}` : "当前未开始";
  els.activeDuration.textContent = formatDuration(state.active ? msBetween(state.active.startedAt) : 0);
  els.activeDot.style.background = activeCategory?.color || "#9aa3aa";
  els.grid.innerHTML = "";
  sortCategories(state.categories)
    .filter((category) => !category.archived)
    .forEach((category) => {
      const button = document.createElement("button");
      button.type = "button";
      button.className = `category-card${state.active?.categoryId === category.id ? " is-active" : ""}`;
      button.style.background = category.color;
      button.innerHTML = `${state.active?.categoryId === category.id ? '<span class="active-mark"></span>' : ""}${svgIcon(category.icon)}<span class="label">${escapeHtml(category.name)}</span>`;
      button.addEventListener("click", () => toggleCategory(category));
      els.grid.appendChild(button);
    });
}

function buildStats(selectedDate) {
  const filtered = entriesForDate(selectedDate);
  const totals = new Map();
  filtered.forEach((entry) => totals.set(entry.categoryId, (totals.get(entry.categoryId) || 0) + entry.durationMs));
  const rows = sortCategories(state.categories)
    .map((category) => ({ category, durationMs: totals.get(category.id) || 0 }))
    .filter((row) => row.durationMs > 0)
    .sort((a, b) => b.durationMs - a.durationMs);
  return {
    rows,
    totalMs: rows.reduce((sum, row) => sum + row.durationMs, 0),
    entries: filtered.sort((a, b) => new Date(b.startedAt).getTime() - new Date(a.startedAt).getTime()),
  };
}

function piePath(cx, cy, r, start, end) {
  const startX = cx + r * Math.cos(start);
  const startY = cy + r * Math.sin(start);
  const endX = cx + r * Math.cos(end);
  const endY = cy + r * Math.sin(end);
  const largeArc = end - start > Math.PI ? 1 : 0;
  return `M ${cx} ${cy} L ${startX} ${startY} A ${r} ${r} 0 ${largeArc} 1 ${endX} ${endY} Z`;
}

function openStats() {
  const stats = buildStats(state.selectedDate);
  let angle = -Math.PI / 2;
  const slices =
    stats.totalMs === 0
      ? '<circle cx="110" cy="110" r="78" fill="#e7e2d9"></circle>'
      : stats.rows
          .map((row) => {
            const slice = (row.durationMs / stats.totalMs) * Math.PI * 2;
            const path = piePath(110, 110, 86, angle, angle + slice);
            angle += slice;
            return `<path d="${path}" fill="${row.category.color}"></path>`;
          })
          .join("");
  const ranks = stats.rows.length
    ? stats.rows
        .map(
          (row) => `<div class="rank-item">
            <span class="swatch" style="background:${row.category.color}"></span>
            <span class="name">${escapeHtml(row.category.name)}</span>
            <strong>${Math.round((row.durationMs / stats.totalMs) * 100)}%</strong>
            <em>${formatDuration(row.durationMs)}</em>
          </div>`,
        )
        .join("")
    : '<p class="empty">这天还没有记录</p>';
  const details = stats.entries.length
    ? stats.entries
        .map((entry) => {
          const category = state.categories.find((item) => item.id === entry.categoryId);
          return `<article class="entry-item">
            <span class="swatch" style="background:${category?.color || "#9aa3aa"}"></span>
            <div>
              <strong>${escapeHtml(category?.name || "已删除分类")}</strong>
              <p>${formatClock(entry.startedAt)} - ${entry.id === "active-preview" ? "进行中" : formatClock(entry.endedAt)}</p>
            </div>
            <b>${formatDuration(entry.durationMs)}</b>
          </article>`;
        })
        .join("")
    : '<p class="empty">没有可显示的流水。</p>';

  els.modalRoot.innerHTML = `<section class="modal-backdrop" role="dialog" aria-modal="true" aria-label="全部统计">
    <div class="sheet">
      <div class="sheet-header">
        <div><p>今日统计</p><h2>${formatDuration(stats.totalMs)}</h2></div>
        <button class="icon-button" id="closeModal" type="button" aria-label="关闭统计">×</button>
      </div>
      <input class="date-input" id="dateInput" type="date" value="${state.selectedDate}">
      <div class="chart-row">
        <svg class="pie-chart" viewBox="0 0 220 220" aria-label="分类占比饼图">${slices}<circle cx="110" cy="110" r="48" fill="#f8f7f2"></circle></svg>
        <div class="rank-list">${ranks}</div>
      </div>
      <h3>流水明细</h3>
      <div class="entry-list">${details}</div>
    </div>
  </section>`;
  document.getElementById("closeModal").addEventListener("click", closeModal);
  document.getElementById("dateInput").addEventListener("change", (event) => {
    state.selectedDate = event.target.value || dateKey(new Date());
    openStats();
  });
}

function openSettings() {
  const rows = sortCategories(state.categories)
    .filter((category) => !category.archived)
    .map(
      (category) => `<article class="settings-item">
        <span class="icon-chip" style="background:${category.color}">${svgIcon(category.icon, 22)}</span>
        <strong>${escapeHtml(category.name)}</strong>
        <button class="text-button edit-category" type="button" data-id="${category.id}">编辑</button>
        <button class="icon-button quiet archive-category" type="button" data-id="${category.id}" aria-label="删除${escapeHtml(category.name)}">⌫</button>
      </article>`,
    )
    .join("");
  els.modalRoot.innerHTML = `<section class="modal-backdrop" role="dialog" aria-modal="true" aria-label="分类设置">
    <div class="sheet">
      <div class="sheet-header">
        <div><p>分类设置</p><h2>卡片和颜色</h2></div>
        <button class="icon-button" id="closeModal" type="button" aria-label="关闭设置">×</button>
      </div>
      <div class="settings-list">${rows}</div>
      <button class="add-button" id="addCategory" type="button">＋ 新增分类</button>
    </div>
  </section>`;
  document.getElementById("closeModal").addEventListener("click", closeModal);
  document.getElementById("addCategory").addEventListener("click", () => editCategory({
    id: uid("category"),
    name: "新分类",
    color: paletteOptions[state.categories.length % paletteOptions.length],
    icon: "star",
    sortOrder: state.categories.length,
    archived: false,
  }));
  document.querySelectorAll(".edit-category").forEach((button) => {
    button.addEventListener("click", () => editCategory(state.categories.find((category) => category.id === button.dataset.id)));
  });
  document.querySelectorAll(".archive-category").forEach((button) => {
    button.addEventListener("click", async () => {
      const category = state.categories.find((item) => item.id === button.dataset.id);
      if (!category) return;
      await upsertCategory({ ...category, archived: true });
      openSettings();
    });
  });
}

function editCategory(category) {
  const colors = paletteOptions
    .map((color) => `<button class="color-dot${category.color === color ? " selected" : ""}" data-color="${color}" type="button" style="background:${color}" aria-label="选择颜色${color}"></button>`)
    .join("");
  const icons = iconOptions
    .map((icon) => `<button class="icon-option${category.icon === icon ? " selected" : ""}" data-icon="${icon}" type="button" aria-label="选择图标${icon}">${svgIcon(icon, 22)}</button>`)
    .join("");
  const popover = document.createElement("div");
  popover.className = "editor-popover";
  popover.innerHTML = `<div class="editor-header">
      <strong>编辑分类</strong>
      <button class="icon-button" id="closeEditor" type="button" aria-label="取消编辑">×</button>
    </div>
    <input class="name-input" id="categoryName" value="${escapeHtml(category.name)}" maxlength="12" aria-label="分类名称">
    <div class="option-grid">${colors}</div>
    <div class="option-grid">${icons}</div>
    <button class="save-button" id="saveCategory" type="button">✓ 保存</button>`;
  document.querySelector(".editor-popover")?.remove();
  document.body.appendChild(popover);
  let draft = { ...category };
  document.getElementById("closeEditor").addEventListener("click", () => popover.remove());
  document.querySelectorAll(".color-dot").forEach((button) => {
    button.addEventListener("click", () => {
      draft.color = button.dataset.color;
      editCategory(draft);
    });
  });
  document.querySelectorAll(".icon-option").forEach((button) => {
    button.addEventListener("click", () => {
      draft.icon = button.dataset.icon;
      editCategory(draft);
    });
  });
  document.getElementById("saveCategory").addEventListener("click", async () => {
    const name = document.getElementById("categoryName").value.trim();
    if (!name) return;
    await upsertCategory({ ...draft, name });
    popover.remove();
    openSettings();
  });
}

async function upsertCategory(category) {
  await saveCategory(category);
  const exists = state.categories.some((item) => item.id === category.id);
  state.categories = sortCategories(exists ? state.categories.map((item) => (item.id === category.id ? category : item)) : [...state.categories, category]);
  render();
}

function closeModal() {
  document.querySelector(".editor-popover")?.remove();
  els.modalRoot.innerHTML = "";
}

async function handleClear() {
  if (!window.confirm("确定清空所有时间记录吗？分类设置会保留。")) return;
  await setActiveSession(null);
  state.active = null;
  await clearEntries();
  state.entries = [];
  closeModal();
  render();
}

async function init() {
  [state.categories, state.entries, state.active] = await Promise.all([getCategories(), getEntries(), getActiveSession()]);
  render();
  window.setInterval(() => {
    render();
    if (els.modalRoot.textContent.includes("今日统计")) openStats();
  }, 1000);
  document.getElementById("statsButton").addEventListener("click", openStats);
  document.getElementById("settingsButton").addEventListener("click", openSettings);
  document.getElementById("clearButton").addEventListener("click", handleClear);
}

if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => {
    navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  });
}

init().catch((error) => {
  els.grid.innerHTML = `<p class="empty">载入失败：${escapeHtml(error.message || error)}</p>`;
});
