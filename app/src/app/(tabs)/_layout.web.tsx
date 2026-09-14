import { TabList, TabSlot, TabTrigger, Tabs, type TabListProps, type TabTriggerSlotProps } from 'expo-router/ui';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, type IconName } from '@/components/icon';
import { T } from '@/components/ui';
import { Brand, Colors, MaxContentWidth, Radius, Spacing } from '@/constants/theme';

// Browsers have no system tab bar, so the web build gets a branded top navigation.
export default function WebTabLayout() {
  return (
    <Tabs>
      <TabList asChild>
        <NavBar>
          <TabTrigger name="index" href="/" asChild>
            <NavButton icon="home">Home</NavButton>
          </TabTrigger>
          <TabTrigger name="scores" href="/scores" asChild>
            <NavButton icon="chart">Scores</NavButton>
          </TabTrigger>
          <TabTrigger name="profile" href="/profile" asChild>
            <NavButton icon="person">Profile</NavButton>
          </TabTrigger>
        </NavBar>
      </TabList>
      <TabSlot style={{ flex: 1 }} />
    </Tabs>
  );
}

function NavBar({ children, ...props }: TabListProps) {
  return (
    <View {...props} style={styles.bar}>
      <View style={styles.inner}>
        <View style={styles.brand}>
          <View style={styles.logo}>
            <T variant="small" color={Brand.blue} style={{ fontWeight: '900' }}>
              Go
            </T>
          </View>
          <T variant="h3" color={Colors.onBrand}>
            Go Interview
          </T>
        </View>
        <View style={styles.links}>{children}</View>
      </View>
    </View>
  );
}

function NavButton({ children, isFocused, icon, ...props }: TabTriggerSlotProps & { icon: IconName }) {
  return (
    <Pressable {...props} style={({ pressed }) => [styles.link, isFocused && styles.linkActive, pressed && { opacity: 0.8 }]}>
      <Icon name={icon} size={16} color={isFocused ? Brand.blue : Colors.onBrandMuted} />
      <T variant="small" color={isFocused ? Brand.blue : Colors.onBrand} style={{ fontWeight: '700' }}>
        {children}
      </T>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  bar: { backgroundColor: Brand.blue, paddingHorizontal: Spacing.three, paddingVertical: Spacing.two + 2, alignItems: 'center' },
  inner: {
    width: '100%',
    maxWidth: MaxContentWidth,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: Spacing.two,
  },
  brand: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two },
  logo: { width: 30, height: 30, borderRadius: 9, backgroundColor: Colors.onBrand, alignItems: 'center', justifyContent: 'center' },
  links: { flexDirection: 'row', gap: Spacing.one, flexWrap: 'wrap' },
  link: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 7, borderRadius: Radius.pill },
  linkActive: { backgroundColor: Colors.onBrand },
});
