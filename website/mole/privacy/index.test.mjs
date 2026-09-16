import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const page = await readFile(new URL('./index.html', import.meta.url), 'utf8');

test('states the app-local storage and permission boundaries in Chinese', () => {
  for (const value of [
    '订单、采购、库存、BOM 和用户主动添加的附件资料保存在您的设备本地。',
    '我们不会自动将这些资料传输给开发者。',
    '相机、相册和文件权限仅在您主动拍摄、选择凭证或导入资料时使用。',
    '应用不展示广告，也不会出售或共享您的数据。',
  ]) assert.match(page, new RegExp(value));
});

test('provides an equivalent English policy, contact route, and update date', () => {
  for (const value of [
    'Privacy Policy for Order Ledger',
    'stored locally on your device',
    'does not display advertising',
    'contact@archie-lab.com',
    'Last updated: September 16, 2026',
  ]) assert.match(page, new RegExp(value));
});

test('defaults to Chinese and provides accessible language controls', () => {
  assert.match(page, /<html lang="zh-CN">/);
  assert.match(page, /<button[^>]+data-language="zh"[^>]*aria-pressed="true"/);
  assert.match(page, /<button[^>]+data-language="en"[^>]*aria-pressed="false"/);
  assert.match(page, /function setLanguage\(language\)/);
});
