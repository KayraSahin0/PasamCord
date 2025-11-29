export const state = {
    myUsername: "Misafir",
    localStream: null,
    localScreenStream: null,
    peer: null,
    peers: {}, 
    
    // YENİ: Her kullanıcının son "kalp atışı" zamanını tutar
    lastHeartbeat: {}, 

    participantList: [],

    audioContext: null,
    gainNode: null,
    micSource: null,
    audioDestination: null,

    isMuted: false,
    isCameraOff: true,
    isDeafened: false,
    isScreenSharing: false,
    isMirrored: true
};