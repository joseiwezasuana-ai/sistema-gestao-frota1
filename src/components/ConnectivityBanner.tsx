import React, { useState, useEffect } from 'react';
import { Wifi, WifiOff, CloudUpload, CheckCircle2 } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';

export const ConnectivityBanner: React.FC = () => {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [showStatus, setShowStatus] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setShowStatus(true);
      setTimeout(() => setShowStatus(false), 3000);
    };
    const handleOffline = () => {
      setIsOnline(false);
      setShowStatus(true);
    };

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  return (
    <AnimatePresence>
      {(showStatus || !isOnline) && (
        <motion.div
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -50, opacity: 0 }}
          className={`fixed top-0 left-0 right-0 z-[9999] flex items-center justify-center py-2 px-4 shadow-lg transition-colors ${
            isOnline ? 'bg-emerald-600' : 'bg-amber-600'
          }`}
        >
          <div className="flex items-center gap-2 text-white">
            {isOnline ? (
              <>
                <Wifi size={16} />
                <span className="text-xs font-bold uppercase tracking-wider">Ligado Online - Sincronizando Dados</span>
                <CheckCircle2 size={14} className="ml-2 animate-pulse" />
              </>
            ) : (
              <>
                <WifiOff size={16} />
                <span className="text-xs font-bold uppercase tracking-wider">Modo Offline Ativo - Dados Salvos Localmente</span>
                <CloudUpload size={14} className="ml-2 animate-bounce" />
              </>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
