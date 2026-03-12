// --- THEME SYSTEM ---
const themeToggle = document.getElementById("themeToggle");
if (localStorage.getItem("theme") === "light") {
    document.body.classList.add("light");
}
//T1
themeToggle.onclick = () => {
    document.body.classList.toggle("light");
    localStorage.setItem("theme", document.body.classList.contains("light") ? "light" : "dark");
};

// --- USERNAME SYSTEM ---
function saveUsername() {
    const username = document.getElementById("usernameInput").value.trim();
    const error = document.getElementById("userError");
    if (username.length < 3) {
        error.innerText = "Username must be at least 3 characters";
        return;
    }
    localStorage.setItem("username", username);
    document.getElementById("userSetup").style.display = "none";
    document.getElementById("transfer").classList.remove("hidden");
}

if (localStorage.getItem("username")) {
    document.getElementById("userSetup").style.display = "none";
    document.getElementById("transfer").classList.remove("hidden");
}

// --- FILE SYSTEM ---
const dropZone = document.getElementById("dropZone");
const fileInput = document.getElementById("fileInput");
const browseBtn = document.getElementById("browseBtn");
const fileCard = document.getElementById("fileCard");
let timerInterval;

browseBtn.onclick = () => fileInput.click();

dropZone.addEventListener("dragover", e => e.preventDefault());
dropZone.addEventListener("drop", e => {
    e.preventDefault();
    if (e.dataTransfer.files.length) handleFile(e.dataTransfer.files[0]);
});

fileInput.addEventListener("change", () => {
    if (fileInput.files.length) handleFile(fileInput.files[0]);
});

function handleFile(file) {
    // Hide drag area, show file card
    dropZone.style.display = "none";
    fileCard.classList.remove("hidden");

    document.getElementById("fileName").innerText = file.name;
    document.getElementById("fileSize").innerText = (file.size / 1024 / 1024).toFixed(2) + " MB";

    createRoom();
}

function createRoom() {
    const roomId = Math.random().toString(36).substring(2, 10);
    const link = window.location.origin + "?room=" + roomId;
    const expiry = Date.now() + 600000; // 10 minutes from now

    document.getElementById("shareLink").value = link;
    QRCode.toCanvas(document.getElementById("qr"), link);

    // SOCIAL SHARING LOGIC
    // We create a pre-filled message for the user to send
    const shareMsg = encodeURIComponent("Hey! Use this link to download my file on DropBeam: " + link);
    
    document.getElementById("whatsappShare").href = `https://wa.me/?text=${shareMsg}`;
    document.getElementById("gmailShare").href = `mailto:?subject=File Transfer&body=${shareMsg}`;
    document.getElementById("facebookShare").href = `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(link)}`;
    document.getElementById("linkedinShare").href = `https://www.linkedin.com/sharing/share-offsite/?url=${encodeURIComponent(link)}`;

    startTimer(expiry);
}

function startTimer(expiry) {
    const timerDisplay = document.getElementById("timer");
    clearInterval(timerInterval); // Reset any existing timer

    timerInterval = setInterval(() => {
        let remaining = expiry - Date.now();
        if (remaining <= 0) {
            timerDisplay.innerText = "Room expired";
            clearInterval(timerInterval);
            return;
        }
        let m = Math.floor(remaining / 60000);
        let s = Math.floor((remaining % 60000) / 1000);
        timerDisplay.innerText = `Expires in ${m}:${s.toString().padStart(2, '0')}`;
    }, 1000);
}


// --- MODE SWITCHING ---
function switchMode(mode) {
    const uploadBtn = document.getElementById("modeUpload");
    const peerBtn = document.getElementById("modePeer");
    const uploadCont = document.getElementById("uploadContainer");
    const peerCont = document.getElementById("peerContainer");

    if (mode === 'upload') {
        uploadBtn.classList.add("active");
        peerBtn.classList.remove("active");
        uploadCont.classList.remove("hidden");
        peerCont.classList.add("hidden");
    } else {
        peerBtn.classList.add("active");
        uploadBtn.classList.remove("active");
        peerCont.classList.remove("hidden");
        uploadCont.classList.add("hidden");
    }
}

// --- PEER TO PEER LOGIC ---
function initP2P(type) {
    const statusArea = document.getElementById("p2pStatus");
    const setupArea = document.querySelector(".peer-setup");
    const statusText = document.getElementById("statusText");
    const roomDisplay = document.getElementById("peerRoomDisplay");

    setupArea.classList.add("hidden");
    statusArea.classList.remove("hidden");

    if (type === 'create') {
        const roomId = Math.random().toString(36).substring(2, 7).toUpperCase();
        roomDisplay.innerText = "ROOM ID: " + roomId;
        statusText.innerText = "Give this ID to your friend...";
        
        // Note: In a real app, you would use PeerJS or Simple-Peer here
        console.log("Creating signaling room: " + roomId);
    } else {
        const joinId = document.getElementById("joinRoomId").value;
        if (!joinId) {
            alert("Please enter a room ID");
            setupArea.classList.remove("hidden");
            statusArea.classList.add("hidden");
            return;
        }
        statusText.innerText = "Connecting to " + joinId + "...";
    }
}

// --- PEER TO PEER NAVIGATION ---

function undoP2P() {
    const statusArea = document.getElementById("p2pStatus");
    const setupArea = document.querySelector(".peer-setup");
    const roomDisplay = document.getElementById("peerRoomDisplay");
    
    // Hide the status/loading area
    statusArea.classList.add("hidden");
    
    // Show the Create/Join options again
    setupArea.classList.remove("hidden");
    
    // Clear the room display text
    roomDisplay.innerText = "";
    
    // Logic: If you were connecting via a WebRTC library (like PeerJS), 
    // you would call peer.destroy() or connection.close() here.
    console.log("P2P connection attempt cancelled by user.");
}

// Ensure the initP2P function stays consistent
function initP2P(type) {
    const statusArea = document.getElementById("p2pStatus");
    const setupArea = document.querySelector(".peer-setup");
    const statusText = document.getElementById("statusText");
    const roomDisplay = document.getElementById("peerRoomDisplay");

    setupArea.classList.add("hidden");
    statusArea.classList.remove("hidden");

    if (type === 'create') {
        const roomId = Math.random().toString(36).substring(2, 7).toUpperCase();
        roomDisplay.innerText = "ROOM ID: " + roomId;
        statusText.innerText = "Give this ID to your friend...";
    } else {
        const joinId = document.getElementById("joinRoomId").value;
        if (!joinId) {
            alert("Please enter a room ID");
            undoP2P(); // Use our new undo function to reset the view
            return;
        }
        statusText.innerText = "Connecting to " + joinId + "...";
    }
}
// Update your cancelTransfer to reset P2P too
function cancelTransfer() {
    clearInterval(timerInterval);
    fileCard.classList.add("hidden");
    dropZone.style.display = "block";
    
    // Reset P2P View
    document.querySelector(".peer-setup").classList.remove("hidden");
    document.getElementById("p2pStatus").classList.add("hidden");
    
    fileInput.value = ""; 
}

// --- UTILS ---
document.getElementById("copyBtn").onclick = () => {
    const linkInput = document.getElementById("shareLink");
    navigator.clipboard.writeText(linkInput.value);
    
    const toast = document.getElementById("toast");
    toast.style.display = "block";
    setTimeout(() => { toast.style.display = "none"; }, 2000);
};

function scrollToUser() {
    document.getElementById("userSetup").scrollIntoView({ behavior: "smooth" });
}
