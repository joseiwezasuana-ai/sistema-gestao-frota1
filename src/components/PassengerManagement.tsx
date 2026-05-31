import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, limit, where, doc, updateDoc, deleteDoc } from 'firebase/firestore';
import { 
  Users, 
  AlertCircle, 
  TrendingUp, 
  Car, 
  ChevronDown, 
  ChevronUp, 
  PhoneCall, 
  Search, 
  Calendar, 
  MapPin, 
  DollarSign, 
  Clock,
  AlertOctagon,
  ShieldAlert,
  Trash2
} from 'lucide-react';

export default function PassengerManagement({ user }: { user: any }) {
  const [passengers, setPassengers] = useState<any[]>([]);
  const [activeCalls, setActiveCalls] = useState<any[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [allCalls, setAllCalls] = useState<any[]>([]);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [callSearchTerm, setCallSearchTerm] = useState('');
  const [passengerSearchTerm, setPassengerSearchTerm] = useState('');

  const handleToggleBan = async (p: any) => {
    const nextBanned = !p.banned;
    const confirmMsg = nextBanned 
      ? `Tem a certeza que deseja BANIR PARA SEMPRE o passageiro "${p.name || 'Anónimo'}"? Ele perderá imediatamente o acesso ao ecossistema de táxis públicos.`
      : `Deseja reativar/desbanir o passageiro "${p.name || 'Anónimo'}"?`;
      
    if (window.confirm(confirmMsg)) {
      try {
        await updateDoc(doc(db, 'passengers', p.id), { banned: nextBanned });
        alert(`Passageiro ${nextBanned ? 'bannido com sucesso' : 'reativado com sucesso'}!`);
      } catch (err) {
        console.error("Erro ao banir/reativar passageiro:", err);
        alert("Ocorreu um erro ao atualizar o estado do passageiro.");
      }
    }
  };

  const handleDeletePassenger = async (p: any) => {
    const confirmMsg = `Tem a certeza absoluta que deseja ELIMINAR permanentemente o perfil de "${p.name || 'Anónimo'}"? Esta ação não pode ser desfeita.`;
    if (window.confirm(confirmMsg)) {
      try {
        await deleteDoc(doc(db, 'passengers', p.id));
        alert("Perfil de passageiro eliminado com sucesso!");
        if (expandedRow === p.id) {
          setExpandedRow(null);
        }
      } catch (err) {
        console.error("Erro ao eliminar passageiro:", err);
        alert("Ocorreu um erro ao eliminar o perfil.");
      }
    }
  };

  useEffect(() => {
    const qPassengers = query(collection(db, 'passengers'), limit(100));
    const qCalls = query(collection(db, 'calls'), where('status', 'in', ['pending', 'confirmed', 'active']), limit(20));
    const qComplaints = query(collection(db, 'complaints'), orderBy('createdAt', 'desc'), limit(15));
    
    // We listen to calls and sort locally to avoid missing query index crashes
    const qAllCalls = query(collection(db, 'calls'), limit(100));

    const unsubP = onSnapshot(qPassengers, (snap) => setPassengers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    const unsubC = onSnapshot(qCalls, (snap) => setActiveCalls(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    const unsubComplaints = onSnapshot(qComplaints, (snap) => setComplaints(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    
    const unsubAllCalls = onSnapshot(qAllCalls, (snap) => {
      const callsList = snap.docs.map(doc => {
        const data = doc.data();
        return { id: doc.id, ...data };
      });
      // Sort locally: newest first
      callsList.sort((a: any, b: any) => {
        const dateA = a.timestamp?.seconds ? a.timestamp.seconds * 1000 : (a.timestamp ? new Date(a.timestamp).getTime() : 0);
        const dateB = b.timestamp?.seconds ? b.timestamp.seconds * 1000 : (b.timestamp ? new Date(b.timestamp).getTime() : 0);
        return dateB - dateA;
      });
      setAllCalls(callsList);
    });

    return () => { 
      unsubP(); 
      unsubC(); 
      unsubComplaints(); 
      unsubAllCalls(); 
    };
  }, []);

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pending':
        return <span className="bg-amber-100 text-amber-800 dark:bg-amber-950/40 dark:text-amber-400 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider animate-pulse">A Chamar</span>;
      case 'price_sent':
        return <span className="bg-yellow-100 text-yellow-800 dark:bg-yellow-950/40 dark:text-yellow-400 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">Proposta</span>;
      case 'confirmed':
        return <span className="bg-blue-100 text-blue-800 dark:bg-blue-950/40 dark:text-blue-400 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">Confirmado</span>;
      case 'active':
        return <span className="bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-400 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider animate-pulse">Em Curso</span>;
      case 'completed':
        return <span className="bg-green-100 text-green-800 dark:bg-green-950/40 dark:text-green-400 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">Concluída</span>;
      case 'cancelled':
        return <span className="bg-slate-100 text-slate-800 dark:bg-slate-800 dark:text-slate-400 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">Cancelada</span>;
      default:
        return <span className="bg-red-100 text-red-800 dark:bg-rose-950/40 dark:text-rose-450 px-2.5 py-1 rounded-full text-[10px] font-black uppercase tracking-wider">Recusada</span>;
    }
  };

  const getFormatDate = (item: any) => {
    if (!item?.timestamp) return 'Agora mesmo';
    const d = item.timestamp?.seconds ? new Date(item.timestamp.seconds * 1000) : new Date(item.timestamp);
    return d.toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });
  };

  const filteredCalls = allCalls.filter((c: any) => {
    const term = callSearchTerm.toLowerCase();
    return (
      (c.clientName || c.passengerName || '').toLowerCase().includes(term) ||
      (c.phone || c.clientPhone || '').toLowerCase().includes(term) ||
      (c.driverName || '').toLowerCase().includes(term) ||
      (c.pickup || c.pickupAddress || '').toLowerCase().includes(term) ||
      (c.destination || c.destinationAddress || '').toLowerCase().includes(term)
    );
  });

  const filteredPassengers = passengers.filter((p: any) => {
    const term = passengerSearchTerm.toLowerCase();
    const phoneVal = p.backupPhone || p.phone || '';
    return (
      (p.name || '').toLowerCase().includes(term) ||
      phoneVal.toLowerCase().includes(term) ||
      (p.province || '').toLowerCase().includes(term)
    );
  });

  // Grouping calls by driver to calculate metrics, routes, and performance
  const driverPerformance = React.useMemo(() => {
    const driverMap: Record<string, {
      name: string;
      totalTrips: number;
      completedTrips: number;
      totalRevenue: number;
      routes: Record<string, number>;
      ratings: number[];
    }> = {};

    allCalls.forEach((c: any) => {
      const driverName = c.driverName || 'Sem Atribuição / Outros';
      const driverKey = c.driverId || driverName;

      if (!driverMap[driverKey]) {
        driverMap[driverKey] = {
          name: driverName,
          totalTrips: 0,
          completedTrips: 0,
          totalRevenue: 0,
          routes: {},
          ratings: []
        };
      }

      driverMap[driverKey].totalTrips += 1;
      
      const isCompleted = c.status === 'completed';
      if (isCompleted) {
        driverMap[driverKey].completedTrips += 1;
        const tripPrice = Number(c.price || c.finalPrice || 0);
        driverMap[driverKey].totalRevenue += tripPrice;
      }

      // Track routes
      const pickup = (c.pickup || c.pickupAddress || 'Desconhecido').split(',')[0].trim();
      const dest = (c.destination || c.destinationAddress || 'Desconhecido').split(',')[0].trim();
      if (pickup !== 'Desconhecido' && dest !== 'Desconhecido') {
         const routeKey = `${pickup} ➔ ${dest}`;
         driverMap[driverKey].routes[routeKey] = (driverMap[driverKey].routes[routeKey] || 0) + 1;
      }

      if (c.rating !== undefined && c.rating !== null) {
        driverMap[driverKey].ratings.push(Number(c.rating));
      }
    });

    return Object.values(driverMap).map(driver => {
      // Find top route
      let topRoute = 'N/A';
      let maxRouteCount = 0;
      Object.entries(driver.routes).forEach(([route, count]) => {
        if (count > maxRouteCount) {
          maxRouteCount = count;
          topRoute = route;
        }
      });

      // Calculate avg rating
      const avgRating = driver.ratings.length > 0 
        ? (driver.ratings.reduce((sum, val) => sum + val, 0) / driver.ratings.length).toFixed(1)
        : null;

      return {
        ...driver,
        topRoute,
        topRouteCount: maxRouteCount,
        avgRating
      };
    }).sort((a, b) => b.totalRevenue - a.totalRevenue); // Sort by highest revenue
  }, [allCalls]);

  return (
    <div className="space-y-6">
      {/* High Density Metric Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <Users className="text-brand-primary animate-pulse" size={24} />
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tighter">Total Passageiros</h3>
          </div>
          <p className="text-4xl font-black text-slate-900 dark:text-white">{passengers.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <Car className="text-emerald-500 animate-pulse" size={24} />
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tighter">Viagens Ativas</h3>
          </div>
          <p className="text-4xl font-black text-slate-900 dark:text-white">{activeCalls.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <AlertCircle className="text-rose-500 animate-pulse" size={24} />
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tighter">Últimas Reclamações</h3>
          </div>
          <p className="text-4xl font-black text-slate-900 dark:text-white">{complaints.length}</p>
        </div>
      </div>

      {/* Driver Performance & Top Routes Section (Resumo das Rendas e Trajetos via App por Motorista) */}
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/5 p-6 shadow-sm">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-slate-100 dark:border-slate-800 pb-4 mb-4">
          <div className="flex items-center gap-2">
            <div className="bg-emerald-500/10 text-emerald-500 p-2 rounded-xl">
              <TrendingUp size={20} className="animate-pulse" />
            </div>
            <div>
              <h3 className="text-md font-black text-slate-905 dark:text-white uppercase tracking-tighter">Desempenho & Rendas por Motorista (Resumo de Trajetos App)</h3>
              <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-0.5">Operações de Passageiros via Aplicação • PSM COMERCIAL</p>
            </div>
          </div>
          <div className="self-start sm:self-center bg-emerald-50 dark:bg-emerald-950/30 text-emerald-600 dark:text-emerald-400 px-3 py-1 rounded-xl text-[10px] font-black uppercase tracking-wider">
            Ordenado por Renda Gerada
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="text-slate-400 uppercase font-black text-[10px] tracking-wider border-b border-slate-100 dark:border-slate-800">
              <tr>
                <th className="py-3 px-4">Motorista</th>
                <th className="py-3 px-4 text-center">Corridas Concluídas / Total</th>
                <th className="py-3 px-4">Rota / Trajeto Mais Frequente</th>
                <th className="py-3 px-4 text-right">Renda Total App (Kz)</th>
                <th className="py-3 px-4 text-right">Avaliação Média</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {driverPerformance.length === 0 ? (
                <tr>
                  <td colSpan={5} className="py-8 text-center text-slate-400 font-medium">
                    Sem dados operacionais de faturamento ou trajetos registados para motoristas.
                  </td>
                </tr>
              ) : (
                driverPerformance.map((dp) => (
                  <tr key={dp.name} className="hover:bg-slate-50 dark:hover:bg-slate-800/45 transition-colors">
                    <td className="py-3.5 px-4 font-black text-slate-800 dark:text-white flex items-center gap-2">
                      <div className="w-2 h-2 rounded-full bg-brand-primary" />
                      {dp.name}
                    </td>
                    <td className="py-3.5 px-4 text-center">
                      <div className="inline-flex items-center gap-1.5 px-2.5 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-100 dark:border-white/5 rounded-lg text-slate-700 dark:text-slate-300 font-bold">
                        <span className="text-emerald-500 font-black">{dp.completedTrips}</span>
                        <span className="text-[10px] opacity-40">/</span>
                        <span className="opacity-60">{dp.totalTrips}</span>
                      </div>
                    </td>
                    <td className="py-3.5 px-4">
                      {dp.topRoute !== 'N/A' ? (
                        <div className="flex items-center gap-1.5">
                          <MapPin size={11} className="text-rose-500 flex-shrink-0" />
                          <span className="font-bold text-slate-705 dark:text-slate-300 truncate max-w-[200px]" title={dp.topRoute}>
                            {dp.topRoute}
                          </span>
                          <span className="text-[9px] px-1.5 py-0.5 bg-slate-100 dark:bg-slate-800/80 rounded font-black text-slate-500">
                            {dp.topRouteCount}x
                          </span>
                        </div>
                      ) : (
                        <span className="text-slate-400 italic">Sem rotas</span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      <span className="text-[13px] font-black italic text-emerald-600 dark:text-emerald-400">
                        {dp.totalRevenue.toLocaleString('pt-PT')} <span className="text-[9px] font-bold not-italic text-slate-400">Kz</span>
                      </span>
                    </td>
                    <td className="py-3.5 px-4 text-right">
                      {dp.avgRating ? (
                        <div className="inline-flex items-center gap-1 font-black text-amber-500">
                          <span>★</span>
                          <span>{dp.avgRating}</span>
                        </div>
                      ) : (
                        <span className="text-slate-450 italic text-[10px]">Sem notas</span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Main Grid: Passengers on Left, All Calls on Right */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        
        {/* Recent Passengers list (Left 5 cols) */}
        <div className="lg:col-span-5 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/5 p-6 shadow-sm flex flex-col space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h3 className="text-md font-black text-slate-900 dark:text-white uppercase tracking-tighter">Passageiros Recentes</h3>
            
            {/* Search filter */}
            <div className="relative">
              <input 
                type="text" 
                placeholder="Pesquisar..." 
                value={passengerSearchTerm}
                onChange={(e) => setPassengerSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-xl text-xs text-slate-800 dark:text-slate-100"
              />
              <Search size={14} className="absolute left-2.5 top-2 text-slate-400" />
            </div>
          </div>

          <div className="overflow-y-auto max-h-[500px]">
            <table className="w-full text-xs text-left">
              <thead className="text-slate-500 uppercase sticky top-0 bg-white dark:bg-slate-900 z-10 border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="p-3">Nome</th>
                  <th className="p-3">Província</th>
                  <th className="p-3 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredPassengers.length === 0 ? (
                  <tr>
                    <td colSpan={3} className="p-4 text-center text-slate-400">Nenhum passageiro encontrado.</td>
                  </tr>
                ) : (
                  filteredPassengers.map(p => (
                    <React.Fragment key={p.id}>
                      <tr 
                        className={`hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors ${p.banned ? 'bg-red-50/40 dark:bg-red-950/10' : ''}`} 
                        onClick={() => setExpandedRow(expandedRow === p.id ? null : p.id)}
                      >
                        <td className="p-3 font-bold text-slate-900 dark:text-white flex items-center gap-2">
                          <span className="truncate">{p.name || 'Anónimo'}</span>
                          {p.banned && (
                            <span className="bg-red-100 text-red-800 dark:bg-rose-950/60 dark:text-rose-400 px-2 py-0.5 rounded text-[8.5px] font-black uppercase tracking-tight flex items-center gap-1 shrink-0 animate-pulse border border-red-200 dark:border-red-950/40">
                              <AlertOctagon size={10} /> BANIDO
                            </span>
                          )}
                        </td>
                        <td className="p-3 text-slate-600 dark:text-slate-300">{p.province || 'Moxico'}</td>
                        <td className="p-3 text-right flex items-center justify-end gap-1.5">
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleToggleBan(p);
                            }}
                            className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                              p.banned 
                                ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                                : 'bg-rose-600 hover:bg-rose-700 text-white shadow-sm'
                            }`}
                          >
                            {p.banned ? 'Reativar' : 'Banir'}
                          </button>
                          <button 
                            onClick={(e) => {
                              e.stopPropagation();
                              handleDeletePassenger(p);
                            }}
                            className="px-2 py-0.5 bg-rose-700 hover:bg-rose-800 text-white rounded text-[9px] font-black uppercase tracking-wider transition-all cursor-pointer flex items-center gap-0.5"
                            title="Eliminar Perfil de Passageiro"
                          >
                            <Trash2 size={10} />
                          </button>
                          {expandedRow === p.id ? <ChevronUp size={16} className="inline text-slate-500" /> : <ChevronDown size={16} className="inline text-slate-500" />}
                        </td>
                      </tr>
                      {expandedRow === p.id && (
                        <tr>
                          <td colSpan={3} className="p-4 bg-slate-50 dark:bg-slate-850 rounded-xl">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-xs text-slate-600 dark:text-slate-300 font-semibold mb-3">
                              <div><span className="font-black uppercase text-[10px] text-slate-400 block mb-0.5">Telemóvel</span> {p.backupPhone || p.phone || 'N/A'}</div>
                              <div><span className="font-black uppercase text-[10px] text-slate-400 block mb-0.5">Idade</span> {p.age || 'N/A'} anos</div>
                              <div className="sm:col-span-2"><span className="font-black uppercase text-[10px] text-slate-400 block mb-0.5">Data de Registo</span> {p.createdAt ? (p.createdAt.seconds ? new Date(p.createdAt.seconds * 1000).toLocaleDateString('pt-PT') : new Date(p.createdAt).toLocaleDateString('pt-PT')) : 'N/A'}</div>
                            </div>
                            
                            <div className="border-t border-slate-200/55 dark:border-white/5 pt-3 flex flex-wrap gap-2">
                              <button
                                onClick={() => handleToggleBan(p)}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer ${
                                  p.banned 
                                    ? 'bg-emerald-600 hover:bg-emerald-700 text-white' 
                                    : 'bg-rose-600 hover:bg-rose-700 text-white shadow-md shadow-rose-650/10'
                                }`}
                              >
                                <AlertOctagon size={12} />
                                {p.banned ? '✅ Reativar / Desbanir' : '🚫 Banir Para Sempre'}
                              </button>

                              <button
                                onClick={() => handleDeletePassenger(p)}
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-red-650 hover:bg-red-750 text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all cursor-pointer shadow-md shadow-red-500/10"
                              >
                                <Trash2 size={12} />
                                🗑️ Eliminar Perfil
                              </button>
                              
                              {(p.backupPhone || p.phone) && (
                                <a
                                  href={`tel:${p.backupPhone || p.phone}`}
                                  className="flex items-center gap-1.5 px-3 py-1.5 bg-slate-200 dark:bg-slate-800 hover:bg-slate-300 dark:hover:bg-slate-700 text-slate-800 dark:text-slate-100 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all"
                                >
                                  <PhoneCall size={12} />
                                  Ligar ao Passageiro
                                </a>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

        {/* Call Logs History (Right 7 cols) */}
        <div className="lg:col-span-7 bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/5 p-6 shadow-sm flex flex-col space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              <div className="bg-brand-primary/10 text-brand-primary p-1.5 rounded-lg">
                <PhoneCall size={16} />
              </div>
              <h3 className="text-md font-black text-slate-900 dark:text-white uppercase tracking-tighter">Registos de Chamadas de Passageiros</h3>
            </div>
            
            {/* Search Filter */}
            <div className="relative">
              <input 
                type="text" 
                placeholder="Pesquisar chamadas..." 
                value={callSearchTerm}
                onChange={(e) => setCallSearchTerm(e.target.value)}
                className="pl-8 pr-3 py-1 bg-slate-50 dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-xl text-xs text-slate-800 dark:text-slate-100 w-full sm:w-48"
              />
              <Search size={14} className="absolute left-2.5 top-2 text-slate-400" />
            </div>
          </div>

          <div className="overflow-x-auto overflow-y-auto max-h-[500px]">
            <table className="w-full text-xs text-left">
              <thead className="text-slate-500 uppercase sticky top-0 bg-white dark:bg-slate-900 z-10 border-b border-slate-100 dark:border-slate-800">
                <tr>
                  <th className="p-3">Data / Hora</th>
                  <th className="p-3">Passageiro / Contacto</th>
                  <th className="p-3">Trajeto</th>
                  <th className="p-3">Motorista</th>
                  <th className="p-3 text-right">Estado / Preço</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                {filteredCalls.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="p-8 text-center text-slate-400">Nenhum registo de chamada efetuada de momento.</td>
                  </tr>
                ) : (
                  filteredCalls.map((c: any) => (
                    <tr key={c.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/50 transition-colors">
                      {/* Date/Time */}
                      <td className="p-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5 text-slate-900 dark:text-white font-bold">
                          <Calendar size={12} className="text-slate-400" />
                          <span>{getFormatDate(c)}</span>
                        </div>
                      </td>
                      {/* Client Info */}
                      <td className="p-3">
                        <div>
                          <p className="font-black text-slate-900 dark:text-white leading-tight">{c.clientName || c.passengerName || 'Contacto Directo'}</p>
                          <p className="text-[10px] text-slate-400 font-semibold">{c.phone || c.clientPhone || 'Sem número'}</p>
                        </div>
                      </td>
                      {/* Route Trajeto */}
                      <td className="p-3 max-w-[150px] truncate">
                        <div className="flex items-center gap-1 text-slate-700 dark:text-slate-300">
                          <MapPin size={11} className="text-rose-500 flex-shrink-0" />
                          <span className="font-bold truncate" title={`${c.pickup || c.pickupAddress} ➔ ${c.destination || c.destinationAddress}`}>
                            {c.pickup || c.pickupAddress || 'N/A'} ➔ {c.destination || c.destinationAddress || 'N/A'}
                          </span>
                        </div>
                      </td>
                      {/* Driver */}
                      <td className="p-3 whitespace-nowrap">
                        {c.driverName ? (
                          <div className="flex items-center gap-1 text-slate-800 dark:text-slate-200 font-bold">
                            <span className="w-1.5 h-1.5 bg-brand-primary rounded-full" />
                            <span>{c.driverName}</span>
                          </div>
                        ) : (
                          <span className="text-slate-400 italic font-medium">A procurar...</span>
                        )}
                      </td>
                      {/* Rating/Price details */}
                      <td className="p-3 text-right">
                        <div className="space-y-1">
                          <div className="flex justify-end">
                            {getStatusBadge(c.status)}
                          </div>
                          {c.price || c.finalPrice ? (
                            <div className="text-[11px] font-black text-brand-primary dark:text-amber-400">
                              {Number(c.price || c.finalPrice).toLocaleString('pt-PT')} Kz
                            </div>
                          ) : (
                            <span className="text-[9px] text-slate-400 font-semibold uppercase">Pendente</span>
                          )}
                          {c.rating !== undefined && c.rating !== null && (
                            <div className="flex items-center justify-end gap-0.5 text-[10px] font-black text-amber-500">
                              <span className="text-[9px]">★</span>
                              <span>{c.rating}/5</span>
                            </div>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>

      </div>
    </div>
  );
}
