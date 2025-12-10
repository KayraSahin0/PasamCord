import { state } from './state.js';
import { updateMyId, updateRoomId, addVideoCard, removeVideoCard, updateParticipantsUI, updateNameTag, showCallScreen, addMessageToUI, loadYouTubeVideoById, syncYouTubeAction } from './ui.js';
import * as Spotify from './spotify.js';

let connectionTimeout = null;

export function initPeer(customId = null) {
    // Eğer özel bir ID istenmediyse rastgele oluştur, istendiyse onu kullan (Host ol)
    const myId = customId || Math.random().toString(36).substr(2, 5).toUpperCase();
    
    // Eski peer varsa temizle
    if (state.peer) {
        state.peer.destroy();
        state.peer = null;
    }

    state.peer = new Peer(myId, { debug: 1 });

    // ID Timeout Kontrolü (5 saniye içinde ID alamazsa resetle)
    if (connectionTimeout) clearTimeout(connectionTimeout);
    connectionTimeout = setTimeout(() => {
        if (state.peer && !state.peer.id) {
            console.warn("ID alınamadı, tekrar deneniyor...");
            state.peer.destroy();
            initPeer(null);
        }
    }, 5000);

    state.peer.on('open', (id) => {
        if (connectionTimeout) clearTimeout(connectionTimeout);
        console.log("Peer Açıldı. ID:", id);
        updateMyId(id);
        
        // EĞER ÖZEL ID İLE AÇTIYSAK (HOST OLDUK DEMEKTİR)
        if (customId) {
            updateRoomId(id);
            state.participantList = [{ id: id, name: state.myUsername, isMe: true }];
            updateParticipantsUI();
            startHeartbeat(); // Kalp atışını başlat
            showCallScreen(); // Ekranı aç
        }
    });

    state.peer.on('error', (err) => {
        if (err.type === 'unavailable-id') {
            // Eğer Host olmaya çalışırken ID dolu hatası alırsak,
            // demek ki oda var. Odaya katılımcı olarak girmeyi deneyelim.
            // (Normalde joinOrCreateRoom bunu halleder ama güvenlik önlemi)
            alert("Oda ID'si kullanımda, giriş yapılıyor...");
            initPeer(null); 
        }
    });

    // ... (call ve connection eventleri aynı kalabilir) ...
    state.peer.on('call', (call) => {
        const isScreen = (call.metadata && call.metadata.type === 'screen');
        if (isScreen) { call.answer(); handleScreenCall(call); }
        else { call.answer(state.localStream); handleCall(call); }
    });

    state.peer.on('connection', (conn) => setupDataConnection(conn));
}

// --- AKILLI ODA MANTIĞI ---
export function joinOrCreateRoom(roomId) {
    if (!roomId) { alert("Lütfen bir Oda Adı girin!"); return; }
    
    console.log("Oda kontrol ediliyor:", roomId);
    updateMyId("Aranıyor...");

    // 1. GEÇİCİ BİR PEER OLUŞTUR (Gözcü)
    const tempId = Math.random().toString(36).substr(2, 5).toUpperCase();
    const tempPeer = new Peer(tempId);

    let isConnected = false;
    let connectTimer = null;

    tempPeer.on('open', () => {
        // 2. HEDEF ODAYA BAĞLANMAYI DENE
        const conn = tempPeer.connect(roomId);

        // Bağlantı başarılı olursa -> ODA VARDIR -> KATILIMCI OL
        conn.on('open', () => {
            isConnected = true;
            if(connectTimer) clearTimeout(connectTimer);
            console.log("Oda Bulundu! Katılımcı olarak giriliyor.");
            
            // Geçici peer'i ana peer yap (state'e ata) ve eventleri bağla
            // (initPeer çağırmıyoruz çünkü zaten bağlı bir peerımız var)
            state.peer = tempPeer; 
            
            // Olay dinleyicilerini manuel ekle (initPeer içindeki logic gibi)
            state.peer.on('call', (call) => {
                 const isScreen = (call.metadata && call.metadata.type === 'screen');
                 if (isScreen) { call.answer(); handleScreenCall(call); }
                 else { call.answer(state.localStream); handleCall(call); }
            });
            state.peer.on('connection', (c) => setupDataConnection(c));

            // UI Güncelle
            updateMyId(tempId);
            updateRoomId(roomId);
            showCallScreen();
            
            // Bağlantı işlemlerini yap
            setupDataConnection(conn);
            const call = state.peer.call(roomId, state.localStream, { metadata: { type: 'camera' } });
            handleCall(call, conn);
        });
    });

    tempPeer.on('error', (err) => {
        console.log("Bağlantı denemesi hatası:", err.type);
    });

    // 3. ZAMANLAYICI: 2.5 saniye içinde bağlanamazsa -> ODA YOKTUR -> HOST OL
    connectTimer = setTimeout(() => {
        if (!isConnected) {
            console.log("Oda bulunamadı. Yeni oda kuruluyor (Host):", roomId);
            tempPeer.destroy(); // Geçici peer'i kapat
            initPeer(roomId);   // Bu ID ile ana Peer'i başlat (Host Ol)
        }
    }, 2500);
}

// --- 3. VERİ VE MEDYA İŞLEMLERİ ---

export function sendChatMessage(text) {
    const data = { type: 'chat', sender: state.myUsername, text: text };
    broadcastData(data);
}

export function sendYouTubeLoad(videoId) {
    const data = { type: 'yt-load', videoId: videoId };
    broadcastData(data);
}

export function sendYouTubeAction(action, time) {
    const data = { type: 'yt-action', action: action, time: time };
    broadcastData(data);
}

function broadcastData(data) {
    Object.values(state.peers).forEach(p => { if (p.conn && p.conn.open) p.conn.send(data); });
}

// --- HEARTBEAT ---
function startHeartbeat() {
    setInterval(() => {
        Object.values(state.peers).forEach(p => {
            if (p.conn && p.conn.open) p.conn.send({ type: 'heartbeat', from: state.peer.id });
        });
    }, 2000);

    setInterval(() => {
        const now = Date.now();
        Object.keys(state.lastHeartbeat).forEach(pid => {
            if (now - state.lastHeartbeat[pid] > 6000) removePeer(pid);
        });
    }, 5000);
}

// --- STANDART FONKSİYONLAR (AYNI KALDI) ---

export function connectToPeer(remoteId) {
    // Bu fonksiyon artık manuel çağrılmıyor, joinOrCreateRoom kullanılıyor.
    // Yine de mesh ağında diğerlerine bağlanmak için gerekli.
    if (state.peers[remoteId]) return;
    
    const call = state.peer.call(remoteId, state.localStream, { metadata: { type: 'camera' } });
    const conn = state.peer.connect(remoteId);
    setupDataConnection(conn);
    handleCall(call, conn);
}

export function shareScreenToAll() {
    if (!state.localScreenStream) return;
    Object.keys(state.peers).forEach(peerId => shareScreenToPeer(peerId));
}

export function shareScreenToPeer(peerId) {
    if (!state.localScreenStream) return;
    state.peer.call(peerId, state.localScreenStream, { metadata: { type: 'screen', name: state.myUsername } });
}

function handleScreenCall(call) {
    const peerId = call.peer;
    const name = (call.metadata && call.metadata.name) ? call.metadata.name : (state.peers[peerId]?.name || "Bilinmeyen");
    call.on('stream', (stream) => addVideoCard(peerId, stream, name, false, true));
    call.on('close', () => removeVideoCard(peerId, true));
    call.on('error', () => removeVideoCard(peerId, true));
}

function handleCall(call, conn = null) {
    const peerId = call.peer;
    showCallScreen();
    
    if (!conn) {
        const backConn = state.peer.connect(peerId);
        setupDataConnection(backConn);
    }

    state.peers[peerId] = { call: call, name: "Bağlanıyor...", id: peerId, conn: conn };
    state.lastHeartbeat[peerId] = Date.now();
    
    // Eğer biz Host isek veya listemiz varsa güncelle
    broadcastParticipants();
    
    if (state.isScreenSharing) shareScreenToPeer(peerId);

    call.on('stream', (stream) => addVideoCard(peerId, stream, state.peers[peerId].name, false, false));
    call.on('close', () => removePeer(peerId));
    call.on('error', () => removePeer(peerId));
}

function removePeer(peerId) {
    if (state.peers[peerId]) {
        if(state.peers[peerId].call) state.peers[peerId].call.close();
        delete state.peers[peerId];
    }
    if (state.lastHeartbeat[peerId]) delete state.lastHeartbeat[peerId];
    // Premium kullanıcı listesinden de kaldır
    if (state.spotifyPremiumUsers && state.spotifyPremiumUsers[peerId]) {
        delete state.spotifyPremiumUsers[peerId];
        // UI'ı güncelle
        import('./spotify.js').then(module => {
            module.updatePremiumUsersUI();
        });
    }
    removeVideoCard(peerId, false);
    removeVideoCard(peerId, true);
    broadcastParticipants();
}

function broadcastParticipants() {
    // Sadece Host veya Mesh ağındaki aktif kullanıcılar listeyi güncellemeli
    const list = [];
    list.push({ id: state.peer.id, name: state.myUsername, isMe: false });
    Object.values(state.peers).forEach(p => list.push({ id: p.id, name: p.name }));
    
    state.participantList = list.map(u => ({...u, isMe: u.id === state.peer.id}));
    updateParticipantsUI();

    Object.values(state.peers).forEach(p => {
        if (p.conn && p.conn.open) p.conn.send({ type: 'update-participants', list: list });
    });
}

function setupDataConnection(conn) {
    conn.on('open', () => {
        conn.send({ type: 'name', name: state.myUsername });
        // Mesh Ağı: Yeni gelene diğerlerini bildir
        if (Object.keys(state.peers).length > 0) {
            const connectedPeers = Object.keys(state.peers);
            conn.send({ type: 'mesh-peers', peers: connectedPeers });
        }
        state.lastHeartbeat[conn.peer] = Date.now();
    });

    conn.on('data', (data) => {
        if (data.type === 'heartbeat') { state.lastHeartbeat[conn.peer] = Date.now(); return; }
        
        // A. Biri ekran paylaşımını kapattıysa:
        if (data.type === 'stop-screen') {
            // Ekran kartını (isScreen=true) zorla sil
            removeVideoCard(conn.peer, true); 
        }

        // B. Biri odadan ayrıldıysa (Sekmeyi kapattıysa):
        if (data.type === 'leave') {
            console.log("Kullanıcı ayrıldı (Leave Signal):", conn.peer);
            removePeer(conn.peer);
        }
        
        if (data.type === 'chat') addMessageToUI(data.sender, data.text, false);
        if (data.type === 'yt-load') loadYouTubeVideoById(data.videoId, false);
        if (data.type === 'yt-action') syncYouTubeAction(data.action, data.time);

        if (data.type === 'name') {
            if (state.peers[conn.peer]) {
                state.peers[conn.peer].name = data.name;
                state.peers[conn.peer].conn = conn; 
                updateNameTag(conn.peer, data.name);
                broadcastParticipants();
                conn.send({ type: 'name-reply', name: state.myUsername });
            }
        }
        if (data.type === 'name-reply') {
            if (state.peers[conn.peer]) {
                state.peers[conn.peer].name = data.name;
                updateNameTag(conn.peer, data.name);
                broadcastParticipants();
            }
        }
        if (data.type === 'update-participants') {
            state.participantList = data.list;
            updateParticipantsUI();
        }
        if (data.type === 'mesh-peers') {
            data.peers.forEach(pid => {
                if (pid !== state.peer.id && !state.peers[pid]) connectToPeer(pid);
            });
        }

        if (data.type === 'sp-sync') {
            Spotify.handleSyncCommand(data.action, data);
        }
        if (data.type === 'sp-ready') {
            console.log("Kullanıcı Spotify'a hazır:", conn.peer);
        }
        if (data.type === 'sp-premium-status') {
            const peerName = state.peers[conn.peer]?.name || "Bilinmeyen";
            Spotify.handlePremiumStatus(conn.peer, peerName, data.isPremium);
        }
    });

    conn.on('close', () => removePeer(conn.peer));
    conn.on('error', () => removePeer(conn.peer));
}

export function closeAllConnections() {
    // Aktif bağlantıları kapat
    Object.keys(state.peers).forEach(k => {
        if(state.peers[k].call) state.peers[k].call.close();
        if(state.peers[k].conn) state.peers[k].conn.close();
    });
    
    // Listeyi sıfırla
    state.peers = {};
    state.participantList = [];
    state.lastHeartbeat = {};
}

export function sendSpotifyCommand(action, uri, position = 0, name = "", artist = "", albumArt = "") {
    const data = {
        type: 'sp-sync',
        action: action,
        uri: uri,
        position: position,
        name: name,
        artist: artist,
        albumArt: albumArt, // Yeni parametre
        timestamp: Date.now()
    };
    
    // Önce kendimiz uygulayalım
    Spotify.handleSyncCommand(action, data);
    
    // Sonra herkese gönderelim
    broadcastData(data);
}

export function sendSpotifyStatus(status) {
    broadcastData({ type: 'sp-ready', status: status });
}

export function sendSpotifyPremiumStatus(isPremium) {
    broadcastData({ 
        type: 'sp-premium-status', 
        isPremium: isPremium,
        name: state.myUsername
    });
}