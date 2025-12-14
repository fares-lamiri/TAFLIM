// ========== TAFLIM - النظام المحسن النهائي مع منع التكرار ==========

// ===== إعدادات API =====
const TMDB_API_KEY = "dbb14198ea29a547de77343dc3fe7a37";
const TMDB_BASE_URL = "https://api.themoviedb.org/3";
const IMAGE_BASE = "https://image.tmdb.org/t/p/w500";

// ===== عناصر DOM =====
const trendingContainer = document.getElementById("trending-container");
const trendingSection = document.getElementById("trending-section");
const mainContent = document.getElementById("main-content");
const searchInput = document.getElementById("search");
const suggestionsContainer = document.getElementById("search-suggestions");
const menuBtn = document.getElementById("menu-btn");
const sidebar = document.getElementById("sidebar");
const closeSidebar = document.getElementById("close-sidebar");
const overlay = document.getElementById("overlay");
const backToTopBtn = document.getElementById("back-to-top");
const searchResultsSection = document.getElementById("search-results-section");
const searchResultsContainer = document.getElementById("search-results-container");
const searchQueryText = document.getElementById("search-query-text");
const searchResultsCount = document.getElementById("search-results-count");
const resetFiltersBtn = document.getElementById("reset-filters");
const activeFiltersContainer = document.getElementById("active-filters");
const loadingIndicator = document.getElementById("loading-indicator");

// ===== متغيرات النظام =====
let allContent = [];
let displayedContent = [];
let displayedCount = 0;
const itemsPerLoad = 20;
let searchTimer = null;
let activeFilters = {};
let isLoading = false;
let currentPage = 1;
let isFetchingMore = false;
let hasMoreContent = true;

// ===== متغيرات السلايدر =====
let sliderAutoScrollInterval;
let isSliderPaused = false;
let isDragging = false;
let startX;
let scrollLeft;
let sliderItems = [];

// ===== نظام إدارة المحتوى المركزي مع الأولوية للسلايدر =====
const contentManager = {
    seenIds: new Set(),        // كل المحتويات التي رأيناها
    displayedIds: new Set(),   // المحتويات المعروضة في الرئيسي
    sliderIds: new Set(),      // المحتويات المعروضة في السلايدر (لها الأولوية)
    
    resetForNewContext(context) {
        if (context === 'search' || context === 'filters') {
            this.displayedIds.clear();
        }
        // لا نمسح sliderIds أبداً لأن السلايدر له الأولوية
    },
    
    canDisplayInMain(itemId) {
        // منع العرض في الرئيسي إذا كان في السلايدر
        if (this.sliderIds.has(itemId)) {
            console.log('🚫 منع عرض في الرئيسي - موجود في السلايدر:', itemId);
            return false;
        }
        // منع التكرار داخل الرئيسي نفسه
        if (this.displayedIds.has(itemId)) {
            console.log('🚫 منع تكرار في الرئيسي:', itemId);
            return false;
        }
        return true;
    },
    
    canDisplayInSlider(itemId) {
        // السلايدر يمكنه عرض أي محتوى حتى لو كان في الرئيسي
        // (سيتم إزالته من الرئيسي لاحقاً)
        return !this.sliderIds.has(itemId); // منع التكرار داخل السلايدر نفسه
    },
    
    addToSlider(itemId) {
        this.sliderIds.add(itemId);
        this.seenIds.add(itemId);
        
        // إذا كان هذا العنصر معروضاً في الرئيسي، قم بإزالته
        this.removeFromMainIfExists(itemId);
    },
    
    addToMain(itemId) {
        // تأكد أولاً أن العنصر ليس في السلايدر
        if (!this.sliderIds.has(itemId)) {
            this.displayedIds.add(itemId);
            this.seenIds.add(itemId);
        } else {
            console.log('⚠️ حاول إضافة عنصر للرئيسي وهو في السلايدر:', itemId);
        }
    },
    
    removeFromMainIfExists(itemId) {
        if (this.displayedIds.has(itemId)) {
            this.displayedIds.delete(itemId);
            console.log('🔄 إزالة من الرئيسي لصالح السلايدر:', itemId);
            return true;
        }
        return false;
    },
    
    clearAll() {
        this.seenIds.clear();
        this.displayedIds.clear();
        this.sliderIds.clear();
    }
};

// ===== نظام اللغات الذكي =====
const LANGUAGE_CONFIG = {
    "ko": { 
        language: "ar-SA", 
        flag: "🇰🇷", 
        name: "كوري", 
        displayLang: "ar",
        isArabicTitle: true,
        priorityArabic: true
    },
    "hi": { 
        language: "ar-SA", 
        flag: "🇮🇳", 
        name: "هندي", 
        displayLang: "ar",
        isArabicTitle: true,
        priorityArabic: false
    },
    "tr": { 
        language: "ar-SA", 
        flag: "🇹🇷", 
        name: "تركي", 
        displayLang: "ar",
        isArabicTitle: true,
        priorityArabic: false
    },
    "zh": { 
        language: "ar-SA", 
        flag: "🇨🇳", 
        name: "صيني", 
        displayLang: "ar",
        isArabicTitle: true,
        priorityArabic: false
    },
    "ja": { 
        language: "ja-JP", 
        flag: "🇯🇵", 
        name: "ياباني", 
        displayLang: "romanji",
        isArabicTitle: false,
        priorityArabic: false
    },
    "ar": { 
        language: "ar-SA", 
        flag: "🇸🇦", 
        name: "عربي", 
        displayLang: "ar",
        isArabicTitle: true,
        priorityArabic: false
    },
    "th": { 
        language: "ar-SA", 
        flag: "🇹🇭", 
        name: "تايلندي", 
        displayLang: "ar",
        isArabicTitle: true,
        priorityArabic: false
    },
    "vi": { 
        language: "ar-SA", 
        flag: "🇻🇳", 
        name: "فيتنامي", 
        displayLang: "ar",
        isArabicTitle: true,
        priorityArabic: false
    },
    "default": { 
        language: "en-US", 
        flag: "🌍", 
        name: "أجنبي", 
        displayLang: "en",
        isArabicTitle: false,
        priorityArabic: false
    }
};

// قاموس الترجمات الموسع
const TITLE_TRANSLATIONS = {
    "Squid Game": "لعبة الحبار",
    "Vincenzo": "فينسنزو",
    "Crash Landing on You": "هبوط اضطراري",
    "Goblin": "الغوبلين",
    "The Glory": "المجد",
    "Descendants of the Sun": "أبناء الشمس",
    "Itaewon Class": "فئة إيتاون",
    "Business Proposal": "اقتراح عمل",
    "Hometown Cha-Cha-Cha": "موطن تشا تشا تشا",
    "Mr. Sunshine": "السيد شاين",
    "Reply 1988": "رد 1988",
    "Hospital Playlist": "قائمة مستشفى",
    "Extraordinary Attorney Woo": "المحامية وو الشاطرة",
    "The King's Affection": "عاطفة الملك",
    "Alchemy of Souls": "كيمياء الأرواح",
    "Twenty Five Twenty One": "خمسة وعشرون واحد وعشرون",
    
    "RRR": "آر آر آر",
    "Baahubali": "باهوبالي",
    "3 Idiots": "3 أغبياء",
    "Dangal": "دانغال",
    
    "Kuruluş: Osman": "التأسيس: عثمان",
    "Diriliş: Ertuğrul": "القيامة: أرطغرل",
    
    "The Untamed": "الجامح",
    "Word of Honor": "كلمة الشرف",
    
    "進撃の巨人": "Shingeki no Kyojin",
    "鬼滅の刃": "Kimetsu no Yaiba",
    "呪術廻戦": "Jujutsu Kaisen",
    "僕のヒーローアカデミア": "Boku no Hero Academia",
    "ONE PIECE": "One Piece",
    "ナルト": "Naruto",
    
    "Attack on Titan": "هجوم العمالقة",
    "Demon Slayer": "قاتل الشياطين",
    "Jujutsu Kaisen": "كايسن الجوجوتسو",
    "My Hero Academia": "أكاديميتي للأبطال",
    "Naruto": "ناروتو",
    
    "Stranger Things": "أشياء غريبة",
    "Game of Thrones": "لعبة العروش",
    "Breaking Bad": "بريكينج باد",
    "The Witcher": "الوحش",
    "Money Heist": "سرقة المال",
    
    "Interstellar": "بين النجوم",
    "Inception": "بداية",
    "The Dark Knight": "الفارس المظلم",
    "Parasite": "الطفيلي",
    "Avengers": "المنتقمون",
    
    "action": "أكشن",
    "comedy": "كوميديا",
    "drama": "دراما",
    "horror": "رعب",
    "romance": "رومانسي",
    "thriller": "إثارة",
    "sci-fi": "خيال علمي",
    "animation": "رسوم متحركة",
    
    "movie": "فيلم",
    "series": "مسلسل",
    "tv": "تلفزيون",
    "anime": "أنمي",
    "cartoon": "كرتون",
    
    "Lee Min-ho": "لي مين هو",
    "Park Seo-joon": "بارك سيو جون",
    "Song Joong-ki": "سونغ جونغ كي",
    "Kim Soo-hyun": "كيم سو هيون",
    "Cha Eun-woo": "تشا إيون وو",
    
    "The Blue Elephant": "الفيل الأزرق",
    "The Innocence": "البراءة",
    "The Cell": "الخلية",
    "The Crime": "الجريمة",
    
    "Magnificent Century": "القرن العظيم",
    "Resurrection: Ertuğrul": "قيامة أرطغرل",
    "Black Money Love": "حل أسود"
};

async function getSmartTitle(item) {
    if (!item) return "غير معروف";
    
    const originalLang = item.original_language || "en";
    const langConfig = LANGUAGE_CONFIG[originalLang] || LANGUAGE_CONFIG.default;
    const mediaType = item.media_type || (item.title ? "movie" : "tv");
    
    let title = item.title || item.name || item.original_title || "";
    
    item.type = mediaType;
    if (item.genre_ids && item.genre_ids.includes(16)) {
        item.type = "anime";
    }
    
    // PRIORITY FOR KOREAN CONTENT - ARABIC FIRST
    if (originalLang === "ko") {
        if (TITLE_TRANSLATIONS[title]) {
            return TITLE_TRANSLATIONS[title];
        }
        return title;
    }
    
    // باقي المحتوى
    if (langConfig.displayLang === "romanji") {
        return TITLE_TRANSLATIONS[title] || title;
    } else if (langConfig.isArabicTitle) {
        const arabicTitle = TITLE_TRANSLATIONS[title];
        return arabicTitle || title;
    } else {
        return title;
    }
}

// ===== دوال البحث الذكي =====
function normalizeArabicText(text) {
    if (!text) return '';
    
    return text
        .trim()
        .normalize('NFD')
        .replace(/[\u064B-\u0652]/g, '')
        .replace(/أ|إ|آ/g, 'ا')
        .replace(/ة/g, 'ه')
        .replace(/ئ|ء/g, '')
        .replace(/ى/g, 'ي')
        .toLowerCase();
}

function searchWithTransliteration(item, searchTerm) {
    const arabicSearch = normalizeArabicText(searchTerm);
    
    if (item.smartTitle) {
        const normalizedSmart = normalizeArabicText(item.smartTitle);
        if (normalizedSmart.includes(arabicSearch)) {
            return true;
        }
    }
    
    const englishTitle = (item.title || item.name || "").toLowerCase();
    if (englishTitle.includes(searchTerm.toLowerCase())) {
        return true;
    }
    
    for (const [english, arabic] of Object.entries(TITLE_TRANSLATIONS)) {
        const normalizedArabic = normalizeArabicText(arabic);
        
        if (normalizedArabic.includes(arabicSearch)) {
            const itemEnglishTitle = (item.title || item.name || "").toLowerCase();
            if (itemEnglishTitle.includes(english.toLowerCase())) {
                return true;
            }
        }
        
        if (english.toLowerCase().includes(searchTerm.toLowerCase())) {
            const normalizedItemArabic = normalizeArabicText(item.smartTitle || "");
            if (normalizedItemArabic.includes(normalizeArabicText(arabic))) {
                return true;
            }
        }
    }
    
    const transliterationMap = {
        'ا': ['a'],
        'ب': ['b'],
        'ت': ['t'],
        'ث': ['th'],
        'ج': ['j', 'g'],
        'ح': ['h'],
        'خ': ['kh', 'x'],
        'د': ['d'],
        'ذ': ['dh', 'z'],
        'ر': ['r'],
        'ز': ['z'],
        'س': ['s'],
        'ش': ['sh', 'ch'],
        'ص': ['s'],
        'ض': ['d'],
        'ط': ['t'],
        'ظ': ['z'],
        'ع': ['a', 'e', 'o'],
        'غ': ['gh', 'g'],
        'ف': ['f'],
        'ق': ['q', 'k'],
        'ك': ['k'],
        'ل': ['l'],
        'م': ['m'],
        'ن': ['n'],
        'ه': ['h'],
        'و': ['w', 'o', 'u'],
        'ي': ['y', 'i', 'e']
    };
    
    if (/[\u0600-\u06FF]/.test(searchTerm)) {
        const possibleTransliterations = generateTransliterations(arabicSearch);
        for (const trans of possibleTransliterations) {
            if (englishTitle.includes(trans)) {
                return true;
            }
        }
    }
    
    return false;
}

function generateTransliterations(arabicText) {
    const results = [''];
    
    for (const char of arabicText) {
        const transliterations = transliterationMap[char] || [char];
        const newResults = [];
        
        for (const result of results) {
            for (const trans of transliterations) {
                newResults.push(result + trans);
            }
        }
        
        results.splice(0, results.length, ...newResults);
    }
    
    return results.slice(0, 10);
}

function searchSmartTitles(item, searchTerm) {
    for (const [english, arabic] of Object.entries(TITLE_TRANSLATIONS)) {
        if (arabic.toLowerCase().includes(searchTerm)) {
            const title = (item.title || item.name || "").toLowerCase();
            return title.includes(english.toLowerCase());
        }
    }
    
    return false;
}

// ===== إدارة عرض السلايدر =====
function showTrendingSection() {
    if (trendingSection) {
        trendingSection.classList.remove('hidden');
        trendingSection.style.display = 'block';
    }
}

function hideTrendingSection() {
    if (trendingSection) {
        trendingSection.classList.add('hidden');
        trendingSection.style.display = 'none';
    }
}

// ===== جلب المحتوى الأولي =====
async function loadInitialContent() {
    showLoadingMessage();
    
    try {
        const [popularMovies, popularTV, trending, topRated] = await Promise.all([
            fetchTMDBContent("/movie/popular", 4),
            fetchTMDBContent("/tv/popular", 4),
            fetchTMDBContent("/trending/all/week", 3),
            fetchTMDBContent("/movie/top_rated", 2)
        ]);
        
        allContent = [...popularMovies, ...popularTV, ...trending, ...topRated];
        
        const processingPromises = allContent.map(async (item) => {
            item.smartTitle = await getSmartTitle(item);
            contentManager.seenIds.add(item.id);
            return item;
        });
        
        await Promise.all(processingPromises);
        
        console.log(`✅ تم تحميل ${allContent.length} عنصر`);
        
        // 1. عرض المحتوى الرئيسي أولاً
        updateDisplayedContent();
        
        // 2. انتظار قليل ثم عرض السلايدر
        setTimeout(() => {
            updateTrendingSlider();
            
            // 3. التحقق بعد عرض السلايدر
            setTimeout(() => {
                const isValid = verifySliderContent();
                if (!isValid) {
                    console.warn('🔄 إعادة تحميل السلايدر بعد اكتشاف مشكلة');
                    updateTrendingSlider();
                }
            }, 500);
        }, 300);
        
    } catch (error) {
        console.error("خطأ في جلب المحتوى:", error);
        showErrorMessage();
    }
}
function updateDisplayedContent() {
    // تصفية المحتوى لاستبعاد ما في السلايدر
    displayedContent = allContent.filter(item => 
        contentManager.canDisplayInMain(item.id)
    );
    
    displayedCount = 0;
    currentPage = 1;
    hasMoreContent = true;
    
    displayContentInMain();
    setupInfiniteScroll();
}

async function fetchTMDBContent(endpoint, pages = 1) {
    const results = [];
    
    for (let page = 1; page <= pages; page++) {
        try {
            const response = await fetch(
                `${TMDB_BASE_URL}${endpoint}?api_key=${TMDB_API_KEY}&page=${page}&language=en-US`
            );
            
            if (response.ok) {
                const data = await response.json();
                
                if (data.results) {
                    data.results.forEach(item => {
                        if (item.poster_path && !contentManager.seenIds.has(item.id)) {
                            results.push(item);
                        }
                    });
                }
            }
        } catch (error) {
            console.warn(`خطأ في جلب ${endpoint} صفحة ${page}:`, error);
        }
    }
    
    return results;
}

// ===== نظام Infinite Scroll =====
function setupInfiniteScroll() {
    window.addEventListener('scroll', handleScroll);
}

function handleScroll() {
    if (isLoading || !hasMoreContent) return;
    
    const scrollPosition = window.innerHeight + window.scrollY;
    const pageHeight = document.body.offsetHeight;
    const triggerPoint = pageHeight - 500;
    
    if (scrollPosition >= triggerPoint) {
        loadMoreContent();
    }
}

async function loadMoreContent() {
    if (isLoading || isFetchingMore) return;
    
    isFetchingMore = true;
    showLoadingIndicator();
    
    try {
        if (displayedCount < displayedContent.length) {
            const nextItems = displayedContent
                .slice(displayedCount)
                .filter(item => contentManager.canDisplayInMain(item.id))
                .slice(0, itemsPerLoad);
            
            if (nextItems.length > 0) {
                displayMoreContent(nextItems);
                displayedCount += nextItems.length;
            }
        } else {
            await fetchMoreFilteredContent();
        }
        
    } catch (error) {
        console.error("خطأ في جلب المزيد:", error);
    } finally {
        isFetchingMore = false;
        hideLoadingIndicator();
    }
}

async function fetchMoreFilteredContent() {
    isLoading = true;
    
    try {
        currentPage++;
        
        const queryParams = buildFilterQueryParams();
        queryParams.page = currentPage;
        
        let endpoint = "/discover/movie";
        let isTVContent = false;
        
        if (hasTVFilters()) {
            endpoint = "/discover/tv";
            isTVContent = true;
        } else if (Object.keys(activeFilters).length > 0) {
            if (activeFilters.category && ['kdrama', 'anime', 'ramadan'].includes(activeFilters.category.value)) {
                endpoint = "/discover/tv";
                isTVContent = true;
            }
        } else if (Object.keys(activeFilters).length === 0) {
            endpoint = currentPage % 2 === 0 ? "/discover/movie" : "/discover/tv";
            isTVContent = endpoint === "/discover/tv";
        }
        
        const response = await fetch(
            `${TMDB_BASE_URL}${endpoint}?api_key=${TMDB_API_KEY}&${new URLSearchParams(queryParams)}`
        );
        
        if (response.ok) {
            const data = await response.json();
            
            if (data.results && data.results.length > 0) {
                const newItems = await processNewItems(data.results, isTVContent);
                
                if (newItems.length > 0) {
                    const filteredNewItems = newItems.filter(item => 
                        contentManager.canDisplayInMain(item.id)
                    );
                    
                    if (filteredNewItems.length > 0) {
                        filteredNewItems.forEach(item => {
                            if (!contentManager.seenIds.has(item.id)) {
                                contentManager.seenIds.add(item.id);
                                allContent.push(item);
                                displayedContent.push(item);
                            }
                        });
                        
                        displayMoreContent(filteredNewItems);
                        displayedCount += filteredNewItems.length;
                        
                        console.log(`تم إضافة ${filteredNewItems.length} عنصر جديد حسب الفلاتر`);
                    } else {
                        hasMoreContent = false;
                    }
                } else {
                    hasMoreContent = false;
                }
            } else {
                hasMoreContent = false;
            }
        }
        
    } catch (error) {
        console.error("خطأ في جلب محتوى مفلتر:", error);
        hasMoreContent = false;
    } finally {
        isLoading = false;
    }
}

async function processNewItems(items, isTVContent = false) {
    const processed = [];
    
    for (const item of items) {
        if (item.poster_path && !contentManager.seenIds.has(item.id)) {
            item.smartTitle = await getSmartTitle(item);
            item.type = isTVContent ? "tv" : "movie";
            if (item.genre_ids && item.genre_ids.includes(16)) {
                item.type = "anime";
            }
            
            processed.push(item);
        }
    }
    
    return processed;
}

function showLoadingIndicator() {
    if (loadingIndicator) {
        loadingIndicator.classList.add('active');
    }
}

function hideLoadingIndicator() {
    if (loadingIndicator) {
        loadingIndicator.classList.remove('active');
    }
}

// ===== عرض المحتوى مع منع التكرار =====
function displayContentInMain() {
    mainContent.innerHTML = '';
    contentManager.displayedIds.clear();
    
    if (displayedContent.length === 0) {
        mainContent.innerHTML = `
            <div style="grid-column:1/-1;text-align:center;padding:60px;color:#888">
                <div style="font-size:3rem;margin-bottom:20px">🔍</div>
                <h3>لا يوجد محتوى للعرض</h3>
            </div>
        `;
        return;
    }
    
    const itemsToShow = displayedContent.filter(item => 
        contentManager.canDisplayInMain(item.id)
    ).slice(0, itemsPerLoad);
    
    displayedCount = itemsToShow.length;
    
    itemsToShow.forEach(item => {
        const card = createCardElement(item);
        mainContent.appendChild(card);
        contentManager.addToMain(item.id);
    });
}

function createCardElement(item) {
    const card = document.createElement("div");
    card.className = "card";
    card.dataset.id = item.id;
    
    const title = item.smartTitle || item.title || item.name || "غير معروف";
    const poster = getBestPoster(item);
    
    card.innerHTML = `
        <div class="card-image">
            <img src="${poster}" alt="${title}" loading="lazy"
                 onerror="this.onerror=null; this.src='https://image.tmdb.org/t/p/w500/wwemzKWzjKYJFfCeiB57q3r4Bcm.png'">
        </div>
        <div class="card-content">
            <h3>${title}</h3>
        </div>
    `;
    
    card.onclick = () => {
        const type = item.type || (item.title ? "movie" : "tv");
        window.open(`details.html?type=${type}&id=${item.id}`, '_blank');
    };
    
    return card;
}

function getBestPoster(item) {
    if (item.poster_path) {
        return `${IMAGE_BASE}${item.poster_path}`;
    }
    
    return "https://image.tmdb.org/t/p/w500/wwemzKWzjKYJFfCeiB57q3r4Bcm.png";
}

function displayMoreContent(items) {
    items.forEach(item => {
        if (contentManager.canDisplayInMain(item.id)) {
            const card = createCardElement(item);
            mainContent.appendChild(card);
            contentManager.addToMain(item.id);
        }
    });
}

// ===== السلايدر المتحرك مع الأولوية =====
function updateTrendingSlider() {
    if (!trendingContainer) return;
    
    sliderItems = getUniqueSliderItems(20);
    
    if (sliderItems.length === 0) {
        trendingContainer.innerHTML = `
            <div style="display:flex; align-items:center; justify-content:center; min-width:100%; padding: 40px;">
                <p style="color:#aaa;">جاري تحميل المحتوى...</p>
            </div>
        `;
        return;
    }
    
    trendingContainer.innerHTML = '';
    
    sliderItems.forEach((item, index) => {
        const card = createSliderCard(item);
        card.style.setProperty('--card-index', index);
        trendingContainer.appendChild(card);
        contentManager.addToSlider(item.id);
    });
    
    setupSliderControls();
    setupDragAndScroll();
    startAutoSlider();
}
function getUniqueSliderItems(count = 20) {
    if (allContent.length === 0) return [];
    
    const uniqueItems = [];
    const usedIds = new Set();
    
    console.log('🎯 بدء اختيار محتوى للسلايدر...');
    console.log(`📊 المحتوى الكلي: ${allContent.length} عنصر`);
    console.log(`🚫 المستبعد (السلايدر): ${contentManager.sliderIds.size} عنصر`);
    console.log(`🚫 المستبعد (الرئيسي): ${contentManager.displayedIds.size} عنصر`);
    
    // 1. أولاً: محتوى عالي الجودة (تريندينج + تقييم عالي)
    const highQualityContent = allContent
        .filter(item => 
            !usedIds.has(item.id) && 
            !contentManager.sliderIds.has(item.id) &&
            (item.popularity > 70 || item.vote_average > 7.5)
        )
        .sort((a, b) => (b.popularity || 0) - (a.popularity || 0));
    
    // 2. إضافة المحتوى عالي الجودة أولاً
    const highQualityToAdd = Math.min(8, highQualityContent.length);
    for (let i = 0; i < highQualityToAdd; i++) {
        if (highQualityContent[i]) {
            uniqueItems.push(highQualityContent[i]);
            usedIds.add(highQualityContent[i].id);
        }
    }
    
    console.log(`⭐ أضيف ${highQualityToAdd} عنصر عالي الجودة`);
    
    // 3. تجميع المحتوى حسب النوع مع استبعاد التكرار
    const contentByType = {
        movie: allContent.filter(item => 
            item.type === 'movie' && 
            !usedIds.has(item.id) && 
            !contentManager.sliderIds.has(item.id)
        ),
        tv: allContent.filter(item => 
            item.type === 'tv' && 
            !usedIds.has(item.id) && 
            !contentManager.sliderIds.has(item.id)
        ),
        anime: allContent.filter(item => 
            item.type === 'anime' && 
            !usedIds.has(item.id) && 
            !contentManager.sliderIds.has(item.id)
        )
    };
    
    // 4. توزيع متوازن حسب النوع
    const remainingSlots = count - uniqueItems.length;
    const slotsPerType = Math.ceil(remainingSlots / 3);
    
    // أفلام
    const moviesToAdd = contentByType.movie
        .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
        .slice(0, slotsPerType);
    
    moviesToAdd.forEach(movie => {
        if (!usedIds.has(movie.id)) {
            uniqueItems.push(movie);
            usedIds.add(movie.id);
        }
    });
    
    console.log(`🎬 أضيف ${moviesToAdd.length} فيلم`);
    
    // مسلسلات
    const tvToAdd = contentByType.tv
        .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
        .slice(0, slotsPerType);
    
    tvToAdd.forEach(tv => {
        if (!usedIds.has(tv.id)) {
            uniqueItems.push(tv);
            usedIds.add(tv.id);
        }
    });
    
    console.log(`📺 أضيف ${tvToAdd.length} مسلسل`);
    
    // أنمي
    const animeToAdd = contentByType.anime
        .sort((a, b) => (b.popularity || 0) - (a.popularity || 0))
        .slice(0, slotsPerType);
    
    animeToAdd.forEach(anime => {
        if (!usedIds.has(anime.id)) {
            uniqueItems.push(anime);
            usedIds.add(anime.id);
        }
    });
    
    console.log(`🇯🇵 أضيف ${animeToAdd.length} أنمي`);
    
    // 5. إذا لم نصل للعدد المطلوب، نضيف محتوى متنوع
    if (uniqueItems.length < count) {
        const remainingNeeded = count - uniqueItems.length;
        const remainingContent = allContent
            .filter(item => 
                !usedIds.has(item.id) && 
                !contentManager.sliderIds.has(item.id)
            )
            .sort(() => Math.random() - 0.5) // عشوائية
            .slice(0, remainingNeeded);
        
        remainingContent.forEach(item => {
            uniqueItems.push(item);
            usedIds.add(item.id);
        });
        
        console.log(`🎲 أضيف ${remainingContent.length} عنصر عشوائي`);
    }
    
    // 6. التحقق النهائي من عدم وجود تكرار داخل السلايدر
    const finalCheck = new Set();
    const finalItems = [];
    
    for (const item of uniqueItems) {
        if (!finalCheck.has(item.id)) {
            finalCheck.add(item.id);
            finalItems.push(item);
        } else {
            console.warn(`⚠️ اكتشاف تكرار داخل السلايدر: ${item.id} - ${item.smartTitle}`);
        }
    }
    
    // 7. تسجيل النتيجة النهائية
    console.log(`✅ تم اختيار ${finalItems.length} عنصر للسلايدر`);
    console.log('📋 عناصر السلايدر:', finalItems.map(item => `${item.id}: ${item.smartTitle}`));
    
    return finalItems.slice(0, count);
}
function createSliderCard(item) {
    const card = document.createElement("div");
    card.className = "trending-card";
    card.dataset.id = item.id;
    
    const title = item.smartTitle || item.title || item.name || "غير معروف";
    const poster = getSliderPoster(item);
    
    card.innerHTML = `
        <img src="${poster}" alt="${title}" loading="lazy"
             onerror="this.onerror=null; this.src='https://image.tmdb.org/t/p/w780/wwemzKWzjKYJFfCeiB57q3r4Bcm.png'">
        <h3>${title}</h3>
    `;
    
    card.onclick = () => {
        const type = item.type || (item.title ? "movie" : "tv");
        window.open(`details.html?type=${type}&id=${item.id}`, '_blank');
    };
    
    return card;
}

function getSliderPoster(item) {
    if (item.backdrop_path) {
        return `https://image.tmdb.org/t/p/w780${item.backdrop_path}`;
    } else if (item.poster_path) {
        return `https://image.tmdb.org/t/p/w780${item.poster_path}`;
    }
    
    return "https://image.tmdb.org/t/p/w780/wwemzKWzjKYJFfCeiB57q3r4Bcm.png";
}

function setupDragAndScroll() {
    const container = trendingContainer;
    
    container.addEventListener('mousedown', startDrag);
    container.addEventListener('touchstart', startDrag, { passive: false });
    
    function startDrag(e) {
        isDragging = true;
        container.classList.add('grabbing');
        startX = (e.type === 'mousedown' ? e.pageX : e.touches[0].pageX) - container.offsetLeft;
        scrollLeft = container.scrollLeft;
        
        pauseSlider();
        
        document.addEventListener('mousemove', drag);
        document.addEventListener('touchmove', drag, { passive: false });
        document.addEventListener('mouseup', endDrag);
        document.addEventListener('touchend', endDrag);
    }
    
    function drag(e) {
        if (!isDragging) return;
        e.preventDefault();
        
        const x = (e.type === 'mousemove' ? e.pageX : e.touches[0].pageX) - container.offsetLeft;
        const walk = (x - startX) * 2;
        container.scrollLeft = scrollLeft - walk;
    }
    
    function endDrag() {
        isDragging = false;
        container.classList.remove('grabbing');
        
        setTimeout(() => {
            const cards = container.querySelectorAll('.trending-card');
            cards.forEach(card => {
                card.style.pointerEvents = 'auto';
            });
        }, 50);
        
        document.removeEventListener('mousemove', drag);
        document.removeEventListener('touchmove', drag);
        document.removeEventListener('mouseup', endDrag);
        document.removeEventListener('touchend', endDrag);
        
        setTimeout(() => {
            if (!isSliderPaused) {
                restartAutoSlider();
            }
        }, 2000);
    }
    
    container.addEventListener('scroll', () => {
        pauseSlider();
    });
}

function setupSliderControls() {
    const leftArrow = document.querySelector('.trending-arrow.left');
    const rightArrow = document.querySelector('.trending-arrow.right');
    
    if (leftArrow) {
        leftArrow.onclick = () => {
            scrollSlider(-400);
            restartAutoSlider();
        };
    }
    
    if (rightArrow) {
        rightArrow.onclick = () => {
            scrollSlider(400);
            restartAutoSlider();
        };
    }
}

function scrollSlider(amount) {
    trendingContainer.scrollBy({
        left: amount,
        behavior: 'smooth'
    });
}

function startAutoSlider() {
    if (sliderAutoScrollInterval) {
        clearInterval(sliderAutoScrollInterval);
    }
    
    sliderAutoScrollInterval = setInterval(() => {
        if (!isSliderPaused && sliderItems.length > 0) {
            const container = trendingContainer;
            const maxScroll = container.scrollWidth - container.clientWidth;
            
            if (container.scrollLeft >= maxScroll - 10) {
                container.scrollTo({
                    left: 0,
                    behavior: 'smooth'
                });
            } else {
                container.scrollBy({
                    left: 200,
                    behavior: 'smooth'
                });
            }
        }
    }, 4000);
}

function pauseSlider() {
    isSliderPaused = true;
    if (sliderAutoScrollInterval) {
        clearInterval(sliderAutoScrollInterval);
    }
}

function restartAutoSlider() {
    if (sliderAutoScrollInterval) {
        clearInterval(sliderAutoScrollInterval);
    }
    
    setTimeout(() => {
        isSliderPaused = false;
        startAutoSlider();
    }, 5000);
}

async function refreshSliderContent() {
    try {
        const newContent = await fetchTMDBContent("/trending/all/day", 2);
        
        if (newContent.length > 0) {
            newContent.forEach(item => {
                if (!contentManager.seenIds.has(item.id)) {
                    allContent.push(item);
                    contentManager.seenIds.add(item.id);
                }
            });
            
            if (newContent.length >= 5) {
                console.log("تحديث محتوى السلايدر...");
                updateTrendingSlider();
            }
        }
    } catch (error) {
        console.warn("خطأ في تحديث محتوى السلايدر:", error);
    }
}

setInterval(refreshSliderContent, 5 * 60 * 1000);

// ===== نظام الفلاتر مع منع التكرار =====
function setupFilters() {
    document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            e.stopPropagation();
            const dropdown = btn.nextElementSibling;
            const isActive = dropdown.classList.contains('active');
            
            document.querySelectorAll('.filter-dropdown').forEach(d => d.classList.remove('active'));
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
            
            if (!isActive) {
                dropdown.classList.add('active');
                btn.classList.add('active');
            }
        });
    });
    
    document.querySelectorAll('.filter-dropdown button').forEach(item => {
        item.addEventListener('click', (e) => {
            e.stopPropagation();
            const dropdown = item.closest('.filter-dropdown');
            const filterType = dropdown.previousElementSibling.dataset.filter;
            const value = item.dataset.value || "";
            
            dropdown.querySelectorAll('button').forEach(b => b.classList.remove('active'));
            item.classList.add('active');
            
            updateActiveFilter(filterType, value, item.textContent);
            
            dropdown.classList.remove('active');
            dropdown.previousElementSibling.classList.remove('active');
        });
    });
    
    document.addEventListener('click', () => {
        document.querySelectorAll('.filter-dropdown').forEach(d => d.classList.remove('active'));
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    });
}

function updateActiveFilter(type, value, displayText) {
    if (value === "") {
        delete activeFilters[type];
    } else {
        activeFilters[type] = { value, displayText };
    }
    updateActiveFiltersDisplay();
    applyFilters();
}

function applyFilters() {
    contentManager.resetForNewContext('filters');
    
    if (allContent.length === 0) return;
    
    currentPage = 1;
    displayedCount = 0;
    hasMoreContent = true;
    
    mainContent.innerHTML = '';
    
    if (Object.keys(activeFilters).length === 0) {
        updateDisplayedContent();
        updateTrendingSlider();
        showTrendingSection();
        return;
    }
    
    fetchFilteredContent();
}
function verifySliderContent() {
    const sliderCards = trendingContainer?.querySelectorAll('.trending-card');
    if (!sliderCards) return;
    
    const seenIds = new Set();
    let duplicatesFound = 0;
    
    sliderCards.forEach(card => {
        const id = parseInt(card.dataset.id);
        if (id) {
            if (seenIds.has(id)) {
                console.error(`❌ تحقق: اكتشاف تكرار في السلايدر: ${id}`);
                duplicatesFound++;
            } else {
                seenIds.add(id);
            }
        }
    });
    
    if (duplicatesFound > 0) {
        console.warn(`⚠️ تم اكتشاف ${duplicatesFound} تكرار في السلايدر`);
        console.log('🔄 إعادة توليد السلايدر...');
        updateTrendingSlider();
        return false;
    }
    
    console.log('✅ تحقق السلايدر: لا يوجد تكرار');
    return true;
}
async function fetchFilteredContent() {
    isLoading = true;
    showLoadingMessage();
    
    try {
        currentPage = 1;
        
        const queryParams = buildFilterQueryParams();
        queryParams.page = currentPage;
        
        let endpoint = "/discover/movie";
        let isTVContent = false;
        
        if (hasTVFilters()) {
            endpoint = "/discover/tv";
            isTVContent = true;
        }
        
        const response = await fetch(
            `${TMDB_BASE_URL}${endpoint}?api_key=${TMDB_API_KEY}&${new URLSearchParams(queryParams)}`
        );
        
        if (response.ok) {
            const data = await response.json();
            
            if (data.results && data.results.length > 0) {
                const newItems = await processNewItems(data.results, isTVContent);
                
                if (newItems.length > 0) {
                    // استبعاد العناصر الموجودة في السلايدر
                    const filteredItems = newItems.filter(item => 
                        contentManager.canDisplayInMain(item.id)
                    );
                    
                    if (filteredItems.length > 0) {
                        displayedContent = filteredItems;
                        displayedCount = 0;
                        
                        filteredItems.forEach(item => contentManager.seenIds.add(item.id));
                        
                        displayFilteredContent(filteredItems);
                        hideTrendingSection();
                        
                        console.log(`تم جلب ${filteredItems.length} عنصر حسب الفلاتر`);
                    } else {
                        showNoResultsMessage();
                    }
                } else {
                    showNoResultsMessage();
                }
            } else {
                showNoResultsMessage();
            }
        }
        
    } catch (error) {
        console.error("خطأ في جلب المحتوى المفلتر:", error);
        showErrorMessage();
    } finally {
        isLoading = false;
    }
}

function displayFilteredContent(items) {
    mainContent.innerHTML = '';
    contentManager.displayedIds.clear();
    
    if (items.length === 0) {
        showNoResultsMessage();
        return;
    }
    
    const itemsToShow = items.filter(item => 
        contentManager.canDisplayInMain(item.id)
    ).slice(0, itemsPerLoad);
    
    displayedCount = itemsToShow.length;
    
    itemsToShow.forEach(item => {
        const card = createCardElement(item);
        mainContent.appendChild(card);
        contentManager.addToMain(item.id);
    });
}

function buildFilterQueryParams() {
    const params = {
        sort_by: 'popularity.desc',
        language: 'en-US',
        page: currentPage
    };
    
    if (activeFilters.genre && activeFilters.genre.value) {
        params.with_genres = activeFilters.genre.value;
    }
    
    if (activeFilters.year && activeFilters.year.value) {
        if (activeFilters.year.value === 'older') {
            if (hasTVFilters()) {
                params.first_air_date = { lte: '2019-12-31' };
            } else {
                params.primary_release_date = { lte: '2019-12-31' };
            }
        } else {
            if (hasTVFilters()) {
                params.first_air_date_year = activeFilters.year.value;
            } else {
                params.primary_release_year = activeFilters.year.value;
            }
        }
    }
    
    if (activeFilters.category && activeFilters.category.value) {
        switch(activeFilters.category.value) {
            case 'foreign':
                params.with_original_language = 'en';
                break;
            case 'asian':
                params.with_original_language = 'ko|ja|zh|th|vi';
                break;
            case 'kdrama':
                params.with_original_language = 'ko';
                params.with_type = '2';
                break;
            case 'turkish':
                params.with_original_language = 'tr';
                break;
            case 'arabic':
                params.with_original_language = 'ar';
                break;
            case 'indian':
                params.with_original_language = 'hi';
                break;
            case 'anime':
                params.with_genres = 16;
                params.with_original_language = 'ja';
                break;
            case 'ramadan':
                params.with_original_language = 'ar';
                params.with_type = '2';
                break;
        }
    }
    
    if (activeFilters.rating && activeFilters.rating.value) {
        if (activeFilters.rating.value === 'family') {
            params.certification_country = 'US';
            params.certification = 'G';
        } else if (activeFilters.rating.value === '16') {
            params.certification_country = 'US';
            params.certification = 'PG-13';
        } else if (activeFilters.rating.value === '18') {
            params.certification_country = 'US';
            params.certification = 'R';
        }
    }
    
    return params;
}

function hasTVFilters() {
    if (activeFilters.category) {
        return ['kdrama', 'anime', 'ramadan'].includes(activeFilters.category.value);
    }
    return false;
}

// ===== البحث الذكي مع منع التكرار =====
function setupSearch() {
    if (!searchInput) return;
    
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimer);
        
        const query = searchInput.value.trim();
        
        if (query.length >= 2) {
            showSearchSuggestions(query);
        } else {
            suggestionsContainer.style.display = 'none';
        }
        
        searchTimer = setTimeout(async () => {
            if (query.length === 0) {
                searchResultsSection.classList.remove('active');
                mainContent.style.display = 'grid';
                showTrendingSection();
                return;
            }
            
            await performSearch(query);
        }, 300);
    });
    
    searchInput.addEventListener('keypress', (e) => {
        if (e.key === 'Enter') {
            const query = searchInput.value.trim();
            if (query.length > 0) {
                performSearch(query);
                suggestionsContainer.style.display = 'none';
            }
        }
    });
    
    document.addEventListener('click', (e) => {
        if (!searchInput.contains(e.target) && !suggestionsContainer.contains(e.target)) {
            suggestionsContainer.style.display = 'none';
        }
    });
}

function showSearchSuggestions(query) {
    if (!suggestionsContainer || allContent.length === 0) return;
    
    const searchTerm = query.toLowerCase();
    const normalizedSearch = normalizeArabicText(query);
    
    const suggestions = allContent.filter(item => {
        const title = (item.smartTitle || item.title || item.name || "").toLowerCase();
        const originalTitle = (item.original_title || item.title || item.name || "").toLowerCase();
        
        if (title.includes(searchTerm) || 
            originalTitle.includes(searchTerm)) {
            return true;
        }
        
        if (searchSmartTitles(item, searchTerm)) {
            return true;
        }
        
        const normalizedTitle = normalizeArabicText(item.smartTitle || "");
        if (normalizedTitle.includes(normalizedSearch)) {
            return true;
        }
        
        return searchWithTransliteration(item, query);
    }).slice(0, 8);
    
    suggestionsContainer.innerHTML = '';
    
    if (suggestions.length === 0) {
        suggestionsContainer.innerHTML = `
            <div class="no-results">
                🔍 اكتب للبحث...
            </div>
        `;
    } else {
        suggestions.forEach(item => {
            const suggestion = document.createElement('div');
            suggestion.className = 'suggestion-item';
            
            const title = item.smartTitle || item.title || item.name || "غير معروف";
            const poster = getBestPoster(item);
            
            let typeText = item.type === "movie" ? "فيلم" : "مسلسل";
            if (item.type === "anime") typeText = "أنمي";
            
            suggestion.innerHTML = `
                <img src="${poster}" alt="${title}" 
                     onerror="this.onerror=null; this.src='https://image.tmdb.org/t/p/w500/wwemzKWzjKYJFfCeiB57q3r4Bcm.png'">
                <div class="suggestion-info">
                    <div class="suggestion-title">${title}</div>
                    <div class="suggestion-type">${typeText}</div>
                </div>
            `;
            
            suggestion.onclick = () => {
                const type = item.type || (item.title ? "movie" : "tv");
                window.open(`details.html?type=${type}&id=${item.id}`, '_blank');
            };
            
            suggestionsContainer.appendChild(suggestion);
        });
    }
    
    suggestionsContainer.style.display = 'block';
}

async function performSearch(query) {
    try {
        contentManager.resetForNewContext('search');
        searchQueryText.textContent = query;
        searchResultsSection.classList.add('active');
        mainContent.style.display = 'none';
        hideTrendingSection();
        
        searchResultsContainer.innerHTML = `
            <div class="search-no-results">
                <div class="icon">🔍</div>
                <p>جاري البحث عن "${query}"...</p>
            </div>
        `;
        
        let results = allContent.filter(item => {
            const searchTerm = query.toLowerCase();
            const normalizedSearch = normalizeArabicText(query);
            
            const title = (item.smartTitle || item.title || item.name || "").toLowerCase();
            const originalTitle = (item.original_title || item.title || item.name || "").toLowerCase();
            
            if (title.includes(searchTerm) ||
                originalTitle.includes(searchTerm)) {
                return true;
            }
            
            if (searchSmartTitles(item, searchTerm)) {
                return true;
            }
            
            const normalizedTitle = normalizeArabicText(item.smartTitle || "");
            if (normalizedTitle.includes(normalizedSearch)) {
                return true;
            }
            
            return searchWithTransliteration(item, query);
        });
        
        if (results.length === 0) {
            try {
                let englishQueries = [query];
                
                if (/[\u0600-\u06FF]/.test(query)) {
                    const normalizedQuery = normalizeArabicText(query);
                    englishQueries = generateTransliterations(normalizedQuery).slice(0, 3);
                    
                    for (const [english, arabic] of Object.entries(TITLE_TRANSLATIONS)) {
                        if (normalizeArabicText(arabic).includes(normalizedQuery)) {
                            englishQueries.push(english);
                        }
                    }
                }
                
                const searchPromises = englishQueries.map(async (searchQuery) => {
                    try {
                        const response = await fetch(
                            `${TMDB_BASE_URL}/search/multi?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(searchQuery)}&language=en-US&page=1`
                        );
                        
                        if (response.ok) {
                            const data = await response.json();
                            return data.results || [];
                        }
                        return [];
                    } catch (error) {
                        console.error("خطأ في البحث API:", error);
                        return [];
                    }
                });
                
                const allResults = await Promise.all(searchPromises);
                const uniqueResults = new Map();
                
                allResults.flat().forEach(item => {
                    if (item.poster_path && !uniqueResults.has(item.id)) {
                        uniqueResults.set(item.id, item);
                    }
                });
                
                results = await Promise.all(
                    Array.from(uniqueResults.values())
                        .slice(0, 20)
                        .map(async item => {
                            item.smartTitle = await getSmartTitle(item);
                            item.type = item.media_type || (item.title ? "movie" : "tv");
                            if (item.genre_ids && item.genre_ids.includes(16)) {
                                item.type = "anime";
                            }
                            return item;
                        })
                );
            } catch (error) {
                console.error("خطأ في البحث API:", error);
            }
        }
        
        // استبعاد نتائج البحث الموجودة في السلايدر
        const filteredResults = results.filter(item => 
            contentManager.canDisplayInMain(item.id) || !contentManager.sliderIds.has(item.id)
        );
        
        // إضافة المحتوى الجديد إلى allContent
        filteredResults.forEach(item => {
            if (!contentManager.seenIds.has(item.id)) {
                contentManager.seenIds.add(item.id);
                allContent.push(item);
            }
        });
        
        searchResultsCount.textContent = `${filteredResults.length} نتيجة`;
        displaySearchResults(filteredResults);
        
    } catch (error) {
        console.error("خطأ في البحث:", error);
        searchResultsContainer.innerHTML = `
            <div class="search-no-results">
                <div class="icon">⚠️</div>
                <p>حدث خطأ أثناء البحث</p>
            </div>
        `;
    }
}

function displaySearchResults(results) {
    searchResultsContainer.innerHTML = '';
    
    if (results.length === 0) {
        searchResultsContainer.innerHTML = `
            <div class="search-no-results">
                <div class="icon">🔍</div>
                <p>لا توجد نتائج للبحث</p>
                <p class="suggestions">جرب كلمات بحث أخرى</p>
            </div>
        `;
        return;
    }
    
    // استبعاد العناصر الموجودة في السلايدر
    const filteredResults = results.filter(item => 
        !contentManager.sliderIds.has(item.id)
    );
    
    filteredResults.forEach(item => {
        const card = document.createElement("div");
        card.className = "card";
        card.dataset.id = item.id;
        
        const title = item.smartTitle || item.title || item.name || "غير معروف";
        const poster = getBestPoster(item);
        
        const type = item.media_type || (item.title ? "movie" : "tv");
        
        card.innerHTML = `
            <div class="card-image">
                <img src="${poster}" alt="${title}" loading="lazy">
            </div>
            <div class="card-content">
                <h3>${title}</h3>
            </div>
        `;
        
        card.onclick = () => {
            window.open(`details.html?type=${type}&id=${item.id}`, '_blank');
        };
        
        searchResultsContainer.appendChild(card);
    });
    
    // إشعار إذا تم استبعاد نتائج
    if (filteredResults.length < results.length) {
        const excludedCount = results.length - filteredResults.length;
        const note = document.createElement("div");
        note.className = "search-note";
        note.style.cssText = `
            text-align: center;
            padding: 15px;
            color: #666;
            font-size: 14px;
            background: #f8f8f8;
            border-radius: 8px;
            margin-top: 20px;
            border: 1px solid #eee;
        `;
        note.innerHTML = `<p>تم استبعاد ${excludedCount} نتيجة معروضة بالفعل في السلايدر الرئيسي</p>`;
        searchResultsContainer.appendChild(note);
    }
}

// ===== دوال مساعدة =====
function updateActiveFiltersDisplay() {
    if (!activeFiltersContainer) return;
    
    activeFiltersContainer.innerHTML = '';
    const activeCount = Object.keys(activeFilters).length;
    
    if (activeCount === 0) {
        activeFiltersContainer.style.display = 'none';
        if (resetFiltersBtn) resetFiltersBtn.style.display = 'none';
        return;
    }
    
    activeFiltersContainer.style.display = 'flex';
    if (resetFiltersBtn) resetFiltersBtn.style.display = 'block';
    
    const clearBtn = document.createElement('button');
    clearBtn.className = 'clear-all';
    clearBtn.textContent = '🗑️ مسح الكل';
    clearBtn.onclick = clearAllFilters;
    activeFiltersContainer.appendChild(clearBtn);
    
    for (const [type, filter] of Object.entries(activeFilters)) {
        if (!filter || !filter.value) continue;
        
        const tag = document.createElement('div');
        tag.className = 'filter-tag';
        
        const icons = { category: '📁', genre: '🎭', year: '📅', rating: '👨‍👩‍👧‍👦' };
        const icon = icons[type] || '🏷️';
        
        tag.innerHTML = `<span>${icon} ${filter.displayText}</span><span class="remove" data-type="${type}">×</span>`;
        tag.querySelector('.remove').onclick = (e) => {
            e.stopPropagation();
            removeFilter(type);
        };
        
        activeFiltersContainer.appendChild(tag);
    }
}

function removeFilter(type) {
    delete activeFilters[type];
    
    const filterBtn = document.querySelector(`.filter-btn[data-filter="${type}"]`);
    const dropdown = filterBtn.nextElementSibling;
    dropdown.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
    dropdown.querySelector('button[data-value=""]').classList.add('active');
    
    applyFilters();
    updateActiveFiltersDisplay();
}

function clearAllFilters() {
    document.querySelectorAll('.filter-dropdown').forEach(dropdown => {
        dropdown.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
        dropdown.querySelector('button[data-value=""]').classList.add('active');
    });
    
    activeFilters = {};
    contentManager.displayedIds.clear();
    updateDisplayedContent();
    updateTrendingSlider();
    showTrendingSection();
    updateActiveFiltersDisplay();
}

function showNoResultsMessage() {
    mainContent.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:60px;color:#888">
            <div style="font-size:3rem;margin-bottom:20px">🔍</div>
            <h3>لا توجد نتائج تطابق الفلاتر المختارة</h3>
            <p style="margin-top:15px;color:#666">جرب تغيير خيارات الفلترة</p>
            <button onclick="clearAllFilters()" style="
                background: var(--accent);
                color: white;
                border: none;
                padding: 12px 30px;
                border-radius: 30px;
                margin-top: 20px;
                cursor: pointer;
                font-family: inherit;
            ">مسح كل الفلاتر</button>
        </div>
    `;
}

function showLoadingMessage() {
    mainContent.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:60px;color:#ff3b3b">
            <div style="font-size:3rem;margin-bottom:20px">⏳</div>
            <h3>جاري تحميل المحتوى...</h3>
            <p style="margin-top:15px;color:#666">يرجى الانتظار قليلاً</p>
        </div>
    `;
}

function showErrorMessage() {
    mainContent.innerHTML = `
        <div style="grid-column:1/-1;text-align:center;padding:60px;color:#ff3b3b">
            <div style="font-size:3rem;margin-bottom:20px">⚠️</div>
            <h3>حدث خطأ في تحميل المحتوى</h3>
            <button onclick="location.reload()" style="
                background: var(--accent);
                color: white;
                border: none;
                padding: 12px 30px;
                border-radius: 30px;
                margin-top: 20px;
                cursor: pointer;
                font-family: inherit;
            ">تحديث الصفحة</button>
        </div>
    `;
}

function setupSidebar() {
    menuBtn.onclick = (e) => {
        e.stopPropagation();
        sidebar.classList.add("show");
        overlay.classList.add("show");
    };
    
    closeSidebar.onclick = (e) => {
        e.stopPropagation();
        sidebar.classList.remove("show");
        overlay.classList.remove("show");
    };
    
    overlay.onclick = (e) => {
        if (e.target === overlay) {
            sidebar.classList.remove("show");
            overlay.classList.remove("show");
        }
    };
    
    document.querySelectorAll('.sidebar-link').forEach(link => {
        link.addEventListener('click', () => {
            sidebar.classList.remove("show");
            overlay.classList.remove("show");
        });
    });
}

function setupBackToTop() {
    if (!backToTopBtn) return;
    
    window.addEventListener("scroll", () => {
        backToTopBtn.style.display = window.scrollY > 300 ? "flex" : "none";
    });
    
    backToTopBtn.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    });
}

// ===== نظام المراقبة النهائي لمنع التكرار =====
function setupDuplicateMonitor() {
    if (!mainContent || !trendingContainer) {
        console.warn('⚠️ عناصر DOM غير جاهزة للمراقبة');
        setTimeout(setupDuplicateMonitor, 500);
        return;
    }
    
    // مراقبة إضافة العناصر للمحتوى الرئيسي
    const originalMainAppend = mainContent.appendChild;
    mainContent.appendChild = function(element) {
        if (element.classList && element.classList.contains('card')) {
            const cardId = parseInt(element.dataset.id);
            
            // منع إذا كان في السلايدر
            if (cardId && contentManager.sliderIds.has(cardId)) {
                console.log('⛔ نظام المراقبة: منع تكرار - العنصر موجود في السلايدر:', cardId);
                element.style.display = 'none';
                return element;
            }
            
            // منع إذا كان معروضاً بالفعل
            if (cardId && contentManager.displayedIds.has(cardId)) {
                console.log('⛔ نظام المراقبة: منع تكرار - العنصر معروض بالفعل:', cardId);
                element.style.display = 'none';
                return element;
            }
            
            // إضافة للذاكرة
            if (cardId) contentManager.displayedIds.add(cardId);
        }
        return originalMainAppend.call(this, element);
    };
    
    // مراقبة إضافة العناصر للسلايدر
    const originalSliderAppend = trendingContainer.appendChild;
    trendingContainer.appendChild = function(element) {
        if (element.classList && element.classList.contains('trending-card')) {
            const cardId = parseInt(element.dataset.id);
            
            // إضافة للذاكرة وإزالة من الرئيسي إذا كان موجوداً
            if (cardId) {
                contentManager.sliderIds.add(cardId);
                contentManager.removeFromMainIfExists(cardId);
                
                // إزالة فعلياً من DOM إذا كان في الرئيسي
                removeCardFromMainById(cardId);
            }
        }
        return originalSliderAppend.call(this, element);
    };
    
    console.log('✅ نظام مراقبة التكرار مفعل بنجاح');
}

function removeCardFromMainById(cardId) {
    const mainCards = mainContent.querySelectorAll('.card');
    mainCards.forEach(card => {
        if (parseInt(card.dataset.id) === cardId) {
            card.style.transition = 'all 0.5s';
            card.style.opacity = '0';
            card.style.transform = 'translateY(-20px)';
            
            setTimeout(() => {
                card.remove();
                console.log('🔄 نظام المراقبة: إزالة العنصر من الرئيسي لصالح السلايدر:', cardId);
            }, 500);
            return true;
        }
    });
    return false;
}

function checkAndRemoveDuplicates() {
    const sliderCards = trendingContainer.querySelectorAll('.trending-card');
    const mainCards = mainContent.querySelectorAll('.card');
    
    if (!sliderCards.length || !mainCards.length) return;
    
    const sliderIds = new Set();
    sliderCards.forEach(card => {
        const id = parseInt(card.dataset.id);
        if (id) sliderIds.add(id);
    });
    
    let removedCount = 0;
    mainCards.forEach(card => {
        const id = parseInt(card.dataset.id);
        if (id && sliderIds.has(id)) {
            card.style.transition = 'all 0.5s';
            card.style.opacity = '0';
            card.style.transform = 'scale(0.8)';
            
            setTimeout(() => {
                card.remove();
                contentManager.displayedIds.delete(id);
                console.log('✅ إزالة عنصر مكرر:', id);
            }, 500);
            
            removedCount++;
        }
    });
    
    if (removedCount > 0) {
        console.log(`تمت إزالة ${removedCount} عنصر مكرر من الرئيسي`);
    }
}

// ===== إضافة واجهة مراقبة للتصحيح =====
function addDebugInterface() {
    // زر حالة النظام
    const debugBtn = document.createElement('button');
    debugBtn.id = 'debug-btn';
    debugBtn.innerHTML = '🔧 حالة النظام';
    debugBtn.style.cssText = `
        position: fixed;
        bottom: 20px;
        right: 20px;
        background: #ff3b3b;
        color: white;
        border: none;
        padding: 10px 15px;
        border-radius: 20px;
        cursor: pointer;
        z-index: 9999;
        font-size: 12px;
        opacity: 0.8;
        transition: opacity 0.3s;
        font-family: inherit;
    `;
    
    debugBtn.onmouseenter = () => debugBtn.style.opacity = '1';
    debugBtn.onmouseleave = () => debugBtn.style.opacity = '0.8';
    
    debugBtn.onclick = () => {
        console.log('====== 📊 حالة النظام ======');
        console.log('السلايدر IDs:', [...contentManager.sliderIds]);
        console.log('الرئيسي IDs:', [...contentManager.displayedIds]);
        console.log('الإجمالي IDs:', [...contentManager.seenIds]);
        
        // عرض تقرير
        const report = `📊 تقرير النظام:
🎬 السلايدر: ${contentManager.sliderIds.size} عنصر
📺 الرئيسي: ${contentManager.displayedIds.size} عنصر
📊 الإجمالي: ${contentManager.seenIds.size} عنصر
✅ النظام: ${contentManager.sliderIds.size + contentManager.displayedIds.size === contentManager.seenIds.size ? 'سليم' : 'يحتاج فحص'}`;
        
        alert(report);
    };
    
    document.body.appendChild(debugBtn);
    
    // عداد حي
    const counter = document.createElement('div');
    counter.id = 'duplicate-counter';
    counter.style.cssText = `
        position: fixed;
        bottom: 60px;
        right: 20px;
        background: #333;
        color: #0f0;
        padding: 5px 10px;
        border-radius: 10px;
        font-size: 11px;
        font-family: monospace;
        z-index: 9998;
        border: 1px solid #444;
    `;
    document.body.appendChild(counter);
    
    updateDebugCounter();
}

function updateDebugCounter() {
    const counter = document.getElementById('duplicate-counter');
    if (counter) {
        const sliderCount = contentManager.sliderIds.size;
        const mainCount = contentManager.displayedIds.size;
        const isClean = sliderCount + mainCount === contentManager.seenIds.size;
        
        counter.textContent = `🎬${sliderCount} | 📺${mainCount} | ${isClean ? '✅' : '⚠️'}`;
        counter.title = `السلايدر: ${sliderCount} | الرئيسي: ${mainCount} | ${isClean ? 'نظام سليم' : 'يوجد تكرار'}`;
        
        counter.style.color = isClean ? '#0f0' : '#ff0';
        counter.style.background = isClean ? '#333' : '#442222';
    }
}

// ===== تهيئة التطبيق النهائية =====
async function initApp() {
    console.log("🚀 تطبيق TAFLIM يعمل...");
    console.log("✅ نظام منع التكرار مفعل - الأولوية للسلايدر");
    
    // إعدادات الواجهة
    setupSidebar();
    setupFilters();
    setupSearch();
    setupBackToTop();
    
    if (resetFiltersBtn) {
        resetFiltersBtn.onclick = clearAllFilters;
    }
    
    // تحميل المحتوى الأولي
    await loadInitialContent();
    
    // ===== نظام المراقبة النهائي =====
    setupDuplicateMonitor();
    
    // مراقبة دورية كل 2 ثانية
    setInterval(() => {
        verifySliderContent();
        checkAndRemoveDuplicates();
    }, 3000)
    
    // تحديث العداد كل ثانية
    setInterval(updateDebugCounter, 1000);
    
    // إضافة واجهة التصحيح
  //  addDebugInterface();
    
    // تسجيل حالة النظام
  //  console.log('✅ نظام إدارة المحتوى جاهز');
  //  console.log(`🔢 السلايدر: ${contentManager.sliderIds.size} عنصر`);
  //  console.log(`🔢 الرئيسي: ${contentManager.displayedIds.size} عنصر`);
   // console.log(`🔢 الكلي: ${contentManager.seenIds.size} عنصر`);
        // التحقق النهائي
        verifySliderContent();
    // بدء التحديث التلقائي للسلايدر
    setInterval(refreshSliderContent, 5 * 60 * 1000);
}

// ===== بدء التطبيق =====
document.addEventListener('DOMContentLoaded', initApp);