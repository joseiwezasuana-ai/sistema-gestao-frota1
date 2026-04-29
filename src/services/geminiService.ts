import { GoogleGenerativeAI } from "@google/generative-ai";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || "");

export const geminiService = {
  async getFleetInsights(data: any) {
    if (!process.env.GEMINI_API_KEY) {
      return "O sistema está em modo offline para IA. Verifique as configurações de API.";
    }

    try {
      const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

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

      const result = await model.generateContent(prompt);
      const response = await result.response;
      return response.text();
    } catch (error) {
      console.error("Gemini Error:", error);
      return "Erro ao processar análise inteligente. Tente novamente em instantes.";
    }
  }
};
