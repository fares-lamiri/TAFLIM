// js/series.js - صفحة المسلسلات (محدث باستخدام api.js)

// ===== عناصر DOM =====
const mainContent = document.getElementById("main-content");
const searchInput = document.getElementById("search");
const suggestionsContainer = document.getElementById("search-suggestions");
const searchResultsSection = document.getElementById("search-results-section");
const searchQueryText = document.getElementById("search-query-text");
const searchResultsCount = document.getElementById("search-results-count");
const searchResultsContainer = document.getElementById("search-results-container");
const loadMoreBtn = document.querySelector(".load-more");
const backToTopBtn = document.getElementById("back-to-top");
const menuBtn = document.getElementById("menu-btn");
const sidebar = document.getElementById("sidebar");
const closeSidebar = document.getElementById("close-sidebar");
const overlay = document.getElementById("overlay");

// ===== متغيرات عامة =====
let originalSeries = [];
let filteredSeries = [];
let displayedCount = 0;
const itemsPerLoad = 20;
let searchTimer = null;
let activeSuggestionIndex = -1;
let currentPage = 1;
let isLoading = false;
let hasMoreSeries = true;
let useFallbackData = false;

// ===== دالة تحميل المسلسلات (باستخدام api.js) =====
async function loadSeries(page = 1) {
    if (isLoading) return;
    
    isLoading = true;
    
    try {
        if (page === 1) {
            mainContent.innerHTML = `
                <div style='grid-column:1/-1;text-align:center;padding:40px'>
                    <div style="color:#3b82f6;font-size:1.2rem;margin-bottom:15px;">
                        <div class="loading-spinner" style="
                            width: 40px;
                            height: 40px;
                            border: 4px solid #333;
                            border-top: 4px solid #3b82f6;
                            border-radius: 50%;
                            animation: spin 1s linear infinite;
                            margin: 0 auto 15px;
                        "></div>
                        جاري تحميل المسلسلات...
                    </div>
                </div>
            `;
            displayedCount = 0;
        }
        
        // اختبار API أولاً (باستخدام api.js)
        if (page === 1 && !useFallbackData) {
            const apiWorking = await window.TAFLIM_API.testAPI();
            if (!apiWorking) {
                useFallbackData = true;
            }
        }
        
        let series = [];
        
        if (useFallbackData) {
            // استخدام البيانات التجريبية من api.js
            console.log("📁 استخدام البيانات التجريبية للمسلسلات");
            series = [...window.TAFLIM_API.getFallbackSeries()];
            
            if (page > 1) {
                const additionalSeries = series.map((item, index) => ({
                    ...item,
                    id: item.id + (page * 100),
                    name: item.original_language !== 'en' ? item.arabic_title : item.name,
                    vote_average: Math.min(9.0, item.vote_average + (Math.random() * 0.5))
                }));
                series = [...series, ...additionalSeries.slice(0, 10)];
            }
            
            await new Promise(resolve => setTimeout(resolve, 800));
            
        } else {
            // استخدام API الحقيقي من api.js
            console.log("🌐 جاري جلب المسلسلات من API...");
            
            try {
                if (page === 1) {
                    // الصفحة الأولى: استخدام fetchTVShows
                    series = await window.TAFLIM_API.fetchTVShows([page]);
                    hasMoreSeries = true; // نعتقد أن هناك المزيد
                } else {
                    // الصفحات التالية: استخدام fetchMoreTVShows
                    const response = await window.TAFLIM_API.fetchMoreTVShows(page);
                    series = response.results || [];
                    hasMoreSeries = page < (response.total_pages || 1);
                }
                
                if (!series || series.length === 0) {
                    throw new Error("لا توجد نتائج من API");
                }
                
                console.log(`✅ تم جلب ${series.length} مسلسل من الصفحة ${page}`);
                
            } catch (apiError) {
                console.warn("⚠️ خطأ في جلب البيانات من API:", apiError);
                useFallbackData = true;
                return loadSeries(page);
            }
        }
        
        if (page === 1) {
            originalSeries = series;
            filteredSeries = [...originalSeries];
            mainContent.innerHTML = "";
        } else {
            originalSeries = [...originalSeries, ...series];
            filteredSeries = [...originalSeries];
        }
        
        loadMoreLocalSeries();
        
        // تحديث زر جلب المزيد
        if (loadMoreBtn) {
            if (useFallbackData) {
                loadMoreBtn.style.display = "block";
                loadMoreBtn.textContent = "🔄 جلب المزيد من المسلسلات";
            } else {
                loadMoreBtn.style.display = hasMoreSeries ? "block" : "none";
                loadMoreBtn.textContent = hasMoreSeries ? "🔄 جلب المزيد من المسلسلات" : "📺 انتهت جميع المسلسلات";
            }
        }
        
        if (page === 1) {
            console.log(`✅ تم تحميل ${series.length} مسلسل`);
            console.log("🎯 المسلسلات الآسيوية والعربية تظهر بالعربية، الباقي بالإنكليزية");
        }
        
    } catch (error) {
        console.error("❌ خطأ في تحميل المسلسلات:", error);
        
        if (page === 1) {
            useFallbackData = true;
            
            mainContent.innerHTML = `
                <div style='grid-column:1/-1;text-align:center;color:#3b82f6;padding:50px'>
                    <div style="font-size:1.5rem;margin-bottom:15px;">⚠️</div>
                    <div style="margin-bottom:20px;">
                        فشل تحميل المسلسلات من الخادم
                        <br>
                        <small style="color:#888;">جاري استخدام البيانات التجريبية</small>
                    </div>
                    <button id='retry-btn' style='
                        background:#3b82f6;
                        color:white;
                        border:none;
                        padding:12px 25px;
                        border-radius:8px;
                        cursor:pointer;
                        margin-top:15px;
                        font-family: inherit;
                        font-size:1rem;
                        transition: all 0.3s;
                    '>
                        إعادة المحاولة
                    </button>
                </div>
            `;
            
            const retryBtn = document.getElementById('retry-btn');
            if (retryBtn) {
                retryBtn.addEventListener('click', () => {
                    useFallbackData = false;
                    currentPage = 1;
                    loadSeries(1);
                });
            }
            
            setTimeout(() => {
                if (useFallbackData) {
                    loadSeries(1);
                }
            }, 1500);
        }
        
    } finally {
        isLoading = false;
        currentPage = page;
    }
}

// ===== دالة إنشاء كروت المسلسلات =====
function createSeriesCard(series) {
    const card = document.createElement("div");
    card.className = "card";
    
    const displayTitle = series.name || series.title || "غير معروف";
    const year = (series.first_air_date || "").substring(0, 4) || "N/A";
    const rating = series.vote_average ? series.vote_average.toFixed(1) : "N/A";
    
    let ratingBadge = "";
    if (series.vote_average >= 8) ratingBadge = "⭐️⭐️⭐️⭐️";
    else if (series.vote_average >= 7) ratingBadge = "⭐️⭐️⭐️";
    else if (series.vote_average >= 6) ratingBadge = "⭐️⭐️";
    else if (series.vote_average > 0) ratingBadge = "⭐️";
    
    let languageBadge = "";
    let seriesType = "مسلسل";
    
    if (series.original_language === "ar") {
        languageBadge = "🇸🇦 عربي";
    } else if (series.original_language === "tr") {
        languageBadge = "🇹🇷 تركي";
        seriesType = "مسلسل تركي";
    } else if (series.original_language === "ko") {
        languageBadge = "🇰🇷 كوري";
        seriesType = "كوري";
    } else if (series.original_language === "ja") {
        languageBadge = "🇯🇵 ياباني";
        seriesType = "أنمي";
    } else if (series.original_language === "zh") {
        languageBadge = "🇨🇳 صيني";
        seriesType = "مسلسل صيني";
    } else if (series.original_language === "hi") {
        languageBadge = "🇮🇳 هندي";
        seriesType = "مسلسل هندي";
    } else if (series.category === "anime") {
        languageBadge = "🇯🇵 أنمي";
        seriesType = "أنمي";
    } else {
        languageBadge = "🇺🇸 أجنبي";
    }
    
    const posterUrl = series.poster_path 
        ? window.TAFLIM_API.getImageUrl(series.poster_path)
        : 'https://image.tmdb.org/t/p/w500/wwemzKWzjKYJFfCeiB57q3r4Bcm.png';
    
    card.innerHTML = `
        <img src="${posterUrl}" alt="${displayTitle}" loading="lazy"
             onerror="this.src='https://image.tmdb.org/t/p/w500/wwemzKWzjKYJFfCeiB57q3r4Bcm.png'">
        <h3>${displayTitle}</h3>
        <div style="padding: 0 12px 12px; display: flex; flex-direction: column; gap: 5px; font-size: 0.8rem;">
            <div style="display: flex; justify-content: space-between; color: #aaa;">
                <span>${year}</span>
                <span>${rating} ${ratingBadge}</span>
            </div>
            <div style="color: #666; text-align: center; font-size: 0.75rem;">
                ${languageBadge} • ${seriesType}
            </div>
        </div>
    `;
    
    card.onclick = () => {
        const lang = series.original_language === "ar" ? "ar" : "en-US";
        window.location.href = `details.html?type=tv&id=${series.id}&lang=${lang}`;
    };
    
    return card;
}

// ===== تحميل المزيد من المسلسلات (المحلية) =====
function loadMoreLocalSeries() {
    if (filteredSeries.length === 0) {
        if (loadMoreBtn) loadMoreBtn.style.display = "none";
        return;
    }
    
    const nextItems = filteredSeries.slice(displayedCount, displayedCount + itemsPerLoad);
    
    if (nextItems.length === 0 && displayedCount === 0) {
        mainContent.innerHTML = "<p style='grid-column:1/-1;text-align:center;color:#aaa;padding:60px'>لا توجد مسلسلات لعرضها</p>";
        if (loadMoreBtn) loadMoreBtn.style.display = "none";
        return;
    }
    
    nextItems.forEach(series => {
        mainContent.appendChild(createSeriesCard(series));
    });
    
    displayedCount += nextItems.length;
    
    if (loadMoreBtn) {
        if (displayedCount < filteredSeries.length) {
            loadMoreBtn.style.display = "block";
            loadMoreBtn.textContent = "🔄 جلب المزيد من المسلسلات";
        } else {
            loadMoreBtn.style.display = hasMoreSeries ? "block" : "none";
            loadMoreBtn.textContent = hasMoreSeries ? "🔄 تحميل المزيد من المسلسلات" : "📺 انتهت جميع المسلسلات";
        }
    }
}

// ===== دالة لجلب المزيد من المسلسلات من API =====
async function loadMoreFromAPI() {
    if (isLoading || !hasMoreSeries) return;
    
    if (loadMoreBtn) {
        loadMoreBtn.textContent = "⏳ جاري التحميل...";
        loadMoreBtn.disabled = true;
    }
    
    await loadSeries(currentPage + 1);
    
    if (loadMoreBtn) {
        loadMoreBtn.textContent = "🔄 جلب المزيد من المسلسلات";
        loadMoreBtn.disabled = false;
    }
}

// ===== البحث الشامل =====
function setupSearch() {
    if (!searchInput) return;
    
    searchInput.addEventListener('input', () => {
        clearTimeout(searchTimer);
        const query = searchInput.value.trim();
        
        showSearchSuggestions(query);
        
        searchTimer = setTimeout(async () => {
            if (!query) {
                filteredSeries = [...originalSeries];
                displayedCount = 0;
                mainContent.innerHTML = "";
                loadMoreLocalSeries();
                
                if (searchResultsSection) {
                    searchResultsSection.classList.remove('active');
                }
                return;
            }
            
            mainContent.innerHTML = `
                <div style='grid-column:1/-1;text-align:center;color:#3b82f6;padding:40px'>
                    <div class="loading-spinner" style="
                        width: 30px;
                        height: 30px;
                        border: 3px solid #333;
                        border-top: 3px solid #3b82f6;
                        border-radius: 50%;
                        animation: spin 1s linear infinite;
                        margin: 0 auto 15px;
                    "></div>
                    جاري البحث عن المسلسلات...
                </div>
            `;
            
            // البحث المحلي أولاً
            let results = originalSeries.filter(series => {
                const name = (series.name || "").toLowerCase();
                const originalName = (series.original_name || "").toLowerCase();
                const arabicTitle = (series.arabic_title || "").toLowerCase();
                const title = (series.title || "").toLowerCase();
                
                return name.includes(query.toLowerCase()) || 
                       originalName.includes(query.toLowerCase()) ||
                       arabicTitle.includes(query.toLowerCase()) ||
                       title.includes(query.toLowerCase());
            });
            
            // إذا لم توجد نتائج محلية، جرب البحث في API
            if (results.length === 0 && !useFallbackData) {
                try {
                    const searchData = await window.TAFLIM_API.searchContent(query, 1);
                    if (searchData.results) {
                        // تصفية النتائج لتبقي فقط المسلسلات (tv)
                        const tvResults = searchData.results.filter(item => 
                            (item.media_type === 'tv' || item.type === 'series') && 
                            item.poster_path
                        );
                        
                        // تحويل النتائج لنفس تنسيق المسلسلات المحلية
                        results = tvResults.map(item => ({
                            ...item,
                            name: item.name || item.title,
                            category: determineCategory(item),
                            type: "series"
                        }));
                    }
                } catch (searchError) {
                    console.warn("خطأ في البحث في API:", searchError);
                }
            }
            
            // عرض النتائج
            mainContent.innerHTML = "";
            
            if (results.length === 0) {
                if (searchResultsSection && searchQueryText && searchResultsCount) {
                    searchQueryText.textContent = query;
                    searchResultsCount.textContent = "0 نتيجة";
                    searchResultsContainer.innerHTML = `
                        <div class="search-no-results">
                            <div class="icon">🔍</div>
                            <p>لا توجد نتائج لـ "${query}"</p>
                        </div>
                    `;
                    searchResultsSection.classList.add('active');
                } else {
                    mainContent.innerHTML = `
                        <p style='grid-column:1/-1;text-align:center;color:#aaa;padding:60px'>
                            لا توجد نتائج لـ "${query}"
                        </p>
                    `;
                }
            } else {
                if (searchResultsSection && searchQueryText && searchResultsCount) {
                    searchQueryText.textContent = query;
                    searchResultsCount.textContent = `${results.length} نتيجة`;
                    
                    searchResultsContainer.innerHTML = '';
                    results.forEach(series => {
                        const card = createSeriesCard(series);
                        searchResultsContainer.appendChild(card);
                    });
                    
                    searchResultsSection.classList.add('active');
                } else {
                    results.forEach(series => {
                        mainContent.appendChild(createSeriesCard(series));
                    });
                }
            }
            
            filteredSeries = results.length > 0 ? results : originalSeries;
            displayedCount = results.length;
            
            if (loadMoreBtn) {
                loadMoreBtn.style.display = "block";
                loadMoreBtn.textContent = results.length === 0 
                    ? "🔄 العودة للقائمة الكاملة" 
                    : "🔄 جلب المزيد من النتائج";
            }
            
        }, 800);
    });
}

// دالة مساعدة لتحديد الفئة
function determineCategory(item) {
    const lang = item.original_language || "en";
    if (lang === "ar") return "arabic";
    if (lang === "hi") return "indian";
    if (lang === "tr") return "turkish";
    if (lang === "ko") return "korean";
    if (["ja", "zh", "th"].includes(lang)) return "asian";
    if (item.genre_ids?.includes(16)) return "anime";
    return "foreign";
}

// ===== عرض اقتراحات البحث =====
function showSearchSuggestions(query) {
    if (!suggestionsContainer) return;
    
    if (!query || query.trim().length < 2) {
        suggestionsContainer.style.display = 'none';
        activeSuggestionIndex = -1;
        return;
    }
    
    const searchTerm = query.toLowerCase().trim();
    
    const localResults = originalSeries.filter(series => {
        const name = (series.name || "").toLowerCase();
        const originalName = (series.original_name || "").toLowerCase();
        const arabicTitle = (series.arabic_title || "").toLowerCase();
        const title = (series.title || "").toLowerCase();
        
        return name.includes(searchTerm) || 
               originalName.includes(searchTerm) ||
               arabicTitle.includes(searchTerm) ||
               title.includes(searchTerm);
    }).slice(0, 8);
    
    suggestionsContainer.innerHTML = '';
    activeSuggestionIndex = -1;
    
    if (localResults.length > 0) {
        localResults.forEach((series, index) => {
            const div = document.createElement('div');
            div.className = 'suggestion-item';
            div.dataset.index = index;
            
            const year = (series.first_air_date || "").substring(0, 4) || "N/A";
            const rating = series.vote_average ? series.vote_average.toFixed(1) : "N/A";
            const displayTitle = series.name || series.title || "غير معروف";
            
            const posterUrl = series.poster_path 
                ? window.TAFLIM_API.getImageUrl(series.poster_path)
                : 'https://image.tmdb.org/t/p/w500/wwemzKWzjKYJFfCeiB57q3r4Bcm.png';
            
            let seriesType = "مسلسل";
            if (series.original_language === "ko") seriesType = "كوري";
            else if (series.original_language === "tr") seriesType = "تركي";
            else if (series.original_language === "ja") seriesType = "أنمي";
            else if (series.original_language === "zh") seriesType = "صيني";
            else if (series.original_language === "hi") seriesType = "هندي";
            else if (series.category === "anime") seriesType = "أنمي";
            
            div.innerHTML = `
                <img src="${posterUrl}" 
                     alt="${displayTitle}"
                     onerror="this.src='https://image.tmdb.org/t/p/w500/wwemzKWzjKYJFfCeiB57q3r4Bcm.png'">
                <div class="suggestion-info">
                    <div class="suggestion-title">${displayTitle}</div>
                    <div class="suggestion-details">
                        📺 ${seriesType} • ${year} • ⭐ ${rating}
                    </div>
                </div>
            `;
            
            div.onclick = () => {
                const lang = series.original_language === "ar" ? "ar" : "en-US";
                window.location.href = `details.html?type=tv&id=${series.id}&lang=${lang}`;
            };
            
            div.onmouseenter = () => {
                document.querySelectorAll('.suggestion-item').forEach(s => s.classList.remove('active'));
                div.classList.add('active');
                activeSuggestionIndex = index;
            };
            
            suggestionsContainer.appendChild(div);
        });
        
        suggestionsContainer.style.display = 'block';
    } else {
        suggestionsContainer.innerHTML = `
            <div class="no-results">
                <div>🔍 جاري البحث عن "${query}"...</div>
            </div>
        `;
        suggestionsContainer.style.display = 'block';
    }
}

// ===== نظام الفلاتر =====
function setupFilters() {
    document.querySelectorAll('.filter-dropdown button').forEach(item => {
        item.onclick = (e) => {
            const dropdown = item.closest('.filter-dropdown');
            if (dropdown) {
                dropdown.querySelectorAll('button').forEach(b => b.classList.remove('active'));
                item.classList.add('active');
                
                applyFilters();
                
                dropdown.classList.remove('active');
                const filterBtn = item.closest('.filter-group')?.querySelector('.filter-btn');
                if (filterBtn) filterBtn.classList.remove('active');
                e.stopPropagation();
            }
        };
    });
}

function applyFilters() {
    let filtered = [...originalSeries];
    
    document.querySelectorAll('.filter-dropdown').forEach(dropdown => {
        const activeBtn = dropdown.querySelector('button.active');
        if (!activeBtn) return;
        
        const value = activeBtn.dataset.value || "";
        const filterType = dropdown.closest('.filter-group')?.querySelector('.filter-btn')?.dataset.filter;
        
        if (!value || !filterType) return;
        
        switch(filterType) {
            case 'category':
                filtered = filtered.filter(series => {
                    if (value === 'foreign') return !["ar","hi","tr","ja","ko","zh","th"].includes(series.original_language);
                    if (value === 'arabic') return series.original_language === "ar";
                    if (value === 'indian') return series.original_language === "hi";
                    if (value === 'turkish') return series.original_language === "tr";
                    if (value === 'korean') return series.original_language === "ko";
                    if (value === 'asian') return ["ja","zh","th"].includes(series.original_language);
                    if (value === 'anime') return series.category === "anime" || series.original_language === "ja";
                    return true;
                });
                break;
                
            case 'genre':
                filtered = filtered.filter(series => series.genre_ids?.includes(Number(value)));
                break;
                
            case 'year':
                if (value === 'older') {
                    filtered = filtered.filter(series => {
                        const year = (series.first_air_date || "").split("-")[0];
                        return year && parseInt(year) < 2020;
                    });
                } else {
                    filtered = filtered.filter(series => (series.first_air_date || "").split("-")[0] === value);
                }
                break;
                
            case 'rating':
                filtered = filtered.filter(series => series.vote_average >= Number(value));
                break;
        }
    });
    
    filteredSeries = filtered;
    displayedCount = 0;
    mainContent.innerHTML = "";
    loadMoreLocalSeries();
    
    if (searchResultsSection) {
        searchResultsSection.classList.remove('active');
    }
}

// ===== إعدادات عامة =====
function setupBackToTop() {
    if (!backToTopBtn) return;
    
    window.addEventListener("scroll", () => {
        backToTopBtn.style.display = window.scrollY > 300 ? "flex" : "none";
    });
    
    backToTopBtn.addEventListener("click", () => {
        window.scrollTo({ top: 0, behavior: "smooth" });
    });
}

function setupSidebar() {
    if (!menuBtn || !sidebar || !overlay || !closeSidebar) return;
    
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
    
    document.querySelectorAll('#sidebar a').forEach(link => {
        link.addEventListener('click', () => {
            sidebar.classList.remove("show");
            overlay.classList.remove("show");
        });
    });
}

// ===== تهيئة التطبيق =====
function initApp() {
    console.log("📺 تطبيق المسلسلات يعمل (مع api.js)...");
    
    // إضافة أنيميشن للدوران
    if (!document.querySelector('style[data-spin-animation]')) {
        const style = document.createElement('style');
        style.setAttribute('data-spin-animation', 'true');
        style.textContent = `
            @keyframes spin {
                0% { transform: rotate(0deg); }
                100% { transform: rotate(360deg); }
            }
        `;
        document.head.appendChild(style);
    }
    
    // تحميل المسلسلات
    loadSeries(1);
    
    // إعداد المكونات الأخرى
    setTimeout(() => {
        setupSidebar();
        setupBackToTop();
        setupSearch();
        setupFilters();
    }, 100);
}

// ===== التعريفات العامة =====
window.loadMoreSeries = function() {
    if (displayedCount >= filteredSeries.length && hasMoreSeries && !useFallbackData) {
        loadMoreFromAPI();
    } else if (displayedCount >= filteredSeries.length && useFallbackData) {
        loadSeries(currentPage + 1);
    } else {
        loadMoreLocalSeries();
    }
};

// بدء التطبيق
document.addEventListener('DOMContentLoaded', initApp);