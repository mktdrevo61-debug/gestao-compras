import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { store } from '../store';
import { ArrowLeft, Send } from 'lucide-react';
import toast from 'react-hot-toast';

export default function NewOrder() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [formData, setFormData] = useState({
    item: '',
    qty: '',
    unit: 'un',
    destination: 'almoxarifado',
    requester: localStorage.getItem('drevo_user_name') || '',
    obs: ''
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!formData.item || !formData.qty || !formData.requester) {
      toast.error('Preencha os campos obrigatórios!');
      return;
    }

    setLoading(true);
    
    // Save requester name for future and push token
    localStorage.setItem('drevo_user_name', formData.requester);
    
    const now = new Date();
    const formattedDate = `${String(now.getDate()).padStart(2, '0')}/${String(now.getMonth() + 1).padStart(2, '0')}/${now.getFullYear()} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    
    const payload = {
      ...formData,
      date: formattedDate
    };

    try {
      await store.addOrder(payload);
      toast.success('Pedido criado com sucesso!');
      navigate('/');
    } catch (err) {
      toast.error('Erro ao criar pedido.');
      setLoading(false);
    }
  };

  return (
    <div className="max-w-xl mx-auto space-y-6">
      <div className="flex items-center gap-4">
        <button onClick={() => navigate(-1)} className="p-2 bg-white rounded-full hover:bg-fiori-gray-light border border-transparent hover:border-fiori-border text-fiori-gray transition-colors shadow-sm">
          <ArrowLeft size={20} />
        </button>
        <div>
          <h2 className="text-2xl font-bold text-fiori-blue">Novo Pedido</h2>
          <p className="text-fiori-gray-mid text-sm mt-0.5">Preencha os dados do material desejado.</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white p-6 sm:p-8 rounded-2xl border border-fiori-border shadow-fiori space-y-5">
        
        <div className="space-y-1">
          <label className="text-sm font-bold text-fiori-gray">Item / Material <span className="text-fiori-red">*</span></label>
          <input 
            type="text" 
            value={formData.item}
            onChange={e => setFormData({...formData, item: e.target.value})}
            className="w-full bg-white border-2 border-fiori-border rounded-xl p-3 text-fiori-gray focus:outline-none focus:border-fiori-blue transition-colors font-medium"
            placeholder="Ex: Parafusos 10mm"
            required
          />
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1">
            <label className="text-sm font-bold text-fiori-gray">Quantidade <span className="text-fiori-red">*</span></label>
            <input 
              type="number" 
              value={formData.qty}
              onChange={e => setFormData({...formData, qty: e.target.value})}
              className="w-full bg-white border-2 border-fiori-border rounded-xl p-3 text-fiori-gray focus:outline-none focus:border-fiori-blue transition-colors font-medium"
              placeholder="Ex: 50"
              required
            />
          </div>
          <div className="space-y-1">
            <label className="text-sm font-bold text-fiori-gray">Unidade</label>
            <select 
              value={formData.unit}
              onChange={e => setFormData({...formData, unit: e.target.value})}
              className="w-full bg-white border-2 border-fiori-border rounded-xl p-3 text-fiori-gray focus:outline-none focus:border-fiori-blue transition-colors font-medium"
            >
              <option value="un">Unidade(s)</option>
              <option value="kg">Quilo(s)</option>
              <option value="cx">Caixa(s)</option>
              <option value="m">Metro(s)</option>
              <option value="lt">Litro(s)</option>
            </select>
          </div>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-bold text-fiori-gray">Destino</label>
          <select 
            value={formData.destination}
            onChange={e => setFormData({...formData, destination: e.target.value})}
            className="w-full bg-white border-2 border-fiori-border rounded-xl p-3 text-fiori-gray focus:outline-none focus:border-fiori-blue transition-colors font-medium"
          >
            <option value="almoxarifado">Almoxarifado (Fábrica)</option>
            <option value="obra">Obra (Direto)</option>
          </select>
        </div>

        <div className="space-y-1">
          <label className="text-sm font-bold text-fiori-gray">Seu Nome (Solicitante) <span className="text-fiori-red">*</span></label>
          <input 
            type="text" 
            value={formData.requester}
            onChange={e => setFormData({...formData, requester: e.target.value})}
            className="w-full bg-white border-2 border-fiori-border rounded-xl p-3 text-fiori-gray focus:outline-none focus:border-fiori-blue transition-colors font-medium"
            placeholder="Ex: João Silva"
            required
          />
        </div>

        <div className="space-y-1">
          <label className="text-sm font-bold text-fiori-gray">Observações</label>
          <textarea 
            value={formData.obs}
            onChange={e => setFormData({...formData, obs: e.target.value})}
            className="w-full bg-white border-2 border-fiori-border rounded-xl p-3 text-fiori-gray focus:outline-none focus:border-fiori-blue transition-colors font-medium min-h-[100px]"
            placeholder="Detalhes adicionais, urgência, etc..."
          />
        </div>

        <button 
          type="submit" 
          disabled={loading}
          className="w-full bg-fiori-blue hover:bg-fiori-blue-dark text-white p-4 rounded-xl font-bold flex justify-center items-center gap-2 transition-colors disabled:opacity-50 mt-4 shadow-sm"
        >
          {loading ? 'Processando...' : (
            <>
              <Send size={20} />
              Enviar Solicitação de Compra
            </>
          )}
        </button>

      </form>
    </div>
  );
}
