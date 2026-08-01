import { Image } from 'expo-image';
import * as ImagePicker from 'expo-image-picker';
import { useVideoPlayer, VideoView } from 'expo-video';
import {
  ArrowBendUpLeft,
  Camera,
  ImageSquare,
  Microphone,
  PaperPlaneRight,
  Play,
  Plus,
  VideoCamera,
  WarningCircle,
  X,
} from 'phosphor-react-native';
import { useState } from 'react';
import {
  ActivityIndicator,
  Alert,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';

import { Text } from '~/components/ui/text';
import { useVoiceRecorder } from '~/hooks/chat/useVoiceRecorder';
import type { ChatAttachment, ChatMessage, PendingVoiceNote } from '~/types/chat';
import { formatDuration, getReplyText } from '~/utils/chat';

type ChatComposerProps = {
  groupName: string;
  replyingTo: ChatMessage | null;
  isUploadingAttachment: boolean;
  isUploadingVoice: boolean;
  onCancelReply: () => void;
  onFocus: () => void;
  onTypingChange: (isTyping: boolean) => void;

  onSendText: (text: string) => Promise<boolean> | boolean;

  onSendVoice: (voiceNote: PendingVoiceNote) => Promise<boolean> | boolean;

  onSendAttachment: (attachment: ChatAttachment, text?: string) => Promise<boolean> | boolean;
};

type AttachmentOption = {
  label: string;
  type: 'image' | 'video';
  source: 'library' | 'camera';
  Icon: typeof ImageSquare;
  color: string;
};

type PendingAttachmentPreviewProps = {
  attachment: ChatAttachment;
  disabled: boolean;
  isUploading: boolean;
  errorMessage: string | null;
  onChange: () => void;
  onRemove: () => void;
};

const ATTACHMENT_OPTIONS: AttachmentOption[] = [
  {
    label: 'Photo',
    type: 'image',
    source: 'library',
    Icon: ImageSquare,
    color: '#F35E16',
  },
  {
    label: 'Video',
    type: 'video',
    source: 'library',
    Icon: VideoCamera,
    color: '#7C3AED',
  },
  {
    label: 'Camera',
    type: 'image',
    source: 'camera',
    Icon: Camera,
    color: '#047857',
  },
];

const PendingVideoPreview = ({ uri }: { uri: string }) => {
  const player = useVideoPlayer(uri, (videoPlayer) => {
    videoPlayer.loop = false;
    videoPlayer.volume = 0;
    videoPlayer.pause();
  });

  return (
    <View style={styles.previewThumbnail}>
      <VideoView
        player={player}
        style={styles.previewMedia}
        contentFit="cover"
        nativeControls={false}
      />

      <View pointerEvents="none" className="absolute inset-0 items-center justify-center">
        <View className="h-9 w-9 items-center justify-center rounded-full bg-black/60">
          <Play size={16} color="#FFFFFF" weight="fill" />
        </View>
      </View>
    </View>
  );
};

const PendingAttachmentPreview = ({
  attachment,
  disabled,
  isUploading,
  errorMessage,
  onChange,
  onRemove,
}: PendingAttachmentPreviewProps) => {
  const isVideo = attachment.type === 'video';

  return (
    <View className="mx-3 mt-2 flex-row items-center rounded-2xl border border-[#E8DED8] bg-[#FFF9F5] p-2">
      <View className="h-20 w-20 overflow-hidden rounded-xl bg-black">
        {isVideo ? (
          <PendingVideoPreview uri={attachment.uri} />
        ) : (
          <Image
            source={{
              uri: attachment.uri,
            }}
            style={styles.previewMedia}
            contentFit="cover"
            transition={150}
          />
        )}

        {isUploading ? (
          <View pointerEvents="none" style={styles.previewUploadOverlay}>
            <ActivityIndicator size="small" color="#FFFFFF" />
          </View>
        ) : null}
      </View>

      <View className="ml-3 flex-1">
        <View className="flex-row items-center">
          {isVideo ? (
            <VideoCamera size={15} color="#7C3AED" weight="fill" />
          ) : (
            <ImageSquare size={15} color="#F35E16" weight="fill" />
          )}

          <Text className="ml-1.5 font-body text-[11px] font-bold uppercase text-[#555555]">
            {isUploading
              ? isVideo
                ? 'Uploading video'
                : 'Uploading photo'
              : isVideo
                ? 'Video selected'
                : 'Photo selected'}
          </Text>
        </View>

        <Text className="mt-1 font-body text-sm font-semibold text-[#252525]" numberOfLines={1}>
          {attachment.name || (isVideo ? 'Selected video' : 'Selected photo')}
        </Text>

        {isUploading ? (
          <View className="mt-1 flex-row items-center">
            <ActivityIndicator size="small" color="#F35E16" />

            <Text className="ml-2 font-body text-xs font-semibold text-[#F35E16]">
              Please wait…
            </Text>
          </View>
        ) : errorMessage ? (
          <View className="mt-1 flex-row items-start pr-2">
            <WarningCircle size={15} color="#D92D20" weight="fill" />

            <Text className="ml-1.5 flex-1 font-body text-xs leading-4 text-[#D92D20]">
              {errorMessage}
            </Text>
          </View>
        ) : (
          <TouchableOpacity
            activeOpacity={0.7}
            disabled={disabled}
            onPress={onChange}
            className="mt-1 self-start">
            <Text className="font-body text-xs font-bold text-[#F35E16]">Change</Text>
          </TouchableOpacity>
        )}
      </View>

      <TouchableOpacity
        activeOpacity={0.75}
        disabled={disabled}
        onPress={onRemove}
        accessibilityRole="button"
        accessibilityLabel="Remove selected attachment"
        className="h-9 w-9 items-center justify-center rounded-full bg-[#F2E9E4]"
        style={{
          opacity: disabled ? 0.45 : 1,
        }}>
        <X size={17} color="#4A4A4A" weight="bold" />
      </TouchableOpacity>
    </View>
  );
};

const ChatComposer = ({
  groupName,
  replyingTo,
  isUploadingAttachment,
  isUploadingVoice,
  onCancelReply,
  onFocus,
  onTypingChange,
  onSendText,
  onSendVoice,
  onSendAttachment,
}: ChatComposerProps) => {
  const [messageText, setMessageText] = useState('');

  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);

  const [pendingAttachment, setPendingAttachment] = useState<ChatAttachment | null>(null);

  const [attachmentError, setAttachmentError] = useState<string | null>(null);

  const [isSending, setIsSending] = useState(false);

  const {
    isRecording,
    isRecorderBusy,
    recordingSeconds,
    startRecording,
    cancelRecording,
    finishRecording,
  } = useVoiceRecorder();

  const isBusy = isSending || isUploadingAttachment || isUploadingVoice || isRecorderBusy;

  const showError = (title: string, error: unknown) => {
    Alert.alert(
      title,

      error instanceof Error ? error.message : 'Something went wrong. Please try again.'
    );
  };

  const handleSendText = async () => {
    const cleanText = messageText.trim();

    if (!cleanText || isBusy) {
      return;
    }

    setIsSending(true);

    try {
      const sent = await onSendText(cleanText);

      if (sent) {
        setMessageText('');
        setAttachmentMenuOpen(false);
      }
    } catch (error) {
      showError('Message not sent', error);
    } finally {
      setIsSending(false);
    }
  };

  const handleSendPendingAttachment = async () => {
    if (!pendingAttachment || isBusy) {
      return;
    }

    const cleanText = messageText.trim();

    setAttachmentError(null);
    setIsSending(true);

    try {
      const sent = await onSendAttachment(pendingAttachment, cleanText || undefined);

      if (sent) {
        setPendingAttachment(null);
        setMessageText('');
        setAttachmentMenuOpen(false);
        setAttachmentError(null);
      } else {
        setAttachmentError('Upload failed. Tap Send to retry.');
      }
    } catch (error) {
      setAttachmentError('Upload failed. Tap Send to retry.');

      showError('Attachment not sent', error);
    } finally {
      setIsSending(false);
    }
  };

  const handlePrimarySend = async () => {
    if (pendingAttachment) {
      await handleSendPendingAttachment();
      return;
    }

    await handleSendText();
  };

  const handleVoiceButton = async () => {
    if (isUploadingAttachment || isUploadingVoice || isSending || isRecorderBusy) {
      return;
    }

    if (!isRecording) {
      setAttachmentMenuOpen(false);
      onTypingChange(false);

      try {
        await startRecording();
      } catch (error) {
        showError('Recording error', error);
      }

      return;
    }

    try {
      const voiceNote = await finishRecording();

      if (!voiceNote) {
        return;
      }

      setIsSending(true);

      await onSendVoice(voiceNote);
    } catch (error) {
      showError('Voice message not sent', error);
    } finally {
      setIsSending(false);
    }
  };

  const requestPickerPermission = async (source: AttachmentOption['source']) => {
    if (source === 'camera') {
      const permission = await ImagePicker.requestCameraPermissionsAsync();

      if (!permission.granted) {
        Alert.alert('Camera permission required', 'Allow camera access to take and share a photo.');

        return false;
      }

      return true;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();

    if (!permission.granted) {
      Alert.alert('Photo permission required', 'Allow photo access to select images and videos.');

      return false;
    }

    return true;
  };

  const handleAttachment = async (option: AttachmentOption) => {
    if (isBusy || isRecording) {
      return;
    }

    setAttachmentMenuOpen(false);

    try {
      const hasPermission = await requestPickerPermission(option.source);

      if (!hasPermission) {
        return;
      }

      const pickerOptions: ImagePicker.ImagePickerOptions = {
        mediaTypes:
          option.type === 'video'
            ? ImagePicker.MediaTypeOptions.Videos
            : ImagePicker.MediaTypeOptions.Images,

        allowsEditing: false,
        allowsMultipleSelection: false,
        quality: 0.85,
        videoMaxDuration: 60,
      };

      const result =
        option.source === 'camera'
          ? await ImagePicker.launchCameraAsync(pickerOptions)
          : await ImagePicker.launchImageLibraryAsync(pickerOptions);

      if (result.canceled || !result.assets?.length) {
        return;
      }

      const asset = result.assets[0];

      if (!asset?.uri) {
        throw new Error('The selected attachment could not be read.');
      }

      const selectedType: 'image' | 'video' = asset.type === 'video' ? 'video' : option.type;

      const defaultFileName =
        selectedType === 'video' ? `chat-video-${Date.now()}.mp4` : `chat-photo-${Date.now()}.jpg`;

      const defaultMimeType = selectedType === 'video' ? 'video/mp4' : 'image/jpeg';

      setAttachmentError(null);

      setPendingAttachment({
        id: asset.assetId ?? `local-attachment-${Date.now()}`,

        type: selectedType,
        uri: asset.uri,

        name: asset.fileName ?? defaultFileName,

        mimeType: asset.mimeType ?? defaultMimeType,

        ...(typeof asset.fileSize === 'number'
          ? {
              sizeBytes: asset.fileSize,
            }
          : {}),
      });
    } catch (error) {
      showError('Attachment not selected', error);
    }
  };

  const handleMessageTextChange = (text: string) => {
    setMessageText(text);

    onTypingChange(Boolean(text.trim()));
  };

  const hasSendableContent = Boolean(messageText.trim() || pendingAttachment);

  return (
    <View className="border-t border-[#EFE8E3] bg-white">
      {attachmentMenuOpen ? (
        <View className="flex-row justify-around border-b border-[#F2ECE8] px-4 py-3">
          {ATTACHMENT_OPTIONS.map((option) => {
            const { label, Icon, color } = option;

            return (
              <TouchableOpacity
                key={label}
                activeOpacity={0.75}
                disabled={isBusy}
                onPress={() => void handleAttachment(option)}
                accessibilityRole="button"
                accessibilityLabel={`Attach ${label.toLowerCase()}`}
                className="items-center"
                style={{
                  opacity: isBusy ? 0.5 : 1,
                }}>
                <View
                  className="h-11 w-11 items-center justify-center rounded-full"
                  style={{
                    backgroundColor: `${color}14`,
                  }}>
                  <Icon size={21} color={color} weight="bold" />
                </View>

                <Text className="mt-1 font-body text-[10px] font-semibold text-[#565656]">
                  {label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      ) : null}

      {replyingTo ? (
        <View className="mx-3 mt-2 flex-row items-center overflow-hidden rounded-xl border border-[#F3D7C7] bg-[#FFF8F4]">
          <View className="h-full w-1 bg-[#F76B1C]" />

          <ArrowBendUpLeft
            size={20}
            color="#F35E16"
            weight="bold"
            style={{
              marginHorizontal: 10,
            }}
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
            disabled={isBusy}
            onPress={onCancelReply}
            accessibilityRole="button"
            accessibilityLabel="Cancel reply"
            className="h-10 w-10 items-center justify-center">
            <X size={18} color="#6B6B6B" weight="bold" />
          </TouchableOpacity>
        </View>
      ) : null}

      {pendingAttachment ? (
        <PendingAttachmentPreview
          attachment={pendingAttachment}
          disabled={isBusy}
          isUploading={isUploadingAttachment}
          errorMessage={attachmentError}
          onChange={() => {
            setAttachmentError(null);
            setAttachmentMenuOpen(true);
          }}
          onRemove={() => {
            setPendingAttachment(null);
            setAttachmentMenuOpen(false);
            setAttachmentError(null);
          }}
        />
      ) : null}

      <View className="flex-row items-end px-3 pb-2 pt-2">
        {isUploadingVoice ? (
          <View className="min-h-11 flex-1 flex-row items-center rounded-full border border-[#F0D9CC] bg-[#FFF8F4] px-4">
            <ActivityIndicator size="small" color="#F76B1C" />

            <Text className="ml-3 flex-1 font-body text-sm font-semibold text-[#4B4541]">
              Uploading voice message…
            </Text>
          </View>
        ) : isRecording ? (
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
              disabled={isRecorderBusy}
              onPress={() => void cancelRecording()}
              className="px-2 py-1">
              <Text className="font-body text-xs font-bold text-[#D04437]">Cancel</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <TouchableOpacity
              activeOpacity={0.75}
              disabled={isBusy}
              onPress={() => setAttachmentMenuOpen((current) => !current)}
              accessibilityRole="button"
              accessibilityLabel={
                attachmentMenuOpen ? 'Close attachment menu' : 'Open attachment menu'
              }
              className="mr-2 h-11 w-11 items-center justify-center rounded-full border border-[#E8E2DE] bg-[#FAF9F8]"
              style={{
                opacity: isBusy ? 0.5 : 1,
              }}>
              {attachmentMenuOpen ? (
                <X size={21} color="#F35E16" weight="bold" />
              ) : (
                <Plus size={23} color="#2A2A2A" weight="bold" />
              )}
            </TouchableOpacity>

            <View className="min-h-11 flex-1 flex-row items-end rounded-[23px] border border-[#DDD7D3] bg-white pl-4 pr-1.5">
              <TextInput
                value={messageText}
                editable={!isBusy}
                onChangeText={handleMessageTextChange}
                onBlur={() => onTypingChange(false)}
                placeholder={`Message ${groupName}`}
                placeholderTextColor="#8A8A8A"
                multiline
                maxLength={2000}
                onFocus={onFocus}
                className="max-h-28 min-h-11 flex-1 py-3 font-body text-[15px] text-[#242424]"
                selectionColor="#F76B1C"
              />
            </View>
          </>
        )}

        {isUploadingVoice ? (
          <View className="ml-2 h-11 w-11 items-center justify-center rounded-full bg-[#F76B1C]">
            <ActivityIndicator size="small" color="#FFFFFF" />
          </View>
        ) : isRecording ? (
          <TouchableOpacity
            activeOpacity={0.8}
            disabled={isRecorderBusy}
            onPress={() => void handleVoiceButton()}
            accessibilityRole="button"
            accessibilityLabel="Send voice note"
            className="ml-2 h-11 w-11 items-center justify-center rounded-full bg-[#F76B1C]"
            style={{
              opacity: isRecorderBusy ? 0.65 : 1,
            }}>
            {isRecorderBusy ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <PaperPlaneRight size={20} color="#FFFFFF" weight="fill" />
            )}
          </TouchableOpacity>
        ) : hasSendableContent ? (
          <TouchableOpacity
            activeOpacity={0.8}
            disabled={isBusy}
            onPress={() => void handlePrimarySend()}
            accessibilityRole="button"
            accessibilityLabel={pendingAttachment ? 'Send attachment' : 'Send message'}
            className="ml-2 h-11 w-11 items-center justify-center rounded-full bg-[#F76B1C]"
            style={[
              styles.sendButton,
              {
                opacity: isBusy ? 0.72 : 1,
              },
            ]}>
            {isUploadingAttachment ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <PaperPlaneRight size={21} color="#FFFFFF" weight="fill" />
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            activeOpacity={0.8}
            disabled={isBusy}
            onPress={() => void handleVoiceButton()}
            accessibilityRole="button"
            accessibilityLabel="Record voice note"
            className="ml-2 h-11 w-11 items-center justify-center rounded-full bg-[#FFF1E8]"
            style={{
              opacity: isBusy ? 0.65 : 1,
            }}>
            {isRecorderBusy ? (
              <ActivityIndicator size="small" color="#F35E16" />
            ) : (
              <Microphone size={21} color="#F35E16" weight="bold" />
            )}
          </TouchableOpacity>
        )}
      </View>
    </View>
  );
};

const styles = StyleSheet.create({
  sendButton: {
    shadowColor: '#F76B1C',

    shadowOffset: {
      width: 0,
      height: 4,
    },

    shadowOpacity: 0.28,
    shadowRadius: 7,
    elevation: 5,
  },

  previewThumbnail: {
    width: '100%',
    height: '100%',
    position: 'relative',
    backgroundColor: '#000000',
  },

  previewMedia: {
    width: '100%',
    height: '100%',
  },

  previewUploadOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0, 0, 0, 0.48)',
  },
});

export default ChatComposer;
