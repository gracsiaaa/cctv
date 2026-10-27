import pytest
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)

def test_status():
    response = client.get("/api/status")
    assert response.status_code == 200
    assert response.json()["status"] == "ok"

def test_register_face():
    # Gunakan person2.jpg (Lena - 1 wajah) untuk register
    with open("test_images/person2.jpg", "rb") as f:
        response = client.post(
            "/api/register-face",
            data={"name": "Lena"},
            files={"file": ("person2.jpg", f, "image/jpeg")}
        )
    assert response.status_code == 200, response.json()
    assert response.json()["status"] == "success"

def test_recognize_known():
    with open("test_images/person2.jpg", "rb") as f:
        response = client.post(
            "/api/recognize",
            files={"file": ("person2.jpg", f, "image/jpeg")}
        )
    assert response.status_code == 200
    data = response.json()
    assert "faces" in data
    assert len(data["faces"]) > 0
    assert data["faces"][0]["name"] == "Lena"

def test_recognize_unknown():
    # Use person1_a.jpg (t1.jpg with 4 faces) to test unknown recognition
    with open("test_images/person1_a.jpg", "rb") as f:
        response = client.post(
            "/api/recognize",
            files={"file": ("person1_a.jpg", f, "image/jpeg")}
        )
    assert response.status_code == 200
    data = response.json()
    assert len(data["faces"]) > 0
    assert data["faces"][0]["name"] == "Unknown"
    
def test_invalid_image():
    # Test upload file bukan gambar
    response = client.post(
        "/api/recognize",
        files={"file": ("dummy.txt", b"not an image", "text/plain")}
    )
    assert response.status_code == 400

def test_registered_faces_and_delete():
    # List registered faces (should contain Lena from test_register_face)
    res = client.get("/api/registered-faces")
    assert res.status_code == 200
    names = [f["name"] for f in res.json()["faces"]]
    assert "Lena" in names

    # Delete Lena
    del_res = client.delete("/api/delete-face/Lena")
    assert del_res.status_code == 200
    assert del_res.json()["status"] == "success"

    # Verify deleted
    res_after = client.get("/api/registered-faces")
    names_after = [f["name"] for f in res_after.json()["faces"]]
    assert "Lena" not in names_after

def test_attendance_log():
    res = client.get("/api/attendance-log")
    assert res.status_code == 200
    assert "logs" in res.json()

def test_cameras_crud():
    # Create camera
    cam_data = {
        "name": "Front Gate",
        "rtsp_url": "rtsp://fake:554/stream1",
        "location": "Lobby",
        "mode": "CHECK_IN"
    }
    create_res = client.post("/api/cameras", json=cam_data)
    assert create_res.status_code == 200
    cam_id = create_res.json()["camera"]["id"]

    # List cameras
    list_res = client.get("/api/cameras")
    assert list_res.status_code == 200
    assert any(c["id"] == cam_id for c in list_res.json()["cameras"])

    # Delete camera
    del_res = client.delete(f"/api/cameras/{cam_id}")
    assert del_res.status_code == 200

def test_stats_and_schedules():
    stats_res = client.get("/api/stats")
    assert stats_res.status_code == 200
    assert "today_date" in stats_res.json()

    sched_res = client.get("/api/schedules")
    assert sched_res.status_code == 200
    assert "check_in" in sched_res.json()

def test_admin_auth_flow():
    # Login failed
    bad_login = client.post("/api/auth/login", json={"username": "admin", "password": "wrongpassword"})
    assert bad_login.status_code == 401

    # Login success
    good_login = client.post("/api/auth/login", json={"username": "admin", "password": "admin123"})
    assert good_login.status_code == 200
    token = good_login.json()["data"]["token"]

    # Verify me
    me_res = client.get("/api/auth/me", headers={"Authorization": f"Bearer {token}"})
    assert me_res.status_code == 200
    assert me_res.json()["user"]["username"] == "admin"

    # Logout
    logout_res = client.post("/api/auth/logout", headers={"Authorization": f"Bearer {token}"})
    assert logout_res.status_code == 200

def test_employee_and_shift_and_override():
    # Update employee
    emp_res = client.put("/api/employees/Budi", json={
        "name": "Budi",
        "department": "IT Engineering",
        "position": "Senior AI Developer",
        "shift_id": "shift_pagi"
    })
    assert emp_res.status_code == 200
    assert emp_res.json()["employee"]["department"] == "IT Engineering"

    # List shifts
    shifts_res = client.get("/api/shifts")
    assert shifts_res.status_code == 200
    assert len(shifts_res.json()["shifts"]) >= 1

    # Create & delete shift
    new_s = client.post("/api/shifts", json={
        "name": "Shift Khusus",
        "check_in": "09:00",
        "check_out": "18:00",
        "late_tolerance_minutes": 10
    })
    assert new_s.status_code == 200
    shift_id = new_s.json()["shift"]["id"]

    del_s = client.delete(f"/api/shifts/{shift_id}")
    assert del_s.status_code == 200

    # CSV Export
    csv_res = client.get("/api/attendance/export")
    assert csv_res.status_code == 200
    assert "Nama Karyawan" in csv_res.text


