// @ts-nocheck
import React, { useState, useEffect, useRef } from "react";
import {
  Smartphone,
  Power,
  MapPin,
  Navigation,
  Menu,
  Bell,
  Star,
  DollarSign,
  Clock,
  CheckCircle2,
  Plus,
  XCircle,
  Phone,
  PhoneIncoming,
  PhoneCall,
  MessageCircle,
  MoreVertical,
  ChevronRight,
  ChevronDown,
  ChevronUp,
  Shield,
  Activity,
  History,
  AlertTriangle,
  Wallet,
  Wrench,
  Settings,
  FileSignature,
  X,
  Users,
  Loader2,
  ExternalLink,
  RefreshCw,
  Zap,
  MessageSquare,
  Layout,
} from "lucide-react";
import RevenueManagement from "./RevenueManagement";
import { WhatsAppMonitor } from "./WhatsAppMonitor";
import WaitingTimer from './WaitingTimer';
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";
import { format } from "date-fns";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import {
  collection,
  query,
  where,
  or,
  and,
  onSnapshot,
  orderBy,
  limit,
  doc,
  updateDoc,
  serverTimestamp,
  arrayUnion,
  addDoc,
  getDocs,
  getDoc,
} from "firebase/firestore";

import { auth } from "../lib/firebase";
import { signOut } from "firebase/auth";

import { MapContainer, TileLayer, Marker, useMap, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

import { geminiService } from "../services/geminiService";

// Fix for Leaflet default icon issues
// @ts-ignore
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

function MapUpdater({ center }: { center: [number, number] }) {
  const map = useMap();
  useEffect(() => {
    map.setView(center, map.getZoom());
  }, [center, map]);
  return null;
}

interface DriverViewProps {
  user: any;
}

export default function DriverView({ user }: DriverViewProps) {
  const [isOnline, setIsOnline] = useState<boolean>(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem("driver_is_online");
      return saved === "true";
    }
    return false;
  });
  const [isWhatsAppOpen, setIsWhatsAppOpen] = useState(false);
  const [currentService, setCurrentService] = useState<any>(null);
  const currentServiceRef = useRef<any>(null);
  useEffect(() => {
    currentServiceRef.current = currentService;
  }, [currentService]);
  const [lastCancelledService, setLastCancelledService] = useState<any | null>(null);
  const [otherDrivers, setOtherDrivers] = useState<any[]>([]);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferLoading, setTransferLoading] = useState(false);
  const [isNewCallTransferModalOpen, setIsNewCallTransferModalOpen] = useState(false);
  const [proposedPrice, setProposedPrice] = useState("");

  const attendCall = async () => {
    if (!currentService?.id) return;
    try {
      const callRef = doc(db, "calls", currentService.id);
      await updateDoc(callRef, {
        status: "connected",
        responseHistory: arrayUnion({
          driverId: user?.uid,
          action: "attended",
          timestamp: new Date().toISOString()
        })
      });
      setCurrentService({ ...currentService, status: "connected" });
      setProposedPrice(""); // reset any custom price when answering
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `calls/${currentService.id}`);
    }
  };

  const sendPriceOffer = async (priceInputInput?: number) => {
    const finalPrice = priceInputInput || Number(proposedPrice);
    if (!finalPrice || finalPrice <= 0) {
      alert("Por favor, introduza um preço válido.");
      return;
    }

    if (!currentService?.id) return;

    try {
      const callRef = doc(db, "calls", currentService.id);
      await updateDoc(callRef, {
        status: "price_sent",
        price: finalPrice,
        responseHistory: arrayUnion({
          action: "price_offered",
          price: finalPrice,
          timestamp: new Date().toISOString(),
          driverId: user?.uid || "unknown",
          driverName: user?.name || "Driver",
        }),
      });

      setCurrentService({ ...currentService, status: "price_sent", price: finalPrice });
      setProposedPrice("");
      setShowNotification(false);
      alert(`Proposta de preço de ${finalPrice.toLocaleString()} Kz enviada ao passageiro.`);
    } catch (error: any) {
      alert("Erro ao propor preço: " + error.message);
    }
  };

  const setModalOpenLogged = (val: boolean) => {
    if (val) console.trace("Modal transfer aberto");
    setIsNewCallTransferModalOpen(val);
  };

  const [transferCustomerPhone, setTransferCustomerPhone] = useState("");
  const [transferCustomerName, setTransferCustomerName] = useState("");
  const [transferPickupAddress, setTransferPickupAddress] = useState("");
  const [earnings, setEarnings] = useState(0);
  const [stars, setStars] = useState(4.8);
  const hiddenCallIdsRef = useRef<string[]>([]);
  const forceDismissService = () => {
    setActiveInternalTab("dashboard");
    setShowNotification(false);
  };
  const [tripHistory, setTripHistory] = useState<any[]>([]);

  const [aiAdvice, setAiAdvice] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [safetyChecklist, setSafetyChecklist] = useState<string | null>(null);
  const [showSafetyCheck, setShowSafetyCheck] = useState(false);

  const fetchAiAdvice = async () => {
    if (!user || aiLoading) return;
    setAiLoading(true);
    try {
      const context = {
        targetRevenue: 25000, // Exemplo de meta diária
        currentRevenue: earnings,
        shiftHours: tripHistory.length > 0 ? 8 : 0, // Placeholder
      };
      const result = await geminiService.getDriverCoachingInsights(user, context);
      setAiAdvice(result);
    } catch (err) {
      setAiAdvice("Foque na segurança e excelência no atendimento.");
    } finally {
      setAiLoading(false);
    }
  };

  useEffect(() => {
    // Initial fetch of advice after a short delay
    const timer = setTimeout(() => {
      fetchAiAdvice();
    }, 2000);
    return () => clearTimeout(timer);
  }, [user?.uid]);

  // Listen for accumulated earnings from approved revenue logs
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, "revenue_logs"),
      where("driverId", "==", user.uid),
      where("status", "in", ["pending_approval", "approved_by_operator", "approved_by_accountant", "finalized", "paid_to_staff"]),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const total = snapshot.docs.reduce(
        (acc, doc) => acc + (doc.data().amount || 0),
        0,
      );
      setEarnings(total);
    }, (error) => handleFirestoreError(error, OperationType.GET, "revenue_logs"));

    return () => unsubscribe();
  }, [user?.uid]);

  // Listen for trip history
  useEffect(() => {
    if (!user?.name) return;
    const q = query(
      collection(db, "calls"),
      where("driverName", "==", user.name),
      where("status", "==", "completed"),
      orderBy("timestamp", "desc"),
      limit(50),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTripHistory(
        snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
      );
    }, (error) => handleFirestoreError(error, OperationType.GET, "calls"));

    return () => unsubscribe();
  }, [user?.name]);

  const [passengerRidesConfirmed, setPassengerRidesConfirmed] = useState<any[]>([]);
  const [passengerRidesTotal, setPassengerRidesTotal] = useState(0);

  // Sync passenger rides in real-time
  useEffect(() => {
    if (!user?.name) return;
    const q = query(
      collection(db, "calls"),
      where("driverName", "==", user.name),
      where("status", "==", "completed")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const list = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      setPassengerRidesConfirmed(list);
      const total = list.reduce((acc, curr: any) => acc + (Number(curr.price) || 0), 0);
      setPassengerRidesTotal(total);
    }, (error) => {
      console.warn("Fallowing listener of passenger rides:", error);
    });

    return () => unsubscribe();
  }, [user?.name]);

  const [showNotification, setShowNotification] = useState(false);
  const [recentCalls, setRecentCalls] = useState<any[]>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isMessagesModalOpen, setIsMessagesModalOpen] = useState(false);
  const [activeInternalTab, setActiveInternalTab] = useState<
    "dashboard" | "history" | "wallet" | "contracts" | "settings" | "rendas"
  >("dashboard");
  const [selectedRingtone, setSelectedRingtone] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('driver_ringtone') || 'classic';
    }
    return 'classic';
  });
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const ringtones = [
    { id: 'classic', name: 'Clássico', url: 'https://assets.mixkit.co/active_storage/sfx/2869/2869-preview.mp3' },
    { id: 'modern', name: 'Moderno', url: 'https://assets.mixkit.co/active_storage/sfx/2358/2358-preview.mp3' },
    { id: 'alert', name: 'Alerta', url: 'https://assets.mixkit.co/active_storage/sfx/1359/1359-preview.mp3' },
    { id: 'melodic', name: 'Melódico', url: 'https://assets.mixkit.co/active_storage/sfx/2568/2568-preview.mp3' },
  ];

  const playPreview = (url: string) => {
    if (audioRef.current) {
      audioRef.current.pause();
    }
    audioRef.current = new Audio(url);
    audioRef.current.play().catch(e => console.warn(e));
  };
  const [showPanicModal, setShowPanicModal] = useState(false);
  const [localPassengerOffline, setLocalPassengerOffline] = useState(false);
  const [activePanicAlert, setActivePanicAlert] = useState<any | null>(null);
  const [panicLoading, setPanicLoading] = useState(false);
  const [isContractModalOpen, setIsContractModalOpen] = useState(false);
  const [contractLoading, setContractLoading] = useState(false);
  const [contractFormData, setContractFormData] = useState({
    clientName: "",
    neighborhood: "",
    destination: "Trabalho",
    period: "Manhã",
    phone: "",
    notes: "",
    location: null as { lat: number; lng: number } | null,
  });
  const [isCapturingGeo, setIsCapturingGeo] = useState(false);
  const [showContractMap, setShowContractMap] = useState(false);
  const [revenueAmount, setRevenueAmount] = useState("");
  const [revenueLoading, setRevenueLoading] = useState(false);
  const [revenueSuccess, setRevenueSuccess] = useState(false);
  const [revenueDetails, setRevenueDetails] = useState({
    tpa: "",
    cash: "",
    transfer: "",
    expenses: "",
    description: "",
  });
  const [assignedVehicle, setAssignedVehicle] = useState<any>(null);
  const [vehicleContracts, setVehicleContracts] = useState<any[]>([]);
  const [todayAttendance, setTodayAttendance] = useState<
    Record<string, string>
  >({});
  const [todayRevenueSubmitted, setTodayRevenueSubmitted] = useState(false);
  const [pendingRevenues, setPendingRevenues] = useState<any[]>([]);
  const [rejectedRevenues, setRejectedRevenues] = useState<any[]>([]);
  const [editingRevenueId, setEditingRevenueId] = useState<string | null>(null);
  const [lastAssignedShift, setLastAssignedShift] = useState<{
    date: string;
    vehicleId: string;
    prefix: string;
  } | null>(null);
  const [lastShiftRevenueSubmitted, setLastShiftRevenueSubmitted] =
    useState(true);
  const [lastShiftPendingContracts, setLastShiftPendingContracts] =
    useState<number>(0);
  const [loadingShiftCheck, setLoadingShiftCheck] = useState(true);
  const [viewContractsDate, setViewContractsDate] = useState(
    new Date().toISOString().split("T")[0],
  );
  const [viewContractsPrefix, setViewContractsPrefix] = useState<string | null>(
    null,
  );
  const [capturingGpsId, setCapturingGpsId] = useState<string | null>(null);
  const [unreadMessages, setUnreadMessages] = useState<any[]>([]);
  const [isAiAdviceExpanded, setIsAiAdviceExpanded] = useState(false);
  const [isAlertsCollapsed, setIsAlertsCollapsed] = useState(true);
  const markMessageAsRead = async (messageId: string) => {
    try {
      await updateDoc(doc(db, "messages", messageId), {
        status: "read",
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "messages");
    }
  };

  // Listen for unread messages
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, "messages"),
      where("targets", "array-contains", user.uid),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const messages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const unreadFiltered = messages
        .filter((msg: any) => msg.status === "unread")
        .sort((a: any, b: any) => {
          const tA = a.timestamp ? (a.timestamp.seconds ? a.timestamp.seconds * 1000 : new Date(a.timestamp).getTime()) : 0;
          const tB = b.timestamp ? (b.timestamp.seconds ? b.timestamp.seconds * 1000 : new Date(b.timestamp).getTime()) : 0;
          return tB - tA;
        });
      setUnreadMessages(unreadFiltered);
    }, (error) => handleFirestoreError(error, OperationType.GET, "messages"));

    return () => unsubscribe();
  }, [user?.uid]);

  // Listen for any active panic S.O.S alert of this driver
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, "panic_alerts"),
      where("driverId", "==", user.uid),
      where("status", "==", "active")
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        // Take the latest active alert
        const activeDoc = snapshot.docs[0];
        setActivePanicAlert({ id: activeDoc.id, ...activeDoc.data() });
        setShowPanicModal(true); // Automatically trigger overlay
      } else {
        setActivePanicAlert(null);
        setShowPanicModal(false);
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, "panic_alerts"));

    return () => unsubscribe();
  }, [user?.uid]);

  // Listen for the active vehicle assignment for this driver
  useEffect(() => {
    if (!user?.name) return;

    // We listen to the entire active drivers collection to find a robust match.
    // This allows the driver to match even if they have "(Admin)" or case & accent mismatches.
    const unsubscribe = onSnapshot(collection(db, "drivers"), (snapshot) => {
      // Clean names helper (removes accents, parenthesis like (Admin), simplifies spaces)
      const cleanName = (n: string) => {
        if (!n) return "";
        return n
          .toLowerCase()
          .replace(/\s*\(.*?\)\s*/g, '')
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/\s+/g, ' ')
          .trim();
      };

      const loggedNameClean = cleanName(user.name);

      const matchedDoc = snapshot.docs.find(docSnap => {
        const d = docSnap.data();
        const dNameClean = cleanName(d.name || "");
        return (
          (d.driverId && user.uid && d.driverId === user.uid) ||
          (dNameClean !== "" && loggedNameClean !== "" && dNameClean === loggedNameClean) ||
          (d.name && user.name && d.name.toLowerCase().trim() === user.name.toLowerCase().trim())
        );
      });

      if (matchedDoc) {
        const dData = matchedDoc.data();
        const vehicle = { id: matchedDoc.id, ...dData };
        setAssignedVehicle(vehicle);

        // Sync shifting state with database status
        if (dData.status === "disponível" || dData.status === "ocupado") {
          setIsOnline(true);
          localStorage.setItem("driver_is_online", "true");
        } else if (dData.status === "indisponível") {
          setIsOnline(false);
          localStorage.removeItem("driver_is_online");
        }

        if (viewContractsDate === new Date().toISOString().split("T")[0]) {
          setViewContractsPrefix(vehicle.prefix);
        }
      } else {
        setAssignedVehicle(null);
        if (viewContractsDate === new Date().toISOString().split("T")[0]) {
          setViewContractsPrefix(user?.prefix && user.prefix !== "N/A" ? user.prefix : null);
        }
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, "drivers"));
    return () => unsubscribe();
  }, [user?.name, user?.uid, viewContractsDate, user?.prefix]);

  // Synchronize state strictly with the linked vehicle prefix only (no fallbacks or selectors)
  useEffect(() => {
    const pf = assignedVehicle?.prefix || (user?.prefix && user.prefix !== "N/A" ? user.prefix : "");
    setViewContractsPrefix(pf || null);
  }, [assignedVehicle?.prefix, user?.prefix]);

  // Listen for contracts associated with the SELECTED VEHICLE PREFIX
  useEffect(() => {
    const prefix = viewContractsPrefix;
    if (!prefix) {
      setVehicleContracts([]);
      return;
    }

    const q = query(
      collection(db, "internal_contracts"),
      orderBy("createdAt", "desc"),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const allContracts = snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      }));
      const filtered = allContracts.filter((c: any) => {
        const isEntry = c.entryVehicleId?.includes(prefix);
        const isExit = c.exitVehicleId?.includes(prefix);
        // We filter by isActive status. PaymentStatus shouldn't prevent driver viewing
        return (
          (isEntry || isExit) &&
          c.status === "Ativo"
        );
      });
      setVehicleContracts(filtered);
    }, (error) => handleFirestoreError(error, OperationType.GET, "internal_contracts"));

    return () => unsubscribe();
  }, [viewContractsPrefix]);

  // Listen for contract attendance for SELECTED DATE
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, "contract_attendance"),
      where("date", "==", viewContractsDate),
      where("driverId", "==", user.uid),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const attendanceMap: Record<string, string> = {};
      snapshot.docs.forEach((doc) => {
        const data = doc.data();
        if (data.movementType) {
          attendanceMap[`${data.contractId}_${data.movementType}`] =
            data.status;
        } else {
          attendanceMap[data.contractId] = data.status; // Fallback
        }
      });
      setTodayAttendance(attendanceMap);
    }, (error) => handleFirestoreError(error, OperationType.GET, "contract_attendance"));

    return () => unsubscribe();
  }, [user?.uid, viewContractsDate]);

  // Logic to check PREVIOUS assigned shift
  useEffect(() => {
    if (!user?.uid) return;

    const todayStr = new Date().toISOString().split("T")[0];

    // Find the last assignment before today in driver_scales
    const lastShiftQuery = query(
      collection(db, "driver_scales"),
      where("driverId", "==", user.uid),
      where("date", "<", todayStr),
      orderBy("date", "desc"),
      limit(1),
    );

    const unsubscribe = onSnapshot(lastShiftQuery, async (snapshot) => {
      if (snapshot.empty) {
        setLastAssignedShift(null);
        setLoadingShiftCheck(false);
        return;
      }

      const shiftData = snapshot.docs[0].data();
      const shiftDate = shiftData.date;
      const vehicleId = shiftData.vehicleId;
      const vehiclePrefix = shiftData.vehiclePrefix || "Viatura";

      setLastAssignedShift({
        date: shiftDate,
        vehicleId,
        prefix: vehiclePrefix,
      });

      // 1. Check Revenue for that specific date
      const revQuery = query(
        collection(db, "revenue_logs"),
        where("driverId", "==", user.uid),
        where("date", "==", shiftDate),
        limit(1),
      );

      const revSnaps = await getDocs(revQuery);
      setLastShiftRevenueSubmitted(!revSnaps.empty);

      // 2. Check Contracts for that vehicle/date
      // Filter: Payment Status must be 'Pago' and vehicle must be assigned for entry or exit
      const contractsQuery = query(
        collection(db, "internal_contracts"),
        where("status", "==", "Ativo"),
        where("paymentStatus", "==", "Pago"),
      );

      const contractAll = await getDocs(contractsQuery);
      const shiftVehicleContracts = contractAll.docs.filter((doc) => {
        const data = doc.data();
        const isEntry = data.entryVehicleId?.includes(vehiclePrefix);
        const isExit = data.exitVehicleId?.includes(vehiclePrefix);
        return isEntry || isExit;
      });

      const totalContracts = shiftVehicleContracts.length;

      if (totalContracts > 0) {
        const attendanceQuery = query(
          collection(db, "contract_attendance"),
          where("driverId", "==", user.uid),
          where("date", "==", shiftDate),
        );
        const attendanceSnaps = await getDocs(attendanceQuery);
        const attendedIds = attendanceSnaps.docs.map(
          (d) => d.data().contractId,
        );

        // Count how many of the vehicle's active contracts were NOT marked
        let pending = 0;
        shiftVehicleContracts.forEach((c) => {
          if (!attendedIds.includes(c.id)) pending++;
        });
        setLastShiftPendingContracts(pending);
      } else {
        setLastShiftPendingContracts(0);
      }

      setLoadingShiftCheck(false);
    }, (error) => handleFirestoreError(error, OperationType.GET, "driver_scales"));

    return () => unsubscribe();
  }, [user?.uid]);

  // Listen for today's revenue submission
  useEffect(() => {
    if (!user?.uid) return;
    const today = new Date().toISOString().split("T")[0];
    const q = query(
      collection(db, "revenue_logs"),
      where("driverId", "==", user.uid),
      where("date", "==", today),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTodayRevenueSubmitted(!snapshot.empty);
    }, (error) => handleFirestoreError(error, OperationType.GET, "revenue_logs"));

    return () => unsubscribe();
  }, [user?.uid]);

  // Listen for pending / rejected revenues
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, "revenue_logs"),
      where("driverId", "==", user.uid),
      where("status", "in", ["pending_approval", "rejected_by_operator", "rejected_by_accountant"]),
      orderBy("timestamp", "desc"),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const all = snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() }));
      setPendingRevenues(all.filter(r => r.status === 'pending_approval'));
      setRejectedRevenues(all.filter(r => r.status !== 'pending_approval'));
    }, (error) => handleFirestoreError(error, OperationType.GET, "revenue_logs"));

    return () => unsubscribe();
  }, [user?.uid]);

  const markContractAttendance = async (
    contractId: string,
    status: "attended" | "absent",
    movementType: "entry" | "exit" = "entry",
  ) => {
    if (!user?.uid || !viewContractsPrefix) return;
    try {
      await addDoc(collection(db, "contract_attendance"), {
        contractId,
        driverId: user.uid,
        vehicleId: viewContractsPrefix,
        date: viewContractsDate,
        status,
        movementType,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "contract_attendance");
      alert("Erro ao marcar presença. Verifique a conexão.");
    }
  };

  const captureContractGps = async (contractId: string) => {
    if (!navigator.geolocation) {
      alert("Geolocalização não suportada no seu dispositivo.");
      return;
    }
    setCapturingGpsId(contractId);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude } = pos.coords;
          await updateDoc(doc(db, "internal_contracts", contractId), {
            location: { lat: latitude, lng: longitude }
          });
          alert("Localização GPS gravada com sucesso neste ponto de recolha!");
        } catch (err) {
          console.error("Erro ao gravar localização de contrato:", err);
          handleFirestoreError(err, OperationType.UPDATE, `internal_contracts/${contractId}`);
          alert("Ocorreu um erro ao guardar os dados de GPS no servidor.");
        } finally {
          setCapturingGpsId(null);
        }
      },
      (err) => {
        console.error("Erro GPS:", err);
        setCapturingGpsId(null);
        alert("Não foi possível obter a sua localização atual. Verifique as permissões de GPS.");
      },
      { enableHighAccuracy: true, timeout: 8000 }
    );
  };

  const triggerPanic = async () => {
    if (!user?.uid || panicLoading) return;
    setPanicLoading(true);
    try {
      // Get current location from navigator if possible
      let location = { lat: -11.7833, lng: 19.9167 }; // Default Luena

      if ("geolocation" in navigator) {
        try {
          const pos = await new Promise<GeolocationPosition>((res, rej) =>
            navigator.geolocation.getCurrentPosition(res, rej, {
              timeout: 5000,
            }),
          );
          location = { lat: pos.coords.latitude, lng: pos.coords.longitude };
        } catch (e) {
          console.warn("Geolocation failed, using default.");
        }
      }

      await addDoc(collection(db, "panic_alerts"), {
        driverId: user.uid,
        driverName: user.name,
        prefix: user.prefix || "N/A",
        lat: location.lat,
        lng: location.lng,
        status: "active",
        timestamp: new Date().toISOString(),
      });
      setShowPanicModal(true);
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "panic_alerts");
    } finally {
      setPanicLoading(false);
    }
  };

  const acknowledgeRescue = async () => {
    if (!activePanicAlert?.id) return;
    try {
      await updateDoc(doc(db, "panic_alerts", activePanicAlert.id), {
        driverAcknowledge: true,
        acknowledgedAt: new Date().toISOString()
      });
      alert("Recebimento de ajuda confirmado! Fique no local em segurança.");
    } catch (e) {
      console.error(e);
    }
  };

  const resolvePanicFromDriver = async () => {
    if (!activePanicAlert?.id) return;
    if (!window.confirm("Deseja mesmo cancelar o S.O.S? Confirme que está em total segurança.")) return;
    try {
      await updateDoc(doc(db, "panic_alerts", activePanicAlert.id), {
        status: "resolved",
        resolvedAt: new Date(),
        resolvedBy: "Motorista (Estou Seguro)",
        notes: "O próprio motorista encerrou o S.O.S a partir da sua Cabine de Controlo."
      });
      setActivePanicAlert(null);
      setShowPanicModal(false);
      alert("S.O.S encerrado com sucesso.");
    } catch (e) {
      console.error(e);
    }
  };

  const submitRevenue = async (e: React.FormEvent) => {
    e.preventDefault();
    const tpa = Number(revenueDetails.tpa) || 0;
    const cash = Number(revenueDetails.cash) || 0;
    const transfer = Number(revenueDetails.transfer) || 0;
    const expenses = Number(revenueDetails.expenses) || 0;
    const total = tpa + cash + transfer - expenses;

    if (total <= 0 && expenses === 0) {
      alert("Por favor, insira um valor de renda ou uma despesa.");
      return;
    }

    // Constraint: Only allow revenue submission if driver is linked to a vehicle OR has a prefix
    if (!assignedVehicle && !user.prefix) {
      alert(
        "ERRO: Você não está vinculado a nenhuma viatura. Entre em contacto com o Operador para configurar o seu prefixo.",
      );
      return;
    }

    setRevenueLoading(true);
    try {
      const revenueData = {
        driverId: user.uid,
        driverName: user.name,
        prefix: user.prefix || "N/A",
        amount: total,
        breakdown: {
          tpa,
          cash,
          transfer,
          expenses,
          appRides: 0,
        },
        description: revenueDetails.description,
        date: editingRevenueId 
          ? rejectedRevenues.find(r => r.id === editingRevenueId)?.date || new Date().toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
        status: "pending_approval",
        timestamp: new Date().toISOString(),
        rejectionReason: "" // Clear reason on resubmit
      };

      if (editingRevenueId) {
        await updateDoc(doc(db, "revenue_logs", editingRevenueId), revenueData);
        setEditingRevenueId(null);
      } else {
        await addDoc(collection(db, "revenue_logs"), revenueData);
      }
      
      setRevenueSuccess(true);
      setRevenueDetails({
        tpa: "",
        cash: "",
        transfer: "",
        expenses: "",
        description: "",
      });
      setTimeout(() => setRevenueSuccess(false), 3000);
    } catch (error) {
      handleFirestoreError(error, editingRevenueId ? OperationType.UPDATE : OperationType.CREATE, "revenue_logs");
    } finally {
      setRevenueLoading(false);
    }
  };

  // Simulate real-time data sync for the driver
  useEffect(() => {
    if (!user?.uid) return;

    // Listen to active and terminal statuses to handle cancellations and completions in real-time
    const q = query(
      collection(db, "calls"),
      where("status", "in", ["pending", "connected", "price_sent", "confirmed", "arrived", "active", "completed", "cancelled", "rejected", "ignored"])
    );

    const handleSync = (snapshot: any) => {
      const cleanName = (n: string) => {
        if (!n) return "";
        return n
          .toLowerCase()
          .replace(/\s*\(.*?\)\s*/g, '')
          .normalize("NFD")
          .replace(/[\u0300-\u036f]/g, "")
          .replace(/\s+/g, ' ')
          .trim();
      };

      // Try tracking current active service first or locate newest valid pending service
      const ourMatchedDoc = snapshot.docs.find((doc: any) => {
        if (currentServiceRef.current?.id && doc.id === currentServiceRef.current.id) {
          return true;
        }

        const d = doc.data();
        if (["completed", "cancelled", "rejected", "ignored"].includes(d.status)) return false;
        if (hiddenCallIdsRef.current.includes(doc.id)) return false;

        const callDriverNameClean = cleanName(d.driverName || "");
        const loggedDriverNameClean = cleanName(user?.name || "");
        const isNameMatch = callDriverNameClean !== "" && loggedDriverNameClean !== "" && callDriverNameClean === loggedDriverNameClean;

        return (
          isNameMatch ||
          (d.driverId && d.driverId === user?.uid) ||
          (assignedVehicle?.id && d.driverId === assignedVehicle.id) ||
          (assignedVehicle?.driverId && d.driverId === assignedVehicle.driverId)
        );
      });

      if (ourMatchedDoc) {
        const callData = { id: ourMatchedDoc.id, ...ourMatchedDoc.data() };
        
        if (["completed", "cancelled", "rejected", "ignored"].includes(callData.status)) {
          // Clean up state on cancellation or completion
          if (callData.status === "cancelled") {
            console.log("Passenger cancelled or ended call, informing driver");
            setLastCancelledService(callData);
          }
          setCurrentService(null);
          setShowNotification(false);
        } else {
          // Sync current active service state
          console.log("Serviço sincronizado:", callData);
          setCurrentService(callData);
          
          if (["pending", "connected", "price_sent", "confirmed"].includes(callData.status)) {
            setShowNotification(true);
          } else {
            setShowNotification(false);
          }
        }
      } else {
        // Clear if not found
        setCurrentService(null);
        setShowNotification(false);
      }
    };

    // 1) Real-time Stream Subscriber (Highly robust native channel)
    const unsubscribe = onSnapshot(q, (snapshot) => {
      handleSync(snapshot);
    }, (error) => {
      console.warn("Real-time stream error on driver:", error);
    });

    return () => {
      unsubscribe();
    };
  }, [user?.uid, assignedVehicle?.id, assignedVehicle?.driverId, user?.name]);

  // Listen for other active and available drivers in the fleet
  useEffect(() => {
    if (!user?.uid) return;
    const unsubscribe = onSnapshot(collection(db, "drivers"), (snapshot) => {
      const driversList = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((d: any) => {
          const cleanName = (n: string) => {
            if (!n) return "";
            return n
              .toLowerCase()
              .replace(/\s*\(.*?\)\s*/g, '')
              .normalize("NFD")
              .replace(/[\u0300-\u036f]/g, "")
              .replace(/\s+/g, ' ')
              .trim();
          };
          const isMe = d.driverId === user?.uid || 
                       (assignedVehicle?.id && d.id === assignedVehicle.id) ||
                       (d.name && user?.name && cleanName(d.name) === cleanName(user.name));
          if (isMe) return false;
          
          const status = (d.status || "").toLowerCase();
          const activeStatuses = ["available", "ativo", "disponível", "disponivel", "busy", "ocupado", "em serviço", "em curso"];
          return activeStatuses.includes(status);
        });
      setOtherDrivers(driversList);
    }, (error) => handleFirestoreError(error, OperationType.GET, "drivers"));

    return () => unsubscribe();
  }, [user?.uid, user?.name]);

  // Background GPS Tracking & Offline Logger/Syncer Logic
  useEffect(() => {
    if (!isOnline) return;

    // Helper to queue point offline if there is a network issue
    const queueOfflineGPS = (point: any) => {
      try {
        const existing = localStorage.getItem("gps_offline_queue");
        const queue = existing ? JSON.parse(existing) : [];
        queue.push(point);
        localStorage.setItem("gps_offline_queue", JSON.stringify(queue));
        console.log(`[Offline GPS Tracker] Guardado offline. Total em fila: ${queue.length}`);
      } catch (err) {
        console.error("Erro ao enfileirar ponto de GPS offline:", err);
      }
    };

    // 1. Core tracking interval: checks GPS and log it
    const trackInterval = setInterval(() => {
      if ("geolocation" in navigator) {
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            const lat = position.coords.latitude;
            const lng = position.coords.longitude;
            const speed = position.coords.speed !== null && position.coords.speed !== undefined
              ? Math.round(position.coords.speed * 3.6) // m/s to km/h
              : Math.floor(Math.random() * 41) + 20; // Simulated realistic speed between 20-60 km/h

            const newPoint = {
              driverId: user?.uid || "N/A",
              prefix: assignedVehicle?.prefix || user?.prefix || "N/A",
              lat,
              lng,
              speed,
              timestamp: new Date().toISOString()
            };

            try {
              // Save to historical logs collection (gps_history)
              await addDoc(collection(db, "gps_history"), newPoint);

              // Update the current active vehicle's document in the 'drivers' collection
              if (assignedVehicle?.id) {
                const driverRef = doc(db, "drivers", assignedVehicle.id);
                await updateDoc(driverRef, {
                  lat,
                  lng,
                  speed,
                  lastUpdated: new Date().toISOString()
                });
              }
              console.log("[Background GPS Tracker] Ponto sincronizado online com sucesso:", newPoint);
            } catch (err) {
              console.warn("[Background GPS Tracker] Falha ao enviar online, guardando offline:", err);
              queueOfflineGPS(newPoint);
            }
          },
          (error) => {
            console.error("[Background GPS Tracker] Erro do sensor de geolocalização:", error);
          },
          { enableHighAccuracy: true, timeout: 15000 }
        );
      }
    }, 60000); // Poll GPS every 60 seconds when shift is started

    // 2. Offline syncing interval
    const syncInterval = setInterval(async () => {
      if (!navigator.onLine) return;
      const existing = localStorage.getItem("gps_offline_queue");
      if (!existing) return;

      try {
        const queue = JSON.parse(existing);
        if (queue.length === 0) return;

        console.log(`[Offline GPS Tracker] Sincronizando ${queue.length} pontos salvos offline em segundo plano...`);
        for (const point of queue) {
          await addDoc(collection(db, "gps_history"), point);
        }

        localStorage.removeItem("gps_offline_queue");
        console.log("[Background GPS Tracker] Todos os pontos offline foram sincronizados e a fila foi limpa!");
      } catch (err) {
        console.error("[Background GPS Tracker] Falha ao sincronizar pontos offline remotos:", err);
      }
    }, 30000); // Check and sync offline points every 30 seconds

    return () => {
      clearInterval(trackInterval);
      clearInterval(syncInterval);
    };
  }, [isOnline, assignedVehicle, user]);

  // Handle "No Response" timeout
  useEffect(() => {
    let timeout: NodeJS.Timeout;
    if (showNotification && currentService?.status === "pending") {
      // Play Ringtone
      const ringtone = ringtones.find(r => r.id === selectedRingtone) || ringtones[0];
      if (audioRef.current) {
        audioRef.current.pause();
      }
      audioRef.current = new Audio(ringtone.url);
      audioRef.current.loop = true;
      audioRef.current.play().catch(e => console.warn("Audio play failed:", e));

      timeout = setTimeout(async () => {
        try {
          if (!currentService?.id) return;
          const callRef = doc(db, "calls", currentService.id);
          await updateDoc(callRef, {
            responseHistory: arrayUnion({
              action: "ignored",
              timestamp: new Date().toISOString(),
              driverId: user?.uid || "unknown",
              driverName: user?.name || "Driver",
            }),
          });
          setShowNotification(false);
          setCurrentService(null);
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `calls/${currentService.id}`);
        }
      }, 45000); // 45 seconds timeout
    } else {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current.currentTime = 0;
      }
    }
    return () => {
      clearTimeout(timeout);
      if (audioRef.current) {
        audioRef.current.pause();
      }
    };
  }, [showNotification, currentService, user, selectedRingtone]);

  const captureContractLocation = () => {
    setIsCapturingGeo(true);
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition(
        (position) => {
          setContractFormData({
            ...contractFormData,
            location: {
              lat: position.coords.latitude,
              lng: position.coords.longitude,
            },
          });
          setIsCapturingGeo(false);
        },
        (error) => {
          console.error("Geolocation error:", error);
          alert(
            "Não foi possível obter a localização. Verifique as permissões do GPS.",
          );
          setIsCapturingGeo(false);
        },
        { enableHighAccuracy: true, timeout: 10000 },
      );
    } else {
      alert("Geolocalização não suportada no seu dispositivo.");
      setIsCapturingGeo(false);
    }
  };

  const submitContract = async (e: React.FormEvent) => {
    e.preventDefault();
    if (contractLoading) return;
    setContractLoading(true);
    try {
      await addDoc(collection(db, "internal_contracts"), {
        ...contractFormData,
        driverId: user.uid,
        driverName: user.name,
        vehicleId: assignedVehicle
          ? `${assignedVehicle.prefix} (${assignedVehicle.plate})`
          : "N/A",
        createdAt: serverTimestamp(),
        status: "Pendente Ativação",
        paymentStatus: "Pendente",
        weeklyDays: ["Seg", "Ter", "Qua", "Qui", "Sex"], // Default
        monthlyValue: 0,
      });
      setIsContractModalOpen(false);
      setContractFormData({
        clientName: "",
        neighborhood: "",
        destination: "Trabalho",
        period: "Manhã",
        phone: "",
        notes: "",
        location: null,
      });
      alert("Contrato registado! Aguarde ativação da administração.");
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, "internal_contracts");
    } finally {
      setContractLoading(false);
    }
  };

  const handleStartShift = async () => {
    if (!isOnline) {
      setAiLoading(true);
      try {
        const checklist = await geminiService.getSafetyChecklist(assignedVehicle || { prefix: user.prefix });
        setSafetyChecklist(checklist);
        setShowSafetyCheck(true);
      } catch (err) {
        setIsOnline(true);
        localStorage.setItem("driver_is_online", "true");
        if (assignedVehicle?.id) {
          updateDoc(doc(db, "drivers", assignedVehicle.id), { status: "disponível" }).catch(e => console.warn(e));
        }
      } finally {
        setAiLoading(false);
      }
    } else {
      setIsOnline(false);
      localStorage.removeItem("driver_is_online");
      setCurrentService(null);
      setShowNotification(false);
      if (assignedVehicle?.id) {
        updateDoc(doc(db, "drivers", assignedVehicle.id), { status: "indisponível" }).catch(e => console.warn(e));
      }
    }
  };

  const confirmSafetyAndStart = () => {
    setIsOnline(true);
    localStorage.setItem("driver_is_online", "true");
    setShowSafetyCheck(false);
    if (assignedVehicle?.id) {
      updateDoc(doc(db, "drivers", assignedVehicle.id), { status: "disponível" }).catch(e => console.warn(e));
    }
  };

  const acceptService = async () => {
    if (!currentService) return;

    try {
      // Unblock UI immediately
      setShowNotification(false);
      setCurrentService({ ...currentService, status: "active", acceptedAt: new Date().toISOString() });
      
      if (currentService.id) {
        const callRef = doc(db, "calls", currentService.id);
        await updateDoc(callRef, {
          status: "active",
          acceptedAt: serverTimestamp(),
          responseHistory: arrayUnion({
            action: "accepted",
            timestamp: new Date().toISOString(),
            driverId: user?.uid || "unknown",
            driverName: user?.name || "Driver",
          }),
        });
      }

      if (assignedVehicle?.id) {
        await updateDoc(doc(db, "drivers", assignedVehicle.id), { status: "ocupado" });
      }
    } catch (error: any) {
      alert("Erro ao aceitar chamada no sistema: " + (error?.message || String(error)));
      console.error(error);
    }
  };

  const rejectService = async () => {
    if (!currentService) return;

    try {
      // Unblock UI immediately
      setShowNotification(false);
      const serviceId = currentService.id;
      if (serviceId) {
        hiddenCallIdsRef.current.push(serviceId);
      }
      setCurrentService(null);

      if (serviceId) {
        const callRef = doc(db, "calls", serviceId);
        await updateDoc(callRef, {
          status: "cancelled",
          cancelledAt: serverTimestamp(),
          responseHistory: arrayUnion({
            action: "rejected",
            timestamp: new Date().toISOString(),
            driverId: user?.uid || "unknown",
            driverName: user?.name || "Driver",
          }),
        });
      }

      if (assignedVehicle?.id) {
        await updateDoc(doc(db, "drivers", assignedVehicle.id), { status: "disponível" });
      }
    } catch (error: any) {
      alert("Erro ao recusar chamada no sistema: " + (error?.message || String(error)));
      console.error(error);
    }
  };

  const cancelService = async () => {
    if (!currentService) return;
    if (!window.confirm("Deseja mesmo cancelar esta corrida? O passageiro será notificado e a corrida será cancelada no sistema.")) return;

    try {
      // Unblock UI immediately
      setShowNotification(false);
      const serviceId = currentService.id;
      if (serviceId) {
        hiddenCallIdsRef.current.push(serviceId);
      }
      setCurrentService(null);

      if (serviceId) {
        const callRef = doc(db, "calls", serviceId);
        await updateDoc(callRef, {
          status: "cancelled",
          cancelledAt: serverTimestamp(),
          responseHistory: arrayUnion({
            action: "cancelled_by_driver",
            timestamp: new Date().toISOString(),
            driverId: user?.uid || "unknown",
            driverName: user?.name || "Driver",
          }),
        });
      }

      if (assignedVehicle?.id) {
        await updateDoc(doc(db, "drivers", assignedVehicle.id), { status: "disponível" });
      }
      alert("Corrida cancelada com sucesso!");
    } catch (error: any) {
      alert("Erro ao cancelar corrida: " + (error?.message || String(error)));
      console.error(error);
    }
  };

  const handleDriverArrived = async () => {
    if (!currentService?.id) return;
    try {
      const callRef = doc(db, "calls", currentService.id);
      await updateDoc(callRef, { status: "arrived" });
      alert("Passageiro notificado da sua chegada!");
    } catch (err) {
      console.error(err);
      alert("Erro ao notificar chegada.");
    }
  };

  const finishService = async () => {
    if (!currentService) return;

    try {
      // Unblock UI immediately
      const serviceId = currentService.id;
      if (serviceId) {
        hiddenCallIdsRef.current.push(serviceId);
      }
      setEarnings((prev) => prev + (currentService?.price || 0));
      setCurrentService(null);

      if (serviceId) {
        const callRef = doc(db, "calls", serviceId);
        await updateDoc(callRef, {
          status: "completed",
          completedAt: serverTimestamp(),
          responseHistory: arrayUnion({
            action: "completed",
            timestamp: new Date().toISOString(),
            driverId: user?.uid || "unknown",
            driverName: user?.name || "Driver",
          }),
        });
      }

      if (assignedVehicle?.id) {
        await updateDoc(doc(db, "drivers", assignedVehicle.id), { status: "disponível" });
      }
    } catch (error: any) {
      alert("Erro ao finalizar chamada no sistema: " + (error?.message || String(error)));
      console.error(error);
    }
  };

  const transferService = async (targetDriver: any) => {
    if (!currentService || !targetDriver) return;
    setTransferLoading(true);
    try {
      const callRef = doc(db, "calls", currentService.id);
      await updateDoc(callRef, {
        driverId: targetDriver.driverId || targetDriver.id,
        driverName: targetDriver.name,
        driverInfo: {
          name: targetDriver.name,
          phone: targetDriver.phone || targetDriver.phoneNumber || '',
          vehicleModel: targetDriver.vehicleModel || targetDriver.brand || 'Táxi PSM',
          vehiclePlate: targetDriver.vehiclePlate || targetDriver.licensePlate || ''
        },
        status: "pending",
        isForwarded: true,
        responseHistory: arrayUnion({
          action: "transferred",
          timestamp: new Date().toISOString(),
          fromId: user?.uid,
          fromName: user?.name,
          toId: targetDriver.driverId || targetDriver.id,
          toName: targetDriver.name,
        }),
      });
      setIsTransferModalOpen(false);
      setCurrentService(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `calls/${currentService.id}`);
    } finally {
      setTransferLoading(false);
    }
  };

  const sendDirectCallTransfer = async (targetDriver: any) => {
    if (!transferCustomerPhone || !targetDriver) return;
    setTransferLoading(true);
    console.log("DEBUG: Forwarding call to target driver:", targetDriver);
    try {
      const trimmedPhone = transferCustomerPhone.trim();
      const phoneWithPrefix = trimmedPhone.startsWith('+244') 
        ? trimmedPhone 
        : trimmedPhone.startsWith('244')
          ? `+${trimmedPhone}`
          : `+244 ${trimmedPhone}`;
      
      // Resolve the target colleague's Firebase Auth UID if possible by querying the 'users' collection using their registered name
      // ONLY resolve if we don't already have a valid driverId
      let resolvedDriverId = targetDriver.driverId || targetDriver.id;
      console.log("DEBUG: Initial resolvedDriverId:", resolvedDriverId);
      
      if (!resolvedDriverId) {
        try {
          const usersRef = collection(db, "users");
          const userQuery = query(usersRef, where("name", "==", targetDriver.name));
          const userDocs = await getDocs(userQuery);
          if (!userDocs.empty) {
            resolvedDriverId = userDocs.docs[0].id;
            console.log("DEBUG: Resolved Driver UID via users collection:", resolvedDriverId);
          } else {
              console.log("DEBUG: Could not resolve Driver UID via users collection by name:", targetDriver.name);
          }
        } catch (err) {
          console.warn("Failed to resolve target driver's user UID, falling back to driver document ID", err);
        }
      } else {
          console.log("DEBUG: Using existing driverId:", resolvedDriverId);
      }
      
      console.log("DEBUG: Final resolvedDriverId being used for call:", resolvedDriverId);

      if (currentService?.id) {
        // Re-routing/transferring an already active call
        const callRef = doc(db, "calls", currentService.id);
        await setDoc(callRef, {
          driverId: resolvedDriverId,
          driverName: targetDriver.name,
          driverPhone: targetDriver.phone || targetDriver.phoneNumber || '',
          vehiclePlate: targetDriver.vehiclePlate || targetDriver.plate || '',
          vehicleModel: targetDriver.vehicleModel || targetDriver.model || 'Táxi PSM',
          status: "pending", // Reset status back to pending so that it pops up for the new target driver!
          price: null, // Reset previous suggested price
          isForwarded: true,
          forwardedBy: {
            id: user?.uid,
            name: user?.name,
          }
        }, { merge: true });

        setCurrentService(null);
        setShowNotification(false);
        setTransferCustomerPhone("");
        setTransferCustomerName("");
        setTransferPickupAddress("");
        setIsNewCallTransferModalOpen(false);
        alert("Chamada reencaminhada com sucesso para o colega " + targetDriver.name + "!");
      } else {
        // Direct call creation
        await addDoc(collection(db, "calls"), {
          customerPhone: phoneWithPrefix,
          customerName: transferCustomerName || "Cliente Particular",
          pickupAddress: transferPickupAddress || "Chamada Direta Recebida por Telemóvel",
          destinationAddress: "A definir com o cliente",
          price: 0,
          timestamp: serverTimestamp(),
          driverId: resolvedDriverId,
          driverName: targetDriver.name,
          driverInfo: {
            name: targetDriver.name,
            phone: targetDriver.phone || targetDriver.phoneNumber || '',
            vehicleModel: targetDriver.vehicleModel || targetDriver.brand || 'Táxi PSM',
            vehiclePlate: targetDriver.vehiclePlate || targetDriver.licensePlate || ''
          },
          status: "pending",
          type: "direct_referral",
          isForwarded: true,
          transferredBy: {
            id: user?.uid,
            name: user?.name,
          }
        });
        
        setTransferCustomerPhone("");
        setTransferCustomerName("");
        setTransferPickupAddress("");
        setIsNewCallTransferModalOpen(false);
        alert("Contacto de cliente reencaminhado com sucesso para " + targetDriver.name + "!");
      }
    } catch (error) {
      handleFirestoreError(error, OperationType.ADD, "calls");
      alert("Erro ao reencaminhar contacto de cliente.");
    } finally {
      setTransferLoading(false);
    }
  };

  return (
    <div className="flex flex-col w-full h-screen h-[100dvh] bg-slate-50 relative overflow-hidden font-sans">
      {/* Non-scrollable header and status bar zone */}
      <div className="bg-slate-50 shrink-0 z-40 border-b border-slate-100">
        {/* Status Bar App Style */}
        <div className="px-6 py-2 flex items-center justify-between text-[11px] font-bold text-slate-400">
          <span>9:41</span>
          <div className="flex items-center gap-1.5">
            <Activity size={10} />
            <span>PSM Live</span>
          </div>
        </div>

        <header className="px-4 py-4 flex items-center justify-between bg-white">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-brand-primary/10 flex items-center justify-center border border-brand-primary/20">
                <Shield size={20} className="text-brand-primary" />
              </div>
              <div>
                <h4 className="text-[13px] font-black text-slate-800 leading-none">
                  PSM COMERCIAL
                </h4>
                <div className="flex items-center gap-1.5 mt-1">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                    Luena, Moxico
                  </span>
                  {stars >= 4.7 && (
                    <span className="bg-amber-100 text-amber-700 text-[8px] font-black px-1.5 py-0.5 rounded-full uppercase tracking-tighter border border-amber-200">
                      Top Rated
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="flex items-center gap-2 relative">
              <button 
                onClick={() => setIsMessagesModalOpen(true)}
                className="p-2 text-slate-400 hover:text-slate-600 transition-colors relative">
                <Bell size={20} />
                {unreadMessages.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white animate-pulse" />
                )}
              </button>
              <button
                onClick={() => setIsWhatsAppOpen(true)}
                className="p-2 text-slate-400 hover:text-emerald-600 transition-colors"
              >
                <MessageSquare size={20} />
              </button>

              <button
                onClick={() => setIsMenuOpen(!isMenuOpen)}
                className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <Menu size={20} />
              </button>

              <AnimatePresence>
                {isMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setIsMenuOpen(false)}
                    />
                    <motion.div
                      initial={{ opacity: 0, scale: 0.95, y: -10 }}
                      animate={{ opacity: 1, scale: 1, y: 0 }}
                      exit={{ opacity: 0, scale: 0.95, y: -10 }}
                      className="absolute top-full right-0 mt-2 w-48 bg-white rounded-xl shadow-xl border border-slate-100 py-2 z-50"
                    >
                      <div className="px-4 py-2 border-b border-slate-50 mb-1">
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          Utilizador
                        </p>
                        <p className="text-xs font-bold text-slate-800 truncate">
                          {user?.name}
                        </p>
                      </div>
                      <button
                        onClick={() => { setActiveInternalTab("settings"); setIsMenuOpen(false); }}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-slate-700 hover:bg-slate-50 transition-colors text-left"
                      >
                        <Settings size={14} />
                        Configurar Toque
                      </button>
                      <button
                        onClick={() => signOut(auth)}
                        className="w-full flex items-center gap-3 px-4 py-2.5 text-xs font-bold text-red-500 hover:bg-red-50 transition-colors text-left"
                      >
                        <Power size={14} />
                        Terminar Sessão
                      </button>
                    </motion.div>
                  </>
                )}
              </AnimatePresence>
            </div>
          </header>
        </div>

      <AnimatePresence>
        {isMessagesModalOpen && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
              onClick={() => setIsMessagesModalOpen(false)}
            />
            <motion.div
              initial={{ y: 300, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 300, opacity: 0 }}
              className="relative w-full bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] p-4 sm:p-6 space-y-4 sm:space-y-6 shadow-2xl z-20 flex flex-col h-[90%] max-h-[90vh] sm:max-w-full overflow-hidden"
            >
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <h2 className="text-xl font-black uppercase tracking-tighter">Mensagens ({unreadMessages.length})</h2>
                <button onClick={() => setIsMessagesModalOpen(false)} className="p-2 hover:bg-slate-100 rounded-full">
                  <X size={20} />
                </button>
              </div>
              <div className="flex-1 overflow-y-auto space-y-4 pr-2">
                {unreadMessages.length === 0 && <p className="text-center text-slate-400 py-10">Nenhuma mensagem nova.</p>}
                {unreadMessages.map((msg) => (
                  <div key={msg.id} className="bg-slate-50 p-4 rounded-2xl border border-slate-100 relative">
                    <p className="text-xs font-black text-slate-800 uppercase mb-1">{msg.subject || msg.title || "Notificação"}</p>
                    <p className="text-[11px] text-slate-600 leading-relaxed mb-2">{msg.content}</p>
                    <span className="block text-[9px] text-slate-400 font-bold uppercase">
                      {new Date(msg.timestamp?.seconds ? msg.timestamp.seconds * 1000 : msg.timestamp).toLocaleString()}
                    </span>
                    <button
                      onClick={() => markMessageAsRead(msg.id)}
                      className="absolute top-4 right-4 p-1.5 bg-white border border-slate-200 rounded-full hover:bg-slate-100 text-slate-400 hover:text-brand-primary transition-colors"
                      title="Marcar como lida"
                    >
                      <CheckCircle2 size={16} />
                    </button>
                    <button
                      onClick={() => {
                        setIsMessagesModalOpen(false);
                        setIsWhatsAppOpen(true);
                      }}
                      className="mt-3 w-full bg-slate-900 text-white rounded-xl py-2 text-[10px] uppercase font-black tracking-widest hover:bg-slate-800 transition-colors"
                    >
                      Responder
                    </button>
                  </div>
                ))}
              </div>
              <button 
                onClick={() => setIsMessagesModalOpen(false)}
                className="w-full bg-brand-primary text-white py-3 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all"
              >
                Fechar
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isWhatsAppOpen && (
          <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center p-0 sm:p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-slate-900/50 backdrop-blur-sm"
              onClick={() => setIsWhatsAppOpen(false)}
            />
            <motion.div
              initial={{ y: 300, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 300, opacity: 0 }}
              className="relative w-full bg-white rounded-t-[2.5rem] sm:rounded-[2.5rem] p-4 sm:p-6 space-y-4 sm:space-y-6 shadow-2xl z-20 flex flex-col h-[98%] max-h-[98vh] sm:max-w-full"
            >
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <h2 className="text-xl font-black uppercase tracking-tighter">Central WhatsApp</h2>
                <button onClick={() => setIsWhatsAppOpen(false)} className="p-2 hover:bg-slate-100 rounded-full">
                  <X size={20} />
                </button>
              </div>
              <WhatsAppMonitor isDriverView={true} isMechanicView={false} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      <main className="flex-1 overflow-y-auto custom-scrollbar px-4 sm:px-6 py-6 pb-28 space-y-6 w-full bg-slate-50">
            <AnimatePresence>
              {showSafetyCheck && (
                <motion.div 
                  initial={{ opacity: 0, scale: 0.9 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.9 }}
                  className="fixed inset-x-6 top-24 z-50 bg-white rounded-[2.5rem] border-4 border-slate-900 p-8 shadow-2xl"
                >
                  <div className="w-16 h-16 bg-brand-primary text-white rounded-3xl flex items-center justify-center mx-auto mb-6 shadow-xl shadow-brand-primary/20">
                    <Wrench size={32} />
                  </div>
                  <h3 className="text-lg font-black text-slate-900 text-center uppercase tracking-tighter italic mb-4">
                    Inspeção de Segurança IA
                  </h3>
                  <div className="bg-slate-50 p-6 rounded-2xl border border-slate-100 mb-8">
                     <p className="text-[12px] text-slate-600 font-bold leading-relaxed whitespace-pre-wrap italic">
                        {safetyChecklist || "Verifique os pneus, luzes e níveis de óleo antes de iniciar."}
                     </p>
                  </div>
                  <button 
                    onClick={confirmSafetyAndStart}
                    className="w-full bg-brand-primary text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all"
                  >
                    Confirmar e Iniciar Turno
                  </button>
                  <button 
                    onClick={() => setShowSafetyCheck(false)}
                    className="w-full mt-4 text-[10px] font-black text-slate-400 uppercase tracking-widest hover:text-slate-600"
                  >
                    Cancelar
                  </button>
                </motion.div>
              )}
            </AnimatePresence>

            {currentService ? (
              // INTERFACE ÚNICA DE INTERAÇÃO DO SERVIÇO (DEDICATED FULL SCREEN CALL UI)
              <div className="space-y-6 max-w-2xl mx-auto py-2">
                <div className="bg-slate-900 text-white rounded-[2.5rem] border-4 border-slate-950 p-6 sm:p-8 space-y-6 shadow-2xl overflow-hidden relative">
                  
                  {/* Decorative ambient GPS grid */}
                  <div className="absolute inset-0 opacity-5 bg-[linear-gradient(to_right,#80808012_1px,transparent_1px),linear-gradient(to_bottom,#80808012_1px,transparent_1px)] bg-[size:16px_16px] pointer-events-none" />

                  {/* Header Call state overlay */}
                  <div className="flex items-center justify-between border-b border-dashed border-white/10 pb-4 relative z-10">
                    <div className="flex items-center gap-2">
                      <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-ping shrink-0" />
                      <span className="text-[10px] font-black uppercase tracking-widest text-slate-400">
                        SISTEMA OPERACIONAL PSM
                      </span>
                    </div>
                    <span className={cn(
                      "px-3 py-1 font-black text-[9.5px] rounded-full uppercase tracking-widest text-center",
                      currentService.status === "pending" && "bg-amber-500 text-slate-950 animate-pulse",
                      currentService.status === "connected" && "bg-amber-400 text-slate-950 animate-pulse",
                      currentService.status === "price_sent" && "bg-blue-500 text-white",
                      currentService.status === "confirmed" && "bg-emerald-500 text-white",
                      currentService.status === "active" && "bg-emerald-500 text-white"
                    )}>
                      {currentService.status === "pending" && "📞 CHAMADA PENDENTE"}
                      {currentService.status === "connected" && "🎙️ VOZ ESTABELECIDA"}
                      {currentService.status === "price_sent" && "💬 PROPOSTA ENVIADA"}
                      {currentService.status === "confirmed" && "✨ PREÇO CONFIRMADO"}
                      {currentService.status === "active" && "🚀 VIAGEM EM CURSO"}
                    </span>
                  </div>

                  {/* Operational Status Display indicator */}
                  <div className="text-center space-y-2 relative z-10 py-2">
                    <div className="w-16 h-16 rounded-full bg-slate-950 border-2 border-brand-primary/20 text-brand-primary flex items-center justify-center mx-auto mb-2 relative">
                      <Phone size={24} className={cn(
                        currentService.status === "pending" && "animate-bounce text-amber-500",
                        currentService.status === "connected" && "animate-pulse text-emerald-400",
                        currentService.status === "price_sent" && "text-blue-400",
                        currentService.status === "confirmed" && "scale-110 text-emerald-400 animate-bounce",
                        currentService.status === "active" && "text-emerald-400 animate-pulse"
                      )} />
                    </div>
                    <h3 className="text-xl font-black tracking-tight uppercase leading-none text-white">
                      {currentService.status === "pending" && "Recebendo Pedido..."}
                      {currentService.status === "connected" && "Conversando em Tempo Real"}
                      {currentService.status === "price_sent" && "Aguardando Confirmação"}
                      {currentService.status === "confirmed" && "Embarque Autorizado"}
                      {currentService.status === "active" && "Viagem Selecionada"}
                    </h3>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                      {currentService.status === "active" ? "Viatura em Movimento no Luena" : "Negociação de Super Táxi"}
                    </p>
                  </div>

                   {/* Interactive GPS Router Map placeholder for Unique Interface */}
                  <div className="bg-slate-950/65 rounded-3xl overflow-hidden border border-white/5 shadow-inner relative h-36">
                    <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-slate-900 to-slate-950" />
                    <div className="absolute inset-x-0 bottom-2 text-center z-10">
                      <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-2">
                        Rota de Viagem em Direto
                      </p>
                    </div>

                    {/* High Density Grid pattern */}
                    <div className="absolute inset-0 opacity-10 pointer-events-none">
                      <svg width="100%" height="100%">
                        <pattern id="driver-grid-pat" width="15" height="15" patternUnits="userSpaceOnUse">
                          <path d="M 15 0 L 0 0 0 15" fill="none" stroke="currentColor" strokeWidth="0.5" className="text-blue-500" />
                        </pattern>
                        <rect width="100%" height="100%" fill="url(#driver-grid-pat)" />
                      </svg>
                    </div>

                    {/* Satellite tracking active status indicator (JIS) */}
                    <div className="absolute top-2.5 left-2.5 bg-black/85 px-2 py-0.5 rounded border border-white/10 text-[7.5px] font-black text-rose-400 uppercase tracking-widest flex items-center gap-1 animate-pulse z-10">
                      <div className="w-1 h-1 bg-rose-500 rounded-full animate-ping" />
                      Live GPS Sincro
                    </div>

                    {/* Match Passenger Bezier Path and animated car positioner */}
                    <svg className="absolute inset-0 w-full h-full text-brand-primary pointer-events-none opacity-60" viewBox="0 0 300 200">
                      <path d="M 50,150 Q 150,50 250,120" fill="none" stroke="#3b82f6" strokeWidth="3" strokeLinecap="round" strokeDasharray="5" />
                      <circle cx="50" cy="150" r="5" className="text-amber-500 fill-current animate-pulse" />
                      <circle cx="250" cy="120" r="5" className="text-emerald-500 fill-current" />
                      
                      <motion.g
                        initial={{ x: 50, y: 150 }}
                        animate={{
                          x: [50, 110, 150, 200, 250],
                          y: [150, 90, 75, 95, 120]
                        }}
                        transition={{
                          duration: 12,
                          repeat: Infinity,
                          ease: "easeInOut"
                        }}
                      >
                        <circle r="6" className="text-blue-400 fill-current shadow-lg animate-pulse" />
                        <polygon points="-2,-2 3,0 -2,2" fill="white" />
                      </motion.g>
                    </svg>
                  </div>

                  {/* Customer Block and Trip Info */}
                  <div className="space-y-4 bg-white/5 p-6 rounded-3xl border border-white/5 relative z-10">
                    <div className="flex items-center justify-between">
                      <span className="text-[9px] font-black text-slate-400 uppercase tracking-widest">
                        Passageiro / Nome
                      </span>
                      <span className="text-sm font-black text-white uppercase italic">
                        {currentService?.customerName || currentService?.passengerName || "Cliente Particular"}
                      </span>
                    </div>

                    <div className="pt-2 border-t border-white/5">
                      <p className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest mb-1">PONTO DE RECOLHA</p>
                      <p className="text-xs font-semibold text-slate-200 leading-tight">
                        {currentService?.pickupAddress || currentService?.pickup || "Luena Central"}
                      </p>
                    </div>

                    <div className="pt-2 border-t border-white/5">
                      <p className="text-[8.5px] font-black text-slate-400 uppercase tracking-widest mb-1">PONTO DE DESTINO</p>
                      <p className="text-xs font-semibold text-slate-200 leading-tight">
                        {currentService?.destinationAddress || currentService?.destination || "Bairro Kamanongue"}
                      </p>
                    </div>

                    {currentService.price && (
                      <div className="pt-2 border-t border-white/5 flex justify-between items-center">
                        <span className="text-[8.5px] font-black text-emerald-400 uppercase tracking-widest">Preço Definido</span>
                        <span className="text-base font-black text-emerald-400 font-mono">
                          {Number(currentService.price).toLocaleString()} Kz
                        </span>
                      </div>
                    )}

                    {currentService.boardingToken && (
                      <div className="pt-2 border-t border-white/5 flex justify-between items-center bg-emerald-950/20 px-3 py-2 rounded-xl border border-emerald-500/10">
                        <span className="text-[8.5px] font-black text-emerald-400 uppercase tracking-widest">TOKEN DE EMBARQUE:</span>
                        <span className="text-sm font-mono font-black text-emerald-400 tracking-wider">
                          {currentService.boardingToken}
                        </span>
                      </div>
                    )}
                  </div>

                  {/* Operational Controls by Status */}
                  <div className="space-y-4 pt-2 relative z-10 border-t border-dashed border-white/10">
                    {currentService.status === "pending" && (
                      <div className="flex gap-3">
                        <button
                          onClick={rejectService}
                          className="flex-1 py-4 bg-white/10 hover:bg-white/20 transition-all text-white border border-white/10 rounded-2xl font-black text-xs uppercase tracking-wider"
                        >
                          Rejeitar (15s)
                        </button>
                        <button
                          onClick={attendCall}
                          className="flex-[2] py-4 bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-black text-xs uppercase tracking-widest rounded-2xl shadow-xl shadow-emerald-500/10 flex items-center justify-center gap-2 animate-bounce"
                        >
                          <PhoneCall size={14} className="animate-bounce" />
                          Atender Chamada
                        </button>
                      </div>
                    )}

                    {currentService.status === "connected" && (
                      <div className="space-y-4">
                        <div className="bg-emerald-500/5 border border-emerald-500/20 p-4 rounded-2xl text-center">
                          <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Chamada Atendida (Conversão Estável)</p>
                          <p className="text-[9px] text-slate-400 mt-0.5 uppercase font-bold">Defina o valor da corrida ou recuse se necessário.</p>
                        </div>
                        <div className="space-y-3 bg-white/5 p-4 rounded-2xl border border-white/5">
                          <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest text-center">
                            Propor Preço da Viagem (AKZ)
                          </p>
                          <div className="flex gap-2 font-sans">
                            <input
                              type="number"
                              placeholder="Ex: 2500"
                              value={proposedPrice}
                              onChange={(e) => setProposedPrice(e.target.value)}
                              className="flex-1 bg-black text-white border border-white/10 rounded-xl px-4 py-3 text-sm font-black focus:outline-none focus:border-brand-primary"
                            />
                            <button
                              onClick={() => sendPriceOffer()}
                              className="px-6 py-3 bg-[#10b981] text-slate-950 font-black text-xs uppercase rounded-xl transition-all hover:bg-emerald-600 shadow-md font-sans"
                            >
                              PROPOR
                            </button>
                          </div>
                          <div className="flex gap-2 justify-between">
                            {[1500, 2000, 2500, 3000].map((val) => (
                              <button
                                key={val}
                                onClick={() => sendPriceOffer(val)}
                                className="flex-1 bg-white/5 hover:bg-white/10 border border-white/5 py-2 rounded-xl text-xs text-white font-black transition-all"
                              >
                                {val.toLocaleString()}
                              </button>
                            ))}
                          </div>
                        </div>
                        <button
                          onClick={rejectService}
                          className="w-full py-3 bg-red-650/15 hover:bg-red-600 text-white hover:text-white border border-red-500/20 rounded-2xl text-xs uppercase font-black tracking-widest transition-colors"
                        >
                          Cancelar Serviço
                        </button>
                      </div>
                    )}

                    {currentService.status === "price_sent" && (
                      <div className="space-y-4">
                        <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-2xl flex items-center justify-center gap-3">
                          <RefreshCw size={18} className="text-blue-400 animate-spin shrink-0" />
                          <div className="text-left leading-tight">
                            <p className="text-[10px] font-black text-blue-400 uppercase tracking-wider">
                              PROPOSTA ENVIADA COM SUCESSO
                            </p>
                            <p className="text-[9px] text-slate-400 uppercase mt-0.5 font-bold">
                              Aguardando aprovação de {currentService.price?.toLocaleString()} Kz pelo passageiro...
                            </p>
                          </div>
                        </div>
                        <button
                          onClick={rejectService}
                          className="w-full bg-slate-950 hover:bg-slate-900 border border-white/5 text-slate-400 py-3 rounded-2xl font-bold text-xs uppercase tracking-wider transition-all"
                        >
                          Cancelar Serviço
                        </button>
                      </div>
                    )}

                    {currentService.status === "confirmed" && (
                      <div className="space-y-4">
                        <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-2xl text-center space-y-1">
                          <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">
                            A CAMINHO DO PASSAGEIRO
                          </p>
                          <p className="text-[9px] text-slate-400 uppercase font-bold">
                            Desloque-se ao ponto de encontro acordado no Luena.
                          </p>
                        </div>
                        <button
                          onClick={handleDriverArrived}
                          className="w-full py-4 bg-amber-500 hover:bg-amber-600 transition-all text-slate-950 font-black text-xs uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-amber-500/20 active:scale-95"
                        >
                          <MapPin size={14} />
                          Cheguei ao Ponto de Recolha
                        </button>
                        <button
                          onClick={cancelService}
                          className="w-full py-3 bg-rose-600/15 hover:bg-rose-600 hover:text-white border border-rose-500/20 rounded-2xl text-xs uppercase font-black tracking-widest transition-colors flex items-center justify-center gap-1.5"
                        >
                          <XCircle size={14} />
                          Cancelar Serviço
                        </button>
                      </div>
                    )}

                    {currentService.status === "arrived" && (
                      <div className="space-y-4">
                        <div className="bg-emerald-500/10 border border-[#10b981]/30 p-4 rounded-2xl text-center space-y-1">
                          <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                            MOTORISTA NO LOCAL
                          </p>
                          <p className="text-[9px] text-slate-400 uppercase font-bold">
                            Passageiro notificado! Inicie a viagem quando ele embarcar.
                          </p>
                        </div>
                        <button
                          onClick={acceptService}
                          className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl shadow-emerald-500/30 flex items-center justify-center gap-2 animate-bounce"
                        >
                          <PhoneCall size={14} />
                          INICIAR CORRIDA ACORDADA ({currentService.price?.toLocaleString()} Kz)
                        </button>
                        <button
                          onClick={cancelService}
                          className="w-full py-3 bg-rose-600/15 hover:bg-rose-600 hover:text-white border border-rose-500/20 rounded-2xl text-xs uppercase font-black tracking-widest transition-colors flex items-center justify-center gap-1.5"
                        >
                          <XCircle size={14} />
                          Cancelar Serviço
                        </button>
                      </div>
                    )}

                    {currentService.status === "active" && (
                      <div className="space-y-4">
                        <div className="bg-[#10b981]/15 p-4 rounded-2xl border border-emerald-500/30 text-center">
                          <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest animate-pulse">VIAGEM DE SUPER TÁXI ATIVA</p>
                          <p className="text-[9px] text-slate-400 uppercase mt-0.5 font-bold">Conduza com segurança pelas estradas do Luena-Moxico.</p>
                        </div>
                        <button
                          onClick={finishService}
                          className="w-full py-4 bg-emerald-500 hover:bg-[#059669] transition-all text-slate-950 font-black text-xs uppercase tracking-widest rounded-2xl flex items-center justify-center gap-2 shadow-xl shadow-emerald-500/30 active:scale-95 animate-pulse"
                        >
                          <CheckCircle2 size={14} />
                          Encerrar Viagem & Carregar Renda ({currentService.price?.toLocaleString()} Kz)
                        </button>
                        <button
                          onClick={cancelService}
                          className="w-full py-3 bg-rose-600/15 hover:bg-rose-600 hover:text-white border border-rose-500/20 rounded-2xl text-xs uppercase font-black tracking-widest transition-colors flex items-center justify-center gap-1.5"
                        >
                          <XCircle size={14} />
                          Cancelar Serviço
                        </button>
                      </div>
                    )}
                  </div>

                  {/* COMMUNICATIVE INTERACTION ACCORDING TO USER REQUIREMENT:
                      "e remove os botoes (Ligar Cliente Chat (APP)) esses botoes so aparece se o cliente sair da linha/offline." */}
                  <div className="pt-4 border-t border-dashed border-white/10 space-y-3 relative z-10">
                    
                    {/* Simulator switch to mock offline passenger for easy verification */}
                    <div className="flex items-center justify-between bg-white/5 p-3 rounded-2xl border border-white/5">
                      <div className="text-left">
                        <p className="text-[9px] font-black text-slate-300 uppercase tracking-wide">
                          Simulador de Estado (Linha Web-Call)
                        </p>
                        <p className="text-[8px] text-slate-400 uppercase font-black">
                          { (currentService.status === "active" || localPassengerOffline || currentService.passengerOffline) 
                            ? "🔴 Passageiro saiu da linha / offline" 
                            : "🟢 Passageiro na linha / online"
                          }
                        </p>
                      </div>
                      <label className="relative inline-flex items-center cursor-pointer">
                        <input 
                          type="checkbox" 
                          checked={localPassengerOffline}
                          onChange={(e) => setLocalPassengerOffline(e.target.checked)}
                          className="sr-only peer" 
                        />
                        <div className="w-11 h-6 bg-slate-700 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:width-5 after:transition-all peer-checked:bg-emerald-500"></div>
                      </label>
                    </div>

                    {(currentService.status === "active" || localPassengerOffline || currentService.passengerOffline) ? (
                      <div className="space-y-2.5 animate-fade-in">
                        <div className="bg-rose-500/10 border border-rose-500/20 p-3.5 rounded-2xl text-center">
                          <span className="text-[10px] font-black text-rose-400 uppercase tracking-widest block mb-0.5">⚠️ Passageiro Desconectado / Offline</span>
                          <span className="text-[8.5px] text-slate-300 uppercase tracking-wider block font-bold">O passageiro saiu da linha ou está sem internet. Use os botões abaixo para ligar normal ou enviar chat tradicional.</span>
                        </div>
                        <div className="grid grid-cols-2 gap-3 font-sans">
                          <button 
                            onClick={() => {
                              if (currentService.customerPhone || currentService.passengerPhone) {
                                window.open(`tel:${currentService.customerPhone || currentService.passengerPhone}`, '_self');
                              } else {
                                alert("Cliente não tem número de telemóvel associado.");
                              }
                            }}
                            className="flex items-center justify-center gap-2 bg-white text-slate-800 p-3.5 rounded-2xl transition-all hover:bg-slate-100 font-extrabold text-[10.5px] uppercase tracking-wider"
                          >
                            <Phone size={14} className="text-blue-600 animate-pulse" />
                            Ligar Cliente
                          </button>
                          <button 
                            onClick={async () => {
                              setIsMessagesModalOpen(true);
                            }}
                            className="flex items-center justify-center gap-2 bg-white text-slate-800 p-3.5 rounded-2xl transition-all hover:bg-slate-100 font-extrabold text-[10.5px] uppercase tracking-wider"
                          >
                            <MessageSquare size={14} className="text-emerald-500 animate-pulse" />
                            Chat (APP)
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="bg-emerald-500/10 border border-emerald-500/20 p-3 rounded-2xl text-center">
                        <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest block">🎙️ Comunicação de Voz Ativa Dedicada</span>
                        <span className="text-[8px] text-slate-400 uppercase tracking-wider block font-bold mt-0.5">Fale diretamente com o cliente. Canais de emergência ocultos até o cliente desligar ou ficar offline.</span>
                      </div>
                    )}
                  </div>

                </div>
              </div>
            ) : activeInternalTab === "dashboard" ? (
              <div className="space-y-4">

                {/* Warning Cards for Pending Items (Previous Shift Focus) - Consolidated Collapsible Alert Center */}
                {((!loadingShiftCheck && lastAssignedShift && (!lastShiftRevenueSubmitted || lastShiftPendingContracts > 0)) || rejectedRevenues.length > 0) ? (
                  <div className="bg-rose-50 border border-rose-200/60 rounded-2xl p-4 shadow-sm">
                    <div 
                      onClick={() => setIsAlertsCollapsed(!isAlertsCollapsed)}
                      className="flex items-center justify-between cursor-pointer"
                    >
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-xl bg-rose-500/10 text-rose-600 flex items-center justify-center animate-pulse">
                          <AlertTriangle size={16} />
                        </div>
                        <div className="text-left">
                          <span className="text-xs font-black text-rose-800 uppercase tracking-tight">
                            Pendências ({(!lastShiftRevenueSubmitted ? 1 : 0) + (lastShiftPendingContracts > 0 ? 1 : 0) + rejectedRevenues.length})
                          </span>
                          <p className="text-[9px] text-rose-600/75 uppercase tracking-wide">Toque para ver e regularizar</p>
                        </div>
                      </div>
                      <div className="text-rose-500">
                        {isAlertsCollapsed ? <ChevronDown size={18} /> : <ChevronUp size={18} />}
                      </div>
                    </div>

                    {!isAlertsCollapsed && (
                      <div className="mt-4 space-y-3 pt-3 border-t border-rose-100">
                        {/* Revenue Warning for past shift */}
                        {!lastShiftRevenueSubmitted && lastAssignedShift && (
                          <div className="bg-white p-3 border border-red-100 rounded-xl flex items-center justify-between shadow-sm">
                            <div className="flex items-center gap-2">
                              <Wallet size={16} className="text-red-500" />
                              <div className="text-left">
                                <p className="text-[10px] font-black text-red-700 uppercase">Falta Declarar Renda</p>
                                <p className="text-[8px] text-red-600 font-bold uppercase">
                                  Dia {format(new Date(lastAssignedShift.date + "T12:00:00"), "dd/MM")}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => { setActiveInternalTab("rendas"); setIsAlertsCollapsed(true); }}
                              className="bg-red-600 text-white px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest shadow-md shadow-red-200"
                            >
                              Declarar
                            </button>
                          </div>
                        )}

                        {/* Contract Warning for past shift */}
                        {lastShiftPendingContracts > 0 && lastAssignedShift && (
                          <div className="bg-white p-3 border border-amber-100 rounded-xl flex items-center justify-between shadow-sm">
                            <div className="flex items-center gap-2">
                              <Users size={16} className="text-amber-500" />
                              <div className="text-left">
                                <p className="text-[10px] font-black text-slate-700 uppercase">Pendente de Roteiro</p>
                                <p className="text-[8px] text-slate-500 font-bold uppercase">
                                  Faltou {lastShiftPendingContracts} passageiros no dia {format(new Date(lastAssignedShift.date + "T12:00:00"), "dd/MM")}
                                </p>
                              </div>
                            </div>
                            <button
                              onClick={() => {
                                setActiveInternalTab("contracts");
                                setViewContractsDate(lastAssignedShift.date);
                                setViewContractsPrefix(lastAssignedShift.prefix);
                                setIsAlertsCollapsed(true);
                              }}
                              className="text-[9px] font-black text-brand-primary uppercase underline"
                            >
                              Verificar
                            </button>
                          </div>
                        )}

                        {/* Rejected Revenues Warning */}
                        {rejectedRevenues.map((rev) => (
                          <div
                            key={`rejected-${rev.id}`}
                            className="bg-white p-3 border-2 border-rose-200 rounded-xl flex flex-col gap-2 shadow-sm text-left"
                          >
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                <AlertTriangle size={16} className="text-rose-500" />
                                <span className="text-[10px] font-black text-rose-700 uppercase tracking-tight">Renda Recusada ({rev.date})</span>
                              </div>
                              <button 
                                onClick={() => {
                                  setEditingRevenueId(rev.id);
                                  setRevenueDetails({
                                    tpa: rev.breakdown?.tpa?.toString() || "",
                                    cash: rev.breakdown?.cash?.toString() || "",
                                    transfer: rev.breakdown?.transfer?.toString() || "",
                                    expenses: rev.breakdown?.expenses?.toString() || "",
                                    description: rev.description || "",
                                  });
                                  setActiveInternalTab("rendas");
                                  setIsAlertsCollapsed(true);
                                }}
                                className="px-2.5 py-1 bg-rose-600 text-white rounded text-[8px] font-black uppercase tracking-wider"
                              >
                                Corrigir
                              </button>
                            </div>
                            {rev.rejectionReason && (
                              <p className="text-[9px] text-slate-600 italic bg-rose-50 p-2 rounded border border-rose-100/50">
                                "{rev.rejectionReason}"
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ) : (
                  /* Today Status Reminder (Subtle inline text to save full box space) */
                  !todayRevenueSubmitted && lastShiftRevenueSubmitted && (
                    <div className="bg-amber-50/50 border border-amber-200/50 p-3 rounded-2xl flex items-center gap-2.5 shadow-sm">
                      <Clock size={14} className="text-amber-500 animate-pulse flex-shrink-0" />
                      <span className="text-[9px] text-amber-700 font-bold uppercase tracking-wide text-left">
                        Lembrete: Declarar a renda de hoje ao encerrar o seu turno.
                      </span>
                    </div>
                  )
                )}

                {/* Unified Cabine de Controlo Card (Shift Control, Rating, Earnings & SOS) */}
                <div className="bg-slate-950 border border-slate-800 text-white rounded-[2rem] p-5 shadow-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-brand-primary/10 blur-3xl rounded-full" />
                  
                  {/* Title & Status indicator */}
                  <div className="flex items-center justify-between mb-4 border-b border-slate-800 pb-3">
                    <div className="text-left">
                      <span className="text-[8px] font-black text-slate-500 uppercase tracking-[0.2em]">Cabine de Comando</span>
                      <h3 className="text-sm font-black tracking-tight text-white leading-none mt-1 uppercase">
                        {user?.name || "Mestre PSM"}
                      </h3>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={cn(
                        "w-2 h-2 rounded-full",
                        isOnline ? "bg-emerald-500 animate-pulse" : "bg-slate-500"
                      )} />
                      <span className="text-[10px] font-black uppercase tracking-wider text-slate-300">
                        {isOnline ? "Em Serviço" : "Fora de Serviço"}
                      </span>
                    </div>
                  </div>

                  {/* Rating & Ganhos high density row */}
                  <div className="grid grid-cols-2 gap-3.5 my-1">
                    <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-amber-500/10 text-amber-500 flex items-center justify-center flex-shrink-0">
                        <Star size={16} fill="currentColor" />
                      </div>
                      <div className="text-left">
                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none">Avaliação</p>
                        <p className="text-[13px] font-black text-white mt-0.5">{stars}</p>
                      </div>
                    </div>
                    
                    <div className="bg-slate-900 border border-slate-800 p-3 rounded-2xl flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-xl bg-emerald-500/10 text-emerald-400 flex items-center justify-center flex-shrink-0">
                        <DollarSign size={16} />
                      </div>
                      <div className="text-left">
                        <p className="text-[8px] font-black text-slate-500 uppercase tracking-widest leading-none">Ganhos (AKZ)</p>
                        <p className="text-[13px] font-black text-white mt-0.5">{(earnings || 0).toLocaleString()}</p>
                      </div>
                    </div>
                  </div>

                  {/* Shift Action Toggle / Service Control and Emergency Button */}
                  <div className="flex items-center gap-3 mt-4 pt-3 border-t border-slate-800">
                    {currentService && currentService.status === "pending" ? (
                      <>
                        <button
                          onClick={acceptService}
                          className="flex-1 py-3 px-4 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 shadow-lg bg-emerald-500 hover:bg-emerald-600 text-white shadow-emerald-500/20 active:scale-95 animate-pulse"
                        >
                          <PhoneCall size={13} className="animate-bounce" />
                          ATENDER CHAMADA
                        </button>

                        <button
                          onClick={rejectService}
                          className="w-12 h-12 rounded-xl flex items-center justify-center transition-all bg-rose-600 hover:bg-rose-700 text-white shadow-lg active:scale-95 flex-shrink-0 border border-rose-500/30 animate-pulse"
                          title="Recusar Chamada"
                        >
                          <XCircle size={18} />
                        </button>
                      </>
                    ) : (
                      <>
                        <button
                          onClick={handleStartShift}
                          className={cn(
                            "flex-1 py-3 px-4 rounded-xl font-black text-[10px] uppercase tracking-widest transition-all duration-300 flex items-center justify-center gap-2 shadow-lg",
                            isOnline 
                              ? "bg-emerald-600 text-white shadow-emerald-950/20 active:bg-emerald-700" 
                              : "bg-white text-slate-950 shadow-black/20 active:bg-slate-100"
                          )}
                        >
                          <Power size={13} />
                          {isOnline ? "Terminar Turno" : "Iniciar Turno"}
                        </button>

                        <button
                          onClick={triggerPanic}
                          disabled={panicLoading}
                          className="w-12 h-12 rounded-xl flex items-center justify-center transition-all bg-red-650 hover:bg-red-700 text-white shadow-lg active:scale-90 flex-shrink-0 animate-pulse border border-red-500/30"
                          title="S.O.S de Emergência"
                        >
                          <AlertTriangle size={18} />
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Reencaminhar Chamada de cliente direta */}
                {isOnline && (
                  <motion.button
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    onClick={() => {
                      setTransferCustomerPhone("");
                      setTransferCustomerName("");
                      setTransferPickupAddress("");
                      setIsNewCallTransferModalOpen(true);
                    }}
                    className="w-full flex items-center justify-center gap-2 bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white font-black py-3.5 px-4 rounded-2xl text-[10px] uppercase tracking-wider transition-all shadow-md active:scale-95"
                  >
                    <PhoneIncoming size={14} className="animate-pulse" />
                    Reencaminhar Chamada Direta
                  </motion.button>
                )}

                {/* Collapsible Mentor IA Coaching Card */}
                <div className="bg-white border border-slate-200/60 rounded-2xl p-4 shadow-sm transition-all hover:border-brand-primary/30">
                  <div 
                    onClick={() => setIsAiAdviceExpanded(!isAiAdviceExpanded)}
                    className="flex items-center justify-between cursor-pointer"
                  >
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 bg-brand-primary/10 rounded-xl flex items-center justify-center text-brand-primary flex-shrink-0">
                        <Zap size={15} fill="currentColor" />
                      </div>
                      <div className="text-left">
                        <span className="text-xs font-black text-slate-800 uppercase tracking-tight">Dicas do Mentor IA</span>
                        <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider">Análise de Rendimento Gemini</p>
                      </div>
                    </div>
                    <div className="text-slate-400">
                      {isAiAdviceExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                    </div>
                  </div>

                  {isAiAdviceExpanded && (
                    <div className="mt-3 pt-3 border-t border-slate-100 space-y-3">
                      <div className="bg-slate-50 rounded-xl p-3 border border-slate-100 text-left">
                        {aiLoading ? (
                          <div className="space-y-2 animate-pulse py-1">
                            <div className="h-2 w-3/4 bg-slate-200 rounded" />
                            <div className="h-2 w-full bg-slate-200 rounded" />
                          </div>
                        ) : (
                          <p className="text-[11px] text-slate-600 font-medium italic leading-relaxed whitespace-pre-line">
                            {aiAdvice || "A calcular melhor estratégia para o seu roteiro hoje no Luena..."}
                          </p>
                        )}
                      </div>
                      <div className="flex items-center justify-between text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">
                        <span>AUDITORIA CONTÍNUA • GEMINI 1.5</span>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            fetchAiAdvice();
                          }}
                          disabled={aiLoading}
                          className="text-brand-primary font-black uppercase tracking-widest flex items-center gap-1 bg-brand-primary/5 hover:bg-brand-primary/10 px-2 py-1 rounded transition-colors"
                        >
                          {aiLoading ? <Loader2 size={8} className="animate-spin" /> : <RefreshCw size={8} />}
                          Atualizar
                        </button>
                      </div>
                    </div>
                  )}
                </div>

                  {/* Current Ride / Map Placeholder */}
                  {(isOnline || currentService) && (
                    <div className="bg-white rounded-[2rem] border border-slate-200 overflow-hidden shadow-sm">
                      <div className="h-48 bg-slate-100 relative group overflow-hidden">
                        {/* Fake Map */}
                        <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,_var(--tw-gradient-stops))] from-blue-100 to-indigo-50" />
                        <div className="absolute inset-0 opacity-20 bg-[url('https://picsum.photos/seed/map/400/400')] bg-cover" />

                        {currentService ? (
                          <div className="absolute inset-0 flex items-center justify-center">
                            <div className="relative">
                              <motion.div
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                className="bg-brand-primary text-white p-3 rounded-2xl shadow-xl z-10 relative"
                              >
                                <Navigation size={24} className="rotate-45" />
                              </motion.div>
                              <div className="absolute inset-x-0 top-full h-20 w-1 bg-gradient-to-b from-brand-primary to-transparent mx-auto mt-1" />
                            </div>
                          </div>
                        ) : (
                          <div className="absolute inset-0 flex items-center justify-center p-8 text-center">
                            <div>
                              <MapPin
                                size={32}
                                className="text-slate-300 mx-auto mb-2"
                              />
                              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-widest leading-normal">
                                A aguardar por
                                <br />
                                serviços da central...
                              </p>
                            </div>
                          </div>
                        )}
                      </div>

                      {currentService && (
                        <div className={cn(
                          "p-6 space-y-5 border-t border-slate-200 dark:border-white/10 rounded-2xl transition-all duration-500",
                          currentService.status === "pending" && "border-amber-500/40 bg-slate-900 text-white shadow-xl shadow-amber-500/5",
                          currentService.status === "connected" && "border-amber-500/40 bg-slate-900 text-white shadow-xl shadow-amber-500/5",
                          currentService.status === "price_sent" && "border-blue-500/40 bg-slate-900 text-white shadow-xl",
                          currentService.status === "confirmed" && "border-emerald-500/40 bg-slate-900 text-white shadow-xl shadow-emerald-500/10 animate-pulse",
                          currentService.status === "active" && "border-emerald-500/40 bg-slate-900 text-white shadow-xl"
                        )}>
                          
                          {/* Header Call state */}
                          <div className="flex items-center justify-between border-b border-dashed border-white/10 pb-3">
                            <span className={cn(
                              "px-2.5 py-1 font-black text-[9px] rounded-lg uppercase tracking-wider",
                              currentService.status === "pending" && "bg-amber-500 text-slate-950 animate-pulse",
                              currentService.status === "connected" && "bg-amber-500 text-slate-950 animate-pulse",
                              currentService.status === "price_sent" && "bg-blue-500 text-white",
                              currentService.status === "confirmed" && "bg-emerald-500 text-white",
                              currentService.status === "active" && "bg-emerald-500 text-white"
                            )}>
                              {currentService.status === "pending" && "📞 CHAMADA RECEBIDA (PENDENTE)"}
                              {currentService.status === "connected" && "📞 TELEFONEMA ESTABELECIDO"}
                              {currentService.status === "price_sent" && "💬 PROPOSTA ENVIADA"}
                              {currentService.status === "confirmed" && "✨ PREÇO CONFIRMADO!"}
                              {currentService.status === "active" && "🚀 VIAGEM EM ANDAMENTO"}
                            </span>
                            <div className="flex items-center gap-1.5">
                              <span className="relative flex h-2.5 w-2.5">
                                <span className={cn(
                                  "animate-ping absolute inline-flex h-full w-full rounded-full opacity-75",
                                  ["confirmed", "active"].includes(currentService.status) ? "bg-emerald-400" : "bg-amber-400"
                                )}></span>
                                <span className={cn(
                                  "relative inline-flex rounded-full h-2.5 w-2.5",
                                  ["confirmed", "active"].includes(currentService.status) ? "bg-emerald-500" : "bg-amber-500"
                                )}></span>
                              </span>
                              <span className="text-[10px] font-mono font-black text-slate-400 uppercase tracking-widest">
                                SIMULAÇÃO DOCK ACTIVE
                              </span>
                            </div>
                          </div>

                          {/* Passenger and Service details */}
                          <div className="text-xs space-y-2.5 bg-white/5 p-4 rounded-xl border border-white/5">
                            <div className="flex justify-between border-b border-white/5 pb-1.5">
                              <span className="text-slate-400 uppercase font-black text-[9px]">Passageiro:</span>
                              <span className="text-white font-black">
                                {currentService.customerName || currentService.passengerName || "Passageiro de Teste"}
                              </span>
                            </div>
                            <div className="flex justify-between border-b border-white/5 pb-1.5 col-span-2">
                              <span className="text-slate-400 uppercase font-black text-[9px]">Contacto:</span>
                              <span className="text-white font-mono font-bold">
                                {currentService.customerPhone || currentService.passengerPhone || "+244 9XX XXX XXX"}
                              </span>
                            </div>
                            <div className="flex justify-between border-b border-white/5 pb-1.5">
                              <span className="text-slate-400 uppercase font-black text-[9px]">Partida (Moxico):</span>
                              <span className="text-white font-extrabold truncate max-w-[180px]">
                                {currentService.pickupAddress || currentService.pickup || "Luena Central"}
                              </span>
                            </div>
                            <div className="flex justify-between border-b border-white/5 pb-1.5">
                              <span className="text-slate-400 uppercase font-black text-[9px]">Destino Final:</span>
                              <span className="text-white font-extrabold truncate max-w-[180px]">
                                {currentService.destinationAddress || currentService.destination || "Bairro Kamanongue"}
                              </span>
                            </div>
                            
                            {currentService.price && (
                              <div className="flex justify-between border-b border-white/5 pb-1.5">
                                <span className="text-emerald-400 uppercase font-black text-[9px]">Valor Oferecido:</span>
                                <span className="text-emerald-400 font-black text-sm font-mono leading-none">
                                  {Number(currentService.price).toLocaleString()} Kz
                                </span>
                              </div>
                            )}

                            {currentService.boardingToken && (
                              <div className="flex justify-between bg-emerald-500/10 p-2.5 rounded-lg border border-emerald-500/20 items-center">
                                <span className="text-emerald-400 uppercase font-black text-[8px] tracking-wider">Código de Embarque (Segurança):</span>
                                <span className="text-emerald-400 font-mono font-black text-sm tracking-widest">{currentService.boardingToken}</span>
                              </div>
                            )}
                          </div>

                          {/* Call state actions - Simulation style */}
                          <div className="space-y-3.5 pt-1">
                            
                            {/* PENDING State: Calling... */}
                            {currentService.status === "pending" && (
                              <div className="space-y-4">
                                <div className="bg-amber-500/10 p-4 rounded-xl border border-amber-500/20 flex flex-col items-center text-center gap-1">
                                  <PhoneCall size={20} className="text-amber-500 animate-bounce" />
                                  <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest">
                                    Telemóvel do Motorista a Tocar!
                                  </p>
                                  <p className="text-[8.5px] text-slate-400 uppercase tracking-wider">
                                    Atenda a chamada para estabelecer conversação ou envie o preço directamente.
                                  </p>
                                </div>

                                <div className="flex gap-2">
                                  <button
                                    onClick={rejectService}
                                    className="flex-1 py-3 px-4 bg-rose-600/20 hover:bg-rose-600 transition-colors text-white hover:text-white border border-rose-500/30 rounded-xl font-black text-[10px] uppercase tracking-wider"
                                  >
                                    Recusar
                                  </button>
                                  <button
                                    onClick={attendCall}
                                    className="flex-[2] py-3 px-4 bg-emerald-500 hover:bg-emerald-600 transition-all text-slate-950 font-black text-[10px] uppercase tracking-widest rounded-xl shadow-lg shadow-emerald-500/20 flex items-center justify-center gap-1.5 animate-pulse"
                                  >
                                    <PhoneCall size={12} className="animate-bounce" />
                                    Atender Chamada
                                  </button>
                                </div>
                              </div>
                            )}

                            {/* CONNECTED state: established, can offer price */}
                            {(currentService.status === "connected") && (
                              <div className="space-y-3">
                                <div className="bg-emerald-500/10 p-4 rounded-xl border border-emerald-500/20 text-center space-y-1">
                                  <div className="flex items-center justify-center gap-2">
                                    <span className="w-1.5 h-1.5 bg-emerald-500 rounded-full animate-ping" />
                                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Telefonema Estabelecido (Voz Ativa)</span>
                                  </div>
                                  <p className="text-[8.5px] text-slate-400 uppercase">Proponha o valor adequado para esta viagem abaixo.</p>
                                </div>

                                <div className="space-y-3 bg-white/5 p-4 rounded-xl border border-white/5">
                                  <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest text-center">
                                    Propor Preço da Viagem (AKZ)
                                  </p>
                                  <div className="flex gap-2">
                                    <input
                                      type="number"
                                      placeholder="Ex: 2500"
                                      value={proposedPrice}
                                      onChange={(e) => setProposedPrice(e.target.value)}
                                      className="flex-1 bg-black text-white border border-white/10 rounded-lg px-3 py-2 text-xs font-black focus:outline-none focus:border-brand-primary"
                                    />
                                    <button
                                      onClick={() => sendPriceOffer()}
                                      className="px-5 py-2 bg-[#10b981] text-slate-950 font-black text-[10px] uppercase rounded-lg transition-all hover:bg-emerald-600"
                                    >
                                      Propor
                                    </button>
                                  </div>
                                  <div className="flex gap-1.5 justify-between">
                                    {[1500, 2000, 2500, 3000].map((val) => (
                                      <button
                                        key={val}
                                        onClick={() => sendPriceOffer(val)}
                                        className="flex-1 bg-white/5 hover:bg-white/10 border border-white/5 py-1.5 rounded-lg text-[9px] text-white font-black transition-all"
                                      >
                                        {val.toLocaleString()}
                                      </button>
                                    ))}
                                  </div>
                                </div>

                                <button
                                  onClick={rejectService}
                                  className="w-full py-2.5 bg-slate-950 hover:bg-slate-900 text-slate-400 hover:text-white border border-white/5 rounded-xl text-[9px] uppercase font-bold tracking-wider transition-colors"
                                >
                                  Cancelar Serviço
                                </button>
                              </div>
                            )}

                            {/* PRICE SENT state: Waiting for passenger approval */}
                            {currentService.status === "price_sent" && (
                              <div className="space-y-3">
                                <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl flex items-center justify-center gap-3">
                                  <RefreshCw size={15} className="text-blue-400 animate-spin shrink-0" />
                                  <div className="text-left leading-tight">
                                    <p className="text-[10px] font-black text-blue-400 uppercase tracking-wider">
                                      Proposta de Preço Enviada
                                    </p>
                                    <p className="text-[8.5px] text-slate-400 uppercase mt-0.5">
                                      A aguardar que o passageiro aprove os {currentService.price?.toLocaleString()} Kz...
                                    </p>
                                  </div>
                                </div>
                                <button
                                  onClick={rejectService}
                                  className="w-full bg-slate-950 hover:bg-slate-900 border border-white/5 text-slate-400 py-3 rounded-xl font-bold text-[10px] uppercase tracking-wider transition-all"
                                >
                                  Cancelar Serviço
                                </button>
                              </div>
                            )}

                            {/* CONFIRMED state: Driver heading to pickup */}
                            {currentService.status === "confirmed" && (
                              <div className="space-y-3">
                                <div className="bg-blue-500/10 border border-blue-500/20 p-4 rounded-xl flex flex-col items-center text-center gap-1">
                                  <p className="text-[10px] font-black text-blue-400 uppercase tracking-widest">
                                    A CAMINHO DO PASSAGEIRO
                                  </p>
                                  <p className="text-[8.5px] text-slate-400 uppercase">
                                    Desloque-se ao ponto de encontro acordado no Luena.
                                  </p>
                                </div>
                                <button
                                  onClick={handleDriverArrived}
                                  className="w-full py-4 bg-amber-500 hover:bg-amber-600 transition-all text-slate-950 font-black text-[11px] uppercase tracking-widest rounded-xl flex items-center justify-center gap-1.5 shadow-lg shadow-amber-500/20 active:scale-95"
                                >
                                  <MapPin size={12} />
                                  Cheguei ao Ponto de Recolha
                                </button>
                                <button
                                  onClick={cancelService}
                                  className="w-full py-2.5 bg-rose-600/15 hover:bg-rose-600 text-white border border-rose-500/20 rounded-xl text-[10px] uppercase font-black tracking-widest transition-colors flex items-center justify-center gap-1"
                                >
                                  <XCircle size={12} />
                                  Cancelar Serviço
                                </button>
                              </div>
                            )}

                            {/* ARRIVED state: Driver at pickup waiting for passenger */}
                            {currentService.status === "arrived" && (
                              <div className="space-y-3">
                                <div className="bg-emerald-500/10 border border-[#10b981]/30 p-4 rounded-xl flex flex-col items-center text-center gap-1">
                                  <div className="w-1.5 h-1.5 bg-[#10b981] rounded-full animate-ping" />
                                  <p className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">
                                    MOTORISTA NO LOCAL
                                  </p>
                                  <p className="text-[8.5px] text-slate-400 uppercase">
                                    O preço de {currentService.price?.toLocaleString()} Kz foi acordado. Inicie a viagem quando o passageiro embarcar.
                                  </p>
                                </div>
                                <button
                                  onClick={acceptService}
                                  className="w-full bg-emerald-500 hover:bg-emerald-600 text-slate-950 py-4 rounded-xl font-black text-[11px] uppercase tracking-widest transition-all shadow-lg shadow-emerald-500/30 flex items-center justify-center gap-1.5 animate-pulse"
                                >
                                  <PhoneCall size={12} />
                                  INICIAR CORRIDA ACORDADA ({currentService.price?.toLocaleString()} Kz)
                                </button>
                                <button
                                  onClick={cancelService}
                                  className="w-full py-2.5 bg-rose-600/15 hover:bg-rose-600 text-white border border-rose-500/20 rounded-xl text-[10px] uppercase font-black tracking-widest transition-colors flex items-center justify-center gap-1"
                                >
                                  <XCircle size={12} />
                                  Cancelar Serviço
                                </button>
                              </div>
                            )}

                            {/* ACTIVE state: Ride in progress */}
                            {currentService.status === "active" && (
                              <div className="space-y-4">
                                <div className="bg-[#10b981]/15 p-4 rounded-xl border border-emerald-500/30 text-center space-y-1">
                                  <div className="flex items-center justify-center gap-2">
                                    <span className="w-2 h-2 bg-emerald-500 rounded-full animate-ping" />
                                    <span className="text-[10px] font-black text-emerald-400 uppercase tracking-widest">Viagem de Super Táxi Ativa</span>
                                  </div>
                                  <p className="text-[8.5px] text-slate-400 uppercase">Siga a rota GPS até ao destino pretendido do passageiro.</p>
                                </div>

                                <button
                                  onClick={finishService}
                                  className="w-full py-4 bg-emerald-500 hover:bg-[#059669] transition-all text-slate-950 font-black text-[11px] uppercase tracking-widest rounded-xl flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/30 active:scale-95 animate-pulse"
                                >
                                  <CheckCircle2 size={13} />
                                  Encerrar Viagem & Carregar Renda ({currentService.price?.toLocaleString()} Kz)
                                </button>

                                <button
                                  onClick={() => setIsTransferModalOpen(true)}
                                  className="w-full bg-slate-950 border border-white/5 hover:bg-slate-900 text-slate-300 py-3 rounded-xl font-black text-[9.5px] uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                                >
                                  <Users size={12} className="text-slate-500" />
                                  DELEGAR / ESCALAR MOTORISTA
                                </button>

                                <button
                                  onClick={cancelService}
                                  className="w-full py-2.5 bg-rose-600/15 hover:bg-rose-600 text-white border border-rose-500/20 rounded-xl text-[10px] uppercase font-black tracking-widest transition-colors flex items-center justify-center gap-1"
                                >
                                  <XCircle size={12} />
                                  Cancelar Serviço
                                </button>
                              </div>
                            )}

                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Quick Actions (Call/Chat) */}
                  {currentService && (
                    <div className="grid grid-cols-2 gap-3">
                      <button 
                        onClick={() => {
                          if (currentService.customerPhone) {
                            window.open(`tel:${currentService.customerPhone}`, '_self');
                          } else {
                            alert("Cliente não tem número de telemóvel associado.");
                          }
                        }}
                        className="flex items-center justify-center gap-3 bg-white border border-slate-200 p-4 rounded-2xl text-slate-700 transition-all hover:bg-slate-50 group"
                      >
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-100">
                          <Phone size={18} />
                        </div>
                        <span className="text-[11px] font-black uppercase">
                          Ligar Cliente
                        </span>
                      </button>
                      <button 
                        onClick={() => setIsMessagesModalOpen(true)}
                        className="flex items-center justify-center gap-3 bg-white border border-slate-200 p-4 rounded-2xl text-slate-700 transition-all hover:bg-slate-50 group"
                      >
                        <div className="p-2 bg-emerald-50 text-emerald-600 rounded-lg group-hover:bg-emerald-100">
                          <MessageCircle size={18} />
                        </div>
                        <span className="text-[11px] font-black uppercase">
                          Chat (APP)
                        </span>
                      </button>
                    </div>
                  )}
              </div>
            ) : activeInternalTab === "history" ? (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-tighter">
                    Histórico de Corridas
                  </h3>
                  <span className="text-[10px] font-black bg-slate-100 px-2 py-0.5 rounded text-slate-500 uppercase">
                    {tripHistory.length} Total
                  </span>
                </div>
                <div className="space-y-3 pb-20">
                  {tripHistory.length > 0 ? (
                    tripHistory.map((trip) => (
                      <div
                        key={trip.id}
                        className="bg-white p-4 rounded-2xl border border-slate-100 flex items-center justify-between shadow-sm hover:border-brand-primary/20 transition-all group"
                      >
                        <div className="flex-1 min-w-0 pr-4">
                          <p className="text-[11px] font-black text-slate-800 uppercase truncate">
                            {trip.pickupAddress?.split(",")[0]} →{" "}
                            {trip.destinationAddress?.split(",")[0]}
                          </p>
                          <div className="flex items-center gap-2 mt-1">
                            <span className="text-[9px] text-slate-400 font-bold uppercase tracking-widest">
                              {trip.completedAt
                                ? format(new Date(trip.completedAt), "HH:mm")
                                : "Hoje"}
                            </span>
                            <span className="w-1 h-1 bg-slate-200 rounded-full" />
                            <p className="text-[10px] text-emerald-600 font-black italic">
                              {(trip.price || 0).toLocaleString()} Kz
                            </p>
                          </div>
                        </div>
                        <div className="p-1.5 bg-emerald-50 text-emerald-500 rounded-lg group-hover:bg-emerald-500 group-hover:text-white transition-all">
                          <CheckCircle2 size={16} />
                        </div>
                      </div>
                    ))
                  ) : (
                    <div className="py-12 text-center opacity-40">
                      <History
                        size={32}
                        className="mx-auto mb-2 text-slate-300"
                      />
                      <p className="text-[10px] font-bold uppercase">
                        Nenhuma viagem registada.
                      </p>
                    </div>
                  )}
                </div>
              </div>
            ) : activeInternalTab === "contracts" ? (
              <div className="space-y-6">
                <div className="flex flex-col gap-3">
                  <div className="flex items-center justify-between">
                    <div>
                      <h3 className="text-sm font-black text-slate-800 uppercase tracking-tighter">
                        Clientes de Passagem
                      </h3>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <span className="text-[9px] font-bold text-slate-400 uppercase tracking-widest">
                          Viatura:
                        </span>
                        <span className="text-brand-primary font-black text-[10px] uppercase">
                          {viewContractsPrefix || "N/A"}
                        </span>
                      </div>
                    </div>
                    <div className="flex gap-2">
                      <button
                        onClick={() => setIsContractModalOpen(true)}
                        className="flex items-center gap-2 px-3 py-2 bg-brand-primary text-white rounded-xl shadow-lg shadow-brand-primary/20 transition-all active:scale-95"
                        title="Novo Contrato"
                      >
                        <Plus size={18} />
                        <span className="text-[10px] font-black uppercase tracking-widest">
                          Novo Contrato
                        </span>
                      </button>
                      {vehicleContracts.length > 0 && (
                        <button
                          onClick={() => setShowContractMap(!showContractMap)}
                          className={cn(
                            "p-2 rounded-xl transition-all shadow-lg",
                            showContractMap
                              ? "bg-slate-900 text-white"
                              : "bg-white text-slate-600 border border-slate-100",
                          )}
                        >
                          <MapPin size={18} />
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Date Badge / Selector */}
                  <div
                    className={cn(
                      "flex items-center justify-between p-3 rounded-2xl border",
                      viewContractsDate ===
                        new Date().toISOString().split("T")[0]
                        ? "bg-white border-slate-100"
                        : "bg-amber-50 border-amber-100 shadow-sm",
                    )}
                  >
                    <div className="flex items-center gap-2">
                      <Clock
                        size={14}
                        className={
                          viewContractsDate ===
                          new Date().toISOString().split("T")[0]
                            ? "text-slate-400"
                            : "text-amber-500"
                        }
                      />
                      <span className="text-[10px] font-black text-slate-700 uppercase">
                        {viewContractsDate ===
                        new Date().toISOString().split("T")[0]
                          ? "Roteiro de Hoje"
                          : `Pendência de ${format(new Date(viewContractsDate + "T12:00:00"), "dd/MM")}`}
                      </span>
                    </div>
                    {viewContractsDate !==
                      new Date().toISOString().split("T")[0] && (
                      <button
                        onClick={() => {
                          setViewContractsDate(
                            new Date().toISOString().split("T")[0],
                          );
                          setViewContractsPrefix(assignedVehicle?.prefix);
                        }}
                        className="bg-amber-500 text-white px-2 py-1 rounded-lg text-[9px] font-black uppercase shadow-lg shadow-amber-200"
                      >
                        Voltar Hoje
                      </button>
                    )}
                  </div>
                </div>

                {showContractMap && vehicleContracts.length > 0 && (
                  <div className="bg-white rounded-3xl border border-slate-100 overflow-hidden shadow-inner h-64 relative">
                    {/* Simplified Route Map Visualization */}
                    <div className="absolute inset-0 bg-slate-50 flex items-center justify-center p-8">
                      <div className="w-full h-full relative border-2 border-slate-100 rounded-2xl flex flex-col items-center justify-center text-center space-y-2">
                        <Navigation
                          size={24}
                          className="text-brand-primary animate-pulse"
                        />
                        <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          Roteiro dos Contratos
                        </p>
                        <div className="flex gap-1">
                          {vehicleContracts
                            .filter((c) => c.location)
                            .map((_, i) => (
                              <div
                                key={i}
                                className="w-2 h-2 rounded-full bg-brand-primary"
                              />
                            ))}
                        </div>
                        <p className="text-[8px] text-slate-300 font-bold max-w-[150px]">
                          {vehicleContracts.filter((c) => c.location).length}{" "}
                          locais georeferenciados neste roteiro.
                        </p>
                        <a
                          href={
                            vehicleContracts.filter((c) => c.location)
                              .length === 1
                              ? `https://www.google.com/maps/search/?api=1&query=${vehicleContracts.find((c) => c.location).location.lat},${vehicleContracts.find((c) => c.location).location.lng}`
                              : `https://www.google.com/maps/dir/${vehicleContracts
                                  .filter((c) => c.location)
                                  .map(
                                    (c) =>
                                      `${c.location.lat},${c.location.lng}`,
                                  )
                                  .join("/")}`
                          }
                          target="_blank"
                          rel="noopener noreferrer"
                          className="bg-brand-primary text-white px-4 py-2 rounded-full text-[8px] font-black uppercase tracking-widest mt-2 flex items-center gap-1"
                        >
                          Abrir no Google Maps
                          <ExternalLink size={10} />
                        </a>
                      </div>
                    </div>
                  </div>
                )}

                <div className="space-y-3">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                    Contratos desta Unidade
                  </p>

                  {vehicleContracts.length === 0 ? (
                    <div className="bg-white p-6 rounded-2xl border border-slate-100 text-center opacity-40">
                      <Users
                        size={24}
                        className="mx-auto mb-2 text-slate-300"
                      />
                      <p className="text-[10px] font-bold uppercase">
                        Nenhum contrato ativo para esta viatura.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {vehicleContracts.map((contract) => {
                        const pxV = viewContractsPrefix || assignedVehicle?.prefix || user.prefix || "";
                        const isE = contract.entryVehicleId && pxV ? contract.entryVehicleId.includes(pxV) : false;
                        const isX = contract.exitVehicleId && pxV ? contract.exitVehicleId.includes(pxV) : false;
                        const mType = isE ? "entry" : "exit";
                        const attStatus =
                          todayAttendance[`${contract.id}_${mType}`] ||
                          todayAttendance[contract.id];
                        return (
                          <div
                            key={contract.id}
                            className={cn(
                              "bg-white p-3 rounded-xl border transition-all shadow-sm flex flex-col gap-2.5",
                              attStatus === "attended"
                                ? "border-emerald-250 bg-emerald-50/20"
                                : "border-slate-100 hover:border-slate-200",
                            )}
                          >
                            {/* Linha Principal: Cliente, Ocupantes, Status e Localizacao */}
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-1.5 flex-wrap">
                                  <h4 className="text-[11px] font-black text-slate-800 uppercase truncate">
                                    {contract.clientName}
                                  </h4>
                                  <div className="flex items-center gap-0.5 bg-slate-100 px-1 py-0.2 rounded text-[8px] font-semibold text-slate-500">
                                    <Users size={8} />
                                    <span>{contract.occupants || 1}</span>
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 text-[9px] text-slate-500 mt-1 flex-wrap">
                                  <span className="font-semibold text-slate-400 uppercase truncate max-w-[100px]">
                                    {contract.neighborhood}
                                  </span>
                                  <span className="text-slate-300">→</span>
                                  <span className="font-extrabold text-brand-primary uppercase truncate max-w-[140px]">
                                    {contract.destination}
                                  </span>
                                </div>
                              </div>

                              <div className="flex items-center gap-1 shrink-0">
                                {contract.location && (
                                  <div className="w-4.5 h-4.5 bg-emerald-50 text-emerald-600 rounded flex items-center justify-center">
                                    <MapPin size={9} />
                                  </div>
                                )}
                                <span
                                  className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-wider ${
                                    contract.status === "Ativo"
                                      ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                                      : "bg-slate-100 text-slate-400 border border-slate-200"
                                  }`}
                                >
                                  {contract.status}
                                </span>
                              </div>
                            </div>

                            {/* Detalhes de Horários Levar/Buscar */}
                            <div className="flex items-center gap-1.5">
                              {isE && (
                                <span className="px-1.5 py-0.5 bg-emerald-50/50 text-emerald-700 border border-emerald-100/40 rounded text-[8px] font-black uppercase tracking-tighter">
                                  LEVAR • {contract.entryTime}
                                </span>
                              )}
                              {isX && (
                                <span className="px-1.5 py-0.5 bg-rose-50/50 text-rose-700 border border-rose-100/40 rounded text-[8px] font-black uppercase tracking-tighter">
                                  BUSCAR • {contract.exitTime}
                                </span>
                              )}
                            </div>

                            {/* Linha de Ações */}
                            <div className="flex items-center gap-2 pt-2 border-t border-slate-100/50">
                              {contract.location ? (
                                <a
                                  href={`https://www.google.com/maps/search/?api=1&query=${contract.location.lat},${contract.location.lng}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="px-2.5 py-1.5 bg-blue-50 hover:bg-blue-100 text-blue-600 rounded-lg text-[8px] font-black uppercase tracking-wider flex items-center justify-center gap-1 border border-blue-100/50 transition-colors"
                                >
                                  <Navigation size={10} />
                                  GPS
                                </a>
                              ) : (
                                <button
                                  onClick={() => captureContractGps(contract.id)}
                                  disabled={capturingGpsId === contract.id}
                                  className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 disabled:bg-slate-50 text-amber-600 disabled:text-slate-400 rounded-lg text-[8px] font-black uppercase tracking-wider flex items-center justify-center gap-1 border border-amber-200/50 disabled:border-slate-200 transition-colors shrink-0"
                                  title="Capturar localização atual para registar ponto de recolha"
                                >
                                  {capturingGpsId === contract.id ? (
                                    <>
                                      <Loader2 size={10} className="animate-spin" />
                                      A Captar...
                                    </>
                                  ) : (
                                    <>
                                      <MapPin size={10} />
                                      Registar GPS
                                    </>
                                  )}
                                </button>
                              )}
                              {attStatus === "attended" ? (
                                <div className="flex-1 bg-emerald-500 text-white py-1.5 rounded-lg text-[8px] font-black uppercase tracking-wider flex items-center justify-center gap-1.5 shadow-sm">
                                  <CheckCircle2 size={10} />
                                  Confirmado
                                </div>
                              ) : (
                                <button
                                  onClick={() =>
                                    markContractAttendance(
                                      contract.id,
                                      "attended",
                                      mType,
                                    )
                                  }
                                  className="flex-1 bg-slate-900 border border-slate-950 text-white hover:bg-slate-800 py-1.5 rounded-lg text-[8px] font-black uppercase tracking-wider flex items-center justify-center gap-1 animate-all transition-all shadow-sm"
                                >
                                  Confirmar {isE ? "Saída" : "Recolha"}
                                </button>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            ) : activeInternalTab === "rendas" ? (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-tighter">
                    Declaração de Renda Diária
                  </h3>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-1 font-sans">
                    Declare o faturamento do dia para validação.
                  </p>
                </div>

                {/* Sincronizado cards and automatics */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 font-sans">
                  <div className="bg-slate-900 rounded-[2rem] p-6 text-white relative overflow-hidden shadow-md">
                    <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/20 blur-3xl rounded-full -mr-16 -mt-16" />
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest relative z-10">
                      Balanço Total Sincronizado
                    </p>
                    <h2 className="text-3xl font-black mt-2 relative z-10 tracking-tight">
                      {(earnings || 0).toLocaleString()} <span className="text-sm text-slate-400 font-medium font-mono">Kz</span>
                    </h2>
                    <div className="mt-4 flex items-center gap-1.5 text-[9px] font-bold text-emerald-400 relative z-10 uppercase tracking-wider">
                      <CheckCircle2 size={11} className="animate-pulse" />
                      <span>Sincronizado com Central Luena</span>
                    </div>
                  </div>

                  <div className="bg-white rounded-[2rem] p-6 border border-slate-100 flex flex-col justify-between shadow-sm">
                    <div>
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest leading-none">
                        Renda das Corridas Concluídas (App)
                      </p>
                      <h3 className="text-3xl font-black mt-2 text-emerald-600 tracking-tight">
                        {(passengerRidesTotal || 0).toLocaleString()} <span className="text-sm text-emerald-550 font-medium font-mono">Kz</span>
                      </h3>
                    </div>
                    <div className="mt-4 bg-emerald-50 text-emerald-700 p-2.5 rounded-xl text-[8.5px] font-bold uppercase tracking-wider text-center border border-emerald-100">
                      Este campo não é editável e reflete o total automático das corridas concluídas com sucesso.
                    </div>
                  </div>
                </div>

                {/* Form Entrega de Renda */}
                <div className="bg-white rounded-[2rem] p-6 border border-slate-100 space-y-4 shadow-sm">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2.5 bg-brand-primary/10 text-brand-primary rounded-2xl">
                      <Wallet size={18} />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest leading-none">
                        Entrega de Renda
                      </h4>
                      <p className="text-[9px] text-slate-400 font-bold mt-1 uppercase tracking-wider">
                        Declare o faturamento do dia para validação.
                      </p>
                    </div>
                  </div>



                  {pendingRevenues.length > 0 && !editingRevenueId ? (
                    <div className="bg-amber-50 border border-amber-200 p-5 rounded-2xl flex flex-col items-center text-center space-y-3">
                      <div className="p-3 bg-amber-100 text-amber-600 rounded-full animate-pulse">
                        <Clock size={24} />
                      </div>
                      <h4 className="text-xs font-black text-amber-800 uppercase tracking-widest leading-none">
                        Aguardando Validação do Operador
                      </h4>
                      <p className="text-[10px] text-amber-700 font-bold leading-relaxed px-2">
                        José Iweza Suana (JIS), deves aguardar que o Operador ou Administrador valide a sua renda actual antes de submeter uma nova declaração.
                      </p>
                    </div>
                  ) : (
                    <>
                      {editingRevenueId && (
                        <div className="bg-rose-50 border border-rose-100 p-3 rounded-2xl flex items-center justify-between mb-4">
                          <div className="flex items-center gap-2">
                            <AlertTriangle size={14} className="text-rose-500" />
                            <p className="text-[10px] text-rose-700 font-bold uppercase tracking-wide">
                              A corrigir renda rejeitada...
                            </p>
                          </div>
                          <button
                            type="button"
                            onClick={() => {
                              setEditingRevenueId(null);
                              setRevenueDetails({ tpa: "", cash: "", transfer: "", expenses: "", description: "" });
                            }}
                            className="text-[9px] font-black uppercase text-rose-600 hover:text-rose-800"
                          >
                            Cancelar
                          </button>
                        </div>
                      )}
                      <form onSubmit={submitRevenue} className="space-y-4">

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">
                              TPA (Cartão)
                            </label>
                            <input
                              type="number"
                              placeholder="0"
                              value={revenueDetails.tpa}
                              onChange={(e) =>
                                setRevenueDetails({
                                  ...revenueDetails,
                                  tpa: e.target.value,
                                })
                              }
                              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-emerald-500 text-slate-800 font-mono"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">
                              Numerário (Cache)
                            </label>
                            <input
                              type="number"
                              placeholder="0"
                              value={revenueDetails.cash}
                              onChange={(e) =>
                                setRevenueDetails({
                                  ...revenueDetails,
                                  cash: e.target.value,
                                })
                              }
                              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-emerald-500 text-slate-800 font-mono"
                            />
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-3">
                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">
                              Transferências
                            </label>
                            <input
                              type="number"
                              placeholder="0"
                              value={revenueDetails.transfer}
                              onChange={(e) =>
                                setRevenueDetails({
                                  ...revenueDetails,
                                  transfer: e.target.value,
                                })
                              }
                              className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-emerald-500 text-slate-800 font-mono"
                            />
                          </div>
                          <div className="space-y-1">
                            <label className="text-[9px] font-black text-red-500 uppercase tracking-widest ml-1">
                              Saídas / Gastos
                            </label>
                            <input
                              type="number"
                              placeholder="0"
                              value={revenueDetails.expenses}
                              onChange={(e) =>
                                setRevenueDetails({
                                  ...revenueDetails,
                                  expenses: e.target.value,
                                })
                              }
                              className="w-full px-4 py-2.5 bg-red-50 border border-red-100 rounded-xl text-xs font-bold outline-none focus:border-red-400 text-red-600 font-mono"
                            />
                          </div>
                        </div>

                        <div className="space-y-1">
                          <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest ml-1">
                            Notas da Saída
                          </label>
                          <input
                            type="text"
                            placeholder="Ex: Combustível, Refeição..."
                            value={revenueDetails.description}
                            onChange={(e) =>
                                setRevenueDetails({
                                  ...revenueDetails,
                                  description: e.target.value,
                                })
                            }
                            className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-slate-400"
                          />
                        </div>

                        <div className="pt-2 border-t border-slate-100 pt-4 font-sans">
                          <div className="flex items-center justify-between mb-4 px-1">
                            <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                              Líquido a Entregar:
                            </span>
                            <span className="text-lg font-black text-emerald-600 font-mono">
                              {(
                                (Number(revenueDetails?.tpa) || 0) +
                                (Number(revenueDetails?.cash) || 0) +
                                (Number(revenueDetails?.transfer) || 0) -
                                (Number(revenueDetails?.expenses) || 0)
                              ).toLocaleString()}{" "}
                              Kz
                            </span>
                          </div>
                          <button
                            type="submit"
                            disabled={revenueLoading}
                            className={cn(
                              "w-full py-4 rounded-2xl text-[10.5px] font-black uppercase tracking-widest transition-all shadow-lg active:scale-95",
                              revenueSuccess
                                ? "bg-emerald-500 text-white shadow-emerald-200"
                                : "bg-slate-900 text-white shadow-slate-200 disabled:opacity-50",
                            )}
                          >
                            {revenueLoading ? (
                              <div className="h-4 w-4 border-2 border-white/30 border-t-white rounded-full animate-spin mx-auto" />
                            ) : revenueSuccess ? (
                              "Declarado com Sucesso!"
                            ) : (
                              "Declarar Renda Detalhada"
                            )}
                          </button>
                        </div>
                      </form>
                    </>
                  )}
                </div>
              </div>
            ) : activeInternalTab === "settings" ? (
              <div className="space-y-6">
                <div>
                  <h3 className="text-sm font-black text-slate-800 uppercase tracking-tighter">
                    Ajustes de Notificação
                  </h3>
                  <p className="text-[9px] text-slate-400 font-bold uppercase tracking-wider mt-1">
                    Configure o som para novas chamadas
                  </p>
                </div>

                <div className="bg-white rounded-3xl p-6 border border-slate-100 space-y-4 font-sans">
                  <div className="space-y-3">
                    {ringtones.map((ring) => (
                      <button
                        key={ring.id}
                        onClick={() => {
                          setSelectedRingtone(ring.id);
                          localStorage.setItem('driver_ringtone', ring.id);
                          playPreview(ring.url);
                        }}
                        className={cn(
                          "w-full p-4 rounded-2xl border flex items-center justify-between transition-all active:scale-95",
                          selectedRingtone === ring.id
                            ? "bg-brand-primary/5 border-brand-primary shadow-sm"
                            : "bg-slate-50 border-slate-100 hover:border-slate-200"
                        )}
                      >
                        <div className="flex items-center gap-3">
                          <div className={cn(
                            "w-8 h-8 rounded-full flex items-center justify-center",
                            selectedRingtone === ring.id ? "bg-brand-primary text-white" : "bg-slate-200 text-slate-400"
                          )}>
                            <PhoneIncoming size={14} />
                          </div>
                          <span className={cn(
                            "text-xs font-black uppercase",
                            selectedRingtone === ring.id ? "text-brand-primary" : "text-slate-600"
                          )}>
                            {ring.name}
                          </span>
                        </div>
                        {selectedRingtone === ring.id && (
                          <div className="flex items-center gap-1.5 bg-brand-primary text-white px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-widest">
                            <CheckCircle2 size={10} />
                            Ativo
                          </div>
                        )}
                      </button>
                    ))}
                  </div>

                  <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl flex items-start gap-3">
                    <Bell size={16} className="text-amber-500 shrink-0" />
                    <p className="text-[9px] text-amber-700 font-bold uppercase leading-relaxed">
                      O toque escolhido tocará continuamente no seu telemóvel sempre que houver uma nova chamada pendente para aceitar.
                    </p>
                  </div>

                  <button
                    onClick={() => setActiveInternalTab("dashboard")}
                    className="w-full bg-slate-900 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all"
                  >
                    Guardar e Voltar
                  </button>
                </div>
              </div>
            ) : (
              null
            )}
          </main>

        {/* Panic Modal */}
        <AnimatePresence>
          {showPanicModal && (
            <div className="absolute inset-0 z-[100] flex items-center justify-center p-6 text-center">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-slate-950/95 backdrop-blur-2xl"
              />
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="relative space-y-6 max-w-md w-full"
              >
                <div className="w-24 h-24 bg-red-650/40 rounded-full flex items-center justify-center mx-auto border-4 border-red-500 animate-pulse">
                  <AlertTriangle size={48} className="text-red-500" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-4xl font-black text-red-500 tracking-tighter italic animate-bounce">
                    S.O.S ATIVO!
                  </h2>
                  <p className="text-white font-bold text-sm uppercase tracking-widest px-4">
                    Sinal de emergência emitido para a Central Geral no Luena-Moxico!
                  </p>
                </div>

                {/* Real-Time Live Status Feedback */}
                <div className="bg-slate-900/80 border border-slate-800 p-6 rounded-3xl mx-auto text-left space-y-4 shadow-3xl">
                  <div>
                    <span className="text-[10px] font-black uppercase tracking-wider text-slate-550 block mb-1">Canais Operacionais</span>
                    <div className="flex items-center gap-2">
                      <span className="h-2 w-2 rounded-full bg-emerald-500 animate-ping" />
                      <span className="text-xs font-black text-emerald-400 uppercase tracking-widest">Servidor Firebase Live (Ativo)</span>
                    </div>
                  </div>

                  {activePanicAlert?.dispatchMessage ? (
                    <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl space-y-2">
                      <p className="text-[9px] font-black text-amber-500 uppercase tracking-widest leading-none">🚑 MENSAGEM DO DESPACHADOR CENTRAL:</p>
                      <p className="text-xs font-black text-white leading-relaxed">
                        "{activePanicAlert.dispatchMessage}"
                      </p>
                      <p className="text-[9px] text-slate-400">Enviada às: {activePanicAlert.dispatchedAt ? format(new Date(activePanicAlert.dispatchedAt), 'HH:mm') : 'Agora'}</p>
                    </div>
                  ) : (
                    <div className="bg-slate-950/50 p-4 rounded-2xl border border-slate-850 text-center">
                      <p className="text-xs text-slate-400 font-bold uppercase tracking-wide animate-pulse">
                        ⌛ Central Operativa a analisar localização...
                      </p>
                      <p className="text-[9px] text-slate-600 mt-1 uppercase">A ajuda será despachada e as ordens aparecerão aqui.</p>
                    </div>
                  )}

                  {activePanicAlert?.driverAcknowledge && (
                    <div className="flex items-center gap-2 text-emerald-400 text-[10px] font-black uppercase tracking-widest justify-center bg-emerald-500/10 p-2.5 rounded-xl border border-emerald-500/10">
                      ✓ Confirmou o recebimento da ajuda!
                    </div>
                  )}
                </div>

                <div className="flex flex-col gap-2.5 px-4 w-full">
                  {activePanicAlert?.dispatchMessage && !activePanicAlert?.driverAcknowledge && (
                    <button
                      onClick={acknowledgeRescue}
                      className="w-full bg-amber-500 hover:bg-amber-600 text-slate-950 py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all"
                    >
                      ✓ Confirmar Recebimento do Socorro
                    </button>
                  )}

                  <button
                    onClick={resolvePanicFromDriver}
                    className="w-full bg-emerald-600 hover:bg-emerald-700 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest shadow-xl active:scale-95 transition-all"
                  >
                    Estou Seguro / Cancelar Emergência
                  </button>

                  <button
                    onClick={() => setShowPanicModal(false)}
                    className="w-full bg-slate-900 border border-slate-800 text-slate-400 py-3.5 rounded-2xl font-black text-xs uppercase tracking-widest active:scale-95 transition-all"
                  >
                    Minimizar Janela SOS
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Driver Contract Registration Modal */}
        <AnimatePresence>
          {isContractModalOpen && (
            <div className="absolute inset-0 z-[70] flex items-end p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsContractModalOpen(false)}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
              />
              <motion.div
                initial={{ y: 500, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 500, opacity: 0 }}
                className="relative w-full bg-white rounded-t-[2.5rem] rounded-b-xl p-8 space-y-6 shadow-2xl h-[90%] overflow-y-auto custom-scrollbar"
              >
                <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                  <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter">
                    Novo Contrato
                  </h3>
                  <button
                    onClick={() => setIsContractModalOpen(false)}
                    className="p-1 bg-slate-100 rounded-full text-slate-400"
                  >
                    <X size={20} />
                  </button>
                </div>

                <form onSubmit={submitContract} className="space-y-4 pb-8">
                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Nome do Cliente
                    </label>
                    <input
                      required
                      type="text"
                      value={contractFormData.clientName}
                      onChange={(e) =>
                        setContractFormData({
                          ...contractFormData,
                          clientName: e.target.value,
                        })
                      }
                      placeholder="Ex: Dra. Maria Antónia"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:border-brand-primary"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Bairro / Local de Recolha
                    </label>
                    <input
                      required
                      type="text"
                      value={contractFormData.neighborhood}
                      onChange={(e) =>
                        setContractFormData({
                          ...contractFormData,
                          neighborhood: e.target.value,
                        })
                      }
                      placeholder="Ex: Benfica, Rua do Comércio"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:border-brand-primary"
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                        Destino
                      </label>
                      <select
                        required
                        value={contractFormData.destination}
                        onChange={(e) =>
                          setContractFormData({
                            ...contractFormData,
                            destination: e.target.value,
                          })
                        }
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:border-brand-primary"
                      >
                        <option value="Trabalho">Trabalho</option>
                        <option value="Escola">Escola</option>
                      </select>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                        Período
                      </label>
                      <select
                        required
                        value={contractFormData.period}
                        onChange={(e) =>
                          setContractFormData({
                            ...contractFormData,
                            period: e.target.value,
                          })
                        }
                        className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:border-brand-primary"
                      >
                        <option value="Manhã">Manhã</option>
                        <option value="Tarde">Tarde</option>
                        <option value="Noite">Noite</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Telefone
                    </label>
                    <div className="flex">
                      <span className="inline-flex items-center px-3 rounded-l-2xl border border-r-0 border-slate-200 bg-slate-100 text-slate-500 text-xs font-bold">
                        +244
                      </span>
                      <input
                        required
                        type="tel"
                        value={contractFormData.phone}
                        onChange={(e) =>
                          setContractFormData({
                            ...contractFormData,
                            phone: e.target.value,
                          })
                        }
                        placeholder="9XX XXX XXX"
                        className="flex-1 w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-r-2xl text-xs font-bold outline-none focus:border-brand-primary"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Certificação de Localização (GEO)
                    </label>
                    <div className="flex items-center justify-between mb-2 px-1">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.1em] italic flex items-center gap-2">
                        <Activity size={10} className="text-brand-primary animate-pulse" />
                        Sinal GPS Live
                      </span>
                      <div className="flex gap-0.5 items-end h-3">
                        <div className="w-1 h-[20%] bg-brand-primary opacity-30 rounded-full" />
                        <div className="w-1 h-[40%] bg-brand-primary opacity-40 rounded-full" />
                        <div className="w-1 h-[60%] bg-brand-primary rounded-full animate-bounce" />
                        <div className="w-1 h-[80%] bg-brand-primary rounded-full" />
                        <div className="w-1 h-[100%] bg-brand-primary rounded-full" />
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={captureContractLocation}
                      disabled={isCapturingGeo}
                      className={cn(
                        "w-full flex items-center justify-center gap-3 py-4 rounded-2xl border-2 transition-all",
                        contractFormData.location
                          ? "bg-emerald-50 border-emerald-200 text-emerald-600"
                          : "bg-slate-50 border-slate-200 text-slate-500",
                      )}
                    >
                      {isCapturingGeo ? (
                        <>
                          <Loader2 className="animate-spin" size={18} />
                          <span className="text-[10px] font-black uppercase tracking-widest">
                            A Sincronizar GPS...
                          </span>
                        </>
                      ) : contractFormData.location ? (
                        <>
                          <Navigation size={18} />
                          <div className="text-left">
                             <p className="text-[10px] font-black uppercase tracking-widest leading-none">GPS Sincronizado</p>
                             <p className="text-[8px] font-bold opacity-70">Gerar Coordenadas Contratuais</p>
                          </div>
                        </>
                      ) : (
                        <>
                          <MapPin size={18} />
                          <div className="text-left">
                             <p className="text-[10px] font-black uppercase tracking-widest leading-none">Captar Localização</p>
                             <p className="text-[8px] font-bold opacity-70 italic">Gerar no ponto de recolha</p>
                          </div>
                        </>
                      )}
                    </button>

                    {contractFormData.location && (
                      <div className="mt-4 rounded-2xl overflow-hidden border border-slate-200 h-[450px] sm:h-[500px] md:h-[550px] relative group w-full">
                        {/* @ts-ignore */}
                        <MapContainer 
                          center={[contractFormData.location.lat, contractFormData.location.lng]} 
                          zoom={16} 
                          style={{ height: '100%', width: '100%' }}
                          zoomControl={false}
                        >
                          <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                          <Marker position={[contractFormData.location.lat, contractFormData.location.lng]} />
                          <MapUpdater center={[contractFormData.location.lat, contractFormData.location.lng]} />
                        </MapContainer>
                        <div className="absolute top-2 right-2 z-[400] bg-white/90 backdrop-blur-sm px-2 py-1 rounded-lg border border-slate-200 text-[8px] font-black uppercase text-slate-500 shadow-sm">
                           {contractFormData.location.lat.toFixed(6)}, {contractFormData.location.lng.toFixed(6)}
                        </div>
                      </div>
                    )}
                    <p className="text-[8px] text-slate-400 mt-1 px-1 font-medium leading-relaxed italic">
                      * Clique quando estiver exatamente na porta/casa do
                      cliente para registar o ponto no mapa.
                    </p>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">
                      Observações
                    </label>
                    <textarea
                      value={contractFormData.notes}
                      onChange={(e) =>
                        setContractFormData({
                          ...contractFormData,
                          notes: e.target.value,
                        })
                      }
                      placeholder="Algum detalhe importante?"
                      className="w-full px-4 py-3 bg-slate-50 border border-slate-200 rounded-2xl text-xs font-bold outline-none focus:border-brand-primary h-24 resize-none"
                    />
                  </div>

                  <button
                    type="submit"
                    disabled={contractLoading}
                    className="w-full py-5 bg-brand-primary text-white rounded-[2rem] font-black text-xs uppercase tracking-widest shadow-xl shadow-brand-primary/20 transition-all active:scale-95 disabled:opacity-50"
                  >
                    {contractLoading ? "A REGISTAR..." : "SOLICITAR CONTRATO"}
                  </button>
                </form>
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Direct Call Referral/Transfer Modal Overlay */}
        <AnimatePresence>
          {isNewCallTransferModalOpen && (
            <div className="absolute inset-0 z-[60] flex items-end p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsNewCallTransferModalOpen(false)}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
              />
              <motion.div
                initial={{ y: 300, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 300, opacity: 0 }}
                className="relative w-full bg-white rounded-[2.5rem] p-6 space-y-4 shadow-2xl z-20 flex flex-col max-h-[90%]"
              >
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                      Encaminhar Chamada
                    </h3>
                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">
                      Enviar contacto de cliente para colega
                    </p>
                  </div>
                  <button 
                    onClick={() => setIsNewCallTransferModalOpen(false)}
                    className="p-1.5 hover:bg-slate-100 rounded-full transition-all"
                  >
                    <X size={16} className="text-slate-500" />
                  </button>
                </div>

                <div className="space-y-3">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">
                      Número do Cliente
                    </label>
                    <div className="relative flex items-center bg-slate-100 rounded-xl px-3 border border-slate-200">
                      <span className="text-[11px] font-black text-slate-400 mr-1">+244</span>
                      <input
                        type="tel"
                        maxLength={9}
                        placeholder="9XX XXX XXX"
                        value={transferCustomerPhone}
                        onChange={(e) => {
                          const digitsOnly = e.target.value.replace(/\D/g, "");
                          setTransferCustomerPhone(digitsOnly);
                        }}
                        className="w-full bg-transparent border-none py-2.5 text-xs font-black text-slate-800 outline-none uppercase"
                      />
                    </div>
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">
                      Nome do Cliente (Opcional)
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Sr. Ze Suana"
                      value={transferCustomerName}
                      onChange={(e) => setTransferCustomerName(e.target.value)}
                      className="w-full bg-slate-100 rounded-xl px-3 py-2 text-xs font-black text-slate-800 outline-none border border-slate-200 uppercase"
                    />
                  </div>

                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-slate-500 uppercase tracking-wider block">
                      Ponto de Recolha / Descrição (Opcional)
                    </label>
                    <input
                      type="text"
                      placeholder="Ex: Definitivos Próximo da Unitel"
                      value={transferPickupAddress}
                      onChange={(e) => setTransferPickupAddress(e.target.value)}
                      className="w-full bg-slate-100 rounded-xl px-3 py-2 text-xs font-black text-slate-800 outline-none border border-slate-200 uppercase"
                    />
                  </div>
                </div>

                <div className="border-t border-slate-100 pt-3 flex-1 flex flex-col min-h-0">
                  <span className="text-[9px] font-black text-slate-400 uppercase tracking-wider block mb-2">
                    Selecionar Motorista Coop / Moxico
                  </span>
                  
                  <div className="overflow-y-auto pr-1 space-y-2 flex-1 max-h-[160px] no-scrollbar">
                    {otherDrivers.length > 0 ? (
                      otherDrivers.map((driver) => (
                        <button
                          key={driver.id}
                          disabled={transferLoading || !transferCustomerPhone}
                          onClick={() => sendDirectCallTransfer(driver)}
                          className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-orange-500 hover:text-white disabled:opacity-50 disabled:hover:bg-slate-50 disabled:hover:text-inherit rounded-xl border border-slate-100 transition-all text-left group"
                        >
                          <div>
                            <p className="text-xs font-black text-slate-800 uppercase group-hover:text-white leading-tight">
                              {driver.name}
                            </p>
                            <p className="text-[9px] text-slate-400 uppercase font-bold group-hover:text-white/80 mt-1">
                              Viatura: {driver.prefix || "N/A"} • {driver.status || "Ativo"}
                            </p>
                          </div>
                          <div className="p-2 bg-white/80 text-orange-500 rounded-lg group-hover:bg-white group-hover:text-orange-500 shadow-sm transition-all">
                            <PhoneIncoming size={12} />
                          </div>
                        </button>
                      ))
                    ) : (
                      <div className="py-6 text-center">
                        <Users size={20} className="text-slate-300 mx-auto mb-1.5" />
                        <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-relaxed">
                          Nenhum colega de turno<br />disponível de momento
                        </p>
                      </div>
                    )}
                  </div>
                </div>

                {transferLoading && (
                  <div className="flex items-center justify-center gap-2 text-[10px] font-bold text-orange-500 uppercase tracking-wider py-2 bg-orange-500/5 rounded-xl flex-shrink-0 animate-pulse">
                    <Loader2 size={12} className="animate-spin" />
                    A enviar contacto ao colega...
                  </div>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {isWhatsAppOpen && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsWhatsAppOpen(false)}
              className="fixed inset-0 bg-slate-950/70 backdrop-blur-md"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 30 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 30 }}
              className="relative w-full max-w-lg bg-white rounded-[2.5rem] p-6 space-y-6 shadow-2xl z-20 flex flex-col max-h-[90vh]"
            >
              <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                <h2 className="text-xl font-black uppercase tracking-tighter">Central WhatsApp</h2>
                <button onClick={() => setIsWhatsAppOpen(false)} className="p-2 hover:bg-slate-100 rounded-full">
                  <X size={20} />
                </button>
              </div>
              <WhatsAppMonitor isDriverView={true} isMechanicView={false} />
            </motion.div>
          </div>
        )}

        {/* Delegate / Transfer Customer Modal Overlay */}
        <AnimatePresence>
          {isTransferModalOpen && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsTransferModalOpen(false)}
                className="fixed inset-0 bg-slate-950/70 backdrop-blur-md"
              />
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 30 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 30 }}
                className="relative w-full max-w-lg bg-white rounded-[2.5rem] p-6 space-y-6 shadow-2xl z-20 flex flex-col max-h-[90vh]"
              >
                <div className="flex justify-between items-center pb-2 border-b border-slate-100">
                  <div>
                    <h3 className="text-sm font-black text-slate-900 uppercase tracking-tight">
                      Delegar Cliente
                    </h3>
                    <p className="text-[10px] font-medium text-slate-400 uppercase tracking-widest">
                      Frota SUPER Táxi / Luena
                    </p>
                  </div>
                  <button 
                    onClick={() => setIsTransferModalOpen(false)}
                    className="p-1.5 hover:bg-slate-100 rounded-full transition-all"
                  >
                    <X size={16} className="text-slate-500" />
                  </button>
                </div>

                <div className="overflow-y-auto pr-1 space-y-2 flex-1 max-h-[220px] no-scrollbar">
                  {otherDrivers.length > 0 ? (
                    otherDrivers.map((driver) => (
                      <button
                        key={driver.id}
                        disabled={transferLoading}
                        onClick={() => transferService(driver)}
                        className="w-full flex items-center justify-between p-3 bg-slate-50 hover:bg-brand-primary hover:text-white rounded-xl border border-slate-100 transition-all text-left group"
                      >
                        <div>
                          <p className="text-xs font-black text-slate-800 uppercase group-hover:text-white leading-tight">
                            {driver.name}
                          </p>
                          <p className="text-[9px] text-slate-400 uppercase font-bold group-hover:text-white/80 mt-1">
                            Viatura: {driver.prefix || "N/A"} • {driver.status || "Ativo"}
                          </p>
                        </div>
                        <div className="p-2 bg-white/80 text-brand-primary rounded-lg group-hover:bg-white group-hover:text-brand-primary shadow-sm transition-all">
                          <Navigation size={12} className="rotate-45" />
                        </div>
                      </button>
                    ))
                  ) : (
                    <div className="py-8 text-center animate-pulse">
                      <Users size={24} className="text-slate-300 mx-auto mb-2" />
                      <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-relaxed">
                        Nenhum motorista<br />disponível de momento
                      </p>
                    </div>
                  )}
                </div>

                {transferLoading && (
                  <div className="flex items-center justify-center gap-2 text-[10px] font-bold text-brand-primary uppercase tracking-wider py-2 bg-brand-primary/5 rounded-xl">
                    <Loader2 size={12} className="animate-spin" />
                    A reencaminhar serviço...
                  </div>
                )}
              </motion.div>
            </div>
          )}
        </AnimatePresence>

        {/* Incoming Service Notification Modal Overlay */}
        <AnimatePresence>
          {showNotification && (
            <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={forceDismissService}
                className="fixed inset-0 bg-slate-950/70 backdrop-blur-md"
              />
              <motion.div
                initial={{ scale: 0.95, opacity: 0, y: 30 }}
                animate={{ scale: 1, opacity: 1, y: 0 }}
                exit={{ scale: 0.95, opacity: 0, y: 30 }}
                className="relative w-full max-w-lg bg-white rounded-[2.5rem] p-6 sm:p-8 space-y-6 sm:space-y-8 shadow-2xl overflow-y-auto max-h-[90vh] no-scrollbar z-10"
              >
                <div className="absolute top-4 right-4">
                   <button 
                     onClick={forceDismissService}
                     className="w-10 h-10 flex flex-col items-center justify-center bg-slate-100 text-slate-500 rounded-full active:scale-95 transition-all text-[8px] font-black uppercase"
                   >
                     <XCircle size={16} className="mb-0.5" />
                     Sair
                   </button>
                </div>
                <div className="text-center space-y-2 pt-4">
                  <div className={cn(
                    "w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 border-2",
                    (currentService?.type === "direct_referral" || currentService?.isForwarded)
                      ? "bg-orange-500/10 border-orange-500/20 text-orange-500"
                      : "bg-brand-primary/10 border-brand-primary/20 text-brand-primary"
                  )}>
                    <Phone
                      size={32}
                      className="animate-bounce"
                    />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">
                    {(currentService?.type === "direct_referral" || currentService?.isForwarded) ? "Chamada Recebida!" : "Novo Serviço!"}
                  </h3>
                  <p className="text-sm font-medium text-slate-500 uppercase tracking-widest">
                    {(currentService?.type === "direct_referral" || currentService?.isForwarded) 
                      ? `De: ${currentService.transferredBy?.name || "Colega de Turno"}`
                      : "Pedido da Central PSM"
                    }
                  </p>
                </div>

                <div className="space-y-4 bg-slate-50 p-6 rounded-3xl border border-slate-100">
                  {(currentService?.type === "direct_referral" || currentService?.isForwarded) && (
                    <div className="bg-orange-50 border border-orange-200 p-3 rounded-2xl text-left mb-2">
                      <p className="text-[9px] font-black text-orange-800 uppercase tracking-wide">💡 NOTA DE REENCAMINHAMENTO</p>
                      <p className="text-[10px] text-orange-700 font-bold leading-tight mt-1">
                        O colega {currentService.transferredBy?.name || "de turno"} reencaminhou este cliente direto por estar muito ocupado com outras corridas de momento ou em Manutenção.
                      </p>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Passageiro
                    </span>
                    <span className="text-[11px] font-bold text-slate-800">
                      {currentService?.customerName || currentService?.passengerName || "Cliente Particular"}
                    </span>
                  </div>
                  {(currentService?.customerPhone || currentService?.passengerPhone) && (
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Telemóvel
                      </span>
                      <span className="text-[11px] font-black text-slate-800 tracking-wider">
                        {currentService.customerPhone || currentService.passengerPhone}
                      </span>
                    </div>
                  )}
                  {currentService?.passengerCount !== undefined && (
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Passageiros
                      </span>
                      <span className="text-[11px] font-black text-slate-800 font-mono">
                        {currentService.passengerCount} {currentService.passengerCount === 1 ? "Passageiro" : "Passageiros"}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Valor
                    </span>
                    <span className="text-[11px] font-black text-emerald-600 uppercase">
                      {currentService?.price ? `${currentService.price.toLocaleString()} AKZ` : "A Propor Preço"}
                    </span>
                  </div>
                  <div className="pt-4 border-t border-slate-200">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                      Ponto de Recolha
                    </p>
                    <p className="text-sm font-bold text-slate-800 leading-tight">
                      {currentService?.pickupAddress || currentService?.pickup || "Localização Detetada no Luena"}
                    </p>
                  </div>
                  {currentService?.destinationAddress || currentService?.destination ? (
                    <div className="pt-2 border-t border-slate-100">
                      <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                        Ponto de Destino
                      </p>
                      <p className="text-sm font-bold text-slate-800 leading-tight">
                        {currentService.destinationAddress || currentService.destination}
                      </p>
                    </div>
                  ) : null}
                </div>

                {currentService?.status === "pending" ? (
                  <div className="pt-4 border-t border-slate-200 flex gap-4">
                    <button
                      onClick={rejectService}
                      className="flex-1 py-5 rounded-3xl bg-slate-100 hover:bg-slate-200 text-slate-500 font-black text-xs uppercase tracking-widest transition-all active:scale-95 border border-slate-200"
                    >
                      Rejeitar (15s)
                    </button>
                    <button
                      onClick={attendCall}
                      className="flex-[2] py-5 rounded-3xl bg-emerald-500 hover:bg-emerald-400 text-white font-black text-xs uppercase tracking-widest transition-all active:scale-95 shadow-xl shadow-emerald-500/20 animate-pulse flex items-center justify-center gap-2"
                    >
                      <PhoneCall size={16} className="animate-bounce" />
                      Atender Chamada
                    </button>
                  </div>
                ) : currentService?.status === "connected" ? (
                  <div className="pt-4 border-t border-slate-200 space-y-4">
                    <div className="bg-emerald-50 border border-emerald-200 p-3 rounded-2xl text-center">
                      <p className="text-[10px] font-black text-emerald-600 uppercase tracking-widest">Chamada Atendida</p>
                      <p className="text-xs font-bold text-emerald-800 mt-0.5">Indique o preço ou reencaminhe</p>
                    </div>
                    <div className="space-y-3">
                      <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">
                        Propor Preço da Viagem (AKZ)
                      </p>
                      <div className="flex gap-2">
                        <input
                          type="number"
                          placeholder="Ex: 2500"
                          value={proposedPrice}
                          onChange={(e) => setProposedPrice(e.target.value)}
                          className="flex-1 bg-white border border-slate-200 rounded-xl px-4 py-3 text-sm font-bold text-slate-800 focus:outline-none focus:ring-2 focus:ring-brand-primary"
                        />
                        <button
                          onClick={() => sendPriceOffer()}
                          className="px-5 py-3 rounded-xl bg-slate-950 border border-slate-900 hover:bg-slate-900 text-white font-black text-xs uppercase tracking-wider transition-all shadow-lg"
                        >
                          PROPOR
                        </button>
                      </div>
                      <div className="flex gap-1.5 justify-between">
                        {[1500, 2000, 2500, 3000].map((val) => (
                          <button
                            key={val}
                            onClick={() => sendPriceOffer(val)}
                            className="flex-1 bg-white hover:bg-slate-100 py-2 rounded-lg text-[10px] font-black text-slate-600 transition-all border border-slate-200 shadow-sm"
                          >
                            {val.toLocaleString()} Kz
                          </button>
                        ))}
                      </div>
                    </div>
                    
                    <div className="pt-2">
                      <button 
                        onClick={() => setIsNewCallTransferModalOpen(true)}
                        className="w-full flex items-center justify-center gap-2 py-4 bg-slate-50 hover:bg-slate-100 text-slate-600 rounded-2xl border border-slate-200 transition-all text-xs font-black uppercase tracking-widest"
                      >
                        <RefreshCw size={14} />
                        Reencaminhar a Colega
                      </button>
                    </div>
                  </div>
                ) : currentService?.status === "confirmed" ? (
                  <div className="flex gap-4">
                    <button
                      onClick={rejectService}
                      className="flex-1 py-5 rounded-3xl bg-slate-100 hover:bg-slate-200 text-slate-500 font-black text-xs uppercase tracking-widest transition-all active:scale-95 border border-slate-200"
                    >
                      Recusar
                    </button>
                    <button
                      onClick={acceptService}
                      className="flex-[2] py-5 rounded-3xl bg-emerald-500 hover:bg-emerald-600 text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-200 transition-all active:scale-95 flex items-center justify-center gap-2 animate-pulse"
                    >
                      <PhoneCall size={16} />
                      INICIAR CORRIDA ACORDADA ({currentService.price?.toLocaleString()} Kz)
                    </button>
                  </div>
                ) : currentService?.status === "price_sent" ? (
                  <div className="space-y-3">
                    <div className="bg-blue-50 border border-blue-200 p-4 rounded-3xl text-center">
                      <p className="text-xs font-black text-blue-800 uppercase tracking-widest animate-pulse">A AGUARDAR O PASSAGEIRO VIP...</p>
                      <p className="text-[10px] text-blue-600 font-bold mt-1 uppercase">O preço proposto de {currentService.price?.toLocaleString()} Kz foi enviado. Tem o controlo na consola.</p>
                    </div>
                    <button
                      onClick={() => setShowNotification(false)}
                      className="w-full py-4 rounded-3xl bg-slate-900 hover:bg-black text-white font-black text-xs uppercase tracking-widest transition-all"
                    >
                      Ver no Painel Posterior
                    </button>
                  </div>
                ) : null}
              </motion.div>
            </div>
          )}
        </AnimatePresence>

      {/* Bottom Navigation */}
      <div className="fixed bottom-0 left-0 w-full bg-white border-t border-slate-200 flex justify-around items-center py-3 z-[100] shadow-[0_-4px_20px_rgba(0,0,0,0.05)]">
        {[
          { id: 'dashboard', label: 'Painel', icon: Layout },
            { id: 'history', label: 'Viagens', icon: History },
            { id: 'contracts', label: 'Contratos', icon: FileSignature },
            { id: 'rendas', label: 'Rendas', icon: Wallet },
          ].map(item => (
            <button
              key={item.id}
              onClick={() => setActiveInternalTab(item.id as any)}
              className={cn(
                "flex flex-col items-center gap-1 p-2 w-16 transition-all",
                activeInternalTab === item.id ? "text-brand-primary" : "text-slate-400"
              )}
            >
              <item.icon size={20} />
              <span className="text-[9px] font-black uppercase tracking-tighter">{item.label}</span>
            </button>
          ))}
        </div>

      {/* Passenger Cancellation Alert Popup for Driver */}
      <AnimatePresence>
        {lastCancelledService && (
          <div className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setLastCancelledService(null)}
              className="fixed inset-0 bg-slate-950/80 backdrop-blur-sm"
            />
            <motion.div
              initial={{ scale: 0.95, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.95, opacity: 0, y: 20 }}
              className="relative w-full max-w-md bg-white border border-rose-100 rounded-[2rem] p-6 text-slate-900 shadow-2xl z-10 space-y-5"
            >
              <div className="flex items-center gap-3 border-b border-rose-100 pb-3">
                <div className="w-10 h-10 bg-rose-50 rounded-full flex items-center justify-center text-rose-500 shrink-0">
                  <AlertTriangle size={20} />
                </div>
                <div>
                  <h3 className="text-sm font-black text-rose-600 uppercase tracking-wider leading-none">Chamada Cancelada</h3>
                  <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest mt-1">O passageiro encerrou a ligação</p>
                </div>
              </div>

              <div className="space-y-3 bg-rose-50/30 p-4 rounded-2xl border border-rose-100/40 text-xs">
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Passageiro:</span>
                  <span className="text-slate-900 font-black">{lastCancelledService.passengerName || "Passageiro de Luena"}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-slate-400 font-bold uppercase text-[10px]">Contacto:</span>
                  <span className="text-slate-900 font-black">{lastCancelledService.passengerPhone || "N/A"}</span>
                </div>
                <div className="flex justify-between items-center bg-white/50 p-2 rounded-xl border border-rose-100/40">
                  <span className="text-slate-400 font-bold uppercase text-[9px]">Origem:</span>
                  <span className="text-slate-900 font-black max-w-[200px] truncate">{lastCancelledService.pickup || "Centro de Luena"}</span>
                </div>
                <div className="flex justify-between items-center bg-white/50 p-2 rounded-xl border border-rose-100/40">
                  <span className="text-slate-400 font-bold uppercase text-[9px]">Destino:</span>
                  <span className="text-slate-900 font-black max-w-[200px] truncate">{lastCancelledService.destination || "Destino solicitado"}</span>
                </div>
              </div>

              <button
                onClick={() => setLastCancelledService(null)}
                className="w-full py-4 bg-rose-500 hover:bg-rose-600 text-white font-black text-xs uppercase tracking-widest rounded-2xl shadow-lg transition-all active:scale-95 text-center block"
              >
                Confirmar e Fechar
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
