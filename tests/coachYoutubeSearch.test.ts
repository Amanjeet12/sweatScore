// @ts-nocheck -- Bun test-only fixture; root app TypeScript has no Bun types.
import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';

import { workoutYoutubeSearch } from '../shared/coachYoutubeSearch';

describe('Coach workout YouTube search', () => {
  test('preserves useful saved workout labels and the client example', () => {
    for (const phrase of [
      '10-minute leg workout',
      '20-minute full body strength workout',
      '15-minute core workout',
      '10-minute gentle mobility workout',
    ])
      expect(workoutYoutubeSearch(phrase)?.phrase).toBe(phrase);
    expect(workoutYoutubeSearch('45 minute full body strength workout')?.url).toBe(
      'https://m.youtube.com/results?search_query=45+minute+full+body+strength+workout'
    );
    expect(workoutYoutubeSearch('leg day')?.phrase).toBe('leg day');
  });

  test('normalizes spacing, controls, punctuation and Unicode without changing the destination', () => {
    const inputs = [
      '  10-minute   leg workout  ',
      '10-minute\nleg\tworkout',
      '“gentle” core workout!',
      'étirement doux workout',
      'leg & core? #1 = easy',
      'leg\u0000workout\u007f',
      'leg workout&redirect=https://evil.example/#fragment',
    ];
    for (const input of inputs) {
      const result = workoutYoutubeSearch(input);
      expect(result).not.toBeNull();
      const url = new URL(result!.url);
      expect(url.protocol).toBe('https:');
      expect(url.hostname).toBe('m.youtube.com');
      expect(url.pathname).toBe('/results');
      expect([...url.searchParams.keys()]).toEqual(['search_query']);
      expect(url.searchParams.get('search_query')).toBe(result!.phrase);
      expect(result!.phrase).not.toMatch(/[\u0000-\u001f\u007f-\u009f]/);
    }
    expect(workoutYoutubeSearch('  10-minute   leg workout  ')?.phrase).toBe(
      '10-minute leg workout'
    );
    expect(workoutYoutubeSearch('10-minute\nleg\tworkout')?.phrase).toBe('10-minute leg workout');
  });

  test('rejects empty and URL-like inputs, and limits long phrases', () => {
    expect(workoutYoutubeSearch('')).toBeNull();
    expect(workoutYoutubeSearch('   \n\t')).toBeNull();
    expect(workoutYoutubeSearch('https://evil.example/path?search_query=foo')).toBeNull();
    expect(workoutYoutubeSearch('//evil.example/path')).toBeNull();
    expect(workoutYoutubeSearch('x'.repeat(300))?.phrase.length).toBe(100);
  });

  test('workout details link is informational; live capture and posting stay separate', () => {
    const source = readFileSync(
      new URL('../components/core/dashboard/CoachCheckInFlow.tsx', import.meta.url),
      'utf8'
    );
    const openSearch = source
      .split('const openWorkoutSearch = async () => {')[1]
      .split('\n  };')[0];
    expect(openSearch).toContain('Linking.openURL(workoutSearch.url)');
    expect(openSearch).not.toMatch(/reserve\(|complete\(|upload\(|publish|setShowCamera|router\./);
    expect(source).not.toContain('Moves you could try');
    expect(source).toContain('workoutYoutubeSearch(queue?.label ?? assignment?.label)');
    expect(source).toContain('workoutSearch ? (');
    expect(source).toContain('onPress={start}');
    expect(source).toContain('Use the in-app camera');
    expect(source).toContain('assignment?.mandatory');
    expect(source).toContain('assignment.consumedCount');
    expect(source).not.toContain('Gym Workout');
    expect(source).not.toContain('+4 pts');
    expect(source).toContain("mode === 'post'");
    expect(source).toContain('Retake photo');
    expect(source).toContain('publishProof');
    expect(source).toContain('publishMeal');
    expect(source).toContain("category === 'meals'");
  });
});
