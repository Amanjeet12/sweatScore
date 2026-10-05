import { StyleSheet } from 'react-native';

import {
  prototypeColors as colors,
  prototypeComponents,
  prototypeTypography as type,
} from './prototypeStyles';

export const workoutTypography = StyleSheet.create({
  title: type.planHeading,
  heading: type.compactPageHeading,
  collection: { ...type.sectionHeading, color: '#fff' },
  video: type.compactCardTitle,
  detail: { ...type.sectionHeading, lineHeight: 26 },
  caption: type.caption,
  imageCaption: { ...type.caption, color: '#fff' },
  body: { ...type.body, lineHeight: 23, color: colors.ink },
  supporting: type.body,
  value: { ...type.compactCardTitle, lineHeight: 22 },
  button: type.button,
});
export const workoutStyles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: '#fff' },
  content: { paddingHorizontal: 22, paddingBottom: 32 },
  header: { flexDirection: 'row', alignItems: 'center', gap: 12, paddingTop: 8, marginBottom: 16 },
  back: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: colors.secondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  hero: {
    minHeight: 195,
    borderRadius: 16,
    overflow: 'hidden',
    backgroundColor: '#e8651f',
    justifyContent: 'flex-end',
  },
  heroText: { paddingHorizontal: 16, paddingTop: 80, paddingBottom: 14, gap: 4 },
  row: { flexDirection: 'row', alignItems: 'flex-start', gap: 14, minHeight: 44 },
  thumbnail: { borderRadius: 12, overflow: 'hidden', backgroundColor: '#eee' },
  metadata: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 22 },
  tile: {
    flexGrow: 1,
    flexBasis: 145,
    minWidth: 0,
    paddingVertical: 16,
    paddingHorizontal: 18,
    borderRadius: 16,
    backgroundColor: colors.secondary,
    gap: 4,
  },
  button: {
    ...prototypeComponents.button,
    backgroundColor: colors.ink,
    flexDirection: 'row',
    gap: 10,
  },
});
