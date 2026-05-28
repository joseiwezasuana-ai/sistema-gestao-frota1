const cache: Record<string, { data: any, timestamp: number }> = {};
const CACHE_DURATION = 1000 * 60 * 60 * 24; // 24 hours

export const geminiService = {
  async getFleetInsights(data: any) {
    const cacheKey = JSON.stringify(data);
    if (cache[cacheKey] && (Date.now() - cache[cacheKey].timestamp < CACHE_DURATION)) {
      console.log("[Gemini Proxy] Returning cached insights");
      return cache[cacheKey].data;
    }
    try {
      console.log(`[Gemini Proxy] Fetching insights from: /api/gemini/insights`);
      const response = await fetch('/api/gemini/insights', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ data })
      });
      
      const result = await response.json();
      if (!response.ok) throw new Error(result.error || 'Erro na comunicação IA');
      const insights = result.text || "Sem insights disponíveis no momento.";
      cache[cacheKey] = { data: insights, timestamp: Date.now() };
      return insights;
    } catch (error: any) {
      console.error("Gemini Proxy Error:", error);
      return `O sistema está em modo offline para IA. Erro: ${error.message}`;
    }
  },

  async getDriverPerformanceAudit(driver: any, stats: any) {
    const cacheKey = JSON.stringify({ audit: driver, stats });
    if (cache[cacheKey] && (Date.now() - cache[cacheKey].timestamp < CACHE_DURATION)) {
      console.log("[Gemini Proxy] Returning cached audit");
      return cache[cacheKey].data;
    }
    try {
      const response = await fetch('/api/gemini/audit', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driver, stats })
      });
      
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      const audit = result.text || "Auditoria indisponível.";
      cache[cacheKey] = { data: audit, timestamp: Date.now() };
      return audit;
    } catch (error: any) {
      console.error("Gemini Audit Proxy Error:", error);
      return `IA indisponível no momento. Erro: ${error.message}`;
    }
  },

  async getDriverCoachingInsights(driverData: any, context: any) {
    const cacheKey = JSON.stringify({ coaching: driverData, context });
    if (cache[cacheKey] && (Date.now() - cache[cacheKey].timestamp < CACHE_DURATION)) {
      console.log("[Gemini Proxy] Returning cached coaching");
      return cache[cacheKey].data;
    }
    try {
      const response = await fetch('/api/gemini/coaching', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ driverData, context })
      });
      
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      const coaching = result.text || "Continue o bom trabalho!";
      cache[cacheKey] = { data: coaching, timestamp: Date.now() };
      return coaching;
    } catch (error: any) {
      console.error("Gemini Coaching Proxy Error:", error);
      return `Foco na segurança e bom serviço! Erro: ${error.message}`;
    }
  },

  async getSafetyChecklist(vehicleData: any) {
    const cacheKey = JSON.stringify({ checklist: vehicleData });
    if (cache[cacheKey] && (Date.now() - cache[cacheKey].timestamp < CACHE_DURATION)) {
      console.log("[Gemini Proxy] Returning cached checklist");
      return cache[cacheKey].data;
    }
    try {
      const response = await fetch('/api/gemini/checklist', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ vehicleData })
      });
      
      const result = await response.json();
      if (!response.ok) throw new Error(result.error);
      const checklist = result.text || "1. Verificar óleos\n2. Pressão dos pneus\n3. Luzes\n4. Travões";
      cache[cacheKey] = { data: checklist, timestamp: Date.now() };
      return checklist;
    } catch (error) {
      return "1. Verificar óleos\n2. Pressão dos pneus\n3. Luzes\n4. Travões";
    }
  }
};
