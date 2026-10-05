// Bricolage Grotesque for headings, Instrument Sans for body — both loaded in
// app/_layout.tsx. Referenced by family name (not fontWeight) because RN maps
// a weight onto a *registered* family; asking for "InstrumentSans" + weight
// 600 renders a synthetic-bold system fallback instead of the real cut.
export const FONTS = {
  heading: 'BricolageGrotesque_700Bold',
  headingXBold: 'BricolageGrotesque_800ExtraBold',
  body: 'InstrumentSans_400Regular',
  bodyMedium: 'InstrumentSans_500Medium',
  bodySemibold: 'InstrumentSans_600SemiBold',
} as const;


export const TYPOGRAPHY = {
  display: { fontSize: 34, fontWeight: '800' as const, lineHeight: 41 },
  title: { fontSize: 28, fontWeight: '800' as const, lineHeight: 34 },
  heading: { fontSize: 20, fontWeight: '700' as const, lineHeight: 26 },
  body: { fontSize: 16, fontWeight: '400' as const, lineHeight: 22 },
  bodyStrong: { fontSize: 16, fontWeight: '600' as const, lineHeight: 22 },
  callout: { fontSize: 14, fontWeight: '500' as const, lineHeight: 19 },
  caption: { fontSize: 12, fontWeight: '500' as const, lineHeight: 16 },
};
