const socket = io(); // Hubungkan ke server

const chatMessagesElement = document.getElementById('chatMessages');
const profileContainer = document.getElementById('profileContainer'); // Kontainer untuk foto profil melayang
const overlayContent = document.getElementById('overlayContent'); // Kontainer untuk overlay

// Fungsi untuk menambahkan pesan chat ke layar
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

// Fungsi untuk menampilkan foto profil melayang di layar
function displayProfilePicture(userProfile) {
    const img = document.createElement('img');
    img.src = userProfile.profilePictureUrl;
    img.className = 'profile-pic';
    img.style.width = '50px'; // Ukuran default
    img.style.height = '50px'; // Ukuran default
    img.style.top = `${Math.random() * 100}vh`; // Posisi random vertikal
    img.style.left = `${Math.random() * 100}vw`; // Posisi random horizontal
    img.style.transition = 'top 5s linear, left 5s linear'; // Smooth transition untuk animasi
    profileContainer.appendChild(img);

    // Animasi pergerakan acak
    setInterval(() => {
        img.style.top = `${Math.random() * 100}vh`;
        img.style.left = `${Math.random() * 100}vw`;
    }, 5000); // Ubah posisi setiap 5 detik

    // Menghapus gambar setelah 30 detik
    setTimeout(() => {
        img.remove();
    }, 30000);
}

// Fungsi untuk memperbarui ukuran gambar profil berdasarkan jumlah gift
function updateProfilePicture(userProfile, giftCount) {
    const img = profileContainer.querySelector(`img[src="${userProfile.profilePictureUrl}"]`);
    if (img) {
        let size;
        if (giftCount <= 5) {
            size = 50 * 2; // Ukuran 2 kali lipat
        } else if (giftCount <= 10) {
            size = 50 * 5; // Ukuran 5 kali lipat
        } else if (giftCount <= 20) {
            size = 50 * 7; // Ukuran 7 kali lipat
        } else if (giftCount <= 500) {
            size = 50 * 10; // Ukuran 10 kali lipat
        } else {
            size = 50 * 10; // Ukuran maksimum tetap 10 kali lipat
        }
        img.style.width = `${size}px`;
        img.style.height = `${size}px`;
    }
}

// Fungsi untuk menampilkan aksi pengguna berdasarkan jenisnya
function displayUserAction(action, userProfile) {
    displayProfilePicture(userProfile);
}

// Fungsi untuk mengirim tindakan pengguna ke server
function sendPlayerAction(action, value) {
    socket.emit('playerAction', { action, value });
}

// Fungsi untuk memperbarui konten overlay berdasarkan URL yang diterima
function updateOverlay(overlayURLs) {
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
            element.addEventListener('error', () => {
                console.error(`Failed to load audio: ${url}`);
            });
        }
        if (element) {
            overlayItem.appendChild(element);
            overlayContent.appendChild(overlayItem);
        }
    });
}

// Event listeners untuk menerima data dari server
socket.on('chatMessage', (chatMessage) => {
    addChatMessage(chatMessage);
});

socket.on('userJoined', (userProfile) => {
    displayProfilePicture(userProfile);
});

socket.on('userGift', (giftInfo) => {
    updateProfilePicture(giftInfo, giftInfo.giftCount);
    displayUserAction('gift', giftInfo);
});

socket.on('userLike', (likeInfo) => {
    displayUserAction('like', likeInfo);
});

socket.on('userShare', (shareInfo) => {
    displayUserAction('share', shareInfo);
});

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

function connectToTikTokLive(username) {
    socket.emit('connectTikTokLive', username);
}

// Event listener untuk tombol Close popup
document.getElementById('closePopupButton').addEventListener('click', () => {
    document.getElementById('popupOverlay').style.display = 'none';
    document.getElementById('settingsPopup').style.display = 'none';
});

// Event listener untuk tombol score
document.getElementById('scoreButton').addEventListener('click', () => {
    sendPlayerAction('score', 10); // Misalnya, tambahkan 10 poin
});
