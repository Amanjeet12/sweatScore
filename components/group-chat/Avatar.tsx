import { Fragment } from "react";
import { View } from "react-native";

import { Text } from "~/components/ui/text";

type AvatarProps = {
  initial: string;
  color: string;
  size?: number;
};

export const Avatar = ({ initial, color, size = 36 }: AvatarProps) => (
  <View
    className="items-center justify-center overflow-hidden border-2 border-white"
    style={{
      width: size,
      height: size,
      borderRadius: size / 2,
      backgroundColor: color,
    }}
  >
    <Text
      className="font-heading font-bold text-white"
      style={{ fontSize: Math.max(10, size * 0.38) }}
    >
      {initial}
    </Text>
  </View>
);

export const MentionText = ({ children }: { children: string }) => {
  const sections = children.split(/(@[a-zA-Z0-9_]+)/g);

  return (
    <Text className="font-body text-[15px] leading-[22px] text-[#232323]">
      {sections.map((section, index) =>
        section.startsWith("@") ? (
          <Text
            key={`${section}-${index}`}
            className="font-body font-bold text-[#F35E16]"
          >
            {section}
          </Text>
        ) : (
          <Fragment key={`${section}-${index}`}>{section}</Fragment>
        ),
      )}
    </Text>
  );
};
