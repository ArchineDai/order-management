# 订单管理 App PRD 来源

本项目根据以下输入实现到 `1.1.0`：

- 原 Codex 会话：`019f3bce-08e7-7110-979b-73c0b1dc5f75`
- PRD PDF：`order-management-prd.pdf`
- PRD Markdown 源文件：`/Users/archie/Documents/Codex/2026-07-07/app/outputs/order-management-prd.md`

实现边界：

- V1：手机端订单、送货、买入、库存、欠货、搜索、导出主流程闭环。
- V1.1：本地 OCR 辅助录入草稿、重复订单提醒、利润/毛利分析、库存和欠货提醒。

技术实现采用本地优先移动端 PWA：数据默认保存在浏览器本机 `localStorage`，支持导出 CSV，图片附件以浏览器可读的 Data URL 留存。
