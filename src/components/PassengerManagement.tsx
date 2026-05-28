import React, { useState, useEffect } from 'react';
import { db } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, limit, where } from 'firebase/firestore';
import { Users, AlertCircle, TrendingUp, Car, ChevronDown, ChevronUp } from 'lucide-react';

export default function PassengerManagement({ user }: { user: any }) {
  const [passengers, setPassengers] = useState<any[]>([]);
  const [activeCalls, setActiveCalls] = useState<any[]>([]);
  const [complaints, setComplaints] = useState<any[]>([]);
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  useEffect(() => {
    const qPassengers = query(collection(db, 'passengers'), limit(50));
    const qCalls = query(collection(db, 'calls'), where('status', 'in', ['pending', 'confirmed', 'active']), limit(20));
    const qComplaints = query(collection(db, 'complaints'), orderBy('createdAt', 'desc'), limit(10));

    const unsubP = onSnapshot(qPassengers, (snap) => setPassengers(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    const unsubC = onSnapshot(qCalls, (snap) => setActiveCalls(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));
    const unsubComplaints = onSnapshot(qComplaints, (snap) => setComplaints(snap.docs.map(doc => ({ id: doc.id, ...doc.data() }))));

    return () => { unsubP(); unsubC(); unsubComplaints(); };
  }, []);

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <Users className="text-brand-primary" size={24} />
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tighter">Total Passageiros</h3>
          </div>
          <p className="text-4xl font-black text-slate-900 dark:text-white">{passengers.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <Car className="text-emerald-500" size={24} />
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tighter">Viagens Ativas</h3>
          </div>
          <p className="text-4xl font-black text-slate-900 dark:text-white">{activeCalls.length}</p>
        </div>
        <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-white/5 shadow-sm">
          <div className="flex items-center gap-3 mb-2">
            <AlertCircle className="text-rose-500" size={24} />
            <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tighter">Últimas Reclamações</h3>
          </div>
          <p className="text-4xl font-black text-slate-900 dark:text-white">{complaints.length}</p>
        </div>
      </div>

      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-white/5 p-6 shadow-sm">
        <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tighter mb-4">Passageiros Recentes</h3>
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="text-slate-500 uppercase">
              <tr>
                <th className="p-3">Nome</th>
                <th className="p-3">Idade</th>
                <th className="p-3">Província</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
              {passengers.map(p => (
                <React.Fragment key={p.id}>
                  <tr className="hover:bg-slate-50 dark:hover:bg-slate-800/50 cursor-pointer" onClick={() => setExpandedRow(expandedRow === p.id ? null : p.id)}>
                    <td className="p-3 font-bold">{p.name}</td>
                    <td className="p-3">{p.age}</td>
                    <td className="p-3">{p.province}</td>
                    <td className="p-3 text-right">
                      {expandedRow === p.id ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </td>
                  </tr>
                  {expandedRow === p.id && (
                    <tr>
                      <td colSpan={4} className="p-4 bg-slate-50 dark:bg-slate-800 text-slate-600 dark:text-slate-400">
                        <div className="grid grid-cols-2 gap-4 text-xs">
                          <div><span className="font-bold">Telefone:</span> {p.phone || 'N/A'}</div>
                          <div><span className="font-bold">Data de Registo:</span> {p.createdAt ? new Date(p.createdAt.toDate()).toLocaleDateString() : 'N/A'}</div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
