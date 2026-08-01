import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { Dimensions, FlatList, Keyboard, Platform } from 'react-native';

type UseChatKeyboardOptions = {
  shouldScrollOnKeyboardOpen?: () => boolean;
};

export const useChatKeyboard = <TItem>(
  listRef: RefObject<FlatList<TItem> | null>,

  options: UseChatKeyboardOptions = {}
) => {
  const fullWindowHeightRef = useRef(Dimensions.get('window').height);

  const shouldScrollRef = useRef(options.shouldScrollOnKeyboardOpen);

  const [androidKeyboardInset, setAndroidKeyboardInset] = useState(0);

  useEffect(() => {
    shouldScrollRef.current = options.shouldScrollOnKeyboardOpen;
  }, [options.shouldScrollOnKeyboardOpen]);

  const scrollToLatest = useCallback(
    (animated = true) => {
      requestAnimationFrame(() => {
        listRef.current?.scrollToEnd({
          animated,
        });
      });
    },
    [listRef]
  );

  useEffect(() => {
    const keyboardShowSubscription = Keyboard.addListener('keyboardDidShow', (event) => {
      if (Platform.OS === 'android') {
        const currentWindowHeight = Dimensions.get('window').height;

        const nativeResizeAmount = Math.max(
          0,

          fullWindowHeightRef.current - currentWindowHeight
        );

        const missingInset = Math.max(
          0,

          event.endCoordinates.height - nativeResizeAmount
        );

        setAndroidKeyboardInset(missingInset);
      }

      const shouldScroll = shouldScrollRef.current ? shouldScrollRef.current() : true;

      if (!shouldScroll) {
        return;
      }

      setTimeout(() => {
        scrollToLatest(true);
      }, 80);
    });

    const keyboardHideSubscription = Keyboard.addListener('keyboardDidHide', () => {
      setAndroidKeyboardInset(0);

      fullWindowHeightRef.current = Dimensions.get('window').height;
    });

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
