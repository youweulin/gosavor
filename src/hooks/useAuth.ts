import { useState, useEffect } from 'react';
import { onAuthStateChanged, signInWithEmailAndPassword, createUserWithEmailAndPassword, signOut } from 'firebase/auth';
import type { User } from 'firebase/auth';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { auth, db } from '../services/firebase';
import type { UserData, UserPlan } from '../types';

export const useAuth = () => {
  const [user, setUser] = useState<User | null>(null);
  const [userData, setUserData] = useState<UserData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!auth) {
      setLoading(false);
      return;
    }
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser && db) {
        const docRef = doc(db, 'users', firebaseUser.uid);
        const docSnap = await getDoc(docRef);
        if (docSnap.exists()) {
          setUserData(docSnap.data() as UserData);
        }
      } else {
        setUserData(null);
      }
      setLoading(false);
    });
    return unsub;
  }, []);

  const login = async (email: string, password: string) => {
    if (!auth) throw new Error('Firebase not configured');
    const cred = await signInWithEmailAndPassword(auth, email, password);
    return cred.user;
  };

  const register = async (email: string, password: string, plan: UserPlan = 'free') => {
    if (!auth || !db) throw new Error('Firebase not configured');
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    const data: UserData = {
      uid: cred.user.uid,
      email,
      plan,
      createdAt: Date.now(),
    };
    await setDoc(doc(db, 'users', cred.user.uid), data);
    setUserData(data);
    return cred.user;
  };

  const logout = () => {
    if (!auth) return;
    return signOut(auth);
  };

  const isRentalActive = userData?.plan === 'rental' &&
    userData.rentalExpiry !== undefined &&
    userData.rentalExpiry > Date.now();
  const isLifetime = userData?.plan === 'lifetime';

  return { user, userData, loading, login, register, logout, isRentalActive, isLifetime };
};
