// TeraBoard — data layer.
// Talks to Supabase when configured; otherwise transparently falls back to
// the sample array each page already ships with. No build step required.
(function () {
  const cfg = window.TERABOARD_CONFIG || {};
  const configured = Boolean(cfg.supabaseUrl && cfg.supabaseAnonKey);

  // window.supabase is provided by the @supabase/supabase-js UMD CDN bundle.
  const client =
    configured && window.supabase
      ? window.supabase.createClient(cfg.supabaseUrl, cfg.supabaseAnonKey)
      : null;

  // Map a DB row to the shape the card renderer expects (cat, reviews).
  function fromRow(r) {
    return {
      id: r.id,
      name: r.name,
      speciality: r.speciality,
      cat: r.category,
      area: r.area,
      online: r.online,
      price: r.price,
      exp: r.exp,
      rating: Number(r.rating),
      reviews: r.reviews_count,
      initial: r.initial,
      badge: r.badge || undefined,
      website: r.website_url || undefined,
      instagram: r.instagram || undefined,
      photo: r.photo_url || undefined,
      whatsapp: r.whatsapp || undefined,
      video_url: r.video_url || undefined,
      available_today: Boolean(r.available_today),
    };
  }

  function normWebsite(v) {
    if (!v) return null;
    const url = /^https?:\/\//i.test(v) ? v : "https://" + v;
    return /^https:\/\//i.test(url) ? url : null; // only https
  }
  function normInstagram(v) {
    if (!v) return null;
    if (/^https?:\/\//i.test(v)) return /^https:\/\//i.test(v) ? v : null;
    return "https://instagram.com/" + v.replace(/^@/, "").replace(/[^a-zA-Z0-9._]/g, "");
  }
  // HTML-attribute-safe escape for href values
  function escAttr(s) {
    return String(s || "").replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/'/g, "&#39;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  }
  // CSS url()-safe: strip chars that could break out of url('...')
  function safeCssUrl(s) {
    if (!s || !/^https:\/\//i.test(s)) return "";
    return s.replace(/['"\\\n\r\t]/g, "");
  }

  const TeraData = {
    configured,
    client,
    isLive: () => Boolean(client),
    esc: (s) => String(s == null ? "" : s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c])),
    safeCssUrl,

    // Render filled/empty stars based on actual rating value.
    starsHTML(rating) {
      const n = Math.min(5, Math.max(0, Math.round(Number(rating) || 0)));
      return '★'.repeat(n) + '<span style="opacity:.3">' + '★'.repeat(5 - n) + '</span>';
    },

    // Contact links: website + Instagram + WhatsApp. Returns '' when none present.
    contactLinksHTML(t) {
      const lg = (typeof document !== 'undefined' && document.documentElement.lang) || 'he';
      const siteLabel = ({ he:'אתר', en:'Website', pt:'Site' })[lg] || 'Website';
      const w  = normWebsite(t.website);
      const ig = normInstagram(t.instagram);
      // WhatsApp
      let waHref = null;
      if (t.whatsapp) {
        const num = String(t.whatsapp).replace(/\D/g, '');
        if (num.length >= 8) {
          const msgs = {
            he: `שלום ${t.name}, מצאתי את הפרופיל שלך ב-TeraBoard ואשמח לתאם פגישה.`,
            en: `Hi ${t.name}, I found your profile on TeraBoard and would like to book a session.`,
            pt: `Olá ${t.name}, vi seu perfil no TeraBoard e gostaria de agendar uma sessão.`,
          };
          waHref = `https://wa.me/${num}?text=${encodeURIComponent(msgs[lg] || msgs.pt)}`;
        }
      }
      if (!w && !ig && !waHref) return "";
      const base = "display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%;text-decoration:none;font-size:16px;transition:background .2s;";
      const purple = base + "background:#ede8f5;";
      const green  = base + "background:#25d366;";
      const a = (href, label, icon, bg, hov) =>
        `<a href="${escAttr(href)}" target="_blank" rel="noopener noreferrer" title="${escAttr(label)}" aria-label="${escAttr(label)}" onclick="event.stopPropagation()" style="${bg}" onmouseover="this.style.background='${hov}'" onmouseout="this.style.background='${bg.split('background:')[1].replace(';','').trim()}">${icon}</a>`;
      return (
        '<div style="display:flex;gap:8px;margin-bottom:14px;">' +
        (w      ? a(w,      siteLabel,  "🌐", purple, "#d4c6ed") : "") +
        (ig     ? a(ig,     "Instagram","📸", purple, "#d4c6ed") : "") +
        (waHref ? a(waHref, "WhatsApp", "💬", green,  "#128c7e") : "") +
        "</div>"
      );
    },

    // Parse YouTube / Vimeo URL → safe embed URL. Returns null for unknown formats.
    safeEmbedUrl(url) {
      if (!url) return null;
      let m = url.match(/(?:youtube\.com\/watch\?v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
      if (m) return `https://www.youtube-nocookie.com/embed/${m[1]}?rel=0`;
      m = url.match(/vimeo\.com\/(\d+)/);
      if (m) return `https://player.vimeo.com/video/${m[1]}`;
      return null;
    },

    // Returns therapists from Supabase, or the provided fallback array on
    // missing config / network error. Always resolves (never rejects).
    async getTherapists(fallback) {
      if (!client) return fallback || [];
      try {
        const { data, error } = await client
          .from("therapists")
          .select("*")
          .order("rating", { ascending: false });
        if (error) throw error;
        if (!data || !data.length) return fallback || [];
        return data.map(fromRow);
      } catch (e) {
        console.warn("[TeraBoard] Supabase fetch failed, using sample data:", e.message);
        return fallback || [];
      }
    },

    // Persist a booking. Returns {ok:true} or {ok:false, offline:true} when
    // there is no backend yet (the UI still shows a success message).
    async createBooking(payload) {
      if (!client) return { ok: false, offline: true };
      try {
        const { error } = await client.from("bookings").insert(payload);
        if (error) throw error;
        return { ok: true };
      } catch (e) {
        console.warn("[TeraBoard] booking insert failed:", e.message);
        return { ok: false, offline: true };
      }
    },
  };

  window.TeraData = TeraData;
})();
