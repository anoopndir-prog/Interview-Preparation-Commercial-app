import * as WebBrowser from 'expo-web-browser';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Banner, Card, Chip, EmptyState, Loading, Screen, T } from '@/components/ui';
import { Brand, Colors, Radius, Spacing } from '@/constants/theme';
import { api } from '@/lib/api';
import { useFocusData } from '@/lib/hooks';

const formatEdition = (edition: string) =>
  new Date(`${edition}T12:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

export default function NewsScreen() {
  const [domain, setDomain] = useState<string | undefined>();
  const { data, error, loading, reload } = useFocusData(() => api.news(domain), [domain]);

  return (
    <Screen tabbed onRefresh={reload} refreshing={loading && !!data}>
      <View style={{ gap: 4 }}>
        <T variant="title">Daily briefing</T>
        <T variant="small" color={Colors.textSecondary}>
          Fresh industry news for your field, refreshed every morning at 6:00 AM
          {data?.timezone ? ` (${data.timezone.replace('_', ' ')})` : ''}. Drop a headline into your answers to stand out.
        </T>
      </View>

      {data && data.domains.length > 0 && (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: Spacing.two }}>
          {data.domains.map((d) => (
            <Chip key={d} label={d} filled={d === data.domain} onPress={() => setDomain(d)} />
          ))}
          {data.lockedDomains > 0 && <Chip label={`+${data.lockedDomains} with Pro`} icon="lock" color={Brand.sun} />}
        </ScrollView>
      )}

      {loading && !data?.items.length ? (
        <Loading label={`Curating today's ${domain ?? data?.domain ?? ''} news… the first briefing of the day can take a minute.`} />
      ) : !data ? (
        <Banner tone="error" message={error?.message ?? 'Could not load news'} onRetry={reload} />
      ) : !data.domain ? (
        <EmptyState
          icon="news"
          title="Your briefing starts with a prep kit"
          message="Create a prep kit on the Home tab and we'll follow that industry for you every morning."
        />
      ) : data.items.length === 0 ? (
        <EmptyState icon="news" title="No stories yet" message="We couldn't find fresh stories for this domain today. Pull to refresh later." />
      ) : (
        <>
          {data.edition && (
            <T variant="caption" color={Brand.blue}>
              {formatEdition(data.edition)} · {data.domain}
            </T>
          )}
          {data.items.map((item) => (
            <Card key={item.url}>
              <T variant="caption" color={Colors.textMuted}>
                {item.source}
              </T>
              <T variant="h3">{item.headline}</T>
              <T color={Colors.textSecondary}>{item.summary}</T>
              <View style={styles.angle}>
                <Icon name="chat" size={16} color={Brand.blue} />
                <View style={{ flex: 1, gap: 2 }}>
                  <T variant="caption" color={Brand.blue}>
                    In your interview
                  </T>
                  <T variant="small">{item.interview_angle}</T>
                </View>
              </View>
              <Pressable
                accessibilityRole="link"
                onPress={() => WebBrowser.openBrowserAsync(item.url)}
                style={({ pressed }) => [styles.link, pressed && { opacity: 0.7 }]}>
                <T variant="small" color={Brand.blue} style={{ fontWeight: '700' }}>
                  Read the article
                </T>
                <Icon name="external" size={14} color={Brand.blue} />
              </Pressable>
            </Card>
          ))}
        </>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  angle: {
    flexDirection: 'row',
    gap: Spacing.two,
    backgroundColor: Brand.blueMist,
    borderRadius: Radius.sm,
    padding: Spacing.three - 4,
  },
  link: { flexDirection: 'row', alignItems: 'center', gap: 6, alignSelf: 'flex-start' },
});
