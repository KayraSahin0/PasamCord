// auth.js - Firebase Kimlik ve Veritabanı Yönetimi
import { state } from './state.js';

// Firebase SDK'ları
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";
// YENİ: Firestore Eklendi
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

// --- KENDİ FIREBASE AYARLARINIZ ---
const firebaseConfig = {
  apiKey: "AIzaSyASvvDp6M0ov6JSAWL0RD3zPJYaBw4H3fs",
  authDomain: "pasamcord.firebaseapp.com",
  projectId: "pasamcord",
  storageBucket: "pasamcord.firebasestorage.app",
  messagingSenderId: "528591507764",
  appId: "1:528591507764:web:5b0b9e6df841305f8ad561",
  measurementId: "G-NKKEGHBJW7"
};

// Uygulamayı Başlat
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// YENİ: Veritabanını Dışa Aktar (Export)
export const db = getFirestore(app);

// Google Giriş
export async function loginWithGoogle() {
    try {
        const result = await signInWithPopup(auth, provider);
        console.log("Giriş Başarılı:", result.user.displayName);
        return result.user;
    } catch (error) {
        console.error("Giriş Hatası:", error);
        alert("Giriş yapılamadı: " + error.message);
        return null;
    }
}

// Çıkış
export async function logoutUser() {
    try {
        await signOut(auth);
        window.location.reload();
    } catch (error) {
        console.error("Çıkış Hatası:", error);
    }
}

// Oturum Kontrolü
export function checkAuthState(callback) {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            state.userProfile = {
                name: user.displayName,
                photo: user.photoURL,
                uid: user.uid,
                isGoogle: true
            };
            callback(true, user);
        } else {
            state.userProfile = null;
            callback(false, null);
        }
    });
}