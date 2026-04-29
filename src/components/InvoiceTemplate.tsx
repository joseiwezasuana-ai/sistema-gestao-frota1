import React from 'react';
import { format } from 'date-fns';

interface InvoiceData {
  id: string;
  client: string;
  vehicle: string;
  startDate: string;
  endDate: string;
  dailyPrice: number;
  phone?: string;
  neighborhood?: string;
  createdAt?: string;
  status?: string;
}

interface InvoiceTemplateProps {
  data: InvoiceData;
  documentNumber: string;
}

export const InvoiceTemplate: React.FC<InvoiceTemplateProps> = ({ data, documentNumber }) => {
  const start = new Date(data.startDate);
  const end = new Date(data.endDate);
  const days = Math.max(1, Math.ceil((end.getTime() - start.getTime()) / (1000 * 60 * 60 * 24)));
  const totalAmount = data.dailyPrice * days;
  const issueDate = data.createdAt ? format(new Date(data.createdAt), 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd');

  return (
    <div id="invoice-capture" className="w-[800px] p-8 bg-white text-slate-900 font-sans mx-auto border border-slate-100 shadow-2xl">
      {/* Header */}
      <div className="flex justify-between items-start mb-8">
        <div className="flex flex-col">
          <div className="flex items-center gap-4 mb-4">
            <div className="relative w-16 h-16 flex items-center justify-center">
              {/* Stylized Logo similar to the image */}
              <div className="absolute inset-0 border-4 border-blue-600 rounded-full border-t-red-500 rotate-45"></div>
              <div className="relative z-10 flex flex-col items-center leading-none">
                <span className="text-2xl font-black text-blue-900 leading-none">PS</span>
              </div>
            </div>
            <div className="leading-tight">
              <h1 className="text-3xl font-black tracking-tighter text-blue-900 italic">MOREIRA</h1>
              <p className="text-[10px] font-black uppercase tracking-[0.2em] text-blue-800">COMERCIAL (SU), LDA</p>
            </div>
          </div>
          <div className="text-[10px] space-y-0.5 mt-2">
            <p className="font-black text-slate-800 uppercase text-xs">PSMOREIRA COMERCIAL (SU), LDA</p>
            <p><span className="font-bold">NIF:</span> 5001062654</p>
            <p><span className="font-bold">ENDEREÇO:</span> Bairro Social Da Juventude</p>
            <p><span className="font-bold">TELEFONE:</span> +244 921 277 223</p>
            <p><span className="font-bold">EMAIL:</span> paulosergio8280@gmail.com</p>
            <p className="font-bold underline decoration-blue-500">Moxico-angola</p>
          </div>
        </div>

        <div className="text-right">
          <h2 className="text-3xl font-serif italic mb-2 tracking-tight">Factura Recibo</h2>
          <div className="flex flex-col items-end">
            {/* Mock Barcode */}
            <div className="w-48 h-8 flex gap-px bg-white mb-1">
              {[...Array(40)].map((_, i) => (
                <div key={i} className="bg-black" style={{ width: `${Math.random() > 0.5 ? 2 : 1}px` }}></div>
              ))}
            </div>
            <p className="text-xs font-mono tracking-[0.3em] font-normal uppercase">{documentNumber}</p>
            <p className="text-[10px] font-black uppercase mt-4 underline decoration-double">Original</p>
          </div>
        </div>
      </div>

      {/* Exmo(s) Senhor(es) box */}
      <div className="flex justify-end mb-6">
        <div className="w-1/2 border-2 border-slate-800 rounded-xl p-4 min-h-[120px]">
          <p className="text-[10px] font-medium text-slate-400 mb-2 italic">Exmo(s) Senhor(es)</p>
          <div className="space-y-1">
            <h3 className="font-black text-lg uppercase tracking-tight leading-none mb-2">{data.client}</h3>
            {data.phone && <p className="text-xs font-bold"><span className="text-slate-400">Telefone:</span> {data.phone}</p>}
            {data.neighborhood && <p className="text-xs font-bold"><span className="text-slate-400">Endereço:</span> {data.neighborhood}</p>}
          </div>
        </div>
      </div>

      {/* Info Bar */}
      <div className="grid grid-cols-7 border-t border-b border-slate-900 bg-slate-50 mb-6">
        <div className="p-2 border-r border-slate-400">
          <p className="text-[8px] font-black uppercase mb-1">V/Nº CONTRIB.</p>
          <p className="text-[10px] font-bold">5000166405</p>
        </div>
        <div className="p-2 border-r border-slate-400">
          <p className="text-[8px] font-black uppercase mb-1">CLIENTE V/REFª</p>
          <p className="text-[10px] font-bold">5000166405</p>
        </div>
        <div className="p-2 border-r border-slate-400">
          <p className="text-[8px] font-black uppercase mb-1">VEND.</p>
          <p className="text-[10px] font-bold">39</p>
        </div>
        <div className="p-2 border-r border-slate-400 col-span-1">
          <p className="text-[8px] font-black uppercase mb-1">CONDIÇÕES DE</p>
          <p className="text-[10px] font-bold">Pronto Pagamento</p>
        </div>
        <div className="p-2 border-r border-slate-400">
          <p className="text-[8px] font-black uppercase mb-1">DATA EMISSÃO</p>
          <p className="text-[10px] font-bold">{issueDate}</p>
        </div>
        <div className="p-2 border-r border-slate-400">
          <p className="text-[8px] font-black uppercase mb-1">DATA VENCIM.</p>
          <p className="text-[10px] font-bold">{issueDate}</p>
        </div>
        <div className="p-2">
          <p className="text-[8px] font-black uppercase mb-1">PÁG.</p>
          <p className="text-[10px] font-bold">1/1</p>
        </div>
      </div>

      {/* Items Table */}
      <div className="mb-0 min-h-[400px] border border-slate-900 rounded-t-lg overflow-hidden">
        <table className="w-full text-left">
          <thead className="bg-slate-200 border-b border-slate-900">
            <tr className="text-[9px] font-black uppercase">
              <th className="px-4 py-3">REFERÊNCIA</th>
              <th className="px-4 py-3">DESCRIÇÃO</th>
              <th className="px-4 py-3 text-right">QTD.</th>
              <th className="px-4 py-3 text-right">P.UNIT (S/IMP.)</th>
              <th className="px-4 py-3 text-right">DESC (%)</th>
              <th className="px-4 py-3 text-right">TAXA (%)</th>
              <th className="px-4 py-3 text-right">TOTAL (C/IMP.)</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            <tr className="text-[10px] font-bold">
              <td className="px-4 py-4 uppercase">{data.id?.slice(-11).toUpperCase()}</td>
              <td className="px-4 py-4 uppercase">ALUGUER DE {data.vehicle} - {days} Dias</td>
              <td className="px-4 py-4 text-right">{days.toFixed(2)}</td>
              <td className="px-4 py-4 text-right">{data.dailyPrice?.toLocaleString('pt-PT', {minimumFractionDigits: 2})}</td>
              <td className="px-4 py-4 text-right">0,00 %</td>
              <td className="px-4 py-4 text-right">0,00</td>
              <td className="px-4 py-4 text-right">{totalAmount.toLocaleString('pt-PT', {minimumFractionDigits: 2})}</td>
            </tr>
            {/* Empty rows to fill space */}
            {[...Array(10)].map((_, i) => (
              <tr key={i} className="h-4">
                <td colSpan={7}></td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="bg-slate-50 border border-slate-400 p-2 text-center text-[10px] font-black uppercase mb-6">
        Os artigos foram colocados à disposição do adquirente em {issueDate}
      </div>

      {/* Bottom Section */}
      <div className="flex gap-4">
        <div className="flex-1 space-y-4">
          <div className="border border-slate-900 overflow-hidden">
            <div className="bg-slate-200 px-4 py-2 border-b border-slate-400">
              <h4 className="text-[10px] font-black uppercase italic">RESUMO DE IMPOSTO</h4>
            </div>
            <div className="p-3 space-y-2">
              <div className="grid grid-cols-4 text-[9px] font-black uppercase border-b border-dashed border-slate-300 pb-1">
                <span>DESIGNAÇÃO DO IVA</span>
                <span>Taxa %</span>
                <span>INCIDÊNCIA</span>
                <span className="text-right">IVA</span>
              </div>
              <div className="grid grid-cols-4 text-[10px] font-bold">
                <span className="uppercase">Regime Simplificado</span>
                <span>-</span>
                <span>{totalAmount.toLocaleString('pt-PT', {minimumFractionDigits: 2})}</span>
                <span className="text-right">0,00</span>
              </div>
            </div>
          </div>

          <div className="text-[10px]">
            <p className="font-black uppercase italic decoration-double underline mb-2">DESCRIÇÃO <span className="ml-24">INFORMAÇÃO EXTRA</span></p>
            <div className="grid grid-cols-2">
              <p className="font-bold">Multicaixa / Cash</p>
              <p className="font-bold">O B S : Pagamento Ref. Contrato</p>
            </div>
          </div>

          <div className="border border-slate-900 overflow-hidden">
             <div className="bg-slate-200 px-4 py-2 border-b border-slate-400">
              <h4 className="text-[10px] font-black uppercase italic">CORDENADAS BANCÁRIAS</h4>
            </div>
            <div className="p-3">
              <div className="flex justify-between text-[10px] font-bold">
                <span>BANCO BAI</span>
                <span className="font-mono">AO06 0040 0000 8044 8511 0181</span>
              </div>
            </div>
          </div>
        </div>

        <div className="w-[320px] border-2 border-slate-900 overflow-hidden h-fit">
          <div className="bg-slate-200 px-4 py-2 border-b border-slate-900 text-center">
            <h4 className="text-[11px] font-black uppercase italic">RESUMO</h4>
          </div>
          <div className="p-0 text-[10px]">
            <div className="px-4 py-2 flex justify-between border-b border-slate-100 font-bold uppercase">
              <span>TOTAL ILIQUIDO</span>
              <span>{totalAmount.toLocaleString('pt-PT', {minimumFractionDigits: 2})}</span>
            </div>
            <div className="px-4 py-2 flex justify-between border-b border-slate-100 font-bold uppercase">
              <span>DESCONTO GLOBAL 0,00 %</span>
              <span>0,00</span>
            </div>
            <div className="px-4 py-2 flex justify-between border-b border-slate-100 font-bold uppercase">
              <span>DESCONTO DE LINHA</span>
              <span>0,00</span>
            </div>
            <div className="px-4 py-2 flex justify-between border-b border-slate-100 font-bold uppercase text-slate-400">
              <span>PORTE</span>
              <span>0,00</span>
            </div>
            <div className="px-4 py-2 flex justify-between border-b border-slate-100 font-bold uppercase">
              <span>TOTAL LÍQUIDO</span>
              <span>{totalAmount.toLocaleString('pt-PT', {minimumFractionDigits: 2})}</span>
            </div>
            <div className="px-4 py-2 flex justify-between border-b border-slate-100 font-bold uppercase">
              <span>IMPOSTO (IVA)</span>
              <span>0,00</span>
            </div>
            <div className="px-4 py-2 flex justify-between border-b border-slate-800 font-bold uppercase">
              <span>RETENÇÃO NA FONTE 0,00 %</span>
              <span>0,00</span>
            </div>
            <div className="p-4 bg-slate-50 text-center space-y-1">
              <p className="text-[11px] font-black uppercase tracking-widest leading-none">TOTAL DO DOCUMENTO:</p>
              <p className="text-2xl font-black">{totalAmount.toLocaleString('pt-PT', {minimumFractionDigits: 2})}</p>
            </div>
            <div className="px-4 py-4 bg-white border-t-2 border-slate-900 text-[9px] font-bold italic text-slate-600">
              Extenso: {new Intl.NumberFormat('pt-PT', { style: 'currency', currency: 'AOA' }).format(totalAmount).replace('AOA', 'Kwanza')}
            </div>
          </div>
        </div>
      </div>

      <div className="mt-8 pt-4 border-t border-slate-200">
         <div className="flex justify-between items-end text-[9px] font-bold text-slate-400 italic">
            <p>ZDI3-Processado por programa validado N.152/AGT/2019</p>
            <div className="text-right">
              <div className="w-32 h-1 bg-blue-600 mb-1"></div>
              <p className="uppercase font-black text-slate-900 not-italic">PSMOREIRA COMERCIAL (SU), LDA</p>
            </div>
         </div>
      </div>
    </div>
  );
};
