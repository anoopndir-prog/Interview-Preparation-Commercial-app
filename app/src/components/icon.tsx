import { SymbolView, type SymbolViewProps } from 'expo-symbols';
import { View } from 'react-native';

import { Colors, sectionColor, tint } from '@/constants/theme';
import type { SectionKind } from '@/lib/types';

// SF Symbols on iOS, Material Symbols on Android and web.
const ICONS = {
  home: { ios: 'house.fill', android: 'home', web: 'home' },
  resume: { ios: 'doc.text.fill', android: 'description', web: 'description' },
  briefcase: { ios: 'briefcase.fill', android: 'work', web: 'work' },
  mic: { ios: 'mic.fill', android: 'mic', web: 'mic' },
  stop: { ios: 'stop.fill', android: 'stop', web: 'stop' },
  flame: { ios: 'flame.fill', android: 'local_fire_department', web: 'local_fire_department' },
  chart: { ios: 'chart.bar.fill', android: 'bar_chart', web: 'bar_chart' },
  person: { ios: 'person.crop.circle.fill', android: 'account_circle', web: 'account_circle' },
  close: { ios: 'xmark', android: 'close', web: 'close' },
  check: { ios: 'checkmark.circle.fill', android: 'check_circle', web: 'check_circle' },
  trendUp: { ios: 'arrow.up.right', android: 'trending_up', web: 'trending_up' },
  bulb: { ios: 'lightbulb.fill', android: 'lightbulb', web: 'lightbulb' },
  speaker: { ios: 'speaker.wave.2.fill', android: 'volume_up', web: 'volume_up' },
  keyboard: { ios: 'keyboard', android: 'keyboard', web: 'keyboard' },
  chevron: { ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' },
  lock: { ios: 'lock.fill', android: 'lock', web: 'lock' },
  sparkles: { ios: 'sparkles', android: 'auto_awesome', web: 'auto_awesome' },
  trash: { ios: 'trash', android: 'delete', web: 'delete' },
  external: { ios: 'arrow.up.right.square', android: 'open_in_new', web: 'open_in_new' },
  upload: { ios: 'square.and.arrow.up', android: 'upload_file', web: 'upload_file' },
  target: { ios: 'scope', android: 'track_changes', web: 'track_changes' },
  // section kinds
  cpu: { ios: 'cpu', android: 'memory', web: 'memory' },
  code: { ios: 'chevron.left.forwardslash.chevron.right', android: 'code', web: 'code' },
  network: { ios: 'point.3.connected.trianglepath.dotted', android: 'hub', web: 'hub' },
  people: { ios: 'person.2.fill', android: 'groups', web: 'groups' },
  handshake: { ios: 'person.text.rectangle.fill', android: 'handshake', web: 'handshake' },
  scenario: { ios: 'questionmark.bubble.fill', android: 'psychology', web: 'psychology' },
  building: { ios: 'building.2.fill', android: 'domain', web: 'domain' },
  flag: { ios: 'flag.fill', android: 'flag', web: 'flag' },
  pie: { ios: 'chart.pie.fill', android: 'pie_chart', web: 'pie_chart' },
  chat: { ios: 'bubble.left.and.bubble.right.fill', android: 'forum', web: 'forum' },
} satisfies Record<string, SymbolViewProps['name']>;

export type IconName = keyof typeof ICONS;

const SECTION_ICONS: Record<SectionKind, IconName> = {
  technical: 'cpu',
  coding: 'code',
  system_design: 'network',
  behavioral: 'people',
  hr: 'handshake',
  situational: 'scenario',
  domain: 'building',
  leadership: 'flag',
  case_study: 'pie',
  communication: 'chat',
};

export function Icon({ name, size = 20, color = Colors.text }: { name: IconName; size?: number; color?: string }) {
  return <SymbolView name={ICONS[name]} size={size} tintColor={color} />;
}

export function SectionIcon({ kind, size = 40 }: { kind: string; size?: number }) {
  const color = sectionColor(kind);
  return (
    <View
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.3,
        backgroundColor: tint(color, 0.12),
        alignItems: 'center',
        justifyContent: 'center',
      }}>
      <Icon name={SECTION_ICONS[kind as SectionKind] ?? 'sparkles'} size={size * 0.5} color={color} />
    </View>
  );
}
