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

