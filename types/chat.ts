export type ChatMessageType =
  | "text"
  | "image"
  | "video"
  | "file"
  | "link"
  | "voice";

export type ChatDeliveryStatus = "sent" | "delivered" | "read";

export type ChatAttachmentType = "image" | "video" | "file";

export type ChatAttachment = {
  id: string;
  type: ChatAttachmentType;
  uri: string;
  name?: string;
  mimeType?: string;
  sizeBytes?: number;
  thumbnailUri?: string;
};

export type ChatReaction = {
  emoji: string;
  count: number;
  reactedByMe?: boolean;
};

export type ChatReply = {
  messageId: string;
  senderName: string;
  text: string;
};

export type ChatSeenMember = {
  id: string;
  initial: string;
  color: string;
};

export type ChatMessage = {
  id: string;
  groupId: string;
  senderId: string;
  senderName: string;
  senderInitial: string;
  senderColor: string;
  type: ChatMessageType;
  text?: string;
  createdAt: number;
  time: string;
  isMine?: boolean;
  deliveryStatus?: ChatDeliveryStatus;
  attachment?: ChatAttachment;
  linkTitle?: string;
  linkUrl?: string;
  voiceUri?: string;
  voiceDuration?: number;
  reactions?: ChatReaction[];
  replyTo?: ChatReply;
  seenBy?: ChatSeenMember[];
};

export type ChatTypingUser = {
  id: string;
  name: string;
};

export type PendingVoiceNote = {
  uri: string;
  durationSeconds: number;
};

export type SendTextMessageInput = {
  text: string;
  replyToMessageId?: string;
};

export type SendVoiceMessageInput = PendingVoiceNote & {
  replyToMessageId?: string;
};

export type SendAttachmentInput = {
  attachment: ChatAttachment;
  text?: string;
  replyToMessageId?: string;
};