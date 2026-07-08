// background.js — message router + backend relay
import { BACKEND_URL } from "./config.js";  // prod has diff

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {

  if (message.action === "scan") {
    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
      const tabId = tabs[0].id;

      chrome.tabs.sendMessage(tabId, { action: "scanFields" }, async (response) => {
        if (chrome.runtime.lastError || !response?.fields) {
          sendResponse({ status: "Scrape failed", error: chrome.runtime.lastError?.message });
          return;
        }

        const fields = response.fields;
        console.log("[ApplyAI] Scraped fields:", fields);

        // 2. send to backend → backend does HF call → returns fill map
        try {
          const res = await fetch(`${BACKEND_URL}/autofill`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ fields }),
          });

          if (!res.ok) throw new Error(`Backend returned ${res.status}`);

          const { fill_map } = await res.json();
          // fill_map = [{ selector, value, type? }, ...]

          console.log("[ApplyAI] Fill map from backend:", fill_map);

          // 3. send fill instructions back to content script
          chrome.tabs.sendMessage(tabId, { action: "fillFields", data: fill_map }, (fillRes) => {
            sendResponse({ status: "Done!" });
          });

        } catch (err) {
          console.error("[ApplyAI] Backend error:", err);
          sendResponse({ status: "Backend error", error: err.message });
        }
      });
    });

    return true; // keep message channel open for async
  }

});