import { Image } from 'expo-image';
import { useVideoPlayer, VideoView } from 'expo-video';
import { FileText, X } from 'phosphor-react-native';
import { useState } from 'react';
import { Linking, StyleSheet, TouchableOpacity, useWindowDimensions, View } from 'react-native';
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

const useMediaSize = (): MediaSize => {
  const { width: screenWidth } = useWindowDimensions();

  /*
   * Responsive media size:
   * - 72% of device width
   * - Never wider than 290px
   * - 4:3-style preview
   */
  const width = Math.min(screenWidth * 0.72, 290);
  const height = Math.min(width * 0.75, 218);

  return {
    width,
    height,
  };
};

const VideoAttachment = ({ attachment }: { attachment: ChatAttachment }) => {
  const mediaSize = useMediaSize();

  const player = useVideoPlayer(attachment.uri, (videoPlayer) => {
    videoPlayer.loop = false;
    videoPlayer.volume = 1;
  });

  return (
    <View style={[styles.videoContainer, mediaSize]}>
      <VideoView
        player={player}
        nativeControls
        allowsFullscreen
        contentFit="cover"
        style={styles.video}
      />
    </View>
  );
};

const ImageAttachment = ({ attachment }: { attachment: ChatAttachment }) => {
  const mediaSize = useMediaSize();
  const [viewerVisible, setViewerVisible] = useState(false);

  return (
    <>
      <TouchableOpacity
        activeOpacity={0.92}
        accessibilityRole="imagebutton"
        accessibilityLabel="Open image preview"
        onPress={() => setViewerVisible(true)}
        style={[styles.imageButton, mediaSize]}>
        <Image
          source={{
            uri: attachment.uri,
          }}
          style={styles.image}
          contentFit="cover"
          transition={200}
        />

        <View pointerEvents="none" style={styles.imageOverlay}>
          <View style={styles.openHint}>
            <Text style={styles.openHintText}>Tap to view</Text>
          </View>
        </View>
      </TouchableOpacity>

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
        onRequestClose={() => setViewerVisible(false)}
        HeaderComponent={() => (
          <View style={styles.viewerHeader}>
            <TouchableOpacity
              activeOpacity={0.8}
              accessibilityRole="button"
              accessibilityLabel="Close image viewer"
              onPress={() => setViewerVisible(false)}
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
  imageButton: {
    position: 'relative',
    overflow: 'hidden',
    borderRadius: 14,
    backgroundColor: '#E8E3DF',
  },

  image: {
    width: '100%',
    height: '100%',
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
    overflow: 'hidden',
    borderRadius: 14,
    backgroundColor: '#111111',
  },

  video: {
    width: '100%',
    height: '100%',
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
