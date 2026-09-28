const YOUTUBE_SEARCH = 'https://m.youtube.com/results?search_query=';
const MAX_PHRASE_LENGTH = 100;

/** Only the search text comes from a saved assignment; the destination is fixed. */
export function workoutYoutubeSearch(recommendation: string | null | undefined) {
  if (!recommendation) return null;
  const cleaned = recommendation
    .replace(/[\u0000-\u001f\u007f-\u009f]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (!cleaned || /^(?:[a-z][a-z\d+.-]*:|\/\/)/i.test(cleaned)) return null;
  const phrase = cleaned.slice(0, MAX_PHRASE_LENGTH).trim();
  if (!phrase) return null;
  return {
    phrase,
    url: `${YOUTUBE_SEARCH}${encodeURIComponent(phrase).replace(/%20/g, '+')}`,
  };
}
