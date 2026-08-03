# Mole Semiconductor Company Website Design

## Goal

Publish a trustworthy bilingual company website at `https://mole.archie-lab.com/` for Shenzhen Mole Semiconductor Co., Ltd. The site will provide clear, consistent public business information suitable for D-U-N-S verification.

## Scope

- A fast, static, single-page website with Chinese and English language switching.
- HTTPS deployment for `mole.archie-lab.com`.
- Responsive presentation for desktop and mobile browsers.
- Public company identity, business scope, address, and an email contact channel.

The site will not include prices, inventory, a contact form, a phone number, customer accounts, or claims about certifications, brands, or products that have not been provided.

## Public information

| Field | Chinese | English |
| --- | --- | --- |
| Legal name | 深圳摩尔半导体有限公司 | Shenzhen Mole Semiconductor Co., Ltd. |
| Business | 电子元器件批发与供应链服务 | Electronic Components Wholesale & Supply Chain Services |
| Products | 电子元器件 | Electronic components |
| Address | 深圳市坪山区坑梓街道金沙社区坪山大道6340号365创客园A栋213 | Room 213, Building A, 365 Maker Park, No. 6340 Pingshan Avenue, Jinsha Community, Kengzi Subdistrict, Pingshan District, Shenzhen, China |
| Email | contact@archie-lab.com | contact@archie-lab.com |

## Experience and visual design

The page uses a restrained semiconductor-industrial visual system: deep navy surfaces, warm-gold highlights, fine circuit-line motifs, and an editorial type hierarchy. It is deliberately information-led rather than promotional, so the legal identity and business purpose are immediately visible.

The first viewport states the company name and business positioning. A clear language switch keeps the Chinese and English versions equivalent. The mobile layout stacks content in the same logical order without hiding company details.

## Page structure

1. Header: logo wordmark, language control, and anchor navigation.
2. Hero: company identity and business positioning.
3. About: concise description of the company as an electronic-components wholesale and supply-chain-services business.
4. Products: general electronic-components coverage, without unsupported brand, technical, or stock claims.
5. Services: sourcing coordination, wholesale supply, and delivery-oriented supply-chain support, expressed cautiously as service categories.
6. Company information: legal name and physical address in the active language.
7. Contact: `contact@archie-lab.com` as the sole public contact method.
8. Footer: legal name, current year, and domain.

## Technical architecture

- The website is a self-contained static HTML, CSS, and JavaScript package.
- Client-side language switching changes text only; content remains available without any server-side dependency.
- A web-server virtual host routes `mole.archie-lab.com` to the static files and redirects HTTP to HTTPS.
- TLS is provisioned for the exact host name and automatic renewal is enabled through the server's existing certificate workflow.

## Failure handling

- If JavaScript is unavailable, the default Chinese content remains readable and the English company name and contact details remain visible.
- The deployment includes cache-safe asset names or conservative cache headers so corrections become visible quickly.
- DNS, TLS, and HTTP/HTTPS responses are checked separately before declaring the site live.

## Acceptance checks

- `https://mole.archie-lab.com/` loads without certificate warnings.
- Both languages show the supplied legal names, business scope, address, and email exactly as specified.
- The page is readable on desktop and mobile widths.
- HTTP redirects to HTTPS.
- No telephone number, unsupported claims, or placeholder content appears publicly.
