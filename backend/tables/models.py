### For future migration whenever, this is the outline in supabase, also refer to SCHEMAS.md


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