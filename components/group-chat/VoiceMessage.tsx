import { Audio, type AVPlaybackStatus } from 'expo-av';
import { Pause, Play, WarningCircle } from 'phosphor-react-native';
import { useCallback, useEffect, useRef, useState } from 'react';
import { ActivityIndicator, TouchableOpacity, View } from 'react-native';

import { Text } from '~/components/ui/text';
import { formatDuration } from '~/utils/chat';

const WAVEFORM_HEIGHTS = [10, 18, 25, 14, 29, 20, 11, 24, 31, 17, 10, 22, 27, 14, 20, 10];

type LoadState = 'idle' | 'loading' | 'ready' | 'error';

type VoiceMessageProps = {
  uri?: string;
  duration?: number;
  isMine: boolean;
  isPlaying: boolean;
  onTogglePlayback: () => void;
};

const VoiceMessage = ({
  uri,
  duration = 0,
  isMine,
  isPlaying,
  onTogglePlayback,
}: VoiceMessageProps) => {
  const soundRef = useRef<Audio.Sound | null>(null);

  const mountedRef = useRef(true);

  const desiredPlayingRef = useRef(isPlaying);

  const onTogglePlaybackRef = useRef(onTogglePlayback);

  const loadingRef = useRef(false);

  const [loadState, setLoadState] = useState<LoadState>('idle');

  const [positionMillis, setPositionMillis] = useState(0);

  const [durationMillis, setDurationMillis] = useState(Math.max(duration, 0) * 1000);

  useEffect(() => {
    desiredPlayingRef.current = isPlaying;
  }, [isPlaying]);

  useEffect(() => {
    onTogglePlaybackRef.current = onTogglePlayback;
  }, [onTogglePlayback]);

  const handlePlaybackStatus = useCallback((status: AVPlaybackStatus) => {
    if (!mountedRef.current) {
      return;
    }

    if (!status.isLoaded) {
      if (status.error) {
        setLoadState('error');

        if (desiredPlayingRef.current) {
          desiredPlayingRef.current = false;

          onTogglePlaybackRef.current();
        }
      }

      return;
    }

    setLoadState('ready');

    setPositionMillis(status.positionMillis);

    if (status.durationMillis) {
      setDurationMillis(status.durationMillis);
    }

    if (status.didJustFinish && desiredPlayingRef.current) {
      desiredPlayingRef.current = false;

      setPositionMillis(0);
      onTogglePlaybackRef.current();
    }
  }, []);

  const loadAndPlay = useCallback(async () => {
    if (!uri) {
      setLoadState('error');

      if (desiredPlayingRef.current) {
        desiredPlayingRef.current = false;

        onTogglePlaybackRef.current();
      }

      return;
    }

    if (loadingRef.current) {
      return;
    }

    try {
      const existingSound = soundRef.current;

      if (existingSound) {
        const currentStatus = await existingSound.getStatusAsync();

        if (currentStatus.isLoaded) {
          if (
            currentStatus.durationMillis &&
            currentStatus.positionMillis >= currentStatus.durationMillis - 150
          ) {
            await existingSound.setPositionAsync(0);
          }

          await existingSound.playAsync();
          return;
        }
      }

      setLoadState('loading');
      loadingRef.current = true;

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
      });

      const { sound, status } = await Audio.Sound.createAsync(
        {
          uri,
        },
        {
          shouldPlay: true,
          progressUpdateIntervalMillis: 150,
        },
        handlePlaybackStatus,
        true
      );

      if (!mountedRef.current) {
        await sound.unloadAsync().catch(() => undefined);

        return;
      }

      soundRef.current = sound;

      if (status.isLoaded) {
        setLoadState('ready');

        setPositionMillis(status.positionMillis);

        if (status.durationMillis) {
          setDurationMillis(status.durationMillis);
        }
      }

      if (!desiredPlayingRef.current) {
        await sound.pauseAsync();
      }
    } catch {
      if (!mountedRef.current) {
        return;
      }

      setLoadState('error');

      if (desiredPlayingRef.current) {
        desiredPlayingRef.current = false;

        onTogglePlaybackRef.current();
      }
    } finally {
      loadingRef.current = false;
    }
  }, [handlePlaybackStatus, uri]);

  useEffect(() => {
    if (isPlaying) {
      void loadAndPlay();
      return;
    }

    const sound = soundRef.current;

    if (sound) {
      void sound.pauseAsync().catch(() => undefined);
    }
  }, [isPlaying, loadAndPlay]);

  useEffect(() => {
    mountedRef.current = true;

    setLoadState('idle');
    setPositionMillis(0);
    loadingRef.current = false;

    setDurationMillis(Math.max(duration, 0) * 1000);

    return () => {
      mountedRef.current = false;

      const sound = soundRef.current;

      soundRef.current = null;

      if (sound) {
        void sound.unloadAsync().catch(() => undefined);
      }
    };
  }, [duration, uri]);

  const handlePress = () => {
    if (!uri) {
      setLoadState('error');
      return;
    }

    if (loadState === 'error') {
      setLoadState('idle');
      setPositionMillis(0);
    }

    onTogglePlayback();
  };

  const totalDurationMillis = Math.max(durationMillis, duration * 1000, 1);

  const progress = Math.min(Math.max(positionMillis / totalDurationMillis, 0), 1);

  const displaySeconds = positionMillis > 0 ? Math.floor(positionMillis / 1000) : duration;

  const playedBars = Math.round(progress * WAVEFORM_HEIGHTS.length);

  const activeColor = isMine ? '#FFFFFF' : '#F76B1C';

  const inactiveColor = isMine ? '#FFD9C5' : '#C8C8C8';

  return (
    <View className="min-w-[235px] py-1">
      <View className="flex-row items-center">
        <TouchableOpacity
          activeOpacity={0.75}
          disabled={loadState === 'loading'}
          onPress={handlePress}
          accessibilityRole="button"
          accessibilityLabel={
            loadState === 'error'
              ? 'Retry voice note'
              : isPlaying
                ? 'Pause voice note'
                : 'Play voice note'
          }
          className="h-10 w-10 items-center justify-center rounded-full"
          style={{
            backgroundColor: isMine ? '#FFFFFF' : '#F76B1C',
          }}>
          {loadState === 'loading' ? (
            <ActivityIndicator size="small" color={isMine ? '#F76B1C' : '#FFFFFF'} />
          ) : loadState === 'error' ? (
            <WarningCircle size={19} color={isMine ? '#F76B1C' : '#FFFFFF'} weight="fill" />
          ) : isPlaying ? (
            <Pause size={18} color={isMine ? '#F76B1C' : '#FFFFFF'} weight="fill" />
          ) : (
            <Play size={18} color={isMine ? '#F76B1C' : '#FFFFFF'} weight="fill" />
          )}
        </TouchableOpacity>

        <View className="mx-3 flex-1 flex-row items-center justify-center gap-[3px]">
          {WAVEFORM_HEIGHTS.map((height, index) => (
            <View
              key={`${height}-${index}`}
              style={{
                width: 3,
                height,
                borderRadius: 2,
                backgroundColor: index < playedBars ? activeColor : inactiveColor,
              }}
            />
          ))}
        </View>

        <Text
          className="min-w-[32px] text-right font-body text-xs"
          style={{
            color: isMine ? '#FFFFFF' : '#555555',
          }}>
          {formatDuration(displaySeconds)}
        </Text>
      </View>

      {loadState === 'error' ? (
        <Text
          className="mt-1 text-center font-body text-[10px]"
          style={{
            color: isMine ? '#FFF0E8' : '#D04437',
          }}>
          Audio unavailable. Tap to retry.
        </Text>
      ) : null}
    </View>
  );
};

export default VoiceMessage;
