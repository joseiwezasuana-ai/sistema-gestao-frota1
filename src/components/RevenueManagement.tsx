import React, { useState, useEffect } from 'react';
import { 
  Wallet, 
  DollarSign, 
  Calendar, 
  CheckCircle2, 
  Clock, 
  XCircle, 
  ArrowUpRight, 
  Search, 
  Filter, 
  MoreVertical,
  TrendingUp,
  User,
  Truck,
  CreditCard,
  Banknote,
  ArrowRightLeft,
  ArrowDownCircle,
  Info,
  ShieldCheck,
  Download,
  FileText,
  Loader2,
  Printer
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { InvoiceViewerModal } from './InvoiceViewerModal';
import autoTable from 'jspdf-autotable';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, where, addDoc, getDocs, deleteDoc } from 'firebase/firestore';
import { cn } from '../lib/utils';

interface RevenueLog {
  id: string;
  driverId: string;
  driverName: string;
  prefix: string;
  amount: number;
  date: string;
  status: 'vended_by_driver' | 'approved_by_operator' | 'approved_by_accountant' | 'finalized' | 'rejected_by_operator' | 'rejected_by_accountant';
  rejectionReason?: string;
  breakdown: {
    tpa: number;
    cash: number;
    transfer: number;
    expenses: number;
  };
  timestamp: any;
  validatedAt?: string;
  validatedBy?: string;
  validatedByName?: string;
}

export default function RevenueManagement({ user }: { user: any }) {
  const [revenues, setRevenues] = useState<RevenueLog[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');
  const [selectedDriver, setSelectedDriver] = useState('all');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isHistoryModalOpen, setIsHistoryModalOpen] = useState(false);
  const [archivedRevenues, setArchivedRevenues] = useState<RevenueLog[]>([]);

  const isAdmin = user?.role === 'admin' || user?.email === 'joseiwezasuana@gmail.com';
  const isContabilista = user?.role === 'contabilista';
  const isOperator = user?.role === 'operator' || isAdmin;
  const isContabRole = isContabilista || isAdmin;

  useEffect(() => {
    // Fetch Revenues
    const q = query(collection(db, 'revenue_logs'), orderBy('timestamp', 'desc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      let data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RevenueLog));
      
      // Accountant restriction: Only see revenues ready for their stage or finalized/paid
      if (isContabilista && !isAdmin) {
        data = data.filter(r => ['approved_by_operator', 'approved_by_accountant', 'finalized', 'paid_to_staff'].includes(r.status));
      }
      
      setRevenues(data);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'revenue_logs');
    });

    // Fetch Drivers for Filter
    const qDrivers = query(collection(db, 'drivers_master'), orderBy('name', 'asc'));
    const unsubscribeDrivers = onSnapshot(qDrivers, (snapshot) => {
      setDrivers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'drivers_master');
    });

    return () => {
      unsubscribe();
      unsubscribeDrivers();
    };
  }, [isContabilista, isAdmin]);

  useEffect(() => {
    if (isHistoryModalOpen) {
      const q = query(
        collection(db, 'revenue_logs'), 
        where('status', '==', 'archived'),
        orderBy('timestamp', 'desc')
      );
      const unsubscribe = onSnapshot(q, (snapshot) => {
        setArchivedRevenues(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as RevenueLog)));
      }, (error) => {
        handleFirestoreError(error, OperationType.GET, 'revenue_logs (archived)');
      });
      return () => unsubscribe();
    }
  }, [isHistoryModalOpen]);

  const handleStatusChange = async (revenueId: string, newStatus: string, reason?: string) => {
    try {
      const revenue = revenues.find(r => r.id === revenueId);
      if (!revenue) return;

      const revRef = doc(db, 'revenue_logs', revenueId);
      const updateData: any = { 
        status: newStatus,
        validatedAt: new Date().toISOString(),
        validatedBy: user.uid,
        validatedByName: user.name
      };

      if (reason) {
        updateData.rejectionReason = reason;
      } else {
        updateData.rejectionReason = ""; // Clear reason if approving
      }

      await updateDoc(revRef, updateData);

      // 1. Unbind driver if approved by operator (or finalized)
      if (newStatus === 'approved_by_operator' || newStatus === 'finalized') {
        const q = query(collection(db, 'drivers'), where('driverId', '==', revenue.driverId));
        const snap = await getDocs(q);
        if (!snap.empty) {
          for (const d of snap.docs) {
            await deleteDoc(doc(db, 'drivers', d.id));
          }
        } else {
          // Fallback to name if driverId wasn't stored (for older records)
          const qByName = query(collection(db, 'drivers'), where('name', '==', revenue.driverName));
          const snapByName = await getDocs(qByName);
          for (const d of snapByName.docs) {
            await deleteDoc(doc(db, 'drivers', d.id));
          }
        }

        // Notify driver of approval
        await addDoc(collection(db, 'messages'), {
          type: 'success',
          category: 'revenue_approval',
          title: 'Renda Aprovada',
          content: `A sua renda do dia ${revenue.date} foi validada com sucesso pelo operador. Obrigado!`,
          targets: [revenue.driverId],
          driverId: revenue.driverId,
          prefix: revenue.prefix,
          status: 'unread',
          timestamp: new Date().toISOString()
        });
      }

      // 2. Notify driver if rejected
      if (newStatus.includes('rejected')) {
        await addDoc(collection(db, 'messages'), {
          type: 'alert',
          category: 'revenue_rejection',
          title: 'Renda Reprovada',
          content: `A sua renda do dia ${revenue.date} foi reprovada. Motivo: ${reason || 'Não especificado'}. Por favor, verifique e corrija os dados.`,
          targets: [revenue.driverId],
          driverId: revenue.driverId,
          prefix: revenue.prefix,
          status: 'unread',
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `revenue_logs/${revenueId}`);
    }
  };

  const handleReject = async (revenueId: string, currentStatus: string) => {
    const reason = window.prompt("Porquê está a reprovar esta renda? (Opcional)");
    if (reason === null) return; // Cancelled prompt
    
    const nextStatus = currentStatus === 'vended_by_driver' ? 'rejected_by_operator' : 'rejected_by_accountant';
    handleStatusChange(revenueId, nextStatus, reason);
  };

  const handleResetCycle = async () => {
    if (!isAdmin) return;
    if (!confirm('Deseja zerar o ciclo atual? Todos os registos ativos (pendentes e finalizados) serão movidos para o histórico (archived).')) return;
    
    setIsProcessing(true);
    try {
      // Archive everything that isn't already archived
      const toArchive = revenues.filter(r => r.status !== 'archived');
      for (const rev of toArchive) {
        await updateDoc(doc(db, 'revenue_logs', rev.id), { status: 'archived' });
      }
      alert('Ciclo reiniciado com sucesso! Registos arquivados.');
    } catch (error) {
      console.error(error);
      alert('Erro ao reiniciar ciclo.');
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusDisplay = (status: string) => {
    switch (status) {
      case 'vended_by_driver': return { label: 'Pendente Operador', color: 'bg-amber-50 text-amber-600 border-amber-100', icon: Clock };
      case 'rejected_by_operator': return { label: 'Reprovado Operador', color: 'bg-red-50 text-red-600 border-red-100', icon: XCircle };
      case 'rejected_by_accountant': return { label: 'Reprovado Contab.', color: 'bg-red-50 text-red-600 border-red-100', icon: XCircle };
      case 'approved_by_operator': return { label: 'Pendente Contab.', color: 'bg-blue-50 text-blue-600 border-blue-100', icon: Clock };
      case 'approved_by_accountant': return { label: 'Em Análise Admin', color: 'bg-purple-50 text-purple-600 border-purple-100', icon: Search };
      case 'finalized': return { label: 'Finalizado', color: 'bg-emerald-50 text-emerald-600 border-emerald-100', icon: CheckCircle2 };
      case 'paid_to_staff': return { label: 'Pago (Histórico)', color: 'bg-slate-200 text-slate-500 border-slate-300', icon: ShieldCheck };
      default: return { label: status, color: 'bg-slate-50 text-slate-500', icon: Clock };
    }
  };

  const filteredRevenues = revenues.filter(rev => {
    const today = new Date().toISOString().split('T')[0];
    
    if (filter === 'all') {
      // Hide paid logs and finalized logs from previous days
      if (rev.status === 'paid_to_staff') return false;
      if (rev.status === 'finalized' && rev.date < today) return false;
    } else if (filter !== 'all' && rev.status !== filter) {
      return false;
    }
    
    const driverMatch = selectedDriver === 'all' || rev.driverId === selectedDriver || rev.driverName === selectedDriver;
    return driverMatch;
  });

  const canApproveOperator = (status: string) => isOperator && status === 'vended_by_driver';
  const canApproveAccountant = (status: string) => isContabRole && status === 'approved_by_operator';
  const canApproveFinal = (status: string) => isAdmin && status === 'approved_by_accountant';

  const stats = {
    totalFinalized: revenues
      .filter(r => (r.status === 'finalized' || r.status === 'paid_to_staff'))
      .reduce((acc, curr) => acc + (curr.amount || 0), 0),
    totalProcess: revenues
      .filter(r => !['finalized', 'paid_to_staff'].includes(r.status))
      .reduce((acc, curr) => acc + (curr.amount || 0), 0),
    totalExpenses: revenues
      .reduce((acc, curr) => acc + (curr.breakdown?.expenses || 0), 0),
    todayCount: revenues.filter(r => r.date === new Date().toISOString().split('T')[0]).length
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    const today = new Date().toLocaleDateString();
    
    doc.setFontSize(18);
    doc.text('PSM COMERCIAL LUENA MOXICO', 105, 15, { align: 'center' });
    doc.setFontSize(14);
    doc.text('Mapa de Validação de Receitas', 105, 25, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Data do Relatório: ${today}`, 105, 32, { align: 'center' });

    const tableData = filteredRevenues.map(rev => [
      rev.driverName,
      rev.prefix,
      rev.date,
      `${(rev.amount || 0).toLocaleString()} Kz`,
      getStatusDisplay(rev.status).label
    ]);

    autoTable(doc, {
      startY: 40,
      head: [['Colaborador', 'Viatura', 'Data', 'Saldo Líquido', 'Estado']],
      body: tableData,
    });

    doc.save(`receitas_psm_${Date.now()}.pdf`);
  };

  return (
    <div className="max-w-[1500px] mx-auto space-y-8 pb-20">
      <div className="bg-white px-10 py-10 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden flex flex-col lg:flex-row lg:items-center justify-between gap-8 group">
          <div className="absolute top-0 right-0 w-[40%] h-full bg-slate-50 border-l border-slate-100 -mr-20 rotate-12 -z-0 opacity-50 group-hover:rotate-6 transition-transform duration-1000" />
          
          <div className="relative z-10 flex items-center gap-8">
            <div className="w-20 h-20 bg-emerald-600 rounded-[2.5rem] flex items-center justify-center text-white shadow-2xl shadow-emerald-600/20 rotate-3 group-hover:rotate-0 transition-all duration-500">
               <Wallet size={40} />
            </div>
            <div>
              <h2 className="font-black text-4xl text-slate-900 tracking-tighter uppercase italic">
                Validação de Fluxos
              </h2>
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.4em] mt-2 flex items-center gap-3">
                <span className="w-2 h-2 bg-emerald-500 rounded-full" />
                CONCILIAÇÃO FINANCEIRA • PSM CORPORATE
              </p>
            </div>
          </div>

          <div className="relative z-10 flex items-center gap-10">
             <div className="text-right">
                <div className="flex items-center gap-2 justify-end mb-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Estado da Tesouraria</span>
                  <div className="w-1.5 h-1.5 bg-brand-primary rounded-full animate-pulse shadow-[0_0_8px_rgba(37,99,235,0.8)]" />
                </div>
                <p className="text-xl font-black text-slate-900 tracking-tight uppercase italic">
                  Fluxo Contínuo
                </p>
             </div>
             
             <div className="h-14 w-px bg-slate-200" />
             
             <div className="text-right">
                <div className="flex items-center gap-2 justify-end mb-1">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nível de Auditoria</span>
                  <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_8px_rgba(16,185,129,0.8)]" />
                </div>
                <p className="text-xl font-black text-slate-900 tracking-tight uppercase italic text-emerald-600">
                  Total
                </p>
             </div>
          </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        {[
            { label: 'Cofre Finalizado (Mês)', value: (stats.totalFinalized || 0).toLocaleString() + ' Kz', color: 'text-emerald-600', border: 'border-emerald-500', icon: ShieldCheck },
            { label: 'Processando (Mês)', value: (stats.totalProcess || 0).toLocaleString() + ' Kz', color: 'text-amber-500', border: 'border-amber-500', icon: Clock },
            { label: 'Despesas (Mês)', value: (stats.totalExpenses || 0).toLocaleString() + ' Kz', color: 'text-rose-600', border: 'border-rose-500', icon: ArrowDownCircle },
          { label: 'Registos Hoje', value: stats.todayCount.toString(), color: 'text-brand-primary', border: 'border-brand-primary', icon: TrendingUp },
        ].map((s, idx) => (
          <motion.div 
            key={idx}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.1 }}
            className={cn("bg-white p-7 rounded-[2rem] border border-slate-200 shadow-sm relative overflow-hidden transition-all group hover:shadow-xl", s.border.replace('border-', 'hover:border-'))}
          >
            <div className="flex justify-between items-start mb-6">
               <div className="w-10 h-10 bg-slate-50 rounded-xl flex items-center justify-center text-slate-400 group-hover:text-current transition-colors">
                 <s.icon size={20} />
               </div>
               <span className="text-[9px] font-black text-slate-300 uppercase tracking-widest">Live Sync</span>
            </div>
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-2">{s.label}</p>
            <p className={cn("text-3xl font-black tracking-tighter", s.color)}>{s.value}</p>
          </motion.div>
        ))}
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden group">
        <div className="px-10 py-8 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between bg-slate-50/50 gap-6">
          <div className="flex items-center gap-6">
             <div className="p-3 bg-white border border-slate-200 rounded-xl">
               <Filter size={18} className="text-slate-400" />
             </div>
             <div className="flex gap-2 p-1.5 bg-white border border-slate-200 rounded-2xl">
                {['all', 'vended_by_driver', 'approved_by_operator', 'approved_by_accountant', 'finalized', 'rejected_by_operator', 'rejected_by_accountant', 'paid_to_staff'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={cn(
                      "px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
                      filter === f ? "bg-slate-900 text-white shadow-lg" : "text-slate-400 hover:text-slate-900 hover:bg-slate-50"
                    )}
                  >
                    {f === 'all' ? 'Ativos' : f === 'paid_to_staff' ? 'Histórico' : f.includes('rejected') ? 'Reprovado' : f.split('_')[0]}
                  </button>
                ))}
             </div>
             <button 
                onClick={exportPDF}
                className="px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all flex items-center gap-2 shadow-xl shadow-black/10"
              >
                <Download size={16} /> PDF
              </button>
              {isAdmin && (
                <button 
                  onClick={handleResetCycle}
                  disabled={isProcessing}
                  className="px-4 py-3 bg-rose-50 text-rose-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-rose-100 transition-all flex items-center gap-2 border border-rose-100 italic"
                >
                  {isProcessing ? <Clock className="animate-spin" size={14} /> : <XCircle size={14} />}
                  Zerar Ciclo
                </button>
              )}
              
              <button 
                onClick={() => setIsHistoryModalOpen(true)}
                className="px-4 py-3 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all flex items-center gap-2 border border-slate-200 hover:text-slate-900 group/hist"
              >
                <Clock size={16} className="group-hover/hist:rotate-[-45deg] transition-transform" /> 
                Ver Histórico
              </button>
          </div>
          <div className="flex items-center gap-4 bg-white border border-slate-200 px-6 py-3 rounded-[1.25rem] shadow-sm">
             <User size={16} className="text-brand-primary" />
             <select 
               value={selectedDriver}
               onChange={(e) => setSelectedDriver(e.target.value)}
               className="bg-transparent border-none text-[10px] font-black text-slate-900 outline-none uppercase tracking-widest cursor-pointer"
             >
               <option value="all">Filtro por Colaborador</option>
               {drivers.map(d => <option key={d.id} value={d.name}>{d.name}</option>)}
             </select>
          </div>
        </div>

        <div className="overflow-x-auto min-h-[400px]">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-white text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                <th className="px-10 py-5">Colaborador / Viatura</th>
                <th className="px-10 py-5">Análise de Receitas & Custos</th>
                <th className="px-10 py-5">Saldo Líquido</th>
                <th className="px-10 py-5 text-center">Protocolo de Aprovação</th>
                <th className="px-10 py-5 text-right">Acções Operacionais</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredRevenues.map((rev) => {
                const { label, color, icon: StatusIcon } = getStatusDisplay(rev.status);
                return (
                  <tr key={rev.id} className="hover:bg-slate-50 transition-colors group/row">
                    <td className="px-10 py-6">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-400 font-bold group-hover/row:bg-brand-primary group-hover/row:text-white transition-all">
                           {rev.driverName[0]}
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-900 uppercase tracking-tight">{rev.driverName}</p>
                          <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-0.5">{rev.prefix} • <span className="italic">{rev.date}</span></p>
                        </div>
                      </div>
                    </td>
                    <td className="px-10 py-6">
                      <div className="grid grid-cols-2 gap-x-8 gap-y-1.5 min-w-[200px]">
                         <div className="flex items-center justify-between">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">TPA:</span>
                            <span className="text-[11px] font-bold text-slate-700">{(rev.breakdown?.tpa || 0).toLocaleString()} Kz</span>
                         </div>
                         <div className="flex items-center justify-between">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Dinheiro:</span>
                            <span className="text-[11px] font-bold text-slate-700">{(rev.breakdown?.cash || 0).toLocaleString()} Kz</span>
                         </div>
                         <div className="flex items-center justify-between">
                            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Transferência:</span>
                            <span className="text-[11px] font-bold text-slate-700">{(rev.breakdown?.transfer || 0).toLocaleString()} Kz</span>
                         </div>
                         {rev.breakdown?.expenses > 0 && (
                           <div className="flex items-center justify-between border-t border-slate-50 pt-1.5 mt-1 col-span-2">
                             <span className="text-[9px] font-black text-rose-500 uppercase tracking-widest">Saídas / Despesas:</span>
                             <span className="text-[11px] font-black text-rose-600">-{rev.breakdown.expenses.toLocaleString()} Kz</span>
                           </div>
                         )}
                      </div>
                    </td>
                    <td className="px-10 py-6">
                       <p className="text-lg font-black text-emerald-700 tracking-tighter italic">
                         {(rev.amount || 0).toLocaleString()} <span className="text-[10px] uppercase font-bold opacity-60">Kz</span>
                       </p>
                    </td>
                    <td className="px-10 py-6 text-center">
                      <div className="flex flex-col items-center gap-1">
                        <span className={cn("inline-flex items-center gap-2 px-4 py-2 rounded-full text-[9px] font-black uppercase tracking-[0.1em] border transition-all", color)}>
                          <StatusIcon size={12} className={cn(status !== 'finalized' && status !== 'paid_to_staff' && "animate-pulse")} /> {label}
                        </span>
                        {rev.rejectionReason && (
                          <p className="text-[9px] text-red-500 font-bold max-w-[120px] truncate italic" title={rev.rejectionReason}>
                            Motivo: {rev.rejectionReason}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="px-10 py-6 text-right">
                      <div className="flex justify-end gap-3">
                        {canApproveOperator(rev.status) && (
                          <>
                            <button 
                              onClick={() => handleReject(rev.id, rev.status)}
                              className="px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider text-rose-600 bg-rose-50 border border-rose-100 hover:bg-rose-100 transition-all"
                            >
                              Reprovar
                            </button>
                            <button 
                              onClick={() => handleStatusChange(rev.id, 'approved_by_operator')}
                              className="bg-brand-primary text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-lg shadow-blue-600/20 active:scale-95 transition-all hover:bg-blue-700"
                            >
                              Aprovar Ok
                            </button>
                          </>
                        )}
                        {canApproveAccountant(rev.status) && (
                          <>
                            <button 
                              onClick={() => handleReject(rev.id, rev.status)}
                              className="px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider text-rose-600 bg-rose-50 border border-rose-100 hover:bg-rose-100 transition-all"
                            >
                              Reprovar
                            </button>
                            <button 
                              onClick={() => handleStatusChange(rev.id, 'approved_by_accountant')}
                              className="bg-amber-500 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-lg shadow-amber-500/20 active:scale-95 transition-all hover:bg-amber-600"
                            >
                              Validar Contab.
                            </button>
                          </>
                        )}
                        {canApproveFinal(rev.status) && (
                          <button 
                            onClick={() => handleStatusChange(rev.id, 'finalized')}
                            className="bg-emerald-600 text-white px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-wider shadow-lg shadow-emerald-500/20 active:scale-95 transition-all hover:bg-emerald-700"
                          >
                            Finalizar Admin
                          </button>
                        )}
                        {rev.status === 'finalized' && (
                          <div className="flex items-center gap-2">
                            <div className="w-10 h-10 bg-emerald-50 rounded-xl flex items-center justify-center text-emerald-600 border border-emerald-100 italic font-black shadow-inner">
                              <CheckCircle2 size={24} />
                            </div>
                          </div>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
      {/* Archived Records Modal */}
      <AnimatePresence>
        {isHistoryModalOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsHistoryModalOpen(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-6xl overflow-hidden flex flex-col h-[85vh]"
            >
              <div className="px-10 py-8 bg-slate-900 text-white flex items-center justify-between shrink-0">
                <div className="flex items-center gap-6">
                  <div className="w-14 h-14 bg-white/10 rounded-2xl flex items-center justify-center">
                    <Clock size={28} />
                  </div>
                  <div>
                    <h3 className="text-2xl font-black uppercase italic tracking-tight">Arquivo Histórico de Rendas</h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Registos de Ciclos Encerrados & Auditados</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsHistoryModalOpen(false)}
                  className="w-12 h-12 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors"
                >
                  <XCircle size={32} />
                </button>
              </div>

              <div className="flex-1 overflow-auto p-10 custom-scrollbar">
                {archivedRevenues.length === 0 ? (
                  <div className="h-full flex flex-col items-center justify-center text-center space-y-4 py-20 grayscale opacity-40">
                    <Clock size={64} className="text-slate-300" />
                    <p className="text-sm font-black text-slate-500 uppercase tracking-widest italic">Nenhum registo arquivado encontrado</p>
                  </div>
                ) : (
                  <table className="w-full text-left border-collapse">
                    <thead>
                      <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-200">
                        <th className="px-8 py-5">Colaborador / Viatura</th>
                        <th className="px-8 py-5">Registos & Breakdown</th>
                        <th className="px-8 py-5">Líquido PSM</th>
                        <th className="px-8 py-5">Data Fecho</th>
                        <th className="px-8 py-5 text-right">Acções</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {archivedRevenues.map((rev) => (
                        <tr key={rev.id} className="hover:bg-slate-50 transition-colors group/arch">
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-3">
                              <div className="w-8 h-8 bg-slate-100 rounded-lg flex items-center justify-center text-[10px] font-black text-slate-400 uppercase">
                                {rev.driverName[0]}
                              </div>
                              <div>
                                <p className="text-xs font-black text-slate-900 uppercase tracking-tight">{rev.driverName}</p>
                                <p className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">{rev.prefix}</p>
                              </div>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex flex-wrap gap-x-4 gap-y-1 text-[9px] font-bold text-slate-500 uppercase tracking-tight">
                              <span>TPA: {(rev.breakdown?.tpa || 0).toLocaleString()} Kz</span>
                              <span>Din: {(rev.breakdown?.cash || 0).toLocaleString()} Kz</span>
                              <span>Trans: {(rev.breakdown?.transfer || 0).toLocaleString()} Kz</span>
                              <span className="text-rose-500 italic">Desp: {(rev.breakdown?.expenses || 0).toLocaleString()} Kz</span>
                            </div>
                          </td>
                          <td className="px-8 py-6">
                            <span className="text-sm font-black text-emerald-700 italic">{(rev.amount || 0).toLocaleString()} Kz</span>
                          </td>
                          <td className="px-8 py-6">
                            <div className="flex items-center gap-2 text-slate-400">
                               <Calendar size={12} />
                               <span className="text-[10px] font-black uppercase tracking-tight">{rev.date}</span>
                            </div>
                          </td>
                          <td className="px-8 py-6 text-right">
                             <div className="flex items-center justify-end gap-2 text-[10px] font-black text-slate-400 uppercase italic">
                                <CheckCircle2 size={14} className="text-emerald-500" />
                                Arquivado
                             </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                )}
              </div>
              
              <div className="px-10 py-6 bg-slate-50 border-t border-slate-200 flex justify-between items-center shrink-0">
                <div className="flex gap-10">
                   <div className="flex flex-col">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Arquivado Bruto</span>
                      <span className="text-lg font-black text-slate-900 italic tracking-tighter">
                         {archivedRevenues.reduce((acc, curr) => acc + (curr.breakdown?.tpa || 0) + (curr.breakdown?.cash || 0) + (curr.breakdown?.transfer || 0), 0).toLocaleString()} Kz
                      </span>
                   </div>
                   <div className="flex flex-col">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Despesas Arquivadas</span>
                      <span className="text-lg font-black text-rose-600 italic tracking-tighter">
                         {archivedRevenues.reduce((acc, curr) => acc + (curr.breakdown?.expenses || 0), 0).toLocaleString()} Kz
                      </span>
                   </div>
                </div>
                <button 
                  onClick={() => setIsHistoryModalOpen(false)}
                  className="px-10 py-3 bg-slate-900 text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-black/20"
                >
                  Fechar Arquivo
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
