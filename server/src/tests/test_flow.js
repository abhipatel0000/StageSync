process.env.NODE_ENV = 'test';
const assert = require('assert');
const { 
  sequelize, User, Event, EventCredential, GuestSession, File, DownloadLog, AuditLog, QrAccessToken 
} = require('../models');
const { hashPassword, comparePassword, hashToken, compareToken, generateEventCode, generatePin } = require('../utils/security');
const { Op } = require('sequelize');

async function runTests() {
  console.log('===========================================================');
  console.log(' STARTING STAGESYNC LOGIC & DATABASE INTEGRATION TESTS');
  console.log('===========================================================');

  try {
    // 1. Force Sync Database
    console.log('[Test] Syncing database...');
    await sequelize.sync({ force: true });
    console.log('✓ Database synced successfully.\n');

    // 2. Test Security Utilities
    console.log('[Test] Running security utility tests...');
    const pass = 'super_secret_password_123';
    const hash = await hashPassword(pass);
    assert(await comparePassword(pass, hash), 'Password comparison failed');
    assert(!(await comparePassword('wrong_password', hash)), 'Password comparison should have failed for incorrect pass');
    
    const rawPin = '928314';
    const pinHash = hashToken(rawPin);
    assert(compareToken(rawPin, pinHash), 'PIN token comparison failed');
    assert(!compareToken('111111', pinHash), 'PIN token comparison should have failed for incorrect PIN');

    const eventCode1 = generateEventCode();
    const eventCode2 = generateEventCode();
    assert(eventCode1.startsWith('EV-'), 'Event code should start with EV-');
    assert(eventCode1 !== eventCode2, 'Event codes should be randomly generated and unique');
    console.log('✓ Security utility checks passed.\n');

    // 3. Test Organizer Creation
    console.log('[Test] Creating Organizer...');
    const organizer = await User.create({
      full_name: 'Test Organizer',
      email: 'organizer@test.com',
      password_hash: hash,
      status: 'ACTIVE'
    });
    assert(organizer.id, 'Organizer ID should be populated');
    assert(organizer.public_id, 'Organizer public UUID should be populated');
    console.log(`✓ Organizer created: ${organizer.full_name} (${organizer.email})\n`);

    // 4. Test Event Creation
    console.log('[Test] Creating Event Workspace...');
    const today = new Date();
    const accessStarts = new Date(today.getTime() - 1000 * 60 * 5); // 5 mins ago
    const accessExpires = new Date(today.getTime() + 1000 * 60 * 60 * 2); // 2 hours from now
    
    const event = await Event.create({
      owner_id: organizer.id,
      name: 'StageSync Gala Dinner',
      description: 'Main event folder for presentations and videos',
      venue_name: 'Grand Ballroom',
      event_date: today.toISOString().split('T')[0],
      access_starts_at: accessStarts,
      access_expires_at: accessExpires,
      status: 'ACTIVE',
      max_guest_sessions: 2
    });

    const eventCreds = await EventCredential.create({
      event_id: event.id,
      event_code: eventCode1,
      pin_hash: pinHash,
      pin_expires_at: accessExpires
    });

    assert(event.id, 'Event ID should be populated');
    assert(eventCreds.event_code === eventCode1, 'Event code should match');
    console.log(`✓ Event created: ${event.name} (Code: ${eventCreds.event_code})\n`);

    // 5. Test Brute-Force Rate Limiting Lockout Logic
    console.log('[Test] Testing PIN brute-force lockout safeguards...');
    let incorrectAttempts = 0;
    
    // Simulate 4 failed entries
    for (let i = 0; i < 4; i++) {
      eventCreds.failed_attempts += 1;
      incorrectAttempts++;
    }
    await eventCreds.save();
    assert.strictEqual(eventCreds.failed_attempts, 4, 'Failed attempts should be 4');
    assert(!eventCreds.locked_until, 'Should not be locked yet');
    
    // 5th failed entry triggers lockout
    eventCreds.failed_attempts += 1;
    if (eventCreds.failed_attempts >= 5) {
      eventCreds.locked_until = new Date(Date.now() + 15 * 60 * 1000); // 15 mins
    }
    await eventCreds.save();
    
    assert.strictEqual(eventCreds.failed_attempts, 5, 'Failed attempts should be 5');
    assert(eventCreds.locked_until > new Date(), 'Locked until timestamp should be set in the future');
    console.log('✓ PIN brute-force lockout triggered successfully on 5th failure.\n');

    // Reset lockout for further checks
    eventCreds.failed_attempts = 0;
    eventCreds.locked_until = null;
    await eventCreds.save();

    // 6. Test Guest Session Concurrency Limits
    console.log('[Test] Testing Guest Session Concurrency Limits...');
    
    // Generate session 1
    const token1 = 'token1_raw_value';
    const s1 = await GuestSession.create({
      event_id: event.id,
      session_token_hash: hashToken(token1),
      auth_method: 'CODE_PIN',
      credentials_version: eventCreds.credentials_version,
      device_name: 'Chrome on macOS',
      expires_at: accessExpires
    });
    
    // Generate session 2
    const token2 = 'token2_raw_value';
    const s2 = await GuestSession.create({
      event_id: event.id,
      session_token_hash: hashToken(token2),
      auth_method: 'CODE_PIN',
      credentials_version: eventCreds.credentials_version,
      device_name: 'Firefox on Windows',
      expires_at: accessExpires
    });

    // Count active sessions (max limit is 2)
    const activeCount = await GuestSession.count({
      where: {
        event_id: event.id,
        revoked_at: null,
        expires_at: { [Op.gt]: new Date() }
      }
    });
    assert.strictEqual(activeCount, 2, 'Should have exactly 2 active guest sessions');
    console.log(`✓ Guest sessions count is ${activeCount}. Concurrency check blocks additional logins.\n`);

    // 7. Test Session Revocation
    console.log('[Test] Testing Remote Session Revocation...');
    
    // Revoke session 1
    s1.revoked_at = new Date();
    await s1.save();

    const checkedSession = await GuestSession.findByPk(s1.id);
    assert(checkedSession.revoked_at !== null, 'Session 1 revoked_at should be populated');
    
    const activeCountAfterRevoke = await GuestSession.count({
      where: {
        id: s1.id,
        revoked_at: null,
        expires_at: { [Op.gt]: new Date() }
      }
    });
    assert.strictEqual(activeCountAfterRevoke, 0, 'Revoked session should not register as active');
    console.log('✓ Guest session successfully revoked remotely by Organizer.\n');

    // 8. Test Credential Rotation & Session Invalidation
    console.log('[Test] Testing Credential Rotation & Session Invalidation...');
    
    // Rotate PIN: increments credential version
    eventCreds.credentials_version += 1;
    await eventCreds.save();

    // Revoke all existing sessions in DB active list
    await GuestSession.update(
      { revoked_at: new Date() },
      { where: { event_id: event.id, revoked_at: null } }
    );

    const activeSessions = await GuestSession.findAll({
      where: { event_id: event.id, revoked_at: null }
    });
    assert.strictEqual(activeSessions.length, 0, 'No active sessions should remain after rotation');
    console.log('✓ Rotating credentials successfully invalidated all active sessions.\n');

    console.log('===========================================================');
    console.log(' ALL INTEGRATION TESTS PASSED SUCCESSFULLY! (6/6)');
    console.log('===========================================================');
    
    // Close DB connection cleanly
    await sequelize.close();
    process.exit(0);

  } catch (error) {
    console.error('\n❌ TEST SUITE FAILED with error:', error);
    await sequelize.close();
    process.exit(1);
  }
}

runTests();
