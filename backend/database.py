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
    SQLALCHEMY_DATABASE_URL = "postgresql://postgres.xpjhpskjetpcglkxdjag:cEnpi0-hunnec-hizzip@aws-1-us-east-2.pooler.supabase.com:6543/postgres?sslmode=require"

# Conexão resiliente: tenta Supabase PostgreSQL com timeout curto para não travar o startup
try:
    engine = create_engine(
        SQLALCHEMY_DATABASE_URL, 
        pool_pre_ping=True,
        pool_size=3,
        max_overflow=5,
        pool_timeout=3,
        connect_args={
            "connect_timeout": 3,
            "options": "-c statement_timeout=3000"
        }
    )
    with engine.connect() as conn:
        print("[DB] Conectado ao Supabase PostgreSQL com sucesso!")
except Exception as e:
    print(f"[DB Warning] Supabase indisponível na rede local ({type(e).__name__}). Ativando SQLite de fallback local...")
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
