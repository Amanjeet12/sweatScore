import { Link as LinkIcon } from "phosphor-react-native";
import { Linking, TouchableOpacity, View } from "react-native";

import { Text } from "~/components/ui/text";

type LinkPreviewProps = {
  title?: string;
  url?: string;
};

const LinkPreview = ({ title, url }: LinkPreviewProps) => (
  <TouchableOpacity
    activeOpacity={0.8}
    disabled={!url}
    onPress={() => {
      if (url) void Linking.openURL(url);
    }}
    className="mb-1 flex-row items-center overflow-hidden rounded-xl border border-[#E9E4E0] bg-white"
  >
    <View className="h-[78px] w-[76px] items-center justify-center bg-[#FFF3EA]">
      <LinkIcon size={29} color="#F76B1C" weight="bold" />
    </View>
    <View className="flex-1 px-3 py-2.5">
      <Text className="font-body text-[14px] font-bold leading-[19px] text-[#1F1F1F]">
        {title || "Shared link"}
      </Text>
      <Text className="mt-1 font-body text-xs text-[#747474]" numberOfLines={1}>
        {url?.replace(/^https?:\/\//, "")}
      </Text>
    </View>
  </TouchableOpacity>
);

export default LinkPreview;
