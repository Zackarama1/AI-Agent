import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert as RNAlert,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { AccountSummary, ApiError, api, Position, Quote } from "../api/client";
import { money, theme } from "../theme";

export function TradeScreen({ route, navigation }: any) {
  const { symbol } = route.params as { symbol: string };
  const [side, setSide] = useState<"buy" | "sell">("buy");
  const [qty, setQty] = useState("");
  const [quote, setQuote] = useState<Quote | null>(null);
  const [account, setAccount] = useState<AccountSummary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    Promise.all([api.getQuote(symbol), api.getAccount()]).then(([q, a]) => {
      setQuote(q);
      setAccount(a);
    });
  }, [symbol]);

  const held: Position | undefined = account?.positions.find(
    (p) => p.symbol === symbol.toUpperCase(),
  );
  const price = quote?.price ?? 0;
  const shares = Number(qty) || 0;
  const estimated = shares * price;
  const canAfford = side === "buy" ? estimated <= (account?.buying_power ?? 0) : true;
  const hasShares = side === "sell" ? shares <= (held?.quantity ?? 0) : true;

  const submit = async () => {
    if (!(shares > 0)) {
      setError("Enter a share quantity.");
      return;
    }
    setError(null);
    setBusy(true);
    try {
      const fill = await api.placeOrder({ symbol: symbol.toUpperCase(), side, quantity: shares });
      RNAlert.alert(
        "Order filled",
        `${side === "buy" ? "Bought" : "Sold"} ${shares} ${symbol.toUpperCase()} @ ${money(
          fill.trade.price,
        )}\nCash: ${money(fill.cash_after)}`,
      );
      navigation.goBack();
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Order failed.");
      setBusy(false);
    }
  };

  return (
    <View style={styles.container}>
      <Text style={styles.symbol}>{symbol.toUpperCase()}</Text>
      <Text style={styles.price}>{quote ? money(quote.price) : "—"}</Text>

      <View style={styles.toggle}>
        {(["buy", "sell"] as const).map((s) => (
          <TouchableOpacity
            key={s}
            style={[styles.tSeg, side === s && (s === "buy" ? styles.buyOn : styles.sellOn)]}
            onPress={() => setSide(s)}
          >
            <Text style={[styles.tText, side === s && { color: "#fff" }]}>
              {s === "buy" ? "Buy" : "Sell"}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <Text style={styles.label}>Shares</Text>
      <TextInput
        style={styles.input}
        value={qty}
        onChangeText={setQty}
        placeholder="0"
        placeholderTextColor={theme.colors.textDim}
        keyboardType="decimal-pad"
      />

      <View style={styles.summary}>
        <Row k="Market price" v={money(price)} />
        <Row k="Estimated total" v={money(estimated)} strong />
        <Row
          k={side === "buy" ? "Buying power" : "Shares held"}
          v={side === "buy" ? money(account?.buying_power ?? 0) : String(held?.quantity ?? 0)}
        />
      </View>

      {error && <Text style={styles.error}>{error}</Text>}
      {!canAfford && !error && <Text style={styles.error}>Not enough buying power.</Text>}
      {!hasShares && !error && <Text style={styles.error}>You don't hold that many shares.</Text>}

      <TouchableOpacity
        style={[
          styles.btn,
          { backgroundColor: side === "buy" ? theme.colors.up : theme.colors.down },
          (busy || !canAfford || !hasShares) && { opacity: 0.5 },
        ]}
        onPress={submit}
        disabled={busy || !canAfford || !hasShares}
      >
        {busy ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={styles.btnText}>
            {side === "buy" ? "Buy" : "Sell"} {symbol.toUpperCase()}
          </Text>
        )}
      </TouchableOpacity>
      <Text style={styles.disclaimer}>
        Paper trading — simulated orders with virtual cash. No real money moves.
      </Text>
    </View>
  );
}

function Row({ k, v, strong }: { k: string; v: string; strong?: boolean }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rk}>{k}</Text>
      <Text style={[styles.rv, strong && { fontWeight: "800", fontSize: 17 }]}>{v}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg, padding: theme.spacing(2.5) },
  symbol: { color: theme.colors.text, fontSize: 26, fontWeight: "800" },
  price: { color: theme.colors.textDim, fontSize: 18, marginTop: 2, marginBottom: 20 },
  toggle: { flexDirection: "row", gap: 10, marginBottom: 20 },
  tSeg: {
    flex: 1,
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: "center",
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
  },
  buyOn: { backgroundColor: theme.colors.up, borderColor: theme.colors.up },
  sellOn: { backgroundColor: theme.colors.down, borderColor: theme.colors.down },
  tText: { color: theme.colors.textDim, fontSize: 15, fontWeight: "700" },
  label: { color: theme.colors.textDim, fontSize: 13, marginBottom: 6 },
  input: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 15,
    color: theme.colors.text,
    fontSize: 22,
    fontWeight: "700",
    marginBottom: 20,
  },
  summary: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: 14,
    padding: 16,
    gap: 10,
  },
  row: { flexDirection: "row", justifyContent: "space-between" },
  rk: { color: theme.colors.textDim, fontSize: 14 },
  rv: { color: theme.colors.text, fontSize: 14, fontWeight: "600" },
  error: { color: theme.colors.down, marginTop: 14, fontSize: 14 },
  btn: { borderRadius: 12, padding: 16, alignItems: "center", marginTop: 22 },
  btnText: { color: "#fff", fontSize: 16, fontWeight: "800" },
  disclaimer: { color: theme.colors.textDim, fontSize: 12, textAlign: "center", marginTop: 14 },
});
