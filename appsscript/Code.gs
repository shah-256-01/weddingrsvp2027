// ═══════════════════════════════════════════════════════
// WEDDING RSVP — Google Apps Script Backend
// Deploy as Web App: Execute as Me, Access: Anyone
// ═══════════════════════════════════════════════════════

const SHEET_ID  = '1vMYAD7IvF3sz-10oRRkeqg2R-xHrVhwQ5d__Vo53fEc';
const ADMIN_PIN = '2027'; // ← change before going live

// Email address to receive RSVP notifications
const NOTIFICATION_EMAIL = 'couple@example.com';

// ── Guest Confirmation Email Config ───────────────────
const GUEST_EMAIL_ENABLED   = true;
const GUEST_EMAIL_FROM_NAME = 'The Wedding Team';   // ← update with couple names
const GUEST_EMAIL_REPLY_TO  = 'YOUR_EMAIL@gmail.com'; // ← update with contact email
const WEDDING_SITE_URL      = 'YOUR_GITHUB_PAGES_URL'; // ← update after deployment

// RSVP deadline — submissions after this date/time are rejected
// Uses explicit midnight IST (UTC+05:30) so deadline is timezone-consistent
// If deadline is 30 Nov 2027, this is midnight starting 1 Dec IST
const RSVP_DEADLINE = '2027-12-01T00:00:00+05:30';

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
  // Update guest contact details — ?action=updateContact&guestId=...&email=...&whatsapp=...
  if (e && e.parameter && e.parameter.action === 'updateContact') {
    try {
      const result = updateGuestContact(
        e.parameter.guestId  || '',
        e.parameter.email    || '',
        e.parameter.whatsapp || ''
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
    let body;
    try {
      body = JSON.parse(e.postData.contents);
    } catch (parseErr) {
      return jsonResponse({ ok: false, error: 'Invalid request format.' });
    }
    const { action, payload = {}, pin } = body;

    // Actions that require admin PIN authorization
    const ADMIN_ACTIONS = [
      'addGuest', 'updateGuest', 'deleteGuest', 'restoreGuest',
      'bulkAddGuests', 'getGuests', 'getDeletedGuests', 'getStats',
      'getDuplicates', 'getSubmittedCodes',
    ];
    if (ADMIN_ACTIONS.indexOf(action) > -1) {
      if (!constantTimeEquals(String(pin || ''), String(ADMIN_PIN))) {
        Utilities.sleep(200 + Math.floor(Math.random() * 300));
        return jsonResponse({ ok: false, error: 'Unauthorized.' });
      }
    }

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
    else if (action === 'checkPin')         result = { ok: constantTimeEquals(String(payload.pin || ''), String(ADMIN_PIN)) };
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

function escapeHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function constantTimeEquals(a, b) {
  if (a.length !== b.length) {
    // Compare against b anyway to avoid length-based timing leak
    b = a;
    var match = false;
  } else {
    var match = true;
  }
  var result = 0;
  for (var i = 0; i < a.length; i++) {
    result |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return match && result === 0;
}

function findRowById(sheet, id) {
  const data = sheet.getDataRange().getValues();
  for (let i = 1; i < data.length; i++) {
    if (String(data[i][0]) === String(id)) return i + 1;
  }
  return -1;
}

function sanitiseSheetValue(val) {
  var s = String(val || '').trim();
  return s.charAt(0) === '#' ? '' : s;
}

function guestHeaders() {
  const fixed = ['id','first_name','last_name','phone','email','relationship','notes','events','invitation_code','is_overseas','status'];
  const alloc = EVENT_IDS.flatMap(id => [id + '_adults', id + '_children']);
  return [...fixed, ...alloc];
}

// ── updateGuestContact ───────────────────────────────────
function updateGuestContact(guestId, email, whatsapp) {
  if (!guestId) throw new Error('Guest ID required.');
  if (!email)   throw new Error('Email address required.');
  if (!whatsapp) throw new Error('WhatsApp number required.');

  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    throw new Error('Please enter a valid email address.');
  }

  const sheet  = getSheet(TABS.guests);
  const rowNum = findRowById(sheet, guestId);
  if (rowNum === -1) throw new Error('Guest record not found.');

  const headers  = sheet.getRange(1, 1, 1, sheet.getLastColumn()).getValues()[0];
  const emailCol = headers.indexOf('email');
  const phoneCol = headers.indexOf('phone');

  if (emailCol > -1) sheet.getRange(rowNum, emailCol + 1).setValue(email.trim());
  if (phoneCol > -1) sheet.getRange(rowNum, phoneCol + 1).setValue(whatsapp.trim());

  Logger.log('Updated contact for guest ' + guestId + ': ' + email);
  return { updated: true, guestId };
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

  const guests    = getGuests(); // already filters out DELETED by default
  const normFirst = normaliseName(firstName);
  const normLast  = normaliseName(lastName);
  const normCode  = code.toUpperCase().trim();

  const match = guests.find(g =>
    String(g.invitation_code || '').toUpperCase().trim() === normCode &&
    normaliseName(g.first_name) === normFirst &&
    normaliseName(g.last_name)  === normLast
  );

  // No match found
  if (!match) {
    // Check if there IS a deleted guest with these details
    // Give a different error to avoid leaking that the guest existed
    const allGuests = sheetToObjects(getSheet(TABS.guests));
    const deletedMatch = allGuests.find(g =>
      String(g.status || '').toUpperCase() === 'DELETED' &&
      String(g.invitation_code || '').toUpperCase().trim() === normCode &&
      normaliseName(g.first_name) === normFirst &&
      normaliseName(g.last_name)  === normLast
    );

    if (deletedMatch) {
      // Guest record was deleted — give a neutral error (don't reveal deletion)
      throw new Error(
        'We could not find your invitation. Please contact the wedding team for assistance.'
      );
    }

    // Standard not found error
    throw new Error(
      'No matching guest found. Please check your name and code.'
    );
  }

  // Double-check status on match (getGuests() should have filtered this, but be defensive)
  if (String(match.status || '').toUpperCase() === 'DELETED') {
    throw new Error(
      'We could not find your invitation. Please contact the wedding team for assistance.'
    );
  }

  // Build allocations object per event
  const eventIds = String(match.events || '').split(',')
    .map(function(s) { return s.trim(); })
    .filter(function(id) { return id && EVENT_IDS.includes(id); })
    .sort(function(a, b) { return a.localeCompare(b); });

  const allocations = {};
  eventIds.forEach(function(id) {
    allocations[id] = {
      adults:   Number(match[id + '_adults'])   || 0,
      children: Number(match[id + '_children']) || 0,
    };
  });

  const familyName  = match.first_name + ' ' + match.last_name;
  const existingRSVP = getExistingRSVP(match.invitation_code, familyName);

  return {
    id:             match.id,
    firstName:      match.first_name,
    lastName:       match.last_name,
    familyName,
    invitationCode: match.invitation_code,
    email:          sanitiseSheetValue(match.email),
    whatsapp:       sanitiseSheetValue(match.phone),
    events:         eventIds,
    allocations,
    isOverseas:     String(match.is_overseas || '').toUpperCase() === 'TRUE',
    existingRSVP,
  };
}

// ── getExistingRSVP ───────────────────────────────────────
// Returns the most recent submission for a specific name + code combination.
// Returns null if no matching submission exists.
// Fails open — returns null on any error so guest flow is never blocked by a check failure.
function getExistingRSVP(code, familyName) {
  try {
    const sheet = getSheet(TABS.rsvpByFamily);
    if (sheet.getLastRow() < 2) return null;

    const normCode = String(code || '').toUpperCase().trim();
    const normName = normaliseName(familyName);

    const rows = sheetToObjects(sheet).filter(function(r) {
      return String(r.status || '').toUpperCase() !== 'DELETED' &&
             String(r.invitation_code || '').toUpperCase().trim() === normCode &&
             normaliseName(r.submission_name) === normName;
    });

    if (!rows.length) return null;

    // Return the most recent matching submission
    rows.sort(function(a, b) {
      return new Date(b.timestamp) - new Date(a.timestamp);
    });

    const latest = rows[0];

    // Build a clean per-event summary from the wide row
    const eventSummary = [];
    const activeEvents = getEvents();
    activeEvents.forEach(function(evt) {
      const attending = String(latest[evt.id + ' Attending'] || '').toLowerCase();
      if (attending === 'yes' || attending === 'no') {
        eventSummary.push({
          id:       evt.id,
          name:     evt.name,
          icon:     evt.icon,
          attending: attending === 'yes',
          adults:   Number(latest[evt.id + ' Adults'])   || 0,
          children: Number(latest[evt.id + ' Children']) || 0,
        });
      }
    });

    return {
      submittedAt:    latest.timestamp,
      submissionName: latest.submission_name,
      eventSummary,
    };
  } catch (err) {
    Logger.log('getExistingRSVP error: ' + err.message);
    return null; // fail open — never block login due to a check error
  }
}

// ── getGuests ─────────────────────────────────────────────
function getGuests(includeDeleted) {
  const sheet = getSheet(TABS.guests);
  if (sheet.getLastRow() < 1) return [];
  const all = sheetToObjects(sheet);
  if (includeDeleted) return all;
  return all.filter(g => String(g.status || '').toUpperCase() !== 'DELETED');
}

// ── getDeletedGuests ─────────────────────────────────────
function getDeletedGuests() {
  const sheet = getSheet(TABS.guests);
  if (sheet.getLastRow() < 1) return [];
  return sheetToObjects(sheet).filter(g => String(g.status || '').toUpperCase() === 'DELETED');
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

  const id  = 'g-' + Date.now() + '-' + (sheet.getLastRow() + 1);
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
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
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
  } finally {
    lock.releaseLock();
  }
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
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
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
  } finally {
    lock.releaseLock();
  }
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
  // Check deadline
  if (RSVP_DEADLINE) {
    const now      = new Date();
    const deadline = new Date(RSVP_DEADLINE);
    if (now >= deadline) {
      throw new Error(
        'The RSVP deadline has passed. Please contact us directly if you need to update your response.'
      );
    }
  }

  // ── Duplicate check — name + code ───────────────────
  const normCode = String(payload.invitationCode || '').toUpperCase().trim();
  const existing = getExistingRSVP(normCode, payload.submissionName);
  if (existing) {
    throw new Error(
      'An RSVP has already been received for this name and invitation code. ' +
      'Please contact the wedding team if you need to make any changes.'
    );
  }

  const { submissionName, submittedAt } = payload;
  const events = (payload.events || []).filter(ev => ev && EVENT_IDS.includes(ev.id));
  if (events.length === 0) throw new Error('No valid events in submission.');
  const invitationCode = normCode;
  const ts = submittedAt || new Date().toISOString();

  // Use script lock to prevent concurrent column insertion races
  const lock = LockService.getScriptLock();
  lock.waitLock(15000);
  try {
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
          ev.id + ' Attending', ev.id + ' Adults',
          ev.id + ' Children',  ev.id + ' Notes'
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
      // Batch-collect new columns, then write them all at once
      const newCols = [];
      events.forEach(ev => {
        [' Attending',' Adults',' Children',' Notes'].forEach(suffix => {
          const col = ev.id + suffix;
          if (!headers.includes(col) && newCols.indexOf(col) === -1) {
            newCols.push(col);
          }
        });
      });
      if (newCols.length > 0) {
        byFamilySheet.getRange(1, headers.length + 1, 1, newCols.length)
          .setValues([newCols]);
        headers = headers.concat(newCols);
      }
    }

    const row = new Array(headers.length).fill('');
    row[headers.indexOf('timestamp')]       = ts;
    row[headers.indexOf('submission_name')] = submissionName;
    row[headers.indexOf('invitation_code')] = invitationCode;
    events.forEach(ev => {
      const a  = headers.indexOf(ev.id + ' Attending');
      const ad = headers.indexOf(ev.id + ' Adults');
      const c  = headers.indexOf(ev.id + ' Children');
      const n  = headers.indexOf(ev.id + ' Notes');
      if (a  > -1) row[a]  = ev.attending ? 'Yes' : 'No';
      if (ad > -1) row[ad] = ev.attending ? (ev.adults   || 0) : 0;
      if (c  > -1) row[c]  = ev.attending ? (ev.children || 0) : 0;
      if (n  > -1) row[n]  = ev.notes || '';
    });
    byFamilySheet.appendRow(row);
  } finally {
    lock.releaseLock();
  }

  // Email notifications — best effort, don't block RSVP
  try { sendRSVPNotification(payload); }
  catch (emailErr) { Logger.log('Admin notification failed: ' + emailErr.message); }

  if (payload.guestEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(payload.guestEmail)) {
    try { sendGuestConfirmationEmail(payload, payload.guestEmail); }
    catch (confErr) { Logger.log('Guest confirmation email failed: ' + confErr.message); }
  }

  return { submitted: true };
}

// ── sendRSVPNotification ─────────────────────────────────
function sendRSVPNotification(payload) {
  if (!NOTIFICATION_EMAIL) return;

  const name = payload.submissionName || 'Unknown';
  const code = String(payload.invitationCode || '').toUpperCase().trim();
  const ts   = payload.submittedAt || new Date().toISOString();

  const eventLines = (payload.events || []).map(ev => {
    if (ev.attending) {
      return '  ' + ev.name + ': YES — ' + (ev.adults || 0) + ' adult(s), ' + (ev.children || 0) + ' child(ren)';
    }
    return '  ' + ev.name + ': No';
  }).join('\n');

  const subject = 'New RSVP: ' + name + ' (' + code + ')';
  const body = 'A new RSVP has been submitted.\n\n' +
    'Name: ' + name + '\n' +
    'Invitation Code: ' + code + '\n' +
    'Submitted: ' + ts + '\n\n' +
    'Event Responses:\n' + eventLines;

  MailApp.sendEmail(NOTIFICATION_EMAIL, subject, body);
}

// ── sendGuestConfirmationEmail ────────────────────────────
function sendGuestConfirmationEmail(payload, guestEmail) {
  if (!GUEST_EMAIL_ENABLED || !guestEmail) return;

  try {
    var submittedAt = '';
    try {
      submittedAt = new Date(payload.submittedAt).toLocaleString('en-GB', {
        day: 'numeric', month: 'long', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
      });
    } catch (e) { submittedAt = payload.submittedAt; }

    var eventRowsHtml = (payload.events || []).map(function(ev) {
      var attending = ev.attending;
      var detail = attending
        ? (ev.adults + ' adult' + (ev.adults !== 1 ? 's' : '') +
           (ev.children > 0 ? ', ' + ev.children + ' child' + (ev.children !== 1 ? 'ren' : '') : ''))
        : 'Declined';
      var iconColor = attending ? '#2d4a3e' : '#8b2020';
      var icon      = attending ? '✓' : '✕';
      var bgColor   = attending ? '#f0f7f4' : '#fdf0f0';
      return '<tr>' +
        '<td style="padding:10px 16px;border-bottom:1px solid #f5e6da;">' +
          '<span style="font-size:1rem;margin-right:8px;">' + escapeHtml(ev.name) + '</span>' +
        '</td>' +
        '<td style="padding:10px 16px;border-bottom:1px solid #f5e6da;text-align:right;">' +
          '<span style="display:inline-block;padding:3px 10px;border-radius:12px;' +
            'background:' + bgColor + ';color:' + iconColor + ';' +
            'font-family:Georgia,serif;font-size:.85rem;">' +
            icon + ' ' + detail +
          '</span>' +
        '</td>' +
      '</tr>';
    }).join('');

    var htmlBody = '<!DOCTYPE html><html><head><meta charset="UTF-8"/>' +
      '<meta name="viewport" content="width=device-width,initial-scale=1.0"/>' +
      '</head><body style="margin:0;padding:0;background:#f5e6da;font-family:Georgia,serif;">' +
      '<div style="max-width:560px;margin:0 auto;background:#fff;">' +

        // Header
        '<div style="background:#6b2737;padding:32px 24px;text-align:center;">' +
          '<p style="margin:0 0 4px;font-family:Georgia,serif;font-size:.72rem;' +
            'letter-spacing:.3em;color:#e8c87a;text-transform:uppercase;">You are invited to</p>' +
          '<h1 style="margin:0;font-family:Georgia,serif;font-style:italic;font-weight:300;' +
            'font-size:2.2rem;color:#fff;line-height:1.1;">The Wedding Day</h1>' +
          '<p style="margin:8px 0 0;font-family:Georgia,serif;font-size:.85rem;' +
            'color:rgba(255,255,255,.6);letter-spacing:.1em;">25th December 2027</p>' +
        '</div>' +

        // Body
        '<div style="padding:32px 24px;">' +
          '<p style="margin:0 0 8px;font-family:Georgia,serif;font-size:.7rem;' +
            'letter-spacing:.25em;color:#b8924a;text-transform:uppercase;">RSVP Confirmed</p>' +
          '<h2 style="margin:0 0 20px;font-family:Georgia,serif;font-style:italic;' +
            'font-weight:300;font-size:1.6rem;color:#6b2737;">' +
            'Thank you, ' + escapeHtml(payload.submissionName) + '</h2>' +
          '<p style="margin:0 0 20px;font-size:.95rem;color:#5a4a40;line-height:1.7;">' +
            'We\'ve received your RSVP and are delighted to confirm your responses below. ' +
            'We look forward to celebrating with you!' +
          '</p>' +

          // Event table
          '<table style="width:100%;border-collapse:collapse;margin-bottom:20px;' +
            'border:1px solid #f5e6da;border-radius:2px;">' +
            '<thead><tr style="background:#fdf6ef;">' +
              '<th style="padding:10px 16px;text-align:left;font-family:Georgia,serif;' +
                'font-size:.7rem;letter-spacing:.18em;color:#b8924a;text-transform:uppercase;' +
                'font-weight:normal;border-bottom:2px solid #f5e6da;">Event</th>' +
              '<th style="padding:10px 16px;text-align:right;font-family:Georgia,serif;' +
                'font-size:.7rem;letter-spacing:.18em;color:#b8924a;text-transform:uppercase;' +
                'font-weight:normal;border-bottom:2px solid #f5e6da;">Response</th>' +
            '</tr></thead>' +
            '<tbody>' + eventRowsHtml + '</tbody>' +
          '</table>' +

          // Details
          '<div style="background:#fdf6ef;border:1px solid #f0deca;padding:16px 20px;' +
            'margin-bottom:20px;border-radius:2px;">' +
            '<p style="margin:0 0 4px;font-size:.78rem;color:#8a7060;">' +
              'Invitation code: <strong style="color:#6b2737;letter-spacing:.1em;">' +
              escapeHtml(payload.invitationCode) + '</strong></p>' +
            '<p style="margin:0;font-size:.78rem;color:#8a7060;">' +
              'Submitted: ' + submittedAt + '</p>' +
          '</div>' +

          '<p style="margin:0 0 8px;font-size:.9rem;color:#5a4a40;line-height:1.7;">' +
            'If you need to make any changes to your RSVP, please contact us directly — ' +
            'we\'ll be happy to help.</p>' +
          '<p style="margin:0;font-size:.9rem;color:#5a4a40;line-height:1.7;">' +
            'With love,<br><em style="font-family:Georgia,serif;font-size:1.1rem;color:#6b2737;">' +
              GUEST_EMAIL_FROM_NAME + '</em></p>' +
        '</div>' +

        // Footer
        '<div style="background:#2a1f1a;padding:20px 24px;text-align:center;">' +
          '<p style="margin:0;font-size:.75rem;color:rgba(255,255,255,.4);line-height:1.6;">' +
            '25th December 2027<br>' +
            '<a href="' + WEDDING_SITE_URL + '" style="color:#b8924a;text-decoration:none;">' +
              'View your invitation online</a></p>' +
        '</div>' +

      '</div></body></html>';

    // Plain text fallback
    var plainBody = [
      'Dear ' + payload.submissionName + ',',
      '',
      'Thank you for your RSVP! We\'ve received your responses:',
      '',
      (payload.events || []).map(function(ev) {
        return (ev.attending ? '✓ ' : '✕ ') + ev.name +
          (ev.attending ? ' — ' + ev.adults + ' adult(s)' +
            (ev.children > 0 ? ', ' + ev.children + ' child(ren)' : '') : ' — Declined');
      }).join('\n'),
      '',
      'Invitation code: ' + payload.invitationCode,
      'Submitted: ' + submittedAt,
      '',
      'If you need to make any changes, please contact us.',
      '',
      'With love,',
      GUEST_EMAIL_FROM_NAME,
    ].join('\n');

    MailApp.sendEmail({
      to:       guestEmail,
      replyTo:  GUEST_EMAIL_REPLY_TO,
      subject:  'Your RSVP is confirmed — The Wedding Day 2027',
      body:     plainBody,
      htmlBody: htmlBody,
      name:     GUEST_EMAIL_FROM_NAME,
    });

    Logger.log('Confirmation email sent to: ' + guestEmail);
  } catch (err) {
    Logger.log('Guest confirmation email failed: ' + err.message);
  }
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
  const byEvent  = byEventAll.filter(r => String(r.status || '').toUpperCase() !== 'DELETED');
  const byFamily = byFamilyAll.filter(r => String(r.status || '').toUpperCase() !== 'DELETED');

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

  // ── Overall guest counts (unique headcount, not per-event sum) ──
  // Uses max allocation across events to avoid double-counting families
  // invited to multiple events. Per-event totals are in perEvent below.
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
  byEvent.forEach(row => {
    const id   = row.event_id;
    const code = String(row.invitation_code || '').toUpperCase().trim();
    if (!perEvent[id]) return;
    if (!submittedCodes.has(code)) return;

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

  // Confirmed adults/children — uses same max-across-events approach
  // as invited counts above for consistent unique headcount semantics
  const allEventsData = getEvents();
  let finalConfirmedAdults = 0, finalConfirmedChildren = 0;
  dedupedSubmissions.forEach(row => {
    let maxA = 0, maxC = 0;
    allEventsData.forEach(evt => {
      const a = Number(row[evt.id + ' Adults'])   || 0;
      const c = Number(row[evt.id + ' Children']) || 0;
      if (String(row[evt.id + ' Attending']).toLowerCase() === 'yes') {
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
  const rows    = sheetToObjects(sheet).filter(r => String(r.status || '').toUpperCase() !== 'DELETED');
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
      latestTimestamp: (() => {
        try {
          return byCode[code]
            .map(s => new Date(s.timestamp))
            .filter(d => !isNaN(d.getTime()))
            .reduce((a, b) => a > b ? a : b)
            .toISOString();
        } catch (_) { return ''; }
      })(),
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

  // Events — only seed if empty (never overwrite existing event data)
  let evSheet = ss.getSheetByName(TABS.events);
  if (!evSheet) evSheet = ss.insertSheet(TABS.events);
  if (evSheet.getLastRow() > 1) {
    Logger.log('Events sheet already has data (' + (evSheet.getLastRow() - 1) + ' rows). Skipping seed to avoid data loss.');
  } else {
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
  }

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

/*
  DAILY DIGEST SETUP:
  1. In Apps Script editor click the clock icon (Triggers) in the left sidebar
  2. Click "+ Add Trigger" (bottom right)
  3. Function to run: sendDailyDigest
  4. Event source: Time-driven
  5. Type: Day timer
  6. Time: 8:00 AM – 9:00 AM
  7. Click Save
  This will email NOTIFICATION_EMAIL every morning with an RSVP summary.
*/
function sendDailyDigest() {
  if (!NOTIFICATION_EMAIL) return;
  try {
    var stats = getStats();
    if (stats.totalGuests === 0) return;

    var allEventsData = getEvents();
    var eventLines = (stats.perEvent || []).map(function(ev) {
      var evtConfig = allEventsData.find(function(e) { return e.id === ev.id; }) || {};
      return '  ' + (evtConfig.icon || '') + ' ' + (evtConfig.name || ev.id) + ':' +
        ' ' + ev.attendingAdults + ' adults attending' +
        ', ' + ev.pending + ' pending';
    }).join('\n');

    var subject = 'Daily RSVP Update — ' +
      new Date().toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });

    var body = [
      'Daily RSVP Summary',
      '══════════════════',
      'Total Guests:       ' + stats.totalGuests,
      'RSVPd:              ' + stats.rsvpd,
      'Pending:            ' + stats.pending,
      'Adults Confirmed:   ' + stats.confirmedAdults,
      'Children Confirmed: ' + stats.confirmedChildren,
      stats.duplicates > 0 ? '⚠ Duplicates:     ' + stats.duplicates : '',
      '',
      'Per Event:',
      eventLines,
      '',
      '——',
      'View full details in your admin panel.',
    ].filter(Boolean).join('\n');

    MailApp.sendEmail({
      to:      NOTIFICATION_EMAIL,
      subject: subject,
      body:    body,
      name:    'Wedding RSVP System',
    });
  } catch (err) {
    Logger.log('Daily digest failed: ' + err.message);
  }
}
