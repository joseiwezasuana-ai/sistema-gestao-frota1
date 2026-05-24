import React, { useState, useEffect } from 'react';
import { 
  Key, 
  Plus, 
  Copy, 
  Check, 
  Trash2, 
  UserPlus,
  Loader2,
  Database,
  Bell,
  Zap,
  Info,
  Share2, 
  Smartphone, 
  AlertCircle, 
  AlertTriangle,
  UserCheck
} from 'lucide-react';
import { collection, addDoc, setDoc, onSnapshot, query, orderBy, deleteDoc, doc, Timestamp, serverTimestamp, getDocs, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, auth } from '../lib/firebase';
import { formatSafe } from '../lib/dateUtils';
import ThresholdSettings from './ThresholdSettings';
import WhatsAppWebhookConfig from './WhatsAppWebhookConfig';

export default function Settings() {
  const [codes, setCodes] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [whatsAppLink, setWhatsAppLink] = useState('');
  const [appName, setAppName] = useState('TaxiControl');
  const [currency, setCurrency] = useState('AOA');
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [newRole, setNewRole] = useState<'operator' | 'driver' | 'mecanico' | 'contabilista'>('operator');
  const [assignedId, setAssignedId] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  useEffect(() => {
    const qCodes = query(collection(db, 'access_codes'), orderBy('createdAt', 'desc'));
    const unsubCodes = onSnapshot(qCodes, (snapshot) => {
      setCodes(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'access_codes'));

    const qUsers = query(collection(db, 'users'), orderBy('name', 'asc'));
    const unsubUsers = onSnapshot(qUsers, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'users'));

    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setWhatsAppLink(data.whatsAppLink || '');
        setAppName(data.appName || 'TaxiControl');
        setCurrency(data.currency || 'AOA');
      }
    });

    return () => {
      unsubCodes();
      unsubUsers();
      unsubSettings();
    };
  }, []);

  const saveGlobalSettings = async () => {
    setIsSavingSettings(true);
    try {
      await setDoc(doc(db, 'settings', 'global'), {
        whatsAppLink: whatsAppLink.trim(),
        appName: appName.trim(),
        currency: currency.trim(),
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.email
      }, { merge: true });
      alert("Configurações guardadas com sucesso!");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, 'settings/global');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const generateCode = async () => {
    setIsGenerating(true);
    const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    let code = '';
    for (let i = 0; i < 8; i++) {
        if (i === 4) code += '-';
        code += chars.charAt(Math.floor(Math.random() * chars.length));
    }

    try {
      await setDoc(doc(db, 'access_codes', code), {
        code,
        role: newRole,
        assignedId: assignedId.trim() || null,
        used: false,
        createdAt: new Date().toISOString(),
      });
      setAssignedId('');
    } catch (error) {
       handleFirestoreError(error, OperationType.CREATE, 'access_codes');
    } finally {
       setIsGenerating(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedCode(text);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  const deleteCode = async (id: string) => {
    if (window.confirm("Anular este código de acesso?")) {
      try {
        await deleteDoc(doc(db, 'access_codes', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `access_codes/${id}`);
      }
    }
  };

  const deleteUser = async (id: string, name: string) => {
    if (window.confirm(`ATENÇÃO: Deseja remover permanentemente o utilizador "${name}" da equipa? Esta ação não pode ser desfeita.`)) {
      try {
        await deleteDoc(doc(db, 'users', id));
      } catch (error) {
        handleFirestoreError(error, OperationType.DELETE, `users/${id}`);
      }
    }
  };

  const [isClearingGPS, setIsClearingGPS] = useState(false);

  const clearGPSHistory = async () => {
    if (!window.confirm("ATENÇÃO: Esta ação irá apagar TODO o histórico de GPS acumulado. Esta ação é irreversível e afetará a visualização de rotas passadas. Deseja continuar?")) {
      return;
    }

    const secondConfirm = window.prompt("Para confirmar, digite 'APAGAR HISTORICO':");
    if (secondConfirm !== 'APAGAR HISTORICO') return;

    setIsClearingGPS(true);
    try {
      const q = query(collection(db, 'gps_history'));
      const snapshot = await getDocs(q);
      if (snapshot.empty) {
        alert("O histórico já está vazio.");
        setIsClearingGPS(false);
        return;
      }
      for (let i = 0; i < snapshot.docs.length; i += 500) {
        const batch = writeBatch(db);
        const chunk = snapshot.docs.slice(i, i + 500);
        chunk.forEach(docSnap => batch.delete(docSnap.ref));
        await batch.commit();
      }
      alert(`Sucesso! Histórico eliminado.`);
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, 'gps_history');
    } finally {
      setIsClearingGPS(false);
    }
  };

  return (
    <div className="space-y-6 max-w-[1400px] mx-auto pb-12">
      <div className="flex items-center justify-between bg-white px-6 py-4 rounded-lg border border-slate-200">
        <div>
          <h2 className="text-xl font-bold text-slate-900 tracking-tight">Configurações do Sistema</h2>
          <p className="text-xs text-slate-500 font-medium uppercase tracking-widest">Gestão de acessos e segurança</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <section className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden h-fit">
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
              <Key size={16} className="text-brand-primary" />
              <h3 className="font-bold text-[13px] text-slate-900 uppercase tracking-wider">Gerador de Acessos</h3>
            </div>
            <div className="p-6 space-y-5">
              <div className="space-y-2">
                 <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Atribuir Função</label>
                 <div className="grid grid-cols-2 gap-2">
                   {['operator', 'driver', 'mecanico', 'contabilista'].map(role => (
                     <button 
                      key={role}
                      onClick={() => setNewRole(role as any)}
                      className={`py-2 text-[11px] font-bold rounded border-2 transition-all ${
                        newRole === role ? 'border-brand-primary bg-blue-50 text-brand-primary' : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'
                      }`}
                     >
                       {role.toUpperCase()}
                     </button>
                   ))}
                 </div>
               </div>
               <div className="space-y-2">
                 <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ID Personalizado (Opcional)</label>
                 <input 
                   type="text" 
                   value={assignedId}
                   onChange={(e) => setAssignedId(e.target.value.toUpperCase())}
                   className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:bg-white focus:border-brand-primary outline-none"
                 />
               </div>
               <button 
                onClick={generateCode}
                disabled={isGenerating}
                className="w-full bg-slate-900 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-slate-800 transition-all disabled:opacity-50"
               >
                 {isGenerating ? <Loader2 className="animate-spin" size={18} /> : <> <Plus size={18} /> GERAR CÓDIGO</>}
               </button>
            </div>
          </div>
          
          <div className="bg-white rounded-lg border border-blue-100 overflow-hidden h-fit shadow-sm">
            <div className="px-5 py-4 border-b border-blue-50 bg-blue-50/50 flex items-center gap-2">
              <Database size={16} className="text-blue-600" />
              <h3 className="font-bold text-[13px] text-blue-900 uppercase tracking-wider">Parâmetros Globais</h3>
            </div>
            <div className="p-6 space-y-4">
               <ThresholdSettings />
               <div className="space-y-4 pt-4 border-t border-slate-100">
                 <div className="space-y-2">
                   <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nome da Aplicação</label>
                   <input type="text" value={appName} onChange={(e) => setAppName(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-lg text-xs font-bold focus:bg-white focus:border-blue-500 outline-none" />
                 </div>
                 <div className="space-y-2">
                     <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Moeda</label>
                     <input type="text" value={currency} onChange={(e) => setCurrency(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-lg text-xs font-bold focus:bg-white" />
                   </div>
                 <div className="space-y-2">
                   <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Link WhatsApp</label>
                   <input type="text" value={whatsAppLink} onChange={(e) => setWhatsAppLink(e.target.value)} className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-lg text-xs font-bold focus:bg-white focus:border-blue-500 outline-none" />
                 </div>
               </div>
               <button 
                onClick={saveGlobalSettings}
                disabled={isSavingSettings}
                className="w-full bg-slate-900 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-black transition-all"
               >
                 {isSavingSettings ? <Loader2 className="animate-spin" size={18} /> : <><Check size={18} /> GUARDAR</>}
               </button>
            </div>
          </div>
        </section>

        <section className="lg:col-span-2 bg-white rounded-lg border border-slate-200 overflow-hidden flex flex-col">
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="font-bold text-[13px] text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <UserPlus size={16} className="text-slate-400" />
                Convites Pendentes
              </h3>
            </div>
            <div className="overflow-x-auto h-[250px] custom-scrollbar">
              <table className="w-full text-[13px]">
                <tbody className="divide-y divide-slate-100">
                  {codes.filter(c => !c.used).map((item) => (
                    <tr key={item.id} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4">
                        <span className="font-mono font-bold text-slate-900 text-[14px] bg-slate-100 px-2 py-1 rounded tracking-wider">{item.code}</span>
                      </td>
                      <td className="px-6 py-4 text-right">
                         <button onClick={() => deleteCode(item.id)} className="text-slate-300 hover:text-red-500 transition-colors"><Trash2 size={16} /></button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="px-5 py-4 border-t border-b border-slate-200 bg-slate-50 flex items-center justify-between">
              <h3 className="font-bold text-[13px] text-slate-900 uppercase tracking-wider flex items-center gap-2">
                <UserCheck size={16} className="text-brand-primary" />
                Equipa
              </h3>
            </div>
            <div className="overflow-x-auto h-[250px] custom-scrollbar">
               <table className="w-full text-[13px]">
                  <tbody className="divide-y divide-slate-100">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-slate-50/50">
                        <td className="px-6 py-4">{u.name}</td>
                        <td className="px-6 py-4">{u.role}</td>
                        <td className="px-6 py-4 text-right">
                          <button onClick={() => deleteUser(u.id, u.name)} className="text-slate-300 hover:text-red-500 transition-colors p-2"><Trash2 size={16} /></button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
               </table>
            </div>
        </section>
      </div>

      {/* WhatsApp Cloud API Webhook Integration section */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        <div className="lg:col-span-3">
          <WhatsAppWebhookConfig />
        </div>
      </div>
    </div>
  );
}
