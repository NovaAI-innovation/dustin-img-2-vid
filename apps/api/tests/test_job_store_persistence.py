from app.services.jobs import JobStore


def test_job_store_persists_across_instances(tmp_path) -> None:
    db_path = tmp_path / "jobs.sqlite3"

    store1 = JobStore(db_path)
    created = store1.create(provider_video_id=123456)
    store1.update_from_provider(created.job_id, provider_status=1, video_url="https://example.com/v.mp4")

    store2 = JobStore(db_path)
    found = store2.get(created.job_id)

    assert found is not None
    assert found.provider_video_id == 123456
    assert found.video_url == "https://example.com/v.mp4"
    assert found.status.value == "succeeded"
