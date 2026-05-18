import { initializeApp, getApps, FirebaseApp } from 'firebase/app';
import { getAuth, Auth } from 'firebase/auth';
import { getFirestore, Firestore } from 'firebase/firestore';
import { getStorage, FirebaseStorage } from 'firebase/storage';

const firebaseConfig = {
  apiKey: 'AIzaSyBOF66WalEIXlKnowKip26mxkIAR4EfTpA',
  authDomain: 'swapdog-d0cfe.firebaseapp.com',
  projectId: 'swapdog-d0cfe',
  storageBucket: 'swapdog-d0cfe.firebasestorage.app',
  messagingSenderId: '523657483823',
  appId: '1:523657483823:web:ec8148ce28ee1e794b58da',
  measurementId: 'G-BQTEZZ5FP4',
};

const app: FirebaseApp = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];
const auth: Auth = getAuth(app);
const db: Firestore = getFirestore(app);
const storage: FirebaseStorage = getStorage(app);

export { app, auth, db, storage };
