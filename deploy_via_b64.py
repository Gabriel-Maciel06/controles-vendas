import subprocess
import os
import sys

# Diretório base
project_dir = "/Users/gabrieloliveira/Desktop/Agentes-cloud/agentes-cloud-main/projects/controles-vendas"
b64_file = os.path.join(project_dir, "update_react.tar.gz.b64")

if not os.path.exists(b64_file):
    print(f"Erro: Arquivo {b64_file} não encontrado!")
    sys.exit(1)

# Ler conteúdo base64
with open(b64_file, "r") as f:
    b64_content = f.read().strip()

print(f"Lido base64 ({len(b64_content)} caracteres).")

# Montar script shell que será executado na VM
vm_script = f"""#!/bin/bash
echo "=== INICIANDO DEPLOY VIA BASE64 NA VM ==="

# 1. Salvar base64
cat << 'EOF' > /home/azureuser/update_react.tar.gz.b64
{b64_content}
EOF

# 2. Decodificar
echo "Decodificando tarball..."
base64 -d /home/azureuser/update_react.tar.gz.b64 > /home/azureuser/update_react.tar.gz

# 3. Extrair arquivos
echo "Extraindo arquivos no diretório /home/azureuser..."
cd /home/azureuser
tar -xzf update_react.tar.gz

# 4. Limpar temporários
rm /home/azureuser/update_react.tar.gz.b64 /home/azureuser/update_react.tar.gz

# 5. Parar, compilar e subir no docker-compose
echo "Reconstruindo containers no docker..."
docker-compose down
docker-compose build backend
docker-compose up -d

echo "=== DEPLOY EXECUTADO COM SUCESSO NA VM! ==="
"""

# Salvar temporariamente o script que será enviado
temp_script_path = os.path.join(project_dir, "temp_vm_deploy.sh")
with open(temp_script_path, "w") as f:
    f.write(vm_script)

print(f"Script temporário gerado em {temp_script_path}.")

# Chamar a CLI do Azure passando o script temporário
print("Disparando comando az vm run-command...")
try:
    cmd = [
        "az", "vm", "run-command", "invoke",
        "-g", "isapel-crm-rg",
        "-n", "isapel-backend-vm",
        "--command-id", "RunShellScript",
        "--scripts", f"@{temp_script_path}"
    ]
    
    # Executa de forma síncrona para capturar retorno
    result = subprocess.run(cmd, capture_output=True, text=True, check=True)
    print("Resultado do deploy:")
    print(result.stdout)
    
except subprocess.CalledProcessError as e:
    print("ERRO ao executar comando az:", e)
    print("Stdout:", e.stdout)
    print("Stderr:", e.stderr)
finally:
    # Limpar arquivo temporário local
    if os.path.exists(temp_script_path):
        os.remove(temp_script_path)
