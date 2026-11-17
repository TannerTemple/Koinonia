import { router } from "expo-router";
import { useState } from "react";
import { Platform, View } from "react-native";
import { BRAND, FEEDBACK_KINDS, FEEDBACK_KIND_LABELS, type FeedbackKind } from "@koinonia/shared";
import { Body, Button, Chip, ChipRow, DraftNotice, Field, FormError, Label, Loading, Screen, Title, fieldErrors } from "@/components/ui";
import { api } from "@/lib/api";
import { useDraft } from "@/lib/draft";
import { useAction } from "@/lib/hooks";
import appConfig from "../../app.json";

const PROMPTS: Record<FeedbackKind, string> = {
  PROBLEM: "What were you trying to do, and what happened instead?",
  IDEA: `What would make ${BRAND.name} better for you?`,
  OTHER: "What's on your mind?",
};

/** The version in app.json ("1.0.0"), so a report can be matched to the build that was running. */
const APP_VERSION: string = appConfig.expo.version;
const PLATFORM = Platform.OS === "ios" ? "ios" : Platform.OS === "android" ? "android" : "web";

/** "Send feedback / report a problem": one box, one button. */
export default function FeedbackScreen() {
  const [kind, setKind] = useState<FeedbackKind>("PROBLEM");
  const [sent, setSent] = useState(false);
  // Kept on the phone until it is sent, like notes.
  const draft = useDraft("draft.feedback");
  const send = useAction(() => api.feedback.send({ kind, message: draft.value, appVersion: APP_VERSION, platform: PLATFORM }));
  const errors = fieldErrors(send.error);

  if (!draft.ready) return <Loading />;

  if (sent) {
    return (
      <Screen>
        <Title>Thank you</Title>
        <Body>Your message was sent. It really does help.</Body>
        <Button label="Done" onPress={() => router.back()} />
      </Screen>
    );
  }

  return (
    <Screen keyboard>
      <Body muted>Found a problem, or have an idea? Tell us in your own words.</Body>
      <View>
        <Label>What is it about?</Label>
        <ChipRow>
          {FEEDBACK_KINDS.map((k) => (
            <Chip key={k} label={FEEDBACK_KIND_LABELS[k]} selected={kind === k} onPress={() => setKind(k)} />
          ))}
        </ChipRow>
      </View>
      <Field label="Your message" hint={PROMPTS[kind]} value={draft.value} onChangeText={draft.setValue} error={errors.message} multiline maxLength={4000} style={{ minHeight: 160 }} />
      {draft.restored ? (
        <DraftNotice
          onDiscard={() => {
            void draft.clear();
            draft.seed("");
          }}
        />
      ) : null}
      <FormError error={send.error} />
      <Button
        icon="send-outline"
        label="Send"
        loading={send.isPending}
        disabled={draft.value.trim().length < 3}
        onPress={() =>
          send.mutate(undefined, {
            onSuccess: () => {
              void draft.clear();
              setSent(true);
            },
          })
        }
      />
      <Body muted>Sent with your name, email and the app version ({APP_VERSION}), so we can reply and find the problem.</Body>
    </Screen>
  );
}
