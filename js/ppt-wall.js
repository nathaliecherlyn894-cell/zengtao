document.addEventListener('DOMContentLoaded', () => {
const revealBtn = document.getElementById('reveal-canvas-btn');
        const dedicatedWrapper = document.getElementById('dedicated-infinite-wrapper');
        const pptPage = document.getElementById('ppt-portfolio-page');
        const canvasSection = document.getElementById('ppt-canvas-section');
        const canvasTitle = document.getElementById('ppt-canvas-title');

        if(revealBtn && dedicatedWrapper && canvasTitle && canvasSection) {
            revealBtn.addEventListener('click', () => {
                pptPage.scrollTo({ top: canvasSection.offsetTop, behavior: 'smooth' });
                canvasTitle.classList.add('fade-out');
                dedicatedWrapper.classList.add('active');
            });
        }


// ================= 核心重写：Infinite Canvas 类 =================
        class InfiniteCanvas {
            constructor(el) {
                this.wrapper = el;
                this.viewport = el.querySelector('.canvas-viewport');
                this.container = el.querySelector('.infinite-canvas-container');
                this.items = Array.from(el.querySelectorAll('.infinite-item'));
                if(this.items.length === 0) return;
                this.templates = this.items.map(item => item.cloneNode(true));

                el.__instance = this;
                this.currX = 0; this.currY = 0;
                this.targetX = 0; this.targetY = 0;
                this.isDragging = false;
                this.moved = false;
                this.startX = 0; this.startY = 0;
                this.dragStartX = 0; this.dragStartY = 0;

                this.interactTimeout = null;
                this.borderOverlay = el.querySelector('.drag-border-overlay');

                this.minScale = 0.75;
                this.mobileQuery = window.matchMedia('(max-width: 767px), (max-width: 1024px) and (pointer: coarse)');

                this.initGrid = this.initGrid.bind(this);
                this.render = this.render.bind(this);

                this.initGrid();
                this.resizeObserver = new ResizeObserver(this.initGrid);
                this.resizeObserver.observe(this.viewport);
                this.mobileQuery.addEventListener('change', this.initGrid);

                this.bindEvents();
                requestAnimationFrame(this.render);
                this.bindLightbox();
            }

            initGrid() {
                const width = this.viewport.clientWidth;
                const height = this.viewport.clientHeight;
                if (!width || !height) return;
                const oldStepX = this.itemW + this.gapX;
                const oldStepY = this.itemH + this.gapY;
                this.isMobile = this.mobileQuery.matches;
                this.gapX = this.isMobile ? 16 : 60;
                this.gapY = this.isMobile ? 24 : 80;
                this.itemW = this.isMobile ? (width - this.gapX) / 1.5 : Math.max(width / 3.5, height / 3 * 16 / 9);
                this.itemH = this.itemW * 9 / 16;
                const stepX = this.itemW + this.gapX;
                const stepY = this.itemH + this.gapY;

                // 以完整的 16 张作品为单元平铺，避免循环接缝处连续重复同一作品。
                const sourceCols = this.isMobile ? 2 : 4;
                const sourceRows = Math.ceil(this.templates.length / sourceCols);
                // 按最远缩放铺满，并在两侧各保留一格；仅在视野外回收副本。
                this.cols = Math.ceil((Math.ceil(width / this.minScale / stepX) + 2) / sourceCols) * sourceCols;
                this.rows = Math.ceil((Math.ceil(height / this.minScale / stepY) + 2) / sourceRows) * sourceRows;
                this.gridW = this.cols * stepX;
                this.gridH = this.rows * stepY;
                this.wrapLeft = -width * (1 / this.minScale - 1) / 2 - stepX;
                this.wrapTop = -height * (1 / this.minScale - 1) / 2 - stepY;

                const count = this.cols * this.rows;
                while (this.items.length < count) {
                    const item = this.templates[this.items.length % this.templates.length].cloneNode(true);
                    this.container.appendChild(item);
                    this.items.push(item);
                }
                while (this.items.length > count) this.items.pop().remove();
                this.items.forEach((item, index) => {
                    item.style.width = `${this.itemW}px`;
                    item.style.height = `${this.itemH}px`;
                    const col = index % this.cols;
                    const row = Math.floor(index / this.cols);
                    const source = this.templates[((row % sourceRows) * sourceCols + col % sourceCols) % this.templates.length];
                    const img = item.querySelector('img');
                    if (item.dataset.img !== source.dataset.img) {
                        item.dataset.img = source.dataset.img;
                        img.src = source.querySelector('img').src;
                        img.style.display = '';
                    }
                    // 副本即将进入视野时无需等待懒加载，浏览器会复用同一图片缓存。
                    img.loading = 'eager';
                });
                if (oldStepX && oldStepY) {
                    this.currX = this.targetX = this.targetX / oldStepX * stepX;
                    this.currY = this.targetY = this.targetY / oldStepY * stepY;
                }
                // 展示窗口随手机工具栏或横竖屏变化时，保持作品墙与页面顶部对齐。
                if (this.wrapper.classList.contains('active')) {
                    document.getElementById('ppt-portfolio-page').scrollTop = document.getElementById('ppt-canvas-section').offsetTop;
                }
            }

            render() {
                requestAnimationFrame(this.render);
                if (!this.wrapper.classList.contains('active') || !document.getElementById('ppt-portfolio-page').classList.contains('active')) return;
                this.currX += (this.targetX - this.currX) * 0.08;
                this.currY += (this.targetY - this.currY) * 0.08;

                this.items.forEach((item, i) => {
                    const col = i % this.cols;
                    const row = Math.floor(i / this.cols);

                    let rawX = col * (this.itemW + this.gapX);
                    let rawY = row * (this.itemH + this.gapY);

                    if (col % 2 !== 0) rawY += (this.itemH + this.gapY) / 2;

                    // 循环点始终位于最远缩放的视野之外，不搬走仍然可见的卡片。
                    const x = ((rawX + this.currX - this.wrapLeft) % this.gridW + this.gridW) % this.gridW + this.wrapLeft;
                    const y = ((rawY + this.currY - this.wrapTop) % this.gridH + this.gridH) % this.gridH + this.wrapTop;

                    item.style.transform = `translate3d(${x}px, ${y}px, 0)`;
                });
            }

            triggerInteract() {
                // 通过 class 统一控制 CSS 过渡时长，保证完美同步缩放与边框显现
                this.wrapper.classList.add('interacting');
                if(this.borderOverlay) this.borderOverlay.classList.add('active');

                clearTimeout(this.interactTimeout);
                this.interactTimeout = setTimeout(() => {
                    if (this.isDragging) return;
                    this.wrapper.classList.remove('interacting');
                    if(this.borderOverlay) this.borderOverlay.classList.remove('active');
                    if (this.isMobile) this.targetX = Math.round(this.targetX / (this.itemW + this.gapX)) * (this.itemW + this.gapX);
                }, 300);
            }

            bindEvents() {
                this.wrapper.addEventListener('pointerdown', (e) => {
                    if (!e.isPrimary || e.button !== 0) return;
                    this.pointerId = e.pointerId;
                    this.isDragging = true;
                    this.moved = false;
                    this.startX = e.clientX; this.startY = e.clientY;
                    this.targetX = this.currX; this.targetY = this.currY;
                    this.dragStartX = this.targetX; this.dragStartY = this.targetY;
                    this.pointerTarget = e.target;
                    this.pointerTarget.setPointerCapture(e.pointerId);
                    this.wrapper.style.cursor = 'grabbing';
                });
                this.wrapper.addEventListener('pointermove', (e) => {
                    if (!this.isDragging || e.pointerId !== this.pointerId) return;
                    const dx = e.clientX - this.startX;
                    const dy = e.clientY - this.startY;
                    if (!this.moved && Math.hypot(dx, dy) < 8) return;
                    this.moved = true;
                    const scale = new DOMMatrixReadOnly(getComputedStyle(this.container).transform).a;
                    this.triggerInteract();
                    this.targetX = this.dragStartX + dx / scale;
                    this.targetY = this.dragStartY + dy / scale;
                });
                const finishDrag = (e) => {
                    if (!this.isDragging || (e.pointerId !== undefined && e.pointerId !== this.pointerId)) return;
                    const pointerId = this.pointerId;
                    this.isDragging = false;
                    this.pointerId = null;
                    if (e.type !== 'pointerup') this.moved = true;
                    if (this.pointerTarget.hasPointerCapture(pointerId)) this.pointerTarget.releasePointerCapture(pointerId);
                    this.wrapper.style.cursor = 'grab';
                    if (this.moved) this.triggerInteract();
                };
                this.wrapper.addEventListener('pointerup', finishDrag);
                this.wrapper.addEventListener('pointercancel', finishDrag);
                this.wrapper.addEventListener('lostpointercapture', finishDrag);
                window.addEventListener('blur', finishDrag);

                this.wrapper.addEventListener('wheel', (e) => {
                    if (e.ctrlKey) return;
                    e.preventDefault();
                    const unit = e.deltaMode === 1 ? 16 : (e.deltaMode === 2 ? this.viewport.clientHeight : 1);
                    const scale = new DOMMatrixReadOnly(getComputedStyle(this.container).transform).a;
                    this.moved = true;
                    this.triggerInteract();
                    this.targetX -= e.deltaX * unit / scale;
                    this.targetY -= e.deltaY * unit / scale;
                }, {passive: false});
            }

            bindLightbox() {
                const lightbox = document.getElementById('ppt-lightbox');
                const lightboxImg = document.getElementById('ppt-lightbox-img');
                const lightboxClose = document.getElementById('lightbox-close');

                const pptPage = document.getElementById('ppt-portfolio-page');
                // 事件委托同时覆盖根据屏幕尺寸新增的循环副本。
                this.container.addEventListener('click', (e) => {
                    if (this.moved) return;
                    const item = e.target.closest('.infinite-item');
                    const img = item && item.querySelector('img');
                    if (!img || !img.complete || !img.naturalWidth) return;
                    lightboxImg.src = img.src;
                    lightbox.classList.add('active');
                    pptPage.inert = true;
                    lightboxClose.focus({preventScroll: true});
                });
                const close = () => {
                    lightbox.classList.remove('active');
                    pptPage.inert = false;
                    pptPage.querySelector('.btn-close-ppt').focus({preventScroll: true});
                };
                lightboxClose.addEventListener('click', close);
                lightbox.addEventListener('click', e => { if (e.target === lightbox) close(); });
                document.addEventListener('keydown', e => {
                    if (!lightbox.classList.contains('active')) return;
                    if (e.key === 'Escape') close();
                    if (e.key === 'Tab') { e.preventDefault(); lightboxClose.focus(); }
                });
            }
        }

        // 初始化所有的无限画布
        document.querySelectorAll('.infinite-canvas-wrapper.dedicated-canvas-wrapper').forEach(el => new InfiniteCanvas(el));
});
