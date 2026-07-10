import { proxy } from 'valtio';
import { fetchOrders, createOrder, updateOrderStatus } from './api';

export const store = proxy({
  orders: [],
  loading: false,
  error: null,
  
  async loadOrders() {
    this.loading = true;
    try {
      const data = await fetchOrders();
      this.orders = data.pedidos || [];
      // save to local storage for offline support
      localStorage.setItem('drevo_compras_pedidos', JSON.stringify(this.orders));
    } catch (err) {
      console.error(err);
      this.error = 'Erro ao carregar pedidos.';
      // load from local storage
      const cached = localStorage.getItem('drevo_compras_pedidos');
      if (cached) {
        this.orders = JSON.parse(cached);
      }
    } finally {
      this.loading = false;
    }
  },

  async addOrder(orderData) {
    // Generate an ID if needed, apps script usually accepts our id
    const newId = Date.now().toString();
    const newOrder = {
      id: newId,
      ...orderData,
      status: 'pending',
      logs: []
    };
    
    // Optimistic update
    this.orders.unshift(newOrder);
    localStorage.setItem('drevo_compras_pedidos', JSON.stringify(this.orders));

    try {
      await createOrder(newOrder);
    } catch (err) {
      console.error("Falha ao salvar no Sheets", err);
    }
  },

  async updateStatus(orderId, status) {
    const order = this.orders.find(o => o.id === orderId);
    if (!order) return;
    
    order.status = status;
    if (!order.logs) order.logs = [];
    
    const now = new Date();
    const formattedDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    let msg = `Status alterado para ${status}`;
    if (status === 'approved') msg = 'Pedido aprovado pelo Gestor.';
    else if (status === 'done') msg = 'Material recebido no Almoxarifado.';
    else if (status === 'done_obra') msg = 'Material entregue na obra destino.';

    order.logs.push({ action: status, message: msg, date: formattedDate });
    
    localStorage.setItem('drevo_compras_pedidos', JSON.stringify(this.orders));

    try {
      await updateOrderStatus(orderId, status);
    } catch (err) {
      console.error("Falha ao atualizar no Sheets", err);
    }
  }
});
