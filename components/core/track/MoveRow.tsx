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
  timesCompleted: number;
};

export default function MoveRow({
  challengeName,
  coverImageUrl,
  pointsEarned,
  createdAt,
  compositeVideoUrl,
  timesCompleted,
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
      const localUri = `${FileSystem.cacheDirectory ?? ''}share_video_${Date.now()}.mp4`;

      await FileSystem.downloadAsync(compositeVideoUrl, localUri);

      await Share.open({
        url: localUri,
        type: 'video/mp4',
      });
    } catch {
      // User cancelled or share failed.
    } finally {
      setSharing(false);
    }
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

    const localUri = `${FileSystem.cacheDirectory ?? ''}download_video_${Date.now()}.mp4`;

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
      {coverImageUrl ? (
        <Image
          source={{ uri: coverImageUrl }}
          style={{ width: 56, height: 56, borderRadius: 16 }}
          contentFit="cover"
        />
      ) : (
        <View
          style={{
            width: 56,
            height: 56,
            borderRadius: 16,
            backgroundColor: '#EEEAE5',
          }}
        />
      )}

      <View className="flex-1">
        <Text
          className="font-heading text-base font-bold leading-5 text-[#1A1A1A]"
          numberOfLines={2}>
          {challengeName}
        </Text>

        <View className="mt-1.5 flex-row flex-wrap items-center gap-x-2 gap-y-1">
          <Text className="font-body text-sm text-[#838383]">
            {formatDistanceToNow(new Date(createdAt))}
          </Text>

          <View className="rounded-full border border-primary-100 bg-primary-50 px-2.5 py-0.5">
            <Text className="font-body text-[11px] font-bold text-primary-500">
              Round {timesCompleted}
            </Text>
          </View>
        </View>
      </View>

      <View className="items-end gap-y-2">
        <View className="rounded-full bg-primary-500 px-3 py-1">
          <Text className="font-body text-sm font-bold text-white">
            {pointsEarned} pts
          </Text>
        </View>

        {compositeVideoUrl && (
          <View className="flex-row items-center gap-x-3">
            <TouchableOpacity
              onPress={handleDownload}
              disabled={busy}
              activeOpacity={0.7}
              style={{
                width: 24,
                height: 24,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: busy ? 0.6 : 1,
              }}>
              {downloading ? (
                <ActivityIndicator size="small" color="#1A1A1A" />
              ) : (
                <DownloadSimple size={22} color="#1A1A1A" weight="regular" />
              )}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={handleShare}
              disabled={busy}
              activeOpacity={0.7}
              style={{
                width: 24,
                height: 24,
                alignItems: 'center',
                justifyContent: 'center',
                opacity: busy ? 0.6 : 1,
              }}>
              {sharing ? (
                <ActivityIndicator size="small" color="#1A1A1A" />
              ) : (
                <ShareNetwork size={22} color="#1A1A1A" weight="regular" />
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  );
}