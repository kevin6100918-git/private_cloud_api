const API = "/api/files";
const STORAGE_KEY = "showHidden";

let currentPath = "";
let showHidden = localStorage.getItem(STORAGE_KEY) === "true";

document.addEventListener("DOMContentLoaded", () => {
  const toggle = document.getElementById("toggle-hidden");
  toggle.checked = showHidden;
  toggle.addEventListener("change", () => {
    showHidden = toggle.checked;
    localStorage.setItem(STORAGE_KEY, showHidden);
    navigate(currentPath, false); // 重新載入同目錄，不推入 history
  });
});

window.addEventListener("popstate", (e) => {
  navigate(e.state?.path ?? "", false);
});

async function navigate(path, pushHistory = true) {
  currentPath = path;
  if (pushHistory) {
    // 根目錄還原成乾淨的 URL，子目錄寫入 hash
    history.pushState({ path }, "", path ? `#${path}` : location.pathname);
  }
  updateTitle(path);
  const res = await fetch(`${API}/${path}?show_hidden=${showHidden}`);
  if (!res.ok) return alert("無法讀取目錄：" + path);
  const data = await res.json();
  renderBreadcrumb(path);
  renderFileList(data.entries);
}

function updateTitle(path) {
  document.title = path ? path.split("/").pop() : "我的硬碟";
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
    .map(
      (entry) =>
        `<div class="entry ${entry.type}" data-name="${entry.name}">
          <span class="icon">${entry.type === "dir" ? "📁" : "📄"}</span>
          <span class="name">${entry.name}</span>
          ${entry.size != null ? `<span class="size">${formatSize(entry.size)}</span>` : ""}
          ${entry.type === "file" ? `<button class="btn-delete" data-name="${entry.name}">刪除</button>` : ""}
        </div>`
    )
    .join("");

  el.querySelectorAll(".entry").forEach((row) => {
    const name = row.dataset.name;
    const type = row.classList.contains("dir") ? "dir" : "file";
    row.querySelector(".name").addEventListener("click", () => {
      const target = currentPath ? `${currentPath}/${name}` : name;
      type === "dir" ? navigate(target) : openEditor(target);
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

async function openEditor(path) {
  const res = await fetch(`${API}/${path}`);
  if (!res.ok) return alert("無法讀取檔案");
  const data = await res.json();
  document.title = path.split("/").pop();
  document.getElementById("editor-filename").textContent = path;
  document.getElementById("editor-content").value = data.content;
  document.getElementById("editor").hidden = false;
  document.getElementById("btn-save").onclick = () => saveFile(path);
  document.getElementById("btn-close").onclick = () => {
    document.getElementById("editor").hidden = true;
    updateTitle(currentPath); // 關閉編輯器後還原目錄標題
  };
}

async function saveFile(path) {
  const content = document.getElementById("editor-content").value;
  const res = await fetch(`${API}/${path}`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ content }),
  });
  if (res.ok) alert("儲存成功");
  else alert("儲存失敗");
}

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 ** 2) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 ** 2).toFixed(1)} MB`;
}

// 初始化：讀取 URL hash 還原瀏覽位置
const initialPath = location.hash ? location.hash.slice(1) : "";
history.replaceState({ path: initialPath }, "");
navigate(initialPath, false);
