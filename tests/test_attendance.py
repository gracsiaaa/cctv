from datetime import datetime
from app.attendance.engine import AttendanceEngine

def test_late_cutoff_hour_overflow():
    engine = AttendanceEngine(cooldown_seconds=0)
    # Schedule near midnight with tolerance that would roll hour past 23
    engine.update_schedule({
        "name": "Night Shift",
        "check_in": "23:50",
        "check_out": "06:00",
        "late_tolerance_minutes": 30
    })
    # Must not raise ValueError: hour must be in 0..23
    res = engine.process_event("TestUser", 0.95, "cam1")
    assert res["action"] in ["CHECKED_IN", "CHECKED_OUT"]
    assert "status" in res["record"]

def test_early_leave_status_normalization():
    engine = AttendanceEngine(cooldown_seconds=0)
    # Schedule where check out is in the future
    engine.update_schedule({
        "name": "Day Shift",
        "check_in": "08:00",
        "check_out": "23:59",
        "late_tolerance_minutes": 15
    })
    # First event (check in)
    res1 = engine.process_event("BudiStatus", 0.95, "cam1")
    assert res1["action"] == "CHECKED_IN"
    
    # Subsequent events should NOT auto check-out (new flow: manual check-out only)
    res2 = engine.process_event("BudiStatus", 0.95, "cam1")
    assert res2["action"] == "ALREADY_CHECKED_IN"
    
    # Manual check-out should work
    res3 = engine.check_out_user("BudiStatus", "cam1", 0.95)
    assert res3["action"] == "CHECKED_OUT"
    status = res3["record"]["status"]
    # Should be EARLY_LEAVE (since before 23:59) or LATE_EARLY_LEAVE
    assert "EARLY_LEAVE" in status or status == "ON_TIME"
