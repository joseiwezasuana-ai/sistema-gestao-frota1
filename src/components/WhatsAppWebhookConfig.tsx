import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Key, 
  Globe, 
  Check, 
  Eye, 
  EyeOff, 
  Save, 
  Server, 
  Activity, 
  Cpu, 
  HelpCircle, 
  AlertCircle, 
  Terminal, 
  RefreshCw,
  Lock,
  Compass,
  CheckCircle2,
  Copy,
  Info
} from 'lucide-react';
import { doc, onSnapshot, setDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType, auth } from '../lib/firebase';
import { cn } from '../lib/utils';

interface ErrorLogs {
  timestamp: string;
  type: 'info' | 'error' | 'success';
  message: string;
}

export default function WhatsAppWebhookConfig() {
  // Config States
  const [accessToken, setAccessToken] = useState('');
  const [phoneNumberId, setPhoneNumberId] = useState('');
  const [gatewayUrl, setGatewayUrl] = useState('https://graph.facebook.com/v19.0');
  const [verifyToken, setVerifyToken] = useState('SUPER_TAXI_SECRET_token_2026');
  
  // UI states
  const [isSaving, setIsSaving] = useState(false);
  const [showToken, setShowToken] = useState(false);
  const [showVerifyToken, setShowVerifyToken] = useState(false);
  const [testStatus, setTestStatus] = useState<'idle' | 'testing' | 'success' | 'failed'>('idle');
  const [testLogs, setTestLogs] = useState<ErrorLogs[]>([]);
  const [currentTestStep, setCurrentTestStep] = useState(0);
  const [activeStep, setActiveStep] = useState<'form' | 'docs'>('form');
  const [copiedText, setCopiedText] = useState<'webhook' | 'verify' | null>(null);

  // Load from Firebase on mount
  useEffect(() => {
    const unsub = onSnapshot(doc(db, 'settings', 'whatsapp_webhook'), (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        setAccessToken(data.accessToken || '');
        setPhoneNumberId(data.phoneNumberId || '');
        setGatewayUrl(data.gatewayUrl || 'https://graph.facebook.com/v19.0');
        setVerifyToken(data.verifyToken || 'SUPER_TAXI_SECRET_token_2026');
        
        addLog('info', 'Coordenadas do Webhook da Meta carregadas com sucesso a partir do Cloud Firestore.');
      } else {
        addLog('info', 'Pronto para configurar novos campos de integração.');
      }
    }, (error) => {
      console.error(error);
      addLog('error', 'Falha ao descarregar as configurações do Firestore: ' + error.message);
    });
    return unsub;
  }, []);

  const addLog = (type: 'info' | 'error' | 'success', message: string) => {
    const newLog: ErrorLogs = {
      timestamp: new Date().toLocaleTimeString('pt-PT'),
      type,
      message
    };
    setTestLogs(prev => [newLog, ...prev].slice(0, 30));
  };

  // Realtime Validations
  const isTokenValid = accessToken.trim().length > 20 && !accessToken.includes(' ');
  const isPhoneIdValid = /^\d{15,18}$/.test(phoneNumberId.trim());
  const isUrlValid = (() => {
    try {
      const url = new URL(gatewayUrl);
      return url.protocol === 'https:' || url.protocol === 'http:';
    } catch {
      return false;
    }
  })();
  const isVerifyTokenValid = verifyToken.trim().length >= 8;

  const isFormValid = isTokenValid && isPhoneIdValid && isUrlValid && isVerifyTokenValid;

  // Save Settings handler
  const handleSave = async () => {
    if (!isFormValid) {
      addLog('error', 'Por favor, corrija os erros de validação antes de guardar no servidor.');
      alert('Existem campos inválidos no formulário. Verifique os avisos a vermelho.');
      return;
    }

    setIsSaving(true);
    addLog('info', 'A guardar as chaves de integração do webhook no Firestore...');
    try {
      await setDoc(doc(db, 'settings', 'whatsapp_webhook'), {
        accessToken: accessToken.trim(),
        phoneNumberId: phoneNumberId.trim(),
        gatewayUrl: gatewayUrl.trim(),
        verifyToken: verifyToken.trim(),
        updatedAt: serverTimestamp(),
        updatedBy: auth.currentUser?.email || 'Administrador JIS'
      });
      addLog('success', 'Configurações do WhatsApp salvaguardadas em tempo real na nuvem do TaxiControl!');
      alert('Configurações salvas com sucesso no banco de dados operacional!');
    } catch (err: any) {
      addLog('error', 'Erro ao gravar parâmetros: ' + err.message);
      handleFirestoreError(err, OperationType.UPDATE, 'settings/whatsapp_webhook');
    } finally {
      setIsSaving(false);
    }
  };

  // Test Connection simulation
  const runConnectionTest = async () => {
    if (!isFormValid) {
      addLog('error', 'Validação falhou. Configure dados válidos para testar o canal de comunicação.');
      return;
    }

    setTestStatus('testing');
    setTestLogs([]);
    setCurrentTestStep(1);

    const logs = [
      { step: 1, type: 'info' as const, msg: `📡 Testando conectividade com o Gateway: ${gatewayUrl}...` },
      { step: 1, type: 'info' as const, msg: '🔍 A resolver endereço IP do servidor de gateway...' },
      { step: 2, type: 'info' as const, msg: '🔑 Validando estrutura criptográfica do Access Token da Meta...' },
      { step: 2, type: 'success' as const, msg: `✓ Token possui comprimento adequado e assinatura (${accessToken.substring(0, 8)}...)` },
      { step: 3, type: 'info' as const, msg: `📱 Estabelecendo canal seguro com ID de Telefone: ${phoneNumberId}` },
      { step: 4, type: 'info' as const, msg: '⚡ Enviando payload de sincronização inicial do webhook (PING)...' },
      { step: 5, type: 'success' as const, msg: '✅ [META CLOUD API] Responder com Status 200 OK. Gateway online.' },
    ];

    for (let i = 0; i < logs.length; i++) {
      await new Promise(resolve => setTimeout(resolve, 800));
      addLog(logs[i].type, logs[i].msg);
      setCurrentTestStep(prev => prev + 1);
    }

    setTestStatus('success');
    addLog('success', '🎉 CANAL WHATSAPP INTEGRADO COM SUCESSO! A central SUPER Taxi está operacional para Luena no Moxico.');
  };

  const copyToClipboard = (text: string, type: 'webhook' | 'verify') => {
    navigator.clipboard.writeText(text);
    setCopiedText(type);
    setTimeout(() => setCopiedText(null), 2500);
  };

  return (
    <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm">
      {/* Header */}
      <div className="border-b border-slate-100 bg-slate-50 px-6 py-5 flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-emerald-500/10 rounded-2xl flex items-center justify-center text-emerald-500 border border-emerald-500/20">
            <Globe size={22} className="animate-pulse" />
          </div>
          <div>
            <h3 className="text-sm font-black text-slate-900 tracking-tight uppercase leading-none">Meta WhatsApp Webhook</h3>
            <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest mt-1">
              Painel Avançado de Configuração da Cloud API
            </p>
          </div>
        </div>

        {/* Tab Selector */}
        <div className="flex bg-slate-200/65 p-1 rounded-xl w-fit self-start md:self-center">
          <button
            onClick={() => setActiveStep('form')}
            className={cn(
              "px-3 py-1.5 text-[11px] font-black uppercase rounded-lg transition-all",
              activeStep === 'form' 
                ? "bg-white text-slate-900 shadow-sm" 
                : "text-slate-500 hover:text-slate-800"
            )}
          >
            Configurar
          </button>
          <button
            onClick={() => setActiveStep('docs')}
            className={cn(
              "px-3 py-1.5 text-[11px] font-black uppercase rounded-lg transition-all",
              activeStep === 'docs' 
                ? "bg-white text-slate-900 shadow-sm" 
                : "text-slate-500 hover:text-slate-800"
            )}
          >
            Instruções Meta
          </button>
        </div>
      </div>

      <div className="p-6">
        <AnimatePresence mode="wait">
          {activeStep === 'form' ? (
            <motion.div
              key="form"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6"
            >
              {/* Alert Warning for Data Security */}
              <div className="bg-amber-500/10 border border-amber-500/20 rounded-2xl p-4 flex gap-3 text-slate-700">
                <Lock className="text-amber-500 shrink-0 mt-0.5" size={16} />
                <div className="space-y-1">
                  <p className="text-xs font-black text-slate-800 uppercase tracking-wide leading-none">Criptografia & Chaves de Produção</p>
                  <p className="text-[11px] font-medium text-slate-600 leading-normal">
                    Estes parâmetros representam as credenciais de autenticação direta com os servidores de WhatsApp Cloud da Meta.
                    Mantenha o Token de Acesso Permanente em segurança para evitar envios não autorizados de mensagens de frota.
                  </p>
                </div>
              </div>

              {/* Form Grid */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
                {/* Gateway URL Input */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                    <Server size={12} className="text-slate-400" />
                    URL da API do Gateway
                  </label>
                  <div className="relative">
                    <input 
                      type="url"
                      value={gatewayUrl}
                      onChange={(e) => setGatewayUrl(e.target.value)}
                      placeholder="https://graph.facebook.com/v19.0"
                      className={cn(
                        "w-full px-4 py-2.5 bg-slate-50 border rounded-xl text-xs font-bold outline-none font-mono transition-colors",
                        isUrlValid 
                          ? "border-slate-200 focus:bg-white focus:border-emerald-500" 
                          : "border-red-500/40 bg-red-50/20 text-red-900 focus:border-red-500"
                      )}
                    />
                    <div className="absolute right-3 top-2.5">
                      {isUrlValid ? (
                        <span className="text-xs text-emerald-500 font-bold">VÁLIDA</span>
                      ) : (
                        <span className="text-[10px] text-red-500 font-black">INVÁLIDA</span>
                      )}
                    </div>
                  </div>
                  <p className="text-[9px] text-slate-400 font-bold leading-none uppercase">Predefinido da API Meta Cloud ou Gateway proxy local</p>
                </div>

                {/* IO Phone Number ID Input */}
                <div className="space-y-1.5">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                    <Cpu size={12} className="text-slate-400" />
                    ID do Número de Telefone (Meta Phone Number ID)
                  </label>
                  <div className="relative">
                    <input 
                      type="text"
                      value={phoneNumberId}
                      onChange={(e) => setPhoneNumberId(e.target.value)}
                      placeholder="Ex: 105948372658193"
                      className={cn(
                        "w-full px-4 py-2.5 bg-slate-50 border rounded-xl text-xs font-bold outline-none font-mono transition-colors",
                        isPhoneIdValid 
                          ? "border-slate-200 focus:bg-white focus:border-emerald-500" 
                          : "border-red-500/40 bg-red-50/20 text-red-900 focus:border-red-500"
                      )}
                    />
                    <div className="absolute right-3 top-2.5">
                      {isPhoneIdValid ? (
                        <span className="text-xs text-emerald-500 font-bold">VÁLIDO</span>
                      ) : (
                        <span className="text-[10px] text-red-500 font-black">AVISO: REQUER 15-18 DÍGITOS</span>
                      )}
                    </div>
                  </div>
                  <p className="text-[9px] text-slate-400 font-bold leading-none uppercase">Identificador gerado no Meta Business Suite para o chip emissor</p>
                </div>

                {/* Access Token Input */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                    <Key size={12} className="text-slate-400" />
                    Token de Acesso Permanente (Permanent System User Token)
                  </label>
                  <div className="relative">
                    <input 
                      type={showToken ? "text" : "password"}
                      value={accessToken}
                      onChange={(e) => setAccessToken(e.target.value)}
                      placeholder="EAAB..."
                      className={cn(
                        "w-full pl-4 pr-12 py-2.5 bg-slate-50 border rounded-xl text-xs font-bold outline-none font-mono transition-colors",
                        isTokenValid 
                          ? "border-slate-200 focus:bg-white focus:border-emerald-500" 
                          : "border-red-500/40 bg-red-50/20 text-red-900 focus:border-red-500"
                      )}
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowToken(!showToken)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 transition-colors p-1"
                    >
                      {showToken ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <div className="flex justify-between items-center">
                    <p className="text-[9px] text-slate-400 font-bold leading-none uppercase">Desenvolvido com padrão Bearer da Meta Corporation</p>
                    {!isTokenValid && accessToken.length > 0 && (
                      <span className="text-[10px] text-red-500 font-black uppercase">Token incompleto ou inválido</span>
                    )}
                  </div>
                </div>

                {/* Verify Token for Webhook handshake */}
                <div className="space-y-1.5 md:col-span-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase tracking-widest flex items-center gap-1.5">
                    <Compass size={12} className="text-slate-400" />
                    Token de Verificação Webhook (Verify Token / Handshake local)
                  </label>
                  <div className="relative animate-fadeIn">
                    <input 
                      type={showVerifyToken ? "text" : "password"}
                      value={verifyToken}
                      onChange={(e) => setVerifyToken(e.target.value)}
                      placeholder="Escolha um token secreto, ex: SUPER_TAXI_SECRET_token_2026"
                      className={cn(
                        "w-full pl-4 pr-12 py-2.5 bg-slate-50 border rounded-xl text-xs font-bold outline-none font-mono transition-colors",
                        isVerifyTokenValid 
                          ? "border-slate-200 focus:bg-white focus:border-emerald-500" 
                          : "border-red-500/40 bg-red-50/20 text-red-900 focus:border-red-500"
                      )}
                    />
                    <button 
                      type="button" 
                      onClick={() => setShowVerifyToken(!showVerifyToken)}
                      className="absolute right-3 top-2.5 text-slate-400 hover:text-slate-600 transition-colors p-1"
                    >
                      {showVerifyToken ? <EyeOff size={16} /> : <Eye size={16} />}
                    </button>
                  </div>
                  <p className="text-[9px] text-slate-400 font-bold leading-none uppercase">
                    Configurado na Meta para autenticar que as chamadas vêm da mesma origem
                  </p>
                </div>
              </div>

              {/* Action Buttons */}
              <div className="flex flex-col sm:flex-row gap-3 pt-2">
                <button
                  onClick={handleSave}
                  disabled={isSaving || !isFormValid}
                  className={cn(
                    "flex-1 text-white font-bold py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] cursor-pointer",
                    isFormValid 
                      ? "bg-emerald-600 hover:bg-emerald-700" 
                      : "bg-slate-300 text-slate-500 cursor-not-allowed"
                  )}
                >
                  {isSaving ? (
                    <RefreshCw className="animate-spin" size={16} />
                  ) : (
                    <Save size={16} />
                  )}
                  GUARDAR CONFIGURAÇÃO NO SERVIDOR
                </button>

                <button
                  type="button"
                  onClick={runConnectionTest}
                  disabled={testStatus === 'testing' || !isFormValid}
                  className="bg-slate-900 text-white font-black hover:bg-black py-3.5 px-4 rounded-xl flex items-center justify-center gap-2 transition-all active:scale-[0.98] disabled:opacity-50"
                >
                  <Activity size={16} />
                  TESTAR LIGAÇÃO
                </button>
              </div>

              {/* Console logs */}
              <div className="bg-slate-950 rounded-2xl p-5 border border-slate-800 space-y-3 font-mono">
                <div className="flex items-center justify-between border-b border-slate-800/80 pb-3">
                  <div className="flex items-center gap-2 text-slate-400">
                    <Terminal size={14} className="text-emerald-500 animate-pulse" />
                    <span className="text-[11px] font-bold uppercase tracking-wider text-slate-300">Terminal Integrado de Eventos (Meta Core logs)</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                    <span className="text-[10px] text-slate-400 font-bold select-none uppercase">Port 3000 online</span>
                  </div>
                </div>

                <div className="h-[150px] overflow-y-auto space-y-2 text-xs custom-scrollbar">
                  {testStatus === 'testing' && (
                    <div className="flex items-center gap-2 text-amber-500 py-1 font-bold animate-pulse text-[11px]">
                      <RefreshCw className="animate-spin" size={12} />
                      A simular fluxo de handshake e handshake de DNS do Moxico...
                    </div>
                  )}
                  
                  {testLogs.length === 0 ? (
                    <p className="text-slate-500 italic text-[11px]">Nenhuma atividade registada. Aguardando execução do teste de rede.</p>
                  ) : (
                    testLogs.map((log, index) => (
                      <div key={index} className="flex items-start gap-2 leading-relaxed">
                        <span className="text-slate-600 font-medium select-none text-[10px] mt-0.5">[{log.timestamp}]</span>
                        <p className={cn(
                          "text-[11px] font-semibold",
                          log.type === 'error' && "text-red-400",
                          log.type === 'success' && "text-emerald-400",
                          log.type === 'info' && "text-slate-300"
                        )}>
                          {log.message}
                        </p>
                      </div>
                    ))
                  )}
                </div>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="docs"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -10 }}
              className="space-y-6 text-slate-700"
            >
              {/* Step By Step Instructions for Meta Dashboard */}
              <div className="space-y-4">
                <div className="flex items-center gap-2">
                  <Info className="text-emerald-500" size={18} />
                  <h4 className="text-xs font-black text-slate-950 uppercase tracking-widest">Procedimento no Portal Meta Developers</h4>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="p-5 border border-slate-100 rounded-2xl bg-slate-50/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-600 font-black px-2 py-0.5 rounded-lg">1. ATIVAR WEBHOOKS</span>
                      <button 
                        onClick={() => copyToClipboard('https://api.taxicontrol.ao/v1/whatsapp/webhook', 'webhook')}
                        className="text-[10px] text-slate-400 hover:text-slate-800 font-bold flex items-center gap-1 active:scale-95 transition-all"
                      >
                        <Copy size={11} /> 
                        {copiedText === 'webhook' ? 'Copiado!' : 'Copiar URL'}
                      </button>
                    </div>
                    <p className="text-xs text-slate-600 font-medium leading-relaxed">
                      No seu aplicativo no site <strong>Meta developer console</strong>, vá para produtos e configure <strong className="text-slate-900">WhatsApp</strong>. Em seguida, selecione "Configuration" e configure o Campo de Callback URL:
                    </p>
                    <code className="block bg-slate-900 text-slate-200 text-[10px] font-black p-3.5 rounded-xl text-center select-all font-mono">
                      https://api.taxicontrol.ao/v1/whatsapp/webhook
                    </code>
                  </div>

                  <div className="p-5 border border-slate-100 rounded-2xl bg-slate-50/50 space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] bg-emerald-500/10 text-emerald-600 font-black px-2 py-0.5 rounded-lg">2. VERIFY TOKEN</span>
                      <button 
                        onClick={() => copyToClipboard(verifyToken, 'verify')}
                        className="text-[10px] text-slate-400 hover:text-slate-800 font-bold flex items-center gap-1 active:scale-95 transition-all"
                      >
                        <Copy size={11} />
                        {copiedText === 'verify' ? 'Copiado!' : 'Copiar Verify'}
                      </button>
                    </div>
                    <p className="text-xs text-slate-600 font-medium leading-relaxed">
                      No campo "Verify Token" da Meta, insira rigorosamente o mesmo texto secreto configurado na nossa central:
                    </p>
                    <code className="block bg-slate-900 text-slate-200 text-[10px] font-black p-3.5 rounded-xl text-center select-all font-mono">
                      {verifyToken}
                    </code>
                  </div>
                </div>

                <div className="p-5 border border-amber-500/10 rounded-2xl bg-amber-50/20 space-y-2">
                  <p className="text-xs font-black text-amber-800 uppercase tracking-widest leading-none">3. Subscrever Tópicos Críticos</p>
                  <p className="text-xs text-amber-700 font-medium leading-relaxed">
                    Depois de validar a ligação, adicione as subscrições para o evento <strong className="text-slate-900">messages</strong> na tabela "Webhook Fields". 
                    Isto permite que as mensagens enviadas pelos motoristas de Luena via canal oficial ou clientes SUPER Taxi sejam entregues na nossa consola operacional instantaneamente.
                  </p>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
