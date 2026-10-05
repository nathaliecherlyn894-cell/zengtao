// 进入页面尝试有声播放；浏览器拦截时由第一次真实交互接续。
(() => {
    const button = document.querySelector('#music-toggle');
    const audio = document.querySelector('#library-audio');
    audio.volume = .9;
    let awaitingGesture = true;

    function label(text) {
        button.setAttribute('aria-label', text);
        button.title = text;
    }

    function start() {
        return audio.play().then(() => { awaitingGesture = false; sync(); }).catch(error => {
            if (error.name === 'NotAllowedError') {
                awaitingGesture = true;
                sync();
                label('点击开启配乐');
            } else if (error.name !== 'AbortError') failed();
        });
    }

    function sync() {
        const playing = !audio.paused;
        button.setAttribute('aria-pressed', String(playing));
        label(playing ? '暂停配乐' : '播放配乐');
    }
    function failed() {
        sync();
        label('配乐未能播放，点击重试');
    }
    button.addEventListener('click', () => {
        if (audio.paused) {
            if (audio.error) audio.load();
            start();
        } else {
            awaitingGesture = false;
            audio.pause();
        }
    });
    function unlock(event) {
        if (!awaitingGesture || event.target.closest?.('#music-toggle')) return;
        start();
    }
    document.addEventListener('pointerdown', unlock);
    document.addEventListener('keydown', unlock);
    audio.addEventListener('play', sync);
    audio.addEventListener('pause', sync);
    audio.addEventListener('error', failed);
    window.addEventListener('pagehide', () => { awaitingGesture = false; audio.pause(); });
    start();
})();
