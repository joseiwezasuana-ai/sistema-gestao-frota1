import React, { useState, useEffect } from 'react';
import { 
  UserPlus, 
  Search, 
  MoreHorizontal, 
  Trash2, 
  Edit3,
  FileText,
  Briefcase,
  Award,
  Calendar,
  X,
  Plus,
  Loader2,
  ShieldCheck
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, query, orderBy, getDocs, where, writeBatch, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { cn } from '../lib/utils';

export default function DriversMaster({ embedded = false }: { embedded?: boolean }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [editingDriver, setEditingDriver] = useState<any>(null);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [phoneError, setPhoneError] = useState<string | null>(null);

  const [newDriver, setNewDriver] = useState({
    name: '',
    licenseNumber: '',
    experienceYears: '',
    phone: '',
    status: 'Ativo',
  });

  useEffect(() => {
    const q = query(collection(db, 'drivers_master'), orderBy('name', 'asc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setDrivers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'drivers_master'));
    return () => unsub();
  }, []);

  const validatePhoneNumber = (phone: string) => {
    // Basic validation: starts with +244 and has 9 digits after (Angola standard)
    const regex = /^\+244\d{9}$/;
    return regex.test(phone.replace(/\s/g, ''));
  };

  const handleAddDriver = async (e: React.FormEvent) => {
    e.preventDefault();
    
    setPhoneError(null);
    if (!validatePhoneNumber(newDriver.phone)) {
      setPhoneError('Formato inválido. Use +244 seguido de 9 dígitos (Ex: +244920000000)');
      return;
    }

      setIsSubmitting(true);
      const path = 'drivers_master';
      try {
        if (editingDriver) {
          await updateDoc(doc(db, path, editingDriver.id), {
            ...newDriver,
            updatedAt: new Date().toISOString(),
          });
        } else {
          await addDoc(collection(db, path), {
            ...newDriver,
            createdAt: new Date().toISOString(),
          });
        }
        setIsModalOpen(false);
        setEditingDriver(null);
        setNewDriver({
          name: '',
          licenseNumber: '',
          experienceYears: '',
          phone: '',
          status: 'Ativo',
        });
      } catch (error) {
        handleFirestoreError(error, editingDriver ? OperationType.UPDATE : OperationType.CREATE, path);
      } finally {
        setIsSubmitting(false);
      }
    };

  const handleDelete = async (id: string) => {
    const driver = drivers.find(d => d.id === id);
    if (!driver) return;

    if (window.confirm(`ELIMINAR PERMANENTEMENTE ${driver.name}? Esta ação irá remover o perfil e todos os registros operacionais (Extratos, Rendimentos e Folhas de Pagamento).`)) {
      setIsSubmitting(true);
      try {
        // 1. Delete operational records (things most roles can do)
        const batch = writeBatch(db);
        batch.delete(doc(db, 'drivers_master', id));

        // Search and plan deletion from 'access_codes' (Invitations)
        const codeQ = query(collection(db, 'access_codes'), where('targetName', '==', driver.name));
        const codeSnap = await getDocs(codeQ);
        codeSnap.docs.forEach(d => batch.delete(d.ref));

        // Search and plan deletion from 'drivers' (Live Status/Monitor)
        const liveQ = query(collection(db, 'drivers'), where('name', '==', driver.name));
        const liveSnap = await getDocs(liveQ);
        liveSnap.docs.forEach(d => batch.delete(d.ref));

        // Delete Revenue Logs
        const revQ = query(collection(db, 'revenue_logs'), where('driverName', '==', driver.name));
        const revSnap = await getDocs(revQ);
        revSnap.docs.forEach(d => batch.delete(d.ref));

        // Delete Individual Reports
        const repQ = query(collection(db, 'individual_reports'), where('driverName', '==', driver.name));
        const repSnap = await getDocs(repQ);
        repSnap.docs.forEach(d => batch.delete(d.ref));

        // Update Salary Sheets (Remove from staff list)
        const sheetSnap = await getDocs(collection(db, 'salary_sheets'));
        sheetSnap.docs.forEach(d => {
          const sheetData = d.data();
          if (sheetData.staff && Array.isArray(sheetData.staff)) {
            const updatedStaff = sheetData.staff.filter((s: any) => s.name !== driver.name);
            if (updatedStaff.length !== sheetData.staff.length) {
              batch.update(d.ref, { staff: updatedStaff });
            }
          }
        });

        await batch.commit();

        // 2. Try to delete from 'users' (Admin only)
        try {
          const userQ = query(collection(db, 'users'), where('name', '==', driver.name));
          const userSnap = await getDocs(userQ);
          if (!userSnap.empty) {
            const userBatch = writeBatch(db);
            userSnap.docs.forEach(d => userBatch.delete(d.ref));
            await userBatch.commit();
          }
        } catch (itemErr) {
          console.warn("User profile could not be deleted (Insufficient permissions), but operational data was removed.");
        }

        alert(`Colaborador ${driver.name} e todos os seus registros foram removidos com sucesso.`);
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `drivers_master/${id}`);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleEdit = (driver: any) => {
    setEditingDriver(driver);
    setNewDriver({
      name: driver.name,
      licenseNumber: driver.licenseNumber,
      experienceYears: driver.experienceYears,
      phone: driver.phone,
      status: driver.status,
    });
    setIsModalOpen(true);
  };

  const filtered = drivers.filter(d => 
    d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.licenseNumber.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className={cn("space-y-10 max-w-[1400px] mx-auto pb-20", embedded && "space-y-6 pb-0")}>
      {!embedded && (
        <div className="flex flex-col md:flex-row md:items-center justify-between bg-white px-10 py-10 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-96 h-96 bg-brand-primary/5 rounded-full -mr-48 -mt-48 blur-[80px] opacity-50 group-hover:bg-brand-primary/10 transition-colors duration-700" />
          <div className="relative z-10">
            <div className="flex items-center gap-4 mb-2">
              <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">Master de Motoristas</h2>
              <div className="px-3 py-1 bg-brand-primary/10 text-brand-primary rounded-full text-[10px] font-black uppercase tracking-[0.2em] border border-brand-primary/20">PSM FLEET STAFF</div>
            </div>
            <p className="text-[11px] text-slate-400 font-bold uppercase tracking-[0.3em] flex items-center gap-2">
              <Briefcase size={14} className="text-brand-primary" />
              Base de Dados Central de Operadores Operacionais • LUENA MOXICO
            </p>
          </div>
          
          <button 
            onClick={() => {
              setEditingDriver(null);
              setNewDriver({
                name: '',
                licenseNumber: '',
                experienceYears: '',
                phone: '',
                status: 'Ativo',
              });
              setIsModalOpen(true);
            }}
            className="relative z-10 flex items-center gap-3 px-10 py-4 bg-slate-900 text-white rounded-[1.25rem] text-[11px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-2xl shadow-black/20 active:scale-95 group/btn"
          >
            <div className="p-1 bg-white/10 rounded-lg group-hover/btn:bg-brand-primary group-hover/btn:text-white transition-colors">
              <Plus size={18} />
            </div>
            Novo Motorista
          </button>
        </div>
      )}

      {embedded && (
         <div className="flex items-center justify-between bg-slate-900 rounded-2xl p-6 text-white relative overflow-hidden shadow-lg shadow-black/20">
            <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/20 blur-3xl rounded-full" />
            <div className="relative z-10 flex items-center justify-between w-full">
              <div>
                <h2 className="text-lg font-black uppercase italic tracking-tight">Banco de Motoristas</h2>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Controlo de pessoal operacional auditado</p>
              </div>
              <button 
                onClick={() => {
                  setEditingDriver(null);
                  setNewDriver({
                    name: '',
                    licenseNumber: '',
                    experienceYears: '',
                    phone: '',
                    status: 'Ativo',
                  });
                  setIsModalOpen(true);
                }}
                className="flex items-center gap-2 px-6 py-2.5 bg-brand-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-secondary transition-all shadow-lg"
              >
                <Plus size={16} /> Novo Motorista
              </button>
            </div>
         </div>
      )}

      <div className="bg-white rounded-[2rem] border border-slate-200 flex flex-col overflow-hidden shadow-sm">
        <div className="px-8 py-6 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between bg-slate-50/50 gap-4">
          <div className="flex items-center gap-4">
             <div className="px-4 py-1.5 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest italic shadow-xl shadow-black/10">
               Auditados: {drivers.length} Operadores
             </div>
          </div>
          <div className="relative w-full md:w-80 group/search">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within/search:text-brand-primary transition-colors" size={16} />
            <input 
              type="text" 
              placeholder="FILTRAR POR NOME OU CARTA..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-6 py-2.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-brand-primary transition-all shadow-inner"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-tight">
                <th className="px-6 py-3 text-left border-b border-slate-200">MOTORISTA</th>
                <th className="px-6 py-3 text-left border-b border-slate-200">LICENÇA / CARTA</th>
                <th className="px-6 py-3 text-left border-b border-slate-200">EXPERIÊNCIA</th>
                <th className="px-6 py-3 text-left border-b border-slate-200">TEL. PESSOAL</th>
                <th className="px-6 py-3 text-left border-b border-slate-200">STATUS</th>
                <th className="px-6 py-3 text-right border-b border-slate-200">AÇÕES</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((driver) => (
                <tr key={driver.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 font-bold">
                        {driver.name.charAt(0)}
                      </div>
                      <span className="font-bold text-slate-900">{driver.name}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 font-mono text-slate-600 font-bold uppercase">{driver.licenseNumber}</td>
                  <td className="px-6 py-4 text-slate-500 font-medium">{driver.experienceYears} Anos</td>
                  <td className="px-6 py-4 text-slate-600 font-semibold">{driver.phone}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-0.5 bg-green-100 text-[#166534] rounded text-[10px] font-bold uppercase tracking-widest">
                      {driver.status}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-3 text-slate-400">
                      <button 
                        onClick={() => handleEdit(driver)}
                        className="hover:text-brand-primary transition-colors"
                      >
                        <Edit3 size={16} />
                      </button>
                      <button 
                        onClick={() => handleDelete(driver.id)}
                        className="hover:text-red-500 transition-colors"
                      >
                        <Trash2 size={16} />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center">
                    <div className="flex flex-col items-center gap-2 opacity-30">
                      <Briefcase size={40} />
                      <p className="text-sm font-bold uppercase tracking-tighter">Nenhum motorista encontrado</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
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
              className="relative bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden"
            >
              <div className="px-6 py-4 border-b border-slate-100 flex items-center justify-between">
                <div>
                  <h3 className="font-bold text-slate-900">{editingDriver ? 'Editar Cadastro Master' : 'Novo Cadastro Master'}</h3>
                  <p className="text-[11px] text-slate-500 font-medium uppercase tracking-wider">{editingDriver ? 'Atualizar dados do colaborador auditado' : 'Adicionar motorista à base de dados permanente'}</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="text-slate-400 hover:text-slate-600 transition-colors">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleAddDriver} className="p-6 space-y-4">
                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase">Nome Completo</label>
                  <input 
                    required
                    type="text" 
                    value={newDriver.name}
                    onChange={(e) => setNewDriver({...newDriver, name: e.target.value})}
                    className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:bg-white focus:border-brand-primary transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 uppercase">Número da Carta</label>
                    <input 
                      required
                      type="text" 
                      value={newDriver.licenseNumber}
                      onChange={(e) => setNewDriver({...newDriver, licenseNumber: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:bg-white focus:border-brand-primary transition-all font-mono"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-500 uppercase">Anos de Experiência</label>
                    <input 
                      required
                      type="number" 
                      value={newDriver.experienceYears}
                      onChange={(e) => setNewDriver({...newDriver, experienceYears: e.target.value})}
                      className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-sm outline-none focus:bg-white focus:border-brand-primary transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[11px] font-bold text-slate-500 uppercase">Telefone Pessoal</label>
                  <div className="flex gap-0">
                    <div className="bg-slate-100 border border-r-0 border-slate-200 px-3 py-2 rounded-l-lg text-sm font-bold text-slate-500 flex items-center">
                      +244
                    </div>
                    <input 
                      required
                      type="tel" 
                      placeholder="9XXXXXXXX"
                      maxLength={9}
                      value={newDriver.phone.startsWith('+244') ? newDriver.phone.slice(4) : newDriver.phone}
                      onChange={(e) => {
                        const val = e.target.value.replace(/\D/g, ''); // Only digits
                        setNewDriver({...newDriver, phone: val ? `+244${val}` : ''});
                        if (phoneError) setPhoneError(null);
                      }}
                      className={`flex-1 px-4 py-2 bg-slate-50 border rounded-r-lg text-sm outline-none transition-all ${
                        phoneError ? 'border-red-500 focus:border-red-500' : 'border-slate-200 focus:bg-white focus:border-brand-primary'
                      }`}
                    />
                  </div>
                  {phoneError && (
                    <p className="text-[10px] text-red-500 font-bold uppercase tracking-tight mt-1">{phoneError}</p>
                  )}
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-2.5 bg-slate-100 text-slate-600 rounded-lg text-[13px] font-bold hover:bg-slate-200 transition-all font-bold uppercase tracking-widest"
                  >
                    VOLTAR
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="flex-1 py-2.5 bg-brand-primary text-white rounded-lg text-[13px] font-bold hover:shadow-lg hover:bg-brand-secondary transition-all flex items-center justify-center gap-2 uppercase tracking-widest"
                  >
                    {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                    {editingDriver ? 'ATUALIZAR' : 'REGISTAR'}
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
