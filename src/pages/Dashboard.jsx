import React, { useEffect, useState } from 'react';
import { useSnapshot } from 'valtio';
import { store } from '../store';
import { CheckCircle2, Clock, Truck, ShieldAlert, Package, RefreshCw } from 'lucide-react';
import toast from 'react-hot-toast';

export default function Dashboard() {
  const snap = useSnapshot(store);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    if (store.orders.length === 0) { store.loadOrders(); }
  }, []);

  const handleRefresh = () => {
    toast.promise(store.loadOrders(), {
      loading: 'Atualizando...',
      success: 'Atualizado!',
      error: 'Erro ao atualizar'
    });
  };

  const handleApprove = (id) => {
    toast.promise(store.updateStatus(id, 'approved'), {
      loading: 'Aprovando...',
      success: 'Aprovado com sucesso!',
      error: 'Erro ao aprovar'
    });
  };

  const handleReceive = (id, destination) => {
    const status = destination === 'obra' ? 'done_obra' : 'done';
    toast.promise(store.updateStatus(id, status), {
      loading: 'Confirmando recebimento...',
      success: 'Recebido com sucesso!',
      error: 'Erro ao confirmar'
    });
  };

  // KPIs
  const total = snap.orders.length;
  const pendingCount = snap.orders.filter(o => o.status === 'pending').length;
  const approvedCount = snap.orders.filter(o => o.status === 'approved').length;
  const doneCount = snap.orders.filter(o => o.status === 'done' || o.status === 'done_obra').length;

  const filteredOrders = snap.orders.filter(o => {
    if (filter === 'all') return true;
    if (filter === 'done') return o.status === 'done' || o.status === 'done_obra';
    return o.status === filter;
  });

  const getStatusBadge = (status) => {
    switch(status) {
      case 'pending': return <span className="px-2 py-1 bg-white text-fiori-gray rounded-lg text-xs font-bold border border-fiori-border flex items-center gap-1 shadow-sm"><Clock size={12}/> Pendente</span>;
      case 'approved': return <span className="px-2 py-1 bg-fiori-gray-light text-fiori-blue rounded-lg text-xs font-bold border border-fiori-blue flex items-center gap-1 shadow-sm"><ShieldAlert size={12}/> Aprovado</span>;
      case 'done': return <span className="px-2 py-1 bg-fiori-blue text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm"><CheckCircle2 size={12}/> No Almoxarifado</span>;
      case 'done_obra': return <span className="px-2 py-1 bg-fiori-blue text-white rounded-lg text-xs font-bold flex items-center gap-1 shadow-sm"><Truck size={12}/> Na Obra</span>;
      default: return null;
    }
  };

  return (
    <div className="space-y-6">
      
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h2 className="text-2xl font-bold text-fiori-blue">Dashboard</h2>
          <p className="text-fiori-gray-mid text-sm mt-1">Acompanhe as requisições de compras em tempo real.</p>
        </div>
        <button 
          onClick={handleRefresh}
          className="flex items-center justify-center gap-2 px-4 py-2 bg-white border border-fiori-border rounded-xl text-fiori-gray shadow-sm hover:bg-fiori-gray-light transition-colors"
          disabled={snap.loading}
        >
          <RefreshCw size={16} className={snap.loading ? 'animate-spin' : ''} />
          {snap.loading ? 'Atualizando...' : 'Atualizar Dados'}
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white p-5 rounded-2xl border border-fiori-border shadow-fiori flex flex-col gap-1">
          <div className="text-fiori-gray-mid text-sm font-semibold uppercase tracking-wider">Total Pedidos</div>
          <div className="text-3xl font-bold text-fiori-blue">{total}</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-fiori-border shadow-fiori flex flex-col gap-1">
          <div className="text-fiori-gray-mid text-sm font-semibold uppercase tracking-wider">Pendentes</div>
          <div className="text-3xl font-bold text-fiori-gray">{pendingCount}</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-fiori-border shadow-fiori flex flex-col gap-1">
          <div className="text-fiori-gray-mid text-sm font-semibold uppercase tracking-wider">Aprovados</div>
          <div className="text-3xl font-bold text-fiori-gray">{approvedCount}</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-fiori-border shadow-fiori flex flex-col gap-1">
          <div className="text-fiori-gray-mid text-sm font-semibold uppercase tracking-wider">Concluídos</div>
          <div className="text-3xl font-bold text-fiori-gray">{doneCount}</div>
        </div>
      </div>

      {/* Filter Tabs */}
      <div className="mt-8 flex overflow-x-auto gap-2 pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 hide-scrollbar border-b border-fiori-border">
        {['all', 'pending', 'approved', 'done'].map((f) => {
          const isActive = filter === f;
          const label = f === 'all' ? 'Todos os Pedidos' : f === 'pending' ? 'Pendentes' : f === 'approved' ? 'Aprovados' : 'Concluídos';
          return (
            <button
              key={f}
              onClick={() => setFilter(f)}
              className={`whitespace-nowrap px-4 py-3 text-sm font-bold transition-all border-b-2 ${
                isActive ? 'border-fiori-blue text-fiori-blue' : 'border-transparent text-fiori-gray-mid hover:text-fiori-gray hover:border-fiori-border'
              }`}
            >
              {label}
            </button>
          )
        })}
      </div>

      {/* Orders List */}
      <div className="space-y-4">
        {snap.loading && filteredOrders.length === 0 ? (
          <div className="text-center py-12 text-fiori-gray-mid animate-pulse font-medium">Buscando dados no servidor...</div>
        ) : filteredOrders.length === 0 ? (
          <div className="text-center py-12 bg-white rounded-2xl border border-fiori-border border-dashed text-fiori-gray-mid">
            <Package size={32} className="mx-auto mb-3 opacity-30" />
            Nenhum pedido encontrado com este filtro.
          </div>
        ) : (
          filteredOrders.map(order => (
            <div key={order.id} className="bg-white p-5 rounded-2xl border border-fiori-border shadow-fiori flex flex-col gap-4 hover:shadow-fiori-md transition-shadow">
              
              <div className="flex justify-between items-start">
                <div className="flex gap-4">
                  <div className="hidden sm:flex h-12 w-12 rounded-full bg-fiori-gray-light items-center justify-center text-fiori-gray-mid flex-shrink-0">
                    <Package size={24} />
                  </div>
                  <div>
                    <h3 className="text-fiori-blue font-bold text-lg leading-tight">{order.item}</h3>
                    <p className="text-fiori-gray-mid text-xs font-mono mt-1">REF: #{order.id}</p>
                  </div>
                </div>
                <div>{getStatusBadge(order.status)}</div>
              </div>
              
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm mt-2 p-4 bg-fiori-gray-light/50 rounded-xl">
                <div><span className="block text-xs font-semibold text-fiori-gray-mid uppercase mb-1">Quantidade</span> <span className="font-bold text-fiori-gray">{order.qty} {order.unit}</span></div>
                <div><span className="block text-xs font-semibold text-fiori-gray-mid uppercase mb-1">Data</span> <span className="font-medium text-fiori-gray">{order.date}</span></div>
                <div><span className="block text-xs font-semibold text-fiori-gray-mid uppercase mb-1">Solicitante</span> <span className="font-medium text-fiori-gray">{order.requester}</span></div>
                <div><span className="block text-xs font-semibold text-fiori-gray-mid uppercase mb-1">Destino</span> <span className="font-medium text-fiori-gray capitalize">{order.destination}</span></div>
                
                {order.obs && (
                  <div className="col-span-2 md:col-span-4 mt-2 pt-2 border-t border-fiori-border/50">
                    <span className="block text-xs font-semibold text-fiori-gray-mid uppercase mb-1">Observações</span> 
                    <span className="text-fiori-gray">{order.obs}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons based on status */}
              {(order.status === 'pending' || order.status === 'approved') && (
                <div className="flex justify-end gap-3 pt-2">
                  {order.status === 'pending' && (
                    <button 
                      onClick={() => handleApprove(order.id)}
                      className="w-full sm:w-auto px-6 py-2.5 bg-fiori-blue hover:bg-fiori-blue-dark text-white rounded-xl font-bold text-sm transition-colors shadow-sm"
                    >
                      Aprovar (Gestor)
                    </button>
                  )}
                  {order.status === 'approved' && (
                    <button 
                      onClick={() => handleReceive(order.id, order.destination)}
                      className="w-full sm:w-auto px-6 py-2.5 bg-white border-2 border-fiori-blue hover:bg-fiori-gray-light text-fiori-blue rounded-xl font-bold text-sm transition-colors shadow-sm flex items-center justify-center gap-2"
                    >
                      <CheckCircle2 size={18} />
                      Confirmar Entrega
                    </button>
                  )}
                </div>
              )}
            </div>
          ))
        )}
      </div>

    </div>
  );
}
