export const geminiService = {
  async getFleetInsights(data: any) {
    try {
      const response = await fetch('/api/gemini/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data })
      });
      
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Erro na comunicação IA');
      return result.text || "Sem insights disponíveis no momento.";
    } catch (error: any) {
      console.error("Gemini Proxy Error:", error);
      return "O sistema está em modo offline para IA. Verifique as configurações de API no servidor.";
    }
  },

  async getDriverPerformanceAudit(driver: any, stats: any) {
    try {
      const response = await fetch('/api/gemini/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driver, stats })
      });
      
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      return result.text || "Auditoria indisponível.";
    } catch (error: any) {
      console.error("Gemini Audit Proxy Error:", error);
      return "IA indisponível no momento.";
    }
  },

  async getDriverCoachingInsights(driverData: any, context: any) {
    try {
      const response = await fetch('/api/gemini/coaching', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverData, context })
      });
      
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      return result.text || "Continue o bom trabalho!";
    } catch (error: any) {
      console.error("Gemini Coaching Proxy Error:", error);
      return "Foco na segurança e bom serviço!";
    }
  },

  async getSafetyChecklist(vehicleData: any) {
    try {
      const response = await fetch('/api/gemini/checklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicleData })
      });
      
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      return result.text || "1. Verificar óleos\n2. Pressão dos pneus\n3. Luzes\n4. Travões";
    } catch (error) {
      return "1. Verificar óleos\n2. Pressão dos pneus\n3. Luzes\n4. Travões";
    }
  }
};
