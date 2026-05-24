import React, { useState, useEffect } from 'react';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, auth } from '../lib/firebase';
import { Settings, Save, Loader2, Gauge, Wrench } from 'lucide-react';

export default function ThresholdSettings() {
  const [maintenanceThreshold, setMaintenanceThreshold] = useState(5000);
  const [speedThreshold, setSpeedThreshold] = useState(80);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'global'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setMaintenanceThreshold(data.maintenanceThreshold || 5000);
        setSpeedThreshold(data.speedThreshold || 80);
      }
    });
    return unsub;
  }, []);

  const saveSettings = async () => {
    setIsSaving(true);
    try {
      await setDoc(doc(db, 'settings', 'global'), {
        maintenanceThreshold: Number(maintenanceThreshold),
        speedThreshold: Number(speedThreshold),
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.email
      }, { merge: true });
      alert("Limites atualizados!");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'settings/global');
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="bg-white p-6 rounded-[2rem] border border-slate-200 shadow-sm space-y-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 bg-brand-primary/10 rounded-2xl flex items-center justify-center text-brand-primary">
          <Settings size={20} />
        </div>
        <h3 className="text-[13px] font-black uppercase tracking-widest text-slate-900">Limites de Alerta</h3>
      </div>
      
      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
             <Gauge size={12} /> Vel. Máx (km/h)
          </label>
          <input 
            type="number"
            value={speedThreshold}
            onChange={(e) => setSpeedThreshold(Number(e.target.value))}
            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:bg-white focus:border-brand-primary outline-none"
          />
        </div>
        <div className="space-y-2">
          <label className="text-[9px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
            <Wrench size={12} /> Manut. (KM)
          </label>
          <input 
            type="number"
            value={maintenanceThreshold}
            onChange={(e) => setMaintenanceThreshold(Number(e.target.value))}
            className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:bg-white focus:border-brand-primary outline-none"
          />
        </div>
      </div>

      <button 
        onClick={saveSettings}
        disabled={isSaving}
        className="w-full bg-slate-900 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-black transition-all active:scale-[0.98] disabled:opacity-50"
      >
        {isSaving ? <Loader2 className="animate-spin" size={18} /> : (
          <>
            <Save size={16} /> GUARDAR LIMITE
          </>
        )}
      </button>
    </div>
  );
}
