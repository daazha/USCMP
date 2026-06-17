"""SQLAlchemy ORM models for PostgreSQL."""

from datetime import datetime
from sqlalchemy import (
    Column, String, Integer, Float, Boolean, Text, Date,
    DateTime, JSON, ForeignKey
)
from sqlalchemy.orm import relationship
from app.db.postgres import Base


class Member(Base):
    __tablename__ = "members"

    id = Column(String, primary_key=True)
    canonical_name = Column(String, nullable=False, index=True)
    display_name = Column(String, nullable=False)
    aliases = Column(JSON, default=[])
    person_type = Column(String, nullable=False)
    party = Column(String, index=True)
    chamber = Column(String, index=True)
    state = Column(String(2), index=True)
    district = Column(String)
    official_photo_url = Column(String)
    bioguide_id = Column(String)
    govtrack_id = Column(String)
    fec_candidate_id = Column(String)
    opensecrets_id = Column(String)
    top_contributors = Column(JSON, default=[])
    top_holdings = Column(JSON, default=[])
    committee_memberships = Column(JSON, default=[])
    career_summary = Column(JSON, default=[])
    china_stance_summary = Column(Text)
    controversies = Column(JSON, default=[])
    source_reliability = Column(String, default="mock")
    extraction_method = Column(String, default="mock")
    congress = Column(Integer, index=True)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Organization(Base):
    __tablename__ = "organizations"

    id = Column(String, primary_key=True)
    canonical_name = Column(String, nullable=False, index=True)
    display_name = Column(String, nullable=False)
    aliases = Column(JSON, default=[])
    entity_type = Column(String, nullable=False, index=True)
    industry = Column(String, index=True)
    ticker = Column(String)
    country = Column(String, default="US")
    source_reliability = Column(String, default="mock")
    extraction_method = Column(String, default="mock")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class SourceDocument(Base):
    __tablename__ = "source_documents"

    id = Column(String, primary_key=True)
    source_name = Column(String, nullable=False, index=True)
    source_url = Column(String)
    title = Column(String)
    publisher = Column(String)
    published_at = Column(DateTime)
    collected_at = Column(DateTime)
    last_seen_at = Column(DateTime)
    document_type = Column(String, index=True)
    raw_text_hash = Column(String)
    snippet = Column(Text)
    source_reliability = Column(String, default="mock")
    license_note = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Event(Base):
    __tablename__ = "events"

    id = Column(String, primary_key=True)
    event_type = Column(String, nullable=False, index=True)
    title = Column(String, nullable=False)
    description = Column(Text)
    event_date = Column(Date, nullable=False, index=True)
    congress = Column(Integer, index=True)
    source_reliability = Column(String, default="mock")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class Claim(Base):
    __tablename__ = "claims"

    claim_id = Column(String, primary_key=True)
    claim_type = Column(String, nullable=False)
    subject_id = Column(String, nullable=False, index=True)
    object_id = Column(String, nullable=False, index=True)
    relation_type = Column(String, nullable=False, index=True)
    claim_text = Column(Text, nullable=False)
    original_snippet = Column(Text)
    confidence_score = Column(Float, nullable=False, default=0.5, index=True)
    extraction_method = Column(String, default="mock")
    source_reliability = Column(String, default="mock")
    review_status = Column(String, default="unreviewed")
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class EtlSource(Base):
    __tablename__ = "etl_sources"

    id = Column(Integer, primary_key=True, autoincrement=True)
    source_name = Column(String, nullable=False)
    source_url = Column(String)
    license_note = Column(String)
    robots_policy_note = Column(String)
    rate_limit = Column(String)
    supports_incremental = Column(Boolean, default=False)
    last_updated_at = Column(DateTime)
    data_freshness_window = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)


class ApiRequestLog(Base):
    __tablename__ = "api_request_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    request_id = Column(String, nullable=False, index=True)
    endpoint = Column(String, nullable=False)
    method = Column(String, nullable=False)
    status_code = Column(Integer)
    duration_ms = Column(Float)
    ip_address = Column(String)
    created_at = Column(DateTime, default=datetime.utcnow, index=True)


class MockSeedManifest(Base):
    __tablename__ = "mock_seed_manifest"

    id = Column(Integer, primary_key=True, autoincrement=True)
    seed_version = Column(String, nullable=False)
    entity_type = Column(String, nullable=False)
    entity_count = Column(Integer, nullable=False)
    seed_timestamp = Column(DateTime, default=datetime.utcnow)
