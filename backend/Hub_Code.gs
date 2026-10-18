/**
 * KIKO Hub – backend (Google Apps Script)
 *
 * One spreadsheet, five tabs (created automatically on first run):
 *   Users            – user_code, PIN, role (parent / ot), name, contact
 *   Children         – child profiles + share code
 *   Access           – which user can see which child
 *   Recommendations  – pre-use sessions (one row per order_code, updated in place)
 *   Feedback         – post-use sessions (one row per session)
 *
 * Every request is a POST with a JSON body: { action, code, pin, ... }
 * Deploy: Deploy → New deployment → Web app → Execute as: Me, Who has access: Anyone.
 */

// Leave empty when the script is opened from the spreadsheet itself (Extensions → Apps Script).
const SPREADSHEET_ID = '';

const MAX_FAILED_LOGINS = 8;      // per user code, then locked for LOCK_MINUTES
const LOCK_MINUTES = 15;
const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // no 0/O/1/I

const SHEETS = {
  Users: ['user_code', 'pin', 'role', 'display_name', 'contact', 'created_at', 'last_login_at', 'status'],
  Children: ['child_id', 'share_code', 'child_alias', 'age_range', 'created_by', 'created_at', 'notes'],
  Access: ['user_code', 'child_id', 'role', 'linked_at'],
  Recommendations: [
    'rec_id', 'created_at', 'updated_at', 'child_id', 'user_code', 'user_role', 'order_code',
    'child_alias', 'age_range', 'respondent_role', 'primary_goal', 'new_place_response',
    'preferred_sensations', 'avoid_sensations', 'preferred_actions', 'intensity',
    'recommended_parts', 'recommended_part_ids', 'final_parts', 'final_part_ids', 'user_changes',
    'kiko_name', 'character_color', 'payload_json'
  ],
  Feedback: [
    'feedback_id', 'created_at', 'child_id', 'user_code', 'user_role', 'linked_order_code',
    'child_alias', 'age_range', 'respondent_role', 'new_place_response', 'usage_location', 'activity_type',
    'initiation', 'parts_tested', 'parts_tested_ids', 'best_part', 'best_part_id', 'best_part_reasons',
    'less_part', 'less_part_id', 'less_part_reasons', 'observed_behaviors', 'independent_exploration_score',
    'outcome', 'adult_response', 'engagement_score', 'use_again', 'future_part_preferences',
    'future_part_text', 'feedback_text', 'payload_json'
  ]
};

/* ---------------- entry points ---------------- */

function doGet() {
  return json_({ ok: true, service: 'KIKO Hub' });
}

function doPost(e) {
  let req = {};
  try {
    const raw = (e && e.postData && e.postData.contents) ||
      (e && e.parameter && e.parameter.payload) || '{}';
    req = JSON.parse(raw);
  } catch (err) {
    return json_({ ok: false, error: 'bad_request' });
  }
  const lock = LockService.getScriptLock();
  lock.waitLock(30000);
  try {
    ensureSheets_();
    const handler = ACTIONS[req.action];
    if (!handler) return json_({ ok: false, error: 'unknown_action' });
    return json_(Object.assign({ ok: true }, handler(req)));
  } catch (err) {
    const msg = String(err && err.message || err);
    const known = ['auth_failed', 'locked', 'no_access', 'not_found', 'invalid_input'];
    return json_({ ok: false, error: known.indexOf(msg) >= 0 ? msg : 'server_error', detail: known.indexOf(msg) >= 0 ? '' : msg });
  } finally {
    lock.releaseLock();
  }
}

/** Run once from the editor to create the tabs (optional – they are also created on first request). */
function setup() { ensureSheets_(); }

/* ---------------- actions ---------------- */

const ACTIONS = {
  ping: () => ({ service: 'KIKO Hub' }),

  register: (r) => {
    const role = r.role === 'ot' ? 'ot' : (r.role === 'parent' ? 'parent' : '');
    const pin = String(r.pin || '');
    const name = clean_(r.name, 60);
    if (!role || !/^\d{4}$/.test(pin) || !name) throw new Error('invalid_input');
    const users = table_('Users');
    let code;
    do { code = 'KIKO-' + randomCode_(5); } while (users.find('user_code', code));
    const now = new Date();
    users.append({ user_code: code, pin: pin, role: role, display_name: name, contact: clean_(r.contact, 120), created_at: now, last_login_at: now, status: 'active' });
    return { user: publicUser_({ user_code: code, role: role, display_name: name }), children: [] };
  },

  login: (r) => {
    const u = auth_(r, true);
    return { user: publicUser_(u), children: childrenFor_(u) };
  },

  children: (r) => {
    const u = auth_(r);
    return { user: publicUser_(u), children: childrenFor_(u) };
  },

  addChild: (r) => {
    const u = auth_(r);
    const alias = clean_(r.child_alias, 40);
    if (!alias) throw new Error('invalid_input');
    const children = table_('Children');
    let id, share;
    do { id = 'C-' + randomCode_(8); } while (children.find('child_id', id));
    do { share = 'KID-' + randomCode_(5); } while (children.find('share_code', share));
    const now = new Date();
    children.append({ child_id: id, share_code: share, child_alias: alias, age_range: clean_(r.age_range, 10), created_by: u.user_code, created_at: now, notes: '' });
    table_('Access').append({ user_code: u.user_code, child_id: id, role: u.role, linked_at: now });
    return { child_id: id, children: childrenFor_(u) };
  },

  linkChild: (r) => {
    const u = auth_(r);
    const share = String(r.share_code || '').trim().toUpperCase();
    const child = table_('Children').find('share_code', share);
    if (!child) throw new Error('not_found');
    const access = table_('Access');
    const exists = access.rows().some(a => a.user_code === u.user_code && a.child_id === child.child_id);
    if (!exists) access.append({ user_code: u.user_code, child_id: child.child_id, role: u.role, linked_at: new Date() });
    return { child_id: child.child_id, children: childrenFor_(u) };
  },

  updateChild: (r) => {
    const u = auth_(r);
    requireAccess_(u, r.child_id);
    const children = table_('Children');
    const c = children.find('child_id', r.child_id);
    if (!c) throw new Error('not_found');
    const patch = {};
    if (r.child_alias) patch.child_alias = clean_(r.child_alias, 40);
    if (r.age_range) patch.age_range = clean_(r.age_range, 10);
    children.update('child_id', r.child_id, patch);
    return { children: childrenFor_(u) };
  },

  /** Parent: what is relevant now. OT: the same plus the full history. */
  childOverview: (r) => {
    const u = auth_(r);
    requireAccess_(u, r.child_id);
    const child = table_('Children').find('child_id', r.child_id);
    if (!child) throw new Error('not_found');
    const recs = table_('Recommendations').rows().filter(x => x.child_id === r.child_id)
      .sort((a, b) => time_(b.updated_at || b.created_at) - time_(a.updated_at || a.created_at));
    const fbs = table_('Feedback').rows().filter(x => x.child_id === r.child_id)
      .sort((a, b) => time_(b.created_at) - time_(a.created_at));
    const names = userNames_();
    const out = {
      child: publicChild_(child, u),
      role: u.role,
      counts: { recommendations: recs.length, feedback: fbs.length },
      current: recs[0] ? recSummary_(recs[0], names) : null,
      last_feedback: fbs[0] ? fbSummary_(fbs[0], names) : null
    };
    if (u.role === 'ot') {
      out.history = recs.map(x => Object.assign({ type: 'recommendation' }, recDetail_(x, names)))
        .concat(fbs.map(x => Object.assign({ type: 'feedback' }, fbDetail_(x, names))))
        .sort((a, b) => time_(b.date) - time_(a.date));
    }
    return out;
  },

  saveRecommendation: (r) => {
    const u = auth_(r);
    requireAccess_(u, r.child_id);
    const d = r.data || {};
    const recs = table_('Recommendations');
    const orderCode = clean_(d.order_code, 40);
    const existing = orderCode ? recs.rows().filter(x => x.child_id === r.child_id && x.order_code === orderCode)[0] : null;
    const now = new Date();
    const row = {
      updated_at: now, child_id: r.child_id, user_code: u.user_code, user_role: u.role, order_code: orderCode,
      child_alias: clean_(d.child_alias, 40), age_range: clean_(d.age_range, 10), respondent_role: clean_(d.respondent_role, 20),
      primary_goal: join_(d.primary_goal), new_place_response: clean_(d.new_place_response, 40),
      preferred_sensations: join_(d.preferred_sensations), avoid_sensations: join_(d.avoid_sensations),
      preferred_actions: join_(d.preferred_actions), intensity: clean_(d.intensity, 20),
      recommended_parts: join_(d.recommended_parts), recommended_part_ids: join_(d.recommended_part_ids),
      final_parts: join_(d.final_parts), final_part_ids: join_(d.final_part_ids),
      user_changes: d.user_changes ? 'yes' : 'no', kiko_name: clean_(d.kiko_name, 40),
      character_color: clean_(d.character_color, 20), payload_json: JSON.stringify(d).slice(0, 45000)
    };
    if (existing) {
      recs.update('rec_id', existing.rec_id, row);
      return { rec_id: existing.rec_id, updated_existing: true };
    }
    row.rec_id = Utilities.getUuid();
    row.created_at = now;
    recs.append(row);
    syncChildFromSurvey_(r.child_id, d);
    return { rec_id: row.rec_id, updated_existing: false };
  },

  saveFeedback: (r) => {
    const u = auth_(r);
    requireAccess_(u, r.child_id);
    const d = r.data || {};
    const row = {
      feedback_id: Utilities.getUuid(), created_at: new Date(), child_id: r.child_id, user_code: u.user_code,
      user_role: u.role, linked_order_code: clean_(d.linked_order_code, 40),
      child_alias: clean_(d.child_name || d.child_alias, 40), age_range: clean_(d.age_range, 10),
      respondent_role: clean_(d.respondent_role, 20), new_place_response: clean_(d.new_place_response, 40),
      usage_location: join_(d.usage_location), activity_type: join_(d.activity_type), initiation: clean_(d.initiation, 40),
      parts_tested: join_(d.parts_tested_names), parts_tested_ids: join_(d.parts_tested_ids),
      best_part: clean_(d.best_part_name, 60), best_part_id: clean_(d.best_part_id, 40), best_part_reasons: join_(d.best_part_reasons),
      less_part: clean_(d.less_part_name, 60), less_part_id: clean_(d.less_part_id, 40), less_part_reasons: join_(d.less_part_reasons),
      observed_behaviors: join_(d.observed_behaviors), independent_exploration_score: clean_(d.independent_exploration_score, 40),
      outcome: clean_(d.outcome, 40), adult_response: join_(d.adult_response), engagement_score: clean_(d.engagement_score, 40),
      use_again: clean_(d.use_again, 40), future_part_preferences: join_(d.future_part_preferences),
      future_part_text: clean_(d.future_part_text, 1000), feedback_text: clean_(d.feedback_text, 2000),
      payload_json: JSON.stringify(d).slice(0, 45000)
    };
    table_('Feedback').append(row);
    syncChildFromSurvey_(r.child_id, d);
    return { feedback_id: row.feedback_id };
  }
};

/* ---------------- auth & access ---------------- */

function auth_(r, isLogin) {
  const code = String(r.code || '').trim().toUpperCase();
  const pin = String(r.pin || '').trim();
  if (!code || !pin) throw new Error('auth_failed');
  const cache = CacheService.getScriptCache();
  const key = 'fail_' + code;
  const fails = Number(cache.get(key) || 0);
  if (fails >= MAX_FAILED_LOGINS) throw new Error('locked');
  const users = table_('Users');
  const u = users.find('user_code', code);
  if (!u || String(u.pin) !== pin || u.status === 'disabled') {
    cache.put(key, String(fails + 1), LOCK_MINUTES * 60);
    throw new Error('auth_failed');
  }
  if (fails) cache.remove(key);
  if (isLogin) users.update('user_code', code, { last_login_at: new Date() });
  return u;
}

function requireAccess_(u, childId) {
  const ok = table_('Access').rows().some(a => a.user_code === u.user_code && a.child_id === childId);
  if (!ok) throw new Error('no_access');
}

function childrenFor_(u) {
  const ids = table_('Access').rows().filter(a => a.user_code === u.user_code).map(a => a.child_id);
  const kids = table_('Children').rows().filter(c => ids.indexOf(c.child_id) >= 0);
  const recs = table_('Recommendations').rows();
  const fbs = table_('Feedback').rows();
  return kids.map(c => {
    const out = publicChild_(c, u);
    const cr = recs.filter(x => x.child_id === c.child_id);
    const cf = fbs.filter(x => x.child_id === c.child_id);
    out.recommendations = cr.length;
    out.feedback = cf.length;
    const dates = cr.map(x => time_(x.updated_at || x.created_at)).concat(cf.map(x => time_(x.created_at)));
    out.last_activity = dates.length ? new Date(Math.max.apply(null, dates)).toISOString() : '';
    return out;
  });
}

/* ---------------- shaping responses ---------------- */

function publicUser_(u) { return { code: u.user_code, role: u.role, name: u.display_name }; }

function publicChild_(c, u) {
  return { child_id: c.child_id, share_code: c.share_code, child_alias: c.child_alias, age_range: c.age_range, created_at: iso_(c.created_at), mine: c.created_by === u.user_code };
}

function recSummary_(x, names) {
  return { date: iso_(x.updated_at || x.created_at), order_code: x.order_code, final_part_ids: split_(x.final_part_ids), final_parts: split_(x.final_parts), kiko_name: x.kiko_name, character_color: x.character_color, by: names[x.user_code] || '', by_role: x.user_role };
}
function recDetail_(x, names) {
  return Object.assign(recSummary_(x, names), {
    respondent_role: x.respondent_role, primary_goal: split_(x.primary_goal), new_place_response: x.new_place_response,
    preferred_sensations: split_(x.preferred_sensations), avoid_sensations: split_(x.avoid_sensations),
    preferred_actions: split_(x.preferred_actions), intensity: x.intensity,
    recommended_part_ids: split_(x.recommended_part_ids), recommended_parts: split_(x.recommended_parts), user_changes: x.user_changes
  });
}
function fbSummary_(x, names) {
  return { date: iso_(x.created_at), best_part: x.best_part, best_part_id: x.best_part_id, use_again: x.use_again, engagement_score: x.engagement_score, by: names[x.user_code] || '', by_role: x.user_role };
}
function fbDetail_(x, names) {
  return Object.assign(fbSummary_(x, names), {
    linked_order_code: x.linked_order_code, usage_location: split_(x.usage_location), activity_type: split_(x.activity_type),
    initiation: x.initiation, parts_tested: split_(x.parts_tested), parts_tested_ids: split_(x.parts_tested_ids),
    best_part_reasons: split_(x.best_part_reasons), less_part: x.less_part, less_part_id: x.less_part_id,
    less_part_reasons: split_(x.less_part_reasons), observed_behaviors: split_(x.observed_behaviors),
    independent_exploration_score: x.independent_exploration_score, outcome: x.outcome,
    adult_response: split_(x.adult_response), future_part_preferences: split_(x.future_part_preferences),
    future_part_text: x.future_part_text, feedback_text: x.feedback_text
  });
}

function userNames_() {
  const m = {};
  table_('Users').rows().forEach(u => { m[u.user_code] = u.display_name; });
  return m;
}

/** Keep the child profile's age up to date with what the latest survey said. */
function syncChildFromSurvey_(childId, d) {
  if (d && d.age_range) table_('Children').update('child_id', childId, { age_range: clean_(d.age_range, 10) });
}

/* ---------------- tiny table helper ---------------- */

function ss_() { return SPREADSHEET_ID ? SpreadsheetApp.openById(SPREADSHEET_ID) : SpreadsheetApp.getActiveSpreadsheet(); }

function ensureSheets_() {
  const ss = ss_();
  Object.keys(SHEETS).forEach(name => {
    let sh = ss.getSheetByName(name);
    if (!sh) sh = ss.insertSheet(name);
    if (sh.getLastRow() === 0) {
      sh.getRange(1, 1, 1, SHEETS[name].length).setValues([SHEETS[name]]);
      sh.setFrozenRows(1);
    }
  });
}

function table_(name) {
  const sh = ss_().getSheetByName(name);
  const header = sh.getRange(1, 1, 1, sh.getLastColumn()).getValues()[0].map(String);
  // add any new columns from SHEETS that the live sheet does not have yet
  SHEETS[name].forEach(col => {
    if (header.indexOf(col) < 0) { header.push(col); sh.getRange(1, header.length).setValue(col); }
  });
  let cache = null;
  const rows = () => {
    if (cache) return cache;
    const n = sh.getLastRow() - 1;
    if (n <= 0) return (cache = []);
    const vals = sh.getRange(2, 1, n, header.length).getValues();
    cache = vals.map((v, i) => {
      const o = { _row: i + 2 };
      header.forEach((h, j) => { o[h] = (h === 'pin' || h.indexOf('code') >= 0 || h.indexOf('_id') >= 0) ? String(v[j]) : v[j]; });
      return o;
    });
    return cache;
  };
  return {
    rows: rows,
    find: (col, val) => rows().filter(r => String(r[col]) === String(val))[0] || null,
    append: (obj) => {
      const line = header.map(h => (obj[h] === undefined ? '' : obj[h]));
      // text format for everything except dates, so Sheets never turns a PIN like "0412" into 412
      const formats = line.map(v => (v instanceof Date ? 'yyyy-mm-dd hh:mm' : '@'));
      const range = sh.getRange(sh.getLastRow() + 1, 1, 1, line.length);
      range.setNumberFormats([formats]);
      range.setValues([line]);
      cache = null;
    },
    update: (keyCol, keyVal, patch) => {
      const r = rows().filter(x => String(x[keyCol]) === String(keyVal))[0];
      if (!r) return false;
      Object.keys(patch).forEach(k => {
        const j = header.indexOf(k);
        if (j >= 0) {
          const cell = sh.getRange(r._row, j + 1);
          if (patch[k] instanceof Date) cell.setNumberFormat('yyyy-mm-dd hh:mm'); else cell.setNumberFormat('@');
          cell.setValue(patch[k]);
        }
      });
      cache = null;
      return true;
    }
  };
}

/* ---------------- utils ---------------- */

function json_(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
function randomCode_(n) { let s = ''; for (let i = 0; i < n; i++) s += CODE_ALPHABET.charAt(Math.floor(Math.random() * CODE_ALPHABET.length)); return s; }
function clean_(v, max) { return String(v == null ? '' : v).replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max || 200); }
function join_(v) { return Array.isArray(v) ? v.map(x => clean_(x, 80)).join(' | ') : clean_(v, 500); }
function split_(v) { return String(v || '').split(' | ').map(s => s.trim()).filter(Boolean); }
function time_(v) { const t = v instanceof Date ? v.getTime() : new Date(v).getTime(); return isNaN(t) ? 0 : t; }
function iso_(v) { const t = time_(v); return t ? new Date(t).toISOString() : ''; }
