"""
Minimal email + password auth — stdlib only (pbkdf2), no external deps.

Passwords are stored as pbkdf2-hmac-sha256 with a per-user salt. Sessions are
bearer tokens held in memory (fine for a single-process local/PoC server; they
reset on restart, so users re-login). For production, persist sessions (Redis)
or issue signed JWTs, and put the app behind HTTPS.
"""

import hashlib
import hmac
import secrets

_PBKDF2_ITERS = 200_000
_SESSIONS: dict[str, str] = {}  # token -> user_id


def hash_password(password: str) -> str:
    salt = secrets.token_bytes(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _PBKDF2_ITERS)
    return f"pbkdf2_sha256${_PBKDF2_ITERS}${salt.hex()}${dk.hex()}"


def verify_password(password: str, stored: str) -> bool:
    try:
        _algo, iters, salt_hex, hash_hex = stored.split("$")
        dk = hashlib.pbkdf2_hmac("sha256", password.encode(), bytes.fromhex(salt_hex), int(iters))
        return hmac.compare_digest(dk.hex(), hash_hex)
    except Exception:
        return False


def create_token(user_id: str) -> str:
    token = secrets.token_urlsafe(24)
    _SESSIONS[token] = user_id
    return token


def user_id_for_token(token: str | None) -> str | None:
    if not token:
        return None
    return _SESSIONS.get(token)


def revoke(token: str) -> None:
    _SESSIONS.pop(token, None)
