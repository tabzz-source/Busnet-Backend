const { activateDueSubscriptions } = require('../services/partnerSubscription.service');

const activateQueuedSubscriptionsJob = async () => activateDueSubscriptions();

module.exports = activateQueuedSubscriptionsJob;
