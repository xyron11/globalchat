import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
  getDatabase, ref, push, set, query, orderByChild, limitToLast, onValue
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";

/*
  PASTE CONFIG FIREBASE WEB APP DI SINI.
  Pastikan databaseURL berasal dari Realtime Database milik project yang sama.
*/
const firebaseConfig = {
  apiKey: "AIzaSyC5foKHPojesxz2IuUBSF9NHlX47Gtt_Oo",
  authDomain: "globalchat-5377f.firebaseapp.com",
  projectId: "globalchat-5377f",
  storageBucket: "globalchat-5377f.firebasestorage.app",
  messagingSenderId: "143079466106",
  appId: "1:143079466106:web:b94d5a8928a639067287c3",
  measurementId: "G-SXS33MKBQS"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getDatabase(app);

const $ = (id) => document.getElementById(id);
const els = {
  messages: $("messages"),
  form: $("messageForm"),
  input: $("messageInput"),
  modal: $("usernameModal"),
  usernameForm: $("usernameForm"),
  usernameInput: $("usernameInput"),
  profileName: $("profileName"),
  profileAvatar: $("profileAvatar"),
  connectionStatus: $("connectionStatus"),
  changeUserBtn: $("changeUserBtn"),
  clearInputBtn: $("clearInputBtn"),
  toast: $("toast")
};

let currentUser = null;
let username = localStorage.getItem("globalchat_username") || "";
let stopMessages = null;
let connectedToDatabase = false;

function safeName(name) {
  return name.trim().replace(/\s+/g, " ").slice(0, 24);
}
function avatarLetter(name) {
  return (name || "?").trim().charAt(0).toUpperCase() || "?";
}
function toast(message) {
  els.toast.textContent = message;
  els.toast.classList.add("show");
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => els.toast.classList.remove("show"), 3200);
}
function setStatus(text, ok=false) {
  els.connectionStatus.textContent = text;
  els.connectionStatus.style.color = ok ? "#83dfa7" : "";
}
function updateProfile() {
  const name = username || "Guest";
  els.profileName.textContent = name;
  els.profileAvatar.textContent = avatarLetter(name);
}
function openUsernameModal() {
  els.modal.classList.remove("hidden");
  els.usernameInput.value = username;
  setTimeout(() => els.usernameInput.focus(), 50);
}
function closeUsernameModal() {
  els.modal.classList.add("hidden");
}
function formatTime(timestamp) {
  return new Intl.DateTimeFormat("id-ID", {hour:"2-digit", minute:"2-digit"})
    .format(new Date(timestamp || Date.now()));
}
function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;")
    .replaceAll('"',"&quot;").replaceAll("'","&#039;");
}

function renderMessages(data) {
  els.messages.innerHTML = "";
  const entries = Object.entries(data || {})
    .map(([id, msg]) => ({ id, ...msg }))
    .sort((a,b) => (a.timestamp||0) - (b.timestamp||0));

  if (!entries.length) {
    els.messages.innerHTML = `
      <div class="empty">
        <div class="empty-icon">💬</div>
        <strong>Belum ada pesan</strong>
        <p>Jadilah orang pertama yang memulai percakapan di Global Room.</p>
      </div>`;
    return;
  }

  for (const msg of entries) {
    const mine = msg.uid === currentUser?.uid;
    const row = document.createElement("div");
    row.className = `message-row ${mine ? "mine" : ""}`;
    row.innerHTML = `
      ${mine ? "" : `<div class="message-avatar">${escapeHtml(avatarLetter(msg.username))}</div>`}
      <div class="message-block">
        ${mine ? "" : `<div class="message-name">${escapeHtml(msg.username || "Anonymous")}</div>`}
        <div class="bubble">${escapeHtml(msg.text || "")}</div>
        <div class="message-meta">${formatTime(msg.timestamp)}</div>
      </div>
      ${mine ? `<div class="message-avatar">${escapeHtml(avatarLetter(msg.username))}</div>` : ""}
    `;
    els.messages.appendChild(row);
  }
  els.messages.scrollTop = els.messages.scrollHeight;
}

function subscribeMessages() {
  if (stopMessages) stopMessages();

  const messagesQuery = query(
    ref(db, "rooms/global/messages"),
    orderByChild("timestamp"),
    limitToLast(250)
  );

  stopMessages = onValue(
    messagesQuery,
    snap => {
      renderMessages(snap.val());
      if (connectedToDatabase) setStatus("Realtime • tersambung", true);
    },
    error => {
      console.error("READ ERROR:", error);
      setStatus("Database ditolak");
      toast(`Database: ${error.code || error.message}`);
    }
  );
}

// Ini indikator koneksi DATABASE yang sebenarnya.
onValue(ref(db, ".info/connected"), snap => {
  connectedToDatabase = snap.val() === true;
  if (connectedToDatabase) {
    setStatus("Realtime • tersambung", true);
  } else {
    setStatus("Realtime • menghubungkan…");
  }
}, error => {
  console.error("CONNECTION ERROR:", error);
  setStatus("Database gagal");
  toast("Gagal mengecek koneksi Realtime Database.");
});

async function sendMessage(text) {
  const trimmed = text.trim();
  if (!currentUser) throw new Error("AUTH_NOT_READY");
  if (!username) throw new Error("USERNAME_REQUIRED");
  if (!connectedToDatabase) throw new Error("DATABASE_OFFLINE");
  if (!trimmed) return;

  const messageRef = push(ref(db, "rooms/global/messages"));
  await set(messageRef, {
    uid: currentUser.uid,
    username,
    text: trimmed,
    timestamp: Date.now()
  });
}

els.form.addEventListener("submit", async (e) => {
  e.preventDefault();
  const text = els.input.value;
  if (!text.trim()) return;

  els.input.disabled = true;
  try {
    await sendMessage(text);
    els.input.value = "";
  } catch (err) {
    console.error("SEND ERROR:", err);
    const code = err?.code || err?.message || "UNKNOWN_ERROR";
    if (String(code).includes("PERMISSION_DENIED")) {
      toast("PERMISSION_DENIED: cek Rules Realtime Database.");
    } else if (String(code).includes("DATABASE_OFFLINE")) {
      toast("Database belum tersambung. Cek databaseURL dan Realtime Database.");
    } else {
      toast(`Pesan gagal dikirim: ${code}`);
    }
  } finally {
    els.input.disabled = false;
    els.input.focus();
  }
});

els.input.addEventListener("keydown", e => {
  if (e.key === "Enter" && !e.shiftKey) {
    e.preventDefault();
    els.form.requestSubmit();
  }
});

els.usernameForm.addEventListener("submit", e => {
  e.preventDefault();
  const value = safeName(els.usernameInput.value);
  if (value.length < 2) {
    toast("Username minimal 2 karakter.");
    return;
  }
  username = value;
  localStorage.setItem("globalchat_username", username);
  updateProfile();
  closeUsernameModal();
  toast(`Selamat datang, ${username}!`);
});

els.changeUserBtn.addEventListener("click", openUsernameModal);
els.clearInputBtn.addEventListener("click", () => {
  els.input.value = "";
  els.input.focus();
});

updateProfile();

onAuthStateChanged(auth, user => {
  if (user) {
    currentUser = user;
    subscribeMessages();
    if (!username) openUsernameModal();
  } else {
    setStatus("Auth belum tersambung");
  }
});

try {
  await signInAnonymously(auth);
} catch (error) {
  console.error("AUTH ERROR:", error);
  setStatus("Auth gagal");
  toast(`Anonymous Auth: ${error.code || error.message}`);
  openUsernameModal();
}
