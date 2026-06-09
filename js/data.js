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
    };
  }

  function normWebsite(v) {
    if (!v) return null;
    return /^https?:\/\//i.test(v) ? v : "https://" + v;
  }
  function normInstagram(v) {
    if (!v) return null;
    if (/^https?:\/\//i.test(v)) return v;
    return "https://instagram.com/" + v.replace(/^@/, "");
  }

  const TeraData = {
    configured,
    client,
    isLive: () => Boolean(client),

    // Render filled/empty stars based on actual rating value.
    starsHTML(rating) {
      const n = Math.min(5, Math.max(0, Math.round(Number(rating) || 0)));
      return '★'.repeat(n) + '<span style="opacity:.3">' + '★'.repeat(5 - n) + '</span>';
    },

    // Language-neutral contact links (website + Instagram) for a therapist
    // card. Returns '' when the therapist has neither. Clients can click through.
    contactLinksHTML(t) {
      const lg = (typeof document!=='undefined' && document.documentElement.lang) || 'he';
      const siteLabel = ({he:'אתר', en:'Website', pt:'Site'})[lg] || 'Website';
      const w = normWebsite(t.website);
      const ig = normInstagram(t.instagram);
      if (!w && !ig) return "";
      const base =
        "display:inline-flex;align-items:center;justify-content:center;width:34px;height:34px;border-radius:50%;background:#ede8f5;text-decoration:none;font-size:16px;transition:background .2s;";
      const a = (href, label, icon) =>
        `<a href="${href}" target="_blank" rel="noopener" title="${label}" aria-label="${label}" onclick="event.stopPropagation()" style="${base}" onmouseover="this.style.background='#d4c6ed'" onmouseout="this.style.background='#ede8f5'">${icon}</a>`;
      return (
        '<div style="display:flex;gap:8px;margin-bottom:14px;">' +
        (w ? a(w, siteLabel, "🌐") : "") +
        (ig ? a(ig, "Instagram", "📸") : "") +
        "</div>"
      );
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
