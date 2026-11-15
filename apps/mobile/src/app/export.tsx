import { useState } from "react";
import { Platform, Share, Text, View } from "react-native";
import { EXPORT_TABLES } from "@koinonia/shared";
import { Body, Button, FormError, Screen, Title } from "@/components/ui";
import { api } from "@/lib/api";
import { space, useTheme } from "@/lib/theme";

/** In the browser preview a file can be saved directly; on a phone it goes to the share sheet. */
async function deliver(name: string, text: string, type: string) {
  if (Platform.OS === "web") {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const link = document.createElement("a");
    link.href = url;
    link.download = name;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
    return;
  }
  await Share.share({ title: name, message: text });
}

/** "Export my data": everything in the account, as one file or as spreadsheets. */
export default function ExportScreen() {
  const { c } = useTheme();
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [done, setDone] = useState<string | null>(null);
  const today = new Date().toISOString().slice(0, 10);

  const run = async (key: string, label: string, make: () => Promise<{ name: string; text: string; type: string }>) => {
    setBusy(key);
    setError(null);
    setDone(null);
    try {
      const file = await make();
      await deliver(file.name, file.text, file.type);
      setDone(Platform.OS === "web" ? `${label} saved to your downloads.` : `${label} is ready. Choose where to keep it, for example "Save to Files" or Mail.`);
    } catch (err) {
      setError(err);
    } finally {
      setBusy(null);
    }
  };

  return (
    <Screen>
      <Title>Your data</Title>
      <Body muted>A copy of everything you&rsquo;ve put into Koinonia: your people, notes, reach-outs and prayer list. It is yours to keep.</Body>
      <Button
        icon="download-outline"
        label="Everything (one file)"
        loading={busy === "all"}
        onPress={() => run("all", "Everything", async () => ({ name: `koinonia-${today}.json`, text: JSON.stringify(await api.me.exportAll(), null, 2), type: "application/json" }))}
      />
      <View style={{ gap: space.sm }}>
        <Text style={{ fontSize: 15, fontWeight: "700", color: c.textMuted }}>Or as spreadsheets</Text>
        {EXPORT_TABLES.map((t) => (
          <Button
            key={t.key}
            variant="secondary"
            label={t.label}
            loading={busy === t.key}
            onPress={() => run(t.key, t.label, async () => ({ name: `koinonia-${t.key}-${today}.csv`, text: await api.me.exportCsv(t.key), type: "text/csv" }))}
          />
        ))}
      </View>
      {done ? (
        <Text accessibilityLiveRegion="polite" style={{ fontSize: 15, lineHeight: 21, fontWeight: "600", color: c.forest }}>
          {done}
        </Text>
      ) : null}
      <FormError error={error} />
    </Screen>
  );
}
