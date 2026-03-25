/**
 * Prospec (Prospecção) Module
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

const ProspecModule = {
    prospects: [],
    
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
            newCount: document.getElementById('prospec-new-count'),
            sentCount: document.getElementById('prospec-sent-count'),
            filterCity: document.getElementById('prospec-filter-city'),
            filterPorte: document.getElementById('prospec-filter-porte'),
            filterStatus: document.getElementById('prospec-filter-status'),
            search: document.getElementById('prospec-search')
        };
    },

    bindEvents() {
        if(this.dom.form) {
            this.dom.form.addEventListener('submit', (e) => this.saveProspect(e));
        }

        if(this.dom.city) {
            this.dom.city.addEventListener('input', () => this.autoFillRegion());
        }

        if(this.dom.filterCity) this.dom.filterCity.addEventListener('change', () => this.renderList());
        if(this.dom.filterPorte) this.dom.filterPorte.addEventListener('change', () => this.renderList());
        if(this.dom.filterStatus) this.dom.filterStatus.addEventListener('change', () => this.renderList());
        if(this.dom.search) this.dom.search.addEventListener('input', () => this.renderList());
    },

    autoFillRegion() {
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
        
        if (foundRegion) {
            this.dom.region.value = foundRegion;
            this.dom.region.style.borderColor = "var(--primary)";
        } else {
            this.dom.region.value = "Outra";
            this.dom.region.style.borderColor = "";
        }
    },

    async loadProspects() {
        try {
            const profile = sessionStorage.getItem('maciel_profile') || 'default';
            const res = await fetch(`${API_BASE_URL}/prospects?profile=${profile}`);
            if(res.ok) {
                this.prospects = await res.json();
                this.updateFilters();
                this.renderList();
                this.updateIndicators();
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

    async saveProspect(e) {
        e.preventDefault();
        
        const razaoSocial = this.dom.razaoSocial.value.trim();
        const cnpj = this.dom.cnpj.value.trim();
        const phone = this.dom.phone.value.trim();
        const city = this.dom.city.value.trim();
        const region = this.dom.region.value.trim();
        const porte = this.dom.porte.value;
        const instagram = this.dom.instagram.value.trim();
        const notes = this.dom.notes.value.trim();

        // Check duplicated CNPJ
        if (cnpj) {
            const dup = this.prospects.find(p => p.cnpj === cnpj);
            if (dup) {
                if(!confirm(`⚠️ Este CNPJ já está cadastrado como [${dup.razaoSocial}]. Deseja continuar mesmo assim?`)) {
                    return;
                }
            } else {
                // Check in CRM customers as well if loaded
                const customers = DataStore.get(STORAGE_KEYS.CUSTOMERS) || [];
                const crmDup = customers.find(c => c.cnpj === cnpj);
                if (crmDup) {
                    if(!confirm(`⚠️ Este CNPJ já está no seu CRM como [${crmDup.name || crmDup.company}]. Deseja continuar mesmo assim?`)) {
                        return;
                    }
                }
            }
        }

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
            createdAt: now,
            updatedAt: now
        };

        try {
            const btnSubmit = this.dom.form.querySelector('button[type="submit"]');
            const originalText = btnSubmit.innerHTML;
            btnSubmit.innerHTML = 'Salvando...';
            btnSubmit.disabled = true;

            const res = await fetch(`${API_BASE_URL}/prospects`, {
                method: 'POST',
                headers: {'Content-Type': 'application/json'},
                body: JSON.stringify(prospectData)
            });

            if(res.ok) {
                const saved = await res.json();
                this.prospects.unshift(saved);
                this.dom.form.reset();
                this.updateFilters();
                this.renderList();
                this.updateIndicators();
                
                // Update map in dashboard if loaded
                if (window.DashboardModule && DashboardModule.updateProspecMap) {
                    DashboardModule.updateProspecMap(this.prospects);
                }
            } else {
                alert('Erro ao salvar prospecto.');
            }
        } catch (e) {
            console.error(e);
            alert('Erro de conexão.');
        } finally {
            const btnSubmit = this.dom.form.querySelector('button[type="submit"]');
            if (btnSubmit) {
                btnSubmit.innerHTML = '<i class="bx bx-plus"></i> Cadastrar Prospecção';
                btnSubmit.disabled = false;
            }
        }
    },

    async sendToCrm(id) {
        if(!confirm('Deseja enviar este estabelecimento para o CRM?')) return;

        try {
            const res = await fetch(`${API_BASE_URL}/prospects/${id}/send-to-crm`, {
                method: 'POST'
            });

            if(res.ok) {
                const result = await res.json();
                const pIndex = this.prospects.findIndex(p => p.id === id);
                if(pIndex > -1) {
                    this.prospects[pIndex].status = 'Enviado';
                    this.prospects[pIndex].crmCustomerId = result.customerId;
                    this.prospects[pIndex].sentToCrmAt = new Date().toISOString();
                }
                this.renderList();
                this.updateIndicators();
                
                // Refresh CRM customers list
                if (window.CRMModule) {
                    CRMModule.loadCustomers(true);
                }
                alert('Sucesso! O cliente foi enviado para o Kanban do seu CRM como "Frio".');
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
        if(!confirm('Tem certeza que deseja excluir esta prospecção permanentemente?')) return;

        try {
            const res = await fetch(`${API_BASE_URL}/prospects/${id}`, {
                method: 'DELETE'
            });

            if(res.ok) {
                this.prospects = this.prospects.filter(p => p.id !== id);
                this.updateFilters();
                this.renderList();
                this.updateIndicators();
            }
        } catch (e) {
            console.error(e);
            alert('Erro de conexão ao excluir.');
        }
    },

    updateIndicators() {
        if (this.dom.totalCount) this.dom.totalCount.innerText = this.prospects.length;
        if (this.dom.newCount) this.dom.newCount.innerText = this.prospects.filter(p => p.status === 'Novo').length;
        if (this.dom.sentCount) this.dom.sentCount.innerText = this.prospects.filter(p => p.status === 'Enviado').length;
    },

    renderList() {
        if (!this.dom.listBody) return;

        let filtered = [...this.prospects];
        
        if (this.dom.filterCity && this.dom.filterCity.value) {
            filtered = filtered.filter(p => p.city === this.dom.filterCity.value);
        }
        
        if (this.dom.filterPorte && this.dom.filterPorte.value) {
            filtered = filtered.filter(p => p.porte === this.dom.filterPorte.value);
        }
        
        if (this.dom.filterStatus && this.dom.filterStatus.value) {
            filtered = filtered.filter(p => p.status === this.dom.filterStatus.value);
        }

        if (this.dom.search && this.dom.search.value) {
            const s = this.dom.search.value.toLowerCase();
            filtered = filtered.filter(p => 
                (p.razaoSocial && p.razaoSocial.toLowerCase().includes(s)) ||
                (p.phone && p.phone.includes(s)) ||
                (p.city && p.city.toLowerCase().includes(s))
            );
        }

        // Sort by date created desc
        filtered.sort((a,b) => b.createdAt.localeCompare(a.createdAt));

        if (!filtered.length) {
            this.dom.listBody.innerHTML = `<tr><td colspan="4" style="text-align:center;padding:2rem;color:var(--text-muted);">Nenhuma prospecção encontrada.</td></tr>`;
            return;
        }

        this.dom.listBody.innerHTML = filtered.map(p => {
            const isSent = p.status === 'Enviado';
            const statusHtml = isSent 
                ? `<span style="background:rgba(29,158,117,0.15);color:#1D9E75;padding:0.2rem 0.5rem;border-radius:4px;font-size:0.75rem;">✅ Enviado CRM em ${p.sentToCrmAt ? new Date(p.sentToCrmAt).toLocaleDateString('pt-BR') : ''}</span>`
                : `<span style="background:rgba(83,74,183,0.15);color:#a59bf4;padding:0.2rem 0.5rem;border-radius:4px;font-size:0.75rem;">🟢 Novo</span>`;

            return `
            <tr>
                <td>
                    <div style="font-weight:600;color:var(--text-main);">${p.razaoSocial}</div>
                    <div style="font-size:0.8rem;color:var(--text-muted);">${p.city} · ${p.porte}</div>
                </td>
                <td>
                    <div style="font-size:0.9rem;color:var(--text-main);"><i class='bx bx-phone'></i> ${p.phone}</div>
                    ${p.instagram ? `<div style="font-size:0.8rem;color:var(--accent);"><i class='bx bxl-instagram'></i> ${p.instagram}</div>` : ''}
                </td>
                <td>${statusHtml}</td>
                <td style="text-align:right;">
                    ${!isSent ? `<button class="btn btn-sm btn-outline" style="color:var(--accent);border-color:var(--accent);margin-right:0.5rem;" onclick="ProspecModule.sendToCrm('${p.id}')"><i class='bx bx-send'></i> Enviar CRM</button>` : ''}
                    <button class="btn btn-sm btn-outline" style="color:var(--danger);border-color:transparent;" onclick="ProspecModule.deleteProspect('${p.id}')"><i class='bx bx-trash'></i></button>
                </td>
            </tr>`;
        }).join('');
    }
};

window.ProspecModule = ProspecModule;

document.addEventListener('DOMContentLoaded', () => {
    // Inicializar quando a aba for carregada
    const checkAppInterval = setInterval(() => {
        if(window.DataStore) {
            clearInterval(checkAppInterval);
            ProspecModule.init();
        }
    }, 200);
});
