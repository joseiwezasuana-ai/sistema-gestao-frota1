import React, { useState, useEffect } from 'react';
import { User, Shield, ArrowRight, Loader2, Key, AlertCircle, ChevronRight, CheckCircle2, ShieldCheck, LogOut, Mail } from 'lucide-react';
import { motion } from 'motion/react';
import { doc, setDoc, getDoc, updateDoc, collection, query, where, getDocs, orderBy } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { signOut } from 'firebase/auth';

interface ProfileSetupProps {
  user: any;
  onComplete: (profile: any) => void;
}

export default function ProfileSetup({ user, onComplete }: ProfileSetupProps) {
  const [name, setName] = useState('');
  const [role, setRole] = useState('operator');
  const [id, setId] = useState('');
  const [accessCode, setAccessCode] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null); // Restored error state
  const [isCodeValidated, setIsCodeValidated] = useState(false);
  const [collaborators, setCollaborators] = useState<{ id: string, name: string }[]>([]);
  const [collaboratorsLoading, setCollaboratorsLoading] = useState(false);
  const [validationRole, setValidationRole] = useState<string | null>(null);

  const handleLogout = () => {
    signOut(auth);
  };

  // Fetch registered collaborators (Staff & Drivers)
  useEffect(() => {
    // Hidden until code is validated for everyone
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
  }, [isCodeValidated, validationRole]);

  const isAdminEmail = user.email?.toLowerCase() === 'joseiwezasuana@gmail.com';

  useEffect(() => {
    if (isAdminEmail) {
      setIsCodeValidated(true);
      setValidationRole('admin');
      if (!name) setName('Administrador Master');
      if (!id) setId('ADMIN-01');
    }
  }, [isAdminEmail]);

  const handleVerifyCode = async () => {
    if (!accessCode.trim() || !id.trim()) {
      setError("Insira o seu ID do Colaborador e o Código de Acesso.");
      return;
    }

    setIsSubmitting(true);
    setError(null);

    try {
      const q = query(
        collection(db, 'access_codes'), 
        where('code', '==', accessCode.trim().toUpperCase()),
        where('assignedId', '==', id.trim().toUpperCase()),
        where('used', '==', false)
      );
      const querySnapshot = await getDocs(q);

      if (querySnapshot.empty) {
        throw new Error("Código de acesso ou ID inválidos.");
      }

      const codeDoc = querySnapshot.docs[0];
      const codeData = codeDoc.data();
      
      setValidationRole(codeData.role);
      setIsCodeValidated(true);
      setName(''); // Reset name selection after validation
    } catch (err: any) {
      setError(err.message);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    setError(null);

    const path = `users/${user.uid}`;
    try {
      let finalRole = role;

      if (!isAdminEmail) {
        // Verify Access Code via Query (Double check)
        const q = query(
          collection(db, 'access_codes'), 
          where('code', '==', accessCode.trim().toUpperCase()), 
          where('assignedId', '==', id.trim().toUpperCase()),
          where('used', '==', false)
        );
        
        let codeSnap;
        try {
          codeSnap = await getDocs(q);
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, 'access_codes');
          return;
        }

        if (codeSnap.empty) {
          setError('Código de acesso ou ID inválidos ou já utilizados.');
          setIsSubmitting(false);
          return;
        }

        const codeDoc = codeSnap.docs[0];
        const codeData = codeDoc.data();
        const codeRef = codeDoc.ref;
        
        // Mark code as used
        try {
          await updateDoc(codeRef, {
            used: true,
            usedBy: user.uid,
            usedAt: new Date().toISOString()
          });
        } catch (err) {
          handleFirestoreError(err, OperationType.UPDATE, `access_codes/${codeDoc.id}`);
          return;
        }

        // Use the role defined in the code
        finalRole = codeData.role;
      }

      const newProfile = {
        uid: user.uid,
        email: user.email || '',
        name: name.trim(),
        role: isAdminEmail ? 'admin' : finalRole,
        createdAt: new Date().toISOString()
      };

      try {
        await setDoc(doc(db, 'users', user.uid), newProfile);
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, path);
        return;
      }
      onComplete(newProfile);
    } catch (err: any) {
      console.error('Error creating profile:', err);
      try {
        const parsed = JSON.parse(err.message);
        if (parsed.error.includes('permissions')) {
          setError('Erro de permissão: Sua conta não tem autorização para criar este perfil. Verifique seu ID/Código.');
        } else {
          setError(`Erro técnico: ${parsed.error}`);
        }
      } catch {
        setError('Erro ao criar perfil. Verifique sua ligação à internet.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-100 px-4 font-sans antialiased text-slate-900">
      <div className="w-full max-w-md bg-white rounded-[2.5rem] shadow-[0_32px_64px_-16px_rgba(0,0,0,0.15)] border border-slate-200/50 overflow-hidden">
        <div className="bg-[#0f172a] p-10 text-center text-white relative overflow-hidden">
          {/* Technical Grid Pattern */}
          <div className="absolute inset-0 opacity-10 pointer-events-none" 
               style={{ backgroundImage: 'radial-gradient(#94a3b8 1px, transparent 1px)', backgroundSize: '20px 20px' }}></div>
          
          <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/10 blur-[100px] rounded-full -mr-32 -mt-32 animate-pulse" />
          
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-3xl bg-gradient-to-br from-brand-primary to-blue-700 shadow-2xl shadow-brand-primary/40 relative z-10 mb-6 border border-white/10 overflow-hidden">
            <User size={40} className="text-white drop-shadow-lg relative z-10" />
            <div className="absolute -bottom-1 -right-1">
              <div className="w-5 h-5 bg-emerald-500 rounded-full border-4 border-[#0f172a] flex items-center justify-center">
                 <div className="w-1.5 h-1.5 bg-white rounded-full animate-pulse" />
              </div>
            </div>
          </div>
          
          <h2 className="text-3xl font-black tracking-tighter uppercase italic relative z-10 leading-none">
            CONFIGURAR<span className="text-brand-primary ml-1">PERFIL</span>
          </h2>
          
          <div className="mt-4 flex items-center justify-center gap-3 relative z-10 px-4">
             <div className="h-0.5 w-6 bg-brand-primary/30" />
             <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.4em] whitespace-nowrap">PSM COMERCIAL LUENA MOXICO</p>
             <div className="h-0.5 w-6 bg-brand-primary/30" />
          </div>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4 relative z-10">
             <div className="flex flex-col items-center px-4 py-2 bg-white/5 rounded-xl border border-white/5 backdrop-blur-sm text-center">
                <span className="text-[10px] font-mono font-bold text-white tracking-widest">{new Date().toLocaleDateString()}</span>
                <span className="text-[7px] font-black text-slate-500 uppercase tracking-widest">Data Ativação</span>
             </div>
             
             <div className="flex flex-col items-center px-4 py-2 bg-white/5 rounded-xl border border-white/5 backdrop-blur-sm text-center">
                <div className="flex items-center gap-1.5">
                   <Shield size={10} className="text-brand-primary" />
                   <span className="text-[10px] font-mono font-bold text-white uppercase tracking-tight">SECURE</span>
                </div>
                <span className="text-[7px] font-black text-brand-primary uppercase tracking-widest">SISTEMA V4.5</span>
             </div>
          </div>

          <div className="absolute bottom-4 left-0 right-0 px-8 flex justify-between items-center relative z-10">
             <div className="font-mono text-[6px] text-slate-500 tracking-tighter uppercase">
                <span>Core_System_Registry</span><br/>
                <span>Port: 3000 // Active</span>
             </div>
             <button 
               onClick={handleLogout}
               className="flex items-center gap-1.5 px-3 py-1.5 bg-white/10 hover:bg-white/20 rounded-full border border-white/10 transition-colors text-[9px] font-bold text-white uppercase tracking-wider"
             >
               <LogOut size={10} />
               Sair
             </button>
          </div>
        </div>

        <div className="px-8 pt-6 pb-2 border-b border-slate-100 bg-slate-50/50">
           <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full bg-brand-primary/10 flex items-center justify-center text-brand-primary">
                 <Mail size={14} />
              </div>
              <div className="flex flex-col">
                 <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Sessão Iniciada como</span>
                 <span className="text-xs font-bold text-slate-700 truncate max-w-[240px]">{user.email}</span>
              </div>
           </div>
           {isAdminEmail && (
             <div className="mt-2 text-[9px] font-bold text-emerald-600 bg-emerald-50 rounded px-2 py-1 flex items-center gap-1.5">
                <ShieldCheck size={10} />
                ESTA É UMA CONTA DE ADMINISTRADOR MASTER
             </div>
           )}
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6" key={`setup-container-${isCodeValidated}`}>
          {error && (
            <div className="bg-red-50 border border-red-100 p-3 rounded-lg flex items-center gap-2 text-red-600 text-xs font-bold animate-in fade-in duration-300">
              <AlertCircle size={14} />
              {error}
            </div>
          )}

          {!isCodeValidated && (
            <div className="space-y-4">
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  ID do Colaborador
                </label>
                <input 
                  required
                  type="text" 
                  value={id}
                  onChange={(e) => setId(e.target.value.toUpperCase())}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-brand-primary transition-all text-sm font-bold"
                  placeholder="EX: MOT-01"
                />
              </div>

              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest flex items-center gap-2">
                  <Key size={12} />
                  Código de Acesso
                </label>
                <input 
                  required
                  type="text" 
                  value={accessCode}
                  onChange={(e) => setAccessCode(e.target.value.toUpperCase())}
                  className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-brand-primary transition-all font-mono text-center tracking-[0.5em] text-lg uppercase"
                  placeholder="XXXX-XXXX"
                />
                <p className="text-[10px] text-slate-400 font-medium">Solicite o seu código ao administrador da central.</p>
              </div>

              <button
                type="button"
                onClick={handleVerifyCode}
                disabled={isSubmitting}
                className="w-full bg-slate-900 text-white flex items-center justify-center gap-2 py-3 rounded-lg font-bold hover:bg-slate-800 transition-all disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : (
                  <>
                    VERIFICAR ACESSO
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </div>
          )}

          {isCodeValidated ? (
            <div className="space-y-6 animate-in fade-in slide-in-from-top-4 duration-500">
              <div className="bg-green-50 border border-green-100 p-3 rounded-lg flex flex-col gap-1 text-green-600 text-[10px] font-black uppercase">
                <div className="flex items-center gap-2">
                  <ShieldCheck size={14} className="text-green-500" />
                  ID e Código de Acesso Confirmados
                </div>
                <div className="pl-6 opacity-70 text-[9px]">
                  Nível de Acesso: {validationRole === 'driver' ? 'MOTORISTA' : 'STAFF / ADMINISTRATIVO'}
                </div>
              </div>
              
              <div className="space-y-1">
                <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Confirmar Nome Registado</label>
                <div className="relative group">
                  <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-brand-primary transition-colors pointer-events-none z-10" />
                  {isAdminEmail ? (
                    <input 
                      required
                      type="text"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Introduza o seu Nome Completo"
                      className="w-full pl-11 pr-4 py-3 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-brand-primary transition-all text-sm font-bold"
                    />
                  ) : (
                    <>
                      <select 
                        required
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        className="w-full pl-11 pr-10 py-3 bg-slate-50 border border-slate-200 rounded-lg outline-none focus:border-brand-primary transition-all text-sm appearance-none font-bold"
                      >
                        <option value="">Selecione o seu nome...</option>
                        {collaboratorsLoading ? (
                          <option disabled>A carregar colaboradores...</option>
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
                    </>
                  )}
                </div>
                {!isAdminEmail && <p className="text-[10px] text-slate-400 font-medium">O seu nome deve constar no registo oficial da PSM.</p>}
              </div>

              {isAdminEmail && (
                <div className="space-y-1">
                  <label className="text-xs font-bold text-slate-500 uppercase tracking-widest">Sua Função</label>
                  <div className="p-4 rounded-xl border-2 border-brand-primary bg-blue-50 text-brand-primary flex items-center gap-3">
                    <Shield size={20} />
                    <div>
                      <span className="text-[10px] font-bold uppercase tracking-tight block">Administrador Master</span>
                      <span className="text-[9px] opacity-60">Acesso total ao sistema configurado automaticamente.</span>
                    </div>
                  </div>
                </div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="w-full bg-brand-primary text-white flex items-center justify-center gap-2 py-3 rounded-lg font-bold hover:bg-brand-secondary transition-all disabled:opacity-50"
              >
                {isSubmitting ? <Loader2 className="animate-spin" size={20} /> : (
                  <>
                    FINALIZAR REGISTO
                    <ArrowRight size={18} />
                  </>
                )}
              </button>
            </div>
          ) : null}
        </form>
      </div>
    </div>
  );
}
