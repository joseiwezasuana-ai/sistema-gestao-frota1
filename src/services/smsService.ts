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
    console.log(`[SMS Service] Logging dispatch to ${phoneNumbers.length} numbers (Twilio removed)...`);
    
    const logPath = 'sms_logs';
    try {
      // 1. Log the execution in Firestore only (No more real SMS sending via Twilio)
      await addDoc(collection(db, logPath), {
        targets: phoneNumbers,
        content: message,
        timestamp: serverTimestamp(),
        status: 'logged_only',
        provider: 'System Log (Twilio Disabled)',
        isMock: false
      });

      return { 
        success: true, 
        count: phoneNumbers.length, 
        simulated: true
      };
    } catch (error: any) {
      console.error('Error in SMS logging chain', error);
      return { success: false, error: error.message };
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
