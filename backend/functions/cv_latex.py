import json
import uuid
from groq import Groq
import os

groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))


def cv_selector(job: dict, user_profile: dict) -> dict:
    prompt = f"""
You are selecting and tailoring resume content for a real applicant applying to a real job.

============================================================
STEP 1 — ROLE ANALYSIS (DO NOT OUTPUT)
============================================================

Read the job carefully and identify:
1. Primary nature of the role: technical, operational, research, creative, business, or mixed.
2. What the organization values most: reliability, execution, technical depth, communication, ownership, etc.
3. Which experiences and projects from the profile are most relevant.

============================================================
STEP 2 — SELECTION RULES
============================================================

- Select 2 to 3 most relevant experiences. Prioritize relevance over diversity.
- Select 2 to 3 most relevant projects. Same rule.
- For each selected experience/project, you may rewrite bullet points to better mirror the job's language and requirements.
- Rewriting means realigning emphasis and language toward the job description — not shortening, simplifying, or removing detail. The original bullets are well-written in a broader sense. Preserve their depth, specificity, and technical integrity, but with the freedom to align towards the given job. 
- A rewritten bullet should be at least as long and detailed as the original.
- Do NOT fabricate tools, outcomes, or skills not present in the original data.
- Do NOT exaggerate impact or seniority.
- Do NOT add bullet points that don't exist in the original — only rewrite existing ones.
- Keep rewrites grounded, specific, and technically honest.
- Do not preserve any given ID fields from the input

============================================================
PROFILE
============================================================

Experiences: {json.dumps(user_profile.get("experiences", []))}
Projects: {json.dumps(user_profile.get("projects", []))}
Skills: {user_profile.get("skills", "")}
Education: {json.dumps(user_profile.get("education", []))}

============================================================
JOB
============================================================

Title: {job.get("title", "")}
Company: {job.get("company", "")}
Description: {job.get("description", "")}
Requirements: {json.dumps(job.get("requirements", []))}
Skills needed: {json.dumps(job.get("skills", []))}

============================================================
OUTPUT RULE (ABSOLUTE)
============================================================

Return ONLY valid JSON. No markdown, no backticks, no commentary.

Exact schema:
{{
  "experiences": [
    {{
      "title": "...",
      "company": "...",
      "date": "...",
      "bullets": ["rewritten or original bullet", ...]
    }}
  ],
  "projects": [
    {{
      "name": "...",
      "date": "...",
      "bullets": ["rewritten or original bullet", ...]
    }}
  ],
  "education": [ <pass through all education as-is, no modifications> ],
  "skills": "<pass through as-is>"
}}
"""
    resp = groq_client.chat.completions.create(
        messages=[
            {"role": "system", "content": "You are a resume tailoring engine. Return only valid JSON exactly matching the requested schema."},
            {"role": "user", "content": prompt},
        ],
        model="openai/gpt-oss-120b",
        temperature=0.3
    )

    raw = resp.choices[0].message.content.strip()
    clean = raw.replace("```json", "").replace("```", "").strip()
    return json.loads(clean)


def strip_ids(obj):
    """Recursively remove any 'id' keys from dicts."""
    if isinstance(obj, dict):
        return {k: strip_ids(v) for k, v in obj.items() if k != "id"}
    if isinstance(obj, list):
        return [strip_ids(i) for i in obj]
    return obj


def _find_link(links: list, *keywords) -> str:
    for link in links:
        if any(kw in link.lower() for kw in keywords):
            return link
    return ""


def _strip_url(url: str) -> str:
    return url.replace("https://", "").replace("http://", "").rstrip("/")


def _plain(val) -> str:
    """Extract plain string from either a raw string or a stamped {id, value} dict."""
    if isinstance(val, dict):
        return val.get("value", "")
    return val or ""


def stamp_cv_ids(cv: dict, profile: dict | None = None) -> dict:
    cv = strip_ids(cv)

    # ── contact block ──────────────────────────────────────────────────────────
    if profile is not None:
        links = profile.get("links", [])
        linkedin  = _find_link(links, "linkedin")
        github    = _find_link(links, "github")
        portfolio = _find_link(links, "vercel", "portfolio")
        cv["contact"] = {
            "name":          profile.get("display_name", ""),
            "email":         profile.get("email", ""),
            "phone":         profile.get("phone", ""),
            "linkedin":      _strip_url(linkedin),
            "linkedin_url":  linkedin,
            "github":        _strip_url(github),
            "github_url":    github,
            "portfolio":     _strip_url(portfolio),
            "portfolio_url": portfolio,
        }
    elif "contact" not in cv:
        cv["contact"] = {
            "name": "", "email": "", "phone": "",
            "linkedin": "", "linkedin_url": "",
            "github": "", "github_url": "",
            "portfolio": "", "portfolio_url": "",
        }

    # ── section titles ─────────────────────────────────────────────────────────
    # Keys are fixed; values are what the user sees/edits and what goes in the template.
    defaults = {
        "education":  "Education",
        "experience": "Experience",
        "skills":     "Skills",
        "projects":   "Projects",
    }
    existing = cv.get("section_titles", {})
    cv["section_titles"] = {k: existing.get(k, v) for k, v in defaults.items()}

    # ── experiences ────────────────────────────────────────────────────────────
    for exp in cv.get("experiences", []):
        eid = str(uuid.uuid4())[:8]
        exp["id"]      = eid
        exp["title"]   = {"id": f"experience-{eid}-title",   "value": _plain(exp.get("title",   ""))}
        exp["company"] = {"id": f"experience-{eid}-company",  "value": _plain(exp.get("company", ""))}
        exp["date"]    = {"id": f"experience-{eid}-date",     "value": _plain(exp.get("date",    ""))}
        exp["bullets"] = [
            {"id": f"experience-{eid}-b{i+1}", "value": _plain(b)}
            for i, b in enumerate(exp.get("bullets", []))
        ]

    # ── projects ───────────────────────────────────────────────────────────────
    for proj in cv.get("projects", []):
        pid = str(uuid.uuid4())[:8]
        proj["id"]      = pid
        proj["name"]    = {"id": f"proj-{pid}-name", "value": _plain(proj.get("name", ""))}
        proj["date"]    = {"id": f"proj-{pid}-date", "value": _plain(proj.get("date", ""))}
        proj["bullets"] = [
            {"id": f"proj-{pid}-b{i+1}", "value": _plain(b)}
            for i, b in enumerate(proj.get("bullets", []))
        ]

    # ── education ──────────────────────────────────────────────────────────────
    for edu in cv.get("education", []):
        edid = str(uuid.uuid4())[:8]
        edu["id"]     = edid
        # LLM may return: institution, school (plain str), or already-stamped {value:...}
        school_val = _plain(edu.get("school") or edu.get("institution") or "")
        degree_val = _plain(edu.get("degree", ""))
        date_val   = _plain(edu.get("end_date") or edu.get("date") or "")
        field_val  = _plain(edu.get("field") or edu.get("specialization") or "")

        edu["school"] = {"id": f"educ-{edid}-school", "value": school_val}
        edu["degree"] = {"id": f"educ-{edid}-degree", "value": degree_val}
        edu["date"]   = {"id": f"educ-{edid}-date",   "value": date_val}
        edu["field"]  = {"id": f"educ-{edid}-field",  "value": field_val}

    return cv