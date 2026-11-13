import { Ionicons } from "@expo/vector-icons";
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, StyleSheet, Text, TextInput, View, type PressableProps, type StyleProp, type TextInputProps, type TextStyle, type ViewStyle, Linking } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { ApiError, avatarColor, initials } from "@koinonia/shared";
import { radius, serif, space, useTheme } from "@/lib/theme";

export type IconName = React.ComponentProps<typeof Ionicons>["name"];

// ---------------------------------------------------------------------------
// Text
// ---------------------------------------------------------------------------
export function Title({ children, style }: { children: React.ReactNode; style?: StyleProp<TextStyle> }) {
  const { c } = useTheme();
  return (
    <Text accessibilityRole="header" style={[{ fontFamily: serif, fontSize: 30, fontWeight: "700", color: c.text }, style]}>
      {children}
    </Text>
  );
}

export function Body({ children, muted, style, numberOfLines }: { children: React.ReactNode; muted?: boolean; style?: StyleProp<TextStyle>; numberOfLines?: number }) {
  const { c } = useTheme();
  return (
    <Text numberOfLines={numberOfLines} style={[{ fontSize: 16, lineHeight: 22, color: muted ? c.textMuted : c.text }, style]}>
      {children}
    </Text>
  );
}

export function SectionTitle({ children, count, tone = "primary", action }: { children: string; count?: number; tone?: "primary" | "danger" | "gold" | "forest"; action?: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: space.sm, marginBottom: space.sm, minHeight: 28 }}>
      <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: c[tone] }} />
      <Text accessibilityRole="header" style={{ flex: 1, fontSize: 12, fontWeight: "800", letterSpacing: 1.2, color: c.textMuted, textTransform: "uppercase" }}>
        {children}
        {count !== undefined ? `  ${count}` : ""}
      </Text>
      {action}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Screen scaffolding
// ---------------------------------------------------------------------------
interface ScreenProps {
  children: React.ReactNode;
  /** Tab screens draw under the status bar and need the top inset themselves. */
  topInset?: boolean;
  refreshing?: boolean;
  onRefresh?: () => void;
  keyboard?: boolean;
}

export function Screen({ children, topInset, refreshing, onRefresh, keyboard }: ScreenProps) {
  const { c } = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <ScrollView
      style={{ flex: 1, backgroundColor: c.bg }}
      contentContainerStyle={{ padding: space.lg, paddingTop: topInset ? insets.top + space.md : space.lg, paddingBottom: insets.bottom + 96, gap: space.xl }}
      contentInsetAdjustmentBehavior={topInset ? "never" : "automatic"}
      keyboardShouldPersistTaps="handled"
      automaticallyAdjustKeyboardInsets={keyboard}
      refreshControl={onRefresh ? <RefreshControl refreshing={Boolean(refreshing)} onRefresh={onRefresh} tintColor={c.primary} /> : undefined}
    >
      {children}
    </ScrollView>
  );
}

export function Card({ children, style }: { children: React.ReactNode; style?: StyleProp<ViewStyle> }) {
  const { c } = useTheme();
  return <View style={[{ backgroundColor: c.surface, borderRadius: radius.lg, borderWidth: StyleSheet.hairlineWidth * 2, borderColor: c.border, overflow: "hidden" }, style]}>{children}</View>;
}

/** Rows inside a Card, separated by hairlines. */
export function Rows({ children }: { children: React.ReactNode[] }) {
  const { c } = useTheme();
  const items = children.filter(Boolean);
  return (
    <Card>
      {items.map((child, i) => (
        <View key={i} style={i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth * 2, borderTopColor: c.border } : undefined}>
          {child}
        </View>
      ))}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// Buttons
// ---------------------------------------------------------------------------
type Variant = "primary" | "forest" | "secondary" | "ghost" | "danger" | "onHero";

interface ButtonProps extends Omit<PressableProps, "children" | "style"> {
  label: string;
  icon?: IconName;
  variant?: Variant;
  small?: boolean;
  loading?: boolean;
  style?: StyleProp<ViewStyle>;
}

export function Button({ label, icon, variant = "primary", small, loading, disabled, style, ...rest }: ButtonProps) {
  const { c } = useTheme();
  const colors: Record<Variant, { bg: string; fg: string; border?: string }> = {
    primary: { bg: c.primary, fg: c.onPrimary },
    forest: { bg: c.forest, fg: c.onPrimary },
    secondary: { bg: c.surface, fg: c.text, border: c.border },
    ghost: { bg: "transparent", fg: c.primary },
    danger: { bg: c.dangerSoft, fg: c.danger },
    onHero: { bg: "#FFFFFF", fg: "#143B2B" },
  };
  const { bg, fg, border } = colors[variant];
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: Boolean(disabled || loading), busy: Boolean(loading) }}
      disabled={disabled || loading}
      {...rest}
      style={({ pressed }) => [
        {
          minHeight: small ? 36 : 48,
          paddingHorizontal: small ? space.md : space.lg,
          borderRadius: radius.md,
          backgroundColor: bg,
          borderWidth: border ? 1 : 0,
          borderColor: border,
          flexDirection: "row",
          alignItems: "center",
          justifyContent: "center",
          gap: space.sm,
          opacity: disabled || loading ? 0.55 : pressed ? 0.8 : 1,
        },
        style,
      ]}
    >
      {loading ? <ActivityIndicator size="small" color={fg} /> : icon ? <Ionicons name={icon} size={small ? 16 : 18} color={fg} /> : null}
      <Text style={{ color: fg, fontWeight: "700", fontSize: small ? 14 : 16 }}>{label}</Text>
    </Pressable>
  );
}

export function IconButton({ icon, label, onPress, color, disabled }: { icon: IconName; label: string; onPress: () => void; color?: string; disabled?: boolean }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      hitSlop={8}
      style={({ pressed }) => ({ width: 40, height: 40, alignItems: "center", justifyContent: "center", borderRadius: radius.md, opacity: disabled ? 0.4 : pressed ? 0.6 : 1 })}
    >
      <Ionicons name={icon} size={22} color={color ?? c.textMuted} />
    </Pressable>
  );
}

/** Selectable pill, used for cadence, channel, filters and date shortcuts. */
export function Chip({ label, selected, onPress, tone = "primary" }: { label: string; selected: boolean; onPress: () => void; tone?: "primary" | "forest" }) {
  const { c } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => ({
        minHeight: 40,
        paddingHorizontal: 14,
        borderRadius: radius.pill,
        borderWidth: 1,
        borderColor: selected ? c[tone] : c.border,
        backgroundColor: selected ? c[tone] : c.surface,
        justifyContent: "center",
        opacity: pressed ? 0.75 : 1,
      })}
    >
      <Text style={{ fontWeight: "700", fontSize: 14, color: selected ? c.onPrimary : c.text }}>{label}</Text>
    </Pressable>
  );
}

export function ChipRow({ children }: { children: React.ReactNode }) {
  return <View style={{ flexDirection: "row", flexWrap: "wrap", gap: space.sm }}>{children}</View>;
}

// ---------------------------------------------------------------------------
// Fields
// ---------------------------------------------------------------------------
export function Label({ children }: { children: string }) {
  const { c } = useTheme();
  return <Text style={{ fontSize: 14, fontWeight: "700", color: c.text, marginBottom: 6 }}>{children}</Text>;
}

interface FieldProps extends TextInputProps {
  label: string;
  hint?: string;
  error?: string;
}

export function Field({ label, hint, error, multiline, style, ...rest }: FieldProps) {
  const { c } = useTheme();
  return (
    <View>
      <Label>{label}</Label>
      <TextInput
        accessibilityLabel={label}
        placeholderTextColor={c.textMuted}
        multiline={multiline}
        {...rest}
        style={[
          {
            minHeight: multiline ? 96 : 48,
            borderRadius: radius.md,
            borderWidth: 1,
            borderColor: error ? c.danger : c.border,
            backgroundColor: c.surface,
            color: c.text,
            paddingHorizontal: space.md,
            paddingVertical: multiline ? space.md : 0,
            fontSize: 16,
            textAlignVertical: multiline ? "top" : "center",
          },
          style,
        ]}
      />
      {error ? <Text style={{ color: c.danger, fontSize: 13, marginTop: 4 }}>{error}</Text> : hint ? <Text style={{ color: c.textMuted, fontSize: 13, marginTop: 4 }}>{hint}</Text> : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// Small pieces
// ---------------------------------------------------------------------------
export type BadgeTone = "neutral" | "primary" | "danger" | "gold" | "forest";

export function Badge({ label, tone = "neutral", icon }: { label: string; tone?: BadgeTone; icon?: IconName }) {
  const { c } = useTheme();
  const colors: Record<BadgeTone, [string, string]> = {
    neutral: [c.surfaceAlt, c.textMuted],
    primary: [c.primarySoft, c.primaryStrong],
    danger: [c.dangerSoft, c.danger],
    gold: [c.goldSoft, c.gold],
    forest: [c.forestSoft, c.forestStrong],
  };
  const [bg, fg] = colors[tone];
  return (
    <View style={{ flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: bg, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 4, alignSelf: "flex-start" }}>
      {icon ? <Ionicons name={icon} size={12} color={fg} /> : null}
      <Text style={{ color: fg, fontSize: 12, fontWeight: "700" }}>{label}</Text>
    </View>
  );
}

export function Avatar({ name, size = 44 }: { name: string; size?: number }) {
  return (
    <View accessible={false} style={{ width: size, height: size, borderRadius: size / 2, backgroundColor: avatarColor(name), alignItems: "center", justifyContent: "center" }}>
      <Text style={{ color: "#fff", fontWeight: "700", fontSize: size * 0.38 }}>{initials(name)}</Text>
    </View>
  );
}

export function Loading() {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center", backgroundColor: c.bg, padding: space.xxl }}>
      <ActivityIndicator color={c.primary} accessibilityLabel="Loading" />
    </View>
  );
}

export function EmptyState({ icon, title, body, action }: { icon?: IconName; title: string; body: string; action?: React.ReactNode }) {
  const { c } = useTheme();
  return (
    <View style={{ alignItems: "center", padding: space.xl, borderRadius: radius.lg, borderWidth: 1, borderStyle: "dashed", borderColor: c.border, gap: space.sm }}>
      {icon ? (
        <View style={{ width: 52, height: 52, borderRadius: 26, backgroundColor: c.primarySoft, alignItems: "center", justifyContent: "center" }}>
          <Ionicons name={icon} size={26} color={c.primary} />
        </View>
      ) : null}
      <Text style={{ fontFamily: serif, fontSize: 20, fontWeight: "700", color: c.text, textAlign: "center" }}>{title}</Text>
      <Text style={{ fontSize: 15, lineHeight: 21, color: c.textMuted, textAlign: "center" }}>{body}</Text>
      {action ? <View style={{ marginTop: space.sm }}>{action}</View> : null}
    </View>
  );
}

export function errorMessage(error: unknown): string {
  return error instanceof ApiError ? error.message : "Something went wrong. Please try again.";
}

export function fieldErrors(error: unknown): Record<string, string> {
  return error instanceof ApiError ? (error.fields ?? {}) : {};
}

export function ErrorState({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  const { c } = useTheme();
  return (
    <View style={{ flex: 1, backgroundColor: c.bg, padding: space.xl, justifyContent: "center" }}>
      <View accessibilityRole="alert" style={{ backgroundColor: c.dangerSoft, borderRadius: radius.lg, padding: space.xl, alignItems: "center", gap: space.md }}>
        <Text style={{ color: c.danger, fontWeight: "700", fontSize: 16, textAlign: "center" }}>{errorMessage(error)}</Text>
        {onRetry ? <Button label="Try again" variant="secondary" small onPress={onRetry} /> : null}
      </View>
    </View>
  );
}

export function FormError({ error }: { error: unknown }) {
  const { c } = useTheme();
  if (!error) return null;
  return (
    <View accessibilityRole="alert" style={{ backgroundColor: c.dangerSoft, borderRadius: radius.md, padding: space.md }}>
      <Text style={{ color: c.danger, fontWeight: "600" }}>{errorMessage(error)}</Text>
    </View>
  );
}

/** "Privacy Policy · Terms of Use": opens the pages on the web app. */
export function LegalLinks({ webUrl, prefix }: { webUrl: string; prefix?: string }) {
  const { c } = useTheme();
  const link = (label: string, path: string) => (
    <Text accessibilityRole="link" onPress={() => void Linking.openURL(`${webUrl}${path}`)} style={{ color: c.primary, fontWeight: "700" }}>
      {label}
    </Text>
  );
  return (
    <Text style={{ fontSize: 13, lineHeight: 19, color: c.textMuted, textAlign: "center" }}>
      {prefix ? `${prefix} ` : ""}
      {link("Terms of Use", "/terms")} {prefix ? "and" : "·"} {link("Privacy Policy", "/privacy")}
      {prefix ? "." : ""}
    </Text>
  );
}
