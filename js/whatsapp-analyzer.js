/**
 * WhatsApp Analyzer Module
 * Analisa conversas exportadas do WhatsApp com IA (Claude API)
 */

const WhatsAppAnalyzer = {
    CLAUDE_API_KEY: '',
    CLAUDE_MODEL: 'claude-haiku-4-5-20251001',
    conversations: [],
    results: [],

    init() {
        this.bindEvents();
    },

    bindEvents() {
        const dropzone  = document.getElementById('wpp-dropzone');
        const fileInput = document.getElementById('wpp-file-input');
        if (!dropzone || !fileInput) return;
        dropzone.addEventListener('click', () => fileInput.click());
        dropzone.addEventListener('dragover', (e) => { e.preventDefault(); dropzone.classList.add('dragover'); });
        dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));
        dropzone.addEventListener('drop', (e) => { e.preventDefault(); dropzone.classList.remove('dragover'); this.loadFiles(Array.from(e.dataTransfer.files)); });
        fileInput.addEventListener('change', () => { this.loadFiles(Array.from(fileInput.files)); fileInput.value=''; });
        document.getElementById('btn-wpp-analyze')?.addEventListener('click', () => this.analyzeAll());
        document.getElementById('btn-wpp-clear')?.addEventListener('click',   () => this.clearAll());
    },

    async loadFiles(files) {
        const valid = files.filter(f =>
            f.name.endsWith('.txt') || f.name.endsWith('.zip') ||
            f.type === 'text/plain' || f.type === 'application/zip' ||
            f.type === 'application/x-zip-compressed'
        );
        if (!valid.length) {
            this.showToast('⚠️ Selecione arquivos .zip ou .txt do WhatsApp.', 'warn');
            return;
        }

        this.showToast('📂 Carregando arquivos...', 'info');
        let totalLoaded = 0;

        for (const file of valid) {
            if (file.name.endsWith('.zip')) {
                await this.loadZip(file);
            } else {
                await this.loadTxt(file);
            }
            totalLoaded++;
        }

        this.renderFileList();
        this.showToast(`✅ ${totalLoaded} arquivo(s) carregado(s).`, 'success');
    },

    // Lê arquivo .txt direto
    loadTxt(file) {
        return new Promise((resolve) => {
            const reader = new FileReader();
            reader.onload = (e) => {
                const content = e.target.result;
                const name    = this.extractContactName(file.name, content);
                if (!this.conversations.find(c => c.fileName === file.name))
                    this.conversations.push({ fileName: file.name, contactName: name, content, status: 'pendente', loadedAt: Date.now() });
                resolve();
            };
            reader.readAsText(file, 'UTF-8');
        });
    },

    // Extrai .txt de dentro do .zip usando JSZip
    async loadZip(file) {
        // Carrega JSZip dinamicamente se não estiver disponível
        if (typeof JSZip === 'undefined') {
            await this.loadScript('https://cdnjs.cloudflare.com/ajax/libs/jszip/3.10.1/jszip.min.js');
        }

        try {
            const arrayBuffer = await file.arrayBuffer();
            const zip         = await JSZip.loadAsync(arrayBuffer);
            const txtFiles    = Object.keys(zip.files).filter(name =>
                name.endsWith('.txt') && !zip.files[name].dir
            );

            if (!txtFiles.length) {
                this.showToast(`⚠️ Nenhum .txt encontrado dentro de ${file.name}`, 'warn');
                return;
            }

            for (const txtName of txtFiles) {
                const content     = await zip.files[txtName].async('string');
                const contactName = this.extractContactName(txtName, content);
                const fileKey     = `${file.name}::${txtName}`;
                if (!this.conversations.find(c => c.fileName === fileKey))
                    this.conversations.push({ fileName: fileKey, contactName, content, status: 'pendente', loadedAt: Date.now() });
            }
        } catch (err) {
            this.showToast(`❌ Erro ao abrir ${file.name}: ${err.message}`, 'error');
        }
    },

    // Carrega script externo dinamicamente
    loadScript(src) {
        return new Promise((resolve, reject) => {
            if (document.querySelector(`script[src="${src}"]`)) { resolve(); return; }
            const s   = document.createElement('script');
            s.src     = src;
            s.onload  = resolve;
            s.onerror = reject;
            document.head.appendChild(s);
        });
    },

    extractContactName(fileName, content) {
        const fromFile = fileName.replace(/conversa do whatsapp com /i,'').replace('.txt','').trim();
        if (fromFile && fromFile !== fileName.replace('.txt','')) return fromFile;
        const match = content.split('\n').slice(0,5).join(' ').match(/com ([\w\s]+)/i);
        return match ? match[1].trim() : fileName.replace('.txt','');
    },

    renderFileList() {
        const list = document.getElementById('wpp-file-list');
        const btnA = document.getElementById('btn-wpp-analyze');
        const btnC = document.getElementById('btn-wpp-clear');
        if (!list) return;
        list.innerHTML = '';
        if (!this.conversations.length) { list.innerHTML='<p style="color:var(--text-muted);font-size:0.85rem;">Nenhum arquivo carregado.</p>'; if(btnA) btnA.disabled=true; return; }
        if (btnA) btnA.disabled = false;
        if (btnC) btnC.style.display = 'inline-flex';

        // Exibe do mais recentemente importado para o mais antigo
        const ordered = [...this.conversations].sort((a,b) => (b.loadedAt||0) - (a.loadedAt||0));

        ordered.forEach((conv) => {
            const i = this.conversations.indexOf(conv); // índice real para removeFile e status
            const msgCount = (conv.content.match(/\n\d{2}\/\d{2}\/\d{4}/g)||[]).length;
            const icons = {pendente:'⏳',analisando:'🔄',concluido:'✅',erro:'❌'};
            const item = document.createElement('div');
            item.id = `wpp-file-item-${i}`;
            item.style.cssText='display:flex;align-items:center;gap:0.6rem;padding:0.55rem 0.8rem;background:rgba(255,255,255,0.04);border-radius:8px;margin-bottom:0.4rem;border:1px solid rgba(255,255,255,0.07);font-size:0.85rem;';
            item.innerHTML=`<span style="font-size:1.1rem;">💬</span><div style="flex:1;min-width:0;"><div style="font-weight:500;color:var(--text-main);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${conv.contactName}</div><div style="font-size:0.75rem;color:var(--text-muted);">${msgCount} msgs · ${(conv.content.length/1024).toFixed(1)}KB</div></div><span id="wpp-status-${i}" style="font-size:1rem;">${icons[conv.status]||'⏳'}</span><button onclick="WhatsAppAnalyzer.removeFile(${i})" style="background:none;border:none;cursor:pointer;color:var(--text-muted);">✕</button>`;
            list.appendChild(item);
        });
    },

    removeFile(i) { this.conversations.splice(i,1); this.renderFileList(); },

    clearAll() {
        this.conversations=[]; this.results=[];
        this.renderFileList();
        document.getElementById('wpp-results-section').style.display='none';
        document.getElementById('wpp-summary-section').style.display='none';
    },

    async analyzeAll() {
        if (!this.conversations.length) return;
        if (!this.CLAUDE_API_KEY) { await this.runDemoMode(); return; }
        const btn = document.getElementById('btn-wpp-analyze');
        btn.disabled=true; btn.innerHTML='<i class="bx bx-loader-alt bx-spin"></i> Analisando...';
        this.results=[];
        document.getElementById('wpp-results-section').style.display='block';
        document.getElementById('wpp-results-list').innerHTML='';

        // Analisa na ordem original mas exibe do mais recente para o mais antigo
        const convOrdered = [...this.conversations].sort((a,b) => (b.loadedAt||0) - (a.loadedAt||0));

        for (let i=0; i<convOrdered.length; i++) {
            const conv = convOrdered[i];
            const realIdx = this.conversations.indexOf(conv);
            conv.status='analisando'; this.updateFileStatus(realIdx,'🔄');
            try {
                const result = await this.analyzeConversation(conv);
                conv.status='concluido'; this.updateFileStatus(realIdx,'✅');
                this.results.push({contactName:conv.contactName,...result});
                this.renderResult(result, conv.contactName, this.results.length - 1);
            } catch(err) { conv.status='erro'; this.updateFileStatus(realIdx,'❌'); }
            if (i < convOrdered.length-1) await this.sleep(800);
        }
        btn.disabled=false; btn.innerHTML='<i class="bx bx-search-alt"></i> Analisar Conversas';
        if (this.results.length>1) this.renderSummary();
    },

    async runDemoMode() {
        const btn = document.getElementById('btn-wpp-analyze');
        btn.disabled=true; btn.innerHTML='<i class="bx bx-loader-alt bx-spin"></i> Simulando...';
        this.results=[];
        document.getElementById('wpp-results-section').style.display='block';
        document.getElementById('wpp-results-list').innerHTML='';
        const demos = [
            {score:72,scoreLabel:'Bom',scoreColor:'#1D9E75',sentiment:'Positivo',stage:'Negociação',summary:'Conversa com boa progressão. Cliente demonstrou interesse real.',opportunities:['Cliente perguntou prazo de entrega — você não respondeu diretamente','Mencionou "estava pensando" — oportunidade de fechamento perdida'],positives:['Respondeu rápido','Apresentou o produto com clareza'],improvements:['Seja mais direto ao falar de preço','Faça uma pergunta de fechamento'],contacts:[],followUp:'Ligar em até 2 dias — cliente estava quase decidido'},
            {score:45,scoreLabel:'Regular',scoreColor:'#EF9F27',sentiment:'Neutro',stage:'Prospecção',summary:'Conversa inicial sem evolução. Cliente respondeu pouco.',opportunities:['Cliente citou concorrente — você poderia ter explorado o diferencial'],positives:['Abordagem educada','Enviou catálogo'],improvements:['Use perguntas abertas','Apresente cases de sucesso'],contacts:[],followUp:'Nova abordagem com proposta diferente em 1 semana'}
        ];
        for (let i=0; i<this.conversations.length; i++) {
            const conv = this.conversations[i];
            conv.status='analisando'; this.updateFileStatus(i,'🔄');
            await this.sleep(1200);
            const result = demos[i%demos.length];
            conv.status='concluido'; this.updateFileStatus(i,'✅');
            this.results.push({contactName:conv.contactName,...result});
            this.renderResult(result, conv.contactName, i);
        }
        btn.disabled=false; btn.innerHTML='<i class="bx bx-search-alt"></i> Analisar Conversas';
        this.showToast('⚠️ Modo demo. Configure sua API key para análise real.','warn');
        if (this.results.length>1) this.renderSummary();
    },

    async analyzeConversation(conv) {
        const sample = conv.content.split('\n').filter(l=>l.trim()).slice(-300).join('\n');
        const prompt = `Analise esta conversa de WhatsApp entre vendedor e cliente. Responda APENAS com JSON válido (sem markdown):
{"score":<0-100>,"scoreLabel":"<Ruim|Regular|Bom|Ótimo>","scoreColor":"<#E24B4A|#EF9F27|#1D9E75|#534AB7>","sentiment":"<Positivo|Neutro|Negativo|Misto>","stage":"<Prospecção|Apresentação|Negociação|Fechamento|Pós-venda|Perdido>","summary":"resumo 1-2 frases","opportunities":["oportunidade perdida"],"positives":["ponto positivo"],"improvements":["melhoria"],"contacts":["contato para prospectar"],"followUp":"o que fazer agora"}
CONVERSA:\n${sample}`;
        const res = await fetch('https://api.anthropic.com/v1/messages',{method:'POST',headers:{'Content-Type':'application/json','x-api-key':this.CLAUDE_API_KEY,'anthropic-version':'2023-06-01'},body:JSON.stringify({model:this.CLAUDE_MODEL,max_tokens:800,messages:[{role:'user',content:prompt}]})});
        if (!res.ok) throw new Error('API '+res.status);
        const data = await res.json();
        return JSON.parse(data.content[0]?.text.replace(/```json|```/g,'').trim());
    },

    updateFileStatus(i, icon) { const el=document.getElementById(`wpp-status-${i}`); if(el) el.textContent=icon; },

    renderResult(result, contactName, i) {
        const container = document.getElementById('wpp-results-list');
        const card = document.createElement('div');
        card.style.cssText='background:rgba(255,255,255,0.04);border:1px solid rgba(255,255,255,0.08);border-radius:12px;padding:1.2rem;margin-bottom:1rem;';
        const li = (arr,icon) => (arr||[]).map(o=>`<li style="margin-bottom:0.3rem;color:var(--text-muted);font-size:0.82rem;">${icon} ${o}</li>`).join('');
        card.innerHTML=`
            <div style="display:flex;align-items:flex-start;justify-content:space-between;gap:1rem;margin-bottom:1rem;flex-wrap:wrap;">
                <div><div style="font-size:1rem;font-weight:600;color:var(--text-main);">💬 ${contactName}</div><div style="font-size:0.8rem;color:var(--text-muted);margin-top:2px;">Etapa: ${result.stage||'—'} · Sentimento: ${result.sentiment||'—'}</div></div>
                <div style="text-align:center;min-width:70px;"><div style="font-size:2rem;font-weight:700;color:${result.scoreColor||'#888'};">${result.score||0}</div><div style="font-size:0.72rem;color:${result.scoreColor||'#888'};font-weight:500;">${result.scoreLabel||'—'}</div></div>
            </div>
            <div style="background:rgba(255,255,255,0.03);border-radius:8px;padding:0.7rem 0.9rem;margin-bottom:0.9rem;font-size:0.85rem;color:var(--text-main);line-height:1.5;">${result.summary||''}</div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.8rem;margin-bottom:0.8rem;">
                <div><div style="font-size:0.8rem;font-weight:500;color:var(--text-main);margin-bottom:0.4rem;">Pontos positivos</div><ul style="list-style:none;padding:0;margin:0;">${li(result.positives,'✅')}</ul></div>
                <div><div style="font-size:0.8rem;font-weight:500;color:var(--text-main);margin-bottom:0.4rem;">Oportunidades perdidas</div><ul style="list-style:none;padding:0;margin:0;">${li(result.opportunities,'⚠️')}</ul></div>
            </div>
            <div style="margin-bottom:0.8rem;"><div style="font-size:0.8rem;font-weight:500;color:var(--text-main);margin-bottom:0.4rem;">Como melhorar</div><ul style="list-style:none;padding:0;margin:0;">${li(result.improvements,'💡')}</ul></div>
            <div style="margin-top:0.9rem;padding:0.6rem 0.9rem;background:rgba(83,74,183,0.1);border-radius:8px;border-left:3px solid #534AB7;"><span style="font-size:0.78rem;font-weight:500;color:#9b94e8;">📌 Próximo passo: </span><span style="font-size:0.82rem;color:var(--text-main);">${result.followUp||'—'}</span></div>
            <div style="margin-top:0.8rem;display:flex;gap:0.5rem;flex-wrap:wrap;">
                <button class="btn btn-sm btn-primary" onclick="WhatsAppAnalyzer.addToCRM('${contactName.replace(/'/g,"\\'")}','${(result.followUp||'').replace(/'/g,"\\'")}')" style="font-size:0.78rem;">+ Adicionar ao CRM</button>
                <button class="btn btn-sm btn-outline" onclick="WhatsAppAnalyzer.copyInsights(${i})" style="font-size:0.78rem;">📋 Copiar insights</button>
            </div>`;
        container.appendChild(card);
    },

    renderSummary() {
        const section = document.getElementById('wpp-summary-section');
        if (!section||!this.results.length) return;
        section.style.display='block';
        const avg = Math.round(this.results.reduce((s,r)=>s+(r.score||0),0)/this.results.length);
        const best  = this.results.reduce((b,r)=>r.score>(b.score||0)?r:b,{});
        const stages = {};
        this.results.forEach(r=>{stages[r.stage]=(stages[r.stage]||0)+1;});
        const topStage = Object.entries(stages).sort((a,b)=>b[1]-a[1])[0];
        const topImprovement = this.results.flatMap(r=>r.improvements||[])[0]||'Continue praticando';
        document.getElementById('wpp-summary-content').innerHTML=`
            <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:0.8rem;margin-bottom:1rem;">
                <div style="text-align:center;background:rgba(255,255,255,0.04);border-radius:10px;padding:1rem;"><div style="font-size:2.2rem;font-weight:700;color:${avg>=70?'#1D9E75':avg>=50?'#EF9F27':'#E24B4A'};">${avg}</div><div style="font-size:0.78rem;color:var(--text-muted);">Pontuação média</div></div>
                <div style="text-align:center;background:rgba(255,255,255,0.04);border-radius:10px;padding:1rem;"><div style="font-size:2.2rem;font-weight:700;color:var(--text-main);">${this.results.length}</div><div style="font-size:0.78rem;color:var(--text-muted);">Conversas</div></div>
                <div style="text-align:center;background:rgba(255,255,255,0.04);border-radius:10px;padding:1rem;"><div style="font-size:1.1rem;font-weight:600;color:#534AB7;">${topStage?.[0]||'—'}</div><div style="font-size:0.78rem;color:var(--text-muted);">Etapa mais comum</div></div>
            </div>
            <div style="background:rgba(83,74,183,0.08);border-radius:8px;padding:0.8rem 1rem;margin-bottom:0.8rem;"><div style="font-size:0.82rem;font-weight:500;color:#9b94e8;margin-bottom:0.3rem;">🏆 Melhor negociação</div><div style="font-size:0.88rem;color:var(--text-main);">${best.contactName||'—'} — Score ${best.score||0}</div></div>
            <div style="background:rgba(229,57,53,0.06);border-radius:8px;padding:0.8rem 1rem;"><div style="font-size:0.82rem;font-weight:500;color:#E24B4A;margin-bottom:0.3rem;">💡 Principal melhoria</div><div style="font-size:0.88rem;color:var(--text-main);">${topImprovement}</div></div>`;
    },

    async addToCRM(contactName, followUpNote) {
        const today = new Date().toISOString().split('T')[0];
        const next  = new Date(today+'T00:00:00'); next.setDate(next.getDate()+7);
        await DataStore.add(STORAGE_KEYS.CUSTOMERS, {name:contactName,lastContactDate:today,nextFollowUp:next.toISOString().split('T')[0],notes:`[WhatsApp] ${followUpNote}`,status:'Contato',source:'WhatsApp'});
        this.showToast(`✅ "${contactName}" adicionado ao CRM!`,'success');
        if (typeof DashboardModule!=='undefined') DashboardModule.update();
    },

    copyInsights(i) {
        const r = this.results[i]; if(!r) return;
        const text = `Análise: ${r.contactName}\nScore: ${r.score}/100 (${r.scoreLabel})\nEtapa: ${r.stage}\n\n${r.summary}\n\nMelhorias:\n${(r.improvements||[]).map(m=>'• '+m).join('\n')}\n\nPróximo passo: ${r.followUp}`;
        navigator.clipboard.writeText(text).then(()=>this.showToast('📋 Copiado!','success'));
    },

    showToast(msg, type) {
        const old = document.getElementById('wpp-toast'); if(old) old.remove();
        const toast = document.createElement('div'); toast.id='wpp-toast';
        const bg = {success:'#1D9E75', warn:'#EF9F27', error:'#E24B4A', info:'#534AB7'}[type]||'#534AB7';
        toast.style.cssText=`position:fixed;bottom:1.5rem;right:1.5rem;background:${bg};color:white;padding:0.7rem 1.2rem;border-radius:8px;font-size:0.85rem;z-index:9999;box-shadow:0 4px 12px rgba(0,0,0,0.3);`;
        toast.textContent=msg; document.body.appendChild(toast);
        setTimeout(()=>toast.remove(), type==='info' ? 1500 : 3500);
    },

    sleep(ms) { return new Promise(r=>setTimeout(r,ms)); }
};

window.WhatsAppAnalyzer = WhatsAppAnalyzer;

document.addEventListener('DataStoreReady', () => {
    WhatsAppAnalyzer.init();
});
