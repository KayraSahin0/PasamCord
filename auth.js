// auth.js - Firebase Kimlik Doğrulama
import { state } from './state.js';

// Firebase SDK'larını CDN üzerinden import ediyoruz (npm gerektirmez)
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-app.js";
import { getAuth, signInWithPopup, GoogleAuthProvider, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-auth.js";

const firebaseConfig = {
  apiKey: "AIzaSyASvvDp6M0ov6JSAWL0RD3zPJYaBw4H3fs",
  authDomain: "pasamcord.firebaseapp.com",
  projectId: "pasamcord",
  storageBucket: "pasamcord.firebasestorage.app",
  messagingSenderId: "528591507764",
  appId: "1:528591507764:web:5b0b9e6df841305f8ad561",
  measurementId: "G-NKKEGHBJW7"
};

// Firebase'i Başlat
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const provider = new GoogleAuthProvider();

// Google ile Giriş Yap
export async function loginWithGoogle() {
    try {
        const result = await signInWithPopup(auth, provider);
        const user = result.user;
        console.log("Google Girişi Başarılı:", user.displayName);
        return user;
    } catch (error) {
        console.error("Giriş Hatası:", error);
        alert("Google girişi başarısız oldu: " + error.message);
        return null;
    }
}

// Çıkış Yap
export async function logoutUser() {
    try {
        await signOut(auth);
        window.location.reload(); // Sayfayı yenile
    } catch (error) {
        console.error("Çıkış Hatası:", error);
    }
}

// Oturum Durumunu Dinle (Sayfa yenilendiğinde hatırlar)
export function checkAuthState(callback) {
    onAuthStateChanged(auth, (user) => {
        if (user) {
            // Kullanıcı zaten giriş yapmış
            state.userProfile = {
                name: user.displayName,
                photo: user.photoURL,
                uid: user.uid,
                isGoogle: true
            };
            callback(true, user);
        } else {
            // Giriş yapılmamış
            state.userProfile = null;
            callback(false, null);
        }
    });
}