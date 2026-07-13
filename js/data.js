/* =========================================================
   Robot Academy
   全站共用資料
========================================================= */

(() => {
    "use strict";

    /* ---------------------------------------------------------
       資料工具
    --------------------------------------------------------- */

    const clone = (value) => {
        if (typeof structuredClone === "function") {
            return structuredClone(value);
        }

        return JSON.parse(JSON.stringify(value));
    };

    const normalizeText = (value) => {
        return String(value || "")
            .normalize("NFKC")
            .trim()
            .toLowerCase();
    };


    /* ---------------------------------------------------------
       課程分類
    --------------------------------------------------------- */

    const categories = [
        {
            id: "robotics",
            name: "機器人基礎",
            icon: "🤖",
            color: "blue",
            description: "認識機器人結構、控制原理與基本應用。"
        },
        {
            id: "electronics",
            name: "電子與電路",
            icon: "⚡",
            color: "yellow",
            description: "學習電子元件、電路設計與實作技巧。"
        },
        {
            id: "programming",
            name: "程式設計",
            icon: "💻",
            color: "purple",
            description: "使用程式控制機器人完成各種任務。"
        },
        {
            id: "arduino",
            name: "Arduino",
            icon: "🔧",
            color: "teal",
            description: "使用 Arduino 製作互動式電子專案。"
        },
        {
            id: "artificial-intelligence",
            name: "人工智慧",
            icon: "🧠",
            color: "pink",
            description: "將人工智慧與機器人技術整合應用。"
        },
        {
            id: "computer-vision",
            name: "電腦視覺",
            icon: "👁️",
            color: "green",
            description: "讓機器人透過影像辨識理解環境。"
        }
    ];


    /* ---------------------------------------------------------
       課程資料
    --------------------------------------------------------- */

    const courses = [
        {
            id: "robot-basics",
            title: "機器人基礎入門",
            subtitle: "從零開始認識機器人",
            categoryId: "robotics",
            level: "beginner",
            durationMinutes: 180,
            lessonCount: 12,
            rating: 4.9,
            studentCount: 1280,
            featured: true,
            isNew: false,
            icon: "🤖",
            color: "blue",
            description:
                "認識機器人的基本結構、感測器、致動器與控制方式，建立完整的機器人基礎觀念。",
            tags: [
                "機器人",
                "基礎",
                "感測器",
                "馬達"
            ],
            updatedAt: "2025-01-15"
        },
        {
            id: "electronics-basics",
            title: "電子電路基礎",
            subtitle: "看懂電路並安全完成實作",
            categoryId: "electronics",
            level: "beginner",
            durationMinutes: 150,
            lessonCount: 10,
            rating: 4.8,
            studentCount: 960,
            featured: true,
            isNew: false,
            icon: "⚡",
            color: "yellow",
            description:
                "從電壓、電流、電阻開始，學會使用麵包板與常見電子元件完成基礎電路。",
            tags: [
                "電子",
                "電路",
                "麵包板",
                "LED"
            ],
            updatedAt: "2025-02-03"
        },
        {
            id: "arduino-starter",
            title: "Arduino 創客入門",
            subtitle: "完成你的第一個 Arduino 專案",
            categoryId: "arduino",
            level: "beginner",
            durationMinutes: 240,
            lessonCount: 16,
            rating: 4.9,
            studentCount: 1840,
            featured: true,
            isNew: false,
            icon: "🔧",
            color: "teal",
            description:
                "學習 Arduino 開發環境、數位輸入輸出、類比訊號與常用感測器控制。",
            tags: [
                "Arduino",
                "感測器",
                "LED",
                "創客"
            ],
            updatedAt: "2025-02-18"
        },
        {
            id: "robot-programming",
            title: "機器人程式設計",
            subtitle: "使用程式控制機器人的動作",
            categoryId: "programming",
            level: "intermediate",
            durationMinutes: 300,
            lessonCount: 20,
            rating: 4.7,
            studentCount: 740,
            featured: false,
            isNew: false,
            icon: "💻",
            color: "purple",
            description:
                "透過條件判斷、迴圈、函式與狀態控制，設計可靠的機器人控制程式。",
            tags: [
                "程式設計",
                "控制",
                "演算法",
                "除錯"
            ],
            updatedAt: "2025-03-01"
        },
        {
            id: "sensor-applications",
            title: "感測器應用實戰",
            subtitle: "讓機器人感知周遭環境",
            categoryId: "robotics",
            level: "intermediate",
            durationMinutes: 210,
            lessonCount: 14,
            rating: 4.8,
            studentCount: 620,
            featured: false,
            isNew: true,
            icon: "📡",
            color: "green",
            description:
                "實作超音波、紅外線、光線與溫度感測器，讓機器人能夠回應環境變化。",
            tags: [
                "感測器",
                "超音波",
                "紅外線",
                "環境偵測"
            ],
            updatedAt: "2025-03-12"
        },
        {
            id: "line-following-robot",
            title: "循跡機器人實作",
            subtitle: "打造可以自動循線的機器人",
            categoryId: "robotics",
            level: "intermediate",
            durationMinutes: 270,
            lessonCount: 18,
            rating: 4.9,
            studentCount: 880,
            featured: true,
            isNew: false,
            icon: "🏎️",
            color: "red",
            description:
                "整合紅外線感測器、馬達控制與循跡演算法，完成可調整速度的循跡機器人。",
            tags: [
                "循跡",
                "馬達",
                "PID",
                "機器人"
            ],
            updatedAt: "2025-02-25"
        },
        {
            id: "computer-vision-basics",
            title: "電腦視覺基礎",
            subtitle: "讓機器人看懂影像",
            categoryId: "computer-vision",
            level: "advanced",
            durationMinutes: 360,
            lessonCount: 24,
            rating: 4.7,
            studentCount: 430,
            featured: false,
            isNew: true,
            icon: "👁️",
            color: "green",
            description:
                "學習影像處理、顏色辨識、物件偵測與攝影機校正等電腦視覺基礎技術。",
            tags: [
                "電腦視覺",
                "影像處理",
                "OpenCV",
                "辨識"
            ],
            updatedAt: "2025-03-15"
        },
        {
            id: "ai-robotics",
            title: "AI 智慧機器人",
            subtitle: "整合人工智慧與機器人控制",
            categoryId: "artificial-intelligence",
            level: "advanced",
            durationMinutes: 420,
            lessonCount: 28,
            rating: 4.9,
            studentCount: 510,
            featured: true,
            isNew: true,
            icon: "🧠",
            color: "pink",
            description:
                "將機器學習、影像辨識與智慧決策應用在機器人專案，打造具備自主能力的機器人。",
            tags: [
                "人工智慧",
                "機器學習",
                "智慧控制",
                "機器人"
            ],
            updatedAt: "2025-03-20"
        }
    ];


    /* ---------------------------------------------------------
       今日任務
    --------------------------------------------------------- */

    const tasks = [
        {
            id: "task-complete-lesson",
            title: "完成「機器人基本結構」課程",
            description: "預計需要 15 分鐘",
            type: "lesson",
            courseId: "robot-basics",
            points: 20,
            priority: "high"
        },
        {
            id: "task-daily-quiz",
            title: "完成今日知識測驗",
            description: "共 5 題，答對 3 題即可完成",
            type: "quiz",
            courseId: null,
            points: 30,
            priority: "medium"
        },
        {
            id: "task-arduino-practice",
            title: "練習 Arduino LED 控制",
            description: "完成閃爍頻率調整實作",
            type: "practice",
            courseId: "arduino-starter",
            points: 40,
            priority: "medium"
        }
    ];


    /* ---------------------------------------------------------
       公告資料
    --------------------------------------------------------- */

    const announcements = [
        {
            id: "announcement-new-course",
            title: "全新 AI 智慧機器人課程上線",
            content:
                "學習如何將人工智慧、影像辨識與機器人控制整合在同一個專案中。",
            type: "course",
            date: "2025-03-20",
            important: true
        },
        {
            id: "announcement-quiz",
            title: "每週機器人知識挑戰",
            content:
                "完成本週挑戰測驗即可獲得額外學習積分。",
            type: "event",
            date: "2025-03-18",
            important: false
        },
        {
            id: "announcement-maintenance",
            title: "系統功能更新",
            content:
                "課程進度與收藏功能已完成更新，現在可自動保存在瀏覽器中。",
            type: "system",
            date: "2025-03-15",
            important: false
        }
    ];


    /* ---------------------------------------------------------
       等級文字
    --------------------------------------------------------- */

    const levelLabels = {
        beginner: "初級",
        intermediate: "中級",
        advanced: "進階"
    };


    /* ---------------------------------------------------------
       資料查詢功能
    --------------------------------------------------------- */

    const getCategories = () => {
        return clone(
            categories.map((category) => {
                const courseCount = courses.filter(
                    (course) => {
                        return (
                            course.categoryId ===
                            category.id
                        );
                    }
                ).length;

                return {
                    ...category,
                    courseCount
                };
            })
        );
    };

    const getCategoryById = (categoryId) => {
        const category = categories.find(
            (item) => item.id === categoryId
        );

        return category ? clone(category) : null;
    };

    const getCourses = () => {
        return clone(courses);
    };

    const getCourseById = (courseId) => {
        const course = courses.find(
            (item) => item.id === courseId
        );

        if (!course) {
            return null;
        }

        const category = categories.find(
            (item) => {
                return item.id === course.categoryId;
            }
        );

        return clone({
            ...course,
            category: category || null,
            levelLabel:
                levelLabels[course.level] ||
                course.level
        });
    };

    const getFeaturedCourses = (
        limit = 6
    ) => {
        return clone(
            courses
                .filter((course) => {
                    return course.featured;
                })
                .slice(0, limit)
        );
    };

    const getNewCourses = (
        limit = 6
    ) => {
        return clone(
            courses
                .filter((course) => {
                    return course.isNew;
                })
                .sort((courseA, courseB) => {
                    return (
                        new Date(
                            courseB.updatedAt
                        ) -
                        new Date(
                            courseA.updatedAt
                        )
                    );
                })
                .slice(0, limit)
        );
    };

    const getCoursesByCategory = (
        categoryId
    ) => {
        return clone(
            courses.filter((course) => {
                return (
                    course.categoryId ===
                    categoryId
                );
            })
        );
    };

    const getRelatedCourses = (
        courseId,
        limit = 3
    ) => {
        const currentCourse = courses.find(
            (course) => {
                return course.id === courseId;
            }
        );

        if (!currentCourse) {
            return [];
        }

        return clone(
            courses
                .filter((course) => {
                    return (
                        course.id !== courseId &&
                        course.categoryId ===
                            currentCourse.categoryId
                    );
                })
                .slice(0, limit)
        );
    };

    const searchCourses = (
        options = {}
    ) => {
        const {
            query = "",
            category = "all",
            level = "all",
            featured = false,
            isNew = false,
            sort = "default",
            limit = 0
        } = options;

        const normalizedQuery =
            normalizeText(query);

        let result = courses.filter(
            (course) => {
                if (
                    category !== "all" &&
                    course.categoryId !== category
                ) {
                    return false;
                }

                if (
                    level !== "all" &&
                    course.level !== level
                ) {
                    return false;
                }

                if (
                    featured &&
                    !course.featured
                ) {
                    return false;
                }

                if (isNew && !course.isNew) {
                    return false;
                }

                if (!normalizedQuery) {
                    return true;
                }

                const searchableText =
                    normalizeText(
                        [
                            course.title,
                            course.subtitle,
                            course.description,
                            ...course.tags
                        ].join(" ")
                    );

                return searchableText.includes(
                    normalizedQuery
                );
            }
        );

        if (sort === "rating") {
            result.sort((courseA, courseB) => {
                return (
                    courseB.rating -
                    courseA.rating
                );
            });
        }

        if (sort === "popular") {
            result.sort((courseA, courseB) => {
                return (
                    courseB.studentCount -
                    courseA.studentCount
                );
            });
        }

        if (sort === "newest") {
            result.sort((courseA, courseB) => {
                return (
                    new Date(courseB.updatedAt) -
                    new Date(courseA.updatedAt)
                );
            });
        }

        if (sort === "title") {
            result.sort((courseA, courseB) => {
                return courseA.title.localeCompare(
                    courseB.title,
                    "zh-Hant"
                );
            });
        }

        if (limit > 0) {
            result = result.slice(0, limit);
        }

        return clone(result);
    };

    const getTasks = () => {
        return clone(tasks);
    };

    const getTaskById = (taskId) => {
        const task = tasks.find(
            (item) => item.id === taskId
        );

        return task ? clone(task) : null;
    };

    const getAnnouncements = (
        limit = 0
    ) => {
        const result = [...announcements].sort(
            (announcementA, announcementB) => {
                return (
                    new Date(
                        announcementB.date
                    ) -
                    new Date(
                        announcementA.date
                    )
                );
            }
        );

        return clone(
            limit > 0
                ? result.slice(0, limit)
                : result
        );
    };

    const getLevelLabel = (level) => {
        return levelLabels[level] || level;
    };


    /* ---------------------------------------------------------
       公開 API
    --------------------------------------------------------- */

    const api = {
        version: "1.0.0",

        getCategories,
        getCategoryById,

        getCourses,
        getCourseById,
        getFeaturedCourses,
        getNewCourses,
        getCoursesByCategory,
        getRelatedCourses,
        searchCourses,

        getTasks,
        getTaskById,

        getAnnouncements,
        getLevelLabel
    };

    window.RobotAcademyData = api;

    window.RobotAcademy =
        window.RobotAcademy || {};

    window.RobotAcademy.data = api;

    document.dispatchEvent(
        new CustomEvent(
            "robotacademy:dataready",
            {
                detail: {
                    data: api
                }
            }
        )
    );
})();
