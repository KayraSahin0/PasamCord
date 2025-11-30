import { state } from './state.js';
import { updateMyId, updateRoomId, addVideoCard, removeVideoCard, updateParticipantsUI, updateNameTag, showCallScreen, addMessageToUI, loadYouTubeVideoById, syncYouTubeAction } from './ui.js';

let connectionTimeout = null;

export function initPeer(customId = null) {
    const myId = customId || Math.random().toString(36).substr(2, 5).toUpperCase();
    
    if (state.peer) {
        state.peer.destroy();
        state.peer = null;
    }

    state.peer = new Peer(myId);

    if (connectionTimeout) clearTimeout(connectionTimeout);
    connectionTimeout = setTimeout(() => {
        if (state.peer && !state.peer.id) {
            state.peer.destroy();
            initPeer(null);
        }
    }, 5000);

    state.peer.on('open', (id) => {
        if (connectionTimeout) clearTimeout(connectionTimeout);
        updateMyId(id);
        
        if (customId) {
            updateRoomId(id);
            state.participantList = [{ id: id, name: state.myUsername, isMe: true }];
            updateParticipantsUI();
            startHeartbeat();
            showCallScreen();
        }
    });

    state.peer.on('error', (err) => {
        if (connectionTimeout) clearTimeout(connectionTimeout);
        if (err.type === 'unavailable-id') {
            alert("Bu Oda ID'si dolu!");
            initPeer(null);
        }
    });

    state.peer.on('call', (call) => {
        const isScreen = (call.metadata && call.metadata.type === 'screen');
        if (isScreen) { call.answer(); handleScreenCall(call); }
        else { call.answer(state.localStream); handleCall(call); }
    });

    state.peer.on('connection', (conn) => setupDataConnection(conn));
}

// --- AKILLI ODA ---
export function joinOrCreateRoom(roomId) {
    if (!roomId) { alert("Lütfen bir Oda Adı girin!"); return; }
    updateMyId("Bağlanılıyor...");

    const conn = state.peer.connect(roomId);
    let connected = false;

    conn.on('open', () => {
        connected = true;
        connectToPeer(roomId);
    });

    setTimeout(() => {
        if (!connected) {
            initPeer(roomId); // Host Ol
        }
    }, 2000);
}

export function connectToPeer(remoteId) {
    updateRoomId(remoteId);
    const call = state.peer.call(remoteId, state.localStream, { metadata: { type: 'camera' } });
    const conn = state.peer.connect(remoteId);
    setupDataConnection(conn);
    handleCall(call, conn);
}

// --- DATA GÖNDERİM ---
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

// --- HEARTBEAT (KOPMA YÖNETİMİ) ---
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

// --- YARDIMCILAR ---
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
    removeVideoCard(peerId, false);
    removeVideoCard(peerId, true);
    broadcastParticipants();
}

function broadcastParticipants() {
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
        if (Object.keys(state.peers).length > 0) {
            const connectedPeers = Object.keys(state.peers);
            conn.send({ type: 'mesh-peers', peers: connectedPeers });
        }
        state.lastHeartbeat[conn.peer] = Date.now();
    });

    conn.on('data', (data) => {
        if (data.type === 'heartbeat') { state.lastHeartbeat[conn.peer] = Date.now(); return; }
        
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
    });

    conn.on('close', () => removePeer(conn.peer));
    conn.on('error', () => removePeer(conn.peer));
}

export function closeAllConnections() {
    Object.keys(state.peers).forEach(k => {
        if(state.peers[k].call) state.peers[k].call.close();
        if(state.peers[k].conn) state.peers[k].conn.close();
    });
}