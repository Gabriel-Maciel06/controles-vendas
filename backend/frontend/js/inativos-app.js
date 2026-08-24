const API_BASE_URL = (typeof window !== 'undefined' && window.location && window.location.origin && window.location.origin.includes('localhost')) ? 'http://localhost:8000' : '';

const RATING_INFO = {
    'Boa': { label: 'Boa', color: '#10b981', bg: 'rgba(16, 185, 129, 0.15)' },
    'Média': { label: 'Média', color: '#f59e0b', bg: 'rgba(245, 158, 11, 0.15)' },
    'Ruim': { label: 'Ruim', color: '#ef4444', bg: 'rgba(239, 68, 68, 0.15)' },
    'Péssima': { label: 'Péssima', color: '#8b5cf6', bg: 'rgba(139, 92, 246, 0.15)' }
};

const INATIVOS_STAGES = [
    { id: 'A Contatar', label: 'A Contatar', color: '#f59e0b' },
    { id: 'Em Negociação', label: 'Em Negociação', color: '#6366f1' },
    { id: 'Proposta Enviada', label: 'Proposta Enviada', color: '#3b82f6' },
    { id: 'Reativado', label: 'Reativado / Comprando', color: '#10b981' },
    { id: 'Sem Interesse', label: 'Sem Interesse', color: '#ef4444' }
];

const InativosApp = {
    inactives: [],
    currentPage: 1,
    itemsPerPage: 50,
    currentTab: 'list',

    init() {
        this.cacheDOM();
        this.bindEvents();
        this.loadInactives();
    },

    cacheDOM() {
        this.dom = {
            tableBody: document.getElementById('spreadsheet-body') || 
                       document.getElementById('inativos-tbody') || 
                       document.getElementById('inativos-table-body') || 
                       document.getElementById('crm-inativo-body') || 
                       document.querySelector('tbody'),
            totalCount: document.getElementById('kpi-total-count'),
            contactedCount: document.getElementById('kpi-contacted-count'),
            pendingCount: document.getElementById('kpi-pending-count'),
            filterVendedor: document.getElementById('filter-vendedor'),
            filterCity: document.getElementById('filter-city-inativos') || document.getElementById('filter-city'),
            filterContacted: document.getElementById('filter-contacted-inativos') || document.getElementById('filter-contacted'),
            filterRating: document.getElementById('filter-rating-inativos') || document.getElementById('filter-rating'),
            search: document.getElementById('prospec-search-inativos') || document.getElementById('prospec-search') || document.getElementById('search-inativos'),
            pagination: document.getElementById('inativos-pagination') || document.getElementById('prospec-pagination'),
            form: document.getElementById('simple-register-form'),
            notesModal: document.getElementById('prospec-notes-modal'),
            notesTitle: document.getElementById('notes-modal-title'),
            notesSubtitle: document.getElementById('notes-modal-subtitle'),
            notesText: document.getElementById('notes-modal-text'),
            notesId: document.getElementById('notes-modal-id'),
            tabList: document.getElementById('tab-list'),
            tabKanban: document.getElementById('tab-kanban'),
            tabNew: document.getElementById('tab-new'),
            viewList: document.getElementById('view-list'),
            viewKanban: document.getElementById('view-kanban'),
            viewNew: document.getElementById('view-new')
        };
    },

    bindEvents() {
        if (this._eventsBound) return;

        if (this.dom.tabList) this.dom.tabList.addEventListener('click', () => this.switchTab('list'));
        if (this.dom.tabKanban) this.dom.tabKanban.addEventListener('click', () => this.switchTab('kanban'));
        if (this.dom.tabNew) this.dom.tabNew.addEventListener('click', () => this.switchTab('new'));

        if (this.dom.filterVendedor) this.dom.filterVendedor.addEventListener('change', () => { this.currentPage = 1; this.updateCityFilterOptions(); this.render(); });
        if (this.dom.filterCity) this.dom.filterCity.addEventListener('change', () => { this.currentPage = 1; this.render(); });
        if (this.dom.filterContacted) this.dom.filterContacted.addEventListener('change', () => { this.currentPage = 1; this.render(); });
        if (this.dom.filterRating) this.dom.filterRating.addEventListener('change', () => { this.currentPage = 1; this.render(); });
        if (this.dom.search) this.dom.search.addEventListener('input', () => { this.currentPage = 1; this.render(); });

        if (this.dom.form) {
            this.dom.form.addEventListener('submit', (e) => this.handleSaveNewInativo(e));
        }

        this._eventsBound = true;
    },

    switchTab(tab) {
        this.currentTab = tab;
        [this.dom.tabList, this.dom.tabKanban, this.dom.tabNew].forEach(t => t && t.classList.remove('active'));
        [this.dom.viewList, this.dom.viewKanban, this.dom.viewNew].forEach(v => v && v.classList.add('hidden'));

        if (tab === 'list') {
            if (this.dom.tabList) this.dom.tabList.classList.add('active');
            if (this.dom.viewList) this.dom.viewList.classList.remove('hidden');
        } else if (tab === 'kanban') {
            if (this.dom.tabKanban) this.dom.tabKanban.classList.add('active');
            if (this.dom.viewKanban) this.dom.viewKanban.classList.remove('hidden');
        } else if (tab === 'new') {
            if (this.dom.tabNew) this.dom.tabNew.classList.add('active');
            if (this.dom.viewNew) this.dom.viewNew.classList.remove('hidden');
        }
        this.render();
    },

    async loadInactives() {
        // 1. Tenta carregar do localStorage (APENAS se não estiver vazio!)
        const cached = localStorage.getItem('inativos_app_data');
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    console.log(`[Inativos] Base de dados carregada do localStorage cache (${parsed.length} clientes).`);
                    this.inactives = parsed;
                    this.populateSellersFilter();
                    this.updateCityFilterOptions();
                    this.render();
                    return;
                } else {
                    console.warn('[Inativos] Cache local continha 0 registros. Removendo cache corrompido...');
                    localStorage.removeItem('inativos_app_data');
                }
            } catch (err) {
                localStorage.removeItem('inativos_app_data');
            }
        }

        // 2. Tenta utilizar a base embutida infalível (window.INATIVOS_DATASET)
        if (typeof window !== 'undefined' && Array.isArray(window.INATIVOS_DATASET) && window.INATIVOS_DATASET.length > 0) {
            console.log(`[Inativos] Base de dados embutida (INATIVOS_DATASET) carregada com sucesso (${window.INATIVOS_DATASET.length} clientes).`);
            this.inactives = [...window.INATIVOS_DATASET];
            this.saveLocalCache();
            this.populateSellersFilter();
            this.updateCityFilterOptions();
            this.render();
            return;
        }

        // 3. Tenta buscar do backend FastAPI (se autenticado e online)
        try {
            const token = localStorage.getItem('maciel_token') || sessionStorage.getItem('maciel_token') || '';
            if (token) {
                const res = await fetch(`${API_BASE_URL}/inactives?profile=default`, {
                    headers: { 'Authorization': `Bearer ${token}` }
                });
                if (res.ok) {
                    const data = await res.json();
                    if (Array.isArray(data) && data.length > 0) {
                        this.inactives = data;
                        this.saveLocalCache();
                        this.populateSellersFilter();
                        this.updateCityFilterOptions();
                        this.render();
                        return;
                    }
                }
            }
        } catch (e) {
            console.warn('[Inativos] API offline ou sem token, buscando JSON local...');
        }

        // 4. Múltiplos caminhos de fallback para o dataset JSON estático
        const jsonCandidates = [
            'data/inativos.json',
            './data/inativos.json',
            '/data/inativos.json',
            'app/inativos/data/inativos.json',
            './app/inativos/data/inativos.json',
            '/app/inativos/data/inativos.json',
            '../app/inativos/data/inativos.json'
        ];

        for (const path of jsonCandidates) {
            try {
                const jsonRes = await fetch(path);
                if (jsonRes.ok) {
                    const jsonData = await jsonRes.json();
                    if (Array.isArray(jsonData) && jsonData.length > 0) {
                        console.log(`[Inativos] Base de dados de ${jsonData.length} clientes carregada via fetch de: ${path}`);
                        this.inactives = jsonData;
                        this.saveLocalCache();
                        this.populateSellersFilter();
                        this.updateCityFilterOptions();
                        this.render();
                        return;
                    }
                }
            } catch (e) {}
        }

        console.error('[Inativos] Falha geral de carregamento. Recorrendo a dataset de emergência...');
        this.inactives = (typeof window !== 'undefined' && Array.isArray(window.INATIVOS_DATASET)) ? [...window.INATIVOS_DATASET] : [];
        this.populateSellersFilter();
        this.updateCityFilterOptions();
        this.render();
    },

    populateSellersFilter() {
        if (!this.dom.filterVendedor) return;
        const current = this.dom.filterVendedor.value;
        const sellers = [...new Set(this.inactives.map(p => (p.vendedor || p.vendedorResponsavel || '').toUpperCase()).filter(v => v))].sort();

        if (sellers.length > 0) {
            this.dom.filterVendedor.innerHTML = '<option value="">💼 Todos os Vendedores</option>' +
                sellers.map(v => `<option value="${v}" ${v === current ? 'selected' : ''}>💼 ${v}</option>`).join('');
        }
    },

    saveLocalCache() {
        if (Array.isArray(this.inactives) && this.inactives.length > 0) {
            localStorage.setItem('inativos_app_data', JSON.stringify(this.inactives));
        }
    },

    async updateInactive(id, patch) {
        const item = this.inactives.find(x => x.id === id);
        if (!item) return;
        Object.assign(item, patch, { updatedAt: new Date().toISOString() });
        this.saveLocalCache();

        try {
            const token = localStorage.getItem('maciel_token') || sessionStorage.getItem('maciel_token') || '';
            await fetch(`${API_BASE_URL}/inactives/${id}?profile=default`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(item)
            });
        } catch (e) {}

        this.render();
    },

    updateCityFilterOptions() {
        if (!this.dom.filterCity) return;
        const current = this.dom.filterCity.value;
        const filteredBySeller = this.getSellerInactives();
        const cities = [...new Set(filteredBySeller.map(p => p.city || p.cidade).filter(c => c))].sort();

        this.dom.filterCity.innerHTML = '<option value="">Todas as Cidades</option>' +
            cities.map(c => `<option value="${c}" ${c === current ? 'selected' : ''}>${c}</option>`).join('');
    },

    getSellerInactives() {
        const vendedor = (this.dom.filterVendedor?.value || '').toUpperCase();
        if (!vendedor) return this.inactives;
        return this.inactives.filter(p => (p.vendedor || p.vendedorResponsavel || '').toUpperCase() === vendedor);
    },

    getFilteredInactives() {
        const search = (this.dom.search?.value || '').trim().toLowerCase();
        const city = this.dom.filterCity?.value || '';
        const contacted = this.dom.filterContacted?.value || '';
        const rating = this.dom.filterRating?.value || '';

        return this.getSellerInactives().filter(p => {
            const pCity = p.city || p.cidade || '';
            const pContacted = p.contacted || p.jaFalou || 'Não';
            const pRating = p.rating || p.avaliacao || 'Média';

            if (city && pCity !== city) return false;
            if (contacted && pContacted !== contacted) return false;
            if (rating && pRating !== rating) return false;
            if (search) {
                const cod = (p.codCliente || p.codigoCliente || p.codigo || p.id || '').toLowerCase();
                const name = (p.razaoSocial || p.nomeCliente || p.nomeFantasia || p.nome || p.name || '').toLowerCase();
                const vend = (p.vendedor || p.vendedorResponsavel || '').toLowerCase();
                const reg = (p.region || p.regiao || '').toLowerCase();
                const cit = pCity.toLowerCase();
                const notes = (p.notes || p.anotacoes || '').toLowerCase();
                return cod.includes(search) || name.includes(search) || vend.includes(search) || reg.includes(search) || cit.includes(search) || notes.includes(search);
            }
            return true;
        });
    },

    render() {
        this.updateKPIs();
        if (this.currentTab === 'list') this.renderList();
        if (this.currentTab === 'kanban') this.renderKanban();
    },

    updateKPIs() {
        const filtered = this.getSellerInactives();
        const total = filtered.length;
        const contacted = filtered.filter(p => (p.contacted || p.jaFalou) === 'Sim').length;
        const pending = total - contacted;

        if (this.dom.totalCount) this.dom.totalCount.innerText = total;
        if (this.dom.contactedCount) this.dom.contactedCount.innerText = contacted;
        if (this.dom.pendingCount) this.dom.pendingCount.innerText = pending;
    },

    renderList() {
        if (!this.dom.tableBody) {
            this.dom.tableBody = document.getElementById('spreadsheet-body') || 
                                 document.getElementById('inativos-tbody') || 
                                 document.getElementById('inativos-table-body') || 
                                 document.getElementById('crm-inativo-body') || 
                                 document.querySelector('tbody');
        }
        if (!this.dom.tableBody) return;

        const filtered = this.getFilteredInactives();
        const total = filtered.length;

        if (total === 0) {
            this.dom.tableBody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align:center;padding:2.5rem;color:var(--text-muted);">
                        <i class='bx bx-search-alt' style="font-size:2rem;margin-bottom:0.5rem;display:block;"></i>
                        Nenhum cliente inativo encontrado com os filtros atuais.
                    </td>
                </tr>`;
            if (this.dom.pagination) this.dom.pagination.innerHTML = '';
            return;
        }

        const totalPages = Math.ceil(total / this.itemsPerPage) || 1;
        if (this.currentPage > totalPages) this.currentPage = totalPages;
        if (this.currentPage < 1) this.currentPage = 1;

        const start = (this.currentPage - 1) * this.itemsPerPage;
        const pageItems = filtered.slice(start, start + this.itemsPerPage);

        this.dom.tableBody.innerHTML = pageItems.map(p => {
            const cod = p.codCliente || p.codigoCliente || p.codigo || p.id || '-';
            const name = p.razaoSocial || p.nomeCliente || p.nomeFantasia || p.nome || p.name || 'Cliente Sem Nome';
            const vendor = (p.vendedor || p.vendedorResponsavel || 'GERAL').toUpperCase();
            const contactedVal = p.contacted || p.jaFalou || 'Não';
            const isContacted = contactedVal === 'Sim' || contactedVal === true;
            const cityVal = p.city || p.cidade || '—';
            const regionVal = p.region || p.regiao || '';
            const ratingVal = p.rating || p.avaliacao || 'Média';
            const rInfo = RATING_INFO[ratingVal] || RATING_INFO['Média'];
            const notesVal = p.notes || p.anotacoes || p.observacoes || '';
            const phoneVal = p.phone || p.telefone || p.contato || p.whatsapp || '';
            const phoneDigits = phoneVal.replace(/\D/g, '');
            const wppUrl = phoneDigits ? `https://wa.me/55${phoneDigits}` : '#';

            return `
            <tr style="border-bottom:1px solid rgba(255,255,255,0.05);transition:background 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
                <!-- 1. CÓD. CLIENTE -->
                <td style="padding:0.75rem 0.6rem;">
                    <span style="font-weight:800;font-family:monospace;background:rgba(139,92,246,0.15);color:#a78bfa;padding:3px 7px;border-radius:6px;font-size:0.8rem;border:1px solid rgba(139,92,246,0.3);">
                        #${this.esc(cod)}
                    </span>
                </td>

                <!-- 2. NOME DO CLIENTE -->
                <td style="padding:0.75rem 0.6rem;">
                    <div style="font-weight:700;color:var(--text-main);font-size:0.88rem;line-height:1.25;">
                        ${this.esc(name)}
                    </div>
                    ${phoneDigits ? `
                        <a href="${wppUrl}" target="_blank" style="display:inline-flex;align-items:center;gap:0.25rem;font-size:0.75rem;color:var(--wpp-color);text-decoration:none;font-weight:600;margin-top:0.25rem;">
                            <i class='bx bxl-whatsapp'></i> ${this.esc(phoneVal)}
                        </a>
                    ` : `<div style="font-size:0.72rem;color:var(--text-muted);margin-top:0.2rem;">👤 Contato não informado</div>`}
                </td>

                <!-- 3. VENDEDOR RESPONSÁVEL -->
                <td style="padding:0.75rem 0.6rem;">
                    <span style="display:inline-flex;align-items:center;gap:0.3rem;background:rgba(245,158,11,0.12);color:#f59e0b;font-weight:700;font-size:0.78rem;padding:0.25rem 0.55rem;border-radius:6px;border:1px solid rgba(245,158,11,0.25);">
                        <i class='bx bx-user-voice'></i> ${this.esc(vendor)}
                    </span>
                </td>

                <!-- 4. JÁ FALOU? -->
                <td style="padding:0.75rem 0.6rem;text-align:center;">
                    <button onclick="InativosApp.updateInactive('${p.id}', { contacted: '${isContacted ? 'Não' : 'Sim'}' })"
                            style="padding:0.3rem 0.6rem;border-radius:6px;font-size:0.78rem;font-weight:700;cursor:pointer;border:none;${isContacted ? 'background:rgba(37,211,102,0.15);color:#25D366;border:1px solid rgba(37,211,102,0.3);' : 'background:rgba(255,255,255,0.06);color:var(--text-muted);border:1px solid rgba(255,255,255,0.1);'}">
                        ${isContacted ? '🟢 Já Falou' : '⚪ Não Falou'}
                    </button>
                </td>

                <!-- 5. CIDADE / REGIÃO -->
                <td style="padding:0.75rem 0.6rem;">
                    <div style="font-weight:600;font-size:0.83rem;color:var(--text-main);">${this.esc(cityVal)}</div>
                    <div style="font-size:0.72rem;color:var(--text-muted);">${this.esc(regionVal || '—')}</div>
                </td>

                <!-- 6. AVALIAÇÃO -->
                <td style="padding:0.75rem 0.6rem;">
                    <select class="form-control" style="padding:0.25rem 0.5rem;font-size:0.78rem;font-weight:700;background:${rInfo.bg};color:${rInfo.color};border:1px solid ${rInfo.color}44;border-radius:6px;outline:none;cursor:pointer;"
                            onchange="InativosApp.updateInactive('${p.id}', { rating: this.value })">
                        <option value="Boa" ${ratingVal === 'Boa' ? 'selected' : ''}>🟢 Boa</option>
                        <option value="Média" ${ratingVal === 'Média' ? 'selected' : ''}>🟡 Média</option>
                        <option value="Ruim" ${ratingVal === 'Ruim' ? 'selected' : ''}>🔴 Ruim</option>
                        <option value="Péssima" ${ratingVal === 'Péssima' ? 'selected' : ''}>🟣 Péssima</option>
                    </select>
                </td>

                <!-- 7. ANOTAÇÕES DA CONVERSA (Auto-save + Painel Completo) -->
                <td style="padding:0.65rem 0.6rem;min-width:250px;">
                    <div style="display:flex;flex-direction:column;gap:0.35rem;">
                        <textarea class="form-control" rows="2" placeholder="Digite anotações de contato..."
                                  onchange="InativosApp.updateInactive('${p.id}', { notes: this.value })"
                                  style="width:100%;resize:vertical;min-height:50px;font-size:0.82rem;line-height:1.35;padding:0.4rem;border-radius:6px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03);color:var(--text-main);box-sizing:border-box;"
                                  onfocus="this.style.borderColor='var(--primary)';" onblur="this.style.borderColor='rgba(255,255,255,0.08)';">${this.esc(notesVal)}</textarea>
                        
                        <button onclick="InativosApp.openNotesModal('${p.id}')" style="align-self:flex-end;font-size:0.72rem;padding:0.15rem 0.5rem;border-radius:4px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:var(--text-muted);cursor:pointer;">
                            <i class='bx bx-fullscreen'></i> Painel Completo
                        </button>
                    </div>
                </td>
            </tr>`;
        }).join('');

        this.renderPagination(total, start, start + pageItems.length);
    },

    renderPagination(total, start, end) {
        if (!this.dom.pagination) return;
        const totalPages = Math.ceil(total / this.itemsPerPage) || 1;

        const prevDisabled = this.currentPage === 1 ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : '';
        const nextDisabled = this.currentPage >= totalPages ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : '';

        this.dom.pagination.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:0.8rem 0.5rem;font-size:0.8rem;color:var(--text-muted);">
                <div>Mostrando <strong>${start + 1}–${end}</strong> de <strong>${total}</strong> inativos</div>
                <div style="display:flex;gap:0.5rem;align-items:center;">
                    <button class="btn btn-outline" onclick="InativosApp.changePage(-1)" ${prevDisabled} style="padding:0.35rem 0.75rem;font-size:0.8rem;border-radius:6px;border:1px solid var(--border-color);background:rgba(255,255,255,0.04);color:var(--text-main);cursor:pointer;">&larr; Anterior</button>
                    <span>Página ${this.currentPage} de ${totalPages}</span>
                    <button class="btn btn-outline" onclick="InativosApp.changePage(1)" ${nextDisabled} style="padding:0.35rem 0.75rem;font-size:0.8rem;border-radius:6px;border:1px solid var(--border-color);background:rgba(255,255,255,0.04);color:var(--text-main);cursor:pointer;">Próximo &rarr;</button>
                </div>
            </div>`;
    },

    changePage(delta) {
        this.currentPage += delta;
        this.render();
    },

    // ── Inativos Kanban Funnel & Drag and Drop ──
    renderKanban() {
        const container = document.getElementById('kanban-board-container');
        if (!container) return;

        const stageProspects = {};
        INATIVOS_STAGES.forEach(s => stageProspects[s.id] = []);

        const filtered = this.getFilteredInactives();
        filtered.forEach(p => {
            const stage = p.stage || 'A Contatar';
            if (stageProspects[stage]) stageProspects[stage].push(p);
            else stageProspects['A Contatar'].push(p);
        });

        container.innerHTML = INATIVOS_STAGES.map(s => {
            const list = stageProspects[s.id] || [];
            return `
            <div class="kanban-column"
                 ondragover="InativosApp.handleDragOver(event)"
                 ondragleave="InativosApp.handleDragLeave(event)"
                 ondrop="InativosApp.handleDrop(event, '${s.id}')"
                 style="background:rgba(255,255,255,0.02);border:1px solid var(--border-color);border-radius:10px;padding:0.8rem;display:flex;flex-direction:column;gap:0.8rem;min-height:350px;">
                <div style="font-weight:700;font-size:0.85rem;display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid ${s.color};padding-bottom:0.5rem;">
                    <span>${s.label}</span>
                    <span style="background:rgba(255,255,255,0.08);padding:2px 7px;border-radius:10px;font-size:0.75rem;">${list.length}</span>
                </div>
                
                <div class="kanban-cards-wrap" style="display:flex;flex-direction:column;gap:0.6rem;overflow-y:auto;flex:1;">
                    ${list.length === 0 ? `<div style="text-align:center;padding:1.5rem 0.5rem;font-size:0.75rem;color:var(--text-muted);border:1px dashed var(--border-color);border-radius:8px;">Arraste um inativo aqui</div>` : list.map(p => this.renderKanbanCard(p, s)).join('')}
                </div>
            </div>`;
        }).join('');
    },

    renderKanbanCard(p, stage) {
        const cod = p.codCliente || p.codigoCliente || p.codigo || p.id || '-';
        const name = p.razaoSocial || p.nomeCliente || p.nomeFantasia || p.nome || p.name || 'Cliente Sem Nome';
        const vendor = (p.vendedor || p.vendedorResponsavel || 'GERAL').toUpperCase();
        const cityVal = p.city || p.cidade || '—';
        const regionVal = p.region || p.regiao || '';
        const notesVal = p.notes || p.anotacoes || p.observacoes || '';
        const phoneVal = p.phone || p.telefone || p.contato || p.whatsapp || '';
        const phoneDigits = phoneVal.replace(/\D/g, '');
        const wppUrl = phoneDigits ? `https://wa.me/55${phoneDigits}` : '#';

        const stageOpts = INATIVOS_STAGES
            .filter(x => x.id !== stage.id)
            .map(x => `<option value="${x.id}">${x.label}</option>`)
            .join('');

        return `
        <div class="kanban-card" 
             draggable="true" 
             ondragstart="InativosApp.handleDragStart(event, '${p.id}')"
             ondragend="InativosApp.handleDragEnd(event)"
             style="background:var(--bg-surface);border:1px solid var(--border-color);border-radius:8px;padding:0.7rem;font-size:0.8rem;display:flex;flex-direction:column;gap:0.4rem;cursor:grab;">
            
            <div style="display:flex;justify-content:space-between;align-items:flex-start;">
                <span style="font-weight:800;font-family:monospace;background:rgba(139,92,246,0.15);color:#a78bfa;padding:2px 6px;border-radius:4px;font-size:0.75rem;">
                    #${this.esc(cod)}
                </span>
                <span style="font-size:0.72rem;color:#f59e0b;font-weight:700;">💼 ${this.esc(vendor)}</span>
            </div>

            <div style="font-weight:700;color:var(--text-main);line-height:1.25;">${this.esc(name)}</div>
            <div style="font-size:0.72rem;color:var(--text-muted);">${this.esc(cityVal)} ${regionVal ? '(' + this.esc(regionVal) + ')' : ''}</div>
            
            <!-- Anotações Inline com Bloqueio de Drag -->
            <div style="display:flex;flex-direction:column;gap:0.3rem;" onmousedown="event.stopPropagation()" onpointerdown="event.stopPropagation()">
                <textarea class="form-control" rows="2" placeholder="Digite anotações..."
                          draggable="false"
                          onchange="InativosApp.updateInactive('${p.id}', { notes: this.value })"
                          onmousedown="event.stopPropagation()" onpointerdown="event.stopPropagation()"
                          style="width:100%;resize:vertical;min-height:44px;font-size:0.78rem;line-height:1.3;padding:0.35rem;border-radius:6px;border:1px solid rgba(255,255,255,0.08);background:rgba(0,0,0,0.25);color:var(--text-main);box-sizing:border-box;">${this.esc(notesVal)}</textarea>
                
                <button draggable="false" onclick="InativosApp.openNotesModal('${p.id}')" onmousedown="event.stopPropagation()" onpointerdown="event.stopPropagation()" style="align-self:flex-end;font-size:0.7rem;padding:0.12rem 0.45rem;border-radius:4px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:var(--text-muted);cursor:pointer;">
                    <i class='bx bx-fullscreen'></i> Painel Completo
                </button>
            </div>

            <div style="display:flex;align-items:center;justify-content:space-between;margin-top:0.2rem;padding-top:0.4rem;border-top:1px dashed var(--border-color);" onmousedown="event.stopPropagation()" onpointerdown="event.stopPropagation()">
                ${phoneDigits ? `<a href="${wppUrl}" target="_blank" draggable="false" style="color:#25D366;font-size:0.75rem;text-decoration:none;font-weight:700;display:inline-flex;align-items:center;gap:0.2rem;">
                    <i class='bx bxl-whatsapp'></i> Whats
                </a>` : '<span></span>'}
                
                <select draggable="false" onchange="InativosApp.updateInactive('${p.id}', { stage: this.value })" style="padding:0.2rem 0.4rem;font-size:0.72rem;border-radius:4px;background:rgba(255,255,255,0.05);color:var(--text-main);border:1px solid var(--border-color);cursor:pointer;">
                    <option value="">↪ Mover</option>
                    ${stageOpts}
                </select>
            </div>
        </div>`;
    },

    // ── Drag and Drop Handlers for Inativos ──
    handleDragStart(e, inactiveId) {
        e.dataTransfer.setData('text/plain', inactiveId);
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => {
            if (e.target && e.target.classList) e.target.classList.add('dragging');
        }, 0);
    },

    handleDragEnd(e) {
        if (e.target && e.target.classList) e.target.classList.remove('dragging');
        document.querySelectorAll('.kanban-column, .kanban-cards-wrap').forEach(el => {
            el.classList.remove('drag-over');
        });
    },

    handleDragOver(e) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const col = e.currentTarget.closest('.kanban-column');
        if (col) col.classList.add('drag-over');
    },

    handleDragLeave(e) {
        const col = e.currentTarget.closest('.kanban-column');
        if (col && !col.contains(e.relatedTarget)) {
            col.classList.remove('drag-over');
        }
    },

    async handleDrop(e, targetStageId) {
        e.preventDefault();
        document.querySelectorAll('.kanban-column, .kanban-cards-wrap').forEach(el => {
            el.classList.remove('drag-over');
        });

        const inactiveId = e.dataTransfer.getData('text/plain');
        if (!inactiveId || !targetStageId) return;

        const item = this.inactives.find(x => x.id === inactiveId);
        if (item && item.stage !== targetStageId) {
            await this.updateInactive(inactiveId, { stage: targetStageId });
        }
    },

    openNotesModal(id) {
        const item = this.inactives.find(p => p.id === id);
        if (!item) return;

        this.dom.notesId.value = id;
        this.dom.notesTitle.innerText = `📝 Painel de Reativação — ${item.razaoSocial || item.name || 'Inativo'}`;
        this.dom.notesSubtitle.innerText = `Cód: #${item.codCliente || item.id} | Vendedor: ${item.vendedor || 'GERAL'} | Cidade: ${item.city || '—'} (${item.region || '—'})`;
        this.dom.notesText.value = item.notes || '';
        this.dom.notesModal.classList.remove('hidden');
    },

    insertNoteTimestamp() {
        const now = new Date();
        const dateStr = now.toLocaleDateString('pt-BR');
        const timeStr = now.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
        const stamp = `\n[${dateStr} ${timeStr}] `;
        
        this.dom.notesText.value += stamp;
        this.dom.notesText.focus();
    },

    saveNotesModal() {
        const id = this.dom.notesId.value;
        const text = this.dom.notesText.value;
        this.updateInactive(id, { notes: text });
        this.dom.notesModal.classList.add('hidden');
    },

    handleSaveNewInativo(e) {
        e.preventDefault();
        const codCliente = document.getElementById('reg-codcliente')?.value.trim() || '';
        const razaoSocial = document.getElementById('reg-razaosocial')?.value.trim() || '';
        const vendedor = document.getElementById('reg-vendedor')?.value.trim().toUpperCase() || '';
        const city = document.getElementById('reg-city')?.value.trim() || '';
        const region = document.getElementById('reg-region')?.value.trim() || 'Grande SP';
        const phone = document.getElementById('reg-phone')?.value.trim() || '';
        const rating = document.getElementById('reg-rating')?.value || 'Média';
        const notes = document.getElementById('reg-notes')?.value.trim() || '';

        if (!razaoSocial || !vendedor || !city) {
            alert('Por favor, preencha Razão Social, Vendedor Responsável e Cidade.');
            return;
        }

        const newItem = {
            id: 'in_' + Date.now(),
            codCliente: codCliente || String(Math.floor(1000 + Math.random() * 9000)),
            razaoSocial,
            nomeFantasia: razaoSocial,
            vendedor,
            phone,
            city,
            region,
            contacted: 'Não',
            rating: rating,
            stage: 'A Contatar',
            notes,
            createdAt: new Date().toISOString()
        };

        this.inactives.unshift(newItem);
        this.saveLocalCache();

        try {
            const token = localStorage.getItem('maciel_token') || sessionStorage.getItem('maciel_token') || '';
            fetch(`${API_BASE_URL}/inactives?profile=default`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(newItem)
            });
        } catch (e) {}

        this.dom.form.reset();
        this.updateCityFilterOptions();
        this.switchTab('list');
        alert('✨ Cliente inativo cadastrado com sucesso!');
    },

    esc(str) {
        if (!str) return '';
        return String(str).replace(/[&<>"']/g, match => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[match]));
    }
};

if (typeof document !== 'undefined') {
    if (document.readyState === 'complete' || document.readyState === 'interactive') {
        InativosApp.init();
    } else {
        document.addEventListener('DOMContentLoaded', () => {
            InativosApp.init();
        });
    }
}
