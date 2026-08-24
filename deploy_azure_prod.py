import subprocess, os, sys

b64_file = "/tmp/prod_clean.tar.gz.b64"

if not os.path.exists(b64_file):
    print("Erro: Arquivo base64 não encontrado!")
    sys.exit(1)

with open(b64_file, "r") as f:
    b64_content = f.read().strip()

print(f"Lido pacote base64 ({len(b64_content)} caracteres).")

vm_script = f"""#!/bin/bash
set -e
echo "=== INICIANDO DEPLOY NA VM DO AZURE (57.156.33.102) ==="

mkdir -p /home/admlnx/isapel-crm
cd /home/admlnx/isapel-crm

cat << 'EOF' > /tmp/prod_clean.tar.gz.b64
{b64_content}
EOF

echo "Decodificando e extraindo arquivos..."
base64 -d /tmp/prod_clean.tar.gz.b64 > /tmp/prod_clean.tar.gz
tar -xzf /tmp/prod_clean.tar.gz -C /home/admlnx/isapel-crm/
rm -f /tmp/prod_clean.tar.gz.b64 /tmp/prod_clean.tar.gz

echo "Reconstruindo e iniciando container Docker..."
cd /home/admlnx/isapel-crm
docker-compose down || true
docker-compose up -d --build

echo "Verificando status dos containers..."
docker ps

echo "=== DEPLOY EM PRODUCAO FINALIZADO COM SUCESSO! ==="
"""

temp_script = "/tmp/run_prod_deploy.sh"
with open(temp_script, "w") as f:
    f.write(vm_script)

print("Disparando comando de deploy na VM do Azure...")
cmd = [
    "az", "vm", "run-command", "invoke",
    "-g", "RG-LINUX-FREE",
    "-n", "vm-linux-free",
    "--command-id", "RunShellScript",
    "--scripts", f"@{temp_script}"
]

try:
    res = subprocess.run(cmd, capture_output=True, text=True, check=True)
    print("Resultado:")
    print(res.stdout)
except subprocess.CalledProcessError as e:
    print("Erro no deploy:", e)
    print("Stdout:", e.stdout)
    print("Stderr:", e.stderr)
finally:
    if os.path.exists(temp_script):
        os.remove(temp_script)
