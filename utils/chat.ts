import type { ChatMessage, ChatReply } from "~/types/chat";

export const CURRENT_CHAT_USER = {
  id: "current-user",
  name: "Vikrant",
  initial: "V",
  color: "#F76B1C",
};

export const REACTION_OPTIONS = ["🔥", "❤️", "💪", "😂", "👏"];

export const formatDuration = (seconds = 0) => {
  const minutes = Math.floor(seconds / 60);
  const remainingSeconds = seconds % 60;

  return `${minutes}:${remainingSeconds.toString().padStart(2, "0")}`;
};

export const formatMessageTime = (date = new Date()) =>
  date.toLocaleTimeString([], {
    hour: "numeric",
    minute: "2-digit",
  });

export const getReplyText = (message: ChatMessage) => {
  if (message.text) return message.text;
  if (message.type === "image") return "Photo";
  if (message.type === "video") return "Video";
  if (message.type === "file") return message.attachment?.name || "File";
  if (message.type === "voice") return "Voice note";
  if (message.type === "link") return message.linkTitle || "Link";

  return "Message";
};

export const createReplyDetails = (
  message?: ChatMessage,
): ChatReply | undefined => {
  if (!message) return undefined;

  return {
    messageId: message.id,
    senderName: message.senderName,
    text: getReplyText(message),
  };
};
