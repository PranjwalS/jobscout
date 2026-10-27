
# 1. Launch Playwright (headed by default so you can watch)
# 2. Navigate to the target URL
# 3. Extract DOM fields
# 4. Send to LLM planner → get ordered action JSON
# 5. (Optional) print plan and ask for confirmation
# 6. Execute actions
# 7. Print summary


from __future__ import annotations
import argparse
import os
import sys

from playwright.sync_api import sync_playwright

from profile import PROFILE
from dom_extractor import extract_fields, flatten_for_llm, print_fields_debug
from llm_planner import plan_actions, flag_low_confidence
from executor import execute_actions
from utils import (
    save_actions,
    load_actions,
    print_actions,
    print_summary,
    wait_for_stable_dom,
)

# ── Config ────────────────────────────────────────────────────────────────

# Drop your LinkedIn (or any) job application URL here for testing
TARGET_URL: str = ""   # e.g. "https://www.linkedin.com/jobs/view/..."

DEFAULT_TIMEOUT = 30_000   # ms — page load timeout


# ── CLI ───────────────────────────────────────────────────────────────────

def parse_args():
    p = argparse.ArgumentParser(description="AutoApply — standalone job form filler")
    p.add_argument("--url",       default=TARGET_URL,  help="Job application URL")
    p.add_argument("--dry-run",   action="store_true", help="Plan actions but don't execute")
    p.add_argument("--replay",    action="store_true", help="Replay last_actions.json without re-planning")
    p.add_argument("--headless",  action="store_true", help="Run browser headless (default: headed)")
    p.add_argument("--no-confirm",action="store_true", help="Skip the pre-execution confirmation prompt")
    return p.parse_args()


# ── Main ──────────────────────────────────────────────────────────────────

def run(args):
    url = args.url or TARGET_URL
    if not url:
        print("✗  No URL provided. Set TARGET_URL in main.py or pass --url.")
        sys.exit(1)

    api_key = os.environ.get("ANTHROPIC_API_KEY")
    if not api_key and not args.replay:
        print("✗  ANTHROPIC_API_KEY not set.")
        sys.exit(1)

    print(f"\n🚀  AutoApply starting")
    print(f"    URL      : {url}")
    print(f"    Dry run  : {args.dry_run}")
    print(f"    Headless : {args.headless}")
    print()

    with sync_playwright() as pw:
        browser = pw.chromium.launch(headless=args.headless)
        context = browser.new_context(
            viewport={"width": 1280, "height": 900},
            user_agent=(
                "Mozilla/5.0 (Windows NT 10.0; Win64; x64) "
                "AppleWebKit/537.36 (KHTML, like Gecko) "
                "Chrome/124.0.0.0 Safari/537.36"
            ),
        )
        page = context.new_page()
        page.set_default_timeout(DEFAULT_TIMEOUT)

        # ── Navigate ──────────────────────────────────────────────────────
        print(f"⏳  Navigating to URL…")
        try:
            page.goto(url, wait_until="domcontentloaded", timeout=DEFAULT_TIMEOUT)
            wait_for_stable_dom(page)
        except Exception as e:
            print(f"✗  Navigation failed: {e}")
            browser.close()
            sys.exit(1)

        print(f"✓  Page loaded: {page.title()[:80]}")

        # ── Plan ──────────────────────────────────────────────────────────
        if args.replay:
            print("♻   Loading actions from last_actions.json…")
            actions = load_actions()
        else:
            print("🔍  Extracting DOM fields…")
            fields = extract_fields(page)
            print(f"    Found {len(fields)} interactive field(s)")

            if not fields:
                print("⚠   No fields found. The page may need login or JS render time.")
                browser.close()
                sys.exit(0)

            fields_json = flatten_for_llm(fields)

            print("🤖  Sending to LLM planner…")
            try:
                actions = plan_actions(fields_json, PROFILE)
            except Exception as e:
                print(f"✗  LLM planning failed: {e}")
                browser.close()
                sys.exit(1)

            save_actions(actions)

        # ── Review ────────────────────────────────────────────────────────
        print_actions(actions)

        low_conf = flag_low_confidence(actions)
        if low_conf:
            print(f"⚠   {len(low_conf)} action(s) have confidence < 70% — review before executing:")
            for a in low_conf:
                print(f"    • [{a.get('confidence')}%] {a.get('selector')} — {a.get('note','')}")
            print()

        if not args.no_confirm and not args.dry_run:
            try:
                answer = input("▶   Execute these actions? [y/N] ").strip().lower()
            except EOFError:
                answer = "n"
            if answer != "y":
                print("Aborted.")
                browser.close()
                return

        # ── Execute ───────────────────────────────────────────────────────
        results = execute_actions(page, actions, dry_run=args.dry_run)
        print_summary(results)

        if not args.dry_run and not args.headless:
            print("✓  Done. Browser staying open — press Enter to close.")
            try:
                input()
            except EOFError:
                pass

        browser.close()


if __name__ == "__main__":
    args = parse_args()
    run(args)