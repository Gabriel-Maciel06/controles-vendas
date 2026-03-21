/**
 * Kanban Module — Funil de Vendas
 * Colunas: Lead → Contato → Proposta → Fechado → Perdido
 * Drag & drop entre colunas. Salva status no backend automaticamente.
 */

const KanbanModule = {

    COLUMNS: [
        { id: 'Primeiro contato', label: 'Primeiro contato', emoji: '🤝', color: '#3b82f6', bg: 'rgba(59,130,246,0.08)' },
        { id: 'Qualificação',     label: 'Qualificação',     emoji: '🔍', color: '#8b5cf6', bg: 'rgba(139,92,246,0.08)'  },
        { id: 'Primeira Oferta',  label: 'Primeira Oferta',  emoji: '💡', color: '#EF9F27', bg: 'rgba(239,159,39,0.08)'  },
        { id: 'Maturação',        label: 'Maturação',        emoji: '⏳', color: '#f59e0b', bg: 'rgba(245,158,11,0.08)'  },
        { id: 'Fechamento',       label: 'Fechamento',       emoji: '✅', color: '#10B981', bg: 'rgba(16,185,129,0.08)'  },
        { id: 'Pós venda',        label: 'Pós venda',        emoji: '🔄', color: '#0ea5e9', bg: 'rgba(14,165,233,0.08)'  },
        { id: 'Perdido',          label: 'Perdido',          emoji: '❌', color: '#6b7280', bg: 'rgba(107,114,128,0.08)' },
    ],

    dragId: null,   // id do card sendo arrastado
    dragCol: null,  // coluna de origem

    init() {
        this.render();
    },

    // ── Monta o board completo ──
    render() {
        const board = document.getElementById('kanban-board');
        if (!board) return;

        const customers = this.getLatestCustomers();
        const today     = new Date().toISOString().split('T')[0];

        // Conta por coluna para os badges
        const counts = {};
        this.COLUMNS.forEach(c => counts[c.id] = 0);
        customers.forEach(c => {
            const col = this.getCardColumn(c);
            if (counts[col] !== undefined) counts[col]++;
        });

        board.innerHTML = this.COLUMNS.map(col => `
            <div class="kb-col" id="kb-col-${col.id}"
                 style="flex:1;min-width:200px;max-width:260px;"
                 ondragover="event.preventDefault();KanbanModule.onDragOver(event,'${col.id}')"
                 ondragleave="KanbanModule.onDragLeave(event,'${col.id}')"
                 ondrop="KanbanModule.onDrop(event,'${col.id}')">

                <!-- Cabeçalho da coluna -->
                <div style="display:flex;align-items:center;gap:0.5rem;padding:0.65rem 0.8rem;border-radius:10px 10px 0 0;background:${col.bg};border:1px solid ${col.color}33;border-bottom:none;margin-bottom:0;">
                    <span style="font-size:1rem;">${col.emoji}</span>
                    <span style="font-weight:600;font-size:0.85rem;color:${col.color};">${col.label}</span>
                    <span style="margin-left:auto;background:${col.color}22;color:${col.color};border-radius:20px;padding:1px 8px;font-size:0.72rem;font-weight:700;">${counts[col.id] || 0}</span>
                </div>

                <!-- Área dos cards -->
                <div class="kb-cards" id="kb-cards-${col.id}"
                     style="min-height:200px;padding:0.5rem;background:${col.bg};border:1px solid ${col.color}33;border-top:none;border-radius:0 0 10px 10px;display:flex;flex-direction:column;gap:0.45rem;transition:background 0.15s;">
                    ${customers
                        .filter(c => this.getCardColumn(c) === col.id)
                        .map(c => this.renderCard(c, col, today))
                        .join('')}
                    <div class="kb-drop-hint" style="display:none;border:2px dashed ${col.color}55;border-radius:8px;height:60px;"></div>
                </div>
            </div>
        `).join('');

        // Limpa lixeira container se existir e estiver ativo
        const lixeiraContainer = document.getElementById('lixeira-container');
        if (lixeiraContainer) lixeiraContainer.style.display = 'none';
    },

    // ── Renderiza um card ──
    renderCard(c, col, today) {
        const name     = (c.name || c.client || '—');
        const initial  = name.charAt(0).toUpperCase();
        const phone    = c.phone || '';
        const next     = c.nextFollowUp || '';
        const nextFmt  = next ? next.split('-').reverse().join('/') : '';
        const isLate   = next && next < today;
        const isToday  = next === today;
        const notes    = (c.notes || '').replace(/^\[WhatsApp\]\s*/i, '').substring(0, 55);

        const followStyle = isLate  ? 'color:#E24B4A;font-weight:600;'
                          : isToday ? 'color:#EF9F27;font-weight:600;'
                          : 'color:var(--text-muted);';

        const originColors = {
            'Google': '#818cf8',
            'Inativo': '#1D9E75',
            'Prospec': '#EF9F27',
            'Maps': '#888888',
        };
        const originBorder = c.origin && originColors[c.origin] 
            ? `border-left: 4px solid ${originColors[c.origin]};` 
            : 'border-left: 4px solid transparent;'; 

        const isMaps = c.origin === 'Maps';

        return `
        <div class="kb-card"
             id="kb-card-${c.id}"
             draggable="true"
             ondragstart="KanbanModule.onDragStart(event,'${c.id}','${col.id}')"
             ondragend="KanbanModule.onDragEnd(event)"
             style="background:var(--bg-surface,rgba(255,255,255,0.06));border:1px solid rgba(255,255,255,0.08);${originBorder}border-radius:8px;padding:0.7rem 0.75rem;cursor:grab;transition:opacity 0.15s,box-shadow 0.15s;user-select:none;">

            <!-- Nome + avatar -->
            <div style="display:flex;align-items:center;gap:0.55rem;margin-bottom:0.4rem;">
                <div style="width:28px;height:28px;border-radius:50%;background:${col.color}28;display:flex;align-items:center;justify-content:center;font-size:0.75rem;font-weight:700;color:${col.color};flex-shrink:0;">${initial}</div>
                <div style="font-weight:600;font-size:0.83rem;color:var(--text-main);line-height:1.2;flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;" title="${this.esc(name)}">${this.esc(name)}</div>
            </div>

            <!-- Telefone -->
            ${phone ? `<div style="font-size:0.73rem;color:var(--text-muted);margin-bottom:0.3rem;">${this.esc(phone)}</div>` : ''}

            <!-- Anotação -->
            ${notes ? `<div style="font-size:0.75rem;color:var(--text-muted);margin-bottom:0.45rem;line-height:1.35;opacity:0.8;">${this.esc(notes)}${(c.notes||'').length>55?'…':''}</div>` : ''}

            <!-- Follow-up + ações -->
            <div style="display:flex;align-items:center;justify-content:space-between;margin-top:0.3rem;">
                <div style="font-size:0.71rem;${followStyle}">
                    ${isLate ? '⚠️ ' : isToday ? '🔔 ' : nextFmt ? '📅 ' : ''}${nextFmt || '—'}
                </div>
                <div style="display:flex;gap:0.25rem;">
                    <button onclick="CRMModule.openEditModal('${c.id}')" title="Editar"
                        style="width:24px;height:24px;border-radius:6px;border:none;background:rgba(99,102,241,0.15);color:#818cf8;cursor:pointer;font-size:0.78rem;display:flex;align-items:center;justify-content:center;"
                        onmouseover="this.style.background='rgba(99,102,241,0.3)'" onmouseout="this.style.background='rgba(99,102,241,0.15)'">
                        <i class='bx bx-edit'></i>
                    </button>
                    <button onclick="WhatsAppModule.openComposer('${c.id}')" title="WhatsApp"
                        style="width:24px;height:24px;border-radius:6px;border:none;background:rgba(37,211,102,0.12);color:#25D366;cursor:pointer;font-size:0.85rem;display:flex;align-items:center;justify-content:center;"
                        onmouseover="this.style.background='rgba(37,211,102,0.25)'" onmouseout="this.style.background='rgba(37,211,102,0.12)'">
                        <i class='bx bxl-whatsapp'></i>
                    </button>
                    ${isMaps ? `
                    <button onclick="KanbanModule.moveToLixeira('${c.id}')" title="Descartar (Lixeira)"
                        style="width:24px;height:24px;border-radius:6px;border:none;background:rgba(239,68,68,0.1);color:#ef4444;cursor:pointer;font-size:0.85rem;display:flex;align-items:center;justify-content:center;"
                        onmouseover="this.style.background='rgba(239,68,68,0.25)'" onmouseout="this.style.background='rgba(239,68,68,0.1)'">
                        <i class='bx bx-trash'></i>
                    </button>
                    ` : ''}
                </div>
            </div>

            <!-- Mover para coluna -->
            <div style="margin-top:0.5rem;border-top:1px solid rgba(255,255,255,0.06);padding-top:0.4rem;">
                <select onchange="KanbanModule.moveCard('${c.id}',this.value);this.value='';"
                    style="width:100%;font-size:0.71rem;padding:0.2rem 0.35rem;border-radius:5px;border:1px solid rgba(255,255,255,0.1);background:rgba(255,255,255,0.04);color:var(--text-muted);cursor:pointer;outline:none;">
                    <option value="">↪ Mover para...</option>
                    ${this.COLUMNS.filter(x => x.id !== col.id).map(x =>
                        `<option value="${x.id}">${x.emoji} ${x.label}</option>`
                    ).join('')}
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

    // ── Pega cliente mais recente por nome ──
    getLatestCustomers() {
        const all = DataStore.get(STORAGE_KEYS.CUSTOMERS) || [];
        const latest = {};
        all.forEach(c => {
            const name = c.name || c.client;
            const date = c.lastContactDate || c.contactDate || '';
            if (!latest[name] || date > (latest[name].lastContactDate || '')) latest[name] = c;
        });
        return Object.values(latest);
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
                limitDate.setDate(limitDate.getDate() + 7); // Daqui a 7 dias
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
        // Remove todos os highlights
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
            area.style.background = `${col.color}18`;
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
    // Só inicializa se a view estiver ativa
    const view = document.getElementById('view-kanban');
    if (view && !view.classList.contains('hidden')) KanbanModule.init();
});
