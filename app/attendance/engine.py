import uuid
from datetime import datetime, time as dtime, timedelta
from typing import Optional, List, Dict
from app.storage.json_store import load_json, save_json

DEFAULT_SHIFTS = [
    {
        "id": "shift_pagi",
        "name": "Shift Pagi (Utama)",
        "check_in": "08:00",
        "check_out": "17:00",
        "late_tolerance_minutes": 15
    },
    {
        "id": "shift_siang",
        "name": "Shift Siang",
        "check_in": "13:00",
        "check_out": "21:00",
        "late_tolerance_minutes": 15
    },
    {
        "id": "shift_malam",
        "name": "Shift Malam",
        "check_in": "21:00",
        "check_out": "06:00",
        "late_tolerance_minutes": 15
    }
]

DEFAULT_SCHEDULE = {
    "name": "Standard Shift",
    "check_in": "08:00",
    "check_out": "17:00",
    "late_tolerance_minutes": 15
}

class AttendanceEngine:
    def __init__(self, cooldown_seconds: int = 300):
        self.cooldown_seconds = cooldown_seconds
        # In-memory last seen map: { "username": timestamp_float }
        self._last_seen: Dict[str, float] = {}

    def get_schedule(self) -> dict:
        return load_json("schedules.json", default=DEFAULT_SCHEDULE)

    def update_schedule(self, new_sched: dict) -> dict:
        save_json("schedules.json", new_sched)
        return new_sched

    def get_settings(self) -> dict:
        default_settings = {
            "cooldown_seconds": self.cooldown_seconds,
            "recognition_threshold": 0.40,
            "detection_interval_ms": 1500
        }
        return load_json("settings.json", default=default_settings)

    def update_settings(self, new_settings: dict) -> dict:
        if "cooldown_seconds" in new_settings:
            self.cooldown_seconds = int(new_settings["cooldown_seconds"])
        save_json("settings.json", new_settings)
        return new_settings

    def _parse_time_str(self, t_str: str) -> dtime:
        parts = [int(p) for p in t_str.split(":")]
        return dtime(hour=parts[0], minute=parts[1])

    def process_event(self, name: str, confidence: float, camera_id: str = "webcam") -> dict:
        """
        Evaluate recognition event against attendance rules.
        Supports camera modes: AUTO (1 CCTV default), CHECK_IN, CHECK_OUT, MONITOR.
        """
        now = datetime.now()
        now_ts = now.timestamp()
        now_date = now.strftime("%Y-%m-%d")
        now_time_str = now.strftime("%H:%M:%S")

        # Resolve camera mode
        cameras = load_json("cameras.json", default=[])
        cam_info = next((c for c in cameras if c.get("id") == camera_id), None)
        mode = cam_info.get("mode", "AUTO") if cam_info else "AUTO"

        if name == "Unknown":
            # Log unknown event
            unknowns = load_json("unknown_faces.json", default=[])
            unknowns.append({
                "camera_id": camera_id,
                "confidence": confidence,
                "timestamp": now.isoformat()
            })
            save_json("unknown_faces.json", unknowns[-200:]) # keep latest 200
            self.add_notification(
                "UNKNOWN",
                "Wajah Tidak Dikenal Terdeteksi",
                f"Kamera {cam_info.get('name', camera_id)} mendeteksi orang tanpa identitas pada {now_time_str}"
            )
            return {"action": "UNKNOWN_LOGGED", "name": "Unknown", "status": "UNKNOWN"}

        # If camera mode is MONITOR, only log event without touching attendance
        if mode == "MONITOR":
            return {"action": "MONITOR_LOGGED", "name": name, "status": "MONITOR"}

        # Check cooldown
        last_time = self._last_seen.get(name, 0.0)
        if (now_ts - last_time) < self.cooldown_seconds:
            return {
                "action": "COOLDOWN_SKIPPED",
                "name": name,
                "remaining_seconds": int(self.cooldown_seconds - (now_ts - last_time))
            }

        self._last_seen[name] = now_ts

        # Load attendance records
        records = load_json("attendance.json", default=[])
        schedule = self.get_schedule()

        # Find existing record for user today
        existing = next((r for r in records if r.get("name") == name and r.get("date") == now_date), None)

        sched_in = self._parse_time_str(schedule.get("check_in", "08:00"))
        sched_out = self._parse_time_str(schedule.get("check_out", "17:00"))
        tolerance = int(schedule.get("late_tolerance_minutes", 15))

        event_entry = {
            "time": now_time_str,
            "confidence": confidence,
            "camera_id": camera_id
        }

        # Handle specific camera mode: CHECK_IN only
        if mode == "CHECK_IN" and existing and existing.get("check_in"):
            if "events" not in existing:
                existing["events"] = []
            existing["events"].append(event_entry)
            save_json("attendance.json", records)
            return {"action": "ALREADY_CHECKED_IN", "record": existing}

        if not existing:
            # First event today -> CHECK_IN
            cutoff_dt = datetime.combine(now.date(), sched_in) + timedelta(minutes=tolerance)
            status = "ON_TIME" if now <= cutoff_dt else "LATE"

            if status == "LATE":
                self.add_notification(
                    "LATE",
                    f"{name} Terlambat",
                    f"Presensi masuk pukul {now_time_str} melewati batas {sched_in.strftime('%H:%M')}"
                )

            new_record = {
                "id": f"{name}_{now_date}",
                "name": name,
                "date": now_date,
                "check_in": now_time_str,
                "check_out": None,
                "status": status,
                "confidence": confidence,
                "camera_id": camera_id,
                "events": [event_entry]
            }
            records.append(new_record)
            save_json("attendance.json", records)
            return {"action": "CHECKED_IN", "record": new_record, "success": True}
        else:
            # Already checked in - DO NOT auto check-out, only manual check-out allowed
            # Just log event without updating check_out
            if "events" not in existing:
                existing["events"] = []
            existing["events"].append(event_entry)
            save_json("attendance.json", records)
            return {
                "action": "ALREADY_CHECKED_IN", 
                "message": "Sudah check-in. Gunakan tombol manual untuk check-out.",
                "record": existing,
                "success": False
            }

    def get_user_status_today(self, name: str) -> dict:
        now_date = datetime.now().strftime("%Y-%m-%d")
        records = load_json("attendance.json", default=[])
        record = next((r for r in records if r.get("name") == name and r.get("date") == now_date), None)
        if not record:
            return {
                "name": name,
                "has_checked_in": False,
                "has_checked_out": False,
                "check_in": None,
                "check_out": None,
                "status": None
            }
        return {
            "name": name,
            "has_checked_in": bool(record.get("check_in")),
            "has_checked_out": bool(record.get("check_out")),
            "check_in": record.get("check_in"),
            "check_out": record.get("check_out"),
            "status": record.get("status")
        }

    def check_in_user(self, name: str, camera_id: str = "webcam", confidence: float = 1.0) -> dict:
        now = datetime.now()
        now_date = now.strftime("%Y-%m-%d")
        now_time_str = now.strftime("%H:%M:%S")

        records = load_json("attendance.json", default=[])
        existing = next((r for r in records if r.get("name") == name and r.get("date") == now_date), None)
        if existing and existing.get("check_in"):
            return {
                "success": False,
                "status": "already_checked_in",
                "message": f"{name} sudah presensi masuk pada {existing['check_in']}",
                "record": existing
            }

        schedule = self.get_schedule()
        sched_in = self._parse_time_str(schedule.get("check_in", "08:00"))
        tolerance = int(schedule.get("late_tolerance_minutes", 15))
        cutoff_dt = datetime.combine(now.date(), sched_in) + timedelta(minutes=tolerance)
        status = "ON_TIME" if now <= cutoff_dt else "LATE"

        event_entry = {"time": now_time_str, "confidence": confidence, "camera_id": camera_id}
        new_record = {
            "id": f"{name}_{now_date}",
            "name": name,
            "date": now_date,
            "check_in": now_time_str,
            "check_out": None,
            "status": status,
            "confidence": confidence,
            "camera_id": camera_id,
            "events": [event_entry]
        }
        records.append(new_record)
        save_json("attendance.json", records)
        self._last_seen[name] = now.timestamp()
        return {"status": "success", "action": "CHECKED_IN", "record": new_record}

    def check_out_user(self, name: str, camera_id: str = "webcam", confidence: float = 1.0) -> dict:
        now = datetime.now()
        now_date = now.strftime("%Y-%m-%d")
        now_time_str = now.strftime("%H:%M:%S")

        records = load_json("attendance.json", default=[])
        existing = next((r for r in records if r.get("name") == name and r.get("date") == now_date), None)
        
        schedule = self.get_schedule()
        sched_out = self._parse_time_str(schedule.get("check_out", "17:00"))
        event_entry = {"time": now_time_str, "confidence": confidence, "camera_id": camera_id}

        if not existing:
            existing = {
                "id": f"{name}_{now_date}",
                "name": name,
                "date": now_date,
                "check_in": None,
                "check_out": now_time_str,
                "status": "NORMAL",
                "confidence": confidence,
                "camera_id": camera_id,
                "events": [event_entry]
            }
            records.append(existing)
        else:
            existing["check_out"] = now_time_str
            if "events" not in existing:
                existing["events"] = []
            existing["events"].append(event_entry)

        current_dtime = now.time()
        has_check_in = existing.get("check_in") is not None
        if not has_check_in:
            existing["status"] = "NO_CHECK_IN_EARLY_LEAVE" if current_dtime < sched_out else "NO_CHECK_IN"
        else:
            base_status = "LATE" if "LATE" in existing.get("status", "") else "ON_TIME"
            if current_dtime < sched_out:
                existing["status"] = f"{base_status}_EARLY_LEAVE" if base_status == "LATE" else "EARLY_LEAVE"
            else:
                existing["status"] = base_status

        save_json("attendance.json", records)
        self._last_seen[name] = now.timestamp()
        return {"status": "success", "action": "CHECKED_OUT", "record": existing}

    def auto_close_missing_checkouts(self) -> dict:
        records = load_json("attendance.json", default=[])
        schedule = self.get_schedule()
        sched_out = self._parse_time_str(schedule.get("check_out", "17:00"))
        now = datetime.now()
        now_date = now.strftime("%Y-%m-%d")

        updated_count = 0
        for r in records:
            if r.get("check_in") and not r.get("check_out") and "NO_CHECKOUT" not in r.get("status", ""):
                is_past_day = r.get("date") < now_date
                is_late_today = (r.get("date") == now_date and now.time().hour >= (sched_out.hour + 3) % 24)
                if is_past_day or is_late_today:
                    r["status"] = f"{r.get('status', 'ON_TIME')}_NO_CHECKOUT"
                    updated_count += 1

        if updated_count > 0:
            save_json("attendance.json", records)
        return {"status": "success", "closed_count": updated_count}

    def get_attendance_list(self, date_str: Optional[str] = None) -> List[dict]:
        records = load_json("attendance.json", default=[])
        if date_str:
            records = [r for r in records if r.get("date") == date_str]
        return list(reversed(records))

    def get_stats(self, registered_users: List[str]) -> dict:
        today_date = datetime.now().strftime("%Y-%m-%d")
        records = [r for r in load_json("attendance.json", default=[]) if r.get("date") == today_date]
        
        present_users = set(r.get("name") for r in records)
        all_registered = set(registered_users)
        
        on_time_count = sum(1 for r in records if "ON_TIME" in r.get("status", ""))
        late_count = sum(1 for r in records if "LATE" in r.get("status", ""))
        absent_users = list(all_registered - present_users)

        return {
            "today_date": today_date,
            "total_registered": len(all_registered),
            "total_present_today": len(present_users),
            "on_time_today": on_time_count,
            "late_today": late_count,
            "absent_today": len(absent_users),
            "absent_users": absent_users
        }

    # ==========================
    # MULTI-SHIFT MANAGEMENT
    # ==========================
    def get_shifts(self) -> List[dict]:
        return load_json("shifts.json", default=DEFAULT_SHIFTS)

    def add_shift(self, name: str, check_in: str, check_out: str, late_tolerance_minutes: int = 15) -> dict:
        shifts = self.get_shifts()
        new_shift = {
            "id": f"shift_{uuid.uuid4().hex[:6]}",
            "name": name,
            "check_in": check_in,
            "check_out": check_out,
            "late_tolerance_minutes": late_tolerance_minutes
        }
        shifts.append(new_shift)
        save_json("shifts.json", shifts)
        self.log_audit("admin", "ADD_SHIFT", new_shift["id"], f"Menambah shift: {name}")
        return new_shift

    def update_shift(self, shift_id: str, data: dict) -> Optional[dict]:
        shifts = self.get_shifts()
        for s in shifts:
            if s["id"] == shift_id:
                s.update(data)
                save_json("shifts.json", shifts)
                self.log_audit("admin", "UPDATE_SHIFT", shift_id, f"Memperbarui shift {s.get('name')}")
                return s
        return None

    def delete_shift(self, shift_id: str) -> bool:
        shifts = self.get_shifts()
        filtered = [s for s in shifts if s["id"] != shift_id]
        if len(filtered) != len(shifts):
            save_json("shifts.json", filtered)
            self.log_audit("admin", "DELETE_SHIFT", shift_id, "Menghapus shift")
            return True
        return False

    # ==========================
    # EMPLOYEE METADATA
    # ==========================
    def get_employees(self) -> List[dict]:
        return load_json("employees.json", default=[])

    def get_employee(self, name: str) -> dict:
        employees = self.get_employees()
        emp = next((e for e in employees if e.get("name") == name), None)
        if not emp:
            return {
                "name": name,
                "employee_code": f"EMP-{abs(hash(name)) % 1000:03d}",
                "department": "Operasional",
                "position": "Staff",
                "shift_id": "shift_pagi"
            }
        return emp

    def save_employee(self, name: str, data: dict) -> dict:
        employees = self.get_employees()
        emp = next((e for e in employees if e.get("name") == name), None)
        if not emp:
            emp = {
                "id": f"emp_{uuid.uuid4().hex[:6]}",
                "name": name,
                "employee_code": data.get("employee_code", f"EMP-{abs(hash(name)) % 1000:03d}"),
                "department": data.get("department", "Operasional"),
                "position": data.get("position", "Staff"),
                "shift_id": data.get("shift_id", "shift_pagi"),
                "created_at": datetime.now().isoformat()
            }
            employees.append(emp)
        else:
            emp.update(data)
            emp["updated_at"] = datetime.now().isoformat()
        save_json("employees.json", employees)
        self.log_audit("admin", "SAVE_EMPLOYEE", name, f"Menyimpan metadata karyawan {name}")
        return emp

    def delete_employee(self, name: str):
        employees = self.get_employees()
        filtered = [e for e in employees if e.get("name") != name]
        save_json("employees.json", filtered)

    # ==========================
    # MANUAL ATTENDANCE OVERRIDE
    # ==========================
    def override_attendance_status(
        self, record_id: str, new_status: str, reason: str, actor: str = "admin"
    ) -> Optional[dict]:
        records = load_json("attendance.json", default=[])
        record = next((r for r in records if r.get("id") == record_id), None)
        if not record:
            return None

        old_status = record.get("status", "UNKNOWN")
        record["status"] = new_status
        record["override"] = {
            "old_status": old_status,
            "new_status": new_status,
            "reason": reason,
            "overridden_by": actor,
            "overridden_at": datetime.now().isoformat()
        }

        save_json("attendance.json", records)
        self.log_audit(
            actor=actor,
            action="OVERRIDE_STATUS",
            target=record.get("name", record_id),
            details=f"Koreksi status {old_status} -> {new_status}. Alasan: {reason}"
        )
        return record

    # ==========================
    # AUDIT LOGGING
    # ==========================
    def log_audit(self, actor: str, action: str, target: str, details: str):
        logs = load_json("audit_logs.json", default=[])
        logs.append({
            "id": f"aud_{uuid.uuid4().hex[:8]}",
            "actor": actor,
            "action": action,
            "target": target,
            "details": details,
            "timestamp": datetime.now().isoformat()
        })
        save_json("audit_logs.json", logs[-500:])  # keep latest 500

    def get_audit_logs(self, limit: int = 100) -> List[dict]:
        logs = load_json("audit_logs.json", default=[])
        return list(reversed(logs))[:limit]

    # ==========================
    # NOTIFICATIONS
    # ==========================
    def add_notification(self, notif_type: str, title: str, message: str):
        notifs = load_json("notifications.json", default=[])
        notifs.append({
            "id": f"notif_{uuid.uuid4().hex[:8]}",
            "type": notif_type,
            "title": title,
            "message": message,
            "is_read": False,
            "timestamp": datetime.now().isoformat()
        })
        save_json("notifications.json", notifs[-100:])  # keep latest 100

    def get_notifications(self, unread_only: bool = False) -> List[dict]:
        notifs = load_json("notifications.json", default=[])
        if unread_only:
            notifs = [n for n in notifs if not n.get("is_read", False)]
        return list(reversed(notifs))

    def mark_notification_read(self, notif_id: str):
        notifs = load_json("notifications.json", default=[])
        for n in notifs:
            if n.get("id") == notif_id:
                n["is_read"] = True
                break
        save_json("notifications.json", notifs)

    def mark_all_notifications_read(self):
        notifs = load_json("notifications.json", default=[])
        for n in notifs:
            n["is_read"] = True
        save_json("notifications.json", notifs)

    # ==========================
    # CSV REPORT EXPORT
    # ==========================
    def export_attendance_csv(self, date_str: Optional[str] = None) -> str:
        records = self.get_attendance_list(date_str)
        lines = ["No,Nama Karyawan,Tanggal,Jam Masuk,Jam Pulang,Status,Akurasi,Kamera,Koreksi Manual"]
        for idx, r in enumerate(records, 1):
            override_info = ""
            if "override" in r:
                ov = r["override"]
                override_info = f"{ov.get('old_status')} -> {ov.get('new_status')} ({ov.get('reason')})"

            lines.append(
                f'{idx},"{r.get("name","")}","{r.get("date","")}","{r.get("check_in","") or "-"}","{r.get("check_out","") or "-"}","{r.get("status","")}","{int(r.get("confidence",0)*100)}%","{r.get("camera_id","")}","{override_info}"'
            )
        return "\n".join(lines)
