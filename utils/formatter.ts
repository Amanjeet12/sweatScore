import { format, formatDistanceToNowStrict } from 'date-fns';

export const formatDate = (date: Date, formatString: string) => {
  return format(date, formatString);
};

export const formatDateToLocaleString = (date?: Date | number) => {
  if (!date) return '';

  return format(date, 'do LLL yyyy');
};

export const secondsToMinutes = (seconds: number) => {
  return Math.floor(seconds / 60);
};

export const formatPoints = (points: number) => {
  return points.toLocaleString();
};

export const formatNumberWithOrdinal = (number: number) => {
  const suffixes = ['th', 'st', 'nd', 'rd'];
  const specialNumbers = [11, 12, 13];
  const relevantSuffix = suffixes[number % 10] || suffixes[0];

  if (specialNumbers.includes(number % 100)) {
    return number + 'th';
  }

  return number + relevantSuffix;
};

export const formatName = (name: string) => {
  const parts = name.split(' ');
  const firstName = parts[0];
  const lastName = parts[1];

  if (!lastName) {
    return firstName;
  }

  return `${firstName} ${lastName[0]}`;
};

export const formatDistanceToNow = (date?: string | number | Date) => {
  if (!date) return null;

  try {
    const distance = formatDistanceToNowStrict(new Date(date), {
      addSuffix: true,
      roundingMethod: 'ceil',
    });

    return distance
      .replace(/ seconds? ago/, 's ago')
      .replace(/ minutes? ago/, 'min ago')
      .replace(/ hours? ago/, 'h ago')
      .replace(/ days? ago/, 'd ago')
      .replace(/ months? ago/, 'mon ago')
      .replace(/ years? ago/, 'y ago'); // Added years just in case
  } catch (error) {
    return null;
  }
};

export const intToString = (value: number) => {
  if (value < 1000) return value.toString();

  const suffixes = ['', 'k', 'm', 'b', 't'];
  const suffixNum = Math.floor(('' + value).length / 3);
  let shortValue: any = parseFloat(
    (suffixNum !== 0 ? value / Math.pow(1000, suffixNum) : value).toPrecision(2)
  );
  if (shortValue % 1 !== 0) {
    shortValue = shortValue.toFixed(1);
  }
  return shortValue + suffixes[suffixNum];
};
