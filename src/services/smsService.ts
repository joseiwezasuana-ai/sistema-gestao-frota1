import { collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { db } from '../lib/firebase';

/**
 * Service to handle SMS dispatching to drivers.
 * In a production environment, this would integrate with Twilio, 
 * Nexmo, or a local SMS Gateway.
 */
export const smsService = {
  /**
   * Sends an SMS message to one or more phone numbers.
   * 
   * @param phoneNumbers Array of phone numbers to send to
   * @param message The message content
   * @returns Promise resolving to the broadcast result
   */
  async sendSMS(phoneNumbers: string[], message: string) {
    console.log(`[SMS Service] Dispatching to ${phoneNumbers.length} numbers via Backend...`);
    
    const logPath = 'sms_logs';
    try {
      // 1. Call our backend route
      const response = await fetch('/api/sms/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumbers, message })
      });

      const result = await response.json();

      // 2. Log the execution in Firestore
      await addDoc(collection(db, logPath), {
        targets: phoneNumbers,
        content: message,
        timestamp: serverTimestamp(),
        status: result.success ? 'sent' : 'failed',
        provider: result.success ? 'Twilio (Production)' : 'Twilio (Error)',
        error: result.error || null,
        isMock: false
      });

      return { 
        success: result.success, 
        count: phoneNumbers.length, 
        simulated: false,
        error: result.error
      };
    } catch (error: any) {
      console.error('Error in SMS dispatch chain', error);
      return { success: false, error: error.message, simulated: false };
    }
  },

  /**
   * Identifies the mobile operator based on Angolan prefix.
   */
  getOperator(phoneNumber: string): 'Unitel' | 'Movicel' | 'Africell' | 'Other' {
    const cleanNum = (phoneNumber || '').replace(/\D/g, '');
    // Angola prefixes: 92x, 93x, 94x, 99x (Unitel); 91x (Movicel); 95x (Africell)
    if (/^(244)?(92|93|94|99)/.test(cleanNum)) return 'Unitel';
    if (/^(244)?91/.test(cleanNum)) return 'Movicel';
    if (/^(244)?95/.test(cleanNum)) return 'Africell';
    return 'Other';
  }
};
