# llm_planner.py
# ---------------------------------------------------------------------------
# Sends the flattened DOM fields + user profile to Claude and gets back
# an ordered list of actions to execute on the page.
# ---------------------------------------------------------------------------

from __future__ import annotations
import json
import os
import anthropic

# Low temp for deterministic, non-hallucinating field mapping
_MODEL       = "claude-sonnet-4-6"
_MAX_TOKENS  = 4096
_TEMPERATURE = 0.1

_SYSTEM_PROMPT = """
You are an expert job-application autofill agent.

Your job:
Given a list of form fields extracted from a job application page and a user profile,
produce an ORDERED JSON array of actions to fill the form correctly.

## ABILITIES (action values you may use)

| action         | use when                                                              |
|----------------|-----------------------------------------------------------------------|
| fill           | standard text input (name, email, phone, short answer)               |
| select_option  | <select> dropdown — pass the VISIBLE option text, NOT the value attr  |
| check          | checkbox — to tick it                                                 |
| uncheck        | checkbox — to untick it                                               |
| click          | radio button — click the label element, not the input                 |
| upload         | file input for resume or cover letter                                 |
| date           | date fields — detect format from placeholder (MM/DD/YYYY or YYYY-MM-DD) |
| richtext       | contenteditable div — will select-all then type                       |
| custom_input   | long-form / open-ended question — you MUST draft a full answer        |
| skip           | CAPTCHAs, unrecognised file uploads, fields with no safe mapping      |
| click_next     | a "Next" / "Continue" button to advance to the next page             |
| submit         | the final submit button                                               |

## OUTPUT FORMAT

Return ONLY a valid JSON array. No markdown fences, no preamble, no commentary.
Each element:
{
  "selector":          "<CSS selector>",
  "field_type":        "<input|select|checkbox|radio|file|date|richtext|textarea|button>",
  "action":            "<one of the abilities above>",
  "value":             "<string value to fill/select/type — empty string for click/check/skip>",
  "confidence":        <integer 0-100>,
  "fallback_selector": "<alternative selector or empty string>",
  "note":              "<optional brief reason, especially for low-confidence or custom_input>"
}

## RULES

1. ORDER MATTERS — output actions in the order they must be executed top-to-bottom.
2. NEVER invent information. If no profile field maps to a form field, use action "skip".
3. For custom_input / open-ended questions, draft a concise, honest answer using only
   information present in the profile. Never fabricate experience or credentials.
4. For file upload fields:
   - resume/CV → use profile.resume_path
   - cover letter → use profile.cover_letter_path (may be null → skip if null)
   - anything else → skip
5. Confidence:
   - 90-100: direct, unambiguous mapping
   - 70-89:  reasonable inference (e.g. "experience level" → "Entry Level")
   - <70:    flag — user should review before running
6. Always end the action list with a click_next or submit action for the visible
   submit/next button if one exists on the page. If you cannot find one, omit it.
7. For select_option, pass the exact visible text from the "options" list provided.
   If the best match is ambiguous, pick the closest and set confidence accordingly.
8. For date fields, honour the format in the placeholder (MM/DD/YYYY vs YYYY-MM-DD).
9. If a field is already filled (current_value present and correct), skip it.
""".strip()


def build_user_prompt(fields_json: str, profile: dict) -> str:
    profile_json = json.dumps(profile, indent=2, ensure_ascii=False)
    return (
        f"## FORM FIELDS (extracted from page DOM)\n\n"
        f"```json\n{fields_json}\n```\n\n"
        f"## USER PROFILE\n\n"
        f"```json\n{profile_json}\n```\n\n"
        f"Produce the ordered action array now."
    )


def plan_actions(fields_json: str, profile: dict) -> list[dict]:
    """
    Call Claude with the DOM fields + profile.
    Returns parsed list of action dicts.
    Raises on total failure (caller wraps in try/except).
    """
    client = anthropic.Anthropic(api_key=os.environ["ANTHROPIC_API_KEY"])

    response = client.messages.create(
        model=_MODEL,
        max_tokens=_MAX_TOKENS,
        temperature=_TEMPERATURE,
        system=_SYSTEM_PROMPT,
        messages=[
            {
                "role": "user",
                "content": build_user_prompt(fields_json, profile),
            }
        ],
    )

    raw = response.content[0].text.strip()

    # Strip accidental markdown fences
    if raw.startswith("```"):
        lines = raw.splitlines()
        raw = "\n".join(
            l for l in lines if not l.strip().startswith("```")
        ).strip()

    actions: list[dict] = json.loads(raw)
    return actions


def flag_low_confidence(actions: list[dict], threshold: int = 70) -> list[dict]:
    """Return subset of actions the user should review before executing."""
    return [a for a in actions if a.get("confidence", 100) < threshold]