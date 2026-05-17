import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { User as FirebaseUser, onAuthStateChanged } from 'firebase/auth';
import { doc, getDoc } from 'firebase/firestore';
import { auth, db } from '../config/firebase';
import { User } from '../models/types';
import { toDate } from '../utils/firestoreConverters';

interface AuthContextType {
  user: FirebaseUser | null;
  userProfile: User | null;
  isOnboarded: boolean;
  loading: boolean;
  refreshUserProfile: () => Promise<void>;
}

export const AuthContext = createContext<AuthContextType>({
  user: null,
  userProfile: null,
  isOnboarded: false,
  loading: true,
  refreshUserProfile: async () => {},
});

export const useAuthContext = (): AuthContextType => {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuthContext must be used within AuthProvider');
  }
  return context;
};

interface AuthProviderProps {
  children: ReactNode;
}

export const AuthProvider: React.FC<AuthProviderProps> = ({ children }) => {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [userProfile, setUserProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchUserProfile = async (uid: string): Promise<User | null> => {
    try {
      const docRef = doc(db, 'users', uid);
      const docSnap = await getDoc(docRef);
      if (docSnap.exists()) {
        const data = docSnap.data();
        return {
          id: docSnap.id,
          email: data.email,
          displayName: data.displayName,
          photoURL: data.photoURL,
          bio: data.bio,
          location: data.location,
          locationName: data.locationName,
          pushToken: data.pushToken,
          isOnboarded: data.isOnboarded ?? false,
          createdAt: toDate(data.createdAt),
          updatedAt: toDate(data.updatedAt),
          rating: data.rating,
          reviewCount: data.reviewCount,
        };
      }
      return null;
    } catch {
      return null;
    }
  };

  const refreshUserProfile = async () => {
    if (user) {
      const profile = await fetchUserProfile(user.uid);
      setUserProfile(profile);
    }
  };

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const profile = await fetchUserProfile(firebaseUser.uid);
        setUserProfile(profile);
      } else {
        setUserProfile(null);
      }
      setLoading(false);
    });

    return unsubscribe;
  }, []);

  const isOnboarded = userProfile?.isOnboarded ?? false;

  return (
    <AuthContext.Provider value={{ user, userProfile, isOnboarded, loading, refreshUserProfile }}>
      {children}
    </AuthContext.Provider>
  );
};
