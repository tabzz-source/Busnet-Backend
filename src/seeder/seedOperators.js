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
const Trip = require('../models/Trip');

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
    },
    {
        account: {
            _id: new mongoose.Types.ObjectId('6a3ab14f8b18bfeb2e03e1ff'),
            username: 'baotgce181662',
            email: 'baotgce181662@fpt.edu.vn',
            phone: '0966382655',
            passwordHash: '$2b$10$jCwu3Ypt./7cRxSRkBu7i.RQpgcFV0VYrCH/MfTgTYUAqL/dNHuU6',
            role: 'PARTNER',
            status: 'ACTIVE',
            fullName: 'Tran Gia Bao',
            gender: 'UNKNOWN',
            isOAuthUser: false,
            isEmailVerified: true,
            isPhoneVerified: false,
            banCounts: 0,
            isAutoPublishBlog: false
        },
        partner: {
            _id: new mongoose.Types.ObjectId('6a3ab14f8b18bfeb2e03e200'),
            operatorName: 'Partner Test 1',
            operatorPhone: '0966382655',
            description: 'This is a test sentences',
            amenities: ['WiFi', 'Air Conditioning', 'Water Bottle', 'Reclining Seats'],
            policies: {
                cancellation: 'Free cancellation up to 24 hours before departure',
                luggage: 'Up to 20kg free luggage',
                pets: 'No pets allowed'
            },
            profilePicture: 'https://res.cloudinary.com/dfwiqomtv/image/upload/v1782230955/busnet_avatar.png',
            coverImage: 'https://res.cloudinary.com/dfwiqomtv/image/upload/v1782230956/busnet_cover.png',
            businessLicense: 'https://res.cloudinary.com/dfwiqomtv/raw/upload/v1782230999/busnet/license.pdf',
            licenseStatus: 'APPROVED',
            rejectionReason: null,
            reviewedBy: new mongoose.Types.ObjectId('6a3ab7171fd634a1e90f7a34'),
            reviewedAt: new Date('2026-06-23T16:43:15.437Z'),
            selectedPlanId: null,
            taxCode: '092204000569',
            isVerified: true,
            verifiedAt: new Date('2026-06-23T16:45:36.586Z'),
            ratingAvg: 0,
            totalReviews: 0,
            bankAccountName: 'TRAN GIA BAO',
            bankBranch: 'Can Tho'
        },
        buses: [
            {
                busName: 'VIP Limousine',
                licensePlate: '65A-99999',
                busType: 'Limousine',
                totalSeats: 22,
                description: 'Reclining luxury seats',
                amenities: ['WiFi', 'USB Charging'],
                seatLayout_totalRows: 11,
                seatLayout_totalColumns: 2,
                seatLayout_totalFloors: 1
            }
        ],
        routes: [
            {
                routeName: 'Cần Thơ - TP.HCM',
                origin_province: '92', origin_provinceName: 'Cần Thơ',
                origin_district: '916', origin_districtName: 'Ninh Kiều',
                origin_representativeAddress: 'Bến xe trung tâm Cần Thơ, Ninh Kiều, Cần Thơ',
                origin_representativeLat: 10.0341, origin_representativeLng: 105.7680,
                destination_province: '79', destination_provinceName: 'TP. Hồ Chí Minh',
                destination_district: '760', destination_districtName: 'Quận 1',
                destination_representativeAddress: 'Bến xe Miền Tây, Bình Tân, TP.HCM',
                destination_representativeLat: 10.7415, destination_representativeLng: 106.6180,
                distanceKm: 170, estimatedDuration: 210, isActive: true, isPopular: true
            }
        ]
    },
    {
        account: {
            _id: new mongoose.Types.ObjectId('6a390dd68a72f3be29364590'),
            username: 'tuanbace161158',
            email: 'tuanbace161158@fpt.edu.vn',
            phone: '0822377076',
            passwordHash: '$2b$10$ZwiD8CYyGpn6Nje4CFMGLOrL9LIGPy647.TD/IwGhqY67vfPrSDJ.',
            role: 'PARTNER',
            status: 'ACTIVE',
            fullName: 'Bui Anh Tuan',
            gender: 'UNKNOWN',
            isOAuthUser: false,
            isEmailVerified: true,
            isPhoneVerified: false,
            banCounts: 0,
            isAutoPublishBlog: false
        },
        partner: {
            _id: new mongoose.Types.ObjectId('6a390dd68a72f3be29364591'),
            operatorName: 'FPT Bus',
            operatorPhone: '0822377076',
            description: 'Test',
            amenities: ['WiFi', 'Air Conditioning', 'USB Charging'],
            profilePicture: 'https://res.cloudinary.com/dfwiqomtv/image/upload/v1782123893/busnet_b',
            coverImage: 'https://res.cloudinary.com/dfwiqomtv/image/upload/v1782123899/busnet_b',
            bankName: 'VPB',
            bankCode: 'VPB',
            bankNumber: '0822377076',
            bankAccountName: 'BUI ANH TUAN',
            bankBranch: 'ha noi',
            sepayVa: 'AGBSPN4ZYBJT7CAH',
            sepayKeyEncrypted: 'c5a8f82fdd5ce080689c015992f20944:0858927a1f32398a8f37df225273022bc2253',
            businessLicense: null,
            taxCode: '123456789',
            isVerified: true,
            verifiedAt: new Date('2026-06-22T10:26:30.938Z'),
            ratingAvg: 0,
            totalReviews: 0
        },
        buses: [
            {
                busName: 'FPT Premium Sleeper',
                licensePlate: '29F-88888',
                busType: 'Sleeper',
                totalSeats: 34,
                description: 'High-quality sleeper bus with full amenities',
                amenities: ['WiFi', 'USB Charging', 'Blanket', 'Water'],
                seatLayout_totalRows: 9,
                seatLayout_totalColumns: 2,
                seatLayout_totalFloors: 2
            },
            {
                busName: 'FPT Express Seater',
                licensePlate: '29F-99999',
                busType: 'Seater',
                totalSeats: 29,
                description: 'Comfortable seater bus for mid-range travel',
                amenities: ['WiFi', 'USB Charging', 'Water'],
                seatLayout_totalRows: 10,
                seatLayout_totalColumns: 3,
                seatLayout_totalFloors: 1
            }
        ],
        routes: [
            {
                routeName: 'Hà Nội - Cát Bà',
                origin_province: '01', origin_provinceName: 'Hà Nội',
                origin_district: '001', origin_districtName: 'Hoàn Kiếm',
                origin_representativeAddress: 'Phố Cổ Hà Nội, Hoàn Kiếm, Hà Nội',
                origin_representativeLat: 21.0333, origin_representativeLng: 105.8500,
                destination_province: '31', destination_provinceName: 'Hải Phòng',
                destination_district: '308', destination_districtName: 'Cát Hải',
                destination_representativeAddress: 'Thị trấn Cát Bà, Cát Hải, Hải Phòng',
                destination_representativeLat: 20.7200, destination_representativeLng: 107.0500,
                distanceKm: 150, estimatedDuration: 210, isActive: true, isPopular: true
            },
            {
                routeName: 'Hà Nội - Ninh Bình',
                origin_province: '01', origin_provinceName: 'Hà Nội',
                origin_district: '001', origin_districtName: 'Hoàn Kiếm',
                origin_representativeAddress: 'Bến xe Giáp Bát, Giải Phóng, Hoàng Mai',
                origin_representativeLat: 20.9806, origin_representativeLng: 105.8412,
                destination_province: '37', destination_provinceName: 'Ninh Bình',
                destination_district: '369', destination_districtName: 'Ninh Bình',
                destination_representativeAddress: 'Bến xe Ninh Bình, Lê Đại Hành',
                destination_representativeLat: 20.2500, destination_representativeLng: 105.9700,
                distanceKm: 95, estimatedDuration: 120, isActive: true, isPopular: false
            }
        ]
    },
    {
        account: {
            _id: new mongoose.Types.ObjectId('6a41f364712c182acbcf21c7'),
            username: 'trangiabao100304',
            email: 'trangiabao100304@gmail.com',
            phone: '0822377076',
            passwordHash: '$2b$10$r5Jy7SUQzxZ98NpCzoU0cuyeMCoqJsMwbKqFT/RaT6Fk4EzyhmjpG',
            role: 'PARTNER',
            status: 'ACTIVE',
            fullName: 'Thinh',
            profilePicture: 'https://res.cloudinary.com/dfwiqomtv/image/upload/v1782727460/busnet/partners/profiles/bfp5yrmj2nelxvmctbq8.png',
            gender: 'UNKNOWN',
            isOAuthUser: false,
            isEmailVerified: true,
            isPhoneVerified: false,
            banCounts: 0,
            isAutoPublishBlog: false
        },
        partner: {
            operatorName: 'Partner Test 2',
            operatorPhone: '0822377076',
            description: 'Partner Test 4',
            amenities: ['WiFi', 'Air Conditioning', 'Wet Wipes', 'Water Bottle', 'Entertainment Screen', 'Restroom'],
            policies: {
                cancellation: 'Free cancellation up to 24 hours before departure',
                refund: 'Full refund within 3 working days',
                luggage: 'Up to 20kg free luggage',
                children: 'Children under 5 travel free when sharing seat'
            },
            profilePicture: 'https://res.cloudinary.com/dfwiqomtv/image/upload/v1782727460/busnet/partners/profiles/bfp5yrmj2nelxvmctbq8.png',
            coverImage: 'https://res.cloudinary.com/dfwiqomtv/image/upload/v1782727461/busnet/partners/covers/ogqlbq57qbgply36rlrx.png',
            businessLicense: 'https://res.cloudinary.com/dfwiqomtv/raw/upload/v1782707158/busnet/partners/licenses/gf5fxjvn6k3dpq6ccav4',
            licenseStatus: 'APPROVED',
            rejectionReason: null,
            reviewedBy: new mongoose.Types.ObjectId('6a3ab7171fd634a1e90f7a34'),
            reviewedAt: new Date('2026-06-29T04:26:15.302Z'),
            selectedPlanId: null,
            taxCode: '090022888999',
            isVerified: true,
            verifiedAt: new Date('2026-06-29T04:33:37.598Z'),
            ratingAvg: 4.8,
            totalReviews: 15,
            bankAccountName: 'BUI ANH TUAN',
            bankBranch: 'Can Tho',
            bankName: 'VPBank',
            bankNumber: '0822377076',
            sepayKeyEncrypted: 'LA3LUSBTT5FJRCEUDWPO1ODH4TAIGMJHFQN7Q6V8OEDOHTKJAMPCPIEKVZWXPRXD',
            sepayVa: 'AGBSPN4ZYBJT7CAH'
        },
        buses: [
            {
                busName: 'Limousine Royal 22',
                licensePlate: '65C-11111',
                busType: 'Limousine',
                totalSeats: 22,
                description: 'Luxury VIP Limousine with private reclining seats',
                amenities: ['WiFi', 'Air Conditioning', 'USB Charging', 'Water Bottle', 'Restroom'],
                seatLayout_totalRows: 11,
                seatLayout_totalColumns: 2,
                seatLayout_totalFloors: 1
            },
            {
                busName: 'Sleeper Luxury 34',
                licensePlate: '65C-22222',
                busType: 'Sleeper',
                totalSeats: 34,
                description: 'Double-decker luxury sleeper bus',
                amenities: ['WiFi', 'Air Conditioning', 'Blanket & Pillow', 'USB Charging'],
                seatLayout_totalRows: 9,
                seatLayout_totalColumns: 2,
                seatLayout_totalFloors: 2
            }
        ],
        routes: [
            {
                routeName: 'TP.HCM - Đà Lạt',
                origin_province: '79', origin_provinceName: 'TP. Hồ Chí Minh',
                origin_district: '760', origin_districtName: 'Quận 1',
                origin_representativeAddress: 'Bến xe Miền Đông, Bình Thạnh, TP.HCM',
                origin_representativeLat: 10.8145, origin_representativeLng: 106.7113,
                destination_province: '68', destination_provinceName: 'Lâm Đồng',
                destination_district: '672', destination_districtName: 'Đà Lạt',
                destination_representativeAddress: 'Bến xe Đà Lạt, Tô Hiến Thành, Đà Lạt',
                destination_representativeLat: 11.9404, destination_representativeLng: 108.4583,
                distanceKm: 310, estimatedDuration: 420, isActive: true, isPopular: true
            },
            {
                routeName: 'TP.HCM - Cần Thơ',
                origin_province: '79', origin_provinceName: 'TP. Hồ Chí Minh',
                origin_district: '760', origin_districtName: 'Quận 1',
                origin_representativeAddress: 'Bến xe Miền Tây, Bình Tân, TP.HCM',
                origin_representativeLat: 10.7415, origin_representativeLng: 106.6180,
                destination_province: '92', destination_provinceName: 'Cần Thơ',
                destination_district: '916', destination_districtName: 'Ninh Kiều',
                destination_representativeAddress: 'Bến xe trung tâm Cần Thơ, Ninh Kiều, Cần Thơ',
                destination_representativeLat: 10.0341, destination_representativeLng: 105.7680,
                distanceKm: 170, estimatedDuration: 210, isActive: true, isPopular: true
            },
            {
                routeName: 'Hà Nội - Hải Phòng',
                origin_province: '01', origin_provinceName: 'Hà Nội',
                origin_district: '001', origin_districtName: 'Hoàn Kiếm',
                origin_representativeAddress: 'Bến xe Mỹ Đình, Nam Từ Liêm, Hà Nội',
                origin_representativeLat: 21.0285, origin_representativeLng: 105.7654,
                destination_province: '31', destination_provinceName: 'Hải Phòng',
                destination_district: '303', destination_districtName: 'Hồng Bàng',
                destination_representativeAddress: 'Bến xe Thượng Lý, Hải Phòng',
                destination_representativeLat: 20.8600, destination_representativeLng: 106.6600,
                distanceKm: 120, estimatedDuration: 150, isActive: true, isPopular: true
            }
        ]
    }
];

const seedOperators = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI);
        console.log('✅ MongoDB connected');

        const defaultPasswordHash = await bcrypt.hash('Partner@123', 10);

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
                    passwordHash: defaultPasswordHash,
                    ...opData.account
                });
                console.log(`  ✅ Account created: ${account.email}`);
            } else {
                console.log(`  ⏭️  Account exists: ${account.email || account.phone}`);
            }

            // 2. Create or Update PartnerInformation (upsert by accountId to preserve non-schema fields)
            const partnerData = {
                ...opData.partner,
                accountId: account._id
            };
            delete partnerData._id;
            const partnerRes = await PartnerInformation.collection.updateOne(
                { accountId: account._id },
                { $set: partnerData },
                { upsert: true }
            );
            console.log(`  ✅ Partner info seeded/updated: ${opData.partner.operatorName}`);

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
                    { departureTime: '14:00', arrivalTime: '16:30', code: `SCH-${account._id.toString().slice(-4)}-${rIdx}-PM` },
                    { departureTime: '23:30', arrivalTime: '02:00', code: `SCH-${account._id.toString().slice(-4)}-${rIdx}-NIGHT` }
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
                            basePrice: 10000, // 10,000đ for testing
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
                            price: 10000,
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

            // Generate Trip instances for today and next 7 days
            const today = new Date();
            for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
                const targetDate = new Date(today);
                targetDate.setDate(today.getDate() + dayOffset);
                const year = targetDate.getFullYear();
                const month = String(targetDate.getMonth() + 1).padStart(2, '0');
                const day = String(targetDate.getDate()).padStart(2, '0');
                const dateStr = `${year}-${month}-${day}`;
                
                const startOfDay = new Date(`${dateStr}T00:00:00.000Z`);

                const activeSchedules = await Schedule.find({ partnerId: account._id, isActive: true }).populate('busId');
                for (const schedule of activeSchedules) {
                    const expectedTripCode = `TRIP-${schedule.scheduleCode}-${dateStr.replace(/-/g, '')}`;
                    const existingTrip = await Trip.findOne({ tripCode: expectedTripCode });
                    if (!existingTrip) {
                        const bus = schedule.busId;
                        const seats = [];
                        const floors = bus?.seatLayout_totalFloors || 1;
                        const rows = bus?.seatLayout_totalRows || 5;
                        const cols = bus?.seatLayout_totalColumns || 4;

                        for (let f = 1; f <= floors; f++) {
                            const floorPrefix = floors > 1 ? (f === 1 ? 'A' : 'B') : 'A';
                            for (let r = 1; r <= rows; r++) {
                                for (let c = 1; c <= cols; c++) {
                                    const colLetter = String.fromCharCode(65 + c - 1);
                                    seats.push({
                                        seatCode: `${floorPrefix}${r}${colLetter}`,
                                        price: schedule.basePrice,
                                        status: 'AVAILABLE'
                                    });
                                }
                            }
                        }

                        const depParts = schedule.departureTime.split(':').map(Number);
                        const depMinutes = depParts[0] * 60 + depParts[1];
                        const arrParts = schedule.arrivalTime.split(':').map(Number);
                        const arrMinutes = arrParts[0] * 60 + arrParts[1];

                        await Trip.create({
                            scheduleId: schedule._id,
                            partnerId: account._id,
                            routeId: schedule.routeId,
                            busId: bus._id,
                            tripCode: `TRIP-${schedule.scheduleCode}-${dateStr.replace(/-/g, '')}`,
                            departureDate: startOfDay,
                            actualDepartureTime: depMinutes,
                            actualArrivalTime: arrMinutes,
                            totalSeats: seats.length,
                            availableSeats: seats.length,
                            seats,
                            status: 'OPEN'
                        });
                        console.log(`      🚀 Trip generated for date ${dateStr}: TRIP-${schedule.scheduleCode}`);
                    }
                }
            }

            console.log(`\n🎉 Operator "${opData.partner.operatorName}" seeded successfully!\n`);
        }

        console.log('🔄 Updating all existing schedules, ticket prices, and trip seats in database to 10,000đ...');
        await Schedule.updateMany({}, { $set: { basePrice: 10000 } });
        await TicketPrice.updateMany({}, { $set: { price: 10000 } });
        console.log('🔄 Normalizing trip departure dates to UTC Midnight...');
        const allTrips = await Trip.find({});
        for (const trip of allTrips) {
            const yyyymmdd = trip.tripCode.slice(-8);
            if (yyyymmdd && yyyymmdd.length === 8 && /^\d+$/.test(yyyymmdd)) {
                const normalizedDateStr = `${yyyymmdd.slice(0, 4)}-${yyyymmdd.slice(4, 6)}-${yyyymmdd.slice(6, 8)}`;
                const normalizedDate = new Date(`${normalizedDateStr}T00:00:00.000Z`);
                await Trip.updateOne({ _id: trip._id }, { $set: { departureDate: normalizedDate } });
            }
        }
        await Trip.updateMany({ departureDate: { $gte: new Date('2026-07-19T00:00:00.000Z') } }, { $set: { status: 'OPEN' } });
        console.log('✅ All trip departure dates normalized and future trips set to OPEN!');

        console.log('✅ All operators and trips seeded successfully. Disconnecting...');
        await mongoose.disconnect();
        process.exit(0);
    } catch (err) {
        console.error('❌ Seed error:', err);
        await mongoose.disconnect();
        process.exit(1);
    }
};

seedOperators();
