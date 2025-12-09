import { state } from './state.js';
import * as Network from './network.js';

// --- SPOTIFY AYARLARI ---
// BURAYA KENDİ CLIENT ID'NİZİ YAZIN
const CLIENT_ID = '9221726daee146168f6569a3dfa4ff2e'; 
const REDIRECT_URI = 'http://127.0.0.1:5500/'; 
const SCOPES = [
    'streaming', 
    'user-read-email', 
    'user-read-private', 
    'user-modify-playback-state',
    'user-read-playback-state'
];

export function loginToSpotify() {
    // URL DÜZELTİLDİ: https://accounts.spotify.com/authorize
    const authUrl = `https://accounts.spotify.com/authorize?client_id=${CLIENT_ID}&response_type=token&redirect_uri=${encodeURIComponent(REDIRECT_URI)}&scope=${encodeURIComponent(SCOPES.join(' '))}&show_dialog=true`;
    
    const width = 450;
    const height = 730;
    const left = (window.screen.width / 2) - (width / 2);
    const top = (window.screen.height / 2) - (height / 2);
    
    window.open(authUrl, 'Spotify Login', `width=${width},height=${height},top=${top},left=${left}`);
}

// Popup'tan gelen tokeni işle

export function handleTokenFromPopup(token) {
    state.spotifyToken = token;
    
    // UI GÜNCELLEME
    const loginView = document.getElementById('spotify-login-view');
    const playerView = document.getElementById('spotify-player-view');
    
    if (loginView) loginView.classList.add('hidden');
    if (playerView) playerView.classList.remove('hidden');
    
    if(document.getElementById('spotify-panel')) document.getElementById('spotify-panel').classList.add('open');

    initSpotifyPlayer();
}

// Bu fonksiyon artık sadece yedek, ana işi main.js yapıyor
export function checkSpotifyToken() {
    return false; 
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

        player.addListener('ready', ({ device_id }) => {
            console.log('Spotify Hazır! ID:', device_id);
            state.spotifyDeviceId = device_id;
            state.spotifyPlayer = player;
            state.isSpotifyReady = true;
            Network.sendSpotifyStatus('ready');
        });

        player.addListener('not_ready', ({ device_id }) => {
            console.log('Spotify Cihazı Offline:', device_id);
        });

        player.addListener('player_state_changed', state => {
            if (!state) return;
            updatePlayerUI(state.track_window.current_track, state.paused);
        });

        player.connect();
    };
}

async function spotifyRequest(endpoint, method = 'GET', body = null) {
    const res = await fetch(`https://api.spotify.com/v1${endpoint}`, { // API URL DÜZELTİLDİ
        method: method,
        headers: {
            'Authorization': `Bearer ${state.spotifyToken}`,
            'Content-Type': 'application/json'
        },
        body: body ? JSON.stringify(body) : null
    });
    return res;
}

export async function searchSpotify(query) {
    const res = await spotifyRequest(`/search?q=${encodeURIComponent(query)}&type=track&limit=5`);
    const data = await res.json();
    if(data.tracks) renderSearchResults(data.tracks.items);
}

export async function playTrack(uri, position_ms = 0) {
    if(!state.spotifyDeviceId) return;

    await spotifyRequest(`/me/player/play?device_id=${state.spotifyDeviceId}`, 'PUT', {
        uris: [uri],
        position_ms: position_ms
    });
    
    state.currentTrackUri = uri;
}

export async function pauseTrack() {
    await spotifyRequest(`/me/player/pause?device_id=${state.spotifyDeviceId}`, 'PUT');
}

function updatePlayerUI(track, isPaused) {
    document.getElementById('sp-track-name').innerText = track.name;
    document.getElementById('sp-artist-name').innerText = track.artists[0].name;
    document.getElementById('sp-album-art').src = track.album.images[0].url;
    
    const icon = document.getElementById('sp-play-btn').querySelector('i');
    if(isPaused) icon.classList.replace('fa-pause', 'fa-play');
    else icon.classList.replace('fa-play', 'fa-pause');
}

function renderSearchResults(tracks) {
    const list = document.getElementById('sp-queue-ul');
    list.innerHTML = '';
    
    tracks.forEach(track => {
        const li = document.createElement('li');
        li.innerHTML = `
            <div style="display:flex; flex-direction:column; overflow:hidden; width:180px;">
                <span style="font-weight:bold; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${track.name}</span>
                <span style="font-size:0.8rem; color:#aaa;">${track.artists[0].name}</span>
            </div>
            <div>
                <button onclick="window.spCmdPlay('${track.uri}')" style="background:none; border:none; color:#1DB954; cursor:pointer; font-size:1.2rem;" title="Oynat"><i class="fa-solid fa-play"></i></button>
            </div>
        `;
        list.appendChild(li);
    });
}

export function handleSyncCommand(action, data) {
    if (!state.isSpotifyReady) return; 

    if (action === 'play') {
        const delay = Date.now() - data.timestamp; 
        playTrack(data.uri, data.position + delay);
    } 
    else if (action === 'pause') {
        pauseTrack();
    }
    else if (action === 'queue') {
        const list = document.getElementById('sp-queue-ul');
        const li = document.createElement('li');
        li.innerText = `Sıradaki: ${data.name}`;
        list.appendChild(li);
    }
}