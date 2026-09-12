import * as DocumentPicker from 'expo-document-picker';
import { router } from 'expo-router';
import { useEffect, useState } from 'react';
import { Platform, Pressable, StyleSheet, View } from 'react-native';

import { Icon, SectionIcon, type IconName } from '@/components/icon';
import { Banner, Button, Card, Chip, EmptyState, Input, ProgressBar, ScoreBadge, Screen, T, UpgradeCard } from '@/components/ui';
import { Brand, Colors, Radius, sectionColor, Spacing, tint } from '@/constants/theme';
import { api, asApiError, ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useFocusData } from '@/lib/hooks';
import { quoteOfTheDay } from '@/lib/labels';
import type { Prep, Streak } from '@/lib/types';

type Picked = DocumentPicker.DocumentPickerAsset;

const ACCEPTED_TYPES = [
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'image/jpeg',
  'image/png',
  'image/webp',
  'text/plain',
];
const MAX_BYTES = 15 * 1024 * 1024;

const BUILD_STEPS = [
  'Reading your documents…',
  'Mapping your skills to the role…',
  'Designing your interview sections…',
  'Almost there — writing your plan…',
];

function appendFile(form: FormData, field: string, file: Picked) {
  if (Platform.OS === 'web' && file.file) {
    form.append(field, file.file, file.name);
  } else {
    // React Native's FormData accepts { uri, name, type } for file parts.
    form.append(field, { uri: file.uri, name: file.name, type: file.mimeType ?? 'application/octet-stream' } as unknown as Blob);
  }
}

export default function HomeScreen() {
  const { me, refresh } = useAuth();
  const { data, reload, loading } = useFocusData(() => api.preps(), []);
  const preps = data?.preps ?? [];

  const [resume, setResume] = useState<Picked | null>(null);
  const [jd, setJd] = useState<Picked | null>(null);
  const [jdText, setJdText] = useState('');
  const [pasteJd, setPasteJd] = useState(false);
  const [building, setBuilding] = useState(false);
  const [buildStep, setBuildStep] = useState(0);
  const [error, setError] = useState<ApiError | null>(null);

  useEffect(() => {
    if (!building) return;
    setBuildStep(0);
    const id = setInterval(() => setBuildStep((s) => Math.min(s + 1, BUILD_STEPS.length - 1)), 6000);
    return () => clearInterval(id);
  }, [building]);

  const pick = async (set: (f: Picked | null) => void) => {
    setError(null);
    const res = await DocumentPicker.getDocumentAsync({ type: ACCEPTED_TYPES, copyToCacheDirectory: true, multiple: false });
    if (res.canceled) return;
    const file = res.assets[0];
    if (file.size && file.size > MAX_BYTES) {
      setError(new ApiError(400, 'That file is over 15 MB — please choose a smaller one.', 'too_large'));
      return;
    }
    set(file);
  };

  const hasJd = Boolean(jd || jdText.trim());
  const modeHint =
    resume && hasJd
      ? 'Questions will be tailored to how your resume fits this role.'
      : resume
        ? 'Questions will be based on your resume. Add a JD to target a specific role.'
        : hasJd
          ? 'Questions will be based on the job description. Add your resume to personalise them.'
          : 'Attach at least one document to get started.';

  const build = async () => {
    const form = new FormData();
    if (resume) appendFile(form, 'resume', resume);
    if (jd) appendFile(form, 'jd', jd);
    else if (jdText.trim()) form.append('jdText', jdText.trim());
    setBuilding(true);
    setError(null);
    try {
      const prep = await api.createPrep(form);
      setResume(null);
      setJd(null);
      setJdText('');
      setPasteJd(false);
      router.push({ pathname: '/prep/[id]', params: { id: prep.id } });
    } catch (err) {
      setError(asApiError(err));
    } finally {
      setBuilding(false);
    }
  };

  const firstName = me?.user.name?.split(' ')[0];

  return (
    <Screen
      tabbed
      refreshing={loading && !!data}
      onRefresh={() => {
        reload();
        refresh().catch(() => undefined);
      }}>
      <Hero name={firstName} streak={me?.streak} />

      <Card>
        <T variant="h2">Build your interview plan</T>
        <T variant="small" color={Colors.textSecondary}>
          Attach your resume, a job description, or both — PDF, Word, a photo or text.
        </T>
        <View style={styles.tiles}>
          <AttachTile label="Resume" icon="resume" file={resume} onPick={() => pick(setResume)} onClear={() => setResume(null)} />
          <AttachTile
            label="Job description"
            icon="briefcase"
            file={jd}
            onPick={() => pick(setJd)}
            onClear={() => setJd(null)}
            disabled={Boolean(jdText.trim())}
          />
        </View>
        {!jd &&
          (pasteJd ? (
            <Input
              value={jdText}
              onChangeText={setJdText}
              placeholder="Paste the job description here…"
              multiline
              style={{ minHeight: 120, textAlignVertical: 'top' }}
            />
          ) : (
            <Button title="Or paste the job description as text" variant="ghost" small onPress={() => setPasteJd(true)} />
          ))}
        <T variant="small" color={Colors.textSecondary} style={{ fontStyle: 'italic' }}>
          {modeHint}
        </T>
        <Button
          title={building ? BUILD_STEPS[buildStep] : 'Generate my questions'}
          icon="sparkles"
          onPress={build}
          loading={false}
          disabled={building || (!resume && !hasJd)}
        />
        {building && <ProgressBar value={(buildStep + 1) / BUILD_STEPS.length} />}
        {error && (error.isPlanLimit ? <UpgradeCard message={error.message} /> : <Banner tone="error" message={error.message} />)}
      </Card>

      <View style={styles.sectionHeader}>
        <T variant="h2">Your prep kits</T>
        {preps.length > 0 && (
          <T variant="small" color={Colors.textSecondary}>
            {preps.length} {preps.length === 1 ? 'kit' : 'kits'}
          </T>
        )}
      </View>
      {preps.length === 0 ? (
        <EmptyState
          icon="target"
          title="No prep kits yet"
          message="Attach your resume or a job description above. We'll build interview sections — technical, behavioral and more — each with easy, medium and hard questions."
        />
      ) : (
        preps.map((p) => <PrepCard key={p.id} prep={p} />)
      )}
    </Screen>
  );
}

function Hero({ name, streak }: { name?: string; streak?: Streak }) {
  const goal = streak ? Math.min(1, streak.todayAnswers / streak.dailyGoal) : 0;
  return (
    <View style={styles.hero}>
      <View style={[styles.orb, { width: 220, height: 220, top: -90, right: -60 }]} />
      <View style={[styles.orb, { width: 140, height: 140, bottom: -60, left: -30 }]} />
      <View style={styles.heroTop}>
        <T variant="caption" color={Colors.onBrandMuted}>
          Go Interview
        </T>
        <View style={styles.streakPill}>
          <Icon name="flame" size={16} color={Brand.sun} />
          <T variant="small" color={Colors.onBrand} style={{ fontWeight: '800' }}>
            {streak?.current ?? 0} day{streak?.current === 1 ? '' : 's'}
          </T>
        </View>
      </View>
      <T variant="display" color={Colors.onBrand}>
        {name ? `Hi ${name}!` : 'Welcome!'}
      </T>
      <T variant="body" color={Colors.onBrandMuted}>
        {quoteOfTheDay()}
      </T>

      {streak && (
        <View style={styles.heroPanel}>
          <View style={styles.week}>
            {streak.week.map((d, i) => {
              const today = i === streak.week.length - 1;
              const done = d.answers > 0;
              return (
                <View key={d.day} style={{ alignItems: 'center', gap: 4 }}>
                  <View style={[styles.weekDot, done && styles.weekDotDone, today && !done && styles.weekDotToday]}>
                    {done && <Icon name="flame" size={12} color={Brand.blueDeep} />}
                  </View>
                  <T variant="small" color={Colors.onBrandMuted} style={{ fontSize: 11 }}>
                    {new Date(`${d.day}T12:00:00`).toLocaleDateString(undefined, { weekday: 'narrow' })}
                  </T>
                </View>
              );
            })}
          </View>
          <View style={{ gap: 6 }}>
            <View style={styles.heroTop}>
              <T variant="small" color={Colors.onBrand} style={{ fontWeight: '700' }}>
                Today&apos;s goal
              </T>
              <T variant="small" color={Colors.onBrandMuted}>
                {streak.todayAnswers}/{streak.dailyGoal} answers
              </T>
            </View>
            <ProgressBar value={goal} color={Brand.sun} track="rgba(255,255,255,0.18)" />
            <T variant="small" color={Colors.onBrandMuted}>
              {streak.practisedToday
                ? goal >= 1
                  ? 'Goal smashed — see you tomorrow!'
                  : 'Streak safe for today. Keep the momentum going.'
                : streak.current > 0
                  ? `Answer one question to keep your ${streak.current}-day streak alive.`
                  : 'Answer your first question today to start a streak.'}
            </T>
          </View>
        </View>
      )}
    </View>
  );
}

function AttachTile({
  label,
  icon,
  file,
  onPick,
  onClear,
  disabled,
}: {
  label: string;
  icon: IconName;
  file: Picked | null;
  onPick: () => void;
  onClear: () => void;
  disabled?: boolean;
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={file ? `${label}: ${file.name}. Tap to replace.` : `Attach ${label}`}
      onPress={onPick}
      disabled={disabled}
      style={({ pressed }) => [styles.tile, file && styles.tileFilled, { opacity: disabled ? 0.45 : pressed ? 0.85 : 1 }]}>
      <View style={[styles.tileIcon, file && { backgroundColor: Brand.blue }]}>
        <Icon name={file ? 'check' : icon} size={20} color={file ? Colors.onBrand : Brand.blue} />
      </View>
      <T variant="h3">{label}</T>
      <T variant="small" color={Colors.textSecondary} numberOfLines={1}>
        {file ? file.name : 'Tap to attach'}
      </T>
      {file && (
        <Pressable accessibilityLabel={`Remove ${label}`} onPress={onClear} hitSlop={10} style={styles.tileClear}>
          <Icon name="close" size={14} color={Colors.textSecondary} />
        </Pressable>
      )}
    </Pressable>
  );
}

function PrepCard({ prep }: { prep: Prep }) {
  const attempts = prep.sections.reduce((n, s) => n + s.attempts, 0);
  const scored = prep.sections.filter((s) => s.avgScore !== null);
  const avg = scored.length ? scored.reduce((n, s) => n + (s.avgScore ?? 0), 0) / scored.length : null;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/prep/[id]', params: { id: prep.id } })}
      style={({ pressed }) => ({ opacity: pressed ? 0.9 : 1 })}>
      <Card>
        <View style={[styles.sectionHeader, { alignItems: 'flex-start' }]}>
          <View style={{ flex: 1, gap: 6 }}>
            <T variant="h3">{prep.title}</T>
            <Chip label={prep.domain} icon="building" />
          </View>
          {attempts > 0 ? <ScoreBadge score={avg === null ? null : Math.round(avg * 10) / 10} size={44} /> : <Icon name="chevron" color={Colors.textMuted} />}
        </View>
        <View style={styles.sectionsRow}>
          {prep.sections.map((s) => (
            <View key={s.id} style={[styles.sectionPill, { backgroundColor: tint(sectionColor(s.kind), 0.09) }]}>
              <SectionIcon kind={s.kind} size={22} />
              <T variant="small" color={sectionColor(s.kind)} style={{ fontWeight: '600' }}>
                {s.name}
              </T>
            </View>
          ))}
        </View>
        <T variant="small" color={Colors.textMuted}>
          {attempts > 0 ? `${attempts} answers so far` : 'Not started yet — tap to begin'}
        </T>
      </Card>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  hero: {
    backgroundColor: Brand.blue,
    borderRadius: Radius.lg,
    padding: Spacing.four,
    gap: Spacing.two,
    overflow: 'hidden',
  },
  orb: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.08)' },
  heroTop: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  streakPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(255,255,255,0.16)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: Radius.pill,
  },
  heroPanel: {
    marginTop: Spacing.two,
    backgroundColor: 'rgba(6,43,111,0.35)',
    borderRadius: Radius.md,
    padding: Spacing.three,
    gap: Spacing.three,
  },
  week: { flexDirection: 'row', justifyContent: 'space-between' },
  weekDot: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(255,255,255,0.14)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  weekDotDone: { backgroundColor: Brand.sun },
  weekDotToday: { borderWidth: 2, borderColor: Brand.sun },
  tiles: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.two + 2 },
  tile: {
    flex: 1,
    minWidth: 140,
    borderWidth: 1.5,
    borderStyle: 'dashed',
    borderColor: tint(Brand.blue, 0.4),
    backgroundColor: Brand.blueMist,
    borderRadius: Radius.md,
    padding: Spacing.three,
    gap: 6,
  },
  tileFilled: { borderStyle: 'solid', borderColor: Brand.blue, backgroundColor: Brand.blueSoft },
  tileIcon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    backgroundColor: Colors.card,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 4,
  },
  tileClear: { position: 'absolute', top: 10, right: 10, padding: 4 },
  sectionHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: Spacing.two },
  sectionsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  sectionPill: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingRight: 10, borderRadius: Radius.pill },
});
