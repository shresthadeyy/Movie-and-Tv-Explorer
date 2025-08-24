// ===== Movie & TV Show Explorer (TMDB) =====
const TMDB_KEY = "PASTE_YOUR_TMDB_API_KEY_HERE"; // <-- put your key
const API = "https://api.themoviedb.org/3";
const IMG = "https://image.tmdb.org/t/p";
const POSTER_W = "/w342";
const POSTER_W_FALLBACK = "/w185";

// DOM
const grid = document.getElementById("grid");
const empty = document.getElementById("empty");
const loadMoreBtn = document.getElementById("loadMore");
const form = document.getElementById("searchForm");
const qInput = document.getElementById("query");
const typeSel = document.getElementById("type");
const yearInput = document.getElementById("year");
const trendingBtn = document.getElementById("trendingBtn");
const modal = document.getElementById("modal");
const modalBackdrop = document.getElementById("modalBackdrop");
const modalClose = document.getElementById("modalClose");
const modalContent = document.getElementById("modalContent");

// State
let currentPage = 1;
let totalPages = 1;
let mode = "trending";  // "trending" | "search"
let lastQuery = "";
let lastType = "all";
let lastYear = "";

// Utilities
const imgUrl = (path, size=POSTER_W) => path ? `${IMG}${size}${path}` : "";
const titleOf = (item) => item.title || item.name || "(untitled)";
const yearOf = (item) => (item.release_date || item.first_air_date || "").slice(0,4);
const typeOf = (item) => item.media_type || (item.title ? "movie" : "tv");
const ratingOf = (item) => (item.vote_average ? item.vote_average.toFixed(1) : "—");

function showEmpty(show){ empty.hidden = !show; }
function showLoadMore(show){ loadMoreBtn.hidden = !show; }

function card(item){
  const poster = imgUrl(item.poster_path) || imgUrl(item.backdrop_path, POSTER_W_FALLBACK);
  const div = document.createElement("div");
  div.className = "card";
  div.innerHTML = `
    <img class="poster" src="${poster || ''}" alt="" onerror="this.style.display='none'">
    <div class="card__body">
      <h3 class="title">${titleOf(item)}</h3>
      <p class="meta">
        <span class="chip">${typeOf(item).toUpperCase()}</span>
        <span class="chip">${yearOf(item) || "—"}</span>
        <span class="chip rate">★ ${ratingOf(item)}</span>
      </p>
    </div>
  `;
  div.addEventListener("click", () => openModal(item));
  return div;
}

function render(items, append=false){
  if (!append) grid.innerHTML = "";
  if (!items.length && !append){ showEmpty(true); showLoadMore(false); return; }
  showEmpty(false);
  items.forEach(it => {
    // filter out "person" from multi results
    if (typeOf(it) === "person") return;
    grid.appendChild(card(it));
  });
  showLoadMore(currentPage < totalPages);
}

// Fetch helpers
async function http(url){
  const res = await fetch(url);
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return res.json();
}

async function fetchTrending(page=1){
  const url = `${API}/trending/all/week?api_key=${TMDB_KEY}&language=en-US&page=${page}`;
  const data = await http(url);
  return data;
}

async function fetchSearch(query, kind="all", year="", page=1){
  let url;
  const adult = "include_adult=false&language=en-US";
  if (kind === "all"){
    url = `${API}/search/multi?api_key=${TMDB_KEY}&${adult}&page=${page}&query=${encodeURIComponent(query)}`;
  } else if (kind === "movie"){
    url = `${API}/search/movie?api_key=${TMDB_KEY}&${adult}&page=${page}&query=${encodeURIComponent(query)}`;
    if (year) url += `&year=${encodeURIComponent(year)}`;
  } else {
    url = `${API}/search/tv?api_key=${TMDB_KEY}&${adult}&page=${page}&query=${encodeURIComponent(query)}`;
    if (year) url += `&first_air_date_year=${encodeURIComponent(year)}`;
  }
  return http(url);
}

async function fetchDetails(id, kind){
  const url = `${API}/${kind}/${id}?api_key=${TMDB_KEY}&language=en-US&append_to_response=videos`;
  return http(url);
}

// Modal
function closeModal(){ modal.hidden = true; modalContent.innerHTML = ""; }
modalBackdrop.addEventListener("click", closeModal);
modalClose.addEventListener("click", closeModal);
document.addEventListener("keydown", (e)=>{ if(e.key==="Escape") closeModal(); });

async function openModal(item){
  const kind = typeOf(item); // movie | tv
  const id = item.id;
  try{
    const d = await fetchDetails(id, kind);
    const poster = imgUrl(d.poster_path) || imgUrl(d.backdrop_path, POSTER_W_FALLBACK);
    const genres = (d.genres||[]).map(g=>`<span class="chip">${g.name}</span>`).join("");
    const runtime = d.runtime || (d.episode_run_time && d.episode_run_time[0]) || null;
    const tagline = d.tagline ? `<div class="modal__sub">“${d.tagline}”</div>` : "";
    const date = d.release_date || d.first_air_date || "";
    const homepage = d.homepage ? `<a class="link" href="${d.homepage}" target="_blank" rel="noopener">Official site</a>` : "";
    // trailer (YouTube)
    const vids = (d.videos && d.videos.results) || [];
    const trailer = vids.find(v => v.type === "Trailer" && v.site === "YouTube");
    const trailerLink = trailer ? `<a class="link" href="https://www.youtube.com/watch?v=${trailer.key}" target="_blank" rel="noopener">Watch trailer ▶</a>` : "";

    modalContent.innerHTML = `
      <div class="modal__hero">
        <img class="modal__poster" src="${poster || ''}" alt="" onerror="this.style.display='none'">
        <div>
          <h2 id="modalTitle" class="modal__title">${titleOf(d)}</h2>
          ${tagline}
          <div class="modal__chips">
            <span class="chip">${kind.toUpperCase()}</span>
            ${date ? `<span class="chip">${date.slice(0,4)}</span>` : ""}
            <span class="chip">★ ${ratingOf(d)}</span>
            ${runtime ? `<span class="chip">${runtime} min</span>` : ""}
          </div>
          <p class="modal__overview">${d.overview || "No overview available."}</p>
          <p class="modal__chips">${genres}</p>
        </div>
      </div>
      <div class="modal__section">
        ${trailerLink} ${trailerLink && homepage ? " • " : ""} ${homepage}
      </div>
    `;
    modal.hidden = false;
  }catch(err){
    modalContent.innerHTML = `<div class="modal__section"><p>Failed to load details. Please try again.</p></div>`;
    modal.hidden = false;
    console.error(err);
  }
}

// Events
form.addEventListener("submit", async (e)=>{
  e.preventDefault();
  const q = qInput.value.trim();
  const kind = typeSel.value;
  const year = (yearInput.value || "").trim();
  if (!q) return;
  mode = "search"; lastQuery = q; lastType = kind; lastYear = year; currentPage = 1;
  try{
    const data = await fetchSearch(q, kind, year, currentPage);
    totalPages = data.total_pages || 1;
    render(data.results || [], false);
  }catch(err){
    console.error(err);
    render([], false);
  }
});

trendingBtn.addEventListener("click", async ()=>{
  mode = "trending"; currentPage = 1;
  try{
    const data = await fetchTrending(currentPage);
    totalPages = data.total_pages || 1;
    render(data.results || [], false);
  }catch(err){
    console.error(err);
    render([], false);
  }
});

loadMoreBtn.addEventListener("click", async ()=>{
  if (currentPage >= totalPages) return;
  currentPage += 1;
  try{
    let data;
    if (mode === "trending"){
      data = await fetchTrending(currentPage);
    } else {
      data = await fetchSearch(lastQuery, lastType, lastYear, currentPage);
    }
    render(data.results || [], true);
  }catch(err){
    console.error(err);
  }
});

// Initial load
(async function init(){
  qInput.focus();
  // default: trending
  try{
    const data = await fetchTrending(1);
    totalPages = data.total_pages || 1;
    render(data.results || [], false);
  }catch(err){
    console.error(err);
    render([], false);
  }
})();
