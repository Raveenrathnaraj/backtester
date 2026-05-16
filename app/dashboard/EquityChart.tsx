'use client';

import { useEffect, useRef } from 'react';
import { useTheme } from 'next-themes';
import { createChart, type IChartApi, ColorType, AreaSeries } from 'lightweight-charts';
import type { EquityPoint } from '@/types/backtester';

interface EquityChartProps {
  data: EquityPoint[];
}

export default function EquityChart({ data }: EquityChartProps) {
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const { resolvedTheme } = useTheme();

  const isDark = resolvedTheme === 'dark';

  useEffect(() => {
    if (!chartContainerRef.current || data.length === 0) return;

    // Clean up previous chart
    if (chartRef.current) {
      chartRef.current.remove();
      chartRef.current = null;
    }

    const bgColor = isDark ? '#0a0a0a' : '#ffffff';
    const textColor = isDark ? '#a1a1aa' : '#71717a';
    const gridColor = isDark ? 'rgba(255,255,255,0.04)' : 'rgba(0,0,0,0.04)';
    const lineColor = isDark ? '#22c55e' : '#16a34a';
    const topAreaColor = isDark
      ? 'rgba(34, 197, 94, 0.3)'
      : 'rgba(22, 163, 74, 0.2)';
    const bottomAreaColor = isDark
      ? 'rgba(34, 197, 94, 0.0)'
      : 'rgba(22, 163, 74, 0.0)';

    const chart = createChart(chartContainerRef.current, {
      width: chartContainerRef.current.clientWidth,
      height: 360,
      layout: {
        background: { type: ColorType.Solid, color: bgColor },
        textColor,
        fontFamily: 'var(--font-geist-sans), system-ui, sans-serif',
        fontSize: 12,
      },
      grid: {
        vertLines: { color: gridColor },
        horzLines: { color: gridColor },
      },
      crosshair: {
        vertLine: {
          color: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
          labelBackgroundColor: isDark ? '#27272a' : '#f4f4f5',
        },
        horzLine: {
          color: isDark ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.2)',
          labelBackgroundColor: isDark ? '#27272a' : '#f4f4f5',
        },
      },
      rightPriceScale: {
        borderColor: gridColor,
      },
      timeScale: {
        borderColor: gridColor,
        timeVisible: false,
      },
      handleScroll: { vertTouchDrag: false },
    });

    const series = chart.addSeries(AreaSeries, {
      lineColor,
      topColor: topAreaColor,
      bottomColor: bottomAreaColor,
      lineWidth: 2,
      priceFormat: {
        type: 'custom',
        formatter: (price: number) => {
          if (price >= 10000000) return `₹${(price / 10000000).toFixed(2)}Cr`;
          if (price >= 100000) return `₹${(price / 100000).toFixed(2)}L`;
          if (price >= 1000) return `₹${(price / 1000).toFixed(1)}K`;
          return `₹${price.toFixed(0)}`;
        },
      },
    });

    // Convert to lightweight-charts format
    const chartData = data.map((point) => ({
      time: point.date as any, // YYYY-MM-DD string is accepted
      value: point.equity ?? 0,
    }));

    series.setData(chartData);
    chart.timeScale().fitContent();
    chartRef.current = chart;

    // Responsive resize
    const resizeObserver = new ResizeObserver((entries) => {
      for (const entry of entries) {
        chart.applyOptions({ width: entry.contentRect.width });
      }
    });
    resizeObserver.observe(chartContainerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
    };
  }, [data, isDark]);

  if (data.length === 0) return null;

  return (
    <div
      ref={chartContainerRef}
      className="w-full rounded-xl overflow-hidden border border-border"
    />
  );
}
