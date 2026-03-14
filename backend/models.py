from sqlalchemy import Column, Integer, String, Float
from database import Base

class Sale(Base):
    __tablename__ = "sales"

    id = Column(String, primary_key=True, index=True)
    profile = Column(String, default="default")
    client = Column(String)
    type = Column(String)
    boxes20056 = Column(Integer)
    saleDate = Column(String)
    invoiceDate = Column(String)
    value = Column(Float)
    commission = Column(Float)
    createdAt = Column(String)
    updatedAt = Column(String, nullable=True)

class Customer(Base):
    __tablename__ = "customers"

    id = Column(String, primary_key=True, index=True)
    profile = Column(String, default="default")
    name = Column(String)
    company = Column(String)
    phone = Column(String)
    email = Column(String, nullable=True)
    address = Column(String, nullable=True)
    cnpj = Column(String, nullable=True)
    instagram = Column(String, nullable=True)
    segment = Column(String, nullable=True)
    status = Column(String)
    lastContactDate = Column(String)
    nextFollowUp = Column(String)
    notes = Column(String, nullable=True)
    products = Column(String, nullable=True)
    buyerName = Column(String, nullable=True)
    source = Column(String, nullable=True)
    createdAt = Column(String)
    updatedAt = Column(String, nullable=True)

class Sample(Base):
    __tablename__ = "samples"

    id = Column(String, primary_key=True, index=True)
    profile = Column(String, default="default")
    client = Column(String)
    product = Column(String)
    sendDate = Column(String)
    estimatedReturn = Column(String)
    status = Column(String)
    createdAt = Column(String)
    updatedAt = Column(String, nullable=True)

class Setting(Base):
    __tablename__ = "settings"

    id = Column(String, primary_key=True, index=True) # Always "1"
    profile = Column(String, default="default")
    key = Column(String)
    value = Column(String)

class Reminder(Base):
    __tablename__ = "reminders"

    id = Column(String, primary_key=True, index=True)
    profile = Column(String, default="default")
    title = Column(String)
    dateLimit = Column(String)
    timeLimit = Column(String, nullable=True)
    priority = Column(String)
    status = Column(String)
    createdAt = Column(String)
    updatedAt = Column(String, nullable=True)
