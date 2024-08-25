const socket = io(); // Hubungkan ke server

const chatMessagesElement = document.getElementById('chatMessages');
const userLikesElement = document.getElementById('userLikes');
const userGiftsElement = document.getElementById('userGifts');
const userSharesElement = document.getElementById('userShares');
const profileContainer = document.getElementById('profileContainer'); // Kontainer untuk foto profil melayang
const overlayContent = document.getElementById('overlayContent'); // Kontainer untuk overlay

const profileImages = {}; // Menyimpan elemen gambar profil berdasarkan username

// Variabel untuk melacak status koneksi
let isConnected = true;
let reconnectInterval;

// Fungsi untuk menambahkan pesan chat
function addChatMessage(chatMessage) {
    const messageElement = document.createElement('div');
    messageElement.innerHTML = `<strong>${chatMessage.username}</strong>: ${chatMessage.message}`;
    if (chatMessage.profilePictureUrl) {
        const img = document.createElement('img');
        img.src = chatMessage.profilePictureUrl;
        img.width = 30;
        img.height = 30;
        messageElement.prepend(img);
    }
    chatMessagesElement.appendChild(messageElement);
}

// Fungsi untuk menampilkan foto profil dengan ukuran tertentu
function displayProfilePicture(userProfile, sizeMultiplier = 1) {
    const img = document.createElement('img');
    img.src = userProfile.profilePictureUrl;
    img.className = 'profile-pic';
    img.style.width = `${50 * sizeMultiplier}px`; // Ukuran berdasarkan multiplier
    img.style.height = `${50 * sizeMultiplier}px`; // Ukuran berdasarkan multiplier
    img.style.top = `${Math.random() * 100}vh`; // Posisi random vertikal
    img.style.left = `${Math.random() * 100}vw`; // Posisi random horizontal
    img.style.transition = 'top 5s linear, left 5s linear'; // Smooth transition untuk animasi
    profileContainer.appendChild(img);

    // Menambahkan animasi pergerakan acak
    setInterval(() => {
        img.style.top = `${Math.random() * 100}vh`;
        img.style.left = `${Math.random() * 100}vw`;
    }, 5000); // Ubah posisi setiap 5 detik

    // Menghapus gambar setelah 30 detik
    setTimeout(() => {
        img.remove();
    }, 30000); // 30 detik
}

// Fungsi untuk memperbarui ukuran gambar profil
function updateProfilePicture(userProfile, giftCount) {
    const img = profileContainer.querySelector(`img[src="${userProfile.profilePictureUrl}"]`);
    if (img) {
        const sizeMultiplier = getSizeMultiplier(giftCount); // Mendapatkan multiplier berdasarkan jumlah hadiah
        img.style.width = `${50 * sizeMultiplier}px`; // Ukuran berdasarkan multiplier
        img.style.height = `${50 * sizeMultiplier}px`; // Ukuran berdasarkan multiplier
    }
}

// Fungsi untuk mendapatkan multiplier ukuran berdasarkan jumlah hadiah
function getSizeMultiplier(giftCount) {
    if (giftCount >= 30 && giftCount <= 500) return 10;
    if (giftCount >= 20) return 7;
    if (giftCount >= 10) return 5;
    if (giftCount >= 5) return 2;
    return 1;
}

// Fungsi untuk menampilkan aksi pengguna (like, share)
function displayUserAction(action, userProfile) {
    displayProfilePicture(userProfile);
}

// Fungsi untuk mengirim aksi pemain
function sendPlayerAction(action, value) {
    socket.emit('playerAction', { action, value });
}

// Fungsi untuk memperbarui overlay dari URL
function updateOverlay(overlayURLs) {
    // Kosongkan konten overlay
    overlayContent.innerHTML = '';
    
    overlayURLs.forEach(url => {
        const overlayItem = document.createElement('div');
        overlayItem.classList.add('overlayItem');

        let element;
        if (url.endsWith('.jpg') || url.endsWith('.png')) {
            element = document.createElement('img');
            element.src = url;
        } else if (url.endsWith('.mp4')) {
            element = document.createElement('video');
            element.src = url;
            element.controls = true;
        } else if (url.endsWith('.mp3')) {
            element = document.createElement('audio');
            element.src = url;
            element.controls = true;
        }
        if (element) {
            overlayItem.appendChild(element);
            overlayContent.appendChild(overlayItem);
        }
    });
}

// Fungsi untuk menghubungkan ke TikTok live
function connectToTikTokLive(username) {
    socket.emit('connectTikTokLive', username);
}

// Menangani status koneksi WebSocket
socket.on('connect', () => {
    isConnected = true;
    clearInterval(reconnectInterval); // Hentikan interval jika koneksi berhasil
    console.log('Connected to server');
});

socket.on('disconnect', () => {
    isConnected = false;
    console.log('Disconnected from server');
    // Mulai interval untuk mencoba reconnect
    reconnectInterval = setInterval(() => {
        if (!isConnected) {
            console.log('Attempting to reconnect...');
            socket.connect();
        }
    }, 5000); // Coba reconnect setiap 5 detik
});

// Event listeners untuk menerima data dari server
socket.on('chatMessage', (chatMessage) => {
    addChatMessage(chatMessage);
});

socket.on('userJoined', (userProfile) => {
    displayProfilePicture(userProfile);
});

socket.on('userGift', (giftInfo) => {
    const sizeMultiplier = getSizeMultiplier(giftInfo.giftCount); // Mendapatkan multiplier ukuran
    displayProfilePicture(giftInfo, sizeMultiplier);
    updateProfilePicture(giftInfo, giftInfo.giftCount);
});

socket.on('userLike', (likeInfo) => {
    displayUserAction('like', likeInfo);
});

socket.on('userShare', (shareInfo) => {
    displayUserAction('share', shareInfo);
});

// Event listener untuk memperbarui overlay dari URL
socket.on('updateOverlay', (overlayURLs) => {
    updateOverlay(overlayURLs);
});

// Event listener untuk tombol pengaturan
document.getElementById('settingsButton').addEventListener('click', () => {
    document.getElementById('popupOverlay').style.display = 'block';
    document.getElementById('settingsPopup').style.display = 'block';
});

// Event listener untuk tombol Connect TikTok
document.getElementById('connectTikTokButton').addEventListener('click', () => {
    const username = document.getElementById('tiktokUsername').value;
    console.log('Connecting to TikTok live with username:', username); // Debug log
    connectToTikTokLive(username);
    document.getElementById('closePopupButton').click(); // Tutup popup setelah menghubungkan
});

// Event listener untuk tombol Close popup
document.getElementById('closePopupButton').addEventListener('click', () => {
    document.getElementById('popupOverlay').style.display = 'none';
    document.getElementById('settingsPopup').style.display = 'none';
});

// Event listener untuk tombol score
document.getElementById('scoreButton').addEventListener('click', () => {
    sendPlayerAction('score', 10); // Misalnya, tambahkan 10 poin
});
