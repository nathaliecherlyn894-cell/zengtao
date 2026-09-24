const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
const html = fs.readFileSync(path.join(root, 'index.html'), 'utf8');
const pageUrl = pathToFileURL(path.join(root, 'index.html')).href;
const videos = [
    {
        id: '7639984858277661987',
        shareUrl: 'https://v.douyin.com/CGacnA2wEh0/',
        title: 'AIGC Campus Film'
    },
    {
        id: '7661531748085603508',
        shareUrl: 'https://v.douyin.com/cgEyM1ExD3g/',
        title: 'AIGC Event Promo'
    }
];

async function withAIPage(viewport, run) {
    const browser = await chromium.launch({
        headless: true,
        executablePath: process.env.CHROMIUM_EXECUTABLE || undefined
    });
    try {
        const page = await browser.newPage({ viewport });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        await page.route('https://open.douyin.com/player/video**', route => {
            route.fulfill({
                status: 200,
                contentType: 'text/html',
                body: '<!doctype html><title>Douyin player</title>'
            });
        });
        await page.goto(pageUrl);
        await page.evaluate(() => openAIPage());
        await run(page);
        assert.deepEqual(errors, [], '页面无 JavaScript 错误');
    } finally {
        await browser.close();
    }
}

test('AI 页面保留第一项并声明两支 AIGC 视频及抖音入口', () => {
    assert.match(html, /Gemini Dynamic Visual Website/);
    assert.equal((html.match(/class="ai-video-trigger"/g) || []).length, 2);
    for (const video of videos) {
        assert.match(html, new RegExp(video.id));
        assert.match(html, new RegExp(video.shareUrl.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')));
        assert.match(html, new RegExp(video.title));
    }
});

test('两个视频按需创建正确播放器，关闭或按 Escape 后销毁播放器', async () => {
    await withAIPage({ width: 1440, height: 900 }, async page => {
        const triggers = page.locator('.ai-video-trigger');
        const modal = page.locator('#ai-video-modal');
        const slot = page.locator('#ai-video-frame-slot');

        assert.equal(await triggers.count(), 2);
        assert.equal(await slot.locator('iframe').count(), 0);

        await triggers.nth(0).click();
        assert.equal(await modal.getAttribute('aria-hidden'), 'false');
        assert.equal(await modal.evaluate(el => el.classList.contains('is-open')), true);
        assert.equal(await slot.locator('iframe').count(), 1);
        assert.match(await slot.locator('iframe').getAttribute('src'), new RegExp(videos[0].id));
        assert.equal(await page.locator('#ai-video-douyin-link').getAttribute('href'), videos[0].shareUrl);

        await page.locator('[data-ai-video-close]').first().click();
        assert.equal(await modal.getAttribute('aria-hidden'), 'true');
        assert.equal(await slot.locator('iframe').count(), 0);

        await triggers.nth(1).click();
        assert.match(await slot.locator('iframe').getAttribute('src'), new RegExp(videos[1].id));
        assert.equal(await page.locator('#ai-video-douyin-link').getAttribute('href'), videos[1].shareUrl);
        await page.keyboard.press('Escape');
        assert.equal(await modal.getAttribute('aria-hidden'), 'true');
        assert.equal(await slot.locator('iframe').count(), 0);
    });
});

test('手机播放器弹窗和关闭按钮完整位于视口内', async () => {
    await withAIPage({ width: 390, height: 844 }, async page => {
        await page.locator('.ai-video-trigger').first().click();
        const geometry = await page.evaluate(() => {
            const dialog = document.querySelector('.ai-video-dialog').getBoundingClientRect();
            const close = document.querySelector('.ai-video-close').getBoundingClientRect();
            return {
                dialog: { left: dialog.left, right: dialog.right, top: dialog.top, bottom: dialog.bottom },
                close: { left: close.left, right: close.right, top: close.top, bottom: close.bottom },
                width: window.innerWidth,
                height: window.innerHeight,
                horizontalOverflow: document.documentElement.scrollWidth > window.innerWidth
            };
        });
        assert.ok(geometry.dialog.left >= 0 && geometry.dialog.right <= geometry.width);
        assert.ok(geometry.close.left >= 0 && geometry.close.right <= geometry.width);
        assert.ok(geometry.close.top >= 0 && geometry.close.bottom <= geometry.height);
        assert.equal(geometry.horizontalOverflow, false);
    });
});
