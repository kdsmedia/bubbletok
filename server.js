const express = require('express');
const http = require('http');
const socketIo = require('socket.io');
const { WebcastPushConnection } = require('tiktok-live-connector'); // Import library

const app = express();
const server = http.createServer(app);
const io = socketIo(server);

let players = {};
let leaderboard = [];
let tiktokConnection = null;
let roomId = null; // Menyimpan Room ID
let userLikes = {}; // Menyimpan jumlah likes per pengguna

// Menyajikan file statis dari direktori 'public'
app.use(express.static('public'));

// Fungsi untuk mengupdate leaderboard
function updateLeaderboard() {
    leaderboard = Object.values(players).sort((a, b) => b.score - a.score);
    io.emit('leaderboardUpdate', leaderboard);
}

// Fungsi untuk mengupdate jumlah likes per pengguna
function updateUserLikes(username, likeCount) {
    if (!userLikes[username]) {
        userLikes[username] = 0;
    }
    userLikes[username] += likeCount;
    io.emit('userLikesUpdate', userLikes);
}

// Fungsi untuk memulai koneksi TikTok Live berdasarkan username
async function connectTikTokWebSocket(username) {
    // Inisialisasi koneksi baru jika belum ada
    if (!tiktokConnection) {
        tiktokConnection = new WebcastPushConnection(username);
    }

    // Connect to TikTok Live
    try {
        await tiktokConnection.connect();

        console.log(`Connected to TikTok Live stream for user: ${username}`);

        // Menyimpan Room ID jika tersedia
        roomId = tiktokConnection.roomId || 'Unknown'; // Ganti ini jika library memberikan Room ID

        console.log('Room ID:', roomId);
        io.emit('roomId', roomId);

        // Event listener for chat messages
        tiktokConnection.on('chat', (data) => {
            console.log('TikTok chat message received:', data);
            const chatMessage = {
                username: data.uniqueId,
                message: data.comment,
                profilePictureUrl: data.profilePictureUrl // URL gambar profil pengguna
            };
            io.emit('chatMessage', chatMessage);
        });

        // Event listener for likes
        tiktokConnection.on('like', (data) => {
            console.log('TikTok like received:', data);
            const likeInfo = {
                userId: data.userId,
                username: data.uniqueId,
                profilePictureUrl: data.profilePictureUrl,
                likesCount: data.likesCount // Jumlah likes yang diterima
            };
            updateUserLikes(data.uniqueId, data.likesCount); // Update jumlah likes per pengguna
            io.emit('userLike', likeInfo);
        });

        // Event listener for gifts
        tiktokConnection.on('gift', (data) => {
            console.log('TikTok gift received:', data);
            const giftInfo = {
                userId: data.userId,
                username: data.uniqueId,
                profilePictureUrl: data.profilePictureUrl,
                giftName: data.giftName,
                giftCount: data.giftCount, // Jumlah hadiah yang diberikan
                giftType: data.giftType // Jenis hadiah
            };
            io.emit('userGift', giftInfo);
        });

        // Event listener for new members joining the live
        tiktokConnection.on('member', (data) => {
            const userProfile = {
                username: data.uniqueId,
                nickname: data.nickname,
                profilePictureUrl: data.profilePictureUrl // URL gambar profil pengguna
            };
            console.log('User joined the TikTok Live:', userProfile);
            io.emit('userJoined', userProfile);

            // Inisialisasi jumlah likes untuk pengguna baru
            if (!userLikes[userProfile.username]) {
                userLikes[userProfile.username] = 0;
            }

            // Kirim update likes per pengguna ke klien baru
            io.emit('userLikesUpdate', userLikes);
        });

        // Event listener for shares (if available)
        tiktokConnection.on('share', (data) => {
            console.log('TikTok share received:', data);
            const shareInfo = {
                userId: data.userId,
                username: data.uniqueId,
                profilePictureUrl: data.profilePictureUrl,
                shareCount: data.shareCount // Jumlah share yang dilakukan
            };
            io.emit('userShare', shareInfo);
        });

    } catch (error) {
        console.error('Failed to connect to TikTok Live:', error);
    }
}

// Set up a socket connection for game
io.on('connection', (socket) => {
    console.log('A user connected:', socket.id);

    // Tambahkan pemain baru ke dalam daftar pemain
    players[socket.id] = { id: socket.id, score: 0 };

    // Kirim data awal leaderboard kepada pemain baru
    socket.emit('leaderboardUpdate', leaderboard);

    // Kirim Room ID ke klien jika tersedia
    if (roomId) {
        socket.emit('roomId', roomId);
    }

    // Kirim jumlah likes per pengguna ke klien baru
    socket.emit('userLikesUpdate', userLikes);

    // Dengarkan aksi pemain
    socket.on('playerAction', (data) => {
        console.log('Player action received:', data);
        
        if (data.action === 'score') {
            players[socket.id].score += data.value || 1;
            updateLeaderboard();
        }

        socket.broadcast.emit('updateGame', data);
    });

    // Terima input username TikTok untuk koneksi live stream
    socket.on('connectTikTokLive', async (username) => {
        console.log('Connecting to TikTok Live for username:', username);
        await connectTikTokWebSocket(username);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('A user disconnected:', socket.id);

        // Hapus pemain dari daftar pemain
        delete players[socket.id];
        updateLeaderboard();
    });
});

// Mulai server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server is running on port ${PORT}`);
});
