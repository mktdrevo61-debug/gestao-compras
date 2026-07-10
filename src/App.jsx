import React from 'react';
import { Routes, Route, Link, useLocation } from 'react-router-dom';
import Dashboard from './pages/Dashboard';
import NewOrder from './pages/NewOrder';
import PushManager from './components/PushManager';
import { PackageSearch, PlusCircle, LayoutDashboard } from 'lucide-react';
import { Toaster } from 'react-hot-toast';

function App() {
  const location = useLocation();

  const NAV_ITEMS = [
    {
      id: 'dashboard',
      path: '/',
      label: 'Painel Geral',
      icon: <LayoutDashboard size={20} />
    },
    {
      id: 'novo',
      path: '/novo',
      label: 'Novo Pedido',
      icon: <PlusCircle size={20} />
    }
  ];

  return (
    <div className="min-h-screen flex bg-fiori-gray-light text-fiori-gray font-sans">
      <Toaster position="top-right" />
      <PushManager />
      
      {/* Sidebar Navigation */}
      <nav className="w-64 bg-fiori-blue text-white flex-shrink-0 hidden md:flex flex-col">
        <div className="p-6 border-b border-fiori-gray/30 flex items-center gap-3">
          <PackageSearch size={28} className="text-white" />
          <div>
            <h1 className="text-xl font-bold tracking-tight">Drevo Móveis</h1>
            <p className="text-xs uppercase tracking-wider text-fiori-gray-mid font-semibold">Gestão de Compras</p>
          </div>
        </div>
        
        <div className="flex flex-col gap-1 p-4 flex-1">
          {NAV_ITEMS.map(item => {
            const isActive = location.pathname === item.path;
            return (
              <Link 
                key={item.id}
                to={item.path}
                className={`flex items-center gap-3 px-4 py-3 rounded-lg font-medium transition-colors ${
                  isActive 
                    ? 'bg-fiori-blue-dark text-white' 
                    : 'text-fiori-gray-mid hover:bg-fiori-gray/50 hover:text-white'
                }`}
              >
                {item.icon}
                {item.label}
              </Link>
            )
          })}
        </div>
      </nav>

      {/* Main Content Area */}
      <main className="flex-1 flex flex-col h-screen overflow-hidden">
        
        {/* Mobile Header */}
        <header className="md:hidden bg-fiori-blue p-4 flex items-center justify-between text-white flex-shrink-0 shadow-md z-10">
          <div className="flex items-center gap-2">
            <PackageSearch size={24} />
            <span className="font-bold">Drevo Móveis</span>
          </div>
        </header>

        {/* Content Scrollable */}
        <div className="flex-1 overflow-auto p-4 sm:p-8 pb-24 md:pb-8">
          <div className="max-w-6xl mx-auto">
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/novo" element={<NewOrder />} />
            </Routes>
          </div>
        </div>
      </main>

      {/* Mobile Bottom Nav */}
      <nav className="md:hidden fixed bottom-0 left-0 right-0 bg-white border-t border-fiori-border px-6 py-2 pb-safe z-50 flex justify-around">
        {NAV_ITEMS.map(item => {
          const isActive = location.pathname === item.path;
          return (
            <Link 
              key={item.id}
              to={item.path}
              className={`flex flex-col items-center gap-1 p-2 ${
                isActive ? 'text-fiori-blue' : 'text-fiori-gray-mid'
              }`}
            >
              {item.icon}
              <span className="text-[10px] font-semibold">{item.label}</span>
            </Link>
          )
        })}
      </nav>

    </div>
  );
}

export default App;
