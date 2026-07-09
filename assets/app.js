/* ==========================================================================
   DLBC SITE LOGIC
   --------------------------------------------------------------------------
   CONTENT SOURCES
   1. Daily devotion  -> assets/devotions.js (automatic, date-based, no admin
      action needed).
   2. Sermons + Activities -> a Google Sheet the admin edits like Excel.
      Each tab is published to the web as CSV and fetched here. This is the
      "manually updated by the admin" content — add a row in the sheet,
      refresh the site, it appears. See guide.html for full setup steps.
   ========================================================================== */

const CMS_CONFIG = {
  // Replace SHEET_ID with your published Google Sheet ID once set up.
  // guide.html walks through getting these two URLs step by step.
  sermonsCsvUrl:   "https://docs.google.com/spreadsheets/d/e/2PACX-1vROirhPwT8E2snKlRUSQsaRh23t3Je8tMk3QEFtHsMJ4eT2Paex5VyBfIZIl346AWg_AW6K2k8teKX3/pub?gid=0&single=true&output=csv",
  activitiesCsvUrl:"https://docs.google.com/spreadsheets/d/e/2PACX-1vROirhPwT8E2snKlRUSQsaRh23t3Je8tMk3QEFtHsMJ4eT2Paex5VyBfIZIl346AWg_AW6K2k8teKX3/pub?gid=1783873046&single=true&output=csv",
  isConfigured: false // app.js flips this on automatically once the URLs above are edited
};
CMS_CONFIG.isConfigured = !CMS_CONFIG.sermonsCsvUrl.includes("SHEET_ID");

/* ---------- Sample content shown until the Google Sheet is connected ---------- */
const SAMPLE_SERMONS = [
  { date: "2026-07-05", title: "Walking by Faith, Not by Sight", speaker: "Ptr. Rogelio Jordan", passage: "2 Corinthians 5:7", youtube: "", summary: "A message on trusting God's guidance even when the way ahead isn't clear." },
  { date: "2026-06-28", title: "The Good Shepherd", speaker: "Ptr. Rogelio Jordan", passage: "John 10:11-15", youtube: "", summary: "Understanding Christ's care for His flock and what it means to know His voice." },
  { date: "2026-06-21", title: "A Living Sacrifice", speaker: "Ptr. Rogelio Jordan", passage: "Romans 12:1-2", youtube: "", summary: "What it looks like to offer our everyday lives as worship." }
];
const SAMPLE_ACTIVITIES = [
  { date: "2026-07-19", title: "Sunday Worship Service", time: "9:00 AM", location: "DLBC Main Sanctuary, Brgy. Libas", description: "Weekly Sunday worship — everyone is welcome." },
  { date: "2026-07-25", title: "Youth Fellowship Night", time: "6:00 PM", location: "DLBC Fellowship Hall", description: "Games, worship, and a short message for the church's youth." },
  { date: "2026-08-02", title: "Cambalong Outreach", time: "2:00 PM", location: "Brgy. Cambalong", description: "Community visitation and prayer with families in Cambalong." }
];

/* ---------- Small CSV parser (handles quoted commas) ---------- */
function parseCsv(text){
  const rows = [];
  let row = [], field = "", inQuotes = false;
  for (let i = 0; i < text.length; i++){
    const c = text[i], next = text[i+1];
    if (inQuotes){
      if (c === '"' && next === '"'){ field += '"'; i++; }
      else if (c === '"'){ inQuotes = false; }
      else { field += c; }
    } else {
      if (c === '"'){ inQuotes = true; }
      else if (c === ','){ row.push(field); field = ""; }
      else if (c === '\n'){ row.push(field); rows.push(row); row = []; field = ""; }
      else if (c === '\r'){ /* skip */ }
      else { field += c; }
    }
  }
  if (field.length || row.length){ row.push(field); rows.push(row); }
  const headers = rows.shift().map(h => h.trim().toLowerCase());
  return rows
    .filter(r => r.some(cell => cell.trim() !== ""))
    .map(r => Object.fromEntries(headers.map((h, i) => [h, (r[i] || "").trim()])));
}

function youtubeIdFrom(url){
  if (!url) return "";
  const m = url.match(/(?:youtu\.be\/|v=|embed\/)([A-Za-z0-9_-]{6,})/);
  return m ? m[1] : (url.length <= 20 ? url : "");
}

async function fetchSheet(url){
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error("Sheet fetch failed: " + res.status);
  return parseCsv(await res.text());
}

function fmtDate(dateStr){
  const d = new Date(dateStr + "T00:00:00");
  if (isNaN(d)) return dateStr;
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

/* ---------- Daily Devotion (automatic) ---------- */
function renderDevotion(){
  const now = new Date();
  const start = new Date(now.getFullYear(), 0, 0);
  const dayOfYear = Math.floor((now - start) / 86400000);
  const entry = DEVOTIONS[dayOfYear % DEVOTIONS.length];

  document.getElementById("devotion-dow").textContent = now.toLocaleDateString("en-US", { weekday: "short" });
  document.getElementById("devotion-dom").textContent = now.getDate();
  document.getElementById("devotion-moy").textContent = now.toLocaleDateString("en-US", { month: "long", year: "numeric" });
  document.getElementById("devotion-ref").textContent = entry.ref;
  document.getElementById("devotion-verse").textContent = "\u201C" + entry.verse + "\u201D";
  document.getElementById("devotion-reflection").innerHTML = "<strong>Reflection: </strong>" + entry.reflection;
}

/* ---------- Sermons: latest 3 on Home, full list feeds Archive ---------- */
let ALL_SERMONS = [];

function sermonCard(s){
  const id = youtubeIdFrom(s.youtube);
  const thumb = id
    ? `<img src="https://img.youtube.com/vi/${id}/hqdefault.jpg" alt="${s.title} thumbnail" loading="lazy">`
    : "";
  const href = id ? `https://www.youtube.com/watch?v=${id}` : "#";
  return `
  <article class="card">
    <a class="thumb" href="${href}" target="_blank" rel="noopener" aria-label="Watch ${s.title}">
      ${thumb}
      <span class="play"><svg viewBox="0 0 24 24" fill="none"><circle cx="12" cy="12" r="11" fill="rgba(250,246,236,.92)"/><path d="M10 8.5l6 3.5-6 3.5v-7z" fill="#1B2A56"/></svg></span>
    </a>
    <div class="body">
      <div class="meta">${fmtDate(s.date)} &middot; ${s.speaker || "DLBC"}</div>
      <h3>${s.title}</h3>
      <p>${s.summary || s.passage || ""}</p>
      <a class="link" href="${href}" target="_blank" rel="noopener">Watch sermon &rarr;</a>
    </div>
  </article>`;
}

function renderLatestSermons(sermons){
  const el = document.getElementById("sermons-latest");
  if (!sermons.length){ el.innerHTML = `<p class="state-msg">No sermons posted yet — check back soon.</p>`; return; }
  const latest = [...sermons].sort((a,b) => new Date(b.date) - new Date(a.date)).slice(0,3);
  el.innerHTML = latest.map(sermonCard).join("");
}

function renderActivities(activities){
  const el = document.getElementById("activities-list");
  if (!activities.length){ el.innerHTML = `<p class="state-msg">No activities scheduled yet — check back soon.</p>`; return; }
  const upcoming = [...activities].sort((a,b) => new Date(a.date) - new Date(b.date));
  el.innerHTML = upcoming.map(a => `
    <article class="card">
      <div class="body">
        <div class="meta">${fmtDate(a.date)} &middot; ${a.time || ""}</div>
        <h3>${a.title}</h3>
        <p>${a.description || ""}</p>
        <span class="link">${a.location || ""}</span>
      </div>
    </article>`).join("");
}

/* ---------- Archive ---------- */
function renderArchive(){
  const q = document.getElementById("archive-search").value.trim().toLowerCase();
  const year = document.getElementById("archive-year").value;
  const el = document.getElementById("archive-list");

  let list = ALL_SERMONS.filter(s => {
    const matchesQ = !q || (s.title + " " + s.speaker + " " + s.passage).toLowerCase().includes(q);
    const matchesYear = !year || s.date.startsWith(year);
    return matchesQ && matchesYear;
  }).sort((a,b) => new Date(b.date) - new Date(a.date));

  if (!list.length){ el.innerHTML = `<p class="state-msg">No sermons match that search.</p>`; return; }

  el.innerHTML = list.map(s => {
    const id = youtubeIdFrom(s.youtube);
    const href = id ? `https://www.youtube.com/watch?v=${id}` : "#";
    return `
    <a class="archive-row" href="${href}" target="_blank" rel="noopener">
      <span class="archive-date">${fmtDate(s.date)}</span>
      <span>
        <span class="archive-title">${s.title}</span><br>
        <span class="archive-speaker">${s.speaker || "DLBC"} &middot; ${s.passage || ""}</span>
      </span>
      <span class="chip">${id ? "Watch" : "Details"}</span>
    </a>`;
  }).join("");
}

function populateArchiveYears(sermons){
  const years = [...new Set(sermons.map(s => (s.date || "").slice(0,4)).filter(Boolean))].sort().reverse();
  const sel = document.getElementById("archive-year");
  sel.innerHTML = `<option value="">All years</option>` + years.map(y => `<option value="${y}">${y}</option>`).join("");
}

/* ---------- Load everything ---------- */
async function loadContent(){
  renderDevotion();

  let sermons = SAMPLE_SERMONS, activities = SAMPLE_ACTIVITIES;

  if (CMS_CONFIG.isConfigured){
    try {
      const [s, a] = await Promise.all([
        fetchSheet(CMS_CONFIG.sermonsCsvUrl),
        fetchSheet(CMS_CONFIG.activitiesCsvUrl)
      ]);
      sermons = s; activities = a;
    } catch (err){
      console.warn("Could not load the Google Sheet — showing sample content instead.", err);
    }
  } else {
    console.info("DLBC site: sample content is showing because CMS_CONFIG in app.js hasn't been connected to a Google Sheet yet. See guide.html.");
  }

  ALL_SERMONS = sermons;
  renderLatestSermons(sermons);
  renderActivities(activities);
  populateArchiveYears(sermons);
  renderArchive();
}

/* ---------- Nav + wiring ---------- */
document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("year").textContent = new Date().getFullYear();
  document.getElementById("nav-toggle").addEventListener("click", () => {
    document.getElementById("main-nav").classList.toggle("open");
  });
  document.querySelectorAll("#main-nav a").forEach(a =>
    a.addEventListener("click", () => document.getElementById("main-nav").classList.remove("open"))
  );
  document.getElementById("archive-search").addEventListener("input", renderArchive);
  document.getElementById("archive-year").addEventListener("change", renderArchive);

  loadContent();
});
