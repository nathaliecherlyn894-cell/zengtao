function openAIPage() {
        const page = document.getElementById('ai-portfolio-page');
        page.scrollTop = 0;
        page.classList.add('active');
        document.body.style.overflow = 'hidden';
        page.querySelectorAll('.ai-fade-in').forEach(el => el.classList.remove('visible'));
    }

    function closeAIPage() {
        if (typeof window.closeAIVideoModal === 'function') {
            window.closeAIVideoModal({ returnFocus: false });
        }
        const page = document.getElementById('ai-portfolio-page');
        page.classList.remove('active');
        document.body.style.overflow = '';
    }

    function openPPTPage() {
        const page = document.getElementById('ppt-portfolio-page');
        page.scrollTop = 0;
        page.classList.add('active');
        document.body.style.overflow = 'hidden';
        document.querySelectorAll('.infinite-canvas-wrapper.dedicated-canvas-wrapper').forEach(el => {
            if(el.__instance) el.__instance.initGrid();
        });
    }

    function closePPTPage() {
        const page = document.getElementById('ppt-portfolio-page');
        page.classList.remove('active');
        document.body.style.overflow = '';

        const sliderWrapper = document.getElementById('dedicated-infinite-wrapper');
        const canvasTitle = document.getElementById('ppt-canvas-title');
        setTimeout(() => {
            if(sliderWrapper) sliderWrapper.classList.remove('active');
            if(canvasTitle) canvasTitle.classList.remove('fade-out');
        }, 500);
    }

    function openMediaPage() {
        const page = document.getElementById('media-portfolio-page');
        page.scrollTop = 0;
        page.classList.add('active');
        document.body.style.overflow = 'hidden';
        page.querySelectorAll('.media-fade-in').forEach(el => el.classList.remove('visible'));

        const rig = document.getElementById('media-projector-rig');
        if (rig) {
            rig.classList.remove('projector-stable');
            rig.classList.add('projector-broken');
            if(window.mediaProjectorTimeout) clearTimeout(window.mediaProjectorTimeout);

            window.mediaProjectorTimeout = setTimeout(() => {
                if (page.classList.contains('active')) {
                    rig.classList.remove('projector-broken');
                    rig.classList.add('projector-stable');
                }
            }, 3000);
        }
    }

    function closeMediaPage() {
        const page = document.getElementById('media-portfolio-page');
        page.classList.remove('active');
        document.body.style.overflow = '';
    }
