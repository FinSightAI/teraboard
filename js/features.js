// TeraBoard — supplementary UI features
// Stats bar · Favorites · Mood Match overlay · Floating CTA
(function () {
  'use strict';

  // ── Favorites (localStorage) ───────────────────────────────
  const LS_KEY = 'tb_favs';
  let _favSet = new Set(JSON.parse(localStorage.getItem(LS_KEY) || '[]'));
  let _onFavChange = null;

  function _saveFavs() { localStorage.setItem(LS_KEY, JSON.stringify([..._favSet])); }

  function toggleFav(key) {
    if (_favSet.has(key)) _favSet.delete(key); else _favSet.add(key);
    _saveFavs();
    document.querySelectorAll('.fav-btn').forEach(btn => {
      if (btn.dataset.key === String(key)) {
        const on = _favSet.has(key);
        btn.classList.toggle('active', on);
        btn.textContent = on ? '♥' : '♡';
      }
    });
    if (_onFavChange) _onFavChange(_favSet.size);
  }

  function favButtonHTML(key) {
    const active = _favSet.has(String(key));
    return `<button class="fav-btn${active ? ' active' : ''}" data-key="${key}" onclick="event.stopPropagation();TeraFeatures.toggleFav('${key}')" aria-label="Favoritar">${active ? '♥' : '♡'}</button>`;
  }

  // ── Stats bar ──────────────────────────────────────────────
  function renderStats(containerId, list, L) {
    const el = document.getElementById(containerId);
    if (!el || !list.length) return;
    const online = list.filter(t => t.online).length;
    const avg = (list.reduce((s, t) => s + (Number(t.rating) || 0), 0) / list.length).toFixed(1);
    const totalReviews = list.reduce((s, t) => s + (Number(t.reviews) || 0), 0);
    el.innerHTML =
      `<div class="stats-bar-inner">` +
      `<span>💻 <strong>${online}</strong> ${L.online}</span>` +
      `<span class="bar-sep"></span>` +
      `<span>⭐ <strong>${avg}</strong> ${L.rating}</span>` +
      `<span class="bar-sep"></span>` +
      `<span>💬 <strong>${totalReviews.toLocaleString()}</strong> ${L.reviews}</span>` +
      `</div>`;
    el.className = 'stats-bar';
  }

  // ── Mood match overlay ─────────────────────────────────────
  let _moodCb = null, _moodResult = {};

  function showMoodMatch(L, onComplete) {
    if (sessionStorage.getItem('tb_mood')) { onComplete({}); return; }
    _moodCb = onComplete;
    _moodResult = {};
    const el = document.createElement('div');
    el.id = 'moodOverlay';
    el.innerHTML = _buildMoodHTML(L);
    document.body.appendChild(el);
    document.body.style.overflow = 'hidden';
    requestAnimationFrame(() => el.classList.add('active'));
  }

  function _buildMoodHTML(L) {
    const step = (n, inner) =>
      `<div class="${n === 1 ? 'mstep mstep-active' : 'mstep'}" id="mstep${n}">${inner}</div>`;
    return `
    <div class="mood-card">
      <button class="mood-skip" onclick="TeraFeatures._skip()">${L.skip}</button>
      <div class="mood-logo">🪷</div>
      ${step(1,
        `<h2 class="mood-title">${L.s1title}</h2>
         <p class="mood-sub">${L.s1sub}</p>
         <div class="mood-grid">
           ${L.moods.map(m => `<button class="mood-opt" onclick="TeraFeatures._p1('${m.cat}')">${m.icon}<span>${m.label}</span></button>`).join('')}
         </div>`
      )}
      ${step(2,
        `<h2 class="mood-title">${L.s2title}</h2>
         <div class="mood-grid">
           ${L.modes.map(m => `<button class="mood-opt" onclick="TeraFeatures._p2('${m.val}')">${m.icon}<span>${m.label}</span></button>`).join('')}
         </div>`
      )}
      ${step(3,
        `<h2 class="mood-title">${L.s3title}</h2>
         <div class="mood-grid">
           ${L.timing.map(m => `<button class="mood-opt" onclick="TeraFeatures._p3('${m.val}')">${m.icon}<span>${m.label}</span></button>`).join('')}
         </div>`
      )}
      <div class="mood-dots">
        <span class="mdot mdot-active" id="mdot1"></span>
        <span class="mdot" id="mdot2"></span>
        <span class="mdot" id="mdot3"></span>
      </div>
    </div>`;
  }

  function _goStep(n) {
    for (let i = 1; i <= 3; i++) {
      document.getElementById(`mstep${i}`)?.classList.toggle('mstep-active', i === n);
      document.getElementById(`mdot${i}`)?.classList.toggle('mdot-active', i === n);
    }
  }

  function _closeMood(result) {
    sessionStorage.setItem('tb_mood', '1');
    const el = document.getElementById('moodOverlay');
    if (el) { el.classList.remove('active'); setTimeout(() => { el.remove(); document.body.style.overflow = ''; }, 330); }
    else { document.body.style.overflow = ''; }
    if (_moodCb) _moodCb(result);
  }

  // ── Floating CTA ───────────────────────────────────────────
  function initFloatingCTA(L, onClick) {
    const old = document.getElementById('floatingCTA');
    if (old) old.remove();
    const btn = document.createElement('button');
    btn.id = 'floatingCTA';
    btn.className = 'floating-cta cta-hidden';
    btn.innerHTML = `<span class="pulse-dot"></span><span class="cta-text">${L.label}</span>`;
    btn.addEventListener('click', onClick);
    document.body.appendChild(btn);
    window.addEventListener('scroll', () => {
      btn.classList.toggle('cta-hidden', window.scrollY < 220);
    }, { passive: true });
  }

  // ── Public API ─────────────────────────────────────────────
  window.TeraFeatures = {
    // favorites
    toggleFav, favButtonHTML,
    isFav: k => _favSet.has(String(k)),
    getFavKeys: () => [..._favSet],
    getFavCount: () => _favSet.size,
    setFavChangeHandler: fn => { _onFavChange = fn; },
    // stats
    renderStats,
    // mood
    showMoodMatch,
    // floating
    initFloatingCTA,
    // mood step handlers (called from inline onclick in overlay HTML)
    _skip: () => _closeMood({}),
    _p1: cat => { _moodResult.cat = cat; _goStep(2); },
    _p2: val => { _moodResult.mode = val; _goStep(3); },
    _p3: val => { _moodResult.timing = val; _closeMood(_moodResult); },
  };
})();
