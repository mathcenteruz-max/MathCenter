// common.js — MathCenter (mathcenter-1c98d)
// Firebase CDN + Google Redirect Auth + Auto Modal + Barqaror Sessiya (analytics yo‘q)

// ==== Firebase CDN imports ====
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.4/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
  signOut,
  setPersistence,
  browserLocalPersistence,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-auth.js";
import {
  getFirestore,
  doc, getDoc, setDoc, serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.12.4/firebase-firestore.js";

// ==== Firebase Config (MathCenter) ====
export const firebaseConfig = {
  apiKey: "AIzaSyAfoJhkSOqGvKWsIvGCi-OZ0sK2qLrnaGE",
  authDomain: "mathcenter-1c98d.firebaseapp.com",
  projectId: "mathcenter-1c98d",
  storageBucket: "mathcenter-1c98d.appspot.com", // MUHIM: appspot.com
  messagingSenderId: "1016417719928",
  appId: "1:1016417719928:web:700b028da1312477c87f8d",
  measurementId: "G-JEECME5HMJ",
};

// ==== Init ====
export const app  = initializeApp(firebaseConfig);
export const db   = getFirestore(app);
export const auth = getAuth(app);

// Sessiyaning qat’iy saqlanishi (redirectdan keyin ham user saqlansin)
setPersistence(auth, browserLocalPersistence).catch(e=>{
  console.warn("[auth] setPersistence error:", e);
});
auth.useDeviceLanguage?.();

// Admin numeric ID lar (ixtiyoriy)
export const ADMIN_NUMERIC_IDS = [1000001, 1000002];

// === Mini DOM util
const q  = (s, el=document) => el.querySelector(s);
const qa = (s, el=document) => [...el.querySelectorAll(s)];

// === AUTH MODAL: auto-inject + helpers
function ensureAuthModal() {
  let modal = document.getElementById("authModal");
  if (!modal) {
    modal = document.createElement("div");
    modal.id = "authModal";
    modal.className = "modal hidden";
    modal.innerHTML = `
      <div class="dialog" style="max-width:420px;margin:10svh auto;padding:14px;border:1px solid #ddd;border-radius:14px;background:#fff">
        <div class="head" style="display:flex;justify-content:space-between;align-items:center;gap:8px">
          <h3 style="margin:0">Kirish</h3>
          <button class="icon-btn" data-close style="font-size:22px;background:none;border:none;cursor:pointer">&times;</button>
        </div>
        <div class="body" style="margin-top:8px">
          <p class="sub" style="margin:0 0 8px">Google orqali tez va xavfsiz kiring</p>
          <button id="googleLoginBtn" class="btn primary" style="width:100%;padding:10px;border-radius:10px;border:1px solid #0ea5e9;background:#0ea5e9;color:#fff">
            Google bilan kirish
          </button>
        </div>
      </div>
    `;
    Object.assign(modal.style, { position:"fixed", inset:"0", background:"rgba(0,0,0,.32)", zIndex:"1000", padding:"10px" });
    document.body.appendChild(modal);
  }
  return modal;
}
function showAuthModal() { ensureAuthModal().classList.remove("hidden"); }
function hideAuthModal() { const m = document.getElementById("authModal"); if (m) m.classList.add("hidden"); }

// Login tugmalarini bog'lash (bir marta)
function bindGoogleButtons(handler){
  const sels = ["#googleLoginBtn", ".google-signin", "[data-action='signin-google']"];
  const btns = sels.flatMap(s => Array.from(document.querySelectorAll(s)));
  btns.forEach(btn => {
    if (btn && !btn._bound) {
      btn._bound = true;
      btn.addEventListener("click", (e)=>{ e.preventDefault(); handler(); });
    }
  });
}

// === Foydalanuvchi profilini yaratish/yuklash
async function getOrCreateUserProfile(user) {
  const ref  = doc(db, "users", user.uid);
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

// === mc:user-ready global event
function publishUserReady(user, profile) {
  window.__mcUser = { user, profile };
  document.dispatchEvent(new CustomEvent("mc:user-ready", { detail: { user, profile } }));
}

// === Auth UI
/**
 * attachAuthUI({ requireSignIn?: boolean })
 * - Google redirect auth
 * - User kirgach profilni yaratadi va mc:user-ready jo'natadi
 * - requireSignIn=true bo'lsa, foydalanuvchi chiqib turganda modal avtomatik ochiladi
 */
export function attachAuthUI(opts = {}) {
  const provider = new GoogleAuthProvider();
  provider.setCustomParameters({ prompt: "select_account" });

  const doRedirectSignIn = () => signInWithRedirect(auth, provider);

  // Redirect natijasini ko'rsatish (xatolar ko'rinsin)
  getRedirectResult(auth)
    .then((cred) => {
      if (cred?.user) console.log("[auth] redirect OK:", cred.user.uid, cred.user.email);
    })
    .catch((e) => {
      console.error("[auth] redirect error:", e);
      alert("Kirish xatosi: " + (e.code || e.message || e));
    });

  // Auth holatini kuzatish
  onAuthStateChanged(auth, async (user) => {
    console.log("[auth] state:", !!user, user?.email || "");
    if (user) {
      try {
        const profile = await getOrCreateUserProfile(user);
        publishUserReady(user, profile);
        hideAuthModal(); // kirdi — modal yopilsin
      } catch (e) {
        console.error("[auth] profile error:", e);
        alert("Profilni yuklashda xato: " + (e.message || e));
      }
    } else {
      if (opts.requireSignIn) showAuthModal();
      bindGoogleButtons(doRedirectSignIn);
    }
  });

  // Dastlab ham tugmalarni bog'lab qo'yamiz
  bindGoogleButtons(doRedirectSignIn);
}

// === UX umumiy
/**
 * initUX()
 * - [data-action="signout"] chiqish
 * - [data-action="signin-google"] fallback
 * - [data-open="modalId"] / [data-close] modal boshqaruvi
 */
export function initUX() {
  // Chiqish
  qa("[data-action='signout']").forEach(btn => {
    if (btn._bound) return;
    btn._bound = true;
    btn.addEventListener("click", async () => {
      try { await signOut(auth); location.reload(); }
      catch (e) { alert("Chiqishda xato: " + (e.message || e)); }
    });
  });

  // Kirish fallback (alohida tugmalar uchun)
  qa("[data-action='signin-google']").forEach(btn => {
    if (btn._bound) return;
    btn._bound = true;
    btn.addEventListener("click", (e) => {
      e.preventDefault();
      const p = new GoogleAuthProvider();
      p.setCustomParameters({ prompt: "select_account" });
      signInWithRedirect(auth, p);
    });
  });

  // Oddiy modal boshqaruvi
  document.addEventListener("click", (e) => {
    const openId = e.target?.getAttribute?.("data-open");
    if (openId) {
      const m = document.getElementById(openId);
      if (m) m.classList.remove("hidden");
    }
    if (e.target?.hasAttribute?.("data-close")) {
      e.target.closest(".modal")?.classList?.add("hidden");
    }
    if (e.target?.classList?.contains("modal")) {
      e.target.classList.add("hidden");
    }
  });
}

// === (ixtiyoriy) adminligini sinxron tekshirish
export const isAdminSync = () => {
  const prof = window.__mcUser?.profile;
  const num  = Number(prof?.numericId);
  return Number.isFinite(num) && ADMIN_NUMERIC_IDS.includes(num);
};

// === Konsol banner (debug)
try { console.log("%cMathCenter common.js loaded (no-analytics)", "color:#0ea5e9;font-weight:bold"); } catch {}
