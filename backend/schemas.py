from pydantic import BaseModel
from typing import Optional
from datetime import datetime

# --- Sales ---
class SaleBase(BaseModel):
    client: str
    type: str
    boxes20056: int
    sale_date: str
    invoice_date: str
    value: float
    commission: float

class SaleCreate(SaleBase):
    pass

class Sale(SaleBase):
    id: int
    created_at: datetime

    class Config:
        orm_mode = True

# --- Contacts / CRM ---
class ContactBase(BaseModel):
    client: str
    contact_date: str
    notes: str
    next_follow_up: str
    type: str

class ContactCreate(ContactBase):
    pass

class Contact(ContactBase):
    id: int
    created_at: datetime

    class Config:
        orm_mode = True

# --- Samples ---
class SampleBase(BaseModel):
    client: str
    product: str
    sent_date: str
    estimated_return: str
    status: str

class SampleCreate(SampleBase):
    pass

class SampleUpdate(BaseModel):
    status: str

class Sample(SampleBase):
    id: int
    created_at: datetime

    class Config:
        orm_mode = True
