import { initializeApp } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-auth.js";
import { getDatabase, ref, push, set, remove, query, orderByChild, limitToLast, onValue } from "https://www.gstatic.com/firebasejs/11.10.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyC5foKHPojesxz2IuUBSF9NHlX47Gtt_Oo",
  authDomain: "globalchat-5377f.firebaseapp.com",
  databaseURL: "https://globalchat-5377f-default-rtdb.asia-southeast1.firebasedatabase.app",
  projectId: "globalchat-5377f",
  storageBucket: "globalchat-5377f.firebasestorage.app",
  messagingSenderId: "143079466106",
  appId: "1:143079466106:web:b94d5a8928a639067287c3",
  measurementId: "G-SXS33MKBQS"
};

const app=initializeApp(firebaseConfig),auth=getAuth(app),db=getDatabase(app);
const $=id=>document.getElementById(id);
const els={messages:$("messages"),form:$("messageForm"),input:$("messageInput"),modal:$("usernameModal"),usernameForm:$("usernameForm"),usernameInput:$("usernameInput"),profileName:$("profileName"),profileAvatar:$("profileAvatar"),status:$("connectionStatus"),change:$("changeUserBtn"),clear:$("clearInputBtn"),toast:$("toast"),action:$("messageActionModal"),del:$("deleteForEveryoneBtn"),cancel:$("cancelDeleteBtn")};
let user=null,username=localStorage.getItem("globalchat_username")||"",connected=false,stop=null,deleteId=null,firstRender=false;
const safeName=s=>s.trim().replace(/\s+/g," ").slice(0,24);
const letter=s=>(s||"?").trim().charAt(0).toUpperCase()||"?";
const esc=v=>String(v??"").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
const time=ts=>new Intl.DateTimeFormat("id-ID",{hour:"2-digit",minute:"2-digit"}).format(new Date(ts||Date.now()));
function toast(t){els.toast.textContent=t;els.toast.classList.add("show");clearTimeout(toast.t);toast.t=setTimeout(()=>els.toast.classList.remove("show"),3000)}
function status(t,ok=false){els.status.textContent=t;els.status.style.color=ok?"#83dfa7":""}
function profile(){const n=username||"Guest";els.profileName.textContent=n;els.profileAvatar.textContent=letter(n)}
function openUser(){els.modal.classList.remove("hidden");els.usernameInput.value=username;setTimeout(()=>els.usernameInput.focus(),50)}
function closeUser(){els.modal.classList.add("hidden")}
function openDelete(id){deleteId=id;els.action.classList.remove("hidden")}
function closeDelete(){deleteId=null;els.action.classList.add("hidden")}

async function notifications(){
  if(!("Notification" in window))return;
  if(Notification.permission==="default"){try{await Notification.requestPermission()}catch{}}
}
function notify(msg){
  if(!document.hidden||!user||msg.uid===user.uid)return;
  if(!("Notification" in window)||Notification.permission!=="granted")return;
  try{const n=new Notification(`GlobalChat • ${msg.username||"Pengguna"}`,{body:String(msg.text||"").slice(0,140),tag:"globalchat-message",renotify:true});setTimeout(()=>n.close(),6000)}catch{}
}

function render(data){
  els.messages.innerHTML="";
  const arr=Object.entries(data||{}).map(([id,m])=>({id,...m})).sort((a,b)=>(a.timestamp||0)-(b.timestamp||0));
  if(!arr.length){els.messages.innerHTML='<div class="empty"><div class="empty-icon">💬</div><strong>Belum ada pesan</strong><p>Jadilah orang pertama yang memulai percakapan di Global Room.</p></div>';return}
  for(const m of arr){
    if(firstRender&&!seen.has(m.id))notify(m); seen.add(m.id);
    const mine=m.uid===user?.uid,row=document.createElement("div");
    row.className=`message-row ${mine?"mine":""}`;row.dataset.id=m.id;
    row.innerHTML=`${mine?"":`<div class="message-avatar">${esc(letter(m.username))}</div>`}<div class="message-block">${mine?"":`<div class="message-name">${esc(m.username||"Anonymous")}</div>`}<div class="bubble">${esc(m.text||"")}</div><div class="message-meta">${time(m.timestamp)}</div></div>${mine?`<div class="message-avatar">${esc(letter(m.username))}</div>`:""}`;
    if(mine)longPress(row,m.id);els.messages.appendChild(row);
  }
  els.messages.scrollTop=els.messages.scrollHeight; firstRender=true;
}
const seen=new Set();
function longPress(row,id){
  let timer=0,moved=false;
  const start=()=>{moved=false;clearTimeout(timer);timer=setTimeout(()=>{if(!moved){navigator.vibrate?.(25);openDelete(id)}},550)};
  const cancel=()=>clearTimeout(timer);
  row.addEventListener("touchstart",start,{passive:true});row.addEventListener("touchmove",()=>{moved=true;cancel()},{passive:true});row.addEventListener("touchend",cancel,{passive:true});row.addEventListener("touchcancel",cancel,{passive:true});
  row.addEventListener("mousedown",start);row.addEventListener("mousemove",()=>{moved=true;cancel()});row.addEventListener("mouseup",cancel);row.addEventListener("mouseleave",cancel);
}
function subscribe(){
  stop?.();const q=query(ref(db,"rooms/global/messages"),orderByChild("timestamp"),limitToLast(250));
  stop=onValue(q,s=>{render(s.val());if(connected)status("Realtime • tersambung",true)},e=>{console.error(e);status("Database ditolak");toast(`Database: ${e.code||e.message}`)})
}
onValue(ref(db,".info/connected"),s=>{connected=s.val()===true;status(connected?"Realtime • tersambung":"Realtime • menghubungkan…",connected)},()=>status("Database gagal"));
async function send(text){
  if(!user)throw Error("AUTH_NOT_READY");if(!username)throw Error("USERNAME_REQUIRED");if(!connected)throw Error("DATABASE_OFFLINE");
  const r=push(ref(db,"rooms/global/messages"));await set(r,{uid:user.uid,username,text:text.trim(),timestamp:Date.now()});
}
els.form.addEventListener("submit",async e=>{e.preventDefault();const t=els.input.value;if(!t.trim())return;els.input.disabled=true;try{await send(t);els.input.value=""}catch(err){const c=err?.code||err?.message||"ERROR";toast(String(c).includes("PERMISSION_DENIED")?"PERMISSION_DENIED: cek Rules.":String(c).includes("DATABASE_OFFLINE")?"Database belum tersambung. Cek databaseURL.":`Pesan gagal: ${c}`)}finally{els.input.disabled=false;els.input.focus()}});
els.input.addEventListener("keydown",e=>{if(e.key==="Enter"&&!e.shiftKey){e.preventDefault();els.form.requestSubmit()}});
els.usernameForm.addEventListener("submit",async e=>{e.preventDefault();const v=safeName(els.usernameInput.value);if(v.length<2)return toast("Username minimal 2 karakter.");username=v;localStorage.setItem("globalchat_username",username);profile();closeUser();await notifications();toast(`Selamat datang, ${username}!`)});
els.change.addEventListener("click",openUser);els.clear.addEventListener("click",()=>{els.input.value="";els.input.focus()});els.cancel.addEventListener("click",closeDelete);els.action.addEventListener("click",e=>{if(e.target===els.action)closeDelete()});
els.del.addEventListener("click",async()=>{if(!deleteId||!user)return;try{await remove(ref(db,`rooms/global/messages/${deleteId}`));closeDelete();toast("Pesan dihapus untuk semua orang.")}catch(e){console.error(e);closeDelete();toast(`Gagal menghapus: ${e?.code||e?.message||"ERROR"}`)}});
profile();
onAuthStateChanged(auth,u=>{if(u){user=u;subscribe();if(!username)openUser()}else status("Auth belum tersambung")});
try{await signInAnonymously(auth)}catch(e){console.error(e);status("Auth gagal");toast(`Anonymous Auth: ${e.code||e.message}`);openUser()}
