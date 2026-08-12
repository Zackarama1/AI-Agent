import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { ApiError } from "../api/client";
import { useApp } from "../state/AppState";
import { theme } from "../theme";

export function AuthScreen() {
  const { login, register } = useApp();
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const submit = async () => {
    setError(null);
    if (mode === "register" && password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      if (mode === "login") await login(email.trim(), password);
      else await register(email.trim(), password);
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Something went wrong.");
      setBusy(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={styles.container}
      behavior={Platform.OS === "ios" ? "padding" : undefined}
    >
      <View style={styles.inner}>
        <Text style={styles.brand}>📈 StockSense</Text>
        <Text style={styles.tagline}>Your portfolio, explained.</Text>

        <TextInput
          style={styles.input}
          value={email}
          onChangeText={setEmail}
          placeholder="Email"
          placeholderTextColor={theme.colors.textDim}
          autoCapitalize="none"
          keyboardType="email-address"
          autoCorrect={false}
        />
        <TextInput
          style={styles.input}
          value={password}
          onChangeText={setPassword}
          placeholder="Password"
          placeholderTextColor={theme.colors.textDim}
          secureTextEntry
        />
        {error && <Text style={styles.error}>{error}</Text>}

        <TouchableOpacity style={styles.btn} onPress={submit} disabled={busy}>
          {busy ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <Text style={styles.btnText}>
              {mode === "login" ? "Log in" : "Create account"}
            </Text>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          onPress={() => {
            setMode(mode === "login" ? "register" : "login");
            setError(null);
          }}
        >
          <Text style={styles.switch}>
            {mode === "login"
              ? "New here? Create an account"
              : "Already have an account? Log in"}
          </Text>
        </TouchableOpacity>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  inner: { flex: 1, justifyContent: "center", padding: theme.spacing(3) },
  brand: { color: theme.colors.text, fontSize: 32, fontWeight: "800", textAlign: "center" },
  tagline: {
    color: theme.colors.textDim,
    fontSize: 15,
    textAlign: "center",
    marginTop: 6,
    marginBottom: 32,
  },
  input: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 15,
    color: theme.colors.text,
    fontSize: 16,
    marginBottom: 14,
  },
  error: { color: theme.colors.down, marginBottom: 12, fontSize: 14 },
  btn: {
    backgroundColor: theme.colors.accent,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 4,
  },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
  switch: { color: theme.colors.accent, textAlign: "center", marginTop: 20, fontSize: 14 },
});
