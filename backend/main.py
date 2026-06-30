import json
import tempfile
import time
from typing import Optional
from pydantic import ValidationError
from fastapi import FastAPI, Depends, File, HTTPException, UploadFile, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from dotenv import load_dotenv
import os
import httpx
from jose import jwt, JWTError
from pydantic import BaseModel
from docling.document_converter import DocumentConverter
from backend.functions.cv_filler import fill_template
from functions.cv_and_cl_gen import cv_parser, job_parser, cover_letter_generator
from functions.pdf_generator import generate_cover_letter_pdf, get_cover_letter_html, html_to_pdf
import uuid
from fastapi.staticfiles import StaticFiles
from routes.creation_dashboard import router as dashboard_router
from routes.jobs import router as job_router
from dependencies import supabase_admin, supabase, get_current_user, FRONTEND_ORIGIN, redis_client
from functions.cv_latex import cv_selector, stamp_cv_ids
from functions.cv_compiler import compile_cv_pdf, LatexCompileError
import csv

app = FastAPI()
app.include_router(dashboard_router)
app.include_router(job_router)
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN, "http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.mount("/fonts", StaticFiles(directory="functions/fonts"), name="fonts")




@app.on_event("startup")
async def load_companies_cache():
    companies = []
    with open("data/companies.csv", "r") as f:
        reader = csv.DictReader(f)
        for row in reader:
            companies.append({
                "name": row["Company"],
                "country": row["Country"],
                "continent": row["Continent"],
            })
    
    if not redis_client:
        print("Redis not configured, skipping companies cache")
        return
    
    redis_client.setex("companies_list", 86400, json.dumps(companies))
    
    
### classses

class UserCreate(BaseModel):
    full_name: str
    email: str
    password: str


class UserLogin(BaseModel):
    email: str
    password: str
    
    
class EducationEntry(BaseModel):
    id: str = None
    institution: str
    degree: str
    field: str
    gpa: str | None
    start_date: str
    end_date: str
    details: list[str]
    
class ExperienceEntry(BaseModel):
    id: str = None
    company: str
    role: str
    location: str
    start_date: str
    end_date: str
    responsibilities: list[str]

class ProjectsEntry(BaseModel):
    id: str = None
    name: str
    description: list[str]
    start_date: str
    end_date: str
    links: list[str]
    tech_stack: list[str]


class UpdateEntryRequest(BaseModel):
    section: str
    id: str
    data: dict

class BulkUpdateRequest(BaseModel):
    updates: list[UpdateEntryRequest]


class NewEntryRequest(BaseModel):
    section: str
    data: dict
    

class BulkAddRequest(BaseModel):
    adds: list[NewEntryRequest]
    
class DeleteEntryRequest(BaseModel):
    section: str
    id: str
    
class EditCoverLetterRequest(BaseModel):
    user_job_id: str
    mode: str  # "regenerate" or "html"
    content: str | None = None 
 
 
class ProfileUpdateRequest(BaseModel):
    display_name: Optional[str] = None
    current_role: Optional[str] = None
    bio: Optional[str] = None
    phone: Optional[str] = None
    email: Optional[str] = None
    location: Optional[str] = None
    links: Optional[list[str]] = None


class DashboardReference(BaseModel):
    dashboard_config_id: str
    
    
    
### helpers
def stamp_ids(entries: list) -> list:
    for entry in entries:
        if not entry.get("id"):
            entry["id"] = str(uuid.uuid4())
    return entries



### endpoints

@app.get("/", response_class=HTMLResponse)
def root():
    return "<h1>JobScout API ✅</h1>"


@app.post("/create_user")
def create_user(user: UserCreate):
    try:
        auth_response = supabase_admin.auth.admin.create_user({
            "email": user.email,
            "password": user.password,
            "email_confirm": True,
            "user_metadata": {"full_name": user.full_name}
        })
        new_user = auth_response.user
        if not new_user:
            raise HTTPException(status_code=500, detail="Failed to create user")
    except HTTPException:
        raise
    except Exception as e:
        error_msg = str(e)
        if "already" in error_msg.lower():
            raise HTTPException(status_code=400, detail="Email already registered")
        raise HTTPException(status_code=500, detail=f"Auth error: {error_msg}")

    try:
        supabase_admin.table("profiles").insert({
            "user_id": str(new_user.id),
            "display_name": user.full_name,
        }).execute()
    except Exception as e:
        print(f"Profile insert error: {e}")

 ### sign in to fetch the jwt token and hold onto it to maintain state on frontend side
    try:
        sign_in = supabase.auth.sign_in_with_password({
            "email": user.email,
            "password": user.password,
        })
        token = sign_in.session.access_token
        refresh_token = sign_in.session.refresh_token
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Sign in after signup failed: {str(e)}")

    return {
        "id": str(new_user.id),
        "email": new_user.email,
        "full_name": user.full_name,
        "token": token,
        "refresh_token": refresh_token,
    }


@app.post("/login")
def approve_login(user: UserLogin):
    try:
        auth_response = supabase.auth.sign_in_with_password({
            "email": user.email,
            "password": user.password,
        })
        supabase_user = auth_response.user
        session = auth_response.session
        if not supabase_user or not session:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")
    except HTTPException:
        raise
    except Exception as e:
        error_msg = str(e).lower()
        if "invalid login" in error_msg or "invalid credentials" in error_msg:
            raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid email or password")
        raise HTTPException(status_code=500, detail=f"Login error: {str(e)}")

    return {
        "status": "success",
        "id": str(supabase_user.id),
        "email": supabase_user.email,
        "token": session.access_token,
        "refresh_token": session.refresh_token,
    }



@app.get("/me")
def get_me(current_user=Depends(get_current_user)):
    return {
        "id": current_user["user_id"],
        "email": current_user.get("email", ""),
        "full_name": current_user.get("display_name", ""),
        "slug": current_user.get("slug"),
        "display_name": current_user.get("display_name"),
    }

@app.get("/profile/get")
def get_profile(current_user=Depends(get_current_user)):
    """Returns full profile fields for the profile edit page."""
    return {
        "display_name": current_user.get("display_name", ""),
        "current_role": current_user.get("current_role", ""),
        "bio": current_user.get("bio", ""),
        "phone": current_user.get("phone", ""),
        "email": current_user.get("email", ""),
        "location": current_user.get("location", ""),
        "links": current_user.get("links", []),
    }

@app.put("/profile/update")
def update_profile(body: ProfileUpdateRequest, current_user=Depends(get_current_user)):
    """Updates editable profile fields. Only updates fields that are provided (not None)."""
    update_data = {}
    if body.display_name is not None:
        update_data["display_name"] = body.display_name
    if body.current_role is not None:
        update_data["current_role"] = body.current_role
    if body.bio is not None:
        update_data["bio"] = body.bio
    if body.phone is not None:
        update_data["phone"] = body.phone
    if body.email is not None:
        update_data["email"] = body.email
    if body.location is not None:
        update_data["location"] = body.location
    if body.links is not None:
        update_data["links"] = body.links

    if not update_data:
        raise HTTPException(status_code=400, detail="No fields to update")

    supabase_admin.table("profiles").update(update_data).eq("user_id", current_user["user_id"]).execute()
    return {"status": "ok"}



#### careertwin parts

@app.get("/careertwin/get_info")
def get_careertwin_info(current_user = Depends(get_current_user)):
    result = supabase_admin.table("profiles").select("*").eq("user_id", current_user["user_id"]).single().execute()
    user_profile = result.data
    return {
        "education": [EducationEntry(**e) for e in user_profile.get("education", []) if e],
        "experience": [ExperienceEntry(**e) for e in user_profile.get("experiences", []) if e],
        "projects": [ProjectsEntry(**e) for e in user_profile.get("projects", []) if e],
        "skills": user_profile.get("skills")
    }
    

@app.post("/careertwin/add_info")
def add_careertwin_info(body: BulkAddRequest, current_user = Depends(get_current_user)):
    result = supabase_admin.table("profiles").select("*").eq("user_id", current_user["user_id"]).single().execute()
    profile = result.data
    
    section_map = {
        "education": "education",
        "experiences": "experiences",
        "projects": "projects",
    }
    
    section_model_map = {
        "education": EducationEntry,
        "experiences": ExperienceEntry,
        "projects": ProjectsEntry,
    }
    
    affected = {}
    for add in body.adds:
        column = section_map.get(add.section)
        if not column:
            raise HTTPException(status_code=400, detail=f"Invalid section: {add.section}")
        
        model = section_model_map.get(add.section)  # EducationEntry, ExperienceEntry etc
        try:
            validated = model(**add.data)
        except ValidationError as e:
            raise HTTPException(status_code=422, detail=str(e))        
        
        if column not in affected:
            affected[column] = profile.get(column, [])
        
        entry = validated.dict()
        entry["id"] = str(uuid.uuid4())
        affected[column].append(entry)

    for column, entries in affected.items():
        supabase_admin.table("profiles").update({
            column: entries
        }).eq("user_id", current_user["user_id"]).execute()
    
    return {"status": "ok"}


@app.put("/careertwin/update_info")
def update_careertwin_info(body: BulkUpdateRequest, current_user = Depends(get_current_user)):
    result = supabase_admin.table("profiles").select("*").eq("user_id", current_user["user_id"]).single().execute()
    profile = result.data
    
    section_map = {
        "education": "education",
        "experiences": "experiences",
        "projects": "projects",
    }
    
    section_model_map = {
        "education": EducationEntry,
        "experiences": ExperienceEntry,
        "projects": ProjectsEntry,
    }
    
    # group updates by section so we only write each column once
    affected = {}
    for update in body.updates:
        column = section_map.get(update.section)
        model = section_model_map.get(update.section)
        if not column:
            raise HTTPException(status_code=400, detail=f"Invalid section: {update.section}")
        if column not in affected:
            affected[column] = profile.get(column, [])
        for entry in affected[column]:
            if entry.get("id") == update.id:
                entry.update(update.data)
                try:
                    validated = model(**entry)
                except ValidationError as e:
                    raise HTTPException(status_code=422, detail=str(e))
                entry.clear()
                entry.update(validated.dict())
                break

    for column, entries in affected.items():
        supabase_admin.table("profiles").update({
            column: entries
        }).eq("user_id", current_user["user_id"]).execute()
    
    return {"status": "ok"}


@app.delete("/careertwin/delete")
def delete_careertwin_info(body: DeleteEntryRequest, current_user = Depends(get_current_user)):
    result = supabase_admin.table("profiles").select("*").eq("user_id", current_user["user_id"]).single().execute()
    profile = result.data
    
    section_map = {
        "education": "education",
        "experiences": "experiences",
        "projects": "projects",
    }

    column = section_map.get(body.section)
    if not column:
        raise HTTPException(status_code=400, detail="Invalid section")

    entries = profile.get(column, [])
    new_entries = [e for e in entries if e.get("id") != body.id]

    if len(new_entries) == len(entries):
        raise HTTPException(status_code=404, detail="Entry not found")

    supabase_admin.table("profiles").update({
        column: new_entries
    }).eq("user_id", current_user["user_id"]).execute()

    return {"status": "ok"}




### ── User Jobs / Master Dashboard endpoint ──────────────────────────────────


## master endpoint
@app.get("/user_jobs/all")
def get_all_user_jobs(current_user=Depends(get_current_user)):
    """
    Returns all user_jobs for the current user, joined with job details.
    Used by the master dashboard to show every job the user has interacted with.
    """
    user_jobs = supabase_admin.table("user_jobs") \
        .select("*, jobs(*)") \
        .eq("user_id", current_user["user_id"]) \
        .order("created_at", desc=True) \
        .execute()
    return {"status": "ok", "user_jobs": user_jobs.data}


@app.patch("/user_jobs/status")
def update_user_job_status(user_job_id: str, new_status: str, current_user=Depends(get_current_user)):
    """Update application status for a single user_job."""
    valid_statuses = ["new", "saved", "applied", "rejected", "ignored", "interview"]
    if new_status not in valid_statuses:
        raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {valid_statuses}")

    user_job = supabase_admin.table("user_jobs").select("user_id").eq("id", user_job_id).single().execute().data
    if user_job["user_id"] != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Forbidden")

    update_data = {"status": new_status}
    if new_status == "applied":
        update_data["applied_at"] = "now()"

    supabase_admin.table("user_jobs").update(update_data).eq("id", user_job_id).execute()
    return {"status": "ok"}






### ── CV endpoints for PROFILE ───────────────────────────────────────────────────────────

@app.post("/cv/upload")
async def upload_cv(file: UploadFile = File(...), current_user = Depends(get_current_user)):
    path = f"{current_user['user_id']}/cv.pdf"
    file_bytes = await file.read()
    supabase_admin.storage.from_("cvs").upload(path, file_bytes, {"upsert":"true"})
    pdf_url = supabase_admin.storage.from_("cvs").get_public_url(path)
    
    converter = DocumentConverter()
    result = converter.convert(pdf_url) 
    cv_information = result.document.export_to_markdown()
    
    json_output = cv_parser(cv_information)

    contact = json_output.get("contact", {})
    supabase_admin.table("profiles").update({
        "cv_pdf_url": pdf_url,
        "cv_parsed_text": cv_information,
        "cv_json": json_output,
        "education": stamp_ids(json_output.get("education", [])),
        "experiences": stamp_ids(json_output.get("experience", [])),
        "projects": stamp_ids(json_output.get("projects", [])),
        "skills": json_output.get("skills", {}).get("skills", ""),
        "phone": contact.get("phone", ""),
        "email": contact.get("email", ""),
        "location": contact.get("location", ""),
        "links": contact.get("links", []),
    }).eq("user_id", current_user["user_id"]).execute()

    return {"status": "ok", "cv_pdf_url": pdf_url}


@app.get("/cv/get")
async def get_cv(current_user = Depends(get_current_user)):
    result = supabase_admin.table("profiles").select("*").eq("user_id", current_user["user_id"]).single().execute()
    user_profile = result.data
    return {
        "education": [EducationEntry(**e) for e in user_profile.get("education", []) if e],
        "experience": [ExperienceEntry(**e) for e in user_profile.get("experiences", []) if e],
        "projects": [ProjectsEntry(**e) for e in user_profile.get("projects", []) if e],
        "skills": user_profile.get("skills")
    }
    
    
@app.put("/cv/update")
async def update_cv(body: BulkUpdateRequest, current_user = Depends(get_current_user)):
    result = supabase_admin.table("profiles").select("*").eq("user_id", current_user["user_id"]).single().execute()
    profile = result.data
    
    section_map = {
        "education": "education",
        "experiences": "experiences",
        "projects": "projects",
    }
    
    section_model_map = {
        "education": EducationEntry,
        "experiences": ExperienceEntry,
        "projects": ProjectsEntry,
    }
    
    # group updates by section so we only write each column once
    affected = {}
    for update in body.updates:
        column = section_map.get(update.section)
        model = section_model_map.get(update.section)
        if not column:
            raise HTTPException(status_code=400, detail=f"Invalid section: {update.section}")
        if column not in affected:
            affected[column] = profile.get(column, [])
        for entry in affected[column]:
            if entry.get("id") == update.id:
                entry.update(update.data)
                try:
                    validated = model(**entry)
                except ValidationError as e:
                    raise HTTPException(status_code=422, detail=str(e))
                entry.clear()
                entry.update(validated.dict())
                break
            
    for column, entries in affected.items():
        supabase_admin.table("profiles").update({
            column: entries
        }).eq("user_id", current_user["user_id"]).execute()
    
    return {"status": "ok"}








### ── CV endpoints for CUSTOM (per job) ───────────────────────────────────────────────────────────

# ── Custom CV editing flow ────────────────────────────────────────────────────
#
# cv_json is the single source of truth — never .tex, never raw LaTeX, anywhere.
#
# 1. /custom_cv/generate builds an initial cv_json (via cv_selector + stamp_cv_ids)
#    and saves it on user_jobs. fill_template(cv_json, profile) renders this into
#    .tex, compile_cv_pdf() compiles that .tex into PDF bytes, which get uploaded
#    to the custom_cvs bucket and the url saved on user_jobs.
#
# 2. Frontend renders cv_json as a structured, inline-editable doc — text fields
#    per bullet/title/etc, drag-and-drop to reorder or add/remove entries — using
#    the stable ids stamped onto every entry. It feels like editing a normal doc,
#    but every field maps 1:1 to a key in cv_json. The frontend never sees or
#    touches .tex/LaTeX at any point.
#
# 3. On save, frontend POSTs back the full modified cv_json (not a diff) to
#    /custom_cv/edit. Backend re-runs fill_template(cv_json, profile) -> .tex,
#    recompiles via compile_cv_pdf() -> PDF bytes, re-uploads, updates the url.
#    Every edit is a full fresh render from structured data — never a patch
#    against existing .tex.
#
# fill_template is therefore the only place LaTeX syntax/labels ever exist;
# everything before and after it deals exclusively in cv_json.
#
# TODO: neither generate nor edit actually compiles a PDF right now — both just
# read/write cv_json. fill_template() exists and is ready but nothing calls it
# yet. Setup: compile on generate and compile on every edit. but first make the supabase storage upload (custom_cvs) -> save pdf url on user_jobs.

@app.post("/custom_cv/generate")
def cv_generator(user_job_id: str, current_user=Depends(get_current_user)):
    user_job = supabase_admin.table("user_jobs") \
        .select("*") \
        .eq("id", user_job_id) \
        .single().execute().data
        
    job = supabase_admin.table("jobs").select("*").eq("id", user_job["job_id"]).single().execute().data


    selected: dict = cv_selector(job, current_user)
    stamped: dict = stamp_cv_ids(selected)
    
    tex_source = fill_template(stamped, current_user)
    try:
        pdf_bytes = compile_cv_pdf(tex_source)
    except LatexCompileError as e:
        raise HTTPException(status_code=500, detail=f"CV compile failed: {str(e)}")

    path = f"{current_user['user_id']}/cv_{user_job_id}.pdf"
    Claude finished the responselets go work on jobscout, i have a chat with you working on the frotnned, and we'll go do some heavy backend stuffWhat's the current state you want to pick up from — is there a specific backend piece you have in mind (scraper, scoring, dashboard wizard, CV/cover letter pipeline), or do you want to first tell me what's broken/next on the list?import json
import tempfile
import time
from typing import Optional
from pydantic import ValidationError
from fastapi import FastAPI, Depends, File, HTTPException, UploadFile, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from fastapi.middleware.cors import CORSpastedthis is the main thing we'll work on today, just read it throguhRead through it. Quick map of what I'm seeing, and the rough edges that jump out — tell me which thread you want to pull on first.
Auth/profile/CV/CareerTwin CRUD endpoints look solid and consistent — same select-mutate-validate-write pattern repeated across education/experience/projects, working as intended.
The messier territory is the custom CV + cover letter pipeline at the bottom, where your own TODOs are sitting:
/custom_cv/generate and /custom_cv/edit only touch cv_json — fill_template() exists per your comment but nothing calls it, so there's no actual PDF being compiled or stored for custom CVs yet. That's the explicit gap you flagged.
/coverletter/new_cl is broken in a few ways: json_output and current_user.get("cv_parsed_text") are referenced but never defined in that function (looks like leftover from a copy-paste of the old combined endpoint), cl_generator ends without persisting anything to user_jobs or returning a response, and there's a typo .single.execute() (missing parens on .single) in two spots that will throw at runtime, not just give wrong data.
/coverletter/new_job (the PDF-upload job add) and /coverletter/new_cl (the generate-from-tracked-job flow) look like they used to be one endpoint and got split per your comment but the split wasn't finished — new_cl is half-built.
So the natural backend block today is probably: finish the CV PDF compile-and-store path (wire fill_template, add the custom_cvs storage bucket upload, save URL onto user_jobs), then fix/finish new_cl so it actually generates a cover letter for an existing tracked job end-to-end, consistent with how /coverletter/edit already does the html_to_pdf/storage/update dance.
Want to start with the CV PDF compile path, or fix new_cl first?teh coverletter get and edit are usable well init, like it can be used however the user pelases, its not dependent on new-job rightRight — get and edit are self-contained, keyed entirely off user_job_id, and don't care how that user_job row came to exist. They just assume:

the user_jobs row already exists (whether created by new_job, new_cl, or the scraper inserting directly into user_jobs/jobs)
that row has some state to work from — either cover_letter_html already populated, or cover_letter_text to build html from, or (for edit in regenerate mode) the linked jobs row plus current_user is enough to generate from scratch

So functionally yes — once a user_job_id exists, get will render whatever's there or build it on the fly, and edit can regenerate from nothing or take frontend-edited html and re-render to PDF. Neither depends on new_job or new_cl having run successfully first, as long as the row exists and job_id points to a valid job.
The one soft dependency: if new_cl/new_job never ran and cover_letter_text/cover_letter_html are both null/missing, the first get call will hit get_cover_letter_html(cover_letter_text=user_job["cover_letter_text"], ...) with None — does get_cover_letter_html handle that gracefully, or does it expect a string? That's the one thing worth checking before you call get/edit fully decoupled from a generation step.so i should work on making new_cl initYeah — new_cl is the missing link that actually populates cover_letter_text/cover_letter_html/cover_letter_pdf_url on a user_jobs row for the first time, mirroring what edit's regenerate branch already does. Let's fix it properly rather than patch the typos.
Looking at what it should do, modeled on edit:

Fetch the user_job row (you have this)
Fetch the job row — your job_data dict-building loop is fine but unused; cover_letter_generator probably just wants the job dict like edit passes it
Call cover_letter_generator(job, current_user) — drop the broken json_output/CV-conditional block, it's dead leftover logic that doesn't connect to anything
Build html via get_cover_letter_html(...) same as edit
html_to_pdf, upload to coverletters bucket, get public url — identical to edit's tail
Update user_jobs with cover_letter_text, cover_letter_html, cover_letter_pdf_url
Return {"status": "ok", "user_job_id": ...}

That's basically copy the bottom two-thirds of edit's regenerate branch into new_cl, minus the html-mode fork since new_cl is always a fresh generation.
Two things worth deciding before I write it:
The .single.execute() typo and the dead json_output/cv check at the top — confirmed dropping that whole block, right, not trying to salvage some CV-conditional logic you meant to build there?
And do you want new_cl to guard against double-generation (e.g. error or just overwrite if cover_letter_text already exists on that user_job), or always overwrite like edit does?ur salvaging this correct?### custom coverletter work, depends on cv_text
###### SPLIT NEW_JOB_ADD INTO -> JOB_UPLOADER && COVERLETTER_GENERATOR(so its callable by scraper that naturally parses and uploads jobs, but first calls CV_GENERATOR)
@app.post("/coverletter/new_cl")
async def cl_generator(job_id: str, dashboard_config_id: str, current_user=Depends(get_current_user)):
    user_job = supabase_admin.table("user_jobs") \
        .select("*") \
        .eq("user_id", current_user["user_id"]) \
        .eq("job_id", job_id) \
        .eq("dashboard_config_id", dashboard_config_id) \
        .single().execute().data
        
    cv_json = supabase_admin.table("user_jobs").select("*").eq("id", user_job["id"]).single.execute().data
    if cv_json:
        ...
    else:           
        ...

    job_info = supabase_admin.table("jobs").select("*").eq("id", job_id).single.execute().data
    job_data = {}
    sections = ["title", "company", "location", "description", "requirements", "skills", "salary", "duration", "fields"]
    for section in sections:
        job_data[section] = job_info[section]
    
    
    ## LATER: instead of passing current_user, we'll filter for relevant experience/projects/etc to make cv_text and then pass that instead for more relevant coverletter gen as well as for new cv PDF generation
    coverletter_text = cover_letter_generator(json_output, current_user)    
    path = f"{current_user['user_id']}/coverletter_{job_id}.pdf"
    html_data = get_cover_letter_html(
        cover_letter_text=coverletter_text,
        candidate_name=current_user.get("display_name", ""),
        candidate_email=current_user.get("email", ""),
        candidate_phone=current_user.get("phone", ""),
        candidate_location=current_user.get("location", ""),
        candidate_links=current_user.get("links", []),
    )
    pdf_bytes = html_to_pdf(html_data)

    bucket = supabase_admin.storage.from_("coverletters")
    bucket.upload(path, pdf_bytes, file_options={
        "content-type": "application/pdf",
        "upsert": "true"
    })
    time.sleep(1)
    pdf_url = bucket.get_public_url(path)    
    
    cv_text = current_user.get("cv_parsed_text", "")and yes it should overwrite, thats the point so user can repeatedly call new_cl if dissatisfied and the first new_cl will be called by a backedn pipeline so dwShow moreSalvaging the structure and intent, but the cv_json/if-else block at the top is dead — it fetches user_job again under the name cv_json (doesn't even touch a CV field) and the if/else does nothing on either branch. That's the part to actually cut. The job_info/job_data loop is good intent (matches the pattern in edit where you pass the job dict to cover_letter_generator) but currently unused since the call below uses the undefined json_output instead — going to wire job_data into that call.


@app.post("/custom_cv/generate")
def cv_generator(job_id: str, dashboard_config_id: str, current_user=Depends(get_current_user)):
    job = supabase_admin.table("jobs").select("*").eq("id", job_id).single().execute().data

    user_job = supabase_admin.table("user_jobs") \
        .select("*") \
        .eq("user_id", current_user["user_id"]) \
        .eq("job_id", job_id) \
        .eq("dashboard_config_id", dashboard_config_id) \
        .single().execute().data

    if not user_job:
        raise HTTPException(404, "user_job not found")

    selected = cv_selector(job, current_user)
    stamped  = stamp_cv_ids(selected)

    tex_source = fill_template(stamped, current_user)
    try:
        pdf_bytes = compile_cv_pdf(tex_source)
    except LatexCompileError as e:
        raise HTTPException(status_code=500, detail=f"CV compile failed: {str(e)}")

    path = f"{current_user['user_id']}/cv_{job_id}.pdf"
    bucket = supabase_admin.storage.from_("custom_cvs")
    bucket.upload(path, pdf_bytes, file_options={
        "content-type": "application/pdf",
        "upsert": "true"
    })
    pdf_url = bucket.get_public_url(path)

    ## make supabase storage
    supabase_admin.table("user_jobs").update({
        "cv_json": stamped,
        "cv_pdf_url": pdf_url,
    }).eq("id", user_job_id).execute()

    return {"status": "ok", "user_job_id": user_job_id, "cv_text": stamped, "cv_pdf_url": pdf_url}


@app.get("/custom_cv/get")
def cv_get(job_id: str, dashboard_config_id: str, current_user=Depends(get_current_user)):
    user_job = supabase_admin.table("user_jobs") \
        .select("*") \
        .eq("user_id", current_user["user_id"]) \
        .eq("job_id", job_id) \
        .eq("dashboard_config_id", dashboard_config_id) \
        .single().execute().data
 
    return {"status": "ok", "user_job_id": user_job["id"], "cv_text": user_job["cv_json"]}

 
@app.put("/custom_cv/edit")
def cv_edit(job_id: str, dashboard_config_id: str, cv_json: dict, current_user=Depends(get_current_user)):
    user_job = supabase_admin.table("user_jobs") \
        .select("*") \
        .eq("user_id", current_user["user_id"]) \
        .eq("job_id", job_id) \
        .eq("dashboard_config_id", dashboard_config_id) \
        .single().execute().data
 
    supabase_admin.table("user_jobs").update({
        "cv_json": cv_json
    }).eq("id", user_job["id"]).execute()
 
    return {"status": "ok", "user_job_id": user_job["id"], "cv_text": cv_json}
 

    
    




### ── CoverLetter endpoints for CUSTOM (per job) ───────────────────────────────────────────────────────────

### custom coverletter work, depends on cv_text
@app.post("/custom_cl/generate")
async def cl_generator(user_job_id: str, current_user=Depends(get_current_user)):
    user_job = supabase_admin.table("user_jobs") \
        .select("*") \
        .eq("id", user_job_id) \
        .single().execute().data
    
    if not user_job:
        raise HTTPException(404, "non existing job for said user")

    if user_job["user_id"] != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
 

    job_info = supabase_admin.table("jobs").select("*").eq("id", user_job["job_id"]).single().execute().data
    job_data = {}
    sections = ["title", "company", "location", "description", "requirements", "skills", "salary", "duration", "fields"]
    for section in sections:
        job_data[section] = job_info[section]
    
    cv_json = user_job.get("cv_json", "")
    
    ## LATER: instead of passing current_user, we'll filter for relevant experience/projects/etc to make cv_text and then pass that instead for more relevant coverletter gen as well as for new cv PDF generation
    coverletter_text = cover_letter_generator(job_data, cv_json)    
    path = f"{current_user['user_id']}/coverletter_{user_job['job_id']}.pdf"
    html_data = get_cover_letter_html(
        cover_letter_text=coverletter_text,
        candidate_name=current_user.get("display_name", ""),
        candidate_email=current_user.get("email", ""),
        candidate_phone=current_user.get("phone", ""),
        candidate_location=current_user.get("location", ""),
        candidate_links=current_user.get("links", []),
    )
    pdf_bytes = html_to_pdf(html_data)

    bucket = supabase_admin.storage.from_("coverletters")
    bucket.upload(path, pdf_bytes, file_options={
        "content-type": "application/pdf",
        "upsert": "true"
    })
    time.sleep(1)
    pdf_url = bucket.get_public_url(path)    
    
    supabase_admin.table("user_jobs").update({
        "cover_letter_text": coverletter_text,
        "cover_letter_html": html_data,
        "cover_letter_pdf_url": pdf_url,
    }).eq("id", user_job["id"]).execute()

    return {"status": "ok", "user_job_id": user_job["id"], "coverletter_url": pdf_url}    
    
    

# basically;
# Backend sends HTML → frontend renders it in contentEditable
# User edits visually
# Frontend grabs element.innerText → plain text with \n\n
# Sends plain text to PUT /coverletter/edit as content
# Backend stores plain text → calls build_cover_letter_html → WeasyPrint → PDF bytes → uploads → returns new pdf_url
@app.get("/custom_cl/get")
def cl_get(user_job_id: str, current_user=Depends(get_current_user)):
    user_job = supabase_admin.table("user_jobs").select("*").eq("id", user_job_id).single().execute().data
    
    if not user_job:
        raise HTTPException(404, "non existing job for said user")
    
    if user_job["user_id"] != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
 
    html_data = user_job.get("cover_letter_html") or get_cover_letter_html(
        cover_letter_text=user_job["cover_letter_text"],
        candidate_name=current_user.get("display_name", ""),
        candidate_email=current_user.get("email", ""),
        candidate_phone=current_user.get("phone", ""),
        candidate_location=current_user.get("location", ""),
        candidate_links=current_user.get("links", []),
    )
 
    return {"status": "ok", "html_data": html_data, "coverletter_url": user_job["cover_letter_pdf_url"], "user_job_id": user_job_id }
        

@app.put("/custom_cl/edit")
def cl_edit(data: EditCoverLetterRequest, current_user=Depends(get_current_user)):

    user_job = supabase_admin.table("user_jobs").select("*").eq("id", data.user_job_id).single().execute().data
    
    if not user_job:
        raise HTTPException(404, "non existing job for said user")
    
    if user_job["user_id"] != current_user["user_id"]:
        raise HTTPException(status_code=403, detail="Forbidden")
    
    
    job = supabase_admin.table("jobs").select("*").eq("id", user_job["job_id"]).single().execute().data
    cv_json = user_job["cv_json"]
    
    if data.mode == "regenerate":
        # Full regeneration from scratch
        try:
            coverletter_text = cover_letter_generator(job, cv_json)
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Cover letter generation failed: {str(e)}")
        html_data = get_cover_letter_html(
            cover_letter_text=coverletter_text,
            candidate_name=current_user.get("display_name", ""),
            candidate_email=current_user.get("email", ""),
            candidate_phone=current_user.get("phone", ""),
            candidate_location=current_user.get("location", ""),
            candidate_links=current_user.get("links", []),
        )
 
    elif data.mode == "html":
        # Frontend sends full innerHTML — store as-is, render to PDF as-is
        if not data.content:
            raise HTTPException(status_code=400, detail="Content required for html mode")
        html_data = data.content
        coverletter_text = user_job.get("cover_letter_text", "")  # preserve original text
 
    else:
        raise HTTPException(status_code=400, detail="Invalid mode, must be regenerate or html")
        
    #     old_url = user_job["cover_letter_pdf_url"]
    # upload new file with uuid instead → update DB → then delete old file
    path = f"{current_user['user_id']}/coverletter_{user_job['job_id']}.pdf"
    pdf_bytes = html_to_pdf(html_data)
    bucket = supabase_admin.storage.from_("coverletters")
    bucket.upload(path, pdf_bytes, file_options={
        "content-type": "application/pdf",
        "upsert": "true"
    })
    time.sleep(1)
    pdf_url = bucket.get_public_url(path)    
    
    supabase_admin.table("user_jobs").update({
        "cover_letter_text": coverletter_text,
        "cover_letter_html": html_data,
        "cover_letter_pdf_url": pdf_url
    }).eq("id", data.user_job_id).execute()

    return {"status": "ok", "user_job_id": data.user_job_id}






### ── Obsolete, to figure out: ───────────────────────────────────────────────────────────

@app.post("/coverletter/new_job")
async def new_job_add(file: UploadFile = File(...), current_user = Depends(get_current_user)):
    file_bytes = await file.read()
    converter = DocumentConverter()
    with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
        tmp.write(file_bytes)
        tmp_path = tmp.name
    result = converter.convert(tmp_path)
    os.unlink(tmp_path)
    job_information = result.document.export_to_markdown()    
    json_output = job_parser(job_information)


    job_response = supabase_admin.table("jobs").insert({
        "title": json_output.get("title", ""),
        "company": json_output.get("company", ""),
        "location": json_output.get("location", ""),
        "description": json_output.get("description", ""),
        "requirements": json_output.get("requirements", []),
        "skills": json_output.get("skills", []),
        "salary": json_output.get("salary", ""),
        "duration": json_output.get("duration", ""),
        "fields": json_output.get("fields", [])
    }).execute()
    
    job_id = job_response.data[0]["id"]

    user_job_response = supabase_admin.table("user_jobs").insert({ 
        "user_id": current_user["user_id"],
        "job_id": job_id,  
    }).execute()
    user_job_id = user_job_response.data[0]["id"]
    
    return {"status": "ok", "job_id": job_id, "user_job_id": user_job_id}