import React, { useState, useEffect } from 'react';
import { 
  UserPlus, 
  ShieldCheck, 
  Loader2, 
  User, 
  Key, 
  Briefcase, 
  CheckCircle2, 
  AlertCircle,
  Copy,
  Plus,
  Ticket,
  Trash2,
  ExternalLink,
  XCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { formatSafe } from '../lib/dateUtils';
import { cn } from '../lib/utils';
import DriversMaster from './DriversMaster';
import RentACar from './RentACar';
import InternalClients from './InternalClients';
import VehicleRegistry from './VehicleRegistry';
import { 
  Car,
  CarFront,
  Users as UsersIcon
} from 'lucide-react';
import { 
  collection, 
  addDoc, 
  query, 
  where, 
  onSnapshot, 
  deleteDoc, 
  doc, 
  serverTimestamp,
  orderBy,
  getDocs,
  writeBatch
} from 'firebase/firestore';

const ROLES = [
  { id: 'operator', label: 'Operador', icon: ShieldCheck, color: 'text-blue-500', bg: 'bg-blue-50' },
  { id: 'contabilista', label: 'Contabilista', icon: Briefcase, color: 'text-purple-500', bg: 'bg-purple-50' },
  { id: 'mecanico', label: 'Mecânico', icon: ShieldCheck, color: 'text-orange-500', bg: 'bg-orange-50' },
  { id: 'driver', label: 'Motorista', icon: User, color: 'text-teal-500', bg: 'bg-teal-50' },
];

type SubTab = 'access' | 'drivers_master' | 'admin_staff' | 'rent_a_car' | 'internal_clients' | 'vehicles';

export default function RecruitmentHub({ user }: { user?: any }) {
  const [activeSubTab, setActiveSubTab] = useState<SubTab>('access');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successCode, setSuccessCode] = useState<string | null>(null);
  const [activeCodes, setActiveCodes] = useState<any[]>([]);
  const [activeUsers, setActiveUsers] = useState<any[]>([]);
  const [adminStaff, setAdminStaff] = useState<any[]>([]);
  const [driversMasterCount, setDriversMasterCount] = useState(0);
  const [driversMaster, setDriversMaster] = useState<any[]>([]);

  const [isAdminStaffModalOpen, setIsAdminStaffModalOpen] = useState(false);
  const [formData, setFormData] = useState({
    name: '',
    role: 'operator',
    assignedId: ''
  });
  
  const [newStaff, setNewStaff] = useState({
    name: '',
    role: 'gerente',
    phone: '',
    email: ''
  });

  // Listen for data
  useEffect(() => {
    const qCodes = query(collection(db, 'access_codes'), where('used', '==', false));
    const unsubCodes = onSnapshot(qCodes, (snapshot) => {
      setActiveCodes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const qUsers = query(collection(db, 'users'), orderBy('syncedAt', 'desc'));
    const unsubUsers = onSnapshot(qUsers, (snapshot) => {
      setActiveUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const qAdmin = query(collection(db, 'administrative_staff'), orderBy('name', 'asc'));
    const unsubAdmin = onSnapshot(qAdmin, (snapshot) => {
      setAdminStaff(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });

    const qDrivers = query(collection(db, 'drivers_master'), orderBy('name', 'asc'));
    const unsubDrivers = onSnapshot(qDrivers, (snapshot) => {
      setDriversMaster(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setDriversMasterCount(snapshot.size);
    });

    return () => {
      unsubCodes();
      unsubUsers();
      unsubAdmin();
      unsubDrivers();
    };
  }, []);

  const handleCreateStaff = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await addDoc(collection(db, 'administrative_staff'), {
        ...newStaff,
        createdAt: new Date().toISOString(),
        status: 'Ativo'
      });
      setIsAdminStaffModalOpen(false);
      setNewStaff({ name: '', role: 'gerente', phone: '', email: '' });
    } catch (err: any) {
      handleFirestoreError(err, OperationType.CREATE, 'administrative_staff');
    } finally {
      setLoading(false);
    }
  };

  const deleteStaff = async (id: string) => {
    const staff = adminStaff.find(s => s.id === id);
    if (!staff) return;

    if (confirm(`ELIMINAR PERMANENTEMENTE ${staff.name}? Esta acção irá remover o staff e registros operacionais (Extratos, Rendimentos e Acessos).`)) {
      setLoading(true);
      try {
        // 1. Operational Records
        const batch = writeBatch(db);
        batch.delete(doc(db, 'administrative_staff', id));

        // Delete Invitations
        const codeQ = query(collection(db, 'access_codes'), where('targetName', '==', staff.name));
        const codeSnap = await getDocs(codeQ);
        codeSnap.docs.forEach(d => batch.delete(d.ref));

        // Delete Revenue Logs (if any associated by name)
        const revQ = query(collection(db, 'revenue_logs'), where('driverName', '==', staff.name));
        const revSnap = await getDocs(revQ);
        revSnap.docs.forEach(d => batch.delete(d.ref));

        // Delete Individual Reports
        const repQ = query(collection(db, 'individual_reports'), where('driverName', '==', staff.name));
        const repSnap = await getDocs(repQ);
        repSnap.docs.forEach(d => batch.delete(d.ref));

        // Update Salary Sheets (Remove from staff list)
        const sheetSnap = await getDocs(collection(db, 'salary_sheets'));
        sheetSnap.docs.forEach(d => {
          const sheetData = d.data();
          if (sheetData.staff && Array.isArray(sheetData.staff)) {
            const updatedStaff = sheetData.staff.filter((s: any) => s.name !== staff.name);
            if (updatedStaff.length !== sheetData.staff.length) {
              batch.update(d.ref, { staff: updatedStaff });
            }
          }
        });

        await batch.commit();

        // 2. Profile (Admin Required)
        try {
          const userQ = query(collection(db, 'users'), where('name', '==', staff.name));
          const userSnap = await getDocs(userQ);
          if (!userSnap.empty) {
            const userBatch = writeBatch(db);
            userSnap.docs.forEach(d => userBatch.delete(d.ref));
            await userBatch.commit();
          }
        } catch (uErr) {
          console.warn("User profile deletion skipped (insufficient permissions).");
        }

        alert(`Staff ${staff.name} e todos os seus registros foram removidos com sucesso.`);
      } catch (err: any) {
        handleFirestoreError(err, OperationType.DELETE, `administrative_staff/${id}`);
      } finally {
        setLoading(false);
      }
    }
  };

  const generateCode = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccessCode(null);

    try {
      if (formData.name.trim().length < 3) throw new Error("Insira o nome do colaborador.");
      if (formData.assignedId.trim().length < 2) throw new Error("Atribua um ID ao convite (Ex: MOT-01).");
      
      const randomPart = Math.random().toString(36).substring(2, 6).toUpperCase();
      const newCode = `PSM-${randomPart}`;
      await addDoc(collection(db, 'access_codes'), {
        code: newCode,
        role: formData.role,
        targetName: formData.name,
        assignedId: formData.assignedId.trim().toUpperCase(),
        used: false,
        createdAt: serverTimestamp()
      });
      setSuccessCode(newCode);
      setFormData({ name: '', role: 'operator', assignedId: '' });
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const deleteCode = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'access_codes', id));
    } catch (err: any) {
      console.error("Error deleting code:", err);
    }
  };

  const deleteUser = async (id: string, name: string) => {
    if (confirm(`Tem certeza que deseja remover o acesso e TODOS os registros de ${name}? Esta ação irá apagar perfis, rendimentos e folhas de pagamento associadas.`)) {
      setLoading(true);
      try {
        // 1. Try deleting user profiles first (Might require Admin)
        try {
          const userBatch = writeBatch(db);
          userBatch.delete(doc(db, 'users', id));
          await userBatch.commit();
        } catch (adminErr) {
          throw new Error("Apenas Administradores Master podem remover perfis de acesso direto. Por favor, contacte o Admin.");
        }
        
        // 2. Cleanup related data
        const batch = writeBatch(db);
        
        const codeQ = query(collection(db, 'access_codes'), where('targetName', '==', name));
        const codeSnap = await getDocs(codeQ);
        codeSnap.docs.forEach(d => batch.delete(d.ref));

        const liveQ = query(collection(db, 'drivers'), where('name', '==', name));
        const liveSnap = await getDocs(liveQ);
        liveSnap.docs.forEach(d => batch.delete(d.ref));

        // Delete Revenue Logs
        const revQ = query(collection(db, 'revenue_logs'), where('driverName', '==', name));
        const revSnap = await getDocs(revQ);
        revSnap.docs.forEach(d => batch.delete(d.ref));

        // Delete Individual Reports
        const repQ = query(collection(db, 'individual_reports'), where('driverName', '==', name));
        const repSnap = await getDocs(repQ);
        repSnap.docs.forEach(d => batch.delete(d.ref));

        // Update Salary Sheets (Remove from staff list)
        const sheetSnap = await getDocs(collection(db, 'salary_sheets'));
        sheetSnap.docs.forEach(d => {
          const sheetData = d.data();
          if (sheetData.staff && Array.isArray(sheetData.staff)) {
            const updatedStaff = sheetData.staff.filter((s: any) => s.name !== name);
            if (updatedStaff.length !== sheetData.staff.length) {
              batch.update(d.ref, { staff: updatedStaff });
            }
          }
        });

        await batch.commit();
        alert(`Acesso e registros removidos com sucesso para ${name}`);
      } catch (err: any) {
        if (err.message.includes("Apenas Administradores")) {
          alert(err.message);
        } else {
          handleFirestoreError(err, OperationType.DELETE, 'users');
        }
      } finally {
        setLoading(false);
      }
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-10 pb-20">
      <div className="flex flex-col md:flex-row md:items-center justify-between bg-white px-10 py-10 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-primary/5 rounded-full -mr-48 -mt-48 blur-[80px] opacity-50 group-hover:bg-brand-primary/10 transition-colors duration-700" />
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-2">
            <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic text-brand-primary group-hover:text-slate-900 transition-colors">Portal Staff & Recrutamento</h2>
            <div className="px-3 py-1 bg-brand-primary/10 text-brand-primary rounded-full text-[10px] font-black uppercase tracking-[0.2em] border border-brand-primary/20">PSM GATEWAY</div>
          </div>
          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-[0.3em] flex items-center gap-2">
            <Key size={14} className="text-brand-primary" />
            Gestão Centralizada de Capital Humano • LUENA MOXICO
          </p>
        </div>
        <div className="hidden md:block w-px h-12 bg-slate-100 mx-10 relative z-10" />
        <div className="relative z-10 text-right">
           <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Total Staff PSM</p>
           <p className="text-3xl font-black text-slate-900 tracking-tighter italic">
             {driversMasterCount + adminStaff.length} <span className="text-xs opacity-50 uppercase tracking-normal">Colaboradores</span>
           </p>
           <p className="text-[9px] text-slate-400 font-bold uppercase mt-1">
             {driversMasterCount} Motoristas • {adminStaff.length} Administrativos
           </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-4 p-1.5 bg-white border border-slate-200 rounded-[1.5rem] w-fit shadow-sm">
        {[
          { id: 'access', label: 'Gestão de Acessos', icon: Key },
          { id: 'drivers_master', label: 'Banco de Motoristas', icon: User },
          { id: 'admin_staff', label: 'Staff Administrativo', icon: Briefcase },
          { id: 'vehicles', label: 'Master de Viaturas', icon: Car },
          { id: 'rent_a_car', label: 'Rent-a-Car', icon: CarFront },
          { id: 'internal_clients', label: 'Clientes de Contrato', icon: UsersIcon },
        ].map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveSubTab(tab.id as any)}
            className={cn(
              "flex items-center gap-3 px-6 py-3 rounded-2xl text-[11px] font-black uppercase tracking-widest transition-all whitespace-nowrap",
              activeSubTab === tab.id 
                ? "bg-slate-900 text-white shadow-xl shadow-slate-900/20" 
                : "text-slate-400 hover:bg-slate-50 hover:text-slate-600 font-bold"
            )}
          >
            <tab.icon size={16} />
            {tab.label}
          </button>
        ))}
      </div>

      <AnimatePresence mode="wait">
        {activeSubTab === 'drivers_master' && (
          <motion.div
            key="drivers"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
          >
            <DriversMaster embedded />
          </motion.div>
        )}

        {activeSubTab === 'access' && (
          <motion.div
            key="access"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="space-y-10"
          >
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
              {/* Formulário de Geração */}
              <div className="lg:col-span-1 border border-slate-200 rounded-2xl bg-white p-6 shadow-sm h-fit">
                <div className="flex items-center gap-3 mb-6">
                  <div className="w-10 h-10 bg-brand-primary rounded-xl flex items-center justify-center text-white">
                    <Ticket size={20} />
                  </div>
                  <div>
                    <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight italic">Criar Convite</h2>
                    <p className="text-[10px] text-slate-500 font-bold uppercase">Gerar chave de acesso</p>
                  </div>
                </div>

                <form onSubmit={generateCode} className="space-y-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Colaborador Registrado</label>
                    <select 
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({...formData, name: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:bg-white focus:border-brand-primary outline-none transition-all"
                    >
                      <option value="">Selecione um colaborador...</option>
                      <optgroup label="Motoristas">
                        {driversMaster.map(d => (
                          <option key={d.id} value={d.name}>{d.name} ({d.prefix || 'N/A'})</option>
                        ))}
                      </optgroup>
                      <optgroup label="Administrativos">
                        {adminStaff.map(s => (
                          <option key={s.id} value={s.name}>{s.name} - {s.role}</option>
                        ))}
                      </optgroup>
                    </select>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">ID Atribuído (Ex: MOT-01, OP-05)</label>
                    <div className="relative group">
                      <ShieldCheck size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-brand-primary transition-colors" />
                      <input 
                        required
                        type="text" 
                        placeholder="Ex: MOT-01"
                        value={formData.assignedId}
                        onChange={(e) => setFormData({...formData, assignedId: e.target.value.toUpperCase()})}
                        className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-100 rounded-xl text-sm font-bold focus:bg-white focus:border-brand-primary outline-none transition-all"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Atribuir Função</label>
                    <div className="grid grid-cols-1 gap-2">
                      {ROLES.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setFormData({...formData, role: r.id})}
                          className={`flex items-center gap-3 p-3 rounded-xl border text-left transition-all ${
                            formData.role === r.id 
                              ? 'border-brand-primary bg-brand-primary/5 ring-1 ring-brand-primary' 
                              : 'border-slate-100 bg-white hover:bg-slate-50'
                          }`}
                        >
                          <div className={`p-2 rounded-lg ${formData.role === r.id ? 'bg-brand-primary text-white' : r.bg + ' ' + r.color}`}>
                            <r.icon size={16} />
                          </div>
                          <span className={`text-[10px] font-black uppercase tracking-tight ${formData.role === r.id ? 'text-slate-900' : 'text-slate-500'}`}>
                            {r.label}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>

                  {error && (
                    <div className="p-3 bg-red-50 border border-red-100 rounded-xl flex items-center gap-2 text-red-600 text-[10px] font-bold">
                      <AlertCircle size={14} />
                      {error}
                    </div>
                  )}

                  <button
                    type="submit"
                    disabled={loading}
                    className="w-full bg-brand-primary text-white py-4 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-brand-secondary transition-all flex items-center justify-center gap-3 shadow-lg shadow-brand-primary/20 disabled:opacity-50"
                  >
                    {loading ? <Loader2 size={18} className="animate-spin" /> : <Plus size={18} />}
                    GERAR CHAVE DE ACESSO
                  </button>
                </form>
              </div>

              {/* Lista de Chaves Ativas */}
              <div className="lg:col-span-2 space-y-4">
                <div className="bg-slate-900 rounded-2xl p-6 text-white relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/20 blur-3xl rounded-full" />
                  <div className="relative z-10 flex items-center justify-between">
                    <div>
                      <h2 className="text-lg font-black uppercase italic tracking-tight">Convites Ativos</h2>
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Aguardando ativação por parte da equipa</p>
                    </div>
                    <div className="text-right">
                      <p className="text-2xl font-black text-brand-primary leading-none">{activeCodes.length}</p>
                      <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Chaves Pendentes</p>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <AnimatePresence mode="popLayout">
                    {activeCodes.map((code) => (
                      <motion.div
                        layout
                        key={code.id}
                        initial={{ opacity: 0, scale: 0.9 }}
                        animate={{ opacity: 1, scale: 1 }}
                        exit={{ opacity: 0, scale: 0.9 }}
                        className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm hover:shadow-md transition-shadow group relative overflow-hidden"
                      >
                        <div className="flex items-start justify-between mb-4">
                          <div className="flex items-center gap-3">
                            <div className={`p-2.5 rounded-xl ${ROLES.find(r => r.id === code.role)?.bg} ${ROLES.find(r => r.id === code.role)?.color}`}>
                              {React.createElement(ROLES.find(r => r.id === code.role)?.icon || User, { size: 18 })}
                            </div>
                            <div>
                               <h3 className="text-xs font-black text-slate-900 uppercase tracking-tight">{code.targetName}</h3>
                               <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
                                  ID: <span className="text-slate-900">{code.assignedId || 'N/A'}</span> • {ROLES.find(r => r.id === code.role)?.label}
                               </p>
                            </div>
                          </div>
                          <button 
                            onClick={() => deleteCode(code.id)}
                            className="p-2 text-slate-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                          >
                            <Trash2 size={16} />
                          </button>
                        </div>

                        <div className="bg-slate-50 border border-slate-100 rounded-xl p-3 flex items-center justify-between">
                           <code className="text-sm font-black text-brand-primary tracking-widest font-mono">
                              {code.code}
                           </code>
                           <button 
                            onClick={() => copyToClipboard(code.code)}
                            className="p-1.5 text-slate-400 hover:text-brand-primary hover:bg-brand-primary/5 rounded-md transition-all"
                           >
                             <Copy size={14} />
                           </button>
                        </div>

                        <div className="mt-4 flex items-center justify-between border-t border-slate-50 pt-3">
                           <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">
                             Criado em: {formatSafe(code.createdAt, 'dd/MM/yyyy')}
                           </span>
                           <div className="flex items-center gap-1 text-[8px] font-black text-green-500 uppercase tracking-widest animate-pulse">
                             <ShieldCheck size={10} />
                             Válido para Ativação
                           </div>
                        </div>
                      </motion.div>
                    ))}
                  </AnimatePresence>

                  {activeCodes.length === 0 && (
                    <div className="col-span-full py-12 flex flex-col items-center justify-center bg-slate-50 rounded-2xl border-2 border-dashed border-slate-200">
                       <Ticket size={40} className="text-slate-300 mb-4" />
                       <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Nenhuma chave de convite ativa</p>
                       <p className="text-[10px] text-slate-400 mt-1">Gere uma nova chave à esquerda para começar.</p>
                    </div>
                  )}
                </div>

                <div className="bg-blue-50 border border-blue-100 rounded-2xl p-6 flex gap-4">
                  <div className="w-12 h-12 rounded-full bg-white flex items-center justify-center text-blue-500 shadow-sm flex-shrink-0">
                    <ShieldCheck size={24} />
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-slate-900 uppercase tracking-tight mb-1">Como o funcionário ativa a conta?</h4>
                    <p className="text-[11px] text-slate-600 font-bold leading-relaxed">
                      Entrega o código acima ao colaborador. Ele deve aceder ao sistema, clicar em <span className="text-brand-primary font-black uppercase">"Ativar ID"</span> e preencher o formulário. O sistema irá associar automaticamente a função que você definiu aqui.
                    </p>
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {activeSubTab === 'admin_staff' && (
          <motion.div
            key="staff"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
            className="space-y-8"
          >
            <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
                <div className="px-8 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                  <div>
                    <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight italic">Cadastro de Staff Administrativo</h2>
                    <p className="text-[10px] text-slate-500 font-bold uppercase">Gerentes, Contabilistas, Mecânicos e Serviços Gerais</p>
                  </div>
                  <button 
                    onClick={() => setIsAdminStaffModalOpen(true)}
                    className="flex items-center gap-2 px-6 py-2.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-lg"
                  >
                    <Plus size={16} /> Novo Colaborador
                  </button>
                </div>

                <div className="overflow-x-auto">
                   <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-[10px] font-black text-slate-500 uppercase tracking-widest border-b border-slate-100">
                          <th className="px-8 py-5">Nome / Identificação</th>
                          <th className="px-8 py-5">Cargo / Função</th>
                          <th className="px-8 py-5">Contatos</th>
                          <th className="px-8 py-5 text-right">Acções</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50">
                        {adminStaff.map(staff => (
                          <tr key={staff.id} className="hover:bg-slate-50/50 transition-colors">
                            <td className="px-8 py-6 uppercase font-black text-sm italic tracking-tight text-slate-900">{staff.name}</td>
                            <td className="px-8 py-6">
                               <span className="px-3 py-1 bg-slate-100 text-slate-600 rounded-md text-[9px] font-black uppercase tracking-widest">
                                 {staff.role}
                               </span>
                            </td>
                            <td className="px-8 py-6">
                               <p className="text-[11px] font-black text-slate-700">{staff.phone}</p>
                               <p className="text-[9px] text-slate-400 font-bold">{staff.email}</p>
                            </td>
                            <td className="px-8 py-6 text-right">
                               <button onClick={() => deleteStaff(staff.id)} className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all">
                                 <Trash2 size={16} />
                               </button>
                            </td>
                          </tr>
                        ))}
                        {adminStaff.length === 0 && (
                          <tr>
                            <td colSpan={5} className="py-20 text-center">
                               <Briefcase size={40} className="text-slate-200 mx-auto mb-4" />
                               <p className="text-xs font-black text-slate-300 uppercase tracking-widest">Nenhum staff administrativo cadastrado</p>
                            </td>
                          </tr>
                        )}
                      </tbody>
                   </table>
                </div>
            </div>
          </motion.div>
        )}

        {activeSubTab === 'vehicles' && (
          <motion.div
            key="vehicles"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
          >
            <VehicleRegistry user={user} />
          </motion.div>
        )}

        {activeSubTab === 'rent_a_car' && (
          <motion.div
            key="rent_a_car"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
          >
            <RentACar user={user} />
          </motion.div>
        )}

        {activeSubTab === 'internal_clients' && (
          <motion.div
            key="internal_clients"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -20 }}
            transition={{ duration: 0.2 }}
          >
            <InternalClients user={user} />
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isAdminStaffModalOpen && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsAdminStaffModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden"
            >
              <div className="px-6 py-5 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
                <h3 className="font-black text-slate-900 uppercase tracking-tight italic">Novo Staff Administrativo</h3>
                <button onClick={() => setIsAdminStaffModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                  <XCircle size={20} />
                </button>
              </div>
              <form onSubmit={handleCreateStaff} className="p-8 space-y-4">
                 <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome Completo</label>
                    <input 
                      required 
                      type="text" 
                      value={newStaff.name}
                      onChange={(e) => setNewStaff({...newStaff, name: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:bg-white focus:border-brand-primary" 
                    />
                 </div>
                 <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                       <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Cargo</label>
                       <select 
                         value={newStaff.role}
                         onChange={(e) => setNewStaff({...newStaff, role: e.target.value})}
                         className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:bg-white focus:border-brand-primary"
                       >
                         <option value="gerente">Gerente / Admin</option>
                         <option value="contabilista">Contabilista</option>
                         <option value="mecanico">Mecânico</option>
                         <option value="faxineiro">Faxineiro</option>
                         <option value="serviços gerais">Serviços Gerais</option>
                         <option value="operador">Operador de Frota</option>
                       </select>
                    </div>
                    <div className="space-y-1">
                       <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest ml-1">Telefone</label>
                       <input 
                         required 
                         type="tel" 
                         value={newStaff.phone}
                         onChange={(e) => setNewStaff({...newStaff, phone: e.target.value})}
                         className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:bg-white focus:border-brand-primary" 
                       />
                    </div>
                 </div>
                 <button type="submit" className="w-full bg-slate-900 text-white py-4 rounded-xl font-black text-xs uppercase shadow-xl hover:bg-black transition-all flex items-center justify-center gap-3">
                   {loading ? <Loader2 className="animate-spin" size={18} /> : <CheckCircle2 size={18} />}
                   CONTRATAR COLABORADOR
                 </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <div className="h-px bg-slate-200 w-full" />

      {/* Tabela de Colaboradores Ativos */}
      <div className="bg-white border border-slate-200 rounded-2xl overflow-hidden shadow-sm">
        <div className="px-6 py-6 border-b border-slate-100 flex items-center justify-between bg-slate-50/50">
          <div>
            <h2 className="text-sm font-black text-slate-900 uppercase tracking-tight italic">Diretório de Acessos Ativos</h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Utilizadores que já sincronizaram conta via Portal</p>
          </div>
          <div className="px-4 py-1.5 bg-emerald-100 text-emerald-700 rounded-xl text-[10px] font-black uppercase tracking-widest">
            {activeUsers.length} Logados
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left border-collapse">
            <thead>
              <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                <th className="px-6 py-4">Colaborador</th>
                <th className="px-6 py-4">Função / Cargo</th>
                <th className="px-6 py-4">ID / E-mail de Acesso</th>
                <th className="px-6 py-4">Data de Cadastro</th>
                <th className="px-6 py-4 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {activeUsers.map((user) => (
                <tr key={user.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-900 text-white flex items-center justify-center text-[10px] font-black italic shadow-lg shadow-black/10">
                        {user.name.charAt(0)}
                      </div>
                      <span className="text-xs font-black text-slate-800 uppercase italic tracking-tight">{user.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-5">
                     <span className={`px-2 py-1 rounded-md text-[9px] font-black uppercase tracking-widest ${
                        ROLES.find(r => r.id === user.role)?.bg
                     } ${
                        ROLES.find(r => r.id === user.role)?.color
                     }`}>
                        {ROLES.find(r => r.id === user.role)?.label || user.role}
                     </span>
                  </td>
                  <td className="px-6 py-5">
                    <div className="flex items-center gap-2">
                       <span className="text-xs font-bold text-slate-500">{user.email}</span>
                       <button onClick={() => copyToClipboard(user.email)} className="text-slate-300 hover:text-brand-primary transition-colors">
                         <Copy size={12} />
                       </button>
                    </div>
                  </td>
                  <td className="px-6 py-5 text-[10px] text-slate-400 font-bold uppercase tracking-widest">
                    {formatSafe(user.createdAt, 'dd/MM/yyyy', 'Sistema')}
                  </td>
                  <td className="px-6 py-5 text-right">
                    {user.email !== 'joseiwezasuana@gmail.com' && (
                       <button 
                         onClick={() => deleteUser(user.id, user.name)}
                         className="text-slate-300 hover:text-red-500 transition-colors p-2 hover:bg-red-50 rounded-lg"
                         title="Remover Acesso"
                       >
                         <Trash2 size={16} />
                       </button>
                    )}
                  </td>
                </tr>
              ))}
              {activeUsers.length === 0 && (
                <tr>
                  <td colSpan={5} className="py-12 text-center text-[11px] font-bold text-slate-300 uppercase tracking-widest">Nenhum utilizador sincronizado</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
