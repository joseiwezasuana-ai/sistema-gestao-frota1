import React, { useState, useEffect } from 'react';
import { 
  MapPin, 
  Clock, 
  Navigation, 
  Search, 
  Filter,
  History,
  Activity,
  ArrowRight,
  ChevronRight,
  Shield,
  Truck,
  Loader2
} from 'lucide-react';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  limit, 
  where,
  addDoc,
  serverTimestamp 
} from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { formatSafe } from '../lib/dateUtils';
import { cn } from '../lib/utils';
import { motion, AnimatePresence } from 'motion/react';

export default function GPSTimeline() {
  const [logs, setLogs] = useState<any[]>([]);
  const [drivers, setDrivers] = useState<any[]>([]);
  const [selectedPrefix, setSelectedPrefix] = useState<string>('all');
  const [loading, setLoading] = useState(true);

  const [simulating, setSimulating] = useState(false);

  useEffect(() => {
    // 1. Fetch available drivers for the filter
    const unsubDrivers = onSnapshot(collection(db, 'drivers'), (snapshot) => {
      setDrivers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'drivers'));

    // 2. Fetch GPS logs
    let q = query(collection(db, 'gps_history'), orderBy('timestamp', 'desc'), limit(100));
    
    if (selectedPrefix !== 'all') {
      q = query(
        collection(db, 'gps_history'), 
        where('prefix', '==', selectedPrefix),
        orderBy('timestamp', 'desc'), 
        limit(100)
      );
    }

    const unsubLogs = onSnapshot(q, (snapshot) => {
      setLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'gps_history'));

    return () => {
      unsubDrivers();
      unsubLogs();
    };
  }, [selectedPrefix]);

  const simulateGPS = async () => {
    const activeDrivers = drivers.filter(d => d.prefix);
    if (activeDrivers.length === 0) {
      alert("Nenhuma viatura cadastrada no sistema. Por favor, adicione viaturas na seção 'Frota & Números' primeiro.");
      return;
    }

    setSimulating(true);
    try {
      for (const d of activeDrivers) {
        // Simulate random point near Luena (-11.7833, 19.9167)
        const lat = -11.7833 + (Math.random() - 0.5) * 0.05;
        const lng = 19.9167 + (Math.random() - 0.5) * 0.05;
        const speed = Math.floor(Math.random() * 60);

        await addDoc(collection(db, 'gps_history'), {
          driverId: d.id,
          prefix: d.prefix,
          lat,
          lng,
          speed,
          timestamp: new Date().toISOString()
        });
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, 'gps_history');
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="bg-white px-6 py-4 rounded-xl border border-slate-200 shadow-sm flex items-center justify-between">
        <div>
          <h2 className="text-xl font-black text-slate-900 tracking-tight uppercase">Linha Cronológica GPS</h2>
          <p className="text-xs text-slate-500 font-medium">Monitoramento histórico de rota e velocidade da frota</p>
        </div>
        
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 bg-slate-50 px-3 py-2 rounded-lg border border-slate-200">
            <Filter size={14} className="text-slate-400" />
            <select 
              className="bg-transparent text-xs font-bold text-slate-700 outline-none pr-4"
              value={selectedPrefix}
              onChange={(e) => setSelectedPrefix(e.target.value)}
            >
              <option value="all">Todas as Viaturas</option>
              {drivers.map(d => (
                <option key={d.id} value={d.prefix}>Viatura {d.prefix}</option>
              ))}
            </select>
          </div>

          <button 
            onClick={simulateGPS}
            disabled={simulating}
            className="flex items-center gap-2 px-4 py-2 bg-brand-primary text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-brand-secondary transition-all shadow-lg shadow-brand-primary/20 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {simulating ? <Loader2 size={14} className="animate-spin" /> : <Activity size={14} />}
            {simulating ? 'Simulando...' : 'Simular GPS Live'}
          </button>

          <button 
            onClick={async () => {
              if (window.confirm("Tem certeza que deseja apagar todo o histórico GPS?")) {
                try {
                  const itemsToDelete = logs.map(l => l.id);
                  // Since we only have client-side access, we delete the ones we see
                  // In a real app we'd use a cloud function or batch delete
                  for (const id of itemsToDelete) {
                    const { doc, deleteDoc } = await import('firebase/firestore');
                    await deleteDoc(doc(db, 'gps_history', id));
                  }
                  alert("Histórico limpo com sucesso.");
                } catch (error) {
                  handleFirestoreError(error, OperationType.WRITE, 'gps_history');
                }
              }
            }}
            className="flex items-center gap-2 px-4 py-2 bg-red-600 text-white text-[10px] font-black uppercase tracking-widest rounded-lg hover:bg-red-700 transition-all shadow-lg shadow-red-600/20"
          >
            <History size={14} />
            Limpar Histórico
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Stats Section */}
        <div className="lg:col-span-1 space-y-6">
           <div className="bg-white p-6 rounded-xl border border-slate-200 shadow-sm relative overflow-hidden">
              <div className="relative z-10">
                <h3 className="text-xs font-black text-slate-400 uppercase tracking-widest mb-4">Resumo do Período</h3>
                <div className="space-y-4">
                  <div className="flex justify-between items-end border-b border-slate-50 pb-2">
                     <span className="text-[11px] font-bold text-slate-500">Eventos Totais</span>
                     <span className="text-xl font-black text-brand-primary">{logs.length}</span>
                  </div>
                  <div className="flex justify-between items-end border-b border-slate-50 pb-2">
                     <span className="text-[11px] font-bold text-slate-500">Média de Velocidade</span>
                     <span className="text-xl font-black text-slate-800">
                       {logs.length > 0 ? Math.round(logs.reduce((acc, curr) => acc + (curr.speed || 0), 0) / logs.length) : 0} km/h
                     </span>
                  </div>
                  <div className="flex justify-between items-end">
                     <span className="text-[11px] font-bold text-slate-500">Viaturas Monitoradas</span>
                     <span className="text-xl font-black text-slate-800">{new Set(logs.map(l => l.prefix)).size}</span>
                  </div>
                </div>
              </div>
              <Activity className="absolute -bottom-4 -right-4 text-brand-primary opacity-5" size={140} />
           </div>

           <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
              <div className="px-5 py-4 border-b border-slate-200 bg-slate-50">
                <h3 className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Avisos de Segurança</h3>
              </div>
              <div className="p-4 space-y-3">
                 {logs.filter(l => l.speed > 50).slice(0, 3).map((log, i) => (
                   <div key={i} className="p-3 bg-red-50 border-l-4 border-red-500 rounded text-red-900">
                      <p className="text-[11px] font-black uppercase mb-1 flex items-center gap-2">
                        <Navigation size={12} /> Alta Velocidade detectada
                      </p>
                      <p className="text-[10px] font-medium">Viatura {log.prefix} em {log.speed}km/h às {formatSafe(log.timestamp, 'HH:mm')}</p>
                   </div>
                 ))}
                 {logs.filter(l => l.speed > 50).length === 0 && (
                   <div className="p-3 bg-green-50 border-l-4 border-green-500 rounded text-green-900">
                      <p className="text-[11px] font-black uppercase flex items-center gap-2">
                        <Shield size={12} /> Sem infrações
                      </p>
                      <p className="text-[10px] font-medium">Todos os condutores dentro do limite planeado.</p>
                   </div>
                 )}
              </div>
           </div>
        </div>

        {/* Timeline Section */}
        <div className="lg:col-span-2 space-y-4">
           {logs.length === 0 && !loading ? (
             <div className="bg-white p-20 rounded-xl border border-slate-200 text-center">
                <History className="mx-auto text-slate-200 mb-4" size={64} />
                <p className="font-bold text-slate-400 uppercase tracking-widest text-sm">Nenhum histórico GPS registrado</p>
                <p className="text-xs text-slate-400 mt-2">Use o botão "Simular GPS" para gerar dados de exemplo.</p>
             </div>
           ) : (
             <div className="relative">
                {/* Vertical Line */}
                <div className="absolute left-[20px] top-4 bottom-4 w-0.5 bg-slate-200 border-dashed" />
                
                <div className="space-y-4">
                  {logs.map((log, i) => (
                    <motion.div 
                      key={log.id}
                      initial={{ opacity: 0, x: 20 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: i * 0.05 }}
                      className="relative pl-12"
                    >
                      {/* Timeline Dot */}
                      <div className={cn(
                        "absolute left-[13px] top-3 w-4 h-4 rounded-full border-2 border-white shadow-sm z-10 transition-colors",
                        log.speed > 40 ? "bg-red-500 animate-pulse" : 
                        log.speed > 20 ? "bg-amber-500" : "bg-green-500"
                      )} />

                      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm hover:border-brand-primary/30 transition-all flex items-center justify-between group">
                        <div className="flex items-center gap-4">
                          <div className="bg-slate-50 p-3 rounded-lg text-slate-400 group-hover:text-brand-primary transition-colors">
                             <Truck size={20} />
                          </div>
                          <div>
                            <div className="flex items-center gap-2 mb-1">
                               <span className="text-[11px] font-black text-brand-primary bg-brand-light px-1.5 py-0.5 rounded tracking-widest border border-brand-primary/10 uppercase">
                                 Viatura {log.prefix}
                               </span>
                               <span className="text-[10px] font-bold text-slate-400 flex items-center gap-1">
                                 <Clock size={10} /> {formatSafe(log.timestamp, 'HH:mm:ss', '--:--')}
                               </span>
                            </div>
                            <p className="text-sm font-bold text-slate-900">
                               Coordenadas: <span className="font-mono text-slate-500">{log.lat?.toFixed(5)}, {log.lng?.toFixed(5)}</span>
                            </p>
                          </div>
                        </div>

                        <div className="flex flex-col items-end">
                           <div className="flex items-center gap-2">
                             <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">Velocity</span>
                             <span className={cn(
                               "text-lg font-black",
                               log.speed > 40 ? "text-red-600" : "text-slate-800"
                             )}>{log.speed || 0} km/h</span>
                           </div>
                           <button className="flex items-center gap-1 text-[9px] font-bold text-brand-primary mt-1 uppercase hover:underline">
                             Ver no Mapa <ChevronRight size={10} />
                           </button>
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
             </div>
           )}
        </div>
      </div>
    </div>
  );
}
