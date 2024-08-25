const socket = io(); // Hubungkan ke server

const chatMessagesElement = document.getElementById('chatMessages');
const userLikesElement = document.getElementById('userLikes');
const userGiftsElement = document.getElementById('userGifts');
const userSharesElement = document.getElementById('userShares');
const profileContainer = document.getElementById('profileContainer'); // Kontainer untuk foto profil melayang
const overlayContent = document.getElementById('overlayContent'); // Kontainer untuk overlay

const profileImages = {}; // Menyimpan elemen gambar profil berdasarkan username

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

function displayProfilePicture(userProfile) {
    const img = document.createElement('img');
    img.src = userProfile.profilePictureUrl;
    img.className = 'profile-pic';
    img.style.width = '50px'; // Ukuran default kecil
    img.style.height = '50px'; // Ukuran default kecil
    img.style.top = `${Math.random() * 100}vh`; // Posisi random vertikal
    img.style.left = `${Math.random() * 100}vw`; // Posisi random horizontal
    img.style.transition = 'top 5s linear, left 5s linear'; // Smooth transition untuk animasi
    profileContainer.appendChild(img);

    // Menambahkan animasi pergerakan acak
    setInterval(() => {
        img.style.top = `${Math.random() * 100}vh`;
        img.style.left = `${Math.random() * 100}vw`;
    }, 5000); // Ubah posisi setiap 5 detik
}

function updateProfilePicture(userProfile, giftCount) {
    const img = profileContainer.querySelector(`img[src="${userProfile.profilePictureUrl}"]`);
    if (img) {
        const size = Math.min(50 + giftCount * 10, 300); // Ukuran maksimum 300px
        img.style.width = `${size}px`;
        img.style.height = `${size}px`;
    }
}

function displayUserAction(action, userProfile) {
    displayProfilePicture(userProfile);
}

function sendPlayerAction(action, value) {
    socket.emit('playerAction', { action, value });
}

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
