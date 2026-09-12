import * as Speech from 'expo-speech';
import { Stack, useLocalSearchParams } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, StyleSheet, View } from 'react-native';

import { Icon, SectionIcon } from '@/components/icon';
import { Banner, Button, Card, Chip, Input, Loading, ScoreBadge, Screen, Segmented, T, UpgradeCard } from '@/components/ui';
import { Brand, Colors, DifficultyColors, scoreColor, sectionColor, Spacing, tint } from '@/constants/theme';
import { api, asApiError, type ApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useReadAloud, useVoiceAnswer } from '@/lib/hooks';
import { DIFFICULTY_LABELS, eventMessage, kindLabel } from '@/lib/labels';
import { DIFFICULTIES, type AnswerResult, type Difficulty, type Question, type Section } from '@/lib/types';

type Phase = 'loading' | 'answering' | 'grading' | 'feedback' | 'blocked';

const formatTime = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export default function PracticeScreen() {
  const params = useLocalSearchParams<{ sectionId: string; difficulty?: Difficulty; name?: string; kind?: string }>();
  const { refresh } = useAuth();
  const [readAloud] = useReadAloud();

  const [section, setSection] = useState<Section | null>(null);
  const [question, setQuestion] = useState<Question | null>(null);
  const [result, setResult] = useState<AnswerResult | null>(null);
  const [phase, setPhase] = useState<Phase>('loading');
  const [error, setError] = useState<ApiError | null>(null);
  const [draft, setDraft] = useState('');
  const [usedVoice, setUsedVoice] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [sessionScores, setSessionScores] = useState<number[]>([]);

  const appendSpeech = useCallback((text: string) => {
    setDraft((d) => (d ? `${d} ${text}` : text));
    setUsedVoice(true);
  }, []);
  const voice = useVoiceAnswer(appendSpeech);

  const kind = section?.kind ?? params.kind ?? '';
  const color = sectionColor(kind);
  const difficulty = section?.difficulty ?? params.difficulty ?? 'easy';

  const speak = (text: string) => {
    Speech.stop();
    Speech.speak(text, { language: 'en-US', rate: 0.98 });
  };

  const showQuestion = (q: Question) => {
    voice.reset();
    setQuestion(q);
    setResult(null);
    setDraft('');
    setUsedVoice(false);
    setShowHint(false);
    setError(null);
    setPhase('answering');
    if (readAloud) speak(q.text);
  };

  const loadNext = async (requested?: Difficulty) => {
    Speech.stop();
    setPhase('loading');
    setError(null);
    try {
      const res = await api.nextQuestion(params.sectionId, requested);
      setSection(res.section);
      showQuestion(res.question);
    } catch (err) {
      const e = asApiError(err);
      setError(e);
      setPhase('blocked');
    }
  };

  const started = useRef(false);
  useEffect(() => {
    if (started.current) return;
    started.current = true;
    loadNext(params.difficulty);
    return () => {
      Speech.stop();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const submit = async () => {
    if (!question || !draft.trim()) return;
    Speech.stop();
    setPhase('grading');
    setError(null);
    try {
      const res = await api.answer(question.id, {
        answer: draft.trim(),
        inputMode: usedVoice ? 'voice' : 'text',
        durationSec: usedVoice ? voice.seconds : undefined,
      });
      setResult(res);
      setSessionScores((s) => [...s, res.score]);
      setSection((s) => (s ? { ...s, ...res.progress } : s));
      setPhase('feedback');
      refresh().catch(() => undefined);
    } catch (err) {
      const e = asApiError(err);
      setError(e);
      setPhase(e.isPlanLimit ? 'blocked' : 'answering');
    }
  };

  const sessionAvg = sessionScores.length ? sessionScores.reduce((a, b) => a + b, 0) / sessionScores.length : null;

  return (
    <>
      <Stack.Screen options={{ title: section?.name ?? params.name ?? 'Practice' }} />
      <Screen safeTop={false}>
        <Card style={{ borderTopWidth: 4, borderTopColor: color }}>
          <View style={styles.row}>
            <SectionIcon kind={kind} size={40} />
            <View style={{ flex: 1 }}>
              <T variant="h3">{section?.name ?? params.name}</T>
              <T variant="small" color={color} style={{ fontWeight: '600' }}>
                {kindLabel(kind)}
                {sessionScores.length > 0 && ` · ${sessionScores.length} answered, avg ${sessionAvg!.toFixed(1)}`}
              </T>
            </View>
          </View>
          <Segmented
            value={difficulty}
            onChange={(d) => d !== difficulty && phase !== 'loading' && phase !== 'grading' && loadNext(d)}
            options={DIFFICULTIES.map((d) => ({ value: d, label: DIFFICULTY_LABELS[d], color: DifficultyColors[d] }))}
          />
          {section?.training && (
            <Banner tone="warning" message={`Training mode — coaching you on ${section.weakAreas.slice(0, 2).join(' and ') || 'fundamentals'}.`} />
          )}
        </Card>

        {phase === 'loading' && <Loading label="Your interviewer is preparing the next question…" />}

        {phase === 'blocked' && error && (
          error.isPlanLimit ? <UpgradeCard message={error.message} /> : <Banner tone="error" message={error.message} onRetry={() => loadNext()} />
        )}

        {question && phase !== 'loading' && phase !== 'blocked' && (
          <Card>
            <View style={[styles.row, { justifyContent: 'space-between' }]}>
              <View style={styles.row}>
                {question.isFollowUp && <Chip label="Follow-up" color={color} filled />}
                {question.isTraining && <Chip label="Training" color={Colors.warning} />}
                <Chip label={DIFFICULTY_LABELS[question.difficulty]} color={DifficultyColors[question.difficulty]} />
              </View>
              <Pressable accessibilityLabel="Read question aloud" onPress={() => speak(question.text)} hitSlop={10}>
                <Icon name="speaker" size={20} color={Brand.blue} />
              </Pressable>
            </View>
            <T variant="h2" style={{ fontWeight: '600' }}>
              {question.text}
            </T>
            {question.hint ? (
              showHint ? (
                <Banner tone="info" message={question.hint} />
              ) : (
                phase === 'answering' && <Button title="Show a hint" icon="bulb" variant="ghost" small onPress={() => setShowHint(true)} />
              )
            ) : null}
          </Card>
        )}

        {question && (phase === 'answering' || phase === 'grading') && (
          <Card style={{ alignItems: 'stretch' }}>
            <View style={{ alignItems: 'center', gap: Spacing.two }}>
              <MicButton listening={voice.listening} color={color} onPress={voice.listening ? voice.stop : voice.start} disabled={phase === 'grading'} />
              <T variant="small" color={Colors.textSecondary}>
                {voice.listening
                  ? `Listening… ${formatTime(voice.seconds)} / ${formatTime(question.answerSeconds)}`
                  : draft
                    ? 'Tap the mic to keep talking, or edit your answer below.'
                    : `Tap the mic and answer out loud (aim for ~${Math.round(question.answerSeconds / 60)} min).`}
              </T>
            </View>
            {voice.interim ? (
              <T variant="body" color={Colors.textMuted} style={{ fontStyle: 'italic' }}>
                {voice.interim}
              </T>
            ) : null}
            {voice.error && <Banner tone="warning" message={voice.error} />}
            <Input
              value={draft}
              onChangeText={setDraft}
              editable={!voice.listening && phase !== 'grading'}
              placeholder="Your answer appears here as you speak — or type it."
              multiline
              style={{ minHeight: 130, textAlignVertical: 'top' }}
            />
            {error && !error.isPlanLimit && <Banner tone="error" message={error.message} />}
            <Button
              title={phase === 'grading' ? 'Grading your answer…' : voice.listening ? 'Stop recording to submit' : 'Submit answer'}
              color={color}
              loading={phase === 'grading'}
              disabled={voice.listening || draft.trim().length < 2}
              onPress={submit}
            />
            <Button title="Skip this question" variant="ghost" small color={Colors.textSecondary} onPress={() => loadNext()} disabled={phase === 'grading'} />
          </Card>
        )}

        {phase === 'feedback' && result && question && (
          <Feedback
            result={result}
            color={color}
            onFollowUp={result.followUp ? () => showQuestion(result.followUp!) : undefined}
            onNext={() => loadNext()}
          />
        )}
      </Screen>
    </>
  );
}

function MicButton({ listening, color, onPress, disabled }: { listening: boolean; color: string; onPress: () => void; disabled?: boolean }) {
  const pulse = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!listening) {
      pulse.stopAnimation();
      pulse.setValue(0);
      return;
    }
    const loop = Animated.loop(
      Animated.timing(pulse, { toValue: 1, duration: 1400, easing: Easing.out(Easing.ease), useNativeDriver: true }),
    );
    loop.start();
    return () => loop.stop();
  }, [listening, pulse]);

  const active = listening ? Colors.danger : color;
  return (
    <View style={styles.micWrap}>
      <Animated.View
        style={[
          styles.micPulse,
          {
            backgroundColor: active,
            opacity: pulse.interpolate({ inputRange: [0, 1], outputRange: [0.35, 0] }),
            transform: [{ scale: pulse.interpolate({ inputRange: [0, 1], outputRange: [1, 1.6] }) }],
          },
        ]}
      />
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={listening ? 'Stop recording' : 'Start answering by voice'}
        onPress={onPress}
        disabled={disabled}
        style={({ pressed }) => [styles.mic, { backgroundColor: active, opacity: disabled ? 0.5 : pressed ? 0.85 : 1 }]}>
        <Icon name={listening ? 'stop' : 'mic'} size={34} color={Colors.onBrand} />
      </Pressable>
    </View>
  );
}

function Feedback({
  result,
  color,
  onFollowUp,
  onNext,
}: {
  result: AnswerResult;
  color: string;
  onFollowUp?: () => void;
  onNext: () => void;
}) {
  const message = eventMessage(result.event, result.progress.difficulty, result.progress.weakAreas);
  const sc = scoreColor(result.score);
  return (
    <>
      {message && (
        <Banner tone={result.event === 'promoted' || result.event === 'training_off' ? 'success' : 'warning'} message={message} />
      )}
      <Card style={{ backgroundColor: tint(sc, 0.06), borderWidth: 1, borderColor: tint(sc, 0.25) }}>
        <View style={styles.row}>
          <ScoreBadge score={result.score} size={68} />
          <View style={{ flex: 1, gap: 4 }}>
            <T variant="caption" color={sc}>
              Score {result.score}/10
            </T>
            <T variant="h3">{result.verdict}</T>
          </View>
        </View>
        {result.voice && (
          <View style={styles.wrap}>
            <Chip label={`${result.voice.words} words`} color={Colors.textSecondary} />
            {result.voice.wordsPerMinute !== null && (
              <Chip
                label={`${result.voice.wordsPerMinute} words/min`}
                color={result.voice.wordsPerMinute > 170 || result.voice.wordsPerMinute < 100 ? Colors.warning : Colors.success}
              />
            )}
            <Chip
              label={`${result.voice.fillerWords} filler word${result.voice.fillerWords === 1 ? '' : 's'}`}
              color={result.voice.fillerWords > 4 ? Colors.warning : Colors.success}
            />
          </View>
        )}
      </Card>

      <Card>
        <ListBlock title="What worked" icon="check" color={Colors.success} items={result.strengths} />
        <ListBlock title="How to make it stronger" icon="trendUp" color={Colors.warning} items={result.improvements} />
        {result.rubric.length > 0 && <ListBlock title="What interviewers listen for" icon="target" color={Brand.blue} items={result.rubric} />}
      </Card>

      {result.modelAnswer ? (
        <Card style={{ backgroundColor: Brand.blueMist }}>
          <T variant="caption" color={Brand.blue}>
            Model answer
          </T>
          <T>{result.modelAnswer}</T>
        </Card>
      ) : (
        result.modelAnswerLocked && <UpgradeCard message="See a model answer for every question, go deeper with more follow-ups, and practise without daily limits." />
      )}

      {onFollowUp && (
        <Card style={{ borderLeftWidth: 4, borderLeftColor: color }}>
          <T variant="caption" color={color}>
            Your interviewer follows up
          </T>
          <T variant="h3">{result.followUp!.text}</T>
          <Button title="Answer the follow-up" icon="mic" color={color} onPress={onFollowUp} />
        </Card>
      )}
      <Button title="Next question" variant={onFollowUp ? 'secondary' : 'primary'} color={color} onPress={onNext} />
    </>
  );
}

function ListBlock({ title, icon, color, items }: { title: string; icon: 'check' | 'trendUp' | 'target'; color: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <View style={{ gap: 6 }}>
      <T variant="caption" color={color}>
        {title}
      </T>
      {items.map((item) => (
        <View key={item} style={[styles.row, { alignItems: 'flex-start' }]}>
          <View style={{ paddingTop: 2 }}>
            <Icon name={icon} size={14} color={color} />
          </View>
          <T variant="body" style={{ flex: 1 }}>
            {item}
          </T>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two + 2, flexWrap: 'wrap' },
  wrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  micWrap: { width: 96, height: 96, alignItems: 'center', justifyContent: 'center', marginVertical: Spacing.two },
  micPulse: { position: 'absolute', width: 88, height: 88, borderRadius: 44 },
  mic: { width: 84, height: 84, borderRadius: 42, alignItems: 'center', justifyContent: 'center' },
});
