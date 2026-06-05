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
    };
  }

  const TeraData = {
    configured,
    client,
    isLive: () => Boolean(client),

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
