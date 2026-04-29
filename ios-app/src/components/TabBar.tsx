import React from "react";
import { StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { colors, radii, typography } from "../theme";

interface Tab {
  key: string;
  label: string;
}

const TABS: Tab[] = [
  { key: "dashboard", label: "Dashboard" },
  { key: "trends", label: "Trends" },
  { key: "sleep", label: "Sleep" },
  { key: "profile", label: "Profile" },
];

interface Props {
  active?: string;
  onChange?: (key: string) => void;
}

export default function TabBar({ active = "dashboard", onChange }: Props) {
  return (
    <View style={styles.wrap}>
      <View style={styles.bar}>
        {TABS.map((tab) => {
          const isActive = tab.key === active;
          return (
            <TouchableOpacity
              key={tab.key}
              style={styles.tab}
              activeOpacity={0.8}
              onPress={() => onChange?.(tab.key)}
            >
              <View
                style={[
                  styles.iconBox,
                  isActive && { backgroundColor: colors.lime },
                ]}
              >
                <View
                  style={[
                    styles.iconDot,
                    {
                      backgroundColor: isActive
                        ? colors.limeText
                        : colors.textSecondary,
                    },
                  ]}
                />
              </View>
              <Text
                style={[
                  styles.label,
                  { color: isActive ? colors.textPrimary : colors.textSecondary },
                ]}
              >
                {tab.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    paddingHorizontal: 16,
    paddingBottom: 24,
    paddingTop: 8,
    backgroundColor: colors.bg,
  },
  bar: {
    flexDirection: "row",
    backgroundColor: colors.card,
    borderRadius: radii.xl,
    paddingVertical: 10,
  },
  tab: {
    flex: 1,
    alignItems: "center",
    gap: 4,
  },
  iconBox: {
    width: 32,
    height: 32,
    borderRadius: 10,
    backgroundColor: colors.cardRaised,
    alignItems: "center",
    justifyContent: "center",
  },
  iconDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  label: {
    ...typography.caption,
    fontWeight: "700",
    fontSize: 11,
  },
});
