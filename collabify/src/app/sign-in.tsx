import { resetTo } from '@/lib/nav';
import { useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { Body, Button, ErrorText, Field, Muted, Screen, Title } from '@/components/ui';
import { getApi } from '@/lib/api';
import { isEmail, isUkUniversityEmail } from '@/lib/fees';
import { useAction } from '@/lib/useQuery';
import type { Role } from '@/lib/types';
import { fonts, radius, space, useTheme } from '@/theme';

export default function SignIn() {
  const params = useLocalSearchParams<{ role?: string; email?: string }>();
  const role: Role = params.role === 'business' ? 'business' : 'student';
  const { colors } = useTheme();
  const [email, setEmail] = useState(params.email ?? '');
  const [step, setStep] = useState<'email' | 'code'>('email');
  const [code, setCode] = useState('');
  const [devCode, setDevCode] = useState<string | undefined>();
  const { busy, error, setError, run } = useAction();
  const api = getApi();

  const sendCode = () =>
    run(async () => {
      if (!isEmail(email)) throw new Error('Enter a valid email address');
      if (role === 'student' && !isUkUniversityEmail(email)) throw new Error('Use your university email ending in .ac.uk');
      const res = await api.requestCode(email, role);
      setDevCode(res.devCode);
      setStep('code');
    });

  const verify = () =>
    run(async () => {
      const { profile } = await api.verifyCode(email, code);
      if (profile) resetTo('/');
      else resetTo({ pathname: '/onboarding', params: { role } });
    });

  return (
    <Screen edges={[]}>
      {step === 'email' ? (
        <>
          <Title>{role === 'student' ? 'Your university email' : 'Your work email'}</Title>
          <Muted style={{ marginTop: space.sm, marginBottom: space.xxl }}>
            {role === 'student' ? 'We verify you’re a student with your .ac.uk address. No password needed.' : 'We’ll email you a one-time code. No password needed.'}
          </Muted>
          <Field
            testID="email"
            value={email}
            onChangeText={(t) => { setEmail(t); setError(null); }}
            placeholder={role === 'student' ? 'name@university.ac.uk' : 'you@company.com'}
            autoCapitalize="none"
            autoComplete="email"
            keyboardType="email-address"
            returnKeyType="next"
            onSubmitEditing={sendCode}
            autoFocus
          />
          <ErrorText>{error}</ErrorText>
          <Button testID="send-code" title="Send code" onPress={sendCode} loading={busy} disabled={!email} />
        </>
      ) : (
        <>
          <Title>Check your email</Title>
          <Muted style={{ marginTop: space.sm, marginBottom: space.xxl }}>Enter the 6-digit code we sent to {email}.</Muted>
          {devCode ? (
            <View style={{ backgroundColor: colors.primarySoft, borderRadius: radius.md, padding: space.lg, marginBottom: space.lg }}>
              <Body>Demo mode: your code is <Body style={{ fontFamily: fonts.bold }}>{devCode}</Body></Body>
            </View>
          ) : null}
          <Field
            testID="code"
            value={code}
            onChangeText={(t) => { setCode(t.replace(/\D/g, '').slice(0, 6)); setError(null); }}
            placeholder="000000"
            keyboardType="number-pad"
            autoComplete="one-time-code"
            textContentType="oneTimeCode"
            maxLength={6}
            style={{ fontSize: 28, letterSpacing: 10, textAlign: 'center' }}
            onSubmitEditing={verify}
            autoFocus
          />
          <ErrorText>{error}</ErrorText>
          <Button testID="verify" title="Continue" onPress={verify} loading={busy} disabled={code.length !== 6} />
          <Button title="Use a different email" variant="ghost" onPress={() => { setStep('email'); setCode(''); }} style={{ marginTop: space.sm }} />
        </>
      )}
    </Screen>
  );
}
