const { test } = require('node:test');
const assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { pathToFileURL } = require('node:url');
const path = require('node:path');

const url = pathToFileURL(path.resolve(__dirname, '../index.html')).href;

test('拆分后主页和三个作品页仍能加载、打开和关闭', async () => {
    const browser = await chromium.launch({
        headless: true,
        executablePath: process.env.CHROMIUM_EXECUTABLE || undefined
    });
    try {
        const page = await browser.newPage({ viewport: { width: 1440, height: 900 } });
        const errors = [];
        page.on('pageerror', error => errors.push(`页面错误：${error.message}`));
        page.on('console', message => {
            if (message.type() === 'error') errors.push(`控制台错误：${message.text()}`);
        });
        page.on('requestfailed', request => errors.push(`资源失败：${request.url()}`));
        await page.route('https://open.douyin.com/player/video**', route => {
            route.fulfill({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Douyin player</title>' });
        });

        await page.goto(url);
        await page.waitForTimeout(1000);
        assert.equal(await page.evaluate(() => document.styleSheets.length), 4);
        assert.equal(await page.evaluate(() => typeof openAIPage === 'function' && typeof openPPTPage === 'function' && typeof openMediaPage === 'function'), true);

        await page.evaluate(() => openAIPage());
        await page.locator('.ai-video-trigger').first().click();
        assert.equal(await page.locator('#ai-video-frame-slot iframe').count(), 1);
        await page.evaluate(() => closeAIPage());
        assert.equal(await page.locator('#ai-video-modal').evaluate(el => el.classList.contains('is-open')), false);
        assert.equal(await page.locator('#ai-video-frame-slot iframe').count(), 0);

        for (const [openName, pageId, closeName] of [
            ['openAIPage', 'ai-portfolio-page', 'closeAIPage'],
            ['openPPTPage', 'ppt-portfolio-page', 'closePPTPage'],
            ['openMediaPage', 'media-portfolio-page', 'closeMediaPage']
        ]) {
            await page.evaluate(name => window[name](), openName);
            assert.equal(await page.locator(`#${pageId}`).evaluate(el => el.classList.contains('active')), true);
            await page.evaluate(name => window[name](), closeName);
            assert.equal(await page.locator(`#${pageId}`).evaluate(el => el.classList.contains('active')), false);
        }

        const brokenImages = await page.locator('img[src]').evaluateAll(async images => {
            images = images.filter(image => image.getAttribute('src'));
            images.forEach(image => { image.loading = 'eager'; });
            await Promise.all(images.map(image => image.decode().catch(() => null)));
            return images.filter(image => !image.complete || image.naturalWidth === 0).map(image => image.getAttribute('src'));
        });
        assert.deepEqual(brokenImages, []);
        assert.deepEqual(errors, []);
    } finally {
        await browser.close();
    }
});
