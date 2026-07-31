import { useCallback, useEffect, useRef, useState } from "react";

import type { PendingVoiceNote } from "~/types/chat";

/**
 * UI-only voice recorder.
 *
 * Replace the timer and mock URI with expo-av/expo-audio recording later.
 * The component API can remain unchanged when the real recorder is added.
 */
export const useVoiceRecorder = () => {
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);

  const clearTimer = useCallback(() => {
    if (!intervalRef.current) return;

    clearInterval(intervalRef.current);
    intervalRef.current = null;
  }, []);

  useEffect(() => clearTimer, [clearTimer]);

  const startRecording = useCallback(() => {
    clearTimer();
    setRecordingSeconds(0);
    setIsRecording(true);

    intervalRef.current = setInterval(() => {
      setRecordingSeconds((seconds) => seconds + 1);
    }, 1000);
  }, [clearTimer]);

  const cancelRecording = useCallback(() => {
    clearTimer();
    setIsRecording(false);
    setRecordingSeconds(0);
  }, [clearTimer]);

  const finishRecording = useCallback((): PendingVoiceNote | null => {
    if (!isRecording) return null;

    const voiceNote = {
      uri: `mock://voice-note/${Date.now()}`,
      durationSeconds: Math.max(recordingSeconds, 1),
    };

    clearTimer();
    setIsRecording(false);
    setRecordingSeconds(0);

    return voiceNote;
  }, [clearTimer, isRecording, recordingSeconds]);

  return {
    isRecording,
    recordingSeconds,
    startRecording,
    cancelRecording,
    finishRecording,
  };
};
