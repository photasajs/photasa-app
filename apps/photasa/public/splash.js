/**
 * Enhanced Animated Splash Screen Controller (Tauri variant)
 */
class SplashController {
    constructor() {
        this.PREFERENCE_THEME = {
            LIGHT: "light",
            DARK: "dark",
            SOLARIZED_LIGHT: "solarized-light",
            SOLARIZED_DARK: "solarized-dark",
        };

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

    init() {
        this.setupWindowDrag();
        this.setupEventListeners();
        void this.resolveInitialTheme();
        this.updateVersion();
        this.startLanguageAnimation();

        // Set initial language
        this.setProductName(0, false);

        // Smooth fade-in
        setTimeout(() => {
            document.body.style.opacity = "1";
        }, 100);
    }

    shouldReduceMotion() {
        return (
            window.matchMedia &&
            window.matchMedia("(prefers-reduced-motion: reduce)").matches === true
        );
    }

    startLanguageAnimation() {
        if (this.shouldReduceMotion()) {
            this.currentNameIndex = Math.floor(Math.random() * this.productNames.length);
            this.setProductName(this.currentNameIndex, false);
            return;
        }

        this.currentNameIndex = Math.floor(Math.random() * this.productNames.length);
        this.setProductName(this.currentNameIndex, false);

        this.animationInterval = setInterval(() => {
            this.cycleToNextLanguage();
        }, this.animationSpeed);
    }

    cycleToNextLanguage() {
        if (this.isAnimating) return;
        this.currentNameIndex = (this.currentNameIndex + 1) % this.productNames.length;
        this.setProductName(this.currentNameIndex, true);
    }

    setProductName(index, animate = true) {
        const nameData = this.productNames[index];
        if (animate && !this.shouldReduceMotion()) {
            this.animateNameChange(nameData);
        } else {
            this.updateNameElements(nameData);
        }
    }

    animateNameChange(nameData) {
        this.isAnimating = true;
        this.appNameElement?.classList.add("changing");
        this.appSubtitleElement?.classList.add("changing");

        setTimeout(() => {
            this.updateNameElements(nameData);

            this.appNameElement?.classList.remove("changing");
            this.appSubtitleElement?.classList.remove("changing");

            this.appNameElement?.classList.add("changing-in");
            this.appSubtitleElement?.classList.add("changing-in");

            setTimeout(() => {
                this.appNameElement?.classList.remove("changing-in");
                this.appSubtitleElement?.classList.remove("changing-in");
                this.isAnimating = false;
            }, 300);
        }, 300);
    }

    updateNameElements(nameData) {
        if (this.appNameElement) {
            this.appNameElement.textContent = nameData.text;
            this.appNameElement.setAttribute("data-lang", nameData.lang);
        }
        if (this.appSubtitleElement) {
            this.appSubtitleElement.textContent = nameData.subtitle;
            this.appSubtitleElement.setAttribute("data-lang", nameData.lang);
        }
    }

    setupWindowDrag() {
        const dragLayer = document.querySelector(".splash-drag-layer");
        if (!dragLayer) {
            return;
        }

        const startDrag = (event) => {
            if (event.button !== 0) {
                return;
            }
            event.preventDefault();

            const getCurrentWindow =
                window.__TAURI__?.window?.getCurrentWindow ??
                window.__TAURI__?.webviewWindow?.getCurrentWebviewWindow;
            if (typeof getCurrentWindow !== "function") {
                return;
            }

            const currentWindow = getCurrentWindow();
            if (typeof currentWindow?.startDragging === "function") {
                void currentWindow.startDragging();
            }
        };

        dragLayer.addEventListener("pointerdown", startDrag);
    }

    setupEventListeners() {
        // Tauri window events
        const tauri = window.__TAURI__;
        const listen = tauri?.event?.listen;
        if (typeof listen === "function") {
            listen("splash:theme-changed", (e) => this.setTheme(e?.payload));
            listen("splash:status-update", (e) => this.updateStatus(e?.payload));
            listen("splash:progress-update", (e) => this.updateProgress(e?.payload));
            listen("splash:fade-out", () => this.fadeOut());
        }

        // Listen for system theme changes
        if (window.matchMedia) {
            const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
            mediaQuery.addEventListener("change", (e) => {
                this.setTheme(e.matches ? "dark" : "light");
            });
        }

        window.addEventListener("beforeunload", () => this.cleanup());
    }

    preferenceThemeToSplashAppearance(themeId) {
        if (typeof themeId !== "string" || themeId.length === 0) {
            return null;
        }
        const { LIGHT, DARK, SOLARIZED_LIGHT, SOLARIZED_DARK } = this.PREFERENCE_THEME;
        if (themeId === DARK || themeId === SOLARIZED_DARK) {
            return "dark";
        }
        if (themeId === LIGHT || themeId === SOLARIZED_LIGHT) {
            return "light";
        }
        return null;
    }

    async resolveInitialTheme() {
        const invoke = window.__TAURI__?.core?.invoke;
        if (typeof invoke === "function") {
            try {
                const preferences = await invoke("preferences_get");
                const appearance = this.preferenceThemeToSplashAppearance(preferences?.ui?.theme);
                if (appearance) {
                    this.setTheme(appearance);
                    return;
                }
            } catch {
                /* 偏好尚未就绪，继续 fallback */
            }
        }

        const getCurrentWindow = window.__TAURI__?.window?.getCurrentWindow;
        if (typeof getCurrentWindow === "function") {
            try {
                const currentWindow = getCurrentWindow();
                if (typeof currentWindow.theme === "function") {
                    const nativeTheme = await currentWindow.theme();
                    this.setTheme(nativeTheme === "dark" ? "dark" : "light");
                    return;
                }
            } catch {
                /* fallback below */
            }
        }
        this.detectSystemTheme();
    }

    detectSystemTheme() {
        if (window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches) {
            this.setTheme("dark");
        } else {
            this.setTheme("light");
        }
    }

    setTheme(theme) {
        if (theme !== "light" && theme !== "dark") {
            theme = "light";
        }
        this.currentTheme = theme;
        document.body.setAttribute("data-theme", theme);
        this.updateSVGColors(theme);
    }

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

    updateStatus(message) {
        if (!this.statusElement || typeof message !== "string") return;
        this.statusElement.classList.add("updating");
        setTimeout(() => {
            this.statusElement.textContent = message;
            this.statusElement.classList.remove("updating");
        }, 150);
    }

    updateProgress(progress) {
        if (!this.progressElement) return;
        const n = typeof progress === "number" ? progress : Number(progress);
        if (Number.isFinite(n) && n >= 0 && n <= 100) {
            if (!this.isProgressDeterminate) {
                this.isProgressDeterminate = true;
                this.progressElement.classList.add("determinate");
            }
            this.progressElement.style.width = `${n}%`;
            return;
        }
        if (this.isProgressDeterminate) {
            this.isProgressDeterminate = false;
            this.progressElement.classList.remove("determinate");
            this.progressElement.style.width = "";
        }
    }

    async updateVersion() {
        if (!this.versionElement) return;
        const tauri = window.__TAURI__;
        try {
            const v = await tauri?.app?.getVersion?.();
            if (typeof v === "string" && v.length > 0) {
                this.versionElement.textContent = `Version ${v}`;
            }
        } catch {
            /* keep default */
        }
    }

    fadeOut() {
        try {
            document.body.style.transition = "opacity 280ms ease-out";
            document.body.style.opacity = "0";
        } catch {
            /* ignore */
        }
    }

    cleanup() {
        if (this.animationInterval) {
            clearInterval(this.animationInterval);
            this.animationInterval = null;
        }
    }
}

// Boot
// eslint-disable-next-line no-new
new SplashController();
