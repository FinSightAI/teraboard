// TeraBoard — supplementary UI features
// Stats bar · Favorites · Mood Match overlay · Floating CTA
(function () {
  'use strict';

  // ── Safe storage helpers ───────────────────────────────────
  function lsGet(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || 'null') ?? fallback; }
    catch (e) { return fallback; }
  }
  function lsSet(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); } catch (e) { /* quota / private mode */ }
  }
  function ssGet(key) { try { return sessionStorage.getItem(key); } catch (e) { return null; } }
  function ssSet(key, val) { try { sessionStorage.setItem(key, val); } catch (e) {} }

  // ── Favorites (localStorage) ───────────────────────────────
  const LS_KEY = 'tb_favs';
  let _favSet = new Set(lsGet(LS_KEY, []));
  let _onFavChange = null;

  function toggleFav(key) {
    if (_favSet.has(key)) _favSet.delete(key); else _favSet.add(key);
    lsSet(LS_KEY, [..._favSet]);
    document.querySelectorAll('.fav-btn').forEach(btn => {
      if (btn.dataset.key === String(key)) {
        const on = _favSet.has(key);
        btn.classList.toggle('active', on);
        btn.textContent = on ? '♥' : '♡';
      }
    });
    if (_onFavChange) _onFavChange(_favSet.size);
  }

  function favButtonHTML(key, lang) {
    const label = { he: 'שמור מטפל', en: 'Save therapist', pt: 'Salvar terapeuta' }[lang] || 'Save';
    const active = _favSet.has(String(key));
    return `<button class="fav-btn${active ? ' active' : ''}" data-key="${key}" onclick="event.stopPropagation();TeraFeatures.toggleFav('${key}')" aria-label="${label}">${active ? '♥' : '♡'}</button>`;
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
    // Restore last mood result from session so the filter persists on refresh
    const saved = ssGet('tb_mood_result');
    if (ssGet('tb_mood') && saved) {
      try { onComplete(JSON.parse(saved)); } catch (e) { onComplete({}); }
      return;
    }
    if (ssGet('tb_mood')) { onComplete({}); return; }

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
    ssSet('tb_mood', '1');
    ssSet('tb_mood_result', JSON.stringify(result));
    const el = document.getElementById('moodOverlay');
    if (el) { el.classList.remove('active'); setTimeout(() => { el.remove(); document.body.style.overflow = ''; }, 330); }
    else { document.body.style.overflow = ''; }
    if (_moodCb) _moodCb(result);
  }

  // ── Floating CTA ───────────────────────────────────────────
  let _scrollHandler = null;

  function initFloatingCTA(L, onClick) {
    const old = document.getElementById('floatingCTA');
    if (old) old.remove();
    // Remove previous scroll listener to avoid accumulation
    if (_scrollHandler) window.removeEventListener('scroll', _scrollHandler);

    const btn = document.createElement('button');
    btn.id = 'floatingCTA';
    btn.className = 'floating-cta cta-hidden';
    btn.innerHTML = `<span class="pulse-dot"></span><span class="cta-text">${L.label}</span>`;
    btn.addEventListener('click', onClick);
    document.body.appendChild(btn);

    _scrollHandler = () => btn.classList.toggle('cta-hidden', window.scrollY < 220);
    window.addEventListener('scroll', _scrollHandler, { passive: true });
  }

  // ── Public API ─────────────────────────────────────────────
  window.TeraFeatures = {
    toggleFav, favButtonHTML,
    isFav: k => _favSet.has(String(k)),
    getFavKeys: () => [..._favSet],
    getFavCount: () => _favSet.size,
    setFavChangeHandler: fn => { _onFavChange = fn; },
    renderStats,
    showMoodMatch,
    initFloatingCTA,
    _skip: () => _closeMood({}),
    _p1: cat => { _moodResult.cat = cat; _goStep(2); },
    _p2: val => { _moodResult.mode = val; _goStep(3); },
    _p3: val => { _moodResult.timing = val; _closeMood(_moodResult); },
  };
})();
