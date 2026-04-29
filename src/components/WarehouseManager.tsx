import React, { useState, useEffect } from 'react';
import { 
  Package, 
  Settings, 
  AlertTriangle, 
  ArrowDownToLine, 
  ArrowUpFromLine,
  Truck,
  Layers,
  Search,
  Plus,
  Box,
  X,
  Loader2,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, updateDoc, doc, deleteDoc, serverTimestamp, writeBatch } from 'firebase/firestore';
import { cn } from '../lib/utils';

export default function WarehouseManager({ user }: { user?: any }) {
  const [inventory, setInventory] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [modalType, setModalType] = useState<'add' | 'entry' | 'edit' | 'output'>('add');
  const [selectedItem, setSelectedItem] = useState<any>(null);
  const [searchTerm, setSearchTerm] = useState('');

  const [formData, setFormData] = useState({
    name: '',
    category: 'Mecânica',
    stock: 0,
    min: 5,
    unit: 'UN',
    price: 0
  });

  const [entryData, setEntryData] = useState({
    itemId: '',
    quantity: 0,
    vehicleId: ''
  });

  const isMecanico = user?.role === 'mecanico';
  const canModify = !isMecanico;

  const [vehicles, setVehicles] = useState<any[]>([]);

  useEffect(() => {
    const q = query(collection(db, 'warehouse_inventory'), orderBy('name', 'asc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setInventory(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'warehouse_inventory');
    });

    const qVehicles = query(collection(db, 'master_vehicles'), orderBy('prefix', 'asc'));
    const unsubVehicles = onSnapshot(qVehicles, (snapshot) => {
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
    try {
      if (modalType === 'add') {
        await addDoc(collection(db, 'warehouse_inventory'), {
          ...formData,
          createdAt: serverTimestamp(),
          updatedAt: serverTimestamp()
        });
      } else if (modalType === 'edit' && selectedItem) {
        await updateDoc(doc(db, 'warehouse_inventory', selectedItem.id), {
          ...formData,
          updatedAt: serverTimestamp()
        });
      } else if ((modalType === 'entry' || modalType === 'output') && entryData.itemId) {
        const item = inventory.find(i => i.id === entryData.itemId);
        if (item) {
          const newQty = modalType === 'entry' 
            ? item.stock + entryData.quantity 
            : item.stock - entryData.quantity;
          
          if (newQty < 0 && modalType === 'output') {
            alert("Stock insuficiente para esta saída!");
            return;
          }

          const batch = writeBatch(db);
          batch.update(doc(db, 'warehouse_inventory', item.id), {
            stock: newQty,
            updatedAt: serverTimestamp()
          });

          // Log movement
          const logRef = doc(collection(db, 'warehouse_logs'));
          batch.set(logRef, {
            itemId: item.id,
            itemName: item.name,
            quantity: entryData.quantity,
            type: modalType,
            timestamp: serverTimestamp(),
            user: user?.name || 'Sistema',
            vehicleId: modalType === 'output' ? entryData.vehicleId : null
          });

          await batch.commit();
    }
  }
  setIsModalOpen(false);
  resetForms();
} catch (error) {
  handleFirestoreError(error, OperationType.WRITE, 'warehouse_inventory/batch');
}
};

  const resetForms = () => {
    setFormData({ name: '', category: 'Mecânica', stock: 0, min: 5, unit: 'UN', price: 0 });
    setEntryData({ itemId: '', quantity: 0, vehicleId: '' });
    setSelectedItem(null);
  };

  const filteredInventory = inventory.filter(item => 
    item.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    item.id.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="max-w-[1400px] mx-auto space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between bg-white px-6 py-6 rounded-2xl border border-slate-200 shadow-sm gap-4">
        <div>
          <h2 className="text-2xl font-black text-slate-900 tracking-tight uppercase italic">Gestão de Armazém</h2>
          <p className="text-[10px] text-slate-500 font-bold uppercase tracking-[0.2em] mt-1">Stock de Peças & Consumíveis PSM COMERCIAL</p>
        </div>
        <div className="flex gap-3">
          {canModify && (
            <>
              <button 
                onClick={() => {
                  setModalType('output');
                  setIsModalOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-rose-50 text-rose-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-rose-100 transition-all border border-rose-100"
              >
                <ArrowUpFromLine size={16} />
                Saída de Material
              </button>
              <button 
                onClick={() => {
                  setModalType('entry');
                  setIsModalOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-emerald-100 transition-all border border-emerald-100"
              >
                <ArrowDownToLine size={16} />
                Entrada de Material
              </button>
              <button 
                onClick={() => {
                  setModalType('add');
                  setIsModalOpen(true);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white rounded-xl text-xs font-black uppercase tracking-widest hover:bg-brand-secondary transition-all shadow-lg shadow-brand-primary/20"
              >
                <Plus size={16} />
                Nova Peça
              </button>
            </>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
           <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-blue-50 text-blue-600 rounded-2xl flex items-center justify-center">
               <Package size={24} />
             </div>
             <div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Itens</p>
               <p className="text-2xl font-black text-slate-900">{inventory.length}</p>
             </div>
           </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
           <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-amber-50 text-amber-600 rounded-2xl flex items-center justify-center">
               <AlertTriangle size={24} />
             </div>
             <div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Stock Baixo</p>
               <p className="text-2xl font-black text-slate-900">{inventory.filter(i => i.stock <= i.min).length}</p>
             </div>
           </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
           <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-2xl flex items-center justify-center">
               <ArrowUpFromLine size={24} />
             </div>
             <div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Valor em Stock</p>
               <p className="text-2-xl font-black text-slate-900">
                  {inventory.reduce((acc, curr) => acc + (curr.stock * (curr.price || 0)), 0).toLocaleString()} Kz
               </p>
             </div>
           </div>
        </div>
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
           <div className="flex items-center gap-4">
             <div className="w-12 h-12 bg-purple-50 text-purple-600 rounded-2xl flex items-center justify-center">
               <Truck size={24} />
             </div>
             <div>
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Categorias</p>
               <p className="text-2xl font-black text-slate-900">{Array.from(new Set(inventory.map(i => i.category))).length}</p>
             </div>
           </div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between bg-slate-50/50 gap-4">
           <div className="flex items-center gap-4">
              <h3 className="text-sm font-black text-slate-900 uppercase">Inventário de Peças</h3>
           </div>
           <div className="relative">
             <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
             <input 
              type="text" 
              placeholder="Pesquisar peça..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 pr-4 py-2 bg-white border border-slate-200 rounded-lg text-xs outline-none focus:border-brand-primary w-full md:w-64" 
             />
           </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
             <thead>
                <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-widest border-b border-slate-100">
                   <th className="px-6 py-4">Material</th>
                   <th className="px-6 py-4">Categoria</th>
                   <th className="px-6 py-4 text-center">Stock Atual</th>
                   <th className="px-6 py-4 text-center">Mínimo</th>
                   <th className="px-6 py-4">Status</th>
                   <th className="px-6 py-4 text-right">Acções</th>
                </tr>
             </thead>
             <tbody className="divide-y divide-slate-50">
                {filteredInventory.map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4 text-xs font-black text-slate-900">
                       <span className="text-brand-primary">{item.id.slice(-4).toUpperCase()}</span> • {item.name}
                    </td>
                    <td className="px-6 py-4">
                       <span className="px-2 py-1 bg-slate-100 text-slate-500 rounded text-[10px] font-black uppercase tracking-tight">{item.category}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                       <div className="text-xs font-black text-slate-800">{item.stock} {item.unit}</div>
                    </td>
                    <td className="px-6 py-4 text-center">
                       <div className="text-xs font-bold text-slate-400">{item.min} {item.unit}</div>
                    </td>
                    <td className="px-6 py-4">
                       {item.stock <= item.min ? (
                         <span className="flex items-center gap-1.5 text-amber-600 text-[10px] font-black uppercase tracking-tighter">
                            <AlertTriangle size={12} />
                            Reposição
                         </span>
                       ) : (
                         <span className="text-emerald-500 text-[10px] font-black uppercase tracking-tighter">Stock OK</span>
                       )}
                    </td>
                    <td className="px-6 py-4 text-right">
                       <div className="flex justify-end gap-2">
                         {canModify && (
                           <>
                             <button 
                              onClick={() => {
                                setSelectedItem(item);
                                setFormData({
                                  name: item.name,
                                  category: item.category,
                                  stock: item.stock,
                                  min: item.min,
                                  unit: item.unit,
                                  price: item.price || 0
                                });
                                setModalType('edit');
                                setIsModalOpen(true);
                              }}
                              className="p-1.5 text-slate-300 hover:text-brand-primary transition-colors"
                              title="Editar"
                             >
                                <Settings size={14} />
                             </button>
                             <button 
                              onClick={async () => {
                                if (window.confirm("Tem certeza que deseja excluir este item?")) {
                                  try {
                                    await deleteDoc(doc(db, 'warehouse_inventory', item.id));
                                  } catch(e) { 
                                    handleFirestoreError(e, OperationType.DELETE, `warehouse_inventory/${item.id}`);
                                  }
                                }
                              }}
                              className="p-1.5 text-slate-300 hover:text-rose-600 transition-colors"
                              title="Excluir"
                             >
                                <Trash2 size={14} />
                             </button>
                           </>
                         )}
                       </div>
                    </td>
                  </tr>
                ))}
                {filteredInventory.length === 0 && !loading && (
                  <tr>
                    <td colSpan={6} className="py-20 text-center text-slate-400 italic text-xs uppercase font-black tracking-widest opacity-30">
                      Nenhum item em stock
                    </td>
                  </tr>
                )}
             </tbody>
          </table>
        </div>
      </div>

      {/* Modal */}
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
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative bg-white rounded-2xl w-full max-w-md shadow-2xl overflow-hidden"
            >
              <div className="px-6 py-4 bg-slate-900 text-white flex items-center justify-between">
                <h3 className="text-sm font-black uppercase italic tracking-widest">
                  {modalType === 'add' ? 'Nova Peça em Stock' : modalType === 'edit' ? 'Editar Peça' : modalType === 'entry' ? 'Entrada de Material' : 'Saída de Material'}
                </h3>
                <button onClick={() => setIsModalOpen(false)} className="hover:bg-white/10 p-1 rounded-lg">
                  <X size={18} />
                </button>
              </div>

              <form onSubmit={handleSubmit} className="p-6 space-y-4">
                {modalType === 'entry' || modalType === 'output' ? (
                  <>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Material</label>
                      <select 
                        required
                        value={entryData.itemId}
                        onChange={(e) => setEntryData({...entryData, itemId: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:border-brand-primary outline-none"
                      >
                        <option value="">Seleccione o item...</option>
                        {inventory.map(i => (
                          <option key={i.id} value={i.id}>{i.name} (Saldo: {i.stock})</option>
                        ))}
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        {modalType === 'entry' ? 'Quantidade de Entrada' : 'Quantidade de Saída'}
                      </label>
                      <input 
                        required
                        type="number"
                        min="1"
                        value={entryData.quantity}
                        onChange={(e) => setEntryData({...entryData, quantity: Number(e.target.value)})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:border-brand-primary outline-none"
                      />
                    </div>
                    {modalType === 'output' && (
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Viatura Vinculada (Opcional)</label>
                        <select 
                          value={entryData.vehicleId}
                          onChange={(e) => setEntryData({...entryData, vehicleId: e.target.value})}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:border-brand-primary outline-none"
                        >
                          <option value="">Nenhuma / Stock Geral</option>
                          {vehicles.map(v => (
                            <option key={v.id} value={v.id}>{v.prefix} - {v.name}</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </>
                ) : (
                  <>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Nome do Material</label>
                      <input 
                        required
                        type="text"
                        value={formData.name}
                        onChange={(e) => setFormData({...formData, name: e.target.value})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:border-brand-primary outline-none"
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Categoria</label>
                        <select 
                          value={formData.category}
                          onChange={(e) => setFormData({...formData, category: e.target.value})}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:border-brand-primary outline-none"
                        >
                          <option value="Mecânica">Mecânica</option>
                          <option value="Lubrificantes">Lubrificantes</option>
                          <option value="Filtros">Filtros</option>
                          <option value="Elétrica">Elétrica</option>
                          <option value="Pneus">Pneus</option>
                          <option value="Outros">Outros</option>
                        </select>
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Unidade</label>
                        <input 
                          type="text"
                          value={formData.unit}
                          onChange={(e) => setFormData({...formData, unit: e.target.value})}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:border-brand-primary outline-none"
                        />
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Stock Inicial</label>
                        <input 
                          type="number"
                          value={formData.stock}
                          onChange={(e) => setFormData({...formData, stock: Number(e.target.value)})}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:border-brand-primary outline-none"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Mínimo Segurança</label>
                        <input 
                          type="number"
                          value={formData.min}
                          onChange={(e) => setFormData({...formData, min: Number(e.target.value)})}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:border-brand-primary outline-none"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Preço Unitário (Kz)</label>
                      <input 
                        type="number"
                        value={formData.price}
                        onChange={(e) => setFormData({...formData, price: Number(e.target.value)})}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold focus:border-brand-primary outline-none"
                      />
                    </div>
                  </>
                )}
                <button 
                  type="submit"
                  className="w-full bg-brand-primary text-white py-4 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-brand-secondary transition-all shadow-xl shadow-brand-primary/20"
                >
                  Confirmar Acção
                </button>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
