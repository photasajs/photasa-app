/**
 * Enhanced Animated Splash Screen Controller
 * Features dynamic language switching with smooth animations
 */
class SplashController {
    constructor() {
        this.statusElement = document.querySelector(".status-text");
        this.progressElement = document.querySelector(".progress-fill");
        this.versionElement = document.querySelector(".version-text");
        this.appNameElement = document.querySelector(".app-name");
        this.appSubtitleElement = document.querySelector(".app-subtitle");

        this.currentTheme = "light";
        this.isProgressDeterminate = false;

        // Multi-language product names with localized branding
        this.productNames = [
            { text: "Photasa", lang: "en", subtitle: "Photo Management" },
            { text: "仓廪图司", lang: "zh-CN", subtitle: "照片管理" },
            { text: "倉廩圖司", lang: "zh-TW", subtitle: "照片管理" },
            { text: "倉廩図司", lang: "ja", subtitle: "写真管理" },
            { text: "倉廩圖司", lang: "ko", subtitle: "사진 관리" },
            { text: "Photasa", lang: "fr", subtitle: "Gestion de Photos" },
            { text: "Photasa", lang: "de", subtitle: "Fotoverwaltung" },
            { text: "Photasa", lang: "es", subtitle: "Gestión de Fotos" },
            { text: "Photasa", lang: "pt", subtitle: "Gestão de Fotos" },
            { text: "Photasa", lang: "ru", subtitle: "Управление Фото" },
            { text: "Photasa", lang: "ar", subtitle: "إدارة الصور" },
            { text: "Photasa", lang: "hi", subtitle: "फ़ोटो प्रबंधन" },
        ];

        this.currentNameIndex = 0;
        this.animationInterval = null;
        this.isAnimating = false;
        this.animationSpeed = 3000; // 3 seconds per language

        this.init();
    }

    /**
     * Initialize the splash screen controller
     */
    init() {
        this.setupEventListeners();
        this.detectSystemTheme();
        this.updateVersion();
        this.startLanguageAnimation();

        // Set initial language
        this.setProductName(0, false);

        // Smooth fade-in
        setTimeout(() => {
            document.body.style.opacity = "1";
        }, 100);
    }

    /**
     * Start the animated language switching
     */
    startLanguageAnimation() {
        if (this.shouldReduceMotion()) {
            // For users who prefer reduced motion, show a random language without animation
            this.currentNameIndex = Math.floor(Math.random() * this.productNames.length);
            this.setProductName(this.currentNameIndex, false);
            return;
        }

        // Start with a random language
        this.currentNameIndex = Math.floor(Math.random() * this.productNames.length);
        this.setProductName(this.currentNameIndex, false);

        // Begin cycling through languages
        this.animationInterval = setInterval(() => {
            this.cycleToNextLanguage();
        }, this.animationSpeed);
    }

    /**
     * Cycle to the next language with animation
     */
    cycleToNextLanguage() {
        if (this.isAnimating) return;

        this.currentNameIndex = (this.currentNameIndex + 1) % this.productNames.length;
        this.setProductName(this.currentNameIndex, true);
    }

    /**
     * Set product name with optional animation
     */
    setProductName(index, animate = true) {
        const nameData = this.productNames[index];

        if (animate && !this.shouldReduceMotion()) {
            this.animateNameChange(nameData);
        } else {
            this.updateNameElements(nameData);
        }
    }

    /**
     * Animate name change with smooth transitions
     */
    animateNameChange(nameData) {
        this.isAnimating = true;

        // Add exit animation classes
        this.appNameElement.classList.add("changing");
        this.appSubtitleElement.classList.add("changing");

        // Wait for exit animation, then update content and animate in
        setTimeout(() => {
            this.updateNameElements(nameData);

            // Remove exit classes and add entrance classes
            this.appNameElement.classList.remove("changing");
            this.appSubtitleElement.classList.remove("changing");

            this.appNameElement.classList.add("changing-in");
            this.appSubtitleElement.classList.add("changing-in");

            // Clean up entrance classes
            setTimeout(() => {
                this.appNameElement.classList.remove("changing-in");
                this.appSubtitleElement.classList.remove("changing-in");
                this.isAnimating = false;
            }, 300);
        }, 300);
    }

    /**
     * Update name elements with new language data
     */
    updateNameElements(nameData) {
        if (this.appNameElement) {
            this.appNameElement.textContent = nameData.text;
            this.appNameElement.setAttribute("data-lang", nameData.lang);
        }

        if (this.appSubtitleElement) {
            this.appSubtitleElement.textContent = nameData.subtitle;
            this.appSubtitleElement.setAttribute("data-lang", nameData.lang);
        }

        console.log(`Splash language: ${nameData.lang} - ${nameData.text}`);
    }

    /**
     * Setup event listeners for IPC communication
     */
    setupEventListeners() {
        if (window.splashAPI) {
            window.splashAPI.onThemeChanged((theme) => {
                this.setTheme(theme);
            });

            window.splashAPI.onStatusUpdate((message) => {
                this.updateStatus(message);
            });

            window.splashAPI.onProgressUpdate((progress) => {
                this.updateProgress(progress);
            });
        }

        // Listen for system theme changes
        if (window.matchMedia) {
            const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
            mediaQuery.addEventListener("change", (e) => {
                if (!window.splashAPI) {
                    this.setTheme(e.matches ? "dark" : "light");
                }
            });
        }

        // Cleanup on window unload
        window.addEventListener("beforeunload", () => {
            this.cleanup();
        });
    }

    /**
     * Detect and set system theme
     */
    detectSystemTheme() {
        if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
            this.setTheme("dark");
        } else {
            this.setTheme("light");
        }
    }

    /**
     * Set theme with dynamic SVG color updates
     */
    setTheme(theme) {
        if (theme !== "light" && theme !== "dark") {
            console.warn(`Invalid theme: ${theme}, falling back to light`);
            theme = "light";
        }

        this.currentTheme = theme;
        document.body.setAttribute("data-theme", theme);
        this.updateSVGColors(theme);
    }

    /**
     * Update SVG colors for theme
     */
    updateSVGColors(theme) {
        const svg = document.querySelector(".logo-svg");
        if (!svg) return;

        const gradientStops = svg.querySelectorAll("#gradient stop");
        if (gradientStops.length >= 2) {
            if (theme === "dark") {
                gradientStops[0].style.stopColor = "#60a5fa";
                gradientStops[1].style.stopColor = "#3b82f6";
            } else {
                gradientStops[0].style.stopColor = "#3b82f6";
                gradientStops[1].style.stopColor = "#1d4ed8";
            }
        }
    }

    /**
     * Update status message with smooth transition
     */
    updateStatus(message) {
        if (!this.statusElement) return;

        this.statusElement.classList.add("updating");
        setTimeout(() => {
            this.statusElement.textContent = message;
            this.statusElement.classList.remove("updating");
        }, 150);
    }

    /**
     * Update progress with determinate/indeterminate support
     */
    updateProgress(progress) {
        if (!this.progressElement) return;

        if (progress >= 0 && progress <= 100) {
            if (!this.isProgressDeterminate) {
                this.isProgressDeterminate = true;
                this.progressElement.classList.add("determinate");
            }
            this.progressElement.style.width = `${progress}%`;
        } else {
            if (this.isProgressDeterminate) {
                this.isProgressDeterminate = false;
                this.progressElement.classList.remove("determinate");
                this.progressElement.style.width = "";
            }
        }
    }

    /**
     * Update version information
     */
    updateVersion() {
        if (!this.versionElement) return;
        const version = "1.6.0";
        this.versionElement.textContent = `Version ${version}`;
    }

    /**
     * Show error state
     */
    showError(errorMessage) {
        this.updateStatus(`Error: ${errorMessage}`);
        if (this.progressElement) {
            this.progressElement.style.background = "#ef4444";
        }
        this.stopLanguageAnimation();
    }

    /**
     * Reset to normal state
     */
    resetToNormal() {
        if (this.progressElement) {
            this.progressElement.style.background = "";
        }
        this.startLanguageAnimation();
    }

    /**
     * Stop language animation
     */
    stopLanguageAnimation() {
        if (this.animationInterval) {
            clearInterval(this.animationInterval);
            this.animationInterval = null;
        }
    }

    /**
     * Get current theme
     */
    getCurrentTheme() {
        return this.currentTheme;
    }

    /**
     * Check if user prefers reduced motion
     */
    shouldReduceMotion() {
        return window.matchMedia && window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    }

    /**
     * Check if high contrast mode
     */
    isHighContrast() {
        return window.matchMedia && window.matchMedia("(prefers-contrast: high)").matches;
    }

    /**
     * Get current language info
     */
    getCurrentLanguageInfo() {
        return this.productNames[this.currentNameIndex];
    }

    /**
     * Manually set a specific language
     */
    setLanguage(langCode) {
        const index = this.productNames.findIndex((item) => item.lang === langCode);
        if (index !== -1) {
            this.currentNameIndex = index;
            this.setProductName(index, true);
        }
    }

    /**
     * Set animation speed
     */
    setAnimationSpeed(speed) {
        this.animationSpeed = Math.max(1000, speed); // Minimum 1 second
        if (this.animationInterval) {
            this.stopLanguageAnimation();
            this.startLanguageAnimation();
        }
    }

    /**
     * Clean up resources
     */
    cleanup() {
        this.stopLanguageAnimation();
        if (window.splashAPI && window.splashAPI.removeAllListeners) {
            window.splashAPI.removeAllListeners();
        }
    }

    /**
     * Get splash statistics
     */
    getStats() {
        return {
            currentLanguage: this.getCurrentLanguageInfo(),
            theme: this.currentTheme,
            animationSpeed: this.animationSpeed,
            isAnimating: this.isAnimating,
            reducedMotion: this.shouldReduceMotion(),
            highContrast: this.isHighContrast(),
            totalLanguages: this.productNames.length,
        };
    }
}

// Initialize when DOM is ready
document.addEventListener("DOMContentLoaded", () => {
    // Set initial opacity for smooth fade-in
    document.body.style.opacity = "0";
    document.body.style.transition = "opacity 0.3s ease";

    // Create global controller instance
    window.splashController = new SplashController();

    // Global error handling
    window.addEventListener("error", (event) => {
        console.error("Splash screen error:", event.error);
        if (window.splashController) {
            window.splashController.showError("Loading failed");
        }
    });

    window.addEventListener("unhandledrejection", (event) => {
        console.error("Unhandled promise rejection:", event.reason);
        if (window.splashController) {
            window.splashController.showError("Initialization failed");
        }
    });
});

// Prevent context menu and drag operations
document.addEventListener("contextmenu", (e) => e.preventDefault());
document.addEventListener("dragover", (e) => e.preventDefault());
document.addEventListener("drop", (e) => e.preventDefault());
document.addEventListener("selectstart", (e) => e.preventDefault());

// Export for testing
if (typeof module !== "undefined" && module.exports) {
    module.exports = SplashController;
}
