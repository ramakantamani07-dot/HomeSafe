import React, { Children, isValidElement } from 'react';
import { StyleSheet, Text, TouchableOpacity, View } from 'react-native';

import { useTheme } from '../../context/ThemeContext';
import { RADIUS, SPACING, TYPOGRAPHY } from '../../config/theme';
import { Icon, type IconName } from './Icon';

interface SectionProps {
  title?: string;
  footer?: string;
  children: React.ReactNode;
}

// Groups ListRows into one rounded surface with a divider between each row —
// the pattern already hand-rolled once in settings.tsx, generalized so most
// screens can use grouped rows instead of one bordered card per item. See
// the redesign audit §7 / §16.
export function Section({ title, footer, children }: SectionProps) {
  const theme = useTheme();
  const rows = Children.toArray(children).filter(isValidElement);

  return (
    <View style={styles.wrapper}>
      {title && (
        <Text style={[styles.title, { color: theme.textSecondary }]}>{title}</Text>
      )}
      <View
        style={[
          styles.surface,
          { backgroundColor: theme.surface, borderColor: theme.border },
        ]}
      >
        {rows.map((row, index) => (
          <React.Fragment key={index}>
            {row}
            {index < rows.length - 1 && (
              <View style={[styles.divider, { backgroundColor: theme.border }]} />
            )}
          </React.Fragment>
        ))}
      </View>
      {footer && (
        <Text style={[styles.footer, { color: theme.textTertiary }]}>{footer}</Text>
      )}
    </View>
  );
}

interface ListRowProps {
  icon?: IconName;
  iconColor?: string;
  title: string;
  subtitle?: string;
  value?: string;
  onPress?: () => void;
  destructive?: boolean;
  accessory?: React.ReactNode;
  accessibilityLabel?: string;
}

export function ListRow({
  icon,
  iconColor,
  title,
  subtitle,
  value,
  onPress,
  destructive = false,
  accessory,
  accessibilityLabel,
}: ListRowProps) {
  const theme = useTheme();
  const titleColor = destructive ? theme.critical.fg : theme.textPrimary;

  const content = (
    <View style={styles.row}>
      {icon && (
        <View style={styles.iconSlot}>
          <Icon name={icon} size={20} color={iconColor ?? titleColor} />
        </View>
      )}
      <View style={styles.textSlot}>
        <Text style={[styles.rowTitle, { color: titleColor }]}>{title}</Text>
        {subtitle && (
          <Text style={[styles.rowSubtitle, { color: theme.textSecondary }]}>{subtitle}</Text>
        )}
      </View>
      {value && (
        <Text style={[styles.rowValue, { color: theme.textSecondary }]}>{value}</Text>
      )}
      {accessory}
      {onPress && !accessory && <Icon name="chevronRight" size={18} color={theme.textTertiary} />}
    </View>
  );

  if (!onPress) return content;

  return (
    <TouchableOpacity
      onPress={onPress}
      activeOpacity={0.7}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel ?? title}
      style={styles.touchable}
    >
      {content}
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  wrapper: {
    marginBottom: SPACING.lg,
  },
  title: {
    fontSize: TYPOGRAPHY.caption.fontSize,
    fontWeight: '700',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: SPACING.sm,
    marginLeft: SPACING.xs,
  },
  surface: {
    borderRadius: RADIUS.lg,
    borderWidth: 1,
    overflow: 'hidden',
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginLeft: SPACING.lg,
  },
  footer: {
    fontSize: TYPOGRAPHY.caption.fontSize,
    lineHeight: TYPOGRAPHY.caption.lineHeight,
    marginTop: SPACING.sm,
    marginHorizontal: SPACING.xs,
  },
  touchable: {
    minHeight: 52,
  },
  row: {
    minHeight: 52,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: SPACING.lg,
    paddingVertical: SPACING.sm,
    gap: SPACING.md,
  },
  iconSlot: {
    width: 24,
    alignItems: 'center',
  },
  textSlot: {
    flex: 1,
  },
  rowTitle: {
    fontSize: TYPOGRAPHY.body.fontSize,
    fontWeight: '500',
  },
  rowSubtitle: {
    fontSize: TYPOGRAPHY.callout.fontSize,
    marginTop: 2,
  },
  // Wraps rather than claiming the row. Without a cap, a long value took every
  // pixel and squeezed the title to a letter per line ("Lo / ca / tio / n").
  rowValue: {
    fontSize: TYPOGRAPHY.callout.fontSize,
    flexShrink: 1,
    maxWidth: '60%',
    textAlign: 'right',
  },
});
