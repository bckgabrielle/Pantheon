from collections import defaultdict, deque
from datetime import datetime, timedelta, timezone
from threading import Lock
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Request, status
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import func, select, text
from sqlalchemy.orm import Session
from uuid import uuid4

from .config import get_settings
from .database import Base, engine, get_db
from .models import ActionLog, Application, Device, Job, Reminder, Snapshot, Tab, TabObservation, TabSession, User, UserProfile
from .schemas import ActionInput, ApplicationInput, JobInput, ReminderInput, SnapshotInput, UserInput, UserProfileInput

app = FastAPI(title="Pantheon Career Memory API", version="0.1.0")
app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_credentials=False,
    allow_methods=["GET", "POST", "PUT", "PATCH", "OPTIONS"],
    allow_headers=["Content-Type", "X-API-Key"],
)
request_windows: dict[str, deque[datetime]] = defaultdict(deque)
request_windows_lock = Lock()


@app.middleware("http")
async def rate_limit(request: Request, call_next):
    """MVP in-memory limiter. Replace with Redis/API-gateway limiting when deployed."""
    client = request.client.host if request.client else "unknown"
    now = datetime.now(timezone.utc)
    cutoff = now - timedelta(minutes=1)
    with request_windows_lock:
        window = request_windows[client]
        while window and window[0] < cutoff:
            window.popleft()
        if len(window) >= get_settings().rate_limit_per_minute:
            return JSONResponse(status_code=429, content={"detail": "Rate limit exceeded. Try again shortly."})
        window.append(now)
    return await call_next(request)


@app.on_event("startup")
def create_tables() -> None:
    Base.metadata.create_all(bind=engine)
    # `create_all` creates new tables but deliberately does not alter existing ones.
    # This keeps the hackathon MVP database compatible with the new generic tab reminders.
    with engine.begin() as connection:
        if engine.dialect.name == "postgresql":
            connection.execute(text("ALTER TABLE reminders ADD COLUMN IF NOT EXISTS tab_id INTEGER REFERENCES tabs(id) ON DELETE SET NULL"))
            connection.execute(text("ALTER TABLE reminders ADD COLUMN IF NOT EXISTS kind VARCHAR(32) NOT NULL DEFAULT 'tab_return'"))
        elif engine.dialect.name == "sqlite":
            columns = {row[1] for row in connection.execute(text("PRAGMA table_info(reminders)"))}
            if "tab_id" not in columns:
                connection.execute(text("ALTER TABLE reminders ADD COLUMN tab_id INTEGER"))
            if "kind" not in columns:
                connection.execute(text("ALTER TABLE reminders ADD COLUMN kind VARCHAR(32) NOT NULL DEFAULT 'tab_return'"))


def require_api_key(x_api_key: str | None = Header(default=None)) -> None:
    settings = get_settings()
    if settings.allow_insecure_localhost:
        return
    if not settings.api_key or x_api_key != settings.api_key:
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid API key")


def normalize_url(url: str) -> str:
    """Drops fragments and tracking parameters so duplicate detection is reliable."""
    parsed = urlsplit(url)
    query = [(k, v) for k, v in parse_qsl(parsed.query, keep_blank_values=True)
             if not k.lower().startswith(("utm_", "ref", "source", "trk"))]
    path = parsed.path.rstrip("/") or "/"
    return urlunsplit((parsed.scheme.lower(), parsed.netloc.lower(), path, urlencode(sorted(query)), ""))


def tab_payload(tab: Tab, device_name: str, duplicate: bool) -> dict:
    now = datetime.now(timezone.utc)
    first_seen = tab.first_seen_at.replace(tzinfo=timezone.utc) if tab.first_seen_at.tzinfo is None else tab.first_seen_at
    return {"id": tab.id, "external_tab_id": tab.external_tab_id, "title": tab.title,
            "url": tab.url, "normalized_url": tab.normalized_url, "device_name": device_name,
            "active": tab.active, "is_open": tab.is_open, "first_seen_at": tab.first_seen_at,
            "last_seen_at": tab.last_seen_at, "last_accessed_at": tab.last_accessed_at,
            "days_open": max(0, (now - first_seen).days), "likely_duplicate": duplicate,
            "career": tab.career_data}


@app.get("/health")
def health() -> dict:
    return {"status": "ok"}


@app.get("/")
def root() -> dict:
    return {"service": "Pantheon Career Memory API", "docs": "/docs", "health": "/health"}


@app.post("/snapshots", dependencies=[Depends(require_api_key)], status_code=status.HTTP_201_CREATED)
def ingest_snapshot(snapshot: SnapshotInput, db: Session = Depends(get_db)) -> dict:
    user_id = snapshot.user_id
    if user_id != "default" and not db.get(User, user_id):
        raise HTTPException(status_code=404, detail="User not found")
    device = db.scalar(select(Device).where(Device.user_id == user_id, Device.external_id == snapshot.device_id))
    if not device:
        device = Device(user_id=user_id, external_id=snapshot.device_id, name=snapshot.device_name)
        db.add(device)
        db.flush()
    else:
        device.name, device.last_seen_at = snapshot.device_name, snapshot.captured_at
    record = Snapshot(user_id=user_id, device_id=device.id, captured_at=snapshot.captured_at,
                      tab_count=len(snapshot.tabs), source=snapshot.source)
    db.add(record)
    db.flush()
    db.add(TabSession(user_id=user_id, device_id=device.id, snapshot_id=record.id,
                      captured_at=snapshot.captured_at, tab_count=len(snapshot.tabs)))
    received_ids = {str(item.tab_id) for item in snapshot.tabs}
    existing = {tab.external_tab_id: tab for tab in db.scalars(select(Tab).where(Tab.device_id == device.id)).all()}
    for item in snapshot.tabs:
        external_id = str(item.tab_id)
        tab = existing.get(external_id)
        values = dict(title=item.title, url=item.url, normalized_url=normalize_url(item.url), favicon=item.favicon,
                      window_id=str(item.window_id) if item.window_id is not None else None, active=item.active,
                      is_open=True, last_seen_at=snapshot.captured_at, last_accessed_at=item.last_accessed,
                      last_snapshot_id=record.id)
        # A normal capture should never erase existing enrichment.
        if item.career is not None:
            values["career_data"] = item.career.model_dump(mode="json")
        if not tab:
            tab = Tab(user_id=user_id, device_id=device.id, external_tab_id=external_id,
                      first_seen_at=snapshot.captured_at, **values)
            db.add(tab)
            db.flush()
        else:
            for key, value in values.items():
                setattr(tab, key, value)
        db.add(TabObservation(tab_id=tab.id, snapshot_id=record.id, observed_at=snapshot.captured_at,
                              title=item.title, url=item.url, active=item.active))
    for external_id, tab in existing.items():
        if external_id not in received_ids:
            tab.is_open = False
            tab.last_seen_at = snapshot.captured_at
    db.commit()
    return {"snapshot_id": record.id, "device_id": device.id, "tabs_upserted": len(snapshot.tabs)}


def current_tabs(db: Session, user_id: str = "default", include_closed: bool = False) -> list[dict]:
    rows = db.execute(select(Tab, Device.name).join(Device, Tab.device_id == Device.id)
                      .where(Tab.user_id == user_id, Tab.is_open.is_(True) if not include_closed else True)
                      .order_by(Tab.last_seen_at.desc())).all()
    counts = dict(db.execute(select(Tab.normalized_url, func.count(Tab.id)).where(Tab.user_id == user_id, Tab.is_open.is_(True)).group_by(Tab.normalized_url)).all())
    return [tab_payload(tab, name, counts.get(tab.normalized_url, 0) > 1) for tab, name in rows]


@app.get("/tabs/current", dependencies=[Depends(require_api_key)])
def get_current_tabs(user_id: str = "default", include_closed: bool = False, db: Session = Depends(get_db)) -> dict:
    tabs = current_tabs(db, user_id, include_closed)
    return {"tabs": tabs, "count": len(tabs)}


@app.get("/tabs/history", dependencies=[Depends(require_api_key)])
def get_tab_history(since: datetime = Query(...), user_id: str = "default", db: Session = Depends(get_db)) -> dict:
    observations = db.scalars(select(TabObservation).join(Tab).where(TabObservation.observed_at >= since, Tab.user_id == user_id)
                              .order_by(TabObservation.observed_at.desc())).all()
    return {"since": since, "observations": [{"tab_id": x.tab_id, "snapshot_id": x.snapshot_id,
            "observed_at": x.observed_at, "title": x.title, "url": x.url, "active": x.active} for x in observations]}


@app.get("/tabs/duplicates", dependencies=[Depends(require_api_key)])
def duplicates(user_id: str = "default", db: Session = Depends(get_db)) -> dict:
    tabs = current_tabs(db, user_id)
    groups: dict[str, list[dict]] = {}
    for tab in tabs:
        groups.setdefault(tab["normalized_url"], []).append(tab)
    result = [{"normalized_url": url, "tabs": group} for url, group in groups.items() if len(group) > 1]
    return {"duplicate_groups": result, "count": len(result)}


@app.post("/actions", dependencies=[Depends(require_api_key)], status_code=status.HTTP_201_CREATED)
def log_action(action: ActionInput, db: Session = Depends(get_db)) -> dict:
    if action.tab_id is not None:
        tab = db.get(Tab, action.tab_id)
        if not tab or tab.user_id != action.user_id:
            raise HTTPException(status_code=404, detail="Tab not found for this user")
    record = ActionLog(**action.model_dump())
    db.add(record)
    db.commit()
    db.refresh(record)
    return {"id": record.id, "created_at": record.created_at, "status": record.status}


@app.get("/actions", dependencies=[Depends(require_api_key)])
def list_actions(user_id: str = "default", limit: int = Query(default=100, ge=1, le=500), db: Session = Depends(get_db)) -> dict:
    records = db.scalars(select(ActionLog).where(ActionLog.user_id == user_id)
                         .order_by(ActionLog.created_at.desc()).limit(limit)).all()
    return {"actions": [{"id": item.id, "tab_id": item.tab_id, "action_type": item.action_type,
             "status": item.status, "proposed": item.proposed, "rationale": item.rationale,
             "payload": item.payload, "outcome": item.outcome, "created_at": item.created_at} for item in records]}


def require_user(db: Session, user_id: str) -> User:
    user = db.get(User, user_id)
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return user


@app.post("/users", dependencies=[Depends(require_api_key)], status_code=status.HTTP_201_CREATED)
def create_user(data: UserInput, db: Session = Depends(get_db)) -> dict:
    if db.scalar(select(User).where(User.email == str(data.email))):
        raise HTTPException(status_code=409, detail="A user with this email already exists")
    user = User(id=str(uuid4()), email=str(data.email), name=data.name)
    db.add(user)
    db.add(UserProfile(user_id=user.id))
    db.commit()
    return {"id": user.id, "email": user.email, "name": user.name, "created_at": user.created_at}


@app.put("/users/{user_id}/profile", dependencies=[Depends(require_api_key)])
def upsert_profile(user_id: str, data: UserProfileInput, db: Session = Depends(get_db)) -> dict:
    require_user(db, user_id)
    profile = db.get(UserProfile, user_id)
    if not profile:
        profile = UserProfile(user_id=user_id)
        db.add(profile)
    for field, value in data.model_dump().items():
        setattr(profile, field, value)
    db.commit()
    return {"user_id": user_id, **data.model_dump()}


@app.get("/users/{user_id}/profile", dependencies=[Depends(require_api_key)])
def get_profile(user_id: str, db: Session = Depends(get_db)) -> dict:
    require_user(db, user_id)
    profile = db.get(UserProfile, user_id)
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    return {"user_id": profile.user_id, "headline": profile.headline, "location": profile.location,
            "skills": profile.skills, "resume_url": profile.resume_url, "preferences": profile.preferences,
            "updated_at": profile.updated_at}


@app.post("/jobs", dependencies=[Depends(require_api_key)], status_code=status.HTTP_201_CREATED)
def create_job(data: JobInput, db: Session = Depends(get_db)) -> dict:
    require_user(db, data.user_id)
    if data.source_tab_id is not None and not db.get(Tab, data.source_tab_id):
        raise HTTPException(status_code=404, detail="Source tab not found")
    job = Job(**data.model_dump(), normalized_url=normalize_url(data.url))
    db.add(job)
    db.commit()
    db.refresh(job)
    return job_response(job)


def job_response(job: Job) -> dict:
    return {"id": job.id, "user_id": job.user_id, "source_tab_id": job.source_tab_id, "company": job.company,
            "title": job.title, "location": job.location, "url": job.url, "skills": job.skills,
            "deadline": job.deadline, "match_score": job.match_score, "recommendation": job.recommendation,
            "status": job.status, "created_at": job.created_at}


@app.get("/jobs/{user_id}", dependencies=[Depends(require_api_key)])
def list_jobs(user_id: str, db: Session = Depends(get_db)) -> dict:
    require_user(db, user_id)
    jobs = db.scalars(select(Job).where(Job.user_id == user_id).order_by(Job.match_score.desc().nullslast(), Job.created_at.desc())).all()
    return {"jobs": [job_response(job) for job in jobs], "count": len(jobs)}


@app.post("/applications", dependencies=[Depends(require_api_key)], status_code=status.HTTP_201_CREATED)
def create_application(data: ApplicationInput, db: Session = Depends(get_db)) -> dict:
    require_user(db, data.user_id)
    job = db.get(Job, data.job_id)
    if not job or job.user_id != data.user_id:
        raise HTTPException(status_code=404, detail="Job not found for this user")
    if db.scalar(select(Application).where(Application.user_id == data.user_id, Application.job_id == data.job_id)):
        raise HTTPException(status_code=409, detail="An application already exists for this job")
    application = Application(**data.model_dump())
    db.add(application)
    db.commit()
    db.refresh(application)
    return application_response(application)


def application_response(application: Application) -> dict:
    return {"id": application.id, "user_id": application.user_id, "job_id": application.job_id,
            "status": application.status, "cv_url": application.cv_url, "answers": application.answers,
            "submitted_at": application.submitted_at, "created_at": application.created_at}


@app.get("/applications/{user_id}", dependencies=[Depends(require_api_key)])
def list_applications(user_id: str, db: Session = Depends(get_db)) -> dict:
    require_user(db, user_id)
    items = db.scalars(select(Application).where(Application.user_id == user_id).order_by(Application.created_at.desc())).all()
    return {"applications": [application_response(item) for item in items], "count": len(items)}


@app.post("/reminders", dependencies=[Depends(require_api_key)], status_code=status.HTTP_201_CREATED)
def create_reminder(data: ReminderInput, db: Session = Depends(get_db)) -> dict:
    require_user(db, data.user_id)
    if data.job_id is not None:
        job = db.get(Job, data.job_id)
        if not job or job.user_id != data.user_id:
            raise HTTPException(status_code=404, detail="Job not found for this user")
    if data.tab_id is not None:
        tab = db.get(Tab, data.tab_id)
        if not tab or tab.user_id != data.user_id:
            raise HTTPException(status_code=404, detail="Tab not found for this user")
    reminder = Reminder(**data.model_dump())
    db.add(reminder)
    db.commit()
    db.refresh(reminder)
    return reminder_response(reminder)


def reminder_response(reminder: Reminder) -> dict:
    return {"id": reminder.id, "user_id": reminder.user_id, "job_id": reminder.job_id, "tab_id": reminder.tab_id,
            "kind": reminder.kind,
            "message": reminder.message, "remind_at": reminder.remind_at, "status": reminder.status,
            "created_at": reminder.created_at}


@app.get("/reminders/{user_id}", dependencies=[Depends(require_api_key)])
def list_reminders(user_id: str, db: Session = Depends(get_db)) -> dict:
    require_user(db, user_id)
    reminders = db.scalars(select(Reminder).where(Reminder.user_id == user_id).order_by(Reminder.remind_at)).all()
    return {"reminders": [reminder_response(item) for item in reminders], "count": len(reminders)}


@app.get("/dashboard/{user_id}", dependencies=[Depends(require_api_key)])
def dashboard(user_id: str, db: Session = Depends(get_db)) -> dict:
    require_user(db, user_id)
    return {
        "user_id": user_id,
        "jobs": db.scalar(select(func.count(Job.id)).where(Job.user_id == user_id)),
        "applications": db.scalar(select(func.count(Application.id)).where(Application.user_id == user_id)),
        "ready_for_review": db.scalar(select(func.count(Application.id)).where(Application.user_id == user_id, Application.status == "ready_for_review")),
        "pending_reminders": db.scalar(select(func.count(Reminder.id)).where(Reminder.user_id == user_id, Reminder.status == "pending")),
        "strong_matches": db.scalar(select(func.count(Job.id)).where(Job.user_id == user_id, Job.match_score >= 75)),
    }
