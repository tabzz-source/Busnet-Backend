const addMinutes = (date, minutes) => new Date(date.getTime() + minutes * 60 * 1000);

module.exports = { addMinutes };
