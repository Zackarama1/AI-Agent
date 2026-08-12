import { useMemo } from "react";
import { View } from "react-native";
import Svg, { Path, Line } from "react-native-svg";

import { Candle } from "../api/client";
import { theme } from "../theme";

// Lightweight close-price line chart. No axis labels by design — this is the
// glanceable "shape of the move" like Apple Stocks' sparkline, scaled up.
export function LineChart({
  candles,
  height = 180,
  width = 320,
}: {
  candles: Candle[];
  height?: number;
  width?: number;
}) {
  const { path, up, baseline } = useMemo(() => {
    if (candles.length < 2) return { path: "", up: true, baseline: 0 };
    const closes = candles.map((c) => c.c);
    const min = Math.min(...closes);
    const max = Math.max(...closes);
    const range = max - min || 1;
    const pad = 8;
    const w = width - pad * 2;
    const h = height - pad * 2;
    const x = (i: number) => pad + (i / (closes.length - 1)) * w;
    const y = (v: number) => pad + (1 - (v - min) / range) * h;
    const d = closes
      .map((v, i) => `${i === 0 ? "M" : "L"} ${x(i).toFixed(1)} ${y(v).toFixed(1)}`)
      .join(" ");
    const first = closes[0];
    const last = closes[closes.length - 1];
    return { path: d, up: last >= first, baseline: y(first) };
  }, [candles, height, width]);

  const color = up ? theme.colors.up : theme.colors.down;

  return (
    <View>
      <Svg width={width} height={height}>
        <Line
          x1={0}
          y1={baseline}
          x2={width}
          y2={baseline}
          stroke={theme.colors.cardBorder}
          strokeWidth={1}
          strokeDasharray="4 4"
        />
        <Path d={path} stroke={color} strokeWidth={2.5} fill="none" />
      </Svg>
    </View>
  );
}
