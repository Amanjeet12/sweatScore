import { CaretLeft } from 'phosphor-react-native';
import { StyleSheet, TouchableOpacity, View } from 'react-native';

import { PrototypeSheetControl } from './PrototypeControl';
import { prototypeTypography as type, prototypeColors as colors } from './prototypeStyles';

import { Text } from '~/components/ui/text';

/** Compact full-page header from the check-in and profile prototype screens. */
export function CheckInHeader({ title, onBack }: { title: string; onBack: () => void }) {
  return (
    <View style={checkInStyles.header}>
      <TouchableOpacity
        accessibilityRole="button"
        accessibilityLabel="Go back"
        onPress={onBack}
        style={checkInStyles.back}>
        <CaretLeft size={22} color={colors.ink} />
      </TouchableOpacity>
      <Text style={[type.compactPageHeading, { flex: 1 }]}>{title}</Text>
      <View style={{ width: 44 }} accessibilityElementsHidden />
    </View>
  );
}

export function CheckInSheetHeader({ onClose }: { onClose: () => void }) {
  return (
    <View style={{ paddingHorizontal: 18, paddingTop: 10 }}>
      <View style={checkInStyles.handle} accessibilityElementsHidden />
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginTop: 14 }}>
        <PrototypeSheetControl kind="back" label="Back to Today" onPress={onClose} />
        <PrototypeSheetControl kind="close" label="Close check-in" onPress={onClose} />
      </View>
    </View>
  );
}

export const checkInStyles = StyleSheet.create({
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    paddingHorizontal: 22,
    paddingTop: 8,
    paddingBottom: 12,
  },
  back: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  handle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: '#d9d9d9',
    alignSelf: 'center',
  },
  caption: {
    ...type.field,
    lineHeight: 22,
    minHeight: 88,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: '#efefef',
    backgroundColor: '#fcfcfc',
    paddingHorizontal: 16,
    paddingVertical: 14,
    textAlignVertical: 'top',
    marginTop: 8,
  },
  actionCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderWidth: 1.5,
    borderColor: colors.border,
    borderRadius: 22,
  },
  badge: {
    borderRadius: 14,
    backgroundColor: colors.selected,
    paddingHorizontal: 12,
    paddingVertical: 5,
  },
  badgeText: { ...type.progressValue, color: colors.icon },
  footer: {
    paddingHorizontal: 22,
    paddingTop: 16,
    paddingBottom: 16,
    gap: 12,
    backgroundColor: '#fff',
  },
  profileOption: {
    minHeight: 52,
    borderRadius: 20,
    borderWidth: 1.5,
    paddingHorizontal: 16,
    paddingVertical: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  selector: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 1.5,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
