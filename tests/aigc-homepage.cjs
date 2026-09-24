const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const pageUrl = pathToFileURL(path.join(root, 'index.html')).href;

const expectedProjects = [
    {
        title: 'AIGC CAMPUS FILM',
        description: '刚出考场就穿越？用 AI 重现中北大学的历史与底蕴',
        cover: 'assets/ai/aigc-campus-film.jpg',
        date: '2026.9'
    },
    {
        title: 'AIGC EVENT PROMO',
        description: '人说山西好风光——酒BA·汾阳篮球 AIGC 宣传片',
        cover: 'assets/ai/aigc-event-promo.jpg',
        date: '2026.9'
    }
];

test('全站身份统一为大二且不再出现大一身份文字', () => {
    assert.doesNotMatch(html, /大一|FRESHMAN/i);
    assert.match(html, /IDENTITY: SOPHOMORE_V2\.0/);
    assert.match(html, /中北大学<strong>大二学生<\/strong>/);
    assert.match(html, /<div class="academic-value">大二<\/div>/);
});

async function withPage(viewport, run) {
    const browser = await chromium.launch({
        headless: true,
        executablePath: process.env.CHROMIUM_EXECUTABLE || undefined
    });
    try {
        const page = await browser.newPage({ viewport });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.goto(pageUrl);
        await run(page);
        assert.deepEqual(errors, [], '页面无 JavaScript 错误');
    } finally {
        await browser.close();
    }
}

test('首页入口、作品区和详情页统一使用 AIGC 实战名称', async () => {
    await withPage({ width: 1440, height: 900 }, async page => {
        const aiEntry = page.locator('#skills-track .window-block').first();
        assert.equal((await aiEntry.locator('.block-top').innerText()).trim(), '01 / AIGC 创作与实践');
        assert.equal((await aiEntry.locator('.block-title').innerText()).replace(/\s+/g, ' ').trim(), 'AIGC 实战');
        assert.match(await aiEntry.locator('.block-bottom').innerText(), /查看 AIGC 作品/);
        assert.equal((await page.locator('.dark-portfolio-container').locator('xpath=preceding-sibling::*[1]').innerText()).includes('AIGC 实战'), true);
        assert.equal(await page.locator('#ai-portfolio-page .glitch-text').innerText(), 'AIGC 实战');
    });
});

test('首页作品 02、03 映射到两支 AIGC 视频', async () => {
    await withPage({ width: 1440, height: 900 }, async page => {
        const cards = page.locator('.dark-portfolio-container .dp-item');
        assert.equal(await cards.count(), 3);

        for (const [offset, project] of expectedProjects.entries()) {
            const card = cards.nth(offset + 1);
            assert.equal((await card.locator('.dp-title').innerText()).trim(), project.title);
            assert.equal((await card.locator('.dp-desc').innerText()).trim(), project.description);
            assert.equal((await card.locator('.dp-date').innerText()).trim(), project.date);
            assert.equal(await card.getAttribute('data-hover-img'), project.cover);
            assert.equal(await card.getAttribute('onclick'), 'openAIPage()');
        }
    });
});

for (const viewport of [
    { name: '电脑', width: 1440, height: 900 },
    { name: '手机', width: 390, height: 844 }
]) {
    test(`${viewport.name}点击首页 02、03 均打开详情页顶部且页面无横向溢出`, async () => {
        await withPage(viewport, async page => {
            const cards = page.locator('.dark-portfolio-container .dp-item');

            for (const index of [1, 2]) {
                await page.evaluate(() => {
                    document.getElementById('ai-portfolio-page').scrollTop = 500;
                });
                await cards.nth(index).click();
                assert.equal(await page.locator('#ai-portfolio-page').evaluate(element => element.classList.contains('active')), true);
                assert.equal(await page.locator('#ai-portfolio-page').evaluate(element => element.scrollTop), 0);
                await page.evaluate(() => closeAIPage());
            }

            assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth), false);
        });
    });
}
