import React, { useState, useEffect } from 'react';
import { 
  collection, 
  onSnapshot, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  query, 
  orderBy, 
  serverTimestamp,
  getDocs,
  where
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  Calendar as CalendarIcon, 
  Plus, 
  Trash2, 
  Edit2, 
  Copy,
  User, 
  Truck, 
  Clock, 
  Filter,
  ChevronLeft,
  ChevronRight,
  MoreVertical,
  CheckCircle2,
  AlertCircle,
  X,
  Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { format, addDays, startOfWeek, endOfWeek, eachDayOfInterval, isSameDay, parseISO } from 'date-fns';
import { pt } from 'date-fns/locale';

interface Shift {
  id: string;
  driverId: string;
  driverName: string;
  prefix: string;
  date: string;
  shift: 'Diurno' | 'Nocturno' | '24h';
  status: 'Ativo' | 'Folga' | 'Suspenso';
  updatedAt?: any;
}

interface UserProfile {
  uid: string;
  name: string;
  role: string;
}

interface Vehicle {
  id: string;
  prefix: string;
}

export default function ShiftScheduler({ user }: { user: UserProfile }) {
  const [shifts, setShifts] = useState<Shift[]>([]);
  const [drivers, setDrivers] = useState<UserProfile[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentDate, setCurrentDate] = useState(new Date());
  
  // Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState<Shift | null>(null);
  const [formData, setFormData] = useState({
    driverId: '',
    driverName: '',
    prefix: '',
    date: format(new Date(), 'yyyy-MM-dd'),
    shift: 'Diurno' as 'Diurno' | 'Nocturno' | '24h',
    status: 'Ativo' as 'Ativo' | 'Folga' | 'Suspenso'
  });

  const canManage = user.role === 'admin' || user.role === 'operator';

  useEffect(() => {
    const unsubShifts = onSnapshot(query(collection(db, 'driver_scales'), orderBy('date', 'desc')), (snapshot) => {
      const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Shift[];
      setShifts(data);
      setLoading(false);
    }, (err) => handleFirestoreError(err, OperationType.LIST, 'driver_scales'));

    const fetchMasters = async () => {
      try {
        // Fetch from drivers_master instead of users to include all personnel registered in the fleet
        const driversSnap = await getDocs(collection(db, 'drivers_master'));
        const driversList = driversSnap.docs.map(doc => ({ 
          uid: doc.id, 
          name: doc.data().name, 
          role: 'driver' 
        })) as UserProfile[];
        driversList.sort((a, b) => a.name.localeCompare(b.name));
        setDrivers(driversList);

        const vehiclesSnap = await getDocs(collection(db, 'master_vehicles'));
        const vehiclesList = vehiclesSnap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as Vehicle[];
        // Sort prefixes numerically (e.g., TX-01, TX-10)
        vehiclesList.sort((a, b) => a.prefix.localeCompare(b.prefix, undefined, { numeric: true, sensitivity: 'base' }));
        setVehicles(vehiclesList);
      } catch (err) {
        console.error("Error fetching masters:", err);
      }
    };

    fetchMasters();
    return () => unsubShifts();
  }, []);

  const weekStart = startOfWeek(currentDate, { weekStartsOn: 1 });
  const weekEnd = endOfWeek(currentDate, { weekStartsOn: 1 });
  const days = eachDayOfInterval({ start: weekStart, end: weekEnd });

  const handleOpenModal = (shift?: Shift, date?: Date) => {
    if (shift) {
      setEditingShift(shift);
      setFormData({
        driverId: shift.driverId,
        driverName: shift.driverName,
        prefix: shift.prefix,
        date: shift.date,
        shift: shift.shift,
        status: shift.status
      });
    } else {
      setEditingShift(null);
      setFormData({
        driverId: '',
        driverName: '',
        prefix: '',
        date: date ? format(date, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd'),
        shift: 'Diurno',
        status: 'Ativo'
      });
    }
    setIsModalOpen(true);
  };

  const handleCloneShift = async (shift: Shift) => {
    try {
      const nextDay = addDays(parseISO(shift.date), 1);
      const data = {
        driverId: shift.driverId,
        driverName: shift.driverName,
        prefix: shift.prefix,
        date: format(nextDay, 'yyyy-MM-dd'),
        shift: shift.shift,
        status: shift.status,
        updatedAt: serverTimestamp()
      };
      await addDoc(collection(db, 'driver_scales'), data);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'driver_scales');
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.driverId || !formData.prefix || !formData.date) return;

    try {
      const data = {
        ...formData,
        updatedAt: serverTimestamp()
      };

      if (editingShift) {
        await updateDoc(doc(db, 'driver_scales', editingShift.id), data);
      } else {
        await addDoc(collection(db, 'driver_scales'), data);
      }
      setIsModalOpen(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.WRITE, 'driver_scales');
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Eliminar esta escala permanentemente?")) return;
    try {
      await deleteDoc(doc(db, 'driver_scales', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, 'driver_scales');
    }
  };

  return (
    <div className="space-y-8 animate-in fade-in duration-700">
      {/* Header Context */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <h2 className="text-2xl font-black text-slate-900 dark:text-white uppercase tracking-tighter italic flex items-center gap-3">
            <div className="w-10 h-10 bg-brand-primary rounded-2xl flex items-center justify-center text-white shadow-xl shadow-brand-primary/20">
              <CalendarIcon size={20} />
            </div>
            Escalonamento de Turnos
          </h2>
          <p className="text-slate-500 dark:text-slate-400 text-xs font-bold uppercase tracking-widest mt-2 flex items-center gap-2">
            <span className="w-2 h-2 rounded-full bg-brand-primary animate-pulse" />
            Gestão de Escalas Diárias • {format(currentDate, 'MMMM yyyy', { locale: pt })}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center bg-white dark:bg-slate-900 rounded-xl border border-slate-200 dark:border-white/5 p-1 shadow-sm">
            <button 
              onClick={() => setCurrentDate(addDays(currentDate, -7))}
              className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-slate-400 transition-all"
            >
              <ChevronLeft size={18} />
            </button>
            <div className="px-4 text-[11px] font-black uppercase tracking-widest text-slate-600 dark:text-slate-300">
              Semana de {format(weekStart, 'dd MMM', { locale: pt })}
            </div>
            <button 
              onClick={() => setCurrentDate(addDays(currentDate, 7))}
              className="p-2 hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg text-slate-400 transition-all"
            >
              <ChevronRight size={18} />
            </button>
          </div>

          {canManage && (
            <button 
              onClick={() => handleOpenModal()}
              className="bg-brand-primary hover:bg-brand-secondary text-white px-6 py-3 rounded-xl font-black text-[11px] uppercase tracking-widest flex items-center gap-2 shadow-xl shadow-brand-primary/20 transition-all active:scale-95"
            >
              <Plus size={16} />
              Nova Escala
            </button>
          )}
        </div>
      </div>

      {/* Calendar Grid */}
      <div className="bg-white dark:bg-slate-900 rounded-[2.5rem] border border-slate-200 dark:border-white/5 overflow-hidden shadow-2xl shadow-slate-200/50 dark:shadow-none">
        <div className="grid grid-cols-7 border-b border-slate-100 dark:border-white/5 bg-slate-50/50 dark:bg-white/5">
          {days.map((day, idx) => (
            <div key={idx} className={cn(
              "p-6 text-center border-r border-slate-100 dark:border-white/5 last:border-r-0",
              isSameDay(day, new Date()) && "bg-brand-primary/5 relative"
            )}>
              <span className="block text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1">
                {format(day, 'EEE', { locale: pt })}
              </span>
              <span className={cn(
                "text-lg font-black tracking-tighter",
                isSameDay(day, new Date()) ? "text-brand-primary" : "text-slate-800 dark:text-slate-200"
              )}>
                {format(day, 'dd')}
              </span>
              {isSameDay(day, new Date()) && (
                <div className="absolute top-0 inset-x-0 h-1 bg-brand-primary" />
              )}
            </div>
          ))}
        </div>

        <div className="grid grid-cols-7 min-h-[600px] divide-x divide-slate-100 dark:divide-white/5 h-full">
          {days.map((day, idx) => {
            const dateStr = format(day, 'yyyy-MM-dd');
            const dayShifts = shifts.filter(s => s.date === dateStr);
            
            return (
              <div key={idx} className="p-4 space-y-3 hover:bg-slate-50/50 dark:hover:bg-white/5 transition-colors group h-full">
                {dayShifts.map(shift => (
                  <motion.div 
                    layoutId={shift.id}
                    key={shift.id}
                    className={cn(
                      "p-3 rounded-2xl border transition-all relative group/item",
                      shift.shift === 'Diurno' 
                        ? "bg-amber-50 border-amber-100 text-amber-900 shadow-sm" 
                        : shift.shift === '24h'
                        ? "bg-emerald-50 border-emerald-100 text-emerald-900 shadow-sm"
                        : "bg-indigo-50 border-indigo-100 text-indigo-900 shadow-sm",
                      shift.status === 'Folga' && "opacity-50 grayscale",
                      shift.status === 'Suspenso' && "bg-red-50 border-red-100 text-red-900"
                    )}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="w-8 h-8 rounded-xl bg-white/50 flex items-center justify-center text-current/70">
                         {shift.shift === 'Diurno' ? <Clock size={14} /> : shift.shift === '24h' ? <Zap size={14} /> : <div className="w-2 h-2 rounded-full bg-current opacity-30 animate-ping" />}
                      </div>
                      {canManage && (
                        <div className="flex gap-1 opacity-0 group-hover/item:opacity-100 transition-opacity">
                          <button 
                            onClick={() => handleOpenModal(shift)}
                            className="p-1 hover:bg-white/50 rounded-lg transition-all"
                            title="Editar"
                          >
                            <Edit2 size={12} />
                          </button>
                          <button 
                            onClick={() => handleCloneShift(shift)}
                            className="p-1 hover:bg-white/50 rounded-lg transition-all text-brand-primary"
                            title="Duplicar para Amanhã"
                          >
                            <Copy size={12} />
                          </button>
                          <button 
                            onClick={() => handleDelete(shift.id)}
                            className="p-1 hover:bg-rose-100 text-rose-500 rounded-lg transition-all"
                            title="Eliminar"
                          >
                            <Trash2 size={12} />
                          </button>
                        </div>
                      )}
                    </div>
                    
                    <h5 className="text-[11px] font-black uppercase tracking-tighter truncate leading-none mb-1">
                      {shift.driverName}
                    </h5>
                    <div className="flex items-center gap-2">
                       <span className="text-[9px] font-bold opacity-60 flex items-center gap-1">
                          <Truck size={10} />
                          {shift.prefix}
                       </span>
                    </div>

                    {shift.status !== 'Ativo' && (
                      <div className="mt-2 pt-2 border-t border-current/10 text-[8px] font-black uppercase tracking-widest flex items-center gap-1">
                         <AlertCircle size={10} />
                         {shift.status}
                      </div>
                    )}
                  </motion.div>
                ))}

                {canManage && (
                  <button 
                    onClick={() => handleOpenModal(undefined, day)}
                    className="w-full py-2 border-2 border-dashed border-slate-200 dark:border-white/10 rounded-2xl text-[10px] font-black text-slate-300 dark:text-slate-600 uppercase tracking-widest hover:border-brand-primary hover:text-brand-primary transition-all opacity-0 group-hover:opacity-100"
                  >
                    Atribuir
                  </button>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {loading && (
        <div className="fixed inset-0 bg-white/50 dark:bg-slate-950/50 backdrop-blur-sm z-[100] flex items-center justify-center">
           <div className="w-12 h-12 border-4 border-brand-primary border-t-transparent rounded-full animate-spin shadow-xl shadow-brand-primary/20" />
        </div>
      )}

      {/* Modal Integration */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center p-6">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg bg-white dark:bg-slate-900 rounded-[2.5rem] shadow-2xl border border-white/5 overflow-hidden"
            >
              <div className="p-8 pb-4 flex items-center justify-between">
                <div>
                  <h3 className="text-xl font-black text-slate-900 dark:text-white uppercase tracking-tighter italic">
                    {editingShift ? 'Editar Escala' : 'Nova Atribuição'}
                  </h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">Controle de Escala 24h</p>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="w-10 h-10 rounded-full bg-slate-100 dark:bg-white/5 flex items-center justify-center text-slate-500 hover:text-slate-900 transition-all active:scale-90"
                >
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 pt-4 space-y-6">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Data</label>
                    <input 
                      type="date"
                      value={formData.date}
                      onChange={(e) => setFormData({...formData, date: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Turno</label>
                    <select 
                      value={formData.shift}
                      onChange={(e) => setFormData({...formData, shift: e.target.value as any})}
                      className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all"
                    >
                      <option value="Diurno">Diurno (Dia)</option>
                      <option value="Nocturno">Nocturno (Noite)</option>
                      <option value="24h">24 Horas</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Motorista</label>
                  <select 
                    value={formData.driverId}
                    onChange={(e) => {
                      const d = drivers.find(drv => drv.uid === e.target.value);
                      setFormData({...formData, driverId: e.target.value, driverName: d?.name || ''});
                    }}
                    className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all"
                    required
                  >
                    <option value="">Selecionar Motorista...</option>
                    {drivers.map(d => (
                      <option key={d.uid} value={d.uid}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Viatura (Prefixo)</label>
                    <select 
                      value={formData.prefix}
                      onChange={(e) => setFormData({...formData, prefix: e.target.value})}
                      className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all"
                      required
                    >
                      <option value="">Prefixo...</option>
                      {vehicles.map(v => (
                        <option key={v.id} value={v.prefix}>{v.prefix}</option>
                      ))}
                    </select>
                  </div>
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Estado</label>
                    <select 
                      value={formData.status}
                      onChange={(e) => setFormData({...formData, status: e.target.value as any})}
                      className="w-full bg-slate-50 dark:bg-white/5 border border-slate-200 dark:border-white/10 rounded-xl px-4 py-3 text-sm font-bold text-slate-900 dark:text-white outline-none focus:ring-2 focus:ring-brand-primary/20 transition-all"
                    >
                      <option value="Ativo">Ativo</option>
                      <option value="Folga">Folga</option>
                      <option value="Suspenso">Suspenso</option>
                    </select>
                  </div>
                </div>

                <div className="flex gap-4 pt-4">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-6 py-4 bg-slate-100 dark:bg-white/5 text-slate-600 dark:text-slate-400 font-black text-[11px] uppercase tracking-widest rounded-2xl hover:bg-slate-200 dark:hover:bg-white/10 transition-all active:scale-95"
                  >
                    Cancelar
                  </button>
                  <button 
                    type="submit"
                    className="flex-1 px-6 py-4 bg-brand-primary text-white font-black text-[11px] uppercase tracking-widest rounded-2xl hover:shadow-xl hover:shadow-brand-primary/20 transition-all active:scale-95"
                  >
                    {editingShift ? 'Atualizar Escala' : 'Confirmar Escala'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
