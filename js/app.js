// URL de Integração Google Sheets (ERP Central)
const API_URL = "https://script.google.com/macros/s/AKfycbz5DQBFNxfIzi5HLFlfJOL-oypbWxKgPZwhpaS7z10EiMfe0oJMOTGybSE7JqSBqYH1/exec";

// Gerenciador de Estado do Aplicativo
const DrevoApp = {
  // Lista de Pedidos
  orders: [],
  
  // Lista Padrão de Centros de Resultado
  costCenters: ["Marketing", "Engenharia", "Produção", "TI", "Almoxarifado", "Administrativo"],
  
  // Unidades de Medida
  units: ["Unidade", "Metros", "Kg", "Litros", "Pacote", "Caixa", "Saco"],

  // Normalizar status para termos padronizados em inglês
  normalizeStatus(status) {
    if (!status) return 'pending';
    const s = status.toString().toLowerCase().trim();
    if (s === 'pendente' || s === 'pending') return 'pending';
    if (s === 'aprovado' || s === 'approved') return 'approved';
    if (s === 'sincronizado' || s === 'synced' || s === 'sincronizado erp' || s === 'comprado' || s === 'bought') return 'synced';
    if (s === 'entregue' || s === 'done' || s === 'recebido') return 'done';
    if (s === 'done_obra' || s === 'entregue na obra' || s === 'obra_entregue' || s === 'entregue_obra') return 'done_obra';
    if (s === 'recusado' || s === 'rejected') return 'rejected';
    return 'pending';
  },

  // Inicialização do Aplicativo
  async init() {
    this.orders = [];
    this.cacheDOM();
    this.bindEvents();
    this.toggleObraField(); // Configura estado inicial da Obra
    this.registerServiceWorker(); // Ativa PWA
    await this.loadOrders();
    this.updateSmartCatalog(); // [NEW] Preenche o datalist
    this.renderKPIs();
    this.renderCharts(); // [NEW] Renderiza graficos
    this.renderSidebarClients(); // [NEW] Preenche clientes na Sidebar
    this.renderOrders();
    this.setupColorSwatches();
    this.setupAutoRefresh();
  },

  // Registrar Service Worker para tornar o app instalável (PWA)
  registerServiceWorker() {
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('./sw.js')
          .then(reg => console.log('PWA Service Worker ativo!', reg.scope))
          .catch(err => console.warn('Falha ao registrar Service Worker PWA:', err));
      });
    }
  },

  // Mapeamento dos Elementos DOM
  cacheDOM() {
    this.screens = document.querySelectorAll('.app-screen');
    this.navBtnHome = document.getElementById('nav-btn-home');
    this.navBtnTracking = document.getElementById('nav-btn-tracking');
    this.navLogo = document.getElementById('nav-logo');
    this.erpIndicatorText = document.getElementById('erp-indicator-text');
    
    this.massApprovalContainer = document.getElementById('mass-approval-container'); // [NEW]
    this.massApprovalCount = document.getElementById('mass-approval-count'); // [NEW]
    this.btnMassApprove = document.getElementById('btn-mass-approve'); // [NEW]
    this.chartCanvas = document.getElementById('kpi-chart'); // [NEW]
    this.statusChartCanvas = document.getElementById('status-chart'); // [NEW]
    this.itemsCatalog = document.getElementById('items-catalog'); // [NEW]
    this.selectedOrders = new Set(); // [NEW] Estado de selecao em lote

    // Cards de Ação na Home
    this.cardFp = document.getElementById('card-fp');
    this.cardCp = document.getElementById('card-cp');
    this.badgePendingCount = document.getElementById('badge-pending-count');

    // KPIs Dashboard
    this.kpiTotal = document.getElementById('kpi-total-val');
    this.kpiPending = document.getElementById('kpi-pending-val');
    this.kpiSynced = document.getElementById('kpi-synced-val');

    // Formulário
    this.orderForm = document.getElementById('purchase-order-form');
    this.inputItem = document.getElementById('input-item');
    this.selectUnit = document.getElementById('select-unit');
    this.inputQty = document.getElementById('input-qty');
    this.selectPriority = document.getElementById('select-priority'); // Novo
    this.inputColor = document.getElementById('input-color');
    this.inputBrand = document.getElementById('input-brand');
    this.inputRequester = document.getElementById('input-requester'); // Novo: Solicitante
    this.selectCostCenter = document.getElementById('select-costcenter');
    this.inputObra = document.getElementById('input-obra'); // Identificação da Obra
    this.btnCancelForm = document.getElementById('btn-cancel-form');
    
    // Novo Painel de Métricas do Dashboard
    this.kpiCriticalCount = document.getElementById('critical-orders-count');
    this.kpiApprovedCount = document.getElementById('approved-orders-count');
    this.kpiTopCostCenter = document.getElementById('top-cost-center');
    
    // Modal de Senha
    this.passwordOverlay = document.getElementById('password-overlay');
    this.inputPassword = document.getElementById('input-password');
    this.btnCancelPassword = document.getElementById('btn-cancel-password');
    this.btnConfirmPassword = document.getElementById('btn-confirm-password');
    this.btnConfirmPassword = document.getElementById('btn-confirm-password');
    
    // Upload de Arquivos
    this.inputPdf = document.getElementById('input-pdf');
    this.fileNameDisplay = document.getElementById('file-name-display');

    // Steppers Quantidade
    this.btnQtyMinus = document.getElementById('qty-minus');
    this.btnQtyPlus = document.getElementById('qty-plus');

    // Tela de Acompanhamento (CP)
    this.inputSearch = document.getElementById('input-search');
    this.filterTabs = document.querySelectorAll('.filter-tab');
    this.ordersContainer = document.getElementById('orders-container');
    this.btnExportCSV = document.getElementById('btn-export-csv');

    // Overlay de Sincronismo ERP
    this.syncOverlay = document.getElementById('sync-overlay');
    this.syncConsole = document.getElementById('sync-console');
    this.syncOrderTitle = document.getElementById('sync-order-title');

    // Toast de Notificação
    this.toast = document.getElementById('toast-notification');
    this.toastIcon = document.getElementById('toast-icon');
    this.toastText = document.getElementById('toast-text');

    // Container de Clientes na Sidebar
    this.sidebarClientsList = document.getElementById('sidebar-clients-list');

    // Estado ativo dos filtros e cards expandidos
    this.activeFilter = 'all';
    this.activeClientFilter = '';
    this.searchQuery = '';
    this.expandedCardId = null;
  },

  // Vinculação de Eventos
  bindEvents() {
    // Navegação
    this.cardFp.addEventListener('click', () => this.promptPasswordForOrderCreation());
    this.cardCp.addEventListener('click', () => this.navigateTo('screen-tracking'));
    this.navBtnHome.addEventListener('click', () => this.navigateTo('screen-home'));
    this.navBtnTracking.addEventListener('click', () => this.navigateTo('screen-tracking'));
    this.navLogo.addEventListener('click', () => this.navigateTo('screen-home'));

    // Arquivos PDF Form
    if (this.inputPdf) {
      this.inputPdf.addEventListener('change', (e) => {
        if (e.target.files.length > 0) {
          const file = e.target.files[0];
          if (file.size > 5 * 1024 * 1024) {
            this.showToast('O arquivo PDF não pode ser maior que 5MB.', 'error');
            this.inputPdf.value = '';
            this.fileNameDisplay.textContent = 'Nenhum arquivo selecionado';
          } else {
            this.fileNameDisplay.textContent = file.name;
          }
        } else {
          this.fileNameDisplay.textContent = 'Nenhum arquivo selecionado';
        }
      });
    }

    // Aprovação em Lote
    if (this.btnMassApprove) {
      this.btnMassApprove.addEventListener('click', () => this.approveSelectedOrders());
    }

    // Steppers de Quantidade
    this.btnQtyMinus.addEventListener('click', () => this.adjustQuantity(-1));
    this.btnQtyPlus.addEventListener('click', () => this.adjustQuantity(1));
    this.inputQty.addEventListener('change', () => {
      let val = parseInt(this.inputQty.value) || 1;
      if (val < 1) val = 1;
      this.inputQty.value = val;
    });

    // Evento de Centro de Custo para campo condicional de Obra
    this.selectCostCenter.addEventListener('change', () => this.toggleObraField());

    // Envio do Formulário
    this.orderForm.addEventListener('submit', (e) => this.handleFormSubmit(e));
    this.btnCancelForm.addEventListener('click', () => this.navigateTo('screen-home'));

    // Filtros e Busca no CP
    this.inputSearch.addEventListener('input', (e) => {
      this.searchQuery = e.target.value.toLowerCase().trim();
      this.renderOrders();
    });

    this.filterTabs.forEach(tab => {
      tab.addEventListener('click', (e) => {
        this.filterTabs.forEach(t => t.classList.remove('active'));
        e.target.classList.add('active');
        this.activeFilter = e.target.dataset.filter;
        this.renderOrders();
      });
    });

    // Exportar Planilha
    if (this.btnExportCSV) {
      this.btnExportCSV.addEventListener('click', () => this.exportToCSV());
    }

    // Eventos do Modal de Senha
    if (this.btnCancelPassword) {
      this.btnCancelPassword.addEventListener('click', () => {
        this.passwordOverlay.classList.remove('active');
      });
    }

    if (this.btnConfirmPassword) {
      this.btnConfirmPassword.addEventListener('click', () => this.handlePasswordSubmit());
    }

    if (this.inputPassword) {
      this.inputPassword.addEventListener('keyup', (e) => {
        if (e.key === 'Enter') {
          this.handlePasswordSubmit();
        }
      });
    }
  },

  // Alternar entre Telas com animação fluida (SPA)
  navigateTo(screenId) {
    this.screens.forEach(screen => {
      if (screen.id === screenId) {
        screen.style.display = 'block';
        // Delay minúsculo para permitir que o navegador registre o display block antes de aplicar opacidade (transição CSS)
        setTimeout(() => screen.classList.add('active'), 20);
      } else {
        screen.classList.remove('active');
        setTimeout(() => screen.style.display = 'none', 300);
      }
    });

    // Atualiza estado ativo dos botões da sidebar
    if (screenId === 'screen-home' || screenId === 'screen-form') {
      this.navBtnHome.classList.add('active');
      this.navBtnTracking.classList.remove('active');
    } else if (screenId === 'screen-tracking') {
      this.navBtnHome.classList.remove('active');
      this.navBtnTracking.classList.add('active');
    }

    // Comportamento do botão de ação em massa
    if (screenId === 'screen-tracking') {
      if (this.massApprovalContainer) this.massApprovalContainer.style.display = 'none';
      if (this.btnMassApprove) this.btnMassApprove.style.display = 'none';
    }

    // Scroll para o topo
    window.scrollTo({ top: 0, behavior: 'smooth' });

    // Atualiza estatísticas sempre que volta para Home
    if (screenId === 'screen-home') {
      this.renderKPIs();
    }
  },

  // Ajuste rápido de quantidade pelos botões +/-
  adjustQuantity(amount) {
    let currentVal = parseInt(this.inputQty.value) || 1;
    let newVal = currentVal + amount;
    if (newVal < 1) newVal = 1;
    this.inputQty.value = newVal;
  },

  // Mostrar/ocultar campo de Obra baseado no Centro de Resultado selecionado
  toggleObraField() {
    const isObra = this.selectCostCenter.value === 'Produção';
    const obraGroup = document.getElementById('group-obra');
    if (obraGroup) {
      if (isObra) {
        obraGroup.classList.remove('hidden');
        this.inputObra.required = true;
      } else {
        obraGroup.classList.add('hidden');
        this.inputObra.value = '';
        this.inputObra.required = false;
      }
    }
  },

  // Configurar paleta de cores rápidas (Swatches)
  setupColorSwatches() {
    const swatches = document.querySelectorAll('.swatch');
    swatches.forEach(swatch => {
      swatch.addEventListener('click', (e) => {
        swatches.forEach(s => s.classList.remove('selected'));
        e.target.classList.add('selected');
        this.inputColor.value = e.target.dataset.color;
      });
    });

    // Atualizar swatch selecionada se o usuário digitar manualmente
    this.inputColor.addEventListener('input', (e) => {
      const val = e.target.value.toLowerCase().trim();
      swatches.forEach(s => {
        if (s.dataset.color.toLowerCase() === val) {
          s.classList.add('selected');
        } else {
          s.classList.remove('selected');
        }
      });
    });
  },

  // ----------------------------------------------------
  // NOVAS FUNÇÕES (V2): CATALOG, CHAT E LOTE
  // ----------------------------------------------------
  
  toTitleCase(str) {
    if (!str) return '';
    return str.trim().toLowerCase().replace(/(?:^|\s|-)\S/g, function(a) { return a.toUpperCase(); });
  },

  // Extrair o nome principal do cliente da requisição (ex: "Flavio - Cozinha" -> "Flavio", "Fernando portas vidro" -> "Fernando")
  extractClientName(order) {
    let raw = '';
    if (order.client && order.client.trim() !== '') {
      raw = order.client.trim();
    } else if (order.obra && order.obra.trim() !== '') {
      raw = order.obra.trim();
    }

    if (!raw) return '';

    const lower = raw.toLowerCase();
    const ignoreTerms = ['interno', 'almoxarifado', 'showroom', 'router', 'oleo', 'produ', 'saco', 'coladeira'];
    for (let i = 0; i < ignoreTerms.length; i++) {
      if (lower.includes(ignoreTerms[i])) return '';
    }

    // Dividir por traços ou hífens
    const parts = raw.split(/[-–—/]/);
    let main = parts[0].trim();

    // Nomes compostos conhecidos
    const multiWordClients = ['rafael camargo', 'joão antônio', 'joao antonio'];
    for (let i = 0; i < multiWordClients.length; i++) {
      if (main.toLowerCase().startsWith(multiWordClients[i])) {
        return this.toTitleCase(multiWordClients[i]);
      }
    }

    // Se houver múltiplas palavras (ex: "Fernando portas vidro"), pegar apenas o primeiro nome do cliente
    const words = main.split(/\s+/);
    if (words.length > 1) {
      return this.toTitleCase(words[0]);
    }

    return this.toTitleCase(main);
  },

  // Renderizar Lista Dinâmica de Clientes no Menu Lateral (Sidebar)
  renderSidebarClients() {
    if (!this.sidebarClientsList) return;

    // Agrupar e contar pedidos por cliente com chave minúscula para evitar duplicatas (cidalia x Cidalia)
    const clientMap = {}; // { 'cidalia': { name: 'Cidalia', count: 3 } }
    this.orders.forEach(o => {
      const name = this.extractClientName(o);
      if (name) {
        const key = name.toLowerCase();
        if (!clientMap[key]) {
          clientMap[key] = { name: name, count: 0 };
        }
        clientMap[key].count++;
      }
    });

    const clientKeys = Object.keys(clientMap).sort((a, b) => clientMap[a].name.localeCompare(clientMap[b].name));

    let html = `
      <button class="sidebar-nav-btn ${!this.activeClientFilter ? 'active' : ''}" data-client="" style="font-size: 0.8rem; padding: 0.5rem 0.8rem; justify-content: space-between;">
        <span style="display: flex; align-items: center; gap: 0.5rem;">
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
          Todos os Pedidos
        </span>
        <span style="font-size: 0.7rem; opacity: 0.6;">${this.orders.length}</span>
      </button>
    `;

    clientKeys.forEach(key => {
      const client = clientMap[key].name;
      const count = clientMap[key].count;
      const isActive = (this.activeClientFilter.toLowerCase() === key);

      html += `
        <button class="sidebar-nav-btn ${isActive ? 'active' : ''}" data-client="${client}" style="font-size: 0.8rem; padding: 0.5rem 0.8rem; justify-content: space-between; border-radius: 8px;">
          <span style="display: flex; align-items: center; gap: 0.5rem; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
            ${client}
          </span>
          <span style="font-size: 0.7rem; background: rgba(255,255,255,0.08); padding: 0.1rem 0.4rem; border-radius: 10px; font-weight: 600;">${count}</span>
        </button>
      `;
    });

    this.sidebarClientsList.innerHTML = html;

    // Vincular clique em cada botão de cliente da sidebar
    this.sidebarClientsList.querySelectorAll('button[data-client]').forEach(btn => {
      btn.addEventListener('click', () => {
        const clientSelected = btn.dataset.client;
        this.activeClientFilter = clientSelected;
        this.searchQuery = clientSelected.toLowerCase().trim();
        this.inputSearch.value = clientSelected;
        this.renderSidebarClients();
        this.navigateTo('screen-tracking');
        this.renderOrders();
      });
    });
  },

  updateSmartCatalog() {
    if (!this.itemsCatalog) return;
    const uniqueItems = new Set(this.orders.map(o => o.item.trim()).filter(i => i !== ''));
    let html = '';
    Array.from(uniqueItems).sort().forEach(item => {
      html += `<option value="${item}"></option>`;
    });
    this.itemsCatalog.innerHTML = html;
  },

  toggleOrderSelection(uid) {
    if (this.selectedOrders.has(uid)) {
      this.selectedOrders.delete(uid);
    } else {
      this.selectedOrders.add(uid);
    }
    this.updateMassApprovalUI();
  },

  updateMassApprovalUI() {
    if (!this.massApprovalContainer) return;
    if (this.selectedOrders.size > 0) {
      this.massApprovalContainer.style.display = 'flex';
      this.massApprovalCount.textContent = this.selectedOrders.size;
    } else {
      this.massApprovalContainer.style.display = 'none';
    }
  },

  async approveSelectedOrders() {
    if (this.selectedOrders.size === 0) return;
    if (confirm(`Deseja realmente aprovar ${this.selectedOrders.size} pedidos de uma vez?`)) {
      const arrayToApprove = Array.from(this.selectedOrders);
      this.btnMassApprove.disabled = true;
      this.btnMassApprove.textContent = 'Aprovando...';

      for (let uid of arrayToApprove) {
        await this.approveOrder(uid, true); // O 'true' indica 'skipReRender' que vamos adicionar no método
      }

      this.selectedOrders.clear();
      this.updateMassApprovalUI();
      this.btnMassApprove.disabled = false;
      this.btnMassApprove.textContent = 'Aprovar Lote';
      
      this.renderKPIs();
      this.renderCharts();
      this.renderOrders();
      this.showToast('Lote aprovado com sucesso!', 'success');
    }
  },

  renderCharts() {
    if (!this.chartCanvas || !this.statusChartCanvas) return;
    if (typeof Chart === 'undefined') return; // Segurança caso o CDN não carregue
    
    if (this.chartInstance) {
      this.chartInstance.destroy();
    }
    if (this.statusChartInstance) {
      this.statusChartInstance.destroy();
    }
    
    // Gráfico 1: Pedidos por Centro de Custo
    const costCenterData = {};
    const statusData = { pending: 0, approved: 0, synced: 0, done: 0 };

    this.orders.forEach(o => {
      // Centro de Custo
      const cc = o.costCenter || 'Outros';
      costCenterData[cc] = (costCenterData[cc] || 0) + 1;

      // Status com a normalização correta dos valores vindos da planilha
      const normSt = this.normalizeStatus(o.status);
      if (normSt === 'done_obra') {
        statusData['done']++;
      } else if (statusData[normSt] !== undefined) {
        statusData[normSt]++;
      }
    });
    
    const ccLabels = Object.keys(costCenterData);
    const ccData = Object.values(costCenterData);
    
    const textColor = '#A8B0C6';
    const gridColor = 'rgba(255,255,255,0.05)';
    
    const ctxBar = this.chartCanvas.getContext('2d');
    this.chartInstance = new Chart(ctxBar, {
      type: 'bar',
      data: {
        labels: ccLabels,
        datasets: [{
          label: 'Qtd de Pedidos',
          data: ccData,
          backgroundColor: '#3498db',
          borderRadius: 6
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: { 
            beginAtZero: true,
            ticks: { color: textColor, precision: 0, stepSize: 1 },
            grid: { color: gridColor }
          },
          x: {
            ticks: { color: textColor },
            grid: { display: false }
          }
        }
      }
    });

    // Gráfico 2: Status (Donut)
    const ctxDonut = this.statusChartCanvas.getContext('2d');
    this.statusChartInstance = new Chart(ctxDonut, {
      type: 'doughnut',
      data: {
        labels: ['Pendentes', 'Aprovados', 'Sincronizados', 'Concluídos'],
        datasets: [{
          data: [statusData.pending, statusData.approved, statusData.synced, statusData.done],
          backgroundColor: ['#f39c12', '#2ecc71', '#9b59b6', '#3498db'],
          borderWidth: 0
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        cutout: '75%',
        plugins: {
          legend: { 
            position: 'right',
            labels: { color: textColor, usePointStyle: true, padding: 20 }
          }
        }
      }
    });
  },
  
  async sendChatMessage(uid) {
    const order = this.orders.find(o => (o._uid || o.id) === uid);
    if (!order) return;
    
    const inputField = document.getElementById(`chat-input-${uid}`);
    if (!inputField) return;
    const text = inputField.value.trim();
    if (!text) return;
    
    inputField.value = '';
    
    let comments = [];
    try {
      comments = typeof order.comments === 'string' ? JSON.parse(order.comments) : (order.comments || []);
    } catch(e) { comments = []; }
    
    comments.push({
      author: 'Você', // Mostra como 'Você' localmente
      text: text,
      timestamp: new Date().toISOString()
    });
    
    order.comments = JSON.stringify(comments);
    this.saveOrders(); // Salva localmente
    
    const messagesContainer = document.getElementById(`chat-messages-${uid}`);
    if (messagesContainer) {
      messagesContainer.innerHTML += `
        <div class="chat-message self">
          <span class="chat-message-author">Você</span>
          <p class="chat-message-text">${text}</p>
          <span class="chat-message-time">Agora mesmo</span>
        </div>
      `;
      messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    if (typeof API_URL !== 'undefined' && API_URL) {
      try {
        await fetch(API_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: "AdicionarComentario",
            id: order.id,
            author: "Gestor", // ou inputRequester se for o app do usuário
            text: text
          })
        });
      } catch (err) {
        console.error("Erro ao enviar mensagem:", err);
      }
    }
  },


  // Carregar Pedidos (Google Sheets ou LocalStorage fallback)
  async loadOrders() {
    // 1. Carregar do LocalStorage como fallback imediato (evita tela em branco)
    const stored = localStorage.getItem('drevo_compras_pedidos');
    if (stored) {
      this.orders = JSON.parse(stored);
      // Filtrar e remover pedidos de demonstração antigos
      const mockIds = ['PED-0067', 'PED-0066', 'PED-0065', 'PED-0064'];
      this.orders = this.orders.filter(o => !mockIds.includes(o.id));
    } else {
      // Nenhum pedido de demonstração inicial
      this.orders = [];
      this.saveOrders();
    }

    // 2. Tentar carregar da Planilha Google (se houver API_URL ativo)
    if (typeof API_URL !== 'undefined' && API_URL) {
      try {
        this.erpIndicatorText.innerHTML = `<span class="status-dot" style="background-color: var(--status-pending-text); box-shadow: 0 0 10px var(--status-pending-text);"></span> <span style="white-space: nowrap;">Conectando...</span>`;
        
        const res = await fetch(`${API_URL}?_=${Date.now()}`);
        const data = await res.json();
        
        if (data && data.orders) {
            // Filtrar os pedidos vazios da planilha e os mais recentes primeiro no display
            this.orders = data.orders.filter(o => o.id && o.id.trim() !== '' && o.item && o.item.trim() !== '').reverse();
            // Garantir que cada pedido tenha um identificador 100% unico para a interface (evita bugs se houver IDs duplicados na planilha)
            this.orders.forEach(o => { if(!o._uid) o._uid = Math.random().toString(36).substring(2, 11); });
            this.saveOrders(); // Sincronizar cache local
            this.renderSidebarClients(); // Atualiza a lista de clientes na Sidebar
          
          this.erpIndicatorText.innerHTML = `<span class="status-dot"></span> <span style="white-space: nowrap;">ERP Conectado</span>`;
        }
      } catch (err) {
        console.warn("Erro ao buscar da Planilha Google, utilizando cache local:", err);
        this.erpIndicatorText.innerHTML = `<span class="status-dot" style="background-color: var(--status-pending-text); box-shadow: 0 0 10px var(--status-pending-text);"></span> <span style="white-space: nowrap;">Banco Local</span>`;
      }
    }
  },

  // Salvar Pedidos no localStorage
  saveOrders() {
    localStorage.setItem('drevo_compras_pedidos', JSON.stringify(this.orders));
  },

  // Renderizar Estatísticas (KPIs)
  renderKPIs() {
    const total = this.orders.length;
    const pending = this.orders.filter(o => {
      const norm = this.normalizeStatus(o.status);
      return norm === 'pending' || norm === 'approved';
    }).length;
    const synced = this.orders.filter(o => {
      const norm = this.normalizeStatus(o.status);
      return norm === 'synced' || norm === 'done' || norm === 'done_obra';
    }).length;

    this.kpiTotal.textContent = String(total).padStart(2, '0');
    this.kpiPending.textContent = String(pending).padStart(2, '0');
    this.kpiSynced.textContent = String(synced).padStart(2, '0');

    // Badge na home
    if (pending > 0) {
      this.badgePendingCount.style.display = 'block';
      this.badgePendingCount.textContent = pending;
    } else {
      this.badgePendingCount.style.display = 'none';
    }

    // --- NOVAS MÉTRICAS OPERACIONAIS DO DASHBOARD ---
    const activeCritical = this.orders.filter(o => {
      const norm = this.normalizeStatus(o.status);
      return norm !== 'done' && norm !== 'done_obra' && norm !== 'rejected' && o.priority === 'critico';
    }).length;

    const approvedCount = this.orders.filter(o => {
      const norm = this.normalizeStatus(o.status);
      return norm === 'approved';
    }).length;

    const activeOrders = this.orders.filter(o => {
      const norm = this.normalizeStatus(o.status);
      return norm !== 'done' && norm !== 'done_obra';
    });
    let topCC = 'Nenhum';
    if (activeOrders.length > 0) {
      const ccCounts = {};
      activeOrders.forEach(o => {
        ccCounts[o.costCenter] = (ccCounts[o.costCenter] || 0) + 1;
      });
      let maxCC = '';
      let maxCount = 0;
      for (const cc in ccCounts) {
        if (ccCounts[cc] > maxCount) {
          maxCount = ccCounts[cc];
          maxCC = cc;
        }
      }
      topCC = maxCC || 'Nenhum';
    }

    if (this.kpiCriticalCount) this.kpiCriticalCount.textContent = String(activeCritical).padStart(2, '0');
    if (this.kpiApprovedCount) this.kpiApprovedCount.textContent = String(approvedCount).padStart(2, '0');
    if (this.kpiTopCostCenter) this.kpiTopCostCenter.textContent = topCC;
  },

  // Submissão do Formulário de Novo Pedido (FP)
  async handleFormSubmit(e) {
    e.preventDefault();

    // Obter Valores
    const requester = this.inputRequester.value.trim(); // Novo
    const item = this.inputItem.value.trim();
    const unit = this.selectUnit.value;
    const qty = parseInt(this.inputQty.value) || 1;
    const priority = this.selectPriority ? this.selectPriority.value : 'normal'; // Novo
    const color = this.inputColor.value.trim() || 'Padrão';
    const brand = this.inputBrand.value.trim() || 'Sem preferência';
    const costCenter = this.selectCostCenter.value;
    const obra = costCenter === 'Produção' ? this.inputObra.value.trim() : '';

    // Validação Simples
    if (!requester) {
      this.showToast('Por favor, informe seu nome como solicitante.', 'error');
      this.inputRequester.focus();
      return;
    }

    // Salvar o nome do solicitante localmente para identificar o usuário deste dispositivo
    localStorage.setItem('drevo_last_requester', requester);
    
    // Solicita permissão Push ao criar o pedido e já salva o token na planilha do Apps Script
    this.requestPushPermission(requester);

    if (!item) {
      this.showToast('Por favor, informe a descrição do item.', 'error');
      this.inputItem.focus();
      return;
    }

    if (costCenter === 'Produção' && !obra) {
      this.showToast('Por favor, identifique a obra de destino.', 'error');
      this.inputObra.focus();
      return;
    }

    // Criar animação de loading no botão submit
    const btnSubmit = this.orderForm.querySelector('.btn-form-submit');
    const originalContent = btnSubmit.innerHTML;
    btnSubmit.disabled = true;
    btnSubmit.innerHTML = `<svg class="sync-radar-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="animation: spin 1s infinite linear;"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg> Registrando...`;

    // Gerar ID sequencial único
    const lastIdNum = this.orders.reduce((max, order) => {
      const num = parseInt(order.id.split('-')[1]) || 0;
      return num > max ? num : max;
    }, 0);
    const newId = `PED-${String(lastIdNum + 1).padStart(4, '0')}`;

    // Gerar Data Atual Formatada
    const now = new Date();
    const formattedDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;

    // Processar Arquivo PDF (se houver)
    let pdfFile = null;
    if (this.inputPdf && this.inputPdf.files.length > 0) {
      const file = this.inputPdf.files[0];
      try {
        const base64String = await new Promise((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const dataUrl = reader.result;
            // Remover o cabeçalho 'data:application/pdf;base64,' do início
            const base64 = dataUrl.split(',')[1];
            resolve(base64);
          };
          reader.onerror = reject;
          reader.readAsDataURL(file);
        });
        
        pdfFile = {
          name: file.name,
          data: base64String,
          mimeType: file.type
        };
      } catch (err) {
        console.error("Erro ao ler o PDF:", err);
        this.showToast("Erro ao processar o arquivo PDF.", "error");
        btnSubmit.disabled = false;
        btnSubmit.innerHTML = originalContent;
        return;
      }
    }

    // Instanciar Pedido
    const newOrder = {
      _uid: Math.random().toString(36).substring(2, 11),
      id: newId,
      item,
      unit,
      qty,
      color,
      brand,
      costCenter,
      obra,
      priority, // Novo
      requester, // Novo
      status: 'pending', // Inicia pendente de aprovação
      date: formattedDate,
      pdfUrl: '', // Vai ser atualizado no backend, ou via sync
      logs: [ // Novo
        { action: 'pending', message: `Pedido lançado no sistema por ${requester}.`, date: formattedDate }
      ]
    };

    // Tentar gravar na Planilha Google
    if (typeof API_URL !== 'undefined' && API_URL) {
      try {
        const payload = {
          action: "CriarPedido",
          id: newId,
          item,
          unit,
          qty,
          color,
          brand,
          costCenter,
          obra,
          priority,
          requester,
          pdfFile: pdfFile // Adiciona o objeto com base64
        };
        
        // Se houver PDF, o upload demora um pouco mais, vamos avisar o usuário
        if (pdfFile) {
          btnSubmit.innerHTML = `<svg class="sync-radar-icon" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" style="animation: spin 1s infinite linear;"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg> Enviando PDF...`;
        }

        const response = await fetch(API_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        });
        
        this.showToast(`Pedido ${newId} registrado na nuvem!`, 'success');
      } catch (err) {
        console.error("Erro ao gravar na planilha Google:", err);
        this.showToast(`Erro na nuvem! Salvo localmente.`, 'error');
      }
    } else {
      this.showToast(`Pedido ${newId} registrado offline!`, 'success');
    }

    // Notificar Gestão via FCM
    this.dispararPush(`Novo Pedido: ${newId}`, `${requester} solicitou ${qty}x ${item}`);

    // Adicionar no estado e salvar localmente
    this.orders.unshift(newOrder);
    this.saveOrders();

    // Reset do Form
    this.orderForm.reset();
    this.toggleObraField();
    document.querySelectorAll('.swatch').forEach(s => s.classList.remove('selected'));
    this.inputQty.value = 1;
    if (this.selectPriority) this.selectPriority.value = 'normal'; // Novo

    // Restaurar Botão
    btnSubmit.disabled = false;
    btnSubmit.innerHTML = originalContent;

    // Ir para tela de acompanhamento
    this.navigateTo('screen-tracking');
    this.renderKPIs();
    this.renderOrders();
  },

  // Renderizar Lista de Pedidos
  renderOrders() {
    this.ordersContainer.innerHTML = '';

    // Filtrar Pedidos
    const filtered = this.orders.filter(order => {
      // Filtro por Tab de Status
      let passFilter = false;
      const normStatus = this.normalizeStatus(order.status);
      if (this.activeFilter === 'all') {
        passFilter = true; // Exibe todos os pedidos (pendentes, comprados e concluídos)
      } else if (this.activeFilter === 'pending') {
        passFilter = (normStatus === 'pending' || normStatus === 'approved');
      } else if (this.activeFilter === 'synced') {
        passFilter = (normStatus === 'synced');
      } else if (this.activeFilter === 'done') {
        passFilter = (normStatus === 'done' || normStatus === 'done_obra');
      }

      // Filtro por Busca (suporta busca por item, ID, marca, setor ou cliente/obra)
      let passSearch = false;
      if (!this.searchQuery) {
        passSearch = true;
      } else {
        const q = this.searchQuery;
        const clientName = this.extractClientName(order).toLowerCase();
        passSearch = order.item.toLowerCase().includes(q) ||
                     order.id.toLowerCase().includes(q) ||
                     order.brand.toLowerCase().includes(q) ||
                     order.costCenter.toLowerCase().includes(q) ||
                     (order.obra && order.obra.toLowerCase().includes(q)) ||
                     (order.client && order.client.toLowerCase().includes(q)) ||
                     clientName.includes(q);
      }

      return passFilter && passSearch;
    });

    // Se não houver pedidos na lista
    if (filtered.length === 0) {
      this.ordersContainer.innerHTML = `
        <div class="no-orders-box">
          <div class="no-orders-icon">📂</div>
          <h3>Nenhum pedido localizado</h3>
          <p style="font-size: 0.8rem; opacity: 0.7; margin-top: 0.3rem;">Tente ajustar sua busca ou mude a aba de status.</p>
        </div>
      `;
      return;
    }

    // Renderizar cada card
    filtered.forEach(order => {
      const card = document.createElement('div');
      card.className = 'order-card';
      const safeUid = order._uid || order.id;
      card.id = `card-${safeUid}`;

      // Função auxiliar para gerar datas fictícias progressivas em caso de fallback
      const parseAndAddHours = (dateStr, hoursToAdd) => {
        try {
          const parts = dateStr.split(' ');
          if (parts.length !== 2) return dateStr;
          const dParts = parts[0].split('/');
          const tParts = parts[1].split(':');
          if (dParts.length !== 3 || tParts.length !== 2) return dateStr;
          
          let dt = new Date(dParts[2], dParts[1] - 1, dParts[0], tParts[0], tParts[1]);
          dt.setHours(dt.getHours() + hoursToAdd);
          return `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}/${dt.getFullYear()} ${String(dt.getHours()).padStart(2, '0')}:${String(dt.getMinutes()).padStart(2, '0')}`;
        } catch(e) {
          return dateStr;
        }
      };

      // Gerar logs padrões se o pedido antigo não possuir logs (retrocompatibilidade)
      if (!order.logs) {
        order.logs = [
          { action: 'pending', message: `Pedido lançado no sistema por ${order.requester || 'Colaborador'}.`, date: order.date }
        ];
        const oldSt = this.normalizeStatus(order.status);
        if (oldSt === 'approved' || oldSt === 'synced' || oldSt === 'done' || oldSt === 'done_obra') {
          order.logs.push({ action: 'approved', message: 'Pedido aprovado pelo Gestor.', date: order.dateApproved || parseAndAddHours(order.date, 2) });
        }
        if (oldSt === 'synced' || oldSt === 'done' || oldSt === 'done_obra') {
          order.logs.push({ action: 'synced', message: 'Compra faturada via ERP corporativo.', date: order.dateSynced || parseAndAddHours(order.dateApproved || order.date, 4) });
        }
        if (oldSt === 'done' || oldSt === 'done_obra') {
          const logMsg = (oldSt === 'done_obra') ? 'Material entregue na obra destino.' : 'Material recebido no Almoxarifado.';
          order.logs.push({ action: oldSt, message: logMsg, date: order.dateDone || parseAndAddHours(order.dateSynced || order.date, 24) });
        }
      }

      // Obter textos de tradução e cores de status mapeados da Planilha
      let statusText = 'Aguardando Aprovação';
      let statusClass = 'status-pending';
      
      const st = this.normalizeStatus(order.status);
      
      if (st === 'approved') {
        statusText = 'Aprovado pelo Gestor';
        statusClass = 'status-approved';
      } else if (st === 'synced') {
        statusText = 'Comprado';
        statusClass = 'status-synced';
      } else if (st === 'done') {
        statusText = 'Disponível no Almoxarifado';
        statusClass = 'status-done';
      } else if (st === 'done_obra') {
        statusText = 'Entregue na Obra';
        statusClass = 'status-done-obra';
      } else if (st === 'rejected') {
        statusText = 'Pedido Recusado';
        statusClass = 'status-rejected';
      }

      // Definir progresso da barra na timeline
      let progressPercent = 0;
      if (st === 'approved') progressPercent = 33;
      else if (st === 'synced') progressPercent = 66;
      else if (st === 'done' || st === 'done_obra') progressPercent = 100;

      // Configuração das classes ativas nos nós da timeline
      const node1Class = 'completed';
      const node2Class = (st === 'approved' || st === 'synced' || st === 'done' || st === 'done_obra') ? (st === 'approved' ? 'active' : 'completed') : '';
      const node3Class = (st === 'synced' || st === 'done' || st === 'done_obra') ? (st === 'synced' ? 'active' : 'completed') : '';
      const node4Class = (st === 'done' || st === 'done_obra') ? 'active' : '';

      // Prioridade formatada para exibição
      const priorityLabel = {
        'normal': 'Normal',
        'urgente': 'Urgente',
        'critico': 'Crítico'
      }[order.priority || 'normal'] || 'Normal';

      // SVG Ícone Chevron
      const chevronSvg = `<svg class="card-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"></polyline></svg>`;

      // SLA Logic (Alerta de Atraso)
      let isSlaWarning = false;
      let isSlaCritical = false;
      if (st === 'pending' && order.date) {
        try {
          // A data está no formato DD/MM/YYYY
          const datePart = order.date.split(' ')[0];
          const parts = datePart.split('/');
          if (parts.length === 3) {
            const orderDate = new Date(parts[2], parts[1] - 1, parts[0]);
            const now = new Date();
            const diffTime = now.getTime() - orderDate.getTime();
            const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
            if (diffDays >= 7) isSlaCritical = true;
            else if (diffDays >= 3) isSlaWarning = true;
          }
        } catch(e) {}
      }
      if (isSlaWarning) card.classList.add('sla-warning');
      if (isSlaCritical) card.classList.add('sla-critical');

      card.innerHTML = `
        <div class="order-header-main" onclick="DrevoApp.toggleCard('${safeUid}')">
          <div class="order-meta-info">
            <div class="order-id-row">
              ${st === 'pending' ? `<input type="checkbox" class="mass-approve-checkbox" ${this.selectedOrders.has(safeUid) ? 'checked' : ''} onclick="event.stopPropagation(); DrevoApp.toggleOrderSelection('${safeUid}')">` : ''}
              <span class="order-id">${order.id}</span>
              <span class="priority-badge priority-${order.priority || 'normal'}">${priorityLabel}</span>
              <span class="order-date">${order.date}</span>
            </div>
            <h3 class="order-item-title">${order.item}</h3>
          </div>
          <div class="order-right-box">
            <span class="status-badge ${statusClass}">${statusText}</span>
            ${chevronSvg}
          </div>
        </div>
        <div class="order-details-pane">
          <div class="details-content">
            
            <div class="specs-grid">
              ${(order.obra || order.client) ? `
              <div class="spec-item">
                <span class="spec-label">Cliente / Obra</span>
                <span class="spec-val" style="font-weight: 600; color: #60a5fa;">👤 ${order.obra || order.client}</span>
              </div>` : ''}
              <div class="spec-item">
                <span class="spec-label">Solicitante</span>
                <span class="spec-val" style="font-weight: 600; color: var(--sync-white);">${order.requester || 'Não informado'}</span>
              </div>
              <div class="spec-item">
                <span class="spec-label">Quantidade</span>
                <span class="spec-val">${order.qty} ${order.unit}(s)</span>
              </div>
              <div class="spec-item">
                <span class="spec-label">Cor Especificada</span>
                <span class="spec-val spec-color-indicator">
                  <span class="spec-color-dot" style="background-color: ${this.resolveColorHex(order.color)};"></span>
                  ${order.color}
                </span>
              </div>
              <div class="spec-item">
                <span class="spec-label">Marca Escolhida</span>
                <span class="spec-val">${order.brand}</span>
              </div>
              <div class="spec-item">
                <span class="spec-label">Centro de Resultado</span>
                <span class="spec-val">${order.costCenter}</span>
              </div>
              ${order.obra ? `
              <div class="spec-item form-col-full" style="grid-column: span 2;">
                <span class="spec-label">Obra Destino</span>
                <span class="spec-val" style="color: var(--sync-red); font-weight: 600;">${order.obra}</span>
              </div>
              ` : ''}
            </div>

            <!-- NOVO: SEÇÃO DE PDF -->
            <div class="order-pdf-section" style="margin-top: 1.5rem; padding-top: 1.5rem; border-top: 1px solid rgba(255, 255, 255, 0.05);">
              <div class="timeline-title" style="margin-bottom: 1rem;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                Anexo do Pedido (Orçamento / NF)
              </div>
              ${order.pdfUrl && order.pdfUrl.trim() !== '' ? `
                <a href="${order.pdfUrl}" target="_blank" class="btn-download-pdf">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="7 10 12 15 17 10"></polyline><line x1="12" y1="15" x2="12" y2="3"></line></svg>
                  Visualizar / Baixar PDF
                </a>
              ` : `
                <div class="pdf-upload-post">
                  <input type="file" id="post-pdf-${safeUid}" class="input-field" accept="application/pdf" style="display: none;" onchange="DrevoApp.uploadPostPdf('${safeUid}', this)">
                  <button class="btn-upload-pdf" onclick="event.stopPropagation(); document.getElementById('post-pdf-${safeUid}').click();">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path><polyline points="17 8 12 3 7 8"></polyline><line x1="12" y1="3" x2="12" y2="15"></line></svg>
                    Anexar PDF a este Pedido
                  </button>
                  <span id="post-pdf-status-${safeUid}" class="pdf-status-text" style="font-size: 0.8rem; color: var(--neutral-400); margin-left: 10px;">Nenhum anexo</span>
                </div>
              `}
            </div>

            <div class="timeline-title" style="margin-top: 1.5rem;">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
              Linha de Status do Pedido
            </div>

            <div class="order-timeline">
              <div class="timeline-line"></div>
              <div class="timeline-progress-bar" style="width: ${progressPercent}%; height: ${window.innerWidth <= 650 ? progressPercent + '%' : '2px'};"></div>
              
              <div class="timeline-node ${node1Class}">
                <div class="node-dot">1</div>
                <div class="node-info">
                  <h4 class="node-title">Registrado</h4>
                  <p class="node-desc">Pedido lançado no sistema.</p>
                </div>
              </div>

              <div class="timeline-node ${node2Class}">
                <div class="node-dot">2</div>
                <div class="node-info">
                  <h4 class="node-title">Aprovado</h4>
                  <p class="node-desc">Aprovado pela coordenação.</p>
                </div>
              </div>

              <div class="timeline-node ${node3Class}">
                <div class="node-dot">3</div>
                <div class="node-info">
                  <h4 class="node-title">Comprado</h4>
                  <p class="node-desc">Material adquirido.</p>
                </div>
              </div>

              <div class="timeline-node ${node4Class}">
                <div class="node-dot">4</div>
                <div class="node-info">
                  <h4 class="node-title">${st === 'done_obra' ? 'Entregue na Obra' : (st === 'done' ? 'Disponível no Almoxarifado' : 'Entregue')}</h4>
                  <p class="node-desc">${st === 'done_obra' ? 'Material na obra destino.' : 'Disponível no Almoxarifado.'}</p>
                </div>
              </div>
            </div>

            <!-- TIMELINE SECUNDÁRIA DE LOGS DE ATIVIDADE -->
            <div class="timeline-log-box">
              <div class="timeline-title" style="margin-bottom: 0.8rem;">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                Histórico de Atividades
              </div>
              <div class="log-timeline-container">
                ${(order.logs || []).map(log => {
                  let logClass = 'pending';
                  if (log.action === 'approved') logClass = 'approved';
                  else if (log.action === 'synced') logClass = 'synced';
                  else if (log.action === 'done' || log.action === 'done_obra') logClass = 'success';
                  
                  return `
                    <div class="log-timeline-item ${logClass}">
                      <div class="log-header-row">
                        <span class="log-title-text">${log.message}</span>
                        <span class="log-time-text">${log.date}</span>
                      </div>
                    </div>
                  `;
                }).join('')}
              </div>
            </div>

            <!-- CHAT / COMENTÁRIOS -->
            <div class="order-chat-container" onclick="event.stopPropagation()">
              <div class="chat-messages" id="chat-messages-${safeUid}">
                ${this.renderChatMessages(order.comments)}
              </div>
              <div class="chat-input-row">
                <input type="text" id="chat-input-${safeUid}" class="chat-input" placeholder="Adicionar comentário..." autocomplete="off" onkeypress="if(event.key === 'Enter') DrevoApp.sendChatMessage('${safeUid}')">
                <button class="btn-send-chat" onclick="DrevoApp.sendChatMessage('${safeUid}')" title="Enviar Mensagem">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"></line><polygon points="22 2 15 22 11 13 2 9 22 2"></polygon></svg>
                </button>
              </div>
            </div>

            <div class="order-actions-row">
              ${this.renderActionButtons(order)}
            </div>

          </div>
        </div>
      `;

      this.ordersContainer.appendChild(card);

      // Preservar card aberto se estivesse expandido antes da sincronização
      if (this.expandedCardId && (safeUid === this.expandedCardId || order.id === this.expandedCardId)) {
        card.classList.add('expanded');
        const detailsPane = card.querySelector('.order-details-pane');
        if (detailsPane) {
          detailsPane.style.maxHeight = '2000px';
        }
      }
    });
  },

  // Renderizar os botões de ação dinâmicos do Card baseado no status atual
  renderActionButtons(order) {
    const st = this.normalizeStatus(order.status);
    const safeUid = order._uid || order.id;
    let buttons = '';

    if (st === 'pending') {
      buttons += `
        <button class="btn-card-action btn-card-approve" onclick="event.stopPropagation(); DrevoApp.approveOrder('${safeUid}')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          Aprovar Pedido
        </button>
      `;
    } else if (st === 'approved') {
      buttons += `
        <button class="btn-card-action btn-card-sync" onclick="event.stopPropagation(); DrevoApp.syncWithERP('${safeUid}')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
          Registrar Compra (ERP)
        </button>
      `;
    } else if (st === 'synced') {
      buttons += `
        <button class="btn-card-action btn-card-approve" onclick="event.stopPropagation(); DrevoApp.completeOrder('${safeUid}', 'almoxarifado')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          Disponível no Almoxarifado
        </button>
        <button class="btn-card-action btn-card-sync" style="background: rgba(25, 111, 151, 0.1); color: var(--sync-teal); border-color: rgba(25, 111, 151, 0.25);" onclick="event.stopPropagation(); DrevoApp.completeOrder('${safeUid}', 'obra')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          Entregue na Obra
        </button>
      `;
    }

    // Botão de Excluir sempre disponível no Modo Gestor
    buttons += `
      <button class="btn-card-action btn-card-delete" onclick="event.stopPropagation(); DrevoApp.deleteOrder('${safeUid}')">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        Excluir
      </button>
    `;

    return buttons;
  },

  // Renderizar mensagens de chat
  renderChatMessages(commentsJson) {
    let comments = [];
    try {
      comments = typeof commentsJson === 'string' ? JSON.parse(commentsJson) : (commentsJson || []);
    } catch(e) {
      return '';
    }
    
    if (!comments || comments.length === 0) {
      return '<span style="font-size: 0.8rem; color: var(--neutral-500); font-style: italic;">Nenhum comentário.</span>';
    }

    return comments.map(c => {
      const isSelf = c.author === 'Você' || c.author === 'Gestor' || c.author === 'Administrador'; // heurística local
      const cssClass = isSelf ? 'chat-message self' : 'chat-message';
      
      // Formatar data se for ISO
      let timeStr = c.timestamp;
      try {
        if (c.timestamp.includes('T')) {
          const d = new Date(c.timestamp);
          timeStr = `${String(d.getDate()).padStart(2, '0')}/${String(d.getMonth() + 1).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
        }
      } catch(e) {}

      return `
        <div class="${cssClass}">
          <span class="chat-message-author">${c.author}</span>
          <p class="chat-message-text">${c.text}</p>
          <span class="chat-message-time">${timeStr}</span>
        </div>
      `;
    }).join('');
  },

  // Retorna o Hexadecimal correspondente ao nome da cor para visualização
  resolveColorHex(colorName) {
    const colors = {
      'Preto': '#000000',
      'Branco': '#ffffff',
      'Vermelho': '#E50000',
      'Azul': '#0052cc',
      'Verde': '#2ecc71',
      'Amarelo': '#f1c40f',
      'Cinza': '#7f8c8d'
    };
    return colors[colorName] || '#4B5162';
  },

  // Expandir / Recolher Card de Pedido (preserva o card aberto durante a sincronização em segundo plano)
  toggleCard(orderId) {
    const card = document.getElementById(`card-${orderId}`);
    if (!card) return;
    const details = card.querySelector('.order-details-pane');
    
    if (card.classList.contains('expanded')) {
      card.classList.remove('expanded');
      details.style.maxHeight = '0';
      if (this.expandedCardId === orderId) this.expandedCardId = null;
    } else {
      // Recolher todos os outros para manter o painel limpo
      document.querySelectorAll('.order-card').forEach(c => {
        if (c.id !== `card-${orderId}`) {
          c.classList.remove('expanded');
          const d = c.querySelector('.order-details-pane');
          if (d) d.style.maxHeight = '0';
        }
      });

      card.classList.add('expanded');
      this.expandedCardId = orderId;
      details.style.maxHeight = (details.scrollHeight + 100) + 'px';
    }
  },

  // Aprovar Pedido localmente e na Planilha
  async approveOrder(uid, skipReRender = false) {
    const order = this.orders.find(o => (o._uid || o.id) === uid);
    if (order) {
      const orderId = order.id;
      // Registrar log de aprovação
      const now = new Date();
      const formattedDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      if (!order.logs) order.logs = [];
      order.logs.push({ action: 'approved', message: 'Pedido aprovado pelo Gestor.', date: formattedDate });

      order.status = 'approved';
      this.saveOrders();
      this.showToast(`Pedido ${orderId} aprovado com sucesso!`, 'success');
      
      // Enviar alteração para o Google Sheets
      if (typeof API_URL !== 'undefined' && API_URL) {
        try {
          await fetch(API_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
              action: "AtualizarStatusPedido",
              id: orderId,
              status: "approved"
            })
          });
        } catch (err) {
          console.error("Erro ao sincronizar aprovação na planilha:", err);
        }
      }
      
      // Disparar notificação FCM
      this.dispararPush('Pedido Aprovado! ✅', `O Gestor aprovou o pedido ${orderId} ("${order.item}").`);
      
      if (!skipReRender) {
        // Renderizar novamente
        this.renderKPIs();
        this.renderOrders();
        
        // Manter expandido
        setTimeout(() => this.toggleCard(orderId), 50);
      }
    }
  },

  // Marcar como entregue localmente e na Planilha (gatilho de estoque no Almoxarifado!)
  async completeOrder(uid, destination) {
    const order = this.orders.find(o => (o._uid || o.id) === uid);
    if (order) {
      const orderId = order.id;
      const isObra = destination === 'obra';
      const statusKey = isObra ? 'done_obra' : 'done';
      const logMsg = isObra ? 'Material entregue na obra destino.' : 'Material recebido no Almoxarifado.';
      const toastMsg = isObra ? `Pedido ${orderId} entregue na obra!` : `Pedido ${orderId} disponível no Almoxarifado!`;

      // Registrar log de entrega
      const now = new Date();
      const formattedDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      if (!order.logs) order.logs = [];
      order.logs.push({ action: statusKey, message: logMsg, date: formattedDate });

      order.status = statusKey;
      this.saveOrders();
      this.showToast(toastMsg, 'success');
      
      // 1. Atualizar status na planilha Google Sheets
      if (typeof API_URL !== 'undefined' && API_URL) {
        try {
          await fetch(API_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
              action: "AtualizarStatusPedido",
              id: orderId,
              status: statusKey
            })
          });
        } catch (err) {
          console.error("Erro ao sincronizar entrega na planilha:", err);
        }
      }

      // 2. Notificar TODOS diretamente via Firebase FCM (Google Apps Script)
      const statusMsg = isObra ? 'entregue na obra destino' : 'disponível no almoxarifado';
      this.dispararPush('Compra Disponível! 📦', `Pedido ${orderId} — "${order.item}" está ${statusMsg}.`);
      
      this.renderKPIs();
      this.renderOrders();
      
      setTimeout(() => this.toggleCard(orderId), 50);
    }
  },

  // Excluir Pedido com confirmação simples
  deleteOrder(uid) {
    const order = this.orders.find(o => (o._uid || o.id) === uid);
    if (order && confirm(`Tem certeza que deseja excluir permanentemente o pedido ${order.id}?`)) {
      this.orders = this.orders.filter(o => o !== order);
      this.saveOrders();
      this.showToast(`Pedido ${order.id} excluído com sucesso.`, 'success');
      
      this.renderKPIs();
      this.renderOrders();
    }
  },

  // Fazer upload de um PDF num pedido já existente
  async uploadPostPdf(uid, inputElem) {
    const order = this.orders.find(o => (o._uid || o.id) === uid);
    if (!order) return;

    if (!inputElem.files || inputElem.files.length === 0) return;
    const file = inputElem.files[0];

    if (file.size > 5 * 1024 * 1024) {
      this.showToast('O arquivo PDF não pode ser maior que 5MB.', 'error');
      inputElem.value = '';
      return;
    }

    const statusElem = document.getElementById(`post-pdf-status-${uid}`);
    if (statusElem) {
      statusElem.textContent = 'Enviando PDF...';
      statusElem.style.color = 'var(--sync-teal)';
    }

    try {
      const base64String = await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => {
          const dataUrl = reader.result;
          const base64 = dataUrl.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(file);
      });
      
      const pdfFile = {
        name: file.name,
        data: base64String,
        mimeType: file.type
      };

      if (typeof API_URL !== 'undefined' && API_URL) {
        const payload = {
          action: "UploadPDF",
          id: order.id,
          pdfFile: pdfFile
        };
        
        const response = await fetch(API_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        });
        
        this.showToast('PDF anexado com sucesso!', 'success');
        if (statusElem) {
          statusElem.textContent = 'PDF anexado e enviado!';
          statusElem.style.color = 'var(--status-approved-text)';
        }

        // Simular que deu certo para re-renderizar o PDF link logo em seguida
        // O próximo polling vai puxar a URL correta, mas podemos deixar pendente.
        order.pdfUrl = 'uploading...';
        this.saveOrders();
        
      } else {
        this.showToast('Erro: API Offline.', 'error');
      }

    } catch (err) {
      console.error("Erro ao subir PDF:", err);
      this.showToast("Erro ao processar o arquivo PDF.", "error");
      if (statusElem) {
        statusElem.textContent = 'Falha no envio.';
        statusElem.style.color = 'var(--sync-red)';
      }
    }
    inputElem.value = '';
  },

  // Simular Sequência Animada de Registro de Compra (Antigo Sincronismo ERP)
  syncWithERP(uid) {
    const order = this.orders.find(o => (o._uid || o.id) === uid);
    if (!order) return;
    const orderId = order.id;

    this.syncOrderTitle.textContent = `Registrando Compra ${order.id}...`;
    this.syncConsole.innerHTML = '';
    this.syncOverlay.classList.add('active');

    // Desabilitar o indicador no topo
    this.erpIndicatorText.innerHTML = `<span class="status-dot" style="background-color: var(--status-pending-text); box-shadow: 0 0 10px var(--status-pending-text);"></span> <span style="white-space: nowrap;">Processando...</span>`;

    // Linhas de log fictícias com tempos de carregamento progressivos
    const logs = [
      { text: '> Estabelecendo conexão com o departamento de compras Drevo...', delay: 400 },
      { text: '> Confirmando liberação financeira e cotação...', delay: 800 },
      { text: '> Conexão segura estabelecida. Autorização confirmada.', delay: 1100 },
      { text: `> Solicitando faturamento do item "${order.item}" (Qtd: ${order.qty})...`, delay: 1500 },
      { text: `> Vinculando custo ao centro: "${order.costCenter}"${order.obra ? ` / Obra: "${order.obra}"` : ''}...`, delay: 1800 },
      { text: `> Gerando Ordem de Compra nº OC-${Math.floor(100000 + Math.random() * 900000)}...`, delay: 2100 },
      { text: '> Faturamento concluído. Aguardando emissão da Nota Fiscal...', delay: 2600 },
      { text: '> Chave da NF-e vinculada com sucesso.', delay: 2900 },
      { text: '✓ Aquisição registrada e confirmada como COMPRADO!', delay: 3300, success: true }
    ];

    logs.forEach(log => {
      setTimeout(() => {
        const line = document.createElement('div');
        line.className = `console-line${log.success ? ' success' : ''}`;
        line.textContent = log.text;
        this.syncConsole.appendChild(line);
        this.syncConsole.scrollTop = this.syncConsole.scrollHeight;
      }, log.delay);
    });

    // Finalizar simulação de sincronismo enviando dados reais à planilha
    setTimeout(async () => {
      // Registrar log de faturamento ERP
      const now = new Date();
      const formattedDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
      if (!order.logs) order.logs = [];
      order.logs.push({ action: 'synced', message: 'Compra faturada via ERP corporativo.', date: formattedDate });

      // Atualizar status no banco local
      order.status = 'synced'; // mantém chave synced interna para compatibilidade de estilos
      this.saveOrders();

      // Enviar alteração real de status para o Google Sheets
      if (typeof API_URL !== 'undefined' && API_URL) {
        try {
          await fetch(API_URL, {
            method: 'POST',
            mode: 'no-cors',
            headers: { 'Content-Type': 'text/plain;charset=utf-8' },
            body: JSON.stringify({
              action: "AtualizarStatusPedido",
              id: orderId,
              status: "comprado" // Grava "comprado" na planilha!
            })
          });
        } catch (err) {
          console.error("Erro ao sincronizar status de compra na planilha:", err);
        }
      }

      this.syncOverlay.classList.remove('active');
      
      this.erpIndicatorText.classList.remove('error');
      this.erpIndicatorText.innerHTML = `<span class="status-dot"></span> <span style="white-space: nowrap;">ERP Conectado</span>`;

      // Dispara o Web Push automaticamente para a equipe via Google Apps Script
      this.dispararPush(`Compra Aprovada! 📦`, `O pedido ${orderId} acaba de ser comprado pelo Gestor.`);

      // Toast de confirmação
      this.showToast(`Pedido ${orderId} marcado como Comprado!`, 'success');

      // Re-render
      this.renderKPIs();
      this.renderOrders();

      // Abrir o card novamente
      setTimeout(() => this.toggleCard(orderId), 100);

    }, 3900);
  },

  // Toast de Notificação Premium
  showToast(message, type = 'success') {
    this.toastText.textContent = message;
    
    // Configurar ícone e classes
    this.toast.className = 'toast-msg active';
    if (type === 'success') {
      this.toast.classList.add('success');
      this.toastIcon.innerHTML = `<svg class="toast-icon-success" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><polyline points="20 6 9 17 4 12"/></svg>`;
    } else {
      this.toast.classList.add('error');
      this.toastIcon.innerHTML = `<svg class="toast-icon-error" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>`;
    }

    // Timer para fechar
    if (this.toastTimer) clearTimeout(this.toastTimer);
    this.toastTimer = setTimeout(() => {
      this.toast.classList.remove('active');
    }, 3500);
  },

  // Exportar Pedidos para Planilha CSV
  exportToCSV() {
    if (this.orders.length === 0) {
      this.showToast('Nenhum pedido para exportar.', 'error');
      return;
    }
    
    // Cabeçalho do CSV com BOM UTF-8 (\uFEFF) para garantir caracteres e acentuação no Excel
    let csvContent = "data:text/csv;charset=utf-8,\uFEFF";
    csvContent += "ID;Data;Solicitante;Item;Unidade;Quantidade;Prioridade;Cor;Marca;Centro de Resultado;Obra;Status\r\n";
    
    this.orders.forEach(order => {
      let statusText = 'Pendente de Aprovação';
      const norm = this.normalizeStatus(order.status);
      if (norm === 'approved') statusText = 'Aprovado pelo Gestor';
      else if (norm === 'synced') statusText = 'Comprado';
      else if (norm === 'done') statusText = 'Disponível no Almoxarifado';
      else if (norm === 'done_obra') statusText = 'Entregue na Obra';
      else if (norm === 'rejected') statusText = 'Pedido Recusado';
      
      // Prioridade formatada para exibição
      const priorityText = {
        'normal': 'Normal',
        'urgente': 'Urgente',
        'critico': 'Crítico'
      }[order.priority || 'normal'] || 'Normal';
      
      // Sanitização de ponto e vírgula caso o usuário tenha digitado nos campos
      const requesterEscaped = (order.requester || 'Não informado').replace(/;/g, ',');
      const itemEscaped = order.item.replace(/;/g, ',');
      const brandEscaped = order.brand.replace(/;/g, ',');
      const colorEscaped = order.color.replace(/;/g, ',');
      const obraEscaped = (order.obra || '').replace(/;/g, ',');
      
      csvContent += `${order.id};${order.date};${requesterEscaped};${itemEscaped};${order.unit};${order.qty};${priorityText};${colorEscaped};${brandEscaped};${order.costCenter};${obraEscaped};${statusText}\r\n`;
    });
    
    // Download invisível temporário no DOM
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", "drevo_compras_pedidos_" + new Date().toISOString().slice(0, 10) + ".csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    
    this.showToast('Planilha CSV exportada com sucesso!', 'success');
  },

  // Configurar atualização automática em segundo plano (Auto-polling)
  setupAutoRefresh() {
    // Atualiza os dados da planilha a cada 15 segundos (tempo seguro para o Google Sheets)
    setInterval(async () => {
      // Apenas faz o fetch se estiver na tela de rastreamento ou na Home para atualizar KPIs
      const activeScreen = document.querySelector('.app-screen.active');
      if (activeScreen && (activeScreen.id === 'screen-tracking' || activeScreen.id === 'screen-home')) {
        
        // Se houver algum card expandido, guardamos o ID
        const expandedCard = document.querySelector('.order-card.expanded');
        const expandedId = expandedCard ? expandedCard.id.replace('card-', '') : null;

        const previousOrders = JSON.parse(JSON.stringify(this.orders));
        await this.loadOrders();
        // Checagem robusta: só re-renderiza se mudar a quantidade de pedidos ou o status de algum deles
        const getHash = (arr) => arr.map(o => o.id + ':' + this.normalizeStatus(o.status)).join('|');
        const oldHash = getHash(previousOrders);
        const newHash = getHash(this.orders);
        
        // Atualiza a interface se houver mudança real
        if (oldHash !== newHash) {
          this.renderKPIs();
          this.renderOrders();
          
          // Reabrir instantaneamente o card que estava aberto sem piscar
          if (expandedId) {
            const cardToExpand = document.getElementById(`card-${expandedId}`);
            if (cardToExpand) {
              cardToExpand.classList.add('expanded');
              const details = cardToExpand.querySelector('.order-details-pane');
              if (details) {
                // Desliga a animação, expande tudo, e liga a animação de novo (Zero flicker)
                details.style.transition = 'none';
                details.style.maxHeight = details.scrollHeight + 'px';
                requestAnimationFrame(() => {
                  requestAnimationFrame(() => {
                    details.style.transition = '';
                  });
                });
              }
            }
          }
        }
      }
    }, 15000); // 15 segundos
  },

  // Exibir Modal de Senha para Fazer Pedido
  promptPasswordForOrderCreation() {
    if (this.passwordOverlay) {
      this.inputPassword.value = '';
      this.passwordOverlay.classList.add('active');
      setTimeout(() => this.inputPassword.focus(), 50);
    }
  },

  // Processar validação de senha corporativa
  handlePasswordSubmit() {
    const entered = this.inputPassword.value;
    if (entered === 'drevo123') {
      this.passwordOverlay.classList.remove('active');
      this.navigateTo('screen-form');
    } else {
      this.showToast('Senha incorreta! Acesso negado.', 'error');
      this.inputPassword.value = '';
      this.inputPassword.focus();
    }
  },

  // ============================================================
  // FIREBASE E GOOGLE APPS SCRIPT INTEGRATION (AGORA COM ONESIGNAL)
  // ============================================================

  // Solicitar permissão e salvar Token no Google Sheets
  requestPushPermission(requesterName) {
    if (!window.OneSignalDeferred) {
      console.warn("OneSignal não carregou a tempo!");
      return;
    }
    
    window.OneSignalDeferred.push(async function(OneSignal) {
      try {
        // Força a exibição do prompt Nativo do Navegador (o mais garantido)
        await OneSignal.User.PushSubscription.optIn();
        
        const subscription = OneSignal.User.PushSubscription.current;
        if (subscription && subscription.optedIn) {
          const token = subscription.id;
          console.log('OneSignal Token Obtido manualmente: ', token);
          
          // Só salva se houver requesterName válido para evitar salvar lixo
          if (requesterName && requesterName.trim() !== '') {
            if (typeof API_URL !== 'undefined' && API_URL) {
              try {
                await fetch(API_URL, {
                  method: 'POST',
                  mode: 'no-cors',
                  headers: { 'Content-Type': 'text/plain;charset=utf-8' },
                  body: JSON.stringify({
                    action: "CadastrarTokenFCM", // Mantém o nome para compatibilidade
                    token: token,
                    requester: requesterName
                  })
                });
                console.log("Token OneSignal enviado para o Google Apps Script.");
              } catch (err) {
                console.error("Erro ao sincronizar token OneSignal no Sheets:", err);
              }
            }
          }
        }
      } catch (err) {
        console.error("Erro no OneSignal: ", err);
      }
    });
  },

  // Enviar Token para a aba "assinaturas" no Google Sheets via Apps Script
  async salvarTokenNoAppsScript(token, requester) {
    if (typeof API_URL !== 'undefined' && API_URL) {
      try {
        await fetch(API_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: "CadastrarTokenFCM",
            token: token,
            requester: requester
          })
        });
        console.log("Token FCM enviado para o Google Apps Script.");
      } catch (err) {
        console.error("Erro ao sincronizar token FCM no Sheets:", err);
      }
    }
  },

  // Disparar uma notificação Push via Google Apps Script
  async dispararPush(title, body) {
    if (typeof API_URL !== 'undefined' && API_URL) {
      try {
        await fetch(API_URL, {
          method: 'POST',
          mode: 'no-cors',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify({
            action: "DispararPush",
            title: title,
            body: body
          })
        });
        console.log("Comando de disparo enviado para o Apps Script.");
      } catch (err) {
        console.error("Erro ao enviar disparo Push:", err);
      }
    }
  }
};

// Iniciar a aplicação após o carregamento completo do documento DOM
document.addEventListener('DOMContentLoaded', () => {
  DrevoApp.init();
});
