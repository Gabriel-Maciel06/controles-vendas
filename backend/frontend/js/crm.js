/**
 * CRM & Relacionamento Module — v2.0
 * Com edição completa de clientes via modal
 */

const CRMModule = {
    allAlerts: [], // guarda todos os clientes para filtrar localmente
    filteredAlerts: [],
    currentPage: 1,
    itemsPerPage: 20,
    activeView: 'crm', // view atual ativa

    // Filtros de origin por view
    ORIGIN_FILTERS: {
        'crm-google':  c => (c.origin || '') === 'Google',
        'crm-ativo':   c => (c.origin || '') === 'Inativo' && (c.temperature || '') !== 'Primeiro contato',
        'crm-inativo': c => (c.origin || '') === 'Inativo' && (!c.temperature || c.temperature === 'Primeiro contato' || c.temperature === 'Frio'),
        'crm-maps':    c => (c.origin || '') === 'Maps',
        'crm':         () => true,
    },

    init(viewId = 'crm') {
        this.activeView = viewId;
        this.mountForm(); // Novo: Monta o formulário na view ativa
        this.cacheDOM();
        
        if (this.dom.form) {
            this.bindEvents();
            if (this.dom.dateInput) this.dom.dateInput.value = new Date().toISOString().split('T')[0];
            
            // Configurações padrão por view
            if (viewId === 'crm-google') {
                this.selectOrigin('Google');
                this.selectTemp('Quente');
            } else if (viewId === 'crm-ativo') {
                this.selectOrigin('Inativo');
                this.selectTemp('Pós venda');
            } else if (viewId === 'crm-inativo') {
                this.selectOrigin('Inativo');
                this.selectTemp('Primeiro contato');
            } else if (viewId === 'crm-maps') {
                this.selectOrigin('Maps');
                this.selectTemp('Frio');
            } else {
                this.selectOrigin('');
                this.selectTemp('Primeiro contato');
            }
            
            this.selectDays(15);
        }
        this.loadAlerts();
    },

    mountForm() {
        const mount = document.querySelector(`#view-${this.activeView} .crm-form-mount`);
        if (!mount) return;

        // Se o formulário já estiver lá, não faz nada
        if (mount.querySelector('#crm-form')) return;

        // Limpa outros mounts (opcional)
        document.querySelectorAll('.crm-form-mount').forEach(m => {
            if (m !== mount) m.innerHTML = '';
        });

        // Usa instância única do formulário
        if (!this.formInstance) {
            const template = document.getElementById('crm-form-template');
            if (template) {
                const frag = template.content.cloneNode(true);
                this.formInstance = frag.querySelector('#crm-form-wrapper') || frag.firstElementChild;
                
                // Mapear eventos uma única vez se possível, mas como cacheDOM limpa this.dom, 
                // vamos garantir que bindEvents saiba lidar com isso.
            }
        }

        if (this.formInstance) {
            mount.appendChild(this.formInstance);
            
            // Ajusta o título do formulário opcionalmente
            const titleMap = {
                'crm-google': '🔵 Novo Lead Google',
                'crm-ativo': '✅ Novo Cliente Ativo',
                'crm-inativo': '⏸ Registrar Inativo',
                'crm-maps': '📍 Novo Contato Maps'
            };
            const titleEl = document.getElementById('crm-form-title');
            if (titleEl && titleMap[this.activeView]) {
                titleEl.innerText = titleMap[this.activeView];
            }
        }
    },

    cacheDOM() {
        if (!this.activeView) return;

        // Tenta encontrar o mount da view ativa
        const mount = document.querySelector(`#view-${this.activeView} .crm-form-mount`);
        
        // Função auxiliar para buscar com prioridade no mount atual
        const getEl = (id) => {
            if (mount) {
                const el = mount.querySelector(`#${id}`);
                if (el) return el;
            }
            return document.getElementById(id);
        };

        // IDs de busca por view
        const searchIdMap = {
            'crm-google':  'crm-google-search',
            'crm-ativo':   'crm-ativo-search',
            'crm-inativo': 'crm-inativo-search',
            'crm-maps':    'crm-maps-search',
            'crm':         'crm-search',
        };
        // IDs de tbody por view
        const bodyIdMap = {
            'crm-google':  'crm-google-body',
            'crm-ativo':   'crm-ativo-body',
            'crm-inativo': 'crm-inativo-body',
            'crm-maps':    'crm-maps-body',
            'crm':         'crm-alerts-body',
        };
        // IDs de contador por view
        const countIdMap = {
            'crm-google':  'crm-google-count',
            'crm-ativo':   'crm-ativo-count',
            'crm-inativo': 'crm-inativo-count',
            'crm-maps':    'crm-maps-count',
            'crm':         'crm-count',
        };
        // IDs de paginação por view
        const paginationIdMap = {
            'crm-google':  'crm-google-pagination',
            'crm-ativo':   'crm-ativo-pagination',
            'crm-inativo': 'crm-inativo-pagination',
            'crm-maps':    'crm-maps-pagination',
            'crm':         'crm-pagination',
        };

        const searchId     = searchIdMap[this.activeView]     || 'crm-search';
        const bodyId       = bodyIdMap[this.activeView]       || 'crm-alerts-body';
        const countId      = countIdMap[this.activeView]      || 'crm-count';
        const paginationId = paginationIdMap[this.activeView] || 'crm-pagination';

        this.dom = {
            form:           getEl('crm-form'),
            client:         getEl('crm-client'),
            phone:          getEl('crm-phone'),
            buyer:          getEl('crm-buyer'),
            products:       getEl('crm-products'),
            originInput:    getEl('crm-origin'),
            tempInput:      getEl('crm-temp'),
            dateInput:      getEl('crm-date'),
            notes:          getEl('crm-notes'),
            followupDays:   getEl('crm-followup-days'),
            followupPreview:getEl('crm-followup-preview'),
            alertsBody:     document.getElementById(bodyId),
            search:         document.getElementById(searchId),
            btnClear:       document.getElementById('crm-btn-clear-filters'),
            count:          document.getElementById(countId),
            pagination:     document.getElementById(paginationId),
        };

        console.log("CRM Cache DOM atualizado para:", this.activeView, this.dom.form ? "Form OK" : "Form MISSING");
    },

    bindEvents() {
        if (!this.dom.form) return;
        
        // Evita duplicar o listener de submit
        if (this.dom.form._bound) return;

        this.dom.form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleFormSubmit();
        });

        this.dom.form._bound = true;

        // Atualiza preview quando muda a data
        if (this.dom.dateInput) this.dom.dateInput.addEventListener('change', () => this.updatePreview());

        // Fechar modal de edição clicando fora
        document.getElementById('crm-edit-modal')?.addEventListener('click', (e) => {
            if (e.target.id === 'crm-edit-modal') this.closeEditModal();
        });
    },

    // ── Seleciona intervalo de follow-up ──
    selectDays(days) {
        if (this.dom.followupDays) this.dom.followupDays.value = days;

        // Atualiza visual dos botões
        document.querySelectorAll('.crm-days-btn').forEach(btn => {
            const isSelected = parseInt(btn.dataset.days) === days;
            btn.className = `crm-days-btn btn ${isSelected ? 'btn-primary' : 'btn-outline'}`;
            btn.style.flex = '1';
            btn.style.fontSize = '0.82rem';
            btn.style.padding = '0.5rem 0.3rem';
        });

        this.updatePreview();
    },

    // ── Seleciona Origem ──
    selectOrigin(origin) {
        if (this.dom.originInput) this.dom.originInput.value = origin;
        const colors = {
            'Google': '#818cf8',  // Roxo
            'Inativo': '#1D9E75', // Verde
            'Prospec': '#EF9F27', // Laranja
            'Maps': '#888888'     // Cinza
        };
        const color = colors[origin] || 'var(--primary)';
        
        // Tenta encontrar os botões dentro do formulário atual
        const form = this.dom?.form || document.getElementById('crm-form');
        const searchArea = form || document;

        searchArea.querySelectorAll('.btn-origin').forEach(btn => {
            if (btn.dataset.origin === origin) {
                btn.style.background = color;
                btn.style.borderColor = color;
                btn.style.color = '#ffffff';
                btn.style.fontWeight = 'bold';
            } else {
                btn.style.background = 'transparent';
                btn.style.borderColor = 'rgba(255,255,255,0.1)';
                btn.style.color = 'var(--text-main)';
                btn.style.fontWeight = 'normal';
            }
        });
    },

    // ── Seleciona Temperatura ──
    selectTemp(temp) {
        if (this.dom.tempInput) this.dom.tempInput.value = temp;
        const colors = {
            'Frio': '#3b82f6',     // Azul
            'Morno': '#EF9F27',    // Laranja
            'Quente': '#E24B4A',   // Vermelho
            'Fechando': '#1D9E75'  // Verde
        };
        const color = colors[temp] || 'var(--primary)';
        
        // Tenta encontrar os botões dentro do formulário atual
        const form = this.dom?.form || document.getElementById('crm-form');
        const searchArea = form || document;

        searchArea.querySelectorAll('.btn-temp').forEach(btn => {
            if (btn.dataset.temp === temp) {
                btn.style.background = color;
                btn.style.borderColor = color;
                btn.style.color = '#ffffff';
                btn.style.fontWeight = 'bold';
            } else {
                btn.style.background = 'transparent';
                btn.style.borderColor = 'rgba(255,255,255,0.1)';
                btn.style.color = 'var(--text-main)';
                btn.style.fontWeight = 'normal';
            }
        });
    },

    // ── Mostra a data prevista do próximo contato ──
    updatePreview() {
        const preview = this.dom.followupPreview;
        if (!preview) return;

        const days = parseInt(this.dom.followupDays?.value || 15);
        const base = this.dom.dateInput?.value;
        if (!base) { preview.textContent = ''; return; }

        const d = new Date(base + 'T00:00:00');
        d.setDate(d.getDate() + days);
        const fmt = d.toLocaleDateString('pt-BR', { weekday:'short', day:'2-digit', month:'short' });
        preview.textContent = `📅 Próximo contato: ${fmt}`;
    },

    // ── Registrar novo contato ──
    async handleFormSubmit() {
        if (this._submitting) return;
        this._submitting = true;

        const btn = this.dom.form.querySelector('button[type="submit"]');
        const originalText = btn.innerHTML;
        btn.disabled = true;
        btn.innerHTML = 'Salvando... <i class="bx bx-loader-alt bx-spin"></i>';

        try {
            let contactDate = this.dom.dateInput.value;
            // Garantia: se a data estiver vazia, usa hoje
            if (!contactDate) {
                contactDate = new Date().toISOString().split('T')[0];
                this.dom.dateInput.value = contactDate;
            }

            const days    = parseInt(this.dom.followupDays?.value || 15);
            const dateObj = new Date(contactDate + 'T00:00:00');
            
            if (isNaN(dateObj.getTime())) {
                throw new Error("Data de atendimento inválida.");
            }

            dateObj.setDate(dateObj.getDate() + days);

            const newContact = {
                name:            this.dom.client.value.trim().toUpperCase(),
                phone:           this.dom.phone.value.trim(),
                buyerName:       this.dom.buyer.value.trim(),
                company:         document.getElementById('crm-company')?.value.trim() || '',
                email:           document.getElementById('crm-email')?.value.trim() || '',
                cnpj:            document.getElementById('crm-cnpj')?.value.trim() || '',
                instagram:       document.getElementById('crm-instagram')?.value.trim() || '',
                segment:         document.getElementById('crm-segment')?.value.trim() || '',
                address:         document.getElementById('crm-address')?.value.trim() || '',
                products:        this.dom.products.value.trim(),
                origin:          (this.dom.originInput.value || 'Inativo').trim(),
                temperature:     (this.dom.tempInput.value || 'Frio').trim(),
                lastContactDate: contactDate,
                createdAt:       new Date().toISOString(),
                notes:           this.dom.notes.value.trim(),
                nextFollowUp:    dateObj.toISOString().split('T')[0],
                status:          'Contato',
            };

            if (!newContact.name) {
                alert("Por favor, preencha o nome do cliente.");
                return;
            }

            btn.disabled = true;
            btn.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> Salvando...';

            await DataStore.add(STORAGE_KEYS.CUSTOMERS, newContact);

            // Limpar formulário
            ['client','notes','phone','buyer','products'].forEach(f => {
                if(this.dom[f]) this.dom[f].value = '';
            });
            
            ['crm-company', 'crm-email', 'crm-cnpj', 'crm-instagram', 'crm-segment', 'crm-address'].forEach(id => {
                const el = document.getElementById(id);
                if (el) el.value = '';
            });

            this.dom.dateInput.value = new Date().toISOString().split('T')[0];
            this.updatePreview();
            
            alert("✅ Atendimento registrado com sucesso!");
            
            this.loadAlerts();
            if (typeof CalendarModule !== 'undefined') CalendarModule.loadEvents();
            if (typeof DashboardModule !== 'undefined') DashboardModule.update();
            
        } catch (error) {
            console.error("Erro ao salvar contato:", error);
            alert("⚠️ Erro ao salvar: " + error.message);
        } finally {
            this._submitting = false;
            btn.disabled = false;
            btn.innerHTML = originalText;
        }
    },

    // ── Excluir registro ──
    deleteContact(id) {
        if (!confirm('Excluir este registro de contato?')) return;
        DataStore.remove(STORAGE_KEYS.CUSTOMERS, id);
        this.loadAlerts();
        if (typeof DashboardModule !== 'undefined') DashboardModule.update();
    },

    // ── Preencher nome no form para novo contato rápido ──
    quickContact(clientName) {
        this.dom.client.value = clientName;
        this.dom.notes.focus();
        this.dom.form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    },

    // ── Abrir modal de edição ──
    openEditModal(id) {
        const all    = DataStore.get(STORAGE_KEYS.CUSTOMERS);
        const record = all.find(c => String(c.id) === String(id));
        if (!record) return;

        // Preenche todos os campos do modal
        document.getElementById('edit-id').value            = record.id;
        document.getElementById('edit-name').value          = record.name     || record.client || '';
        document.getElementById('edit-phone').value         = record.phone    || '';
        document.getElementById('edit-buyer').value         = record.buyerName|| '';
        document.getElementById('edit-email').value         = record.email    || '';
        document.getElementById('edit-company').value       = record.company  || '';
        document.getElementById('edit-cnpj').value          = record.cnpj     || '';
        document.getElementById('edit-address').value       = record.address  || '';
        document.getElementById('edit-instagram').value     = record.instagram|| '';
        document.getElementById('edit-segment').value       = record.segment  || '';
        document.getElementById('edit-products').value      = record.products || '';
        document.getElementById('edit-origin').value        = record.origin   || '';
        document.getElementById('edit-temperature').value   = record.temperature || '';
        document.getElementById('crm-edit-modal').classList.remove('hidden');
    },

    closeEditModal() {
        document.getElementById('crm-edit-modal').classList.add('hidden');
    },

    async analyzeSingleConversation() {
        const text = document.getElementById('edit-ai-chat').value.trim();
        if (!text) return alert('Por favor, cole um trecho da conversa do WhatsApp no campo adequando.');

        const btn = document.getElementById('btn-analyze-single');
        btn.disabled = true;
        btn.innerHTML = '<i class="bx bx-loader-alt bx-spin"></i> Lendo e compreendendo a conversa...';

        try {
            const system = "Como um analista de vendas sênior corporativo, faça um resumo clínico de no máximo 3 linhas baseado exclusivamente neste bate papo de WhatsApp. Diga 1. Sentimento 2. Etapa atual 3. Oportunidade ou erro a contornar.";
            const prompt = `CONVERSA: ${text.substring(0, 4000)}`;

            const res = await fetch(`${API_BASE_URL}/ai/proxy`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify({
                    model: 'claude-3-haiku-20240307',
                    max_tokens: 250,
                    system: system,
                    messages: [{ role: 'user', content: prompt }]
                })
            });
            
            if (!res.ok) throw new Error('API do servidor falhou: ' + res.status);
            const data = await res.json();
            const summary = `[🤖 Análise da IA em ${new Date().toLocaleDateString('pt-BR')}]\n${data.content[0]?.text || ''}`;

            const notesEl = document.getElementById('edit-notes');
            const spacer = notesEl.value ? '\n\n' : '';
            notesEl.value = summary + spacer + notesEl.value; // prepend ao topo
            document.getElementById('edit-ai-chat').value = '';

        } catch (err) {
            console.error(err);
            alert('Erro ao processar análise da IA: ' + err.message);
        } finally {
            btn.disabled = false;
            btn.innerHTML = '✨ Gerar Resumo Inteligente';
        }
    },

    // ── Salvar edição ──
    async saveEdit() {
        const id = document.getElementById('edit-id').value;

        // Recalcula nextFollowUp se lastContact mudou e nextFollowUp estiver vazio
        let nextFollowUp = document.getElementById('edit-nextFollowUp').value;
        const lastContact = document.getElementById('edit-lastContact').value;
        if (!nextFollowUp && lastContact) {
            const d = new Date(lastContact + 'T00:00:00');
            d.setDate(d.getDate() + 15);
            nextFollowUp = d.toISOString().split('T')[0];
        }

        const updated = {
            name:            document.getElementById('edit-name').value.trim().toUpperCase(),
            phone:           document.getElementById('edit-phone').value.trim(),
            buyerName:       document.getElementById('edit-buyer').value.trim().toUpperCase(),
            email:           document.getElementById('edit-email').value.trim(),
            company:         document.getElementById('edit-company').value.trim().toUpperCase(),
            cnpj:            document.getElementById('edit-cnpj').value.trim(),
            address:         document.getElementById('edit-address').value.trim().toUpperCase(),
            instagram:       document.getElementById('edit-instagram').value.trim(),
            segment:         document.getElementById('edit-segment').value.trim().toUpperCase(),
            products:        document.getElementById('edit-products').value.trim().toUpperCase(),
            origin:          document.getElementById('edit-origin').value,
            temperature:     document.getElementById('edit-temperature').value,
            status:          document.getElementById('edit-status').value,
            lastContactDate: lastContact,
            nextFollowUp:    nextFollowUp,
            notes:           document.getElementById('edit-notes').value.trim(),
        };

        if (this._submittingEdit) return;
        this._submittingEdit = true;

        const btn = document.getElementById('btn-save-edit');
        const originalText = btn.innerHTML;
        btn.disabled  = true;
        btn.innerHTML = 'Salvando... <i class="bx bx-loader-alt bx-spin"></i>';

        await DataStore.update(STORAGE_KEYS.CUSTOMERS, id, updated);

        btn.disabled  = false;
        btn.innerHTML = originalText;
        this._submittingEdit = false;

        this.closeEditModal();
        this.loadAlerts();
        if (typeof CalendarModule  !== 'undefined') CalendarModule.loadEvents();
        if (typeof DashboardModule !== 'undefined') DashboardModule.update();
    },

    // ── Carregar tabela de alertas ──
    loadAlerts() {
        const all = DataStore.get(STORAGE_KEYS.CUSTOMERS);
        if (!all || all.length === 0) {
            this.allAlerts = [];
            this.renderTable([]);
            this.updateCount(0, 0);
            return;
        }

        // Pegar o registro mais recente por cliente
        const latest = {};
        all.forEach(c => {
            const name = c.name || c.client;
            const date = c.lastContactDate || c.contactDate || '';
            if (!latest[name] || date > (latest[name].lastContactDate || '')) latest[name] = c;
        });

        this.allAlerts = Object.values(latest);

        this.applyFilters(false); // Retain pagination on reload
    },

    // ── Aplica busca + filtros sobre allAlerts ──
    applyFilters(resetPage = true) {
        if (resetPage !== false) this.currentPage = 1;

        const query      = (this.dom.search?.value || '').toLowerCase().trim();
        const tempObj    = document.getElementById('crm-filter-temperature');
        const originObj  = document.getElementById('crm-filter-origin');
        const sortObj    = document.getElementById('crm-filter-sort');

        const temperature = tempObj ? tempObj.value : '';
        const originFilter= originObj ? originObj.value : '';
        const sortMode    = sortObj ? sortObj.value : 'priority';

        const today      = new Date().toISOString().split('T')[0];
        const weekEnd    = new Date(); weekEnd.setDate(weekEnd.getDate() + 7);
        const weekEndStr = weekEnd.toISOString().split('T')[0];

        // Aplica filtro fixo de view (ORIGIN_FILTERS)
        const viewFilter = this.ORIGIN_FILTERS[this.activeView] || (() => true);
        let filtered = this.allAlerts.filter(viewFilter);

        filtered = filtered.filter(c => {
            const name  = (c.name || c.client || '').toLowerCase();
            const phone = (c.phone || '').toLowerCase();

            // Busca por nome ou telefone
            if (query && !name.includes(query) && !phone.includes(query)) return false;

            // Filtro de origin (Inativo, Ativo, Prospec, Maps...)
            // Cuidado: alguns clientes legados podem ter 'origin' vazio. 
            // O source costuma guardar Inativo também se origin falhar... vamos testar os 2
            if (originFilter) {
                const cOrigin = c.origin || '';
                const cSource = c.source || '';
                if (cOrigin !== originFilter && cSource !== originFilter) return false;
            }

            // Filtro de temperatura
            if (temperature && (c.temperature || 'Frio') !== temperature) return false;

            return true;
        });

        // Calculo de prioridade
        filtered.forEach(c => {
            let score = 0;
            const temp = c.temperature || 'Frio';
            if (temp === 'Fechando') score += 400; 
            else if (temp === 'Quente') score += 300;
            else if (temp === 'Morno') score += 200;
            else if (temp === 'Frio') score += 100;

            const next = c.nextFollowUp || '';
            if (next && next < today) score += 30; // Atrasado
            else if (next === today) score += 20; // Hoje
            else if (next >= today && next <= weekEndStr) score += 10; // Semana
            else score += 0; // Em dia

            const origin = c.origin || '';
            if (origin === 'Google') score += 3;
            else if (origin === 'Inativo') score += 2;
            else if (origin === 'Prospec') score += 1;
            else score += 0; 

            c._priorityScore = score;
        });

        filtered.sort((a, b) => {
            if (sortMode === 'recent') {
                const da = a.lastContactDate || a.createdAt || '1970-01-01';
                const db = b.lastContactDate || b.createdAt || '1970-01-01';
                return db.localeCompare(da);
            } else if (sortMode === 'oldest') {
                const da = a.lastContactDate || a.createdAt || '1970-01-01';
                const db = b.lastContactDate || b.createdAt || '1970-01-01';
                return da.localeCompare(db);
            } else {
                return b._priorityScore - a._priorityScore;
            }
        });

        this.filteredAlerts = filtered;

        // Mostrar/esconder botão limpar
        const hasFilter = query || temperature || originFilter || sortMode !== 'priority';
        if (this.dom.btnClear) this.dom.btnClear.style.display = hasFilter ? 'block' : 'none';

        this.updateCount(filtered.length, this.allAlerts.length);
        this.renderCurrentPage();
    },

    changePage(delta) {
        this.currentPage += delta;
        this.renderCurrentPage();
    },

    renderCurrentPage() {
        const total = this.filteredAlerts.length;
        const totalPages = Math.ceil(total / this.itemsPerPage) || 1;
        if (this.currentPage > totalPages) this.currentPage = totalPages;
        
        const start = (this.currentPage - 1) * this.itemsPerPage;
        const end = start + this.itemsPerPage;
        const sliced = this.filteredAlerts.slice(start, end);

        this.renderViewSpecific(this.activeView, sliced);
        this.renderPagination(total, start, Math.min(end, total));
    },

    // ── Despachador de render por view ──
    renderViewSpecific(viewId, customers) {
        switch(viewId) {
            case 'crm-google':  return this.renderGoogleCards(customers);
            case 'crm-ativo':   return this.renderAtivoTable(customers);
            case 'crm-inativo': return this.renderInativoTable(customers);
            case 'crm-maps':    return this.renderMapsGrouped(customers);
            default:            return this.renderTable(customers);
        }
    },

    renderGoogleCards(customers) {
        const body = document.getElementById('crm-google-body');
        if (!body) return;
        body.innerHTML = '';

        if (!customers.length) {
            body.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--text-muted);">Nenhum lead Google.</div>`;
            return;
        }

        customers.forEach(c => {
            const card = document.createElement('div');
            card.className = 'google-lead-card';
            card.innerHTML = `
                <div class="card-main">
                    <div class="card-info">
                        <h4>${this.escapeHTML(c.name || 'Sem Nome')}</h4>
                        <div style="color:var(--accent); font-size:0.85rem; font-weight:600;">${this.escapeHTML(c.phone || '—')}</div>
                    </div>
                    <div class="card-actions" style="display:flex; gap:0.5rem;">
                        <button onclick="WhatsAppModule.openComposer('${c.id}')" class="btn-icon" style="color:var(--accent)"><i class='bx bxl-whatsapp'></i></button>
                        <button onclick="CRMModule.openEditModal('${c.id}')" class="btn-icon"><i class='bx bx-edit'></i></button>
                    </div>
                </div>
                <div class="secondary-info">
                    <span><i class='bx bx-purchase-tag'></i> ${this.escapeHTML(c.origin || 'Google')}</span>
                    <span><i class='bx bx-calendar'></i> ${c.createdAt ? new Date(c.createdAt).toLocaleDateString() : '—'}</span>
                </div>
            `;
            body.appendChild(card);
        });
    },

    // ── Ativo: tabela padrão ──
    renderAtivoTable(customers) {
        this.renderTable(customers);
    },

    // ── Inativo: dias sem comprar + ticket médio ──
    renderInativoTable(customers) {
        const body = document.getElementById('crm-inativo-body');
        if (!body) return;
        body.innerHTML = '';

        const today = new Date();
        customers.forEach(c => {
            const lastDate = c.lastContactDate ? new Date(c.lastContactDate + 'T00:00:00') : null;
            const diffDays = lastDate ? Math.floor((today - lastDate) / (1000 * 60 * 60 * 24)) : '—';
            
            // Tenta extrair ticket médio das notas se houver (ex: "Ticket R$ 1.500")
            const ticketMatch = (c.notes || '').match(/Ticket.*?R\$\s?([\d.,]+)/i);
            const ticket = ticketMatch ? ticketMatch[1] : '—';

            const tr = document.createElement('tr');
            tr.innerHTML = `
                <td><strong>${this.escapeHTML(c.name)}</strong></td>
                <td>${this.escapeHTML(c.city || '—')}</td>
                <td><span class="badge ${diffDays > 60 ? 'badge-danger' : 'badge-warn'}">${diffDays} dias</span></td>
                <td style="color:var(--accent); font-weight:600;">R$ ${ticket}</td>
                <td>${c.nextFollowUp || '—'}</td>
                <td>
                    <button onclick="CRMModule.openEditModal('${c.id}')" class="btn btn-sm btn-outline">Reativar</button>
                </td>
            `;
            body.appendChild(tr);
        });
    },

    // ── Maps: agrupado por região ──
    renderMapsGrouped(customers) {
        const body = this.dom.alertsBody;
        if (!body) return;
        body.innerHTML = '';

        if (!customers.length) {
            body.innerHTML = `<tr><td colspan="5" style="text-align:center;padding:2rem;color:var(--text-muted);">Nenhum contato Maps registrado.</td></tr>`;
            return;
        }

        // Agrupar por region ou cidade extraída do endereço
        const groups = {};
        customers.forEach(c => {
            const region = c.region || (c.address ? c.address.split(',').pop().trim() : null) || 'Sem região';
            if (!groups[region]) groups[region] = [];
            groups[region].push(c);
        });

        const today = new Date().toISOString().split('T')[0];

        Object.entries(groups).sort(([a],[b]) => a.localeCompare(b)).forEach(([region, list]) => {
            // Header da região
            const headerRow = document.createElement('tr');
            headerRow.innerHTML = `<td colspan="5" style="background:rgba(255,255,255,0.03);padding:0.45rem 1rem;font-size:0.72rem;font-weight:700;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.06em;">📍 ${this.escapeHTML(region)} <span style="color:var(--primary);margin-left:0.3rem;">(${list.length})</span></td>`;
            body.appendChild(headerRow);

            list.forEach(c => {
                const name    = c.name || c.client || '—';
                const phone   = c.phone || '';
                const city    = c.city || (c.address ? c.address.split(',').pop().trim() : '—');
                const next    = c.nextFollowUp || '';
                const nextFmt = next ? next.split('-').reverse().join('/') : '—';
                const isLate  = next && next < today;
                const tempColors = { 'Frio':'#3b82f6','Morno':'#EF9F27','Quente':'#E24B4A','Fechando':'#1D9E75','Primeiro contato':'#888' };
                const tempColor  = tempColors[c.temperature] || '#888';

                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td style="padding:0.65rem 0.5rem;">
                        <div style="font-weight:600;color:var(--text-main);font-size:0.87rem;">${this.escapeHTML(name)}</div>
                        ${phone ? `<div style="font-size:0.73rem;color:#25D366;cursor:pointer;" onclick="WhatsAppModule.openDirect('${this.escapeAttr(phone)}','${this.escapeAttr(name)}')">${this.escapeHTML(phone)}</div>` : '<div style="font-size:0.72rem;color:rgba(255,255,255,0.2);">sem telefone</div>'}
                    </td>
                    <td style="padding:0.65rem 0.5rem;font-size:0.82rem;color:var(--text-muted);">${this.escapeHTML(city)}</td>
                    <td style="padding:0.65rem 0.5rem;"><span style="background:${tempColor}22;color:${tempColor};font-size:0.7rem;font-weight:600;padding:0.15rem 0.55rem;border-radius:20px;">${c.temperature||'—'}</span></td>
                    <td style="padding:0.65rem 0.5rem;font-size:0.8rem;color:${isLate ? '#E24B4A' : 'var(--text-muted)'};white-space:nowrap;">${isLate ? '⚠️ ' : ''}${nextFmt}</td>
                    <td style="padding:0.65rem 0.5rem;">
                        <div style="display:flex;gap:0.25rem;">
                            <button onclick="CRMModule.openEditModal('${c.id}')" style="width:28px;height:28px;border-radius:7px;border:none;background:rgba(99,102,241,0.13);color:#818cf8;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:0.88rem;"><i class='bx bx-edit'></i></button>
                            ${phone ? `<button onclick="WhatsAppModule.openComposer('${c.id}')" style="width:28px;height:28px;border-radius:7px;border:none;background:rgba(37,211,102,0.1);color:#25D366;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:0.9rem;"><i class='bx bxl-whatsapp'></i></button>` : ''}
                            <button onclick="CRMModule.deleteContact('${c.id}')" style="width:28px;height:28px;border-radius:7px;border:none;background:rgba(239,68,68,0.07);color:#ef4444;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:0.88rem;"><i class='bx bx-trash'></i></button>
                        </div>
                    </td>`;
                body.appendChild(tr);
            });
        });
    },
    renderMapsGrouped(customers) {
        const body = document.getElementById('crm-maps-body');
        if (!body) return;
        body.innerHTML = '';

        // Agrupa por Região
        const groups = customers.reduce((acc, obj) => {
            const key = obj.region || 'Outros';
            if (!acc[key]) acc[key] = [];
            acc[key].push(obj);
            return acc;
        }, {});

        for (const [region, list] of Object.entries(groups)) {
            // Linha de Cabeçalho do Grupo
            const headTr = document.createElement('tr');
            headTr.innerHTML = `<td colspan="5" style="background:rgba(255,255,255,0.03); font-weight:700; color:var(--primary); padding:0.5rem 1rem;">${region} (${list.length})</td>`;
            body.appendChild(headTr);

            list.forEach(c => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td><strong>${this.escapeHTML(c.name)}</strong></td>
                    <td>${this.escapeHTML(c.city || '—')}</td>
                    <td><span class="badge" style="background:${this.getTempColor(c.temperature)}22; color:${this.getTempColor(c.temperature)}">${c.temperature || 'Frio'}</span></td>
                    <td>${c.nextFollowUp || '—'}</td>
                    <td>
                        <button onclick="CRMModule.openEditModal('${c.id}')" class="btn-icon"><i class='bx bx-edit'></i></button>
                    </td>
                `;
                body.appendChild(tr);
            });
        }
    },

    getTempColor(temp) {
        const colors = { 'Quente': '#f87171', 'Morno': '#fbbf24', 'Frio': '#34d399' };
        return colors[temp] || '#a1a1aa';
    },


    renderPagination(total, start, end) {
        const container = this.dom.pagination;
        if (!container) return;

        if (total === 0) {
            container.innerHTML = '';
            return;
        }

        const prevDisabled = this.currentPage === 1 ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : '';
        const nextDisabled = end >= total ? 'disabled style="opacity:0.5;cursor:not-allowed;"' : '';

        container.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:1rem;font-size:0.8rem;color:var(--text-muted);">
                <div>Mostrando ${start + 1}–${end} de ${total} clientes</div>
                <div style="display:flex;gap:0.5rem;">
                    <button class="btn btn-outline" onclick="CRMModule.changePage(-1)" ${prevDisabled}>&larr; Anterior</button>
                    <button class="btn btn-outline" onclick="CRMModule.changePage(1)" ${nextDisabled}>Próximo &rarr;</button>
                </div>
            </div>
        `;
    },

    clearFilters() {
        if (this.dom.search)        this.dom.search.value        = '';
        
        const tempObj    = document.getElementById('crm-filter-temperature');
        const originObj  = document.getElementById('crm-filter-origin');
        const sortObj    = document.getElementById('crm-filter-sort');

        if (tempObj) tempObj.value = '';
        if (originObj) originObj.value = '';
        if (sortObj) sortObj.value = 'priority';

        if (this.dom.btnClear)      this.dom.btnClear.style.display = 'none';
        this.applyFilters();
    },

    // ── Atualiza contador de resultados ──
    updateCount(shown, total) {
        if (!this.dom.count) return;
        if (shown === total) {
            this.dom.count.textContent = `${total} cliente${total !== 1 ? 's' : ''}`;
        } else {
            this.dom.count.textContent = `${shown} de ${total} cliente${total !== 1 ? 's' : ''}`;
            this.dom.count.style.color = 'var(--primary)';
        }
    },

    renderTable(alerts) {
        this.dom.alertsBody.innerHTML = '';

        if (alerts.length === 0) {
            this.dom.alertsBody.innerHTML = `<tr><td colspan="6" style="text-align:center;padding:2rem;color:var(--text-muted);">Nenhum cliente registrado.</td></tr>`;
            return;
        }

        const today = new Date().toISOString().split('T')[0];

        alerts.forEach(alert => {
            const name       = alert.name || alert.client || '—';
            const phone      = alert.phone || '';
            const lastDate   = alert.lastContactDate || alert.contactDate || '';
            const lastFmt    = lastDate   ? lastDate.split('-').reverse().join('/')   : '—';
            const nextFollow = alert.nextFollowUp || '';
            const nextFmt    = nextFollow ? nextFollow.split('-').reverse().join('/') : '—';
            const notes      = (alert.notes || '').replace(/^\[WhatsApp\]\s*/i, '');
            const notesFmt   = notes.length > 60 ? notes.substring(0,60) + '…' : notes;

            let followBadge, followColor;
            if      (nextFollow && nextFollow < today) { followBadge = 'Atrasado'; followColor = '#E24B4A'; }
            else if (nextFollow === today)              { followBadge = 'Hoje';     followColor = '#EF9F27'; }
            else                                        { followBadge = 'Em dia';   followColor = '#1D9E75'; }

            const statusColors = { 
                'Lead':'#818cf8', 
                'Prospect':'#EF9F27', 
                'Contato':'#EF9F27', 
                'Ativo':'#1D9E75', 
                'Proposta':'#3b82f6', 
                'Fechado':'#1D9E75', 
                'Perdido':'#E24B4A', 
                'Inativo':'#888' 
            };
            const statusColor  = statusColors[alert.status] || '#888';
            const initial      = name.charAt(0).toUpperCase();

            // Telefone clicável — abre WhatsApp diretamente
            const phoneDisplay = phone
                ? `<div style="font-size:0.73rem;color:#25D366;margin-top:2px;cursor:pointer;text-decoration:underline;text-decoration-style:dotted;" 
                       onclick="WhatsAppModule.openDirect('${this.escapeAttr(phone)}', '${this.escapeAttr(name)}')" 
                       title="Abrir WhatsApp com ${this.escapeAttr(name)}">${this.escapeHTML(phone)}</div>`
                : '<div style="font-size:0.72rem;color:rgba(255,255,255,0.2);margin-top:2px;">sem telefone</div>';

            // Botão WhatsApp — opaco se não tiver telefone
            const wappStyle = phone
                ? `background:rgba(37,211,102,0.1);color:#25D366;cursor:pointer;opacity:1;`
                : `background:rgba(255,255,255,0.04);color:rgba(255,255,255,0.2);cursor:not-allowed;opacity:0.4;`;
            const wappHover = phone
                ? `onmouseover="this.style.background='rgba(37,211,102,0.22)'" onmouseout="this.style.background='rgba(37,211,102,0.1)'"`
                : '';
            const wappTitle = phone ? 'Enviar mensagem WhatsApp' : 'Cadastre um telefone para usar o WhatsApp';

            const tr = document.createElement('tr');
            tr.id = `crm-row-${alert.id}`;
            tr.innerHTML = `
                <td style="padding:0.75rem 0.5rem;">
                    <div style="display:flex;align-items:center;gap:0.65rem;">
                        <div style="width:34px;height:34px;border-radius:50%;background:rgba(99,102,241,0.18);display:flex;align-items:center;justify-content:center;font-size:0.82rem;font-weight:700;color:#818cf8;flex-shrink:0;">${initial}</div>
                        <div>
                            <div style="font-weight:600;color:var(--text-main);font-size:0.87rem;line-height:1.3;">${this.escapeHTML(name)}</div>
                            ${phoneDisplay}
                        </div>
                    </div>
                </td>
                <td style="padding:0.75rem 0.5rem;">
                    <span style="display:inline-block;padding:0.18rem 0.6rem;border-radius:20px;font-size:0.71rem;font-weight:600;background:${statusColor}22;color:${statusColor};">${alert.status || 'Contato'}</span>
                </td>
                <td style="padding:0.75rem 0.5rem;font-size:0.81rem;color:var(--text-muted);white-space:nowrap;">${lastFmt}</td>
                <td style="padding:0.75rem 0.5rem;max-width:180px;">
                    ${notesFmt ? `<span style="font-size:0.79rem;color:var(--text-muted);line-height:1.4;display:block;">${this.escapeHTML(notesFmt)}</span>` : '<span style="color:rgba(255,255,255,0.15);font-size:0.78rem;">—</span>'}
                    <div class="ai-badge-container"></div>
                </td>
                <td style="padding:0.75rem 0.5rem;white-space:nowrap;">
                    <div style="font-size:0.81rem;color:var(--text-main);font-weight:500;margin-bottom:3px;">${nextFmt}</div>
                    <span style="display:inline-block;padding:0.13rem 0.5rem;border-radius:20px;font-size:0.67rem;font-weight:600;background:${followColor}22;color:${followColor};">${followBadge}</span>
                </td>
                <td style="padding:0.75rem 0.5rem;">
                    <div style="display:flex;align-items:center;gap:0.28rem;">
                        <button onclick="CRMModule.openEditModal('${alert.id}')" title="Editar" style="width:28px;height:28px;border-radius:7px;border:none;background:rgba(99,102,241,0.13);color:#818cf8;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:0.88rem;" onmouseover="this.style.background='rgba(99,102,241,0.28)'" onmouseout="this.style.background='rgba(99,102,241,0.13)'"><i class='bx bx-edit'></i></button>
                        <button onclick="${phone ? `WhatsAppModule.openComposer('${alert.id}')` : 'void(0)'}" title="${wappTitle}" style="width:28px;height:28px;border-radius:7px;border:none;${wappStyle}display:flex;align-items:center;justify-content:center;font-size:0.95rem;" ${wappHover}><i class='bx bxl-whatsapp'></i></button>
                        <button onclick="document.getElementById('crm-client').value='${this.escapeAttr(name)}';document.getElementById('crm-notes').focus();" title="Novo contato" style="width:28px;height:28px;border-radius:7px;border:none;background:rgba(255,255,255,0.05);color:var(--text-muted);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:0.88rem;" onmouseover="this.style.background='rgba(255,255,255,0.12)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'"><i class='bx bx-phone'></i></button>
                        <button onclick="CRMModule.viewHistory('${this.escapeAttr(name)}')" title="Histórico" style="width:28px;height:28px;border-radius:7px;border:none;background:rgba(255,255,255,0.05);color:var(--text-muted);cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:0.88rem;" onmouseover="this.style.background='rgba(255,255,255,0.12)'" onmouseout="this.style.background='rgba(255,255,255,0.05)'"><i class='bx bx-history'></i></button>
                        <button onclick="CRMModule.deleteContact('${alert.id}')" title="Excluir" style="width:28px;height:28px;border-radius:7px;border:none;background:rgba(239,68,68,0.07);color:#ef4444;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:0.88rem;" onmouseover="this.style.background='rgba(239,68,68,0.18)'" onmouseout="this.style.background='rgba(239,68,68,0.07)'"><i class='bx bx-trash'></i></button>
                    </div>
                </td>
            `;
            this.dom.alertsBody.appendChild(tr);
        });

        this.enrichWithAI(alerts);
    },

    async enrichWithAI(alerts) {
        if (typeof AISuggestions === 'undefined') return;
        const sales = DataStore.get(STORAGE_KEYS.SALES) || [];
        for (const alert of alerts) {
            const row = document.getElementById(`crm-row-${alert.id}`);
            if (!row) continue;
            const aiCell = row.querySelector('.ai-badge-container');
            if (!aiCell) continue;

            const analysis = await AISuggestions.analyze(alert, sales);
            if (analysis.priority === 'urgente' || analysis.priority === 'alta') {
                const bg = analysis.priority === 'urgente' ? 'rgba(220,53,69,0.1)' : 'rgba(255,152,0,0.1)';
                const color = analysis.priority === 'urgente' ? '#ef4444' : '#f97316';
                const badgeStr = `<div style="margin-top:0.4rem;display:inline-flex;align-items:center;gap:0.3rem;background:${bg};color:${color};font-size:0.7rem;padding:0.2rem 0.6rem;border-radius:20px;font-weight:600;cursor:help;border:1px solid ${color}44;" title="${this.escapeAttr(analysis.suggestion)}">
                                      ${analysis.emoji} Sugestão IA: ${analysis.title}
                                  </div>`;
                aiCell.innerHTML += badgeStr;
            }
        }
    },

    // ── Modal de histórico ──
    viewHistory(clientName) {
        const all     = DataStore.get(STORAGE_KEYS.CUSTOMERS);
        const history = all
            .filter(c => (c.name || c.client) === clientName)
            .sort((a,b) => (b.lastContactDate||b.contactDate||'').localeCompare(a.lastContactDate||a.contactDate||''));

        const latest = history[0] || {};

        // Cabeçalho com resumo do cliente
        const phone   = latest.phone     || '';
        const company = latest.company   || '';
        const segment = latest.segment   || '';
        const status  = latest.status    || 'Contato';
        const statusColors = { 'Lead':'#818cf8','Prospect':'#EF9F27','Contato':'#EF9F27','Ativo':'#1D9E75','Proposta':'#3b82f6','Fechado':'#1D9E75','Perdido':'#E24B4A','Inativo':'#888' };
        const statusColor = statusColors[status] || '#888';

        let html = `<div style="padding:0.5rem 1rem 1.5rem;">

            <!-- Cabeçalho do cliente -->
            <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.8rem;margin-bottom:1.5rem;padding-bottom:1rem;border-bottom:1px solid rgba(255,255,255,0.07);">
                <div style="display:flex;align-items:center;gap:0.85rem;">
                    <div style="width:46px;height:46px;border-radius:50%;background:rgba(99,102,241,0.2);display:flex;align-items:center;justify-content:center;font-size:1.2rem;font-weight:700;color:#818cf8;flex-shrink:0;">${this.escapeHTML(clientName.charAt(0).toUpperCase())}</div>
                    <div>
                        <div style="font-size:1.05rem;font-weight:700;color:var(--text-main);">${this.escapeHTML(clientName)}</div>
                        ${company ? `<div style="font-size:0.8rem;color:var(--text-muted);">${this.escapeHTML(company)}</div>` : ''}
                        <div style="display:flex;align-items:center;gap:0.5rem;margin-top:0.25rem;flex-wrap:wrap;">
                            <span style="padding:0.13rem 0.55rem;border-radius:20px;font-size:0.7rem;font-weight:600;background:${statusColor}22;color:${statusColor};">${status}</span>
                            ${segment ? `<span style="font-size:0.7rem;color:var(--text-muted);">${this.escapeHTML(segment)}</span>` : ''}
                        </div>
                    </div>
                </div>
                <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
                    ${phone ? `<button onclick="WhatsAppModule.openComposer('${latest.id}')" style="display:flex;align-items:center;gap:0.4rem;padding:0.4rem 0.9rem;border-radius:8px;border:none;background:rgba(37,211,102,0.12);color:#25D366;cursor:pointer;font-size:0.82rem;font-weight:600;"><i class='bx bxl-whatsapp'></i> WhatsApp</button>` : ''}
                    <button onclick="document.getElementById('crm-history-modal').classList.add('hidden'); CRMModule.openEditModal('${latest.id}')" style="display:flex;align-items:center;gap:0.4rem;padding:0.4rem 0.9rem;border-radius:8px;border:none;background:rgba(99,102,241,0.12);color:#818cf8;cursor:pointer;font-size:0.82rem;font-weight:600;"><i class='bx bx-edit'></i> Editar</button>
                </div>
            </div>

            <!-- Dados do cliente (linha de resumo) -->
            <div style="display:flex;flex-wrap:wrap;gap:0.6rem 1.4rem;margin-bottom:1.5rem;font-size:0.81rem;">
                ${phone     ? `<span style="color:var(--text-muted);">📱 <a href="tel:${this.escapeHTML(phone)}" style="color:#25D366;text-decoration:none;">${this.escapeHTML(phone)}</a></span>` : ''}
                ${latest.email     ? `<span style="color:var(--text-muted);">✉️ ${this.escapeHTML(latest.email)}</span>` : ''}
                ${latest.cnpj      ? `<span style="color:var(--text-muted);">🏢 ${this.escapeHTML(latest.cnpj)}</span>` : ''}
                ${latest.instagram ? `<span style="color:var(--text-muted);">📸 ${this.escapeHTML(latest.instagram)}</span>` : ''}
                ${latest.address   ? `<span style="color:var(--text-muted);">📍 ${this.escapeHTML(latest.address)}</span>` : ''}
                ${latest.products  ? `<span style="color:var(--text-muted);">📦 ${this.escapeHTML(latest.products)}</span>` : ''}
            </div>

            <!-- Timeline de contatos -->
            <div style="font-size:0.78rem;font-weight:600;color:var(--text-muted);text-transform:uppercase;letter-spacing:0.07em;margin-bottom:0.8rem;">
                Histórico de Contatos (${history.length})
            </div>`;

        if (!history.length) {
            html += `<p style="color:var(--text-muted);">Nenhum registro encontrado.</p>`;
        } else {
            history.forEach((h, idx) => {
                const rawDate   = h.lastContactDate || h.contactDate || '';
                const date      = rawDate ? rawDate.split('-').reverse().join('/') : '—';
                const notes     = h.notes || '';
                const isWpp     = notes.startsWith('[WhatsApp]');
                const cleanNote = notes.replace(/^\[WhatsApp\]\s*/i, '');
                const isFirst   = idx === 0;

                // Badge de canal
                const channelBadge = isWpp
                    ? `<span style="display:inline-flex;align-items:center;gap:0.2rem;padding:0.1rem 0.45rem;border-radius:20px;font-size:0.65rem;font-weight:600;background:rgba(37,211,102,0.12);color:#25D366;"><i class='bx bxl-whatsapp' style="font-size:0.75rem;"></i>WhatsApp</span>`
                    : `<span style="padding:0.1rem 0.45rem;border-radius:20px;font-size:0.65rem;font-weight:600;background:rgba(99,102,241,0.12);color:#818cf8;">📞 Contato</span>`;

                // Detalhes do contato (se diferentes do último)
                let details = [];
                if (h.buyerName) details.push(`<strong>Comprador:</strong> ${this.escapeHTML(h.buyerName)}`);
                if (h.products && h.products !== latest.products) details.push(`<strong>Produtos:</strong> ${this.escapeHTML(h.products)}`);
                if (h.source)   details.push(`<strong>Origem:</strong> ${this.escapeHTML(h.source)}`);
                if (h.nextFollowUp) {
                    const nf = h.nextFollowUp.split('-').reverse().join('/');
                    details.push(`<strong>Próx. Follow-up:</strong> ${nf}`);
                }

                html += `
                <div style="display:flex;gap:0.9rem;margin-bottom:${idx < history.length-1 ? '1rem' : '0'};">
                    <!-- Linha da timeline -->
                    <div style="display:flex;flex-direction:column;align-items:center;flex-shrink:0;">
                        <div style="width:10px;height:10px;border-radius:50%;background:${isFirst ? '#818cf8' : 'rgba(255,255,255,0.2)'};border:2px solid ${isFirst ? '#818cf8' : 'rgba(255,255,255,0.1)'};margin-top:0.35rem;flex-shrink:0;"></div>
                        ${idx < history.length-1 ? `<div style="width:1px;flex:1;background:rgba(255,255,255,0.07);margin-top:4px;"></div>` : ''}
                    </div>

                    <!-- Conteúdo da entrada -->
                    <div style="flex:1;background:rgba(255,255,255,0.03);border:1px solid rgba(255,255,255,0.06);border-radius:10px;padding:0.85rem 1rem;margin-bottom:0.15rem;">
                        <div style="display:flex;align-items:center;justify-content:space-between;flex-wrap:wrap;gap:0.4rem;margin-bottom:0.5rem;">
                            <div style="display:flex;align-items:center;gap:0.4rem;flex-wrap:wrap;">
                                <span style="font-size:0.82rem;font-weight:700;color:${isFirst ? 'var(--text-main)' : 'var(--text-muted)'};">${date}</span>
                                ${channelBadge}
                                ${isFirst ? `<span style="font-size:0.65rem;color:var(--primary);font-weight:600;">MAIS RECENTE</span>` : ''}
                            </div>
                            <button onclick="document.getElementById('crm-history-modal').classList.add('hidden'); CRMModule.openEditModal('${h.id}')" style="font-size:0.7rem;padding:0.15rem 0.55rem;border-radius:6px;border:1px solid rgba(255,255,255,0.1);background:transparent;color:var(--text-muted);cursor:pointer;">✏️ Editar</button>
                        </div>
                        ${details.length ? `<div style="font-size:0.78rem;color:var(--text-muted);margin-bottom:0.45rem;line-height:1.6;">${details.join(' &nbsp;·&nbsp; ')}</div>` : ''}
                        ${cleanNote
                            ? `<p style="font-size:0.87rem;color:var(--text-main);line-height:1.6;margin:0;white-space:pre-wrap;">${this.escapeHTML(cleanNote)}</p>`
                            : `<p style="font-size:0.82rem;color:rgba(255,255,255,0.2);margin:0;font-style:italic;">Sem anotações para este contato.</p>`
                        }
                    </div>
                </div>`;
            });
        }

        html += `</div>`;

        document.getElementById('crm-history-content').innerHTML = html;
        document.getElementById('crm-history-modal').classList.remove('hidden');
    },

    closeHistoryAndEdit(id) {
        document.getElementById('crm-history-modal').classList.add('hidden');
        this.openEditModal(id);
    },

    escapeHTML(str) {
        if (!str) return '';
        return String(str).replace(/[&<>'"]/g, t =>
            ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[t]));
    },

    // Versão para uso em atributos HTML (escapa aspas simples para uso em onclick='')
    escapeAttr(str) {
        if (!str) return '';
        return String(str).replace(/'/g, "\\'").replace(/"/g, '&quot;');
    }
};

window.CRMModule = CRMModule;

document.addEventListener('DataStoreReady', () => {
    CRMModule.init();
});
