import { Platform } from 'react-native';
import Share, { Social } from 'react-native-share';

const APP_STORE_URL = 'https://apps.apple.com/us/app/sweatscore/id6744372181';
const PLAY_STORE_URL = 'https://play.google.com/store/apps/details?id=com.sweatscore.sweatscoreapp';

// Facebook App ID — required for Instagram/Facebook Stories sharing
const FB_APP_ID = process.env.EXPO_PUBLIC_FB_APP_ID!;

// ─── SHARE MODE FLAG ───────────────────────────────────────
// 'video' = share the composite merged video (waits for Trigger.dev)
// 'sticker' = share a sticker image preview (immediate)
export const SHARE_MODE: 'video' | 'sticker' = 'video';
// ────────────────────────────────────────────────────────────

function getAppLink(): string {
  return Platform.OS === 'ios' ? APP_STORE_URL : PLAY_STORE_URL;
}

export function buildCaption(userCaption: string): string {
  const link = getAppLink();
  const caption = userCaption.trim();
  if (caption) {
    return `${caption} 🔥 Download SweatScore → ${link}`;
  }
  return `🔥 Check out my SweatScore duet! Download → ${link}`;
}

export async function shareToTikTok(
  mediaUri: string,
  userCaption: string,
  isVideo: boolean
): Promise<void> {
  const message = buildCaption(userCaption);

  try {
    await Share.open({
      url: mediaUri,
      message,
      type: isVideo ? 'video/mp4' : 'image/png',
    });
  } catch {
    // User cancelled or error
  }
}

export async function shareToInstagramStory(
  mediaUri: string,
  userCaption: string,
  isVideo: boolean
): Promise<void> {
  const message = buildCaption(userCaption);

  try {
    if (isVideo) {
      // Instagram Stories URL scheme doesn't support video backgrounds
      // Use generic share sheet — user picks Instagram from the list
      await Share.open({
        url: mediaUri,
        type: 'video/mp4',
      });
    } else {
      await Share.shareSingle({
        stickerImage: mediaUri,
        backgroundTopColor: '#FFF3EB',
        backgroundBottomColor: '#FFE6DA',
        social: Social.InstagramStories,
        appId: FB_APP_ID,
        attributionURL: getAppLink(),
      });
    }
  } catch {
    try {
      await Share.open({
        url: mediaUri,
        message,
        type: isVideo ? 'video/mp4' : 'image/png',
      });
    } catch {
      // User cancelled
    }
  }
}

export async function shareToFacebookStory(
  mediaUri: string,
  userCaption: string,
  isVideo: boolean
): Promise<void> {
  const message = buildCaption(userCaption);

  try {
    if (isVideo) {
      await Share.shareSingle({
        backgroundVideo: mediaUri,
        social: Social.FacebookStories,
        appId: FB_APP_ID,
      });
    } else {
      await Share.shareSingle({
        stickerImage: mediaUri,
        backgroundTopColor: '#FFF3EB',
        backgroundBottomColor: '#FFE6DA',
        social: Social.FacebookStories,
        appId: FB_APP_ID,
      });
    }
  } catch {
    try {
      await Share.open({
        url: mediaUri,
        message,
        type: isVideo ? 'video/mp4' : 'image/png',
      });
    } catch {
      // User cancelled
    }
  }
}
