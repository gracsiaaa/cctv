import numpy as np
from app.config import settings

class FaceMatcher:
    def __init__(self, threshold: float = None):
        self.threshold = threshold if threshold is not None else settings.rec_threshold

    def match(self, query_vector: np.ndarray, db_vectors: dict) -> dict:
        """
        Match face query using Cosine Similarity against multi-embedding database.
        db_vectors: dict { "user_id": np.ndarray or list[np.ndarray] }
        Returns: {"user": str, "confidence": float}
        """
        if not db_vectors or query_vector is None:
            return {"user": "Unknown", "confidence": 0.0}

        best_user = "Unknown"
        best_score = -1.0

        for user_id, embeddings in db_vectors.items():
            if isinstance(embeddings, list):
                vector_list = embeddings
            else:
                vector_list = [embeddings]

            for emb in vector_list:
                score = float(np.dot(query_vector, emb))
                if score > best_score:
                    best_score = score
                    best_user = user_id

        best_score = max(0.0, float(best_score))

        if best_score >= self.threshold:
            return {"user": best_user, "confidence": round(best_score, 4)}
        else:
            return {"user": "Unknown", "confidence": round(best_score, 4)}
