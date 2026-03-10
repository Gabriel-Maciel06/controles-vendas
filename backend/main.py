from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from typing import List, Dict, Any
from pydantic import BaseModel

import models
from database import engine, get_db

# Create all database tables
models.Base.metadata.create_all(bind=engine)

app = FastAPI(title="Controle Vendas Maciel API")

# Configure CORS so the local HTML file can talk to the API
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Allow all for now during dev
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# --- Pydantic Schemas for Validation ---
class SaleBase(BaseModel):
    id: str
    client: str
    type: str
    boxes20056: int = 0
    saleDate: str
    invoiceDate: str
    value: float
    commission: float
    createdAt: str
    updatedAt: str = None

class CustomerBase(BaseModel):
    id: str
    name: str
    company: str
    phone: str
    email: str = None
    address: str = None
    cnpj: str = None
    instagram: str = None
    segment: str = None
    status: str
    lastContactDate: str
    nextFollowUp: str
    notes: str = None
    createdAt: str
    updatedAt: str = None

class SampleBase(BaseModel):
    id: str
    client: str
    product: str
    sendDate: str
    estimatedReturn: str
    status: str
    createdAt: str
    updatedAt: str = None

class ReminderBase(BaseModel):
    id: str
    title: str
    dateLimit: str
    timeLimit: str = None
    priority: str
    status: str
    createdAt: str
    updatedAt: str = None

class SettingBase(BaseModel):
    google: float = 100
    reativacao: float = 100
    introducao: float = 25

# --- API Endpoints ---

@app.get("/")
def read_root():
    return {"message": "Bem-vindo a API do Controle Vendas Maciel"}

# --- SALES ---
@app.get("/api/sales", response_model=List[SaleBase])
def get_sales(db: Session = Depends(get_db)):
    return db.query(models.Sale).all()

@app.post("/api/sales", response_model=SaleBase)
def create_sale(sale: SaleBase, db: Session = Depends(get_db)):
    db_sale = models.Sale(**sale.dict())
    db.add(db_sale)
    db.commit()
    db.refresh(db_sale)
    return db_sale

@app.put("/api/sales/{sale_id}", response_model=SaleBase)
def update_sale(sale_id: str, sale: dict, db: Session = Depends(get_db)):
    db_sale = db.query(models.Sale).filter(models.Sale.id == sale_id).first()
    if not db_sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    
    for key, value in sale.items():
        setattr(db_sale, key, value)
    
    db.commit()
    db.refresh(db_sale)
    return db_sale

@app.delete("/api/sales/{sale_id}")
def delete_sale(sale_id: str, db: Session = Depends(get_db)):
    db_sale = db.query(models.Sale).filter(models.Sale.id == sale_id).first()
    if not db_sale:
        raise HTTPException(status_code=404, detail="Sale not found")
    db.delete(db_sale)
    db.commit()
    return {"ok": True}

# --- CUSTOMERS ---
@app.get("/api/customers", response_model=List[CustomerBase])
def get_customers(db: Session = Depends(get_db)):
    return db.query(models.Customer).all()

@app.post("/api/customers", response_model=CustomerBase)
def create_customer(customer: CustomerBase, db: Session = Depends(get_db)):
    db_customer = models.Customer(**customer.dict())
    db.add(db_customer)
    db.commit()
    db.refresh(db_customer)
    return db_customer

@app.put("/api/customers/{customer_id}", response_model=CustomerBase)
def update_customer(customer_id: str, customer: dict, db: Session = Depends(get_db)):
    db_customer = db.query(models.Customer).filter(models.Customer.id == customer_id).first()
    if not db_customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    
    for key, value in customer.items():
        setattr(db_customer, key, value)
    
    db.commit()
    db.refresh(db_customer)
    return db_customer

@app.delete("/api/customers/{customer_id}")
def delete_customer(customer_id: str, db: Session = Depends(get_db)):
    db_customer = db.query(models.Customer).filter(models.Customer.id == customer_id).first()
    if not db_customer:
        raise HTTPException(status_code=404, detail="Customer not found")
    db.delete(db_customer)
    db.commit()
    return {"ok": True}

# --- SAMPLES ---
@app.get("/api/samples", response_model=List[SampleBase])
def get_samples(db: Session = Depends(get_db)):
    return db.query(models.Sample).all()

@app.post("/api/samples", response_model=SampleBase)
def create_sample(sample: SampleBase, db: Session = Depends(get_db)):
    db_sample = models.Sample(**sample.dict())
    db.add(db_sample)
    db.commit()
    db.refresh(db_sample)
    return db_sample

@app.put("/api/samples/{sample_id}", response_model=SampleBase)
def update_sample(sample_id: str, sample: dict, db: Session = Depends(get_db)):
    db_sample = db.query(models.Sample).filter(models.Sample.id == sample_id).first()
    if not db_sample:
        raise HTTPException(status_code=404, detail="Sample not found")
    
    for key, value in sample.items():
        setattr(db_sample, key, value)
    
    db.commit()
    db.refresh(db_sample)
    return db_sample

@app.delete("/api/samples/{sample_id}")
def delete_sample(sample_id: str, db: Session = Depends(get_db)):
    db_sample = db.query(models.Sample).filter(models.Sample.id == sample_id).first()
    if not db_sample:
        raise HTTPException(status_code=404, detail="Sample not found")
    db.delete(db_sample)
    db.commit()
    return {"ok": True}

# --- REMINDERS ---
@app.get("/api/reminders", response_model=List[ReminderBase])
def get_reminders(db: Session = Depends(get_db)):
    return db.query(models.Reminder).all()

@app.post("/api/reminders", response_model=ReminderBase)
def create_reminder(reminder: ReminderBase, db: Session = Depends(get_db)):
    db_reminder = models.Reminder(**reminder.dict())
    db.add(db_reminder)
    db.commit()
    db.refresh(db_reminder)
    return db_reminder

@app.put("/api/reminders/{reminder_id}", response_model=ReminderBase)
def update_reminder(reminder_id: str, reminder: dict, db: Session = Depends(get_db)):
    db_reminder = db.query(models.Reminder).filter(models.Reminder.id == reminder_id).first()
    if not db_reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")
    
    for key, value in reminder.items():
        setattr(db_reminder, key, value)
    
    db.commit()
    db.refresh(db_reminder)
    return db_reminder

@app.delete("/api/reminders/{reminder_id}")
def delete_reminder(reminder_id: str, db: Session = Depends(get_db)):
    db_reminder = db.query(models.Reminder).filter(models.Reminder.id == reminder_id).first()
    if not db_reminder:
        raise HTTPException(status_code=404, detail="Reminder not found")
    db.delete(db_reminder)
    db.commit()
    return {"ok": True}

# --- SETTINGS ---
@app.get("/api/settings", response_model=SettingBase)
def get_settings(db: Session = Depends(get_db)):
    # Simple key-value store in db
    settings = db.query(models.Setting).all()
    result = SettingBase().dict() # defaults
    for s in settings:
        if s.key in result:
            result[s.key] = float(s.value) if "." in s.value or s.value.isdigit() else s.value
    return result

@app.post("/api/settings")
def save_settings(settings: dict, db: Session = Depends(get_db)):
    # Clear old
    db.query(models.Setting).delete()
    
    # Save new
    for k, v in settings.items():
        db_setting = models.Setting(id=k, key=k, value=str(v))
        db.add(db_setting)
    
    db.commit()
    return {"ok": True}
