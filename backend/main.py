import os
import sys
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import httpx
import traceback
import hashlib
import hmac
import secrets
import io
import pandas as pd
from typing import List, Dict, Any, Optional
from datetime import datetime, timedelta
from fastapi import FastAPI, Depends, HTTPException, UploadFile, File
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session
from pydantic import BaseModel
import models
from database import engine, get_db
from auth import get_current_user, get_current_username

app = FastAPI(title="Controle de Vendas Isapel API")

# Configuração de CORS - Restrito para domínios oficiais
ALLOWED_ORIGINS = [
    "https://controles-vendas.vercel.app",
    "https://controles-vendas.onrender.com",
    "http://localhost:8000",
    "http://localhost:8080",
    "http://127.0.0.1:8080",
    "http://localhost:5500",
    "http://127.0.0.1:5500",
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["Content-Type", "Authorization"],
)

@app.exception_handler(Exception)
async def global_exception_handler(request, exc):
    print(f"CRITICAL ERROR: {traceback.format_exc()}") # Log no servidor (Render logs)
    return JSONResponse(
        status_code=500,
        content={"detail": "Erro interno do servidor. Reporte ao suporte."},
    )

@app.on_event("startup")
def startup_event():
    try:
        print("Iniciando conexão com banco de dados...")
        models.Base.metadata.create_all(bind=engine)
        print("Banco de dados inicializado com sucesso!")
        
        migrations = [
            'ALTER TABLE customers ADD COLUMN IF NOT EXISTS "products" VARCHAR;',
            'ALTER TABLE customers ADD COLUMN IF NOT EXISTS "buyerName" VARCHAR;',
            'ALTER TABLE customers ADD COLUMN IF NOT EXISTS "source" VARCHAR;',
            'ALTER TABLE customers ADD COLUMN IF NOT EXISTS "origin" VARCHAR;',
            'ALTER TABLE customers ADD COLUMN IF NOT EXISTS "temperature" VARCHAR;',
            'ALTER TABLE customers ADD COLUMN IF NOT EXISTS "region" VARCHAR;',
            'ALTER TABLE customers ADD COLUMN IF NOT EXISTS "city" VARCHAR;',
            "ALTER TABLE customers ADD COLUMN IF NOT EXISTS profile VARCHAR DEFAULT 'default';",
            "ALTER TABLE sales ADD COLUMN IF NOT EXISTS profile VARCHAR DEFAULT 'default';",
            'ALTER TABLE sales ADD COLUMN IF NOT EXISTS "productName" VARCHAR;',
            'ALTER TABLE sales ADD COLUMN IF NOT EXISTS "costPrice" FLOAT;',
            "ALTER TABLE samples ADD COLUMN IF NOT EXISTS profile VARCHAR DEFAULT 'default';",
            'ALTER TABLE samples ADD COLUMN IF NOT EXISTS "trackingCode" VARCHAR;',
            'ALTER TABLE samples ADD COLUMN IF NOT EXISTS "notes" VARCHAR;',
            "ALTER TABLE settings ADD COLUMN IF NOT EXISTS profile VARCHAR DEFAULT 'default';",
            "ALTER TABLE reminders ADD COLUMN IF NOT EXISTS profile VARCHAR DEFAULT 'default';",
            'ALTER TABLE samples ADD COLUMN IF NOT EXISTS "trackingLastEvent" VARCHAR;',
            'ALTER TABLE samples ADD COLUMN IF NOT EXISTS "trackingUpdatedAt" VARCHAR;',
            'ALTER TABLE customers ADD COLUMN IF NOT EXISTS "inactiveStatus" VARCHAR;',
            'ALTER TABLE customers ADD COLUMN IF NOT EXISTS "lastImportedSessionId" VARCHAR;',
            'ALTER TABLE sales ADD COLUMN IF NOT EXISTS "reactivationStatus" VARCHAR;',
        ]

        is_postgres = "postgres" in str(engine.url)
        print(f"Executando {len(migrations)} migrations (postgres={is_postgres})...")

        for sql in migrations:
            try:
                with engine.begin() as conn:
                    if is_postgres:
                        conn.execute(text("SET LOCAL lock_timeout = '2s';"))
                    conn.execute(text(sql))
            except Exception:
                pass  # Coluna já existe, ignorar
                
        print("Migrations concluídas. Servidor pronto!")

        # Popular usuários padrão no banco de dados
        from sqlalchemy.orm import sessionmaker
        SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
        db = SessionLocal()
        try:
            count = db.query(models.User).count()
            if count == 0:
                print("Criando usuários padrão no banco de dados...")
                def sha256_hash(pw: str) -> str:
                    return hashlib.sha256(pw.encode()).hexdigest()
                
                default_users = [
                    {"username": "Maciel", "profile": "default", "password": os.getenv("APP_PASSWORD_DEFAULT") or "maciel0602"},
                    {"username": "karine", "profile": "karine", "password": os.getenv("APP_PASSWORD_KARINE") or "Karine1234"},
                    {"username": "caio", "profile": "caio", "password": os.getenv("APP_PASSWORD_CAIO") or "Caio1234"},
                    {"username": "fernanda", "profile": "fernanda", "password": os.getenv("APP_PASSWORD_FERNANDA") or "Fernanda1234"},
                    {"username": "mateus", "profile": "mateus", "password": os.getenv("APP_PASSWORD_MATEUS") or "Mateus1234"},
                    {"username": "Albert", "profile": "albert", "password": "Albert123"},
                    {"username": "Gabriel", "profile": "gabriel", "password": "Gabriel123"},
                    {"username": "Igor", "profile": "igor", "password": "Igor123"},
                    {"username": "Almeida", "profile": "almeida", "password": "Almeida123"},
                    {"username": "Hugo", "profile": "hugo", "password": "Hugo123"},
                ]
                
                for u in default_users:
                    user = models.User(
                        username=u["username"],
                        profile=u["profile"],
                        password_hash=sha256_hash(u["password"]),
                        createdAt=datetime.now().strftime("%Y-%m-%d %H:%M:%S")
                    )
                    db.add(user)
                db.commit()
                print("Usuários padrão criados no banco!")
        except Exception as err_users:
            print(f"Erro ao inicializar tabela de usuários: {err_users}")
        finally:
            db.close()
            
    except Exception as e:
        print(f"ERRO no startup (servidor sobe mesmo assim): {e}")
        # Não re-raise — permite o servidor subir mesmo com erro de banco

# --- debug endpoint ---
@app.get("/api/db-check")
def db_check(db: Session = Depends(get_db)):
    try:
        db.execute(text("SELECT 1"))
        db_type = "postgres" if "postgres" in str(engine.url) else "sqlite"
        return {
            "status": "ok", 
            "database": "conectado",
            "type": db_type,
            "url_provided": bool(os.getenv("DATABASE_URL"))
        }
    except Exception as e:
        return {"status": "error", "message": str(e)}


# --- AUTH ENDPOINT ---
class LoginRequest(BaseModel):
    username: str
    password: str

class ChangePasswordRequest(BaseModel):
    currentPassword: str
    newPassword: str

@app.post("/api/login")
def login(req: LoginRequest, db: Session = Depends(get_db)):
    username = req.username.strip()
    password = req.password.strip()
    from auth import create_token

    # Busca usuário no banco (case insensitive)
    db_users = db.query(models.User).all()
    user = None
    for u in db_users:
        if u.username.lower().strip() == username.lower().strip():
            user = u
            break

    if not user:
        raise HTTPException(status_code=401, detail="Usuário não encontrado")

    hashed_password = hashlib.sha256(password.encode()).hexdigest()
    if not hmac.compare_digest(user.password_hash, hashed_password):
        raise HTTPException(status_code=401, detail="Senha incorreta")

    token = create_token(user.username, user.profile)
    return {"ok": True, "profile": user.profile, "username": user.username, "token": token}

@app.post("/api/change-password")
def change_password(req: ChangePasswordRequest, username: str = Depends(get_current_username), db: Session = Depends(get_db)):
    current_password = req.currentPassword.strip()
    new_password = req.newPassword.strip()
    
    if len(new_password) < 4:
        raise HTTPException(status_code=400, detail="A nova senha deve ter no mínimo 4 caracteres")
        
    user = db.query(models.User).filter(models.User.username == username).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado")
        
    current_hashed = hashlib.sha256(current_password.encode()).hexdigest()
    if not hmac.compare_digest(user.password_hash, current_hashed):
        raise HTTPException(status_code=400, detail="Senha atual incorreta")
        
    user.password_hash = hashlib.sha256(new_password.encode()).hexdigest()
    db.commit()
    return {"ok": True, "message": "Senha alterada com sucesso!"}

# --- Pydantic Schemas for Validation ---
class SaleBase(BaseModel):
    id: str
    profile: str = "default"
    client: str
    productName: str = None
    costPrice: float = None
    type: str
    boxes20056: int = 0
    saleDate: str
    invoiceDate: str
    value: float
    commission: float
    reactivationStatus: str = None # "Valida", "Invalida" ou None
    createdAt: str
    updatedAt: str = None

    class Config:
        orm_mode = True

class CustomerBase(BaseModel):
    id: str
    profile: str = "default"
    name: str # Nome do cliente
    company: str = None
    phone: str = None
    email: str = None
    address: str = None
    cnpj: str = None
    instagram: str = None
    segment: str = None
    status: str = "Ativo"
    lastContactDate: str = None
    nextFollowUp: str = None
    notes: str = None
    products: str = None
    buyerName: str = None
    source: str = None
    origin: str = None
    temperature: str = None
    region: str = None
    lastPurchaseDate: Optional[str] = None
    totalPurchased: Optional[float] = 0.0
    purchaseCount: Optional[int] = 0
    inactiveStatus: Optional[str] = None # "Novo" ou "Antigo"
    lastImportedSessionId: Optional[str] = None
    createdAt: str
    updatedAt: Optional[str] = None

    class Config:
        orm_mode = True

class SampleBase(BaseModel):
    id: str
    profile: str = "default"
    client: str
    product: str = "Envelope completo"
    trackingCode: str = None
    sendDate: str
    estimatedReturn: str
    notes: str = None
    status: str
    trackingLastEvent: str = None
    trackingUpdatedAt: str = None
    createdAt: str
    updatedAt: str = None

    class Config:
        orm_mode = True

class ReminderBase(BaseModel):
    id: str
    profile: str = "default"
    title: str
    dateLimit: str
    timeLimit: str = None
    priority: str
    status: str
    createdAt: str
    updatedAt: str = None

    class Config:
        orm_mode = True

class SettingBase(BaseModel):
    profile: str = "default"
    google: float = 100
    reativacao: float = 100
    introducao: float = 25
    crm_monthly_goal: float = 0
    crm_contact_goal: float = 30

    class Config:
        orm_mode = True

class ProspectBase(BaseModel):
    id: str
    profile: str = "default"
    razaoSocial: str
    cnpj: str = None
    phone: str
    city: str
    region: str
    porte: str
    instagram: str = None
    notes: str = None
    status: str = "Novo"
    crmCustomerId: str = None
    sentToCrmAt: str = None
    createdAt: str
    updatedAt: str = None

    class Config:
        orm_mode = True

# --- Schemas de Atualização (Proteção contra Mass Assignment) ---
class SaleUpdate(BaseModel):
    client: str = None
    productName: str = None
    costPrice: float = None
    type: str = None
    boxes20056: int = None
    saleDate: str = None
    invoiceDate: str = None
    value: float = None
    commission: float = None
    reactivationStatus: str = None
    updatedAt: str = None

class CustomerUpdate(BaseModel):
    name: str = None
    company: str = None
    phone: str = None
    email: str = None
    address: str = None
    cnpj: str = None
    instagram: str = None
    segment: str = None
    status: str = None
    lastContactDate: str = None
    nextFollowUp: str = None
    notes: str = None
    products: str = None
    buyerName: str = None
    source: str = None
    origin: str = None
    temperature: str = None
    region: str = None
    city: str = None
    inactiveStatus: str = None
    lastImportedSessionId: str = None
    updatedAt: str = None

class InactiveReferenceBase(BaseModel):
    id: str
    vendedor: str
    codigo_cliente: str
    nome_cliente: str
    regiao: str = None
    cidade: str = None
    status: str = "Novo"
    importSessionId: str
    createdAt: str

    class Config:
        orm_mode = True

class ReactivationBase(BaseModel):
    id: str
    vendedor: str
    cliente_nome: str
    valor_venda: float
    data_venda: str
    data_faturamento: str
    status_validacao: str
    visto_segunda: int = 0
    data_limite_check: str
    alerta_atraso: int = 0
    createdAt: str
    updatedAt: str = None

    class Config:
        orm_mode = True

class SampleUpdate(BaseModel):
    client: str = None
    product: str = None
    trackingCode: str = None
    sendDate: str = None
    estimatedReturn: str = None
    notes: str = None
    status: str = None
    updatedAt: str = None

class ReminderUpdate(BaseModel):
    title: str = None
    dateLimit: str = None
    timeLimit: str = None
    priority: str = None
    status: str = None
    updatedAt: str = None


class WhatsAppMessageBase(BaseModel):
    remoteJid: str
    fromMe: int
    content: str
    pushName: str = None
    timestamp: int
    profile: str = "default"

    class Config:
        orm_mode = True

class ImportFacilitaReq(BaseModel):
    customers: List[CustomerBase] = []
    prospects: List[ProspectBase] = []
    profile: str = "default"


# --- API Endpoints ---

@app.post("/api/ai/proxy")
async def ai_proxy(payload: dict, profile: str = Depends(get_current_user)):
    """
    Proxy de segurança híbrido para a API do Gemini (Google) ou Claude (Anthropic).
    Oculta a chave da API do frontend e centraliza as chamadas de IA.
    """
    api_key = os.getenv("CLAUDE_API_KEY") or "AQ.Ab8RN6LXBW6LW51zD48PEHoTjmsJ1ka_fr3hThaD8CX-aqL0tw"
    if not api_key:
        raise HTTPException(status_code=500, detail="Chave de API de IA não configurada no servidor.")
    
    # Extrair campos comuns do payload do frontend
    model = payload.get("model", "claude-3-haiku-20240307")
    messages = payload.get("messages", [])
    max_tokens = payload.get("max_tokens", 800)
    system = payload.get("system", "Você é um assistente útil.")
    
    # Roteamento automático baseado no prefixo da chave
    if api_key.startswith("AQ.") or api_key.startswith("AIza"):
        print("[AI PROXY] Direcionando chamada para Google Gemini API (AI Studio)...")
        # Usamos o modelo atualizado gemini-2.5-flash
        gemini_model = "gemini-2.5-flash"
        url = f"https://generativelanguage.googleapis.com/v1beta/models/{gemini_model}:generateContent?key={api_key}"
        
        # Extrair texto do payload no formato Anthropic para enviar ao Gemini
        user_text = ""
        if messages:
            content_block = messages[0].get("content")
            if isinstance(content_block, str):
                user_text = content_block
            elif isinstance(content_block, list):
                user_text = "".join([part.get("text", "") for part in content_block if isinstance(part, dict)])
        
        gemini_payload = {
            "contents": [{
                "role": "user",
                "parts": [{"text": user_text}]
            }],
            "systemInstruction": {
                "parts": [{"text": system}]
            },
            "generationConfig": {
                "responseMimeType": "application/json",
                "maxOutputTokens": max_tokens
            }
        }
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(url, json=gemini_payload, timeout=30.0)
                if response.status_code != 200:
                    print(f"Gemini API Error: {response.status_code} - {response.text}")
                    return JSONResponse(status_code=response.status_code, content=response.json())
                
                res_data = response.json()
                try:
                    generated_text = res_data["candidates"][0]["content"]["parts"][0]["text"]
                except (KeyError, IndexError) as parse_err:
                    print(f"Erro ao parsear resposta do Gemini: {res_data}")
                    raise HTTPException(status_code=502, detail="Resposta do Gemini em formato inesperado.")
                
                # Devolve no formato que o frontend espera (formato da Anthropic)
                return {
                    "content": [{
                        "text": generated_text
                    }]
                }
            except Exception as e:
                print(f"Gemini Proxy Exception: {str(e)}")
                raise HTTPException(status_code=502, detail=f"Erro ao conectar com Gemini API: {str(e)}")
    
    else:
        print("[AI PROXY] Direcionando chamada para Anthropic Claude API...")
        url = "https://api.anthropic.com/v1/messages"
        headers = {
            "x-api-key": api_key,
            "anthropic-version": "2023-06-01",
            "Content-Type": "application/json"
        }
        
        proxy_payload = {
            "model": model,
            "max_tokens": max_tokens,
            "messages": messages,
            "system": system
        }
        
        async with httpx.AsyncClient() as client:
            try:
                response = await client.post(url, headers=headers, json=proxy_payload, timeout=30.0)
                if response.status_code != 200:
                    print(f"Claude API Error: {response.status_code} - {response.text}")
                    return JSONResponse(status_code=response.status_code, content=response.json())
                return response.json()
            except Exception as e:
                print(f"Proxy Exception: {str(e)}")
                raise HTTPException(status_code=502, detail=f"Erro ao conectar com Anthropic: {str(e)}")


# --- SALES ---
@app.get("/api/sales", response_model=List[SaleBase])
def get_sales(profile: str = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(models.Sale).filter(models.Sale.profile == profile).all()

@app.post("/api/sales", response_model=SaleBase)
def create_sale(sale: SaleBase, profile: str = Depends(get_current_user), db: Session = Depends(get_db)):
    # Normalizar Nome do Cliente para evitar duplicidade (Espaços/Caixa)
    sale.client = sale.client.strip().upper()
    
    # Remove campos virtuais que não pertencem ao modelo físico do banco
    sale_data = sale.dict()
    sale_data.pop("reactivationStatus", None)
    
    db_sale = models.Sale(**sale_data)
    db.add(db_sale)

    sale_date_str = sale.saleDate or (sale.createdAt[:10] if sale.createdAt else datetime.now().strftime("%Y-%m-%d"))

    # Auto-cria cliente ativo ou atualiza se já existir (pelo nome normalizado)
    db_cust = db.query(models.Customer).filter(
        models.Customer.name == sale.client,
        models.Customer.profile == sale.profile
    ).first()
    
    if db_cust:
        db_cust.status = "Ativo"
        db_cust.temperature = "Pós venda"
        db_cust.lastPurchaseDate = sale_date_str
        db_cust.lastContactDate = sale_date_str
        db_cust.purchaseCount = (db_cust.purchaseCount or 0) + 1
        db_cust.totalPurchased = (db_cust.totalPurchased or 0.0) + (sale.value or 0.0)
        db_cust.updatedAt = sale.createdAt
    else:
        new_cust = models.Customer(
            id=f"cli_auto_{sale.id}",
            profile=sale.profile,
            name=sale.client,
            company="",
            phone="",
            status="Ativo",
            lastPurchaseDate=sale_date_str,
            lastContactDate=sale_date_str,
            totalPurchased=sale.value or 0.0,
            purchaseCount=1,
            nextFollowUp="",
            temperature="Pós venda",
            origin="Vendas",
            source="Venda",
            createdAt=sale.createdAt,
            updatedAt=sale.createdAt
        )
        db.add(new_cust)

    db.commit()
    db.refresh(db_sale)
    return db_sale

@app.put("/api/sales/{sale_id}", response_model=SaleBase)
def update_sale(sale_id: str, sale: SaleUpdate, profile: str = Depends(get_current_user), db: Session = Depends(get_db)):
    db_sale = db.query(models.Sale).filter(models.Sale.id == sale_id, models.Sale.profile == profile).first()
    if not db_sale:
        raise HTTPException(status_code=404, detail="Sale not found or unauthorized")
    
    # Remove campos virtuais que não pertencem ao modelo físico do banco
    update_data = sale.dict(exclude_unset=True)
    update_data.pop("reactivationStatus", None)
    
    for key, value in update_data.items():
        setattr(db_sale, key, value)
    
    db.commit()
    db.refresh(db_sale)
    return db_sale

@app.delete("/api/sales/{sale_id}")
def delete_sale(sale_id: str, profile: str = Depends(get_current_user), db: Session = Depends(get_db)):
    db_sale = db.query(models.Sale).filter(models.Sale.id == sale_id, models.Sale.profile == profile).first()
    if not db_sale:
        raise HTTPException(status_code=404, detail="Sale not found or unauthorized")
    db.delete(db_sale)
    db.commit()
    return {"ok": True}

# --- CUSTOMERS ---
@app.get("/api/customers", response_model=List[CustomerBase])
def get_customers(profile: str = Depends(get_current_user), db: Session = Depends(get_db)):
    customers = db.query(models.Customer).filter(models.Customer.profile == profile).all()
    today = datetime.now().date()
    updated = False
    
    for c in customers:
        p_date_str = c.lastPurchaseDate or c.lastContactDate or (c.createdAt[:10] if c.createdAt else None)
        if p_date_str:
            try:
                p_date = datetime.strptime(p_date_str[:10], "%Y-%m-%d").date()
                days_since = (today - p_date).days
                # Regra dos 2 meses (60 dias sem compra => Inativo)
                if days_since >= 60:
                    if c.status != "Inativo":
                        c.status = "Inativo"
                        updated = True
                else:
                    if c.status == "Inativo" and c.lastPurchaseDate:
                        c.status = "Ativo"
                        updated = True
            except Exception:
                pass
                
    if updated:
        db.commit()
        
    return customers

@app.post("/api/customers", response_model=CustomerBase)
def create_customer(customer: CustomerBase, profile: str = Depends(get_current_user), db: Session = Depends(get_db)):
    customer.profile = profile
    customer.name = customer.name.strip().upper()
    
    # Verificar se já existe por CNPJ (se fornecido)
    if customer.cnpj:
        clean_cnpj = "".join(filter(str.isdigit, customer.cnpj))
        if clean_cnpj:
            existing = db.query(models.Customer).filter(
                models.Customer.cnpj == customer.cnpj,
                models.Customer.profile == profile
            ).first()
            if existing:
                # Se já existe, apenas atualizamos e retornamos o existente
                for key, value in customer.dict(exclude_unset=True).items():
                    if key != "id": setattr(existing, key, value)
                db.commit()
                db.refresh(existing)
                return existing

    db_customer = models.Customer(**customer.dict())
    db.add(db_customer)
    db.commit()
    db.refresh(db_customer)
    return db_customer

@app.put("/api/customers/{customer_id}", response_model=CustomerBase)
def update_customer(customer_id: str, customer: CustomerUpdate, profile: str = Depends(get_current_user), db: Session = Depends(get_db)):
    db_customer = db.query(models.Customer).filter(models.Customer.id == customer_id, models.Customer.profile == profile).first()
    if not db_customer:
        raise HTTPException(status_code=404, detail="Customer not found or unauthorized")
    
    for key, value in customer.dict(exclude_unset=True).items():
        setattr(db_customer, key, value)
    
    db.commit()
    db.refresh(db_customer)
    return db_customer

@app.delete("/api/customers/{customer_id}")
def delete_customer(customer_id: str, profile: str = Depends(get_current_user), db: Session = Depends(get_db)):
    db_customer = db.query(models.Customer).filter(models.Customer.id == customer_id, models.Customer.profile == profile).first()
    if not db_customer:
        raise HTTPException(status_code=404, detail="Customer not found or unauthorized")
    db.delete(db_customer)
    db.commit()
    return {"ok": True}

@app.post("/api/import/facilita")
def import_facilita(req: ImportFacilitaReq, profile: str = Depends(get_current_user), db: Session = Depends(get_db)):
    if profile not in ["default", "mateus"]:
        raise HTTPException(status_code=403, detail="Apenas o perfil default/mateus pode importar a base Facilita")

    created = 0
    ignored = 0
    errors = 0

    # Process Customers
    for c_data in req.customers:
        try:
            db_cust = db.query(models.Customer).filter(models.Customer.id == c_data.id).first()
            if db_cust:
                for key, value in c_data.dict(exclude_unset=True).items():
                    setattr(db_cust, key, value)
                db.commit()
                ignored += 1
                continue
            
            new_cust = models.Customer(**c_data.dict())
            db.add(new_cust)
            db.commit()
            created += 1
        except Exception as e:
            errors += 1
            db.rollback()
            print(f"Erro ao importar cliente {c_data.id}: {e}")

    # Process Prospects
    for p_data in req.prospects:
        try:
            db_pros = db.query(models.Prospect).filter(models.Prospect.id == p_data.id).first()
            if db_pros:
                for key, value in p_data.dict(exclude_unset=True).items():
                    setattr(db_pros, key, value)
                db.commit()
                ignored += 1
                continue
            
            new_pros = models.Prospect(**p_data.dict())
            db.add(new_pros)
            db.commit()
            created += 1
        except Exception as e:
            errors += 1
            db.rollback()
            print(f"Erro ao importar prospecto {p_data.id}: {e}")

    return {"criados": created, "ignorados": ignored, "erros": errors}

# --- SAMPLES ---
@app.get("/api/samples", response_model=List[SampleBase])
def get_samples(profile: str = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(models.Sample).filter(models.Sample.profile == profile).all()

@app.post("/api/samples", response_model=SampleBase)
def create_sample(sample: SampleBase, profile: str = Depends(get_current_user), db: Session = Depends(get_db)):
    sample.profile = profile
    db_sample = models.Sample(**sample.dict())
    db.add(db_sample)
    db.commit()
    db.refresh(db_sample)
    return db_sample

@app.put("/api/samples/{sample_id}", response_model=SampleBase)
def update_sample(sample_id: str, sample: SampleUpdate, profile: str = Depends(get_current_user), db: Session = Depends(get_db)):
    db_sample = db.query(models.Sample).filter(models.Sample.id == sample_id, models.Sample.profile == profile).first()
    if not db_sample:
        raise HTTPException(status_code=404, detail="Sample not found or unauthorized")
    
    for key, value in sample.dict(exclude_unset=True).items():
        setattr(db_sample, key, value)
    
    db.commit()
    db.refresh(db_sample)
    return db_sample

@app.delete("/api/samples/{sample_id}")
def delete_sample(sample_id: str, profile: str = Depends(get_current_user), db: Session = Depends(get_db)):
    db_sample = db.query(models.Sample).filter(models.Sample.id == sample_id, models.Sample.profile == profile).first()
    if not db_sample:
        raise HTTPException(status_code=404, detail="Sample not found or unauthorized")
    db.delete(db_sample)
    db.commit()
    return {"ok": True}

@app.get("/api/samples/{sample_id}/track")
async def track_sample(sample_id: str, profile: str = Depends(get_current_user), db: Session = Depends(get_db)):
    sample = db.query(models.Sample).filter(models.Sample.id == sample_id, models.Sample.profile == profile).first()
    if not sample: # Corrigido crash se sample for None (Bug 13)
        raise HTTPException(status_code=404, detail="Sample not found or unauthorized")
    
    if not sample.trackingCode:
        return {"status": sample.status}

    code = sample.trackingCode.upper().strip()
    
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            headers = {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/110.0.0.0 Safari/537.36",
                "Accept": "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,image/apng,*/*;q=0.8",
                "Accept-Language": "pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7"
            }
            # Tentar Scraping da página pública da LinkeTrack (mais estável que a API api.)
            url_web = f"https://www.linketrack.com.br/rastreio/{code}"
            resp = await client.get(url_web, headers=headers)
            
            if resp.status_code == 200:
                html = resp.text
                # Procura por padrões de status no HTML (LinkeTrack injeta dados no HTML)
                # O status costuma vir em tags <p class="status"> ou similar
                # Uma forma robusta é procurar por palavras chave conhecidas
                status_text = ""
                if "Objeto entregue" in html: status_text = "Objeto entregue ao destinatário"
                elif "Objeto postado" in html: status_text = "Objeto postado"
                elif "em trânsito" in html.lower(): status_text = "Objeto em trânsito"
                elif "Saiu para entrega" in html: status_text = "Objeto saiu para entrega ao destinatário"
                
                if status_text:
                    return await update_sample_tracking(sample, {"description": status_text, "unidade": {"local": "Correios"}}, db)

            # Fallback: Tentar API Brasil Aberto (caso o Token esteja configurado via env)
            token = os.getenv("BRASIL_ABERTO_TOKEN")
            if token:
                url_ba = f"https://api.brasilaberto.com/v1/postal-orders/{code}"
                resp_ba = await client.get(url_ba, headers={"Authorization": f"Bearer {token}"})
                if resp_ba.status_code == 200:
                    data = resp_ba.json()
                    events = data.get("result", {}).get("events", [])
                    if events:
                        return await update_sample_tracking(sample, events[0], db)

        return {"status": sample.status}
    except Exception:
        return {"status": sample.status}

async def update_sample_tracking(sample, event_data, db):
    description = event_data.get("description", "")
    new_status = map_tracking_status(description)
    
    sample.status = new_status
    sample.trackingLastEvent = description
    sample.trackingUpdatedAt = datetime.utcnow().isoformat()
    sample.updatedAt = datetime.utcnow().isoformat()
    db.commit()
    
    return {
        "status": new_status,
        "lastEvent": description
    }

def map_tracking_status(description: str) -> str:
    desc = description.lower()
    if "entregue ao destinatário" in desc or "entregue" in desc:
        return "Entregue"
    if "saiu para entrega" in desc or "em trânsito" in desc:
        return "Em trânsito"
    if "postado" in desc or "coletado" in desc:
        return "Enviada"
    if "tentativa" in desc:
        return "Tentativa de entrega"
    if "aguardando retirada" in desc:
        return "Aguardando retirada"
    return "Em trânsito"

@app.post("/api/samples/track-all")
async def track_all_samples(profile: str = Depends(get_current_user), db: Session = Depends(get_db)):
    active = db.query(models.Sample).filter(
        models.Sample.profile == profile,
        models.Sample.trackingCode != None,
        models.Sample.trackingCode != "",
        models.Sample.status.notin_(["Entregue", "Convertida", "Rejeitada"])
    ).all()

    updated = 0
    errors = 0

    async with httpx.AsyncClient(timeout=10.0) as client:
        for sample in active:
            try:
                resp = await client.get(
                    f"https://brasilaberto.com/api/v1/trackobject/{sample.trackingCode}"
                )
                data = resp.json()
                events = data.get("result", {}).get("events", [])
                if events:
                    description = events[0].get("description", "")
                    new_status = map_tracking_status(description)
                    if new_status != sample.status:
                        sample.status = new_status
                        sample.trackingLastEvent = description
                        sample.trackingUpdatedAt = datetime.utcnow().isoformat()
                        sample.updatedAt = datetime.utcnow().isoformat()
                        updated += 1
            except Exception:
                errors += 1

    db.commit()
    return {"ok": True, "updated": updated, "errors": errors, "total": len(active)}

# --- REMINDERS ---
@app.get("/api/reminders", response_model=List[ReminderBase])
def get_reminders(profile: str = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(models.Reminder).filter(models.Reminder.profile == profile).all()

@app.post("/api/reminders", response_model=ReminderBase)
def create_reminder(reminder: ReminderBase, profile: str = Depends(get_current_user), db: Session = Depends(get_db)):
    reminder.profile = profile
    db_reminder = models.Reminder(**reminder.dict())
    db.add(db_reminder)
    db.commit()
    db.refresh(db_reminder)
    return db_reminder

@app.put("/api/reminders/{reminder_id}", response_model=ReminderBase)
def update_reminder(reminder_id: str, reminder: ReminderUpdate, profile: str = Depends(get_current_user), db: Session = Depends(get_db)):
    db_reminder = db.query(models.Reminder).filter(models.Reminder.id == reminder_id, models.Reminder.profile == profile).first()
    if not db_reminder:
        raise HTTPException(status_code=404, detail="Reminder not found or unauthorized")
    
    for key, value in reminder.dict(exclude_unset=True).items():
        setattr(db_reminder, key, value)
    
    db.commit()
    db.refresh(db_reminder)
    return db_reminder

@app.delete("/api/reminders/{reminder_id}")
def delete_reminder(reminder_id: str, profile: str = Depends(get_current_user), db: Session = Depends(get_db)):
    db_reminder = db.query(models.Reminder).filter(models.Reminder.id == reminder_id, models.Reminder.profile == profile).first()
    if not db_reminder:
        raise HTTPException(status_code=404, detail="Reminder not found or unauthorized")
    db.delete(db_reminder)
    db.commit()
    return {"ok": True}

# --- SETTINGS ---
@app.get("/api/settings", response_model=SettingBase)
def get_settings(profile: str = Depends(get_current_user), db: Session = Depends(get_db)):
    # Simple key-value store in db
    settings = db.query(models.Setting).filter(models.Setting.profile == profile).all()
    result = SettingBase().dict() # defaults
    result["profile"] = profile
    for s in settings:
        if s.key in result:
            result[s.key] = float(s.value) if "." in s.value or s.value.isdigit() else s.value
    return result

@app.post("/api/settings")
def save_settings(settings: dict, profile: str = Depends(get_current_user), db: Session = Depends(get_db)):
    # Clear old for this profile
    db.query(models.Setting).filter(models.Setting.profile == profile).delete()
    
    # Save new
    for k, v in settings.items():
        if k == 'profile': continue
        db_setting = models.Setting(id=f"{profile}_{k}", profile=profile, key=k, value=str(v))
        db.add(db_setting)
    
    db.commit()
    return {"ok": True}

# --- PROSPECTS ---
@app.get("/api/prospects", response_model=List[ProspectBase])
def get_prospects(profile: str = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(models.Prospect).filter(models.Prospect.profile == profile).all()

@app.post("/api/prospects", response_model=ProspectBase)
def create_prospect(prospect: ProspectBase, profile: str = Depends(get_current_user), db: Session = Depends(get_db)):
    prospect.profile = profile
    db_pros = models.Prospect(**prospect.dict())
    db.add(db_pros)
    db.commit()
    db.refresh(db_pros)
    return db_pros

@app.post("/api/prospects/{prospect_id}/send-to-crm")
def send_to_crm(prospect_id: str, profile: str = Depends(get_current_user), db: Session = Depends(get_db)):
    db_pros = db.query(models.Prospect).filter(models.Prospect.id == prospect_id, models.Prospect.profile == profile).first()
    if not db_pros:
        raise HTTPException(status_code=404, detail="Prospect not found")
    
    # Criar cliente no CRM a partir do prospecto
    now = datetime.now().isoformat()
    new_cust = models.Customer(
        id=f"cli_from_{db_pros.id}",
        profile=db_pros.profile,
        name=db_pros.razaoSocial,
        phone=db_pros.phone,
        cnpj=db_pros.cnpj,
        city=db_pros.city,
        region=db_pros.region,
        instagram=db_pros.instagram,
        status="Pós venda", 
        origin="Maps",      
        temperature="Frio",
        notes=f"Vindo da Prospecção. Notas: {db_pros.notes}",
        createdAt=now,
        updatedAt=now
    )
    
    db_pros.status = "Enviado"
    db_pros.crmCustomerId = new_cust.id
    db_pros.sentToCrmAt = now
    
    db.add(new_cust)
    db.commit()
    return {"ok": True, "customerId": new_cust.id}

@app.delete("/api/prospects/{prospect_id}")
def delete_prospect(prospect_id: str, profile: str = Depends(get_current_user), db: Session = Depends(get_db)):
    db_pros = db.query(models.Prospect).filter(models.Prospect.id == prospect_id, models.Prospect.profile == profile).first()
    if not db_pros:
        raise HTTPException(status_code=404, detail="Prospect not found or unauthorized")
    db.delete(db_pros)
    db.commit()
    return {"ok": True}

# --- WHATSAPP ---

@app.get("/api/whatsapp/messages/{remote_jid}", response_model=List[WhatsAppMessageBase])
def get_whatsapp_messages(remote_jid: str, profile: str = Depends(get_current_user), db: Session = Depends(get_db)):
    """Busca o histórico de mensagens de um contato específico."""
    return db.query(models.WhatsAppMessage).filter(
        models.WhatsAppMessage.remoteJid == remote_jid,
        models.WhatsAppMessage.profile == profile
    ).order_by(models.WhatsAppMessage.timestamp.asc()).limit(100).all()

@app.post("/api/whatsapp/webhook")
async def whatsapp_webhook(payload: dict, profile: str = "default"):
    """
    Recebe eventos da Evolution API.
    A URL do webhook deve ser configurada como: /api/whatsapp/webhook?profile=NOME_DO_PERFIL
    """
    event = payload.get("event")
    db = next(get_db())
    
    if event == "messages.upsert":
        data = payload.get("data", {})
        message = data.get("message", {})
        
        # Ignorar se não tiver mensagem válida (ex: reações, status)
        key = message.get("key", {})
        remote_jid = key.get("remoteJid")
        from_me = 1 if key.get("fromMe") else 0
        
        # Extrair conteúdo de texto (suporta texto simples e conversa)
        msg_content = ""
        m = message.get("message", {})
        if "conversation" in m:
            msg_content = m["conversation"]
        elif "extendedTextMessage" in m:
            msg_content = m["extendedTextMessage"].get("text", "")
        
        if not msg_content or not remote_jid:
            return {"ok": True, "info": "ignored_no_content"}

        # Salvar no Banco
        new_msg = models.WhatsAppMessage(
            profile=profile,
            remoteJid=remote_jid,
            fromMe=from_me,
            content=msg_content,
            pushName=data.get("pushName"),
            timestamp=message.get("messageTimestamp"),
            createdAt=datetime.now().isoformat()
        )
        db.add(new_msg)
        
        # Atualizar Data de Último Contato no CRM se for mensagem recebida (fromMe=0)
        if from_me == 0:
            # Tenta limpar o número para bater com o CRM
            clean_number = remote_jid.split("@")[0].replace("55", "", 1)
            
            cust = db.query(models.Customer).filter(
                models.Customer.profile == profile,
                models.Customer.phone.contains(clean_number[-8:])
            ).first()
            
            if cust:
                cust.lastContactDate = datetime.now().strftime("%Y-%m-%d")
                cust.updatedAt = datetime.now().isoformat()
            else:
                pros = db.query(models.Prospect).filter(
                    models.Prospect.profile == profile,
                    models.Prospect.phone.contains(clean_number[-8:])
                ).first()
                if pros:
                    pros.updatedAt = datetime.now().isoformat()

    return {"ok": True, "info": "ignored_event"}


# --- SISTEMA DE REATIVACÕES E INATIVOS (NOVO) ---

@app.post("/api/reativacoes/upload")
async def upload_reativacoes_excel(
    file: UploadFile = File(...),
    db: Session = Depends(get_db)
):
    """
    Recebe a planilha Excel 'Facilita Vendas' e processa inativos.
    Descarta duplicatas de (VENDEDOR, CÓD.C) e detecta se o cliente é Novo ou Antigo.
    O processamento é otimizado usando Pandas.
    """
    try:
        # Lendo os bytes na memória
        contents = await file.read()
        
        # Carregando dataframe via pandas a partir de bytes lendo apenas colunas necessárias (usecols)
        print("Lendo a planilha BASE FACILITA de forma otimizada...")
        
        # Como as colunas podem variar na caixa de texto, vamos primeiro carregar apenas a primeira linha
        # para mapear os nomes das colunas e então ler com usecols.
        preview_df = pd.read_excel(io.BytesIO(contents), sheet_name="BASE FACILITA", nrows=1)
        
        # Mapeando nomes das colunas reais
        preview_cols = [str(c).strip().upper() for c in preview_df.columns]
        
        # Resolver nomes originais baseados nos mapeamentos esperados
        col_vendedor = preview_df.columns[preview_cols.index('VENDEDOR')] if 'VENDEDOR' in preview_cols else None
        
        col_situacao = None
        for s in ['SITUAÇÃO', 'SITUACAO', 'SITUACAO']:
            if s in preview_cols:
                col_situacao = preview_df.columns[preview_cols.index(s)]
                break
                
        col_codigo = None
        for s in ['CÓD.C', 'COD', 'CODIGO']:
            if s in preview_cols:
                col_codigo = preview_df.columns[preview_cols.index(s)]
                break
                
        col_cliente = None
        for s in ['CLIENTE/FORNEC.', 'CLIENTE', 'FORNECEDOR']:
            if s in preview_cols:
                col_cliente = preview_df.columns[preview_cols.index(s)]
                break
                
        col_regiao = None
        for s in ['REGIÃO', 'REGIAO']:
            if s in preview_cols:
                col_regiao = preview_df.columns[preview_cols.index(s)]
                break
                
        col_cidade = preview_df.columns[preview_cols.index('CIDADE')] if 'CIDADE' in preview_cols else None
        
        if not col_vendedor or not col_situacao or not col_codigo or not col_cliente:
            raise HTTPException(
                status_code=400,
                detail=f"Colunas obrigatórias não encontradas no Excel. Colunas detectadas: {preview_df.columns.tolist()}"
            )
            
        # Carregar colunas mapeadas reais
        usecols_list = [col_vendedor, col_situacao, col_codigo, col_cliente]
        if col_regiao: usecols_list.append(col_regiao)
        if col_cidade: usecols_list.append(col_cidade)
        
        df = pd.read_excel(io.BytesIO(contents), sheet_name="BASE FACILITA", usecols=usecols_list)
        
        # Filtrar apenas linhas onde a situação é 'INATIVO'
        df_inativos = df[df[col_situacao].astype(str).str.upper().str.strip() == 'INATIVO']
        
        # Deduplicar pelo par (VENDEDOR, CÓD.C)
        df_unicos = df_inativos.drop_duplicates(subset=[col_vendedor, col_codigo])
        
        print(f"Total de inativos únicos no lote: {len(df_unicos)}")
        
        import_session_id = datetime.now().isoformat()
        created_at_str = datetime.now().isoformat()
        
        # Carregar todas as referências existentes em um cache local de dicionário
        print("Carregando banco de dados local para cache de memória...")
        existing_refs = {r.id: r for r in db.query(models.InactiveReference).all()}
        
        vendedores_validos = ["MATEUS", "ALBERT", "ALMEIDA", "HUGO", "IGOR", "MACIEL", "FERNANDA", "GABRIEL", "KARINE", "CAIO"]
        
        created_list = []
        created = 0
        updated = 0
        
        for idx, row in df_unicos.iterrows():
            vendedor_raw = str(row[col_vendedor]).strip().upper()
            if vendedor_raw not in vendedores_validos:
                continue
                
            cod_c = str(row[col_codigo]).strip()
            if not cod_c or cod_c == "" or cod_c == "nan":
                continue
                
            cliente_nome = str(row[col_cliente]).strip().upper()
            regiao = str(row[col_regiao]).strip() if col_regiao and pd.notna(row[col_regiao]) else ""
            cidade = str(row[col_cidade]).strip() if col_cidade and pd.notna(row[col_cidade]) else ""
            
            # ID único do inativo
            ref_id = f"ref_{cod_c}_{vendedor_raw}"
            
            # Checar cache na memória
            existing = existing_refs.get(ref_id)
            
            if existing:
                # Já existia! Portanto ele já era inativo na semana passada (Antigo)
                existing.nome_cliente = cliente_nome
                existing.regiao = regiao
                existing.cidade = cidade
                existing.status = "Antigo"
                existing.importSessionId = import_session_id
                updated += 1
            else:
                # Não existia! Portanto ele virou inativo agora (Novo)
                new_ref = models.InactiveReference(
                    id=ref_id,
                    vendedor=vendedor_raw,
                    codigo_cliente=cod_c,
                    nome_cliente=cliente_nome,
                    regiao=regiao,
                    cidade=cidade,
                    status="Novo",
                    importSessionId=import_session_id,
                    createdAt=created_at_str
                )
                created_list.append(new_ref)
                created += 1
                
        # Salvar novos registros em lote
        if created_list:
            db.bulk_save_objects(created_list)
            
        db.commit()
        
        # Limpeza: qualquer cliente inativo cujo importSessionId é diferente do atual
        deleted = db.query(models.InactiveReference).filter(
            models.InactiveReference.importSessionId != import_session_id
        ).delete(synchronize_session=False)
        
        db.commit()
        
        return {
            "ok": True,
            "session_id": import_session_id,
            "novos_inativos": created,
            "inativos_mantidos": updated,
            "inativos_removidos": deleted
        }
        
    except Exception as e:
        print(f"Erro ao processar importação: {traceback.format_exc()}")
        raise HTTPException(status_code=500, detail=f"Erro de processamento: {str(e)}")

@app.get("/api/reativacoes/inativos")
def get_reativacoes_inativos(
    vendedor: str = None,
    status: str = None,
    db: Session = Depends(get_db)
):
    """
    Retorna a lista de inativos de um vendedor específico, filtrando opcionalmente por status (Novo/Antigo).
    """
    query = db.query(models.InactiveReference)
    if vendedor:
        query = query.filter(models.InactiveReference.vendedor == vendedor.upper().strip())
    if status:
        query = query.filter(models.InactiveReference.status == status)
    return query.order_by(models.InactiveReference.nome_cliente.asc()).all()

@app.post("/api/reativacoes/registrar")
def registrar_reativacao(
    payload: dict,
    db: Session = Depends(get_db)
):
    """
    Registra uma nova venda de reativação e valida na hora se ela está na lista de inativos do vendedor.
    Gera automaticamente a tarefa de checklist de segunda-feira.
    """
    vendedor = str(payload.get("vendedor")).strip().upper()
    cliente_nome = str(payload.get("cliente_nome")).strip().upper()
    valor = float(payload.get("valor_venda") or 0.0)
    data_venda = str(payload.get("data_venda"))
    data_faturamento = str(payload.get("data_faturamento"))
    
    # 1. Validar se o cliente está na lista de inativos do vendedor
    ref = db.query(models.InactiveReference).filter(
        models.InactiveReference.vendedor == vendedor,
        models.InactiveReference.nome_cliente == cliente_nome
    ).first()
    
    if not ref:
        # Tenta buscar por substring
        ref = db.query(models.InactiveReference).filter(
            models.InactiveReference.vendedor == vendedor,
            models.InactiveReference.nome_cliente.contains(cliente_nome)
        ).first()
        
    status_val = "Valida" if ref else "Invalida"
    
    # 2. Calcular a data limite de check (próxima segunda-feira)
    hoje = datetime.now()
    dias_para_segunda = 7 - hoje.weekday() if hoje.weekday() < 7 else 1
    if hoje.weekday() == 0:  # Segunda-feira
        dias_para_segunda = 7
    data_limite = (hoje + timedelta(days=dias_para_segunda)).strftime("%Y-%m-%d")
    
    react_id = f"react_{datetime.now().timestamp()}_{secrets.token_hex(2)}"
    
    new_react = models.Reactivation(
        id=react_id,
        vendedor=vendedor,
        cliente_nome=cliente_nome,
        valor_venda=valor,
        data_venda=data_venda,
        data_faturamento=data_faturamento,
        status_validacao=status_val,
        visto_segunda=0,
        data_limite_check=data_limite,
        alerta_atraso=0,
        createdAt=datetime.now().isoformat()
    )
    
    db.add(new_react)
    db.commit()
    
    return {
        "ok": True,
        "id": react_id,
        "status_validacao": status_val,
        "data_limite_check": data_limite
    }

@app.get("/api/reativacoes/checklist")
def get_reativacoes_checklist(
    vendedor: str,
    db: Session = Depends(get_db)
):
    """
    Retorna os checklists pendentes de um vendedor.
    Atualiza dinamicamente os alertas de atraso se a data limite passou e o vendedor não deu o visto.
    """
    vendedor = vendedor.strip().upper()
    hoje_str = datetime.now().strftime("%Y-%m-%d")
    
    items = db.query(models.Reactivation).filter(
        models.Reactivation.vendedor == vendedor,
        models.Reactivation.visto_segunda == 0
    ).all()
    
    updated = False
    for item in items:
        if item.data_limite_check < hoje_str and item.alerta_atraso == 0:
            item.alerta_atraso = 1
            updated = True
            
    if updated:
        db.commit()
        
    return items

@app.post("/api/reativacoes/{react_id}/visto")
def checklist_visto(
    react_id: str,
    db: Session = Depends(get_db)
):
    """
    Dá o visto na segunda-feira em uma reativação, finalizando a tarefa.
    """
    item = db.query(models.Reactivation).filter(models.Reactivation.id == react_id).first()
    if not item:
        raise HTTPException(status_code=404, detail="Item de reativação não encontrado")
        
    item.visto_segunda = 1
    item.alerta_atraso = 0
    item.updatedAt = datetime.now().isoformat()
    db.commit()
    
    return {"ok": True}

@app.get("/api/reativacoes/lista")
def get_reativacoes_lista(
    vendedor: str = None,
    db: Session = Depends(get_db)
):
    """
    Retorna o histórico de todas as reativações registradas.
    """
    query = db.query(models.Reactivation)
    if vendedor:
        query = query.filter(models.Reactivation.vendedor == vendedor.strip().upper())
    return query.order_by(models.Reactivation.createdAt.desc()).all()


from fastapi.staticfiles import StaticFiles
import os

frontend_path = os.path.join(os.path.dirname(__file__), "frontend")
if os.path.exists(frontend_path):
    app.mount("/", StaticFiles(directory=frontend_path, html=True), name="frontend")
