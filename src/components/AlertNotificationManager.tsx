import React, { useState, useEffect, useCallback } from 'react';
import { 
  AlertTriangle, 
  PhoneMissed, 
  Zap, 
  Bell, 
  X, 
  Gauge,
  ShieldAlert,
  AlertOctagon,
  Phone,
  Activity,
  Trash2
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { collection, onSnapshot, query, orderBy, limit, Timestamp, where, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { format } from 'date-fns';

interface Alert {
  id: string;
  type: 'speeding' | 'missed_call' | 'security' | 'geo_fence' | 'panic';
  title: string;
  message: string;
  timestamp: Date;
  severity: 'critical' | 'warning' | 'info';
  metadata?: any;
}

export default function AlertNotificationManager() {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [permission, setPermission] = useState<NotificationPermission>('default');
  const [showPermissionBanner, setShowPermissionBanner] = useState(false);

  // Request browser notification permission
  const requestPermission = useCallback(async () => {
    const result = await Notification.requestPermission();
    setPermission(result);
    setShowPermissionBanner(false);
  }, []);

  useEffect(() => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      setPermission(Notification.permission);
      if (Notification.permission === 'default') {
        setShowPermissionBanner(true);
      }
    }

    // 1. Monitor Missed & Stuck Calls
    const unsubCalls = onSnapshot(query(collection(db, 'calls'), where('status', '==', 'pending')), (snapshot) => {
      snapshot.docs.forEach((doc) => {
        const call = doc.data();
        const ts = call.timestamp?.toDate ? call.timestamp.toDate() : new Date(call.timestamp);
        const diff = (new Date().getTime() - ts.getTime()) / (1000 * 60);
        
        if (diff > 5) {
          triggerAlert({
            id: `missed-stale-${doc.id}`,
            type: 'missed_call',
            title: 'Chamada Abandonada',
            message: `Cliente ${call.customerName || 'N/A'} está à espera há mais de 5 min!`,
            severity: 'critical',
            timestamp: new Date()
          });
        }
      });
    }, (error) => handleFirestoreError(error, OperationType.GET, 'calls'));

    // 2. Monitor Fleet for Speeding
    const unsubSpeed = onSnapshot(collection(db, 'drivers'), (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
        const vehicle = change.doc.data();
        if (vehicle.speed > 85) {
            const alertId = `speed-${change.doc.id}`;
            
            // Avoid spam: Check if we already logged this vehicle recently (10 min cooldown)
            // We use a simple local timestamp map for this session
            const lastAlert = (window as any)._lastSpeedAlerts?.[change.doc.id];
            const now = Date.now();
            
            if (!lastAlert || (now - lastAlert) > 600000) { // 10 minutes
              if (!(window as any)._lastSpeedAlerts) (window as any)._lastSpeedAlerts = {};
              (window as any)._lastSpeedAlerts[change.doc.id] = now;

              // 1. Log to permanent violations history
              try {
                await addDoc(collection(db, 'speed_violations'), {
                  driverId: change.doc.id,
                  driverName: vehicle.name || 'Desconhecido',
                  prefix: vehicle.prefix,
                  speed: vehicle.speed,
                  timestamp: serverTimestamp(),
                  lat: vehicle.lat || null,
                  lng: vehicle.lng || null,
                  status: 'unresolved'
                });
              } catch (e) {
                console.error("Erro ao registar infração:", e);
              }

              // 2. Trigger UI Notification
              triggerAlert({
                  id: `${alertId}-${now}`,
                  type: 'speeding',
                  title: 'Excesso de Velocidade',
                  message: `Viatura ${vehicle.prefix} detectada a ${vehicle.speed}km/h em Luena!`,
                  severity: 'critical',
                  timestamp: new Date(),
                  metadata: { prefix: vehicle.prefix, speed: vehicle.speed }
              });

              // 3. Play alert sound
              try {
                const audio = new Audio('https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3');
                audio.volume = 0.4;
                audio.play();
              } catch (err) {}
            }
        }
      });
    }, (error) => handleFirestoreError(error, OperationType.GET, 'drivers'));

    // 3. Monitor Panic Alerts (S.O.S)
    const qPanic = query(collection(db, 'panic_alerts'), orderBy('timestamp', 'desc'), limit(5));
    const unsubPanic = onSnapshot(qPanic, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const panic = change.doc.data();
          if (panic.status === 'active') {
            // Play a priority alert sound (using simple browser beep)
            try {
              const audioCtx = new (window.AudioContext || (window as any).webkitAudioContext)();
              const oscillator = audioCtx.createOscillator();
              const gainNode = audioCtx.createGain();
              oscillator.connect(gainNode);
              gainNode.connect(audioCtx.destination);
              oscillator.type = 'square';
              oscillator.frequency.setValueAtTime(440, audioCtx.currentTime);
              gainNode.gain.setValueAtTime(0.1, audioCtx.currentTime);
              oscillator.start();
              oscillator.stop(audioCtx.currentTime + 0.5);
            } catch (e) {}

            triggerAlert({
              id: `panic-${change.doc.id}`,
              type: 'panic',
              title: 'S.O.S - EMERGÊNCIA CRÍTICA',
              message: `O MOTORISTA ${panic.driverName?.toUpperCase()} ACACIONOU O BOTÃO DE PÂNICO EM LUENA!`,
              severity: 'critical',
              timestamp: new Date(),
              metadata: panic
            });
          }
        }
      });
    }, (error) => handleFirestoreError(error, OperationType.GET, 'panic_alerts'));

    return () => {
      unsubCalls();
      unsubSpeed();
      unsubPanic();
    };
  }, []);

  const triggerAlert = (alert: Alert) => {
    // Avoid spam: only show if not already recently alerted (state-based check)
    setAlerts(prev => {
      const exists = prev.find(a => a.id === alert.id);
      if (exists) return prev;
      
      // Browser notification
      if (Notification.permission === 'granted') {
          new Notification(alert.title, {
            body: alert.message,
          });
      }

      // Auto-dismiss after 15 seconds (longer for critical)
      const duration = alert.type === 'panic' ? 30000 : 15000;
      setTimeout(() => {
        removeAlert(alert.id);
      }, duration);

      return [alert, ...prev].slice(0, 5); // Keep last 5
    });
  };

  const removeAlert = (id: string) => {
    setAlerts(prev => prev.filter(a => a.id !== id));
  };

  const clearAllAlerts = () => {
    setAlerts([]);
  };

  return (
    <>
      {/* Visual Alerts Overlay */}
      <div className="fixed top-6 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-4 w-full max-w-md pointer-events-none px-4">
        <AnimatePresence>
          {alerts.length > 1 && (
            <motion.button
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.8 }}
              onClick={clearAllAlerts}
              className="pointer-events-auto mx-auto mb-2 bg-slate-900 shadow-2xl shadow-black/40 text-white px-6 py-2.5 rounded-full text-[10px] font-black uppercase tracking-widest flex items-center gap-3 border border-white/20 active:scale-95 transition-all group"
            >
              <Trash2 size={14} className="text-brand-primary group-hover:scale-110 transition-transform" />
              Esvaziar Balde de Alertas ({alerts.length})
            </motion.button>
          )}

          {showPermissionBanner && (
            <motion.div
              initial={{ y: -100, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: -100, opacity: 0 }}
              className="bg-brand-primary text-white p-4 rounded-xl shadow-2xl border border-white/20 pointer-events-auto flex items-center justify-between gap-4"
            >
              <div className="flex items-center gap-3">
                <Bell className="animate-bounce" size={20} />
                <p className="text-xs font-bold leading-tight uppercase tracking-tight">Active notificações push para não perder alertas críticos</p>
              </div>
              <button 
                onClick={requestPermission}
                className="bg-white text-brand-primary px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-widest hover:bg-slate-100 transition-all"
              >
                Ativar
              </button>
            </motion.div>
          )}

          {alerts.map((alert) => (
            <motion.div
              key={alert.id}
              initial={{ scale: 0.8, y: -50, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.8, y: -20, opacity: 0 }}
              className="pointer-events-auto group relative"
            >
              <div className={`
                relative overflow-hidden rounded-2xl border-2 shadow-[0_20px_50px_rgba(0,0,0,0.3)]
                ${alert.severity === 'critical' ? 'bg-red-600 border-red-500' : 'bg-amber-500 border-amber-400'}
              `}>
                {/* Visual Accent */}
                <div className="absolute top-0 right-0 p-8 opacity-10 rotate-12 bg-white rounded-full -mr-10 -mt-10" />
                
                <div className="px-6 py-5 flex items-start gap-5 relative z-10">
                  <div className="p-3 bg-white/20 rounded-xl backdrop-blur-md shadow-inner">
                    {alert.type === 'speeding' && <Activity size={24} className="text-white animate-pulse" />}
                    {alert.type === 'missed_call' && <Phone size={24} className="text-white animate-bounce" />}
                    {alert.type === 'panic' && <ShieldAlert size={24} className="text-white animate-[ping_1.5s_infinite]" />}
                  </div>
                  
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-black uppercase tracking-[0.2em] text-white/70">Alerta Crítico</span>
                      <div className="w-1 h-1 rounded-full bg-white animate-ping" />
                    </div>
                    <h4 className="text-lg font-black text-white leading-none mb-1 uppercase italic tracking-tighter">{alert.title}</h4>
                    <p className="text-sm text-white/90 font-bold leading-tight">{alert.message}</p>
                  </div>

                  <button 
                    onClick={() => removeAlert(alert.id)}
                    className="p-1.5 hover:bg-white/10 rounded-lg transition-all text-white/50 hover:text-white"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Progress bar for auto-dismiss */}
                <motion.div 
                  initial={{ width: '100%' }}
                  animate={{ width: '0%' }}
                  transition={{ duration: alert.type === 'panic' ? 30 : 15, ease: 'linear' }}
                  className="h-1 bg-white/30 absolute bottom-0 left-0"
                />
              </div>
            </motion.div>
          ))}
        </AnimatePresence>
      </div>
    </>
  );
}
