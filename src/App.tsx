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
import ErrorBoundary from './components/ErrorBoundary';
import FleetManagement from './components/FleetManagement';
import RealTimeMap from './components/RealTimeMap';
import History from './components/History';
import Settings from './components/Settings';
import Login from './components/Login';
import Messages from './components/Messages';
import DriversMaster from './components/DriversMaster';
import VehicleRegistry from './components/VehicleRegistry';
import ProfileSetup from './components/ProfileSetup';
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
        
        // Timeout for profile fetch
        const profilePromise = getDoc(profileRef);
        const timeoutPromise = new Promise((_, reject) => 
          setTimeout(() => reject(new Error('timeout')), 5000)
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

  if (loading) {
    return (
      <ThemeProvider>
        <ErrorBoundary>
          <div className="flex h-screen w-full items-center justify-center bg-slate-50 dark:bg-slate-950">
            <div className="flex flex-col items-center gap-4">
              <div className="h-12 w-12 animate-spin rounded-full border-4 border-brand-primary border-t-transparent shadow-xl shadow-brand-primary/20"></div>
              <p className="text-slate-500 dark:text-slate-400 animate-pulse font-black text-xs uppercase tracking-[0.3em] italic">PSM TaxiControl v4.5 Inicializando...</p>
            </div>
          </div>
        </ErrorBoundary>
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
        <ErrorBoundary>
          <Login onGoogleLogin={handleGoogleLogin} />
        </ErrorBoundary>
      </ThemeProvider>
    );
  }

  if (!userProfile) {
    return (
      <ThemeProvider>
        <ErrorBoundary>
          <ProfileSetup user={user} onComplete={setUserProfile} />
        </ErrorBoundary>
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
      <ErrorBoundary>
        <Layout 
          user={userProfile} 
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
      </ErrorBoundary>
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
