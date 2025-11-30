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

    videoResolution: 1280,
    videoFPS: 30,

    // YouTube State
    youtubePlayer: null,
    isYoutubeOpen: false
};