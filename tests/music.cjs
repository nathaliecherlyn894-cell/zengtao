const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const { chromium } = require('playwright');

const root = path.resolve(__dirname, '..');
let server, url;
before(async () => {
    server = http.createServer((req, res) => {
        const file = path.join(root, decodeURIComponent(req.url.split('?')[0] === '/' ? '/index.html' : req.url.split('?')[0]));
        if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { res.writeHead(404).end(); return; }
        const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.mp3': 'audio/mpeg' };
        res.setHeader('Content-Type', types[path.extname(file)] || 'application/octet-stream');
        fs.createReadStream(file).pipe(res);
    });
    await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
    url = `http://127.0.0.1:${server.address().port}/`;
});
after(() => new Promise(resolve => server.close(resolve)));

async function visit(run, { blocked = false, viewport = { width: 1440, height: 900 }, failAudio = false } = {}) {
    const browser = await chromium.launch({ headless: true, executablePath: process.env.CHROMIUM_EXECUTABLE || undefined,
        args: ['--autoplay-policy=no-user-gesture-required'] });
    try {
        const page = await browser.newPage({ viewport });
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        if (blocked) await page.addInitScript(() => {
            const realPlay = HTMLMediaElement.prototype.play;
            HTMLMediaElement.prototype.play = function() {
                if (!navigator.userActivation.hasBeenActive) return Promise.reject(new DOMException('Autoplay blocked', 'NotAllowedError'));
                return realPlay.call(this);
            };
        });
        if (failAudio) await page.route('**/assets/music/*.mp3', route => route.fulfill({ status: 404, body: '' }));
        await page.route('https://open.douyin.com/player/video**', route => route.fulfill({ contentType: 'text/html', body: '<title>视频占位</title>' }));
        await page.goto(url);
        await run(page);
        assert.deepEqual(errors, []);
    } finally { await browser.close(); }
}

async function playing(page, section) {
    await page.waitForFunction(section => {
        const audio = document.getElementById('site-music');
        return audio && audio.dataset.section === section && !audio.paused && audio.currentTime > 0.1 && audio.volume > 0;
    }, section);
}

test('允许自动播放时实际解码音频，切换板块、快速往返与视频暂停恢复正确', async () => {
    await visit(async page => {
        await playing(page, 'home');
        assert.equal(await page.locator('#music-toggle').getAttribute('aria-label'), '关闭音乐');
        for (const [open, section] of [['openAIPage', 'ai'], ['openMediaPage', 'media'], ['openPPTPage', 'ppt']]) {
            await page.evaluate(open => { closeAIPage(); closeMediaPage(); closePPTPage(); window[open](); }, open);
            await playing(page, section);
        }
        await page.evaluate(() => { closePPTPage(); openAIPage(); closeAIPage(); openMediaPage(); closeMediaPage(); openAIPage(); });
        await playing(page, 'ai');
        await page.locator('.ai-video-trigger').first().click();
        await page.waitForFunction(() => document.getElementById('site-music').paused);
        await page.keyboard.press('Escape');
        await playing(page, 'ai');
        await page.locator('#music-toggle').click();
        await page.locator('.ai-video-trigger').first().click();
        await page.keyboard.press('Escape');
        await page.waitForTimeout(1100);
        assert.equal(await page.locator('#site-music').evaluate(audio => audio.paused), true);
        await page.reload();
        await page.waitForTimeout(500);
        assert.equal(await page.locator('#site-music').evaluate(audio => audio.paused), true);
        assert.equal(await page.locator('#music-toggle').getAttribute('aria-label'), '开启音乐');
    });
});

test('自动播放被拦截只保留小按钮，手机点击可播放，主动关闭后切页不重启', async () => {
    await visit(async page => {
        const button = page.locator('#music-toggle');
        await page.waitForFunction(() => document.getElementById('music-toggle')?.dataset.state === 'off');
        assert.equal(await button.getAttribute('aria-label'), '开启音乐');
        assert.equal(await page.locator('#site-music').evaluate(audio => audio.paused), true);
        await button.click();
        await playing(page, 'home');
        const print = await page.locator('.btn-print').boundingBox();
        const music = await button.boundingBox();
        assert.ok(music.x >= 0 && music.x + music.width <= 390 && music.y >= 0 && music.height >= 44);
        assert.ok(music.x + music.width <= print.x || print.x + print.width <= music.x || music.y + music.height <= print.y || print.y + print.height <= music.y);
        await button.click();
        await page.evaluate(() => openPPTPage());
        await page.waitForTimeout(1200);
        assert.equal(await page.locator('#site-music').evaluate(audio => audio.paused), true);
        const pptMusic = await button.boundingBox();
        assert.ok(pptMusic.x + pptMusic.width <= 390 - 26 && pptMusic.y >= 26);
        assert.equal(await page.evaluate(() => document.documentElement.scrollWidth > innerWidth), false);
    }, { blocked: true, viewport: { width: 390, height: 844 } });
});

test('标签页隐藏暂停，恢复可续播；加载失败仍可正常打开作品页', async () => {
    await visit(async page => {
        await playing(page, 'home');
        await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: true }); document.dispatchEvent(new Event('visibilitychange')); });
        assert.equal(await page.locator('#site-music').evaluate(audio => audio.paused), true);
        await page.evaluate(() => { Object.defineProperty(document, 'hidden', { configurable: true, value: false }); document.dispatchEvent(new Event('visibilitychange')); });
        await playing(page, 'home');
    });
    await visit(async page => {
        await page.waitForFunction(() => document.getElementById('site-music')?.error && document.getElementById('music-toggle')?.dataset.state === 'off');
        await page.evaluate(() => openMediaPage());
        assert.equal(await page.locator('#media-portfolio-page').evaluate(el => el.classList.contains('active')), true);
        assert.equal(await page.locator('#music-toggle').getAttribute('aria-label'), '开启音乐');
    }, { failAudio: true });
});
