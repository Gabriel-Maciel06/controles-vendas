import os
import httpx
import traceback
import hashlib
import hmac
import secrets
from typing import List, Dict, Any
from datetime import datetime
from fastapi import FastAPI, Depends, HTTPException
from fastapi.responses import JSONResponse
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import text
from sqlalchemy.orm import Session
from pydantic import BaseModel
import models
from database import engine, get_db

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
    password: str

@app.post("/api/login")
def login(req: LoginRequest):
    password = req.password.strip()
    from auth import create_token

    # Lê as senhas APENAS das variáveis de ambiente enviadas pelo Render
    profiles = [
        { "env": "APP_PASSWORD_DEFAULT",  "profile": "default"  },
        { "env": "APP_PASSWORD_MAMAE",    "profile": "mamae"    },
        { "env": "APP_PASSWORD_KARINE",   "profile": "karine"   },
        { "env": "APP_PASSWORD_CAIO",     "profile": "caio"     },
        { "env": "APP_PASSWORD_FERNANDA", "profile": "fernanda" },
        { "env": "APP_PASSWORD_MATEUS",   "profile": "mateus", "fallback": "Mateus1234" },
    ]

    for p in profiles:
        pw = os.getenv(p["env"]) or p.get("fallback")
        if pw and hmac.compare_digest(password, pw):
            token = create_token(p["profile"])
            return {"ok": True, "profile": p["profile"], "token": token}

    raise HTTPException(status_code=401, detail="Senha incorreta ou perfil não configurado")

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
    city: str = None
    createdAt: str
    updatedAt: str = None

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
    updatedAt: str = None

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

class ImportFacilitaReq(BaseModel):
    customers: List[CustomerBase] = []
    prospects: List[ProspectBase] = []
    profile: str = "default"

from auth import get_current_user

# --- API Endpoints ---

@app.post("/api/ai/proxy")
async def ai_proxy(payload: dict, profile: str = Depends(get_current_user)):
    """
    Proxy de segurança para a API do Claude (Anthropic).
    Oculta a chave da API do frontend e centraliza as chamadas.
    """
    claude_key = os.getenv("CLAUDE_API_KEY")
    if not claude_key:
        raise HTTPException(status_code=500, detail="Claude API Key não configurada no servidor.")
    
    # Extrair campos do payload do frontend
    model = payload.get("model", "claude-3-haiku-20240307")
    messages = payload.get("messages", [])
    max_tokens = payload.get("max_tokens", 800)
    system = payload.get("system", "Você é um assistente útil.")
    
    url = "https://api.anthropic.com/v1/messages"
    headers = {
        "x-api-key": claude_key,
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

@app.get("/")
def read_root():
    return {"status": "Isapel CRM API Online", "version": "2.1.0"}

# --- SALES ---
@app.get("/api/sales", response_model=List[SaleBase])
def get_sales(profile: str = Depends(get_current_user), db: Session = Depends(get_db)):
    return db.query(models.Sale).filter(models.Sale.profile == profile).all()

@app.post("/api/sales", response_model=SaleBase)
def create_sale(sale: SaleBase, profile: str = Depends(get_current_user), db: Session = Depends(get_db)):
    # Normalizar Nome do Cliente para evitar duplicidade (Espaços/Caixa)
    sale.client = sale.client.strip().upper()
    db_sale = models.Sale(**sale.dict())
    db.add(db_sale)

    # Auto-cria cliente ativo ou atualiza se já existir (pelo nome normalizado)
    db_cust = db.query(models.Customer).filter(
        models.Customer.name == sale.client,
        models.Customer.profile == sale.profile
    ).first()
    
    if db_cust:
        db_cust.status = "Ativo"
        db_cust.temperature = "Pós venda"
        db_cust.updatedAt = sale.createdAt
    else:
        new_cust = models.Customer(
            id=f"cli_auto_{sale.id}",
            profile=sale.profile,
            name=sale.client,
            status="Ativo",
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
    
    for key, value in sale.dict(exclude_unset=True).items():
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
    return db.query(models.Customer).filter(models.Customer.profile == profile).all()

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
