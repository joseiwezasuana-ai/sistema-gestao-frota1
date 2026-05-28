import React, { useState, useEffect } from 'react';
import { 
  Wrench, 
  Settings as SettingsIcon, 
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
  AlertTriangle,
  TrendingUp,
  FileText,
  X,
  ChevronRight,
  Menu,
  Map,
  Phone,
  MessageSquare // Added import
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { signOut } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot, addDoc, where, limit, doc, updateDoc, writeBatch, serverTimestamp } from 'firebase/firestore';
import { format } from 'date-fns';
import RealTimeMap from './RealTimeMap';
import { WhatsAppMonitor } from './WhatsAppMonitor'; // Added import
import Settings from './Settings';
import UserManual from './UserManual';

interface MechanicViewProps {
  user: any;
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

export default function MechanicView({ user }: MechanicViewProps) {
  const [activePalette, setActivePalette] = useState<string>(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('psm-mechanic-theme') || 'default';
    }
    return 'default';
  });

  const handlePaletteChange = (pal: string) => {
    setActivePalette(pal);
    localStorage.setItem('psm-mechanic-theme', pal);
  };

  const [activeInternalTab, setActiveInternalTab] = useState<'dashboard' | 'maintenance' | 'wallet' | 'map' | 'warehouse'>('dashboard'); // Updated type
  const [mapSubTab, setMapSubTab] = useState<'map' | 'whatsapp'>('map');
  const [maintenanceSubTab, setMaintenanceSubTab] = useState<'repairs' | 'inventory'>('repairs');
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isManualOpen, setIsManualOpen] = useState(false);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [logs, setLogs] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [panicAlerts, setPanicAlerts] = useState<any[]>([]);
  const [driversMasterList, setDriversMasterList] = useState<any[]>([]);
  const [isAlertsDrawerOpen, setIsAlertsDrawerOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [inventory, setInventory] = useState<any[]>([]);
  const [warehouseSearchTerm, setWarehouseSearchTerm] = useState('');
  const [adminStaffList, setAdminStaffList] = useState<any[]>([]);
  const [salarySheetsList, setSalarySheetsList] = useState<any[]>([]);
  const [activeDriversList, setActiveDriversList] = useState<any[]>([]);
  
  const [formData, setFormData] = useState({
    vehicleId: '',
    prefix: '',
    type: 'Troca de Óleo',
    mileage: '',
    date: new Date().toISOString().split('T')[0],
    cost: '',
    status: 'planned',
    description: '',
    itemId: '',
    itemQty: '1'
  });

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

    const qInventory = query(collection(db, 'warehouse_inventory'), orderBy('name', 'asc'));
    const unsubscribeInventory = onSnapshot(qInventory, (snapshot) => {
      setInventory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'warehouse_inventory');
    });

    const qAdminStaff = query(collection(db, 'administrative_staff'), orderBy('name', 'asc'));
    const unsubscribeAdminStaff = onSnapshot(qAdminStaff, (snapshot) => {
      setAdminStaffList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'administrative_staff');
    });

    const qSalarySheets = query(collection(db, 'salary_sheets'));
    const unsubscribeSalarySheets = onSnapshot(qSalarySheets, (snapshot) => {
      setSalarySheetsList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'salary_sheets');
    });

    const qDrivers = query(collection(db, 'drivers_master'));
    const unsubscribeDrivers = onSnapshot(qDrivers, (snapshot) => {
      setDriversMasterList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'drivers_master');
    });

    const qActiveDrivers = query(collection(db, 'drivers'));
    const unsubscribeActiveDrivers = onSnapshot(qActiveDrivers, (snapshot) => {
      setActiveDriversList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'drivers');
    });

    return () => {
      unsubscribeLogs();
      unsubscribeVehicles();
      unsubscribePanic();
      unsubscribeInventory();
      unsubscribeAdminStaff();
      unsubscribeSalarySheets();
      unsubscribeDrivers();
      unsubscribeActiveDrivers();
    };
  }, []);

  const getDriverPhone = (driverId: string, driverName?: string, prefix?: string, alertPhone?: string) => {
    if (alertPhone) return alertPhone;

    // 1. Try active drivers
    let actMatch = activeDriversList.find(d => d.id === driverId || d.driverId === driverId);
    if (actMatch && actMatch.phone) return actMatch.phone;

    if (prefix && prefix !== 'N/A') {
      actMatch = activeDriversList.find(d => d.prefix === prefix);
      if (actMatch && actMatch.phone) return actMatch.phone;
    }

    if (driverName) {
      actMatch = activeDriversList.find(d => d.name?.toLowerCase() === driverName.toLowerCase() || d.driverName?.toLowerCase() === driverName.toLowerCase());
      if (actMatch && actMatch.phone) return actMatch.phone;
    }

    // 2. Try drivers master
    let match = driversMasterList.find(d => d.id === driverId || d.uid === driverId);
    if (match && match.phone) return match.phone;

    if (driverName) {
      match = driversMasterList.find(d => d.name?.toLowerCase() === driverName.toLowerCase());
      if (match && match.phone) return match.phone;
    }

    return '';
  };

  const getPhoneByPrefix = (prefix: string) => {
    if (!prefix || prefix === 'N/A') return '';

    // 1. Check in active running daily drivers first
    const actMatch = activeDriversList.find(d => d.prefix === prefix);
    if (actMatch && actMatch.phone) return actMatch.phone;

    // 2. Check in driversMasterList second
    const masterMatch = driversMasterList.find(d => d.prefix === prefix);
    if (masterMatch && masterMatch.phone) return masterMatch.phone;

    return '';
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedVehicle = vehicles.find(v => v.id === formData.vehicleId);
    
    try {
      const itemsUsed: any[] = [];
      let selectedItem: any = null;
      const qtyNum = Number(formData.itemQty || 1);

      if (formData.itemId) {
        selectedItem = inventory.find(i => i.id === formData.itemId);
        if (selectedItem) {
          itemsUsed.push({
            itemId: formData.itemId,
            name: selectedItem.name,
            quantity: qtyNum
          });
        }
      }

      const batch = writeBatch(db);
      
      const newLogRef = doc(collection(db, 'maintenance_logs'));
      const isCompleted = formData.status === 'completed';

      const logData = {
        vehicleId: formData.vehicleId,
        type: formData.type,
        mileage: Number(formData.mileage),
        date: formData.date,
        cost: Number(formData.cost),
        status: formData.status,
        description: formData.description,
        prefix: selectedVehicle?.prefix || 'N/A',
        mecanicoId: user.uid,
        mecanicoName: user.name,
        timestamp: new Date().toISOString(),
        itemsUsed: itemsUsed,
        deducted: isCompleted && selectedItem ? true : false
      };

      batch.set(newLogRef, logData);

      // Sincronização em tempo real de stock se a intervenção for concluída no ato de registo
      if (isCompleted && selectedItem) {
        const itemDocRef = doc(db, 'warehouse_inventory', formData.itemId);
        batch.update(itemDocRef, {
          stock: Math.max(0, selectedItem.stock - qtyNum),
          updatedAt: serverTimestamp()
        });

        const logMoveRef = doc(collection(db, 'warehouse_logs'));
        batch.set(logMoveRef, {
          itemId: formData.itemId,
          itemName: selectedItem.name,
          quantity: qtyNum,
          type: 'maintenance',
          timestamp: serverTimestamp(),
          user: user?.name || 'Mecânico Central',
          vehicleId: formData.vehicleId,
          maintenanceId: newLogRef.id
        });
      }

      await batch.commit();

      setIsModalOpen(false);
      setFormData({
        vehicleId: '',
        prefix: '',
        type: 'Troca de Óleo',
        mileage: '',
        date: new Date().toISOString().split('T')[0],
        cost: '',
        status: 'planned',
        description: '',
        itemId: '',
        itemQty: '1'
      });
    } catch (error) {
      console.error("Erro ao adicionar manutenção:", error);
    }
  };

  // Financial Synchronization System for the Mechanic
  const matchedStaff = adminStaffList?.find(staff => 
    (user?.name && staff.name?.toLowerCase().includes(user.name.toLowerCase())) ||
    (user?.email && staff.phone?.toLowerCase().includes(user.email.toLowerCase())) ||
    staff.role?.toLowerCase() === 'mecânico' ||
    staff.role?.toLowerCase() === 'mecanico'
  );

  // Get the latest payroll context from Accounting Manager
  const latestSalarySheet = [...salarySheetsList]
    .sort((a, b) => {
      const dateA = a.createdAt?.seconds ? a.createdAt.seconds : 0;
      const dateB = b.createdAt?.seconds ? b.createdAt.seconds : 0;
      return dateB - dateA;
    })[0];

  // Specific staff record embedded in the current month's payroll sheet
  const latestSalaryStaffEntry = latestSalarySheet?.staff?.find((s: any) => 
    (user?.name && s.name?.toLowerCase().includes(user.name.toLowerCase())) ||
    (matchedStaff?.name && s.name?.toLowerCase() === matchedStaff.name.toLowerCase()) ||
    s.role?.toLowerCase() === 'mecânico' ||
    s.role?.toLowerCase() === 'mecanico'
  );

  // Compute highly accurate financial metrics
  const resolvedBaseSalary = latestSalaryStaffEntry?.baseSalary ?? matchedStaff?.base ?? 75000;
  const resolvedSubsDetails = latestSalaryStaffEntry 
    ? ((latestSalaryStaffEntry.subsAliment || 0) + (latestSalaryStaffEntry.subsTransp || 0)) 
    : (matchedStaff?.subs ?? 25000);

  const resolvedNetSalary = latestSalaryStaffEntry?.netSalary ?? (resolvedBaseSalary + resolvedSubsDetails);
  const resolvedInss = latestSalaryStaffEntry?.inssEmployee ?? (resolvedBaseSalary * 0.03);
  const resolvedStatus = latestSalaryStaffEntry?.status ?? latestSalarySheet?.status ?? 'Ativo (Base)';
  const resolvedMonth = latestSalarySheet?.month ?? 'Mês Corrente';

  const menuItems = [
    { icon: SettingsIcon, label: 'Definições', onClick: () => setIsSettingsOpen(true) },
    { icon: FileText, label: 'Documentação', onClick: () => setIsManualOpen(true) },
    { icon: LogOut, label: 'Sair do Sistema', onClick: () => signOut(auth), color: 'text-red-500' },
  ];

  return (
    <div 
      className="flex flex-col h-[100dvh] bg-slate-950 text-slate-100 overflow-hidden font-sans transition-colors duration-300"
      style={STAFF_PALETTES[activePalette as keyof typeof STAFF_PALETTES]?.vars as any}
    >
      {/* Header Mobile Style */}
      <header className="bg-slate-900 border-b border-slate-800 px-4 sm:px-6 py-4 flex items-center justify-between flex-shrink-0 shadow-lg transition-colors duration-300">
        <div className="flex items-center gap-3">
          <div className="w-9 h-9 sm:w-10 sm:h-10 bg-brand-primary rounded-xl flex items-center justify-center text-white shadow-lg overflow-hidden border border-brand-primary/20 shadow-brand-primary/25 shrink-0 transition-colors duration-300">
            <Wrench size={20} />
          </div>
          <div className="min-w-0 pr-2">
            <div className="flex items-center gap-2 mb-1">
              <h1 className="text-[10px] font-black text-slate-500 uppercase tracking-[0.2em] leading-none truncate">Mecânico Oficial</h1>
              <div className="flex gap-1 shrink-0">
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
            <p className="text-sm font-black text-white uppercase tracking-tighter truncate max-w-[150px]">{user?.name || 'Oficina Central'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button 
            onClick={() => setIsAlertsDrawerOpen(true)}
            className={cn(
              "relative p-2 rounded-xl transition-all flex items-center justify-center cursor-pointer",
              panicAlerts.length > 0 
                ? "text-red-500 bg-red-500/10 hover:bg-red-500/20 border border-red-500/20 animate-bounce" 
                : "text-slate-400 hover:text-white bg-slate-800/40 border border-slate-800/60"
            )}
            title={panicAlerts.length > 0 ? `${panicAlerts.length} Alertas Ativos` : "Sem Alertas"}
          >
            <Bell size={20} className={panicAlerts.length > 0 ? "animate-pulse" : ""} />
            {panicAlerts.length > 0 ? (
              <span className="absolute -top-1 -right-1 min-w-[16px] h-4 px-1 bg-red-600 text-white rounded-full text-[9px] font-black flex items-center justify-center border border-slate-900">
                {panicAlerts.length}
              </span>
            ) : null}
          </button>
          <button 
            onClick={() => setIsMenuOpen(true)}
            className="p-2 text-white hover:bg-slate-800 border border-slate-800 rounded-lg transition-colors"
          >
            <Menu size={24} />
          </button>
        </div>
      </header>

      {/* Main Content Area */}
      <main className="flex-1 overflow-y-auto p-5 custom-scrollbar pb-24 bg-slate-950">
        {activeInternalTab === 'dashboard' && (
          <div className="space-y-6">
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

            {/* Quick Stats Grid */}
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 bg-blue-500/10 text-blue-400 rounded-lg flex items-center justify-center border border-blue-500/20">
                    <Clock size={16} />
                  </div>
                </div>
                <p className="text-[9px] font-black text-slate-550 uppercase tracking-widest leading-tight">Manutenções<br/>Pendentes</p>
                <p className="text-xl font-black text-white mt-1">{logs.filter(l => l.status === 'planned').length}</p>
              </div>
              <div className="bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-sm">
                <div className="flex items-center justify-between mb-2">
                  <div className="w-8 h-8 bg-amber-500/10 text-amber-400 rounded-lg flex items-center justify-center border border-amber-500/20">
                    <AlertCircle size={16} />
                  </div>
                </div>
                <p className="text-[9px] font-black text-slate-550 uppercase tracking-widest leading-tight">Stock<br/>Baixo</p>
                <p className="text-xl font-black text-white mt-1">
                  {inventory.filter(item => item.stock <= (item.min ?? 5)).length.toString().padStart(2, '0')}
                </p>
              </div>
            </div>

            {/* Panic Alerts for Mechanic */}
            {panicAlerts.length > 0 && (
              <div className="space-y-4">
                <h3 className="text-[10px] font-black text-rose-500 uppercase tracking-widest px-1 flex items-center gap-2 animate-bounce">
                  <AlertCircle size={14} /> Alertas de Pânico Ativos
                </h3>
                <div className="space-y-3">
                  {panicAlerts.map(alert => {
                    const phone = getDriverPhone(alert.driverId, alert.driverName, alert.prefix, alert.driverPhone || alert.phone);
                    return (
                      <motion.div 
                        key={alert.id}
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        className="bg-rose-50 border-2 border-rose-200 p-4 rounded-2xl flex items-center justify-between shadow-lg shadow-rose-200/50"
                      >
                        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setActiveInternalTab('map')}>
                           <div className="w-10 h-10 bg-rose-600 text-white rounded-xl flex items-center justify-center animate-pulse shadow-lg">
                             <Truck size={20} />
                           </div>
                           <div>
                              <p className="text-xs font-black text-rose-900 uppercase tracking-tight">SOS: {alert.prefix || 'N/A'}</p>
                              <p className="text-[9px] text-rose-500 font-bold uppercase tracking-widest leading-none mt-1">{alert.driverName || 'Motorista'}</p>
                           </div>
                        </div>
                        <div className="flex items-center gap-2">
                          {phone ? (
                            <a 
                              href={`tel:${phone}`}
                              className="flex items-center gap-1.5 px-3 py-2 bg-emerald-500 hover:bg-emerald-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all font-mono shadow-md"
                            >
                              <Phone size={11} fill="currentColor" />
                              Ligar Já
                            </a>
                          ) : (
                            <span className="text-[8px] font-bold text-slate-400 italic">S/ Contacto</span>
                          )}
                          <button 
                            onClick={() => setActiveInternalTab('map')}
                            className="p-2 bg-slate-100 hover:bg-slate-200 text-brand-primary rounded-xl transition-all"
                            title="Localizar no Mapa"
                          >
                            <Map size={16} className="text-rose-600" />
                          </button>
                        </div>
                      </motion.div>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Next Maintenance Log Section */}
            <div>
              <div className="flex items-center justify-between mb-4 px-1">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Últimos Registos</h3>
                <button onClick={() => setActiveInternalTab('maintenance')} className="text-[9px] font-black text-brand-primary uppercase underline">Ver Tudo</button>
              </div>
              <div className="space-y-3">
                {logs.slice(0, 3).map((log) => {
                  const phone = getPhoneByPrefix(log.prefix);
                  return (
                    <div key={log.id} className="bg-slate-900 p-4 rounded-2xl border border-slate-800 flex items-center justify-between shadow-sm shadow-black/15 text-white">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 bg-slate-950 text-brand-primary rounded-xl flex items-center justify-center text-slate-400 font-black text-xs border border-slate-800 shadow-sm">
                          {log.prefix}
                        </div>
                        <div>
                          <p className="text-[11px] font-black text-white uppercase tracking-tight">{log.type}</p>
                          <p className="text-[9px] text-slate-500 font-bold uppercase">{log.date}</p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {phone && (
                          <a 
                            href={`tel:${phone}`}
                            title={`Ligar para motorista da Viatura ${log.prefix}`}
                            className="w-7 h-7 bg-emerald-500/10 hover:bg-emerald-500/20 active:scale-95 border border-emerald-500/30 rounded-lg flex items-center justify-center text-emerald-400 transition-all cursor-pointer"
                          >
                            <Phone size={12} fill="currentColor" fillOpacity={0.2} />
                          </a>
                        )}
                        <span className={cn(
                          "px-2 py-0.5 rounded text-[8px] font-black uppercase tracking-widest border",
                          log.status === 'completed' ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" : "bg-amber-500/15 text-amber-400 border-amber-500/25 animate-pulse"
                        )}>
                          {log.status === 'completed' ? 'Ok' : 'Pendente'}
                        </span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {activeInternalTab === 'map' && (
          <div className="h-full flex flex-col -m-5">
             <div className="p-4 bg-slate-900 border-b border-slate-800 flex items-center justify-between text-white flex-shrink-0">
                <h2 className="text-lg font-black text-white uppercase tracking-tighter italic">Mapa & WhatsApp</h2>
                <button 
                  onClick={() => {
                    setActiveInternalTab('dashboard');
                  }}
                  className="p-2 transition-all active:scale-95 text-slate-400 hover:text-white"
                >
                  <X size={20} />
                </button>
             </div>
             
             {/* Subtab Selector */}
             <div className="bg-slate-950 p-2 border-b border-slate-900 flex gap-2 flex-shrink-0">
                <button
                  onClick={() => setMapSubTab('map')}
                  className={cn(
                    "flex-1 py-3 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2",
                    mapSubTab === 'map' ? "bg-white text-slate-950 font-black shadow-lg" : "bg-slate-900 text-slate-400 hover:text-white"
                  )}
                >
                  <Map size={14} className={mapSubTab === 'map' ? "text-slate-950" : "text-brand-primary"} />
                  Mapa Frota
                </button>
                <button
                  onClick={() => setMapSubTab('whatsapp')}
                  className={cn(
                    "flex-1 py-3 px-3 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-2",
                    mapSubTab === 'whatsapp' ? "bg-white text-slate-950 font-black shadow-lg" : "bg-slate-900 text-slate-400 hover:text-white"
                  )}
                >
                  <MessageSquare size={14} className={mapSubTab === 'whatsapp' ? "text-slate-950" : "text-emerald-400"} />
                  WhatsApp
                </button>
             </div>

             <div className="flex-1 relative overflow-hidden">
                {mapSubTab === 'map' ? (
                   <RealTimeMap />
                ) : (
                   <div className="h-full overflow-hidden flex flex-col">
                      <WhatsAppMonitor isMechanicView={true} />
                   </div>
                )}
             </div>
          </div>
        )}

        {activeInternalTab === 'maintenance' && (
          <div className="space-y-6">
            {/* Sub-tab Selector */}
            <div className="flex bg-slate-900 p-1.5 rounded-2xl border border-slate-800/80 gap-1 shadow-inner flex-shrink-0">
               <button
                 onClick={() => setMaintenanceSubTab('repairs')}
                 className={cn(
                   "flex-1 py-3 px-1 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 focus:outline-none",
                   maintenanceSubTab === 'repairs' ? "bg-white text-slate-950 font-black shadow-lg" : "text-slate-400 hover:text-white"
                 )}
               >
                 <Wrench size={12} className={maintenanceSubTab === 'repairs' ? "text-slate-950" : "text-brand-primary"} />
                 Oficina & Reparos
               </button>
               <button
                 onClick={() => setMaintenanceSubTab('inventory')}
                 className={cn(
                   "flex-1 py-3 px-1 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all flex items-center justify-center gap-1.5 focus:outline-none",
                   maintenanceSubTab === 'inventory' ? "bg-white text-slate-950 font-black shadow-lg" : "text-slate-400 hover:text-white"
                 )}
               >
                 <Package size={12} className={maintenanceSubTab === 'inventory' ? "text-slate-950" : "text-brand-primary"} />
                 Peças Stock
               </button>
            </div>

            {maintenanceSubTab === 'repairs' ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between px-1">
                  <h2 className="text-lg font-black text-white uppercase tracking-tighter italic">Lista de Reparos</h2>
                  <button 
                    onClick={() => setIsModalOpen(true)}
                    className="bg-brand-primary text-white p-2 rounded-xl shadow-lg shadow-brand-primary/20"
                  >
                    <Plus size={20} />
                  </button>
                </div>

                <div className="relative mb-4">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                  <input 
                    type="text" 
                    placeholder="PROCURAR REPARO..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-slate-900 border border-slate-800 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm outline-none focus:border-brand-primary text-white placeholder:text-slate-500"
                  />
                </div>
                
                <div className="space-y-3">
                  {logs.filter(log => 
                    log.prefix?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    log.type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
                    log.description?.toLowerCase().includes(searchTerm.toLowerCase())
                  ).map((log) => {
                    const phone = getPhoneByPrefix(log.prefix);
                    return (
                      <motion.div 
                         initial={{ opacity: 0, y: 10 }}
                         animate={{ opacity: 1, y: 0 }}
                         key={log.id} 
                         className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-sm relative overflow-hidden"
                      >
                        <div className="flex items-start justify-between mb-3">
                           <div className="flex items-center gap-3">
                              <div className="w-12 h-12 bg-slate-950 rounded-2xl flex items-center justify-center text-brand-primary font-black text-sm border border-slate-800 shadow-sm">
                                 {log.prefix}
                              </div>
                              <div>
                                  <p className="text-[9px] font-black text-slate-500 uppercase tracking-widest mb-0.5">{log.type}</p>
                                  <h4 className="text-xs font-black text-white uppercase tracking-tight">{log.date}</h4>
                              </div>
                           </div>
                           <div className="flex items-center gap-2">
                              {phone && (
                                <a 
                                  href={`tel:${phone}`}
                                  title={`Ligar para o motorista da Viatura ${log.prefix}`}
                                  className="px-2.5 py-1.5 bg-emerald-500 hover:bg-emerald-600 active:scale-95 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all font-mono shadow-sm flex items-center gap-1 cursor-pointer"
                                >
                                  <Phone size={10} fill="currentColor" fillOpacity={0.2} />
                                  Ligar
                                </a>
                              )}
                              <span className={cn(
                                 "px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-widest border",
                                 log.status === 'completed' ? "bg-emerald-500/15 text-emerald-400 border-emerald-500/25" : "bg-amber-500/15 text-amber-400 border-amber-500/25"
                              )}>
                                 {log.status === 'completed' ? 'Concluído' : 'Pendente'}
                              </span>
                           </div>
                        </div>
                      <div className="text-[10px] text-slate-350 font-bold uppercase leading-relaxed mb-4 bg-slate-950 p-3 rounded-xl border border-slate-850">
                        {log.description || 'Nenhum detalhe adicional registado.'}
                      </div>
                      <div className="flex items-center justify-between border-t border-slate-800/60 pt-3">
                         <div className="flex items-center gap-2">
                            <TrendingUp size={12} className="text-slate-500" />
                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-tight">{log.cost?.toLocaleString()} Kz</span>
                         </div>
                         <div className="flex items-center gap-2">
                            <Truck size={12} className="text-slate-500" />
                            <span className="text-[10px] font-black text-slate-300 uppercase tracking-tight">{log.mileage?.toLocaleString()} KM</span>
                         </div>
                      </div>
                    </motion.div>
                    );
                  })}
                </div>
              </div>
            ) : (
              <div className="space-y-4">
                <h2 className="text-lg font-black text-white uppercase tracking-tighter italic px-1">Peças em Stock</h2>
                
                <div className="relative mb-4">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-500" size={16} />
                  <input 
                    type="text" 
                    placeholder="PROCURAR PEÇA..."
                    value={warehouseSearchTerm}
                    onChange={(e) => setWarehouseSearchTerm(e.target.value)}
                    className="w-full pl-12 pr-4 py-4 bg-slate-900 border border-slate-800 rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-sm outline-none focus:border-brand-primary text-white placeholder:text-slate-500"
                  />
                </div>

                <div className="space-y-3">
                  {inventory.filter(item => 
                    item.name?.toLowerCase().includes(warehouseSearchTerm.toLowerCase()) ||
                    item.category?.toLowerCase().includes(warehouseSearchTerm.toLowerCase()) ||
                    item.id?.toLowerCase().includes(warehouseSearchTerm.toLowerCase())
                  ).map((item) => (
                    <div key={item.id} className="bg-slate-900 p-5 rounded-2xl border border-slate-800 shadow-sm flex items-center justify-between">
                       <div className="flex items-center gap-4">
                          <div className="w-10 h-10 bg-slate-950 text-slate-400 rounded-xl flex items-center justify-center border border-slate-800">
                            <Package size={20} />
                          </div>
                          <div>
                            <p className="text-[9px] font-black text-brand-primary uppercase tracking-widest">{item.id?.slice(0, 7).toUpperCase()}</p>
                            <h4 className="text-xs font-black text-white uppercase tracking-tight">{item.name}</h4>
                            <span className="text-[9px] text-slate-500 font-bold uppercase">{item.category}</span>
                          </div>
                       </div>
                       <div className="text-right">
                          <p className="text-xs font-black text-white tracking-tight">{item.stock} {item.unit || 'UN'}</p>
                          {item.stock <= (item.min ?? 5) ? (
                             <span className="text-[8px] font-black text-red-500 uppercase">Repor</span>
                          ) : (
                             <span className="text-[8px] font-black text-emerald-400 uppercase font-mono tracking-widest">OK</span>
                          )}
                       </div>
                    </div>
                  ))}
                  {inventory.length === 0 && (
                    <div className="text-center py-8 text-slate-500 text-xs font-black uppercase tracking-widest">
                      Nenhuma peça cadastrada no armazém.
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}


        {activeInternalTab === 'wallet' && (
          <div className="space-y-6">
             <div className="bg-slate-900 border border-slate-850 rounded-[2.5rem] p-8 text-center text-white shadow-2xl relative overflow-hidden">
                <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/20 translate-y-10" />
                <div className="flex justify-end mb-2 relative">
                   <span className="text-[8px] font-black tracking-widest bg-brand-primary/10 border border-brand-primary/25 text-brand-primary px-3 py-1 rounded-full uppercase leading-none italic">
                     Ref: {resolvedMonth}
                   </span>
                </div>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.3em] mb-2 relative">Remuneração Recebida (Líquida)</p>
                <h3 className="text-4xl font-black tracking-tighter mb-2 relative italic text-white">
                  {resolvedNetSalary.toLocaleString('pt-AO')} <span className="text-lg">Kz</span>
                </h3>
                <div className="inline-flex items-center gap-2 bg-emerald-500/15 border border-emerald-500/25 text-emerald-400 px-4 py-1.5 rounded-full relative text-[9px] font-black uppercase tracking-widest italic">
                    <div className="w-1.5 h-1.5 bg-emerald-400 rounded-full animate-pulse" />
                    Sincronizado com a Área Financeira
                </div>
             </div>

             <div className="space-y-4">
                <h3 className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Detalhamento Sincronizado</h3>
                <div className="bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden shadow-sm">
                   {[
                     { label: 'Salário Base do Mecânico', value: `${resolvedBaseSalary.toLocaleString('pt-AO')} Kz`, isHighlight: false },
                     { label: 'Subsídios de Logística', value: `${resolvedSubsDetails.toLocaleString('pt-AO')} Kz`, isHighlight: false },
                     { label: 'Desconto Segurança Social (INSS 3%)', value: `- ${resolvedInss.toLocaleString('pt-AO')} Kz`, isDeduction: true },
                     { 
                       label: 'Estado na Folha de Salários', 
                       value: resolvedStatus === 'draft' || resolvedStatus === 'pending' ? 'Processado (Rascunho)' : 'Aprovado & Liquidado', 
                       isStatus: true,
                       statusClass: resolvedStatus === 'draft' || resolvedStatus === 'pending' ? 'text-amber-400' : 'text-emerald-400'
                     }
                   ].map((row, idx) => (
                     <div key={idx} className={cn("px-6 py-4 flex items-center justify-between", idx !== 3 && "border-b border-slate-800/60")}>
                        <span className="text-[10px] font-black text-slate-500 uppercase tracking-tight">{row.label}</span>
                        <span className={cn(
                          "text-[11px] font-black uppercase tracking-tight",
                          row.isDeduction ? "text-rose-500" : row.isStatus ? row.statusClass : "text-white"
                        )}>{row.value}</span>
                     </div>
                   ))}
                </div>
                <div className="p-4 bg-slate-900/50 border border-slate-850 rounded-2xl flex items-center gap-3">
                   <div className="w-8 h-8 rounded-xl bg-brand-primary/10 flex items-center justify-center text-brand-primary">
                      <Wallet size={14} />
                   </div>
                   <div>
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Metodologia de Pagamento</p>
                      <p className="text-[11px] font-black text-white uppercase tracking-tight mt-0.5">Transferência Automática (IBAN Registado)</p>
                   </div>
                </div>
             </div>
          </div>
        )}

      </main>

      {/* Tab Bar Mechanic Style */}
      <footer className="h-20 bg-slate-900 border-t border-slate-800 flex items-center justify-around px-4 flex-shrink-0 relative z-50">
        <button 
          onClick={() => setActiveInternalTab('dashboard')}
          className={cn("flex flex-col items-center gap-1 transition-all duration-300", activeInternalTab === 'dashboard' ? "text-brand-primary scale-110" : "text-slate-500")}
        >
          <Activity size={22} strokeWidth={activeInternalTab === 'dashboard' ? 3 : 2} />
          <span className="text-[8px] font-black uppercase tracking-widest">Início</span>
        </button>
        <button 
          onClick={() => setActiveInternalTab('maintenance')}
          className={cn("flex flex-col items-center gap-1 transition-all duration-300", activeInternalTab === 'maintenance' ? "text-brand-primary scale-110" : "text-slate-500")}
        >
          <History size={22} strokeWidth={activeInternalTab === 'maintenance' ? 3 : 2} />
          <span className="text-[8px] font-black uppercase tracking-widest">Oficina</span>
        </button>
        <button 
          onClick={() => setActiveInternalTab('map')}
          className={cn("flex flex-col items-center gap-1 transition-all duration-300", activeInternalTab === 'map' ? "text-brand-primary scale-110" : "text-slate-500")}
        >
          <Map size={22} strokeWidth={activeInternalTab === 'map' ? 3 : 2} />
          <span className="text-[8px] font-black uppercase tracking-widest">Mapa</span>
        </button>
        <button 
          onClick={() => setActiveInternalTab('wallet')}
          className={cn("flex flex-col items-center gap-1 transition-all duration-300", activeInternalTab === 'wallet' ? "text-brand-primary scale-110" : "text-slate-500")}
        >
          <Wallet size={22} strokeWidth={activeInternalTab === 'wallet' ? 3 : 2} />
          <span className="text-[8px] font-black uppercase tracking-widest">Pagos</span>
        </button>
      </footer>


      {/* Full-Screen Overlays */}

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
              className="fixed top-0 right-0 h-full w-4/5 max-w-[300px] bg-slate-900 border-l border-slate-800 z-[70] shadow-2xl p-8 flex flex-col text-white"
            >
              <div className="flex items-center justify-between mb-10">
                 <h3 className="text-xl font-black text-white uppercase tracking-tighter italic">Definições</h3>
                 <button onClick={() => setIsMenuOpen(false)} className="p-2 bg-slate-800 text-slate-400 hover:text-white rounded-full">
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
                      "w-full flex items-center justify-between p-4 rounded-2xl hover:bg-slate-800 transition-all active:scale-95 border border-transparent hover:border-slate-800",
                      item.color || "text-slate-200"
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
              
              <div className="mt-auto pt-8 border-t border-slate-800 text-center">
                 <p className="text-[9px] font-black text-slate-500 uppercase tracking-[0.2em]">PSM COMERCIAL LUENA</p>
                 <p className="text-[9px] font-medium text-slate-500 mt-1 uppercase">TaxiControl Version 2.0</p>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

      {/* Alerts Drawer Overlay */}
      <AnimatePresence>
        {isAlertsDrawerOpen && (
          <>
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAlertsDrawerOpen(false)}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[110]"
            />
            <motion.div 
              initial={{ y: '100%' }}
              animate={{ y: 0 }}
              exit={{ y: '100%' }}
              transition={{ type: 'spring', damping: 25, stiffness: 200 }}
              className="fixed bottom-0 left-0 right-0 max-h-[85vh] bg-slate-900 border-t border-slate-800 rounded-t-[2.5rem] z-[120] shadow-2xl flex flex-col overflow-hidden text-white"
            >
              {/* Drawer Handle */}
              <div className="w-12 h-1.5 bg-slate-800 rounded-full mx-auto my-4 shrink-0 cursor-pointer" onClick={() => setIsAlertsDrawerOpen(false)} />
              
              <div className="px-6 pb-4 border-b border-slate-800 flex items-center justify-between">
                <div>
                   <h3 className="text-lg font-black text-white uppercase italic tracking-tighter flex items-center gap-2">
                     <AlertCircle size={20} className={panicAlerts.length > 0 ? "text-red-500 animate-pulse" : "text-emerald-500"} />
                     Painel de Alertas
                   </h3>
                   <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider mt-0.5">Veículos & Pânico S.O.S Activo</p>
                </div>
                <button 
                  onClick={() => setIsAlertsDrawerOpen(false)} 
                  className="p-2.5 bg-slate-800 text-slate-400 hover:text-white rounded-full transition-all"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="flex-1 overflow-y-auto p-6 space-y-4 custom-scrollbar pb-12 text-left">
                 {panicAlerts.length > 0 ? (
                   <div className="space-y-3">
                     <div className="bg-red-500/10 border border-red-500/20 p-4 rounded-2xl flex items-center gap-3">
                       <AlertTriangle className="text-red-500 animate-pulse shrink-0" size={24} />
                       <div className="text-left text-xs text-red-200">
                          <p className="font-black uppercase tracking-wide">ALERTA S.O.S DE EMERGÊNCIA OPERACIONAL</p>
                          <p className="font-semibold text-[10px] text-red-300/80 mt-0.5">Há {panicAlerts.length} viatura(s) reportando situação de pânico activa.</p>
                       </div>
                     </div>

                     {panicAlerts.map(alert => {
                       const phone = getDriverPhone(alert.driverId, alert.driverName, alert.prefix, alert.driverPhone || alert.phone);
                       return (
                         <div 
                           key={alert.id}
                           className="bg-slate-950/80 border border-slate-800/80 p-5 rounded-3xl flex flex-col space-y-4 relative overflow-hidden"
                         >
                           <div className="flex items-start justify-between">
                              <div className="flex items-center gap-3.5">
                                 <div className="w-12 h-12 bg-red-650/10 text-red-500 rounded-2xl flex items-center justify-center border border-red-550/25 animate-pulse shrink-0">
                                   <Truck size={22} className="text-red-500 animate-pulse" />
                                 </div>
                                 <div className="text-left">
                                    <p className="text-[10px] font-black tracking-widest text-red-500 uppercase">S.O.S VEÍCULO {alert.prefix || 'N/A'}</p>
                                    <h4 className="text-md font-black text-white uppercase tracking-tight mt-0.5">{alert.driverName || 'Motorista'}</h4>
                                    <p className="text-[9px] text-slate-500 font-bold uppercase tracking-wider mt-1">{alert.timestamp ? new Date(alert.timestamp?.seconds * 1000).toLocaleString() : 'Sem hora registada'}</p>
                                 </div>
                              </div>
                              <span className="px-3 py-1 bg-red-500 text-white rounded-full text-[9px] font-black uppercase tracking-widest animate-pulse font-mono">
                                 Crítico
                              </span>
                           </div>

                           {alert.locationDetails && (
                             <div className="bg-slate-900 border border-slate-850 p-3 rounded-xl text-left">
                               <p className="text-[9px] text-slate-500 font-black uppercase tracking-wider">Localização GPS:</p>
                               <span className="text-[10px] font-semibold text-slate-300 uppercase mt-1 block">{alert.locationDetails}</span>
                             </div>
                           )}

                           <div className="flex items-center gap-3 pt-1">
                             {phone && (
                               <a 
                                 href={`tel:${phone}`}
                                 className="flex-1 flex items-center justify-center gap-2 py-3 bg-emerald-500 hover:bg-emerald-600 font-mono active:scale-95 transition-all text-white rounded-2xl text-[10px] font-black uppercase tracking-widest shadow-lg shadow-emerald-500/15 cursor-pointer"
                               >
                                 <Phone size={12} fill="currentColor" />
                                 Telefona {phone}
                               </a>
                             )}
                             <button
                               onClick={() => {
                                 setActiveInternalTab('map');
                                 setIsAlertsDrawerOpen(false);
                               }}
                               className="flex-1 py-3 bg-slate-850 hover:bg-slate-800 hover:text-white active:scale-95 transition-all text-slate-350 rounded-2xl text-[10px] font-black uppercase tracking-widest border border-slate-755 cursor-pointer"
                             >
                               Ver no Mapa
                             </button>
                           </div>
                         </div>
                       );
                     })}
                   </div>
                 ) : (
                   <div className="flex flex-col items-center justify-center py-14 text-center">
                      <div className="w-16 h-16 bg-emerald-500/10 text-emerald-400 rounded-3xl flex items-center justify-center mb-5 border border-emerald-500/20 shadow-xl shadow-emerald-500/5">
                         <Bell size={28} className="text-emerald-400 animate-pulse" />
                      </div>
                      <h4 className="text-sm font-black uppercase tracking-wider text-slate-100">Céu Limpo nas Operações!</h4>
                      <p className="text-xs text-slate-500 font-bold uppercase tracking-widest max-w-[280px] mt-2 leading-relaxed">
                         Nenhum pânico ou alerta crítico ativo no Luena-Moxico neste momento.
                      </p>
                      
                      <button 
                        onClick={() => setIsAlertsDrawerOpen(false)}
                        className="mt-8 px-6 py-3.5 bg-slate-800 hover:bg-slate-750 active:scale-95 transition-all text-slate-350 hover:text-white rounded-2xl text-[10px] font-black uppercase tracking-widest border border-slate-700 cursor-pointer"
                      >
                        Fechar Alertas
                      </button>
                   </div>
                 )}
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

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
              className="relative w-full bg-slate-900 border border-slate-800 rounded-t-[2.5rem] rounded-b-2xl p-8 max-h-[90vh] overflow-y-auto custom-scrollbar shadow-2xl text-white"
            >
              <div className="flex items-center justify-between mb-8 pb-4 border-b border-slate-800">
                 <div>
                   <h3 className="text-xl font-black text-white uppercase tracking-tighter italic">Nova Intervenção</h3>
                   <p className="text-[9px] text-slate-500 font-bold uppercase tracking-widest mt-1">Registo Técnico de Oficina</p>
                 </div>
                 <button onClick={() => setIsModalOpen(false)} className="p-2 bg-slate-800 rounded-full text-slate-400 hover:text-white">
                   <X size={18} />
                 </button>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5 pb-8">
                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Viatura em Reparação</label>
                    <select 
                      required
                      value={formData.vehicleId}
                      onChange={(e) => setFormData({...formData, vehicleId: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-xs font-black uppercase text-white outline-none focus:border-brand-primary shadow-sm"
                    >
                      <option value="" className="bg-slate-900 text-white">Seleccionar Viatura...</option>
                      {vehicles.map(v => (
                        <option key={v.id} value={v.id} className="bg-slate-900 text-white">{v.prefix} - {v.name}</option>
                      ))}
                    </select>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                       <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Serviço</label>
                       <select 
                         required
                         value={formData.type}
                         onChange={(e) => setFormData({...formData, type: e.target.value})}
                         className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-xs font-black uppercase text-white outline-none focus:border-brand-primary"
                       >
                         <option value="Troca de Óleo" className="bg-slate-900 text-white">Troca de Óleo</option>
                         <option value="Travões" className="bg-slate-900 text-white">Travões</option>
                         <option value="Pneus" className="bg-slate-900 text-white">Pneus</option>
                         <option value="Outro" className="bg-slate-900 text-white">Outro</option>
                       </select>
                    </div>
                    <div className="space-y-1.5">
                       <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">KM Atual</label>
                       <input 
                         type="number"
                         required
                         value={formData.mileage}
                         onChange={(e) => setFormData({...formData, mileage: e.target.value})}
                         className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-xs font-black text-white outline-none focus:border-brand-primary"
                         placeholder="Ex: 50.000"
                       />
                    </div>
                 </div>

                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                       <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Data</label>
                       <input 
                         type="date"
                         required
                         value={formData.date}
                         onChange={(e) => setFormData({...formData, date: e.target.value})}
                         className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-xs font-black text-white outline-none focus:border-brand-primary"
                       />
                    </div>
                    <div className="space-y-1.5">
                       <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Custo (Kz)</label>
                       <input 
                         type="number"
                         required
                         value={formData.cost}
                         onChange={(e) => setFormData({...formData, cost: e.target.value})}
                         className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-xs font-black text-white outline-none focus:border-brand-primary"
                         placeholder="10.000"
                       />
                    </div>
                 </div>

                 {/* Select Pieces/Spare Parts Option */}
                 <div className="bg-slate-950/40 p-5 rounded-[1.5rem] border border-slate-800/80 space-y-4">
                    <p className="text-[10px] font-black uppercase tracking-widest text-brand-primary">Peça / Item do Armazém Utilizado</p>
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                       <div className="md:col-span-2 space-y-1.5">
                          <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Seleccionar Artigo</label>
                          <select 
                            value={formData.itemId}
                            onChange={(e) => setFormData({...formData, itemId: e.target.value})}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs font-black uppercase text-white outline-none focus:border-brand-primary"
                          >
                            <option value="" className="bg-slate-900 text-white">Nenhuma Peça Selecionada</option>
                            {inventory.map(item => (
                              <option key={item.id} value={item.id} disabled={item.stock === 0} className="bg-slate-900 text-white">
                                {item.sku ? `[${item.sku}] ` : ''}{item.name} ({item.stock} un. stock)
                              </option>
                            ))}
                          </select>
                       </div>
                       <div className="space-y-1.5">
                          <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Quantidade</label>
                          <input 
                            type="number"
                            min="1"
                            required={!!formData.itemId}
                            value={formData.itemQty}
                            onChange={(e) => setFormData({...formData, itemQty: e.target.value})}
                            className="w-full bg-slate-950 border border-slate-800 rounded-xl px-4 py-3 text-xs font-black text-white outline-none focus:border-brand-primary"
                            placeholder="1"
                          />
                       </div>
                    </div>
                 </div>

                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Status</label>
                    <select 
                      required
                      value={formData.status}
                      onChange={(e) => setFormData({...formData, status: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-4 text-xs font-black uppercase text-white outline-none focus:border-brand-primary"
                    >
                      <option value="planned" className="bg-slate-900 text-white">Pendente / Aberto</option>
                      <option value="completed" className="bg-slate-900 text-white">Concluído / Resolvido</option>
                    </select>
                 </div>

                 <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Notas Técnicas</label>
                    <textarea 
                      rows={3}
                      value={formData.description}
                      onChange={(e) => setFormData({...formData, description: e.target.value})}
                      className="w-full bg-slate-950 border border-slate-800 rounded-2xl px-5 py-3 text-xs font-bold text-white outline-none focus:border-brand-primary resize-none placeholder:text-slate-600"
                      placeholder="Descreva o problema ou reparo..."
                    />
                 </div>

                 <button 
                  type="submit"
                  className="w-full bg-brand-primary hover:bg-brand-primary/95 text-white py-5 rounded-2xl text-[11px] font-black uppercase tracking-widest shadow-lg shadow-brand-primary/20 transition-all active:scale-95 mt-4"
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
