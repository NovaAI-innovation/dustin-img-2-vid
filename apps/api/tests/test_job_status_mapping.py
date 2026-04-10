from app.models import JobStatus
from app.services.jobs import map_provider_status


def test_map_provider_status_values() -> None:
    assert map_provider_status(1) == JobStatus.succeeded
    assert map_provider_status(5) == JobStatus.running
    assert map_provider_status(7) == JobStatus.moderated
    assert map_provider_status(8) == JobStatus.failed
    assert map_provider_status(0) == JobStatus.queued
