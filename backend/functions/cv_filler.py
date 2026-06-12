import os
import re
import json
import hashlib

TEMPLATES_DIR = os.path.join(os.path.dirname(__file__), "templates")


# ── helpers ───────────────────────────────────────────────────────────────────

def load_template(template_name: str) -> str:
    path = os.path.join(TEMPLATES_DIR, f"{template_name}.tex")
    if not os.path.exists(path):
        raise FileNotFoundError(f"Template '{template_name}' not found at {path}")
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


def _val(field) -> str:
    if isinstance(field, dict):
        return str(field.get("value", ""))
    return str(field) if field is not None else ""


def _short_id(seed: str) -> str:
    return hashlib.md5(seed.encode()).hexdigest()[:8]



# ── nested-aware FOR_EACH parser ──────────────────────────────────────────────

_OPEN_RE  = re.compile(r"%%FOR_EACH (\w+) IN (\w+)%%")
_CLOSE_RE = re.compile(r"%%END_FOR%%")
_LABEL_RE = re.compile(r"<<([^>]+)>>")


def _find_matching_end(text: str, start: int) -> int:
    """
    Given `text` and `start` = index just after an opening %%FOR_EACH%%,
    return the index of the matching %%END_FOR%% (start of that token).
    Properly handles nesting.
    """
    depth = 1
    pos   = start
    while pos < len(text) and depth > 0:
        next_open  = _OPEN_RE.search(text, pos)
        next_close = _CLOSE_RE.search(text, pos)

        if next_close is None:
            raise ValueError("Unmatched %%FOR_EACH%% — missing %%END_FOR%%")

        if next_open and next_open.start() < next_close.start():
            depth += 1
            pos = next_open.end()
        else:
            depth -= 1
            if depth == 0:
                return next_close.start()
            pos = next_close.end()

    raise ValueError("Unmatched %%FOR_EACH%% — hit end of template")


def _substitute_labels(text: str, var: str, item: dict) -> str:
    def _sub(m):
        label = m.group(1)              # e.g. "exp.title"
        parts = label.split(".", 1)
        if parts[0] != var:
            return m.group(0)           # not our var — leave for outer scope
        key = parts[1] if len(parts) > 1 else parts[0]
        raw = item.get(key, "")
        return _val(raw)
    return _LABEL_RE.sub(_sub, text)


def _render_template(text: str, var: str, item: dict) -> str:
    """
    Process `text` in the context of one iteration (var=item):
      - recursively expand nested FOR_EACH blocks using fields from item
      - substitute <<var.*>> labels
    """
    result = []
    pos    = 0

    while pos < len(text):
        m = _OPEN_RE.search(text, pos)
        if m is None:
            result.append(text[pos:])
            break

        # everything before this FOR_EACH
        result.append(text[pos:m.start()])

        inner_var        = m.group(1)   # e.g. "bullet"
        inner_collection = m.group(2)   # e.g. "bullets"
        body_start       = m.end()

        end_idx = _find_matching_end(text, body_start)
        body    = text[body_start:end_idx]

        collection = item.get(inner_collection, [])
        if not isinstance(collection, list):
            collection = []

        for sub_item in collection:
            if isinstance(sub_item, str):
                sub_item = {"value": sub_item, "id": _short_id(sub_item[:40])}
            result.append(_render_template(body, inner_var, sub_item))

        # skip past %%END_FOR%%
        pos = end_idx + len("%%END_FOR%%")

    rendered = "".join(result)
    rendered = _substitute_labels(rendered, var, item)
    return rendered


# ── skills / education normalisers ────────────────────────────────────────────

def _build_skill_rows(skills_raw) -> list:
    if isinstance(skills_raw, str):
        return [{"id": "skill_0", "label": "Skills", "value": skills_raw}]
    if isinstance(skills_raw, dict):
        return [
            {"id": f"skill_{i}", "label": label, "value": value}
            for i, (label, value) in enumerate(skills_raw.items())
        ]
    if isinstance(skills_raw, list):
        rows = []
        for i, row in enumerate(skills_raw):
            if isinstance(row, dict):
                row.setdefault("id", f"skill_{i}")
                rows.append(row)
        return rows
    return []


def _normalise_education(items: list) -> list:
    out = []
    for edu in items:
        e = dict(edu)
        e.setdefault("school", e.pop("institution", ""))
        e.setdefault("date",   e.pop("end_date", e.pop("graduation_date", "")))
        e.setdefault("field",  e.get("specialization", ""))
        out.append(e)
    return out


# ── main ──────────────────────────────────────────────────────────────────────

def fill_template(cv_json: dict, profile: dict, template_name: str = "default") -> str:
    tpl = load_template(template_name)

    # 1. contact scalars
    links = profile.get("links", [])

    def _find_link(*keywords):
        for link in links:
            if any(kw in link.lower() for kw in keywords):
                return link
        return ""

    def _strip(url: str) -> str:
        return url.replace("https://", "").replace("http://", "").rstrip("/")

    linkedin  = _find_link("linkedin")
    github    = _find_link("github")
    portfolio = _find_link("vercel", "portfolio")

    contact_scalars = {
        "contact_name":          profile.get("display_name", ""),
        "contact_phone":         profile.get("phone", ""),
        "contact_email_raw":     profile.get("email", ""),
        "contact_email":         profile.get("email", ""),
        "contact_linkedin_url":  linkedin,
        "contact_linkedin":      _strip(linkedin),
        "contact_github_url":    github,
        "contact_github":        _strip(github),
        "contact_portfolio_url": portfolio,
        "contact_portfolio":     _strip(portfolio),
    }

    for key, val in contact_scalars.items():
        tpl = tpl.replace(f"<<{key}>>", val)

    # 2. section loops — use the nested-aware parser
    normalised_cv = dict(cv_json)
    normalised_cv["education"] = _normalise_education(cv_json.get("education", []))

    result = []
    pos    = 0

    while pos < len(tpl):
        m = _OPEN_RE.search(tpl, pos)
        if m is None:
            result.append(tpl[pos:])
            break

        result.append(tpl[pos:m.start()])

        var             = m.group(1)
        collection_name = m.group(2)
        body_start      = m.end()

        end_idx = _find_matching_end(tpl, body_start)
        body    = tpl[body_start:end_idx]

        if collection_name == "skills":
            collection = _build_skill_rows(normalised_cv.get("skills", ""))
        else:
            collection = normalised_cv.get(collection_name, [])
            if not isinstance(collection, list):
                collection = []

        for item in collection:
            result.append(_render_template(body, var, item))

        pos = end_idx + len("%%END_FOR%%")

    tpl = "".join(result)

    # 3. warn on any remaining unfilled labels
    leftover = _LABEL_RE.findall(tpl)
    if leftover:
        import sys
        print(f"[fill_template] WARNING: unfilled labels: {leftover}", file=sys.stderr)

    return tpl


# ── test ──────────────────────────────────────────────────────────────────────
if __name__ == "__main__":
    import sys, pathlib
    sys.path.insert(0, str(pathlib.Path(__file__).parent))
    from cv_latex import stamp_cv_ids, cv_selector
    import json
    
    user_profile = {
    "name": "Pranjwal S.",
    "skills": {
        "skills": "Python, TypeScript, C, C++, SQL, Bash, React, LangChain, React Native, Vue.js, FastAPI, Flask, Celery, Jetpack Compose, Git, GitHub, Docker, Jenkins, Linux, Supabase, Vercel, Render, Android Studio, Unity, Azure (DevOps, Blob, App Service), Power Platform, SQLAlchemy, PostgreSQL"
    },
    "contact": {
        "email": "",
        "links": [
        "https://www.linkedin.com/in/pranjwal-s-01979b242/",
        "https://github.com/PranjwalS"
        ],
        "phone": "",
        "location": ""
    },
    "summary": "CS @ University of Waterloo seeking Fall 2026 Co-op | 3x Intern | Full-Stack & AI/ML Dev",
    "projects": [
        {
        "id": "5d2cc6b8-4f98-4f8b-a42b-17af81b5fe9e",
        "name": "Job Aggregator, Tracker & Career Platform - JobScout",
        "links": [],
        "end_date": "",
        "start_date": "",
        "tech_stack": [
            "React",
            "FastAPI",
            "PostgreSQL",
            "Supabase",
            "Redis",
            "Celery",
            "Playwright",
            "Groq API"
        ],
        "description": [
            "Built a full-stack career platform where users maintain a career profile and create job search dashboards, each running a cron -scheduled scraper across job boards, with LLM -powered scoring, custom cover letter and CV generation via Celery + Redis async pipelines, email alerts for high-scored matches, and pre-interview prep packets with LLM -generated Q&A and mock interview simulation.",
            "Built a Chrome extension for form autofill, and an in-progress LLM + Playwright auto-application bot."
        ]
        },
        {
        "id": "c39dacdf-f811-4437-9844-58cf79c9f8e8",
        "name": "Agentic AI Coding Assistant - EnOSym",
        "links": [],
        "end_date": "",
        "start_date": "",
        "tech_stack": [
            "Python",
            "LangChain",
            "ChromaDB",
            "Whisper",
            "Playwright",
            "Groq API",
            "Ollama",
            "SQLite"
        ],
        "description": [
            "Built a locally-run agentic coding assistant with voice I/O ( Whisper , Coqui TTS ), RAG over codebases and conversation history ( SQLite -backed), using ChromaDB , and a LangChain agentic loop for LLM tool orchestration across relevant file retrieval, code generation, and execution.",
            "Implemented an isolated coding sandbox for iterative code generation and testing with Playwright integration for browser-based tasks, and an autonomous background agent that scans codebases for improvements."
        ]
        },
        {
        "id": "093f4b69-3d09-49e4-b541-36dac0fa2e8c",
        "name": "Minimal Android Launcher - mute.",
        "links": [],
        "end_date": "",
        "start_date": "",
        "tech_stack": [
            "Kotlin",
            "Jetpack Compose",
            "FastAPI",
            "PostgreSQL",
            "Render"
        ],
        "description": [
            "Built a minimal Android home screen launcher in Kotlin to simplify phone UI, presenting only heavy-used apps, with built-in schedule-based blocking on apps and websites via overlays, using AccessibilityService , and a FastAPI backend on Render for configuration backups, launching on Google Play Store."
        ]
        }
    ],
    "education": [
        {
        "id": "36799a5a-444c-4c81-a2af-926f31920ca6",
        "gpa": "3.9",
        "field": "Digital Hardware Specialization",
        "degree": "Bachelor of Computer Science Honours",
        "details": [],
        "end_date": "",
        "start_date": "",
        "institution": "University of Waterloo"
        }
    ],
    "experience": [
        {
        "id": "fd255172-46b9-4e38-9c0d-273e4cb81384",
        "role": "Software Engineer Intern",
        "company": "Edbridges Inc. · Askly.today",
        "end_date": "April 2029",
        "location": "Waterloo, ON",
        "start_date": "September 2025",
        "responsibilities": [
            "Building and improving RAG pipelines and prompt engineering workflows on an AI-powered educational platform, using Python , MongoDB , and Pinecone Vector DB to enhance LLM output quality.",
            "Developing backend LLM workflow systems using LangChain and OpenAI API , and building internal tooling for QA testing and model evaluation."
        ]
        },
        {
        "id": "0059cb09-78fa-4aaf-8f54-201568f2112a",
        "role": "Software Engineer Intern",
        "company": "Edbridges Inc. · Askly.today",
        "end_date": "August 2026",
        "location": "Remote",
        "start_date": "June 2026",
        "responsibilities": [
            "Building and improving RAG pipelines and prompt engineering workflows on an AI-powered educational platform, using Python , MongoDB , and Pinecone Vector DB to enhance LLM output quality.",
            "Developing backend LLM workflow systems using LangChain and OpenAI API , and building internal tooling for QA testing and model evaluation."
        ]
        },
        {
        "id": "bcb0d286-c22f-4331-9ce8-82b6c669d5da",
        "role": "Software Developer Intern",
        "company": "Cadets, IT Development Team, Dept. of National Defence",
        "end_date": "August 2025",
        "location": "St-Jean, QC",
        "start_date": "June 2025",
        "responsibilities": [
            "Built Power Apps solutions for cadet asset management, integrating Dataverse and SQL .",
            "Built and shipped features for the core Vue.js web application used by 10,000+ program staff nationwide, including new pages, UI components, and dynamic dashboards.",
            "Extended a .NET backend by introducing new data entities, implementing SignalR Hubs , and developing RESTful APIs supporting asset tracking and reporting."
        ]
        },
        {
        "id": "c2a74c40-2eb5-4e3e-a7ee-88285fd93c50",
        "role": "Digital Transformation and Software Testing Intern",
        "company": "Ericsson",
        "end_date": "August 2024",
        "location": "Ottawa, ON",
        "start_date": "June 2024",
        "responsibilities": [
            "Monitored and debugged software pipelines using Jenkins and Kubernetes , diagnosing and resolving build and deployment failures by inspecting pod status and reviewing logs.",
            "Maintained Grafana dashboards tracking KPI and performance metrics, supported software testing workflows, and contributed to operational reporting across telecom infrastructure."
        ]
        }
    ],
    "additional_sections": {},
    "certifications_awards": []
    }



    job = {
        "title": "Backend Engineer Intern",
        "company": "AXL Labs Inc",
        "description": "As the Application Developer, you will work with various teams to identify and implement solutions of agreed applications into action. Responsibilities include internal systems support/development, project enhancements/development in workflow automation, and reporting improvements, ensuring smooth IT operations, end‑user support, and integration for seamless report generation.",
        "requirements": [
    "Familiarity with .NET framework 4.0, .NET Core 5 and above, HTML5, AJAX, XML, Web Services, IIS, Python",
    "Familiarity with Web API (SOAP, REST) frameworks and development",
    "Familiarity with responsive framework like Bootstrap",
    "Familiarity with DevOps continuous development and continuous integration concepts",
    "Familiarity with CI/CD tools such as git-actions",
    "Proficiency in SQL including T‑SQL stored procedures, SSIS & SSRS (preferably MS SQL)",
    "Knowledge of object‑oriented analysis and design using UML",
    "Good team player with strong interpersonal and communication skills",
    "Eligibility to work in Singapore and obtain necessary documentation"
    ],
        "skills":[
    ".NET framework 4.0",
    ".NET Core 5+",
    "HTML5",
    "AJAX",
    "XML",
    "Web Services",
    "IIS",
    "Python",
    "Web API (SOAP)",
    "Web API (REST)",
    "Bootstrap",
    "DevOps",
    "CI/CD",
    "git-actions",
    "SQL",
    "T‑SQL",
    "Stored Procedures",
    "SSIS",
    "SSRS",
    "UML"
    ]
    }
        
    sample_profile = {
        "display_name": "Pranjwal S.",
        "phone":  "438-773-4010",
        "email":  "singhpranjwal@gmail.com",
        "links": [
            "https://www.linkedin.com/in/pranjwal-s-01979b242/",
            "https://github.com/PranjwalS",
            "https://pranjwal-singh.vercel.app"
        ]
    }

    selected = cv_selector(job, user_profile)
    stamped = stamp_cv_ids(selected)
    filled  = fill_template(stamped, sample_profile, template_name="cv_temp1")

    out = pathlib.Path(__file__).parent / "cv_filled_test.tex"
    out.write_text(filled, encoding="utf-8")
    print(f"written to {out}")