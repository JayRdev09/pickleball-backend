'use strict';

/**
 * Seed Script — populates Supabase with sample data for development/testing.
 * Run: npm run seed
 */

require('dotenv').config();
const { supabaseAdmin } = require('../src/config/supabase');

const OWNER_EMAIL    = 'owner@pickleball.test';
const OWNER_PASSWORD = 'Password123!';

const PLAYERS = [
  { email: 'pro1@pickleball.test',      full_name: 'Carlos Reyes',    username: 'carlosreyes',   skill_tier: 'professional', serve_rating: 9, return_rating: 9, dink_rating: 9, volley_rating: 8, mobility_rating: 9 },
  { email: 'pro2@pickleball.test',      full_name: 'Angela Santos',   username: 'angelasantos',  skill_tier: 'professional', serve_rating: 8, return_rating: 9, dink_rating: 10, volley_rating: 9, mobility_rating: 8 },
  { email: 'advanced1@pickleball.test', full_name: 'Marco Dela Cruz', username: 'marcodc',       skill_tier: 'advanced',     serve_rating: 7, return_rating: 7, dink_rating: 8, volley_rating: 7, mobility_rating: 7 },
  { email: 'advanced2@pickleball.test', full_name: 'Lisa Tan',        username: 'lisatan',        skill_tier: 'advanced',     serve_rating: 6, return_rating: 8, dink_rating: 7, volley_rating: 7, mobility_rating: 8 },
  { email: 'inter1@pickleball.test',    full_name: 'Ryan Manalo',     username: 'ryanm',          skill_tier: 'intermediate', serve_rating: 5, return_rating: 6, dink_rating: 5, volley_rating: 6, mobility_rating: 6 },
  { email: 'inter2@pickleball.test',    full_name: 'Jen Garcia',      username: 'jengee',         skill_tier: 'intermediate', serve_rating: 6, return_rating: 5, dink_rating: 6, volley_rating: 5, mobility_rating: 5 },
  { email: 'beg1@pickleball.test',      full_name: 'Paolo Cruz',      username: 'paoloc',         skill_tier: 'beginner',     serve_rating: 3, return_rating: 3, dink_rating: 2, volley_rating: 3, mobility_rating: 4 },
  { email: 'beg2@pickleball.test',      full_name: 'Maria Lopez',     username: 'marialopez',     skill_tier: 'beginner',     serve_rating: 2, return_rating: 3, dink_rating: 3, volley_rating: 2, mobility_rating: 3 },
];

async function seed() {
  console.log('\n🌱 Starting seed...\n');

  // ── 1. Create Owner ─────────────────────────────────────────────────────────
  console.log('Creating owner account...');
  let ownerUserId = null;

  const { data: ownerAuth, error: ownerAuthErr } = await supabaseAdmin.auth.admin.createUser({
    email:         OWNER_EMAIL,
    password:      OWNER_PASSWORD,
    email_confirm: true,
  });

  if (ownerAuthErr && ownerAuthErr.message.includes('already registered')) {
    const { data: existingUsers } = await supabaseAdmin.auth.admin.listUsers();
    const existingOwner = existingUsers?.users?.find(u => u.email === OWNER_EMAIL);
    if (existingOwner) {
      ownerUserId = existingOwner.id;
      await supabaseAdmin.auth.admin.updateUserById(ownerUserId, { password: OWNER_PASSWORD });
    }
  } else if (ownerAuth?.user) {
    ownerUserId = ownerAuth.user.id;
  }

  if (ownerUserId) {
    await supabaseAdmin.from('profiles').upsert({
      id:        ownerUserId,
      full_name: 'Court Manager',
      username:  'courtowner',
      role:      'owner',
      is_active: true,
    }, { onConflict: 'id' });
    console.log(`  ✅ Owner: ${OWNER_EMAIL} / ${OWNER_PASSWORD}`);
  }

  // ── 2. Create Players ───────────────────────────────────────────────────────
  console.log('\nCreating player accounts...');
  const playerIds = [];

  const { data: allUsers } = await supabaseAdmin.auth.admin.listUsers();

  for (const player of PLAYERS) {
    let userId = null;
    const existing = allUsers?.users?.find(u => u.email === player.email);

    if (existing) {
      userId = existing.id;
      await supabaseAdmin.auth.admin.updateUserById(userId, { password: OWNER_PASSWORD });
    } else {
      const { data: authData } = await supabaseAdmin.auth.admin.createUser({
        email:         player.email,
        password:      OWNER_PASSWORD,
        email_confirm: true,
      });
      userId = authData?.user?.id;
    }

    if (!userId) continue;

    await supabaseAdmin.from('profiles').upsert({
      id:        userId,
      full_name: player.full_name,
      username:  player.username,
      role:      'player',
      is_active: true,
    }, { onConflict: 'id' });

    await supabaseAdmin.from('player_skills').upsert({
      player_id:       userId,
      skill_tier:      player.skill_tier,
      serve_rating:    player.serve_rating,
      return_rating:   player.return_rating,
      dink_rating:     player.dink_rating,
      volley_rating:   player.volley_rating,
      mobility_rating: player.mobility_rating,
    }, { onConflict: 'player_id' });

    playerIds.push(userId);
    console.log(`  ✅ ${player.full_name} (${player.skill_tier}) — ${player.email}`);
  }

  // ── 3. Create Bookings ──────────────────────────────────────────────────────
  console.log('\nCreating sample bookings...');
  const today = new Date().toISOString().split('T')[0];

  const bookingInserts = playerIds.map((pid, i) => ({
    player_id:      pid,
    booking_date:   today,
    preferred_time: `${9 + i}:00`,
    match_format:   'doubles',
    status:         'pending',
    payment_status: 'unpaid',
    fee:            150,
  }));

  const { data: bookings, error: bookErr } = await supabaseAdmin
    .from('bookings')
    .insert(bookingInserts)
    .select('id, player_id, created_at');

  if (bookErr) {
    console.error('Bookings error:', bookErr.message);
  } else {
    console.log(`  ✅ Created ${bookings.length} bookings`);
  }

  console.log('\n✅ Seed complete!\n');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
  console.log('Owner:   owner@pickleball.test / Password123!');
  console.log('Players: [name]@pickleball.test / Password123!');
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');

  process.exit(0);
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
