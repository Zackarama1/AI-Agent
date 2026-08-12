import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { Mode, useApp } from "../state/AppState";
import { theme } from "../theme";

// Segmented Simple / Advanced toggle, persisted via AppState.
export function ModeSwitch() {
  const { mode, setMode } = useApp();
  return (
    <View style={styles.wrap}>
      {(["simple", "advanced"] as Mode[]).map((m) => (
        <TouchableOpacity
          key={m}
          style={[styles.seg, mode === m && styles.segOn]}
          onPress={() => setMode(m)}
        >
          <Text style={[styles.text, mode === m && styles.textOn]}>
            {m === "simple" ? "Simple" : "Advanced"}
          </Text>
        </TouchableOpacity>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: 20,
    padding: 3,
  },
  seg: { paddingHorizontal: 12, paddingVertical: 5, borderRadius: 16 },
  segOn: { backgroundColor: theme.colors.accent },
  text: { color: theme.colors.textDim, fontSize: 12, fontWeight: "600" },
  textOn: { color: "#fff" },
});
