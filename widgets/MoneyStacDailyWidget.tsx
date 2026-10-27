import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';

export interface MoneyStacDailyWidgetProps {
  todaySpent?: number;
  dailyBudget?: number;
  txCount?: number;
  pendingCount?: number;
  dateStr?: string;
}

export function MoneyStacDailyWidget({
  todaySpent = 0,
  dailyBudget = 350,
  txCount = 0,
  pendingCount = 0,
  dateStr = 'TODAY',
}: MoneyStacDailyWidgetProps) {
  const spent = Math.max(0, Math.round(todaySpent));
  const budget = Math.max(1, Math.round(dailyBudget));
  const remaining = Math.max(0, budget - spent);
  const isOverBudget = spent > budget;
  const overAmount = isOverBudget ? spent - budget : 0;
  const rawPercent = Math.round((spent / budget) * 100);
  const clampedPercent = Math.min(100, Math.max(0, rawPercent));

  // Progress Bar flex weights for Android RemoteViews LinearLayout
  const filledWeight = Math.max(2, clampedPercent);
  const emptyWeight = Math.max(0, 100 - filledWeight);
  const barColor = isOverBudget ? '#f43f5e' : '#00a2ed';

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{
        width: 'match_parent',
        height: 'match_parent',
        backgroundColor: '#090d16',
        borderRadius: 20,
        borderColor: '#1e293b',
        borderWidth: 1,
        padding: 14,
        flexDirection: 'column',
        justifyContent: 'space-between',
      }}
    >
      {/* 1. Header: Logo Pill + Date & Quick Add Button */}
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
          {/* Logo Badge */}
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

          {/* Date */}
          <TextWidget
            text={dateStr}
            style={{
              color: '#94a3b8',
              fontSize: 10,
              fontWeight: 'bold',
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
            paddingHorizontal: 9,
            paddingVertical: 4,
          }}
        >
          <TextWidget
            text="+ Quick Add"
            style={{
              color: '#ffffff',
              fontSize: 11,
              fontWeight: 'bold',
            }}
          />
        </FlexWidget>
      </FlexWidget>

      {/* 2. Numbers & Status Row */}
      <FlexWidget
        style={{
          width: 'match_parent',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 6,
        }}
      >
        {/* Spent and Daily Budget */}
        <FlexWidget
          style={{
            flexDirection: 'row',
            alignItems: 'flex-end',
          }}
        >
          <TextWidget
            text={`₹${spent.toLocaleString('en-IN')}`}
            style={{
              color: '#ffffff',
              fontSize: 22,
              fontWeight: 'bold',
            }}
          />
          <TextWidget
            text={` / ₹${budget.toLocaleString('en-IN')}`}
            style={{
              color: '#64748b',
              fontSize: 12,
              marginLeft: 4,
              marginBottom: 2,
              fontWeight: 'bold',
            }}
          />
        </FlexWidget>

        {/* Status Pill */}
        {isOverBudget ? (
          <FlexWidget
            style={{
              backgroundColor: '#4c0519',
              borderColor: '#e11d48',
              borderWidth: 1,
              borderRadius: 10,
              paddingHorizontal: 8,
              paddingVertical: 3,
            }}
          >
            <TextWidget
              text={`₹${overAmount.toLocaleString('en-IN')} over`}
              style={{
                color: '#fda4af',
                fontSize: 10,
                fontWeight: 'bold',
              }}
            />
          </FlexWidget>
        ) : (
          <FlexWidget
            style={{
              backgroundColor: '#064e3b',
              borderColor: '#059669',
              borderWidth: 1,
              borderRadius: 10,
              paddingHorizontal: 8,
              paddingVertical: 3,
            }}
          >
            <TextWidget
              text={`₹${remaining.toLocaleString('en-IN')} left`}
              style={{
                color: '#6ee7b7',
                fontSize: 10,
                fontWeight: 'bold',
              }}
            />
          </FlexWidget>
        )}
      </FlexWidget>

      {/* 3. Progress Bar Track */}
      <FlexWidget
        style={{
          width: 'match_parent',
          height: 10,
          backgroundColor: '#1e293b',
          borderColor: '#334155',
          borderWidth: 1,
          borderRadius: 5,
          flexDirection: 'row',
          overflow: 'hidden',
          marginTop: 8,
          marginBottom: 4,
        }}
      >
        {clampedPercent === 0 ? (
          <FlexWidget style={{ flex: 100, height: 'match_parent' }} />
        ) : clampedPercent >= 100 ? (
          <FlexWidget
            style={{
              flex: 100,
              height: 'match_parent',
              backgroundColor: barColor,
              borderRadius: 5,
            }}
          />
        ) : (
          <>
            <FlexWidget
              style={{
                flex: filledWeight,
                height: 'match_parent',
                backgroundColor: barColor,
                borderRadius: 5,
              }}
            />
            {emptyWeight > 0 && (
              <FlexWidget
                style={{
                  flex: emptyWeight,
                  height: 'match_parent',
                }}
              />
            )}
          </>
        )}
      </FlexWidget>

      {/* 4. Footer: Transactions Count & Status */}
      <FlexWidget
        style={{
          width: 'match_parent',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          marginTop: 4,
        }}
      >
        <TextWidget
          text={`${txCount} ${txCount === 1 ? 'expense' : 'expenses'} today`}
          style={{
            color: '#94a3b8',
            fontSize: 10,
            fontWeight: 'normal',
          }}
        />

        {pendingCount > 0 ? (
          <TextWidget
            text={`📌 ${pendingCount} pending`}
            style={{
              color: '#fbbf24',
              fontSize: 10,
              fontWeight: 'bold',
            }}
          />
        ) : (
          <TextWidget
            text={`${rawPercent}% used`}
            style={{
              color: isOverBudget ? '#f87171' : '#38bdf8',
              fontSize: 10,
              fontWeight: 'bold',
            }}
          />
        )}
      </FlexWidget>
    </FlexWidget>
  );
}
