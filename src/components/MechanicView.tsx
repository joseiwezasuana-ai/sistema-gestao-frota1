import React, { useState, useEffect } from 'react';
import { 
  Wrench, 
  Settings, 
  Bell, 
  Activity, 
  History, 
  Package, 
  Wallet, 
  LogOut, 
  Plus, 
  Search, 
  Truck, 
  Clock, 
  CheckCircle2, 
  AlertCircle,
  TrendingUp,
  FileText,
  X,
  ChevronRight,
  Menu,
  Map
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot, addDoc, where, limit } from 'firebase/firestore';
import { format } from 'date-fns';
import RealTimeMap from './RealTimeMap';

interface MechanicViewProps {
  user: any;
}

export default function MechanicView({ user }: MechanicViewProps) {
  const [activeInternalTab, setActiveInternalTab] = useState<'dashboard' | 'maintenance' | 'warehouse' | 'wallet' | 'map'>('dashboard');
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [panicAlerts, setPanicAlerts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [formData, setFormData] = useState({
    vehicleId: '',
    prefix: '',
    type: 'Troca de Óleo',
    mileage: '',
    date: new Date().toISOString().split('T')[0],
    cost: '',
    status: 'planned',
    description: ''
  });

  // Mock Inventory (similar to WarehouseManager)
  const INVENTORY = [
    { id: 'P-001', name: 'Óleo Motor 5W30 (5L)', category: 'Lubrificantes', stock: 12, min: 5, unit: 'UN' },
    { id: 'P-002', name: 'Filtro de Óleo - Corola', category: 'Filtros', stock: 3, min: 10, unit: 'UN' },
    { id: 'P-003', name: 'Pastilhas de Travão Diant.', category: 'Travões', stock: 8, min: 4, unit: 'PAR' },
    { id: 'P-004', name: 'Pneu 185/65 R15', category: 'Pneus', stock: 16, min: 8, unit: 'UN' },
  ];

  useEffect(() => {
    const q = query(collection(db, 'maintenance_logs'), orderBy('timestamp', 'desc'));
    const unsubscribeLogs = onSnapshot(q, (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'maintenance_logs');
    });

    const qVehicles = query(collection(db, 'master_vehicles'), orderBy('prefix', 'asc'));
    const unsubscribeVehicles = onSnapshot(qVehicles, (snapshot) => {
      setVehicles(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'master_vehicles');
    });

    const qPanic = query(collection(db, 'panic_alerts'), where('status', '==', 'active'));
    const unsubscribePanic = onSnapshot(qPanic, (snapshot) => {
      setPanicAlerts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'panic_alerts');
    });

    return () => {
      unsubscribeLogs();
      unsubscribeVehicles();
      unsubscribePanic();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedVehicle = vehicles.find(v => v.id === formData.vehicleId);
    
    try {
      await addDoc(collection(db, 'maintenance_logs'), {
        ...formData,
        prefix: selectedVehicle?.prefix || 'N/A',
        mileage: Number(formData.mileage),
        cost: Number(formData.cost),
        mecanicoId: user.uid,
        mecanicoName: user.name,
        timestamp: new Date().toISOString()
      });
      setIsModalOpen(false);
      setFormData({
        vehicleId: '',
        prefix: '',
        type: 'Troca de Óleo',
        mileage: '',
        date: new Date().toISOString().split('T')[0],
        cost: '',
        status: 'planned',
        description: ''
      });
    } catch (error) {
      console.error("Erro ao adicionar manutenção:", error);
    }
  };

  const menuItems = [
    { icon: Settings, label: 'Definições', onClick: () => {} },
    { icon: FileText, label: 'Documentação', onClick: () => {} },
    { icon: LogOut, label: 'Sair do Sistema', onClick: () => signOut(auth), color: 'text-red-500' },
  ];

  return (
    <div className="flex flex-col h-screen bg-slate-50 overflow-hidden font-sans">
      {/* Header Mobile Style */}
      <header className="bg-white px-6 py-4 flex items-center justify-between border-b border-slate-100 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-lg overflow-hidden border-2 border-white">
            <Wrench size={20} />
          </div>
          <div>
            <h1 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] leading-none mb-1">Mecânico Oficial</h1>
            <p className="text-sm font-black text-slate-900 uppercase tracking-tighter truncate max-w-[150px]">{user?.name || 'Oficina Central'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button className="relative p-2 text-slate-400">
            <Bell size={20} />
            <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
          </button>
          <button 
            onClick={() => setIsMenuOpen(true)}
            className="p-2 text-slate-900 hover:bg-slate-50 rounded-lg transition-colors"
          >
            <Menu size={24} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-5 custom-scrollbar pb-24">
        {activeInternalTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 bg-blue-50 text-blue-600 rounded-lg flex items-center justify-center">
                    <Clock size={16} />
                  </div>
                </div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-tight">Manutenções<br/>Pendentes</p>
                <p className="text-xl font-black text-slate-900 mt-1">{logs.filter(l => l.status === 'planned').length}</p>
              </div>
              <div className="bg-white p-4 rounded-2xl border border-slate-100 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 bg-amber-50 text-amber-600 rounded-lg flex items-center justify-center">
                    <AlertCircle size={16} />
                  </div>
                </div>
                <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest leading-tight">Stock<br/>Baixo</p>
                <p className="text-xl font-black text-slate-900 mt-1">08</p>
              </div>
            </div>

            {/* Status Card */}
            <div className="bg-slate-900 rounded-[2rem] p-6 text-white shadow-2xl relative overflow-hidden">
               <div className="absolute -right-4 -top-4 w-32 h-32 bg-white/5 rounded-full blur-2xl" />
               <div className="relative">
                  <div className="flex items-center gap-2 mb-4">
                    <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">Oficina Aberta</span>
                  </div>
                  <h2 className="text-2xl font-black uppercase tracking-tighter leading-tight mb-2">
                    Centro Técnico<br/>PSM LUENA
                  </h2>
                  <p className="text-white/60 text-[10px] font-bold uppercase tracking-widest leading-relaxed mb-6">
                    Acompanhamento em tempo real da saúde da frota e disponibilidade de peças.
                  </p>
                  <button 
                    onClick={() => setActiveInternalTab('maintenance')}
                    className="w-full bg-white text-slate-900 py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
                  >
                    Ver Todas Manutenções
                    <ChevronRight size={14} />
                  </button>
               </div>
            </div>

            {/* Panic Alerts for Mechanic */}
            {panicAlerts.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-[10px] font-black text-rose-500 uppercase tracking-widest px-1 flex items-center gap-2 animate-bounce">
                  <AlertCircle size={14} /> Alertas de Pânico Ativos
                </h3>
                <div className="space-y-3">
                  {panicAlerts.map(alert => (
                    <motion.div 
                      key={alert.id}
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      onClick={() => setActiveInternalTab('map')}
                      className="bg-rose-50 border-2 border-rose-200 p-4 rounded-2xl flex items-center justify-between shadow-lg shadow-rose-200/50 cursor-pointer active:scale-95 transition-all"
                    >
                      <div className="flex items-center gap-3">
                         <div className="w-10 h-10 bg-rose-600 text-white rounded-xl flex items-center justify-center animate-pulse shadow-lg">
                           <Truck size={20} />
                         </div>
                         <div>
                            <p className="text-xs font-black text-rose-900 uppercase tracking-tight">SOS: {alert.prefix}</p>
                            <p className="text-[9px] text-rose-500 font-bold uppercase tracking-widest">{alert.driverName}</p>
                         </div>
                      </div>
                      <Map size={16} className="text-rose-600" />
                    </motion.div>
                  ))}
                </div>
              </div>
            )}

            {/* Next Maintenance Log Section */}
            <div>
              <div className="flex items-center justify-between mb-4 px-1">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Últimos Registos</h3>
                <button onClick={() => setActiveInternalTab('maintenance')} className="text-[9px] font-black text-brand-primary uppercase underline">Ver Tudo</button>
              </div>
              <div className="space-y-3">
                {logs.slice(0, 3).map((log) => (
                  <div key={log.id} className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between shadow-sm">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 font-black text-xs">
                        {log.prefix}
                      </div>
                      <div>
                        <p className="text-[11px] font-black text-slate-900 uppercase tracking-tight">{log.type}</p>
                        <p className="text-[9px] text-slate-400 font-bold uppercase">{log.date}</p>
                      </div>
                    </div>
                    <span className={cn(
                      "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest",
                      log.status === 'completed' ? "bg-emerald-50 text-emerald-600" : "bg-amber-50 text-amber-600"
                    )}>
                      {log.status === 'completed' ? 'Ok' : 'Pendente'}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {activeInternalTab === 'map' && (
          <div className="h-full flex flex-col -m-5">
             <div className="p-4 bg-white border-b border-slate-100 flex items-center justify-between">
                <h2 className="text-lg font-black text-slate-900 uppercase tracking-tighter italic">Mapa de Frota Moxico</h2>
                <button 
                  onClick={() => setActiveInternalTab('dashboard')}
                  className="p-2 transition-all active:scale-95 text-slate-400"
                >
                  <X size={20} />
                </button>
             </div>
             <div className="flex-1 relative">
                <RealTimeMap />
             </div>
          </div>
        )}

        {activeInternalTab === 'maintenance' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-lg font-black text-slate-900 uppercase tracking-tighter italic">Lista de Reparos</h2>
              <button 
                onClick={() => setIsModalOpen(true)}
                className="bg-brand-primary text-white p-2 rounded-xl shadow-lg shadow-brand-primary/20"
              >
                <Plus size={20} />
              </button>
            </div>

            <div className="relative mb-4">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="PROCURAR REPARO..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full pl-12 pr-4 py-4 bg-white border border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm outline-none focus:border-brand-primary"
              />
            </div>
            
            <div className="space-y-3">
              {logs.filter(log => 
                log.prefix?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                log.type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                log.description?.toLowerCase().includes(searchTerm.toLowerCase())
              ).map((log) => (
                <motion.div 
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  key={log.id} 
                  className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm relative overflow-hidden"
                >
                  <div className="flex items-start justify-between mb-3">
                     <div className="flex items-center gap-3">
                        <div className="w-12 h-12 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-500 font-black text-sm border-2 border-white shadow-sm">
                          {log.prefix}
                        </div>
                        <div>
                           <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-0.5">{log.type}</p>
                           <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">{log.date}</h4>
                        </div>
                     </div>
                     <span className={cn(
                        "px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border",
                        log.status === 'completed' ? "bg-emerald-50 text-emerald-600 border-emerald-100" : "bg-amber-50 text-amber-600 border-amber-100"
                     )}>
                        {log.status === 'completed' ? 'Concluído' : 'Pendente'}
                     </span>
                  </div>
                  <div className="text-[10px] text-slate-500 font-bold uppercase leading-relaxed mb-4 bg-slate-50 p-3 rounded-xl">
                    {log.description || 'Nenhum detalhe adicional registado.'}
                  </div>
                  <div className="flex items-center justify-between border-t border-slate-50 pt-3">
                     <div className="flex items-center gap-2">
                        <TrendingUp size={12} className="text-slate-400" />
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-tight">{log.cost?.toLocaleString()} Kz</span>
                     </div>
                     <div className="flex items-center gap-2">
                        <Truck size={12} className="text-slate-400" />
                        <span className="text-[10px] font-black text-slate-600 uppercase tracking-tight">{log.mileage?.toLocaleString()} KM</span>
                     </div>
                  </div>
                </motion.div>
              ))}
            </div>
          </div>
        )}

        {activeInternalTab === 'warehouse' && (
          <div className="space-y-6">
            <h2 className="text-lg font-black text-slate-900 uppercase tracking-tighter italic px-1">Peças em Stock</h2>
            
            <div className="relative mb-4">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
              <input 
                type="text" 
                placeholder="PROCURAR PEÇA..."
                className="w-full pl-12 pr-4 py-4 bg-white border border-slate-100 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm outline-none focus:border-brand-primary"
              />
            </div>

            <div className="space-y-3">
              {INVENTORY.map((item) => (
                <div key={item.id} className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm flex items-center justify-between">
                   <div className="flex items-center gap-4">
                      <div className="w-10 h-10 bg-slate-50 text-slate-500 rounded-xl flex items-center justify-center">
                        <Package size={20} />
                      </div>
                      <div>
                        <p className="text-[9px] font-black text-brand-primary uppercase tracking-widest">{item.id}</p>
                        <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight">{item.name}</h4>
                        <span className="text-[9px] text-slate-400 font-bold uppercase">{item.category}</span>
                      </div>
                   </div>
                   <div className="text-right">
                      <p className="text-xs font-black text-slate-900 tracking-tight">{item.stock} {item.unit}</p>
                      {item.stock <= item.min ? (
                         <span className="text-[8px] font-black text-red-500 uppercase">Repor</span>
                      ) : (
                         <span className="text-[8px] font-black text-emerald-500 uppercase font-mono tracking-widest">OK</span>
                      )}
                   </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {activeInternalTab === 'wallet' && (
          <div className="space-y-6">
             <div className="bg-slate-900 rounded-[2.5rem] p-8 text-center text-white shadow-2xl relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/20 translate-y-10" />
                <p className="text-[10px] font-black text-white/50 uppercase tracking-[0.3em] mb-3 relative">Remuneração do Mês</p>
                <h3 className="text-4xl font-black tracking-tighter mb-2 relative italic">75.000 <span className="text-lg">Kz</span></h3>
                <div className="inline-flex items-center gap-2 bg-emerald-500/20 px-4 py-1.5 rounded-full relative">
                   <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                   <span className="text-[9px] font-black text-emerald-400 uppercase tracking-widest">Salário Base Ativo</span>
                </div>
             </div>

             <div className="space-y-4">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Detalhes do Contrato</h3>
                <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-sm">
                   {[
                     { label: 'Subsídio de Risco', value: '15.000 Kz' },
                     { label: 'Bónus Produtividade', value: '10.000 Kz' },
                     { label: 'Refeição Oficina', value: 'Diário' },
                     { label: 'Próximo Pagamento', value: '28 de Abril' }
                   ].map((row, idx) => (
                     <div key={idx} className={cn("px-6 py-4 flex items-center justify-between", idx !== 3 && "border-b border-slate-50")}>
                        <span className="text-[10px] font-black text-slate-400 uppercase tracking-tight">{row.label}</span>
                        <span className="text-[11px] font-black text-slate-900 uppercase tracking-tight">{row.value}</span>
                     </div>
                   ))}
                </div>
             </div>
          </div>
        )}
      </main>

      {/* Tab Bar Mechanic Style */}
      <footer className="h-20 bg-white border-t border-slate-100 flex items-center justify-around px-4 flex-shrink-0 relative z-50">
        <button 
          onClick={() => setActiveInternalTab('dashboard')}
          className={cn("flex flex-col items-center gap-1 transition-all duration-300", activeInternalTab === 'dashboard' ? "text-brand-primary scale-110" : "text-slate-300")}
        >
          <Activity size={22} strokeWidth={activeInternalTab === 'dashboard' ? 3 : 2} />
          <span className="text-[8px] font-black uppercase tracking-widest">Início</span>
        </button>
        <button 
          onClick={() => setActiveInternalTab('maintenance')}
          className={cn("flex flex-col items-center gap-1 transition-all duration-300", activeInternalTab === 'maintenance' ? "text-brand-primary scale-110" : "text-slate-300")}
        >
          <History size={22} strokeWidth={activeInternalTab === 'maintenance' ? 3 : 2} />
          <span className="text-[8px] font-black uppercase tracking-widest">Oficina</span>
        </button>
        <button 
          onClick={() => setActiveInternalTab('map')}
          className={cn("flex flex-col items-center gap-1 transition-all duration-300", activeInternalTab === 'map' ? "text-brand-primary scale-110" : "text-slate-300")}
        >
          <Map size={22} strokeWidth={activeInternalTab === 'map' ? 3 : 2} />
          <span className="text-[8px] font-black uppercase tracking-widest">Mapa</span>
        </button>
        <button 
          onClick={() => setActiveInternalTab('warehouse')}
          className={cn("flex flex-col items-center gap-1 transition-all duration-300", activeInternalTab === 'warehouse' ? "text-brand-primary scale-110" : "text-slate-300")}
        >
          <Package size={22} strokeWidth={activeInternalTab === 'warehouse' ? 3 : 2} />
          <span className="text-[8px] font-black uppercase tracking-widest">Peças</span>
        </button>
        <button 
          onClick={() => setActiveInternalTab('wallet')}
          className={cn("flex flex-col items-center gap-1 transition-all duration-300", activeInternalTab === 'wallet' ? "text-brand-primary scale-110" : "text-slate-300")}
        >
          <Wallet size={22} strokeWidth={activeInternalTab === 'wallet' ? 3 : 2} />
          <span className="text-[8px] font-black uppercase tracking-widest">Pagos</span>
        </button>
      </footer>

      {/* Floating Menu Overlay */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-slate-900/40 backdrop-blur-md z-[60]"
            />
            <motion.div 
              initial={{ x: 300 }}
              animate={{ x: 0 }}
              exit={{ x: 300 }}
              className="fixed top-0 right-0 h-full w-4/5 max-w-[300px] bg-white z-[70] shadow-2xl p-8 flex flex-col"
            >
              <div className="flex items-center justify-between mb-10">
                 <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter italic italic">Definições</h3>
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
                 <p className="text-[9px] font-black text-slate-300 uppercase tracking-[0.2em]">PSM COMERCIAL LUENA</p>
                 <p className="text-[9px] font-medium text-slate-300 mt-1 uppercase">TaxiControl Version 2.0</p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Maintenance Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-end p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: 500 }}
              animate={{ y: 0 }}
              exit={{ y: 500 }}
              className="relative w-full bg-white rounded-t-[2.5rem] rounded-b-2xl p-8 max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl"
            >
              <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-50">
                 <div>
                   <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter italic">Nova Intervenção</h3>
                   <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest mt-1">Registo Técnico de Oficina</p>
                 </div>
                 <button onClick={() => setIsModalOpen(false)} className="p-2 bg-slate-100 rounded-full text-slate-400">
                   <X size={18} />
                 </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5 pb-8">
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Viatura em Reparação</label>
                    <select 
                      required
                      value={formData.vehicleId}
                      onChange={(e) => setFormData({...formData, vehicleId: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-xs font-black uppercase outline-none focus:border-brand-primary shadow-sm"
                    >
                      <option value="">Seleccionar Viatura...</option>
                      {vehicles.map(v => (
                        <option key={v.id} value={v.id}>{v.prefix} - {v.name}</option>
                      ))}
                    </select>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Serviço</label>
                       <select 
                         required
                         value={formData.type}
                         onChange={(e) => setFormData({...formData, type: e.target.value})}
                         className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-xs font-black uppercase outline-none focus:border-brand-primary"
                       >
                         <option value="Troca de Óleo">Troca de Óleo</option>
                         <option value="Travões">Travões</option>
                         <option value="Pneus">Pneus</option>
                         <option value="Outro">Outro</option>
                       </select>
                    </div>
                    <div className="space-y-1.5">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">KM Atual</label>
                       <input 
                         type="number"
                         required
                         value={formData.mileage}
                         onChange={(e) => setFormData({...formData, mileage: e.target.value})}
                         className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-xs font-black outline-none focus:border-brand-primary"
                         placeholder="Ex: 50.000"
                       />
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Data</label>
                       <input 
                         type="date"
                         required
                         value={formData.date}
                         onChange={(e) => setFormData({...formData, date: e.target.value})}
                         className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-xs font-black outline-none focus:border-brand-primary"
                       />
                    </div>
                    <div className="space-y-1.5">
                       <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Custo (Kz)</label>
                       <input 
                         type="number"
                         required
                         value={formData.cost}
                         onChange={(e) => setFormData({...formData, cost: e.target.value})}
                         className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-xs font-black outline-none focus:border-brand-primary"
                         placeholder="10.000"
                       />
                    </div>
                 </div>

                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Status</label>
                    <select 
                      required
                      value={formData.status}
                      onChange={(e) => setFormData({...formData, status: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-4 text-xs font-black uppercase outline-none focus:border-brand-primary"
                    >
                      <option value="planned">Pendente / Aberto</option>
                      <option value="completed">Concluído / Resolvido</option>
                    </select>
                 </div>

                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Notas Técnicas</label>
                    <textarea 
                      rows={3}
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-100 rounded-2xl px-5 py-3 text-xs font-bold outline-none focus:border-brand-primary resize-none placeholder:text-slate-300"
                      placeholder="Descreva o problema ou reparo..."
                    />
                 </div>

                 <button 
                  type="submit"
                  className="w-full bg-slate-900 text-white py-5 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-2xl hover:bg-slate-800 transition-all active:scale-95 mt-4"
                 >
                   Registar Intervenção
                 </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
