from __future__ import annotations

import os
import re
import sys
import time
from datetime import datetime
from difflib import SequenceMatcher
import json, pathlib
from backend.routes.creation_dashboard import apply_config_filters
import requests
from bs4 import BeautifulSoup
from supabase import create_client

sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

SUPABASE_URL = os.getenv("SUPABASE_URL")
SUPABASE_KEY = os.getenv("SUPABASE_KEY")
supabase = create_client(SUPABASE_URL, SUPABASE_KEY)



DATA_DIR = pathlib.Path(__file__).parent.parent / "data"

FIELDS_DATA    = json.loads((DATA_DIR / "fields.json").read_text())
SKILLS_DATA    = json.loads((DATA_DIR / "skills.json").read_text())
LOCATIONS_DATA = json.loads((DATA_DIR / "locations.json").read_text())

FIELD_SUPERSET = {f["value"]: f["superset"] for f in FIELDS_DATA["fields"]}
LOCATION_TO_COUNTRY = {loc["value"].lower(): loc["country"] for loc in LOCATIONS_DATA["locations"]}


REQUEST_DELAY   = 2
TIME_SECONDS    = 21600  ## 6 Hours
MAX_JOBS_TOTAL  = 100_000  ## per scrape
BASE_DEPTH      = 250
MAX_DEPTH       = 5000



##helpers;

def desc_similarity(a: str, b: str) -> float:
    if not a or not b:
        return 0.0
    return SequenceMatcher(None, a[:2000], b[:2000]).ratio()

### Fetch all data from table, and create sets and search_matrix
def fetch_all_dashboard_configs() -> list[dict]:
    resp = supabase.table("dashboard_configs").select(
        "id, profile_id, include_skills, include_fields, include_locations, job_types"  ## ignoring include_companies for now, not everyone has preferences on here, gets filtered later regardless.
    ).eq("active", True).execute()
    return resp.data or []

def build_sets(configs: list[dict]) -> tuple[set[str], set[str], set[str], set[str]]:
    skills: set[str]    = set()
    fields: set[str]    = set()
    locations: set[str] = set()
    job_types: set[str] = set()

    for cfg in configs:
        for s in (cfg.get("include_skills") or []):
            skills.add(s.lower().strip())
        for f in (cfg.get("include_fields") or []):
            fields.add(f.lower().strip())
        for loc in (cfg.get("include_locations") or []):
            locations.add(loc.lower().strip())
        for jt in (cfg.get("job_types") or []):
            job_types.add(jt.lower().strip())

    if not skills or not fields or not locations or not job_types:
        print("[scraper] incomplete configs — exiting")
        return set(), set(), set(), set()

    return skills, fields, locations, job_types


## go config by config, mapping importance of every search field by country to then fetch depth
def compute_votes(configs: list[dict]) -> dict[tuple[str, str], int]:
    votes: dict[tuple[str, str], int] = {}
    for cfg in configs:
        cfg_supersets = {FIELD_SUPERSET.get(f.lower().strip()) for f in (cfg.get("include_fields") or [])} - {None}
        cfg_countries = {LOCATION_TO_COUNTRY.get(loc.lower().strip()) for loc in (cfg.get("include_locations") or [])} - {None}
        for superset in cfg_supersets:
            for country in cfg_countries:
                votes[(superset, country)] = votes.get((superset, country), 0) + 1
    return votes


## will have to redesign depth logic in here though later!!
def get_depth(superset: str, country: str, votes: dict[tuple[str, str], int]) -> int:
    return min(BASE_DEPTH * max(1, votes.get((superset, country), 1)), MAX_DEPTH)


def build_search_matrix(fields: set[str], locations: set[str], job_types: set[str], votes: dict[tuple[str, str], int]) -> list[tuple[str, str, str]]:
    supersets: set[str] = set()
    countries: set[str] = set()

    for f in fields:
        superset = FIELD_SUPERSET.get(f)
        if superset:
            supersets.add(superset)

    for loc in locations:
        country = LOCATION_TO_COUNTRY.get(loc)
        if country:
            countries.add(country)

    if not supersets or not countries:
        print("[scraper] couldn't map fields/locations to search matrix — exiting")
        return []

    ## search configs:
    return [
        (f"{superset} {job_type}",  country, job_type, get_depth(superset, country, votes))
        for superset in supersets
        for country in countries
        for job_type in job_types
    ]
    
    
def _build_global_sets_skills_n_fields() -> tuple[set[str], set[str]]:
    all_fields: set[str] = set()
    all_skills: set[str] = set()

    ## flatten fields.json — just grab all values
    for f in FIELDS_DATA["fields"]:
        all_fields.add(f["value"].lower())
    ## also add supersets
    for s in FIELDS_DATA.get("supersets", []):
        all_fields.add(s.lower())

    ## flatten skills.json — recurse through every list regardless of nesting
    def extract_strings(obj):
        if isinstance(obj, list):
            for item in obj:
                yield from extract_strings(item)
        elif isinstance(obj, dict):
            for v in obj.values():
                yield from extract_strings(v)
        elif isinstance(obj, str):
            yield obj.lower()

    all_skills = set(extract_strings(SKILLS_DATA))

    return all_fields, all_skills

GLOBAL_FIELDS, GLOBAL_SKILLS = _build_global_sets_skills_n_fields()
    
def match_jobs_to_configs(batch: list[dict], configs: list[dict]) -> list[dict]:
    user_jobs_insert_batch = []
    for job in batch:
        for config in configs:
            if apply_config_filters(job, config):
                user_jobs_insert_batch.append({
                    "user_id":             config["user_id"],
                    "dashboard_config_id": config["id"],
                    "job_id":              job["id"],  
                    "status":              "new",
                })
    return user_jobs_insert_batch
    
    
### layers 1-5;

def layer1_fields_in_title(fields: set[str], title_lower: str) -> bool:
    supersets = {FIELD_SUPERSET.get(f) for f in fields} - {None}
    
    for f in fields:
        if f in title_lower:
            return True
    for broad in supersets:
        if broad in title_lower:
            return True
    return False
    
    
def layer2_dedup(
    url: str,
    title: str,
    company: str,
    job_location: str,
    desc_text: str,
    url_set: set[str],
    title_company_map: dict[tuple[str, str], dict],
) -> tuple[str, dict | None]:
    """
        Returns:
        ("skip", None)        → already exists, nothing to do
        ("replace", existing) → repost, same location, replace existing
        ("merge", existing)   → same job, new location, merge locations
        ("insert", None)      → new job, proceed with insert
    """
    
    if url in url_set:
        return "skip", None
    
    tc_key = (title.lower().strip(), company.lower().strip())
    if tc_key in title_company_map:
        for existing in title_company_map[tc_key]:
            sim = desc_similarity(desc_text, existing.get("description") or "")
            if sim > 0.85:
                existing_locs = existing.get("locations") or []
                if job_location in existing_locs:
                    return "replace", existing
                else:
                    return "merge", existing

        return "insert", None
    return "insert", None



def extract_salary(combined: str) -> dict | None:
    SALARY_PATTERNS = [
        (r'(?:\$|CAD|USD|C\$)\s*(\d[\d,]*(?:\.\d+)?)\s*(?:[-–]\s*(?:\$|CAD|USD|C\$)?\s*(\d[\d,]*(?:\.\d+)?))?\s*(?:\/\s*(?:hr|hour)|per\s+hour)', "hourly"),
        (r'(?:\$|CAD|USD|C\$)\s*(\d[\d,]*(?:\.\d+)?)\s*(?:[-–]\s*(?:\$|CAD|USD|C\$)?\s*(\d[\d,]*(?:\.\d+)?))?\s*(?:\/\s*(?:wk|week)|per\s+week)', "weekly"),
        (r'(?:\$|CAD|USD|C\$)\s*(\d[\d,]*(?:\.\d+)?)\s*(?:k|,000)?\s*(?:[-–]\s*(?:\$|CAD|USD|C\$)?\s*(\d[\d,]*(?:\.\d+)?)\s*(?:k|,000)?)?\s*(?:CAD|USD)?\s*(?:\/\s*(?:yr|year)|per\s+(?:year|annum)|annually)', "annual"),
        (r'(\d+)\s*(?:k|,000)\s*(?:[-–]\s*(\d+)\s*(?:k|,000)?)\s*(?:CAD|USD|per\s+year|annually)?', "annual"),
        (r'(?:salary|compensation|pay|rate|stipend|wage)[:\s]+(?:\$|CAD|USD|C\$)?\s*(\d[\d,]+)', "unknown"),
    ]
    
    matches = []
    seen = set()
    for pattern, pay_type in SALARY_PATTERNS:
        for m in re.finditer(pattern, combined, re.IGNORECASE):
            raw = m.group(0).strip()
            if raw not in seen:
                matches.append({"type": pay_type, "raw": raw})
                seen.add(raw)
    
    return {"matches": matches} if matches else None

    
def layer3_and_4_extract_metadata(
    title: str,
    desc_text: str,
    include_fields: set[str],
    include_skills: set[str],
) -> tuple[list[str], list[str], dict | None, dict | None, dict | None, dict | None, bool]:
    """
    Extracts all possible metadata from title + desc against global sets.
    Then checks overlap against included fields/skills to determine relevance.
    Returns: (matched_fields, matched_skills, salary, duration, season, requirements, is_relevant)
    """
    combined = (title + " " + desc_text).lower()

    matched_fields = [f for f in GLOBAL_FIELDS if re.search(rf'\b{re.escape(f)}\b', combined)]
    matched_skills = [s for s in GLOBAL_SKILLS if re.search(rf'\b{re.escape(s)}\b', combined)]

    salary = extract_salary(combined)

    ## hardcoded for now ig
    SEASON_SIGNALS = [
        "spring", "summer", "fall", "autumn", "winter",
        "q1", "q2", "q3", "q4",
        "january", "february", "march", "april", "may", "june",
        "july", "august", "september", "october", "november", "december",
    ]
    SEASON_PATTERNS = [
        r'(spring|summer|fall|autumn|winter)\s*(?:\d{4})?',
        r'(q[1-4])\s+(\d{4})',
        r'(january|february|march|april|may|june|july|august|september|october|november|december)\s+(\d{4})',
    ]
    season: dict | None = None
    found_season_signals = [s for s in SEASON_SIGNALS if s in combined]
    if found_season_signals:
        season_matches = []
        for pattern in SEASON_PATTERNS:
            for m in re.finditer(pattern, combined, re.IGNORECASE):
                season_matches.append(m.group(0).strip())
        season = {
            "signals": found_season_signals,
            "matches": list(dict.fromkeys(season_matches)),  ## dedup, preserve order
        } if season_matches else {"signals": found_season_signals}


    DURATION_PATTERNS = [
        r'(\d+)\s*[-–]?\s*(month|months)',
        r'(\d+)\s*[-–]?\s*(week|weeks)',
        r'(\d+)\s*[-–]?\s*(year|years)',
        r'(full[- ]?year|year[- ]?long)',
        r'(permanent|contract|temporary|fixed[- ]?term)',
        r'(part[- ]?time|full[- ]?time)',
        r'(\d{4}[-/]\d{2}[-/]\d{2})\s*[-–to]+\s*(\d{4}[-/]\d{2}[-/]\d{2})',  ## 2026-05-01 - 2027-08-31
        r'(\d{4}[-/]\d{2}[-/]\d{2})\s*[-–to]+\s*(\d{4})',                      ## 2026-05-01 - 2027
        r'(?:start(?:ing)?|begin(?:ning)?|commence[sd]?)[:\s]+(\w+ \d{1,2}(?:st|nd|rd|th)?,?\s*\d{4})',  ## starting September 1st, 2026
        r'(?:start(?:ing)?|begin(?:ning)?)[:\s]+(\w+\s+\d{4})',                 ## starting May 2026
        r'(\w+ \d{1,2}(?:st|nd|rd|th)?),?\s*(\d{4})\s*[-–to]+\s*(\w+ \d{1,2}(?:st|nd|rd|th)?),?\s*(\d{4})',  ## May 1st, 2026 - August 31st, 2026
        r'(\d{1,2}\s+\w+\s+\d{4})\s*[-–to]+\s*(\d{1,2}\s+\w+\s+\d{4})'
    ]
    duration: dict | None = None
    duration_matches = []
    for pattern in DURATION_PATTERNS:
        for m in re.finditer(pattern, combined, re.IGNORECASE):
            duration_matches.append(m.group(0).strip())

    if duration_matches:
        duration = {"matches": list(dict.fromkeys(duration_matches))}


    ## hardcoded for now ig
    REQ_SIGNALS = [
        "bachelor", "master", "phd", "degree", "diploma",
        "pursuing", "enrolled", "currently studying",
        "gpa", "1st year", "2nd year", "3rd year", "4th year",
        "final year", "penultimate", "recent graduate", "new grad",
        "years of experience", "year of experience",
        "no experience", "entry level", "junior",
    ]
    requirements: dict | None = None
    found_reqs = [sig for sig in REQ_SIGNALS if sig in combined]
    if found_reqs:
        windows = []
        for sig in found_reqs:
            idx = combined.find(sig)
            start = max(0, idx - 50)
            end = min(len(combined), idx + 300)
            windows.append((start, end))

        ## merge overlapping intervals
        windows.sort()
        merged = [windows[0]]
        for start, end in windows[1:]:
            if start <= merged[-1][1]:
                merged[-1] = (merged[-1][0], max(merged[-1][1], end))
            else:
                merged.append((start, end))

        snippets = [combined[s:e] for s, e in merged]
        requirements = {"signals": found_reqs, "snippets": snippets}
        

    matched_fields_set = set(matched_fields)
    matched_skills_set = set(matched_skills)
    is_relevant = bool(
        matched_fields_set & include_fields or
        matched_skills_set & include_skills
    )

    return matched_fields, matched_skills, salary, duration, season, requirements, is_relevant


def layer5_insert_jobs(batch: list[dict]) -> int:
    if not batch:
        return 0
    try:
        supabase.table("jobs").insert(batch).execute()
        return len(batch)
    except Exception as e:
        print(f"[layer5] insert error: {e}")
        return 0


def layer5_replace(
    existing: dict,
    url: str,
    desc_text: str,
    matched_fields: list[str],
    matched_skills: list[str],
    salary: dict | None,
    duration: dict | None,
    season: dict | None,
    requirements: dict | None,
    url_set: set[str],
    title_company_map: dict,
    tc_key: tuple[str, str],
) -> None:
    try:
        supabase.table("jobs").update({
            "url":          url,
            "description":  desc_text,
            "fields":       matched_fields,
            "skills":       matched_skills,
            "salary":       salary,
            "duration":     duration,
            "season":       season,
            "requirements": requirements,
            "scraped_at":   datetime.now().isoformat(),
        }).eq("id", existing["id"]).execute()
        url_set.discard(existing.get("url"))
        url_set.add(url)
        title_company_map[tc_key]["url"] = url
        print(f"[layer5] REPLACE: {existing.get('title')} @ {existing.get('company')}")
    except Exception as e:
        print(f"[layer5] replace error: {e}")


def layer5_merge(
    existing: dict,
    job_location: str,
    url: str,
    url_set: set[str],
    title_company_map: dict,
    tc_key: tuple[str, str],
) -> None:
    try:
        existing_locs = existing.get("locations") or []
        merged_locs   = list(dict.fromkeys(existing_locs + [job_location]))
        supabase.table("jobs").update({
            "locations": merged_locs,
        }).eq("id", existing["id"]).execute()
        title_company_map[tc_key]["locations"] = merged_locs
        url_set.add(url)
        print(f"[layer5] MERGE: {existing.get('title')} @ {existing.get('company')} → {merged_locs}")
    except Exception as e:
        print(f"[layer5] merge error: {e}")


def fetch_job_detail(job_id: str) -> tuple[str, list[str]]:
    try:
        resp = requests.get(
            f"https://www.linkedin.com/jobs-guest/jobs/api/jobPosting/{job_id}",
            headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)"},
            timeout=15,
        )
        soup    = BeautifulSoup(resp.text, "html.parser")
        desc_el = soup.select_one("[class*=description] > section > div")
        tags_el = soup.select_one("[class*=_job-criteria-list]")
        desc    = desc_el.get_text(separator=" ", strip=True) if desc_el else ""
        tags    = [t.strip() for t in tags_el.get_text(separator="|").split("|") if t.strip()] if tags_el else []
        return desc, tags
    except Exception:
        return "", []



### MAIN RUN:
def run():
    print(f"[scraper] run started at {datetime.now().isoformat()}")

    configs = fetch_all_dashboard_configs()
    if not configs:
        print("[scraper] no active configs — exiting")
        return
    print(f"[scraper] {len(configs)} active dashboard config(s) loaded")


    skills, fields, locations, job_types = build_sets(configs)
    if not skills and not fields and not locations and not job_types:
        return


    votes         = compute_votes(configs)
    search_matrix = build_search_matrix(fields, locations, job_types, votes)
    if not search_matrix:
        print("[scraper] empty search matrix — exiting")
        return
    print(f"[scraper] search matrix: {len(search_matrix)} entries")


    existing_resp = supabase.table("jobs").select("id, url, title, company, locations, description").execute()
    existing_rows = existing_resp.data or []
    url_set: set[str] = {r["url"] for r in existing_rows if r.get("url")}
    title_company_map: dict[tuple[str, str], list[dict]] = {}
    for r in existing_rows:
        key = (r["title"].lower().strip(), r["company"].lower().strip())
        title_company_map.setdefault(key, []).append(r)
    print(f"[scraper] {len(url_set)} existing jobs loaded into memory")


    ## --- scrape ---
    total_inserted  = 0
    trio_scraped: dict[tuple[str, str, str], int] = {}  ## (keyword, country, job_type) → count

    for keyword, country, job_type, depth_limit in search_matrix:
        if total_inserted >= MAX_JOBS_TOTAL:
            break

        trio_key = (keyword, country, job_type)
        print(f"\n[scraper] keyword='{keyword}' | country='{country}' | job_type='{job_type}' | depth={depth_limit}")

        start = 0
        batch: list[dict] = []

        while True:
            if trio_scraped.get(trio_key, 0) >= depth_limit:
                break
            if total_inserted >= MAX_JOBS_TOTAL:
                break

            ## --- fetch page of cards ---
            try:
                resp = requests.get(
                    "https://www.linkedin.com/jobs-guest/jobs/api/seeMoreJobPostings/search",
                    params={
                        "keywords": keyword,
                        "location": country,
                        "f_TPR":    f"r{TIME_SECONDS}",
                        "start":    start,
                    },
                    headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"},
                    timeout=15,
                )
            except Exception as e:
                print(f"[scraper] request error: {e}")
                break

            soup  = BeautifulSoup(resp.text, "html.parser")
            cards = soup.find_all("div", class_="base-card")
            if not cards:
                break

            for card in cards:
                if trio_scraped.get(trio_key, 0) >= depth_limit:
                    break

                ## --- extract card-level info ---
                title_el = card.select_one("[class*=_title]")
                title    = title_el.get_text(strip=True) if title_el else None
                if not title:
                    continue

                url_el  = card.select_one("[class*=_full-link]")
                url     = url_el["href"].split("?")[0] if url_el and url_el.get("href") else None
                if not url:
                    continue

                company_el  = card.select_one("[class*=_subtitle]")
                location_el = card.select_one("[class*=_location]")
                company      = company_el.get_text(strip=True)  if company_el  else "Unknown"
                job_location = location_el.get_text(strip=True) if location_el else country
                tc_key      = (title.lower().strip(), company.lower().strip())

                trio_scraped[trio_key] = trio_scraped.get(trio_key, 0) + 1

                ## --- layer 1: at least one field in title ---
                if not layer1_fields_in_title(fields, title.lower()):
                    continue
                job_id              = url.split("-")[-1]
                desc_text, _tags    = fetch_job_detail(job_id)
                time.sleep(REQUEST_DELAY)


                ## --- layer 2: dedup ---
                action, existing = layer2_dedup(
                    url, title, company, job_location, desc_text, url_set, title_company_map
                )

                if action == "skip":
                    continue

                elif action == "replace":
                    ## layer 3+4 still needed to refresh metadata on replace
                    matched_fields, matched_skills, salary, duration, season, requirements, is_relevant = layer3_and_4_extract_metadata(
                        title, desc_text, fields, skills
                    )
                    layer5_replace(existing, url, desc_text, matched_fields, matched_skills, salary, duration, season, requirements, url_set, title_company_map, tc_key)
                    continue

                elif action == "merge":
                    ## no need for layer 3+4, just appending a location
                    layer5_merge(existing, job_location, url, url_set, title_company_map, tc_key)
                    continue

                ### or inherently action == "insert"
                ## --- layer 3 + 4: extract metadata + relevance check ---
                matched_fields, matched_skills, salary, duration, season, requirements, is_relevant = layer3_and_4_extract_metadata(
                    title, desc_text, fields, skills
                )
                if not is_relevant:
                    continue

                ## --- layer 5: queue for batch insert ---
                item = {
                    "url":          url,
                    "title":        title,
                    "company":      company,
                    "location":     job_location,
                    "locations":    [job_location],
                    "description":  desc_text or None,
                    "source":       "linkedin",
                    "job_type":     job_type,
                    "fields":       matched_fields,
                    "skills":       matched_skills,
                    "salary":       salary,
                    "duration":     duration,
                    "season":       season,
                    "requirements": requirements,
                    "scraped_at":   datetime.now().isoformat(),
                }
                batch.append(item)
                url_set.add(url)
                title_company_map.setdefault(tc_key, []).append(item)


            inserted      = layer5_insert_jobs(batch)
            total_inserted += inserted
            print(f"[layer5] inserted {inserted} jobs | total={total_inserted}")
            user_jobs_batch = match_jobs_to_configs(batch, configs)
            if user_jobs_batch:
                for i in range(0, len(user_jobs_batch), 1000):
                    supabase.table("user_jobs").upsert(
                        user_jobs_batch[i:i+1000],
                        on_conflict="user_id,job_id,dashboard_config_id"
                    ).execute()
                print(f"[user_jobs] upserted {len(user_jobs_batch)} rows")
            batch.clear()

            start += 10

        ## flush any remainder (shouldn't happen but safety net)
        if batch:
            inserted       = layer5_insert_jobs(batch)
            total_inserted += inserted
            batch.clear()

    print(f"\n[scraper] finished at {datetime.now().isoformat()} — {total_inserted} new jobs inserted")


if __name__ == "__main__":
    run()