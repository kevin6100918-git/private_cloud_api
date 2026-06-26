const API = "/api/files";
const RAW = "/api/raw";
const STORAGE_KEY = "showHidden";

const FILE_ICONS = {
  dir:      "📁",
  text:     "📝",
  image:    "🖼️",
  video:    "🎬",
  audio:    "🎵",
  pdf:      "📕",
  document: "📄",
  unknown:  "📎",
};

let currentPath = "";
let showHidden = localStorage.getItem(STORAGE_KEY) === "true";

document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("toggle-hidden");
  toggle.checked = showHidden;
  toggle.addEventListener("change", () => {
    showHidden = toggle.checked;
    localStorage.setItem(STORAGE_KEY, showHidden);
    navigate(currentPath, false);
  });

  document.getElementById("btn-media-close").addEventListener("click", closeMediaViewer);
  document.getElementById("media-overlay").addEventListener("click", closeMediaViewer);
});

window.addEventListener("popstate", (e) => {
  navigate(e.state?.path ?? "", false);
});

// ── 目錄導覽 ──────────────────────────────────────────────

async function navigate(path, pushHistory = true) {
  currentPath = path;
  if (pushHistory) {
    history.pushState({ path }, "", path ? `#${path}` : location.pathname);
  }
  updateTitle(path);
  const res = await fetch(`${API}/${path}?show_hidden=${showHidden}`);
  if (!res.ok) return alert("無法讀取目錄：" + path);
  const data = await res.json();
  renderBreadcrumb(path);
  renderFileList(data.entries);
}

function updateTitle(name) {
  document.title = name ? name.split("/").pop() : "我的硬碟";
}

function renderBreadcrumb(path) {
  const el = document.getElementById("breadcrumb");
  const parts = path ? path.split("/") : [];
  const items = [{ label: "我的硬碟", path: "" }];
  parts.forEach((part, i) => {
    items.push({ label: part, path: parts.slice(0, i + 1).join("/") });
  });
  el.innerHTML = items
    .map((item, i) =>
      i < items.length - 1
        ? `<a href="#" data-path="${item.path}">${item.label}</a> /`
        : `<span>${item.label}</span>`
    )
    .join(" ");
  el.querySelectorAll("a[data-path]").forEach((a) =>
    a.addEventListener("click", (e) => {
      e.preventDefault();
      navigate(a.dataset.path);
    })
  );
}

function renderFileList(entries) {
  const el = document.getElementById("file-list");
  if (!entries.length) {
    el.innerHTML = "<p>（空目錄）</p>";
    return;
  }
  el.innerHTML = entries
    .map((entry) => {
      const icon = entry.type === "dir"
        ? FILE_ICONS.dir
        : (FILE_ICONS[entry.file_type] ?? FILE_ICONS.unknown);
      return `<div class="entry ${entry.type}" data-name="${entry.name}" data-file-type="${entry.file_type ?? ""}">
        <span class="icon">${icon}</span>
        <span class="name">${entry.name}</span>
        ${entry.size != null ? `<span class="size">${formatSize(entry.size)}</span>` : ""}
        ${entry.type === "file" ? `<button class="btn-delete" data-name="${entry.name}">刪除</button>` : ""}
      </div>`;
    })
    .join("");

  el.querySelectorAll(".entry").forEach((row) => {
    const name = row.dataset.name;
    const fileType = row.dataset.fileType;
    const isDir = row.classList.contains("dir");
    row.querySelector(".name").addEventListener("click", () => {
      const target = currentPath ? `${currentPath}/${name}` : name;
      isDir ? navigate(target) : openFile(target, fileType);
    });
  });

  el.querySelectorAll(".btn-delete").forEach((btn) => {
    btn.addEventListener("click", async (e) => {
      e.stopPropagation();
      const target = currentPath ? `${currentPath}/${btn.dataset.name}` : btn.dataset.name;
      if (!confirm(`確定要刪除 ${btn.dataset.name}？`)) return;
      const res = await fetch(`${API}/${target}`, { method: "DELETE" });
      if (res.ok) navigate(currentPath, false);
      else alert("刪除失敗");
    });
  });
}

// ── 檔案開啟分流 ──────────────────────────────────────────

function openFile(path, fileType) {
  switch (fileType) {
    case "text":
    case "image":
    case "video":
    case "audio":
    case "pdf":
      openMediaViewer(path, fileType);
      break;
    default:
      triggerDownload(path);
  }
}

// ── 媒體瀏覽器（含文字編輯器） ───────────────────────────

async function openMediaViewer(path, fileType) {
  const filename = path.split("/").pop();
  const rawUrl = `${RAW}/${path}`;
  const body = document.getElementById("media-body");
  const saveBtn = document.getElementById("btn-media-save");
  const dlBtn = document.getElementById("btn-raw-download");

  document.title = filename;
  document.getElementById("media-filename").textContent = filename;
  dlBtn.href = rawUrl;
  dlBtn.download = filename;
  body.innerHTML = "";

  if (fileType === "text") {
    body.classList.add("text-mode");
    saveBtn.hidden = false;

    const res = await fetch(`${API}/${path}`);
    if (!res.ok) return alert("無法讀取檔案");
    const data = await res.json();

    const textarea = document.createElement("textarea");
    textarea.value = data.content;
    textarea.spellcheck = false;
    body.appendChild(textarea);

    saveBtn.onclick = async () => {
      const r = await fetch(`${API}/${path}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ content: textarea.value }),
      });
      if (r.ok) alert("儲存成功");
      else alert("儲存失敗");
    };
  } else {
    body.classList.remove("text-mode");
    saveBtn.hidden = true;

    if (fileType === "image") {
      body.innerHTML = `<img src="${rawUrl}" alt="${filename}" />`;
    } else if (fileType === "video") {
      body.innerHTML = `<video controls autoplay><source src="${rawUrl}" /></video>`;
    } else if (fileType === "audio") {
      body.innerHTML = `<audio controls autoplay><source src="${rawUrl}" /></audio>`;
    } else if (fileType === "pdf") {
      body.innerHTML = `<iframe src="${rawUrl}" title="${filename}"></iframe>`;
    }
  }

  document.getElementById("media-viewer").hidden = false;
}

function closeMediaViewer() {
  document.getElementById("media-viewer").hidden = true;
  const body = document.getElementById("media-body");
  const media = body.querySelector("video, audio");
  if (media) media.pause();
  body.innerHTML = "";
  body.classList.remove("text-mode");
  document.getElementById("btn-media-save").hidden = true;
  updateTitle(currentPath);
}

function triggerDownload(path) {
  const a = document.createElement("a");
  a.href = `${RAW}/${path}`;
  a.download = path.split("/").pop();
  a.click();
}

// ── 工具函式 ──────────────────────────────────────────────

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

// 初始化：讀取 URL hash 還原瀏覽位置
const initialPath = location.hash ? location.hash.slice(1) : "";
history.replaceState({ path: initialPath }, "");
navigate(initialPath, false);
