document.addEventListener('DOMContentLoaded', () => {

        const wrapper = document.getElementById('pin-wrapper');
        const stickyEl = document.getElementById('pin-sticky');
        const track = document.getElementById('skills-track');
        const panLayers = document.querySelectorAll('.panorama-layer');
        const suns = document.querySelectorAll('.sun-element');
        const ambients = document.querySelectorAll('.ambient-overlay');
        const sceneBgs = document.querySelectorAll('.scene-bg');

        const blockTitles = document.querySelectorAll('.block-title');
        const titleIcons = document.querySelectorAll('.title-icon');


function syncPanorama() {
            if (!track || panLayers.length === 0) return;
            const trackWidth = track.scrollWidth;
            panLayers.forEach(layer => {
                const block = layer.parentElement;
                const offsetLeft = block.offsetLeft;
                layer.style.width = `${trackWidth}px`;
                layer.style.transform = `translateX(-${offsetLeft}px)`;
            });
        }

        const sunriseAmb = [255, 180, 140, 0.5];
        const noonAmb    = [0, 160, 255, 0.4];
        const sunsetAmb  = [255, 90, 0, 0.6];
        const sunriseSun = [255, 235, 180];
        const noonSun    = [255, 255, 255];
        const sunsetSun  = [255, 180, 0];
        const sunriseText = [255, 255, 255];
        const noonText    = [17, 17, 17];
        const sunsetText  = [255, 255, 255];

        function getBlendedColor(cStart, cMid, cEnd, prog, hasAlpha = true, alphaMultiplier = 1) {
            let start, end, p;
            if (prog < 0.5) { start = cStart; end = cMid; p = prog * 2; }
            else { start = cMid; end = cEnd; p = (prog - 0.5) * 2; }

            const r = Math.round(start[0] + (end[0] - start[0]) * p);
            const g = Math.round(start[1] + (end[1] - start[1]) * p);
            const b = Math.round(start[2] + (end[2] - start[2]) * p);

            if (hasAlpha) {
                let a = (start[3] + (end[3] - start[3]) * p) * alphaMultiplier;
                return `rgba(${r},${g},${b},${Math.min(1, Math.max(0, a)).toFixed(2)})`;
            }
            return `rgb(${r},${g},${b})`;
        }

        function updateScroll() {
            if (!wrapper || !stickyEl || !track) return;
            if (track.scrollWidth <= stickyEl.offsetWidth) {
                wrapper.style.height = 'auto'; track.style.transform = `translateX(0px)`; return;
            } else { wrapper.style.height = '250vh'; }

            const rect = wrapper.getBoundingClientRect();
            const stickyTop = window.innerHeight * 0.05;
            let scrolledPx = Math.max(0, stickyTop - rect.top);
            let progress = Math.max(0, Math.min(1, scrolledPx / (wrapper.offsetHeight - stickyEl.offsetHeight)));
            track.style.transform = `translateX(-${progress * (track.scrollWidth - stickyEl.offsetWidth)}px)`;

            const sunX = 10 + (progress * 80);
            const sunY = 95 - Math.sin(progress * Math.PI) * 70;
            let sunOpacity = progress <= 0.25 ? progress / 0.25 : (progress >= 0.75 ? (1 - progress) / 0.25 : 1);

            const currentBrightness = 0.4 + Math.sin(progress * Math.PI) * 0.6;
            const ambColor = getBlendedColor(sunriseAmb, noonAmb, sunsetAmb, progress, true, 1.3);
            const sunColor = getBlendedColor(sunriseSun, noonSun, sunsetSun, progress, false);
            const textColor = getBlendedColor(sunriseText, noonText, sunsetText, progress, false);
            const sunGlow = `0 0 40px 15px ${sunColor.replace('rgb', 'rgba').replace(')', ', 0.7)')}`;

            suns.forEach(sun => {
                sun.style.left = `${sunX}%`; sun.style.top = `${sunY}%`;
                sun.style.backgroundColor = sunColor; sun.style.boxShadow = sunGlow; sun.style.opacity = sunOpacity;
            });
            ambients.forEach(amb => amb.style.backgroundColor = ambColor);
            sceneBgs.forEach(bg => bg.style.filter = `brightness(${currentBrightness})`);
            blockTitles.forEach(title => title.style.color = textColor);
            titleIcons.forEach(icon => icon.style.fill = textColor);
        }


const observerOptions = { root: null, rootMargin: '0px', threshold: 0.15 };
        const observer = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) { entry.target.classList.add('visible'); observer.unobserve(entry.target); }
            });
        }, observerOptions);
        document.querySelectorAll('.fade-in-up').forEach(el => observer.observe(el));


// ===== 悬浮图片跟随系统 =====
        const cursorFollower = document.createElement('div');
        cursorFollower.className = 'cursor-follower';
        cursorFollower.innerHTML = `
            <img src="" onerror="this.style.display='none'">
            <span class="follower-placeholder"></span>
        `;
        document.body.appendChild(cursorFollower);

        let mouseX = window.innerWidth / 2;
        let mouseY = window.innerHeight / 2;
        let followerX = mouseX;
        let followerY = mouseY;

        window.addEventListener('mousemove', (e) => {
            mouseX = e.clientX;
            mouseY = e.clientY;
        });

        function animateFollower() {
            followerX += (mouseX - followerX) * 0.15;
            followerY += (mouseY - followerY) * 0.15;
            cursorFollower.style.left = `${followerX}px`;
            cursorFollower.style.top = `${followerY}px`;
            requestAnimationFrame(animateFollower);
        }
        animateFollower();

        let followerHideTimeout;
        const dpItemsList = document.querySelectorAll('.dp-item');
        dpItemsList.forEach(item => {
            item.addEventListener('mouseenter', () => {
                clearTimeout(followerHideTimeout);
                const targetImg = item.getAttribute('data-hover-img');
                const imgEl = cursorFollower.querySelector('img');
                const spanEl = cursorFollower.querySelector('.follower-placeholder');

                if(imgEl.getAttribute('src') !== targetImg) {
                    imgEl.style.animation = 'none';
                    void imgEl.offsetWidth; // trigger reflow
                    imgEl.src = targetImg;
                    spanEl.textContent = targetImg;
                    imgEl.style.display = 'block';
                    imgEl.style.animation = 'followerImgSpin 0.5s cubic-bezier(0.2, 0.8, 0.2, 1) forwards';
                }

                cursorFollower.classList.add('active');
            });
            item.addEventListener('mouseleave', () => {
                followerHideTimeout = setTimeout(() => {
                    cursorFollower.classList.remove('active');
                }, 50);
            });
        });


        // ================= 核心重构：主页 椭圆 2D 堆叠轮播系统 =================
        const ellItems = Array.from(document.querySelectorAll('.elliptical-item'));
        let currEllIdx = 0;
        const totalEll = ellItems.length;

        window.moveElliptical = function(dir) {
            currEllIdx = (currEllIdx + dir + totalEll) % totalEll;
            updateElliptical();
        };

        function updateElliptical() {
            if(ellItems.length === 0) return;
            const isMobile = window.innerWidth < 768;
            const xOff1 = isMobile ? 18 : 22;
            const xOff2 = isMobile ? 32 : 40;

            ellItems.forEach((item, index) => {
                let offset = index - currEllIdx;
                if (offset < -Math.floor(totalEll/2)) offset += totalEll;
                if (offset > Math.floor(totalEll/2)) offset -= totalEll;

                item.className = 'elliptical-item';

                if (Math.abs(offset) <= 2) {
                    let scale = 1;
                    let xTranslate = 0;
                    let zIndex = 10;
                    let brightness = 1;

                    if (offset === 0) {
                        scale = 1; xTranslate = 0; zIndex = 10; brightness = 1;
                        item.classList.add('active');
                    } else if (Math.abs(offset) === 1) {
                        scale = 0.85; xTranslate = Math.sign(offset) * xOff1; zIndex = 9; brightness = 0.5;
                    } else if (Math.abs(offset) === 2) {
                        scale = 0.7; xTranslate = Math.sign(offset) * xOff2; zIndex = 8; brightness = 0.2;
                    }

                    item.style.transform = `translate(calc(-50% + ${xTranslate}vw), -50%) scale(${scale})`;
                    item.style.zIndex = zIndex;
                    item.style.opacity = 1;
                    item.style.filter = `brightness(${brightness})`;
                    item.style.pointerEvents = 'auto';

                } else {
                    item.style.transform = `translate(-50%, -50%) scale(0.5)`;
                    item.style.zIndex = 1;
                    item.style.opacity = 0;
                    item.style.pointerEvents = 'none';
                }
            });
        }

        if(ellItems.length > 0) {
            updateElliptical();

            const btnPrev = document.querySelector('.ell-prev');
            const btnNext = document.querySelector('.ell-next');

            if (btnPrev) {
                btnPrev.addEventListener('click', () => {
                    currEllIdx = (currEllIdx - 1 + totalEll) % totalEll;
                    updateElliptical();
                });
            }
            if (btnNext) {
                btnNext.addEventListener('click', () => {
                    currEllIdx = (currEllIdx + 1 + totalEll) % totalEll;
                    updateElliptical();
                });
            }

            ellItems.forEach((item, index) => {
                item.addEventListener('click', () => {
                    openPPTPage();
                });
            });
        }



window.addEventListener('scroll', updateScroll);
        window.addEventListener('resize', () => {
            syncPanorama();
            updateScroll();
            if(typeof updateElliptical === 'function') updateElliptical();
        });
        window.addEventListener('load', () => { syncPanorama(); updateScroll(); });

        syncPanorama();
        updateScroll();
});
