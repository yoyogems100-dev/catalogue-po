#!/usr/bin/env node
// YOYO GEMS — Tally live sync.
//
// Runs on a computer that can reach TallyPrime (best: the Tally PC itself).
// Every minute it asks Tally one tiny question — "has anything changed?" —
// and only when something changed (or when "Sync now" is tapped on the
// website) does it read the books and send them to the private Tally portal
// at /admin/tally.
//
// READ ONLY: every request sent to Tally is an Export request; the program
// refuses to send anything else. It never asks Tally for calculated closing
// stock (that calculation can freeze Tally for minutes); stock in hand is
// worked out on the website from opening stock plus every entry.
//
// Needs Node.js 18 or newer. No other installs.
//
//   node tally-sync.mjs setup     save the website address, sync key and Tally address
//   node tally-sync.mjs           keep syncing (leave it running)
//   node tally-sync.mjs once      sync one time and stop
//   node tally-sync.mjs check     only test the Tally connection
//   node tally-sync.mjs install   Windows: keep it running in the background (no admin needed)
//   node tally-sync.mjs uninstall Windows: stop it and remove it from startup

import { readFileSync, writeFileSync, existsSync, chmodSync, mkdirSync, copyFileSync, rmSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { gzipSync } from 'node:zlib';
import { homedir, hostname } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { createInterface } from 'node:readline/promises';

const CONFIG = process.env.YOYO_TALLY_SYNC_CONFIG || join(homedir(), '.yoyo-tally-sync.json');
const CHECK_EVERY_MS = 60_000; // "has anything changed?"
const POLL_EVERY_MS = 20_000; // "did someone tap Sync now?"
const FULL_EVERY_MS = 3 * 3600_000; // full re-read now and then (catches deleted entries)
const TALLY_TIMEOUT_MS = 120_000;

const log = (...a) => console.log(new Date().toLocaleString('en-IN'), '·', ...a);

function loadConfig() {
  if (!existsSync(CONFIG)) return null;
  try { return JSON.parse(readFileSync(CONFIG, 'utf8')); } catch { return null; }
}

/* ---------------- Tally (read only) ---------------- */

async function tally(cfg, xml) {
  // Hard guard: only ever Export. Never Import, never anything that could write.
  if (!xml.includes('<TALLYREQUEST>Export</TALLYREQUEST>') || /import/i.test(xml)) throw new Error('Refusing to send a non-export request to Tally');
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), TALLY_TIMEOUT_MS);
  try {
    const res = await fetch(cfg.tally, { method: 'POST', headers: { 'Content-Type': 'text/xml' }, body: xml, signal: ctrl.signal });
    if (!res.ok) throw new Error(`Tally answered ${res.status}`);
    return await res.text();
  } catch (e) {
    throw new Error(`Cannot reach Tally at ${cfg.tally} (${e.name === 'AbortError' ? 'timed out' : e.message}). Is TallyPrime open with the company loaded?`);
  } finally { clearTimeout(t); }
}

/** A read-only collection export. `filter` is an optional Tally formula rows must match. */
const collection = (id, type, fetchFields, filter = '', vars = '') => `<ENVELOPE><HEADER><VERSION>1</VERSION><TALLYREQUEST>Export</TALLYREQUEST><TYPE>Collection</TYPE><ID>${id}</ID></HEADER><BODY><DESC><STATICVARIABLES><SVEXPORTFORMAT>$$SysName:XML</SVEXPORTFORMAT>${currentCompany && id !== 'YyCo' ? `<SVCURRENTCOMPANY>${escXml(currentCompany)}</SVCURRENTCOMPANY>` : ''}${vars}</STATICVARIABLES><TDL><TDLMESSAGE><COLLECTION NAME="${id}" ISMODIFY="No"><TYPE>${type}</TYPE><FETCH>${fetchFields}</FETCH>${filter ? `<FILTER>${id}Filter</FILTER>` : ''}</COLLECTION>${filter ? `<SYSTEM TYPE="Formulae" NAME="${id}Filter">${filter}</SYSTEM>` : ''}</TDLMESSAGE></TDL></DESC></BODY></ENVELOPE>`;

/* ---------------- tiny XML helpers (Tally's XML is very regular) ---------------- */

const decode = (s) => s.replace(/&#4;/g, '').replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
  .replace(/&#(\d+);/g, (_, n) => String.fromCharCode(Number(n))).replace(/&amp;/g, '&').replace(/\u0004/g, '').trim();
const tag = (xml, name) => { const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([^<]*)</${name}>`)); return m ? decode(m[1]) : ''; };
const blocks = (xml, name) => { const out = []; const re = new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'g'); let m; while ((m = re.exec(xml))) out.push(m[0]); return out; };
const attr = (block, name) => { const m = block.match(new RegExp(`${name}="([^"]*)"`)); return m ? decode(m[1]) : ''; };
const strip = (xml, ...names) => names.reduce((s, n) => s.replace(new RegExp(`<${n}>[\\s\\S]*?</${n}>`, 'g'), ''), xml);
const num = (s) => { const m = String(s).replace(/,/g, '').match(/-?\d+(?:\.\d+)?/); return m ? Number(m[0]) : 0; };
const qtyUnit = (s) => { const m = String(s).replace(/,/g, '').match(/(-?\d+(?:\.\d+)?)\s*([^\d\s][^\s]*)?/); return m ? [Math.abs(Number(m[1])), m[2] || ''] : [0, '']; };

/* ---------------- reading the books ---------------- */

// The company every request reads from (set once we know which is open).
let currentCompany = '';
const escXml = (v) => v.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

async function changeMarker(cfg) {
  currentCompany = '';
  const xml = await tally(cfg, collection('YyCo', 'Company', 'Name,AltVchId,AltMstId'));
  const all = blocks(xml, 'COMPANY').filter((b) => /NAME="/.test(b)).map((co) => ({
    company: attr(co, 'NAME') || tag(co, 'NAME'), vch: num(tag(co, 'ALTVCHID')), mst: num(tag(co, 'ALTMSTID'))
  }));
  if (!all.length) throw new Error('Tally is open but no company is loaded. In TallyPrime, open the company (Alt+F3 → Select Company → Yoyo Gems).');
  const want = (cfg.company || '').toLowerCase();
  const pick = all.find((c) => want && c.company.toLowerCase() === want) || all.find((c) => /yoyo/i.test(c.company)) || all[0];
  currentCompany = pick.company;
  return pick;
}

async function readMasters(cfg) {
  const groups = parseGroups(await tally(cfg, collection('YyGroups', 'Group', 'Name,Parent')));
  const ledgers = parseLedgers(await tally(cfg, collection('YyLedgers', 'Ledger', 'Name,Parent,OpeningBalance,ClosingBalance,LedStateName,Address')));
  // Opening stock only — stored values, quick to read. (No ClosingValue: see the note at the top.)
  const stock = parseStock(await tally(cfg, collection('YyStock', 'StockItem', 'Name,Parent,BaseUnits,OpeningBalance,OpeningValue')));
  return { groups, ledgers, stock };
}

function parseGroups(xml) { return blocks(xml, 'GROUP').map((b) => [attr(b, 'NAME'), tag(b, 'PARENT')]); }
function parseLedgers(xml) {
  return blocks(xml, 'LEDGER').map((b) => [
    attr(b, 'NAME'), tag(b, 'PARENT'), tag(b, 'LEDSTATENAME'),
    blocks(b, 'ADDRESS').map((a) => decode(a.replace(/<[^>]+>/g, ''))).filter(Boolean).join(', '),
    num(tag(b, 'OPENINGBALANCE')), num(tag(b, 'CLOSINGBALANCE'))
  ]);
}
function parseStock(xml) {
  return blocks(xml, 'STOCKITEM').map((b) => {
    const [oq] = qtyUnit(tag(b, 'OPENINGBALANCE'));
    return [attr(b, 'NAME'), tag(b, 'PARENT'), tag(b, 'BASEUNITS'), oq, Math.abs(num(tag(b, 'OPENINGVALUE')))];
  });
}

const VCH_FIELDS = 'Date,VoucherTypeName,VoucherNumber,PartyLedgerName,Narration,AlterId,Guid,' +
  'AllInventoryEntries.StockItemName,AllInventoryEntries.ActualQty,AllInventoryEntries.Rate,AllInventoryEntries.Amount,AllInventoryEntries.IsDeemedPositive,' +
  'AllLedgerEntries.LedgerName,AllLedgerEntries.Amount';

async function readVouchers(cfg, fromDate, toDate, afterAlterId = 0) {
  const filter = afterAlterId > 0 ? `$AlterId &gt; ${afterAlterId}` : '';
  const xml = await tally(cfg, collection('YyVch', 'Voucher', VCH_FIELDS, filter, `<SVFROMDATE>${fromDate}</SVFROMDATE><SVTODATE>${toDate}</SVTODATE>`));
  return parseVouchers(xml);
}

function parseVouchers(xml) {
  // Real entries carry a date; the bare <VOUCHER>1</VOUCHER> in Tally's header is just a count.
  return blocks(xml, 'VOUCHER').filter((b) => b.includes('<DATE')).map((b) => {
    const inv = blocks(b, 'ALLINVENTORYENTRIES.LIST').map((ib) => {
      const e = strip(ib, 'BATCHALLOCATIONS.LIST', 'ACCOUNTINGALLOCATIONS.LIST');
      const [q, unit] = qtyUnit(tag(e, 'ACTUALQTY') || tag(e, 'BILLEDQTY'));
      const rate = num(tag(e, 'RATE'));
      return [tag(e, 'STOCKITEMNAME'), q, unit || (tag(e, 'RATE').split('/')[1] || ''), rate, Math.abs(num(tag(e, 'AMOUNT'))), tag(e, 'ISDEEMEDPOSITIVE') === 'Yes'];
    }).filter((x) => x[0]);
    const led = blocks(b, 'ALLLEDGERENTRIES.LIST').map((lb) => {
      const e = strip(lb, 'BILLALLOCATIONS.LIST', 'BANKALLOCATIONS.LIST', 'INVENTORYALLOCATIONS.LIST', 'CATEGORYALLOCATIONS.LIST');
      return [tag(e, 'LEDGERNAME'), num(tag(e, 'AMOUNT'))];
    }).filter((x) => x[0]);
    return { alter: num(tag(b, 'ALTERID')), v: [tag(b, 'GUID') || attr(b, 'REMOTEID'), tag(b, 'DATE'), tag(b, 'VOUCHERTYPENAME') || attr(b, 'VCHTYPE'), tag(b, 'VOUCHERNUMBER'), tag(b, 'PARTYLEDGERNAME'), tag(b, 'NARRATION'), inv, led] };
  });
}

/* ---------------- the website ---------------- */

async function site(cfg, method, body) {
  const res = await fetch(new URL('/api/tally-sync', cfg.site), {
    method,
    headers: { Authorization: `Bearer ${cfg.key}`, ...(body ? { 'Content-Type': 'application/octet-stream' } : {}) },
    body
  });
  const json = await res.json().catch(() => ({}));
  if (res.status === 401) throw new Error('The website did not accept the sync key. Make a new key in Tally accounts → Sync settings, then run: node tally-sync.mjs setup');
  if (!res.ok) throw new Error(json.error || `Website answered ${res.status}`);
  return json;
}

/* ---------------- the sync loop ---------------- */

function fyRange() {
  const now = new Date();
  const y = now.getMonth() >= 3 ? now.getFullYear() : now.getFullYear() - 1;
  return [`${y}0401`, `${y + 1}0331`];
}

const state = { marker: null, masters: null, vouchers: new Map(), maxAlter: 0, lastFull: 0, lastRequest: '' };

async function sync(cfg, { full = false, reason = '' } = {}) {
  const t0 = Date.now();
  const [from, to] = cfg.from ? [cfg.from, fyRange()[1]] : fyRange();
  const marker = await changeMarker(cfg);
  const fullNow = full || !state.masters || Date.now() - state.lastFull > FULL_EVERY_MS;
  const vchChanged = !state.marker || marker.vch !== state.marker.vch;
  const mstChanged = !state.marker || marker.mst !== state.marker.mst;
  if (!fullNow && !vchChanged && !mstChanged) return false;

  if (fullNow || mstChanged) state.masters = await readMasters(cfg);
  if (fullNow) {
    const all = await readVouchers(cfg, from, to);
    state.vouchers = new Map(all.map((x) => [x.v[0], x.v]));
    state.maxAlter = Math.max(0, ...all.map((x) => x.alter));
    state.lastFull = Date.now();
  } else if (vchChanged) {
    const changed = await readVouchers(cfg, from, to, state.maxAlter);
    for (const x of changed) { state.vouchers.set(x.v[0], x.v); state.maxAlter = Math.max(state.maxAlter, x.alter); }
  }
  state.marker = marker;

  // Never replace the portal's data with an empty copy (e.g. Tally opened without the company).
  if (!state.masters.ledgers.length) throw new Error('Tally sent no ledgers, so nothing was uploaded. Is the right company open in Tally?');
  if (!state.vouchers.size) throw new Error('Tally sent no entries for this year, so nothing was uploaded. Is the right company open in Tally?');

  const raw = {
    format: 'yoyo-tally-raw-1', company: marker.company, computer: cfg.computer || hostname(), syncedAt: new Date().toISOString(),
    fromDate: from, toDate: to, ...state.masters, vouchers: [...state.vouchers.values()]
  };
  const gz = gzipSync(JSON.stringify(raw));
  const res = await site(cfg, 'POST', gz);
  log(`Synced ${raw.vouchers.length} entries, ${raw.ledgers.length} ledgers${reason ? ` (${reason})` : ''} in ${((Date.now() - t0) / 1000).toFixed(1)}s, ${(gz.length / 1024).toFixed(0)} KB.`);
  if (res.requestedAt) state.lastRequest = res.requestedAt;
  return true;
}

async function run(cfg, once) {
  log(`Tally live sync started on ${cfg.computer || hostname()}. Tally: ${cfg.tally} → ${cfg.site}`);
  if (once) { await sync(cfg, { full: true, reason: 'one-off' }); return; }
  if (!takeLock()) { log('Already running on this computer — leaving it to the other copy.'); return; }
  // When Tally is closed or the company isn't open yet, keep waiting instead of stopping.
  await sync(cfg, { full: true, reason: 'start' }).catch((e) => log('Problem:', e.message));
  let lastCheck = Date.now();
  let busy = false;
  setInterval(async () => {
    if (busy) return;
    busy = true;
    try {
      const { requestedAt } = await site(cfg, 'GET');
      if (requestedAt && requestedAt !== state.lastRequest) {
        state.lastRequest = requestedAt;
        await sync(cfg, { full: true, reason: 'Sync now' });
        lastCheck = Date.now();
      } else if (Date.now() - lastCheck >= CHECK_EVERY_MS) {
        await sync(cfg, { reason: 'Tally changed' });
        lastCheck = Date.now();
      }
    } catch (e) {
      log('Problem:', e.message);
    } finally { busy = false; }
  }, POLL_EVERY_MS);
}

async function setup() {
  const rl = createInterface({ input: process.stdin, output: process.stdout });
  const old = loadConfig() || {};
  const ask = async (q, d) => (await rl.question(`${q}${d ? ` [${d}]` : ''}: `)).trim() || d || '';
  const cfg = {
    site: await ask('Website address', old.site || 'https://www.yoyogems.co.in'),
    key: await ask('Sync key (from Tally accounts → Sync settings)', old.key ? '(keep current)' : ''),
    tally: await ask('Tally address', old.tally || 'http://127.0.0.1:9000'),
    computer: await ask('Name for this computer', old.computer || hostname())
  };
  if (cfg.key === '(keep current)') cfg.key = old.key;
  rl.close();
  if (!/^ytk_[A-Za-z0-9_-]{30,}$/.test(cfg.key)) { console.error('That does not look like a sync key (it starts with ytk_).'); process.exit(1); }
  writeFileSync(CONFIG, JSON.stringify(cfg, null, 2));
  try { chmodSync(CONFIG, 0o600); } catch { /* Windows */ }
  console.log(`Saved to ${CONFIG}. Now run: node tally-sync.mjs`);
}

/* ---------------- running in the background ---------------- */

// One copy per computer: a small lock file with the running copy's process id.
const LOCK = join(homedir(), '.yoyo-tally-sync.lock');
function takeLock() {
  try {
    const pid = Number(readFileSync(LOCK, 'utf8'));
    if (pid && pid !== process.pid) { try { process.kill(pid, 0); return false; } catch { /* stale */ } }
  } catch { /* no lock yet */ }
  writeFileSync(LOCK, String(process.pid));
  return true;
}

// Windows: a hidden starter in the user's Startup folder — no Administrator rights needed.
// Mac: use install-mac.sh (launchd).
const HOME_DIR = join(homedir(), 'yoyo-tally-sync');
const startupFile = () => join(process.env.APPDATA || join(homedir(), 'AppData', 'Roaming'), 'Microsoft', 'Windows', 'Start Menu', 'Programs', 'Startup', 'YOYO Tally Sync.vbs');

function install() {
  if (process.platform !== 'win32') { console.log('On a Mac, run: bash install-mac.sh'); return; }
  mkdirSync(HOME_DIR, { recursive: true });
  const self = fileURLToPath(import.meta.url);
  const target = join(HOME_DIR, 'tally-sync.mjs');
  if (self.toLowerCase() !== target.toLowerCase()) copyFileSync(self, target);
  const q = (v) => v.replace(/"/g, '""');
  const cmdLine = `cmd /c ""${q(process.execPath)}" "${q(target)}" >> "${q(join(HOME_DIR, 'sync.log'))}" 2>&1"`;
  const vbs = `' Starts the YOYO GEMS Tally live sync, hidden, when you log in.\r\nCreateObject("WScript.Shell").Run "${q(cmdLine)}", 0, False\r\n`;
  writeFileSync(startupFile(), vbs);
  spawn('wscript.exe', [startupFile()], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  console.log(`Installed. The sync now runs in the background and starts by itself when you log in.\nLog: ${join(HOME_DIR, 'sync.log')}`);
}

function uninstall() {
  if (process.platform !== 'win32') { console.log('On a Mac, run: bash install-mac.sh remove'); return; }
  try { rmSync(startupFile()); } catch { /* not installed */ }
  try { const pid = Number(readFileSync(LOCK, 'utf8')); if (pid) process.kill(pid); } catch { /* not running */ }
  try { rmSync(LOCK); } catch { /* none */ }
  console.log('Removed. The sync is stopped and will not start at login.');
}

// Exported for tests: turning Tally's XML into the upload format.
export { parseGroups, parseLedgers, parseStock, parseVouchers };

const isMain = process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href;
if (isMain) main();

async function main() {
  const cmd = process.argv[2] || 'run';
  if (cmd === 'setup') return setup();
  const cfg = loadConfig();
  if (!cfg && cmd !== 'check') { console.error('Not set up yet. Run: node tally-sync.mjs setup'); process.exit(1); }
  const c = cfg || { tally: process.env.TALLY_URL || 'http://127.0.0.1:9000' };
  if (cmd === 'check') {
    try {
      const m = await changeMarker(c);
      console.log(`OK — Tally is reachable and "${m.company}" is open. Change markers: entries ${m.vch}, masters ${m.mst}.`);
    } catch (e) { console.error(`Not ready: ${e.message}`); process.exit(1); }
    return;
  }
  if (cmd === 'install') return install();
  if (cmd === 'uninstall') return uninstall();
  await run(c, cmd === 'once').catch((e) => { log('Stopped:', e.message); process.exit(1); });
}
