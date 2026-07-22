const test = require('node:test');
const assert = require('node:assert/strict');
const {
    findEffectiveTicketPrice,
    getTripDepartureDateTime,
    normalizeSeatType,
    resolveSeatPrice
} = require('../src/services/ticketPricingResolver.service');

const prices = [{
    seatType: 'SLEEPER',
    price: 300000,
    discount: 50000,
    effectiveFrom: new Date('2026-07-01T00:00:00.000Z'),
    effectiveTo: new Date('2026-07-31T23:59:59.999Z'),
    isActive: true
}];

test('normalizes seat types for stable matching', () => {
    assert.equal(normalizeSeatType(' sleeper '), 'SLEEPER');
    assert.equal(normalizeSeatType(), 'STANDARD');
});

test('combines a trip date with its scheduled UTC departure minutes', () => {
    assert.equal(
        getTripDepartureDateTime(new Date('2026-07-20T00:00:00.000Z'), 20 * 60 + 30).toISOString(),
        '2026-07-20T20:30:00.000Z'
    );
});

test('resolves the discounted effective price and bus-seat modifier', () => {
    assert.equal(resolveSeatPrice({
        ticketPrices: prices,
        seatType: 'sleeper',
        departureDate: new Date('2026-07-20T00:00:00.000Z'),
        basePrice: 200000,
        priceModifier: 10000
    }), 260000);
});

test('falls back to schedule base price outside the effective period', () => {
    assert.equal(resolveSeatPrice({
        ticketPrices: prices,
        seatType: 'SLEEPER',
        departureDate: new Date('2026-08-01T00:00:00.000Z'),
        basePrice: 200000,
        priceModifier: 10000
    }), 210000);
});

test('ignores inactive prices and treats effective bounds as inclusive', () => {
    assert.equal(findEffectiveTicketPrice(prices, 'SLEEPER', prices[0].effectiveFrom), prices[0]);
    assert.equal(findEffectiveTicketPrice([{ ...prices[0], isActive: false }], 'SLEEPER', prices[0].effectiveFrom), null);
});
