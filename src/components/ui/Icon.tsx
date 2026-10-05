import React from 'react';
import { Ionicons } from '@expo/vector-icons';

import { useTheme } from '../../context/ThemeContext';

// Semantic names mapped to one glyph set (Ionicons outline style) so every
// screen requests meaning, not a specific icon-set glyph — swapping icon
// families later only touches this one map. Replaces emoji one screen at a
// time; see the redesign audit §7.
export type IconName =
  | 'sos'
  | 'location'
  | 'compass'
  | 'shield'
  | 'notification'
  | 'warning'
  | 'check'
  | 'checkCircle'
  | 'close'
  | 'chevronRight'
  | 'chevronLeft'
  | 'chevronDown'
  | 'battery'
  | 'call'
  | 'callEnd'
  | 'people'
  | 'family'
  | 'person'
  | 'home'
  | 'lock'
  | 'eye'
  | 'link'
  | 'settings'
  | 'wifi'
  | 'wifiOff'
  | 'trash'
  | 'edit'
  | 'add'
  | 'activity'
  | 'time'
  | 'arrowBack'
  | 'briefcase'
  | 'ellipsis'
  | 'search'
  | 'send'
  | 'map'
  | 'school'
  | 'star'
  | 'starFilled'
  | 'message'
  | 'navigate'
  | 'bus'
  | 'bike'
  | 'car'
  | 'walk'
  | 'batteryLow'
  | 'gps'
  | 'mic'
  | 'layers'
  | 'recentre';

const IONICON_MAP: Record<IconName, keyof typeof Ionicons.glyphMap> = {
  sos: 'alert',
  location: 'location-outline',
  compass: 'compass-outline',
  shield: 'shield-checkmark-outline',
  notification: 'notifications-outline',
  warning: 'warning-outline',
  check: 'checkmark',
  checkCircle: 'checkmark-circle',
  close: 'close',
  chevronRight: 'chevron-forward',
  chevronLeft: 'chevron-back',
  chevronDown: 'chevron-down',
  battery: 'battery-half-outline',
  call: 'call-outline',
  callEnd: 'call',
  people: 'people-outline',
  family: 'people-circle-outline',
  person: 'person-outline',
  home: 'home-outline',
  lock: 'lock-closed-outline',
  eye: 'eye-outline',
  link: 'link-outline',
  settings: 'settings-outline',
  wifi: 'wifi-outline',
  wifiOff: 'cloud-offline-outline',
  trash: 'trash-outline',
  edit: 'create-outline',
  add: 'add',
  activity: 'pulse-outline',
  time: 'time-outline',
  arrowBack: 'arrow-back',
  briefcase: 'briefcase-outline',
  ellipsis: 'ellipsis-horizontal-outline',
  search: 'search-outline',
  send: 'paper-plane-outline',
  map: 'map-outline',
  school: 'school-outline',
  star: 'star-outline',
  starFilled: 'star',
  message: 'chatbox-outline',
  navigate: 'navigate',
  bus: 'bus-outline',
  bike: 'bicycle-outline',
  car: 'car-outline',
  walk: 'walk-outline',
  batteryLow: 'battery-dead-outline',
  gps: 'locate-outline',
  mic: 'mic-outline',
  layers: 'layers-outline',
  recentre: 'navigate-outline',
};

interface IconProps {
  name: IconName;
  size?: number;
  color?: string;
}

export function Icon({ name, size = 22, color }: IconProps) {
  const theme = useTheme();
  return <Ionicons name={IONICON_MAP[name]} size={size} color={color ?? theme.textPrimary} />;
}
