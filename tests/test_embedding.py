import cv2
import numpy as np
import pytest
from app.recognition.embedder import FaceEmbedder

@pytest.fixture(scope="module")
def embedder():
    return FaceEmbedder()

def test_extract_blank_image(embedder):
    blank_img = np.zeros((480, 640, 3), dtype=np.uint8)
    res = embedder.extract(blank_img)
    assert len(res) == 0

def test_extract_valid_face(embedder):
    img = cv2.imread("test_images/person1_a.jpg")
    res = embedder.extract(img)
    assert len(res) >= 1
    face = res[0]
    
    assert "bbox" in face
    assert "embedding" in face
    assert "normed_embedding" in face
    
    # Check dimensions (ArcFace produces 512-d vectors)
    assert face["embedding"].shape == (512,)
    assert face["normed_embedding"].shape == (512,)

def test_embedding_similarity(embedder):
    img1a = cv2.imread("test_images/person1_a.jpg")
    img1b = cv2.imread("test_images/person1_b.jpg")
    img2 = cv2.imread("test_images/person2.jpg")
    
    res1a = embedder.extract(img1a)
    res1b = embedder.extract(img1b)
    res2 = embedder.extract(img2)
    
    assert len(res1a) > 0
    assert len(res1b) > 0
    assert len(res2) > 0
    
    emb1a = res1a[0]["normed_embedding"]
    emb1b = res1b[0]["normed_embedding"]
    emb2 = res2[0]["normed_embedding"]
    
    # Cosine similarity using dot product on normed embeddings
    sim_same_person = np.dot(emb1a, emb1b)
    sim_diff_person = np.dot(emb1a, emb2)
    
    assert sim_same_person > 0.8  # should be highly similar
    assert sim_diff_person < 0.4  # should be dissimilar
    assert sim_same_person > sim_diff_person
