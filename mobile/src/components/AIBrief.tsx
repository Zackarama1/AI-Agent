import { useEffect, useState } from "react";
import { ActivityIndicator, StyleSheet, Text, View } from "react-native";

import { api, Brief } from "../api/client";
import { theme } from "../theme";

// The headline feature: Claude's daily "what happened & why".
export function AIBrief() {
  const [brief, setBrief] = useState<Brief | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api
      .getBrief()
      .then(setBrief)
      .catch(() => setBrief({ text: "Couldn't load your brief.", is_mock: true }))
      .finally(() => setLoading(false));
  }, []);

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>✨ Daily Brief</Text>
        {brief?.is_mock && <Text style={styles.badge}>demo</Text>}
      </View>
      {loading ? (
        <ActivityIndicator color={theme.colors.accent} style={{ marginTop: 8 }} />
      ) : (
        <Text style={styles.body}>{brief?.text}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.accent,
    borderWidth: 1,
    borderRadius: theme.radius,
    padding: theme.spacing(2),
    marginBottom: theme.spacing(2),
  },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between" },
  title: { color: theme.colors.text, fontSize: 16, fontWeight: "700" },
  badge: {
    color: theme.colors.textDim,
    fontSize: 11,
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  body: { color: theme.colors.text, fontSize: 14, lineHeight: 21, marginTop: 8 },
});
