import { format, isValid } from 'date-fns';
import { pt } from 'date-fns/locale';

/**
 * Safely converts various date-like values (ISO strings, timestamps, Firestore objects) to a Date object.
 */
export function toSafeDate(value: any): Date | null {
  if (!value) return null;

  try {
    // Handle Firestore Timestamp objects
    if (value && typeof value.toDate === 'function') {
      return value.toDate();
    }

    // Handle Firestore-like objects {seconds, nanoseconds}
    if (value && typeof value === 'object' && typeof value.seconds === 'number') {
      return new Date(value.seconds * 1000);
    }

    // If it's already a date
    if (value instanceof Date) {
      return isValid(value) ? value : null;
    }

    // Handle strings or numbers
    const date = new Date(value);
    return isValid(date) ? date : null;
  } catch (e) {
    console.warn('toSafeDate error:', e);
    return null;
  }
}

/**
 * Safely formats a date-like value with a fallback string.
 */
export function formatSafe(value: any, formatStr: string = 'dd/MM/yyyy HH:mm', fallback: string = '---'): string {
  const date = toSafeDate(value);
  if (!date) return fallback;
  
  try {
    return format(date, formatStr, { locale: pt });
  } catch (error) {
    console.error('Safe Date Formatting Error:', error);
    return fallback;
  }
}

/**
 * Returns a relative display or formatted date
 */
export function displayDate(value: any, includeTime: boolean = true): string {
  const date = toSafeDate(value);
  if (!date) return 'Desconhecido';
  
  return format(date, includeTime ? 'dd/MM/yyyy HH:mm' : 'dd/MM/yyyy', { locale: pt });
}
