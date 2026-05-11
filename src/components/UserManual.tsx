
import React from 'react';
import { 
  BookOpen, 
  Truck, 
  Calendar, 
  Zap, 
  ShieldAlert, 
  Wallet, 
  Settings, 
  Smartphone,
  CheckCircle2,
  Printer,
  ChevronRight,
  Info
} from 'lucide-react';
import { motion } from 'motion/react';

export default function UserManual() {
  const sections = [
    {
      title: '1. Gestão de Frota & Escalas 24h',
      icon: <Truck size={20} />,
      content: 'Nesta sessão, você gere todas as viaturas da PSM COMERCIAL. Pode registar novos veículos, ver o estado atual (Disponível, Em Manutenção, Ocupado) e aceder ao Planeamento de Turnos.',
      details: [
        'Prefixos organizados numericamente (TX-01, TX-10, etc).',
        'Filtros rápidos para encontrar viaturas específicas.',
        'Atalhos para manutenção e histórico.'
      ]
    },
    {
      title: '2. Escalamento de Turnos (Calendário)',
      icon: <Calendar size={20} />,
      content: 'Localizado dentro da aba de Frota, o calendário permite organizar a operação diária e semanal.',
      details: [
        'Turnos Disponíveis: Diurno, Nocturno e agora o regime de 24 Horas.',
        'Duplicação Rápida: Use o ícone de copiar (amanhã) para clonar a escala de um motorista para o dia seguinte instantaneamente.',
        'Estados: Ativo, Folga ou Suspenso (destacado em vermelho).'
      ]
    },
    {
      title: '3. Monitorização em Tempo Real',
      icon: <Zap size={20} />,
      content: 'O coração operacional do sistema. Monitorize a localização e alertas críticos.',
      details: [
        'Alertas de Velocidade: Notificações automáticas se passar dos 85km/h.',
        'Pânico (SOS): Alertas visuais e sonoros imediatos em caso de emergência.',
        'Visualização em Mapa: Acompanhe as viaturas em movimento no Moxico.'
      ]
    },
    {
      title: '4. Gestão Financeira (Rendas)',
      icon: <Wallet size={20} />,
      content: 'Verificação e validação de pagamentos diários dos motoristas.',
      details: [
        'Lançamento de rendas diárias.',
        'Controle de dívidas e saldos pendentes.',
        'Gala de faturamento para contabilistas.'
      ]
    }
  ];

  return (
    <div className="max-w-4xl mx-auto space-y-8 pb-20 print:p-0">
      {/* Header */}
      <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 p-10 rounded-[2.5rem] shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-64 h-64 bg-brand-primary/5 blur-3xl -mr-32 -mt-32 rounded-full" />
        
        <div className="relative z-10">
          <div className="flex items-center gap-4 mb-6">
            <div className="w-16 h-16 bg-brand-primary rounded-2xl flex items-center justify-center text-white shadow-lg shadow-brand-primary/20">
              <BookOpen size={32} />
            </div>
            <div>
              <h1 className="text-3xl font-black text-slate-900 dark:text-white uppercase tracking-tighter italic leading-none">
                SUPER TAXI
              </h1>
              <p className="text-brand-primary font-bold text-[11px] uppercase tracking-[0.3em] mt-2">
                MANUAL DE UTILIZADOR • V1.0 - 2026
              </p>
            </div>
          </div>
          
          <p className="text-slate-600 dark:text-slate-400 text-sm leading-relaxed max-w-2xl font-medium">
            Bem-vindo ao centro de operações da PSM COMERCIAL LUENA MOXICO. Este guia foi desenhado para ajudar José e sua equipa a maximizar a eficiência da frota e segurança dos motoristas.
          </p>

          <div className="flex flex-col sm:flex-row gap-4 mt-8 print:hidden">
            <button 
              onClick={() => window.print()}
              className="flex items-center justify-center gap-2 bg-slate-900 dark:bg-white text-white dark:text-black px-6 py-3 rounded-xl text-[11px] font-black uppercase tracking-widest hover:scale-105 transition-transform"
            >
              <Printer size={16} />
              Exportar para PDF
            </button>
            <div className="flex items-center gap-2 px-4 py-3 bg-amber-50 dark:bg-amber-500/10 border border-amber-100 dark:border-amber-500/20 rounded-xl">
              <Info size={14} className="text-amber-600" />
              <p className="text-[10px] text-amber-800 dark:text-amber-400 font-bold uppercase tracking-wider">
                Nota: Se não funcionar, abra a app numa nova aba.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Quick Tips */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-emerald-50 dark:bg-emerald-500/10 p-6 rounded-3xl border border-emerald-100 dark:border-emerald-500/20">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-emerald-600 mb-4 shadow-sm">
            <CheckCircle2 size={24} />
          </div>
          <h4 className="font-black text-emerald-900 dark:text-emerald-400 text-[11px] uppercase tracking-widest mb-2">Dica de Eficiência</h4>
          <p className="text-xs text-emerald-800 dark:text-emerald-300/80 leading-relaxed font-medium">
            Sempre que um motorista tiver a mesma escala do dia anterior, use o botão **"Duplicar"** no calendário para poupar tempo.
          </p>
        </div>
        
        <div className="bg-brand-primary/5 p-6 rounded-3xl border border-brand-primary/10">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-brand-primary mb-4 shadow-sm">
            <ShieldAlert size={24} />
          </div>
          <h4 className="font-black text-brand-primary text-[11px] uppercase tracking-widest mb-2">Protocolo SOS</h4>
          <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed font-medium">
            Em caso de alerta de pânico, a viatura fica destacada em vermelho no monitor de campo. Contacte a rádio GSM imediatamente.
          </p>
        </div>

        <div className="bg-indigo-50 dark:bg-indigo-500/10 p-6 rounded-3xl border border-indigo-100 dark:border-indigo-500/20">
          <div className="w-10 h-10 bg-white rounded-xl flex items-center justify-center text-indigo-600 mb-4 shadow-sm">
            <Info size={24} />
          </div>
          <h4 className="font-black text-indigo-900 dark:text-indigo-400 text-[11px] uppercase tracking-widest mb-2">Organização</h4>
          <p className="text-xs text-indigo-800 dark:text-indigo-300/80 leading-relaxed font-medium">
            Os prefixos seguem a ordem numérica. Se registrar "TX-2", o sistema guardará como "TX-02" para manter a lista ordenada.
          </p>
        </div>
      </div>

      {/* Main Sections */}
      <div className="space-y-4">
        {sections.map((section, idx) => (
          <motion.div 
            initial={{ opacity: 0, x: -20 }}
            whileInView={{ opacity: 1, x: 0 }}
            transition={{ delay: idx * 0.1 }}
            key={idx}
            className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-white/5 p-8 rounded-[2rem] shadow-sm print-break-inside-avoid"
          >
            <div className="flex items-center gap-4 mb-4">
              <div className="p-3 bg-slate-50 dark:bg-white/5 rounded-xl text-brand-primary">
                {section.icon}
              </div>
              <h3 className="font-black text-slate-900 dark:text-white uppercase tracking-tighter text-lg italic">
                {section.title}
              </h3>
            </div>
            
            <p className="text-slate-600 dark:text-slate-400 text-[13px] font-medium leading-relaxed mb-6">
              {section.content}
            </p>

            <ul className="space-y-3">
              {section.details.map((detail, dIdx) => (
                <li key={dIdx} className="flex items-start gap-3 text-xs text-slate-500 dark:text-slate-400 font-bold uppercase tracking-wider">
                  <ChevronRight size={14} className="text-brand-primary mt-0.5" />
                  {detail}
                </li>
              ))}
            </ul>
          </motion.div>
        ))}
      </div>

      {/* Footer Support */}
      <div className="text-center py-10">
        <p className="text-[10px] font-black text-slate-400 uppercase tracking-[0.4em]">
          Equipa de Desenvolvimento • TaxiControl 2026
        </p>
      </div>
    </div>
  );
}
