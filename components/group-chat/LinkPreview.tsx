import { Link as LinkIcon, ArrowSquareOut } from 'phosphor-react-native';
import { LinkPreview as NativeLinkPreview } from '@flyerhq/react-native-link-preview';
import { Image } from 'expo-image';
import * as WebBrowser from 'expo-web-browser';
import { ActivityIndicator, StyleSheet, useWindowDimensions, View } from 'react-native';

import { Text } from '~/components/ui/text';

type LinkPreviewProps = {
  title?: string;
  url?: string;
};

type PreviewData = {
  title?: string;
  description?: string;
  link?: string;
  image?:
    | string
    | {
        url?: string;
      };
};

const getDomain = (url: string) => {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return url
      .replace(/^https?:\/\//i, '')
      .replace(/^www\./i, '')
      .split('/')[0];
  }
};

const getWebsiteName = (url: string) => {
  const domain = getDomain(url);
  const name = domain.split('.')[0] || 'Website';

  return name.replace(/[-_]/g, ' ').replace(/\b\w/g, (character) => character.toUpperCase());
};

const LinkPreview = ({ title: storedTitle, url }: LinkPreviewProps) => {
  const { width: screenWidth } = useWindowDimensions();

  if (!url) {
    return null;
  }

  const cardWidth = Math.min(screenWidth - 92, 292);

  const openLink = async () => {
    try {
      await WebBrowser.openBrowserAsync(url, {
        controlsColor: '#F76B1C',
        toolbarColor: '#FFFFFF',
        enableBarCollapsing: true,
      });
    } catch {
      // Keep the chat screen active if opening fails.
    }
  };

  return (
    <View
      style={{
        width: cardWidth,
      }}>
      <NativeLinkPreview
        text={url}
        requestTimeout={8000}
        enableAnimation
        renderText={() => null}
        touchableWithoutFeedbackProps={{
          onPress: () => {
            void openLink();
          },
        }}
        renderLinkPreview={({ previewData }) => {
          const data = previewData as PreviewData | undefined;

          const imageUrl = typeof data?.image === 'string' ? data.image : data?.image?.url;

          const resolvedUrl = data?.link || url;

          const domain = getDomain(resolvedUrl);

          const resolvedTitle =
            data?.title?.trim() || storedTitle?.trim() || getWebsiteName(resolvedUrl);

          return (
            <View style={styles.card}>
              <View style={styles.previewArea}>
                {imageUrl ? (
                  <Image
                    source={{
                      uri: imageUrl,
                    }}
                    style={styles.previewImage}
                    contentFit="cover"
                    transition={180}
                  />
                ) : data ? (
                  <View style={styles.iconArea}>
                    <View style={styles.iconCircle}>
                      <LinkIcon size={25} color="#F76B1C" weight="bold" />
                    </View>
                  </View>
                ) : (
                  <View style={styles.iconArea}>
                    <ActivityIndicator size="small" color="#F76B1C" />
                  </View>
                )}
              </View>

              <View style={styles.content}>
                <View style={styles.titleRow}>
                  <Text
                    className="flex-1 font-body text-[14px] font-bold leading-[18px] text-[#242424]"
                    numberOfLines={2}>
                    {resolvedTitle}
                  </Text>

                  <ArrowSquareOut size={15} color="#8B817B" weight="bold" />
                </View>

                {data?.description ? (
                  <Text
                    className="font-body text-[11px] leading-[15px] text-[#75706C]"
                    numberOfLines={1}>
                    {data.description}
                  </Text>
                ) : null}

                <View style={styles.domainRow}>
                  <View style={styles.domainDot} />

                  <Text
                    className="ml-1.5 flex-1 font-body text-[11px] text-[#8A817C]"
                    numberOfLines={1}>
                    {domain}
                  </Text>
                </View>
              </View>
            </View>
          );
        }}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  card: {
    width: '100%',
    height: 92,
    flexDirection: 'row',
    overflow: 'hidden',
    borderRadius: 14,
    borderWidth: 1,
    borderColor: '#E9E1DC',
    backgroundColor: '#FFFFFF',
  },

  previewArea: {
    width: 86,
    height: 92,
    overflow: 'hidden',
    backgroundColor: '#FFF2E9',
  },

  previewImage: {
    width: '100%',
    height: 92,
  },

  iconArea: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#FFF2E9',
  },

  iconCircle: {
    width: 46,
    height: 46,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 23,
    backgroundColor: '#FFFFFF',
  },

  content: {
    flex: 1,
    justifyContent: 'center',
    paddingHorizontal: 11,
    paddingVertical: 9,
  },

  titleRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 7,
  },

  domainRow: {
    marginTop: 7,
    flexDirection: 'row',
    alignItems: 'center',
  },

  domainDot: {
    width: 5,
    height: 5,
    borderRadius: 3,
    backgroundColor: '#F76B1C',
  },
});

export default LinkPreview;
