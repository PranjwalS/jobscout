const statusEl = document.getElementById("status");
const statusDot = document.getElementById("statusDot");

function setStatus(msg, type = "") {
  statusEl.textContent = msg;
  statusEl.className = type;
}

function setDot(state) {
  statusDot.className = "status-dot " + state;
}

// Autofill
document.getElementById("scanBtn").addEventListener("click", () => {
  setStatus("scanning...", "loading");
  setDot("detecting");
  chrome.runtime.sendMessage({ action: "scan" }, (response) => {
    if (chrome.runtime.lastError) {
      setStatus("no page detected", "error");
      setDot("");
      return;
    }
    setStatus(response.status.toLowerCase(), "success");
    setDot("active");
    setTimeout(() => { setStatus("ready"); setDot(""); }, 3000);
  });
});

// Cover letter (wired up later)
document.getElementById("cover").addEventListener("click", () => {
  setStatus("coming soon...", "loading");
  setTimeout(() => setStatus("ready"), 2000);
});

// Answer question (wired up later)
document.getElementById("generate").addEventListener("click", () => {
  setStatus("highlight text first", "");
  setTimeout(() => setStatus("ready"), 2000);
});

// Toggle floating panel
document.getElementById("togglePanel").addEventListener("click", () => {
  chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
    chrome.tabs.sendMessage(tabs[0].id, { action: "togglePanel" }, (response) => {
      if (chrome.runtime.lastError) {
        setStatus("can't inject here", "error");
        return;
      }
      setStatus(response?.visible ? "panel shown" : "panel hidden", "success");
      setTimeout(() => setStatus("ready"), 2000);
    });
  });
});

// Check if current tab is a job page
chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
  if (tabs[0]) {
    const url = tabs[0].url || "";
    const jobKeywords = ["apply", "careers", "jobs", "application", "join", "lever", "greenhouse", "workday"];
    const isJobPage = jobKeywords.some(k => url.toLowerCase().includes(k));
    if (isJobPage) {
      setDot("detecting");
      setStatus("job page detected", "success");
      setTimeout(() => { setStatus("ready"); setDot(""); }, 2500);
    }
  }
});