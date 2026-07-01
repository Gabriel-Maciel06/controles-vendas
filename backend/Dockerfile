FROM python:3.11.9-slim

# Definir o diretório de trabalho no container
WORKDIR /app

# Instalar dependências do sistema para o PostgreSQL (psycopg2)
RUN apt-get update && apt-get install -y \
    gcc \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copiar os arquivos de requisitos e instalar dependências
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copiar todo o código do backend
COPY . .

# Expor a porta que a aplicação vai rodar
EXPOSE 8000

# Comando para iniciar a aplicação usando Gunicorn com Uvicorn workers
CMD ["gunicorn", "main:app", "--workers", "2", "--worker-class", "uvicorn.workers.UvicornWorker", "--bind", "0.0.0.0:8000"]
