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
let activeProfilePictures = {}; // Menyimpan gambar profil yang aktif

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

// Fungsi untuk menentukan ukuran gambar profil berdasarkan jumlah koin
function getProfilePictureSize(coinCount) {
    if (coinCount >= 30 && coinCount <= 500) {
        return 10; // Ukuran 10x
    } else if (coinCount === 20) {
        return 7; // Ukuran 7x
    } else if (coinCount === 10) {
        return 5; // Ukuran 5x
    } else if (coinCount >= 1 && coinCount <= 5) {
        return 2; // Ukuran 2x
    } else {
        return 1; // Ukuran default (tanpa pembesaran)
    }
}

// Fungsi untuk menghapus gambar profil dari semua pengguna
function removeAllProfilePictures() {
    io.emit('removeProfilePictures');
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

        console.log(`Terhubung ke TikTok Live stream untuk pengguna: ${username}`);

        // Menyimpan Room ID jika tersedia
        roomId = tiktokConnection.roomId || 'Unknown'; // Ganti ini jika library memberikan Room ID

        console.log('Room ID:', roomId);
        io.emit('roomId', roomId);

        // Event listener untuk pesan chat
        tiktokConnection.on('chat', (data) => {
            console.log('Pesan chat TikTok diterima:', data);
            const chatMessage = {
                username: data.uniqueId,
                message: data.comment,
                profilePictureUrl: data.profilePictureUrl // URL gambar profil pengguna
            };
            io.emit('chatMessage', chatMessage);
        });

        // Event listener untuk likes
        tiktokConnection.on('like', (data) => {
            console.log('Like TikTok diterima:', data);
            const likeInfo = {
                userId: data.userId,
                username: data.uniqueId,
                profilePictureUrl: data.profilePictureUrl,
                likesCount: data.likesCount // Jumlah likes yang diterima
            };
            updateUserLikes(data.uniqueId, data.likesCount); // Update jumlah likes per pengguna
            io.emit('userLike', likeInfo);

            // Jadwalkan penghapusan foto profil setelah 30 detik
            setTimeout(() => {
                removeAllProfilePictures();
            }, 30000); // 30 detik
        });

        // Event listener untuk hadiah
        tiktokConnection.on('gift', (data) => {
            console.log('Hadiah TikTok diterima:', data);
            const giftSize = getProfilePictureSize(data.giftCount);
            const giftInfo = {
                userId: data.userId,
                username: data.uniqueId,
                profilePictureUrl: data.profilePictureUrl,
                giftName: data.giftName,
                giftCount: data.giftCount, // Jumlah hadiah yang diberikan
                giftType: data.giftType, // Jenis hadiah
                size: giftSize // Skala ukuran foto profil
            };
            io.emit('userGift', giftInfo);

            // Jadwalkan penghapusan foto profil setelah 30 detik
            setTimeout(() => {
                removeAllProfilePictures();
            }, 30000); // 30 detik
        });

        // Event listener untuk anggota baru yang bergabung
        tiktokConnection.on('member', (data) => {
            const userProfile = {
                username: data.uniqueId,
                nickname: data.nickname,
                profilePictureUrl: data.profilePictureUrl // URL gambar profil pengguna
            };
            console.log('Pengguna bergabung dengan TikTok Live:', userProfile);
            io.emit('userJoined', userProfile);

            // Inisialisasi jumlah likes untuk pengguna baru
            if (!userLikes[userProfile.username]) {
                userLikes[userProfile.username] = 0;
            }

            // Kirim update likes per pengguna ke klien baru
            io.emit('userLikesUpdate', userLikes);
        });

        // Event listener untuk shares (jika tersedia)
        tiktokConnection.on('share', (data) => {
            console.log('Share TikTok diterima:', data);
            const shareInfo = {
                userId: data.userId,
                username: data.uniqueId,
                profilePictureUrl: data.profilePictureUrl,
                shareCount: data.shareCount // Jumlah share yang dilakukan
            };
            io.emit('userShare', shareInfo);
        });

    } catch (error) {
        console.error('Gagal terhubung ke TikTok Live:', error);
    }
}

// Set up koneksi socket untuk permainan
io.on('connection', (socket) => {
    console.log('Seorang pengguna terhubung:', socket.id);

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
        console.log('Aksi pemain diterima:', data);
        
        if (data.action === 'score') {
            players[socket.id].score += data.value || 1;
            updateLeaderboard();
        }

        socket.broadcast.emit('updateGame', data);
    });

    // Terima input username TikTok untuk koneksi live stream
    socket.on('connectTikTokLive', async (username) => {
        console.log('Menghubungkan ke TikTok Live untuk username:', username);
        await connectTikTokWebSocket(username);
    });

    // Handle disconnection
    socket.on('disconnect', () => {
        console.log('Seorang pengguna terputus:', socket.id);

        // Hapus pemain dari daftar pemain
        delete players[socket.id];
        updateLeaderboard();
    });
});

// Mulai server
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
    console.log(`Server berjalan di port ${PORT}`);
});
