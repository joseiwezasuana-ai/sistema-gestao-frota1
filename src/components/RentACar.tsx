import React, { useState, useEffect } from 'react';
import { 
  CarFront, 
  KeyRound, 
  CalendarCheck, 
  FileSignature, 
  UserCircle2,
  Phone,
  Clock,
  ShieldCheck,
  PlusCircle,
  Search,
  DollarSign,
  ChevronRight,
  Printer,
  FileText,
  Loader2,
  X
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { addDoc, collection, onSnapshot, query, orderBy, deleteDoc, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { cn } from '../lib/utils';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';
import { InvoiceViewerModal } from './InvoiceViewerModal';

export default function RentACar({ user }: { user?: any }) {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPrinting, setIsPrinting] = useState<string | null>(null);
  const [contracts, setContracts] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [selectedRental, setSelectedRental] = useState<any | null>(null);
  const [isInvoiceViewerOpen, setIsInvoiceViewerOpen] = useState(false);

  const [newContract, setNewContract] = useState({
    client: '',
    vehicle: '',
    startDate: '',
    endDate: '',
    dailyPrice: 15000,
    phone: '',
    neighborhood: ''
  });

  const isAdmin = user?.role === 'admin';
  const canManage = isAdmin || user?.role === 'operator';

  useEffect(() => {
    const q = query(collection(db, 'rac_contracts'), orderBy('createdAt', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setContracts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'rac_contracts'));

    const qVehicles = query(collection(db, 'master_vehicles'), orderBy('prefix', 'asc'));
    const unsubVehicles = onSnapshot(qVehicles, (snapshot) => {
      setVehicles(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'master_vehicles'));

    return () => {
      unsub();
      unsubVehicles();
    };
  }, []);

  const handleAddContract = async (e: React.FormEvent) => {
    if (!canManage) {
      alert("Acesso negado: Apenas administradores e operadores podem emitir contratos.");
      return;
    }
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const contractRef = await addDoc(collection(db, 'rac_contracts'), {
        ...newContract,
        status: 'active',
        createdAt: new Date().toISOString()
      });

      // Sincronização Automática com o Faturamente (revenue_logs)
      // Calcular dias para estimativa (simplificado)
      const start = new Date(newContract.startDate).getTime();
      const end = new Date(newContract.endDate).getTime();
      const days = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
      const totalAmount = newContract.dailyPrice * days;

      await addDoc(collection(db, 'revenue_logs'), {
        amount: totalAmount,
        category: 'Aluguer',
        type: 'rent_a_car',
        contractId: contractRef.id,
        driverName: newContract.client,
        vehiclePrefix: newContract.vehicle,
        status: 'finalized',
        timestamp: new Date().toISOString(),
        description: `Contrato de Aluguer PSM - ${newContract.client}`
      });

      setIsModalOpen(false);
      setNewContract({ client: '', vehicle: '', startDate: '', endDate: '', dailyPrice: 15000, phone: '', neighborhood: '' });
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleToggleStatus = async (contractId: string, currentStatus: string) => {
    if (!isAdmin) return;
    try {
      await updateDoc(doc(db, 'rac_contracts', contractId), {
        status: currentStatus === 'active' ? 'returned' : 'active'
      });
    } catch (err) {
      console.error(err);
    }
  };

  const openInvoiceViewer = (rental: any) => {
    setSelectedRental(rental);
    setIsInvoiceViewerOpen(true);
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div className="flex items-center justify-between bg-white px-6 py-6 rounded-2xl border border-slate-200 shadow-sm relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/10 rounded-full -mr-32 -mt-32 blur-3xl" />
        <div className="relative">
          <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase italic">Serviço Rent-a-Car PSM</h2>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-1">Aluguer de Viaturas & Serviços Privados ao Público</p>
        </div>
        <button 
          onClick={() => setIsModalOpen(true)}
          className="relative flex items-center gap-2 px-6 py-3 bg-slate-900 text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-slate-800 transition-all shadow-xl shadow-slate-900/20"
        >
          <PlusCircle size={18} />
          Novo Contrato de Aluguer
        </button>
      </div>

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
               initial={{ opacity: 0, scale: 0.95 }}
               animate={{ opacity: 1, scale: 1 }}
               exit={{ opacity: 0, scale: 0.95 }}
               className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden"
             >
                <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                  <h3 className="font-black text-slate-900 uppercase italic">Formulário de Aluguer</h3>
                  <button onClick={() => setIsModalOpen(false)}><X size={20} className="text-slate-400" /></button>
                </div>
                <form onSubmit={handleAddContract} className="p-8 space-y-4">
                   <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Nome do Cliente</label>
                      <input 
                        required
                        type="text" 
                        value={newContract.client}
                        onChange={(e) => setNewContract({...newContract, client: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold outline-none focus:border-brand-primary"
                      />
                   </div>
                   <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Viatura de Aluguer</label>
                      <select 
                        required
                        value={newContract.vehicle}
                        onChange={(e) => setNewContract({...newContract, vehicle: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold outline-none focus:border-brand-primary"
                      >
                         <option value="">Selecionar Viatura...</option>
                         {vehicles.map(v => (
                           <option key={v.id} value={`${v.brand || 'Viatura'} (${v.prefix}) - ${v.plate}`}>
                             {v.brand || 'Viatura'} - Ref: {v.prefix} ({v.plate})
                           </option>
                         ))}
                      </select>
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Data de Início</label>
                        <input 
                          required
                          type="date"
                          value={newContract.startDate}
                          onChange={(e) => setNewContract({...newContract, startDate: e.target.value})}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold outline-none focus:border-brand-primary"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Data de Fim</label>
                        <input 
                          required
                          type="date"
                          value={newContract.endDate}
                          onChange={(e) => setNewContract({...newContract, endDate: e.target.value})}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold outline-none focus:border-brand-primary"
                        />
                      </div>
                   </div>
                   <div className="grid grid-cols-2 gap-4">
                      <div>
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Telefone Cliente</label>
                         <input 
                           type="text" 
                           value={newContract.phone}
                           placeholder="+244"
                           onChange={(e) => setNewContract({...newContract, phone: e.target.value})}
                           className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold outline-none focus:border-brand-primary"
                         />
                      </div>
                      <div>
                         <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Bairro / Local</label>
                         <input 
                           type="text" 
                           value={newContract.neighborhood}
                           onChange={(e) => setNewContract({...newContract, neighborhood: e.target.value})}
                           className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold outline-none focus:border-brand-primary"
                         />
                      </div>
                   </div>
                   <div>
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 block">Preço Diário (Kz)</label>
                      <input 
                        required
                        type="number" 
                        value={newContract.dailyPrice}
                        onChange={(e) => setNewContract({...newContract, dailyPrice: Number(e.target.value)})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-[13px] font-bold outline-none focus:border-brand-primary"
                      />
                   </div>
                   <button 
                     type="submit"
                     disabled={isSubmitting}
                     className="w-full bg-slate-900 text-white py-4 rounded-xl font-black uppercase text-xs tracking-widest hover:bg-brand-primary transition-all shadow-xl shadow-slate-900/10 disabled:opacity-50"
                   >
                     {isSubmitting ? 'A PROCESSAR...' : 'EMITIR CONTRATO DE ALUGUER'}
                   </button>
                </form>
             </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
         <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-14 h-14 bg-brand-primary/10 text-brand-primary rounded-2xl flex items-center justify-center">
              <CarFront size={28} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Viaturas Disponíveis</p>
              <p className="text-2xl font-black text-slate-900 leading-none mt-1 uppercase italic">{vehicles.length} Unidades</p>
            </div>
         </div>
         <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center">
              <FileSignature size={28} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Contratos Ativos</p>
              <p className="text-2xl font-black text-slate-900 leading-none mt-1 uppercase italic">{contracts.filter(c => c.status === 'active').length} Vigentes</p>
            </div>
         </div>
         <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center gap-4">
            <div className="w-14 h-14 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
              <DollarSign size={28} />
            </div>
            <div>
              <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Receita Rent-a-Car (Mês)</p>
              <p className="text-2xl font-black text-slate-900 leading-none mt-1 uppercase italic">{contracts.reduce((acc, c) => acc + (c.dailyPrice || 0), 0).toLocaleString()} Kz</p>
            </div>
         </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
           <h3 className="text-sm font-black text-slate-900 uppercase italic tracking-tight">Gestão de Contratos Correntes</h3>
           <div className="relative">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
             <input type="text" placeholder="Procurar contrato ou cliente..." className="pl-9 pr-4 py-2 border border-slate-200 rounded-lg text-xs outline-none focus:border-brand-primary w-64" />
           </div>
        </div>

        <div className="p-0 overflow-x-auto">
           <table className="w-full text-left">
              <thead>
                <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                  <th className="px-6 py-4">Ref / Cliente</th>
                  <th className="px-6 py-4">Viatura Escolhida</th>
                  <th className="px-6 py-4">Período de Aluguer</th>
                  <th className="px-6 py-4">Valor Total Est.</th>
                  <th className="px-6 py-4">Status</th>
                  <th className="px-6 py-4 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {contracts.map((rental) => (
                  <tr key={rental.id} className="hover:bg-slate-50 transition-colors">
                     <td className="px-6 py-4">
                        <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-full bg-slate-100 text-slate-400 flex items-center justify-center">
                              <UserCircle2 size={18} />
                           </div>
                           <div>
                              <div className="text-xs font-black text-slate-900 uppercase italic tracking-tight">{rental.client}</div>
                              <div className="text-[9px] font-bold text-slate-400 tracking-widest text-xs opacity-50 uppercase">{rental.id?.slice(-8)}</div>
                           </div>
                        </div>
                     </td>
                     <td className="px-6 py-4">
                        <span className="text-[11px] font-black text-brand-primary uppercase italic">{rental.vehicle}</span>
                     </td>
                     <td className="px-6 py-4">
                        <div className="flex items-center gap-2 text-slate-500 font-bold text-[10px]">
                           <Clock size={12} />
                           {rental.startDate} <ChevronRight size={10} /> {rental.endDate}
                        </div>
                     </td>
                     <td className="px-6 py-4">
                        <div className="text-xs font-black text-slate-900">
                          {(() => {
                            const start = new Date(rental.startDate).getTime();
                            const end = new Date(rental.endDate).getTime();
                            const days = Math.max(1, Math.ceil((end - start) / (1000 * 60 * 60 * 24)));
                            return (rental.dailyPrice * days).toLocaleString();
                          })()} Kz
                        </div>
                        {isAdmin ? (
                          <div className="flex items-center gap-1 mt-1">
                            <input 
                              type="number"
                              defaultValue={rental.dailyPrice}
                              onBlur={async (e) => {
                                const val = Number(e.target.value);
                                if (val !== rental.dailyPrice) {
                                  try {
                                    await updateDoc(doc(db, 'rac_contracts', rental.id), { dailyPrice: val });
                                  } catch(err) { console.error(err); }
                                }
                              }}
                              className="w-20 bg-slate-100 px-1 py-0.5 rounded text-[9px] font-bold outline-none border border-transparent focus:border-brand-primary"
                            />
                            <span className="text-[9px] font-bold text-slate-400">/dia</span>
                          </div>
                        ) : (
                          <div className="text-[9px] font-bold text-slate-400 uppercase">{rental.dailyPrice?.toLocaleString()} / dia</div>
                        )}
                     </td>
                     <td className="px-6 py-4">
                        <span className={cn("px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-tight",
                          rental.status === 'active' ? 'bg-indigo-100 text-indigo-700' : 'bg-emerald-100 text-emerald-700'
                        )}>
                           {rental.status === 'active' ? 'Em Curso' : 'Devolvido'}
                        </span>
                     </td>
                      <td className="px-6 py-4 text-right">
                        <div className="flex items-center justify-end gap-3">
                           <button 
                             onClick={() => openInvoiceViewer(rental)}
                             className="flex items-center gap-2 px-3 py-1.5 bg-slate-100 text-slate-700 hover:bg-brand-primary hover:text-white transition-all rounded-xl text-[10px] font-black uppercase tracking-wider border border-slate-200 hover:border-brand-primary shadow-sm"
                             title="Visualizar e Emitir Factura"
                           >
                              <FileText size={14} />
                              Emitir Factura
                           </button>
                           <button 
                             onClick={() => handleToggleStatus(rental.id, rental.status)}
                             disabled={!canManage}
                             className={cn("p-2 transition-colors rounded-xl bg-slate-50 border border-transparent", 
                               canManage ? "text-slate-400 hover:text-brand-primary cursor-pointer hover:bg-white hover:border-slate-200" : "text-slate-100 cursor-not-allowed"
                             )}
                             title={rental.status === 'active' ? 'Marcar como Devolvido' : 'Reativar Contrato'}
                           >
                              <KeyRound size={18} />
                           </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
             </table>
          </div>
        </div>

        {/* Invoice Viewer Modal */}
        {isInvoiceViewerOpen && selectedRental && (
          <InvoiceViewerModal 
            isOpen={isInvoiceViewerOpen}
            onClose={() => setIsInvoiceViewerOpen(false)}
            data={selectedRental}
            documentNumber={`FR WT2025/${selectedRental.id?.slice(-4).toUpperCase()}`}
          />
        )}
      </div>
    );
  }
