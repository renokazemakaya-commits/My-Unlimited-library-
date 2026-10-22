const DB_NAME = "imbakan-db";
const STORE_NAME = "files";
const MAX_FILE_WARNING_SIZE = 250 * 1024 * 1024;

const state = {
  files: [],
  query: "",
  filter: "all",
  isUploading: false,
};

const elements = {
  fileInput: document.getElementById("fileInput"),
  browseBtn: document.getElementById("browseBtn"),
  clearAllBtn: document.getElementById("clearAllBtn"),
  dropZone: document.getElementById("dropZone"),
  searchInput: document.getElementById("searchInput"),
  typeFilter: document.getElementById("typeFilter"),
  fileList: document.getElementById("fileList"),
  emptyState: document.getElementById("emptyState"),
  statusMessage: document.getElementById("statusMessage"),
  storageUsage: document.getElementById("storageUsage"),
};

document.addEventListener("DOMContentLoaded", () => {
  initialize();
});

async function initialize() {
  bindEvents();
  await loadFiles();
  await updateStorageUsage();
}

function bindEvents() {
  elements.fileInput.addEventListener("change", async (event) => {
    await handleUpload(event.target.files);
    event.target.value = "";
  });

  elements.browseBtn.addEventListener("click", () => elements.fileInput.click());

  elements.clearAllBtn.addEventListener("click", clearAllFiles);

  elements.searchInput.addEventListener("input", (event) => {
    state.query = event.target.value.trim().toLowerCase();
    renderFiles();
  });

  elements.typeFilter.addEventListener("change", (event) => {
    state.filter = event.target.value;
    renderFiles();
  });

  elements.fileList.addEventListener("click", async (event) => {
    const trigger = event.target.closest("[data-action]");
    if (!trigger) return;

    const { action, id } = trigger.dataset;
    const file = state.files.find((entry) => entry.id === id);
    if (!file) return;

    if (action === "preview") {
      if (canPreview(file)) {
        openPreview(file);
      } else {
        downloadFile(file);
      }
      return;
    }

    if (action === "download") {
      downloadFile(file);
      return;
    }

    if (action === "delete") {
      await deleteFile(file);
    }
  });

  ["dragenter", "dragover"].forEach((eventName) => {
    elements.dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      elements.dropZone.classList.add("dragover");
    });
  });

  ["dragleave", "drop"].forEach((eventName) => {
    elements.dropZone.addEventListener(eventName, (event) => {
      event.preventDefault();
      elements.dropZone.classList.remove("dragover");
    });
  });

  elements.dropZone.addEventListener("drop", async (event) => {
    const incomingFiles = event.dataTransfer?.files;
    await handleUpload(incomingFiles);
  });

  elements.dropZone.addEventListener("keydown", async (event) => {
    if (event.key === "Enter" || event.key === " ") {
      event.preventDefault();
      elements.fileInput.click();
    }
  });
}

function showStatus(message, type = "success") {
  elements.statusMessage.textContent = message;
  elements.statusMessage.className = `status-message show ${type}`;
}

function openDatabase() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, 1);

    request.onupgradeneeded = (event) => {
      const db = event.target.result;
      if (!db.objectStoreNames.contains(STORE_NAME)) {
        const store = db.createObjectStore(STORE_NAME, { keyPath: "id" });
        store.createIndex("uploadedAt", "uploadedAt", { unique: false });
      }
    };

    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error("Could not open local storage."));
  });
}

async function saveFileRecord(file) {
  const db = await openDatabase();

  return new Promise((resolve, reject) => {
    const transaction = db.transaction(STORE_NAME, "readwrite");
    const store = transaction.objectStore(STORE_NAME);

    const createdFile = {
      id: generateId(),
      name: file.name,
      size: file.size,
      type: file.type || "application/octet-stream",
      mimeType: file.type || "application/octet-stream",
      uploadedAt: new Date().toISOString(),
      category: getCategory(file),
      blob: file,
    };

    const request = store.add(createdFile);
    request.onsuccess = () => resolve(createdFile);
    request.onerror = () => reject(request.error || new Error(`Could not store ${file.name}.`));
  });
}

async function loadFiles() {
  try {
    const db = await openDatabase();

    const result = await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readonly");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.getAll();

      request.onsuccess = () => resolve(request.result || []);
      request.onerror = () => reject(request.error || new Error("Could not load library files."));
    });

    state.files = result
      .sort((a, b) => new Date(b.uploadedAt) - new Date(a.uploadedAt))
      .map((entry) => ({
        ...entry,
        category: entry.category || getCategory({ name: entry.name, type: entry.type }),
      }));

    renderFiles();
  } catch (error) {
    console.error(error);
    showStatus("Your browser storage could not be opened. Try reloading the page.", "error");
  }
}

async function handleUpload(fileList) {
  if (!fileList || !fileList.length) {
    return;
  }

  if (state.isUploading) {
    showStatus("A file upload is already in progress. Please wait a moment.", "warning");
    return;
  }

  const files = Array.from(fileList).filter(Boolean);
  if (!files.length) {
    return;
  }

  state.isUploading = true;
  elements.fileInput.disabled = true;
  elements.clearAllBtn.disabled = true;
  elements.browseBtn.disabled = true;
  showStatus(`Uploading ${files.length} file${files.length > 1 ? "s" : ""}...`, "success");

  try {
    const validFiles = files.filter((file) => {
      if (file.size > 500 * 1024 * 1024) {
        showStatus(`"${file.name}" is very large and may not fit the browser storage limit. Please try a smaller file.`, "warning");
        return false;
      }
      return true;
    });

    if (!validFiles.length) {
      return;
    }

    for (const file of validFiles) {
      if (file.size > MAX_FILE_WARNING_SIZE) {
        showStatus(`The file "${file.name}" is large. Browser storage may be limited.`, "warning");
      }
      await saveFileRecord(file);
    }

    await loadFiles();
    await updateStorageUsage();

    showStatus(`Successfully uploaded ${validFiles.length} file${validFiles.length > 1 ? "s" : ""}.`, "success");
  } catch (error) {
    console.error(error);
    showStatus(error.message || "File upload failed. Please try again.", "error");
  } finally {
    state.isUploading = false;
    elements.fileInput.disabled = false;
    elements.clearAllBtn.disabled = false;
    elements.browseBtn.disabled = false;
  }
}

async function deleteFile(file) {
  const confirmed = window.confirm(`Delete "${file.name}" from your personal library?`);
  if (!confirmed) return;

  try {
    const db = await openDatabase();

    await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.delete(file.id);

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error || new Error("Could not delete the file."));
    });

    state.files = state.files.filter((entry) => entry.id !== file.id);
    renderFiles();
    await updateStorageUsage();
    showStatus(`Deleted "${file.name}".`, "success");
  } catch (error) {
    console.error(error);
    showStatus(error.message || "Could not delete the file.", "error");
  }
}

async function clearAllFiles() {
  if (!state.files.length) {
    showStatus("Your library is already empty.", "warning");
    return;
  }

  const confirmed = window.confirm("Delete all files from this library? This cannot be undone.");
  if (!confirmed) return;

  try {
    const db = await openDatabase();
    await new Promise((resolve, reject) => {
      const transaction = db.transaction(STORE_NAME, "readwrite");
      const store = transaction.objectStore(STORE_NAME);
      const request = store.clear();

      request.onsuccess = () => resolve();
      request.onerror = () => reject(request.error || new Error("Could not clear the library."));
    });

    state.files = [];
    renderFiles();
    await updateStorageUsage();
    showStatus("All files were removed from the library.", "success");
  } catch (error) {
    console.error(error);
    showStatus(error.message || "Could not clear the library.", "error");
  }
}

function renderFiles() {
  const filtered = state.files.filter((file) => {
    const nameMatch = file.name.toLowerCase().includes(state.query);
    const typeMatch = state.filter === "all" || file.category === state.filter;
    return nameMatch && typeMatch;
  });

  elements.emptyState.hidden = filtered.length > 0;

  if (!filtered.length) {
    elements.fileList.innerHTML = "";
    return;
  }

  elements.fileList.innerHTML = filtered
    .map((file) => {
      const previewMarkup = buildPreview(file);
      const uploadedDate = new Date(file.uploadedAt).toLocaleString([], {
        dateStyle: "medium",
        timeStyle: "short",
      });

      return `
        <article class="file-card" aria-label="${escapeHtml(file.name)} file card">
          <div class="preview-box">${previewMarkup}</div>
          <div class="file-body">
            <h3 class="file-name">${escapeHtml(file.name)}</h3>
            <div class="file-meta">
              <span>${labelForCategory(file.category)}</span>
              <span>${formatBytes(file.size)}</span>
              <span>${uploadedDate}</span>
            </div>
            <div class="file-actions">
              ${canPreview(file) ? `<button class="card-action preview" type="button" data-action="preview" data-id="${file.id}">Preview</button>` : ""}
              <button class="card-action download" type="button" data-action="download" data-id="${file.id}">Download</button>
              <button class="card-action delete" type="button" data-action="delete" data-id="${file.id}">Delete</button>
            </div>
          </div>
        </article>
      `;
    })
    .join("");
}

function buildPreview(file) {
  const objectUrl = URL.createObjectURL(file.blob);

  if (file.category === "image") {
    return `<img src="${objectUrl}" alt="${escapeHtml(file.name)} preview" />`;
  }

  if (file.category === "video") {
    return `<video src="${objectUrl}" controls preload="metadata"></video>`;
  }

  if (file.category === "audio") {
    return `<audio src="${objectUrl}" controls preload="metadata"></audio>`;
  }

  return `<div class="file-type-icon">${iconForCategory(file.category)}</div>`;
}

function openPreview(file) {
  const url = URL.createObjectURL(file.blob);
  const previewWindow = window.open(url, "_blank", "noopener,noreferrer");
  if (previewWindow) {
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
}

function downloadFile(file) {
  const url = URL.createObjectURL(file.blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = file.name;
  document.body.appendChild(anchor);
  anchor.click();
  anchor.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

function getCategory(file) {
  const name = (file.name || "").toLowerCase();
  const type = (file.type || "").toLowerCase();

  if (type.startsWith("image/") || /\.(png|jpe?g|gif|webp|bmp|svg|heic|heif)$/i.test(name)) return "image";
  if (type.startsWith("video/") || /\.(mp4|m4v|mov|webm|mkv|avi|3gp)$/i.test(name)) return "video";
  if (type.startsWith("audio/") || /\.(mp3|wav|flac|m4a|aac|ogg|oga)$/i.test(name)) return "audio";
  if (/\.(zip|rar|7z|tar|gz|bz2|xz)$/i.test(name)) return "archive";
  if (
    [
      "application/pdf",
      "application/msword",
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      "application/vnd.ms-excel",
      "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "application/vnd.ms-powerpoint",
      "application/vnd.openxmlformats-officedocument.presentationml.presentation",
      "text/plain",
      "text/csv",
      "application/json",
      "application/ld+json",
      "application/xml",
    ].includes(type) ||
    /\.(pdf|doc|docx|xls|xlsx|ppt|pptx|txt|csv|json|md|rtf)$/i.test(name)
  ) {
    return "document";
  }

  return "other";
}

function canPreview(file) {
  return ["image", "video", "audio"].includes(file.category);
}

function labelForCategory(category) {
  const map = {
    image: "Image",
    video: "Video",
    audio: "Audio",
    archive: "Archive",
    document: "Document",
    other: "Other",
  };

  return map[category] || "File";
}

function iconForCategory(category) {
  const map = {
    image: "IMG",
    video: "VID",
    audio: "AUD",
    archive: "ZIP",
    document: "DOC",
    other: "FILE",
  };

  return map[category] || "FILE";
}

function formatBytes(bytes) {
  if (!Number.isFinite(bytes) || bytes <= 0) return "0 B";

  const units = ["B", "KB", "MB", "GB", "TB"];
  const power = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / 1024 ** power;

  return `${value.toFixed(value >= 10 || power === 0 ? 0 : 1)} ${units[power]}`;
}

function generateId() {
  if (window.crypto && crypto.randomUUID) {
    return crypto.randomUUID();
  }

  return `file-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    '"': "&quot;",
    "'": "&#39;",
  }[char]));
}

async function updateStorageUsage() {
  const usageItem = elements.storageUsage;

  if (!("storage" in navigator) || !navigator.storage.estimate) {
    usageItem.innerHTML = '<span class="meta-label">Used</span><strong>Unavailable</strong>';
    return;
  }

  try {
    const estimate = await navigator.storage.estimate();
    const used = estimate.usage || 0;
    const quota = estimate.quota || 0;

    const usedText = formatBytes(used);
    const quotaText = quota ? formatBytes(quota) : "Unknown";
    usageItem.innerHTML = `<span class="meta-label">Used</span><strong>${usedText} / ${quotaText}</strong>`;

    if (quota && used > quota * 0.9) {
      showStatus("Storage is nearly full. Delete files or free space on your device to keep adding files.", "warning");
    }
  } catch (error) {
    console.error(error);
    usageItem.innerHTML = '<span class="meta-label">Used</span><strong>Unavailable</strong>';
  }
}

window.addEventListener("beforeunload", () => {
  if (typeof indexedDB !== "undefined") {
    // closing the page is safe; IndexedDB entries stay available
  }
});
