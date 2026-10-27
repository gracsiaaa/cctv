import numpy as np
import pytest
from app.matching.matcher import FaceMatcher

@pytest.fixture
def matcher():
    return FaceMatcher(threshold=0.4)

def normalize(v):
    norm = np.linalg.norm(v)
    if norm == 0:
        return v
    return v / norm

@pytest.fixture
def db_vectors():
    # Buat 3 dummy vectors, dinormalisasi (gunakan randn agar mean 0, orthogonal secara ekspektasi)
    v_budi = normalize(np.random.randn(512).astype(np.float32))
    v_andi = normalize(np.random.randn(512).astype(np.float32))
    v_siti = normalize(np.random.randn(512).astype(np.float32))
    return {
        "Budi": v_budi,
        "Andi": v_andi,
        "Siti": v_siti
    }

def test_match_empty_db(matcher):
    query = normalize(np.random.randn(512).astype(np.float32))
    res = matcher.match(query, {})
    assert res["user"] == "Unknown"
    assert res["confidence"] == 0.0

def test_true_positive(matcher, db_vectors):
    # Simulasi: ambil vector Budi, beri sedikit noise agar tidak 1.0 persis
    query = db_vectors["Budi"].copy()
    noise = (np.random.randn(512) * 0.05).astype(np.float32)
    query = normalize(query + noise)
    
    res = matcher.match(query, db_vectors)
    assert res["user"] == "Budi"
    assert res["confidence"] >= matcher.threshold

def test_unknown_face_false_positive(matcher, db_vectors):
    # Simulasi orang baru (Joko) yang tidak ada di database
    v_joko = normalize(np.random.randn(512).astype(np.float32))
    
    res = matcher.match(v_joko, db_vectors)
    # Cosine similarity dari random high-dimensional vectors mendekati 0
    assert res["user"] == "Unknown"
    assert res["confidence"] < matcher.threshold

def test_matcher_custom_threshold():
    # Test bahwa threshold custom berfungsi
    matcher_strict = FaceMatcher(threshold=0.99)
    
    v_budi = normalize(np.random.randn(512).astype(np.float32))
    db = {"Budi": v_budi}
    
    # Query sama dengan Budi tapi tambah noise yang cukup besar
    noise = (np.random.randn(512) * 0.5).astype(np.float32)
    query = normalize(v_budi + noise)
    
    res = matcher_strict.match(query, db)
    # Karena threshold 0.99, ini harusnya Unknown walau aslinya Budi
    assert res["user"] == "Unknown"
