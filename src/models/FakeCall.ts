export type CallerLabel = 'Mum' | 'Dad' | 'Partner' | 'Office' | 'Home';

export const CALLER_LABELS: readonly CallerLabel[] = ['Mum', 'Dad', 'Partner', 'Office', 'Home'];

export type DelaySeconds = 0 | 10 | 30 | 60;

export interface DelayOptionItem {
  label: string;
  value: DelaySeconds;
}

export const DELAY_OPTIONS: readonly DelayOptionItem[] = [
  { label: 'Immediately', value: 0 },
  { label: '10 seconds', value: 10 },
  { label: '30 seconds', value: 30 },
  { label: '1 minute', value: 60 },
];

export interface FakeCallSettings {
  callerName: string;
  callerLabel: CallerLabel | null;
  delaySeconds: DelaySeconds;
}

export function defaultFakeCallSettings(): FakeCallSettings {
  return {
    callerName: 'Alex',
    callerLabel: null,
    delaySeconds: 0,
  };
}

export type FakeCallPhase = 'idle' | 'countdown' | 'incoming' | 'active';
