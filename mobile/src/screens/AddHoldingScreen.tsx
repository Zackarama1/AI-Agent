import { useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { api } from "../api/client";
import { theme } from "../theme";

export function AddHoldingScreen({ navigation }: any) {
  const [symbol, setSymbol] = useState("");
  const [shares, setShares] = useState("");
  const [cost, setCost] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const submit = async () => {
    const s = Number(shares);
    const c = Number(cost);
    if (!symbol.trim() || !(s > 0) || !(c >= 0)) {
      setError("Enter a ticker, a positive share count, and a cost basis.");
      return;
    }
    setSaving(true);
    try {
      await api.addHolding({
        symbol: symbol.trim().toUpperCase(),
        shares: s,
        cost_basis: c,
      });
      navigation.goBack();
    } catch {
      setError("Couldn't save. Check the backend connection.");
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <Field label="Ticker" value={symbol} onChange={setSymbol} placeholder="AAPL" autoCapitalize="characters" />
      <Field label="Shares" value={shares} onChange={setShares} placeholder="10" keyboardType="decimal-pad" />
      <Field label="Avg cost / share" value={cost} onChange={setCost} placeholder="150.00" keyboardType="decimal-pad" />
      {error && <Text style={styles.error}>{error}</Text>}
      <TouchableOpacity style={[styles.btn, saving && { opacity: 0.6 }]} onPress={submit} disabled={saving}>
        <Text style={styles.btnText}>{saving ? "Saving…" : "Add Holding"}</Text>
      </TouchableOpacity>
    </View>
  );
}

function Field({ label, value, onChange, ...rest }: any) {
  return (
    <View style={{ marginBottom: 18 }}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={styles.input}
        value={value}
        onChangeText={onChange}
        placeholderTextColor={theme.colors.textDim}
        {...rest}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg, padding: theme.spacing(2.5) },
  label: { color: theme.colors.textDim, fontSize: 13, marginBottom: 6 },
  input: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    color: theme.colors.text,
    fontSize: 16,
  },
  error: { color: theme.colors.down, marginBottom: 12 },
  btn: {
    backgroundColor: theme.colors.accent,
    borderRadius: 12,
    padding: 16,
    alignItems: "center",
    marginTop: 8,
  },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "700" },
});
