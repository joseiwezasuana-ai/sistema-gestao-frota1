import React, { useState, useEffect } from 'react';
import { 
  Wrench, 
  Calendar, 
  Plus, 
  Search, 
  ChevronRight, 
  CheckCircle2, 
  Clock, 
  AlertCircle,
  Truck,
  Box,
  Layers,
  DollarSign,
  TrendingUp,
  Trash2,
  Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, deleteDoc, doc, updateDoc, writeBatch, serverTimestamp, getDocs } from 'firebase/firestore';
import { cn } from '../lib/utils';

export default function MaintenanceRegistry({ user }: { user?: any }) {
  const [logs, setLogs] = useState<any[]>([]);
  const [vehicles, setVehicles] = useState<any[]>([]);
  const [masterVehicles, setMasterVehicles] = useState<any[]>([]);
  const [inventory, setInventory] = useState<any[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const currentMonth = new Date().toISOString().slice(0, 7);
  const [filter, setFilter] = useState(currentMonth);

  const [searchTerm, setSearchTerm] = useState('');

  const isAdmin = user?.role === 'admin' || user?.email === 'joseiwezasuana@gmail.com';
  const isContabilista = user?.role === 'contabilista';

  const [formData, setFormData] = useState({
    vehicleId: '',
    prefix: '',
    type: 'Troca de Óleo',
    mileage: '',
    date: new Date().toISOString().split('T')[0],
    cost: '',
    status: 'planned',
    description: '',
    itemsUsed: [] as { itemId: string, name: string, quantity: number }[]
  });

  const [selectedMaterial, setSelectedMaterial] = useState('');
  const [materialQty, setMaterialQty] = useState(1);

  useEffect(() => {
    const q = query(collection(db, 'maintenance_logs'), orderBy('date', 'desc'));
    const unsubscribeLogs = onSnapshot(q, (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'maintenance_logs'));

    const qVehicles = query(collection(db, 'drivers'), orderBy('prefix', 'asc'));
    const unsubscribeVehicles = onSnapshot(qVehicles, (snapshot) => {
      setVehicles(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'drivers'));

    const qMasterVehicles = query(collection(db, 'master_vehicles'), orderBy('prefix', 'asc'));
    const unsubscribeMaster = onSnapshot(qMasterVehicles, (snapshot) => {
      setMasterVehicles(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'master_vehicles'));

    const qInventory = query(collection(db, 'warehouse_inventory'), orderBy('name', 'asc'));
    const unsubscribeInventory = onSnapshot(qInventory, (snapshot) => {
      setInventory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'warehouse_inventory'));

    return () => {
      unsubscribeLogs();
      unsubscribeVehicles();
      unsubscribeMaster();
      unsubscribeInventory();
    };
  }, []);

  const addMaterial = () => {
    if (!selectedMaterial) return;
    const item = inventory.find(i => i.id === selectedMaterial);
    if (!item) return;

    if (item.stock < materialQty) {
      alert("Stock insuficiente!");
      return;
    }

    const existing = formData.itemsUsed.find(i => i.itemId === selectedMaterial);
    if (existing) {
      setFormData({
        ...formData,
        itemsUsed: formData.itemsUsed.map(i => 
          i.itemId === selectedMaterial ? { ...i, quantity: i.quantity + materialQty } : i
        )
      });
    } else {
      setFormData({
        ...formData,
        itemsUsed: [...formData.itemsUsed, { itemId: item.id, name: item.name, quantity: materialQty }]
      });
    }
    setSelectedMaterial('');
    setMaterialQty(1);
  };

  const removeMaterial = (itemId: string) => {
    setFormData({
      ...formData,
      itemsUsed: formData.itemsUsed.filter(i => i.itemId !== itemId)
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const selectedVehicle = masterVehicles.find(v => v.id === formData.vehicleId) || vehicles.find(v => v.id === formData.vehicleId);
    
    try {
      const batch = writeBatch(db);
      
      // Add maintenance log
      const logRef = doc(collection(db, 'maintenance_logs'));
      batch.set(logRef, {
        ...formData,
        prefix: selectedVehicle?.prefix || 'N/A',
        mileage: Number(formData.mileage),
        cost: Number(formData.cost),
        timestamp: new Date().toISOString()
      });

      // If completed, deduct items from inventory
      if (formData.status === 'completed') {
        for (const itemUsage of formData.itemsUsed) {
          const itemDocRef = doc(db, 'warehouse_inventory', itemUsage.itemId);
          const item = inventory.find(i => i.id === itemUsage.itemId);
          if (item) {
            batch.update(itemDocRef, {
              stock: item.stock - itemUsage.quantity,
              updatedAt: serverTimestamp()
            });

            // Log movement
            const logMoveRef = doc(collection(db, 'warehouse_logs'));
            batch.set(logMoveRef, {
              itemId: itemUsage.itemId,
              itemName: itemUsage.name,
              quantity: itemUsage.quantity,
              type: 'maintenance',
              timestamp: serverTimestamp(),
              user: user?.name || 'Sistema',
              vehicleId: formData.vehicleId,
              maintenanceId: logRef.id
            });
          }
        }
      }

      await batch.commit();
      
      setIsModalOpen(false);
      setFormData({
        vehicleId: '',
        prefix: '',
        type: 'Troca de Óleo',
        mileage: '',
        date: new Date().toISOString().split('T')[0],
        cost: '',
        status: 'planned',
        description: '',
        itemsUsed: []
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'maintenance_logs/batch');
      alert("Erro ao registar manutenção.");
    }
  };

  const deleteMaintenance = async (id: string) => {
    if (!window.confirm("Deseja realmente eliminar este registo de manutenção?")) return;
    
    try {
      await deleteDoc(doc(db, 'maintenance_logs', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, `maintenance_logs/${id}`);
    }
  };

  const handleResetCycle = async () => {
    if (!isAdmin) return;
    if (!window.confirm("Deseja zerar o ciclo de manutenção? Todos os registos concluídos serão arquivados e removidos da vista principal.")) return;

    setIsProcessing(true);
    try {
      // Archive completed logs
      const toArchive = logs.filter(log => log.status === 'completed');
      for (const log of toArchive) {
        await updateDoc(doc(db, 'maintenance_logs', log.id), { status: 'archived' });
      }
      alert('Ciclo reiniciado! Registos concluídos foram arquivados.');
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'maintenance_logs/archive');
      alert("Erro ao reiniciar ciclo.");
    } finally {
      setIsProcessing(false);
    }
  };

  const getStatusStyle = (status: string) => {
    switch (status) {
      case 'completed': return 'bg-emerald-50 text-emerald-600 border-emerald-100';
      case 'planned': return 'bg-amber-50 text-amber-600 border-amber-100';
      default: return 'bg-slate-50 text-slate-500 border-slate-100';
    }
  };

  const filteredLogs = logs.filter(log => {
    // Basic search filtering
    const matchesSearch = 
      log.prefix?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.type?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      log.description?.toLowerCase().includes(searchTerm.toLowerCase());

    if (!matchesSearch) return false;

    // Filter by tab/status
    if (filter === 'archived') return log.status === 'archived';
    if (log.status === 'archived') return false;
    if (filter === 'all') return true;
    if (filter.length === 7) return log.date?.startsWith(filter);
    return log.status === filter;
  });

  const months = Array.from(new Set(logs.map(l => l.date?.slice(0, 7)))).sort().reverse();

  const exportPDF = () => {
    const doc = new jsPDF();
    const today = new Date().toLocaleDateString();
    
    doc.setFontSize(18);
    doc.text('PSM COMERCIAL LUENA MOXICO', 105, 15, { align: 'center' });
    doc.setFontSize(14);
    doc.text('Histórico de Manutenções', 105, 25, { align: 'center' });
    doc.setFontSize(10);
    doc.text(`Filtro: ${filter === 'all' ? 'Todo' : filter} | Relatório em: ${today}`, 105, 32, { align: 'center' });

    const tableData = filteredLogs.map(log => [
      log.prefix,
      `${log.type}${log.itemsUsed?.length ? '\nPeças: ' + log.itemsUsed.map((i: any) => `${i.quantity}x ${i.name}`).join(', ') : ''}`,
      log.date,
      `${(log.cost || 0).toLocaleString()} Kz`,
      log.status === 'completed' ? 'Concluído' : 'Pendente'
    ]);

    autoTable(doc, {
      startY: 40,
      head: [['Viatura', 'Serviço', 'Data', 'Custo', 'Estado']],
      body: tableData,
    });

    doc.save(`manutencao_psm_${filter}_${Date.now()}.pdf`);
  };

  return (
    <div className="max-w-[1200px] mx-auto space-y-6">
      <div className="bg-white px-6 py-6 rounded-lg border border-slate-200 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center text-white shadow-lg shadow-slate-200">
            <Wrench size={24} />
          </div>
          <div>
            <h2 className="font-black text-xl text-slate-900 tracking-tight uppercase">Saúde da Viatura</h2>
            <p className="text-xs text-slate-500 font-bold uppercase tracking-widest mt-1">Gestão Técnica de Manutenções • Luena</p>
          </div>
        </div>
        {!isContabilista && (
          <div className="flex gap-2">
            {isAdmin && (
              <button 
                onClick={handleResetCycle}
                disabled={isProcessing}
                className="bg-rose-50 hover:bg-rose-100 text-rose-600 px-4 py-2.5 rounded-lg flex items-center gap-2 text-xs font-black transition-all uppercase tracking-widest active:scale-95 border border-rose-100 italic"
              >
                {isProcessing ? <Clock className="animate-spin" size={14} /> : <Trash2 size={16} />}
                Zerar Ciclo
              </button>
            )}
            <button 
              onClick={exportPDF}
              className="bg-slate-100 hover:bg-slate-200 text-slate-700 px-4 py-2.5 rounded-lg flex items-center gap-2 text-xs font-black transition-all uppercase tracking-widest active:scale-95 border border-slate-200"
            >
              Exportar PDF
            </button>
            <button 
              onClick={() => setIsModalOpen(true)}
              className="bg-brand-primary hover:bg-brand-secondary text-white px-5 py-2.5 rounded-lg flex items-center gap-2 text-xs font-black shadow-lg shadow-brand-primary/20 transition-all uppercase tracking-widest active:scale-95"
            >
              <Plus size={16} />
              Registar Manutenção
            </button>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Custo Total (Mês)</p>
            <TrendingUp size={14} className="text-brand-primary" />
          </div>
          <p className="text-2xl font-black text-brand-primary">
            {logs.reduce((acc, curr) => acc + (curr.cost || 0), 0).toLocaleString()} Kz
          </p>
        </div>
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Manutenções Pendentes</p>
            <Clock size={14} className="text-amber-500" />
          </div>
          <p className="text-2xl font-black text-amber-500">
            {logs.filter(l => l.status === 'planned').length}
          </p>
        </div>
        <div className="bg-white p-5 rounded-lg border border-slate-200 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Viaturas com Alerta</p>
            <AlertCircle size={14} className="text-red-500" />
          </div>
          <p className="text-2xl font-black text-red-500">2</p>
        </div>
      </div>

      <div className="bg-white rounded-lg border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between bg-slate-50/50 gap-4">
          <div className="flex items-center gap-3">
             <Filter size={14} className="text-slate-400" />
             <div className="flex gap-2">
                <select 
                  value={filter} 
                  onChange={(e) => setFilter(e.target.value)}
                  className="bg-white border border-slate-200 rounded-lg text-[10px] font-black uppercase tracking-widest px-3 py-1 outline-none focus:border-brand-primary"
                >
                  <option value="all">Todo Histórico</option>
                  {months.map(m => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
                {['planned', 'completed', 'archived'].map((f) => (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    className={cn(
                      "px-3 py-1 rounded text-[10px] font-black uppercase tracking-widest transition-all",
                      filter === f ? "bg-slate-900 text-white shadow-lg" : "bg-white text-slate-400 hover:text-slate-600 border border-slate-200"
                    )}
                  >
                    {f === 'planned' ? 'Planeado' : f === 'completed' ? 'Concluído' : 'Histórico (C)'}
                  </button>
                ))}
             </div>
          </div>

          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
            <input 
              type="text"
              placeholder="Pesquisar por viatura, serviço ou notas..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none focus:border-brand-primary shadow-sm"
            />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead>
              <tr className="bg-slate-50/50 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                <th className="px-6 py-4">Viatura</th>
                <th className="px-6 py-4">Serviço</th>
                <th className="px-6 py-4">Data Planeada</th>
                <th className="px-6 py-4">Custo</th>
                <th className="px-6 py-4">Status</th>
                <th className="px-6 py-4 text-right">Acções</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filteredLogs.map((log) => (
                <tr key={log.id} className="hover:bg-slate-50 transition-colors group">
                  <td className="px-6 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500">
                        <Truck size={14} />
                      </div>
                      <div>
                        <p className="text-xs font-black text-slate-900 tracking-tight">{log.prefix}</p>
                        <p className="text-[10px] text-slate-400 font-bold">{log.mileage?.toLocaleString()} KM</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-xs font-bold text-slate-700 uppercase tracking-widest">{log.type}</p>
                    <div className="flex flex-wrap gap-1 mt-1">
                      {log.itemsUsed && log.itemsUsed.length > 0 ? (
                        log.itemsUsed.map((item: any, idx: number) => (
                          <span key={idx} className="px-1.5 py-0.5 bg-brand-primary/10 text-brand-primary text-[8px] font-black rounded uppercase tracking-tighter">
                            {item.quantity}x {item.name}
                          </span>
                        ))
                      ) : (
                        <p className="text-[10px] text-slate-400 line-clamp-1 italic">{log.description || 'Sem detalhes'}</p>
                      )}
                    </div>
                  </td>
                  <td className="px-6 py-4 text-xs font-bold text-slate-500 font-mono">
                    {log.date}
                  </td>
                  <td className="px-6 py-4">
                    <p className="text-xs font-black text-slate-800 tracking-tight">{log.cost?.toLocaleString()} Kz</p>
                  </td>
                  <td className="px-6 py-4">
                    <span className={cn(
                      "px-2.5 py-1 rounded text-[9px] font-black uppercase tracking-widest border",
                      getStatusStyle(log.status)
                    )}>
                      {log.status === 'completed' ? 'Concluído' : 'Pendente'}
                    </span>
                  </td>
                  <td className="px-6 py-4 text-right">
                    <div className="flex items-center justify-end gap-2">
                       {!isContabilista && (
                         <button 
                           onClick={() => deleteMaintenance(log.id)}
                           className="p-2 text-slate-400 hover:text-red-500 transition-colors"
                           title="Eliminar"
                         >
                           <Trash2 size={18} />
                         </button>
                       )}
                       <button className="p-2 text-slate-400 hover:text-brand-primary transition-colors">
                         <ChevronRight size={18} />
                       </button>
                    </div>
                  </td>
                </tr>
              ))}
              {filteredLogs.length === 0 && !loading && (
                <tr>
                  <td colSpan={6} className="py-20 text-center">
                    <div className="flex flex-col items-center gap-2 opacity-30">
                      <Wrench size={40} className="text-slate-300" />
                      <p className="text-xs font-black text-slate-400 uppercase tracking-widest">Nenhum registo de manutenção</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Overlay */}
      <AnimatePresence>
        {isModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative bg-white rounded-2xl w-full max-w-lg shadow-2xl overflow-hidden"
            >
              <div className="px-8 py-6 bg-slate-900 text-white flex items-center justify-between">
                <div>
                   <h3 className="text-lg font-black uppercase tracking-tighter">Registar Manutenção</h3>
                   <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Início de intervenção técnica</p>
                </div>
                <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white/10 rounded-full transition-colors">
                  <Search className="rotate-45" size={20} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-8 space-y-5">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Viatura (Prefixo)</label>
                    <select 
                      required
                      value={formData.vehicleId}
                      onChange={(e) => setFormData({...formData, vehicleId: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-brand-primary"
                    >
                      <option value="">Seleccionar Viatura...</option>
                      {masterVehicles.length > 0 && (
                        <optgroup label="Frota Master (Permanente)">
                          {masterVehicles.map(v => (
                            <option key={v.id} value={v.id}>{v.prefix} - {v.brand} ({v.plate})</option>
                          ))}
                        </optgroup>
                      )}
                      {vehicles.length > 0 && (
                        <optgroup label="Frota Ativa (Condutores)">
                          {vehicles.map(v => (
                            <option key={v.id} value={v.id}>{v.prefix} - {v.name}</option>
                          ))}
                        </optgroup>
                      )}
                    </select>
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Tipo de Serviço</label>
                    <select 
                      required
                      value={formData.type}
                      onChange={(e) => setFormData({...formData, type: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-brand-primary"
                    >
                      <option value="Troca de Óleo">Troca de Óleo</option>
                      <option value="Travões">Sistema de Travões</option>
                      <option value="Pneus">Substituição de Pneus</option>
                      <option value="Seguro">Seguro Automóvel</option>
                      <option value="Inspeção">Inspeção Periódica</option>
                      <option value="Outro">Outro Reparo</option>
                    </select>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Quilometragem (KM)</label>
                    <input 
                      type="number"
                      required
                      value={formData.mileage}
                      onChange={(e) => setFormData({...formData, mileage: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-brand-primary"
                      placeholder="Ex: 45000"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Custo Estimado (Kz)</label>
                    <input 
                      type="number"
                      required
                      value={formData.cost}
                      onChange={(e) => setFormData({...formData, cost: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-brand-primary"
                      placeholder="Ex: 15000"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Data</label>
                    <input 
                      type="date"
                      required
                      value={formData.date}
                      onChange={(e) => setFormData({...formData, date: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-brand-primary"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Estado</label>
                    <select 
                      required
                      value={formData.status}
                      onChange={(e) => setFormData({...formData, status: e.target.value})}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-brand-primary"
                    >
                      <option value="planned">Planeado / Pendente</option>
                      <option value="completed">Concluído</option>
                    </select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Observações / Detalhes</label>
                  <textarea 
                    rows={2}
                    value={formData.description}
                    onChange={(e) => setFormData({...formData, description: e.target.value})}
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none focus:border-brand-primary resize-none"
                    placeholder="Descreva o que será feito na viatura..."
                  />
                </div>

                {/* Peças e Materiais */}
                <div className="space-y-3 bg-slate-50 p-4 rounded-xl border border-dashed border-slate-300">
                  <div className="flex items-center justify-between">
                    <label className="text-[10px] font-black text-slate-600 uppercase tracking-widest flex items-center gap-2">
                       <Box size={14} className="text-brand-primary" />
                       Peças & Materiais Utilizados
                    </label>
                  </div>
                  
                  <div className="flex gap-2">
                    <select 
                      value={selectedMaterial}
                      onChange={(e) => setSelectedMaterial(e.target.value)}
                      className="flex-1 bg-white border border-slate-200 rounded-lg px-3 py-2 text-[10px] font-bold outline-none focus:border-brand-primary"
                    >
                      <option value="">Seleccione a peça...</option>
                      {inventory.map(i => (
                        <option key={i.id} value={i.id} disabled={i.stock <= 0}>
                          {i.name} ({i.stock} {i.unit})
                        </option>
                      ))}
                    </select>
                    <input 
                      type="number"
                      min="1"
                      value={materialQty}
                      onChange={(e) => setMaterialQty(Number(e.target.value))}
                      className="w-16 bg-white border border-slate-200 rounded-lg px-2 py-2 text-[10px] font-bold text-center outline-none"
                    />
                    <button 
                      type="button"
                      onClick={addMaterial}
                      className="bg-slate-900 text-white p-2 rounded-lg hover:bg-slate-800 transition-colors"
                    >
                      <Plus size={16} />
                    </button>
                  </div>

                  {formData.itemsUsed.length > 0 && (
                    <div className="space-y-1 mt-2">
                      {formData.itemsUsed.map((item, idx) => (
                        <div key={idx} className="flex items-center justify-between bg-white border border-slate-100 rounded-lg px-3 py-1.5 shadow-sm">
                           <div className="flex items-center gap-2">
                              <span className="w-1.5 h-1.5 rounded-full bg-brand-primary"></span>
                              <span className="text-[10px] font-bold text-slate-700">{item.name}</span>
                           </div>
                           <div className="flex items-center gap-3">
                              <span className="text-[10px] font-black text-slate-900">{item.quantity} un</span>
                              <button 
                                type="button"
                                onClick={() => removeMaterial(item.itemId)}
                                className="text-rose-500 hover:text-rose-700"
                              >
                                <Trash2 size={12} />
                              </button>
                           </div>
                        </div>
                      ))}
                    </div>
                  )}
                  {formData.itemsUsed.length === 0 && (
                    <p className="text-[9px] text-slate-400 italic text-center font-bold font-italic">Nenhuma peça adicionada</p>
                  )}
                </div>

                <div className="pt-4 flex gap-3">
                   <button 
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="flex-1 px-6 py-4 rounded-xl text-[11px] font-black text-slate-400 uppercase tracking-widest hover:bg-slate-50 transition-colors"
                   >
                     Cancelar
                   </button>
                   <button 
                    type="submit"
                    className="flex-2 bg-brand-primary text-white py-4 rounded-xl text-[11px] font-black uppercase tracking-widest shadow-xl shadow-brand-primary/20 hover:bg-brand-secondary transition-all active:scale-95"
                   >
                     Guardar Registo
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
