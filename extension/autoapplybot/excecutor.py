# Walks the ordered action list returned by the LLM planner and executes
# each action via Playwright. Every action is wrapped in try/except —
# nothing should hard-block the run.

from __future__ import annotations
import time
from typing import Any
from playwright.sync_api import Page

# Confidence below this → print a warning but still attempt
CONFIDENCE_WARN_THRESHOLD = 70


def _try_selector(page: Page, action: dict) -> Any | None:
    """Return the first element that matches selector or fallback_selector."""
    for sel in [action.get("selector"), action.get("fallback_selector")]:
        if not sel:
            continue
        try:
            el = page.query_selector(sel)
            if el and el.is_visible():
                return el
        except Exception:
            continue
    return None


def _log(action: dict, msg: str):
    sel   = action.get("selector", "?")
    label = action.get("note") or action.get("field_type", "")
    print(f"  [{action.get('action','?'):14s}] {sel[:50]:50s} | {label[:30]:30s} → {msg}")


# ── Individual ability handlers ───────────────────────────────────────────

def _fill(page: Page, action: dict):
    el = _try_selector(page, action)
    if not el:
        _log(action, "SKIP — element not found")
        return
    try:
        el.click()
        el.fill(action.get("value", ""))
        _log(action, f"filled: {str(action.get('value',''))[:40]}")
    except Exception as e:
        _log(action, f"ERROR — {e}")


def _select_option(page: Page, action: dict):
    sel = action.get("selector") or action.get("fallback_selector")
    if not sel:
        _log(action, "SKIP — no selector")
        return
    try:
        page.select_option(sel, label=action.get("value", ""))
        _log(action, f"selected: {action.get('value','')}")
    except Exception as e:
        # Try value attribute as fallback
        try:
            page.select_option(sel, value=action.get("value", ""))
            _log(action, f"selected (by value): {action.get('value','')}")
        except Exception as e2:
            _log(action, f"ERROR — {e2}")


def _check(page: Page, action: dict):
    el = _try_selector(page, action)
    if not el:
        _log(action, "SKIP — element not found")
        return
    try:
        if not el.is_checked():
            el.check()
        _log(action, "checked")
    except Exception as e:
        _log(action, f"ERROR — {e}")


def _uncheck(page: Page, action: dict):
    el = _try_selector(page, action)
    if not el:
        _log(action, "SKIP — element not found")
        return
    try:
        if el.is_checked():
            el.uncheck()
        _log(action, "unchecked")
    except Exception as e:
        _log(action, f"ERROR — {e}")


def _click(page: Page, action: dict):
    el = _try_selector(page, action)
    if not el:
        _log(action, "SKIP — element not found")
        return
    try:
        el.click()
        _log(action, "clicked")
    except Exception as e:
        _log(action, f"ERROR — {e}")


def _upload(page: Page, action: dict):
    el = _try_selector(page, action)
    if not el:
        _log(action, "SKIP — element not found")
        return
    path = action.get("value", "")
    if not path:
        _log(action, "SKIP — no file path in value")
        return
    try:
        el.set_input_files(path)
        _log(action, f"uploaded: {path}")
    except Exception as e:
        _log(action, f"ERROR — {e}")


def _date(page: Page, action: dict):
    """Format-aware date fill. Detects MM/DD/YYYY vs YYYY-MM-DD from placeholder."""
    el = _try_selector(page, action)
    if not el:
        _log(action, "SKIP — element not found")
        return
    try:
        placeholder = el.get_attribute("placeholder") or ""
        value = action.get("value", "")           # expect ISO YYYY-MM-DD from profile

        # Reformat if placeholder suggests MM/DD/YYYY
        if "MM/DD/YYYY" in placeholder.upper() and len(value) == 10 and "-" in value:
            parts = value.split("-")              # [YYYY, MM, DD]
            value = f"{parts[1]}/{parts[2]}/{parts[0]}"
        elif "DD/MM/YYYY" in placeholder.upper() and len(value) == 10 and "-" in value:
            parts = value.split("-")
            value = f"{parts[2]}/{parts[1]}/{parts[0]}"

        el.fill(value)
        _log(action, f"date filled: {value}")
    except Exception as e:
        _log(action, f"ERROR — {e}")


def _richtext(page: Page, action: dict):
    el = _try_selector(page, action)
    if not el:
        _log(action, "SKIP — element not found")
        return
    try:
        el.click()
        time.sleep(0.2)
        el.press("Control+a")
        el.type(action.get("value", ""), delay=20)
        _log(action, f"richtext filled: {str(action.get('value',''))[:40]}")
    except Exception as e:
        _log(action, f"ERROR — {e}")


def _custom_input(page: Page, action: dict):
    """Long-form / open-ended text — LLM already drafted the answer in value."""
    el = _try_selector(page, action)
    if not el:
        _log(action, "SKIP — element not found")
        return
    try:
        tag = el.evaluate("el => el.tagName.toLowerCase()")
        if tag == "textarea":
            el.click()
            el.fill(action.get("value", ""))
        else:
            # Treat as richtext
            el.click()
            time.sleep(0.2)
            el.press("Control+a")
            el.type(action.get("value", ""), delay=20)
        _log(action, f"custom_input filled: {str(action.get('value',''))[:40]}")
    except Exception as e:
        _log(action, f"ERROR — {e}")


def _click_next(page: Page, action: dict):
    """Click a Next/Continue button and wait for navigation."""
    el = _try_selector(page, action)
    if not el:
        # Try common next-button patterns
        for pattern in [
            "button:has-text('Next')",
            "button:has-text('Continue')",
            "[type=submit]",
            "button:has-text('Next step')",
        ]:
            try:
                candidate = page.query_selector(pattern)
                if candidate and candidate.is_visible():
                    el = candidate
                    break
            except Exception:
                continue
    if not el:
        _log(action, "SKIP — next button not found")
        return
    try:
        with page.expect_navigation(timeout=10_000, wait_until="domcontentloaded"):
            el.click()
        _log(action, "navigated to next page")
    except Exception:
        # Navigation may not fire (SPA) — just click
        try:
            el.click()
            time.sleep(1.5)
            _log(action, "clicked next (no navigation event)")
        except Exception as e:
            _log(action, f"ERROR — {e}")


def _submit(page: Page, action: dict):
    """Submit the form."""
    el = _try_selector(page, action)
    if not el:
        for pattern in ["[type=submit]", "button:has-text('Submit')", "button:has-text('Apply')"]:
            try:
                candidate = page.query_selector(pattern)
                if candidate and candidate.is_visible():
                    el = candidate
                    break
            except Exception:
                continue
    if not el:
        _log(action, "SKIP — submit button not found")
        return
    try:
        el.click()
        time.sleep(2)
        _log(action, "submitted")
    except Exception as e:
        _log(action, f"ERROR — {e}")


def _skip(action: dict):
    _log(action, f"intentionally skipped — {action.get('note','')}")


# ── Dispatcher ────────────────────────────────────────────────────────────

_HANDLERS = {
    "fill":          _fill,
    "select_option": _select_option,
    "check":         _check,
    "uncheck":       _uncheck,
    "click":         _click,
    "upload":        _upload,
    "date":          _date,
    "richtext":      _richtext,
    "custom_input":  _custom_input,
    "click_next":    _click_next,
    "submit":        _submit,
}


def execute_actions(page: Page, actions: list[dict], dry_run: bool = False) -> dict:
    """
    Walk the ordered action list and execute each one.
    Returns a summary dict with counts.
    """
    results = {"total": len(actions), "executed": 0, "skipped": 0, "errors": 0}

    for i, action in enumerate(actions):
        act    = action.get("action", "skip")
        conf   = action.get("confidence", 100)
        prefix = f"[{i+1:02d}/{len(actions):02d}]"

        if conf < CONFIDENCE_WARN_THRESHOLD:
            print(f"{prefix} ⚠  LOW CONFIDENCE ({conf}%) — {action.get('selector','?')}")

        if dry_run:
            print(f"{prefix} DRY RUN — would execute: {act} on {action.get('selector','?')}")
            results["executed"] += 1
            continue

        if act == "skip":
            _skip(action)
            results["skipped"] += 1
            continue

        handler = _HANDLERS.get(act)
        if not handler:
            print(f"{prefix} ⚠  Unknown action '{act}' — skipping")
            results["skipped"] += 1
            continue

        print(f"{prefix}", end=" ")
        try:
            if act in ("click_next", "submit", "skip"):
                handler(page, action)
            else:
                handler(page, action)
            results["executed"] += 1
        except Exception as e:
            print(f"  UNHANDLED ERROR — {e}")
            results["errors"] += 1

        # Small breath between actions to avoid race conditions
        time.sleep(0.3)

    return results