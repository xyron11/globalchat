import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import {
  getDatabase,
  ref,
  push,
  set,
  query,
  orderByChild,
  limitToLast,
  onValue
} from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";


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

const els = {
  messages: document.getElementById("messages"),
  form: document.getElementById("messageForm"),
  input: document.getElementById("messageInput"),
  modal: document.getElementById("usernameModal"),
  usernameForm: document.getElementById("usernameForm"),
  usernameInput: document.getElementById("usernameInput"),
  profileName: document.getElementById("profileName"),
  profileAvatar: document.getElementById("profileAvatar"),
  connectionStatus: document.getElementById("connectionStatus"),
  changeUserBtn: document.getElementById("changeUserBtn"),
  clearInputBtn: document.getElementById("clearInputBtn"),
  toast: document.getElementById("toast")
};

let currentUser = null;
let username = localStorage.getItem("globalchat_username") || "";
let unsubscribeMessages = null;

function safeName(name) {
  return name.trim().replace(/\s+/g, " ").slice(0, 24);
}

function avatarLetter(name) {
  return (name || "?").trim().charAt(0).toUpperCase() || "?";
}

function showToast(text) {
  els.toast.textContent = text;
  els.toast.classList.add("show");
  setTimeout(() => els.toast.classList.remove("show"), 2200);
}

function updateProfile() {
  const shown = username || "Guest";
  els.profileName.textContent = shown;
  els.profileAvatar.textContent = avatarLetter(shown);
}

function openUsernameModal() {
  els.modal.classList.remove("hidden");
  els.usernameInput.value = username;
  setTimeout(() => els.usernameInput.focus(), 30);
}

function closeUsernameModal() {
  els.modal.classList.add("hidden");
}

function formatTime(timestamp) {
  const date = new Date(timestamp || Date.now());
  return new Intl.DateTimeFormat("id-ID", {
    hour: "2-digit",
    minute: "2-digit"
  }).format(date);
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function renderMessages(data) {
  els.messages.innerHTML = "";
  const entries = Object.entries(data || {}).map(([id, msg]) => ({ id, ...msg }));
  entries.sort((a, b) => (a.timestamp || 0) - (b.timestamp || 0));

  if (!entries.length) {
    els.messages.innerHTML = `
      <div class="empty">
        <div class="empty-icon">💬</div>
        <strong>Belum ada pesan</strong>
        <p>Jadilah orang pertama yang memulai percakapan di Global Room.</p>
      </div>
    `;
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
  if (unsubscribeMessages) unsubscribeMessages();

  const messagesRef = query(
    ref(db, "rooms/global/messages"),
    orderByChild("timestamp"),
    limitToLast(250)
  );

  unsubscribeMessages = onValue(
    messagesRef,
    (snapshot) => {
      renderMessages(snapshot.val());
      els.connectionStatus.textContent = "Realtime • tersambung";
      els.connectionStatus.style.color = "#83dfa7";
    },
    (error) => {
      console.error(error);
      els.connectionStatus.textContent = "Gagal membaca chat";
      els.connectionStatus.style.color = "#ff8793";
      showToast("Tidak bisa membaca database. Cek rules Firebase.");
    }
  );
}

async function sendMessage(text) {
  const trimmed = text.trim();
  if (!trimmed || !currentUser || !username) return;

  const newMessageRef = push(ref(db, "rooms/global/messages"));
  await set(newMessageRef, {
    uid: currentUser.uid,
    username,
    text: trimmed,
    timestamp: Date.now()
  });
}

els.form.addEventListener("submit", async (event) => {
  event.preventDefault();
  const text = els.input.value;
  if (!text.trim()) return;

  try {
    els.input.disabled = true;
    await sendMessage(text);
    els.input.value = "";
  } catch (error) {
    console.error(error);
    showToast("Pesan gagal dikirim. Cek konfigurasi Firebase.");
  } finally {
    els.input.disabled = false;
    els.input.focus();
  }
});

els.input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    els.form.requestSubmit();
  }
});

els.usernameForm.addEventListener("submit", (event) => {
  event.preventDefault();
  const value = safeName(els.usernameInput.value);

  if (value.length < 2) {
    showToast("Username minimal 2 karakter.");
    return;
  }

  username = value;
  localStorage.setItem("globalchat_username", username);
  updateProfile();
  closeUsernameModal();
  showToast(`Selamat datang, ${username}!`);
});

els.changeUserBtn.addEventListener("click", openUsernameModal);
els.clearInputBtn.addEventListener("click", () => {
  els.input.value = "";
  els.input.focus();
});

updateProfile();

onAuthStateChanged(auth, async (user) => {
  if (user) {
    currentUser = user;
    els.connectionStatus.textContent = "Realtime • tersambung";
    subscribeMessages();
    if (!username) openUsernameModal();
  }
});

try {
  await signInAnonymously(auth);
} catch (error) {
  console.error(error);
  els.connectionStatus.textContent = "Auth gagal";
  els.connectionStatus.style.color = "#ff8793";
  showToast("Anonymous Auth belum diaktifkan di Firebase.");
}
