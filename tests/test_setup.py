import cv2
import numpy as np
import insightface
from insightface.app import FaceAnalysis
from app.config import settings

def test_imports():
    assert cv2.__version__ is not None
    assert insightface.__version__ is not None
    assert settings.det_model_name == "buffalo_l"

def test_image_generation_and_read():
    img = cv2.imread("test_images/sample.jpg")
    assert img is not None
    assert len(img.shape) == 3

def test_insightface_model_inference():
    app = FaceAnalysis(name=settings.det_model_name, providers=['CPUExecutionProvider'])
    app.prepare(ctx_id=0, det_size=(640, 640))
    
    img = cv2.imread("test_images/sample.jpg")
    faces = app.get(img)
    
    assert len(faces) > 0
    assert faces[0].bbox is not None
