/**
 * Kanban Module — Funil de Vendas v3.0 (Estilo CRM Premium / Agendor)
 * Visual alinhado, cards estilizados, limite de cards por coluna e soma de valores.
 */

const KanbanModule = {
    COLUMNS: [
        { id: 'Primeiro contato', label: 'Primeiro Contato',     emoji: '🤝', color: '#3b82f6', bg: 'rgba(59,130,246,0.1)' },
        { id: 'Qualificação',     label: 'Qualificação',        emoji: '🔍', color: '#8b5cf6', bg: 'rgba(139,92,246,0.1)'  },
        { id: 'Primeira Oferta',  label: 'Proposta / Oferta',    emoji: '💡', color: '#EF9F27', bg: 'rgba(239,159,39,0.1)'  },
        { id: 'Maturação',        label: 'Maturação',           emoji: '⏳', color: '#f59e0b', bg: 'rgba(245,158,11,0.1)'  },
        { id: 'Fechamento',       label: 'Fechamento / Venda',  emoji: '✅', color: '#10B981', bg: 'rgba(16,185,129,0.1)'  },
        { id: 'Pós venda',        label: 'Pós-Venda / Contrato', emoji: '🔄', color: '#0ea5e9', bg: 'rgba(14,165,233,0.1)'  },
        { id: 'Perdido',          label: 'Perdido',             emoji: '❌', color: '#ef4444', bg: 'rgba(239,68,68,0.1)' },
    ],

    MAX_VISIBLE: 8, // Exibe no máximo 8 por coluna para não poluir o layout
    expandedCols: {},

    dragId: null,
    dragCol: null,

    init() {
        this.render();
    },

    fmtCurrency(val) {
        return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(val || 0);
    },

    // ── Monta o board completo ──
    render() {
        const board = document.getElementById('kanban-board');
        if (!board) return;

        const filterOrigin = document.getElementById('kanban-filter-origin')?.value || '';
        const filterTemp   = document.getElementById('kanban-filter-temp')?.value || '';
        const searchQuery  = (document.getElementById('kanban-search')?.value || '').trim().toLowerCase();
        const sortMode     = document.getElementById('kanban-filter-sort')?.value || 'recent';

        let customers = this.getLatestCustomers();

        // Filtros
        if (filterOrigin) {
            customers = customers.filter(c => c.origin === filterOrigin);
        }
        if (filterTemp) {
            customers = customers.filter(c => (c.temperature || 'Frio').toLowerCase() === filterTemp.toLowerCase());
        }

        if (searchQuery) {
            customers = customers.filter(c => {
                const name    = (c.name || c.client || '').toLowerCase();
                const company = (c.company || c.razaoSocial || '').toLowerCase();
                const buyer   = (c.buyer || '').toLowerCase();
                const city    = (c.city || '').toLowerCase();
                return name.includes(searchQuery) || company.includes(searchQuery) || buyer.includes(searchQuery) || city.includes(searchQuery);
            });
        }

        const now = new Date();
        const todayStr = now.toISOString().split('T')[0];

        // Mapear por coluna
        const colCustomers = {};
        this.COLUMNS.forEach(col => colCustomers[col.id] = []);

        customers.forEach(c => {
            const colId = this.getCardColumn(c);
            if (colCustomers[colId]) colCustomers[colId].push(c);
        });

        // Ordenação por coluna
        Object.keys(colCustomers).forEach(colId => {
            colCustomers[colId].sort((a, b) => {
                if (sortMode === 'value') {
                    const va = a.value || a.totalPurchased || 0;
                    const vb = b.value || b.totalPurchased || 0;
                    return vb - va;
                } else if (sortMode === 'stale') {
                    const da = a.updatedAt || a.lastContactDate || '1970-01-01';
                    const db = b.updatedAt || b.lastContactDate || '1970-01-01';
                    return da.localeCompare(db);
                } else {
                    const da = a.updatedAt || a.lastContactDate || '1970-01-01';
                    const db = b.updatedAt || b.lastContactDate || '1970-01-01';
                    return db.localeCompare(da);
                }
            });
        });

        // Atualizar contadores totais no cabeçalho do painel
        const totalValue = customers.reduce((sum, c) => sum + (c.value || c.totalPurchased || 0), 0);
        const totalLeads = customers.length;
        
        const countEl = document.getElementById('kanban-total-count');
        if (countEl) countEl.innerText = `${totalLeads} Oportunidades`;
        
        const valEl = document.getElementById('kanban-total-value');
        if (valEl) valEl.innerText = this.fmtCurrency(totalValue);

        // Renderizar Colunas
        board.innerHTML = this.COLUMNS.map(col => {
            const cards = colCustomers[col.id] || [];
            const count = cards.length;
            const colTotalValue = cards.reduce((sum, c) => sum + (c.value || c.totalPurchased || 0), 0);
            
            const isExpanded = !!this.expandedCols[col.id];
            const visibleCards = isExpanded ? cards : cards.slice(0, this.MAX_VISIBLE);
            const hiddenCount = cards.length - visibleCards.length;

            return `
            <div class="kb-col" id="kb-col-${col.id}"
                 ondragover="event.preventDefault();KanbanModule.onDragOver(event,'${col.id}')"
                 ondragleave="KanbanModule.onDragLeave(event,'${col.id}')"
                 ondrop="KanbanModule.onDrop(event,'${col.id}')">

                <!-- Header da coluna -->
                <div class="kb-col-header" style="border-top: 3px solid ${col.color};">
                    <div class="kb-col-header-top">
                        <div class="kb-col-title">
                            <span class="kb-col-emoji">${col.emoji}</span>
                            <span class="kb-col-name">${col.label}</span>
                        </div>
                        <span class="kb-col-badge">${count}</span>
                    </div>
                    <div class="kb-col-header-sub">
                        <span>${this.fmtCurrency(colTotalValue)}</span>
                    </div>
                </div>

                <!-- Lista de cards scrollável -->
                <div class="kb-cards-container" id="kb-cards-${col.id}">
                    ${cards.length === 0 ? `
                        <div class="kb-empty-drop-zone">Nenhum cliente aqui</div>
                    ` : visibleCards.map(c => this.renderCard(c, col, now, todayStr)).join('')}

                    ${hiddenCount > 0 ? `
                        <button class="kb-btn-expand" onclick="KanbanModule.toggleExpand('${col.id}')">
                            <i class='bx bx-chevron-down'></i> Ver mais ${hiddenCount} clientes
                        </button>
                    ` : ''}

                    ${isExpanded && cards.length > this.MAX_VISIBLE ? `
                        <button class="kb-btn-expand" onclick="KanbanModule.toggleExpand('${col.id}')">
                            <i class='bx bx-chevron-up'></i> Mostrar menos
                        </button>
                    ` : ''}

                    <div class="kb-drop-hint" style="display:none;border-color:${col.color};"></div>
                </div>
            </div>
        `;
        }).join('');
    },

    toggleExpand(colId) {
        this.expandedCols[colId] = !this.expandedCols[colId];
        this.render();
    },

    // ── Renderiza card individual (Estilo foto CRM) ──
    renderCard(c, col, now, todayStr) {
        const name     = (c.name || c.client || 'Sem Nome').trim();
        const buyer    = (c.buyer || '').trim();
        const company  = (c.company || c.razaoSocial || '').trim();
        const city     = (c.city || '').trim();
        const phone    = (c.phone || '').trim();
        const val      = c.value || c.totalPurchased || 0;
        const origin   = c.origin || 'Google';
        const temp     = c.temperature || 'Frio';

        // Tempo parado / atualização
        const lastDateStr = c.updatedAt || c.lastContactDate || c.createdAt || '';
        let hoursUnchanged = 0;
        let daysUnchanged = 0;
        if (lastDateStr) {
            const lastDate = new Date(lastDateStr);
            const diffMs = now - lastDate;
            hoursUnchanged = Math.floor(diffMs / (1000 * 60 * 60));
            daysUnchanged = Math.floor(hoursUnchanged / 24);
        }

        let timeStaleText = 'Atualizado há pouco';
        if (hoursUnchanged >= 24) {
            timeStaleText = `${daysUnchanged} dia${daysUnchanged > 1 ? 's' : ''} sem atualização`;
        } else if (hoursUnchanged > 0) {
            timeStaleText = `${hoursUnchanged} hora${hoursUnchanged > 1 ? 's' : ''} sem atualização`;
        }

        const stageDays = daysUnchanged <= 0 ? 1 : daysUnchanged + 1;
        const stageDaysText = `${stageDays} dia${stageDays > 1 ? 's' : ''} na etapa`;

        // Cores dos Pills / Badges
        const originBadges = {
            'Google':  { label: 'Google', bg: 'rgba(99,102,241,0.15)', color: '#818cf8' },
            'Inativo': { label: 'Inativo', bg: 'rgba(29,158,117,0.15)', color: '#1D9E75' },
            'Prospec': { label: 'Prospec', bg: 'rgba(239,159,39,0.15)', color: '#EF9F27' },
            'Maps':    { label: 'Maps',    bg: 'rgba(148,163,184,0.15)', color: '#94a3b8' }
        };
        const origBadge = originBadges[origin] || { label: origin, bg: 'rgba(255,255,255,0.08)', color: 'var(--text-muted)' };

        const tempBadges = {
            'Fechando': { label: 'Fechando', bg: 'rgba(16,185,129,0.15)', color: '#10B981' },
            'Quente':   { label: 'Quente 🔥',  bg: 'rgba(239,68,68,0.15)',  color: '#ef4444' },
            'Morno':    { label: 'Morno 🌡',   bg: 'rgba(245,158,11,0.15)', color: '#f59e0b' },
            'Frio':     { label: 'Frio 🧊',    bg: 'rgba(59,130,246,0.15)', color: '#3b82f6' }
        };
        const tempBadge = tempBadges[temp] || tempBadges['Frio'];

        // Indicador de Ciclo de Vida do Fechamento / Pós-Venda (7 dias)
        let lifecycleText = '';
        if (col.id === 'Fechamento') {
            const daysLeft = Math.max(0, 7 - daysUnchanged);
            lifecycleText = `<div class="kb-card-row" style="color:#10B981;font-weight:600;"><i class='bx bx-check-circle'></i> 🛒 Venda recente • Pós-venda em ${daysLeft} dia${daysLeft !== 1 ? 's' : ''}</div>`;
        } else if (col.id === 'Pós venda') {
            lifecycleText = `<div class="kb-card-row" style="color:#0ea5e9;font-weight:600;"><i class='bx bx-refresh'></i> 🔄 Pós-Venda • Cliente há ${daysUnchanged} dia${daysUnchanged !== 1 ? 's' : ''}</div>`;
        }

        // Opções de mover para select discreto
        const moveOptions = this.COLUMNS
            .filter(x => x.id !== col.id)
            .map(x => `<option value="${x.id}">${x.emoji} ${x.label}</option>`)
            .join('');

        return `
        <div class="kb-card"
             id="kb-card-${c.id}"
             draggable="true"
             ondragstart="KanbanModule.onDragStart(event,'${c.id}','${col.id}')"
             ondragend="KanbanModule.onDragEnd(event)">

            <!-- Cabeçalho do Card (Pills + Ações) -->
            <div class="kb-card-header">
                <div class="kb-card-pills">
                    <span class="kb-pill" style="background:${origBadge.bg};color:${origBadge.color};">${origBadge.label}</span>
                    <span class="kb-pill" style="background:${tempBadge.bg};color:${tempBadge.color};">${tempBadge.label}</span>
                </div>
                <div class="kb-card-top-actions">
                    <button onclick="CRMModule.openEditModal('${c.id}')" title="Editar" class="kb-icon-btn">
                        <i class='bx bx-edit-alt'></i>
                    </button>
                </div>
            </div>

            <!-- Título / Razão Social -->
            <div class="kb-card-deal-name" title="${this.esc(name)}">
                ${this.esc(company || name)}
            </div>

            <!-- Detalhes do Negócio -->
            <div class="kb-card-details">
                <div class="kb-card-row">
                    <i class='bx bx-user'></i>
                    <span class="kb-card-buyer-info">${this.esc(buyer || name)} ${city ? '• ' + this.esc(city) : ''}</span>
                </div>
                ${lifecycleText}
                <div class="kb-card-row">
                    <i class='bx bx-time-five'></i>
                    <span>${timeStaleText}</span>
                </div>
                <div class="kb-card-row">
                    <i class='bx bx-calendar'></i>
                    <span>${stageDaysText}</span>
                </div>
            </div>

            <!-- Anotações Inline nos Cards com Bloqueio de Drag -->
            <div style="display:flex;flex-direction:column;gap:0.3rem;" onmousedown="event.stopPropagation()" onpointerdown="event.stopPropagation()">
                <textarea class="form-control" rows="2" placeholder="Anotações da negociação..."
                          draggable="false"
                          onchange="DataStore.update(STORAGE_KEYS.CUSTOMERS, '${c.id}', { notes: this.value })"
                          onmousedown="event.stopPropagation()" onpointerdown="event.stopPropagation()"
                          style="width:100%;resize:vertical;min-height:42px;font-size:0.78rem;line-height:1.3;padding:0.35rem;border-radius:6px;border:1px solid rgba(255,255,255,0.08);background:rgba(0,0,0,0.25);color:var(--text-main);box-sizing:border-box;">${this.esc(c.notes || '')}</textarea>
            </div>

            <!-- Rodapé do Card (WhatsApp + Valor + Mover) -->
            <div class="kb-card-footer">
                <div class="kb-card-footer-left">
                    ${phone ? `
                    <button onclick="WhatsAppModule.openComposer('${c.id}')" title="WhatsApp" class="kb-wpp-badge">
                        <i class='bx bxl-whatsapp'></i>
                    </button>` : ''}
                    <button onclick="CRMModule.openEditModal('${c.id}')" title="Painel Completo" style="font-size:0.7rem;padding:0.2rem 0.4rem;border-radius:4px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:var(--text-muted);cursor:pointer;">
                        <i class='bx bx-note'></i>
                    </button>
                    <select class="kb-move-select" onchange="KanbanModule.moveCard('${c.id}',this.value);this.value='';" title="Mover etapa">
                        <option value="">↪ Mover</option>
                        ${moveOptions}
                    </select>
                </div>

                <div class="kb-card-value">
                    ${val > 0 ? this.fmtCurrency(val) : '<span style="color:var(--text-muted);font-size:0.75rem;">—</span>'}
                </div>
            </div>
        </div>`;
    },

    // ── Mapeia status do cliente para a coluna correspondente com Ciclo de Vida ──
    getCardColumn(c) {
        if (c.temperature === 'Lixeira' || c.status === 'Lixeira') return 'Perdido';

        let stage = c.temperature;
        const etapas = ['Primeiro contato', 'Qualificação', 'Primeira Oferta', 'Maturação', 'Fechamento', 'Pós venda', 'Perdido'];

        if (!stage || !etapas.includes(stage)) {
            const map = {
                'Lead':     'Primeiro contato',
                'Prospect': 'Primeiro contato',
                'Contato':  'Primeiro contato',
                'Inativo':  'Primeiro contato',
                'Perdido':  'Perdido',
                'Frio':     'Primeiro contato',
                'Ativo':    'Pós venda',
                'Morno':    'Qualificação',
                'Proposta': 'Primeira Oferta',
                'Quente':   'Maturação',
                'Fechando': 'Fechamento',
                'Fechado':  'Fechamento',
            };
            stage = map[c.temperature] || map[c.status] || 'Primeiro contato';
        }

        // Regra do Ciclo de Vida de 7 dias (1 semana):
        // Se estiver em Fechamento, verifica se já se passaram 7 dias da venda.
        // Se sim, transita automaticamente para 'Pós venda'.
        if (stage === 'Fechamento' || stage === 'Fechado' || stage === 'Fechando') {
            const saleDateStr = c.closedAt || c.saleDate || c.updatedAt || c.createdAt;
            if (saleDateStr) {
                const saleDate = new Date(saleDateStr);
                const now = new Date();
                const diffMs = now - saleDate;
                const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
                if (diffDays >= 7) {
                    return 'Pós venda';
                }
            }
            return 'Fechamento';
        }

        return stage;
    },

    // ── Pega clientes únicos mais recentes ──
    getLatestCustomers() {
        const all = DataStore.get(STORAGE_KEYS.CUSTOMERS) || [];
        const latest = {};
        all.forEach(c => {
            const name = c.name || c.client;
            if (!name) return;
            if (!latest[name] || (c.updatedAt || c.createdAt) > (latest[name].updatedAt || latest[name].createdAt)) {
                latest[name] = c;
            }
        });
        return Object.values(latest);
    },

    // ── Move card para nova coluna ──
    async moveCard(id, newTemp) {
        const card = document.getElementById(`kb-card-${id}`);
        if (card) { card.style.opacity = '0.4'; card.style.pointerEvents = 'none'; }

        const updatePayload = { 
            temperature: newTemp,
            updatedAt: new Date().toISOString()
        };

        // Se foi movido para Fechamento, registra data exata do fechamento da venda
        if (newTemp === 'Fechamento') {
            updatePayload.closedAt = new Date().toISOString();
        }

        await DataStore.update(STORAGE_KEYS.CUSTOMERS, id, updatePayload);

        // Automação: se moveu para Pós venda, criar lembrete de recontato
        if (newTemp === 'Pós venda') {
            const customer = (DataStore.get(STORAGE_KEYS.CUSTOMERS) || []).find(c => c.id === id);
            if (customer) {
                const limitDate = new Date();
                limitDate.setDate(limitDate.getDate() + 7);
                const dateStr = limitDate.toISOString().split('T')[0];

                const reminder = {
                    id: 'rmd_' + Date.now(),
                    profile: customer.profile || 'default',
                    title: `Recontato pós-venda: ${customer.name || 'Cliente'}`,
                    dateLimit: dateStr,
                    timeLimit: "09:00",
                    priority: "alta",
                    status: "pendente",
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };

                await DataStore.add(STORAGE_KEYS.REMINDERS, reminder);
            }
        }

        this.render();
        if (typeof DashboardModule !== 'undefined') DashboardModule.update();
        if (typeof CRMModule !== 'undefined' && CRMModule.allAlerts) CRMModule.loadAlerts();
    },

    // ── Drag & Drop Handlers ──
    onDragStart(e, id, colId) {
        this.dragId  = id;
        this.dragCol = colId;
        e.dataTransfer.effectAllowed = 'move';
        setTimeout(() => {
            const card = document.getElementById(`kb-card-${id}`);
            if (card) card.style.opacity = '0.35';
        }, 0);
    },

    onDragEnd(e) {
        if (this.dragId) {
            const card = document.getElementById(`kb-card-${this.dragId}`);
            if (card) card.style.opacity = '1';
        }
        document.querySelectorAll('.kb-cards-container').forEach(el => {
            el.style.background = '';
            const hint = el.querySelector('.kb-drop-hint');
            if (hint) hint.style.display = 'none';
        });
        this.dragId = null;
        this.dragCol = null;
    },

    onDragOver(e, colId) {
        e.preventDefault();
        e.dataTransfer.dropEffect = 'move';
        const area = document.getElementById(`kb-cards-${colId}`);
        const col  = this.COLUMNS.find(c => c.id === colId);
        if (area && col) {
            area.style.background = `${col.color}15`;
            const hint = area.querySelector('.kb-drop-hint');
            if (hint && colId !== this.dragCol) hint.style.display = 'block';
        }
    },

    onDragLeave(e, colId) {
        const area = document.getElementById(`kb-cards-${colId}`);
        if (area) {
            area.style.background = '';
            const hint = area.querySelector('.kb-drop-hint');
            if (hint) hint.style.display = 'none';
        }
    },

    async onDrop(e, colId) {
        e.preventDefault();
        if (!this.dragId || this.dragCol === colId) {
            this.onDragEnd(e);
            return;
        }
        await this.moveCard(this.dragId, colId);
    },

    esc(str) {
        if (!str) return '';
        return String(str).replace(/[&<>'"]/g, t =>
            ({ '&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;' }[t]));
    }
};

window.KanbanModule = KanbanModule;

document.addEventListener('DataStoreReady', () => {
    const view = document.getElementById('view-kanban');
    if (view && !view.classList.contains('hidden')) KanbanModule.init();
});
