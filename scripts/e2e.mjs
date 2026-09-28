#!/usr/bin/env node
/**
 * PITCHATON — end-to-end test suite.
 *
 *   node scripts/e2e.mjs                        # against http://localhost:3000
 *   BASE_URL=http://localhost:3500 node scripts/e2e.mjs
 *
 * Exercises the real HTTP surface the way a browser does, including the
 * authorisation rules that matter most: role assignment, ownership isolation,
 * edit windows and the leaderboard publish gate.
 *
 * Works against either storage driver — point it at an instance running the
 * Supabase driver (`scripts/mock-supabase.mjs` + env vars) to cover that code
 * path, or at the default local-driver instance.
 *
 * Exits non-zero if any check fails.
 */

const BASE = (process.env.BASE_URL || 'http://localhost:3000').replace(/\/$/, '');
const ADMIN_EMAIL = process.env.E2E_ADMIN_EMAIL || 'contacteihpitchaton@gmail.com';
const ADMIN_PASSWORD = process.env.E2E_ADMIN_PASSWORD || 'Cross0702';
const FOUNDER_EMAIL = process.env.E2E_FOUNDER_EMAIL || `founder.${Date.now()}@example.com`;
const FOUNDER_PASSWORD = 'strongpass123';

let passed = 0;
const failures = [];

function check(label, condition, detail = '') {
  if (condition) {
    passed += 1;
    console.log(`  ✓ ${label}`);
  } else {
    failures.push(label);
    console.log(`  ✗ ${label}${detail ? ` — ${detail}` : ''}`);
  }
}

function section(title) {
  console.log(`\n${title}`);
}

/**
 * `next dev` compiles each route on first request; the very first hit after a
 * rebuild can fail while that happens. Retry those transient failures so the
 * suite tests behaviour, not compile timing.
 */
async function withWarmup(client, path, init, predicate = (response) => response.status !== 404) {
  let response = await client.fetch(path, init);
  if (!predicate(response)) {
    await new Promise((resolve) => setTimeout(resolve, 2000));
    response = await client.fetch(path, init);
  }
  return response;
}

/** Minimal cookie-jar fetch (Node's fetch does not persist cookies). */
function makeClient() {
  const jar = new Map();
  return {
    cookies: jar,
    async fetch(path, init = {}) {
      const headers = new Headers(init.headers || {});
      if (jar.size) {
        headers.set('Cookie', [...jar.entries()].map(([k, v]) => `${k}=${v}`).join('; '));
      }
      if (init.json !== undefined) {
        headers.set('Content-Type', 'application/json');
        init.body = JSON.stringify(init.json);
      }
      const response = await fetch(`${BASE}${path}`, { ...init, headers, redirect: 'manual' });
      const setCookie = response.headers.getSetCookie?.() ?? [];
      for (const cookie of setCookie) {
        const [pair] = cookie.split(';');
        const index = pair.indexOf('=');
        const name = pair.slice(0, index).trim();
        const value = pair.slice(index + 1).trim();
        if (value === '') jar.delete(name);
        else jar.set(name, value);
      }
      const text = await response.text();
      let body = null;
      try {
        body = text ? JSON.parse(text) : null;
      } catch {
        body = text;
      }
      return { status: response.status, body, headers: response.headers };
    },
  };
}

const admin = makeClient();
const founder = makeClient();
const anonymous = makeClient();

/* ------------------------------------------------------------------ */

section(`PITCHATON end-to-end → ${BASE}`);

const health = await withWarmup(anonymous, '/api/health', {}, (response) => response.status === 200);
check('health endpoint responds', health.status === 200, `status ${health.status}`);
const driver = health.body?.driver;
console.log(`    storage driver: ${driver}`);

section('Public pages');
for (const path of ['/', '/leaderboard', '/news']) {
  const response = await withWarmup(anonymous, path, {}, (result) => result.status === 200);
  check(`${path} renders (200)`, response.status === 200, `status ${response.status}`);
}
const adminPage = await anonymous.fetch('/admin');
check('/admin redirects anonymous visitors to login', [302, 307].includes(adminPage.status), `status ${adminPage.status}`);
const dashboardPage = await anonymous.fetch('/dashboard');
check('/dashboard redirects anonymous visitors', [302, 307].includes(dashboardPage.status), `status ${dashboardPage.status}`);

section('Admin account');
let adminSignup = await admin.fetch('/api/auth/signup', {
  method: 'POST',
  json: { full_name: 'ICT Hub Lead', email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
});
if (adminSignup.status === 409) {
  adminSignup = await admin.fetch('/api/auth/login', {
    method: 'POST',
    json: { email: ADMIN_EMAIL, password: ADMIN_PASSWORD },
  });
}
check('Hub address signs in and is an admin', adminSignup.body?.user?.role === 'admin', JSON.stringify(adminSignup.body).slice(0, 120));
check('session cookie issued', admin.cookies.size > 0);

const overview = await admin.fetch('/api/admin/overview');
check('admin overview returns data', overview.status === 200, `status ${overview.status}`);

section('Founder account and submission');
const founderSignup = await founder.fetch('/api/auth/signup', {
  method: 'POST',
  json: { full_name: 'E2E Founder', email: FOUNDER_EMAIL, password: FOUNDER_PASSWORD },
});
check('founder signs up', founderSignup.status === 201, `status ${founderSignup.status}`);
check('new account is a founder (not admin)', founderSignup.body?.user?.role === 'founder');

const forbidden = await founder.fetch('/api/admin/overview');
check('founder blocked from admin API (403)', forbidden.status === 403, `status ${forbidden.status}`);
const forbiddenPage = await founder.fetch('/admin');
check('founder redirected away from /admin', [302, 307].includes(forbiddenPage.status), `status ${forbiddenPage.status}`);

const created = await founder.fetch('/api/pitches', {
  method: 'POST',
  json: {
    title: 'E2E SolarCold cold storage',
    description:
      'A shared solar cold room for market traders, validated with two panels and a DC compressor during the semester pilot.',
    category: 'Agritech',
    founders: [
      { name: 'E2E Founder', email: FOUNDER_EMAIL, phone: '+2348000000000', school_year: '400 level' },
      { name: 'Second Founder', email: `second.${Date.now()}@example.com`, school_year: '300 level' },
    ],
  },
});
check('pitch created', created.status === 201 && Boolean(created.body?.pitch?.id), `status ${created.status}`);
const pitchId = created.body?.pitch?.id;
const pitchCode = created.body?.pitch?.code;
check('pitch code assigned', /^PCH-\d{4}$/.test(pitchCode || ''), `code ${pitchCode}`);
check('new pitch starts as submitted', created.body?.pitch?.status === 'submitted');

section('Attachments');
const sign = await founder.fetch(`/api/pitches/${pitchId}/files/sign`, {
  method: 'POST',
  json: { files: [{ file_name: 'deck.pdf', file_type: 'application/pdf', file_size: 2048 }] },
});
check('upload sign endpoint responds', sign.status === 200, `status ${sign.status}`);
check('upload mode reported', ['direct', 'proxy'].includes(sign.body?.mode), `mode ${sign.body?.mode}`);

const oversize = await founder.fetch(`/api/pitches/${pitchId}/files/sign`, {
  method: 'POST',
  json: { files: [{ file_name: 'huge.zip', file_type: 'application/zip', file_size: 60 * 1024 * 1024 }] },
});
check('oversize file rejected', [422, 403].includes(oversize.status), `status ${oversize.status}`);

if (sign.body?.mode === 'direct' && sign.body?.tickets?.length) {
  const ticket = sign.body.tickets[0];
  const put = await fetch(ticket.signedUrl, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/pdf' },
    body: Buffer.from('%PDF-1.4 e2e test payload'),
  });
  check('bytes uploaded to storage', put.ok, `status ${put.status}`);

  const register = await founder.fetch(`/api/pitches/${pitchId}/files/register`, {
    method: 'POST',
    json: {
      files: [
        { storage_path: ticket.path, file_name: 'deck.pdf', file_type: 'application/pdf', file_size: 23 },
      ],
    },
  });
  check('attachment registered', register.status === 201, `status ${register.status}`);
  check('storage path not leaked to client', register.body?.files?.[0] && !('storage_path' in register.body.files[0]));

  const foreign = await founder.fetch(`/api/pitches/${pitchId}/files/register`, {
    method: 'POST',
    json: { files: [{ storage_path: 'someone-elses-folder/evil.txt', file_name: 'evil.txt', file_size: 1 }] },
  });
  check('foreign storage path rejected', foreign.status === 422, `status ${foreign.status}`);
} else {
  // Local driver: exercise the proxied multipart path instead.
  const form = new FormData();
  form.append('files', new Blob([Buffer.from('e2e attachment')], { type: 'text/plain' }), 'notes.txt');
  const upload = await founder.fetch(`/api/pitches/${pitchId}/files`, { method: 'POST', body: form });
  check('proxied upload accepted', upload.status === 201, `status ${upload.status}`);
}

section('Ownership isolation');
const other = makeClient();
const otherSignup = await other.fetch('/api/auth/signup', {
  method: 'POST',
  json: { full_name: 'Nosy Neighbour', email: `nosy.${Date.now()}@example.com`, password: 'strongpass123' },
});
check('second founder created', otherSignup.status === 201, `status ${otherSignup.status}`);

const peeking = await other.fetch(`/api/pitches/${pitchId}`);
check("another founder cannot read someone else's pitch (403)", peeking.status === 403, `status ${peeking.status}`);

const detail = await founder.fetch(`/api/pitches/${pitchId}`);
const firstFile = detail.body?.pitch?.files?.[0];
if (firstFile) {
  // On the Supabase driver the route authorises, then 302s to a short-lived
  // signed storage URL; the local driver streams the bytes directly.
  const ownDownload = await founder.fetch(`/api/files/${firstFile.id}`);
  check(
    'owner can download their file (200 or signed redirect)',
    ownDownload.status === 200 || ownDownload.status === 302,
    `status ${ownDownload.status}`,
  );
  if (ownDownload.status === 302) {
    const location = ownDownload.headers.get('location');
    const followed = await fetch(new URL(location, BASE).toString());
    check('signed download link serves the bytes', followed.ok, `status ${followed.status}`);
  }
  const stolen = await other.fetch(`/api/files/${firstFile.id}`);
  check("another founder cannot download it (403)", stolen.status === 403, `status ${stolen.status}`);
  const adminDownload = await admin.fetch(`/api/files/${firstFile.id}`);
  check(
    'admin can download any file',
    adminDownload.status === 200 || adminDownload.status === 302,
    `status ${adminDownload.status}`,
  );
}

section('Review pipeline and edit windows');
const statusChange = await admin.fetch(`/api/pitches/${pitchId}/status`, {
  method: 'POST',
  json: { status: 'under_review' },
});
check('admin can change status', statusChange.status === 200, `status ${statusChange.status}`);
check('status is now under_review', statusChange.body?.pitch?.status === 'under_review');

const founderStatusChange = await founder.fetch(`/api/pitches/${pitchId}/status`, {
  method: 'POST',
  json: { status: 'winner' },
});
check('founder cannot change their own status (403)', founderStatusChange.status === 403, `status ${founderStatusChange.status}`);

const lockedEdit = await founder.fetch(`/api/pitches/${pitchId}`, {
  method: 'PATCH',
  json: { title: 'Should be blocked' },
});
check('edits blocked once triaged (403)', lockedEdit.status === 403, `status ${lockedEdit.status}`);

const unlock = await admin.fetch(`/api/pitches/${pitchId}/editable`, {
  method: 'POST',
  json: { editable: true },
});
check('admin can unlock a submission', unlock.status === 200, `status ${unlock.status}`);

const allowedEdit = await founder.fetch(`/api/pitches/${pitchId}`, {
  method: 'PATCH',
  json: { title: 'E2E SolarCold cold storage (revised)' },
});
check('owner can edit while unlocked', allowedEdit.status === 200, `status ${allowedEdit.status}`);

const foreignEdit = await other.fetch(`/api/pitches/${pitchId}`, {
  method: 'PATCH',
  json: { title: 'Not mine' },
});
check("third party cannot edit it (403/404)", [403, 404].includes(foreignEdit.status), `status ${foreignEdit.status}`);

section('Results, publishing and the leaderboard');
// Start from a known state: an instance may already have published results.
const unpublish = await admin.fetch('/api/admin/settings', {
  method: 'PATCH',
  json: { results_published: false },
});
check('results can be taken back down', unpublish.status === 200 && unpublish.body?.settings?.results_published === false);

const beforePublish = await anonymous.fetch('/api/leaderboard');
check('leaderboard hidden before publishing', beforePublish.body?.published === false && beforePublish.body?.rows?.length === 0);

const hiddenPage = await anonymous.fetch('/leaderboard');
check('hidden leaderboard leaks no ranking', !String(hiddenPage.body).includes('Champion'));

const result = await admin.fetch('/api/admin/results', {
  method: 'POST',
  json: { pitch_id: pitchId, rank: 1, score: 91.5, notes: 'E2E judge note.', mark_winner: true },
});
check('result recorded', [200, 201].includes(result.status), `status ${result.status}`);

const publish = await admin.fetch('/api/admin/settings', {
  method: 'PATCH',
  json: { results_published: true },
});
check('results published', publish.status === 200 && publish.body?.settings?.results_published === true);

const afterPublish = await anonymous.fetch('/api/leaderboard');
check('leaderboard now public', afterPublish.body?.published === true && afterPublish.body?.rows?.length > 0);
check('pitch appears with rank 1', afterPublish.body?.rows?.some((row) => row.pitch.code === pitchCode && row.rank === 1));
const page = await anonymous.fetch('/leaderboard');
check('leaderboard page renders the ranking', page.status === 200 && String(page.body).includes(pitchCode));

section('News');
const news = await admin.fetch('/api/admin/news', {
  method: 'POST',
  json: {
    title: 'E2E spotlight post',
    content: 'The judging panel praised the pilot data and the pricing model behind this submission.',
    featured_pitch_id: pitchId,
    notify_team: false,
  },
});
check('news post published', news.status === 201, `status ${news.status}`);
const feed = await anonymous.fetch('/api/news');
check('news appears in the public feed', feed.body?.posts?.some((post) => post.title === 'E2E spotlight post'));

section('Admin maintenance');
const exported = await admin.fetch('/api/pitches/export?scope=all');
check('CSV export returns a table', exported.status === 200 && String(exported.body).startsWith('Pitch ID,Title'));
check('CSV includes the new pitch', String(exported.body).includes(pitchCode));

const bulk = await admin.fetch('/api/admin/results/bulk', {
  method: 'POST',
  json: { csv: 'Pitch ID,Rank,Score,Notes\nPCH-9999,9,10,Ghost row' },
});
check('batch upload reports unmatched rows', bulk.status === 200 && bulk.body?.errorCount === 1, JSON.stringify(bulk.body).slice(0, 120));

const badSettings = await admin.fetch('/api/admin/settings', {
  method: 'PATCH',
  json: { submission_deadline: 'not-a-date' },
});
check('invalid date rejected (422)', badSettings.status === 422, `status ${badSettings.status}`);

section('Rate limiting');
// One fixed identity: the limiter counts per account (8 per 10 minutes).
const rateLimitEmail = `ratelimit.${Date.now()}@example.com`;
let sawLimit = false;
for (let attempt = 0; attempt < 10; attempt += 1) {
  const response = await anonymous.fetch('/api/auth/login', {
    method: 'POST',
    json: { email: rateLimitEmail, password: 'wrongpass123' },
  });
  if (response.status === 429) {
    sawLimit = true;
    break;
  }
}
check('repeated bad logins are rate limited', sawLimit);

/* ------------------------------------------------------------------ */

console.log(`\n${failures.length ? '✗' : '✓'} ${passed} passed, ${failures.length} failed`);
if (failures.length) {
  console.log('\nFailed checks:');
  for (const failure of failures) console.log(`  • ${failure}`);
  process.exit(1);
}
