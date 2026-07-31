import { Pause, Play } from "phosphor-react-native";
import { TouchableOpacity, View } from "react-native";

import { Text } from "~/components/ui/text";
import { formatDuration } from "~/utils/chat";

const WAVEFORM_HEIGHTS = [
  10, 18, 25, 14, 29, 20, 11, 24, 31, 17, 10, 22, 27, 14, 20, 10,
];

type VoiceMessageProps = {
  duration?: number;
  isMine: boolean;
  isPlaying: boolean;
  onTogglePlayback: () => void;
};

const VoiceMessage = ({
  duration,
  isMine,
  isPlaying,
  onTogglePlayback,
}: VoiceMessageProps) => (
  <View className="min-w-[235px] flex-row items-center py-1">
    <TouchableOpacity
      activeOpacity={0.75}
      onPress={onTogglePlayback}
      accessibilityRole="button"
      accessibilityLabel={isPlaying ? "Pause voice note" : "Play voice note"}
      className="h-10 w-10 items-center justify-center rounded-full"
      style={{ backgroundColor: isMine ? "#FFFFFF" : "#F76B1C" }}
    >
      {isPlaying ? (
        <Pause size={18} color={isMine ? "#F76B1C" : "#FFFFFF"} weight="fill" />
      ) : (
        <Play size={18} color={isMine ? "#F76B1C" : "#FFFFFF"} weight="fill" />
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
            backgroundColor:
              isPlaying && index < 8
                ? isMine
                  ? "#FFFFFF"
                  : "#F76B1C"
                : isMine
                  ? "#FFD9C5"
                  : "#C8C8C8",
          }}
        />
      ))}
    </View>

    <Text
      className="font-body text-xs"
      style={{ color: isMine ? "#FFFFFF" : "#555555" }}
    >
      {formatDuration(duration)}
    </Text>
  </View>
);

export default VoiceMessage;
