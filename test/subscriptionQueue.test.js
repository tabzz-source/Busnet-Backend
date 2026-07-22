const test = require('node:test');
const assert = require('node:assert/strict');
const { calculateQueuedPeriod } = require('../src/services/partnerSubscription.service');

test('queues a purchased plan after the current subscription expires', () => {
    const period = calculateQueuedPeriod({
        now: '2026-07-21T00:00:00.000Z',
        currentExpiration: '2026-08-01T00:00:00.000Z',
        durationDays: 30
    });
    assert.equal(period.scheduledStartDate.toISOString(), '2026-08-01T00:00:00.000Z');
    assert.equal(period.scheduledExpirationDate.toISOString(), '2026-08-31T00:00:00.000Z');
});

test('places another purchase after the last queued subscription', () => {
    const period = calculateQueuedPeriod({
        now: '2026-07-21T00:00:00.000Z',
        currentExpiration: '2026-08-01T00:00:00.000Z',
        lastQueuedExpiration: '2026-09-01T00:00:00.000Z',
        durationDays: 15
    });
    assert.equal(period.scheduledStartDate.toISOString(), '2026-09-01T00:00:00.000Z');
    assert.equal(period.scheduledExpirationDate.toISOString(), '2026-09-16T00:00:00.000Z');
});

test('starts immediately when the current subscription has expired', () => {
    const period = calculateQueuedPeriod({
        now: '2026-07-21T00:00:00.000Z',
        currentExpiration: null,
        durationDays: 7
    });
    assert.equal(period.scheduledStartDate.toISOString(), '2026-07-21T00:00:00.000Z');
    assert.equal(period.scheduledExpirationDate.toISOString(), '2026-07-28T00:00:00.000Z');
});
