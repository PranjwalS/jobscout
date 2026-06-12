import json
from groq import Groq
from docling.document_converter import DocumentConverter
import os

groq_client = Groq(api_key=os.getenv("GROQ_API_KEY"))


def cv_parser(cv_information):
    prompt = f"""
You are an expert resume parsing system.

Your output will be parsed automatically by a JSON parser.
Invalid JSON will cause system failure.
Your task is to extract structured information from the provided CV markdown and convert it into a STRICT JSON object.

You must follow ALL rules exactly.

---

## CRITICAL RULES

1. ONLY use information explicitly present in the CV.
   - Do NOT infer missing facts.
   - Do NOT guess.
   - Do NOT hallucinate.

2. If a field is not present, return an empty list [] or null (never fabricate).

3. CVs may use different wording for the same concept:
   - "Work Experience", "Experience", "Employment", "Professional Background" → EXPERIENCE
   - "Education", "Academic Background", "Studies" → EDUCATION
   - "Skills", "Technologies", "Toolset" → SKILLS
   - "Projects", "Personal Projects", "Side Work" → PROJECTS
   You MUST correctly map synonyms into the correct JSON field.

4. Maintain accuracy of:
   - dates (do not mix between sections)
   - job titles
   - institutions
   - company names
   - project descriptions

5. Do NOT merge separate experiences/projects incorrectly.

6. If something is ambiguous, prefer leaving it out rather than guessing.

7. Keep all extracted text faithful to the original wording (light cleanup allowed, no rewriting meaning).

---

## OUTPUT FORMAT (STRICT JSON ONLY)

Return ONLY valid JSON. No markdown. No explanation.

Use this structure:

{{
  "name": "",
  "contact": {{
    "phone": "",
    "email": "",
    "location": "",
    "links": []
  }},
  "summary": "",
  "education": [
    {{
      "institution": "",
      "degree": "",
      "field": "",
      "gpa": "",
      "start_date": "",
      "end_date": "",
      "details": []
    }}
  ],
  "experience": [
    {{
      "company": "",
      "role": "",
      "location": "",
      "start_date": "",
      "end_date": "",
      "responsibilities": []
    }}
  ],
  "skills": {{
    "skills": "",
  }},
  "projects": [
    {{
      "name": "",
      "description": [],
      "tech_stack": [],
      "start_date": "",
      "end_date": "",
      "links": []
    }}
  ],
  "certifications_awards": [],
  "additional_sections": {{}}
}}

---

## EXTRA RULES FOR ROBUSTNESS

- If a CV section is missing, return empty arrays [] or empty strings "".
- Preserve multiple roles separately (do NOT merge jobs).
- Preserve bullet points as arrays.
- Keep project descriptions as bullet lists if present.
- Do not assume ordering implies grouping unless clearly structured.

---

## INPUT CV (MARKDOWN)

{cv_information}

---

Now parse the CV carefully and return ONLY the JSON output.
"""
    
    resp = groq_client.chat.completions.create(
        messages=[
            {"role": "system", "content": "You are a highly precise resume parsing engine that outputs strict valid JSON only."},
            {"role": "user", "content": prompt},
        ],
        model="openai/gpt-oss-120b",
        temperature=0
    )

    output = resp.choices[0].message.content
    parsed = json.loads(output)
    return parsed
    



def job_parser(job_description: str) -> dict:
    prompt = f"""
You are an expert job posting parser.

Your output will be parsed automatically by a JSON parser.
Invalid JSON will cause system failure.

Extract structured information from the job posting below into strict JSON.

## RULES
1. ONLY extract information explicitly present in the posting.
2. Do NOT infer, guess, or hallucinate anything.
3. If a field is missing, return empty string "" or empty array [].
4. Skills and requirements should be extracted as clean individual items, not full sentences.
5. Fields means the job domain/category (e.g. "software engineering", "nursing", "legal", "accounting") — infer only from explicit context.

## OUTPUT FORMAT (STRICT JSON ONLY)
Return ONLY valid JSON. No markdown. No explanation.

{{
  "title": "",
  "company": "",
  "location": "",
  "description": "",
  "requirements": [],
  "skills": [],
  "salary": "",
  "duration": "",
  "fields": []
}}

## JOB POSTING
{job_description}

Now parse and return ONLY the JSON.
"""
    resp = groq_client.chat.completions.create(
        messages=[
            {"role": "system", "content": "You are a precise job posting parser that outputs strict valid JSON only."},
            {"role": "user", "content": prompt},
        ],
        model="openai/gpt-oss-120b",
        temperature=0
    )
    output = resp.choices[0].message.content
    parsed = json.loads(output)
    return parsed
  
  
  
  
def cover_letter_generator(job: dict, user_profile: dict) -> str:
    prompt = f"""
You are writing a cover letter for a real applicant applying to a real job.

This is a high-signal professional writing task. The goal is to clearly demonstrate capability through relevant experience and projects while remaining natural, grounded, and non-promotional in tone.

============================================================
STEP 1 — ROLE ANALYSIS (DO NOT OUTPUT)
============================================================

Read the job description carefully and identify:

1. The PRIMARY nature of the role:
   technical, operational, compliance, research, creative, business, or mixed.

2. What the organization values most:
   (e.g. reliability, accuracy, execution, collaboration, ownership, communication, technical depth, etc.)

3. SELECT EXPERIENCE SET (STRICT BUT MAXIMAL):
   - Choose 2 to 3 most relevant experiences from the profile.
   - Choose 2 to 3 most relevant projects from the profile.
   - Selection must prioritize relevance to the role, not diversity.
   - Do NOT include anything outside this selected set.

If fewer items are strongly relevant, still aim for:
- minimum 2 experiences if available
- minimum 1 projects if available

For each selected experience, explicitly map it to at least one responsibility or requirement from the job description.
Do this mentally before writing and ensure paragraph 2 reflects this mapping clearly.

============================================================
STEP 2 — WRITING RULES
============================================================

- Do NOT fabricate or assume anything not explicitly present in the profile.
- Do NOT introduce new tools, skills, or outcomes not present in the data.
- Do NOT exaggerate impact, scale, or seniority.
- Do NOT repeat the same idea across paragraphs.
- Do NOT use marketing or hype language such as:
  "excited to apply", "passionate about", "great fit", "leverage", "impactful", "dynamic"

- Avoid buzzword stacking in single sentences (max 2 tools/technologies per sentence).
- Keep writing technically grounded but human and readable.
- Avoid robotic or overly polished corporate phrasing.

============================================================
TONE
============================================================

- First person.
- Calm, confident, and matter-of-fact.
- Not sales-like, not emotional, not exaggerated.
- Sounds like someone describing real work clearly and directly.
- Slight natural variation in phrasing is good, but do not over-style.

============================================================
LENGTH
============================================================

- 3 paragraphs total
- 350–450 words total (this is mandatory minimum seriousness level)

============================================================
STRUCTURE
============================================================

Paragraph 1:
Explain why this role and organization are meaningful as a next step.
Ground this in the job’s actual responsibilities and purpose.
Do NOT copy job description language. Interpret it naturally.

Paragraph 2:
Cover selected EXPERIENCES (2–3).
Explain what was actually done, how systems/processes were worked on, and what the contribution was.
Focus on execution and technical clarity where relevant.
Paragraph 2 must explicitly connect job responsibilities → matching experience evidence.
Each experience described must answer: “which job requirement does this support?”

Paragraph 3:
Cover selected PROJECTS (2–3).
Highlight technical depth, problem-solving, and systems thinking.
Keep it grounded and factual. No exaggeration.

Paragraph 4:
(Yes, include a final paragraph)
Simple closing:
- genuine interest in the work
- willingness to contribute and learn
- no hype, no begging, no overstatement

============================================================
PROFILE
============================================================

Name: {user_profile.get("display_name", "")}
Skills: {user_profile.get("skills", "")}
Experience: {json.dumps(user_profile.get("experiences", []))}
Education: {json.dumps(user_profile.get("education", []))}
Projects: {json.dumps(user_profile.get("projects", []))}

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

Return ONLY the cover letter text.
No title.
No greeting.
No sign-off.
No commentary.
"""
    resp = groq_client.chat.completions.create(
        messages=[
            {"role": "system", "content": "You write cover letters that sound like real humans wrote them — specific, confident, and grounded in the person's actual background."},
            {"role": "user", "content": prompt},
        ],
        model="openai/gpt-oss-120b",
        temperature=0.5
    )
    return resp.choices[0].message.content