import { CaretDown, CaretUp } from 'phosphor-react-native';
import { useState } from 'react';
import { TouchableOpacity, View } from 'react-native';

import { prototypeTypography as type } from '~/components/core/design/prototypeStyles';
import { Text } from '~/components/ui/text';

export default function PlanExplanation({ explanation }: { explanation: string }) {
  const [expanded, setExpanded] = useState(true);
  return (
    <View className="mt-8">
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Why this was recommended"
        accessibilityState={{ expanded }}
        onPress={() => setExpanded((value) => !value)}
        className="min-h-11 flex-row items-center justify-between">
        <Text style={type.sheetSectionHeading} className="flex-1 pr-3">
          Why this was recommended
        </Text>
        {expanded ? <CaretUp size={20} color="#8A8A8A" /> : <CaretDown size={20} color="#8A8A8A" />}
      </TouchableOpacity>
      {expanded ? (
        <Text style={type.explanation} className="mt-1">
          {explanation}
        </Text>
      ) : null}
    </View>
  );
}
