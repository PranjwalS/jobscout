# Career Twin + JobScout Database Schema

**Database:** PostgreSQL (via Supabase)

**Philosophy:** Shared job entities, user-specific interactions. Jobs table stays canonical (one row per unique posting), user_jobs handles all personalization (CVs, scores, status).

---

## Core Tables

### 1. `profiles`
Master table for Career Twin user identity. One row per user.

```sql
CREATE TABLE profiles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    display_name TEXT NOT NULL,
    current_role TEXT,
    bio TEXT,
    phone TEXT,
    email TEXT,
    location TEXT,
    links JSONB DEFAULT '[]',
    skills JSONB,
    experiences JSONB,
    projects JSONB,
    education JSONB,
    cv_pdf_url TEXT,
    cv_parsed_text TEXT,
    cv_json JSONB,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX idx_profiles_user_id ON profiles(user_id);
```

---

### 2. `dashboard_configs`
Per-user dashboard configurations. Each user can have multiple dashboards (e.g., "Fall 2026 SWE", "Summer 2027 Internships").

```sql
CREATE TABLE dashboard_configs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
    name TEXT NOT NULL,
    description TEXT,

    -- Include filters
    include_skills JSONB NOT NULL DEFAULT '[]',
    include_fields JSONB NOT NULL DEFAULT '[]',
    include_locations JSONB NOT NULL DEFAULT '[]',
    include_companies JSONB NOT NULL DEFAULT '[]',

    -- Exclude filters
    exclude_skills JSONB NOT NULL DEFAULT '[]',
    exclude_fields JSONB NOT NULL DEFAULT '[]',
    exclude_locations JSONB NOT NULL DEFAULT '[]',
    exclude_companies JSONB NOT NULL DEFAULT '[]',

    -- Modes (preference = boost score, hard = strict filter)
    location_mode TEXT CHECK (location_mode IN ('preference', 'hard')) DEFAULT 'preference',
    company_mode TEXT CHECK (company_mode IN ('preference', 'hard')) DEFAULT 'preference',

    -- Job type
    job_types JSONB NOT NULL DEFAULT '["internship", "co-op"]',

    -- Seasons + work term
    seasons JSONB DEFAULT '["fall_2026"]',
    work_term_duration TEXT, -- refers to ; "4 months" or "8 months", etc

    -- Date range
    date_range JSONB,  -- { "start": "2026-09-01", "end": "2026-12-31" }

    -- Salary
    salary JSONB,      -- { "type": "hourly", "min": 20, "max": 40 }

    -- Scoring
    min_score_threshold INTEGER DEFAULT 30,

    active BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    last_synced_at TIMESTAMP WITH TIME ZONE,
);

CREATE INDEX idx_dashboard_configs_profile_id ON dashboard_configs(profile_id);
CREATE INDEX idx_dashboard_configs_active ON dashboard_configs(active) WHERE active = true;
```

---

### 3. `jobs`
Canonical job postings scraped from various sources. **Shared across all users** — one row per unique job URL.

```sql
CREATE TABLE jobs (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    url             TEXT UNIQUE,
    title           TEXT NOT NULL,
    company         TEXT NOT NULL,
    location        TEXT,
    locations       TEXT[],
    description     TEXT,
    source          TEXT,
    season          TEXT,
    fields          TEXT[],
    skills          TEXT[],
    requirements    JSONB,
    salary          JSONB,
    duration        JSONB,    --  {duration, start, end} ; duration is "4 months", "16 months", etc
    scraped_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    created_at      TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    job_type        TEXT,
);

CREATE UNIQUE INDEX idx_jobs_url        ON jobs(url);
CREATE INDEX idx_jobs_season            ON jobs(season);
CREATE INDEX idx_jobs_scraped_at        ON jobs(scraped_at);
CREATE INDEX idx_jobs_company           ON jobs(company);
CREATE INDEX idx_jobs_fields            ON jobs USING GIN(fields);
CREATE INDEX idx_jobs_skills            ON jobs USING GIN(skills);
```

**Scraping Strategy:**
- Aggregate all active `dashboard_configs` to create generalized search queries
- Example: if 50 users want "software engineer" + "fall_2026" + "remote", scrape once and share the results
- Dedupe by `url` on insert — if job exists, skip insertion into `jobs`, just create `user_jobs` entries

---

### 4. `user_jobs`
**The workhorse table.** User-specific interaction with jobs. Stores CVs, cover letters, scores, application status.

```sql
CREATE TABLE user_jobs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    dashboard_config_id UUID REFERENCES dashboard_configs(id) ON DELETE SET NULL, -- nullable, not all jobs come from dashboard
    job_id UUID NOT NULL REFERENCES jobs(id) ON DELETE CASCADE,
    
    -- User-specific generated content
    cv_json JSONB,                  -- Custom CV for this job
    cover_letter_text TEXT,        -- Custom cover letter for this job
    cover_letter_html TEXT
    cover_letter_pdf_url TEXT,     -- Stored PDF of the cover letter in supabase storage
    
    -- Scoring
    cv_to_job_score INTEGER,       -- How well CV matches job (0-100)
    job_to_cv_score INTEGER,       -- How well job matches user profile (0-100)
    match_score     INTEGER,
    cv_to_job_detail JSONB,
    job_to_cv_detail JSONB,
    llm_score INTEGER,             -- Overall LLM-computed relevance score (0-100)
    llm_rationale TEXT,
    
    -- Application tracking
    status TEXT DEFAULT 'new',     -- 'new', 'saved', 'applied', 'rejected', 'ignored', 'interview'
    notes TEXT,
    next_event TIMESTAMP WITH TIME ZONE,  -- upcoming interview, deadline, follow-up, whatever
    applied_at TIMESTAMP WITH TIME ZONE,
    
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
    
    CONSTRAINT unique_user_job UNIQUE (user_id, job_id, dashboard_config_id)
);

-- Critical compound index for dashboard queries
CREATE INDEX idx_user_jobs_dashboard_user ON user_jobs(dashboard_config_id, user_id, created_at DESC);

-- Index for filtering by status
CREATE INDEX idx_user_jobs_status ON user_jobs(user_id, dashboard_config_id, status);

-- Foreign key indexes
CREATE INDEX idx_user_jobs_user_id ON user_jobs(user_id);
CREATE INDEX idx_user_jobs_job_id ON user_jobs(job_id);
```

---

## Query Patterns

### Frontend: Load dashboard for a user
**Goal:** Show all jobs for "Fall 2026 Software Jobs" dashboard, paginated.

```sql
-- Initial load: first 50 jobs, ordered by most recent
SELECT 
    uj.id,
    uj.llm_score,
    uj.status,
    uj.created_at,
    j.title,
    j.company,
    j.location,
    j.url
FROM user_jobs uj
JOIN jobs j ON uj.job_id = j.id
WHERE uj.user_id = $1 
  AND uj.dashboard_config_id = $2
ORDER BY uj.created_at DESC
LIMIT 50 OFFSET 0;
```

**Performance:** With indexes, this hits `idx_user_jobs_dashboard_user` and returns in **5-50ms** even with 300k+ rows in `user_jobs`.

---

### Backend: Scraping pipeline
1. **Aggregate search configs:**
   ```sql
   SELECT DISTINCT 
       keywords,
       locations,
       seasons
   FROM dashboard_configs
   WHERE active = true;
   ```

2. **Dedupe and merge** into generalized search queries (application logic)

3. **Scrape jobs** from sources (LinkedIn, Indeed, etc.)

4. **Insert jobs** (skip if URL exists):
   ```sql
   INSERT INTO jobs (url, title, company, location, description, source, season)
   VALUES ($1, $2, $3, $4, $5, $6, $7)
   ON CONFLICT (url) DO NOTHING
   RETURNING id;
   ```

5. **Score against all users** who have matching `dashboard_configs`

6. **Insert into `user_jobs`** for each user where score > threshold:
   ```sql
   INSERT INTO user_jobs (
       user_id, 
       dashboard_config_id, 
       job_id, 
       llm_score, 
       status
   )
   VALUES ($1, $2, $3, $4, 'new')
   ON CONFLICT (user_id, job_id) DO NOTHING;
   ```

---

## Performance Considerations

### Storage Math (1000 users)
- **Jobs table:** ~10,000 unique jobs (lean, canonical)
- **User_jobs table:** ~300,000 rows (1000 users × 300 jobs/user)
  - CV + cover letter: ~4KB per row
  - Total: ~1.2GB (totally fine for Postgres)

### Query Performance
- **Indexed queries on `user_jobs`:** 5-50ms for 300k+ rows
- **Unindexed full table scans:** 10+ seconds (avoid these)

### DO's:
✅ Use compound indexes on query patterns (`dashboard_config_id, user_id, created_at DESC`)
✅ Paginate results (load 50 jobs at a time, infinite scroll)
✅ Dedupe jobs by URL to keep `jobs` table lean
✅ Store canonical data (description, title) in `jobs`, not duplicated in `user_jobs`

### DON'Ts:
❌ Full table scans with `LIKE` on text columns
❌ No indexes on foreign keys
❌ Fetching all 300 jobs at once instead of paginating
❌ Storing redundant job data in `user_jobs`

---

**Example `models.py` (for future migration):**
```python
from sqlalchemy import Column, String, Integer, Boolean, Text, TIMESTAMP, ForeignKey
from sqlalchemy.dialects.postgresql import UUID, JSONB
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.sql import func
import uuid

Base = declarative_base()

class Profile(Base):
    __tablename__ = 'profiles'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('auth.users.id', ondelete='CASCADE'), unique=True, nullable=False)
    display_name = Column(Text, nullable=False)
    current_role = Column(Text)
    bio = Column(Text)
    skills = Column(JSONB)
    experiences = Column(JSONB)
    projects = Column(JSONB)
    education = Column(JSONB)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())

class DashboardConfig(Base):
    __tablename__ = 'dashboard_configs'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    profile_id = Column(UUID(as_uuid=True), ForeignKey('profiles.id', ondelete='CASCADE'), nullable=False)
    name = Column(Text, nullable=False)
    keywords = Column(JSONB, nullable=False)
    locations = Column(JSONB)
    seasons = Column(JSONB)
    min_score_threshold = Column(Integer, default=30)
    active = Column(Boolean, default=True)
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())

class Job(Base):
    __tablename__ = 'jobs'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    url = Column(Text, unique=True, nullable=False)
    title = Column(Text, nullable=False)
    company = Column(Text, nullable=False)
    location = Column(Text)
    description = Column(Text)
    source = Column(Text)
    season = Column(Text)
    scraped_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())

class UserJob(Base):
    __tablename__ = 'user_jobs'
    
    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('auth.users.id', ondelete='CASCADE'), nullable=False)
    dashboard_config_id = Column(UUID(as_uuid=True), ForeignKey('dashboard_configs.id', ondelete='CASCADE'), nullable=False)
    job_id = Column(UUID(as_uuid=True), ForeignKey('jobs.id', ondelete='CASCADE'), nullable=False)
    cv_text = Column(Text)
    cover_letter_text = Column(Text)
    cv_to_job_score = Column(Integer)
    job_to_cv_score = Column(Integer)
    llm_score = Column(Integer)
    status = Column(Text, default='new')
    applied_at = Column(TIMESTAMP(timezone=True))
    created_at = Column(TIMESTAMP(timezone=True), server_default=func.now())
    updated_at = Column(TIMESTAMP(timezone=True), server_default=func.now(), onupdate=func.now())
```

---

## Next Steps

1. **Create tables in Supabase** (SQL editor or migrations)
2. **Set up indexes** (critical for performance)
3. **Build scraping pipeline** that populates `jobs` and `user_jobs`
4. **Frontend queries** via Supabase client or direct Postgres connection
5. **(Optional) Write `models.py`** for future SQLAlchemy migration

---

## Notes

- **auth.users** table already exists via Supabase Auth — don't create it manually
- Use **UUID** primary keys (Supabase default) for better distribution and security
- **JSONB** columns for flexible nested data (skills, experiences) — index specific keys if needed: `CREATE INDEX idx_profiles_skills ON profiles USING GIN (skills);`
- Set up **RLS (Row Level Security)** in Supabase to ensure users only see their own data