import { Image } from "expo-image";
import { FileText, Play } from "phosphor-react-native";
import { Alert, StyleSheet, TouchableOpacity, View } from "react-native";

import { Text } from "~/components/ui/text";
import type { ChatAttachment } from "~/types/chat";

type MediaMessageProps = {
  attachment: ChatAttachment;
};

const MediaMessage = ({ attachment }: MediaMessageProps) => {
  if (attachment.type === "file") {
    return (
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() =>
          Alert.alert(
            attachment.name || "File",
            "File opening will be connected with Convex storage later.",
          )
        }
        className="min-w-[230px] flex-row items-center rounded-xl bg-[#FFF5EE] p-3"
      >
        <View className="h-11 w-11 items-center justify-center rounded-full bg-white">
          <FileText size={22} color="#F35E16" weight="bold" />
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

  const imageUri =
    attachment.type === "video"
      ? attachment.thumbnailUri || attachment.uri
      : attachment.uri;

  return (
    <TouchableOpacity
      activeOpacity={0.9}
      onPress={() =>
        Alert.alert(
          attachment.type === "video" ? "Video" : "Photo",
          "The full-screen media viewer will be connected later.",
        )
      }
      className="overflow-hidden rounded-xl"
    >
      <Image
        source={{ uri: imageUri }}
        style={styles.media}
        contentFit="cover"
        transition={200}
      />

      {attachment.type === "video" ? (
        <View className="absolute inset-0 items-center justify-center bg-black/20">
          <View className="h-12 w-12 items-center justify-center rounded-full bg-white/90">
            <Play size={23} color="#F76B1C" weight="fill" />
          </View>
        </View>
      ) : null}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  media: {
    width: 250,
    height: 148,
    borderRadius: 12,
    backgroundColor: "#F0ECE9",
  },
});

export default MediaMessage;
