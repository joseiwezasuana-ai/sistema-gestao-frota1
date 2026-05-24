import React, { useState, useEffect, useCallback } from 'react';
import { 
  FileText, 
  Phone, 
  MessageSquare, 
  Search, 
  AlertCircle, 
  Trash2, 
  Plus, 
  X, 
  Loader2, 
  ShieldCheck, 
  Activity, 
  Calendar, 
  Send, 
  Smartphone, 
  Download, 
  User, 
  CheckCircle2, 
  Calculator, 
  TrendingUp, 
  Sparkles,
  ArrowUpRight,
  Filter
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot, addDoc, deleteDoc, doc, query, orderBy, getDocs, where, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { cn } from '../lib/utils';
import { smsService } from '../services/smsService';
import { geminiService } from '../services/geminiService';

export default function CallSmsDossier() {
  // Core state
  const [drivers, setDrivers] = useState<any[]>([]);
  const [calls, setCalls] = useState<any[]>([]);
  const [smsLogs, setSmsLogs] = useState<any[]>([]);
  const [phones, setPhones] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Search and Filter states
  const [searchTerm, setSearchTerm] = useState('');
  const [activityFilter, setActivityFilter] = useState<'all' | 'high' | 'low' | 'none'>('all');
  
  // Selected Driver for detailed Dossier Modal
  const [selectedDriver, setSelectedDriver] = useState<any>(null);
  const [dossierTab, setDossierTab] = useState<'calls' | 'sms' | 'audit'>('calls');
  
  // AI Audit states
  const [isAuditing, setIsAuditing] = useState(false);
  const [aiReport, setAiReport] = useState<string | null>(null);
  
  // Create SMS Modal state
  const [isSmsModalOpen, setIsSmsModalOpen] = useState(false);
  const [smsTargetNumber, setSmsTargetNumber] = useState('');
  const [smsContent, setSmsContent] = useState('');
  const [smsSending, setSmsSending] = useState(false);
  const [smsError, setSmsError] = useState<string | null>(null);

  // Manual Log Call Modal state
  const [isCallModalOpen, setIsCallModalOpen] = useState(false);
  const [callDriverName, setCallDriverName] = useState('');
  const [callCustomerName, setCallCustomerName] = useState('');
  const [callCustomerPhone, setCallCustomerPhone] = useState('');
  const [callPickupAddress, setCallPickupAddress] = useState('');
  const [callPrice, setCallPrice] = useState('0');
  const [callStatus, setCallStatus] = useState('completed');
  const [callSubmitting, setCallSubmitting] = useState(false);
  const [callError, setCallError] = useState<string | null>(null);

  // Subscribe to central collections real-time
  useEffect(() => {
    setLoading(true);

    // 1. Master Drivers List
    const qDrivers = query(collection(db, 'drivers_master'), orderBy('name', 'asc'));
    const unsubDrivers = onSnapshot(qDrivers, (snapshot) => {
      setDrivers(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'drivers_master');
    });

    // 2. All calls logs
    const qCalls = query(collection(db, 'calls'), orderBy('timestamp', 'desc'));
    const unsubCalls = onSnapshot(qCalls, (snapshot) => {
      setCalls(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'calls');
    });

    // 3. All SMS logs
    const qSms = query(collection(db, 'sms_logs'), orderBy('timestamp', 'desc'));
    const unsubSms = onSnapshot(qSms, (snapshot) => {
      setSmsLogs(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'sms_logs');
    });

    // 4. PSM Phones list to match assigned driver terminals
    const qPhones = query(collection(db, 'psm_phones'));
    const unsubPhones = onSnapshot(qPhones, (snapshot) => {
      setPhones(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'psm_phones');
      setLoading(false);
    });

    return () => {
      unsubDrivers();
      unsubCalls();
      unsubSms();
      unsubPhones();
    };
  }, []);

  // Helper: cleans phone for matching (+244 923 111 222 -> 923111222)
  const cleanPhoneNum = (num: string): string => {
    return (num || '').replace(/\D/g, '').replace(/^244/, '').trim();
  };

  // Compile calculations for each driver
  const compiledDrivers = drivers.map(driver => {
    const driverCleanPhone = cleanPhoneNum(driver.phone);
    
    // Find all terminals linked (assigned) to this driver in psm_phones
    const assignedTerminals = phones.filter(p => 
      p.assignedToId === driver.id || 
      p.assignedTo?.toLowerCase() === driver.name?.toLowerCase()
    );
    const terminalPhones = assignedTerminals.map(p => cleanPhoneNum(p.number));

    // Calls where driverName matches OR driverId matches OR driver's personal/assigned terminal phone matches
    const driverCalls = calls.filter(call => {
      const matchName = call.driverName?.toLowerCase() === driver.name?.toLowerCase() ||
                        call.driverInfo?.name?.toLowerCase() === driver.name?.toLowerCase();
      const matchId = call.driverId === driver.id;
      
      const cleanCustomerPhone = cleanPhoneNum(call.customerPhone);
      const matchTerminalPhone = terminalPhones.includes(cleanCustomerPhone) || 
                                 cleanCustomerPhone === driverCleanPhone;
                                 
      return matchName || matchId || matchTerminalPhone;
    });

    // SMS where driver's clean phone matches OR linked terminalPhones matches targets
    const driverSms = smsLogs.filter(sms => {
      const targets = sms.targets || [];
      return targets.some((t: string) => {
        const ct = cleanPhoneNum(t);
        return ct === driverCleanPhone || terminalPhones.includes(ct);
      });
    });

    const totalLogs = driverCalls.length + driverSms.length;
    const completedCalls = driverCalls.filter(c => c.status === 'completed' || c.status === 'concluída').length;
    const conversionRate = driverCalls.length > 0 
      ? Math.round((completedCalls / driverCalls.length) * 100) 
      : 100;

    const totalEarnings = driverCalls
      .filter(c => c.status === 'completed' || c.status === 'concluída')
      .reduce((sum, c) => sum + (Number(c.price) || 0), 0);

    // Get last active communication date
    let lastActive: any = null;
    if (driverCalls.length > 0 || driverSms.length > 0) {
      const dates: Date[] = [];
      if (driverCalls[0]?.timestamp) {
        const cDate = driverCalls[0].timestamp.toDate ? driverCalls[0].timestamp.toDate() : new Date(driverCalls[0].timestamp);
        dates.push(cDate);
      }
      if (driverSms[0]?.timestamp) {
        const sDate = driverSms[0].timestamp.toDate ? driverSms[0].timestamp.toDate() : new Date(driverSms[0].timestamp);
        dates.push(sDate);
      }
      if (dates.length > 0) {
        lastActive = new Date(Math.max(...dates.map(d => d.getTime())));
      }
    }

    return {
      ...driver,
      assignedTerminals,
      callsCount: driverCalls.length,
      completedCallsCount: completedCalls,
      smsCount: driverSms.length,
      totalLogs,
      conversionRate,
      totalEarnings,
      lastActive,
      rawCalls: driverCalls,
      rawSms: driverSms
    };
  });

  // Filter based on search and activity
  const filteredDrivers = compiledDrivers.filter(d => {
    const matchesSearch = d.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          d.phone.includes(searchTerm) ||
                          (d.licenseNumber || '').toLowerCase().includes(searchTerm.toLowerCase());
    
    if (activityFilter === 'high') {
      return matchesSearch && d.totalLogs >= 10;
    }
    if (activityFilter === 'low') {
      return matchesSearch && d.totalLogs > 0 && d.totalLogs < 10;
    }
    if (activityFilter === 'none') {
      return matchesSearch && d.totalLogs === 0;
    }
    return matchesSearch;
  });

  // Run Gemini Performance Audit
  const handleRunAudit = async (driver: any) => {
    setIsAuditing(true);
    setAiReport(null);
    try {
      const stats = {
        totalCalls: driver.callsCount,
        completedCalls: driver.completedCallsCount,
        totalSms: driver.smsCount,
        conversionRate: `${driver.conversionRate}%`,
        totalEarnings: `${driver.totalEarnings} AOA`,
        recentCallStatus: driver.rawCalls.slice(0, 5).map((c: any) => c.status),
        fleetOperatorLabel: "PSM TaxiControl Luena"
      };
      
      const report = await geminiService.getDriverPerformanceAudit(driver, stats);
      setAiReport(report);
    } catch (err: any) {
      console.error("Gemini Performance Audit Error:", err);
      setAiReport("Falha ao gerar auditoria de desempenho via IA.");
    } finally {
      setIsAuditing(false);
    }
  };

  // Close logs dossier modal and reset AI reports
  const handleCloseDossier = () => {
    setSelectedDriver(null);
    setAiReport(null);
  };

  // Send communication log (SMS)
  const dispatchSmsForm = async (e: React.FormEvent) => {
    e.preventDefault();
    setSmsError(null);
    
    if (!smsTargetNumber) {
      setSmsError("Por favor, introduza um número de telefone.");
      return;
    }
    if (!smsContent) {
      setSmsError("Escreva o conteúdo da mensagem.");
      return;
    }

    const formattedTarget = smsTargetNumber.startsWith('+244') 
      ? smsTargetNumber 
      : `+244${smsTargetNumber.replace(/\D/g, '')}`;

    setSmsSending(true);
    try {
      const res = await smsService.sendSMS([formattedTarget], smsContent);
      if (res.success) {
        alert("Comunicação SMS registada e enviada com sucesso!");
        setIsSmsModalOpen(false);
        setSmsTargetNumber('');
        setSmsContent('');
      } else {
        setSmsError(res.error || "Ocorreu um erro no Gateway de SMS.");
      }
    } catch (err: any) {
      setSmsError(err.message || "Erro de ligação.");
    } finally {
      setSmsSending(false);
    }
  };

  // Log Call manually
  const submitManualCall = async (e: React.FormEvent) => {
    e.preventDefault();
    setCallError(null);

    if (!callDriverName) {
      setCallError("Selecione um motorista para vincular a chamada.");
      return;
    }
    if (!callCustomerPhone) {
      setCallError("Indique o telefone do cliente.");
      return;
    }

    setCallSubmitting(true);
    try {
      const matchedDriver = drivers.find(d => d.name === callDriverName);
      
      const trimmedPhone = callCustomerPhone.replace(/\D/g, '');
      const phoneWithPrefix = trimmedPhone.startsWith('244')
        ? `+${trimmedPhone}`
        : `+244${trimmedPhone}`;

      await addDoc(collection(db, "calls"), {
        customerPhone: phoneWithPrefix,
        customerName: callCustomerName || "Cliente Particular",
        pickupAddress: callPickupAddress || "Solicitação de Corrida Direta",
        destinationAddress: "Destino Urbano Luena",
        price: Number(callPrice) || 0,
        status: callStatus,
        driverId: matchedDriver?.id || Math.random().toString(),
        driverName: callDriverName,
        timestamp: serverTimestamp(),
        responseHistory: [
          {
            action: callStatus === 'completed' ? 'completed' : 'accepted',
            timestamp: new Date().toISOString(),
            driverId: matchedDriver?.id || "manual"
          }
        ]
      });

      alert("Chamada registada no Dossiê com sucesso!");
      setIsCallModalOpen(false);
      setCallDriverName('');
      setCallCustomerName('');
      setCallCustomerPhone('');
      setCallPickupAddress('');
      setCallPrice('0');
    } catch (err: any) {
      setCallError(err.message || "Erro ao adicionar chamada.");
    } finally {
      setCallSubmitting(false);
    }
  };

  // Export Complete communications dossier
  const handleExportDossier = () => {
    const reportHeader = `===========================================================\n` + 
                         `         PSM COMERCIAL • DOSSIÊ GERAL DE COMUNICAÇÕES        \n` +
                         `                   REGISTROS DE CHAMADAS & SMS             \n` +
                         `===========================================================\n` +
                         `Emitido em: ${new Date().toLocaleString('pt-PT')}\n` +
                         `Filtro Ativo: ${activityFilter.toUpperCase()}\n` +
                         `Total de Motoristas: ${compiledDrivers.length}\n` +
                         `Total Geral de Chamadas: ${calls.length}\n` +
                         `Total Geral de SMS Disparados: ${smsLogs.length}\n\n`;

    const reportContent = compiledDrivers.map(d => {
      return `Motorista: ${d.name}\n` +
             `Telemóvel: ${d.phone}\n` +
             `Carta Nº  : ${d.licenseNumber || 'Não indicado'}\n` +
             `Status    : ${d.status}\n` +
             `📊 LOGS TOTAIS DE COMUNICAÇÃO: ${d.totalLogs}\n` +
             `  - Chamadas Recebidas/Iniciadas: ${d.callsCount}\n` +
             `  - SMS Enviados de Alerta      : ${d.smsCount}\n` +
             `  - Taxa de Conclusão Chamadas  : ${d.conversionRate}%\n` +
             `  - Faturamento Est. Acumulado  : ${d.totalEarnings} AOA\n` +
             `  - Última Atividade           : ${d.lastActive ? d.lastActive.toLocaleString('pt-PT') : 'Sem registros'}\n` +
             `-----------------------------------------------------------\n`;
    }).join('\n');

    const combinedBlob = new Blob([reportHeader + reportContent], { type: 'text/plain;charset=utf-8' });
    const fileUrl = URL.createObjectURL(combinedBlob);
    const hiddenLink = document.createElement('a');
    hiddenLink.href = fileUrl;
    hiddenLink.download = `dossie_comunicacoes_psm_${new Date().getTime()}.txt`;
    hiddenLink.click();
  };

  const totalCallsCount = calls.length;
  const totalSmsCount = smsLogs.length;
  const overallCompletedCalls = calls.filter(c => c.status === 'completed' || c.status === 'concluída').length;
  const overallConversion = totalCallsCount > 0 ? Math.round((overallCompletedCalls / totalCallsCount) * 100) : 0;

  return (
    <div className="space-y-8 max-w-[1450px] mx-auto pb-20">
      
      {/* Title & Actions Row */}
      <div className="flex flex-col md:flex-row md:items-center justify-between bg-white px-10 py-10 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-[30%] h-full bg-slate-50 border-l border-slate-100 -mr-16 rotate-12 -z-0 opacity-50 group-hover:rotate-6 transition-transform duration-1000" />
        
        <div className="relative z-10 flex items-center gap-8">
          <div className="w-16 h-16 bg-slate-900 rounded-[1.5rem] flex items-center justify-center text-white shadow-2xl rotate-2 group-hover:rotate-0 transition-all duration-500 border border-white/10">
             <FileText size={32} />
          </div>
          <div>
            <div className="flex items-center gap-3">
              <h2 className="font-black text-3xl text-slate-900 tracking-tighter uppercase italic">
                Dossiê de Comunicações
              </h2>
              <span className="px-2 py-0.5 bg-brand-primary/10 text-brand-primary text-[8px] font-black rounded-full uppercase tracking-tighter border border-brand-primary/20">
                AUDITORIA INTERNA
              </span>
            </div>
            <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em] mt-2 flex items-center gap-2">
              <Activity size={12} className="text-brand-primary" />
              Logs integrados de Chamadas e SMS por Motorista da PSM COMERCIAL COM LUENA-MOXICO
            </p>
          </div>
        </div>

        <div className="relative z-10 flex items-center gap-3 mt-4 md:mt-0">
          <button 
            onClick={() => {
              setSmsTargetNumber('');
              setSmsContent('');
              setSmsError(null);
              setIsSmsModalOpen(true);
            }}
            className="flex items-center gap-2 px-6 py-3 bg-white text-slate-800 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-slate-50 transition-all border border-slate-200 shadow-sm"
          >
            <Send size={14} className="text-brand-primary" />
            SMS Alerta
          </button>
          
          <button 
            onClick={() => {
              setCallError(null);
              setIsCallModalOpen(true);
            }}
            className="flex items-center gap-2 px-6 py-3 bg-white text-slate-800 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-slate-50 transition-all border border-slate-200 shadow-sm"
          >
            <Plus size={14} className="text-emerald-500" />
            Registar Chamada
          </button>

          <button 
            onClick={handleExportDossier}
            className="flex items-center gap-2 px-8 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-md active:scale-95"
          >
            <Download size={14} className="text-brand-primary" />
            Exportar Dossier
          </button>
        </div>
      </div>

      {/* Metrics Strips */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Chamadas Registadas</span>
            <p className="text-3xl font-black text-slate-900 mt-1">{totalCallsCount}</p>
            <span className="text-[9px] text-emerald-500 font-bold flex items-center gap-1 mt-1">
              <TrendingUp size={10} /> Central PSM Luena
            </span>
          </div>
          <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center text-white">
            <Phone size={20} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Disparos de SMS Alerta</span>
            <p className="text-3xl font-black text-slate-900 mt-1">{totalSmsCount}</p>
            <span className="text-[9px] text-brand-primary font-bold flex items-center gap-1 mt-1">
              Gateway Ativo Unitel
            </span>
          </div>
          <div className="w-12 h-12 bg-slate-900 rounded-xl flex items-center justify-center text-white">
            <MessageSquare size={20} />
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Taxa Conclusão Média</span>
            <p className="text-3xl font-black text-slate-900 mt-1">{overallConversion}%</p>
            <div className="w-24 bg-slate-100 h-1.5 rounded-full mt-2 overflow-hidden">
              <div className="bg-emerald-500 h-full" style={{ width: `${overallConversion}%` }} />
            </div>
          </div>
          <div className="w-12 h-12 bg-emerald-50 text-emerald-600 rounded-xl flex items-center justify-center font-black">
            %
          </div>
        </div>

        <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm flex items-center justify-between">
          <div>
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Total Logs Unificados</span>
            <p className="text-3xl font-black text-slate-900 mt-1">{totalCallsCount + totalSmsCount}</p>
            <span className="text-[9px] text-slate-500 font-bold mt-1 block">Comunicação Acumulada</span>
          </div>
          <div className="w-12 h-12 bg-indigo-50 text-indigo-600 rounded-xl flex items-center justify-center">
            <FileText size={20} />
          </div>
        </div>
      </div>

      {/* Main List & Controls */}
      <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden">
        
        {/* Search & Filters Toolbar */}
        <div className="p-8 border-b border-slate-100 flex flex-col lg:flex-row gap-6 justify-between items-center bg-slate-50/50">
          <div className="relative w-full lg:max-w-md">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={16} />
            <input 
              type="text"
              placeholder="Pesquisar por motorista, telemóvel ou carta..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-12 pr-4 py-3 bg-white border border-slate-200 rounded-xl text-xs font-bold outline-none focus:ring-2 focus:ring-brand-primary transition-all uppercase tracking-tight"
            />
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full lg:w-auto">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest mr-2 flex items-center gap-1">
              <Filter size={10} /> Filtro de Conversas
            </span>
            <button
              onClick={() => setActivityFilter('all')}
              className={cn(
                "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                activityFilter === 'all' 
                  ? "bg-slate-900 text-white shadow-md" 
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              )}
            >
              Todos ({compiledDrivers.length})
            </button>
            <button
              onClick={() => setActivityFilter('high')}
              className={cn(
                "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                activityFilter === 'high' 
                  ? "bg-brand-primary text-white shadow-md" 
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              )}
            >
              Alta Atividade (10+)
            </button>
            <button
              onClick={() => setActivityFilter('low')}
              className={cn(
                "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                activityFilter === 'low' 
                  ? "bg-amber-600 text-white shadow-md" 
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              )}
            >
              Baixa Atividade (&lt;10)
            </button>
            <button
              onClick={() => setActivityFilter('none')}
              className={cn(
                "px-4 py-2 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all",
                activityFilter === 'none' 
                  ? "bg-rose-600 text-white shadow-md" 
                  : "bg-white text-slate-600 border border-slate-200 hover:bg-slate-50"
              )}
            >
              Sem Registro
            </button>
          </div>
        </div>

        {/* Master Driver Table */}
        {loading ? (
          <div className="py-24 text-center">
            <Loader2 className="animate-spin text-brand-primary mx-auto mb-4" size={32} />
            <p className="text-xs uppercase font-black text-slate-400 tracking-widest animate-pulse">Consultando dados do Dossiê...</p>
          </div>
        ) : filteredDrivers.length === 0 ? (
          <div className="py-24 text-center space-y-4">
            <div className="w-16 h-16 bg-slate-50 rounded-full flex items-center justify-center text-slate-300 mx-auto">
              <Search size={24} />
            </div>
            <p className="text-sm font-black text-slate-300 uppercase tracking-[0.2em] italic">Nenhum motorista encontrado com estes parâmetros</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-slate-50/75 border-b border-slate-100/50">
                  <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Motorista / ID</th>
                  <th className="px-6 py-5 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Contacto GSM</th>
                  <th className="px-6 py-5 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Chamadas</th>
                  <th className="px-6 py-5 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Msn / SMS</th>
                  <th className="px-6 py-5 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Total Logs</th>
                  <th className="px-6 py-5 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] text-center">Eficácia Corridas</th>
                  <th className="px-6 py-5 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em]">Último Log</th>
                  <th className="px-8 py-5 text-[9px] font-black text-slate-400 uppercase tracking-[0.2em] text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filteredDrivers.map(driver => (
                  <tr 
                    key={driver.id}
                    className="hover:bg-slate-50/50 transition-colors group cursor-pointer"
                    onClick={() => {
                      setSelectedDriver(driver);
                      setDossierTab('calls');
                    }}
                  >
                    <td className="px-8 py-5">
                      <div className="flex items-center gap-4">
                        <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white text-xs font-black uppercase italic">
                          {driver.name.charAt(0)}
                        </div>
                        <div>
                          <p className="text-sm font-black text-slate-950 uppercase tracking-tight group-hover:text-brand-primary transition-colors italic">{driver.name}</p>
                          <p className="text-[9px] font-mono text-slate-400 mt-0.5 uppercase">Carta: {driver.licenseNumber || 'Indisponível'}</p>
                        </div>
                      </div>
                    </td>
                    
                    <td className="px-6 py-5">
                      <div className="flex flex-col gap-1.5">
                        <span className="text-xs font-bold font-mono tracking-tight text-slate-700 bg-slate-100 px-2.5 py-1 rounded-[6px] inline-block w-fit">
                          {driver.phone}
                        </span>
                        {driver.assignedTerminals && driver.assignedTerminals.length > 0 && (
                          <div className="flex flex-col gap-1">
                            {driver.assignedTerminals.map((phone: any) => (
                              <span key={phone.id} className="text-[9px] font-black text-emerald-600 bg-emerald-50 border border-emerald-100 px-2 py-0.5 rounded-[4px] w-fit flex items-center gap-1 uppercase italic tracking-tighter">
                                <Smartphone size={8} /> Terminal: {phone.label} ({phone.number})
                              </span>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>

                    <td className="px-6 py-5 text-center">
                      <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 font-bold text-xs text-slate-800">
                        {driver.callsCount}
                      </div>
                    </td>

                    <td className="px-6 py-5 text-center">
                      <div className="inline-flex items-center justify-center w-8 h-8 rounded-full bg-slate-100 font-bold text-xs text-slate-800">
                        {driver.smsCount}
                      </div>
                    </td>

                    <td className="px-6 py-5 text-center">
                      <span className={`inline-flex items-center justify-center px-3 py-1 rounded-full font-black text-xs ${
                        driver.totalLogs > 15 
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' 
                          : driver.totalLogs > 0 
                            ? 'bg-indigo-50 text-indigo-600 border border-indigo-100' 
                            : 'bg-rose-50 text-rose-500 border border-rose-100'
                      }`}>
                        {driver.totalLogs} logs
                      </span>
                    </td>

                    <td className="px-6 py-5">
                      <div className="flex flex-col items-center gap-1.5">
                        <span className="text-xs font-black text-slate-900 tracking-tight italic">{driver.conversionRate}%</span>
                        <div className="w-16 bg-slate-100 h-1 rounded-full overflow-hidden">
                          <div 
                            className={`h-full ${driver.conversionRate > 80 ? 'bg-emerald-500' : 'bg-amber-500'}`} 
                            style={{ width: `${driver.conversionRate}%` }} 
                          />
                        </div>
                      </div>
                    </td>

                    <td className="px-6 py-5">
                      <span className="text-[10px] font-bold text-slate-400 block">
                        {driver.lastActive 
                          ? driver.lastActive.toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: '2-digit', hour: '2-digit', minute: '2-digit' }) 
                          : 'Sem atividade'
                        }
                      </span>
                    </td>

                    <td className="px-8 py-5 text-right" onClick={(e) => e.stopPropagation()}>
                      <button 
                        onClick={() => {
                          setSelectedDriver(driver);
                          setDossierTab('calls');
                        }}
                        className="p-2 py-1.5 bg-slate-950 text-white rounded-lg text-[9px] font-black uppercase tracking-wider hover:bg-black flex items-center gap-1 inline-flex hover:shadow-md transition-all select-none"
                      >
                        Abrir Pasta <ArrowUpRight size={12} className="text-brand-primary" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* DETAILED DOSSIER DIALOG / OVERLAY OVER CARDS */}
      <AnimatePresence>
        {selectedDriver && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={handleCloseDossier}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 15 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 15 }}
              className="relative bg-white rounded-[2.5rem] shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden z-10 my-8"
            >
              {/* Header bar */}
              <div className="px-8 py-8 border-b border-slate-100 flex items-center justify-between bg-slate-900 text-white relative">
                <div className="absolute top-0 right-0 py-8 px-12 opacity-5 pointer-events-none">
                  <FileText size={180} />
                </div>
                
                <div className="flex items-center gap-6 relative z-10">
                  <div className="w-14 h-14 bg-white/10 rounded-[1rem] flex items-center justify-center text-brand-primary text-xl font-black italic border border-white/10">
                    {selectedDriver.name.charAt(0)}
                  </div>
                  <div>
                    <div className="flex items-center gap-3">
                      <h3 className="text-2xl font-black tracking-tight uppercase italic">{selectedDriver.name}</h3>
                      <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider ${
                        selectedDriver.status === 'Ativo' ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/30' : 'bg-red-500/20 text-red-400 border border-red-500/30'
                      }`}>{selectedDriver.status}</span>
                    </div>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1.5 flex items-center gap-2">
                      <Smartphone size={11} className="text-brand-primary" /> {selectedDriver.phone} • Carta: {selectedDriver.licenseNumber || 'Indefinida'}
                    </p>
                  </div>
                </div>

                <button 
                  onClick={handleCloseDossier}
                  className="w-10 h-10 flex items-center justify-center bg-white/5 hover:bg-white/10 rounded-xl transition-all relative z-10 border border-white/5"
                >
                  <X size={20} className="text-slate-300" />
                </button>
              </div>

              {/* Core tabs selectors */}
              <div className="border-b border-slate-100 flex items-center justify-between px-8 bg-slate-50">
                <div className="flex gap-1 py-3">
                  <button 
                    onClick={() => setDossierTab('calls')}
                    className={cn(
                      "px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2",
                      dossierTab === 'calls' ? "bg-slate-900 text-white shadow-md font-black" : "text-slate-500 hover:text-slate-950 font-bold"
                    )}
                  >
                    <Phone size={12} /> Chamadas ({selectedDriver.callsCount})
                  </button>
                  <button 
                    onClick={() => setDossierTab('sms')}
                    className={cn(
                      "px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2",
                      dossierTab === 'sms' ? "bg-slate-900 text-white shadow-md font-black" : "text-slate-500 hover:text-slate-950 font-bold"
                    )}
                  >
                    <MessageSquare size={12} /> SMS ({selectedDriver.smsCount})
                  </button>
                  <button 
                    onClick={() => {
                      setDossierTab('audit');
                      if (!aiReport) {
                        handleRunAudit(selectedDriver);
                      }
                    }}
                    className={cn(
                      "px-5 py-2.5 rounded-xl text-[10px] font-bold uppercase tracking-wider transition-all flex items-center gap-2 border border-violet-100/10",
                      dossierTab === 'audit' ? "bg-violet-600 text-white shadow-md font-black" : "text-violet-600 hover:text-violet-800 font-bold bg-violet-50"
                    )}
                  >
                    <Sparkles size={12} /> Auditoria IA Gemini 1.5
                  </button>
                </div>

                <div className="flex items-center gap-3">
                  <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest italic">Logs Totais: {selectedDriver.totalLogs} logs</span>
                </div>
              </div>

              {/* Dossier contents view containers */}
              <div className="p-8 max-h-[450px] overflow-y-auto min-h-[300px]">
                
                {/* CHAMADAS TAB */}
                {dossierTab === 'calls' && (
                  <div className="space-y-4">
                    {selectedDriver.rawCalls.length === 0 ? (
                      <div className="py-12 text-center text-slate-300 border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center justify-center">
                        <Phone size={24} className="mb-2" />
                        <span className="text-xs uppercase font-bold tracking-wider">Sem registros de chamadas nos logs deste motorista</span>
                      </div>
                    ) : (
                      <div className="overflow-hidden border border-slate-100 rounded-2xl">
                        <table className="w-full text-left font-sans text-xs">
                          <thead>
                            <tr className="bg-slate-50 border-b border-secondary-100 font-black uppercase text-[8px] tracking-widest text-slate-400">
                              <th className="p-4">Cliente</th>
                              <th className="p-4">Contacto</th>
                              <th className="p-4">Recolha</th>
                              <th className="p-4">Preço</th>
                              <th className="p-4 text-center">Status</th>
                              <th className="p-4">Data/Hora</th>
                            </tr>
                          </thead>
                          <tbody className="divide-y divide-slate-100">
                            {selectedDriver.rawCalls.map((c: any) => (
                              <tr key={c.id} className="hover:bg-slate-50/20">
                                <td className="p-4 font-black text-slate-800 uppercase italic">{c.customerName || "Particular"}</td>
                                <td className="p-4 font-mono font-bold">{c.customerPhone}</td>
                                <td className="p-4 truncate max-w-[150px] italic text-slate-500">{c.pickupAddress || 'Directo'}</td>
                                <td className="p-4 font-bold text-slate-900">{c.price || 0} AOA</td>
                                <td className="p-4 text-center">
                                  <span className={`px-2 pb-0.5 pt-1 rounded-full text-[8px] font-black uppercase tracking-wider inline-block ${
                                    c.status === 'completed' || c.status === 'concluída' ? 'bg-emerald-50 text-emerald-600 border border-emerald-100' :
                                    c.status === 'cancelled' || c.status === 'cancelada' ? 'bg-red-50 text-red-600 border border-red-100' : 'bg-slate-100 text-slate-600 border border-slate-200'
                                  }`}>
                                    {c.status}
                                  </span>
                                </td>
                                <td className="p-4 text-slate-400 text-[10px] font-bold">
                                  {c.timestamp?.toDate 
                                    ? c.timestamp.toDate().toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' }) 
                                    : new Date(c.timestamp).toLocaleString()
                                  }
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                )}

                {/* SMS HISTORIC LOGS TAB */}
                {dossierTab === 'sms' && (
                  <div className="space-y-4">
                    {selectedDriver.rawSms.length === 0 ? (
                      <div className="py-12 text-center text-slate-300 border-2 border-dashed border-slate-100 rounded-2xl flex flex-col items-center justify-center">
                        <MessageSquare size={24} className="mb-2" />
                        <span className="text-xs uppercase font-bold tracking-wider">Sem logs de mensagens despachadas para este telemóvel</span>
                      </div>
                    ) : (
                      <div className="space-y-3">
                        {selectedDriver.rawSms.map((sms: any) => {
                          const cleanTargetPhone = selectedDriver.phone;
                          const op = smsService.getOperator(cleanTargetPhone);
                          return (
                            <div key={sms.id} className="p-4 rounded-xl border border-slate-100 bg-slate-50 space-y-2 relative overflow-hidden">
                              <div className="absolute top-0 right-0 w-16 bg-brand-primary text-white text-[8px] font-black tracking-widest uppercase text-center py-1 select-none">
                                {op}
                              </div>
                              <div className="flex items-center justify-between">
                                <div className="flex items-center gap-2">
                                  <span className="px-2 py-0.5 bg-brand-primary/10 text-brand-primary rounded-[4px] text-[8px] font-black uppercase tracking-wider">
                                    {sms.status || 'Enviado'}
                                  </span>
                                  <span className="text-[8px] uppercase font-black text-slate-400">SMS Gateway</span>
                                </div>
                                <span className="text-[10px] text-slate-400 font-bold">
                                  {sms.timestamp?.toDate 
                                    ? sms.timestamp.toDate().toLocaleString('pt-PT') 
                                    : new Date(sms.timestamp).toLocaleString()
                                  }
                                </span>
                              </div>
                              <p className="text-xs text-slate-800 leading-relaxed font-bold border-l-2 border-slate-300 pl-3 italic">
                                "{sms.content}"
                              </p>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {/* AI AUDIT ACTION INSIGHTS TAB */}
                {dossierTab === 'audit' && (
                  <div className="space-y-4">
                    <div className="p-4 bg-violet-50 rounded-2xl border border-violet-100 flex items-start gap-4">
                      <div className="p-2.5 bg-violet-600 rounded-xl text-white flex-shrink-0">
                         <Sparkles size={18} />
                      </div>
                      <div>
                        <h4 className="text-xs font-black uppercase text-violet-900 tracking-wider">Auditoria IA de Comunicações do Campo</h4>
                        <p className="text-[10px] text-violet-700 font-semibold mt-1">
                          Auditoria gerada de forma dinâmica utilizando o modelo Gemini 1.5 Flash. Analisa o faturamento estimado, a taxa de sucesso nas chamadas e no recebimento de SMS das escalas.
                        </p>
                      </div>
                    </div>

                    {isAuditing ? (
                      <div className="py-16 text-center space-y-3">
                        <Loader2 className="animate-spin text-violet-600 mx-auto" size={32} />
                        <p className="text-xs uppercase font-black text-slate-400 tracking-widest animate-pulse">Consultando Redes do Comando Central...</p>
                      </div>
                    ) : aiReport ? (
                      <div className="p-6 bg-slate-900 text-slate-100 rounded-2xl border border-slate-800 font-mono text-[11px] leading-relaxed relative overflow-hidden shadow-xl whitespace-pre-line">
                         <div className="flex items-center justify-between border-b border-white/5 pb-3 mb-4">
                            <span className="text-[8px] font-black tracking-widest text-[#2563eb] uppercase">Relatório de Desempenho Operacional Gemini</span>
                            <button 
                              onClick={() => {
                                const blob = new Blob([aiReport], { type: "text/plain;charset=utf-8" });
                                const url = URL.createObjectURL(blob);
                                const a = document.createElement('a');
                                a.href = url;
                                a.download = `auditoria_ia_${selectedDriver.name.replace(/\s+/g, '_').toLowerCase()}.txt`;
                                a.click();
                              }}
                              className="text-[8px] bg-white/5 font-black uppercase tracking-widest px-2.5 py-1 rounded hover:bg-white/10 flex items-center gap-1 leading-none text-slate-300 border border-white/5"
                            >
                               <Download size={10} /> Gravar Auditoria
                            </button>
                         </div>
                         {aiReport}
                      </div>
                    ) : (
                      <div className="py-12 text-center">
                         <button 
                           onClick={() => handleRunAudit(selectedDriver)}
                           className="px-6 py-3 bg-violet-600 text-white font-black text-xs uppercase tracking-widest rounded-xl hover:bg-violet-700 transition-all shadow-md active:scale-95"
                         >
                           Disparar Nova Análise
                         </button>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Modal controls footer */}
              <div className="p-8 border-t border-slate-100 flex items-center justify-end bg-slate-50 gap-3">
                <button 
                  onClick={() => {
                    setSmsTargetNumber(selectedDriver.phone);
                    setIsSmsModalOpen(true);
                  }}
                  className="px-6 py-3 bg-white text-slate-800 rounded-xl text-[10px] font-black uppercase tracking-wider hover:bg-slate-50 border border-slate-200"
                >
                  Registar Disparo de SMS Especial
                </button>
                <button 
                  onClick={handleCloseDossier}
                  className="px-8 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black"
                >
                  Fechar Dossiê
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* SEND QUICK SMS OVERLAY MODAL */}
      <AnimatePresence>
        {isSmsModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsSmsModalOpen(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white rounded-[2rem] shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden z-[101]"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div>
                   <h3 className="text-lg font-black text-slate-900 tracking-tight uppercase italic flex items-center gap-2">
                     <Send size={16} className="text-brand-primary animate-pulse" /> Dispatcher de SMS
                   </h3>
                   <p className="text-[8px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">Registado permanentemente no Unitel Gateway</p>
                </div>
                <button 
                  onClick={() => setIsSmsModalOpen(false)}
                  className="w-10 h-10 flex items-center justify-center hover:bg-slate-200 rounded-xl transition-all"
                >
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              <form onSubmit={dispatchSmsForm} className="p-6 space-y-4">
                {smsError && (
                  <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-[10px] font-black uppercase flex items-center gap-2">
                    <AlertCircle size={14} /> {smsError}
                  </div>
                )}
                
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Número de Destino</label>
                  <div className="flex gap-0">
                     <span className="px-3.5 py-3 bg-slate-900 text-white rounded-l-xl text-xs font-black flex items-center italic select-none">+244</span>
                     <input 
                       required
                       type="tel"
                       placeholder="9XXXXXXXX"
                       maxLength={9}
                       value={smsTargetNumber.startsWith('+244') ? smsTargetNumber.slice(4) : smsTargetNumber}
                       onChange={(e) => setSmsTargetNumber(e.target.value.replace(/\D/g, ''))}
                       className="flex-1 border border-slate-200 rounded-r-xl px-4 py-3 text-xs font-black outline-none italic tracking-wider focus:ring-1 focus:ring-slate-400 focus:bg-white"
                     />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Conteúdo da Mensagem de Alerta</label>
                  <textarea 
                    required
                    rows={4}
                    placeholder="Escreva a mensagem aqui (Mantenha o tom profissional PSM)..."
                    value={smsContent}
                    onChange={(e) => setSmsContent(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-xs outline-none focus:ring-1 focus:ring-slate-400 focus:bg-white font-medium"
                  />
                  <div className="text-[8px] text-slate-400 font-mono text-right font-semibold">
                    {smsContent.length} caracteres • 1 segmento de cobrança
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsSmsModalOpen(false)}
                    className="flex-1 py-3 text-[10px] bg-slate-100 text-slate-600 rounded-xl uppercase font-black"
                  >
                    Descartar Alerta
                  </button>
                  <button 
                    type="submit"
                    disabled={smsSending}
                    className="flex-1 py-3 bg-slate-900 hover:bg-black text-white rounded-xl text-[10px] uppercase font-black tracking-widest flex items-center justify-center gap-2 shadow-lg hover:shadow-xl active:scale-95 disabled:opacity-60"
                  >
                    {smsSending ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} className="text-emerald-500" />}
                    Logar Envio SMS
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* REGISTER MANUAL CALL OVERLAY MODAL */}
      <AnimatePresence>
        {isCallModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsCallModalOpen(false)}
              className="absolute inset-0 bg-slate-950/80 backdrop-blur-md"
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="relative bg-white rounded-[2rem] shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden z-[101]"
            >
              <div className="p-6 border-b border-slate-100 flex items-center justify-between bg-slate-50">
                <div>
                   <h3 className="text-lg font-black text-slate-900 tracking-tight uppercase italic flex items-center gap-2">
                     <Phone size={16} className="text-emerald-500" /> Registro de Corrida
                   </h3>
                   <p className="text-[8px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">Registado permanentemente nos canais da Central</p>
                </div>
                <button 
                  onClick={() => setIsCallModalOpen(false)}
                  className="w-10 h-10 flex items-center justify-center hover:bg-slate-200 rounded-xl transition-all"
                >
                  <X size={20} className="text-slate-400" />
                </button>
              </div>

              <form onSubmit={submitManualCall} className="p-6 space-y-4">
                {callError && (
                  <div className="p-3 bg-rose-50 border border-rose-100 rounded-xl text-rose-600 text-[10px] font-black uppercase flex items-center gap-2">
                    <AlertCircle size={14} /> {callError}
                  </div>
                )}
                
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Vincular ao Motorista</label>
                  <select
                    required
                    value={callDriverName}
                    onChange={(e) => setCallDriverName(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-xs font-black outline-none uppercase italic"
                  >
                    <option value="">Selecione o motorista...</option>
                    {drivers.map(d => (
                      <option key={d.id} value={d.name}>{d.name}</option>
                    ))}
                  </select>
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Cliente</label>
                    <input 
                      type="text"
                      placeholder="Ex: Particular"
                      value={callCustomerName}
                      onChange={(e) => setCallCustomerName(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-4 py-3 text-xs font-black outline-none uppercase italic"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Contacto Telemóvel</label>
                    <input 
                      required
                      type="tel"
                      placeholder="9XXXXXXXX"
                      maxLength={9}
                      value={callCustomerPhone}
                      onChange={(e) => setCallCustomerPhone(e.target.value.replace(/\D/g, ''))}
                      className="w-full border border-slate-200 rounded-xl px-4 py-3 text-xs font-black outline-none tracking-widest font-mono"
                    />
                  </div>
                </div>

                <div className="space-y-1.5">
                  <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Ponto de Recolha / Descrição</label>
                  <input 
                    type="text"
                    required
                    placeholder="Ex: Aeroporto do Luena"
                    value={callPickupAddress}
                    onChange={(e) => setCallPickupAddress(e.target.value)}
                    className="w-full border border-slate-200 rounded-xl px-4 py-3 text-xs font-bold outline-none uppercase italic"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Status da Chamada</label>
                    <select
                      value={callStatus}
                      onChange={(e) => setCallStatus(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-4 py-3 text-xs font-black outline-none uppercase text-slate-700"
                    >
                      <option value="completed">Concluída</option>
                      <option value="pending">Pendente</option>
                      <option value="cancelled">Cancelada</option>
                    </select>
                  </div>

                  <div className="space-y-1.5">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-widest ml-1">Preço Cobrado (AOA)</label>
                    <input 
                      type="number"
                      required
                      value={callPrice}
                      onChange={(e) => setCallPrice(e.target.value)}
                      className="w-full border border-slate-200 rounded-xl px-4 py-3 text-xs font-black outline-none font-mono"
                    />
                  </div>
                </div>

                <div className="pt-4 flex gap-3">
                  <button 
                    type="button"
                    onClick={() => setIsCallModalOpen(false)}
                    className="flex-1 py-3 text-[10px] bg-slate-100 text-slate-600 rounded-xl uppercase font-black"
                  >
                    Descartar Registro
                  </button>
                  <button 
                    type="submit"
                    disabled={callSubmitting}
                    className="flex-1 py-3 bg-slate-900 hover:bg-black text-white rounded-xl text-[10px] uppercase font-black tracking-widest flex items-center justify-center gap-2 shadow-lg disabled:opacity-60"
                  >
                    {callSubmitting ? <Loader2 size={12} className="animate-spin" /> : <ShieldCheck size={12} className="text-emerald-500" />}
                    Auditar Corrida Log
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

    </div>
  );
}
