import hashlib
import secrets
from datetime import datetime, timedelta
from typing import Optional
from app.storage.json_store import load_json, save_json

DEFAULT_SALT = "cctv_attendance_salt_2026"

def hash_password(password: str, salt: str = DEFAULT_SALT) -> str:
    return hashlib.sha256(f"{salt}{password}".encode("utf-8")).hexdigest()

def init_admin():
    admin_data = load_json("admin.json", default=None)
    if not admin_data:
        admin_data = {
            "username": "admin",
            "password_hash": hash_password("admin123"),
            "role": "admin",
            "created_at": datetime.now().isoformat()
        }
        save_json("admin.json", admin_data)
    return admin_data

class AuthManager:
    def __init__(self):
        init_admin()
        self.active_tokens = load_json("active_tokens.json", default={})

    def login(self, username: str, password: str) -> Optional[dict]:
        admin_data = load_json("admin.json", default={})
        if admin_data.get("username") == username and admin_data.get("password_hash") == hash_password(password):
            token = secrets.token_hex(24)
            expires_at = (datetime.now() + timedelta(days=7)).isoformat()
            user_info = {
                "token": token,
                "username": username,
                "role": "admin",
                "expires_at": expires_at
            }
            self.active_tokens[token] = user_info
            save_json("active_tokens.json", self.active_tokens)
            return user_info
        return None

    def verify_token(self, token: Optional[str]) -> bool:
        if not token:
            return False
        info = self.active_tokens.get(token)
        if not info:
            # Re-read in case updated by another worker
            self.active_tokens = load_json("active_tokens.json", default={})
            info = self.active_tokens.get(token)
        if not info:
            return False
        # Check expiry
        if datetime.fromisoformat(info["expires_at"]) < datetime.now():
            del self.active_tokens[token]
            save_json("active_tokens.json", self.active_tokens)
            return False
        return True

    def logout(self, token: str):
        if token in self.active_tokens:
            del self.active_tokens[token]
            save_json("active_tokens.json", self.active_tokens)

    def change_password(self, old_password: str, new_password: str) -> bool:
        admin_data = load_json("admin.json", default={})
        if admin_data.get("password_hash") != hash_password(old_password):
            return False
        admin_data["password_hash"] = hash_password(new_password)
        admin_data["updated_at"] = datetime.now().isoformat()
        save_json("admin.json", admin_data)
        return True

auth_manager = AuthManager()
