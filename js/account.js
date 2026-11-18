// Columella – account.js
// IT: account utenti opzionali (Supabase Auth: email e password, conferma via email, reimpostazione password)
//     e salvataggio dei campi dell'utente. Espone il globale Account { init, attivo, utente, onChange, list,
//     save, remove, at } (usato da app.js e tools.js). Dipendenze: window.CAMPI_APERTI (config.js), LANG
//     (app.js), supabase-js v2 caricato da CDN in init(), elementi .topbar e .map-wrap, privacy.html.
// EN: optional user accounts (Supabase Auth) and per-user saved fields. Exposes Account; needs config.js,
//     LANG and supabase-js (loaded from CDN). Disabled when config.js is empty.
//
// Le password non passano mai dal nostro codice verso altri servizi: le gestisce Supabase (hash bcrypt, HTTPS).
// I campi salvati stanno nella tabella "campi" protetta da Row Level Security (ognuno vede solo i propri).
// Se config.js non è compilato, gli account sono semplicemente disattivati e i campi restano nel browser.

const Account = (() => {
  const C = window.CAMPI_APERTI || {};
  const attivo = !!(C.supabaseUrl && C.supabaseAnonKey);
  let sb = null, user = null;
  const listeners = [];   // funzioni chiamate a ogni cambio di utente (onChange)
  const UUID_RE = /^[0-9a-f-]{36}$/;   // id dei campi salvati nel database (gli altri sono solo locali)
  const AT = {
    it: {
      login: "Accedi", logout: "Esci", signup: "Registrati", reset: "Password dimenticata?", email: "Email", pwd: "Password", pwd2: "Ripeti la password",
      title: "Il tuo account", send: "Invia", hello: "Accesso eseguito come {e}", delete: "Elimina il mio account e i miei dati",
      del_q: "Eliminare definitivamente l'account e tutti i campi salvati? L'operazione non si può annullare.", deleted: "Account eliminato.",
      export: "Scarica i miei dati (GeoJSON)", pwd_short: "La password deve avere almeno 10 caratteri, con lettere e numeri.", pwd_diff: "Le due password non coincidono.",
      check_mail: "Ti abbiamo mandato un'email: apri il link per confermare l'indirizzo, poi accedi.", reset_sent: "Se l'indirizzo è registrato riceverai un'email per scegliere una nuova password.",
      new_pwd: "Scegli una nuova password", pwd_ok: "Password aggiornata.", consent: "Ho letto l'<a href='privacy.html' target='_blank'>informativa sulla privacy</a>",
      need_consent: "Per registrarti devi accettare l'informativa.", err: "Errore: {m}", sync: "I tuoi campi sono salvati nel tuo account.",
      share: "Permetto di usare in forma anonima i campi che segno come condivisi per migliorare i modelli",
    },
    en: {
      login: "Sign in", logout: "Sign out", signup: "Sign up", reset: "Forgot password?", email: "Email", pwd: "Password", pwd2: "Repeat password",
      title: "Your account", send: "Send", hello: "Signed in as {e}", delete: "Delete my account and my data",
      del_q: "Permanently delete the account and all saved fields? This cannot be undone.", deleted: "Account deleted.",
      export: "Download my data (GeoJSON)", pwd_short: "The password must have at least 10 characters, with letters and numbers.", pwd_diff: "The two passwords do not match.",
      check_mail: "We sent you an email: open the link to confirm the address, then sign in.", reset_sent: "If the address is registered you will receive an email to choose a new password.",
      new_pwd: "Choose a new password", pwd_ok: "Password updated.", consent: "I have read the <a href='privacy.html' target='_blank'>privacy notice</a>",
      need_consent: "To sign up you must accept the privacy notice.", err: "Error: {m}", sync: "Your fields are saved in your account.",
      share: "I allow fields I mark as shared to be used anonymously to improve the models",
    },
  };
  // testo tradotto con sostituzione dei segnaposto {nome}
  const at = (k, v) => {
    let s = (AT[LANG] || AT.it)[k] ?? k;
    if (v) Object.entries(v).forEach(([a, b]) => (s = s.replace("{" + a + "}", b)));
    return s;
  };
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));

  async function init() {
    if (!attivo) return;
    // carica supabase-js solo se gli account sono attivi
    await new Promise((ok, ko) => {
      const s = document.createElement("script");
      s.src = "https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2/dist/umd/supabase.min.js";
      s.onload = ok; s.onerror = ko;
      document.head.appendChild(s);
    });
    sb = supabase.createClient(C.supabaseUrl, C.supabaseAnonKey, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: "pkce" } });
    const { data } = await sb.auth.getSession();
    user = data.session ? data.session.user : null;
    sb.auth.onAuthStateChange((ev, session) => {
      user = session ? session.user : null;
      if (ev === "PASSWORD_RECOVERY") panel("newpwd");   // arrivo dal link "password dimenticata"
      notify();
    });
    notify();
  }
  function notify() { button(); listeners.forEach((f) => f(user)); }
  // pulsante 👤 nella barra in alto (creato al primo uso)
  function button() {
    let b = document.getElementById("accountBtn");
    if (!b) {
      b = document.createElement("button"); b.id = "accountBtn"; b.className = "account-btn";
      const bar = document.querySelector(".topbar .lang") || document.querySelector(".topbar");
      bar.parentNode.insertBefore(b, bar);
      b.onclick = () => panel(user ? "me" : "login");
    }
    b.textContent = user ? "👤 " + user.email.split("@")[0] : "👤 " + at("login");
  }
  // stessa regola mostrata all'utente in pwd_short
  const strong = (p) => p.length >= 10 && /[a-z]/i.test(p) && /\d/.test(p);
  // scheda account sulla mappa; mode: login | signup | reset | newpwd | me
  function panel(mode) {
    let el = document.getElementById("accountCard");
    if (!el) { el = document.createElement("section"); el.id = "accountCard"; el.className = "tool-card tc-account"; document.querySelector(".map-wrap").appendChild(el); }
    const form = (inner, btn) => `<form id="acForm" autocomplete="on">${inner}<div class="tc-actions"><button class="btn-primary">${btn}</button></div></form><p class="hint small" id="acMsg"></p>`;
    const mail = `<label>${at("email")}<input name="email" type="email" required autocomplete="email"></label>`;
    let body = "";
    if (mode === "login") body = form(mail + `<label>${at("pwd")}<input name="pwd" type="password" required autocomplete="current-password"></label>`, at("login")) +
      `<p class="small"><a href="#" data-m="signup">${at("signup")}</a> · <a href="#" data-m="reset">${at("reset")}</a></p>`;
    if (mode === "signup") body = form(mail + `<label>${at("pwd")}<input name="pwd" type="password" required minlength="10" autocomplete="new-password"></label>
      <label>${at("pwd2")}<input name="pwd2" type="password" required autocomplete="new-password"></label>
      <label class="chk"><input name="ok" type="checkbox"> ${at("consent")}</label>`, at("signup")) + `<p class="small"><a href="#" data-m="login">${at("login")}</a></p>`;
    if (mode === "reset") body = form(mail, at("send")) + `<p class="small"><a href="#" data-m="login">${at("login")}</a></p>`;
    if (mode === "newpwd") body = form(`<label>${at("new_pwd")}<input name="pwd" type="password" required minlength="10" autocomplete="new-password"></label>`, at("send"));
    if (mode === "me") body = `<p>${at("hello", { e: esc(user.email) })}</p><p class="hint small">${at("sync")}</p>
      <div class="tc-actions"><button class="small-btn" id="acExport">${at("export")}</button><button class="small-btn" id="acOut">${at("logout")}</button></div>
      <p><button class="small-btn danger" id="acDel">${at("delete")}</button></p><p class="hint small" id="acMsg"></p>`;
    el.innerHTML = `<div class="tc-head"><b>${at("title")}</b><button class="icon-x">×</button></div><div class="tc-body">${body}</div>`;
    el.querySelector(".icon-x").onclick = () => el.remove();
    el.querySelectorAll("[data-m]").forEach((a) => (a.onclick = (e) => { e.preventDefault(); panel(a.dataset.m); }));
    const msg = (t) => (el.querySelector("#acMsg").textContent = t);
    const f = el.querySelector("#acForm");
    if (f) f.onsubmit = async (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(f));
      let r;
      if (mode === "login") r = await sb.auth.signInWithPassword({ email: d.email, password: d.pwd });
      if (mode === "signup") {
        if (!f.ok.checked) return msg(at("need_consent"));
        if (!strong(d.pwd)) return msg(at("pwd_short"));
        if (d.pwd !== d.pwd2) return msg(at("pwd_diff"));
        r = await sb.auth.signUp({ email: d.email, password: d.pwd, options: { emailRedirectTo: location.origin + location.pathname } });
        if (!r.error) return msg(at("check_mail"));
      }
      if (mode === "reset") { r = await sb.auth.resetPasswordForEmail(d.email, { redirectTo: location.origin + location.pathname }); if (!r.error) return msg(at("reset_sent")); }
      if (mode === "newpwd") { if (!strong(d.pwd)) return msg(at("pwd_short")); r = await sb.auth.updateUser({ password: d.pwd }); if (!r.error) return msg(at("pwd_ok")); }
      if (r && r.error) return msg(at("err", { m: r.error.message }));
      el.remove();
    };
    if (mode === "me") {
      el.querySelector("#acOut").onclick = async () => { await sb.auth.signOut(); el.remove(); };
      el.querySelector("#acExport").onclick = async () => {
        const fc = { type: "FeatureCollection", features: await list() };
        const a = document.createElement("a"); a.href = URL.createObjectURL(new Blob([JSON.stringify(fc)], { type: "application/json" })); a.download = "campi-aperti_miei_dati.geojson"; a.click();
      };
      el.querySelector("#acDel").onclick = async () => {
        if (!confirm(at("del_q"))) return;
        const { error } = await sb.rpc("elimina_il_mio_account");
        if (error) return msg(at("err", { m: error.message }));
        await sb.auth.signOut(); msg(at("deleted"));
      };
    }
  }
  // ---- campi dell'utente
  async function list() {
    if (!sb || !user) return [];
    const { data, error } = await sb.from("campi").select("id,nome,proprieta,geometria,condividi").order("creato");
    if (error) throw error;
    return data.map((r) => ({ type: "Feature", properties: { ...r.proprieta, nome: r.nome, id: r.id, condividi: r.condividi }, geometry: r.geometria }));
  }
  // inserisce o aggiorna (se l'id è già un UUID del database); restituisce l'id
  async function save(f) {
    if (!sb || !user) return null;
    const p = { ...f.properties }, nome = p.nome || null, condividi = !!p.condividi;
    ["id", "nome", "condividi"].forEach((k) => delete p[k]);
    const row = { nome, proprieta: p, geometria: f.geometry, condividi };
    const isUuid = UUID_RE.test(f.properties.id || "");
    const q = isUuid ? sb.from("campi").update(row).eq("id", f.properties.id).select("id") : sb.from("campi").insert(row).select("id");
    const { data, error } = await q;
    if (error) throw error;
    return data[0].id;
  }
  async function remove(id) { if (sb && user && UUID_RE.test(id)) await sb.from("campi").delete().eq("id", id); }
  return { init, attivo: () => attivo, utente: () => user, onChange: (f) => listeners.push(f), list, save, remove, at };
})();
