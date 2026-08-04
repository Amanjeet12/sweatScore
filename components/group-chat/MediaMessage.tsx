import { useEvent } from 'expo';
import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { ArrowClockwise, FileText, WarningCircle, X } from 'phosphor-react-native';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  Linking,
  StyleSheet,
  TouchableOpacity,
  useWindowDimensions,
  View,
} from 'react-native';
import ImageViewing from 'react-native-image-viewing';

import { Text } from '~/components/ui/text';
import type { ChatAttachment } from '~/types/chat';

type MediaMessageProps = {
  attachment: ChatAttachment;
};

type MediaSize = {
  width: number;
  height: number;
};

type MediaLoadState = 'loading' | 'loaded' | 'error';

type MediaLoadingOverlayProps = {
  label: string;
};

type MediaErrorFallbackProps = {
  title: string;
  message: string;
  onRetry: () => void;
};

type VideoPlayerSurfaceProps = {
  attachment: ChatAttachment;
  mediaSize: MediaSize;
  onRetry: () => void;
};

const useMediaSize = (): MediaSize => {
  const { width: screenWidth } = useWindowDimensions();

  const width = Math.min(screenWidth * 0.72, 290);

  const height = Math.min(width * 0.75, 218);

  return {
    width,
    height,
  };
};

const MediaLoadingOverlay = ({ label }: MediaLoadingOverlayProps) => {
  return (
    <View pointerEvents="none" style={styles.loadingOverlay}>
      <ActivityIndicator size="small" color="#F76B1C" />

      <Text style={styles.loadingText}>{label}</Text>
    </View>
  );
};

const MediaErrorFallback = ({ title, message, onRetry }: MediaErrorFallbackProps) => {
  return (
    <View style={styles.errorOverlay}>
      <View style={styles.errorIcon}>
        <WarningCircle size={25} color="#F76B1C" weight="fill" />
      </View>

      <Text style={styles.errorTitle}>{title}</Text>

      <Text style={styles.errorMessage}>{message}</Text>

      <TouchableOpacity
        activeOpacity={0.8}
        onPress={onRetry}
        accessibilityRole="button"
        accessibilityLabel={`Retry loading ${title.toLowerCase()}`}
        style={styles.retryButton}>
        <ArrowClockwise size={15} color="#F76B1C" weight="bold" />

        <Text style={styles.retryText}>Try again</Text>
      </TouchableOpacity>
    </View>
  );
};

const VideoPlayerSurface = ({ attachment, mediaSize, onRetry }: VideoPlayerSurfaceProps) => {
  const player = useVideoPlayer(attachment.uri, (videoPlayer) => {
    videoPlayer.loop = false;
    videoPlayer.volume = 1;
  });

  const { status } = useEvent(player, 'statusChange', {
    status: player.status,
  });

  const isLoading = status === 'idle' || status === 'loading';

  const hasError = status === 'error';

  return (
    <View style={[styles.videoContainer, mediaSize]}>
      <VideoView
        player={player}
        nativeControls={!hasError}
        allowsFullscreen
        contentFit="cover"
        style={styles.video}
      />

      {isLoading ? <MediaLoadingOverlay label="Loading video…" /> : null}

      {hasError ? (
        <MediaErrorFallback
          title="Video unavailable"
          message="The video could not be loaded."
          onRetry={onRetry}
        />
      ) : null}
    </View>
  );
};

const VideoAttachment = ({ attachment }: { attachment: ChatAttachment }) => {
  const mediaSize = useMediaSize();

  const [retryKey, setRetryKey] = useState(0);

  return (
    <VideoPlayerSurface
      key={`${attachment.id}-${retryKey}`}
      attachment={attachment}
      mediaSize={mediaSize}
      onRetry={() => setRetryKey((current) => current + 1)}
    />
  );
};

const ImageAttachment = ({ attachment }: { attachment: ChatAttachment }) => {
  const mediaSize = useMediaSize();

  const [viewerVisible, setViewerVisible] = useState(false);

  const [loadState, setLoadState] = useState<MediaLoadState>('loading');

  const [retryKey, setRetryKey] = useState(0);

  const openViewer = useCallback(() => {
    setViewerVisible(true);
  }, []);

  const closeViewer = useCallback(() => {
    setViewerVisible(false);
  }, []);

  const retryImage = () => {
    setViewerVisible(false);
    setLoadState('loading');

    setRetryKey((current) => current + 1);
  };

  const imageLoaded = loadState === 'loaded';

  return (
    <>
      <View style={[styles.imageContainer, mediaSize]}>
        <Image
          key={`${attachment.id}-${retryKey}`}
          source={{
            uri: attachment.uri,
          }}
          style={styles.image}
          contentFit="cover"
          transition={200}
          cachePolicy="memory-disk"
          onLoadStart={() => setLoadState('loading')}
          onLoad={() => setLoadState('loaded')}
          onError={() => setLoadState('error')}
        />

        {loadState === 'loading' ? <MediaLoadingOverlay label="Loading photo…" /> : null}

        {loadState === 'error' ? (
          <MediaErrorFallback
            title="Photo unavailable"
            message="The photo could not be loaded."
            onRetry={retryImage}
          />
        ) : null}

        {imageLoaded ? (
          <TouchableOpacity
            activeOpacity={0.92}
            accessibilityRole="imagebutton"
            accessibilityLabel="Open image preview"
            onPressIn={openViewer}
            style={styles.imageOpenButton}>
            <View pointerEvents="none" style={styles.imageOverlay}>
              <View style={styles.openHint}>
                <Text style={styles.openHintText}>Tap to view</Text>
              </View>
            </View>
          </TouchableOpacity>
        ) : null}
      </View>

      <ImageViewing
        images={[
          {
            uri: attachment.uri,
          },
        ]}
        imageIndex={0}
        visible={viewerVisible}
        backgroundColor="#000000"
        swipeToCloseEnabled
        doubleTapToZoomEnabled
        onRequestClose={closeViewer}
        HeaderComponent={() => (
          <View style={styles.viewerHeader}>
            <TouchableOpacity
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Close image viewer"
              onPressIn={closeViewer}
              style={styles.viewerCloseButton}>
              <X size={24} color="#FFFFFF" weight="bold" />
            </TouchableOpacity>
          </View>
        )}
      />
    </>
  );
};

const FileAttachment = ({ attachment }: { attachment: ChatAttachment }) => {
  const openFile = async () => {
    const canOpen = await Linking.canOpenURL(attachment.uri);

    if (canOpen) {
      await Linking.openURL(attachment.uri);
    }
  };

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => void openFile()}
      className="min-w-[230px] flex-row items-center rounded-xl bg-[#FFF5EE] p-3">
      <View className="h-11 w-11 items-center justify-center rounded-full bg-white">
        <FileText size={22} color="#F35E16" weight="bold" />
      </View>

      <View className="ml-3 flex-1">
        <Text className="font-body text-sm font-bold text-[#242424]" numberOfLines={1}>
          {attachment.name || 'Shared file'}
        </Text>

        <Text className="mt-0.5 font-body text-xs text-[#737373]">Tap to open</Text>
      </View>
    </TouchableOpacity>
  );
};

const MediaMessage = ({ attachment }: MediaMessageProps) => {
  if (attachment.type === 'video') {
    return <VideoAttachment attachment={attachment} />;
  }

  if (attachment.type === 'file') {
    return <FileAttachment attachment={attachment} />;
  }

  return <ImageAttachment attachment={attachment} />;
};

const styles = StyleSheet.create({
  imageContainer: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 14,
    backgroundColor: '#F2EEEB',
  },

  image: {
    width: '100%',
    height: '100%',
  },

  imageOpenButton: {
    ...StyleSheet.absoluteFillObject,
  },

  imageOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'flex-end',
    alignItems: 'flex-end',
    padding: 8,
  },

  openHint: {
    borderRadius: 999,
    backgroundColor: 'rgba(0, 0, 0, 0.52)',
    paddingHorizontal: 9,
    paddingVertical: 4,
  },

  openHintText: {
    color: '#FFFFFF',
    fontSize: 10,
    fontWeight: '700',
  },

  videoContainer: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 14,
    backgroundColor: '#111111',
  },

  video: {
    width: '100%',
    height: '100%',
  },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(250, 248, 246, 0.94)',
  },

  loadingText: {
    marginTop: 8,
    color: '#66615E',
    fontSize: 11,
    fontWeight: '600',
  },

  errorOverlay: {
    ...StyleSheet.absoluteFillObject,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(250, 248, 246, 0.98)',
    paddingHorizontal: 20,
  },

  errorIcon: {
    width: 40,
    height: 40,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 20,
    backgroundColor: '#FFF0E7',
  },

  errorTitle: {
    marginTop: 7,
    color: '#2C2826',
    fontSize: 13,
    fontWeight: '700',
    textAlign: 'center',
  },

  errorMessage: {
    marginTop: 2,
    color: '#77716E',
    fontSize: 11,
    lineHeight: 15,
    textAlign: 'center',
  },

  retryButton: {
    marginTop: 9,
    minHeight: 34,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 17,
    backgroundColor: '#FFF0E7',
    paddingHorizontal: 13,
  },

  retryText: {
    marginLeft: 6,
    color: '#F35E16',
    fontSize: 11,
    fontWeight: '700',
  },

  viewerHeader: {
    width: '100%',
    alignItems: 'flex-end',
    paddingHorizontal: 18,
    paddingTop: 50,
    zIndex: 20,
  },

  viewerCloseButton: {
    width: 42,
    height: 42,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 21,
    backgroundColor: 'rgba(30, 30, 30, 0.75)',
  },
});

export default MediaMessage;
