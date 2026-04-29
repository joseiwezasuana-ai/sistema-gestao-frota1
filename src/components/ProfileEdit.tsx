import React, { useState, useRef } from 'react';
import { Camera, X, Loader2, Save, User } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { cn } from '../lib/utils';

interface ProfileEditProps {
  user: any;
  isOpen: boolean;
  onClose: () => void;
  onUpdate: (updatedUser: any) => void;
}

export default function ProfileEdit({ user, isOpen, onClose, onUpdate }: ProfileEditProps) {
  const [photo, setPhoto] = useState<string | null>(user?.photoURL || null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.size > 1024 * 512) { // 512KB limit for base64 in Firestore
        alert("A imagem é muito grande. Escolha uma imagem com menos de 512KB.");
        return;
      }
      const reader = new FileReader();
      reader.onloadend = () => {
        setPhoto(reader.result as string);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleSave = async () => {
    setIsSubmitting(true);
    try {
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
        photoURL: photo,
        updatedAt: new Date().toISOString()
      });
      onUpdate({ ...user, photoURL: photo });
      onClose();
    } catch (error) {
      console.error("Error updating profile photo:", error);
      alert("Erro ao atualizar foto de perfil.");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative bg-white rounded-3xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden"
          >
            <div className="px-8 py-6 bg-[#0f172a] text-white flex items-center justify-between">
              <div>
                <h3 className="text-xl font-black uppercase italic tracking-tight">Editar Perfil</h3>
                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mt-1">Personalize a sua identidade visual</p>
              </div>
              <button onClick={onClose} className="w-10 h-10 flex items-center justify-center hover:bg-white/10 rounded-full transition-colors">
                <X size={24} />
              </button>
            </div>

            <div className="p-8 space-y-8 flex flex-col items-center">
              <div className="relative group">
                <div className="w-40 h-40 rounded-[2.5rem] overflow-hidden border-4 border-slate-100 shadow-2xl bg-slate-50 flex items-center justify-center relative">
                  {photo ? (
                    <img src={photo} alt="Profile" className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                  ) : (
                    <User size={64} className="text-slate-200" />
                  )}
                  <button 
                    onClick={() => fileInputRef.current?.click()}
                    className="absolute inset-0 bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center text-white gap-2 backdrop-blur-[2px]"
                  >
                    <Camera size={32} />
                    <span className="text-[10px] font-black uppercase tracking-widest">Alterar Foto</span>
                  </button>
                </div>
                
                {/* Status Indicator */}
                <div className="absolute -bottom-2 -right-2 w-10 h-10 bg-brand-primary rounded-2xl flex items-center justify-center border-4 border-white shadow-xl">
                   <div className="w-2.5 h-2.5 bg-white rounded-full animate-pulse" />
                </div>
              </div>

              <input 
                type="file" 
                ref={fileInputRef} 
                onChange={handleFileChange} 
                accept="image/*" 
                className="hidden" 
              />

              <div className="w-full space-y-6">
                <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 italic">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-widest mb-1">Informação de Conta</p>
                  <p className="text-sm font-black text-slate-900 truncate">{user?.name}</p>
                  <p className="text-[10px] font-bold text-brand-primary uppercase mt-1 tracking-tighter opacity-70">{user?.email}</p>
                </div>

                <div className="flex gap-4">
                  <button 
                    onClick={onClose}
                    className="flex-1 py-4 bg-white border border-slate-200 text-slate-600 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-slate-50 transition-all font-bold"
                  >
                    Cancelar
                  </button>
                  <button 
                    onClick={handleSave}
                    disabled={isSubmitting}
                    className="flex-[2] py-4 bg-brand-primary text-white rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-brand-secondary transition-all flex items-center justify-center gap-3 shadow-xl shadow-brand-primary/20 font-bold disabled:opacity-50"
                  >
                    {isSubmitting ? <Loader2 className="animate-spin" size={18} /> : (
                      <>
                        <Save size={18} /> Guardar Perfil
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>

            <div className="px-8 py-4 bg-slate-50 border-t border-slate-100 flex items-center justify-center">
              <p className="text-[8px] text-slate-400 font-black uppercase tracking-widest italic">A imagem será armazenada de forma segura na central PSM</p>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
