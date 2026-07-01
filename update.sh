cat << 'INNER_EOF' > /home/azureuser/backend/auth.py
from fastapi import Header, HTTPException
import os
import hmac
import base64
import json

SECRET_KEY = os.getenv("SECRET_KEY", "minha-chave-secreta-padrao-123")

def create_token(profile: str) -> str:
    """Gera um token assinado (stateless)."""
    payload = {"profile": profile}
    payload_b64 = base64.b64encode(json.dumps(payload).encode()).decode()
    signature = hmac.new(SECRET_KEY.encode(), payload_b64.encode(), "sha256").hexdigest()
    return f"{payload_b64}.{signature}"

def get_current_user(authorization: str = Header(None)) -> str:
    """Valida o token assinado."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Token ausente")
    
    token = authorization.replace("Bearer ", "")
    parts = token.split(".")
    if len(parts) != 2:
        raise HTTPException(status_code=401, detail="Token malformado")
        
    payload_b64, signature = parts
    expected_signature = hmac.new(SECRET_KEY.encode(), payload_b64.encode(), "sha256").hexdigest()
    
    if not hmac.compare_digest(signature, expected_signature):
        raise HTTPException(status_code=401, detail="Token inválido ou expirado")
        
    try:
        payload = json.loads(base64.b64decode(payload_b64).decode())
        return payload.get("profile")
    except Exception:
        raise HTTPException(status_code=401, detail="Token corrompido")
INNER_EOF

cd /home/azureuser
sudo docker-compose restart fastapi_backend
