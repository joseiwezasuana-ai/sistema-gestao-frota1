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
  Send,
  Camera,
  Loader2
} from 'lucide-react';
import { db } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, addDoc, serverTimestamp } from 'firebase/firestore';
import { cn } from '../lib/utils';

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

interface WhatsAppMonitorProps {
  isMechanicView?: boolean;
  isDriverView?: boolean;
  isAdmin?: boolean;
}

export function WhatsAppMonitor({ isMechanicView = false, isDriverView = false, isAdmin = false }: WhatsAppMonitorProps) {
  const [activeTab, setActiveTab] = useState<'drivers' | 'clients' | 'baileys' | 'meta_webhook'>('drivers');
  const [driverMessages, setDriverMessages] = useState<WhatsAppMessage[]>(MOCK_DRIVERS_MESSAGES);
  const [clientMessages, setClientMessages] = useState<WhatsAppMessage[]>(MOCK_CLIENTS_MESSAGES);
  const [searchTerm, setSearchTerm] = useState('');
  const [replyText, setReplyText] = useState('');
  const [selectedImage, setSelectedImage] = useState<File | null>(null); // State for image
  const fileInputRef = useRef<HTMLInputElement>(null); // Ref for file input
  const cameraInputRef = useRef<HTMLInputElement>(null); // Ref for camera input
  const scrollRef = useRef<HTMLDivElement>(null);

  // ... (rest of the component)

  // Meta Webhook Status State
  const [metaWebhookState, setMetaWebhookState] = useState({
    online: false,
    endpoint: "",
    hasSecret: false,
    hasMetaToken: false,
    timestamp: "",
    lastPing: null as null | string,
  });

  // Determine if we should show Baileys tab
  const showBaileysTab = !isMechanicView && !isDriverView;

  // ... (inside render, update tabs)

  // Estados de Configuração de Conexão WhatsApp
  const [showSettings, setShowSettings] = useState(false);
  const [whatsappNumber, setWhatsappNumber] = useState(() => {
    return localStorage.getItem('taxi_wa_number') || '+244 937 537 330';
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

  // Poll Meta Webhook status
  useEffect(() => {
    if (activeTab !== 'meta_webhook') return;
    const fetchStatus = async () => {
      try {
        const urlToFetch = getApiUrl("/api/meta-webhook/status");
        const res = await fetch(urlToFetch);
        if (res.ok) {
          const data = await res.json();
          setMetaWebhookState({ ...data, lastPing: new Date().toISOString() });
        }
      } catch (err) {
        setMetaWebhookState(prev => ({ ...prev, online: false }));
        console.error("Erro ao buscar status do Meta Webhook:", err);
      }
    };
    fetchStatus();
    const interval = setInterval(fetchStatus, 3000);
    return () => clearInterval(interval);
  }, [backendApiUrl, activeTab]);

  // Auto-detect and heal backend API URL to prevent stale container endpoints
  useEffect(() => {
    const storedBackend = localStorage.getItem('taxi_wa_backend_api_url');
    const isCloudRun = window.location.hostname.endsWith('.run.app') || 
                       window.location.hostname === 'localhost' || 
                       window.location.hostname === '127.0.0.1';
    
    if (isCloudRun) {
      // If we are on Cloud Run, the backend runs in the exact same container,
      // so we don't need any absolute URL. If there is a stale URL stored, clear it.
      if (storedBackend && storedBackend.includes('.run.app') && !storedBackend.includes(window.location.hostname)) {
        setBackendApiUrl('');
        localStorage.removeItem('taxi_wa_backend_api_url');
        console.log("[Auto-Pilot] Endereço de backend obsoleto limpo para usar rotas relativas.");
      }
    } else {
      // For static firebase hosting, default to current origin
      if (!storedBackend) {
        if (window.location.hostname.endsWith('.web.app') || window.location.hostname.endsWith('.firebaseapp.com')) {
          const defaultBackend = window.location.origin;
          setBackendApiUrl(defaultBackend);
          localStorage.setItem('taxi_wa_backend_api_url', defaultBackend);
        }
      }
    }
  }, []);

  // Novos Estados Reais do Servidor Baileys
  const [baileysServerState, setBaileysServerState] = useState({
    connected: false,
    status: "idle",
    whatsappNumber: "+244 937 537 330",
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
  }, [backendApiUrl, isMechanicView, isDriverView]);

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
    <div className={cn("flex flex-col bg-slate-50 dark:bg-slate-900 rounded-3xl border border-slate-200 dark:border-slate-800 overflow-hidden shadow-2xl transition-all flex-1 min-h-[600px]", (isMechanicView || isDriverView) ? "h-full" : "h-[850px]")}>
      {/* Header Premium */}
      <div className="p-5 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-4">
          <div className="w-12 h-12 bg-emerald-500 dark:bg-emerald-600 text-white rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20 rotate-3">
            <MessageSquare size={24} />
          </div>
          <div>
            <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-tighter text-lg leading-none">Monitor WhatsApp</h3>
            <div className="flex items-center gap-2 mt-1.5">
              <span className="flex items-center gap-1 text-[10px] font-black text-emerald-600 dark:text-emerald-400 uppercase tracking-widest bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded-md">
                <div className={cn("w-1.5 h-1.5 rounded-full animate-pulse", isConnected ? "bg-emerald-500" : "bg-red-500")} />
                {isConnected ? 'Online' : 'Offline'}
              </span>
              <span className="text-[10px] text-slate-400 font-bold uppercase tracking-widest leading-none">• LUENA HUB</span>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <div className="hidden sm:flex flex-col items-right text-right mr-2 leading-none">
            <span className="text-[9px] font-black text-slate-400 uppercase">Audit Hub</span>
            <span className="text-[10px] font-black text-slate-900 dark:text-white italic">Ativo 24h</span>
          </div>
          {isAdmin && (
          <button 
            onClick={() => setShowSettings(!showSettings)}
            className={cn(
              "w-11 h-11 rounded-xl flex items-center justify-center transition-all active:scale-90 border shadow-lg",
              showSettings 
                ? "bg-slate-900 text-white border-slate-900" 
                : "bg-slate-50 dark:bg-slate-800 text-slate-500 border-slate-200 dark:border-slate-700 hover:bg-slate-100 dark:hover:bg-slate-705"
            )}
          >
            {showSettings ? <X size={20} /> : <Settings size={20} />}
          </button>
          )}
        </div>
      </div>

      {/* Enhanced Tabs Selector */}
      <div className="flex bg-slate-100 dark:bg-slate-950 p-1.5 gap-1.5 shrink-0 overflow-x-auto custom-scrollbar no-scrollbar">
        <button
          id="btn-tab-drivers"
          onClick={() => { setActiveTab('drivers'); setSearchTerm(''); }}
          className={cn(
            "flex-1 py-3 px-3 rounded-2xl transition-all flex items-center justify-center gap-2 border",
            activeTab === 'drivers'
              ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-xl"
              : "bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
          )}
        >
          <User size={15} />
          <div className="flex flex-col items-start text-left">
            <span className="text-[10px] font-black uppercase tracking-widest leading-none">Frota Live</span>
            <span className={cn("text-[8px] font-bold mt-0.5", activeTab === 'drivers' ? "text-slate-300 dark:text-slate-500" : "text-emerald-500")}>
              {driverMessages.length} Activos
            </span>
          </div>
        </button>
        {!isMechanicView && (
          <button
            id="btn-tab-clients"
            onClick={() => { setActiveTab('clients'); setSearchTerm(''); }}
            className={cn(
              "flex-1 py-3 px-3 rounded-2xl transition-all flex items-center justify-center gap-2 border",
              activeTab === 'clients'
                ? "bg-slate-900 dark:bg-white text-white dark:text-slate-900 border-slate-900 dark:border-white shadow-xl"
                : "bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-700"
            )}
          >
            <MessageSquare size={15} />
            <div className="flex flex-col items-start text-left">
              <span className="text-[10px] font-black uppercase tracking-widest leading-none">Clientes</span>
              <span className={cn("text-[8px] font-bold mt-0.5", activeTab === 'clients' ? "text-slate-300 dark:text-slate-500" : "text-blue-500")}>
                {clientMessages.length} Mensagens
              </span>
            </div>
          </button>
        )}
        {showBaileysTab && (
          <>
            <button
              id="btn-tab-baileys"
              onClick={() => { setActiveTab('baileys'); setSearchTerm(''); }}
              className={cn(
                "flex-1 py-3 px-3 rounded-2xl transition-all flex items-center justify-center gap-2 border",
                activeTab === 'baileys'
                  ? "bg-amber-500 text-slate-950 border-amber-500 shadow-xl"
                  : "bg-white dark:bg-slate-800 text-amber-600 dark:text-amber-400 border-slate-200 dark:border-slate-700 hover:bg-amber-50 dark:hover:bg-amber-950/20"
              )}
            >
              <Zap size={15} className={activeTab === 'baileys' ? "animate-bounce" : "animate-pulse"} />
              <div className="flex flex-col items-start text-left">
                <span className="text-[10px] font-black uppercase tracking-widest leading-none">Gateway</span>
                <span className={cn("text-[8px] font-bold mt-0.5 whitespace-nowrap", activeTab === 'baileys' ? "text-amber-900" : "text-amber-600/70")}>
                  Baileys Hub
                </span>
              </div>
            </button>
            <button
              id="btn-tab-meta"
              onClick={() => { setActiveTab('meta_webhook'); setSearchTerm(''); }}
              className={cn(
                "flex-1 py-3 px-3 rounded-2xl transition-all flex items-center justify-center gap-2 border",
                activeTab === 'meta_webhook'
                  ? "bg-emerald-500 text-slate-950 border-emerald-500 shadow-xl"
                  : "bg-white dark:bg-slate-800 text-emerald-600 dark:text-emerald-400 border-slate-200 dark:border-slate-700 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
              )}
            >
              <Globe size={15} className={activeTab === 'meta_webhook' && metaWebhookState.online ? "animate-pulse" : ""} />
              <div className="flex flex-col items-start text-left">
                <span className="text-[10px] font-black uppercase tracking-widest leading-none">Meta API</span>
                <span className={cn("text-[8px] font-bold mt-0.5 whitespace-nowrap", activeTab === 'meta_webhook' ? "text-emerald-900" : "text-emerald-600/70")}>
                  Webhook
                </span>
              </div>
            </button>
          </>
        )}
      </div>

      {/* Enhanced Toolbar */}
      {!showSettings && (
        <div className="px-5 py-4 bg-white dark:bg-slate-800 border-b border-slate-200 dark:border-slate-700 flex items-center gap-4 shrink-0 shadow-sm relative z-10">
          <div className="relative flex-1 group">
            <Search size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400 group-focus-within:text-emerald-500 transition-colors" />
            <input 
              type="text"
              placeholder={activeTab === 'drivers' ? "Filtrar por mensagem, motorista ou prefixo..." : "Filtrar por mensagem de cliente ou contacto..."}
              className="w-full pl-11 pr-4 py-3 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl text-xs font-medium focus:ring-4 focus:ring-emerald-500/10 focus:border-emerald-500/50 outline-none transition-all placeholder:text-slate-400"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          <button className="w-11 h-11 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-xl text-slate-400 hover:text-emerald-500 transition-all active:scale-95 flex items-center justify-center shadow-sm">
            <Filter size={18} />
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
        <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-100 dark:bg-slate-950">
          
          {/* Dashboard Operacional Rápido */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-2">
            <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
              <div className="w-8 h-8 bg-emerald-100 dark:bg-emerald-950/40 text-emerald-600 rounded-lg flex items-center justify-center">
                <CheckCheck size={16} />
              </div>
              <div className="flex flex-col">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Sincronização</span>
                <span className="text-xs font-black text-slate-800 dark:text-white">Estável</span>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3">
              <div className="w-8 h-8 bg-blue-100 dark:bg-blue-950/40 text-blue-600 rounded-lg flex items-center justify-center">
                <Radio size={16} className="animate-pulse" />
              </div>
              <div className="flex flex-col">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Latência Hub</span>
                <span className="text-xs font-black text-slate-800 dark:text-white">124ms</span>
              </div>
            </div>
            <div className="bg-white dark:bg-slate-900 p-3 rounded-2xl border border-slate-200 dark:border-slate-800 shadow-sm flex items-center gap-3 col-span-2">
              <div className="w-8 h-8 bg-amber-100 dark:bg-amber-950/40 text-amber-600 rounded-lg flex items-center justify-center">
                <Sparkles size={16} />
              </div>
              <div className="flex flex-col">
                <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest">IA Audit Ativa</span>
                <span className="text-xs font-black text-slate-800 dark:text-white">Triagem Automática Luena ON</span>
              </div>
            </div>
          </div>

          <div className="p-3 bg-slate-200 dark:bg-slate-900 border border-slate-300 dark:border-slate-800 rounded-2xl space-y-3 shadow-inner">
            <div className="flex items-center justify-between">
              <span className="text-[10px] uppercase font-black text-slate-500 dark:text-slate-400 tracking-widest flex items-center gap-2">
                <Globe size={11} className="text-emerald-500" />
                Configuração Endereço Backend
              </span>
              {backendApiUrl && (
                <span className="text-[8px] font-bold text-emerald-500 bg-emerald-500/10 px-2 py-0.5 rounded-full border border-emerald-500/20">
                  LIGADO
                </span>
              )}
            </div>
            <div className="flex flex-col sm:flex-row gap-2">
              <input 
                type="text"
                placeholder="Endereço do Servidor de APIs..."
                className="flex-1 px-4 py-2.5 bg-white dark:bg-slate-950 border border-slate-300 dark:border-slate-800 rounded-xl text-[11px] font-mono text-emerald-600 outline-none focus:ring-2 focus:ring-emerald-500/50"
                value={backendApiUrl}
                onChange={(e) => {
                  setBackendApiUrl(e.target.value);
                  localStorage.setItem('taxi_wa_backend_api_url', e.target.value);
                }}
              />
              <button 
                type="button"
                onClick={() => {
                  const defaultBackend = window.location.origin;
                  setBackendApiUrl(defaultBackend);
                  localStorage.setItem('taxi_wa_backend_api_url', defaultBackend);
                }}
                className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-[10px] font-black uppercase rounded-xl transition-all shadow-lg active:scale-95"
              >
                Reset ⚡
              </button>
            </div>
          </div>

          {/* Status Box Hub */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {/* Connection Information */}
            <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-black tracking-widest text-slate-400 flex items-center gap-2">
                  <Cpu size={14} className="text-emerald-500" />
                  Estado Baileys MD
                </span>
                <div className={cn("w-3 h-3 rounded-full shadow-lg", isConnected ? "bg-emerald-500 shadow-emerald-500/20" : "bg-red-500")} />
              </div>
              
              <div className="space-y-3 bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-900">
                <div className="flex justify-between items-center group">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Instância:</span>
                  <span className="font-mono text-slate-900 dark:text-white text-[11px]">{baileysServerState.sessionName}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Telemóvel:</span>
                  <span className="font-mono text-slate-900 dark:text-white text-[11px]">{baileysServerState.whatsappNumber}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Protocolo:</span>
                  <span className="font-mono text-emerald-500 text-[11px] font-black uppercase tracking-widest">{baileysServerState.status}</span>
                </div>
              </div>

              <div className="pt-2 flex gap-3">
                {isConnected ? (
                  <button 
                    type="button"
                    onClick={disconnectBaileys}
                    className="flex-1 py-3.5 bg-red-600 hover:bg-red-700 text-white text-[10px] font-black uppercase rounded-2xl transition-all shadow-lg active:scale-95"
                  >
                    Desconectar Canal
                  </button>
                ) : baileysServerState.status === "qr_code" ? (
                  <button 
                    type="button"
                    onClick={simulateBaileysScan}
                    className="flex-1 py-3.5 bg-amber-500 hover:bg-amber-600 text-slate-950 text-[10px] font-black uppercase rounded-2xl transition-all animate-pulse shadow-lg active:scale-95"
                  >
                    Simular Leitura QR 📸
                  </button>
                ) : (
                  <button 
                    type="button"
                    onClick={startBaileysConnection}
                    disabled={isGeneratingQR}
                    className="flex-1 py-3.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black uppercase rounded-2xl transition-all shadow-lg active:scale-95"
                  >
                    {isGeneratingQR ? "Ligando à Gateway..." : "Ligar Canal Baileys"}
                  </button>
                )}
              </div>
            </div>

            {/* QR Code Area Hub */}
            <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl flex flex-col items-center justify-center min-h-[180px] shadow-sm">
              {isConnected ? (
                <div className="text-center space-y-4">
                  <div className="inline-flex p-5 bg-emerald-500 dark:bg-emerald-600 text-white rounded-3xl shadow-xl shadow-emerald-500/20 scale-110">
                    <CheckCheck size={32} />
                  </div>
                  <div>
                    <h5 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Sessão Ativa Ativa</h5>
                    <p className="text-[10px] text-slate-400 mt-1 max-w-[200px] leading-relaxed mx-auto font-medium">
                      O hub operacional está recebendo e descriptografando dados de Luena.
                    </p>
                  </div>
                </div>
              ) : baileysServerState.status === "qr_code" && baileysServerState.qrCodeString ? (
                <div className="text-center space-y-3 w-full flex flex-col items-center">
                  <div className="relative w-32 h-32 bg-white p-3 rounded-2xl border-4 border-slate-100 shadow-xl overflow-hidden flex items-center justify-center">
                    <div className="absolute top-0 left-0 w-full h-1 bg-emerald-500 animate-scan shadow-lg shadow-emerald-500" />
                    <div className="grid grid-cols-4 gap-1 p-2 opacity-90">
                      <div className="w-5 h-5 bg-slate-900 rounded-sm" />
                      <div className="w-5 h-5 bg-transparent" />
                      <div className="w-5 h-5 bg-slate-900 rounded-sm" />
                      <div className="w-5 h-5 bg-teal-800 rounded-sm" />
                      <div className="w-5 h-5 bg-slate-900 rounded-sm" />
                      <div className="w-5 h-5 bg-slate-900 rounded-sm" />
                      <div className="w-5 h-5 bg-transparent" />
                      <div className="w-5 h-5 bg-emerald-700 rounded-sm" />
                    </div>
                  </div>
                  <div className="text-[10px] font-black text-slate-800 dark:text-slate-200">
                    Código MD: <span className="font-mono text-amber-500 bg-slate-100 dark:bg-slate-950 px-2 py-1 rounded-lg ml-1 border border-slate-200 dark:border-slate-800">{baileysServerState.pairingCode}</span>
                  </div>
                </div>
              ) : (
                <div className="text-center space-y-4">
                  <div className="w-16 h-16 mx-auto bg-slate-50 dark:bg-slate-950 rounded-2xl flex items-center justify-center text-slate-300 dark:text-slate-800 border border-slate-200 dark:border-slate-800">
                    <QrCode size={32} />
                  </div>
                  <div className="space-y-1">
                    <h5 className="text-[11px] font-black text-slate-400 uppercase tracking-widest leading-none">Stand-by</h5>
                    <p className="text-[9px] text-slate-400 font-medium leading-relaxed">Inicie o socket para obter<br/>um novo código de sessão.</p>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Terminal Console Hub */}
          <div className="space-y-3">
            <div className="flex items-center justify-between px-2">
              <span className="text-[10px] uppercase font-black tracking-widest text-slate-500 dark:text-slate-400 flex items-center gap-2">
                <Terminal size={14} className="text-amber-500" />
                Consola Estrutural Baileys Webhook
              </span>
              <button 
                type="button"
                onClick={startBaileysConnection}
                className="text-[9px] font-black text-emerald-600 uppercase hover:underline"
              >
                Recarregar Socket
              </button>
            </div>
            
            <div className="font-mono text-[10px] bg-slate-900 dark:bg-black p-5 border border-slate-200 dark:border-slate-800 rounded-3xl leading-relaxed max-h-[220px] overflow-y-auto shadow-inner space-y-2 select-text custom-scrollbar">
              {baileysServerState.logs && baileysServerState.logs.length > 0 ? (
                baileysServerState.logs.map((logLine, idx) => (
                  <div key={idx} className="flex gap-3 text-emerald-400/90 group leading-snug">
                    <span className="text-slate-600 shrink-0 select-none">[{idx.toString().padStart(3, '0')}]</span>
                    <span className="whitespace-pre-wrap">{logLine}</span>
                  </div>
                ))
              ) : (
                <div className="flex items-center justify-center py-10 gap-3 text-slate-700 italic">
                  <Loader2 size={16} className="animate-spin text-emerald-500" />
                  Aguarda inicialização do socket...
                </div>
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
      ) : activeTab === 'meta_webhook' ? (
        <div className="flex-1 overflow-y-auto p-4 space-y-6 bg-slate-100 dark:bg-slate-950">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl space-y-4 shadow-sm">
              <div className="flex items-center justify-between">
                <span className="text-[10px] uppercase font-black tracking-widest text-slate-400 flex items-center gap-2">
                  <Globe size={14} className="text-emerald-500" />
                  Meta Webhook Status
                </span>
                <div className={cn("w-3 h-3 rounded-full shadow-lg", metaWebhookState.online ? "bg-emerald-500 shadow-emerald-500/20" : "bg-red-500")} />
              </div>
              
              <div className="space-y-3 bg-slate-50 dark:bg-slate-950 p-4 rounded-2xl border border-slate-100 dark:border-slate-900">
                <div className="flex justify-between items-center group">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Endpoint:</span>
                  <span className="font-mono text-slate-900 dark:text-white text-[11px]">{metaWebhookState.endpoint}</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Webhook Secret:</span>
                  <span className={cn("text-[11px] font-black uppercase tracking-widest", metaWebhookState.hasSecret ? "text-emerald-500" : "text-red-500")}>
                    {metaWebhookState.hasSecret ? "Configurado" : "Ausente"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Meta Token:</span>
                   <span className={cn("text-[11px] font-black uppercase tracking-widest", metaWebhookState.hasMetaToken ? "text-emerald-500" : "text-amber-500")}>
                    {metaWebhookState.hasMetaToken ? "Configurado" : "Opcional"}
                  </span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-[10px] font-bold text-slate-400 uppercase">Último Ping:</span>
                  <span className="font-mono text-slate-900 dark:text-white text-[10px] text-right">
                    {metaWebhookState.lastPing ? new Date(metaWebhookState.lastPing).toLocaleTimeString() : 'A aguardar...'}
                  </span>
                </div>
              </div>

              <div className="pt-2">
                 <button 
                   type="button"
                   onClick={() => window.open(webhookUrl || "https://api.taxicontrol.ao/v1/whatsapp/webhook", '_blank')}
                   className="w-full py-3.5 bg-slate-900 dark:bg-white text-white dark:text-slate-900 text-[10px] font-black uppercase rounded-2xl transition-all shadow-lg active:scale-95 flex items-center justify-center gap-2"
                 >
                   Testar Conectividade Externa
                   <ExternalLink size={12} />
                 </button>
              </div>
            </div>

            <div className="p-5 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-sm text-center flex flex-col items-center justify-center min-h-[220px]">
               {metaWebhookState.online && metaWebhookState.hasSecret ? (
                 <>
                   <div className="inline-flex p-5 bg-emerald-500/10 text-emerald-600 rounded-3xl scale-110 mb-4">
                     <CheckCheck size={40} />
                   </div>
                   <h5 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Handshake Seguro</h5>
                   <p className="text-[10px] text-slate-400 mt-2 max-w-[240px] leading-relaxed mx-auto font-medium">
                     O servidor está online e a responder ao challenge da Meta Cloud API com verificação 256 bits.
                   </p>
                 </>
               ) : (
                 <>
                   <div className="inline-flex p-5 bg-red-500/10 text-red-600 rounded-3xl scale-110 mb-4">
                     <AlertTriangle size={40} />
                   </div>
                   <h5 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tight">Handshake Inativo</h5>
                   <p className="text-[10px] text-slate-400 mt-2 max-w-[240px] leading-relaxed mx-auto font-medium">
                     Webhook falhou verificação ou API está em baixo.
                   </p>
                 </>
               )}
            </div>
          </div>
          
          <div className="p-4 bg-slate-900 rounded-3xl shadow-inner border border-slate-800 overflow-hidden">
             <div className="flex items-center gap-2 mb-3 border-b border-slate-800 pb-3">
               <Terminal size={14} className="text-emerald-500" />
               <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Logs de Sincronização Webhook</span>
             </div>
             <div className="h-40 overflow-y-auto space-y-1 custom-scrollbar text-[9px] font-mono leading-relaxed">
                <div className="text-emerald-400/80">[{new Date().toLocaleTimeString()}] Handshake Meta Cloud API verificado com Sucesso.</div>
                {metaWebhookState.online && <div className="text-slate-400 mt-1">[{new Date().toISOString()}] Ping /api/meta-webhook/status HTTP 200 OK</div>}
                {!metaWebhookState.hasSecret && <div className="text-red-400 mt-1">[ALERTA] WEBHOOK_SECRET obrigatório não carregado nas env vars.</div>}
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
          <button 
            type="button"
            onClick={() => fileInputRef.current?.click()}
            className={cn("p-2 rounded-xl transition-all", selectedImage ? "bg-emerald-100 text-emerald-700" : "text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700")}
            title="Adicionar imagem"
          >
            <LinkIcon size={18} />
          </button>
          
          <button 
            type="button"
            onClick={() => cameraInputRef.current?.click()}
            className="p-2 rounded-xl transition-all text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700"
            title="Tirar foto"
          >
            <Camera size={18} />
          </button>
          
          <input type="file" ref={fileInputRef} onChange={e => setSelectedImage(e.target.files?.[0] || null)} hidden accept="image/*" />
          <input type="file" ref={cameraInputRef} onChange={e => setSelectedImage(e.target.files?.[0] || null)} hidden accept="image/*" capture="environment" />
          
          <input 
            type="text"
            placeholder={selectedImage ? `Imagem selecionada: ${selectedImage.name}` : (activeTab === 'drivers' ? "Instrução para os motoristas no WhatsApp..." : "Responder ao grupo de clientes no WhatsApp...")}
            className="flex-1 px-3 py-2 bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 rounded-xl text-xs focus:ring-2 focus:ring-emerald-500 outline-none transition-all dark:text-white"
            value={replyText}
            onChange={(e) => setReplyText(e.target.value)}
          />
          <button 
            type="submit"
            className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white font-bold text-xs rounded-xl transition-all shadow-sm shrink-0 uppercase tracking-wider"
          >
            {selectedImage ? "Enviar Imagem" : "Enviar"}
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
