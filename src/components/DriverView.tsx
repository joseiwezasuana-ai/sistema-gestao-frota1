// @ts-nocheck
import React, { useState, useEffect } from "react";
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
  FileSignature,
  X,
  Users,
  Loader2,
  ExternalLink,
  RefreshCw,
  Zap,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { cn } from "../lib/utils";
import { format } from "date-fns";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import {
  collection,
  query,
  where,
  onSnapshot,
  orderBy,
  limit,
  doc,
  updateDoc,
  serverTimestamp,
  arrayUnion,
  addDoc,
  getDocs,
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
  const [isOnline, setIsOnline] = useState(false);
  const [currentService, setCurrentService] = useState<any>(null);
  const [otherDrivers, setOtherDrivers] = useState<any[]>([]);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferLoading, setTransferLoading] = useState(false);
  const [isNewCallTransferModalOpen, setIsNewCallTransferModalOpen] = useState(false);
  const [transferCustomerPhone, setTransferCustomerPhone] = useState("");
  const [transferCustomerName, setTransferCustomerName] = useState("");
  const [transferPickupAddress, setTransferPickupAddress] = useState("");
  const [earnings, setEarnings] = useState(0);
  const [stars, setStars] = useState(4.8);
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
      where("status", "in", ["finalized", "paid_to_staff"]),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const total = snapshot.docs.reduce(
        (acc, doc) => acc + (doc.data().amount || 0),
        0,
      );
      setEarnings(total);
    }, (error) => handleFirestoreError(error, OperationType.GET, "revenue_logs"));

    return () => unsubscribe();
  }, [user.uid]);

  // Listen for trip history
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, "calls"),
      where("driverId", "==", user.uid),
      where("status", "==", "completed"),
      orderBy("timestamp", "desc"),
      limit(20),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setTripHistory(
        snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
      );
    }, (error) => handleFirestoreError(error, OperationType.GET, "calls"));

    return () => unsubscribe();
  }, [user.uid]);
  const [showNotification, setShowNotification] = useState(false);
  const [recentCalls, setRecentCalls] = useState<any[]>([]);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [activeInternalTab, setActiveInternalTab] = useState<
    "dashboard" | "history" | "wallet" | "contracts"
  >("dashboard");
  const [showPanicModal, setShowPanicModal] = useState(false);
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
  const [unreadMessages, setUnreadMessages] = useState<any[]>([]);
  const [isAiAdviceExpanded, setIsAiAdviceExpanded] = useState(false);
  const [isAlertsCollapsed, setIsAlertsCollapsed] = useState(true);

  // Listen for unread messages
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, "messages"),
      where("targets", "array-contains", user.uid),
      where("status", "==", "unread"),
      orderBy("timestamp", "desc"),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUnreadMessages(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    }, (error) => handleFirestoreError(error, OperationType.GET, "messages"));

    return () => unsubscribe();
  }, [user.uid]);

  // Listen for the active vehicle assignment for this driver
  useEffect(() => {
    if (!user?.name) return;
    const q = query(
      collection(db, "drivers"),
      where("name", "==", user.name),
      limit(1),
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const docRef = snapshot.docs[0];
        const vehicle = { id: docRef.id, ...docRef.data() };
        setAssignedVehicle(vehicle);
        // Default view to today's vehicle if on today's date
        if (viewContractsDate === new Date().toISOString().split("T")[0]) {
          setViewContractsPrefix(vehicle.prefix);
        }
      } else {
        setAssignedVehicle(null);
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, "drivers"));
    return () => unsubscribe();
  }, [user.name, viewContractsDate]);

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
        return (
          (isEntry || isExit) &&
          c.status === "Ativo" &&
          c.paymentStatus === "Pago"
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
  }, [user.uid, viewContractsDate]);

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
  }, [user.uid]);

  // Listen for rejected revenues
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, "revenue_logs"),
      where("driverId", "==", user.uid),
      where("status", "in", ["rejected_by_operator", "rejected_by_accountant"]),
      orderBy("timestamp", "desc"),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setRejectedRevenues(
        snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
      );
    }, (error) => handleFirestoreError(error, OperationType.GET, "revenue_logs"));

    return () => unsubscribe();
  }, [user.uid]);

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
        },
        description: revenueDetails.description,
        date: editingRevenueId 
          ? rejectedRevenues.find(r => r.id === editingRevenueId)?.date || new Date().toISOString().split("T")[0]
          : new Date().toISOString().split("T")[0],
        status: "vended_by_driver",
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

    // Listen for new calls assigned to this driver
    const q = query(
      collection(db, "calls"),
      where("driverId", "==", user.uid),
      where("status", "in", ["pending", "active"]),
      orderBy("timestamp", "desc"),
      limit(1),
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      if (!snapshot.empty) {
        const callData = snapshot.docs[0].data();
        if (callData.status === "pending" && !currentService) {
          setShowNotification(true);
          setCurrentService({ id: snapshot.docs[0].id, ...callData });
        } else if (callData.status === "active") {
          setCurrentService({ id: snapshot.docs[0].id, ...callData });
          setShowNotification(false);
        }
      } else {
        setCurrentService(null);
      }
    }, (error) => handleFirestoreError(error, OperationType.GET, "calls"));

    return () => unsubscribe();
  }, [user.uid, currentService]);

  // Listen for other active and available drivers in the fleet
  useEffect(() => {
    if (!user?.uid) return;
    const q = query(
      collection(db, "drivers"),
      where("status", "in", ["available", "ativo", "disponível"])
    );
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const driversList = snapshot.docs
        .map(doc => ({ id: doc.id, ...doc.data() }))
        .filter((d: any) => d.driverId !== user.uid && d.name !== user.name);
      setOtherDrivers(driversList);
    }, (error) => handleFirestoreError(error, OperationType.GET, "drivers"));

    return () => unsubscribe();
  }, [user.uid, user.name]);

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
      timeout = setTimeout(async () => {
        try {
          if (!currentService?.id) return;
          const callRef = doc(db, "calls", currentService.id);
          await updateDoc(callRef, {
            responseHistory: arrayUnion({
              action: "ignored",
              timestamp: new Date().toISOString(),
              driverId: user?.uid,
              driverName: user?.name,
            }),
          });
          setShowNotification(false);
          setCurrentService(null);
        } catch (error) {
          handleFirestoreError(error, OperationType.UPDATE, `calls/${currentService.id}`);
        }
      }, 45000); // 45 seconds timeout
    }
    return () => clearTimeout(timeout);
  }, [showNotification, currentService, user]);

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
      } finally {
        setAiLoading(false);
      }
    } else {
      setIsOnline(false);
      setCurrentService(null);
      setShowNotification(false);
    }
  };

  const confirmSafetyAndStart = () => {
    setIsOnline(true);
    setShowSafetyCheck(false);
  };

  const acceptService = async () => {
    if (!currentService) return;

    try {
      const callRef = doc(db, "calls", currentService.id);
      await updateDoc(callRef, {
        status: "active",
        acceptedAt: serverTimestamp(),
        responseHistory: arrayUnion({
          action: "accepted",
          timestamp: new Date().toISOString(),
          driverId: user?.uid,
          driverName: user?.name,
        }),
      });
      setShowNotification(false);
      setCurrentService({ ...currentService, status: "active" });
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `calls/${currentService.id}`);
    }
  };

  const rejectService = async () => {
    if (!currentService) return;

    try {
      const callRef = doc(db, "calls", currentService.id);
      await updateDoc(callRef, {
        status: "cancelled",
        cancelledAt: serverTimestamp(),
        responseHistory: arrayUnion({
          action: "rejected",
          timestamp: new Date().toISOString(),
          driverId: user?.uid,
          driverName: user?.name,
        }),
      });
      setShowNotification(false);
      setCurrentService(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `calls/${currentService.id}`);
    }
  };

  const finishService = async () => {
    if (!currentService) return;

    try {
      const callRef = doc(db, "calls", currentService.id);
      await updateDoc(callRef, {
        status: "completed",
        completedAt: serverTimestamp(),
        responseHistory: arrayUnion({
          action: "completed",
          timestamp: new Date().toISOString(),
          driverId: user?.uid,
          driverName: user?.name,
        }),
      });
      setEarnings((prev) => prev + (currentService?.price || 2500));
      setCurrentService(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `calls/${currentService.id}`);
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
    try {
      const trimmedPhone = transferCustomerPhone.trim();
      const phoneWithPrefix = trimmedPhone.startsWith('+244') 
        ? trimmedPhone 
        : trimmedPhone.startsWith('244')
          ? `+${trimmedPhone}`
          : `+244 ${trimmedPhone}`;
      
      await addDoc(collection(db, "calls"), {
        customerPhone: phoneWithPrefix,
        customerName: transferCustomerName || "Cliente Particular",
        pickupAddress: transferPickupAddress || "Chamada Direta Recebida por Telemóvel",
        destinationAddress: "A definir com o cliente",
        price: 2500,
        timestamp: new Date().toISOString(),
        driverId: targetDriver.driverId || targetDriver.id,
        driverName: targetDriver.name,
        driverInfo: {
          name: targetDriver.name,
          phone: targetDriver.phone || targetDriver.phoneNumber || '',
          vehicleModel: targetDriver.vehicleModel || targetDriver.brand || 'Táxi PSM',
          vehiclePlate: targetDriver.vehiclePlate || targetDriver.licensePlate || ''
        },
        status: "pending",
        type: "direct_referral",
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
    } catch (error) {
      handleFirestoreError(error, OperationType.ADD, "calls");
      alert("Erro ao reencaminhar contacto de cliente.");
    } finally {
      setTransferLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center p-4 min-h-[calc(100vh-160px)]">
      {/* Smartphone Container */}
      <div className="relative w-[340px] h-[680px] bg-slate-900 rounded-[3rem] border-[8px] border-slate-800 shadow-[0_0_50px_rgba(0,0,0,0.3)] overflow-hidden">
        {/* Notch */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-32 h-6 bg-slate-800 rounded-b-2xl z-50 flex items-center justify-center gap-1.5">
          <div className="w-1.5 h-1.5 rounded-full bg-slate-700" />
          <div className="w-8 h-1 rounded-full bg-slate-700" />
        </div>

        {/* Screen Content */}
        <div className="relative h-full bg-slate-50 flex flex-col font-sans overflow-y-auto custom-scrollbar pt-8">
          {/* Status Bar App Style */}
          <div className="px-6 py-2 flex items-center justify-between text-[11px] font-bold text-slate-400">
            <span>9:41</span>
            <div className="flex items-center gap-1.5">
              <Activity size={10} />
              <span>PSM Live</span>
            </div>
          </div>

          <header className="px-6 py-4 flex items-center justify-between bg-white border-b border-slate-100 sticky top-0 z-40">
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
              <button className="p-2 text-slate-400 hover:text-slate-600 transition-colors relative">
                <Bell size={20} />
                {unreadMessages.length > 0 && (
                  <span className="absolute top-1.5 right-1.5 w-2 h-2 bg-rose-500 rounded-full border-2 border-white animate-pulse" />
                )}
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

          <main className="flex-1 px-6 py-6 space-y-6">
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

            {activeInternalTab === "dashboard" ? (
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
                              onClick={() => { setActiveInternalTab("wallet"); setIsAlertsCollapsed(true); }}
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
                                  setActiveInternalTab("wallet");
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

                  {/* Shift Action Toggle and Emergency Button */}
                  <div className="flex items-center gap-3 mt-4 pt-3 border-t border-slate-800">
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
                  {isOnline && (
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
                        <div className="p-6 space-y-5 border-t border-slate-100">
                          <div className="flex items-start gap-4">
                            <div className="flex flex-col items-center gap-1.5 pt-1">
                              <div className="w-2.5 h-2.5 rounded-full bg-emerald-500 border-2 border-white ring-1 ring-emerald-500/30" />
                              <div className="w-0.5 h-8 bg-slate-200" />
                              <div className="w-2.5 h-2.5 rounded-full bg-brand-primary border-2 border-white ring-1 ring-brand-primary/20" />
                            </div>
                            <div className="flex-1 space-y-4">
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                                  Recolha
                                </p>
                                <p className="text-[13px] font-bold text-slate-800 leading-tight truncate">
                                  {currentService.pickupAddress}
                                </p>
                              </div>
                              <div>
                                <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                                  Destino
                                </p>
                                <p className="text-[13px] font-bold text-slate-800 leading-tight truncate">
                                  {currentService.destinationAddress}
                                </p>
                              </div>
                            </div>
                            <div className="text-right">
                              <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest mb-1">
                                Valor
                              </p>
                              <p className="text-[15px] font-black text-emerald-600">
                                {currentService.price || 2500}Kz
                              </p>
                            </div>
                          </div>

                          <div className="flex flex-col gap-2">
                            <div className="flex items-center gap-2">
                              <button className="flex-1 bg-slate-100 text-slate-600 p-3 rounded-xl font-bold text-[11px] transition-all hover:bg-slate-200">
                                NAVEGAR
                              </button>
                              <button
                                onClick={finishService}
                                className="flex-1 bg-brand-primary text-white p-3 rounded-xl font-bold text-[11px] transition-all hover:bg-brand-secondary shadow-lg shadow-brand-primary/20"
                              >
                                FINALIZAR
                              </button>
                            </div>
                            <button
                              onClick={() => setIsTransferModalOpen(true)}
                              className="w-full bg-slate-100 hover:bg-slate-200 p-3 rounded-xl font-bold text-[11px] transition-all flex items-center justify-center gap-2 border border-slate-200 shadow-sm text-slate-700"
                            >
                              <Users size={14} className="text-slate-500" />
                              DELEGAR / ENCAMINHAR CLIENTE
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Quick Actions (Call/Chat) */}
                  {currentService && (
                    <div className="grid grid-cols-2 gap-3">
                      <button className="flex items-center justify-center gap-3 bg-white border border-slate-200 p-4 rounded-2xl text-slate-700 transition-all hover:bg-slate-50 group">
                        <div className="p-2 bg-blue-50 text-blue-600 rounded-lg group-hover:bg-blue-100">
                          <Phone size={18} />
                        </div>
                        <span className="text-[11px] font-black uppercase">
                          Ligar Cliente
                        </span>
                      </button>
                      <button className="flex items-center justify-center gap-3 bg-white border border-slate-200 p-4 rounded-2xl text-slate-700 transition-all hover:bg-slate-50 group">
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
                              {(trip.price || 2500).toLocaleString()} Kz
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
                      <p className="text-[9px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
                        Viatura Ativa:{" "}
                        <span className="text-brand-primary font-black">
                          {viewContractsPrefix || "..."}
                        </span>
                      </p>
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

                {!assignedVehicle && (
                  <div className="bg-amber-50 border border-amber-100 p-4 rounded-2xl">
                    <p className="text-[10px] font-bold text-amber-700 leading-tight">
                      Atenção: Não possui uma viatura vinculada hoje. Contacte a
                      Central para ativar a sua escala e aceder aos contratos.
                    </p>
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
                        const pxV = assignedVehicle?.prefix || user.prefix;
                        const isE = contract.entryVehicleId?.includes(pxV);
                        const isX = contract.exitVehicleId?.includes(pxV);
                        const mType = isE ? "entry" : "exit";
                        const attStatus =
                          todayAttendance[`${contract.id}_${mType}`] ||
                          todayAttendance[contract.id];
                        return (
                          <div
                            key={contract.id}
                            className={cn(
                              "bg-white p-4 rounded-2xl border transition-all shadow-sm",
                              attStatus === "attended"
                                ? "border-emerald-100 bg-emerald-50/30"
                                : "border-slate-100",
                            )}
                          >
                            <div className="flex items-center justify-between mb-3">
                              <div className="flex-1 min-w-0 pr-4">
                                <div className="flex items-center gap-2">
                                  <h4 className="text-[11px] font-black text-slate-900 uppercase truncate">
                                    {contract.clientName}
                                  </h4>
                                  <div className="flex items-center gap-1 bg-slate-100 px-1 py-0.5 rounded text-[8px] font-black text-slate-600">
                                    <Users size={10} />
                                    {contract.occupants || 1}
                                  </div>
                                </div>
                                <div className="flex items-center gap-2 mt-1">
                                  <span className="text-[9px] font-bold text-slate-400 uppercase">
                                    {contract.neighborhood}
                                  </span>
                                  <span className="w-1 h-1 bg-slate-200 rounded-full" />
                                  {isE && (
                                    <span className="px-1.5 py-0.5 bg-emerald-100 text-emerald-700 rounded text-[8px] font-black uppercase tracking-tighter">
                                      LEVAR • {contract.entryTime}
                                    </span>
                                  )}
                                  {isX && (
                                    <span className="px-1.5 py-0.5 bg-rose-100 text-rose-700 rounded text-[8px] font-black uppercase tracking-tighter">
                                      BUSCAR • {contract.exitTime}
                                    </span>
                                  )}
                                </div>
                              </div>
                              <div className="flex flex-col items-end gap-1.5">
                                <div className="flex items-center gap-2">
                                  {contract.location && (
                                    <div className="w-5 h-5 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center">
                                      <MapPin size={10} />
                                    </div>
                                  )}
                                  <span
                                    className={`px-1.5 py-0.5 rounded text-[8px] font-black uppercase tracking-widest ${
                                      contract.status === "Ativo"
                                        ? "bg-emerald-50 text-emerald-600 border border-emerald-100"
                                        : "bg-slate-50 text-slate-400 border border-slate-100"
                                    }`}
                                  >
                                    {contract.status}
                                  </span>
                                </div>
                                <p className="text-[10px] font-black text-brand-primary">
                                  {contract.destination}
                                </p>
                              </div>
                            </div>

                            <div className="flex items-center gap-2 pt-3 border-t border-slate-100/50">
                              {contract.location && (
                                <a
                                  href={`https://www.google.com/maps/search/?api=1&query=${contract.location.lat},${contract.location.lng}`}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="flex-1 bg-blue-50 text-blue-600 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 border border-blue-100"
                                >
                                  <Navigation size={12} />
                                  Navegar
                                </a>
                              )}
                              {attStatus === "attended" ? (
                                <div className="w-full bg-emerald-500 text-white py-2 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 shadow-lg shadow-emerald-500/20">
                                  <CheckCircle2 size={12} />
                                  Atendimento Confirmado
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
                                  className="w-full bg-slate-900 text-white py-2 rounded-xl text-[9px] font-black uppercase tracking-widest flex items-center justify-center gap-2 active:scale-95 transition-all shadow-lg shadow-slate-200"
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
            ) : (
              <div className="space-y-6">
                <div className="bg-slate-900 rounded-3xl p-6 text-white relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/20 blur-3xl rounded-full -mr-16 -mt-16" />
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest relative z-10">
                    Balanço Total
                  </p>
                  <h2 className="text-3xl font-black mt-1 relative z-10">
                    {(earnings || 0).toLocaleString()} Kz
                  </h2>
                  <div className="mt-4 flex items-center gap-2 text-[10px] font-bold text-emerald-400 relative z-10">
                    <Activity size={10} />
                    <span>Sincronizado com Central Luena</span>
                  </div>
                </div>

                <div className="bg-white rounded-3xl p-6 border border-slate-100 space-y-4">
                  <div className="flex items-center gap-3 mb-2">
                    <div className="p-2 bg-brand-primary/10 text-brand-primary rounded-xl">
                      <Wallet size={18} />
                    </div>
                    <div>
                      <h4 className="text-xs font-black text-slate-800 uppercase tracking-widest leading-none">
                        Entrega de Renda
                      </h4>
                      <p className="text-[9px] text-slate-400 font-bold mt-1">
                        Declare o faturamento do dia para validação.
                      </p>
                    </div>
                  </div>

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
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-emerald-500"
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
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-emerald-500"
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
                          className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:border-emerald-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[9px] font-black text-red-400 uppercase tracking-widest ml-1">
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
                          className="w-full px-4 py-2.5 bg-red-50 border border-red-100 rounded-xl text-xs font-bold outline-none focus:border-red-400 text-red-600"
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
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-[10px] font-bold outline-none focus:border-slate-400"
                      />
                    </div>

                    <div className="pt-2">
                      <div className="flex items-center justify-between mb-2 px-1">
                        <span className="text-[10px] font-black text-slate-500 uppercase">
                          Líquido a Entregar:
                        </span>
                        <span className="text-sm font-black text-emerald-600">
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
                          "w-full py-3.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-lg",
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
                </div>
              </div>
            )}
          </main>

          {/* Tab Bar Sim */}
          <footer className="h-16 bg-white border-t border-slate-100 flex items-center justify-around px-6 flex-shrink-0">
            <button
              onClick={() => setActiveInternalTab("dashboard")}
              className={cn(
                "flex flex-col items-center gap-1",
                activeInternalTab === "dashboard"
                  ? "text-brand-primary"
                  : "text-slate-300",
              )}
            >
              <Activity size={20} />
              <span className="text-[9px] font-black uppercase">Painel</span>
            </button>
            <button
              onClick={() => setActiveInternalTab("history")}
              className={cn(
                "flex flex-col items-center gap-1",
                activeInternalTab === "history"
                  ? "text-brand-primary"
                  : "text-slate-300",
              )}
            >
              <History size={20} />
              <span className="text-[9px] font-black uppercase">Viagens</span>
            </button>
            <button
              onClick={() => setActiveInternalTab("contracts")}
              className={cn(
                "flex flex-col items-center gap-1",
                activeInternalTab === "contracts"
                  ? "text-brand-primary"
                  : "text-slate-300",
              )}
            >
              <FileSignature size={20} />
              <span className="text-[9px] font-black uppercase">Contratos</span>
            </button>
            <button
              onClick={() => setActiveInternalTab("wallet")}
              className={cn(
                "flex flex-col items-center gap-1",
                activeInternalTab === "wallet"
                  ? "text-brand-primary"
                  : "text-slate-300",
              )}
            >
              <Wallet size={20} />
              <span className="text-[9px] font-black uppercase">Rendas</span>
            </button>
          </footer>
        </div>

        {/* Panic Modal */}
        <AnimatePresence>
          {showPanicModal && (
            <div className="absolute inset-0 z-[100] flex items-center justify-center p-6 text-center">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-red-600/90 backdrop-blur-xl"
              />
              <motion.div
                initial={{ scale: 0.8, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                exit={{ scale: 0.8, opacity: 0 }}
                className="relative space-y-6"
              >
                <div className="w-24 h-24 bg-white/20 rounded-full flex items-center justify-center mx-auto border-4 border-white/30 animate-pulse">
                  <AlertTriangle size={48} className="text-white" />
                </div>
                <div className="space-y-2">
                  <h2 className="text-3xl font-black text-white uppercase tracking-tighter">
                    ALERTA ENVIADO!
                  </h2>
                  <p className="text-white/80 text-sm font-bold uppercase tracking-widest">
                    A Central no Luena já recebeu o seu sinal de socorro.
                  </p>
                </div>
                <button
                  onClick={() => setShowPanicModal(false)}
                  className="bg-white text-red-600 px-8 py-3 rounded-full font-black text-xs uppercase tracking-widest shadow-2xl"
                >
                  FECHAR AVISO
                </button>
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
                      <div className="mt-4 rounded-2xl overflow-hidden border border-slate-200 h-32 relative group">
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
                      placeholder="Ex: Sr. Carlos António"
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

        {/* Delegate / Transfer Customer Modal Overlay */}
        <AnimatePresence>
          {isTransferModalOpen && (
            <div className="absolute inset-0 z-[60] flex items-end p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                onClick={() => setIsTransferModalOpen(false)}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
              />
              <motion.div
                initial={{ y: 300, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 300, opacity: 0 }}
                className="relative w-full bg-white rounded-[2.5rem] p-6 space-y-6 shadow-2xl z-20 flex flex-col max-h-[85%]"
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
            <div className="absolute inset-0 z-[60] flex items-end p-4">
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="absolute inset-0 bg-slate-900/60 backdrop-blur-md"
              />
              <motion.div
                initial={{ y: 300, opacity: 0 }}
                animate={{ y: 0, opacity: 1 }}
                exit={{ y: 300, opacity: 0 }}
                className="relative w-full bg-white rounded-[2.5rem] p-8 space-y-8 shadow-2xl"
              >
                <div className="text-center space-y-2">
                  <div className={cn(
                    "w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-4 border-2",
                    currentService?.type === "direct_referral"
                      ? "bg-orange-500/10 border-orange-500/20 text-orange-500"
                      : "bg-brand-primary/10 border-brand-primary/20 text-brand-primary"
                  )}>
                    <Phone
                      size={32}
                      className="animate-bounce"
                    />
                  </div>
                  <h3 className="text-2xl font-black text-slate-900 tracking-tighter uppercase leading-none">
                    {currentService?.type === "direct_referral" ? "Chamada Recebida!" : "Novo Serviço!"}
                  </h3>
                  <p className="text-sm font-medium text-slate-500 uppercase tracking-widest">
                    {currentService?.type === "direct_referral" 
                      ? `De: ${currentService.transferredBy?.name || "Colega de Turno"}`
                      : "Pedido da Central PSM"
                    }
                  </p>
                </div>

                <div className="space-y-4 bg-slate-50 p-6 rounded-3xl border border-slate-100">
                  {currentService?.type === "direct_referral" && (
                    <div className="bg-orange-50 border border-orange-200 p-3 rounded-2xl text-left mb-2">
                      <p className="text-[9px] font-black text-orange-800 uppercase tracking-wide">💡 NOTA DE REENCAMINHAMENTO</p>
                      <p className="text-[10px] text-orange-700 font-bold leading-tight mt-1">
                        O colega {currentService.transferredBy?.name} reencaminhou este cliente direto por estar muito ocupado com outras corridas de momento.
                      </p>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Passageiro
                    </span>
                    <span className="text-[11px] font-bold text-slate-800">
                      {currentService?.customerName || "Cliente Particular"}
                    </span>
                  </div>
                  {currentService?.customerPhone && (
                    <div className="flex items-center justify-between">
                      <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                        Telemóvel
                      </span>
                      <span className="text-[11px] font-black text-slate-800 tracking-wider">
                        {currentService.customerPhone}
                      </span>
                    </div>
                  )}
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">
                      Estimativa
                    </span>
                    <span className="text-[11px] font-black text-emerald-600 uppercase">
                      2.500 AKZ
                    </span>
                  </div>
                  <div className="pt-4 border-t border-slate-200">
                    <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">
                      Ponto de Recolha
                    </p>
                    <p className="text-sm font-bold text-slate-800 leading-tight">
                      {currentService?.pickupAddress ||
                        "Localização Detetada no Luena"}
                    </p>
                  </div>
                </div>

                <div className="flex gap-4">
                  <button
                    onClick={rejectService}
                    className="flex-1 py-5 rounded-2xl bg-slate-100 text-slate-400 font-black text-xs uppercase tracking-widest transition-all active:scale-95"
                  >
                    Recusar
                  </button>
                  <button
                    onClick={acceptService}
                    className="flex-2 py-5 rounded-3xl bg-emerald-500 text-white font-black text-xs uppercase tracking-widest shadow-xl shadow-emerald-200 transition-all active:scale-95"
                  >
                    Aceitar Serviço
                  </button>
                </div>
              </motion.div>
            </div>
          )}
        </AnimatePresence>
      </div>

      {/* Side Legend for the Applet Interface */}
      <div className="hidden xl:block ml-12 max-w-sm space-y-8 animate-in fade-in slide-in-from-right duration-700">
        <div className="space-y-2">
          <div className="inline-flex items-center gap-2 px-3 py-1 bg-brand-primary/10 text-brand-primary rounded-full">
            <Smartphone size={14} />
            <span className="text-[10px] font-black uppercase tracking-widest">
              Interface do Motorista
            </span>
          </div>
          <h1 className="text-3xl font-black text-slate-900 leading-[1.1] tracking-tighter">
            Login & Tarefas do Motorista
          </h1>
          <p className="text-slate-500 text-sm font-medium leading-relaxed">
            Esta é a vista que os seus motoristas em Luena terão nos seus
            telemóveis. Simples, robusta e focada no serviço.
          </p>
        </div>

        <div className="space-y-4">
          <div className="flex gap-4 items-start">
            <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center shrink-0">
              <Power size={18} className="text-slate-900" />
            </div>
            <div>
              <h4 className="font-bold text-[13px] text-slate-900">
                Iniciar Turno
              </h4>
              <p className="text-[11px] text-slate-400 font-medium">
                O motorista entra "Em Serviço" para ficar visível na Central.
              </p>
            </div>
          </div>
          <div className="flex gap-4 items-start">
            <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center shrink-0">
              <Bell size={18} className="text-emerald-500" />
            </div>
            <div>
              <h4 className="font-bold text-[13px] text-slate-900">
                Receção Automática
              </h4>
              <p className="text-[11px] text-slate-400 font-medium">
                Pedidos enviados pela Central aparecem como notificações
                críticas.
              </p>
            </div>
          </div>
          <div className="flex gap-4 items-start">
            <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center shrink-0">
              <AlertTriangle size={18} className="text-red-500" />
            </div>
            <div>
              <h4 className="font-bold text-[13px] text-slate-900">
                Botão de Pânico
              </h4>
              <p className="text-[11px] text-slate-400 font-medium">
                Em caso de perigo, o motorista emite um S.O.S imediato para a
                central.
              </p>
            </div>
          </div>
          <div className="flex gap-4 items-start">
            <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center shrink-0">
              <Wallet size={18} className="text-indigo-500" />
            </div>
            <div>
              <h4 className="font-bold text-[13px] text-slate-900">
                Entrega de Renda
              </h4>
              <p className="text-[11px] text-slate-400 font-medium">
                Controlo financeiro digital da arrecadação diária.
              </p>
            </div>
          </div>
          <div className="flex gap-4 items-start">
            <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 shadow-sm flex items-center justify-center shrink-0">
              <Wrench size={18} className="text-slate-600" />
            </div>
            <div>
              <h4 className="font-bold text-[13px] text-slate-900">
                Saúde da Viatura
              </h4>
              <p className="text-[11px] text-slate-400 font-medium">
                A Central monitoriza as manutenções necessárias para cada carro.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
