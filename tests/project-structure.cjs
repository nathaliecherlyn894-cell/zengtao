const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const root = path.resolve(__dirname, '..');
const index = fs.readFileSync(path.join(root, 'index.html'), 'utf8');

const expectedStyles = [
    'css/base.css',
    'css/ai-portfolio.css',
    'css/ppt-portfolio.css',
    'css/media-portfolio.css'
];

const expectedScripts = [
    'js/main.js',
    'js/home.js',
    'js/ai-portfolio.js',
    'js/media-portfolio.js',
    'js/ppt-wall.js'
];

test('index.html 只负责页面结构并按顺序引用样式和脚本', () => {
    assert.doesNotMatch(index, /<style[\s>]/i);
    assert.doesNotMatch(index, /<script>(?!\s*<\/script>)/i);

    let previous = -1;
    for (const file of expectedStyles) {
        const position = index.indexOf(`href="${file}"`);
        assert.ok(position > previous, `${file} 存在且顺序正确`);
        previous = position;
    }

    previous = -1;
    for (const file of expectedScripts) {
        const position = index.indexOf(`src="${file}"`);
        assert.ok(position > previous, `${file} 存在且顺序正确`);
        previous = position;
    }
});

test('外部样式和脚本文件存在且不为空', () => {
    for (const file of [...expectedStyles, ...expectedScripts]) {
        const target = path.join(root, file);
        assert.ok(fs.existsSync(target), `${file} 应存在`);
        assert.ok(fs.statSync(target).size > 50, `${file} 不应为空`);
    }
});

test('页面引用的本地资源全部存在，图片不再散落在根目录', () => {
    const htmlRefs = [...index.matchAll(/(?:src|href|data-hover-img)="([^"#]+)"/g)]
        .map(match => ({ ref: match[1], base: root }));
    const cssRefs = expectedStyles.flatMap(file => {
        const filePath = path.join(root, file);
        const css = fs.readFileSync(filePath, 'utf8');
        return [...css.matchAll(/url\(['"]?([^)'"#]+)["']?\)/g)]
            .map(match => ({ ref: match[1], base: path.dirname(filePath) }));
    });

    for (const { ref, base } of [...htmlRefs, ...cssRefs]) {
        if (/^(?:https?:|data:|mailto:|tel:|javascript:)/.test(ref)) continue;
        const clean = decodeURIComponent(ref.split('?')[0]);
        assert.ok(fs.existsSync(path.resolve(base, clean)), `缺少资源：${clean}`);
    }

    const rootImages = fs.readdirSync(root).filter(name => /\.(?:jpe?g|png|webp)$/i.test(name));
    assert.deepEqual(rootImages, []);
});
