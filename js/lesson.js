/* =========================================================
   Robot Academy
   課程學習與單元功能
========================================================= */

(() => {
    "use strict";

    const STORAGE_KEY =
        "robotAcademy:lessonState:v1";

    const NOTE_SAVE_DELAY = 500;

    let initialized = false;
    let eventsBound = false;

    let dataApi = null;
    let courseApi = null;

    let elements = {};

    let currentCourse = null;
    let currentLessons = [];
    let currentLesson = null;

    let noteSaveTimer = null;
    let pendingNote = null;


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

    const uniqueStrings = (values) => {
        if (!Array.isArray(values)) {
            return [];
        }

        return [
            ...new Set(
                values
                    .map(String)
                    .filter(Boolean)
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

        if (!totalMinutes) {
            return "";
        }

        if (totalMinutes < 60) {
            return `${totalMinutes} 分鐘`;
        }

        const hours = Math.floor(
            totalMinutes / 60
        );

        const remainingMinutes =
            totalMinutes % 60;

        return remainingMinutes
            ? `${hours} 小時 ${remainingMinutes} 分鐘`
            : `${hours} 小時`;
    };

    const safeUrl = (value) => {
        const text = String(
            value || ""
        ).trim();

        if (!text) {
            return "";
        }

        try {
            const url = new URL(
                text,
                window.location.href
            );

            const allowedProtocols =
                new Set([
                    "http:",
                    "https:",
                    "mailto:",
                    "tel:"
                ]);

            if (
                !allowedProtocols.has(
                    url.protocol
                )
            ) {
                return "";
            }

            return text;
        } catch (error) {
            return "";
        }
    };

    const addQueryParameters = (
        baseUrl,
        parameters
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

        const withoutHash =
            hashIndex >= 0
                ? urlText.slice(
                    0,
                    hashIndex
                )
                : urlText;

        const queryIndex =
            withoutHash.indexOf("?");

        const path =
            queryIndex >= 0
                ? withoutHash.slice(
                    0,
                    queryIndex
                )
                : withoutHash;

        const query =
            queryIndex >= 0
                ? withoutHash.slice(
                    queryIndex + 1
                )
                : "";

        const searchParameters =
            new URLSearchParams(query);

        Object.entries(
            parameters || {}
        ).forEach(([
            key,
            value
        ]) => {
            if (
                value === undefined ||
                value === null ||
                value === ""
            ) {
                searchParameters.delete(
                    key
                );
            } else {
                searchParameters.set(
                    key,
                    String(value)
                );
            }
        });

        const finalQuery =
            searchParameters.toString();

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

    const setTextAll = (
        selector,
        value
    ) => {
        document
            .querySelectorAll(selector)
            .forEach((element) => {
                element.textContent =
                    String(value ?? "");
            });
    };

    const renderParagraphs = (
        text
    ) => {
        const value = String(
            text || ""
        ).trim();

        if (!value) {
            return "";
        }

        return value
            .split(/\n\s*\n/)
            .map((paragraph) => {
                return `
                    <p>
                        ${escapeHTML(
                            paragraph.trim()
                        ).replace(
                            /\n/g,
                            "<br>"
                        )}
                    </p>
                `;
            })
            .join("");
    };

    const sanitizeHTML = (html) => {
        const template =
            document.createElement(
                "template"
            );

        template.innerHTML =
            String(html || "");

        template.content
            .querySelectorAll(
                [
                    "script",
                    "style",
                    "iframe",
                    "object",
                    "embed",
                    "form",
                    "input",
                    "button",
                    "link",
                    "meta"
                ].join(", ")
            )
            .forEach((element) => {
                element.remove();
            });

        template.content
            .querySelectorAll("*")
            .forEach((element) => {
                [
                    ...element.attributes
                ].forEach((attribute) => {
                    const name =
                        attribute.name
                            .toLowerCase();

                    if (
                        name.startsWith("on") ||
                        name === "style" ||
                        name === "srcdoc"
                    ) {
                        element.removeAttribute(
                            attribute.name
                        );

                        return;
                    }

                    if (
                        [
                            "href",
                            "src",
                            "xlink:href"
                        ].includes(name) &&
                        !safeUrl(
                            attribute.value
                        )
                    ) {
                        element.removeAttribute(
                            attribute.name
                        );
                    }
                });

                if (
                    element.getAttribute(
                        "target"
                    ) === "_blank"
                ) {
                    element.setAttribute(
                        "rel",
                        "noopener noreferrer"
                    );
                }
            });

        return template.innerHTML;
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
    };

    const getCourseById = (
        courseId
    ) => {
        if (
            !dataApi ||
            typeof dataApi.getCourseById !==
                "function"
        ) {
            return null;
        }

        try {
            return dataApi.getCourseById(
                courseId
            );
        } catch (error) {
            console.warn(
                "無法取得課程資料：",
                error
            );

            return null;
        }
    };


    /* ---------------------------------------------------------
       網址
    --------------------------------------------------------- */

    const getCourseListUrl = () => {
        return (
            document.body?.dataset
                .courseListUrl ||
            "./courses.html"
        );
    };

    const getCourseDetailUrl = (
        courseId
    ) => {
        const baseUrl =
            document.body?.dataset
                .courseDetailUrl ||
            "./course.html";

        return addQueryParameters(
            baseUrl,
            {
                id: courseId
            }
        );
    };

    const getLessonPageUrl = (
        courseId,
        lessonId
    ) => {
        const baseUrl =
            document.body?.dataset
                .lessonUrl ||
            "./lesson.html";

        return addQueryParameters(
            baseUrl,
            {
                course: courseId,
                lesson: lessonId
            }
        );
    };

    const updateLessonUrl = (
        courseId,
        lessonId,
        mode = "replace"
    ) => {
        if (
            !window.history ||
            !courseId ||
            !lessonId
        ) {
            return;
        }

        const url = new URL(
            window.location.href
        );

        url.searchParams.set(
            "course",
            courseId
        );

        url.searchParams.set(
            "lesson",
            lessonId
        );

        const method =
            mode === "push"
                ? "pushState"
                : "replaceState";

        window.history[method](
            {
                courseId,
                lessonId
            },
            "",
            url
        );
    };


    /* ---------------------------------------------------------
       本機狀態
    --------------------------------------------------------- */

    const createDefaultState = () => {
        return {
            completedByCourse: {},
            currentByCourse: {},
            notesByCourse: {},
            initializedCourses: []
        };
    };

    const normalizeCompletedState = (
        value
    ) => {
        const result = {};

        if (
            !value ||
            typeof value !== "object"
        ) {
            return result;
        }

        Object.entries(value).forEach(
            ([
                courseId,
                lessonIds
            ]) => {
                result[courseId] =
                    uniqueStrings(
                        lessonIds
                    );
            }
        );

        return result;
    };

    const normalizeCurrentState = (
        value
    ) => {
        const result = {};

        if (
            !value ||
            typeof value !== "object"
        ) {
            return result;
        }

        Object.entries(value).forEach(
            ([
                courseId,
                lessonId
            ]) => {
                if (
                    courseId &&
                    lessonId
                ) {
                    result[String(courseId)] =
                        String(lessonId);
                }
            }
        );

        return result;
    };

    const normalizeNotesState = (
        value
    ) => {
        const result = {};

        if (
            !value ||
            typeof value !== "object"
        ) {
            return result;
        }

        Object.entries(value).forEach(
            ([
                courseId,
                notes
            ]) => {
                if (
                    !notes ||
                    typeof notes !==
                        "object"
                ) {
                    return;
                }

                result[courseId] = {};

                Object.entries(notes).forEach(
                    ([
                        lessonId,
                        note
                    ]) => {
                        result[courseId][
                            lessonId
                        ] = String(
                            note || ""
                        );
                    }
                );
            }
        );

        return result;
    };

    const readLessonState = () => {
        const defaultState =
            createDefaultState();

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

            return {
                completedByCourse:
                    normalizeCompletedState(
                        savedState
                            .completedByCourse
                    ),

                currentByCourse:
                    normalizeCurrentState(
                        savedState
                            .currentByCourse
                    ),

                notesByCourse:
                    normalizeNotesState(
                        savedState
                            .notesByCourse
                    ),

                initializedCourses:
                    uniqueStrings(
                        savedState
                            .initializedCourses
                    )
            };
        } catch (error) {
            console.warn(
                "無法讀取學習單元狀態：",
                error
            );

            return defaultState;
        }
    };

    let lessonState =
        readLessonState();

    const saveLessonState = () => {
        try {
            window.localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(
                    lessonState
                )
            );

            return true;
        } catch (error) {
            console.warn(
                "無法儲存學習單元狀態：",
                error
            );

            return false;
        }
    };

    const getCompletedLessonIds = (
        courseId
    ) => {
        return [
            ...(
                lessonState
                    .completedByCourse[
                        courseId
                    ] || []
            )
        ];
    };

    const isLessonCompleted = (
        courseId,
        lessonId
    ) => {
        return getCompletedLessonIds(
            courseId
        ).includes(lessonId);
    };

    const getNote = (
        courseId,
        lessonId
    ) => {
        return (
            lessonState
                .notesByCourse[
                    courseId
                ]?.[lessonId] ||
            ""
        );
    };

    const setNoteValue = (
        courseId,
        lessonId,
        note
    ) => {
        lessonState
            .notesByCourse[
                courseId
            ] =
            lessonState
                .notesByCourse[
                    courseId
                ] || {};

        lessonState
            .notesByCourse[
                courseId
            ][lessonId] =
            String(note || "");
    };


    /* ---------------------------------------------------------
       單元資料
    --------------------------------------------------------- */

    const unwrapLessons = (
        value
    ) => {
        if (Array.isArray(value)) {
            return value;
        }

        if (
            value &&
            Array.isArray(value.lessons)
        ) {
            return value.lessons;
        }

        return [];
    };

    const flattenLessonGroups = (
        groups
    ) => {
        if (!Array.isArray(groups)) {
            return [];
        }

        const lessons = [];

        groups.forEach((
            group,
            groupIndex
        ) => {
            if (
                !group ||
                typeof group !== "object"
            ) {
                return;
            }

            const title =
                group.title ||
                group.name ||
                `單元 ${groupIndex + 1}`;

            const children =
                group.lessons ||
                group.items ||
                [];

            if (!Array.isArray(children)) {
                return;
            }

            children.forEach((lesson) => {
                if (
                    lesson &&
                    typeof lesson ===
                        "object"
                ) {
                    lessons.push({
                        ...lesson,
                        chapterTitle:
                            lesson.chapterTitle ||
                            lesson.moduleTitle ||
                            title
                    });
                } else {
                    lessons.push({
                        title: String(
                            lesson || ""
                        ),
                        chapterTitle: title
                    });
                }
            });
        });

        return lessons;
    };

    const getRawLessons = (
        course
    ) => {
        const courseId = course.id;

        const methodNames = [
            "getLessonsByCourseId",
            "getCourseLessons",
            "getLessons"
        ];

        for (
            const methodName
            of methodNames
        ) {
            if (
                typeof dataApi?.[
                    methodName
                ] !== "function"
            ) {
                continue;
            }

            try {
                let lessons =
                    unwrapLessons(
                        dataApi[methodName](
                            courseId
                        )
                    );

                const containsCourseIds =
                    lessons.some((lesson) => {
                        return (
                            lesson &&
                            typeof lesson ===
                                "object" &&
                            lesson.courseId
                        );
                    });

                if (containsCourseIds) {
                    lessons = lessons.filter(
                        (lesson) => {
                            return (
                                String(
                                    lesson.courseId
                                ) ===
                                String(courseId)
                            );
                        }
                    );
                }

                if (lessons.length) {
                    return lessons;
                }
            } catch (error) {
                console.warn(
                    `無法執行 ${methodName}：`,
                    error
                );
            }
        }

        if (
            Array.isArray(
                course.lessons
            ) &&
            course.lessons.length
        ) {
            return course.lessons;
        }

        const groupedLessons =
            flattenLessonGroups(
                course.modules ||
                course.chapters ||
                course.units
            );

        if (groupedLessons.length) {
            return groupedLessons;
        }

        return [];
    };

    const toStringArray = (
        value
    ) => {
        if (Array.isArray(value)) {
            return value
                .map((item) => {
                    return String(
                        item || ""
                    ).trim();
                })
                .filter(Boolean);
        }

        if (typeof value === "string") {
            return value
                .split(/\n|,/)
                .map((item) => {
                    return item.trim();
                })
                .filter(Boolean);
        }

        return [];
    };

    const normalizeResources = (
        value
    ) => {
        if (!Array.isArray(value)) {
            return [];
        }

        return value
            .map((resource, index) => {
                if (
                    typeof resource ===
                    "string"
                ) {
                    return {
                        title:
                            `學習資源 ${index + 1}`,
                        url: resource
                    };
                }

                if (
                    !resource ||
                    typeof resource !==
                        "object"
                ) {
                    return null;
                }

                return {
                    title:
                        resource.title ||
                        resource.name ||
                        `學習資源 ${index + 1}`,

                    url:
                        resource.url ||
                        resource.href ||
                        "",

                    description:
                        resource.description ||
                        ""
                };
            })
            .filter(Boolean);
    };

    const normalizeLesson = (
        rawLesson,
        index,
        course
    ) => {
        const source =
            rawLesson &&
            typeof rawLesson === "object"
                ? rawLesson
                : {
                    title: String(
                        rawLesson || ""
                    )
                };

        return {
            id: String(
                source.id ||
                source.lessonId ||
                `${course.id}-lesson-${index + 1}`
            ),

            courseId: String(
                source.courseId ||
                course.id
            ),

            title:
                source.title ||
                source.name ||
                `第 ${index + 1} 課`,

            description:
                source.description ||
                source.summary ||
                "",

            chapterTitle:
                source.chapterTitle ||
                source.moduleTitle ||
                source.chapter ||
                source.unit ||
                "課程內容",

            durationMinutes:
                Math.max(
                    0,
                    Number(
                        source.durationMinutes ??
                        source.duration ??
                        source.minutes
                    ) || 0
                ),

            type:
                source.type ||
                source.lessonType ||
                "lesson",

            objectives:
                toStringArray(
                    source.objectives ||
                    source.goals
                ),

            content:
                source.content ??
                source.body ??
                source.text ??
                "",

            contentHtml:
                source.contentHtml ||
                source.html ||
                "",

            sections:
                Array.isArray(
                    source.sections
                )
                    ? source.sections
                    : (
                        Array.isArray(
                            source.content
                        )
                            ? source.content
                            : []
                    ),

            resources:
                normalizeResources(
                    source.resources ||
                    source.links ||
                    source.attachments
                ),

            videoUrl:
                source.videoUrl ||
                source.video ||
                "",

            imageUrl:
                source.imageUrl ||
                source.image ||
                "",

            locked:
                source.locked === true,

            isFallback: false
        };
    };

    const createFallbackLessons = (
        course
    ) => {
        const requestedCount =
            Number(course.lessonCount) ||
            1;

        const lessonCount = clamp(
            requestedCount,
            1,
            60
        );

        return Array.from(
            {
                length: lessonCount
            },
            (_, index) => {
                const isFirst =
                    index === 0;

                const isLast =
                    index ===
                    lessonCount - 1;

                let title =
                    `第 ${index + 1} 課：${course.title}`;

                if (
                    isFirst &&
                    lessonCount > 1
                ) {
                    title = "課程導覽";
                }

                if (
                    isLast &&
                    lessonCount > 1
                ) {
                    title =
                        "課程總結與下一步";
                }

                return {
                    id:
                        `${course.id}-lesson-${index + 1}`,

                    courseId:
                        String(course.id),

                    title,

                    description:
                        isFirst
                            ? `認識「${course.title}」的學習目標與課程內容。`
                            : isLast
                                ? "複習本課程的重點並規劃下一步學習方向。"
                                : `繼續學習「${course.title}」的核心知識與實作內容。`,

                    chapterTitle:
                        `第 ${
                            Math.floor(
                                index / 4
                            ) + 1
                        } 單元`,

                    durationMinutes:
                        Math.max(
                            10,
                            Math.round(
                                (
                                    Number(
                                        course.durationMinutes
                                    ) ||
                                    lessonCount *
                                    20
                                ) /
                                lessonCount
                            )
                        ),

                    type:
                        isLast
                            ? "review"
                            : "lesson",

                    objectives:
                        isFirst
                            ? [
                                "了解課程內容與學習方式",
                                "確認本課程的學習目標"
                            ]
                            : isLast
                                ? [
                                    "整理本課程的重要概念",
                                    "確認後續練習方向"
                                ]
                                : [
                                    "理解本課的核心概念",
                                    "完成本課的學習內容"
                                ],

                    content:
                        "本單元的詳細教材正在準備中。你仍然可以使用學習筆記記錄重點，並在閱讀完成後標記本單元為已完成。",

                    contentHtml: "",
                    sections: [],
                    resources: [],
                    videoUrl: "",
                    imageUrl: "",
                    locked: false,
                    isFallback: true
                };
            }
        );
    };

    const getLessonsForCourse = (
        course
    ) => {
        const rawLessons =
            getRawLessons(course);

        const normalizedLessons =
            rawLessons.length
                ? rawLessons.map(
                    (
                        lesson,
                        index
                    ) => {
                        return normalizeLesson(
                            lesson,
                            index,
                            course
                        );
                    }
                )
                : createFallbackLessons(
                    course
                );

        const usedIds = new Set();

        return normalizedLessons.map(
            (lesson, index) => {
                let lessonId =
                    lesson.id;

                if (
                    usedIds.has(lessonId)
                ) {
                    lessonId =
                        `${lessonId}-${index + 1}`;
                }

                usedIds.add(lessonId);

                return {
                    ...lesson,
                    id: lessonId,
                    index
                };
            }
        );
    };


    /* ---------------------------------------------------------
       舊課程進度同步
    --------------------------------------------------------- */

    const hydrateCompletionFromCourse = (
        courseId,
        lessons
    ) => {
        if (
            lessonState
                .initializedCourses
                .includes(courseId)
        ) {
            return;
        }

        let existingProgress = 0;

        if (
            courseApi &&
            typeof courseApi.getProgress ===
                "function"
        ) {
            try {
                existingProgress =
                    clamp(
                        courseApi.getProgress(
                            courseId
                        ),
                        0,
                        100
                    );
            } catch (error) {
                console.warn(
                    "無法取得既有課程進度：",
                    error
                );
            }
        }

        const completedCount =
            existingProgress >= 100
                ? lessons.length
                : Math.round(
                    (
                        existingProgress /
                        100
                    ) *
                    lessons.length
                );

        lessonState
            .completedByCourse[
                courseId
            ] =
            lessons
                .slice(
                    0,
                    completedCount
                )
                .map((lesson) => {
                    return lesson.id;
                });

        lessonState
            .initializedCourses
            .push(courseId);

        lessonState
            .initializedCourses =
            uniqueStrings(
                lessonState
                    .initializedCourses
            );

        saveLessonState();
    };

    const pruneCourseState = (
        courseId,
        lessons
    ) => {
        const validIds = new Set(
            lessons.map((lesson) => {
                return lesson.id;
            })
        );

        const oldCompleted =
            getCompletedLessonIds(
                courseId
            );

        const newCompleted =
            oldCompleted.filter(
                (lessonId) => {
                    return validIds.has(
                        lessonId
                    );
                }
            );

        const currentId =
            lessonState
                .currentByCourse[
                    courseId
                ];

        let changed =
            oldCompleted.length !==
            newCompleted.length;

        lessonState
            .completedByCourse[
                courseId
            ] = newCompleted;

        if (
            currentId &&
            !validIds.has(currentId)
        ) {
            delete lessonState
                .currentByCourse[
                    courseId
                ];

            changed = true;
        }

        if (changed) {
            saveLessonState();
        }
    };


    /* ---------------------------------------------------------
       課程進度
    --------------------------------------------------------- */

    const getLessonProgress = (
        courseId,
        lessons
    ) => {
        if (!lessons.length) {
            return 0;
        }

        const validIds = new Set(
            lessons.map((lesson) => {
                return lesson.id;
            })
        );

        const completedCount =
            getCompletedLessonIds(
                courseId
            ).filter((lessonId) => {
                return validIds.has(
                    lessonId
                );
            }).length;

        return Math.round(
            (
                completedCount /
                lessons.length
            ) *
            100
        );
    };

    const syncCourseProgress = (
        course,
        lessons
    ) => {
        const progress =
            getLessonProgress(
                course.id,
                lessons
            );

        if (
            courseApi &&
            typeof courseApi.setProgress ===
                "function"
        ) {
            try {
                courseApi.setProgress(
                    course.id,
                    progress
                );
            } catch (error) {
                console.warn(
                    "無法同步課程進度：",
                    error
                );
            }
        }

        return progress;
    };


    /* ---------------------------------------------------------
       DOM
    --------------------------------------------------------- */

    const cacheElements = () => {
        elements = {
            root:
                document.querySelector(
                    [
                        "[data-lesson-page]",
                        "#lessonPage"
                    ].join(", ")
                ),

            navigation:
                document.querySelector(
                    [
                        "[data-lesson-navigation]",
                        "#lessonNavigation"
                    ].join(", ")
                ),

            content:
                document.querySelector(
                    [
                        "[data-lesson-content]",
                        "#lessonContent"
                    ].join(", ")
                ),

            notes:
                document.querySelector(
                    [
                        "[data-lesson-notes]",
                        "#lessonNotes"
                    ].join(", ")
                ),

            footer:
                document.querySelector(
                    [
                        "[data-lesson-footer]",
                        "#lessonFooter"
                    ].join(", ")
                )
        };
    };

    const hasLessonInterface = () => {
        return Boolean(
            elements.root ||
            elements.navigation ||
            elements.content
        );
    };

    const ensureLessonLayout = () => {
        const root = elements.root;

        if (!root) {
            return;
        }

        const hasNavigation =
            root.matches(
                "[data-lesson-navigation]"
            ) ||
            root.querySelector(
                "[data-lesson-navigation]"
            );

        const hasContent =
            root.matches(
                "[data-lesson-content]"
            ) ||
            root.querySelector(
                "[data-lesson-content]"
            );

        if (
            hasNavigation ||
            hasContent
        ) {
            return;
        }

        root.classList.add(
            "lesson-page"
        );

        root.innerHTML = `
            <header class="lesson-page__header">
                <div class="lesson-page__breadcrumb">
                    <a
                        href="${escapeHTML(
                            getCourseListUrl()
                        )}"
                    >
                        全部課程
                    </a>

                    <span aria-hidden="true">
                        /
                    </span>

                    <a data-lesson-course-link>
                        <span data-lesson-course-title>
                            課程
                        </span>
                    </a>
                </div>

                <button
                    class="lesson-page__navigation-toggle"
                    type="button"
                    data-lesson-navigation-toggle
                    aria-expanded="false"
                >
                    ☰ 課程單元
                </button>

                <div class="lesson-page__progress">
                    <div class="lesson-page__progress-header">
                        <span>
                            課程進度
                        </span>

                        <strong data-lesson-progress-value>
                            0%
                        </strong>
                    </div>

                    <div
                        class="lesson-page__progress-track"
                        role="progressbar"
                        aria-label="課程學習進度"
                        aria-valuemin="0"
                        aria-valuemax="100"
                        aria-valuenow="0"
                    >
                        <span
                            class="lesson-page__progress-bar"
                            data-lesson-progress-bar
                            style="width: 0%"
                        ></span>
                    </div>

                    <small data-lesson-progress-label>
                        0 / 0
                    </small>
                </div>
            </header>

            <div class="lesson-page__layout">
                <aside
                    class="lesson-page__sidebar"
                    data-lesson-navigation
                    aria-label="課程單元"
                ></aside>

                <main class="lesson-page__main">
                    <article
                        class="lesson-page__content"
                        data-lesson-content
                    ></article>

                    <section
                        class="lesson-page__notes"
                        data-lesson-notes
                    ></section>

                    <footer
                        class="lesson-page__footer"
                        data-lesson-footer
                    ></footer>
                </main>
            </div>
        `;

        cacheElements();
    };


    /* ---------------------------------------------------------
       網址參數
    --------------------------------------------------------- */

    const getRequestedCourseId = () => {
        const parameters =
            new URLSearchParams(
                window.location.search
            );

        return (
            parameters.get("course") ||
            elements.root?.dataset
                .lessonCourseId ||
            elements.root?.dataset
                .courseId ||
            document.body?.dataset
                .courseId ||
            ""
        );
    };

    const getRequestedLessonId = () => {
        const parameters =
            new URLSearchParams(
                window.location.search
            );

        return (
            parameters.get("lesson") ||
            parameters.get("lessonId") ||
            elements.root?.dataset
                .lessonId ||
            ""
        );
    };

    const selectInitialLesson = (
        courseId,
        lessons
    ) => {
        const requestedLessonId =
            getRequestedLessonId();

        const savedLessonId =
            lessonState
                .currentByCourse[
                    courseId
                ];

        const requestedLesson =
            lessons.find((lesson) => {
                return (
                    lesson.id ===
                    requestedLessonId
                );
            });

        if (
            requestedLesson &&
            !requestedLesson.locked
        ) {
            return requestedLesson;
        }

        const savedLesson =
            lessons.find((lesson) => {
                return (
                    lesson.id ===
                    savedLessonId
                );
            });

        if (
            savedLesson &&
            !savedLesson.locked
        ) {
            return savedLesson;
        }

        const firstIncomplete =
            lessons.find((lesson) => {
                return (
                    !lesson.locked &&
                    !isLessonCompleted(
                        courseId,
                        lesson.id
                    )
                );
            });

        return (
            firstIncomplete ||
            lessons.find((lesson) => {
                return !lesson.locked;
            }) ||
            lessons[0] ||
            null
        );
    };


    /* ---------------------------------------------------------
       課程導覽
    --------------------------------------------------------- */

    const groupLessons = (
        lessons
    ) => {
        const groups = [];

        lessons.forEach((lesson) => {
            const title =
                lesson.chapterTitle ||
                "課程內容";

            let group =
                groups.find((item) => {
                    return (
                        item.title === title
                    );
                });

            if (!group) {
                group = {
                    title,
                    lessons: []
                };

                groups.push(group);
            }

            group.lessons.push(lesson);
        });

        return groups;
    };

    const getLessonTypeLabel = (
        type
    ) => {
        const labels = {
            lesson: "課程",
            video: "影片",
            reading: "閱讀",
            practice: "實作",
            quiz: "測驗",
            review: "複習"
        };

        return (
            labels[type] ||
            labels.lesson
        );
    };

    const renderNavigation = () => {
        if (!elements.navigation) {
            return;
        }

        const groups =
            groupLessons(
                currentLessons
            );

        elements.navigation.innerHTML = `
            <div class="lesson-navigation__header">
                <div>
                    <h2>
                        課程單元
                    </h2>

                    <p>
                        共
                        ${formatNumber(
                            currentLessons.length
                        )}
                        課
                    </p>
                </div>

                <button
                    type="button"
                    data-lesson-navigation-close
                    aria-label="關閉課程單元"
                >
                    ×
                </button>
            </div>

            <div class="lesson-navigation__groups">
                ${groups
                    .map((
                        group,
                        groupIndex
                    ) => {
                        return `
                            <section class="lesson-navigation__group">
                                <h3>
                                    <span>
                                        ${groupIndex + 1}
                                    </span>

                                    ${escapeHTML(
                                        group.title
                                    )}
                                </h3>

                                <ol>
                                    ${group.lessons
                                        .map(
                                            (lesson) => {
                                                const completed =
                                                    isLessonCompleted(
                                                        currentCourse.id,
                                                        lesson.id
                                                    );

                                                const active =
                                                    currentLesson?.id ===
                                                    lesson.id;

                                                return `
                                                    <li>
                                                        <button
                                                            class="lesson-navigation__item ${
                                                                active
                                                                    ? "is-active"
                                                                    : ""
                                                            } ${
                                                                completed
                                                                    ? "is-completed"
                                                                    : ""
                                                            } ${
                                                                lesson.locked
                                                                    ? "is-locked"
                                                                    : ""
                                                            }"
                                                            type="button"
                                                            data-lesson-select="${escapeHTML(
                                                                lesson.id
                                                            )}"
                                                            ${
                                                                active
                                                                    ? 'aria-current="step"'
                                                                    : ""
                                                            }
                                                            ${
                                                                lesson.locked
                                                                    ? "disabled"
                                                                    : ""
                                                            }
                                                        >
                                                            <span class="lesson-navigation__number">
                                                                ${
                                                                    completed
                                                                        ? "✓"
                                                                        : lesson.index + 1
                                                                }
                                                            </span>

                                                            <span class="lesson-navigation__content">
                                                                <strong>
                                                                    ${escapeHTML(
                                                                        lesson.title
                                                                    )}
                                                                </strong>

                                                                <small>
                                                                    ${escapeHTML(
                                                                        getLessonTypeLabel(
                                                                            lesson.type
                                                                        )
                                                                    )}

                                                                    ${
                                                                        lesson.durationMinutes
                                                                            ? `・${escapeHTML(
                                                                                formatDuration(
                                                                                    lesson.durationMinutes
                                                                                )
                                                                            )}`
                                                                            : ""
                                                                    }
                                                                </small>
                                                            </span>

                                                            ${
                                                                lesson.locked
                                                                    ? `
                                                                        <span
                                                                            class="lesson-navigation__lock"
                                                                            aria-label="尚未開放"
                                                                        >
                                                                            🔒
                                                                        </span>
                                                                    `
                                                                    : ""
                                                            }
                                                        </button>
                                                    </li>
                                                `;
                                            }
                                        )
                                        .join("")}
                                </ol>
                            </section>
                        `;
                    })
                    .join("")}
            </div>
        `;
    };


    /* ---------------------------------------------------------
       教材內容
    --------------------------------------------------------- */

    const renderLessonSection = (
        section,
        index
    ) => {
        if (
            typeof section === "string"
        ) {
            return `
                <section class="lesson-material__section">
                    ${renderParagraphs(
                        section
                    )}
                </section>
            `;
        }

        if (
            !section ||
            typeof section !== "object"
        ) {
            return "";
        }

        const title =
            section.title ||
            section.heading ||
            "";

        const body =
            section.content ??
            section.text ??
            section.description ??
            "";

        const bodyMarkup =
            Array.isArray(body)
                ? body
                    .map((paragraph) => {
                        return renderParagraphs(
                            paragraph
                        );
                    })
                    .join("")
                : renderParagraphs(body);

        const items =
            toStringArray(
                section.items ||
                section.points
            );

        const code =
            section.code
                ? String(section.code)
                : "";

        return `
            <section
                class="lesson-material__section"
                data-lesson-section="${index + 1}"
            >
                ${
                    title
                        ? `
                            <h2>
                                ${escapeHTML(
                                    title
                                )}
                            </h2>
                        `
                        : ""
                }

                ${bodyMarkup}

                ${
                    items.length
                        ? `
                            <ul>
                                ${items
                                    .map((item) => {
                                        return `
                                            <li>
                                                ${escapeHTML(
                                                    item
                                                )}
                                            </li>
                                        `;
                                    })
                                    .join("")}
                            </ul>
                        `
                        : ""
                }

                ${
                    code
                        ? `
                            <pre><code>${escapeHTML(
                                code
                            )}</code></pre>
                        `
                        : ""
                }
            </section>
        `;
    };

    const renderLessonMedia = (
        lesson
    ) => {
        const imageUrl =
            safeUrl(
                lesson.imageUrl
            );

        const videoUrl =
            safeUrl(
                lesson.videoUrl
            );

        const imageMarkup =
            imageUrl
                ? `
                    <figure class="lesson-material__image">
                        <img
                            src="${escapeHTML(
                                imageUrl
                            )}"
                            alt="${escapeHTML(
                                lesson.title
                            )}"
                            loading="lazy"
                        >
                    </figure>
                `
                : "";

        let videoMarkup = "";

        if (videoUrl) {
            const directVideo =
                /\.(mp4|webm|ogg)(\?|#|$)/i
                    .test(videoUrl);

            videoMarkup =
                directVideo
                    ? `
                        <div class="lesson-material__video">
                            <video
                                controls
                                preload="metadata"
                                src="${escapeHTML(
                                    videoUrl
                                )}"
                            >
                                你的瀏覽器不支援影片播放。
                            </video>
                        </div>
                    `
                    : `
                        <p class="lesson-material__video-link">
                            <a
                                href="${escapeHTML(
                                    videoUrl
                                )}"
                                target="_blank"
                                rel="noopener noreferrer"
                            >
                                ▶ 開啟教學影片
                            </a>
                        </p>
                    `;
        }

        return (
            imageMarkup +
            videoMarkup
        );
    };

    const renderResources = (
        resources
    ) => {
        if (!resources.length) {
            return "";
        }

        return `
            <section class="lesson-material__resources">
                <h2>
                    延伸學習資源
                </h2>

                <ul>
                    ${resources
                        .map((resource) => {
                            const url =
                                safeUrl(
                                    resource.url
                                );

                            return `
                                <li>
                                    ${
                                        url
                                            ? `
                                                <a
                                                    href="${escapeHTML(
                                                        url
                                                    )}"
                                                    target="_blank"
                                                    rel="noopener noreferrer"
                                                >
                                                    ${escapeHTML(
                                                        resource.title
                                                    )}
                                                </a>
                                            `
                                            : `
                                                <span>
                                                    ${escapeHTML(
                                                        resource.title
                                                    )}
                                                </span>
                                            `
                                    }

                                    ${
                                        resource.description
                                            ? `
                                                <p>
                                                    ${escapeHTML(
                                                        resource.description
                                                    )}
                                                </p>
                                            `
                                            : ""
                                    }
                                </li>
                            `;
                        })
                        .join("")}
                </ul>
            </section>
        `;
    };

    const renderLessonMaterial = (
        lesson
    ) => {
        const objectivesMarkup =
            lesson.objectives.length
                ? `
                    <section class="lesson-material__objectives">
                        <h2>
                            本課學習目標
                        </h2>

                        <ul>
                            ${lesson.objectives
                                .map((objective) => {
                                    return `
                                        <li>
                                            ${escapeHTML(
                                                objective
                                            )}
                                        </li>
                                    `;
                                })
                                .join("")}
                        </ul>
                    </section>
                `
                : "";

        let contentMarkup = "";

        if (lesson.contentHtml) {
            contentMarkup = `
                <section class="lesson-material__body">
                    ${sanitizeHTML(
                        lesson.contentHtml
                    )}
                </section>
            `;
        } else if (
            lesson.sections.length
        ) {
            contentMarkup =
                lesson.sections
                    .map(
                        renderLessonSection
                    )
                    .join("");
        } else if (
            typeof lesson.content ===
            "string" &&
            lesson.content.trim()
        ) {
            contentMarkup = `
                <section class="lesson-material__body">
                    ${renderParagraphs(
                        lesson.content
                    )}
                </section>
            `;
        } else {
            contentMarkup = `
                <section class="lesson-material__empty">
                    <p>
                        本單元的教材內容正在準備中。
                    </p>
                </section>
            `;
        }

        return `
            <div class="lesson-material">
                ${renderLessonMedia(
                    lesson
                )}

                ${objectivesMarkup}

                ${contentMarkup}

                ${renderResources(
                    lesson.resources
                )}
            </div>
        `;
    };


    /* ---------------------------------------------------------
       學習筆記
    --------------------------------------------------------- */

    const createNotesMarkup = (
        course,
        lesson
    ) => {
        const note =
            getNote(
                course.id,
                lesson.id
            );

        return `
            <div class="lesson-notes__header">
                <div>
                    <h2>
                        我的學習筆記
                    </h2>

                    <p>
                        筆記會自動儲存在這台裝置中。
                    </p>
                </div>

                <span
                    class="lesson-notes__status"
                    data-lesson-note-status
                    data-course-id="${escapeHTML(
                        course.id
                    )}"
                    data-lesson-id="${escapeHTML(
                        lesson.id
                    )}"
                    role="status"
                >
                    已儲存
                </span>
            </div>

            <label
                class="sr-only"
                for="lessonNoteInput"
            >
                本課學習筆記
            </label>

            <textarea
                id="lessonNoteInput"
                data-lesson-note-input
                data-course-id="${escapeHTML(
                    course.id
                )}"
                data-lesson-id="${escapeHTML(
                    lesson.id
                )}"
                rows="8"
                placeholder="記錄重點、問題或實作心得……"
            >${escapeHTML(note)}</textarea>
        `;
    };

    const renderNotes = () => {
        if (
            !elements.notes ||
            !currentCourse ||
            !currentLesson
        ) {
            return;
        }

        elements.notes.innerHTML =
            createNotesMarkup(
                currentCourse,
                currentLesson
            );
    };

    const updateNoteStatus = (
        courseId,
        lessonId,
        message
    ) => {
        document
            .querySelectorAll(
                "[data-lesson-note-status]"
            )
            .forEach((element) => {
                if (
                    element.dataset.courseId ===
                        courseId &&
                    element.dataset.lessonId ===
                        lessonId
                ) {
                    element.textContent =
                        message;
                }
            });
    };

    const persistPendingNote = () => {
        window.clearTimeout(
            noteSaveTimer
        );

        noteSaveTimer = null;

        if (!pendingNote) {
            return;
        }

        const {
            courseId,
            lessonId
        } = pendingNote;

        pendingNote = null;

        saveLessonState();

        updateNoteStatus(
            courseId,
            lessonId,
            "已儲存"
        );

        document.dispatchEvent(
            new CustomEvent(
                "robotacademy:lessonnotechange",
                {
                    detail: {
                        courseId,
                        lessonId,
                        note:
                            getNote(
                                courseId,
                                lessonId
                            )
                    }
                }
            )
        );
    };

    const queueNoteSave = (
        courseId,
        lessonId,
        note
    ) => {
        setNoteValue(
            courseId,
            lessonId,
            note
        );

        pendingNote = {
            courseId,
            lessonId
        };

        updateNoteStatus(
            courseId,
            lessonId,
            "儲存中……"
        );

        window.clearTimeout(
            noteSaveTimer
        );

        noteSaveTimer =
            window.setTimeout(
                persistPendingNote,
                NOTE_SAVE_DELAY
            );
    };

    const saveNote = (
        courseId,
        lessonId,
        note
    ) => {
        window.clearTimeout(
            noteSaveTimer
        );

        noteSaveTimer = null;
        pendingNote = null;

        setNoteValue(
            courseId,
            lessonId,
            note
        );

        saveLessonState();

        updateNoteStatus(
            courseId,
            lessonId,
            "已儲存"
        );

        return String(note || "");
    };


    /* ---------------------------------------------------------
       上一課與下一課
    --------------------------------------------------------- */

    const getCurrentLessonIndex = () => {
        if (!currentLesson) {
            return -1;
        }

        return currentLessons.findIndex(
            (lesson) => {
                return (
                    lesson.id ===
                    currentLesson.id
                );
            }
        );
    };

    const getPreviousLesson = () => {
        const index =
            getCurrentLessonIndex();

        if (index <= 0) {
            return null;
        }

        return (
            currentLessons[
                index - 1
            ] || null
        );
    };

    const getNextLesson = () => {
        const index =
            getCurrentLessonIndex();

        if (
            index < 0 ||
            index >=
                currentLessons.length - 1
        ) {
            return null;
        }

        return (
            currentLessons[
                index + 1
            ] || null
        );
    };

    const createFooterMarkup = () => {
        const previousLesson =
            getPreviousLesson();

        const nextLesson =
            getNextLesson();

        const completed =
            isLessonCompleted(
                currentCourse.id,
                currentLesson.id
            );

        return `
            <div class="lesson-footer__previous">
                ${
                    previousLesson
                        ? `
                            <button
                                type="button"
                                data-lesson-go="${escapeHTML(
                                    previousLesson.id
                                )}"
                                ${
                                    previousLesson.locked
                                        ? "disabled"
                                        : ""
                                }
                            >
                                <span aria-hidden="true">
                                    ←
                                </span>

                                <span>
                                    <small>
                                        上一課
                                    </small>

                                    <strong>
                                        ${escapeHTML(
                                            previousLesson.title
                                        )}
                                    </strong>
                                </span>
                            </button>
                        `
                        : `
                            <button
                                type="button"
                                disabled
                            >
                                <span aria-hidden="true">
                                    ←
                                </span>

                                <span>
                                    已是第一課
                                </span>
                            </button>
                        `
                }
            </div>

            <div class="lesson-footer__complete">
                <button
                    class="${
                        completed
                            ? "is-completed"
                            : ""
                    }"
                    type="button"
                    data-lesson-complete
                    data-course-id="${escapeHTML(
                        currentCourse.id
                    )}"
                    data-lesson-id="${escapeHTML(
                        currentLesson.id
                    )}"
                    aria-pressed="${completed}"
                >
                    ${
                        completed
                            ? "✓ 已完成本課"
                            : "標記本課完成"
                    }
                </button>
            </div>

            <div class="lesson-footer__next">
                ${
                    nextLesson
                        ? `
                            <button
                                type="button"
                                data-lesson-go="${escapeHTML(
                                    nextLesson.id
                                )}"
                                ${
                                    nextLesson.locked
                                        ? "disabled"
                                        : ""
                                }
                            >
                                <span>
                                    <small>
                                        下一課
                                    </small>

                                    <strong>
                                        ${escapeHTML(
                                            nextLesson.title
                                        )}
                                    </strong>
                                </span>

                                <span aria-hidden="true">
                                    →
                                </span>
                            </button>
                        `
                        : `
                            <a
                                href="${escapeHTML(
                                    getCourseDetailUrl(
                                        currentCourse.id
                                    )
                                )}"
                            >
                                <span>
                                    <small>
                                        課程結束
                                    </small>

                                    <strong>
                                        返回課程頁面
                                    </strong>
                                </span>

                                <span aria-hidden="true">
                                    →
                                </span>
                            </a>
                        `
                }
            </div>
        `;
    };

    const renderFooter = () => {
        if (
            !elements.footer ||
            !currentCourse ||
            !currentLesson
        ) {
            return;
        }

        elements.footer.innerHTML =
            createFooterMarkup();
    };


    /* ---------------------------------------------------------
       主要內容
    --------------------------------------------------------- */

    const renderContent = () => {
        if (
            !elements.content ||
            !currentCourse ||
            !currentLesson
        ) {
            return;
        }

        const completed =
            isLessonCompleted(
                currentCourse.id,
                currentLesson.id
            );

        const inlineNotes =
            elements.notes
                ? ""
                : `
                    <section class="lesson-page__notes">
                        ${createNotesMarkup(
                            currentCourse,
                            currentLesson
                        )}
                    </section>
                `;

        const inlineFooter =
            elements.footer
                ? ""
                : `
                    <footer class="lesson-page__footer">
                        ${createFooterMarkup()}
                    </footer>
                `;

        elements.content.innerHTML = `
            <header class="lesson-content__header">
                <div class="lesson-content__meta">
                    <span>
                        ${escapeHTML(
                            currentLesson
                                .chapterTitle
                        )}
                    </span>

                    <span>
                        ${escapeHTML(
                            getLessonTypeLabel(
                                currentLesson.type
                            )
                        )}
                    </span>

                    ${
                        currentLesson
                            .durationMinutes
                            ? `
                                <span>
                                    ⏱️
                                    ${escapeHTML(
                                        formatDuration(
                                            currentLesson
                                                .durationMinutes
                                        )
                                    )}
                                </span>
                            `
                            : ""
                    }

                    ${
                        completed
                            ? `
                                <span class="lesson-content__completed">
                                    ✓ 已完成
                                </span>
                            `
                            : ""
                    }
                </div>

                <p class="lesson-content__number">
                    第
                    ${currentLesson.index + 1}
                    課，共
                    ${currentLessons.length}
                    課
                </p>

                <h1>
                    ${escapeHTML(
                        currentLesson.title
                    )}
                </h1>

                ${
                    currentLesson.description
                        ? `
                            <p class="lesson-content__description">
                                ${escapeHTML(
                                    currentLesson
                                        .description
                                )}
                            </p>
                        `
                        : ""
                }
            </header>

            ${renderLessonMaterial(
                currentLesson
            )}

            ${inlineNotes}

            ${inlineFooter}
        `;
    };


    /* ---------------------------------------------------------
       標題與進度
    --------------------------------------------------------- */

    const renderHeader = () => {
        if (!currentCourse) {
            return;
        }

        setTextAll(
            "[data-lesson-course-title]",
            currentCourse.title
        );

        document
            .querySelectorAll(
                "[data-lesson-course-link]"
            )
            .forEach((link) => {
                link.setAttribute(
                    "href",
                    getCourseDetailUrl(
                        currentCourse.id
                    )
                );
            });
    };

    const renderProgress = () => {
        if (!currentCourse) {
            return;
        }

        const completedIds =
            getCompletedLessonIds(
                currentCourse.id
            );

        const validIds = new Set(
            currentLessons.map(
                (lesson) => {
                    return lesson.id;
                }
            )
        );

        const completedCount =
            completedIds.filter(
                (lessonId) => {
                    return validIds.has(
                        lessonId
                    );
                }
            ).length;

        const progress =
            getLessonProgress(
                currentCourse.id,
                currentLessons
            );

        setTextAll(
            "[data-lesson-progress-value]",
            `${progress}%`
        );

        setTextAll(
            "[data-lesson-progress-label]",
            `${completedCount} / ${currentLessons.length} 課`
        );

        document
            .querySelectorAll(
                "[data-lesson-progress-bar]"
            )
            .forEach((bar) => {
                bar.style.width =
                    `${progress}%`;

                bar.setAttribute(
                    "aria-valuenow",
                    String(progress)
                );

                const progressElement =
                    bar.closest(
                        '[role="progressbar"]'
                    );

                if (progressElement) {
                    progressElement.setAttribute(
                        "aria-valuenow",
                        String(progress)
                    );
                }
            });
    };


    /* ---------------------------------------------------------
       找不到課程
    --------------------------------------------------------- */

    const renderNotFound = (
        message =
            "找不到指定的課程。"
    ) => {
        const target =
            elements.root ||
            elements.content;

        if (!target) {
            return;
        }

        target.innerHTML = `
            <section class="lesson-not-found">
                <div aria-hidden="true">
                    🤖
                </div>

                <h1>
                    無法開啟教材
                </h1>

                <p>
                    ${escapeHTML(message)}
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
    };


    /* ---------------------------------------------------------
       畫面更新
    --------------------------------------------------------- */

    const renderAll = (
        options = {}
    ) => {
        resolveApis();
        cacheElements();

        if (!hasLessonInterface()) {
            return false;
        }

        const courseId =
            getRequestedCourseId();

        if (!courseId) {
            renderNotFound(
                "網址中沒有指定課程編號。"
            );

            return false;
        }

        const course =
            getCourseById(courseId);

        if (!course) {
            renderNotFound(
                "這門課程不存在，或課程網址不正確。"
            );

            return false;
        }

        const lessons =
            getLessonsForCourse(
                course
            );

        if (!lessons.length) {
            renderNotFound(
                "這門課程目前沒有可閱讀的單元。"
            );

            return false;
        }

        hydrateCompletionFromCourse(
            course.id,
            lessons
        );

        pruneCourseState(
            course.id,
            lessons
        );

        const lesson =
            selectInitialLesson(
                course.id,
                lessons
            );

        if (!lesson) {
            renderNotFound(
                "找不到可以開啟的課程單元。"
            );

            return false;
        }

        currentCourse = course;
        currentLessons = lessons;
        currentLesson = lesson;

        lessonState
            .currentByCourse[
                course.id
            ] = lesson.id;

        saveLessonState();

        ensureLessonLayout();
        cacheElements();

        renderHeader();
        renderProgress();
        renderNavigation();
        renderContent();
        renderNotes();
        renderFooter();

        if (
            options.updateUrl !== false
        ) {
            updateLessonUrl(
                course.id,
                lesson.id,
                "replace"
            );
        }

        document.title =
            `${lesson.title}｜${course.title}｜Robot Academy`;

        document.dispatchEvent(
            new CustomEvent(
                "robotacademy:lessonrendered",
                {
                    detail: {
                        course:
                            clone(course),

                        lesson:
                            clone(lesson),

                        progress:
                            getLessonProgress(
                                course.id,
                                lessons
                            )
                    }
                }
            )
        );

        return true;
    };


    /* ---------------------------------------------------------
       切換單元
    --------------------------------------------------------- */

    const closeNavigation = () => {
        if (elements.root) {
            elements.root.classList.remove(
                "is-navigation-open"
            );
        }

        document
            .querySelectorAll(
                "[data-lesson-navigation-toggle]"
            )
            .forEach((button) => {
                button.setAttribute(
                    "aria-expanded",
                    "false"
                );
            });
    };

    const goToLesson = (
        lessonId,
        options = {}
    ) => {
        if (
            !currentCourse ||
            !lessonId
        ) {
            return false;
        }

        const lesson =
            currentLessons.find(
                (item) => {
                    return (
                        item.id ===
                        lessonId
                    );
                }
            );

        if (
            !lesson ||
            lesson.locked
        ) {
            return false;
        }

        persistPendingNote();

        lessonState
            .currentByCourse[
                currentCourse.id
            ] = lesson.id;

        saveLessonState();

        updateLessonUrl(
            currentCourse.id,
            lesson.id,
            options.replace
                ? "replace"
                : "push"
        );

        renderAll({
            updateUrl: false
        });

        closeNavigation();

        if (
            options.scroll !== false
        ) {
            const target =
                elements.content ||
                elements.root;

            target?.scrollIntoView({
                behavior: "smooth",
                block: "start"
            });
        }

        document.dispatchEvent(
            new CustomEvent(
                "robotacademy:lessonchange",
                {
                    detail: {
                        course:
                            clone(
                                currentCourse
                            ),

                        lesson:
                            clone(
                                currentLesson
                            )
                    }
                }
            )
        );

        return true;
    };

    const goToPreviousLesson = () => {
        const lesson =
            getPreviousLesson();

        if (
            !lesson ||
            lesson.locked
        ) {
            return false;
        }

        return goToLesson(
            lesson.id
        );
    };

    const goToNextLesson = (
        options = {}
    ) => {
        if (
            options.complete &&
            currentCourse &&
            currentLesson
        ) {
            setLessonCompleted(
                currentCourse.id,
                currentLesson.id,
                true,
                {
                    render: false,
                    notify: false
                }
            );
        }

        const lesson =
            getNextLesson();

        if (
            !lesson ||
            lesson.locked
        ) {
            renderAll({
                updateUrl: false
            });

            return false;
        }

        return goToLesson(
            lesson.id
        );
    };


    /* ---------------------------------------------------------
       完成狀態
    --------------------------------------------------------- */

    const setLessonCompleted = (
        courseId,
        lessonId,
        completed = true,
        options = {}
    ) => {
        const course =
            getCourseById(courseId);

        if (!course) {
            return false;
        }

        const lessons =
            courseId ===
                currentCourse?.id
                ? currentLessons
                : getLessonsForCourse(
                    course
                );

        const lesson =
            lessons.find((item) => {
                return (
                    item.id === lessonId
                );
            });

        if (!lesson) {
            return false;
        }

        const oldCompleted =
            isLessonCompleted(
                courseId,
                lessonId
            );

        if (
            oldCompleted ===
            Boolean(completed)
        ) {
            return oldCompleted;
        }

        const completedIds =
            getCompletedLessonIds(
                courseId
            );

        if (completed) {
            completedIds.push(
                lessonId
            );

            lessonState
                .completedByCourse[
                    courseId
                ] =
                uniqueStrings(
                    completedIds
                );
        } else {
            lessonState
                .completedByCourse[
                    courseId
                ] =
                completedIds.filter(
                    (id) => {
                        return (
                            id !== lessonId
                        );
                    }
                );
        }

        saveLessonState();

        const progress =
            syncCourseProgress(
                course,
                lessons
            );

        const newCompleted =
            Boolean(completed);

        document.dispatchEvent(
            new CustomEvent(
                "robotacademy:lessonstatuschange",
                {
                    detail: {
                        courseId,
                        lessonId,
                        completed:
                            newCompleted,
                        progress,
                        course:
                            clone(course),
                        lesson:
                            clone(lesson)
                    }
                }
            )
        );

        if (newCompleted) {
            document.dispatchEvent(
                new CustomEvent(
                    "robotacademy:lessoncomplete",
                    {
                        detail: {
                            courseId,
                            lessonId,
                            completed: true,
                            progress,
                            course:
                                clone(course),
                            lesson:
                                clone(lesson)
                        }
                    }
                )
            );
        }

        if (progress >= 100) {
            document.dispatchEvent(
                new CustomEvent(
                    "robotacademy:coursecomplete",
                    {
                        detail: {
                            courseId,
                            progress,
                            course:
                                clone(course)
                        }
                    }
                )
            );
        }

        if (
            options.render !== false
        ) {
            renderAll({
                updateUrl: false
            });
        }

        if (
            options.notify !== false
        ) {
            showMessage(
                newCompleted
                    ? (
                        progress >= 100
                            ? "恭喜完成整門課程！"
                            : "已完成本課"
                    )
                    : "已取消本課完成狀態"
            );
        }

        return newCompleted;
    };

    const toggleCurrentLesson = () => {
        if (
            !currentCourse ||
            !currentLesson
        ) {
            return false;
        }

        const completed =
            isLessonCompleted(
                currentCourse.id,
                currentLesson.id
            );

        return setLessonCompleted(
            currentCourse.id,
            currentLesson.id,
            !completed
        );
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
                "[data-lesson-toast]"
            );

        if (oldToast) {
            oldToast.remove();
        }

        const toast =
            document.createElement(
                "div"
            );

        toast.dataset.lessonToast = "";
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
       事件
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

                const lessonButton =
                    target.closest(
                        [
                            "[data-lesson-select]",
                            "[data-lesson-go]"
                        ].join(", ")
                    );

                if (lessonButton) {
                    event.preventDefault();

                    const lessonId =
                        lessonButton.dataset
                            .lessonSelect ||
                        lessonButton.dataset
                            .lessonGo;

                    goToLesson(lessonId);

                    return;
                }

                const completeButton =
                    target.closest(
                        "[data-lesson-complete]"
                    );

                if (completeButton) {
                    event.preventDefault();
                    toggleCurrentLesson();

                    return;
                }

                const completeNextButton =
                    target.closest(
                        "[data-lesson-complete-next]"
                    );

                if (completeNextButton) {
                    event.preventDefault();

                    goToNextLesson({
                        complete: true
                    });

                    return;
                }

                const navigationToggle =
                    target.closest(
                        "[data-lesson-navigation-toggle]"
                    );

                if (navigationToggle) {
                    event.preventDefault();

                    const root =
                        elements.root;

                    const open =
                        !root?.classList
                            .contains(
                                "is-navigation-open"
                            );

                    root?.classList.toggle(
                        "is-navigation-open",
                        open
                    );

                    navigationToggle.setAttribute(
                        "aria-expanded",
                        String(open)
                    );

                    return;
                }

                const navigationClose =
                    target.closest(
                        "[data-lesson-navigation-close]"
                    );

                if (navigationClose) {
                    event.preventDefault();
                    closeNavigation();
                }
            }
        );

        document.addEventListener(
            "input",
            (event) => {
                const input =
                    event.target instanceof
                        Element
                        ? event.target.closest(
                            "[data-lesson-note-input]"
                        )
                        : null;

                if (!input) {
                    return;
                }

                queueNoteSave(
                    input.dataset.courseId,
                    input.dataset.lessonId,
                    input.value
                );
            }
        );

        document.addEventListener(
            "keydown",
            (event) => {
                const target =
                    event.target;

                const typing =
                    target instanceof
                        HTMLElement &&
                    (
                        target.matches(
                            [
                                "input",
                                "textarea",
                                "select"
                            ].join(", ")
                        ) ||
                        target.isContentEditable
                    );

                if (
                    event.key === "Escape"
                ) {
                    closeNavigation();

                    return;
                }

                if (typing) {
                    return;
                }

                if (
                    event.altKey &&
                    event.key ===
                        "ArrowLeft"
                ) {
                    event.preventDefault();
                    goToPreviousLesson();

                    return;
                }

                if (
                    event.altKey &&
                    event.key ===
                        "ArrowRight"
                ) {
                    event.preventDefault();
                    goToNextLesson();

                    return;
                }

                if (
                    (
                        event.ctrlKey ||
                        event.metaKey
                    ) &&
                    event.key === "Enter"
                ) {
                    event.preventDefault();
                    toggleCurrentLesson();
                }
            }
        );

        window.addEventListener(
            "popstate",
            () => {
                persistPendingNote();

                renderAll({
                    updateUrl: false
                });
            }
        );

        window.addEventListener(
            "beforeunload",
            persistPendingNote
        );

        window.addEventListener(
            "storage",
            (event) => {
                if (
                    event.key !==
                    STORAGE_KEY
                ) {
                    return;
                }

                lessonState =
                    readLessonState();

                renderAll({
                    updateUrl: false
                });
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
            typeof dataApi.getCourseById !==
                "function"
        ) {
            return false;
        }

        lessonState =
            readLessonState();

        cacheElements();
        bindEvents();

        initialized = true;

        renderAll();

        document.dispatchEvent(
            new CustomEvent(
                "robotacademy:lessonready",
                {
                    detail: {
                        lesson: api
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

        persistPendingNote();

        lessonState =
            readLessonState();

        cacheElements();

        return renderAll();
    };


    /* ---------------------------------------------------------
       公開 API
    --------------------------------------------------------- */

    const api = {
        version: "1.0.0",

        init,
        refresh,

        getCurrentCourse() {
            return clone(
                currentCourse
            );
        },

        getCurrentLesson() {
            return clone(
                currentLesson
            );
        },

        getLessons(courseId) {
            const course =
                getCourseById(courseId);

            if (!course) {
                return [];
            }

            return clone(
                getLessonsForCourse(
                    course
                )
            );
        },

        goToLesson,
        previous: goToPreviousLesson,
        next: goToNextLesson,

        isCompleted(
            courseId,
            lessonId
        ) {
            return isLessonCompleted(
                courseId,
                lessonId
            );
        },

        setCompleted(
            courseId,
            lessonId,
            completed = true
        ) {
            return setLessonCompleted(
                courseId,
                lessonId,
                completed
            );
        },

        toggleCurrent:
            toggleCurrentLesson,

        getCompletedLessons(
            courseId
        ) {
            return clone(
                getCompletedLessonIds(
                    courseId
                )
            );
        },

        getProgress(courseId) {
            const course =
                getCourseById(courseId);

            if (!course) {
                return 0;
            }

            const lessons =
                getLessonsForCourse(
                    course
                );

            return getLessonProgress(
                courseId,
                lessons
            );
        },

        getNote,

        saveNote,

        getState() {
            return clone(
                lessonState
            );
        },

        resetCourse(courseId) {
            delete lessonState
                .completedByCourse[
                    courseId
                ];

            delete lessonState
                .currentByCourse[
                    courseId
                ];

            delete lessonState
                .notesByCourse[
                    courseId
                ];

            lessonState
                .initializedCourses =
                lessonState
                    .initializedCourses
                    .filter((id) => {
                        return id !== courseId;
                    });

            saveLessonState();

            if (
                courseApi &&
                typeof courseApi
                    .setProgress ===
                    "function"
            ) {
                courseApi.setProgress(
                    courseId,
                    0
                );
            }

            renderAll({
                updateUrl: false
            });

            return true;
        }
    };

    window.RobotAcademyLesson =
        api;

    window.RobotAcademy =
        window.RobotAcademy || {};

    window.RobotAcademy.lesson =
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
