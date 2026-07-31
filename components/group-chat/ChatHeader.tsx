import { Image } from 'expo-image';
import { ArrowLeft, Info, MagnifyingGlass, X } from 'phosphor-react-native';
import { Alert, TextInput, TouchableOpacity, View } from 'react-native';

import TypingIndicator from '~/components/group-chat/TypingIndicator';
import { Text } from '~/components/ui/text';

type ChatHeaderProps = {
  groupId?: string;
  groupName: string;
  imageUrl?: string | null;
  memberCount: number;
  typingLabel?: string;
  searchOpen: boolean;
  searchText: string;
  onBack: () => void;
  onOpenSearch: () => void;
  onCloseSearch: () => void;
  onChangeSearch: (text: string) => void;
};

const ChatHeader = ({
  groupId,
  groupName,
  imageUrl,
  memberCount,
  typingLabel,
  searchOpen,
  searchText,
  onBack,
  onOpenSearch,
  onCloseSearch,
  onChangeSearch,
}: ChatHeaderProps) => {
  const groupInitial = groupName.trim().charAt(0).toUpperCase() || 'G';

  if (searchOpen) {
    return (
      <View className="border-b border-[#EEE8E3] bg-white px-4 py-3">
        <View className="flex-row items-center">
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={onCloseSearch}
            accessibilityRole="button"
            accessibilityLabel="Close message search"
            className="mr-2 h-10 w-10 items-center justify-center">
            <ArrowLeft size={24} color="#1E1E1E" weight="bold" />
          </TouchableOpacity>

          <View className="h-11 flex-1 flex-row items-center rounded-full bg-[#F5F3F1] px-4">
            <MagnifyingGlass size={19} color="#777777" weight="bold" />

            <TextInput
              autoFocus
              value={searchText}
              onChangeText={onChangeSearch}
              placeholder="Search messages"
              placeholderTextColor="#929292"
              className="ml-2 flex-1 font-body text-[15px] text-[#232323]"
              selectionColor="#F76B1C"
              returnKeyType="search"
            />

            {searchText ? (
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => onChangeSearch('')}
                accessibilityRole="button"
                accessibilityLabel="Clear message search"
                className="h-7 w-7 items-center justify-center">
                <X size={17} color="#6F6F6F" weight="bold" />
              </TouchableOpacity>
            ) : null}
          </View>
        </View>
      </View>
    );
  }

  return (
    <View className="border-b border-[#EEE8E3] bg-white px-4 py-3">
      <View className="flex-row items-center">
        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Go back"
          className="mr-1 h-10 w-10 items-center justify-center">
          <ArrowLeft size={25} color="#171717" weight="bold" />
        </TouchableOpacity>

        {/* Group image */}
        <View className="mr-3 h-11 w-11 overflow-hidden rounded-full bg-[#FFF0E7]">
          {imageUrl ? (
            <Image
              source={{ uri: imageUrl }}
              contentFit="cover"
              transition={150}
              style={{
                width: '100%',
                height: '100%',
              }}
            />
          ) : (
            <View className="h-full w-full items-center justify-center bg-[#F76B1C]">
              <Text className="text-lg font-bold text-white">{groupInitial}</Text>
            </View>
          )}
        </View>

        <View className="min-w-0 flex-1">
          <Text
            className="font-heading text-[18px] font-extrabold text-[#191919]"
            numberOfLines={1}
            ellipsizeMode="tail">
            {groupName}
          </Text>

          <TypingIndicator
            label={typingLabel}
            fallbackText={`${memberCount} ${memberCount === 1 ? 'member' : 'members'}`}
          />
        </View>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={onOpenSearch}
          accessibilityRole="button"
          accessibilityLabel="Search messages"
          className="h-10 w-10 items-center justify-center">
          <MagnifyingGlass size={22} color="#1D1D1D" weight="bold" />
        </TouchableOpacity>

        <TouchableOpacity
          activeOpacity={0.7}
          onPress={() =>
            Alert.alert(
              groupName,
              `Group ID: ${groupId || 'local-preview'}\n${memberCount} ${
                memberCount === 1 ? 'member' : 'members'
              }`
            )
          }
          accessibilityRole="button"
          accessibilityLabel="Group information"
          className="ml-1 h-10 w-10 items-center justify-center">
          <Info size={24} color="#1D1D1D" weight="bold" />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default ChatHeader;
