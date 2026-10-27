import numpy as np
from insightface.app import FaceAnalysis
from app.config import settings

class FaceDetector:
    def __init__(self, model_name: str = None, threshold: float = None):
        self.model_name = model_name if model_name is not None else settings.det_model_name
        self.threshold = threshold if threshold is not None else settings.det_threshold
        
        self.app = FaceAnalysis(
            name=self.model_name, 
            allowed_modules=['detection'], 
            providers=['CPUExecutionProvider']
        )
        self.app.prepare(ctx_id=0, det_size=(640, 640), det_thresh=self.threshold)

    def detect(self, image: np.ndarray) -> dict:
        if image is None:
            return {"face_count": 0, "bboxes": []}
            
        faces = self.app.get(image)
        bboxes = [face.bbox.tolist() for face in faces]
        
        return {
            "face_count": len(faces),
            "bboxes": bboxes
        }
