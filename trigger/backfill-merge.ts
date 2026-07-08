import { logger, task } from '@trigger.dev/sdk/v3';
import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

if (process.env.FFMPEG_PATH) {
  ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
}

/**
 * Run from Trigger.dev dashboard Test page with empty payload: {}
 *
 * 1. Finds all challengeCompletions missing compositeVideoStorageId
 * 2. For each: merges admin + user video, extracts thumbnail
 * 3. Uploads composite + thumbnail to Convex
 * 4. Patches completion with compositeVideoStorageId + thumbnailStorageId
 * 5. Updates the associated post's media to the composite video
 */
export const backfillAllMergesTask = task({
  id: 'backfill-all-merges',
  maxDuration: 300,
  run: async () => {
    const convexSiteUrl = process.env.CONVEX_SITE_URL!;
    const triggerSecret = process.env.TRIGGER_SECRET!;

    const res = await fetch(`${convexSiteUrl}/api/completions-needing-merge`, {
      headers: { Authorization: `Bearer ${triggerSecret}` },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch completions: ${res.statusText}`);
    }

    const { completions } = (await res.json()) as {
      completions: {
        completionId: string;
        postId: string | null;
        adminVideoUrl: string;
        userVideoUrl: string;
      }[];
    };

    logger.log(`Found ${completions.length} completions needing merge`);

    if (completions.length === 0) {
      return { success: true, count: 0 };
    }

    const items = completions.map((c) => ({
      payload: {
        completionId: c.completionId,
        postId: c.postId,
        adminVideoUrl: c.adminVideoUrl,
        userVideoUrl: c.userVideoUrl,
      },
    }));

    await backfillMergeTask.batchTrigger(items);

    logger.log(`Triggered ${completions.length} merge tasks`);
    return { success: true, count: completions.length };
  },
});

/**
 * Single backfill merge — merges videos, generates thumbnail,
 * uploads both, patches completion + post.
 */
export const backfillMergeTask = task({
  id: 'backfill-merge',
  maxDuration: 600,
  machine: { preset: 'medium-2x' },
  run: async (payload: {
    completionId: string;
    postId: string | null;
    adminVideoUrl: string;
    userVideoUrl: string;
  }) => {
    const convexSiteUrl = process.env.CONVEX_SITE_URL!;
    const triggerSecret = process.env.TRIGGER_SECRET!;

    const tmpDir = os.tmpdir();
    const ts = Date.now();
    const adminVideoPath = path.join(tmpDir, `bf_admin_${ts}.mp4`);
    const userVideoPath = path.join(tmpDir, `bf_user_${ts}.mp4`);
    const outputPath = path.join(tmpDir, `bf_composite_${ts}.mp4`);
    const thumbnailPath = path.join(tmpDir, `bf_thumb_${ts}.jpg`);

    try {
      // Download videos
      logger.log('Downloading admin video...');
      const adminBuf = Buffer.from(await (await fetch(payload.adminVideoUrl)).arrayBuffer());
      fs.writeFileSync(adminVideoPath, adminBuf);

      logger.log('Downloading user video...');
      const userBuf = Buffer.from(await (await fetch(payload.userVideoUrl)).arrayBuffer());
      fs.writeFileSync(userVideoPath, userBuf);

      // Merge side-by-side
      logger.log('Merging videos...');
      await new Promise<void>((resolve, reject) => {
        ffmpeg()
          .input(adminVideoPath)
          .input(userVideoPath)
          .complexFilter([
            '[0:v]fps=24,scale=540:960:force_original_aspect_ratio=increase,crop=540:960[left]',
            '[1:v]fps=24,scale=540:960:force_original_aspect_ratio=increase,crop=540:960[right]',
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

      // Extract thumbnail
      logger.log('Extracting thumbnail...');
      await new Promise<void>((resolve, reject) => {
        ffmpeg(outputPath)
          .outputOptions(['-vframes', '1', '-q:v', '5'])
          .output(thumbnailPath)
          .on('end', () => resolve())
          .on('error', (err: Error) => reject(err))
          .run();
      });

      // Helper to upload a file to Convex storage
      const uploadToConvex = async (filePath: string, contentType: string) => {
        const urlRes = await fetch(`${convexSiteUrl}/api/generate-upload-url`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${triggerSecret}`,
          },
        });
        if (!urlRes.ok) throw new Error(`Upload URL failed: ${urlRes.statusText}`);
        const { uploadUrl } = (await urlRes.json()) as { uploadUrl: string };

        const buf = fs.readFileSync(filePath);
        const upRes = await fetch(uploadUrl, {
          method: 'POST',
          headers: { 'Content-Type': contentType },
          body: buf,
        });
        if (!upRes.ok) throw new Error(`Upload failed: ${upRes.statusText}`);
        const { storageId } = (await upRes.json()) as { storageId: string };
        return storageId;
      };

      // Upload composite video
      logger.log('Uploading composite video...');
      const compositeStorageId = await uploadToConvex(outputPath, 'video/mp4');

      // Upload thumbnail
      let thumbnailStorageId: string | undefined;
      if (fs.existsSync(thumbnailPath)) {
        logger.log('Uploading thumbnail...');
        thumbnailStorageId = await uploadToConvex(thumbnailPath, 'image/jpeg');
      }

      // Patch completion record with composite + thumbnail
      logger.log('Patching completion...');
      const patchRes = await fetch(`${convexSiteUrl}/api/patch-composite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${triggerSecret}`,
        },
        body: JSON.stringify({
          challengeCompletionId: payload.completionId,
          compositeVideoStorageId: compositeStorageId,
          ...(thumbnailStorageId ? { thumbnailStorageId } : {}),
        }),
      });
      if (!patchRes.ok) throw new Error(`Patch completion failed: ${patchRes.statusText}`);

      // Update associated post media to composite video
      if (payload.postId) {
        logger.log('Updating post media...');
        const postRes = await fetch(`${convexSiteUrl}/api/patch-post-media`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${triggerSecret}`,
          },
          body: JSON.stringify({
            postId: payload.postId,
            media: compositeStorageId,
          }),
        });
        if (!postRes.ok) throw new Error(`Patch post failed: ${postRes.statusText}`);
      }

      logger.log('Backfill merge complete', {
        completionId: payload.completionId,
        compositeStorageId,
        thumbnailStorageId,
      });

      return { success: true, compositeStorageId, thumbnailStorageId };
    } finally {
      if (fs.existsSync(adminVideoPath)) fs.unlinkSync(adminVideoPath);
      if (fs.existsSync(userVideoPath)) fs.unlinkSync(userVideoPath);
      if (fs.existsSync(outputPath)) fs.unlinkSync(outputPath);
      if (fs.existsSync(thumbnailPath)) fs.unlinkSync(thumbnailPath);
    }
  },
});
