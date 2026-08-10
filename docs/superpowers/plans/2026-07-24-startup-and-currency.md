# Startup and Currency Display Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove the first-visit Tab flash, show a white logo launch screen until the app is ready, and display ¥ or $ from the resolved system language without changing stored amounts.

**Architecture:** `OrderWorkspaceProvider` owns initial repository readiness because it already loads order and BOM data. The Expo Router root holds the native splash until that provider reports ready, then renders all fixed tabs eagerly. A pure i18n formatter centralizes the existing two-decimal money formatting and language-specific symbol.

**Tech Stack:** Expo Router, React Navigation bottom tabs, expo-splash-screen, React Native, i18next, Vitest, TypeScript.

## Global Constraints

- Keep stored money values unchanged; no exchange-rate conversion.
- Use `¥` for `zh-Hans` and `$` for `en`.
- Use the existing `assets/splash-icon.png` asset with a white splash background.
- Keep all six fixed tab routes mounted after startup; do not unmount on blur.
- Preserve the existing tab titles, icons, layout, and routes.
- Initial order or BOM repository failures must still release the splash screen.
- Do not change business data, CSV behavior, or navigation routes.

---

### Task 1: Centralize Language-Aware Currency Formatting

**Files:**
- Modify: `src/i18n/core.ts`
- Modify: `src/i18n/index.ts`
- Modify: `src/i18n/i18n.test.ts`
- Modify: `src/i18n/resources.ts`
- Modify: `src/features/orders/components.tsx`
- Modify: `src/features/orders/screens.tsx`

**Interfaces:**
- Consumes: `SupportedLanguage` from `src/i18n/resources.ts`.
- Produces: `formatCurrencyWithLanguage(value: number, language: SupportedLanguage): string` for tests and `formatCurrency(value: number): string` for React Native UI.

- [ ] **Step 1: Write the failing currency tests**

```ts
it("formats the same amount with the language-specific currency symbol", () => {
  expect(formatCurrencyWithLanguage(1234.5, "zh-Hans")).toBe("¥1234.50");
  expect(formatCurrencyWithLanguage(1234.5, "en")).toBe("$1234.50");
});

it("does not convert the stored amount", () => {
  expect(formatCurrencyWithLanguage(1, "en")).toBe("$1.00");
});
```

- [ ] **Step 2: Run the focused test to verify failure**

Run: `pnpm test src/i18n/i18n.test.ts`

Expected: FAIL because `formatCurrencyWithLanguage` is not exported.

- [ ] **Step 3: Add the pure and runtime currency formatters**

```ts
export function formatCurrencyWithLanguage(value: number, language: SupportedLanguage): string {
  const symbol = language === "zh-Hans" ? "¥" : "$";
  return `${symbol}${value.toFixed(2)}`;
}

export function formatCurrency(value: number): string {
  const language = initI18n().language === "zh-Hans" ? "zh-Hans" : "en";
  return formatCurrencyWithLanguage(value, language);
}
```

Replace every `¥{formatMoney(value)}` occurrence in `components.tsx` and `screens.tsx` with `{formatCurrency(value)}`. Update translated purchase/profit record templates so they interpolate a preformatted amount rather than embedding a currency symbol.

- [ ] **Step 4: Run the focused test to verify success**

Run: `pnpm test src/i18n/i18n.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the currency formatter**

```bash
git add src/i18n/core.ts src/i18n/index.ts src/i18n/i18n.test.ts src/i18n/resources.ts src/features/orders/components.tsx src/features/orders/screens.tsx
git commit -m "feat: 按语言显示货币符号"
```

### Task 2: Add an Initial Workspace Readiness Boundary

**Files:**
- Create: `src/features/orders/initialLoad.ts`
- Create: `src/features/orders/initialLoad.test.ts`
- Modify: `src/features/orders/workspace.tsx`

**Interfaces:**
- Consumes: `OrderRepository` and `BomRepository` from `src/services/orderRepository.ts`.
- Produces: `loadInitialWorkspace(orderRepository, bomRepository): Promise<InitialWorkspaceLoadResult>` with `orders`, `bomItems`, `orderError`, and `bomError`, where `InitialWorkspaceLoadResult` is declared in `initialLoad.ts`.
- Produces: `isReady: boolean` on `WorkspaceContextValue`.

- [ ] **Step 1: Write failing initial-load tests**

```ts
it("returns both collections when both repositories load", async () => {
  const result = await loadInitialWorkspace(orderRepository, bomRepository);
  expect(result).toEqual({ orders, bomItems, orderError: null, bomError: null });
});

it("returns empty orders after a failed order load", async () => {
  const result = await loadInitialWorkspace(failingOrderRepository, bomRepository);
  expect(result.orders).toEqual([]);
  expect(result.orderError).toBeInstanceOf(Error);
  expect(result.bomItems).toEqual(bomItems);
});
```

- [ ] **Step 2: Run the focused test to verify failure**

Run: `pnpm test src/features/orders/initialLoad.test.ts`

Expected: FAIL because `initialLoad.ts` does not exist.

- [ ] **Step 3: Implement settled initial loading and expose readiness**

```ts
export type InitialWorkspaceLoadResult = {
  orders: Order[];
  bomItems: BomItem[];
  orderError: unknown | null;
  bomError: unknown | null;
};

export async function loadInitialWorkspace(orderRepository: OrderRepository, bomRepository: BomRepository): Promise<InitialWorkspaceLoadResult> {
  const [ordersResult, bomResult] = await Promise.allSettled([orderRepository.load(), bomRepository.load()]);
  return {
    orders: ordersResult.status === "fulfilled" ? ordersResult.value : [],
    bomItems: bomResult.status === "fulfilled" ? bomResult.value : [],
    orderError: ordersResult.status === "rejected" ? ordersResult.reason : null,
    bomError: bomResult.status === "rejected" ? bomResult.reason : null
  };
}
```

In `OrderWorkspaceProvider`, call this function once on mount, put successful values into state, show the existing localized alerts for non-null errors, and call `setIsReady(true)` after handling both results. Include `isReady` in the context value.

- [ ] **Step 4: Run the focused test to verify success**

Run: `pnpm test src/features/orders/initialLoad.test.ts`

Expected: PASS.

- [ ] **Step 5: Commit the readiness boundary**

```bash
git add src/features/orders/initialLoad.ts src/features/orders/initialLoad.test.ts src/features/orders/workspace.tsx
git commit -m "feat: 等待初始台账数据后进入应用"
```

### Task 3: Gate the White Logo Splash and Eagerly Mount Tabs

**Files:**
- Create: `src/features/orders/startup.test.ts`
- Modify: `app/_layout.tsx`
- Modify: `app.json`
- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Interfaces:**
- Consumes: `isReady` from `useOrderWorkspace()`.
- Produces: a root layout that keeps the native splash visible until `isReady`, then renders `Tabs` with `lazy: false`.

- [ ] **Step 1: Write the failing configuration assertion**

```ts
expect(appConfig.expo.splash).toMatchObject({
  image: "./assets/splash-icon.png",
  resizeMode: "contain",
  backgroundColor: "#ffffff"
});
expect(rootLayout).toContain("SplashScreen.preventAutoHideAsync()");
expect(rootLayout).toContain("lazy: false");
expect(rootLayout).toContain("onLayout={hideSplashScreen}");
```

- [ ] **Step 2: Run the focused test to verify failure**

Run: `pnpm test src/features/orders/startup.test.ts`

Expected: FAIL because the splash background is currently `#034d4d`, tabs are lazy by default, and no root-layout callback delays the splash hide until its first frame.

- [ ] **Step 3: Implement the native splash and tab preload**

```ts
SplashScreen.preventAutoHideAsync();

function AppContent() {
  const { isReady } = useOrderWorkspace();
  const hideSplashScreen = useCallback(() => {
    if (isReady) SplashScreen.hide();
  }, [isReady]);
  if (!isReady) return null;
  return (
    <View style={{ flex: 1 }} onLayout={hideSplashScreen}>
      <Tabs screenOptions={{ lazy: false, headerShown: false }}>
        {/** Preserve the existing six Tabs.Screen options, including every Lucide icon. */}
      </Tabs>
    </View>
  );
}
```

Run `pnpm exec expo install expo-splash-screen`. Keep `OrderWorkspaceProvider` outside `AppContent` so it can load before the tabs mount. Set `expo.splash.backgroundColor` to `#ffffff`. Do not add arbitrary timeouts or loading overlays.

- [ ] **Step 4: Run focused checks to verify success**

Run: `pnpm test src/features/orders/startup.test.ts && pnpm typecheck`

Expected: PASS.

- [ ] **Step 5: Commit the startup behavior**

```bash
git add app/_layout.tsx app.json package.json pnpm-lock.yaml src/features/orders/startup.test.ts
git commit -m "fix: 消除首次切换标签页闪烁"
```

### Task 4: Full Verification and Android Delivery

**Files:**
- No source changes expected.

**Interfaces:**
- Consumes: all changes from Tasks 1-3.
- Produces: a verified Android release APK installed on the connected device.

- [ ] **Step 1: Run static and unit verification**

Run: `pnpm typecheck && pnpm test`

Expected: both commands exit successfully.

- [ ] **Step 2: Regenerate Android native resources**

Run: `CI=1 pnpm exec expo prebuild --platform android --no-install`

Expected: Expo applies the white splash configuration without an error.

- [ ] **Step 3: Build the release APK**

Run: `ANDROID_HOME=/Users/archie/Library/Android/sdk ANDROID_SDK_ROOT=/Users/archie/Library/Android/sdk ./gradlew assembleRelease`

Expected: `BUILD SUCCESSFUL` and `android/app/build/outputs/apk/release/app-release.apk` exists.

- [ ] **Step 4: Install and smoke test on the connected Android device**

Run: `adb -s 3e3f1ccf install -r android/app/build/outputs/apk/release/app-release.apk`

Expected: `Success`. Launch the app, visit every tab once, and verify there is no first-visit white flash, the native startup screen is white with the logo, and English-system devices show `$`.

- [ ] **Step 5: Confirm no generated Android files are staged**

Run: `git status -sb`

Expected: only the tracked source, configuration, test, and documentation files from Tasks 1-3 are modified or staged. `android/` and the APK output remain untracked or ignored.

## Plan Self-Review

- Spec coverage: Task 1 covers language-specific symbols without conversion; Task 2 ensures data readiness cannot block startup; Task 3 covers the white logo splash and eager tab mounting; Task 4 covers release-build and device verification.
- Placeholder scan passed; every implementation and verification step has a concrete command or code sample.
- Type consistency: `loadInitialWorkspace` consumes existing repository interfaces; `isReady` is added to the existing context; currency values are formatted through a `number` input in both pure and runtime functions.
