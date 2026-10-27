import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { MoneyStacDailyWidget } from './widgets/MoneyStacDailyWidget';
import { getCachedWidgetData } from './widgets/widget-sync';

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const { widgetAction, renderWidget } = props;

  switch (widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED': {
      const stats = await getCachedWidgetData();
      renderWidget(React.createElement(MoneyStacDailyWidget, stats));
      break;
    }

    case 'WIDGET_CLICK':
      // Clicks are configured with 'OPEN_APP' or 'OPEN_URI' which automatically
      // launch the app or deep links.
      break;

    case 'WIDGET_DELETED':
      break;

    default:
      break;
  }
}
