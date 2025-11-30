export const state = {
    myUsername: "Misafir",
    // YENİ: Kullanıcı Profil Bilgileri (Avatar vb.)
    userProfile: null, 

    localStream: null,
    localScreenStream: null,
    peer: null,
    peers: {}, 
    
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