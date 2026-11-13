let papers = [];
let isRunning = false;
let isPaused = false;
let currentIndex = 0;
let successCount = 0;
let errorCount = 0;

const startBtn = document.getElementById("startBtn");
const pauseBtn = document.getElementById("pauseBtn");
const progressFill = document.getElementById("progressFill");
const statusBadge = document.getElementById("statusBadge");
const totalCountEl = document.getElementById("totalCount");
const downloadedCountEl = document.getElementById("downloadedCount");
const currentFileEl = document.getElementById("currentFile");
const logBox = document.getElementById("logBox");
const saveToLocalServerEl = document.getElementById("saveToLocalServer");
const delaySelect = document.getElementById("delaySelect");

function appendLog(msg, type = "info") {
  const div = document.createElement("div");
  div.className = `log-item log-${type}`;
  div.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
  logBox.appendChild(div);
  logBox.scrollTop = logBox.scrollHeight;
}

fetch("missing_papers.json")
  .then((res) => res.json())
  .then((data) => {
    papers = data;
    totalCountEl.textContent = papers.length;
    downloadedCountEl.textContent = `0 / ${papers.length}`;
    appendLog(`Loaded catalog of ${papers.length} missing exam papers.`, "ok");
  })
  .catch((err) => {
    appendLog(`Failed to load missing_papers.json: ${err.message}`, "err");
  });

startBtn.addEventListener("click", () => {
  if (isRunning) return;
  isRunning = true;
  isPaused = false;
  startBtn.style.display = "none";
  pauseBtn.style.display = "block";
  statusBadge.textContent = "Downloading";
  statusBadge.style.background = "rgba(16, 185, 129, 0.15)";
  statusBadge.style.color = "var(--success)";
  processNext();
});

pauseBtn.addEventListener("click", () => {
  if (!isPaused) {
    isPaused = true;
    pauseBtn.textContent = "Resume Download";
    statusBadge.textContent = "Paused";
  } else {
    isPaused = false;
    pauseBtn.textContent = "Pause Download";
    statusBadge.textContent = "Downloading";
    processNext();
  }
});

function getDownloadUrl(item) {
  if (item.type === "doc") {
    return `https://docs.google.com/document/d/${item.file_id}/export?format=pdf`;
  }
  return `https://drive.usercontent.google.com/download?id=${item.file_id}&export=download`;
}

async function uploadToLocalServer(item, blob) {
  const formData = new FormData();
  formData.append("file", blob, `paper_${item.id}.pdf`);
  const resp = await fetch(`http://localhost:8000/api/admin/save-paper?paper_id=${item.id}`, {
    method: "POST",
    body: formData,
  });
  if (!resp.ok) {
    throw new Error(`Server returned ${resp.status}`);
  }
  return await resp.json();
}

async function downloadViaChrome(item, url) {
  return new Promise((resolve, reject) => {
    chrome.downloads.download(
      {
        url: url,
        filename: `TestTaker_Papers/paper_${item.id}.pdf`,
        conflictAction: "overwrite",
        saveAs: false,
      },
      (downloadId) => {
        if (chrome.runtime.lastError) {
          reject(chrome.runtime.lastError);
        } else {
          resolve(downloadId);
        }
      }
    );
  });
}

async function processNext() {
  if (!isRunning || isPaused) return;

  if (currentIndex >= papers.length) {
    isRunning = false;
    statusBadge.textContent = "Completed";
    pauseBtn.style.display = "none";
    startBtn.style.display = "block";
    startBtn.textContent = "Restart Download";
    appendLog(`Completed batch. Success: ${successCount}, Errors: ${errorCount}`, "ok");
    return;
  }

  const item = papers[currentIndex];
  const url = getDownloadUrl(item);
  currentFileEl.textContent = `paper_${item.id}.pdf (${item.code})`;

  const pct = Math.round(((currentIndex + 1) / papers.length) * 100);
  progressFill.style.width = `${pct}%`;
  downloadedCountEl.textContent = `${currentIndex + 1} / ${papers.length}`;

  const sendToLocal = saveToLocalServerEl.checked;
  let savedLocally = false;

  if (sendToLocal) {
    try {
      const resp = await fetch(url, { credentials: "include" });
      if (resp.ok) {
        const blob = await resp.blob();
        if (blob.size > 1000) {
          await uploadToLocalServer(item, blob);
          savedLocally = true;
          successCount++;
          appendLog(`Saved paper_${item.id}.pdf to local server (${Math.round(blob.size / 1024)} KB)`, "ok");
        }
      }
    } catch (e) {
      savedLocally = false;
    }
  }

  if (!savedLocally) {
    try {
      await downloadViaChrome(item, url);
      successCount++;
      appendLog(`Triggered download: paper_${item.id}.pdf`, "ok");
    } catch (err) {
      errorCount++;
      appendLog(`Error paper_${item.id}.pdf: ${err.message || err}`, "err");
    }
  }

  currentIndex++;
  const delay = parseInt(delaySelect.value, 10) || 1000;
  setTimeout(processNext, delay);
}
