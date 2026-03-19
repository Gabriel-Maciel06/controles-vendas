/**
 * CRM & Relacionamento Module — v2.0
 * Com edição completa de clientes via modal
 */

const CRMModule = {
    allAlerts: [], // guarda todos os clientes para filtrar localmente

    init() {
        this.cacheDOM();
        this.bindEvents();
        this.dom.dateInput.value = new Date().toISOString().split('T')[0];
        this.selectDays(15); // padrão 15 dias
        this.loadAlerts();
        if (typeof AISuggestions !== 'undefined') AISuggestions.renderSuggestionsPanel();
    },

    cacheDOM() {
        this.dom = {
            form:          document.getElementById('crm-form'),
            client:        document.getElementById('crm-client'),
            phone:         document.getElementById('crm-phone'),
            buyer:         document.getElementById('crm-buyer'),
            products:      document.getElementById('crm-products'),
            source:        document.getElementById('crm-source'),
            dateInput:      document.getElementById('crm-date'),
            notes:          document.getElementById('crm-notes'),
            followupDays:   document.getElementById('crm-followup-days'),
            followupPreview:document.getElementById('crm-followup-preview'),
            alertsBody:     document.getElementById('crm-alerts-body'),
            search:        document.getElementById('crm-search'),
            filterStatus:  document.getElementById('crm-filter-status'),
            filterFollowup:document.getElementById('crm-filter-followup'),
            btnClear:      document.getElementById('crm-btn-clear-filters'),
            count:         document.getElementById('crm-count'),
        };
    },

    bindEvents() {
        this.dom.form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await this.handleFormSubmit();
        });

        // Atualiza preview quando muda a data
        this.dom.dateInput.addEventListener('change', () => this.updatePreview());

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
        const contactDate = this.dom.dateInput.value;
        const days    = parseInt(this.dom.followupDays?.value || 15);
        const dateObj = new Date(contactDate + 'T00:00:00');
        dateObj.setDate(dateObj.getDate() + days);

        const newContact = {
            name:            this.dom.client.value.trim(),
            phone:           this.dom.phone.value.trim(),
            buyerName:       this.dom.buyer.value.trim(),
            products:        this.dom.products.value.trim(),
            source:          this.dom.source.value.trim(),
            lastContactDate: contactDate,
            notes:           this.dom.notes.value.trim(),
            nextFollowUp:    dateObj.toISOString().split('T')[0],
            status:          'Contato',
        };

        await DataStore.add(STORAGE_KEYS.CUSTOMERS, newContact);

        // Limpar formulário
        ['client','notes','phone','buyer','products','source'].forEach(f => this.dom[f].value = '');
        this.selectDays(15); // volta para padrão
        this.dom.client.focus();
        this.loadAlerts();
        if (typeof AISuggestions !== 'undefined') AISuggestions.renderSuggestionsPanel();
        if (typeof CalendarModule !== 'undefined') CalendarModule.loadEvents();
        if (typeof DashboardModule !== 'undefined') DashboardModule.update();
    },

    // ── Excluir registro ──
    deleteContact(id) {
        if (!confirm('Excluir este registro de contato?')) return;
        DataStore.remove(STORAGE_KEYS.CUSTOMERS, id);
        this.loadAlerts();
        if (typeof AISuggestions !== 'undefined') AISuggestions.renderSuggestionsPanel();
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
        document.getElementById('edit-source').value        = record.source   || '';
        document.getElementById('edit-status').value        = record.status   || 'Contato';
        document.getElementById('edit-lastContact').value   = record.lastContactDate || record.contactDate || '';
        document.getElementById('edit-nextFollowUp').value  = record.nextFollowUp    || '';
        document.getElementById('edit-notes').value         = record.notes    || '';

        document.getElementById('crm-edit-modal').classList.remove('hidden');
    },

    closeEditModal() {
        document.getElementById('crm-edit-modal').classList.add('hidden');
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
            name:            document.getElementById('edit-name').value.trim(),
            phone:           document.getElementById('edit-phone').value.trim(),
            buyerName:       document.getElementById('edit-buyer').value.trim(),
            email:           document.getElementById('edit-email').value.trim(),
            company:         document.getElementById('edit-company').value.trim(),
            cnpj:            document.getElementById('edit-cnpj').value.trim(),
            address:         document.getElementById('edit-address').value.trim(),
            instagram:       document.getElementById('edit-instagram').value.trim(),
            segment:         document.getElementById('edit-segment').value.trim(),
            products:        document.getElementById('edit-products').value.trim(),
            source:          document.getElementById('edit-source').value.trim(),
            status:          document.getElementById('edit-status').value,
            lastContactDate: lastContact,
            nextFollowUp:    nextFollowUp,
            notes:           document.getElementById('edit-notes').value.trim(),
        };

        const btn = document.getElementById('btn-save-edit');
        btn.disabled  = true;
        btn.innerText = 'Salvando...';

        await DataStore.update(STORAGE_KEYS.CUSTOMERS, id, updated);

        btn.disabled  = false;
        btn.innerText = 'Salvar alterações';

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

        this.allAlerts = Object.values(latest)
            .sort((a,b) => (a.nextFollowUp||'').localeCompare(b.nextFollowUp||''));

        this.applyFilters();
    },

    // ── Aplica busca + filtros sobre allAlerts ──
    applyFilters() {
        const query      = (this.dom.search?.value || '').toLowerCase().trim();
        const status     = this.dom.filterStatus?.value  || '';
        const followup   = this.dom.filterFollowup?.value || '';
        const today      = new Date().toISOString().split('T')[0];
        const weekEnd    = new Date(); weekEnd.setDate(weekEnd.getDate() + 7);
        const weekEndStr = weekEnd.toISOString().split('T')[0];

        let filtered = this.allAlerts.filter(c => {
            const name  = (c.name || c.client || '').toLowerCase();
            const phone = (c.phone || '').toLowerCase();
            const next  = c.nextFollowUp || '';

            // Busca por nome ou telefone
            if (query && !name.includes(query) && !phone.includes(query)) return false;

            // Filtro de status
            if (status && (c.status || 'Contato') !== status) return false;

            // Filtro de follow-up
            if (followup === 'atrasado' && !(next && next < today))          return false;
            if (followup === 'hoje'     && next !== today)                    return false;
            if (followup === 'semana'   && !(next >= today && next <= weekEndStr)) return false;
            if (followup === 'emdia'    && !(next >= today))                  return false;

            return true;
        });

        // Mostrar/esconder botão limpar
        const hasFilter = query || status || followup;
        if (this.dom.btnClear) this.dom.btnClear.style.display = hasFilter ? 'block' : 'none';

        this.updateCount(filtered.length, this.allAlerts.length);
        this.renderTable(filtered);
    },

    // ── Limpa todos os filtros ──
    clearFilters() {
        if (this.dom.search)        this.dom.search.value        = '';
        if (this.dom.filterStatus)  this.dom.filterStatus.value  = '';
        if (this.dom.filterFollowup)this.dom.filterFollowup.value = '';
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
