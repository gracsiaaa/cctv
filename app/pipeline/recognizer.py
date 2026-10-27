import time
import numpy as np
from app.recognition.embedder import FaceEmbedder
from app.matching.matcher import FaceMatcher

class FaceRecognizerPipeline:
    def __init__(self, db_vectors: dict = None, embedder=None):
        """
        Initialize End-to-End Pipeline
        Args:
            db_vectors: Dictionary database awal { "user_id": np.ndarray(512,) }
            embedder: Optional FaceEmbedder instance
        """
        self.embedder = embedder if embedder is not None else FaceEmbedder()
        self.matcher = FaceMatcher()
        self.db_vectors = db_vectors if db_vectors is not None else {}

    def update_db(self, new_db: dict):
        self.db_vectors = new_db

    def process(self, image: np.ndarray) -> list[dict]:
        """
        Process image (Detect -> Align -> Embed -> Match)
        Returns:
            list[dict]: List dari hasil per wajah
        """
        if image is None:
            return []
            
        faces_data = self.embedder.extract(image)
        results = []
        
        # ISO timestamp format
        current_time = time.strftime("%Y-%m-%dT%H:%M:%S")
        
        for face in faces_data:
            emb = face["normed_embedding"]
            match_res = self.matcher.match(emb, self.db_vectors)
            
            results.append({
                "name": match_res["user"],
                "confidence": match_res["confidence"],
                "bbox": face["bbox"],
                "timestamp": current_time
            })
            
        return results
