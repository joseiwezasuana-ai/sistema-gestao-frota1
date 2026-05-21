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
  CheckCheck,
  Settings,
  Link as LinkIcon,
  QrCode,
  RefreshCw,
  Check,
  ExternalLink,
  HelpCircle,
  Smartphone,
  X,
  Radio,
  FileCode2,
  Globe,
  Terminal,
  Cpu,
  Brain,
  Zap,
  Sparkles,
  Send
} from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';

interface WhatsAppMessage {
  id: string;
  sender: string;
  phone: string;
  text: string;
  timestamp: Date;
  type: 'text' | 'location' | 'alert';
  isOperational?: boolean;
  status?: 'pending' | 'dispatched' | 'completed';
}

const MOCK_DRIVERS_MESSAGES: WhatsAppMessage[] = [
  {
    id: 'd1',
    sender: 'Augusto Silva (T-04)',
    phone: '+244 923 111 222',
    text: 'Iniciando turno no Bairro Social. Veículo limpo e tanque cheio.',
    timestamp: new Date(Date.now() - 1000 * 60 * 15),
    type: 'text',
    isOperational: true
  },
  {
    id: 'd2',
    sender: 'Pedro Kiala (T-12)',
    phone: '+244 931 444 555',
    text: 'Localização atual: Mercado Municipal. Aguardando passageiro.',
    timestamp: new Date(Date.now() - 1000 * 60 * 8),
    type: 'location'
  },
  {
    id: 'd3',
    sender: 'Central Operacional',
    phone: 'SISTEMA',
    text: 'ALERTA: Congestionamento na Rua da Independência. Evitem a rota.',
    timestamp: new Date(Date.now() - 1000 * 60 * 5),
    type: 'alert',
    isOperational: true
  },
  {
    id: 'd4',
    sender: 'José Manuel (T-09)',
    phone: '+244 945 777 888',
    text: 'Encerrando corrida. Próxima parada: Aeroporto do Luena.',
    timestamp: new Date(Date.now() - 1000 * 60 * 2),
    type: 'text'
  }
];

const MOCK_CLIENTS_MESSAGES: WhatsAppMessage[] = [
  {
    id: 'c1',
    sender: 'Delfina Manuel',
    phone: '+244 925 333 444',
    text: 'Preciso de um táxi com urgência em frente ao Hospital Geral do Luena para ir ao Bairro Sangondo.',
    timestamp: new Date(Date.now() - 1000 * 60 * 25),
    type: 'text',
    status: 'pending'
  },
  {
    id: 'c2',
    sender: 'António Cavula',
    phone: '+244 932 555 666',
    text: 'Estou com bagagens pesadas e preciso de um táxi. Localização de partida: Mercado Municipal do Luena.',
    timestamp: new Date(Date.now() - 1000 * 60 * 12),
    type: 'location',
    status: 'pending'
  },
  {
    id: 'c3',
    sender: 'Maria Tchissola',
    phone: '+244 941 888 999',
    text: 'Muito obrigada pelo excelente atendimento do motorista Augusto Silva no T-04 hoje de manhã! Muito seguro e cortês.',
    timestamp: new Date(Date.now() - 1000 * 60 * 4),
    type: 'text',
    status: 'completed'
  }
];

export function WhatsAppMonitor() {
  const [activeTab, setActiveTab] = useState<'drivers' | 'clients' | 'baileys'>('drivers');
  const [driverMessages, setDriverMessages] = useState<WhatsAppMessage[]>(MOCK_DRIVERS_MESSAGES);
  const [clientMessages, setClientMessages] = useState<WhatsAppMessage[]>(MOCK_CLIENTS_MESSAGES);
  const [searchTerm, setSearchTerm] = useState('');
  const [replyText, setReplyText] = useState('');
  const scrollRef = useRef<HTMLDivElement>(null);

  // Estados de Configuração de Conexão WhatsApp
  const [showSettings, setShowSettings] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState(() => {
    return localStorage.getItem('taxi_wa_number') || '+244 923 000 000';
  });
  const [driversGroupLink, setDriversGroupLink] = useState(() => {
    return localStorage.getItem('taxi_wa_drivers_link') || 'https://chat.whatsapp.com/GoperatonalDriversLuena';
  });
  const [clientsGroupLink, setClientsGroupLink] = useState(() => {
    return localStorage.getItem('taxi_wa_clients_link') || 'https://chat.whatsapp.com/GclientsTaxiControlLuena';
  });
  const [webhookUrl, setWebhookUrl] = useState(() => {
    return localStorage.getItem('taxi_wa_webhook') || 'https://api.taxicontrol.ao/v1/whatsapp/webhook';
  });
  const [backendApiUrl, setBackendApiUrl] = useState(() => {
    return localStorage.getItem('taxi_wa_backend_api_url') || '';
  });

  const getApiUrl = (endpoint: string) => {
    const customUrl = backendApiUrl.trim();
    if (customUrl) {
      const base = customUrl.endsWith('/') ? customUrl.slice(0, -1) : customUrl;
      const cleanPath = endpoint.startsWith('/') ? endpoint : '/' + endpoint;
      return `${base}${cleanPath}`;
    }
    return endpoint;
  };

  // Auto detect static Firebase hosting (.web.app) and set default backend API URL
  useEffect(() => {
    if (!localStorage.getItem('taxi_wa_backend_api_url')) {
      if (window.location.hostname.endsWith('.web.app') || window.location.hostname.endsWith('.firebaseapp.com')) {
        const defaultBackend = "https://ais-pre-x7ae5zjwislnpda2b3a6l6-214885335133.europe-west3.run.app";
        setBackendApiUrl(defaultBackend);
        localStorage.setItem('taxi_wa_backend_api_url', defaultBackend);
      }
    }
  }, []);

  // Novos Estados Reais do Servidor Baileys
  const [baileysServerState, setBaileysServerState] = useState({
    connected: false,
    status: "idle",
    whatsappNumber: "+244 923 000 000",
    sessionName: "TaxiControl-Luena-MD",
    qrCodeString: null as string | null,
    pairingCode: null as string | null,
    deviceInfo: {
      platform: "Android (Baileys Multi-Device)",
      browser: "Chrome (Ubuntu/Moxico)",
      version: "2.3012.0",
      jid: "",
    },
    logs: [] as string[]
  });

  // Determinar conexão real derivada
  const isConnected = baileysServerState.connected;
  const isGeneratingQR = baileysServerState.status === "connecting";

  // Poll Baileys status from server every 2 seconds
  useEffect(() => {
    const fetchStatus = async () => {
      try {
        const urlToFetch = getApiUrl("/api/whatsapp/baileys/status");
        const res = await fetch(urlToFetch);
        if (res.ok) {
          const contentType = res.headers.get("content-type");
          if (contentType && contentType.includes("application/json")) {
            const data = await res.json();
            setBaileysServerState(data);
          } else {
            console.warn("[Baileys Tracker] Resposta não-JSON (re-direcionado pelo host estático)");
          }
        }
      } catch (err) {
        console.error("Erro ao buscar log centralizado do Baileys:", err);
      }
    };

    fetchStatus();
    const interval = setInterval(fetchStatus, 2000);
    return () => clearInterval(interval);
  }, [backendApiUrl]);

  // Sync virtual list real-time via Firestore (whatsapp_messages)
  useEffect(() => {
    const q = query(collection(db, 'whatsapp_messages'), orderBy('timestamp', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const msgs: any[] = [];
      snapshot.forEach(docSnap => {
        const data = docSnap.data();
        msgs.push({
          id: docSnap.id,
          sender: data.sender || "Desconhecido",
          phone: data.phone || "",
          text: data.text || "",
          timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
          type: data.type || 'text',
          isOperational: data.isOperational,
          status: data.status || 'pending',
          channel: data.channel || 'clients'
        });
      });

      if (msgs.length > 0) {
        setDriverMessages(msgs.filter(m => m.channel === 'drivers' || m.isOperational));
        setClientMessages(msgs.filter(m => m.channel === 'clients' && !m.isOperational));
      } else {
        setDriverMessages(MOCK_DRIVERS_MESSAGES);
        setClientMessages(MOCK_CLIENTS_MESSAGES);
      }
    }, (error) => {
      console.warn("Erro ao ouvir Firestore para whatsapp_messages (usando fallback de teste):", error.message);
    });

    return () => unsubscribe();
  }, []);

  // Auto-scroll para a última mensagem
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [driverMessages, clientMessages, activeTab, showSettings, baileysServerState.logs]);

  const currentMessages = activeTab === 'drivers' ? driverMessages : clientMessages;

  const filteredMessages = currentMessages.filter(msg => 
    msg.text.toLowerCase().includes(searchTerm.toLowerCase()) ||
    msg.sender.toLowerCase().includes(searchTerm.toLowerCase()) ||
    msg.phone.toLowerCase().includes(searchTerm.toLowerCase())
  );

  // Send outbound message via Baileys API
  const handleSendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!replyText.trim()) return;

    const channel = activeTab === 'drivers' ? 'drivers' : 'clients';
    const targetGroup = activeTab === 'drivers' ? driversGroupLink : whatsappNumber;

    try {
      const res = await fetch(getApiUrl("/api/whatsapp/baileys/send"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          to: targetGroup,
          text: replyText,
          channel
        })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success && data.message) {
          const newMessage: WhatsAppMessage = {
            id: data.message.id || `new-${Date.now()}`,
            sender: data.message.sender,
            phone: data.message.phone,
            text: data.message.text,
            timestamp: new Date(data.message.timestamp),
            type: 'text',
            isOperational: channel === 'drivers'
          };

          if (channel === 'drivers') {
            setDriverMessages(prev => {
              const exists = prev.some(m => m.text === newMessage.text && Math.abs(m.timestamp.getTime() - newMessage.timestamp.getTime()) < 10000);
              if (exists) return prev;
              return [...prev, newMessage];
            });
          } else {
            setClientMessages(prev => {
              const exists = prev.some(m => m.text === newMessage.text && Math.abs(m.timestamp.getTime() - newMessage.timestamp.getTime()) < 10000);
              if (exists) return prev;
              return [...prev, newMessage];
            });
          }
        }
        setReplyText('');
      } else {
        // Fallback local caso o endpoint falhe
        const newMessage: WhatsAppMessage = {
          id: `new-${Date.now()}`,
          sender: 'Operador Central',
          phone: whatsappNumber,
          text: replyText,
          timestamp: new Date(),
          type: 'text',
          isOperational: activeTab === 'drivers'
        };

        if (activeTab === 'drivers') {
          setDriverMessages(prev => [...prev, newMessage]);
        } else {
          setClientMessages(prev => [...prev, newMessage]);
        }
        setReplyText('');
      }
    } catch (err) {
      console.error("Erro ao enviar mensagem de saída:", err);
      setReplyText('');
    }
  };

  const handleDispatch = (messageId: string) => {
    setClientMessages(prev => 
      prev.map(msg => 
        msg.id === messageId ? { ...msg, status: 'dispatched' as const } : msg
      )
    );
  };

  const handleSaveSettings = (e: React.FormEvent) => {
    e.preventDefault();
    localStorage.setItem('taxi_wa_number', whatsappNumber);
    localStorage.setItem('taxi_wa_drivers_link', driversGroupLink);
    localStorage.setItem('taxi_wa_clients_link', clientsGroupLink);
    localStorage.setItem('taxi_wa_webhook', webhookUrl);
    setShowSettings(false);
  };

  // Actions da Gateway do Baileys
  const startBaileysConnection = async () => {
    try {
      const res = await fetch(getApiUrl("/api/whatsapp/baileys/connect"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ number: whatsappNumber })
      });
      if (res.ok) {
        console.log("Comando conectar via Baileys disparado com sucesso.");
      }
    } catch (err) {
      console.error("Erro ao mandar comando conectar Baileys:", err);
    }
  };

  const disconnectBaileys = async () => {
    try {
      await fetch(getApiUrl("/api/whatsapp/baileys/disconnect"), { method: "POST" });
    } catch (err) {
      console.error("Erro ao mandar comando desconectar Baileys:", err);
    }
  };

  const simulateBaileysScan = async () => {
    try {
      await fetch(getApiUrl("/api/whatsapp/baileys/simulate-scan"), { method: "POST" });
    } catch (err) {
      console.error("Erro ao mandar comando simular scan Baileys:", err);
    }
  };

  const injectIncomingMessage = async (text: string, sender: string, from: string, channel: 'drivers' | 'clients') => {
    try {
      const res = await fetch(getApiUrl("/api/whatsapp/baileys/simulate-incoming"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ from, sender, text, channel })
      });
      if (res.ok) {
        const data = await res.json();
        if (data.incomingMessage) {
          const nm: WhatsAppMessage = {
            id: data.incomingMessage.id || `inc-${Date.now()}`,
            sender: data.incomingMessage.sender,
            phone: data.incomingMessage.phone,
            text: data.incomingMessage.text,
            timestamp: new Date(data.incomingMessage.timestamp),
            type: 'text',
            isOperational: data.incomingMessage.isOperational
          };
          
          if (channel === 'drivers' || nm.isOperational) {
            setDriverMessages(prev => {
              const exists = prev.some(m => m.text === nm.text && Math.abs(m.timestamp.getTime() - nm.timestamp.getTime()) < 10000);
              if (exists) return prev;
              return [...prev, nm];
            });
          } else {
            setClientMessages(prev => {
              const exists = prev.some(m => m.text === nm.text && Math.abs(m.timestamp.getTime() - nm.timestamp.getTime()) < 10000);
              if (exists) return prev;
              return [...prev, nm];
            });
          }
        }

        // Se houver uma resposta automática simulada, adicionamos ao chat
        if (data.replyMessage) {
          const replyMsg: WhatsAppMessage = {
            id: `reply-${Date.now()}`,
            sender: 'Operador Central',
            phone: whatsappNumber,
            text: data.replyMessage,
            timestamp: new Date(),
            type: 'text',
            isOperational: false
          };
          setClientMessages(prev => {
            const exists = prev.some(m => m.text === replyMsg.text && Math.abs(m.timestamp.getTime() - replyMsg.timestamp.getTime()) < 10000);
            if (exists) return prev;
            return [...prev, replyMsg];
          });
        }
      }
    } catch (err) {
      console.error("Erro ao simular incoming message:", err);
    }
  };


  return (
    <div className="flex flex-col h-[600px] bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-xl">
      {/* Header */}
      <div className="p-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="p-2.5 bg-emerald-100 dark:bg-emerald-950/30 text-emerald-600 rounded-xl">
            <MessageSquare size={20} />
          </div>
          <div>
            <h3 className="font-bold text-slate-900 dark:text-white leading-none">Monitor Central WhatsApp</h3>
            <p className="text-xs text-slate-500 font-medium mt-1">Conectado: Central de Despacho • Luena</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`flex items-center gap-1.5 px-2 py-1 text-[10px] font-bold rounded-md border ${
            isConnected 
              ? 'bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-100 dark:border-emerald-900/40 animate-pulse'
              : 'bg-red-50 dark:bg-red-950/20 text-red-600 dark:text-red-400 border-red-100 dark:border-red-900/40'
          }`}>
            <div className={`w-1.5 h-1.5 rounded-full ${isConnected ? 'bg-emerald-500' : 'bg-red-500'}`} />
            {isConnected ? 'ONLINE' : 'DESCONECTADO'}
          </div>
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className={`p-2 rounded-lg transition-colors ${
              showSettings 
                ? 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900 dark:text-emerald-200' 
                : 'hover:bg-slate-100 dark:hover:bg-slate-700 text-slate-500'
            }`}
            title="Definições de Integração WhatsApp"
          >
            {showSettings ? <X size={18} /> : <Settings size={18} />}
          </button>
        </div>
      </div>

      {/* Tabs Selector */}
      <div className="flex border-b border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-800 p-1 gap-1 shrink-0">
        <button
          id="btn-tab-drivers"
          onClick={() => { setActiveTab('drivers'); setSearchTerm(''); }}
          className={`flex-1 py-2 px-2 text-[11px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'drivers'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
          }`}
        >
          <User size={13} />
          Motoristas / Frota ({driverMessages.length})
        </button>
        <button
          id="btn-tab-clients"
          onClick={() => { setActiveTab('clients'); setSearchTerm(''); }}
          className={`flex-1 py-2 px-2 text-[11px] font-bold rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'clients'
              ? 'bg-emerald-600 text-white shadow-sm'
              : 'text-slate-500 dark:text-slate-400 hover:bg-slate-50 dark:hover:bg-slate-700'
          }`}
        >
          <MessageSquare size={13} />
          Clientes / Pedidos ({clientMessages.length})
        </button>
        <button
          id="btn-tab-baileys"
          onClick={() => { setActiveTab('baileys'); setSearchTerm(''); }}
          className={`flex-1 py-2 px-1.5 text-[11px] font-extrabold uppercase tracking-wide rounded-lg transition-all flex items-center justify-center gap-1.5 ${
            activeTab === 'baileys'
              ? 'bg-amber-500 text-slate-950 shadow-md border border-amber-500/30'
              : 'text-amber-600 dark:text-amber-400 hover:bg-amber-50 dark:hover:bg-slate-700/60'
          }`}
        >
          <Zap size={13} className={activeTab === 'baileys' ? 'animate-bounce' : 'animate-pulse'} />
          Gateway Baileys {isConnected ? '●' : '○'}
        </button>
      </div>

      {/* Toolbar - Only visible when not in settings */}
      {!showSettings && (
        <div className="p-3 bg-slate-50/50 dark:bg-slate-900/50 border-b border-slate-200 dark:border-slate-800 flex items-center gap-3 shrink-0">
          <div className="relative flex-1">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
            <input 
              type="text"
              placeholder={activeTab === 'drivers' ? "Filtrar por mensagem, motorista ou prefixo..." : "Filtrar por mensagem de cliente ou contacto..."}
              className="w-full pl-9 pr-4 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-xs focus:ring-2 focus:ring-emerald-500 outline-none transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="p-2 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 rounded-lg text-slate-500 hover:text-emerald-600 transition-colors">
            <Filter size={16} />
          </button>
        </div>
      )}

      {/* Main Workspace: Settings Panel or Messages Feed */}
      {showSettings ? (
        <div className="flex-1 overflow-y-auto p-5 bg-white dark:bg-slate-900 space-y-5">
          <div className="border-b border-slate-100 dark:border-slate-800 pb-4">
            <h4 className="text-xs font-black uppercase text-emerald-600 dark:text-emerald-400 tracking-wider flex items-center gap-2">
              <Settings size={14} />
              Central de Conexão WhatsApp
            </h4>
            <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-1">
              Configure as ligações externas para integrar os grupos e canais do WhatsApp ao ecossistema do <strong>TaxiControl</strong>.
            </p>
          </div>

          <form onSubmit={handleSaveSettings} className="space-y-4">
            {/* Status de Conexão Física */}
            <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-150 dark:border-slate-800">
              <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider mb-2">Canal Operacional Central</span>
              <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
                <div className="flex items-center gap-3">
                  <div className="p-2 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 rounded-lg">
                    <Smartphone size={20} />
                  </div>
                  <div>
                    <input 
                      type="text"
                      className="bg-transparent font-bold text-sm text-slate-800 dark:text-white border-b border-dashed border-slate-300 dark:border-slate-700 focus:outline-none focus:border-emerald-55 h-6 outline-none"
                      value={whatsappNumber}
                      onChange={(e) => setWhatsappNumber(e.target.value)}
                      placeholder="Nº de Telemóvel"
                    />
                    <p className="text-[10px] text-slate-400 mt-0.5">Identificador da Central no WhatsApp</p>
                  </div>
                </div>

                {isConnected ? (
                  <div className="flex items-center gap-2">
                    <span className="text-[10px] bg-emerald-100 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-400 font-bold px-2.5 py-1 rounded-md">
                      Instância Ativa (Baileys)
                    </span>
                    <button 
                      type="button" 
                      onClick={disconnectBaileys}
                      className="text-[10px] font-bold text-red-600 hover:underline"
                    >
                      Desconectar
                    </button>
                  </div>
                ) : (
                  <button 
                    type="button" 
                    onClick={startBaileysConnection}
                    disabled={isGeneratingQR}
                    className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 disabled:bg-slate-300 text-white text-[10px] font-black uppercase rounded-lg tracking-wider shadow-sm transition-all flex items-center gap-1.5"
                  >
                    {isGeneratingQR ? (
                      <>
                        <RefreshCw size={11} className="animate-spin" />
                        Iniciando link...
                      </>
                    ) : (
                      <>
                        <QrCode size={11} />
                        Ligar Canal Baileys
                      </>
                    )}
                  </button>
                )}
              </div>

              {/* Simulador de QR Code de Pareamento */}
              {isGeneratingQR && (
                <div className="mt-4 flex flex-col items-center justify-center p-4 bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 rounded-xl space-y-3">
                  <div className="relative w-36 h-36 bg-slate-100 dark:bg-slate-900 border-2 border-emerald-500/20 rounded-lg flex items-center justify-center overflow-hidden">
                    {/* Linha de scan simulada */}
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-emerald-550 animate-bounce shadow-md shadow-emerald-500" />
                    {/* QR Code Mocado com blocos CSS */}
                    <div className="grid grid-cols-4 gap-1 p-4 opacity-80 animate-pulse">
                      <div className="w-6 h-6 bg-slate-900 dark:bg-white rounded" />
                      <div className="w-6 h-6 bg-transparent" />
                      <div className="w-6 h-6 bg-slate-900 dark:bg-white rounded" />
                      <div className="w-6 h-6 bg-slate-900 dark:bg-white rounded" />
                      <div className="w-6 h-6 bg-slate-900 dark:bg-white rounded" />
                      <div className="w-6 h-6 bg-slate-900 dark:bg-white rounded" />
                      <div className="w-6 h-6 bg-transparent" />
                      <div className="w-6 h-6 bg-slate-900 dark:bg-white rounded" />
                      <div className="w-6 h-6 bg-transparent" />
                      <div className="w-6 h-6 bg-slate-900 dark:bg-white rounded" />
                      <div className="w-6 h-6 bg-slate-900 dark:bg-white rounded" />
                      <div className="w-6 h-6 bg-transparent" />
                    </div>
                  </div>
                  <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold text-center leading-relaxed max-w-[280px]">
                    Abra o WhatsApp no telemóvel &gt; Dispositivos Associados &gt; Apontar a câmara para parear com a Central do <strong>TaxiControl</strong>.
                  </p>
                </div>
              )}
            </div>

            {/* Links de Convite dos Grupos */}
            <div className="space-y-4">
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-150 dark:border-slate-800 space-y-3">
                <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider">Ligações de Grupos WhatsApp</span>
                
                <div className="space-y-3">
                  <div>
                    <label className="text-[10px] font-bold text-slate-600 dark:text-slate-350 uppercase tracking-wide flex items-center justify-between mb-1.5">
                      <span>Grupo de Motoristas (Frota)</span>
                      <a href={driversGroupLink} target="_blank" rel="noreferrer" className="text-[9px] text-emerald-600 hover:underline flex items-center gap-1 normal-case font-medium">
                        Abrir Link <ExternalLink size={10} />
                      </a>
                    </label>
                    <div className="relative">
                      <LinkIcon size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        type="url"
                        className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-705 rounded-lg text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                        value={driversGroupLink}
                        onChange={(e) => setDriversGroupLink(e.target.value)}
                        placeholder="https://chat.whatsapp.com/..."
                      />
                    </div>
                    <p className="text-[9px] text-slate-450 mt-1">Onde os motoristas enviam relatórios e localização atual.</p>
                  </div>

                  <div>
                    <label className="text-[10px] font-bold text-slate-600 dark:text-slate-350 uppercase tracking-wide flex items-center justify-between mb-1.5">
                      <span>Grupo de Clientes (Pedidos)</span>
                      <a href={clientsGroupLink} target="_blank" rel="noreferrer" className="text-[9px] text-emerald-600 hover:underline flex items-center gap-1 normal-case font-medium">
                        Abrir Link <ExternalLink size={10} />
                      </a>
                    </label>
                    <div className="relative">
                      <LinkIcon size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                      <input 
                        type="url"
                        className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-705 rounded-lg text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                        value={clientsGroupLink}
                        onChange={(e) => setClientsGroupLink(e.target.value)}
                        placeholder="https://chat.whatsapp.com/..."
                      />
                    </div>
                    <p className="text-[9px] text-slate-450 mt-1">Onde os passageiros solicitam táxis e relatam mensagens à central.</p>
                  </div>
                </div>
              </div>

              {/* Integração de API Webhook */}
              <div className="bg-slate-50 dark:bg-slate-800/50 rounded-xl p-4 border border-slate-150 dark:border-slate-800">
                <span className="text-[10px] font-black uppercase text-slate-400 block tracking-wider mb-2">Endpoint Webhook API</span>
                <div>
                  <div className="relative">
                    <Globe size={12} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                    <input 
                      type="url"
                      className="w-full pl-8 pr-3 py-1.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-705 rounded-lg text-xs outline-none focus:ring-2 focus:ring-emerald-500"
                      value={webhookUrl}
                      onChange={(e) => setWebhookUrl(e.target.value)}
                      placeholder="https://..."
                    />
                  </div>
                  <p className="text-[9px] text-slate-450 mt-1.5 leading-relaxed">
                    Endereço para o qual as soluções de integração do WhatsApp (como Z-API, Baileys, Twilio ou Evolux) encaminham as mensagens recebidas para que apareçam em tempo real no monitor central.
                  </p>
                </div>
              </div>

              {/* Guia Técnico Resumido */}
              <div className="bg-emerald-50/50 dark:bg-emerald-950/15 border border-emerald-100 dark:border-emerald-900/40 rounded-xl p-3 flex items-start gap-2.5">
                <HelpCircle size={15} className="text-emerald-600 shrink-0 mt-0.5" />
                <div className="text-[9.5px] text-slate-650 dark:text-slate-350 leading-relaxed font-medium">
                  <strong className="text-emerald-700 dark:text-emerald-400 font-bold block mb-0.5">Como conectar o seu número real ao TaxiControl?</strong>
                  Para receber mensagens reais dos seus grupos de WhatsApp:
                  <ol className="list-decimal pl-4 mt-1 space-y-0.5">
                    <li>Utilize uma solução Gateway do WhatsApp (como Z-API, Baileys, Multi-Device Hooks).</li>
                    <li>Configure a URL do webhook do Gateway com o endereço da central: <code className="bg-slate-100 dark:bg-slate-900 px-1 py-0.5 rounded text-emerald-600 font-semibold">{webhookUrl}</code>.</li>
                    <li>As mensagens de texto e localizações enviadas nos grupos indicados serão direcionadas e exibidas automaticamente nesta central!</li>
                  </ol>
                </div>
              </div>
            </div>

            {/* Ações de Configuração */}
            <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 shrink-0">
              <button 
                type="button"
                onClick={() => setShowSettings(false)}
                className="px-3.5 py-1.5 text-[11px] font-black text-slate-550 dark:text-slate-400 uppercase tracking-wider hover:bg-slate-50 dark:hover:bg-slate-800 rounded-lg transition-colors"
              >
                Voltar
              </button>
              <button 
                type="submit"
                className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white text-[11px] font-black uppercase tracking-wider rounded-lg shadow-sm transition-all flex items-center gap-1"
              >
                Guardar Conexões
              </button>
            </div>
          </form>
        </div>
      ) : activeTab === 'baileys' ? (
        <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-900 text-slate-100">
          
          {/* Configuração Dinâmica de API do Servidor */}
          <div className="p-3 bg-slate-800 border border-slate-700/50 rounded-xl space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-black text-slate-350 tracking-wider flex items-center gap-1">
                <Globe size={11} className="text-blue-400" />
                Configuração do Servidor API (Backend)
              </span>
              <span className="text-[9px] font-black text-amber-400 bg-amber-950/40 border border-amber-900/30 px-2 py-0.5 rounded-full">
                {backendApiUrl ? "Ligado à API" : "Deteção Automática"}
              </span>
            </div>
            <p className="text-[10.5px] text-slate-400 leading-normal">
              José, como o <strong>siatema-auditado.web.app</strong> corre no Firebase Hosting estático, precisamos de ligar este ecrã do monitor ao seu servidor operativo de backend ativo (Cloud Run).
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <input 
                type="text"
                placeholder="Endereço do Backend (ex: https://ais-pre-...run.app)"
                className="flex-1 min-w-0 px-3 py-1.5 bg-black/50 border border-slate-700 rounded-lg text-xs font-mono text-emerald-400 outline-none focus:ring-1 focus:ring-emerald-500 placeholder-slate-600"
                value={backendApiUrl}
                onChange={(e) => {
                  setBackendApiUrl(e.target.value);
                  localStorage.setItem('taxi_wa_backend_api_url', e.target.value);
                }}
              />
              <button 
                type="button"
                onClick={() => {
                  const defaultBackend = "https://ais-pre-x7ae5zjwislnpda2b3a6l6-214885335133.europe-west3.run.app";
                  setBackendApiUrl(defaultBackend);
                  localStorage.setItem('taxi_wa_backend_api_url', defaultBackend);
                }}
                className="px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 active:scale-95 text-xs font-bold text-white uppercase rounded-lg transition-all whitespace-nowrap"
              >
                Carregar Padrão 🚀
              </button>
            </div>
          </div>

          {/* Status Box */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Connection Information */}
            <div className="p-4 bg-slate-800 border border-slate-700 rounded-xl space-y-3 shadow-inner">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 flex items-center gap-1">
                  <Cpu size={12} className="text-emerald-400" />
                  Estado do Canal Baileys
                </span>
                <span className={`w-2 h-2 rounded-full ${isConnected ? 'bg-emerald-500 animate-pulse' : 'bg-red-500'}`} />
              </div>
              
              <div className="space-y-1.5">
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Instância ativa:</span>
                  <span className="font-mono text-white text-[11px] tracking-wide">{baileysServerState.sessionName}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Telemóvel fixado:</span>
                  <span className="font-mono text-white text-[11px] tracking-wide">{baileysServerState.whatsappNumber}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Plataforma engine:</span>
                  <span className="font-mono text-white text-[11px] tracking-wide">{baileysServerState.deviceInfo.platform}</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-slate-400">Protocolo de ligação:</span>
                  <span className="font-mono text-emerald-400 text-[11px] font-semibold">{baileysServerState.status.toUpperCase()}</span>
                </div>
              </div>

              {/* Action Buttons inside status card */}
              <div className="pt-2 border-t border-slate-700 flex gap-2">
                {isConnected ? (
                  <button 
                    type="button"
                    onClick={disconnectBaileys}
                    className="w-full py-2 bg-red-650 hover:bg-red-750 text-white text-[10px] font-black uppercase rounded-lg transition-all"
                  >
                    Desconectar Canal
                  </button>
                ) : baileysServerState.status === "qr_code" ? (
                  <button 
                    type="button"
                    onClick={simulateBaileysScan}
                    className="w-full py-2 bg-amber-500 hover:bg-amber-600 text-slate-900 text-[10px] font-black uppercase rounded-lg transition-all animate-pulse"
                  >
                    Simular Scan QR 📱
                  </button>
                ) : (
                  <button 
                    type="button"
                    onClick={startBaileysConnection}
                    disabled={isGeneratingQR}
                    className="w-full py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase rounded-lg transition-all"
                  >
                    {isGeneratingQR ? "A iniciar ligação socket..." : "Conectar Socket Baileys"}
                  </button>
                )}
              </div>
            </div>

            {/* QR Code Scan Area */}
            <div className="p-4 bg-slate-800 border border-slate-700 rounded-xl flex flex-col items-center justify-center min-h-[140px]">
              {isConnected ? (
                <div className="text-center space-y-2">
                  <div className="inline-flex p-3 bg-emerald-950/50 text-emerald-400 border border-emerald-800/40 rounded-full animate-pulse">
                    <CheckCheck size={28} />
                  </div>
                  <h5 className="text-xs font-bold text-white tracking-wide">Sessão Autenticada Ativa</h5>
                  <p className="text-[10px] text-slate-400 max-w-[210px] mx-auto leading-normal">
                    Serviço de escuta ativo: lendo localizações de motoristas de Moxico e acionando piloto inteligência.
                  </p>
                </div>
              ) : baileysServerState.status === "qr_code" && baileysServerState.qrCodeString ? (
                <div className="text-center space-y-2 w-full flex flex-col items-center">
                  <div className="relative w-24 h-24 bg-white p-2 rounded-lg flex items-center justify-center">
                    {/* Linha de scan verde */}
                    <div className="absolute top-0 left-0 w-full h-0.5 bg-emerald-550 animate-bounce shadow-md shadow-emerald-500" />
                    {/* QR Blocks */}
                    <div className="grid grid-cols-4 gap-1 p-2 opacity-85">
                      <div className="w-4 h-4 bg-slate-900 rounded" />
                      <div className="w-4 h-4 bg-transparent" />
                      <div className="w-4 h-4 bg-slate-900 rounded" />
                      <div className="w-4 h-4 bg-teal-900 rounded" />
                      <div className="w-4 h-4 bg-slate-900 rounded" />
                      <div className="w-4 h-4 bg-slate-900 rounded" />
                      <div className="w-4 h-4 bg-transparent" />
                      <div className="w-4 h-4 bg-slate-900 rounded" />
                    </div>
                  </div>
                  <div className="text-[9px] text-slate-350">
                    Código de Pareamento: <span className="font-mono font-bold text-amber-400 bg-slate-950/60 px-1.5 py-0.5 rounded">{baileysServerState.pairingCode}</span>
                  </div>
                  <button 
                    type="button"
                    onClick={simulateBaileysScan}
                    className="px-2 py-1 bg-emerald-600 hover:bg-emerald-700 text-[9px] font-bold uppercase rounded text-white flex items-center gap-1 hover:scale-105 transition-all"
                  >
                    Simular Scan ➔
                  </button>
                </div>
              ) : (
                <div className="text-center p-3 text-slate-400 space-y-2">
                  <QrCode size={28} className="mx-auto text-slate-600 animate-pulse" />
                  <p className="text-[10px] leading-relaxed">Socket Baileys em stand-by.<br/>Ligar o canal operacional para expor o QR code.</p>
                  <button 
                    type="button"
                    onClick={startBaileysConnection}
                    className="text-[9px] font-extrabold text-emerald-400 hover:underline hover:text-emerald-350 uppercase block mx-auto"
                  >
                    Iniciar Conexão 🚀
                  </button>
                </div>
              )}
            </div>
          </div>

          {/* Terminal Console Logs */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between px-1">
              <span className="text-[10px] uppercase font-black tracking-wider text-slate-400 flex items-center gap-1.5 text-xs">
                <Terminal size={12} className="text-amber-400" />
                Terminal de Logs Criptográficos Baileys WS
              </span>
              <button 
                type="button"
                onClick={startBaileysConnection}
                className="text-[9px] font-bold text-slate-500 hover:text-emerald-400 uppercase transition-all"
              >
                Reiniciar Canal
              </button>
            </div>
            
            <div className="font-mono text-[10px] text-emerald-400 bg-black/95 p-3.5 border border-slate-800 rounded-xl leading-relaxed max-h-[170px] overflow-y-auto shadow-inner space-y-1 select-text scrollbar-thin scrollbar-thumb-zinc-800">
              {baileysServerState.logs && baileysServerState.logs.length > 0 ? (
                baileysServerState.logs.map((logLine, idx) => (
                  <div key={idx} className="whitespace-pre-wrap border-l-2 border-emerald-900/60 pl-2 text-emerald-400">
                    {logLine}
                  </div>
                ))
              ) : (
                <div className="text-slate-600 italic">[Baileys] Nenhum log capturado do socket ainda. Ligar canal operacional acima...</div>
              )}
            </div>
          </div>

          {/* AI Autopilot Simulation Injection */}
          <div className="p-4 bg-slate-800/60 border border-slate-750 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-black tracking-wider text-slate-350 flex items-center gap-1.5">
                <Brain size={12} className="text-purple-400 animate-pulse" />
                Workspace Inteligência Autopilot (Simulador de Triggers)
              </span>
              <span className="text-[9px] font-semibold text-purple-400 uppercase tracking-widest bg-purple-950/40 border border-purple-900/35 px-2 py-0.5 rounded-full">
                Gemini 1.5 Flash Ativo
              </span>
            </div>

            <p className="text-[10.5px] text-slate-400 leading-relaxed mb-2">
              José, injete mensagens simuladas vindas de motoristas ou passageiros do Moxico no WhatsApp para testar a triagem e o piloto automático da central:
            </p>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
              <div className="p-3 bg-slate-800/80 border border-slate-700/60 rounded-lg space-y-2">
                <span className="text-[9px] uppercase font-black tracking-wider text-slate-400 block">Enviar como Passageiro</span>
                <div className="space-y-1.5">
                  <button 
                    type="button"
                    onClick={() => injectIncomingMessage(
                      "Preciso de um táxi com pressa em frente ao Hospital Geral do Luena para ir ao Bairro Sangondo. Meu nome é Delfina Manuel.",
                      "Delfina Manuel",
                      "+244 925 333 444",
                      "clients"
                    )}
                    className="w-full text-left p-1.5 bg-slate-700 hover:bg-slate-650 rounded text-[9.5px] text-slate-300 font-medium truncate flex items-center gap-1.5"
                    title="Simular pedido com endereço no Luena"
                  >
                    <Sparkles size={10} className="text-purple-400 shrink-0" />
                    Pedido: Hospital ➔ Sangondo
                  </button>
                  <button 
                    type="button"
                    onClick={() => injectIncomingMessage(
                      "Queria saber se tem um táxi livre para me levar da Administração Municipal do Luena até a Faculdade de Medicina no Moxico hoje de tarde. Aguardo.",
                      "Manuel Kapenda",
                      "+244 931 777 666",
                      "clients"
                    )}
                    className="w-full text-left p-1.5 bg-slate-700 hover:bg-slate-650 rounded text-[9.5px] text-slate-300 font-medium truncate flex items-center gap-1.5"
                  >
                    <Sparkles size={10} className="text-purple-400 shrink-0" />
                    Pedido: Administração ➔ Faculdade
                  </button>
                </div>
              </div>

              <div className="p-3 bg-slate-800/80 border border-slate-700/60 rounded-lg space-y-2">
                <span className="text-[9px] uppercase font-black tracking-wider text-slate-400 block">Enviar como Motorista</span>
                <div className="space-y-1.5">
                  <div className="flex gap-2">
                    <button 
                      type="button"
                      onClick={() => injectIncomingMessage(
                        "!panico T-09",
                        "José Manuel (T-09)",
                        "+244 945 777 888",
                        "drivers"
                      )}
                      className="flex-1 p-1.5 bg-red-950/45 hover:bg-red-900/30 border border-red-800/25 text-red-400 rounded text-[9.5px] font-bold text-center uppercase tracking-wider"
                    >
                      🆘 SOS T-09
                    </button>
                    <button 
                      type="button"
                      onClick={() => injectIncomingMessage(
                        "!ativo T-04",
                        "Augusto Silva (T-04)",
                        "+244 923 111 222",
                        "drivers"
                      )}
                      className="flex-1 p-1.5 bg-emerald-950/45 hover:bg-emerald-900/30 border border-emerald-800/25 text-emerald-400 rounded text-[9.5px] font-bold text-center uppercase tracking-wider"
                    >
                      ✔ ATIVO T-04
                    </button>
                    <button 
                      type="button"
                      onClick={() => injectIncomingMessage(
                        "!ocupado T-12",
                        "Pedro Kiala (T-12)",
                        "+244 931 444 555",
                        "drivers"
                      )}
                      className="flex-1 p-1.5 bg-amber-950/45 hover:bg-amber-900/30 border border-amber-800/25 text-amber-400 rounded text-[9.5px] font-bold text-center uppercase tracking-wider"
                    >
                      🛑 BUSY T-12
                    </button>
                  </div>
                  <p className="text-[7.5px] text-slate-500 text-center leading-normal">
                    Comandos via Baileys WhatsApp modificam o estado operacional do motorista na base de dados global na hora!
                  </p>
                </div>
              </div>
            </div>
          </div>
        </div>
      ) : (
        <div 
          ref={scrollRef}
          className="flex-1 overflow-y-auto p-4 space-y-4 scroll-smooth"
        >
          <AnimatePresence initial={false}>
            {filteredMessages.length === 0 ? (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 py-12">
                <MessageSquare size={28} className="opacity-40 mb-2" />
                <p className="text-xs font-bold uppercase tracking-wider">Nenhuma mensagem encontrada</p>
              </div>
            ) : (
              filteredMessages.map((msg) => (
                <motion.div
                  key={msg.id}
                  initial={{ opacity: 0, scale: 0.95, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  className={`flex flex-col max-w-[85%] ${
                    msg.sender === 'Central Operacional' || msg.sender === 'Operador Central' 
                      ? 'ml-auto mr-0' 
                      : 'mr-auto ml-0'
                  }`}
                >
                  {msg.type === 'alert' ? (
                    <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 p-3 rounded-xl flex items-start gap-3 w-full">
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
                      <div className={`flex items-center gap-2 mb-1 px-1 ${
                        msg.sender === 'Operador Central' ? 'justify-end' : 'justify-start'
                      }`}>
                        <span className="text-[11px] font-black text-slate-700 dark:text-slate-300">
                          {msg.sender}
                        </span>
                        <span className="text-[9px] font-medium text-slate-400">
                          • {msg.phone}
                        </span>
                      </div>
                      <div className={`p-3 rounded-2xl ${
                        msg.sender === 'Operador Central'
                          ? 'bg-emerald-600 text-white rounded-tr-none'
                          : msg.isOperational 
                            ? 'bg-emerald-55 dark:bg-emerald-950/10 border border-emerald-100 dark:border-emerald-900/40 rounded-tl-none text-slate-800 dark:text-slate-250' 
                            : 'bg-white dark:bg-slate-800 border border-slate-200 dark:border-slate-700 shadow-sm rounded-tl-none text-slate-800 dark:text-slate-250'
                      }`}>
                        {msg.type === 'location' ? (
                          <div className="flex items-center gap-3">
                            <div className={`p-2 rounded-lg ${
                              msg.sender === 'Operador Central' ? 'bg-emerald-700 text-white' : 'bg-blue-100 dark:bg-blue-900/30 text-blue-600'
                            }`}>
                              <MapPin size={16} />
                            </div>
                            <div>
                              <p className="text-xs font-semibold leading-normal">{msg.text}</p>
                              <button className={`text-[10px] font-bold uppercase mt-1.5 flex items-center gap-1 hover:underline ${
                                msg.sender === 'Operador Central' ? 'text-white' : 'text-blue-600 dark:text-blue-400'
                              }`}>
                                Ver no Mapa <ChevronRight size={10} />
                              </button>
                            </div>
                          </div>
                        ) : (
                          <p className="text-xs font-medium leading-relaxed">
                            {msg.text}
                          </p>
                        )}

                        {/* Controle Operativo dos Pedidos de Clientes */}
                        {activeTab === 'clients' && msg.sender !== 'Operador Central' && (
                          <div className="mt-3 pt-2.5 border-t border-slate-100 dark:border-slate-700/50 flex items-center justify-between gap-4">
                            <span className={`text-[9px] font-bold uppercase tracking-wider ${
                              msg.sender === 'Operador Central' ? 'text-emerald-100' : 'text-slate-400 dark:text-slate-500'
                            }`}>
                              Ação Operativa:
                            </span>
                            {msg.status === 'pending' ? (
                              <button
                                onClick={() => handleDispatch(msg.id)}
                                className="px-2.5 py-1 bg-emerald-500 hover:bg-emerald-600 text-white text-[10px] font-black rounded-lg transition-all uppercase tracking-wider shadow-sm flex items-center gap-1"
                              >
                                Despachar Táxi 🚖
                              </button>
                            ) : msg.status === 'dispatched' ? (
                              <span className="text-[10px] text-amber-600 dark:text-amber-400 font-black uppercase tracking-wider bg-amber-50 dark:bg-amber-950/20 px-2 py-0.5 rounded-md border border-amber-100 dark:border-amber-900/40">
                                Táxi Despachado ⚡
                              </span>
                            ) : (
                              <span className="text-[10px] text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider bg-slate-100 dark:bg-slate-700 px-2 py-0.5 rounded-md">
                                Concluído
                              </span>
                            )}
                          </div>
                        )}

                        <div className="flex items-center justify-end gap-1 mt-1.5">
                          <span className={`text-[9px] ${
                            msg.sender === 'Operador Central' ? 'text-emerald-100' : 'text-slate-400'
                          }`}>
                            {msg.timestamp.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' })}
                          </span>
                          <CheckCheck size={12} className={msg.sender === 'Operador Central' ? 'text-emerald-100' : 'text-emerald-500'} />
                        </div>
                      </div>
                    </div>
                  )}
                </motion.div>
              ))
            )}
          </AnimatePresence>
        </div>
      )}

      {/* Quick Reply Form - Only visible when not in settings and not in Baileys panel */}
      {!showSettings && activeTab !== 'baileys' && (
        <form onSubmit={handleSendMessage} className="p-3 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex gap-2 shrink-0">
          <input 
            type="text"
            placeholder={activeTab === 'drivers' ? "Instrução para os motoristas no WhatsApp..." : "Responder ao grupo de clientes no WhatsApp..."}
            className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-none transition-all dark:text-white"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
          />
          <button 
            type="submit"
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm shrink-0 uppercase tracking-wider"
          >
            Enviar
          </button>
        </form>
      )}

      {/* Footer Info */}
      <div className="p-3 bg-white dark:bg-slate-800 border-t border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
        <p className="text-[10px] text-slate-500 font-bold uppercase tracking-wider">
          Total Ativo: {currentMessages.length} mensagens
        </p>
        <div className="flex items-center gap-2">
           <Phone size={12} className="text-slate-400" />
           <span className="text-[10px] font-black text-slate-400">+244 CENTRAL LUENA</span>
        </div>
      </div>
    </div>
  );
}
