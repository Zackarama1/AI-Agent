import { useCallback, useEffect, useState } from "react";
import {
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { Alert, api } from "../api/client";
import { money, theme } from "../theme";

// Create + list price alerts for a single symbol, shown on the detail screen.
export function AlertsSection({ symbol }: { symbol: string }) {
  const [alerts, setAlerts] = useState<Alert[]>([]);
  const [direction, setDirection] = useState<"above" | "below">("above");
  const [target, setTarget] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(() => {
    api
      .getAlerts()
      .then((all) => setAlerts(all.filter((a) => a.symbol === symbol.toUpperCase())))
      .catch(() => {});
  }, [symbol]);

  useEffect(() => load(), [load]);

  const add = async () => {
    const t = Number(target);
    if (!(t > 0)) {
      setError("Enter a target price.");
      return;
    }
    setError(null);
    try {
      await api.addAlert({ symbol: symbol.toUpperCase(), direction, target: t });
      setTarget("");
      load();
    } catch {
      setError("Couldn't create the alert.");
    }
  };

  const remove = async (id: number) => {
    await api.deleteAlert(id).catch(() => {});
    load();
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.section}>Price Alerts</Text>

      <View style={styles.form}>
        <View style={styles.toggle}>
          {(["above", "below"] as const).map((d) => (
            <TouchableOpacity
              key={d}
              style={[styles.toggleBtn, direction === d && styles.toggleOn]}
              onPress={() => setDirection(d)}
            >
              <Text style={[styles.toggleText, direction === d && { color: "#fff" }]}>
                {d === "above" ? "Above" : "Below"}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
        <TextInput
          style={styles.input}
          value={target}
          onChangeText={setTarget}
          placeholder="Price"
          placeholderTextColor={theme.colors.textDim}
          keyboardType="decimal-pad"
        />
        <TouchableOpacity style={styles.addBtn} onPress={add}>
          <Text style={styles.addText}>Set</Text>
        </TouchableOpacity>
      </View>
      {error && <Text style={styles.error}>{error}</Text>}

      {alerts.map((a) => (
        <View key={a.id} style={styles.alertRow}>
          <Text style={styles.alertText}>
            {a.active ? "🔔" : "✓"} {a.direction} {money(a.target)}
            {!a.active && "  (triggered)"}
          </Text>
          <TouchableOpacity onPress={() => remove(a.id)}>
            <Text style={styles.remove}>Remove</Text>
          </TouchableOpacity>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { marginBottom: theme.spacing(3) },
  section: { color: theme.colors.text, fontSize: 18, fontWeight: "700", marginBottom: 12 },
  form: { flexDirection: "row", alignItems: "center", gap: 8 },
  toggle: { flexDirection: "row", borderRadius: 10, overflow: "hidden" },
  toggleBtn: {
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
  },
  toggleOn: { backgroundColor: theme.colors.accent, borderColor: theme.colors.accent },
  toggleText: { color: theme.colors.textDim, fontSize: 13, fontWeight: "600" },
  input: {
    flex: 1,
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: 10,
    padding: 10,
    color: theme.colors.text,
    fontSize: 15,
  },
  addBtn: {
    backgroundColor: theme.colors.accent,
    borderRadius: 10,
    paddingHorizontal: 16,
    paddingVertical: 11,
  },
  addText: { color: "#fff", fontWeight: "700" },
  error: { color: theme.colors.down, marginTop: 8, fontSize: 13 },
  alertRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginTop: 12,
  },
  alertText: { color: theme.colors.text, fontSize: 14 },
  remove: { color: theme.colors.down, fontSize: 13 },
});
