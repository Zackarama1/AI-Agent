import { useEffect, useRef, useState } from "react";
import {
  FlatList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";

import { api, SearchResult } from "../api/client";
import { theme } from "../theme";

export function SearchScreen({ navigation }: any) {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Debounce so we don't hit the API on every keystroke.
  useEffect(() => {
    if (timer.current) clearTimeout(timer.current);
    if (!q.trim()) {
      setResults([]);
      return;
    }
    timer.current = setTimeout(() => {
      api.search(q).then(setResults).catch(() => setResults([]));
    }, 250);
    return () => {
      if (timer.current) clearTimeout(timer.current);
    };
  }, [q]);

  return (
    <View style={styles.container}>
      <Text style={styles.h1}>Search</Text>
      <TextInput
        style={styles.input}
        value={q}
        onChangeText={setQ}
        placeholder="Search ticker or company…"
        placeholderTextColor={theme.colors.textDim}
        autoCapitalize="characters"
        autoCorrect={false}
      />
      <FlatList
        data={results}
        keyExtractor={(r, i) => `${r.symbol}-${i}`}
        keyboardShouldPersistTaps="handled"
        renderItem={({ item }) => (
          <TouchableOpacity
            style={styles.row}
            onPress={() => navigation.navigate("StockDetail", { symbol: item.symbol })}
          >
            <Text style={styles.symbol}>{item.symbol}</Text>
            <Text style={styles.desc} numberOfLines={1}>
              {item.description}
            </Text>
          </TouchableOpacity>
        )}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: theme.colors.bg, padding: theme.spacing(2), paddingTop: 60 },
  h1: { color: theme.colors.text, fontSize: 28, fontWeight: "800", marginBottom: 16 },
  input: {
    backgroundColor: theme.colors.card,
    borderColor: theme.colors.cardBorder,
    borderWidth: 1,
    borderRadius: 12,
    padding: 14,
    color: theme.colors.text,
    fontSize: 16,
    marginBottom: 16,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingVertical: 14,
    borderBottomColor: theme.colors.cardBorder,
    borderBottomWidth: 1,
  },
  symbol: { color: theme.colors.text, fontSize: 16, fontWeight: "700", width: 70 },
  desc: { color: theme.colors.textDim, fontSize: 14, flex: 1 },
});
