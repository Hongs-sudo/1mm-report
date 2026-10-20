// Firebase 연결 (프로젝트: mathlibrary-1mm)
import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js';
import {
  getAuth, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  onAuthStateChanged, signOut, setPersistence, browserLocalPersistence
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, doc, getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc,
  query, where, onSnapshot, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

export const firebaseConfig = {
  apiKey: 'AIzaSyB6fL3WsiCqG8pJn9QqFfFvWFXFFu0dzO4',
  authDomain: 'mathlibrary-1mm.firebaseapp.com',
  projectId: 'mathlibrary-1mm',
  storageBucket: 'mathlibrary-1mm.firebasestorage.app',
  messagingSenderId: '792370939442',
  appId: '1:792370939442:web:c31a5daf4c586cacd59e2b'
};

// 첫 관리자(원장님). firestore.rules 의 isOwner() 와 같은 주소여야 합니다.
export const OWNER_EMAIL = 'ilmvm66@gmail.com';

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
setPersistence(auth, browserLocalPersistence).catch(() => {});

let _db;
try {
  _db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
} catch {
  _db = initializeFirestore(app, {});
}
export const db = _db;

export async function login() {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: 'select_account' });
  try {
    await signInWithPopup(auth, provider);
  } catch (e) {
    if (e && (e.code === 'auth/popup-blocked' || e.code === 'auth/operation-not-supported-in-this-environment')) {
      await signInWithRedirect(auth, provider);
      return;
    }
    throw e;
  }
}
export function finishRedirect() { return getRedirectResult(auth).catch(() => null); }
export function logout() { return signOut(auth); }
export { onAuthStateChanged };

export const col = name => collection(db, name);
export const ref = (name, id) => doc(db, name, id);
export {
  getDoc, getDocs, setDoc, addDoc, updateDoc, deleteDoc, query, where, onSnapshot, serverTimestamp
};
