import React, { useState, useEffect } from 'react';
import { 
  Users, 
  Plus, 
  Search, 
  MapPin, 
  Phone, 
  Calendar, 
  DollarSign, 
  CheckCircle2, 
  XCircle, 
  Loader2,
  Trash2,
  AlertCircle,
  FileText,
  Clock,
  Car
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  collection, 
  query, 
  onSnapshot, 
  addDoc, 
  deleteDoc, 
  doc, 
  updateDoc, 
  serverTimestamp,
  orderBy,
  where
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { formatSafe } from '../lib/dateUtils';
import { cn } from '../lib/utils';

export default function InternalClients({ user }: { user?: any }) {
  const [clients, setClients] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [editingContract, setEditingContract] = useState<any | null>(null);
  
  const [formData, setFormData] = useState({
    clientName: '',
    neighborhood: '',
    destination: '',
    period: 'Manhã (07:00 - 09:00)',
    phone: '',
    vehicleId: '',
    entryVehicleId: '',
    exitVehicleId: '',
    entryTime: '07:30',
    exitTime: '17:30',
    occupants: 1,
    notes: '',
    monthlyValue: 0,
    weeklyDays: ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'],
    paymentStatus: 'Pendente',
    status: 'Pendente Ativação'
  });

  const DAYS = ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta', 'Sábado', 'Domingo'];

  const resetForm = () => {
    setFormData({
      clientName: '',
      neighborhood: '',
      destination: '',
      period: 'Manhã (07:00 - 09:00)',
      phone: '',
      vehicleId: '',
      entryVehicleId: '',
      exitVehicleId: '',
      entryTime: '07:30',
      exitTime: '17:30',
      occupants: 1,
      notes: '',
      monthlyValue: 0,
      weeklyDays: ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'],
      paymentStatus: 'Pendente',
      status: 'Pendente Ativação'
    });
    setEditingContract(null);
  };

  const startEdit = (contract: any) => {
    setEditingContract(contract);
    setFormData({
      clientName: contract.clientName || '',
      neighborhood: contract.neighborhood || '',
      destination: contract.destination || '',
      period: contract.period || 'Manhã (07:00 - 09:00)',
      phone: contract.phone || '',
      vehicleId: contract.vehicleId || '',
      entryVehicleId: contract.entryVehicleId || '',
      exitVehicleId: contract.exitVehicleId || '',
      entryTime: contract.entryTime || '07:30',
      exitTime: contract.exitTime || '17:30',
      occupants: contract.occupants || 1,
      notes: contract.notes || '',
      monthlyValue: contract.monthlyValue || 0,
      weeklyDays: contract.weeklyDays || ['Segunda', 'Terça', 'Quarta', 'Quinta', 'Sexta'],
      paymentStatus: contract.paymentStatus || 'Pendente',
      status: contract.status || 'Pendente Ativação'
    });
    setIsModalOpen(true);
  };

  useEffect(() => {
    const q = query(collection(db, 'internal_contracts'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setClients(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'internal_contracts');
      setLoading(false);
    });

    const vQ = query(collection(db, 'master_vehicles'), orderBy('prefix', 'asc'));
    const unsubVehicles = onSnapshot(vQ, (snapshot) => {
      setVehicles(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'master_vehicles');
    });

    return () => {
      unsub();
      unsubVehicles();
    };
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (formData.clientName.length < 3) throw new Error("Insira o nome do cliente.");
      if (formData.phone.length < 9) throw new Error("Insira um contacto válido.");

      let finalPhone = formData.phone.trim();
      if (!finalPhone.startsWith('+244')) {
        const cleanDigits = finalPhone.replace(/^\+?244/, '').replace(/^0+/, '');
        finalPhone = `+244 ${cleanDigits}`;
      }

      const submissionData = {
        ...formData,
        phone: finalPhone,
      };

      if (editingContract) {
        await updateDoc(doc(db, 'internal_contracts', editingContract.id), submissionData);
      } else {
        await addDoc(collection(db, 'internal_contracts'), {
          ...submissionData,
          createdAt: new Date().toISOString()
        });
      }
      setIsModalOpen(false);
      resetForm();
    } catch (err: any) {
      alert(err.message || "Erro ao salvar contrato");
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string, name: string) => {
    if (confirm(`Tem certeza que deseja remover o contrato de ${name}?`)) {
      try {
        await deleteDoc(doc(db, 'internal_contracts', id));
      } catch (err) {
        handleFirestoreError(err, OperationType.DELETE, `internal_contracts/${id}`);
      }
    }
  };

  const toggleStatus = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === 'Ativo' ? 'Pendente Ativação' : 'Ativo';
    try {
      await updateDoc(doc(db, 'internal_contracts', id), { status: newStatus });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `internal_contracts/${id}`);
    }
  };

  const togglePaymentStatus = async (id: string, current: string) => {
    const newStatus = current === 'Pago' ? 'Pendente' : 'Pago';
    try {
      await updateDoc(doc(db, 'internal_contracts', id), { paymentStatus: newStatus });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `internal_contracts/${id}`);
    }
  };

  const toggleDay = (day: string) => {
    setFormData(prev => ({
      ...prev,
      weeklyDays: prev.weeklyDays.includes(day) 
        ? prev.weeklyDays.filter(d => d !== day)
        : [...prev.weeklyDays, day]
    }));
  };

  const filteredClients = clients.filter(c => 
    c.clientName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    c.neighborhood?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-8 animate-in fade-in duration-500">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-8 rounded-[2rem] border border-slate-200">
        <div>
          <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">Contratos Internos</h2>
          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-[0.3em] mt-1 flex items-center gap-2">
             <Calendar size={14} className="text-brand-primary" />
             Gestão de Rotas Corporativas • LUENA MOXICO
          </p>
        </div>
        
        <button 
          onClick={() => { resetForm(); setIsModalOpen(true); }}
          className="bg-slate-900 text-white px-8 py-4 rounded-2xl text-xs font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-slate-900/20 flex items-center gap-3"
        >
          <Plus size={18} />
          Novo Contrato Fixado
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm">
          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Portfólio Ativo</p>
          <p className="text-3xl font-black text-slate-900 tracking-tighter italic">{clients.filter(c => c.status === 'Ativo').length}</p>
        </div>
        <div className="bg-emerald-50 p-6 rounded-3xl border border-emerald-100 shadow-sm">
          <div className="flex items-center justify-between mb-1">
             <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Receita Mensal Prevista</p>
             <DollarSign size={14} className="text-emerald-500" />
          </div>
          <p className="text-3xl font-black text-emerald-700 tracking-tighter italic">
            {clients.reduce((acc, c) => acc + (Number(c.monthlyValue) || 0), 0).toLocaleString()} <span className="text-xs">AKZ</span>
          </p>
        </div>
        <div className="bg-amber-50 p-6 rounded-3xl border border-amber-100 shadow-sm">
          <p className="text-[10px] font-black text-amber-600 uppercase tracking-widest mb-1">Inadimplência (Mês Actual)</p>
          <p className="text-3xl font-black text-amber-700 tracking-tighter italic">
            {clients.filter(c => c.paymentStatus === 'Pendente').length} <span className="text-xs uppercase tracking-normal">Clientes</span>
          </p>
        </div>
        <div className="bg-white p-6 rounded-3xl border border-slate-200 shadow-sm flex items-center">
          <div className="relative w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text" 
              placeholder="LOCALIZAR CONTRATO..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-3 bg-slate-50 border-none rounded-xl text-[11px] font-black uppercase tracking-widest outline-none focus:ring-2 ring-brand-primary/20 transition-all placeholder:text-slate-300"
            />
          </div>
        </div>
      </div>

      {/* Grid of high-density cards for internal contracts */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-4 gap-4">
        <AnimatePresence mode="popLayout">
          {filteredClients.map((client) => {
            const isPaid = client.paymentStatus === 'Pago';
            const isActive = client.status === 'Ativo';
            const assignedVehicle = vehicles.find(v => v.id === client.vehicleId);

            return (
              <motion.div 
                key={client.id}
                layout
                initial={{ opacity: 0, y: 15 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="bg-white rounded-2xl border border-slate-200 p-3.5 flex flex-col justify-between hover:border-brand-primary hover:shadow-lg hover:shadow-slate-100/30 transition-all duration-300 relative group overflow-hidden"
              >
                <div className={cn(
                  "absolute top-0 left-0 right-0 h-1.5 transition-all",
                  isActive ? "bg-emerald-500" : "bg-slate-300"
                )} />

                <div className="space-y-3">
                  {/* Card Header: Toggles & Remove Action */}
                  <div className="flex items-center justify-between gap-2 mt-1">
                    <div className="flex items-center gap-1">
                      <button 
                        onClick={() => toggleStatus(client.id, client.status)}
                        className={cn(
                          "px-2 py-1 rounded-[6px] text-[8px] font-black uppercase tracking-wider transition-all shadow-sm w-fit",
                          isActive 
                            ? "bg-emerald-500 text-white shadow-emerald-500/15" 
                            : "bg-slate-100 text-slate-500 hover:bg-slate-200"
                        )}
                        title="Alternar estado do contrato"
                      >
                        {client.status}
                      </button>

                      <button 
                        onClick={() => togglePaymentStatus(client.id, client.paymentStatus)}
                        className={cn(
                          "px-2 py-1 rounded-[6px] text-[8px] font-black uppercase tracking-wider border w-fit transition-all",
                          isPaid 
                            ? "bg-emerald-50 text-emerald-600 border-emerald-100" 
                            : "bg-rose-50 text-rose-600 border-rose-100 hover:bg-rose-100"
                        )}
                        title="Alternar estado de faturação"
                      >
                        {client.paymentStatus}
                      </button>
                    </div>

                    <button 
                      onClick={() => handleDelete(client.id, client.clientName)}
                      className="p-1 px-1.5 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                      title="Apagar Contrato"
                    >
                      <Trash2 size={13} />
                    </button>
                  </div>

                  {/* Client Info */}
                  <div>
                    <p className="text-[7.5px] font-black text-slate-450 uppercase tracking-widest leading-none mb-0.5">Titular</p>
                    <h4 className="text-[13px] font-black text-slate-950 uppercase italic tracking-tight leading-tight line-clamp-1">{client.clientName}</h4>
                    <div className="flex items-center gap-1 mt-0.5 text-slate-500 text-[9.5px]">
                      <Phone size={10} className="text-brand-primary" />
                      <span className="font-bold tracking-wider">{client.phone}</span>
                    </div>
                  </div>

                  {/* Route Segment */}
                  <div className="bg-slate-50 p-2 rounded-xl border border-slate-100/80 flex items-center justify-between gap-2">
                    <div className="flex items-center gap-1 min-w-0 flex-1">
                      <div className="w-1.5 h-1.5 rounded-full border border-brand-primary bg-white shrink-0" />
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-wide truncate" title={client.neighborhood}>
                        {client.neighborhood}
                      </span>
                    </div>
                    <span className="text-slate-300 font-black text-[9px] shrink-0">→</span>
                    <div className="flex items-center gap-1 min-w-0 flex-1 justify-end">
                      <MapPin size={9} className="text-rose-500 shrink-0" />
                      <span className="text-[9px] font-black text-slate-800 uppercase tracking-wide truncate text-right" title={client.destination}>
                        {client.destination}
                      </span>
                    </div>
                  </div>

                  {/* Operation Data & Days */}
                  <div className="flex items-center justify-between border-t border-b border-dashed border-slate-100 py-1.5 text-[9px]">
                    <div className="flex items-center gap-1">
                      <span className="text-slate-400 font-bold uppercase tracking-widest text-[7.5px]">Período:</span>
                      <span className="font-extrabold text-slate-700 uppercase">{client.period}</span>
                    </div>
                    <div className="flex flex-wrap gap-0.5 max-w-[60%] justify-end">
                      {Array.isArray(client.weeklyDays) && client.weeklyDays.map((d: string) => (
                        <span key={d} className="px-1 py-0.5 bg-slate-150 text-slate-600 rounded-[3px] text-[6.5px] font-black uppercase">
                          {d.slice(0, 3)}
                        </span>
                      ))}
                    </div>
                  </div>

                  {/* Detailed Transportation Status */}
                  <div className="space-y-1.5">
                    <div className="grid grid-cols-2 gap-1.5">
                      <div className="bg-emerald-50/40 p-1.5 rounded-lg border border-emerald-100/35 flex flex-col">
                        <div className="flex items-center gap-1 text-[7px] font-black text-emerald-800 uppercase tracking-wide">
                          <Car size={8} className="text-emerald-600 animate-pulse" /> IDA
                        </div>
                        <p className="font-black text-slate-800 text-[9px] truncate mt-0.5">{client.entryVehicleId || "N/A"}</p>
                        <p className="text-[7.5px] text-slate-400 font-bold">Entr: {client.entryTime || "--:--"}</p>
                      </div>

                      <div className="bg-rose-50/40 p-1.5 rounded-lg border border-rose-100/35 flex flex-col">
                        <div className="flex items-center gap-1 text-[7px] font-black text-rose-800 uppercase tracking-wide">
                          <Car size={8} className="text-rose-600 animate-pulse" /> VOLTA
                        </div>
                        <p className="font-black text-slate-800 text-[9px] truncate mt-0.5">{client.exitVehicleId || "N/A"}</p>
                        <p className="text-[7.5px] text-slate-400 font-bold">Saíd: {client.exitTime || "--:--"}</p>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center justify-between text-[9px] bg-slate-50/80 p-1.5 rounded-lg border border-slate-100/80">
                    <span className="text-[8px] font-black text-slate-500 uppercase tracking-wider flex items-center gap-1">
                      <Users size={10} className="text-brand-primary" /> Passageiros:
                    </span>
                    <span className="font-black text-slate-800">
                      {client.occupants || 1} Pax
                    </span>
                  </div>
                </div>

                {/* Card Footer: Monthly Value & Action */}
                <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between">
                  <div>
                    <p className="text-[7px] text-slate-400 font-bold uppercase tracking-widest">Valor Fixo</p>
                    <p className="text-[12px] font-black text-slate-900 tracking-tight leading-none mt-0.5">
                      {(Number(client.monthlyValue) || 0).toLocaleString()} <span className="text-[7.5px] font-black text-slate-350">AKZ</span>
                    </p>
                  </div>
                  
                  <button 
                    onClick={() => startEdit(client)}
                    className="text-[8px] font-black uppercase tracking-wider bg-slate-950 text-white hover:bg-brand-primary px-3 py-1.5 rounded-lg transition-all shadow-xs active:scale-95"
                  >
                    Editar
                  </button>
                </div>
              </motion.div>
            );
          })}
        </AnimatePresence>
        {filteredClients.length === 0 && (
          <div className="col-span-1 md:col-span-2 lg:col-span-3 xl:col-span-4 bg-white border border-slate-200 rounded-[2.5rem] py-20 text-center">
             <FileText size={48} className="text-slate-200 mx-auto mb-4" />
             <p className="text-sm font-black text-slate-300 uppercase tracking-widest italic animate-pulse">Nenhum contrato fixado encontrado</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative bg-white rounded-[3rem] shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden"
            >
              <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic">{editingContract ? 'Editar Contrato PSM' : 'Novo Contrato PSM'}</h3>
                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{editingContract ? 'Atualização de Rota Fixa Corporativa' : 'Registo de Rota Fixa Corporativa'}</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="w-12 h-12 flex items-center justify-center bg-white rounded-2xl text-slate-400 hover:text-slate-900 shadow-sm border border-slate-100 transition-all">
                  <XCircle size={28} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-10">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
                  <div className="space-y-6">
                    <div className="space-y-2">
                       <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Titular / Empresa</label>
                       <div className="relative group">
                          <Users size={18} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-brand-primary transition-colors" />
                          <input 
                            required
                            type="text" 
                            placeholder="NOME DO CLIENTE..."
                            value={formData.clientName}
                            onChange={(e) => setFormData({...formData, clientName: e.target.value.toUpperCase()})}
                            className="w-full pl-12 pr-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-black focus:bg-white focus:border-brand-primary outline-none transition-all shadow-inner uppercase"
                          />
                       </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Local de Recolha</label>
                          <input 
                            required
                            type="text" 
                            placeholder="BAIRRO..."
                            value={formData.neighborhood}
                            onChange={(e) => setFormData({...formData, neighborhood: e.target.value})}
                            className="w-full px-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:bg-white focus:border-brand-primary outline-none transition-all shadow-inner"
                          />
                       </div>
                       <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Destino Final</label>
                          <input 
                            required
                            type="text" 
                            placeholder="LOCAL..."
                            value={formData.destination}
                            onChange={(e) => setFormData({...formData, destination: e.target.value})}
                            className="w-full px-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:bg-white focus:border-brand-primary outline-none transition-all shadow-inner"
                          />
                       </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Contacto Telefónico</label>
                        <input 
                          required
                          type="tel" 
                          placeholder="+244..."
                          value={formData.phone}
                          onChange={(e) => setFormData({...formData, phone: e.target.value})}
                          className="w-full px-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:bg-white focus:border-brand-primary outline-none transition-all shadow-inner"
                        />
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">N.º Passageiros (Lotação)</label>
                        <input 
                          required
                          type="number" 
                          min={1}
                          value={formData.occupants}
                          onChange={(e) => setFormData({...formData, occupants: Number(e.target.value)})}
                          className="w-full px-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold focus:bg-white focus:border-brand-primary outline-none transition-all shadow-inner"
                        />
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Mensalidade Acordada (AKZ)</label>
                      <input 
                        required
                        type="number" 
                        value={formData.monthlyValue}
                        onChange={(e) => setFormData({...formData, monthlyValue: Number(e.target.value)})}
                        className="w-full px-4 py-4 bg-slate-900 text-brand-primary border-none rounded-2xl text-lg font-black focus:ring-4 ring-brand-primary/20 outline-none transition-all shadow-xl shadow-slate-900/20"
                      />
                    </div>
                  </div>

                  <div className="space-y-6">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Dias de Operação</label>
                      <div className="flex flex-wrap gap-2">
                        {DAYS.map(day => (
                          <button
                            key={day}
                            type="button"
                            onClick={() => toggleDay(day)}
                            className={cn(
                              "px-3 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border",
                              formData.weeklyDays.includes(day)
                                ? "bg-brand-primary text-white border-brand-primary shadow-lg shadow-brand-primary/30"
                                : "bg-white text-slate-400 border-slate-100 hover:border-slate-300"
                            )}
                          >
                            {day.slice(0, 3)}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Período / Turno</label>
                      <select 
                        value={formData.period}
                        onChange={(e) => setFormData({...formData, period: e.target.value})}
                        className="w-full px-4 py-4 bg-slate-50 border border-slate-100 rounded-2xl text-sm font-bold outline-none focus:bg-white focus:border-brand-primary"
                      >
                        <option>Manhã (07:00 - 09:00)</option>
                        <option>Almoço (12:00 - 14:00)</option>
                        <option>Tarde (17:00 - 19:00)</option>
                        <option>Noite (22:00 - 00:00)</option>
                        <option>Turno Completo (Apoio)</option>
                      </select>
                    </div>

                    {/* Ida (Leva) */}
                    <div className="grid grid-cols-2 gap-4 bg-emerald-50/20 p-4 rounded-2xl border border-emerald-100/50">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-emerald-800 uppercase tracking-widest ml-1">Viatura que Leva (Ida)</label>
                        <select 
                          value={formData.entryVehicleId}
                          onChange={(e) => setFormData({...formData, entryVehicleId: e.target.value})}
                          className="w-full px-3 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-emerald-500"
                        >
                          <option value="">Selecionar...</option>
                          {vehicles.map(v => (
                            <option key={v.id} value={v.prefix}>{v.prefix} - {v.brand}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-emerald-800 uppercase tracking-widest ml-1">Hora Entrada (Ida)</label>
                        <input 
                          type="text"
                          placeholder="Ex: 07:30"
                          value={formData.entryTime}
                          onChange={(e) => setFormData({...formData, entryTime: e.target.value})}
                          className="w-full px-3 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-emerald-500"
                        />
                      </div>
                    </div>

                    {/* Volta (Busca) */}
                    <div className="grid grid-cols-2 gap-4 bg-rose-50/20 p-4 rounded-2xl border border-rose-100/50">
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-rose-800 uppercase tracking-widest ml-1">Viatura que Busca (Volta)</label>
                        <select 
                          value={formData.exitVehicleId}
                          onChange={(e) => setFormData({...formData, exitVehicleId: e.target.value})}
                          className="w-full px-3 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-rose-500"
                        >
                          <option value="">Selecionar...</option>
                          {vehicles.map(v => (
                            <option key={v.id} value={v.prefix}>{v.prefix} - {v.brand}</option>
                          ))}
                        </select>
                      </div>
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-rose-800 uppercase tracking-widest ml-1">Hora Saída (Volta)</label>
                        <input 
                          type="text"
                          placeholder="Ex: 17:30"
                          value={formData.exitTime}
                          onChange={(e) => setFormData({...formData, exitTime: e.target.value})}
                          className="w-full px-3 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-rose-500"
                        />
                      </div>
                    </div>

                    {/* Hidden default vehicle selector to retain state consistency */}
                    <input type="hidden" value={formData.vehicleId} />

                    <div className="bg-brand-primary/5 p-6 rounded-3xl border border-brand-primary/10 flex gap-4">
                       <AlertCircle className="text-brand-primary flex-shrink-0" size={24} />
                       <p className="text-[10px] text-slate-500 font-bold leading-relaxed uppercase">
                         Ao salvar, este contrato entrará em estado <span className="text-brand-primary font-black italic">"Pendente Ativação"</span>. Deverá ser ativado manualmente após confirmação de rota com o motorista.
                       </p>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-end gap-4 mt-12 pt-8 border-t border-slate-100">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-10 py-4 rounded-2xl text-xs font-black uppercase tracking-[0.2em] text-slate-400 hover:text-slate-900 transition-all"
                  >
                    Retroceder
                  </button>
                  <button 
                    type="submit"
                    disabled={loading}
                    className="bg-brand-primary text-white px-12 py-4 rounded-2xl text-xs font-black uppercase tracking-[0.2em] hover:bg-brand-secondary transition-all shadow-2xl shadow-brand-primary/40 flex items-center gap-3 active:scale-95"
                  >
                    {loading ? <Loader2 className="animate-spin" size={20} /> : <CheckCircle2 size={20} />}
                    {editingContract ? 'GUARDAR ALTERAÇÕES' : 'FIDELIZAR CONTRATO'}
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
