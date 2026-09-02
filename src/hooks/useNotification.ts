import { useNotificationContext } from '../context/NotificationContext';

export function useNotification() {
  return useNotificationContext();
}
