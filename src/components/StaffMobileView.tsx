import React, { useState, useEffect } from 'react';
import { 
  LayoutDashboard, 
  Truck, 
  Activity, 
  Wallet, 
  LogOut, 
  Bell, 
  Menu, 
  X, 
  ChevronRight, 
  Search,
  Phone,
  AlertCircle,
  TrendingUp,
  Clock,
  ShieldAlert,
  Users,
  Calculator,
  MessageSquare,
  Smartphone,
  Monitor
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot, where, limit } from 'firebase/firestore';

interface StaffMobileViewProps {
  user: any;
  onLogout: () => void;
  onExitMobile?: () => void;
}

export default function StaffMobileView({ user, onLogout, onExitMobile }: StaffMobileViewProps) {
  const [activeTab, setActiveTab] = useState<'dashboard' | 'fleet' | 'ops' | 'wallet'>('dashboard');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    activeVehicles: 0,
    missedCalls: 0,
    panicAlerts: 0,
    totalRevenue: 0
  });

  const [vehicles, setVehicles] = useState<any[]>([]);
  const [calls, setCalls] = useState<any[]>([]);

  useEffect(() => {
    // Listen for vehicles
    const unsubVehicles = onSnapshot(collection(db, 'drivers'), (snapshot) => {
      const docs = snapshot.docs.map(doc => doc.data());
      setVehicles(docs);
      const active = docs.filter((d: any) => 
        ['available', 'ativo', 'disponível', 'busy', 'ocupado'].includes(d.status?.toLowerCase())
      ).length;
      setStats(prev => ({ ...prev, activeVehicles: active }));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'drivers'));

    // Listen for calls
    const qCalls = query(collection(db, 'calls'), orderBy('timestamp', 'desc'), limit(20));
    const unsubCalls = onSnapshot(qCalls, (snapshot) => {
      const docs = snapshot.docs.map(doc => doc.data());
      setCalls(docs);
      const missed = docs.filter((c: any) => c.status === 'pending').length;
      setStats(prev => ({ ...prev, missedCalls: missed }));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'calls'));

    // Panic Alerts
    const qPanic = query(collection(db, 'panic_alerts'), where('status', '==', 'active'));
    const unsubPanic = onSnapshot(qPanic, (snapshot) => {
      setStats(prev => ({ ...prev, panicAlerts: snapshot.size }));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'panic_alerts'));

    // Listen for Revenue (for accountants/admin)
    const qRev = query(collection(db, 'revenue_logs'), orderBy('timestamp', 'desc'), limit(10));
    const unsubRev = onSnapshot(qRev, (snapshot) => {
      const docs = snapshot.docs.map(doc => doc.data());
      const total = docs.reduce((acc: number, curr: any) => acc + (curr.amount || 0), 0);
      setStats(prev => ({ ...prev, totalRevenue: total }));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'revenue_logs'));

    return () => {
      unsubVehicles();
      unsubCalls();
      unsubPanic();
      unsubRev();
    };
  }, []);

  const menuItems = [
    { icon: LayoutDashboard, label: 'Painel Central', onClick: () => setActiveTab('dashboard') },
    { icon: Activity, label: 'Monitores Live', onClick: () => setActiveTab('ops') },
    { icon: Truck, label: 'Gestão de Frota', onClick: () => setActiveTab('fleet') },
    { icon: Wallet, label: 'Financeiro', onClick: () => setActiveTab('wallet') },
    ...(onExitMobile ? [{ icon: Monitor, label: 'Restaurar Painel Full', onClick: onExitMobile, color: 'text-brand-primary' }] : []),
    { icon: MessageSquare, label: 'Comunicações', onClick: () => {} },
    { icon: LogOut, label: 'Terminar Sessão', onClick: onLogout, color: 'text-red-500' },
  ];

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'available': case 'ativo': case 'disponível': return 'bg-emerald-500';
      case 'busy': case 'ocupado': return 'bg-amber-500';
      case 'offline': case 'inativo': case 'indisponível': return 'bg-red-500';
      default: return 'bg-slate-400';
    }
  };

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Mobile Top Header */}
      <header className="bg-[#0f172a] px-6 py-5 flex items-center justify-between shadow-lg relative z-20">
        <div className="flex items-center gap-4">
          <div className="w-10 h-10 bg-brand-primary rounded-xl flex items-center justify-center text-white shadow-lg rotate-3">
             <span className="text-xl font-black italic">PS</span>
          </div>
          <div>
            <h1 className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none mb-1">Módulo Mobile</h1>
            <p className="text-xs font-black text-white uppercase tracking-tight italic">
              {user.role === 'admin' ? 'Administrador Geral' : user.role === 'contabilista' ? 'Hub Contabilidade' : 'Operador de Campo'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-3">
          {onExitMobile && (
            <button 
              onClick={onExitMobile}
              className="w-10 h-10 bg-brand-primary/10 rounded-lg flex items-center justify-center text-brand-primary border border-brand-primary/20"
              title="Restaurar Painel Completo"
            >
              <Monitor size={20} />
            </button>
          )}
          <div className="relative">
            <Bell size={20} className="text-slate-400" />
            {(stats.missedCalls > 0 || stats.panicAlerts > 0) && (
              <span className="absolute -top-1 -right-1 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-[#0f172a]" />
            )}
          </div>
          <button 
            onClick={() => setIsMenuOpen(true)}
            className="w-10 h-10 bg-white/5 rounded-lg flex items-center justify-center text-white"
          >
            <Menu size={24} />
          </button>
        </div>
      </header>

      {/* Content Area */}
      <main className="flex-1 overflow-y-auto p-5 custom-scrollbar pb-24">
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Critical Alert Banner if Panic */}
            {stats.panicAlerts > 0 && (
              <motion.div 
                animate={{ scale: [1, 1.02, 1] }}
                transition={{ duration: 1, repeat: Infinity }}
                className="bg-red-600 p-4 rounded-2xl text-white flex items-center gap-4 shadow-xl shadow-red-600/30"
              >
                <div className="w-12 h-12 bg-white/20 rounded-xl flex items-center justify-center">
                  <ShieldAlert size={28} />
                </div>
                <div>
                  <p className="text-[10px] font-black uppercase tracking-widest text-red-100">Alerta Crítico</p>
                  <p className="text-sm font-black uppercase italic tracking-tight">{stats.panicAlerts} Botão de Pânico Ativado!</p>
                </div>
              </motion.div>
            )}

            {/* Quick Summary Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm">
                <div className="w-10 h-10 bg-blue-50 text-brand-primary rounded-xl flex items-center justify-center mb-4">
                  <Truck size={20} />
                </div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-tight">Frota em<br/>Operação</p>
                <p className="text-2xl font-black text-slate-900 mt-1">{stats.activeVehicles}</p>
              </div>
              <div className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm relative overflow-hidden">
                <div className="w-10 h-10 bg-rose-50 text-rose-500 rounded-xl flex items-center justify-center mb-4">
                  <Phone size={20} />
                </div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-tight">Chamadas<br/>Perdidas</p>
                <p className="text-2xl font-black text-slate-900 mt-1">{stats.missedCalls}</p>
              </div>
            </div>

            {/* Live Status Card */}
            <div className="bg-slate-900 rounded-[2.5rem] p-7 text-white shadow-2xl relative overflow-hidden">
              <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12">
                <Smartphone size={100} />
              </div>
              <div className="relative z-10">
                <div className="flex items-center gap-2 mb-6">
                   <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                   <span className="text-[10px] font-black uppercase tracking-[0.2em] text-emerald-400 italic">Central de Comando Mobile</span>
                </div>
                <h3 className="text-3xl font-black uppercase italic tracking-tighter leading-none mb-4">
                  Controlo Geral<br/><span className="text-brand-primary">24H Ativo</span>
                </h3>
                <p className="text-[11px] text-slate-400 font-medium leading-relaxed mb-6">
                  Monitorização em tempo real de chamadas, frotas e fluxos financeiros diretamente no seu terminal.
                </p>
                <button 
                  onClick={() => setActiveTab('ops')}
                  className="w-full bg-white text-slate-900 py-4 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all"
                >
                  Monitorizar Canais Live
                  <ChevronRight size={14} />
                </button>
              </div>
            </div>

            {/* Recent Calls List */}
            <div>
              <div className="flex items-center justify-between mb-4 px-1">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Últimas Chamadas</h3>
                <button className="text-[9px] font-black text-brand-primary uppercase underline">Ver Histórico</button>
              </div>
              <div className="space-y-3">
                {calls.slice(0, 5).map((call: any, idx: number) => (
                  <div key={idx} className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400">
                        <Users size={18} />
                      </div>
                      <div>
                        <p className="text-[11px] font-black text-slate-900 uppercase tracking-tight">{call.customerName || 'Cliente Direto'}</p>
                        <p className="text-[9px] text-slate-400 font-black uppercase tracking-tighter">{call.customerPhone}</p>
                      </div>
                    </div>
                    <div className="text-right">
                       <span className={cn(
                         "px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-widest",
                         call.status === 'completed' ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600 animate-pulse"
                       )}>
                         {call.status}
                       </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'fleet' && (
          <div className="space-y-6">
             <div className="flex items-center justify-between px-1">
                <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic italic">Estado da Frota</h2>
                <div className="text-[10px] font-black text-brand-primary bg-blue-50 px-3 py-1 rounded-full border border-blue-100 uppercase tracking-widest italic">Live Tracking</div>
             </div>

             <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
                <input 
                  type="text" 
                  placeholder="PROCURAR VIATURA OU MOTORISTA..."
                  className="w-full pl-12 pr-4 py-4 bg-white border border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm outline-none focus:border-brand-primary"
                />
             </div>

             <div className="space-y-4">
                {vehicles.map((v, idx) => (
                  <div key={idx} className="bg-white p-5 rounded-[1.5rem] border border-slate-100 shadow-sm relative overflow-hidden">
                     <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-3">
                           <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center border-2 border-white shadow-sm font-black text-slate-900 italic">
                             {v.prefix}
                           </div>
                           <div>
                              <p className="text-[11px] font-black text-slate-900 uppercase tracking-tight leading-none mb-1">{v.name}</p>
                              <div className="flex items-center gap-2">
                                 <div className={cn("w-2 h-2 rounded-full", getStatusColor(v.status))} />
                                 <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{v.status || 'Inativo'}</p>
                                 <span className="text-[8px] text-slate-300">•</span>
                                 <span className="text-[9px] text-slate-400 font-bold uppercase">{v.fuelLevel || 0}% FUEL</span>
                              </div>
                           </div>
                        </div>
                        <div className="text-right">
                           <p className="text-[10px] font-black text-slate-900 tracking-tight">{v.plate}</p>
                           <p className="text-[9px] text-slate-400 font-bold uppercase">{v.phone}</p>
                        </div>
                     </div>
                     
                     <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-50">
                        <div className="flex items-center gap-2">
                           <Activity size={14} className="text-slate-400" />
                           <span className="text-[10px] font-black text-slate-600 uppercase tracking-tight">{v.speed || 0} KM/H</span>
                        </div>
                        <div className="flex items-center gap-2 justify-end">
                           <Clock size={14} className="text-slate-400" />
                           <span className="text-[10px] font-black text-slate-600 uppercase tracking-tight italic">Auditado 24h</span>
                        </div>
                     </div>
                  </div>
                ))}
             </div>
          </div>
        )}

        {activeTab === 'ops' && (
          <div className="space-y-6">
             <div className="bg-brand-primary rounded-[2.5rem] p-8 text-white shadow-xl relative overflow-hidden">
                <div className="absolute inset-0 bg-white/5 pointer-events-none" />
                <h3 className="text-xl font-black uppercase italic tracking-tighter mb-2">Monitores Live</h3>
                <p className="text-white/60 text-[10px] font-black uppercase tracking-widest leading-relaxed">
                   Acompanhamento em tempo real das chamadas e comunicações Unitel/Moxico.
                </p>
             </div>

             <div className="space-y-4">
                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
                   <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-blue-50 text-brand-primary rounded-xl flex items-center justify-center">
                         <Activity size={20} />
                      </div>
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">Canais Gateway Ativos</h4>
                   </div>
                   <div className="grid grid-cols-3 gap-2">
                      {[1,2,3].map(i => (
                        <div key={i} className="bg-slate-50 p-3 rounded-xl border border-slate-100 text-center">
                           <p className="text-[10px] font-black text-emerald-500 mb-1">ON</p>
                           <p className="text-[8px] font-bold text-slate-400 uppercase">Port {i}</p>
                        </div>
                      ))}
                   </div>
                </div>

                <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm space-y-4">
                   <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-amber-50 text-amber-500 rounded-xl flex items-center justify-center">
                         <MessageSquare size={20} />
                      </div>
                      <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">Log de Mensagens Mobile</h4>
                   </div>
                   <div className="space-y-2">
                      <p className="text-[10px] text-slate-500 italic leading-relaxed text-center py-10 border border-dashed border-slate-200 rounded-xl bg-slate-50">
                        Os logs de SMS detalhados estão disponíveis no painel desktop para auditoria completa.
                      </p>
                   </div>
                </div>

                <div className="bg-slate-900 p-6 rounded-[2rem] shadow-xl space-y-4">
                   <div className="flex items-center justify-between">
                      <div className="flex items-center gap-3">
                         <div className="w-10 h-10 bg-brand-primary rounded-xl flex items-center justify-center text-white">
                            <Smartphone size={20} />
                         </div>
                         <h4 className="text-xs font-black text-white uppercase tracking-tight">Gateway Integrado (Alpha)</h4>
                      </div>
                      <div className="flex items-center gap-1.5 bg-emerald-500/10 px-2 py-1 rounded-full border border-emerald-500/20">
                         <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                         <span className="text-[8px] font-bold text-emerald-500 uppercase">Vínculo Ativo</span>
                      </div>
                   </div>
                   <div className="space-y-4">
                      <p className="text-[10px] text-slate-400 italic leading-relaxed">
                        Este módulo sincroniza chamadas automaticamente. Apenas veículos registados na base de dados (PSM COMERCIAL) são monitorizados.
                      </p>
                      <div className="flex gap-2">
                        <button 
                          onClick={async () => {
                            const { NativeGateway } = await import('../services/nativeGateway');
                            const prefixToUse = user?.prefix || 'TX-01';
                            const result = await NativeGateway.simulateIncomingCall(prefixToUse);
                            if (result.success) {
                              alert(`Simulação bem-sucedida para viatura ${prefixToUse}!`);
                            } else {
                              alert(`Erro: ${result.error}. Garanta que ${prefixToUse} existe no Master Viatura.`);
                            }
                          }}
                          className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-[9px] font-black uppercase tracking-widest border border-white/10 transition-all"
                        >
                           Simular Chamada
                        </button>
                      </div>
                   </div>
                </div>
             </div>
          </div>
        )}

        {activeTab === 'wallet' && (
          <div className="space-y-6">
             <div className="bg-[#0f172a] rounded-[2.5rem] p-8 text-center text-white shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-brand-primary/20 to-transparent pointer-events-none" />
                <p className="text-[10px] font-black text-white/50 uppercase tracking-[0.3em] mb-3 relative">Total Recebido (Mês)</p>
                <h3 className="text-4xl font-black tracking-tighter mb-2 relative italic">1.250.000 <span className="text-lg">Kz</span></h3>
                <div className="inline-flex items-center gap-2 bg-emerald-500 text-white px-4 py-1.5 rounded-full relative text-[9px] font-black uppercase tracking-widest shadow-xl">
                   <TrendingUp size={12} />
                   +12.4% vs Mês Anterior
                </div>
             </div>

             <div className="space-y-4">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 italic">Fluxo de Rendas PSM</h3>
                <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-xl">
                   {[
                     { label: 'Hoje (Luena)', value: '125.000 Kz', trend: 'positive' },
                     { label: 'Pendente Acerto', value: '45.750 Kz', trend: 'warning' },
                     { label: 'Rendas em Atraso', value: '12.000 Kz', trend: 'danger' },
                     { label: 'Base de Caixa', value: 'Estável', trend: 'neutral' }
                   ].map((row, idx) => (
                     <div key={idx} className={cn("px-6 py-5 flex items-center justify-between", idx !== 3 && "border-b border-slate-50")}>
                        <span className="text-[11px] font-black text-slate-400 uppercase tracking-tight">{row.label}</span>
                        <div className="flex items-center gap-2">
                           <span className="text-[12px] font-black text-slate-900 uppercase tracking-tight">{row.value}</span>
                           <div className={cn(
                             "w-1.5 h-1.5 rounded-full animate-pulse",
                             row.trend === 'positive' ? "bg-emerald-500" : row.trend === 'warning' ? "bg-amber-500" : row.trend === 'danger' ? "bg-red-500" : "bg-slate-400"
                           )} />
                        </div>
                     </div>
                   ))}
                </div>
                
                <button className="w-full bg-slate-900 text-white py-5 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-3 shadow-2xl active:scale-95 transition-all">
                   <Calculator size={16} className="text-brand-primary" />
                   Ver Relatórios Financeiros
                </button>
             </div>
          </div>
        )}
      </main>

      {/* Mobile Sticky Tab Bar */}
      <footer className="h-20 bg-white border-t border-slate-100 flex items-center justify-around px-2 flex-shrink-0 relative z-50">
        <button 
          onClick={() => setActiveTab('dashboard')}
          className={cn("flex flex-col items-center gap-1 transition-all duration-300", activeTab === 'dashboard' ? "text-brand-primary scale-110" : "text-slate-300")}
        >
          <LayoutDashboard size={22} strokeWidth={activeTab === 'dashboard' ? 3 : 2} />
          <span className="text-[8px] font-black uppercase tracking-widest">Painel</span>
        </button>
        <button 
          onClick={() => setActiveTab('fleet')}
          className={cn("flex flex-col items-center gap-1 transition-all duration-300", activeTab === 'fleet' ? "text-brand-primary scale-110" : "text-slate-300")}
        >
          <Truck size={22} strokeWidth={activeTab === 'fleet' ? 3 : 2} />
          <span className="text-[8px] font-black uppercase tracking-widest">Frota</span>
        </button>
        <button 
          onClick={() => setActiveTab('ops')}
          className={cn("flex flex-col items-center gap-1 transition-all duration-300", activeTab === 'ops' ? "text-brand-primary scale-110" : "text-slate-300")}
        >
          <Activity size={22} strokeWidth={activeTab === 'ops' ? 3 : 2} />
          <span className="text-[8px] font-black uppercase tracking-widest">Monitores</span>
        </button>
        <button 
          onClick={() => setActiveTab('wallet')}
          className={cn("flex flex-col items-center gap-1 transition-all duration-300", activeTab === 'wallet' ? "text-brand-primary scale-110" : "text-slate-300")}
        >
          <Wallet size={22} strokeWidth={activeTab === 'wallet' ? 3 : 2} />
          <span className="text-[8px] font-black uppercase tracking-widest">Contas</span>
        </button>
      </footer>

      {/* Slide-out Overlay Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-slate-900/60 backdrop-blur-md z-[60]"
            />
            <motion.div 
              initial={{ x: 300 }}
              animate={{ x: 0 }}
              exit={{ x: 300 }}
              className="fixed top-0 right-0 h-full w-4/5 max-w-[320px] bg-white z-[70] shadow-2xl p-8 flex flex-col"
            >
              <div className="flex items-center justify-between mb-10">
                 <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter italic">Definições</h3>
                 <button onClick={() => setIsMenuOpen(false)} className="p-2 bg-slate-100 rounded-full">
                   <X size={18} />
                 </button>
              </div>
              
              <div className="flex-1 space-y-2">
                {menuItems.map((item, idx) => (
                  <button 
                    key={idx}
                    onClick={() => {
                      item.onClick();
                      setIsMenuOpen(false);
                    }}
                    className={cn(
                      "w-full flex items-center justify-between p-4 rounded-2xl hover:bg-slate-50 transition-all active:scale-95 border border-transparent hover:border-slate-100",
                      item.color || "text-slate-900"
                    )}
                  >
                    <div className="flex items-center gap-4">
                       <item.icon size={20} />
                       <span className="text-xs font-black uppercase tracking-widest">{item.label}</span>
                    </div>
                    <ChevronRight size={16} className="opacity-30" />
                  </button>
                ))}
              </div>
              
              <div className="mt-auto pt-8 border-t border-slate-100 text-center">
                 <p className="text-[10px] font-black text-slate-300 uppercase tracking-[0.2em]">PSM COMERCIAL LUENA</p>
                 <p className="text-[9px] font-medium text-slate-400 mt-1 uppercase">TaxiControl Mobile Interface</p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
