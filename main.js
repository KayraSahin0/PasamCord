import { state } from './state.js';
import * as UI from './ui.js';
import * as Audio from './audio.js';
import * as Network from './network.js';
import * as Auth from './auth.js';
import * as Spotify from './spotify.js';
import * as Apps from './apps.js';

// --- 0. KRİTİK: POPUP KONTROLÜ (Bunu En Başa Ekleyin) ---
// Eğer bu sayfa bir popup ise ve URL'de Spotify authorization code varsa:
if (window.opener && window.location.search) {
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    const error = urlParams.get('error');
    const errorDescription = urlParams.get('error_description');
    const state = urlParams.get('state');
    
    if (error) {
        console.error("Spotify OAuth Hatası:", error, errorDescription);
        // Ana pencereye hata mesajı gönder
        window.opener.postMessage({ 
            type: 'SPOTIFY_ERROR', 
            error: error,
            errorDescription: errorDescription 
        }, '*');
        alert(`Spotify giriş hatası: ${error}\n\n${errorDescription || 'Lütfen Spotify Developer Dashboard ayarlarınızı kontrol edin.'}`);
        window.close();
        throw new Error("Popup hata ile kapatılıyor...");
    }
    
    if (code) {
        console.log("Popup modu algılandı. Authorization code yakalandı:", code.substring(0, 20) + "...");
        
        // State kontrolü
        const savedState = sessionStorage.getItem('spotify_oauth_state');
        if (state && savedState && state !== savedState) {
            console.error("State mismatch! State:", state, "Saved:", savedState);
            alert("Güvenlik hatası! Lütfen tekrar deneyin.");
            window.close();
            throw new Error("Popup güvenlik hatası ile kapatılıyor...");
        }
        
        // State'i temizle (eğer varsa)
        if (savedState) {
            sessionStorage.removeItem('spotify_oauth_state');
        }
        
        // Ana pencereye code gönder (token exchange ana pencerede yapılacak)
        // Hemen gönder, gecikme olmadan
        if (window.opener && !window.opener.closed) {
            window.opener.postMessage({ type: 'SPOTIFY_CODE', code: code }, '*');
            console.log("Code ana pencereye gönderildi");
        }
        
        // Kısa bir gecikme sonra kapat (mesajın gönderildiğinden emin olmak için)
        setTimeout(() => {
            window.close();
        }, 200);
        
        // Kodun geri kalanını çalıştırmayı durdur
        throw new Error("Popup kapatılıyor..."); 
    }
}

// --- 1. SAYFA YÜKLENİNCE ---
window.addEventListener('DOMContentLoaded', () => {

    const ytInput = document.getElementById('yt-url-input');
    if(ytInput) {
        ytInput.addEventListener('keypress', (e) => {
            if (e.key === 'Enter') window.handleYouTubeSearch();
        });
    }

    // Spotify Redirect URI'yi göster
    const redirectUriDisplay = document.getElementById('spotify-redirect-uri-display');
    if (redirectUriDisplay) {
        redirectUriDisplay.textContent = window.location.origin + window.location.pathname;
    }

    // Spotify Mesajlarını Dinle (Popup'tan gelen mesajı yakala)
    window.addEventListener('message', async (event) => {
        // Güvenlik: Sadece aynı origin'den gelen mesajları kabul et
        // (Geliştirme için * kullanıyoruz ama production'da spesifik origin kullanılmalı)
        if (event.data.type === 'SPOTIFY_CODE') {
            console.log("Spotify Authorization Code Alındı, token exchange yapılıyor...");
            if (event.data.code) {
                // Authorization code'u token'a çevir
                try {
                    const token = await Spotify.exchangeCodeForToken(event.data.code);
                    if (token) {
                        Spotify.handleTokenFromPopup(token);
                    }
                } catch (err) {
                    console.error("Token exchange hatası:", err);
                    alert(`Token alınamadı: ${err.message}`);
                }
            }
        } else if (event.data.type === 'SPOTIFY_TOKEN') {
            console.log("Spotify Token Alındı:", event.data.token);
            if (event.data.token) {
                Spotify.handleTokenFromPopup(event.data.token);
            }
        } else if (event.data.type === 'SPOTIFY_ERROR') {
            console.error("Spotify Giriş Hatası:", event.data.error, event.data.errorDescription);
            alert(`Spotify giriş hatası: ${event.data.error}\n\n${event.data.errorDescription || 'Lütfen Spotify Developer Dashboard ayarlarınızı kontrol edin.'}`);
        }
    });

    // UYGULAMALARI YÜKLE (YENİ)
    Apps.initApps();

    Auth.checkAuthState((isLoggedIn, user) => {
        if (isLoggedIn) {
            state.myUsername = user.displayName;
            document.getElementById('guest-section').classList.add('hidden');
            const googleBtn = document.querySelector('.btn-google'); 
            if(googleBtn) googleBtn.classList.add('hidden');
            const divider = document.querySelector('.divider'); 
            if(divider) divider.classList.add('hidden');
            
            const welcomeSec = document.getElementById('welcome-back-section');
            if(welcomeSec) {
                welcomeSec.classList.remove('hidden');
                document.getElementById('welcome-user-name').innerText = user.displayName;
                if(user.photoURL) document.getElementById('user-avatar-preview').src = user.photoURL;
            }
        }
    });
});

// --- 2. GİRİŞ ---
window.handleGoogleLogin = async function() {
    const user = await Auth.loginWithGoogle();
    if (user) {
        state.myUsername = user.displayName;
        window.startSession();
    }
};

window.handleGuestLogin = function() {
    const input = document.getElementById('username-input');
    if (!input.value.trim()) return alert("Lütfen bir isim girin.");
    state.myUsername = input.value.trim();
    window.startSession();
};

window.loginUser = function() {
    if (state.myUsername) window.startSession();
    else window.handleGuestLogin();
};

window.handleLogout = function() { Auth.logoutUser(); };

window.startSession = async function() {
    const success = await Audio.initAudioVideo();
    if(success) {
        UI.showAppScreen();
        Network.initPeer();
        startTimer();
    }
};

// --- 3. BAĞLANTI ---
window.startCall = function() {
    const idInput = document.getElementById('remote-id');
    const roomId = idInput.value.trim().toUpperCase().replace('#', '');
    Network.joinOrCreateRoom(roomId);
};

window.endCall = function() {
    // 1. Ağ Bağlantılarını Kes
    Network.closeAllConnections();
    
    // 2. State'deki peer listesini temizle
    for (let key in state.peers) delete state.peers[key];
    state.participantList = [{ id: state.peer.id, name: state.myUsername, isMe: true }];

    // 3. Arayüzü Sıfırla (Reload yapmadan)
    UI.resetScreens();
    
    // 4. Kendi videomuzu tekrar ızgaraya ekle (Çünkü resetScreens grid'i sildi)
    if (state.localStream) {
        UI.addVideoCard('local', state.localStream, state.myUsername, true);
    }
};

// --- 4. MEDYA ---
window.toggleMute = function() {
    if (!state.localStream) return;
    const track = state.localStream.getAudioTracks()[0];
    track.enabled = !track.enabled;
    state.isMuted = !track.enabled;
    const btn = document.getElementById('mute-btn');
    const icon = document.getElementById('mute-icon');
    if (state.isMuted) {
        btn.classList.add('btn-off');
        icon.classList.replace('fa-microphone', 'fa-microphone-slash');
    } else {
        btn.classList.remove('btn-off');
        icon.classList.replace('fa-microphone-slash', 'fa-microphone');
    }
};

// --- KAMERA TOGGLE (DÜZELTİLDİ) ---
window.toggleCamera = function() {
    if (!state.localStream) return;

    // Hedef durum: Şu an kapalıysa aç (true), açıksa kapat (false)
    const targetState = state.isCameraOff; 

    // Audio.js'deki fonksiyonu çağır (Artık async değil, anlık)
    const success = Audio.toggleLocalVideo(targetState);

    if (success) {
        state.isCameraOff = !targetState; // Durumu güncelle

        const btn = document.getElementById('camera-btn');
        const icon = document.getElementById('camera-icon');

        if (state.isCameraOff) {
            // KAPANDI
            btn.classList.add('btn-off');
            icon.classList.replace('fa-video', 'fa-video-slash');
        } else {
            // AÇILDI
            btn.classList.remove('btn-off');
            icon.classList.replace('fa-video-slash', 'fa-video');
        }
    }
};

window.toggleDeafen = function() {
    state.isDeafened = !state.isDeafened;
    document.querySelectorAll('video').forEach(v => {
        if (v.closest('.video-card').id !== 'video-local' && v.closest('.video-card').id !== 'screen-local') {
            v.muted = state.isDeafened;
        }
    });
    const btn = document.getElementById('deafen-btn');
    const icon = document.getElementById('deafen-icon');
    if (state.isDeafened) {
        btn.classList.add('btn-off');
        icon.classList.replace('fa-headphones', 'fa-ear-deaf');
    } else {
        btn.classList.remove('btn-off');
        icon.classList.replace('fa-ear-deaf', 'fa-headphones');
    }
};

// --- 5. EKRAN PAYLAŞIMI ---
window.toggleScreenShare = async function() {
    const btn = document.getElementById('screen-btn');
    if (!state.isScreenSharing) {
        try {
            const stream = await navigator.mediaDevices.getDisplayMedia({ 
                video: { cursor: "always", displaySurface: "monitor", frameRate: 30, width: { ideal: 1920 }, height: { ideal: 1080 } }, 
                audio: { echoCancellation: true, noiseSuppression: true }
            });
            state.localScreenStream = stream;
            state.isScreenSharing = true;
            UI.addVideoCard('local', stream, state.myUsername, true, true);
            Network.shareScreenToAll();
            btn.classList.add('btn-success');
            stream.getVideoTracks()[0].onended = () => { if(state.isScreenSharing) window.toggleScreenShare(); };
        } catch (err) { console.error(err); }
    } else {
        if (state.localScreenStream) {
            state.localScreenStream.getTracks().forEach(t => t.stop());
            state.localScreenStream = null;
        }
        state.isScreenSharing = false;
        UI.removeVideoCard('local', true);
        btn.classList.remove('btn-success');
    }
};

// --- 6. CHAT ---
window.toggleChat = function() { UI.toggleChatPanel(); };
window.sendChat = function() {
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (text) {
        UI.addMessageToUI("Ben", text, true);
        Network.sendChatMessage(text);
        input.value = "";
    }
};


// --- 7. UYGULAMALAR (YENİ EKLENEN KISIM) ---
window.toggleApps = function() { Apps.toggleAppsPanel(); };
window.adminLogin = function() { Apps.adminLogin(); };
window.openAddModal = function(type) { Apps.openAddModal(type); };
window.saveNewApp = function() { Apps.saveNewApp(); };

// --- 8. SPOTIFY & YOUTUBE ---
window.startSpotifyShare = function() { document.getElementById('spotify-guide-modal').classList.remove('hidden'); };
window.confirmSpotifyShare = async function() {
    document.getElementById('spotify-guide-modal').classList.add('hidden');
    if (!state.isScreenSharing) window.toggleScreenShare();
};

window.toggleYouTube = function() { UI.toggleYouTubePanel(); };
window.handleYouTubeSearch = function() {
    const inputVal = document.getElementById('yt-url-input').value.trim();
    if (!inputVal) return;
    UI.searchAndLoadYouTube(inputVal, true);
    document.getElementById('yt-url-input').value = "";
};
window.loadYouTubeVideo = window.handleYouTubeSearch;

// --- 9. AYARLAR ---
window.changeOutputVolume = (val) => Audio.setOutputVolume(val);
window.changeMicGain = (val) => Audio.setMicGain(val);
window.changeAudioInput = () => { Audio.switchAudioInput(document.getElementById('audio-input-select').value); };
window.changeVideoInput = () => { Audio.switchVideoInput(document.getElementById('video-input-select').value); };
window.changeAudioOutput = async () => {
    const deviceId = document.getElementById('audio-output-select').value;
    const videos = document.querySelectorAll('video');
    for(const v of videos) { if('setSinkId' in v) await v.setSinkId(deviceId); }
};
window.changeVideoQuality = function() {
    const res = parseInt(document.getElementById('video-resolution').value);
    const fps = parseInt(document.getElementById('video-fps').value);
    state.videoResolution = res;
    state.videoFPS = fps;
    Audio.applyVideoQuality();
};

// (Admin sekmesini tanıması için)
window.openTab = function(name) { UI.openSettingsTab(name); };
window.toggleMirrorSetting = (checked) => UI.setLocalMirror(checked);
window.toggleSettings = () => document.getElementById('settings-modal').classList.toggle('hidden');
window.toggleParticipants = () => {
    const chat = document.getElementById('chat-panel');
    if(chat.classList.contains('open')) chat.classList.remove('open');
    const yt = document.getElementById('youtube-panel');
    if(yt.classList.contains('open')) yt.classList.remove('open');
    document.getElementById('participants-panel').classList.toggle('open');
    const apps = document.getElementById('apps-panel');
    if(apps.classList.contains('open')) apps.classList.remove('open');
};

window.copyId = () => {
    const idText = document.getElementById('my-id').innerText;
    if(idText && idText !== "ID Yükleniyor...") {
        navigator.clipboard.writeText(idText);
        const fb = document.getElementById('copy-feedback');
        fb.style.opacity = '1'; fb.classList.remove('fade-out');
        setTimeout(() => { fb.style.opacity = '0'; fb.classList.add('fade-out'); }, 1000);
    }
};

function startTimer() {
    let sec = 0;
    setInterval(() => {
        sec++;
        const m = Math.floor(sec/60).toString().padStart(2,'0');
        const s = (sec%60).toString().padStart(2,'0');
        const el = document.getElementById('call-timer');
        if(el) el.innerText = `${m}:${s}`;
        UI.updateRoomSettingsUI();
    }, 1000);
}

// UI FONKSİYONLARI
window.toggleSpotifyPanel = function() {
    const p = document.getElementById('spotify-panel');
    p.classList.toggle('open');
    // Diğer panelleri kapat
    document.getElementById('chat-panel').classList.remove('open');
    document.getElementById('youtube-panel').classList.remove('open');
};

window.loginToSpotify = function() {
    Spotify.loginToSpotify();
};

window.searchSpotify = function() {
    const q = document.getElementById('sp-search-input').value;
    if(q) Spotify.searchSpotify(q);
};

// Player Kontrolleri
window.spPlayPause = function() {
    if(!state.spotifyPlayer) return;
    state.spotifyPlayer.getCurrentState().then(s => {
        if(!s) return;
        if(s.paused) {
            const track = s.track_window.current_track;
            Network.sendSpotifyCommand('play', track.uri, s.position, track.name, track.artists[0].name, track.album.images[0]?.url);
        } else {
            Network.sendSpotifyCommand('pause', null, 0);
        }
    });
};

window.spNext = function() {
    if(state.spotifyPlayer) {
        state.spotifyPlayer.nextTrack().then(() => {
            // Şarkı değişti, state güncellenecek
        });
    }
};

window.spPrev = function() {
    if(state.spotifyPlayer) {
        state.spotifyPlayer.previousTrack().then(() => {
            // Şarkı değişti, state güncellenecek
        });
    }
};

window.deleteApp = function(id) { Apps.deleteApp(id); };

// Arama input'u için Enter tuşu desteği
const spSearchInput = document.getElementById('sp-search-input');
if(spSearchInput) {
    spSearchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') window.searchSpotify();
    });
}