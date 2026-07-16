import { useMutation } from 'convex/react';
import * as FileSystem from 'expo-file-system';
import {
  createContext,
  ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { AppState, AppStateStatus } from 'react-native';

import { ToastMessage } from '~/components/core/Toast';
import { useToast } from '~/components/ui/toast';
import { api } from '~/convex/_generated/api';
import { Id } from '~/convex/_generated/dataModel';
import { getErrorMessage } from '~/utils/error-message';
import { getData, storeData } from '~/utils/storage';
import * as VideoThumbnails from 'expo-video-thumbnails';

const CHALLENGE_UPLOAD_QUEUE_KEY = 'challenge-upload-queue:v1';
const MAX_AUTO_RETRIES = 3;
const RETRY_DELAYS_MS = [0, 5000, 15000, 30000];

export type ChallengeUploadJobStatus = 'queued' | 'uploading' | 'finalizing' | 'failed';

export interface ChallengeUploadJob {
  id: string;
  challengeId: string;
  videoUri: string;
  caption?: string;
  allowRepost: boolean;
  createdAt: number;
  updatedAt: number;
  retryCount: number;
  status: ChallengeUploadJobStatus;
  nextAttemptAt: number;
  lastError?: string;
  uploadedStorageId?: Id<'_storage'>;
  uploadedThumbnailStorageId?: Id<'_storage'>;
  thumbnailUri?: string;
}

interface EnqueueChallengeUploadInput {
  challengeId: string;
  videoUri: string;
  caption?: string;
  allowRepost: boolean;
}

interface ChallengeUploadContextValue {
  jobs: ChallengeUploadJob[];
  enqueueChallengeUpload: (input: EnqueueChallengeUploadInput) => Promise<void>;
  retryChallengeUpload: (challengeId: string) => void;
  getJobForChallenge: (challengeId: string) => ChallengeUploadJob | undefined;
}

const ChallengeUploadContext = createContext<ChallengeUploadContextValue | undefined>(undefined);

function isRetryableChallengeUploadError(message: string) {
  const normalized = message.toLowerCase();

  const nonRetryableFragments = [
    'already completed today',
    'challenge has ended',
    'challenge not found',
    'challenge is not available',
    'premium required',
    'unauthorized',
    'user not found',
    'saved recording could not be found',
    'daily challenge limit reached',
  ];

  return !nonRetryableFragments.some((fragment) => normalized.includes(fragment));
}

function getRetryDelayMs(retryCount: number) {
  return RETRY_DELAYS_MS[Math.min(retryCount, RETRY_DELAYS_MS.length - 1)] ?? 30000;
}

function normalizeStoredJobs(raw: unknown): ChallengeUploadJob[] {
  if (!Array.isArray(raw)) return [];

  return raw.flatMap((job) => {
    if (!job || typeof job !== 'object') return [];

    const candidate = job as Partial<ChallengeUploadJob>;

    if (!candidate.id || !candidate.challengeId || !candidate.videoUri) {
      return [];
    }

    const createdAt = typeof candidate.createdAt === 'number' ? candidate.createdAt : Date.now();

    return [
      {
        id: candidate.id,
        challengeId: candidate.challengeId,
        videoUri: candidate.videoUri,
        caption: candidate.caption?.trim() || undefined,
        allowRepost: Boolean(candidate.allowRepost),
        createdAt,
        updatedAt: typeof candidate.updatedAt === 'number' ? candidate.updatedAt : createdAt,
        retryCount: typeof candidate.retryCount === 'number' ? candidate.retryCount : 0,
        status: candidate.status === 'failed' ? 'failed' : 'queued',
        nextAttemptAt:
          typeof candidate.nextAttemptAt === 'number' ? candidate.nextAttemptAt : createdAt,
        lastError: candidate.lastError,
        uploadedStorageId:
          typeof candidate.uploadedStorageId === 'string'
            ? (candidate.uploadedStorageId as Id<'_storage'>)
            : undefined,
        thumbnailUri:
          typeof candidate.thumbnailUri === 'string' ? candidate.thumbnailUri : undefined,

        uploadedThumbnailStorageId:
          typeof candidate.uploadedThumbnailStorageId === 'string'
            ? (candidate.uploadedThumbnailStorageId as Id<'_storage'>)
            : undefined,
      },
    ];
  });
}

async function deleteLocalVideo(uri: string) {
  try {
    await FileSystem.deleteAsync(uri, {
      idempotent: true,
    });
  } catch {
    // Best effort cleanup.
  }
}

async function generateVideoThumbnail(videoUri: string): Promise<string> {
  const result = await VideoThumbnails.getThumbnailAsync(videoUri, {
    time: 300,
    quality: 0.8,
  });

  return result.uri;
}

export function ChallengeUploadProvider({ children }: { children: ReactNode }) {
  const toast = useToast();

  const generateUploadUrl = useMutation(api.upload.generateUploadUrl);
  const completeChallenge = useMutation(api.challengeCompletions.completeChallenge);

  const [jobs, setJobs] = useState<ChallengeUploadJob[]>([]);
  const [isHydrated, setIsHydrated] = useState(false);
  const [appState, setAppState] = useState<AppStateStatus>(AppState.currentState);
  const [retryWakeTick, setRetryWakeTick] = useState(0);

  const jobsRef = useRef<ChallengeUploadJob[]>([]);
  const processingJobIdRef = useRef<string | null>(null);

  const showToast = useCallback(
    (message: string, action: 'error' | 'success' | 'warning') => {
      toast.show({
        placement: 'top',
        duration: 7500,
        render: () => <ToastMessage message={message} action={action} />,
      });
    },
    [toast]
  );

  const saveJobs = useCallback(
    (updater: (current: ChallengeUploadJob[]) => ChallengeUploadJob[]) => {
      setJobs((current) => {
        const next = updater(current);

        if (isHydrated) {
          storeData(CHALLENGE_UPLOAD_QUEUE_KEY, next);
        }

        return next;
      });
    },
    [isHydrated]
  );

  const patchJob = useCallback(
    (jobId: string, patch: Partial<ChallengeUploadJob>) => {
      saveJobs((current) =>
        current.map((job) =>
          job.id === jobId
            ? {
                ...job,
                ...patch,
                updatedAt: Date.now(),
              }
            : job
        )
      );
    },
    [saveJobs]
  );

  const removeJob = useCallback(
    (jobId: string) => {
      saveJobs((current) => current.filter((job) => job.id !== jobId));
    },
    [saveJobs]
  );

  useEffect(() => {
    jobsRef.current = jobs;
  }, [jobs]);

  useEffect(() => {
    const storedJobs = normalizeStoredJobs(getData(CHALLENGE_UPLOAD_QUEUE_KEY));
    setJobs(storedJobs);
    setIsHydrated(true);
  }, []);

  useEffect(() => {
    if (!isHydrated) return;
    storeData(CHALLENGE_UPLOAD_QUEUE_KEY, jobs);
  }, [isHydrated, jobs]);

  useEffect(() => {
    const subscription = AppState.addEventListener('change', setAppState);
    return () => subscription.remove();
  }, []);

  const processJob = useCallback(
    async (jobId: string) => {
      const job = jobsRef.current.find((candidate) => candidate.id === jobId);

      if (!job) return;

      processingJobIdRef.current = jobId;

      // Keep this outside try so it is available during error cleanup.
      let thumbnailUri = job.thumbnailUri;

      try {
        // ---------------------------------------------------------
        // 1. Check that the recorded video still exists
        // ---------------------------------------------------------
        const fileInfo = await FileSystem.getInfoAsync(job.videoUri);

        if (!fileInfo.exists) {
          removeJob(jobId);

          showToast('Saved recording could not be found. Please record again.', 'error');

          return;
        }

        // ---------------------------------------------------------
        // 2. Check or generate the local video thumbnail
        // ---------------------------------------------------------
        if (thumbnailUri) {
          const thumbnailInfo = await FileSystem.getInfoAsync(thumbnailUri);

          if (!thumbnailInfo.exists) {
            thumbnailUri = undefined;
          }
        }

        if (!thumbnailUri) {
          thumbnailUri = await generateVideoThumbnail(job.videoUri);

          patchJob(jobId, {
            thumbnailUri,
          });
        }

        // ---------------------------------------------------------
        // 3. Upload the recorded video
        // ---------------------------------------------------------
        let uploadedStorageId = job.uploadedStorageId;

        if (!uploadedStorageId) {
          patchJob(jobId, {
            status: 'uploading',
            lastError: undefined,
          });

          const uploadUrl = await generateUploadUrl();

          if (!uploadUrl) {
            throw new Error('Could not create upload URL. Please try again.');
          }

          const uploadTask = FileSystem.createUploadTask(uploadUrl, job.videoUri, {
            fieldName: 'file',
            httpMethod: 'POST',
            uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
            headers: {
              'Content-Type': 'video/mp4',
            },
          });

          const uploadResult = await uploadTask.uploadAsync();

          if (!uploadResult?.body) {
            throw new Error('Could not upload your video. Please try again.');
          }

          if (uploadResult.status < 200 || uploadResult.status >= 300) {
            throw new Error('Video upload failed. Please try again.');
          }

          const uploadBody = JSON.parse(uploadResult.body) as {
            storageId?: string;
          };

          if (!uploadBody.storageId) {
            throw new Error('Upload response missing storage id.');
          }

          uploadedStorageId = uploadBody.storageId as Id<'_storage'>;

          patchJob(jobId, {
            status: 'finalizing',
            uploadedStorageId,
          });
        } else {
          patchJob(jobId, {
            status: 'finalizing',
            lastError: undefined,
          });
        }

        // ---------------------------------------------------------
        // 4. Upload the generated thumbnail
        // ---------------------------------------------------------
        let uploadedThumbnailStorageId = job.uploadedThumbnailStorageId;

        if (!uploadedThumbnailStorageId && thumbnailUri) {
          const thumbnailUploadUrl = await generateUploadUrl();

          if (!thumbnailUploadUrl) {
            throw new Error('Could not create thumbnail upload URL.');
          }

          const thumbnailUploadTask = FileSystem.createUploadTask(
            thumbnailUploadUrl,
            thumbnailUri,
            {
              fieldName: 'file',
              httpMethod: 'POST',
              uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
              headers: {
                'Content-Type': 'image/jpeg',
              },
            }
          );

          const thumbnailUploadResult = await thumbnailUploadTask.uploadAsync();

          if (!thumbnailUploadResult?.body) {
            throw new Error('Could not upload video thumbnail.');
          }

          if (thumbnailUploadResult.status < 200 || thumbnailUploadResult.status >= 300) {
            throw new Error('Video thumbnail upload failed.');
          }

          const thumbnailUploadBody = JSON.parse(thumbnailUploadResult.body) as {
            storageId?: string;
          };

          if (!thumbnailUploadBody.storageId) {
            throw new Error('Thumbnail upload response missing storage id.');
          }

          uploadedThumbnailStorageId = thumbnailUploadBody.storageId as Id<'_storage'>;

          patchJob(jobId, {
            uploadedThumbnailStorageId,
          });
        }

        // ---------------------------------------------------------
        // 5. Complete the challenge/check-in in Convex
        // ---------------------------------------------------------
        const result = await completeChallenge({
          challengeId: job.challengeId as Id<'challenges'>,

          videoStorageId: uploadedStorageId,

          thumbnailStorageId: uploadedThumbnailStorageId,

          allowRepost: job.allowRepost,
          caption: job.caption || undefined,
        });

        // ---------------------------------------------------------
        // 6. Remove queue item and local temporary files
        // ---------------------------------------------------------
        removeJob(jobId);

        await Promise.all([
          deleteLocalVideo(job.videoUri),

          thumbnailUri ? deleteLocalVideo(thumbnailUri) : Promise.resolve(),
        ]);

        // ---------------------------------------------------------
        // 7. Show success message
        // ---------------------------------------------------------
        if (result?.isDay1Baseline) {
          if (result.pointsEarned > 0) {
            showToast(
              `+${result.pointsEarned} pts added successfully. Your video will be live soon.`,
              'success'
            );
          } else {
            showToast('Progress saved successfully.', 'success');
          }
        } else if (result?.pointsEarned > 0) {
          showToast(`+${result.pointsEarned} pts added. Your video will be live soon.`, 'success');
        } else {
          showToast('Progress submitted successfully. Your video will be live soon.', 'success');
        }
      } catch (error) {
        const latestJob = jobsRef.current.find((candidate) => candidate.id === jobId);

        const nextRetryCount = (latestJob?.retryCount ?? job.retryCount) + 1;

        const message = getErrorMessage(error);

        const isRetryable = isRetryableChallengeUploadError(message);

        const shouldRetry = isRetryable && nextRetryCount <= MAX_AUTO_RETRIES;

        if (shouldRetry) {
          // Keep video and thumbnail locally for retry.
          patchJob(jobId, {
            status: 'queued',
            retryCount: nextRetryCount,
            nextAttemptAt: Date.now() + getRetryDelayMs(nextRetryCount),
            lastError: message,
          });
        } else if (isRetryable) {
          // Keep local files because the user can manually retry.
          patchJob(jobId, {
            status: 'failed',
            retryCount: nextRetryCount,
            nextAttemptAt: 0,
            lastError: message,
          });

          showToast('Upload paused. Open the challenge to retry.', 'error');
        } else {
          // Permanent error: remove the job and local files.
          removeJob(jobId);

          await Promise.all([
            deleteLocalVideo(job.videoUri),

            thumbnailUri ? deleteLocalVideo(thumbnailUri) : Promise.resolve(),
          ]);

          showToast(message, 'error');
        }
      } finally {
        processingJobIdRef.current = null;

        setRetryWakeTick((current) => current + 1);
      }
    },
    [completeChallenge, generateUploadUrl, patchJob, removeJob, showToast]
  );
  
  useEffect(() => {
    if (!isHydrated || appState !== 'active' || processingJobIdRef.current) {
      return;
    }

    const now = Date.now();
    const nextReadyJob = jobs.find((job) => job.status === 'queued' && job.nextAttemptAt <= now);

    if (nextReadyJob) {
      void processJob(nextReadyJob.id);
      return;
    }

    const nextQueuedJob = jobs
      .filter((job) => job.status === 'queued' && job.nextAttemptAt > now)
      .sort((a, b) => a.nextAttemptAt - b.nextAttemptAt)[0];

    if (!nextQueuedJob) return;

    const timeoutId = setTimeout(
      () => {
        setRetryWakeTick((current) => current + 1);
      },
      Math.max(0, nextQueuedJob.nextAttemptAt - now)
    );

    return () => clearTimeout(timeoutId);
  }, [appState, isHydrated, jobs, processJob, retryWakeTick]);

  const enqueueChallengeUpload = useCallback(
    async ({ challengeId, videoUri, caption, allowRepost }: EnqueueChallengeUploadInput) => {
      if (!isHydrated) {
        throw new Error('Upload queue is still loading. Please try again.');
      }

      const existingJob = jobsRef.current.find((job) => job.challengeId === challengeId);

      if (existingJob) {
        throw new Error(
          existingJob.status === 'failed'
            ? 'This challenge already has a failed upload. Open the challenge and tap Retry Upload.'
            : 'This challenge is already uploading in the background.'
        );
      }

      const now = Date.now();

      const nextJob: ChallengeUploadJob = {
        id: `challenge-upload-${now}-${Math.random().toString(36).slice(2, 8)}`,
        challengeId,
        videoUri,
        caption: caption?.trim() || undefined,
        allowRepost,
        createdAt: now,
        updatedAt: now,
        retryCount: 0,
        status: 'queued',
        nextAttemptAt: now,
      };

      saveJobs((current) => [...current, nextJob]);

      showToast('Uploading your video. Please keep the app open until it finishes.', 'warning');
    },
    [isHydrated, saveJobs, showToast]
  );

  const retryChallengeUpload = useCallback(
    (challengeId: string) => {
      const job = jobsRef.current.find((candidate) => candidate.challengeId === challengeId);
      if (!job) return;

      saveJobs((current) =>
        current.map((candidate) =>
          candidate.challengeId === challengeId
            ? {
                ...candidate,
                status: 'queued',
                retryCount: 0,
                nextAttemptAt: Date.now(),
                lastError: undefined,
                updatedAt: Date.now(),
              }
            : candidate
        )
      );

      showToast('Retrying upload in the background.', 'success');
    },
    [saveJobs, showToast]
  );

  const jobsByChallengeId = useMemo(() => {
    return new Map(jobs.map((job) => [job.challengeId, job]));
  }, [jobs]);

  const getJobForChallenge = useCallback(
    (challengeId: string) => jobsByChallengeId.get(challengeId),
    [jobsByChallengeId]
  );

  const value = useMemo<ChallengeUploadContextValue>(
    () => ({
      jobs,
      enqueueChallengeUpload,
      retryChallengeUpload,
      getJobForChallenge,
    }),
    [enqueueChallengeUpload, getJobForChallenge, jobs, retryChallengeUpload]
  );

  return (
    <ChallengeUploadContext.Provider value={value}>{children}</ChallengeUploadContext.Provider>
  );
}

export function useChallengeUploadQueue() {
  const context = useContext(ChallengeUploadContext);

  if (!context) {
    throw new Error('useChallengeUploadQueue must be used within ChallengeUploadProvider');
  }

  return context;
}
