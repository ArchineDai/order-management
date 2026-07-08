import React from "react";
import { Tabs } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { ClipboardList, Home, ListTree, ShoppingCart, User, Warehouse } from "lucide-react-native";
import { OrderWorkspaceProvider } from "../src/features/orders/workspace";
import { colors } from "../src/features/orders/components";

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <OrderWorkspaceProvider>
        <Tabs
          screenOptions={{
            headerShown: false,
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
              title: "首页",
              tabBarIcon: ({ color, size }) => <Home color={color} size={size} />
            }}
          />
          <Tabs.Screen
            name="orders"
            options={{
              title: "订单管理",
              tabBarIcon: ({ color, size }) => <ClipboardList color={color} size={size} />
            }}
          />
          <Tabs.Screen
            name="purchases"
            options={{
              title: "采购管理",
              tabBarIcon: ({ color, size }) => <ShoppingCart color={color} size={size} />
            }}
          />
          <Tabs.Screen
            name="inventory"
            options={{
              title: "库存管理",
              tabBarIcon: ({ color, size }) => <Warehouse color={color} size={size} />
            }}
          />
          <Tabs.Screen
            name="bom"
            options={{
              title: "BOM清单",
              tabBarIcon: ({ color, size }) => <ListTree color={color} size={size} />
            }}
          />
          <Tabs.Screen
            name="me"
            options={{
              title: "我的",
              tabBarIcon: ({ color, size }) => <User color={color} size={size} />
            }}
          />
        </Tabs>
      </OrderWorkspaceProvider>
    </SafeAreaProvider>
  );
}
