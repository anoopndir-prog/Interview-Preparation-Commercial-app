import { router, Stack, useLocalSearchParams } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';

import { Icon, SectionIcon } from '@/components/icon';
import { Banner, Button, Card, Chip, Loading, ScoreBadge, Screen, T } from '@/components/ui';
import { Colors, DifficultyColors, Radius, sectionColor, Spacing, tint } from '@/constants/theme';
import { api } from '@/lib/api';
import { confirmAction, useFocusData } from '@/lib/hooks';
import { DIFFICULTY_LABELS, kindLabel, SOURCE_LABELS } from '@/lib/labels';
import { DIFFICULTIES, type Difficulty, type Section } from '@/lib/types';

export default function PrepScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: prep, error, loading, reload } = useFocusData(() => api.prep(id), [id]);

  const onDelete = async () => {
    if (await confirmAction('Delete this prep kit?', 'Its questions and scores will be removed.', 'Delete')) {
      await api.deletePrep(id);
      router.back();
    }
  };

  return (
    <>
      <Stack.Screen
        options={{
          title: prep?.title ?? 'Prep kit',
          headerRight: () => (
            <Pressable accessibilityLabel="Delete prep kit" onPress={onDelete} hitSlop={10}>
              <Icon name="trash" size={20} color={Colors.danger} />
            </Pressable>
          ),
        }}
      />
      <Screen safeTop={false} onRefresh={reload} refreshing={loading && !!prep}>
        {!prep ? (
          loading ? (
            <Loading />
          ) : (
            <Banner tone="error" message={error?.message ?? 'Could not load this prep kit'} onRetry={reload} />
          )
        ) : (
          <>
            <Card>
              <T variant="caption" color={Colors.textSecondary}>
                {SOURCE_LABELS[prep.source]}
              </T>
              <T variant="title">{prep.title}</T>
              <View style={styles.wrap}>
                <Chip label={prep.domain} icon="building" />
                <Chip label={prep.profile.seniority} color={Colors.textSecondary} />
              </View>
              {prep.profile.roleSummary && <T color={Colors.textSecondary}>{prep.profile.roleSummary}</T>}
              {prep.profile.candidateSummary && <T color={Colors.textSecondary}>{prep.profile.candidateSummary}</T>}
              {prep.profile.keySkills.length > 0 && (
                <>
                  <T variant="caption" color={Colors.textSecondary}>
                    Skills they&apos;ll probe
                  </T>
                  <View style={styles.wrap}>
                    {prep.profile.keySkills.map((s) => (
                      <Chip key={s} label={s} />
                    ))}
                  </View>
                </>
              )}
              {prep.profile.gaps.length > 0 && (
                <>
                  <T variant="caption" color={Colors.warning}>
                    Gaps to prepare for
                  </T>
                  <View style={styles.wrap}>
                    {prep.profile.gaps.map((g) => (
                      <Chip key={g} label={g} color={Colors.warning} />
                    ))}
                  </View>
                </>
              )}
            </Card>

            <View style={{ gap: 4 }}>
              <T variant="h2">Interview sections</T>
              <T variant="small" color={Colors.textSecondary}>
                Most people start at Easy and level up automatically. Confident? Jump straight to Medium or Hard.
              </T>
            </View>
            {prep.sections.map((s) => (
              <SectionCard key={s.id} section={s} />
            ))}
          </>
        )}
      </Screen>
    </>
  );
}

function SectionCard({ section }: { section: Section }) {
  const color = sectionColor(section.kind);
  const start = (difficulty: Difficulty) =>
    router.push({
      pathname: '/practice/[sectionId]',
      params: { sectionId: section.id, difficulty, name: section.name, kind: section.kind },
    });

  return (
    <Card style={{ borderTopWidth: 4, borderTopColor: color }}>
      <View style={styles.header}>
        <SectionIcon kind={section.kind} size={44} />
        <View style={{ flex: 1 }}>
          <T variant="h3">{section.name}</T>
          <T variant="small" color={color} style={{ fontWeight: '600' }}>
            {kindLabel(section.kind)}
          </T>
        </View>
        {section.attempts > 0 && <ScoreBadge score={section.avgScore} size={42} />}
      </View>
      <T variant="small" color={Colors.textSecondary}>
        {section.description}
      </T>
      <View style={styles.wrap}>
        {section.focusTopics.map((t) => (
          <View key={t} style={[styles.topic, { backgroundColor: tint(color, 0.08) }]}>
            <T variant="small" color={color}>
              {t}
            </T>
          </View>
        ))}
      </View>
      {section.training && (
        <Banner tone="warning" message={`Training mode: focusing on ${section.weakAreas.slice(0, 2).join(', ') || 'fundamentals'}.`} />
      )}

      <T variant="caption" color={Colors.textSecondary}>
        {section.attempts > 0 ? `${section.attempts} answered · Choose a phase` : 'Choose where to start'}
      </T>
      <View style={styles.phases}>
        {DIFFICULTIES.map((d) => {
          const current = d === section.difficulty;
          const c = DifficultyColors[d];
          return (
            <Pressable
              key={d}
              accessibilityRole="button"
              accessibilityLabel={`Start ${section.name} at ${DIFFICULTY_LABELS[d]}`}
              onPress={() => start(d)}
              style={({ pressed }) => [
                styles.phase,
                { borderColor: current ? c : Colors.border, backgroundColor: current ? tint(c, 0.1) : Colors.card },
                pressed && { opacity: 0.8 },
              ]}>
              <T variant="small" color={current ? c : Colors.textSecondary} style={{ fontWeight: '700' }}>
                {DIFFICULTY_LABELS[d]}
              </T>
              {current && (
                <T variant="small" color={c} style={{ fontSize: 11 }}>
                  current
                </T>
              )}
            </Pressable>
          );
        })}
      </View>
      <Button title={section.attempts > 0 ? 'Continue practising' : 'Start practising'} icon="mic" color={color} onPress={() => start(section.difficulty)} />
    </Card>
  );
}

const styles = StyleSheet.create({
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  header: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  topic: { paddingHorizontal: 10, paddingVertical: 3, borderRadius: Radius.pill },
  phases: { flexDirection: 'row', gap: Spacing.two },
  phase: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: Radius.sm, borderWidth: 1.5 },
});
