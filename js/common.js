// common.js — MathCenter SPA umumiy modul (CDN imports, Google redirect auth, Firestore)

// ==== Firebase SDK (CDN) ====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
  signOut,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  getFirestore,
  doc, getDoc, setDoc, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";
// Analytics (ixtiyoriy; brauzer qo‘llasa ishga tushadi)
import {
  getAnalytics, isSupported as analyticsSupported
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-analytics.js";

// ==== Firebase Config ====
export const firebaseConfig = {
  apiKey: "AIzaSyDpokm9FepnLQhpZADRxZnHtOfggdOnbVk",
  authDomain: "mathcenter-1c98d.firebaseapp.com",
  projectId: "mathcenter-1c98d",
  storageBucket: "mathcenter-1c98d.appspot.com", // <-- to‘g‘ri domen (appspot.com)
  messagingSenderId: "1016417719928",
  appId: "1:1016417719928:web:700b028da1312477c87f8d",
  measurementId: "G-JEECME5HMJ"
};

// ==== Initialize ====
export const app  = initializeApp(firebaseConfig);
export const db   = getFirestore(app);
export const auth = getAuth(app);

// Analytics (agar qurilma qo‘llasa)
try { analyticsSupported().then(ok => { if (ok) getAnalytics(app); }); } catch {}

// ==== Admin numeric ID lar ====
export const ADMIN_NUMERIC_IDS = [1000001, 1000002];

// ==== Ichki util ====
const qs  = (s, el=document) => el.querySelector(s);
const qsa = (s, el=document) => [...el.querySelectorAll(s)];

// Foydalanuvchi hujjatini yaratish/yuklash
async function getOrCreateUserProfile(user) {
  const ref = doc(db, "users", user.uid);
  const snap = await getDoc(ref);
  if (!snap.exists()) {
    const profile = {
      uid: user.uid,
      email: user.email || null,
      firstName: user.displayName?.split(" ")?.[0] || "",
      lastName:  user.displayName?.split(" ")?.slice(1).join(" ") || "",
      phone: user.phoneNumber || "",
      numericId: null,
      balance: 0,
      gems: 0,
      createdAtFS: serverTimestamp(),
      updatedAtFS: serverTimestamp(),
    };
    await setDoc(ref, profile, { merge: true });
    return (await getDoc(ref)).data();
  }
  return snap.data();
}

// Global holat + event
function publishUserReady(user, profile) {
  window.__mcUser = { user, profile };
  document.dispatchEvent(new CustomEvent("mc:user-ready", { detail: { user, profile }}));
}

// ==== Auth UI ====
/**
 * attachAuthUI({ requireSignIn?: boolean })
 * - Google bilan redirect orqali kirish tugmalarini bog‘laydi
 * - auth state ni kuzatadi, kerak bo‘lsa profilni yaratadi
 * - kirilgandan so‘ng `mc:user-ready` eventini chiqaradi
 *
 * Tugma selectorlari:
 *   - #googleLoginBtn
 *   - .google-signin
 *   - [data-action="signin-google"]
 */
export function attachAuthUI(opts = {}) {
  const provider = new GoogleAuthProvider();

  // 1) Tugmalarni bog‘lash (redirect varianti — popup muammosiz)
  const bindLoginButtons = () => {
    const btns = [
      ...qsa('#googleLoginBtn'),
      ...qsa('.google-signin'),
      ...qsa('[data-action="signin-google"]'),
    ];
    btns.forEach(btn => {
      if (btn._bound) return;
      btn._bound = true;
      btn.addEventListener('click', (e) => {
        e.preventDefault();
        signInWithRedirect(auth, provider);
      });
    });
  };
  bindLoginButtons();

  // 2) Redirect natijasini olish (agar mavjud bo‘lsa)
  getRedirectResult(auth).catch(err => {
    // Ba’zi hollarda cancel bo‘lishi normal (auth/cancelled-popup-request va h.k.)
    console.warn('[auth] redirect result error:', err?.code || err);
  });

  // 3) Auth holatini kuzatish
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      // Profilni yaratish/yuklash
      try {
        const profile = await getOrCreateUserProfile(user);
        publishUserReady(user, profile);
      } catch (e) {
        console.error('[auth] profile error:', e);
        alert('Profilni yuklashda xato: ' + (e.message || e));
      }
    } else {
      // Agar requireSignIn bo‘lsa — login modal/tugmasini ko‘rsatish lozim
      if (opts.requireSignIn) {
        // Sizning interfeysga mos ravishda “Kirish” oynasini ko‘rsatish mumkin.
        // Bu yerda faqat tugmalarni qayta bog‘laymiz:
        bindLoginButtons();
      }
    }
  });
}

// ==== UX umumiy ====
/**
 * initUX()
 * - Chiqish tugmasi: [data-action="signout"]
 * - Kirish tugmasi fallback: [data-action="signin-google"] (agar attachAuthUI chaqirilmagan bo‘lsa)
 */
export function initUX() {
  // Chiqish
  qsa('[data-action="signout"]').forEach(btn => {
    if (btn._bound) return;
    btn._bound = true;
    btn.addEventListener('click', async () => {
      try { await signOut(auth); location.reload(); }
      catch (e) { alert('Chiqishda xato: ' + (e.message || e)); }
    });
  });

  // Agar sahifada kirish tugmasi bo‘lsa — kamida handler bo‘lsin
  qsa('[data-action="signin-google"]').forEach(btn => {
    if (btn._bound) return;
    btn._bound = true;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const p = new GoogleAuthProvider();
      signInWithRedirect(auth, p);
    });
  });
}

// === (ixtiyoriy) foydali eksports ===
export const isAdminSync = () => {
  const prof = window.__mcUser?.profile;
  const num = Number(prof?.numericId);
  return Number.isFinite(num) && ADMIN_NUMERIC_IDS.includes(num);
};

// === Konsolga kichik banner (debug) ===
try {
  console.log('%cMathCenter common.js loaded', 'color:#0ea5e9;font-weight:bold');
} catch {}
