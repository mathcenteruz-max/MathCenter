// common.js — MathCenter SPA umumiy modul
// CDN Firebase modullari + Google OAuth (redirect), profil bootstrap, mc:user-ready

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
// Analytics (ixtiyoriy)
import {
  getAnalytics, isSupported as analyticsSupported
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-analytics.js";

// ==== Firebase Config (YANGI PROEKTINGIZ) ====
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

// Analytics (agar muhit qo‘llasa)
try { analyticsSupported().then(ok => { if (ok) getAnalytics(app); }); } catch {}

// ==== Admin numeric ID lar ====
export const ADMIN_NUMERIC_IDS = [1000001, 1000002];

// ==== Mini DOM util ====
const qs  = (s, el=document) => el.querySelector(s);
const qsa = (s, el=document) => [...el.querySelectorAll(s)];

// ==== Auth modal helperlari ====
function showAuthModal() {
  const m = document.getElementById('authModal');
  if (m) m.classList.remove('hidden');
}
function hideAuthModal() {
  const m = document.getElementById('authModal');
  if (m) m.classList.add('hidden');
}

// ==== Foydalanuvchi profilini yaratish/yuklash ====
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

// ==== Global event: mc:user-ready ====
function publishUserReady(user, profile) {
  window.__mcUser = { user, profile };
  document.dispatchEvent(new CustomEvent("mc:user-ready", { detail: { user, profile }}));
}

// ==== Auth UI ====
/**
 * attachAuthUI({ requireSignIn?: boolean })
 * - Google bilan redirect orqali kirish tugmalarini bog‘laydi
 * - Auth state ni kuzatadi; kirilgach profilni yaratib, mc:user-ready jo‘natadi
 * - requireSignIn=true bo‘lsa, user chiqib turganda #authModal avtomatik ochiladi
 *
 * Tugma selectorlari:
 *   - #googleLoginBtn
 *   - .google-signin
 *   - [data-action="signin-google"]
 */
export function attachAuthUI(opts = {}) {
  const provider = new GoogleAuthProvider();

  // 1) Login tugmalarini redirect bilan bog‘lash
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

  // 2) Redirect natijasi (agar qaytgan bo‘lsa)
  getRedirectResult(auth).catch(err => {
    // Ba’zida bekor qilish normal: auth/cancelled-popup-request va h.k.
    if (err?.code) console.warn('[auth] redirect result:', err.code);
  });

  // 3) Auth holati
  onAuthStateChanged(auth, async (user) => {
    if (user) {
      try {
        const profile = await getOrCreateUserProfile(user);
        publishUserReady(user, profile);
        hideAuthModal(); // kirdi — modalni yopamiz
      } catch (e) {
        console.error('[auth] profile error:', e);
        alert('Profilni yuklashda xato: ' + (e.message || e));
      }
    } else {
      if (opts.requireSignIn) {
        showAuthModal(); // foydalanuvchi chiqib turgan — kirish oynasini ko‘rsatamiz
      }
      // tugmalar doim faol bo‘lsin
      bindLoginButtons();
    }
  });
}

// ==== UX umumiy ====
/**
 * initUX()
 * - Chiqish tugmasi: [data-action="signout"]
 * - (Ixtiyoriy) Kirish tugmasi fallback: [data-action="signin-google"]
 * - [data-open="modalId"] bo‘lsa, modalni ochish (agar siz modal tizimini shu tarzda ishlatsangiz)
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

  // Kirish fallback
  qsa('[data-action="signin-google"]').forEach(btn => {
    if (btn._bound) return;
    btn._bound = true;
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const p = new GoogleAuthProvider();
      signInWithRedirect(auth, p);
    });
  });

  // Oddiy modal ochish (agar HTML’da [data-open] ishlatsangiz)
  document.addEventListener('click', (e) => {
    const openId = e.target?.getAttribute?.('data-open');
    if (openId) {
      const m = document.getElementById(openId);
      if (m) m.classList.remove('hidden');
    }
    if (e.target?.hasAttribute?.('data-close')) {
      e.target.closest('.modal')?.classList?.add('hidden');
    }
    if (e.target?.classList?.contains('modal')) {
      e.target.classList.add('hidden');
    }
  });
}

// === (ixtiyoriy) kichik helper: adminligini sinxron tekshirish
export const isAdminSync = () => {
  const prof = window.__mcUser?.profile;
  const num = Number(prof?.numericId);
  return Number.isFinite(num) && ADMIN_NUMERIC_IDS.includes(num);
};

// === Konsol banner (debug)
try { console.log('%cMathCenter common.js loaded', 'color:#0ea5e9;font-weight:bold'); } catch {}
