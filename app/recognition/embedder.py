import numpy as np
from insightface.app import FaceAnalysis
from app.config import settings

class FaceEmbedder:
    def __init__(self, model_name: str = None):
        self.model_name = model_name if model_name is not None else settings.det_model_name
        
        # Load both detection and recognition
        self.app = FaceAnalysis(
            name=self.model_name, 
            allowed_modules=['detection', 'recognition'], 
            providers=['CPUExecutionProvider']
        )
        self.app.prepare(ctx_id=0, det_size=(640, 640), det_thresh=settings.det_threshold)

    def extract(self, image: np.ndarray) -> list[dict]:
        """
        Extract faces and their 512-d embeddings from an image.
        Returns:
            list[dict]: List containing 'bbox' and 'embedding' (numpy array) for each detected face.
        """
        if image is None:
            return []
            
        faces = self.app.get(image)
        results = []
        for face in faces:
            results.append({
                "bbox": face.bbox.tolist(),
                "embedding": face.embedding,
                "normed_embedding": face.normed_embedding
            })
            
        return results
