// ═══════════════════════════════════════════════════════════
// WEDDING RSVP — Google Apps Script Backend
// Deploy as Web App: Execute as Me, Access: Anyone
// ═══════════════════════════════════════════════════════════

const SHEET_ID  = '1vMYAD7IvF3sz-10oRRkeqg2R-xHrVhwQ5d__Vo53fEc';
const ADMIN_PIN = '2027'; // ← change before going live

const TABS = {
  events:       'Events',
  guests:       'Guests',
  rsvpByFamily: 'RSVPs_by_family',
  rsvpByEvent:  'RSVPs_by_event',
};

// ── Routing ─────────────────────────────────────────────
function doGet(e) {
  if (e && e.parameter && e.parameter.page === 'admin') {
    return HtmlService
      .createHtmlOutputFromFile('admin')
      .setTitle('Wedding Admin')
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.DENY);
  }
  // Default: return active events as JSON for index.html
  try {
    return jsonResponse({ ok: true, data: getEvents() });
  } catch (err) {
    return jsonResponse({ ok: false, error: err.message });
  }
}

function doPost(e) {
  try {
    const body = JSON.parse(e.postData.contents);
    const { action, payload = {} } = body;
    let result;
    if      (action === 'submitRSVP')    result = submitRSVP(payload);
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

// ── Sheet helpers ────────────────────────────────────────
function getSheet(name) {
  const ss = SpreadsheetApp.openById(SHEET_ID);
  let sheet = ss.getSheetByName(name);
  if (!sheet) sheet = ss.insertSheet(name);
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

// ── getEvents ────────────────────────────────────────────
function getEvents() {
  const sheet = getSheet(TABS.events);
  if (sheet.getLastRow() < 2) seedEvents(sheet);
  return sheetToObjects(sheet)
    .filter(r => String(r.active).toUpperCase() === 'TRUE');
}

function seedEvents(sheet) {
  sheet.clearContents();
  sheet.appendRow(['id','name','date','time','venue','icon','active']);
  [
    ['M','Mehendi & Haldi','Friday 24th December 2027','10:00 AM – 2:00 PM','Host Family Residence, Kochi','🌿','TRUE'],
    ['S','Sangeet Night','Friday 24th December 2027','7:00 PM – 11:00 PM','Park Avenue Grand, Kochi','🎶','TRUE'],
    ['C','Cocktail Evening','Saturday 25th December 2027','6:00 PM – 7:30 PM','Park Avenue Grand – Terrace, Kochi','🥂','TRUE'],
    ['W','The Wedding Day','Saturday 25th December 2027','Baraat 7:30 PM · Dinner 9:00 PM','Park Avenue Grand, Kochi','💍','TRUE'],
  ].forEach(row => sheet.appendRow(row));
}

// ── getGuests ────────────────────────────────────────────
function getGuests() {
  const sheet = getSheet(TABS.guests);
  if (sheet.getLastRow() < 1) {
    sheet.appendRow(['id','name','phone','email','relationship','notes','events','invitation_code','created_at','invite_link']);
    return [];
  }
  return sheetToObjects(sheet);
}

// ── addGuest ─────────────────────────────────────────────
function addGuest(payload) {
  const sheet = getSheet(TABS.guests);
  if (sheet.getLastRow() < 1) {
    sheet.appendRow(['id','name','phone','email','relationship','notes','events','invitation_code','created_at','invite_link']);
  }
  const id = 'g-' + Date.now();
  const createdAt = new Date().toISOString();
  const eventsStr = Array.isArray(payload.events)
    ? payload.events.join(',') : (payload.events || '');
  sheet.appendRow([
    id,
    payload.name || '',
    payload.phone || '',
    payload.email || '',
    payload.relationship || '',
    payload.notes || '',
    eventsStr,
    payload.invitation_code || '',
    createdAt,
    payload.invite_link || '',
  ]);
  return { ...payload, id, events: eventsStr, created_at: createdAt };
}

// ── updateGuest ──────────────────────────────────────────
function updateGuest(payload) {
  const sheet = getSheet(TABS.guests);
  const rowNum = findRowById(sheet, payload.id);
  if (rowNum === -1) throw new Error('Guest not found: ' + payload.id);
  const headers = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const eventsStr = Array.isArray(payload.events)
    ? payload.events.join(',') : (payload.events || '');
  const updates = {
    name: payload.name || '',
    phone: payload.phone || '',
    email: payload.email || '',
    relationship: payload.relationship || '',
    notes: payload.notes || '',
    events: eventsStr,
    invitation_code: payload.invitation_code || '',
    invite_link: payload.invite_link || '',
  };
  headers.forEach((h, i) => {
    if (updates[h] !== undefined) {
      sheet.getRange(rowNum, i + 1).setValue(updates[h]);
    }
  });
  return { ...payload, events: eventsStr };
}

// ── deleteGuest ──────────────────────────────────────────
function deleteGuest(payload) {
  const sheet = getSheet(TABS.guests);
  const rowNum = findRowById(sheet, payload.id);
  if (rowNum === -1) throw new Error('Guest not found: ' + payload.id);
  sheet.deleteRow(rowNum);
  return { deleted: true, id: payload.id };
}

// ── submitRSVP ───────────────────────────────────────────
function submitRSVP(payload) {
  const { submissionName, invitationCode, events, submittedAt } = payload;
  const ts = submittedAt || new Date().toISOString();

  // Write to RSVPs_by_event (tall format)
  const byEventSheet = getSheet(TABS.rsvpByEvent);
  if (byEventSheet.getLastRow() < 1) {
    byEventSheet.appendRow([
      'timestamp','submission_name','invitation_code',
      'event_id','event_name','attending','adults','children','notes'
    ]);
  }
  events.forEach(ev => {
    byEventSheet.appendRow([
      ts,
      submissionName,
      invitationCode,
      ev.id,
      ev.name,
      ev.attending ? 'Yes' : 'No',
      ev.attending ? (ev.adults || 0) : 0,
      ev.attending ? (ev.children || 0) : 0,
      ev.notes || '',
    ]);
  });

  // Write to RSVPs_by_family (wide format)
  const byFamilySheet = getSheet(TABS.rsvpByFamily);
  let headers;
  if (byFamilySheet.getLastRow() < 1) {
    headers = ['timestamp','submission_name','invitation_code'];
    events.forEach(ev => {
      headers.push(
        ev.name + ' Attending',
        ev.name + ' Adults',
        ev.name + ' Children',
        ev.name + ' Notes'
      );
    });
    byFamilySheet.appendRow(headers);
  } else {
    headers = byFamilySheet
      .getRange(1, 1, 1, byFamilySheet.getLastColumn())
      .getValues()[0];
    // Add columns for any new events not yet in headers
    events.forEach(ev => {
      [' Attending',' Adults',' Children',' Notes'].forEach(suffix => {
        const col = ev.name + suffix;
        if (!headers.includes(col)) {
          byFamilySheet
            .getRange(1, headers.length + 1)
            .setValue(col);
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
    if (ad > -1) row[ad] = ev.attending ? (ev.adults || 0) : 0;
    if (c  > -1) row[c]  = ev.attending ? (ev.children || 0) : 0;
    if (n  > -1) row[n]  = ev.notes || '';
  });
  byFamilySheet.appendRow(row);

  return { submitted: true };
}

// ── getRSVPsByFamily ─────────────────────────────────────
function getRSVPsByFamily() {
  return sheetToObjects(getSheet(TABS.rsvpByFamily));
}

// ── getStats ─────────────────────────────────────────────
function getStats() {
  const guests   = getGuests();
  const byFamily = sheetToObjects(getSheet(TABS.rsvpByFamily));
  const submittedCodes = new Set(byFamily.map(r => r.invitation_code));
  const submitted = guests.filter(g => submittedCodes.has(g.invitation_code)).length;

  let totalAdults = 0, totalChildren = 0;
  byFamily.forEach(row => {
    Object.keys(row).forEach(key => {
      if (key.endsWith(' Adults'))   totalAdults   += Number(row[key]) || 0;
      if (key.endsWith(' Children')) totalChildren += Number(row[key]) || 0;
    });
  });

  const dups = getDuplicates();

  return {
    totalGuests:   guests.length,
    submitted,
    pending:       guests.length - submitted,
    totalAdults,
    totalChildren,
    duplicates:    dups.length,
  };
}

// ── getDuplicates ────────────────────────────────────────
function getDuplicates() {
  const sheet = getSheet(TABS.rsvpByFamily);
  if (sheet.getLastRow() < 2) return [];
  const rows = sheetToObjects(sheet);
  const counts = {};
  const byCode = {};
  rows.forEach(r => {
    const code = r.invitation_code;
    counts[code] = (counts[code] || 0) + 1;
    if (!byCode[code]) byCode[code] = [];
    byCode[code].push({ name: r.submission_name, timestamp: r.timestamp });
  });
  return Object.entries(counts)
    .filter(([, count]) => count > 1)
    .map(([code, count]) => ({ code, count, submissions: byCode[code] }));
}

// ── checkPin ─────────────────────────────────────────────
function checkPin(pin) {
  return String(pin) === String(ADMIN_PIN);
}

// ── setupSheet ───────────────────────────────────────────
// Run once from the Apps Script editor to initialise all tabs
function setupSheet() {
  const ss = SpreadsheetApp.openById(SHEET_ID);

  // Events
  const evSheet = ss.getSheetByName(TABS.events) || ss.insertSheet(TABS.events);
  if (evSheet.getLastRow() < 2) seedEvents(evSheet);

  // Guests
  const gSheet = ss.getSheetByName(TABS.guests) || ss.insertSheet(TABS.guests);
  if (gSheet.getLastRow() < 1) {
    gSheet.appendRow([
      'id','name','phone','email','relationship',
      'notes','events','invitation_code','created_at','invite_link'
    ]);
  }

  // RSVPs_by_family — headers built dynamically on first submission
  ss.getSheetByName(TABS.rsvpByFamily) || ss.insertSheet(TABS.rsvpByFamily);

  // RSVPs_by_event
  const eSheet = ss.getSheetByName(TABS.rsvpByEvent) || ss.insertSheet(TABS.rsvpByEvent);
  if (eSheet.getLastRow() < 1) {
    eSheet.appendRow([
      'timestamp','submission_name','invitation_code',
      'event_id','event_name','attending','adults','children','notes'
    ]);
  }

  Logger.log('Sheet setup complete. All tabs ready.');
}
