// content.js — scrapes fields, fills from backend-mapped data

console.log("ApplyAI content script loaded on:", window.location.href);

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.action === "scanFields") {
    const fields = scanPage();
    sendResponse({ fields });
  }

  if (message.action === "fillFields") {
    fillPage(message.data); // data = [{ selector, value, type }]
    sendResponse({ status: "filled" });
  }

  return true;
});


// ── SCRAPING ────────────────────────────────────────────────────

function scanPage() {
  const elements = document.querySelectorAll("input, textarea, select");
  const fields = [];

  elements.forEach((el, i) => {
    if (el.type === "hidden" || el.type === "submit" || el.type === "button") return;

    const label = resolveLabel(el);
    const selector = buildSelector(el, i);

    fields.push({
      selector,
      tag: el.tagName.toLowerCase(),
      type: el.type || el.tagName.toLowerCase(),
      name: el.name || "",
      id: el.id || "",
      placeholder: el.placeholder || "",
      label: label || "",
      // full context string for LLM to reason about
      context: [label, el.name, el.id, el.placeholder, el.getAttribute("aria-label")]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .trim(),
    });
  });

  console.log("[ApplyAI] Scanned fields:", fields);
  return fields;
}

function resolveLabel(el) {
  // 1. explicit for= link
  if (el.id) {
    const linked = document.querySelector(`label[for="${el.id}"]`);
    if (linked) return linked.innerText.trim();
  }

  // 2. aria-labelledby
  const labelledBy = el.getAttribute("aria-labelledby");
  if (labelledBy) {
    const ref = document.getElementById(labelledBy);
    if (ref) return ref.innerText.trim();
  }

  // 3. aria-label directly
  const ariaLabel = el.getAttribute("aria-label");
  if (ariaLabel) return ariaLabel.trim();

  // 4. wrapping label
  const parent = el.closest("label");
  if (parent) return parent.innerText.replace(el.value, "").trim();

  // 5. previous sibling text (common pattern)
  const prev = el.previousElementSibling;
  if (prev && ["LABEL", "SPAN", "P", "DIV"].includes(prev.tagName)) {
    return prev.innerText.trim();
  }

  return "";
}

function buildSelector(el, index) {
  // prefer id, then name, then fallback to positional
  if (el.id) return `#${CSS.escape(el.id)}`;
  if (el.name) return `[name="${el.name}"]`;
  return `${el.tagName.toLowerCase()}:nth-of-type(${index + 1})`;
}


// ── FILLING ─────────────────────────────────────────────────────

/**
 * data = array of { selector, value, type? }
 * returned from backend after LLM mapping
 */
function fillPage(data) {
  if (!Array.isArray(data)) return;

  data.forEach(({ selector, value, type }) => {
    if (!selector || value === undefined || value === null || value === "") return;

    const el = document.querySelector(selector);
    if (!el) {
      console.warn("[ApplyAI] No element found for selector:", selector);
      return;
    }

    const tag = el.tagName.toLowerCase();

    if (tag === "select") {
      fillSelect(el, value);
    } else if (el.type === "checkbox") {
      fillCheckbox(el, value);
    } else if (el.type === "radio") {
      fillRadio(selector, value);
    } else {
      fillInput(el, value);
      // if it looks like a custom dropdown, also try clicking options
      if (el.getAttribute("role") === "combobox" || 
          el.getAttribute("aria-haspopup") === "listbox" ||
          el.classList.toString().toLowerCase().includes("select")) {
        fillCustomDropdown(el, value);
      }
    }
  });
}

function fillInput(el, value) {
  // trigger React/Vue synthetic events properly
  const nativeSetter =
    Object.getOwnPropertyDescriptor(window.HTMLInputElement.prototype, "value")?.set ||
    Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;

  if (nativeSetter) {
    nativeSetter.call(el, value);
  } else {
    el.value = value;
  }

  el.dispatchEvent(new Event("input", { bubbles: true }));
  el.dispatchEvent(new Event("change", { bubbles: true }));
  el.dispatchEvent(new Event("blur", { bubbles: true }));
}

function fillSelect(el, value) {
  const options = Array.from(el.options);
  const match = options.find(
    (o) =>
      o.value.toLowerCase() === value.toLowerCase() ||
      o.text.toLowerCase().includes(value.toLowerCase())
  );
  if (match) {
    el.value = match.value;
    el.dispatchEvent(new Event("change", { bubbles: true }));
  } else {
    console.warn("[ApplyAI] No matching option for:", value, "in", el);
  }
}

function fillCheckbox(el, value) {
  const should = typeof value === "boolean" ? value : value === "true" || value === "yes";
  if (el.checked !== should) {
    el.click();
  }
}

function fillRadio(selector, value) {
  // selector here is the group name, value is the option to pick
  const radios = document.querySelectorAll(`input[type="radio"][name="${selector}"]`);
  radios.forEach((r) => {
    if (r.value.toLowerCase() === value.toLowerCase()) r.click();
  });
}

// ── Custom dropdown fallback (React select, Headless UI, etc.) ───
// If a select didn't match, try clicking custom dropdown options
function fillCustomDropdown(el, value) {
  el.focus();
  el.click();
  setTimeout(() => {
    const selectors = ['[role="option"]', '[class*="option"]', '[class*="item"]', "li"];
    for (const sel of selectors) {
      const options = document.querySelectorAll(sel);
      const match = Array.from(options).find((o) =>
        o.textContent.trim().toLowerCase().includes(value.toLowerCase())
      );
      if (match) {
        match.click();
        return;
      }
    }
    console.warn("[ApplyAI] Custom dropdown: no match for", value);
  }, 350);
}