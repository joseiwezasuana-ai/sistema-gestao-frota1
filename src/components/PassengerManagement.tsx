import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, limit, where } from 'firebase/firestore';
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
  Clock 
} from 'lucide-react';

export default function PassengerManagement({ user }: { user: any }) {
  const [passengers, setPassengers] = useState<any[]>([]);
  const [activeCalls, setActiveCalls] = useState<any[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [allCalls, setAllCalls] = useState<any[]>([]);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [callSearchTerm, setCallSearchTerm] = useState('');
  const [passengerSearchTerm, setPassengerSearchTerm] = useState('');

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
    return (
      (p.name || '').toLowerCase().includes(term) ||
      (p.phone || '').toLowerCase().includes(term) ||
      (p.province || '').toLowerCase().includes(term)
    );
  });

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
                        className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer transition-colors" 
                        onClick={() => setExpandedRow(expandedRow === p.id ? null : p.id)}
                      >
                        <td className="p-3 font-bold text-slate-900 dark:text-white">{p.name || 'Anónimo'}</td>
                        <td className="p-3 text-slate-600 dark:text-slate-300">{p.province || 'Moxico'}</td>
                        <td className="p-3 text-right">
                          {expandedRow === p.id ? <ChevronUp size={16} className="inline text-slate-500" /> : <ChevronDown size={16} className="inline text-slate-500" />}
                        </td>
                      </tr>
                      {expandedRow === p.id && (
                        <tr>
                          <td colSpan={3} className="p-4 bg-slate-50 dark:bg-slate-850 rounded-xl">
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs text-slate-600 dark:text-slate-300 leading-relaxed font-semibold">
                              <div><span className="font-black uppercase text-[10px] text-slate-400 block mb-0.5">Telemóvel</span> {p.phone || 'N/A'}</div>
                              <div><span className="font-black uppercase text-[10px] text-slate-400 block mb-0.5">Idade</span> {p.age || 'N/A'} anos</div>
                              <div className="sm:col-span-2"><span className="font-black uppercase text-[10px] text-slate-400 block mb-0.5">Data de Registo</span> {p.createdAt ? new Date(p.createdAt.toDate()).toLocaleDateString('pt-PT') : 'N/A'}</div>
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
