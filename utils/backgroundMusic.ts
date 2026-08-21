export type BackgroundMusicTrackId = 'audio_1' | 'audio_2' | 'audio_3' | 'audio_4' | 'audio_5';

export const BACKGROUND_MUSIC_VOLUME = 0.7;

export const BACKGROUND_MUSIC_TRACKS = [
  { id: 'audio_1', name: 'Audio 1', source: require('../assets/audio/audio1.mp3') },
  { id: 'audio_2', name: 'Audio 2', source: require('../assets/audio/audio2.mp3') },
  { id: 'audio_3', name: 'Audio 3', source: require('../assets/audio/audio3.mp3') },
  { id: 'audio_4', name: 'Audio 4', source: require('../assets/audio/audio4.mp3') },
  { id: 'audio_5', name: 'Audio 5', source: require('../assets/audio/audio5.mp3') },
] as const;

export type BackgroundMusicTrack = (typeof BACKGROUND_MUSIC_TRACKS)[number];

export function getRandomBackgroundMusicTrack(): BackgroundMusicTrack {
  return BACKGROUND_MUSIC_TRACKS[Math.floor(Math.random() * BACKGROUND_MUSIC_TRACKS.length)];
}

export function isBackgroundMusicTrackId(value: unknown): value is BackgroundMusicTrackId {
  return BACKGROUND_MUSIC_TRACKS.some((track) => track.id === value);
}
