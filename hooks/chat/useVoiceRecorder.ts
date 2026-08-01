import { Audio } from 'expo-av';
import { useCallback, useEffect, useRef, useState } from 'react';

import type { PendingVoiceNote } from '~/types/chat';

const MIN_VOICE_DURATION_MILLIS = 800;
const MAX_VOICE_DURATION_SECONDS = 300;

const restorePlaybackAudioMode = async () => {
  try {
    await Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      shouldDuckAndroid: true,
      playThroughEarpieceAndroid: false,
      staysActiveInBackground: false,
    });
  } catch {
    // Audio-mode cleanup must not crash the chat.
  }
};

export const useVoiceRecorder = () => {
  const recordingRef = useRef<Audio.Recording | null>(null);

  const mountedRef = useRef(true);

  const [isRecording, setIsRecording] = useState(false);

  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const [isRecorderBusy, setIsRecorderBusy] = useState(false);

  const resetRecorderState = useCallback(() => {
    if (!mountedRef.current) {
      return;
    }

    setIsRecording(false);
    setRecordingSeconds(0);
    setIsRecorderBusy(false);
  }, []);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;

      const recording = recordingRef.current;

      recordingRef.current = null;

      if (recording) {
        void recording.stopAndUnloadAsync().catch(() => {
          // Recording may already be stopped.
        });
      }

      void restorePlaybackAudioMode();
    };
  }, []);

  const startRecording = useCallback(async () => {
    if (recordingRef.current || isRecorderBusy) {
      return;
    }

    setIsRecorderBusy(true);

    try {
      const permission = await Audio.requestPermissionsAsync();

      if (!permission.granted) {
        throw new Error('Microphone permission is required to record a voice message.');
      }

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
        shouldDuckAndroid: true,
        playThroughEarpieceAndroid: false,
        staysActiveInBackground: false,
      });

      const { recording } = await Audio.Recording.createAsync(
        Audio.RecordingOptionsPresets.HIGH_QUALITY,

        (status) => {
          if (!mountedRef.current || !status.isRecording) {
            return;
          }

          setRecordingSeconds(Math.floor(status.durationMillis / 1000));
        },

        250
      );

      recordingRef.current = recording;

      if (mountedRef.current) {
        setRecordingSeconds(0);
        setIsRecording(true);
      }
    } catch (error) {
      recordingRef.current = null;

      await restorePlaybackAudioMode();

      throw error instanceof Error ? error : new Error('The voice recording could not be started.');
    } finally {
      if (mountedRef.current) {
        setIsRecorderBusy(false);
      }
    }
  }, [isRecorderBusy]);

  const cancelRecording = useCallback(async () => {
    const recording = recordingRef.current;

    recordingRef.current = null;

    if (mountedRef.current) {
      setIsRecorderBusy(true);
    }

    try {
      if (recording) {
        await recording.stopAndUnloadAsync().catch(() => {
          // The recording may already be stopped.
        });
      }
    } finally {
      await restorePlaybackAudioMode();
      resetRecorderState();
    }
  }, [resetRecorderState]);

  const finishRecording = useCallback(async (): Promise<PendingVoiceNote | null> => {
    const recording = recordingRef.current;

    if (!recording) {
      return null;
    }

    recordingRef.current = null;

    if (mountedRef.current) {
      setIsRecorderBusy(true);
    }

    try {
      const status = await recording.stopAndUnloadAsync();

      const uri = recording.getURI();

      if (!uri) {
        throw new Error('The recorded audio file could not be created.');
      }

      const durationMillis = status.durationMillis || recordingSeconds * 1000;

      if (durationMillis < MIN_VOICE_DURATION_MILLIS) {
        throw new Error('Record for at least one second before sending.');
      }

      const durationSeconds = Math.max(1, Math.ceil(durationMillis / 1000));

      if (durationSeconds > MAX_VOICE_DURATION_SECONDS) {
        throw new Error('Voice messages cannot be longer than 5 minutes.');
      }

      return {
        uri,
        durationSeconds,
        mimeType: 'audio/mp4',
        fileName: `voice-message-${Date.now()}.m4a`,
      };
    } catch (error) {
      const message = error instanceof Error ? error.message : '';

      if (message.includes('E_AUDIO_NODATA')) {
        throw new Error(
          'No audio was recorded. Hold the microphone button a little longer and try again.'
        );
      }

      throw error instanceof Error
        ? error
        : new Error('The voice recording could not be completed.');
    } finally {
      await restorePlaybackAudioMode();
      resetRecorderState();
    }
  }, [recordingSeconds, resetRecorderState]);

  return {
    isRecording,
    isRecorderBusy,
    recordingSeconds,
    startRecording,
    cancelRecording,
    finishRecording,
  };
};
