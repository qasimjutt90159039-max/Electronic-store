// Navigation mobile toggle handler for all pages
document.addEventListener('DOMContentLoaded', () => {
    const menuToggle = document.getElementById('menuToggle');
    const navLower = document.querySelector('.nav-lower');

    if (menuToggle && navLower) {
        menuToggle.addEventListener('click', (e) => {
            e.stopPropagation();
            menuToggle.classList.toggle('active');
            navLower.classList.toggle('active');
        });

        // Close menu when clicking anywhere outside
        document.addEventListener('click', (e) => {
            if (!navLower.contains(e.target) && !menuToggle.contains(e.target)) {
                menuToggle.classList.remove('active');
                navLower.classList.remove('active');
            }
        });

        // Close menu when clicking on any nav link
        const navLinks = navLower.querySelectorAll('a');
        navLinks.forEach(link => {
            link.addEventListener('click', () => {
                menuToggle.classList.remove('active');
                navLower.classList.remove('active');
            });
        });
    }
});
