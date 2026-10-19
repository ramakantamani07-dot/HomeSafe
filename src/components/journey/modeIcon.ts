import type { TravelMode } from '../../models/Place';
import type { IconName } from '../ui/Icon';

/** The icon for each way of travelling. A ride shares its vehicle's icon. */
export const MODE_ICON: Record<TravelMode, IconName> = {
  walk: 'walk',
  bus: 'bus',
  bike: 'bike',
  car: 'car',
  cab: 'car',
  auto: 'car',
  bikeTaxi: 'bike',
};
