import React, { useState, useEffect } from 'react';
import { LogIn, Car, User, Key, ArrowRight, Shield, AlertCircle, Loader2, CheckCircle2, ShieldCheck, ChevronRight, MessageSquare } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile } from 'firebase/auth';
import { db, auth } from '../lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc, setDoc, serverTimestamp, orderBy, getDoc } from 'firebase/firestore';

interface LoginProps {
  onGoogleLogin: () => void;
}

export default function Login({ onGoogleLogin }: LoginProps) {
  const [loginMethod, setLoginMethod] = useState<'google' | 'credentials' | 'register'>('google');
  const [id, setId] = useState('');
  const [password, setPassword] = useState('');
  const [name, setName] = useState('');
  const [code, setCode] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [showPopupTip, setShowPopupTip] = useState(false);
  const [collaborators, setCollaborators] = useState<{ id: string, name: string }[]>([]);
  const [collaboratorsLoading, setCollaboratorsLoading] = useState(false);
  const [isCodeValidated, setIsCodeValidated] = useState(false);
  const [isValidatingCode, setIsValidatingCode] = useState(false);
  const [validationRole, setValidationRole] = useState<string | null>(null);
  const [whatsAppLink, setWhatsAppLink] = useState('');

  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const settingsSnap = await getDoc(doc(db, 'settings', 'global'));
        if (settingsSnap.exists()) {
          setWhatsAppLink(settingsSnap.data().whatsAppLink || '');
        }
      } catch (err) {
        console.error("Error fetching settings:", err);
      }
    };
    fetchSettings();
  }, []);

  const handleMethodChange = (method: 'google' | 'credentials' | 'register') => {
    setLoginMethod(method);
    setIsCodeValidated(false);
    setValidationRole(null);
    setCollaborators([]);
    setError(null);
    setSuccess(null);
    setId('');
    setPassword('');
    setCode('');
    setName('');
  };

  // Fetch registered collaborators (Staff & Drivers)
  useEffect(() => {
    // Strictly only fetch if validated
    if (!isCodeValidated || !validationRole) {
      setCollaborators([]);
      return;
    }

    const fetchCollaborators = async () => {
      setCollaboratorsLoading(true);
      try {
        let results: { id: string, name: string }[] = [];

        if (validationRole === 'admin' || validationRole === 'operator' || validationRole === 'contabilista' || validationRole === 'mecanico') {
          const staffQuery = query(
            collection(db, 'administrative_staff'), 
            where('status', '==', 'Ativo')
          );
          const staffSnap = await getDocs(staffQuery);
          results = staffSnap.docs
            .filter(doc => doc.data().name)
            .map(doc => ({ id: doc.id, name: doc.data().name }));
        } else if (validationRole === 'driver') {
          const driversQuery = query(
            collection(db, 'drivers_master'), 
            where('status', '==', 'Ativo')
          );
          const driversSnap = await getDocs(driversQuery);
          results = driversSnap.docs
            .filter(doc => doc.data().name)
            .map(doc => ({ id: doc.id, name: doc.data().name }));
        }
        
        results.sort((a, b) => a.name.localeCompare(b.name));
        setCollaborators(results);
      } catch (err) {
        console.error("Error fetching collaborators:", err);
      } finally {
        setCollaboratorsLoading(false);
      }
    };

    fetchCollaborators();
  }, [loginMethod, isCodeValidated, validationRole]);

  const handleGoogleLoginClick = async () => {
    if (loading) return;
    setLoading(true);
    setError(null);
    setShowPopupTip(false);
    try {
      await onGoogleLogin();
    } catch (err: any) {
      console.error('Login error detail:', err);
      if (err.code === 'auth/popup-blocked' || err.message?.includes('popup')) {
        setError('O pop-up de login foi bloqueado pelo seu navegador.');
        setShowPopupTip(true);
      } else if (err.code === 'auth/cancelled-popup-request' || err.message?.includes('cancelled-popup-request')) {
        setError('Solicitação de login cancelada. Tente novamente clicando apenas uma vez.');
      } else if (err.message?.includes('INTERNAL ASSERTION FAILED')) {
        setError('Ocorreu um erro interno de autenticação. Por favor, recarregue a página.');
        setShowPopupTip(true);
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('O login com Google não está ativado no Firebase Console.');
        setShowPopupTip(false);
      } else {
        setError('Erro ao autenticar com Google. Tente novamente.');
      }
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyCode = async (e?: React.SyntheticEvent) => {
    if (e) e.preventDefault();
    if (!code.trim() || !id.trim()) {
      setError("Insira o ID e o Código de Ativação.");
      return;
    }

    setIsValidatingCode(true);
    setError(null);
    setSuccess(null);

    try {
      const q = query(
        collection(db, 'access_codes'), 
        where('code', '==', code.trim().toUpperCase()),
        where('assignedId', '==', id.trim().toUpperCase()),
        where('used', '==', false)
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        // Fallback check to give better error message
        const codeOnlyQuery = query(collection(db, 'access_codes'), where('code', '==', code.trim().toUpperCase()));
        const codeOnlySnap = await getDocs(codeOnlyQuery);
        
        if (codeOnlySnap.empty) {
          throw new Error("Código de ativação inválido.");
        } else if (codeOnlySnap.docs[0].data().used) {
          throw new Error("Este código já foi utilizado.");
        } else {
          throw new Error("O ID fornecido não corresponde a este Código de Ativação.");
        }
      }

      const codeDoc = querySnapshot.docs[0];
      const codeData = codeDoc.data();
      
      const role = codeData.role || 'driver';
      setValidationRole(role);
      setIsCodeValidated(true);
      setSuccess('Combinação ID + Código validada! Escolha agora o seu nome.');
    } catch (err: any) {
      console.error("Verification error:", err);
      setError(err.message || "Erro ao verificar dados de acesso.");
    } finally {
      setIsValidatingCode(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (password.length < 6) throw new Error("A senha deve ter pelo menos 6 caracteres.");
      if (!id.trim() || !code.trim()) throw new Error("ID e Código são obrigatórios.");

      const sanitizedId = id.trim().toLowerCase().replace(/\s+/g, '-');
      const email = id.includes('@') ? id.trim().toLowerCase() : `${sanitizedId}@taxicontrol.ao`;

      // 1. Validate Access Code (Double check for security)
      const q = query(
        collection(db, 'access_codes'), 
        where('code', '==', code.trim().toUpperCase()),
        where('assignedId', '==', id.trim().toUpperCase()),
        where('used', '==', false)
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        throw new Error("Código de ativação inválido ou já utilizado.");
      }

      const codeDoc = querySnapshot.docs[0];
      const codeData = codeDoc.data();

      // 2. Create Auth Account (Client-side bypasses Admin API errors)
      const userCredential = await createUserWithEmailAndPassword(auth, email, password);
      const user = userCredential.user;

      // 3. Update Profile & Sync Firestore
      await updateProfile(user, { displayName: name });
      
      await setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        name: name,
        email: email,
        role: codeData.role,
        createdAt: serverTimestamp(),
        syncedAt: serverTimestamp()
      });

      // 4. Mark code as used
      await updateDoc(doc(db, 'access_codes', codeDoc.id), {
        used: true,
        usedBy: user.uid,
        usedAt: serverTimestamp()
      });

      setSuccess('Conta ativada com sucesso! Já pode navegar no painel.');
      // Auto switch to login or it will auto-redirect if App.tsx listens
    } catch (err: any) {
      console.error("Register error:", err);
      if (err.code === 'auth/email-already-in-use') {
        setError("Este ID já está registado no sistema.");
      } else {
        setError(err.message);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleCredentialsLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    
    try {
      const sanitizedId = id.trim().toLowerCase().replace(/\s+/g, '-');
      const email = id.includes('@') ? id.trim().toLowerCase() : `${sanitizedId}@taxicontrol.ao`;
      await signInWithEmailAndPassword(auth, email, password);
    } catch (err: any) {
      console.error('Login error:', err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/wrong-password' || err.code === 'auth/invalid-credential') {
        setError('ID ou Palavra-passe incorretos.');
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('O login por ID Central (E-mail) não está ativado no Firebase Console.');
      } else {
        setError('Erro ao autenticar. Verifique sua conexão.');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 font-sans antialiased text-slate-900">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="w-full max-w-md overflow-hidden rounded-[2.5rem] bg-white shadow-[0_32px_64px_-16px_rgba(0,0,0,0.15)] border border-slate-200/50"
      >
        <div className="bg-[#0f172a] p-10 text-center text-white relative overflow-hidden">
          {/* Technical Grid Pattern */}
          <div className="absolute inset-0 opacity-10 pointer-events-none" 
               style={{ backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
          <div className="absolute inset-0 opacity-20 pointer-events-none"
               style={{ backgroundImage: 'linear-gradient(#1e293b 1px, transparent 1px), linear-gradient(90deg, #1e293b 1px, transparent 1px)', backgroundSize: '100px 100px' }}></div>
          
          <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/10 blur-[100px] rounded-full -mr-32 -mt-32 animate-pulse" />
          <div className="absolute bottom-0 left-0 w-48 h-48 bg-emerald-500/5 blur-[80px] rounded-full -ml-24 -mb-24" />
          
          <motion.div 
            initial={{ scale: 0.8, rotate: -5 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: 'spring', damping: 12 }}
            className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-brand-primary to-blue-700 shadow-2xl shadow-brand-primary/40 relative z-10 mb-6 border border-white/10 group overflow-hidden"
          >
            <div className="absolute inset-0 bg-white/10 group-hover:bg-transparent transition-colors"></div>
            <Car size={40} className="text-white drop-shadow-lg relative z-10" />
            <div className="absolute -bottom-1 -right-1">
              <div className="w-5 h-5 bg-emerald-500 rounded-full border-4 border-[#0f172a] flex items-center justify-center">
                 <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
              </div>
            </div>
          </motion.div>
          
          <h1 className="text-4xl font-black tracking-tighter uppercase italic relative z-10 leading-none">
            SUPER<span className="text-brand-primary ml-1">Taxi</span>
          </h1>
          
          <div className="mt-4 flex items-center justify-center gap-3 relative z-10 px-4">
             <div className="h-0.5 w-6 bg-brand-primary/30" />
             <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.4em] whitespace-nowrap">PSM COMERCIAL LUENA MOXICO</p>
             <div className="h-0.5 w-6 bg-brand-primary/30" />
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4 relative z-10">
             <div className="flex flex-col items-center px-4 py-2 bg-white/5 rounded-xl border border-white/5 backdrop-blur-sm">
                <span className="text-[10px] font-mono font-bold text-white tracking-widest">{new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span>
                <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Tempo Real</span>
             </div>
             
             <div className="flex flex-col items-center px-4 py-2 bg-white/5 rounded-xl border border-white/5 backdrop-blur-sm">
                <div className="flex items-center gap-1.5">
                   <div className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-pulse" />
                   <span className="text-[10px] font-mono font-bold text-white uppercase tracking-tight">Active</span>
                </div>
                <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Servidor</span>
             </div>

             <div className="flex flex-col items-center px-4 py-2 bg-white/5 rounded-xl border border-white/5 backdrop-blur-sm">
                <span className="text-[10px] font-mono font-bold text-brand-primary">SECURED</span>
                <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">SSL / FIREWALL</span>
             </div>
          </div>
          
          <div className="absolute bottom-4 left-0 right-0 px-8 opacity-20 pointer-events-none">
             <div className="flex justify-between items-center font-mono text-[8px] text-slate-500 tracking-tighter">
                <span>0xFF_SUPER_TAXI_LUA_CORE</span>
                <div className="flex gap-4">
                  <span>LAT: -11.78</span>
                  <span>LON: 19.91</span>
                </div>
             </div>
          </div>
        </div>
        
        <div className="p-8">
          <div className="flex bg-slate-100 p-1 rounded-xl mb-8">
            <button 
              onClick={() => setLoginMethod('google')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-xs font-black uppercase tracking-widest transition-all ${
                loginMethod === 'google' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Google
            </button>
            <button 
              onClick={() => setLoginMethod('credentials')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                loginMethod === 'credentials' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              ID Central
            </button>
            <button 
              onClick={() => setLoginMethod('register')}
              className={`flex-1 flex items-center justify-center gap-2 py-2.5 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all ${
                loginMethod === 'register' ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-400 hover:text-slate-600'
              }`}
            >
              Ativar ID
            </button>
          </div>

          {success && (
            <div className="p-3 bg-green-50 border border-green-100 text-green-600 text-[11px] font-bold rounded-lg flex items-center gap-2 mb-6">
              <CheckCircle2 size={14} />
              {success}
            </div>
          )}

          <div className="min-h-[300px]" key={`login-container-${loginMethod}`}>
            {loginMethod === 'google' && (
              <div className="space-y-6">
                {error && (
                  <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-xs font-bold rounded-lg flex flex-col gap-2 mb-2 transition-all">
                    <div className="flex items-center gap-2">
                      <AlertCircle size={14} />
                      {error}
                    </div>
                    {showPopupTip && (
                      <div className="pl-6 space-y-2">
                        <p className="text-[10px] text-red-500 font-medium leading-tight">
                          O seu navegador impediu a abertura da janela de login. Tente permitir pop-ups ou use o botão abaixo:
                        </p>
                        <a 
                          href={window.location.href} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-red-600 text-white rounded-lg text-[9px] font-black uppercase tracking-wider hover:bg-red-700 transition-all shadow-sm"
                        >
                          Abrir num novo separador
                          <ArrowRight size={10} />
                        </a>
                      </div>
                    )}
                  </div>
                )}
                
                <p className="text-center text-slate-500 text-sm font-medium">
                  Acesse o painel administrativo utilizando a sua conta Google autorizada.
                </p>
                <button
                  onClick={handleGoogleLoginClick}
                  disabled={loading}
                  className="flex w-full items-center justify-center gap-3 rounded-xl bg-slate-900 py-3.5 font-bold text-white transition-all hover:bg-slate-800 active:scale-[0.98] shadow-lg shadow-slate-900/20 disabled:opacity-50"
                >
                  {loading ? <Loader2 className="animate-spin" size={20} /> : (
                    <>
                      <LogIn size={20} />
                      Entrar com Google
                    </>
                  )}
                </button>
              </div>
            )}

            {loginMethod === 'credentials' && (
              <form onSubmit={handleCredentialsLogin} className="space-y-4">
                {error && (
                  <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-xs font-bold rounded-lg flex items-center gap-2 mb-2">
                    <AlertCircle size={14} />
                    {error}
                  </div>
                )}
                
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ID do Operador / Motorista</label>
                  <div className="relative group">
                    <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-brand-primary transition-colors" />
                    <input 
                      required
                      type="text" 
                      placeholder="Ex: OP-123"
                      value={id}
                      onChange={(e) => setId(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:bg-white focus:border-brand-primary outline-none transition-all"
                    />
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Palavra-passe</label>
                  <div className="relative group">
                    <Key size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-brand-primary transition-colors" />
                    <input 
                      required
                      type="password" 
                      placeholder="••••••••"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:bg-white focus:border-brand-primary outline-none transition-all"
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={loading}
                  className="w-full bg-brand-primary text-white flex items-center justify-center gap-2 py-3.5 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-brand-secondary transition-all hover:shadow-lg hover:shadow-brand-primary/20 disabled:opacity-50 mt-4 h-[52px]"
                >
                  {loading ? <Loader2 className="animate-spin" size={20} /> : (
                    <>
                      AUTENTICAR NO SISTEMA
                      <ArrowRight size={18} />
                    </>
                  )}
                </button>
              </form>
            )}

            {loginMethod === 'register' && (
              <div className="space-y-4">
                {error && (
                  <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-xs font-bold rounded-lg flex items-center gap-2 animate-in fade-in zoom-in duration-200">
                    <AlertCircle size={14} />
                    {error}
                  </div>
                )}
                
                {success && !isCodeValidated && (
                  <div className="p-3 bg-green-50 border border-green-100 text-green-700 text-xs font-bold rounded-lg flex items-center gap-2 animate-in fade-in zoom-in duration-200">
                    <CheckCircle2 size={14} />
                    {success}
                  </div>
                )}
                
                {!isCodeValidated ? (
                  <div className="space-y-4 animate-in fade-in duration-300" key="verify-step">
                    <div className="grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ID Atribuído</label>
                        <input 
                          required
                          type="text" 
                          placeholder="Ex: MOT-01"
                          value={id}
                          onChange={(e) => setId(e.target.value.toUpperCase())}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:bg-white focus:border-brand-primary outline-none transition-all"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cód. Ativação</label>
                        <input 
                          required
                          type="text" 
                          placeholder="XXXX-XXXX"
                          value={code}
                          onChange={(e) => setCode(e.target.value.toUpperCase())}
                          className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:bg-white focus:border-brand-primary font-mono outline-none transition-all"
                        />
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={handleVerifyCode}
                      disabled={isValidatingCode}
                      className="w-full bg-slate-900 text-white flex items-center justify-center gap-2 py-4 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-slate-800 transition-all shadow-lg shadow-slate-900/20 disabled:opacity-50"
                    >
                      {isValidatingCode ? <Loader2 className="animate-spin" size={20} /> : (
                        <>
                          VERIFICAR DADOS DE ACESSO
                          <ShieldCheck size={18} />
                        </>
                      )}
                    </button>

                    <div className="pt-2">
                      <button
                        type="button"
                        onClick={() => {
                          const link = whatsAppLink || 'https://wa.me/244921644781';
                          window.open(link, '_blank');
                        }}
                        className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-dashed border-slate-200 text-slate-400 hover:text-brand-primary hover:border-brand-primary hover:bg-slate-50 transition-all group"
                      >
                        <MessageSquare size={14} className="group-hover:scale-110 transition-transform" />
                        <span className="text-[10px] font-black uppercase tracking-widest italic">Solicite o seu código à central</span>
                      </button>
                    </div>

                    <p className="text-[9px] text-center text-slate-400 font-bold uppercase mt-4 tracking-widest leading-relaxed">
                      BLOQUEIO DE SEGURANÇA ATIVADO<br/>
                      A LISTA DE COLABORADORES SÓ SERÁ EXIBIDA APÓS A VALIDAÇÃO
                    </p>
                  </div>
                ) : (
                  <form onSubmit={handleRegister} className="space-y-4 pt-2 border-t border-slate-100 animate-in fade-in slide-in-from-top-4 duration-500" key="register-step">
                    <div className="bg-emerald-50 border border-emerald-100 p-3.5 rounded-xl flex items-center gap-3 text-emerald-700 text-[10px] font-black uppercase tracking-tight mb-4 shadow-sm">
                      <div className="bg-emerald-500 p-1.5 rounded-lg">
                        <ShieldCheck size={16} className="text-white" />
                      </div>
                      <div>
                        <p className="text-emerald-900 leading-none mb-1">Acesso Validado pela Central</p>
                        <p className="text-[8px] opacity-70">Perfil Autorizado: {validationRole === 'driver' ? 'MOTORISTA OPERACIONAL' : 'STAFF ADMINISTRATIVO'}</p>
                      </div>
                    </div>
                    
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Confirmar Nome Registado</label>
                      <div className="relative group">
                        <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-brand-primary transition-colors pointer-events-none z-10" />
                        <select 
                          required
                          value={name}
                          onChange={(e) => setName(e.target.value)}
                          className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:bg-white focus:border-brand-primary outline-none transition-all appearance-none"
                        >
                          <option value="">Selecione o seu nome...</option>
                          {collaboratorsLoading ? (
                            <option disabled>A carregar lista...</option>
                          ) : collaborators.length === 0 ? (
                            <option disabled>Nenhum colaborador registado</option>
                          ) : (
                            collaborators.map(c => (
                              <option key={c.id} value={c.name}>{c.name}</option>
                            ))
                          )}
                        </select>
                        <div className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 pointer-events-none">
                          <ChevronRight size={14} className="rotate-90" />
                        </div>
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Definir Palavra-passe</label>
                      <input 
                        required
                        type="password" 
                        placeholder="Mínimo 6 caracteres"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:bg-white focus:border-brand-primary outline-none transition-all"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-brand-primary text-white flex items-center justify-center gap-2 py-3.5 rounded-xl font-black text-xs uppercase tracking-widest hover:bg-brand-secondary transition-all shadow-lg shadow-brand-primary/20 disabled:opacity-50 mt-4 h-[52px]"
                    >
                      {loading ? <Loader2 className="animate-spin" size={20} /> : (
                        <>
                          ATIVAR MINHA CONTA AGORA
                          <CheckCircle2 size={18} />
                        </>
                      )}
                    </button>
                  </form>
                )}
              </div>
            )}
          </div>
          
          <div className="mt-10 pt-6 border-t border-slate-100 flex items-center justify-between text-[10px] text-slate-400 font-bold uppercase tracking-tighter">
            <span className="flex items-center gap-1.5">
               <Shield size={10} className="text-brand-primary" />
               Acesso Seguro
            </span>
            <span>v2.5.0 • TaxiControl AO</span>
          </div>
        </div>
      </motion.div>
    </div>
  );
}
