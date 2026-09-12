from datetime import datetime
from typing import Any

from pydantic import BaseModel, ConfigDict, EmailStr, Field


class CareerData(BaseModel):
    company: str | None = None
    role: str | None = None
    location: str | None = None
    deadline: datetime | None = None
    skills: list[str] = Field(default_factory=list)
    status: str = "NOT_APPLIED"
    match_score: float | None = Field(default=None, ge=0, le=100)


class TabInput(BaseModel):
    tab_id: str | int
    title: str
    url: str
    favicon: str | None = None
    window_id: str | int | None = None
    active: bool = False
    last_accessed: datetime | None = None
    career: CareerData | None = None


class SnapshotInput(BaseModel):
    user_id: str = Field(default="default", min_length=1, max_length=36)
    device_id: str
    device_name: str = "This device"
    captured_at: datetime
    source: str = "extension"
    tabs: list[TabInput] = Field(max_length=500)


class ActionInput(BaseModel):
    user_id: str = Field(default="default", min_length=1, max_length=36)
    tab_id: int | None = None
    action_type: str
    status: str = "proposed"
    proposed: bool = True
    rationale: str | None = None
    payload: dict[str, Any] | None = None
    outcome: dict[str, Any] | None = None


class UserInput(BaseModel):
    email: EmailStr
    name: str | None = Field(default=None, max_length=255)


class UserProfileInput(BaseModel):
    headline: str | None = Field(default=None, max_length=500)
    location: str | None = Field(default=None, max_length=255)
    skills: list[str] = Field(default_factory=list, max_length=100)
    resume_url: str | None = None
    preferences: dict[str, Any] = Field(default_factory=dict)


class JobInput(BaseModel):
    user_id: str = Field(min_length=1, max_length=36)
    source_tab_id: int | None = None
    company: str = Field(min_length=1, max_length=255)
    title: str = Field(min_length=1, max_length=500)
    location: str | None = Field(default=None, max_length=255)
    url: str = Field(min_length=1, max_length=4000)
    description: str | None = None
    skills: list[str] = Field(default_factory=list, max_length=100)
    deadline: datetime | None = None
    # Supplied by an enrichment service; the API validates and persists it.
    match_score: float | None = Field(default=None, ge=0, le=100)
    recommendation: str | None = None
    status: str = Field(default="saved", max_length=32)


class ApplicationInput(BaseModel):
    user_id: str = Field(min_length=1, max_length=36)
    job_id: int
    status: str = Field(default="draft", max_length=32)
    cv_url: str | None = None
    answers: dict[str, Any] = Field(default_factory=dict)
    submitted_at: datetime | None = None


class ReminderInput(BaseModel):
    user_id: str = Field(min_length=1, max_length=36)
    job_id: int | None = None
    tab_id: int | None = None
    kind: str = Field(default="tab_return", max_length=32)
    message: str = Field(min_length=1, max_length=2000)
    remind_at: datetime


class TabOutput(BaseModel):
    model_config = ConfigDict(from_attributes=True)
    id: int
    external_tab_id: str
    title: str
    url: str
    normalized_url: str
    device_name: str
    active: bool
    is_open: bool
    first_seen_at: datetime
    last_seen_at: datetime
    last_accessed_at: datetime | None
    days_open: int
    likely_duplicate: bool
    career: dict[str, Any] | None
