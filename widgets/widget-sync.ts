import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import { requestWidgetUpdate } from 'react-native-android-widget';
import { MoneyStacDailyWidget } from './MoneyStacDailyWidget';

export const WIDGET_DATA_KEY = '@moneystac_widget_daily_data';

export interface WidgetDailyStats {
  todaySpent: number;
  dailyBudget: number;
  txCount: number;
  pendingCount: number;
  dateStr: string;
}

const MONTH_NAMES = [
  'JAN', 'FEB', 'MAR', 'APR', 'MAY', 'JUN',
  'JUL', 'AUG', 'SEP', 'OCT', 'NOV', 'DEC',
];

export function getTodayDateStr(date: Date = new Date()): string {
  const day = date.getDate();
  const month = MONTH_NAMES[date.getMonth()];
  return `TODAY • ${day} ${month}`;
}

export async function getCachedWidgetData(): Promise<WidgetDailyStats> {
  const todayStr = getTodayDateStr();

  try {
    const raw = await AsyncStorage.getItem(WIDGET_DATA_KEY);
    if (raw) {
      const parsed: WidgetDailyStats = JSON.parse(raw);
      // Auto-rollover if the date has changed since the last app update
      if (parsed.dateStr && parsed.dateStr !== todayStr) {
        parsed.todaySpent = 0;
        parsed.txCount = 0;
        parsed.dateStr = todayStr;
      }
      return parsed;
    }
  } catch (e) {
    console.warn('Failed to read widget cache from AsyncStorage:', e);
  }

  // Fallback defaults
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
    console.log('Widget update skipped or not supported in current environment:', e);
  }
}
