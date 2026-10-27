import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import { requestWidgetUpdate } from 'react-native-android-widget';
import { MoneyStacDailyWidget } from './MoneyStacDailyWidget';
import {
  DailyComparisonPoint,
  MoneyStacGraphWidget,
  MoneyStacGraphWidgetProps,
} from './MoneyStacGraphWidget';

export const WIDGET_DATA_KEY = '@moneystac_widget_daily_data';
export const GRAPH_WIDGET_DATA_KEY = '@moneystac_widget_graph_data';

export interface WidgetDailyStats {
  todaySpent: number;
  dailyBudget: number;
  txCount: number;
  pendingCount: number;
  dateStr: string;
}

export type WidgetGraphData = MoneyStacGraphWidgetProps;

const MONTH_NAMES = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
];

export function getTodayDateStr(date: Date = new Date()): string {
  const day = date.getDate();
  const month = MONTH_NAMES[date.getMonth()];
  return `TODAY • ${day} ${month}`;
}

/**
 * Reads the latest Daily Widget stats, checking SQLite directly first for ground truth
 * and falling back gracefully to AsyncStorage.
 */
export async function getCachedWidgetData(): Promise<WidgetDailyStats> {
  const now = new Date();
  const todayStr = getTodayDateStr(now);

  // 1. Attempt to fetch directly from SQLite database (moneystac_v2.db)
  try {
    const { openDatabaseAsync } = await import('expo-sqlite');
    const db = await openDatabaseAsync('moneystac_v2.db');

    let budgetNum = 350;
    try {
      const savedBudget = await AsyncStorage.getItem('dailyBudget');
      if (savedBudget) budgetNum = parseFloat(savedBudget) || 350;
    } catch { }

    let pendingCount = 0;
    try {
      const savedPending = await AsyncStorage.getItem('moneystac_to_be_logged');
      if (savedPending) {
        const list = JSON.parse(savedPending);
        if (Array.isArray(list)) pendingCount = list.length;
      }
    } catch { }

    // Find all IDs representing myself
    const myselfRows = await db.getAllAsync<{ id: string }>(
      "SELECT id FROM exchangers WHERE id = 'default-myself-001' OR id = 'myself' OR UPPER(name) = 'ME' OR UPPER(name) = 'MYSELF'"
    );
    const myselfIds = new Set(myselfRows.map(r => r.id));
    myselfIds.add('default-myself-001');
    myselfIds.add('myself');

    const txRows = await db.getAllAsync<{ delta: number; date: string; exchangerId: string }>(
      'SELECT delta, date, exchangerId FROM transactions WHERE delta < 0'
    );

    const todayY = now.getFullYear();
    const todayM = now.getMonth();
    const todayD = now.getDate();

    let spentToday = 0;
    let txCountToday = 0;

    txRows.forEach(tx => {
      try {
        const d = new Date(tx.date);
        if (
          d.getFullYear() === todayY &&
          d.getMonth() === todayM &&
          d.getDate() === todayD
        ) {
          if (myselfIds.has(tx.exchangerId) || myselfIds.size === 0) {
            spentToday += Math.abs(tx.delta);
            txCountToday++;
          }
        }
      } catch { }
    });

    // Fallback: If no transactions matched myselfIds but there are outflow transactions today
    if (spentToday === 0 && txCountToday === 0 && txRows.length > 0) {
      txRows.forEach(tx => {
        try {
          const d = new Date(tx.date);
          if (
            d.getFullYear() === todayY &&
            d.getMonth() === todayM &&
            d.getDate() === todayD
          ) {
            spentToday += Math.abs(tx.delta);
            txCountToday++;
          }
        } catch { }
      });
    }

    const liveStats: WidgetDailyStats = {
      todaySpent: Math.round(spentToday),
      dailyBudget: Math.round(budgetNum),
      txCount: txCountToday,
      pendingCount,
      dateStr: todayStr,
    };

    // Cache the fresh stats to AsyncStorage
    AsyncStorage.setItem(WIDGET_DATA_KEY, JSON.stringify(liveStats)).catch(() => { });
    return liveStats;
  } catch (err) {
    console.log('[Widget] SQLite direct read skipped/failed, checking cache:', err);
  }

  // 2. Fallback to AsyncStorage cache
  try {
    const raw = await AsyncStorage.getItem(WIDGET_DATA_KEY);
    if (raw) {
      const parsed: WidgetDailyStats = JSON.parse(raw);
      return parsed;
    }
  } catch (e) {
    console.warn('Failed to read widget cache from AsyncStorage:', e);
  }

  // 3. Fallback defaults
  return {
    todaySpent: 0,
    dailyBudget: 350,
    txCount: 0,
    pendingCount: 0,
    dateStr: todayStr,
  };
}

export async function updateDailyWidget(stats: WidgetDailyStats): Promise<void> {
  try {
    // 1. Cache to AsyncStorage so widget task handler can read it anytime in background
    await AsyncStorage.setItem(WIDGET_DATA_KEY, JSON.stringify(stats));

    // 2. Request widget update
    await requestWidgetUpdate({
      widgetName: 'MoneyStacDailyWidget',
      renderWidget: () => React.createElement(MoneyStacDailyWidget, stats),
      widgetNotFound: () => {
        // No widget on home screen; nothing to update
      },
    });
  } catch (e) {
    // Graceful catch - e.g. when running in Expo Go or native module not initialized yet
    console.log('Daily widget update skipped or not supported in current environment:', e);
  }
}

export function getDefaultGraphWidgetData(now: Date = new Date()): WidgetGraphData {
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const prevMonthDate = new Date(currentYear, currentMonth - 1, 1);

  const currentMonthName = MONTH_NAMES[currentMonth];
  const prevMonthName = MONTH_NAMES[prevMonthDate.getMonth()];
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const todayDay = now.getDate();

  const dailyPoints: DailyComparisonPoint[] = Array.from({ length: daysInMonth }, (_, i) => ({
    day: i + 1,
    currentOutflow: 0,
    prevOutflow: 0,
  }));

  return {
    currentMonthName,
    prevMonthName,
    currentMonthTotal: 0,
    prevMonthTotal: 0,
    diffPercent: 0,
    isOutflowLower: true,
    todayDay,
    daysInMonth,
    activeDaysCount: 0,
    dailyPoints,
    lastUpdatedStr: now.toISOString(),
  };
}

export async function getCachedGraphWidgetData(): Promise<WidgetGraphData> {
  const now = new Date();

  // 1. Try reading directly from SQLite (moneystac_v2.db)
  try {
    const { openDatabaseAsync } = await import('expo-sqlite');
    const db = await openDatabaseAsync('moneystac_v2.db');

    const currentYear = now.getFullYear();
    const currentMonth = now.getMonth();
    const prevMonthDate = new Date(currentYear, currentMonth - 1, 1);
    const prevYear = prevMonthDate.getFullYear();
    const prevMonth = prevMonthDate.getMonth();

    const currentMonthName = MONTH_NAMES[currentMonth];
    const prevMonthName = MONTH_NAMES[prevMonth];
    const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
    const todayDay = now.getDate();

    const currDailyMap: Record<number, number> = {};
    const prevDailyMap: Record<number, number> = {};
    for (let d = 1; d <= 31; d++) {
      currDailyMap[d] = 0;
      prevDailyMap[d] = 0;
    }

    let currTotal = 0;
    let prevTotal = 0;

    const myselfRows = await db.getAllAsync<{ id: string }>(
      "SELECT id FROM exchangers WHERE id = 'default-myself-001' OR id = 'myself' OR UPPER(name) = 'ME' OR UPPER(name) = 'MYSELF'"
    );
    const myselfIds = new Set(myselfRows.map(r => r.id));
    myselfIds.add('default-myself-001');
    myselfIds.add('myself');

    const txRows = await db.getAllAsync<{ delta: number; date: string; exchangerId: string }>(
      'SELECT delta, date, exchangerId FROM transactions WHERE delta < 0'
    );

    txRows.forEach(tx => {
      try {
        if (myselfIds.has(tx.exchangerId) || myselfIds.size === 0) {
          const d = new Date(tx.date);
          const y = d.getFullYear();
          const m = d.getMonth();
          const day = d.getDate();
          const amt = Math.abs(tx.delta);

          if (y === currentYear && m === currentMonth) {
            currDailyMap[day] = (currDailyMap[day] || 0) + amt;
            currTotal += amt;
          } else if (y === prevYear && m === prevMonth) {
            prevDailyMap[day] = (prevDailyMap[day] || 0) + amt;
            prevTotal += amt;
          }
        }
      } catch { }
    });

    // FALLBACK 1: If no transactions matched myselfIds for either month, scan all transactions
    if (currTotal === 0 && prevTotal === 0 && txRows.length > 0) {
      txRows.forEach(tx => {
        try {
          const d = new Date(tx.date);
          const y = d.getFullYear();
          const m = d.getMonth();
          const day = d.getDate();
          const amt = Math.abs(tx.delta);

          if (y === currentYear && m === currentMonth) {
            currDailyMap[day] = (currDailyMap[day] || 0) + amt;
            currTotal += amt;
          } else if (y === prevYear && m === prevMonth) {
            prevDailyMap[day] = (prevDailyMap[day] || 0) + amt;
            prevTotal += amt;
          }
        } catch { }
      });
    }

    const diffPercent =
      prevTotal > 0
        ? Math.round(((currTotal - prevTotal) / prevTotal) * 100)
        : 0;
    const isOutflowLower = diffPercent <= 0;

    const dailyPoints: DailyComparisonPoint[] = [];
    let activeDaysCount = 0;

    for (let d = 1; d <= daysInMonth; d++) {
      const currentOutflow = Math.round(currDailyMap[d] || 0);
      const prevOutflow = Math.round(prevDailyMap[d] || 0);
      if (currentOutflow > 0) activeDaysCount++;
      dailyPoints.push({ day: d, currentOutflow, prevOutflow });
    }

    const liveGraphData: WidgetGraphData = {
      currentMonthName,
      prevMonthName,
      currentMonthTotal: Math.round(currTotal),
      prevMonthTotal: Math.round(prevTotal),
      diffPercent,
      isOutflowLower,
      todayDay,
      daysInMonth,
      activeDaysCount,
      dailyPoints,
      lastUpdatedStr: now.toISOString(),
    };

    AsyncStorage.setItem(GRAPH_WIDGET_DATA_KEY, JSON.stringify(liveGraphData)).catch(() => { });
    return liveGraphData;
  } catch (err) {
    console.log('[Widget] SQLite read for graph skipped/failed, checking cache:', err);
  }

  // 2. Fallback to AsyncStorage cache
  try {
    const raw = await AsyncStorage.getItem(GRAPH_WIDGET_DATA_KEY);
    if (raw) {
      const parsed: WidgetGraphData = JSON.parse(raw);
      // Ensure month names are current
      parsed.todayDay = now.getDate();
      return parsed;
    }
  } catch (e) {
    console.warn('Failed to read graph widget cache from AsyncStorage:', e);
  }

  return getDefaultGraphWidgetData(now);
}

export async function updateGraphWidget(graphData: WidgetGraphData): Promise<void> {
  try {
    // 1. Cache to AsyncStorage
    await AsyncStorage.setItem(GRAPH_WIDGET_DATA_KEY, JSON.stringify(graphData));

    // 2. Request widget update
    await requestWidgetUpdate({
      widgetName: 'MoneyStacGraphWidget',
      renderWidget: () => React.createElement(MoneyStacGraphWidget, graphData),
      widgetNotFound: () => {
        // No graph widget on home screen; nothing to update
      },
    });
  } catch (e) {
    console.log('Graph widget update skipped or not supported in current environment:', e);
  }
}

/**
 * Computes the Daily Outflow Comparison graph widget data from exchangers history
 */
export function computeGraphWidgetData(
  exchangers: any[],
  now: Date = new Date()
): WidgetGraphData {
  const currentYear = now.getFullYear();
  const currentMonth = now.getMonth();
  const prevMonthDate = new Date(currentYear, currentMonth - 1, 1);
  const prevYear = prevMonthDate.getFullYear();
  const prevMonth = prevMonthDate.getMonth();

  const currentMonthName = MONTH_NAMES[currentMonth];
  const prevMonthName = MONTH_NAMES[prevMonth];
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();
  const todayDay = now.getDate();

  const currDailyMap: Record<number, number> = {};
  const prevDailyMap: Record<number, number> = {};
  for (let d = 1; d <= 31; d++) {
    currDailyMap[d] = 0;
    prevDailyMap[d] = 0;
  }

  let currTotal = 0;
  let prevTotal = 0;

  const myself = exchangers.find(
    (e: any) =>
      e.id === 'default-myself-001' ||
      e.id === 'myself' ||
      e.name?.toUpperCase() === 'MYSELF' ||
      e.name?.toUpperCase() === 'ME'
  ) || exchangers[0];

  if (myself && Array.isArray(myself.history)) {
    myself.history.forEach((tx: any) => {
      try {
        if (tx.delta < 0) {
          const d = new Date(tx.date);
          const y = d.getFullYear();
          const m = d.getMonth();
          const day = d.getDate();
          const amt = Math.abs(tx.delta);

          if (y === currentYear && m === currentMonth) {
            currDailyMap[day] = (currDailyMap[day] || 0) + amt;
            currTotal += amt;
          } else if (y === prevYear && m === prevMonth) {
            prevDailyMap[day] = (prevDailyMap[day] || 0) + amt;
            prevTotal += amt;
          }
        }
      } catch { }
    });
  }

  // Fallback: If myself stack had 0 transactions for both months, scan all other exchangers
  if (currTotal === 0 && prevTotal === 0 && Array.isArray(exchangers)) {
    for (const ex of exchangers) {
      if (Array.isArray(ex.history)) {
        ex.history.forEach((tx: any) => {
          try {
            if (tx.delta < 0) {
              const d = new Date(tx.date);
              const y = d.getFullYear();
              const m = d.getMonth();
              const day = d.getDate();
              const amt = Math.abs(tx.delta);

              if (y === currentYear && m === currentMonth) {
                currDailyMap[day] = (currDailyMap[day] || 0) + amt;
                currTotal += amt;
              } else if (y === prevYear && m === prevMonth) {
                prevDailyMap[day] = (prevDailyMap[day] || 0) + amt;
                prevTotal += amt;
              }
            }
          } catch { }
        });
      }
    }
  }

  const diffPercent =
    prevTotal > 0
      ? Math.round(((currTotal - prevTotal) / prevTotal) * 100)
      : 0;
  const isOutflowLower = diffPercent <= 0;

  const dailyPoints: DailyComparisonPoint[] = [];
  let activeDaysCount = 0;

  for (let d = 1; d <= daysInMonth; d++) {
    const currentOutflow = Math.round(currDailyMap[d] || 0);
    const prevOutflow = Math.round(prevDailyMap[d] || 0);
    if (currentOutflow > 0) {
      activeDaysCount++;
    }
    dailyPoints.push({
      day: d,
      currentOutflow,
      prevOutflow,
    });
  }

  return {
    currentMonthName,
    prevMonthName,
    currentMonthTotal: Math.round(currTotal),
    prevMonthTotal: Math.round(prevTotal),
    diffPercent,
    isOutflowLower,
    todayDay,
    daysInMonth,
    activeDaysCount,
    dailyPoints,
    lastUpdatedStr: now.toISOString(),
  };
}
