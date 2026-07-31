import { Image } from "expo-image";
import {
  useVideoPlayer,
  VideoView,
} from "expo-video";
import { FileText } from "phosphor-react-native";
import {
  Linking,
  StyleSheet,
  TouchableOpacity,
  View,
} from "react-native";

import { Text } from "~/components/ui/text";
import type { ChatAttachment } from "~/types/chat";

type MediaMessageProps = {
  attachment: ChatAttachment;
};

const VideoAttachment = ({
  attachment,
}: {
  attachment: ChatAttachment;
}) => {
  const player = useVideoPlayer(
    attachment.uri,
    (videoPlayer) => {
      videoPlayer.loop = false;
    },
  );

  return (
    <View style={styles.videoContainer}>
      <VideoView
        player={player}
        nativeControls
        contentFit="cover"
        style={styles.video}
      />
    </View>
  );
};

const MediaMessage = ({
  attachment,
}: MediaMessageProps) => {
  if (attachment.type === "video") {
    return (
      <VideoAttachment
        attachment={attachment}
      />
    );
  }

  if (attachment.type === "file") {
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => {
          void Linking.openURL(attachment.uri);
        }}
        className="min-w-[230px] flex-row items-center rounded-xl bg-[#FFF5EE] p-3"
      >
        <View className="h-11 w-11 items-center justify-center rounded-full bg-white">
          <FileText
            size={22}
            color="#F35E16"
            weight="bold"
          />
        </View>

        <View className="ml-3 flex-1">
          <Text
            className="font-body text-sm font-bold text-[#242424]"
            numberOfLines={1}
          >
            {attachment.name || "Shared file"}
          </Text>

          <Text className="mt-0.5 font-body text-xs text-[#737373]">
            Tap to open
          </Text>
        </View>
      </TouchableOpacity>
    );
  }

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() => {
        void Linking.openURL(attachment.uri);
      }}
      className="overflow-hidden rounded-xl"
    >
      <Image
        source={{
          uri: attachment.uri,
        }}
        style={styles.image}
        contentFit="cover"
        transition={200}
      />
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  image: {
    width: 250,
    height: 180,
    borderRadius: 12,
    backgroundColor: "#F0ECE9",
  },

  videoContainer: {
    width: 250,
    height: 180,
    overflow: "hidden",
    borderRadius: 12,
    backgroundColor: "#111111",
  },

  video: {
    width: "100%",
    height: "100%",
  },
});

export default MediaMessage;