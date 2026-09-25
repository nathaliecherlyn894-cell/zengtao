document.addEventListener('DOMContentLoaded', () => {
    const audio = document.getElementById('site-music');
    const button = document.getElementById('music-toggle');
    const label = button.querySelector('.music-label');
    const tracks = {
        home: 'assets/music/home-carefree.mp3',
        ai: 'assets/music/ai-bit-quest.mp3',
        media: 'assets/music/media-funk-game-loop.mp3',
        ppt: 'assets/music/ppt-wallpaper.mp3'
    };
    const pages = ['ai', 'media', 'ppt'].map(section => ({ section, element: document.getElementById(`${section}-portfolio-page`) }));
    const videoModal = document.getElementById('ai-video-modal');
    const storageKey = 'zengtao-music-enabled';
    let enabled = true;
    let revision = 0;
    try { enabled = sessionStorage.getItem(storageKey) !== 'off'; } catch { /* 隐私模式仍可操作音乐。 */ }

    function render() {
        const text = enabled ? '关闭音乐' : '开启音乐';
        label.textContent = text;
        button.setAttribute('aria-label', text);
        button.setAttribute('aria-pressed', String(enabled));
        button.dataset.state = enabled ? (audio.paused ? 'paused' : 'playing') : 'off';
        button.title = enabled && !videoModal.hidden ? '观看视频期间，背景音乐已暂停' : text;
    }

    function fade(target, duration, ticket) {
        const start = performance.now();
        const from = audio.volume;
        return new Promise(resolve => {
            function step(now) {
                if (ticket !== revision) { resolve(false); return; }
                const progress = Math.min((now - start) / duration, 1);
                audio.volume = from + (target - from) * progress;
                if (progress < 1) requestAnimationFrame(step);
                else resolve(true);
            }
            requestAnimationFrame(step);
        });
    }

    async function sync() {
        const ticket = ++revision;
        const section = pages.find(page => page.element.classList.contains('active'))?.section || 'home';
        button.dataset.section = section;
        if (!enabled || document.hidden || !videoModal.hidden) {
            audio.pause();
            audio.volume = 0.02;
            render();
            return;
        }

        const changed = audio.dataset.section !== section;
        if (changed && !audio.paused && !await fade(0.02, 400, ticket)) return;
        if (ticket !== revision) return;
        if (changed) {
            audio.pause();
            audio.src = tracks[section];
            audio.dataset.section = section;
        } else if (audio.error) {
            audio.load();
        }
        // 音量保持非零，让浏览器正常判断有声自动播放权限。
        if (audio.paused) audio.volume = 0.02;
        render();
        try {
            await audio.play();
            if (ticket !== revision) return;
            render();
            await fade(0.45, 650, ticket);
        } catch {
            if (ticket !== revision) return;
            // 自动播放被拒绝或资源失败时，仅回到小按钮，不显示弹窗。
            enabled = false;
            audio.pause();
            render();
        }
    }

    button.addEventListener('click', () => {
        enabled = !enabled;
        try { sessionStorage.setItem(storageKey, enabled ? 'on' : 'off'); } catch { /* 不依赖存储权限。 */ }
        sync();
    });
    audio.addEventListener('error', () => {
        ++revision;
        enabled = false;
        audio.pause();
        render();
    });

    // 只观察页面开关和播放器开关，不监听拖拽、滚动或鼠标动画。
    const observer = new MutationObserver(() => { sync(); });
    pages.forEach(page => observer.observe(page.element, { attributes: true, attributeFilter: ['class'] }));
    observer.observe(videoModal, { attributes: true, attributeFilter: ['hidden'] });
    document.addEventListener('visibilitychange', () => { sync(); });
    window.addEventListener('pagehide', () => { ++revision; audio.pause(); });
    window.addEventListener('pageshow', event => { if (event.persisted) sync(); });

    button.hidden = false;
    render();
    sync();
});
