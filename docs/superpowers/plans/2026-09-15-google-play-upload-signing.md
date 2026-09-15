# Google Play 上传签名实施计划

> **供执行代理使用：** 必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans` 逐项执行本计划。步骤使用复选框跟踪。

**目标：** 生成独立的 Android 上传密钥，并产出可上传至 Google Play 的签名 AAB。

**架构：** 上传私钥和口令只保留在被 Git 忽略的 Android 目录。`build.gradle` 在正式构建时加载本地配置，拒绝使用开发密钥；新 AAB 会接受签名和证书指纹验证。

**技术栈：** Android Gradle Plugin、Java `keytool`、Java `jarsigner`、OpenSSL。

## 全局约束

- 应用包名固定为 `com.archie.ordermanagement`。
- 应用版本固定为 `1.2.0`、`versionCode 1`，本任务不得变更。
- 上传密钥使用 RSA 4096 位、PKCS12 格式、有效期 10,950 天。
- 私钥文件和口令文件必须保持 Git 忽略，绝不暂存或提交。
- 调试构建继续使用现有开发签名；只有 `release` 构建使用上传密钥。

---

### 任务 1：建立本地上传签名并配置正式构建

**文件：**
- 创建（Git 忽略）：`android/app/order-ledger-upload.keystore`
- 创建（Git 忽略）：`android/keystore.properties`
- 修改（Git 忽略的生成 Android 工程）：`android/app/build.gradle:100-119`

**接口：**
- 使用：`android/keystore.properties` 的 `ORDER_LEDGER_UPLOAD_STORE_FILE`、`ORDER_LEDGER_UPLOAD_KEY_ALIAS`、`ORDER_LEDGER_UPLOAD_STORE_PASSWORD`、`ORDER_LEDGER_UPLOAD_KEY_PASSWORD`。
- 产出：`signingConfigs.release`，供 `buildTypes.release` 使用。

- [ ] **步骤 1：确认密钥文件和口令文件不会被 Git 跟踪**

运行：

```bash
git check-ignore -v android/app/order-ledger-upload.keystore android/keystore.properties
```

预期：两个路径均命中根目录 `.gitignore` 中的 `android/` 规则。

- [ ] **步骤 2：生成随机口令和上传密钥**

运行：

```bash
release_store_password="$(openssl rand -hex 32)"
release_key_password="$(openssl rand -hex 32)"
keytool -genkeypair -v -keystore android/app/order-ledger-upload.keystore -storetype PKCS12 -alias order-ledger-upload -keyalg RSA -keysize 4096 -validity 10950 -storepass "$release_store_password" -keypass "$release_key_password" -dname "CN=Order Ledger, OU=Mobile, O=Order Ledger, L=Shenzhen, ST=Guangdong, C=CN"
{
  echo 'ORDER_LEDGER_UPLOAD_STORE_FILE=app/order-ledger-upload.keystore'
  echo 'ORDER_LEDGER_UPLOAD_KEY_ALIAS=order-ledger-upload'
  echo "ORDER_LEDGER_UPLOAD_STORE_PASSWORD=$release_store_password"
  echo "ORDER_LEDGER_UPLOAD_KEY_PASSWORD=$release_key_password"
} > android/keystore.properties
```

预期：生成 `android/app/order-ledger-upload.keystore` 和仅限本机使用的 `android/keystore.properties`。

- [ ] **步骤 3：先验证新密钥的别名和密钥类型**

运行：

```bash
set -a
. android/keystore.properties
set +a
keytool -list -v -keystore "android/${ORDER_LEDGER_UPLOAD_STORE_FILE}" -storepass "$ORDER_LEDGER_UPLOAD_STORE_PASSWORD" -alias "$ORDER_LEDGER_UPLOAD_KEY_ALIAS"
```

预期：输出显示 `PrivateKeyEntry` 和 4096 位 RSA 公钥。

- [ ] **步骤 4：将发布构建绑定到上传密钥**

在 `android/app/build.gradle` 的 `android {` 之前加入以下配置：

```groovy
def uploadPropertiesFile = rootProject.file('keystore.properties')
def uploadProperties = new Properties()
if (uploadPropertiesFile.exists()) {
    uploadPropertiesFile.withInputStream { stream -> uploadProperties.load(stream) }
}
def uploadPropertyNames = [
    'ORDER_LEDGER_UPLOAD_STORE_FILE',
    'ORDER_LEDGER_UPLOAD_KEY_ALIAS',
    'ORDER_LEDGER_UPLOAD_STORE_PASSWORD',
    'ORDER_LEDGER_UPLOAD_KEY_PASSWORD',
]
def isUploadSigningConfigured = uploadPropertiesFile.exists() && uploadPropertyNames.every { uploadProperties[it] }
```

将当前 `signingConfigs` 中保留的 `debug` 配置后追加：

```groovy
release {
    if (isUploadSigningConfigured) {
        storeFile rootProject.file(uploadProperties['ORDER_LEDGER_UPLOAD_STORE_FILE'])
        storePassword uploadProperties['ORDER_LEDGER_UPLOAD_STORE_PASSWORD']
        keyAlias uploadProperties['ORDER_LEDGER_UPLOAD_KEY_ALIAS']
        keyPassword uploadProperties['ORDER_LEDGER_UPLOAD_KEY_PASSWORD']
    }
}
```

将 `buildTypes.release` 内的 `signingConfig signingConfigs.debug` 替换为：

```groovy
if (!isUploadSigningConfigured) {
    throw new GradleException('正式构建需要 android/keystore.properties 和独立上传密钥；请先生成或恢复上传密钥。')
}
signingConfig signingConfigs.release
```

预期：正式构建只会使用本机上传密钥，且不能静默回退到开发密钥。

- [ ] **步骤 5：验证调试构建和 Git 忽略规则**

运行：

```bash
cd android && ./gradlew :app:assembleDebug
git status --short --ignored app/order-ledger-upload.keystore ../android/keystore.properties
```

预期：调试构建成功；上传密钥和口令仅显示为忽略项。

### 任务 2：构建并验证 Google Play AAB

**文件：**
- 生成（Git 忽略）：`android/app/build/outputs/bundle/release/app-release.aab`

**接口：**
- 使用：任务 1 的 `signingConfigs.release` 和 `android/keystore.properties`。
- 产出：使用 `order-ledger-upload` 签名的 AAB，以及可存档的 SHA-256 证书指纹。

- [ ] **步骤 1：生成正式 AAB**

运行：

```bash
cd android && ./gradlew :app:bundleRelease
```

预期：构建成功，生成 `android/app/build/outputs/bundle/release/app-release.aab`。

- [ ] **步骤 2：验证 AAB 签名**

运行：

```bash
jarsigner -verify -strict android/app/build/outputs/bundle/release/app-release.aab
```

预期：输出 `jar 已验证`，没有签名损坏或未签名条目错误；自签名证书链提示可接受。

- [ ] **步骤 3：记录上传证书指纹**

运行：

```bash
set -a
. android/keystore.properties
set +a
keytool -list -v -keystore "android/${ORDER_LEDGER_UPLOAD_STORE_FILE}" -storepass "$ORDER_LEDGER_UPLOAD_STORE_PASSWORD" -alias "$ORDER_LEDGER_UPLOAD_KEY_ALIAS" | rg 'SHA256|SHA-256'
```

预期：输出唯一 SHA-256 指纹，且不同于旧开发密钥的指纹。

- [ ] **步骤 4：确认交付物与私钥隔离**

运行：

```bash
ls -lh android/app/build/outputs/bundle/release/app-release.aab
git status --short
```

预期：AAB 存在；Git 状态不包含 `.keystore`、`keystore.properties` 或 Android 生成目录文件。
