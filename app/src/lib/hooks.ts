import { useFocusEffect } from 'expo-router';
import { ExpoSpeechRecognitionModule, useSpeechRecognitionEvent } from 'expo-speech-recognition';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Alert, Platform } from 'react-native';

import { ApiError, asApiError } from './api';
import { loadPref, savePref } from './storage';

/** Loads data whenever the screen gains focus, so tabs stay fresh after practising. */
export function useFocusData<T>(loader: () => Promise<T>, deps: readonly unknown[]) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<ApiError | null>(null);
  const [loading, setLoading] = useState(true);

  // eslint-disable-next-line react-hooks/exhaustive-deps
  const load = useCallback(async () => {
    setLoading(true);
    try {
      setData(await loader());
      setError(null);
    } catch (err) {
      setError(asApiError(err));
    } finally {
      setLoading(false);
    }
  }, deps);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load]),
  );

  return { data, error, loading, reload: load };
}

export function useReadAloud(): [boolean, (value: boolean) => void] {
  const [value, setValue] = useState(true);
  useEffect(() => {
    loadPref('readAloud', true).then(setValue);
  }, []);
  const update = useCallback((next: boolean) => {
    setValue(next);
    savePref('readAloud', next);
  }, []);
  return [value, update];
}

/**
 * Speech-to-text for answers. Final segments are handed to `onFinalText` (the screen
 * appends them to an editable draft); the in-progress phrase is exposed as `interim`.
 * Uses on-device recognition on iOS/Android and the Web Speech API in browsers.
 */
export function useVoiceAnswer(onFinalText: (text: string) => void) {
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [seconds, setSeconds] = useState(0);
  const startedAt = useRef<number | null>(null);
  const spokenSeconds = useRef(0);
  const onFinal = useRef(onFinalText);

  useEffect(() => {
    onFinal.current = onFinalText;
  }, [onFinalText]);

  useSpeechRecognitionEvent('result', (event) => {
    const text = event.results[0]?.transcript?.trim() ?? '';
    if (event.isFinal) {
      if (text) onFinal.current(text);
      setInterim('');
    } else {
      setInterim(text);
    }
  });

  useSpeechRecognitionEvent('end', () => {
    if (startedAt.current) {
      spokenSeconds.current += (Date.now() - startedAt.current) / 1000;
      startedAt.current = null;
    }
    setSeconds(Math.round(spokenSeconds.current));
    setListening(false);
    setInterim('');
  });

  useSpeechRecognitionEvent('error', (event) => {
    if (event.error !== 'aborted' && event.error !== 'no-speech') {
      setError(event.message || 'Voice input stopped unexpectedly.');
    }
  });

  useEffect(() => {
    if (!listening) return;
    const id = setInterval(() => {
      if (startedAt.current) {
        setSeconds(Math.round(spokenSeconds.current + (Date.now() - startedAt.current) / 1000));
      }
    }, 500);
    return () => clearInterval(id);
  }, [listening]);

  useEffect(() => () => ExpoSpeechRecognitionModule.abort(), []);

  const start = useCallback(async () => {
    setError(null);
    if (!ExpoSpeechRecognitionModule.isRecognitionAvailable()) {
      setError("Voice input isn't available here — please type your answer instead.");
      return;
    }
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      setError('Allow microphone access to answer by voice.');
      return;
    }
    ExpoSpeechRecognitionModule.start({ lang: 'en-US', interimResults: true, continuous: true, addsPunctuation: true });
    startedAt.current = Date.now();
    setListening(true);
  }, []);

  const stop = useCallback(() => ExpoSpeechRecognitionModule.stop(), []);

  const reset = useCallback(() => {
    ExpoSpeechRecognitionModule.abort();
    startedAt.current = null;
    spokenSeconds.current = 0;
    setSeconds(0);
    setInterim('');
    setError(null);
    setListening(false);
  }, []);

  return { listening, interim, error, seconds, start, stop, reset };
}

/** Cross-platform confirm dialog (Alert.alert is a no-op on web). */
export function confirmAction(title: string, message: string, confirmLabel: string): Promise<boolean> {
  if (Platform.OS === 'web') return Promise.resolve(globalThis.confirm?.(`${title}\n\n${message}`) ?? false);
  return new Promise((resolve) =>
    Alert.alert(title, message, [
      { text: 'Cancel', style: 'cancel', onPress: () => resolve(false) },
      { text: confirmLabel, style: 'destructive', onPress: () => resolve(true) },
    ]),
  );
}
