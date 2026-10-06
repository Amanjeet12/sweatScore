import { useAuthToken } from '@convex-dev/auth/react';
import { useConvex } from 'convex/react';
import * as FileSystem from 'expo-file-system';
import { createContext, ReactNode, useContext, useEffect, useRef, useState } from 'react';
import { AppState } from 'react-native';

import { ToastMessage } from '~/components/core/Toast';
import { useCelebration } from '~/components/providers/CelebrationProvider';
import { useToast } from '~/components/ui/toast';
import { api } from '~/convex/_generated/api';
import { Id } from '~/convex/_generated/dataModel';
import { useAuthStore } from '~/store/useAuthStore';
import { getErrorMessage } from '~/utils/error-message';
import { getData, removeData, storeData } from '~/utils/storage';

type Job = {
  userId: string;
  submissionId: Id<'coachProofSubmissionsV1'>;
  uri: string;
  caption: string;
  queueKey: string;
  retries: number;
  failed?: boolean;
};
const key = 'workout-upload-queue:v1';
const Context = createContext<{
  enqueue: (job: Omit<Job, 'retries'>) => void;
  pending: (id: string) => boolean;
} | null>(null);

export function WorkoutUploadProvider({ children }: { children: ReactNode }) {
  const convex = useConvex();
  const token = useAuthToken();
  const userId = useAuthStore((state) => state.currentUser?._id);
  const toast = useToast();
  const { celebrateCompletion, showMilestone } = useCelebration();
  const [jobs, setJobs] = useState<Job[]>(() => {
    const saved = getData(key);
    return Array.isArray(saved) ? saved.filter((j) => j?.submissionId && j?.uri && j?.userId) : [];
  });
  const jobsRef = useRef(jobs);
  const processing = useRef(false);
  const [wake, setWake] = useState(0);
  const notify = (message: string, action: 'warning' | 'success' | 'error') => {
    toast.show({
      placement: 'top',
      duration: 10000,
      render: () => <ToastMessage message={message} action={action} />,
    });
  };
  const save = (next: Job[]) => {
    jobsRef.current = next;
    storeData(key, next);
    setJobs(next);
  };
  useEffect(() => {
    const listener = AppState.addEventListener('change', (state) => {
      if (state === 'active') setWake((n) => n + 1);
    });
    return () => listener.remove();
  }, []);
  useEffect(() => {
    if (processing.current || !token || !userId || AppState.currentState !== 'active') return;
    const job = jobs.find((j) => j.userId === userId && !j.failed);
    if (!job) return;
    processing.current = true;
    const run = async () => {
      try {
        let submission = await convex.query(api.coachCheckIns.mySubmission, {
          submissionId: job.submissionId,
        });
        if (submission.state !== 'completed') {
          await convex.mutation(api.coachCheckIns.saveCaption, {
            submissionId: job.submissionId,
            caption: job.caption,
          });
          if (!submission.storageId) {
            const file = await FileSystem.getInfoAsync(job.uri);
            if (!file.exists) throw new Error('Saved video could not be found.');
            const { token: captureToken } = await convex.mutation(api.coachCheckIns.issueUpload, {
              submissionId: job.submissionId,
              mediaType: 'video',
            });
            const site = process.env.EXPO_PUBLIC_CONVEX_URL?.replace(
              '.convex.cloud',
              '.convex.site'
            );
            if (!site) throw new Error('Upload service unavailable.');
            const task = FileSystem.createUploadTask(`${site}/api/coach-proof-upload`, job.uri, {
              httpMethod: 'POST',
              uploadType: FileSystem.FileSystemUploadType.BINARY_CONTENT,
              headers: {
                'Content-Type': job.uri.toLowerCase().endsWith('.mov')
                  ? 'video/quicktime'
                  : 'video/mp4',
                Authorization: `Bearer ${token}`,
                'X-Coach-Submission': job.submissionId,
                'X-Coach-Capture-Token': captureToken,
              },
            });
            const result = await task.uploadAsync();
            // Recover an attachment whose response was lost before issuing another token.
            submission = await convex.query(api.coachCheckIns.mySubmission, {
              submissionId: job.submissionId,
            });
            if (!submission.storageId) {
              if (!result || result.status < 200 || result.status >= 300)
                throw new Error(`Video upload failed (${result?.status ?? 'network'}).`);
              throw new Error('Video upload was not attached.');
            }
          }
          const result = await convex.mutation(api.coachCheckIns.complete, {
            submissionId: job.submissionId,
            caption: job.caption,
          });
          celebrateCompletion({ type: 'check_in', pointsEarned: result.pointsEarned });
          for (const milestone of result.milestones ?? []) showMilestone(milestone);
        }
        save(jobsRef.current.filter((j) => j.submissionId !== job.submissionId));
        removeData(job.queueKey);
        await FileSystem.deleteAsync(job.uri, { idempotent: true }).catch(() => {});
        notify('Activity shared successfully.', 'success');
      } catch (error) {
        const message = getErrorMessage(error);
        const retries = job.retries + 1;
        const failed =
          retries > 3 ||
          /day has changed|no longer editable|not found|entitlement|401|403|413/.test(
            message.toLowerCase()
          );
        save(
          jobsRef.current.map((j) =>
            j.submissionId === job.submissionId ? { ...j, retries, failed } : j
          )
        );
        if (failed) notify(`Upload paused. Your video is saved. ${message}`, 'error');
        else await new Promise((resolve) => setTimeout(resolve, [5000, 15000, 30000][retries - 1]));
      } finally {
        processing.current = false;
        setWake((n) => n + 1);
      }
    };
    run().catch(() => {});
  }, [jobs, token, userId, wake, convex]);
  const enqueue = (job: Omit<Job, 'retries'>) => {
    const existing = jobsRef.current.find((j) => j.submissionId === job.submissionId);
    if (existing && !existing.failed)
      throw new Error('This video is already uploading in the background.');
    save([
      ...jobsRef.current.filter((j) => j.submissionId !== job.submissionId),
      { ...job, retries: 0, failed: false },
    ]);
    notify('Uploading your video. Please keep the app open until it finishes.', 'warning');
  };
  return (
    <Context.Provider
      value={{
        enqueue,
        pending: (id) => jobsRef.current.some((job) => job.submissionId === id && !job.failed),
      }}>
      {children}
    </Context.Provider>
  );
}

export function useWorkoutUploadQueue() {
  const value = useContext(Context);
  if (!value) throw new Error('WorkoutUploadProvider is required');
  return value;
}
