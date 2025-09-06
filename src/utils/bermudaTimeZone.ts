/**
 * Accurate Bermuda Timezone Calculations
 * Handles proper DST transition dates (not just month approximations)
 */

/**
 * Get the first Sunday of a given month and year
 */
function getFirstSunday(year: number, month: number): Date {
  const firstDay = new Date(year, month, 1);
  const dayOfWeek = firstDay.getDay(); // 0 = Sunday, 1 = Monday, etc.
  const daysUntilSunday = dayOfWeek === 0 ? 0 : 7 - dayOfWeek;
  return new Date(year, month, 1 + daysUntilSunday);
}

/**
 * Get the second Sunday of a given month and year
 */
function getSecondSunday(year: number, month: number): Date {
  const firstSunday = getFirstSunday(year, month);
  return new Date(firstSunday.getFullYear(), firstSunday.getMonth(), firstSunday.getDate() + 7);
}

/**
 * Get the DST transition dates for Bermuda for a given year
 * Bermuda follows the US DST schedule since 2007:
 * - Start: Second Sunday in March at 2:00 AM AST → 3:00 AM ADT
 * - End: First Sunday in November at 2:00 AM ADT → 1:00 AM AST
 */
export function getBermudaDSTTransitions(year: number): {
  start: Date;
  end: Date;
} {
  // Second Sunday in March at 2:00 AM
  const startDST = getSecondSunday(year, 2); // March is month index 2
  startDST.setHours(2, 0, 0, 0); // 2:00 AM
  
  // First Sunday in November at 2:00 AM
  const endDST = getFirstSunday(year, 10); // November is month index 10
  endDST.setHours(2, 0, 0, 0); // 2:00 AM
  
  return { start: startDST, end: endDST };
}

/**
 * Determine if Bermuda is in Daylight Saving Time for a given date
 * More accurate than month-based approximations
 * 
 * Note: The transition times are in local time, but we compare against UTC.
 * Spring forward: 2:00 AM AST (UTC-4) = 6:00 AM UTC
 * Fall back: 2:00 AM ADT (UTC-3) = 5:00 AM UTC
 */
export function isBermudaDST(date: Date): boolean {
  const year = date.getFullYear();
  const { start, end } = getBermudaDSTTransitions(year);
  
  // Convert transition times to UTC for accurate comparison
  // Spring: 2:00 AM AST (UTC-4) becomes UTC by adding 4 hours
  // Fall: 2:00 AM ADT (UTC-3) becomes UTC by adding 3 hours
  const startUTC = new Date(start.getTime() + (4 * 60 * 60 * 1000)); // 2:00 AM AST = 6:00 AM UTC
  const endUTC = new Date(end.getTime() + (3 * 60 * 60 * 1000)); // 2:00 AM ADT = 5:00 AM UTC
  
  // DST is active from start date (inclusive) until end date (exclusive)
  return date >= startUTC && date < endUTC;
}

/**
 * Get the correct timezone abbreviation for Bermuda on a given date
 */
export function getBermudaTimeZone(date: Date): 'ADT' | 'AST' {
  return isBermudaDST(date) ? 'ADT' : 'AST';
}

/**
 * Get the UTC offset for Bermuda on a given date
 * Returns hours to subtract from UTC to get local Bermuda time
 */
export function getBermudaUTCOffset(date: Date): number {
  return isBermudaDST(date) ? 3 : 4; // UTC-3 for ADT, UTC-4 for AST
}

/**
 * Convert UTC time to Bermuda local time with proper DST handling
 */
export function convertToBermudaLocalTime(utcDate: Date): Date {
  const offsetHours = getBermudaUTCOffset(utcDate);
  return new Date(utcDate.getTime() - (offsetHours * 60 * 60 * 1000));
}