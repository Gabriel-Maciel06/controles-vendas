/**
 * Sistema de Prospecção Simplificado — Core Application Module
 */

const API_BASE_URL = "/api";

const REGIOES = {
    "Grande São Paulo": ["São Paulo", "Guarulhos", "Santo André", "São Bernardo do Campo", "Osasco", "Carapicuíba", "Mauá", "Mogi das Cruzes", "Suzano", "Barueri", "Cotia", "Franco da Rocha", "Arujá"],
    "Interior SP": ["Campinas", "Ribeirão Preto", "São José do Rio Preto", "Sorocaba", "Marília", "Bauru", "Jundiaí", "Piracicaba", "Presidente Prudente", "Indaiatuba", "Borborema", "Jaú", "Mococa", "Uberaba", "Franca"],
    "Zona Leste": ["Itaquaquecetuba", "Ferraz de Vasconcelos", "Mogi das Cruzes"],
    "Litoral SP": ["Santos", "Praia Grande", "Mongaguá", "Guarujá", "Caraguatatuba"],
    "Vale do Paraíba": ["São José dos Campos", "Jacareí", "Taubaté"],
    "Outros Estados": []
};

const RATING_INFO = {
    'Boa':     { label: '🟢 Boa',     bg: 'rgba(16,185,129,0.15)', color: '#10b981' },
    'Média':   { label: '🟡 Média',   bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
    'Ruim':    { label: '🔴 Ruim',    bg: 'rgba(239,68,68,0.15)',  color: '#ef4444' },
    'Péssima': { label: '🟣 Péssima', bg: 'rgba(167,139,250,0.15)',color: '#a78bfa' }
};

const STAGES = [
    { id: 'Novo Prospecto',    label: '🎯 Novo Prospecto',    color: '#6366f1' },
    { id: 'Em Contato',        label: '📞 Em Contato',        color: '#3b82f6' },
    { id: 'Proposta Enviada',  label: '💡 Proposta Enviada',  color: '#f59e0b' },
    { id: 'Em Negociação',     label: '🤝 Em Negociação',     color: '#8b5cf6' },
    { id: 'Fechado / Ganho',   label: '✅ Fechado / Ganho',   color: '#10b981' },
    { id: 'Perdido',           label: '❌ Perdido',           color: '#6b7280' }
];

const ProspecApp = {
    prospects: [],
    currentPage: 1,
    itemsPerPage: 15,
    currentTab: 'list', // 'list', 'kanban', 'new'

    async init() {
        this.cacheDOM();
        this.bindEvents();
        await this.loadProspects();
        this.render();
    },

    cacheDOM() {
        this.dom = {
            // Tabs
            tabList: document.getElementById('tab-list'),
            tabKanban: document.getElementById('tab-kanban'),
            tabNew: document.getElementById('tab-new'),
            viewList: document.getElementById('view-list'),
            viewKanban: document.getElementById('view-kanban'),
            viewNew: document.getElementById('view-new'),

            // Form
            form: document.getElementById('simple-register-form'),
            cityInput: document.getElementById('reg-city'),
            regionInput: document.getElementById('reg-region'),

            // List elements
            tableBody: document.getElementById('spreadsheet-body'),
            totalCount: document.getElementById('kpi-total-count'),
            contactedCount: document.getElementById('kpi-contacted-count'),
            pendingCount: document.getElementById('kpi-pending-count'),
            search: document.getElementById('prospec-search'),
            filterCity: document.getElementById('filter-city'),
            filterContacted: document.getElementById('filter-contacted'),
            filterRating: document.getElementById('filter-rating'),
            pagination: document.getElementById('prospec-pagination'),

            // Kanban
            kanbanBoard: document.getElementById('kanban-board-container'),

            // Notes Modal
            notesModal: document.getElementById('prospec-notes-modal'),
            notesId: document.getElementById('notes-modal-id'),
            notesTitle: document.getElementById('notes-modal-title'),
            notesSub: document.getElementById('notes-modal-subtitle'),
            notesText: document.getElementById('notes-modal-text')
        };
    },

    bindEvents() {
        // Tab switching
        if (this.dom.tabList) this.dom.tabList.onclick = () => this.switchTab('list');
        if (this.dom.tabKanban) this.dom.tabKanban.onclick = () => this.switchTab('kanban');
        if (this.dom.tabNew) this.dom.tabNew.onclick = () => this.switchTab('new');

        // Form city auto-fill
        if (this.dom.cityInput) {
            this.dom.cityInput.oninput = () => this.autoFillRegion();
        }

        if (this.dom.form) {
            this.dom.form.onsubmit = (e) => this.handleSaveProspect(e);
        }

        // Filters
        if (this.dom.search) this.dom.search.oninput = () => { this.currentPage = 1; this.renderList(); };
        if (this.dom.filterCity) this.dom.filterCity.onchange = () => { this.currentPage = 1; this.renderList(); };
        if (this.dom.filterContacted) this.dom.filterContacted.onchange = () => { this.currentPage = 1; this.renderList(); };
        if (this.dom.filterRating) this.dom.filterRating.onchange = () => { this.currentPage = 1; this.renderList(); };
    },

    switchTab(tab) {
        this.currentTab = tab;
        [this.dom.tabList, this.dom.tabKanban, this.dom.tabNew].forEach(t => t && t.classList.remove('active'));
        [this.dom.viewList, this.dom.viewKanban, this.dom.viewNew].forEach(v => v && v.classList.add('hidden'));

        if (tab === 'list') {
            if (this.dom.tabList) this.dom.tabList.classList.add('active');
            if (this.dom.viewList) this.dom.viewList.classList.remove('hidden');
            this.renderList();
        } else if (tab === 'kanban') {
            if (this.dom.tabKanban) this.dom.tabKanban.classList.add('active');
            if (this.dom.viewKanban) this.dom.viewKanban.classList.remove('hidden');
            this.renderKanban();
        } else if (tab === 'new') {
            if (this.dom.tabNew) this.dom.tabNew.classList.add('active');
            if (this.dom.viewNew) this.dom.viewNew.classList.remove('hidden');
        }
    },

    autoFillRegion() {
        if (!this.dom.cityInput || !this.dom.regionInput) return;
        const city = this.dom.cityInput.value.trim().toLowerCase();
        if (!city) {
            this.dom.regionInput.value = '';
            return;
        }

        for (const [reg, cities] of Object.entries(REGIOES)) {
            if (cities.some(c => c.toLowerCase() === city)) {
                this.dom.regionInput.value = reg;
                return;
            }
        }
    },

    // ── Data Sync ──
    async loadProspects() {
        // 1. Tenta carregar do localStorage (APENAS se não estiver vazio!)
        const cached = localStorage.getItem('prospec_app_data');
        if (cached) {
            try {
                const parsed = JSON.parse(cached);
                if (Array.isArray(parsed) && parsed.length > 0) {
                    console.log(`[Prospec] Base de dados carregada do localStorage cache (${parsed.length} prospectos).`);
                    this.prospects = parsed;
                    this.updateCityFilterOptions();
                    return;
                } else {
                    console.warn('[Prospec] Cache local continha 0 registros. Removendo cache corrompido...');
                    localStorage.removeItem('prospec_app_data');
                }
            } catch (err) {
                localStorage.removeItem('prospec_app_data');
            }
        }

        // 2. Tenta utilizar a base embutida infalível (window.PROSPEC_DATASET)
        if (typeof window !== 'undefined' && Array.isArray(window.PROSPEC_DATASET) && window.PROSPEC_DATASET.length > 0) {
            console.log(`[Prospec] Base de dados embutida (PROSPEC_DATASET) carregada com sucesso (${window.PROSPEC_DATASET.length} prospectos).`);
            this.prospects = [...window.PROSPEC_DATASET];
            this.saveLocalCache();
            this.updateCityFilterOptions();
            return;
        }

        // 3. Tenta buscar da API Backend
        try {
            const token = localStorage.getItem('maciel_token') || sessionStorage.getItem('maciel_token') || '';
            const res = await fetch(`${API_BASE_URL}/prospects?profile=default`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            if (res.ok) {
                const data = await res.json();
                if (Array.isArray(data) && data.length > 0) {
                    this.prospects = data;
                    this.saveLocalCache();
                    this.updateCityFilterOptions();
                    return;
                }
            }
        } catch (e) {
            console.warn('[Prospec] API offline ou sem dados, buscando JSON local...');
        }

        // 4. Múltiplos caminhos de fallback para JSON estático
        const jsonCandidates = [
            'data/leads.json',
            './data/leads.json',
            '/data/leads.json',
            'app/prospeccao/data/leads.json',
            './app/prospeccao/data/leads.json',
            '../app/prospeccao/data/leads.json',
            'backend/prospects_dataset.json'
        ];

        for (const path of jsonCandidates) {
            try {
                const jsonRes = await fetch(path);
                if (jsonRes.ok) {
                    const jsonData = await jsonRes.json();
                    if (Array.isArray(jsonData) && jsonData.length > 0) {
                        console.log(`[Prospec] Base de dados de ${jsonData.length} prospectos carregada via fetch de: ${path}`);
                        this.prospects = jsonData;
                        this.saveLocalCache();
                        this.updateCityFilterOptions();
                        return;
                    }
                }
            } catch (e) {}
        }

        console.error('[Prospec] Falha geral de carregamento. Recorrendo a dataset de emergência...');
        this.prospects = (typeof window !== 'undefined' && Array.isArray(window.PROSPEC_DATASET)) ? [...window.PROSPEC_DATASET] : [];
        this.updateCityFilterOptions();
    },

    saveLocalCache() {
        if (Array.isArray(this.prospects) && this.prospects.length > 0) {
            localStorage.setItem('prospec_app_data', JSON.stringify(this.prospects));
        }
    },

    async updateProspect(id, patch) {
        const p = this.prospects.find(x => x.id === id);
        if (!p) return;
        Object.assign(p, patch, { updatedAt: new Date().toISOString() });
        this.saveLocalCache();

        try {
            const token = localStorage.getItem('maciel_token') || sessionStorage.getItem('maciel_token') || '';
            await fetch(`${API_BASE_URL}/prospects/${id}?profile=default`, {
                method: 'PUT',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(p)
            });
        } catch (e) {}

        this.render();
    },

    async handleSaveProspect(e) {
        e.preventDefault();

        const razaoSocial = document.getElementById('reg-razaosocial').value.trim();
        const buyer       = document.getElementById('reg-buyer').value.trim();
        const phone       = document.getElementById('reg-phone').value.trim();
        const city        = document.getElementById('reg-city').value.trim();
        const region      = document.getElementById('reg-region').value.trim();
        const instagram   = document.getElementById('reg-instagram').value.trim();
        const notes       = document.getElementById('reg-notes').value.trim();

        if (!razaoSocial || !phone || !city) {
            alert('Por favor, preencha Razão Social, Telefone e Cidade.');
            return;
        }

        const newP = {
            id: 'p_' + Date.now(),
            razaoSocial,
            buyer,
            phone,
            city,
            region: region || 'Outros',
            instagram,
            notes,
            contacted: 'Não',
            rating: 'Média',
            stage: 'Novo Prospecto',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };

        this.prospects.unshift(newP);
        this.saveLocalCache();

        try {
            const token = localStorage.getItem('maciel_token') || sessionStorage.getItem('maciel_token') || '';
            await fetch(`${API_BASE_URL}/prospects?profile=default`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}` },
                body: JSON.stringify(newP)
            });
        } catch (e) {}

        this.dom.form.reset();
        this.updateCityFilterOptions();
        this.switchTab('list');
        alert('✨ Novo prospecto cadastrado com sucesso!');
    },

    updateCityFilterOptions() {
        if (!this.dom.filterCity) return;
        const current = this.dom.filterCity.value;
        const cities = [...new Set(this.prospects.map(p => p.city).filter(c => c))].sort();

        this.dom.filterCity.innerHTML = '<option value="">Todas as Cidades</option>' +
            cities.map(c => `<option value="${c}" ${c === current ? 'selected' : ''}>${c}</option>`).join('');
    },

    // ── Renderization ──
    render() {
        this.updateKPIs();
        if (this.currentTab === 'list') this.renderList();
        if (this.currentTab === 'kanban') this.renderKanban();
    },

    updateKPIs() {
        const total = this.prospects.length;
        const contacted = this.prospects.filter(p => p.contacted === 'Sim').length;
        const pending = total - contacted;

        if (this.dom.totalCount) this.dom.totalCount.innerText = total;
        if (this.dom.contactedCount) this.dom.contactedCount.innerText = contacted;
        if (this.dom.pendingCount) this.dom.pendingCount.innerText = pending;
    },

    getFilteredProspects() {
        const search = (this.dom.search?.value || '').trim().toLowerCase();
        const city = this.dom.filterCity?.value || '';
        const contacted = this.dom.filterContacted?.value || '';
        const rating = this.dom.filterRating?.value || '';

        return this.prospects.filter(p => {
            if (city && p.city !== city) return false;
            if (contacted && p.contacted !== contacted) return false;
            if (rating && p.rating !== rating) return false;
            if (search) {
                const name = (p.razaoSocial || p.name || '').toLowerCase();
                const phone = (p.phone || '').toLowerCase();
                const buyer = (p.buyer || '').toLowerCase();
                const notes = (p.notes || '').toLowerCase();
                return name.includes(search) || phone.includes(search) || buyer.includes(search) || notes.includes(search);
            }
            return true;
        });
    },

    renderList() {
        if (!this.dom.tableBody) return;
        const filtered = this.getFilteredProspects();
        const total = filtered.length;

        if (total === 0) {
            this.dom.tableBody.innerHTML = `
                <tr>
                    <td colspan="7" style="text-align:center;padding:2.5rem;color:var(--text-muted);">
                        <i class='bx bx-search-alt' style="font-size:2rem;margin-bottom:0.5rem;display:block;"></i>
                        Nenhum prospecto encontrado com os filtros atuais.
                    </td>
                </tr>`;
            return;
        }

        const start = (this.currentPage - 1) * this.itemsPerPage;
        const pageItems = filtered.slice(start, start + this.itemsPerPage);

        this.dom.tableBody.innerHTML = pageItems.map(p => {
            const isContacted = p.contacted === 'Sim';
            const rInfo = RATING_INFO[p.rating] || RATING_INFO['Média'];
            const phoneDigits = (p.phone || '').replace(/\D/g, '');
            const wppUrl = phoneDigits ? `https://wa.me/55${phoneDigits}` : '#';

            return `
            <tr>
                <!-- Cliente / Empresa -->
                <td>
                    <div style="font-weight:700;color:var(--text-main);font-size:0.9rem;">${this.esc(p.razaoSocial || p.name || 'Sem Nome')}</div>
                    <div style="font-size:0.75rem;color:var(--text-muted);">👤 ${this.esc(p.buyer || 'Contato não informado')}</div>
                </td>

                <!-- Telefone / WhatsApp -->
                <td>
                    <div style="display:flex;align-items:center;gap:0.4rem;">
                        <a href="${wppUrl}" target="_blank" class="btn btn-outline btn-sm" style="color:var(--wpp-color);border-color:rgba(37,211,102,0.3);padding:0.25rem 0.6rem;">
                            <i class='bx bxl-whatsapp' style="font-size:1.1rem;"></i> ${this.esc(p.phone || '—')}
                        </a>
                    </div>
                </td>

                <!-- Já Falou? -->
                <td style="text-align:center;">
                    <span class="badge-status ${isContacted ? 'badge-contacted-yes' : 'badge-contacted-no'}"
                          onclick="ProspecApp.updateProspect('${p.id}', { contacted: '${isContacted ? 'Não' : 'Sim'}' })">
                        ${isContacted ? '🟢 Já Falou' : '⚪ Não Falou'}
                    </span>
                </td>

                <!-- Avaliação -->
                <td>
                    <select class="form-control" style="padding:0.25rem 0.5rem;font-size:0.78rem;font-weight:700;background:${rInfo.bg};color:${rInfo.color};border:1px solid ${rInfo.color}44;"
                            onchange="ProspecApp.updateProspect('${p.id}', { rating: this.value })">
                        <option value="Boa" ${p.rating === 'Boa' ? 'selected' : ''}>🟢 Boa</option>
                        <option value="Média" ${p.rating === 'Média' ? 'selected' : ''}>🟡 Média</option>
                        <option value="Ruim" ${p.rating === 'Ruim' ? 'selected' : ''}>🔴 Ruim</option>
                        <option value="Péssima" ${p.rating === 'Péssima' ? 'selected' : ''}>🟣 Péssima</option>
                    </select>
                </td>

                <!-- Cidade / Região -->
                <td>
                    <div style="font-weight:600;font-size:0.83rem;">${this.esc(p.city || '—')}</div>
                    <div style="font-size:0.73rem;color:var(--text-muted);">${this.esc(p.region || '—')}</div>
                </td>

                <!-- Anotações (Textarea Expansível + Botão Tela Cheia) -->
                <td style="min-width:280px;">
                    <div style="display:flex;flex-direction:column;gap:0.35rem;">
                        <textarea class="form-control" rows="2" placeholder="Anotações da conversa..."
                                  onchange="ProspecApp.updateProspect('${p.id}', { notes: this.value })"
                                  style="resize:vertical;min-height:54px;font-size:0.82rem;line-height:1.35;"
                                  onfocus="this.style.minHeight='90px';" onblur="if(!this.value.trim())this.style.minHeight='54px';">${this.esc(p.notes || '')}</textarea>
                        <button class="btn btn-outline btn-sm" onclick="ProspecApp.openNotesModal('${p.id}')" style="align-self:flex-end;font-size:0.72rem;padding:0.15rem 0.5rem;color:var(--text-muted);">
                            <i class='bx bx-fullscreen'></i> Painel Completo
                        </button>
                    </div>
                </td>

                <!-- Ações -->
                <td style="text-align:center;">
                    <button class="btn btn-outline btn-sm" onclick="ProspecApp.deleteProspect('${p.id}')" title="Excluir" style="color:var(--danger);border-color:rgba(239,68,68,0.3);">
                        <i class='bx bx-trash'></i>
                    </button>
                </td>
            </tr>`;
        }).join('');

        this.renderPagination(total, start, start + pageItems.length);
    },

    renderPagination(total, start, end) {
        if (!this.dom.pagination) return;
        const totalPages = Math.ceil(total / this.itemsPerPage) || 1;

        this.dom.pagination.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;margin-top:1rem;font-size:0.82rem;color:var(--text-muted);">
                <div>Mostrando ${total > 0 ? start + 1 : 0} até ${end} de ${total} prospectos</div>
                <div style="display:flex;gap:0.4rem;">
                    <button class="btn btn-outline btn-sm" ${this.currentPage <= 1 ? 'disabled style="opacity:0.4"' : ''} onclick="ProspecApp.changePage(-1)">Anterior</button>
                    <span style="padding:0.3rem 0.6rem;font-weight:700;color:var(--text-main);">${this.currentPage} / ${totalPages}</span>
                    <button class="btn btn-outline btn-sm" ${this.currentPage >= totalPages ? 'disabled style="opacity:0.4"' : ''} onclick="ProspecApp.changePage(1)">Próxima</button>
                </div>
            </div>`;
    },

    changePage(delta) {
        this.currentPage += delta;
        this.renderList();
    },

    // ── Kanban Funnel Screen ──
    renderKanban() {
        if (!this.dom.kanbanBoard) return;

        const stageProspects = {};
        STAGES.forEach(s => stageProspects[s.id] = []);

        this.prospects.forEach(p => {
            const stage = p.stage || 'Novo Prospecto';
            if (stageProspects[stage]) stageProspects[stage].push(p);
            else stageProspects['Novo Prospecto'].push(p);
        });

        this.dom.kanbanBoard.innerHTML = STAGES.map(s => {
            const list = stageProspects[s.id] || [];
            return `
            <div class="kanban-column">
                <div class="kanban-col-header" style="border-top:3px solid ${s.color};">
                    <div class="kanban-col-title">${s.label}</div>
                    <span class="kanban-col-count">${list.length}</span>
                </div>
                <div class="kanban-cards-wrap">
                    ${list.length === 0 ? `<div style="text-align:center;padding:1.5rem 0.5rem;font-size:0.75rem;color:var(--text-muted);border:1px dashed var(--border-color);border-radius:8px;">Vazio</div>` : list.map(p => this.renderKanbanCard(p, s)).join('')}
                </div>
            </div>`;
        }).join('');
    },

    renderKanbanCard(p, stage) {
        const phoneDigits = (p.phone || '').replace(/\D/g, '');
        const wppUrl = phoneDigits ? `https://wa.me/55${phoneDigits}` : '#';

        const stageOpts = STAGES
            .filter(x => x.id !== stage.id)
            .map(x => `<option value="${x.id}">${x.label}</option>`)
            .join('');

        return `
        <div class="kanban-card">
            <div class="kanban-card-title">${this.esc(p.razaoSocial || p.name || 'Sem Nome')}</div>
            <div class="kanban-card-sub">👤 ${this.esc(p.buyer || 'Contato')} • ${this.esc(p.city || '')}</div>
            ${p.notes ? `<div style="font-size:0.75rem;color:var(--text-muted);background:rgba(255,255,255,0.03);padding:0.4rem;border-radius:6px;line-height:1.3;">${this.esc(p.notes)}</div>` : ''}
            
            <div class="kanban-card-footer">
                <a href="${wppUrl}" target="_blank" class="btn btn-outline btn-sm" style="color:var(--wpp-color);border-color:rgba(37,211,102,0.3);padding:0.2rem 0.5rem;">
                    <i class='bx bxl-whatsapp'></i> WhatsApp
                </a>
                <select class="form-control" style="width:auto;padding:0.2rem 0.4rem;font-size:0.72rem;" onchange="ProspecApp.updateProspect('${p.id}', { stage: this.value })">
                    <option value="">↪ Mover</option>
                    ${stageOpts}
                </select>
            </div>
        </div>`;
    },

    // ── Expanded Notes Modal ──
    openNotesModal(id) {
        const p = this.prospects.find(x => x.id === id);
        if (!p || !this.dom.notesModal) return;

        this.dom.notesId.value = p.id;
        this.dom.notesTitle.innerText = `📝 Anotações — ${p.razaoSocial || p.name}`;
        this.dom.notesSub.innerText = `Telefone: ${p.phone || '—'} | Cidade: ${p.city || '—'} ${p.region ? '(' + p.region + ')' : ''}`;
        this.dom.notesText.value = p.notes || '';

        this.dom.notesModal.classList.remove('hidden');
        setTimeout(() => this.dom.notesText.focus(), 100);
    },

    insertNoteTimestamp() {
        if (!this.dom.notesText) return;
        const now = new Date();
        const stamp = `[${now.toLocaleDateString('pt-BR')} ${now.toLocaleTimeString('pt-BR', {hour:'2-digit',minute:'2-digit'})}] - `;
        this.dom.notesText.value = stamp + this.dom.notesText.value;
        this.dom.notesText.focus();
    },

    async saveNotesModal() {
        const id = this.dom.notesId.value;
        const notes = this.dom.notesText.value.trim();
        await this.updateProspect(id, { notes });
        this.dom.notesModal.classList.add('hidden');
    },

    async deleteProspect(id) {
        if (!confirm('Deseja realmente excluir este prospecto?')) return;
        this.prospects = this.prospects.filter(p => p.id !== id);
        this.saveLocalCache();

        try {
            const token = localStorage.getItem('maciel_token') || sessionStorage.getItem('maciel_token') || '';
            await fetch(`${API_BASE_URL}/prospects/${id}?profile=default`, {
                method: 'DELETE',
                headers: { 'Authorization': `Bearer ${token}` }
            });
        } catch (e) {}

        this.render();
    },

    esc(str) {
        if (!str) return '';
        return String(str).replace(/[&<>'"]/g, t =>
            ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[t]));
    }
};

window.ProspecApp = ProspecApp;

document.addEventListener('DOMContentLoaded', () => {
    ProspecApp.init();
});
