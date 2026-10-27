import React from 'react';
import { FlexWidget, OverlapWidget, TextWidget } from 'react-native-android-widget';

export interface DailyComparisonPoint {
  day: number;
  currentOutflow: number;
  prevOutflow: number;
}

export interface MoneyStacGraphWidgetProps {
  currentMonthName?: string;
  prevMonthName?: string;
  currentMonthTotal?: number;
  prevMonthTotal?: number;
  diffPercent?: number;
  isOutflowLower?: boolean;
  todayDay?: number;
  daysInMonth?: number;
  activeDaysCount?: number;
  dailyPoints?: DailyComparisonPoint[];
  lastUpdatedStr?: string;
}

export function MoneyStacGraphWidget({
  currentMonthName = 'THIS MO',
  prevMonthName = 'LAST MO',
  currentMonthTotal = 0,
  prevMonthTotal = 0,
  diffPercent = 0,
  isOutflowLower = true,
  todayDay = new Date().getDate(),
  daysInMonth = 31,
  activeDaysCount = 0,
  dailyPoints,
  lastUpdatedStr,
}: MoneyStacGraphWidgetProps) {
  const safeDaysInMonth = typeof daysInMonth === 'number' && !isNaN(daysInMonth) ? daysInMonth : 31;
  const totalDays = Math.max(28, Math.min(31, safeDaysInMonth));
  const safeToday = typeof todayDay === 'number' && !isNaN(todayDay) ? todayDay : new Date().getDate();
  const currentToday = Math.max(1, Math.min(totalDays, safeToday));

  // Build a complete map of days from 1 to totalDays so points always has exactly totalDays entries
  const pointsMap = new Map<number, DailyComparisonPoint>();
  if (dailyPoints && Array.isArray(dailyPoints)) {
    dailyPoints.forEach((p) => {
      if (p && typeof p.day === 'number') {
        pointsMap.set(p.day, p);
      }
    });
  }

  const points: DailyComparisonPoint[] = Array.from({ length: totalDays }, (_, i) => {
    const day = i + 1;
    const existing = pointsMap.get(day);
    return {
      day,
      currentOutflow: existing && typeof existing.currentOutflow === 'number' && !isNaN(existing.currentOutflow)
        ? Math.max(0, existing.currentOutflow)
        : 0,
      prevOutflow: existing && typeof existing.prevOutflow === 'number' && !isNaN(existing.prevOutflow)
        ? Math.max(0, existing.prevOutflow)
        : 0,
    };
  });

  const currTotal = Math.max(0, Math.round(currentMonthTotal || 0));
  const prevTotal = Math.max(0, Math.round(prevMonthTotal || 0));
  const rawDiff = typeof diffPercent === 'number' && !isNaN(diffPercent) ? diffPercent : 0;
  const absDiff = Math.abs(Math.round(rawDiff));

  // Daily average for the current month so far (or active days)
  const daysPassed = Math.max(1, currentToday);
  const dailyAverage = Math.round(currTotal / daysPassed) || 0;
  const activeDays =
    typeof activeDaysCount === 'number' && activeDaysCount > 0
      ? activeDaysCount
      : points.filter((p) => (p.currentOutflow || 0) > 0).length;

  // Compute maximum outflow across both months for dynamic scaling
  const allValues = points
    .flatMap((p) => [p.currentOutflow, p.prevOutflow])
    .filter((v) => typeof v === 'number' && !isNaN(v) && v > 0);
  const maxVal = allValues.length > 0 ? Math.max(500, ...allValues) : 500;

  // Height scaling: max 58dp out of 64dp, min 3dp for any non-zero outflow
  const getBarHeight = (amount: number) => {
    if (!amount || isNaN(amount) || amount <= 0) return 0;
    const scaled = Math.round((amount / maxVal) * 58);
    return Math.min(58, Math.max(3, scaled));
  };

  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: 'moneystac://analytics' }}
      style={{
        width: 'match_parent',
        height: 'match_parent',
        backgroundColor: '#090d16',
        borderRadius: 20,
        borderColor: '#1e293b',
        borderWidth: 1,
        padding: 12,
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      {/* 1. Top Header: Logo Pill + Label + Quick Add Button */}
      <FlexWidget
        style={{
          width: 'match_parent',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
        }}
      >
        <FlexWidget
          style={{
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <FlexWidget
            style={{
              backgroundColor: '#0284c7',
              borderRadius: 6,
              paddingHorizontal: 6,
              paddingVertical: 2,
              marginRight: 6,
            }}
          >
            <TextWidget
              text="MONEYSTAC"
              style={{
                color: '#ffffff',
                fontSize: 9,
                fontWeight: 'bold',
                letterSpacing: 0.5,
              }}
            />
          </FlexWidget>

          <TextWidget
            text="DAILY OUTFLOW COMPARISON"
            style={{
              color: '#94a3b8',
              fontSize: 10,
              fontWeight: 'bold',
              letterSpacing: 0.5,
            }}
          />
        </FlexWidget>

        {/* Quick Add Button */}
        <FlexWidget
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'moneystac://quick-add' }}
          style={{
            backgroundColor: '#00a2ed',
            borderRadius: 12,
            paddingHorizontal: 8,
            paddingVertical: 3,
          }}
        >
          <TextWidget
            text="+ Add"
            style={{
              color: '#ffffff',
              fontSize: 10,
              fontWeight: 'bold',
            }}
          />
        </FlexWidget>
      </FlexWidget>

      {/* 2. Month Comparison & Trend Badge Row */}
      <FlexWidget
        style={{
          width: 'match_parent',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 4,
        }}
      >
        <FlexWidget
          style={{
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <TextWidget
            text={`${currentMonthName} vs ${prevMonthName}`}
            style={{
              color: '#ffffff',
              fontSize: 15,
              fontWeight: 'bold',
              marginRight: 8,
            }}
          />

          {/* Trend Pill */}
          {isOutflowLower ? (
            <FlexWidget
              style={{
                backgroundColor: '#064e3b',
                borderColor: '#059669',
                borderWidth: 1,
                borderRadius: 8,
                paddingHorizontal: 6,
                paddingVertical: 2,
              }}
            >
              <TextWidget
                text={absDiff === 0 ? `0% VS ${prevMonthName}` : `▼ -${absDiff}% VS ${prevMonthName}`}
                style={{
                  color: '#6ee7b7',
                  fontSize: 9,
                  fontWeight: 'bold',
                }}
              />
            </FlexWidget>
          ) : (
            <FlexWidget
              style={{
                backgroundColor: '#4c0519',
                borderColor: '#e11d48',
                borderWidth: 1,
                borderRadius: 8,
                paddingHorizontal: 6,
                paddingVertical: 2,
              }}
            >
              <TextWidget
                text={`▲ +${absDiff}% VS ${prevMonthName}`}
                style={{
                  color: '#fda4af',
                  fontSize: 9,
                  fontWeight: 'bold',
                }}
              />
            </FlexWidget>
          )}
        </FlexWidget>

        {/* Analytics deep link cue */}
        <TextWidget
          text="Analytics ↗"
          style={{
            color: '#38bdf8',
            fontSize: 10,
            fontWeight: 'bold',
          }}
        />
      </FlexWidget>

      {/* 3. Legend Box */}
      <FlexWidget
        style={{
          width: 'match_parent',
          backgroundColor: '#0f172a',
          borderColor: '#1e293b',
          borderWidth: 1,
          borderRadius: 8,
          paddingHorizontal: 10,
          paddingVertical: 4,
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 4,
          marginBottom: 4,
        }}
      >
        {/* Previous Month */}
        <FlexWidget
          style={{
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <FlexWidget
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: '#c084fc',
              marginRight: 5,
            }}
          />
          <TextWidget
            text={`${prevMonthName}: ₹${prevTotal.toLocaleString('en-IN')}`}
            style={{
              color: '#c084fc',
              fontSize: 10,
              fontWeight: 'bold',
            }}
          />
        </FlexWidget>

        {/* Current Month */}
        <FlexWidget
          style={{
            flexDirection: 'row',
            alignItems: 'center',
          }}
        >
          <FlexWidget
            style={{
              width: 8,
              height: 8,
              borderRadius: 4,
              backgroundColor: '#00a2ed',
              marginRight: 5,
            }}
          />
          <TextWidget
            text={`${currentMonthName}: ₹${currTotal.toLocaleString('en-IN')}`}
            style={{
              color: '#38bdf8',
              fontSize: 10,
              fontWeight: 'bold',
            }}
          />
        </FlexWidget>
      </FlexWidget>

      {/* 4. Comparison Bar Chart: Overlapped Bars (Purple behind, Sky Blue in front) */}
      <OverlapWidget
        style={{
          width: 'match_parent',
          height: 64,
          overflow: 'hidden',
        }}
      >
        {/* Background Grid Line (Center Threshold) */}
        <FlexWidget
          style={{
            width: 'match_parent',
            height: 'match_parent',
            justifyContent: 'center',
          }}
        >
          <FlexWidget
            style={{
              width: 'match_parent',
              height: 1,
              backgroundColor: '#1e293b',
            }}
          />
        </FlexWidget>

        {/* LAYER 1: Previous Month Bars (Purple / Lavender, wider width: 5) */}
        <FlexWidget
          style={{
            width: 'match_parent',
            height: 'match_parent',
            flexDirection: 'row',
            alignItems: 'flex-end',
          }}
        >
          {points.map((p) => {
            const h = getBarHeight(p.prevOutflow);
            return (
              <FlexWidget
                key={`prev-${p.day}`}
                style={{
                  flex: 1,
                  height: 'match_parent',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                }}
              >
                {h > 0 ? (
                  <FlexWidget
                    style={{
                      width: 5,
                      height: h,
                      backgroundColor: '#c084fc',
                      borderTopLeftRadius: 2,
                      borderTopRightRadius: 2,
                    }}
                  />
                ) : null}
              </FlexWidget>
            );
          })}
        </FlexWidget>

        {/* LAYER 2: Current Month Bars (Sky Blue, centered in front, width: 3) */}
        <FlexWidget
          style={{
            width: 'match_parent',
            height: 'match_parent',
            flexDirection: 'row',
            alignItems: 'flex-end',
          }}
        >
          {points.map((p) => {
            const h = getBarHeight(p.currentOutflow);
            const isToday = p.day === currentToday;

            return (
              <FlexWidget
                key={`curr-${p.day}`}
                style={{
                  flex: 1,
                  height: 'match_parent',
                  flexDirection: 'column',
                  alignItems: 'center',
                  justifyContent: 'flex-end',
                }}
              >
                {h > 0 ? (
                  <FlexWidget
                    style={{
                      width: 3,
                      height: h,
                      backgroundColor: isToday ? '#38bdf8' : '#00a2ed',
                      borderTopLeftRadius: 1.5,
                      borderTopRightRadius: 1.5,
                    }}
                  />
                ) : isToday ? (
                  /* Dot for today even if 0 spend so far */
                  <FlexWidget
                    style={{
                      width: 3,
                      height: 3,
                      borderRadius: 1.5,
                      backgroundColor: '#38bdf8',
                    }}
                  />
                ) : null}
              </FlexWidget>
            );
          })}
        </FlexWidget>
      </OverlapWidget>

      {/* 5. X-Axis Day Labels */}
      <FlexWidget
        style={{
          width: 'match_parent',
          flexDirection: 'row',
          justifyContent: 'space-between',
          alignItems: 'center',
          borderTopWidth: 1,
          borderTopColor: '#1e293b',
          paddingTop: 2,
          paddingHorizontal: 2,
        }}
      >
        <TextWidget text="Day 1" style={{ color: '#64748b', fontSize: 8, fontWeight: 'bold' }} />
        <TextWidget text="Day 5" style={{ color: '#64748b', fontSize: 8, fontWeight: 'bold' }} />
        <TextWidget text="Day 10" style={{ color: '#64748b', fontSize: 8, fontWeight: 'bold' }} />
        <TextWidget text="Day 15" style={{ color: '#64748b', fontSize: 8, fontWeight: 'bold' }} />
        <TextWidget text="Day 20" style={{ color: '#64748b', fontSize: 8, fontWeight: 'bold' }} />
        <TextWidget text="Day 25" style={{ color: '#64748b', fontSize: 8, fontWeight: 'bold' }} />
        <TextWidget text={`Day ${totalDays}`} style={{ color: '#64748b', fontSize: 8, fontWeight: 'bold' }} />
      </FlexWidget>

      {/* 6. Footer: Averages & Status */}
      <FlexWidget
        style={{
          width: 'match_parent',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 2,
        }}
      >
        <TextWidget
          text={`• ₹${dailyAverage.toLocaleString('en-IN')}/day avg • ${activeDays} active ${activeDays === 1 ? 'day' : 'days'}`}
          style={{
            color: '#94a3b8',
            fontSize: 9,
            fontWeight: 'normal',
          }}
        />

        <TextWidget
          text="Tap for details"
          style={{
            color: '#64748b',
            fontSize: 9,
            fontWeight: 'normal',
          }}
        />
      </FlexWidget>
    </FlexWidget>
  );
}
