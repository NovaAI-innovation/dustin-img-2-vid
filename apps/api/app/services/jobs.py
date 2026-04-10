import sqlite3
import uuid
from dataclasses import dataclass, field
from datetime import datetime, timezone
from pathlib import Path
from threading import RLock

from app.models import JobStatus


def map_provider_status(provider_status: int) -> JobStatus:
    if provider_status == 1:
        return JobStatus.succeeded
    if provider_status == 5:
        return JobStatus.running
    if provider_status == 7:
        return JobStatus.moderated
    if provider_status == 8:
        return JobStatus.failed
    return JobStatus.queued


@dataclass
class JobRecord:
    job_id: str
    provider_video_id: int
    status: JobStatus = JobStatus.queued
    provider_status: int | None = None
    video_url: str | None = None
    fail_reason: str | None = None
    created_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))
    updated_at: datetime = field(default_factory=lambda: datetime.now(timezone.utc))


class JobStore:
    def __init__(self, db_path: str | Path = "data/jobs.sqlite3") -> None:
        self._lock = RLock()
        self._db_path = Path(db_path)
        if not self._db_path.is_absolute():
            self._db_path = Path.cwd() / self._db_path
        self._db_path.parent.mkdir(parents=True, exist_ok=True)
        self._init_db()

    def _connect(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self._db_path)
        conn.row_factory = sqlite3.Row
        return conn

    def _init_db(self) -> None:
        with self._connect() as conn:
            conn.execute(
                """
                CREATE TABLE IF NOT EXISTS jobs (
                    job_id TEXT PRIMARY KEY,
                    provider_video_id INTEGER NOT NULL UNIQUE,
                    status TEXT NOT NULL,
                    provider_status INTEGER,
                    video_url TEXT,
                    fail_reason TEXT,
                    created_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )
                """
            )
            conn.commit()

    @staticmethod
    def _from_row(row: sqlite3.Row) -> JobRecord:
        return JobRecord(
            job_id=row["job_id"],
            provider_video_id=int(row["provider_video_id"]),
            status=JobStatus(row["status"]),
            provider_status=row["provider_status"],
            video_url=row["video_url"],
            fail_reason=row["fail_reason"],
            created_at=datetime.fromisoformat(row["created_at"]),
            updated_at=datetime.fromisoformat(row["updated_at"]),
        )

    def create(self, provider_video_id: int) -> JobRecord:
        with self._lock:
            job_id = str(uuid.uuid4())
            now = datetime.now(timezone.utc)
            record = JobRecord(
                job_id=job_id,
                provider_video_id=provider_video_id,
                status=JobStatus.queued,
                created_at=now,
                updated_at=now,
            )
            with self._connect() as conn:
                conn.execute(
                    """
                    INSERT INTO jobs (job_id, provider_video_id, status, provider_status, video_url, fail_reason, created_at, updated_at)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?)
                    """,
                    (
                        record.job_id,
                        record.provider_video_id,
                        record.status.value,
                        record.provider_status,
                        record.video_url,
                        record.fail_reason,
                        record.created_at.isoformat(),
                        record.updated_at.isoformat(),
                    ),
                )
                conn.commit()
            return record

    def get(self, job_id: str) -> JobRecord | None:
        with self._lock:
            with self._connect() as conn:
                row = conn.execute("SELECT * FROM jobs WHERE job_id = ?", (job_id,)).fetchone()
                if row is None:
                    return None
                return self._from_row(row)

    def get_by_provider_id(self, provider_video_id: int) -> JobRecord | None:
        with self._lock:
            with self._connect() as conn:
                row = conn.execute("SELECT * FROM jobs WHERE provider_video_id = ?", (provider_video_id,)).fetchone()
                if row is None:
                    return None
                return self._from_row(row)

    def update_from_provider(
        self,
        job_id: str,
        provider_status: int,
        video_url: str | None = None,
        fail_reason: str | None = None,
    ) -> JobRecord | None:
        with self._lock:
            existing = self.get(job_id)
            if not existing:
                return None

            next_status = map_provider_status(provider_status)
            next_video_url = video_url or existing.video_url
            next_fail_reason = fail_reason or existing.fail_reason
            next_updated_at = datetime.now(timezone.utc)

            with self._connect() as conn:
                conn.execute(
                    """
                    UPDATE jobs
                    SET status = ?, provider_status = ?, video_url = ?, fail_reason = ?, updated_at = ?
                    WHERE job_id = ?
                    """,
                    (
                        next_status.value,
                        provider_status,
                        next_video_url,
                        next_fail_reason,
                        next_updated_at.isoformat(),
                        job_id,
                    ),
                )
                conn.commit()

            return JobRecord(
                job_id=existing.job_id,
                provider_video_id=existing.provider_video_id,
                status=next_status,
                provider_status=provider_status,
                video_url=next_video_url,
                fail_reason=next_fail_reason,
                created_at=existing.created_at,
                updated_at=next_updated_at,
            )

    def list_all(self) -> list[JobRecord]:
        with self._lock:
            with self._connect() as conn:
                rows = conn.execute("SELECT * FROM jobs ORDER BY created_at DESC").fetchall()
                return [self._from_row(row) for row in rows]
