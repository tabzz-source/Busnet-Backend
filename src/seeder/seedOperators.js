const mongoose = require('mongoose');
const dotenv = require('dotenv');
const bcrypt = require('bcryptjs');
const Account = require('../models/Account');
const PartnerInformation = require('../models/PartnerInformation');
const Route = require('../models/Route');
const Schedule = require('../models/Schedule');
const Bus = require('../models/Bus');
const TicketPrice = require('../models/TicketPrice');
const SchedulePickupPoint = require('../models/SchedulePickupPoint');
const ScheduleDropoffPoint = require('../models/ScheduleDropoffPoint');

dotenv.config();

const OPERATORS = [
    {
        account: {
            username: 'hoanglong_express',
            email: 'contact@hoanglongexpress.vn',
            phone: '0901234567',
            fullName: 'Hoàng Long Express',
            role: 'PARTNER',
            status: 'ACTIVE',
            isEmailVerified: true
        },
        partner: {
            operatorName: 'Hoàng Long Express',
            operatorPhone: '0901234567',
            description: 'One of the leading intercity bus operators in Vietnam, serving major routes across the country with premium sleeper buses and excellent customer service since 2002.',
            amenities: ['WiFi', 'Air Conditioning', 'USB Charging', 'Blanket & Pillow', 'Water Bottle', 'Reclining Seats'],
            policies: {
                cancellation: 'Free cancellation up to 24 hours before departure',
                luggage: 'Up to 20kg free luggage, additional 5,000đ/kg',
                pets: 'No pets allowed'
            },
            ratingAvg: 4.5,
            totalReviews: 328,
            isVerified: true,
            verifiedAt: new Date('2024-06-01')
        },
        buses: [
            {
                busName: 'Limousine VIP 22',
                licensePlate: '29B-12345',
                busType: 'Limousine',
                totalSeats: 22,
                description: 'Premium limousine with wide reclining seats',
                amenities: ['WiFi', 'USB Charging', 'LED Screen', 'Curtains'],
                seatLayout_totalRows: 11,
                seatLayout_totalColumns: 2,
                seatLayout_totalFloors: 1
            },
            {
                busName: 'Sleeper 40',
                licensePlate: '29B-67890',
                busType: 'Sleeper',
                totalSeats: 40,
                description: 'Double-decker sleeper bus with full flat beds',
                amenities: ['WiFi', 'Air Conditioning', 'Blanket'],
                seatLayout_totalRows: 10,
                seatLayout_totalColumns: 2,
                seatLayout_totalFloors: 2
            }
        ],
        routes: [
            {
                routeName: 'Hà Nội - Hải Phòng',
                origin_province: '01', origin_provinceName: 'Hà Nội',
                origin_district: '001', origin_districtName: 'Hoàn Kiếm',
                origin_representativeAddress: 'Bến xe Giáp Bát, Giải Phóng, Hoàng Mai',
                origin_representativeLat: 20.9806, origin_representativeLng: 105.8412,
                destination_province: '31', destination_provinceName: 'Hải Phòng',
                destination_district: '303', destination_districtName: 'Hồng Bàng',
                destination_representativeAddress: 'Bến xe Niệm Nghĩa, Lê Lợi, Hải Phòng',
                destination_representativeLat: 20.8449, destination_representativeLng: 106.6881,
                distanceKm: 120, estimatedDuration: 150, isActive: true, isPopular: true
            },
            {
                routeName: 'Hà Nội - Quảng Ninh',
                origin_province: '01', origin_provinceName: 'Hà Nội',
                origin_district: '001', origin_districtName: 'Hoàn Kiếm',
                origin_representativeAddress: 'Bến xe Mỹ Đình, Nam Từ Liêm',
                origin_representativeLat: 21.0285, origin_representativeLng: 105.7654,
                destination_province: '22', destination_provinceName: 'Quảng Ninh',
                destination_district: '205', destination_districtName: 'Hạ Long',
                destination_representativeAddress: 'Bến xe Bãi Cháy, Hạ Long',
                destination_representativeLat: 20.9511, destination_representativeLng: 107.0730,
                distanceKm: 170, estimatedDuration: 210, isActive: true, isPopular: false
            }
        ]
    },
    {
        account: {
            username: 'phuongtrang_futa',
            email: 'info@futabus.vn',
            phone: '0912345678',
            fullName: 'Phương Trang FUTA',
            role: 'PARTNER',
            status: 'ACTIVE',
            isEmailVerified: true
        },
        partner: {
            operatorName: 'Phương Trang FUTA Bus Lines',
            operatorPhone: '0912345678',
            description: 'Vietnam\'s largest bus operator network with over 1,000 vehicles connecting all 63 provinces. Known for affordable pricing, punctual schedules, and extensive route coverage.',
            amenities: ['WiFi', 'Air Conditioning', 'USB Charging', 'Blanket & Pillow', 'Water Bottle', 'Snacks'],
            policies: {
                cancellation: 'Free cancellation up to 12 hours before departure',
                luggage: 'Up to 30kg free luggage',
                pets: 'Small pets in carriers only (under 5kg)'
            },
            ratingAvg: 4.3,
            totalReviews: 1245,
            isVerified: true,
            verifiedAt: new Date('2024-03-15')
        },
        buses: [
            {
                busName: 'Giường nằm 44',
                licensePlate: '51B-11111',
                busType: 'Sleeper',
                totalSeats: 44,
                description: 'Standard sleeper bus with comfortable beds',
                amenities: ['WiFi', 'Air Conditioning', 'USB Charging'],
                seatLayout_totalRows: 11,
                seatLayout_totalColumns: 2,
                seatLayout_totalFloors: 2
            },
            {
                busName: 'Ghế ngồi 45',
                licensePlate: '51B-22222',
                busType: 'Seater',
                totalSeats: 45,
                description: 'Standard seater bus for short routes',
                amenities: ['Air Conditioning'],
                seatLayout_totalRows: 15,
                seatLayout_totalColumns: 3,
                seatLayout_totalFloors: 1
            }
        ],
        routes: [
            {
                routeName: 'TP.HCM - Đà Lạt',
                origin_province: '79', origin_provinceName: 'TP. Hồ Chí Minh',
                origin_district: '760', origin_districtName: 'Quận 1',
                origin_representativeAddress: 'Bến xe Miền Đông, Bình Thạnh',
                origin_representativeLat: 10.8145, origin_representativeLng: 106.7113,
                destination_province: '68', destination_provinceName: 'Lâm Đồng',
                destination_district: '672', destination_districtName: 'Đà Lạt',
                destination_representativeAddress: 'Bến xe Đà Lạt, Tô Hiến Thành',
                destination_representativeLat: 11.9404, destination_representativeLng: 108.4583,
                distanceKm: 310, estimatedDuration: 420, isActive: true, isPopular: true
            },
            {
                routeName: 'TP.HCM - Nha Trang',
                origin_province: '79', origin_provinceName: 'TP. Hồ Chí Minh',
                origin_district: '760', origin_districtName: 'Quận 1',
                origin_representativeAddress: 'Bến xe Miền Đông, Bình Thạnh',
                origin_representativeLat: 10.8145, origin_representativeLng: 106.7113,
                destination_province: '56', destination_provinceName: 'Khánh Hòa',
                destination_district: '568', destination_districtName: 'Nha Trang',
                destination_representativeAddress: 'Bến xe phía Nam Nha Trang',
                destination_representativeLat: 12.2388, destination_representativeLng: 109.1967,
                distanceKm: 430, estimatedDuration: 540, isActive: true, isPopular: true
            },
            {
                routeName: 'TP.HCM - Cần Thơ',
                origin_province: '79', origin_provinceName: 'TP. Hồ Chí Minh',
                origin_district: '760', origin_districtName: 'Quận 1',
                origin_representativeAddress: 'Bến xe Miền Tây, Bình Tân',
                origin_representativeLat: 10.7415, origin_representativeLng: 106.6180,
                destination_province: '92', destination_provinceName: 'Cần Thơ',
                destination_district: '916', destination_districtName: 'Ninh Kiều',
                destination_representativeAddress: 'Bến xe 91B Cần Thơ',
                destination_representativeLat: 10.0341, destination_representativeLng: 105.7680,
                distanceKm: 170, estimatedDuration: 210, isActive: true, isPopular: false
            }
        ]
    },
    {
        account: {
            username: 'thanhbuoi_transport',
            email: 'booking@thanhbuoi.vn',
            phone: '0923456789',
            fullName: 'Thành Bưởi Transport',
            role: 'PARTNER',
            status: 'ACTIVE',
            isEmailVerified: true
        },
        partner: {
            operatorName: 'Thành Bưởi',
            operatorPhone: '0923456789',
            description: 'Premium overnight bus service specializing in Southern Vietnam routes. Famous for spacious sleeper cabins, on-time departure, and exceptional comfort on long-distance journeys.',
            amenities: ['WiFi', 'Air Conditioning', 'USB Charging', 'Blanket & Pillow', 'Personal TV', 'Snacks & Drinks'],
            policies: {
                cancellation: 'Free cancellation up to 6 hours before departure',
                luggage: 'Up to 25kg free luggage',
                pets: 'No pets allowed'
            },
            ratingAvg: 4.7,
            totalReviews: 892,
            isVerified: true,
            verifiedAt: new Date('2024-01-20')
        },
        buses: [
            {
                busName: 'Royal Cabin 20',
                licensePlate: '51B-33333',
                busType: 'Cabin',
                totalSeats: 20,
                description: 'Private cabin sleeper with door, personal TV, and USB',
                amenities: ['WiFi', 'Personal TV', 'USB Charging', 'Private Curtain', 'Blanket'],
                seatLayout_totalRows: 10,
                seatLayout_totalColumns: 2,
                seatLayout_totalFloors: 1
            }
        ],
        routes: [
            {
                routeName: 'TP.HCM - Đà Nẵng',
                origin_province: '79', origin_provinceName: 'TP. Hồ Chí Minh',
                origin_district: '760', origin_districtName: 'Quận 1',
                origin_representativeAddress: '266 Lê Hồng Phong, Quận 10',
                origin_representativeLat: 10.7703, origin_representativeLng: 106.6685,
                destination_province: '48', destination_provinceName: 'Đà Nẵng',
                destination_district: '490', destination_districtName: 'Hải Châu',
                destination_representativeAddress: 'Bến xe Đà Nẵng, Tôn Đức Thắng',
                destination_representativeLat: 16.0678, destination_representativeLng: 108.2208,
                distanceKm: 960, estimatedDuration: 960, isActive: true, isPopular: true
            },
            {
                routeName: 'TP.HCM - Bình Định',
                origin_province: '79', origin_provinceName: 'TP. Hồ Chí Minh',
                origin_district: '760', origin_districtName: 'Quận 1',
                origin_representativeAddress: '266 Lê Hồng Phong, Quận 10',
                origin_representativeLat: 10.7703, origin_representativeLng: 106.6685,
                destination_province: '52', destination_provinceName: 'Bình Định',
                destination_district: '540', destination_districtName: 'Quy Nhơn',
                destination_representativeAddress: 'Bến xe Quy Nhơn',
                destination_representativeLat: 13.7765, destination_representativeLng: 109.2237,
                distanceKm: 650, estimatedDuration: 720, isActive: true, isPopular: false
            }
        ]
    }
];

const seedOperators = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ MongoDB connected');

        const passwordHash = await bcrypt.hash('Partner@123', 10);

        for (const opData of OPERATORS) {
            // 1. Create Account (upsert by email or phone)
            let account = await Account.findOne({
                $or: [
                    { email: opData.account.email },
                    { phone: opData.account.phone },
                    { username: opData.account.username }
                ]
            });
            if (!account) {
                account = await Account.create({
                    ...opData.account,
                    passwordHash
                });
                console.log(`  ✅ Account created: ${account.email}`);
            } else {
                console.log(`  ⏭️  Account exists: ${account.email || account.phone}`);
            }

            // 2. Create PartnerInformation (upsert by accountId)
            let partner = await PartnerInformation.findOne({ accountId: account._id });
            if (!partner) {
                partner = await PartnerInformation.create({
                    ...opData.partner,
                    accountId: account._id
                });
                console.log(`  ✅ Partner info created: ${partner.operatorName}`);
            } else {
                console.log(`  ⏭️  Partner info exists: ${partner.operatorName}`);
            }

            // 3. Create Buses
            const busIds = [];
            for (const busData of opData.buses) {
                let bus = await Bus.findOne({ licensePlate: busData.licensePlate });
                if (!bus) {
                    bus = await Bus.create({
                        ...busData,
                        partnerId: account._id
                    });
                    console.log(`    ✅ Bus created: ${bus.busName} (${bus.licensePlate})`);
                } else {
                    console.log(`    ⏭️  Bus exists: ${bus.busName}`);
                }
                busIds.push(bus._id);
            }

            // 4. Create Routes + Schedules + TicketPrices + Pickup/Dropoff Points
            for (let rIdx = 0; rIdx < opData.routes.length; rIdx++) {
                const routeData = opData.routes[rIdx];
                let route = await Route.findOne({
                    partnerId: account._id,
                    routeName: routeData.routeName
                });
                if (!route) {
                    route = await Route.create({
                        ...routeData,
                        partnerId: account._id
                    });
                    console.log(`    ✅ Route created: ${route.routeName}`);
                } else {
                    console.log(`    ⏭️  Route exists: ${route.routeName}`);
                }

                // Create 1-2 schedules per route
                const busForSchedule = busIds[rIdx % busIds.length];
                const scheduleConfigs = [
                    { departureTime: '07:00', arrivalTime: '09:30', code: `SCH-${account._id.toString().slice(-4)}-${rIdx}-AM` },
                    { departureTime: '14:00', arrivalTime: '16:30', code: `SCH-${account._id.toString().slice(-4)}-${rIdx}-PM` }
                ];

                for (const schedConf of scheduleConfigs) {
                    let schedule = await Schedule.findOne({ scheduleCode: schedConf.code });
                    if (!schedule) {
                        // Calculate arrival time based on route duration
                        const depParts = schedConf.departureTime.split(':');
                        const depMinutes = parseInt(depParts[0]) * 60 + parseInt(depParts[1]);
                        const arrMinutes = depMinutes + routeData.estimatedDuration;
                        const arrHours = Math.floor(arrMinutes / 60) % 24;
                        const arrMins = arrMinutes % 60;
                        const calculatedArrival = `${String(arrHours).padStart(2, '0')}:${String(arrMins).padStart(2, '0')}`;

                        schedule = await Schedule.create({
                            routeId: route._id,
                            busId: busForSchedule,
                            partnerId: account._id,
                            scheduleCode: schedConf.code,
                            basePrice: routeData.distanceKm * 1000, // ~1000đ/km
                            departureTime: schedConf.departureTime,
                            arrivalTime: calculatedArrival,
                            recurrenceType: 'DAILY',
                            recurrenceRule: {
                                frequency: 'DAILY',
                                interval: 1,
                                daysOfWeek: [],
                                daysOfMonth: [],
                                startDate: new Date('2025-01-01'),
                                endDate: null,
                                count: null
                            },
                            isActive: true
                        });
                        console.log(`      ✅ Schedule created: ${schedConf.code} (${schedConf.departureTime} → ${calculatedArrival})`);

                        // Create TicketPrice
                        await TicketPrice.create({
                            scheduleId: schedule._id,
                            partnerId: account._id,
                            seatType: 'Standard',
                            price: routeData.distanceKm * 1000,
                            discount: 0,
                            effectiveFrom: new Date('2025-01-01'),
                            isActive: true
                        });
                        console.log(`        ✅ TicketPrice created: Standard`);

                        // Create Pickup Points
                        await SchedulePickupPoint.create({
                            scheduleId: schedule._id,
                            name: routeData.origin_representativeAddress.split(',')[0],
                            address: routeData.origin_representativeAddress,
                            province: routeData.origin_province,
                            provinceName: routeData.origin_provinceName,
                            district: routeData.origin_district,
                            districtName: routeData.origin_districtName,
                            time: schedConf.departureTime,
                            lat: routeData.origin_representativeLat,
                            lng: routeData.origin_representativeLng,
                            orderIndex: 0
                        });
                        console.log(`        ✅ PickupPoint created`);

                        // Create Dropoff Points
                        await ScheduleDropoffPoint.create({
                            scheduleId: schedule._id,
                            name: routeData.destination_representativeAddress.split(',')[0],
                            address: routeData.destination_representativeAddress,
                            province: routeData.destination_province,
                            provinceName: routeData.destination_provinceName,
                            district: routeData.destination_district,
                            districtName: routeData.destination_districtName,
                            time: calculatedArrival,
                            lat: routeData.destination_representativeLat,
                            lng: routeData.destination_representativeLng,
                            orderIndex: 0
                        });
                        console.log(`        ✅ DropoffPoint created`);
                    } else {
                        console.log(`      ⏭️  Schedule exists: ${schedConf.code}`);
                    }
                }
            }

            console.log(`\n🎉 Operator "${opData.partner.operatorName}" seeded successfully!\n`);
        }

        console.log('✅ All operators seeded. Disconnecting...');
        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error('❌ Seed error:', err);
        await mongoose.disconnect();
        process.exit(1);
    }
};

seedOperators();
