import cv2
import numpy as np
import pytest
from app.pipeline.recognizer import FaceRecognizerPipeline
from app.recognition.embedder import FaceEmbedder

@pytest.fixture(scope="module")
def pipeline():
    # Setup dummy database with Person 1
    # Kita harus ektrak dulu wajah aslinya agar dapat vector yang valid untuk Budi
    embedder = FaceEmbedder()
    img_budi = cv2.imread("test_images/person1_a.jpg")
    faces = embedder.extract(img_budi)
    budi_vector = faces[0]["normed_embedding"]
    
    db = {"Budi": budi_vector}
    
    return FaceRecognizerPipeline(db_vectors=db, embedder=embedder)

def test_pipeline_none_image(pipeline):
    res = pipeline.process(None)
    assert res == []

def test_pipeline_blank_image(pipeline):
    blank = np.zeros((480, 640, 3), dtype=np.uint8)
    res = pipeline.process(blank)
    assert res == []

def test_pipeline_known_face(pipeline):
    img = cv2.imread("test_images/person1_b.jpg")
    res = pipeline.process(img)
    
    assert len(res) > 0
    face = res[0]
    
    assert face["name"] == "Budi"
    assert face["confidence"] > 0.8
    assert "bbox" in face
    assert "timestamp" in face

def test_pipeline_unknown_face(pipeline):
    # Person 2 (Lena) should be unknown
    img = cv2.imread("test_images/person2.jpg")
    res = pipeline.process(img)
    
    assert len(res) > 0
    face = res[0]
    
    assert face["name"] == "Unknown"
    assert face["confidence"] < 0.4
