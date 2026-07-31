import {
  ArrowBendUpLeft,
  At,
  Camera,
  FileText,
  ImageSquare,
  Microphone,
  PaperPlaneRight,
  Plus,
  Smiley,
  VideoCamera,
  X,
} from "phosphor-react-native";
import { useState } from "react";
import { StyleSheet, TextInput, TouchableOpacity, View } from "react-native";

import { Text } from "~/components/ui/text";
import { useVoiceRecorder } from "~/hooks/chat/useVoiceRecorder";
import type {
  ChatAttachment,
  ChatMessage,
  PendingVoiceNote,
} from "~/types/chat";
import { formatDuration, getReplyText } from "~/utils/chat";

type ChatComposerProps = {
  groupName: string;
  replyingTo: ChatMessage | null;
  onCancelReply: () => void;
  onFocus: () => void;
  onSendText: (text: string) => Promise<boolean> | boolean;
  onSendVoice: (voiceNote: PendingVoiceNote) => Promise<boolean> | boolean;
  onSendAttachment: (attachment: ChatAttachment) => Promise<boolean> | boolean;
};

type AttachmentOption = {
  label: string;
  type: ChatAttachment["type"];
  Icon: typeof ImageSquare;
  color: string;
};

const ATTACHMENT_OPTIONS: AttachmentOption[] = [
  { label: "Photo", type: "image", Icon: ImageSquare, color: "#F35E16" },
  { label: "Video", type: "video", Icon: VideoCamera, color: "#7C3AED" },
  { label: "Camera", type: "image", Icon: Camera, color: "#047857" },
  { label: "File", type: "file", Icon: FileText, color: "#2563EB" },
];

const createMockAttachment = (option: AttachmentOption): ChatAttachment => {
  const id = `local-file-${Date.now()}`;

  if (option.type === "file") {
    return {
      id,
      type: "file",
      uri: `mock://file/${id}`,
      name: "SweatScore-workout-plan.pdf",
      mimeType: "application/pdf",
      sizeBytes: 420_000,
    };
  }

  if (option.type === "video") {
    return {
      id,
      type: "video",
      uri: `mock://video/${id}`,
      name: "workout-video.mp4",
      mimeType: "video/mp4",
      thumbnailUri:
        "https://images.unsplash.com/photo-1517963879433-6ad2b056d712?auto=format&fit=crop&w=1000&q=80",
    };
  }

  return {
    id,
    type: "image",
    uri: "https://images.unsplash.com/photo-1518611012118-696072aa579a?auto=format&fit=crop&w=1000&q=80",
    name: option.label === "Camera" ? "camera-photo.jpg" : "workout-photo.jpg",
    mimeType: "image/jpeg",
  };
};

const ChatComposer = ({
  groupName,
  replyingTo,
  onCancelReply,
  onFocus,
  onSendText,
  onSendVoice,
  onSendAttachment,
}: ChatComposerProps) => {
  const [messageText, setMessageText] = useState("");
  const [attachmentMenuOpen, setAttachmentMenuOpen] = useState(false);
  const [isSending, setIsSending] = useState(false);

  const {
    isRecording,
    recordingSeconds,
    startRecording,
    cancelRecording,
    finishRecording,
  } = useVoiceRecorder();

  const insertComposerValue = (value: string) => {
    setMessageText((current) => `${current}${current ? " " : ""}${value}`);
  };

  const handleSendText = async () => {
    const cleanText = messageText.trim();
    if (!cleanText || isSending) return;

    setIsSending(true);
    const sent = await onSendText(cleanText);
    setIsSending(false);

    if (sent) {
      setMessageText("");
      setAttachmentMenuOpen(false);
    }
  };

  const handleVoiceButton = async () => {
    if (!isRecording) {
      setAttachmentMenuOpen(false);
      startRecording();
      return;
    }

    const voiceNote = finishRecording();
    if (!voiceNote) return;

    await onSendVoice(voiceNote);
  };

  const handleAttachment = async (option: AttachmentOption) => {
    setAttachmentMenuOpen(false);
    await onSendAttachment(createMockAttachment(option));
  };

  return (
    <View className="border-t border-[#EFE8E3] bg-white">
      {attachmentMenuOpen ? (
        <View className="flex-row justify-around border-b border-[#F2ECE8] px-4 py-3">
          {ATTACHMENT_OPTIONS.map(({ label, Icon, color, ...option }) => (
            <TouchableOpacity
              key={label}
              activeOpacity={0.75}
              onPress={() =>
                handleAttachment({ label, Icon, color, ...option })
              }
              accessibilityRole="button"
              accessibilityLabel={`Attach ${label.toLowerCase()}`}
              className="items-center"
            >
              <View
                className="h-11 w-11 items-center justify-center rounded-full"
                style={{ backgroundColor: `${color}14` }}
              >
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
            <Text
              className="mt-0.5 font-body text-xs text-[#505050]"
              numberOfLines={1}
            >
              {getReplyText(replyingTo)}
            </Text>
          </View>
          <TouchableOpacity
            activeOpacity={0.7}
            onPress={onCancelReply}
            accessibilityRole="button"
            accessibilityLabel="Cancel reply"
            className="h-10 w-10 items-center justify-center"
          >
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
              className="px-2 py-1"
            >
              <Text className="font-body text-xs font-bold text-[#D04437]">
                Cancel
              </Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <TouchableOpacity
              activeOpacity={0.75}
              onPress={() => setAttachmentMenuOpen((current) => !current)}
              accessibilityRole="button"
              accessibilityLabel={
                attachmentMenuOpen
                  ? "Close attachment menu"
                  : "Open attachment menu"
              }
              className="mr-2 h-11 w-11 items-center justify-center rounded-full border border-[#E8E2DE] bg-[#FAF9F8]"
            >
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
                placeholder={`Message ${groupName}`}
                placeholderTextColor="#8A8A8A"
                multiline
                maxLength={2000}
                onFocus={onFocus}
                className="max-h-28 min-h-11 flex-1 py-3 font-body text-[15px] text-[#242424]"
                selectionColor="#F76B1C"
              />
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => insertComposerValue("@")}
                accessibilityRole="button"
                accessibilityLabel="Insert mention"
                className="h-10 w-9 items-center justify-center"
              >
                <At size={21} color="#2C2C2C" weight="bold" />
              </TouchableOpacity>
              <TouchableOpacity
                activeOpacity={0.7}
                onPress={() => insertComposerValue("💪")}
                accessibilityRole="button"
                accessibilityLabel="Insert emoji"
                className="h-10 w-9 items-center justify-center"
              >
                <Smiley size={22} color="#2C2C2C" weight="bold" />
              </TouchableOpacity>
            </View>
          </>
        )}

        {messageText.trim() && !isRecording ? (
          <TouchableOpacity
            activeOpacity={0.8}
            disabled={isSending}
            onPress={handleSendText}
            accessibilityRole="button"
            accessibilityLabel="Send message"
            className="ml-2 h-11 w-11 items-center justify-center rounded-full bg-[#F76B1C]"
            style={[styles.sendButton, { opacity: isSending ? 0.65 : 1 }]}
          >
            <PaperPlaneRight size={21} color="#FFFFFF" weight="fill" />
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            activeOpacity={0.8}
            onPress={handleVoiceButton}
            accessibilityRole="button"
            accessibilityLabel={
              isRecording ? "Send voice note" : "Record voice note"
            }
            className="ml-2 h-11 w-11 items-center justify-center rounded-full"
            style={{
              backgroundColor: isRecording ? "#F76B1C" : "#FFF1E8",
            }}
          >
            {isRecording ? (
              <PaperPlaneRight size={20} color="#FFFFFF" weight="fill" />
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
    shadowColor: "#F76B1C",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.28,
    shadowRadius: 7,
    elevation: 5,
  },
});

export default ChatComposer;
