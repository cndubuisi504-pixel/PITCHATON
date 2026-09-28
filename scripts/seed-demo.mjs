#!/usr/bin/env node
/**
 * PITCHATON — demo data seeder (local driver only).
 *
 *   npm run seed:demo
 *
 * Fills .data/db.json with a realistic semester so you can click through the
 * whole product before real submissions arrive: 1 admin, 1 founder account,
 * 6 pitches across categories, published results and two news posts.
 *
 * Safe to re-run: it replaces the local database. Production data lives in
 * Supabase and is never touched by this script.
 */

import { promises as fs } from 'fs';
import path from 'path';
import crypto from 'crypto';
import bcrypt from 'bcryptjs';

const DATA_DIR = process.env.PITCHATON_DATA_DIR
  ? path.resolve(process.env.PITCHATON_DATA_DIR)
  : path.join(process.cwd(), '.data');
const DB_PATH = path.join(DATA_DIR, 'db.json');

if (process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.error(
    '\n✗ Supabase credentials detected. This script only seeds the LOCAL store.\n' +
      '  Unset NEXT_PUBLIC_SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY to run it.\n',
  );
  process.exit(1);
}

const id = () => crypto.randomUUID();
const now = () => new Date().toISOString();
const days = (n) => new Date(Date.now() + n * 86_400_000).toISOString();

const ADMIN_EMAIL = process.env.ADMIN_EMAILS?.split(',')[0]?.trim() || 'contacteihpitchaton@gmail.com';
const ADMIN_PASSWORD = process.env.SEED_ADMIN_PASSWORD || 'Cross0702';
const FOUNDER_PASSWORD = process.env.SEED_FOUNDER_PASSWORD || 'pitchaton123';

const hash = (password) => bcrypt.hashSync(password, 10);

const admin = {
  id: id(),
  email: ADMIN_EMAIL.toLowerCase(),
  password_hash: hash(ADMIN_PASSWORD),
  full_name: 'ICT Hub Lead',
  role: 'admin',
  created_at: now(),
};

const founder = {
  id: id(),
  email: 'founder@example.com',
  password_hash: hash(FOUNDER_PASSWORD),
  full_name: 'Chidera Nwosu',
  role: 'founder',
  created_at: now(),
};

const PITCH_SPECS = [
  {
    title: 'SolarCold — cold storage for market traders',
    category: 'Agritech',
    status: 'winner',
    owner: founder.id,
    description:
      'Tomato and pepper traders at Ogbete Main Market lose up to 40% of stock to heat between harvest and sale. SolarCold is a shared, pay-per-crate solar cold room that a cooperative of ten traders can rent for ₦300 a day. We are testing a 1,000-litre prototype with two solar panels, a DC compressor and an SMS booking line that works on feature phones.',
    founders: [
      { name: 'Chidera Nwosu', email: 'founder@example.com', phone: '+234 803 111 2233', school_year: '400 level' },
      { name: 'Amaka Obi', email: 'amaka.obi@example.com', phone: '+234 806 555 7788', school_year: '300 level' },
    ],
    files: [
      { name: 'solarcold-deck.pdf', type: 'application/pdf', size: 2_411_000 },
      { name: 'prototype-photos.zip', type: 'application/zip', size: 8_902_000 },
    ],
    result: { rank: 1, score: 92.5, notes: 'Sharp problem framing, real pilot data, and a pricing model traders can actually afford.' },
  },
  {
    title: 'CampusRide — verified student carpool',
    category: 'Mobility',
    status: 'finalist',
    owner: founder.id,
    description:
      'Students commuting from Enugu North spend a large slice of their allowance on keke fares. CampusRide matches students travelling the same route at the same time, verifies each rider with a matric number and a face photo, and splits the fare inside the app. We have 340 students on the waitlist from a single WhatsApp group.',
    founders: [
      { name: 'Emeka Balogun', email: 'emeka.balogun@example.com', phone: '+234 811 222 3344', school_year: '300 level' },
      { name: 'Fatima Yusuf', email: 'fatima.yusuf@example.com', phone: null, school_year: '200 level' },
      { name: 'Tobi Adeyemi', email: 'tobi.adeyemi@example.com', phone: null, school_year: '300 level' },
    ],
    files: [{ name: 'campusride-wireframes.pdf', type: 'application/pdf', size: 1_204_000 }],
    result: { rank: 2, score: 88, notes: 'Strong traction signal from a single campus group; needs a safety policy before scaling.' },
  },
  {
    title: 'Naija Study Coach — WAEC prep over WhatsApp',
    category: 'EdTech',
    status: 'finalist',
    owner: founder.id,
    description:
      'Most secondary school students preparing for WAEC cannot afford private tutors, but almost all have WhatsApp. Naija Study Coach sends a daily 12-question practice set per subject, marks it instantly, and slides weak topics into the next day’s set. A teacher dashboard shows which topics the class is failing before the mock exam.',
    founders: [
      { name: 'Blessing Eze', email: 'blessing.eze@example.com', phone: '+234 703 909 1122', school_year: 'Postgraduate' },
    ],
    files: [{ name: 'study-coach-pilot-results.xlsx', type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', size: 640_000 }],
    result: { rank: 3, score: 84.5, notes: 'Clear pedagogical thinking. Judges want a plan for paying teachers.' },
  },
  {
    title: 'FixIt Enugu — vetted repair technicians on demand',
    category: 'Local services',
    status: 'accepted',
    owner: founder.id,
    description:
      'Booking a trustworthy electrician or plumber in Enugu still happens through word of mouth. FixIt lists technicians who pass an in-person skills check, shows a fixed price range before booking, and holds payment until the job is confirmed done by the customer.',
    founders: [
      { name: 'Ibrahim Sule', email: 'ibrahim.sule@example.com', phone: '+234 802 444 5566', school_year: '400 level' },
      { name: 'Grace Umeh', email: 'grace.umeh@example.com', phone: null, school_year: '400 level' },
    ],
    files: [],
    result: null,
  },
  {
    title: 'Hostel Pantry — bulk food buying cooperative',
    category: 'Commerce',
    status: 'under_review',
    owner: founder.id,
    description:
      'Buying rice, oil and garri in bulk cuts the cost per student by roughly 22%, but no single student can afford a full bag. Hostel Pantry pools orders from a hostel block each month, negotiates with the market directly, and splits the purchase by verified order size.',
    founders: [
      { name: 'Ngozi Okeke', email: 'ngozi.okeke@example.com', phone: '+234 809 777 8899', school_year: '200 level' },
    ],
    files: [{ name: 'pantry-cost-model.pdf', type: 'application/pdf', size: 512_000 }],
    result: null,
  },
  {
    title: 'QuietSpace — bookable study pods in the library',
    category: 'Campus tools',
    status: 'submitted',
    owner: founder.id,
    description:
      'During exams the library is unusable: no seats, no sockets, constant noise. QuietSpace turns three underused library rooms into bookable 90-minute study slots, reservable from a phone, with sockets, a whiteboard and a no-phone rule enforced by a simple code of conduct.',
    founders: [
      { name: 'David Nnamdi', email: 'david.nnamdi@example.com', phone: null, school_year: '100 level' },
      { name: 'Kemi Aliyu', email: 'kemi.aliyu@example.com', phone: null, school_year: '100 level' },
    ],
    files: [],
    result: null,
  },
];

const pitches = [];
const founders = [];
const files = [];
const results = [];

PITCH_SPECS.forEach((spec, index) => {
  const pitchId = id();
  const createdAt = days(-(30 - index * 3));

  pitches.push({
    id: pitchId,
    code: `PCH-${String(index + 1).padStart(4, '0')}`,
    title: spec.title,
    description: spec.description,
    category: spec.category,
    status: spec.status,
    editable: spec.status === 'submitted',
    created_at: createdAt,
    updated_at: createdAt,
    created_by: spec.owner,
  });

  spec.founders.forEach((person) => {
    founders.push({
      id: id(),
      pitch_id: pitchId,
      name: person.name,
      email: person.email,
      phone: person.phone ?? null,
      school_year: person.school_year ?? null,
      created_at: createdAt,
    });
  });

  spec.files.forEach((file) => {
    files.push({
      id: id(),
      pitch_id: pitchId,
      file_name: file.name,
      file_url: '',                       // local driver resolves downloads by id
      file_type: file.type,
      file_size: file.size,
      storage_path: null,                 // demo metadata only — no bytes on disk
      uploaded_at: createdAt,
    });
  });

  if (spec.result) {
    results.push({
      id: id(),
      pitch_id: pitchId,
      rank: spec.result.rank,
      score: spec.result.score,
      notes: spec.result.notes,
      uploaded_at: now(),
    });
  }
});

const news = [
  {
    id: id(),
    title: 'SolarCold takes the semester final',
    content:
      'After three rounds of judging, SolarCold — the shared solar cold room for market traders — finished top of the table with 92.5 points.\n\nThe panel praised the pilot data from Ogbete Main Market and the pay-per-crate pricing that traders can actually afford. Amaka and Chidera will now work with the Hub on a six-week pilot support package: storage space, a mentor from the energy sector and help preparing an investor one-pager.\n\nFull ranking, scores and judge notes are on the leaderboard.',
    image_url: null,
    featured_pitch_id: pitches[0].id,
    published_at: days(-1),
    created_by: admin.id,
  },
  {
    id: id(),
    title: 'Judging is done — results drop this Friday',
    content:
      'Six pitches went through the review pipeline this semester. The judging panel met on Tuesday and the scores are final.\n\nResults will be published on the leaderboard on Friday at 4pm. Every founder gets an email the moment their status changes, and the Hub will publish a spotlight on the winning team the same evening.\n\nThank you to everyone who submitted — the standard this round was the highest we have seen.',
    image_url: null,
    featured_pitch_id: null,
    published_at: days(-4),
    created_by: admin.id,
  },
];

const db = {
  version: 1,
  users: [admin, founder],
  pitches,
  founders,
  files,
  results,
  news,
  emails: [],
  settings: {
    id: 'singleton',
    submission_deadline: days(12),
    competition_date: days(20),
    submission_enabled: true,
    edit_mode_enabled: false,
    results_published: true,
    hub_name: 'ICT Hub',
    institution_name: 'ICT Hub · Enugu, Nigeria',
    updated_at: now(),
  },
};

await fs.mkdir(DATA_DIR, { recursive: true });
await fs.writeFile(DB_PATH, JSON.stringify(db, null, 2), 'utf8');

console.log(`
✓ Demo semester seeded → ${DB_PATH}

  Admin       ${admin.email}
              password: ${ADMIN_PASSWORD}

  Founder     ${founder.email}
              password: ${FOUNDER_PASSWORD}

  ${pitches.length} pitches · ${results.length} results · ${news.length} news posts
  Leaderboard is published so you can see the public ranking immediately.

  Start the app:  npm run dev   →  http://localhost:3000
`);
