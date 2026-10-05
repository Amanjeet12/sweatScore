import { CameraRotate, Microphone, MicrophoneSlash } from 'phosphor-react-native';
import { View, TouchableOpacity } from 'react-native';

import { prototypeTypography as type } from '~/components/core/design/prototypeStyles';
import { Text } from '~/components/ui/text';

export function RecordingOverlay({
  countdown,
  recording,
  elapsed,
  onFlip,
  audioMuted = false,
  onToggleAudio,
  top = 16,
  prototype = false,
}: {
  countdown?: number | null;
  recording: boolean;
  elapsed: number;
  onFlip: () => void;
  audioMuted?: boolean;
  onToggleAudio?: () => void;
  top?: number;
  prototype?: boolean;
}) {
  return (
    <>
      {onToggleAudio && (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel={audioMuted ? 'Unmute recording audio' : 'Mute recording audio'}
          accessibilityState={{ disabled: recording || !!countdown, selected: audioMuted }}
          disabled={recording || !!countdown}
          onPress={onToggleAudio}
          hitSlop={12}
          style={{
            position: 'absolute',
            top,
            left: 16,
            zIndex: 30,
            borderRadius: 23,
            paddingHorizontal: 12,
            height: 46,
            flexDirection: 'row',
            gap: 6,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.45)',
          }}>
          {audioMuted ? (
            <MicrophoneSlash size={22} color="#FFFFFF" weight="bold" />
          ) : (
            <Microphone size={22} color="#FFFFFF" weight="bold" />
          )}
          <Text
            className={prototype ? undefined : 'font-body text-xs font-semibold text-white'}
            style={prototype ? [type.smallCaption, { color: '#fff' }] : undefined}>
            {audioMuted ? 'Audio off' : 'Audio on'}
          </Text>
        </TouchableOpacity>
      )}
      {!recording && !countdown && (
        <TouchableOpacity
          accessibilityRole="button"
          accessibilityLabel="Flip camera"
          onPress={onFlip}
          hitSlop={12}
          style={{
            position: 'absolute',
            top,
            right: 16,
            zIndex: 30,
            width: 46,
            height: 46,
            borderRadius: 23,
            alignItems: 'center',
            justifyContent: 'center',
            backgroundColor: 'rgba(0,0,0,0.45)',
          }}>
          <CameraRotate size={26} color="#FFFFFF" weight="bold" />
        </TouchableOpacity>
      )}
      {countdown ? (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            top: 0,
            bottom: 0,
            left: 0,
            right: 0,
            alignItems: 'center',
            justifyContent: 'center',
          }}>
          <View
            style={{
              minWidth: 90,
              minHeight: 90,
              padding: prototype ? 18 : 0,
              borderRadius: 45,
              backgroundColor: 'rgba(0,0,0,0.55)',
              alignItems: 'center',
              justifyContent: 'center',
            }}>
            <Text
              accessibilityLiveRegion="polite"
              className={prototype ? undefined : 'font-heading text-4xl font-bold text-white'}
              style={
                prototype
                  ? [
                      type.planHeading,
                      { fontSize: 36, lineHeight: undefined, color: '#fff', textAlign: 'center' },
                    ]
                  : undefined
              }>
              {countdown}
            </Text>
          </View>
        </View>
      ) : null}
      {recording && (
        <View
          style={{
            position: 'absolute',
            top,
            right: 16,
            borderRadius: 12,
            backgroundColor: 'rgba(0,0,0,0.45)',
            paddingHorizontal: 14,
            paddingVertical: 7,
            flexDirection: 'row',
            alignItems: 'center',
            gap: 8,
          }}>
          <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#FF3B30' }} />
          <Text
            className={prototype ? undefined : 'font-body text-sm font-semibold text-white'}
            style={prototype ? [type.progressValue, { color: '#fff' }] : undefined}>
            Recording {elapsed}s
          </Text>
        </View>
      )}
    </>
  );
}
