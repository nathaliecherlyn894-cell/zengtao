document.addEventListener('DOMContentLoaded', () => {
const matrixCanvas = document.getElementById('matrix-canvas');
        if (matrixCanvas) {
            const mCtx = matrixCanvas.getContext('2d');
            let mWidth, mHeight;
            let mColumns, mDrops = [];
            const mChars = '01'.split('');
            const mFontSize = 18;

            function initMatrix() {
                mWidth = matrixCanvas.width = window.innerWidth;
                mHeight = matrixCanvas.height = window.innerHeight;
                mColumns = Math.floor(mWidth / mFontSize);
                mDrops = [];
                for (let x = 0; x < mColumns; x++) {
                    mDrops[x] = Math.random() * -100;
                }
            }
            initMatrix();
            window.addEventListener('resize', initMatrix);

            function drawMatrix() {
                mCtx.fillStyle = 'rgba(5, 5, 5, 0.05)';
                mCtx.fillRect(0, 0, mWidth, mHeight);
                mCtx.fillStyle = '#39ff14';
                mCtx.font = 'bold ' + mFontSize + 'px monospace';

                for (let i = 0; i < mDrops.length; i++) {
                    const text = mChars[Math.floor(Math.random() * mChars.length)];
                    mCtx.globalAlpha = Math.random() * 0.5 + 0.5;
                    mCtx.fillText(text, i * mFontSize, mDrops[i] * mFontSize);

                    if (mDrops[i] * mFontSize > mHeight && Math.random() > 0.975) {
                        mDrops[i] = 0;
                    }
                    mDrops[i] += 0.8;
                }
                mCtx.globalAlpha = 1;
                requestAnimationFrame(drawMatrix);
            }
            drawMatrix();
        }


const aiOverlay = document.getElementById('ai-portfolio-page');
        const aiObserver = new IntersectionObserver((entries) => { entries.forEach(entry => { if(entry.isIntersecting) entry.target.classList.add('visible'); }); }, { root: aiOverlay, threshold: 0.15 });
        document.querySelectorAll('.ai-fade-in').forEach(el => aiObserver.observe(el));

        const videoModal = document.getElementById('ai-video-modal');
        const frameSlot = document.getElementById('ai-video-frame-slot');
        const modalTitle = document.getElementById('ai-video-modal-title');
        const modalStatus = document.getElementById('ai-video-status');
        const modalDouyinLink = document.getElementById('ai-video-douyin-link');
        const modalCloseButton = videoModal?.querySelector('.ai-video-close');
        let lastVideoTrigger = null;
        let previousOverlayOverflow = '';
        let playerLoadTimer = null;

        window.openAIVideoModal = function(trigger) {
            if (!videoModal || !frameSlot || !trigger) return;
            const { videoId, videoTitle, douyinUrl } = trigger.dataset;
            if (!videoId || !videoTitle || !douyinUrl) return;

            lastVideoTrigger = trigger;
            clearTimeout(playerLoadTimer);
            frameSlot.replaceChildren();

            const iframe = document.createElement('iframe');
            iframe.src = `https://open.douyin.com/player/video?vid=${encodeURIComponent(videoId)}&autoplay=0`;
            iframe.title = `${videoTitle} 抖音播放器`;
            iframe.allow = 'fullscreen; picture-in-picture';
            iframe.allowFullscreen = true;
            iframe.referrerPolicy = 'unsafe-url';
            iframe.addEventListener('load', () => {
                clearTimeout(playerLoadTimer);
                modalStatus.textContent = '视频已加载。若当前浏览器限制播放，可以前往抖音观看。';
            }, { once: true });

            modalTitle.textContent = videoTitle;
            modalStatus.textContent = '播放器加载中。若播放受限，可以前往抖音观看。';
            modalDouyinLink.href = douyinUrl;
            frameSlot.appendChild(iframe);

            videoModal.hidden = false;
            videoModal.setAttribute('aria-hidden', 'false');
            videoModal.classList.add('is-open');
            previousOverlayOverflow = aiOverlay?.style.overflowY || '';
            if (aiOverlay) aiOverlay.style.overflowY = 'hidden';
            modalCloseButton?.focus({ preventScroll: true });

            playerLoadTimer = setTimeout(() => {
                modalStatus.textContent = '播放器暂未响应，请点击“去抖音观看”。';
            }, 8000);
        };

        window.closeAIVideoModal = function({ returnFocus = true } = {}) {
            if (!videoModal || videoModal.hidden) return;
            clearTimeout(playerLoadTimer);
            frameSlot?.replaceChildren();
            videoModal.classList.remove('is-open');
            videoModal.setAttribute('aria-hidden', 'true');
            videoModal.hidden = true;
            if (aiOverlay) aiOverlay.style.overflowY = previousOverlayOverflow;
            if (returnFocus && lastVideoTrigger) lastVideoTrigger.focus({ preventScroll: true });
        };

        document.querySelectorAll('.ai-video-trigger').forEach(trigger => {
            trigger.addEventListener('click', () => window.openAIVideoModal(trigger));
        });

        videoModal?.querySelectorAll('[data-ai-video-close]').forEach(control => {
            control.addEventListener('click', () => window.closeAIVideoModal());
        });

        document.addEventListener('keydown', event => {
            if (event.key === 'Escape' && videoModal && !videoModal.hidden) {
                window.closeAIVideoModal();
            }
        });
});
