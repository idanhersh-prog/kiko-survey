/* KIKO Hub – shared client for index.html (hub), pre-use.html and post-use.html */
(function () {
  // Web App URL of backend/Hub_Code.gs (Deploy → Web app). Empty = hub not connected yet.
  const HUB_URL = 'https://script.google.com/macros/s/AKfycbwmBzT-LOuDlIAgQqwqoS0o22gk1y1Eo5BQWddsDwEYS5DFkJZFOfn6Ei38Fqz9-SieBA/exec';

  const AUTH_KEY = 'kiko_auth';
  const CTX_KEY = 'kiko_ctx';

  function hubUrl() {
    try { return localStorage.getItem('kiko_hub_url_override') || HUB_URL; } catch (e) { return HUB_URL; }
  }
  function read(store, key) { try { return JSON.parse(store.getItem(key) || 'null'); } catch (e) { return null; } }
  function write(store, key, val) { try { val == null ? store.removeItem(key) : store.setItem(key, JSON.stringify(val)); } catch (e) {} }

  const ERRORS = {
    auth_failed: 'הקוד או הסיסמה לא נכונים.',
    locked: 'יותר מדי ניסיונות. נסו שוב בעוד 15 דקות.',
    no_access: 'אין לכם גישה לפרופיל הזה.',
    not_found: 'לא מצאנו את הקוד הזה. בדקו שהוא הוקלד נכון.',
    invalid_input: 'חסרים פרטים או שהם לא תקינים.',
    invalid_phone: 'בדקו את מספר הטלפון – למשל 050-1234567.',
    phone_taken: 'המספר הזה כבר רשום. נסו להיכנס.',
    network: 'אין חיבור לשרת כרגע. בדקו את האינטרנט ונסו שוב.',
    not_configured: 'מערכת ההרשמה עדיין בהקמה.'
  };

  async function api(action, payload, opts) {
    const url = hubUrl();
    if (!url) { const e = new Error('not_configured'); e.code = 'not_configured'; throw e; }
    const auth = (opts && opts.noAuth) ? {} : (getAuth() || {});
    let res;
    try {
      res = await fetch(url, { method: 'POST', body: JSON.stringify(Object.assign({ action: action, code: auth.code, pin: auth.pin }, payload || {})) });
    } catch (err) { const e = new Error('network'); e.code = 'network'; throw e; }
    let data;
    try { data = await res.json(); } catch (err) { const e = new Error('network'); e.code = 'network'; throw e; }
    if (!data.ok) { const e = new Error(data.error || 'server_error'); e.code = data.error || 'server_error'; throw e; }
    return data;
  }

  function getAuth() { return read(sessionStorage, AUTH_KEY) || read(localStorage, AUTH_KEY); }
  function setAuth(a, remember) {
    write(sessionStorage, AUTH_KEY, a);
    write(localStorage, AUTH_KEY, remember ? a : null);
  }
  function logout() { write(sessionStorage, AUTH_KEY, null); write(localStorage, AUTH_KEY, null); write(sessionStorage, CTX_KEY, null); }

  /** Context handed from the hub to a survey: which child, current parts, linked order. */
  function setContext(ctx) { write(sessionStorage, CTX_KEY, ctx); }
  function getContext() {
    const ctx = read(sessionStorage, CTX_KEY);
    const auth = getAuth();
    const childParam = new URLSearchParams(location.search).get('child');
    if (!ctx || !auth || !childParam || ctx.child_id !== childParam) return null;
    return Object.assign({ auth: auth }, ctx);
  }

  function errorText(e) { return ERRORS[(e && e.code) || ''] || 'משהו השתבש. נסו שוב.'; }

  window.KikoHub = { api: api, getAuth: getAuth, setAuth: setAuth, logout: logout, setContext: setContext, getContext: getContext, errorText: errorText, isConfigured: function () { return !!hubUrl(); } };
})();
