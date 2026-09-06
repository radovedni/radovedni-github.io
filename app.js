/* ============================================================
   RADOVEDNI — revija stripov, ilustracij in zgodb
   Vanilla JS, brez odvisnosti. Deluje na GitHub Pages.
   ============================================================ */

(function(){
"use strict";

/* ---------- Barve rubrik (ciklično) ---------- */
const CAT_COLORS = ["#6C4DF0","#FF8A3D","#22B8A3","#F2568C","#3D9DFF","#F0A93C","#7BC142","#B14DF0","#4DB6AC","#E0525C"];
function catColor(cat){
  const cats = state.data.settings.categories;
  const idx = cats.indexOf(cat);
  return CAT_COLORS[(idx<0?0:idx) % CAT_COLORS.length];
}

/* ---------- Stanje aplikacije ---------- */
const state = {
  data: { settings:{ title:"Radovedni", subtitle:"", description:"", categories:[] }, articles:[] },
  sha: null, // github file sha za posodabljanje
  activeCategory: "__vse__",
  searchTerm: "",
  isAdmin: false,
  editingId: null, // id članka ki se ureja, ali null za nov
  currentType: "strip",
  panelDraft: [],
  contentDraft: [],
  galleryDraft: [],
  currentStrip: null,
  currentPanelIndex: 0,
  pendingDeleteId: null,
  config: loadConfig()
};

function loadConfig(){
  try{
    const raw = localStorage.getItem("radovedni_config");
    return raw ? JSON.parse(raw) : {};
  }catch(e){ return {}; }
}
function saveConfig(){
  localStorage.setItem("radovedni_config", JSON.stringify(state.config));
}

/* ---------- Pomožne DOM funkcije ---------- */
const $ = (sel)=>document.querySelector(sel);
const $$ = (sel)=>Array.from(document.querySelectorAll(sel));

function toast(msg, ms){
  const el = $("#toast");
  el.textContent = msg;
  el.hidden = false;
  clearTimeout(toast._t);
  toast._t = setTimeout(()=>{ el.hidden = true; }, ms||2600);
}

function escapeHtml(str){
  return String(str==null?"":str).replace(/[&<>"']/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
function uid(){
  return "a" + Date.now().toString(36) + Math.random().toString(36).slice(2,7);
}
function slugify(str){
  return (str||"clanek").toLowerCase()
    .replace(/[čć]/g,"c").replace(/š/g,"s").replace(/ž/g,"z").replace(/đ/g,"dj")
    .replace(/[^a-z0-9]+/g,"-").replace(/(^-|-$)/g,"").slice(0,50) || "clanek";
}

/* ============================================================
   NALAGANJE PODATKOV
   ============================================================ */
async function loadArticles(){
  $("#grid").innerHTML = '<div class="loading-msg">Nalaganje člankov…</div>';
  try{
    if(state.config.ghToken && state.config.ghOwner && state.config.ghRepo){
      await loadFromGithub();
    } else {
      const res = await fetch("articles.json?_=" + Date.now());
      if(!res.ok) throw new Error("Ni mogoče naložiti articles.json");
      state.data = await res.json();
    }
  }catch(err){
    console.error(err);
    try{
      const res = await fetch("articles.json?_=" + Date.now());
      state.data = await res.json();
    }catch(e2){
      toast("Napaka pri nalaganju člankov.");
      state.data = { settings:{title:"Radovedni",subtitle:"",description:"",categories:[]}, articles:[] };
    }
  }
  if(!state.data.settings) state.data.settings = {title:"Radovedni",subtitle:"",description:"",categories:[]};
  if(!state.data.articles) state.data.articles = [];
  applySettingsToUI();
  renderCategoryNav();
  renderGrid();
}

async function loadFromGithub(){
  const {ghOwner,ghRepo,ghBranch,ghPath,ghToken} = state.config;
  const url = `https://api.github.com/repos/${ghOwner}/${ghRepo}/contents/${encodeURIComponent(ghPath||"articles.json")}?ref=${encodeURIComponent(ghBranch||"main")}`;
  const res = await fetch(url, { headers: { "Authorization":"Bearer "+ghToken, "Accept":"application/vnd.github+json" } });
  if(!res.ok) throw new Error("GitHub GET ni uspel: " + res.status);
  const json = await res.json();
  state.sha = json.sha;
  const content = decodeURIComponent(escape(atob(json.content.replace(/\n/g,""))));
  state.data = JSON.parse(content);
}

async function saveToGithub(commitMessage){
  const {ghOwner,ghRepo,ghBranch,ghPath,ghToken} = state.config;
  if(!ghToken || !ghOwner || !ghRepo){
    throw new Error("GitHub ni nastavljen. Odpri Nastavitve.");
  }
  const path = ghPath || "articles.json";
  const branch = ghBranch || "main";
  const apiBase = `https://api.github.com/repos/${ghOwner}/${ghRepo}/contents/${encodeURIComponent(path)}`;

  // Pridobi trenutni sha (za primer, da je bila datoteka medtem spremenjena)
  let sha = state.sha;
  try{
    const getRes = await fetch(apiBase + `?ref=${encodeURIComponent(branch)}`, {
      headers: { "Authorization":"Bearer "+ghToken, "Accept":"application/vnd.github+json" }
    });
    if(getRes.ok){
      const getJson = await getRes.json();
      sha = getJson.sha;
    }
  }catch(e){ /* ignoriraj, poskusi brez sha (novo ustvarjanje) */ }

  const contentStr = JSON.stringify(state.data, null, 2);
  const base64Content = btoa(unescape(encodeURIComponent(contentStr)));

  const body = {
    message: commitMessage || "Posodobitev articles.json",
    content: base64Content,
    branch: branch
  };
  if(sha) body.sha = sha;

  const putRes = await fetch(apiBase, {
    method:"PUT",
    headers:{
      "Authorization":"Bearer "+ghToken,
      "Accept":"application/vnd.github+json",
      "Content-Type":"application/json"
    },
    body: JSON.stringify(body)
  });
  if(!putRes.ok){
    const errJson = await putRes.json().catch(()=>({}));
    throw new Error("GitHub PUT ni uspel: " + putRes.status + " " + (errJson.message||""));
  }
  const putJson = await putRes.json();
  state.sha = putJson.content ? putJson.content.sha : sha;
}

async function persistChanges(commitMessage){
  const hasGithub = state.config.ghToken && state.config.ghOwner && state.config.ghRepo;
  if(hasGithub){
    try{
      await saveToGithub(commitMessage);
      toast("✓ Objavljeno na GitHub!");
      return true;
    }catch(err){
      console.error(err);
      toast("Napaka pri objavi na GitHub: " + err.message);
      return false;
    }
  } else {
    toast("GitHub ni povezan — sprememba je shranjena samo lokalno. Prenesi articles.json v Nastavitvah.");
    return true;
  }
}

/* ============================================================
   NASTAVITVE / IZGLED
   ============================================================ */
function applySettingsToUI(){
  const s = state.data.settings;
  document.title = (s.title||"Radovedni") + " — Revija stripov, ilustracij in zgodb";
  $("#siteTitleText").textContent = s.title || "Radovedni";
  $("#siteSubtitleText").textContent = s.subtitle || "";
  $("#heroTitle").textContent = s.title || "Radovedni";
  $("#heroSubtitle").textContent = s.subtitle || s.description || "";
  $("#footerYear").textContent = new Date().getFullYear();
}

function renderCategoryNav(){
  const nav = $("#categoryNav");
  const cats = state.data.settings.categories || [];
  let html = `<button class="cat-pill ${state.activeCategory==='__vse__'?'active':''}" data-cat="__vse__">Vse</button>`;
  cats.forEach(cat=>{
    html += `<button class="cat-pill ${state.activeCategory===cat?'active':''}" data-cat="${escapeHtml(cat)}" style="${state.activeCategory===cat?`background:${catColor(cat)};border-color:${catColor(cat)}`:''}">${escapeHtml(cat)}</button>`;
  });
  nav.innerHTML = html;
  $$(".cat-pill").forEach(btn=>{
    btn.addEventListener("click", ()=>{
      state.activeCategory = btn.dataset.cat;
      renderCategoryNav();
      renderGrid();
    });
  });
}

/* ============================================================
   PRIKAZ MREŽE ČLANKOV
   ============================================================ */
function getFilteredArticles(){
  let list = state.data.articles.slice().sort((a,b)=> (b.date||"").localeCompare(a.date||""));
  if(state.activeCategory !== "__vse__"){
    list = list.filter(a=>a.category===state.activeCategory);
  }
  if(state.searchTerm){
    const t = state.searchTerm.toLowerCase();
    list = list.filter(a=>
      (a.title||"").toLowerCase().includes(t) ||
      (a.summary||"").toLowerCase().includes(t) ||
      (a.author||"").toLowerCase().includes(t)
    );
  }
  return list;
}

function renderGrid(){
  const list = getFilteredArticles();
  const grid = $("#grid");
  const emptyMsg = $("#emptyMsg");
  if(list.length===0){
    grid.innerHTML = "";
    emptyMsg.hidden = false;
    return;
  }
  emptyMsg.hidden = true;
  grid.innerHTML = list.map(renderCard).join("");

  $$(".card").forEach(card=>{
    card.addEventListener("click", (e)=>{
      if(e.target.closest(".card-admin-actions")) return;
      const id = card.dataset.id;
      const article = state.data.articles.find(a=>a.id===id);
      if(!article) return;
      if(article.type==="strip") openStripReader(article);
      else openStoryReader(article);
    });
  });
  if(state.isAdmin){
    $$(".card-edit-btn").forEach(btn=>{
      btn.addEventListener("click",(e)=>{
        e.stopPropagation();
        openArticleModal(btn.dataset.id);
      });
    });
    $$(".card-del-btn").forEach(btn=>{
      btn.addEventListener("click",(e)=>{
        e.stopPropagation();
        state.pendingDeleteId = btn.dataset.id;
        $("#deleteModalOverlay").hidden = false;
      });
    });
  }
}

function renderCard(a){
  const color = catColor(a.category);
  const typeLabel = a.type==="strip" ? `📱 Strip · ${(a.panels||[]).length} panelov` : "📖 Zgodba";
  const cover = a.coverImage || (a.type==="strip" && a.panels && a.panels[0] ? a.panels[0].url : "");
  const dateStr = a.date ? formatDate(a.date) : "";
  const adminActions = state.isAdmin ? `
    <div class="card-admin-actions">
      <button class="card-edit-btn" data-id="${a.id}" title="Uredi">✎</button>
      <button class="card-del-btn" data-id="${a.id}" title="Izbriši">🗑</button>
    </div>` : "";
  return `
  <div class="card" data-id="${a.id}">
    <div class="card-media">
      ${cover ? `<img src="${escapeHtml(cover)}" alt="${escapeHtml(a.title)}" loading="lazy">` : ""}
      <span class="card-type-badge">${typeLabel}</span>
      <span class="card-cat-badge" style="background:${color}">${escapeHtml(a.category||"Splošno")}</span>
      ${adminActions}
    </div>
    <div class="card-body">
      <div class="card-title">${escapeHtml(a.title)}</div>
      <div class="card-summary">${escapeHtml(a.summary||"")}</div>
      <div class="card-meta"><span>${escapeHtml(a.author||"Uredništvo")}</span><span>${dateStr}</span></div>
    </div>
  </div>`;
}

function formatDate(str){
  try{
    const d = new Date(str);
    return d.toLocaleDateString("sl-SI", {day:"numeric",month:"short",year:"numeric"});
  }catch(e){ return str; }
}

/* ============================================================
   STRIP READER (paneli 9:16, po telefonu prijazno branje)
   ============================================================ */
function openStripReader(article){
  state.currentStrip = article;
  state.currentPanelIndex = 0;
  $("#stripReaderTitle").textContent = article.title;
  renderStripProgress();
  showPanel(0);
  $("#stripReader").hidden = false;
  document.body.style.overflow = "hidden";
}
function closeStripReader(){
  $("#stripReader").hidden = true;
  document.body.style.overflow = "";
  state.currentStrip = null;
}
function renderStripProgress(){
  const panels = state.currentStrip.panels || [];
  $("#stripProgress").innerHTML = panels.map((_,i)=>`<div class="seg ${i<=state.currentPanelIndex?'done':''}" data-i="${i}"></div>`).join("");
  $$(".reader-progress .seg").forEach(seg=>{
    seg.addEventListener("click", ()=> showPanel(parseInt(seg.dataset.i,10)));
  });
}
function showPanel(index){
  const panels = state.currentStrip.panels || [];
  if(index<0 || index>=panels.length) return;
  state.currentPanelIndex = index;
  const panel = panels[index];
  $("#panelImage").src = panel.url;
  $("#stripCounter").textContent = `${index+1} / ${panels.length}`;
  $$(".reader-progress .seg").forEach((seg,i)=> seg.classList.toggle("done", i<=index));
  $("#stripPrevBtn").style.visibility = index===0 ? "hidden":"visible";
  $("#stripNextBtn").style.visibility = index===panels.length-1 ? "hidden":"visible";
  // predvidi naslednjo sliko
  if(panels[index+1]){ const pre = new Image(); pre.src = panels[index+1].url; }
}
function nextPanel(){
  const panels = state.currentStrip.panels || [];
  if(state.currentPanelIndex < panels.length-1) showPanel(state.currentPanelIndex+1);
}
function prevPanel(){
  if(state.currentPanelIndex > 0) showPanel(state.currentPanelIndex-1);
}

/* dotik / drsenje za mobilne naprave */
let touchStartX = null;
$("#stripStage").addEventListener("touchstart", e=>{ touchStartX = e.touches[0].clientX; }, {passive:true});
$("#stripStage").addEventListener("touchend", e=>{
  if(touchStartX===null) return;
  const dx = e.changedTouches[0].clientX - touchStartX;
  if(Math.abs(dx) > 40){
    if(dx<0) nextPanel(); else prevPanel();
  }
  touchStartX = null;
}, {passive:true});
$("#stripStage").addEventListener("click", (e)=>{
  if(e.target.closest(".reader-nav")) return;
  const rect = $("#stripStage").getBoundingClientRect();
  const x = e.clientX - rect.left;
  if(x < rect.width*0.35) prevPanel();
  else if(x > rect.width*0.65) nextPanel();
});
document.addEventListener("keydown", (e)=>{
  if($("#stripReader").hidden) return;
  if(e.key==="ArrowRight") nextPanel();
  if(e.key==="ArrowLeft") prevPanel();
  if(e.key==="Escape") closeStripReader();
});

/* ============================================================
   STORY READER (zgodba za branje + galerija)
   ============================================================ */
function openStoryReader(article){
  const color = catColor(article.category);
  let blocksHtml = "";
  (article.content||[]).forEach(block=>{
    if(block.type==="text"){
      blocksHtml += `<p class="story-block-text">${escapeHtml(block.value).replace(/\n/g,"<br>")}</p>`;
    } else if(block.type==="image"){
      blocksHtml += `<div class="story-block-image">
        <img src="${escapeHtml(block.url)}" alt="${escapeHtml(block.caption||article.title)}" class="lightbox-trigger" data-src="${escapeHtml(block.url)}">
        ${block.caption ? `<div class="story-block-caption">${escapeHtml(block.caption)}</div>`:""}
      </div>`;
    }
  });
  let galleryHtml = "";
  if(article.gallery && article.gallery.length){
    galleryHtml = `<div class="story-gallery-heading">🖼 Galerija</div>
      <div class="story-gallery">
        ${article.gallery.map(url=>`<img src="${escapeHtml(url)}" class="lightbox-trigger" data-src="${escapeHtml(url)}" loading="lazy">`).join("")}
      </div>`;
  }
  $("#storyContent").innerHTML = `
    ${article.coverImage ? `<img class="story-cover" src="${escapeHtml(article.coverImage)}" alt="${escapeHtml(article.title)}">`:""}
    <span class="story-cat" style="background:${color}">${escapeHtml(article.category||"Splošno")}</span>
    <h1 class="story-title">${escapeHtml(article.title)}</h1>
    <div class="story-meta">${escapeHtml(article.author||"Uredništvo")} · ${article.date?formatDate(article.date):""}</div>
    ${blocksHtml}
    ${galleryHtml}
  `;
  $$(".lightbox-trigger").forEach(img=>{
    img.addEventListener("click", ()=>{
      $("#lightboxImage").src = img.dataset.src;
      $("#lightbox").hidden = false;
    });
  });
  $("#storyReader").hidden = false;
  $("#storyReader").scrollTop = 0;
  document.body.style.overflow = "hidden";
}
function closeStoryReader(){
  $("#storyReader").hidden = true;
  document.body.style.overflow = "";
}

/* ============================================================
   ADMIN: PRIJAVA
   ============================================================ */
function simpleHash(str){
  let h = 0;
  for(let i=0;i<str.length;i++){ h = (h*31 + str.charCodeAt(i)) | 0; }
  return String(h);
}
function setAdminMode(on){
  state.isAdmin = on;
  $("#adminToolbar").hidden = !on;
  $("#adminPill").hidden = !on;
  $("#logoutBtn").hidden = !on;
  $("#settingsBtn").hidden = !on;
  $("#loginBtn").hidden = on;
  renderGrid();
}

$("#loginBtn").addEventListener("click", ()=>{
  const hasPass = !!state.config.adminPassHash;
  $("#loginHint").textContent = hasPass ? "Vnesi administratorsko geslo." : "Geslo še ni nastavljeno — vnesi novo geslo, da ga nastaviš.";
  $("#loginPasswordInput").value = "";
  $("#loginModalOverlay").hidden = false;
  $("#loginPasswordInput").focus();
});
$("#loginModalCloseBtn").addEventListener("click", ()=> $("#loginModalOverlay").hidden = true);
$("#loginCancelBtn").addEventListener("click", ()=> $("#loginModalOverlay").hidden = true);
$("#loginSubmitBtn").addEventListener("click", ()=>{
  const val = $("#loginPasswordInput").value;
  if(!val){ toast("Vnesi geslo."); return; }
  if(!state.config.adminPassHash){
    state.config.adminPassHash = simpleHash(val);
    saveConfig();
    toast("Geslo nastavljeno. Dobrodošel/-a, urednik!");
    $("#loginModalOverlay").hidden = true;
    setAdminMode(true);
    return;
  }
  if(simpleHash(val) === state.config.adminPassHash){
    $("#loginModalOverlay").hidden = true;
    setAdminMode(true);
    toast("Prijava uspešna.");
  } else {
    toast("Napačno geslo.");
  }
});
$("#logoutBtn").addEventListener("click", ()=>{
  setAdminMode(false);
  toast("Odjavljen/-a iz urejevalnega načina.");
});

/* ============================================================
   NOV / UREJANJE ČLANKA — modal
   ============================================================ */
function populateCategorySelect(){
  const sel = $("#fieldCategory");
  sel.innerHTML = (state.data.settings.categories||[]).map(c=>`<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join("");
}

function openArticleModal(editId){
  state.editingId = editId || null;
  populateCategorySelect();
  $("#deleteArticleBtn").hidden = !editId;

  if(editId){
    const a = state.data.articles.find(x=>x.id===editId);
    $("#articleModalTitle").textContent = "Uredi članek";
    state.currentType = a.type;
    $("#fieldCategory").value = a.category || "";
    $("#fieldAuthor").value = a.author || "";
    $("#fieldTitle").value = a.title || "";
    $("#fieldSummary").value = a.summary || "";
    $("#fieldCover").value = a.coverImage || "";
    state.panelDraft = a.panels ? JSON.parse(JSON.stringify(a.panels)) : [];
    state.contentDraft = a.content ? JSON.parse(JSON.stringify(a.content)) : [];
    state.galleryDraft = a.gallery ? a.gallery.slice() : [];
  } else {
    $("#articleModalTitle").textContent = "Nov članek";
    state.currentType = "strip";
    $("#fieldCategory").selectedIndex = 0;
    $("#fieldAuthor").value = "";
    $("#fieldTitle").value = "";
    $("#fieldSummary").value = "";
    $("#fieldCover").value = "";
    state.panelDraft = [];
    state.contentDraft = [];
    state.galleryDraft = [];
  }
  setArticleType(state.currentType);
  renderPanelsList();
  renderContentList();
  renderGalleryList();
  $("#articleModalOverlay").hidden = false;
}
function closeArticleModal(){
  $("#articleModalOverlay").hidden = true;
}

function setArticleType(type){
  state.currentType = type;
  $("#typeStripBtn").classList.toggle("active", type==="strip");
  $("#typeZgodbaBtn").classList.toggle("active", type==="zgodba");
  $("#panelsSection").hidden = type!=="strip";
  $("#contentSection").hidden = type!=="zgodba";
}
$("#typeStripBtn").addEventListener("click", ()=> setArticleType("strip"));
$("#typeZgodbaBtn").addEventListener("click", ()=> setArticleType("zgodba"));

$("#newArticleBtn").addEventListener("click", ()=> openArticleModal(null));
$("#articleModalCloseBtn").addEventListener("click", closeArticleModal);
$("#articleCancelBtn").addEventListener("click", closeArticleModal);

/* --- Paneli stripa --- */
function renderPanelsList(){
  const wrap = $("#panelsList");
  wrap.innerHTML = state.panelDraft.map((p,i)=>`
    <div class="dyn-item" data-i="${i}">
      ${p.url ? `<img class="dyn-thumb" src="${escapeHtml(p.url)}">` : `<div class="dyn-thumb"></div>`}
      <div class="dyn-fields">
        <input type="text" class="panel-url-input" placeholder="https://... (slika panela)" value="${escapeHtml(p.url||"")}">
        <div class="dyn-row-inline">
          <select class="panel-format-select">
            <option value="9:16" ${p.format==="9:16"?"selected":""}>9:16 (telefon)</option>
            <option value="1:1" ${p.format==="1:1"?"selected":""}>1:1 (kvadrat)</option>
            <option value="4:5" ${p.format==="4:5"?"selected":""}>4:5</option>
            <option value="16:9" ${p.format==="16:9"?"selected":""}>16:9</option>
            <option value="original" ${p.format==="original"?"selected":""}>Izvirno razmerje</option>
          </select>
        </div>
      </div>
      <div class="dyn-drag-handles">
        <button class="dyn-order-btn move-up" title="Premakni gor">▲</button>
        <button class="dyn-order-btn move-down" title="Premakni dol">▼</button>
      </div>
      <button class="dyn-remove" title="Odstrani">✕</button>
    </div>
  `).join("") || `<p class="field-hint">Še ni dodanih panelov. Klikni spodaj, da dodaš prvega.</p>`;

  $$("#panelsList .dyn-item").forEach(item=>{
    const i = parseInt(item.dataset.i,10);
    item.querySelector(".panel-url-input").addEventListener("input", e=>{
      state.panelDraft[i].url = e.target.value;
      const thumb = item.querySelector(".dyn-thumb");
      if(thumb.tagName==="IMG") thumb.src = e.target.value;
    });
    item.querySelector(".panel-format-select").addEventListener("change", e=>{
      state.panelDraft[i].format = e.target.value;
    });
    item.querySelector(".dyn-remove").addEventListener("click", ()=>{
      state.panelDraft.splice(i,1); renderPanelsList();
    });
    item.querySelector(".move-up").addEventListener("click", ()=>{
      if(i>0){ [state.panelDraft[i-1],state.panelDraft[i]]=[state.panelDraft[i],state.panelDraft[i-1]]; renderPanelsList(); }
    });
    item.querySelector(".move-down").addEventListener("click", ()=>{
      if(i<state.panelDraft.length-1){ [state.panelDraft[i+1],state.panelDraft[i]]=[state.panelDraft[i],state.panelDraft[i+1]]; renderPanelsList(); }
    });
  });
}
$("#addPanelBtn").addEventListener("click", ()=>{
  state.panelDraft.push({url:"", format:"9:16"});
  renderPanelsList();
});

/* --- Vsebina zgodbe (besedilo / slike) --- */
function renderContentList(){
  const wrap = $("#contentList");
  wrap.innerHTML = state.contentDraft.map((b,i)=>{
    if(b.type==="text"){
      return `<div class="dyn-item" data-i="${i}">
        <div class="dyn-fields">
          <label class="field-hint">📝 Odstavek besedila</label>
          <textarea rows="3" class="content-text-input" placeholder="Napiši odstavek...">${escapeHtml(b.value||"")}</textarea>
        </div>
        <div class="dyn-drag-handles">
          <button class="dyn-order-btn move-up" title="Gor">▲</button>
          <button class="dyn-order-btn move-down" title="Dol">▼</button>
        </div>
        <button class="dyn-remove" title="Odstrani">✕</button>
      </div>`;
    } else {
      return `<div class="dyn-item" data-i="${i}">
        ${b.url ? `<img class="dyn-thumb" src="${escapeHtml(b.url)}">` : `<div class="dyn-thumb"></div>`}
        <div class="dyn-fields">
          <label class="field-hint">🖼 Slika v besedilu</label>
          <input type="text" class="content-image-url" placeholder="https://..." value="${escapeHtml(b.url||"")}">
          <input type="text" class="content-image-caption" placeholder="Podnapis (neobvezno)" value="${escapeHtml(b.caption||"")}">
        </div>
        <div class="dyn-drag-handles">
          <button class="dyn-order-btn move-up" title="Gor">▲</button>
          <button class="dyn-order-btn move-down" title="Dol">▼</button>
        </div>
        <button class="dyn-remove" title="Odstrani">✕</button>
      </div>`;
    }
  }).join("") || `<p class="field-hint">Dodaj prvi odstavek ali sliko.</p>`;

  $$("#contentList .dyn-item").forEach(item=>{
    const i = parseInt(item.dataset.i,10);
    const b = state.contentDraft[i];
    if(b.type==="text"){
      item.querySelector(".content-text-input").addEventListener("input", e=>{ b.value = e.target.value; });
    } else {
      item.querySelector(".content-image-url").addEventListener("input", e=>{
        b.url = e.target.value;
        const thumb = item.querySelector(".dyn-thumb");
        if(thumb.tagName==="IMG") thumb.src = e.target.value;
      });
      item.querySelector(".content-image-caption").addEventListener("input", e=>{ b.caption = e.target.value; });
    }
    item.querySelector(".dyn-remove").addEventListener("click", ()=>{ state.contentDraft.splice(i,1); renderContentList(); });
    item.querySelector(".move-up").addEventListener("click", ()=>{
      if(i>0){ [state.contentDraft[i-1],state.contentDraft[i]]=[state.contentDraft[i],state.contentDraft[i-1]]; renderContentList(); }
    });
    item.querySelector(".move-down").addEventListener("click", ()=>{
      if(i<state.contentDraft.length-1){ [state.contentDraft[i+1],state.contentDraft[i]]=[state.contentDraft[i],state.contentDraft[i+1]]; renderContentList(); }
    });
  });
}
$("#addTextBlockBtn").addEventListener("click", ()=>{
  state.contentDraft.push({type:"text", value:""});
  renderContentList();
});
$("#addImageBlockBtn").addEventListener("click", ()=>{
  state.contentDraft.push({type:"image", url:"", caption:""});
  renderContentList();
});

/* --- Galerija --- */
function renderGalleryList(){
  const wrap = $("#galleryList");
  wrap.innerHTML = state.galleryDraft.map((url,i)=>`
    <div class="dyn-item" data-i="${i}">
      ${url ? `<img class="dyn-thumb" src="${escapeHtml(url)}">` : `<div class="dyn-thumb"></div>`}
      <div class="dyn-fields">
        <input type="text" class="gallery-url-input" placeholder="https://..." value="${escapeHtml(url)}">
      </div>
      <button class="dyn-remove" title="Odstrani">✕</button>
    </div>
  `).join("") || `<p class="field-hint">Galerija je prazna.</p>`;

  $$("#galleryList .dyn-item").forEach(item=>{
    const i = parseInt(item.dataset.i,10);
    item.querySelector(".gallery-url-input").addEventListener("input", e=>{
      state.galleryDraft[i] = e.target.value;
      const thumb = item.querySelector(".dyn-thumb");
      if(thumb.tagName==="IMG") thumb.src = e.target.value;
    });
    item.querySelector(".dyn-remove").addEventListener("click", ()=>{ state.galleryDraft.splice(i,1); renderGalleryList(); });
  });
}
$("#addGalleryBtn").addEventListener("click", ()=>{
  state.galleryDraft.push("");
  renderGalleryList();
});

/* --- Shrani članek --- */
$("#articleSaveBtn").addEventListener("click", async ()=>{
  const title = $("#fieldTitle").value.trim();
  if(!title){ toast("Naslov članka je obvezen."); return; }
  const category = $("#fieldCategory").value;

  if(state.currentType==="strip"){
    const panels = state.panelDraft.filter(p=>p.url && p.url.trim());
    if(panels.length===0){ toast("Dodaj vsaj en panel s sliko."); return; }
  } else {
    const hasContent = state.contentDraft.some(b=> (b.type==="text" && b.value.trim()) || (b.type==="image" && b.url.trim()));
    if(!hasContent){ toast("Dodaj vsaj en odstavek ali sliko."); return; }
  }

  let article;
  const isNew = !state.editingId;
  if(isNew){
    article = { id: slugify(title) + "-" + uid().slice(-4), date: new Date().toISOString().slice(0,10) };
  } else {
    article = state.data.articles.find(a=>a.id===state.editingId);
  }
  article.type = state.currentType;
  article.category = category;
  article.author = $("#fieldAuthor").value.trim();
  article.title = title;
  article.summary = $("#fieldSummary").value.trim();
  article.coverImage = $("#fieldCover").value.trim();

  if(state.currentType==="strip"){
    article.panels = state.panelDraft.filter(p=>p.url && p.url.trim());
    delete article.content;
    delete article.gallery;
  } else {
    article.content = state.contentDraft.filter(b=> (b.type==="text" && b.value.trim()) || (b.type==="image" && b.url.trim()));
    article.gallery = state.galleryDraft.filter(u=>u && u.trim());
  }

  if(isNew) state.data.articles.push(article);

  closeArticleModal();
  renderGrid();
  await persistChanges(isNew ? `Nov članek: ${title}` : `Posodobitev članka: ${title}`);
});

/* --- Izbriši članek --- */
$("#deleteArticleBtn").addEventListener("click", ()=>{
  state.pendingDeleteId = state.editingId;
  closeArticleModal();
  $("#deleteModalOverlay").hidden = false;
});
$("#deleteModalCloseBtn").addEventListener("click", ()=> $("#deleteModalOverlay").hidden = true);
$("#deleteCancelBtn").addEventListener("click", ()=> $("#deleteModalOverlay").hidden = true);
$("#deleteConfirmBtn").addEventListener("click", async ()=>{
  const id = state.pendingDeleteId;
  const article = state.data.articles.find(a=>a.id===id);
  state.data.articles = state.data.articles.filter(a=>a.id!==id);
  $("#deleteModalOverlay").hidden = true;
  renderGrid();
  await persistChanges(article ? `Izbris članka: ${article.title}` : "Izbris članka");
});

/* ============================================================
   NASTAVITVE (GitHub, rubrike, naslov)
   ============================================================ */
function openSettingsModal(){
  $("#ghToken").value = state.config.ghToken || "";
  $("#ghOwner").value = state.config.ghOwner || "";
  $("#ghRepo").value = state.config.ghRepo || "";
  $("#ghBranch").value = state.config.ghBranch || "main";
  $("#ghPath").value = state.config.ghPath || "articles.json";
  $("#ghStatus").textContent = "";
  $("#ghStatus").className = "gh-status";
  $("#settingsTitleInput").value = state.data.settings.title || "";
  $("#settingsSubtitleInput").value = state.data.settings.subtitle || "";
  renderCategoryManageList();
  $("#settingsModalOverlay").hidden = false;
}
$("#settingsBtn").addEventListener("click", openSettingsModal);
$("#openSettingsBtn2").addEventListener("click", openSettingsModal);
$("#settingsModalCloseBtn").addEventListener("click", ()=> $("#settingsModalOverlay").hidden = true);
$("#settingsCloseBtn2").addEventListener("click", ()=> $("#settingsModalOverlay").hidden = true);

$("#ghSaveBtn").addEventListener("click", ()=>{
  state.config.ghToken = $("#ghToken").value.trim();
  state.config.ghOwner = $("#ghOwner").value.trim();
  state.config.ghRepo = $("#ghRepo").value.trim();
  state.config.ghBranch = $("#ghBranch").value.trim() || "main";
  state.config.ghPath = $("#ghPath").value.trim() || "articles.json";
  saveConfig();
  toast("Nastavitve GitHub shranjene.");
});
$("#ghTestBtn").addEventListener("click", async ()=>{
  const owner = $("#ghOwner").value.trim();
  const repo = $("#ghRepo").value.trim();
  const token = $("#ghToken").value.trim();
  const branch = $("#ghBranch").value.trim() || "main";
  const path = $("#ghPath").value.trim() || "articles.json";
  const statusEl = $("#ghStatus");
  statusEl.textContent = "Preverjam povezavo…";
  statusEl.className = "gh-status";
  try{
    const url = `https://api.github.com/repos/${owner}/${repo}/contents/${encodeURIComponent(path)}?ref=${encodeURIComponent(branch)}`;
    const res = await fetch(url, { headers: token ? {"Authorization":"Bearer "+token, "Accept":"application/vnd.github+json"} : {"Accept":"application/vnd.github+json"} });
    if(res.ok){
      statusEl.textContent = "✓ Povezava uspešna — datoteka najdena.";
      statusEl.className = "gh-status ok";
    } else {
      statusEl.textContent = "✕ Napaka: " + res.status + " (preveri lastnika, repo, vejo, pot in žeton).";
      statusEl.className = "gh-status err";
    }
  }catch(e){
    statusEl.textContent = "✕ Napaka pri povezavi: " + e.message;
    statusEl.className = "gh-status err";
  }
});

/* --- Rubrike --- */
function renderCategoryManageList(){
  const cats = state.data.settings.categories || [];
  $("#categoryManageList").innerHTML = cats.map(c=>`
    <div class="category-manage-item">
      <span>${escapeHtml(c)}</span>
      <button class="cat-del-btn" data-cat="${escapeHtml(c)}" title="Izbriši rubriko">✕</button>
    </div>
  `).join("") || `<p class="field-hint">Ni rubrik.</p>`;

  $$(".cat-del-btn").forEach(btn=>{
    btn.addEventListener("click", async ()=>{
      const cat = btn.dataset.cat;
      const used = state.data.articles.filter(a=>a.category===cat).length;
      if(used>0){
        if(!confirm(`Rubrika "${cat}" je uporabljena v ${used} člankih. Izbrisati kljub temu? (Članki bodo ostali brez rubrike.)`)) return;
      }
      state.data.settings.categories = state.data.settings.categories.filter(c=>c!==cat);
      state.data.articles.forEach(a=>{ if(a.category===cat) a.category = ""; });
      renderCategoryManageList();
      renderCategoryNav();
      renderGrid();
      await persistChanges(`Izbris rubrike: ${cat}`);
    });
  });
}
$("#addCategoryBtn").addEventListener("click", async ()=>{
  const input = $("#newCategoryInput");
  const name = input.value.trim();
  if(!name){ return; }
  if(state.data.settings.categories.includes(name)){ toast("Ta rubrika že obstaja."); return; }
  state.data.settings.categories.push(name);
  input.value = "";
  renderCategoryManageList();
  renderCategoryNav();
  await persistChanges(`Nova rubrika: ${name}`);
});

/* --- Naslov revije --- */
$("#saveTitleBtn").addEventListener("click", async ()=>{
  state.data.settings.title = $("#settingsTitleInput").value.trim() || "Radovedni";
  state.data.settings.subtitle = $("#settingsSubtitleInput").value.trim();
  applySettingsToUI();
  await persistChanges("Posodobitev naslova revije");
});

/* --- Prenos JSON kot varnostna kopija --- */
$("#downloadJsonBtn").addEventListener("click", ()=>{
  const blob = new Blob([JSON.stringify(state.data, null, 2)], {type:"application/json"});
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url; a.download = "articles.json";
  a.click();
  URL.revokeObjectURL(url);
});

/* ============================================================
   ISKANJE
   ============================================================ */
$("#searchToggleBtn").addEventListener("click", ()=>{
  const bar = $("#searchBar");
  bar.hidden = !bar.hidden;
  if(!bar.hidden) $("#searchInput").focus();
});
$("#searchInput").addEventListener("input", e=>{
  state.searchTerm = e.target.value;
  renderGrid();
});

/* ============================================================
   ZAPIRANJE OVERLAYEV / OSTALI DOGODKI
   ============================================================ */
$("#stripCloseBtn").addEventListener("click", closeStripReader);
$("#stripPrevBtn").addEventListener("click", prevPanel);
$("#stripNextBtn").addEventListener("click", nextPanel);
$("#storyCloseBtn").addEventListener("click", closeStoryReader);
$("#lightboxCloseBtn").addEventListener("click", ()=> $("#lightbox").hidden = true);
$("#lightbox").addEventListener("click", (e)=>{ if(e.target.id==="lightbox") $("#lightbox").hidden = true; });
$("#refreshBtn").addEventListener("click", loadArticles);
$("#logoLink").addEventListener("click", (e)=>{
  e.preventDefault();
  state.activeCategory = "__vse__";
  state.searchTerm = "";
  $("#searchInput").value = "";
  renderCategoryNav();
  renderGrid();
  window.scrollTo({top:0, behavior:"smooth"});
});

// zapri modal overlay ob kliku izven njega
$$(".modal-overlay").forEach(overlay=>{
  overlay.addEventListener("click", (e)=>{ if(e.target===overlay) overlay.hidden = true; });
});

/* ============================================================
   ZAGON
   ============================================================ */
loadArticles();

})();
