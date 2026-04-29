import React, { useState, useEffect } from 'react';
import { 
  Send, 
  User, 
  MessageSquare, 
  ShieldAlert, 
  ShieldCheck,
  Clock,
  Search,
  Filter,
  Loader2,
  Trash2,
  MessageCircle,
  ExternalLink
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { format } from 'date-fns';

import { collection, onSnapshot, addDoc, query, orderBy, limit, serverTimestamp, getDocs, deleteDoc, doc } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { smsService } from '../services/smsService';

export default function Messages() {
  const [messages, setMessages] = useState<any[]>([]);
  const [newMessage, setNewMessage] = useState('');
  const [isSending, setIsSending] = useState(false);
  const [activeNumbers, setActiveNumbers] = useState<string[]>([]);
  const [selectedChannel, setSelectedChannel] = useState('all');
  const [isSimulated, setIsSimulated] = useState(true);
  const [activeVehicleCount, setActiveVehicleCount] = useState(0);
  const [whatsAppLink, setWhatsAppLink] = useState('');
  const [drivers, setDrivers] = useState<any[]>([]);
  const [selectedDriverId, setSelectedDriverId] = useState('all');

  const channels = [
    { id: 'all', name: 'Todos os Canais', color: 'text-slate-400', type: 'system' },
    { id: 'sos', name: 'Emergência (SOS)', color: 'text-red-500', type: 'alert' },
    { id: 'whatsapp', name: 'Grupo WhatsApp Clientes', color: 'text-emerald-500', type: 'external' },
    { id: 'logistics', name: 'Logística Central', color: 'text-brand-primary', type: 'broadcast' },
    { id: 'tech', name: 'Suporte Técnico', color: 'text-slate-500', type: 'system' },
    { id: 'traffic', name: 'Avisos de Trânsito', color: 'text-amber-500', type: 'broadcast' },
  ];

  useEffect(() => {
    // Listen for global settings for WhatsApp link
    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (docSnap) => {
      if (docSnap.exists()) {
        setWhatsAppLink(docSnap.data().whatsAppLink || '');
      }
    });

    // Listen for messages
    const qMessages = query(collection(db, 'messages'), orderBy('timestamp', 'desc'), limit(50));
    const unsubMessages = onSnapshot(qMessages, (snapshot) => {
      setMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, 'messages'));

    // Listen for active drivers
    const qDrivers = query(collection(db, 'drivers'));
    const unsubDrivers = onSnapshot(qDrivers, (snapshot) => {
      const docs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setDrivers(docs);
      
      const numbers = new Set<string>();
      let activeCount = 0;
      docs.forEach((data: any) => {
        const status = (data.status || '').toLowerCase();
        if (['available', 'ativo', 'disponível', 'busy', 'ocupado'].includes(status)) {
          activeCount++;
          if (data.phoneNumber) numbers.add(data.phoneNumber);
          if (data.secondaryPhone) numbers.add(data.secondaryPhone);
          if (data.phone) numbers.add(data.phone); 
        }
      });
      setActiveNumbers(Array.from(numbers));
      setActiveVehicleCount(activeCount);
    }, (error) => handleFirestoreError(error, OperationType.GET, 'drivers'));

    return () => {
      unsubMessages();
      unsubDrivers();
      unsubSettings();
    };
  }, []);

  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newMessage.trim() || isSending) return;
    
    setIsSending(true);
    const channel = channels.find(c => c.id === selectedChannel) || channels[0];
    
    // Target numbers determination
    let targets = activeNumbers;
    let targetName = 'Frota Geral';

    if (selectedDriverId !== 'all') {
      const drv = drivers.find(d => d.id === selectedDriverId);
      if (drv) {
        targets = [drv.phone, drv.secondaryPhone, drv.phoneNumber].filter(Boolean);
        targetName = drv.name;
      }
    }
    
    try {
      await addDoc(collection(db, 'messages'), {
        content: newMessage,
        sender: auth.currentUser?.displayName || 'Central Operacional',
        senderUid: auth.currentUser?.uid,
        type: channel.type,
        channelId: selectedChannel === 'all' ? 'logistics' : selectedChannel,
        targetId: selectedDriverId,
        targetName: targetName,
        timestamp: serverTimestamp(),
        targetsCount: targets.length
      });

      if (targets.length > 0) {
        await smsService.sendSMS(targets, newMessage);
      }

      setNewMessage('');
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'messages');
    } finally {
      setIsSending(false);
    }
  };

  const filteredMessages = selectedChannel === 'all' 
    ? messages 
    : messages.filter(m => m.channelId === selectedChannel || (selectedChannel === 'sos' && m.type === 'alert'));

  const getChannelCount = (channelId: string) => {
    if (channelId === 'all') return messages.length;
    return messages.filter(m => m.channelId === channelId || (channelId === 'sos' && m.type === 'alert')).length;
  };

  const handleDeleteMessage = async (id: string) => {
    if (!window.confirm('Deseja eliminar esta mensagem permanentemente?')) return;
    
    const path = `messages/${id}`;
    try {
      await deleteDoc(doc(db, 'messages', id));
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, path);
    }
  };

  return (
    <div className="space-y-8 max-w-[1500px] mx-auto h-full flex flex-col pb-20">
      <div className="bg-white px-10 py-10 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden flex flex-col lg:flex-row lg:items-center justify-between gap-8 group">
          <div className="absolute top-0 right-0 w-[30%] h-full bg-slate-50 border-l border-slate-100 -mr-20 rotate-12 -z-0 opacity-50 group-hover:rotate-6 transition-transform duration-1000" />
          
          <div className="relative z-10 flex items-center gap-8">
            <div className="w-20 h-20 bg-slate-900 rounded-[2.5rem] flex items-center justify-center text-white shadow-2xl rotate-3 group-hover:rotate-0 transition-all duration-500 border border-white/10">
               <MessageSquare size={40} />
            </div>
            <div>
              <h2 className="font-black text-4xl text-slate-900 tracking-tighter uppercase italic">
                Hub de Comunicações
              </h2>
              <p className="text-[10px] text-slate-500 font-black uppercase tracking-[0.4em] mt-2 flex items-center gap-3">
                <span className="w-2 h-2 bg-brand-primary rounded-full animate-pulse shadow-[0_0_8px_rgba(37,99,235,0.8)]" />
                CENTRO DE COMANDO & BROADCAST • PSM LUENA
              </p>
            </div>
          </div>

          <div className="relative z-10 flex items-center gap-6">
            {isSimulated ? (
              <div className="flex items-center gap-3 px-5 py-2.5 bg-amber-50 rounded-2xl border border-amber-200 italic shadow-sm">
                <ShieldAlert size={16} className="text-amber-500" />
                <span className="text-[10px] font-black text-amber-600 uppercase tracking-widest leading-none">
                   Gateway Local (Simulado)
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-3 px-5 py-2.5 bg-emerald-50 rounded-2xl border border-emerald-200 italic shadow-sm">
                <ShieldCheck size={16} className="text-emerald-600" />
                <span className="text-[10px] font-black text-green-600 uppercase tracking-widest leading-none">
                   Twilio Global Link ATIVO
                </span>
              </div>
            )}
            
            <div className="h-10 w-px bg-slate-200" />

            <div className="flex flex-col items-end">
               <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1 italic">Nós Ativos</p>
               <p className="text-xl font-black text-slate-900 tracking-tighter italic">{activeNumbers.length} <span className="text-[10px] opacity-40 uppercase">Terminais</span></p>
            </div>
          </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-4 gap-8 overflow-hidden min-h-[600px]">
        {/* Sidebar Status/Channels */}
        <div className="lg:col-span-1 space-y-6">
          <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm">
            <div className="px-8 py-6 border-b border-slate-100 bg-slate-50/50">
               <h3 className="font-black text-[11px] text-slate-900 uppercase tracking-widest italic">Canais Logísticos</h3>
            </div>
            <div className="p-3 space-y-1">
              {channels.map((channel) => (
                <button 
                  key={channel.id} 
                  onClick={() => setSelectedChannel(channel.id)}
                  className={cn(
                    "w-full flex items-center justify-between p-4 rounded-2xl transition-all text-left group",
                    selectedChannel === channel.id ? "bg-slate-900 text-white shadow-xl translate-x-2" : "hover:bg-slate-50"
                  )}
                >
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-8 h-8 rounded-lg flex items-center justify-center transition-colors",
                      selectedChannel === channel.id ? "bg-white/10" : "bg-slate-50 " + channel.color.replace('text-', 'bg-').replace('500', '100')
                    )}>
                      <MessageSquare size={14} className={selectedChannel === channel.id ? 'text-white' : channel.color} />
                    </div>
                    <span className="text-[11px] font-black uppercase tracking-tight italic">
                      {channel.name}
                    </span>
                  </div>
                  {getChannelCount(channel.id) > 0 && (
                    <span className={cn(
                      "text-[9px] font-black px-2 py-0.5 rounded-full transition-all",
                      selectedChannel === channel.id ? "bg-brand-primary text-white" : "bg-slate-100 text-slate-400 group-hover:bg-slate-900 group-hover:text-white"
                    )}>
                      {getChannelCount(channel.id)}
                    </span>
                  )}
                </button>
              ))}
            </div>
          </div>

          <div className="bg-emerald-600 rounded-[2.5rem] p-8 text-white shadow-2xl shadow-emerald-600/20 relative overflow-hidden group">
             <div className="absolute top-0 right-0 w-32 h-32 bg-white/10 blur-3xl -mr-16 -mt-16 group-hover:bg-white/20 transition-all" />
             <MessageCircle size={32} className="mb-6 opacity-40 rotate-12" />
             <h4 className="font-black text-lg uppercase tracking-title mb-4 italic leading-tight">Canal Externo de Atendimento</h4>
             <p className="text-[11px] opacity-70 leading-relaxed font-bold uppercase tracking-widest mb-6">Grupo de Apoio WhatsApp Clientes LUENA</p>
             <a 
               href={whatsAppLink || "https://wa.me/244920010026"} 
               target="_blank" 
               rel="noreferrer"
               className="flex items-center justify-center gap-3 w-full py-4 bg-white text-emerald-600 rounded-2xl font-black text-[10px] uppercase tracking-[0.2em] hover:bg-emerald-50 transition-all shadow-xl active:scale-95"
             >
               Ligar Terminal Externo
               <ExternalLink size={14} />
             </a>
          </div>
        </div>

        {/* Messages Feed */}
        <div className="lg:col-span-3 bg-white rounded-[2.5rem] border border-slate-200 flex flex-col overflow-hidden shadow-sm relative">
          <div className="px-10 py-6 border-b border-slate-100 bg-slate-50/50 flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div className="p-3 bg-white border border-slate-100 rounded-xl shadow-sm">
                <Filter size={18} className="text-slate-400" />
              </div>
              <div>
                <h3 className="font-black text-sm text-slate-900 uppercase tracking-tighter italic">Feed de Eventos: {channels.find(c => c.id === selectedChannel)?.name}</h3>
                <p className="text-[9px] text-slate-400 font-black uppercase tracking-[0.2em] mt-0.5 italic">Protocolo de Comunicações em Tempo Real</p>
              </div>
            </div>
            <div className="flex items-center gap-6">
               <div className="relative w-64 group/search">
                 <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within/search:text-brand-primary" size={14} />
                 <input type="text" placeholder="BUSCAR NA COMUNICAÇÃO..." className="w-full pl-10 pr-6 py-2.5 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase tracking-widest outline-none focus:ring-2 focus:ring-brand-primary transition-all" />
               </div>
            </div>
          </div>
          
          <div className="flex-1 overflow-y-auto p-10 space-y-6 flex flex-col-reverse no-scrollbar">
            {selectedChannel === 'whatsapp' && (
              <div className="flex-1 flex items-center justify-center flex-col gap-8 py-20">
                <div className="w-24 h-24 bg-emerald-50 rounded-[2rem] flex items-center justify-center text-emerald-500 animate-bounce">
                  <MessageCircle size={48} />
                </div>
                <div className="text-center space-y-3 max-w-md">
                  <h4 className="font-black text-2xl text-slate-900 uppercase tracking-tighter italic">Integração WhatsApp</h4>
                  <p className="text-[11px] text-slate-400 leading-relaxed font-bold uppercase tracking-widest">
                    A PS MOREIRA utiliza um terminal dedicado para atendimento mobile no Moxico. A comunicação externa deve ser gerida pelo link seguro abaixo.
                  </p>
                </div>
                {whatsAppLink ? (
                  <a 
                    href={whatsAppLink} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="flex items-center gap-3 px-10 py-5 bg-emerald-600 text-white rounded-[1.25rem] font-black text-xs uppercase tracking-widest hover:bg-emerald-700 transition-all shadow-2xl shadow-emerald-600/30 active:scale-95"
                  >
                    Abrir Gateway WhatsApp Oficial
                  </a>
                ) : (
                  <div className="p-6 bg-rose-50 border border-rose-100 rounded-2xl flex items-start gap-4">
                    <ShieldAlert size={20} className="text-rose-500 mt-1" />
                    <div>
                      <p className="text-[11px] text-rose-700 font-black uppercase tracking-widest mb-1 italic">Interrupção de Gateway</p>
                      <p className="text-[10px] text-rose-500 font-bold uppercase leading-tight">Configurações de link externo ausentes. Contacte o administrador.</p>
                    </div>
                  </div>
                )}
              </div>
            )}

            {selectedChannel !== 'whatsapp' && filteredMessages.map((msg, idx) => (
              <motion.div 
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: idx * 0.05 }}
                key={msg.id} 
                className={cn(
                  "p-6 rounded-[2rem] border transition-all hover:shadow-lg",
                  msg.type === 'alert' ? "bg-rose-50 border-rose-100 shadow-rose-500/5" : 
                  msg.type === 'system' ? "bg-slate-50 border-slate-100 shadow-slate-500/5" : 
                  "bg-white border-slate-100 shadow-slate-500/5 group"
                )}
              >
                <div className="flex justify-between items-start mb-4">
                  <div className="flex items-center gap-4">
                    <div className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center text-white shadow-xl transition-transform group-hover:rotate-6",
                      msg.type === 'alert' ? "bg-rose-500" : msg.type === 'system' ? "bg-slate-900" : "bg-brand-primary"
                    )}>
                      {msg.type === 'alert' ? <ShieldAlert size={18} /> : <User size={18} />}
                    </div>
                    <div>
                      <span className="text-[11px] font-black text-slate-900 uppercase tracking-widest italic">{msg.sender}</span>
                      <div className="flex items-center gap-2 mt-0.5">
                         <div className={cn("w-1.5 h-1.5 rounded-full", msg.type === 'alert' ? "bg-rose-500" : "bg-emerald-500")} />
                         <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic">Verificado via PSM HUB</span>
                      </div>
                    </div>
                  </div>
                  <div className="flex items-center gap-4">
                    <div className="flex flex-col items-end">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest italic">
                        {msg.timestamp?.toDate ? format(msg.timestamp.toDate(), 'dd MMM, HH:mm') : 'AGORA'}
                      </span>
                    </div>
                    <button 
                      onClick={() => handleDeleteMessage(msg.id)}
                      className="w-8 h-8 flex items-center justify-center text-slate-200 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                </div>
                <div className="pl-14">
                  <p className="text-[14px] text-slate-700 leading-relaxed font-medium italic">{msg.content}</p>
                  {msg.targetsCount > 0 && (
                     <div className="mt-4 inline-flex items-center gap-2 px-3 py-1 bg-slate-900 rounded-lg text-[9px] font-black text-white uppercase tracking-widest italic opacity-80">
                       <ShieldCheck size={10} className="text-emerald-500" />
                       Transmitido para {msg.targetsCount} Terminais
                     </div>
                  )}
                </div>
              </motion.div>
            ))}
          </div>
          
          <div className="p-8 border-t border-slate-100 bg-white relative z-20 space-y-4">
            <div className="flex items-center gap-4">
              <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Destinatário:</span>
              <select 
                value={selectedDriverId}
                onChange={(e) => setSelectedDriverId(e.target.value)}
                className="bg-slate-50 border border-slate-200 rounded-xl px-4 py-2 text-[10px] font-black uppercase outline-none focus:ring-2 ring-brand-primary"
              >
                <option value="all">TRANSMITIR PARA TODOS</option>
                {drivers.map(d => (
                  <option key={d.id} value={d.id}>{d.name} ({d.prefix})</option>
                ))}
              </select>
            </div>
            <form onSubmit={handleSendMessage} className="flex gap-4 p-2 bg-slate-50 rounded-3xl border border-slate-100 shadow-inner group-focus-within:ring-2 ring-brand-primary transition-all">
              <input 
                type="text" 
                value={newMessage}
                onChange={(e) => setNewMessage(e.target.value)}
                placeholder="DIGITAR MENSAGEM PARA BROADCAST GERAL..." 
                className="flex-1 bg-transparent px-6 py-4 text-[13px] font-black uppercase italic tracking-tight outline-none placeholder:text-slate-300"
              />
              <button 
                type="submit"
                disabled={isSending}
                className="flex items-center justify-center gap-3 px-10 py-4 bg-slate-900 text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-2xl active:scale-95 disabled:opacity-70 group-hover:bg-brand-primary italic"
              >
                {isSending ? <Loader2 size={18} className="animate-spin" /> : <Send size={18} className="rotate-12" />}
                {isSending ? 'TX...' : 'Transmitir'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  );
}
