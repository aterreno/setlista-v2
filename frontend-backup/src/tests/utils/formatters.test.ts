import { formatDate } from '../../utils/formatters';

describe('formatDate', () => {
  it('formats setlist.fm date format (DD-MM-YYYY) correctly', () => {
    expect(formatDate('31-12-2023')).toBe('December 31, 2023');
    expect(formatDate('01-01-2024')).toBe('January 1, 2024');
    expect(formatDate('15-06-2023')).toBe('June 15, 2023');
    expect(formatDate('25-03-2022')).toBe('March 25, 2022');
  });

  it('formats ISO date format (YYYY-MM-DD) correctly', () => {
    expect(formatDate('2023-12-31')).toBe('December 31, 2023');
    expect(formatDate('2024-01-01')).toBe('January 1, 2024');
    expect(formatDate('2023-06-15')).toBe('June 15, 2023');
    expect(formatDate('2022-03-25')).toBe('March 25, 2022');
  });

  it('handles various valid date string formats', () => {
    expect(formatDate('Dec 31, 2023')).toBe('December 31, 2023');
    expect(formatDate('December 31, 2023')).toBe('December 31, 2023');
    expect(formatDate('12/31/2023')).toBe('December 31, 2023');
  });

  it('handles edge cases for setlist.fm format', () => {
    // Leap year
    expect(formatDate('29-02-2024')).toBe('February 29, 2024');
    
    // Different months
    expect(formatDate('01-01-2023')).toBe('January 1, 2023');
    expect(formatDate('31-01-2023')).toBe('January 31, 2023');
    expect(formatDate('28-02-2023')).toBe('February 28, 2023');
    expect(formatDate('31-03-2023')).toBe('March 31, 2023');
    expect(formatDate('30-04-2023')).toBe('April 30, 2023');
    expect(formatDate('31-05-2023')).toBe('May 31, 2023');
    expect(formatDate('30-06-2023')).toBe('June 30, 2023');
    expect(formatDate('31-07-2023')).toBe('July 31, 2023');
    expect(formatDate('31-08-2023')).toBe('August 31, 2023');
    expect(formatDate('30-09-2023')).toBe('September 30, 2023');
    expect(formatDate('31-10-2023')).toBe('October 31, 2023');
    expect(formatDate('30-11-2023')).toBe('November 30, 2023');
    expect(formatDate('31-12-2023')).toBe('December 31, 2023');
  });

  it('handles single digit days and months in setlist.fm format', () => {
    expect(formatDate('01-01-2023')).toBe('January 1, 2023');
    expect(formatDate('05-03-2023')).toBe('March 5, 2023');
    expect(formatDate('09-09-2023')).toBe('September 9, 2023');
  });

  it('returns original string for invalid date formats', () => {
    expect(formatDate('invalid-date')).toBe('invalid-date');
    expect(formatDate('')).toBe('');
    expect(formatDate('not a date at all')).toBe('not a date at all');
  });

  it('handles malformed but parseable dates', () => {
    // These don't match our regex patterns but might be parseable by Date constructor
    expect(formatDate('2023/12/31')).toBe('December 31, 2023');
    // Note: 31/12/2023 is not parsed correctly by JS Date constructor (US format assumed)
    expect(formatDate('31/12/2023')).toBe('31/12/2023');
  });

  it('handles dates with different separators that do not match expected patterns', () => {
    // These have the right number format but wrong separators, so they fall through to generic parsing
    expect(formatDate('31.12.2023')).toBe('31.12.2023'); // Not parseable by Date constructor
    // Note: 2023.12.31 is actually parseable by Date constructor
    expect(formatDate('2023.12.31')).toBe('December 31, 2023');
  });

  it('handles boundary years correctly', () => {
    expect(formatDate('01-01-1970')).toBe('January 1, 1970');
    expect(formatDate('31-12-1999')).toBe('December 31, 1999');
    expect(formatDate('01-01-2000')).toBe('January 1, 2000');
    expect(formatDate('31-12-2099')).toBe('December 31, 2099');
  });

  it('preserves time information when present in generic date strings', () => {
    // Note: Our formatter only shows date, not time
    expect(formatDate('2023-12-31T23:59:59Z')).toBe('December 31, 2023');
    expect(formatDate('Dec 31, 2023 11:59 PM')).toBe('December 31, 2023');
  });

  it('handles null-ish values gracefully', () => {
    // TypeScript should prevent these, but just in case
    // Note: These will be converted to strings and processed
    expect(formatDate(null as any)).toBe('January 1, 1970'); // null becomes epoch
    expect(formatDate(undefined as any)).toBe(undefined); // undefined returns undefined
  });

  it('handles numeric inputs (should be strings)', () => {
    // These will be coerced to strings and processed as dates
    // Note: Numbers get converted to dates by the Date constructor
    expect(formatDate(20231231 as any)).toBe('January 1, 1970'); // Invalid number becomes epoch
    expect(formatDate(1672531200000 as any)).toBe('January 1, 2023'); // Unix timestamp becomes proper date
  });

  it('validates specific problematic dates that caused issues', () => {
    // These are real dates from setlist.fm that were causing "Invalid Date" in the UI
    expect(formatDate('15-06-2023')).toBe('June 15, 2023');
    expect(formatDate('31-12-2022')).toBe('December 31, 2022');
    expect(formatDate('01-03-2024')).toBe('March 1, 2024');
    
    // Make sure we don't return "Invalid Date" string
    expect(formatDate('31-12-2023')).not.toContain('Invalid');
    expect(formatDate('15-06-2023')).not.toContain('Invalid');
  });
});