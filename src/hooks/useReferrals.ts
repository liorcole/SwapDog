import {
  collection,
  doc,
  getDoc,
  query,
  where,
  getDocs,
  updateDoc,
  setDoc,
  increment,
  arrayUnion,
  serverTimestamp,
} from 'firebase/firestore';
import { db } from '../config/firebase';
import { ReferralCode } from '../models/types';
import { toDate } from '../utils/firestoreConverters';

const COLLECTION = 'referral_codes';

/**
 * Looks up a referral code document in Firestore.
 * Returns the ReferralCode if the code is valid (active and under maxUses),
 * otherwise returns null.
 */
export const validateReferralCode = async (
  code: string,
): Promise<ReferralCode | null> => {
  try {
    const trimmed = code.trim().toUpperCase();
    const q = query(
      collection(db, COLLECTION),
      where('code', '==', trimmed),
    );
    const snapshot = await getDocs(q);
    if (snapshot.empty) return null;

    const docSnap = snapshot.docs[0];
    const data = docSnap.data();
    const referralCode: ReferralCode = {
      code: data.code,
      createdBy: data.createdBy,
      isActive: data.isActive,
      usedBy: data.usedBy ?? [],
      maxUses: data.maxUses,
      usedCount: data.usedCount,
      createdAt: toDate(data.createdAt),
    };

    if (!referralCode.isActive) return null;
    if (referralCode.usedCount >= referralCode.maxUses) return null;

    return referralCode;
  } catch {
    return null;
  }
};

/**
 * Marks the referral code as used by the given userId.
 * Increments usedCount and appends userId to usedBy array.
 */
export const redeemReferralCode = async (
  code: string,
  userId: string,
): Promise<void> => {
  const trimmed = code.trim().toUpperCase();
  const q = query(
    collection(db, COLLECTION),
    where('code', '==', trimmed),
  );
  const snapshot = await getDocs(q);
  if (snapshot.empty) {
    throw new Error('Referral code not found');
  }
  const docRef = snapshot.docs[0].ref;
  await updateDoc(docRef, {
    usedCount: increment(1),
    usedBy: arrayUnion(userId),
  });
};

/**
 * Generates a new unique 8-char alphanumeric referral code for a user
 * and writes it to the referral_codes collection.
 * Returns the generated code string.
 */
export const generateReferralCode = async (userId: string): Promise<string> => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 8; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }

  const newDocRef = doc(collection(db, COLLECTION));
  await setDoc(newDocRef, {
    code,
    createdBy: userId,
    isActive: true,
    usedBy: [],
    maxUses: 10,
    usedCount: 0,
    createdAt: serverTimestamp(),
  });

  return code;
};

// ── Referral list helpers ────────────────────────────────────────────────────

/**
 * Returns all users who were referred by the given userId.
 * Queries the `users` collection for documents where `referredBy === userId`.
 */
export const getMyReferrals = async (userId: string): Promise<import('../models/types').User[]> => {
  try {
    const { toDate } = await import('../utils/firestoreConverters');
    const q = query(
      collection(db, 'users'),
      where('referredBy', '==', userId),
    );
    const snapshot = await getDocs(q);
    return snapshot.docs.map((docSnap) => {
      const d = docSnap.data();
      return {
        id: docSnap.id,
        email: d.email ?? '',
        displayName: d.displayName ?? '',
        photoURL: d.photoURL,
        bio: d.bio,
        location: d.location,
        locationName: d.locationName,
        pushToken: d.pushToken,
        isOnboarded: d.isOnboarded ?? false,
        createdAt: toDate(d.createdAt),
        updatedAt: toDate(d.updatedAt),
        rating: d.rating,
        reviewCount: d.reviewCount,
        referredBy: d.referredBy,
        referralCode: d.referralCode ?? '',
        points: d.points ?? 0,
        accountStatus: d.accountStatus ?? 'pending_referral',
        conductAgreedAt: d.conductAgreedAt ? toDate(d.conductAgreedAt) : undefined,
        contractSignedAt: d.contractSignedAt ? toDate(d.contractSignedAt) : undefined,
        vettingScheduledAt: d.vettingScheduledAt ? toDate(d.vettingScheduledAt) : undefined,
      } as import('../models/types').User;
    });
  } catch {
    return [];
  }
};

/**
 * Returns the count of users referred by the given userId.
 */
export const getReferralCount = async (userId: string): Promise<number> => {
  try {
    const q = query(
      collection(db, 'users'),
      where('referredBy', '==', userId),
    );
    const snapshot = await getDocs(q);
    return snapshot.size;
  } catch {
    return 0;
  }
};
