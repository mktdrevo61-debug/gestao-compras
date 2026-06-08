// URL de Integração Google Sheets (ERP Central)
const API_URL = "https://script.google.com/macros/s/AKfycbxmHnIt_usf__AaiXZ61Me_9jkU9usIHS4emGjr_3DirkzYi7XC731j0VelLQN8C2f8/exec";

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
    this.cacheDOM();
    this.bindEvents();
    this.toggleObraField(); // Configura estado inicial da Obra
    this.registerServiceWorker(); // Ativa PWA
    await this.loadOrders();
    this.renderKPIs();
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
    this.btnBackNav = document.getElementById('btn-back-nav');
    this.navLogo = document.getElementById('nav-logo');
    this.erpIndicatorText = document.getElementById('erp-indicator-text');
    
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

    // Estado ativo dos filtros
    this.activeFilter = 'all';
    this.searchQuery = '';
  },

  // Vinculação de Eventos
  bindEvents() {
    // Navegação
    this.cardFp.addEventListener('click', () => this.promptPasswordForOrderCreation());
    this.cardCp.addEventListener('click', () => this.navigateTo('screen-tracking'));
    this.btnBackNav.addEventListener('click', () => this.navigateTo('screen-home'));
    this.navLogo.addEventListener('click', () => this.navigateTo('screen-home'));

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

    // Controlar visibilidade do botão voltar
    if (screenId === 'screen-home') {
      this.btnBackNav.classList.remove('visible');
    } else {
      this.btnBackNav.classList.add('visible');
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
        this.erpIndicatorText.innerHTML = `<span class="status-dot" style="background-color: var(--status-pending-text); box-shadow: 0 0 10px var(--status-pending-text);"></span> Conectando...`;
        
        const res = await fetch(`${API_URL}?_=${Date.now()}`);
        const data = await res.json();
        
        if (data && data.orders) {
          // Filtrar os pedidos retornados da planilha (os mais recentes primeiro no display)
          this.orders = data.orders.reverse();
          this.saveOrders(); // Sincronizar cache local
          
          this.erpIndicatorText.innerHTML = `<span class="status-dot"></span> ERP Conectado`;
        }
      } catch (err) {
        console.warn("Erro ao buscar da Planilha Google, utilizando cache local:", err);
        this.erpIndicatorText.innerHTML = `<span class="status-dot" style="background-color: var(--status-pending-text); box-shadow: 0 0 10px var(--status-pending-text);"></span> Banco Local (Offline)`;
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
    const item = this.inputItem.value.trim();
    const unit = this.selectUnit.value;
    const qty = parseInt(this.inputQty.value) || 1;
    const priority = this.selectPriority ? this.selectPriority.value : 'normal'; // Novo
    const color = this.inputColor.value.trim() || 'Padrão';
    const brand = this.inputBrand.value.trim() || 'Sem preferência';
    const costCenter = this.selectCostCenter.value;
    const obra = costCenter === 'Produção' ? this.inputObra.value.trim() : '';

    // Validação Simples
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

    // Instanciar Pedido
    const newOrder = {
      id: newId,
      item,
      unit,
      qty,
      color,
      brand,
      costCenter,
      obra,
      priority, // Novo
      status: 'pending', // Inicia pendente de aprovação
      date: formattedDate,
      logs: [ // Novo
        { action: 'pending', message: 'Pedido lançado no sistema por Colaborador.', date: formattedDate }
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
          priority // Novo
        };
        
        await fetch(API_URL, {
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
      // Filtro por Tab
      let passFilter = false;
      const normStatus = this.normalizeStatus(order.status);
      if (this.activeFilter === 'all') {
        // Excluir pedidos concluídos (done ou done_obra) ou faturados (synced) da aba "Todos" para evitar poluição
        passFilter = (normStatus !== 'done' && normStatus !== 'done_obra' && normStatus !== 'synced');
      } else if (this.activeFilter === 'pending') {
        passFilter = (normStatus === 'pending' || normStatus === 'approved');
      } else if (this.activeFilter === 'synced') {
        passFilter = (normStatus === 'synced');
      } else if (this.activeFilter === 'done') {
        passFilter = (normStatus === 'done' || normStatus === 'done_obra');
      }

      // Filtro por Busca
      let passSearch = false;
      if (!this.searchQuery) {
        passSearch = true;
      } else {
        passSearch = order.item.toLowerCase().includes(this.searchQuery) ||
                     order.id.toLowerCase().includes(this.searchQuery) ||
                     order.brand.toLowerCase().includes(this.searchQuery) ||
                     order.costCenter.toLowerCase().includes(this.searchQuery);
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
      card.id = `card-${order.id}`;

      // Gerar logs padrões se o pedido antigo não possuir logs (retrocompatibilidade)
      if (!order.logs) {
        order.logs = [
          { action: 'pending', message: 'Pedido lançado no sistema por Colaborador.', date: order.date }
        ];
        const oldSt = this.normalizeStatus(order.status);
        if (oldSt === 'approved' || oldSt === 'synced' || oldSt === 'done' || oldSt === 'done_obra') {
          order.logs.push({ action: 'approved', message: 'Pedido aprovado pelo Gestor.', date: order.date });
        }
        if (oldSt === 'synced' || oldSt === 'done' || oldSt === 'done_obra') {
          order.logs.push({ action: 'synced', message: 'Compra faturada via ERP corporativo.', date: order.date });
        }
        if (oldSt === 'done' || oldSt === 'done_obra') {
          const logMsg = (oldSt === 'done_obra') ? 'Material entregue na obra destino.' : 'Material recebido no Almoxarifado.';
          order.logs.push({ action: oldSt, message: logMsg, date: order.date });
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

      card.innerHTML = `
        <div class="order-header-main" onclick="DrevoApp.toggleCard('${order.id}')">
          <div class="order-meta-info">
            <div class="order-id-row">
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

            <div class="timeline-title">
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

            <div class="order-actions-row">
              ${this.renderActionButtons(order)}
            </div>

          </div>
        </div>
      `;

      this.ordersContainer.appendChild(card);
    });
  },

  // Renderizar os botões de ação dinâmicos do Card baseado no status atual
  renderActionButtons(order) {
    const st = this.normalizeStatus(order.status);
    let buttons = '';

    if (st === 'pending') {
      buttons += `
        <button class="btn-card-action btn-card-approve" onclick="event.stopPropagation(); DrevoApp.approveOrder('${order.id}')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          Aprovar Pedido
        </button>
      `;
    } else if (st === 'approved') {
      buttons += `
        <button class="btn-card-action btn-card-sync" onclick="event.stopPropagation(); DrevoApp.syncWithERP('${order.id}')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21.5 2v6h-6M21.34 15.57a10 10 0 1 1-.57-8.38l5.67-5.67"/></svg>
          Registrar Compra (ERP)
        </button>
      `;
    } else if (st === 'synced') {
      buttons += `
        <button class="btn-card-action btn-card-approve" onclick="event.stopPropagation(); DrevoApp.completeOrder('${order.id}', 'almoxarifado')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          Disponível no Almoxarifado
        </button>
        <button class="btn-card-action btn-card-sync" style="background: rgba(25, 111, 151, 0.1); color: var(--sync-teal); border-color: rgba(25, 111, 151, 0.25);" onclick="event.stopPropagation(); DrevoApp.completeOrder('${order.id}', 'obra')">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
          Entregue na Obra
        </button>
      `;
    }

    // Botão de Excluir sempre disponível no Modo Gestor
    buttons += `
      <button class="btn-card-action btn-card-delete" onclick="event.stopPropagation(); DrevoApp.deleteOrder('${order.id}')">
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"/><path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/></svg>
        Excluir
      </button>
    `;

    return buttons;
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

  // Expandir / Recolher Card de Pedido
  toggleCard(orderId) {
    const card = document.getElementById(`card-${orderId}`);
    const details = card.querySelector('.order-details-pane');
    
    if (card.classList.contains('expanded')) {
      card.classList.remove('expanded');
      details.style.maxHeight = '0';
    } else {
      // Recolher todos os outros para manter o painel limpo
      document.querySelectorAll('.order-card').forEach(c => {
        if (c.id !== `card-${orderId}`) {
          c.classList.remove('expanded');
          c.querySelector('.order-details-pane').style.maxHeight = '0';
        }
      });

      card.classList.add('expanded');
      details.style.maxHeight = details.scrollHeight + 'px';
    }
  },

  // Aprovar Pedido localmente e na Planilha
  async approveOrder(orderId) {
    const order = this.orders.find(o => o.id === orderId);
    if (order) {
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
      
      // Renderizar novamente
      this.renderKPIs();
      this.renderOrders();
      
      // Manter expandido
      setTimeout(() => this.toggleCard(orderId), 50);
    }
  },

  // Marcar como entregue localmente e na Planilha (gatilho de estoque no Almoxarifado!)
  async completeOrder(orderId, destination) {
    const order = this.orders.find(o => o.id === orderId);
    if (order) {
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
      
      // Enviar alteração para o Google Sheets (acionará a inclusão automática no estoque)
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
      
      this.renderKPIs();
      this.renderOrders();
      
      setTimeout(() => this.toggleCard(orderId), 50);
    }
  },

  // Excluir Pedido com confirmação simples
  deleteOrder(orderId) {
    if (confirm(`Tem certeza que deseja excluir permanentemente o pedido ${orderId}?`)) {
      this.orders = this.orders.filter(o => o.id !== orderId);
      this.saveOrders();
      this.showToast(`Pedido ${orderId} excluído com sucesso.`, 'success');
      
      this.renderKPIs();
      this.renderOrders();
    }
  },

  // Simular Sequência Animada de Registro de Compra (Antigo Sincronismo ERP)
  syncWithERP(orderId) {
    const order = this.orders.find(o => o.id === orderId);
    if (!order) return;

    this.syncOrderTitle.textContent = `Registrando Compra ${order.id}...`;
    this.syncConsole.innerHTML = '';
    this.syncOverlay.classList.add('active');

    // Desabilitar o indicador no topo
    this.erpIndicatorText.innerHTML = `<span class="status-dot" style="background-color: var(--status-pending-text); box-shadow: 0 0 10px var(--status-pending-text);"></span> Processando...`;

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

      // Esconder overlay
      this.syncOverlay.classList.remove('active');

      // Restaurar indicador do topo
      this.erpIndicatorText.innerHTML = `<span class="status-dot"></span> ERP Conectado`;

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
    csvContent += "ID;Data;Item;Unidade;Quantidade;Prioridade;Cor;Marca;Centro de Resultado;Obra;Status\r\n";
    
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
      const itemEscaped = order.item.replace(/;/g, ',');
      const brandEscaped = order.brand.replace(/;/g, ',');
      const colorEscaped = order.color.replace(/;/g, ',');
      const obraEscaped = (order.obra || '').replace(/;/g, ',');
      
      csvContent += `${order.id};${order.date};${itemEscaped};${order.unit};${order.qty};${priorityText};${colorEscaped};${brandEscaped};${order.costCenter};${obraEscaped};${statusText}\r\n`;
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
    // Atualiza os dados da planilha a cada 3 segundos em segundo plano de forma silenciosa
    setInterval(async () => {
      // Apenas faz o fetch se estiver na tela de rastreamento ou na Home para atualizar KPIs
      const activeScreen = document.querySelector('.app-screen.active');
      if (activeScreen && (activeScreen.id === 'screen-tracking' || activeScreen.id === 'screen-home')) {
        
        // Serializa a lista atual de pedidos para detectar alterações de status ou novas inclusões
        const oldOrdersStr = JSON.stringify(this.orders);
        
        // Se houver algum card expandido, guardamos o ID para preservá-lo caso ocorra alteração
        const expandedCard = document.querySelector('.order-card.expanded');
        const expandedId = expandedCard ? expandedCard.id.replace('card-', '') : null;
        
        await this.loadOrders();
        
        const newOrdersStr = JSON.stringify(this.orders);
        
        // SÓ atualiza a interface (DOM) se houver mudança real de dados vinda do Google Sheets
        if (oldOrdersStr !== newOrdersStr) {
          this.renderKPIs();
          this.renderOrders();
          
          // Reabrir o card que estava aberto sem prejudicar a experiência do colaborador
          if (expandedId) {
            const cardToExpand = document.getElementById(`card-${expandedId}`);
            if (cardToExpand) {
              cardToExpand.classList.add('expanded');
              const details = cardToExpand.querySelector('.order-details-pane');
              if (details) {
                // Pequeno atraso para garantir o fluxo de renderização do navegador e aplicar a animação
                setTimeout(() => {
                  details.style.maxHeight = details.scrollHeight + 'px';
                }, 50);
              }
            }
          }
        }
      }
    }, 3000); // 3 segundos
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
  }
};

// Iniciar a aplicação após o carregamento completo do documento DOM
document.addEventListener('DOMContentLoaded', () => {
  DrevoApp.init();
});
