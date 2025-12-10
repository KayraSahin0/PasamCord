import { state } from './state.js';
import * as Network from './network.js';

// --- SPOTIFY AYARLARI ---
const CLIENT_ID = '9221726daee146168f6569a3dfa4ff2e'; 
const CLIENT_SECRET = '29fbf0028b534435896915ce64af8e75';
// ÖNEMLİ: Redirect URI'nin Spotify Developer Dashboard'da kayıtlı olması gerekiyor
// Sonunda / olmadan veya olarak kayıtlı olmalı - Dashboard'daki ile TAM EŞLEŞMELİ
const REDIRECT_URI = window.location.origin + window.location.pathname; 
const SCOPES = [
    'streaming', 
    'user-read-email', 
    'user-read-private', 
    'user-modify-playback-state',
    'user-read-playback-state'
];

export function loginToSpotify() {
    // Redirect URI'yi konsola yazdır (debug için)
    console.log("Redirect URI:", REDIRECT_URI);
    console.log("Bu URI'nin Spotify Developer Dashboard'da kayıtlı olduğundan emin olun!");
    
    // Authorization Code Flow kullanıyoruz (client secret için gerekli)
    // State oluştur (CSRF koruması için)
    const state = Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
    sessionStorage.setItem('spotify_oauth_state', state);
    
    // OAuth URL'ini oluştur (response_type=code)
    const authUrl = `https://accounts.spotify.com/authorize?client_id=${CLIENT_ID}&response_type=code&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPES.join(' '))}&state=${state}&show_dialog=true`;
    
    console.log("Spotify Auth URL:", authUrl);
    
    const width = 450; 
    const height = 730;
    const left = (window.screen.width / 2) - (width / 2);
    const top = (window.screen.height / 2) - (height / 2);
    
    const popup = window.open(authUrl, 'Spotify Login', `width=${width},height=${height},top=${top},left=${left}`);
    
    if (!popup) {
        alert("Popup engellendi! Lütfen tarayıcı ayarlarından popup'lara izin verin.");
        return;
    }
    
    // Popup'un kapanmasını kontrol et (code yakalama main.js'de yapılacak)
    const checkInterval = setInterval(() => {
        try {
            // Popup kapalı mı kontrol et
            if (popup.closed) {
                clearInterval(checkInterval);
                return;
            }
        } catch (e) {
            // Popup erişilemiyor, normal (cross-origin)
        }
    }, 500);
    
    // 5 dakika sonra interval'i temizle (timeout)
    setTimeout(() => {
        clearInterval(checkInterval);
        if (!popup.closed) {
            popup.close();
            alert("Giriş zaman aşımına uğradı. Lütfen tekrar deneyin.");
        }
    }, 300000);
}

// Authorization code'u access token'a çevir (Export edildi - main.js'den çağrılabilir)
export async function exchangeCodeForToken(code) {
    try {
        // Client secret kullanarak token exchange yap
        // NOT: Bu işlem normalde backend'de yapılmalı ama client-side'da yapıyoruz
        // Güvenlik için client secret'ı backend'e taşımanız önerilir
        
        console.log("Token exchange başlatılıyor...");
        console.log("Code:", code.substring(0, 20) + "...");
        console.log("Redirect URI:", REDIRECT_URI);
        
        // Redirect URI'nin sonunda / olup olmadığını kontrol et
        // Spotify Developer Dashboard'da kayıtlı URI ile tam eşleşmeli
        let redirectUri = REDIRECT_URI;
        
        // Eğer pathname '/' ile bitiyorsa, sonundaki '/' karakterini kaldır
        // Çünkü bazı durumlarda Spotify bunu kabul etmeyebilir
        if (redirectUri.endsWith('/') && redirectUri !== 'http://127.0.0.1:5500/') {
            // Eğer sadece origin + '/' ise bırak, aksi halde kaldır
            const path = new URL(redirectUri).pathname;
            if (path !== '/') {
                redirectUri = redirectUri.slice(0, -1);
            }
        }
        
        console.log("Kullanılan Redirect URI:", redirectUri);
        
        const response = await fetch('https://accounts.spotify.com/api/token', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/x-www-form-urlencoded',
                'Authorization': 'Basic ' + btoa(CLIENT_ID + ':' + CLIENT_SECRET)
            },
            body: new URLSearchParams({
                grant_type: 'authorization_code',
                code: code,
                redirect_uri: redirectUri
            })
        });
        
        if (!response.ok) {
            const error = await response.json();
            console.error("Token exchange hatası:", error);
            console.error("Response status:", response.status);
            console.error("Response headers:", response.headers);
            
            // Daha detaylı hata mesajı
            let errorMsg = error.error_description || error.error || 'Token exchange failed';
            if (error.error === 'invalid_grant') {
                errorMsg = 'Authorization code geçersiz veya süresi dolmuş. Lütfen tekrar giriş yapın.';
            }
            
            throw new Error(errorMsg);
        }
        
        const data = await response.json();
        console.log("Token başarıyla alındı!");
        return data.access_token;
    } catch (e) {
        console.error("Token exchange hatası:", e);
        throw e;
    }
}

export async function handleTokenFromPopup(token) {
    state.spotifyToken = token;
    
    // Premium kontrolü yap
    const isPremium = await checkPremiumStatus();
    if (!isPremium) {
        alert("Spotify Premium hesabı gereklidir! Lütfen Premium hesabınızla giriş yapın.");
        state.spotifyToken = null;
        return;
    }
    
    state.isSpotifyPremium = true;
    
    // Kendi premium durumumuzu state'e ekle
    if (state.peer && state.peer.id) {
        state.spotifyPremiumUsers[state.peer.id] = {
            name: state.myUsername,
            isPremium: true
        };
    }
    
    const loginView = document.getElementById('spotify-login-view');
    const playerView = document.getElementById('spotify-player-view');
    if (loginView) loginView.classList.add('hidden');
    if (playerView) playerView.classList.remove('hidden');
    if(document.getElementById('spotify-panel')) document.getElementById('spotify-panel').classList.add('open');
    
    // Premium durumunu network'e bildir
    Network.sendSpotifyPremiumStatus(true);
    
    initSpotifyPlayer();
    updatePremiumUsersUI();
}

// Premium durumunu kontrol et
async function checkPremiumStatus() {
    try {
        const res = await spotifyRequest('/me');
        const data = await res.json();
        // Spotify API'de product alanı premium olup olmadığını gösterir
        return data.product === 'premium';
    } catch (e) {
        console.error("Premium kontrolü hatası:", e);
        return false;
    }
}

function initSpotifyPlayer() {
    if(!window.Spotify) {
        const script = document.createElement('script');
        script.src = "https://sdk.scdn.co/spotify-player.js";
        script.async = true;
        document.body.appendChild(script);
    }

    window.onSpotifyWebPlaybackSDKReady = () => {
        const player = new Spotify.Player({
            name: 'PasamCord Party',
            getOAuthToken: cb => { cb(state.spotifyToken); },
            volume: 0.5
        });

        // Şarkı durumu değişikliklerini dinle
        let lastTrackUri = null;
        let positionCheckInterval = null;
        
        player.addListener('player_state_changed', playerState => {
            if (!playerState) {
                // Player durumu yok, şarkı bitmiş olabilir
                if (lastTrackUri && state.spotifyQueue.length > 0) {
                    setTimeout(() => {
                        playNextInQueue();
                    }, 1000);
                }
                return;
            }
            
            const track = playerState.track_window.current_track;
            const isPaused = playerState.paused;
            const position = playerState.position;
            const duration = track ? track.duration_ms : 0;
            
            // UI Güncelle
            updatePlayerUI(track, isPaused);
            
            // Şarkı değişti mi kontrol et
            if (track && track.uri !== lastTrackUri) {
                lastTrackUri = track.uri;
                state.currentTrackUri = track.uri;
                state.wasPlaying = false;
                state.previousTrackPosition = 0;
                
                // Eski interval'i temizle
                if (positionCheckInterval) {
                    clearInterval(positionCheckInterval);
                }
                
                // Yeni interval başlat - şarkı bitişini kontrol et
                positionCheckInterval = setInterval(() => {
                    player.getCurrentState().then(currentState => {
                        if (!currentState || !currentState.track_window.current_track) {
                            // Şarkı bitti
                            if (positionCheckInterval) {
                                clearInterval(positionCheckInterval);
                                positionCheckInterval = null;
                            }
                            if (state.spotifyQueue.length > 0) {
                                playNextInQueue();
                            }
                            return;
                        }
                        
                        const currentTrack = currentState.track_window.current_track;
                        const currentPosition = currentState.position;
                        const currentDuration = currentTrack.duration_ms;
                        
                        // Şarkı değişti mi?
                        if (currentTrack.uri !== lastTrackUri) {
                            lastTrackUri = currentTrack.uri;
                            state.currentTrackUri = currentTrack.uri;
                            return;
                        }
                        
                        // Şarkı bitişine yakın mı? (son 2 saniye)
                        if (!currentState.paused && currentPosition > 0 && currentDuration > 0) {
                            const remaining = currentDuration - currentPosition;
                            if (remaining < 2000 && remaining > 0) {
                                // Şarkı bitiyor, sıradakine geç
                                if (positionCheckInterval) {
                                    clearInterval(positionCheckInterval);
                                    positionCheckInterval = null;
                                }
                                setTimeout(() => {
                                    if (state.spotifyQueue.length > 0) {
                                        playNextInQueue();
                                    }
                                }, remaining + 500);
                            }
                        }
                    }).catch(() => {
                        // Hata durumunda interval'i temizle
                        if (positionCheckInterval) {
                            clearInterval(positionCheckInterval);
                            positionCheckInterval = null;
                        }
                    });
                }, 1000); // Her saniye kontrol et
            }
            
            // Çalma durumunu takip et
            if (!isPaused && track && position > 0) {
                state.wasPlaying = true;
                state.previousTrackPosition = position;
            }
        });

        player.addListener('ready', ({ device_id }) => {
            console.log('Spotify Hazır! Device ID:', device_id);
            state.spotifyDeviceId = device_id;
            state.spotifyPlayer = player;
            state.isSpotifyReady = true;
            Network.sendSpotifyStatus('ready');
        });

        player.addListener('not_ready', ({ device_id }) => {
            console.log('Spotify Player hazır değil:', device_id);
        });

        player.connect();
    };
}

async function spotifyRequest(endpoint, method = 'GET', body = null) {
    const res = await fetch(`https://api.spotify.com/v1${endpoint}`, {
        method: method,
        headers: {
            'Authorization': `Bearer ${state.spotifyToken}`,
            'Content-Type': 'application/json'
        },
        body: body ? JSON.stringify(body) : null
    });
    
    if (!res.ok) {
        const error = await res.json();
        console.error("Spotify API Hatası:", error);
        throw new Error(error.error?.message || "API Hatası");
    }
    
    return res;
}

// Arama fonksiyonu
export async function searchSpotify(query) {
    if (!query || !query.trim()) return;
    
    try {
        const res = await spotifyRequest(`/search?q=${encodeURIComponent(query)}&type=track&limit=10`);
        const data = await res.json();
        if(data.tracks && data.tracks.items) {
            renderSearchResults(data.tracks.items);
        }
    } catch (e) {
        console.error("Arama hatası:", e);
        const list = document.getElementById('sp-queue-ul');
        if (list) {
            list.innerHTML = '<li style="color:#ff4444;">Arama yapılamadı. Lütfen tekrar deneyin.</li>';
        }
    }
}

// Arama sonuçlarını göster
function renderSearchResults(tracks) {
    const list = document.getElementById('sp-queue-ul');
    if (!list) return;
    
    list.innerHTML = '';
    
    if (tracks.length === 0) {
        list.innerHTML = '<li style="color:#aaa; padding:10px;">Sonuç bulunamadı.</li>';
        renderQueueList();
        return;
    }
    
    // Arama sonuçları başlığı
    const header = document.createElement('li');
    header.style.cssText = 'padding:10px; font-weight:bold; color:#1DB954; border-bottom:1px solid #333;';
    header.innerHTML = '<i class="fa-solid fa-magnifying-glass"></i> Arama Sonuçları';
    list.appendChild(header);
    
    // Arama sonuçları
    tracks.forEach(track => {
        const li = document.createElement('li');
        li.style.cssText = 'padding:10px; border-bottom:1px solid #222;';
        
        const albumArt = track.album.images && track.album.images.length > 0 
            ? track.album.images[track.album.images.length - 1].url 
            : '';
        
        li.innerHTML = `
            <div style="display:flex; align-items:center; gap:10px; width:100%;">
                ${albumArt ? `<img src="${albumArt}" style="width:50px; height:50px; border-radius:4px; object-fit:cover;">` : ''}
                <div style="flex-grow:1; overflow:hidden; min-width:0;">
                    <div style="font-weight:bold; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size:0.9rem;">${escapeHtml(track.name)}</div>
                    <div style="font-size:0.75rem; color:#aaa; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(track.artists[0].name)}</div>
                </div>
                <div style="display:flex; gap:5px; flex-shrink:0;">
                    <button onclick="window.spCmdPlayNow('${track.uri}', '${escapeHtml(track.name).replace(/'/g, "\\'")}', '${escapeHtml(track.artists[0].name).replace(/'/g, "\\'")}', '${albumArt}')" 
                            title="Hemen Çal" 
                            style="background:#1DB954; border:none; color:white; border-radius:4px; padding:8px 12px; cursor:pointer; font-size:0.85rem;">
                        <i class="fa-solid fa-play"></i> Çal
                    </button>
                    <button onclick="window.spCmdAddToQueue('${track.uri}', '${escapeHtml(track.name).replace(/'/g, "\\'")}', '${escapeHtml(track.artists[0].name).replace(/'/g, "\\'")}', '${albumArt}')" 
                            title="Sıraya Ekle" 
                            style="background:#333; border:1px solid #555; color:white; border-radius:4px; padding:8px 12px; cursor:pointer; font-size:0.85rem;">
                        <i class="fa-solid fa-list-ul"></i> Sıraya Ekle
                    </button>
                </div>
            </div>
        `;
        list.appendChild(li);
    });
    
    // Kuyruk listesini göster
    renderQueueList();
}

// Kuyruk listesini göster
function renderQueueList() {
    const list = document.getElementById('sp-queue-ul');
    if (!list) return;
    
    // Ayırıcı
    const divider = document.createElement('hr');
    divider.style.cssText = 'border-color:#333; margin:15px 0;';
    list.appendChild(divider);
    
    // Kuyruk başlığı
    const qHeader = document.createElement('li');
    qHeader.style.cssText = 'padding:10px; font-weight:bold; color:#1DB954;';
    qHeader.innerHTML = `<i class="fa-solid fa-list"></i> Sıradakiler (${state.spotifyQueue.length})`;
    list.appendChild(qHeader);
    
    if (state.spotifyQueue.length === 0) {
        const emptyLi = document.createElement('li');
        emptyLi.style.cssText = 'padding:10px; color:#888; font-style:italic;';
        emptyLi.innerText = 'Sırada şarkı yok.';
        list.appendChild(emptyLi);
    } else {
        state.spotifyQueue.forEach((track, index) => {
            const li = document.createElement('li');
            li.style.cssText = 'padding:8px 10px; border-bottom:1px solid #222; display:flex; align-items:center; gap:8px;';
            li.innerHTML = `
                <span style="color:#1DB954; font-weight:bold; min-width:20px;">${index + 1}.</span>
                <div style="flex-grow:1; overflow:hidden;">
                    <div style="font-weight:500; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${escapeHtml(track.name)}</div>
                    <div style="font-size:0.75rem; color:#888;">${escapeHtml(track.artist)}</div>
                </div>
            `;
            list.appendChild(li);
        });
    }
}

function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
}

// Şarkı çal
export async function playTrack(uri, position_ms = 0) {
    if(!state.spotifyDeviceId || !uri) return;
    
    try {
        await spotifyRequest(`/me/player/play?device_id=${state.spotifyDeviceId}`, 'PUT', {
            uris: [uri],
            position_ms: position_ms
        });
        state.currentTrackUri = uri;
        state.wasPlaying = true;
    } catch (e) {
        console.error("Şarkı çalma hatası:", e);
    }
}

// Şarkıyı duraklat
export async function pauseTrack() {
    if(!state.spotifyDeviceId) return;
    try {
        await spotifyRequest(`/me/player/pause?device_id=${state.spotifyDeviceId}`, 'PUT');
    } catch (e) {
        console.error("Duraklatma hatası:", e);
    }
}

// Sıradaki şarkıyı çal
function playNextInQueue() {
    if (state.spotifyQueue.length > 0) {
        const nextTrack = state.spotifyQueue.shift();
        updateQueueUI();
        
        // Şarkıyı çal (network üzerinden gönder)
        Network.sendSpotifyCommand('play', nextTrack.uri, 0, nextTrack.name, nextTrack.artist, nextTrack.albumArt);
    } else {
        // Sırada şarkı yok
        state.currentTrackUri = null;
        updatePlayerUI(null, true);
    }
}

// UI güncelleme fonksiyonları
function updatePlayerUI(track, isPaused) {
    if (!track) {
        const trackNameEl = document.getElementById('sp-track-name');
        const artistNameEl = document.getElementById('sp-artist-name');
        const albumArtEl = document.getElementById('sp-album-art');
        if (trackNameEl) trackNameEl.innerText = "Şarkı Seçilmedi";
        if (artistNameEl) artistNameEl.innerText = "...";
        if (albumArtEl) albumArtEl.src = "";
        return;
    }
    
    const trackNameEl = document.getElementById('sp-track-name');
    const artistNameEl = document.getElementById('sp-artist-name');
    const albumArtEl = document.getElementById('sp-album-art');
    const playBtn = document.getElementById('sp-play-btn');
    
    if (trackNameEl) trackNameEl.innerText = track.name;
    if (artistNameEl) artistNameEl.innerText = track.artists[0].name;
    if (albumArtEl && track.album.images && track.album.images.length > 0) {
        albumArtEl.src = track.album.images[0].url;
    }
    
    if (playBtn) {
        const icon = playBtn.querySelector('i');
        if (icon) {
            if (isPaused) {
                icon.classList.remove('fa-pause');
                icon.classList.add('fa-play');
            } else {
                icon.classList.remove('fa-play');
                icon.classList.add('fa-pause');
            }
        }
    }
}

function updateQueueUI() {
    const list = document.getElementById('sp-queue-ul');
    if (!list) return;
    
    // Sadece kuyruk kısmını güncelle
    const queueItems = Array.from(list.querySelectorAll('li')).filter(li => {
        const text = li.innerText || '';
        return text.includes('Sıradakiler') || /^\d+\./.test(text.trim());
    });
    
    queueItems.forEach(item => item.remove());
    
    // Kuyruk listesini tekrar ekle
    renderQueueList();
}

// Premium kullanıcı sayısını UI'da göster
export function updatePremiumUsersUI() {
    const premiumCount = Object.values(state.spotifyPremiumUsers).filter(u => u.isPremium).length;
    const totalUsers = state.participantList.length || 1;
    
    const statusEl = document.getElementById('sp-status');
    const premiumTextEl = document.getElementById('sp-premium-text');
    
    if (statusEl) {
        statusEl.innerHTML = `
            <i class="fa-solid fa-info-circle"></i> Herkesin Premium hesabı gereklidir.
        `;
    }
    
    if (premiumTextEl) {
        premiumTextEl.innerText = `${premiumCount} / ${totalUsers} kişi Premium hesabıyla giriş yaptı.`;
    }
}

// Senkronizasyon komutlarını işle
export function handleSyncCommand(action, data) {
    if (!state.isSpotifyReady) return;

    if (action === 'play') {
        // Şarkıyı çal
        playTrack(data.uri, data.position || 0);
        
        // UI güncelle
        if (data.name) {
            const trackNameEl = document.getElementById('sp-track-name');
            const artistNameEl = document.getElementById('sp-artist-name');
            const albumArtEl = document.getElementById('sp-album-art');
            
            if (trackNameEl) trackNameEl.innerText = data.name;
            if (artistNameEl) artistNameEl.innerText = data.artist || "";
            if (albumArtEl && data.albumArt) {
                albumArtEl.src = data.albumArt;
            }
        }
        
        // Eğer sıradan çalıyorsa, sıradan kaldır
        const queueIndex = state.spotifyQueue.findIndex(t => t.uri === data.uri);
        if (queueIndex !== -1) {
            state.spotifyQueue.splice(queueIndex, 1);
            updateQueueUI();
        }
    } 
    else if (action === 'pause') {
        pauseTrack();
    }
    else if (action === 'queue') {
        // Sıraya ekle
        const trackObj = { 
            uri: data.uri, 
            name: data.name, 
            artist: data.artist,
            albumArt: data.albumArt || ''
        };
        state.spotifyQueue.push(trackObj);
        updateQueueUI();
    }
}

// Premium durumunu işle
export function handlePremiumStatus(peerId, name, isPremium) {
    if (!state.spotifyPremiumUsers[peerId]) {
        state.spotifyPremiumUsers[peerId] = { name, isPremium };
    } else {
        state.spotifyPremiumUsers[peerId].isPremium = isPremium;
        state.spotifyPremiumUsers[peerId].name = name;
    }
    updatePremiumUsersUI();
}

// Global fonksiyonlar (window'a ekleniyor)
window.spCmdPlayNow = async function(uri, name, artist, albumArt) {
    if (!state.isSpotifyReady) {
        alert("Spotify hazır değil. Lütfen bekleyin.");
        return;
    }
    
    // Track bilgilerini al (eğer verilmemişse)
    if (!name || !artist) {
        try {
            const trackId = uri.split(':')[2];
            const res = await spotifyRequest(`/tracks/${trackId}`);
            const data = await res.json();
            name = data.name;
            artist = data.artists[0].name;
            albumArt = data.album.images[0]?.url || '';
        } catch (e) {
            console.error("Track bilgisi alınamadı:", e);
            name = name || "Bilinmeyen Şarkı";
            artist = artist || "Bilinmeyen Sanatçı";
        }
    }
    
    // Network üzerinden gönder
    Network.sendSpotifyCommand('play', uri, 0, name, artist, albumArt);
};

window.spCmdAddToQueue = function(uri, name, artist, albumArt) {
    if (!state.isSpotifyReady) {
        alert("Spotify hazır değil. Lütfen bekleyin.");
        return;
    }
    
    // Network üzerinden gönder
    Network.sendSpotifyCommand('queue', uri, 0, name, artist, albumArt);
};
