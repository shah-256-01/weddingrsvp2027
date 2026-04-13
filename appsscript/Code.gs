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
    if      (action === 'submitRSVP')   result = submitRSVP(payload);
    else if (action === 'addGuest')     result = addGuest(payload);
    else if (action === 'updateGuest')  result = updateGuest(payload);
    else if (action === 'deleteGuest')  result = deleteGuest(payload);
    else if (action === 'bulkAddGuests') result = bulkAddGuests(payload);
    else if (action === 'getGuests')    result = getGuests();
    else if (action === 'getStats')     result = getStats();
    else if (action === 'getDuplicates') result = getDuplicates();
    else if (action === 'checkPin')     result = { ok: String(payload.pin) === String(ADMIN_PIN) };
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
  const fixed = ['id','first_name','last_name','phone','email','relationship','notes','events','invitation_code'];
  const alloc = EVENT_IDS.flatMap(id => [id + '_adults', id + '_children']);
  return [...fixed, ...alloc];
}

// ── getEvents ─────────────────────────────────────────────
function getEvents() {
  const sheet = getSheet(TABS.events);
  return sheetToObjects(sheet)
    .filter(r => String(r.active).toUpperCase() === 'TRUE');
}

// ── validateGuest ─────────────────────────────────────────
// Called via GET ?action=validate&code=...&firstName=...&lastName=...
// Returns guest record with allocations if match found, error if not
function validateGuest(code, firstName, lastName) {
  if (!code || !firstName || !lastName) {
    throw new Error('Code, first name and last name are required.');
  }
  const guests = getGuests();
  const match  = guests.find(g =>
    String(g.invitation_code).toUpperCase() === code.toUpperCase() &&
    String(g.first_name).trim().toLowerCase() === firstName.trim().toLowerCase() &&
    String(g.last_name).trim().toLowerCase()  === lastName.trim().toLowerCase()
  );
  if (!match) throw new Error('No matching guest found. Please check your name and code.');

  // Build allocations object per event
  const allocations = {};
  const eventIds = String(match.events).split(',').map(s => s.trim()).filter(Boolean);
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
    allocations,    // { L: { adults: 4, children: 2 }, W: { adults: 4, children: 0 }, ... }
  };
}

// ── getGuests ─────────────────────────────────────────────
function getGuests() {
  const sheet = getSheet(TABS.guests);
  if (sheet.getLastRow() < 1) return [];
  return sheetToObjects(sheet);
}

// ── addGuest ──────────────────────────────────────────────
function addGuest(payload) {
  const sheet   = getSheet(TABS.guests);
  const headers = guestHeaders();

  // Ensure headers exist
  if (sheet.getLastRow() < 1) {
    sheet.appendRow(headers);
  }

  const id  = 'g-' + Date.now();
  const row = headers.map(h => {
    if (h === 'id') return id;
    if (h === 'events') return Array.isArray(payload.events)
      ? payload.events.join(',') : (payload.events || '');
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
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  headers.forEach((h, i) => {
    if (h === 'id') return;
    if (h === 'events' && Array.isArray(payload.events)) {
      sheet.getRange(rowNum, i + 1).setValue(payload.events.join(','));
      return;
    }
    if (payload[h] !== undefined) {
      sheet.getRange(rowNum, i + 1).setValue(payload[h]);
    }
  });
  return { ...payload };
}

// ── deleteGuest ───────────────────────────────────────────
function deleteGuest(payload) {
  const sheet  = getSheet(TABS.guests);
  const rowNum = findRowById(sheet, payload.id);
  if (rowNum === -1) throw new Error('Guest not found: ' + payload.id);
  sheet.deleteRow(rowNum);
  return { deleted: true, id: payload.id };
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
      const row = headers.map(h => {
        if (h === 'id') return id;
        if (h === 'events') return Array.isArray(g.events)
          ? g.events.join(',') : (g.events || '');
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
  const { submissionName, invitationCode, events, submittedAt } = payload;
  const ts = submittedAt || new Date().toISOString();

  // RSVPs_by_event (tall)
  const byEventSheet = getSheet(TABS.rsvpByEvent);
  if (byEventSheet.getLastRow() < 1) {
    byEventSheet.appendRow([
      'timestamp','submission_name','invitation_code',
      'event_id','event_name','attending','adults','children','notes'
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
    ]);
  });

  // RSVPs_by_family (wide)
  const byFamilySheet = getSheet(TABS.rsvpByFamily);
  let headers;
  if (byFamilySheet.getLastRow() < 1) {
    headers = ['timestamp','submission_name','invitation_code'];
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
  const guests     = getGuests();
  const byFamily   = sheetToObjects(getSheet(TABS.rsvpByFamily));
  const submitted  = new Set(byFamily.map(r => r.invitation_code));
  const rsvpd      = guests.filter(g => submitted.has(g.invitation_code)).length;

  let totalAdults = 0, totalChildren = 0;
  byFamily.forEach(row => {
    Object.keys(row).forEach(key => {
      if (key.endsWith(' Adults'))   totalAdults   += Number(row[key]) || 0;
      if (key.endsWith(' Children')) totalChildren += Number(row[key]) || 0;
    });
  });

  return {
    totalGuests:  guests.length,
    rsvpd,
    pending:      guests.length - rsvpd,
    totalAdults,
    totalChildren,
    duplicates:   getDuplicates().length,
  };
}

// ── getDuplicates ─────────────────────────────────────────
function getDuplicates() {
  const sheet = getSheet(TABS.rsvpByFamily);
  if (sheet.getLastRow() < 2) return [];
  const rows  = sheetToObjects(sheet);
  const counts = {}, byCode = {};
  rows.forEach(r => {
    const code = r.invitation_code;
    counts[code] = (counts[code] || 0) + 1;
    if (!byCode[code]) byCode[code] = [];
    byCode[code].push({ name: r.submission_name, timestamp: r.timestamp });
  });
  return Object.entries(counts)
    .filter(([, n]) => n > 1)
    .map(([code, count]) => ({ code, count, submissions: byCode[code] }));
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
    ['L','Lagnotri',         'TBC','TBC','TBC','🪔','TRUE'],
    ['S','Mehendi & Sangeet','TBC','TBC','TBC','🌿','TRUE'],
    ['A','Mandvo',           'TBC','TBC','TBC','🎶','TRUE'],
    ['G','Meet & Greet',     'TBC','TBC','TBC','🥂','TRUE'],
    ['W','Wedding',          'TBC','TBC','TBC','💍','TRUE'],
    ['B','Black Tie',        'TBC','TBC','TBC','🎩','TRUE'],
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
      'event_id','event_name','attending','adults','children','notes'
    ]);
  }

  Logger.log('Setup complete. All tabs ready.');
}
