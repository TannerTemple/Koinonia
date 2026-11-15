import { useEffect, useState } from "react";
import { Modal, Pressable, Text, View } from "react-native";
import { radius, serif, space, useTheme } from "./theme";

/**
 * Messages, confirmations and short menus, drawn by the app itself.
 *
 * The phone's native alert does not exist in a browser, so in the web preview every
 * "Delete?" and every "…" menu used to do nothing at all. This looks and behaves the same
 * everywhere. `showDialog` takes the same arguments as React Native's `Alert.alert`.
 */
export interface DialogButton {
  text: string;
  style?: "default" | "cancel" | "destructive";
  onPress?: () => void;
}

interface DialogState {
  title: string;
  message?: string;
  buttons: DialogButton[];
}

let present: ((dialog: DialogState | null) => void) | null = null;

export function showDialog(title: string, message?: string, buttons?: DialogButton[]) {
  present?.({ title, message, buttons: buttons?.length ? buttons : [{ text: "OK" }] });
}

/** Mount once, at the root of the app. */
export function DialogHost() {
  const { c } = useTheme();
  const [dialog, setDialog] = useState<DialogState | null>(null);

  useEffect(() => {
    present = setDialog;
    return () => {
      present = null;
    };
  }, []);

  if (!dialog) return null;

  const close = () => setDialog(null);
  const cancel = dialog.buttons.find((b) => b.style === "cancel");
  const actions = dialog.buttons.filter((b) => b.style !== "cancel");
  const press = (button: DialogButton) => {
    close();
    button.onPress?.();
  };
  // One or two choices sit side by side like a question; more become a list like a menu.
  const sideBySide = actions.length <= 1 && Boolean(cancel);

  return (
    <Modal visible transparent animationType="fade" onRequestClose={() => (cancel ? press(cancel) : close())}>
      <Pressable accessibilityLabel="Close" onPress={() => (cancel ? press(cancel) : close())} style={{ flex: 1, backgroundColor: "rgba(10,16,36,0.55)", justifyContent: "center", padding: space.xl }}>
        <Pressable accessible={false} onPress={() => undefined} style={{ alignSelf: "center", width: "100%", maxWidth: 380, backgroundColor: c.surface, borderRadius: radius.lg, padding: space.xl, gap: space.md }}>
          <View accessibilityRole="alert" style={{ gap: space.sm }}>
            <Text accessibilityRole="header" style={{ fontFamily: serif, fontSize: 21, lineHeight: 27, fontWeight: "700", color: c.text }}>
              {dialog.title}
            </Text>
            {dialog.message ? <Text style={{ fontSize: 16, lineHeight: 23, color: c.textMuted }}>{dialog.message}</Text> : null}
          </View>
          <View style={{ flexDirection: sideBySide ? "row-reverse" : "column", gap: space.sm, marginTop: space.xs }}>
            {actions.map((b) => (
              <DialogAction key={b.text} button={b} grow={sideBySide} onPress={() => press(b)} />
            ))}
            {cancel ? <DialogAction button={cancel} grow={sideBySide} onPress={() => press(cancel)} /> : null}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

function DialogAction({ button, grow, onPress }: { button: DialogButton; grow: boolean; onPress: () => void }) {
  const { c } = useTheme();
  const destructive = button.style === "destructive";
  const cancel = button.style === "cancel";
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => ({
        flex: grow ? 1 : undefined,
        minHeight: 50,
        alignItems: "center",
        justifyContent: "center",
        paddingHorizontal: space.lg,
        borderRadius: radius.md,
        borderWidth: 1,
        borderColor: cancel ? c.border : destructive ? c.danger : c.primary,
        backgroundColor: cancel ? c.surface : destructive ? c.danger : c.primary,
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <Text style={{ fontSize: 17, fontWeight: "700", color: cancel ? c.text : c.onPrimary }}>{button.text}</Text>
    </Pressable>
  );
}
