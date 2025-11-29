import { state } from './state.js';
import { updateMyId, updateRoomId, addVideoCard, removeVideoCard, updateParticipantsUI, updateNameTag, showCallScreen } from './ui.js';

export function initPeer() {
    const myId = Math.random().toString(36).substr(2, 5).toUpperCase();
    state.peer = new Peer(myId);

    state.peer.on('open', (id) => {
        updateMyId(id);
        // HOST İÇİN ODA ID GÜNCELLE
        updateRoomId(id);
        
        state.participantList = [{ id: id, name: state.myUsername, isMe: true }];
        updateParticipantsUI();
        startHeartbeat();
    });

    state.peer.on('call', (call) => {
        const isScreen = (call.metadata && call.metadata.type === 'screen');
        if (isScreen) { call.answer(); handleScreenCall(call); }
        else { call.answer(state.localStream); handleCall(call); }
    });

    state.peer.on('connection', (conn) => setupDataConnection(conn));
}

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

export function connectToPeer(remoteId) {
    if (!remoteId) { alert("ID Giriniz!"); return; }
    if (state.peers[remoteId]) return;

    // CLIENT İÇİN ODA ID GÜNCELLE
    updateRoomId(remoteId);

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
        if (data.type === 'heartbeat') {
            state.lastHeartbeat[conn.peer] = Date.now();
            return;
        }
        if (data.type === 'name') {
            if (state.peers[conn.peer]) {
                state.peers[conn.peer].name = data.name;
                state.peers[conn.peer].conn = conn; 
                updateNameTag(conn.peer, data.name);
                broadcastParticipants();
                // ÖNEMLİ: İsim aldık, biz de gönderelim (Reply)
                conn.send({ type: 'name-reply', name: state.myUsername });
            }
        }
        // İsim Cevabı (Reply) gelince de güncelle
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