az vm run-command invoke -g isapel-crm-rg -n isapel-backend-vm --command-id RunShellScript --scripts "cat << 'AUTH_EOF' > /home/azureuser/backend/auth.py
$(cat backend/auth.py)
AUTH_EOF
cat << 'DATA_EOF' > /home/azureuser/backend/frontend/js/data.js
$(cat backend/frontend/js/data.js)
DATA_EOF
cd /home/azureuser
docker-compose build backend
docker-compose up -d backend
"
