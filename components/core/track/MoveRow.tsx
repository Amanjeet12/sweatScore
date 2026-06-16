import * as FileSystem from 'expo-file-system';
import { Image } from 'expo-image';
import * as MediaLibrary from 'expo-media-library';
import { DownloadSimple, ShareNetwork } from 'phosphor-react-native';
import { useState } from 'react';
import { ActivityIndicator, Alert, TouchableOpacity, View } from 'react-native';
import Share from 'react-native-share';

import { Text } from '~/components/ui/text';
import { CatchPromise } from '~/utils/catch-promise';
import { formatDistanceToNow } from '~/utils/formatter';

export type MoveRowProps = {
  challengeName: string;
  coverImageUrl: string | null;
  pointsEarned: number;
  createdAt: number;
  compositeVideoUrl: string | null;
};

export default function MoveRow({
  challengeName,
  coverImageUrl,
  pointsEarned,
  createdAt,
  compositeVideoUrl,
}: MoveRowProps) {
  const [downloading, setDownloading] = useState(false);
  const [sharing, setSharing] = useState(false);
  const busy = downloading || sharing;
  const [mediaPermission, requestMediaPermission] = MediaLibrary.usePermissions({
    writeOnly: true,
  });

  const handleShare = async () => {
    if (!compositeVideoUrl || busy) return;
    setSharing(true);
    try {
      const localUri = (FileSystem.cacheDirectory ?? '') + 'share_video_' + Date.now() + '.mp4';
      await FileSystem.downloadAsync(compositeVideoUrl, localUri);
      await Share.open({
        url: localUri,
        type: 'video/mp4',
      });
    } catch {
      // User cancelled or error — silent
    }
    setSharing(false);
  };

  const handleDownload = async () => {
    if (!compositeVideoUrl || busy) return;
    let permission = mediaPermission;
    if (!permission?.granted) {
      permission = await requestMediaPermission();
    }
    if (!permission?.granted) {
      Alert.alert(
        'Permission required',
        'Please allow access to your photo library to save videos.'
      );
      return;
    }
    setDownloading(true);
    const localUri = (FileSystem.cacheDirectory ?? '') + 'download_video_' + Date.now() + '.mp4';
    const [err] = await CatchPromise(
      FileSystem.downloadAsync(compositeVideoUrl, localUri).then(() =>
        MediaLibrary.saveToLibraryAsync(localUri)
      )
    );
    setDownloading(false);
    if (err) {
      Alert.alert('Download failed', 'Could not save the video. Please try again.');
      return;
    }
    Alert.alert('Saved', 'Video saved to your photo library.');
  };

  return (
    <View className="flex-row items-center gap-x-3 py-3">
      {/* Cover */}
      {coverImageUrl ? (
        <Image
          source={{ uri: coverImageUrl }}
          style={{ width: 56, height: 56, borderRadius: 16 }}
          contentFit="cover"
        />
      ) : (
        <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: '#EEEAE5' }} />
      )}

      {/* Name + time-ago */}
      <View className="flex-1">
        <Text className="font-heading text-base font-bold text-[#1A1A1A]" numberOfLines={3}>
          {challengeName}
        </Text>
        <Text className="font-body text-sm text-[#838383]">
          {formatDistanceToNow(new Date(createdAt))}
        </Text>
      </View>

      {/* Points pill */}
      <View className="rounded-full bg-primary-500 px-3 py-1">
        <Text className="font-body text-sm font-bold text-white">{pointsEarned} pts</Text>
      </View>

      {/* Download + share — hidden if no composite video */}
      {compositeVideoUrl && (
        <>
          <TouchableOpacity
            onPress={handleDownload}
            disabled={busy}
            className="ml-1"
            style={{ width: 22, height: 22, alignItems: 'center', justifyContent: 'center' }}>
            {downloading ? (
              <ActivityIndicator size="small" color="#1A1A1A" />
            ) : (
              <DownloadSimple size={22} color="#1A1A1A" weight="regular" />
            )}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={handleShare}
            disabled={busy}
            className="ml-1"
            style={{ width: 22, height: 22, alignItems: 'center', justifyContent: 'center' }}>
            {sharing ? (
              <ActivityIndicator size="small" color="#1A1A1A" />
            ) : (
              <ShareNetwork size={22} color="#1A1A1A" weight="regular" />
            )}
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}
