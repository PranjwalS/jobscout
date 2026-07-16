import os
import re
import json
import hashlib

TEMPLATES_DIR = os.path.join(os.path.dirname(__file__), "templates")


def load_template(template_name: str) -> str:
    path = os.path.join(TEMPLATES_DIR, f"{template_name}.tex")
    if not os.path.exists(path):
        raise FileNotFoundError(f"Template '{template_name}' not found at {path}")
    with open(path, "r", encoding="utf-8") as f:
        return f.read()


_LATEX_SPECIAL_CHARS = {
    "\\": r"\textbackslash{}",
    "&": r"\&",
    "%": r"\%",
    "$": r"\$",
    "#": r"\#",
    "_": r"\_",
    "{": r"\{",
    "}": r"\}",
    "~": r"\textasciitilde{}",
    "^": r"\textasciicircum{}",
}

def _sanitize_latex_text(text: str) -> str:
    replacements = {
        "\u2011": "-",
        "\u2013": "--",
        "\u2014": "---",
        "\u2018": "'", "\u2019": "'",
        "\u201c": '"', "\u201d": '"',
        "\u2026": "...",
        "\u202f": " ",
        "\u00a0": " ",
        "\u200b": "",
        "\u2022": r"\textbullet",
        "\u00b7": r"\cdot",
    }
    for bad, good in replacements.items():
        text = text.replace(bad, good)
    text = text.encode("ascii", errors="ignore").decode("ascii")
    return text

def _escape_latex(text: str) -> str:
    text = text.replace("\\", _LATEX_SPECIAL_CHARS["\\"])
    for ch, repl in _LATEX_SPECIAL_CHARS.items():
        if ch == "\\":
            continue
        text = text.replace(ch, repl)
    return text

def _val(field) -> str:
    if isinstance(field, dict):
        raw = str(field.get("value", ""))
    else:
        raw = str(field) if field is not None else ""
    raw = _sanitize_latex_text(raw)
    raw = _escape_latex(raw)
    return raw if raw.strip() else "\\,"

def _short_id(seed: str) -> str:
    return hashlib.md5(seed.encode()).hexdigest()[:8]


_OPEN_RE  = re.compile(r"%%FOR_EACH (\w+) IN (\w+)%%")
_CLOSE_RE = re.compile(r"%%END_FOR%%")
_LABEL_RE = re.compile(r"<<([^>]+)>>")


def _find_matching_end(text: str, start: int) -> int:
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
        label = m.group(1)
        parts = label.split(".", 1)
        if parts[0] != var:
            return m.group(0)
        key = parts[1] if len(parts) > 1 else parts[0]
        # support nested dot access e.g. <<edu.school.id>>, <<edu.school.value>>
        keys = key.split(".")
        raw = item
        for k in keys:
            if isinstance(raw, dict):
                raw = raw.get(k, "")
            else:
                raw = ""
                break
        if keys[-1] == "id":
            return str(raw) if raw is not None else ""
        return _val(raw)
    return _LABEL_RE.sub(_sub, text)


def _render_template(text: str, var: str, item: dict) -> str:
    result = []
    pos    = 0
    while pos < len(text):
        m = _OPEN_RE.search(text, pos)
        if m is None:
            result.append(text[pos:])
            break
        result.append(text[pos:m.start()])
        inner_var        = m.group(1)
        inner_collection = m.group(2)
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
        pos = end_idx + len("%%END_FOR%%")
    rendered = "".join(result)
    rendered = _substitute_labels(rendered, var, item)
    return rendered


def _build_skill_rows(skills_raw) -> list:
    if isinstance(skills_raw, str):
        return [{"id": "skill-0", "label": "Skills", "value": skills_raw}]
    if isinstance(skills_raw, dict):
        return [
            {"id": f"skill-{i}", "label": label, "value": value}
            for i, (label, value) in enumerate(skills_raw.items())
        ]
    if isinstance(skills_raw, list):
        rows = []
        for i, row in enumerate(skills_raw):
            if isinstance(row, dict):
                row.setdefault("id", f"skill-{i}")
                rows.append(row)
        return rows
    return []


def _normalise_education(items: list) -> list:
    out = []
    for edu in items:
        e = dict(edu)
        # handle both stamped {id, value} dicts and plain strings
        if isinstance(e.get("school"), dict):
            pass  # already stamped
        else:
            e.setdefault("school", e.pop("institution", ""))
        e.setdefault("date", e.pop("end_date", e.pop("graduation_date", "")))
        e.setdefault("field", e.get("specialization", ""))
        out.append(e)
    return out


def fill_template(cv_json: dict, profile: dict, template_name: str = "cv_temp1") -> str:
    tpl = load_template(template_name)

    # ── 1. contact scalars — prefer cv_json["contact"], fall back to profile ──
    contact = cv_json.get("contact", {})

    def _get_contact(key: str, profile_key: str = None) -> str:
        val = contact.get(key, "")
        if not val and profile_key:
            val = profile.get(profile_key, "")
        return _sanitize_latex_text(_escape_latex(str(val))) if val else "\\,"

    contact_scalars = {
        "contact_name":          contact.get("name") or profile.get("display_name", ""),
        "contact_phone":         contact.get("phone") or profile.get("phone", ""),
        "contact_email":         contact.get("email") or profile.get("email", ""),
        "contact_email_raw":     contact.get("email") or profile.get("email", ""),
        "contact_linkedin":      contact.get("linkedin", ""),
        "contact_linkedin_url":  contact.get("linkedin_url", ""),
        "contact_github":        contact.get("github", ""),
        "contact_github_url":    contact.get("github_url", ""),
        "contact_portfolio":     contact.get("portfolio", ""),
        "contact_portfolio_url": contact.get("portfolio_url", ""),
    }

    for key, val in contact_scalars.items():
        safe = _sanitize_latex_text(_escape_latex(str(val))) if val else ""
        tpl = tpl.replace(f"<<{key}>>", safe)

    # ── 2. section titles — from cv_json["section_titles"] with defaults ──
    section_titles = cv_json.get("section_titles", {})
    title_defaults = {
        "education":  "Education",
        "experience": "Experience",
        "skills":     "Skills",
        "projects":   "Projects",
    }
    for key, default in title_defaults.items():
        val = section_titles.get(key, default)
        safe = _sanitize_latex_text(_escape_latex(str(val)))
        tpl = tpl.replace(f"<<section_{key}>>", safe)

    # ── 3. section loops ──
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

    leftover = _LABEL_RE.findall(tpl)
    if leftover:
        import sys
        print(f"[fill_template] WARNING: unfilled labels: {leftover}", file=sys.stderr)

    return tpl