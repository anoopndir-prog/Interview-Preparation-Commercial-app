import { router } from 'expo-router';
import type { ReactNode } from 'react';
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
  type StyleProp,
  type TextInputProps,
  type TextProps,
  type ViewStyle,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon, type IconName } from './icon';

import {
  BottomTabInset,
  Brand,
  Colors,
  Fonts,
  MaxContentWidth,
  Radius,
  scoreColor,
  Shadow,
  Spacing,
  tint,
} from '@/constants/theme';

const TEXT = StyleSheet.create({
  display: { fontSize: 30, lineHeight: 36, fontWeight: '800', letterSpacing: -0.5 },
  title: { fontSize: 24, lineHeight: 30, fontWeight: '800', letterSpacing: -0.3 },
  h2: { fontSize: 19, lineHeight: 25, fontWeight: '700' },
  h3: { fontSize: 16, lineHeight: 22, fontWeight: '700' },
  body: { fontSize: 15, lineHeight: 22 },
  small: { fontSize: 13, lineHeight: 19 },
  caption: { fontSize: 11.5, lineHeight: 16, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
});

export type TextVariant = keyof typeof TEXT;

export function T({ variant = 'body', color = Colors.text, style, ...rest }: TextProps & { variant?: TextVariant; color?: string }) {
  return <Text {...rest} style={[TEXT[variant], { color, fontFamily: Fonts.sans }, style]} />;
}

export function Screen({
  children,
  onRefresh,
  refreshing = false,
  safeTop = true,
  tabbed = false,
}: {
  children: ReactNode;
  onRefresh?: () => void;
  refreshing?: boolean;
  safeTop?: boolean;
  tabbed?: boolean;
}) {
  return (
    <SafeAreaView edges={safeTop ? ['top'] : []} style={styles.screen}>
      <ScrollView
        keyboardShouldPersistTaps="handled"
        contentContainerStyle={[styles.scroll, { paddingBottom: Spacing.five + (tabbed ? BottomTabInset : 0) }]}
        refreshControl={
          onRefresh ? <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Brand.blue} /> : undefined
        }>
        <View style={styles.inner}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  return <View style={[styles.card, Shadow, style]}>{children}</View>;
}

export function Button({
  title,
  onPress,
  variant = 'primary',
  color = Brand.blue,
  loading = false,
  disabled = false,
  icon,
  small = false,
  style,
}: {
  title: string;
  onPress?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger';
  color?: string;
  loading?: boolean;
  disabled?: boolean;
  icon?: IconName;
  small?: boolean;
  style?: StyleProp<ViewStyle>;
}) {
  const background =
    variant === 'primary' ? color : variant === 'danger' ? Colors.danger : variant === 'secondary' ? tint(color, 0.1) : 'transparent';
  const foreground = variant === 'primary' || variant === 'danger' ? Colors.onBrand : color;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      onPress={onPress}
      disabled={disabled || loading}
      style={({ pressed }) => [
        styles.button,
        small && styles.buttonSmall,
        { backgroundColor: background, opacity: disabled ? 0.45 : pressed ? 0.85 : 1 },
        style,
      ]}>
      {loading ? (
        <ActivityIndicator color={foreground} />
      ) : (
        <>
          {icon && <Icon name={icon} size={small ? 15 : 18} color={foreground} />}
          <T variant={small ? 'small' : 'h3'} color={foreground} style={{ fontWeight: '700' }}>
            {title}
          </T>
        </>
      )}
    </Pressable>
  );
}

export function Chip({
  label,
  color = Brand.blue,
  filled = false,
  icon,
  onPress,
}: {
  label: string;
  color?: string;
  filled?: boolean;
  icon?: IconName;
  onPress?: () => void;
}) {
  const content = (
    <View
      style={[
        styles.chip,
        { backgroundColor: filled ? color : tint(color, 0.09), borderColor: filled ? color : tint(color, 0.22) },
      ]}>
      {icon && <Icon name={icon} size={12} color={filled ? Colors.onBrand : color} />}
      <T variant="small" color={filled ? Colors.onBrand : color} style={{ fontWeight: '600' }}>
        {label}
      </T>
    </View>
  );
  return onPress ? (
    <Pressable accessibilityRole="button" onPress={onPress}>
      {content}
    </Pressable>
  ) : (
    content
  );
}

export function Input(props: TextInputProps) {
  return <TextInput placeholderTextColor={Colors.textMuted} {...props} style={[styles.input, props.style]} />;
}

export function ProgressBar({
  value,
  color = Brand.blue,
  track = tint(Brand.blue, 0.1),
  height = 8,
}: {
  value: number;
  color?: string;
  track?: string;
  height?: number;
}) {
  const pct = `${Math.round(Math.max(0, Math.min(1, value)) * 100)}%` as const;
  return (
    <View style={{ height, borderRadius: height, backgroundColor: track, overflow: 'hidden' }}>
      <View style={{ width: pct, height, borderRadius: height, backgroundColor: color }} />
    </View>
  );
}

export const formatScore = (score: number | null) =>
  score === null ? '–' : Number.isInteger(score) ? String(score) : score.toFixed(1);

export function ScoreBadge({ score, size = 46 }: { score: number | null; size?: number }) {
  const color = scoreColor(score);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size / 2,
        borderWidth: Math.max(3, size / 14),
        borderColor: color,
        backgroundColor: tint(color, 0.08),
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Text style={{ color, fontWeight: '800', fontSize: size * 0.34, fontFamily: Fonts.rounded }}>{formatScore(score)}</Text>
    </View>
  );
}

const BANNER_TONES = {
  error: { color: Colors.danger, icon: 'close' },
  info: { color: Brand.blue, icon: 'bulb' },
  success: { color: Colors.success, icon: 'check' },
  warning: { color: Colors.warning, icon: 'target' },
} as const;

export function Banner({
  message,
  tone = 'info',
  onRetry,
}: {
  message: string;
  tone?: keyof typeof BANNER_TONES;
  onRetry?: () => void;
}) {
  const { color, icon } = BANNER_TONES[tone];
  return (
    <View style={[styles.banner, { backgroundColor: tint(color, 0.08), borderColor: tint(color, 0.25) }]}>
      <Icon name={icon} size={16} color={color} />
      <T variant="small" color={Colors.text} style={{ flex: 1 }}>
        {message}
      </T>
      {onRetry && <Button title="Retry" variant="ghost" small color={color} onPress={onRetry} />}
    </View>
  );
}

export function UpgradeCard({ message }: { message: string }) {
  return (
    <Card style={{ backgroundColor: Brand.sunSoft, borderColor: tint(Brand.sun, 0.4), borderWidth: 1 }}>
      <View style={styles.row}>
        <Icon name="lock" size={18} color={Brand.sun} />
        <T variant="h3">Unlock more with Pro</T>
      </View>
      <T variant="small" color={Colors.textSecondary}>
        {message}
      </T>
      <Button title="See Pro plan" icon="sparkles" color={Brand.blue} onPress={() => router.push('/profile')} />
    </Card>
  );
}

export function Loading({ label }: { label?: string }) {
  return (
    <View style={styles.loading}>
      <ActivityIndicator size="large" color={Brand.blue} />
      {label && (
        <T variant="small" color={Colors.textSecondary} style={{ textAlign: 'center' }}>
          {label}
        </T>
      )}
    </View>
  );
}

export function EmptyState({ icon, title, message, action }: { icon: IconName; title: string; message: string; action?: ReactNode }) {
  return (
    <Card style={{ alignItems: 'center', paddingVertical: Spacing.five }}>
      <View style={styles.emptyIcon}>
        <Icon name={icon} size={26} color={Brand.blue} />
      </View>
      <T variant="h3" style={{ textAlign: 'center' }}>
        {title}
      </T>
      <T variant="small" color={Colors.textSecondary} style={{ textAlign: 'center', maxWidth: 360 }}>
        {message}
      </T>
      {action}
    </Card>
  );
}

export function Segmented<V extends string>({
  options,
  value,
  onChange,
  color = Brand.blue,
}: {
  options: { value: V; label: string; color?: string }[];
  value: V;
  onChange: (value: V) => void;
  color?: string;
}) {
  return (
    <View style={styles.segmented}>
      {options.map((opt) => {
        const active = opt.value === value;
        const c = opt.color ?? color;
        return (
          <Pressable
            key={opt.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(opt.value)}
            style={[styles.segment, active && { backgroundColor: Colors.card, ...StyleSheet.flatten(Shadow) }]}>
            <View style={[styles.dot, { backgroundColor: c, opacity: active ? 1 : 0.45 }]} />
            <T variant="small" color={active ? Colors.text : Colors.textSecondary} style={{ fontWeight: active ? '700' : '500' }}>
              {opt.label}
            </T>
          </Pressable>
        );
      })}
    </View>
  );
}

export const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: Colors.background },
  scroll: { paddingHorizontal: Spacing.three, paddingTop: Spacing.three, alignItems: 'center' },
  inner: { width: '100%', maxWidth: MaxContentWidth, gap: Spacing.three },
  card: {
    backgroundColor: Colors.card,
    borderRadius: Radius.lg,
    padding: Spacing.three + 2,
    gap: Spacing.two + 2,
  },
  button: {
    minHeight: 50,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.four,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.two,
  },
  buttonSmall: { minHeight: 36, paddingHorizontal: Spacing.three, borderRadius: Radius.sm },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.one,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: Radius.pill,
    borderWidth: 1,
    alignSelf: 'flex-start',
  },
  input: {
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.card,
    borderRadius: Radius.md,
    paddingHorizontal: Spacing.three,
    paddingVertical: 13,
    fontSize: 16,
    color: Colors.text,
  },
  banner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.two,
    borderWidth: 1,
    borderRadius: Radius.md,
    padding: Spacing.three,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two },
  loading: { alignItems: 'center', justifyContent: 'center', gap: Spacing.three, paddingVertical: Spacing.six },
  emptyIcon: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: Brand.blueSoft,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmented: {
    flexDirection: 'row',
    backgroundColor: tint(Brand.blue, 0.07),
    borderRadius: Radius.md,
    padding: 4,
    gap: 4,
  },
  segment: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 8,
    borderRadius: Radius.sm,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
});
