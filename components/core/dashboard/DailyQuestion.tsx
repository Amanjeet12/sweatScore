import { Check } from 'phosphor-react-native';
import { TouchableOpacity, View } from 'react-native';

import { PrototypeSheetControl } from '~/components/core/design/PrototypeControl';
import {
  prototypeComponents as chrome,
  prototypeTypography as type,
} from '~/components/core/design/prototypeStyles';
import { Text } from '~/components/ui/text';

/** Presentation only; callers own draft persistence, order and submission. */
export default function DailyQuestion({
  index,
  total,
  title,
  description,
  options,
  selected,
  busy,
  onChoose,
  onBack,
  onClose,
}: {
  index: number;
  total: number;
  title: string;
  description?: string;
  options: readonly (readonly [string, string])[];
  selected?: string | null;
  busy: boolean;
  onChoose: (value: string) => void;
  onBack?: () => void;
  onClose: () => void;
}) {
  return (
    <View>
      <View className="flex-row items-center justify-between">
        <PrototypeSheetControl
          kind="back"
          label="Previous question"
          disabled={busy || !onBack}
          hidden={!onBack}
          onPress={onBack}
        />
        <View
          className="mx-3 flex-1 flex-row gap-1.5"
          accessibilityRole="progressbar"
          accessibilityLabel="Daily questions"
          accessibilityValue={{ min: 1, max: total, now: index + 1 }}>
          {Array.from({ length: total }, (_, step) => (
            <View
              key={step}
              className="h-1 flex-1 rounded-full"
              style={{ backgroundColor: step <= index ? '#ff5a1f' : '#ECECEC' }}
            />
          ))}
        </View>
        <PrototypeSheetControl kind="close" label="Close today’s questions" onPress={onClose} />
      </View>
      <Text style={type.caption} className="mt-7">
        Question {index + 1} of {total}
      </Text>
      <Text style={type.dailyQuestionHeading} className="mt-1.5">
        {title}
      </Text>
      {description ? (
        <Text style={type.supporting} className="mt-2">
          {description}
        </Text>
      ) : null}
      <View className="mt-6 gap-3">
        {options.map(([value, label]) => {
          const active = selected === value;
          return (
            <TouchableOpacity
              key={value}
              accessibilityRole="radio"
              accessibilityState={{ selected: active, disabled: busy }}
              disabled={busy}
              onPress={() => onChoose(value)}
              activeOpacity={0.8}
              className="min-h-[60px] flex-row items-center rounded-[22px] border-[1.5px] px-[18px] py-3"
              style={{
                ...chrome.option,
                borderColor: active ? '#ff5a1f' : '#ECECEC',
                backgroundColor: active ? '#FFF3EA' : 'white',
                opacity: busy ? 0.65 : 1,
              }}>
              <Text
                className="min-w-0 flex-1 pr-3"
                style={[type.option, { ...type[active ? 'selectedOption' : 'option'] }]}>
                {label}
              </Text>
              <View
                className="h-6 w-6 items-center justify-center rounded-full border"
                style={{
                  backgroundColor: active ? '#ff5a1f' : 'white',
                  borderColor: active ? '#ff5a1f' : '#D9D9D9',
                }}>
                {active ? <Check size={14} color="white" weight="bold" /> : null}
              </View>
            </TouchableOpacity>
          );
        })}
      </View>
      {busy ? (
        <Text style={type.supporting} accessibilityLiveRegion="polite" className="mt-3">
          Saving your answer…
        </Text>
      ) : null}
    </View>
  );
}
