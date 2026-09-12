import { useState } from 'react';
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { Icon, type IconName } from '@/components/icon';
import { Banner, Button, Card, Input, T } from '@/components/ui';
import { Brand, Colors, Spacing } from '@/constants/theme';
import { api, asApiError } from '@/lib/api';
import { useAuth } from '@/lib/auth';

const PROMISES: { icon: IconName; text: string }[] = [
  { icon: 'sparkles', text: 'Questions tailored to your resume and the job' },
  { icon: 'mic', text: 'Answer out loud, like the real interview' },
  { icon: 'trendUp', text: 'Scores and coaching that level you up' },
];

export default function SignInScreen() {
  const { signIn } = useAuth();
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendCode = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.requestCode(email.trim());
      setStep('code');
      if (res.devCode) {
        setDevCode(res.devCode);
        setCode(res.devCode);
      }
    } catch (err) {
      setError(asApiError(err).message);
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    setError(null);
    try {
      const res = await api.verifyCode(email.trim(), code.trim(), name.trim());
      await signIn(res.token);
    } catch (err) {
      setError(asApiError(err).message);
      setBusy(false);
    }
  };

  return (
    <View style={styles.root}>
      <View style={[styles.orb, { top: -120, right: -80, width: 300, height: 300 }]} />
      <View style={[styles.orb, { bottom: -140, left: -100, width: 340, height: 340 }]} />
      <SafeAreaView style={{ flex: 1 }}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
            <View style={styles.content}>
              <View style={styles.logo}>
                <T variant="title" color={Brand.blue} style={{ fontWeight: '900' }}>
                  Go
                </T>
              </View>
              <T variant="display" color={Colors.onBrand}>
                Go Interview
              </T>
              <T variant="body" color={Colors.onBrandMuted}>
                Your personal AI interview coach. Walk into every interview prepared, calm and confident.
              </T>

              <View style={{ gap: Spacing.two, marginVertical: Spacing.two }}>
                {PROMISES.map((p) => (
                  <View key={p.text} style={styles.promise}>
                    <View style={styles.promiseIcon}>
                      <Icon name={p.icon} size={16} color={Colors.onBrand} />
                    </View>
                    <T variant="body" color={Colors.onBrand} style={{ flex: 1 }}>
                      {p.text}
                    </T>
                  </View>
                ))}
              </View>

              <Card>
                {step === 'email' ? (
                  <>
                    <T variant="h2">Sign in or create an account</T>
                    <T variant="small" color={Colors.textSecondary}>
                      We&apos;ll email you a 6-digit code — no password needed.
                    </T>
                    <Input value={name} onChangeText={setName} placeholder="First name (optional)" autoComplete="given-name" />
                    <Input
                      value={email}
                      onChangeText={setEmail}
                      placeholder="you@example.com"
                      keyboardType="email-address"
                      autoCapitalize="none"
                      autoComplete="email"
                      onSubmitEditing={sendCode}
                    />
                    <Button title="Email me a code" onPress={sendCode} loading={busy} disabled={!email.includes('@')} />
                  </>
                ) : (
                  <>
                    <T variant="h2">Check your inbox</T>
                    <T variant="small" color={Colors.textSecondary}>
                      Enter the code we sent to {email.trim()}.
                    </T>
                    <Input
                      value={code}
                      onChangeText={setCode}
                      placeholder="6-digit code"
                      keyboardType="number-pad"
                      maxLength={6}
                      autoComplete="one-time-code"
                      onSubmitEditing={verify}
                      style={{ letterSpacing: 6, fontSize: 22, textAlign: 'center' }}
                    />
                    {devCode && <Banner tone="info" message={`Developer mode: code ${devCode} was filled in for you.`} />}
                    <Button title="Sign in" onPress={verify} loading={busy} disabled={code.trim().length !== 6} />
                    <Button
                      title="Use a different email"
                      variant="ghost"
                      small
                      onPress={() => {
                        setStep('email');
                        setCode('');
                        setDevCode(null);
                      }}
                    />
                  </>
                )}
                {error && <Banner tone="error" message={error} />}
              </Card>
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: Brand.blue, overflow: 'hidden' },
  orb: { position: 'absolute', borderRadius: 999, backgroundColor: 'rgba(255,255,255,0.07)' },
  scroll: { flexGrow: 1, justifyContent: 'center', padding: Spacing.four, alignItems: 'center' },
  content: { width: '100%', maxWidth: 480, gap: Spacing.three },
  logo: {
    width: 64,
    height: 64,
    borderRadius: 20,
    backgroundColor: Colors.onBrand,
    alignItems: 'center',
    justifyContent: 'center',
  },
  promise: { flexDirection: 'row', alignItems: 'center', gap: Spacing.two + 2 },
  promiseIcon: {
    width: 30,
    height: 30,
    borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
