import React, { useState, useEffect, useRef } from 'react';
import { useTheme } from '../context/ThemeContext';
import { 
  Car, MapPin, Phone, User, Camera, Sun, Moon, Sparkles, ShieldCheck, 
  MapPinCheck, Navigation, PhoneCall, PhoneOff, Check, X, CheckCircle, 
  Trash2, Landmark, Trophy, Smartphone, AlertCircle, RefreshCw, Lock
} from 'lucide-react';
import { db } from '../lib/firebase';
import { addDoc, collection, getDocs, onSnapshot, query, where, doc, setDoc, getDoc } from 'firebase/firestore';

interface VehicleOption {
  id: string;
  plate: string;
  driverName: string;
  phone: string;
  model: string;
  driverId?: string;
}

// 4 custom preset themes for the Passenger Smart App to fulfill "alterar temas de sua preferência"
type PassengerTheme = 'gold' | 'blue' | 'cyberpunk' | 'emerald';

interface PresetTheme {
  name: string;
  bgClass: string;
  cardClass: string;
  textClass: string;
  btnClass: string;
  accentColor: string;
  borderClass: string;
}

const PALETTES: Record<PassengerTheme, PresetTheme> = {
  gold: {
    name: 'Pôr-do-Sol Dourado (SUPER Táxi)',
    bgClass: 'bg-slate-950 text-white',
    cardClass: 'bg-slate-900 border border-amber-500/20',
    textClass: 'text-amber-400',
    btnClass: 'bg-amber-500 hover:bg-amber-600 text-slate-950',
    accentColor: '#f59e0b',
    borderClass: 'border-amber-500'
  },
  blue: {
    name: 'Brisa Oceânica (Corporativo)',
    bgClass: 'bg-[#0f172a] text-white',
    cardClass: 'bg-slate-900 border border-blue-500/20',
    textClass: 'text-blue-400',
    btnClass: 'bg-blue-600 hover:bg-blue-700 text-white',
    accentColor: '#3b82f6',
    borderClass: 'border-blue-500'
  },
  cyberpunk: {
    name: 'Cyber Neon (Tecnologia Moxico)',
    bgClass: 'bg-neutral-950 text-white',
    cardClass: 'bg-neutral-900 border border-fuchsia-500/20',
    textClass: 'text-fuchsia-400',
    btnClass: 'bg-fuchsia-600 hover:bg-fuchsia-700 text-white shadow-lg shadow-fuchsia-600/25',
    accentColor: '#d946ef',
    borderClass: 'border-fuchsia-500'
  },
  emerald: {
    name: 'Esmeralda Clássica (Prestigio)',
    bgClass: 'bg-zinc-950 text-white',
    cardClass: 'bg-zinc-900 border border-emerald-500/20',
    textClass: 'text-emerald-400',
    btnClass: 'bg-[#10b981] hover:bg-emerald-600 text-slate-950 font-extrabold',
    accentColor: '#10b981',
    borderClass: 'border-[#10b981]'
  }
};

const PRESETS_AVATARS = [
  "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&auto=format&fit=crop&q=80",
  "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&auto=format&fit=crop&q=80"
];

export default function PassengerFlow({ isPublicApp = false }: { isPublicApp?: boolean }) {
  const [activePalette, setActivePalette] = useState<PassengerTheme>(() => {
    return (localStorage.getItem('psm-passenger-theme') as PassengerTheme) || 'gold';
  });

  const currentTheme = PALETTES[activePalette];

  const handlePaletteChange = (pal: PassengerTheme) => {
    setActivePalette(pal);
    localStorage.setItem('psm-passenger-theme', pal);
  };

  // Passenger Logged-in State
  const [passengerProfile, setPassengerProfile] = useState<any>(() => {
    try {
      const saved = localStorage.getItem('psm-passenger-profile');
      return saved ? JSON.parse(saved) : null;
    } catch {
      return null;
    }
  });

  // Form Inputs
  const [name, setName] = useState('');
  const [age, setAge] = useState('');
  const [backupPhone, setBackupPhone] = useState('');
  const [province, setProvince] = useState('Luena, Moxico');
  const [password, setPassword] = useState('');
  const [selectedAvatar, setSelectedAvatar] = useState(PRESETS_AVATARS[0]);
  const [isUploading, setIsUploading] = useState(false);
  const [authMode, setAuthMode] = useState<'login' | 'register'>('register');
  const [loginName, setLoginName] = useState('');
  const [loginPassword, setLoginPassword] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);

  // Active Booking state
  const [isBookModalOpen, setIsBookModalOpen] = useState(false);
  const [isForwardModalOpen, setIsForwardModalOpen] = useState(false);
  
  // New States requested by José Iweza Suana (JIS)
  const [showRidesHistoryModal, setShowRidesHistoryModal] = useState(false);
  const [showProfilePicModal, setShowProfilePicModal] = useState(false);
  const [showComplaintsModal, setShowComplaintsModal] = useState(false);
  
  // Custom states for complaint submission
  const [complaintType, setComplaintType] = useState('excesso_velocidade');
  const [complaintText, setComplaintText] = useState('');
  const [complaintVehicle, setComplaintVehicle] = useState('');
  const [isSubmittingComplaint, setIsSubmittingComplaint] = useState(false);
  const [complaintSuccessMsg, setComplaintSuccessMsg] = useState('');

  const [pickup, setPickup] = useState('');
  const [destination, setDestination] = useState('');
  const [selectedVehicleId, setSelectedVehicleId] = useState('');
  const [availableVehicles, setAvailableVehicles] = useState<VehicleOption[]>([]);
  const [isLoadingFleet, setIsLoadingFleet] = useState(false);

  // Call Sequence states
  // 'idle' | 'calling' | 'connected' | 'pricing' | 'offer_received' | 'ride_confirmed' | 'ride_completed'
  const [callState, setCallState] = useState<'idle' | 'calling' | 'connected' | 'pricing' | 'offer_received' | 'ride_confirmed' | 'ride_completed'>('idle');
  const [negotiatedPrice, setNegotiatedPrice] = useState<number>(0);
  const [secondsElapsed, setSecondsElapsed] = useState(0);
  const [activeRideRecord, setActiveRideRecord] = useState<any | null>(null);
  const [isRestoringCall, setIsRestoringCall] = useState(true);
  const activeStatusRef = useRef<string | null>(null);

  // Stats / Confirmed Rides History
  const [myRides, setMyRides] = useState<any[]>([]);
  const [passengerTab, setPassengerTab] = useState<'viagem' | 'seguranca' | 'perfil'>('viagem');

  // Fetch Vehicles & Drivers to Book
  const loadFleetData = async () => {
    setIsLoadingFleet(true);
    try {
      const activeDriversSnap = await getDocs(collection(db, 'drivers'));
      const activeDriversList: VehicleOption[] = [];
      const activeStatuses = ['available', 'ativo', 'disponível', 'disponivel', 'busy', 'ocupado', 'em serviço', 'em curso'];
      
      activeDriversSnap.forEach(docSnap => {
        const data = docSnap.data();
        const status = (data.status || '').toLowerCase().trim();
        if (activeStatuses.includes(status) || data.isOnline === true || data.online === true) {
          activeDriversList.push({
            id: docSnap.id,
            plate: data.plate || 'LD-92-33-PX',
            driverName: data.name,
            phone: data.phone || data.secondaryPhone || '+244 923 456 789',
            model: data.vehicleModel || `Viatura ${data.prefix || ''}`,
            driverId: data.driverId || ''
          });
        }
      });

      setAvailableVehicles(activeDriversList);
      if (activeDriversList.length > 0) {
        setSelectedVehicleId(activeDriversList[0].id);
      } else {
        setSelectedVehicleId('');
      }
    } catch (e) {
      console.error(e);
    } finally {
      setIsLoadingFleet(false);
    }
  };

  const generateToken = () => Math.floor(1000 + Math.random() * 9000).toString();

  useEffect(() => {
    loadFleetData();
  }, []);

  // Load saved active call on mount to prevent state drop upon unmounting / tab switching
  useEffect(() => {
    const savedCallId = localStorage.getItem('active_call_id');
    if (savedCallId) {
      const fetchSavedCall = async () => {
        try {
          const docSnap = await getDoc(doc(db, 'calls', savedCallId));
          if (docSnap.exists()) {
            const data = docSnap.data();
            // Only restore if the call is not ended
            if (!['completed', 'cancelled', 'rejected', 'ignored'].includes(data.status)) {
               console.log("Restoring active call from localStorage:", savedCallId, data);
               activeStatusRef.current = data.status;
               setActiveRideRecord({ id: docSnap.id, ...data });
              // Set correct status immediately to prevent any blank visual overlay
              if (data.status === 'pending' || data.status === 'calling') {
                setCallState('calling');
              } else if (data.status === 'connected') {
                setCallState('connected');
              } else if (data.status === 'pricing') {
                setCallState('pricing');
              } else if (data.status === 'price_sent') {
                setCallState('offer_received');
                if (data.price) setNegotiatedPrice(data.price);
              } else if (data.status === 'confirmed' || data.status === 'active') {
                setCallState('ride_confirmed');
                if (data.price) setNegotiatedPrice(data.price);
              }
            } else {
              localStorage.removeItem('active_call_id');
            }
          } else {
            localStorage.removeItem('active_call_id');
          }
        } catch (err) {
          console.error("Error restoring call:", err);
        } finally {
          setIsRestoringCall(false);
        }
      };
      fetchSavedCall();
    } else {
      setIsRestoringCall(false);
    }
  }, []);

  // Sync active_call_id in localStorage when activeRideRecord id changes (guarded by isRestoringCall)
  useEffect(() => {
    if (isRestoringCall) return;

    if (activeRideRecord?.id) {
      localStorage.setItem('active_call_id', activeRideRecord.id);
    } else {
      localStorage.removeItem('active_call_id');
    }
  }, [activeRideRecord?.id, isRestoringCall]);

  // Sync rides in real time
  useEffect(() => {
    if (!passengerProfile?.name) return;
    const qRides = query(
      collection(db, 'calls'), 
      where('passengerName', '==', passengerProfile.name)
    );
    const unsub = onSnapshot(qRides, (snap) => {
      const list = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      list.sort((a: any, b: any) => {
        const tA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt).getTime();
        const tB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt).getTime();
        return tB - tA;
      });
      setMyRides(list);
    });
    return () => unsub();
  }, [passengerProfile]);

  // Synchronize activeRideRecord in real-time from Firestore if set
  useEffect(() => {
    if (!activeRideRecord?.id) return;

    const docId = activeRideRecord.id;
    const docRef = doc(db, 'calls', docId);

    const handleSync = (docSnap: any) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        
        // Update ref IMMEDIATELY so any running asynchronous timer ticks see it instantly!
        activeStatusRef.current = data.status;

        // Sync attributes safely with fallback to prevent setting to null prematurely
        setActiveRideRecord((prev: any) => {
          if (!prev) return { id: docSnap.id, ...data };
          return { ...prev, ...data };
        });
        
        // Let's change callState based on Firestore status
        console.log("Passenger Flow - Sync active ride. Status:", data.status, "Price:", data.price, "Doc ID:", docSnap.id);
        if (data.status === 'pending' || data.status === 'calling') {
          // Guard simulated states: do not cycle back to 'calling' if local simulation has progressed
          setCallState(prev => (prev === 'idle' ? 'calling' : prev));
        } else if (data.status === 'connected') {
          setCallState('connected');
        } else if (data.status === 'pricing') {
          setCallState('pricing');
        } else if (data.status === 'price_sent') {
          // Update price even if it's 0 to reflect the state accurately
          setNegotiatedPrice(data.price || 0); 
          setCallState('offer_received');
        } else if (data.status === 'confirmed' || data.status === 'active') {
          if (data.price !== undefined && data.price !== null) setNegotiatedPrice(data.price);
          setCallState('ride_confirmed');
        } else if (data.status === 'completed') {
          setCallState('idle');
          setActiveRideRecord(null);
        } else if (data.status === 'cancelled' || data.status === 'rejected' || data.status === 'ignored') {
          setCallState('idle');
          setActiveRideRecord(null);
        }
      }
    };

    // 1) Real-time Stream Subscriber (Highly robust native channel)
    const unsubscribe = onSnapshot(docRef, (docSnap) => {
      handleSync(docSnap);
    }, (error) => {
      console.warn("Real-time stream error in PassengerFlow:", error);
    });

    return () => {
      unsubscribe();
    };
  }, [activeRideRecord?.id]);

  // Keep activeStatusRef always holding the absolute latest status
  useEffect(() => {
    activeStatusRef.current = activeRideRecord?.status || null;
  }, [activeRideRecord?.status]);

    // Self-correcting alignment for callState to prevent any simulator race conditions
    useEffect(() => {
      if (!activeRideRecord) return;
      const dbStatus = activeRideRecord.status;
      if (dbStatus === 'pending' || dbStatus === 'calling') {
        // Guard simulated states: do not cycle back to 'calling' if local simulation has progressed
        setCallState(prev => (prev === 'idle' ? 'calling' : prev));
      } else if (dbStatus === 'connected') {
        setCallState('connected');
      } else if (dbStatus === 'pricing') {
        setCallState('pricing');
      } else if (dbStatus === 'price_sent') {
      // Update price even if it's 0
      setNegotiatedPrice(activeRideRecord.price !== undefined && activeRideRecord.price !== null ? activeRideRecord.price : 0);
      setCallState('offer_received');
    } else if (dbStatus === 'confirmed' || dbStatus === 'active') {
      if (activeRideRecord.price !== undefined && activeRideRecord.price !== null) setNegotiatedPrice(activeRideRecord.price);
      setCallState('ride_confirmed');
    } else if (dbStatus === 'completed' || dbStatus === 'cancelled' || dbStatus === 'rejected' || dbStatus === 'ignored') {
      setCallState('idle');
      setActiveRideRecord(null);
    }
  }, [activeRideRecord?.status, activeRideRecord?.price]);

  // Ticker for seconds elapsed
  useEffect(() => {
    let interval: any;
    if (callState === 'calling' || callState === 'connected' || callState === 'pricing') {
      interval = setInterval(() => {
        setSecondsElapsed(prev => prev + 1);
      }, 1000);
    } else {
      setSecondsElapsed(0);
    }
    return () => clearInterval(interval);
  }, [callState]);

  // Handle Call countdown simulator transitions
  useEffect(() => {
    // If the database status is already non-pending (e.g. accepted/answered by driver), abort simulated state progression
    if (activeStatusRef.current && activeStatusRef.current !== 'pending') {
      return;
    }
    
    if (callState === 'calling' && secondsElapsed >= 3) {
      setCallState('connected');
    } else if (callState === 'connected' && secondsElapsed >= 7) {
      setCallState('pricing');
    }
  }, [secondsElapsed, callState]);

  const handleCreateProfile = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !age.trim() || !password.trim()) {
      alert("Por favor, preencha todos os campos obrigatórios.");
      return;
    }
    if (Number(age) < 18) {
      alert("Apenas passageiros maiores de 18 anos são elegíveis.");
      return;
    }

    const newProfile = {
      name,
      age: Number(age),
      backupPhone,
      province,
      password,
      photoUrl: selectedAvatar,
      createdAt: new Date().toISOString()
    };

    localStorage.setItem('psm-passenger-profile', JSON.stringify(newProfile));
    setPassengerProfile(newProfile);

    // Save to Firestore passengers collection for persistence across devices/logins
    try {
      await addDoc(collection(db, 'passengers'), newProfile);
    } catch (e) {
      console.error("Erro ao persistir passageiro no Firestore:", e);
    }

    alert(`Perfil de ${name} criado com sucesso no ecossistema SUPER Taxi!`);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!loginName.trim() || !loginPassword.trim()) {
      alert("Por favor, preencha as suas credenciais.");
      return;
    }

    setIsLoggingIn(true);
    try {
      const q = query(
        collection(db, 'passengers'),
        where('name', '==', loginName.trim()),
        where('password', '==', loginPassword.trim())
      );
      const querySnapshot = await getDocs(q);
      
      let profile: any = null;
      if (!querySnapshot.empty) {
        const userData = querySnapshot.docs[0].data();
        profile = { id: querySnapshot.docs[0].id, ...userData };
      } else {
        // Fallback for case-insensitive and auto-space matching
        const allPassengersSnap = await getDocs(collection(db, 'passengers'));
        const normalizedInputName = loginName.trim().toLowerCase();
        const normalizedInputPass = loginPassword.trim();
        
        allPassengersSnap.forEach((docSnap) => {
          const data = docSnap.data();
          if (data.name && data.password) {
            const savedName = String(data.name).trim().toLowerCase();
            const savedPass = String(data.password).trim();
            if (savedName === normalizedInputName && savedPass === normalizedInputPass) {
              profile = { id: docSnap.id, ...data };
            }
          }
        });
      }

      if (profile) {
        localStorage.setItem('psm-passenger-profile', JSON.stringify(profile));
        setPassengerProfile(profile);
        alert(`Bem-vindo de volta, ${profile.name}!`);
      } else {
        alert("Credenciais inválidas. Verifique o seu nome e palavra-passe.");
      }
    } catch (e) {
      console.error("Erro ao fazer login:", e);
      alert("Ocorreu um erro ao aceder ao servidor.");
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogout = () => {
    if (window.confirm("Deseja sair da sua conta de Passageiro?")) {
      localStorage.removeItem('psm-passenger-profile');
      setPassengerProfile(null);
      setCallState('idle');
    }
  };

  // Initiate call / request price
  const handleInitiateCall = async () => {
    if (!pickup.trim() || !destination.trim() || !selectedVehicleId) {
      alert("Indique o ponto de recolha, destino e viatura desejada.");
      return;
    }

    const selectedVehicle = availableVehicles.find(v => v.id === selectedVehicleId);
    console.log("[PassengerFlow] Initiating call. Available vehicles:", availableVehicles, "Selected ID:", selectedVehicleId, "Selected:", selectedVehicle);

    if (!selectedVehicle) {
      alert("Nenhuma viatura disponível selecionada. Por favor, tente novamente ou verifique se há motoristas ativos em Luena.");
      return;
    }

    setCallState('calling');
    setIsBookModalOpen(false);
    setNegotiatedPrice(0); // Reset the price offer state for a clean new start

    // Write preliminary ride to Firestore
    try {
      const boardingToken = generateToken();
      const docRef = await addDoc(collection(db, 'calls'), {
        passengerId: passengerProfile ? passengerProfile.name.toLowerCase().replace(/\s/g, '') : 'anon',
        passengerName: passengerProfile ? passengerProfile.name : 'Passageiro de Teste',
        passengerPhone: passengerProfile?.backupPhone || passengerProfile?.phone || '+244 9XX XXX XXX',
        passengerAge: passengerProfile?.age || 'N/A',
        passengerProvince: passengerProfile ? passengerProfile.province : 'Luena, Moxico',
        pickup,
        destination,
        customerName: passengerProfile ? passengerProfile.name : 'Passageiro de Teste',
        customerPhone: passengerProfile?.backupPhone || passengerProfile?.phone || '+244 9XX XXX XXX',
        pickupAddress: pickup,
        destinationAddress: destination,
        vehiclePlate: selectedVehicle.plate,
        driverName: selectedVehicle.driverName,
        driverPhone: selectedVehicle.phone,
        vehicleModel: selectedVehicle.model,
        driverId: selectedVehicle.driverId || selectedVehicle.id,
        price: null,
        status: 'pending',
        boardingToken,
        createdAt: new Date().toISOString(),
        timestamp: new Date().toISOString()
      });

      activeStatusRef.current = 'pending';
      setActiveRideRecord({ 
        id: docRef.id, 
        ...selectedVehicle, 
        status: 'pending', // Explicitly initialize as 'pending' to resolve state conflicts with driver statuses
        price: null,
        pickup, 
        destination, 
        boardingToken,
        customerName: passengerProfile ? passengerProfile.name : 'Passageiro de Teste',
        customerPhone: passengerProfile?.backupPhone || passengerProfile?.phone || '+244 9XX XXX XXX',
        pickupAddress: pickup,
        destinationAddress: destination
      });
    } catch (e) {
      console.error("Erro firestore ao criar corrida:", e);
    }
  };

  // Motorista answers, sets a price and sends back to custom passenger UI
  const handleDriverSendPrice = async (priceInput: number) => {
    if (priceInput <= 0) {
      alert("Indique um preço válido.");
      return;
    }
    setNegotiatedPrice(priceInput);
    activeStatusRef.current = 'price_sent';

    if (activeRideRecord?.id) {
      try {
        const rideRef = doc(db, 'calls', activeRideRecord.id);
        await setDoc(rideRef, { 
          price: priceInput, 
          status: 'price_sent' 
        }, { merge: true });
      } catch (err) {
        console.error(err);
      }
    }
    setCallState('offer_received');
  };

  // Passenger confirms proposed price
  const handlePassengerConfirmRide = async () => {
    if (!activeRideRecord?.id) return;

    try {
      activeStatusRef.current = 'confirmed';
      const rideRef = doc(db, 'calls', activeRideRecord.id);
      await setDoc(rideRef, { 
        status: 'confirmed' 
      }, { merge: true });

      // Save to driver's daily records inside driver_scales as well 
      // or associate with general drivers_master total earnings.
      // Additionally, we persist confirmed ride amounts in localstorage to display in DriverView Rendas if needed.
      const currentDriverSavedRides = localStorage.getItem(`rides_driver_${activeRideRecord.driverName}`) || '[]';
      const driverRides = JSON.parse(currentDriverSavedRides);
      driverRides.push({
        id: activeRideRecord.id,
        price: negotiatedPrice,
        pickup: activeRideRecord.pickup,
        destination: activeRideRecord.destination,
        createdAt: new Date().toISOString()
      });
      localStorage.setItem(`rides_driver_${activeRideRecord.driverName}`, JSON.stringify(driverRides));

      alert("Corrida confirmada! O motorista iniciou viagem.");
      setCallState('ride_confirmed');
    } catch (err) {
      console.error(err);
    }
  };

  // Passenger cancels the proposed ride
  const handlePassengerCancelRide = async () => {
    if (!activeRideRecord?.id) return;
    try {
      activeStatusRef.current = 'cancelled';
      const rideRef = doc(db, 'calls', activeRideRecord.id);
      await setDoc(rideRef, { status: 'cancelled' }, { merge: true });
      setCallState('idle');
      setActiveRideRecord(null);
    } catch (err) {
      console.error(err);
    }
  };

  // Simulated Driver actions: Ends ride after success
  const handleFinishRideSuccess = async () => {
    if (!activeRideRecord?.id) return;
    try {
      activeStatusRef.current = 'completed';
      const rideRef = doc(db, 'calls', activeRideRecord.id);
      await setDoc(rideRef, { status: 'completed' }, { merge: true });
      setCallState('idle');
      setActiveRideRecord(null);
      alert("Excelente! A corrida foi concluída com sucesso e a renda foi carregada na central.");
    } catch (err) {
      console.error(err);
    }
  };

  const handleForwardCall = async () => {
    setIsForwardModalOpen(true);
    loadFleetData();
  };

  const handleConfirmForward = async (colleagueId: string) => {
    if (!activeRideRecord?.id) return;
    const selectedColleague = availableVehicles.find(v => v.id === colleagueId);
    if (!selectedColleague) return;

    try {
      const rideRef = doc(db, 'calls', activeRideRecord.id);
      await setDoc(rideRef, { 
        status: 'calling', 
        forwarded: true,
        vehiclePlate: selectedColleague.plate,
        driverName: selectedColleague.driverName,
        driverPhone: selectedColleague.phone,
        vehicleModel: selectedColleague.model
      }, { merge: true });
      
      setCallState('calling');
      setActiveRideRecord((prev: any) => ({
        ...prev,
        forwarded: true,
        vehiclePlate: selectedColleague.plate,
        driverName: selectedColleague.driverName,
        phone: selectedColleague.phone, // Update contact number
        model: selectedColleague.model
      }));
      setIsForwardModalOpen(false);
      alert(`Chamada reencaminhada para ${selectedColleague.driverName}`);
    } catch (err) {
      console.error(err);
    }
  };

  // Helper formatting seconds
  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60).toString().padStart(2, '0');
    const s = (sec % 60).toString().padStart(2, '0');
    return `${m}:${s}`;
  };

  const handleAvatarFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      setIsUploading(true);
      const reader = new FileReader();
      reader.onload = (event) => {
        if (event.target?.result) {
          setSelectedAvatar(event.target.result as string);
        }
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    }
  };

  return (
    <div className={isPublicApp 
      ? `w-full min-h-screen ${currentTheme.bgClass} flex flex-col transition-colors duration-300` 
      : `p-4 lg:p-10 max-w-7xl mx-auto min-h-[calc(100vh-80px)] bg-slate-100 dark:bg-slate-900 grid grid-cols-1 ${!isPublicApp ? 'lg:grid-cols-2' : ''} gap-10 items-start`
    }>
      
      {/* Exclusivo Painel de Controle e Feedback da Simulação */}
      {!isPublicApp && (
      <div className="space-y-6">
        <div className="bg-white dark:bg-slate-950 p-6 rounded-3xl border border-slate-200 dark:border-white/5 shadow-xl space-y-4">
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl bg-orange-500/10 text-orange-500`}>
              <Sparkles size={18} />
            </div>
            <div>
              <h2 className="text-sm font-black text-slate-900 dark:text-white uppercase tracking-tighter">
                Controlador da Simulação (JIS)
              </h2>
              <p className="text-[9px] text-slate-400 font-extrabold uppercase tracking-widest mt-0.5">
                Área de Testes & Audioria do Fluxo de Passageiros
              </p>
            </div>
          </div>

          <div className="bg-slate-50 dark:bg-slate-900 p-4 rounded-2xl border border-slate-100 dark:border-white/5 space-y-3">
            <p className="text-[10px] text-slate-500 dark:text-slate-400 font-bold leading-relaxed">
              José Iweza Suana (**JIS**), esta ferramenta simula a experiência completa de um Passageiro utilizando telemóvel para encomendar viagens com telefonema directo ao motorista no Luena.
            </p>

          </div>

          {/* Interactive Driver Response Pane inside Controller during calls */}
          {(callState === 'calling' || callState === 'connected' || callState === 'pricing' || callState === 'offer_received' || callState === 'ride_confirmed') && activeRideRecord && (
            <div className="border border-amber-500/30 bg-amber-500/5 p-5 rounded-2xl space-y-4 animate-pulse">
              <div className="flex items-center justify-between">
                <span className="px-2 py-0.5 bg-amber-500 text-slate-950 font-black text-[9px] rounded uppercase tracking-wider">
                  PAINEL DE ATENDIMENTO DO MOTORISTA
                </span>
                <span className="text-[10px] font-mono text-amber-500 font-bold">
                  Sinal Live Estável
                </span>
              </div>

              <div className="text-xs space-y-2">
                <div className="flex justify-between border-b border-amber-500/15 pb-1">
                  <span className="text-slate-500 uppercase font-black text-[9px]">Motorista Alocado:</span>
                  <span className="text-slate-800 dark:text-slate-200 font-bold">{activeRideRecord.driverName}</span>
                </div>
                <div className="flex justify-between border-b border-amber-500/15 pb-1">
                  <span className="text-slate-500 uppercase font-black text-[9px]">Telefone da Viatura:</span>
                  <span className="text-slate-800 dark:text-slate-200 font-mono font-bold">{activeRideRecord.phone}</span>
                </div>
                <div className="flex justify-between border-b border-amber-500/15 pb-1">
                  <span className="text-slate-500 uppercase font-black text-[9px]">Ponto de Partida:</span>
                  <span className="text-slate-900 dark:text-white font-black truncate max-w-[200px]">{activeRideRecord.pickup}</span>
                </div>
                <div className="flex justify-between border-b border-amber-500/15 pb-1">
                  <span className="text-slate-500 uppercase font-black text-[9px]">Destino Final:</span>
                  <span className="text-slate-900 dark:text-white font-black truncate max-w-[200px]">{activeRideRecord.destination}</span>
                </div>
                {activeRideRecord.boardingToken && (
                  <div className="flex justify-between bg-emerald-500/10 p-2 rounded border border-emerald-500/20">
                    <span className="text-emerald-500 uppercase font-black text-[9px]">Token p/ Validar:</span>
                    <span className="text-emerald-400 font-mono font-black text-xs">{activeRideRecord.boardingToken}</span>
                  </div>
                )}
              </div>

              {/* Action according to call state */}
              {callState === 'calling' && (
                <div className="flex flex-col items-center py-4 bg-amber-500/10 rounded-xl">
                  <RefreshCw className="animate-spin text-amber-500 mb-2" size={20} />
                  <p className="text-[10px] uppercase font-black text-amber-500 tracking-wider">Telemóvel do Motorista a tocar...</p>
                </div>
              )}

              {(callState === 'connected' || callState === 'pricing') && (
                <div className="bg-slate-900/90 p-4 rounded-xl border border-white/5 space-y-3">
                  <p className="text-[10px] text-amber-400 font-black uppercase tracking-wider">
                    Telefonema Estabelecido! Diga o Preço:
                  </p>
                  <div className="flex gap-2">
                    <input 
                      type="number" 
                      placeholder="Preço em Kwanza, ex: 3500" 
                      id="sim-price-input"
                      className="flex-1 bg-black text-white p-2 text-xs border border-white/10 rounded-lg font-black"
                      defaultValue={3000}
                    />
                    <button 
                      onClick={() => {
                        const val = Number((document.getElementById('sim-price-input') as HTMLInputElement)?.value || 3000);
                        handleDriverSendPrice(val);
                      }}
                      className="px-4 py-2 bg-[#10b981] text-slate-950 font-black text-xs uppercase tracking-wider rounded-lg hover:bg-emerald-600"
                    >
                      Enviar Preço
                    </button>
                  </div>
                  <p className="text-[8.5px] text-slate-400">
                    O motorista também pode reencaminhar chamadas se não puder realizar a corrida.
                  </p>
                </div>
              )}

              {callState === 'offer_received' && (
                <div className="bg-blue-500/10 p-4 rounded-xl border border-blue-500/30 text-center space-y-2">
                  <div className="w-2 h-2 bg-blue-500 rounded-full animate-ping mx-auto" />
                  <p className="text-xs font-black text-blue-400 uppercase tracking-wide">Proposta de Preço Recebida</p>
                  <p className="text-[10px] text-slate-300">
                    O motorista propôs o valor de <strong className="text-white font-black">{(negotiatedPrice || Number(activeRideRecord?.price || 0)).toLocaleString()} Kz</strong>. Por favor, confirme ou cancele a corrida no painel principal acima!
                  </p>
                </div>
              )}

              {callState === 'ride_confirmed' && (
                <div className="bg-[#10b981]/15 p-4 rounded-xl border border-emerald-500/30 text-center space-y-2">
                  <CheckCircle className="text-emerald-500 mx-auto" size={24} />
                  <p className="text-xs font-black text-emerald-400 uppercase tracking-wide">Corrida em Andamento</p>
                  <p className="text-[9.5px] text-slate-400">Quando a viagem terminar com sucesso, clique abaixo para finalizar de forma segura.</p>
                  <div className="flex flex-col gap-2">
                    <button 
                      onClick={handleFinishRideSuccess}
                      className="w-full py-2 bg-[#10b981] hover:bg-[#059669] transition-colors text-slate-950 font-black text-[10px] uppercase tracking-widest rounded-lg flex items-center justify-center gap-2"
                    >
                      <CheckCircle size={14} /> Encerrar Viagem c/ Sucesso & Carregar Renda
                    </button>
                    <button 
                      onClick={handleForwardCall}
                      className="w-full py-2 bg-slate-900 border border-slate-700 text-slate-300 hover:bg-slate-800 transition-colors font-black text-[10px] uppercase tracking-widest rounded-lg flex items-center justify-center gap-2"
                    >
                      <Navigation size={14} /> Reencaminhar Chamada
                    </button>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* Real-time Global Passenger Log */}
          <div className="space-y-2">
            <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider">Historial Recente de Pedidos (Global)</span>
            {myRides.length === 0 ? (
              <div className="p-4 bg-slate-50 dark:bg-slate-900 rounded-2xl border border-slate-100 dark:border-white/5 text-center text-[10px] text-slate-400 uppercase">
                Sem registos de viagens nesta sessão.
              </div>
            ) : (
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1 no-scrollbar">
                {myRides.map((it) => (
                  <div key={it.id} className="p-3 bg-slate-50 dark:bg-zinc-900 border border-slate-200/50 dark:border-white/5 rounded-xl flex items-center justify-between gap-2">
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-[10px] font-black text-slate-800 dark:text-slate-100 uppercase truncate">{it.passengerName}</span>
                        <span className="text-[8px] font-bold text-slate-400">• {it.vehiclePlate}</span>
                      </div>
                      <p className="text-[9px] text-slate-400 truncate mt-0.5">{it.pickup} → {it.destination}</p>
                    </div>
                    <div className="text-right flex flex-col items-end shrink-0">
                      <span className="text-[10px] font-black">{it.price ? `${it.price.toLocaleString()} Kz` : 'A negociar'}</span>
                      <span className={`text-[8px] font-black uppercase tracking-widest ${
                        it.status === 'completed' ? 'text-emerald-500' : 
                        it.status === 'confirmed' ? 'text-blue-500 animate-pulse' : 
                        it.status === 'cancelled' ? 'text-red-500' : 'text-amber-500'
                      }`}>{it.status === 'completed' ? 'Concluída' : it.status === 'confirmed' ? 'Confirmada' : it.status === 'cancelled' ? 'Cancelada' : 'A chamar'}</span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      )}

      {/* SMARTPHONE VIEW SIMULATOR FRAME */}
      <div className={isPublicApp ? "w-full min-h-screen flex flex-col" : "flex justify-center h-[800px]"}>
        {/* INTERFACE LIVRE E REAL */}
        <div className={isPublicApp 
          ? `w-full flex-1 flex flex-col ${currentTheme.bgClass} transition-colors duration-300 relative` 
          : `w-full rounded-3xl overflow-hidden relative flex flex-col shadow-2xl ${currentTheme.bgClass} transition-colors duration-300`
        }>
          
          {/* Passenger App Interactive Header */}
          <header className="p-4 border-b border-white/5 flex items-center justify-between bg-black/20 shrink-0">
              <div className="flex items-center gap-2">
                <div className={`p-1.5 rounded-lg ${currentTheme.cardClass}`}>
                  <Car size={14} className={currentTheme.textClass} />
                </div>
                <div>
                  <h1 className="text-xs font-black uppercase tracking-tighter italic">SUPER TAXI Pass</h1>
                  <p className="text-[7.5px] text-slate-500 font-extrabold uppercase tracking-widest">Acesso Passageiro</p>
                </div>
              </div>

              {/* Theme Selector Popover / Floating Button */}
              <div className="flex items-center gap-1">
                {(Object.keys(PALETTES) as PassengerTheme[]).map((pal) => (
                  <button
                    key={pal}
                    onClick={() => handlePaletteChange(pal)}
                    className={`w-4 h-4 rounded-full border border-white/40`}
                    style={{ backgroundColor: PALETTES[pal].accentColor }}
                    title={PALETTES[pal].name}
                  />
                ))}
              </div>
            </header>

            {/* SCREEN SCROLLABLE AREA */}
            <div className={`flex-1 overflow-y-auto no-scrollbar relative ${isPublicApp ? 'p-6 sm:p-10 max-w-2xl mx-auto w-full' : 'p-5'}`}>
              
              {!passengerProfile ? (
                /* PROFILE CREATION OR PORTAL (REGISTER / LOGIN Toggle) */
                <div className="space-y-4 py-2">
                  <div className="text-center space-y-1">
                    <span className="text-[9px] font-black text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/20 uppercase tracking-widest italic">PRESTÍGIO MÁXIMO</span>
                    <h2 className="text-lg font-black tracking-tight mt-1">
                      {authMode === 'register' ? 'CRIAR CONTA PASSAGEIRO' : 'ENTRAR NA CONTA'}
                    </h2>
                    <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Luena - Moxico • Angola</p>
                  </div>

                  <div className="flex bg-white/5 p-1 rounded-xl border border-white/10 mb-2">
                    <button 
                      onClick={() => setAuthMode('register')}
                      className={`flex-1 py-2 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all ${authMode === 'register' ? currentTheme.btnClass : 'text-slate-400 hover:text-white'}`}
                    >
                      Criar Conta
                    </button>
                    <button 
                      onClick={() => setAuthMode('login')}
                      className={`flex-1 py-2 text-[9px] font-black uppercase tracking-wider rounded-lg transition-all ${authMode === 'login' ? currentTheme.btnClass : 'text-slate-400 hover:text-white'}`}
                    >
                      Entrar
                    </button>
                  </div>

                  {authMode === 'register' ? (
                    <form onSubmit={handleCreateProfile} className="space-y-3">
                      {/* Selectable Avatars */}
                      <div className="space-y-1.5 text-center">
                        <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">Foto de Perfil</label>
                        <div className="flex justify-center gap-3">
                          {PRESETS_AVATARS.map((av, idx) => (
                            <div 
                              key={idx}
                              onClick={() => setSelectedAvatar(av)}
                              className={`w-11 h-11 rounded-full overflow-hidden border-2 cursor-pointer transition-all ${selectedAvatar === av ? currentTheme.borderClass + ' scale-110 shadow-lg' : 'border-transparent opacity-60'}`}
                            >
                              <img src={av} alt="Avatar" className="w-full h-full object-cover" />
                            </div>
                          ))}
                        </div>

                        {/* Custom Upload Button */}
                        <div className="mt-2">
                          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[9px] font-black uppercase tracking-wider cursor-pointer transition-colors">
                            <Camera size={10} className={currentTheme.textClass} />
                            {isUploading ? 'A Carregar...' : 'Enviar Foto'}
                            <input type="file" accept="image/*" onChange={handleAvatarFileChange} className="hidden" />
                          </label>
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[8.5px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome de Passageiro</label>
                        <div className="relative">
                          <User size={12} className="absolute left-3.5 top-3.5 text-slate-500" />
                          <input 
                            type="text" 
                            placeholder="Nome Completo" 
                            value={name}
                            onChange={e => setName(e.target.value)}
                            className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs font-bold outline-none focus:border-white text-white"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <label className="text-[8.5px] font-black text-slate-500 uppercase tracking-widest ml-1">Idade</label>
                          <input 
                            type="number" 
                            placeholder="Ex: 24" 
                            value={age}
                            onChange={e => setAge(e.target.value)}
                            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs font-bold outline-none focus:border-white text-white"
                          />
                        </div>
                        <div className="space-y-1">
                          <label className="text-[8.5px] font-black text-slate-500 uppercase tracking-widest ml-1">Província Atual</label>
                          <input 
                            type="text" 
                            placeholder="Moxico" 
                            value={province}
                            onChange={e => setProvince(e.target.value)}
                            className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs font-bold outline-none focus:border-white text-white"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[8.5px] font-black text-slate-500 uppercase tracking-widest ml-1">Contacto de Backup (Se Offline)</label>
                        <div className="relative">
                          <Phone size={12} className="absolute left-3.5 top-3.5 text-slate-500" />
                          <input 
                            type="text" 
                            placeholder="+244 9XX XXX XXX" 
                            value={backupPhone}
                            onChange={e => {
                              let val = e.target.value;
                              if (!val.startsWith('+244')) val = '+244 ' + val.replace('+244', '').trim();
                              setBackupPhone(val);
                            }}
                            className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs font-bold outline-none focus:border-white text-white"
                          />
                        </div>
                        <p className="text-[8px] text-slate-400 mt-1 font-extrabold uppercase tracking-tight">
                          * Usado se o telemóvel principal estiver offline.
                        </p>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[8.5px] font-black text-slate-500 uppercase tracking-widest ml-1">Palavra-passe</label>
                        <input 
                          type="password" 
                          placeholder="••••••••" 
                          value={password}
                          onChange={e => setPassword(e.target.value)}
                          className="w-full px-4 py-2.5 bg-white/5 border border-white/10 rounded-xl text-xs font-bold outline-none focus:border-white text-white"
                        />
                      </div>

                      <button 
                        type="submit"
                        className={`w-full py-3.5 rounded-xl font-black text-xs uppercase tracking-widest transition-all ${currentTheme.btnClass}`}
                      >
                        Registar e Entrar
                      </button>
                    </form>
                  ) : (
                    <form onSubmit={handleLogin} className="space-y-4 pt-4">
                      <div className="space-y-1">
                        <label className="text-[8.5px] font-black text-slate-500 uppercase tracking-widest ml-1">Nome de Utilizador</label>
                        <div className="relative">
                          <User size={12} className="absolute left-3.5 top-3.5 text-slate-500" />
                          <input 
                            type="text" 
                            placeholder="O seu nome registado" 
                            value={loginName}
                            onChange={e => setLoginName(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-xs font-bold outline-none focus:border-white text-white"
                          />
                        </div>
                      </div>

                      <div className="space-y-1">
                        <label className="text-[8.5px] font-black text-slate-500 uppercase tracking-widest ml-1">Palavra-passe</label>
                        <div className="relative">
                          <Lock size={12} className="absolute left-3.5 top-3.5 text-slate-500" />
                          <input 
                            type="password" 
                            placeholder="••••••••" 
                            value={loginPassword}
                            onChange={e => setLoginPassword(e.target.value)}
                            className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-xs font-bold outline-none focus:border-white text-white"
                          />
                        </div>
                      </div>

                      <button 
                        type="submit"
                        disabled={isLoggingIn}
                        className={`w-full py-4 rounded-xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2 ${currentTheme.btnClass} ${isLoggingIn ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {isLoggingIn ? <RefreshCw className="animate-spin" size={14} /> : 'Aceder à Minha Conta'}
                      </button>
                    </form>
                  )}
                </div>
              ) : (
                /* IN-APP LOGGED-IN PASSENGER HOME VIEW */
                <div className="space-y-4">
                  
                  {/* Miniature Header Card Welcome */}
                  <div className={`p-4 rounded-2xl ${currentTheme.cardClass} flex items-center justify-between`}>
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-xl overflow-hidden border border-white/20">
                        <img src={passengerProfile.photoUrl || selectedAvatar} alt="Photo" className="w-full h-full object-cover" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1">
                          <p className="text-xs font-black uppercase tracking-tight truncate max-w-[120px]">{passengerProfile.name}</p>
                          <ShieldCheck size={11} className={currentTheme.textClass} />
                        </div>
                        <p className="text-[8.5px] text-slate-400 font-bold uppercase tracking-widest">{passengerProfile.province} • {passengerProfile.backupPhone || 'Sem Backup'}</p>
                      </div>
                    </div>

                    <button 
                      onClick={handleLogout}
                      className="text-[8px] font-black uppercase text-rose-400 hover:text-rose-500 bg-rose-500/10 px-2 py-1 rounded"
                    >
                      Sair
                    </button>
                  </div>

                  {/* Sub-Tabs Selector para Organização de Elevado Nível de Informação (Solicitado por JIS) */}
                  <div className="grid grid-cols-3 bg-slate-950 p-1 rounded-xl border border-white/5 gap-1">
                    <button
                      onClick={() => setPassengerTab('viagem')}
                      className={`py-2 px-1 text-[9.5px] font-black uppercase tracking-tight rounded-lg flex items-center justify-center gap-1 transition-all ${
                        passengerTab === 'viagem'
                          ? 'bg-amber-500 text-slate-950 font-black shadow-md'
                          : 'text-slate-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <Car size={13} />
                      Pedir Táxi
                    </button>
                    
                    <button
                      onClick={() => setPassengerTab('seguranca')}
                      className={`py-2 px-1 text-[9.5px] font-black uppercase tracking-tight rounded-lg flex items-center justify-center gap-1 transition-all ${
                        passengerTab === 'seguranca'
                          ? 'bg-rose-500 text-white font-black shadow-md'
                          : 'text-slate-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <ShieldCheck size={13} />
                      Segurança
                    </button>

                    <button
                      onClick={() => setPassengerTab('perfil')}
                      className={`py-2 px-1 text-[9.5px] font-black uppercase tracking-tight rounded-lg flex items-center justify-center gap-1 transition-all ${
                        passengerTab === 'perfil'
                          ? 'bg-[#3b82f6] text-white font-black shadow-md'
                          : 'text-slate-400 hover:text-white hover:bg-white/5'
                      }`}
                    >
                      <User size={13} />
                      Minha Conta
                    </button>
                  </div>

                  {/* ABA 1: VIAGEM / PEDIDOS */}
                  {passengerTab === 'viagem' && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                      
                      {/* Active Background Ride / Call Alert Banner to Resume */}
                      {activeRideRecord && !['completed', 'cancelled', 'rejected', 'ignored'].includes(activeRideRecord.status) && (
                        <div className="bg-amber-500/10 border border-amber-500/35 p-4 rounded-2xl flex items-center justify-between gap-3 animate-pulse">
                          <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-amber-500 rounded-xl text-slate-950 shrink-0">
                              <PhoneCall size={16} />
                            </div>
                            <div className="text-left min-w-0">
                              <p className="text-[10px] font-black uppercase text-amber-500 tracking-wider">Corrida c/ {activeRideRecord.driverName}</p>
                              <p className="text-[11px] font-black text-white leading-tight truncate">
                                {activeRideRecord.status === 'price_sent' ? 'Preço Proposto Enviado!' : 
                                 activeRideRecord.status === 'confirmed' || activeRideRecord.status === 'active' ? 'Viagem Confirmada!' : 'A Negociar / Chamar...'}
                              </p>
                              {activeRideRecord.status === 'price_sent' && (
                                <p className="text-[10px] text-[#10b981] font-black mt-0.5 animate-bounce">
                                  Preço: {(negotiatedPrice || Number(activeRideRecord.price || 0)).toLocaleString()} Kz
                                </p>
                              )}
                            </div>
                          </div>
                          
                          <button
                            onClick={() => {
                              // Dynamically map status to callState structure
                              const nextState = activeRideRecord.status === 'price_sent' ? 'offer_received' :
                                               activeRideRecord.status === 'confirmed' || activeRideRecord.status === 'active' ? 'ride_confirmed' :
                                               activeRideRecord.status === 'pricing' ? 'pricing' :
                                               activeRideRecord.status === 'connected' ? 'connected' : 'calling';
                              setCallState(nextState);
                            }}
                            className="px-3.5 py-2 bg-amber-500 hover:bg-amber-600 transition-colors text-slate-950 font-black text-[9.5px] uppercase tracking-wider rounded-lg shrink-0"
                          >
                            Retomar
                          </button>
                        </div>
                      )}

                      {/* Faux GPS Map Background */}
                      <div className="h-44 rounded-2xl bg-slate-900 border border-white/5 relative overflow-hidden flex flex-col justify-end p-3">
                        {/* SVG Map grid line design */}
                        <div className="absolute inset-0 opacity-20 pointer-events-none">
                          <svg width="100%" height="100%">
                            <defs>
                              <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                                <path d="M 20 0 L 0 0 0 20" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-blue-500" />
                              </pattern>
                            </defs>
                            <rect width="100%" height="100%" fill="url(#grid)" />
                          </svg>
                        </div>

                        {/* Simulated Path Line */}
                        <svg className="absolute inset-0 w-full h-full text-brand-primary pointer-events-none opacity-45" viewBox="0 0 300 200">
                          <path d="M 50,150 Q 150,50 250,120" fill="none" stroke="currentColor" strokeWidth="4" strokeLinecap="round" strokeDasharray="6" />
                          <circle cx="50" cy="150" r="6" className="text-amber-500" fill="currentColor" />
                          <circle cx="250" cy="120" r="6" className="text-emerald-500" fill="currentColor" />
                        </svg>

                        <div className="absolute top-3 left-3 bg-black/75 backdrop-blur px-2 py-1 rounded border border-white/10 text-[8px] font-black text-rose-400 uppercase tracking-widest flex items-center gap-1 animate-pulse">
                          <div className="w-1.5 h-1.5 bg-rose-500 rounded-full" />
                          Monitorização Satélite Ativa
                        </div>

                        <div className="bg-slate-950/80 backdrop-blur p-2.5 rounded-xl border border-white/10 text-center">
                          <p className="text-[9px] font-black text-slate-300 uppercase tracking-wider">Destino Preferido</p>
                          <p className="text-[11px] font-black text-white uppercase italic tracking-tight">{pickup ? `${pickup} → ${destination}` : 'Luena Central'}</p>
                        </div>
                      </div>

                      {/* Main Call Taxi Trigger Element */}
                      <button 
                        onClick={() => {
                          setIsBookModalOpen(true);
                          loadFleetData();
                        }}
                        className={`w-full py-4 rounded-2xl font-black text-sm uppercase tracking-widest transition-all duration-300 transform active:scale-95 flex items-center justify-center gap-2 ${currentTheme.btnClass}`}
                      >
                        <Car size={16} />
                        Pedir Super Táxi
                      </button>

                      {/* TOKEN DE EMBARQUE dinâmico (Segurança TAXICONTROL) */}
                      {callState === 'ride_confirmed' && activeRideRecord?.boardingToken && (
                        <div className="bg-emerald-500/10 border border-emerald-500/30 p-5 rounded-2xl space-y-2 text-center shadow-lg shadow-emerald-500/5">
                          <div className="flex items-center justify-center gap-2">
                            <div className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                            <span className="text-[10px] font-black text-emerald-500 uppercase tracking-widest">Validar Viagem com Motorista</span>
                          </div>
                          <div className="text-4xl font-black text-white tracking-[0.2em] font-mono py-1 drop-shadow-lg">
                            {activeRideRecord.boardingToken}
                          </div>
                          <p className="text-[9px] text-slate-400 font-bold uppercase tracking-tight italic">
                            Mostre este código ao motorista para a viagem ser validada em Luena.
                          </p>
                        </div>
                      )}
                    </div>
                  )}

                  {/* ABA 2: SEGURANÇA E SUPORTE */}
                  {passengerTab === 'seguranca' && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                      {/* RECOMENDAÇÃO DE SEGURANÇA TAXICONTROL - CENTRAL DE PROTEÇÃO */}
                      <div className="bg-slate-900 border border-white/5 rounded-2xl overflow-hidden shadow-xl">
                        <div className={`p-3 flex items-center gap-2 ${currentTheme.cardClass} border-none`}>
                           <ShieldCheck size={14} className={currentTheme.textClass} />
                           <span className="text-[10px] font-black uppercase tracking-widest">Proteção Central TAXICONTROL</span>
                        </div>
                        <div className="p-4 space-y-4">
                          <div className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-blue-500/10 flex items-center justify-center shrink-0">
                              <Smartphone size={14} className="text-blue-500" />
                            </div>
                            <div className="space-y-0.5">
                              <p className="text-[10px] font-black text-white uppercase tracking-tight">Contacto de Reenvio</p>
                              <p className="text-[9px] text-slate-400 leading-relaxed font-bold">
                                Se ficar sem internet (offline), a nossa central ligará para: <span className="text-white">{passengerProfile.backupPhone || 'Número não definido'}</span>.
                              </p>
                            </div>
                          </div>

                          <div className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-amber-500/10 flex items-center justify-center shrink-0">
                              <RefreshCw size={14} className="text-amber-500" />
                            </div>
                            <div className="space-y-0.5">
                              <p className="text-[10px] font-black text-white uppercase tracking-tight">Chamada Reencaminhada</p>
                              <p className="text-[9px] text-slate-400 leading-relaxed font-bold">
                                As chamadas motorista-colega são auditadas. Se o seu motorista delegar a viagem, receberá um alerta imediato.
                              </p>
                            </div>
                          </div>

                          <div className="flex gap-3">
                            <div className="w-8 h-8 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                              <Lock size={14} className="text-emerald-500" />
                            </div>
                            <div className="space-y-0.5">
                              <p className="text-[10px] font-black text-white uppercase tracking-tight">Token de Segurança</p>
                              <p className="text-[9px] text-slate-400 leading-relaxed font-bold">
                                O token de embarque garante que entra na viatura PSM correta. Nunca partilhe o seu PIN de acesso.
                              </p>
                            </div>
                          </div>
                        </div>
                      </div>

                      <button
                        onClick={() => setShowComplaintsModal(true)}
                        className={`w-full p-4 bg-slate-900 border border-white/5 hover:border-rose-500/35 hover:bg-slate-800/80 rounded-2xl flex items-center justify-between text-left transition-all group`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-rose-500/10 flex items-center justify-center text-rose-500 shrink-0 group-hover:scale-110 transition-transform">
                            <AlertCircle size={16} />
                          </div>
                          <div>
                            <p className="text-xs font-black uppercase tracking-tight text-white m-0">Reclamações & Outros...</p>
                            <p className="text-[8.5px] text-slate-400 font-bold m-0 uppercase tracking-widest">Denunciar conduta ou obter ajuda</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-black text-rose-500 opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all">➔</span>
                      </button>
                    </div>
                  )}

                  {/* ABA 3: PERFIL E AJUSTES */}
                  {passengerTab === 'perfil' && (
                    <div className="space-y-4 animate-in fade-in duration-300">
                      
                      {/* TROCAR FOTO DE PERFIL BUTTON */}
                      <button
                        onClick={() => setShowProfilePicModal(true)}
                        className={`w-full p-4 bg-slate-900 border border-white/5 hover:border-blue-500/35 hover:bg-slate-800/80 rounded-2xl flex items-center justify-between text-left transition-all group`}
                      >
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-xl bg-blue-500/10 flex items-center justify-center text-blue-400 shrink-0 group-hover:scale-110 transition-transform">
                            <Camera size={16} />
                          </div>
                          <div>
                            <p className="text-xs font-black uppercase tracking-tight text-white m-0">Trocar Foto de Perfil</p>
                            <p className="text-[8.5px] text-slate-400 font-bold m-0 uppercase tracking-widest">Alterar ou enviar nova foto</p>
                          </div>
                        </div>
                        <span className="text-[10px] font-black text-blue-400 opacity-60 group-hover:opacity-100 group-hover:translate-x-1 transition-all">➔</span>
                      </button>

                      {/* MINI LISTA DE CORRIDAS RECENTES INTEGRADA DIRETAMENTE NA ABA DO PERFIL */}
                      <div className="p-4 bg-slate-900 border border-white/5 rounded-2xl space-y-3">
                        <div className="flex items-center gap-2 border-b border-white/5 pb-2">
                          <Trophy size={14} className="text-amber-500" />
                          <h4 className="text-[10px] font-black uppercase tracking-widest text-white">Minhas Corridas Recentes</h4>
                        </div>

                        {myRides.length === 0 ? (
                          <div className="p-4 text-center bg-slate-950/65 rounded-xl border border-white/5 space-y-1">
                            <Car size={24} className="mx-auto text-slate-600 animate-pulse" />
                            <p className="text-[8.5px] text-slate-500 uppercase font-black">Nenhuma corrida registada</p>
                          </div>
                        ) : (
                          <div className="space-y-2 max-h-48 overflow-y-auto no-scrollbar">
                            {myRides.map((rd: any) => (
                              <div key={rd.id} className="p-2.5 bg-slate-950 rounded-xl border border-white/5 flex items-center justify-between text-xs">
                                <div className="space-y-0.5">
                                  <p className="font-extrabold text-white text-[10px]">{rd.pickup} ➔ {rd.destination}</p>
                                  <p className="text-[8px] text-slate-400 font-bold uppercase">Motorista: {rd.driverName || 'Não Alocado'}</p>
                                </div>
                                <div className="text-right shrink-0">
                                  <span className="text-[10px] font-black text-amber-500 block">
                                    {rd.price ? `${Number(rd.price).toLocaleString()} Kz` : 'A negociar'}
                                  </span>
                                  <span className={`text-[7.5px] font-black px-1.5 py-0.5 rounded border uppercase ${
                                    rd.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                                  }`}>{rd.status === 'completed' ? 'Sucesso' : 'Aguardando'}</span>
                                </div>
                              </div>
                            ))}
                          </div>
                        )}
                      </div>

                    </div>
                  )}

                </div>
              )}

            </div>

            {/* Simulated Phone Call Interface Overlay Popup inside smartphone */}
            {callState !== 'idle' && (
              <div className="absolute inset-0 bg-slate-950/95 z-50 p-6 flex flex-col justify-between animate-fade-in text-white text-center">
                
                {/* Float Minimize Button to go back to menus but keep connection active in background */}
                <button 
                  onClick={() => setCallState('idle')}
                  className="absolute top-4 right-4 p-2 bg-white/10 hover:bg-white/20 transition-colors rounded-full text-slate-300 z-50 hover:scale-105 active:scale-95"
                  title="Minimizar Chamada (Guarda em Background)"
                >
                  <X size={16} />
                </button>

                {/* Header Call state */}
                <div className="pt-10 space-y-2">
                  <div className="w-16 h-16 bg-white/5 rounded-full mx-auto flex items-center justify-center border border-white/10 relative">
                    <Phone className="text-amber-500 animate-pulse" size={28} />
                    <div className="absolute inset-0 border-2 border-amber-500/40 rounded-full animate-ping" />
                  </div>
                  
                  <h3 className="text-sm font-black uppercase tracking-widest text-slate-300">
                    {callState === 'calling' ? (activeRideRecord?.forwarded ? 'Reencaminhando Chamada...' : 'A Chamar Motorista...') : 
                     callState === 'connected' ? 'Em Chamada...' : 
                     callState === 'pricing' ? 'Motorista a Escrever Preço...' : 
                     callState === 'offer_received' ? 'Preço Proposto!' : 
                     callState === 'ride_confirmed' ? 'Confirmado! A Caminho' : 'Chamada Concluída!'}
                  </h3>

                  {activeRideRecord?.forwarded && (
                    <div className="bg-amber-500/20 border border-amber-500/40 px-2 py-1 rounded inline-block">
                      <p className="text-[8px] font-black uppercase text-amber-500 tracking-tighter">Chamada Reencaminhada pela Central</p>
                    </div>
                  )}

                  <p className="text-[9px] text-slate-400 font-mono tracking-widest uppercase">
                    Tempo: {formatTime(secondsElapsed)}
                  </p>
                </div>

                {/* Call details */}
                <div className="p-5 bg-white/5 rounded-2xl border border-white/5 space-y-3 mx-4">
                  <p className="text-[9px] text-slate-400 uppercase tracking-wider leading-none">Viatura Solicitada:</p>
                  <p className="text-xs font-black uppercase tracking-tight text-white leading-tight">
                    {activeRideRecord?.model}
                  </p>
                  <p className="text-sm font-black tracking-tight text-brand-primary">
                    {activeRideRecord?.plate}
                  </p>

                  <div className="h-px bg-white/15 my-2" />

                  <p className="text-[9px] text-slate-400 uppercase tracking-wider leading-none">Motorista Associado:</p>
                  <p className="text-xs font-black uppercase text-white leading-none">
                    {activeRideRecord?.driverName}
                  </p>
                  
                  {callState === 'offer_received' && (negotiatedPrice > 0 || (activeRideRecord?.price && Number(activeRideRecord.price) > 0)) && (
                    <div className="mt-4 p-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl space-y-1">
                      <p className="text-[8.5px] uppercase font-bold text-slate-400 tracking-widest leading-none">Preço Oferecido pelo Motorista:</p>
                      <h4 className="text-xl font-black text-emerald-400 tracking-tighter animate-pulse">
                        {(negotiatedPrice || Number(activeRideRecord?.price || 0)).toLocaleString()} Kz
                      </h4>
                    </div>
                  )}
                </div>

                {/* Call Controls and Actions */}
                <div className="pb-8 flex flex-col items-center gap-4">
                  {callState === 'offer_received' ? (
                    <div className="w-full space-y-3 px-4">
                      <p className="text-[8.5px] text-slate-400 uppercase">Deseja confirmar ou rejeitar esta corrida?</p>
                      <div className="flex gap-3">
                        <button 
                          onClick={handlePassengerConfirmRide}
                          className="flex-1 py-3 bg-[#10b981] hover:bg-emerald-600 text-slate-950 font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-500/20"
                        >
                          Confirmar
                        </button>
                        <button 
                          onClick={handlePassengerCancelRide}
                          className="flex-1 py-3 bg-rose-600 hover:bg-rose-700 text-white font-black text-xs uppercase tracking-wider rounded-xl"
                        >
                          Cancelar
                        </button>
                      </div>
                    </div>
                  ) : callState === 'ride_confirmed' ? (
                    <div className="w-full space-y-3 px-4">
                      <p className="text-[9px] text-emerald-400 uppercase font-black tracking-wide">Pedido Ativado & Monitorizado</p>
                      <button 
                        onClick={() => setCallState('idle')}
                        className="w-full py-3 bg-white/10 hover:bg-white/15 text-white font-black text-xs uppercase tracking-wider rounded-xl border border-white/10"
                      >
                        Voltar ao Menu
                      </button>
                    </div>
                  ) : (
                    /* General Terminate Trigger always accessible */
                    <button 
                      onClick={async () => {
                        if (activeRideRecord?.id) {
                          try {
                            const rideRef = doc(db, 'calls', activeRideRecord.id);
                            await setDoc(rideRef, { status: 'cancelled' }, { merge: true });
                          } catch (err) {
                            console.error("Erro ao cancelar chamada no Firestore:", err);
                          }
                        }
                        setCallState('idle');
                        setActiveRideRecord(null);
                      }}
                      className="w-14 h-14 bg-rose-600 hover:bg-rose-700 rounded-full flex items-center justify-center text-white active:scale-90 transition-transform shadow-xl hover:bg-rose-550"
                    >
                      <PhoneOff size={22} />
                    </button>
                  )}
                </div>

              </div>
            )}

            {/* Smart Booking modal inside Phone frame */}
            {isBookModalOpen && (
              <div className="absolute inset-0 bg-black/75 z-40 flex flex-col justify-end">
                <div className="bg-slate-900 border-t border-white/10 rounded-t-[24px] p-6 space-y-4 animate-slide-up text-white max-h-[85%] overflow-y-auto no-scrollbar">
                  <div className="flex items-center justify-between border-b border-white/5 pb-3">
                    <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                      <Car size={14} className={currentTheme.textClass} />
                      Pedir Super Táxi
                    </h3>
                    <button 
                      onClick={() => setIsBookModalOpen(false)}
                      className="p-1 hover:bg-white/10 rounded text-slate-400"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="space-y-3 text-xs">
                    <div className="space-y-1">
                      <label className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest">Ponto de Recolha</label>
                      <input 
                        className="w-full p-2.5 bg-white/5 border border-white/10 rounded-xl outline-none text-white focus:border-white font-bold" 
                        placeholder="Ex: Aeroporto do Luena" 
                        value={pickup}
                        onChange={e => setPickup(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest">Destino Final</label>
                      <input 
                        className="w-full p-2.5 bg-white/5 border border-white/10 rounded-xl outline-none text-white focus:border-white font-bold" 
                        placeholder="Ex: Mercado Central Luena" 
                        value={destination}
                        onChange={e => setDestination(e.target.value)}
                      />
                    </div>

                    <div className="space-y-1">
                      <label className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest">Escolher Viatura</label>
                      <select 
                        className="w-full p-2.5 bg-slate-950 border border-white/10 rounded-xl outline-none text-white focus:border-white font-bold"
                        value={selectedVehicleId}
                        onChange={e => setSelectedVehicleId(e.target.value)}
                      >
                        {availableVehicles.map((v) => (
                          <option key={v.id} value={v.id}>
                            {v.model} ({v.plate})
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <button 
                    onClick={handleInitiateCall}
                    className={`w-full py-3 rounded-xl font-black text-xs uppercase tracking-widest mt-4 flex items-center justify-center gap-2 ${currentTheme.btnClass}`}
                  >
                    <Phone size={12} />
                    Pedir Preço (Ligar)
                  </button>
                </div>
              </div>
            )}

            {isForwardModalOpen && (
              <div className="absolute inset-0 bg-black/75 z-40 flex flex-col justify-end">
                <div className="bg-slate-900 border-t border-white/10 rounded-t-[24px] p-6 space-y-4 animate-slide-up text-white max-h-[85%] overflow-y-auto no-scrollbar">
                  <div className="flex items-center justify-between border-b border-white/5 pb-3">
                    <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                      <Navigation size={14} className={currentTheme.textClass} />
                      Reforço / Reencaminhar
                    </h3>
                    <button 
                      onClick={() => setIsForwardModalOpen(false)}
                      className="p-1 hover:bg-white/10 rounded text-slate-400"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="space-y-3 text-xs">
                    <p className="text-slate-400 text-[10px]">
                      Selecione um colega para reencaminhar esta chamada em curso:
                    </p>
                    <div className="space-y-2 mt-4 max-h-48 overflow-y-auto pr-1">
                      {isLoadingFleet ? (
                        <div className="p-3 bg-white/5 border border-white/10 rounded-xl text-center flex items-center justify-center gap-2">
                          <RefreshCw size={12} className="animate-spin text-slate-400" />
                          <span className="text-[10px] text-slate-300">A carregar colegas...</span>
                        </div>
                      ) : availableVehicles.filter(v => v.driverName !== activeRideRecord?.driverName).length === 0 ? (
                        <div className="p-4 bg-white/5 border border-white/10 rounded-xl text-center text-[10px] text-slate-400">
                          Nenhum outro colega disponível no momento.
                        </div>
                      ) : (
                        availableVehicles.filter(v => v.driverName !== activeRideRecord?.driverName).map(veh => (
                          <div 
                            key={veh.id} 
                            onClick={() => handleConfirmForward(veh.id)}
                            className="p-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl cursor-pointer flex items-center justify-between transition-colors group"
                          >
                            <div className="flex flex-col">
                              <span className="text-white font-black text-[11px] uppercase tracking-wide group-hover:text-emerald-400 transition-colors">
                                {veh.driverName}
                              </span>
                              <span className="text-slate-400 font-bold text-[9px] uppercase tracking-wider">
                                {veh.plate} • {veh.model}
                              </span>
                            </div>
                            <Navigation size={14} className="text-slate-500 group-hover:text-emerald-400 transition-colors" />
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* MODAL 1: HISTÓRICO DE CORRIDAS RECENTES (JIS) */}
            {showRidesHistoryModal && (
              <div className="absolute inset-0 bg-black/85 z-40 flex flex-col justify-end">
                <div className="bg-slate-900 border-t border-white/10 rounded-t-[24px] p-6 space-y-4 animate-slide-up text-white max-h-[85%] overflow-y-auto no-scrollbar">
                  <div className="flex items-center justify-between border-b border-white/5 pb-3">
                    <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                      <Trophy size={14} className="text-amber-500" />
                      Minhas Corridas Recentes
                    </h3>
                    <button 
                      onClick={() => setShowRidesHistoryModal(false)}
                      className="p-1 hover:bg-white/10 rounded text-slate-400"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="space-y-2">
                    {myRides.length === 0 ? (
                      <div className="p-8 text-center bg-white/5 rounded-2xl border border-white/5 space-y-2">
                        <Car size={32} className="mx-auto text-slate-600 animate-pulse" />
                        <p className="text-[10px] text-slate-400 uppercase font-black">Nenhuma corrida registada</p>
                        <p className="text-[9px] text-slate-500 font-bold">Faça o seu primeiro pedido de Super Táxi para ver o progresso.</p>
                      </div>
                    ) : (
                      myRides.map((rd: any) => (
                        <div key={rd.id} className="p-3.5 bg-white/5 rounded-xl border border-white/5 flex items-center justify-between gap-3 text-xs">
                          <div className="space-y-1">
                            <p className="font-extrabold text-white text-[11px]">{rd.pickup} ➔ {rd.destination}</p>
                            <div className="flex items-center gap-2 text-[9px] text-slate-400 font-bold">
                              <span>Motorista: <strong className="text-slate-300">{rd.driverName || 'Não Alocado'}</strong></span>
                              <span>Plaque: <strong className="text-slate-300">{rd.vehiclePlate}</strong></span>
                            </div>
                            <p className="text-[8.5px] text-slate-500 uppercase font-bold">Token: {rd.boardingToken || 'N/A'}</p>
                          </div>
                          <div className="text-right shrink-0 space-y-1">
                            <span className="text-[11px] font-black text-amber-500 block">
                              {rd.price ? `${Number(rd.price).toLocaleString()} Kz` : 'A negociar'}
                            </span>
                            <span className={`text-[8px] font-black px-1.5 py-0.5 rounded border uppercase tracking-widest block text-center ${
                              rd.status === 'completed' ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20' : 
                              rd.status === 'confirmed' ? 'bg-blue-500/10 text-blue-400 border-blue-500/20' : 'bg-amber-500/10 text-amber-400 border-amber-500/20'
                            }`}>{rd.status === 'completed' ? 'Sucesso' : rd.status === 'confirmed' ? 'Aceite' : 'Aguardando'}</span>
                          </div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* MODAL 2: ALTERAR/TROCAR FOTO DE PERFIL (JIS) */}
            {showProfilePicModal && (
              <div className="absolute inset-0 bg-black/85 z-40 flex flex-col justify-end">
                <div className="bg-slate-900 border-t border-white/10 rounded-t-[24px] p-6 space-y-4 animate-slide-up text-white max-h-[85%] overflow-y-auto no-scrollbar">
                  <div className="flex items-center justify-between border-b border-white/5 pb-3">
                    <h3 className="text-sm font-black uppercase tracking-widest flex items-center gap-2">
                       <Camera size={14} className="text-blue-400" />
                       Trocar Foto de Perfil
                    </h3>
                    <button 
                      onClick={() => setShowProfilePicModal(false)}
                      className="p-1 hover:bg-white/10 rounded text-slate-400"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  <div className="space-y-4 py-2 text-center">
                    <p className="text-[9px] text-slate-400 uppercase font-bold tracking-tight">Escolha um avatar de prestígio ou envie um ficheiro personalizado:</p>
                    
                    {/* Selectable Presets */}
                    <div className="flex justify-center gap-3">
                      {PRESETS_AVATARS.map((av, idx) => (
                        <div 
                          key={idx}
                          onClick={() => {
                            setSelectedAvatar(av);
                            // Update local Profile state as well
                            const updated = { ...passengerProfile, photoUrl: av };
                            setPassengerProfile(updated);
                            localStorage.setItem('psm-passenger-profile', JSON.stringify(updated));
                          }}
                          className={`w-14 h-14 rounded-full overflow-hidden border-2 cursor-pointer transition-all ${
                            (passengerProfile?.photoUrl || selectedAvatar) === av ? 'border-amber-500 scale-110 shadow-lg' : 'border-transparent opacity-60'
                          }`}
                        >
                          <img src={av} alt="Avatar" className="w-full h-full object-cover" />
                        </div>
                      ))}
                    </div>

                    <div className="pt-2 border-t border-white/5 space-y-3">
                      <p className="text-[9px] text-slate-500 uppercase font-extrabold tracking-widest">OU CARREGUE DA GALERIA DO DISPOSITIVO</p>
                      <label className="inline-flex items-center gap-2 px-4 py-2.5 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/30 rounded-xl text-xs font-black uppercase tracking-wider cursor-pointer transition-all mx-auto">
                        <Camera size={14} className="text-blue-400" />
                        {isUploading ? 'A carregar ficheiro...' : 'Anexar Foto do Dispositivo'}
                        <input 
                          type="file" 
                          accept="image/*" 
                          onChange={(e) => {
                            if (e.target.files && e.target.files[0]) {
                              const file = e.target.files[0];
                              setIsUploading(true);
                              const reader = new FileReader();
                              reader.onload = (event) => {
                                if (event.target?.result) {
                                  const base64 = event.target.result as string;
                                  setSelectedAvatar(base64);
                                  const updated = { ...passengerProfile, photoUrl: base64 };
                                  setPassengerProfile(updated);
                                  localStorage.setItem('psm-passenger-profile', JSON.stringify(updated));
                                }
                                setIsUploading(false);
                                setShowProfilePicModal(false);
                              };
                              reader.readAsDataURL(file);
                            }
                          }} 
                          className="hidden" 
                        />
                      </label>
                    </div>

                    <button
                      onClick={() => setShowProfilePicModal(false)}
                      className="w-full mt-4 py-2.5 bg-white/5 border border-white/10 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-white/10"
                    >
                      Concluído
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* MODAL 3: RECLAMAÇÕES & PROTEÇÃO (JIS) */}
            {showComplaintsModal && (
              <div className="absolute inset-0 bg-black/85 z-40 flex flex-col justify-end">
                <div className="bg-slate-900 border-t border-white/10 rounded-t-[24px] p-6 space-y-4 animate-slide-up text-white max-h-[90%] overflow-y-auto no-scrollbar">
                  <div className="flex items-center justify-between border-b border-white/5 pb-3">
                    <h3 className="text-xs font-black uppercase tracking-widest flex items-center gap-2">
                      <AlertCircle size={14} className="text-rose-500" />
                      Reclamações & Proteção do Passageiro
                    </h3>
                    <button 
                      onClick={() => {
                        setShowComplaintsModal(false);
                        setComplaintText('');
                        setComplaintSuccessMsg('');
                      }}
                      className="p-1 hover:bg-white/10 rounded text-slate-400"
                    >
                      <X size={16} />
                    </button>
                  </div>

                  {complaintSuccessMsg ? (
                    <div className="space-y-4 py-6 text-center">
                      <div className="w-12 h-12 rounded-full bg-emerald-500/10 text-emerald-500 flex items-center justify-center mx-auto">
                        <Check size={24} />
                      </div>
                      <h4 className="text-xs font-black uppercase tracking-wider text-emerald-400">Reclamação Submetida</h4>
                      <p className="text-[10px] text-slate-300 leading-relaxed uppercase font-bold max-w-sm mx-auto">
                        {complaintSuccessMsg}
                      </p>
                      <button
                        onClick={() => {
                          setShowComplaintsModal(false);
                          setComplaintText('');
                          setComplaintSuccessMsg('');
                        }}
                        className={`w-full py-2.5 rounded-xl font-black text-[10px] uppercase tracking-widest ${currentTheme.btnClass}`}
                      >
                        Entendido
                      </button>
                    </div>
                  ) : (
                    <div className="space-y-4 text-xs">
                      <p className="text-[9.5px] text-slate-400 font-bold uppercase tracking-tight">
                        José Iweza Suana (**JIS**), utilize esta área para reportar qualquer má conduta ou infração operacional imediata.
                      </p>

                      <div className="space-y-1.5">
                        <label className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest">Tipo de Ocorrência</label>
                        <select
                          className="w-full p-2.5 bg-slate-950 border border-white/10 rounded-xl outline-none text-white focus:border-white font-bold"
                          value={complaintType}
                          onChange={e => setComplaintType(e.target.value)}
                        >
                          <option value="excesso_velocidade">Excesso de Velocidade (&gt;80km/h)</option>
                          <option value="mau_atendimento">Conduta Inadequada / Mau Atendimento</option>
                          <option value="perda_objeto">Perda / Esquecimento de Objeto Pessoal</option>
                          <option value="falta_troco">Problema com Ajuste de Preços / Falta de Troco</option>
                          <option value="pane_viatura">Avaria / Falha Técnica do Táxi</option>
                        </select>
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest">Matrícula ou Viatura (Opcional)</label>
                        <input
                          type="text"
                          className="w-full p-2.5 bg-slate-950 border border-white/10 rounded-xl outline-none text-white focus:border-white font-bold"
                          placeholder="Ex: LD-82-41-MZ ou Viatura Prefix 12"
                          value={complaintVehicle}
                          onChange={e => setComplaintVehicle(e.target.value)}
                        />
                      </div>

                      <div className="space-y-1.5">
                        <label className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest">Descrição dos Factos</label>
                        <textarea
                          rows={3}
                          className="w-full p-2.5 bg-slate-950 border border-white/10 rounded-xl outline-none text-white focus:border-white font-bold resize-none"
                          placeholder="Fale brevemente do ocorrido. O relatório será enviado com a sua identificação (+244) e enviado ao operador JIS."
                          value={complaintText}
                          onChange={e => setComplaintText(e.target.value)}
                        />
                      </div>

                      <button
                        onClick={async () => {
                          if (!complaintText.trim()) {
                            alert("Por favor, descreva os factos da sua reclamação.");
                            return;
                          }
                          setIsSubmittingComplaint(true);
                          try {
                            await addDoc(collection(db, 'complaints'), {
                              type: complaintType,
                              vehicle: complaintVehicle || 'Não Especificado',
                              description: complaintText,
                              passengerName: passengerProfile?.name || 'Anónimo',
                              passengerPhone: passengerProfile?.backupPhone || 'N/A',
                              timestamp: new Date(),
                              status: 'pending'
                            });
                            setComplaintSuccessMsg("A sua reclamação foi anexada com carimbo de data. A fiscalização em Luena-Moxico iniciará uma auditoria.");
                          } catch (err) {
                            console.error("Error submitting complaint:", err);
                            alert("Ocorreu um erro ao submeter. Tente novamente.");
                          } finally {
                            setIsSubmittingComplaint(false);
                          }
                        }}
                        disabled={isSubmittingComplaint}
                        className={`w-full py-3 rounded-xl font-black text-xs uppercase tracking-widest flex items-center justify-center gap-2 ${currentTheme.btnClass} ${isSubmittingComplaint ? 'opacity-50' : ''}`}
                      >
                        {isSubmittingComplaint ? <RefreshCw className="animate-spin" size={14} /> : 'Enviar Reclamação à Central'}
                      </button>

                      <div className="pt-2 border-t border-white/15 space-y-2 text-center">
                        <p className="text-[8.5px] text-slate-500 uppercase font-black">Precisa de ajuda imediata?</p>
                        <a 
                          href="https://wa.me/244923456789" 
                          target="_blank" 
                          referrerPolicy="no-referrer"
                          className="w-full py-2.5 bg-[#25D366]/10 border border-[#25D366]/30 rounded-xl text-[10px] font-extrabold uppercase text-[#25D366] tracking-wider text-center flex items-center justify-center gap-1.5 hover:bg-[#25D366]/20 transition-all"
                        >
                          <Phone size={11} /> Contactar Central Directo (WhatsApp)
                        </a>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

          </div>
        </div>

    </div>
  );
}
