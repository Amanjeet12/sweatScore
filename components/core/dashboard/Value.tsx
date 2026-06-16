import * as Icon from 'phosphor-react-native';
import React from 'react';
import { ActivityIndicator, View } from 'react-native';

import { Text } from '~/components/ui/text';
import { colors } from '~/utils/constants';
import { formatPoints } from '~/utils/formatter';

type ValueProps = {
  label: string;
  value: string;
  icon?: keyof typeof Icon;
  format?: boolean;
  loading?: boolean;
};

const Value = ({ label, value, icon, format = false, loading = false }: ValueProps) => {
  const IconComponent = icon ? (Icon[icon] as React.ElementType) : null;

  const formattedValue = format ? formatPoints(Number(value)) : value;

  return (
    <View className="flex-col items-center justify-center rounded-2xl bg-white px-4 py-4">
      {IconComponent && icon ? (
        <View>
          <IconComponent size={28} color={colors.primary} weight="fill" />
        </View>
      ) : null}
      <View className="flex-col items-center justify-center">
        {loading ? (
          <View className="flex-row items-center gap-x-2">
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        ) : (
          <Text className="text-2xl font-bold text-primary-500">{formattedValue}</Text>
        )}
        <Text className="font-bold text-primary-500">{label}</Text>
      </View>
    </View>
  );
};

export default Value;
