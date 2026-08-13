import { StyleSheet, Text, TouchableOpacity, View } from "react-native";

import { Position } from "../api/client";
import { gainColor, money, pct, theme } from "../theme";

export function PositionRow({ p, onPress }: { p: Position; onPress: () => void }) {
  return (
    <TouchableOpacity style={styles.row} onPress={onPress}>
      <View>
        <Text style={styles.symbol}>{p.symbol}</Text>
        <Text style={styles.shares}>
          {p.quantity} sh · avg {money(p.avg_cost)}
        </Text>
      </View>
      <View style={{ alignItems: "flex-end" }}>
        <Text style={styles.value}>{money(p.market_value)}</Text>
        <Text style={[styles.change, { color: gainColor(p.day_change_percent) }]}>
          {pct(p.day_change_percent)} today
        </Text>
        <Text style={[styles.change, { color: gainColor(p.unrealized_pl) }]}>
          {pct(p.unrealized_pl_percent)} P/L
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
