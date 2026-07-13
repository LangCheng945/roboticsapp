/* =========================================================
   Robot Academy
   課程功能
========================================================= */

(() => {
    "use strict";

    const STORAGE_KEY =
        "robotAcademy:courseState:v1";

    let dataApi = null;
    let initialized = false;
    let eventsBound = false;
    let searchTimer = null;

    let elements = {};

    let filters = {
        query: "",
        category: "all",
        level: "all",
        sort: "default",
        featured: false,
        isNew: false
    };


    /* ---------------------------------------------------------
       基本工具
    --------------------------------------------------------- */

    const clone = (value) => {
        if (typeof structuredClone === "function") {
            return structuredClone(value);
        }

        return JSON.parse(JSON.stringify(value));
    };

    const escapeHTML = (value) => {
        const characters = {
            "&": "&amp;",
            "<": "&lt;",
            ">": "&gt;",
            "\"": "&quot;",
            "'": "&#039;"
        };

        return String(value ?? "").replace(
            /[&<>"']/g,
            (character) => characters[character]
        );
    };

    const clamp = (
        value,
        minimum,
        maximum
    ) => {
        return Math.min(
            Math.max(Number(value) || 0, minimum),
            maximum
        );
    };

    const toBoolean = (value) => {
        return (
            value === true ||
            value === 1 ||
            value === "1" ||
            value === "true"
        );
    };

    const uniqueStrings = (values) => {
        return [
            ...new Set(
                values.filter((value) => {
                    return (
                        typeof value === "string" &&
                        value.trim()
                    );
                })
            )
        ];
    };

    const formatNumber = (value) => {
        return new Intl.NumberFormat(
            "zh-TW"
        ).format(Number(value) || 0);
    };

    const formatDuration = (minutes) => {
        const totalMinutes = Math.max(
            0,
            Number(minutes) || 0
        );

        if (totalMinutes < 60) {
            return `${totalMinutes} 分鐘`;
        }

        const hours = Math.floor(
            totalMinutes / 60
        );

        const remainingMinutes =
            totalMinutes % 60;

        if (!remainingMinutes) {
            return `${hours} 小時`;
        }

        return (
            `${hours} 小時 ` +
            `${remainingMinutes} 分鐘`
        );
    };

    const formatDate = (dateValue) => {
        if (!dateValue) {
            return "";
        }

        const date = new Date(
            `${dateValue}T00:00:00`
        );

        if (Number.isNaN(date.getTime())) {
            return dateValue;
        }

        return new Intl.DateTimeFormat(
            "zh-TW",
            {
                year: "numeric",
                month: "long",
                day: "numeric"
            }
        ).format(date);
    };

    const addQueryParameter = (
        baseUrl,
        key,
        value
    ) => {
        const urlText = String(
            baseUrl || ""
        );

        const hashIndex =
            urlText.indexOf("#");

        const hash =
            hashIndex >= 0
                ? urlText.slice(hashIndex)
                : "";

        const urlWithoutHash =
            hashIndex >= 0
                ? urlText.slice(0, hashIndex)
                : urlText;

        const queryIndex =
            urlWithoutHash.indexOf("?");

        const path =
            queryIndex >= 0
                ? urlWithoutHash.slice(
                    0,
                    queryIndex
                )
                : urlWithoutHash;

        const query =
            queryIndex >= 0
                ? urlWithoutHash.slice(
                    queryIndex + 1
                )
                : "";

        const parameters =
            new URLSearchParams(query);

        parameters.set(
            key,
            String(value)
        );

        const finalQuery =
            parameters.toString();

        return (
            path +
            (finalQuery
                ? `?${finalQuery}`
                : "") +
            hash
        );
    };


    /* ---------------------------------------------------------
       資料 API
    --------------------------------------------------------- */

    const getDataApi = () => {
        return (
            window.RobotAcademyData ||
            window.RobotAcademy?.data ||
            null
        );
    };

    const getCategory = (categoryId) => {
        if (
            !dataApi ||
            typeof dataApi.getCategoryById !==
                "function"
        ) {
            return null;
        }

        return dataApi.getCategoryById(
            categoryId
        );
    };

    const getCourse = (courseId) => {
        if (
            !dataApi ||
            typeof dataApi.getCourseById !==
                "function"
        ) {
            return null;
        }

        return dataApi.getCourseById(
            courseId
        );
    };


    /* ---------------------------------------------------------
       網址
    --------------------------------------------------------- */

    const getCourseDetailUrl = (
        courseId
    ) => {
        const baseUrl =
            document.body?.dataset
                .courseDetailUrl ||
            "./course.html";

        return addQueryParameter(
            baseUrl,
            "id",
            courseId
        );
    };

    const getCourseListUrl = (
        categoryId = "all"
    ) => {
        const baseUrl =
            document.body?.dataset
                .courseListUrl ||
            "./courses.html";

        if (
            !categoryId ||
            categoryId === "all"
        ) {
            return baseUrl;
        }

        return addQueryParameter(
            baseUrl,
            "category",
            categoryId
        );
    };

    const getLessonUrl = (
        courseId
    ) => {
        const baseUrl =
            document.body?.dataset
                .lessonUrl;

        if (!baseUrl) {
            return "";
        }

        return addQueryParameter(
            baseUrl,
            "course",
            courseId
        );
    };


    /* ---------------------------------------------------------
       本機課程狀態
    --------------------------------------------------------- */

    const createDefaultCourseState = () => {
        return {
            favorites: [],
            started: [],
            progress: {}
        };
    };

    const readCourseState = () => {
        const defaultState =
            createDefaultCourseState();

        try {
            const rawValue =
                window.localStorage.getItem(
                    STORAGE_KEY
                );

            if (!rawValue) {
                return defaultState;
            }

            const savedState =
                JSON.parse(rawValue);

            const progress = {};

            if (
                savedState.progress &&
                typeof savedState.progress ===
                    "object"
            ) {
                Object.entries(
                    savedState.progress
                ).forEach(
                    ([
                        courseId,
                        percentage
                    ]) => {
                        progress[courseId] =
                            clamp(
                                percentage,
                                0,
                                100
                            );
                    }
                );
            }

            return {
                favorites: uniqueStrings(
                    Array.isArray(
                        savedState.favorites
                    )
                        ? savedState.favorites
                        : []
                ),
                started: uniqueStrings(
                    Array.isArray(
                        savedState.started
                    )
                        ? savedState.started
                        : []
                ),
                progress
            };
        } catch (error) {
            console.warn(
                "無法讀取課程狀態：",
                error
            );

            return defaultState;
        }
    };

    let courseState =
        readCourseState();

    const saveCourseState = () => {
        try {
            window.localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(courseState)
            );

            return true;
        } catch (error) {
            console.warn(
                "無法儲存課程狀態：",
                error
            );

            return false;
        }
    };

    const isFavorite = (courseId) => {
        return courseState.favorites.includes(
            courseId
        );
    };

    const isStarted = (courseId) => {
        return courseState.started.includes(
            courseId
        );
    };

    const getProgress = (courseId) => {
        return clamp(
            courseState.progress[courseId],
            0,
            100
        );
    };

    const syncFavoriteButtons = () => {
        document
            .querySelectorAll(
                "[data-course-favorite]"
            )
            .forEach((button) => {
                const courseId =
                    button.dataset
                        .courseFavorite;

                const favorite =
                    isFavorite(courseId);

                button.classList.toggle(
                    "is-active",
                    favorite
                );

                button.setAttribute(
                    "aria-pressed",
                    String(favorite)
                );

                button.setAttribute(
                    "aria-label",
                    favorite
                        ? "取消收藏課程"
                        : "收藏課程"
                );

                const icon =
                    button.querySelector(
                        "[data-favorite-icon]"
                    );

                if (icon) {
                    icon.textContent =
                        favorite
                            ? "♥"
                            : "♡";
                }

                const label =
                    button.querySelector(
                        "[data-favorite-label]"
                    );

                if (label) {
                    label.textContent =
                        favorite
                            ? "取消收藏"
                            : "收藏課程";
                }
            });
    };

    const getStartButtonText = (
        courseId
    ) => {
        const progress =
            getProgress(courseId);

        if (progress >= 100) {
            return "重新學習";
        }

        if (
            progress > 0 ||
            isStarted(courseId)
        ) {
            return "繼續學習";
        }

        return "開始學習";
    };

    const syncStartButtons = () => {
        document
            .querySelectorAll(
                "[data-course-start]"
            )
            .forEach((button) => {
                const courseId =
                    button.dataset
                        .courseStart;

                button.textContent =
                    getStartButtonText(
                        courseId
                    );
            });
    };

    const syncProgressElements = () => {
        document
            .querySelectorAll(
                "[data-course-progress-value]"
            )
            .forEach((element) => {
                const courseId =
                    element.dataset
                        .courseProgressValue;

                element.textContent =
                    `${getProgress(
                        courseId
                    )}%`;
            });

        document
            .querySelectorAll(
                "[data-course-progress-bar]"
            )
            .forEach((element) => {
                const courseId =
                    element.dataset
                        .courseProgressBar;

                const progress =
                    getProgress(courseId);

                element.style.width =
                    `${progress}%`;

                element.setAttribute(
                    "aria-valuenow",
                    String(progress)
                );
            });

        syncStartButtons();
    };

    const toggleFavorite = (
        courseId
    ) => {
        const course =
            getCourse(courseId);

        if (!course) {
            return false;
        }

        const favorite =
            isFavorite(courseId);

        if (favorite) {
            courseState.favorites =
                courseState.favorites.filter(
                    (id) => id !== courseId
                );
        } else {
            courseState.favorites.push(
                courseId
            );

            courseState.favorites =
                uniqueStrings(
                    courseState.favorites
                );
        }

        saveCourseState();
        syncFavoriteButtons();

        const newFavoriteState =
            !favorite;

        document.dispatchEvent(
            new CustomEvent(
                "robotacademy:favoritechange",
                {
                    detail: {
                        courseId,
                        favorite:
                            newFavoriteState,
                        course
                    }
                }
            )
        );

        showMessage(
            newFavoriteState
                ? "已加入收藏"
                : "已取消收藏"
        );

        return newFavoriteState;
    };

    const setProgress = (
        courseId,
        percentage
    ) => {
        const course =
            getCourse(courseId);

        if (!course) {
            return 0;
        }

        const progress = clamp(
            percentage,
            0,
            100
        );

        courseState.progress[courseId] =
            progress;

        if (
            progress > 0 &&
            !isStarted(courseId)
        ) {
            courseState.started.push(
                courseId
            );

            courseState.started =
                uniqueStrings(
                    courseState.started
                );
        }

        saveCourseState();
        syncProgressElements();

        document.dispatchEvent(
            new CustomEvent(
                "robotacademy:progresschange",
                {
                    detail: {
                        courseId,
                        progress,
                        course
                    }
                }
            )
        );

        return progress;
    };

    const startCourse = (
        courseId
    ) => {
        const course =
            getCourse(courseId);

        if (!course) {
            return false;
        }

        if (!isStarted(courseId)) {
            courseState.started.push(
                courseId
            );

            courseState.started =
                uniqueStrings(
                    courseState.started
                );

            saveCourseState();
        }

        syncStartButtons();

        document.dispatchEvent(
            new CustomEvent(
                "robotacademy:coursestart",
                {
                    detail: {
                        courseId,
                        course,
                        progress:
                            getProgress(
                                courseId
                            )
                    }
                }
            )
        );

        const lessonUrl =
            getLessonUrl(courseId);

        if (lessonUrl) {
            window.location.href =
                lessonUrl;

            return true;
        }

        showMessage(
            `已開始「${course.title}」`
        );

        return true;
    };


    /* ---------------------------------------------------------
       訊息提示
    --------------------------------------------------------- */

    const showMessage = (
        message,
        type = "success"
    ) => {
        const academy =
            window.RobotAcademy || {};

        if (
            typeof academy.showToast ===
            "function"
        ) {
            academy.showToast(
                message,
                type
            );

            return;
        }

        if (
            academy.ui &&
            typeof academy.ui.toast ===
                "function"
        ) {
            academy.ui.toast(
                message,
                type
            );

            return;
        }

        const oldMessage =
            document.querySelector(
                "[data-course-toast]"
            );

        if (oldMessage) {
            oldMessage.remove();
        }

        const toast =
            document.createElement("div");

        toast.dataset.courseToast = "";
        toast.className =
            `course-toast course-toast--${type}`;
        toast.setAttribute(
            "role",
            "status"
        );

        toast.textContent = message;

        Object.assign(
            toast.style,
            {
                position: "fixed",
                right: "20px",
                bottom: "20px",
                zIndex: "9999",
                maxWidth: "320px",
                padding: "12px 18px",
                color: "#ffffff",
                background:
                    type === "error"
                        ? "#dc3545"
                        : "#198754",
                borderRadius: "10px",
                boxShadow:
                    "0 8px 24px rgba(0, 0, 0, 0.2)"
            }
        );

        document.body.appendChild(
            toast
        );

        window.setTimeout(() => {
            toast.remove();
        }, 2200);
    };


    /* ---------------------------------------------------------
       DOM 元素
    --------------------------------------------------------- */

    const cacheElements = () => {
        elements = {
            categories:
                document.querySelector(
                    [
                        "[data-course-categories]",
                        "#courseCategories"
                    ].join(", ")
                ),

            mainGrid:
                document.querySelector(
                    [
                        "[data-course-grid]",
                        "#courseGrid"
                    ].join(", ")
                ),

            featuredGrid:
                document.querySelector(
                    [
                        "[data-featured-courses]",
                        "#featuredCourses"
                    ].join(", ")
                ),

            newGrid:
                document.querySelector(
                    [
                        "[data-new-courses]",
                        "#newCourses"
                    ].join(", ")
                ),

            detail:
                document.querySelector(
                    [
                        "[data-course-detail]",
                        "#courseDetail"
                    ].join(", ")
                ),

            search:
                document.querySelector(
                    [
                        "[data-course-search]",
                        "#courseSearch"
                    ].join(", ")
                ),

            categoryFilter:
                document.querySelector(
                    [
                        "[data-course-category-filter]",
                        "#courseCategoryFilter"
                    ].join(", ")
                ),

            levelFilter:
                document.querySelector(
                    [
                        "[data-course-level-filter]",
                        "#courseLevelFilter"
                    ].join(", ")
                ),

            sortFilter:
                document.querySelector(
                    [
                        "[data-course-sort]",
                        "#courseSort"
                    ].join(", ")
                ),

            featuredFilter:
                document.querySelector(
                    [
                        "[data-course-featured-filter]",
                        "#courseFeaturedFilter"
                    ].join(", ")
                ),

            newFilter:
                document.querySelector(
                    [
                        "[data-course-new-filter]",
                        "#courseNewFilter"
                    ].join(", ")
                ),

            resetButton:
                document.querySelector(
                    [
                        "[data-course-filter-reset]",
                        "#courseFilterReset"
                    ].join(", ")
                ),

            resultCount:
                document.querySelector(
                    [
                        "[data-course-result-count]",
                        "#courseResultCount"
                    ].join(", ")
                ),

            emptyState:
                document.querySelector(
                    [
                        "[data-course-empty]",
                        "#courseEmpty"
                    ].join(", ")
                )
        };
    };


    /* ---------------------------------------------------------
       課程卡片
    --------------------------------------------------------- */

    const createCourseCard = (
        course
    ) => {
        const category =
            getCategory(
                course.categoryId
            );

        const categoryName =
            category?.name ||
            "未分類";

        const levelLabel =
            dataApi.getLevelLabel(
                course.level
            );

        const progress =
            getProgress(course.id);

        const favorite =
            isFavorite(course.id);

        const detailUrl =
            getCourseDetailUrl(
                course.id
            );

        const badges = [
            course.featured
                ? `
                    <span class="course-badge course-badge--featured">
                        精選
                    </span>
                `
                : "",

            course.isNew
                ? `
                    <span class="course-badge course-badge--new">
                        最新
                    </span>
                `
                : ""
        ].join("");

        const tags = (
            course.tags || []
        )
            .slice(0, 3)
            .map((tag) => {
                return `
                    <span class="course-tag">
                        ${escapeHTML(tag)}
                    </span>
                `;
            })
            .join("");

        const progressMarkup =
            progress > 0
                ? `
                    <div class="course-card__progress">
                        <div class="course-progress__header">
                            <span>學習進度</span>

                            <span
                                data-course-progress-value="${escapeHTML(
                                    course.id
                                )}"
                            >
                                ${progress}%
                            </span>
                        </div>

                        <div
                            class="course-progress__track"
                            role="progressbar"
                            aria-label="課程進度"
                            aria-valuemin="0"
                            aria-valuemax="100"
                            aria-valuenow="${progress}"
                        >
                            <span
                                class="course-progress__bar"
                                data-course-progress-bar="${escapeHTML(
                                    course.id
                                )}"
                                style="width: ${progress}%"
                            ></span>
                        </div>
                    </div>
                `
                : "";

        return `
            <article
                class="course-card course-card--${escapeHTML(
                    course.color
                )}"
                data-course-card="${escapeHTML(
                    course.id
                )}"
            >
                <div class="course-card__top">
                    <div
                        class="course-card__icon"
                        aria-hidden="true"
                    >
                        ${escapeHTML(
                            course.icon
                        )}
                    </div>

                    <div class="course-card__badges">
                        ${badges}
                    </div>

                    <button
                        class="course-card__favorite ${
                            favorite
                                ? "is-active"
                                : ""
                        }"
                        type="button"
                        data-course-favorite="${escapeHTML(
                            course.id
                        )}"
                        aria-label="${
                            favorite
                                ? "取消收藏課程"
                                : "收藏課程"
                        }"
                        aria-pressed="${favorite}"
                    >
                        <span
                            data-favorite-icon
                            aria-hidden="true"
                        >
                            ${
                                favorite
                                    ? "♥"
                                    : "♡"
                            }
                        </span>

                        <span
                            class="sr-only"
                            data-favorite-label
                        >
                            ${
                                favorite
                                    ? "取消收藏"
                                    : "收藏課程"
                            }
                        </span>
                    </button>
                </div>

                <div class="course-card__body">
                    <div class="course-card__category">
                        ${escapeHTML(
                            categoryName
                        )}
                        ・
                        ${escapeHTML(
                            levelLabel
                        )}
                    </div>

                    <h3 class="course-card__title">
                        <a href="${escapeHTML(
                            detailUrl
                        )}">
                            ${escapeHTML(
                                course.title
                            )}
                        </a>
                    </h3>

                    <p class="course-card__subtitle">
                        ${escapeHTML(
                            course.subtitle
                        )}
                    </p>

                    <p class="course-card__description">
                        ${escapeHTML(
                            course.description
                        )}
                    </p>

                    <div class="course-card__meta">
                        <span>
                            📚
                            ${formatNumber(
                                course.lessonCount
                            )}
                            堂課
                        </span>

                        <span>
                            ⏱️
                            ${escapeHTML(
                                formatDuration(
                                    course.durationMinutes
                                )
                            )}
                        </span>
                    </div>

                    <div class="course-card__tags">
                        ${tags}
                    </div>

                    ${progressMarkup}
                </div>

                <footer class="course-card__footer">
                    <div class="course-card__rating">
                        <span aria-hidden="true">
                            ⭐
                        </span>

                        <strong>
                            ${escapeHTML(
                                course.rating
                            )}
                        </strong>

                        <span>
                            ${formatNumber(
                                course.studentCount
                            )}
                            位學生
                        </span>
                    </div>

                    <a
                        class="course-card__link"
                        href="${escapeHTML(
                            detailUrl
                        )}"
                    >
                        查看課程
                    </a>
                </footer>
            </article>
        `;
    };

    const renderCards = (
        container,
        courses,
        emptyMessage = "目前沒有符合條件的課程。"
    ) => {
        if (!container) {
            return;
        }

        if (!courses.length) {
            container.innerHTML =
                emptyMessage
                    ? `
                        <div class="course-empty-message">
                            <p>
                                ${escapeHTML(
                                    emptyMessage
                                )}
                            </p>
                        </div>
                    `
                    : "";

            return;
        }

        container.innerHTML =
            courses
                .map(createCourseCard)
                .join("");
    };


    /* ---------------------------------------------------------
       分類
    --------------------------------------------------------- */

    const renderCategories = () => {
        if (!elements.categories) {
            return;
        }

        const categories =
            dataApi.getCategories();

        elements.categories.innerHTML =
            categories
                .map((category) => {
                    const categoryUrl =
                        getCourseListUrl(
                            category.id
                        );

                    return `
                        <a
                            class="course-category course-category--${escapeHTML(
                                category.color
                            )}"
                            href="${escapeHTML(
                                categoryUrl
                            )}"
                            data-course-category-option="${escapeHTML(
                                category.id
                            )}"
                        >
                            <span
                                class="course-category__icon"
                                aria-hidden="true"
                            >
                                ${escapeHTML(
                                    category.icon
                                )}
                            </span>

                            <span class="course-category__content">
                                <strong>
                                    ${escapeHTML(
                                        category.name
                                    )}
                                </strong>

                                <span>
                                    ${escapeHTML(
                                        category.description
                                    )}
                                </span>

                                <small>
                                    ${formatNumber(
                                        category.courseCount
                                    )}
                                    門課程
                                </small>
                            </span>
                        </a>
                    `;
                })
                .join("");

        syncCategoryButtons();
    };

    const populateCategoryFilter = () => {
        const select =
            elements.categoryFilter;

        if (
            !select ||
            select.tagName !== "SELECT"
        ) {
            return;
        }

        const categories =
            dataApi.getCategories();

        select.innerHTML = `
            <option value="all">
                全部分類
            </option>

            ${categories
                .map((category) => {
                    return `
                        <option
                            value="${escapeHTML(
                                category.id
                            )}"
                        >
                            ${escapeHTML(
                                category.name
                            )}
                        </option>
                    `;
                })
                .join("")}
        `;
    };

    const syncCategoryButtons = () => {
        document
            .querySelectorAll(
                "[data-course-category-option]"
            )
            .forEach((element) => {
                const active =
                    element.dataset
                        .courseCategoryOption ===
                    filters.category;

                element.classList.toggle(
                    "is-active",
                    active
                );

                if (active) {
                    element.setAttribute(
                        "aria-current",
                        "true"
                    );
                } else {
                    element.removeAttribute(
                        "aria-current"
                    );
                }
            });
    };


    /* ---------------------------------------------------------
       篩選條件
    --------------------------------------------------------- */

    const readFiltersFromUrl = () => {
        const parameters =
            new URLSearchParams(
                window.location.search
            );

        filters.query =
            parameters.get("q") || "";

        filters.category =
            parameters.get("category") ||
            "all";

        filters.level =
            parameters.get("level") ||
            "all";

        filters.sort =
            parameters.get("sort") ||
            "default";

        filters.featured =
            toBoolean(
                parameters.get(
                    "featured"
                )
            );

        filters.isNew =
            toBoolean(
                parameters.get("new")
            );
    };

    const normalizeFilters = () => {
        const categoryIds =
            new Set(
                dataApi
                    .getCategories()
                    .map(
                        (category) =>
                            category.id
                    )
            );

        const validLevels =
            new Set([
                "all",
                "beginner",
                "intermediate",
                "advanced"
            ]);

        const validSorts =
            new Set([
                "default",
                "rating",
                "popular",
                "newest",
                "title"
            ]);

        filters.query =
            String(
                filters.query || ""
            ).trim();

        if (
            filters.category !== "all" &&
            !categoryIds.has(
                filters.category
            )
        ) {
            filters.category = "all";
        }

        if (
            !validLevels.has(
                filters.level
            )
        ) {
            filters.level = "all";
        }

        if (
            !validSorts.has(
                filters.sort
            )
        ) {
            filters.sort = "default";
        }

        filters.featured =
            toBoolean(filters.featured);

        filters.isNew =
            toBoolean(filters.isNew);
    };

    const syncFilterControls = () => {
        if (elements.search) {
            elements.search.value =
                filters.query;
        }

        if (elements.categoryFilter) {
            elements.categoryFilter.value =
                filters.category;
        }

        if (elements.levelFilter) {
            elements.levelFilter.value =
                filters.level;
        }

        if (elements.sortFilter) {
            elements.sortFilter.value =
                filters.sort;
        }

        if (elements.featuredFilter) {
            elements.featuredFilter.checked =
                filters.featured;
        }

        if (elements.newFilter) {
            elements.newFilter.checked =
                filters.isNew;
        }

        syncCategoryButtons();
    };

    const updateUrlFilters = () => {
        if (
            !elements.mainGrid ||
            !window.history.replaceState
        ) {
            return;
        }

        const url = new URL(
            window.location.href
        );

        const setOrDelete = (
            name,
            value,
            defaultValue
        ) => {
            if (
                value === defaultValue ||
                value === "" ||
                value === false
            ) {
                url.searchParams.delete(
                    name
                );
            } else {
                url.searchParams.set(
                    name,
                    String(value)
                );
            }
        };

        setOrDelete(
            "q",
            filters.query,
            ""
        );

        setOrDelete(
            "category",
            filters.category,
            "all"
        );

        setOrDelete(
            "level",
            filters.level,
            "all"
        );

        setOrDelete(
            "sort",
            filters.sort,
            "default"
        );

        setOrDelete(
            "featured",
            filters.featured
                ? "1"
                : "",
            ""
        );

        setOrDelete(
            "new",
            filters.isNew
                ? "1"
                : "",
            ""
        );

        window.history.replaceState(
            {},
            "",
            url
        );
    };

    const resetFilters = () => {
        filters = {
            query: "",
            category: "all",
            level: "all",
            sort: "default",
            featured: false,
            isNew: false
        };

        syncFilterControls();
        renderMainCourses();
        updateUrlFilters();
    };


    /* ---------------------------------------------------------
       課程列表
    --------------------------------------------------------- */

    const renderMainCourses = () => {
        if (!elements.mainGrid) {
            return [];
        }

        const courses =
            dataApi.searchCourses({
                query: filters.query,
                category:
                    filters.category,
                level: filters.level,
                sort: filters.sort,
                featured:
                    filters.featured,
                isNew: filters.isNew
            });

        if (elements.resultCount) {
            elements.resultCount.textContent =
                `找到 ${formatNumber(
                    courses.length
                )} 門課程`;
        }

        if (elements.emptyState) {
            elements.emptyState.hidden =
                courses.length > 0;
        }

        renderCards(
            elements.mainGrid,
            courses,
            elements.emptyState
                ? ""
                : "找不到符合條件的課程，請調整搜尋或篩選條件。"
        );

        syncFavoriteButtons();
        syncProgressElements();
        syncCategoryButtons();

        document.dispatchEvent(
            new CustomEvent(
                "robotacademy:coursesrendered",
                {
                    detail: {
                        courses:
                            clone(courses),
                        filters:
                            clone(filters)
                    }
                }
            )
        );

        return courses;
    };

    const renderHomeSections = () => {
        if (
            elements.featuredGrid &&
            elements.featuredGrid !==
                elements.mainGrid
        ) {
            renderCards(
                elements.featuredGrid,
                dataApi.getFeaturedCourses(
                    6
                ),
                "目前沒有精選課程。"
            );
        }

        if (
            elements.newGrid &&
            elements.newGrid !==
                elements.mainGrid
        ) {
            renderCards(
                elements.newGrid,
                dataApi.getNewCourses(6),
                "目前沒有最新課程。"
            );
        }

        syncFavoriteButtons();
        syncProgressElements();
    };


    /* ---------------------------------------------------------
       課程詳細資料
    --------------------------------------------------------- */

    const getRequestedCourseId = () => {
        const containerCourseId =
            elements.detail?.dataset
                .courseId;

        if (containerCourseId) {
            return containerCourseId;
        }

        const parameters =
            new URLSearchParams(
                window.location.search
            );

        return (
            parameters.get("id") ||
            parameters.get("course") ||
            ""
        );
    };

    const renderRelatedCourses = (
        courseId
    ) => {
        const relatedCourses =
            dataApi.getRelatedCourses(
                courseId,
                3
            );

        const containers = [
            ...document.querySelectorAll(
                [
                    "[data-course-related-list]",
                    "[data-related-courses]",
                    "#relatedCourses"
                ].join(", ")
            )
        ];

        [
            ...new Set(containers)
        ].forEach((container) => {
            renderCards(
                container,
                relatedCourses,
                "目前沒有相關課程。"
            );
        });

        syncFavoriteButtons();
        syncProgressElements();
    };

    const renderCourseDetail = () => {
        if (!elements.detail) {
            return;
        }

        const courseId =
            getRequestedCourseId();

        const course =
            getCourse(courseId);

        if (!course) {
            elements.detail.innerHTML = `
                <section class="course-not-found">
                    <div aria-hidden="true">
                        🤖
                    </div>

                    <h1>
                        找不到課程
                    </h1>

                    <p>
                        這門課程不存在，或網址不正確。
                    </p>

                    <a
                        href="${escapeHTML(
                            getCourseListUrl()
                        )}"
                    >
                        返回全部課程
                    </a>
                </section>
            `;

            return;
        }

        const category =
            course.category ||
            getCategory(
                course.categoryId
            );

        const categoryName =
            category?.name ||
            "未分類";

        const categoryUrl =
            getCourseListUrl(
                course.categoryId
            );

        const progress =
            getProgress(course.id);

        const favorite =
            isFavorite(course.id);

        const tags = (
            course.tags || []
        )
            .map((tag) => {
                return `
                    <span class="course-tag">
                        ${escapeHTML(tag)}
                    </span>
                `;
            })
            .join("");

        elements.detail.innerHTML = `
            <article
                class="course-detail course-detail--${escapeHTML(
                    course.color
                )}"
                data-course-id="${escapeHTML(
                    course.id
                )}"
            >
                <nav
                    class="course-detail__breadcrumb"
                    aria-label="麵包屑導覽"
                >
                    <a href="${escapeHTML(
                        getCourseListUrl()
                    )}">
                        全部課程
                    </a>

                    <span aria-hidden="true">
                        /
                    </span>

                    <a href="${escapeHTML(
                        categoryUrl
                    )}">
                        ${escapeHTML(
                            categoryName
                        )}
                    </a>

                    <span aria-hidden="true">
                        /
                    </span>

                    <span>
                        ${escapeHTML(
                            course.title
                        )}
                    </span>
                </nav>

                <header class="course-detail__hero">
                    <div
                        class="course-detail__icon"
                        aria-hidden="true"
                    >
                        ${escapeHTML(
                            course.icon
                        )}
                    </div>

                    <div class="course-detail__heading">
                        <div class="course-detail__badges">
                            ${
                                course.featured
                                    ? `
                                        <span class="course-badge course-badge--featured">
                                            精選課程
                                        </span>
                                    `
                                    : ""
                            }

                            ${
                                course.isNew
                                    ? `
                                        <span class="course-badge course-badge--new">
                                            最新課程
                                        </span>
                                    `
                                    : ""
                            }

                            <span class="course-badge">
                                ${escapeHTML(
                                    course.levelLabel
                                )}
                            </span>
                        </div>

                        <p class="course-detail__category">
                            ${escapeHTML(
                                categoryName
                            )}
                        </p>

                        <h1>
                            ${escapeHTML(
                                course.title
                            )}
                        </h1>

                        <p class="course-detail__subtitle">
                            ${escapeHTML(
                                course.subtitle
                            )}
                        </p>

                        <div class="course-detail__stats">
                            <span>
                                ⭐
                                <strong>
                                    ${escapeHTML(
                                        course.rating
                                    )}
                                </strong>
                            </span>

                            <span>
                                👥
                                ${formatNumber(
                                    course.studentCount
                                )}
                                位學生
                            </span>

                            <span>
                                📚
                                ${formatNumber(
                                    course.lessonCount
                                )}
                                堂課
                            </span>

                            <span>
                                ⏱️
                                ${escapeHTML(
                                    formatDuration(
                                        course.durationMinutes
                                    )
                                )}
                            </span>
                        </div>
                    </div>

                    <button
                        class="course-detail__favorite ${
                            favorite
                                ? "is-active"
                                : ""
                        }"
                        type="button"
                        data-course-favorite="${escapeHTML(
                            course.id
                        )}"
                        aria-label="${
                            favorite
                                ? "取消收藏課程"
                                : "收藏課程"
                        }"
                        aria-pressed="${favorite}"
                    >
                        <span
                            data-favorite-icon
                            aria-hidden="true"
                        >
                            ${
                                favorite
                                    ? "♥"
                                    : "♡"
                            }
                        </span>

                        <span data-favorite-label>
                            ${
                                favorite
                                    ? "取消收藏"
                                    : "收藏課程"
                            }
                        </span>
                    </button>
                </header>

                <div class="course-detail__layout">
                    <main class="course-detail__main">
                        <section class="course-detail__section">
                            <h2>
                                課程介紹
                            </h2>

                            <p>
                                ${escapeHTML(
                                    course.description
                                )}
                            </p>
                        </section>

                        <section class="course-detail__section">
                            <h2>
                                課程標籤
                            </h2>

                            <div class="course-detail__tags">
                                ${tags}
                            </div>
                        </section>

                        <section class="course-detail__section">
                            <h2>
                                課程資訊
                            </h2>

                            <dl class="course-detail__information">
                                <div>
                                    <dt>
                                        課程程度
                                    </dt>

                                    <dd>
                                        ${escapeHTML(
                                            course.levelLabel
                                        )}
                                    </dd>
                                </div>

                                <div>
                                    <dt>
                                        課程堂數
                                    </dt>

                                    <dd>
                                        ${formatNumber(
                                            course.lessonCount
                                        )}
                                        堂
                                    </dd>
                                </div>

                                <div>
                                    <dt>
                                        預計時間
                                    </dt>

                                    <dd>
                                        ${escapeHTML(
                                            formatDuration(
                                                course.durationMinutes
                                            )
                                        )}
                                    </dd>
                                </div>

                                <div>
                                    <dt>
                                        最後更新
                                    </dt>

                                    <dd>
                                        ${escapeHTML(
                                            formatDate(
                                                course.updatedAt
                                            )
                                        )}
                                    </dd>
                                </div>
                            </dl>
                        </section>
                    </main>

                    <aside class="course-detail__sidebar">
                        <div class="course-progress-card">
                            <h2>
                                我的學習進度
                            </h2>

                            <div class="course-progress__header">
                                <span>
                                    已完成
                                </span>

                                <strong
                                    data-course-progress-value="${escapeHTML(
                                        course.id
                                    )}"
                                >
                                    ${progress}%
                                </strong>
                            </div>

                            <div
                                class="course-progress__track"
                                role="progressbar"
                                aria-label="課程進度"
                                aria-valuemin="0"
                                aria-valuemax="100"
                                aria-valuenow="${progress}"
                            >
                                <span
                                    class="course-progress__bar"
                                    data-course-progress-bar="${escapeHTML(
                                        course.id
                                    )}"
                                    style="width: ${progress}%"
                                ></span>
                            </div>

                            <button
                                class="course-detail__start"
                                type="button"
                                data-course-start="${escapeHTML(
                                    course.id
                                )}"
                            >
                                ${escapeHTML(
                                    getStartButtonText(
                                        course.id
                                    )
                                )}
                            </button>
                        </div>
                    </aside>
                </div>

                <section class="course-detail__related">
                    <h2>
                        相關課程
                    </h2>

                    <div
                        class="course-grid"
                        data-course-related-list
                    ></div>
                </section>
            </article>
        `;

        renderRelatedCourses(
            course.id
        );

        syncFavoriteButtons();
        syncProgressElements();

        document.title =
            `${course.title}｜Robot Academy`;
    };


    /* ---------------------------------------------------------
       事件
    --------------------------------------------------------- */

    const applyFilters = () => {
        normalizeFilters();
        syncFilterControls();
        renderMainCourses();
        updateUrlFilters();
    };

    const bindEvents = () => {
        if (eventsBound) {
            return;
        }

        eventsBound = true;

        if (elements.search) {
            elements.search.addEventListener(
                "input",
                (event) => {
                    window.clearTimeout(
                        searchTimer
                    );

                    searchTimer =
                        window.setTimeout(
                            () => {
                                filters.query =
                                    event.target
                                        .value;

                                applyFilters();
                            },
                            250
                        );
                }
            );
        }

        if (elements.categoryFilter) {
            elements.categoryFilter
                .addEventListener(
                    "change",
                    (event) => {
                        filters.category =
                            event.target
                                .value;

                        applyFilters();
                    }
                );
        }

        if (elements.levelFilter) {
            elements.levelFilter
                .addEventListener(
                    "change",
                    (event) => {
                        filters.level =
                            event.target
                                .value;

                        applyFilters();
                    }
                );
        }

        if (elements.sortFilter) {
            elements.sortFilter
                .addEventListener(
                    "change",
                    (event) => {
                        filters.sort =
                            event.target
                                .value;

                        applyFilters();
                    }
                );
        }

        if (elements.featuredFilter) {
            elements.featuredFilter
                .addEventListener(
                    "change",
                    (event) => {
                        filters.featured =
                            event.target
                                .checked;

                        applyFilters();
                    }
                );
        }

        if (elements.newFilter) {
            elements.newFilter
                .addEventListener(
                    "change",
                    (event) => {
                        filters.isNew =
                            event.target
                                .checked;

                        applyFilters();
                    }
                );
        }

        if (elements.resetButton) {
            elements.resetButton
                .addEventListener(
                    "click",
                    resetFilters
                );
        }

        document.addEventListener(
            "click",
            (event) => {
                const target =
                    event.target instanceof
                    Element
                        ? event.target
                        : null;

                if (!target) {
                    return;
                }

                const favoriteButton =
                    target.closest(
                        "[data-course-favorite]"
                    );

                if (favoriteButton) {
                    event.preventDefault();
                    event.stopPropagation();

                    toggleFavorite(
                        favoriteButton.dataset
                            .courseFavorite
                    );

                    return;
                }

                const categoryButton =
                    target.closest(
                        "[data-course-category-option]"
                    );

                if (
                    categoryButton &&
                    elements.mainGrid
                ) {
                    event.preventDefault();

                    filters.category =
                        categoryButton.dataset
                            .courseCategoryOption;

                    applyFilters();

                    elements.mainGrid
                        .scrollIntoView({
                            behavior:
                                "smooth",
                            block: "start"
                        });

                    return;
                }

                const startButton =
                    target.closest(
                        "[data-course-start]"
                    );

                if (startButton) {
                    event.preventDefault();

                    startCourse(
                        startButton.dataset
                            .courseStart
                    );
                }
            }
        );

        window.addEventListener(
            "storage",
            (event) => {
                if (
                    event.key !== STORAGE_KEY
                ) {
                    return;
                }

                courseState =
                    readCourseState();

                syncFavoriteButtons();
                syncProgressElements();
            }
        );
    };


    /* ---------------------------------------------------------
       初始化
    --------------------------------------------------------- */

    const renderAll = () => {
        renderCategories();
        renderMainCourses();
        renderHomeSections();
        renderCourseDetail();
    };

    const init = () => {
        if (initialized) {
            return true;
        }

        dataApi = getDataApi();

        if (
            !dataApi ||
            typeof dataApi.searchCourses !==
                "function"
        ) {
            return false;
        }

        cacheElements();
        readFiltersFromUrl();
        normalizeFilters();
        populateCategoryFilter();
        syncFilterControls();
        bindEvents();
        renderAll();

        initialized = true;

        document.dispatchEvent(
            new CustomEvent(
                "robotacademy:courseready",
                {
                    detail: {
                        course: api
                    }
                }
            )
        );

        return true;
    };

    const refresh = () => {
        dataApi = getDataApi();

        if (!initialized) {
            return init();
        }

        cacheElements();
        populateCategoryFilter();
        normalizeFilters();
        syncFilterControls();
        renderAll();

        return true;
    };


    /* ---------------------------------------------------------
       公開 API
    --------------------------------------------------------- */

    const api = {
        version: "1.0.0",

        init,
        refresh,

        getCourse,

        search(options = {}) {
            const currentDataApi =
                getDataApi();

            if (
                !currentDataApi ||
                typeof currentDataApi
                    .searchCourses !==
                    "function"
            ) {
                return [];
            }

            return currentDataApi
                .searchCourses(options);
        },

        getFilters() {
            return clone(filters);
        },

        setFilters(newFilters = {}) {
            filters = {
                ...filters,
                ...newFilters
            };

            if (!initialized) {
                init();
            }

            applyFilters();

            return clone(filters);
        },

        resetFilters,

        isFavorite,
        toggleFavorite,

        getFavorites() {
            return clone(
                courseState.favorites
            );
        },

        getFavoriteCourses() {
            return courseState.favorites
                .map(getCourse)
                .filter(Boolean);
        },

        isStarted,
        startCourse,

        getStartedCourses() {
            return courseState.started
                .map(getCourse)
                .filter(Boolean);
        },

        getProgress,
        setProgress,

        getCourseState() {
            return clone(courseState);
        }
    };

    window.RobotAcademyCourse =
        api;

    window.RobotAcademy =
        window.RobotAcademy || {};

    window.RobotAcademy.course =
        api;


    /* ---------------------------------------------------------
       啟動
    --------------------------------------------------------- */

    const boot = () => {
        const ready = init();

        if (!ready) {
            document.addEventListener(
                "robotacademy:dataready",
                init,
                {
                    once: true
                }
            );
        }
    };

    if (
        document.readyState ===
        "loading"
    ) {
        document.addEventListener(
            "DOMContentLoaded",
            boot,
            {
                once: true
            }
        );
    } else {
        boot();
    }
})();
