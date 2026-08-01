import { useMutation, useQuery } from 'convex/react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AppState, type AppStateStatus } from 'react-native';

import { api } from '~/convex/_generated/api';
import type { Id } from '~/convex/_generated/dataModel';
import type { ChatMessage, ChatTypingUser } from '~/types/chat';

const TYPING_REFRESH_INTERVAL_MS = 2500;

const TYPING_STOP_DELAY_MS = 4500;

const PRESENCE_CLOCK_INTERVAL_MS = 1000;

const READ_UPDATE_THROTTLE_MS = 1500;

const DELIVERY_UPDATE_THROTTLE_MS = 1000;

export const useChatPresence = (groupId: string | undefined, originalMessages: ChatMessage[]) => {
  const convexGroupId = groupId ? (groupId as Id<'chatGroups'>) : undefined;

  const presence = useQuery(
    api.chat.presence.getGroupPresence,

    convexGroupId
      ? {
          groupId: convexGroupId,
        }
      : 'skip'
  );

  const setTypingMutation = useMutation(api.chat.presence.setTyping);

  const markGroupDeliveredMutation = useMutation(api.chat.presence.markGroupDelivered);

  const markGroupReadMutation = useMutation(api.chat.presence.markGroupRead);

  const [presenceClock, setPresenceClock] = useState(Date.now());

  const [isAppActive, setIsAppActive] = useState(AppState.currentState === 'active');

  const typingActiveRef = useRef(false);

  const lastTypingPingRef = useRef(0);

  const typingStopTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lastReadUpdateRef = useRef(0);

  const lastDeliveredUpdateRef = useRef(0);

  const clearTypingStopTimer = useCallback(() => {
    if (!typingStopTimerRef.current) {
      return;
    }

    clearTimeout(typingStopTimerRef.current);

    typingStopTimerRef.current = null;
  }, []);

  const sendTypingState = useCallback(
    (isTyping: boolean) => {
      if (!convexGroupId) {
        return;
      }

      void setTypingMutation({
        groupId: convexGroupId,
        isTyping,
      }).catch(() => {
        // Typing failures must not interrupt chat.
      });
    },
    [convexGroupId, setTypingMutation]
  );

  const stopTyping = useCallback(() => {
    clearTypingStopTimer();

    if (!typingActiveRef.current) {
      return;
    }

    typingActiveRef.current = false;

    lastTypingPingRef.current = 0;

    sendTypingState(false);
  }, [clearTypingStopTimer, sendTypingState]);

  const setTyping = useCallback(
    (isTyping: boolean) => {
      if (!isTyping || !isAppActive) {
        stopTyping();
        return;
      }

      const now = Date.now();

      const shouldRefresh =
        !typingActiveRef.current || now - lastTypingPingRef.current >= TYPING_REFRESH_INTERVAL_MS;

      if (shouldRefresh) {
        typingActiveRef.current = true;

        lastTypingPingRef.current = now;

        sendTypingState(true);
      }

      clearTypingStopTimer();

      typingStopTimerRef.current = setTimeout(() => {
        stopTyping();
      }, TYPING_STOP_DELAY_MS);
    },
    [clearTypingStopTimer, isAppActive, sendTypingState, stopTyping]
  );

  useEffect(() => {
    const interval = setInterval(() => {
      setPresenceClock(Date.now());
    }, PRESENCE_CLOCK_INTERVAL_MS);

    return () => {
      clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    const handleAppStateChange = (nextState: AppStateStatus) => {
      const active = nextState === 'active';

      setIsAppActive(active);

      if (!active) {
        stopTyping();
      }
    };

    const subscription = AppState.addEventListener('change', handleAppStateChange);

    return () => {
      subscription.remove();
    };
  }, [stopTyping]);

  useEffect(() => {
    return () => {
      clearTypingStopTimer();

      if (typingActiveRef.current && convexGroupId) {
        void setTypingMutation({
          groupId: convexGroupId,
          isTyping: false,
        }).catch(() => {
          // Screen cleanup must remain silent.
        });
      }

      typingActiveRef.current = false;
    };
  }, [clearTypingStopTimer, convexGroupId, setTypingMutation]);

  const latestMessage = originalMessages[originalMessages.length - 1];

  useEffect(() => {
    if (!convexGroupId || !latestMessage || !isAppActive) {
      return;
    }

    const now = Date.now();

    if (now - lastDeliveredUpdateRef.current < DELIVERY_UPDATE_THROTTLE_MS) {
      return;
    }

    lastDeliveredUpdateRef.current = now;

    void markGroupDeliveredMutation({
      groupId: convexGroupId,
    }).catch(() => {
      // Delivery-state failure must not interrupt chat.
    });
  }, [convexGroupId, isAppActive, latestMessage?.id, markGroupDeliveredMutation]);

  const markMessageRead = useCallback(
    (_messageId: string) => {
      if (!convexGroupId || !isAppActive) {
        return;
      }

      const now = Date.now();

      if (now - lastReadUpdateRef.current < READ_UPDATE_THROTTLE_MS) {
        return;
      }

      lastReadUpdateRef.current = now;

      void markGroupReadMutation({
        groupId: convexGroupId,
      }).catch(() => {
        // Read-state failure must not interrupt chat.
      });
    },
    [convexGroupId, isAppActive, markGroupReadMutation]
  );

  const typingUsers = useMemo<ChatTypingUser[]>(() => {
    return (presence?.typingUsers ?? [])
      .filter((typingUser) => typingUser.isTyping && typingUser.expiresAt > presenceClock)
      .map((typingUser) => ({
        id: typingUser.id,
        name: typingUser.name,
      }));
  }, [presence?.typingUsers, presenceClock]);

  const messages = useMemo<ChatMessage[]>(() => {
    const receiptMembers = presence?.receiptMembers ?? [];

    return originalMessages.map((message) => {
      if (!message.isMine) {
        return message;
      }

      const readMembers = receiptMembers.filter(
        (member) => (member.lastReadAt ?? 0) >= message.createdAt
      );

      const deliveredMembers = receiptMembers.filter(
        (member) =>
          Math.max(
            member.lastDeliveredAt ?? 0,

            member.lastReadAt ?? 0
          ) >= message.createdAt
      );

      const deliveryStatus =
        readMembers.length > 0 ? 'read' : deliveredMembers.length > 0 ? 'delivered' : 'sent';

      return {
        ...message,
        deliveryStatus,

        seenBy:
          readMembers.length > 0
            ? readMembers.map((member) => ({
                id: member.id,
                initial: member.initial,
                color: member.color,
                name: member.name,
              }))
            : undefined,
      };
    });
  }, [originalMessages, presence?.receiptMembers]);

  return {
    messages,
    typingUsers,
    setTyping,
    stopTyping,
    markMessageRead,
  };
};
