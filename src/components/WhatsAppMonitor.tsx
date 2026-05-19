import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquare, 
  User, 
  Clock, 
  Phone, 
  MapPin, 
  AlertTriangle,
  ChevronRight,
  Search,
  Filter,
  MoreVertical,
  CheckCheck
} from 'lucide-react';

interface WhatsAppMessage {
  id: string;
  sender: string;
  phone: string;
  text: string;
  timestamp: Date;
  type: 'text' | 'location' | 'alert';
  isOperational?: boolean;
}

const MOCK_MESSAGES: WhatsAppMessage[] = [
  {
    id: '1',
    sender: 'Augusto Silva (T-04)',
    phone: '+244 923 111 222',
    text: 'Iniciando turno no Bairro Social. Veículo limpo e tanque cheio.',
    timestamp: new Date(Date.now() - 1000 * 60 * 15),
    type: 'text',
    isOperational: true
  },
  {
    id: '2',
    sender: 'Pedro Kiala (T-12)',
    phone: '+244 931 444 555',
    text: 'Localização atual: Mercado Municipal. Aguardando passageiro.',
    timestamp: new Date(Date.now() - 1000 * 60 * 8),
    type: 'location'
  },
  {
    id: '3',
    sender: 'Central Operacional',
    phone: 'SISTEMA',
    text: 'ALERTA: Congestionamento na Rua da Independência. Evitem a rota.',
    timestamp: new Date(Date.now() - 1000 * 60 * 5),
    type: 'alert',
    isOperational: true
  },
  {
    id: '4',
    sender: 'José Manuel (T-09)',
    phone: '+244 945 777 888',
    text: 'Encerrando corrida. Próxima parada: Aeroporto do Luena.',
    timestamp: new Date(Date.now() - 1000 * 60 * 2),
    type: 'text'
  }
];

export function WhatsAppMonitor() {
  const [messages, setMessages] = useState<WhatsAppMessage[]>(MOCK_MESSAGES);
  const [searchTerm, setSearchTerm] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Auto-scroll para a última mensagem
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [messages]);

  const filteredMessages = messages.filter(msg => 
    msg.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
    msg.sender.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="flex flex-col h-[600px] bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xl">
      {/* Header */}
      <div className="p-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-100 dark:bg-emerald-900/30 text-emerald-600 rounded-xl">
            <MessageSquare size={20} />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white leading-none">Monitor Grupo WhatsApp</h3>
            <p className="text-xs text-slate-500 font-medium mt-1">Conectado: Central de Despacho • Luena</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2 py-1 bg-emerald-50 text-emerald-600 text-[10px] font-bold rounded-md border border-emerald-100 animate-pulse">
            <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full" />
            LIVE
          </div>
          <button className="p-2 hover:bg-slate-100 dark:hover:bg-slate-700 rounded-lg transition-colors">
            <MoreVertical size={18} className="text-slate-400" />
          </button>
        </div>
      </div>

      {/* Toolbar */}
      <div className="p-3 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3">
        <div className="relative flex-1">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
          <input 
            type="text"
            placeholder="Filtrar mensagens ou motoristas..."
            className="w-full pl-9 pr-4 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <button className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-500 hover:text-emerald-600 transition-colors">
          <Filter size={16} />
        </button>
      </div>

      {/* Messages Feed */}
      <div 
        ref={scrollRef}
        className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth"
      >
        <AnimatePresence initial={false}>
          {filteredMessages.map((msg) => (
            <motion.div
              key={msg.id}
              initial={{ opacity: 0, scale: 0.95, y: 10 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              className={`flex flex-col max-w-[85%] ${msg.sender === 'Central Operacional' ? 'mx-auto w-full max-w-full' : ''}`}
            >
              {msg.type === 'alert' ? (
                <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 rounded-xl flex items-start gap-3">
                  <div className="p-2 bg-amber-100 dark:bg-amber-900/40 text-amber-600 rounded-lg shrink-0">
                    <AlertTriangle size={16} />
                  </div>
                  <div>
                    <span className="text-[10px] font-black uppercase text-amber-600 tracking-wider">Alerta de Sistema</span>
                    <p className="text-xs font-bold text-slate-800 dark:text-slate-200 mt-1 leading-relaxed">
                      {msg.text}
                    </p>
                    <span className="text-[9px] text-amber-500 mt-1 block">
                      {msg.timestamp.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                    </span>
                  </div>
                </div>
              ) : (
                <div className="space-y-1">
                  <div className="flex items-center gap-2 mb-1 px-1">
                    <span className="text-[11px] font-black text-slate-700 dark:text-slate-300">
                      {msg.sender}
                    </span>
                    <span className="text-[9px] font-medium text-slate-400">
                      • {msg.phone}
                    </span>
                  </div>
                  <div className={`p-3 rounded-2xl ${
                    msg.isOperational 
                      ? 'bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-100 dark:border-emerald-800' 
                      : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm'
                  }`}>
                    {msg.type === 'location' ? (
                      <div className="flex items-center gap-3">
                        <div className="p-2 bg-blue-100 dark:bg-blue-900/30 text-blue-600 rounded-lg">
                          <MapPin size={16} />
                        </div>
                        <div>
                          <p className="text-xs font-semibold text-slate-800 dark:text-slate-200">{msg.text}</p>
                          <button className="text-[10px] font-bold text-blue-600 uppercase mt-1 flex items-center gap-1 hover:underline">
                            Ver no Mapa <ChevronRight size={10} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs font-medium text-slate-600 dark:text-slate-300 leading-relaxed">
                        {msg.text}
                      </p>
                    )}
                    <div className="flex items-center justify-end gap-1 mt-1.5">
                      <span className="text-[9px] text-slate-400">
                        {msg.timestamp.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                      </span>
                      <CheckCheck size={12} className="text-emerald-500" />
                    </div>
                  </div>
                </div>
              )}
            </motion.div>
          ))}
        </AnimatePresence>
      </div>

      {/* Footer Info */}
      <div className="p-3 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between">
        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
          Total de Mensagens: {messages.length}
        </p>
        <div className="flex items-center gap-2">
           <Phone size={12} className="text-slate-400" />
           <span className="text-[10px] font-black text-slate-400">+244 CENTRAL LUENA</span>
        </div>
      </div>
    </div>
  );
}
