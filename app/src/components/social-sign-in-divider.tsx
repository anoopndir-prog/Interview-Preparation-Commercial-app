import { StyleSheet, View } from 'react-native';

import { T } from './ui';

import { Colors, Spacing } from '@/constants/theme';

export function OrDivider() {
  return (
    <View style={styles.divider}>
      <View style={styles.line} />
      <T variant="small" color={Colors.textMuted}>
        or use your email
      </T>
      <View style={styles.line} />
    </View>
  );
}

const styles = StyleSheet.create({
  divider: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two, marginTop: Spacing.one },
  line: { flex: 1, height: 1, backgroundColor: Colors.border },
});
