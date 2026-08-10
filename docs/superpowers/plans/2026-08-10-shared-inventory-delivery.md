# 跨订单库存出货 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 支持后续订单直接消耗同规格型号的历史剩余库存。

**Architecture:** 库存继续从采购和送货记录推导。`summarizeOrders` 建立按 `specModel` 聚合的共享库存索引，并用它覆盖订单卡片的库存指标；`summarizeLine` 保留单订单计算语义，避免影响独立调用。

**Tech Stack:** TypeScript、Vitest、Expo/React Native。

## Global Constraints

- 完全相同的 `specModel` 共享库存。
- 库存不足时仍允许记录送货，并显示负数结余。
- 欠货仅由本订单行的订单数和已送数决定。
- 不新增数据字段、迁移或依赖。

---

## File structure

- `src/domain/calculations.ts`：共享库存索引和批量摘要投影。
- `src/domain/calculations.test.ts`：跨订单库存出货回归测试。

### Task 1: 共享库存领域计算

**Files:**
- Modify: `src/domain/calculations.ts`
- Test: `src/domain/calculations.test.ts`

**Interfaces:**
- Consumes: `Order[]` 及订单行的 `specModel`、采购和送货记录。
- Produces: `summarizeOrders(orders: Order[]): LineSummary[]`，其中每个摘要的 `inventoryBalance` 是该规格的共享库存。

- [ ] **Step 1: 写入失败测试**

```ts
it("uses remaining inventory from an earlier order when a later order delivers the same specification", () => {
  const first = createSampleOrder({ orderNo: "SO-001", specModel: "AB-12", lineQuantity: 50, deliveries: [20], purchases: [{ quantity: 50, total: 500, ratio: 1 }] });
  const next = createSampleOrder({ orderNo: "SO-002", specModel: "AB-12", lineQuantity: 30, deliveries: [30], purchases: [] });

  const summaries = summarizeOrders([first, next]);

  expect(summaries.find((summary) => summary.orderNo === "SO-002")).toMatchObject({ deliveredQuantity: 30, backorderQuantity: 0, inventoryBalance: 0 });
});
```

- [ ] **Step 2: 运行测试确认失败**

Run: `pnpm test src/domain/calculations.test.ts`

Expected: FAIL，因为后续订单行的当前库存计算结果为 `-30`。

- [ ] **Step 3: 实现最小共享库存索引**

```ts
function inventoryBalanceBySpec(orders: Order[]): Map<string, number> {
  const balances = new Map<string, number>();
  for (const order of orders) for (const line of order.lines) {
    balances.set(line.specModel, quantity((balances.get(line.specModel) ?? 0) + purchasedInOrderUnit(line) - deliveredQuantity(line)));
  }
  return balances;
}

export function summarizeOrders(orders: Order[]): LineSummary[] {
  const balances = inventoryBalanceBySpec(orders);
  return orders.flatMap((order) => order.lines.map((line) => ({ ...summarizeLine(order, line), inventoryBalance: balances.get(line.specModel) ?? 0 })));
}
```

- [ ] **Step 4: 运行测试确认通过**

Run: `pnpm test src/domain/calculations.test.ts`

Expected: PASS。

- [ ] **Step 5: 覆盖库存不足时的真实缺口**

```ts
it("keeps a negative shared balance when deliveries exceed all shared inventory", () => {
  const order = createSampleOrder({ specModel: "AB-12", lineQuantity: 60, deliveries: [60], purchases: [{ quantity: 50, total: 500, ratio: 1 }] });
  expect(summarizeOrders([order])[0].inventoryBalance).toBe(-10);
});
```

- [ ] **Step 6: 运行全量校验**

Run: `pnpm test && pnpm typecheck`

Expected: 两个命令退出码均为 0。

- [ ] **Step 7: 提交实现**

Run: `git add src/domain/calculations.ts src/domain/calculations.test.ts && git commit -m "fix: 支持跨订单库存直接送货"`

Expected: 新实现创建为独立提交。

### Task 2: Android 测试包交付

**Files:**
- Modify: 无源代码修改。

**Interfaces:**
- Consumes: 已通过校验的源码、`PGYER_API_KEY` 和 release APK。
- Produces: 推送的 Git 分支和蒲公英下载地址。

- [ ] **Step 1: 构建 release APK**

Run: `cd android && ./gradlew assembleRelease`

Expected: 生成 `android/app/build/outputs/apk/release/app-release.apk`。

- [ ] **Step 2: 再次确认交付条件**

Run: `ls -lh android/app/build/outputs/apk/release/app-release.apk && pnpm test && pnpm typecheck`

Expected: APK 存在，校验命令退出码均为 0。

- [ ] **Step 3: 推送并上传蒲公英**

Run: 调用 `package_push_pgy.sh`，使用 release APK、提交信息 `fix: 支持跨订单库存直接送货` 和更新说明 `支持使用历史库存直接送货，库存按规格型号跨订单汇总`。

Expected: 输出提交、推送状态和蒲公英下载短链接。
