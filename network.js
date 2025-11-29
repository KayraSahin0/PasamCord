import { state } from './state.js';
import { updateMyId, addVideoCard, removeVideoCard, updateParticipantsUI, updateNameTag, showCallScreen } from './ui.js';

export function initPeer() {
    const myId = Math.random().toString(36).substr(2, 5).toUpperCase();
    state.peer = new Peer(myId);

    state.peer.on('open', (id) => {
        updateMyId(id);
        state.participantList = [{ id: id, name: state.myUsername, isMe: true }];
        updateParticipantsUI();
    });

    // GELEN ARAMA
    state.peer.on('call', (call) => {
        // Ekran mı Kamera mı?
        const isScreen = (call.metadata && call.metadata.type === 'screen');

        if (isScreen) {
            call.answer(); // Ekranı sadece izle
            handleScreenCall(call);
        } else {
            call.answer(state.localStream);
            handleCall(call);
        }
    });

    state.peer.on('connection', (conn) => setupDataConnection(conn));
}

// BİR KİŞİYE BAĞLANMA (Normal Kamera)
export function connectToPeer(remoteId) {
    if (!remoteId) { alert("ID Giriniz!"); return; }
    if (state.peers[remoteId]) return; // Zaten bağlıysak geç

    const call = state.peer.call(remoteId, state.localStream, { metadata: { type: 'camera' } });
    const conn = state.peer.connect(remoteId);
    
    setupDataConnection(conn);
    handleCall(call, conn);
}

// EKRAN PAYLAŞIMI: HERKESE GÖNDER
export function shareScreenToAll() {
    if (!state.localScreenStream) return;
    Object.keys(state.peers).forEach(peerId => {
        shareScreenToPeer(peerId);
    });
}

export function shareScreenToPeer(peerId) {
    if (!state.localScreenStream) return;
    state.peer.call(peerId, state.localScreenStream, { 
        metadata: { type: 'screen', name: state.myUsername } 
    });
}

// EKRAN ARAMASINI KARŞILAMA
function handleScreenCall(call) {
    const peerId = call.peer;
    // İsim metadatadan veya listeden
    const name = (call.metadata && call.metadata.name) 
                 ? call.metadata.name 
                 : (state.peers[peerId]?.name || "Bilinmeyen");

    call.on('stream', (remoteStream) => {
        addVideoCard(peerId, remoteStream, name, false, true);
    });
    call.on('close', () => removeVideoCard(peerId, true));
    call.on('error', () => removeVideoCard(peerId, true));
}

// NORMAL ARAMA KARŞILAMA
function handleCall(call, conn = null) {
    const peerId = call.peer;
    showCallScreen();

    if (!conn) {
        const backConn = state.peer.connect(peerId);
        backConn.on('open', () => {
            backConn.send({ type: 'name', name: state.myUsername });
        });
        setupDataConnection(backConn);
    }

    state.peers[peerId] = { call: call, name: "Bağlanıyor...", id: peerId, conn: conn };
    broadcastParticipants();

    // Eğer şu an ekran paylaşıyorsak, yeni gelene de gönder
    if (state.isScreenSharing) {
        shareScreenToPeer(peerId);
    }

    call.on('stream', (remoteStream) => {
        addVideoCard(peerId, remoteStream, state.peers[peerId].name, false, false);
    });

    call.on('close', () => removePeer(peerId));
    call.on('error', () => removePeer(peerId));
}

function removePeer(peerId) {
    if (state.peers[peerId]) delete state.peers[peerId];
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
        // Mesh: Yeni gelene odadaki diğerlerini bildir
        if (Object.keys(state.peers).length > 0) {
            const connectedPeers = Object.keys(state.peers);
            conn.send({ type: 'mesh-peers', peers: connectedPeers });
        }
    });

    conn.on('data', (data) => {
        if (data.type === 'name') {
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
                if (pid !== state.peer.id && !state.peers[pid]) {
                    connectToPeer(pid);
                }
            });
        }
    });
}

export function closeAllConnections() {
    Object.keys(state.peers).forEach(k => state.peers[k].call.close());
}