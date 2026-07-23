import React, { useCallback, useEffect, useState } from "react";
import { Tabs } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { View } from "react-native";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ClipboardList, Home, ListTree, ShoppingCart, User, Warehouse } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { OrderWorkspaceProvider, useOrderWorkspace } from "../src/features/orders/workspace";
import { colors } from "../src/features/orders/components";
import "../src/i18n";

void SplashScreen.preventAutoHideAsync();
SplashScreen.setOptions({ duration: 150, fade: true });

function AppTabs() {
  const { t } = useTranslation();
  const { isReady } = useOrderWorkspace();
  const [tabsLaidOut, setTabsLaidOut] = useState(false);

  useEffect(() => {
    if (!isReady || !tabsLaidOut) return;
    let secondFrame: ReturnType<typeof requestAnimationFrame> | undefined;
    const firstFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(() => void SplashScreen.hideAsync());
    });
    return () => {
      cancelAnimationFrame(firstFrame);
      if (secondFrame) cancelAnimationFrame(secondFrame);
    };
  }, [isReady, tabsLaidOut]);

  const markTabsLaidOut = useCallback(() => setTabsLaidOut(true), []);

  return (
    <View style={{ flex: 1, backgroundColor: colors.bg }}>
      {isReady ? (
        <View style={{ flex: 1 }} onLayout={markTabsLaidOut}>
          <Tabs
            detachInactiveScreens={false}
            screenOptions={{
              headerShown: false,
              lazy: false,
              sceneStyle: { backgroundColor: colors.bg },
              tabBarActiveTintColor: colors.accent,
              tabBarInactiveTintColor: "#52635f",
              tabBarHideOnKeyboard: true,
              tabBarStyle: {
                backgroundColor: "#ffffff",
                borderTopColor: "#dfe5dd",
                height: 70,
                paddingTop: 7,
                paddingBottom: 9
              },
              tabBarLabelStyle: {
                fontSize: 11,
                fontWeight: "800"
              }
            }}
          >
            <Tabs.Screen
              name="index"
              options={{
                title: t("tabs.home"),
                tabBarIcon: ({ color, size }) => <Home color={color} size={size} />
              }}
            />
            <Tabs.Screen
              name="orders"
              options={{
                title: t("tabs.orders"),
                tabBarIcon: ({ color, size }) => <ClipboardList color={color} size={size} />
              }}
            />
            <Tabs.Screen
              name="purchases"
              options={{
                title: t("tabs.purchases"),
                tabBarIcon: ({ color, size }) => <ShoppingCart color={color} size={size} />
              }}
            />
            <Tabs.Screen
              name="inventory"
              options={{
                title: t("tabs.inventory"),
                tabBarIcon: ({ color, size }) => <Warehouse color={color} size={size} />
              }}
            />
            <Tabs.Screen
              name="bom"
              options={{
                title: t("tabs.bom"),
                tabBarIcon: ({ color, size }) => <ListTree color={color} size={size} />
              }}
            />
            <Tabs.Screen
              name="me"
              options={{
                title: t("tabs.me"),
                tabBarIcon: ({ color, size }) => <User color={color} size={size} />
              }}
            />
          </Tabs>
        </View>
      ) : null}
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <OrderWorkspaceProvider>
        <AppTabs />
      </OrderWorkspaceProvider>
    </SafeAreaProvider>
  );
}
