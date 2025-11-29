// network.js
import { state } from './state.js';
import { updateMyId, addVideoCard, removeVideoCard, updateParticipantsUI, updateNameTag, showCallScreen } from './ui.js';

export function initPeer() {
    const myId = Math.random().toString(36).substr(2, 5).toUpperCase();
    state.peer = new Peer(myId);

    state.peer.on('open', (id) => {
        updateMyId(id);
        updateParticipantsUI();
    });

    // Biri bizi aradığında
    state.peer.on('call', (call) => {
        call.answer(state.localStream);
        handleCall(call);
    });

    // İsim verisi geldiğinde
    state.peer.on('connection', (conn) => {
        conn.on('data', (data) => {
            if (data.type === 'name' && state.peers[conn.peer]) {
                state.peers[conn.peer].name = data.name;
                updateNameTag(conn.peer, data.name);
                updateParticipantsUI();
            }
        });
    });
}

export function connectToPeer(remoteId) {
    if (!remoteId) { alert("ID Giriniz!"); return; }
    
    const call = state.peer.call(remoteId, state.localStream);
    const conn = state.peer.connect(remoteId);
    
    conn.on('open', () => {
        conn.send({ type: 'name', name: state.myUsername });
    });

    handleCall(call, conn);
}

function handleCall(call, conn = null) {
    const peerId = call.peer;
    showCallScreen();

    // Veri kanalı yoksa biz de bağlanalım (İsim göndermek için)
    if (!conn) {
        const backConn = state.peer.connect(peerId);
        backConn.on('open', () => {
            backConn.send({ type: 'name', name: state.myUsername });
        });
    }

    // Listeye ekle
    state.peers[peerId] = { call: call, name: "Bağlanıyor...", id: peerId };
    updateParticipantsUI();

    call.on('stream', (remoteStream) => {
        addVideoCard(peerId, remoteStream, state.peers[peerId].name, false);
    });

    call.on('close', () => removePeer(peerId));
    call.on('error', () => removePeer(peerId));
}

function removePeer(peerId) {
    if (state.peers[peerId]) delete state.peers[peerId];
    removeVideoCard(peerId);
    updateParticipantsUI();
}

export function closeAllConnections() {
    Object.keys(state.peers).forEach(k => state.peers[k].call.close());
}