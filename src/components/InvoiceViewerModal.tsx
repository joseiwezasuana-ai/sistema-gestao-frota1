import React, { useRef } from 'react';
import { X, Printer, Download, Loader2, Edit2, FileText, Calendar, User, Hash, DollarSign } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { InvoiceTemplate } from './InvoiceTemplate';
import { cn } from '../lib/utils';
import html2canvas from 'html2canvas';
import jsPDF from 'jspdf';

interface InvoiceViewerModalProps {
  isOpen: boolean;
  onClose: () => void;
  data: any;
  documentNumber: string;
}

export const InvoiceViewerModal: React.FC<InvoiceViewerModalProps> = ({ isOpen, onClose, data: initialData, documentNumber: initialDocNumber }) => {
  const [isGenerating, setIsGenerating] = React.useState(false);
  const [isEditMode, setIsEditMode] = React.useState(true);
  const [invoiceData, setInvoiceData] = React.useState({ ...initialData });
  const [documentNumber, setDocumentNumber] = React.useState(initialDocNumber);
  
  const invoiceRef = useRef<HTMLDivElement>(null);

  const handleDownloadPDF = async () => {
    if (!invoiceRef.current) return;
    setIsGenerating(true);
    try {
      const canvas = await html2canvas(invoiceRef.current, {
        scale: 2,
        useCORS: true,
        logging: false,
        backgroundColor: '#ffffff'
      });
      
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'portrait',
        unit: 'mm',
        format: 'a4'
      });
      
      const imgProps = pdf.getImageProperties(imgData);
      const pdfWidth = pdf.internal.pageSize.getWidth();
      const pdfHeight = (imgProps.height * pdfWidth) / imgProps.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
      pdf.save(`FACTURA_PSM_${invoiceData.client.replace(/\s+/g, '_')}_${(invoiceData.id || '0000').slice(-6)}.pdf`);
    } catch (err) {
      console.error(err);
      alert("Erro ao gerar PDF");
    } finally {
      setIsGenerating(false);
    }
  };

  const handlePrint = () => {
    const printContent = invoiceRef.current;
    if (!printContent) return;

    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    printWindow.document.write(`
      <html>
        <head>
          <title>Factura PSM - ${documentNumber}</title>
          <script src="https://cdn.tailwindcss.com"></script>
          <style>
            @media print {
              body { margin: 0; padding: 0; }
              .no-print { display: none !important; }
            }
          </style>
        </head>
        <body>
          <div class="p-8">
            ${printContent.innerHTML}
          </div>
          <script>
            window.onload = () => {
              window.print();
              window.onafterprint = () => window.close();
            };
          </script>
        </body>
      </html>
    `);
    printWindow.document.close();
  };

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/80 backdrop-blur-sm p-4"
      >
        <motion.div 
          initial={{ scale: 0.95, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          exit={{ scale: 0.95, opacity: 1 }}
          className="bg-white rounded-3xl w-full max-w-5xl max-h-[95vh] overflow-hidden flex flex-col shadow-2xl border border-white/20"
        >
          {/* Toolbar */}
          <div className="px-8 py-4 bg-white dark:bg-slate-900 border-b border-slate-200 dark:border-white/5 flex items-center justify-between">
            <div className="flex items-center gap-4">
               <div className="bg-brand-primary p-2 rounded-lg">
                  <FileText className="text-white" size={20} />
               </div>
               <div>
                  <h2 className="text-slate-900 dark:text-white font-black uppercase text-sm tracking-tighter">Editor de Facturação</h2>
                  <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">{documentNumber}</p>
               </div>
            </div>

            <div className="flex items-center gap-3">
               <button 
                onClick={() => setIsEditMode(!isEditMode)}
                className={cn(
                  "flex items-center gap-2 px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest transition-all active:scale-95",
                  isEditMode ? "bg-brand-primary text-white" : "bg-slate-100 dark:bg-slate-800 text-slate-600 dark:text-slate-400 border border-slate-200 dark:border-white/5"
                )}
               >
                 <Edit2 size={16} /> {isEditMode ? 'Fechar Editor' : 'Editar Dados'}
               </button>

               <div className="h-6 w-px bg-slate-200 dark:bg-white/10 mx-2" />

               <button 
                onClick={handlePrint}
                className="flex items-center gap-2 bg-slate-900 dark:bg-black text-white px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-black transition-all active:scale-95 border border-white/10"
               >
                 <Printer size={16} /> Imprimir
               </button>
               <button 
                onClick={handleDownloadPDF}
                disabled={isGenerating}
                className="flex items-center gap-2 bg-brand-primary text-white px-5 py-2.5 rounded-xl text-[11px] font-black uppercase tracking-widest hover:bg-blue-700 transition-all active:scale-95 disabled:opacity-50 shadow-lg shadow-brand-primary/20"
               >
                 {isGenerating ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                 PDF
               </button>
               <button 
                onClick={onClose}
                className="p-2.5 bg-slate-100 dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl hover:bg-slate-200 dark:hover:bg-slate-700 transition-all active:scale-95 border border-slate-200 dark:border-white/5"
               >
                 <X size={20} />
               </button>
            </div>
          </div>

          <div className="flex-1 flex overflow-hidden">
            {/* Editing Sidebar */}
            <AnimatePresence>
              {isEditMode && (
                <motion.div 
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 350, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  className="border-r border-slate-200 dark:border-white/5 bg-slate-50 dark:bg-slate-900 overflow-y-auto no-scrollbar"
                >
                  <div className="p-8 space-y-6">
                    <div className="space-y-4">
                      <h4 className="text-[11px] font-black text-brand-primary uppercase tracking-[0.2em] mb-4">Dados do Documento</h4>
                      
                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Nº Documento</label>
                        <div className="relative">
                          <Hash className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                          <input 
                            type="text"
                            value={documentNumber}
                            onChange={(e) => setDocumentNumber(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-brand-primary transition-all"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Cliente / Beneficiário</label>
                        <div className="relative">
                          <User className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                          <input 
                            type="text"
                            value={invoiceData.client}
                            onChange={(e) => setInvoiceData({ ...invoiceData, client: e.target.value })}
                            className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-brand-primary transition-all"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Data Início</label>
                          <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                            <input 
                              type="date"
                              value={invoiceData.startDate ? new Date(invoiceData.startDate).toISOString().split('T')[0] : ''}
                              onChange={(e) => setInvoiceData({ ...invoiceData, startDate: e.target.value })}
                              className="w-full pl-9 pr-2 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-xl text-[10px] font-bold text-slate-900 dark:text-white outline-none focus:border-brand-primary transition-all uppercase"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Data Fim</label>
                          <div className="relative">
                            <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={12} />
                            <input 
                              type="date"
                              value={invoiceData.endDate ? new Date(invoiceData.endDate).toISOString().split('T')[0] : ''}
                              onChange={(e) => setInvoiceData({ ...invoiceData, endDate: e.target.value })}
                              className="w-full pl-9 pr-2 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-xl text-[10px] font-bold text-slate-900 dark:text-white outline-none focus:border-brand-primary transition-all uppercase"
                            />
                          </div>
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Viatura associada</label>
                        <div className="relative">
                          <FileText className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                          <input 
                            type="text"
                            value={invoiceData.vehicle}
                            onChange={(e) => setInvoiceData({ ...invoiceData, vehicle: e.target.value })}
                            className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-brand-primary transition-all"
                          />
                        </div>
                      </div>

                      <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1">Preço Diário (AOA)</label>
                        <div className="relative">
                          <DollarSign className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" size={14} />
                          <input 
                            type="number"
                            value={invoiceData.dailyPrice}
                            onChange={(e) => setInvoiceData({ ...invoiceData, dailyPrice: Number(e.target.value) })}
                            className="w-full pl-9 pr-4 py-2.5 bg-white dark:bg-slate-800 border border-slate-200 dark:border-white/5 rounded-xl text-xs font-bold text-slate-900 dark:text-white outline-none focus:border-brand-primary transition-all"
                          />
                        </div>
                      </div>
                    </div>

                    <div className="pt-6 border-t border-slate-200 dark:border-white/5">
                        <div className="bg-brand-primary/5 rounded-2xl p-4 border border-brand-primary/10">
                           <p className="text-[9px] font-black text-brand-primary uppercase tracking-[0.2em] mb-1">Previsão de Total</p>
                           <p className="text-xl font-black text-brand-primary italic">
                              {(() => {
                                const start = new Date(invoiceData.startDate);
                                const end = new Date(invoiceData.endDate);
                                const isValidRange = !isNaN(start.getTime()) && !isNaN(end.getTime());
                                const diffTime = isValidRange ? end.getTime() - start.getTime() : 0;
                                const days = isValidRange ? Math.max(1, Math.ceil(diffTime / (1000 * 60 * 60 * 24))) : 1;
                                return ((invoiceData.dailyPrice || 0) * days).toLocaleString();
                              })()} <span className="text-xs">KZ</span>
                           </p>
                        </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Preview Area */}
            <div className="flex-1 overflow-y-auto p-12 bg-slate-100 dark:bg-slate-950/50 flex justify-center custom-scrollbar">
               <div ref={invoiceRef} className="shadow-2xl h-fit">
                  <InvoiceTemplate data={invoiceData} documentNumber={documentNumber} />
               </div>
            </div>
          </div>

          <div className="px-8 py-3 bg-slate-50 border-t border-slate-200 text-center">
             <p className="text-[10px] text-slate-400 font-bold italic">
               ZDI3-Processado por programa validado N.152/AGT/2019 • PSMOREIRA COMERCIAL (SU), LDA
             </p>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
};
