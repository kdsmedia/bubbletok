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

// Define the path to your MP3 files
const audioFiles = {
    userJoin: '/assets/audio/hallo-gaes.mp3',
    gifts: {
        "Heart Me": 'assets/audio/dry-fart.mp3',
        "Blow a kiss": 'assets/audio/anjayhaha.mp3',
        "Team Bracelet": 'assets/audio/anjayhaha.mp3',
        "Perfume": 'assets/audio/ampun-dijee.mp3',
        "Rose": 'assets/audio/dry-fart.mp3',
        "I love you": 'assets/audio/yippeeeeeeeeeeeeee.mp3'
    },
    share: 'assets/audio/ack.mp3',
    follow: 'assets/audio/huh_37bAoRo.mp3'
};

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

            // Kirim perintah untuk memutar file audio saat menerima like
            io.emit('triggerAction', { action: 'playSound', details: { soundUrl: audioFiles.gifts['Heart Me'] } });
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

            let soundFile = '';

            switch (giftInfo.giftName) {
                case 'Heart Me':
                    soundFile = audioFiles.gifts['Heart Me'];
                    break;
                case 'Blow a kiss':
                case 'Team Bracelet':
                    soundFile = audioFiles.gifts['Blow a kiss'];
                    break;
                case 'Perfume':
                    soundFile = audioFiles.gifts['Perfume'];
                    break;
                case 'Rose':
                    soundFile = audioFiles.gifts['Rose'];
                    break;
                case 'I love you':
                    soundFile = audioFiles.gifts['I love you'];
                    break;
                default:
                    soundFile = ''; // Tidak ada audio jika gift tidak sesuai
                    break;
            }

            if (soundFile) {
                io.emit('triggerAction', { action: 'playSound', details: { soundUrl: soundFile } });
            }

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

            // Kirim perintah untuk memutar file audio saat pengguna baru bergabung
            io.emit('triggerAction', { action: 'playSound', details: { soundUrl: audioFiles.userJoin } });
        });

        // Event listener for shares
        tiktokConnection.on('share', (data) => {
            console.log('TikTok share received:', data);
            const shareInfo = {
                userId: data.userId,
                username: data.uniqueId,
                profilePictureUrl: data.profilePictureUrl,
                shareCount: data.shareCount // Jumlah share yang dilakukan
            };
            io.emit('triggerAction', { action: 'playSound', details: { soundUrl: audioFiles.share } });
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
