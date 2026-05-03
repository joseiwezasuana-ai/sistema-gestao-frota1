import React, { useState, useEffect } from 'react';
import { 
  PhoneIncoming, 
  MessageSquare, 
  Clock, 
  User, 
  MapPin, 
  Activity,
  Trash2,
  Phone,
  Radio,
  Wifi,
  MoreVertical,
  Search,
  Filter,
  CheckCircle2,
  XCircle,
  AlertCircle,
  RefreshCcw,
  Download,
  Calendar
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  limit,
  deleteDoc,
  doc,
  where,
  getDocs,
  writeBatch
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { format } from 'date-fns';
import { cn } from '../lib/utils';

type MonitorTab = 'psm' | 'unitel';

interface RealTimeMonitorProps {
  user?: any;
}

export default function RealTimeMonitor({ user }: RealTimeMonitorProps) {
  const [activeSubTab, setActiveSubTab] = useState<MonitorTab>('psm');
  const [calls, setCalls] = useState<any[]>([]);
  const [smsLogs, setSmsLogs] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [masterDrivers, setMasterDrivers] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('todos');
  const [pageSize, setPageSize] = useState(50);
  const [loading, setLoading] = useState(true);

  const isAdmin = user?.role === 'admin';

  useEffect(() => {
    setLoading(true);
    // 1. Listen for calls (PSM Operator)
    let qCalls = query(collection(db, 'calls'), orderBy('timestamp', 'desc'), limit(pageSize));
    
    if (statusFilter !== 'todos' && activeSubTab === 'psm') {
      qCalls = query(
        collection(db, 'calls'), 
        where('status', '==', statusFilter),
        orderBy('timestamp', 'desc'), 
        limit(pageSize)
      );
    }

    const unsubCalls = onSnapshot(qCalls, (snapshot) => {
      setCalls(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'calls'));

    // 2. Listen for SMS logs (Unitel Monitoring)
    const qSms = query(collection(db, 'sms_logs'), orderBy('timestamp', 'desc'), limit(pageSize));
    const unsubSms = onSnapshot(qSms, (snapshot) => {
      setSmsLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'sms_logs'));

    // 3. Listen for drivers
    const unsubDrivers = onSnapshot(collection(db, 'drivers'), (snapshot) => {
      setDrivers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'drivers'));

    // 4. Listen for master drivers to link personal phones
    const unsubMaster = onSnapshot(collection(db, 'drivers_master'), (snapshot) => {
      setMasterDrivers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'drivers_master'));

    return () => {
      unsubCalls();
      unsubSms();
      unsubDrivers();
      unsubMaster();
    };
  }, [statusFilter, pageSize, activeSubTab]);

  const deleteLog = async (collectionName: string, id: string) => {
    if (!window.confirm('Tem certeza que deseja apagar este registo do histórico?')) return;
    try {
      await deleteDoc(doc(db, collectionName, id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, collectionName);
    }
  };

  const clearHistory = async () => {
    const targetCollection = activeSubTab === 'psm' ? 'calls' : 'sms_logs';
    if (!window.confirm(`ATENÇÃO: Deseja apagar TODO o histórico visível de ${targetCollection === 'calls' ? 'Chamadas' : 'SMS'}? Esta ação é irreversível.`)) return;
    
    try {
      const batch = writeBatch(db);
      const items = activeSubTab === 'psm' ? filteredCalls : filteredSms;
      items.forEach(item => {
        batch.delete(doc(db, targetCollection, item.id));
      });
      await batch.commit();
      alert('Histórico limpo com sucesso.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, targetCollection);
    }
  };

  const getVehicleByPhone = (phone?: string) => {
    if (!phone) return null;
    // 1. Check in active drivers (linked in current scale)
    const activeDriver = drivers.find(d => d.phone === phone || d.secondaryPhone === phone);
    if (activeDriver) return activeDriver;

    // 2. Check in master drivers (personal phone)
    const masterDriver = masterDrivers.find(m => m.phone === phone);
    if (masterDriver) {
      // If found in master, find which active vehicle this driver is currently assigned to
      const currentActive = drivers.find(d => d.name === masterDriver.name);
      return currentActive || null;
    }

    return null;
  };

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'active': case 'ativo': case 'em curso': return 'text-blue-600 bg-blue-50 border-blue-100';
      case 'completed': case 'finalizada': case 'concluída': return 'text-green-600 bg-green-50 border-green-100';
      case 'cancelled': case 'cancelada': case 'failed': return 'text-red-600 bg-red-50 border-red-100';
      default: return 'text-slate-500 bg-slate-50 border-slate-100';
    }
  };

  const filteredCalls = calls.filter(c => 
    (c.customerName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (c.customerPhone || '').includes(searchTerm)
  );

  const filteredSms = smsLogs.filter(s => 
    (s.content?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (s.from || '').includes(searchTerm)
  );

  const psmStatuses = [
    { id: 'todos', label: 'Todos', icon: Activity },
    { id: 'ativo', label: 'Em Curso', icon: RefreshCcw },
    { id: 'concluída', label: 'Concluídas', icon: CheckCircle2 },
    { id: 'cancelada', label: 'Canceladas', icon: XCircle }
  ];

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto flex flex-col h-full">
      {/* Station Header */}
      <div className="bg-[#0f172a] p-6 rounded-2xl border border-slate-800 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/10 blur-[100px] rounded-full -mr-32 -mt-32" />
        
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div className="flex items-center gap-5">
            <div className="w-14 h-14 bg-brand-primary rounded-xl flex items-center justify-center shadow-lg shadow-brand-primary/30">
               <Radio size={28} className="text-white animate-pulse" />
            </div>
            <div>
              <h2 className="text-2xl font-black text-white tracking-tighter uppercase italic">PSM COMERCIAL LUENA MOXICO</h2>
              <div className="flex items-center gap-3 mt-1">
                <span className="flex items-center gap-1.5 px-2 py-0.5 bg-green-500/10 text-green-400 rounded text-[10px] font-black uppercase tracking-widest border border-green-500/20">
                  <Activity size={10} /> Consola Ativa
                </span>
                <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Gestão de Histórico e Monitorização Live</span>
              </div>
            </div>
          </div>

          <div className="flex bg-slate-800/50 p-1.5 rounded-xl border border-slate-700/50">
             <button 
               onClick={() => { setActiveSubTab('psm'); setStatusFilter('todos'); }}
               className={cn(
                 "px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2",
                 activeSubTab === 'psm' ? "bg-brand-primary text-white shadow-lg" : "text-slate-400 hover:text-slate-200"
               )}
             >
               <Phone size={14} /> Histórico PSM COMERCIAL
             </button>
             <button 
               onClick={() => { setActiveSubTab('unitel'); setStatusFilter('todos'); }}
               className={cn(
                 "px-6 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2",
                 activeSubTab === 'unitel' ? "bg-amber-500 text-white shadow-lg" : "text-slate-400 hover:text-slate-200"
               )}
             >
               <Wifi size={14} /> Monitoria Unitel
             </button>
          </div>
        </div>
      </div>

      {/* Control Bar */}
      <div className="flex flex-col gap-4">
        <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-4 items-center">
            <div className="relative flex-1 group">
                <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-primary transition-colors" />
                <input 
                    type="text" 
                    placeholder={activeSubTab === 'psm' ? "Pesquisar por cliente, telefone..." : "Pesquisar por conteúdo SMS..."}
                    className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-brand-primary/20 focus:border-brand-primary transition-all outline-none"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>
            
            <div className="flex items-center gap-2">
               {isAdmin && (
                 <button 
                   onClick={clearHistory}
                   className="flex items-center gap-2 px-4 py-2.5 text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all"
                 >
                   <Trash2 size={14} /> Limpar Histórico
                 </button>
               )}
               <button className="p-2.5 bg-slate-50 text-slate-400 border border-slate-200 rounded-lg hover:text-brand-primary transition-all">
                  <Download size={18} />
               </button>
            </div>
        </div>

        {/* Dynamic Filters */}
        {activeSubTab === 'psm' && (
           <div className="flex items-center gap-2 overflow-x-auto pb-1 no-scrollbar">
              {psmStatuses.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setStatusFilter(s.id)}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all whitespace-nowrap",
                    statusFilter === s.id 
                      ? "bg-brand-primary text-white border-brand-primary shadow-md" 
                      : "bg-white text-slate-500 border-slate-200 hover:border-brand-primary/30"
                  )}
                >
                  <s.icon size={12} />
                  {s.label}
                </button>
              ))}
           </div>
        )}
      </div>

      <div className="flex-1 overflow-hidden min-h-0">
        <AnimatePresence mode="wait">
          {activeSubTab === 'psm' ? (
            <motion.div 
              key="psm"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full flex flex-col"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 overflow-y-auto p-1 custom-scrollbar pb-10">
                {filteredCalls.map((call) => (
                    <div key={call.id} className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm hover:shadow-md transition-all group relative overflow-hidden">
                    <div className="flex justify-between items-start mb-4">
                        <div className="flex items-center gap-3">
                            <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center text-slate-500 group-hover:bg-brand-primary group-hover:text-white transition-colors">
                            <PhoneIncoming size={18} />
                            </div>
                            <div>
                            <p className="text-sm font-black text-slate-800">{call.customerName || 'Cliente Direto'}</p>
                            <p className="text-[10px] text-slate-400 font-bold tracking-tighter">{call.customerPhone}</p>
                            </div>
                        </div>
                        <div className="flex flex-col items-end gap-1.5">
                            <span className={cn("px-2 py-0.5 rounded text-[9px] font-black uppercase border", getStatusColor(call.status))}>
                            {call.status}
                            </span>
                            <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                            <Clock size={10} /> {call.timestamp?.toDate ? format(call.timestamp.toDate(), 'HH:mm:ss') : '--:--'}
                            </div>
                        </div>
                    </div>

                    <div className="space-y-2 mb-4">
                        <div className="flex items-start gap-2">
                            <MapPin size={12} className="text-brand-primary mt-0.5 flex-shrink-0" />
                            <span className="text-[11px] text-slate-600 font-bold leading-tight">{call.pickupAddress}</span>
                        </div>
                        <div className="flex items-center gap-2">
                            <User size={12} className="text-slate-400 flex-shrink-0" />
                            <span className="text-[11px] text-slate-500 font-black">
                              Viatura: {drivers.find(d => d.id === call.driverId)?.prefix || getVehicleByPhone(call.customerPhone)?.prefix || 'Em despacho...'}
                            </span>
                        </div>
                    </div>

                    <div className="pt-3 border-t border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <span className="text-[9px] font-black text-slate-400 bg-slate-100 px-1.5 py-0.5 rounded uppercase tracking-tighter">
                            #{(call.id || "0000").slice(-4).toUpperCase()}
                            </span>
                            <span className="text-[9px] font-bold text-slate-400 uppercase flex items-center gap-1">
                               <Calendar size={10} /> {call.timestamp?.toDate ? format(call.timestamp.toDate(), 'dd/MM/yy') : '--/--/--'}
                            </span>
                        </div>
                        <button 
                        onClick={() => deleteLog('calls', call.id)}
                        className="p-2 text-slate-200 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                        title="Apagar serviço"
                        >
                            <Trash2 size={14} />
                        </button>
                    </div>
                  </div>
                ))}
                
                {filteredCalls.length >= pageSize && (
                  <div className="col-span-full pt-4 flex justify-center">
                    <button 
                      onClick={() => setPageSize(prev => prev + 50)}
                      className="px-6 py-2 bg-white border border-slate-200 rounded-full text-[10px] font-black text-slate-400 uppercase tracking-widest hover:border-brand-primary hover:text-brand-primary transition-all shadow-sm"
                    >
                      Carregar mais histórico
                    </button>
                  </div>
                )}
                
                {filteredCalls.length === 0 && !loading && (
                   <div className="col-span-full py-20 bg-white rounded-2xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400">
                      <AlertCircle size={48} className="mb-4 opacity-20" />
                      <p className="font-black uppercase tracking-widest text-xs">Nenhum registo encontrado para este filtro</p>
                   </div>
                )}
              </div>
            </motion.div>
          ) : (
            <motion.div 
              key="unitel"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full flex flex-col"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 overflow-y-auto p-1 custom-scrollbar pb-10">
                {filteredSms.map((log) => (
                    <div key={log.id} className="bg-white rounded-2xl border border-slate-200 overflow-hidden shadow-sm hover:border-amber-500/30 transition-all flex flex-col group">
                    <div className="bg-slate-50/50 px-4 py-3 border-b border-slate-100 flex items-center justify-between">
                        <div className="flex items-center gap-2">
                            <div className="w-2 h-2 rounded-full bg-amber-500" />
                            <span className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Servidor Unitel</span>
                        </div>
                        <div className="flex items-center gap-3">
                            <span className="text-[10px] text-slate-400 font-mono italic">
                            {log.timestamp?.toDate ? format(log.timestamp.toDate(), 'HH:mm:ss') : '--:--'}
                            </span>
                            <button 
                            onClick={() => deleteLog('sms_logs', log.id)}
                            className="p-1 text-slate-200 hover:text-red-500 transition-all"
                            >
                            <Trash2 size={13} />
                            </button>
                        </div>
                    </div>

                    <div className="p-4 flex-1">
                        <div className="bg-slate-50 p-3 rounded-xl mb-4 relative min-h-[60px]">
                            <p className="text-xs text-slate-700 font-medium italic leading-relaxed">"{log.content}"</p>
                            <MessageSquare className="absolute -bottom-2 -right-2 text-slate-200 opacity-20" size={32} />
                        </div>
                        
                        <div className="flex flex-wrap gap-2">
                            <div className="px-2 py-1 bg-brand-light text-brand-primary rounded text-[9px] font-black uppercase tracking-tighter shadow-sm">
                            De: {log.driverName || log.from}
                            </div>
                            {(log.vehiclePrefix || getVehicleByPhone(log.from)?.prefix) && (
                            <div className="px-2 py-1 bg-[#fff7ed] text-amber-700 rounded text-[9px] font-black uppercase tracking-tighter border border-amber-100 shadow-sm">
                                Viatura {log.vehiclePrefix || getVehicleByPhone(log.from)?.prefix}
                            </div>
                            )}
                            <div className={cn(
                            "px-2 py-1 rounded text-[9px] font-black uppercase tracking-tighter border shadow-sm",
                            log.status === 'received' ? "bg-green-50 text-green-700 border-green-100" : "bg-blue-50 text-blue-700 border-blue-100"
                            )}>
                            {log.status}
                            </div>
                        </div>
                    </div>
                    </div>
                ))}

                {filteredSms.length === 0 && !loading && (
                   <div className="col-span-full py-20 bg-white rounded-2xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400">
                      <Wifi size={48} className="mb-4 opacity-20" />
                      <p className="font-black uppercase tracking-widest text-xs">Aguardando logs do Gateway Unitel...</p>
                   </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}


