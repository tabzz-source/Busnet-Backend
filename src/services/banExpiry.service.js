const Account = require('../models/Account');
const BanHistory = require('../models/BanHistory');

// There's no scheduler/cron in this codebase to sweep ban expirations
// proactively, so a TEMPORARY ban is "expired" lazily — the first time
// anything looks at the account after its expiredAt has passed. Call this
// wherever an account's BANNED status gates an action (login flows) or gets
// displayed (admin customer views) so status never drifts stale.
//
// Returns the account's up-to-date status: unchanged unless it was BANNED
// via an expired TEMPORARY ban, in which case it's healed back to ACTIVE
// (both the Account and the BanHistory record are updated) and 'ACTIVE' is returned.
const resolveAccountStatus = async (accountId, currentStatus) => {
    if (currentStatus !== 'BANNED') {
        return currentStatus;
    }

    const activeBan = await BanHistory.findOne({ accountId, status: 'ACTIVE' }).sort({ createdAt: -1 });
    if (!activeBan || activeBan.type !== 'TEMPORARY' || !activeBan.expiredAt || activeBan.expiredAt > new Date()) {
        return currentStatus;
    }

    activeBan.status = 'EXPIRED';
    activeBan.unbannedAt = new Date();
    await activeBan.save();

    await Account.updateOne({ _id: accountId }, { status: 'ACTIVE' });

    return 'ACTIVE';
};

// Proactive counterpart to resolveAccountStatus's lazy, on-touch healing —
// called on a timer from server.js so an expired TEMPORARY ban gets lifted
// even if nobody ever logs into or looks up that account again. Safe to run
// concurrently with resolveAccountStatus: a ban can only be ACTIVE for one
// account at a time (banning already requires the account not be BANNED
// already), so there's no double-processing risk between the two paths.
const sweepExpiredBans = async () => {
    const now = new Date();
    const expiredBans = await BanHistory.find({
        status: 'ACTIVE',
        type: 'TEMPORARY',
        expiredAt: { $lte: now }
    }).select('_id accountId');

    if (expiredBans.length === 0) {
        return { swept: 0 };
    }

    const banIds = expiredBans.map((b) => b._id);
    const accountIds = expiredBans.map((b) => b.accountId);

    await BanHistory.updateMany(
        { _id: { $in: banIds } },
        { status: 'EXPIRED', unbannedAt: now }
    );

    await Account.updateMany(
        { _id: { $in: accountIds }, status: 'BANNED' },
        { status: 'ACTIVE' }
    );

    return { swept: expiredBans.length };
};

module.exports = { resolveAccountStatus, sweepExpiredBans };
