import os
os.environ["DATABASE_URL"] = "sqlite:///./test_pantheon.db"
os.environ["ALLOW_INSECURE_LOCALHOST"] = "true"

from fastapi.testclient import TestClient
from app.main import app


def test_snapshot_current_and_duplicates():
    with TestClient(app) as client:
        snapshot = {"device_id": "test-device", "device_name": "Test Mac", "captured_at": "2026-09-12T09:00:00Z", "tabs": [
            {"tab_id": 1, "title": "Tana", "url": "https://jobs.example.com/tana?utm_source=x", "active": True},
            {"tab_id": 2, "title": "Tana again", "url": "https://jobs.example.com/tana", "active": False}
        ]}
        assert client.post("/snapshots", json=snapshot).status_code == 201
        current = client.get("/tabs/current").json()
        assert current["count"] == 2
        assert current["tabs"][0]["likely_duplicate"] is True
        assert client.get("/tabs/duplicates").json()["count"] == 1
