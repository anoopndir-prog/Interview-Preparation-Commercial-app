import { useEffect, useState } from 'react';
import { Alert, Platform, StyleSheet, Switch, View } from 'react-native';

import { Icon } from '@/components/icon';
import { Banner, Button, Card, Chip, Input, Loading, Screen, T } from '@/components/ui';
import { Brand, Colors, Radius, Spacing, tint } from '@/constants/theme';
import { api, asApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';
import { useReadAloud } from '@/lib/hooks';
import type { PlanLimits } from '@/lib/types';

const FEATURES: { label: string; value: (p: PlanLimits) => string }[] = [
  { label: 'Prep kits', value: (p) => String(p.maxPrepKits) },
  { label: 'Graded answers / day', value: (p) => String(p.dailyAnswers) },
  { label: 'Follow-up depth', value: (p) => `${p.maxFollowUpDepth} deep` },
  { label: 'Model answers', value: (p) => (p.modelAnswers ? '✓' : '—') },
  { label: 'News domains', value: (p) => String(p.newsDomains) },
];

export default function ProfileScreen() {
  const { me, refresh, signOut } = useAuth();
  const [readAloud, setReadAloud] = useReadAloud();
  const [name, setName] = useState(me?.user.name ?? '');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: 'error' | 'success'; text: string } | null>(null);

  // The profile may finish loading after this screen mounts; fill the field unless the user already typed.
  const savedName = me?.user.name ?? '';
  useEffect(() => {
    if (savedName) setName((current) => current || savedName);
  }, [savedName]);

  if (!me) {
    return (
      <Screen tabbed>
        <Loading />
      </Screen>
    );
  }

  const isPro = me.user.plan === 'pro';

  const saveName = async () => {
    try {
      await api.updateName(name);
      await refresh();
      setMessage({ tone: 'success', text: 'Name saved.' });
    } catch (err) {
      setMessage({ tone: 'error', text: asApiError(err).message });
    }
  };

  const changePlan = async () => {
    if (!me.devBilling) {
      const text = 'Pro subscriptions will be available through the App Store and Google Play at launch.';
      if (Platform.OS === 'web') setMessage({ tone: 'success', text });
      else Alert.alert('Coming soon', text);
      return;
    }
    setBusy(true);
    try {
      await api.devSetPlan(isPro ? 'free' : 'pro');
      await refresh();
    } catch (err) {
      setMessage({ tone: 'error', text: asApiError(err).message });
    } finally {
      setBusy(false);
    }
  };

  const initials = (me.user.name || me.user.email).slice(0, 1).toUpperCase();

  return (
    <Screen tabbed>
      <T variant="title">Profile</T>
      <Card>
        <View style={styles.row}>
          <View style={styles.avatar}>
            <T variant="title" color={Colors.onBrand}>
              {initials}
            </T>
          </View>
          <View style={{ flex: 1, gap: 4 }}>
            <T variant="h3">{me.user.name || 'Add your name'}</T>
            <T variant="small" color={Colors.textSecondary}>
              {me.user.email}
            </T>
          </View>
          <Chip label={isPro ? 'Pro' : 'Free'} filled={isPro} color={isPro ? Brand.sun : Brand.blue} icon={isPro ? 'sparkles' : undefined} />
        </View>
        <View style={styles.row}>
          <Input value={name} onChangeText={setName} placeholder="Your name" style={{ flex: 1 }} />
          <Button title="Save" small variant="secondary" onPress={saveName} disabled={!name.trim() || name === me.user.name} />
        </View>
      </Card>

      <Card>
        <T variant="h2">Your plan</T>
        <View style={styles.table}>
          <View style={styles.tableRow}>
            <T variant="caption" color={Colors.textSecondary} style={styles.featureCell}>
              Feature
            </T>
            {(['free', 'pro'] as const).map((p) => (
              <T
                key={p}
                variant="caption"
                color={me.user.plan === p ? Brand.blue : Colors.textSecondary}
                style={[styles.planCell, me.user.plan === p && styles.activeCell]}>
                {me.plans[p].label}
              </T>
            ))}
          </View>
          {FEATURES.map((f) => (
            <View key={f.label} style={styles.tableRow}>
              <T variant="small" style={styles.featureCell}>
                {f.label}
              </T>
              {(['free', 'pro'] as const).map((p) => (
                <T key={p} variant="small" style={[styles.planCell, me.user.plan === p && styles.activeCell, { fontWeight: '700' }]}>
                  {f.value(me.plans[p])}
                </T>
              ))}
            </View>
          ))}
        </View>
        <Button
          title={isPro ? (me.devBilling ? 'Switch back to Free (dev)' : 'Manage subscription') : 'Upgrade to Pro'}
          icon={isPro ? undefined : 'sparkles'}
          variant={isPro ? 'secondary' : 'primary'}
          loading={busy}
          onPress={changePlan}
        />
        {me.devBilling && (
          <T variant="small" color={Colors.textMuted}>
            Developer mode: this toggles your plan without payment.
          </T>
        )}
      </Card>

      <Card>
        <T variant="h2">Practice settings</T>
        <View style={styles.row}>
          <Icon name="speaker" color={Brand.blue} />
          <View style={{ flex: 1 }}>
            <T variant="h3">Read questions aloud</T>
            <T variant="small" color={Colors.textSecondary}>
              Hear each question like a real interviewer asking it.
            </T>
          </View>
          <Switch value={readAloud} onValueChange={setReadAloud} trackColor={{ true: Brand.blue }} />
        </View>
      </Card>

      {message && <Banner tone={message.tone} message={message.text} />}
      <Button title="Sign out" variant="secondary" color={Colors.danger} onPress={signOut} />
      <T variant="small" color={Colors.textMuted} style={{ textAlign: 'center' }}>
        Go Interview · AI coaching powered by Claude
      </T>
    </Screen>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: Spacing.three },
  avatar: {
    width: 54,
    height: 54,
    borderRadius: 27,
    backgroundColor: Brand.blue,
    alignItems: 'center',
    justifyContent: 'center',
  },
  table: { borderWidth: 1, borderColor: Colors.border, borderRadius: Radius.md, overflow: 'hidden' },
  tableRow: { flexDirection: 'row', borderBottomWidth: 1, borderBottomColor: Colors.border },
  featureCell: { flex: 1.6, padding: Spacing.two + 2 },
  planCell: { flex: 1, padding: Spacing.two + 2, textAlign: 'center' },
  activeCell: { backgroundColor: tint(Brand.blue, 0.07) },
});
