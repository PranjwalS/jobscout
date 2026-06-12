import os
os.add_dll_directory(r"C:\Program Files\GTK3-Runtime Win64\bin")
from weasyprint import HTML, CSS
import re

BASE_URL = os.getenv("API_URL", "http://localhost:8000")
FONT_URL = f"{BASE_URL}/fonts/cmunrm.ttf"


def build_cover_letter_html(
    cover_letter_text: str,
    candidate_name: str,
    candidate_email: str,
    candidate_phone: str,
    candidate_location: str = "",
    candidate_links: list = [],
) -> str:
    contact_parts = [p for p in [candidate_phone, candidate_email, candidate_location] + candidate_links if p and p.strip()]
    contact_line = " &nbsp;|&nbsp; ".join(contact_parts)

    raw_paragraphs = [p.strip() for p in re.split(r'\n{2,}', cover_letter_text.strip()) if p.strip()]
    paragraphs_html = "\n".join(f'<p class="cl-paragraph">{para}</p>' for para in raw_paragraphs)

    html = f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8"/>
<style>
  @font-face {{
    font-family: 'CMR';
    src: url('{FONT_URL}') format('truetype');
    font-weight: normal;
    font-style: normal;
  }}

  * {{
    box-sizing: border-box;
    margin: 0;
    padding: 0;
  }}

  html, body {{
    font-family: 'CMR', 'Georgia', serif;
    font-size: 11pt;
    color: #1a1a1a;
    background: white;
    width: 100%;
  }}

  .page {{
    width: 100%;
    padding: 10% 11%;
    background: white;
  }}

  /* Header kept tight — same size as body text, just bold/centered */
  .header-name {{
    font-size: 11pt;
    font-weight: bold;
    text-align: center;
    letter-spacing: 0.04em;
    text-transform: uppercase;
    margin-bottom: 0.25em;
  }}

  .header-contact {{
    font-size: 9pt;
    text-align: center;
    color: #444;
    margin-bottom: 0.5em;
  }}

  .header-divider {{
    border: none;
    border-top: 0.5pt solid #bbb;
    margin-bottom: 1.2em;
  }}

  .salutation {{
    margin-bottom: 0.9em;
  }}

  .cl-paragraph {{
    line-height: 1.65;
    text-align: justify;
    margin-bottom: 0.9em;
    hyphens: auto;
  }}

  .signoff {{
    margin-top: 1.3em;
    line-height: 1.8;
  }}
</style>
</head>
<body>
  <div class="page" id="cl-page">
    <div class="header-name">{candidate_name}</div>
    <div class="header-contact">{contact_line}</div>
    <hr class="header-divider"/>
    <div class="salutation">Dear Hiring Manager,</div>
    {paragraphs_html}
    <div class="signoff">
      Sincerely,<br/>
      {candidate_name}
    </div>
  </div>
</body>
</html>"""

    return html


def html_to_pdf(html_string: str) -> bytes:
    page_css = CSS(string="""
        @page {
            size: letter;
            margin: 0;
        }
        body {
            margin: 0;
            padding: 0;
        }
    """)
    return HTML(string=html_string, base_url=".").write_pdf(stylesheets=[page_css])


def generate_cover_letter_pdf(
    cover_letter_text: str,
    candidate_name: str,
    candidate_email: str,
    candidate_phone: str,
    candidate_location: str = "",
    candidate_links: list = [],
) -> bytes:
    html_string = build_cover_letter_html(
        cover_letter_text=cover_letter_text,
        candidate_name=candidate_name,
        candidate_email=candidate_email,
        candidate_phone=candidate_phone,
        candidate_location=candidate_location,
        candidate_links=candidate_links,
    )
    return html_to_pdf(html_string)


def get_cover_letter_html(
    cover_letter_text: str,
    candidate_name: str,
    candidate_email: str,
    candidate_phone: str,
    candidate_location: str = "",
    candidate_links: list = [],
) -> str:
    return build_cover_letter_html(
        cover_letter_text=cover_letter_text,
        candidate_name=candidate_name,
        candidate_email=candidate_email,
        candidate_phone=candidate_phone,
        candidate_location=candidate_location,
        candidate_links=candidate_links,
    )



