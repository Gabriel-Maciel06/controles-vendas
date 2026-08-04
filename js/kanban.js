/**
 * Kanban Module — Funil de Vendas (v2 — Compact & Centered)
 * Colunas: Lead → Contato → Proposta → Fechado → Perdido
 * Drag & drop entre colunas. Salva status no backend automaticamente.
 */

const KanbanModule = {

    COLUMNS: [
        { id: 'Primeiro contato', label: 'Primeiro contato', emoji: '🤝', color: '#3b82f6', bg: 'rgba(59,130,246,0.06)' },
        { id: 'Qualificação',     label: 'Qualificação',     emoji: '🔍', color: '#8b5cf6', bg: 'rgba(139,92,246,0.06)'  },
        { id: 'Primeira Oferta',  label: 'Primeira Oferta',  emoji: '💡', color: '#EF9F27', bg: 'rgba(239,159,39,0.06)'  },
        { id: 'Maturação',        label: 'Maturação',        emoji: '⏳', color: '#f59e0b', bg: 'rgba(245,158,11,0.06)'  },
        { id: 'Fechamento',       label: 'Fechamento',       emoji: '✅', color: '#10B981', bg: 'rgba(16,185,129,0.06)'  },
        { id: 'Pós venda',        label: 'Pós venda',        emoji: '🔄', color: '#0ea5e9', bg: 'rgba(14,165,233,0.06)'  },
        { id: 'Perdido',          label: 'Perdido',          emoji: '❌', color: '#6b7280', bg: 'rgba(107,114,128,0.06)' },
    ],

    MAX_VISIBLE: 5,  // Cards visíveis por coluna antes de "Ver mais"
    expandedCols: {}, // Rastreia colunas expandidas

    dragId: null,
    dragCol: null,
    init() {
        this.render();
    },

    // ── Monta o board completo ──
    render() {
        const board = document.getElementById('kanban-board');
        if (!board) return;

        const filterOrigin = document.getElementById('kanban-filter-origin')?.value || '';
        const searchQuery  = (document.getElementById('kanban-search')?.value || '').trim().toLowerCase();
        let customers = this.getLatestCustomers();

        if (filterOrigin) {
            customers = customers.filter(c => c.origin === filterOrigin);
        }

        if (searchQuery) {
            customers = customers.filter(c => {
                const name = (c.name || c.client || '').toLowerCase();
                const company = (c.company || '').toLowerCase();
                return name.includes(searchQuery) || company.includes(searchQuery);
            });
        }

        // Oculta o painel de métricas separado (agora está integrado nos headers)
        const metricsEl = document.getElementById('kanban-metrics');
        if (metricsEl) metricsEl.style.display = 'none';

        const today = new Date().toISOString().split('T')[0];
        
        // Conta por coluna
        const colCustomers = {};
        this.COLUMNS.forEach(c => colCustomers[c.id] = []);
        customers.forEach(c => {
            const col = this.getCardColumn(c);
            if (colCustomers[col]) colCustomers[col].push(c);
        });

        // Ordena: atrasados primeiro, depois por data de follow-up
        Object.keys(colCustomers).forEach(colId => {
            colCustomers[colId].sort((a, b) => {
                const aNext = a.nextFollowUp || '9999';
                const bNext = b.nextFollowUp || '9999';
                return aNext.localeCompare(bNext);
            });
        });

        const totalLeads = customers.length;

        board.innerHTML = this.COLUMNS.map(col => {
            const cards = colCustomers[col.id] || [];
            const count = cards.length;
            const isExpanded = this.expandedCols[col.id];
            const visibleCards = isExpanded ? cards : cards.slice(0, this.MAX_VISIBLE);
            const hiddenCount = cards.length - this.MAX_VISIBLE;

            return `
            <div class="kb-col" id="kb-col-${col.id}"
                 ondragover="event.preventDefault();KanbanModule.onDragOver(event,'${col.id}')"
                 ondragleave="KanbanModule.onDragLeave(event,'${col.id}')"
                 ondrop="KanbanModule.onDrop(event,'${col.id}')">

                <!-- Header da coluna com contagem integrada -->
                <div class="kb-col-header" style="background:${col.bg};border-bottom:2px solid ${col.color};">
                    <div class="kb-col-title">
                        <span class="kb-col-emoji">${col.emoji}</span>
                        <span style="color:${col.color};font-weight:700;font-size:0.8rem;">${col.label}</span>
                    </div>
                    <span class="kb-col-count" style="background:${col.color};color:#fff;">${count}</span>
                </div>

                <!-- Área dos cards -->
                <div class="kb-cards" id="kb-cards-${col.id}">
                    ${visibleCards.map(c => this.renderCard(c, col, today)).join('')}
                    ${!isExpanded && hiddenCount > 0 ? `
                        <button class="kb-show-more" onclick="KanbanModule.toggleExpand('${col.id}')" style="border-left:2px solid ${col.color}40;">
                            <i class='bx bx-chevron-down'></i> Ver mais ${hiddenCount} clientes
                        </button>
                    ` : ''}
                    ${isExpanded && hiddenCount > 0 ? `
                        <button class="kb-show-more" onclick="KanbanModule.toggleExpand('${col.id}')" style="border-left:2px solid ${col.color}40;">
                            <i class='bx bx-chevron-up'></i> Recolher
                        </button>
                    ` : ''}
                    <div class="kb-drop-hint" style="display:none;border-color:${col.color}55;"></div>
                </div>
            </div>
        `;
        }).join('');

        // Limpa lixeira
        const lixeiraContainer = document.getElementById('lixeira-container');
        if (lixeiraContainer) lixeiraContainer.style.display = 'none';
    },

    toggleExpand(colId) {
        this.expandedCols[colId] = !this.expandedCols[colId];
        this.render();
    },

    // ── Card compacto ──
    renderCard(c, col, today) {
        const name     = (c.name || c.client || '—');
        const initial  = name.charAt(0).toUpperCase();
        const phone    = c.phone || '';
        const next     = c.nextFollowUp || '';
        const nextFmt  = next ? next.split('-').reverse().join('/') : '';
        const isLate   = next && next < today;
        const isToday  = next === today;

        const followClass = isLate ? 'kb-follow-late' : isToday ? 'kb-follow-today' : 'kb-follow-normal';
        const followIcon  = isLate ? '⚠️' : isToday ? '🔔' : nextFmt ? '📅' : '';

        const originColors = {
            'Google': '#818cf8',
            'Inativo': '#1D9E75',
            'Prospec': '#EF9F27',
            'Maps': '#888888',
        };
        const originColor = c.origin && originColors[c.origin] ? originColors[c.origin] : 'transparent';

        const isMaps = c.origin === 'Maps';

        // Monta o select de mover (leve e discreto)
        const moveOptions = this.COLUMNS
            .filter(x => x.id !== col.id)
            .map(x => `<option value="${x.id}">${x.emoji} ${x.label}</option>`)
            .join('');

        return `
        <div class="kb-card"
             id="kb-card-${c.id}"
             draggable="true"
             ondragstart="KanbanModule.onDragStart(event,'${c.id}','${col.id}')"
             ondragend="KanbanModule.onDragEnd(event)"
             style="border-left:3px solid ${originColor};">

            <!-- Linha principal: avatar + nome + ações -->
            <div class="kb-card-main">
                <div class="kb-card-avatar" style="background:${col.color}22;color:${col.color};">${initial}</div>
                <div class="kb-card-name" title="${this.esc(name)}">${this.esc(name)}</div>
                <div class="kb-card-actions">
                    <button onclick="CRMModule.openEditModal('${c.id}')" title="Editar" class="kb-action-btn kb-action-edit">
                        <i class='bx bx-edit-alt'></i>
                    </button>
                    <button onclick="WhatsAppModule.openComposer('${c.id}')" title="WhatsApp" class="kb-action-btn kb-action-wpp">
                        <i class='bx bxl-whatsapp'></i>
                    </button>
                    ${isMaps ? `
                    <button onclick="KanbanModule.moveToLixeira('${c.id}')" title="Descartar" class="kb-action-btn kb-action-trash">
                        <i class='bx bx-trash'></i>
                    </button>` : ''}
                </div>
            </div>

            <!-- Linha secundária: follow-up + mover -->
            <div class="kb-card-footer">
                <span class="${followClass}">${followIcon} ${nextFmt || '—'}</span>
                ${phone ? `<span class="kb-card-phone">${this.esc(phone)}</span>` : ''}
                <select class="kb-move-select" onchange="KanbanModule.moveCard('${c.id}',this.value);this.value='';" title="Mover para outra etapa">
                    <option value="">↪</option>
                    ${moveOptions}
                </select>
            </div>
        </div>`;
    },

    // ── Mapeia status legado → coluna ou temperatura ──
    getCardColumn(c) {
        if (c.temperature === 'Lixeira') return 'Perdido';
        if (c.status === 'Lixeira') return 'Perdido';

        const novasEtapas = ['Primeiro contato', 'Qualificação', 'Primeira Oferta', 'Maturação', 'Fechamento', 'Pós venda', 'Perdido'];
        if (novasEtapas.includes(c.temperature)) return c.temperature;

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

        if (c.temperature && map[c.temperature]) return map[c.temperature];
        return map[c.status] || 'Primeiro contato';
    },

    toggleLixeira() {
        const c = document.getElementById('lixeira-container');
        if(c) c.style.display = (c.style.display === 'none') ? 'block' : 'none';
    },

    async moveToLixeira(id) {
        if(!confirm('Deseja mover este contato para Perdido?')) return;
        await this.moveCard(id, 'Perdido');
    },

    async restoreFromLixeira(id) {
        await this.moveCard(id, 'Primeiro contato');
    },

    renderLixeira(customers) {
        // Obsoleto mas mantido para evitar crash caso seja chamado no HTML
    },

    // ── Pega cliente mais recente por nome (com filtro de origem) ──
    getLatestCustomers() {
        const all = DataStore.get(STORAGE_KEYS.CUSTOMERS) || [];
        const latest = {};
        all.forEach(c => {
            const name = c.name || c.client;
            if (!latest[name] || (c.updatedAt || c.createdAt) > (latest[name].updatedAt || latest[name].createdAt)) {
                latest[name] = c;
            }
        });
        return Object.values(latest);
    },

    renderMetrics(customers) {
        // Métricas agora estão integradas nos headers das colunas
    },

    // ── Move card para nova coluna ──
    async moveCard(id, newTemp) {
        const card = document.getElementById(`kb-card-${id}`);
        if (card) { card.style.opacity = '0.4'; card.style.pointerEvents = 'none'; }

        await DataStore.update(STORAGE_KEYS.CUSTOMERS, id, { temperature: newTemp });

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
                    title: `Recontato: 2º pedido/Introdução - ${customer.name || 'Cliente'}`,
                    dateLimit: dateStr,
                    timeLimit: "09:00",
                    priority: "alta",
                    status: "pendente",
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };

                await DataStore.add(STORAGE_KEYS.REMINDERS, reminder);
                if (typeof App !== 'undefined' && App.showToast) {
                    App.showToast("Lembrete de Recontato automático criado para daqui 7 dias!");
                }
            }
        }

        this.render();
        if (typeof DashboardModule !== 'undefined') DashboardModule.update();
        if (typeof CRMModule !== 'undefined' && CRMModule.allAlerts) CRMModule.loadAlerts();
    },

    // ── Drag & Drop ──
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
        document.querySelectorAll('.kb-cards').forEach(el => {
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
            area.style.background = `${col.color}12`;
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
