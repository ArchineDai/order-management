# 订单台账隐私政策页面实施计划

> **供执行代理使用：** 必须使用 `superpowers:subagent-driven-development`（推荐）或 `superpowers:executing-plans` 逐项执行本计划。步骤使用复选框跟踪。

**目标：** 发布可供 Google Play 使用的订单台账中英双语隐私政策页面。

**架构：** 在现有 `mole.archie-lab.com` 静态站点根目录下增加 `privacy/index.html`。页面不依赖服务端或跟踪脚本，默认显示中文，客户端语言按钮切换为等义英文。

**技术栈：** 静态 HTML、内联 CSS 与原生 JavaScript、SSH/SCP、curl。

## 全局约束

- 政策地址固定为 `https://mole.archie-lab.com/privacy/`。
- 页面只陈述已从应用代码验证的本地存储、相机/相册/文件权限、导出与分享行为。
- 页面不得宣称有账户体系、广告、数据销售、服务器同步、加密认证或未经提供的合规资质。
- 联系邮箱固定为 `contact@archie-lab.com`。

---

### 任务 1：实现并验证静态政策页面

**文件：**
- 创建：`website/mole/privacy/index.html`
- 创建：`website/mole/privacy/index.test.mjs`

**接口：**
- 使用：现有官网的公司名称和 `contact@archie-lab.com`。
- 产出：默认中文、可切换英文的静态页面。

- [ ] **步骤 1：编写页面内容检查**

测试必须验证政策地址文案、中文标题、本地存储说明、权限说明、无广告/不共享数据说明、英文标题和联系邮箱。

运行：

```bash
node --test website/mole/privacy/index.test.mjs
```

预期：页面尚未存在，测试失败。

- [ ] **步骤 2：创建政策页面**

页面必须包含以下中文事实：

```text
订单、采购、库存、BOM 和用户主动添加的附件资料保存在您的设备本地。
我们不会自动将这些资料传输给开发者。
相机、相册和文件权限仅在您主动拍摄、选择凭证或导入资料时使用。
应用不展示广告，也不会出售或共享您的数据。
```

页面必须提供等义英文版、`contact@archie-lab.com` 邮箱链接和“最后更新：2026 年 9 月 16 日”。

- [ ] **步骤 3：运行页面检查**

运行：

```bash
node --test website/mole/privacy/index.test.mjs
```

预期：所有检查通过。

### 任务 2：发布并验证公网地址

**文件：**
- 上传至服务器：`/var/www/mole.archie-lab.com/privacy/index.html`

**接口：**
- 使用：任务 1 的 `website/mole/privacy/index.html` 和现有 `ssh.archie-lab.com` 访问方式。
- 产出：HTTPS 公网地址 `https://mole.archie-lab.com/privacy/`。

- [ ] **步骤 1：上传政策页面**

运行：

```bash
scp website/mole/privacy/index.html ssh.archie-lab.com:/tmp/order-ledger-privacy.html
ssh ssh.archie-lab.com 'sudo install -d -m 0755 /var/www/mole.archie-lab.com/privacy && sudo install -m 0644 /tmp/order-ledger-privacy.html /var/www/mole.archie-lab.com/privacy/index.html && rm /tmp/order-ledger-privacy.html'
```

预期：目标文件存在，模式为 `0644`。

- [ ] **步骤 2：验证 HTTPS 地址与正文**

运行：

```bash
curl -fsSIL https://mole.archie-lab.com/privacy/
curl -fsS https://mole.archie-lab.com/privacy/ | rg -F '订单、采购、库存、BOM'
```

预期：返回 HTTP 200，并输出本地存储说明。
