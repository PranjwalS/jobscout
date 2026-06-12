from datetime import datetime
import os
import json
from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from fastapi import APIRouter, HTTPException, Depends
from dependencies import supabase_admin, get_current_user


router = APIRouter(prefix="/jobs", tags=["jobs"])

VALID_STATUSES = {"new", "saved", "applied", "rejected", "ignored", "interview"}

class JobPatch(BaseModel):
    status: Optional[str] = None
    notes: Optional[str] = None
    next_event: Optional[datetime] = None

    def validate_status(self):
        if self.status and self.status not in VALID_STATUSES:
            raise HTTPException(status_code=400, detail=f"Invalid status. Must be one of: {VALID_STATUSES}")
    
    def validate_notes(self):
        if self.notes and len(self.notes) > 1000:
            raise HTTPException(status_code=400, detail="Notes exceed 1000 character limit.")


@router.get("/{job_id}")
async def get_job(job_id: UUID, current_user=Depends(get_current_user)):
    job = supabase_admin.table("jobs").select("*").eq("id", str(job_id)).single().execute()
    if not job.data:
        raise HTTPException(status_code=404, detail="Job not found.")
    
    user_job = supabase_admin.table("user_jobs").select("*") \
        .eq("job_id", str(job_id)) \
        .eq("user_id", current_user["user_id"]) \
        .maybe_single().execute()

    return {
        "job": job.data,
        "user_job": user_job.data 
    }


@router.patch("/{job_id}")
async def patch_job(job_id: UUID, patch: JobPatch, current_user=Depends(get_current_user)):
    patch.validate_status()
    patch.validate_notes()

    updates = patch.model_dump(exclude_none=True)
    if not updates:
        raise HTTPException(status_code=400, detail="No fields to update.")
    
    updates["updated_at"] = datetime.utcnow().isoformat()

    result = supabase_admin.table("user_jobs").update(updates) \
        .eq("job_id", str(job_id)) \
        .eq("user_id", current_user["user_id"]) \
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="user_job not found.")
    
    return {"status": "ok", "updated": result.data[0]}


@router.delete("/{job_id}")
async def delete_job(job_id: UUID, current_user=Depends(get_current_user)):
    result = supabase_admin.table("user_jobs").delete() \
        .eq("job_id", str(job_id)) \
        .eq("user_id", current_user["user_id"]) \
        .execute()

    if not result.data:
        raise HTTPException(status_code=404, detail="user_job not found.")
    
    return {"status": "ok", "deleted_job_id": str(job_id)}
