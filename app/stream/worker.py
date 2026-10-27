import os
import time
import logging
import cv2
import threading
from datetime import datetime
from typing import Dict, List, Optional
from app.pipeline.recognizer import FaceRecognizerPipeline
from app.attendance.engine import AttendanceEngine
from app.storage.json_store import get_path, load_json, save_json

logging.basicConfig(level=logging.INFO)
logger = logging.getLogger("RTSPWorker")

SNAPSHOT_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data", "snapshots"))

class RTSPStreamWorker:
    def __init__(
        self,
        camera_id: str,
        camera_name: str,
        rtsp_url: str,
        pipeline: FaceRecognizerPipeline,
        attendance_engine: AttendanceEngine,
        process_interval_ms: int = 1000,
        event_callback = None
    ):
        self.camera_id = camera_id
        self.camera_name = camera_name
        self.rtsp_url = rtsp_url
        self.pipeline = pipeline
        self.attendance_engine = attendance_engine
        self.process_interval_sec = process_interval_ms / 1000.0
        self.event_callback = event_callback
        self.running = False
        self.is_connected = False
        self._thread = None

    def start(self):
        if self.running:
            return
        self.running = True
        self._thread = threading.Thread(target=self._run_loop, daemon=True)
        self._thread.start()
        logger.info(f"Stream worker started for camera {self.camera_id} ({self.camera_name})")

    def stop(self):
        self.running = False
        self.is_connected = False
        if self._thread:
            self._thread.join(timeout=2.0)
        logger.info(f"Stream worker stopped for camera {self.camera_id}")

    def _save_snapshot(self, frame, face_bbox, name: str) -> str:
        os.makedirs(SNAPSHOT_DIR, exist_ok=True)
        filename = f"snap_{int(time.time())}_{name}_{self.camera_id}.jpg"
        filepath = os.path.join(SNAPSHOT_DIR, filename)

        # Validate frame
        if frame is None or frame.size == 0:
            logger.warning(f"Invalid frame for snapshot {filename}, skipping save")
            return f"/snapshots/{filename}"

        # Draw bbox on snapshot for visual evidence
        try:
            h, w, _ = frame.shape
            snap = frame.copy()
            x1, y1, x2, y2 = [int(v) for v in face_bbox]
            color = (0, 255, 0) if name != "Unknown" else (0, 0, 255)
            cv2.rectangle(snap, (x1, y1), (x2, y2), color, 2)
            cv2.putText(snap, name, (x1, max(15, y1 - 8)), cv2.FONT_HERSHEY_SIMPLEX, 0.6, color, 2)
        except Exception as e:
            logger.warning(f"Failed to draw bbox on snapshot: {e}")
            snap = frame.copy()

        # Save with error handling
        success = cv2.imwrite(filepath, snap)
        if not success:
            logger.error(f"Failed to save snapshot {filepath}")
        
        return f"/snapshots/{filename}"

    def _run_loop(self):
        while self.running:
            cap = cv2.VideoCapture(self.rtsp_url)
            if not cap.isOpened():
                self.is_connected = False
                logger.warning(f"Unable to connect RTSP stream {self.rtsp_url}. Retrying in 5 seconds...")
                time.sleep(5)
                continue

            self.is_connected = True
            last_process_time = 0

            while self.running and cap.isOpened():
                ret, frame = cap.read()
                if not ret or frame is None:
                    self.is_connected = False
                    logger.warning("Stream disconnected or frame drop. Reconnecting in 3s...")
                    break

                now = time.time()
                if now - last_process_time >= self.process_interval_sec:
                    last_process_time = now
                    try:
                        results = self.pipeline.process(frame)
                        for r in results:
                            name = r["name"]
                            conf = r["confidence"]
                            bbox = r["bbox"]

                            # Save snapshot
                            snapshot_url = self._save_snapshot(frame, bbox, name)

                            # Dispatch to attendance engine
                            att_action = self.attendance_engine.process_event(
                                name=name,
                                confidence=conf,
                                camera_id=self.camera_id
                            )

                            # Notify manager of live event
                            if self.event_callback:
                                self.event_callback({
                                    "camera_id": self.camera_id,
                                    "camera_name": self.camera_name,
                                    "name": name,
                                    "confidence": conf,
                                    "snapshot_url": snapshot_url,
                                    "attendance": att_action,
                                    "timestamp": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                                })
                    except Exception as e:
                        logger.error(f"Error in recognition pipeline: {e}")

                time.sleep(0.01)

            cap.release()
            self.is_connected = False
            time.sleep(3)


class StreamManager:
    def __init__(self, pipeline: FaceRecognizerPipeline, attendance_engine: AttendanceEngine):
        self.pipeline = pipeline
        self.attendance_engine = attendance_engine
        self.workers: Dict[str, RTSPStreamWorker] = {}
        self.live_events: List[dict] = load_json("cctv_live_events.json", default=[])

    def record_event(self, event_data: dict):
        self.live_events.append(event_data)
        # Keep latest 60 events
        self.live_events = self.live_events[-60:]
        save_json("cctv_live_events.json", self.live_events)

    def start_camera(self, camera_id: str, camera_name: str, rtsp_url: str) -> dict:
        if camera_id in self.workers and self.workers[camera_id].running:
            return {"status": "already_running", "camera_id": camera_id}

        worker = RTSPStreamWorker(
            camera_id=camera_id,
            camera_name=camera_name,
            rtsp_url=rtsp_url,
            pipeline=self.pipeline,
            attendance_engine=self.attendance_engine,
            event_callback=self.record_event
        )
        worker.start()
        self.workers[camera_id] = worker
        return {"status": "started", "camera_id": camera_id}

    def stop_camera(self, camera_id: str) -> dict:
        if camera_id in self.workers:
            self.workers[camera_id].stop()
            del self.workers[camera_id]
            return {"status": "stopped", "camera_id": camera_id}
        return {"status": "not_running", "camera_id": camera_id}

    def get_status(self) -> List[dict]:
        status_list = []
        for cam_id, worker in self.workers.items():
            status_list.append({
                "camera_id": cam_id,
                "camera_name": worker.camera_name,
                "running": worker.running,
                "connected": worker.is_connected
            })
        return status_list

    def get_live_events(self) -> List[dict]:
        return list(reversed(self.live_events))
