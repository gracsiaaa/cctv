import uuid
import cv2
from typing import List, Optional
from app.storage.json_store import load_json, save_json

class CameraManager:
    def __init__(self):
        pass

    def list_cameras(self) -> List[dict]:
        return load_json("cameras.json", default=[])

    def add_camera(self, name: str, rtsp_url: str, location: str, mode: str = "CHECK_IN") -> dict:
        cameras = self.list_cameras()
        new_cam = {
            "id": f"cam_{uuid.uuid4().hex[:8]}",
            "name": name,
            "rtsp_url": rtsp_url,
            "location": location,
            "mode": mode,  # CHECK_IN, CHECK_OUT, MONITOR
            "status": "OFFLINE",
            "last_checked": None
        }
        cameras.append(new_cam)
        save_json("cameras.json", cameras)
        return new_cam

    def update_camera(self, camera_id: str, data: dict) -> Optional[dict]:
        cameras = self.list_cameras()
        for cam in cameras:
            if cam["id"] == camera_id:
                cam.update(data)
                save_json("cameras.json", cameras)
                return cam
        return None

    def delete_camera(self, camera_id: str) -> bool:
        cameras = self.list_cameras()
        filtered = [c for c in cameras if c["id"] != camera_id]
        if len(filtered) != len(cameras):
            save_json("cameras.json", filtered)
            return True
        return False

    def test_connection(self, rtsp_url: str) -> dict:
        """
        Verify if RTSP stream is accessible.
        """
        if not rtsp_url:
            return {"status": "ERROR", "message": "RTSP URL empty"}

        try:
            # Short timeout via OpenCV CAP_PROP_OPEN_TIMEOUT_MSEC if available
            cap = cv2.VideoCapture(rtsp_url)
            if not cap.isOpened():
                return {"status": "OFFLINE", "message": "Gagal terhubung ke stream RTSP"}
            
            ret, frame = cap.read()
            cap.release()

            if ret and frame is not None:
                h, w, _ = frame.shape
                return {
                    "status": "ONLINE",
                    "resolution": f"{w}x{h}",
                    "message": "Koneksi RTSP berhasil terhubung"
                }
            else:
                return {"status": "OFFLINE", "message": "Stream terbuka namun tidak dapat membaca frame"}
        except Exception as e:
            return {"status": "ERROR", "message": str(e)}
