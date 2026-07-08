#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENV_FILE="${ROOT_DIR}/.env.pgy.local"
APK="${1:-${ROOT_DIR}/android/app/build/outputs/apk/release/app-release.apk}"
DESCRIPTION="${PGYER_DESCRIPTION:-订单台账 beta 更新}"

if [[ -f "$ENV_FILE" ]]; then
  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a
fi

if [[ -z "${PGYER_API_KEY:-}" ]]; then
  echo "PGYER_API_KEY is missing. Add it to $ENV_FILE or export it before running." >&2
  exit 2
fi

for command in curl jq; do
  if ! command -v "$command" >/dev/null 2>&1; then
    echo "Missing required command: $command" >&2
    exit 2
  fi
done

if [[ ! -f "$APK" ]]; then
  echo "APK not found: $APK" >&2
  echo "Build one first, for example: (cd android && ./gradlew assembleRelease)" >&2
  exit 1
fi

echo "Uploading APK to Pgyer:"
ls -lh "$APK"

RESULT_JSON="$(mktemp)"
HTTP_CODE="$(
  curl -sS -w '%{http_code}' -o "$RESULT_JSON" \
    -F "_api_key=${PGYER_API_KEY}" \
    -F "file=@${APK}" \
    -F "buildInstallType=1" \
    -F "buildUpdateDescription=${DESCRIPTION}" \
    https://upload.pgyer.com/apiv2/app/upload
)"

if [[ "$HTTP_CODE" != "200" ]]; then
  echo "Pgyer upload HTTP $HTTP_CODE" >&2
  jq '{code,message}' "$RESULT_JSON" 2>/dev/null || cat "$RESULT_JSON" >&2
  exit 1
fi

if [[ "$(jq -r '.code' "$RESULT_JSON")" != "0" ]]; then
  jq '{code,message}' "$RESULT_JSON" >&2
  exit 1
fi

jq '{
  buildName: .data.buildName,
  buildVersion: .data.buildVersion,
  buildVersionNo: .data.buildVersionNo,
  buildIdentifier: .data.buildIdentifier,
  buildShortcutUrl: .data.buildShortcutUrl,
  buildQRCodeURL: .data.buildQRCodeURL,
  buildCreated: .data.buildCreated,
  buildUpdated: .data.buildUpdated
}' "$RESULT_JSON"
