# 📊 Controle de Vendas Isapel

Sistema completo de CRM e controle de vendas para a empresa Isapel. Desenvolvido com HTML + Vanilla JS no frontend e FastAPI (Python) no backend, com banco de dados PostgreSQL na nuvem.

---

## 🌐 Links do Projeto

| Serviço | URL |
|---|---|
| **Frontend (Vercel)** | https://controles-vendas.vercel.app |
| **Backend API (Render)** | https://controles-vendas.onrender.com |
| **Repositório GitHub** | https://github.com/Gabriel-Maciel06/controles-vendas |

---

## 🏗️ Arquitetura

```
controles-vendas/
├── index.html              # App principal (SPA)
├── css/
│   └── style.css           # Estilos globais (dark mode + glassmorphism)
├── js/
│   ├── data.js             # DataStore — cache local + sync com API
│   ├── app.js              # AppModule — auth, navegação, perfis
│   ├── dashboard.js        # KPIs, gráficos, mapa de prospecção
│   ├── sales.js            # CRUD de vendas
│   ├── crm.js              # CRM — gestão de clientes, kanban
│   ├── samples.js          # Controle de amostras enviadas
│   ├── reminders.js        # Lembretes e tarefas
│   ├── analytics.js        # Inteligência de vendas e funil
│   ├── prospec.js          # Módulo de prospecção (Maps)
│   ├── kanban.js           # Funil de vendas visual (Kanban)
│   ├── calendar.js         # Calendário de follow-ups
│   ├── import.js           # Importação do sistema Facilita
│   ├── whatsapp.js         # Integração WhatsApp (wa.me)
│   ├── whatsapp-analyzer.js# Análise de conversas WhatsApp
│   ├── ai-suggestions.js   # Sugestões de IA via Claude
│   └── samples.js          # Gestão de amostras
├── backend/
│   ├── main.py             # FastAPI — todos os endpoints
│   ├── models.py           # Modelos SQLAlchemy (tabelas)
│   ├── auth.py             # Autenticação por token Bearer
│   ├── database.py         # Configuração PostgreSQL/SQLite
│   ├── schemas.py          # Pydantic schemas
│   └── requirements.txt    # Dependências Python
├── render.yaml             # Configuração de deploy no Render
└── requirements.txt        # Dependências raiz
```

---

## 🔐 Autenticação

O sistema usa **senhas por perfil** configuradas como variáveis de ambiente no Render. Cada usuário tem acesso apenas aos próprios dados.

### Perfis de Acesso

| Perfil | Env Var | Acesso |
|---|---|---|
| `default` | `APP_PASSWORD_DEFAULT` | Vendedor principal Maciel |
| `mamae` | `APP_PASSWORD_MAMAE` | Gestão (modo vinhos) |
| `karine` | `APP_PASSWORD_KARINE` | Comercial |
| `caio` | `APP_PASSWORD_CAIO` | Comercial |
| `fernanda` | `APP_PASSWORD_FERNANDA` | Comercial |
| `mateus` | `APP_PASSWORD_MATEUS` | Gerente (fallback: `Mateus1234`) |

### Fluxo de Autenticação

1. Usuário digita a senha na tela de login
2. `POST /api/login` → retorna `token` + `profile`
3. Token salvo em `sessionStorage` como `maciel_token`
4. Todas as requisições incluem `Authorization: Bearer <token>`
5. Se servidor reinicia → token invalida → `fetchWithAuth` renova automaticamente usando senha em cache (`_maciel_session_key`)

---

## 📡 API — Endpoints Principais

**Base URL:** `https://controles-vendas.onrender.com/api`

| Método | Endpoint | Descrição |
|---|---|---|
| POST | `/login` | Autenticação |
| GET/POST | `/sales` | Vendas |
| PUT/DELETE | `/sales/{id}` | Editar/Excluir venda |
| GET/POST | `/customers` | Clientes CRM |
| PUT/DELETE | `/customers/{id}` | Editar/Excluir cliente |
| GET/POST | `/samples` | Amostras |
| GET | `/samples/{id}/track` | Rastrear amostra (Correios) |
| POST | `/samples/track-all` | Rastrear todas ativas |
| GET/POST | `/reminders` | Lembretes |
| GET/POST | `/settings` | Configurações por perfil |
| GET/POST | `/prospects` | Prospecções |
| POST | `/prospects/{id}/send-to-crm` | Enviar prospect → CRM |
| POST | `/ai/proxy` | Proxy para API Claude AI |
| POST | `/import/facilita` | Importação em massa |

> 📄 **Ver relatório completo:** [`api_reference.md`](https://github.com/Gabriel-Maciel06/controles-vendas) (gerado pelo Antigravity em 07/04/2026)

---

## 🗃️ Banco de Dados

**Produção:** PostgreSQL (Render) via variável `DATABASE_URL`  
**Desenvolvimento:** SQLite local (`backend/crm_vendas.db`)

### Tabelas

- `sales` — Vendas com comissão, tipo e produto
- `customers` — Clientes CRM com temperatura, origem, segmento
- `samples` — Amostras com rastreio automático pelos Correios
- `reminders` — Lembretes com prioridade
- `settings` — Configurações chave-valor por perfil
- `prospects` — Prospecções oriundas do Google Maps

---

## 🚀 Módulos do Sistema

### 📊 Dashboard
- KPIs de vendas por mês (total faturado, comissão, qtd vendas)
- Gráfico de evolução mensal (Chart.js)
- Mapa de calor de prospecção por região SP
- Filtro por mês + indicadores de meta

### 💰 Vendas (Sales)
- CRUD completo de vendas
- Tipos: Google, Reativação, Introdução, Normal
- KPIs por tipo com comissão configurável via Settings
- Tabela global histórico + filtro mensal
- Auto-cria cliente no CRM ao registrar venda

### 👥 CRM — Clientes
- Gestão completa de clientes B2B
- Filtros por origem: Google, Ativos, Inativos, Maps
- Temperature pipeline: Frio → Morno → Quente → Fechando → Pós Venda
- Integração WhatsApp composer com templates

### 🎯 Kanban (Funil de Vendas)
- Drag & drop visual por etapa
- Busca por nome de cliente
- Atualização automática de temperatura ao mover card

### 📬 Amostras
- Controle de amostras enviadas com prazos
- Rastreamento automático via scraping LinkeTrack (Correios)
- Status: Aguardando → Enviada → Em trânsito → Entregue → Convertida/Rejeitada

### 🔔 Lembretes
- Criação de tarefas com data/hora limite e prioridade
- Notificações na topbar quando há lembretes vencidos

### 📈 Analytics
- Funil de conversão com detecção de gargalos
- Gráficos de distribuição por origem e temperatura
- Análise de amostras atrasadas
- Top 5 inativos para reativação por ticket médio

### 🔍 Prospecção (Maps)
- Cadastro de empresas prospectadas via Google Maps
- Auto-preenchimento de região por cidade (SP)
- Envio direto para o CRM com um clique

### 📅 Calendário
- Visualização de follow-ups agendados por data

### 💬 WhatsApp
- Compositor de mensagens com templates por situação
- Abertura direta via `wa.me` (sem API paga)
- Registro automático do contato no CRM

### 🤖 IA (Claude)
- Sugestões de texto para abordagem de clientes
- Análise de conversas WhatsApp importadas
- Proxy seguro no backend (chave não exposta ao frontend)

### 📥 Importação Facilita
- Importação em massa de clientes e prospects
- Apenas perfis `default` e `mateus` têm acesso
- Deduplicação automática por ID

---

## ⚙️ Variáveis de Ambiente (Render)

```env
DATABASE_URL=postgresql://...          # PostgreSQL connection string
APP_PASSWORD_DEFAULT=...               # Senha perfil default (Maciel)
APP_PASSWORD_MAMAE=...                 # Senha perfil mamae
APP_PASSWORD_KARINE=...                # Senha perfil karine
APP_PASSWORD_CAIO=...                  # Senha perfil caio
APP_PASSWORD_FERNANDA=...              # Senha perfil fernanda
APP_PASSWORD_MATEUS=...                # Senha perfil mateus
CLAUDE_API_KEY=...                     # Anthropic Claude API key
BRASIL_ABERTO_TOKEN=...                # Token rastreio Correios (opcional)
```

---

## 🖥️ Rodando Localmente

### Backend
```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --port 8000
```

### Frontend
Abrir `index.html` diretamente no browser via Live Server ou:
```bash
# No VS Code: instalar extensão Live Server e clicar em "Go Live"
# Ou usar:
python -m http.server 5500
```

> ⚠️ O `API_BASE_URL` em `js/data.js` aponta para produção (`onrender.com`). Para usar localmente, altere para `http://localhost:8000/api`.

---

## 📍 Onde Paramos (Última Sessão — 14/04/2026)

> **Resumo do que foi desenvolvido e está funcional:**

### ✅ Concluído e Funcionando
- [x] Sistema completo de autenticação multi-perfil com renovação automática de token
- [x] CRUD completo: Vendas, Clientes, Amostras, Lembretes, Prospects
- [x] Dashboard com KPIs, gráficos e mapa de prospecção
- [x] CRM com kanban drag & drop e pipeline de temperatura
- [x] Rastreamento automático de amostras via Correios (LinkeTrack scraping)
- [x] Módulo de Analytics com funil e detecção de gargalos
- [x] Módulo de Prospecção integrado ao CRM
- [x] Integração WhatsApp com templates por situação
- [x] Análise de conversas WhatsApp exportadas
- [x] Proxy de IA (Claude) no backend
- [x] Importação em massa da base Facilita
- [x] Calendário de follow-ups
- [x] Filtros de CRM por origem (Google, Ativos, Inativos, Maps)
- [x] Busca no Kanban por nome de cliente
- [x] Deploy funcional no Render (backend) + Vercel (frontend)

### 🔄 Pendências / Próximos Passos Sugeridos

- [ ] **Relatório PDF exportável** — possibilidade de gerar PDF com resumo mensal de vendas
- [ ] **Meta visual no Dashboard** — barra de progresso para a meta mensal (`crm_monthly_goal`)
- [ ] **Edição de Prospects** — atualmente só há cadastro e exclusão, não edição
- [ ] **Filtro avançado no CRM** — filtrar por temperatura + segmento + cidade combinados
- [ ] **Histórico de contatos** — linha do tempo de interações por cliente
- [ ] **Notificações push** — reminders que avisam mesmo com o app fechado (PWA)
- [ ] **Análise de WhatsApp melhorada** — identificar padrões de objeção e resposta
- [ ] **Integração com Facilita API** — sincronização automática (hoje é importação manual)
- [ ] **Token JWT persistente** — substituir token em memória por JWT com expiração real (Redis)
- [ ] **Dashboard Mamãe** — versão separada com métricas de vinho (lucro, custo, margem)

### 🐛 Bugs Conhecidos
- Token em memória RAM: se o Render reiniciar (spin down por inatividade), todos os usuários precisam reabrir o app (mas a renovação automática resolve se tabs estiver aberta)
- Scraping LinkeTrack pode falhar se o layout do site mudar

---

## 🛠️ Tech Stack

| Camada | Tecnologia |
|---|---|
| Frontend | HTML5 + Vanilla JS + CSS3 custom |
| Gráficos | Chart.js |
| Ícones | Boxicons |
| Backend | FastAPI (Python 3.11) |
| ORM | SQLAlchemy |
| Validação | Pydantic v1 |
| Banco Prod | PostgreSQL (Render) |
| Banco Dev | SQLite |
| HTTP Client | httpx (backend) / fetch (frontend) |
| Deploy Backend | Render.com (Gunicorn + Uvicorn) |
| Deploy Frontend | Vercel |
| IA | Anthropic Claude (proxy via backend) |
| Rastreio | LinkeTrack scraping + Brasil Aberto API |

---

## 👤 Desenvolvido por

**Gabriel Maciel** com assistência de **Antigravity (Google DeepMind)**  
Projeto iniciado em: **Março 2026**  
Última atualização: **Abril 2026**
