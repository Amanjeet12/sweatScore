import { useAction, useMutation, useQuery } from 'convex/react';
import type { FunctionReturnType } from 'convex/server';
import { router } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ScrollView, TouchableOpacity, View } from 'react-native';

import CoachPlanItems from './CoachPlanItems';
import CoachPlanPreparing from './CoachPlanPreparing';
import DailyQuestion from './DailyQuestion';
import PlanExplanation from './PlanExplanation';

import { PrototypeButton } from '~/components/core/auth/PrototypeOnboarding';
import PlanFeedback from '~/components/core/dashboard/PlanFeedback';
import { PrototypeSheetControl } from '~/components/core/design/PrototypeControl';
import { prototypeTypography as type } from '~/components/core/design/prototypeStyles';
import { Text } from '~/components/ui/text';
import { api } from '~/convex/_generated/api';
import {
  bodySelections,
  isUnanswered,
  toggleBodyFeeling,
  type BodyFeeling,
} from '~/shared/coachBodyFeeling';
import type { CoachCategory } from '~/shared/coachFoundation';
import { cleanDailyPlanCopy } from '~/shared/coachPlanCopy';
import { DAILY_QUESTIONS } from '~/shared/coachQuestions';
import { planBannerState } from '~/shared/coachToday';
import { toggleTrainingYesterday, type TrainingYesterday } from '~/shared/coachTrainingYesterday';

type Plan = FunctionReturnType<typeof api.revenueCatEntitlements.myPlan>;
type CheckIns = FunctionReturnType<typeof api.coachCheckIns.myToday> | undefined;
const QUESTIONS = DAILY_QUESTIONS;
export default function TodayPlanSheet({
  firstName,
  plan,
  checkIns,
  onClose,
  onCheckIn,
  onContentHeight,
}: {
  firstName: string;
  plan: Plan;
  checkIns: CheckIns;
  onClose: () => void;
  onCheckIn: (category: CoachCategory) => void;
  onContentHeight?: (height: number) => void;
}) {
  const foundation = useQuery(api.coachFoundation.getMyFoundation, {});
  const begin = useMutation(api.coachFoundation.beginReturningPlanSetup);
  const save = useMutation(api.coachFoundation.saveDailyDraft);
  const submit = useAction(api.coachDailyService.submitDailyAnswersAndGenerate);
  const retry = useMutation(api.coachDailyService.retryFailedPlan);
  const [step, setStep] = useState<number | null>(null);
  const [pendingTraining, setPendingTraining] = useState<{
    scope: string;
    values: TrainingYesterday[];
  } | null>(null);
  const [pendingBody, setPendingBody] = useState<{ day: string; values: BodyFeeling[] } | null>(
    null
  );
  const [submitting, setSubmitting] = useState(false);
  const [retryRequestId, setRetryRequestId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const busyRef = useRef(false);
  const beganRef = useRef(false);
  const draft =
    foundation?.state?.dailyDraftDay === plan.day ? foundation.state.dailyDraft : undefined;

  useEffect(() => {
    if (!foundation || plan.requestStatus !== 'none' || beganRef.current) return;
    if (!foundation.state?.profileRevisionId) {
      beganRef.current = true;
      begin({})
        .then(() => {
          onClose();
          router.push('/coach-onboarding');
        })
        .catch(() => setError('Could not open today’s questions. Please try again.'));
    }
  }, [foundation, plan.requestStatus, begin, onClose]);

  const firstUnanswered = QUESTIONS.findIndex((question) => isUnanswered(draft?.[question.key]));
  const index = step ?? (firstUnanswered < 0 ? QUESTIONS.length - 1 : firstUnanswered);
  const question = QUESTIONS[index];
  const selectedBody =
    pendingBody?.day === plan.day ? pendingBody.values : bodySelections(draft?.body);
  const selectedTraining =
    pendingTraining?.scope === plan.day ? pendingTraining.values : (draft?.trainedYesterday ?? []);
  const chooseTraining = async (value: TrainingYesterday) => {
    if (busy) return;
    const values = toggleTrainingYesterday(selectedTraining, value);
    setPendingTraining({ scope: plan.day, values });
    setBusy(true);
    setError('');
    try {
      await save({ trainedYesterday: values });
    } catch {
      setError('Could not save your answer. Please try again.');
    } finally {
      setBusy(false);
    }
  };
  const continueTraining = async () => {
    if (busy || selectedTraining.length === 0) return;
    setBusy(true);
    setError('');
    try {
      await save({ trainedYesterday: selectedTraining });
      setStep(index + 1);
    } catch {
      setError('Could not save your answer. Please try again.');
    } finally {
      setBusy(false);
    }
  };
  const chooseBody = async (value: BodyFeeling) => {
    if (busyRef.current) return;
    busyRef.current = true;
    const values = toggleBodyFeeling(selectedBody, value);
    setPendingBody({ day: plan.day, values });
    setBusy(true);
    setError('');
    try {
      await save({ body: values });
    } catch {
      setError('Could not save your answer. Please try again.');
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  const choose = async (value: string | BodyFeeling[]) => {
    if (busyRef.current || (Array.isArray(value) && value.length === 0)) return;
    busyRef.current = true;
    setBusy(true);
    setError('');
    try {
      if (index === QUESTIONS.length - 1) {
        setSubmitting(true);
        await submit({
          body: value as Parameters<typeof submit>[0]['body'],
          requestKey: `first_${plan.day.replaceAll('-', '')}`,
        });
      } else {
        await save({ [question.key]: value } as Parameters<typeof save>[0]);
        setStep(index + 1);
      }
    } catch {
      setSubmitting(false);
      setError(
        index === QUESTIONS.length - 1
          ? 'We could not prepare today’s plan. Your selections are kept here. Please try again.'
          : 'Could not save your answer. Please try again.'
      );
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };
  useEffect(() => {
    if (plan.requestStatus === 'ready' || plan.requestStatus === 'failed') setSubmitting(false);
  }, [plan.requestStatus]);
  const pending =
    plan.requestStatus === 'pending' ||
    (submitting && plan.requestStatus === 'none') ||
    Boolean(retryRequestId && plan.requestId !== retryRequestId);
  const ready =
    planBannerState({
      access: plan.access,
      hasPlan: Boolean(plan.plan),
      requestStatus: plan.requestStatus,
      canRetry: plan.canRetry,
    }) === 'ready';
  const output = plan.plan?.output;

  return (
    <View style={{ flex: 1 }}>
      <View
        className="mt-2.5 h-1 w-10 self-center rounded-full bg-[#D9D9D9]"
        accessibilityElementsHidden
      />
      <ScrollView
        onContentSizeChange={(_, height) => onContentHeight?.(height + 14)}
        style={{ flex: 1 }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingHorizontal: 22, paddingTop: 18, paddingBottom: 30 }}>
        {ready && output ? (
          <>
            <View className="flex-row items-center justify-between">
              <Text style={type.supporting} className="min-w-0 flex-1 pr-3">
                Hey {firstName}, here’s today’s plan
              </Text>
              <PrototypeSheetControl kind="close" label="Close today’s plan" onPress={onClose} />
            </View>
            {plan.requestStatus === 'pending' || plan.requestStatus === 'failed' ? (
              <View className="mt-4 rounded-2xl bg-[#FFF0E8] p-4">
                <Text style={[type.supporting, { color: '#71432F' }]}>
                  {plan.requestStatus === 'pending'
                    ? 'Your updated plan is preparing. The previous recommendation stays available until it is ready.'
                    : 'The updated plan could not be prepared. Your previous plan and check-in history remain saved.'}
                </Text>
              </View>
            ) : null}
            <Text style={type.planHeading} className="mt-3.5">
              {cleanDailyPlanCopy(output.headline)}
            </Text>
            <CoachPlanItems plan={plan.plan!} checkIns={checkIns} onCheckIn={onCheckIn} />
            <PlanExplanation explanation={cleanDailyPlanCopy(output.why)} />
            <PlanFeedback revisionId={plan.plan!.revisionId} />
            <TouchableOpacity
              accessibilityRole="button"
              onPress={() => {
                onClose();
                router.push('/coach-profile');
              }}
              className="mt-4 min-h-11 items-center justify-center">
              <Text style={[type.body, { color: '#E8541E', textAlign: 'center' }]}>
                Update profile to refresh your plan →
              </Text>
            </TouchableOpacity>
          </>
        ) : pending || plan.requestStatus === 'failed' ? (
          <>
            <PrototypeSheetControl
              kind="close"
              label="Close today’s plan"
              onPress={onClose}
              style={{ alignSelf: 'flex-end' }}
            />
            {pending ? (
              <CoachPlanPreparing prototype firstName={firstName} />
            ) : (
              <View className="py-8">
                <Text style={type.planHeading}>Your answers are saved</Text>
                <Text style={type.loadingBody} className="mt-4">
                  We could not prepare today’s plan. Please try again.
                </Text>
                {plan.canRetry && plan.requestId ? (
                  <PrototypeButton
                    label="Retry plan preparation"
                    loading={busy}
                    disabled={busy}
                    onPress={async () => {
                      setBusy(true);
                      setError('');
                      try {
                        const requestId = await retry({
                          failedRequestId: plan.requestId!,
                          requestKey: `retry_${plan.day.replaceAll('-', '')}_${Date.now()}`,
                        });
                        setRetryRequestId(requestId);
                      } catch {
                        setError('Could not retry right now. Please try again.');
                      } finally {
                        setBusy(false);
                      }
                    }}
                    style={{ marginTop: 32 }}
                  />
                ) : null}
              </View>
            )}
          </>
        ) : (
          <DailyQuestion
            index={index}
            total={QUESTIONS.length}
            title={question.title}
            description={
              index === 0 ? 'Answer 5 quick questions to get a personalised plan today.' : undefined
            }
            options={question.options}
            selected={
              question.key === 'trainedYesterday'
                ? selectedTraining
                : question.key === 'body'
                  ? selectedBody
                  : typeof draft?.[question.key] === 'string'
                    ? draft[question.key]
                    : undefined
            }
            multiple={question.key === 'body' || question.key === 'trainedYesterday'}
            continueLabel={question.key === 'body' ? 'Generate plan' : 'Continue'}
            onContinue={
              question.key === 'trainedYesterday'
                ? () => {
                    continueTraining().catch(() => {});
                  }
                : question.key === 'body'
                  ? () => {
                      choose(selectedBody).catch(() => {});
                    }
                  : undefined
            }
            busy={busy}
            onChoose={(value) => {
              if (question.key === 'trainedYesterday') {
                chooseTraining(value as TrainingYesterday).catch(() => {});
                return;
              }
              if (question.key === 'body') chooseBody(value as BodyFeeling).catch(() => {});
              else choose(value).catch(() => {});
            }}
            onBack={
              index > 0
                ? () => {
                    setError('');
                    setStep(index - 1);
                  }
                : undefined
            }
            onClose={onClose}
          />
        )}
        {error ? (
          <Text style={type.error} accessibilityLiveRegion="polite" className="mt-4">
            {error}
          </Text>
        ) : null}
      </ScrollView>
    </View>
  );
}
