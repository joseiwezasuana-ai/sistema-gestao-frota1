import React, { useState, useEffect } from 'react';
import { 
  Users, 
  MapPin, 
  Clock, 
  CheckCircle2, 
  Plus, 
  Search, 
  Car, 
  Phone, 
  Calendar,
  FileText,
  X,
  Loader2,
  Bookmark,
  Briefcase,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, onSnapshot, addDoc, query, orderBy, serverTimestamp, doc, getDocs, updateDoc, deleteDoc } from 'firebase/firestore';
import { cn } from '../lib/utils';

interface InternalClientsProps {
  user?: any;
}

export default function InternalClients({ user }: InternalClientsProps) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [contracts, setContracts] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    clientName: '',
    neighborhood: '',
    destination: 'Trabalho', // Trabalho | Escola
    period: 'Manhã', // Manhã | Tarde | Noite
    phone: '',
    entryVehicleId: '',
    exitVehicleId: '',
    entryTime: '07:00',
    exitTime: '17:00',
    notes: '',
    occupants: 1,
    weeklyDays: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'], // Default work days
    monthlyValue: '',
    paymentStatus: 'Pendente' // Pendente | Pago
  });

  const DAYS_OF_WEEK = ['Seg', 'Ter', 'Qua', 'Qui', 'Sex', 'Sáb', 'Dom'];

  useEffect(() => {
    // Listen for contracts
    const q = query(collection(db, 'internal_contracts'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setContracts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'internal_contracts'));

    // Fetch vehicles for selection
    const fetchVehicles = async () => {
      try {
        const snap = await getDocs(collection(db, 'master_vehicles'));
        setVehicles(snap.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, 'master_vehicles');
      }
    };
    fetchVehicles();

    return () => unsub();
  }, []);

  const isAdmin = user?.role === 'admin' || user?.email === 'joseiwezasuana@gmail.com';
  const canManage = isAdmin || user?.role === 'operator';

  const deleteContract = async (id: string) => {
    if (!isAdmin) return;
    if (!confirm('Deseja eliminar este contrato permanentemente do sistema? Esta acção é irreversível.')) return;
    try {
      await deleteDoc(doc(db, 'internal_contracts', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `internal_contracts/${id}`);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const docRef = await addDoc(collection(db, 'internal_contracts'), {
        ...formData,
        createdAt: serverTimestamp(),
        status: 'Pendente Ativação', // New initial status
        createdBy: user?.uid || 'admin'
      });

      if (formData.paymentStatus === 'Pago') {
        await addDoc(collection(db, 'revenue_logs'), {
          amount: parseFloat(formData.monthlyValue) || 0,
          category: 'Contrato Corporativo',
          type: 'internal_contract',
          contractId: docRef.id,
          driverName: formData.clientName,
          status: 'finalized',
          timestamp: new Date().toISOString(),
          description: `Pagamento de Avença Mensal - ${formData.clientName}`
        });
      }

      setIsModalOpen(false);
      setFormData({
        clientName: '',
        neighborhood: '',
        destination: 'Trabalho',
        period: 'Manhã',
        phone: '',
        entryVehicleId: '',
        exitVehicleId: '',
        entryTime: '07:00',
        exitTime: '17:00',
        notes: '',
        occupants: 1,
        weeklyDays: ['Seg', 'Ter', 'Qua', 'Qui', 'Sex'],
        monthlyValue: '',
        paymentStatus: 'Pendente'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'internal_contracts');
    } finally {
      setLoading(false);
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

  const filteredContracts = contracts.filter(c => 
    (c.clientName || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
    (c.neighborhood || '').toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-[1400px] mx-auto space-y-8">
      <div className="flex flex-col md:flex-row md:items-center justify-between bg-white px-10 py-10 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-primary/5 rounded-full -mr-48 -mt-48 blur-[80px] opacity-50 group-hover:bg-brand-primary/10 transition-colors duration-700" />
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-2">
            <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">Clientes Internos</h2>
            <div className="px-3 py-1 bg-brand-primary/10 text-brand-primary rounded-full text-[10px] font-black uppercase tracking-[0.2em] border border-brand-primary/20">PSM VIP CONTRACTS</div>
          </div>
          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-[0.3em] flex items-center gap-2">
            <Bookmark size={14} className="text-brand-primary" />
            Gestão de Contratos de Mobilidade Corporativa & Escolar • CENTRAL LUENA
          </p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="relative z-10 flex items-center gap-3 px-10 py-4 bg-slate-900 text-white rounded-[1.25rem] text-[11px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-2xl shadow-black/20 active:scale-95 group/btn"
        >
          <div className="p-1 bg-white/10 rounded-lg group-hover/btn:bg-brand-primary group-hover/btn:text-white transition-colors">
            <Plus size={18} />
          </div>
          Novo Contrato Corporativo
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-amber-500/5 rounded-full -mr-12 -mt-12 blur-2xl group-hover:bg-amber-500/10 transition-colors" />
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600">
              <Bookmark size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Disponíveis / Pendentes</p>
              <h4 className="text-2xl font-black text-slate-900 leading-none">
                {contracts.filter(c => c.status !== 'Ativo').length}
              </h4>
            </div>
          </div>
        </div>

        <div className="bg-white border border-slate-200 rounded-3xl p-6 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-24 h-24 bg-emerald-500/5 rounded-full -mr-12 -mt-12 blur-2xl group-hover:bg-emerald-500/10 transition-colors" />
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-emerald-100 rounded-2xl flex items-center justify-center text-emerald-600">
              <CheckCircle2 size={24} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contratos Ativos</p>
              <h4 className="text-2xl font-black text-slate-900 leading-none">
                {contracts.filter(c => c.status === 'Ativo').length}
              </h4>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 rounded-3xl p-6 shadow-xl relative overflow-hidden group border border-slate-800">
          <div className="absolute top-0 right-0 w-24 h-24 bg-brand-primary/20 rounded-full -mr-12 -mt-12 blur-2xl group-hover:bg-brand-primary/30 transition-colors" />
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 bg-brand-primary rounded-2xl flex items-center justify-center text-white shadow-lg shadow-brand-primary/20">
               <FileText size={24} />
            </div>
            <div className="relative z-10">
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Receita de Contrato (Mês)</p>
              <h4 className="text-2xl font-black text-white leading-none tracking-tighter">
                {new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(
                  contracts.reduce((acc, c) => acc + (parseFloat(c.monthlyValue) || 0), 0)
                )}
              </h4>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
        <div className="lg:col-span-1 space-y-6">
           <div className="bg-slate-900 rounded-2xl p-6 text-white relative h-fit overflow-hidden">
              <div className="absolute top-0 right-0 w-24 h-24 bg-brand-primary/20 blur-2xl rounded-full" />
              <div className="relative">
                <Bookmark className="text-brand-primary mb-4" size={24} />
                <h3 className="text-sm font-black uppercase tracking-tight mb-4 italic">Resumo de Rotas</h3>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Trabalho</span>
                    <span className="text-xs font-black text-white">{contracts.filter(c => c.destination === 'Trabalho').length} Passageiros</span>
                  </div>
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-bold text-slate-400 uppercase">Escola</span>
                    <span className="text-xs font-black text-white">{contracts.filter(c => c.destination === 'Escola').length} Passageiros</span>
                  </div>
                   <div className="flex items-center justify-between pt-4 border-t border-slate-800">
                    <span className="text-[10px] font-bold text-brand-primary uppercase">Total Ativo</span>
                    <span className="text-lg font-black text-white">{contracts.length}</span>
                  </div>
                </div>
              </div>
           </div>

           <div className="bg-white border border-slate-200 rounded-2xl p-6 shadow-sm">
              <div className="flex items-center gap-2 mb-4">
                <Search size={16} className="text-slate-400" />
                <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Filtrar Passageiro</h4>
              </div>
              <input 
                type="text" 
                placeholder="Nome ou Bairro..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:bg-white focus:border-brand-primary transition-all outline-none"
              />
           </div>
        </div>

        <div className="lg:col-span-3 space-y-4">
           {filteredContracts.length === 0 ? (
             <div className="bg-white border border-slate-200 rounded-2xl p-12 text-center flex flex-col items-center justify-center opacity-40">
                <Users size={48} className="mb-4" />
                <p className="text-sm font-black uppercase tracking-widest italic">Nenhum contrato registado</p>
                <p className="text-[10px] font-bold mt-1">Crie um novo contrato para começar a monitorar os clientes.</p>
             </div>
           ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
               {filteredContracts.map((contract) => (
                 <motion.div 
                   layout
                   key={contract.id}
                   className="bg-white border border-slate-200 rounded-xl p-3 shadow-sm hover:shadow-md transition-all group"
                 >
                   <div className="flex items-start justify-between mb-2">
                      <div className="flex items-center gap-2">
                         <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-slate-500 font-extrabold italic text-xs">
                            {contract.clientName?.charAt(0) || '?'}
                         </div>
                         <div>
                            <h3 className="text-[11px] font-black text-slate-900 uppercase tracking-tight leading-tight">{contract.clientName}</h3>
                            <div className="flex items-center gap-1 text-[8px] font-bold text-slate-400 uppercase">
                               <MapPin size={8} /> {contract.neighborhood}
                            </div>
                         </div>
                      </div>
                      <div className="flex flex-col items-end gap-1">
                        <span className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-tighter ${
                          contract.period === 'Manhã' ? 'bg-amber-100 text-amber-700' :
                          contract.period === 'Tarde' ? 'bg-blue-100 text-blue-700' : 'bg-slate-800 text-white'
                        }`}>
                           {contract.period}
                        </span>
                        <div className="flex items-center gap-1 bg-slate-100 px-1.5 py-0.5 rounded text-[7px] font-black text-slate-600">
                          <Users size={8} />
                          {contract.occupants || 1} PAX
                        </div>
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-2 mb-2">
                      <div className="p-1.5 bg-slate-50 rounded-lg border border-slate-100">
                         <p className="text-[7px] font-black text-slate-400 uppercase mb-1">Rota</p>
                         <div className="flex flex-wrap gap-0.5">
                            {DAYS_OF_WEEK.map(day => (
                              <button
                                key={day}
                                disabled={!isAdmin}
                                onClick={async () => {
                                  if (!isAdmin) return;
                                  const currentDays = contract.weeklyDays || [];
                                  const newDays = currentDays.includes(day)
                                    ? currentDays.filter((d: string) => d !== day)
                                    : [...currentDays, day];
                                  try {
                                    await updateDoc(doc(db, 'internal_contracts', contract.id), { weeklyDays: newDays });
                                  } catch(err) { console.error(err); }
                                }}
                                className={cn(
                                  "w-5 h-5 flex items-center justify-center rounded text-[6px] font-black uppercase transition-all",
                                  contract.weeklyDays?.includes(day)
                                    ? "bg-brand-primary text-white"
                                    : "bg-white text-slate-300 border border-slate-200 hover:border-slate-300"
                                )}
                              >
                                {day.charAt(0)}
                              </button>
                            ))}
                         </div>
                       </div>
                       <div className="p-1.5 bg-slate-50 rounded-lg border border-slate-100">
                         <div className="flex items-center justify-between">
                           <p className="text-[7px] font-black text-slate-400 uppercase mb-0.5">Avença (Kz)</p>
                           {isAdmin && (
                             <div className="flex items-center gap-1">
                               <p className="text-[7px] font-black text-slate-400 uppercase">PAX:</p>
                               <input 
                                 type="number"
                                 value={contract.occupants || 1}
                                 onChange={async (e) => {
                                   try {
                                     await updateDoc(doc(db, 'internal_contracts', contract.id), { occupants: parseInt(e.target.value) || 1 });
                                   } catch(err) { console.error(err); }
                                 }}
                                 className="w-5 bg-white border border-slate-200 rounded text-[8px] font-black text-center p-0"
                               />
                             </div>
                           )}
                         </div>
                         <input 
                           type="number"
                           readOnly={!isAdmin}
                           value={contract.monthlyValue || ''}
                           onChange={async (e) => {
                             if (!isAdmin) return;
                             try {
                               await updateDoc(doc(db, 'internal_contracts', contract.id), { monthlyValue: e.target.value });
                             } catch(err) { console.error(err); }
                           }}
                           className="w-full bg-transparent text-[10px] font-black text-slate-900 border-none outline-none focus:ring-0 italic placeholder:text-slate-300 p-0"
                           placeholder="0"
                         />
                      </div>
                   </div>

                   <div className="grid grid-cols-2 gap-2 mb-2">
                      <div className="p-1.5 bg-slate-50 rounded-lg border border-slate-100">
                         <p className="text-[7px] font-black text-slate-400 uppercase mb-0.5">Destino</p>
                         <div className="flex items-center gap-1 text-[9px] font-bold text-slate-700 uppercase">
                            {contract.destination === 'Trabalho' ? <Briefcase size={10} className="text-brand-primary" /> : <Users size={10} className="text-brand-primary" />}
                            {contract.destination}
                         </div>
                      </div>
                          <div className="p-1.5 bg-slate-50 rounded-lg border border-slate-100 flex flex-col justify-center">
                             <p className="text-[7px] font-black text-slate-400 uppercase mb-0.5">Cobrança</p>
                             <button 
                               disabled={!isAdmin}
                               onClick={async () => {
                                 if (!isAdmin) return;
                                 const newStatus = contract.paymentStatus === 'Pago' ? 'Pendente' : 'Pago';
                                 try {
                                   await updateDoc(doc(db, 'internal_contracts', contract.id), { 
                                     paymentStatus: newStatus 
                                   });
    
                                   if (newStatus === 'Pago') {
                                     await addDoc(collection(db, 'revenue_logs'), {
                                       amount: parseFloat(contract.monthlyValue) || 0,
                                       category: 'Contrato Corporativo',
                                       type: 'internal_contract',
                                       contractId: contract.id,
                                       driverName: contract.clientName,
                                       status: 'finalized',
                                       timestamp: new Date().toISOString(),
                                       description: `Pagamento de Avença Mensal - ${contract.clientName}`
                                     });
                                   }
                                 } catch(e) { console.error(e); }
                               }}
                               className={cn(
                                 "px-1 py-0.5 rounded text-[7px] font-black uppercase w-fit transition-all",
                                 isAdmin ? "hover:scale-105 cursor-pointer" : "cursor-not-allowed opacity-70",
                                 contract.paymentStatus === 'Pago' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                               )}
                             >
                               {contract.paymentStatus || 'Pendente'}
                             </button>
                          </div>
                   </div>

                   {contract.notes && (
                     <div className="mb-2 p-1.5 bg-slate-50 rounded-lg text-[8px] text-slate-500 font-medium italic border-l-2 border-slate-200">
                        "{contract.notes}"
                     </div>
                   )}

                   <div className="pt-2 border-t border-slate-50 space-y-2">
                     <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between text-[8px] font-black uppercase text-slate-400">
                           <span className="flex items-center gap-1 tracking-tighter"><Car size={8} className="text-emerald-500" /> Entrada</span>
                           <input 
                             type="time"
                             value={contract.entryTime || '07:00'}
                             onChange={async (e) => {
                               try {
                                 await updateDoc(doc(db, 'internal_contracts', contract.id), { entryTime: e.target.value });
                               } catch(err) { console.error(err); }
                             }}
                             className="bg-slate-100 px-1 py-0 rounded text-slate-900 border-none outline-none text-[8px]"
                           />
                        </div>
                        <select 
                          className="bg-slate-50 p-1.5 rounded-lg text-[8px] font-black text-slate-600 uppercase tracking-widest outline-none cursor-pointer hover:border-brand-primary border border-transparent transition-colors w-full"
                          value={contract.entryVehicleId || ''}
                          onChange={async (e) => {
                            try {
                              await updateDoc(doc(db, 'internal_contracts', contract.id), { entryVehicleId: e.target.value });
                            } catch(err) { console.error(err); }
                          }}
                        >
                          <option value="">Sem Viatura Entrada</option>
                          {vehicles.map(v => {
                            const vLabel = `${v.prefix} - ${v.plate}`;
                            return <option key={v.id} value={vLabel}>{vLabel}</option>;
                          })}
                        </select>
                     </div>

                     <div className="flex flex-col gap-1">
                        <div className="flex items-center justify-between text-[8px] font-black uppercase text-slate-400">
                           <span className="flex items-center gap-1 tracking-tighter"><Car size={8} className="text-rose-500" /> Saída</span>
                           <input 
                             type="time"
                             value={contract.exitTime || '17:00'}
                             onChange={async (e) => {
                               try {
                                 await updateDoc(doc(db, 'internal_contracts', contract.id), { exitTime: e.target.value });
                               } catch(err) { console.error(err); }
                             }}
                             className="bg-slate-100 px-1 py-0 rounded text-slate-900 border-none outline-none text-[8px]"
                           />
                        </div>
                        <select 
                          className="bg-slate-50 p-1.5 rounded-lg text-[8px] font-black text-slate-600 uppercase tracking-widest outline-none cursor-pointer hover:border-brand-primary border border-transparent transition-colors w-full"
                          value={contract.exitVehicleId || ''}
                          onChange={async (e) => {
                            try {
                              await updateDoc(doc(db, 'internal_contracts', contract.id), { exitVehicleId: e.target.value });
                            } catch(err) { console.error(err); }
                          }}
                        >
                          <option value="">Sem Viatura Saída</option>
                          {vehicles.map(v => {
                            const vLabel = `${v.prefix} - ${v.plate}`;
                            return <option key={v.id} value={vLabel}>{vLabel}</option>;
                          })}
                        </select>
                     </div>

                     <div className="flex items-center justify-between pt-1">
                       <div className="flex items-center gap-1">
                        {contract.status === 'Pendente Ativação' ? (
                          <button 
                            disabled={!isAdmin}
                            className={cn(
                              "px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-widest",
                              isAdmin 
                                ? "bg-brand-primary text-white hover:bg-brand-secondary cursor-pointer" 
                                : "bg-slate-200 text-slate-400 cursor-not-allowed"
                            )}
                            onClick={async () => {
                              if (!isAdmin) return;
                              try {
                                await updateDoc(doc(db, 'internal_contracts', contract.id), { status: 'Ativo' });
                              } catch(e) { console.error(e); }
                            }}
                          >
                            ATIVAR
                          </button>
                        ) : (
                          <div className={`px-1.5 py-0.5 rounded text-[7px] font-black uppercase tracking-widest ${
                            contract.status === 'Ativo' ? 'bg-emerald-100 text-green-700' : 'bg-slate-100 text-slate-400'
                          }`}>
                            {contract.status}
                          </div>
                        )}
                        {isAdmin && (
                           <button 
                             onClick={() => deleteContract(contract.id)}
                             className="p-1 px-1 border border-red-50 bg-red-50 text-red-500 rounded-lg hover:bg-red-500 hover:text-white transition-all group/del"
                             title="Eliminar Contrato Permanentemente"
                           >
                             <Trash2 size={10} className="group-hover/del:scale-110" />
                           </button>
                         )}
                       </div>
                       <div className="text-[7px] font-black text-slate-300 uppercase italic leading-none text-right">
                         TaxiControl Fleet
                       </div>
                    </div>
                   </div>
                 </motion.div>
               ))}
             </div>
           )}
        </div>
      </div>

      {/* Modal de Cadastro */}
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
               className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                 <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase italic tracking-tight">Novo Contrato de Passageiro</h3>
                    <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Registar rota fixa no TaxiControl</p>
                 </div>
                 <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors bg-white p-1 rounded-md border border-slate-200">
                    <X size={18} />
                 </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome do Cliente</label>
                  <input 
                    required
                    type="text" 
                    value={formData.clientName}
                    onChange={(e) => setFormData({...formData, clientName: e.target.value})}
                    placeholder="Ex: João Baptista"
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:bg-white focus:border-brand-primary outline-none transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Local / Bairro</label>
                      <input 
                        required
                        type="text" 
                        value={formData.neighborhood}
                        onChange={(e) => setFormData({...formData, neighborhood: e.target.value})}
                        placeholder="Ex: Benfica"
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:bg-white focus:border-brand-primary outline-none transition-all"
                      />
                   </div>
                   <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Telefone</label>
                      <input 
                        required
                        type="tel" 
                        value={formData.phone}
                        onChange={(e) => setFormData({...formData, phone: e.target.value})}
                        placeholder="+244 9..."
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:bg-white focus:border-brand-primary outline-none transition-all"
                      />
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Destino Principal</label>
                      <select 
                        required 
                        value={formData.destination}
                        onChange={(e) => setFormData({...formData, destination: e.target.value})}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:bg-white focus:border-brand-primary outline-none appearance-none cursor-pointer"
                      >
                         <option value="Trabalho">Trabalho</option>
                         <option value="Escola">Escola</option>
                      </select>
                   </div>
                   <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Período / Turno</label>
                      <select 
                        required 
                        value={formData.period}
                        onChange={(e) => setFormData({...formData, period: e.target.value})}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:bg-white focus:border-brand-primary outline-none appearance-none cursor-pointer"
                      >
                         <option value="Manhã">Manhã</option>
                         <option value="Tarde">Tarde</option>
                         <option value="Noite">Noite</option>
                      </select>
                   </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Dias da Semana</label>
                  <div className="flex flex-wrap gap-2 pt-1">
                    {DAYS_OF_WEEK.map(day => (
                      <button
                        key={day}
                        type="button"
                        onClick={() => toggleDay(day)}
                        className={cn(
                          "px-3 py-1.5 rounded-lg text-[10px] font-black uppercase transition-all border",
                          formData.weeklyDays.includes(day)
                            ? "bg-brand-primary text-white border-brand-primary shadow-md shadow-brand-primary/20"
                            : "bg-slate-50 text-slate-400 border-slate-200 hover:border-slate-300"
                        )}
                      >
                        {day}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Valor Mensal (Kz)</label>
                      <input 
                        required
                        type="number" 
                        value={formData.monthlyValue}
                        onChange={(e) => setFormData({...formData, monthlyValue: e.target.value})}
                        placeholder="Ex: 45000"
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:bg-white focus:border-brand-primary outline-none transition-all"
                      />
                   </div>
                   <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nº Ocupantes</label>
                      <input 
                        required
                        type="number" 
                        min={1}
                        value={formData.occupants}
                        onChange={(e) => setFormData({...formData, occupants: parseInt(e.target.value) || 1})}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:bg-white focus:border-brand-primary outline-none transition-all"
                      />
                   </div>
                   <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Estado de Pagamento</label>
                      <select 
                        required 
                        value={formData.paymentStatus}
                        onChange={(e) => setFormData({...formData, paymentStatus: e.target.value})}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:bg-white focus:border-brand-primary outline-none appearance-none cursor-pointer"
                      >
                         <option value="Pendente">Aguardando Pagamento</option>
                         <option value="Pago">Confirmado / Pago</option>
                      </select>
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Viatura Entrada</label>
                      <select 
                        required 
                        value={formData.entryVehicleId}
                        onChange={(e) => setFormData({...formData, entryVehicleId: e.target.value})}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:bg-white focus:border-brand-primary outline-none appearance-none cursor-pointer"
                      >
                         <option value="">Selecione...</option>
                         {vehicles.map(v => (
                           <option key={v.id} value={`${v.prefix} - ${v.plate}`}>
                             {v.prefix} | {v.plate}
                           </option>
                         ))}
                      </select>
                   </div>
                   <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Hora Entrada</label>
                      <input 
                        required
                        type="time" 
                        value={formData.entryTime}
                        onChange={(e) => setFormData({...formData, entryTime: e.target.value})}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:bg-white focus:border-brand-primary outline-none transition-all"
                      />
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Viatura Saída</label>
                      <select 
                        required 
                        value={formData.exitVehicleId}
                        onChange={(e) => setFormData({...formData, exitVehicleId: e.target.value})}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:bg-white focus:border-brand-primary outline-none appearance-none cursor-pointer"
                      >
                         <option value="">Selecione...</option>
                         {vehicles.map(v => (
                           <option key={v.id} value={`${v.prefix} - ${v.plate}`}>
                             {v.prefix} | {v.plate}
                           </option>
                         ))}
                      </select>
                   </div>
                   <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Hora Saída</label>
                      <input 
                        required
                        type="time" 
                        value={formData.exitTime}
                        onChange={(e) => setFormData({...formData, exitTime: e.target.value})}
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:bg-white focus:border-brand-primary outline-none transition-all"
                      />
                   </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Observações (Opcional)</label>
                  <textarea 
                    value={formData.notes}
                    onChange={(e) => setFormData({...formData, notes: e.target.value})}
                    rows={3}
                    placeholder="Ex: Horários específicos, ponto de encontro..."
                    className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:bg-white focus:border-brand-primary outline-none transition-all resize-none"
                  />
                </div>

                <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full bg-brand-primary text-white py-4 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-brand-secondary transition-all shadow-lg shadow-brand-primary/20 flex items-center justify-center gap-2"
                >
                  {loading ? <Loader2 className="animate-spin" size={18} /> : <FileText size={18} />}
                  CRIAR CONTRATO DE PASSAGEIRO
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
