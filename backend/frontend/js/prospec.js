/**
 * Prospec (Prospecção) Module - Excel Spreadsheet Style
 */

const REGIOES = {
    "Grande São Paulo": ["São Paulo", "Guarulhos", "Santo André", "São Bernardo do Campo", 
                         "Osasco", "Carapicuíba", "Mauá", "Mogi das Cruzes", "Suzano",
                         "Barueri", "Cotia", "Franco da Rocha", "Arujá"],
    "Interior SP": ["Campinas", "Ribeirão Preto", "São José do Rio Preto", "Sorocaba",
                    "Marília", "Bauru", "Jundiaí", "Piracicaba", "Presidente Prudente",
                    "Indaiatuba", "Borborema", "Jaú", "Mococa"],
    "Zona Leste": ["Itaquaquecetuba", "Ferraz de Vasconcelos", "Mogi das Cruzes"],
    "Zona Norte": ["São Paulo (Zona Norte)"],
    "Zona Sul": ["São Paulo (Zona Sul)", "Mongaguá", "Praia Grande"],
    "Zona Oeste": ["São Paulo (Zona Oeste)"],
    "Centro SP": ["São Paulo (Centro)"],
    "Litoral Sul": ["Santos", "Praia Grande", "Mongaguá"],
    "Vale do Paraíba": ["São José dos Campos", "Jacareí"],
    "Jundiaí e Região": ["Jundiaí", "Sumaré", "Mogi Guaçu", "Campinas"],
    "Sorocaba e Região": ["Sorocaba", "Araçoiaba da Serra"],
    "Bragança e Região": ["Bragança Paulista"],
    "Rio de Janeiro": ["Nova Iguaçu"],
    "Rondônia": ["São Miguel d'Guaporé"],
    "Santa Catarina": []
};

const RATING_COLORS = {
    'Boa': { bg: 'rgba(37,211,102,0.15)', color: '#25D366', label: '🟢 Boa' },
    'Média': { bg: 'rgba(239,159,39,0.15)', color: '#EF9F27', label: '🟡 Média' },
    'Ruim': { bg: 'rgba(226,75,74,0.15)', color: '#E24B4A', label: '🔴 Ruim' },
    'Péssima': { bg: 'rgba(139,92,246,0.15)', color: '#a78bfa', label: '🟣 Péssima' }
};

const ProspecModule = {
    prospects: [],
    filteredProspects: [],
    currentPage: 1,
    itemsPerPage: 20,
    
    init() {
        this.cacheDOM();
        this.bindEvents();
        this.loadProspects();
    },

    cacheDOM() {
        this.dom = {
            form: document.getElementById('prospec-form'),
            razaoSocial: document.getElementById('prospec-razaosocial'),
            cnpj: document.getElementById('prospec-cnpj'),
            phone: document.getElementById('prospec-phone'),
            city: document.getElementById('prospec-city'),
            region: document.getElementById('prospec-region'),
            porte: document.getElementById('prospec-porte'),
            instagram: document.getElementById('prospec-instagram'),
            notes: document.getElementById('prospec-notes'),
            listBody: document.getElementById('prospec-table-body'),
            totalCount: document.getElementById('prospec-total-count'),
            contactedCount: document.getElementById('prospec-contacted-count'),
            pendingCount: document.getElementById('prospec-pending-count'),
            filterCity: document.getElementById('prospec-filter-city'),
            filterContacted: document.getElementById('prospec-filter-contacted'),
            filterRating: document.getElementById('prospec-filter-rating'),
            search: document.getElementById('prospec-search'),
            pagination: document.getElementById('prospec-pagination')
        };
    },

    bindEvents() {
        if (this._eventsBound) return;
        
        if (this.dom.form) {
            this.dom.form.addEventListener('submit', (e) => this.saveProspect(e));
        }

        if (this.dom.city) {
            this.dom.city.addEventListener('input', () => this.autoFillRegion());
        }

        if (this.dom.filterCity) this.dom.filterCity.addEventListener('change', () => { this.currentPage = 1; this.renderList(); });
        if (this.dom.filterContacted) this.dom.filterContacted.addEventListener('change', () => { this.currentPage = 1; this.renderList(); });
        if (this.dom.filterRating) this.dom.filterRating.addEventListener('change', () => { this.currentPage = 1; this.renderList(); });
        if (this.dom.search) this.dom.search.addEventListener('input', () => { this.currentPage = 1; this.renderList(); });
        
        this._eventsBound = true;
    },

    autoFillRegion() {
        if (!this.dom.city || !this.dom.region) return;
        const city = this.dom.city.value.trim();
        if (!city) {
            this.dom.region.value = "";
            return;
        }

        let foundRegion = "";
        for (const [reg, cities] of Object.entries(REGIOES)) {
            if (cities.some(c => c.toLowerCase() === city.toLowerCase())) {
                foundRegion = reg;
                break;
            }
        }
        
        this.dom.region.value = foundRegion || "Outra";
    },

    async loadProspects() {
        try {
            const profile = sessionStorage.getItem('maciel_profile') || 'default';
            const res = await fetch(`${API_BASE_URL}/prospects?profile=${profile}`, {
                headers: getAuthHeaders()
            });
            if (res.ok) {
                this.prospects = await res.json();
                this.updateFilters();
                this.updateIndicators();
                this.renderList();
            }
        } catch (e) {
            console.error("Erro ao carregar prospectos", e);
        }
    },

    updateFilters() {
        if (!this.dom.filterCity) return;
        
        const cities = [...new Set(this.prospects.map(p => p.city).filter(c => c))].sort();
        const currentSelected = this.dom.filterCity.value;
        
        this.dom.filterCity.innerHTML = '<option value="">Todas as Cidades</option>';
        cities.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c;
            opt.innerText = c;
            if (c === currentSelected) opt.selected = true;
            this.dom.filterCity.appendChild(opt);
        });
    },

    updateIndicators() {
        const total = this.prospects.length;
        const contacted = this.prospects.filter(p => p.contacted === 'Sim').length;
        const pending = total - contacted;

        if (this.dom.totalCount) this.dom.totalCount.innerText = total;
        if (this.dom.contactedCount) this.dom.contactedCount.innerText = contacted;
        if (this.dom.pendingCount) this.dom.pendingCount.innerText = pending;
    },

    changePage(delta) {
        this.currentPage += delta;
        this.renderCurrentPage();
    },

    async updateProspectField(id, data) {
        try {
            const res = await fetch(`${API_BASE_URL}/prospects/${id}`, {
                method: 'PUT',
                headers: getAuthHeaders(),
                body: JSON.stringify(data)
            });

            if (res.ok) {
                const updated = await res.json();
                const idx = this.prospects.findIndex(p => p.id === id);
                if (idx > -1) {
                    this.prospects[idx] = { ...this.prospects[idx], ...updated };
                }
                this.updateIndicators();
            } else {
                console.error("Erro ao salvar campo de prospecto");
            }
        } catch (e) {
            console.error("Erro na requisição PUT de prospecto:", e);
        }
    },

    async saveProspect(e) {
        e.preventDefault();
        if (this._submitting) return;
        this._submitting = true;
        
        const btnSubmit = this.dom.form.querySelector('button[type="submit"]');
        const originalText = btnSubmit ? btnSubmit.innerHTML : '';
        if (btnSubmit) {
            btnSubmit.innerHTML = 'Salvando... <i class="bx bx-loader-alt bx-spin"></i>';
            btnSubmit.disabled = true;
        }
        
        const razaoSocial = this.dom.razaoSocial.value.trim().toUpperCase();
        const cnpj = this.dom.cnpj ? this.dom.cnpj.value.trim() : '';
        const phone = this.dom.phone.value.trim();
        const city = this.dom.city.value.trim();
        const region = this.dom.region ? this.dom.region.value.trim() : '';
        const porte = this.dom.porte ? this.dom.porte.value : 'Médio';
        const instagram = this.dom.instagram ? this.dom.instagram.value.trim() : '';
        const notes = this.dom.notes ? this.dom.notes.value.trim() : '';

        const profile = sessionStorage.getItem('maciel_profile') || 'default';
        const now = new Date().toISOString();

        const prospectData = {
            id: 'pros_' + Date.now() + Math.floor(Math.random()*1000),
            profile,
            razaoSocial: razaoSocial.toUpperCase(),
            cnpj,
            phone,
            city,
            region,
            porte,
            instagram,
            notes,
            status: 'Novo',
            contacted: 'Não',
            rating: null,
            createdAt: now,
            updatedAt: now
        };

        try {
            const res = await fetch(`${API_BASE_URL}/prospects`, {
                method: 'POST',
                headers: getAuthHeaders(),
                body: JSON.stringify(prospectData)
            });

            if (res.ok) {
                const saved = await res.json();
                this.prospects.unshift(saved);
                this.dom.form.reset();
                
                const modal = document.getElementById('prospec-add-modal');
                if (modal) modal.classList.add('hidden');

                this.updateFilters();
                this.updateIndicators();
                this.renderList();
                alert('✅ Prospecto cadastrado com sucesso!');
            } else {
                alert('Erro ao salvar prospecto.');
            }
        } catch (e) {
            console.error(e);
            alert('Erro de conexão.');
        } finally {
            this._submitting = false;
            if (btnSubmit) {
                btnSubmit.innerHTML = originalText;
                btnSubmit.disabled = false;
            }
        }
    },

    async sendToCrm(id) {
        if (!confirm('Deseja enviar este estabelecimento para o CRM?')) return;

        try {
            const res = await fetch(`${API_BASE_URL}/prospects/${id}/send-to-crm`, {
                method: 'POST',
                headers: getAuthHeaders()
            });

            if (res.ok) {
                const result = await res.json();
                const pIndex = this.prospects.findIndex(p => p.id === id);
                if (pIndex > -1) {
                    this.prospects[pIndex].status = 'Enviado';
                    this.prospects[pIndex].crmCustomerId = result.customerId;
                    this.prospects[pIndex].sentToCrmAt = new Date().toISOString();
                }
                this.renderList();
                this.updateIndicators();
                
                if (window.CRMModule) {
                    CRMModule.loadAlerts();
                }
                alert('✅ Sucesso! Enviado para o CRM como cliente em prospecção.');
            } else {
                const err = await res.json();
                alert(err.detail || 'Erro ao enviar para CRM.');
            }
        } catch (e) {
            console.error(e);
            alert('Erro de conexão.');
        }
    },

    async deleteProspect(id) {
        if (!confirm('Tem certeza que deseja excluir esta prospecção permanentemente?')) return;

        try {
            const res = await fetch(`${API_BASE_URL}/prospects/${id}`, {
                method: 'DELETE',
                headers: getAuthHeaders()
            });

            if (res.ok) {
                this.prospects = this.prospects.filter(p => p.id !== id);
                this.updateFilters();
                this.updateIndicators();
                this.renderList();
            }
        } catch (e) {
            console.error(e);
            alert('Erro de conexão ao excluir.');
        }
    },

    renderList() {
        let filtered = [...this.prospects];
        
        if (this.dom.filterCity && this.dom.filterCity.value) {
            filtered = filtered.filter(p => p.city === this.dom.filterCity.value);
        }

        if (this.dom.filterContacted && this.dom.filterContacted.value) {
            const val = this.dom.filterContacted.value;
            filtered = filtered.filter(p => (p.contacted || 'Não') === val);
        }

        if (this.dom.filterRating && this.dom.filterRating.value) {
            filtered = filtered.filter(p => p.rating === this.dom.filterRating.value);
        }

        if (this.dom.search && this.dom.search.value) {
            const s = this.dom.search.value.toLowerCase().trim();
            filtered = filtered.filter(p => 
                (p.razaoSocial && p.razaoSocial.toLowerCase().includes(s)) ||
                (p.phone && p.phone.includes(s)) ||
                (p.city && p.city.toLowerCase().includes(s)) ||
                (p.notes && p.notes.toLowerCase().includes(s))
            );
        }

        // Ordenar: Primeiro os com rating ou anotados, depois por id/data
        filtered.sort((a,b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

        this.filteredProspects = filtered;
        this.renderCurrentPage();
    },

    renderCurrentPage() {
        if (!this.dom.listBody) return;

        const total = this.filteredProspects.length;
        const totalPages = Math.ceil(total / this.itemsPerPage) || 1;
        if (this.currentPage > totalPages) this.currentPage = totalPages;
        if (this.currentPage < 1) this.currentPage = 1;

        const start = (this.currentPage - 1) * this.itemsPerPage;
        const end = Math.min(start + this.itemsPerPage, total);
        const sliced = this.filteredProspects.slice(start, end);

        if (!sliced.length) {
            this.dom.listBody.innerHTML = `<tr><td colspan="7" style="text-align:center;padding:2.5rem;color:var(--text-muted);">Nenhuma prospecção encontrada.</td></tr>`;
            if (this.dom.pagination) this.dom.pagination.innerHTML = '';
            return;
        }

        this.dom.listBody.innerHTML = sliced.map(p => {
            const cleanPhone = (p.phone || '').replace(/\D/g, '');
            const wappUrl = cleanPhone ? `https://wa.me/55${cleanPhone}` : '#';
            const initial = (p.razaoSocial || 'P').charAt(0).toUpperCase();

            const isContacted = (p.contacted || 'Não') === 'Sim';
            const contactedStyle = isContacted 
                ? 'background:rgba(37,211,102,0.12);color:#25D366;border:1px solid rgba(37,211,102,0.3);font-weight:700;'
                : 'background:rgba(255,255,255,0.04);color:var(--text-muted);border:1px solid rgba(255,255,255,0.1);';

            const rating = p.rating || '';
            const rInfo = RATING_COLORS[rating] || { bg: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)', label: '— Sem nota' };

            return `
            <tr id="prosp-row-${p.id}" style="border-bottom:1px solid rgba(255,255,255,0.05);transition:background 0.15s;" onmouseover="this.style.background='rgba(255,255,255,0.02)'" onmouseout="this.style.background='transparent'">
                <!-- Cliente / Nome -->
                <td style="padding:0.75rem 0.6rem;">
                    <div style="display:flex;align-items:center;gap:0.6rem;">
                        <div style="width:32px;height:32px;border-radius:50%;background:rgba(99,102,241,0.15);display:flex;align-items:center;justify-content:center;font-size:0.8rem;font-weight:700;color:#818cf8;flex-shrink:0;">${initial}</div>
                        <div>
                            <div style="font-weight:600;color:var(--text-main);font-size:0.87rem;line-height:1.2;">${this.escapeHTML(p.razaoSocial)}</div>
                            ${p.cnpj ? `<div style="font-size:0.72rem;color:var(--text-muted);margin-top:2px;">CNPJ: ${this.escapeHTML(p.cnpj)}</div>` : ''}
                        </div>
                    </div>
                </td>

                <!-- Telefone / WhatsApp Direct Link -->
                <td style="padding:0.75rem 0.6rem;">
                    ${cleanPhone ? `
                        <a href="${wappUrl}" target="_blank" rel="noopener" 
                           title="Clique para iniciar conversa no WhatsApp" 
                           style="display:inline-flex;align-items:center;gap:0.35rem;color:#25D366;font-weight:600;font-size:0.84rem;text-decoration:none;background:rgba(37,211,102,0.08);padding:0.3rem 0.6rem;border-radius:8px;border:1px solid rgba(37,211,102,0.2);transition:all 0.2s;"
                           onmouseover="this.style.background='rgba(37,211,102,0.2)'" onmouseout="this.style.background='rgba(37,211,102,0.08)'">
                            <i class='bx bxl-whatsapp' style="font-size:1.05rem;"></i> ${this.escapeHTML(p.phone)}
                        </a>
                    ` : '<span style="font-size:0.78rem;color:rgba(255,255,255,0.2);">sem telefone</span>'}
                </td>

                <!-- Já Falou? (Interactive Select) -->
                <td style="padding:0.75rem 0.6rem;text-align:center;">
                    <select onchange="ProspecModule.updateProspectField('${p.id}', { contacted: this.value }); ProspecModule.updateRowStyle('${p.id}', this.value)"
                            style="padding:0.3rem 0.5rem;border-radius:8px;font-size:0.78rem;outline:none;cursor:pointer;${contactedStyle}">
                        <option value="Não" ${!isContacted ? 'selected' : ''}>⚪ Não Falou</option>
                        <option value="Sim" ${isContacted ? 'selected' : ''}>🟢 Já Falou</option>
                    </select>
                </td>

                <!-- Avaliação do Atendimento (Color Dropdown) -->
                <td style="padding:0.75rem 0.6rem;text-align:center;">
                    <select onchange="ProspecModule.updateProspectField('${p.id}', { rating: this.value }); ProspecModule.updateRatingStyle('${p.id}', this.value)"
                            id="rating-sel-${p.id}"
                            style="padding:0.3rem 0.55rem;border-radius:8px;font-size:0.78rem;outline:none;cursor:pointer;background:${rInfo.bg};color:${rInfo.color};border:1px solid ${rInfo.color}44;font-weight:600;">
                        <option value="" ${!rating ? 'selected' : ''} style="background:#1e1e24;color:#fff;">— Selecionar</option>
                        <option value="Boa" ${rating === 'Boa' ? 'selected' : ''} style="background:#1e1e24;color:#25D366;">🟢 Boa</option>
                        <option value="Média" ${rating === 'Média' ? 'selected' : ''} style="background:#1e1e24;color:#EF9F27;">🟡 Média</option>
                        <option value="Ruim" ${rating === 'Ruim' ? 'selected' : ''} style="background:#1e1e24;color:#E24B4A;">🔴 Ruim</option>
                        <option value="Péssima" ${rating === 'Péssima' ? 'selected' : ''} style="background:#1e1e24;color:#a78bfa;">🟣 Péssima</option>
                    </select>
                </td>

                <!-- Cidade / Região -->
                <td style="padding:0.75rem 0.6rem;">
                    <div style="font-size:0.83rem;color:var(--text-main);font-weight:500;">${this.escapeHTML(p.city || '—')}</div>
                    <div style="font-size:0.72rem;color:var(--text-muted);">${this.escapeHTML(p.region || '—')}</div>
                </td>

                <!-- Anotações da Conversa (Editable Inline) -->
                <td style="padding:0.75rem 0.6rem;">
                    <input type="text" value="${this.escapeAttr(p.notes || '')}" placeholder="Digite anotações rápidas..."
                           onchange="ProspecModule.updateProspectField('${p.id}', { notes: this.value })"
                           style="width:100%;padding:0.35rem 0.6rem;border-radius:8px;border:1px solid rgba(255,255,255,0.08);background:rgba(255,255,255,0.03);color:var(--text-main);font-size:0.8rem;outline:none;box-sizing:border-box;transition:border-color 0.2s;"
                           onfocus="this.style.borderColor='var(--primary)'" onblur="this.style.borderColor='rgba(255,255,255,0.08)'">
                </td>

                <!-- Ações -->
                <td style="padding:0.75rem 0.6rem;text-align:center;">
                    <div style="display:flex;align-items:center;justify-content:center;gap:0.3rem;">
                        <button onclick="ProspecModule.sendToCrm('${p.id}')" title="Enviar para CRM"
                                style="width:30px;height:30px;border-radius:7px;border:none;background:rgba(29,158,117,0.12);color:#1D9E75;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:0.9rem;"
                                onmouseover="this.style.background='rgba(29,158,117,0.25)'" onmouseout="this.style.background='rgba(29,158,117,0.12)'">
                            <i class='bx bx-send'></i>
                        </button>
                        <button onclick="ProspecModule.deleteProspect('${p.id}')" title="Excluir"
                                style="width:30px;height:30px;border-radius:7px;border:none;background:rgba(239,68,68,0.08);color:#ef4444;cursor:pointer;display:flex;align-items:center;justify-content:center;font-size:0.9rem;"
                                onmouseover="this.style.background='rgba(239,68,68,0.2)'" onmouseout="this.style.background='rgba(239,68,68,0.08)'">
                            <i class='bx bx-trash'></i>
                        </button>
                    </div>
                </td>
            </tr>`;
        }).join('');

        this.renderPagination(total, start, end);
    },

    updateRowStyle(id, contactedVal) {
        const row = document.getElementById(`prosp-row-${id}`);
        if (!row) return;
        const sel = row.querySelectorAll('select')[0];
        if (!sel) return;
        if (contactedVal === 'Sim') {
            sel.style.cssText = 'padding:0.3rem 0.5rem;border-radius:8px;font-size:0.78rem;outline:none;cursor:pointer;background:rgba(37,211,102,0.12);color:#25D366;border:1px solid rgba(37,211,102,0.3);font-weight:700;';
        } else {
            sel.style.cssText = 'padding:0.3rem 0.5rem;border-radius:8px;font-size:0.78rem;outline:none;cursor:pointer;background:rgba(255,255,255,0.04);color:var(--text-muted);border:1px solid rgba(255,255,255,0.1);';
        }
    },

    updateRatingStyle(id, ratingVal) {
        const sel = document.getElementById(`rating-sel-${id}`);
        if (!sel) return;
        const rInfo = RATING_COLORS[ratingVal] || { bg: 'rgba(255,255,255,0.04)', color: 'var(--text-muted)' };
        sel.style.background = rInfo.bg;
        sel.style.color = rInfo.color;
        sel.style.borderColor = rInfo.color + '44';
    },

    renderPagination(total, start, end) {
        if (!this.dom.pagination) return;
        if (total === 0) {
            this.dom.pagination.innerHTML = '';
            return;
        }

        const prevDisabled = this.currentPage === 1 ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : '';
        const nextDisabled = end >= total ? 'disabled style="opacity:0.4;cursor:not-allowed;"' : '';

        this.dom.pagination.innerHTML = `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:0.8rem 0.5rem;font-size:0.8rem;color:var(--text-muted);">
                <div>Mostrando <strong>${start + 1}–${end}</strong> de <strong>${total}</strong> prospectos</div>
                <div style="display:flex;gap:0.5rem;">
                    <button class="btn btn-outline" onclick="ProspecModule.changePage(-1)" ${prevDisabled} style="padding:0.4rem 0.8rem;font-size:0.8rem;">&larr; Anterior</button>
                    <button class="btn btn-outline" onclick="ProspecModule.changePage(1)" ${nextDisabled} style="padding:0.4rem 0.8rem;font-size:0.8rem;">Próximo &rarr;</button>
                </div>
            </div>
        `;
    },

    escapeHTML(str) {
        if (!str) return '';
        return String(str).replace(/[&<>"']/g, match => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
        }[match]));
    },

    escapeAttr(str) {
        if (!str) return '';
        return String(str).replace(/"/g, '&quot;').replace(/'/g, '&#39;');
    }
};

window.ProspecModule = ProspecModule;

document.addEventListener('DOMContentLoaded', () => {
    const checkAppInterval = setInterval(() => {
        if (window.DataStore) {
            clearInterval(checkAppInterval);
            ProspecModule.init();
        }
    }, 200);
});
