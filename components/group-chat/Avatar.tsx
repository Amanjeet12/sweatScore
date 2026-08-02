import { Fragment } from 'react';
import { View } from 'react-native';

import { Text } from '~/components/ui/text';
import type { ChatMention } from '~/types/chat';

type AvatarProps = {
  initial: string;
  color: string;
  size?: number;
};

type MentionTextProps = {
  text: string;
  mentions?: ChatMention[];
  isMine?: boolean;
};

const SENT_MESSAGE_TEXT_COLOR = '#FFFFFF';
const RECEIVED_MESSAGE_TEXT_COLOR = '#232323';

const SENT_MENTION_COLOR = '#172554';
const RECEIVED_MENTION_COLOR = '#2563EB';

export const Avatar = ({
  initial,
  color,
  size = 36,
}: AvatarProps) => {
  return (
    <View
      className="items-center justify-center overflow-hidden border-2 border-white"
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        backgroundColor: color,
      }}>
      <Text
        className="font-heading font-bold text-white"
        style={{
          fontSize: Math.max(10, size * 0.38),
        }}>
        {initial}
      </Text>
    </View>
  );
};

const escapeRegExp = (value: string) => {
  return value.replace(
    /[.*+?^${}()|[\]\\]/g,
    '\\$&'
  );
};

const getMentionColor = (
  isMine: boolean
) => {
  return isMine
    ? SENT_MENTION_COLOR
    : RECEIVED_MENTION_COLOR;
};

const getNormalTextColor = (
  isMine: boolean
) => {
  return isMine
    ? SENT_MESSAGE_TEXT_COLOR
    : RECEIVED_MESSAGE_TEXT_COLOR;
};

export const MentionText = ({
  text,
  mentions = [],
  isMine = false,
}: MentionTextProps) => {
  const normalTextColor =
    getNormalTextColor(isMine);

  const mentionColor =
    getMentionColor(isMine);

  /*
   * Only keep mentions that still exist
   * inside the message text.
   *
   * Sorting by longest display name first
   * prevents partial matching.
   *
   * Example:
   *
   * @Vikrant Kumar
   *
   * must be matched before:
   *
   * @Vikrant
   */
  const validMentions = mentions
    .filter((mention) => {
      const displayName =
        mention.displayName?.trim();

      if (!displayName) {
        return false;
      }

      return text.includes(
        `@${displayName}`
      );
    })
    .sort(
      (first, second) =>
        second.displayName.length -
        first.displayName.length
    );

  /*
   * Fallback for older messages that do
   * not contain stored mention metadata.
   *
   * This fallback supports:
   *
   * @Vikrant
   * @Faith
   * @user_name
   *
   * Full names with spaces require stored
   * mention metadata.
   */
  if (validMentions.length === 0) {
    const sections = text.split(
      /(@[a-zA-Z0-9_]+)/g
    );

    return (
      <Text
        className="font-body text-[15px] leading-[22px]"
        style={{
          color: normalTextColor,
        }}>
        {sections.map(
          (section, index) => {
            const isMention =
              section.startsWith('@');

            if (!isMention) {
              return (
                <Fragment
                  key={`${section}-${index}`}>
                  {section}
                </Fragment>
              );
            }

            return (
              <Text
                key={`${section}-${index}`}
                className="font-body font-bold"
                style={{
                  color: mentionColor,
                }}>
                {section}
              </Text>
            );
          }
        )}
      </Text>
    );
  }

  const mentionValues =
    validMentions.map(
      (mention) =>
        `@${mention.displayName}`
    );

  const mentionValueSet =
    new Set(mentionValues);

  const mentionPattern =
    mentionValues
      .map(escapeRegExp)
      .join('|');

  const sections = text.split(
    new RegExp(
      `(${mentionPattern})`,
      'g'
    )
  );

  return (
    <Text
      className="font-body text-[15px] leading-[22px]"
      style={{
        color: normalTextColor,
      }}>
      {sections.map(
        (section, index) => {
          const isMention =
            mentionValueSet.has(
              section
            );

          if (!isMention) {
            return (
              <Fragment
                key={`${section}-${index}`}>
                {section}
              </Fragment>
            );
          }

          return (
            <Text
              key={`${section}-${index}`}
              className="font-body font-bold"
              style={{
                color: mentionColor,
              }}>
              {section}
            </Text>
          );
        }
      )}
    </Text>
  );
};