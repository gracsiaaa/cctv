import json
import os
import numpy as np

DATA_DIR = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", "data"))

def get_path(filename: str) -> str:
    os.makedirs(DATA_DIR, exist_ok=True)
    return os.path.join(DATA_DIR, filename)

def load_json(filename: str, default=None):
    filepath = get_path(filename)
    if not os.path.exists(filepath):
        return default if default is not None else {}
    try:
        with open(filepath, "r", encoding="utf-8") as f:
            return json.load(f)
    except Exception:
        return default if default is not None else {}

def save_json(filename: str, data):
    filepath = get_path(filename)
    with open(filepath, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2, ensure_ascii=False)

def load_face_db() -> dict:
    """Load face DB converting JSON lists back to list of np.ndarray."""
    raw = load_json("face_db.json", default={})
    db = {}
    for name, vectors in raw.items():
        if isinstance(vectors, list):
            # Check if list of vectors or single vector
            if len(vectors) > 0 and isinstance(vectors[0], list):
                db[name] = [np.array(v, dtype=np.float32) for v in vectors]
            else:
                db[name] = [np.array(vectors, dtype=np.float32)]
    return db

def save_face_db(db: dict):
    """Save face DB converting np.ndarrays to native python lists."""
    raw = {}
    for name, vectors in db.items():
        if isinstance(vectors, list):
            raw[name] = [v.tolist() if isinstance(v, np.ndarray) else v for v in vectors]
        elif isinstance(vectors, np.ndarray):
            raw[name] = [vectors.tolist()]
        else:
            raw[name] = vectors
    save_json("face_db.json", raw)
