import { X } from 'lucide-react-native';
import * as React from 'react';
import {
  Image,
  LayoutAnimation,
  LayoutChangeEvent,
  Linking,
  StyleProp,
  StyleSheet,
  Text,
  TouchableWithoutFeedback,
  TouchableWithoutFeedbackProps,
  View,
  ViewStyle,
  TouchableOpacity,
} from 'react-native';

import { getPreviewData, oneOf } from '~/utils/link-preview';
import { PreviewData, PreviewDataImage } from '~/utils/types';

export interface LinkPreviewProps {
  containerStyle?: StyleProp<ViewStyle>;
  enableAnimation?: boolean;
  header?: string;
  metadataContainerStyle?: StyleProp<ViewStyle>;
  metadataTextContainerStyle?: StyleProp<ViewStyle>;
  onPreviewDataFetched?: (previewData: PreviewData) => void;
  previewData?: PreviewData;
  renderDescription?: (description: string) => React.ReactNode;
  renderHeader?: (header: string) => React.ReactNode;
  renderImage?: (image: PreviewDataImage) => React.ReactNode;
  renderLinkPreview?: (payload: {
    aspectRatio?: number;
    containerWidth: number;
    previewData?: PreviewData;
  }) => React.ReactNode;
  renderMinimizedImage?: (image: PreviewDataImage) => React.ReactNode;
  renderText?: (text: string) => React.ReactNode;
  renderTitle?: (title: string) => React.ReactNode;
  requestTimeout?: number;
  text: string;
  textContainerStyle?: StyleProp<ViewStyle>;
  touchableWithoutFeedbackProps?: TouchableWithoutFeedbackProps;
  onClose?: () => void;
  showCloseButton?: boolean;
  openLink?: boolean;
  onlyImage?: boolean;
  onPress?: () => void;
}

export const LinkPreview = React.memo(
  ({
    containerStyle,
    enableAnimation,
    header,
    metadataContainerStyle,
    metadataTextContainerStyle,
    onPreviewDataFetched,
    previewData,
    renderDescription,
    renderHeader,
    renderImage,
    renderLinkPreview,
    renderMinimizedImage,
    renderText,
    renderTitle,
    requestTimeout = 5000,
    text,
    textContainerStyle,
    touchableWithoutFeedbackProps,
    onClose = () => {},
    showCloseButton = true,
    openLink = true,
    onlyImage = false,
    onPress = () => {},
  }: LinkPreviewProps) => {
    const [containerWidth, setContainerWidth] = React.useState(0);
    const [data, setData] = React.useState(previewData);
    const aspectRatio = data?.image ? data.image.width / data.image.height : undefined;

    React.useEffect(() => {
      let isCancelled = false;
      if (previewData) {
        setData(previewData);
        return;
      }

      const fetchData = async () => {
        setData(undefined);
        const newData = await getPreviewData(text, requestTimeout);
        // Set data only if component is still mounted
        /* istanbul ignore next */
        if (!isCancelled) {
          // No need to cover LayoutAnimation
          /* istanbul ignore next */
          if (enableAnimation) {
            LayoutAnimation.easeInEaseOut();
          }
          setData(newData);
          onPreviewDataFetched?.(newData);
        }
      };

      fetchData();
      return () => {
        isCancelled = true;
      };
    }, [enableAnimation, previewData, requestTimeout, text]);

    const handleContainerLayout = React.useCallback((event: LayoutChangeEvent) => {
      setContainerWidth(event.nativeEvent.layout.width);
    }, []);

    const handlePress = async () => {
      if (!data?.link) return;

      // if (Platform.OS === 'android') {
      //   const { preferredBrowserPackage } = await WebBrowser.getCustomTabsSupportingBrowsersAsync();
      //   await WebBrowser.openBrowserAsync(data.link, { browserPackage: preferredBrowserPackage });
      // } else {
      //   WebBrowser.openBrowserAsync(data.link);
      // }

      if (openLink) {
        Linking.openURL(data.link);
      } else {
        onPress();
      }
    };

    const renderDescriptionNode = (description: string) => {
      return oneOf(
        renderDescription,
        <Text numberOfLines={3} style={styles.description}>
          {description}
        </Text>
      )(description);
    };

    const renderHeaderNode = () => {
      return header
        ? oneOf(
            renderHeader,
            <Text numberOfLines={1} style={styles.header}>
              {header}
            </Text>
          )(header)
        : null;
    };

    const renderImageNode = (image: PreviewDataImage) => {
      // aspectRatio shouldn't be undefined, just an additional check
      /* istanbul ignore next */
      const ar = aspectRatio ?? 1;

      return oneOf(
        renderImage,
        <Image
          accessibilityRole="image"
          resizeMode="contain"
          source={{ uri: image.url }}
          style={StyleSheet.flatten([
            styles.image,
            ar < 1
              ? {
                  height: containerWidth,
                  minWidth: 170,
                  width: containerWidth * ar,
                }
              : {
                  height: containerWidth / ar,
                  maxHeight: containerWidth,
                  width: containerWidth,
                },
          ])}
        />
      )(image);
    };

    const renderLinkPreviewNode = () => {
      return oneOf(
        renderLinkPreview,
        <>
          {/* Render image node only if there is an image with an aspect ratio not equal to 1
              OR there are no description and title
            */}
          {data?.image &&
            (aspectRatio !== 1 || (!data?.description && !data.title)) &&
            renderImageNode(data.image)}
          <View style={StyleSheet.flatten([styles.textContainer, textContainerStyle])}>
            {/* {renderHeaderNode()} */}
            {/* {renderTextNode()} */}
            {/* Render metadata only if there are either description OR title OR
                there is an image with an aspect ratio of 1 and either description or title
              */}

            {onlyImage ? null : (
              <>
                {(data?.description ||
                  (data?.image && aspectRatio === 1 && (data?.description || data?.title)) ||
                  data?.title) && (
                  <View
                    style={StyleSheet.flatten([styles.metadataContainer, metadataContainerStyle])}>
                    <View
                      style={StyleSheet.flatten([
                        styles.metadataTextContainer,
                        metadataTextContainerStyle,
                      ])}>
                      {data?.link && renderUrlNode(data.link)}
                      {data?.title && renderTitleNode(data.title)}
                      {/* {data?.description && renderDescriptionNode(data.description)} */}
                    </View>
                    {data?.image && aspectRatio === 1 && renderMinimizedImageNode(data.image)}
                  </View>
                )}
              </>
            )}
          </View>
        </>
      )({
        aspectRatio,
        containerWidth,
        previewData: data,
      });
    };

    const renderMinimizedImageNode = (image: PreviewDataImage) => {
      return oneOf(
        renderMinimizedImage,
        <Image
          accessibilityRole="image"
          source={{ uri: image.url }}
          style={styles.minimizedImage}
        />
      )(image);
    };

    const renderTextNode = () => oneOf(renderText, <Text>{text}</Text>)(text);

    const renderTitleNode = (title: string) => {
      return oneOf(
        renderTitle,
        <Text numberOfLines={2} className="mb-4 font-semibold">
          {title}
        </Text>
      )(title);
    };

    const renderUrlNode = (url: string) => {
      const urlNode = new URL(url);

      return oneOf(
        renderTitle,
        <Text numberOfLines={1} className="mb-1 text-xs text-hint">
          {urlNode.host}
        </Text>
      )(url);
    };

    return (
      <View className="relative">
        <TouchableWithoutFeedback
          accessibilityRole="button"
          onPress={handlePress}
          {...touchableWithoutFeedbackProps}>
          <View onLayout={handleContainerLayout} style={containerStyle}>
            {renderLinkPreviewNode()}
          </View>
        </TouchableWithoutFeedback>
        {showCloseButton &&
          data?.image &&
          (aspectRatio !== 1 || (!data?.description && !data.title)) && (
            <View className="absolute right-0 top-0 m-2 rounded-full bg-[rgba(0,0,0,0.8)] p-1">
              <TouchableOpacity onPress={onClose}>
                <X color="#fff" size={18} />
              </TouchableOpacity>
            </View>
          )}
      </View>
    );
  }
);

const styles = StyleSheet.create({
  description: {
    marginVertical: 10,
  },
  header: {
    marginBottom: 16,
  },
  image: {
    alignSelf: 'center',
    backgroundColor: '#f7f7f8',
    borderRadius: 12,
    marginBottom: 10,
  },
  metadataContainer: {
    flexDirection: 'row',
    // marginTop: 16,
  },
  metadataTextContainer: {
    flex: 1,
  },
  minimizedImage: {
    borderRadius: 12,
    height: 48,
    marginLeft: 4,
    width: 48,
  },
  textContainer: {
    marginHorizontal: 24,
  },
});
