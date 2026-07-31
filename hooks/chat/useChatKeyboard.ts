import {
  useCallback,
  useEffect,
  useRef,
  useState,
  type RefObject,
} from "react";
import { Dimensions, FlatList, Keyboard, Platform } from "react-native";

import type { ChatMessage } from "~/types/chat";

export const useChatKeyboard = (
  listRef: RefObject<FlatList<ChatMessage> | null>,
) => {
  const fullWindowHeightRef = useRef(Dimensions.get("window").height);
  const [androidKeyboardInset, setAndroidKeyboardInset] = useState(0);

  const scrollToLatest = useCallback(
    (animated = true) => {
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({ animated });
      });
    },
    [listRef],
  );

  useEffect(() => {
    const keyboardShowSubscription = Keyboard.addListener(
      "keyboardDidShow",
      (event) => {
        if (Platform.OS === "android") {
          const currentWindowHeight = Dimensions.get("window").height;
          const nativeResizeAmount = Math.max(
            0,
            fullWindowHeightRef.current - currentWindowHeight,
          );
          const missingInset = Math.max(
            0,
            event.endCoordinates.height - nativeResizeAmount,
          );

          setAndroidKeyboardInset(missingInset);
        }

        setTimeout(() => scrollToLatest(true), 80);
      },
    );

    const keyboardHideSubscription = Keyboard.addListener(
      "keyboardDidHide",
      () => {
        setAndroidKeyboardInset(0);
        fullWindowHeightRef.current = Dimensions.get("window").height;
      },
    );

    return () => {
      keyboardShowSubscription.remove();
      keyboardHideSubscription.remove();
    };
  }, [scrollToLatest]);

  return {
    androidKeyboardInset,
    scrollToLatest,
  };
};
