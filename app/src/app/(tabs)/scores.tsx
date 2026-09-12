import { StyleSheet, View } from 'react-native';

import { Icon, SectionIcon } from '@/components/icon';
import { Banner, Card, Chip, EmptyState, formatScore, Loading, ProgressBar, ScoreBadge, Screen, T } from '@/components/ui';
import { Brand, Colors, DifficultyColors, Radius, scoreColor, sectionColor, Spacing, tint } from '@/constants/theme';
import { api } from '@/lib/api';
import { useFocusData } from '@/lib/hooks';
import { DIFFICULTY_LABELS, kindLabel } from '@/lib/labels';
import { DIFFICULTIES, type SectionScore } from '@/lib/types';

export default function ScoresScreen() {
  const { data, error, loading, reload } = useFocusData(() => api.scores(), []);

  return (
    <Screen tabbed onRefresh={reload} refreshing={loading && !!data}>
      <T variant="title">Your scores</T>
      {!data ? (
        loading ? (
          <Loading />
        ) : (
          <Banner tone="error" message={error?.message ?? 'Could not load scores'} onRetry={reload} />
        )
      ) : data.overall.attempts === 0 ? (
        <EmptyState
          icon="chart"
          title="No scores yet"
          message="Answer your first question and your readiness score, category scores and progress by phase will appear here."
        />
      ) : (
        <>
          <View style={styles.hero}>
            <View style={{ flex: 1, gap: 4 }}>
              <T variant="caption" color={Colors.onBrandMuted}>
                Interview readiness
              </T>
              <T variant="display" color={Colors.onBrand} style={{ fontSize: 44, lineHeight: 50 }}>
                {Math.round((data.overall.avgScore ?? 0) * 10)}%
              </T>
              <T variant="small" color={Colors.onBrandMuted}>
                Average {formatScore(data.overall.avgScore)}/10 across {data.overall.attempts} answers
              </T>
            </View>
            <View style={styles.streakBox}>
              <Icon name="flame" size={26} color={Brand.sun} />
              <T variant="title" color={Colors.onBrand}>
                {data.streak.current}
              </T>
              <T variant="small" color={Colors.onBrandMuted}>
                day streak
              </T>
              <T variant="small" color={Colors.onBrandMuted} style={{ fontSize: 11 }}>
                best {data.streak.longest}
              </T>
            </View>
          </View>

          <Card>
            <T variant="h2">Scores by category</T>
            {data.categories.map((c) => {
              const color = sectionColor(c.kind);
              return (
                <View key={c.kind} style={{ gap: 6 }}>
                  <View style={styles.row}>
                    <SectionIcon kind={c.kind} size={28} />
                    <T variant="h3" style={{ flex: 1 }}>
                      {kindLabel(c.kind)}
                    </T>
                    <T variant="small" color={Colors.textSecondary}>
                      {c.attempts} answers
                    </T>
                    <T variant="h3" color={scoreColor(c.avgScore)} style={{ minWidth: 36, textAlign: 'right' }}>
                      {formatScore(c.avgScore)}
                    </T>
                  </View>
                  <ProgressBar value={(c.avgScore ?? 0) / 10} color={color} track={tint(color, 0.12)} />
                </View>
              );
            })}
          </Card>

          <T variant="h2">By section</T>
          {data.sections.filter((s) => s.attempts > 0).map((s) => (
            <SectionScoreCard key={s.id} section={s} />
          ))}
        </>
      )}
    </Screen>
  );
}

function SectionScoreCard({ section }: { section: SectionScore }) {
  const color = sectionColor(section.kind);
  return (
    <Card style={{ borderLeftWidth: 4, borderLeftColor: color }}>
      <View style={styles.row}>
        <SectionIcon kind={section.kind} size={38} />
        <View style={{ flex: 1 }}>
          <T variant="h3">{section.name}</T>
          <T variant="small" color={Colors.textSecondary} numberOfLines={1}>
            {section.prepTitle}
          </T>
        </View>
        <ScoreBadge score={section.avgScore} size={44} />
      </View>
      <View style={styles.row}>
        <Chip label={`Now: ${DIFFICULTY_LABELS[section.difficulty]}`} color={DifficultyColors[section.difficulty]} />
        {section.training && <Chip label="Training mode" color={Colors.warning} />}
      </View>
      <View style={styles.phaseGrid}>
        {DIFFICULTIES.map((d) => {
          const s = section.byDifficulty[d];
          return (
            <View key={d} style={[styles.phaseCell, { backgroundColor: tint(DifficultyColors[d], 0.07) }]}>
              <T variant="caption" color={DifficultyColors[d]}>
                {DIFFICULTY_LABELS[d]}
              </T>
              <T variant="h2" color={scoreColor(s.avgScore)}>
                {formatScore(s.avgScore)}
              </T>
              <T variant="small" color={Colors.textMuted} style={{ fontSize: 11 }}>
                {s.attempts} answered
              </T>
            </View>
          );
        })}
      </View>
      {section.trend.length > 1 && (
        <View style={{ gap: 6 }}>
          <T variant="caption" color={Colors.textSecondary}>
            Last {section.trend.length} answers
          </T>
          <View style={styles.trend}>
            {section.trend.map((score, i) => (
              <View key={i} style={[styles.bar, { height: 6 + score * 4, backgroundColor: scoreColor(score) }]} />
            ))}
          </View>
        </View>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: Brand.blue,
    borderRadius: Radius.lg,
    padding: Spacing.four,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.three,
  },
  streakBox: {
    alignItems: 'center',
    backgroundColor: 'rgba(6,43,111,0.35)',
    borderRadius: Radius.md,
    paddingVertical: Spacing.three,
    paddingHorizontal: Spacing.three + 4,
  },
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two + 2 },
  phaseGrid: { flexDirection: 'row', gap: Spacing.two },
  phaseCell: { flex: 1, alignItems: 'center', borderRadius: Radius.sm, paddingVertical: Spacing.two + 2, gap: 2 },
  trend: { flexDirection: 'row', alignItems: 'flex-end', gap: 5, height: 50 },
  bar: { flex: 1, maxWidth: 22, borderRadius: 4 },
});
