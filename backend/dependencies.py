import os
import httpx
from dotenv import load_dotenv
from supabase import create_client, Client
from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from jose import jwt, JWTError

load_dotenv(dotenv_path=os.path.join(os.path.dirname(__file__), "backend.env"), override=True)

FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "*")
SUPABASE_URL = os.getenv("SUPABASE_PROD_URL")
SUPABASE_PUBLISHABLE_KEY = os.getenv("SUPABASE_PUBLISHABLE_KEY")
SUPABASE_SECRET_KEY = os.getenv("SUPABASE_SECRET_KEY")

# Public client for auth operations (sign in, sign up)
supabase: Client = create_client(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY)

# Admin client using secret key for admin operations
supabase_admin: Client = create_client(SUPABASE_URL, SUPABASE_SECRET_KEY)



bearer_scheme = HTTPBearer()
_jwks_cache = None




def get_jwks():
    global _jwks_cache
    if _jwks_cache:
        return _jwks_cache
    response = httpx.get(f"{SUPABASE_URL}/auth/v1/.well-known/jwks.json")
    response.raise_for_status()
    _jwks_cache = response.json()
    return _jwks_cache

def verify_supabase_jwt(token: str):
    try:
        jwks = get_jwks()
        # Get the kid from token header
        unverified_header = jwt.get_unverified_header(token)
        kid = unverified_header.get("kid")
        # Find matching key
        key = None
        for k in jwks.get("keys", []):
            if k.get("kid") == kid:
                key = k
                break
        if not key:
            return None
        payload = jwt.decode(token, key, algorithms=["ES256", "RS256"], options={"verify_aud": False})
        return payload
    except JWTError:
        return None


def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(bearer_scheme)):
    token = credentials.credentials
    payload = verify_supabase_jwt(token)
    if not payload:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid or expired token")
    user_id = payload.get("sub")
    if not user_id:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid token")
    try:
        profile = supabase_admin.table("profiles").select("*").eq("user_id", user_id).single().execute()
        if not profile.data:
            raise HTTPException(status_code=404, detail="Profile not found")
        return {"user_id": user_id, **profile.data}
    except HTTPException:
        raise
    except Exception:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Could not validate user")



### HAVE TO IMPLEMENT REDIS_CLIENT HERE AND ATTACH WITH MAIN AND DASHBOARD ENDPOINTS PY FILES
redis_client = None