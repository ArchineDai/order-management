# Task 4 — Public browser acceptance report

**Target:** `https://mole.archie-lab.com/`  
**Checked:** 2026-08-03 (Asia/Shanghai)  
**Browser:** Microsoft Edge, newly opened tab

## Result: PASS

1. **HTTPS and default language — PASS**
   - The site loaded directly at the HTTPS address with Edge’s secure-lock indicator and no certificate/security interstitial.
   - A newly opened tab started on the Chinese version (`中文` selected).

2. **Chinese content — PASS**
   - Legal name shown: `深圳摩尔半导体有限公司`.
   - Business description shown: `电子元器件批发与供应链服务` and the supporting company profile text.
   - Address shown: `深圳市坪山区坑梓街道金沙社区坪山大道6340号365创客园A栋213`.
   - Contact shown: `contact@archie-lab.com` (a mailto link).
   - No phone number was visible. A public-HTML search for `tel:`, `phone`, and `电话` also produced no matches.

3. **English content — PASS**
   - Selecting `EN` changed the displayed content to English.
   - Legal name shown: `Shenzhen Mole Semiconductor Co., Ltd.`.
   - Business description shown: `Electronic Components Wholesale & Supply Chain Services` with the English company profile.
   - Address shown: `Room 213, Building A, 365 Maker Park, No. 6340 Pingshan Avenue, Jinsha Community, Kengzi Subdistrict, Pingshan District, Shenzhen, China`.
   - The same `contact@archie-lab.com` mailto link remained present.

4. **Responsive presentation — PASS**
   - Used Edge DevTools responsive mode at **375 × 667 px**.
   - Chinese language control remained usable at this width and switched the page successfully.
   - Measured `window.innerWidth` = 375 and `document.documentElement.scrollWidth` = 375, confirming no horizontal overflow.
   - The responsive page presented a narrow, single-column content flow.

5. **Public HTML deployment evidence — PASS**
   - Command run: `curl -sS https://mole.archie-lab.com/ | rg -F 'Shenzhen Mole Semiconductor Co., Ltd.'`
   - Returned: `<h1 id="company-name-en" data-lang="en" hidden>Shenzhen Mole Semiconductor Co., Ltd.</h1>`

## Concerns

None affecting acceptance. No project source or server files were changed during this verification.

## Final review corrections — 2026-08-03

- Added an in-hero `<noscript>` identity block so visitors without JavaScript can see `Shenzhen Mole Semiconductor Co., Ltd.` and use `contact@archie-lab.com` alongside the Chinese default content.
- Added `.contact-link:focus-visible` styling with a dark background, light text and a light outline, plus a gold arrow treatment, so keyboard focus remains distinct in the gold contact section.
- Regression coverage added for both corrections.
- Verification: `node --test website/mole/index.test.mjs` — 6 passing, 0 failing; `git diff --check` — clean.
