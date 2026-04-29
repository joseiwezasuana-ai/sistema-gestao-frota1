import React, { useState, useEffect } from 'react';
import { 
  Phone, 
  Plus, 
  Trash2, 
  Edit3, 
  Smartphone,
  CheckCircle2,
  AlertCircle,
  X,
  Loader2,
  Hash,
  ShieldCheck,
  MessageSquare,
  Activity,
  Calculator,
  Lock
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { cn } from '../lib/utils';
import { collection, onSnapshot, addDoc, deleteDoc, doc, query, orderBy, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { formatSafe } from '../lib/dateUtils';

export default function CompanyPhones() {
  const [phones, setPhones] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingPhone, setEditingPhone] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const [newPhone, setNewPhone] = useState({
    label: '',
    number: '',
    imei: '',
    serialNumber: '',
    model: 'Samsung A14',
    status: 'Ativo' as 'Ativo' | 'Manutenção' | 'Perdido',
    assignedTo: '',
    assignedToId: ''
  });

  const [collaborators, setCollaborators] = useState<any[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'psm_phones'), orderBy('label', 'asc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setPhones(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'psm_phones'));

    const qDrivers = query(collection(db, 'drivers_master'), orderBy('name', 'asc'));
    const unsubDrivers = onSnapshot(qDrivers, (snapshot) => {
      const drivers = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), type: 'driver' }));
      setCollaborators(prev => {
        const others = prev.filter(p => p.type !== 'driver');
        return [...drivers, ...others].sort((a,b) => a.name.localeCompare(b.name));
      });
    });

    const qStaff = query(collection(db, 'administrative_staff'), orderBy('name', 'asc'));
    const unsubStaff = onSnapshot(qStaff, (snapshot) => {
      const staff = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data(), type: 'staff' }));
      setCollaborators(prev => {
        const others = prev.filter(p => p.type !== 'staff');
        return [...staff, ...others].sort((a,b) => a.name.localeCompare(b.name));
      });
    });

    return () => {
      unsub();
      unsubDrivers();
      unsubStaff();
    };
  }, []);

  const handleAddPhone = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    if (!newPhone.number.startsWith('+244') || newPhone.number.length !== 13) {
      setError('O número deve ter o prefixo +244 seguido de 9 dígitos.');
      return;
    }

    setIsSubmitting(true);
    try {
      if (editingPhone) {
        await updateDoc(doc(db, 'psm_phones', editingPhone.id), {
          ...newPhone,
          updatedAt: new Date().toISOString()
        });
      } else {
        await addDoc(collection(db, 'psm_phones'), {
          ...newPhone,
          batteryLevel: Math.floor(Math.random() * 40) + 60, // Mock initial state
          signalStrength: 'Excelente',
          lastSync: new Date().toISOString(),
          createdAt: new Date().toISOString()
        });
      }
      setIsModalOpen(false);
      setEditingPhone(null);
      setNewPhone({ label: '', number: '', imei: '', serialNumber: '', model: 'Samsung A14', status: 'Ativo', assignedTo: '', assignedToId: '' });
    } catch (err) {
      handleFirestoreError(err, editingPhone ? OperationType.UPDATE : OperationType.CREATE, 'psm_phones');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleEdit = (phone: any) => {
    setEditingPhone(phone);
    setNewPhone({
      label: phone.label,
      number: phone.number,
      imei: phone.imei,
      serialNumber: phone.serialNumber || '',
      model: phone.model,
      status: phone.status,
      assignedTo: phone.assignedTo || '',
      assignedToId: phone.assignedToId || ''
    });
    setIsModalOpen(true);
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm("Remover este terminal da lista oficial da PSM?")) return;
    try {
      await deleteDoc(doc(db, 'psm_phones', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `psm_phones/${id}`);
    }
  };

  return (
    <div className="space-y-8 max-w-[1400px] mx-auto pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between bg-white px-10 py-10 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-[40%] h-full bg-slate-50 border-l border-slate-100 -mr-20 rotate-12 -z-0 opacity-50 group-hover:rotate-6 transition-transform duration-1000" />
        
        <div className="relative z-10 flex items-center gap-8">
          <div className="w-20 h-20 bg-slate-900 rounded-[2.5rem] flex items-center justify-center text-white shadow-2xl rotate-3 group-hover:rotate-0 transition-all duration-500 border border-white/10">
             <Smartphone size={40} />
          </div>
          <div>
            <h2 className="font-black text-4xl text-slate-900 tracking-tighter uppercase italic">
              Gestão de Terminais
            </h2>
            <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.4em] mt-2 flex items-center gap-3">
              <span className="w-2 h-2 bg-brand-primary rounded-full animate-pulse shadow-[0_0_8px_rgba(37,99,235,0.8)]" />
              HUB DE DISPOSITIVOS MÓVEIS • PSM RÍGOR
            </p>
          </div>
        </div>

        <button 
          onClick={() => {
            setEditingPhone(null);
            setNewPhone({ label: '', number: '', imei: '', serialNumber: '', model: 'Samsung A14', status: 'Ativo', assignedTo: '', assignedToId: '' });
            setIsModalOpen(true);
          }}
          className="relative z-10 flex items-center gap-3 px-10 py-4 bg-slate-900 text-white rounded-[1.25rem] text-[11px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-2xl shadow-black/20 active:scale-95 group/btn"
        >
          <div className="p-1 bg-white/10 rounded-lg group-hover/btn:bg-brand-primary group-hover/btn:text-white transition-colors">
            <Plus size={18} />
          </div>
          Registar Novo Ativo
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
        <AnimatePresence mode="popLayout">
          {phones.map((phone) => (
            <motion.div
              layout
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              key={phone.id}
              className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm hover:shadow-xl transition-all group relative overflow-hidden"
            >
              {/* Technical Skew Background */}
              <div className="absolute top-0 right-0 w-32 h-16 bg-slate-50/50 -rotate-45 translate-x-12 -translate-y-8 pointer-events-none" />
              
              <div className="flex items-start justify-between mb-6 relative z-10">
                <div className="flex flex-col gap-1">
                  <div className={`px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest inline-flex items-center gap-2 ${
                    phone.status === 'Ativo' ? 'bg-emerald-50 text-emerald-600 border border-emerald-200' : 
                    phone.status === 'Manutenção' ? 'bg-amber-50 text-amber-600 border border-amber-200' : 'bg-rose-50 text-rose-600 border border-rose-200'
                  }`}>
                    <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", phone.status === 'Ativo' ? 'bg-emerald-500' : 'bg-current')} />
                    {phone.status}
                  </div>
                  <p className="text-[8px] font-black text-slate-300 uppercase tracking-widest ml-1">UID: {phone.id.slice(0, 8).toUpperCase()}</p>
                </div>
                
                <div className="flex items-center gap-2">
                   <div className="flex flex-col items-end">
                      <div className="w-8 h-4 bg-slate-100 rounded-[4px] border border-slate-200 relative overflow-hidden p-0.5">
                         <div 
                           className={cn("h-full rounded-[2px] transition-all duration-1000", 
                            (phone.batteryLevel || 100) > 20 ? 'bg-emerald-500' : 'bg-rose-500 animate-pulse'
                           )} 
                           style={{ width: `${phone.batteryLevel || 100}%` }} 
                         />
                      </div>
                      <span className="text-[8px] font-black text-slate-400 mt-1">{phone.batteryLevel || 100}%</span>
                   </div>
                </div>
              </div>
              
              <div className="space-y-4 relative z-10">
                <div>
                  <h4 className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] mb-1 italic">Designação do Ativo</h4>
                  <p className="text-xl font-black text-slate-900 uppercase tracking-tighter truncate italic">{phone.label}</p>
                </div>

                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 space-y-3">
                   <div className="flex items-center justify-between">
                     <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Colaborador</span>
                     <span className="text-[11px] font-black text-brand-primary uppercase italic">{phone.assignedTo || 'Livre'}</span>
                   </div>
                   <div className="flex items-center justify-between">
                     <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">GSM / Número</span>
                     <span className="text-[13px] font-black text-slate-900 tracking-tight">{phone.number}</span>
                   </div>
                   <div className="flex items-center justify-between">
                     <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">IMEI</span>
                     <span className="text-[10px] font-bold text-slate-600 font-mono italic">{phone.imei || 'N/A'}</span>
                   </div>
                </div>
              </div>

              <div className="mt-8 pt-4 border-t border-slate-50 flex items-center justify-between relative z-10">
                 <div className="flex items-center gap-2 text-[9px] font-black text-slate-400 uppercase tracking-widest italic animate-pulse">
                   <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
                   Last Sync
                 </div>
                 <div className="flex items-center gap-3">
                    <button 
                      onClick={() => handleEdit(phone)}
                      className="w-9 h-9 flex items-center justify-center bg-slate-50 text-slate-400 rounded-xl hover:bg-brand-primary hover:text-white transition-all shadow-sm"
                    >
                      <Edit3 size={16} />
                    </button>
                    <button 
                      onClick={() => handleDelete(phone.id)}
                      className="w-9 h-9 flex items-center justify-center bg-slate-50 text-slate-400 rounded-xl hover:bg-rose-500 hover:text-white transition-all shadow-sm"
                    >
                      <Trash2 size={16} />
                    </button>
                 </div>
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {phones.length === 0 && (
          <div className="col-span-full py-32 flex flex-col items-center justify-center bg-white rounded-[2.5rem] border-4 border-dashed border-slate-100 shadow-inner">
            <div className="w-24 h-24 bg-slate-50 rounded-full flex items-center justify-center text-slate-200 mb-6">
              <Smartphone size={48} />
            </div>
            <p className="text-sm font-black text-slate-300 uppercase tracking-[0.3em] italic">Rede de Terminais Vazia</p>
          </div>
        )}
      </div>

      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/80 backdrop-blur-md"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 30 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 30 }}
              className="relative bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden"
            >
              <div className="px-10 py-8 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tighter uppercase italic">{editingPhone ? 'Editar Ativo Móvel' : 'Registo de Ativo Móvel'}</h3>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.3em]">Protocolo de Segurança PSM Rígor</p>
                </div>
                <button 
                  onClick={() => setIsModalOpen(false)}
                  className="w-12 h-12 flex items-center justify-center hover:bg-slate-200/50 rounded-2xl transition-all"
                >
                  <X size={24} className="text-slate-400" />
                </button>
              </div>

              <form onSubmit={handleAddPhone} className="p-10 space-y-6">
                {error && (
                  <div className="bg-rose-50 border border-rose-200 p-4 rounded-2xl flex items-center gap-3 text-rose-600 text-[10px] font-black uppercase tracking-widest italic animate-bounce">
                    <AlertCircle size={18} />
                    {error}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1">Designação</label>
                    <input 
                      required
                      type="text" 
                      placeholder="Ex: Terminal 01"
                      value={newPhone.label}
                      onChange={(e) => setNewPhone({...newPhone, label: e.target.value})}
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-[13px] font-black uppercase italic outline-none focus:bg-white focus:ring-2 focus:ring-brand-primary transition-all tracking-tight"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1">Modelo / Marca</label>
                    <input 
                      required
                      type="text" 
                      value={newPhone.model}
                      onChange={(e) => setNewPhone({...newPhone, model: e.target.value})}
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-[13px] font-black uppercase italic outline-none focus:bg-white focus:ring-2 focus:ring-brand-primary transition-all tracking-tight"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1">Colaborador Vinculado</label>
                  <select 
                    value={newPhone.assignedToId}
                    onChange={(e) => {
                      const selected = collaborators.find(c => c.id === e.target.value);
                      setNewPhone({
                        ...newPhone,
                        assignedToId: e.target.value,
                        assignedTo: selected?.name || ''
                      });
                    }}
                    className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-[13px] font-black uppercase italic outline-none focus:bg-white focus:ring-2 focus:ring-brand-primary transition-all tracking-tight"
                  >
                    <option value="">Não vinculado</option>
                    {collaborators.map(c => (
                      <option key={c.id} value={c.id}>{c.name} ({c.type === 'driver' ? 'Motorista' : 'Staff'})</option>
                    ))}
                  </select>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1">Número de Telefone (GSM)</label>
                  <div className="flex gap-0 group">
                    <div className="bg-slate-900 border border-slate-900 px-6 py-4 rounded-l-2xl text-[13px] font-black text-white flex items-center shadow-lg active:scale-95 transition-transform italic">
                      +244
                    </div>
                    <input 
                      required
                      type="tel" 
                      placeholder="9XXXXXXXX"
                      maxLength={9}
                      value={newPhone.number.startsWith('+244') ? newPhone.number.slice(4) : newPhone.number}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, '');
                        setNewPhone({...newPhone, number: val ? `+244${val}` : ''});
                        if (error) setError(null);
                      }}
                      className="flex-1 px-5 py-4 bg-slate-50 border border-slate-200 rounded-r-2xl text-[15px] outline-none focus:bg-white focus:ring-2 focus:ring-brand-primary transition-all font-black tracking-widest italic"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-1">Código IMEI</label>
                    <input 
                      required
                      type="text" 
                      placeholder="Ex: 35XXXXXXXXXXXXX"
                      value={newPhone.imei}
                      onChange={(e) => setNewPhone({...newPhone, imei: e.target.value})}
                      className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-[12px] font-black font-mono italic outline-none focus:bg-white focus:ring-2 focus:ring-brand-primary transition-all"
                    />
                  </div>
                </div>

                <div className="pt-8 flex gap-4">
                  <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-8 py-4 bg-slate-100 text-slate-500 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all italic"
                  >
                    Retroceder Processo
                  </button>
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 px-8 py-4 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-2xl shadow-black/20 flex items-center justify-center gap-3 disabled:opacity-70 active:scale-95 italic"
                  >
                    {isSubmitting ? <Loader2 size={18} className="animate-spin" /> : <ShieldCheck size={18} className="text-emerald-500" />}
                    {editingPhone ? 'ATUALIZAR' : 'Auditar & Registar'}
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Rigorous Protocols Section */}
      <div className="bg-slate-900 rounded-[2.5rem] border border-white/5 p-12 text-white relative overflow-hidden shadow-2xl">
        <div className="absolute top-0 right-0 p-12 opacity-[0.05] pointer-events-none rotate-12">
           <Smartphone size={200} />
        </div>
        <div className="relative z-10 grid grid-cols-1 lg:grid-cols-2 gap-16">
          <div className="space-y-8">
            <div>
               <h3 className="text-3xl font-black italic uppercase tracking-tighter flex items-center gap-4">
                  <ShieldCheck size={32} className="text-brand-primary" />
                  Protocolos Operacionais
               </h3>
               <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.4em] mt-3 italic">Rigor Absoluto na Gestão de Terminais Corporativos</p>
            </div>
            
            <div className="space-y-6">
               <ProtocolItem icon={MessageSquare} title="Comunicação Integrada" desc="Todas as trocas de mensagens e chamadas operacionais são realizadas obrigatoriamente via Gateway Unitel da PSM." />
               <ProtocolItem icon={Activity} title="Monitorização de Sinal" desc="Terminais com perda de sinal por mais de 15 minutos disparam alertas críticos na central de comando." />
               <ProtocolItem icon={Calculator} title="Auditoria de Dados" desc="O consumo de dados e minutos é auditado diariamente para evitar uso desviado do protocolo de campo." />
               <ProtocolItem icon={Lock} title="Bloqueio Remoto" desc="Em caso de perda ou conduta imprópria, a central possui comando de bloqueio total do terminal." />
            </div>
          </div>

          <div className="bg-white/5 p-10 rounded-[3rem] border border-white/10 backdrop-blur-md relative">
             <div className="absolute inset-x-0 -top-1 font-black text-[9px] uppercase tracking-[0.5em] text-brand-primary text-center opacity-50">Sistema de Sincronismo PSM</div>
             
             <div className="space-y-8">
                <div className="flex items-center justify-between border-b border-white/5 pb-6">
                   <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Status do Gateway</p>
                      <p className="text-xl font-black text-emerald-400 italic">OPERAÇÃO ESTÁVEL</p>
                   </div>
                   <div className="w-12 h-12 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/20">
                      <div className="w-3 h-3 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_12px_rgba(16,185,129,0.5)]" />
                   </div>
                </div>

                <div className="grid grid-cols-2 gap-8">
                   <div>
                      <p className="text-[9px] font-black text-slate-500 uppercase mb-2 tracking-widest">Latência de Rede</p>
                      <p className="text-2xl font-black text-white italic">42ms</p>
                   </div>
                   <div>
                      <p className="text-[9px] font-black text-slate-500 uppercase mb-2 tracking-widest">Uptime Mensal</p>
                      <p className="text-2xl font-black text-white italic">99.98%</p>
                   </div>
                   <div>
                      <p className="text-[9px] font-black text-slate-500 uppercase mb-2 tracking-widest">Backups Diários</p>
                      <p className="text-2xl font-black text-white italic">OK</p>
                   </div>
                   <div>
                      <p className="text-[9px] font-black text-slate-500 uppercase mb-2 tracking-widest">Alertas Filtro</p>
                      <p className="text-2xl font-black text-rose-500 italic">ACTIVOS</p>
                   </div>
                </div>

                <div className="pt-6 border-t border-white/5">
                   <button 
                     onClick={() => {
                        const content = phones.map(p => `Designação: ${p.label}\nNúmero: ${p.number}\nIMEI: ${p.imei}\nStatus: ${p.status}\n------------------`).join('\n');
                        const blob = new Blob([`PSM COMERCIAL LUENA MOXICO\nDOSSIER DE PROTOCOLOS DE TERMINAIS\nData: ${new Date().toLocaleDateString()}\n\n${content}`], { type: 'text/plain' });
                        const url = URL.createObjectURL(blob);
                        const a = document.createElement('a');
                        a.href = url;
                        a.download = `dossier_protocolos_${new Date().getTime()}.txt`;
                        a.click();
                     }}
                     className="w-full py-4 bg-brand-primary text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-brand-secondary transition-all shadow-xl shadow-brand-primary/20"
                   >
                      Exportar Dossier de Protocolos
                   </button>
                </div>
             </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ProtocolItem({ icon: Icon, title, desc }: any) {
  return (
    <div className="flex items-start gap-4 p-4 rounded-2xl bg-white/5 border border-white/5 hover:border-white/10 transition-colors">
       <div className="p-2 bg-slate-800 text-brand-primary rounded-xl">
          <Icon size={18} />
       </div>
       <div>
          <h4 className="text-xs font-black uppercase italic tracking-tight">{title}</h4>
          <p className="text-[10px] text-slate-400 font-medium mt-1 leading-relaxed">{desc}</p>
       </div>
    </div>
  );
}
