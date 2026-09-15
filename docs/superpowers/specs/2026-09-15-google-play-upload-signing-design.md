# Google Play Upload Signing Design

## Goal

Prepare a signed Android App Bundle suitable for the first Google Play production release of Order Ledger without changing application behavior or committing private signing material.

## Context

The current release bundle is version `1.2.0` with `versionCode 1`, but the generated Android project signs its release build with `android/app/debug.keystore`. That key is intended for development and must not become the permanent upload identity for Google Play.

## Options Considered

1. Upload the existing AAB. This is fastest, but permanently couples the application to the development key and is rejected.
2. Generate a dedicated local upload key and use it only for release builds. This keeps the private key local, enables a clean Google Play App Signing setup, and is selected.
3. Configure a cloud build with managed credentials. This is viable later but requires a separate Expo account and credential workflow not currently present in the repository.

## Design

- Create one 4096-bit RSA upload key at `android/app/order-ledger-upload.keystore` with a 30-year validity period.
- Store the keystore location, alias, and passwords in `android/keystore.properties`; both files remain ignored by Git.
- Add a `release` signing configuration in `android/app/build.gradle` that loads `keystore.properties` and fails immediately if the expected key material is absent.
- Sign only the Gradle `release` build with the new upload key. Debug builds remain unchanged.
- Rebuild `app-release.aab`, verify its signature and certificate fingerprint, and retain the fingerprint for Google Play upload-key registration or recovery.

## Error Handling

- The signing configuration must stop the release build with a direct error when `keystore.properties` or its required fields are missing.
- The generated private key and password file must not be staged or committed.
- If a Google Play upload-key certificate was already registered for this package, do not upload the newly signed bundle; request an upload-key reset instead.

## Verification

- `keytool -list` reports the expected alias and a 4096-bit RSA certificate.
- `./gradlew bundleRelease` succeeds.
- `jarsigner -verify` validates the generated AAB.
- The signer fingerprint differs from the existing development-key fingerprint.
