import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

const page = await readFile(new URL('./index.html', import.meta.url), 'utf8');

test('publishes the approved bilingual company identity', () => {
  for (const value of [
    '深圳摩尔半导体有限公司',
    'Shenzhen Mole Semiconductor Co., Ltd.',
    '电子元器件批发与供应链服务',
    'Electronic Components Wholesale &amp; Supply Chain Services',
    'contact@archie-lab.com',
  ]) assert.match(page, new RegExp(value));
});

test('keeps address visible and excludes a telephone number', () => {
  assert.match(page, /深圳市坪山区坑梓街道金沙社区坪山大道6340号365创客园A栋213/);
  assert.match(page, /Room 213, Building A, 365 Maker Park/);
  assert.doesNotMatch(page, /15367398177/);
});

test('contains accessible language controls and a mobile viewport', () => {
  assert.match(page, /<meta name="viewport" content="width=device-width, initial-scale=1">/);
  assert.match(page, /<button[^>]+data-language="zh"/);
  assert.match(page, /<button[^>]+data-language="en"/);
});

test('updates every labelled section to use only the active-language heading', () => {
  for (const section of [
    'company-name',
    'intro-title',
    'components-title',
    'coordination-title',
    'delivery-title',
    'location-title',
    'contact-title',
  ]) {
    assert.match(
      page,
      new RegExp(`data-label-zh="${section}-zh" data-label-en="${section}-en"`),
    );
  }
  assert.match(page, /document\.querySelectorAll\('\[data-label-zh\]\[data-label-en\]'\)/);
  assert.match(page, /section\.setAttribute\('aria-labelledby', section\.getAttribute\(`data-label-\$\{language\}`\)\);/);
});
