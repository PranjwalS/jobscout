# TEMPORARY: hardcoded user + job profile for standalone testing.
# This entire file will be replaced by the per-job profile builder that
# pulls from Supabase 

PROFILE = {
    # ── Personal ──────────────────────────────────────────────────────────
    "first_name": "Pranjwal",
    "last_name": "Sharma",
    "full_name": "Pranjwal Sharma",
    "email": "pranjwal@example.com",
    "phone": "+1-555-000-0000",
    "location": {
        "city": "Waterloo",
        "province": "Ontario",
        "country": "Canada",
        "postal_code": "N2L 3G1",
    },
    "linkedin_url": "https://linkedin.com/in/pranjwal",
    "github_url": "https://github.com/pranjwal",
    "portfolio_url": "https://pranjwal.dev",
    "website": "https://pranjwal.dev",

    # ── Work auth ─────────────────────────────────────────────────────────
    "work_authorization": "Canadian citizen / permanent resident",
    "requires_sponsorship": False,
    "willing_to_relocate": True,

    # ── Experience level ──────────────────────────────────────────────────
    "years_of_experience": 1,
    "experience_level": "Entry Level",      # Entry Level / Mid / Senior
    "current_title": "Student — CS @ University of Waterloo",

    # ── Education ─────────────────────────────────────────────────────────
    "education": [
        {
            "institution": "University of Waterloo",
            "degree": "Bachelor of Computer Science",
            "field": "Computer Science",
            "gpa": "3.7",
            "start_year": 2024,
            "end_year": 2029,
            "current": True,
        }
    ],
    "highest_degree": "Bachelor of Computer Science",
    "school": "University of Waterloo",

    # ── Skills ────────────────────────────────────────────────────────────
    "skills": [
        "Python", "FastAPI", "React", "TypeScript", "PostgreSQL",
        "Redis", "Celery", "Docker", "GCP", "Supabase", "Playwright",
        "LaTeX", "Git", "Linux",
    ],

    # ── Experience ────────────────────────────────────────────────────────
    "experience": [
        {
            "company": "Self-employed",
            "title": "Founder / Full-Stack Developer",
            "start": "2025-01",
            "end": "present",
            "description": (
                "Built JobScout — a full-stack job aggregator, scorer, "
                "cover-letter generator, and application tracker. "
                "Stack: FastAPI, Celery, Redis, Supabase, React/TS/Vite, "
                "deployed on GCP + Vercel."
            ),
        }
    ],

    # ── Projects ──────────────────────────────────────────────────────────
    "projects": [
        {
            "name": "JobScout",
            "description": (
                "Full-stack job platform: scraper pipeline, three-layer "
                "scoring (algorithmic + preference + LLM), custom CV/cover-letter "
                "generation via LaTeX, Chrome extension for autofill."
            ),
            "url": "https://jobscout.pranjwal.dev",
        },
        {
            "name": "Mute",
            "description": "Minimal Android launcher with app-blocking and focus modes.",
        },
    ],

    # ── File assets ───────────────────────────────────────────────────────
    # Will be pre-signed Supabase URLs in production
    "resume_path": "assets/resume.pdf",       # local path for testing
    "cover_letter_path": None,                # generated per-job, may be None

    # ── Job context (populated by per-job profile builder later) ──────────
    "job": {
        "title": "Software Engineering Intern",
        "company": "Acme Corp",
        "location": "Toronto, ON",
        "url": "",          # filled in by main.py / profile builder
        "description": "",  # filled in by profile builder
    },

    # ── Custom question hints ─────────────────────────────────────────────
    # LLM will draft answers from scratch for unrecognised questions;
    # these give it a nudge for common prompts.
    "custom_hints": {
        "why_this_company": (
            "I'm drawn to Acme's focus on developer tooling and their "
            "culture of shipping fast — exactly the environment I thrive in."
        ),
        "biggest_strength": (
            "Turning vague product ideas into working systems quickly, "
            "then iterating based on real usage."
        ),
        "salary_expectation": "Open / competitive with market",
        "start_date": "Immediately / as agreed",
        "cover_letter_summary": (
            "CS student at UWaterloo with hands-on full-stack experience "
            "building production products. Looking for an internship where "
            "I can contribute from day one."
        ),
    },
}