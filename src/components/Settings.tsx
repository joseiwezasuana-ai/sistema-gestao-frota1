import React, { useState, useEffect } from 'react';
import { 
  Lock, 
  Key, 
  Plus, 
  Copy, 
  Check, 
  Trash2, 
  UserPlus,
  Loader2,
  Clock,
  ShieldCheck,
  UserCheck,
  ShieldAlert,
  Database,
  History,
  AlertTriangle,
  Bell,
  Zap
} from 'lucide-react';
import { collection, addDoc, setDoc, onSnapshot, query, orderBy, deleteDoc, doc, Timestamp, serverTimestamp, getDocs, writeBatch } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, auth } from '../lib/firebase';
import { formatSafe } from '../lib/dateUtils';
import { Share2, Smartphone, Terminal, AlertCircle } from 'lucide-react';
import { clsx as cn } from 'clsx';
import { motion } from 'motion/react';

export default function Settings() {
  const [codes, setCodes] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [whatsAppLink, setWhatsAppLink] = useState('');
  const [appName, setAppName] = useState('TaxiControl');
  const [maintenanceThreshold, setMaintenanceThreshold] = useState(5000);
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

    // Listen for global settings
    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setWhatsAppLink(data.whatsAppLink || '');
        setAppName(data.appName || 'TaxiControl');
        setMaintenanceThreshold(data.maintenanceThreshold || 5000);
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
        maintenanceThreshold: Number(maintenanceThreshold),
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

  const [isClearingGPS, setIsClearingGPS] = useState(false);

  const clearGPSHistory = async () => {
    if (!window.confirm("ATENÇÃO: Esta ação irá apagar TODO o histórico de GPS acumulado. Esta ação é irreversível e afetará a visualização de rotas passadas. Deseja continuar?")) {
      return;
    }

    const secondConfirm = window.prompt("Para confirmar, digite 'APAGAR HISTORICO':");
    if (secondConfirm !== 'APAGAR HISTORICO') {
       if (secondConfirm !== null) alert("Operação cancelada. O texto de confirmação não coincide.");
       return;
    }

    setIsClearingGPS(true);
    try {
      const q = query(collection(db, 'gps_history'));
      const snapshot = await getDocs(q);
      
      if (snapshot.empty) {
        alert("O histórico já está vazio.");
        setIsClearingGPS(false);
        return;
      }

      let deletedCount = 0;
      // Delete in batches of 500
      for (let i = 0; i < snapshot.docs.length; i += 500) {
        const batch = writeBatch(db);
        const chunk = snapshot.docs.slice(i, i + 500);
        chunk.forEach(docSnap => batch.delete(docSnap.ref));
        await batch.commit();
        deletedCount += chunk.length;
      }

      alert(`Sucesso! ${deletedCount} registos de GPS foram eliminados.`);
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
          <p className="text-xs text-slate-500 font-medium uppercase tracking-widest">Parâmetros globais, gestão de acessos e segurança</p>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Code Generator Section */}
        <section className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden h-fit">
            <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center gap-2">
              <Key size={16} className="text-brand-primary" />
              <h3 className="font-bold text-[13px] text-slate-900 uppercase tracking-wider">Gerador de Acessos</h3>
            </div>
            <div className="p-6 space-y-5">
              {/* ... existing generator code ... */}
              <div className="space-y-2">
                 <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Atribuir Função</label>
                 <div className="grid grid-cols-2 gap-2">
                   <button 
                    onClick={() => setNewRole('operator')}
                    className={`py-2 text-[11px] font-bold rounded border-2 transition-all ${
                      newRole === 'operator' ? 'border-brand-primary bg-blue-50 text-brand-primary' : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'
                    }`}
                   >
                     OPERADOR
                   </button>
                   <button 
                    onClick={() => setNewRole('driver')}
                    className={`py-2 text-[11px] font-bold rounded border-2 transition-all ${
                      newRole === 'driver' ? 'border-brand-primary bg-blue-50 text-brand-primary' : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'
                    }`}
                   >
                     MOTORISTA
                   </button>
                   <button 
                    onClick={() => setNewRole('mecanico')}
                    className={`py-2 text-[11px] font-bold rounded border-2 transition-all ${
                      newRole === 'mecanico' ? 'border-brand-primary bg-blue-50 text-brand-primary' : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'
                    }`}
                   >
                     MECÂNICO
                   </button>
                   <button 
                    onClick={() => setNewRole('contabilista')}
                    className={`py-2 text-[11px] font-bold rounded border-2 transition-all ${
                      newRole === 'contabilista' ? 'border-brand-primary bg-blue-50 text-brand-primary' : 'border-slate-100 bg-slate-50 text-slate-500 hover:border-slate-200'
                    }`}
                   >
                     CONTABILISTA
                   </button>
                 </div>
               </div>

               <div className="space-y-2">
                 <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">ID Personalizado (Opcional)</label>
                 <input 
                   type="text" 
                   placeholder="Ex: MOT-01"
                   value={assignedId}
                   onChange={(e) => setAssignedId(e.target.value.toUpperCase())}
                   className="w-full px-4 py-2 bg-slate-50 border border-slate-200 rounded-lg text-xs font-bold focus:bg-white focus:border-brand-primary outline-none transition-all"
                 />
               </div>

               <button 
                onClick={generateCode}
                disabled={isGenerating}
                className="w-full bg-slate-900 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-slate-800 transition-all active:scale-[0.98] disabled:opacity-50"
               >
                 {isGenerating ? <Loader2 className="animate-spin" size={18} /> : (
                   <>
                     <Plus size={18} />
                     GERAR NOVO CÓDIGO
                   </>
                 )}
               </button>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-blue-100 overflow-hidden h-fit shadow-sm">
            <div className="px-5 py-4 border-b border-blue-50 bg-blue-50/50 flex items-center gap-2">
              <Database size={16} className="text-blue-600" />
              <h3 className="font-bold text-[13px] text-blue-900 uppercase tracking-wider">Parâmetros Globais</h3>
            </div>
            <div className="p-6 space-y-4">
               <div className="grid grid-cols-1 gap-4">
                 <div className="space-y-2">
                   <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Nome da Aplicação</label>
                   <input 
                     type="text" 
                     value={appName}
                     onChange={(e) => setAppName(e.target.value)}
                     className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-lg text-xs font-bold focus:bg-white focus:border-blue-500 outline-none transition-all"
                   />
                 </div>
                 
                 <div className="grid grid-cols-2 gap-4">
                   <div className="space-y-2">
                     <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Moeda Padrão</label>
                     <input 
                       type="text" 
                       value={currency}
                       onChange={(e) => setCurrency(e.target.value)}
                       className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-lg text-xs font-bold focus:bg-white focus:border-blue-500 outline-none transition-all"
                     />
                   </div>
                   <div className="space-y-2">
                     <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Alerta Manutenção (KM)</label>
                     <input 
                       type="number" 
                       value={maintenanceThreshold}
                       onChange={(e) => setMaintenanceThreshold(Number(e.target.value))}
                       className="w-full px-4 py-2 bg-slate-50 border border-slate-100 rounded-lg text-xs font-bold focus:bg-white focus:border-blue-500 outline-none transition-all"
                     />
                   </div>
                 </div>

                 <div className="space-y-2">
                   <label className="text-[10px] font-bold text-slate-400 uppercase tracking-widest flex items-center gap-1">
                     Link do Grupo WhatsApp
                     <span className="text-[9px] lowercase font-normal">(wa.me ou chat.whatsapp.com)</span>
                   </label>
                   <input 
                     type="text" 
                     value={whatsAppLink}
                     onChange={(e) => setWhatsAppLink(e.target.value)}
                     placeholder="https://chat.whatsapp.com/..."
                     className="w-full px-4 py-2 bg-emerald-50/30 border border-emerald-100 rounded-lg text-xs font-bold focus:bg-white focus:border-emerald-500 outline-none transition-all"
                   />
                 </div>
               </div>

               <button 
                onClick={saveGlobalSettings}
                disabled={isSavingSettings}
                className="w-full bg-slate-900 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-black transition-all active:scale-[0.98] disabled:opacity-50"
               >
                 {isSavingSettings ? <Loader2 className="animate-spin" size={18} /> : (
                   <>
                     <Check size={18} />
                     GUARDAR CONFIGURAÇÕES
                   </>
                 )}
               </button>
            </div>
          </div>

          <div className="bg-white rounded-lg border border-slate-200 overflow-hidden h-fit shadow-sm">
            <div className="px-5 py-4 border-b border-slate-100 bg-slate-50/50 flex items-center gap-2">
              <Bell size={16} className="text-brand-primary" />
              <h3 className="font-bold text-[13px] text-slate-900 uppercase tracking-wider">Notificações e Alertas</h3>
            </div>
            <div className="p-6 space-y-4">
               <div>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mb-3">Estado das Permissões</p>
                  <div className="flex items-center justify-between p-3 bg-slate-50 rounded-xl border border-slate-200">
                     <span className="text-[11px] font-black uppercase text-slate-700">Notificações Push</span>
                     <span className={`px-2 py-1 rounded text-[8px] font-black uppercase ${
                       typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted'
                         ? 'bg-emerald-100 text-emerald-600'
                         : 'bg-rose-100 text-rose-600'
                     }`}>
                       {typeof window !== 'undefined' && 'Notification' in window ? Notification.permission : 'Indisponível'}
                     </span>
                  </div>
               </div>

               <div className="grid grid-cols-2 gap-3">
                  <button 
                    onClick={() => {
                      if ('Notification' in window) {
                        Notification.requestPermission().then(permission => {
                          alert(`Permissão: ${permission}`);
                          window.location.reload();
                        });
                      }
                    }}
                    className="flex items-center justify-center gap-2 py-3 bg-brand-primary text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-blue-700 transition-all active:scale-95 shadow-md"
                  >
                    <Bell size={14} /> Ativar
                  </button>
                  <button 
                    onClick={() => {
                      if (Notification.permission === 'granted') {
                        new Notification("PSM TaxiControl", {
                          body: "Teste de notificação sistema - Luena Ativo!",
                          icon: "/favicon.ico"
                        });
                      } else {
                        alert("Primeiro deve ativar as notificações.");
                      }
                    }}
                    className="flex items-center justify-center gap-2 py-3 bg-slate-900 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-black transition-all active:scale-95 shadow-md"
                  >
                    <Zap size={14} /> Testar
                  </button>
               </div>
               
               <p className="text-[9px] text-slate-400 italic leading-relaxed text-center">
                 Permite receber alertas de pânico (S.O.S) e excesso de velocidade mesmo com a aplicação em segundo plano.
               </p>
            </div>
          </div>
          <div className="bg-white rounded-lg border border-rose-100 overflow-hidden h-fit shadow-sm">
            <div className="px-5 py-4 border-b border-rose-50 bg-rose-50/50 flex items-center gap-2">
              <Database size={16} className="text-rose-600" />
              <h3 className="font-bold text-[13px] text-rose-900 uppercase tracking-wider">Manutenção de Dados</h3>
            </div>
            <div className="p-6 space-y-5">
               <div className="flex items-start gap-3 p-3 bg-rose-50 rounded-lg border border-rose-100">
                  <AlertTriangle size={20} className="text-rose-600 shrink-0 mt-0.5" />
                  <div>
                    <h4 className="text-[11px] font-black text-rose-900 uppercase">Limpeza de Histórico GPS</h4>
                    <p className="text-[10px] text-rose-700 font-medium leading-relaxed mt-1">
                      Elimina logs de localização permanentes para libertar espaço. Use apenas se necessário.
                    </p>
                  </div>
               </div>

               <button 
                onClick={clearGPSHistory}
                disabled={isClearingGPS}
                className="w-full bg-rose-600 text-white font-bold py-3 rounded-lg flex items-center justify-center gap-2 hover:bg-rose-700 transition-all active:scale-[0.98] disabled:opacity-50"
               >
                 {isClearingGPS ? <Loader2 className="animate-spin" size={18} /> : (
                   <>
                     <Trash2 size={18} />
                     ZERAR HISTÓRICO GPS
                   </>
                 )}
               </button>
            </div>
          </div>
        </section>

        {/* Access Codes List */}
        <section className="lg:col-span-2 bg-white rounded-lg border border-slate-200 overflow-hidden flex flex-col">
          <div className="px-5 py-4 border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h3 className="font-bold text-[13px] text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <UserPlus size={16} className="text-slate-400" />
              Convites Pendentes
            </h3>
          </div>
          <div className="overflow-x-auto h-[250px] custom-scrollbar">
            <table className="w-full text-[13px]">
              <thead>
                <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-tight text-[10px]">
                  <th className="px-6 py-3 text-left border-b border-slate-200">CÓDIGO</th>
                  <th className="px-6 py-3 text-left border-b border-slate-200">ID ALVO</th>
                  <th className="px-6 py-3 text-left border-b border-slate-200">FUNÇÃO</th>
                  <th className="px-6 py-3 text-left border-b border-slate-200">DATA</th>
                  <th className="px-6 py-3 text-right border-b border-slate-200">ACÇÕES</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {codes.filter(c => !c.used).map((item) => (
                  <tr key={item.id} className="hover:bg-slate-50/50">
                    <td className="px-6 py-4">
                      <div className="flex items-center gap-2">
                        <span className="font-mono font-bold text-slate-900 text-[14px] bg-slate-100 px-2 py-1 rounded tracking-wider">
                          {item.code}
                        </span>
                        <button 
                          onClick={() => copyToClipboard(item.code)}
                          className="p-1.5 text-slate-400 hover:text-brand-primary transition-colors"
                        >
                          {copiedCode === item.code ? <Check size={14} className="text-green-500" /> : <Copy size={14} />}
                        </button>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <span className="font-mono text-[11px] font-bold text-slate-500">
                        {item.assignedId || 'Qualquer'}
                      </span>
                    </td>
                    <td className="px-6 py-4">
                      <span className={`text-[10px] font-bold uppercase px-2 py-0.5 rounded ${
                        item.role === 'admin' ? 'bg-slate-900 text-white' :
                        item.role === 'operator' ? 'bg-blue-50 text-blue-600' :
                        item.role === 'driver' ? 'bg-orange-50 text-orange-600' :
                        item.role === 'mecanico' ? 'bg-slate-50 text-slate-600 border border-slate-200' :
                        'bg-emerald-50 text-emerald-600 border border-emerald-100'
                      }`}>
                        {item.role === 'operator' ? 'Operador' : 
                         item.role === 'driver' ? 'Motorista' : 
                         item.role === 'mecanico' ? 'Mecânico' :
                         item.role === 'contabilista' ? 'Contabilista' : item.role}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-slate-500 font-medium whitespace-nowrap">
                       {formatSafe(item.createdAt, 'dd/MM/yy HH:mm')}
                    </td>
                    <td className="px-6 py-4 text-right">
                       <button 
                        onClick={() => deleteCode(item.id)}
                        className="text-slate-300 hover:text-red-500 transition-colors"
                       >
                         <Trash2 size={16} />
                       </button>
                    </td>
                  </tr>
                ))}
                {codes.filter(c => !c.used).length === 0 && (
                  <tr>
                    <td colSpan={4} className="py-12 text-center opacity-30 italic font-medium">
                      Nenhum convite pendente.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          <div className="px-5 py-4 border-t border-b border-slate-200 bg-slate-50 flex items-center justify-between">
            <h3 className="font-bold text-[13px] text-slate-900 uppercase tracking-wider flex items-center gap-2">
              <UserCheck size={16} className="text-brand-primary" />
              Equipa e Utilizadores Ativos
            </h3>
          </div>
          <div className="overflow-x-auto h-[250px] custom-scrollbar">
             <table className="w-full text-[13px]">
                <thead>
                  <tr className="bg-slate-50 text-slate-500 font-bold uppercase tracking-tight text-[10px]">
                    <th className="px-6 py-3 text-left border-b border-slate-200">UTILIZADOR</th>
                    <th className="px-6 py-3 text-left border-b border-slate-200">ROLE</th>
                    <th className="px-6 py-3 text-left border-b border-slate-200">EMAIL / ID</th>
                    <th className="px-6 py-3 text-right border-b border-slate-200">DATA</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {users.map((u) => (
                    <tr key={u.uid} className="hover:bg-slate-50/50">
                      <td className="px-6 py-4">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-800">{u.name}</span>
                          <span className="text-[10px] text-slate-400 font-mono">UID: {u.uid.slice(0, 8)}...</span>
                        </div>
                      </td>
                      <td className="px-6 py-4">
                        <span className={u.role === 'admin' ? "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border bg-slate-900 text-white border-slate-900" :
                          u.role === 'operator' ? "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border bg-blue-50 text-blue-700 border-blue-100" :
                          u.role === 'driver' ? "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border bg-amber-50 text-amber-700 border-amber-100" :
                          u.role === 'mecanico' ? "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border bg-slate-100 text-slate-700 border-slate-200" :
                          "px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-widest border bg-emerald-50 text-emerald-700 border-emerald-100"
                        }>
                          {u.role}
                        </span>
                      </td>
                      <td className="px-6 py-4 text-slate-500 font-medium">{u.email}</td>
                      <td className="px-6 py-4 text-right text-slate-400 font-mono text-[11px]">
                         {formatSafe(u.createdAt, 'dd/MM/yy')}
                      </td>
                    </tr>
                  ))}
                </tbody>
             </table>
          </div>
        </section>

        {/* Gateway & Webhooks Section */}
        <section className="lg:col-span-3 bg-white rounded-lg border border-slate-200 overflow-hidden shadow-sm">
          <div className="px-5 py-4 border-b border-slate-200 bg-slate-900 text-white flex items-center justify-between">
            <h3 className="font-bold text-[13px] uppercase tracking-wider flex items-center gap-2">
              <Share2 size={16} className="text-brand-primary" />
              Integração Automática (Gateway de Chamadas e SMS)
            </h3>
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-green-500 rounded-full animate-pulse" />
              <span className="text-[10px] font-bold text-slate-400">Back-end Webhooks: ONLINE</span>
            </div>
          </div>
          
          <div className="p-6 grid grid-cols-1 md:grid-cols-2 gap-8 bg-slate-50/30">
            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-brand-light rounded-lg">
                  <Smartphone size={18} className="text-brand-primary" />
                </div>
                <div>
                  <h4 className="text-[14px] font-bold text-slate-900">Registo Automático via Telemóvel</h4>
                  <p className="text-[11px] text-slate-500">Use apps de encaminhamento (ex: SMS Forwarder) nos telemóveis vinculados.</p>
                </div>
              </div>
              
              <div className="space-y-3">
                <div className="bg-white p-4 rounded border border-slate-200">
                  <p className="text-[10px] font-bold text-slate-400 uppercase mb-2">Webhook URL (Genérico)</p>
                  <div className="flex items-center gap-2 bg-slate-50 p-2 rounded border border-slate-200 group">
                    <code className="text-[11px] font-mono text-slate-600 truncate flex-1">
                      {window.location.origin}/api/webhooks/generic
                    </code>
                    <button onClick={() => copyToClipboard(`${window.location.origin}/api/webhooks/generic`)} className="p-1 hover:bg-white rounded transition-colors shadow-sm">
                      <Copy size={14} className="text-slate-400" />
                    </button>
                  </div>
                  <p className="text-[10px] text-slate-400 mt-2 font-medium italic">Configure o app para enviar JSON com: type, from, to, content.</p>
                </div>
              </div>
            </div>

            <div className="space-y-4">
              <div className="flex items-center gap-3 mb-2">
                <div className="p-2 bg-slate-200 rounded-lg">
                  <Terminal size={18} className="text-slate-700" />
                </div>
                <div>
                  <h4 className="text-[14px] font-bold text-slate-900">Integração Twilio / Central</h4>
                  <p className="text-[11px] text-slate-500">Configure no Painel Twilio para as comunicações da central.</p>
                </div>
              </div>

              <div className="space-y-2">
                <div className="bg-white p-3 rounded border border-slate-100 flex items-center justify-between group">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Twilio SMS Webhook</p>
                    <code className="text-[10px] text-brand-primary font-mono">{window.location.origin}/api/webhooks/twilio/sms</code>
                  </div>
                  <button onClick={() => copyToClipboard(`${window.location.origin}/api/webhooks/twilio/sms`)} className="opacity-0 group-hover:opacity-100 p-1 bg-slate-50 rounded transition-all">
                    <Copy size={12} />
                  </button>
                </div>
                <div className="bg-white p-3 rounded border border-slate-100 flex items-center justify-between group">
                  <div>
                    <p className="text-[10px] font-bold text-slate-400 uppercase">Twilio Voice (Chamadas)</p>
                    <code className="text-[10px] text-brand-primary font-mono">{window.location.origin}/api/webhooks/twilio/voice</code>
                  </div>
                  <button onClick={() => copyToClipboard(`${window.location.origin}/api/webhooks/twilio/voice`)} className="opacity-0 group-hover:opacity-100 p-1 bg-slate-50 rounded transition-all">
                    <Copy size={12} />
                  </button>
                </div>
              </div>
            </div>
          </div>
          
          <div className="px-6 py-4 bg-amber-50 border-t border-amber-200">
             <div className="flex items-start gap-3">
                <AlertCircle size={16} className="text-amber-600 mt-0.5" />
                <div>
                  <p className="text-[11px] font-bold text-amber-900 uppercase">Nota de Funcionamento Automático</p>
                  <p className="text-[11px] text-amber-700 leading-relaxed font-medium">
                    Ao receber uma chamada ou SMS nos URLs acima, o sistema irá automaticamente:
                    <br />• Incrementar o contador de chamadas do motorista vinculado.
                    <br />• Adicionar a entrada em tempo real no Monitor de Operações.
                  </p>
                </div>
             </div>
          </div>
        </section>
      </div>
    </div>
  );
}
