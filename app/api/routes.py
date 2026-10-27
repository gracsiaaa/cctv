from fastapi import APIRouter, UploadFile, File, HTTPException, Form, Query, Header, Response
from starlette.concurrency import run_in_threadpool
from pydantic import BaseModel
import cv2
import numpy as np
import time
from typing import Optional, List
from app.pipeline.recognizer import FaceRecognizerPipeline
from app.recognition.embedder import FaceEmbedder
from app.storage.json_store import load_face_db, save_face_db
from app.attendance.engine import AttendanceEngine
from app.cameras.manager import CameraManager
from app.auth.security import auth_manager
from app.stream.worker import StreamManager

router = APIRouter()

# Single shared embedder and pipeline instance
embedder = FaceEmbedder()
face_db = load_face_db()
pipeline = FaceRecognizerPipeline(db_vectors=face_db, embedder=embedder)

attendance_engine = AttendanceEngine(cooldown_seconds=300)
camera_manager = CameraManager()
stream_manager = StreamManager(pipeline=pipeline, attendance_engine=attendance_engine)

# Apply saved settings to pipeline matcher
saved_settings = attendance_engine.get_settings()
if "recognition_threshold" in saved_settings:
    pipeline.matcher.threshold = float(saved_settings["recognition_threshold"])

async def read_image(file: UploadFile) -> np.ndarray:
    try:
        contents = await file.read()
        nparr = np.frombuffer(contents, np.uint8)
        img = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
        if img is None:
            raise HTTPException(status_code=400, detail="Format gambar tidak valid")
        return img
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Gagal membaca gambar: {str(e)}")

@router.get("/status")
def get_status():
    return {
        "status": "ok",
        "registered_people_count": len(face_db),
        "total_embeddings": sum(len(v) if isinstance(v, list) else 1 for v in face_db.values())
    }

@router.get("/stats")
def get_stats():
    return attendance_engine.get_stats(list(face_db.keys()))

@router.post("/register-face")
async def register_face(name: str = Form(...), file: UploadFile = File(...)):
    name = name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Nama tidak boleh kosong")

    img = await read_image(file)
    faces = await run_in_threadpool(embedder.extract, img)
    if len(faces) == 0:
        raise HTTPException(status_code=400, detail="Tidak ada wajah yang terdeteksi")
    if len(faces) > 1:
        raise HTTPException(status_code=400, detail="Terdeteksi lebih dari satu wajah. Gunakan foto dengan 1 wajah.")

    embedding = faces[0]["normed_embedding"]

    # Support multiple samples per user
    if name not in face_db:
        face_db[name] = [embedding]
    else:
        if not isinstance(face_db[name], list):
            face_db[name] = [face_db[name]]
        face_db[name].append(embedding)

    save_face_db(face_db)
    pipeline.update_db(face_db)

    return {
        "status": "success",
        "message": f"Wajah terdaftar untuk {name}",
        "name": name,
        "sample_count": len(face_db[name])
    }

@router.post("/register-face-from-cctv/{camera_id}")
async def register_face_from_cctv(camera_id: str, name: str = Form(...), num_samples: int = Form(10)):
    name = name.strip()
    if not name:
        raise HTTPException(status_code=400, detail="Nama tidak boleh kosong")
    
    cameras = camera_manager.list_cameras()
    cam = next((c for c in cameras if c["id"] == camera_id), None)
    if not cam:
        raise HTTPException(status_code=404, detail="Kamera tidak ditemukan")
    
    rtsp_url = cam["rtsp_url"]
    cap = cv2.VideoCapture(rtsp_url)
    
    if not cap.isOpened():
        raise HTTPException(status_code=500, detail="Tidak dapat terhubung ke stream CCTV")
    
    embeddings_collected = []
    attempts = 0
    max_attempts = num_samples * 5
    
    while len(embeddings_collected) < num_samples and attempts < max_attempts:
        ret, frame = cap.read()
        attempts += 1
        
        if not ret or frame is None:
            continue
        
        faces = await run_in_threadpool(embedder.extract, frame)
        
        if len(faces) == 1:
            embeddings_collected.append(faces[0]["normed_embedding"])
            time.sleep(0.3)
        elif len(faces) > 1:
            cap.release()
            raise HTTPException(status_code=400, detail=f"Terdeteksi lebih dari 1 wajah di frame. Pastikan hanya 1 orang di depan kamera.")
        
        time.sleep(0.1)
    
    cap.release()
    
    if len(embeddings_collected) == 0:
        raise HTTPException(status_code=400, detail="Tidak ada wajah terdeteksi dari stream CCTV. Cek posisi kamera dan pencahayaan.")
    
    if name not in face_db:
        face_db[name] = embeddings_collected
    else:
        if not isinstance(face_db[name], list):
            face_db[name] = [face_db[name]]
        face_db[name].extend(embeddings_collected)
    
    save_face_db(face_db)
    pipeline.update_db(face_db)
    
    return {
        "status": "success",
        "message": f"Berhasil merekam {len(embeddings_collected)} sampel wajah untuk {name} dari CCTV",
        "name": name,
        "samples_captured": len(embeddings_collected),
        "total_samples": len(face_db[name])
    }

@router.post("/recognize")
async def recognize(
    file: UploadFile = File(...), 
    camera_id: str = Form("webcam"),
    auto_record: bool = Form(False)
):
    img = await read_image(file)
    results = await run_in_threadpool(pipeline.process, img)

    processed_faces = []
    for res in results:
        bbox_clean = [float(x) for x in res["bbox"]]
        
        att_action = None
        if auto_record:
            att_action = attendance_engine.process_event(
                name=res["name"],
                confidence=res["confidence"],
                camera_id=camera_id
            )

        today_status = None
        if res["name"] != "Unknown":
            today_status = attendance_engine.get_user_status_today(res["name"])

        processed_faces.append({
            "name": res["name"],
            "confidence": res["confidence"],
            "bbox": bbox_clean,
            "timestamp": res["timestamp"],
            "attendance": att_action,
            "today_status": today_status
        })

    return {"faces": processed_faces}

class AttendanceActionPayload(BaseModel):
    name: str
    camera_id: str = "webcam"
    confidence: float = 1.0

@router.post("/attendance/check-in")
def manual_check_in(payload: AttendanceActionPayload):
    return attendance_engine.check_in_user(
        name=payload.name,
        camera_id=payload.camera_id,
        confidence=payload.confidence
    )

@router.post("/attendance/check-out")
def manual_check_out(payload: AttendanceActionPayload):
    return attendance_engine.check_out_user(
        name=payload.name,
        camera_id=payload.camera_id,
        confidence=payload.confidence
    )

@router.get("/registered-faces")
def get_registered_faces():
    data = []
    for name, embs in face_db.items():
        count = len(embs) if isinstance(embs, list) else 1
        data.append({"name": name, "embeddings_count": count})
    return {"faces": data}

@router.delete("/delete-face/{name}")
def delete_face(name: str):
    if name in face_db:
        del face_db[name]
        save_face_db(face_db)
        pipeline.update_db(face_db)
        return {"status": "success", "message": f"Wajah {name} berhasil dihapus"}
    raise HTTPException(status_code=404, detail="Wajah tidak ditemukan")

@router.get("/attendance")
def get_attendance(date: Optional[str] = Query(None)):
    records = attendance_engine.get_attendance_list(date_str=date)
    return {"records": records}

@router.get("/attendance/status/{name}")
def get_user_attendance_status(name: str):
    """Get today's attendance status for a specific user"""
    return attendance_engine.get_user_status_today(name)

@router.get("/attendance-log")
def get_attendance_log_legacy():
    # Legacy alias for backward compatibility
    records = attendance_engine.get_attendance_list()
    logs = []
    for r in records:
        logs.append({
            "name": r["name"],
            "confidence": r.get("confidence", 0.9),
            "timestamp": f"{r['date']}T{r.get('check_in', '00:00:00')}"
        })
    return {"logs": logs}

# Camera management endpoints
class CameraCreate(BaseModel):
    name: str
    rtsp_url: str
    location: str
    mode: str = "CHECK_IN"

class CameraUpdate(BaseModel):
    name: Optional[str] = None
    rtsp_url: Optional[str] = None
    location: Optional[str] = None
    mode: Optional[str] = None

@router.get("/cameras")
def list_cameras():
    return {"cameras": camera_manager.list_cameras()}

@router.post("/cameras")
def add_camera(payload: CameraCreate):
    cam = camera_manager.add_camera(
        name=payload.name,
        rtsp_url=payload.rtsp_url,
        location=payload.location,
        mode=payload.mode
    )
    return {"status": "success", "camera": cam}

@router.delete("/cameras/{camera_id}")
def delete_camera(camera_id: str):
    ok = camera_manager.delete_camera(camera_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Kamera tidak ditemukan")
    return {"status": "success", "message": "Kamera berhasil dihapus"}

@router.put("/cameras/{camera_id}")
def update_camera(camera_id: str, payload: CameraUpdate):
    data = {k: v for k, v in payload.model_dump().items() if v is not None}
    cam = camera_manager.update_camera(camera_id, data)
    if not cam:
        raise HTTPException(status_code=404, detail="Kamera tidak ditemukan")
    return {"status": "success", "camera": cam}

@router.post("/cameras/{camera_id}/test")
def test_camera_connection(camera_id: str):
    cameras = camera_manager.list_cameras()
    cam = next((c for c in cameras if c["id"] == camera_id), None)
    if not cam:
        raise HTTPException(status_code=404, detail="Kamera tidak ditemukan")
    res = camera_manager.test_connection(cam["rtsp_url"])
    camera_manager.update_camera(camera_id, {"status": res.get("status", "OFFLINE")})
    return res

# ==========================
# CCTV RTSP STREAM WORKER ENDPOINTS
# ==========================
@router.get("/stream/status")
def get_stream_status():
    return {"workers": stream_manager.get_status()}

@router.post("/stream/start/{camera_id}")
def start_camera_stream(camera_id: str):
    cameras = camera_manager.list_cameras()
    cam = next((c for c in cameras if c["id"] == camera_id), None)
    if not cam:
        raise HTTPException(status_code=404, detail="Kamera tidak ditemukan")
    res = stream_manager.start_camera(
        camera_id=cam["id"],
        camera_name=cam["name"],
        rtsp_url=cam["rtsp_url"]
    )
    return res

@router.post("/stream/stop/{camera_id}")
def stop_camera_stream(camera_id: str):
    return stream_manager.stop_camera(camera_id)

@router.get("/stream/events")
def get_stream_events():
    return {"events": stream_manager.get_live_events()}

@router.post("/attendance/auto-close")
def auto_close_attendance():
    return attendance_engine.auto_close_missing_checkouts()

# Schedules & Settings endpoints
class SchedulePayload(BaseModel):
    name: str = "Standard Shift"
    check_in: str = "08:00"
    check_out: str = "17:00"
    late_tolerance_minutes: int = 15

@router.get("/schedules")
def get_schedule():
    return attendance_engine.get_schedule()

@router.put("/schedules")
def update_schedule(payload: SchedulePayload):
    updated = attendance_engine.update_schedule(payload.model_dump())
    return {"status": "success", "schedule": updated}

@router.get("/settings")
def get_settings():
    return attendance_engine.get_settings()

@router.put("/settings")
def update_settings(payload: dict):
    updated = attendance_engine.update_settings(payload)
    if "recognition_threshold" in payload:
        pipeline.matcher.threshold = float(payload["recognition_threshold"])
    return {"status": "success", "settings": updated}

# ==========================
# AUTH ENDPOINTS (SINGLE ADMIN)
# ==========================
class LoginPayload(BaseModel):
    username: str
    password: str

class ChangePasswordPayload(BaseModel):
    old_password: str
    new_password: str

@router.post("/auth/login")
def login(payload: LoginPayload):
    user_info = auth_manager.login(payload.username, payload.password)
    if not user_info:
        raise HTTPException(status_code=401, detail="Username atau password salah")
    attendance_engine.log_audit(payload.username, "LOGIN", "system", "Admin berhasil masuk ke dashboard")
    return {"status": "success", "data": user_info}

@router.get("/auth/me")
def get_me(authorization: Optional[str] = Header(None)):
    if not authorization:
        raise HTTPException(status_code=401, detail="Token tidak ditemukan")
    token = authorization.replace("Bearer ", "").strip()
    if not auth_manager.verify_token(token):
        raise HTTPException(status_code=401, detail="Sesi login telah kedaluwarsa atau tidak valid")
    info = auth_manager.active_tokens.get(token, {"username": "admin", "role": "admin"})
    return {"status": "success", "user": info}

@router.post("/auth/logout")
def logout(authorization: Optional[str] = Header(None)):
    if authorization:
        token = authorization.replace("Bearer ", "").strip()
        auth_manager.logout(token)
    return {"status": "success", "message": "Logout berhasil"}

@router.post("/auth/change-password")
def change_password(payload: ChangePasswordPayload):
    ok = auth_manager.change_password(payload.old_password, payload.new_password)
    if not ok:
        raise HTTPException(status_code=400, detail="Password lama tidak sesuai")
    attendance_engine.log_audit("admin", "CHANGE_PASSWORD", "admin", "Admin memperbarui kata sandi")
    return {"status": "success", "message": "Password berhasil diperbarui"}

# ==========================
# EMPLOYEE METADATA ENDPOINTS
# ==========================
class EmployeePayload(BaseModel):
    name: str
    employee_code: Optional[str] = None
    department: Optional[str] = None
    position: Optional[str] = None
    shift_id: Optional[str] = None

@router.get("/employees")
def list_employees():
    employees = attendance_engine.get_employees()
    registered_names = list(face_db.keys())
    emp_map = {e["name"]: e for e in employees}
    result = []
    for name in registered_names:
        if name in emp_map:
            result.append(emp_map[name])
        else:
            profile = attendance_engine.get_employee(name)
            result.append(profile)
    return {"employees": result}

@router.get("/employees/{name}")
def get_employee(name: str):
    profile = attendance_engine.get_employee(name)
    return {"employee": profile}

@router.put("/employees/{name}")
def update_employee(name: str, payload: EmployeePayload):
    data = payload.model_dump(exclude_unset=True)
    updated = attendance_engine.save_employee(name, data)
    return {"status": "success", "employee": updated}

# ==========================
# STATUS OVERRIDE ENDPOINT
# ==========================
class StatusOverridePayload(BaseModel):
    new_status: str
    reason: str

@router.put("/attendance/{record_id}/override")
def override_status(
    record_id: str, 
    payload: StatusOverridePayload,
    authorization: Optional[str] = Header(None)
):
    if not authorization:
        raise HTTPException(status_code=401, detail="Hanya admin yang memiliki hak mengoreksi status presensi")
    token = authorization.replace("Bearer ", "").strip()
    if not auth_manager.verify_token(token):
        raise HTTPException(status_code=401, detail="Sesi admin telah kedaluwarsa atau tidak valid")
    actor = auth_manager.active_tokens.get(token, {}).get("username", "admin")

    updated = attendance_engine.override_attendance_status(
        record_id=record_id,
        new_status=payload.new_status,
        reason=payload.reason,
        actor=actor
    )
    if not updated:
        raise HTTPException(status_code=404, detail="Catatan presensi tidak ditemukan")
    return {"status": "success", "record": updated}

# ==========================
# MULTI-SHIFT ENDPOINTS
# ==========================
class ShiftCreatePayload(BaseModel):
    name: str
    check_in: str
    check_out: str
    late_tolerance_minutes: int = 15

@router.get("/shifts")
def list_shifts():
    return {"shifts": attendance_engine.get_shifts()}

@router.post("/shifts")
def create_shift(payload: ShiftCreatePayload):
    new_shift = attendance_engine.add_shift(
        name=payload.name,
        check_in=payload.check_in,
        check_out=payload.check_out,
        late_tolerance_minutes=payload.late_tolerance_minutes
    )
    return {"status": "success", "shift": new_shift}

@router.put("/shifts/{shift_id}")
def update_shift(shift_id: str, payload: dict):
    updated = attendance_engine.update_shift(shift_id, payload)
    if not updated:
        raise HTTPException(status_code=404, detail="Shift tidak ditemukan")
    return {"status": "success", "shift": updated}

@router.delete("/shifts/{shift_id}")
def delete_shift(shift_id: str):
    ok = attendance_engine.delete_shift(shift_id)
    if not ok:
        raise HTTPException(status_code=404, detail="Shift tidak ditemukan")
    return {"status": "success", "message": "Shift berhasil dihapus"}

# ==========================
# AUDIT LOGS & NOTIFICATIONS
# ==========================
@router.get("/audit-logs")
def list_audit_logs():
    return {"logs": attendance_engine.get_audit_logs(limit=150)}

@router.get("/notifications")
def list_notifications(unread_only: bool = Query(False)):
    return {"notifications": attendance_engine.get_notifications(unread_only=unread_only)}

@router.post("/notifications/{notif_id}/read")
def read_notification(notif_id: str):
    attendance_engine.mark_notification_read(notif_id)
    return {"status": "success"}

@router.post("/notifications/read-all")
def read_all_notifications():
    attendance_engine.mark_all_notifications_read()
    return {"status": "success"}

@router.get("/attendance/export")
def export_attendance_csv(date: Optional[str] = Query(None)):
    csv_data = attendance_engine.export_attendance_csv(date)
    filename = f"laporan_presensi_{date or 'semua'}.csv"
    return Response(
        content=csv_data,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'}
    )
