import { NativeTabs } from 'expo-router/unstable-native-tabs';

import { Brand, Colors } from '@/constants/theme';

export default function TabLayout() {
  return (
    <NativeTabs
      tintColor={Brand.blue}
      backgroundColor={Colors.card}
      iconColor={{ default: Colors.textMuted, selected: Brand.blue }}
      labelStyle={{ selected: { color: Brand.blue } }}>
      <NativeTabs.Trigger name="index">
        <NativeTabs.Trigger.Label>Home</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf={{ default: 'house', selected: 'house.fill' }} md="home" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="scores">
        <NativeTabs.Trigger.Label>Scores</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="chart.bar.fill" md="bar_chart" />
      </NativeTabs.Trigger>
      <NativeTabs.Trigger name="profile">
        <NativeTabs.Trigger.Label>Profile</NativeTabs.Trigger.Label>
        <NativeTabs.Trigger.Icon sf="person.crop.circle.fill" md="account_circle" />
      </NativeTabs.Trigger>
    </NativeTabs>
  );
}
