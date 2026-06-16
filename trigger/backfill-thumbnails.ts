import { logger, task } from '@trigger.dev/sdk/v3';
import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

if (process.env.FFMPEG_PATH) {
  ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
}

/**
 * Batch orchestrator — run this from the Trigger.dev dashboard Test page.
 *
 * Payload: { convexSiteUrl: string, triggerSecret: string }
 *
 * It fetches all completions missing thumbnails from Convex,
 * then triggers a backfill-thumbnail task for each one.
 */
export const backfillAllThumbnailsTask = task({
  id: 'backfill-all-thumbnails',
  maxDuration: 300,
  run: async () => {
    const convexSiteUrl = process.env.CONVEX_SITE_URL!;
    const triggerSecret = process.env.TRIGGER_SECRET!;

    const res = await fetch(`${convexSiteUrl}/api/completions-needing-thumbnail`, {
      headers: { Authorization: `Bearer ${triggerSecret}` },
    });

    if (!res.ok) {
      throw new Error(`Failed to fetch completions: ${res.statusText}`);
    }

    const { completions } = (await res.json()) as {
      completions: { completionId: string; compositeVideoUrl: string }[];
    };

    logger.log(`Found ${completions.length} posts needing thumbnails`);

    if (completions.length === 0) {
      return { success: true, count: 0 };
    }

    const items = completions.map((c) => ({
      payload: {
        compositeVideoUrl: c.compositeVideoUrl,
        challengeCompletionId: c.completionId,
      },
    }));

    await backfillThumbnailTask.batchTrigger(items);

    logger.log(`Triggered ${completions.length} backfill tasks`);
    return { success: true, count: completions.length };
  },
});

/**
 * Single backfill — generates thumbnail for one completion.
 */
export const backfillThumbnailTask = task({
  id: 'backfill-thumbnail',
  maxDuration: 120,
  machine: { preset: 'small-2x' },
  run: async (payload: { compositeVideoUrl: string; challengeCompletionId: string }) => {
    const convexSiteUrl = process.env.CONVEX_SITE_URL!;
    const triggerSecret = process.env.TRIGGER_SECRET!;

    const tmpDir = os.tmpdir();
    const ts = Date.now();
    const videoPath = path.join(tmpDir, `backfill_video_${ts}.mp4`);
    const thumbnailPath = path.join(tmpDir, `backfill_thumb_${ts}.jpg`);

    try {
      logger.log('Downloading composite video...', {
        completionId: payload.challengeCompletionId,
      });
      const response = await fetch(payload.compositeVideoUrl);
      const buffer = Buffer.from(await response.arrayBuffer());
      fs.writeFileSync(videoPath, buffer);

      logger.log('Extracting thumbnail...');
      await new Promise<void>((resolve, reject) => {
        ffmpeg(videoPath)
          .outputOptions(['-vframes', '1', '-q:v', '5'])
          .output(thumbnailPath)
          .on('end', () => resolve())
          .on('error', (err: Error) => reject(err))
          .run();
      });

      if (!fs.existsSync(thumbnailPath)) {
        throw new Error('Thumbnail extraction failed — file not created');
      }

      const uploadUrlRes = await fetch(`${convexSiteUrl}/api/generate-upload-url`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${triggerSecret}`,
        },
      });

      if (!uploadUrlRes.ok) {
        throw new Error(`Failed to get upload URL: ${uploadUrlRes.statusText}`);
      }

      const { uploadUrl } = (await uploadUrlRes.json()) as { uploadUrl: string };
      const thumbBuffer = fs.readFileSync(thumbnailPath);
      const uploadRes = await fetch(uploadUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'image/jpeg' },
        body: thumbBuffer,
      });

      if (!uploadRes.ok) {
        throw new Error(`Failed to upload thumbnail: ${uploadRes.statusText}`);
      }

      const { storageId: thumbnailStorageId } = (await uploadRes.json()) as {
        storageId: string;
      };

      const patchRes = await fetch(`${convexSiteUrl}/api/patch-composite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${triggerSecret}`,
        },
        body: JSON.stringify({
          challengeCompletionId: payload.challengeCompletionId,
          thumbnailStorageId,
        }),
      });

      if (!patchRes.ok) {
        throw new Error(`Failed to patch completion: ${patchRes.statusText}`);
      }

      logger.log('Backfill complete', {
        completionId: payload.challengeCompletionId,
        thumbnailStorageId,
      });

      return { success: true, thumbnailStorageId };
    } finally {
      if (fs.existsSync(videoPath)) fs.unlinkSync(videoPath);
      if (fs.existsSync(thumbnailPath)) fs.unlinkSync(thumbnailPath);
    }
  },
});
