import React, { useState, useEffect, useMemo } from 'react';
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
  Car,
  Map,
  MapPin,
  AlertCircle,
  TrendingUp,
  Clock,
  ShieldAlert,
  Users,
  Calculator,
  MessageSquare,
  Smartphone,
  Monitor,
  Calendar as CalendarIcon,
  Plus,
  Zap,
  Sparkles,
  FileText,
  RefreshCw,
  Settings as SettingsIcon,
  Wrench
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { geminiService } from '../services/geminiService';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { WhatsAppMonitor } from "./WhatsAppMonitor";
import { checkPendingIncome } from '../services/shiftCheckService';
import RealTimeMap from "./RealTimeMap";
import WaitingTimer from './WaitingTimer';
import Settings from "./Settings";
import UserManual from "./UserManual";
import { collection, query, orderBy, onSnapshot, where, limit } from 'firebase/firestore';

interface StaffMobileViewProps {
  user: any;
  onLogout: () => void;
  onExitMobile?: () => void;
}

const STAFF_PALETTES = {
  gold: {
    name: 'Sunset Gold',
    color: '#f59e0b',
    vars: {
      '--color-brand-primary': '#f59e0b',
      '--color-brand-secondary': '#d97706',
    }
  },
  blue: {
    name: 'Ocean Breeze',
    color: '#3b82f6',
    vars: {
      '--color-brand-primary': '#3b82f6',
      '--color-brand-secondary': '#2563eb',
    }
  },
  cyberpunk: {
    name: 'Neon Cyber',
    color: '#d946ef',
    vars: {
      '--color-brand-primary': '#d946ef',
      '--color-brand-secondary': '#c026d3',
      '--color-slate-950': '#0a0a0a',
      '--color-slate-900': '#171717',
      '--color-slate-800': '#262626',
    }
  },
  emerald: {
    name: 'Emerald Classic',
    color: '#10b981',
    vars: {
      '--color-brand-primary': '#10b981',
      '--color-brand-secondary': '#059669',
      '--color-slate-950': '#09090b',
      '--color-slate-900': '#18181b',
      '--color-slate-800': '#27272a',
    }
  },
  default: {
    name: 'Corporate Blue',
    color: '#2563EB',
    vars: {}
  }
};

export default function StaffMobileView({ user, onLogout, onExitMobile }: StaffMobileViewProps) {
  const [activePalette, setActivePalette] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('psm-staff-theme') || 'default';
    }
    return 'default';
  });

  const handlePaletteChange = (pal: string) => {
    setActivePalette(pal);
    localStorage.setItem('psm-staff-theme', pal);
  };

  const [activeTab, setActiveTab] = useState<'dashboard' | 'fleet' | 'ops' | 'wallet' | 'scales' | 'map' | 'whatsapp'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('staff_mobile_active_tab');
      if (saved && ['dashboard', 'fleet', 'ops', 'wallet', 'scales', 'map', 'whatsapp'].includes(saved)) {
        if (saved === 'scales') {
          return 'fleet';
        }
        return saved as any;
      }
    }
    return 'dashboard';
  });

  const [vehicles, setVehicles] = useState<any[]>([]);
  const [calls, setCalls] = useState<any[]>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('staff_cached_calls');
      return saved ? JSON.parse(saved) : [];
    }
    return [];
  });
  const [revenueLogs, setRevenueLogs] = useState<any[]>([]);
  const [isScaleModalOpen, setIsScaleModalOpen] = useState(false);

  useEffect(() => {
    localStorage.setItem('staff_mobile_active_tab', activeTab === 'scales' ? 'fleet' : activeTab);
  }, [activeTab]);

  useEffect(() => {
    const checkStatus = async () => {
      if (user && user.uid) {
        const hasPending = await checkPendingIncome(user.uid);
        if (hasPending) {
          alert('Atenção: A sua renda do dia anterior está pendente de validação. Contacte a central para continuar.');
        }
      }
    };
    checkStatus();
  }, [user]);

  const [fleetSubTab, setFleetSubTab] = useState<'vehicles' | 'scales'>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('fleet_sub_tab');
      if (saved && ['vehicles', 'scales'].includes(saved)) {
        return saved as any;
      }
    }
    return 'vehicles';
  });

  useEffect(() => {
    localStorage.setItem('fleet_sub_tab', fleetSubTab);
  }, [fleetSubTab]);

  const [editingScale, setEditingScale] = useState<any | null>(null);
  const [isEditScaleModalOpen, setIsEditScaleModalOpen] = useState(false);
  const [vehicleSearch, setVehicleSearch] = useState('');

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isWhatsAppOpen, setIsWhatsAppOpen] = useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [loading, setLoading] = useState(false); // Start false to allow immediate render
  const [dataReady, setDataReady] = useState({
    vehicles: false,
    calls: false,
    rev: false
  });
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [selectedRequest, setSelectedRequest] = useState<any>(null);
  const [assigningLoading, setAssigningLoading] = useState(false);
  const [prevCallCount, setPrevCallCount] = useState(0);
  const [showNewCallPulse, setShowNewCallPulse] = useState(false);

  // Memoized stats calculation for better performance
  const derivedStats = useMemo(() => {
    const missed = (calls || []).filter((c: any) => c.status === 'pending' || c.type === 'missed').length;
    const received = (calls || []).filter((c: any) => c.status === 'completed' || c.type === 'received').length;
    const forwarded = (calls || []).filter((c: any) => c.type === 'forwarded' || c.type === 'direct_forward').length;
    
    return {
      missed,
      received,
      forwarded
    };
  }, [calls]);

  useEffect(() => {
    if (calls.length > prevCallCount && prevCallCount > 0) {
      setShowNewCallPulse(true);
      const timer = setTimeout(() => setShowNewCallPulse(false), 3000);
      return () => clearTimeout(timer);
    }
    setPrevCallCount(calls.length);
  }, [calls.length]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [driversMaster, setDriversMaster] = useState<any[]>([]);
  const [vehiclesMaster, setVehiclesMaster] = useState<any[]>([]);
  const [psmPhones, setPsmPhones] = useState<any[]>([]);
  const [panicAlertsList, setPanicAlertsList] = useState<any[]>([]);
  const [isAlertsDrawerOpen, setIsAlertsDrawerOpen] = useState(false);
  const [opsSubTab, setOpsSubTab] = useState<'gateway' | 'map' | 'whatsapp'>('gateway');
  
  const [stats, setStats] = useState({
    activeVehicles: 0,
    missedCalls: 0,
    receivedCalls: 0,
    forwardedCalls: 0,
    panicAlerts: 0,
    totalRevenue: 0
  });

  const filteredVehicles = vehicles.filter((v: any) => {
    if (!v) return false;
    const searchLower = vehicleSearch.toLowerCase();
    return (
      (v.name || '').toLowerCase().includes(searchLower) ||
      (v.prefix || '').toLowerCase().includes(searchLower) ||
      (v.plate || '').toLowerCase().includes(searchLower)
    );
  });

  const [scaleFormData, setScaleFormData] = useState({
    driverId: '',
    driverName: '',
    prefix: '',
    date: new Date().toISOString().split('T')[0],
    shift: 'Diurno' as 'Diurno' | 'Nocturno' | '24h',
    status: 'Ativo' as 'Ativo' | 'Folga' | 'Suspenso',
    phone: '',
    secondaryPhone: ''
  });

  // Approve Revenue Handler
  const handleApproveRevenue = async (revenue: any) => {
    try {
      const { doc, updateDoc, collection, query, where, getDocs, deleteDoc, addDoc } = await import('firebase/firestore');
      const docRef = doc(db, 'revenue_logs', revenue.id);
      
      let newStatus = 'approved_by_operator';
      if (user.role === 'admin' || user.role === 'gerente') {
        newStatus = 'approved_by_accountant';
      } else if (user.role === 'contabilista') {
        newStatus = 'finalized';
      }
      
      await updateDoc(docRef, {
        status: newStatus,
        validatedAt: new Date().toISOString(),
        validatedBy: user.uid || 'mobile',
        validatedByName: user.name || 'Operador Mobile'
      });

      // Unbind driver
      const q = query(collection(db, 'drivers'), where('driverId', '==', revenue.driverId));
      const snap = await getDocs(q);
      if (!snap.empty) {
        for (const d of snap.docs) {
          await deleteDoc(doc(db, 'drivers', d.id));
        }
      } else if (revenue.driverName) {
        const qByName = query(collection(db, 'drivers'), where('name', '==', revenue.driverName));
        const snapByName = await getDocs(qByName);
        for (const d of snapByName.docs) {
          await deleteDoc(doc(db, 'drivers', d.id));
        }
      }

      // Notify driver of approval
      if (revenue.driverId) {
        await addDoc(collection(db, 'messages'), {
          type: 'success',
          category: 'revenue_approval',
          title: 'Renda Aprovada (Mobile)',
          content: `A sua renda do dia ${revenue.date} foi validada com sucesso via mobile. Obrigado!`,
          targets: [revenue.driverId],
          driverId: revenue.driverId || 'N/A',
          prefix: revenue.prefix || 'N/A',
          status: 'unread',
          timestamp: new Date().toISOString()
        });
      }

      alert(`Renda do motorista ${revenue.driverName || 'N/A'} aprovada com sucesso!`);
    } catch (err: any) {
      console.error("Error approving revenue on mobile:", err);
      alert("Erro ao aprovar renda: " + err.message);
    }
  };

  // Manage Rosters/Scales Handlers
  const handleUpdateScaleStatus = async (status: 'Ativo' | 'Folga' | 'Suspenso') => {
    if (!editingScale) return;
    try {
      const { doc, updateDoc, serverTimestamp, collection, query, where, getDocs, deleteDoc, addDoc } = await import('firebase/firestore');
      await updateDoc(doc(db, 'driver_scales', editingScale.id), {
        status,
        updatedAt: serverTimestamp()
      });

      // Synchronize driver status with real-time fleet ('drivers' collection)
      const q = query(collection(db, 'drivers'), where('driverId', '==', editingScale.driverId));
      const snap = await getDocs(q);

      if (status === 'Ativo') {
        if (!snap.empty) {
          for (const d of snap.docs) {
            await updateDoc(doc(db, 'drivers', d.id), {
              status: 'disponível',
              prefix: editingScale.prefix,
              updatedAt: new Date().toISOString()
            });
          }
        } else {
          // Add them back to active fleet if they were not there
          const driverDetail = driversMaster.find(dr => dr.id === editingScale.driverId);
          const vehicleDetail = vehiclesMaster.find(v => v.prefix === editingScale.prefix);
          await addDoc(collection(db, 'drivers'), {
            name: driverDetail?.name || editingScale.driverName || '',
            phone: editingScale.phone || driverDetail?.phone || '',
            secondaryPhone: editingScale.secondaryPhone || driverDetail?.secondaryPhone || '',
            prefix: editingScale.prefix,
            plate: vehicleDetail?.plate || '',
            trackerId: vehicleDetail?.trackerId || '',
            driverId: editingScale.driverId,
            status: 'disponível',
            gps: 'Signal Good',
            lat: -11.7833, // Luena
            lng: 19.9167,
            batteryLevel: 100,
            recentCalls: [],
            rendaStatus: 'pending',
            callCount: 0,
            updatedAt: new Date().toISOString()
          });
        }
      } else {
        // 'Folga' or 'Suspenso' -> Remove them from the active live fleet (drivers collection)
        if (!snap.empty) {
          for (const d of snap.docs) {
            await deleteDoc(doc(db, 'drivers', d.id));
          }
        } else if (editingScale.driverName) {
          const qByName = query(collection(db, 'drivers'), where('name', '==', editingScale.driverName));
          const snapByName = await getDocs(qByName);
          for (const d of snapByName.docs) {
            await deleteDoc(doc(db, 'drivers', d.id));
          }
        }
      }

      alert(`Status da escala de ${editingScale.driverName} atualizado para ${status}!`);
      setIsEditScaleModalOpen(false);
      setEditingScale(null);
    } catch (err: any) {
      console.error(err);
      alert("Erro ao atualizar status: " + err.message);
    }
  };

  const handleUpdateScaleShift = async (shift: 'Diurno' | 'Nocturno' | '24h') => {
    if (!editingScale) return;
    try {
      const { doc, updateDoc, serverTimestamp } = await import('firebase/firestore');
      await updateDoc(doc(db, 'driver_scales', editingScale.id), {
        shift,
        updatedAt: serverTimestamp()
      });
      alert(`Turno de ${editingScale.driverName} atualizado para ${shift}!`);
      setIsEditScaleModalOpen(false);
      setEditingScale(null);
    } catch (err: any) {
      console.error(err);
      alert("Erro ao atualizar turno: " + err.message);
    }
  };

  const handleDeleteScale = async () => {
    if (!editingScale) return;
    if (!window.confirm(`Tem a certeza que deseja excluir a escala de ${editingScale.driverName}?`)) return;
    try {
      const { doc, deleteDoc, collection, query, where, getDocs } = await import('firebase/firestore');
      
      // Also unbind driver from active fleet when scale is deleted
      const q = query(collection(db, 'drivers'), where('driverId', '==', editingScale.driverId));
      const snap = await getDocs(q);
      for (const d of snap.docs) {
        await deleteDoc(doc(db, 'drivers', d.id));
      }

      await deleteDoc(doc(db, 'driver_scales', editingScale.id));
      alert("Escala excluída com sucesso!");
      setIsEditScaleModalOpen(false);
      setEditingScale(null);
    } catch (err: any) {
      console.error(err);
      alert("Erro ao excluir escala: " + err.message);
    }
  };

  useEffect(() => {
    // Listen for vehicles
    const unsubVehicles = onSnapshot(collection(db, 'drivers'), (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setVehicles(docs);
      const active = docs.filter((d: any) => 
        ['available', 'ativo', 'disponível', 'disponivel', 'busy', 'ocupado', 'em serviço', 'em servico', 'em curso'].includes(d.status?.toLowerCase())
      ).length;
      setStats(prev => ({ ...prev, activeVehicles: active }));
      setDataReady(prev => ({ ...prev, vehicles: true }));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'drivers'));

    // Listen for calls - High Priority Snapshot
    const qCalls = query(collection(db, 'calls'), orderBy('timestamp', 'desc'), limit(25));
    const unsubCalls = onSnapshot(qCalls, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setCalls(docs);
      localStorage.setItem('staff_cached_calls', JSON.stringify(docs));
      setDataReady(prev => ({ ...prev, calls: true }));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'calls'));

    // Panic Alerts
    const qPanic = query(collection(db, 'panic_alerts'), where('status', '==', 'active'));
    const unsubPanic = onSnapshot(qPanic, (snapshot) => {
      const activePanics = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPanicAlertsList(activePanics);
      setStats(prev => ({ ...prev, panicAlerts: snapshot.size }));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'panic_alerts'));

    // Listen for Revenue
    const qRev = query(collection(db, 'revenue_logs'), orderBy('timestamp', 'desc'), limit(30));
    const unsubRev = onSnapshot(qRev, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setRevenueLogs(docs);
      const today = new Date().toISOString().split('T')[0];
      const todayTotal = docs
        .filter((d: any) => d.date === today)
        .reduce((acc: number, curr: any) => acc + (curr.amount || 0), 0);
      setStats(prev => ({ ...prev, totalRevenue: todayTotal }));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'revenue_logs'));

    // Listen for Scales
    const qScales = query(collection(db, 'driver_scales'), orderBy('date', 'desc'), limit(20));
    const unsubScales = onSnapshot(qScales, (snapshot) => {
      setShifts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    // Masters for Modal
    const qDM = collection(db, 'drivers_master');
    const unsubDM = onSnapshot(qDM, (snap) => setDriversMaster(snap.docs.map(d => ({ id: d.id, ...d.data() }))));
    
    const qVM = collection(db, 'master_vehicles');
    const unsubVM = onSnapshot(qVM, (snap) => setVehiclesMaster(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    const qPhones = query(collection(db, 'psm_phones'), orderBy('label', 'asc'));
    const unsubPhones = onSnapshot(qPhones, (snap) => setPsmPhones(snap.docs.map(d => ({ id: d.id, ...d.data() }))));

    return () => {
      unsubVehicles();
      unsubCalls();
      unsubPanic();
      unsubRev();
      unsubScales();
      unsubDM();
      unsubVM();
      unsubPhones();
    };
  }, []);

  const getDriverPhone = (driverId: string, driverName?: string, prefix?: string, alertPhone?: string) => {
    if (alertPhone) return alertPhone;

    // 1. Try to find in driversMaster by UID or ID
    let match = driversMaster.find(d => d.id === driverId || d.uid === driverId);
    if (match && match.phone) return match.phone;

    // 2. Try to find in driversMaster by name
    if (driverName) {
      match = driversMaster.find(d => d.name?.toLowerCase() === driverName.toLowerCase());
      if (match && match.phone) return match.phone;
    }

    // 3. Try to find in vehicles (drivers active list) by driverId, ID, prefix or name
    let vMatch = vehicles.find(v => v.id === driverId || v.driverId === driverId);
    if (vMatch && vMatch.phone) return vMatch.phone;

    if (prefix && prefix !== 'N/A') {
      vMatch = vehicles.find(v => v.prefix === prefix);
      if (vMatch && vMatch.phone) return vMatch.phone;
    }

    if (driverName) {
      vMatch = vehicles.find(v => v.name?.toLowerCase() === driverName.toLowerCase());
      if (vMatch && vMatch.phone) return vMatch.phone;
    }

    return '';
  };

  const handleAssignDriver = async (requestId: string, driver: any) => {
    setAssigningLoading(true);
    try {
      const { doc, updateDoc } = await import('firebase/firestore');
      // Determine if this is a taxi_request (from ops/monitor) or a direct call
      // Direct referral info usually suggests it's a call
      const isCall = selectedRequest?.type === 'direct_referral' || !selectedRequest?.status || selectedRequest?.customerPhone;
      const collectionName = isCall ? 'calls' : 'taxi_requests';
      
      await updateDoc(doc(db, collectionName, requestId), {
        status: 'accepted',
        driverId: driver.id,
        driverName: driver.name,
        driverInfo: {
          name: driver.name,
          phone: driver.phone || driver.phoneNumber || '',
          vehicleModel: driver.vehicleModel || driver.brand || 'Táxi PSM',
          vehiclePlate: driver.vehiclePlate || driver.licensePlate || '',
          prefix: driver.prefix || ''
        }
      });
      setIsAssignModalOpen(false);
      setSelectedRequest(null);
    } catch (err) {
      console.error("Error assigning driver:", err);
      alert("Erro ao atribuir motorista.");
    } finally {
      setAssigningLoading(false);
    }
  };

  const menuItems = [
    { icon: LayoutDashboard, label: 'Painel Central', onClick: () => setActiveTab('dashboard') },
    { icon: Activity, label: 'Monitores Live', onClick: () => setActiveTab('ops') },
    { icon: Truck, label: 'Gestão de Frota', onClick: () => { setActiveTab('fleet'); setFleetSubTab('vehicles'); } },
    { icon: CalendarIcon, label: 'Escalas & Turnos', onClick: () => { setActiveTab('fleet'); setFleetSubTab('scales'); } },
    { icon: Wallet, label: 'Financeiro', onClick: () => setActiveTab('wallet') },
    ...(onExitMobile ? [{ icon: Monitor, label: 'Restaurar Painel Full', onClick: onExitMobile, color: 'text-brand-primary' }] : []),
    ...((user?.role === 'admin' || user?.role === 'gerente' || user?.role === 'operator') ? [{ icon: SettingsIcon, label: 'Definições', onClick: () => setIsSettingsOpen(true) }] : []),
    { icon: FileText, label: 'Documentação', onClick: () => setIsManualOpen(true) },
    { icon: MessageSquare, label: 'Comunicações', onClick: () => {} },
    { icon: LogOut, label: 'Terminar Sessão', onClick: onLogout, color: 'text-red-500' },
  ];

  const getStatusColor = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'available': case 'ativo': case 'disponível': case 'disponivel': return 'bg-emerald-500';
      case 'busy': case 'ocupado': case 'em serviço': case 'em servico': case 'em curso': return 'bg-amber-500';
      case 'offline': case 'inativo': case 'indisponível': case 'indisponivel': return 'bg-red-500';
      default: return 'bg-slate-400';
    }
  };

  const [aiInsights, setAiInsights] = useState<string>('Analizando dados operacionais...');
  const [isAiLoading, setIsAiLoading] = useState(false);

  // Fetch AI Insights
  const fetchAiInsights = async () => {
    if (isAiLoading) return; // Prevent concurrent requests
    setIsAiLoading(true);
    try {
      const insights = await geminiService.getFleetInsights(stats);
      setAiInsights(insights);
    } catch (error) {
      console.error("AI Insight Error:", error);
      setAiInsights("Falha ao gerar insights técnicos em tempo real.");
    } finally {
      setIsAiLoading(false);
    }
  };

// useEffect(() => {
  //   if (activeTab === 'dashboard' && stats.receivedCalls > 0) {
  //     const timer = setTimeout(fetchAiInsights, 2000);
  //     return () => clearTimeout(timer);
  //   }
  // }, [activeTab, stats.activeVehicles]);

  return (
    <div 
      className="flex flex-col h-[100dvh] bg-slate-950 text-slate-100 overflow-hidden font-sans transition-colors duration-300"
      style={STAFF_PALETTES[activePalette as keyof typeof STAFF_PALETTES]?.vars as any}
    >
      {/* Mobile Top Header */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 sm:px-6 py-4 flex items-center justify-between shadow-lg relative z-20 transition-colors duration-300">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 bg-brand-primary rounded-xl flex items-center justify-center text-white shadow-lg rotate-3 shadow-brand-primary/25 shrink-0 transition-colors duration-300">
             <span className="text-lg sm:text-xl font-black italic">PS</span>
          </div>
          <div className="min-w-0 pr-2">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-[10px] font-black text-slate-500 uppercase tracking-widest leading-none truncate">Módulo Mobile</h1>
              <div className="flex gap-1">
                {(Object.keys(STAFF_PALETTES)).map(key => (
                  <button 
                    key={key}
                    onClick={() => handlePaletteChange(key)}
                    className={`w-3 h-3 rounded-full border border-white/20 hover:scale-110 active:scale-95 transition-transform ${activePalette === key ? 'ring-2 ring-white/50 scale-110' : ''}`}
                    style={{ backgroundColor: STAFF_PALETTES[key as keyof typeof STAFF_PALETTES].color }}
                    title={STAFF_PALETTES[key as keyof typeof STAFF_PALETTES].name}
                  />
                ))}
              </div>
            </div>
            <p className="text-[10px] sm:text-xs font-black text-white uppercase tracking-tight italic truncate">
              {(user.role === 'admin' || user.role === 'gerente') ? 'Administrador Geral' : user.role === 'contabilista' ? 'Hub Contabilidade' : 'Operador de Campo'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 sm:gap-3 shrink-0">
          {onExitMobile && (
            <button 
              onClick={onExitMobile}
              className="w-10 h-10 bg-brand-primary/10 rounded-lg flex items-center justify-center text-brand-primary border border-brand-primary/20"
              title="Restaurar Painel Completo"
            >
              <Monitor size={20} />
            </button>
          )}
          <button 
            onClick={() => setIsAlertsDrawerOpen(true)}
            className="w-10 h-10 bg-slate-800/80 rounded-lg flex items-center justify-center text-slate-400 hover:text-white border border-slate-700/50 relative"
            title="Sino de Alertas"
          >
            <Bell size={20} />
            {(stats.missedCalls > 0 || stats.panicAlerts > 0) && (
              <span className="absolute top-2 right-2 w-2.5 h-2.5 bg-red-500 rounded-full border-2 border-slate-900 animate-pulse" />
            )}
          </button>
          {user.role !== 'contabilista' && (
              <button 
                onClick={() => setIsWhatsAppOpen(true)}
                className="w-10 h-10 bg-slate-800/80 rounded-lg flex items-center justify-center text-emerald-400 border border-slate-700/50"
              >
                <MessageSquare size={20} />
              </button>
          )}
          <button 
            onClick={() => setIsMenuOpen(true)}
            className="w-10 h-10 bg-slate-800/80 rounded-lg flex items-center justify-center text-white border border-slate-700/50"
          >
            <Menu size={24} />
          </button>
        </div>
      </header>
      
      <AnimatePresence>
        {isWhatsAppOpen && (
          <div className="fixed inset-0 z-[60] flex items-end p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsWhatsAppOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
            />
            <motion.div
              initial={{ y: 300, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 300, opacity: 0 }}
              className="relative w-full bg-white rounded-[2.5rem] p-6 space-y-6 shadow-2xl z-20 flex flex-col h-[98%] max-h-[98%]"
            >
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <h2 className="text-xl font-black uppercase tracking-tighter">Central WhatsApp</h2>
                <button onClick={() => setIsWhatsAppOpen(false)} className="p-2 hover:bg-slate-100 rounded-full">
                  <X size={20} />
                </button>
              </div>
              <WhatsAppMonitor isMechanicView={false} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>
      
      <AnimatePresence>
        {isSettingsOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <div className="bg-white text-slate-900 w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-black uppercase tracking-tighter">Definições</h2>
                <button onClick={() => setIsSettingsOpen(false)} className="p-2 hover:bg-slate-100 rounded-full">
                  <X size={20} />
                </button>
              </div>
              <Settings />
            </div>
          </motion.div>
        )}

        {isManualOpen && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[110] bg-slate-900/50 backdrop-blur-sm flex items-center justify-center p-4"
          >
            <div className="bg-white text-slate-900 w-full max-w-4xl max-h-[90vh] overflow-y-auto rounded-3xl shadow-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-black uppercase tracking-tighter">Documentação</h2>
                <button onClick={() => setIsManualOpen(false)} className="p-2 hover:bg-slate-100 rounded-full">
                  <X size={20} />
                </button>
              </div>
              <UserManual />
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Content Area */}
      <main className="flex-1 overflow-y-auto p-5 custom-scrollbar pb-24 bg-slate-950">
        {activeTab === 'dashboard' && (
          <div className="space-y-6">
            {/* Alertas de Pânico Ativos com botão de chamada direta */}
            {panicAlertsList.length > 0 && (
              <div className="space-y-3">
                <h3 className="text-[10px] font-black text-rose-500 uppercase tracking-widest px-1 flex items-center gap-2 animate-bounce">
                  <ShieldAlert size={14} /> Alertas de Pânico S.O.S Ativos ({panicAlertsList.length})
                </h3>
                <div className="space-y-3">
                  {panicAlertsList.map(alert => {
                    const phone = getDriverPhone(alert.driverId, alert.driverName, alert.prefix, alert.driverPhone || alert.phone);
                    return (
                      <motion.div 
                        key={alert.id}
                        initial={{ scale: 0.95, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-rose-950/40 border border-rose-800/80 p-4 rounded-3xl flex items-center justify-between shadow-lg shadow-rose-900/10"
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-10 h-10 bg-rose-600 text-white rounded-2xl flex items-center justify-center animate-pulse shadow-lg">
                            <Truck size={20} />
                          </div>
                          <div>
                            <p className="text-xs font-black text-rose-200 uppercase tracking-tight font-sans">SOS: Viatura {alert.prefix || 'N/A'}</p>
                            <p className="text-[9px] text-rose-400 font-bold uppercase tracking-widest leading-none mt-1">{alert.driverName || 'Motorista Central'}</p>
                          </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {phone ? (
                            <a 
                              href={`tel:${phone}`}
                              className="flex items-center gap-1.5 px-3 py-2.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-md font-mono"
                            >
                              <Phone size={11} fill="currentColor" />
                              Ligar Já
                            </a>
                          ) : (
                            <span className="text-[8px] font-bold text-slate-500 uppercase tracking-widest italic">S/ Telefone</span>
                          )}
                          <button 
                            onClick={() => {
                              setActiveTab('ops');
                              setOpsSubTab('map');
                            }}
                            className="p-2.5 bg-slate-800 hover:bg-slate-700 text-rose-500 border border-slate-700/50 rounded-xl transition-all flex items-center justify-center cursor-pointer active:scale-95"
                            title="Localizar no Mapa"
                          >
                            <Map size={14} />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Top Operational status shortcuts requested by JIS */}
            <div className="space-y-4">
              {/* Live Status Card: Controlo Geral 24H Ativo */}
              <div id="live-status-card-top" className="bg-slate-900 rounded-[2rem] p-6 text-white shadow-2xl relative overflow-hidden border border-slate-800">
                <div className="absolute top-0 right-0 p-6 opacity-10 rotate-12">
                  <Smartphone size={80} />
                </div>
                <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-4">
                     <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                     <span className="text-[9px] font-black uppercase tracking-[0.2em] text-emerald-400 italic">Central de Comando Mobile</span>
                  </div>
                  <h3 className="text-3xl font-black uppercase italic tracking-tighter leading-none mb-3">
                    Controlo Geral<br/><span className="text-brand-primary">24H Ativo</span>
                  </h3>
                  <p className="text-[11px] text-slate-400 font-medium leading-relaxed mb-4">
                    Monitorização em tempo real de chamadas, frotas e fluxos financeiros diretamente no seu terminal.
                  </p>
                  <button 
                    onClick={() => setActiveTab('ops')}
                    className="w-full bg-white text-slate-900 py-3.5 rounded-2xl text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-xl active:scale-95 transition-all"
                  >
                    Monitorizar Canais Live
                    <ChevronRight size={14} />
                  </button>
                </div>
              </div>
            </div>

            {/* AI Technical Dashboard Insight */}
            <div className="bg-slate-900 border border-slate-800 rounded-[2rem] p-6 relative overflow-hidden group">
               <div className="absolute top-0 right-0 p-4 opacity-10 group-hover:opacity-20 transition-opacity">
                  <Zap size={60} className="text-brand-primary" />
               </div>
               <div className="relative z-10">
                  <div className="flex items-center gap-2 mb-3">
                     <Sparkles size={14} className="text-brand-primary animate-pulse" />
                     <span className="text-[10px] font-black uppercase tracking-[0.2em] text-brand-primary italic">AI Insights Técnico</span>
                  </div>
                  <div className={cn(
                    "min-h-[60px] flex items-center transition-all duration-500",
                    isAiLoading ? "opacity-50 blur-[1px]" : "opacity-100 blur-0"
                  )}>
                    <p className="text-[13px] font-medium leading-relaxed italic text-slate-200">
                      "{aiInsights}"
                    </p>
                  </div>
                  <div className="mt-4 flex items-center justify-between">
                     <div className="flex items-center gap-2">
                        <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                        <span className="text-[9px] font-black uppercase text-slate-500 tracking-widest">Motor Gemini 1.5 Flash Ativo</span>
                     </div>
                     <button 
                       onClick={fetchAiInsights}
                       disabled={isAiLoading}
                       className="p-2 bg-slate-800 hover:bg-slate-700 rounded-lg text-slate-400 transition-colors"
                     >
                       <RefreshCw size={12} className={cn(isAiLoading && "animate-spin")} />
                     </button>
                  </div>
               </div>
            </div>

            {/* Smartphone Fleet Gateway Sync Card */}
            <div className="bg-brand-primary p-6 rounded-[2rem] text-white shadow-xl shadow-brand-primary/20 relative overflow-hidden">
               <div className="absolute -right-8 -bottom-8 opacity-10 rotate-12">
                  <Smartphone size={150} />
               </div>
               <div className="relative z-10">
                  <div className="flex items-center gap-4 mb-4">
                     <div className="w-12 h-12 bg-white/20 rounded-2xl flex items-center justify-center backdrop-blur-md border border-white/20">
                        <Smartphone size={24} />
                     </div>
                     <div>
                        <h4 className="text-[11px] font-black text-white/60 uppercase tracking-widest leading-none mb-1">Fleet Gateway</h4>
                        <div className="text-xl font-black italic tracking-tighter flex items-center gap-2">
                           Sincronização Ativa
                           <div className="w-2 h-2 bg-emerald-400 rounded-full animate-pulse" />
                        </div>
                     </div>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                     <div className="bg-white/10 p-3 rounded-xl backdrop-blur-sm border border-white/10">
                        <p className="text-[9px] font-black text-white/50 uppercase tracking-widest">Latência</p>
                        <p className="text-lg font-black text-white">84ms</p>
                     </div>
                     <div className="bg-white/10 p-3 rounded-xl backdrop-blur-sm border border-white/10">
                        <p className="text-[9px] font-black text-white/50 uppercase tracking-widest">Handshake</p>
                        <p className="text-lg font-black text-white">Verified</p>
                     </div>
                  </div>
               </div>
            </div>

            {/* Shift Context Card */}
            <div className="bg-slate-900 p-5 rounded-[2rem] border border-slate-800 shadow-sm relative overflow-hidden">
               <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                     <div className="w-10 h-10 bg-brand-primary/10 text-brand-primary rounded-xl flex items-center justify-center border border-brand-primary/20">
                        <Clock size={20} />
                     </div>
                     <div>
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest">Escala de Turno</p>
                        <p className="text-xs font-black text-white uppercase italic">Status Operacional</p>
                     </div>
                  </div>
                  <button 
                    onClick={() => {
                      setActiveTab('fleet');
                      setFleetSubTab('scales');
                    }}
                    className="text-[9px] font-black text-brand-primary uppercase underline"
                  >
                    Ver Tudo
                  </button>
               </div>
               <div className="space-y-2">
                  {shifts.slice(0, 2).map((s, idx) => (
                    <div key={idx} className="flex items-center justify-between p-3 bg-slate-950 rounded-xl border border-slate-800">
                       <span className="text-[10px] font-black text-slate-300 uppercase truncate max-w-[120px]">{s.driverName}</span>
                       <div className="flex items-center gap-2">
                          <span className="text-[9px] font-bold text-slate-500">{s.prefix}</span>
                          <span className={cn(
                            "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest",
                            s.shift === 'Diurno' ? "bg-amber-500/10 text-amber-500 border border-amber-500/20" : "bg-indigo-500/10 text-indigo-500 border border-indigo-500/20"
                          )}>
                            {s.shift}
                          </span>
                       </div>
                    </div>
                  ))}
               </div>
            </div>

            {/* Quick Summary Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-900 p-5 rounded-[2rem] border border-slate-800 shadow-sm shadow-black/20">
                <div className="w-10 h-10 bg-brand-primary/10 text-brand-primary rounded-xl flex items-center justify-center mb-4 border border-brand-primary/20">
                  <Truck size={20} />
                </div>
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-tight">Frota em<br/>Operação</p>
                <p className="text-2xl font-black text-white mt-1">{stats.activeVehicles}</p>
              </div>
              <div className="bg-slate-900 p-5 rounded-[2rem] border border-slate-800 shadow-sm shadow-black/20 relative overflow-hidden">
                <div className="w-10 h-10 bg-rose-500/10 text-rose-500 rounded-xl flex items-center justify-center mb-4 border border-rose-500/20">
                  <Phone size={20} />
                </div>
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-tight">Chamadas<br/>Perdidas</p>
                <p className="text-2xl font-black text-white mt-1">{derivedStats.missed}</p>
              </div>
              <div className="bg-slate-900 p-5 rounded-[2rem] border border-slate-800 shadow-sm shadow-black/20">
                <div className="w-10 h-10 bg-emerald-500/10 text-emerald-500 rounded-xl flex items-center justify-center mb-4 border border-emerald-500/20">
                  <Phone size={20} />
                </div>
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-tight">Chamadas<br/>Recebidas</p>
                <p className="text-2xl font-black text-white mt-1">{derivedStats.received}</p>
              </div>
              <div className="bg-slate-900 p-5 rounded-[2rem] border border-slate-800 shadow-sm shadow-black/20">
                <div className="w-10 h-10 bg-amber-500/10 text-amber-500 rounded-xl flex items-center justify-center mb-4 border border-amber-500/20">
                  <Phone size={20} />
                </div>
                <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest leading-tight">Chamadas<br/>Reencaminhadas</p>
                <p className="text-2xl font-black text-white mt-1">{derivedStats.forwarded}</p>
              </div>
            </div>

            {/* Recent Calls List */}
            <div>
              <div className="flex items-center justify-between mb-4 px-1">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic tracking-wide">Últimas Chamadas</h3>
                <button className="text-[9px] font-black text-brand-primary uppercase underline">Ver Histórico</button>
              </div>
              <div className="space-y-3 min-h-[100px]">
                {(!dataReady.calls && calls.length === 0) ? (
                  <div className="py-8 flex flex-col items-center justify-center opacity-40">
                    <RefreshCw size={24} className="animate-spin text-brand-primary mb-2" />
                    <p className="text-[10px] font-black uppercase tracking-widest">Sincronizando Chamadas...</p>
                  </div>
                ) : (
                  (calls || []).slice(0, 5).map((call: any, idx: number) => {
                    if (!call) return null;
                    return (
                      <div key={idx} className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex items-center justify-between shadow-sm shadow-black/10">
                        <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-slate-950 rounded-xl flex items-center justify-center text-slate-500 border border-slate-800">
                            <Users size={18} />
                          </div>
                          <div>
                            <p className="text-[11px] font-black text-white uppercase tracking-tight">{call.customerName || 'Cliente Direto'}</p>
                            <div className="flex items-center gap-2">
                               <p className="text-[9px] text-slate-500 font-black uppercase tracking-tighter">{call.customerPhone || 'N/A'}</p>
                               {call.status === 'pending' && <WaitingTimer timestamp={call.timestamp} className="text-[8px] font-black text-amber-500 bg-amber-500/10 px-1 rounded border border-amber-500/20" />}
                            </div>
                          </div>
                        </div>
                          <div className="flex flex-col items-end gap-2">
                             <span className={cn(
                               "px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-widest",
                               call.status === 'completed' ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20" : "bg-amber-500/10 text-amber-400 border border-amber-500/20 animate-pulse"
                             )}>
                               {call.status || 'Pendente'}
                             </span>
                             {call.status !== 'completed' && (
                               <button
                                 onClick={() => {
                                   setSelectedRequest({ ...call, pickup: call.pickupAddress || 'Chamada Direta' });
                                   setIsAssignModalOpen(true);
                                 }}
                                 className="px-3 py-1 bg-brand-primary text-white text-[8px] font-black uppercase rounded-lg shadow-lg shadow-brand-primary/20"
                               >
                                 Gerir Fluxo
                               </button>
                             )}
                          </div>
                      </div>
                    );
                  })
                )}
                {dataReady.calls && calls.length === 0 && (
                  <div className="py-12 text-center bg-slate-900/50 rounded-2xl border border-dashed border-slate-800">
                    <Phone size={24} className="mx-auto text-slate-700 mb-2 opacity-20" />
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Nenhuma chamada recente</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {activeTab === 'fleet' && (
          <div className="space-y-6">
             <div className="flex items-center justify-between px-1">
                <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic">Gestão de Frota</h2>
                <div className="text-[10px] font-black text-brand-primary bg-brand-primary/10 px-3 py-1 rounded-full border border-brand-primary/25 uppercase tracking-widest italic flex items-center h-7 pt-0.5">MÓVEL ACTIVO</div>
             </div>

             {/* Inner sub-tabs trigger pills */}
             <div className="bg-slate-900/80 p-1.5 rounded-2xl border border-slate-800 flex items-center justify-between gap-2 shrink-0">
               <button 
                 onClick={() => setFleetSubTab('vehicles')}
                 className={cn(
                   "flex-1 py-3 text-center text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300",
                   fleetSubTab === 'vehicles' ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20" : "text-slate-400 hover:text-white"
                 )}
               >
                 Viaturas Live
               </button>
               <button 
                 onClick={() => setFleetSubTab('scales')}
                 className={cn(
                   "flex-1 py-3 text-center text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300",
                   fleetSubTab === 'scales' ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/20" : "text-slate-400 hover:text-white"
                 )}
               >
                 Escalas Diárias
               </button>
             </div>

             {fleetSubTab === 'vehicles' ? (
               <div className="space-y-6">
                  <div className="relative">
                     <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                     <input 
                       type="text" 
                       placeholder="PROCURAR VIATURA OU MOTORISTA..."
                       value={vehicleSearch}
                       onChange={(e) => setVehicleSearch(e.target.value)}
                       className="w-full pl-12 pr-4 py-4 bg-slate-900 border border-slate-800 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm outline-none focus:border-brand-primary text-white placeholder:text-slate-500"
                     />
                  </div>

                  <div className="space-y-4">
                     {((vehicleSearch ? filteredVehicles : vehicles) || []).map((v, idx) => {
                       if (!v) return null;
                       return (
                         <div key={idx} className="bg-slate-900 p-5 rounded-[1.5rem] border border-slate-800 shadow-sm relative overflow-hidden text-white">
                            <div className="flex items-center justify-between mb-4">
                               <div className="flex items-center gap-3">
                                  <div className="w-12 h-12 bg-slate-950 rounded-2xl flex items-center justify-center border border-slate-800 shadow-sm font-black text-brand-primary italic">
                                    {v.prefix || '---'}
                                  </div>
                                  <div>
                                     <p className="text-[11px] font-black text-white uppercase tracking-tight leading-none mb-1">{v.name || 'Motorista'}</p>
                                     <div className="flex items-center gap-2">
                                        <div className={cn("w-2 h-2 rounded-full", getStatusColor(v.status))} />
                                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{v.status || 'Inativo'}</p>
                                        <span className="text-[8px] text-slate-600">•</span>
                                        <span className="text-[9px] text-slate-400 font-bold uppercase">{v.fuelLevel || 0}% FUEL</span>
                                     </div>
                                  </div>
                               </div>
                               <div className="text-right">
                                  <p className="text-[10px] font-black text-white tracking-tight">{v.plate || v.licensePlate || '---'}</p>
                                  <p className="text-[9px] text-slate-500 font-bold uppercase">{v.phone || '---'}</p>
                               </div>
                            </div>
                            
                            <div className="grid grid-cols-2 gap-4 pt-3 border-t border-slate-800/60">
                               <div className="flex items-center gap-2">
                                  <Activity size={14} className="text-slate-500" />
                                  <span className="text-[10px] font-black text-slate-300 uppercase tracking-tight">{v.speed || 0} KM/H</span>
                               </div>
                               <div className="flex items-center gap-2 justify-end">
                                  <Clock size={14} className="text-slate-500" />
                                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-tight italic">Auditado 24h</span>
                               </div>
                            </div>
                         </div>
                       );
                     })}

                     {((vehicleSearch ? filteredVehicles : vehicles) || []).length === 0 && (
                       <div className="py-10 text-center border border-dashed border-slate-800 rounded-2xl bg-slate-900/50">
                          <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">Nenhuma viatura correspondente</p>
                       </div>
                     )}
                  </div>
               </div>
             ) : (
               <div className="space-y-6">
                 <div className="flex items-center justify-between px-1">
                    <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">Turnos & Escalas Registadas</h3>
                    <button 
                      onClick={() => {
                        setScaleFormData({
                          driverId: '',
                          driverName: '',
                          prefix: '',
                          date: new Date().toISOString().split('T')[0],
                          shift: 'Diurno',
                          status: 'Ativo',
                          phone: '',
                          secondaryPhone: ''
                        });
                        setIsScaleModalOpen(true);
                      }}
                      className="text-[9px] font-black text-brand-primary bg-brand-primary/10 px-3 py-1.5 rounded-full border border-brand-primary/25 uppercase tracking-widest italic flex items-center gap-1.5"
                    >
                      <Plus size={11} /> Nova Escala
                    </button>
                 </div>

                 <div className="space-y-4">
                    {(shifts || []).map((s, idx) => (
                      <div key={idx} className="bg-slate-900 p-5 rounded-[1.5rem] border border-slate-800 shadow-sm relative overflow-hidden text-white">
                         <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-3">
                               <div className={cn(
                                 "w-12 h-12 rounded-2xl flex items-center justify-center border shadow-sm font-black italic",
                                 s.shift === 'Diurno' ? "bg-amber-500/10 border-amber-500/20 text-amber-500 shadow-amber-500/5" : "bg-indigo-500/10 border-indigo-500/20 text-indigo-400 shadow-indigo-500/5"
                               )}>
                                 {s.prefix || '---'}
                               </div>
                               <div>
                                  <p className="text-[11px] font-black text-white uppercase tracking-tight leading-none mb-1">{s.driverName || 'Motorista'}</p>
                                  <div className="flex items-center gap-2">
                                     <div className={cn("w-2 h-2 rounded-full", s.status === 'Ativo' ? "bg-emerald-500" : "bg-red-500")} />
                                     <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{s.shift} • {s.status}</p>
                                  </div>
                               </div>
                            </div>
                            <div className="text-right">
                               <p className="text-[10px] font-black text-white tracking-tight">{s.date}</p>
                               <span className={cn(
                                 "px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest leading-none block mt-1",
                                 s.status === 'Ativo' ? "bg-emerald-400/15 text-emerald-400 border border-emerald-500/20" : "bg-amber-400/15 text-amber-400 border border-amber-500/20"
                               )}>
                                 {s.status}
                               </span>
                            </div>
                         </div>
                         
                         <div className="flex items-center justify-between pt-3 border-t border-slate-800/60">
                            <div className="flex items-center gap-2">
                               <Clock size={14} className="text-slate-500" />
                               <span className="text-[10px] font-black text-slate-300 uppercase tracking-tight italic">Operacional</span>
                            </div>
                            <button 
                              onClick={() => {
                                setEditingScale(s);
                                setIsEditScaleModalOpen(true);
                              }}
                              className="text-[9px] font-black text-brand-primary uppercase flex items-center gap-1 hover:text-white transition-all bg-brand-primary/10 px-3 py-1.5 rounded-xl border border-brand-primary/20 active:scale-95 duration-200"
                            >
                               Gerir <ChevronRight size={12} />
                            </button>
                         </div>
                      </div>
                    ))}

                    {shifts.length === 0 && (
                      <div className="py-10 text-center border border-dashed border-slate-800 rounded-2xl bg-slate-900/50">
                         <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">Nenhuma escala registada no sistema</p>
                      </div>
                    )}
                 </div>
               </div>
             )}
          </div>
        )}

        {activeTab === 'ops' && (
          <div className="space-y-6">
             <div className="bg-brand-primary rounded-[2.5rem] p-8 text-white shadow-xl relative overflow-hidden">
                <div className="absolute inset-0 bg-white/5 pointer-events-none" />
                <h3 className="text-xl font-black uppercase italic tracking-tighter mb-2">Monitores Live</h3>
                <p className="text-white/60 text-[10px] font-black uppercase tracking-widest leading-relaxed">
                   Acompanhamento e suporte da frota e comunicações de Luena em tempo real.
                </p>
             </div>

             {/* Selector de Sub-abas Operacionais */}
             <div className="flex bg-slate-900 p-1.5 rounded-[1.5rem] border border-slate-800 gap-1 shadow-inner">
                <button
                  onClick={() => setOpsSubTab('gateway')}
                  className={cn(
                    "flex-1 py-3 px-1 rounded-xl text-[9px] font-black uppercase tracking-[0.05em] transition-all flex items-center justify-center gap-1.5 focus:outline-none",
                    opsSubTab === 'gateway' ? "bg-white text-slate-950 font-black shadow-lg" : "text-slate-400 hover:text-white"
                  )}
                >
                  <Activity size={12} className={opsSubTab === 'gateway' ? "text-slate-950" : "text-brand-primary"} />
                  Gateway
                </button>
                <button
                  onClick={() => setOpsSubTab('map')}
                  className={cn(
                    "flex-1 py-3 px-1 rounded-xl text-[9px] font-black uppercase tracking-[0.05em] transition-all flex items-center justify-center gap-1.5 focus:outline-none",
                    opsSubTab === 'map' ? "bg-white text-slate-950 font-black shadow-lg" : "text-slate-400 hover:text-white"
                  )}
                >
                  <MapPin size={12} className={opsSubTab === 'map' ? "text-slate-950" : "text-brand-primary"} />
                  Mapa Frota
                </button>
                <button
                  onClick={() => setOpsSubTab('whatsapp')}
                  className={cn(
                    "flex-1 py-3 px-1 rounded-xl text-[9px] font-black uppercase tracking-[0.05em] transition-all flex items-center justify-center gap-1.5 focus:outline-none",
                    opsSubTab === 'whatsapp' ? "bg-white text-slate-950 font-black shadow-lg" : "text-slate-400 hover:text-white"
                  )}
                >
                  <MessageSquare size={12} className={opsSubTab === 'whatsapp' ? "text-slate-950" : "text-brand-primary"} />
                  WhatsApp
                </button>
             </div>

             {opsSubTab === 'gateway' && (
               <div className="space-y-4">
                  <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-sm space-y-4">
                     <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-950 text-brand-primary rounded-xl flex items-center justify-center border border-slate-800">
                           <Activity size={20} />
                        </div>
                        <h4 className="text-xs font-black text-white uppercase tracking-tight">Canais Gateway Ativos</h4>
                     </div>
                     <div className="grid grid-cols-3 gap-2">
                        {[1,2,3].map(i => (
                           <div key={i} className="bg-slate-950 p-3 rounded-xl border border-slate-800 text-center">
                              <p className="text-[10px] font-black text-emerald-400 mb-1">ON</p>
                              <p className="text-[8px] font-bold text-slate-500 uppercase">Port {i}</p>
                           </div>
                        ))}
                     </div>
                  </div>

                  <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-sm space-y-4">
                     <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-950 text-amber-500 rounded-xl flex items-center justify-center border border-slate-800">
                           <MessageSquare size={20} />
                        </div>
                        <h4 className="text-xs font-black text-white uppercase tracking-tight">Log de Mensagens Mobile</h4>
                     </div>
                     <div className="space-y-2">
                        <p className="text-[10px] text-slate-450 italic leading-relaxed text-center py-10 border border-dashed border-slate-800 rounded-xl bg-slate-950 text-slate-400">
                          Os logs de SMS detalhados estão disponíveis no painel desktop para auditoria completa.
                        </p>
                     </div>
                  </div>

                  <div className="bg-slate-900 p-6 rounded-[2rem] border border-slate-800 shadow-xl space-y-4">
                     <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                           <div className="w-10 h-10 bg-brand-primary rounded-xl flex items-center justify-center text-white">
                              <Smartphone size={20} />
                           </div>
                           <h4 className="text-xs font-black text-white uppercase tracking-tight">Gateway Integrado (Alpha)</h4>
                        </div>
                        <div className="flex items-center gap-1.5 bg-emerald-500/15 px-2.5 py-1 rounded-full border border-emerald-500/25">
                           <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                           <span className="text-[8px] font-bold text-emerald-450 uppercase">Vínculo Ativo</span>
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
                            className="flex-1 py-3 bg-slate-950 hover:bg-slate-850 text-white rounded-xl text-[9px] font-black uppercase tracking-widest border border-slate-800 transition-all shadow-md active:scale-95"
                          >
                             Simular Chamada
                          </button>
                        </div>
                     </div>
                  </div>
               </div>
             )}

             {opsSubTab === 'map' && (
               <div className="bg-slate-900 rounded-[2rem] border border-slate-800 overflow-hidden shadow-2xl h-[580px] relative">
                  <div className="absolute top-4 left-4 z-10 bg-slate-950/80 backdrop-blur-md px-3 py-1.5 rounded-xl border border-slate-800 text-[9px] font-black uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
                     <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                     Sincronização de Satélite Ativa
                  </div>
                  <RealTimeMap />
               </div>
             )}

             {opsSubTab === 'whatsapp' && (
               <div className="bg-slate-900 rounded-[2rem] border border-slate-800 overflow-hidden shadow-2xl p-4">
                  <div className="mb-4">
                     <h4 className="text-xs font-black text-white uppercase tracking-tight flex items-center gap-1.5">
                        <MessageSquare size={14} className="text-emerald-400" />
                        Teclado de Triagem de Clientes & Motoristas
                     </h4>
                     <p className="text-[9px] text-slate-400 uppercase tracking-widest mt-0.5">Sincronizado com o WhatsApp Oficial Luena</p>
                  </div>
                  <WhatsAppMonitor />
               </div>
             )}
          </div>
        )}

        {activeTab === 'wallet' && (
          <div className="space-y-6">
             <div className="bg-slate-900 border border-slate-800 rounded-[2.5rem] p-8 text-center text-white shadow-2xl relative overflow-hidden">
                <div className="absolute top-0 left-0 w-full h-full bg-gradient-to-br from-brand-primary/20 to-transparent pointer-events-none" />
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-3 relative">Total de Hoje (Luena)</p>
                <h3 className="text-4xl font-black tracking-tighter mb-2 relative italic text-white">
                  {(stats.totalRevenue || 0).toLocaleString()} <span className="text-lg">Kz</span>
                </h3>
                <div className="inline-flex items-center gap-2 bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 px-4 py-1.5 rounded-full relative text-[9px] font-black uppercase tracking-widest shadow-xl">
                   <TrendingUp size={12} />
                   Live Sync Ativo
                </div>
             </div>

             <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                   <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">Fluxo de Rendas PSM</h3>
                   <button className="text-[9px] font-black text-brand-primary uppercase underline">Ver Todos os Logs</button>
                </div>
                
                <div className="space-y-3">
                   {revenueLogs.slice(0, 10).map((log, idx) => (
                     <div key={idx} className="bg-slate-900 p-5 rounded-[1.5rem] border border-slate-800 shadow-sm relative overflow-hidden flex items-center justify-between">
                        <div className="flex items-center gap-4">
                           <div className="w-10 h-10 bg-slate-950 rounded-xl flex items-center justify-center text-emerald-500 border border-slate-800">
                              <Wallet size={18} />
                           </div>
                           <div>
                              <p className="text-[11px] font-black text-white uppercase tracking-tight leading-none mb-1">{log.driverName}</p>
                              <div className="flex items-center gap-2">
                                 <span className="text-[9px] text-slate-500 font-bold uppercase">{log.prefix}</span>
                                 <span className="text-[8px] text-slate-600">•</span>
                                 <span className="text-[9px] text-slate-500 font-bold uppercase">{log.date}</span>
                              </div>
                           </div>
                        </div>
                        <div className="text-right flex flex-col items-end gap-1.5">
                           <p className="text-sm font-black text-white italic tracking-tighter">{(log.amount || 0).toLocaleString()} Kz</p>
                           <span className={cn(
                             "text-[8px] font-black uppercase tracking-widest",
                             log.status === 'finalized' ? "text-emerald-500" :
                             log.status === 'approved_by_accountant' ? "text-purple-400 font-bold" :
                             log.status === 'approved_by_operator' ? "text-blue-400 font-bold" : "text-amber-500 animate-pulse"
                           )}>
                             {log.status === 'finalized' ? 'Auditado/Final' :
                              log.status === 'approved_by_accountant' ? 'Pendente Contab.' :
                              log.status === 'approved_by_operator' ? 'Pendente Admin' : 'Pendente Operador'}
                           </span>
                           {((user.role === 'operator' && log.status === 'pending_approval') ||
                             ((user.role === 'admin' || user.role === 'gerente') && (log.status === 'pending_approval' || log.status === 'approved_by_operator' || log.status === 'approved_by_accountant')) ||
                             (user.role === 'contabilista' && log.status === 'approved_by_accountant')) && (
                             <button
                               onClick={() => handleApproveRevenue(log)}
                               className="mt-1.5 px-3 py-1 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white rounded-lg text-[8px] font-black uppercase tracking-widest shadow-md transition-all whitespace-nowrap"
                             >
                               Aprovar Renda
                             </button>
                           )}
                        </div>
                     </div>
                   ))}
                   
                   {revenueLogs.length === 0 && (
                     <div className="py-10 text-center border border-dashed border-slate-800 rounded-2xl bg-slate-900/50">
                        <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">Nenhum registo disponível hoje</p>
                     </div>
                   )}
                </div>
                

             </div>
          </div>
        )}

        {activeTab === 'map' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic">Geolocalização Live</h2>
              <div className="text-[10px] font-black text-brand-primary bg-brand-primary/10 px-3 py-1 rounded-full border border-brand-primary/25 uppercase tracking-widest italic flex items-center h-7 pt-0.5">MAPA DA FROTA</div>
            </div>
            <div className="h-[650px] w-full bg-slate-900 rounded-3xl overflow-hidden border border-slate-800">
              <RealTimeMap />
            </div>
          </div>
        )}

        {activeTab === 'whatsapp' && (
          <div className="space-y-6">
            <div className="flex items-center justify-between px-1">
              <h2 className="text-2xl font-black text-white uppercase tracking-tighter italic">WhatsApp Monitor</h2>
              <div className="text-[10px] font-black text-emerald-500 bg-emerald-500/10 px-3 py-1 rounded-full border border-emerald-500/25 uppercase tracking-widest italic flex items-center h-7 pt-0.5">CONEXÃO LIVE</div>
            </div>
            <div className="p-2 bg-slate-900 rounded-3xl border border-slate-800">
              <WhatsAppMonitor isMechanicView={false} />
            </div>
          </div>
        )}

      </main>

      {/* Mobile Sticky Tab Bar */}
      <footer className="h-20 bg-slate-900 border-t border-slate-800 flex items-center justify-around px-2 flex-shrink-0 relative z-50">
        <button 
          onClick={() => setActiveTab('dashboard')}
          className={cn("flex flex-col items-center gap-1 transition-all duration-300", activeTab === 'dashboard' ? "text-brand-primary scale-110" : "text-slate-500")}
        >
          <LayoutDashboard size={22} strokeWidth={activeTab === 'dashboard' ? 3 : 2} />
          <span className="text-[8px] font-black uppercase tracking-widest">Painel</span>
        </button>
        {user?.role === 'contabilista' ? (
          <button 
            onClick={() => setActiveTab('map')}
            className={cn("flex flex-col items-center gap-1 transition-all duration-300", activeTab === 'map' ? "text-brand-primary scale-110" : "text-slate-500")}
          >
            <Map size={22} strokeWidth={activeTab === 'map' ? 3 : 2} />
            <span className="text-[8px] font-black uppercase tracking-widest">Mapa</span>
          </button>
        ) : (
          <button 
            onClick={() => setActiveTab('fleet')}
            className={cn("flex flex-col items-center gap-1 transition-all duration-300", activeTab === 'fleet' ? "text-brand-primary scale-110" : "text-slate-500")}
          >
            <Truck size={22} strokeWidth={activeTab === 'fleet' ? 3 : 2} />
            <span className="text-[8px] font-black uppercase tracking-widest">Frota</span>
          </button>
        )}
        {user?.role === 'contabilista' ? (
          <button 
            onClick={() => setActiveTab('whatsapp')}
            className={cn("flex flex-col items-center gap-1 transition-all duration-300", activeTab === 'whatsapp' ? "text-brand-primary scale-110" : "text-slate-500")}
          >
            <MessageSquare size={22} strokeWidth={activeTab === 'whatsapp' ? 3 : 2} fill={activeTab === 'whatsapp' ? "currentColor" : "none"} />
            <span className="text-[8px] font-black uppercase tracking-widest">WhatsApp</span>
          </button>
        ) : (
          <button 
            onClick={() => setActiveTab('ops')}
            className={cn("flex flex-col items-center gap-1 transition-all duration-300", activeTab === 'ops' ? "text-brand-primary scale-110" : "text-slate-500")}
          >
            <Activity size={22} strokeWidth={activeTab === 'ops' ? 3 : 2} />
            <span className="text-[8px] font-black uppercase tracking-widest">Monitores</span>
          </button>
        )}
        <button 
          onClick={() => setActiveTab('wallet')}
          className={cn("flex flex-col items-center gap-1 transition-all duration-300", activeTab === 'wallet' ? "text-brand-primary scale-110" : "text-slate-500")}
        >
          <Wallet size={22} strokeWidth={activeTab === 'wallet' ? 3 : 2} />
          <span className="text-[8px] font-black uppercase tracking-widest">Contas</span>
        </button>
      </footer>

      {/* New Scale Modal */}
      <AnimatePresence>
        {isScaleModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-5">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsScaleModalOpen(false)}
              className="absolute inset-0 bg-slate-950/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-slate-900 rounded-[2.5rem] border border-slate-800 overflow-hidden shadow-2xl flex flex-col max-h-[85vh]"
            >
              <div className="p-7 border-b border-slate-800 flex items-center justify-between shrink-0">
                <h3 className="text-lg font-black text-white uppercase italic tracking-tighter">Registrar Nova Escala</h3>
                <button onClick={() => setIsScaleModalOpen(false)} className="w-10 h-10 bg-slate-800 rounded-full flex items-center justify-center text-white active:scale-90 transition-all">
                   <X size={18} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-7 space-y-5 custom-scrollbar">
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Motorista</label>
                   <select 
                     value={scaleFormData.driverId}
                     onChange={(e) => {
                       const d = driversMaster.find(drv => drv.id === e.target.value);
                                               const matchedPhone = psmPhones.find(p => p.assignedTo === d?.name);
                        setScaleFormData({
                          ...scaleFormData, 
                          driverId: e.target.value, 
                          driverName: d?.name || '',
                          phone: matchedPhone?.number || scaleFormData.phone || d?.phone || ''
                        });
                     }}
                     className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-xs font-black text-white uppercase tracking-tight outline-none focus:border-brand-primary appearance-none shadow-inner"
                   >
                     <option value="">Selecionar Motorista...</option>
                                           {driversMaster.map(d => (
                        <option key={d.id} value={d.id}>
                          {d.name} {d.phone ? `(${d.phone})` : ''}
                        </option>
                      ))}
                   </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Viatura</label>
                     <select 
                       value={scaleFormData.prefix}
                       onChange={(e) => setScaleFormData({...scaleFormData, prefix: e.target.value})}
                       className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-xs font-black text-white uppercase tracking-tight outline-none focus:border-brand-primary appearance-none shadow-inner"
                     >
                       <option value="">Prefixo...</option>
                       {vehiclesMaster.map(v => <option key={v.id} value={v.prefix}>{v.prefix}</option>)}
                     </select>
                  </div>
                  <div className="space-y-2">
                     <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Turno</label>
                     <select 
                       value={scaleFormData.shift}
                       onChange={(e) => setScaleFormData({...scaleFormData, shift: e.target.value as any})}
                       className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-xs font-black text-white uppercase tracking-tight outline-none focus:border-brand-primary appearance-none shadow-inner"
                     >
                        <option value="Diurno">Diurno</option>
                        <option value="Nocturno">Nocturno</option>
                        <option value="24h">24 Horas</option>
                      </select>
                   </div>
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Terminal Principal PSM</label>
                      <select 
                        required
                        value={scaleFormData.phone}
                        onChange={(e) => {
                          const phoneNum = e.target.value;
                          const phoneData = psmPhones.find(p => p.number === phoneNum);
                          const matchDriver = driversMaster.find(drv => drv.name === phoneData?.assignedTo);
                          setScaleFormData({
                            ...scaleFormData, 
                            phone: phoneNum,
                            driverId: matchDriver?.id || scaleFormData.driverId,
                            driverName: matchDriver?.name || scaleFormData.driverName
                          });
                        }}
                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-xs font-black text-white uppercase tracking-tight outline-none focus:border-brand-primary appearance-none shadow-inner"
                      >
                        <option value="">Selecionar...</option>
                        {psmPhones.filter((p: any) => p.status === 'Ativo').map((p: any) => (
                          <option key={p.id} value={p.number}>{p.label} - {p.number}</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Terminal Secundário</label>
                      <select 
                        value={scaleFormData.secondaryPhone}
                        onChange={(e) => setScaleFormData({...scaleFormData, secondaryPhone: e.target.value})}
                        className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-xs font-black text-white uppercase tracking-tight outline-none focus:border-brand-primary appearance-none shadow-inner"
                      >
                        <option value="">Nenhum...</option>
                        {psmPhones.filter((p: any) => p.status === 'Ativo').map((p: any) => (
                          <option key={p.id} value={p.number}>{p.label} - {p.number}</option>
                        ))}
                      </select>
                    </div>
                 </div>
                 <div className="hidden">
                    <div>
                       <select>
                          <option value="24h">24 Horas</option>
                     </select>
                  </div>
                </div>

                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Data de Início</label>
                   <input 
                     type="date"
                     value={scaleFormData.date}
                     onChange={(e) => setScaleFormData({...scaleFormData, date: e.target.value})}
                     className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-xs font-black text-white uppercase tracking-tight outline-none focus:border-brand-primary shadow-inner"
                   />
                </div>

                <div className="bg-brand-primary/10 border border-brand-primary/20 p-5 rounded-2xl">
                   <div className="flex items-center gap-3 text-brand-primary mb-2">
                      <Zap size={18} />
                      <span className="text-[10px] font-black uppercase tracking-widest">Confirmação PSM</span>
                   </div>
                   <p className="text-[9px] text-slate-400 font-medium leading-relaxed italic">
                      Ao salvar, esta escala será vinculada ao monitor de frota e servirá como base para as auditorias de chamadas e rendas.
                   </p>
                </div>
              </div>

              <div className="p-7 border-t border-slate-800 shrink-0">
                <button 
                  onClick={async () => {
                    if (!scaleFormData.driverId || !scaleFormData.prefix) {
                      alert("Por favor, preencha todos os campos.");
                      return;
                    }
                    try {
                      const { addDoc, collection, serverTimestamp, query, where, getDocs } = await import('firebase/firestore');

                      // Constraint checks bypassed for free linkage
                      await addDoc(collection(db, 'driver_scales'), {
                        driverId: scaleFormData.driverId,
                        driverName: scaleFormData.driverName,
                        prefix: scaleFormData.prefix,
                        date: scaleFormData.date,
                        shift: scaleFormData.shift,
                        status: scaleFormData.status,
                        phone: scaleFormData.phone,
                        secondaryPhone: scaleFormData.secondaryPhone,
                        updatedAt: serverTimestamp()
                      });

                      // Also active this vehicle/driver in the active fleet ('drivers' collection) 
                      // so that they immediately show up in the real-time "Frota em tempo real" / "Viaturas Live"!
                      const driverDetail = driversMaster.find(d => d.id === scaleFormData.driverId);
                      const vehicleDetail = vehiclesMaster.find(v => v.prefix === scaleFormData.prefix);
                      
                      const isAdminOrOperator = user?.role === 'admin' || user?.role === 'gerente' || user?.role === 'operator';
                      if (isAdminOrOperator) {
                        await addDoc(collection(db, 'drivers'), {
                          name: driverDetail?.name || scaleFormData.driverName || '',
                          phone: scaleFormData.phone || driverDetail?.phone || '',
                          secondaryPhone: scaleFormData.secondaryPhone || driverDetail?.secondaryPhone || '',
                          prefix: scaleFormData.prefix,
                          plate: vehicleDetail?.plate || '',
                          trackerId: vehicleDetail?.trackerId || '',
                          driverId: scaleFormData.driverId,
                          status: 'disponível',
                          gps: 'Signal Good',
                          lat: -11.7833, // Default Luena
                          lng: 19.9167,
                          batteryLevel: 100,
                          recentCalls: [],
                          rendaStatus: 'pending',
                          callCount: 0,
                          updatedAt: new Date().toISOString()
                        });
                      }

                      setIsScaleModalOpen(false);
                      if (isAdminOrOperator) {
                        alert("Escala registada com sucesso e viatura vinculada à frota em tempo real!");
                      } else {
                        alert("Escala guardada com sucesso! Aguarde que um Administrador ou Operador a ative na frota real.");
                      }
                    } catch (err) {
                      handleFirestoreError(err, OperationType.WRITE, 'driver_scales');
                    }
                  }}
                  className="w-full bg-brand-primary hover:bg-brand-secondary text-white py-5 rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] shadow-2xl active:scale-95 transition-all shadow-brand-primary/25"
                >
                   Finalizar Registo
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Manage Scale (Edit/Delete) Modal */}
      <AnimatePresence>
        {isEditScaleModalOpen && editingScale && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-5">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsEditScaleModalOpen(false);
                setEditingScale(null);
              }}
              className="absolute inset-0 bg-slate-950/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm bg-slate-900 rounded-[2.5rem] border border-slate-800 overflow-hidden shadow-2xl flex flex-col p-7 text-white"
            >
              <div className="flex items-center justify-between border-b border-slate-800 pb-4 mb-5 shrink-0">
                <div>
                  <h3 className="text-sm font-black text-brand-primary uppercase tracking-widest italic leading-none mb-1">Gerir Escala</h3>
                  <p className="text-xs font-black text-white uppercase italic">{editingScale.driverName}</p>
                </div>
                <button 
                  onClick={() => {
                    setIsEditScaleModalOpen(false);
                    setEditingScale(null);
                  }}
                  className="p-2 bg-slate-800 rounded-full hover:bg-slate-700 active:scale-95 transition-all text-white"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-6">
                 <div>
                   <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-2">Alterar Turno</span>
                   <div className="grid grid-cols-3 gap-2">
                     {(['Diurno', 'Nocturno', '24h'] as const).map((shift) => (
                       <button
                         key={shift}
                         onClick={() => handleUpdateScaleShift(shift)}
                         className={cn(
                           "py-2.5 px-1 rounded-xl text-[9px] font-black uppercase tracking-wider border transition-all active:scale-95",
                           editingScale.shift === shift 
                             ? "bg-brand-primary border-brand-primary text-white font-bold" 
                             : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                         )}
                       >
                         {shift}
                       </button>
                     ))}
                   </div>
                 </div>

                 <div>
                   <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest block mb-1">Alterar Estado</span>
                   <p className="text-[8px] text-slate-500 font-bold mb-2 uppercase leading-none">Vínculo: {editingScale.prefix}</p>
                   <div className="grid grid-cols-3 gap-2">
                     {(['Ativo', 'Folga', 'Suspenso'] as const).map((st) => (
                       <button
                         key={st}
                         onClick={() => handleUpdateScaleStatus(st)}
                         className={cn(
                           "py-2.5 px-1 rounded-xl text-[9px] font-black uppercase tracking-wider border transition-all active:scale-95",
                           editingScale.status === st 
                             ? "bg-brand-primary border-brand-primary text-white font-bold" 
                             : "bg-slate-950 border-slate-800 text-slate-400 hover:text-white"
                         )}
                       >
                         {st}
                       </button>
                     ))}
                   </div>
                 </div>

                 <div className="pt-2 border-t border-slate-800">
                    <button
                      onClick={handleDeleteScale}
                      className="w-full bg-red-500/15 hover:bg-red-500 text-red-550 hover:text-white border border-red-500/20 py-4 rounded-xl text-[10px] font-black uppercase tracking-[0.25em] active:scale-95 transition-all outline-none"
                    >
                      Excluir Turno
                    </button>
                 </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Slide-out Overlay Menu */}
      <AnimatePresence>
        {isMenuOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsMenuOpen(false)}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[60]"
            />
            <motion.div 
              initial={{ x: 300 }}
              animate={{ x: 0 }}
              exit={{ x: 300 }}
              className="fixed top-0 right-0 h-full w-4/5 max-w-[320px] bg-slate-900 z-[70] shadow-2xl p-8 flex flex-col border-l border-slate-800 text-white"
            >
              <div className="flex items-center justify-between mb-10">
                 <h3 className="text-xl font-black text-white uppercase tracking-tighter italic">Definições</h3>
                 <button onClick={() => setIsMenuOpen(false)} className="p-2 bg-slate-800 rounded-full text-white">
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
                      "w-full flex items-center justify-between p-4 rounded-2xl hover:bg-slate-850 transition-all active:scale-95 border border-transparent hover:border-slate-800",
                      item.color || "text-slate-200"
                    )}
                  >
                    <div className="flex items-center gap-4">
                       <item.icon size={20} />
                       <span className="text-xs font-black uppercase tracking-widest">{item.label}</span>
                    </div>
                    <ChevronRight size={16} className="opacity-35" />
                  </button>
                ))}
              </div>
              
              <div className="mt-auto pt-8 border-t border-slate-800 text-center">
                 <p className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em]">PSM COMERCIAL LUENA</p>
                 <p className="text-[9px] font-medium text-slate-500 mt-1 uppercase">TaxiControl Mobile Interface</p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Driver Assignment Modal (Smartphone Integrated) */}
      <AnimatePresence>
        {isAssignModalOpen && selectedRequest && (
          <div className="fixed inset-0 z-[100] flex items-end justify-center p-0">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAssignModalOpen(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="bg-slate-900 w-full max-h-[90vh] rounded-t-[3rem] shadow-2xl relative z-10 overflow-hidden flex flex-col border-t border-slate-800"
            >
              <div className="p-8 bg-brand-primary text-white flex items-center justify-between shrink-0">
                <div>
                   <h3 className="text-xl font-black uppercase italic tracking-tighter">Gerir Fluxo</h3>
                   <p className="text-[10px] font-bold text-white/70 uppercase tracking-widest mt-1 italic">
                     {selectedRequest?.customerName || 'Cliente Direto'} • {selectedRequest?.customerPhone || 'Unitel'}
                   </p>
                </div>
                <button onClick={() => setIsAssignModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-all">
                  <X size={20} />
                </button>
              </div>

              <div className="p-8 overflow-y-auto no-scrollbar space-y-6">
                <div className="bg-slate-800 p-5 rounded-2xl border border-slate-700/50">
                  <div className="flex items-start gap-4">
                    <MapPin size={18} className="text-brand-primary mt-1" />
                    <div>
                        <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-1">Local de Recolha</p>
                        <p className="text-[13px] font-bold text-white leading-tight">{selectedRequest?.pickup || 'Luena - Terminal'}</p>
                    </div>
                  </div>
                </div>

                <div className="space-y-4">
                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-widest px-1">Motoristas Disponíveis</h4>
                  {driversMaster.filter(driver => {
                    // Find assigned vehicle for this driver to check availability
                    const vehicle = vehiclesMaster.find(v => v.driverId === driver.id);
                    const status = vehicle?.status?.toLowerCase();
                    return ['available', 'ativo', 'disponível', 'disponivel'].includes(status);
                  }).length > 0 ? (
                    <div className="space-y-3 pb-8">
                       {driversMaster
                        .filter(driver => {
                          const vehicle = vehiclesMaster.find(v => v.driverId === driver.id);
                          const status = vehicle?.status?.toLowerCase();
                          return ['available', 'ativo', 'disponível', 'disponivel'].includes(status);
                        })
                        .map((driver) => {
                          const v = vehiclesMaster.find(veh => veh.driverId === driver.id);
                          return (
                            <button
                              key={driver.id}
                              onClick={() => selectedRequest?.id && handleAssignDriver(selectedRequest.id, { ...driver, ...v })}
                              className="w-full p-5 bg-slate-950 border border-slate-800 rounded-2xl hover:border-brand-primary transition-all flex items-center justify-between group active:scale-[0.98]"
                            >
                              <div className="flex items-center gap-4 text-left">
                                 <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center text-slate-500 group-hover:bg-brand-primary group-hover:text-white transition-all">
                                    <Car size={20} />
                                 </div>
                                 <div className="max-w-[150px]">
                                    <p className="font-black text-white uppercase tracking-tight text-[13px] truncate">{driver.name}</p>
                                    <p className="text-[10px] text-slate-500 font-bold uppercase italic">{v?.prefix || 'TÁXI'} • {v?.licensePlate || 'AL-00-00'}</p>
                                 </div>
                              </div>
                              <div className="flex items-center gap-3">
                                 <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center text-emerald-500">
                                    <Plus size={16} />
                                 </div>
                              </div>
                            </button>
                          );
                        })
                       }
                    </div>
                  ) : (
                    <div className="py-12 text-center bg-slate-950 rounded-3xl border border-dashed border-slate-800">
                       <Car size={32} className="mx-auto text-slate-700 mb-3 opacity-20" />
                       <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Nenhum motorista livre no Luena</p>
                    </div>
                  )}
                </div>
              </div>
              
              {assigningLoading && (
                <div className="absolute inset-0 bg-slate-950/50 backdrop-blur-sm flex items-center justify-center z-50">
                   <div className="flex flex-col items-center gap-3">
                      <RefreshCw className="text-brand-primary animate-spin" size={32} />
                      <p className="text-[10px] font-black text-white uppercase tracking-widest">Sincronizando Fluxo...</p>
                   </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Sino / Drawer de Notificações de Alertas Activos */}
      <AnimatePresence>
        {isAlertsDrawerOpen && (
          <div className="fixed inset-0 z-[120] flex items-end justify-center p-0">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAlertsDrawerOpen(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              className="bg-slate-900 w-full max-h-[85vh] rounded-t-[3rem] shadow-2xl relative z-10 overflow-hidden flex flex-col border-t border-slate-800"
            >
              <div className="p-8 bg-slate-950 text-white flex items-center justify-between shrink-0 border-b border-slate-800">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-rose-500/10 text-rose-505/90 rounded-xl flex items-center justify-center border border-rose-500/20">
                    <Bell size={20} className="animate-bounce" />
                  </div>
                  <div>
                    <h3 className="text-xl font-black uppercase italic tracking-tighter">Alertas Central</h3>
                    <p className="text-[10px] font-black text-rose-400 uppercase tracking-widest mt-0.5">Auditoria Operacional Luena</p>
                  </div>
                </div>
                <button onClick={() => setIsAlertsDrawerOpen(false)} className="p-2 hover:bg-slate-800 rounded-full transition-all">
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              <div className="p-8 overflow-y-auto custom-scrollbar space-y-6 flex-1 bg-slate-900">
                {/* 1. Alertas de Pânico S.O.S Active */}
                {panicAlertsList.length > 0 ? (
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-black text-rose-500 uppercase tracking-widest flex items-center gap-1.5 animate-pulse">
                      <ShieldAlert size={14} /> Pânico SOS Ativado ({panicAlertsList.length})
                    </h4>
                    <div className="space-y-2">
                      {panicAlertsList.map(alert => {
                        const phone = getDriverPhone(alert.driverId, alert.driverName, alert.prefix, alert.driverPhone || alert.phone);
                        return (
                          <div key={alert.id} className="bg-rose-950/20 border border-rose-905/30 p-4 rounded-2xl flex items-center justify-between">
                            <div>
                              <p className="text-xs font-black text-rose-200">SOS: Viatura {alert.prefix || 'N/A'}</p>
                              <p className="text-[9px] text-rose-400 font-bold uppercase tracking-wider mt-0.5">{alert.driverName || 'Motorista'}</p>
                            </div>
                              <div className="flex items-center gap-2">
                                {phone ? (
                                  <a 
                                    href={`tel:${phone}`}
                                    className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all font-mono"
                                  >
                                    <Phone size={10} fill="currentColor" />
                                    Ligar Já
                                  </a>
                                ) : (
                                  <span className="text-[8px] font-bold text-slate-500 uppercase">Sem Contacto</span>
                                )}
                                <button 
                                  onClick={() => {
                                    setIsAlertsDrawerOpen(false);
                                    setActiveTab('ops');
                                    setOpsSubTab('map');
                                  }}
                                  className="p-2 bg-slate-800 hover:bg-slate-700 text-rose-500 border border-slate-700/50 rounded-xl transition-all flex items-center justify-center cursor-pointer active:scale-95"
                                  title="Localizar no Mapa"
                                >
                                  <Map size={14} />
                                </button>
                              </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div className="bg-emerald-950/20 border border-emerald-900/20 p-4 rounded-2xl flex items-center gap-3">
                     <div className="w-8 h-8 rounded-lg bg-emerald-500/15 text-emerald-400 flex items-center justify-center">
                        <ShieldAlert size={16} />
                     </div>
                     <div>
                        <p className="text-[11px] font-black text-emerald-400 uppercase tracking-tight">Zero SOS Ativos</p>
                        <p className="text-[9px] text-slate-400 uppercase font-bold leading-none mt-1">Sinal de satélite normal sem ocorrências de risco</p>
                     </div>
                  </div>
                )}

                {/* 2. Excessos de Velocidade >80km/h */}
                {vehicles.filter((v: any) => v.status !== 'offline' && Number(v.speed || 0) > 80).length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-1.5">
                      <Zap size={14} className="text-amber-500" /> Excessos de Velocidade (&gt;80km/h)
                    </h4>
                    <div className="space-y-2">
                      {vehicles.filter((v: any) => v.status !== 'offline' && Number(v.speed || 0) > 80).map((v: any) => (
                        <div key={v.id} className="bg-amber-950/10 border border-amber-900/30 p-4 rounded-2xl flex items-center justify-between">
                          <div>
                            <p className="text-xs font-black text-amber-200 uppercase">Viatura {v.prefix}</p>
                            <p className="text-[9px] text-amber-400 font-bold uppercase mt-0.5">Velocidade: {v.speed} km/h • {v.name || 'Motorista'}</p>
                          </div>
                          {v.phone && (
                            <a 
                              href={`tel:${v.phone}`}
                              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all font-mono shadow-md"
                            >
                              <Phone size={10} fill="currentColor" />
                              Ligar Já
                            </a>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* 3. Chamadas Perdidas que Precisam de Retorno */}
                {calls.filter((c: any) => c.status === 'pending' || c.type === 'missed').length > 0 && (
                  <div className="space-y-3">
                    <h4 className="text-[10px] font-black text-blue-400 uppercase tracking-widest flex items-center gap-1.5">
                      <Phone size={13} className="text-blue-500" /> Chamadas Perdidas / Sem Retorno
                    </h4>
                    <div className="space-y-2">
                      {calls.filter((c: any) => c.status === 'pending' || c.type === 'missed').slice(0, 5).map((call: any) => (
                        <div key={call.id} className="bg-slate-850 border border-slate-800 p-4 rounded-2xl flex items-center justify-between">
                          <div>
                            <p className="text-xs font-black text-slate-200 font-mono">{call.customerPhone || 'Contacto N/A'}</p>
                            <p className="text-[9px] text-slate-500 font-bold uppercase mt-1">Origem: {call.prefix || 'Externo'} • {call.timestamp?.substring(11, 16) || 'Hoje'}</p>
                          </div>
                          <a 
                            href={`tel:${call.customerPhone}`}
                            className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all font-mono shadow-md"
                          >
                            <Phone size={10} fill="currentColor" />
                            Retornar Já
                          </a>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {panicAlertsList.length === 0 && 
                 vehicles.filter((v: any) => v.status !== 'offline' && Number(v.speed || 0) > 80).length === 0 && 
                 calls.filter((c: any) => c.status === 'pending' || c.type === 'missed').length === 0 && (
                  <div className="py-16 text-center border border-dashed border-slate-850 rounded-2xl bg-slate-900/10">
                    <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest italic">Nenhum alerta operacional ativo</p>
                    <p className="text-[9px] text-slate-600 uppercase tracking-wider mt-1.5 font-bold">A sua frota opera com máxima segurança em Luena</p>
                  </div>
                )}
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
