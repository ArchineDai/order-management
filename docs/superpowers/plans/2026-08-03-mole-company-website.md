# Mole Semiconductor Company Website Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build and publish a bilingual, HTTPS company website at `https://mole.archie-lab.com/` for D-U-N-S verification.

**Architecture:** A dependency-free static HTML page contains both Chinese and English copy, with a small JavaScript state function that switches visible language-specific nodes. The page is published as a separate static site and served by the server's existing web stack, selected only after inspecting the running service.

**Tech Stack:** HTML5, CSS3, browser JavaScript, Node.js built-in test runner, existing server web service, HTTPS certificate workflow already present on the server.

## Global Constraints

- Public legal names must be exactly `深圳摩尔半导体有限公司` and `Shenzhen Mole Semiconductor Co., Ltd.`.
- Public business text must state `电子元器件批发与供应链服务` / `Electronic Components Wholesale & Supply Chain Services`.
- Publish `contact@archie-lab.com` and do not publish a telephone number.
- Publish the supplied Shenzhen address in matching Chinese and English forms.
- Do not make unverified certification, brand, inventory, pricing, or performance claims.
- Redirect all HTTP requests for `mole.archie-lab.com` to HTTPS.

---

### Task 1: Add content-level regression coverage

**Files:**
- Create: `website/mole/index.test.mjs`
- Test: `website/mole/index.test.mjs`

**Interfaces:**
- Consumes: `website/mole/index.html` as UTF-8 text.
- Produces: an executable `node --test website/mole/index.test.mjs` acceptance check.

- [ ] **Step 1: Write the failing test**

```js
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
```

- [ ] **Step 2: Run test to verify it fails**

Run: `node --test website/mole/index.test.mjs`  
Expected: FAIL because `website/mole/index.html` does not exist.

- [ ] **Step 3: Commit the test**

```bash
git add website/mole/index.test.mjs
git commit -m "test: define mole website content checks"
```

### Task 2: Implement the bilingual static company page

**Files:**
- Create: `website/mole/index.html`
- Modify: `website/mole/index.test.mjs`
- Test: `website/mole/index.test.mjs`

**Interfaces:**
- Consumes: the approved identity and contact information listed in Global Constraints.
- Produces: `website/mole/index.html`, a self-contained static document with `data-lang` content nodes and a `setLanguage(language)` browser function.

- [ ] **Step 1: Create the document structure and approved copy**

Create a semantic page with `header`, `main`, five labelled `section` elements, and `footer`. Put each translatable text node in paired elements using `data-lang="zh"` and `data-lang="en"`. Use the following exact copy:

```html
<title>Mole Semiconductor | 深圳摩尔半导体有限公司</title>
<h1 data-lang="zh">深圳摩尔半导体有限公司</h1>
<h1 data-lang="en">Shenzhen Mole Semiconductor Co., Ltd.</h1>
<p data-lang="zh">电子元器件批发与供应链服务</p>
<p data-lang="en">Electronic Components Wholesale &amp; Supply Chain Services</p>
<h2 data-lang="zh">电子元器件 · 供应协同 · 稳健交付</h2>
<h2 data-lang="en">Electronic components · Supply coordination · Reliable delivery</h2>
<p data-lang="zh">我们专注于电子元器件的批发供应，并提供面向业务需求的供应链服务支持。</p>
<p data-lang="en">We focus on the wholesale supply of electronic components and provide supply-chain service support aligned with business needs.</p>
<address data-lang="zh">深圳市坪山区坑梓街道金沙社区坪山大道6340号365创客园A栋213</address>
<address data-lang="en">Room 213, Building A, 365 Maker Park, No. 6340 Pingshan Avenue, Jinsha Community, Kengzi Subdistrict, Pingshan District, Shenzhen, China</address>
<a href="mailto:contact@archie-lab.com">contact@archie-lab.com</a>
```

- [ ] **Step 2: Add visual system and responsive layout**

Use CSS custom properties with `--ink: #071321`, `--panel: #0e2235`, `--gold: #d4a85c`, and `--paper: #f3efe5`. Implement a deep-navy hero with a low-contrast circuit-line background, warm-gold detail rules, a maximum content width of `1120px`, and a single-column layout below `720px`. Use the system serif stack `Georgia, 'Noto Serif SC', serif` for headings and `ui-sans-serif, 'PingFang SC', sans-serif` for body text. Include `:focus-visible`, `prefers-reduced-motion`, and visible hover states.

- [ ] **Step 3: Add language switching**

Append this exact script before `</body>` and make Chinese the default active language:

```html
<script>
  const controls = document.querySelectorAll('[data-language]');
  const content = document.querySelectorAll('[data-lang]');
  function setLanguage(language) {
    document.documentElement.lang = language === 'zh' ? 'zh-CN' : 'en';
    content.forEach((node) => { node.hidden = node.dataset.lang !== language; });
    controls.forEach((button) => {
      const active = button.dataset.language === language;
      button.setAttribute('aria-pressed', String(active));
    });
  }
  controls.forEach((button) => button.addEventListener('click', () => setLanguage(button.dataset.language)));
  setLanguage('zh');
</script>
```

- [ ] **Step 4: Run automated checks**

Run: `node --test website/mole/index.test.mjs`  
Expected: all 3 tests PASS.

- [ ] **Step 5: Preview and inspect visually**

Run: `python3 -m http.server 4173 --directory website/mole`  
Open: `http://localhost:4173/`  
Expected: Chinese content first, both language controls work, no horizontal scroll at mobile width.

- [ ] **Step 6: Commit the website source**

```bash
git add website/mole/index.html website/mole/index.test.mjs
git commit -m "feat: add mole company website"
```

### Task 3: Inspect server and publish as a dedicated HTTPS host

**Files:**
- Create on server: `/var/www/mole.archie-lab.com/index.html`
- Create on server: the existing web-server configuration location for `mole.archie-lab.com`

**Interfaces:**
- Consumes: `website/mole/index.html` and SSH access to `ssh.archie-lab.com`.
- Produces: a virtual host that serves `mole.archie-lab.com` over HTTPS and redirects HTTP to HTTPS.

- [ ] **Step 1: Identify the server web stack without modifying it**

Run: `ssh ssh.archie-lab.com 'command -v nginx; command -v caddy; systemctl is-active nginx; systemctl is-active caddy; ls -la /etc/nginx/sites-enabled /etc/caddy 2>/dev/null'`  
Expected: exactly one active web stack and its configuration location.

- [ ] **Step 2: Create the site directory and upload the verified page**

Run: `ssh ssh.archie-lab.com 'sudo install -d -m 0755 /var/www/mole.archie-lab.com'`  
Run: `scp website/mole/index.html ssh.archie-lab.com:/tmp/mole-index.html`  
Run: `ssh ssh.archie-lab.com 'sudo install -m 0644 /tmp/mole-index.html /var/www/mole.archie-lab.com/index.html && rm /tmp/mole-index.html'`  
Expected: `/var/www/mole.archie-lab.com/index.html` exists with mode `0644`.

- [ ] **Step 3: Configure the active web stack with the exact domain**

For Nginx, create `/etc/nginx/sites-available/mole.archie-lab.com` with this content, create its matching symlink in `sites-enabled`, run `sudo nginx -t`, then reload Nginx:

```nginx
server {
    listen 80;
    listen [::]:80;
    server_name mole.archie-lab.com;
    root /var/www/mole.archie-lab.com;
    index index.html;
    location /.well-known/acme-challenge/ { root /var/www/mole.archie-lab.com; }
    location / { return 301 https://$host$request_uri; }
}
```

Add the server's existing TLS certificate include or certificate management command for `mole.archie-lab.com`, then verify `sudo nginx -t` before reloading. For Caddy, add `mole.archie-lab.com { root * /var/www/mole.archie-lab.com; file_server }` to the active Caddyfile, run `sudo caddy validate --config /etc/caddy/Caddyfile`, and reload only after validation succeeds.

- [ ] **Step 4: Verify origin responses**

Run: `curl -sSIL http://mole.archie-lab.com/`  
Expected: a `301` or `308` Location response to `https://mole.archie-lab.com/`.

Run: `curl -sSIL https://mole.archie-lab.com/`  
Expected: HTTP `200`, a valid certificate chain, and no redirect loop.

### Task 4: Perform browser acceptance verification

**Files:**
- No source changes.

**Interfaces:**
- Consumes: the published `https://mole.archie-lab.com/` response.
- Produces: a manual acceptance record that the public HTTPS site presents the approved information in both languages.

- [ ] **Step 1: Open the live HTTPS address in a new Edge tab**

Open: `https://mole.archie-lab.com/`  
Expected: no certificate warning and the Chinese page is displayed.

- [ ] **Step 2: Validate Chinese content**

Check that the legal name, business description, address, and `contact@archie-lab.com` are visible, and that no phone number appears.

- [ ] **Step 3: Validate English content**

Select `EN`.  
Expected: English legal name, business description, English address, and the same email are visible.

- [ ] **Step 4: Check responsive presentation**

Use Edge responsive view or narrow the page.  
Expected: readable single-column layout, working language controls, and no horizontal overflow.

- [ ] **Step 5: Record deployment evidence**

Run: `curl -sS https://mole.archie-lab.com/ | rg -F 'Shenzhen Mole Semiconductor Co., Ltd.'`  
Expected: the English legal name is returned in the publicly served HTML.
