import cv2
import numpy as np
import pytest
from app.detection.detector import FaceDetector

@pytest.fixture(scope="module")
def detector():
    return FaceDetector()

def test_detect_blank_image(detector):
    blank_img = np.zeros((480, 640, 3), dtype=np.uint8)
    res = detector.detect(blank_img)
    assert res["face_count"] == 0
    assert len(res["bboxes"]) == 0

def test_detect_none_image(detector):
    res = detector.detect(None)
    assert res["face_count"] == 0
    assert len(res["bboxes"]) == 0

def test_detect_single_face(detector):
    img = cv2.imread("test_images/sample.jpg")
    assert img is not None
    res = detector.detect(img)
    assert res["face_count"] >= 1
    assert len(res["bboxes"]) == res["face_count"]
    for bbox in res["bboxes"]:
        assert len(bbox) == 4
        x1, y1, x2, y2 = bbox
        assert x2 > x1
        assert y2 > y1

def test_detect_rotated_face(detector):
    img = cv2.imread("test_images/sample.jpg")
    # Rotate 90 degrees clockwise
    rotated = cv2.rotate(img, cv2.ROTATE_90_CLOCKWISE)
    res = detector.detect(rotated)
    # SCRFD can detect tilted or some rotated faces, but at 90 deg it might or might not
    # We mainly ensure it doesn't crash and returns a valid format
    assert "face_count" in res
    assert "bboxes" in res
