import { ImagePickerAsset } from 'expo-image-picker';
import { Platform, Image } from 'react-native';

import { formatPoints } from './formatter';

export const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

// Supported media formats
const SUPPORTED_FORMATS = {
  IMAGE: {
    'image/jpeg': ['.jpg', '.jpeg'],
    'image/gif': ['.gif'],
    'image/png': ['.png'],
  },
  VIDEO: {
    'video/mp4': ['.mp4'],
    'video/quicktime': ['.mov'],
    'video/x-msvideo': ['.avi'],
    'video/webm': ['.webm'],
  },
};

const getMediaTypeFromUrl = (
  url: string,
  contentType?: string
): { type: string; isVideo: boolean } => {
  // First try to determine type from content-type header
  if (contentType) {
    if (contentType.startsWith('video/')) {
      return { type: contentType, isVideo: true };
    }
    if (contentType.startsWith('image/')) {
      return { type: contentType, isVideo: false };
    }
  }

  // Fallback to extension checking
  const extension = url.toLowerCase().split('.').pop() || '';
  const fullExtension = `.${extension}`;

  // Check video formats
  for (const [mimeType, extensions] of Object.entries(SUPPORTED_FORMATS.VIDEO)) {
    if (extensions.includes(fullExtension)) {
      return { type: mimeType, isVideo: true };
    }
  }

  // Check image formats
  for (const [mimeType, extensions] of Object.entries(SUPPORTED_FORMATS.IMAGE)) {
    if (extensions.includes(fullExtension)) {
      return { type: mimeType, isVideo: false };
    }
  }

  // Default to JPEG if can't determine
  return { type: 'image/jpeg', isVideo: false };
};

const getImageDimensions = (imageUrl: string): Promise<{ width: number; height: number }> => {
  return new Promise((resolve, reject) => {
    Image.getSize(
      imageUrl,
      (width, height) => resolve({ width, height }),
      (error) => reject(error)
    );
  });
};

export const urlToImagePickerAsset = async (mediaUrl: string): Promise<ImagePickerAsset | null> => {
  try {
    // Get file info using fetch HEAD request
    const response = await fetch(mediaUrl, { method: 'HEAD' });
    const contentType = response.headers.get('content-type');
    const contentLength = response.headers.get('content-length');

    // Determine media type
    const { type, isVideo } = getMediaTypeFromUrl(mediaUrl, contentType || undefined);

    // Extract filename from URL and ensure it has the correct extension
    let fileName = mediaUrl.split('/').pop() || 'file';
    if (!fileName.includes('.')) {
      const extension = type.split('/')[1];
      fileName += `.${extension}`;
    }

    try {
      // Handle images as before
      const dimensions = await getImageDimensions(mediaUrl);
      return {
        uri: Platform.OS === 'ios' ? mediaUrl.replace('file://', '') : mediaUrl,
        fileName,
        type: 'image',
        fileSize: contentLength ? parseInt(contentLength) : 0,
        width: dimensions.width,
        height: dimensions.height,
        duration: null,
        assetId: null,
        base64: null,
      };
    } catch (metadataError) {
      console.warn('Failed to get media metadata:', metadataError);
      // For images or if thumbnail generation fails
      return {
        uri: mediaUrl,
        fileName,
        type: 'image',
        fileSize: contentLength ? parseInt(contentLength) : 0,
        width: 0,
        height: 0,
        duration: null,
        assetId: null,
        base64: null,
      };
    }
  } catch (error) {
    return null;
  }
};

export const pointText = (points: number | undefined, showPlus = true, showPoints = true) => {
  if (!points || points === 0) {
    return `0${showPoints ? ' pts' : ''}`;
  }

  if (points === 1) {
    return showPlus ? `+1${showPoints ? ' pt' : ''}` : `1${showPoints ? ' pt' : ''}`;
  }

  return showPlus
    ? `+${formatPoints(points)}${showPoints ? ' pts' : ''}`
    : `${formatPoints(points)}${showPoints ? ' pts' : ''}`;
};
