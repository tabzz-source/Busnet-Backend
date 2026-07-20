const mongoose = require('mongoose');

const pricingAuditLogSchema = new mongoose.Schema(
    {
        partnerId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Account',
            required: true,
            index: true
        },
        scheduleId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Schedule',
            required: true,
            index: true
        },
        ticketPriceId: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'TicketPrice',
            required: true,
            index: true
        },
        action: {
            type: String,
            enum: ['CREATE', 'UPDATE'],
            required: true
        },
        actorRole: {
            type: String,
            default: 'PARTNER'
        },
        before: {
            type: mongoose.Schema.Types.Mixed,
            default: null
        },
        after: {
            type: mongoose.Schema.Types.Mixed,
            required: true
        },
        financialDelta: {
            basePrice: { type: Number, required: true },
            discount: { type: Number, required: true },
            finalPrice: { type: Number, required: true }
        },
        actionAt: {
            type: Date,
            required: true,
            default: Date.now
        }
    },
    {
        timestamps: true,
        collection: 'pricing_audit_logs'
    }
);

pricingAuditLogSchema.index({ ticketPriceId: 1, actionAt: -1 });

module.exports = mongoose.model('PricingAuditLog', pricingAuditLogSchema);
