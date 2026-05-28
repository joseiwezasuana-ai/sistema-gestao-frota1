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
  Calendar,
  Map as MapIcon,
  History as HistoryIcon,
  ShieldAlert,
  Shield,
  PhoneCall,
  AlertTriangle,
  Send
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
  writeBatch,
  addDoc,
  updateDoc,
  serverTimestamp
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { format } from 'date-fns';
import WaitingTimer from './WaitingTimer';
import { cn } from '../lib/utils';
import RealTimeMap from './RealTimeMap';
import GPSTimeline from './GPSTimeline';

type MonitorTab = 'psm' | 'unitel' | 'map' | 'gps_timeline' | 'sos';

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
  const [shifts, setShifts] = useState<any[]>([]);

  // S.O.S Alerts monitoring states
  const [panicAlerts, setPanicAlerts] = useState<any[]>([]);
  const [panicSearch, setPanicSearch] = useState('');
  const [panicStatusFilter, setPanicStatusFilter] = useState<'todos' | 'active' | 'resolved'>('todos');
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolutionNotes, setResolutionNotes] = useState('');
  const [resolvingActionLoading, setResolvingActionLoading] = useState(false);
  const [dispatchSmsId, setDispatchSmsId] = useState<string | null>(null);
  const [dispatchContent, setDispatchContent] = useState('');
  const [sendingDispatch, setSendingDispatch] = useState(false);
  const [simulationLoading, setSimulationLoading] = useState(false);

  const isAdmin = user?.role === 'admin';

  // Set first permissible subtab based on user's role
  useEffect(() => {
    if (!user) return;
    const tabsList = [
      { id: 'psm', roles: ['admin', 'operator', 'mecanico'] },
      { id: 'unitel', roles: ['admin', 'operator', 'mecanico'] },
      { id: 'map', roles: ['admin', 'operator', 'mecanico', 'contabilista'] },
      { id: 'gps_timeline', roles: ['admin', 'operator'] },
      { id: 'sos', roles: ['admin', 'operator'] },
    ];
    const isMasterAdmin = user?.email?.toLowerCase() === 'joseiwezasuana@gmail.com';
    const hasPermission = isMasterAdmin || tabsList.find(t => t.id === activeSubTab)?.roles.includes(user?.role);
    if (!hasPermission) {
      const allowed = tabsList.filter(tab => {
        if (isMasterAdmin) return true;
        return tab.roles.includes(user?.role);
      });
      if (allowed.length > 0) {
        setActiveSubTab(allowed[0].id as any);
      }
    }
  }, [user, activeSubTab]);

  useEffect(() => {
    setLoading(true);
    // 1. Listen for calls (PSM Operator)
    let qCalls = query(collection(db, 'calls'), orderBy('timestamp', 'desc'), limit(pageSize));
    
    if (statusFilter !== 'todos' && statusFilter !== 'encaminhada' && activeSubTab === 'psm') {
      let dbStatus = statusFilter;
      if (statusFilter === 'ativo') dbStatus = 'active';
      if (statusFilter === 'concluída') dbStatus = 'completed';
      if (statusFilter === 'cancelada') dbStatus = 'cancelled';

      qCalls = query(
        collection(db, 'calls'), 
        where('status', '==', dbStatus),
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

    // 5. Listen for Panic Alerts (S.O.S Auditoria)
    const qPanic = query(collection(db, 'panic_alerts'), orderBy('timestamp', 'desc'), limit(150));
    const unsubPanic = onSnapshot(qPanic, (snapshot) => {
      setPanicAlerts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'panic_alerts'));

    // 6. Listen for Shifts (Scale)
    const qShifts = query(collection(db, 'driver_scales'), orderBy('date', 'desc'), limit(150));
    const unsubShifts = onSnapshot(qShifts, (snapshot) => {
      setShifts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'driver_scales'));

    return () => {
      unsubCalls();
      unsubSms();
      unsubDrivers();
      unsubMaster();
      unsubPanic();
      unsubShifts();
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
    let targetCollection = '';
    let items: any[] = [];
    let namePt = '';

    if (activeSubTab === 'psm') {
      targetCollection = 'calls';
      items = filteredCalls;
      namePt = 'Chamadas';
    } else if (activeSubTab === 'unitel') {
      targetCollection = 'sms_logs';
      items = filteredSms;
      namePt = 'SMS';
    } else if (activeSubTab === 'sos') {
      targetCollection = 'panic_alerts';
      items = filteredPanics;
      namePt = 'Alertas S.O.S';
    } else {
      return;
    }

    if (!window.confirm(`ATENÇÃO: Deseja apagar TODO o histórico visível de ${namePt}? Esta ação é irreversível.`)) return;
    
    try {
      const batch = writeBatch(db);
      items.forEach(item => {
        batch.delete(doc(db, targetCollection, item.id));
      });
      await batch.commit();
      alert('Histórico limpo com sucesso.');
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, targetCollection);
    }
  };

  const simulePanicAlert = async () => {
    setSimulationLoading(true);
    try {
      const mockDrivers = [
        { name: "Joaquim Suana", phone: "+244923456789", prefix: "TX-104" },
        { name: "Francisco Kilamba", phone: "+244912998877", prefix: "TX-402" },
        { name: "Bartolomeu Moxico", phone: "+244933554411", prefix: "TX-087" },
        { name: "Mateus Iweza", phone: "+244994223311", prefix: "TX-211" }
      ];
      const picked = mockDrivers[Math.floor(Math.random() * mockDrivers.length)];
      
      await addDoc(collection(db, "panic_alerts"), {
        driverId: `sim-id-${Math.floor(Math.random() * 1000)}`,
        driverName: picked.name,
        driverPhone: picked.phone,
        vehiclePrefix: picked.prefix,
        timestamp: new Date(),
        status: "active",
        resolvedAt: null,
        resolvedBy: null,
        notes: "",
        location: { latitude: -11.78 + (Math.random() * 0.04 - 0.02), longitude: 19.90 + (Math.random() * 0.04 - 0.02) }
      });
      alert(`S.O.S Simulado para ${picked.name} (${picked.prefix})!`);
    } catch (e: any) {
      handleFirestoreError(e, OperationType.CREATE, "panic_alerts");
    } finally {
      setSimulationLoading(false);
    }
  };

  const resolveAlert = async (id: string) => {
    setResolvingActionLoading(true);
    try {
      await updateDoc(doc(db, 'panic_alerts', id), {
        status: 'resolved',
        resolvedAt: new Date(),
        resolvedBy: user?.name || user?.email || 'Administrador Central',
        notes: resolutionNotes || 'Ocorrência atendida e resolvida com êxito na central.'
      });
      setResolvingId(null);
      setResolutionNotes('');
      alert('Alerta S.O.S marcado como resolvido e auditado!');
    } catch (e: any) {
      handleFirestoreError(e, OperationType.UPDATE, 'panic_alerts');
    } finally {
      setResolvingActionLoading(false);
    }
  };

  const sendDispatchCommand = async (driverPhone: string, driverName: string, prefix: string) => {
    if (!dispatchContent.trim()) {
      alert("Por favor escreva o comando de socorro / despacho.");
      return;
    }
    setSendingDispatch(true);
    try {
      // 1. Log to SMS logs
      await addDoc(collection(db, 'sms_logs'), {
        from: 'PSM CENTRAL DISPATCH',
        driverName: driverName,
        vehiclePrefix: prefix,
        content: `[CENTRAL PSM S.O.S] ${dispatchContent}`,
        timestamp: new Date(),
        status: 'dispatch_sent',
        toPhone: driverPhone
      });

      // 2. Update the specific active panic_alerts document log
      if (dispatchSmsId) {
        await updateDoc(doc(db, 'panic_alerts', dispatchSmsId), {
          dispatchMessage: dispatchContent,
          dispatchedAt: new Date().toISOString(),
          dispatchStatus: 'despachado'
        });

        // 3. Find the alert item and also notify with a driver-visible message
        const alertObj = panicAlerts.find(a => a.id === dispatchSmsId);
        if (alertObj && alertObj.driverId) {
          await addDoc(collection(db, 'messages'), {
            from: 'PSM CENTRAL DISPATCH',
            category: 'security',
            type: 'danger',
            title: '⚠️ AUXÍLIO S.O.S DESPACHADO',
            content: dispatchContent,
            targets: [alertObj.driverId],
            driverId: alertObj.driverId,
            prefix: prefix,
            status: 'unread',
            timestamp: new Date().toISOString()
          });
        }
      }

      setDispatchSmsId(null);
      setDispatchContent('');
      alert(`Comando de auxílio despachado para ${driverName}!`);
    } catch (e: any) {
      handleFirestoreError(e, OperationType.CREATE, 'sms_logs');
    } finally {
      setSendingDispatch(false);
    }
  };

  const filteredPanics = panicAlerts.filter(p => {
    const term = panicSearch.toLowerCase();
    const matchesSearch = (p.driverName || '').toLowerCase().includes(term) || 
                          (p.vehiclePrefix || '').toLowerCase().includes(term) ||
                          (p.driverPhone || '').includes(term) ||
                          (p.notes || '').toLowerCase().includes(term);
    
    if (panicStatusFilter === 'todos') return matchesSearch;
    return p.status === panicStatusFilter && matchesSearch;
  });

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

  const filteredCalls = calls.filter(c => {
    const matchesSearch = 
      (c.customerName?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
      (c.customerPhone || '').includes(searchTerm) ||
      (c.pickupAddress?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    
    if (!matchesSearch) return false;

    if (statusFilter === 'todos') return true;
    if (statusFilter === 'ativo') return c.status === 'active' || c.status === 'ativo' || c.status === 'em curso';
    if (statusFilter === 'concluída') return c.status === 'completed' || c.status === 'concluída' || c.status === 'finalizada';
    if (statusFilter === 'cancelada') return c.status === 'cancelled' || c.status === 'cancelada' || c.status === 'failed';
    if (statusFilter === 'encaminhada') return c.isForwarded === true || c.type === 'direct_referral' || c.status === 'forwarded' || c.status === 'transferred';

    return true;
  });

  const filteredSms = smsLogs.filter(s => 
    (s.content?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
    (s.from || '').includes(searchTerm)
  );

  const psmStatuses = [
    { id: 'todos', label: 'Todos', icon: Activity },
    { id: 'ativo', label: 'Em Curso', icon: RefreshCcw },
    { id: 'concluída', label: 'Concluídas', icon: CheckCircle2 },
    { id: 'cancelada', label: 'Canceladas', icon: XCircle },
    { id: 'encaminhada', label: 'Encaminhadas', icon: PhoneCall }
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

          <div className="flex flex-wrap bg-slate-800/50 p-1.5 rounded-xl border border-slate-700/50 gap-1.5">
             {[
               { id: 'psm', label: 'Histórico PSM COMERCIAL', icon: Phone, color: 'bg-brand-primary', roles: ['admin', 'operator', 'mecanico'] },
               { id: 'unitel', label: 'Monitoria Taxicontrol', icon: Wifi, color: 'bg-amber-500', roles: ['admin', 'operator', 'mecanico'] },
               { id: 'map', label: 'Geolocalização Live', icon: MapIcon, color: 'bg-indigo-600', roles: ['admin', 'operator', 'mecanico', 'contabilista'] },
               { id: 'gps_timeline', label: 'Auditoria GPS', icon: HistoryIcon, color: 'bg-teal-600', roles: ['admin', 'operator'] },
               { id: 'sos', label: 'Gestão de S.O.S 🚨', icon: ShieldAlert, color: 'bg-rose-700', roles: ['admin', 'operator'] },
             ]
             .filter(tab => {
               const isMasterAdmin = user?.email?.toLowerCase() === 'joseiwezasuana@gmail.com';
               if (isMasterAdmin) return true;
               return tab.roles.includes(user?.role);
             })
             .map((tab) => (
               <button 
                 key={tab.id}
                 onClick={() => { setActiveSubTab(tab.id as any); setStatusFilter('todos'); }}
                 className={cn(
                   "px-4 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all flex items-center gap-2",
                   activeSubTab === tab.id ? `${tab.color} text-white shadow-lg` : "text-slate-400 hover:text-slate-200"
                 )}
               >
                 <tab.icon size={14} /> {tab.label}
               </button>
             ))}
          </div>
        </div>
      </div>

      {/* Control Bar */}
      {(activeSubTab === 'psm' || activeSubTab === 'unitel') && (
        <div className="flex flex-col gap-4">
          <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-4 items-center">
              <div className="relative flex-1 group">
                  <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-brand-primary transition-colors" />
                  <input 
                      type="text" 
                      placeholder={activeSubTab === 'psm' ? "Pesquisar por cliente, telefone..." : "Pesquisar por logs Taxicontrol..."}
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
      )}

      <div className="flex-1 overflow-hidden min-h-0">
        <AnimatePresence mode="wait">
          {activeSubTab === 'psm' && (
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
                            <span className={cn("px-2 py-0.5 rounded text-[9px] font-black uppercase border", 
                              (call.isForwarded || call.type === 'direct_referral' || call.status === 'forwarded')
                                ? 'text-amber-600 bg-amber-50 border-amber-100'
                                : getStatusColor(call.status)
                            )}>
                            {(call.isForwarded || call.type === 'direct_referral' || call.status === 'forwarded') ? 'encaminhada' : call.status}
                            </span>
                            <div className="text-[10px] text-slate-400 font-mono flex items-center gap-1">
                            <Clock size={10} /> {call.timestamp?.toDate ? format(call.timestamp.toDate(), 'HH:mm:ss') : '--:--'}
                            {call.status === 'pending' && <WaitingTimer timestamp={call.timestamp} className="ml-1 text-amber-600 font-black" />}
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
          )}

          {activeSubTab === 'unitel' && (
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

          {activeSubTab === 'map' && (
            <motion.div 
              key="map"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full flex flex-col"
            >
              <RealTimeMap />
            </motion.div>
          )}

          {activeSubTab === 'gps_timeline' && (
            <motion.div 
              key="gps_timeline"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full flex flex-col"
            >
              <GPSTimeline />
            </motion.div>
          )}

          {activeSubTab === 'sos' && (
            <motion.div 
              key="sos"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="h-full flex flex-col space-y-4"
            >
              {/* Upper Section with stats & action */}
              <div className="grid grid-cols-1 lg:grid-cols-4 gap-4 text-left">
                {/* Stats */}
                <div className="bg-red-50 border border-red-200 p-4 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase text-red-500 tracking-widest leading-none">Status Ativo</span>
                    <h4 className="text-2xl font-black text-red-700 leading-none mt-1.5">
                      {panicAlerts.filter(p => p.status === 'active').length}
                    </h4>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-red-600/10 text-red-600 flex items-center justify-center animate-pulse">
                    <ShieldAlert size={20} />
                  </div>
                </div>

                <div className="bg-green-50 border border-green-200 p-4 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase text-green-500 tracking-widest leading-none">Resolvidos</span>
                    <h4 className="text-2xl font-black text-green-700 leading-none mt-1.5">
                      {panicAlerts.filter(p => p.status === 'resolved').length}
                    </h4>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-green-500/10 text-green-600 flex items-center justify-center">
                    <CheckCircle2 size={20} />
                  </div>
                </div>

                <div className="bg-slate-50 border border-slate-200 p-4 rounded-2xl flex items-center justify-between">
                  <div>
                    <span className="text-[10px] font-black uppercase text-slate-400 tracking-widest leading-none">Total Registados</span>
                    <h4 className="text-2xl font-black text-slate-700 leading-none mt-1.5">{panicAlerts.length}</h4>
                  </div>
                  <div className="w-10 h-10 rounded-xl bg-slate-200 text-slate-600 flex items-center justify-center">
                    <HistoryIcon size={20} />
                  </div>
                </div>

                {/* Simulation button */}
                <button
                  onClick={simulePanicAlert}
                  disabled={simulationLoading}
                  className="bg-red-600 hover:bg-red-700 active:scale-[0.98] text-white px-4 py-3 rounded-2xl text-xs font-black uppercase tracking-widest flex items-center justify-center gap-2.5 transition-all shadow-lg shadow-red-200/50"
                >
                  {simulationLoading ? <RefreshCcw size={16} className="animate-spin" /> : <ShieldAlert size={16} className="animate-bounce" />}
                  Simular Alerta S.O.S (Testes)
                </button>
              </div>

              {/* Action and search filters bar */}
              <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col sm:flex-row gap-4 justify-between items-center text-left">
                <div className="relative flex-1 w-full group">
                  <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-red-500 transition-colors" />
                  <input 
                    type="text" 
                    placeholder="Pesquisar por motorista, viatura prefixo, notas..."
                    className="w-full pl-11 pr-4 py-2.5 bg-slate-50 border border-slate-200 rounded-lg text-sm font-medium focus:ring-2 focus:ring-red-500/10 focus:border-red-500 transition-all outline-none"
                    value={panicSearch}
                    onChange={(e) => setPanicSearch(e.target.value)}
                  />
                </div>

                <div className="flex gap-2 w-full sm:w-auto overflow-x-auto no-scrollbar pb-1 sm:pb-0 items-center">
                  {(['todos', 'active', 'resolved'] as const).map((status) => (
                    <button
                      key={status}
                      onClick={() => setPanicStatusFilter(status)}
                      className={cn(
                        "px-4 py-2 rounded-full text-[10px] font-black uppercase tracking-widest border transition-all whitespace-nowrap",
                        panicStatusFilter === status 
                          ? "bg-red-700 text-white border-red-700 shadow-md" 
                          : "bg-white text-slate-500 border-slate-200 hover:border-red-700/30"
                      )}
                    >
                      {status === 'todos' && 'Todos os Alertas'}
                      {status === 'active' && '🚨 Ativos'}
                      {status === 'resolved' && '✅ Resolvidos'}
                    </button>
                  ))}

                  {isAdmin && (
                    <button 
                      onClick={clearHistory}
                      className="flex items-center gap-2 px-4 py-2 text-red-650 bg-red-50 hover:bg-red-100 border border-red-200 rounded-full text-[10px] font-black uppercase tracking-widest transition-all shrink-0"
                      title="Apagar todo o histórico de S.O.S filtrado"
                    >
                      <Trash2 size={12} /> Limpar Tudo
                    </button>
                  )}
                </div>
              </div>

              {/* Panic Alerts list */}
              <div className="flex-1 overflow-y-auto pr-1 pb-10 space-y-4 max-h-[700px]">
                {filteredPanics.map((alertItem) => {
                  const isActive = alertItem.status === 'active';
                  return (
                    <div 
                      key={alertItem.id} 
                      className={cn(
                        "bg-white rounded-2xl border p-5 shadow-sm transition-all relative overflow-hidden flex flex-col md:flex-row gap-6 justify-between items-start md:items-center text-left",
                        isActive ? "border-red-300 bg-red-50/20 shadow-lg shadow-red-100/30 animate-[pulse_3s_infinite]" : "border-slate-200 hover:border-brand-primary/20"
                      )}
                    >
                      {isActive && (
                        <div className="absolute top-0 bottom-0 left-0 w-1.5 bg-red-600 animate-pulse" />
                      )}

                      <div className="space-y-3 flex-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className={cn(
                            "px-2.5 py-1 rounded text-[10px] font-black uppercase tracking-widest border flex items-center gap-1.5",
                            isActive ? "bg-red-600 text-white border-red-600 font-mono text-[9px]" : "bg-emerald-50 text-emerald-700 border-emerald-200"
                          )}>
                            {isActive ? (
                              <>
                                <span className="w-1.5 h-1.5 rounded-full bg-white animate-ping" />
                                PERIGO • DESTAQUE S.O.S
                              </>
                            ) : (
                              'RESOLVIDO & AUDITADO'
                            )}
                          </span>

                          <span className="text-[11px] text-slate-400 font-mono">
                            ID: #{(alertItem.id || '').toUpperCase().slice(-5)}
                          </span>

                          <span className="text-[11px] text-slate-400 font-bold flex items-center gap-1.5">
                            <Clock size={12} />
                            {alertItem.timestamp?.toDate ? format(alertItem.timestamp.toDate(), 'dd/MM/yy HH:mm:ss') : 'Data não informada'}
                          </span>
                        </div>

                        {/* Driver credentials & Taxi Info */}
                        <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-8">
                          <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Motorista em perigo</p>
                            <p className="text-base font-black text-slate-800 leading-tight uppercase mt-0.5">{alertItem.driverName}</p>
                            <a 
                              href={`tel:${alertItem.driverPhone}`} 
                              className="text-xs font-bold text-brand-primary flex items-center gap-1 mt-1 hover:underline"
                            >
                              <PhoneCall size={12} /> {alertItem.driverPhone}
                            </a>
                          </div>

                          <div className="border-l border-slate-200 pl-4 h-9 hidden sm:block" />

                          <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Viatura / Prefixo</p>
                            <span className="inline-block mt-0.5 px-3 py-1 bg-slate-100 border border-slate-200 rounded-lg text-xs font-black text-slate-700">
                              {alertItem.vehiclePrefix || "TX-XXX"}
                            </span>
                          </div>

                          <div className="border-l border-slate-200 pl-4 h-9 hidden sm:block" />

                          <div>
                            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Localização aproximada</p>
                            <div className="flex items-center gap-1.5 text-xs font-bold mt-1 text-slate-600">
                              <MapPin size={13} className="text-brand-primary" />
                              <span>Luena, Moxico</span>
                              {alertItem.location && (
                                <span className="text-[10px] text-slate-400 font-mono">
                                  ({alertItem.location.latitude?.toFixed(4)}, {alertItem.location.longitude?.toFixed(4)})
                                </span>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Resolution notes trail if resolved */}
                        {!isActive && alertItem.resolvedBy && (
                          <div className="bg-slate-50 border border-slate-200/50 rounded-xl p-3 text-left">
                            <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Relatório da Resolução:</p>
                            <p className="text-xs font-medium text-slate-700 mt-1 italic leading-relaxed">
                              "{alertItem.notes || 'Sem comentários adicionais.'}"
                            </p>
                            <div className="flex items-center gap-1.5 mt-2 text-[10px] font-black text-slate-400 uppercase tracking-wider">
                              <span>Processado por: {alertItem.resolvedBy}</span>
                              {alertItem.resolvedAt?.toDate && (
                                <>
                                  <span className="w-1 h-1 rounded-full bg-slate-300" />
                                  <span>Concluído em: {format(alertItem.resolvedAt.toDate(), 'dd/MM/yy HH:mm:ss')}</span>
                                </>
                              )}
                            </div>
                          </div>
                        )}
                      </div>

                      {/* Quick Actions Panel */}
                      <div className="flex flex-wrap md:flex-col gap-2 w-full md:w-auto md:min-w-[200px] pt-4 md:pt-0 border-t md:border-t-0 md:border-l border-slate-200 md:pl-6">
                        <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest w-full text-left md:text-right hidden md:block">
                          Ações de Resgate
                        </p>

                        <a
                          href={`tel:${alertItem.driverPhone}`}
                          className="flex-1 md:flex-none py-2.5 px-4 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-800 transition-all flex items-center justify-center gap-2 text-center"
                        >
                          <Phone size={12} /> Chamar GSM
                        </a>

                        {isActive ? (
                          <>
                            <button
                              onClick={() => {
                                setDispatchSmsId(alertItem.id);
                                setDispatchContent(`Mestre ${alertItem.driverName}, recebemos o seu pedido de S.O.S na central PSM e equipe de emergência está a caminho.`);
                              }}
                              className="flex-[2] md:flex-none py-2.5 px-4 bg-[#b45309] text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-[#92400e] transition-all flex items-center justify-center gap-2"
                            >
                              <Send size={12} /> Despachar Socorro
                            </button>

                            <button
                              onClick={() => {
                                setResolvingId(alertItem.id);
                                setResolutionNotes('Problema solucionado com sucesso pela central operativa PSM.');
                              }}
                              className="flex-1 md:flex-none py-2.5 px-4 bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-emerald-700 transition-all flex items-center justify-center gap-2"
                            >
                              <CheckCircle2 size={12} /> Marcar Resolvido
                            </button>
                          </>
                        ) : (
                          <div className="flex items-center gap-1 text-emerald-600 text-[10px] font-black uppercase tracking-widest justify-center">
                            <CheckCircle2 size={14} /> Resolvido e Seguro
                          </div>
                        )}

                        {isAdmin && (
                          <button
                            onClick={() => deleteLog('panic_alerts', alertItem.id)}
                            className="w-full py-2 bg-red-50 hover:bg-red-100 text-red-650 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-1.5 transition-colors mt-1 border border-red-100"
                            title="Eliminar este alerta do histórico permanentemente"
                          >
                            <Trash2 size={11} /> Excluir Registro
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}

                {filteredPanics.length === 0 && (
                  <div className="py-20 bg-white rounded-2xl border border-dashed border-slate-200 flex flex-col items-center justify-center text-slate-400">
                    <Shield size={48} className="mb-4 opacity-10" />
                    <p className="font-black uppercase tracking-widest text-xs">Sem registos S.O.S pendentes nesta auditoria</p>
                  </div>
                )}
              </div>

              {/* Resolution Input Slide Dialog */}
              <AnimatePresence>
                {resolvingId && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                  >
                    <motion.div 
                      initial={{ scale: 0.95 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0.95 }}
                      className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-100 shadow-2xl space-y-4"
                    >
                      <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                        <div className="w-10 h-10 rounded-xl bg-orange-100 text-orange-600 flex items-center justify-center">
                          <CheckCircle2 size={20} />
                        </div>
                        <div className="text-left">
                          <h4 className="text-sm font-black text-slate-800 uppercase">Tratar Alerta de Emergência</h4>
                          <p className="text-[10px] text-slate-400 uppercase tracking-widest">Insira os detalhes e notas da intervenção</p>
                        </div>
                      </div>

                      <div className="text-left">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">Notas de Auditoria da Resolução</label>
                        <textarea
                          className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-medium focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary outline-none"
                          rows={4}
                          placeholder="Ex: Motorista teve um pneu furado em zona sem sinal, assistência foi despachada para o local e viatura já regressou ao serviço com segurança."
                          value={resolutionNotes}
                          onChange={(e) => setResolutionNotes(e.target.value)}
                        />
                      </div>

                      <div className="flex gap-2">
                        <button
                          onClick={() => setResolvingId(null)}
                          className="flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-colors"
                        >
                          Cancelar
                        </button>
                        <button
                          onClick={() => resolveAlert(resolvingId)}
                          disabled={resolvingActionLoading}
                          className="flex-1 py-2 bg-emerald-600 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-700 transition-colors flex items-center justify-center gap-2"
                        >
                          {resolvingActionLoading ? <RefreshCcw size={12} className="animate-spin" /> : <CheckCircle2 size={12} />}
                          Salvar Resolução
                        </button>
                      </div>
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Dispatch Command dialog */}
              <AnimatePresence>
                {dispatchSmsId && (
                  <motion.div 
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    exit={{ opacity: 0 }}
                    className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4"
                  >
                    <motion.div 
                      initial={{ scale: 0.95 }}
                      animate={{ scale: 1 }}
                      exit={{ scale: 0.95 }}
                      className="bg-white rounded-3xl p-6 max-w-md w-full border border-slate-100 shadow-2xl space-y-4"
                    >
                      {(() => {
                        const alertObj = panicAlerts.find(a => a.id === dispatchSmsId);
                        if (!alertObj) return null;
                        return (
                          <>
                            <div className="flex items-center gap-3 border-b border-slate-100 pb-3">
                              <div className="w-10 h-10 rounded-xl bg-red-100 text-red-600 flex items-center justify-center">
                                <Send size={20} />
                              </div>
                              <div className="text-left">
                                <h4 className="text-sm font-black text-slate-800 uppercase">Comando de Socorro Recíproco</h4>
                                <p className="text-[10px] text-slate-400 uppercase tracking-widest">Enviar Instruções para {alertObj.driverName}</p>
                              </div>
                            </div>

                            <div className="text-left">
                              <label className="text-[10px] font-black text-slate-400 uppercase tracking-wider block mb-1">SMS / Mensagem a Enviar para o Motorista</label>
                              <textarea
                                className="w-full bg-slate-50 border border-slate-200 rounded-xl p-3 text-xs font-medium focus:ring-2 focus:ring-brand-primary/10 focus:border-brand-primary outline-none"
                                rows={4}
                                value={dispatchContent}
                                onChange={(e) => setDispatchContent(e.target.value)}
                              />
                            </div>

                            <div className="flex gap-2">
                              <button
                                onClick={() => setDispatchSmsId(null)}
                                className="flex-1 py-2 rounded-xl text-xs font-black uppercase tracking-widest text-slate-500 hover:bg-slate-50 transition-colors"
                              >
                                Cancelar
                              </button>
                              <button
                                onClick={() => sendDispatchCommand(alertObj.driverPhone, alertObj.driverName, alertObj.vehiclePrefix)}
                                disabled={sendingDispatch}
                                className="flex-1 py-2 bg-brand-primary text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-brand-primary-hover transition-colors flex items-center justify-center gap-2"
                              >
                                {sendingDispatch ? <RefreshCcw size={12} className="animate-spin" /> : <Send size={12} />}
                                Enviar Comando S.O.S
                              </button>
                            </div>
                          </>
                        );
                      })()}
                    </motion.div>
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}


