import { GoogleGenAI } from "@google/genai";

let genAI: GoogleGenAI | null = null;

function getAI() {
  if (!genAI) {
    const key = process.env.GEMINI_API_KEY;
    if (!key || key === "undefined" || key.includes("...")) {
      console.warn("Gemini API Key is not set or invalid. AI features will be disabled.");
      return null;
    }
    genAI = new GoogleGenAI({ apiKey: key });
  }
  return genAI;
}

export const geminiService = {
  async getFleetInsights(data: any) {
    try {
      const ai = getAI();
      if (!ai) return "Sistema em modo offline para IA. Chave API não configurada.";

      const prompt = `
        Analise os seguintes dados de uma frota de táxis em Luena, Moxico (Angola) e forneça um resumo operacional "Technical Dashboard" em Português.
        Seja breve, profissional e direto. Dê sugestões de melhoria se houver problemas.
        
        DADOS:
        - Veículos Ativos: ${data.activeVehicles} de ${data.totalVehicles}
        - Chamadas Hoje: ${data.callsCount}
        - Alertas de Excesso de Velocidade: ${data.speedViolations}
        - Chamadas Perdidas: ${data.missedCalls}
        - Desempenho Unitel: ${data.unitelPerformance}
        - Rendas Pendentes: ${data.pendingRevenues}

        Responda em 2-3 frases impactantes no estilo "relatório de situação".
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt
      });

      return response.text || "Sem insights disponíveis no momento.";
    } catch (error: any) {
      console.error("Gemini Error:", error);
      if (error.message?.includes("API key")) {
        return "O sistema está em modo offline para IA. Verifique as configurações de API no painel do AI Studio.";
      }
      return "Erro ao processar análise inteligente.";
    }
  },

  async getDriverPerformanceAudit(driver: any, stats: any) {
    try {
      const ai = getAI();
      if (!ai) return "IA indisponível no momento.";

      const prompt = `
        Realize uma Auditoria de Performance Técnica para o motorista de táxi "${driver.name}" (Viatura ${driver.prefix}) em Luena, Moxico.
        
        ESTATÍSTICAS RECENTES:
        - Total de Chamadas: ${stats.totalCalls}
        - Volume de SMS: ${stats.totalSms}
        - Score de Velocidade (0-100): ${stats.speedScore}
        - Estado da Viatura: ${driver.status}
        - Sincronização GPS: ${driver.gps}
        
        Forneça um feedback profissional em Português (PT) com:
        1. Resumo da eficiência de comunicação.
        2. Alertas de segurança (ex: velocidade).
        3. Uma recomendação técnica para o próximo turno.
        
        Seja rigoroso, mas motivacional. Limite a 100 palavras.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt
      });

      return response.text || "Auditoria indisponível.";
    } catch (error: any) {
      console.error("Gemini Audit Error:", error);
      return "Erro ao gerar auditoria técnica.";
    }
  },

  async getDriverCoachingInsights(driverData: any, context: any) {
    try {
      const ai = getAI();
      if (!ai) return "Foco na segurança e bom serviço!";

      const prompt = `
        Aja como um Consultor Técnico Sénior da frota "TaxiControl" em Luena, Moxico.
        Forneça um "Personal Coaching" rápido para o motorista "${driverData.name}".
        
        CONTEXTO ATUAL:
        - Meta de Receita: ${context.targetRevenue} Kz
        - Receita Atual: ${context.currentRevenue} Kz
        - Horas em Turno: ${context.shiftHours}h
        - Status da Viatura: ${driverData.status}
        
        Forneça:
        1. Um comentário motivacional técnico (breve).
        2. Uma recomendação estratégica para aumentar o faturamento no tempo que resta do turno.
        
        Use Português (PT), seja direto e use terminologia da PSM COMERCIAL. Limite a 60 palavras.
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt
      });

      return response.text || "Continue o bom trabalho!";
    } catch (error: any) {
      console.error("Gemini Coaching Error:", error);
      return "Foco na segurança e bom serviço!";
    }
  },

  async getSafetyChecklist(vehicleData: any) {
    try {
      const ai = getAI();
      if (!ai) return "1. Verificar óleos\n2. Pressão dos pneus\n3. Luzes\n4. Travões";

      const prompt = `
        Gere um Checklist de Segurança Técnica breve (4 pontos) para um motorista de táxi em Luena, Angola.
        Viatura: ${vehicleData.prefix || "Toyota Hiace"}.
        Considere o clima e as condições das estradas do Moxico (poeira, buracos, chuva).
        Seja técnico e direto. Use Português (PT).
      `;

      const response = await ai.models.generateContent({
        model: "gemini-3-flash-preview",
        contents: prompt
      });

      return response.text || "1. Verificar óleos\n2. Pressão dos pneus\n3. Luzes\n4. Travões";
    } catch (error) {
      return "1. Verificar óleos\n2. Pressão dos pneus\n3. Luzes\n4. Travões";
    }
  }
};
