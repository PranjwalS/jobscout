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

Experiences: {json.dumps(user_profile.get("experience", []))}
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
 
 
def stamp_cv_ids(cv: dict) -> dict:
    cv = strip_ids(cv)
 
    for exp in cv.get("experiences", []):
        eid = str(uuid.uuid4())[:8]
        exp["id"]      = eid
        exp["title"]   = {"id": f"experience_{eid}_title",   "value": exp.get("title", "")}
        exp["company"] = {"id": f"experience_{eid}_company",  "value": exp.get("company", "")}
        exp["date"]    = {"id": f"experience_{eid}_date",     "value": exp.get("date", "")}
        exp["bullets"] = [
            {"id": f"experience_{eid}_b{i+1}", "value": b if isinstance(b, str) else b.get("value", "")}
            for i, b in enumerate(exp.get("bullets", []))
        ]
 
    for proj in cv.get("projects", []):
        pid = str(uuid.uuid4())[:8]
        proj["id"]      = pid
        proj["name"]    = {"id": f"proj_{pid}_name",  "value": proj.get("name", "")}
        proj["date"]    = {"id": f"proj_{pid}_date",  "value": proj.get("date", "")}
        proj["bullets"] = [
            {"id": f"proj_{pid}_b{i+1}", "value": b if isinstance(b, str) else b.get("value", "")}
            for i, b in enumerate(proj.get("bullets", []))
        ]
 
    for edu in cv.get("education", []):
        edid = str(uuid.uuid4())[:8]
        edu["id"]       = edid
        edu["school"]   = {"id": f"educ_{edid}_school", "value": edu.get("institution", edu.get("school", ""))}
        edu["degree"]   = {"id": f"educ_{edid}_degree", "value": edu.get("degree", "")}
        edu["date"]     = {"id": f"educ_{edid}_date",   "value": edu.get("end_date", edu.get("date", ""))}
 
    return cv


