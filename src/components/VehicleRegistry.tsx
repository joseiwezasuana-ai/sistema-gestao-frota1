import React, { useState, useEffect } from 'react';
import { 
  Truck, 
  Search, 
  Trash2, 
  Edit3,
  X,
  Plus,
  Loader2,
  Hash,
  ShieldCheck,
  CheckCircle2,
  Clock,
  Car
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, query, orderBy, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';

export default function VehicleRegistry({ user }: { user?: any }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [editingVehicle, setEditingVehicle] = useState<any>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [vehicles, setVehicles] = useState<any[]>([]);

  const isMecanico = user?.role === 'mecanico';
  const canModify = !isMecanico;

  const [newVehicle, setNewVehicle] = useState({
    brand: '',
    prefix: '',
    plate: '',
    trackerId: '',
    status: 'Ativo'
  });

  useEffect(() => {
    const q = query(collection(db, 'master_vehicles'), orderBy('prefix', 'asc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setVehicles(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'master_vehicles'));
    return () => unsub();
  }, []);

  const handleAddVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    const path = 'master_vehicles';
    try {
      await addDoc(collection(db, path), {
        ...newVehicle,
        status: 'Ativo',
        createdAt: new Date().toISOString(),
      });
      setIsModalOpen(false);
      setNewVehicle({
        brand: '',
        prefix: '',
        plate: '',
        trackerId: '',
        status: 'Ativo'
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, path);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleUpdateVehicle = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editingVehicle) return;
    setIsSubmitting(true);
    const path = `master_vehicles/${editingVehicle.id}`;
    try {
      await updateDoc(doc(db, 'master_vehicles', editingVehicle.id), {
        brand: editingVehicle.brand,
        prefix: editingVehicle.prefix,
        plate: editingVehicle.plate,
        trackerId: editingVehicle.trackerId,
      });
      setIsEditModalOpen(false);
      setEditingVehicle(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (window.confirm("Remover esta viatura definitivamente da frota?")) {
      const path = `master_vehicles/${id}`;
      try {
        await deleteDoc(doc(db, 'master_vehicles', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, path);
      }
    }
  };

  const filtered = vehicles.filter(v => 
    v.brand?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.prefix?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    v.plate?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between bg-white px-6 py-4 rounded-lg border border-slate-200">
        <div className="flex items-center gap-4">
          <div className="p-3 bg-brand-primary/10 rounded-xl text-brand-primary">
            <Truck size={24} />
          </div>
          <div>
            <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">Registo Geral de Viaturas</h2>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">Base de dados mestre da frota TaxiControl</p>
          </div>
        </div>
        {canModify && (
          <button 
            onClick={() => setIsModalOpen(true)}
            className="bg-brand-primary text-white text-[11px] font-black uppercase tracking-widest px-6 py-3 rounded-lg hover:bg-brand-secondary transition-all flex items-center gap-2 shadow-lg shadow-brand-primary/20"
          >
            <Plus size={16} />
            Cadastrar Nova Unidade
          </button>
        )}
      </div>

      <div className="bg-white rounded-lg border border-slate-200 flex flex-col overflow-hidden shadow-sm">
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-slate-50/50">
          <div className="flex items-center gap-4">
             <div className="px-3 py-1 bg-slate-200 text-slate-600 rounded-full text-[10px] font-black uppercase tracking-widest">
               Frota Total: {vehicles.length}
             </div>
             <div className="px-3 py-1 bg-green-100 text-green-700 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5">
               <div className="w-1.5 h-1.5 bg-green-500 rounded-full" />
               Operacionais: {vehicles.filter(v => v.status === 'Ativo').length}
             </div>
          </div>
          <div className="relative w-80">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input 
              type="text" 
              placeholder="Buscar por Prefixo, Matrícula ou Nome..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-[13px] font-bold outline-none focus:border-brand-primary transition-all shadow-inner"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-widest text-[10px]">
                <th className="px-6 py-4 text-left border-b border-slate-200">PREFIXO (Nº)</th>
                <th className="px-6 py-4 text-left border-b border-slate-200">VIATURA / IDENTIFICAÇÃO</th>
                <th className="px-6 py-4 text-left border-b border-slate-200">MATRÍCULA</th>
                <th className="px-6 py-4 text-left border-b border-slate-200">ID DISPOSITIVO GPS</th>
                <th className="px-6 py-4 text-right border-b border-slate-200">GESTÃO</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filtered.map((vehicle) => (
                <tr key={vehicle.id} className="hover:bg-slate-50/50 transition-colors group">
                  <td className="px-6 py-4">
                    <span className="inline-block px-3 py-1.5 bg-white border-2 border-slate-200 rounded font-black text-slate-900 text-sm shadow-sm">
                      {vehicle.prefix}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div>
                      <p className="font-black text-slate-900 uppercase tracking-tight">{vehicle.brand}</p>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest flex items-center gap-1 mt-0.5">
                        <CheckCircle2 size={10} className="text-green-500" />
                        Status: {vehicle.status}
                      </p>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <span className="font-mono font-black text-slate-600 bg-slate-100 px-2.5 py-1 rounded-md border border-slate-200">
                      {vehicle.plate}
                    </span>
                  </td>
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-2">
                       <Hash size={12} className="text-slate-400" />
                       <span className="font-mono text-[11px] font-bold text-slate-500">{vehicle.trackerId || 'PENDENTE'}</span>
                    </div>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-all">
                      {canModify && (
                        <>
                          <button 
                            onClick={() => {
                              setEditingVehicle(vehicle);
                              setIsEditModalOpen(true);
                            }}
                            className="p-2 text-slate-400 hover:text-brand-primary hover:bg-brand-primary/10 rounded-lg transition-all"
                            title="Editar Dados"
                          >
                            <Edit3 size={18} />
                          </button>
                          <button 
                            onClick={() => handleDelete(vehicle.id)}
                            className="p-2 text-slate-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-all"
                            title="Remover Registros"
                          >
                            <Trash2 size={18} />
                          </button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
              {filtered.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-3 opacity-20">
                      <Car size={64} />
                      <p className="text-lg font-black uppercase tracking-tighter">Nenhuma viatura registada</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Vehicle Modal */}
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
              className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden"
            >
              <div className="bg-slate-900 px-6 py-5 text-white flex items-center justify-between">
                <div>
                  <h3 className="font-black text-sm uppercase tracking-widest">Nova Viatura Master</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Cadastro permanente de frota</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="text-white/50 hover:text-white transition-colors">
                  <X size={20} />
                </button>
              </div>

              <form onSubmit={handleAddVehicle} className="p-8 space-y-5">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Marca da Viatura</label>
                  <input 
                    required
                    type="text" 
                    placeholder="Ex: Toyota Hiace ou Suzuki Carry"
                    value={newVehicle.brand}
                    onChange={(e) => setNewVehicle({...newVehicle, brand: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:bg-white focus:border-brand-primary transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nº Viatura (Prefix)</label>
                    <input 
                      required
                      type="text" 
                      placeholder="TX-00"
                      value={newVehicle.prefix}
                      onChange={(e) => setNewVehicle({...newVehicle, prefix: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:bg-white focus:border-brand-primary transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Matrícula</label>
                    <input 
                      required
                      type="text" 
                      placeholder="LD-00-00"
                      value={newVehicle.plate}
                      onChange={(e) => setNewVehicle({...newVehicle, plate: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:bg-white focus:border-brand-primary transition-all uppercase"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ID Rastreador GPS (IMEI)</label>
                  <div className="relative">
                    <Hash size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      required
                      type="text" 
                      placeholder="Número de Série"
                      value={newVehicle.trackerId}
                      onChange={(e) => setNewVehicle({...newVehicle, trackerId: e.target.value})}
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold font-mono outline-none focus:bg-white focus:border-brand-primary transition-all"
                    />
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button" 
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 py-3.5 bg-slate-100 text-slate-600 rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all font-bold uppercase tracking-widest"
                  >
                    VOLTAR
                  </button>
                  <button 
                    type="submit" 
                    disabled={isSubmitting}
                    className="flex-1 py-3.5 bg-brand-primary text-white rounded-xl text-[11px] font-black uppercase tracking-widest hover:shadow-lg hover:bg-brand-secondary transition-all flex items-center justify-center gap-2 uppercase tracking-widest"
                  >
                    {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                    CADASTRAR
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Edit Vehicle Modal */}
      <AnimatePresence>
        {isEditModalOpen && editingVehicle && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => {
                setIsEditModalOpen(false);
                setEditingVehicle(null);
              }}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden"
            >
              <div className="bg-brand-primary px-6 py-5 text-white flex items-center justify-between">
                <div>
                  <h3 className="font-black text-sm uppercase tracking-widest">Editar Viatura</h3>
                  <p className="text-[10px] text-brand-light font-bold uppercase tracking-widest">Atualizar Unidade nº {editingVehicle.prefix}</p>
                </div>
                <button 
                  onClick={() => {
                    setIsEditModalOpen(false);
                    setEditingVehicle(null);
                  }}
                  className="p-2 hover:bg-white/10 rounded-full transition-colors"
                >
                  <X size={20} className="text-white" />
                </button>
              </div>

              <form onSubmit={handleUpdateVehicle} className="p-8 space-y-5">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Marca da Viatura</label>
                  <input 
                    required
                    type="text" 
                    value={editingVehicle.brand}
                    onChange={(e) => setEditingVehicle({...editingVehicle, brand: e.target.value})}
                    className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:bg-white focus:border-brand-primary transition-all"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nº da Viatura (Prefix)</label>
                    <input 
                      required
                      type="text" 
                      value={editingVehicle.prefix}
                      onChange={(e) => setEditingVehicle({...editingVehicle, prefix: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:bg-white focus:border-brand-primary transition-all"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Matrícula</label>
                    <input 
                      required
                      type="text" 
                      value={editingVehicle.plate}
                      onChange={(e) => setEditingVehicle({...editingVehicle, plate: e.target.value})}
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold outline-none focus:bg-white focus:border-brand-primary transition-all uppercase"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ID do Rastreador GPS (IMEI)</label>
                  <div className="relative">
                    <Hash size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      required
                      type="text" 
                      value={editingVehicle.trackerId}
                      onChange={(e) => setEditingVehicle({...editingVehicle, trackerId: e.target.value})}
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold font-mono outline-none focus:bg-white focus:border-brand-primary transition-all"
                    />
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => {
                      setIsEditModalOpen(false);
                      setEditingVehicle(null);
                    }}
                    className="flex-1 px-4 py-3.5 bg-slate-100 text-slate-600 rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-slate-200 transition-all font-bold uppercase tracking-widest"
                  >
                    VOLTAR
                  </button>
                  <button 
                    type="submit"
                    disabled={isSubmitting}
                    className="flex-1 px-4 py-3.5 bg-brand-primary text-white rounded-xl font-black text-[11px] uppercase tracking-widest hover:bg-brand-secondary transition-all hover:shadow-lg shadow-brand-primary/20 flex items-center justify-center gap-2 uppercase tracking-widest"
                  >
                    {isSubmitting ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                    SALVAR
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
