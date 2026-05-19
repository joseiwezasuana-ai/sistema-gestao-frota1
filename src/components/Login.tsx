import React, { useState, useEffect } from 'react';
import { LogIn, Car, User, Key, ArrowRight, Shield, AlertCircle, Loader2, CheckCircle2, ShieldCheck, ChevronRight, MessageSquare, MoreVertical, X, Globe, Lock } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { signInWithEmailAndPassword, createUserWithEmailAndPassword, updateProfile, signInWithRedirect } from 'firebase/auth';
import { db, auth, googleProvider, withTimeout } from '../lib/firebase';
import { collection, query, where, getDocs, updateDoc, doc, setDoc, serverTimestamp, orderBy, getDoc } from 'firebase/firestore';

interface LoginProps {
  onGoogleLogin: () => void | Promise<any>;
}

export default function Login({ onGoogleLogin }: LoginProps) {
  const [loginMethod, setLoginMethod] = useState<'cover' | 'google' | 'credentials' | 'register' | 'recover'>('cover');
  const [showMenu, setShowMenu] = useState(false);
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
        const settingsSnap = await withTimeout(getDoc(doc(db, 'settings', 'global')));
        if (settingsSnap.exists()) {
          setWhatsAppLink(settingsSnap.data().whatsAppLink || '');
        }
      } catch (err) {
        console.error("Error fetching settings:", err);
      }
    };
    fetchSettings();
  }, []);

  const handleMethodChange = (method: 'cover' | 'google' | 'credentials' | 'register' | 'recover') => {
    setLoginMethod(method);
    setShowMenu(false);
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

  const handleRecover = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    try {
      if (!id.trim() || !code.trim() || !password.trim()) {
        throw new Error("Todos os campos são obrigatórios para a recuperação.");
      }
      if (password.length < 6) {
        throw new Error("A nova palavra-passe deve ter pelo menos 6 caracteres.");
      }

      const response = await fetch('/api/auth/recover-access', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          id: id.trim().toUpperCase(),
          code: code.trim().toUpperCase(),
          newPassword: password.trim()
        })
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || "Ocorreu um erro ao recuperar seu acesso.");
      }

      setSuccess("Palavra-passe redefinida com sucesso! Introduza a sua nova palavra-passe.");
      alert("Acesso recuperado com sucesso! Já pode aceder com a nova palavra-passe.");
      setLoginMethod('credentials');
      setPassword('');
    } catch (err: any) {
      console.error("Recovery error:", err);
      setError(err.message || "Falha na comunicação com o servidor central.");
    } finally {
      setLoading(false);
    }
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
          const staffSnap = await withTimeout(getDocs(staffQuery));
          results = staffSnap.docs
            .filter(doc => doc.data().name)
            .map(doc => ({ id: doc.id, name: doc.data().name }));
        } else if (validationRole === 'driver') {
          const driversQuery = query(
            collection(db, 'drivers_master'), 
            where('status', '==', 'Ativo')
          );
          const driversSnap = await withTimeout(getDocs(driversQuery));
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
      // Direct promise call
      await onGoogleLogin();
    } catch (err: any) {
      console.error('Login error detail:', err);
      if (err.code === 'auth/popup-blocked' || err.message?.includes('popup')) {
        setError('O pop-up de login foi bloqueado pelo seu navegador.');
        setShowPopupTip(true);
      } else if (err.code === 'auth/network-request-failed') {
        setError('Falha na conexão de rede. Verifique seu sinal de internet ou se existe algum firewall bloqueando o acesso ao Google.');
        setShowPopupTip(false);
      } else if (err.code === 'auth/cancelled-popup-request' || err.message?.includes('cancelled-popup-request')) {
        setError('Solicitação de login cancelada. Tente novamente clicando apenas uma vez.');
      } else if (err.message?.includes('INTERNAL ASSERTION FAILED')) {
        setError('Ocorreu um erro interno de autenticação. Por favor, recarregue a página.');
        setShowPopupTip(true);
      } else if (err.code === 'auth/operation-not-allowed') {
        setError('O login com Google não está ativado no Firebase Console.');
        setShowPopupTip(false);
      } else if (err.code === 'auth/unauthorized-domain') {
        const currentDomain = window.location.hostname;
        setError(`O domínio "${currentDomain}" não está autorizado no Firebase Console. 
          Vá em Authentication > Settings > Authorized Domains e adicione este endereço e também o domínio de produção.`);
        setShowPopupTip(true);
      } else if (err.code === 'auth/network-request-failed') {
        setError('Ocorreu um erro de rede. Isso pode ser devido a uma conexão instável ou ao bloqueio de scripts externos. Tente novamente ou use ID Central.');
        setShowPopupTip(true);
      } else {
        setError(`Erro ao autenticar com Google (${err.code || 'erro_desconhecido'}).`);
        setShowPopupTip(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleRedirect = async () => {
    setLoading(true);
    setError(null);
    try {
      await signInWithRedirect(auth, googleProvider);
    } catch (err: any) {
      console.error('Redirect error:', err);
      setError('Erro ao iniciar redirecionamento. Use ID Central como alternativa.');
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
      const querySnapshot = await withTimeout(getDocs(q));

      if (querySnapshot.empty) {
        // Fallback check to give better error message
        const codeOnlyQuery = query(collection(db, 'access_codes'), where('code', '==', code.trim().toUpperCase()));
        const codeOnlySnap = await withTimeout(getDocs(codeOnlyQuery));
        
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
      const querySnapshot = await withTimeout(getDocs(q));

      if (querySnapshot.empty) {
        throw new Error("Código de ativação inválido ou já utilizado.");
      }

      const codeDoc = querySnapshot.docs[0];
      const codeData = codeDoc.data();

      // 2. Create Auth Account (Client-side bypasses Admin API errors)
      const userCredential = await withTimeout(createUserWithEmailAndPassword(auth, email, password), 20000); // 20s for auth
      const user = userCredential.user;

      // 3. Update Profile & Sync Firestore
      await updateProfile(user, { displayName: name });
      
      await withTimeout(setDoc(doc(db, 'users', user.uid), {
        uid: user.uid,
        name: name,
        email: email,
        role: codeData.role,
        createdAt: serverTimestamp(),
        syncedAt: serverTimestamp()
      }));

      // 4. Mark code as used
      await withTimeout(updateDoc(doc(db, 'access_codes', codeDoc.id), {
        used: true,
        usedBy: user.uid,
        usedAt: serverTimestamp()
      }));

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
    <div className="flex min-h-screen items-center justify-center bg-slate-900 px-4 font-sans antialiased text-slate-900 notranslate selection:bg-brand-primary/30">
      {/* Background Decorative Elements */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-brand-primary/10 blur-[120px] rounded-full animate-pulse" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-emerald-500/5 blur-[120px] rounded-full" />
      </div>

      <motion.div 
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        className="w-full max-w-[440px] overflow-hidden rounded-[3rem] bg-white shadow-[0_40px_80px_-15px_rgba(0,0,0,0.5)] border border-white/10 relative z-10"
      >
        {/* Top Control Bar with 3 dots menu */}
        <div className="absolute top-8 right-8 z-50">
          <div className="relative">
            <button 
              onClick={() => setShowMenu(!showMenu)}
              className="p-3 bg-white/10 hover:bg-white/20 dark:bg-white/5 dark:hover:bg-white/10 backdrop-blur-md rounded-2xl transition-all active:scale-95 text-white"
            >
              {showMenu ? <X size={20} /> : <MoreVertical size={20} />}
            </button>

            <AnimatePresence>
              {showMenu && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.9, y: 10 }}
                  animate={{ opacity: 1, scale: 1, y: 0 }}
                  exit={{ opacity: 0, scale: 0.9, y: 10 }}
                  className="absolute right-0 mt-3 w-52 bg-white rounded-3xl shadow-2xl border border-slate-100 overflow-hidden p-2"
                >
                   <button 
                    onClick={() => handleMethodChange('google')}
                    className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 rounded-2xl transition-colors group"
                  >
                    <div className="p-2 bg-slate-100 rounded-xl group-hover:bg-brand-primary/10 group-hover:text-brand-primary transition-colors">
                      <Globe size={16} />
                    </div>
                    <span className="text-xs font-bold text-slate-700">Google Cloud</span>
                  </button>
                  <button 
                    onClick={() => handleMethodChange('credentials')}
                    className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 rounded-2xl transition-colors group"
                  >
                    <div className="p-2 bg-slate-100 rounded-xl group-hover:bg-brand-primary/10 group-hover:text-brand-primary transition-colors">
                      <LogIn size={16} />
                    </div>
                    <span className="text-xs font-bold text-slate-700">ID Central</span>
                  </button>
                  <button 
                    onClick={() => handleMethodChange('register')}
                    className="w-full flex items-center gap-3 p-3 hover:bg-slate-50 rounded-2xl transition-colors group"
                  >
                    <div className="p-2 bg-slate-100 rounded-xl group-hover:bg-brand-primary/10 group-hover:text-brand-primary transition-colors">
                      <ShieldCheck size={16} />
                    </div>
                    <span className="text-xs font-bold text-slate-700">Ativar ID</span>
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="bg-[#0f172a] p-12 text-center text-white relative overflow-hidden h-[340px] flex flex-col justify-center">
          {/* Technical Grid Pattern */}
          <div className="absolute inset-0 opacity-10 pointer-events-none" 
               style={{ backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 1px)', backgroundSize: '24px 24px' }}></div>
          
          <div className="absolute top-0 right-0 w-80 h-80 bg-brand-primary/10 blur-[120px] rounded-full -mr-40 -mt-40 animate-pulse" />
          
          <motion.div 
            initial={{ scale: 0.8, y: 20 }}
            animate={{ scale: 1, y: 0 }}
            className="mx-auto flex h-28 w-28 items-center justify-center relative z-10 mb-8 group bg-white/5 rounded-[2.5rem] p-5 border border-white/10 shadow-2xl overflow-hidden"
          >
            <img 
              src="/logo.svg" 
              alt="SUPER Taxi" 
              className="w-full h-full object-contain relative z-10 drop-shadow-[0_0_20px_rgba(59,130,246,0.5)]"
            />
          </motion.div>
          
          <h1 className="text-4xl font-black tracking-tighter uppercase italic relative z-10 leading-none">
            SUPER<span className="text-brand-primary ml-1">Taxi</span>
          </h1>
          
          <div className="mt-4 flex items-center justify-center gap-3 relative z-10 px-4">
             <div className="h-0.5 w-6 bg-brand-primary/40" />
             <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.4em] whitespace-nowrap">PSM COMERCIAL LUENA</p>
             <div className="h-0.5 w-6 bg-brand-primary/40" />
          </div>
        </div>
        
        <div className="p-10 min-h-[460px] flex flex-col items-center justify-center relative">
          <AnimatePresence mode="wait">
            {loginMethod === 'cover' ? (
              <motion.div 
                key="cover"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.95 }}
                className="text-center space-y-8"
              >
                <div className="space-y-4">
                  <h2 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic">Bem-vindo, José</h2>
                  <p className="text-[11px] text-slate-400 font-bold uppercase tracking-[0.2em] leading-relaxed max-w-[280px] mx-auto">
                    Aceda ao Hub de Controlo Operacional de Frota PS Moreira Luena. Sessão Protegida.
                  </p>
                </div>

                <div className="pt-6">
                  <button 
                    onClick={() => setShowMenu(true)}
                    className="group relative inline-flex items-center gap-4 px-10 py-5 bg-slate-900 text-white rounded-3xl font-black text-[11px] uppercase tracking-widest hover:bg-black transition-all shadow-2xl shadow-slate-900/30 active:scale-95"
                  >
                    Entrar no Sistema
                    <ArrowRight size={18} className="group-hover:translate-x-1 transition-transform" />
                  </button>
                  
                  <p className="mt-8 text-[9px] text-slate-400 font-bold uppercase tracking-[0.3em] flex items-center justify-center gap-2">
                    <Lock size={10} className="text-emerald-500" />
                    PROTOCOLO DE SEGURANÇA ATIVO
                  </p>
                </div>
              </motion.div>
            ) : (
              <motion.div 
                key={`form-${loginMethod}`}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: -20 }}
                className="w-full"
              >
                <div className="mb-8 flex items-center justify-between">
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter italic">
                    {loginMethod === 'google' ? 'Google Cloud' : loginMethod === 'credentials' ? 'ID Central' : loginMethod === 'recover' ? 'Recuperar Acesso' : 'Ativação ID'}
                  </h3>
                  <button 
                    onClick={() => handleMethodChange('cover')}
                    className="p-2 hover:bg-slate-100 rounded-xl transition-colors text-slate-400"
                  >
                    <ArrowRight className="rotate-180" size={18} />
                  </button>
                </div>

                {/* Forms Section */}
                {loginMethod === 'google' && (
                  <div className="space-y-6">
                    {error && (
                      <div className="p-3 bg-red-50 border border-red-100 text-red-600 text-xs font-bold rounded-lg flex items-center gap-2 mb-2">
                        <AlertCircle size={14} />
                        {error}
                      </div>
                    )}
                    <p className="text-center text-slate-500 text-sm font-medium">Acesse o painel utilizando a sua conta Google autorizada.</p>
                    <button
                      onClick={handleGoogleLoginClick}
                      disabled={loading}
                      className="flex w-full items-center justify-center gap-3 rounded-2xl bg-slate-900 py-4.5 font-black text-white text-[11px] uppercase tracking-widest transition-all hover:bg-black active:scale-[0.98] shadow-2xl shadow-slate-900/40 disabled:opacity-50"
                    >
                      {loading ? <Loader2 className="animate-spin" size={20} /> : (
                        <>
                          <Globe size={20} />
                          Entrar com Google
                        </>
                      )}
                    </button>
                  </div>
                )}

                {loginMethod === 'credentials' && (
                  <form onSubmit={handleCredentialsLogin} className="space-y-4">
                    {error && (
                      <div className="p-4 bg-red-50 border border-red-100 text-red-600 text-xs font-bold rounded-2xl flex items-center gap-3">
                        <AlertCircle size={16} />
                        {error}
                      </div>
                    )}
                    {success && (
                      <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-600 text-xs font-bold rounded-2xl flex items-center gap-3">
                        <CheckCircle2 size={16} />
                        {success}
                      </div>
                    )}
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">ID Operador</label>
                      <input 
                        required
                        type="text" 
                        placeholder="Ex: OP-123"
                        value={id}
                        onChange={(e) => setId(e.target.value)}
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:bg-white focus:border-brand-primary outline-none transition-all"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Senha</label>
                      <input 
                        required
                        type="password" 
                        placeholder="••••••••"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:bg-white focus:border-brand-primary outline-none transition-all"
                      />
                    </div>
                    
                    <div className="flex justify-between items-center px-1">
                      <button
                        type="button"
                        onClick={() => handleMethodChange('recover')}
                        className="text-[10px] font-black text-brand-primary hover:underline uppercase tracking-wider text-left transition-colors"
                      >
                        Esqueceu a senha? Recuperar
                      </button>
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-brand-primary text-white flex items-center justify-center gap-3 py-5 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-brand-secondary transition-all shadow-xl shadow-brand-primary/30 disabled:opacity-50 mt-4 h-[60px]"
                    >
                      {loading ? <Loader2 className="animate-spin" size={20} /> : <>ENTRAR AGORA <ArrowRight size={18}/></>}
                    </button>
                  </form>
                )}

                {loginMethod === 'recover' && (
                  <form onSubmit={handleRecover} className="space-y-4">
                    <p className="text-[11px] text-slate-500 font-medium mb-4 leading-relaxed bg-brand-primary/5 p-3.5 rounded-2xl border border-brand-primary/10">
                      José e a gerência geraram um <strong>Código de Ativação</strong> quando criaram a sua conta. Introduza esse código junto ao seu ID para atualizar a palavra-passe diretamente na central.
                    </p>

                    {error && (
                      <div className="p-4 bg-red-50 border border-red-100 text-red-600 text-xs font-bold rounded-2xl flex items-center gap-3">
                        <AlertCircle size={16} />
                        {error}
                      </div>
                    )}
                    {success && (
                      <div className="p-4 bg-emerald-50 border border-emerald-100 text-emerald-600 text-xs font-bold rounded-2xl flex items-center gap-3">
                        <CheckCircle2 size={16} />
                        {success}
                      </div>
                    )}

                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Seu ID de Operador / Viatura</label>
                      <input 
                        required
                        type="text" 
                        placeholder="Ex: TX-104 ou OP-12"
                        value={id}
                        onChange={(e) => setId(e.target.value.toUpperCase())}
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:bg-white focus:border-brand-primary outline-none transition-all"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Código de Ativação Original</label>
                      <input 
                        required
                        type="text" 
                        placeholder="Ex: PSM-XXXX"
                        value={code}
                        onChange={(e) => setCode(e.target.value.toUpperCase())}
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:bg-white focus:border-brand-primary font-mono outline-none transition-all"
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nova Palavra-passe</label>
                      <input 
                        required
                        type="password" 
                        placeholder="Mínimo 6 caracteres"
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:bg-white focus:border-brand-primary outline-none transition-all"
                      />
                    </div>

                    <button
                      type="submit"
                      disabled={loading}
                      className="w-full bg-slate-900 text-white flex items-center justify-center gap-3 py-5 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-black transition-all shadow-xl shadow-slate-900/30 disabled:opacity-50 mt-4 h-[60px]"
                    >
                      {loading ? <Loader2 className="animate-spin" size={20} /> : <>REDEFINIR PALAVRA-PASSE <ArrowRight size={18}/></>}
                    </button>

                    <button
                      type="button"
                      onClick={() => handleMethodChange('credentials')}
                      className="w-full mt-2 text-[10px] font-black text-slate-500 hover:text-slate-900 text-center uppercase tracking-wider"
                    >
                      Voltar ao Início de Sessão
                    </button>
                  </form>
                )}

                {loginMethod === 'register' && (
                  <div className="space-y-4">
                    {error && (
                      <div className="p-4 bg-red-50 border border-red-100 text-red-600 text-xs font-bold rounded-2xl flex items-center gap-3">
                        <AlertCircle size={16} />
                        {error}
                      </div>
                    )}
                    {!isCodeValidated ? (
                       <div className="space-y-4">
                          <input 
                            placeholder="ID"
                            value={id}
                            onChange={(e) => setId(e.target.value.toUpperCase())}
                            className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:bg-white focus:border-brand-primary outline-none transition-all"
                          />
                          <input 
                            placeholder="CÓDIGO DE ATIVAÇÃO"
                            value={code}
                            onChange={(e) => setCode(e.target.value.toUpperCase())}
                            className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:bg-white focus:border-brand-primary font-mono outline-none transition-all"
                          />
                          <button
                            onClick={handleVerifyCode}
                            className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-black transition-all"
                          >
                            VALIDAR CÓDIGO
                          </button>
                       </div>
                    ) : (
                       <form onSubmit={handleRegister} className="space-y-4">
                          <select 
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:bg-white focus:border-brand-primary outline-none transition-all"
                          >
                            <option value="">Selecione o seu nome...</option>
                            {collaborators.map(c => <option key={c.id} value={c.name}>{c.name}</option>)}
                          </select>
                          <input 
                            required
                            type="password" 
                            placeholder="PALAVRA-PASSE"
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className="w-full px-5 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:bg-white focus:border-brand-primary outline-none transition-all"
                          />
                          <button
                            type="submit"
                            className="w-full bg-brand-primary text-white py-5 rounded-2xl font-black text-[11px] uppercase tracking-widest hover:bg-brand-secondary transition-all"
                          >
                            ATIVAR CONTA AGORA
                          </button>
                       </form>
                    )}
                  </div>
                )}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
        
        <div className="px-10 py-6 bg-slate-50/50 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-400 font-black uppercase tracking-widest italic">
          <span>v4.5 • LUENA</span>
          <span className="opacity-50">SISTEMA AUDITADO</span>
        </div>
      </motion.div>
    </div>
  );
}
