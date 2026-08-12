import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Linking,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";

import { api, NewsItem, Quote } from "../api/client";
import { gainColor, money, pct, theme } from "../theme";

export function StockDetailScreen({ route }: any) {
  const { symbol } = route.params as { symbol: string };
  const [quote, setQuote] = useState<Quote | null>(null);
  const [news, setNews] = useState<NewsItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([api.getQuote(symbol), api.getNews(symbol)])
      .then(([q, n]) => {
        setQuote(q);
        setNews(n);
      })
      .finally(() => setLoading(false));
  }, [symbol]);

  if (loading) {
    return (
      <View style={[styles.container, styles.center]}>
        <ActivityIndicator color={theme.colors.accent} />
      </View>
    );
  }

  return (
    <ScrollView style={styles.container} contentContainerStyle={{ padding: theme.spacing(2) }}>
      <Text style={styles.symbol}>{symbol}</Text>
      {quote && (
        <View style={styles.quoteCard}>
          <Text style={styles.price}>{money(quote.price)}</Text>
          <Text style={[styles.change, { color: gainColor(quote.change) }]}>
            {money(quote.change)} ({pct(quote.percent_change)})
          </Text>
          <View style={styles.stats}>
            <Stat label="Open" value={money(quote.open)} />
            <Stat label="High" value={money(quote.high)} />
            <Stat label="Low" value={money(quote.low)} />
            <Stat label="Prev" value={money(quote.prev_close)} />
          </View>
        </View>
      )}

      <Text style={styles.section}>Latest News</Text>
      {news.map((n, i) => (
        <TouchableOpacity
          key={i}
          style={styles.newsCard}
          onPress={() => n.url && Linking.openURL(n.url)}
        >
          <Text style={styles.newsHead}>{n.headline}</Text>
          {!!n.summary && (
            <Text style={styles.newsSummary} numberOfLines={3}>
              {n.summary}
            </Text>
          )}
          <Text style={styles.newsSource}>{n.source}</Text>
        </TouchableOpacity>
      ))}
    </ScrollView>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statLabel}>{label}</Text>
      <Text style={styles.statValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg },
  center: { justifyContent: "center", alignItems: "center" },
  symbol: { color: theme.colors.text, fontSize: 28, fontWeight: "800", marginBottom: 12 },
  quoteCard: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: theme.radius,
    padding: theme.spacing(2.5),
    marginBottom: theme.spacing(3),
  },
  price: { color: theme.colors.text, fontSize: 32, fontWeight: "800" },
  change: { fontSize: 16, marginTop: 4, fontWeight: "600" },
  stats: { flexDirection: "row", justifyContent: "space-between", marginTop: 16 },
  stat: { alignItems: "center" },
  statLabel: { color: theme.colors.textDim, fontSize: 12 },
  statValue: { color: theme.colors.text, fontSize: 14, fontWeight: "600", marginTop: 2 },
  section: { color: theme.colors.text, fontSize: 18, fontWeight: "700", marginBottom: 12 },
  newsCard: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: theme.radius,
    padding: theme.spacing(2),
    marginBottom: theme.spacing(1.5),
  },
  newsHead: { color: theme.colors.text, fontSize: 15, fontWeight: "600" },
  newsSummary: { color: theme.colors.textDim, fontSize: 13, lineHeight: 19, marginTop: 6 },
  newsSource: { color: theme.colors.accent, fontSize: 12, marginTop: 8 },
});
