from pydantic_settings import BaseSettings, SettingsConfigDict

class Settings(BaseSettings):
    det_model_name: str = "buffalo_l"
    det_threshold: float = 0.5
    rec_threshold: float = 0.4
    database_url: str = "postgresql://user:pass@localhost:5432/face_attendance"
    host: str = "0.0.0.0"
    port: int = 8000

    model_config = SettingsConfigDict(env_file=".env")

settings = Settings()
