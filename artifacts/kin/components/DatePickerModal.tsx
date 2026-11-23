import React, { useMemo } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { Feather } from "@expo/vector-icons";
import { getCurrentLanguage, useTranslation } from "@workspace/i18n";
import { useColors } from "@/hooks/useColors";

export interface DatePickerModalProps {
  visible: boolean;
  activeTab: "day" | "month" | "year";
  onTabChange: (tab: "day" | "month" | "year") => void;
  onClose: () => void;
  selectedDay: string;
  selectedMonth: string;
  selectedYear: string;
  onSelectDate: (day: string, month: string, year: string) => void;
}

const MONTHS = [
  { value: "01", en: "Jan", enFull: "January", rw: "Mut", rwFull: "Mutarama" },
  { value: "02", en: "Feb", enFull: "February", rw: "Gas", rwFull: "Gashyantare" },
  { value: "03", en: "Mar", enFull: "March", rw: "Wer", rwFull: "Werurwe" },
  { value: "04", en: "Apr", enFull: "April", rw: "Mat", rwFull: "Mata" },
  { value: "05", en: "May", enFull: "May", rw: "Gic", rwFull: "Gicurasi" },
  { value: "06", en: "Jun", enFull: "June", rw: "Kam", rwFull: "Kamena" },
  { value: "07", en: "Jul", enFull: "July", rw: "Nya", rwFull: "Nyakanga" },
  { value: "08", en: "Aug", enFull: "August", rw: "Kan", rwFull: "Kanama" },
  { value: "09", en: "Sep", enFull: "September", rw: "Nze", rwFull: "Nzeli" },
  { value: "10", en: "Oct", enFull: "October", rw: "Ukw", rwFull: "Ukwakira" },
  { value: "11", en: "Nov", enFull: "November", rw: "Ugu", rwFull: "Ugushyingo" },
  { value: "12", en: "Dec", enFull: "December", rw: "Uku", rwFull: "Ukuboza" },
];

export function getMonthDisplay(monthValue: string): string {
  const isRw = getCurrentLanguage() === "rw";
  const item = MONTHS.find((m) => m.value === monthValue);
  if (!item) return monthValue;
  return isRw ? item.rw : item.en;
}

export function DatePickerModal({
  visible,
  activeTab,
  onTabChange,
  onClose,
  selectedDay,
  selectedMonth,
  selectedYear,
  onSelectDate,
}: DatePickerModalProps) {
  const colors = useColors();
  const { t } = useTranslation();
  const isRw = getCurrentLanguage() === "rw";

  const maxYear = new Date().getFullYear() - 18;
  const minYear = 1940;

  const years = useMemo(() => {
    const list: string[] = [];
    for (let y = maxYear; y >= minYear; y--) {
      list.push(String(y));
    }
    return list;
  }, [maxYear]);

  const maxDays = useMemo(() => {
    if (!selectedMonth) return 31;
    const y = selectedYear ? parseInt(selectedYear, 10) : 2000;
    const m = parseInt(selectedMonth, 10);
    return new Date(y, m, 0).getDate();
  }, [selectedYear, selectedMonth]);

  const days = useMemo(() => {
    const list: string[] = [];
    for (let d = 1; d <= maxDays; d++) {
      list.push(d < 10 ? `0${d}` : String(d));
    }
    return list;
  }, [maxDays]);

  function handlePickDay(dayVal: string) {
    onSelectDate(dayVal, selectedMonth, selectedYear);
    if (!selectedMonth) {
      onTabChange("month");
    } else if (!selectedYear) {
      onTabChange("year");
    } else {
      onClose();
    }
  }

  function handlePickMonth(monthVal: string) {
    let nextDay = selectedDay;
    if (selectedDay) {
      const y = selectedYear ? parseInt(selectedYear, 10) : 2000;
      const m = parseInt(monthVal, 10);
      const daysInNewMonth = new Date(y, m, 0).getDate();
      if (parseInt(selectedDay, 10) > daysInNewMonth) {
        nextDay = String(daysInNewMonth);
      }
    }
    onSelectDate(nextDay, monthVal, selectedYear);
    if (!selectedYear) {
      onTabChange("year");
    } else if (!nextDay) {
      onTabChange("day");
    } else {
      onClose();
    }
  }

  function handlePickYear(yearVal: string) {
    let nextDay = selectedDay;
    if (selectedDay && selectedMonth) {
      const y = parseInt(yearVal, 10);
      const m = parseInt(selectedMonth, 10);
      const daysInNewMonth = new Date(y, m, 0).getDate();
      if (parseInt(selectedDay, 10) > daysInNewMonth) {
        nextDay = String(daysInNewMonth);
      }
    }
    onSelectDate(nextDay, selectedMonth, yearVal);
    if (!selectedMonth) {
      onTabChange("month");
    } else if (!nextDay) {
      onTabChange("day");
    } else {
      onClose();
    }
  }

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
    >
      <Pressable style={styles.backdrop} onPress={onClose}>
        <Pressable
          style={[
            styles.sheet,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
          onPress={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <View style={[styles.header, { borderBottomColor: colors.border }]}>
            {/* Tabs */}
            <View style={styles.tabsRow}>
              <TouchableOpacity
                onPress={() => onTabChange("day")}
                style={[
                  styles.tabBtn,
                  activeTab === "day" && {
                    borderBottomColor: colors.primary,
                    borderBottomWidth: 2,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.tabLabel,
                    {
                      color:
                        activeTab === "day"
                          ? colors.primary
                          : colors.mutedForeground,
                    },
                  ]}
                >
                  {selectedDay
                    ? `${t("onboarding.personal.dayLabel")}: ${selectedDay}`
                    : t("onboarding.personal.dayLabel")}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => onTabChange("month")}
                style={[
                  styles.tabBtn,
                  activeTab === "month" && {
                    borderBottomColor: colors.primary,
                    borderBottomWidth: 2,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.tabLabel,
                    {
                      color:
                        activeTab === "month"
                          ? colors.primary
                          : colors.mutedForeground,
                    },
                  ]}
                >
                  {selectedMonth
                    ? `${t("onboarding.personal.monthLabel")}: ${getMonthDisplay(selectedMonth)}`
                    : t("onboarding.personal.monthLabel")}
                </Text>
              </TouchableOpacity>

              <TouchableOpacity
                onPress={() => onTabChange("year")}
                style={[
                  styles.tabBtn,
                  activeTab === "year" && {
                    borderBottomColor: colors.primary,
                    borderBottomWidth: 2,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.tabLabel,
                    {
                      color:
                        activeTab === "year"
                          ? colors.primary
                          : colors.mutedForeground,
                    },
                  ]}
                >
                  {selectedYear
                    ? `${t("onboarding.personal.yearLabel")}: ${selectedYear}`
                    : t("onboarding.personal.yearLabel")}
                </Text>
              </TouchableOpacity>
            </View>

            <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
              <Feather name="x" size={20} color={colors.foreground} />
            </TouchableOpacity>
          </View>

          {/* Body Content */}
          <View style={styles.body}>
            {/* Days Grid */}
            {activeTab === "day" && (
              <ScrollView
                contentContainerStyle={styles.daysGrid}
                showsVerticalScrollIndicator={false}
              >
                {days.map((d) => {
                  const isSelected = selectedDay === d;
                  return (
                    <TouchableOpacity
                      key={d}
                      style={[
                        styles.dayCircle,
                        {
                          backgroundColor: isSelected
                            ? colors.primary
                            : colors.secondary,
                          borderColor: isSelected
                            ? colors.primary
                            : colors.border,
                        },
                      ]}
                      onPress={() => handlePickDay(d)}
                      activeOpacity={0.75}
                    >
                      <Text
                        style={[
                          styles.dayText,
                          {
                            color: isSelected
                              ? colors.primaryForeground
                              : colors.foreground,
                          },
                        ]}
                      >
                        {parseInt(d, 10)}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {/* Months Grid */}
            {activeTab === "month" && (
              <ScrollView
                contentContainerStyle={styles.monthsGrid}
                showsVerticalScrollIndicator={false}
              >
                {MONTHS.map((m) => {
                  const isSelected = selectedMonth === m.value;
                  const label = isRw ? m.rwFull : m.enFull;
                  const shortName = isRw ? m.rw : m.en;
                  return (
                    <TouchableOpacity
                      key={m.value}
                      style={[
                        styles.monthCard,
                        {
                          backgroundColor: isSelected
                            ? colors.primary
                            : colors.secondary,
                          borderColor: isSelected
                            ? colors.primary
                            : colors.border,
                        },
                      ]}
                      onPress={() => handlePickMonth(m.value)}
                      activeOpacity={0.75}
                    >
                      <Text
                        style={[
                          styles.monthNumber,
                          {
                            color: isSelected
                              ? colors.primaryForeground
                              : colors.mutedForeground,
                          },
                        ]}
                      >
                        {m.value}
                      </Text>
                      <Text
                        style={[
                          styles.monthText,
                          {
                            color: isSelected
                              ? colors.primaryForeground
                              : colors.foreground,
                          },
                        ]}
                        numberOfLines={1}
                      >
                        {label || shortName}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {/* Years Grid */}
            {activeTab === "year" && (
              <ScrollView
                contentContainerStyle={styles.yearsGrid}
                showsVerticalScrollIndicator={false}
              >
                {years.map((y) => {
                  const isSelected = selectedYear === y;
                  return (
                    <TouchableOpacity
                      key={y}
                      style={[
                        styles.yearCard,
                        {
                          backgroundColor: isSelected
                            ? colors.primary
                            : colors.secondary,
                          borderColor: isSelected
                            ? colors.primary
                            : colors.border,
                        },
                      ]}
                      onPress={() => handlePickYear(y)}
                      activeOpacity={0.75}
                    >
                      <Text
                        style={[
                          styles.yearText,
                          {
                            color: isSelected
                              ? colors.primaryForeground
                              : colors.foreground,
                          },
                        ]}
                      >
                        {y}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
          </View>
        </Pressable>
      </Pressable>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: "rgba(0, 0, 0, 0.65)",
    justifyContent: "flex-end",
    alignItems: "center",
  },
  sheet: {
    width: "100%",
    maxWidth: 480,
    maxHeight: "75%",
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    borderWidth: 1,
    borderBottomWidth: 0,
    overflow: "hidden",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    paddingHorizontal: 16,
    paddingTop: 8,
  },
  tabsRow: {
    flexDirection: "row",
    flex: 1,
    gap: 8,
  },
  tabBtn: {
    paddingVertical: 14,
    paddingHorizontal: 10,
  },
  tabLabel: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 14,
  },
  closeBtn: {
    padding: 8,
  },
  body: {
    padding: 16,
    minHeight: 280,
    maxHeight: 360,
  },
  daysGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "center",
    paddingVertical: 8,
  },
  dayCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    justifyContent: "center",
    alignItems: "center",
  },
  dayText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
  monthsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  monthCard: {
    width: "31%",
    paddingVertical: 14,
    paddingHorizontal: 8,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center",
    gap: 4,
  },
  monthNumber: {
    fontFamily: "Inter_500Medium",
    fontSize: 11,
  },
  monthText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 13,
  },
  yearsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 10,
    justifyContent: "space-between",
    paddingVertical: 8,
  },
  yearCard: {
    width: "31%",
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1.5,
    alignItems: "center",
  },
  yearText: {
    fontFamily: "Inter_600SemiBold",
    fontSize: 15,
  },
});
