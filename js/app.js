/* =========================================================
   Robot Academy
   全站核心互動功能
========================================================= */

(() => {
    "use strict";

    const root = document.documentElement;

    root.classList.remove("no-js");
    root.classList.add("js");


    /* ---------------------------------------------------------
       常數
    --------------------------------------------------------- */

    const STORAGE_KEYS = {
        theme: "robot-academy-theme",
        sidebarCollapsed: "robot-academy-sidebar-collapsed",
        bookmarks: "robot-academy-bookmarks",
        completedTasks: "robot-academy-completed-tasks"
    };

    const mobileSidebarMedia = window.matchMedia(
        "(max-width: 64rem)"
    );

    const lessonSidebarMedia = window.matchMedia(
        "(max-width: 56rem)"
    );

    const reducedMotionMedia = window.matchMedia(
        "(prefers-reduced-motion: reduce)"
    );

    const systemDarkMedia = window.matchMedia(
        "(prefers-color-scheme: dark)"
    );


    /* ---------------------------------------------------------
       共用狀態
    --------------------------------------------------------- */

    const state = {
        activeModal: null,
        modalTrigger: null,
        sidebarTrigger: null,
        lessonSidebarTrigger: null,
        bookmarks: new Set(),
        completedTasks: new Set(),
        scrollLocks: new Set(),
        previousBodyOverflow: "",
        toastTimers: new WeakMap()
    };


    /* ---------------------------------------------------------
       DOM 工具
    --------------------------------------------------------- */

    const $ = (selector, scope = document) => {
        return scope.querySelector(selector);
    };

    const $$ = (selector, scope = document) => {
        return Array.from(scope.querySelectorAll(selector));
    };

    const collect = (selector, scope = document) => {
        const elements = [];

        if (
            scope instanceof Element &&
            scope.matches(selector)
        ) {
            elements.push(scope);
        }

        return elements.concat($$(selector, scope));
    };

    const getEventTarget = (event) => {
        if (event.target instanceof Element) {
            return event.target;
        }

        return event.target?.parentElement || null;
    };

    const clamp = (value, min, max) => {
        return Math.min(Math.max(value, min), max);
    };

    const isEditableElement = (element) => {
        if (!(element instanceof Element)) {
            return false;
        }

        return Boolean(
            element.closest(
                "input, textarea, select, [contenteditable='true']"
            )
        );
    };

    const isVisible = (element) => {
        if (!(element instanceof Element)) {
            return false;
        }

        return Boolean(
            element.offsetWidth ||
            element.offsetHeight ||
            element.getClientRects().length
        );
    };

    const getFocusableElements = (container) => {
        if (!container) {
            return [];
        }

        return $$(
            [
                "a[href]",
                "button:not([disabled])",
                "input:not([disabled])",
                "select:not([disabled])",
                "textarea:not([disabled])",
                "[tabindex]:not([tabindex='-1'])"
            ].join(","),
            container
        ).filter((element) => {
            return (
                !element.hidden &&
                element.getAttribute("aria-hidden") !== "true" &&
                isVisible(element)
            );
        });
    };

    const createId = (() => {
        let count = 0;

        return (prefix = "element") => {
            count += 1;

            return `${prefix}-${Date.now()}-${count}`;
        };
    })();

    const resolveElement = (
        reference,
        scope = document
    ) => {
        if (!reference) {
            return null;
        }

        if (reference instanceof Element) {
            return reference;
        }

        const value = String(reference).trim();

        if (!value) {
            return null;
        }

        const id = value.replace(/^#/, "");
        const elementById = document.getElementById(id);

        if (elementById) {
            return elementById;
        }

        try {
            return (
                scope.querySelector(value) ||
                document.querySelector(value)
            );
        } catch {
            return null;
        }
    };

    const emit = (
        name,
        detail = {},
        target = document
    ) => {
        target.dispatchEvent(
            new CustomEvent(name, {
                bubbles: true,
                detail
            })
        );
    };


    /* ---------------------------------------------------------
       Local Storage 工具
    --------------------------------------------------------- */

    const storage = {
        get(key, fallback = null) {
            try {
                const value = window.localStorage.getItem(key);

                return value === null ? fallback : value;
            } catch {
                return fallback;
            }
        },

        set(key, value) {
            try {
                window.localStorage.setItem(
                    key,
                    String(value)
                );

                return true;
            } catch {
                return false;
            }
        },

        remove(key) {
            try {
                window.localStorage.removeItem(key);

                return true;
            } catch {
                return false;
            }
        },

        getJSON(key, fallback = null) {
            const value = this.get(key, null);

            if (value === null) {
                return fallback;
            }

            try {
                return JSON.parse(value);
            } catch {
                return fallback;
            }
        },

        setJSON(key, value) {
            try {
                window.localStorage.setItem(
                    key,
                    JSON.stringify(value)
                );

                return true;
            } catch {
                return false;
            }
        }
    };


    /* ---------------------------------------------------------
       捲動鎖定
    --------------------------------------------------------- */

    const updateScrollLock = () => {
        const body = document.body;

        if (!body) {
            return;
        }

        const shouldLock = state.scrollLocks.size > 0;

        if (shouldLock) {
            if (!body.classList.contains("is-scroll-locked")) {
                state.previousBodyOverflow =
                    body.style.overflow;
            }

            body.classList.add("is-scroll-locked");
            body.style.overflow = "hidden";
        } else {
            body.classList.remove("is-scroll-locked");
            body.style.overflow =
                state.previousBodyOverflow;
        }
    };

    const lockScroll = (reason) => {
        state.scrollLocks.add(reason);
        updateScrollLock();
    };

    const unlockScroll = (reason) => {
        state.scrollLocks.delete(reason);
        updateScrollLock();
    };


    /* =========================================================
       主題 Theme
    ========================================================= */

    const getThemeMode = () => {
        const storedTheme = storage.get(
            STORAGE_KEYS.theme,
            null
        );

        if (
            storedTheme === "light" ||
            storedTheme === "dark" ||
            storedTheme === "system"
        ) {
            return storedTheme;
        }

        const documentTheme =
            root.getAttribute("data-theme");

        if (
            documentTheme === "light" ||
            documentTheme === "dark"
        ) {
            return documentTheme;
        }

        return "system";
    };

    const getResolvedTheme = () => {
        const theme = root.getAttribute("data-theme");

        if (theme === "light" || theme === "dark") {
            return theme;
        }

        return systemDarkMedia.matches
            ? "dark"
            : "light";
    };

    const applyStoredTheme = () => {
        const storedTheme = storage.get(
            STORAGE_KEYS.theme,
            null
        );

        if (storedTheme === "light") {
            root.setAttribute("data-theme", "light");
        }

        if (storedTheme === "dark") {
            root.setAttribute("data-theme", "dark");
        }

        if (storedTheme === "system") {
            root.removeAttribute("data-theme");
        }
    };

    const syncThemeControls = (
        scope = document
    ) => {
        const mode = getThemeMode();
        const resolvedTheme = getResolvedTheme();
        const nextTheme =
            resolvedTheme === "dark"
                ? "light"
                : "dark";

        collect("[data-theme-toggle]", scope)
            .forEach((button) => {
                button.setAttribute(
                    "aria-pressed",
                    String(resolvedTheme === "dark")
                );

                button.setAttribute(
                    "aria-label",
                    nextTheme === "dark"
                        ? "切換至深色模式"
                        : "切換至淺色模式"
                );

                button.setAttribute(
                    "title",
                    nextTheme === "dark"
                        ? "切換至深色模式"
                        : "切換至淺色模式"
                );

                button.dataset.currentTheme =
                    resolvedTheme;

                $$("[data-theme-icon]", button)
                    .forEach((icon) => {
                        const iconType =
                            icon.dataset.themeIcon;

                        if (iconType === "sun") {
                            icon.hidden =
                                resolvedTheme !== "dark";
                        }

                        if (iconType === "moon") {
                            icon.hidden =
                                resolvedTheme !== "light";
                        }

                        if (
                            iconType === "light" ||
                            iconType === "dark"
                        ) {
                            icon.hidden =
                                iconType !== resolvedTheme;
                        }
                    });
            });

        collect("[data-theme-set]", scope)
            .forEach((button) => {
                const buttonTheme =
                    button.dataset.themeSet;

                const isActive = buttonTheme === mode;

                button.classList.toggle(
                    "is-active",
                    isActive
                );

                button.setAttribute(
                    "aria-pressed",
                    String(isActive)
                );
            });

        const themeColor = $(
            "meta[name='theme-color']"
        );

        if (themeColor) {
            window.requestAnimationFrame(() => {
                const pageColor = getComputedStyle(root)
                    .getPropertyValue("--color-page")
                    .trim();

                if (pageColor) {
                    themeColor.setAttribute(
                        "content",
                        pageColor
                    );
                }
            });
        }
    };

    const setTheme = (
        theme,
        options = {}
    ) => {
        const {
            persist = true
        } = options;

        if (
            theme !== "light" &&
            theme !== "dark" &&
            theme !== "system"
        ) {
            return;
        }

        if (theme === "system") {
            root.removeAttribute("data-theme");
        } else {
            root.setAttribute("data-theme", theme);
        }

        if (persist) {
            storage.set(STORAGE_KEYS.theme, theme);
        }

        syncThemeControls();

        emit(
            "robotacademy:themechange",
            {
                mode: theme,
                resolvedTheme: getResolvedTheme()
            },
            root
        );
    };

    const toggleTheme = () => {
        const nextTheme =
            getResolvedTheme() === "dark"
                ? "light"
                : "dark";

        setTheme(nextTheme);
    };

    const handleThemeClick = (event) => {
        const target = getEventTarget(event);

        if (!target) {
            return;
        }

        const setButton = target.closest(
            "[data-theme-set]"
        );

        if (setButton) {
            event.preventDefault();

            setTheme(setButton.dataset.themeSet);

            return;
        }

        const toggleButton = target.closest(
            "[data-theme-toggle]"
        );

        if (toggleButton) {
            event.preventDefault();
            toggleTheme();
        }
    };


    /* =========================================================
       主側邊欄
    ========================================================= */

    const getAppLayout = () => {
        return $(".app-layout");
    };

    const syncSidebarState = () => {
        const layout = getAppLayout();
        const sidebar = $(".sidebar");

        if (!layout || !sidebar) {
            return;
        }

        const isOpen =
            layout.classList.contains(
                "is-sidebar-open"
            );

        const isCollapsed =
            layout.classList.contains(
                "is-sidebar-collapsed"
            );

        $$(
            "[data-sidebar-toggle], .topbar__menu-button"
        ).forEach((button) => {
            button.setAttribute(
                "aria-expanded",
                String(isOpen)
            );

            if (sidebar.id) {
                button.setAttribute(
                    "aria-controls",
                    sidebar.id
                );
            }
        });

        $$(
            "[data-sidebar-collapse], .sidebar__collapse"
        ).forEach((button) => {
            button.setAttribute(
                "aria-expanded",
                String(!isCollapsed)
            );

            button.setAttribute(
                "aria-label",
                isCollapsed
                    ? "展開側邊欄"
                    : "收合側邊欄"
            );

            button.setAttribute(
                "title",
                isCollapsed
                    ? "展開側邊欄"
                    : "收合側邊欄"
            );
        });

        if (mobileSidebarMedia.matches) {
            sidebar.setAttribute(
                "aria-hidden",
                String(!isOpen)
            );
        } else {
            sidebar.setAttribute(
                "aria-hidden",
                "false"
            );
        }

        const overlay = $(".sidebar-overlay");

        if (overlay) {
            overlay.setAttribute(
                "aria-hidden",
                String(!isOpen)
            );
        }
    };

    const openSidebar = (trigger = null) => {
        const layout = getAppLayout();

        if (!layout) {
            return;
        }

        if (trigger instanceof Element) {
            state.sidebarTrigger = trigger;
        }

        layout.classList.add("is-sidebar-open");

        if (mobileSidebarMedia.matches) {
            lockScroll("main-sidebar");
        }

        syncSidebarState();

        const sidebar = $(".sidebar");

        if (
            sidebar &&
            mobileSidebarMedia.matches
        ) {
            window.requestAnimationFrame(() => {
                const focusable =
                    getFocusableElements(sidebar);

                focusable[0]?.focus({
                    preventScroll: true
                });
            });
        }

        emit("robotacademy:sidebaropen");
    };

    const closeSidebar = (
        restoreFocus = true
    ) => {
        const layout = getAppLayout();

        if (!layout) {
            return;
        }

        layout.classList.remove("is-sidebar-open");
        unlockScroll("main-sidebar");
        syncSidebarState();

        if (
            restoreFocus &&
            state.sidebarTrigger instanceof Element
        ) {
            state.sidebarTrigger.focus({
                preventScroll: true
            });
        }

        state.sidebarTrigger = null;

        emit("robotacademy:sidebarclose");
    };

    const toggleSidebar = (trigger = null) => {
        const layout = getAppLayout();

        if (!layout) {
            return;
        }

        if (
            layout.classList.contains(
                "is-sidebar-open"
            )
        ) {
            closeSidebar();
        } else {
            openSidebar(trigger);
        }
    };

    const toggleSidebarCollapse = () => {
        const layout = getAppLayout();

        if (!layout) {
            return;
        }

        if (mobileSidebarMedia.matches) {
            toggleSidebar();

            return;
        }

        const isCollapsed =
            layout.classList.toggle(
                "is-sidebar-collapsed"
            );

        storage.set(
            STORAGE_KEYS.sidebarCollapsed,
            String(isCollapsed)
        );

        syncSidebarState();

        emit(
            "robotacademy:sidebarcollapse",
            {
                collapsed: isCollapsed
            }
        );
    };

    const restoreSidebarPreference = () => {
        const layout = getAppLayout();

        if (!layout || mobileSidebarMedia.matches) {
            return;
        }

        const savedState = storage.get(
            STORAGE_KEYS.sidebarCollapsed,
            null
        );

        if (savedState === null) {
            return;
        }

        layout.classList.toggle(
            "is-sidebar-collapsed",
            savedState === "true"
        );
    };

    const handleSidebarClick = (event) => {
        const target = getEventTarget(event);

        if (!target) {
            return;
        }

        const collapseButton = target.closest(
            [
                "[data-sidebar-collapse]",
                ".sidebar__collapse"
            ].join(",")
        );

        if (collapseButton) {
            event.preventDefault();
            toggleSidebarCollapse();

            return;
        }

        const toggleButton = target.closest(
            [
                "[data-sidebar-toggle]",
                ".topbar__menu-button"
            ].join(",")
        );

        if (toggleButton) {
            event.preventDefault();
            toggleSidebar(toggleButton);

            return;
        }

        const closeButton = target.closest(
            "[data-sidebar-close]"
        );

        if (closeButton) {
            event.preventDefault();
            closeSidebar();

            return;
        }

        if (target.closest(".sidebar-overlay")) {
            closeSidebar();

            return;
        }

        const sidebarLink = target.closest(
            ".sidebar a[href]"
        );

        if (
            sidebarLink &&
            mobileSidebarMedia.matches
        ) {
            const href = sidebarLink
                .getAttribute("href")
                ?.trim();

            const hasSubmenu =
                sidebarLink.closest(
                    ".sidebar-nav__item"
                )?.querySelector(
                    ".sidebar-nav__submenu"
                );

            const isSubmenuToggle =
                sidebarLink.hasAttribute(
                    "data-submenu-toggle"
                ) ||
                href === "#" ||
                href === "";

            if (
                href &&
                (!hasSubmenu || !isSubmenuToggle)
            ) {
                window.requestAnimationFrame(() => {
                    closeSidebar(false);
                });
            }
        }
    };


    /* =========================================================
       課程學習頁側邊欄
    ========================================================= */

    const getLessonLayout = () => {
        return $(".lesson-layout");
    };

    const syncLessonSidebarState = () => {
        const layout = getLessonLayout();
        const sidebar = $(".lesson-sidebar");

        if (!layout || !sidebar) {
            return;
        }

        const isOpen = layout.classList.contains(
            "is-sidebar-open"
        );

        $$(
            [
                "[data-lesson-sidebar-toggle]",
                ".lesson-sidebar-toggle"
            ].join(",")
        ).forEach((button) => {
            button.setAttribute(
                "aria-expanded",
                String(isOpen)
            );

            if (sidebar.id) {
                button.setAttribute(
                    "aria-controls",
                    sidebar.id
                );
            }
        });

        if (lessonSidebarMedia.matches) {
            sidebar.setAttribute(
                "aria-hidden",
                String(!isOpen)
            );
        } else {
            sidebar.setAttribute(
                "aria-hidden",
                "false"
            );
        }
    };

    const openLessonSidebar = (
        trigger = null
    ) => {
        const layout = getLessonLayout();

        if (!layout) {
            return;
        }

        if (trigger instanceof Element) {
            state.lessonSidebarTrigger = trigger;
        }

        layout.classList.add("is-sidebar-open");

        if (lessonSidebarMedia.matches) {
            lockScroll("lesson-sidebar");
        }

        syncLessonSidebarState();
    };

    const closeLessonSidebar = (
        restoreFocus = true
    ) => {
        const layout = getLessonLayout();

        if (!layout) {
            return;
        }

        layout.classList.remove("is-sidebar-open");
        unlockScroll("lesson-sidebar");
        syncLessonSidebarState();

        if (
            restoreFocus &&
            state.lessonSidebarTrigger instanceof Element
        ) {
            state.lessonSidebarTrigger.focus({
                preventScroll: true
            });
        }

        state.lessonSidebarTrigger = null;
    };

    const toggleLessonSidebar = (
        trigger = null
    ) => {
        const layout = getLessonLayout();

        if (!layout) {
            return;
        }

        if (
            layout.classList.contains(
                "is-sidebar-open"
            )
        ) {
            closeLessonSidebar();
        } else {
            openLessonSidebar(trigger);
        }
    };

    const handleLessonSidebarClick = (
        event
    ) => {
        const target = getEventTarget(event);

        if (!target) {
            return;
        }

        const toggleButton = target.closest(
            [
                "[data-lesson-sidebar-toggle]",
                ".lesson-sidebar-toggle"
            ].join(",")
        );

        if (toggleButton) {
            event.preventDefault();
            toggleLessonSidebar(toggleButton);

            return;
        }

        if (
            target.closest(
                "[data-lesson-sidebar-close]"
            ) ||
            target.closest(".lesson-overlay")
        ) {
            event.preventDefault();
            closeLessonSidebar();

            return;
        }

        if (
            target.closest(
                ".lesson-sidebar a[href]"
            ) &&
            lessonSidebarMedia.matches
        ) {
            closeLessonSidebar(false);
        }
    };


    /* =========================================================
       側邊欄子選單
    ========================================================= */

    const getDirectChild = (
        parent,
        selector
    ) => {
        return Array.from(parent.children).find(
            (child) => child.matches(selector)
        ) || null;
    };

    const getSubmenuParts = (item) => {
        if (!item) {
            return {
                trigger: null,
                submenu: null
            };
        }

        const trigger =
            getDirectChild(
                item,
                "[data-submenu-toggle]"
            ) ||
            getDirectChild(
                item,
                ".sidebar-nav__link"
            );

        const submenu = getDirectChild(
            item,
            ".sidebar-nav__submenu"
        );

        return {
            trigger,
            submenu
        };
    };

    const setSubmenuState = (
        item,
        expanded
    ) => {
        const {
            trigger,
            submenu
        } = getSubmenuParts(item);

        if (!trigger || !submenu) {
            return;
        }

        if (!submenu.id) {
            submenu.id = createId("sidebar-submenu");
        }

        item.classList.toggle(
            "is-expanded",
            expanded
        );

        trigger.setAttribute(
            "aria-expanded",
            String(expanded)
        );

        trigger.setAttribute(
            "aria-controls",
            submenu.id
        );

        submenu.hidden = !expanded;
    };

    const syncSubmenus = (
        scope = document
    ) => {
        collect(".sidebar-nav__item", scope)
            .forEach((item) => {
                const {
                    trigger,
                    submenu
                } = getSubmenuParts(item);

                if (!trigger || !submenu) {
                    return;
                }

                const isExpanded =
                    item.classList.contains(
                        "is-expanded"
                    ) ||
                    trigger.getAttribute(
                        "aria-expanded"
                    ) === "true";

                setSubmenuState(
                    item,
                    isExpanded
                );
            });
    };

    const handleSubmenuClick = (event) => {
        const target = getEventTarget(event);

        if (!target) {
            return;
        }

        const arrow = target.closest(
            ".sidebar-nav__arrow"
        );

        const explicitTrigger = target.closest(
            "[data-submenu-toggle]"
        );

        const navigationLink = target.closest(
            ".sidebar-nav__link"
        );

        const trigger =
            explicitTrigger ||
            navigationLink;

        if (!trigger) {
            return;
        }

        const item = trigger.closest(
            ".sidebar-nav__item"
        );

        const {
            submenu
        } = getSubmenuParts(item);

        if (!item || !submenu) {
            return;
        }

        const href = trigger
            .getAttribute("href")
            ?.trim();

        const shouldToggle =
            Boolean(explicitTrigger) ||
            Boolean(arrow) ||
            href === "#" ||
            href === "" ||
            !href;

        if (!shouldToggle) {
            return;
        }

        event.preventDefault();

        const expanded =
            !item.classList.contains(
                "is-expanded"
            );

        setSubmenuState(item, expanded);
    };


    /* =========================================================
       Dropdown 下拉選單
    ========================================================= */

    const getDropdownParts = (dropdown) => {
        const trigger = $(
            [
                "[data-dropdown-toggle]",
                ".dropdown-toggle",
                ".topbar-user"
            ].join(","),
            dropdown
        );

        const menu = $(
            ".dropdown-menu",
            dropdown
        );

        return {
            trigger,
            menu
        };
    };

    const setDropdownState = (
        dropdown,
        open,
        options = {}
    ) => {
        const {
            focusMenu = false,
            restoreFocus = false
        } = options;

        const {
            trigger,
            menu
        } = getDropdownParts(dropdown);

        if (!trigger || !menu) {
            return;
        }

        if (!menu.id) {
            menu.id = createId("dropdown-menu");
        }

        dropdown.classList.toggle(
            "is-open",
            open
        );

        trigger.setAttribute(
            "aria-expanded",
            String(open)
        );

        trigger.setAttribute(
            "aria-haspopup",
            "menu"
        );

        trigger.setAttribute(
            "aria-controls",
            menu.id
        );

        menu.hidden = !open;

        if (open && focusMenu) {
            window.requestAnimationFrame(() => {
                const firstItem = $(
                    [
                        "[role='menuitem']",
                        ".dropdown-item",
                        "a[href]",
                        "button:not([disabled])"
                    ].join(","),
                    menu
                );

                firstItem?.focus({
                    preventScroll: true
                });
            });
        }

        if (
            !open &&
            restoreFocus &&
            trigger instanceof Element
        ) {
            trigger.focus({
                preventScroll: true
            });
        }
    };

    const closeDropdowns = (
        except = null
    ) => {
        $$(".dropdown.is-open").forEach(
            (dropdown) => {
                if (dropdown !== except) {
                    setDropdownState(
                        dropdown,
                        false
                    );
                }
            }
        );
    };

    const syncDropdowns = (
        scope = document
    ) => {
        collect(".dropdown", scope)
            .forEach((dropdown) => {
                const {
                    trigger,
                    menu
                } = getDropdownParts(dropdown);

                if (!trigger || !menu) {
                    return;
                }

                const isOpen =
                    dropdown.classList.contains(
                        "is-open"
                    );

                setDropdownState(
                    dropdown,
                    isOpen
                );
            });
    };

    const handleDropdownClick = (event) => {
        const target = getEventTarget(event);

        if (!target) {
            return;
        }

        const toggle = target.closest(
            [
                "[data-dropdown-toggle]",
                ".dropdown-toggle",
                ".topbar-user"
            ].join(",")
        );

        if (toggle) {
            const dropdown = toggle.closest(
                ".dropdown"
            );

            if (!dropdown) {
                return;
            }

            event.preventDefault();

            const shouldOpen =
                !dropdown.classList.contains(
                    "is-open"
                );

            closeDropdowns(dropdown);

            setDropdownState(
                dropdown,
                shouldOpen
            );

            return;
        }

        const dropdown = target.closest(
            ".dropdown"
        );

        if (!dropdown) {
            closeDropdowns();

            return;
        }

        if (
            target.closest(
                [
                    "[data-dropdown-close]",
                    ".dropdown-item",
                    ".dropdown-menu a[href]",
                    ".dropdown-menu [role='menuitem']"
                ].join(",")
            )
        ) {
            setDropdownState(
                dropdown,
                false
            );
        }
    };


    /* =========================================================
       Accordion 與課程章節
    ========================================================= */

    const getAccordionParts = (item) => {
        if (!item) {
            return {
                trigger: null,
                panel: null
            };
        }

        const trigger =
            $(
                "[data-accordion-trigger]",
                item
            ) ||
            $(
                ".curriculum-section__header",
                item
            );

        const panel =
            $(
                "[data-accordion-panel]",
                item
            ) ||
            $(
                ".curriculum-section__lessons",
                item
            );

        return {
            trigger,
            panel
        };
    };

    const setAccordionState = (
        item,
        open
    ) => {
        const {
            trigger,
            panel
        } = getAccordionParts(item);

        if (!trigger || !panel) {
            return;
        }

        if (!panel.id) {
            panel.id = createId(
                "accordion-panel"
            );
        }

        item.classList.toggle(
            "is-open",
            open
        );

        trigger.setAttribute(
            "aria-expanded",
            String(open)
        );

        trigger.setAttribute(
            "aria-controls",
            panel.id
        );

        panel.hidden = !open;
    };

    const syncAccordions = (
        scope = document
    ) => {
        collect(
            [
                "[data-accordion-item]",
                ".curriculum-section"
            ].join(","),
            scope
        ).forEach((item) => {
            const {
                trigger,
                panel
            } = getAccordionParts(item);

            if (!trigger || !panel) {
                return;
            }

            const isOpen =
                item.classList.contains(
                    "is-open"
                ) ||
                trigger.getAttribute(
                    "aria-expanded"
                ) === "true";

            setAccordionState(item, isOpen);
        });
    };

    const handleAccordionClick = (event) => {
        const target = getEventTarget(event);

        if (!target) {
            return;
        }

        const trigger = target.closest(
            [
                "[data-accordion-trigger]",
                ".curriculum-section__header"
            ].join(",")
        );

        if (!trigger) {
            return;
        }

        const item = trigger.closest(
            [
                "[data-accordion-item]",
                ".curriculum-section"
            ].join(",")
        );

        if (!item) {
            return;
        }

        event.preventDefault();

        const shouldOpen =
            !item.classList.contains(
                "is-open"
            );

        const group = item.closest(
            "[data-accordion]"
        );

        const singleMode = Boolean(
            group &&
            (
                group.hasAttribute(
                    "data-accordion-single"
                ) ||
                group.dataset.accordionMode ===
                    "single"
            )
        );

        if (singleMode && shouldOpen) {
            $$(
                [
                    "[data-accordion-item]",
                    ".curriculum-section"
                ].join(","),
                group
            ).forEach((otherItem) => {
                if (
                    otherItem !== item &&
                    otherItem.closest(
                        "[data-accordion]"
                    ) === group
                ) {
                    setAccordionState(
                        otherItem,
                        false
                    );
                }
            });
        }

        setAccordionState(
            item,
            shouldOpen
        );
    };


    /* =========================================================
       Tabs
    ========================================================= */

    const getTabs = (group) => {
        return $$(
            "[role='tab'], [data-tab]",
            group
        ).filter((tab) => {
            return tab.closest("[data-tabs]") === group;
        });
    };

    const getTabPanels = (group) => {
        return $$(
            "[role='tabpanel'], [data-tab-panel]",
            group
        ).filter((panel) => {
            return panel.closest("[data-tabs]") === group;
        });
    };

    const getTabPanel = (
        group,
        tab,
        index
    ) => {
        const reference =
            tab.dataset.tabTarget ||
            tab.getAttribute("aria-controls") ||
            (
                tab.getAttribute("href")
                    ?.startsWith("#")
                    ? tab.getAttribute("href")
                    : null
            );

        const referencedPanel =
            resolveElement(reference, group);

        if (
            referencedPanel &&
            group.contains(referencedPanel)
        ) {
            return referencedPanel;
        }

        return getTabPanels(group)[index] || null;
    };

    const activateTab = (
        group,
        selectedTab,
        options = {}
    ) => {
        const {
            focus = false,
            notify = true
        } = options;

        const tabs = getTabs(group);

        tabs.forEach((tab, index) => {
            const active = tab === selectedTab;
            const panel = getTabPanel(
                group,
                tab,
                index
            );

            tab.setAttribute("role", "tab");
            tab.setAttribute(
                "aria-selected",
                String(active)
            );

            tab.setAttribute(
                "tabindex",
                active ? "0" : "-1"
            );

            tab.classList.toggle(
                "is-active",
                active
            );

            if (panel) {
                if (!panel.id) {
                    panel.id = createId("tab-panel");
                }

                tab.setAttribute(
                    "aria-controls",
                    panel.id
                );

                panel.setAttribute(
                    "role",
                    "tabpanel"
                );

                panel.hidden = !active;
                panel.classList.toggle(
                    "is-active",
                    active
                );
            }
        });

        if (focus) {
            selectedTab.focus({
                preventScroll: true
            });
        }

        if (notify) {
            emit(
                "robotacademy:tabchange",
                {
                    tab: selectedTab,
                    group
                },
                group
            );
        }
    };

    const syncTabs = (scope = document) => {
        collect("[data-tabs]", scope)
            .forEach((group) => {
                const tabs = getTabs(group);

                if (!tabs.length) {
                    return;
                }

                const tabList =
                    $("[data-tab-list]", group) ||
                    tabs[0].parentElement;

                tabList?.setAttribute(
                    "role",
                    "tablist"
                );

                const activeTab =
                    tabs.find((tab) => {
                        return (
                            tab.classList.contains(
                                "is-active"
                            ) ||
                            tab.getAttribute(
                                "aria-selected"
                            ) === "true"
                        );
                    }) ||
                    tabs[0];

                activateTab(
                    group,
                    activeTab,
                    {
                        notify: false
                    }
                );
            });
    };

    const handleTabClick = (event) => {
        const target = getEventTarget(event);

        if (!target) {
            return;
        }

        const tab = target.closest(
            "[role='tab'], [data-tab]"
        );

        if (!tab) {
            return;
        }

        const group = tab.closest(
            "[data-tabs]"
        );

        if (!group) {
            return;
        }

        event.preventDefault();

        activateTab(
            group,
            tab,
            {
                focus: true
            }
        );
    };

    const handleTabKeydown = (event) => {
        const target = getEventTarget(event);

        if (
            !target ||
            !target.matches(
                "[role='tab'], [data-tab]"
            )
        ) {
            return;
        }

        const group = target.closest(
            "[data-tabs]"
        );

        if (!group) {
            return;
        }

        const tabs = getTabs(group);
        const currentIndex =
            tabs.indexOf(target);

        if (currentIndex < 0) {
            return;
        }

        let nextIndex = currentIndex;

        if (
            event.key === "ArrowRight" ||
            event.key === "ArrowDown"
        ) {
            nextIndex =
                (currentIndex + 1) %
                tabs.length;
        } else if (
            event.key === "ArrowLeft" ||
            event.key === "ArrowUp"
        ) {
            nextIndex =
                (
                    currentIndex -
                    1 +
                    tabs.length
                ) % tabs.length;
        } else if (event.key === "Home") {
            nextIndex = 0;
        } else if (event.key === "End") {
            nextIndex = tabs.length - 1;
        } else {
            return;
        }

        event.preventDefault();

        activateTab(
            group,
            tabs[nextIndex],
            {
                focus: true
            }
        );
    };


    /* =========================================================
       Modal
    ========================================================= */

    const findModalRoot = (element) => {
        if (!element) {
            return null;
        }

        if (
            element.matches(
                [
                    ".modal-backdrop",
                    "[data-modal-root]"
                ].join(",")
            )
        ) {
            return element;
        }

        return (
            element.closest(
                [
                    ".modal-backdrop",
                    "[data-modal-root]"
                ].join(",")
            ) ||
            (
                element.matches(".modal")
                    ? element
                    : null
            )
        );
    };

    const resolveModal = (reference) => {
        const element = resolveElement(reference);

        if (!element) {
            return null;
        }

        return findModalRoot(element) || element;
    };

    const getModalDialog = (modalRoot) => {
        if (!modalRoot) {
            return null;
        }

        if (
            modalRoot.matches(
                ".modal, [role='dialog']"
            )
        ) {
            return modalRoot;
        }

        return (
            $(
                ".modal, [role='dialog']",
                modalRoot
            ) ||
            modalRoot
        );
    };

    const openModal = (
        reference,
        trigger = null
    ) => {
        const modalRoot = resolveModal(reference);

        if (!modalRoot) {
            return;
        }

        if (
            state.activeModal &&
            state.activeModal !== modalRoot
        ) {
            closeModal(
                state.activeModal,
                false
            );
        }

        const dialog = getModalDialog(modalRoot);

        state.activeModal = modalRoot;
        state.modalTrigger =
            trigger instanceof Element
                ? trigger
                : document.activeElement;

        modalRoot.hidden = false;
        modalRoot.setAttribute(
            "aria-hidden",
            "false"
        );

        if (dialog) {
            dialog.setAttribute(
                "role",
                "dialog"
            );

            dialog.setAttribute(
                "aria-modal",
                "true"
            );

            if (!dialog.hasAttribute("tabindex")) {
                dialog.setAttribute(
                    "tabindex",
                    "-1"
                );
            }
        }

        document.body.classList.add(
            "is-modal-open"
        );

        lockScroll("modal");

        window.requestAnimationFrame(() => {
            modalRoot.classList.add("is-open");
            dialog?.classList.add("is-open");

            const autofocus = $(
                "[autofocus]",
                dialog
            );

            const focusable =
                getFocusableElements(dialog);

            (
                autofocus ||
                focusable[0] ||
                dialog
            )?.focus({
                preventScroll: true
            });
        });

        emit(
            "robotacademy:modalopen",
            {
                modal: modalRoot
            },
            modalRoot
        );
    };

    const closeModal = (
        reference = state.activeModal,
        restoreFocus = true
    ) => {
        const modalRoot =
            reference instanceof Element
                ? findModalRoot(reference) ||
                    reference
                : resolveModal(reference);

        if (!modalRoot) {
            return;
        }

        const dialog = getModalDialog(modalRoot);

        modalRoot.classList.remove("is-open");
        dialog?.classList.remove("is-open");

        modalRoot.setAttribute(
            "aria-hidden",
            "true"
        );

        const closeToken = String(Date.now());

        modalRoot.dataset.closeToken =
            closeToken;

        const delay =
            reducedMotionMedia.matches
                ? 0
                : 220;

        window.setTimeout(() => {
            if (
                modalRoot.dataset.closeToken ===
                    closeToken &&
                !modalRoot.classList.contains(
                    "is-open"
                )
            ) {
                modalRoot.hidden = true;
            }
        }, delay);

        if (state.activeModal === modalRoot) {
            state.activeModal = null;
            document.body.classList.remove(
                "is-modal-open"
            );

            unlockScroll("modal");

            if (
                restoreFocus &&
                state.modalTrigger instanceof Element
            ) {
                state.modalTrigger.focus({
                    preventScroll: true
                });
            }

            state.modalTrigger = null;
        }

        emit(
            "robotacademy:modalclose",
            {
                modal: modalRoot
            },
            modalRoot
        );
    };

    const syncModals = (
        scope = document
    ) => {
        collect(
            [
                ".modal-backdrop",
                "[data-modal-root]",
                ".modal[id]"
            ].join(","),
            scope
        ).forEach((element) => {
            const modalRoot =
                findModalRoot(element) ||
                element;

            const isOpen =
                modalRoot.classList.contains(
                    "is-open"
                );

            modalRoot.hidden = !isOpen;

            modalRoot.setAttribute(
                "aria-hidden",
                String(!isOpen)
            );
        });
    };

    const handleModalClick = (event) => {
        const target = getEventTarget(event);

        if (!target) {
            return;
        }

        const openButton = target.closest(
            "[data-modal-open]"
        );

        if (openButton) {
            event.preventDefault();

            const reference =
                openButton.dataset.modalOpen ||
                openButton.getAttribute("href");

            openModal(reference, openButton);

            return;
        }

        const closeButton = target.closest(
            "[data-modal-close]"
        );

        if (closeButton) {
            event.preventDefault();

            const reference =
                closeButton.dataset.modalClose;

            const modalRoot = reference
                ? resolveModal(reference)
                : findModalRoot(closeButton);

            closeModal(modalRoot);

            return;
        }

        const modalRoot = findModalRoot(target);

        if (
            modalRoot &&
            target === modalRoot &&
            modalRoot.dataset.closeBackdrop !==
                "false"
        ) {
            closeModal(modalRoot);
        }
    };

    const trapModalFocus = (event) => {
        if (
            event.key !== "Tab" ||
            !state.activeModal
        ) {
            return;
        }

        const dialog = getModalDialog(
            state.activeModal
        );

        const focusable =
            getFocusableElements(dialog);

        if (!focusable.length) {
            event.preventDefault();
            dialog?.focus();

            return;
        }

        const first = focusable[0];
        const last =
            focusable[focusable.length - 1];

        if (
            event.shiftKey &&
            document.activeElement === first
        ) {
            event.preventDefault();
            last.focus();

            return;
        }

        if (
            !event.shiftKey &&
            document.activeElement === last
        ) {
            event.preventDefault();
            first.focus();
        }
    };


    /* =========================================================
       Toast
    ========================================================= */

    const getToastContainer = () => {
        let container = $(".toast-container");

        if (container) {
            return container;
        }

        container = document.createElement("div");
        container.className = "toast-container";
        container.setAttribute(
            "aria-live",
            "polite"
        );

        container.setAttribute(
            "aria-atomic",
            "false"
        );

        document.body.appendChild(container);

        return container;
    };

    const removeToast = (toast) => {
        if (!toast) {
            return;
        }

        const timer =
            state.toastTimers.get(toast);

        if (timer) {
            window.clearTimeout(timer);
        }

        toast.classList.remove("is-visible");
        toast.classList.add("is-leaving");

        const delay =
            reducedMotionMedia.matches
                ? 0
                : 200;

        window.setTimeout(() => {
            toast.remove();
        }, delay);
    };

    const showToast = (
        message,
        options = {}
    ) => {
        if (!message) {
            return null;
        }

        if (typeof options === "string") {
            options = {
                type: options
            };
        }

        const {
            type = "info",
            title = "",
            duration = 4000
        } = options;

        const container = getToastContainer();
        const toast = document.createElement(
            "div"
        );

        toast.className =
            `toast toast--${type}`;

        toast.setAttribute(
            "role",
            type === "danger" ||
            type === "error"
                ? "alert"
                : "status"
        );

        const content = document.createElement(
            "div"
        );

        content.className = "toast__content";

        if (title) {
            const titleElement =
                document.createElement("div");

            titleElement.className =
                "toast__title";

            titleElement.textContent = title;
            content.appendChild(titleElement);
        }

        const messageElement =
            document.createElement("div");

        messageElement.className =
            "toast__message";

        messageElement.textContent = message;
        content.appendChild(messageElement);

        const closeButton =
            document.createElement("button");

        closeButton.type = "button";
        closeButton.className =
            "toast__close icon-btn icon-btn--sm";

        closeButton.setAttribute(
            "aria-label",
            "關閉通知"
        );

        closeButton.setAttribute(
            "data-toast-close",
            ""
        );

        closeButton.textContent = "×";

        toast.append(
            content,
            closeButton
        );

        container.appendChild(toast);

        window.requestAnimationFrame(() => {
            toast.classList.add("is-visible");
        });

        if (duration > 0) {
            const timer = window.setTimeout(
                () => removeToast(toast),
                duration
            );

            state.toastTimers.set(
                toast,
                timer
            );

            toast.addEventListener(
                "mouseenter",
                () => {
                    window.clearTimeout(timer);
                },
                {
                    once: true
                }
            );
        }

        return toast;
    };


    /* =========================================================
       書籤
    ========================================================= */

    const getBookmarkId = (button) => {
        return (
            button.dataset.bookmarkId ||
            button.closest("[data-course-id]")
                ?.dataset.courseId ||
            ""
        );
    };

    const updateBookmarkButton = (
        button,
        active
    ) => {
        button.classList.toggle(
            "is-active",
            active
        );

        button.setAttribute(
            "aria-pressed",
            String(active)
        );

        button.setAttribute(
            "aria-label",
            active
                ? "移除收藏"
                : "加入收藏"
        );

        button.setAttribute(
            "title",
            active
                ? "移除收藏"
                : "加入收藏"
        );
    };

    const hydrateBookmarks = () => {
        const storedValue = storage.get(
            STORAGE_KEYS.bookmarks,
            null
        );

        if (storedValue !== null) {
            const bookmarks = storage.getJSON(
                STORAGE_KEYS.bookmarks,
                []
            );

            state.bookmarks = new Set(
                Array.isArray(bookmarks)
                    ? bookmarks
                    : []
            );

            return;
        }

        $$(
            [
                "[data-bookmark-toggle].is-active",
                ".course-card__bookmark.is-active"
            ].join(",")
        ).forEach((button) => {
            const id = getBookmarkId(button);

            if (id) {
                state.bookmarks.add(id);
            }
        });
    };

    const syncBookmarks = (
        scope = document
    ) => {
        collect(
            [
                "[data-bookmark-toggle]",
                ".course-card__bookmark"
            ].join(","),
            scope
        ).forEach((button) => {
            const id = getBookmarkId(button);

            const active = id
                ? state.bookmarks.has(id)
                : button.classList.contains(
                    "is-active"
                );

            updateBookmarkButton(
                button,
                active
            );
        });
    };

    const toggleBookmark = (button) => {
        const id = getBookmarkId(button);

        const currentlyActive =
            button.classList.contains(
                "is-active"
            );

        const nextActive = !currentlyActive;

        updateBookmarkButton(
            button,
            nextActive
        );

        if (id) {
            if (nextActive) {
                state.bookmarks.add(id);
            } else {
                state.bookmarks.delete(id);
            }

            storage.setJSON(
                STORAGE_KEYS.bookmarks,
                Array.from(state.bookmarks)
            );
        }

        showToast(
            nextActive
                ? "已加入收藏"
                : "已從收藏中移除",
            {
                type: nextActive
                    ? "success"
                    : "info",
                duration: 2200
            }
        );

        emit(
            "robotacademy:bookmarkchange",
            {
                id,
                active: nextActive
            },
            button
        );
    };


    /* =========================================================
       今日任務
    ========================================================= */

    const getTaskId = (taskItem) => {
        return (
            taskItem?.dataset.taskId ||
            taskItem
                ?.querySelector(
                    "[data-task-id]"
                )
                ?.dataset.taskId ||
            ""
        );
    };

    const updateTaskItem = (
        taskItem,
        completed
    ) => {
        if (!taskItem) {
            return;
        }

        taskItem.classList.toggle(
            "is-completed",
            completed
        );

        const control = $(
            [
                "[data-task-toggle]",
                ".task-item__check"
            ].join(","),
            taskItem
        );

        if (control) {
            control.setAttribute(
                "aria-pressed",
                String(completed)
            );

            control.setAttribute(
                "aria-label",
                completed
                    ? "標示為未完成"
                    : "標示為已完成"
            );

            if (
                !control.matches(
                    "button, input, a"
                )
            ) {
                control.setAttribute(
                    "role",
                    "button"
                );

                control.setAttribute(
                    "tabindex",
                    "0"
                );
            }
        }
    };

    const hydrateTasks = () => {
        const storedValue = storage.get(
            STORAGE_KEYS.completedTasks,
            null
        );

        if (storedValue !== null) {
            const tasks = storage.getJSON(
                STORAGE_KEYS.completedTasks,
                []
            );

            state.completedTasks = new Set(
                Array.isArray(tasks)
                    ? tasks
                    : []
            );

            return;
        }

        $$(".task-item.is-completed")
            .forEach((taskItem) => {
                const id = getTaskId(taskItem);

                if (id) {
                    state.completedTasks.add(id);
                }
            });
    };

    const syncTasks = (
        scope = document
    ) => {
        collect(".task-item", scope)
            .forEach((taskItem) => {
                const id = getTaskId(taskItem);

                const completed = id
                    ? state.completedTasks.has(id)
                    : taskItem.classList.contains(
                        "is-completed"
                    );

                updateTaskItem(
                    taskItem,
                    completed
                );
            });
    };

    const toggleTask = (control) => {
        const taskItem = control.closest(
            ".task-item"
        );

        if (!taskItem) {
            return;
        }

        const id = getTaskId(taskItem);

        const completed =
            !taskItem.classList.contains(
                "is-completed"
            );

        updateTaskItem(
            taskItem,
            completed
        );

        if (id) {
            if (completed) {
                state.completedTasks.add(id);
            } else {
                state.completedTasks.delete(id);
            }

            storage.setJSON(
                STORAGE_KEYS.completedTasks,
                Array.from(
                    state.completedTasks
                )
            );
        }

        emit(
            "robotacademy:taskchange",
            {
                id,
                completed
            },
            taskItem
        );
    };


    /* =========================================================
       密碼顯示與強度
    ========================================================= */

    const getPasswordInput = (button) => {
        const reference =
            button.dataset.passwordToggle;

        const referencedInput =
            resolveElement(reference);

        if (
            referencedInput instanceof
                HTMLInputElement
        ) {
            return referencedInput;
        }

        return button
            .closest(
                [
                    ".form-group",
                    ".input-group",
                    ".form-field"
                ].join(",")
            )
            ?.querySelector(
                "input[type='password'], input[data-password-input]"
            ) || null;
    };

    const togglePassword = (button) => {
        const input = getPasswordInput(button);

        if (!input) {
            return;
        }

        const shouldShow =
            input.type === "password";

        input.type = shouldShow
            ? "text"
            : "password";

        button.setAttribute(
            "aria-pressed",
            String(shouldShow)
        );

        button.setAttribute(
            "aria-label",
            shouldShow
                ? "隱藏密碼"
                : "顯示密碼"
        );

        button.setAttribute(
            "title",
            shouldShow
                ? "隱藏密碼"
                : "顯示密碼"
        );

        $$(
            "[data-password-icon]",
            button
        ).forEach((icon) => {
            const iconType =
                icon.dataset.passwordIcon;

            if (iconType === "show") {
                icon.hidden = shouldShow;
            }

            if (iconType === "hide") {
                icon.hidden = !shouldShow;
            }
        });
    };

    const calculatePasswordStrength = (
        password
    ) => {
        let score = 0;

        if (password.length >= 8) {
            score += 1;
        }

        if (password.length >= 12) {
            score += 1;
        }

        if (
            /[a-z]/.test(password) &&
            /[A-Z]/.test(password)
        ) {
            score += 1;
        }

        if (/\d/.test(password)) {
            score += 1;
        }

        if (
            /[^A-Za-z0-9]/.test(password)
        ) {
            score += 1;
        }

        if (!password) {
            return {
                strength: "",
                label: ""
            };
        }

        if (score <= 1) {
            return {
                strength: "weak",
                label: "弱"
            };
        }

        if (score === 2) {
            return {
                strength: "medium",
                label: "普通"
            };
        }

        if (score <= 4) {
            return {
                strength: "good",
                label: "良好"
            };
        }

        return {
            strength: "strong",
            label: "強"
        };
    };

    const updatePasswordStrength = (
        input
    ) => {
        const reference =
            input.dataset.passwordStrength;

        let indicator = resolveElement(
            reference
        );

        if (!indicator) {
            indicator = input
                .closest(
                    [
                        ".form-group",
                        ".form-field",
                        ".input-group"
                    ].join(",")
                )
                ?.querySelector(
                    ".password-strength"
                );
        }

        if (!indicator) {
            return;
        }

        const result =
            calculatePasswordStrength(
                input.value
            );

        indicator.dataset.strength =
            result.strength;

        const label = $(
            "[data-password-strength-label]",
            indicator.parentElement ||
                document
        );

        if (label) {
            label.textContent = result.label
                ? `密碼強度：${result.label}`
                : "";
        }
    };

    const syncPasswordStrength = (
        scope = document
    ) => {
        collect(
            "input[data-password-strength]",
            scope
        ).forEach(updatePasswordStrength);
    };


    /* =========================================================
       進度條
    ========================================================= */

    const syncProgressBars = (
        scope = document
    ) => {
        collect("[data-progress]", scope)
            .forEach((element) => {
                const rawValue =
                    element.dataset.progress ??
                    element.getAttribute(
                        "aria-valuenow"
                    ) ??
                    0;

                const value = clamp(
                    Number(rawValue) || 0,
                    0,
                    100
                );

                const bar =
                    element.matches(
                        ".progress__bar"
                    )
                        ? element
                        : $(
                            ".progress__bar",
                            element
                        );

                if (bar) {
                    bar.style.width =
                        `${value}%`;

                    bar.style.setProperty(
                        "--progress",
                        `${value}%`
                    );
                }

                element.setAttribute(
                    "aria-valuemin",
                    "0"
                );

                element.setAttribute(
                    "aria-valuemax",
                    "100"
                );

                element.setAttribute(
                    "aria-valuenow",
                    String(value)
                );
            });
    };


    /* =========================================================
       複製文字
    ========================================================= */

    const fallbackCopyText = (text) => {
        const textarea =
            document.createElement("textarea");

        textarea.value = text;
        textarea.setAttribute(
            "readonly",
            ""
        );

        textarea.style.position = "fixed";
        textarea.style.opacity = "0";
        textarea.style.pointerEvents = "none";

        document.body.appendChild(textarea);
        textarea.select();

        let successful = false;

        try {
            successful =
                document.execCommand("copy");
        } catch {
            successful = false;
        }

        textarea.remove();

        return successful;
    };

    const copyText = async (text) => {
        if (
            navigator.clipboard &&
            window.isSecureContext
        ) {
            try {
                await navigator.clipboard
                    .writeText(text);

                return true;
            } catch {
                return fallbackCopyText(text);
            }
        }

        return fallbackCopyText(text);
    };

    const getCopyContent = (button) => {
        const reference =
            button.dataset.copyTarget;

        const source =
            resolveElement(reference);

        if (source) {
            if (
                source instanceof
                    HTMLInputElement ||
                source instanceof
                    HTMLTextAreaElement
            ) {
                return source.value;
            }

            return source.textContent?.trim() || "";
        }

        const directValue =
            button.dataset.copy;

        if (directValue) {
            return directValue;
        }

        const localSource = button
            .closest("[data-copy-container]")
            ?.querySelector(
                "[data-copy-source]"
            );

        if (localSource) {
            return localSource.textContent
                ?.trim() || "";
        }

        return "";
    };


    /* =========================================================
       全站搜尋快捷鍵
    ========================================================= */

    const getGlobalSearchInput = () => {
        return $$(
            [
                "[data-global-search]",
                ".topbar-search__input"
            ].join(",")
        ).find(isVisible) || null;
    };

    const focusGlobalSearch = () => {
        const input = getGlobalSearchInput();

        if (!input) {
            return;
        }

        input.focus({
            preventScroll: true
        });

        if (
            typeof input.select === "function"
        ) {
            input.select();
        }
    };


    /* =========================================================
       目前年份
    ========================================================= */

    const syncCurrentYear = (
        scope = document
    ) => {
        const year = String(
            new Date().getFullYear()
        );

        collect("[data-current-year]", scope)
            .forEach((element) => {
                element.textContent = year;
            });
    };


    /* =========================================================
       導覽列目前頁面
    ========================================================= */

    const setActiveNavigation = () => {
        const links = $$(
            ".sidebar-nav__link[href]"
        );

        if (!links.length) {
            return;
        }

        links
            .filter((link) => {
                return link.hasAttribute(
                    "data-auto-current"
                );
            })
            .forEach((link) => {
                link.removeAttribute(
                    "aria-current"
                );

                link.removeAttribute(
                    "data-auto-current"
                );

                link.classList.remove(
                    "is-active"
                );
            });

        const explicitCurrent = links.find(
            (link) => {
                return (
                    link.getAttribute(
                        "aria-current"
                    ) === "page" &&
                    !link.hasAttribute(
                        "data-auto-current"
                    )
                );
            }
        );

        if (explicitCurrent) {
            return;
        }

        const currentUrl = new URL(
            window.location.href
        );

        let bestMatch = null;
        let bestScore = 0;

        links.forEach((link) => {
            const href = link
                .getAttribute("href")
                ?.trim();

            if (
                !href ||
                href === "#" ||
                href.startsWith("javascript:")
            ) {
                return;
            }

            let linkUrl;

            try {
                linkUrl = new URL(
                    href,
                    currentUrl
                );
            } catch {
                return;
            }

            if (
                linkUrl.origin !==
                currentUrl.origin
            ) {
                return;
            }

            if (
                linkUrl.pathname !==
                currentUrl.pathname
            ) {
                return;
            }

            let score = 1;

            if (
                linkUrl.search ===
                currentUrl.search
            ) {
                score += 1;
            }

            if (
                linkUrl.hash &&
                linkUrl.hash ===
                    currentUrl.hash
            ) {
                score += 3;
            } else if (
                !linkUrl.hash &&
                !currentUrl.hash
            ) {
                score += 2;
            }

            if (score > bestScore) {
                bestScore = score;
                bestMatch = link;
            }
        });

        if (!bestMatch) {
            return;
        }

        bestMatch.classList.add("is-active");

        bestMatch.setAttribute(
            "aria-current",
            "page"
        );

        bestMatch.setAttribute(
            "data-auto-current",
            ""
        );

        const parentItem =
            bestMatch.closest(
                ".sidebar-nav__item"
            );

        if (
            parentItem &&
            getSubmenuParts(parentItem)
                .submenu
        ) {
            setSubmenuState(
                parentItem,
                true
            );
        }
    };


    /* =========================================================
       通用點擊功能
    ========================================================= */

    const handleUtilityClick = async (
        event
    ) => {
        const target = getEventTarget(event);

        if (!target) {
            return;
        }

        const passwordButton =
            target.closest(
                "[data-password-toggle]"
            );

        if (passwordButton) {
            event.preventDefault();
            togglePassword(passwordButton);

            return;
        }

        const copyButton = target.closest(
            "[data-copy], [data-copy-target]"
        );

        if (copyButton) {
            event.preventDefault();

            const content =
                getCopyContent(copyButton);

            if (!content) {
                showToast(
                    "沒有可複製的內容",
                    {
                        type: "warning"
                    }
                );

                return;
            }

            const successful =
                await copyText(content);

            showToast(
                successful
                    ? "已複製到剪貼簿"
                    : "複製失敗，請手動複製",
                {
                    type: successful
                        ? "success"
                        : "danger"
                }
            );

            return;
        }

        const printButton = target.closest(
            "[data-print]"
        );

        if (printButton) {
            event.preventDefault();
            window.print();

            return;
        }

        const searchButton = target.closest(
            "[data-search-focus]"
        );

        if (searchButton) {
            event.preventDefault();
            focusGlobalSearch();

            return;
        }

        const scrollTopButton =
            target.closest(
                "[data-scroll-top]"
            );

        if (scrollTopButton) {
            event.preventDefault();

            window.scrollTo({
                top: 0,
                behavior:
                    reducedMotionMedia.matches
                        ? "auto"
                        : "smooth"
            });

            return;
        }

        const scrollButton = target.closest(
            "[data-scroll-to]"
        );

        if (scrollButton) {
            const destination =
                resolveElement(
                    scrollButton.dataset
                        .scrollTo
                );

            if (destination) {
                event.preventDefault();

                destination.scrollIntoView({
                    behavior:
                        reducedMotionMedia.matches
                            ? "auto"
                            : "smooth",
                    block: "start"
                });
            }

            return;
        }

        const toastButton = target.closest(
            "[data-toast]"
        );

        if (toastButton) {
            event.preventDefault();

            showToast(
                toastButton.dataset.toast,
                {
                    title:
                        toastButton.dataset
                            .toastTitle || "",
                    type:
                        toastButton.dataset
                            .toastType || "info",
                    duration:
                        Number(
                            toastButton.dataset
                                .toastDuration
                        ) || 4000
                }
            );

            return;
        }

        const toastCloseButton =
            target.closest(
                "[data-toast-close]"
            );

        if (toastCloseButton) {
            event.preventDefault();

            removeToast(
                toastCloseButton.closest(
                    ".toast"
                )
            );

            return;
        }

        const dismissButton =
            target.closest("[data-dismiss]");

        if (dismissButton) {
            event.preventDefault();

            const reference =
                dismissButton.dataset.dismiss;

            const dismissible = reference
                ? resolveElement(reference)
                : dismissButton.closest(
                    [
                        ".alert",
                        ".toast",
                        "[data-dismissible]"
                    ].join(",")
                );

            if (!dismissible) {
                return;
            }

            if (
                dismissible.classList.contains(
                    "toast"
                )
            ) {
                removeToast(dismissible);

                return;
            }

            dismissible.classList.add(
                "is-leaving"
            );

            window.setTimeout(() => {
                dismissible.remove();
            }, reducedMotionMedia.matches
                ? 0
                : 200);
        }
    };


    /* =========================================================
       收藏與任務點擊
    ========================================================= */

    const handleStateClick = (event) => {
        const target = getEventTarget(event);

        if (!target) {
            return;
        }

        const bookmarkButton =
            target.closest(
                [
                    "[data-bookmark-toggle]",
                    ".course-card__bookmark"
                ].join(",")
            );

        if (bookmarkButton) {
            event.preventDefault();
            event.stopPropagation();

            toggleBookmark(bookmarkButton);

            return;
        }

        const taskControl = target.closest(
            [
                "[data-task-toggle]",
                ".task-item__check"
            ].join(",")
        );

        if (taskControl) {
            event.preventDefault();
            toggleTask(taskControl);
        }
    };


    /* =========================================================
       表單輸入事件
    ========================================================= */

    const handleInput = (event) => {
        const target = getEventTarget(event);

        if (
            target instanceof
                HTMLInputElement &&
            target.matches(
                "[data-password-strength]"
            )
        ) {
            updatePasswordStrength(target);
        }
    };


    /* =========================================================
       確認操作
    ========================================================= */

    const handleConfirmation = (event) => {
        const target = getEventTarget(event);

        if (!target) {
            return;
        }

        const confirmElement = target.closest(
            "[data-confirm]"
        );

        if (!confirmElement) {
            return;
        }

        const message =
            confirmElement.dataset.confirm ||
            "確定要執行這個操作嗎？";

        if (!window.confirm(message)) {
            event.preventDefault();
            event.stopImmediatePropagation();
        }
    };


    /* =========================================================
       全站鍵盤操作
    ========================================================= */

    const handleGlobalKeydown = (event) => {
        trapModalFocus(event);

        if (
            event.key === "Escape" &&
            state.activeModal
        ) {
            event.preventDefault();
            closeModal();

            return;
        }

        if (event.key === "Escape") {
            closeDropdowns();

            if (
                getAppLayout()?.classList
                    .contains(
                        "is-sidebar-open"
                    )
            ) {
                closeSidebar();

                return;
            }

            if (
                getLessonLayout()?.classList
                    .contains(
                        "is-sidebar-open"
                    )
            ) {
                closeLessonSidebar();

                return;
            }
        }

        const target = getEventTarget(event);

        if (
            target?.matches(
                ".task-item__check"
            ) &&
            !target.matches("button, input, a") &&
            (
                event.key === "Enter" ||
                event.key === " "
            )
        ) {
            event.preventDefault();
            toggleTask(target);

            return;
        }

        if (
            target?.matches(
                [
                    "[data-dropdown-toggle]",
                    ".dropdown-toggle",
                    ".topbar-user"
                ].join(",")
            ) &&
            event.key === "ArrowDown"
        ) {
            const dropdown = target.closest(
                ".dropdown"
            );

            if (dropdown) {
                event.preventDefault();

                closeDropdowns(dropdown);

                setDropdownState(
                    dropdown,
                    true,
                    {
                        focusMenu: true
                    }
                );
            }

            return;
        }

        const isSearchShortcut =
            (
                (
                    event.ctrlKey ||
                    event.metaKey
                ) &&
                event.key.toLowerCase() === "k"
            ) ||
            (
                event.key === "/" &&
                !event.ctrlKey &&
                !event.metaKey &&
                !event.altKey
            );

        if (
            isSearchShortcut &&
            !isEditableElement(target)
        ) {
            const searchInput =
                getGlobalSearchInput();

            if (searchInput) {
                event.preventDefault();
                focusGlobalSearch();
            }
        }
    };


    /* =========================================================
       頁面動畫
    ========================================================= */

    const initializePageAnimation = () => {
        if (reducedMotionMedia.matches) {
            return;
        }

        const content = $(".app-content");

        if (
            !content ||
            content.classList.contains(
                "page-enter"
            )
        ) {
            return;
        }

        content.classList.add("page-enter");

        content.addEventListener(
            "animationend",
            () => {
                content.classList.remove(
                    "page-enter"
                );
            },
            {
                once: true
            }
        );
    };


    /* =========================================================
       視窗狀態
    ========================================================= */

    const handleMainSidebarMediaChange = () => {
        const layout = getAppLayout();

        if (!layout) {
            return;
        }

        if (!mobileSidebarMedia.matches) {
            layout.classList.remove(
                "is-sidebar-open"
            );

            unlockScroll("main-sidebar");
            restoreSidebarPreference();
        }

        syncSidebarState();
    };

    const handleLessonSidebarMediaChange =
        () => {
            const layout = getLessonLayout();

            if (!layout) {
                return;
            }

            if (!lessonSidebarMedia.matches) {
                layout.classList.remove(
                    "is-sidebar-open"
                );

                unlockScroll(
                    "lesson-sidebar"
                );
            }

            syncLessonSidebarState();
        };

    const handleSystemThemeChange = () => {
        if (getThemeMode() === "system") {
            syncThemeControls();

            emit(
                "robotacademy:themechange",
                {
                    mode: "system",
                    resolvedTheme:
                        getResolvedTheme()
                },
                root
            );
        }
    };

    const addMediaListener = (
        mediaQuery,
        handler
    ) => {
        if (
            typeof mediaQuery.addEventListener ===
            "function"
        ) {
            mediaQuery.addEventListener(
                "change",
                handler
            );
        } else {
            mediaQuery.addListener(handler);
        }
    };


    /* =========================================================
       UI 更新
    ========================================================= */

    const refresh = (
        scope = document
    ) => {
        syncThemeControls(scope);
        syncSidebarState();
        syncLessonSidebarState();
        syncSubmenus(scope);
        syncDropdowns(scope);
        syncAccordions(scope);
        syncTabs(scope);
        syncModals(scope);
        syncBookmarks(scope);
        syncTasks(scope);
        syncPasswordStrength(scope);
        syncProgressBars(scope);
        syncCurrentYear(scope);
    };


    /* =========================================================
       綁定事件
    ========================================================= */

    const bindEvents = () => {
        document.addEventListener(
            "click",
            handleThemeClick
        );

        document.addEventListener(
            "click",
            handleSidebarClick
        );

        document.addEventListener(
            "click",
            handleLessonSidebarClick
        );

        document.addEventListener(
            "click",
            handleSubmenuClick
        );

        document.addEventListener(
            "click",
            handleDropdownClick
        );

        document.addEventListener(
            "click",
            handleAccordionClick
        );

        document.addEventListener(
            "click",
            handleTabClick
        );

        document.addEventListener(
            "click",
            handleModalClick
        );

        document.addEventListener(
            "click",
            handleUtilityClick
        );

        document.addEventListener(
            "click",
            handleStateClick
        );

        document.addEventListener(
            "keydown",
            handleTabKeydown
        );

        document.addEventListener(
            "keydown",
            handleGlobalKeydown
        );

        document.addEventListener(
            "input",
            handleInput
        );

        document.addEventListener(
            "click",
            handleConfirmation,
            true
        );

        window.addEventListener(
            "hashchange",
            setActiveNavigation
        );

        window.addEventListener(
            "popstate",
            setActiveNavigation
        );

        addMediaListener(
            mobileSidebarMedia,
            handleMainSidebarMediaChange
        );

        addMediaListener(
            lessonSidebarMedia,
            handleLessonSidebarMediaChange
        );

        addMediaListener(
            systemDarkMedia,
            handleSystemThemeChange
        );
    };


    /* =========================================================
       初始化
    ========================================================= */

    const initialize = () => {
        restoreSidebarPreference();
        hydrateBookmarks();
        hydrateTasks();

        refresh();
        setActiveNavigation();
        initializePageAnimation();
        bindEvents();

        root.classList.add("is-ready");

        emit(
            "robotacademy:ready",
            {
                app: window.RobotAcademy
            },
            document
        );
    };


    /* ---------------------------------------------------------
       對外 API
    --------------------------------------------------------- */

    window.RobotAcademy = Object.assign(
        window.RobotAcademy || {},
        {
            version: "1.0.0",

            refresh,

            theme: {
                getMode: getThemeMode,
                getResolved: getResolvedTheme,
                set: setTheme,
                toggle: toggleTheme
            },

            sidebar: {
                open: openSidebar,
                close: closeSidebar,
                toggle: toggleSidebar,
                toggleCollapse:
                    toggleSidebarCollapse
            },

            lessonSidebar: {
                open: openLessonSidebar,
                close: closeLessonSidebar,
                toggle: toggleLessonSidebar
            },

            modal: {
                open: openModal,
                close: closeModal
            },

            toast: showToast,

            storage
        }
    );


    /* ---------------------------------------------------------
       優先套用已儲存的主題，避免畫面閃爍
    --------------------------------------------------------- */

    applyStoredTheme();

    if (
        document.readyState === "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            initialize,
            {
                once: true
            }
        );
    } else {
        initialize();
    }
})();
