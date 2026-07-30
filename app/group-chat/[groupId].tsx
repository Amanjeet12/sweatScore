import { Image } from 'expo-image';
import { router, Stack, useLocalSearchParams } from 'expo-router';
import {
  ArrowBendUpLeft,
  ArrowLeft,
  At,
  Camera,
  Check,
  Checks,
  FileText,
  ImageSquare,
  Info,
  Link as LinkIcon,
  MagnifyingGlass,
  Microphone,
  PaperPlaneRight,
  Pause,
  Play,
  Plus,
  Smiley,
  VideoCamera,
  X,
} from 'phosphor-react-native';
import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import {
  Alert,
  Dimensions,
  FlatList,
  Keyboard,
  KeyboardAvoidingView,
  Linking,
  Platform,
  Pressable,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import SafeAreaView from '~/components/core/SafeAreaView';
import { Text } from '~/components/ui/text';

type MessageType = 'text' | 'image' | 'link' | 'voice';

type MessageReaction = {
  emoji: string;
  count: number;
  reactedByMe?: boolean;
};

type ReplyDetails = {
  senderName: string;
  text: string;
};

type ChatMessage = {
  id: string;
  senderId: string;
  senderName: string;
  senderInitial: string;
  senderColor: string;
  type: MessageType;
  text?: string;
  time: string;
  isMine?: boolean;
  deliveryStatus?: 'sent' | 'delivered' | 'read';
  imageUrl?: string;
  linkTitle?: string;
  linkUrl?: string;
  voiceDuration?: number;
  reactions?: MessageReaction[];
  replyTo?: ReplyDetails;
  seenBy?: Array<{
    initial: string;
    color: string;
  }>;
};

const CURRENT_USER = {
  id: 'current-user',
  name: 'Vikrant',
};

const REACTION_OPTIONS = ['🔥', '❤️', '💪', '😂', '👏'];

const MOCK_MESSAGES: ChatMessage[] = [
  {
    id: 'message-1',
    senderId: 'rachael',
    senderName: 'Rachael',
    senderInitial: 'R',
    senderColor: '#D97706',
    type: 'text',
    text: "Morning team! Who's up for a run after work? @Vikrant you in?",
    time: '8:32 AM',
  },
  {
    id: 'message-2',
    senderId: 'priya',
    senderName: 'Priya',
    senderInitial: 'P',
    senderColor: '#9F1239',
    type: 'image',
    text: 'Leg day done! Feeling strong 💪',
    imageUrl:
      'https://images.unsplash.com/photo-1581009146145-b5ef050c2e1e?auto=format&fit=crop&w=1000&q=80',
    time: '9:05 AM',
    reactions: [{ emoji: '🔥', count: 3 }],
  },
  {
    id: 'message-3',
    senderId: 'maya',
    senderName: 'Maya',
    senderInitial: 'M',
    senderColor: '#047857',
    type: 'link',
    text: 'This workout is perfect for today.',
    linkTitle: '10-Minute Full Body HIIT Workout (No Equipment)',
    linkUrl: 'https://sweatscore.com/workouts/full-body-hiit',
    time: '9:28 AM',
  },
  {
    id: 'message-4',
    senderId: 'jess',
    senderName: 'Jess',
    senderInitial: 'J',
    senderColor: '#7C3AED',
    type: 'voice',
    voiceDuration: 18,
    time: '9:42 AM',
  },
  {
    id: 'message-5',
    senderId: 'rachael',
    senderName: 'Rachael',
    senderInitial: 'R',
    senderColor: '#D97706',
    type: 'text',
    text: "Wow amazing! What's your secret? 🙌",
    replyTo: {
      senderName: 'Priya',
      text: 'Leg day done! Feeling strong 💪',
    },
    time: '9:45 AM',
  },
  {
    id: 'message-6',
    senderId: CURRENT_USER.id,
    senderName: CURRENT_USER.name,
    senderInitial: 'V',
    senderColor: '#F76B1C',
    type: 'text',
    text: "I'm joining the challenge today! 💪",
    time: '10:02 AM',
    isMine: true,
    deliveryStatus: 'read',
    seenBy: [
      { initial: 'R', color: '#D97706' },
      { initial: 'P', color: '#9F1239' },
      { initial: 'M', color: '#047857' },
    ],
  },
];

const formatDuration = (seconds = 0) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
};

const getReplyText = (message: ChatMessage) => {
  if (message.text) return message.text;
  if (message.type === 'image') return 'Photo';
  if (message.type === 'voice') return 'Voice note';
  if (message.type === 'link') return message.linkTitle || 'Link';
  return 'Message';
};

const MentionText = ({ children }: { children: string }) => {
  const sections = children.split(/(@[a-zA-Z0-9_]+)/g);

  return (
    <Text className="font-body text-[15px] leading-[22px] text-[#232323]">
      {sections.map((section, index) =>
        section.startsWith('@') ? (
          <Text key={`${section}-${index}`} className="font-body font-bold text-[#F35E16]">
            {section}
          </Text>
        ) : (
          <Fragment key={`${section}-${index}`}>{section}</Fragment>
        )
      )}
    </Text>
  );
};

const Avatar = ({
  initial,
  color,
  size = 36,
}: {
  initial: string;
  color: string;
  size?: number;
}) => (
  <View
    style={[
      styles.avatar,
      {
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
      },
    ]}>
    <Text
      className="font-heading font-bold text-white"
      style={{ fontSize: Math.max(10, size * 0.38) }}>
      {initial}
    </Text>
  </View>
);

const VoiceWaveform = ({ active }: { active: boolean }) => (
  <View className="mx-3 flex-1 flex-row items-center justify-center gap-[3px]">
    {[10, 18, 25, 14, 29, 20, 11, 24, 31, 17, 10, 22, 27, 14, 20, 10].map((height, index) => (
      <View
        key={`${height}-${index}`}
        style={{
          width: 3,
          height,
          borderRadius: 2,
          backgroundColor: active && index < 8 ? '#F76B1C' : '#C8C8C8',
        }}
      />
    ))}
  </View>
);

export default function GroupChatScreen() {
  const { groupId } = useLocalSearchParams<{ groupId: string }>();
  const listRef = useRef<FlatList<ChatMessage>>(null);
  const recordingInterval = useRef<ReturnType<typeof setInterval> | null>(null);
  const fullWindowHeightRef = useRef(Dimensions.get('window').height);

  const [messages, setMessages] = useState<ChatMessage[]>(MOCK_MESSAGES);
  const [messageText, setMessageText] = useState('');
  const [replyingTo, setReplyingTo] = useState<ChatMessage | null>(null);
  const [actionMessageId, setActionMessageId] = useState<string | null>(null);
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [playingVoiceId, setPlayingVoiceId] = useState<string | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchText, setSearchText] = useState('');
  const [androidKeyboardInset, setAndroidKeyboardInset] = useState(0);
  const insets = useSafeAreaInsets();

  useEffect(() => {
    return () => {
      if (recordingInterval.current) {
        clearInterval(recordingInterval.current);
      }
    };
  }, []);

  const visibleMessages = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    if (!query) return messages;

    return messages.filter((message) => {
      const searchableText = [
        message.senderName,
        message.text,
        message.linkTitle,
        message.replyTo?.text,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase();

      return searchableText.includes(query);
    });
  }, [messages, searchText]);

  const stopRecordingTimer = () => {
    if (recordingInterval.current) {
      clearInterval(recordingInterval.current);
      recordingInterval.current = null;
    }
  };

  const scrollToLatest = () => {
    requestAnimationFrame(() => {
      listRef.current?.scrollToEnd({ animated: true });
    });
  };

  useEffect(() => {
    const keyboardShowSubscription = Keyboard.addListener('keyboardDidShow', (event) => {
      if (Platform.OS === 'android') {
        /*
         * A native/dev build using adjustResize already reduces the window.
         * Expo Go or an older build might not. Add only the keyboard height
         * that Android did not remove from the window so the composer is
         * never covered and is not lifted twice.
         */
        const currentWindowHeight = Dimensions.get('window').height;
        const nativeResizeAmount = Math.max(0, fullWindowHeightRef.current - currentWindowHeight);
        const missingInset = Math.max(0, event.endCoordinates.height - nativeResizeAmount);

        setAndroidKeyboardInset(missingInset);
      }

      setTimeout(scrollToLatest, 80);
    });

    const keyboardHideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setAndroidKeyboardInset(0);
      fullWindowHeightRef.current = Dimensions.get('window').height;
    });

    return () => {
      keyboardShowSubscription.remove();
      keyboardHideSubscription.remove();
    };
  }, []);

  const sendTextMessage = () => {
    const cleanMessage = messageText.trim();
    if (!cleanMessage) return;

    const newMessage: ChatMessage = {
      id: `local-text-${Date.now()}`,
      senderId: CURRENT_USER.id,
      senderName: CURRENT_USER.name,
      senderInitial: 'V',
      senderColor: '#F76B1C',
      type: 'text',
      text: cleanMessage,
      time: new Date().toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
      }),
      isMine: true,
      deliveryStatus: 'read',
      replyTo: replyingTo
        ? {
            senderName: replyingTo.senderName,
            text: getReplyText(replyingTo),
          }
        : undefined,
    };

    setMessages((current) => [...current, newMessage]);
    setMessageText('');
    setReplyingTo(null);
    setAttachmentMenuOpen(false);
    scrollToLatest();
  };

  const toggleRecording = () => {
    if (isRecording) {
      const duration = Math.max(recordingSeconds, 1);

      stopRecordingTimer();
      setIsRecording(false);
      setRecordingSeconds(0);
      setMessages((current) => [
        ...current,
        {
          id: `local-voice-${Date.now()}`,
          senderId: CURRENT_USER.id,
          senderName: CURRENT_USER.name,
          senderInitial: 'V',
          senderColor: '#F76B1C',
          type: 'voice',
          voiceDuration: duration,
          time: new Date().toLocaleTimeString([], {
            hour: 'numeric',
            minute: '2-digit',
          }),
          isMine: true,
          deliveryStatus: 'sent',
          replyTo: replyingTo
            ? {
                senderName: replyingTo.senderName,
                text: getReplyText(replyingTo),
              }
            : undefined,
        },
      ]);
      setReplyingTo(null);
      scrollToLatest();
      return;
    }

    setAttachmentMenuOpen(false);
    setIsRecording(true);
    setRecordingSeconds(0);
    recordingInterval.current = setInterval(() => {
      setRecordingSeconds((seconds) => seconds + 1);
    }, 1000);
  };

  const cancelRecording = () => {
    stopRecordingTimer();
    setIsRecording(false);
    setRecordingSeconds(0);
  };

  const selectReply = (message: ChatMessage) => {
    setReplyingTo(message);
    setActionMessageId(null);
    setAttachmentMenuOpen(false);
  };

  const addReaction = (messageId: string, emoji: string) => {
    setMessages((current) =>
      current.map((message) => {
        if (message.id !== messageId) return message;

        const reactions = [...(message.reactions || [])];
        const existingIndex = reactions.findIndex((reaction) => reaction.emoji === emoji);

        if (existingIndex >= 0) {
          const existing = reactions[existingIndex];
          reactions[existingIndex] = {
            ...existing,
            count: existing.reactedByMe ? Math.max(existing.count - 1, 0) : existing.count + 1,
            reactedByMe: !existing.reactedByMe,
          };
        } else {
          reactions.push({
            emoji,
            count: 1,
            reactedByMe: true,
          });
        }

        return {
          ...message,
          reactions: reactions.filter((reaction) => reaction.count > 0),
        };
      })
    );

    setActionMessageId(null);
  };

  const insertAtCursor = (value: string) => {
    setMessageText((current) => `${current}${current ? ' ' : ''}${value}`);
  };

  const handleAttachment = (label: string) => {
    setAttachmentMenuOpen(false);
    Alert.alert(`${label} selected`, `The ${label.toLowerCase()} picker will be connected next.`);
  };

  const renderDeliveryStatus = (message: ChatMessage) => {
    if (!message.isMine) return null;

    if (message.deliveryStatus === 'read') {
      return <Checks size={15} color="#FFFFFF" weight="bold" />;
    }

    if (message.deliveryStatus === 'delivered') {
      return <Checks size={15} color="#FFE5D7" weight="bold" />;
    }

    return <Check size={15} color="#FFE5D7" weight="bold" />;
  };

  const renderReplyPreview = (reply: ReplyDetails, isMine = false) => (
    <View
      className="mb-2 overflow-hidden rounded-xl"
      style={{
        backgroundColor: isMine ? 'rgba(255,255,255,0.18)' : '#FFF5EE',
      }}>
      <View className="border-l-[3px] border-[#F76B1C] px-3 py-2">
        <Text
          className="font-body text-xs font-bold"
          style={{ color: isMine ? '#FFFFFF' : '#F35E16' }}>
          {reply.senderName}
        </Text>
        <Text
          className="mt-0.5 font-body text-xs"
          numberOfLines={1}
          style={{ color: isMine ? '#FFF3EC' : '#545454' }}>
          {reply.text}
        </Text>
      </View>
    </View>
  );

  const renderMessageContent = (message: ChatMessage) => {
    const isMine = Boolean(message.isMine);

    return (
      <>
        {message.replyTo ? renderReplyPreview(message.replyTo, isMine) : null}

        {message.type === 'image' && message.imageUrl ? (
          <Image
            source={{ uri: message.imageUrl }}
            style={styles.messageImage}
            contentFit="cover"
            transition={200}
          />
        ) : null}

        {message.type === 'link' ? (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={() => {
              if (message.linkUrl) {
                Linking.openURL(message.linkUrl);
              }
            }}
            className="mb-1 flex-row items-center overflow-hidden rounded-xl border border-[#E9E4E0] bg-white">
            <View className="h-[78px] w-[76px] items-center justify-center bg-[#FFF3EA]">
              <LinkIcon size={29} color="#F76B1C" weight="bold" />
            </View>
            <View className="flex-1 px-3 py-2.5">
              <Text className="font-body text-[14px] font-bold leading-[19px] text-[#1F1F1F]">
                {message.linkTitle}
              </Text>
              <Text className="mt-1 font-body text-xs text-[#747474]" numberOfLines={1}>
                {message.linkUrl?.replace(/^https?:\/\//, '')}
              </Text>
            </View>
          </TouchableOpacity>
        ) : null}

        {message.type === 'voice' ? (
          <View className="min-w-[235px] flex-row items-center py-1">
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() =>
                setPlayingVoiceId((current) => (current === message.id ? null : message.id))
              }
              className="h-10 w-10 items-center justify-center rounded-full"
              style={{ backgroundColor: isMine ? '#FFFFFF' : '#F76B1C' }}>
              {playingVoiceId === message.id ? (
                <Pause size={18} color={isMine ? '#F76B1C' : '#FFFFFF'} weight="fill" />
              ) : (
                <Play size={18} color={isMine ? '#F76B1C' : '#FFFFFF'} weight="fill" />
              )}
            </TouchableOpacity>

            <VoiceWaveform active={playingVoiceId === message.id} />

            <Text className="font-body text-xs" style={{ color: isMine ? '#FFFFFF' : '#555555' }}>
              {formatDuration(message.voiceDuration)}
            </Text>
          </View>
        ) : null}

        {message.text ? (
          <View
            className={message.type === 'image' ? 'mt-2' : message.type === 'link' ? 'mt-2' : ''}>
            {isMine ? (
              <Text className="font-body text-[15px] leading-[22px] text-white">
                {message.text}
              </Text>
            ) : (
              <MentionText>{message.text}</MentionText>
            )}
          </View>
        ) : null}

        <View className="mt-1 flex-row items-center justify-end gap-x-1">
          <Text className="font-body text-[10px]" style={{ color: isMine ? '#FFF0E8' : '#7D7D7D' }}>
            {message.time}
          </Text>
          {renderDeliveryStatus(message)}
        </View>
      </>
    );
  };

  const renderMessage = ({ item }: { item: ChatMessage }) => {
    const isMine = Boolean(item.isMine);
    const isActionOpen = actionMessageId === item.id;

    return (
      <View className="mb-4 px-4">
        <View
          className="flex-row items-end"
          style={{ justifyContent: isMine ? 'flex-end' : 'flex-start' }}>
          {!isMine ? (
            <View className="mr-2 self-start pt-5">
              <Avatar initial={item.senderInitial} color={item.senderColor} size={35} />
            </View>
          ) : null}

          <View
            style={{
              maxWidth: '82%',
              alignItems: isMine ? 'flex-end' : 'flex-start',
            }}>
            {!isMine ? (
              <Text className="mb-1 ml-1 font-body text-xs font-bold text-[#F35E16]">
                {item.senderName}
              </Text>
            ) : null}

            <Pressable
              onLongPress={() =>
                setActionMessageId((current) => (current === item.id ? null : item.id))
              }
              delayLongPress={250}
              style={[
                styles.messageBubble,
                isMine ? styles.myMessageBubble : styles.otherMessageBubble,
              ]}>
              {renderMessageContent(item)}
            </Pressable>

            {item.reactions?.length ? (
              <View
                className="-mt-2 flex-row items-center rounded-full border border-[#EEE3DC] bg-white px-2 py-1"
                style={styles.reactionPill}>
                {item.reactions.map((reaction) => (
                  <TouchableOpacity
                    key={reaction.emoji}
                    activeOpacity={0.75}
                    onPress={() => addReaction(item.id, reaction.emoji)}
                    className="mr-1 flex-row items-center">
                    <Text className="text-sm">{reaction.emoji}</Text>
                    <Text
                      className="ml-0.5 font-body text-xs font-semibold"
                      style={{
                        color: reaction.reactedByMe ? '#F35E16' : '#484848',
                      }}>
                      {reaction.count}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

            {isActionOpen ? (
              <View
                className="mt-2 flex-row items-center rounded-full border border-[#EDE5DF] bg-white p-1.5"
                style={styles.messageActions}>
                {REACTION_OPTIONS.map((emoji) => (
                  <TouchableOpacity
                    key={emoji}
                    activeOpacity={0.7}
                    onPress={() => addReaction(item.id, emoji)}
                    className="h-8 w-8 items-center justify-center rounded-full">
                    <Text className="text-lg">{emoji}</Text>
                  </TouchableOpacity>
                ))}
                <View className="mx-1 h-6 w-px bg-[#E8E2DE]" />
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => selectReply(item)}
                  className="h-8 w-8 items-center justify-center rounded-full bg-[#FFF1E8]">
                  <ArrowBendUpLeft size={17} color="#F35E16" weight="bold" />
                </TouchableOpacity>
              </View>
            ) : null}

            {item.seenBy?.length ? (
              <View className="mt-2 flex-row items-center">
                <View className="flex-row">
                  {item.seenBy.map((member, index) => (
                    <View
                      key={`${member.initial}-${index}`}
                      style={{ marginLeft: index === 0 ? 0 : -6 }}>
                      <Avatar initial={member.initial} color={member.color} size={22} />
                    </View>
                  ))}
                </View>
                <Text className="ml-1.5 font-body text-[10px] text-[#828282]">Seen by 3</Text>
              </View>
            ) : null}
          </View>
        </View>
      </View>
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-white">
      <Stack.Screen options={{ headerShown: false }} />
      <View
        className="flex-1"
        style={{
          paddingTop: Platform.OS === 'android' ? insets.top + 8 : 8,
        }}>
        <KeyboardAvoidingView
          className="flex-1"
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
          keyboardVerticalOffset={0}
          style={{
            flex: 1,
            paddingBottom: Platform.OS === 'android' ? androidKeyboardInset : 0,
          }}>
          <View className="border-b border-[#EEE8E3] bg-white px-4 py-3">
            {searchOpen ? (
              <View className="flex-row items-center">
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => {
                    setSearchOpen(false);
                    setSearchText('');
                  }}
                  className="mr-2 h-10 w-10 items-center justify-center">
                  <ArrowLeft size={24} color="#1E1E1E" weight="bold" />
                </TouchableOpacity>

                <View className="h-11 flex-1 flex-row items-center rounded-full bg-[#F5F3F1] px-4">
                  <MagnifyingGlass size={19} color="#777777" weight="bold" />
                  <TextInput
                    autoFocus
                    value={searchText}
                    onChangeText={setSearchText}
                    placeholder="Search messages"
                    placeholderTextColor="#929292"
                    className="ml-2 flex-1 font-body text-[15px] text-[#232323]"
                    selectionColor="#F76B1C"
                  />
                  {searchText ? (
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => setSearchText('')}
                      className="h-7 w-7 items-center justify-center">
                      <X size={17} color="#6F6F6F" weight="bold" />
                    </TouchableOpacity>
                  ) : null}
                </View>
              </View>
            ) : (
              <View className="flex-row items-center">
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => router.back()}
                  className="mr-1 h-10 w-10 items-center justify-center">
                  <ArrowLeft size={25} color="#171717" weight="bold" />
                </TouchableOpacity>

                <View className="mr-3 h-11 w-11">
                  <View style={[styles.headerAvatar, { left: 0, backgroundColor: '#D97706' }]}>
                    <Text className="text-[10px] font-bold text-white">R</Text>
                  </View>
                  <View style={[styles.headerAvatar, { right: 0, backgroundColor: '#9F1239' }]}>
                    <Text className="text-[10px] font-bold text-white">P</Text>
                  </View>
                  <View
                    style={[
                      styles.headerAvatar,
                      { bottom: 0, left: 12, backgroundColor: '#047857' },
                    ]}>
                    <Text className="text-[10px] font-bold text-white">M</Text>
                  </View>
                </View>

                <View className="flex-1">
                  <Text
                    className="font-heading text-[18px] font-extrabold text-[#191919]"
                    numberOfLines={1}>
                    Sweat Sisters
                  </Text>
                  <Text className="font-body text-xs text-[#F35E16]">Rachael is typing...</Text>
                </View>

                

                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() =>
                    Alert.alert(
                      'Sweat Sisters',
                      `Group ID: ${groupId || 'local-preview'}\n8 members`
                    )
                  }
                  className="ml-1 h-10 w-10 items-center justify-center">
                  <Info size={24} color="#1D1D1D" weight="bold" />
                </TouchableOpacity>
              </View>
            )}
          </View>

          <FlatList
            ref={listRef}
            data={visibleMessages}
            keyExtractor={(item) => item.id}
            renderItem={renderMessage}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
            keyboardDismissMode={Platform.OS === 'ios' ? 'interactive' : 'on-drag'}
            contentContainerStyle={styles.messageList}
            ListHeaderComponent={
              <View className="mb-5 items-center">
                <View className="rounded-full border border-[#ECE7E3] bg-[#F8F7F6] px-4 py-1.5">
                  <Text className="font-body text-xs font-semibold text-[#5D5D5D]">Today</Text>
                </View>
              </View>
            }
            ListEmptyComponent={
              <View className="items-center px-8 py-16">
                <Text className="font-heading text-lg font-bold text-[#2B2B2B]">
                  No messages found
                </Text>
                <Text className="mt-1 text-center font-body text-sm text-[#777777]">
                  Try another search.
                </Text>
              </View>
            }
            onContentSizeChange={() => {
              if (!searchText) {
                listRef.current?.scrollToEnd({ animated: false });
              }
            }}
          />

          <View className="border-t border-[#EFE8E3] bg-white">
            {attachmentMenuOpen ? (
              <View className="flex-row justify-around border-b border-[#F2ECE8] px-4 py-3">
                {[
                  { label: 'Photo', Icon: ImageSquare, color: '#F35E16' },
                  { label: 'Video', Icon: VideoCamera, color: '#7C3AED' },
                  { label: 'Camera', Icon: Camera, color: '#047857' },
                  // { label: 'File', Icon: FileText, color: '#2563EB' },
                ].map(({ label, Icon, color }) => (
                  <TouchableOpacity
                    key={label}
                    activeOpacity={0.75}
                    onPress={() => handleAttachment(label)}
                    className="items-center">
                    <View
                      className="h-11 w-11 items-center justify-center rounded-full"
                      style={{ backgroundColor: `${color}14` }}>
                      <Icon size={21} color={color} weight="bold" />
                    </View>
                    <Text className="mt-1 font-body text-[10px] font-semibold text-[#565656]">
                      {label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            ) : null}

            {replyingTo ? (
              <View className="mx-3 mt-2 flex-row items-center overflow-hidden rounded-xl border border-[#F3D7C7] bg-[#FFF8F4]">
                <View className="h-full w-1 bg-[#F76B1C]" />
                <ArrowBendUpLeft
                  size={20}
                  color="#F35E16"
                  weight="bold"
                  style={{ marginHorizontal: 10 }}
                />
                <View className="flex-1 py-2">
                  <Text className="font-body text-xs font-bold text-[#F35E16]">
                    Replying to {replyingTo.senderName}
                  </Text>
                  <Text className="mt-0.5 font-body text-xs text-[#505050]" numberOfLines={1}>
                    {getReplyText(replyingTo)}
                  </Text>
                </View>
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => setReplyingTo(null)}
                  className="h-10 w-10 items-center justify-center">
                  <X size={18} color="#6B6B6B" weight="bold" />
                </TouchableOpacity>
              </View>
            ) : null}

            <View className="flex-row items-end px-3 pb-2 pt-2">
              {isRecording ? (
                <View className="flex-1 flex-row items-center rounded-full border border-[#F0D9CC] bg-[#FFF8F4] px-3 py-2.5">
                  <View className="mr-2 h-2.5 w-2.5 rounded-full bg-[#F04438]" />
                  <Text className="font-body text-sm font-semibold text-[#252525]">
                    {formatDuration(recordingSeconds)}
                  </Text>
                  <Text className="ml-3 flex-1 font-body text-xs text-[#777777]">
                    Recording voice note
                  </Text>
                  <TouchableOpacity
                    activeOpacity={0.7}
                    onPress={cancelRecording}
                    className="px-2 py-1">
                    <Text className="font-body text-xs font-bold text-[#D04437]">Cancel</Text>
                  </TouchableOpacity>
                </View>
              ) : (
                <>
                  <TouchableOpacity
                    activeOpacity={0.75}
                    onPress={() => setAttachmentMenuOpen((current) => !current)}
                    className="mr-2 h-11 w-11 items-center justify-center rounded-full border border-[#E8E2DE] bg-[#FAF9F8]">
                    {attachmentMenuOpen ? (
                      <X size={21} color="#F35E16" weight="bold" />
                    ) : (
                      <Plus size={23} color="#2A2A2A" weight="bold" />
                    )}
                  </TouchableOpacity>

                  <View className="min-h-11 flex-1 flex-row items-end rounded-[23px] border border-[#DDD7D3] bg-white pl-4 pr-1.5">
                    <TextInput
                      value={messageText}
                      onChangeText={setMessageText}
                      placeholder="Message Sweat Sisters"
                      placeholderTextColor="#8A8A8A"
                      multiline
                      maxLength={2000}
                      onFocus={scrollToLatest}
                      className="max-h-28 min-h-11 flex-1 py-3 font-body text-[15px] text-[#242424]"
                      selectionColor="#F76B1C"
                    />
                    {/* <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => insertAtCursor('@')}
                      className="h-10 w-9 items-center justify-center">
                      <At size={21} color="#2C2C2C" weight="bold" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      activeOpacity={0.7}
                      onPress={() => insertAtCursor('💪')}
                      className="h-10 w-9 items-center justify-center">
                      <Smiley size={22} color="#2C2C2C" weight="bold" />
                    </TouchableOpacity> */}
                  </View>
                </>
              )}

              {messageText.trim() && !isRecording ? (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={sendTextMessage}
                  className="ml-2 h-11 w-11 items-center justify-center rounded-full bg-[#F76B1C]"
                  style={styles.sendButton}>
                  <PaperPlaneRight size={21} color="#FFFFFF" weight="fill" />
                </TouchableOpacity>
              ) : (
                <TouchableOpacity
                  activeOpacity={0.8}
                  onPress={toggleRecording}
                  className="ml-2 h-11 w-11 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: isRecording ? '#F76B1C' : '#FFF1E8',
                  }}>
                  {isRecording ? (
                    <PaperPlaneRight size={20} color="#FFFFFF" weight="fill" />
                  ) : (
                    <Microphone size={21} color="#F35E16" weight="bold" />
                  )}
                </TouchableOpacity>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 2,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
  },
  headerAvatar: {
    position: 'absolute',
    width: 27,
    height: 27,
    borderRadius: 14,
    borderWidth: 2,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  messageList: {
    paddingTop: 16,
    paddingBottom: 8,
  },
  messageBubble: {
    minWidth: 90,
    borderRadius: 18,
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  myMessageBubble: {
    backgroundColor: '#F76B1C',
    borderBottomRightRadius: 5,
  },
  otherMessageBubble: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E7E2DE',
    borderBottomLeftRadius: 5,
  },
  messageImage: {
    width: 250,
    height: 148,
    borderRadius: 12,
    backgroundColor: '#F0ECE9',
  },
  reactionPill: {
    shadowColor: '#352219',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 5,
    elevation: 2,
  },
  messageActions: {
    shadowColor: '#352219',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 9,
    elevation: 5,
  },
  sendButton: {
    shadowColor: '#F76B1C',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 7,
    elevation: 5,
  },
});
