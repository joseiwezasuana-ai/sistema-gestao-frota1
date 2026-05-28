import { db } from '../lib/firebase';
import { collection, query, where, getDocs } from 'firebase/firestore';
import { subDays, format } from 'date-fns';

/**
 * Verificação de Pendências de Renda para Motoristas.
 * Bloqueia início de turno se a renda do dia anterior estiver pendente.
 */
export const checkPendingIncome = async (driverId: string): Promise<boolean> => {
  if (!driverId) return false;

  const yesterdayDate = format(subDays(new Date(), 1), 'yyyy-MM-dd');
  
  // Verifica se existe alguma renda pendente do dia anterior
  const q = query(
    collection(db, 'revenue_logs'),
    where('driverId', '==', driverId),
    where('date', '==', yesterdayDate),
    where('status', 'in', ['pending_approval', 'rejected_by_operator', 'rejected_by_accountant'])
  );
  
  const snap = await getDocs(q);
  return !snap.empty;
};
