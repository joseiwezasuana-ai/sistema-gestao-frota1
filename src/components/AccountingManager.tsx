import React, { useState, useEffect } from "react";
import {
  Calculator,
  TrendingUp,
  FileText,
  Download,
  ArrowUpRight,
  ArrowDownRight,
  Wallet,
  Calendar,
  Search,
  Filter,
  Users,
  CheckCircle2,
  Clock,
  Send,
  Loader2,
  ChevronRight,
  AlertCircle,
  ShieldCheck,
  Info,
  User,
  ArrowRightLeft,
  X,
  Plus,
  Trash2,
  Pencil,
  Printer,
  Package,
} from "lucide-react";
import { motion, AnimatePresence } from "motion/react";
import { jsPDF } from "jspdf";
import html2canvas from 'html2canvas';
import { InvoiceViewerModal } from './InvoiceViewerModal';
import autoTable from "jspdf-autotable";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip as RechartsTooltip,
  ResponsiveContainer,
  LineChart,
  Line,
  Cell,
  PieChart,
  Pie,
} from "recharts";
import { db, handleFirestoreError, OperationType } from "../lib/firebase";
import {
  collection,
  query,
  orderBy,
  onSnapshot,
  doc,
  updateDoc,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
  deleteDoc,
  writeBatch,
} from "firebase/firestore";
import { cn } from "../lib/utils";
import RevenueManagement from "./RevenueManagement";
import InvoiceDrafting from "./InvoiceDrafting";

export default function AccountingManager({ user }: { user?: any }) {
  const [activeView, setActiveView] = useState<
    "revenue" | "income" | "salaries" | "individual" | "balance" | "invoicing"
  >("income");
  const [finalizedRevenues, setFinalizedRevenues] = useState<any[]>([]);
  const [salarySheets, setSalarySheets] = useState<any[]>([]);
  const [individualReports, setIndividualReports] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [isProcessing, setIsProcessing] = useState(false);
  const [editingReport, setEditingReport] = useState<string | null>(null);
  const [discountValue, setDiscountValue] = useState<number>(0);
  const [selectedStaffForReport, setSelectedStaffForReport] =
    useState<string>("");
  const [detailedReportData, setDetailedReportData] = useState<any>(null);
  const [isReceiptModalOpen, setIsReceiptModalOpen] = useState(false);
  const [activeReceipt, setActiveReceipt] = useState<any>(null);
  const [receiptMonth, setReceiptMonth] = useState("");
  const [isPrintingInvoice, setIsPrintingInvoice] = useState<string | null>(null);
  const [isInvoiceViewerOpen, setIsInvoiceViewerOpen] = useState(false);
  const [selectedInvoiceData, setSelectedInvoiceData] = useState<any>(null);

  const isAdmin =
    user?.email === "joseiwezasuana@gmail.com" || user?.role === "admin";
  const isAccountant = user?.role === "contabilista";

  const exportToPDF = (type: "salary" | "report" | "balance", data: any) => {
    try {
      const doc = new jsPDF();

      // Header
      doc.setFontSize(22);
      doc.setTextColor(15, 23, 42); // slate-900
      doc.text("PSM COMERCIAL LUENA MOXICO", 105, 20, { align: "center" });
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139); // slate-500
      doc.text("HUB DE CONTABILIDADE & GESTÃO DE FROTA", 105, 28, {
        align: "center",
      });
      doc.setDrawColor(226, 232, 240); // slate-200
      doc.line(15, 35, 195, 35);

      if (type === "salary") {
        doc.setFontSize(14);
        doc.setTextColor(15, 23, 42);
        doc.text(`FOLHA DE SALÁRIO - ${data.month}`, 15, 45);

        const tableData = (data.staff || []).map((s: any) => [
          s.name,
          s.role,
          `${(s.baseSalary || 0).toLocaleString()} Kz`,
          `${(s.subsSalary || 0).toLocaleString()} Kz`,
          `${((s.baseSalary || 0) + (s.subsSalary || 0)).toLocaleString()} Kz`,
        ]);

        autoTable(doc, {
          startY: 55,
          head: [["Colaborador", "Cargo", "Base", "Subsídios", "Total"]],
          body: tableData,
          theme: "grid",
          headStyles: { fillColor: [15, 23, 42] },
        });
      } else if (type === "report") {
        doc.setFontSize(14);
        doc.text(
          `EXTRATO INDIVIDUAL: ${data.staffName || "Colaborador"}`,
          15,
          45,
        );

        const tableData = (data.logs || []).map((l: any) => [
          l.date,
          l.prefix,
          `${(l.amount || 0).toLocaleString()} Kz`,
          l.status.toUpperCase(),
        ]);

        autoTable(doc, {
          startY: 55,
          head: [["Data", "Placa/Prefixo", "Valor Bruto", "Estado"]],
          body: tableData,
          theme: "striped",
        });
      }

      doc.setFontSize(8);
      doc.text(
        `Documento gerado automaticamente pelo TaxiControl em ${new Date().toLocaleString()}`,
        105,
        285,
        { align: "center" },
      );
      doc.save(`PSM_${type}_${Date.now()}.pdf`);
    } catch (err) {
      console.error("Erro ao gerar PDF:", err);
      alert(
        "Erro ao gerar PDF. Verifique se as bibliotecas jspdf estão carregadas.",
      );
    }
  };

  // Month filter (current month by default)
  const [currentMonth] = useState(new Date().toISOString().slice(0, 7));

  const [administrativeStaff, setAdministrativeStaff] = useState<any[]>([]);
  const [showAdminStaffForm, setShowAdminStaffForm] = useState(false);
  const [newAdminStaff, setNewAdminStaff] = useState({
    name: "",
    role: "",
    base: 0,
    subs: 0,
    phone: "",
  });
  const [editingAdminStaffId, setEditingAdminStaffId] = useState<string | null>(
    null,
  );

  const [driversMaster, setDriversMaster] = useState<any[]>([]);

  useEffect(() => {
    // 1. Fetch FINALIZED revenues for the current month
    const qRev = query(
      collection(db, "revenue_logs"),
      where("status", "==", "finalized"),
      orderBy("timestamp", "desc"),
    );
    const unsubRev = onSnapshot(qRev, (snapshot) => {
      // Local filter as extra safety
      setFinalizedRevenues(
        snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((r: any) => r.status !== 'archived')
      );
    }, (error) => handleFirestoreError(error, OperationType.GET, "revenue_logs"));

    // 2. Fetch Salary Sheets
    const qSal = query(
      collection(db, "salary_sheets"),
      orderBy("month", "desc"),
    );
    const unsubSal = onSnapshot(qSal, (snapshot) => {
      setSalarySheets(
        snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((s: any) => s.status !== 'archived')
      );
    }, (error) => handleFirestoreError(error, OperationType.GET, "salary_sheets"));

    // 3. Fetch Individual Reports
    const qInd = query(
      collection(db, "individual_reports"),
      where("month", "==", currentMonth),
      orderBy("driverName", "asc"),
    );
    const unsubInd = onSnapshot(qInd, (snapshot) => {
      setIndividualReports(
        snapshot.docs
          .map((doc) => ({ id: doc.id, ...doc.data() }))
          .filter((r: any) => r.status !== 'archived')
      );
    }, (error) => handleFirestoreError(error, OperationType.GET, "individual_reports"));

    // 4. Fetch Administrative Staff
    const qAdmin = query(
      collection(db, "administrative_staff"),
      orderBy("name", "asc"),
    );
    const unsubAdmin = onSnapshot(qAdmin, (snapshot) => {
      setAdministrativeStaff(
        snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
      );
    }, (error) => handleFirestoreError(error, OperationType.GET, "administrative_staff"));

    // 5. Fetch Drivers Master (for salary configs)
    const qDrivers = query(collection(db, "drivers_master"));
    const unsubDrivers = onSnapshot(qDrivers, (snapshot) => {
      setDriversMaster(
        snapshot.docs.map((doc) => ({ id: doc.id, ...doc.data() })),
      );
      setLoading(false);
    }, (error) => handleFirestoreError(error, OperationType.GET, "drivers_master"));

    return () => {
      unsubRev();
      unsubSal();
      unsubInd();
      unsubAdmin();
      unsubDrivers();
    };
  }, [currentMonth]);

  const handleAddAdminStaff = async () => {
    if (!newAdminStaff.name || !newAdminStaff.role) return;
    try {
      if (editingAdminStaffId) {
        await updateDoc(
          doc(db, "administrative_staff", editingAdminStaffId),
          newAdminStaff,
        );
        setEditingAdminStaffId(null);
      } else {
        await addDoc(collection(db, "administrative_staff"), newAdminStaff);
      }
      setNewAdminStaff({ name: "", role: "", base: 0, subs: 0, phone: "" });
      setShowAdminStaffForm(false);
    } catch (error) {
      handleFirestoreError(error, editingAdminStaffId ? OperationType.UPDATE : OperationType.CREATE, 'administrative_staff');
    }
  };

  const handleEditAdminStaff = (staff: any) => {
    setNewAdminStaff({
      name: staff.name,
      role: staff.role,
      base: staff.base || 0,
      subs: staff.subs || 0,
      phone: staff.phone || "",
    });
    setEditingAdminStaffId(staff.id);
    setShowAdminStaffForm(true);
  };

  const handleDeleteAdminStaff = async (id: string) => {
    if (confirm("Remover este funcionário administrativo?")) {
      await deleteDoc(doc(db, "administrative_staff", id));
    }
  };

  const generateIndividualSlip = (person: any, month: string) => {
    // Robust mapping of subsidy fields from different potential source structures
    const subs = person.subs || 0;
    const subsAliment = person.subsAliment || 0;
    const subsTransp = person.subsTransp || 0;
    
    setActiveReceipt({
      name: person.name || person.driverName,
      categoria: person.role || "Colaborador",
      dataProcessamento: new Date().toLocaleDateString(),
      diasTrabalho: person.days || 30,
      salarioBase: person.baseSalary || person.commissions || 0,
      subsidioAlimentacao: subs > 0 ? subs / 2 : subsAliment,
      subsidioTransporte: subs > 0 ? subs / 2 : subsTransp,
      subsidioFerias: person.subsidioFerias || 0,
      subsidioReforco: person.subsidioReforco || 0,
      subsidioRenda1: person.subsidioRenda1 || 0,
      subsidioRenda2: person.subsidioRenda2 || 0,
      subsidioRenda3: person.subsidioRenda3 || 0,
      descontoDanos: person.descontoDanos || 0,
      numeroFaltas: person.numeroFaltas || 0,
      outrosDescontos: person.discounts || person.totalDiscounts || 0,
    });
    setReceiptMonth(month);
    setIsReceiptModalOpen(true);
  };

  const calculateReceiptTotals = (data: any) => {
    const totalRemun = 
      (Number(data.salarioBase) || 0) + 
      (Number(data.subsidioFerias) || 0) + 
      (Number(data.subsidioAlimentacao) || 0) + 
      (Number(data.subsidioTransporte) || 0) + 
      (Number(data.subsidioReforco) || 0) + 
      (Number(data.subsidioRenda1) || 0) + 
      (Number(data.subsidioRenda2) || 0) + 
      (Number(data.subsidioRenda3) || 0);
    const totalDisc = (Number(data.descontoDanos) || 0) + (Number(data.outrosDescontos) || 0);
    const net = totalRemun - totalDisc;
    return { totalRemun, totalDisc, net };
  };

  const handleDownloadReceiptPDF = (data: any) => {
    try {
      const doc = new jsPDF();
      const pageWidth = doc.internal.pageSize.width;
      const { totalRemun, totalDisc, net } = calculateReceiptTotals(data);

      // Header
      doc.setFontSize(22);
      doc.setTextColor(15, 23, 42); 
      doc.text("PSM COMERCIAL LUENA MOXICO", pageWidth / 2, 20, { align: "center" });
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text("RECIBO DE SALÁRIO - PROCESSAMENTO ELECTRÓNICO", pageWidth / 2, 28, { align: "center" });
      doc.setDrawColor(226, 232, 240);
      doc.line(15, 35, pageWidth - 15, 35);

      // Info Table
      doc.setFontSize(10);
      doc.setTextColor(15, 23, 42);
      doc.text(`NOME: ${data.name}`, 15, 45);
      doc.text(`CATEGORIA: ${data.categoria}`, 15, 51);
      doc.text(`DATA: ${data.dataProcessamento}`, pageWidth - 15, 45, { align: "right" });
      doc.text(`MÊS REF: ${receiptMonth}`, pageWidth - 15, 51, { align: "right" });

      // Remunerations
      const remunerations = [
        ["Dias de Trabalho", `${data.diasTrabalho} dias`],
        ["Salário Base", `${Number(data.salarioBase)?.toLocaleString()} Kz`],
        ["Subsídio de Férias", `${Number(data.subsidioFerias)?.toLocaleString()} Kz`],
        ["Subsídio de Alimentação", `${Number(data.subsidioAlimentacao)?.toLocaleString()} Kz`],
        ["Subsídio de Transporte", `${Number(data.subsidioTransporte)?.toLocaleString()} Kz`],
        ["Subsídio de Reforço", `${Number(data.subsidioReforco)?.toLocaleString()} Kz`],
        ["Subsídio de Renda 1", `${Number(data.subsidioRenda1)?.toLocaleString()} Kz`],
        ["Subsídio de Renda 2", `${Number(data.subsidioRenda2)?.toLocaleString()} Kz`],
        ["Subsídio de Renda 3", `${Number(data.subsidioRenda3)?.toLocaleString()} Kz`],
      ];

      const discountsTable = [
        ["Desconto de Danos", `${Number(data.descontoDanos)?.toLocaleString()} Kz`],
        ["Nº de Faltas", `${data.numeroFaltas}`],
        ["Outros Descontos", `${Number(data.outrosDescontos)?.toLocaleString()} Kz`],
      ];

      autoTable(doc, {
        startY: 60,
        head: [["REMUNERAÇÕES", "VALOR"]],
        body: remunerations,
        theme: "striped",
        headStyles: { fillColor: [15, 23, 42] },
      });

      autoTable(doc, {
        startY: (doc as any).lastAutoTable.finalY + 10,
        head: [["DESCONTOS", "VALOR"]],
        body: discountsTable,
        theme: "striped",
        headStyles: { fillColor: [220, 38, 38] },
      });

      const finalY = (doc as any).lastAutoTable.finalY + 15;
      doc.setFontSize(11);
      doc.setFont("helvetica", "bold");
      doc.text(`TOTAL BRUTO: ${totalRemun.toLocaleString()} Kz`, pageWidth - 15, finalY, { align: "right" });
      doc.text(`TOTAL DESCONTOS: ${totalDisc.toLocaleString()} Kz`, pageWidth - 15, finalY + 7, { align: "right" });
      doc.setFontSize(14);
      doc.setTextColor(16, 185, 129);
      doc.text(`SALÁRIO LÍQUIDO: ${net.toLocaleString()} Kz`, pageWidth - 15, finalY + 18, { align: "right" });

      doc.setFontSize(8);
      doc.setTextColor(148, 163, 184);
      doc.text("Este documento é um recibo de salário gerado electronicamente.", pageWidth / 2, 285, { align: "center" });

      doc.save(`RECIBO_PSM_${data.name}_${receiptMonth}.pdf`);
    } catch (err) {
      console.error(err);
      alert("Erro ao gerar PDF.");
    }
  };

  const handleSendWhatsApp = (data: any) => {
    const { totalRemun, totalDisc, net } = calculateReceiptTotals(data);
    const month = receiptMonth;
    
    // Find person's phone in master lists
    const driver = driversMaster.find(d => d.name === data.name);
    const admin = administrativeStaff.find(a => a.name === data.name);
    let phone = driver?.phone || admin?.phone;
    
    if (!phone) {
       const manualPhone = prompt("TElEFONE NÃO ENCONTRADO. Digite o número (ex: 923...):");
       if (!manualPhone) return;
       phone = manualPhone;
    }
    
    // Format phone
    let cleanPhone = phone.replace(/\D/g, '');
    if (!cleanPhone.startsWith('244')) {
      cleanPhone = '244' + cleanPhone;
    }
    
    const message = `*BILHETE DE SALÁRIO - PSM COMERCIAL*\n\n` +
      `Olá *${data.name}*,\n` +
      `O seu bilhete de salário referente a *${month}* já está disponível.\n\n` +
      `*RESUMO FINANCEIRO:*\n` +
      `• Vencimento Bruto: ${totalRemun.toLocaleString()} Kz\n` +
      `• Descontos Totais: ${totalDisc.toLocaleString()} Kz\n` +
      `• *LADO LÍQUIDO A RECEBER: ${net.toLocaleString()} Kz*\n\n` +
      `Data de Processamento: ${data.dataProcessamento}\n` +
      `Gestão TaxiControl - Luena, Moxico`;
      
    const whatsappUrl = `https://wa.me/${cleanPhone}?text=${encodeURIComponent(message)}`;
    window.open(whatsappUrl, '_blank');
  };

  const handleOpenInvoiceViewer = (rev: any) => {
    // Map RevenueLog to InvoiceData
    const invoiceData = {
      id: rev.id,
      client: rev.driverName || "CLIENTE GERAL",
      vehicle: rev.prefix || rev.vehiclePrefix || "PSM-FLEET",
      startDate: rev.date || new Date().toISOString(),
      endDate: rev.date || new Date().toISOString(),
      dailyPrice: rev.amount || 0,
      createdAt: rev.timestamp
    };

    setSelectedInvoiceData(invoiceData);
    setIsInvoiceViewerOpen(true);
  };

  const handleGenerateSheet = async () => {
    setIsProcessing(true);
    try {
      // 1. Fetch only Approved Individual Reports (by Admin)
      const approvedReports = individualReports.filter(
        (r) => r.status === "approved_by_admin",
      );

      if (approvedReports.length === 0) {
        alert(
          "Nenhum relatório individual foi aprovado pelo Admin ainda. Aprove os relatórios primeiro.",
        );
        return;
      }

      const driverStaff = approvedReports.map((report) => {
        const grossSalary = report.baseSalary + report.subs;
        const inssEmployee = grossSalary * 0.03;
        const netSalary = grossSalary - inssEmployee - (report.discounts || 0);

        return {
          id: report.driverId,
          name: report.driverName,
          role: "Motorista",
          baseSalary: report.baseSalary,
          subsAliment: report.subs / 2,
          subsTransp: report.subs / 2,
          grossSalary,
          inssEmployee,
          inssEmployer: grossSalary * 0.08,
          irt: 0,
          discounts: report.discounts || 0,
          netSalary,
          status: "pending",
        };
      });

      // 2. Add Administrative Staff (From Firestore)
      const adminStaffMapped = administrativeStaff.map((admin) => {
        const grossSalary = (admin.base || 0) + (admin.subs || 0);
        const inssEmployee = grossSalary * 0.03;
        return {
          id: admin.id,
          name: admin.name,
          role: admin.role,
          baseSalary: admin.base || 0,
          subsAliment: (admin.subs || 0) / 2,
          subsTransp: (admin.subs || 0) / 2,
          grossSalary,
          inssEmployee,
          inssEmployer: grossSalary * 0.08,
          irt: 0,
          discounts: 0,
          netSalary: grossSalary - inssEmployee,
          status: "pending",
        };
      });

      const fullStaffList = [...driverStaff, ...adminStaffMapped];

      await addDoc(collection(db, "salary_sheets"), {
        month: currentMonth,
        status: "draft",
        totalPayable: fullStaffList.reduce((acc, s) => acc + s.netSalary, 0),
        totalBruto: fullStaffList.reduce((acc, s) => acc + s.grossSalary, 0),
        totalInssEmployee: fullStaffList.reduce(
          (acc, s) => acc + s.inssEmployee,
          0,
        ),
        totalInssEmployer: fullStaffList.reduce(
          (acc, s) => acc + s.inssEmployer,
          0,
        ),
        totalIrt: fullStaffList.reduce((acc, s) => acc + s.irt, 0),
        staff: fullStaffList,
        createdAt: serverTimestamp(),
      });
      alert(
        "Folha de Salário Gerada com Sucesso baseada nos relatórios e staff administrativo!",
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.CREATE, 'salary_sheets');
    } finally {
      setIsProcessing(false);
    }
  };

  const exportMapToPDF = () => {
    try {
      const doc = new jsPDF();
      doc.setFontSize(22);
      doc.setTextColor(15, 23, 42);
      doc.text("PSM COMERCIAL LUENA MOXICO", 105, 20, { align: "center" });
      doc.setFontSize(10);
      doc.setTextColor(100, 116, 139);
      doc.text("MAPA DE RENDIMENTOS - FECHO DE CAIXA", 105, 28, {
        align: "center",
      });
      doc.line(15, 35, 195, 35);

      const tableData = finalizedRevenues.map((rev) => [
        rev.driverName,
        rev.date,
        `${((rev.breakdown?.tpa || 0) + (rev.breakdown?.cash || 0) + (rev.breakdown?.transfer || 0)).toLocaleString()} Kz`,
        `${(rev.breakdown?.expenses || 0).toLocaleString()} Kz`,
        `${(rev.amount || 0).toLocaleString()} Kz`,
      ]);

      autoTable(doc, {
        startY: 45,
        head: [["Colaborador", "Data", "Bruto", "Custos", "Líquido PSM"]],
        body: tableData,
        theme: "grid",
        headStyles: { fillColor: [15, 23, 42] },
      });

      doc.save(`mapa_rendimento_${currentMonth}.pdf`);
    } catch (err) {
      console.error(err);
    }
  };

  const handleResetAccountingCycle = async () => {
    if (!isAdmin) return;
    if (
      !confirm(
        "Deseja zerar o ciclo da contabilidade? Todos os relatórios individuais, folhas de salário, rendimentos e despesas ativos serão arquivados. Esta operação é irreversível.",
      )
    )
      return;

    setIsProcessing(true);
    try {
      // 1. Archer Revenue Logs
      const revDocs = await getDocs(query(collection(db, "revenue_logs"), where("status", "!=", "archived")));
      
      const chunks = [];
      for (let i = 0; i < revDocs.docs.length; i += 500) {
        chunks.push(revDocs.docs.slice(i, i + 500));
      }

      for (const chunk of chunks) {
        const batch = writeBatch(db);
        chunk.forEach(d => {
          batch.update(d.ref, { status: "archived", archivedAt: serverTimestamp() });
        });
        await batch.commit();
      }

      // 2. Archive Individual Reports
      const reportBatch = writeBatch(db);
      individualReports.forEach(report => {
        if (report.status !== "archived") {
          reportBatch.update(doc(db, "individual_reports", report.id), { status: "archived" });
        }
      });
      try { await reportBatch.commit(); } catch (e) {}

      // 3. Archive Salary Sheets
      const sheetBatch = writeBatch(db);
      salarySheets.forEach(sheet => {
        if (sheet.status !== "archived") {
          sheetBatch.update(doc(db, "salary_sheets", sheet.id), { status: "archived" });
        }
      });
      try { await sheetBatch.commit(); } catch (e) {}

      // 4. Archive Expense Logs
      const expDocs = await getDocs(query(collection(db, "expense_logs"), where("status", "==", "approved")));
      const expBatch = writeBatch(db);
      expDocs.docs.forEach(d => expBatch.update(d.ref, { status: "archived" }));
      try { await expBatch.commit(); } catch (e) {}

      // 5. Reset Internal Contracts
      const internalDocs = await getDocs(query(collection(db, "internal_contracts"), where("paymentStatus", "==", "Pago")));
      const internalBatch = writeBatch(db);
      internalDocs.docs.forEach(d => internalBatch.update(d.ref, { paymentStatus: "Pendente" }));
      try { await internalBatch.commit(); } catch (e) {}

      // 6. Reset Driver/Vehicle Call Counts (The "2" alert fix)
      const driversDocs = await getDocs(collection(db, "drivers"));
      const driversBatch = writeBatch(db);
      driversDocs.docs.forEach(d => {
        driversBatch.update(d.ref, { 
          callCount: 0,
          recentCalls: [] 
        });
      });
      try { await driversBatch.commit(); } catch (e) {}

      alert("Ciclo contábil reiniciado com sucesso! Todos os contadores e alertas foram zerados.");
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, "accounting_cycle_reset");
      alert("Erro ao reiniciar ciclo contábil.");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleResetMonthlyReports = async () => {
    if (!isAdmin) return;
    if (!confirm("Deseja apagar permanentemente todos os relatórios individuais deste mês?")) return;
    
    setIsProcessing(true);
    try {
      const batch = writeBatch(db);
      individualReports.forEach(report => {
        batch.delete(doc(db, "individual_reports", report.id));
      });
      await batch.commit();
      alert("Relatórios individuais removidos com sucesso.");
    } catch (error) {
      handleFirestoreError(error, OperationType.DELETE, "individual_reports");
    } finally {
      setIsProcessing(false);
    }
  };

  const handleGenerateIndividualReports = async () => {
    setIsProcessing(true);
    try {
      // 1. Group revenue logs by driver for the current month
      const driverMap = new Map();
      
      finalizedRevenues.forEach(rev => {
        if (!driverMap.has(rev.driverId)) {
          driverMap.set(rev.driverId, {
            driverName: rev.driverName,
            totalGross: 0,
            totalCosts: 0,
            revenueCount: 0
          });
        }
        const stats = driverMap.get(rev.driverId);
        stats.totalGross += (rev.breakdown?.tpa || 0) + (rev.breakdown?.cash || 0) + (rev.breakdown?.transfer || 0);
        stats.totalCosts += (rev.breakdown?.expenses || 0);
        stats.revenueCount += 1;
      });

      const batch = writeBatch(db);
      for (const [driverId, stats] of driverMap.entries()) {
        const netIncome = stats.totalGross - stats.totalCosts;
        const tenPercent = netIncome * 0.1;
        
        // Check if report already exists for this driver/month
        const existing = individualReports.find(r => r.driverId === driverId);
        if (existing) {
          batch.update(doc(db, "individual_reports", existing.id), {
            totalGross: stats.totalGross,
            totalCosts: stats.totalCosts,
            baseSalary: tenPercent,
            days: stats.revenueCount,
            updatedAt: serverTimestamp()
          });
        } else {
          const newReportRef = doc(collection(db, "individual_reports"));
          batch.set(newReportRef, {
            driverId,
            driverName: stats.driverName,
            totalGross: stats.totalGross,
            totalCosts: stats.totalCosts,
            baseSalary: tenPercent,
            subs: 0,
            discounts: 0,
            days: stats.revenueCount,
            month: currentMonth,
            status: "pending",
            createdAt: serverTimestamp()
          });
        }
      }
      
      await batch.commit();
      alert("Relatórios individuais sincronizados com sucesso!");
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, "individual_reports");
    } finally {
      setIsProcessing(false);
    }
  };

  const totalGrossIncome = finalizedRevenues.reduce(
    (acc, curr) =>
      acc +
      (curr.breakdown?.tpa || 0) +
      (curr.breakdown?.cash || 0) +
      (curr.breakdown?.transfer || 0),
    0,
  );
  const totalExpenses = finalizedRevenues.reduce(
    (acc, curr) => acc + (curr.breakdown?.expenses || 0),
    0,
  );
  const totalNetIncome = finalizedRevenues.reduce(
    (acc, curr) => acc + (curr.amount || 0),
    0,
  );

  const handleUpdateDiscount = async (reportId: string, value: number) => {
    try {
      await updateDoc(doc(db, "individual_reports", reportId), {
        discounts: value,
      });
      setEditingReport(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `individual_reports/${reportId}`);
    }
  };

  const handleUpdateSubs = async (reportId: string, value: number) => {
    try {
      await updateDoc(doc(db, "individual_reports", reportId), {
        subs: value,
      });
      setEditingReport(null);
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, `individual_reports/${reportId}`);
    }
  };

  const approveIndividualReport = async (
    reportId: string,
    currentStatus: string,
  ) => {
    try {
      const nextStatus =
        currentStatus === "pending"
          ? "approved_by_contab"
          : "approved_by_admin";
      await updateDoc(doc(db, "individual_reports", reportId), {
        status: nextStatus,
        approvedAt: serverTimestamp(),
      });
    } catch (error) {
      console.error(error);
    }
  };

  const deleteIndividualReport = async (id: string) => {
    if (
      confirm(
        "Eliminar este relatório individual? Esta ação reverterá o estado para o cálculo dinâmico.",
      )
    ) {
      try {
        await deleteDoc(doc(db, "individual_reports", id));
      } catch (error) {
        console.error(error);
      }
    }
  };

  const deleteSalarySheet = async (id: string) => {
    if (
      confirm(
        "Tem certeza que deseja eliminar esta folha de salário? Esta ação é irreversível e os registos de faturamento permanecerão com o status atual.",
      )
    ) {
      try {
        await deleteDoc(doc(db, "salary_sheets", id));
        alert("Folha de salário eliminada com sucesso.");
      } catch (error) {
        console.error(error);
      }
    }
  };

  const approveSheet = async (sheetId: string) => {
    setIsProcessing(true);
    try {
      const sheet = salarySheets.find((s) => s.id === sheetId);
      if (!sheet) return;

      const nextStatus = sheet.status === "draft" ? "analyzed" : "approved";

      await updateDoc(doc(db, "salary_sheets", sheetId), {
        status: nextStatus,
        lastApprovedAt: serverTimestamp(),
      });

      if (nextStatus === "approved") {
        // Trigger automatic messages
        for (const person of sheet.staff) {
          await addDoc(collection(db, "messages"), {
            to: person.id,
            toName: person.name,
            content: `Olá ${person.name}, o seu salário referente a ${sheet.month} foi aprovado. Base: ${person.baseSalary.toLocaleString()} Kz, Subsídios: ${(person.subsAliment + person.subsTransp).toLocaleString()} Kz, Descontos: ${person.discounts.toLocaleString()} Kz. Valor Líquido a Receber: ${person.netSalary.toLocaleString()} Kz. PSM MOXICO.`,
            type: "system",
            timestamp: serverTimestamp(),
            read: false,
          });
        }

        // RESET LOGIC:
        // Gross income, expenses, etc are "archived" by moving finalized logs to a history status if needed,
        // but here we just mean the "current flow" for metrics will naturally move to the next month.
        // 3. Mark ONLY relevant month revenues as 'paid' to reset current cycle stats while guarding history
        const relevantRevenues = finalizedRevenues.filter((r) =>
          r.date?.startsWith(sheet.month),
        );
        for (const rev of relevantRevenues) {
          await updateDoc(doc(db, "revenue_logs", rev.id), {
            status: "paid_to_staff",
          });
        }

        // Archive related individual reports
        const relevantReports = individualReports.filter((r) => r.month === sheet.month);
        for (const report of relevantReports) {
          await updateDoc(doc(db, "individual_reports", report.id), {
            status: "paid",
          });
        }

        alert(
          "Folha APROVADA e PAGAMENTOS PROCESSADOS! Mensagens enviadas e fluxo reiniciado.",
        );
      }
    } catch (error) {
      console.error(error);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="max-w-[1400px] mx-auto space-y-6 pb-20">
      {/* Navigation & Header */}
      <div className="bg-white px-8 py-8 rounded-2xl border border-slate-200 shadow-sm transition-all">
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-8">
          <div className="flex items-center gap-6">
            <div className="w-24 h-24 bg-slate-900 rounded-[2.5rem] flex items-center justify-center text-white shadow-2xl relative overflow-hidden group border-4 border-slate-100 ring-4 ring-slate-900/5">
              <Calculator className="relative z-10" size={42} />
              <div className="absolute inset-0 bg-gradient-to-br from-brand-primary/40 to-black/20 opacity-0 group-hover:opacity-100 transition-opacity duration-700" />
              <div className="absolute top-0 right-0 w-12 h-12 bg-brand-primary/20 blur-xl animate-pulse" />
            </div>
            <div>
              <div className="flex flex-col lg:flex-row lg:items-center gap-2 lg:gap-4">
                <h2 className="text-4xl lg:text-5xl font-black text-slate-900 tracking-tighter uppercase italic flex items-center gap-3 leading-none">
                  PS MOREIRA
                </h2>
                <div className="inline-flex w-fit px-4 py-1.5 bg-brand-primary text-white rounded-xl text-[11px] font-black uppercase tracking-[0.2em] italic shadow-lg shadow-brand-primary/20">
                  HUB DE CONTABILIDADE
                </div>
              </div>
              <div className="text-[12px] text-slate-500 font-black uppercase tracking-[0.3em] mt-3 flex items-center gap-3">
                <div className="w-1.5 h-1.5 bg-brand-primary rounded-full animate-ping" />
                CENTRO INTEGRADO DE TESOURARIA & AUDITORIA FINANCEIRA
              </div>
              <div className="mt-5 flex flex-wrap items-center gap-x-8 gap-y-2 text-[10px] font-black text-slate-400 uppercase tracking-widest italic border-t border-slate-100 pt-4">
                <span className="flex items-center gap-2.5">
                  <span className="text-slate-300">NIF:</span>
                  <span className="text-slate-800">5001062654</span>
                </span>
                <span className="flex items-center gap-2.5">
                  <span className="text-slate-300">UNIDADE:</span>
                  <span className="text-slate-800">LUENA, MOXICO</span>
                </span>
                <span className="flex items-center gap-2.5 px-3 py-1 bg-emerald-50 text-emerald-600 rounded-lg border border-emerald-100 shadow-sm">
                  <ShieldCheck size={12} /> SISTEMA AUDITADO V.3 ESTÁVEL
                </span>
              </div>
            </div>
          </div>

          <div className="flex bg-slate-100 p-1 rounded-xl shadow-inner border border-slate-200">
            {(user?.role === 'operator' || isAdmin) && (
              <button
                onClick={() => setActiveView("revenue")}
                className={cn(
                  "px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
                  activeView === "revenue"
                    ? "bg-white text-slate-900 shadow-sm scale-[1.02]"
                    : "text-slate-400 hover:text-slate-600",
                )}
              >
                <Wallet size={14} />
                Fluxo de Renda
              </button>
            )}
            <button
              onClick={() => setActiveView("income")}
              className={cn(
                "px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
                activeView === "income"
                  ? "bg-white text-slate-900 shadow-sm scale-[1.02]"
                  : "text-slate-400 hover:text-slate-600",
              )}
            >
              <TrendingUp size={14} />
              Mapa de Faturamento
            </button>
            <button
              onClick={() => setActiveView("salaries")}
              className={cn(
                "px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
                activeView === "salaries"
                  ? "bg-white text-slate-900 shadow-sm scale-[1.02]"
                  : "text-slate-400 hover:text-slate-600",
              )}
            >
              <Users size={14} />
              Folha de Salários
            </button>
            <button
              onClick={() => setActiveView("individual")}
              className={cn(
                "px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
                activeView === "individual"
                  ? "bg-white text-slate-900 shadow-sm scale-[1.02]"
                  : "text-slate-400 hover:text-slate-600",
              )}
            >
              <FileText size={14} />
              Relatório Individual
            </button>
            {isAdmin && (
              <button
                onClick={() => setActiveView("balance")}
                className={cn(
                  "px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
                  activeView === "balance"
                    ? "bg-white text-slate-900 shadow-sm scale-[1.02]"
                    : "text-slate-400 hover:text-slate-600",
                )}
              >
                <TrendingUp size={14} />
                Balanço de Análise
              </button>
            )}
            <button
              onClick={() => setActiveView("invoicing")}
              className={cn(
                "px-5 py-2 rounded-lg text-[10px] font-black uppercase tracking-widest transition-all flex items-center gap-2",
                activeView === "invoicing"
                  ? "bg-white text-slate-900 shadow-sm scale-[1.02]"
                  : "text-slate-400 hover:text-slate-600",
              )}
            >
              <FileText size={14} />
              Redactor Faturas
            </button>
            {isAdmin && (
              <div className="flex items-center gap-2 ml-auto pl-2">
                <button
                  onClick={handleResetAccountingCycle}
                  disabled={isProcessing}
                  className="px-4 py-2 rounded-lg text-[9px] font-black uppercase tracking-widest bg-rose-50 text-rose-600 hover:bg-rose-100 transition-all flex items-center gap-2 border border-rose-100"
                >
                  {isProcessing ? (
                    <Loader2 size={12} className="animate-spin" />
                  ) : (
                    <TrendingUp size={12} className="rotate-180" />
                  )}
                  Zerar Hub
                </button>
              </div>
            )}
          </div>
        </div>
      </div>

      {activeView === "revenue" && <RevenueManagement user={user} />}

      <AnimatePresence>
        {isReceiptModalOpen && activeReceipt && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setIsReceiptModalOpen(false)}
              className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="w-full max-w-sm bg-[#fffcf5] rounded-[2rem] shadow-[0_20px_50px_-12px_rgba(0,0,0,0.2)] border-2 border-[#e6dfc8] overflow-hidden relative"
            >
              {/* Decorative Postal Elements */}
              <div className="absolute top-4 right-4 w-12 h-16 border-2 border-brand-primary/20 rounded flex flex-col items-center justify-center opacity-40">
                <div className="text-[6px] font-black uppercase text-brand-primary">POSTAL</div>
                <Package size={16} className="text-brand-primary my-1" />
                <div className="text-[6px] font-black uppercase text-brand-primary tracking-tighter text-center">PSM LUENA MOXICO</div>
              </div>

              <div className="p-6 border-b border-dashed border-[#e6dfc8] text-center">
                <h3 className="text-xl font-black uppercase italic tracking-tighter text-slate-900">Bilhete de Salário</h3>
                <p className="text-[8px] font-bold text-slate-400 uppercase tracking-widest mt-1">Ref: {receiptMonth} • {activeReceipt.dataProcessamento}</p>
                
                <button 
                  onClick={() => setIsReceiptModalOpen(false)} 
                  className="absolute top-4 left-4 w-8 h-8 flex items-center justify-center bg-slate-200/50 hover:bg-slate-200 rounded-full transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="p-6 max-h-[70vh] overflow-y-auto custom-scrollbar space-y-6">
                {/* Header Information - Compact */}
                <div className="space-y-3 bg-[#f7f3e9] p-4 rounded-2xl border border-[#e6dfc8]">
                  <div className="flex justify-between items-center">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Colaborador</span>
                    <span className="text-[10px] font-black text-slate-900 uppercase italic leading-none">{activeReceipt.name}</span>
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Categoria</span>
                    <input 
                      type="text" 
                      value={activeReceipt.categoria} 
                      onChange={(e) => setActiveReceipt({...activeReceipt, categoria: e.target.value})}
                      className="text-right text-[10px] font-bold text-slate-700 bg-transparent border-b border-transparent focus:border-brand-primary outline-none"
                    />
                  </div>
                  <div className="flex justify-between items-center">
                    <span className="text-[8px] font-black text-slate-400 uppercase tracking-widest leading-none">Dias Trab.</span>
                    <input 
                      type="number" 
                      value={activeReceipt.diasTrabalho} 
                      onChange={(e) => setActiveReceipt({...activeReceipt, diasTrabalho: Number(e.target.value)})}
                      className="w-10 text-right text-[10px] font-bold text-slate-700 bg-transparent border-b border-transparent focus:border-brand-primary outline-none"
                    />
                  </div>
                </div>

                {/* Remunerations - Compact Stack */}
                <div className="space-y-3">
                  <h4 className="text-[8px] font-black text-slate-900 uppercase tracking-[0.2em] flex items-center gap-2">
                    <div className="w-1 h-3 bg-brand-primary rounded-full" />
                    Créditos de Remuneração
                  </h4>
                  <div className="space-y-0.5">
                    <ReceiptPostalField label="Salário Base" value={activeReceipt.salarioBase} onChange={(v) => setActiveReceipt({...activeReceipt, salarioBase: Number(v)})} />
                    <ReceiptPostalField label="S. Alimentação" value={activeReceipt.subsidioAlimentacao} onChange={(v) => setActiveReceipt({...activeReceipt, subsidioAlimentacao: Number(v)})} />
                    <ReceiptPostalField label="S. Transporte" value={activeReceipt.subsidioTransporte} onChange={(v) => setActiveReceipt({...activeReceipt, subsidioTransporte: Number(v)})} />
                    
                    <div className="pt-1 border-t border-[#e6dfc8]/50 mt-1">
                      <ReceiptPostalField label="S. Férias" value={activeReceipt.subsidioFerias} onChange={(v) => setActiveReceipt({...activeReceipt, subsidioFerias: Number(v)})} />
                      <ReceiptPostalField label="S. Reforço" value={activeReceipt.subsidioReforco} onChange={(v) => setActiveReceipt({...activeReceipt, subsidioReforco: Number(v)})} />
                      <ReceiptPostalField label="S. Renda 1" value={activeReceipt.subsidioRenda1} onChange={(v) => setActiveReceipt({...activeReceipt, subsidioRenda1: Number(v)})} />
                      <ReceiptPostalField label="S. Renda 2" value={activeReceipt.subsidioRenda2} onChange={(v) => setActiveReceipt({...activeReceipt, subsidioRenda2: Number(v)})} />
                      <ReceiptPostalField label="S. Renda 3" value={activeReceipt.subsidioRenda3} onChange={(v) => setActiveReceipt({...activeReceipt, subsidioRenda3: Number(v)})} />
                    </div>
                  </div>
                </div>

                {/* Discounts - Compact Stack */}
                <div className="space-y-3">
                  <h4 className="text-[8px] font-black text-rose-600 uppercase tracking-[0.2em] flex items-center gap-2">
                    <div className="w-1 h-3 bg-rose-500 rounded-full" />
                    Deduções & Faltas
                  </h4>
                  <div className="space-y-0.5">
                    <ReceiptPostalField label="Desconto Danos" value={activeReceipt.descontoDanos} onChange={(v) => setActiveReceipt({...activeReceipt, descontoDanos: Number(v)})} isDiscount />
                    <ReceiptPostalField label="Outros Desc." value={activeReceipt.outrosDescontos} onChange={(v) => setActiveReceipt({...activeReceipt, outrosDescontos: Number(v)})} isDiscount />
                  </div>
                </div>

                {/* Totals Section - Poster Style */}
                <div className="mt-8 p-6 bg-slate-900 rounded-[1.8rem] text-white shadow-xl shadow-slate-900/20 relative overflow-hidden">
                   <div className="absolute top-0 right-0 w-24 h-24 bg-white/5 rounded-full -mr-12 -mt-12 blur-2xl" />
                   <div className="relative z-10 flex flex-col gap-1">
                      <div className="flex justify-between items-center text-[7px] font-black uppercase tracking-widest text-slate-400">
                         <span>Bruto Acumulado</span>
                         <span>{calculateReceiptTotals(activeReceipt).totalRemun.toLocaleString()} Kz</span>
                      </div>
                      <div className="flex justify-between items-center text-[7px] font-black uppercase tracking-widest text-rose-400">
                         <span>Retenções Totais</span>
                         <span>-{calculateReceiptTotals(activeReceipt).totalDisc.toLocaleString()} Kz</span>
                      </div>
                      <div className="h-px bg-white/10 my-2" />
                      <div className="flex flex-col">
                        <span className="text-[8px] font-black text-emerald-400 uppercase tracking-widest leading-none mb-1">Valor Líquido a Receber</span>
                        <span className="text-3xl font-black italic tracking-tighter text-white">
                          {calculateReceiptTotals(activeReceipt).net.toLocaleString()} <span className="text-[10px] italic opacity-50 font-medium">Kz</span>
                        </span>
                      </div>
                   </div>
                </div>
              </div>

              <div className="p-6 bg-[#f7f3e9] border-t-2 border-dashed border-[#e6dfc8] flex flex-col gap-3">
                 <button 
                  onClick={() => handleDownloadReceiptPDF(activeReceipt)}
                  className="w-full py-4 bg-brand-primary text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-blue-700 transition-all flex items-center justify-center gap-3 shadow-lg shadow-brand-primary/10"
                 >
                   <Download size={16} /> Exportar Bilhete PDF
                 </button>
                 <button 
                  onClick={() => handleSendWhatsApp(activeReceipt)}
                  className="w-full py-4 bg-emerald-500 text-white rounded-2xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-emerald-600 transition-all flex items-center justify-center gap-3 shadow-lg shadow-emerald-500/10"
                 >
                   <Send size={16} /> Enviar p/ Colaborador (WhatsApp)
                 </button>
                 <p className="text-[7px] text-slate-400 text-center font-black uppercase tracking-[0.2em] italic">Comprovativo PSM TAXICONTROL • Luena, Moxico • v.3.0</p>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {activeView === "invoicing" && <InvoiceDrafting />}

      {activeView === "balance" && (
        <div className="space-y-10">
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            <div className="lg:col-span-2 bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden group">
              <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/5 rounded-full -mr-32 -mt-32 blur-3xl opacity-0 group-hover:opacity-100 transition-opacity duration-1000" />
              <div className="flex items-center justify-between mb-10 relative z-10">
                <div>
                  <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic">
                    Fluxo de Caixa Analítico
                  </h3>
                  <div className="text-[10px] text-slate-400 font-black uppercase tracking-[0.3em] mt-2 flex items-center gap-3">
                    <div className="w-1.5 h-1.5 bg-brand-primary rounded-full animate-pulse" />
                    HISTÓRICO DE DESEMPENHO FINANCEIRO • 15 DIAS
                  </div>
                </div>
                <button
                  onClick={() => exportToPDF("balance", {})}
                  className="w-12 h-12 flex items-center justify-center bg-slate-50 text-slate-400 rounded-2xl hover:bg-brand-primary hover:text-white transition-all shadow-sm"
                >
                  <Download size={20} />
                </button>
              </div>

              <div className="h-[400px] relative z-10">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart
                    data={finalizedRevenues
                      .reduce((acc: any[], curr) => {
                        const date = curr.date;
                        const existing = acc.find((a) => a.date === date);
                        if (existing) existing.total += curr.amount || 0;
                        else acc.push({ date, total: curr.amount || 0 });
                        return acc;
                      }, [])
                      .sort((a, b) => a.date.localeCompare(b.date))
                      .slice(-15)}
                  >
                    <CartesianGrid
                      strokeDasharray="10 10"
                      vertical={false}
                      stroke="#f1f5f9"
                    />
                    <XAxis
                      dataKey="date"
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fontWeight: 900, fill: "#94a3b8" }}
                      tickFormatter={(val) =>
                        val.split("-").slice(1).reverse().join("/")
                      }
                    />
                    <YAxis
                      axisLine={false}
                      tickLine={false}
                      tick={{ fontSize: 10, fontWeight: 900, fill: "#94a3b8" }}
                      tickFormatter={(val) => `${val / 1000}k`}
                    />
                    <RechartsTooltip
                      contentStyle={{
                        borderRadius: "24px",
                        border: "none",
                        boxShadow: "0 25px 50px -12px rgb(0 0 0 / 0.15)",
                        padding: "20px",
                      }}
                      itemStyle={{
                        fontSize: "12px",
                        fontWeight: 900,
                        textTransform: "uppercase",
                      }}
                    />
                    <Line
                      type="monotone"
                      dataKey="total"
                      stroke="#2563eb"
                      strokeWidth={5}
                      dot={{
                        r: 6,
                        fill: "#2563eb",
                        strokeWidth: 3,
                        stroke: "#fff",
                      }}
                      activeDot={{ r: 10, strokeWidth: 0 }}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="space-y-8">
              <div className="bg-slate-900 p-10 rounded-[2.5rem] text-white shadow-2xl relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-48 h-48 bg-brand-primary/20 rounded-full -mr-24 -mt-24 blur-3xl group-hover:scale-150 transition-transform duration-1000" />
                <div className="relative z-10">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em] mb-6 italic">
                    Liquidez Mensal
                  </p>
                  <h4 className="text-4xl font-black italic tracking-tighter mb-4">
                    {finalizedRevenues
                      .reduce((acc, curr) => acc + (curr.amount || 0), 0)
                      .toLocaleString()}{" "}
                    <span className="text-xl opacity-40 uppercase">Kz</span>
                  </h4>
                  <div className="flex items-center gap-3 px-4 py-2 bg-white/5 rounded-xl border border-white/10 w-fit">
                    <TrendingUp size={16} className="text-emerald-400" />
                    <span className="text-[10px] font-black uppercase tracking-widest text-emerald-400">
                      Desempenho Estável
                    </span>
                  </div>
                </div>
              </div>

              <div className="bg-white p-10 rounded-[2.5rem] border border-slate-200 shadow-sm">
                <div className="flex items-center justify-between mb-8">
                  <h4 className="text-[11px] font-black text-slate-400 uppercase tracking-[0.2em] italic">
                    Distribuição de Status
                  </h4>
                  <Calculator size={18} className="text-slate-300" />
                </div>
                <div className="space-y-6">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold text-slate-600 uppercase tracking-tight">
                      Rendas Pagas
                    </span>
                    <span className="text-xs font-black text-emerald-600 italic">
                      {
                        finalizedRevenues.filter(
                          (r) => r.status === "paid_to_staff",
                        ).length
                      }{" "}
                      Unidades
                    </span>
                  </div>
                  <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden">
                    <div
                      className="h-full bg-emerald-500 transition-all duration-1000"
                      style={{ width: "85%" }}
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {activeView === "income" ? (
        <div className="space-y-10">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
            <StatBox
              label="Faturamento Bruto (Mês)"
              value={totalGrossIncome}
              color="emerald"
              icon={TrendingUp}
              sub="Total Entradas"
            />
            <StatBox
              label="Custos Operacionais"
              value={totalExpenses}
              color="rose"
              icon={ArrowDownRight}
              sub="Despesas PSM"
            />
            <StatBox
              label="Rendimento Líquido"
              value={totalNetIncome}
              color="blue"
              icon={Wallet}
              sub="Cofre Disponível"
            />
          </div>

          <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-sm overflow-hidden group">
            <div className="px-10 py-8 border-b border-slate-100 flex flex-col md:flex-row md:items-center justify-between bg-slate-50/50 gap-6">
              <div>
                <h3 className="text-lg font-black text-slate-900 uppercase tracking-tighter italic flex items-center gap-3">
                  <TrendingUp className="text-emerald-500" size={24} />
                  Mapa de Rendimentos: {currentMonth}
                </h3>
                <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.2em] mt-1">
                  Dados auditados e validados pela tesouraria central
                </p>
              </div>
              <div className="flex items-center gap-4">
                <button
                  onClick={exportMapToPDF}
                  className="px-6 py-3 bg-slate-900 text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-black transition-all flex items-center gap-2 shadow-xl shadow-black/10"
                >
                  <Download size={16} /> Exportar Balanço Geral
                </button>
              </div>
            </div>

            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="bg-white text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-100">
                    <th className="px-10 py-5">Data</th>
                    <th className="px-10 py-5">Colaborador</th>
                    <th className="px-10 py-5 text-center">
                      Rendimento
                    </th>
                    <th className="px-10 py-5 text-center">
                      Custos
                    </th>
                    <th className="px-10 py-5 text-right font-black">Salário 10%</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {finalizedRevenues.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="py-32 text-center">
                        <div className="w-16 h-16 bg-slate-50 rounded-2xl flex items-center justify-center mx-auto mb-6">
                          <TrendingUp className="text-slate-200" size={32} />
                        </div>
                        <p className="opacity-30 italic text-xs uppercase font-black tracking-widest text-slate-400">
                          Sem dados consolidados para este período
                        </p>
                      </td>
                    </tr>
                  ) : (
                    finalizedRevenues.map((rev) => (
                      <tr
                        key={rev.id}
                        className="hover:bg-slate-50 transition-colors group/row"
                      >
                        <td className="px-10 py-6 text-[10px] text-slate-400 font-black tracking-widest italic uppercase">
                          {rev.date}
                        </td>
                        <td className="px-10 py-6">
                          <div className="flex items-center gap-4">
                            <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-400 font-black group-hover/row:bg-brand-primary group-hover/row:text-white transition-all text-[10px]">
                              {rev.driverName[0]}
                            </div>
                            <p className="text-xs font-black uppercase text-slate-900 tracking-tight">
                              {rev.driverName}
                            </p>
                          </div>
                        </td>
                        <td className="px-10 py-6 text-center text-[12px] font-bold text-slate-600 font-mono">
                          {(
                            (rev.breakdown?.tpa || 0) +
                            (rev.breakdown?.cash || 0) +
                            (rev.breakdown?.transfer || 0)
                          ).toLocaleString()}{" "}
                          Kz
                        </td>
                        <td className="px-10 py-6 text-center text-[12px] font-black text-rose-500 font-mono">
                          {(rev.breakdown?.expenses || 0).toLocaleString()} Kz
                        </td>
                        <td className="px-10 py-6 text-right">
                          <div className="flex items-center justify-end gap-3">
                            <span className="text-[14px] font-black text-brand-primary tracking-tighter italic">
                              {((rev.amount || 0) * 0.1).toLocaleString()}{" "}
                              <span className="text-[9px] opacity-40">Kz</span>
                            </span>
                            {isAdmin && (
                              <button
                                onClick={async () => {
                                  if (
                                    confirm("Eliminar este registo de rendimento?")
                                  ) {
                                    await deleteDoc(
                                      doc(db, "revenue_logs", rev.id),
                                    );
                                  }
                                }}
                                className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg transition-all"
                                title="Eliminar Registo"
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {finalizedRevenues.length > 0 && (
                  <tfoot className="bg-slate-900 text-white">
                    <tr>
                      <td className="px-10 py-8 font-black uppercase text-xs tracking-widest border-t border-white/5">
                        Fecho Mensal PSM
                      </td>
                      <td className="px-10 py-8 text-center text-lg font-black tracking-tighter italic border-t border-white/5 text-slate-400">
                        {(totalGrossIncome || 0).toLocaleString()} Kz
                      </td>
                      <td className="px-10 py-8 text-center text-lg font-black tracking-tighter italic border-t border-white/5 text-rose-400">
                        {(totalExpenses || 0).toLocaleString()} Kz
                      </td>
                      <td className="px-10 py-8 text-center text-lg font-black tracking-tighter italic border-t border-white/5 text-blue-400">
                        {((totalNetIncome || 0) * 0.1).toLocaleString()} Kz
                      </td>
                      <td className="px-10 py-8 text-right text-3xl font-black tracking-tighter italic border-t border-white/5 text-emerald-400">
                        {(totalNetIncome || 0).toLocaleString()} Kz
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      ) : activeView === "salaries" ? (
        <div className="space-y-12">
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 bg-white p-6 rounded-[2rem] border border-slate-200">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-slate-900 rounded-2xl flex items-center justify-center text-white">
                <Users size={24} />
              </div>
              <div>
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tighter italic">
                  Folhas de Pagamento
                </h3>
                <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
                  Gestão de remunerações staff administrativo e operacional
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                onClick={() => setShowAdminStaffForm(!showAdminStaffForm)}
                className="flex items-center gap-2 px-6 py-4 bg-slate-100 text-slate-600 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-slate-200 transition-all font-bold"
              >
                <Users size={16} /> Gestão Staff Fixo
              </button>
              <button
                onClick={handleGenerateSheet}
                disabled={isProcessing}
                className="bg-brand-primary text-white px-10 py-4 rounded-[1.25rem] text-[11px] font-black uppercase tracking-widest hover:bg-brand-secondary transition-all flex items-center gap-3 shadow-2xl shadow-blue-600/30 active:scale-95 disabled:opacity-50 font-bold"
              >
                {isProcessing ? (
                  <Loader2 className="animate-spin" size={18} />
                ) : (
                  <Calculator size={18} />
                )}
                Processar Nova Folha Bancária
              </button>
            </div>
          </div>

          <AnimatePresence>
            {showAdminStaffForm && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-white p-8 rounded-[2.5rem] border border-slate-200 shadow-xl mb-10 space-y-8 relative">
                  <div className="absolute top-0 right-0 p-8 opacity-[0.03] rotate-12 pointer-events-none">
                    <Users size={120} />
                  </div>

                  <div className="flex items-center justify-between border-b border-slate-100 pb-6">
                    <h4 className="text-[11px] font-black text-slate-900 uppercase tracking-widest flex items-center gap-3">
                      <Pencil size={14} className="text-brand-primary" />
                      {editingAdminStaffId
                        ? `Editando: ${newAdminStaff.name}`
                        : "Gestão de Staff Reservado (Admin/Gerais)"}
                      <span className="px-2 py-0.5 bg-slate-100 text-slate-400 rounded text-[9px] font-bold tracking-normal italic uppercase tracking-widest">
                        Controlo Manual
                      </span>
                    </h4>
                    <button
                      onClick={() => setShowAdminStaffForm(false)}
                      className="p-1 hover:bg-slate-100 rounded-lg transition-colors"
                    >
                      <X size={18} />
                    </button>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">
                        Nome Completo
                      </label>
                      <input
                        type="text"
                        value={newAdminStaff.name}
                        onChange={(e) =>
                          setNewAdminStaff({
                            ...newAdminStaff,
                            name: e.target.value.toUpperCase(),
                          })
                        }
                        placeholder="EX: PAULO S. MOREIRA"
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-brand-primary transition-all uppercase"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">
                        Função / Cargo
                      </label>
                      <input
                        type="text"
                        value={newAdminStaff.role}
                        onChange={(e) =>
                          setNewAdminStaff({
                            ...newAdminStaff,
                            role: e.target.value.toUpperCase(),
                          })
                        }
                        placeholder="EX: CONTABILISTA"
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-brand-primary transition-all uppercase"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">
                        Salário Base (Kz)
                      </label>
                      <input
                        type="number"
                        value={newAdminStaff.base}
                        onChange={(e) =>
                          setNewAdminStaff({
                            ...newAdminStaff,
                            base: Number(e.target.value),
                          })
                        }
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-brand-primary transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">
                        Telefone (+244)
                      </label>
                      <input
                        type="text"
                        value={newAdminStaff.phone}
                        onChange={(e) =>
                          setNewAdminStaff({
                            ...newAdminStaff,
                            phone: e.target.value,
                          })
                        }
                        placeholder="9XX XXX XXX"
                        className="w-full px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-brand-primary transition-all"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">
                        Subsídios Totais (Kz)
                      </label>
                      <div className="flex gap-3">
                        <input
                          type="number"
                          value={newAdminStaff.subs}
                          onChange={(e) =>
                            setNewAdminStaff({
                              ...newAdminStaff,
                              subs: Number(e.target.value),
                            })
                          }
                          className="flex-1 px-4 py-2.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-bold outline-none focus:bg-white focus:border-brand-primary transition-all"
                        />
                        <button
                          onClick={handleAddAdminStaff}
                          className="px-6 bg-brand-primary text-white rounded-xl hover:bg-brand-secondary transition-all flex items-center justify-center shadow-lg shadow-blue-600/20 active:scale-95"
                        >
                          {editingAdminStaffId ? (
                            <CheckCircle2 size={20} />
                          ) : (
                            <Plus size={20} />
                          )}
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="pt-8 border-t border-slate-50">
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                      {administrativeStaff.map((staff) => (
                        <div
                          key={staff.id}
                          className="flex items-center justify-between p-5 bg-slate-50 rounded-2xl border border-slate-100 group/item hover:bg-white hover:shadow-xl hover:border-brand-primary/20 transition-all cursor-default"
                        >
                          <div>
                            <p className="text-[11px] font-black text-slate-900 uppercase tracking-tight italic">
                              {staff.name}
                            </p>
                            <p className="text-[9px] text-slate-400 font-bold uppercase mt-0.5 tracking-widest italic">
                              {staff.role} •{" "}
                              {(staff.base + staff.subs).toLocaleString()} Kz
                              {staff.phone && ` • ${staff.phone}`}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            <button
                              onClick={() => handleEditAdminStaff(staff)}
                              className="p-2 text-slate-300 hover:text-brand-primary hover:bg-brand-primary/10 rounded-lg opacity-0 group-hover/item:opacity-100 transition-all shadow-sm"
                              title="Editar Funcionário"
                            >
                              <Pencil size={14} />
                            </button>
                            <button
                              onClick={() => handleDeleteAdminStaff(staff.id)}
                              className="p-2 text-slate-300 hover:text-rose-500 hover:bg-rose-50 rounded-lg opacity-0 group-hover/item:opacity-100 transition-all shadow-sm"
                              title="Remover Funcionário"
                            >
                              <Trash2 size={14} />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          <div className="grid grid-cols-1 gap-12">
            {salarySheets.length === 0 ? (
              <div className="bg-white p-32 rounded-[3rem] border border-slate-200 border-dashed text-center">
                <div className="w-20 h-20 bg-slate-50 rounded-[2rem] flex items-center justify-center mx-auto mb-6">
                  <Users size={40} className="text-slate-200" />
                </div>
                <p className="text-[11px] font-black text-slate-400 uppercase tracking-[0.3em]">
                  Ambiente sem registos de payroll activos
                </p>
              </div>
            ) : (
              salarySheets.map((sheet) => (
                <motion.div
                  key={sheet.id}
                  initial={{ opacity: 0, y: 30 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="bg-white rounded-[3rem] border border-slate-200 shadow-2xl overflow-hidden group"
                >
                  <div className="px-10 py-10 flex flex-col xl:flex-row xl:items-center justify-between bg-slate-900 text-white relative overflow-hidden">
                    <div className="absolute top-0 right-0 w-[50%] h-full bg-brand-primary/5 -mr-40 rotate-12 blur-3xl pointer-events-none" />

                    <div className="relative z-10 flex items-center gap-8">
                      <div className="w-20 h-20 bg-brand-primary rounded-[2rem] flex items-center justify-center shadow-2xl shadow-brand-primary/20 rotate-3 group-hover:rotate-0 transition-transform duration-700">
                        <FileText size={36} />
                      </div>
                      <div>
                        <div className="flex items-center gap-3 mb-2">
                          <h4 className="text-2xl font-black uppercase tracking-tighter italic">
                            PSM PAYROLL: {sheet.month}
                          </h4>
                          <span
                            className={cn(
                              "px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-widest border border-white/10",
                              sheet.status === "draft"
                                ? "bg-amber-500/10 text-amber-500 border-amber-500/20"
                                : sheet.status === "analyzed"
                                  ? "bg-blue-500/10 text-blue-400 border-blue-500/20"
                                  : "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
                            )}
                          >
                            {sheet.status === "draft"
                              ? "Rascunho"
                              : sheet.status === "analyzed"
                                ? "Analítica"
                                : "Aprovada"}
                          </span>
                        </div>
                        <div className="flex items-center gap-6 text-[10px] font-black text-slate-400 uppercase tracking-widest">
                          <span className="flex items-center gap-2">
                            <Calendar
                              size={12}
                              className="text-brand-primary"
                            />{" "}
                            Período: {sheet.month}
                          </span>
                          <span className="w-1 h-1 bg-slate-700 rounded-full" />
                          <span className="flex items-center gap-2">
                            <Users size={12} className="text-brand-primary" />{" "}
                            Staff: {sheet.staff.length} Membros
                          </span>
                        </div>
                      </div>
                    </div>

                    <div className="relative z-10 flex flex-col md:flex-row md:items-center gap-10 mt-8 xl:mt-0 bg-white/5 p-6 rounded-[2rem] border border-white/5 backdrop-blur-sm">
                      <div className="text-right border-r border-white/10 pr-10 last:border-0 last:pr-0">
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">
                          Salário Líquido (Massa)
                        </p>
                        <p className="text-3xl font-black text-brand-primary tracking-tighter italic">
                          {(sheet.totalPayable || 0).toLocaleString()}{" "}
                          <span className="text-xs opacity-50">Kz</span>
                        </p>
                      </div>
                      <div className="text-right">
                        <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mb-1">
                          Encargos Fiscais (INSS)
                        </p>
                        <p className="text-xl font-black text-slate-100 tracking-tighter italic opacity-80">
                          {(
                            (sheet.totalInssEmployee || 0) +
                            (sheet.totalInssEmployer || 0)
                          ).toLocaleString()}{" "}
                          <span className="text-xs opacity-50">Kz</span>
                        </p>
                      </div>

                      <div className="flex items-center gap-4">
                        {sheet.status !== "approved" && isAdmin && (
                          <button
                            onClick={() => approveSheet(sheet.id)}
                            disabled={isProcessing}
                            className="px-10 py-4 bg-white text-slate-900 rounded-2xl text-[11px] font-black uppercase tracking-widest hover:bg-brand-primary hover:text-white transition-all shadow-2xl active:scale-95 flex items-center gap-3 font-bold"
                          >
                            <CheckCircle2 size={18} />
                            {sheet.status === "draft"
                              ? "Validar Balanço"
                              : "Transferir Salários"}
                          </button>
                        )}
                        <button
                          onClick={() => deleteSalarySheet(sheet.id)}
                          className="p-4 bg-white/10 hover:bg-rose-500 rounded-2xl text-white transition-all shadow-2xl active:scale-95 border border-white/5 flex items-center justify-center group/del"
                          title="Eliminar Registro Permanente"
                        >
                          <Trash2
                            size={20}
                            className="group-hover/del:scale-110 transition-transform"
                          />
                        </button>
                      </div>
                    </div>
                  </div>

                  <div className="overflow-x-auto border-b border-slate-100">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-50 text-[10px] font-black text-slate-400 uppercase tracking-[0.2em] border-b border-slate-200">
                          <th className="px-10 py-5">Colaborador / Função</th>
                          <th className="px-10 py-5 text-center">
                            Vencimento Base
                          </th>
                          <th className="px-10 py-5 text-center">Subsídios</th>
                          <th className="px-10 py-5 text-center">
                            Remuneração Bruta
                          </th>
                          <th className="px-10 py-5 text-center text-rose-500 italic">
                            INSS Est. (3%)
                          </th>
                          <th className="px-10 py-5 text-right font-black">
                            VALOR LÍQUIDO
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {sheet.staff.map((person: any, idx: number) => (
                          <tr
                            key={person.id}
                            className="hover:bg-slate-50/50 transition-colors group/row"
                          >
                            <td className="px-10 py-6">
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-[11px] font-black text-slate-400 group-hover/row:bg-brand-primary group-hover/row:text-white transition-all">
                                  {String(idx + 1).padStart(2, "0")}
                                </div>
                                <div>
                                  <p className="text-sm font-black text-slate-900 uppercase tracking-tight italic">
                                    {person.name}
                                  </p>
                                  <p className="text-[10px] text-slate-400 font-black uppercase tracking-widest mt-0.5">
                                    {person.role}
                                  </p>
                                </div>
                              </div>
                            </td>
                            <td className="px-10 py-6 text-center text-[12px] font-bold text-slate-600 font-mono italic">
                              {(person.baseSalary || 0).toLocaleString()}
                            </td>
                            <td className="px-10 py-6 text-center text-[12px] font-bold text-slate-500 font-mono">
                              {(
                                (person.subsAliment || 0) +
                                (person.subsTransp || 0)
                              ).toLocaleString()}
                            </td>
                            <td className="px-10 py-6 text-center text-[12px] font-black text-slate-900 bg-slate-50/30 font-mono italic">
                              {(person.grossSalary || 0).toLocaleString()}
                            </td>
                            <td className="px-10 py-6 text-center text-[12px] font-black text-rose-500 font-mono">
                              -{(person.inssEmployee || 0).toLocaleString()}
                            </td>
                            <td className="px-10 py-6 text-right">
                              <div className="flex items-center justify-end gap-3">
                                <p className="text-lg font-black text-slate-900 tracking-tighter italic">
                                  {(person.netSalary || 0).toLocaleString()}{" "}
                                  <span className="text-[10px] font-bold opacity-40 uppercase">
                                    Kz
                                  </span>
                                </p>
                                <div className="flex items-center gap-2">
                                  <button
                                    onClick={() =>
                                      generateIndividualSlip(
                                        person,
                                        sheet.month,
                                      )
                                    }
                                    className="p-2 bg-blue-50 text-blue-600 rounded-lg border border-blue-100 hover:bg-blue-100 transition-all flex items-center gap-2 group/btn"
                                    title="Gerar Recibo Individual"
                                  >
                                    <Download size={14} className="group-hover/btn:scale-110 transition-transform" />
                                    <span className="text-[8px] font-black uppercase">Recibo</span>
                                  </button>
                                  {sheet.status === "approved" ? (
                                    <div className="p-1 bg-emerald-50 rounded-lg text-emerald-500 border border-emerald-100">
                                      <CheckCircle2 size={16} />
                                    </div>
                                  ) : (
                                    <div className="p-1 bg-slate-50 rounded-lg text-slate-300 border border-slate-100">
                                      <Clock size={16} />
                                    </div>
                                  )}
                                </div>
                              </div>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  <div className="p-10 bg-slate-50 flex flex-col lg:flex-row justify-between items-start gap-16">
                    <div className="w-full lg:max-w-md space-y-4 bg-white p-8 rounded-[2rem] border border-slate-200 shadow-xl relative overflow-hidden">
                      <div className="absolute top-0 right-0 p-6 opacity-[0.03] rotate-12">
                        <ShieldCheck size={100} />
                      </div>

                      <h5 className="text-[11px] font-black text-slate-900 uppercase tracking-[0.2em] mb-6 flex items-center gap-3">
                        <div className="w-2 h-2 bg-brand-primary rounded-full animate-pulse" />
                        Auditória de Encargos PSM
                      </h5>
                      <div className="space-y-3">
                        <ResumoRow
                          label="Total Salários Líquidos"
                          value={sheet.totalPayable}
                        />
                        <ResumoRow
                          label="3% Segurança Social"
                          value={sheet.totalInssEmployee}
                        />
                        <ResumoRow
                          label="8% Encargo Empresa"
                          value={sheet.totalInssEmployer}
                        />
                        <div className="h-px bg-slate-100 my-4" />
                        <ResumoRow
                          label="Obrigações Segurança Social (11%)"
                          value={
                            sheet.totalInssEmployee + sheet.totalInssEmployer
                          }
                          highlight
                        />
                        <ResumoRow
                          label="Imposto sobre Rendimento (IRT)"
                          value={sheet.totalIrt}
                        />
                        <div className="pt-4 border-t border-slate-200 mt-4">
                          <ResumoRow
                            label="Custo Total de Operação Staff"
                            value={sheet.totalBruto + sheet.totalInssEmployer}
                            bold
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex-1 space-y-12 text-right">
                      <div className="inline-block border-b-4 border-brand-primary pb-4 px-12">
                        <p className="text-[11px] font-black text-slate-400 tracking-widest uppercase mb-1">
                          Assinatura Certificada
                        </p>
                        <p className="text-2xl font-black text-slate-900 uppercase tracking-tighter italic">
                          ADMINISTRAÇÃO • PS MOREIRA
                        </p>
                      </div>
                      <div className="space-y-4">
                        <p className="text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em] italic">
                          CENTRAL LUENA, MOXICO • ANGOLA
                        </p>
                        <div className="flex justify-end gap-4">
                          <button className="flex items-center gap-3 px-8 py-3 bg-white border border-slate-200 rounded-xl text-[10px] font-black uppercase text-slate-600 hover:bg-slate-100 transition-all shadow-sm">
                            <Download
                              size={16}
                              className="text-brand-primary"
                            />{" "}
                            PDF Comprovativo
                          </button>
                          <button className="flex items-center gap-3 px-8 py-3 bg-brand-primary text-white rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-brand-secondary transition-all shadow-lg shadow-blue-600/20">
                            <Send size={16} /> Enviar p/ Arquivo
                          </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </motion.div>
              ))
            )}
          </div>
        </div>
      ) : (
        <div className="bg-white rounded-[2.5rem] border border-slate-200 shadow-2xl overflow-hidden min-h-[600px]">
          <div className="px-10 py-10 bg-slate-900 text-white flex flex-col md:flex-row md:items-center justify-between gap-8 relative">
            <div className="absolute top-0 left-0 w-full h-full bg-brand-primary/5 opacity-50 skew-y-3 -mt-20 pointer-events-none" />
            <div className="relative z-10">
              <h3 className="text-3xl font-black uppercase tracking-tighter italic">
                Relatório Analítico Individual
              </h3>
              <div className="text-[10px] text-[rgba(255,255,255,0.4)] font-black uppercase tracking-[0.3em] mt-2 flex items-center gap-3">
                <div className="w-1.5 h-1.5 bg-brand-primary rounded-full animate-ping" />
                CONCILIAÇÃO MENSAL • {currentMonth}
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-4 relative z-10">
              {isAdmin && individualReports.length > 0 && (
                <button
                  onClick={handleResetMonthlyReports}
                  disabled={isProcessing}
                  className="flex items-center gap-3 px-6 py-4 bg-rose-500/10 text-rose-400 border border-rose-500/20 rounded-[1.25rem] text-[11px] font-black uppercase tracking-widest hover:bg-rose-500 hover:text-white transition-all active:scale-95 disabled:opacity-50"
                >
                  <Trash2 size={18} /> Zerar Relatórios
                </button>
              )}
              <button
                onClick={handleGenerateIndividualReports}
                disabled={isProcessing}
                className="flex items-center gap-3 px-10 py-4 bg-brand-primary text-white rounded-[1.25rem] text-[11px] font-black uppercase tracking-widest hover:bg-brand-secondary transition-all shadow-2xl shadow-blue-600/30 active:scale-95 disabled:opacity-50"
              >
                {isProcessing ? (
                  <Loader2 size={18} className="animate-spin" />
                ) : (
                  <Calculator size={18} />
                )}
                Sincronizar Dados de Renda
              </button>
            </div>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="bg-[#bfdbfe]/40 text-[#1e3a8a] text-[10px] font-black uppercase tracking-[0.2em] border-b border-[#93c5fd]">
                  <th className="px-6 py-6 border-r border-slate-200">
                    Colaborador
                  </th>
                  <th className="px-6 py-6 border-r border-slate-200 text-center">
                    Rendimento
                  </th>
                  <th className="px-6 py-6 border-r border-slate-200 text-center">
                    Custos
                  </th>
                  <th className="px-6 py-6 border-r border-slate-200 text-center">
                    Comissão 10%
                  </th>
                  <th className="px-6 py-6 border-r border-slate-200 text-center">
                    Subsídios
                  </th>
                  <th className="px-6 py-6 border-r border-slate-200 text-center bg-slate-50">
                    Total Bruto
                  </th>
                  <th className="px-6 py-6 border-r border-slate-200 text-center">
                    Descontos
                  </th>
                  <th className="px-6 py-6 border-r border-slate-200 text-center bg-emerald-50 text-emerald-700">
                    Salário Líquido
                  </th>
                  <th className="px-6 py-6 border-r border-slate-200 text-center">
                    Dias Trab.
                  </th>
                  <th className="px-6 py-6 text-center">Aprovação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {individualReports.length === 0 ? (
                  <tr>
                    <td
                      colSpan={10}
                      className="py-20 text-center text-slate-400 font-black uppercase tracking-widest text-[11px] opacity-40"
                    >
                      Clique em "Sincronizar Dados" para gerar os relatórios
                      deste mês.
                    </td>
                  </tr>
                ) : (
                  individualReports.map((item, idx) => {
                    const total = (item.baseSalary || 0) + (item.subs || 0);
                    const net = total - (item.discounts || 0);
                    return (
                      <tr
                        key={item.id}
                        className="hover:bg-blue-50 transition-colors group/row"
                      >
                        <td className="px-6 py-4 border-r border-slate-100 text-[11px] font-black text-slate-800 uppercase italic tracking-tighter bg-slate-50/50 group-hover/row:text-brand-primary">
                          {idx + 1}. {item.driverName}
                        </td>
                        <td className="px-6 py-4 border-r border-slate-100 text-center text-[10px] font-bold text-slate-600 font-mono">
                          {(item.totalGross || 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 border-r border-slate-100 text-center text-[10px] font-bold text-rose-500 font-mono">
                          {(item.totalCosts || 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 border-r border-slate-100 text-center text-[10px] font-bold text-brand-primary font-mono italic">
                          {(item.baseSalary || 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 border-r border-slate-100 text-center text-[10px] font-bold text-slate-500 font-mono">
                          {editingReport === `subs-${item.id}` ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                defaultValue={item.subs}
                                onBlur={(e) => handleUpdateSubs(item.id, Number(e.target.value))}
                                className="w-16 px-1 py-0.5 bg-white border border-brand-primary rounded text-[10px] outline-none"
                                autoFocus
                              />
                            </div>
                          ) : (
                            <div 
                              className="cursor-pointer hover:text-brand-primary"
                              onClick={() => setEditingReport(`subs-${item.id}`)}
                            >
                              {(item.subs || 0).toLocaleString()}
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 border-r border-slate-100 text-center text-[10px] font-black text-slate-900 font-mono italic bg-slate-50/10">
                          {(total || 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 border-r border-slate-100 text-center text-[10px] font-black text-rose-600 font-mono">
                          {editingReport === item.id ? (
                            <div className="flex items-center gap-1">
                              <input
                                type="number"
                                defaultValue={item.discounts}
                                onBlur={(e) => {
                                  handleUpdateDiscount(item.id, Number(e.target.value));
                                }}
                                className="w-16 px-1 py-0.5 bg-white border border-brand-primary rounded text-[10px] outline-none"
                                autoFocus
                              />
                            </div>
                          ) : (
                            <div
                              className="flex items-center justify-center gap-1 cursor-pointer group/disc"
                              onClick={() => {
                                setEditingReport(item.id);
                                setDiscountValue(item.discounts || 0);
                              }}
                            >
                              <span>
                                {item.discounts > 0
                                  ? `-${(item.discounts || 0).toLocaleString()}`
                                  : "0"}
                              </span>
                            </div>
                          )}
                        </td>
                        <td className="px-6 py-4 border-r border-slate-100 text-center text-[12px] font-black text-emerald-800 bg-emerald-50/50 font-mono italic">
                          {(net || 0).toLocaleString()}
                        </td>
                        <td className="px-6 py-4 border-r border-slate-100 text-center text-[10px] font-black text-slate-500">
                          {item.days || 30}
                        </td>
                        <td className="px-6 py-4 text-center">
                          <div className="flex items-center justify-center gap-2">
                            {item.status === "approved_by_admin" ? (
                              <div className="inline-flex items-center gap-2 px-3 py-1 bg-emerald-50 text-emerald-600 border border-emerald-100 rounded-full text-[8px] font-black uppercase tracking-widest">
                                <ShieldCheck size={10} /> OK
                              </div>
                            ) : isAdmin ? (
                              <button
                                onClick={() =>
                                  approveIndividualReport(item.id, item.status)
                                }
                                className={cn(
                                  "px-3 py-1 rounded-lg text-[8px] font-black uppercase tracking-widest transition-all",
                                  item.status === "pending"
                                    ? "bg-amber-500 text-white"
                                    : "bg-blue-600 text-white",
                                )}
                              >
                                {item.status === "pending"
                                  ? "Validar"
                                  : "Aprovar"}
                              </button>
                            ) : (
                              <div className="px-3 py-1 bg-slate-100 text-slate-400 rounded-lg text-[8px] font-black uppercase tracking-widest italic">
                                Aguardando Admin
                              </div>
                            )}
                            {isAdmin && (
                              <button
                                onClick={() => deleteIndividualReport(item.id)}
                                className="p-1 text-slate-300 hover:text-rose-500"
                              >
                                <Trash2 size={12} />
                              </button>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              {individualReports.length > 0 && (
                <tfoot className="bg-slate-900 text-white font-black text-sm italic">
                  <tr>
                    <td className="px-6 py-8 border-r border-white/5 uppercase tracking-widest text-brand-primary">
                      Massa Salarial Operacional
                    </td>
                    <td className="px-6 py-8 border-r border-white/5 text-center font-mono opacity-80">
                      {individualReports
                        .reduce((a, b) => a + (b.totalGross || 0), 0)
                        .toLocaleString()}
                    </td>
                    <td className="px-6 py-8 border-r border-white/5 text-center font-mono text-rose-400">
                      {individualReports
                        .reduce((a, b) => a + (b.totalCosts || 0), 0)
                        .toLocaleString()}
                    </td>
                    <td className="px-6 py-8 border-r border-white/5 text-center font-mono opacity-60">
                      {individualReports
                        .reduce((a, b) => a + (b.baseSalary || 0), 0)
                        .toLocaleString()}
                    </td>
                    <td className="px-6 py-8 border-r border-white/5 text-center font-mono opacity-60">
                      {individualReports
                        .reduce((a, b) => a + (b.subs || 0), 0)
                        .toLocaleString()}
                    </td>
                    <td className="px-6 py-8 border-r border-white/5 text-center font-mono opacity-80">
                      {individualReports
                        .reduce((a, b) => a + ((b.baseSalary || 0) + (b.subs || 0)), 0)
                        .toLocaleString()}
                    </td>
                    <td className="px-6 py-8 border-r border-white/5 text-center font-mono text-rose-400 font-bold">
                      {individualReports
                        .reduce((a, b) => a + (b.discounts || 0), 0)
                        .toLocaleString()}
                    </td>
                    <td
                      className="px-6 py-8 border-r border-white/5 text-center font-mono text-emerald-400 text-xl tracking-tighter"
                      colSpan={2}
                    >
                      {individualReports
                        .reduce(
                          (a, b) => a + ((b.baseSalary || 0) + (b.subs || 0) - (b.discounts || 0)),
                          0,
                        )
                        .toLocaleString()}{" "}
                      Kz
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <div className="p-10 bg-slate-50 border-t border-slate-100 flex items-center justify-between">
            <p className="text-[10px] text-slate-400 font-black uppercase italic tracking-widest leading-loose">
              Este relatório individual é gerado através do processamento
              cruzado de telemetria gps e validação de tesouraria.
            </p>
            <div className="flex items-center gap-4 text-[9px] font-black uppercase text-slate-500">
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-amber-500 rounded-full" /> Ag.
                Contabilista
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-blue-600 rounded-full" /> Ag. Admin
              </div>
              <div className="flex items-center gap-1">
                <div className="w-2 h-2 bg-emerald-500 rounded-full" /> Pronto
                p/ Folha
              </div>
            </div>
          </div>
        </div>
      )}
      {/* Invoice Viewer Modal */}
      {isInvoiceViewerOpen && selectedInvoiceData && (
        <InvoiceViewerModal 
          isOpen={isInvoiceViewerOpen}
          onClose={() => setIsInvoiceViewerOpen(false)}
          data={selectedInvoiceData}
          documentNumber={'FR WT2025/' + (selectedInvoiceData.id?.slice(-4).toUpperCase() || '0000')}
        />
      )}
    </div>
  );
}

function ReceiptField({ label, value, onChange, readOnly, type = "text" }: any) {
  return (
    <div className="space-y-1">
      <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest px-1">
        {label}
      </label>
      <input
        type={type}
        readOnly={readOnly}
        value={value}
        onChange={(e) => onChange?.(e.target.value)}
        className={cn(
          "w-full px-4 py-2 rounded-xl text-xs font-bold outline-none border transition-all",
          readOnly 
            ? "bg-slate-100 border-slate-200 text-slate-500 cursor-not-allowed" 
            : "bg-white border-slate-200 focus:border-brand-primary focus:ring-4 focus:ring-brand-primary/5 text-slate-900"
        )}
      />
    </div>
  );
}

function ReceiptPostalField({ label, value, onChange, isDiscount }: any) {
  return (
    <div className="flex justify-between items-center py-2 border-b border-[#e6dfc8]/30 last:border-0 group">
      <span className="text-[9px] font-black text-slate-500 uppercase tracking-widest">{label}</span>
      <div className="flex items-center gap-1">
        {isDiscount && <span className="text-[10px] font-bold text-rose-400">-</span>}
        <input 
          type="number"
          value={value}
          onChange={(e) => onChange?.(e.target.value)}
          className={cn(
            "w-20 text-right text-[11px] font-black bg-transparent outline-none focus:text-brand-primary transition-colors",
            isDiscount ? "text-rose-500" : "text-slate-900"
          )}
        />
        <span className="text-[8px] font-bold text-slate-300 uppercase">Kz</span>
      </div>
    </div>
  );
}

function ResumoRow({ label, value, highlight, bold }: any) {
  return (
    <div
      className={cn(
        "flex justify-between items-center text-[10px]",
        bold ? "font-black text-slate-900" : "font-bold text-slate-500",
      )}
    >
      <span>{label}</span>
      <span className={cn(highlight ? "text-brand-primary" : "")}>
        {(value || 0).toLocaleString()} Kz
      </span>
    </div>
  );
}

function StatBox({ label, value, color, icon: Icon, sub }: any) {
  const colors: any = {
    emerald:
      "bg-emerald-50 text-emerald-600 border-emerald-100 shadow-emerald-500/5",
    rose: "bg-rose-50 text-rose-600 border-rose-100 shadow-rose-500/5",
    blue: "bg-blue-50 text-blue-600 border-blue-100 shadow-blue-500/5",
  };

  return (
    <div
      className={cn(
        "bg-white p-8 rounded-[2rem] border shadow-2xl transition-all hover:scale-[1.02] cursor-default group",
        colors[color],
      )}
    >
      <div className="flex justify-between items-start mb-6">
        <div className="p-3 bg-white rounded-2xl shadow-sm group-hover:bg-slate-900 group-hover:text-white transition-all duration-500">
          <Icon size={24} />
        </div>
        <div className="flex flex-col items-end">
          <div className="px-2 py-0.5 bg-white/50 rounded text-[8px] font-black uppercase tracking-widest border border-black/5 opacity-40">
            Live Sync
          </div>
        </div>
      </div>
      <div>
        <p className="text-[10px] font-black uppercase tracking-[0.2em] mb-1 opacity-40 italic">
          {label}
        </p>
        <div className="flex items-baseline gap-2">
          <p className="text-3xl font-black tracking-tighter italic">
            {(value || 0).toLocaleString()}
          </p>
          <span className="text-[10px] font-bold opacity-30">KZ</span>
        </div>
        {sub && (
          <p className="text-[9px] font-black uppercase tracking-widest mt-2 opacity-30 flex items-center gap-1">
            <CheckCircle2 size={10} className="text-emerald-500" />
            {sub}
          </p>
        )}
      </div>
    </div>
  );
}
