/* =========================================================
   Robot Academy
   學習儀表板
========================================================= */

(() => {
    "use strict";

    const STORAGE_KEY =
        "robotAcademy:dashboardState:v1";

    const MAX_ACTIVITY_COUNT = 30;

    let initialized = false;
    let eventsBound = false;

    let dataApi = null;
    let courseApi = null;
    let authApi = null;
    let quizApi = null;

    let elements = {};


    /* ---------------------------------------------------------
       基本工具
    --------------------------------------------------------- */

    const clone = (value) => {
        if (value === undefined) {
            return undefined;
        }

        if (
            typeof structuredClone ===
            "function"
        ) {
            return structuredClone(value);
        }

        return JSON.parse(
            JSON.stringify(value)
        );
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
            (character) => {
                return characters[character];
            }
        );
    };

    const clamp = (
        value,
        minimum,
        maximum
    ) => {
        return Math.min(
            Math.max(
                Number(value) || 0,
                minimum
            ),
            maximum
        );
    };

    const formatNumber = (value) => {
        return new Intl.NumberFormat(
            "zh-TW"
        ).format(Number(value) || 0);
    };

    const getLocalDateKey = (
        date = new Date()
    ) => {
        const year = date.getFullYear();

        const month = String(
            date.getMonth() + 1
        ).padStart(2, "0");

        const day = String(
            date.getDate()
        ).padStart(2, "0");

        return `${year}-${month}-${day}`;
    };

    const formatDashboardDate = () => {
        return new Intl.DateTimeFormat(
            "zh-TW",
            {
                year: "numeric",
                month: "long",
                day: "numeric",
                weekday: "long"
            }
        ).format(new Date());
    };

    const formatShortDate = (
        dateValue
    ) => {
        if (!dateValue) {
            return "";
        }

        const date = new Date(
            `${dateValue}T00:00:00`
        );

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return String(dateValue);
        }

        return new Intl.DateTimeFormat(
            "zh-TW",
            {
                year: "numeric",
                month: "short",
                day: "numeric"
            }
        ).format(date);
    };

    const formatActivityTime = (
        dateValue
    ) => {
        const date = new Date(dateValue);

        if (
            Number.isNaN(
                date.getTime()
            )
        ) {
            return "";
        }

        const now = new Date();

        const difference =
            now.getTime() -
            date.getTime();

        const minute =
            60 * 1000;

        const hour =
            60 * minute;

        const day =
            24 * hour;

        if (
            difference >= 0 &&
            difference < minute
        ) {
            return "剛剛";
        }

        if (
            difference >= minute &&
            difference < hour
        ) {
            return (
                `${Math.floor(
                    difference / minute
                )} 分鐘前`
            );
        }

        if (
            difference >= hour &&
            difference < day
        ) {
            return (
                `${Math.floor(
                    difference / hour
                )} 小時前`
            );
        }

        return new Intl.DateTimeFormat(
            "zh-TW",
            {
                month: "numeric",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit"
            }
        ).format(date);
    };

    const addQueryParameter = (
        baseUrl,
        key,
        value
    ) => {
        const urlText =
            String(baseUrl || "");

        const hashIndex =
            urlText.indexOf("#");

        const hash =
            hashIndex >= 0
                ? urlText.slice(hashIndex)
                : "";

        const urlWithoutHash =
            hashIndex >= 0
                ? urlText.slice(
                    0,
                    hashIndex
                )
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
            (
                finalQuery
                    ? `?${finalQuery}`
                    : ""
            ) +
            hash
        );
    };

    const createId = () => {
        if (
            window.crypto &&
            typeof window.crypto
                .randomUUID === "function"
        ) {
            return window.crypto
                .randomUUID();
        }

        return (
            `activity-${Date.now()}-` +
            Math.random()
                .toString(36)
                .slice(2)
        );
    };

    const setTextAll = (
        selector,
        value
    ) => {
        document
            .querySelectorAll(selector)
            .forEach((element) => {
                element.textContent =
                    String(value);
            });
    };


    /* ---------------------------------------------------------
       API
    --------------------------------------------------------- */

    const resolveApis = () => {
        dataApi =
            window.RobotAcademyData ||
            window.RobotAcademy?.data ||
            null;

        courseApi =
            window.RobotAcademyCourse ||
            window.RobotAcademy?.course ||
            null;

        authApi =
            window.RobotAcademyAuth ||
            window.RobotAcademy?.auth ||
            null;

        quizApi =
            window.RobotAcademyQuiz ||
            window.RobotAcademy?.quiz ||
            null;
    };

    const safeCall = (
        object,
        methodNames,
        fallbackValue = null
    ) => {
        if (!object) {
            return fallbackValue;
        }

        for (
            const methodName
            of methodNames
        ) {
            if (
                typeof object[
                    methodName
                ] !== "function"
            ) {
                continue;
            }

            try {
                const result =
                    object[
                        methodName
                    ]();

                if (
                    result &&
                    typeof result.then ===
                        "function"
                ) {
                    continue;
                }

                return result ??
                    fallbackValue;
            } catch (error) {
                console.warn(
                    `無法執行 ${methodName}：`,
                    error
                );
            }
        }

        return fallbackValue;
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

    const getCourseListUrl = () => {
        return (
            document.body?.dataset
                .courseListUrl ||
            "./courses.html"
        );
    };

    const getLessonUrl = (
        courseId
    ) => {
        const baseUrl =
            document.body?.dataset
                .lessonUrl;

        if (!baseUrl) {
            return getCourseDetailUrl(
                courseId
            );
        }

        return addQueryParameter(
            baseUrl,
            "course",
            courseId
        );
    };

    const getQuizUrl = () => {
        return (
            document.body?.dataset
                .quizUrl ||
            "./quiz.html"
        );
    };

    const getTaskUrl = (task) => {
        if (task.type === "quiz") {
            return getQuizUrl();
        }

        if (task.courseId) {
            if (
                task.type === "lesson" ||
                task.type === "practice"
            ) {
                return getLessonUrl(
                    task.courseId
                );
            }

            return getCourseDetailUrl(
                task.courseId
            );
        }

        return "#";
    };


    /* ---------------------------------------------------------
       Dashboard 本機狀態
    --------------------------------------------------------- */

    const createDefaultState = () => {
        return {
            taskDate:
                getLocalDateKey(),

            completedTasks: [],

            activities: []
        };
    };

    const normalizeActivities = (
        activities
    ) => {
        if (
            !Array.isArray(activities)
        ) {
            return [];
        }

        return activities
            .filter((activity) => {
                return (
                    activity &&
                    typeof activity ===
                        "object" &&
                    activity.message
                );
            })
            .map((activity) => {
                return {
                    id:
                        String(
                            activity.id ||
                            createId()
                        ),

                    type:
                        String(
                            activity.type ||
                            "general"
                        ),

                    message:
                        String(
                            activity.message
                        ),

                    relatedId:
                        activity.relatedId
                            ? String(
                                activity
                                    .relatedId
                            )
                            : "",

                    createdAt:
                        activity.createdAt ||
                        new Date()
                            .toISOString()
                };
            })
            .slice(
                0,
                MAX_ACTIVITY_COUNT
            );
    };

    const readDashboardState = () => {
        const defaultState =
            createDefaultState();

        try {
            const rawValue =
                window.localStorage
                    .getItem(
                        STORAGE_KEY
                    );

            if (!rawValue) {
                return defaultState;
            }

            const savedState =
                JSON.parse(rawValue);

            const today =
                getLocalDateKey();

            const sameDay =
                savedState.taskDate ===
                today;

            return {
                taskDate: today,

                completedTasks:
                    sameDay &&
                    Array.isArray(
                        savedState
                            .completedTasks
                    )
                        ? [
                            ...new Set(
                                savedState
                                    .completedTasks
                                    .map(String)
                            )
                        ]
                        : [],

                activities:
                    normalizeActivities(
                        savedState.activities
                    )
            };
        } catch (error) {
            console.warn(
                "無法讀取儀表板資料：",
                error
            );

            return defaultState;
        }
    };

    let dashboardState =
        readDashboardState();

    const saveDashboardState = () => {
        try {
            window.localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(
                    dashboardState
                )
            );

            return true;
        } catch (error) {
            console.warn(
                "無法儲存儀表板資料：",
                error
            );

            return false;
        }
    };

    const recordActivity = (
        type,
        message,
        relatedId = ""
    ) => {
        const latestActivity =
            dashboardState
                .activities[0];

        const isDuplicate =
            latestActivity &&
            latestActivity.type ===
                type &&
            latestActivity.message ===
                message &&
            latestActivity.relatedId ===
                String(
                    relatedId || ""
                ) &&
            (
                Date.now() -
                new Date(
                    latestActivity
                        .createdAt
                ).getTime()
            ) < 3000;

        if (isDuplicate) {
            return latestActivity;
        }

        const activity = {
            id: createId(),
            type,
            message,
            relatedId:
                String(
                    relatedId || ""
                ),
            createdAt:
                new Date()
                    .toISOString()
        };

        dashboardState.activities
            .unshift(activity);

        dashboardState.activities =
            dashboardState.activities
                .slice(
                    0,
                    MAX_ACTIVITY_COUNT
                );

        saveDashboardState();

        return activity;
    };


    /* ---------------------------------------------------------
       使用者資料
    --------------------------------------------------------- */

    const getCurrentUser = () => {
        const user = safeCall(
            authApi,
            [
                "getCurrentUser",
                "getUser",
                "current"
            ],
            null
        );

        if (
            user &&
            typeof user === "object"
        ) {
            return user;
        }

        if (
            authApi?.currentUser &&
            typeof authApi
                .currentUser === "object"
        ) {
            return authApi.currentUser;
        }

        if (
            window.RobotAcademy
                ?.state?.user
        ) {
            return window
                .RobotAcademy
                .state
                .user;
        }

        return null;
    };

    const getUserName = (user) => {
        if (!user) {
            return "學員";
        }

        const name =
            user.displayName ||
            user.fullName ||
            user.name ||
            user.username;

        if (name) {
            return String(name);
        }

        if (user.email) {
            return String(
                user.email
            ).split("@")[0];
        }

        return "學員";
    };

    const getGreeting = () => {
        const hour =
            new Date().getHours();

        if (hour < 6) {
            return "晚安";
        }

        if (hour < 12) {
            return "早安";
        }

        if (hour < 18) {
            return "午安";
        }

        return "晚安";
    };

    const renderUser = () => {
        const user =
            getCurrentUser();

        const userName =
            getUserName(user);

        const greeting =
            getGreeting();

        setTextAll(
            [
                "[data-dashboard-user-name]",
                "#dashboardUserName"
            ].join(", "),
            userName
        );

        setTextAll(
            [
                "[data-dashboard-greeting]",
                "#dashboardGreeting"
            ].join(", "),
            `${greeting}，${userName}！`
        );

        setTextAll(
            [
                "[data-dashboard-date]",
                "#dashboardDate"
            ].join(", "),
            formatDashboardDate()
        );

        const firstCharacter =
            Array.from(
                userName.trim()
            )[0] || "學";

        setTextAll(
            [
                "[data-dashboard-avatar]",
                "#dashboardAvatar"
            ].join(", "),
            firstCharacter
        );
    };


    /* ---------------------------------------------------------
       課程狀態
    --------------------------------------------------------- */

    const getCourseState = () => {
        if (
            courseApi &&
            typeof courseApi
                .getCourseState ===
                "function"
        ) {
            try {
                return (
                    courseApi
                        .getCourseState() ||
                    {
                        favorites: [],
                        started: [],
                        progress: {}
                    }
                );
            } catch (error) {
                console.warn(
                    "無法取得課程狀態：",
                    error
                );
            }
        }

        return {
            favorites: [],
            started: [],
            progress: {}
        };
    };

    const getCourseById = (
        courseId
    ) => {
        if (
            dataApi &&
            typeof dataApi
                .getCourseById ===
                "function"
        ) {
            return dataApi
                .getCourseById(
                    courseId
                );
        }

        return null;
    };

    const getCourseProgress = (
        courseId
    ) => {
        if (
            courseApi &&
            typeof courseApi
                .getProgress ===
                "function"
        ) {
            try {
                return clamp(
                    courseApi.getProgress(
                        courseId
                    ),
                    0,
                    100
                );
            } catch (error) {
                console.warn(
                    "無法取得課程進度：",
                    error
                );
            }
        }

        const state =
            getCourseState();

        return clamp(
            state.progress?.[
                courseId
            ],
            0,
            100
        );
    };

    const getStartedCourses = () => {
        const state =
            getCourseState();

        return (
            state.started || []
        )
            .map(getCourseById)
            .filter(Boolean);
    };

    const getFavoriteCourses = () => {
        const state =
            getCourseState();

        return (
            state.favorites || []
        )
            .map(getCourseById)
            .filter(Boolean);
    };

    const getCompletedCourses = () => {
        const state =
            getCourseState();

        return Object.entries(
            state.progress || {}
        )
            .filter(([
                courseId,
                progress
            ]) => {
                return (
                    courseId &&
                    Number(progress) >= 100
                );
            })
            .map(([
                courseId
            ]) => {
                return getCourseById(
                    courseId
                );
            })
            .filter(Boolean);
    };

    const getContinueCourses = (
        limit = 4
    ) => {
        return getStartedCourses()
            .filter((course) => {
                return (
                    getCourseProgress(
                        course.id
                    ) < 100
                );
            })
            .sort((
                courseA,
                courseB
            ) => {
                return (
                    getCourseProgress(
                        courseB.id
                    ) -
                    getCourseProgress(
                        courseA.id
                    )
                );
            })
            .slice(0, limit);
    };


    /* ---------------------------------------------------------
       測驗統計
    --------------------------------------------------------- */

    const getFirstNumber = (
        object,
        keys,
        fallbackValue = 0
    ) => {
        for (const key of keys) {
            const value =
                Number(object?.[key]);

            if (
                Number.isFinite(value)
            ) {
                return value;
            }
        }

        return fallbackValue;
    };

    const getQuizSummary = () => {
        const rawStats = safeCall(
            quizApi,
            [
                "getStats",
                "getStatistics",
                "getSummary"
            ],
            {}
        );

        if (
            !rawStats ||
            typeof rawStats !== "object"
        ) {
            return {
                completed: 0,
                points: 0,
                bestScore: 0
            };
        }

        return {
            completed:
                getFirstNumber(
                    rawStats,
                    [
                        "completed",
                        "completedCount",
                        "attempts",
                        "totalAttempts",
                        "quizCount"
                    ]
                ),

            points:
                getFirstNumber(
                    rawStats,
                    [
                        "totalPoints",
                        "points",
                        "xp",
                        "experience"
                    ]
                ),

            bestScore:
                getFirstNumber(
                    rawStats,
                    [
                        "bestScore",
                        "highestScore",
                        "maxScore"
                    ]
                )
        };
    };


    /* ---------------------------------------------------------
       今日任務
    --------------------------------------------------------- */

    const getTasks = () => {
        if (
            !dataApi ||
            typeof dataApi.getTasks !==
                "function"
        ) {
            return [];
        }

        return dataApi.getTasks();
    };

    const isTaskCompleted = (
        taskId
    ) => {
        return dashboardState
            .completedTasks
            .includes(taskId);
    };

    const toggleTask = (
        taskId
    ) => {
        const task =
            getTasks().find(
                (item) => {
                    return (
                        item.id === taskId
                    );
                }
            );

        if (!task) {
            return false;
        }

        const completed =
            isTaskCompleted(taskId);

        if (completed) {
            dashboardState
                .completedTasks =
                dashboardState
                    .completedTasks
                    .filter((id) => {
                        return id !== taskId;
                    });

            recordActivity(
                "task",
                `取消完成任務「${task.title}」`,
                taskId
            );
        } else {
            dashboardState
                .completedTasks.push(
                    taskId
                );

            dashboardState
                .completedTasks = [
                    ...new Set(
                        dashboardState
                            .completedTasks
                    )
                ];

            recordActivity(
                "task",
                `完成今日任務「${task.title}」`,
                taskId
            );
        }

        saveDashboardState();
        renderAll();

        const newCompletedState =
            !completed;

        document.dispatchEvent(
            new CustomEvent(
                "robotacademy:taskchange",
                {
                    detail: {
                        task,
                        completed:
                            newCompletedState
                    }
                }
            )
        );

        showMessage(
            newCompletedState
                ? `完成任務，獲得 ${task.points} 點`
                : "已取消任務完成狀態"
        );

        return newCompletedState;
    };

    const resetTodayTasks = () => {
        dashboardState
            .completedTasks = [];

        dashboardState.taskDate =
            getLocalDateKey();

        saveDashboardState();
        renderAll();

        return true;
    };


    /* ---------------------------------------------------------
       統計資料
    --------------------------------------------------------- */

    const getSummary = () => {
        const tasks =
            getTasks();

        const completedTasks =
            tasks.filter((task) => {
                return isTaskCompleted(
                    task.id
                );
            });

        const startedCourses =
            getStartedCourses();

        const favoriteCourses =
            getFavoriteCourses();

        const completedCourses =
            getCompletedCourses();

        const quizSummary =
            getQuizSummary();

        const progressTotal =
            startedCourses.reduce(
                (
                    total,
                    course
                ) => {
                    return (
                        total +
                        getCourseProgress(
                            course.id
                        )
                    );
                },
                0
            );

        const averageProgress =
            startedCourses.length
                ? Math.round(
                    progressTotal /
                    startedCourses.length
                )
                : 0;

        const taskPoints =
            completedTasks.reduce(
                (total, task) => {
                    return (
                        total +
                        (
                            Number(
                                task.points
                            ) || 0
                        )
                    );
                },
                0
            );

        const coursePoints =
            completedCourses.length *
            100;

        return {
            startedCourses:
                startedCourses.length,

            completedCourses:
                completedCourses.length,

            favoriteCourses:
                favoriteCourses.length,

            completedTasks:
                completedTasks.length,

            totalTasks:
                tasks.length,

            quizzes:
                quizSummary.completed,

            quizBestScore:
                quizSummary.bestScore,

            averageProgress,

            points:
                taskPoints +
                coursePoints +
                quizSummary.points
        };
    };

    const renderStatistics = () => {
        const summary =
            getSummary();

        const values = {
            courses:
                formatNumber(
                    summary
                        .startedCourses
                ),

            started:
                formatNumber(
                    summary
                        .startedCourses
                ),

            completed:
                formatNumber(
                    summary
                        .completedCourses
                ),

            favorites:
                formatNumber(
                    summary
                        .favoriteCourses
                ),

            tasks:
                (
                    `${summary.completedTasks}` +
                    `/${summary.totalTasks}`
                ),

            points:
                formatNumber(
                    summary.points
                ),

            quizzes:
                formatNumber(
                    summary.quizzes
                ),

            progress:
                `${summary.averageProgress}%`
        };

        document
            .querySelectorAll(
                "[data-dashboard-stat]"
            )
            .forEach((element) => {
                const key =
                    element.dataset
                        .dashboardStat;

                if (
                    Object.prototype
                        .hasOwnProperty
                        .call(values, key)
                ) {
                    element.textContent =
                        values[key];
                }
            });

        setTextAll(
            "[data-dashboard-course-count]",
            values.courses
        );

        setTextAll(
            "[data-dashboard-completed-count]",
            values.completed
        );

        setTextAll(
            "[data-dashboard-favorite-count]",
            values.favorites
        );

        setTextAll(
            "[data-dashboard-point-count]",
            values.points
        );

        setTextAll(
            "[data-dashboard-progress-value]",
            values.progress
        );

        document
            .querySelectorAll(
                "[data-dashboard-progress-bar]"
            )
            .forEach((bar) => {
                bar.style.width =
                    `${summary.averageProgress}%`;

                bar.setAttribute(
                    "aria-valuenow",
                    String(
                        summary
                            .averageProgress
                    )
                );
            });

        const taskPercentage =
            summary.totalTasks
                ? Math.round(
                    (
                        summary
                            .completedTasks /
                        summary.totalTasks
                    ) *
                    100
                )
                : 0;

        setTextAll(
            "[data-dashboard-task-progress-value]",
            `${taskPercentage}%`
        );

        document
            .querySelectorAll(
                "[data-dashboard-task-progress-bar]"
            )
            .forEach((bar) => {
                bar.style.width =
                    `${taskPercentage}%`;

                bar.setAttribute(
                    "aria-valuenow",
                    String(
                        taskPercentage
                    )
                );
            });
    };


    /* ---------------------------------------------------------
       DOM 元素
    --------------------------------------------------------- */

    const cacheElements = () => {
        elements = {
            root:
                document.querySelector(
                    [
                        "[data-dashboard]",
                        "#dashboard"
                    ].join(", ")
                ),

            continueCourses:
                document.querySelector(
                    [
                        "[data-dashboard-continue]",
                        "#continueLearning",
                        "#dashboardContinueCourses"
                    ].join(", ")
                ),

            favoriteCourses:
                document.querySelector(
                    [
                        "[data-dashboard-favorites]",
                        "#dashboardFavorites"
                    ].join(", ")
                ),

            tasks:
                document.querySelector(
                    [
                        "[data-dashboard-tasks]",
                        "#dashboardTasks"
                    ].join(", ")
                ),

            announcements:
                document.querySelector(
                    [
                        "[data-dashboard-announcements]",
                        "#dashboardAnnouncements"
                    ].join(", ")
                ),

            activities:
                document.querySelector(
                    [
                        "[data-dashboard-activities]",
                        "[data-dashboard-activity]",
                        "#dashboardActivities",
                        "#dashboardActivity"
                    ].join(", ")
                )
        };
    };


    /* ---------------------------------------------------------
       Dashboard 課程卡片
    --------------------------------------------------------- */

    const createDashboardCourseCard = (
        course,
        options = {}
    ) => {
        const progress =
            getCourseProgress(
                course.id
            );

        const courseState =
            getCourseState();

        const favorite =
            (
                courseState.favorites ||
                []
            ).includes(course.id);

        const category =
            course.category ||
            dataApi?.getCategoryById?.(
                course.categoryId
            );

        const levelLabel =
            course.levelLabel ||
            dataApi?.getLevelLabel?.(
                course.level
            ) ||
            course.level;

        const startText =
            progress >= 100
                ? "重新學習"
                : progress > 0
                    ? "繼續學習"
                    : "開始學習";

        return `
            <article
                class="dashboard-course-card dashboard-course-card--${escapeHTML(
                    course.color || "blue"
                )}"
                data-dashboard-course="${escapeHTML(
                    course.id
                )}"
            >
                <div class="dashboard-course-card__header">
                    <span
                        class="dashboard-course-card__icon"
                        aria-hidden="true"
                    >
                        ${escapeHTML(
                            course.icon || "🤖"
                        )}
                    </span>

                    ${
                        options.recommended
                            ? `
                                <span class="dashboard-course-card__badge">
                                    推薦課程
                                </span>
                            `
                            : ""
                    }

                    <button
                        class="dashboard-course-card__favorite ${
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
                    </button>
                </div>

                <div class="dashboard-course-card__body">
                    <p class="dashboard-course-card__category">
                        ${escapeHTML(
                            category?.name ||
                            "未分類"
                        )}
                        ・
                        ${escapeHTML(
                            levelLabel
                        )}
                    </p>

                    <h3>
                        <a href="${escapeHTML(
                            getCourseDetailUrl(
                                course.id
                            )
                        )}">
                            ${escapeHTML(
                                course.title
                            )}
                        </a>
                    </h3>

                    <p>
                        ${escapeHTML(
                            course.subtitle ||
                            course.description ||
                            ""
                        )}
                    </p>

                    <div class="dashboard-course-card__meta">
                        <span>
                            📚
                            ${formatNumber(
                                course.lessonCount
                            )}
                            堂
                        </span>

                        <span>
                            ⭐
                            ${escapeHTML(
                                course.rating
                            )}
                        </span>
                    </div>
                </div>

                <div class="dashboard-course-card__progress">
                    <div>
                        <span>
                            學習進度
                        </span>

                        <strong>
                            ${progress}%
                        </strong>
                    </div>

                    <div
                        class="dashboard-progress"
                        role="progressbar"
                        aria-label="課程學習進度"
                        aria-valuemin="0"
                        aria-valuemax="100"
                        aria-valuenow="${progress}"
                    >
                        <span
                            style="width: ${progress}%"
                        ></span>
                    </div>
                </div>

                <footer class="dashboard-course-card__footer">
                    <a
                        href="${escapeHTML(
                            getCourseDetailUrl(
                                course.id
                            )
                        )}"
                    >
                        查看課程
                    </a>

                    <button
                        type="button"
                        data-course-start="${escapeHTML(
                            course.id
                        )}"
                    >
                        ${escapeHTML(
                            startText
                        )}
                    </button>
                </footer>
            </article>
        `;
    };

    const renderContinueCourses = () => {
        const container =
            elements.continueCourses;

        if (!container) {
            return;
        }

        let courses =
            getContinueCourses(4);

        let recommended = false;

        if (!courses.length) {
            recommended = true;

            courses =
                dataApi
                    ?.getFeaturedCourses?.(
                        4
                    ) || [];
        }

        if (!courses.length) {
            container.innerHTML = `
                <div class="dashboard-empty">
                    <span aria-hidden="true">
                        📚
                    </span>

                    <p>
                        目前沒有可顯示的課程。
                    </p>

                    <a href="${escapeHTML(
                        getCourseListUrl()
                    )}">
                        瀏覽全部課程
                    </a>
                </div>
            `;

            return;
        }

        container.innerHTML =
            courses
                .map((course) => {
                    return createDashboardCourseCard(
                        course,
                        {
                            recommended
                        }
                    );
                })
                .join("");
    };

    const renderFavoriteCourses = () => {
        const container =
            elements.favoriteCourses;

        if (!container) {
            return;
        }

        const courses =
            getFavoriteCourses()
                .slice(0, 4);

        if (!courses.length) {
            container.innerHTML = `
                <div class="dashboard-empty">
                    <span aria-hidden="true">
                        ♡
                    </span>

                    <p>
                        你還沒有收藏任何課程。
                    </p>

                    <a href="${escapeHTML(
                        getCourseListUrl()
                    )}">
                        尋找喜歡的課程
                    </a>
                </div>
            `;

            return;
        }

        container.innerHTML =
            courses
                .map((course) => {
                    return createDashboardCourseCard(
                        course
                    );
                })
                .join("");
    };


    /* ---------------------------------------------------------
       任務畫面
    --------------------------------------------------------- */

    const getPriorityLabel = (
        priority
    ) => {
        const labels = {
            high: "重要",
            medium: "一般",
            low: "次要"
        };

        return (
            labels[priority] ||
            labels.medium
        );
    };

    const getTaskIcon = (type) => {
        const icons = {
            lesson: "📚",
            quiz: "📝",
            practice: "🔧"
        };

        return icons[type] || "✅";
    };

    const renderTasks = () => {
        const container =
            elements.tasks;

        if (!container) {
            return;
        }

        const tasks =
            getTasks();

        if (!tasks.length) {
            container.innerHTML = `
                <div class="dashboard-empty">
                    <span aria-hidden="true">
                        ✅
                    </span>

                    <p>
                        今天沒有指定任務。
                    </p>
                </div>
            `;

            return;
        }

        container.innerHTML =
            tasks
                .map((task) => {
                    const completed =
                        isTaskCompleted(
                            task.id
                        );

                    return `
                        <article
                            class="dashboard-task ${
                                completed
                                    ? "is-completed"
                                    : ""
                            }"
                            data-dashboard-task="${escapeHTML(
                                task.id
                            )}"
                        >
                            <button
                                class="dashboard-task__check"
                                type="button"
                                data-dashboard-task-toggle="${escapeHTML(
                                    task.id
                                )}"
                                aria-label="${
                                    completed
                                        ? "取消完成任務"
                                        : "標示為已完成"
                                }"
                                aria-pressed="${completed}"
                            >
                                <span aria-hidden="true">
                                    ${
                                        completed
                                            ? "✓"
                                            : ""
                                    }
                                </span>
                            </button>

                            <div
                                class="dashboard-task__icon"
                                aria-hidden="true"
                            >
                                ${getTaskIcon(
                                    task.type
                                )}
                            </div>

                            <div class="dashboard-task__content">
                                <div class="dashboard-task__heading">
                                    <h3>
                                        ${escapeHTML(
                                            task.title
                                        )}
                                    </h3>

                                    <span
                                        class="dashboard-task__priority dashboard-task__priority--${escapeHTML(
                                            task.priority ||
                                            "medium"
                                        )}"
                                    >
                                        ${escapeHTML(
                                            getPriorityLabel(
                                                task.priority
                                            )
                                        )}
                                    </span>
                                </div>

                                <p>
                                    ${escapeHTML(
                                        task.description
                                    )}
                                </p>

                                <div class="dashboard-task__meta">
                                    <span>
                                        +${formatNumber(
                                            task.points
                                        )}
                                        點
                                    </span>

                                    <a href="${escapeHTML(
                                        getTaskUrl(task)
                                    )}">
                                        ${
                                            completed
                                                ? "再次查看"
                                                : "前往任務"
                                        }
                                    </a>
                                </div>
                            </div>
                        </article>
                    `;
                })
                .join("");
    };


    /* ---------------------------------------------------------
       公告
    --------------------------------------------------------- */

    const getAnnouncementIcon = (
        type
    ) => {
        const icons = {
            course: "📚",
            event: "🏆",
            system: "⚙️"
        };

        return icons[type] || "📢";
    };

    const renderAnnouncements = () => {
        const container =
            elements.announcements;

        if (!container) {
            return;
        }

        const announcements =
            dataApi
                ?.getAnnouncements?.(
                    5
                ) || [];

        if (!announcements.length) {
            container.innerHTML = `
                <div class="dashboard-empty">
                    <span aria-hidden="true">
                        📢
                    </span>

                    <p>
                        目前沒有最新公告。
                    </p>
                </div>
            `;

            return;
        }

        container.innerHTML =
            announcements
                .map(
                    (announcement) => {
                        return `
                            <article
                                class="dashboard-announcement ${
                                    announcement
                                        .important
                                        ? "is-important"
                                        : ""
                                }"
                            >
                                <div
                                    class="dashboard-announcement__icon"
                                    aria-hidden="true"
                                >
                                    ${getAnnouncementIcon(
                                        announcement.type
                                    )}
                                </div>

                                <div class="dashboard-announcement__content">
                                    <div class="dashboard-announcement__heading">
                                        <h3>
                                            ${escapeHTML(
                                                announcement.title
                                            )}
                                        </h3>

                                        ${
                                            announcement
                                                .important
                                                ? `
                                                    <span>
                                                        重要
                                                    </span>
                                                `
                                                : ""
                                        }
                                    </div>

                                    <p>
                                        ${escapeHTML(
                                            announcement.content
                                        )}
                                    </p>

                                    <time
                                        datetime="${escapeHTML(
                                            announcement.date
                                        )}"
                                    >
                                        ${escapeHTML(
                                            formatShortDate(
                                                announcement.date
                                            )
                                        )}
                                    </time>
                                </div>
                            </article>
                        `;
                    }
                )
                .join("");
    };


    /* ---------------------------------------------------------
       最近活動
    --------------------------------------------------------- */

    const getActivityIcon = (
        type
    ) => {
        const icons = {
            task: "✅",
            course: "📚",
            progress: "📈",
            complete: "🏆",
            favorite: "♥",
            quiz: "📝",
            general: "🤖"
        };

        return (
            icons[type] ||
            icons.general
        );
    };

    const renderActivities = () => {
        const container =
            elements.activities;

        if (!container) {
            return;
        }

        const activities =
            dashboardState
                .activities
                .slice(0, 8);

        if (!activities.length) {
            container.innerHTML = `
                <div class="dashboard-empty">
                    <span aria-hidden="true">
                        🕒
                    </span>

                    <p>
                        完成課程或任務後，活動紀錄會顯示在這裡。
                    </p>
                </div>
            `;

            return;
        }

        container.innerHTML =
            activities
                .map((activity) => {
                    return `
                        <article class="dashboard-activity">
                            <div
                                class="dashboard-activity__icon"
                                aria-hidden="true"
                            >
                                ${getActivityIcon(
                                    activity.type
                                )}
                            </div>

                            <div class="dashboard-activity__content">
                                <p>
                                    ${escapeHTML(
                                        activity.message
                                    )}
                                </p>

                                <time
                                    datetime="${escapeHTML(
                                        activity.createdAt
                                    )}"
                                >
                                    ${escapeHTML(
                                        formatActivityTime(
                                            activity.createdAt
                                        )
                                    )}
                                </time>
                            </div>
                        </article>
                    `;
                })
                .join("");
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

        const oldToast =
            document.querySelector(
                "[data-dashboard-toast]"
            );

        if (oldToast) {
            oldToast.remove();
        }

        const toast =
            document.createElement("div");

        toast.dataset.dashboardToast =
            "";

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
                maxWidth: "340px",
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
       畫面更新
    --------------------------------------------------------- */

    const renderAll = () => {
        renderUser();
        renderStatistics();
        renderContinueCourses();
        renderFavoriteCourses();
        renderTasks();
        renderAnnouncements();
        renderActivities();

        document.dispatchEvent(
            new CustomEvent(
                "robotacademy:dashboardrendered",
                {
                    detail: {
                        summary:
                            getSummary()
                    }
                }
            )
        );
    };


    /* ---------------------------------------------------------
       全站事件同步
    --------------------------------------------------------- */

    const handleCourseStart = (
        event
    ) => {
        const course =
            event.detail?.course;

        const courseId =
            event.detail?.courseId ||
            course?.id;

        if (courseId) {
            recordActivity(
                "course",
                `開始學習「${
                    course?.title ||
                    getCourseById(
                        courseId
                    )?.title ||
                    "課程"
                }」`,
                courseId
            );
        }

        renderAll();
    };

    const handleFavoriteChange = (
        event
    ) => {
        const detail =
            event.detail || {};

        if (detail.favorite) {
            const title =
                detail.course?.title ||
                getCourseById(
                    detail.courseId
                )?.title ||
                "課程";

            recordActivity(
                "favorite",
                `收藏課程「${title}」`,
                detail.courseId
            );
        }

        renderAll();
    };

    const handleProgressChange = (
        event
    ) => {
        const detail =
            event.detail || {};

        if (
            Number(detail.progress) >=
            100
        ) {
            const title =
                detail.course?.title ||
                getCourseById(
                    detail.courseId
                )?.title ||
                "課程";

            recordActivity(
                "complete",
                `完成課程「${title}」`,
                detail.courseId
            );
        }

        renderAll();
    };

    const handleQuizComplete = (
        event
    ) => {
        const detail =
            event.detail || {};

        const rawScore =
            detail.percentage ??
            detail.score ??
            detail.result?.percentage;

        const score =
            Number(rawScore);

        const message =
            Number.isFinite(score)
                ? (
                    `完成知識測驗，` +
                    `得分 ${Math.round(
                        score
                    )}%`
                )
                : "完成知識測驗";

        recordActivity(
            "quiz",
            message,
            detail.quizId ||
            detail.id ||
            ""
        );

        renderAll();
    };


    /* ---------------------------------------------------------
       事件綁定
    --------------------------------------------------------- */

    const bindEvents = () => {
        if (eventsBound) {
            return;
        }

        eventsBound = true;

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

                const taskButton =
                    target.closest(
                        "[data-dashboard-task-toggle]"
                    );

                if (taskButton) {
                    event.preventDefault();

                    toggleTask(
                        taskButton.dataset
                            .dashboardTaskToggle
                    );
                }
            }
        );

        document.addEventListener(
            "robotacademy:coursestart",
            handleCourseStart
        );

        document.addEventListener(
            "robotacademy:favoritechange",
            handleFavoriteChange
        );

        document.addEventListener(
            "robotacademy:progresschange",
            handleProgressChange
        );

        document.addEventListener(
            "robotacademy:quizcomplete",
            handleQuizComplete
        );

        document.addEventListener(
            "robotacademy:quizcompleted",
            handleQuizComplete
        );

        [
            "robotacademy:authchange",
            "robotacademy:login",
            "robotacademy:logout",
            "robotacademy:userchange"
        ].forEach((eventName) => {
            document.addEventListener(
                eventName,
                () => {
                    resolveApis();
                    renderUser();
                }
            );
        });

        window.addEventListener(
            "storage",
            (event) => {
                if (
                    event.key ===
                    STORAGE_KEY
                ) {
                    dashboardState =
                        readDashboardState();
                }

                resolveApis();
                renderAll();
            }
        );
    };


    /* ---------------------------------------------------------
       初始化
    --------------------------------------------------------- */

    const init = () => {
        if (initialized) {
            return true;
        }

        resolveApis();

        if (
            !dataApi ||
            typeof dataApi.getTasks !==
                "function"
        ) {
            return false;
        }

        dashboardState =
            readDashboardState();

        saveDashboardState();

        cacheElements();
        bindEvents();
        renderAll();

        initialized = true;

        document.dispatchEvent(
            new CustomEvent(
                "robotacademy:dashboardready",
                {
                    detail: {
                        dashboard: api
                    }
                }
            )
        );

        return true;
    };

    const refresh = () => {
        resolveApis();

        if (!initialized) {
            return init();
        }

        dashboardState =
            readDashboardState();

        cacheElements();
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

        getSummary,

        getState() {
            return clone(
                dashboardState
            );
        },

        getCompletedTasks() {
            return clone(
                dashboardState
                    .completedTasks
            );
        },

        isTaskCompleted,
        toggleTask,
        resetTodayTasks,

        getActivities() {
            return clone(
                dashboardState
                    .activities
            );
        },

        addActivity(
            type,
            message,
            relatedId = ""
        ) {
            const activity =
                recordActivity(
                    type,
                    message,
                    relatedId
                );

            renderActivities();

            return clone(activity);
        },

        clearActivities() {
            dashboardState
                .activities = [];

            saveDashboardState();
            renderActivities();

            return true;
        }
    };

    window.RobotAcademyDashboard =
        api;

    window.RobotAcademy =
        window.RobotAcademy || {};

    window.RobotAcademy.dashboard =
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
