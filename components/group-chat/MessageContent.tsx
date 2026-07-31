import { Check, Checks } from 'phosphor-react-native';
import { View } from 'react-native';

import { MentionText } from '~/components/group-chat/Avatar';
import LinkPreview from '~/components/group-chat/LinkPreview';
import MediaMessage from '~/components/group-chat/MediaMessage';
import ReplyPreview from '~/components/group-chat/ReplyPreview';
import VoiceMessage from '~/components/group-chat/VoiceMessage';
import { Text } from '~/components/ui/text';
import type { ChatMessage } from '~/types/chat';

type MessageContentProps = {
  message: ChatMessage;
  isPlaying: boolean;
  onToggleVoice: () => void;
};

const URL_REGEX = /(?:https?:\/\/|www\.)[^\s<>"']+/i;

const extractLinkData = (text?: string) => {
  if (!text) {
    return {
      url: undefined,
      caption: undefined,
    };
  }

  const match = text.match(URL_REGEX);

  if (!match) {
    return {
      url: undefined,
      caption: text,
    };
  }

  /*
   * Remove punctuation that may be written immediately
   * after the URL.
   */
  const originalUrl = match[0];

  const cleanUrl = originalUrl.replace(/[.,!?;:)\]}]+$/, '');

  const normalizedUrl = cleanUrl.toLowerCase().startsWith('www.')
    ? `https://${cleanUrl}`
    : cleanUrl;

  /*
   * Keep all remaining text as the caption under the card.
   */
  const caption = text
    .replace(originalUrl, '')
    .replace(/\s{2,}/g, ' ')
    .trim();

  return {
    url: normalizedUrl,
    caption: caption || undefined,
  };
};

const DeliveryStatus = ({ message }: { message: ChatMessage }) => {
  if (!message.isMine) {
    return null;
  }

  if (message.deliveryStatus === 'read') {
    return <Checks size={15} color="#FFFFFF" weight="bold" />;
  }

  if (message.deliveryStatus === 'delivered') {
    return <Checks size={15} color="#FFE5D7" weight="bold" />;
  }

  return <Check size={15} color="#FFE5D7" weight="bold" />;
};

const MessageContent = ({ message, isPlaying, onToggleVoice }: MessageContentProps) => {
  const isMine = Boolean(message.isMine);

  const { url: detectedUrl, caption } = extractLinkData(message.text);

  /*
   * Support both:
   *
   * 1. Old Convex link messages
   * 2. Normal text messages containing a URL
   */
  const linkUrl = message.linkUrl || detectedUrl;

  const hasLink = Boolean(linkUrl);

  const displayedText = hasLink ? caption : message.text;

  const hasVisualMedia = message.type === 'image' || message.type === 'video';

  const hasContentBeforeText = hasVisualMedia || message.type === 'file' || hasLink;

  return (
    <>
      {message.replyTo ? (
        <View className={hasVisualMedia || hasLink ? 'mb-2' : ''}>
          <ReplyPreview reply={message.replyTo} isMine={isMine} />
        </View>
      ) : null}

      {message.attachment ? <MediaMessage attachment={message.attachment} /> : null}

      {linkUrl ? <LinkPreview url={linkUrl} /> : null}

      {message.type === 'voice' ? (
        <VoiceMessage
          duration={message.voiceDuration}
          isMine={isMine}
          isPlaying={isPlaying}
          onTogglePlayback={onToggleVoice}
        />
      ) : null}

      {displayedText ? (
        <View className={hasContentBeforeText ? (hasVisualMedia ? 'mx-2 mt-2' : 'mt-3') : ''}>
          {isMine ? (
            <Text className="font-body text-[15px] leading-[22px] text-white">{displayedText}</Text>
          ) : (
            <MentionText>{displayedText}</MentionText>
          )}
        </View>
      ) : null}

      <View
        className={
          hasVisualMedia
            ? 'mx-2 mt-1 flex-row items-center justify-end gap-x-1'
            : 'mt-1 flex-row items-center justify-end gap-x-1'
        }>
        <Text
          className="font-body text-[10px]"
          style={{
            color: isMine ? '#FFF0E8' : '#7D7D7D',
          }}>
          {message.time}
        </Text>

        <DeliveryStatus message={message} />
      </View>
    </>
  );
};

export default MessageContent;
