const TicketPrice = require('../models/TicketPrice');
const BusSeat = require('../models/BusSeat');
const Trip = require('../models/Trip');

const normalizeSeatType = (value) => String(value || 'STANDARD').trim().toUpperCase();

const getFinalPrice = (ticketPrice) => Number(ticketPrice.price) - Number(ticketPrice.discount || 0);

const getTripDepartureDateTime = (departureDate, departureMinutes = 0) => {
    const value = new Date(departureDate);
    value.setUTCHours(Math.floor(departureMinutes / 60), departureMinutes % 60, 0, 0);
    return value;
};

const findEffectiveTicketPrice = (ticketPrices, seatType, departureDate) => {
    const normalizedSeatType = normalizeSeatType(seatType);
    const departure = new Date(departureDate).getTime();

    return ticketPrices.find((ticketPrice) => {
        if (!ticketPrice.isActive || normalizeSeatType(ticketPrice.seatType) !== normalizedSeatType) {
            return false;
        }

        const startsAt = new Date(ticketPrice.effectiveFrom).getTime();
        const endsAt = ticketPrice.effectiveTo
            ? new Date(ticketPrice.effectiveTo).getTime()
            : Number.POSITIVE_INFINITY;
        return startsAt <= departure && departure <= endsAt;
    }) || null;
};

const resolveSeatPrice = ({ ticketPrices, seatType, departureDate, basePrice, priceModifier = 0 }) => {
    const effectivePrice = findEffectiveTicketPrice(ticketPrices, seatType, departureDate);
    const configuredPrice = effectivePrice ? getFinalPrice(effectivePrice) : Number(basePrice);
    return Math.max(configuredPrice + Number(priceModifier || 0), 0);
};

const getBusSeatMap = async (busId, session = null) => {
    let query = BusSeat.find({ busId, isActive: true }).sort({ floor: 1, row: 1, column: 1 });
    if (session) query = query.session(session);
    const busSeats = await query.lean();
    return new Map(busSeats.map((seat) => [seat.seatCode, seat]));
};

const repriceFutureAvailableSeats = async (schedule, session = null) => {
    let priceQuery = TicketPrice.find({
        scheduleId: schedule._id,
        partnerId: schedule.partnerId,
        isActive: true
    }).sort({ effectiveFrom: -1 });
    let tripQuery = Trip.find({
        scheduleId: schedule._id,
        partnerId: schedule.partnerId,
        departureDate: { $gte: new Date() },
        status: 'OPEN'
    });
    if (session) {
        priceQuery = priceQuery.session(session);
        tripQuery = tripQuery.session(session);
    }

    // A MongoDB transaction must not run concurrent operations on one session.
    const ticketPrices = await priceQuery.lean();
    const trips = await tripQuery;
    const busSeatMap = await getBusSeatMap(schedule.busId, session);

    let updatedTrips = 0;
    let updatedSeats = 0;
    for (const trip of trips) {
        let changed = false;
        for (const seat of trip.seats) {
            if (seat.status !== 'AVAILABLE') continue;

            const busSeat = busSeatMap.get(seat.seatCode);
            const seatType = busSeat?.seatType || seat.seatType || 'STANDARD';
            const price = trip.priceOverride !== null && trip.priceOverride !== undefined
                ? Number(trip.priceOverride)
                : resolveSeatPrice({
                    ticketPrices,
                    seatType,
                    departureDate: getTripDepartureDateTime(trip.departureDate, trip.actualDepartureTime),
                    basePrice: schedule.basePrice,
                    priceModifier: busSeat?.priceModifier || 0
                });

            if (seat.seatType !== seatType || seat.price !== price) {
                seat.seatType = seatType;
                seat.price = price;
                changed = true;
                updatedSeats += 1;
            }
        }
        if (changed) {
            await trip.save(session ? { session } : {});
            updatedTrips += 1;
        }
    }

    return { updatedTrips, updatedSeats };
};

module.exports = {
    normalizeSeatType,
    getTripDepartureDateTime,
    findEffectiveTicketPrice,
    resolveSeatPrice,
    repriceFutureAvailableSeats
};
