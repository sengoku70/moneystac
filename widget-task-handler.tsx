import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { MoneyStacDailyWidget } from './widgets/MoneyStacDailyWidget';
import { MoneyStacGraphWidget } from './widgets/MoneyStacGraphWidget';
import {
  getCachedGraphWidgetData,
  getCachedWidgetData,
} from './widgets/widget-sync';

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  const { widgetAction, renderWidget, widgetInfo } = props;

  switch (widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED': {
      try {
        if (widgetInfo?.widgetName === 'MoneyStacGraphWidget') {
          const graphData = await getCachedGraphWidgetData();
          renderWidget(React.createElement(MoneyStacGraphWidget, graphData));
        } else {
          const stats = await getCachedWidgetData();
          renderWidget(React.createElement(MoneyStacDailyWidget, stats));
        }
      } catch (err) {
        console.error('[widgetTaskHandler] Error rendering widget:', err);
      }
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
