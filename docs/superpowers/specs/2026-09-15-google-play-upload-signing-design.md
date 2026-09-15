# Google Play 上传签名设计

## 目标

为“订单台账”首个 Google Play 正式版本准备可上传的已签名 Android App Bundle，不改变应用功能，也不将任何私钥材料提交到仓库。

## 当前情况

现有发布包版本为 `1.2.0`、`versionCode 1`，但生成的 Android 工程会使用 `android/app/debug.keystore` 对发布构建签名。该密钥只应用于开发阶段，不能成为 Google Play 长期使用的上传凭据。

## 备选方案

1. 直接上传现有 AAB：速度最快，但会将应用永久绑定到开发密钥，不采用。
2. 在本机生成独立上传密钥，并且仅用于正式构建：私钥保留在本机，可干净地接入 Google Play 应用签名，采用此方案。
3. 配置云端构建并托管凭据：后续可采用，但目前仓库尚未配置 Expo 账号和凭据流程。

## 方案设计

- 在 `android/app/order-ledger-upload.keystore` 生成一套 4096 位 RSA 上传密钥，有效期 30 年。
- 将密钥路径、别名和口令存入 `android/keystore.properties`；两个文件均保持 Git 忽略，不会提交。
- 在 `android/app/build.gradle` 中新增 `release` 签名配置，加载 `keystore.properties`；如缺少密钥材料，构建应立即报出明确错误。
- 只有 Gradle 的 `release` 构建使用新上传密钥；调试构建保持原状。
- 重新生成 `app-release.aab`，校验签名和证书指纹，并保留该指纹，用于 Google Play 上传密钥注册或后续恢复。

## 异常处理

- 如果缺少 `keystore.properties` 或其必填字段，签名配置必须中止发布构建并给出明确提示。
- 不暂存、不提交生成的私钥和口令文件。
- 如果此包名已在 Google Play 注册上传密钥，则不能上传由新密钥签名的 AAB，应先申请重置上传密钥。

## 验证方式

- `keytool -list` 应显示预期别名和 4096 位 RSA 证书。
- `./gradlew bundleRelease` 应构建成功。
- `jarsigner -verify` 应验证新生成的 AAB 成功。
- 新签名证书指纹应不同于现有开发密钥的指纹。
