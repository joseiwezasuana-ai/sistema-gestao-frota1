import React, { useState, useEffect } from 'react';
import { 
  Download, 
  Calendar,
  FileText,
  TrendingUp,
  CreditCard,
  User,
  Hash
} from 'lucide-react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { formatSafe } from '../lib/dateUtils';

export default function History() {
  const [shifts, setShifts] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const q = query(collection(db, 'shifts'), orderBy('timestamp', 'desc'));
    const unsub = onSnapshot(q, (snapshot) => {
      setShifts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'shifts'));
    return () => unsub();
  }, []);

  const totalRenda = shifts.reduce((acc, curr) => acc + (curr.rendaValue || 0), 0);

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between bg-white px-6 py-4 rounded-lg border border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Relatórios de Análise</h2>
          <p className="text-xs text-slate-500 font-medium">Histórico consolidado de rendas no Luena, Moxico</p>
        </div>
        <button className="bg-brand-primary text-white text-xs font-bold px-4 py-2 rounded-md hover:bg-brand-secondary transition-all flex items-center gap-2 uppercase tracking-widest">
          <Download size={14} />
          Exportar CSV
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        {[
          { label: 'Renda Total (Geral)', value: `${totalRenda.toLocaleString()} KZ`, icon: CreditCard, color: 'text-brand-primary' },
          { label: 'Total de Rendas', value: shifts.length.toString(), icon: Calendar, color: 'text-slate-600' },
          { label: 'Média por Renda', value: shifts.length > 0 ? `${Math.round(totalRenda / shifts.length).toLocaleString()} KZ` : '0 KZ', icon: TrendingUp, color: 'text-green-600' },
          { label: 'Motoristas Únicos', value: new Set(shifts.map(s => s.driverId)).size.toString(), icon: User, color: 'text-slate-600' },
        ].map((stat, i) => (
          <div key={i} className="bg-white p-5 rounded-lg border border-slate-200">
            <div className="flex items-center gap-2 mb-2">
              <stat.icon size={14} className={stat.color} />
              <div className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">{stat.label}</div>
            </div>
            <div className={`text-2xl font-bold ${stat.color}`}>{stat.value}</div>
          </div>
        ))}
      </div>

      <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
           <h3 className="font-bold text-[13px] text-slate-900 uppercase tracking-wider">Detalhamento de Movimentação</h3>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-[13px]">
            <thead>
              <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-tight">
                <th className="px-6 py-3 text-left border-b">DATA/HORA</th>
                <th className="px-6 py-3 text-left border-b">MOTORISTA</th>
                <th className="px-6 py-3 text-left border-b">VEÍCULO (Nº VIATURA)</th>
                <th className="px-6 py-3 text-left border-b">TERMINAL</th>
                <th className="px-6 py-3 text-right border-b">RENDA DO DIA</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {shifts.map((shift) => (
                <tr key={shift.id} className="hover:bg-slate-50/50 transition-colors">
                  <td className="px-6 py-4 font-medium text-slate-600">
                    {formatSafe(shift.timestamp, 'dd/MM/yyyy HH:mm', '-')}
                  </td>
                  <td className="px-6 py-4 font-bold text-slate-900">{shift.driverName}</td>
                  <td className="px-6 py-4">
                    <span className="px-2 py-1 bg-slate-100 rounded text-[11px] font-black">{shift.prefix}</span>
                  </td>
                  <td className="px-6 py-4 text-slate-600">{shift.mainPhone}</td>
                  <td className="px-6 py-4 text-right font-bold text-brand-primary">{shift.rendaValue?.toLocaleString()} KZ</td>
                </tr>
              ))}
              {shifts.length === 0 && !loading && (
                <tr>
                  <td colSpan={5} className="py-20 text-center opacity-30">
                    <div className="flex flex-col items-center gap-2">
                       <FileText size={48} />
                       <p className="font-bold uppercase tracking-widest text-sm">Sem registos no histórico</p>
                    </div>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
