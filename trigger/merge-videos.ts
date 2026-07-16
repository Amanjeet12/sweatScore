import { logger, task } from '@trigger.dev/sdk/v3';
import ffmpeg from 'fluent-ffmpeg';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

/**
 * FFmpeg paths provided by the Trigger.dev FFmpeg extension.
 */
if (process.env.FFMPEG_PATH) {
  ffmpeg.setFfmpegPath(process.env.FFMPEG_PATH);
}

if (process.env.FFPROBE_PATH) {
  ffmpeg.setFfprobePath(process.env.FFPROBE_PATH);
}

type MergeVideosPayload = {
  adminVideoUrl: string;
  userVideoUrl: string;

  challengeCompletionId: string;
  userId: string;
  caption: string;
  challengeId: string;

  /**
   * Day 1:
   * Left side is the predefined challenge video, so this
   * should normally be undefined.
   *
   * Day 2 onward:
   * Left side is the user's Day 1 video, so use "Day 1".
   */
  leftLabel?: string;

  /**
   * Label for the current recording:
   * Day 1, Day 2, Day 3, etc.
   */
  rightLabel?: string;

  convexSiteUrl: string;
  triggerSecret: string;
};

/**
 * Resolve a font that works in local Windows development
 * and in the Trigger.dev Linux environment.
 */
function resolveFontFile(): string {
  const fontFile = path.join(process.cwd(), 'assets', 'fonts', 'Roboto-Medium.ttf');

  if (!fs.existsSync(fontFile)) {
    throw new Error(`Video label font was not found at: ${fontFile}`);
  }

  return fontFile;
}

/**
 * Convert Windows paths for use inside FFmpeg filter syntax.
 *
 * C:/Windows/Fonts/arialbd.ttf
 * becomes
 * C\:/Windows/Fonts/arialbd.ttf
 */
function escapeFilterPath(filePath: string): string {
  return filePath.replace(/\\/g, '/').replace(/:/g, '\\:').replace(/'/g, "\\'");
}

/**
 * Escape text used by FFmpeg's drawtext filter.
 */
function escapeDrawText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/:/g, '\\:')
    .replace(/'/g, "\\'")
    .replace(/%/g, '\\%');
}

/**
 * Build the FFmpeg drawtext filter.
 *
 * Important:
 * It must start with:
 *
 * drawtext=fontfile=...
 *
 * It must not start with:
 *
 * drawtext:fontfile=...
 */
function createLabelFilter(label: string | undefined, fontFile: string): string {
  const trimmedLabel = label?.trim();

  if (!trimmedLabel) {
    return '';
  }

  const safeLabel = escapeDrawText(trimmedLabel);
  const safeFontFile = escapeFilterPath(fontFile);

  const options = [
    `fontfile='${safeFontFile}'`,
    `text='${safeLabel}'`,
    'fontcolor=white',
    'fontsize=28',
    'box=1',
    'boxcolor=black@0.70',
    'boxborderw=12',
    'x=24',
    'y=h-th-28',
    'fix_bounds=1',
    'expansion=none',
  ];

  return `drawtext=${options.join(':')}`;
}

/**
 * Scale and crop one video to 540 × 960, then optionally
 * burn the day label into the bottom-left corner.
 */
function buildVideoFilter(label: string | undefined, fontFile: string): string {
  const filters = [
    'fps=24',
    'scale=540:960:force_original_aspect_ratio=increase',
    'crop=540:960',
    'setsar=1',
    'setpts=PTS-STARTPTS',
  ];

  const labelFilter = createLabelFilter(label, fontFile);

  if (labelFilter) {
    filters.push(labelFilter);
  }

  return filters.join(',');
}

/**
 * Download a remote file to the temporary task directory.
 */
async function downloadFile(
  url: string,
  destinationPath: string,
  description: string
): Promise<void> {
  logger.log(`Downloading ${description}`, {
    destinationPath,
  });

  const response = await fetch(url);

  if (!response.ok) {
    throw new Error(`Failed to download ${description}: ${response.status} ${response.statusText}`);
  }

  const buffer = Buffer.from(await response.arrayBuffer());

  if (buffer.length === 0) {
    throw new Error(`${description} downloaded as an empty file`);
  }

  fs.writeFileSync(destinationPath, buffer);

  logger.log(`${description} downloaded`, {
    destinationPath,
    sizeBytes: buffer.length,
  });
}

/**
 * Safely remove a temporary file.
 */
function removeTemporaryFile(filePath: string): void {
  try {
    if (fs.existsSync(filePath)) {
      fs.unlinkSync(filePath);
    }
  } catch (error) {
    logger.warn('Unable to remove temporary file', {
      filePath,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export const mergeVideosTask = task({
  id: 'merge-videos',

  maxDuration: 600,

  machine: {
    preset: 'medium-2x',
  },

  run: async (payload: MergeVideosPayload) => {
    const temporaryDirectory = os.tmpdir();
    const timestamp = Date.now();

    const adminVideoPath = path.join(temporaryDirectory, `admin_${timestamp}.mp4`);

    const userVideoPath = path.join(temporaryDirectory, `user_${timestamp}.mp4`);

    const outputPath = path.join(temporaryDirectory, `composite_${timestamp}.mp4`);

    const thumbnailPath = path.join(temporaryDirectory, `thumbnail_${timestamp}.jpg`);

    try {
      logger.log('Starting challenge video merge', {
        challengeCompletionId: payload.challengeCompletionId,

        challengeId: payload.challengeId,

        leftLabel: payload.leftLabel ?? null,

        rightLabel: payload.rightLabel ?? null,

        ffmpegPath: process.env.FFMPEG_PATH ?? 'not set',

        ffprobePath: process.env.FFPROBE_PATH ?? 'not set',

        platform: process.platform,
      });

      const videoFontFile = resolveFontFile();

      logger.log('Using video label font', {
        videoFontFile,
      });

      await downloadFile(payload.adminVideoUrl, adminVideoPath, 'left challenge video');

      await downloadFile(payload.userVideoUrl, userVideoPath, 'right user video');

      const leftVideoFilter = buildVideoFilter(payload.leftLabel, videoFontFile);

      const rightVideoFilter = buildVideoFilter(payload.rightLabel, videoFontFile);

      logger.log('Generated FFmpeg filters', {
        leftVideoFilter,
        rightVideoFilter,
      });

      console.log('\nLEFT FILTER:\n', leftVideoFilter);

      console.log('\nRIGHT FILTER:\n', rightVideoFilter);

      /**
       * Merge the two videos.
       *
       * Each side is 540 × 960.
       * Final video is 1080 × 960.
       */
      await new Promise<void>((resolve, reject) => {
        ffmpeg()
          .input(adminVideoPath)
          .input(userVideoPath)

          .complexFilter([
            `[0:v]${leftVideoFilter}[left]`,

            `[1:v]${rightVideoFilter}[right]`,

            '[left][right]hstack=inputs=2:shortest=1[v]',
          ])

          .outputOptions([
            '-map',
            '[v]',

            /**
             * Keep audio from the left video when present.
             * The question mark makes the audio stream optional.
             */
            '-map',
            '0:a?',

            '-c:v',
            'libx264',

            '-preset',
            'fast',

            '-crf',
            '23',

            '-pix_fmt',
            'yuv420p',

            '-c:a',
            'aac',

            '-b:a',
            '128k',

            '-movflags',
            '+faststart',

            '-shortest',
          ])

          .output(outputPath)

          .on('start', (commandLine: string) => {
            logger.log('FFmpeg merge command started', {
              commandLine,
            });

            console.log(
              '\n========== FFMPEG COMMAND ==========\n',
              commandLine,
              '\n====================================\n'
            );
          })

          .on('progress', (progress) => {
            logger.log('FFmpeg merge progress', {
              percent: progress.percent ?? null,

              timemark: progress.timemark ?? null,

              currentFps: progress.currentFps ?? null,
            });
          })

          .on('end', () => {
            logger.log('FFmpeg video merge completed');

            resolve();
          })

          .on('error', (error: Error, stdout: string | null, stderr: string | null) => {
            logger.error('FFmpeg video merge failed', {
              error: error.message,

              stdout: stdout ?? '',

              stderr: stderr ?? '',
            });

            console.error(
              '\n========== FFMPEG STDERR ==========\n',
              stderr ?? 'No FFmpeg stderr was returned',
              '\n===================================\n'
            );

            reject(error);
          })

          .run();
      });

      if (!fs.existsSync(outputPath)) {
        throw new Error('Composite video file was not created');
      }

      const outputStats = fs.statSync(outputPath);

      if (outputStats.size === 0) {
        throw new Error('Composite video file is empty');
      }

      logger.log('Composite video generated', {
        outputPath,
        sizeBytes: outputStats.size,
      });

      /**
       * Extract the first frame as the feed thumbnail.
       * Since the labels are burned into the video,
       * they will also appear in this thumbnail.
       */
      logger.log('Generating composite thumbnail');

      await new Promise<void>((resolve, reject) => {
        ffmpeg(outputPath)
          .outputOptions(['-frames:v', '1', '-q:v', '5'])

          .output(thumbnailPath)

          .on('end', () => {
            logger.log('Thumbnail generation completed');

            resolve();
          })

          .on('error', (error: Error, stdout: string | null, stderr: string | null) => {
            logger.error('Thumbnail generation failed', {
              error: error.message,

              stdout: stdout ?? '',

              stderr: stderr ?? '',
            });

            console.error(
              '\n======= THUMBNAIL FFMPEG STDERR =======\n',
              stderr ?? 'No thumbnail stderr was returned',
              '\n=======================================\n'
            );

            reject(error);
          })

          .run();
      });

      logger.log('Uploading composite video and thumbnail');

      /**
       * Generate an upload URL for the composite video.
       */
      const uploadUrlResponse = await fetch(`${payload.convexSiteUrl}/api/generate-upload-url`, {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',

          Authorization: `Bearer ${payload.triggerSecret}`,
        },
      });

      if (!uploadUrlResponse.ok) {
        const responseText = await uploadUrlResponse.text();

        throw new Error(
          `Failed to generate composite upload URL: ${uploadUrlResponse.status} ${responseText}`
        );
      }

      const { uploadUrl } = (await uploadUrlResponse.json()) as {
        uploadUrl: string;
      };

      /**
       * Upload the composite video.
       */
      const compositeBuffer = fs.readFileSync(outputPath);

      const uploadResponse = await fetch(uploadUrl, {
        method: 'POST',

        headers: {
          'Content-Type': 'video/mp4',
        },

        body: compositeBuffer,
      });

      if (!uploadResponse.ok) {
        const responseText = await uploadResponse.text();

        throw new Error(
          `Failed to upload composite video: ${uploadResponse.status} ${responseText}`
        );
      }

      const { storageId } = (await uploadResponse.json()) as {
        storageId: string;
      };

      logger.log('Composite video uploaded', {
        storageId,

        sizeBytes: compositeBuffer.length,
      });

      /**
       * Upload the thumbnail.
       */
      let thumbnailStorageId: string | undefined;

      if (fs.existsSync(thumbnailPath)) {
        const thumbnailStats = fs.statSync(thumbnailPath);

        if (thumbnailStats.size > 0) {
          const thumbUploadUrlResponse = await fetch(
            `${payload.convexSiteUrl}/api/generate-upload-url`,
            {
              method: 'POST',

              headers: {
                'Content-Type': 'application/json',

                Authorization: `Bearer ${payload.triggerSecret}`,
              },
            }
          );

          if (!thumbUploadUrlResponse.ok) {
            logger.warn('Unable to generate thumbnail upload URL', {
              status: thumbUploadUrlResponse.status,

              response: await thumbUploadUrlResponse.text(),
            });
          } else {
            const { uploadUrl: thumbnailUploadUrl } = (await thumbUploadUrlResponse.json()) as {
              uploadUrl: string;
            };

            const thumbnailBuffer = fs.readFileSync(thumbnailPath);

            const thumbnailUploadResponse = await fetch(thumbnailUploadUrl, {
              method: 'POST',

              headers: {
                'Content-Type': 'image/jpeg',
              },

              body: thumbnailBuffer,
            });

            if (thumbnailUploadResponse.ok) {
              const thumbnailData = (await thumbnailUploadResponse.json()) as {
                storageId: string;
              };

              thumbnailStorageId = thumbnailData.storageId;

              logger.log('Thumbnail uploaded', {
                thumbnailStorageId,

                sizeBytes: thumbnailBuffer.length,
              });
            } else {
              logger.warn('Thumbnail upload failed', {
                status: thumbnailUploadResponse.status,

                response: await thumbnailUploadResponse.text(),
              });
            }
          }
        }
      }

      /**
       * Save the composite video and thumbnail
       * on the challenge completion.
       */
      const patchResponse = await fetch(`${payload.convexSiteUrl}/api/patch-composite`, {
        method: 'POST',

        headers: {
          'Content-Type': 'application/json',

          Authorization: `Bearer ${payload.triggerSecret}`,
        },

        body: JSON.stringify({
          challengeCompletionId: payload.challengeCompletionId,

          compositeVideoStorageId: storageId,

          ...(thumbnailStorageId
            ? {
                thumbnailStorageId,
              }
            : {}),
        }),
      });

      if (!patchResponse.ok) {
        const responseText = await patchResponse.text();

        throw new Error(
          `Failed to patch challenge completion: ${patchResponse.status} ${responseText}`
        );
      }

      logger.log('Composite video saved to challenge completion', {
        challengeCompletionId: payload.challengeCompletionId,

        compositeVideoStorageId: storageId,

        thumbnailStorageId: thumbnailStorageId ?? null,
      });

      /**
       * Create the community feed post.
       */
      logger.log('Creating community challenge post');

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
        const responseText = await createPostResponse.text();

        throw new Error(
          `Failed to create challenge post: ${createPostResponse.status} ${responseText}`
        );
      }

      const createPostResult = (await createPostResponse.json()) as {
        success: boolean;
        postId?: string;
        skipped?: boolean;
        reason?: string;
      };

      const postId = createPostResult.postId;

      if (!postId) {
        logger.warn('Community post was not created', {
          skipped: createPostResult.skipped ?? false,

          reason: createPostResult.reason ?? 'unknown',
        });

        return {
          success: true,
          storageId,
          thumbnailStorageId: thumbnailStorageId ?? null,
          postId: null,
          postSkipped: true,
        };
      }

      logger.log('Community challenge post created', {
        postId,
      });

      /**
       * Send the notification only after the post
       * has been created successfully.
       */
      logger.log('Sending challenge post notification');

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
        logger.warn('Challenge notification failed', {
          status: notifyResponse.status,

          response: await notifyResponse.text(),
        });
      } else {
        logger.log('Challenge notification sent');
      }

      logger.log('Challenge composite post flow completed', {
        storageId,

        thumbnailStorageId: thumbnailStorageId ?? null,

        postId,
      });

      return {
        success: true,
        storageId,
        thumbnailStorageId: thumbnailStorageId ?? null,
        postId,
        postSkipped: false,
      };
    } catch (error) {
      logger.error('Challenge video merge task failed', {
        challengeCompletionId: payload.challengeCompletionId,

        challengeId: payload.challengeId,

        error: error instanceof Error ? error.message : String(error),
      });

      throw error;
    } finally {
      removeTemporaryFile(adminVideoPath);

      removeTemporaryFile(userVideoPath);

      removeTemporaryFile(outputPath);

      removeTemporaryFile(thumbnailPath);

      logger.log('Temporary video files cleaned up');
    }
  },
});
