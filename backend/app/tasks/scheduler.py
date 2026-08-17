"""APScheduler wiring (D2) — daily digest + penalty snapshot jobs at 08:00 EAT."""

from __future__ import annotations

import logging

from apscheduler.schedulers.background import BackgroundScheduler  # type: ignore
from apscheduler.triggers.cron import CronTrigger  # type: ignore

from app.core.config import settings
from app.tasks.daily_jobs import daily_digest_job, penalty_snapshot_job

logger = logging.getLogger(__name__)

_scheduler: BackgroundScheduler | None = None


def start_scheduler() -> None:
    """Start the background scheduler once per process (safe to call repeatedly)."""
    global _scheduler
    if _scheduler is not None and _scheduler.running:
        return
    scheduler = BackgroundScheduler(timezone=settings.DEFAULT_TIMEZONE)
    scheduler.add_job(
        daily_digest_job,
        CronTrigger(hour=8, minute=0),
        id="daily-digest",
        replace_existing=True,
        coalesce=True,
        misfire_grace_time=3600,
    )
    scheduler.add_job(
        penalty_snapshot_job,
        CronTrigger(hour=8, minute=5),
        id="penalty-snapshot",
        replace_existing=True,
        coalesce=True,
        misfire_grace_time=3600,
    )
    scheduler.start()
    _scheduler = scheduler
    logger.info("APScheduler started — daily digest 08:00, penalty snapshot 08:05 (Africa/Nairobi)")


def stop_scheduler() -> None:
    """Shut the scheduler down on app teardown."""
    global _scheduler
    if _scheduler is not None and _scheduler.running:
        _scheduler.shutdown(wait=False)
        _scheduler = None
