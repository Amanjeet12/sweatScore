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
    (message: string, action: 'error' | 'success') => {
      toast.show({
        placement: 'top',
        duration: 3500,
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

      try {
        const fileInfo = await FileSystem.getInfoAsync(job.videoUri);

        if (!fileInfo.exists) {
          removeJob(jobId);
          showToast('Saved recording could not be found. Please record again.', 'error');
          return;
        }

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

        const result = await completeChallenge({
          challengeId: job.challengeId as Id<'challenges'>,
          videoStorageId: uploadedStorageId,
          allowRepost: job.allowRepost,
          caption: job.caption || undefined,
        });

        removeJob(jobId);
        await deleteLocalVideo(job.videoUri);

        if (result?.pointsEarned > 0) {
          showToast(`Challenge submitted. +${result.pointsEarned} pts added.`, 'success');
        } else {
          showToast('Challenge submitted successfully.', 'success');
        }
      } catch (error) {
        const latestJob = jobsRef.current.find((candidate) => candidate.id === jobId);
        const nextRetryCount = (latestJob?.retryCount ?? job.retryCount) + 1;
        const message = getErrorMessage(error);

        const shouldRetry =
          isRetryableChallengeUploadError(message) && nextRetryCount <= MAX_AUTO_RETRIES;

        if (shouldRetry) {
          patchJob(jobId, {
            status: 'queued',
            retryCount: nextRetryCount,
            nextAttemptAt: Date.now() + getRetryDelayMs(nextRetryCount),
            lastError: message,
          });
        } else if (isRetryableChallengeUploadError(message)) {
          patchJob(jobId, {
            status: 'failed',
            retryCount: nextRetryCount,
            nextAttemptAt: 0,
            lastError: message,
          });

          showToast('Upload paused. Open the challenge to retry.', 'error');
        } else {
          removeJob(jobId);
          await deleteLocalVideo(job.videoUri);
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

      showToast('Upload started in the background. You can keep using the app.', 'success');
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