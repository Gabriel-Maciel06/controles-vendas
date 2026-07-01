#!/bin/bash
# Script de deploy para a VM do Azure - Sistema de Reativações Isapel

echo "=== INICIANDO DEPLOY DE ARQUIVOS NA VM ==="

# 1. Garantir que as pastas existam
mkdir -p /home/azureuser/backend/frontend/css
mkdir -p /home/azureuser/backend/frontend/js

# 2. Escrever requirements.txt
echo "Escrevendo requirements.txt..."
cat << 'REQ_EOF' > /home/azureuser/backend/requirements.txt
fastapi==0.111.0
uvicorn
gunicorn
sqlalchemy
pydantic==1.10.17
python-dotenv
psycopg2-binary
httpx
pandas
openpyxl
REQ_EOF

# 3. Escrever models.py
echo "Escrevendo models.py..."
cat << 'MODELS_EOF' > /home/azureuser/backend/models.py
from sqlalchemy import Column, Integer, String, Float, ForeignKey, DateTime
from sqlalchemy.orm import relationship
from database import Base

class Sale(Base):
    __tablename__ = "sales"

    id = Column(String, primary_key=True, index=True)
    profile = Column(String, default="default")
    client = Column(String)
    productName = Column(String, nullable=True)
    costPrice = Column(Float, nullable=True)
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
    company = Column(String, nullable=True)
    phone = Column(String, nullable=True)
    email = Column(String, nullable=True)
    address = Column(String, nullable=True)
    cnpj = Column(String, nullable=True)
    instagram = Column(String, nullable=True)
    segment = Column(String, nullable=True)
    status = Column(String, default="Ativo")
    lastContactDate = Column(String, nullable=True)
    nextFollowUp = Column(String, nullable=True)
    notes = Column(String, nullable=True)
    products = Column(String, nullable=True)
    buyerName = Column(String, nullable=True)
    source = Column(String, nullable=True)
    origin = Column(String, nullable=True)
    temperature = Column(String, nullable=True)
    region = Column(String, nullable=True)
    city = Column(String, nullable=True)
    createdAt = Column(String)
    updatedAt = Column(String, nullable=True)

class Sample(Base):
    __tablename__ = "samples"

    id = Column(String, primary_key=True, index=True)
    profile = Column(String, default="default")
    client = Column(String)
    product = Column(String, default="Envelope completo")
    trackingCode = Column(String, nullable=True)
    sendDate = Column(String)
    estimatedReturn = Column(String)
    notes = Column(String, nullable=True)
    status = Column(String)
    trackingLastEvent = Column(String, nullable=True)
    trackingUpdatedAt = Column(String, nullable=True)
    createdAt = Column(String)
    updatedAt = Column(String, nullable=True)

class Setting(Base):
    __tablename__ = "settings"

    id = Column(Integer, primary_key=True, index=True)
    profile = Column(String, default="default")
    google = Column(Float, default=100)
    reativacao = Column(Float, default=100)
    introducao = Column(Float, default=25)
    crm_monthly_goal = Column(Float, default=0)
    crm_contact_goal = Column(Float, default=30)

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

class Prospect(Base):
    __tablename__ = "prospects"

    id = Column(String, primary_key=True, index=True)
    profile = Column(String, default="default")
    razaoSocial = Column(String)
    cnpj = Column(String, nullable=True)
    phone = Column(String)
    city = Column(String)
    region = Column(String)
    porte = Column(String)
    instagram = Column(String, nullable=True)
    notes = Column(String, nullable=True)
    status = Column(String, default="Novo")
    crmCustomerId = Column(String, nullable=True)
    sentToCrmAt = Column(String, nullable=True)
    createdAt = Column(String)
    updatedAt = Column(String, nullable=True)

class WhatsAppMessage(Base):
    __tablename__ = "whatsapp_messages"

    id = Column(Integer, primary_key=True, index=True, autoincrement=True)
    profile = Column(String, default="default")
    remoteJid = Column(String, index=True) # ID do WhatsApp (ex: 55119... @s.whatsapp.net)
    fromMe = Column(Integer, default=0) # 1 se eu enviei, 0 se recebi
    content = Column(String)
    pushName = Column(String, nullable=True) # Nome que aparece no WhatsApp
    timestamp = Column(Integer)
    createdAt = Column(String)

class InactiveReference(Base):
    __tablename__ = "inactive_references"

    id = Column(String, primary_key=True, index=True)
    vendedor = Column(String, index=True)
    codigo_cliente = Column(String, index=True)
    nome_cliente = Column(String)
    regiao = Column(String, nullable=True)
    cidade = Column(String, nullable=True)
    status = Column(String, default="Novo") # "Novo" ou "Antigo"
    importSessionId = Column(String)
    createdAt = Column(String)

class Reactivation(Base):
    __tablename__ = "reactivations"

    id = Column(String, primary_key=True, index=True)
    vendedor = Column(String, index=True)
    cliente_nome = Column(String)
    valor_venda = Column(Float)
    data_venda = Column(String)
    data_faturamento = Column(String)
    status_validacao = Column(String) # "Valida" ou "Invalida"
    visto_segunda = Column(Integer, default=0) # 0 = False, 1 = True
    data_limite_check = Column(String)
    alerta_atraso = Column(Integer, default=0) # 0 = False, 1 = True
    createdAt = Column(String)
    updatedAt = Column(String, nullable=True)
MODELS_EOF

# 4. Escrever index.html
echo "Escrevendo index.html..."
cat << 'INDEX_EOF' > /home/azureuser/backend/frontend/index.html
$(cat backend/frontend/index.html)
INDEX_EOF

# 5. Escrever reactivations.html
echo "Escrevendo reactivations.html..."
cat << 'HTML_EOF' > /home/azureuser/backend/frontend/reactivations.html
$(cat backend/frontend/reactivations.html)
HTML_EOF

# 6. Escrever css/reactivations.css
echo "Escrevendo reactivations.css..."
cat << 'CSS_EOF' > /home/azureuser/backend/frontend/css/reactivations.css
$(cat backend/frontend/css/reactivations.css)
CSS_EOF

# 7. Escrever js/reactivations.js
echo "Escrevendo reactivations.js..."
cat << 'JS_EOF' > /home/azureuser/backend/frontend/js/reactivations.js
$(cat backend/frontend/js/reactivations.js)
JS_EOF

# 8. Atualizar main.py
echo "Escrevendo main.py..."
cat << 'MAIN_EOF' > /home/azureuser/backend/main.py
$(cat backend/main.py)
MAIN_EOF

# 9. Rodar o rebuild do Docker Compose
echo "Reconstruindo container do backend no Docker..."
cd /home/azureuser
sudo docker-compose build backend
sudo docker-compose up -d backend

echo "=== DEPLOY CONCLUÍDO COM SUCESSO! ==="
