export const state = {
    myUsername: "Misafir",
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
    isMirrored: true,

    // Yeni Kalite Ayarları
    videoResolution: 1280, // Varsayılan HD Ready
    videoFPS: 30
};