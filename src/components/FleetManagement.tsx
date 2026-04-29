import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Car, 
  Phone, 
  Plus, 
  Search, 
  MoreHorizontal, 
  Trash2, 
  Edit3,
  FileText,
  TrendingUp,
  UserPlus,
  Hash,
  Activity,
  ChevronDown,
  ChevronUp,
  Clock,
  MapPin as MapPinIcon,
  X,
  Loader2,
  MessageSquare,
  PhoneIncoming,
  Mail,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, query, orderBy, serverTimestamp, updateDoc, arrayRemove, limit, getDocs, where, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { formatSafe } from '../lib/dateUtils';
import { cn } from '../lib/utils';

export default function FleetManagement({ user }: { user?: any }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [selectedDriverForShift, setSelectedDriverForShift] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [shiftError, setShiftError] = useState<string | null>(null);

  const isContabilista = user?.role === 'contabilista';
  const isMecanico = user?.role === 'mecanico';
  const canScale = !isContabilista && !isMecanico;
  
  // Real Firestore vehicles, master drivers and shifts
  const [firestoreDrivers, setFirestoreDrivers] = useState<any[]>([]); // Vehicles
  const [masterDriversList, setMasterDriversList] = useState<any[]>([]);
  const [masterVehicles, setMasterVehicles] = useState<any[]>([]);
  const [psmPhones, setPsmPhones] = useState<any[]>([]);
  const [systemUsers, setSystemUsers] = useState<any[]>([]);
  const [shiftHistory, setShiftHistory] = useState<any[]>([]);
  const [allCalls, setAllCalls] = useState<any[]>([]);
  const [allMessages, setAllMessages] = useState<any[]>([]);
  
  const [scaleError, setScaleError] = useState<string | null>(null);
  
  const [newDriver, setNewDriver] = useState({
    name: '',
    phone: '',
    secondaryPhone: '',
    prefix: '',
    plate: '',
    trackerId: '',
  });

  const [shiftData, setShiftData] = useState({
    mainPhone: '',
    secondaryPhone: '',
    rendaValue: 5000,
  });

  useEffect(() => {
    const qVehicles = query(collection(db, 'drivers'));
    const unsubVehicles = onSnapshot(qVehicles, (snapshot) => {
      setFirestoreDrivers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'drivers'));

    const qMaster = query(collection(db, 'drivers_master'), orderBy('name', 'asc'));
    const unsubMaster = onSnapshot(qMaster, (snapshot) => {
      setMasterDriversList(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'drivers_master'));

    const qMasterVehicles = query(collection(db, 'master_vehicles'), orderBy('prefix', 'asc'));
    const unsubMasterVehicles = onSnapshot(qMasterVehicles, (snapshot) => {
      setMasterVehicles(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'master_vehicles'));

    const qShifts = query(collection(db, 'shifts'), orderBy('timestamp', 'desc'));
    const unsubShifts = onSnapshot(qShifts, (snapshot) => {
      setShiftHistory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'shifts'));

    const qPhones = query(collection(db, 'psm_phones'), orderBy('label', 'asc'));
    const unsubPhones = onSnapshot(qPhones, (snapshot) => {
      setPsmPhones(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'psm_phones'));

    const qUsers = query(collection(db, 'users'), orderBy('name', 'asc'));
    const unsubUsers = onSnapshot(qUsers, (snapshot) => {
      setSystemUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'users'));

    const qCalls = query(collection(db, 'calls'), orderBy('timestamp', 'desc'), limit(100));
    const unsubCalls = onSnapshot(qCalls, (snapshot) => {
      setAllCalls(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'calls'));

    const qMessages = query(collection(db, 'sms_logs'), orderBy('timestamp', 'desc'), limit(100));
    const unsubMessages = onSnapshot(qMessages, (snapshot) => {
      setAllMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'sms_logs'));

    return () => {
      unsubVehicles();
      unsubMaster();
      unsubMasterVehicles();
      unsubShifts();
      unsubPhones();
      unsubUsers();
      unsubCalls();
      unsubMessages();
    };
  }, []);

  const drivers = firestoreDrivers;

  const filteredDrivers = drivers.filter(d => 
    d.name?.toLowerCase().includes(searchTerm.toLowerCase()) || 
    d.prefix?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.phone?.includes(searchTerm)
  );

  const toggleExpand = (id: string) => {
    setExpandedId(expandedId === id ? null : id);
  };

  const handleAddDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setScaleError(null);

    const path = 'drivers';
    try {
      // 1. Identify accurately who is being scheduled
      // If name is empty, it means detection failed or hasn't happened
      if (!newDriver.name) {
        setScaleError("ERRO: Nenhum colaborador vinculado a este terminal PSM.");
        setIsSubmitting(false);
        return;
      }

      // Check unique constraints for active fleet
      const duplicatePhone = firestoreDrivers.find(d => d.phone === newDriver.phone || (newDriver.secondaryPhone && d.phone === newDriver.secondaryPhone));
      if (duplicatePhone) {
        setScaleError(`ERRO: O número ${newDriver.phone} já está vinculado ao veículo ${duplicatePhone.prefix}.`);
        setIsSubmitting(false);
        return;
      }

      const duplicatePlate = firestoreDrivers.find(d => d.plate === newDriver.plate || d.prefix === newDriver.prefix);
      if (duplicatePlate) {
        setScaleError(`ERRO: A viatura ${newDriver.prefix} (${newDriver.plate}) já está ativa na frota.`);
        setIsSubmitting(false);
        return;
      }

      const duplicateDriver = firestoreDrivers.find(d => d.name === newDriver.name);
      if (duplicateDriver) {
        setScaleError(`ERRO: O colaborador ${newDriver.name} já possui uma viatura ativa (${duplicateDriver.prefix}).`);
        setIsSubmitting(false);
        return;
      }

      const masterDriver = masterDriversList.find(m => m.name === newDriver.name);
      const systemUser = systemUsers.find(u => u.name === newDriver.name);
      const driverId = masterDriver?.id || systemUser?.id || '';

      if (!driverId) {
        setScaleError("ERRO: Colaborador não encontrado no sistema. Verifique o cadastro.");
        setIsSubmitting(false);
        return;
      }

      // Check if already scaled today (even if not active now)
      const todayStr = new Date().toISOString().split('T')[0];
      
      // 1. Check Driver uniqueness for today
      const qTodayShift = query(
        collection(db, 'shifts'),
        where('driverId', '==', driverId),
        where('date', '==', todayStr),
        limit(1)
      );
      
      // 2. Check Vehicle uniqueness for today
      const qTodayVehicle = query(
        collection(db, 'shifts'),
        where('prefix', '==', newDriver.prefix),
        where('date', '==', todayStr),
        limit(1)
      );

      // 3. Check Phone uniqueness for today
      const qTodayPhone = query(
        collection(db, 'shifts'),
        where('phone', '==', newDriver.phone),
        where('date', '==', todayStr),
        limit(1)
      );

      const [shiftSnap, vehicleSnap, phoneSnap] = await Promise.all([
        getDocs(qTodayShift),
        getDocs(qTodayVehicle),
        getDocs(qTodayPhone)
      ]);

      if (!shiftSnap.empty) {
        setScaleError(`BLOQUEIO: O colaborador ${newDriver.name} já possui uma escala registrada para hoje.`);
        setIsSubmitting(false);
        return;
      }
      if (!vehicleSnap.empty) {
        setScaleError(`BLOQUEIO: A viatura ${newDriver.prefix} já foi escalada hoje para outro colaborador.`);
        setIsSubmitting(false);
        return;
      }
      if (!phoneSnap.empty) {
        setScaleError(`BLOQUEIO: O terminal ${newDriver.phone} já foi utilizado em uma escala hoje.`);
        setIsSubmitting(false);
        return;
      }

      // 2. Find their most recent shift record
      const qLastShift = query(
        collection(db, 'shifts'),
        where('driverId', '==', driverId),
        orderBy('date', 'desc'),
        limit(5)
      );
        
      const lastShiftSnap = await getDocs(qLastShift);
      if (!lastShiftSnap.empty) {
        const lastShift = lastShiftSnap.docs[0].data();
        const lastDate = lastShift.date;
        
        // Check if today is the same as lastDate, we might allow scaling if it's already there?
        // Actually the rule is about the "income being approved". 
        // If they haven't declared/approved the LAST one, they can't have a NEXT one.
        
        if (lastDate !== todayStr) {
          // Check for revenue log of that last date
          const qRev = query(
            collection(db, 'revenue_logs'),
            where('driverId', '==', driverId),
            where('date', '==', lastDate),
            limit(1)
          );
          
          const revSnap = await getDocs(qRev);
          let isApproved = false;
          
          if (!revSnap.empty) {
            const revData = revSnap.docs[0].data();
            if (revData.status === 'finalized' || revData.status === 'paid_to_staff') {
              isApproved = true;
            }
          }
          
          if (!isApproved) {
            setScaleError(`BLOQUEIO DE ESCALA: O motorista possui pendência financeira no dia ${lastDate}. A renda deve estar APROVADA/FINALIZADA antes de uma nova escala.`);
            setIsSubmitting(false);
            return;
          }
        }
      }
      
      // 3. Double check for ANY pending revenue logs (even if not from the last shift specifically)
      const qPending = query(
        collection(db, 'revenue_logs'),
        where('driverId', '==', driverId),
        where('status', 'not-in', ['finalized', 'paid_to_staff']),
        limit(1)
      );
      const pendingSnap = await getDocs(qPending);
      if (!pendingSnap.empty) {
        const pendingData = pendingSnap.docs[0].data();
        setScaleError(`BLOQUEIO DE ESCALA: Existe uma declaração de renda pendente (${pendingData.date}). Status: ${pendingData.status}.`);
        setIsSubmitting(false);
        return;
      }

      await addDoc(collection(db, path), {
        ...newDriver,
        driverId,
        status: 'Ativo',
        gps: 'Signal Good',
        lat: -11.7833, // Default Luena
        lng: 19.9167,
        batteryLevel: 100,
        recentCalls: [],
        rendaStatus: 'pending',
        callCount: 0,
        updatedAt: new Date().toISOString()
      });
      setIsModalOpen(false);
      setNewDriver({ name: '', phone: '', secondaryPhone: '', prefix: '', plate: '', trackerId: '' });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCreateShift = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDriverForShift) return;
    setIsSubmitting(true);
    const path = 'shifts';
    try {
      setShiftError(null);
      const today = new Date().toISOString().split('T')[0];
      
      // Check if driver or vehicle already has a shift today
      const existingShift = shiftHistory.find(s => 
        (s.driverId === selectedDriverForShift.id || s.prefix === selectedDriverForShift.prefix) && 
        s.date === today
      );

      if (existingShift) {
        const conflictSubject = existingShift.driverId === selectedDriverForShift.id 
          ? `O motorista ${selectedDriverForShift.name}` 
          : `A viatura ${selectedDriverForShift.prefix}`;
          
        setShiftError(`${conflictSubject} já possui um registo de renda hoje.`);
        return;
      }

      await addDoc(collection(db, path), {
        driverId: selectedDriverForShift.id,
        prefix: selectedDriverForShift.prefix,
        driverName: selectedDriverForShift.name,
        date: today,
        mainPhone: shiftData.mainPhone,
        secondaryPhone: shiftData.secondaryPhone,
        rendaValue: shiftData.rendaValue,
        timestamp: new Date().toISOString()
      });
      setIsShiftModalOpen(false);
      setShiftData({ mainPhone: '', secondaryPhone: '', rendaValue: 5000 });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteDriver = async (id: string) => {
    if (window.confirm("Tem certeza que deseja remover este veículo da frota?")) {
      const path = `drivers/${id}`;
      try {
        await deleteDoc(doc(db, 'drivers', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    }
  };

  const handleDeleteCall = async (driverId: string, call: any) => {
    if (!window.confirm("Remover esta chamada do histórico?")) return;
    const path = `drivers/${driverId}`;
    try {
      await updateDoc(doc(db, 'drivers', driverId), {
        recentCalls: arrayRemove(call)
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    }
  };

  const handleDeleteShift = async (id: string) => {
    if (!window.confirm("Eliminar este registo de renda permanentemente?")) return;
    const path = `shifts/${id}`;
    try {
      await deleteDoc(doc(db, 'shifts', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  const getStatusStyles = (status: string) => {
    switch (status?.toLowerCase()) {
      case 'available':
      case 'ativo':
      case 'disponível':
        return {
          badge: 'bg-green-100 text-green-700 border-green-200',
          dot: 'bg-green-500',
          row: 'bg-green-50/30',
          label: 'Disponível'
        };
      case 'busy':
      case 'ocupado':
        return {
          badge: 'bg-amber-100 text-amber-700 border-amber-200',
          dot: 'bg-amber-500',
          row: 'bg-amber-50/30',
          label: 'Em Serviço'
        };
      case 'offline':
      case 'inativo':
      case 'indisponível':
        return {
          badge: 'bg-red-100 text-red-700 border-red-200',
          dot: 'bg-red-500',
          row: 'bg-red-50/30',
          label: 'Indisponível'
        };
      default:
        return {
          badge: 'bg-slate-100 text-slate-700 border-slate-200',
          dot: 'bg-slate-400',
          row: '',
          label: status || 'N/A'
        };
    }
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between bg-white border border-slate-200 px-6 py-6 rounded-[2rem] shadow-sm relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/5 blur-[80px] -mr-32 -mt-32 rounded-full group-hover:bg-brand-primary/10 transition-colors duration-700" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-3 mb-1">
             <div className="bg-brand-primary p-2 rounded-xl text-white shadow-lg shadow-brand-primary/20">
               <Activity size={20} />
             </div>
             <h2 className="text-xl font-black text-slate-900 tracking-tighter uppercase italic">Gestão de Operações</h2>
          </div>
          <p className="text-[11px] text-slate-500 font-bold uppercase tracking-widest ml-11">Controle operacional de veículos e motoristas ativos</p>
        </div>
        
        <div className="flex items-center gap-3 relative z-10">
          <button 
            onClick={async () => {
              if (window.confirm("Deseja ativar o protocolo de monitorização intensiva para todos os terminais?")) {
                const batch = writeBatch(db);
                firestoreDrivers.forEach(d => {
                  batch.update(doc(db, 'drivers', d.id), { 
                    status: 'available', 
                    lastManualReset: serverTimestamp(),
                    callCount: 0,
                    recentCalls: [] 
                  });
                });
                await batch.commit();
                alert("Modos Ativos: Monitorização em tempo real sincronizada e contadores resetados.");
              }
            }}
            className="bg-slate-100 text-slate-900 text-[11px] font-black uppercase tracking-widest px-6 py-3.5 rounded-2xl hover:bg-slate-200 transition-all flex items-center gap-2 border border-slate-200 active:scale-95"
          >
            <Zap size={16} className="text-amber-500" />
            Ativar Modos
          </button>

          {canScale && (
            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-brand-primary text-white text-[11px] font-black uppercase tracking-widest px-6 py-3.5 rounded-2xl hover:bg-blue-700 transition-all flex items-center gap-2 shadow-lg shadow-brand-primary/20 active:scale-95"
            >
              <Plus size={16} />
              Vincular Nova Escala
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Frota Ativa', value: drivers.length.toString(), icon: <Car size={16} /> },
          { label: 'Disponíveis', value: drivers.filter(d => ['available', 'ativo', 'disponível'].includes(d.status?.toLowerCase())).length.toString(), icon: <Activity size={16} className="text-green-500" /> },
          { label: 'Em Serviço', value: drivers.filter(d => ['busy', 'ocupado'].includes(d.status?.toLowerCase())).length.toString(), icon: <Clock size={16} className="text-amber-500" /> },
          { label: 'Indisponíveis', value: drivers.filter(d => ['offline', 'inativo', 'indisponível'].includes(d.status?.toLowerCase())).length.toString(), icon: <X size={16} className="text-red-500" /> },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm group hover:border-brand-primary/50 transition-all">
            <div className="flex items-center justify-between mb-3">
              <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{stat.label}</div>
              <div className="p-2 bg-slate-50 text-slate-500 rounded-xl group-hover:scale-110 transition-transform">
                {stat.icon}
              </div>
            </div>
            <div className="text-3xl font-black text-slate-900 italic tracking-tighter leading-none">{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 flex flex-col overflow-hidden shadow-sm">
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
             <div className="w-1.5 h-6 bg-brand-primary rounded-full" />
             <h3 className="font-black text-sm text-slate-900 uppercase tracking-widest italic">Frota em Tempo Real</h3>
          </div>
          <div className="relative w-80">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input 
              type="text" 
              placeholder="Pesquisar motorista ou viatura..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-11 pr-6 py-3 bg-white border border-slate-200 rounded-2xl text-[13px] text-slate-900 outline-none focus:border-brand-primary transition-all font-bold placeholder:text-slate-400 shadow-sm px-4"
            />
          </div>
        </div>

        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-[13px] border-collapse">
            <thead>
              <tr className="bg-slate-50/50">
                <th className="px-8 py-5 text-left font-black text-slate-400 uppercase tracking-widest text-[10px] border-b border-slate-100"></th>
                <th className="px-8 py-5 text-left font-black text-slate-400 uppercase tracking-widest text-[10px] border-b border-slate-100">Viatura</th>
                <th className="px-8 py-5 text-left font-black text-slate-400 uppercase tracking-widest text-[10px] border-b border-slate-100">Estado</th>
                <th className="px-8 py-5 text-left font-black text-slate-400 uppercase tracking-widest text-[10px] border-b border-slate-100">Colaborador</th>
                <th className="px-8 py-5 text-left font-black text-slate-400 uppercase tracking-widest text-[10px] border-b border-slate-100">Contatos Ativos</th>
                <th className="px-8 py-5 text-center font-black text-slate-400 uppercase tracking-widest text-[10px] border-b border-slate-100">Calls</th>
                <th className="px-8 py-5 text-left font-black text-slate-400 uppercase tracking-widest text-[10px] border-b border-slate-100">Tracker ID</th>
                <th className="px-8 py-5 text-left font-black text-slate-400 uppercase tracking-widest text-[10px] border-b border-slate-100">Sinal</th>
                <th className="px-8 py-5 text-right font-black text-slate-400 uppercase tracking-widest text-[10px] border-b border-slate-100">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
               {filteredDrivers.map((driver) => {
                  const statusInfo = getStatusStyles(driver.status);
                  const isExpanded = expandedId === driver.id;
                  const masterDriver = masterDriversList.find(m => m.name === driver.name);
                  const monitoringPhones = [
                    driver.phone, 
                    driver.secondaryPhone, 
                    masterDriver?.phone
                  ].filter(Boolean);

                  return (
                    <React.Fragment key={driver.id}>
                      <tr 
                        className={`transition-all cursor-pointer group/row ${
                          isExpanded ? `bg-brand-primary/5` : 'hover:bg-slate-50'
                        }`}
                        onClick={() => toggleExpand(driver.id)}
                      >
                        <td className="px-8 py-5">
                          <div className={cn(
                            "w-8 h-8 rounded-lg flex items-center justify-center transition-all",
                            isExpanded ? "bg-brand-primary text-white" : "bg-slate-100 border border-slate-200 text-slate-400 group-hover/row:border-slate-300"
                          )}>
                            {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-3">
                             <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-white font-black italic shadow-inner group-hover/row:scale-105 transition-transform">
                               {driver.prefix?.slice(-3)}
                             </div>
                             <span className="font-black text-slate-900 italic tracking-tighter text-lg">{driver.prefix}</span>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <div className={`inline-flex items-center gap-2 px-3 py-1 rounded-full border text-[10px] font-black uppercase tracking-widest shadow-sm ${
                            statusInfo.label === 'Disponível' ? 'bg-green-50 text-green-700 border-green-200' :
                            statusInfo.label === 'Ocupado' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                            'bg-red-50 text-red-700 border-red-200'
                          }`}>
                            <div className={`w-1.5 h-1.5 rounded-full animate-pulse ${
                              statusInfo.label === 'Disponível' ? 'bg-green-500' :
                              statusInfo.label === 'Ocupado' ? 'bg-amber-500' :
                              'bg-red-500'
                            }`} />
                            {statusInfo.label}
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <div>
                            <p className="font-black text-slate-900 uppercase tracking-tight italic group-hover/row:text-brand-primary transition-colors">{driver.name}</p>
                            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{driver.plate}</p>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex flex-col gap-0.5">
                            <div className="flex items-center gap-2">
                               <Phone size={10} className="text-brand-primary" />
                               <span className="font-black text-slate-700 tracking-wider">+244 {driver.phone?.replace('+244', '') || '----'}</span>
                            </div>
                            {driver.secondaryPhone && (
                              <div className="flex items-center gap-2 pl-4 opacity-50">
                                <span className="text-[11px] text-slate-400 font-bold">+244 {driver.secondaryPhone.replace('+244', '')}</span>
                              </div>
                            )}
                          </div>
                        </td>
                        <td className="px-8 py-5 text-center">
                          <div className="inline-flex flex-col items-center bg-slate-50 rounded-xl p-2 border border-slate-200 min-w-[50px] group-hover/row:border-brand-primary/30 transition-all">
                            <span className="text-sm font-black text-brand-primary leading-none italic">{driver.callCount || 0}</span>
                            <span className="text-[8px] font-black text-slate-400 uppercase tracking-tighter mt-1">LOGS</span>
                          </div>
                        </td>
                        <td className="px-8 py-5">
                          <span className="text-[11px] font-mono font-black text-slate-500 bg-slate-50 border border-slate-200 px-3 py-1.5 rounded-xl uppercase tracking-tighter group-hover/row:text-slate-900 transition-colors">
                            {driver.trackerId || 'NO_GPS'}
                          </span>
                        </td>
                        <td className="px-8 py-5">
                          <div className="flex items-center gap-2">
                            <Activity size={12} className={driver.gps === 'Signal Good' ? 'text-green-500' : 'text-red-500'} />
                            <span className={cn(
                              "text-[10px] font-black uppercase tracking-widest",
                              driver.gps === 'Signal Good' ? "text-green-600" : "text-red-600"
                            )}>{driver.gps === 'Signal Good' ? "Sinal GPS Ativo" : "Sem Sinal"}</span>
                          </div>
                        </td>
                        <td className="px-8 py-5 text-right">
                          <div className="flex items-center justify-end gap-2">
                            {canScale && (
                              <>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setSelectedDriverForShift(driver);
                                    setShiftError(null);
                                    setShiftData({ 
                                      mainPhone: driver.phone || '', 
                                      secondaryPhone: driver.secondaryPhone || '', 
                                      rendaValue: 5000 
                                    });
                                    setIsShiftModalOpen(true);
                                  }}
                                  className="w-9 h-9 bg-brand-primary/10 text-brand-primary rounded-xl flex items-center justify-center hover:bg-brand-primary hover:text-white transition-all active:scale-95 shadow-sm"
                                  title="Vincular Renda"
                                >
                                  <TrendingUp size={16} />
                                </button>
                                <button 
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDeleteDriver(driver.id);
                                  }}
                                  className="w-9 h-9 bg-slate-50 border border-slate-200 text-slate-400 rounded-xl flex items-center justify-center hover:bg-red-50 hover:text-white hover:border-red-100 transition-all active:scale-95"
                                  title="Remover Veículo"
                                >
                                  <Trash2 size={16} />
                                </button>
                              </>
                            )}
                          </div>
                        </td>
                      </tr>
                      
                      {/* Expanded Section */}
                      <AnimatePresence>
                        {isExpanded && (
                          <tr>
                            <td colSpan={9} className="p-0 border-none">
                              <motion.div
                                initial={{ height: 0, opacity: 0 }}
                                animate={{ height: 'auto', opacity: 1 }}
                                exit={{ height: 0, opacity: 0 }}
                                transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
                                className="bg-slate-50 border-y border-slate-200"
                              >
                                <div className="px-12 py-10 grid grid-cols-1 lg:grid-cols-2 gap-12">
                                  {/* Calls Section */}
                                  <div className="space-y-6">
                                    <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                                      <div className="flex items-center gap-3">
                                        <div className="p-2 bg-brand-primary/10 rounded-lg">
                                           <PhoneIncoming size={16} className="text-brand-primary" />
                                        </div>
                                        <h4 className="text-[12px] font-black text-slate-900 uppercase tracking-[0.2em] italic">Timeline de Chamadas</h4>
                                      </div>
                                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{allCalls.filter(c => c.driverId === driver.id || monitoringPhones.includes(c.customerPhone)).length} logs</span>
                                    </div>
                                    
                                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-4 custom-scrollbar">
                                      {allCalls.filter(c => 
                                        c.driverId === driver.id || 
                                        monitoringPhones.includes(c.customerPhone)
                                      ).length > 0 ? (
                                        allCalls.filter(c => 
                                          c.driverId === driver.id || 
                                          monitoringPhones.includes(c.customerPhone)
                                        ).map((call: any) => (
                                          <div key={call.id} className="relative group/call bg-white p-5 rounded-[1.5rem] border border-slate-200 hover:border-brand-primary/30 transition-all shadow-sm">
                                             <div className="absolute top-4 right-4 flex items-center gap-2">
                                              <span className={`text-[8px] font-black px-2 py-1 rounded-lg uppercase tracking-widest border ${
                                                call.status === 'completed' ? 'bg-green-100 text-green-700 border-green-200' : 'bg-amber-100 text-amber-700 border-amber-200'
                                              }`}>
                                                {call.status}
                                              </span>
                                            </div>

                                            <div className="flex flex-col gap-4">
                                              <div className="flex items-center gap-2 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                <Clock size={12} className="text-brand-primary" />
                                                {formatSafe(call.timestamp, 'dd/MM/yyyy HH:mm', 'Recente')}
                                              </div>

                                              <div className="grid grid-cols-[1fr,auto,1fr] items-center gap-4">
                                                <div className="flex flex-col gap-1">
                                                  <div className="flex items-center gap-2">
                                                    <div className="w-1.5 h-1.5 rounded-full bg-brand-primary" />
                                                    <span className="text-[11px] font-black text-slate-900 uppercase tracking-tight">{call.pickupAddress || 'Recolha...'}</span>
                                                  </div>
                                                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest pl-3.5">Origem</p>
                                                </div>

                                                <div className="flex flex-col items-center">
                                                   <div className="w-8 h-px bg-slate-200" />
                                                   <Activity size={10} className="text-brand-primary my-1" />
                                                   <div className="w-8 h-px bg-slate-200" />
                                                </div>

                                                <div className="flex flex-col gap-1 items-end">
                                                  <div className="flex items-center gap-2">
                                                    <span className="text-[11px] font-black text-slate-900 uppercase tracking-tight">{call.destinationAddress || 'Destino...'}</span>
                                                    <div className="w-1.5 h-1.5 rounded-full bg-slate-300" />
                                                  </div>
                                                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest pr-3.5">Destino</p>
                                                </div>
                                              </div>

                                              <div className="pt-4 border-t border-slate-100 flex items-center justify-between">
                                                <div className="flex items-center gap-4">
                                                   <div className="flex flex-col">
                                                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">DURAÇÃO</span>
                                                      <span className="text-[11px] font-black text-slate-900 italic">{call.duration || '--'} MIN</span>
                                                   </div>
                                                </div>
                                                <div className="text-right">
                                                   <span className="text-[9px] font-black text-slate-400 uppercase tracking-tighter">FATURAMENTO</span>
                                                   <p className="text-[13px] font-black text-brand-primary italic leading-none">{call.price?.toLocaleString()} <span className="text-[10px]">KZ</span></p>
                                                </div>
                                              </div>
                                            </div>
                                          </div>
                                        ))
                                      ) : (
                                        <div className="py-12 text-center bg-white/50 border border-dashed border-slate-200 rounded-[2rem]">
                                          <div className="w-16 h-16 bg-slate-50 rounded-[1.5rem] flex items-center justify-center mx-auto mb-4 border border-slate-100">
                                            <PhoneIncoming size={24} className="text-slate-300" />
                                          </div>
                                          <p className="text-[11px] text-slate-400 font-black uppercase tracking-widest italic">Timeline Vazia</p>
                                        </div>
                                      )}
                                    </div>
                                  </div>

                                  {/* Messages Section */}
                                  <div className="space-y-6">
                                    <div className="flex items-center justify-between pb-3 border-b border-slate-200">
                                      <div className="flex items-center gap-3">
                                        <div className="p-2 bg-emerald-100 rounded-lg">
                                           <Mail size={16} className="text-emerald-600" />
                                        </div>
                                        <h4 className="text-[12px] font-black text-slate-900 uppercase tracking-[0.2em] italic">Comunicações SMS</h4>
                                      </div>
                                      <span className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{allMessages.filter(m => monitoringPhones.some(p => m.targets?.includes(p) || m.from === p)).length} logs</span>
                                    </div>
                                    
                                    <div className="space-y-4 max-h-[400px] overflow-y-auto pr-4 custom-scrollbar">
                                      {allMessages.filter(m => 
                                        monitoringPhones.some(p => m.targets?.includes(p) || m.from === p)
                                      ).length > 0 ? (
                                        allMessages.filter(m => 
                                          monitoringPhones.some(p => m.targets?.includes(p) || m.from === p)
                                        ).map((msg: any) => (
                                          <div key={msg.id} className="bg-white p-5 rounded-[1.5rem] border border-slate-200 hover:border-emerald-500/30 transition-all shadow-sm group/msg">
                                            <div className="flex justify-between items-start mb-3">
                                              <div className="flex items-center gap-2">
                                                <Clock size={12} className="text-emerald-600" />
                                                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                                                  {formatSafe(msg.timestamp, 'dd/MM/yyyy HH:mm', 'Recente')}
                                                </span>
                                              </div>
                                              <span className={`text-[8px] font-black px-2 py-1 rounded-lg uppercase tracking-widest border ${
                                                msg.status === 'sent' ? 'bg-emerald-100 text-emerald-700 border-emerald-200' : 'bg-red-100 text-red-700 border-red-200'
                                              }`}>
                                                {msg.status}
                                              </span>
                                            </div>
                                            <p className="text-sm text-slate-600 leading-relaxed italic group-hover/msg:text-slate-900 transition-colors">"{msg.content}"</p>
                                            <div className="mt-4 pt-4 border-t border-slate-100 flex items-center justify-between">
                                              <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">GATEWAY: {msg.provider || 'PSM_UNITEL'}</span>
                                              <div className="p-1 px-2 bg-slate-50 rounded-lg border border-slate-100">
                                                <span className="text-[9px] font-black text-emerald-600 uppercase tracking-tighter">ENCERRADO</span>
                                              </div>
                                            </div>
                                          </div>
                                        ))
                                      ) : (
                                        <div className="py-12 text-center bg-white/50 border border-dashed border-slate-200 rounded-[2rem]">
                                          <div className="w-16 h-16 bg-slate-50 rounded-[1.5rem] flex items-center justify-center mx-auto mb-4 border border-slate-100">
                                            <MessageSquare size={24} className="text-slate-300" />
                                          </div>
                                          <p className="text-[11px] text-slate-400 font-black uppercase tracking-widest italic">Logs de SMS Vazios</p>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>
                              </motion.div>
                            </td>
                          </tr>
                        )}
                      </AnimatePresence>
                    </React.Fragment>
                  );
                })}
            </tbody>
          </table>
        </div>
      </div>

      {/* New Driver Modal */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900 tracking-tight">Vincular Nova Escala</h3>
                  <p className="text-[11px] text-slate-500 font-medium">Defina o motorista e o veículo para a nova escala operacional</p>
                </div>
                <button 
                  onClick={() => {
                    setIsModalOpen(false);
                    setScaleError(null);
                  }}
                  className="p-2 hover:bg-slate-50 rounded-full transition-colors"
                >
                  <X size={18} className="text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleAddDriver} className="p-6 space-y-4">
                {scaleError && (
                  <motion.div 
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    className="p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3"
                  >
                    <X className="text-red-500 shrink-0" size={16} />
                    <p className="text-[11px] font-bold text-red-600 leading-tight">{scaleError}</p>
                  </motion.div>
                )}
                <div className="bg-blue-50 p-3 rounded-lg border border-blue-100 flex items-start gap-4 mb-2">
                  <div className="w-10 h-10 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600 flex-shrink-0">
                    <Users size={20} />
                  </div>
                  <div className="flex-1">
                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Colaborador Vinculado</p>
                    <div className="mt-1">
                      <select 
                        required
                        value={masterDriversList.find(m => m.name === newDriver.name)?.id || ''}
                        onChange={(e) => {
                          const selected = masterDriversList.find(m => m.id === e.target.value);
                          setNewDriver({ ...newDriver, name: selected?.name || '' });
                        }}
                        className="w-full bg-transparent border-none text-[15px] font-black text-blue-900 uppercase italic p-0 outline-none focus:ring-0 appearance-none"
                      >
                        <option value="">{newDriver.name ? newDriver.name : 'Vincule um colaborador...'}</option>
                        {masterDriversList.map(m => (
                          <option key={m.id} value={m.id}>
                            {m.name} {m.phone ? `(${m.phone})` : ''}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Terminal Principal PSM</label>
                    <select 
                      required
                      value={newDriver.phone}
                      onChange={(e) => {
                        const phoneNum = e.target.value;
                        const phoneData = psmPhones.find(p => p.number === phoneNum);
                        setNewDriver({
                          ...newDriver, 
                          phone: phoneNum,
                          name: phoneData?.assignedTo || ''
                        });
                      }}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[13px] outline-none focus:bg-white focus:border-brand-primary transition-all shadow-inner"
                    >
                      <option value="">Selecionar terminal...</option>
                      {psmPhones.filter(p => p.status === 'Ativo').map(p => (
                        <option key={p.id} value={p.number}>{p.label} - {p.number}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Terminal Secundário PSM</label>
                    <select 
                      value={newDriver.secondaryPhone}
                      onChange={(e) => setNewDriver({...newDriver, secondaryPhone: e.target.value})}
                      className="w-full px-3 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[13px] outline-none focus:bg-white focus:border-brand-primary transition-all shadow-inner"
                    >
                      <option value="">Nenhum...</option>
                      {psmPhones.filter(p => p.status === 'Ativo').map(p => (
                        <option key={p.id} value={p.number}>{p.label} - {p.number}</option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Nº da Viatura</label>
                    <select 
                      required
                      value={newDriver.prefix}
                      onChange={(e) => {
                        const vehicle = masterVehicles.find(v => v.prefix === e.target.value);
                        setNewDriver({
                          ...newDriver, 
                          prefix: e.target.value,
                          plate: vehicle?.plate || '',
                          trackerId: vehicle?.trackerId || ''
                        });
                      }}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[13px] outline-none focus:bg-white focus:border-brand-primary transition-all appearance-none shadow-inner"
                    >
                      <option value="">Selecionar...</option>
                      {masterVehicles.map(v => (
                        <option key={v.id} value={v.prefix}>{v.prefix} ({v.brand})</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Matrícula</label>
                    <input 
                      required
                      type="text" 
                      placeholder="LD-00-00-XX"
                      value={newDriver.plate}
                      readOnly
                      className="w-full px-4 py-2 bg-slate-100 border border-slate-200 rounded-lg text-[13px] outline-none text-slate-500 font-bold uppercase cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">ID do Rastreador GPS</label>
                  <div className="relative">
                    <Hash size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      required
                      type="text" 
                      placeholder="Serial ou IMEI do Dispositivo"
                      value={newDriver.trackerId}
                      readOnly
                      className="w-full pl-9 pr-4 py-2 bg-slate-100 border border-slate-200 rounded-lg text-[13px] outline-none text-slate-500 font-bold cursor-not-allowed"
                    />
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-4 py-2.5 bg-slate-100 text-slate-600 rounded-lg text-[13px] font-bold hover:bg-slate-200 transition-colors"
                  >
                    CANCELAR
                  </button>
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-2.5 bg-brand-primary text-white rounded-lg text-[13px] font-bold hover:bg-brand-secondary transition-shadow hover:shadow-lg shadow-brand-primary/20 flex items-center justify-center gap-2 disabled:opacity-70"
                  >
                    {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Plus size={16} />}
                    VINCULAR ESCALA
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Daily Shift Modal */}
      <AnimatePresence>
        {isShiftModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsShiftModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div>
                  <h4 className="font-bold text-slate-900">Vincular Renda do Dia</h4>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
                    Nº Viatura: {selectedDriverForShift?.prefix}
                  </p>
                </div>
                <button onClick={() => setIsShiftModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleCreateShift} className="p-6 space-y-4">
                {shiftError && (
                  <div className="bg-red-50 border border-red-200 p-3 rounded-lg flex items-start gap-2 animate-pulse">
                    <div className="w-1.5 h-1.5 rounded-full bg-red-500 mt-1.5 flex-shrink-0" />
                    <p className="text-[11px] text-red-700 font-bold uppercase tracking-tight leading-tight">
                      {shiftError}
                    </p>
                  </div>
                )}

                <div className="bg-amber-50 p-3 rounded-lg border border-amber-200 mb-2">
                  <p className="text-[11px] text-amber-700 font-medium leading-tight">
                    Confirmar a entrada em serviço para hoje ({formatSafe(new Date(), 'dd/MM/yyyy')})
                  </p>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">Motorista de Serviço</label>
                  <input 
                    readOnly
                    value={selectedDriverForShift?.name}
                    className="w-full px-4 py-2 bg-slate-100 border border-slate-200 rounded-lg text-[13px] outline-none text-slate-500 font-bold cursor-not-allowed"
                  />
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">Telefone Principal (Hoje)</label>
                  <div className="flex gap-0">
                    <div className="bg-slate-100 border border-r-0 border-slate-200 px-2.5 py-2 rounded-l-lg text-[13px] font-bold text-slate-500 flex items-center shadow-inner">
                      +244
                    </div>
                    <input 
                      required
                      type="tel"
                      placeholder="9XXXXXXXX"
                      maxLength={9}
                      value={shiftData.mainPhone.startsWith('+244') ? shiftData.mainPhone.slice(4) : shiftData.mainPhone}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        setShiftData({...shiftData, mainPhone: val ? `+244${val}` : ''});
                      }}
                      className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-r-lg text-[13px] outline-none focus:bg-white focus:border-brand-primary shadow-inner"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">Segundo Terminal (Opcional)</label>
                  <div className="flex gap-0">
                    <div className="bg-slate-100 border border-r-0 border-slate-200 px-2.5 py-2 rounded-l-lg text-[13px] font-bold text-slate-500 flex items-center shadow-inner">
                      +244
                    </div>
                    <input 
                      type="tel"
                      placeholder="9XXXXXXXX"
                      maxLength={9}
                      value={shiftData.secondaryPhone.startsWith('+244') ? shiftData.secondaryPhone.slice(4) : shiftData.secondaryPhone}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        setShiftData({...shiftData, secondaryPhone: val ? `+244${val}` : ''});
                      }}
                      className="flex-1 px-4 py-2 bg-slate-50 border border-slate-200 rounded-r-lg text-[13px] outline-none focus:bg-white focus:border-brand-primary shadow-inner"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase tracking-tight">Valor da Renda (KZ)</label>
                  <input 
                    required
                    type="number"
                    value={shiftData.rendaValue}
                    onChange={(e) => setShiftData({...shiftData, rendaValue: Number(e.target.value)})}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-[13px] outline-none focus:bg-white focus:border-brand-primary shadow-inner"
                  />
                </div>

                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full mt-4 bg-brand-primary text-white py-2.5 rounded-lg text-[13px] font-bold hover:shadow-lg hover:bg-brand-secondary transition-all flex items-center justify-center gap-2"
                >
                  {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <Activity size={16} />}
                  REGISTAR RENDA DO DIA
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* History section at the bottom */}
      <div className="mt-12 bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-3">
             <div className="p-2 bg-brand-primary/10 rounded-xl">
               <Clock size={16} className="text-brand-primary" />
             </div>
             <h3 className="font-black text-sm text-slate-900 uppercase tracking-widest italic tracking-tight">
               Histórico Operacional de Rendas
             </h3>
          </div>
          <span className="text-[10px] bg-white text-slate-400 font-black px-4 py-1.5 rounded-full uppercase tracking-[0.2em] shadow-sm border border-slate-100">
            Consulta Mensal
          </span>
        </div>
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-[12px]">
            <thead>
              <tr className="bg-slate-50/50 text-slate-400 font-black uppercase tracking-widest text-[10px]">
                <th className="px-8 py-4 text-left border-b border-slate-100">Data</th>
                <th className="px-8 py-4 text-left border-b border-slate-100">Viatura / Motorista</th>
                <th className="px-8 py-4 text-left border-b border-slate-100">Terminal 01</th>
                <th className="px-8 py-4 text-left border-b border-slate-100">Terminal 02</th>
                <th className="px-8 py-4 text-right border-b border-slate-100">Valor Renda</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shiftHistory.slice(0, 10).map((h) => (
                <tr key={h.id} className="hover:bg-slate-50 transition-colors group/hist">
                  <td className="px-8 py-4 font-black text-slate-500 uppercase tracking-tighter">
                    {formatSafe(h.timestamp, 'dd/MM/yyyy')}
                  </td>
                  <td className="px-8 py-4">
                    <div className="flex flex-col">
                      <span className="font-black text-slate-900 italic group-hover/hist:text-brand-primary transition-colors">{h.prefix}</span>
                      <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">{h.driverName}</span>
                    </div>
                  </td>
                  <td className="px-8 py-4 font-black text-slate-700">+244 {h.mainPhone?.replace('+244', '')}</td>
                  <td className="px-8 py-4 text-slate-400 font-bold">{h.secondaryPhone ? `+244 ${h.secondaryPhone.replace('+244', '')}` : '---'}</td>
                  <td className="px-8 py-4 text-right">
                    <div className="flex items-center justify-end gap-4">
                      <span className="text-sm font-black text-green-600 italic tracking-tighter bg-green-50 px-3 py-1 rounded-lg border border-green-100">{h.rendaValue?.toLocaleString()} <span className="text-[9px]">KZ</span></span>
                      <button 
                        onClick={() => handleDeleteShift(h.id)}
                        className="text-slate-300 hover:text-red-500 transition-colors p-1"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {shiftHistory.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-slate-600 italic font-medium uppercase tracking-[0.2em]">
                    Nenhum registo de renda processado.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
