# Startup and Currency Display Design

## Goal

Remove the one-time visual flash that occurs when each bottom tab is opened for the first time. Show a white native launch screen with the existing logo, and display currency symbols according to the device language without converting stored amounts.

## Scope

- Keep the native splash screen visible until i18n and local workspace data are ready.
- Configure the splash to use a white background and the existing splash logo.
- Eagerly mount the six fixed tab screens before the user can switch tabs.
- Preserve tab state after first render; do not unmount tabs on blur.
- Centralize currency presentation so Simplified Chinese uses `¥` and English uses `$`.
- Keep every stored money value unchanged. No exchange-rate conversion is performed.

## Design

The workspace provider will expose a readiness state after its order and BOM repositories have settled. The root layout will call `SplashScreen.preventAutoHideAsync()` in module scope and render no navigation content until that readiness state is true. Once the initial tab layout has rendered, it will hide the splash screen. This avoids a blank frame between native startup and the React Native application.

The tab navigator will set `lazy: false`. The app has six small, fixed, local-data screens; paying the small startup cost removes the first-visit mount and layout work that currently causes every tab to flash once. Inactive tabs remain mounted so local filters and screen state are preserved.

`src/i18n/` will provide a currency formatter that chooses the symbol from the active resolved language. Components will use it instead of embedding `¥` in their text. Inputs continue accepting raw numbers and business calculations remain currency-agnostic.

## Error Handling

Repository failures already surface an alert. A failed initial load still marks the workspace ready after the attempt completes, so the application cannot remain permanently on the splash screen.

## Testing

- Unit-test the language-to-currency formatter for Chinese and English.
- Unit-test workspace readiness for successful and failed repository loading where the current test setup can exercise it.
- Run type checking and the full test suite.
- Build a release Android APK and install it on the connected device to verify the white launch screen and first visit of every tab.

## Scope Boundaries

- Do not add exchange-rate conversion or a user-selectable currency.
- Do not replace the existing logo asset.
- Do not change business data, CSV behavior, or navigation routes.
