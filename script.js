import { initializeApp } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged, updateProfile } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-auth.js";
import { getDatabase, ref, push, set, onChildAdded, onValue, serverTimestamp, query, limitToLast, onDisconnect } from "https://www.gstatic.com/firebasejs/12.9.0/firebase-database.js";

// YOUR CONFIG (or move to firebase-config.js)
const firebaseConfig = {

  apiKey: "AIzaSyABYcqyz8s5gqH7NVRwKurlsU9WfnXoS7A",

  authDomain: "cloudchat-bcbad.firebaseapp.com",

  databaseURL: "https://cloudchat-bcbad-default-rtdb.firebaseio.com",

  projectId: "cloudchat-bcbad",

  storageBucket: "cloudchat-bcbad.firebasestorage.app",

  messagingSenderId: "966250985643",

  appId: "1:966250985643:web:5d4fe6b54e715388921fee"

};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

const messagesRef = ref(db, 'pictoMessages');
const presenceRef = ref(db, 'presence');

let currentUser;
let canvas, ctx;
let isDrawing = false;
let currentColor = 'black';

// Theme Toggle
const themeToggle = document.getElementById('theme-toggle');
const html = document.documentElement;

function setTheme(theme) {
  html.setAttribute('data-theme', theme);
  themeToggle.textContent = theme === 'dark' ? 'Light Mode' : 'Dark Mode';
  localStorage.setItem('theme', theme);
}

const savedTheme = localStorage.getItem('theme') ||
  (window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
setTheme(savedTheme);

themeToggle.addEventListener('click', () => {
  const current = html.getAttribute('data-theme') || 'light';
  setTheme(current === 'light' ? 'dark' : 'light');
});

// Join
document.getElementById('signInBtn').onclick = () => signInAnonymously(auth);

// Auth State
onAuthStateChanged(auth, async user => {
  if (user) {
    currentUser = user;
    document.getElementById('auth').style.display = 'none';
    document.getElementById('chat').style.display = 'block';
    document.getElementById('user-list-container').style.display = 'block';

    let displayName = user.displayName || `Guest_${user.uid.slice(0,6)}`;
    if (!user.displayName) {
      await updateProfile(user, { displayName });
      await set(ref(db, `presence/${user.uid}`), { name: displayName, online: true, lastActive: serverTimestamp() });
    }

    document.getElementById('myName').innerHTML = `
      You are: <strong id="currentNameDisplay">${displayName}</strong>
      <button id="changeNameBtn">Change Nickname</button>
    `;

    if (!user.displayName || user.displayName.startsWith('Guest_')) {
      setTimeout(openNameModal, 700);
    }

    document.getElementById('changeNameBtn').addEventListener('click', openNameModal);
    initCanvas();
    setupPresenceAndListeners();
  } else {
    document.getElementById('chat').style.display = 'none';
    document.getElementById('user-list-container').style.display = 'none';
    document.getElementById('auth').style.display = 'block';
  }
});

// Nickname Modal
function openNameModal() {
  document.getElementById('nameModal').style.display = 'flex';
  document.getElementById('newNameInput').value = currentUser.displayName || '';
  document.getElementById('newNameInput').focus();
  document.getElementById('modalError').textContent = '';
}

document.getElementById('cancelNameBtn').onclick = () => {
  document.getElementById('nameModal').style.display = 'none';
};

document.getElementById('saveNameBtn').onclick = async () => {
  const input = document.getElementById('newNameInput');
  const errorEl = document.getElementById('modalError');
  let newName = input.value.trim();

  if (newName.length < 3) return errorEl.textContent = 'At least 3 characters required';
  if (newName.length > 25) return errorEl.textContent = 'Max 25 characters';

  try {
    await updateProfile(currentUser, { displayName: newName });
    await set(ref(db, `presence/${currentUser.uid}/name`), newName);
    document.getElementById('currentNameDisplay').textContent = newName;
    document.getElementById('nameModal').style.display = 'none';
    showStatus(`Name changed to ${newName}!`, '#10b981');
  } catch (err) {
    errorEl.textContent = 'Failed to save – try again';
  }
};

function showStatus(msg, color = '#10b981') {
  const status = document.getElementById('status');
  status.textContent = msg;
  status.style.color = color;
  setTimeout(() => status.textContent = '', 3000);
}

// Canvas
function initCanvas() {
  canvas = document.getElementById('drawCanvas');
  ctx = canvas.getContext('2d');
  canvas.width = canvas.offsetWidth;
  canvas.height = 220;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.lineWidth = 6;

  const draw = e => {
    if (!isDrawing) return;
    const rect = canvas.getBoundingClientRect();
    const x = (e.clientX || e.touches?.[0].clientX) - rect.left;
    const y = (e.clientY || e.touches?.[0].clientY) - rect.top;
    ctx.lineTo(x, y);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const start = e => { e.preventDefault(); isDrawing = true; ctx.beginPath(); draw(e); };
  const stop = () => isDrawing = false;

  canvas.addEventListener('pointerdown', start);
  canvas.addEventListener('pointermove', draw);
  canvas.addEventListener('pointerup', stop);
  canvas.addEventListener('pointerout', stop);

  document.querySelectorAll('.color-btn').forEach(btn => {
    btn.onclick = () => {
      currentColor = btn.dataset.color;
      ctx.strokeStyle = currentColor === 'rainbow' ? createRainbow() : currentColor;
    };
  });

  document.getElementById('clearBtn').onclick = () => ctx.clearRect(0, 0, canvas.width, canvas.height);
}

function createRainbow() {
  const grad = ctx.createLinearGradient(0, 0, canvas.width, canvas.height);
  ['red','orange','yellow','green','blue','indigo','violet'].forEach((c,i) => grad.addColorStop(i/6, c));
  return grad;
}

// Send Message
document.getElementById('sendBtn').onclick = async () => {
  const text = document.getElementById('messageInput').value.trim();
  const hasDraw = ctx.getImageData(0,0,canvas.width,canvas.height).data.some(v => v > 0);

  if (!text && !hasDraw) return;

  const image = hasDraw ? canvas.toDataURL('image/png', 0.92) : null;
  if (hasDraw) ctx.clearRect(0, 0, canvas.width, canvas.height);

  const name = currentUser.displayName || `Guest_${currentUser.uid.slice(0,6)}`;

  await set(push(messagesRef), {
    text: text || null,
    image,
    uid: currentUser.uid,
    name,
    createdAt: serverTimestamp()
  });

  document.getElementById('messageInput').value = '';
};

// Presence & User List
function setupPresenceAndListeners() {
  function setupPresenceAndListeners() {
  const connectedRef = ref(db, ".info/connected");

  onValue(connectedRef, (snap) => {
    const isConnected = snap.val() === true;
    console.log("[DEBUG] Connection state changed:", isConnected ? "CONNECTED" : "OFFLINE/DISCONNECTED");

    if (isConnected) {
      document.getElementById("online").textContent = "Connected! Syncing...";
      // Then update with real count when presence loads
    } else {
      document.getElementById("online").textContent = "Offline or connecting...";
    }
  }, (error) => {
    console.error("[ERROR] .info/connected listener failed:", error.code, error.message);
    document.getElementById("online").textContent = "Connection error: " + (error.message || "Unknown");
  });

  // Your existing presence write...
  onValue(ref(db, '.info/connected'), snap => {
    if (snap.val() === true && currentUser) {
      console.log("[DEBUG] Writing my presence now");
      const myRef = ref(db, `presence/${currentUser.uid}`);
      set(myRef, {
        name: currentUser.displayName || `Guest_${currentUser.uid.slice(0,6)}`,
        online: true,
        lastActive: serverTimestamp()
      }).then(() => {
        console.log("[DEBUG] Presence write succeeded");
      }).catch(err => {
        console.error("[ERROR] Presence write failed:", err);
      });

      onDisconnect(myRef).remove();
    }
  });

  // Rest of your onValue(presenceRef, ...) stays the same
}

// Messages
onChildAdded(query(messagesRef, limitToLast(150)), snap => {
  const msg = snap.val();
  if (!msg) return;

  const div = document.createElement('div');
  div.className = `msg ${msg.uid === currentUser?.uid ? 'self' : 'other'}`;
  div.innerHTML = `<strong>${msg.name || 'Anon'}</strong>`;
  if (msg.text) div.innerHTML += ` ${msg.text}`;
  if (msg.image) {
    const img = document.createElement('img');
    img.src = msg.image;
    img.alt = "Doodle";
    div.appendChild(img);
  }

  document.getElementById('messages').appendChild(div);
  div.scrollIntoView({ behavior: 'smooth', block: 'end' });
});