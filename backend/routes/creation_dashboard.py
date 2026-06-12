from datetime import datetime
import os
import json
from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from fastapi import APIRouter, HTTPException, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from dependencies import supabase_admin, get_current_user, redis_client

router = APIRouter()



class SalaryConfig(BaseModel):
    type: str  # "hourly", "weekly", "monthly", "yearly"
    min: Optional[float] = None
    max: Optional[float] = None

class DateRange(BaseModel):
    start: Optional[str] = None   # ISO date string
    end: Optional[str] = None

class LocationConfig(BaseModel):
    mode: str = "preference"      # "preference" | "hard"
    includes: list[str] = []      # country or city strings
    excludes: list[str] = []
    radius: Optional[dict] = None # {"lat": float, "lng": float, "km": int}

class DashboardConfigCreate(BaseModel):
    name: str
    description: Optional[str] = None
    job_types: list[str] = []
    include_fields: list[str] = []
    exclude_fields: list[str] = []
    include_skills: list[str] = []
    exclude_skills: list[str] = []
    location: Optional[LocationConfig] = None
    include_companies: list[str] = []
    exclude_companies: list[str] = []
    company_mode: str = "preference"   # "preference" | "hard"
    salary: Optional[SalaryConfig] = None
    seasons: list[str] = []
    work_term_duration: Optional[str] = None
    date_range: Optional[DateRange] = None

class DashboardConfigPatch(BaseModel):
    name: Optional[str] = None
    description: Optional[str] = None
    job_types: Optional[list[str]] = None
    include_fields: Optional[list[str]] = None
    exclude_fields: Optional[list[str]] = None
    include_skills: Optional[list[str]] = None
    exclude_skills: Optional[list[str]] = None
    location: Optional[LocationConfig] = None
    include_companies: Optional[list[str]] = None
    exclude_companies: Optional[list[str]] = None
    company_mode: Optional[str] = None
    salary: Optional[SalaryConfig] = None
    seasons: Optional[list[str]] = None
    work_term_duration: Optional[str] = None
    date_range: Optional[DateRange] = None
    active: Optional[bool] = None   # flip True on Launch



@router.get("/meta/skills")
async def get_skills():
    with open("data/skills.json", "r") as f:
        return json.load(f)

@router.get("/meta/fields")
async def get_fields():
    with open("data/new_fields.json", "r") as f:
        data = json.load(f)
    # Return just the top-level category names as the field list
    return list(data["fields"].keys())

@router.get("/meta/locations")
async def get_locations():
    with open("data/locations.json", "r") as f:
        data = json.load(f)
    
    # Group cities by country
    country_map = {}
    for loc in data["locations"]:
        country = loc["country"]
        if country not in country_map:
            country_map[country] = []
        if loc["value"] != country:  # skip "Canada (any)" type entries
            country_map[country].append(loc["label"])
    
    return [{"name": country, "cities": cities} for country, cities in country_map.items()]

@router.get("/meta/companies")
async def get_companies(search: str = ""):
    if not search or len(search) < 2:
        return []

    cached = redis_client.get("companies_list")
    if not cached:
        raise HTTPException(status_code=503, detail="Companies list not cached yet")

    companies = json.loads(cached)
    filtered = [c for c in companies if search.lower() in c["name"].lower()]
    return filtered[:20]

@router.get("/meta/skills-by-fields")
async def get_skills_by_fields(fields: str = ""):
    with open("data/skills.json", "r") as f:
        all_skills = json.load(f)

    if not fields:
        # Return all skills flattened
        result = []
        for field_skills in all_skills.values():
            for category_skills in field_skills.values():
                result.extend(category_skills)
        return list(set(result))

    requested = {f.strip() for f in fields.split(",")}
    result = []
    for field, categories in all_skills.items():
        if field in requested:
            for category_skills in categories.values():
                result.extend(category_skills)
    return list(set(result))



@router.get("/dashboard-configs")
async def list_dashboard_configs(current_user: dict = Depends(get_current_user)):
    res = (
        supabase_admin
        .table("dashboard_configs")
        .select("*")
        .eq("user_id", current_user["user_id"])
        .order("created_at", desc=True)
        .execute()
    )
    return res.data


@router.get("/dashboard-configs/{config_id}")
async def get_dashboard_config(config_id: UUID, current_user: dict = Depends(get_current_user)):
    res = (
        supabase_admin
        .table("dashboard_configs")
        .select("*")
        .eq("id", str(config_id))
        .eq("user_id", current_user["user_id"])  
        .single()
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Config not found")
    return res.data


@router.get("/dashboard-configs/{config_id}/export")
async def export_dashboard_config(config_id: UUID, current_user: dict = Depends(get_current_user)):
    res = (
        supabase_admin
        .table("dashboard_configs")
        .select("*")
        .eq("id", str(config_id))
        .eq("user_id", current_user["user_id"])
        .single()
        .execute()
    )
    if not res.data:
        raise HTTPException(status_code=404, detail="Config not found")

    # Strip internal fields before export
    export = {k: v for k, v in res.data.items() if k not in ("user_id", "created_at", "updated_at")}
    return export


@router.post("/dashboard-configs")
async def create_dashboard_config(
    payload: DashboardConfigCreate,
    current_user: dict = Depends(get_current_user),
):
    row = {
        "user_id": current_user["user_id"],
        "active": False,
        **payload.model_dump(exclude_none=True, exclude={"location", "salary", "date_range"}),
    }

    # Serialize nested models to plain dicts for Supabase
    if payload.salary:
        row["salary"] = payload.salary.model_dump()
    if payload.date_range:
        row["date_range"] = payload.date_range.model_dump()
    if payload.location:
        row["location_mode"] = payload.location.mode
        row["include_locations"] = payload.location.includes
        row["exclude_locations"] = payload.location.excludes

    res = supabase_admin.table("dashboard_configs").insert(row).execute()
    if not res.data:
        raise HTTPException(status_code=500, detail="Failed to create config")
    return res.data[0]


@router.patch("/dashboard-configs/{config_id}")
async def update_dashboard_config(
    config_id: UUID,
    payload: DashboardConfigPatch,
    current_user: dict = Depends(get_current_user),
):
    # Ownership check first
    existing = (
        supabase_admin
        .table("dashboard_configs")
        .select("id")
        .eq("id", str(config_id))
        .eq("user_id", current_user["user_id"])
        .single()
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Config not found")

    updates = payload.model_dump(exclude_none=True, exclude={"location", "salary", "date_range"})

    if payload.salary:
        updates["salary"] = payload.salary.model_dump()
    if payload.date_range:
        updates["date_range"] = payload.date_range.model_dump()
    if payload.location:
        updates["location_mode"] = payload.location.mode
        updates["include_locations"] = payload.location.includes
        updates["exclude_locations"] = payload.location.excludes
        
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update")

    res = (
        supabase_admin
        .table("dashboard_configs")
        .update(updates)
        .eq("id", str(config_id))
        .execute()
    )
    return res.data[0]


@router.delete("/dashboard-configs/{config_id}")
async def delete_dashboard_config(config_id: UUID, current_user: dict = Depends(get_current_user)):
    existing = (
        supabase_admin
        .table("dashboard_configs")
        .select("id")
        .eq("id", str(config_id))
        .eq("user_id", current_user["user_id"])
        .single()
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Config not found")

    supabase_admin.table("dashboard_configs").delete().eq("id", str(config_id)).execute()
    return {"deleted": str(config_id)}


@router.post("/dashboard-configs/{config_id}/launch")
async def launch_dashboard_config(config_id: UUID, current_user: dict = Depends(get_current_user)):
    """Activate a config — sets active=True, deactivates all others for this user."""
    existing = (
        supabase_admin
        .table("dashboard_configs")
        .select("id")
        .eq("id", str(config_id))
        .eq("user_id", current_user["user_id"])
        .single()
        .execute()
    )
    if not existing.data:
        raise HTTPException(status_code=404, detail="Config not found")

    # Deactivate all other configs for this user
    # supabase_admin.table("dashboard_configs").update({"active": False}).eq("user_id", user_id).execute()

    # Activate this one
    res = (
        supabase_admin
        .table("dashboard_configs")
        .update({"active": True})
        .eq("id", str(config_id))
        .execute()
    )
    return res.data[0]




# ─── Jobs Feed ────────────────────────────────────────────────────────────────

def apply_config_filters(job: dict, config: dict) -> bool:
    job_types = config.get("job_types") or []
    if job_types and job.get("job_type") not in job_types:
        return False

    seasons = config.get("seasons") or []
    if seasons and job.get("season") not in seasons:
        return False

    # work_term_duration; only filter if config specifies it  KINDA UNECESSARY
    cfg_duration = config.get("work_term_duration")
    job_duration = job.get("duration") or {}
    if cfg_duration and job_duration.get("duration"):
        if cfg_duration.lower() != job_duration["duration"].lower():
            return False
        
    date_range = config.get("date_range") or {}
    if date_range:
        cfg_start = date_range.get("start")
        cfg_end   = date_range.get("end")
        job_start_raw = job_duration.get("start")
        if job_start_raw:
            try:
                job_start_dt = datetime.fromisoformat(job_start_raw)
                if cfg_start and job_start_dt < datetime.fromisoformat(cfg_start):
                    return False
                if cfg_end and job_start_dt > datetime.fromisoformat(cfg_end):
                    return False
            except (ValueError, TypeError):
                pass


    exc_companies = {c.lower().strip() for c in (config.get("exclude_companies") or [])}
    job_company   = (job.get("company") or "").lower().strip()
    if exc_companies and any(c in job_company for c in exc_companies):
        return False

    inc_companies = [c.lower().strip() for c in (config.get("include_companies") or [])]
    if config.get("company_mode") == "hard" and inc_companies:
        if not any(c in job_company for c in inc_companies):
            return False

    inc_locations = [l.lower().strip() for l in (config.get("include_locations") or [])]
    exc_locations = [l.lower().strip() for l in (config.get("exclude_locations") or [])]
    job_locations = [l.lower().strip() for l in (job.get("locations") or [job.get("location", "")])]
    job_loc_str   = " ".join(job_locations)

    if config.get("location_mode") == "hard" and inc_locations:
        if not any(l in job_loc_str for l in inc_locations):
            return False

    if exc_locations and any(l in job_loc_str for l in exc_locations):
        return False


    job_skills = {s.lower().strip() for s in (job.get("skills") or [])}
    inc_skills  = {s.lower().strip() for s in (config.get("include_skills") or [])}
    exc_skills  = {s.lower().strip() for s in (config.get("exclude_skills") or [])}

    skill_inc_signal = 0.0
    skill_exc_penalty = 0.0

    if inc_skills and job_skills:
        matched_inc  = len(job_skills & inc_skills)
        skill_inc_signal = matched_inc / (len(job_skills) * len(inc_skills)) ** 0.5

    if exc_skills and job_skills:
        matched_exc      = len(job_skills & exc_skills)
        skill_exc_penalty = matched_exc / (len(job_skills) * len(exc_skills)) ** 0.5

    skill_net = skill_inc_signal - (skill_exc_penalty)


    job_fields = {f.lower().strip() for f in (job.get("fields") or [])}
    inc_fields  = {f.lower().strip() for f in (config.get("include_fields") or [])}
    exc_fields  = {f.lower().strip() for f in (config.get("exclude_fields") or [])}

    field_inc_signal  = 0.0
    field_exc_penalty = 0.0

    if inc_fields and job_fields:
        matched_inc       = len(job_fields & inc_fields)
        field_inc_signal  = matched_inc / (len(job_fields) * len(inc_fields)) ** 0.5

    if exc_fields and job_fields:
        matched_exc        = len(job_fields & exc_fields)
        field_exc_penalty = matched_exc / (len(job_fields) * len(exc_fields)) ** 0.5

    field_net = field_inc_signal - (field_exc_penalty * 1.2)

    total = (
        skill_net * 0.65 +
        field_net * 0.35 
    )

    # if user set no includes at all -> exclude-only mode, >= 0
    user_has_includes = bool(inc_skills or inc_fields)
    if not user_has_includes:
        return total >= 0.0

    return total > 0.0



# user can manually trigger (MAIN USE CASE NOW IS MANUAL TRIGGER SINCE SCRAPER AUTO ADDS JOBS TO USER_JOBS) it too (or you call it on dashboard open if last sync was >X hours ago).
@router.post("/dashboard-configs/{config_id}/sync")
async def sync_jobs_for_config(
    config_id: UUID,
    current_user: dict = Depends(get_current_user),
):
    
    user_id = current_user["user_id"]
    config_res = (
        supabase_admin
        .table("dashboard_configs")
        .select("*")
        .eq("id", str(config_id))
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    if not config_res.data:
        raise HTTPException(status_code=404, detail="Config not found")

    config = config_res.data
    last_synced = config.get("last_synced_at")

    jobs_query = supabase_admin.table("jobs").select("*")
    if last_synced:
        jobs_query = jobs_query.gt("scraped_at", last_synced)

    jobs_res = jobs_query.execute()
    all_jobs = jobs_res.data or []

    filtered_jobs = [job for job in all_jobs if apply_config_filters(job, config)]

    if not filtered_jobs:
        return {"synced": 0}

    rows = [
        {
            "user_id": user_id,
            "dashboard_config_id": str(config_id),
            "job_id": job["id"],
            "status": "new",
        }
        for job in filtered_jobs
    ]

    res = (
        supabase_admin
        .table("user_jobs")
        .upsert(rows, on_conflict="user_id,job_id,dashboard_config_id", ignore_duplicates=True)
        .execute()
    )
    
    supabase_admin.table("dashboard_configs").update({"last_synced_at": datetime.utcnow().isoformat()}).eq("id", str(config_id)).execute()
    return {"synced": len(res.data) if res.data else 0}


@router.get("/dashboard-configs/{config_id}/jobs")
async def get_jobs_for_config(
    config_id: UUID,
    current_user: dict = Depends(get_current_user),
    limit: int = 50,
    offset: int = 0,
    status: Optional[str] = None,
):
    user_id = current_user["user_id"]

    config_res = (
        supabase_admin
        .table("dashboard_configs")
        .select("id")
        .eq("id", str(config_id))
        .eq("user_id", user_id)
        .single()
        .execute()
    )
    if not config_res.data:
        raise HTTPException(status_code=404, detail="Config not found")

    query = (
        supabase_admin
        .table("user_jobs")
        .select("*, jobs(*)")
        .eq("dashboard_config_id", str(config_id))
        .eq("user_id", user_id)
        .order("llm_score", desc=True, nulls_first=False)
        .order("created_at", desc=True)
        .range(offset, offset + limit - 1)
    )

    if status:
        query = query.eq("status", status)

    res = query.execute()
    return {"jobs": res.data, "offset": offset, "limit": limit, "count": len(res.data)}