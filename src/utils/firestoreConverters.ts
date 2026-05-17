import { Timestamp } from 'firebase/firestore';

export const toDate = (timestamp: Timestamp | Date | null | undefined): Date => {
  if (!timestamp) return new Date();
  if (timestamp instanceof Date) return timestamp;
  if (timestamp instanceof Timestamp) return timestamp.toDate();
  return new Date();
};

export const toTimestamp = (date: Date): Timestamp => {
  return Timestamp.fromDate(date);
};
