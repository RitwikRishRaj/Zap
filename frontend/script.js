// --- THEME SYSTEM ---
const themeToggle = document.getElementById("themeToggle");
if (localStorage.getItem("theme") === "light") {
    document.body.classList.add("light");
    themeToggle.checked = true;
}
themeToggle.addEventListener("change", () => {
    const isLight = themeToggle.checked;
    document.body.classList.toggle("light", isLight);
    localStorage.setItem("theme", isLight ? "light" : "dark");
});

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

// ─── GDG LOGO ANIMATION ───────────────────────────────────────────────────────
(function () {
    function gdgSpring(from, to, stiffness, damping, mass) {
        stiffness = stiffness || 180; damping = damping || 20; mass = mass || 1;
        const diff = to - from;
        const w0 = Math.sqrt(stiffness / mass);
        const zeta = damping / (2 * Math.sqrt(stiffness * mass));
        if (zeta < 1) {
            const wd = w0 * Math.sqrt(1 - zeta * zeta);
            return t => to - Math.exp(-zeta * w0 * t) * (diff * Math.cos(wd * t) + (diff * zeta * w0 / wd) * Math.sin(wd * t));
        }
        return t => to - diff * Math.exp(-w0 * t) * (1 + w0 * t);
    }

    const easeOut = t => 1 - Math.pow(1 - t, 3);
    const easeIn  = t => t * t * t;
    function anim(duration, tickFn, doneFn) {
        let start = null;
        function f(ts) {
            if (!start) start = ts;
            const t = Math.min((ts - start) / duration, 1);
            tickFn(t);
            if (t < 1) requestAnimationFrame(f);
            else if (doneFn) doneFn();
        }
        requestAnimationFrame(f);
    }

    const gdgDots = {
        blue:   document.getElementById('dot-blue'),
        red:    document.getElementById('dot-red'),
        yellow: document.getElementById('dot-yellow'),
        green:  document.getElementById('dot-green'),
    };
    const gdgLogoSvg = document.getElementById('logo-svg');
    const gdgCaps = {
        blue:         document.getElementById('cap-blue'),
        red:          document.getElementById('cap-red'),
        yellow:       document.getElementById('cap-yellow'),
        green:        document.getElementById('cap-green'),
        'blue-out':   document.getElementById('cap-blue-out'),
        'red-out':    document.getElementById('cap-red-out'),
        'yellow-out': document.getElementById('cap-yellow-out'),
        'green-out':  document.getElementById('cap-green-out'),
    };

    const KEYS = ['blue', 'red', 'yellow', 'green'];

    const dotHome = {
        blue:   { x: 85  + 14, y: 110 },
        red:    { x: 127 + 14, y: 110 },
        yellow: { x: 169 + 14, y: 110 },
        green:  { x: 211 + 14, y: 110 },
    };
    const capTarget = {
        blue:   { x: 118, y: 91  },
        red:    { x: 118, y: 129 },
        yellow: { x: 222, y: 91  },
        green:  { x: 222, y: 129 },
    };

    // Compute line lengths
    const gdgLengths = {};
    KEYS.forEach(k => {
        const el = gdgCaps[k];
        const dx = parseFloat(el.getAttribute('x2')) - parseFloat(el.getAttribute('x1'));
        const dy = parseFloat(el.getAttribute('y2')) - parseFloat(el.getAttribute('y1'));
        gdgLengths[k] = Math.sqrt(dx * dx + dy * dy);
        [gdgCaps[k], gdgCaps[k + '-out']].forEach(e => {
            e.style.strokeDasharray  = gdgLengths[k];
            e.style.strokeDashoffset = gdgLengths[k];
        });
    });

    function setDotPos(key, x, y, scale) {
        scale = scale === undefined ? 1 : scale;
        const dx = x - dotHome[key].x;
        const dy = y - dotHome[key].y;
        gdgDots[key].style.transform = `translateY(-50%) translate(${dx}px,${dy}px) scale(${scale})`;
    }
    function resetDot(key) { gdgDots[key].style.transform = 'translateY(-50%)'; }

    // Phase 1 – bounce
    function startBounce(duration, onDone) {
        const delays = { blue: 0, red: 0.15, yellow: 0.30, green: 0.45 };
        const amp = 32; let start = null;
        function frame(ts) {
            if (!start) start = ts;
            const elapsed = (ts - start) / 1000;
            KEYS.forEach(k => {
                const t = elapsed - delays[k];
                if (t < 0) return;
                const bounce = -Math.abs(Math.sin(Math.PI * t * 2.8)) * amp * Math.exp(-1.2 * t);
                setDotPos(k, dotHome[k].x, dotHome[k].y + bounce);
            });
            if (elapsed < duration) requestAnimationFrame(frame);
            else { KEYS.forEach(k => resetDot(k)); if (onDone) onDone(); }
        }
        requestAnimationFrame(frame);
    }

    // Phase 2 – morph dots → chevron
    function morphToLogo(onDone) {
        gdgLogoSvg.style.opacity = '1';
        const stagger = { blue: 0, red: 80, yellow: 50, green: 130 };
        let done = 0;
        KEYS.forEach(k => {
            setTimeout(() => {
                const from = dotHome[k], to = capTarget[k];
                const sx = gdgSpring(from.x, to.x, 220, 22);
                const sy = gdgSpring(from.y, to.y, 220, 22);
                anim(700, t => {
                    setDotPos(k, sx(t * 0.9), sy(t * 0.9), 1 - easeIn(t) * 0.9);
                }, () => {
                    gdgDots[k].style.opacity = '0';
                    if (++done === 4) drawCaps(onDone);
                });
            }, stagger[k]);
        });
    }

    function drawCaps(onDone) {
        const stagger = { blue: 0, red: 60, yellow: 40, green: 100 };
        let done = 0;
        KEYS.forEach(k => {
            setTimeout(() => {
                anim(500, t => {
                    const v = gdgLengths[k] * (1 - easeOut(t));
                    gdgCaps[k].style.strokeDashoffset = v;
                    gdgCaps[k + '-out'].style.strokeDashoffset = v;
                }, () => { if (++done === 4 && onDone) onDone(); });
            }, stagger[k]);
        });
    }

    // Phase 3 – hold
    // Phase 4 – unmorph
    function unmorphToDots(onDone) {
        const stagger = { blue: 100, red: 40, yellow: 60, green: 0 };
        let done = 0;
        KEYS.forEach(k => {
            setTimeout(() => {
                anim(400, t => {
                    const v = gdgLengths[k] * easeIn(t);
                    gdgCaps[k].style.strokeDashoffset = v;
                    gdgCaps[k + '-out'].style.strokeDashoffset = v;
                }, () => { if (++done === 4) emergeDots(onDone); });
            }, stagger[k]);
        });
    }

    function emergeDots(onDone) {
        gdgLogoSvg.style.opacity = '0';
        const stagger = { blue: 0, red: 70, yellow: 40, green: 110 };
        let done = 0;
        KEYS.forEach(k => {
            gdgDots[k].style.opacity = '1';
            setTimeout(() => {
                const from = capTarget[k], to = dotHome[k];
                const sx = gdgSpring(from.x, to.x, 200, 18);
                const sy = gdgSpring(from.y, to.y, 200, 18);
                anim(650, t => {
                    setDotPos(k, sx(t * 0.9), sy(t * 0.9), easeOut(t));
                }, () => { resetDot(k); if (++done === 4 && onDone) onDone(); });
            }, stagger[k]);
        });
    }

    function gdgLoop() {
        KEYS.forEach(k => {
            gdgDots[k].style.opacity = '1';
            resetDot(k);
            gdgCaps[k].style.strokeDashoffset = gdgLengths[k];
            gdgCaps[k + '-out'].style.strokeDashoffset = gdgLengths[k];
        });
        gdgLogoSvg.style.opacity = '0';
        startBounce(2.2, () => morphToLogo(() => setTimeout(() => unmorphToDots(() => setTimeout(gdgLoop, 400)), 1200)));
    }

    setTimeout(gdgLoop, 300);
})();
