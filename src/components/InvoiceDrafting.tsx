import React, { useState, useRef } from 'react';
import { 
  FileText, 
  Plus, 
  Trash2, 
  Printer, 
  Download, 
  Trash, 
  Save,
  User,
  MapPin,
  Smartphone,
  Hash,
  Info,
  ChevronRight,
  TrendingUp,
  CreditCard,
  Building
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { InvoiceTemplate } from './InvoiceTemplate';
import { cn } from '../lib/utils';

export default function InvoiceDrafting() {
  const [invoiceData, setInvoiceData] = useState({
    id: `FACT-${Math.floor(1000 + Math.random() * 9000)}-${new Date().getFullYear()}`,
    client: '',
    phone: '',
    neighborhood: '',
    nif: '',
    vehicle: 'VIATURA DE ALUGUER',
    startDate: new Date().toISOString().split('T')[0],
    endDate: new Date().toISOString().split('T')[0],
    dailyPrice: 25000,
    observation: 'Pagamento Ref. Contrato de Aluguer',
    items: [
      { id: '1', description: 'ALUGUER DE VIATURA', quantity: 1, unitPrice: 25000 }
    ]
  });

  const [isGenerating, setIsGenerating] = useState(false);
  const invoiceRef = useRef<HTMLDivElement>(null);

  const calculateTotal = () => {
    return invoiceData.items.reduce((acc, item) => acc + (item.quantity * item.unitPrice), 0);
  };

  const handlePrint = async () => {
    if (!invoiceRef.current) return;
    setIsGenerating(true);
    try {
      const element = invoiceRef.current;
      const canvas = await html2canvas(element, { scale: 2, useCORS: true });
      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF({
        orientation: 'p',
        unit: 'mm',
        format: 'a4',
      });
      
      const imgWidth = 210;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;
      
      pdf.addImage(imgData, 'PNG', 0, 0, imgWidth, imgHeight);
      pdf.save(`PSM_FATURA_${invoiceData.client || 'GERAL'}_${invoiceData.id}.pdf`);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Erro ao gerar PDF. Tente novamente.');
    } finally {
      setIsGenerating(false);
    }
  };

  const addItem = () => {
    setInvoiceData(prev => ({
      ...prev,
      items: [...prev.items, { id: Date.now().toString(), description: '', quantity: 1, unitPrice: 0 }]
    }));
  };

  const removeItem = (id: string) => {
    setInvoiceData(prev => ({
      ...prev,
      items: prev.items.filter(item => item.id !== id)
    }));
  };

  const updateItem = (id: string, field: string, value: any) => {
    setInvoiceData(prev => ({
      ...prev,
      items: prev.items.map(item => item.id === id ? { ...item, [field]: value } : item)
    }));
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 animate-in fade-in duration-700">
      <div className="flex flex-col md:flex-row md:items-center justify-between bg-white px-10 py-10 rounded-[2.5rem] border border-slate-200 shadow-sm relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-96 h-96 bg-brand-primary/5 rounded-full -mr-48 -mt-48 blur-[80px] opacity-50 group-hover:bg-brand-primary/10 transition-colors duration-700" />
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-2">
            <h2 className="text-4xl font-black text-slate-900 tracking-tighter uppercase italic">Redactor de Faturas</h2>
            <div className="px-3 py-1 bg-brand-primary/10 text-brand-primary rounded-full text-[10px] font-black uppercase tracking-[0.2em] border border-brand-primary/20">PSM INVOICING EXPERT</div>
          </div>
          <p className="text-[11px] text-slate-400 font-bold uppercase tracking-[0.3em] flex items-center gap-2">
            <FileText size={14} className="text-brand-primary" />
            Emissão de Facturas-Recibo & Documentos de Cobrança • CENTRAL DE CONTABILIDADE
          </p>
        </div>
        <div className="flex items-center gap-3 relative z-10">
           <button 
            onClick={handlePrint}
            disabled={isGenerating}
            className="flex items-center gap-3 px-8 py-4 bg-slate-900 text-white rounded-[1.25rem] text-[11px] font-black uppercase tracking-widest hover:bg-black transition-all shadow-2xl shadow-black/20 active:scale-95 disabled:opacity-50"
          >
            {isGenerating ? <TrendingUp className="animate-spin" size={18} /> : <Printer size={18} />}
            Emitir & Gerar PDF
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        {/* Editor Form */}
        <div className="space-y-6">
          <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm">
             <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-900">
                   <User size={20} />
                </div>
                <div>
                   <h3 className="text-sm font-black uppercase tracking-tight italic">Dados do Adquirente</h3>
                   <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Informações de Facturação</p>
                </div>
             </div>

             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                      <Hash size={12} className="text-brand-primary" /> Nº Fatura
                   </label>
                   <input 
                      type="text" 
                      value={invoiceData.id}
                      onChange={(e) => setInvoiceData({...invoiceData, id: e.target.value})}
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:bg-white focus:border-brand-primary transition-all outline-none"
                   />
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                      <User size={12} className="text-brand-primary" /> Nome / Empresa
                   </label>
                   <input 
                      type="text" 
                      value={invoiceData.client}
                      onChange={(e) => setInvoiceData({...invoiceData, client: e.target.value})}
                      placeholder="Ex: João Baptista"
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:bg-white focus:border-brand-primary transition-all outline-none"
                   />
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                      <Smartphone size={12} className="text-brand-primary" /> Telefone
                   </label>
                   <input 
                      type="text" 
                      value={invoiceData.phone}
                      onChange={(e) => setInvoiceData({...invoiceData, phone: e.target.value})}
                      placeholder="+244 9..."
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:bg-white focus:border-brand-primary transition-all outline-none"
                   />
                </div>
                <div className="space-y-2">
                   <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                      <MapPin size={12} className="text-brand-primary" /> Endereço / Bairro
                   </label>
                   <input 
                      type="text" 
                      value={invoiceData.neighborhood}
                      onChange={(e) => setInvoiceData({...invoiceData, neighborhood: e.target.value})}
                      placeholder="Ex: Luena, Moxico"
                      className="w-full px-5 py-3.5 bg-slate-50 border border-slate-200 rounded-xl text-sm font-bold focus:bg-white focus:border-brand-primary transition-all outline-none"
                   />
                </div>
             </div>
          </div>

          <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm">
             <div className="flex items-center justify-between mb-6">
                <div className="flex items-center gap-3">
                   <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-900">
                      <TrendingUp size={20} />
                   </div>
                   <div>
                      <h3 className="text-sm font-black uppercase tracking-tight italic">Linhas de Serviço</h3>
                      <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Discriminação de Itens</p>
                   </div>
                </div>
                <button 
                  onClick={addItem}
                  className="p-2.5 bg-slate-900 text-white rounded-xl hover:bg-black transition-all shadow-lg active:scale-95"
                >
                  <Plus size={18} />
                </button>
             </div>

             <div className="space-y-4">
                {invoiceData.items.map((item, index) => (
                   <div key={item.id} className="flex gap-4 items-end bg-slate-50 p-6 rounded-2xl border border-slate-200 group relative">
                      <div className="flex-1 space-y-2">
                         <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Descrição do Item {index + 1}</label>
                         <input 
                            type="text"
                            value={item.description}
                            onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                            placeholder="Ex: Aluguer de Viatura PSM"
                            className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-brand-primary"
                         />
                      </div>
                      <div className="w-20 space-y-2">
                         <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">QTD</label>
                         <input 
                            type="number"
                            value={item.quantity}
                            onChange={(e) => updateItem(item.id, 'quantity', parseFloat(e.target.value) || 0)}
                            className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-brand-primary text-center"
                         />
                      </div>
                      <div className="w-40 space-y-2">
                         <label className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Valor Unit (Kz)</label>
                         <input 
                            type="number"
                            value={item.unitPrice}
                            onChange={(e) => updateItem(item.id, 'unitPrice', parseFloat(e.target.value) || 0)}
                            className="w-full px-4 py-2 bg-white border border-slate-200 rounded-lg text-xs font-bold outline-none focus:border-brand-primary"
                         />
                      </div>
                      {invoiceData.items.length > 1 && (
                        <button 
                          onClick={() => removeItem(item.id)}
                          className="p-2.5 text-rose-500 hover:bg-rose-50 rounded-xl transition-all"
                        >
                          <Trash2 size={18} />
                        </button>
                      )}
                   </div>
                ))}
             </div>

             <div className="mt-8 pt-6 border-t border-slate-100 flex items-center justify-between">
                <div>
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Total Líquido</p>
                  <h4 className="text-3xl font-black text-brand-primary tracking-tighter italic">
                    {new Intl.NumberFormat('pt-AO', { style: 'currency', currency: 'AOA' }).format(calculateTotal())}
                  </h4>
                </div>
                <div className="text-right">
                  <p className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-2">COORDENADAS PADRÃO (AO06)</p>
                  <div className="flex items-center gap-2 px-4 py-2 bg-slate-900 text-white rounded-xl text-[10px] font-mono tracking-tighter">
                     <Building size={14} className="text-brand-primary" />
                     AO06 0040 0000 8044 8511 0181
                  </div>
                </div>
             </div>
          </div>

          <div className="bg-white rounded-[2rem] border border-slate-200 p-8 shadow-sm">
             <div className="flex items-center gap-3 mb-6">
                <div className="w-10 h-10 bg-slate-100 rounded-xl flex items-center justify-center text-slate-900">
                   <Info size={20} />
                </div>
                <div>
                   <h3 className="text-sm font-black uppercase tracking-tight italic">Notas & Observações</h3>
                   <p className="text-[10px] text-slate-400 font-bold uppercase tracking-widest">Instruções de Pagamento</p>
                </div>
             </div>
             <textarea 
                value={invoiceData.observation}
                onChange={(e) => setInvoiceData({...invoiceData, observation: e.target.value})}
                rows={3}
                placeholder="Ex: Instruções de IBAN, prazos de pagamento..."
                className="w-full px-6 py-4 bg-slate-50 border border-slate-200 rounded-2xl text-sm font-bold focus:bg-white focus:border-brand-primary outline-none transition-all resize-none italic"
             />
          </div>
        </div>

        {/* Live Preview */}
        <div className="sticky top-8 space-y-6">
           <div className="flex items-center justify-between mb-4 px-4">
              <div className="flex items-center gap-2">
                 <div className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse" />
                 <span className="text-[10px] font-black text-slate-400 uppercase tracking-[0.2em]">Live Preview Engine</span>
              </div>
              <div className="flex items-center gap-4 text-[10px] font-bold text-slate-400 uppercase tracking-widest">
                 <span>Zoom 75%</span>
                 <span>A4 Sheet Size</span>
              </div>
           </div>

           <div className="scale-[0.75] origin-top border-4 border-white shadow-[0_40px_100px_-20px_rgba(15,23,42,0.15)] rounded-lg overflow-hidden">
             <div ref={invoiceRef}>
               <InvoiceTemplate 
                 data={{
                   ...invoiceData,
                   dailyPrice: calculateTotal() / Math.max(1, (new Date(invoiceData.endDate).getTime() - new Date(invoiceData.startDate).getTime()) / (1000 * 60 * 60 * 24)),
                   startDate: invoiceData.startDate,
                   endDate: invoiceData.endDate,
                   vehicle: invoiceData.items[0]?.description || 'Serviços'
                 } as any}
                 documentNumber={invoiceData.id}
               />
             </div>
           </div>

           <div className="bg-slate-900/5 backdrop-blur-xl border border-brand-primary/10 p-8 rounded-[2.5rem] mt-[-100px] relative z-10 mx-10">
              <div className="flex items-start gap-4">
                 <div className="w-12 h-12 bg-brand-primary rounded-2xl flex items-center justify-center text-white shadow-xl shadow-brand-primary/20">
                    <Info size={24} />
                 </div>
                 <div>
                    <h4 className="text-sm font-black text-slate-900 uppercase italic tracking-tight">Dica de Exportação</h4>
                    <p className="text-[11px] text-slate-600 font-medium leading-relaxed mt-1">
                      O PDF será gerado com alta densidade de pixeis (High DPI) para garantir clareza máxima na impressão térmica ou laser. Verifique se o nome do cliente está correto antes de clicar em <strong>"Emitir & Gerar PDF"</strong>.
                    </p>
                 </div>
              </div>
           </div>
        </div>
      </div>
    </div>
  );
}
