const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { ExpressPeerServer } = require('peer');

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

// PeerJS server
const peerServer = ExpressPeerServer(server, {
  debug: true,
  path: '/peerjs'
});

app.use('/peerjs', peerServer);
app.use(express.static('public'));

// In-memory storage
const rooms = {}; // roomId -> { users: [], queue: [], currentSong: null, isPlaying: false, messages: [] }
const users = {}; // socketId -> { username, roomId }

// Generate random 5-character room ID
function generateRoomId() {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let result = '';
  for (let i = 0; i < 5; i++) {
    result += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return result;
}

// Socket.io connection handling
io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  // Join room
  socket.on('join-room', ({ username, roomId, isNewRoom }) => {
    // Validate username
    if (!username || username.trim().length === 0) {
      socket.emit('error', { message: 'Kullanıcı adı gereklidir' });
      return;
    }

    // Create room if new
    if (isNewRoom) {
      if (!rooms[roomId]) {
        rooms[roomId] = {
          users: [],
          queue: [],
          currentSong: null,
          isPlaying: false,
          messages: []
        };
      }
    }

    // Check if room exists
    if (!rooms[roomId]) {
      socket.emit('error', { message: 'Oda bulunamadı. Lütfen geçerli bir oda kodu girin.' });
      return;
    }

    // Check room capacity (max 4 users)
    if (rooms[roomId].users.length >= 4) {
      socket.emit('error', { message: 'Oda dolu (maksimum 4 kullanıcı)' });
      return;
    }

    // Leave previous room if any
    if (users[socket.id] && users[socket.id].roomId) {
      const oldRoomId = users[socket.id].roomId;
      rooms[oldRoomId].users = rooms[oldRoomId].users.filter(u => u.socketId !== socket.id);
      socket.leave(oldRoomId);
      io.to(oldRoomId).emit('user-left', { socketId: socket.id, username: users[socket.id].username });
    }

    // Join new room
    socket.join(roomId);
    users[socket.id] = { username: username.trim(), roomId, peerId: null };
    rooms[roomId].users.push({ socketId: socket.id, username: username.trim(), peerId: null });

    // Notify user of successful join
    socket.emit('room-joined', {
      roomId,
      users: rooms[roomId].users.map(u => ({ socketId: u.socketId, username: u.username, peerId: u.peerId })),
      queue: rooms[roomId].queue,
      currentSong: rooms[roomId].currentSong,
      isPlaying: rooms[roomId].isPlaying,
      messages: rooms[roomId].messages
    });

    // Notify others in room
    socket.to(roomId).emit('user-joined', {
      socketId: socket.id,
      username: username.trim(),
      peerId: null // Will be updated when peer ID is received
    });

    console.log(`${username} joined room ${roomId}`);
  });

  // Receive peer ID from client
  socket.on('peer-id', ({ peerId }) => {
    if (users[socket.id]) {
      users[socket.id].peerId = peerId;
      const room = rooms[users[socket.id].roomId];
      if (room) {
        const user = room.users.find(u => u.socketId === socket.id);
        if (user) {
          user.peerId = peerId;
          // Notify all users in room about the new peer ID
          io.to(users[socket.id].roomId).emit('peer-id-received', {
            socketId: socket.id,
            peerId: peerId,
            username: users[socket.id].username
          });
        }
      }
    }
  });

  // Create room
  socket.on('create-room', ({ username }) => {
    const roomId = generateRoomId();
    // Create the room immediately
    if (!rooms[roomId]) {
      rooms[roomId] = {
        users: [],
        queue: [],
        currentSong: null,
        isPlaying: false,
        messages: []
      };
    }
    socket.emit('room-created', { roomId });
  });

  // Chat message
  socket.on('chat-message', ({ message }) => {
    const user = users[socket.id];
    if (!user || !user.roomId) return;

    const room = rooms[user.roomId];
    if (!room) return;

    const chatMessage = {
      username: user.username,
      message: message.trim(),
      timestamp: Date.now()
    };

    room.messages.push(chatMessage);
    io.to(user.roomId).emit('chat-message', chatMessage);
  });

  // Music queue management
  socket.on('add-song', ({ source, id, title }) => {
    const user = users[socket.id];
    if (!user || !user.roomId) return;

    const room = rooms[user.roomId];
    if (!room) return;

    const song = { source, id, title, addedBy: user.username };

    if (!room.isPlaying) {
      // Start playing immediately
      room.currentSong = song;
      room.isPlaying = true;
      io.to(user.roomId).emit('play-song', song);
    } else {
      // Add to queue
      room.queue.push(song);
      io.to(user.roomId).emit('update-queue', { queue: room.queue });
    }
  });

  // Song ended
  socket.on('song-ended', () => {
    const user = users[socket.id];
    if (!user || !user.roomId) return;

    const room = rooms[user.roomId];
    if (!room) return;

    if (room.queue.length > 0) {
      // Play next song from queue
      room.currentSong = room.queue.shift();
      room.isPlaying = true;
      io.to(user.roomId).emit('play-song', room.currentSong);
      io.to(user.roomId).emit('update-queue', { queue: room.queue });
    } else {
      // Queue is empty
      room.currentSong = null;
      room.isPlaying = false;
      io.to(user.roomId).emit('queue-empty');
    }
  });

  // Skip song
  socket.on('skip-song', () => {
    const user = users[socket.id];
    if (!user || !user.roomId) return;

    const room = rooms[user.roomId];
    if (!room) return;

    if (room.queue.length > 0) {
      room.currentSong = room.queue.shift();
      room.isPlaying = true;
      io.to(user.roomId).emit('play-song', room.currentSong);
      io.to(user.roomId).emit('update-queue', { queue: room.queue });
    } else {
      room.currentSong = null;
      room.isPlaying = false;
      io.to(user.roomId).emit('play-song', null); // Stop playback
      io.to(user.roomId).emit('queue-empty');
    }
  });

  // Disconnect
  socket.on('disconnect', () => {
    const user = users[socket.id];
    if (user && user.roomId) {
      const room = rooms[user.roomId];
      if (room) {
        room.users = room.users.filter(u => u.socketId !== socket.id);
        io.to(user.roomId).emit('user-left', { socketId: socket.id, username: user.username });

        // Clean up empty rooms
        if (room.users.length === 0) {
          delete rooms[user.roomId];
          console.log(`Room ${user.roomId} deleted (empty)`);
        }
      }
    }
    delete users[socket.id];
    console.log('User disconnected:', socket.id);
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});


