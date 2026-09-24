document.addEventListener('DOMContentLoaded', () => {
const mediaOverlay = document.getElementById('media-portfolio-page');
        const mediaObserver = new IntersectionObserver((entries) => { entries.forEach(entry => { if(entry.isIntersecting) entry.target.classList.add('visible'); }); }, { root: mediaOverlay, threshold: 0.15 });
        document.querySelectorAll('.media-fade-in').forEach(el => mediaObserver.observe(el));
});
