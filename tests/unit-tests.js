// Unit tests for pure functions across Code.gs, index.html, admin.html
// Run with: node tests/unit-tests.js

let passed = 0;
let failed = 0;
const failures = [];

function assert(testName, actual, expected) {
  if (actual === expected) {
    passed++;
  } else {
    failed++;
    failures.push({ testName, actual, expected });
    console.log(`  FAIL: ${testName}`);
    console.log(`    expected: ${JSON.stringify(expected)}`);
    console.log(`    actual:   ${JSON.stringify(actual)}`);
  }
}

function assertDeep(testName, actual, expected) {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a === e) {
    passed++;
  } else {
    failed++;
    failures.push({ testName, actual, expected });
    console.log(`  FAIL: ${testName}`);
    console.log(`    expected: ${e}`);
    console.log(`    actual:   ${a}`);
  }
}

// ═══════════════════════════════════════════════
//   FUNCTION DEFINITIONS (extracted from source)
// ═══════════════════════════════════════════════

function normaliseName(str) {
  return String(str || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[-]/g, ' ')
    .trim();
}

function sanitizeForSheet(val) {
  if (val === null || val === undefined) return '';
  const s = String(val);
  if (/^[=+\-@\t\r]/.test(s)) return "'" + s;
  return s;
}

function sanitiseSheetValue(val) {
  var s = String(val || '').trim();
  if (/^#(REF|N\/A|VALUE|ERROR|NAME|NULL|DIV\/0)!?$/.test(s)) return '';
  return s;
}

function escapeHtmlServer(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function constantTimeEquals(a, b) {
  if (a.length !== b.length) {
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

function escapeAttr(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/'/g, '&#39;')
    .replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function escapeICSText(str) {
  return String(str || '').replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function sanitiseValue(val) {
  if (val === undefined || val === null) return '';
  var s = String(val);
  if (/^#(REF|N\/A|VALUE|ERROR|NAME|NULL|DIV\/0)!?$/.test(s)) return '';
  return s;
}

function codeForIds(ids) {
  if (!ids || !ids.length) return '';
  var sorted = ids.filter(Boolean).sort(function(a, b) { return a.localeCompare(b); });
  return sorted.join('') + '2026';
}

const EVENT_IDS = ['L','S','A','G','W','B'];

function guestHeaders() {
  const fixed = ['id','first_name','last_name','phone','email','relationship','notes','events','invitation_code','is_overseas','status'];
  const alloc = EVENT_IDS.flatMap(id => [id + '_guests', id + '_table']);
  return [...fixed, ...alloc];
}

function buildCodesMap(events) {
  const sorted = [...events].sort((a, b) => a.id.localeCompare(b.id));
  const map = {};
  const n = sorted.length;
  if (n > 12) return map;
  for (let i = 1; i < (1 << n); i++) {
    const ids = sorted.filter((_, j) => i & (1 << j)).map(e => e.id);
    map[ids.join('') + '2026'] = ids;
  }
  return map;
}

function formatCalDateTime(dateStr, timeStr) {
  try {
    var cleanDate = String(dateStr || '').replace(/(\d+)(st|nd|rd|th)/i, '$1').trim();
    var timeMatch = String(timeStr || '').match(/(\d{1,2}:\d{2}\s*[AP]M)/i);
    var startTime = timeMatch ? timeMatch[1] : '12:00 PM';
    var times = String(timeStr || '').match(/(\d{1,2}:\d{2}\s*[AP]M)/gi) || [];
    var endTimeStr = times.length > 1 ? times[times.length - 1] : '';
    var startDt = new Date(cleanDate + ' ' + startTime);
    var endDt = endTimeStr
      ? new Date(cleanDate + ' ' + endTimeStr)
      : new Date(startDt.getTime() + 3 * 60 * 60 * 1000);
    if (isNaN(startDt)) return { valid: false };
    function pad(n) { return String(n).padStart(2, '0'); }
    function fmt(d) {
      return d.getFullYear() +
        pad(d.getMonth() + 1) + pad(d.getDate()) + 'T' +
        pad(d.getHours()) + pad(d.getMinutes()) + '00';
    }
    return { start: fmt(startDt), end: fmt(endDt), valid: true };
  } catch (e) {
    return { valid: false };
  }
}

// ═══════════════════════════════════════════════
//   TESTS
// ═══════════════════════════════════════════════

console.log('\n=== normaliseName ===');
assert('basic name', normaliseName('John Smith'), 'john smith');
assert('extra whitespace', normaliseName('  John   Smith  '), 'john smith');
assert('mixed case', normaliseName('jOHN sMITH'), 'john smith');
assert('straight apostrophe', normaliseName("O'Brien"), "o'brien");
assert('left curly quote', normaliseName('O\u2018Brien'), "o'brien");
assert('right curly quote', normaliseName('O\u2019Brien'), "o'brien");
assert('hyphen to space', normaliseName('Mary-Jane Watson'), 'mary jane watson');
assert('null input', normaliseName(null), '');
assert('undefined input', normaliseName(undefined), '');
assert('empty string', normaliseName(''), '');
assert('number input', normaliseName(123), '123');
assert('tabs and newlines', normaliseName('John\t\nSmith'), 'john smith');

console.log('\n=== sanitizeForSheet ===');
assert('normal text', sanitizeForSheet('hello'), 'hello');
assert('equals prefix', sanitizeForSheet('=SUM(A1)'), "'=SUM(A1)");
assert('plus prefix', sanitizeForSheet('+1234'), "'+1234");
assert('minus prefix', sanitizeForSheet('-data'), "'-data");
assert('at prefix', sanitizeForSheet('@import'), "'@import");
assert('tab prefix', sanitizeForSheet('\tdata'), "'\tdata");
assert('carriage return prefix', sanitizeForSheet('\rdata'), "'\rdata");
assert('null input', sanitizeForSheet(null), '');
assert('undefined input', sanitizeForSheet(undefined), '');
assert('number input', sanitizeForSheet(42), '42');
assert('safe special chars', sanitizeForSheet('#hello'), '#hello');
assert('empty string', sanitizeForSheet(''), '');
assert('space prefix is safe', sanitizeForSheet(' hello'), ' hello');

console.log('\n=== sanitiseSheetValue ===');
assert('normal text', sanitiseSheetValue('hello'), 'hello');
assert('#REF!', sanitiseSheetValue('#REF!'), '');
assert('#N/A', sanitiseSheetValue('#N/A'), '');
assert('#VALUE!', sanitiseSheetValue('#VALUE!'), '');
assert('#ERROR!', sanitiseSheetValue('#ERROR!'), '');
assert('#NAME', sanitiseSheetValue('#NAME'), '');
assert('#NAME!', sanitiseSheetValue('#NAME!'), '');
assert('#NULL!', sanitiseSheetValue('#NULL!'), '');
assert('#DIV/0!', sanitiseSheetValue('#DIV/0!'), '');
assert('#DIV/0', sanitiseSheetValue('#DIV/0'), '');
assert('preserves #1 VIP', sanitiseSheetValue('#1 VIP'), '#1 VIP');
assert('preserves #hashtag', sanitiseSheetValue('#hashtag'), '#hashtag');
assert('preserves #123', sanitiseSheetValue('#123'), '#123');
assert('null input', sanitiseSheetValue(null), '');
assert('undefined input', sanitiseSheetValue(undefined), '');
assert('trims whitespace', sanitiseSheetValue('  hello  '), 'hello');

console.log('\n=== escapeHtml (server) ===');
assert('no special chars', escapeHtmlServer('hello'), 'hello');
assert('ampersand', escapeHtmlServer('a&b'), 'a&amp;b');
assert('less than', escapeHtmlServer('a<b'), 'a&lt;b');
assert('greater than', escapeHtmlServer('a>b'), 'a&gt;b');
assert('double quote', escapeHtmlServer('a"b'), 'a&quot;b');
assert('single quote', escapeHtmlServer("a'b"), 'a&#39;b');
assert('script tag', escapeHtmlServer('<script>alert(1)</script>'), '&lt;script&gt;alert(1)&lt;/script&gt;');
assert('all at once', escapeHtmlServer('<a href="x" onclick=\'y\'>&'), '&lt;a href=&quot;x&quot; onclick=&#39;y&#39;&gt;&amp;');
assert('null input', escapeHtmlServer(null), '');
assert('undefined input', escapeHtmlServer(undefined), '');
assert('number input', escapeHtmlServer(0), '');

console.log('\n=== escapeAttr ===');
assert('no special chars', escapeAttr('hello'), 'hello');
assert('ampersand', escapeAttr('a&b'), 'a&amp;b');
assert('single quote', escapeAttr("a'b"), 'a&#39;b');
assert('double quote', escapeAttr('a"b'), 'a&quot;b');
assert('less than', escapeAttr('a<b'), 'a&lt;b');
assert('greater than', escapeAttr('a>b'), 'a&gt;b');
assert('onclick breakout', escapeAttr("' onclick='alert(1)"), '&#39; onclick=&#39;alert(1)');
assert('attribute breakout', escapeAttr('" onmouseover="alert(1)'), '&quot; onmouseover=&quot;alert(1)');
assert('null input', escapeAttr(null), '');
assert('undefined input', escapeAttr(undefined), '');

console.log('\n=== constantTimeEquals ===');
assert('equal strings', constantTimeEquals('2026', '2026'), true);
assert('different strings same length', constantTimeEquals('2026', '2028'), false);
assert('different lengths', constantTimeEquals('2026', '20260'), false);
assert('empty strings', constantTimeEquals('', ''), true);
assert('one empty', constantTimeEquals('a', ''), false);
assert('other empty', constantTimeEquals('', 'a'), false);
assert('long equal', constantTimeEquals('abcdefghij', 'abcdefghij'), true);
assert('long differ at end', constantTimeEquals('abcdefghij', 'abcdefghik'), false);
assert('unicode equal', constantTimeEquals('\u00e9', '\u00e9'), true);

console.log('\n=== escapeICSText ===');
assert('normal text', escapeICSText('hello world'), 'hello world');
assert('backslash', escapeICSText('a\\b'), 'a\\\\b');
assert('semicolon', escapeICSText('a;b'), 'a\\;b');
assert('comma', escapeICSText('a,b'), 'a\\,b');
assert('newline', escapeICSText('a\nb'), 'a\\nb');
assert('all at once', escapeICSText('a\\b;c,d\ne'), 'a\\\\b\\;c\\,d\\ne');
assert('null input', escapeICSText(null), '');
assert('undefined input', escapeICSText(undefined), '');
assert('venue with comma', escapeICSText('Park Avenue Grand, Kochi'), 'Park Avenue Grand\\, Kochi');
assert('description with newline', escapeICSText('Line 1\nLine 2'), 'Line 1\\nLine 2');

console.log('\n=== sanitiseValue (admin) ===');
assert('normal text', sanitiseValue('hello'), 'hello');
assert('#REF!', sanitiseValue('#REF!'), '');
assert('#N/A', sanitiseValue('#N/A'), '');
assert('#VALUE!', sanitiseValue('#VALUE!'), '');
assert('#NULL!', sanitiseValue('#NULL!'), '');
assert('#DIV/0!', sanitiseValue('#DIV/0!'), '');
assert('preserves #1 VIP', sanitiseValue('#1 VIP'), '#1 VIP');
assert('preserves #notes', sanitiseValue('#notes'), '#notes');
assert('null', sanitiseValue(null), '');
assert('undefined', sanitiseValue(undefined), '');
assert('number', sanitiseValue(42), '42');
assert('zero', sanitiseValue(0), '0');
assert('false', sanitiseValue(false), 'false');

console.log('\n=== codeForIds ===');
assert('single event', codeForIds(['L']), 'L2026');
assert('two events sorted', codeForIds(['W', 'L']), 'LW2026');
assert('all events', codeForIds(['W', 'B', 'L', 'S', 'A', 'G']), 'ABGLSW2026');
assert('already sorted', codeForIds(['A', 'B', 'G']), 'ABG2026');
assert('empty array', codeForIds([]), '');
assert('null input', codeForIds(null), '');
assert('undefined input', codeForIds(undefined), '');
assert('filters falsy', codeForIds(['L', '', null, 'S']), 'LS2026');

console.log('\n=== guestHeaders ===');
const headers = guestHeaders();
assert('has id', headers.includes('id'), true);
assert('has first_name', headers.includes('first_name'), true);
assert('has last_name', headers.includes('last_name'), true);
assert('has invitation_code', headers.includes('invitation_code'), true);
assert('has status', headers.includes('status'), true);
assert('has L_guests', headers.includes('L_guests'), true);
assert('has B_guests', headers.includes('B_guests'), true);
assert('has L_table', headers.includes('L_table'), true);
assert('has W_table', headers.includes('W_table'), true);
assert('has B_table', headers.includes('B_table'), true);
assert('total count', headers.length, 11 + EVENT_IDS.length * 2);
assert('no duplicates', headers.length, new Set(headers).size);

console.log('\n=== buildCodesMap ===');
const events2 = [{ id: 'L' }, { id: 'S' }];
const map2 = buildCodesMap(events2);
assert('single L', JSON.stringify(map2['L2026']), JSON.stringify(['L']));
assert('single S', JSON.stringify(map2['S2026']), JSON.stringify(['S']));
assert('both LS', JSON.stringify(map2['LS2026']), JSON.stringify(['L', 'S']));
assert('total combos for 2 events', Object.keys(map2).length, 3);

const events3 = [{ id: 'A' }, { id: 'B' }, { id: 'G' }];
const map3 = buildCodesMap(events3);
assert('total combos for 3 events', Object.keys(map3).length, 7);
assert('triple ABG', JSON.stringify(map3['ABG2026']), JSON.stringify(['A', 'B', 'G']));

const emptyMap = buildCodesMap([]);
assert('empty events', Object.keys(emptyMap).length, 0);

// Cap at 12 events
const manyEvents = Array.from({ length: 13 }, (_, i) => ({ id: String.fromCharCode(65 + i) }));
const cappedMap = buildCodesMap(manyEvents);
assert('caps at 12 events', Object.keys(cappedMap).length, 0);

console.log('\n=== formatCalDateTime ===');
const dt1 = formatCalDateTime('25 December 2026', '7:30 PM - 11:00 PM');
assert('valid result', dt1.valid, true);
assert('start time', dt1.start, '20261225T193000');
assert('end time', dt1.end, '20261225T230000');

const dt2 = formatCalDateTime('1st January 2028', '6:00 PM');
assert('ordinal date valid', dt2.valid, true);
assert('ordinal start', dt2.start, '20280101T180000');

const dt3 = formatCalDateTime('', '');
assert('empty inputs invalid', dt3.valid, false);

const dt4 = formatCalDateTime('gibberish', 'not a time');
assert('gibberish invalid', dt4.valid, false);

const dt5 = formatCalDateTime('25 December 2026', '2:00 PM');
assert('single time valid', dt5.valid, true);
assert('single time start', dt5.start, '20261225T140000');
// Default 3-hour duration
assert('single time end (3hr default)', dt5.end, '20261225T170000');

// ═══════════════════════════════════════════════
//   EDGE CASE / SECURITY TESTS
// ═══════════════════════════════════════════════

console.log('\n=== Security edge cases ===');

// XSS payloads through escaping
assert('escapeAttr XSS img', escapeAttr('<img src=x onerror=alert(1)>'), '&lt;img src=x onerror=alert(1)&gt;');
assert('escapeHtml XSS script', escapeHtmlServer('<script>document.cookie</script>'), '&lt;script&gt;document.cookie&lt;/script&gt;');
assert('escapeAttr event handler', escapeAttr('" onfocus="alert(1)" autofocus="'), '&quot; onfocus=&quot;alert(1)&quot; autofocus=&quot;');

// Formula injection through sanitizeForSheet
assert('formula =IMPORTRANGE', sanitizeForSheet('=IMPORTRANGE("url","A1")'), "'=IMPORTRANGE(\"url\",\"A1\")");
assert('formula +cmd', sanitizeForSheet('+cmd|/C calc'), "'+cmd|/C calc");
assert('formula -cmd', sanitizeForSheet('-cmd|/C calc'), "'-cmd|/C calc");
assert('formula @SUM', sanitizeForSheet('@SUM(A1)'), "'@SUM(A1)");

// ICS injection
assert('ICS inject newline to add VALARM', escapeICSText('text\nBEGIN:VALARM'), 'text\\nBEGIN:VALARM');
assert('ICS inject semicolon property', escapeICSText('text;ATTENDEE:evil@x.com'), 'text\\;ATTENDEE:evil@x.com');

// Name normalisation edge cases for matching
assert('normalise double hyphen', normaliseName('Mary--Jane'), 'mary  jane'); // double space from double hyphen
assert('normalise leading hyphen', normaliseName('-John'), 'john');
assert('normalise trailing spaces', normaliseName('John   '), 'john');

// constantTimeEquals with special chars
assert('cte with null bytes', constantTimeEquals('ab\0cd', 'ab\0cd'), true);
assert('cte null byte diff', constantTimeEquals('ab\0cd', 'ab\0ce'), false);

// ═══════════════════════════════════════════════
//   RESULTS
// ═══════════════════════════════════════════════

// ── normalizePhoneForWhatsApp (standalone version without DOM) ──
console.log('\n=== normalizePhoneForWhatsApp ===');

function normalizePhoneForWhatsApp(phone, defaultCodeDigits) {
  if (!phone) return '';
  var digits = String(phone).replace(/[^\d]/g, '');
  if (digits.length < 10) return '';
  var codeDigits = (defaultCodeDigits || '').replace(/^0+/, '');
  if (codeDigits && codeDigits.length >= 1 && codeDigits.length <= 3 && digits.length === 10) {
    digits = codeDigits + digits;
  }
  if (digits.length > 15) return '';
  return digits;
}

assert('full international +91', normalizePhoneForWhatsApp('+91 98765 43210'), '919876543210');
assert('with parens and dashes', normalizePhoneForWhatsApp('(+91) 98765-43210'), '919876543210');
assert('US number', normalizePhoneForWhatsApp('+1 (555) 123-4567'), '15551234567');
assert('too short', normalizePhoneForWhatsApp('98765'), '');
assert('empty string', normalizePhoneForWhatsApp(''), '');
assert('null', normalizePhoneForWhatsApp(null), '');
assert('undefined', normalizePhoneForWhatsApp(undefined), '');
assert('10 digits with default code', normalizePhoneForWhatsApp('9876543210', '91'), '919876543210');
assert('10 digits no default code', normalizePhoneForWhatsApp('9876543210', ''), '9876543210');
assert('11+ digits ignores default code', normalizePhoneForWhatsApp('919876543210', '91'), '919876543210');
assert('spaces only', normalizePhoneForWhatsApp('   '), '');
assert('letters mixed in', normalizePhoneForWhatsApp('+91 abc 98765 43210'), '919876543210');
assert('leading zeros stripped from code', normalizePhoneForWhatsApp('9876543210', '091'), '919876543210');
assert('code too long (4 digits) ignored', normalizePhoneForWhatsApp('9876543210', '9191'), '9876543210');
assert('over 15 digits rejected', normalizePhoneForWhatsApp('+91 98765 43210 ext 12345'), '');
assert('exactly 15 digits ok', normalizePhoneForWhatsApp('123456789012345'), '123456789012345');

// ── buildWhatsAppUrl ──
console.log('\n=== buildWhatsAppUrl ===');

function buildWhatsAppUrl(phone, message, defaultCodeDigits) {
  var normalized = normalizePhoneForWhatsApp(phone, defaultCodeDigits);
  if (!normalized) return '';
  var url = 'https://wa.me/' + normalized;
  if (message) url += '?text=' + encodeURIComponent(message);
  return url;
}

assert('valid phone no message', buildWhatsAppUrl('+91 98765 43210'), 'https://wa.me/919876543210');
assert('valid phone with message', buildWhatsAppUrl('+91 98765 43210', 'Hello!'), 'https://wa.me/919876543210?text=Hello!');
assert('message with spaces', buildWhatsAppUrl('+91 98765 43210', 'Hi there'), 'https://wa.me/919876543210?text=Hi%20there');
assert('message with special chars', buildWhatsAppUrl('+91 98765 43210', 'Hello & welcome!'), 'https://wa.me/919876543210?text=Hello%20%26%20welcome!');
assert('invalid phone returns empty', buildWhatsAppUrl('123'), '');
assert('null phone returns empty', buildWhatsAppUrl(null, 'Hi'), '');

console.log('\n═══════════════════════════════════════');
console.log(`  PASSED: ${passed}`);
console.log(`  FAILED: ${failed}`);
console.log(`  TOTAL:  ${passed + failed}`);
console.log('═══════════════════════════════════════');

if (failures.length > 0) {
  console.log('\nFailed tests:');
  failures.forEach(f => {
    console.log(`  - ${f.testName}: expected ${JSON.stringify(f.expected)}, got ${JSON.stringify(f.actual)}`);
  });
}

process.exit(failed > 0 ? 1 : 0);
