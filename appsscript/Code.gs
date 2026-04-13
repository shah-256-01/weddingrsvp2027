// ═══════════════════════════════════════════════════════
// WEDDING RSVP — Google Apps Script Backend
// Deploy as Web App: Execute as Me, Access: Anyone
// ═══════════════════════════════════════════════════════

const SHEET_ID  = '1vMYAD7IvF3sz-10oRRkeqg2R-xHrVhwQ5d__Vo53fEc';
const ADMIN_PIN = '2027'; // ← change before going live

const TABS = {
  events:       'Events',
  guests:       'Guests',
  rsvpByFamily: 'RSVPs_by_family',
  rsvpByEvent:  'RSVPs_by_event',
};

const EVENT_IDS = ['L','S','A','G','W','B'];

// ── Routing ──────────────────────────────────────────────
function doGet(e) {
  // Serve admin panel
  if (e && e.parameter && e.parameter.page === 'admin') {
    return HtmlService
      .createHtmlOutputFromFile('admin')
      .setTitle('Wedding Admin');
  }
  // Validate guest — ?action=validate&code=LW2027&firstName=John&lastName=Smith
  if (e && e.parameter && e.parameter.action === 'validate') {
    try {
      const result = validateGuest(
        e.parameter.code        || '',
        e.parameter.firstName   || '',
        e.parameter.lastName    || ''
      );
      return jsonResponse({ ok: true, data: result });
    } catch (err) {
      return jsonResponse({ ok: false, error: err.message });
    }
  }
  // Default — return active events
  try {
    return jsonResponse({ ok: true, data: getEvents() });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message });
  }
}

function doPost(e) {
  try {
    const body    = JSON.parse(e.postData.contents);
    const { action, payload = {} } = body;
    let result;
    if      (action === 'submitRSVP')       result = submitRSVP(payload);
    else if (action === 'addGuest')         result = addGuest(payload);
    else if (action === 'updateGuest')      result = updateGuest(payload);
    else if (action === 'deleteGuest')      result = deleteGuest(payload);
    else if (action === 'restoreGuest')     result = restoreGuest(payload);
    else if (action === 'bulkAddGuests')    result = bulkAddGuests(payload);
    else if (action === 'getGuests')        result = getGuests();
    else if (action === 'getDeletedGuests') result = getDeletedGuests();
    else if (action === 'getStats')         result = getStats();
    else if (action === 'getDuplicates')    result = getDuplicates();
    else if (action === 'getSubmittedCodes') result = getSubmittedCodes();
    else if (action === 'checkPin')         result = { ok: String(payload.pin) === String(ADMIN_PIN) };
    else throw new Error('Unknown action: ' + action);
    return jsonResponse({ ok: true, data: result });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message });
  }
}

function jsonResponse(obj) {
  return ContentService
    .createTextOutput(JSON.stringify(obj))
    .setMimeType(ContentService.MimeType.JSON);
}

// ── Sheet helpers ─────────────────────────────────────────
function getSheet(name) {
  const ss    = SpreadsheetApp.openById(SHEET_ID);
  const sheet = ss.getSheetByName(name);
  if (!sheet) throw new Error('Tab not found: ' + name);
  return sheet;
}

function sheetToObjects(sheet) {
  const data = sheet.getDataRange().getValues();
  if (data.length < 2) return [];
  const headers = data[0];
  return data.slice(1).map(row =>
    Object.fromEntries(headers.map((h, i) => [h, row[i]]))
  );
}

function findRowById(sheet, id) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) return i + 1;
  }
  return -1;
}

function guestHeaders() {
  const fixed = ['id','first_name','last_name','phone','email','relationship','notes','events','invitation_code','is_overseas','status'];
  const alloc = EVENT_IDS.flatMap(id => [id + '_adults', id + '_children']);
  return [...fixed, ...alloc];
}

// ── getEvents ─────────────────────────────────────────────
function getEvents() {
  const sheet = getSheet(TABS.events);
  if (sheet.getLastRow() < 2) {
    Logger.log('Warning: Events tab is empty. Run setupSheet() to seed events.');
    return [];
  }
  return sheetToObjects(sheet)
    .filter(r => String(r.active).toUpperCase() === 'TRUE')
    .sort((a, b) => String(a.id).localeCompare(String(b.id)));
}

// ── Name normalisation ───────────────────────────────────
function normaliseName(str) {
  return String(str || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/['\u2018\u2019]/g, '')
    .replace(/[-]/g, ' ')
    .trim();
}

// ── validateGuest ─────────────────────────────────────────
// Called via GET ?action=validate&code=...&firstName=...&lastName=...
// Returns guest record with allocations if match found, error if not
function validateGuest(code, firstName, lastName) {
  if (!code || !firstName || !lastName) {
    throw new Error('Code, first name and last name are required.');
  }

  const guests    = getGuests();
  const normFirst = normaliseName(firstName);
  const normLast  = normaliseName(lastName);
  const normCode  = code.toUpperCase().trim();

  const match = guests.find(g =>
    String(g.invitation_code || '').toUpperCase().trim() === normCode &&
    normaliseName(g.first_name) === normFirst &&
    normaliseName(g.last_name)  === normLast
  );

  if (!match) throw new Error('No matching guest found. Please check your name and code.');

  // Build allocations object per event
  const eventIds = String(match.events).split(',')
    .map(s => s.trim()).filter(Boolean)
    .sort((a, b) => a.localeCompare(b));

  const allocations = {};
  eventIds.forEach(id => {
    allocations[id] = {
      adults:   Number(match[id + '_adults'])   || 0,
      children: Number(match[id + '_children']) || 0,
    };
  });

  return {
    id:             match.id,
    firstName:      match.first_name,
    lastName:       match.last_name,
    familyName:     match.first_name + ' ' + match.last_name,
    invitationCode: match.invitation_code,
    events:         eventIds,
    allocations,
    isOverseas:     String(match.is_overseas || '').toUpperCase() === 'TRUE',
  };
}

// ── getGuests ─────────────────────────────────────────────
function getGuests(includeDeleted) {
  const sheet = getSheet(TABS.guests);
  if (sheet.getLastRow() < 1) return [];
  const all = sheetToObjects(sheet);
  if (includeDeleted) return all;
  return all.filter(g => String(g.status).toUpperCase() !== 'DELETED');
}

// ── getDeletedGuests ─────────────────────────────────────
function getDeletedGuests() {
  const sheet = getSheet(TABS.guests);
  if (sheet.getLastRow() < 1) return [];
  return sheetToObjects(sheet).filter(g => String(g.status).toUpperCase() === 'DELETED');
}

// ── addGuest ──────────────────────────────────────────────
function addGuest(payload) {
  const sheet   = getSheet(TABS.guests);
  const headers = guestHeaders();

  // Ensure headers exist
  if (sheet.getLastRow() < 1) {
    sheet.appendRow(headers);
  }

  // Generate invitation_code from sorted event IDs
  const sortedIds = (Array.isArray(payload.events) ? payload.events : String(payload.events || '').split(','))
    .map(s => s.trim()).filter(Boolean)
    .sort((a, b) => a.localeCompare(b));
  payload.invitation_code = sortedIds.join('') + '2027';

  const id  = 'g-' + Date.now();
  const row = headers.map(h => {
    if (h === 'id') return id;
    if (h === 'events') return sortedIds.join(',');
    return payload[h] !== undefined ? payload[h] : '';
  });
  sheet.appendRow(row);
  return { ...payload, id };
}

// ── updateGuest ───────────────────────────────────────────
function updateGuest(payload) {
  const sheet  = getSheet(TABS.guests);
  const rowNum = findRowById(sheet, payload.id);
  if (rowNum === -1) throw new Error('Guest not found: ' + payload.id);

  // Regenerate invitation_code from sorted event IDs
  if (payload.events !== undefined) {
    const sortedIds = (Array.isArray(payload.events) ? payload.events : String(payload.events || '').split(','))
      .map(s => s.trim()).filter(Boolean)
      .sort((a, b) => a.localeCompare(b));
    payload.events = sortedIds.join(',');
    payload.invitation_code = sortedIds.join('') + '2027';
  }

  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  headers.forEach((h, i) => {
    if (h === 'id') return;
    if (payload[h] !== undefined) {
      sheet.getRange(rowNum, i + 1).setValue(payload[h]);
    }
  });
  return { ...payload };
}

// ── deleteGuest (soft delete) ─────────────────────────────
function deleteGuest(payload) {
  const sheet  = getSheet(TABS.guests);
  const rowNum = findRowById(sheet, payload.id);
  if (rowNum === -1) throw new Error('Guest not found: ' + payload.id);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const statusCol = headers.indexOf('status');
  if (statusCol === -1) throw new Error('status column not found — run setupSheet first');
  sheet.getRange(rowNum, statusCol + 1).setValue('DELETED');
  const codeCol = headers.indexOf('invitation_code');
  if (codeCol > -1) {
    const code = sheet.getRange(rowNum, codeCol + 1).getValue();
    if (code) markRSVPRowsDeleted(String(code));
  }
  return { deleted: true, id: payload.id };
}

function markRSVPRowsDeleted(invitationCode) {
  const normCode = String(invitationCode).toUpperCase().trim();
  [TABS.rsvpByFamily, TABS.rsvpByEvent].forEach(tabName => {
    try {
      const sheet = getSheet(tabName);
      if (sheet.getLastRow() < 2) return;
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const statusIdx = headers.indexOf('status');
      const codeIdx   = headers.indexOf('invitation_code');
      if (statusIdx === -1 || codeIdx === -1) return;
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][codeIdx]).toUpperCase().trim() === normCode) {
          sheet.getRange(i + 1, statusIdx + 1).setValue('DELETED');
        }
      }
    } catch (e) { /* tab may not exist yet */ }
  });
}

// ── restoreGuest ─────────────────────────────────────────
function restoreGuest(payload) {
  const sheet  = getSheet(TABS.guests);
  const rowNum = findRowById(sheet, payload.id);
  if (rowNum === -1) throw new Error('Guest not found: ' + payload.id);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const statusCol = headers.indexOf('status');
  if (statusCol === -1) throw new Error('status column not found');
  sheet.getRange(rowNum, statusCol + 1).setValue('');
  const codeCol = headers.indexOf('invitation_code');
  if (codeCol > -1) {
    const code = sheet.getRange(rowNum, codeCol + 1).getValue();
    if (code) restoreRSVPRows(String(code));
  }
  return { restored: true, id: payload.id };
}

function restoreRSVPRows(invitationCode) {
  const normCode = String(invitationCode).toUpperCase().trim();
  [TABS.rsvpByFamily, TABS.rsvpByEvent].forEach(tabName => {
    try {
      const sheet = getSheet(tabName);
      if (sheet.getLastRow() < 2) return;
      const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
      const statusIdx = headers.indexOf('status');
      const codeIdx   = headers.indexOf('invitation_code');
      if (statusIdx === -1 || codeIdx === -1) return;
      const data = sheet.getDataRange().getValues();
      for (let i = 1; i < data.length; i++) {
        if (String(data[i][codeIdx]).toUpperCase().trim() === normCode) {
          sheet.getRange(i + 1, statusIdx + 1).setValue('');
        }
      }
    } catch (e) { /* tab may not exist yet */ }
  });
}

// ── bulkAddGuests ─────────────────────────────────────────
// payload.guests = array of guest objects from CSV upload
function bulkAddGuests(payload) {
  const sheet   = getSheet(TABS.guests);
  const headers = guestHeaders();

  if (sheet.getLastRow() < 1) {
    sheet.appendRow(headers);
  }

  const results = { added: 0, skipped: 0, errors: [] };
  (payload.guests || []).forEach((g, idx) => {
    try {
      if (!g.first_name || !g.last_name) {
        results.skipped++;
        results.errors.push('Row ' + (idx + 2) + ': missing first_name or last_name');
        return;
      }
      const id  = 'g-' + Date.now() + '-' + idx;
      // Generate invitation_code from sorted event IDs
      const sortedEvIds = (Array.isArray(g.events) ? g.events : String(g.events || '').split(','))
        .map(s => s.trim()).filter(Boolean)
        .sort((a, b) => a.localeCompare(b));
      g.invitation_code = sortedEvIds.join('') + '2027';
      const row = headers.map(h => {
        if (h === 'id') return id;
        if (h === 'events') return sortedEvIds.join(',');
        return g[h] !== undefined ? g[h] : '';
      });
      sheet.appendRow(row);
      results.added++;
      // Small pause to avoid quota limits on large uploads
      if (idx > 0 && idx % 50 === 0) Utilities.sleep(500);
    } catch (err) {
      results.skipped++;
      results.errors.push('Row ' + (idx + 2) + ': ' + err.message);
    }
  });
  return results;
}

// ── submitRSVP ────────────────────────────────────────────
function submitRSVP(payload) {
  const { submissionName, events, submittedAt } = payload;
  const invitationCode = String(payload.invitationCode || '').toUpperCase().trim();
  const ts = submittedAt || new Date().toISOString();

  // RSVPs_by_event (tall)
  const byEventSheet = getSheet(TABS.rsvpByEvent);
  if (byEventSheet.getLastRow() < 1) {
    byEventSheet.appendRow([
      'timestamp','submission_name','invitation_code',
      'event_id','event_name','attending','adults','children','notes','status'
    ]);
  }
  events.forEach(ev => {
    byEventSheet.appendRow([
      ts, submissionName, invitationCode,
      ev.id, ev.name,
      ev.attending ? 'Yes' : 'No',
      ev.attending ? (ev.adults   || 0) : 0,
      ev.attending ? (ev.children || 0) : 0,
      ev.notes || '',
      '',
    ]);
  });

  // RSVPs_by_family (wide)
  const byFamilySheet = getSheet(TABS.rsvpByFamily);
  let headers;
  if (byFamilySheet.getLastRow() < 1) {
    headers = ['timestamp','submission_name','invitation_code','status'];
    events.forEach(ev => {
      headers.push(
        ev.name + ' Attending', ev.name + ' Adults',
        ev.name + ' Children',  ev.name + ' Notes'
      );
    });
    byFamilySheet.appendRow(headers);
  } else {
    headers = byFamilySheet
      .getRange(1, 1, 1, byFamilySheet.getLastColumn())
      .getValues()[0];
    // Ensure status column exists
    if (!headers.includes('status')) {
      byFamilySheet.getRange(1, headers.length + 1).setValue('status');
      headers.push('status');
    }
    events.forEach(ev => {
      [' Attending',' Adults',' Children',' Notes'].forEach(suffix => {
        const col = ev.name + suffix;
        if (!headers.includes(col)) {
          byFamilySheet.getRange(1, headers.length + 1).setValue(col);
          headers.push(col);
        }
      });
    });
  }

  const row = new Array(headers.length).fill('');
  row[headers.indexOf('timestamp')]       = ts;
  row[headers.indexOf('submission_name')] = submissionName;
  row[headers.indexOf('invitation_code')] = invitationCode;
  events.forEach(ev => {
    const a  = headers.indexOf(ev.name + ' Attending');
    const ad = headers.indexOf(ev.name + ' Adults');
    const c  = headers.indexOf(ev.name + ' Children');
    const n  = headers.indexOf(ev.name + ' Notes');
    if (a  > -1) row[a]  = ev.attending ? 'Yes' : 'No';
    if (ad > -1) row[ad] = ev.attending ? (ev.adults   || 0) : 0;
    if (c  > -1) row[c]  = ev.attending ? (ev.children || 0) : 0;
    if (n  > -1) row[n]  = ev.notes || '';
  });
  byFamilySheet.appendRow(row);

  return { submitted: true };
}

// ── getRSVPsByFamily ──────────────────────────────────────
function getRSVPsByFamily() {
  return sheetToObjects(getSheet(TABS.rsvpByFamily));
}

// ── getStats ──────────────────────────────────────────────
function getStats() {
  const guests   = getGuests();                // already excludes DELETED
  const activeGuestCodes = new Set(guests.map(g => String(g.invitation_code || '').toUpperCase().trim()));

  const byEventAll  = sheetToObjects(getSheet(TABS.rsvpByEvent));
  const byFamilyAll = sheetToObjects(getSheet(TABS.rsvpByFamily));

  // Filter out DELETED RSVP rows
  const byEvent  = byEventAll.filter(r => String(r.status).toUpperCase() !== 'DELETED');
  const byFamily = byFamilyAll.filter(r => String(r.status).toUpperCase() !== 'DELETED');

  // ── Deduplicate submissions ──────────────────────────
  const latestByCode = {};
  byFamily.forEach(row => {
    const code = String(row.invitation_code || '').toUpperCase().trim();
    if (!code) return;
    if (!activeGuestCodes.has(code)) return;   // orphaned submission
    if (
      !latestByCode[code] ||
      new Date(row.timestamp) > new Date(latestByCode[code].timestamp)
    ) {
      latestByCode[code] = row;
    }
  });
  const dedupedSubmissions = Object.values(latestByCode);
  const submittedCodes     = new Set(Object.keys(latestByCode));

  // ── Overall guest counts ─────────────────────────────
  let totalInvitedAdults = 0, totalInvitedChildren = 0;
  guests.forEach(g => {
    let maxAdults = 0, maxChildren = 0;
    EVENT_IDS.forEach(id => {
      const a = Number(g[id + '_adults'])   || 0;
      const c = Number(g[id + '_children']) || 0;
      if (a > maxAdults)   maxAdults   = a;
      if (c > maxChildren) maxChildren = c;
    });
    totalInvitedAdults   += maxAdults;
    totalInvitedChildren += maxChildren;
  });

  // ── Per-event breakdown ──────────────────────────────
  const perEvent = {};
  EVENT_IDS.forEach(id => {
    perEvent[id] = {
      id,
      invitedGuests:    0,
      invitedAdults:    0,
      invitedChildren:  0,
      attending:        0,
      attendingAdults:  0,
      attendingChildren:0,
      declined:         0,
      pending:          0,
    };
  });

  guests.forEach(g => {
    const eventIds = String(g.events || '').split(',').map(s => s.trim()).filter(Boolean);
    eventIds.forEach(id => {
      if (!perEvent[id]) return;
      perEvent[id].invitedGuests++;
      perEvent[id].invitedAdults   += Number(g[id + '_adults'])   || 0;
      perEvent[id].invitedChildren += Number(g[id + '_children']) || 0;
    });
  });

  // Deduplicate byEvent rows — keep only rows whose code is in dedupedSubmissions
  const dedupedEventCodes = new Set(Object.keys(latestByCode));

  byEvent.forEach(row => {
    const id   = row.event_id;
    const code = String(row.invitation_code || '').toUpperCase().trim();
    if (!perEvent[id]) return;
    if (!dedupedEventCodes.has(code)) return;

    if (String(row.attending).toLowerCase() === 'yes') {
      perEvent[id].attending++;
      perEvent[id].attendingAdults   += Number(row.adults)   || 0;
      perEvent[id].attendingChildren += Number(row.children) || 0;
    } else {
      perEvent[id].declined++;
    }
  });

  EVENT_IDS.forEach(id => {
    const invitedCodes = new Set(
      guests
        .filter(g => String(g.events || '').split(',').map(s=>s.trim()).includes(id))
        .map(g => String(g.invitation_code || '').toUpperCase().trim())
    );
    let pending = 0;
    invitedCodes.forEach(code => {
      if (code && !submittedCodes.has(code)) pending++;
    });
    perEvent[id].pending = Math.max(0, pending);
  });

  // Confirmed adults/children — avoid double counting across events
  const allEventsData = getEvents();
  let finalConfirmedAdults = 0, finalConfirmedChildren = 0;
  dedupedSubmissions.forEach(row => {
    let maxA = 0, maxC = 0;
    allEventsData.forEach(evt => {
      const a = Number(row[evt.name + ' Adults'])   || 0;
      const c = Number(row[evt.name + ' Children']) || 0;
      if (String(row[evt.name + ' Attending']).toLowerCase() === 'yes') {
        if (a > maxA) maxA = a;
        if (c > maxC) maxC = c;
      }
    });
    finalConfirmedAdults   += maxA;
    finalConfirmedChildren += maxC;
  });

  return {
    totalGuests:           guests.length,
    rsvpd:                 submittedCodes.size,
    pending:               Math.max(0, guests.length - submittedCodes.size),
    totalInvitedAdults,
    totalInvitedChildren,
    confirmedAdults:       finalConfirmedAdults,
    confirmedChildren:     finalConfirmedChildren,
    duplicates:            Math.max(0, byFamily.length - dedupedSubmissions.length),
    perEvent:              Object.values(perEvent),
  };
}

// ── getDuplicates ─────────────────────────────────────────
function getDuplicates() {
  const sheet = getSheet(TABS.rsvpByFamily);
  if (sheet.getLastRow() < 2) return [];
  const rows    = sheetToObjects(sheet).filter(r => String(r.status).toUpperCase() !== 'DELETED');
  const counts  = {};
  const byCode  = {};

  rows.forEach(r => {
    const code = String(r.invitation_code || '').toUpperCase().trim();
    if (!code) return;
    counts[code] = (counts[code] || 0) + 1;
    if (!byCode[code]) byCode[code] = [];
    byCode[code].push({
      name:      r.submission_name,
      timestamp: r.timestamp,
    });
  });

  return Object.entries(counts)
    .filter(([, n]) => n > 1)
    .map(([code, count]) => ({
      code,
      count,
      submissions: byCode[code].sort(
        (a, b) => new Date(b.timestamp) - new Date(a.timestamp)
      ),
      latestTimestamp: byCode[code]
        .map(s => new Date(s.timestamp))
        .reduce((a, b) => a > b ? a : b)
        .toISOString(),
    }));
}

// ── getSubmittedCodes ─────────────────────────────────────
// Returns deduped list of invitation codes that have at least one active RSVP
function getSubmittedCodes() {
  const sheet = getSheet(TABS.rsvpByFamily);
  if (sheet.getLastRow() < 2) return [];
  const rows = sheetToObjects(sheet).filter(r => String(r.status || '').toUpperCase() !== 'DELETED');
  const latest = {};
  rows.forEach(r => {
    const code = String(r.invitation_code || '').toUpperCase().trim();
    if (!code) return;
    if (!latest[code] || new Date(r.timestamp) > new Date(latest[code].timestamp)) {
      latest[code] = r;
    }
  });
  return Object.keys(latest);
}

// ── checkPin ──────────────────────────────────────────────
function checkPin(pin) {
  return String(pin) === String(ADMIN_PIN);
}

// ── setupSheet ────────────────────────────────────────────
// Run once from Apps Script editor to initialise all tabs
function setupSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);

  // Events
  let evSheet = ss.getSheetByName(TABS.events);
  if (!evSheet) evSheet = ss.insertSheet(TABS.events);
  evSheet.clearContents();
  evSheet.appendRow(['id','name','date','time','venue','icon','active']);
  [
    ['A','Mandvo',           'TBC','TBC','TBC','🎶','TRUE'],
    ['B','Black Tie',        'TBC','TBC','TBC','🎩','TRUE'],
    ['G','Meet & Greet',     'TBC','TBC','TBC','🥂','TRUE'],
    ['L','Lagnotri',         'TBC','TBC','TBC','🪔','TRUE'],
    ['S','Mehendi & Sangeet','TBC','TBC','TBC','🌿','TRUE'],
    ['W','Wedding',          'TBC','TBC','TBC','💍','TRUE'],
  ].forEach(row => evSheet.appendRow(row));

  // Guests
  let gSheet = ss.getSheetByName(TABS.guests);
  if (!gSheet) gSheet = ss.insertSheet(TABS.guests);
  if (gSheet.getLastRow() < 1) gSheet.appendRow(guestHeaders());

  // RSVPs_by_family
  if (!ss.getSheetByName(TABS.rsvpByFamily)) ss.insertSheet(TABS.rsvpByFamily);

  // RSVPs_by_event
  let evRSVP = ss.getSheetByName(TABS.rsvpByEvent);
  if (!evRSVP) {
    evRSVP = ss.insertSheet(TABS.rsvpByEvent);
    evRSVP.appendRow([
      'timestamp','submission_name','invitation_code',
      'event_id','event_name','attending','adults','children','notes','status'
    ]);
  }

  // Ensure status column exists on all data tabs
  ensureStatusColumn(gSheet);
  ensureStatusColumn(ss.getSheetByName(TABS.rsvpByFamily));
  ensureStatusColumn(evRSVP);

  Logger.log('Setup complete. All tabs ready.');
}

function ensureStatusColumn(sheet) {
  if (!sheet || sheet.getLastRow() < 1) return;
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  if (!headers.includes('status')) {
    sheet.getRange(1, headers.length + 1).setValue('status');
  }
}
