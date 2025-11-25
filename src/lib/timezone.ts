const TIRANA_TIME_ZONE = 'Europe/Tirane';

const tiranaDateFormatter = new Intl.DateTimeFormat('en-GB', {
  dateStyle: 'short',
  timeStyle: 'short',
  timeZone: TIRANA_TIME_ZONE,
});

const tiranaInputFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: TIRANA_TIME_ZONE,
  year: 'numeric',
  month: '2-digit',
  day: '2-digit',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

const getPart = (parts: Intl.DateTimeFormatPart[], type: string) =>
  parts.find((part) => part.type === type)?.value ?? '';

const getOffsetMinutesForTirana = (date: Date) => {
  const parts = tiranaInputFormatter.formatToParts(date);
  const year = Number(getPart(parts, 'year'));
  const month = Number(getPart(parts, 'month'));
  const day = Number(getPart(parts, 'day'));
  const hour = Number(getPart(parts, 'hour'));
  const minute = Number(getPart(parts, 'minute'));
  const asUtc = Date.UTC(year, month - 1, day, hour, minute);
  return Math.round((asUtc - date.getTime()) / 60000);
};

export const formatTiranaDateTime = (value: string | number | Date) =>
  tiranaDateFormatter.format(new Date(value));

export const getTiranaNowDateTimeLocal = () => {
  const parts = tiranaInputFormatter.formatToParts(new Date());
  const year = getPart(parts, 'year');
  const month = getPart(parts, 'month');
  const day = getPart(parts, 'day');
  const hour = getPart(parts, 'hour');
  const minute = getPart(parts, 'minute');
  return `${year}-${month}-${day}T${hour}:${minute}`;
};

export const toISOInTirana = (datetimeLocal: string) => {
  const [datePart, timePart] = datetimeLocal.split('T');
  if (!datePart || !timePart) {
    return new Date(datetimeLocal).toISOString();
  }

  const [year, month, day] = datePart.split('-').map(Number);
  const [hour, minute] = timePart.split(':').map(Number);
  if ([year, month, day, hour, minute].some((value) => Number.isNaN(value))) {
    return new Date(datetimeLocal).toISOString();
  }

  const assumedUtc = new Date(Date.UTC(year, month - 1, day, hour, minute));
  const firstOffset = getOffsetMinutesForTirana(assumedUtc);
  const correctedUtc = new Date(assumedUtc.getTime() - firstOffset * 60 * 1000);
  const finalOffset = getOffsetMinutesForTirana(correctedUtc);
  const utcMillis = assumedUtc.getTime() - finalOffset * 60 * 1000;
  return new Date(utcMillis).toISOString();
};

export const TIRANA_TIMEZONE = TIRANA_TIME_ZONE;

export const getTiranaDateParts = (value: string | number | Date = new Date()) => {
  const parts = tiranaInputFormatter.formatToParts(new Date(value));
  return {
    year: Number(getPart(parts, 'year')),
    month: Number(getPart(parts, 'month')),
    day: Number(getPart(parts, 'day')),
    hour: Number(getPart(parts, 'hour')),
    minute: Number(getPart(parts, 'minute')),
  };
};
