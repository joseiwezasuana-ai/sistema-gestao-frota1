import React from 'react';
import { 
  LayoutDashboard, 
  Truck, 
  Car,
  Map as MapIcon, 
  History as HistoryIcon, 
  Settings as SettingsIcon,
  LogOut,
  Bell,
  Search,
  MessageSquare,
  User as UserIcon,
  Camera,
  Activity,
  Smartphone,
  Wrench,
  Wallet,
  UserPlus,
  Package,
  Calculator,
  FileText,
  CarFront,
  Users,
  Calendar,
  BookOpen,
  Sun,
  Moon
} from 'lucide-react';
import { motion } from 'motion/react';
import { cn } from '../lib/utils';
import { useTheme } from '../context/ThemeContext';

interface LayoutProps {
  children: React.ReactNode;
  user: any;
  globalSettings?: any;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onLogout: () => void;
  onToggleMobile?: () => void;
  onEditProfile?: () => void;
}

export default function Layout({ children, user, globalSettings, activeTab, onTabChange, onLogout, onToggleMobile, onEditProfile }: LayoutProps) {
  const { theme, toggleTheme } = useTheme();
  const menuItems = [
    { id: 'dashboard', label: 'Painel Geral', icon: LayoutDashboard },
    { id: 'recruitment', label: 'Portal de Recrutamento', icon: UserPlus, roles: ['admin'] },
    { id: 'monitors', label: 'Monitores de Campo', icon: Activity, roles: ['admin', 'operator', 'contabilista'] },
    { id: 'revenue', label: 'Validação de Rendas', icon: Wallet, roles: ['operator'] },
    { id: 'driver_preview', label: 'Mobile App Simulator', icon: Smartphone, roles: ['admin'] },
    { id: 'fleet', label: 'Frota & Escalas 24h', icon: Truck, roles: ['admin', 'operator', 'mecanico', 'contabilista'] },
    { id: 'psm_phones', label: 'Canais de Rádio/GSM', icon: Smartphone, roles: ['admin', 'operator'] },
    { id: 'maintenance', label: 'Gestão de Oficinas', icon: Wrench, roles: ['admin', 'operator', 'mecanico', 'contabilista'] },
    { id: 'warehouse', label: 'Stocks & Logística', icon: Package, roles: ['admin', 'operator', 'mecanico'] },
    { id: 'accounting', label: 'Hub Contabilidade', icon: Calculator, roles: ['admin', 'contabilista'] },
    { id: 'messages', label: 'Hub de Comunicações', icon: MessageSquare, roles: ['admin', 'operator'] },
    { id: 'map', label: 'Geolocalização Live', icon: MapIcon, roles: ['admin', 'operator', 'mecanico'] },
    { id: 'gps_timeline', label: 'Auditoria GPS', icon: HistoryIcon, roles: ['admin', 'operator'] },
    { id: 'settings', label: 'Configurações', icon: SettingsIcon, roles: ['admin'] },
    { id: 'manual', label: 'Manual & Guia', icon: BookOpen, roles: ['admin', 'operator', 'contabilista', 'mecanico'] },
  ];

  const filteredMenuItems = menuItems.filter(item => {
    if (!item.roles) return true;
    const isMasterAdmin = user?.email?.toLowerCase() === 'joseiwezasuana@gmail.com';
    if (isMasterAdmin) return true;
    return item.roles.includes(user?.role);
  });

  return (
    <div className="flex h-screen bg-slate-100 dark:bg-slate-950 overflow-hidden font-sans">
      {/* Sidebar - 250px width */}
      <aside className="w-[250px] bg-[#0f172a] dark:bg-black text-white flex flex-col flex-shrink-0 animate-in slide-in-from-left duration-500 border-r border-white/5 relative z-20">
        <div className="p-8 pb-10 flex flex-col items-center text-center">
          <div className="relative mb-4 group cursor-pointer" onClick={() => onTabChange('dashboard')}>
            <div className="w-16 h-16 bg-white/5 rounded-[20px] flex items-center justify-center text-white shadow-xl shadow-brand-primary/10 rotate-3 group-hover:rotate-0 transition-all duration-300 border border-white/5 p-3 overflow-hidden">
               <img 
                 src="/logo.svg" 
                 alt="SUPER Taxi" 
                 className="w-full h-full object-contain" 
               />
               <span className="hidden text-3xl font-black italic text-brand-primary">PSM</span>
            </div>
            <span className="absolute -top-1 -right-1 w-3 h-3 bg-emerald-500 rounded-full border-2 border-[#0f172a] z-10" />
            <div className="absolute inset-0 bg-brand-primary blur-xl opacity-20 animate-pulse" />
          </div>
          <div>
            <h1 className="font-black text-xs tracking-[0.2em] uppercase leading-none text-white italic">
              {globalSettings?.appName || 'PS MOREIRA'}
            </h1>
            <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mt-1.5 opacity-60">COMERCIAL • MOXICO</p>
            <div className="mt-4 flex items-center justify-center gap-1.5">
               <span className="px-2 py-0.5 bg-brand-primary/10 text-brand-primary text-[8px] font-black rounded-full uppercase tracking-tighter border border-brand-primary/20">
                 VERSÃO 4.5
               </span>
            </div>
          </div>
        </div>

        <div className="h-px bg-gradient-to-r from-transparent via-white/10 to-transparent mx-6 mb-6" />

        <nav className="flex-1 space-y-1 px-4 overflow-y-auto no-scrollbar pb-6">
          {filteredMenuItems.map((item) => (
            <button
              key={item.id}
              onClick={() => onTabChange(item.id)}
              className={cn(
                "w-full flex items-center gap-3 px-4 py-3 text-[12px] transition-all rounded-xl group relative overflow-hidden",
                activeTab === item.id 
                  ? "bg-brand-primary text-white shadow-lg shadow-brand-primary/10 font-bold" 
                  : "text-slate-400 hover:text-white hover:bg-white/5 font-bold uppercase tracking-wider"
              )}
            >
              <item.icon size={16} className={cn("transition-transform group-hover:scale-110", activeTab === item.id ? "text-white" : "text-slate-500 group-hover:text-brand-primary")} />
              <span className="relative z-10">{item.label}</span>
              {activeTab === item.id && (
                <div className="absolute inset-0 bg-gradient-to-r from-white/10 to-transparent pointer-events-none" />
              )}
            </button>
          ))}
        </nav>

        <div className="p-6 bg-slate-900/50 m-4 rounded-2xl border border-white/5 backdrop-blur-md">
          <div 
            onClick={onEditProfile}
            className="flex items-center gap-4 mb-5 cursor-pointer group hover:bg-white/5 p-2 -m-2 rounded-xl transition-all"
          >
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-slate-700 to-slate-900 flex-shrink-0 flex items-center justify-center border border-white/10 shadow-xl overflow-hidden relative">
               {user?.photoURL ? (
                 <img src={user.photoURL} alt={user.name} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
               ) : (
                 <UserIcon size={20} className="text-slate-400 relative z-10" />
               )}
               <div className="absolute inset-0 bg-brand-primary opacity-0 group-hover:opacity-20 transition-opacity" />
               <div className="absolute inset-0 flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity bg-black/20">
                  <Camera size={12} className="text-white" />
               </div>
            </div>
            <div className="overflow-hidden">
              <p className="text-[11px] font-black truncate text-white uppercase tracking-tight group-hover:text-brand-primary transition-colors">{user?.name}</p>
              <div className="flex items-center gap-1.5 mt-0.5">
                 <div className="w-1.5 h-1.5 bg-brand-primary rounded-full" />
                 <p className="text-[9px] text-brand-primary uppercase font-black tracking-widest leading-none">{user?.role}</p>
              </div>
            </div>
          </div>
          <button 
            onClick={onLogout}
            className="w-full flex items-center justify-center gap-2 py-3 text-[9px] font-black text-slate-400 bg-white/5 rounded-xl hover:bg-rose-500/10 hover:text-rose-400 transition-all uppercase border border-white/5 active:scale-95"
          >
            <LogOut size={12} />
            Desconectar Sistema
          </button>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 flex flex-col min-w-0 bg-[#f8fafc] dark:bg-slate-900">
        <header className="h-20 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-white/5 px-10 flex items-center justify-between flex-shrink-0 z-10 shadow-sm relative">
          <div className="flex items-center gap-6">
            <div className="p-2.5 bg-slate-50 dark:bg-slate-800 rounded-xl border border-slate-200 dark:border-white/5">
               <Activity size={20} className="text-brand-primary animate-pulse" />
            </div>
            <div>
              <h2 className="text-[11px] font-black text-slate-400 dark:text-slate-500 uppercase tracking-[0.3em]">Módulo Ativo</h2>
              <h3 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tighter flex items-center gap-2 mt-0.5">
                {menuItems.find(i => i.id === activeTab)?.label || 'Centro de Operações'}
                <span className="w-1 h-1 bg-slate-300 dark:bg-slate-700 rounded-full" />
                <span className="text-[10px] text-brand-primary italic opacity-70">Live Monitor</span>
              </h3>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <button 
              onClick={toggleTheme}
              className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 rounded-xl border border-slate-200 dark:border-white/5 hover:bg-white dark:hover:bg-slate-700 transition-all shadow-sm active:scale-95"
              title={theme === 'light' ? 'Ativar Modo Escuro' : 'Ativar Modo Claro'}
            >
               {theme === 'light' ? <Moon size={18} /> : <Sun size={18} className="text-amber-400" />}
            </button>

            <button 
              onClick={onToggleMobile}
              className="group flex items-center gap-2 px-4 py-2 bg-slate-900 border border-slate-800 rounded-xl hover:bg-black transition-all shadow-lg active:scale-95"
            >
              <Smartphone size={16} className="text-brand-primary group-hover:scale-110 transition-transform" />
              <span className="text-[10px] font-black text-white uppercase tracking-widest italic group-hover:text-brand-primary transition-colors">Smartphone View</span>
            </button>

            <div className="flex items-center gap-2 px-3 py-1.5 bg-slate-50 rounded-full border border-slate-200">
               <div className="w-1.5 h-1.5 bg-green-500 rounded-full animate-pulse" />
               <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Sync Live</span>
            </div>
            
            <div className="h-4 w-px bg-slate-200" />

            <button className="relative text-slate-400 hover:text-brand-primary transition-all p-2 hover:bg-slate-50 rounded-lg">
              <Bell size={18} />
              <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-red-500 rounded-full border-2 border-white" />
            </button>
          </div>
        </header>

        <section className="flex-1 overflow-y-auto bg-slate-50/50 dark:bg-slate-950/50">
          <div className="p-8">
            <motion.div
              key={activeTab}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
            >
              {children}
            </motion.div>
          </div>
        </section>
      </main>
    </div>
  );
}
