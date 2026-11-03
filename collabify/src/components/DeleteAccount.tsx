import { useState } from 'react';
import { View } from 'react-native';
import { getApi } from '@/lib/api';
import { resetTo } from '@/lib/nav';
import { useAction } from '@/lib/useQuery';
import { radius, space, useTheme } from '@/theme';
import { Body, Button, ErrorText, Heading, Muted, Row } from './ui';

/** In-app account deletion (App Store requirement), with a confirmation step. */
export function DeleteAccount({ role }: { role: 'student' | 'business' }) {
  const { colors } = useTheme();
  const [confirming, setConfirming] = useState(false);
  const { busy, error, run } = useAction();

  if (!confirming) {
    return <Button testID="delete-account" variant="ghost" title="Delete account" onPress={() => setConfirming(true)} style={{ marginTop: space.sm }} />;
  }
  return (
    <View style={{ backgroundColor: colors.dangerSoft, borderRadius: radius.lg, padding: space.lg, marginTop: space.lg }}>
      <Heading>Delete your account?</Heading>
      <Body style={{ marginTop: space.sm }}>
        {role === 'student'
          ? 'Your profile, university email and open applications are removed. You can’t undo this.'
          : 'Your company profile is removed, open projects are closed and any plan is cancelled. You can’t undo this.'}
      </Body>
      <Muted style={{ marginTop: space.sm, fontSize: 13 }}>
        Finished projects stay on record for the other side and for tax purposes, without your name.
      </Muted>
      <ErrorText>{error}</ErrorText>
      <Row style={{ marginTop: space.md }}>
        <Button
          testID="confirm-delete-account"
          small
          variant="danger"
          title="Delete my account"
          loading={busy}
          onPress={() => run(async () => {
            await getApi().deleteAccount();
            resetTo('/welcome');
          })}
        />
        <Button small variant="ghost" title="Keep it" onPress={() => setConfirming(false)} />
      </Row>
    </View>
  );
}
