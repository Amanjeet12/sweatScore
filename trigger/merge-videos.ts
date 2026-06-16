import { logger, task } from '@trigger.dev/sdk/v3';
import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

// Set ffmpeg path from env (set by Trigger.dev ffmpeg() extension)
if (process.env.FFMPEG_PATH) {
  ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
}

export const mergeVideosTask = task({
  id: 'merge-videos',
  maxDuration: 600, // 10 minutes max (free plan limit)
  machine: { preset: 'medium-2x' }, // 2 vCPU, 4 GB RAM for video processing
  run: async (payload: {
    adminVideoUrl: string;
    userVideoUrl: string;
    challengeCompletionId: string;
    userId: string;
    caption: string;
    challengeId: string;
    convexSiteUrl: string;
    triggerSecret: string;
  }) => {
    const tmpDir = os.tmpdir();
    const ts = Date.now();
    const adminVideoPath = path.join(tmpDir, `admin_${ts}.mp4`);
    const userVideoPath = path.join(tmpDir, `user_${ts}.mp4`);
    const outputPath = path.join(tmpDir, `composite_${ts}.mp4`);
    const thumbnailPath = path.join(tmpDir, `thumb_${ts}.jpg`);

    try {
      // Log ffmpeg path for debugging
      logger.log('FFMPEG_PATH:', process.env.FFMPEG_PATH ?? 'not set');

      // Download admin video
      logger.log('Downloading admin video...');
      const adminResponse = await fetch(payload.adminVideoUrl);
      const adminBuffer = Buffer.from(await adminResponse.arrayBuffer());
      fs.writeFileSync(adminVideoPath, adminBuffer);

      // Download user video
      logger.log('Downloading user video...');
      const userResponse = await fetch(payload.userVideoUrl);
      const userBuffer = Buffer.from(await userResponse.arrayBuffer());
      fs.writeFileSync(userVideoPath, userBuffer);

      // Merge side-by-side into square (1080x1080)
      logger.log('Merging videos side-by-side...');
      await new Promise<void>((resolve, reject) => {
        ffmpeg()
          .input(adminVideoPath)
          .input(userVideoPath)
          .complexFilter([
            '[0:v]fps=24,scale=540:960:force_original_aspect_ratio=increase,crop=540:960[left]',
            '[1:v]fps=24,hflip,scale=540:960:force_original_aspect_ratio=increase,crop=540:960[right]',
            '[left][right]hstack=inputs=2[v]',
          ])
          .outputOptions([
            '-map',
            '[v]',
            '-map',
            '0:a?',
            '-c:v',
            'libx264',
            '-preset',
            'fast',
            '-crf',
            '23',
            '-c:a',
            'aac',
            '-b:a',
            '128k',
            '-movflags',
            '+faststart',
            '-shortest',
          ])
          .output(outputPath)
          .on('end', () => resolve())
          .on('error', (err: Error) => reject(err))
          .run();
      });

      // Extract first frame as JPEG thumbnail
      logger.log('Extracting thumbnail...');
      await new Promise<void>((resolve, reject) => {
        ffmpeg(outputPath)
          .outputOptions(['-vframes', '1', '-q:v', '5'])
          .output(thumbnailPath)
          .on('end', () => resolve())
          .on('error', (err: Error) => reject(err))
          .run();
      });

      logger.log('Merge complete, uploading composite + thumbnail...');

      // Step 1a: Get upload URL for composite video
      const uploadUrlResponse = await fetch(`${payload.convexSiteUrl}/api/generate-upload-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${payload.triggerSecret}`,
        },
      });

      if (!uploadUrlResponse.ok) {
        throw new Error(`Failed to get upload URL: ${uploadUrlResponse.statusText}`);
      }

      const { uploadUrl } = (await uploadUrlResponse.json()) as { uploadUrl: string };

      // Step 2: Upload the merged video to Convex storage
      const compositeBuffer = fs.readFileSync(outputPath);
      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'video/mp4' },
        body: compositeBuffer,
      });

      if (!uploadResponse.ok) {
        throw new Error(`Failed to upload composite: ${uploadResponse.statusText}`);
      }

      const { storageId } = (await uploadResponse.json()) as { storageId: string };
      logger.log('Composite uploaded', { storageId });

      // Step 1b: Upload thumbnail
      let thumbnailStorageId: string | undefined;
      if (fs.existsSync(thumbnailPath)) {
        const thumbUploadUrlRes = await fetch(`${payload.convexSiteUrl}/api/generate-upload-url`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${payload.triggerSecret}`,
          },
        });
        if (thumbUploadUrlRes.ok) {
          const { uploadUrl: thumbUploadUrl } = (await thumbUploadUrlRes.json()) as {
            uploadUrl: string;
          };
          const thumbBuffer = fs.readFileSync(thumbnailPath);
          const thumbRes = await fetch(thumbUploadUrl, {
            method: 'POST',
            headers: { 'Content-Type': 'image/jpeg' },
            body: thumbBuffer,
          });
          if (thumbRes.ok) {
            const thumbData = (await thumbRes.json()) as { storageId: string };
            thumbnailStorageId = thumbData.storageId;
            logger.log('Thumbnail uploaded', { thumbnailStorageId });
          }
        }
      }

      // Step 3: Patch the completion record
      const patchResponse = await fetch(`${payload.convexSiteUrl}/api/patch-composite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${payload.triggerSecret}`,
        },
        body: JSON.stringify({
          challengeCompletionId: payload.challengeCompletionId,
          compositeVideoStorageId: storageId,
          ...(thumbnailStorageId ? { thumbnailStorageId } : {}),
        }),
      });

      if (!patchResponse.ok) {
        throw new Error(`Failed to patch completion: ${patchResponse.statusText}`);
      }

      logger.log('Composite video saved to completion record');

      // Step 4: Create community post with composite video
      logger.log('Creating community post...');
      const createPostResponse = await fetch(`${payload.convexSiteUrl}/api/create-challenge-post`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${payload.triggerSecret}`,
        },
        body: JSON.stringify({
          userId: payload.userId,
          challengeId: payload.challengeId,
          challengeCompletionId: payload.challengeCompletionId,
          compositeVideoStorageId: storageId,
          caption: payload.caption,
        }),
      });

      if (!createPostResponse.ok) {
        throw new Error(`Failed to create post: ${createPostResponse.statusText}`);
      }

      const { postId } = (await createPostResponse.json()) as { postId: string };
      logger.log('Post created', { postId });

      // Step 5: Send push notification to user
      logger.log('Sending notification...');
      const notifyResponse = await fetch(
        `${payload.convexSiteUrl}/api/send-challenge-notification`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${payload.triggerSecret}`,
          },
          body: JSON.stringify({
            userId: payload.userId,
            postId,
          }),
        }
      );

      if (!notifyResponse.ok) {
        logger.log('Failed to send notification:', notifyResponse.statusText);
      }

      logger.log('Challenge post flow complete');

      return { success: true, storageId, postId };
    } finally {
      // Cleanup temp files
      if (fs.existsSync(adminVideoPath)) fs.unlinkSync(adminVideoPath);
      if (fs.existsSync(userVideoPath)) fs.unlinkSync(userVideoPath);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      if (fs.existsSync(thumbnailPath)) fs.unlinkSync(thumbnailPath);
    }
  },
});
