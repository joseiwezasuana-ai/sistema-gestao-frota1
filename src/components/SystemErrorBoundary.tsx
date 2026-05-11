import React, { Component, ErrorInfo, ReactNode } from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';

interface Props {
  children?: ReactNode;
}

interface State {
  hasError: boolean;
  error?: Error;
}

export default class SystemErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = {
      hasError: false
    };
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error caught by SystemErrorBoundary:", error, errorInfo);
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: undefined });
    window.location.reload();
  };

  private handleClearAndReset = () => {
    localStorage.clear();
    sessionStorage.clear();
    this.setState({ hasError: false, error: undefined });
    window.location.reload();
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex min-h-screen w-full flex-col items-center justify-center bg-slate-50 dark:bg-slate-950 p-8 text-center font-sans">
          <div className="w-20 h-20 bg-red-100 dark:bg-red-900/30 text-red-600 dark:text-red-400 rounded-3xl flex items-center justify-center mb-8 shadow-xl shadow-red-500/10">
             <AlertCircle size={40} />
          </div>
          
          <h2 className="text-2xl font-black text-slate-900 dark:text-white mb-3 uppercase tracking-tighter italic">
            Erro de Sistema
          </h2>
          
          <p className="text-slate-500 dark:text-slate-400 text-sm max-w-md mb-10 leading-relaxed font-medium">
            O TaxiControl encontrou um problema crítico. 
            Isso pode ser causado por dados inválidos ou uma falha de carregamento.
          </p>
          
          <div className="bg-white dark:bg-slate-900 p-6 rounded-2xl border border-slate-200 dark:border-white/5 w-full max-w-lg mb-10 overflow-auto max-h-48 shadow-sm">
             <p className="text-[11px] font-mono text-slate-600 dark:text-slate-400 break-all text-left">
                {this.state.error?.name}: {this.state.error?.message}
                {this.state.error?.stack && (
                  <span className="block mt-4 opacity-50 whitespace-pre-wrap">
                    {this.state.error.stack.split('\n').slice(0, 3).join('\n')}
                  </span>
                )}
             </p>
          </div>
          
          <div className="flex flex-col sm:flex-row items-center gap-4">
            <button 
              onClick={this.handleReset}
              className="flex items-center gap-2 px-8 py-4 bg-brand-primary text-white font-black text-[11px] uppercase tracking-widest rounded-xl hover:bg-brand-secondary transition-all shadow-lg active:scale-95"
            >
              <RefreshCw size={16} />
              Recarregar Sistema
            </button>
            
            <button 
              onClick={this.handleClearAndReset}
              className="px-8 py-4 bg-slate-200 dark:bg-slate-800 text-slate-600 dark:text-slate-400 font-black text-[11px] uppercase tracking-widest rounded-xl hover:bg-slate-300 dark:hover:bg-slate-700 transition-all active:scale-95 border border-slate-300 dark:border-white/5"
            >
              Limpar Cache e Reiniciar
            </button>
          </div>
          
          <p className="mt-12 text-[10px] text-slate-400 font-bold uppercase tracking-[0.3em]">
            PSM COMERCIAL LUENA MOXICO • TaxiControl
          </p>
        </div>
      );
    }

    return this.props.children;
  }
}
