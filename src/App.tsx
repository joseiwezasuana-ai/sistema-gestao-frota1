import React, { useState, useEffect } from 'react';
import { 
  onAuthStateChanged, 
  signInWithPopup, 
  signOut, 
  User 
} from 'firebase/auth';
import { 
  collection, 
  onSnapshot, 
  query, 
  orderBy, 
  limit, 
  getDoc,
  doc,
  setDoc,
  where,
  getDocs
} from 'firebase/firestore';
import { auth, db, googleProvider } from './lib/firebase';
import Layout from './components/Layout';
import Dashboard from './components/Dashboard';
import Login from './components/Login';
import ProfileSetup from './components/ProfileSetup';
import FleetManagement from './components/FleetManagement';
import RealTimeMap from './components/RealTimeMap';
import History from './components/History';
import Settings from './components/Settings';
import Messages from './components/Messages';
import RealTimeMonitor from './components/RealTimeMonitor';
import GPSTimeline from './components/GPSTimeline';
import DriverView from './components/DriverView';
import MechanicView from './components/MechanicView';
import StaffMobileView from './components/StaffMobileView';
import AlertNotificationManager from './components/AlertNotificationManager';
import MaintenanceRegistry from './components/MaintenanceRegistry';
import RevenueManagement from './components/RevenueManagement';
import RecruitmentHub from './components/RecruitmentHub';
import AccountingManager from './components/AccountingManager';
import WarehouseManager from './components/WarehouseManager';
import InternalClients from './components/InternalClients';
import RentACar from './components/RentACar';
import CompanyPhones from './components/CompanyPhones';
import ProfileEdit from './components/ProfileEdit';

import { 
  AlertCircle, 
  RefreshCw,
  Layout as LayoutIcon, 
  Activity, 
  Map as MapIcon,
  Copy,
  CheckCircle2
} from 'lucide-react';
import InvoiceDrafting from './components/InvoiceDrafting';
import { ThemeProvider } from './context/ThemeContext';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');
  const [dbError, setDbError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(typeof window !== 'undefined' ? window.innerWidth < 1024 : false);
  const [viewPreference, setViewPreference] = useState<'auto' | 'mobile' | 'desktop'>('auto');
  const [isProfileEditOpen, setIsProfileEditOpen] = useState(false);
  const [globalSettings, setGlobalSettings] = useState<any>(null);

  useEffect(() => {
    // Safety timeout for global settings - expanded to 15s
    const settingsTimeout = setTimeout(() => {
      if (!globalSettings) {
        console.warn("Global settings fetch reached timeout. Using defaults.");
        setGlobalSettings({
          companyName: "PSM COMERCIAL LUENA MOXICO",
          maintenanceAlerts: true
        });
      }
    }, 15000);

    const unsubSettings = onSnapshot(doc(db, 'settings', 'global'), (docSnap) => {
      if (docSnap.exists()) {
        setGlobalSettings(docSnap.data());
        clearTimeout(settingsTimeout);
      }
    }, (err) => {
      console.error("Settings snapshot error:", err);
      setDbError("Erro ao carregar definições globais: " + err.message);
    });
    return () => {
      unsubSettings();
      clearTimeout(settingsTimeout);
    };
  }, []);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 1024);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  useEffect(() => {
    // Safety timeout: if auth doesn't resolve in 8s, show login anyway
    const safetyTimeout = setTimeout(() => {
      if (loading) {
        console.warn("Auth initialization timed out, showing login.");
        setLoading(false);
      }
    }, 8000);

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      try {
        if (!firebaseUser) {
          setUser(null);
          setUserProfile(null);
          setLoading(false);
          clearTimeout(safetyTimeout);
          return;
        }

        setUser(firebaseUser);
        const profileRef = doc(db, 'users', firebaseUser.uid);
        
        // Timeout for profile fetch - expanded to 10s
        const profilePromise = getDoc(profileRef);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('timeout')), 10000)
        );

        let profileSnap;
        try {
          profileSnap = await Promise.race([profilePromise, timeoutPromise]) as any;
        } catch (e) {
          console.error("Profile fetch failed:", e);
          // If it's the master admin, we can fallback to a temporary profile to allow entry
          if (firebaseUser.email?.toLowerCase() === 'joseiwezasuana@gmail.com') {
             const fallbackProfile = {
              uid: firebaseUser.uid,
              email: firebaseUser.email,
              name: 'José Iweza Suana (Admin)',
              role: 'admin',
              createdAt: new Date().toISOString()
            };
            setUserProfile(fallbackProfile);
            setLoading(false);
            return;
          }
          throw e;
        }
        
        if (profileSnap.exists()) {
          const profile = profileSnap.data();
          setUserProfile(profile);
          // If driver, reset tab or handle specific view
          if (profile.role === 'driver') {
            setActiveTab('driver_dashboard');
          } else if (profile.role === 'mecanico') {
            setActiveTab('maintenance');
          } else if (profile.role === 'contabilista') {
            setActiveTab('accounting');
          }
        } else if (firebaseUser.email?.toLowerCase() === 'joseiwezasuana@gmail.com') {
          // Auto-bootstrap master admin profile
          const adminProfile = {
            uid: firebaseUser.uid,
            email: firebaseUser.email,
            name: 'José Iweza Suana (Admin)',
            role: 'admin',
            createdAt: new Date().toISOString()
          };
          setUserProfile(adminProfile);
          clearTimeout(safetyTimeout);
          setLoading(false);
          setDoc(doc(db, 'users', firebaseUser.uid), adminProfile).catch(console.error);
          return;
        } else {
          console.warn("User logged in but no profile found in Firestore.");
          setUserProfile(null);
        }
      } catch (err: any) {
        console.error("Auth State Error:", err);
        if (err.message === 'timeout' || err.code === 'unavailable') {
          setDbError("A ligação à base de dados está lenta. Pode haver limitações no carregamento de dados.");
        } else {
          setDbError(`Erro ao recuperar perfil: ${err.message}`);
        }
      } finally {
        setLoading(false);
        clearTimeout(safetyTimeout);
      }
    });

    return () => {
      unsubscribe();
      clearTimeout(safetyTimeout);
    };
  }, []);

  const configError = (window as any)._firebaseConfigError;

  if (configError) {
    return (
      <ThemeProvider>
        <div className="flex min-h-screen w-full flex-col items-center justify-center bg-slate-950 p-8 text-center text-white font-sans">
          <div className="w-24 h-24 bg-amber-500 rounded-[32px] flex items-center justify-center mb-8 shadow-2xl shadow-amber-500/20 animate-pulse">
             <AlertCircle size={48} />
          </div>
          <h1 className="text-3xl font-black mb-6 uppercase tracking-tighter italic">Erro Crítico de Firebase</h1>
          
          <div className="max-w-xl bg-slate-900/50 backdrop-blur-xl p-8 rounded-3xl border border-white/10 text-left mb-8 shadow-2xl">
            <p className="text-amber-400 font-bold text-sm mb-4 flex items-center gap-2">
              <Activity size={16} /> DETALHES DO CONFIGURAÇÃO:
            </p>
            <p className="text-slate-300 text-sm leading-relaxed mb-6">
              {configError}
            </p>
            
            <div className="space-y-4">
              <h3 className="text-white font-bold text-xs uppercase tracking-widest px-3 py-1 bg-white/5 rounded-full inline-block">Lista de Verificação:</h3>
              <ol className="text-slate-400 text-xs space-y-3 list-decimal pl-4">
                <li>Verifique se a <strong>Chave de API (apiKey)</strong> no arquivo <code>firebase-applet-config.json</code> corresponde à do novo projeto.</li>
                <li>Confirme se o <strong>Firestore</strong> está ativado e as <strong>Regras de Segurança</strong> foram publicadas no Console.</li>
                <li>Garanta que o <strong>appId</strong> e <strong>messagingSenderId</strong> estão corretos.</li>
                <li>Em <strong>Authentication &gt; Settings &gt; Authorized Domains</strong>, adicione estes dois domínios:<br/>
                  <div className="space-y-2 mt-2">
                    <div className="flex items-center gap-2 group">
                      <code className="text-white flex-1 bg-white/10 p-2 rounded text-[9px] break-all border border-white/5 group-hover:border-white/20 transition-all font-mono">ais-dev-x7ae5zjwislnpda2b3a6l6-214885335133.europe-west3.run.app</code>
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText('ais-dev-x7ae5zjwislnpda2b3a6l6-214885335133.europe-west3.run.app');
                          const btn = document.activeElement as HTMLElement;
                          if (btn) btn.innerHTML = '<span class="text-emerald-400">Copiado!</span>';
                          setTimeout(() => { if (btn) btn.innerHTML = 'Copiar'; }, 2000);
                        }}
                        className="bg-white/10 px-3 py-2 rounded-lg text-[9px] uppercase font-black tracking-widest hover:bg-white/20 active:scale-95 transition-all h-[34px] min-w-[70px]"
                      >
                        Copiar
                      </button>
                    </div>
                    <div className="flex items-center gap-2 group">
                      <code className="text-white flex-1 bg-white/10 p-2 rounded text-[9px] break-all border border-white/5 group-hover:border-white/20 transition-all font-mono">ais-pre-x7ae5zjwislnpda2b3a6l6-214885335133.europe-west3.run.app</code>
                      <button 
                        onClick={() => {
                          navigator.clipboard.writeText('ais-pre-x7ae5zjwislnpda2b3a6l6-214885335133.europe-west3.run.app');
                          const btn = document.activeElement as HTMLElement;
                          if (btn) btn.innerHTML = '<span class="text-emerald-400">Copiado!</span>';
                          setTimeout(() => { if (btn) btn.innerHTML = 'Copiar'; }, 2000);
                        }}
                        className="bg-white/10 px-3 py-2 rounded-lg text-[9px] uppercase font-black tracking-widest hover:bg-white/20 active:scale-95 transition-all h-[34px] min-w-[70px]"
                      >
                        Copiar
                      </button>
                    </div>
                  </div>
                </li>
                <li className="bg-amber-500/10 p-4 rounded-2xl border border-amber-500/20">
                  <span className="text-amber-400 font-black block mb-2 underline decoration-amber-500/30">🔥 AÇÃO NECESSÁRIA (GOOGLE CLOUD):</span>
                  No <strong>Google Cloud Console</strong>, procure por <strong>"Tela de Consentimento OAuth"</strong>. 
                  Verifique se o "User Type" está como <strong>"External"</strong> (Externa). 
                  Se estiver como <strong>"Internal"</strong>, o Google bloqueia o seu email pessoal. Clique em <strong>"MAKE EXTERNAL"</strong>.
                </li>
                <li className="bg-blue-500/10 p-4 rounded-2xl border border-blue-500/20">
                  <span className="text-blue-400 font-black block mb-2">🌐 DICA DE CONEXÃO:</span>
                  Se vir erros de "Offline" ou "Timeout", verifique se o seu sinal de internet está estável ou se existe algum Firewall/Antivírus bloqueando o tráfego do Google Firebase.
                </li>
              </ol>
            </div>
          </div>

          <div className="flex flex-col items-center gap-6">
            <button 
              onClick={() => window.location.reload()}
              className="flex items-center gap-2 px-8 py-3 bg-brand-primary text-white font-black text-[11px] uppercase tracking-widest rounded-xl hover:bg-brand-secondary transition-all shadow-lg active:scale-95"
            >
              <RefreshCw size={14} className="animate-spin-slow" />
              Tentar Novamente
            </button>
            <div className="flex items-center justify-center gap-6 opacity-30">
              <div className="h-px w-12 bg-white/20" />
              <div className="text-[10px] uppercase tracking-[0.3em] font-black italic">PSM TaxiControl</div>
              <div className="h-px w-12 bg-white/20" />
            </div>
          </div>
        </div>
      </ThemeProvider>
    );
  }

  if (loading) {
    return (
      <ThemeProvider>
        <div key="loading-state" className="flex h-screen w-full items-center justify-center bg-slate-50 dark:bg-slate-950">
          <div className="flex flex-col items-center gap-4">
            <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-primary border-t-transparent shadow-xl shadow-brand-primary/20"></div>
            <p className="text-slate-500 dark:text-slate-400 animate-pulse font-black text-xs uppercase tracking-[0.3em] italic">PSM TaxiControl v4.5 Inicializando...</p>
          </div>
        </div>
      </ThemeProvider>
    );
  }

  if (!user) {
    const handleGoogleLogin = async () => {
      // Direct call to avoid popup blocking
      return signInWithPopup(auth, googleProvider);
    };
    return (
      <ThemeProvider>
        <Login key="login-view" onGoogleLogin={handleGoogleLogin} />
      </ThemeProvider>
    );
  }

  if (!userProfile) {
    return (
      <ThemeProvider>
        <ProfileSetup key="setup-view" user={user} onComplete={setUserProfile} />
      </ThemeProvider>
    );
  }

  const isMasterAdmin = user?.email?.toLowerCase() === 'joseiwezasuana@gmail.com';
  const isAdmin = isMasterAdmin || userProfile?.role === 'admin';
  const isDriver = userProfile?.role === 'driver';
  const isMecanico = userProfile?.role === 'mecanico';
  const isContabilista = userProfile?.role === 'contabilista';
  const isOperator = isAdmin || userProfile?.role === 'operator';

  // Admin, Operators, and Accounting roles get a specialized Mobile View on small screens
  // We check for viewPreference first, then fallback to isMobile if auto
  const shouldShowMobile = (viewPreference === 'mobile') || (viewPreference === 'auto' && isMobile);
  const isAdminOrStaff = (isAdmin || isOperator || isContabilista);

  if (shouldShowMobile && isAdminOrStaff) {
    return (
      <ThemeProvider>
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
          <AlertNotificationManager />
          <StaffMobileView 
            user={userProfile} 
            onLogout={() => signOut(auth)} 
            onExitMobile={() => setViewPreference('desktop')}
          />
        </div>
      </ThemeProvider>
    );
  }

  // Drivers and Mechanics get a full-screen mobile-style view
  if (isMecanico) {
    return (
      <ThemeProvider>
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
          <AlertNotificationManager />
          <MechanicView user={userProfile} />
        </div>
      </ThemeProvider>
    );
  }

  if (isDriver) {
    return (
      <ThemeProvider>
        <div className="min-h-screen bg-slate-50 dark:bg-slate-950">
          <AlertNotificationManager />
          <DriverView user={userProfile} />
        </div>
      </ThemeProvider>
    );
  }

  return (
    <ThemeProvider>
      <div key="authed-layout" className="min-h-screen">
        <Layout 
          user={userProfile} 
          globalSettings={globalSettings}
          activeTab={activeTab} 
          onTabChange={setActiveTab}
          onLogout={() => signOut(auth)}
          onToggleMobile={() => setViewPreference('mobile')}
          onEditProfile={() => setIsProfileEditOpen(true)}
        >
          <AlertNotificationManager />
          <ProfileEdit 
            user={userProfile} 
            isOpen={isProfileEditOpen} 
            onClose={() => setIsProfileEditOpen(false)}
            onUpdate={setUserProfile}
          />
          {dbError && (
            <div className="bg-amber-100 dark:bg-amber-900/30 border-b border-amber-200 dark:border-amber-800/30 px-4 py-2 text-amber-800 dark:text-amber-200 text-xs font-bold flex items-center gap-2">
              <div className="animate-pulse h-2 w-2 rounded-full bg-amber-500" />
              {dbError}
            </div>
          )}
          {activeTab === 'dashboard' && <Dashboard user={userProfile} />}
          {activeTab === 'recruitment' && (isAdmin ? <RecruitmentHub user={userProfile} /> : <Dashboard user={userProfile} />)}
          {activeTab === 'fleet' && (isAdmin || isOperator || isMecanico || isContabilista ? <FleetManagement user={userProfile} /> : <Dashboard user={userProfile} />)}
          {activeTab === 'monitors' && <RealTimeMonitor user={userProfile} />}
          {activeTab === 'revenue' && (isAdmin || isOperator || isContabilista ? <RevenueManagement user={userProfile} /> : <Dashboard user={userProfile} />)}
          {activeTab === 'driver_preview' && <DriverView user={userProfile} />}
          {activeTab === 'map' && <RealTimeMap />}
          {activeTab === 'gps_timeline' && <GPSTimeline />}
          {activeTab === 'history' && <History />}
          {activeTab === 'maintenance' && (isAdmin || isOperator || isMecanico || isContabilista ? <MaintenanceRegistry user={userProfile} /> : <Dashboard user={userProfile} />)}
          {activeTab === 'accounting' && (isAdmin || isContabilista ? <AccountingManager user={userProfile} /> : <Dashboard user={userProfile} />)}
          {activeTab === 'warehouse' && (isAdmin || isOperator || isMecanico ? <WarehouseManager user={userProfile} /> : <Dashboard user={userProfile} />)}
          {activeTab === 'psm_phones' && (isAdmin || isOperator ? <CompanyPhones /> : <Dashboard user={userProfile} />)}
          {activeTab === 'settings' && (isAdmin ? <Settings /> : <Dashboard user={userProfile} />)}
          {activeTab === 'messages' && (isAdmin || isOperator ? <Messages /> : <Dashboard user={userProfile} />)}
        </Layout>
      </div>
    </ThemeProvider>
  );
}

function handleLogin() {
  signInWithPopup(auth, googleProvider);
}

// Wrapper to handle non-admin fallback if needed, or simply use Dashboard
function DashboardStatusWrapper({ component: Component }: any) {
  return <Component />;
}
