"""User accounts + JWT auth.

Passwords are hashed with PBKDF2-HMAC-SHA256 (stdlib, no native deps). Access
tokens are stateless JWTs. `get_current_user` is a FastAPI dependency that
every data route uses to scope reads/writes to the caller.
"""

import base64
import hashlib
import hmac
import json
import os
import time

from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from .config import settings
from .models import UserOut
from .portfolio import _conn

_PBKDF2_ROUNDS = 200_000
_bearer = HTTPBearer(auto_error=False)


# --- Minimal HS256 JWT (stdlib only; avoids pulling in cryptography) --------

class _JWTError(Exception):
    pass


def _b64u(data: bytes) -> str:
    return base64.urlsafe_b64encode(data).rstrip(b"=").decode()


def _b64u_decode(s: str) -> bytes:
    return base64.urlsafe_b64decode(s + "=" * (-len(s) % 4))


def _jwt_encode(payload: dict, secret: str) -> str:
    header = {"alg": "HS256", "typ": "JWT"}
    segs = [
        _b64u(json.dumps(header, separators=(",", ":")).encode()),
        _b64u(json.dumps(payload, separators=(",", ":")).encode()),
    ]
    signing_input = ".".join(segs).encode()
    sig = hmac.new(secret.encode(), signing_input, hashlib.sha256).digest()
    segs.append(_b64u(sig))
    return ".".join(segs)


def _jwt_decode(token: str, secret: str) -> dict:
    try:
        h, p, s = token.split(".")
    except ValueError:
        raise _JWTError("malformed token")
    expected = hmac.new(secret.encode(), f"{h}.{p}".encode(), hashlib.sha256).digest()
    if not hmac.compare_digest(expected, _b64u_decode(s)):
        raise _JWTError("bad signature")
    payload = json.loads(_b64u_decode(p))
    if int(payload.get("exp", 0)) < int(time.time()):
        raise _JWTError("expired")
    return payload


def init_db() -> None:
    with _conn() as c:
        c.execute(
            """
            CREATE TABLE IF NOT EXISTS users (
                id            INTEGER PRIMARY KEY AUTOINCREMENT,
                email         TEXT NOT NULL UNIQUE,
                password_hash TEXT NOT NULL,
                created_at    INTEGER NOT NULL
            )
            """
        )


def _hash_password(password: str, salt: bytes | None = None) -> str:
    salt = salt or os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _PBKDF2_ROUNDS)
    return f"{salt.hex()}${dk.hex()}"


def _verify_password(password: str, stored: str) -> bool:
    try:
        salt_hex, dk_hex = stored.split("$")
    except ValueError:
        return False
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt_hex), _PBKDF2_ROUNDS)
    return hmac.compare_digest(dk.hex(), dk_hex)


def create_user(email: str, password: str) -> UserOut:
    email = email.strip().lower()
    with _conn() as c:
        exists = c.execute("SELECT 1 FROM users WHERE email = ?", (email,)).fetchone()
        if exists:
            raise HTTPException(status_code=409, detail="Email already registered")
        cur = c.execute(
            "INSERT INTO users (email, password_hash, created_at) VALUES (?, ?, ?)",
            (email, _hash_password(password), int(time.time())),
        )
        return UserOut(id=cur.lastrowid, email=email)


def authenticate(email: str, password: str) -> UserOut:
    email = email.strip().lower()
    with _conn() as c:
        row = c.execute("SELECT * FROM users WHERE email = ?", (email,)).fetchone()
    if not row or not _verify_password(password, row["password_hash"]):
        raise HTTPException(status_code=401, detail="Invalid email or password")
    return UserOut(id=row["id"], email=row["email"])


def issue_token(user: UserOut) -> str:
    payload = {
        "sub": str(user.id),
        "email": user.email,
        "exp": int(time.time()) + settings.jwt_expire_days * 86400,
    }
    return _jwt_encode(payload, settings.jwt_secret)


def get_current_user(
    creds: HTTPAuthorizationCredentials | None = Depends(_bearer),
) -> UserOut:
    if creds is None:
        raise HTTPException(status_code=401, detail="Not authenticated")
    try:
        payload = _jwt_decode(creds.credentials, settings.jwt_secret)
    except _JWTError:
        raise HTTPException(status_code=401, detail="Invalid or expired token")
    return UserOut(id=int(payload["sub"]), email=payload.get("email", ""))
