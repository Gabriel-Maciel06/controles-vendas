from fastapi import Header, HTTPException
import secrets

# Dicionário em memória para armazenar tokens ativos (Token -> Profile)
# Nota: Para produção escalável, usar Redis ou Banco de Dados.
active_tokens: dict[str, str] = {}

def create_token(profile: str) -> str:
    """Gera um novo token hexadecimal e o associa ao perfil."""
    token = secrets.token_hex(32)
    active_tokens[token] = profile
    return token

def get_current_user(authorization: str = Header(None)) -> str:
    """Dependency para validar o token no Header Authorization."""
    if not authorization:
        raise HTTPException(status_code=401, detail="Token ausente")
    
    token = authorization.replace("Bearer ", "")
    profile = active_tokens.get(token)
    
    if not profile:
        raise HTTPException(status_code=401, detail="Token inválido ou expirado")
    
    return profile
