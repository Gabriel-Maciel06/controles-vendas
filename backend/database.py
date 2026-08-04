from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
import os

# Database configuration
SQLALCHEMY_DATABASE_URL = os.getenv("DATABASE_URL")

if SQLALCHEMY_DATABASE_URL and SQLALCHEMY_DATABASE_URL.startswith("postgres://"):
    # Fix for SQLAlchemy/Heroku/Render postgres prefix issue
    SQLALCHEMY_DATABASE_URL = SQLALCHEMY_DATABASE_URL.replace("postgres://", "postgresql://", 1)

if not SQLALCHEMY_DATABASE_URL:
    SQLALCHEMY_DATABASE_URL = "postgresql://postgres.xpjhpskjetpcglkxdjag:cEnpi0-hunnec-hizzip@aws-1-us-east-2.pooler.supabase.com:6543/postgres"

# Conexão resiliente: tenta Supabase PostgreSQL e usa SQLite local de fallback se a rede local bloquear o pooler
try:
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, 
        connect_args={"connect_timeout": 3},
        pool_pre_ping=True,
        pool_size=5,
        max_overflow=10,
        pool_timeout=5,
    )
    with engine.connect() as conn:
        print("[DB] Conectado ao Supabase PostgreSQL com sucesso!")
except Exception as e:
    print(f"[DB Warning] Supabase indisponível na rede local ({e}). Ativando SQLite de fallback local...")
    SQLALCHEMY_DATABASE_URL = "sqlite:///./crm.db"
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL,
        connect_args={"check_same_thread": False}
    )

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
