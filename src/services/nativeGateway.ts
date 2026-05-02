import { db } from '../lib/firebase';
import { collection, addDoc, serverTimestamp } from 'firebase/firestore';

/**
 * NativeGateway Service
 * 
 * Este serviço foi desenhado para ser o ponto de entrada de dados 
 * intercetados diretamente pelo sistema operativo Android.
 */
export const NativeGateway = {
  /**
   * Regista uma interação manual ou automática.
   * Quando o TaxiControl for convertido em APK, este método será chamado
   * pelos "Broadcasters" do Android.
   */
  logInteraction: async (data: {
    vehicle: string;
    clientPhone: string;
    type: 'Chamada Recebida' | 'SMS Recebido' | 'Chamada Perdida';
    driverId?: string;
    driverName?: string;
  }) => {
    try {
      // 1. Verificar se a viatura está vinculada na base de dados
      const { doc, getDoc } = await import('firebase/firestore');
      const vehicleRef = doc(db, 'master_vehicles', data.vehicle);
      const vehicleSnap = await getDoc(vehicleRef);

      if (!vehicleSnap.exists()) {
        console.warn(`Tentativa de acesso de terminal não vinculado: ${data.vehicle}`);
        return { success: false, error: 'Terminal não vinculado' };
      }

      // 2. Registar se for válido
      await addDoc(collection(db, 'interaction_logs'), {
        ...data,
        status: 'recorded',
        serverTimestamp: serverTimestamp(),
        deviceTimestamp: new Date().toISOString(),
      });
      return { success: true };
    } catch (error) {
      console.error('Erro ao registar no Gateway:', error);
      return { success: false, error: 'Erro de conexão' };
    }
  },

  /**
   * Mock para teste de integração no smartphone
   */
  simulateIncomingCall: async (vehicle: string) => {
    return NativeGateway.logInteraction({
      vehicle,
      clientPhone: '+244' + Math.floor(Math.random() * 900000000 + 900000000),
      type: 'Chamada Recebida',
      driverName: 'Sistema Automático'
    });
  }
};
