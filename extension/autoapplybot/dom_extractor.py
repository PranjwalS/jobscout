
from __future__ import annotations
import json
from typing import Any
from playwright.sync_api import Page


# ── Helpers ──────────────────────────────────────────────────────────────

def _safe(fn, default=None):
    try:
        return fn()
    except Exception:
        return default


def _nearby_text(page: Page, selector: str) -> str:
    """Pull label / legend / fieldset / aria-describedby text near the element."""
    try:
        return page.evaluate(
            """(sel) => {
                const el = document.querySelector(sel);
                if (!el) return '';
                const texts = [];

                // aria-label / aria-labelledby / aria-describedby
                const labelId = el.getAttribute('aria-labelledby') || el.getAttribute('aria-describedby');
                if (labelId) {
                    const labelEl = document.getElementById(labelId);
                    if (labelEl) texts.push(labelEl.innerText.trim());
                }
                const ariaLabel = el.getAttribute('aria-label');
                if (ariaLabel) texts.push(ariaLabel.trim());

                // explicit <label for="...">
                const id = el.id;
                if (id) {
                    const lbl = document.querySelector(`label[for="${id}"]`);
                    if (lbl) texts.push(lbl.innerText.trim());
                }

                // walk up: legend, fieldset label, section heading, parent label
                let node = el.parentElement;
                let depth = 0;
                while (node && depth < 6) {
                    if (['LEGEND', 'LABEL'].includes(node.tagName)) {
                        texts.push(node.innerText.trim());
                    }
                    if (node.tagName === 'FIELDSET') {
                        const leg = node.querySelector('legend');
                        if (leg) texts.push(leg.innerText.trim());
                    }
                    // section / div heading (h1-h4 siblings)
                    for (const h of node.querySelectorAll('h1,h2,h3,h4')) {
                        texts.push(h.innerText.trim());
                        break;
                    }
                    node = node.parentElement;
                    depth++;
                }

                return [...new Set(texts.filter(Boolean))].join(' | ');
            }""",
            selector,
        )
    except Exception:
        return ""


def _get_options(page: Page, selector: str) -> list[str]:
    try:
        return page.evaluate(
            """(sel) => {
                const el = document.querySelector(sel);
                if (!el) return [];
                return [...el.options].map(o => o.text.trim());
            }""",
            selector,
        )
    except Exception:
        return []


def _get_radio_options(page: Page, name: str) -> list[str]:
    try:
        return page.evaluate(
            """(name) => {
                const radios = [...document.querySelectorAll(`input[type=radio][name="${name}"]`)];
                return radios.map(r => {
                    const lbl = document.querySelector(`label[for="${r.id}"]`);
                    return lbl ? lbl.innerText.trim() : (r.value || '');
                });
            }""",
            name,
        )
    except Exception:
        return []


def _unique_selector(page: Page, element_handle) -> str | None:
    """Return the best CSS selector for an element handle."""
    try:
        return page.evaluate(
            """(el) => {
                if (el.id) return '#' + CSS.escape(el.id);
                if (el.name) return `${el.tagName.toLowerCase()}[name="${el.name}"]`;
                // Build nth-child path up to 4 levels
                let path = [];
                let node = el;
                for (let i = 0; i < 4 && node && node !== document.body; i++) {
                    let seg = node.tagName.toLowerCase();
                    if (node.id) { path.unshift('#' + CSS.escape(node.id)); break; }
                    const siblings = [...node.parentElement?.children || []].filter(c => c.tagName === node.tagName);
                    if (siblings.length > 1) seg += `:nth-of-type(${siblings.indexOf(node) + 1})`;
                    path.unshift(seg);
                    node = node.parentElement;
                }
                return path.join(' > ');
            }""",
            element_handle,
        )
    except Exception:
        return None


# ── Main extractor ────────────────────────────────────────────────────────

def extract_fields(page: Page) -> list[dict[str, Any]]:
    """
    Return a list of field context packages from the current page.
    Each package has everything the LLM needs to make a confident mapping.
    """
    fields: list[dict] = []
    seen_selectors: set[str] = set()

    # ── text / email / tel / number / date / url / hidden inputs ──────────
    input_handles = _safe(lambda: page.query_selector_all(
        "input:not([type=submit]):not([type=button]):not([type=reset]):not([type=image]):not([type=hidden])"
    ), [])

    for handle in input_handles:
        try:
            visible = handle.is_visible()
            if not visible:
                continue

            sel = _unique_selector(page, handle)
            if not sel or sel in seen_selectors:
                continue
            seen_selectors.add(sel)

            itype = (_safe(lambda: handle.get_attribute("type")) or "text").lower()
            name  = _safe(lambda: handle.get_attribute("name")) or ""
            placeholder = _safe(lambda: handle.get_attribute("placeholder")) or ""
            label_text  = _nearby_text(page, sel)
            accept      = _safe(lambda: handle.get_attribute("accept")) or ""

            # Determine field_type
            if itype == "file":
                field_type = "file"
                action     = "upload"
            elif itype in ("checkbox",):
                field_type = "checkbox"
                action     = "check"
            elif itype in ("radio",):
                field_type = "radio"
                action     = "click"
            elif itype == "date":
                field_type = "date"
                action     = "date"
            else:
                field_type = "input"
                action     = "fill"

            pkg: dict[str, Any] = {
                "selector": sel,
                "field_type": field_type,
                "input_type": itype,
                "name": name,
                "label_text": label_text,
                "placeholder": placeholder,
                "action": action,
            }

            if itype == "radio":
                pkg["options"] = _get_radio_options(page, name)
            if itype == "file":
                pkg["accept"] = accept

            fields.append(pkg)
        except Exception:
            continue

    # ── <select> dropdowns ────────────────────────────────────────────────
    select_handles = _safe(lambda: page.query_selector_all("select"), [])
    for handle in select_handles:
        try:
            if not handle.is_visible():
                continue
            sel = _unique_selector(page, handle)
            if not sel or sel in seen_selectors:
                continue
            seen_selectors.add(sel)

            name        = _safe(lambda: handle.get_attribute("name")) or ""
            label_text  = _nearby_text(page, sel)
            options     = _get_options(page, sel)

            fields.append({
                "selector": sel,
                "field_type": "select",
                "name": name,
                "label_text": label_text,
                "placeholder": "",
                "action": "select_option",
                "options": options,
            })
        except Exception:
            continue

    # ── contenteditable / richtext ────────────────────────────────────────
    richtext_handles = _safe(
        lambda: page.query_selector_all("[contenteditable='true']"), []
    )
    for handle in richtext_handles:
        try:
            if not handle.is_visible():
                continue
            sel = _unique_selector(page, handle)
            if not sel or sel in seen_selectors:
                continue
            seen_selectors.add(sel)

            label_text = _nearby_text(page, sel)
            fields.append({
                "selector": sel,
                "field_type": "richtext",
                "name": "",
                "label_text": label_text,
                "placeholder": "",
                "action": "richtext",
            })
        except Exception:
            continue

    # ── textareas ─────────────────────────────────────────────────────────
    textarea_handles = _safe(lambda: page.query_selector_all("textarea"), [])
    for handle in textarea_handles:
        try:
            if not handle.is_visible():
                continue
            sel = _unique_selector(page, handle)
            if not sel or sel in seen_selectors:
                continue
            seen_selectors.add(sel)

            name        = _safe(lambda: handle.get_attribute("name")) or ""
            placeholder = _safe(lambda: handle.get_attribute("placeholder")) or ""
            label_text  = _nearby_text(page, sel)

            fields.append({
                "selector": sel,
                "field_type": "textarea",
                "name": name,
                "label_text": label_text,
                "placeholder": placeholder,
                "action": "custom_input",   # treat textarea as custom — LLM drafts answer
            })
        except Exception:
            continue

    return fields


def flatten_for_llm(fields: list[dict]) -> str:
    """Serialize field list to a clean JSON string for the LLM prompt."""
    return json.dumps(fields, indent=2, ensure_ascii=False)