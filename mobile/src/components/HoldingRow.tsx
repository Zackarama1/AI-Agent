import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { HoldingWithQuote } from "../api/client";
import { gainColor, money, pct, theme } from "../theme";

export function HoldingRow({
  h,
  onPress,
}: {
  h: HoldingWithQuote;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress}>
      <View>
        <Text style={styles.symbol}>{h.symbol}</Text>
        <Text style={styles.shares}>{h.shares} sh</Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={styles.value}>{money(h.market_value)}</Text>
        <Text style={[styles.change, { color: gainColor(h.day_change_percent) }]}>
          {pct(h.day_change_percent)} today
        </Text>
        <Text style={[styles.change, { color: gainColor(h.gain) }]}>
          {pct(h.gain_percent)} total
        </Text>
      </View>
    </TouchableOpacity>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: theme.radius,
    padding: theme.spacing(2),
    marginBottom: theme.spacing(1.5),
  },
  symbol: { color: theme.colors.text, fontSize: 17, fontWeight: "700" },
  shares: { color: theme.colors.textDim, fontSize: 13, marginTop: 2 },
  value: { color: theme.colors.text, fontSize: 16, fontWeight: "600" },
  change: { fontSize: 13, marginTop: 2 },
});
