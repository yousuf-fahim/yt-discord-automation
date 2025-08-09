/**
 * Utility functions for scheduling tasks
 */

/**
 * Converts a time in CEST to the server's local time
 * @param {number} hour - Hour in CEST (0-23)
 * @param {number} minute - Minute in CEST (0-59)
 * @returns {Object} - Object with hour and minute in server's local time
 */
function cestToLocal(hour, minute) {
  // CEST is UTC+2
  const cestOffset = 2;
  
  // Get the server's UTC offset in hours
  const serverOffset = -new Date().getTimezoneOffset() / 60;
  
  // Calculate the difference
  const hourDiff = serverOffset - cestOffset;
  
  // Adjust the hour
  let localHour = hour + hourDiff;
  
  // Handle overflow
  if (localHour >= 24) {
    localHour -= 24;
  } else if (localHour < 0) {
    localHour += 24;
  }
  
  return {
    hour: localHour,
    minute
  };
}

/**
 * Creates a cron expression for a specific time in CEST
 * @param {number} hour - Hour in CEST (0-23)
 * @param {number} minute - Minute in CEST (0-59)
 * @returns {string} - Cron expression for the specified time
 */
function createCronForCEST(hour, minute) {
  const local = cestToLocal(hour, minute);
  return `${local.minute} ${local.hour} * * *`;
}

module.exports = {
  cestToLocal,
  createCronForCEST
};
