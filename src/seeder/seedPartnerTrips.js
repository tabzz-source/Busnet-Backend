const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Account = require('../models/Account');
const PartnerInformation = require('../models/PartnerInformation');
const Bus = require('../models/Bus');
const Route = require('../models/Route');
const Schedule = require('../models/Schedule');
const TicketPrice = require('../models/TicketPrice');
const SchedulePickupPoint = require('../models/SchedulePickupPoint');
const ScheduleDropoffPoint = require('../models/ScheduleDropoffPoint');
const Trip = require('../models/Trip');

dotenv.config();

const PARTNER_ID = '6a41f364712c182acbcf21c7';

async function seed() {
  try {
    await mongoose.connect(process.env.MONGO_URI || 'mongodb://127.0.0.1:27017/busnet');
    console.log('✅ Connected to MongoDB successfully.');

    // 1. Check partner exists
    const partner = await Account.findById(PARTNER_ID);
    if (!partner || partner.role !== 'PARTNER') {
      console.error(`❌ Account with ID ${PARTNER_ID} does not exist or is not a partner.`);
      process.exit(1);
    }
    console.log(`👤 Found partner account: ${partner.fullName} (${partner.email})`);

    // 2. Clean old data for this partner
    console.log('ℹ Cleaning old trips data for this partner...');
    await Trip.deleteMany({ partnerId: PARTNER_ID });
    await SchedulePickupPoint.deleteMany({ scheduleId: { $in: await Schedule.find({ partnerId: PARTNER_ID }).select('_id') } });
    await ScheduleDropoffPoint.deleteMany({ scheduleId: { $in: await Schedule.find({ partnerId: PARTNER_ID }).select('_id') } });
    await TicketPrice.deleteMany({ partnerId: PARTNER_ID });
    await Schedule.deleteMany({ partnerId: PARTNER_ID });
    await Route.deleteMany({ partnerId: PARTNER_ID });
    await Bus.deleteMany({ partnerId: PARTNER_ID });
    console.log('✅ Cleaned old partner trips data.');

    // 3. Create Buses
    console.log('ℹ Seeding Buses...');
    const buses = await Bus.create([
      {
        partnerId: PARTNER_ID,
        busName: 'Limousine VIP 18',
        licensePlate: '65A-22233',
        busType: 'Limousine',
        totalSeats: 18,
        description: 'Luxury Limousine with 18 reclining massage seats and private cabin space.',
        amenities: ['WiFi', 'Air Conditioning', 'USB Charging Port', 'Water Bottle', 'Wet Wipes'],
        status: 'ACTIVE',
        isActive: true,
        seatLayout_totalFloors: 1,
        seatLayout_totalRows: 6,
        seatLayout_totalColumns: 3
      },
      {
        partnerId: PARTNER_ID,
        busName: 'Luxury Sleeper 36',
        licensePlate: '65B-44455',
        busType: 'Sleeper',
        totalSeats: 36,
        description: 'Double-decker premium sleeper bus with full flat private beds.',
        amenities: ['WiFi', 'Air Conditioning', 'USB Charging Port', 'Water Bottle', 'Wet Wipes', 'Blanket & Pillow'],
        status: 'ACTIVE',
        isActive: true,
        seatLayout_totalFloors: 2,
        seatLayout_totalRows: 6,
        seatLayout_totalColumns: 3
      }
    ]);
    console.log(`✅ Created ${buses.length} buses.`);

    // 4. Create Routes
    console.log('ℹ Seeding Routes...');
    const routes = await Route.create([
      {
        partnerId: PARTNER_ID,
        routeName: 'Cần Thơ - TP.HCM',
        origin_province: '92',
        origin_provinceName: 'Cần Thơ',
        origin_district: '916',
        origin_districtName: 'Ninh Kiều',
        origin_representativeAddress: 'Bến xe trung tâm Cần Thơ, Ninh Kiều, Cần Thơ',
        origin_representativeLat: 10.0341,
        origin_representativeLng: 105.7680,
        destination_province: '79',
        destination_provinceName: 'TP. Hồ Chí Minh',
        destination_district: '760',
        destination_districtName: 'Bình Tân',
        destination_representativeAddress: 'Bến xe Miền Tây, Bình Tân, TP.HCM',
        destination_representativeLat: 10.7415,
        destination_representativeLng: 106.6180,
        distanceKm: 170,
        estimatedDuration: 210,
        isActive: true,
        isPopular: true
      },
      {
        partnerId: PARTNER_ID,
        routeName: 'Cần Thơ - Đà Lạt',
        origin_province: '92',
        origin_provinceName: 'Cần Thơ',
        origin_district: '916',
        origin_districtName: 'Ninh Kiều',
        origin_representativeAddress: 'Bến xe trung tâm Cần Thơ, Ninh Kiều, Cần Thơ',
        origin_representativeLat: 10.0341,
        origin_representativeLng: 105.7680,
        destination_province: '68',
        destination_provinceName: 'Lâm Đồng',
        destination_district: '672',
        destination_districtName: 'Đà Lạt',
        destination_representativeAddress: 'Bến xe Đà Lạt, Tô Hiến Thành, Đà Lạt',
        destination_representativeLat: 11.9404,
        destination_representativeLng: 108.4583,
        distanceKm: 310,
        estimatedDuration: 420,
        isActive: true,
        isPopular: true
      }
    ]);
    console.log(`✅ Created ${routes.length} routes.`);

    // 5. Create Schedules
    console.log('ℹ Seeding Schedules...');
    const schedules = await Schedule.create([
      {
        routeId: routes[0]._id,
        busId: buses[0]._id, // Limousine
        partnerId: PARTNER_ID,
        scheduleCode: 'SCH-TEST1-01',
        basePrice: 10000,
        departureTime: '08:00',
        arrivalTime: '11:30',
        recurrenceType: 'DAILY',
        recurrenceRule: {
          frequency: 'DAILY',
          interval: 1,
          startDate: new Date('2026-01-01')
        },
        isActive: true
      },
      {
        routeId: routes[0]._id,
        busId: buses[1]._id, // Sleeper
        partnerId: PARTNER_ID,
        scheduleCode: 'SCH-TEST1-02',
        basePrice: 10000,
        departureTime: '13:00',
        arrivalTime: '16:30',
        recurrenceType: 'DAILY',
        recurrenceRule: {
          frequency: 'DAILY',
          interval: 1,
          startDate: new Date('2026-01-01')
        },
        isActive: true
      },
      {
        routeId: routes[1]._id,
        busId: buses[1]._id, // Sleeper
        partnerId: PARTNER_ID,
        scheduleCode: 'SCH-TEST1-03',
        basePrice: 15000,
        departureTime: '20:00',
        arrivalTime: '03:00',
        recurrenceType: 'DAILY',
        recurrenceRule: {
          frequency: 'DAILY',
          interval: 1,
          startDate: new Date('2026-01-01')
        },
        isActive: true
      }
    ]);
    console.log(`✅ Created ${schedules.length} schedules.`);

    // 6. Ticket prices, pickup/dropoff points for each schedule
    console.log('ℹ Seeding ticket prices, pickup & dropoff points...');
    for (const schedule of schedules) {
      // Ticket price
      await TicketPrice.create({
        scheduleId: schedule._id,
        partnerId: PARTNER_ID,
        seatType: 'Standard',
        price: schedule.basePrice,
        effectiveFrom: new Date('2026-01-01'),
        isActive: true
      });

      // Pickup point
      await SchedulePickupPoint.create({
        scheduleId: schedule._id,
        name: 'Bến xe trung tâm Cần Thơ',
        address: 'Bến xe trung tâm Cần Thơ, Ninh Kiều, Cần Thơ',
        province: '92',
        provinceName: 'Cần Thơ',
        district: '916',
        districtName: 'Ninh Kiều',
        time: schedule.departureTime,
        lat: 10.0341,
        lng: 105.7680,
        orderIndex: 0
      });

      // Dropoff point
      const isRoute1 = String(schedule.routeId) === String(routes[0]._id);
      await ScheduleDropoffPoint.create({
        scheduleId: schedule._id,
        name: isRoute1 ? 'Bến xe Miền Tây' : 'Bến xe Đà Lạt',
        address: isRoute1 ? 'Bến xe Miền Tây, Bình Tân, TP.HCM' : 'Bến xe Đà Lạt, Tô Hiến Thành, Đà Lạt',
        province: isRoute1 ? '79' : '68',
        provinceName: isRoute1 ? 'TP. Hồ Chí Minh' : 'Lâm Đồng',
        district: isRoute1 ? '760' : '672',
        districtName: isRoute1 ? 'Bình Tân' : 'Đà Lạt',
        time: schedule.arrivalTime,
        lat: isRoute1 ? 10.7415 : 11.9404,
        lng: isRoute1 ? 106.6180 : 108.4583,
        orderIndex: 0
      });
    }
    console.log('✅ Created prices and pickup/dropoff points.');

    // 7. Pre-generate Trips for the next 7 days
    console.log('ℹ Pre-generating Trips for the next 7 days (today + 6 days)...');
    const today = new Date();
    const tripsToCreate = [];

    for (let d = 0; d < 7; d++) {
      const date = new Date(today);
      date.setDate(today.getDate() + d);
      
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const dayStr = String(date.getDate()).padStart(2, '0');
      const targetDateStr = `${year}-${month}-${dayStr}`;
      
      const startOfDay = new Date(targetDateStr);
      startOfDay.setHours(0, 0, 0, 0);

      for (const schedule of schedules) {
        const bus = buses.find(b => String(b._id) === String(schedule.busId));
        const floors = bus.seatLayout_totalFloors || 1;
        const rows = bus.seatLayout_totalRows || 5;
        const cols = bus.seatLayout_totalColumns || 4;
        
        const seats = [];
        for (let f = 1; f <= floors; f++) {
          const floorPrefix = floors > 1 ? (f === 1 ? 'A' : 'B') : 'A';
          for (let r = 1; r <= rows; r++) {
            for (let c = 1; c <= cols; c++) {
              const colLetter = String.fromCharCode(65 + c - 1);
              const seatCode = `${floorPrefix}${r}${colLetter}`;
              seats.push({
                seatCode,
                price: schedule.basePrice,
                status: 'AVAILABLE'
              });
            }
          }
        }

        const timeToMinutes = (timeStr) => {
          const [hours, minutes] = timeStr.split(':').map(Number);
          return hours * 60 + minutes;
        };

        const depMinutes = timeToMinutes(schedule.departureTime);
        const arrMinutes = timeToMinutes(schedule.arrivalTime);
        const tripCode = `TRIP-${schedule.scheduleCode}-${targetDateStr.replace(/-/g, '')}`;

        tripsToCreate.push({
          scheduleId: schedule._id,
          partnerId: PARTNER_ID,
          routeId: schedule.routeId,
          busId: bus._id,
          tripCode,
          departureDate: startOfDay,
          actualDepartureTime: depMinutes,
          actualArrivalTime: arrMinutes,
          totalSeats: seats.length,
          availableSeats: seats.length,
          seats,
          status: 'OPEN'
        });
      }
    }

    if (tripsToCreate.length > 0) {
      await Trip.insertMany(tripsToCreate);
    }
    console.log(`✅ Pre-generated ${tripsToCreate.length} trips successfully.`);

    console.log('\n🎉 Seeding completed successfully!');
    await mongoose.disconnect();
    process.exit(0);
  } catch (error) {
    console.error('❌ Seeding failed:', error);
    await mongoose.disconnect();
    process.exit(1);
  }
}

seed();
