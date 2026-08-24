from fastapi import Header, HTTPException, Request
from typing import Optional
import os
import hmac
import base64
import json

SECRET_KEY = os.getenv("SECRET_KEY", "minha-chave-secreta-padrao-123")

# Todos os profiles válidos no sistema
VALID_PROFILES = {"default", "albert", "almeida", "hugo", "igor", "mateus", "gabriel", "fernanda", "caio", "karine"}

def create_token(username: str, profile: str) -> str:
    """Gera um token assinado (stateless) contendo username e profile."""
    payload = {"username": username, "profile": profile}
    payload_b64 = base64.b64encode(json.dumps(payload).encode()).decode()
    signature = hmac.new(SECRET_KEY.encode(), payload_b64.encode(), "sha256").hexdigest()
    return f"{payload_b64}.{signature}"

def decode_token(authorization: str) -> Optional[dict]:
    """Decodifica e valida o token. Retorna o payload dict ou None se inválido."""
    if not authorization:
        return None
    token = authorization.replace("Bearer ", "").strip()
    if token in ["local_fallback_token", "local_session_token", "null", ""]:
        return None
    parts = token.split(".")
    if len(parts) != 2:
        return None
    payload_b64, signature = parts
    expected_signature = hmac.new(SECRET_KEY.encode(), payload_b64.encode(), "sha256").hexdigest()
    if not hmac.compare_digest(signature, expected_signature):
        return None
    try:
        return json.loads(base64.b64decode(payload_b64).decode())
    except Exception:
        return None

def get_current_user(authorization: str = Header(None)) -> str:
    """Valida o token assinado e retorna o profile."""
    payload = decode_token(authorization)
    if payload:
        profile = payload.get("profile", "default")
        return profile if profile in VALID_PROFILES else "default"
    return "default"

def get_current_username(authorization: str = Header(None)) -> str:
    """Valida o token assinado e retorna o username."""
    payload = decode_token(authorization)
    if payload:
        return payload.get("username", "Maciel")
    return "Maciel"
