        // ========== الإعدادات العامة ==========
        const TMDB_API = {
            key: "dbb14198ea29a547de77343dc3fe7a37",
            baseURL: "https://api.themoviedb.org/3",
            imageBase: "https://image.tmdb.org/t/p/w500"
        };

        // ========== عناصر DOM ==========
        const mainContent = document.getElementById("main-content");
        const searchInput = document.getElementById("search");
        const suggestionsContainer = document.getElementById("search-suggestions");
        const searchResultsSection = document.getElementById("search-results-section");
        const searchQueryText = document.getElementById("search-query-text");
        const searchResultsCount = document.getElementById("search-results-count");
        const searchResultsContainer = document.getElementById("search-results-container");
        const backToTopBtn = document.getElementById("back-to-top");
        const menuBtn = document.getElementById("menu-btn");
        const sidebar = document.getElementById("sidebar");
        const closeSidebar = document.getElementById("close-sidebar");
        const overlay = document.getElementById("overlay");
        const activeFiltersContainer = document.getElementById("active-filters");
        const endOfContent = document.getElementById("end-of-content");

        // ========== متغيرات حالة التطبيق ==========
        let displayedMovies = [];
        let currentPage = 1;
        let filterPage = 1;
        let isLoading = false;
        let hasMoreMovies = true;
        let searchTimer = null;
        let activeSuggestionIndex = -1;
        let isGlobalSearch = false;
        let activeFilters = {};
        let seenMovieIds = new Set(); // لمنع التكرار

        // ========== قاموس البحث الذكي ==========
        const smartSearchDictionary = {
            // كوري
            "فينسنزو": "Vincenzo", "لعبة الحبار": "Squid Game", "هبوط اضطراري": "Crash Landing on You",
            "الغوبلين": "Goblin", "المجد": "The Glory", "أبناء الشمس": "Descendants of the Sun",
            "فئة إيتاون": "Itaewon Class", "اقتراح عمل": "Business Proposal",
            "موطن تشا تشا تشا": "Hometown Cha-Cha-Cha", "وراثي الحب": "Love in the Moonlight",
            "الوزير": "The Prime Minister and I",
            
            // هندي
            "آر آر آر": "RRR", "باهوبالي": "Baahubali", "3 أغبياء": "3 Idiots",
            "دانغال": "Dangal", "لاغان": "Lagaan", "بي كي": "PK",
            "قطار تشيناي": "Chennai Express", "هيبي نيو يير": "Happy New Year",
            "الملك": "The King", "الطباخ": "Chef",
            
            // تركي
            "التأسيس عثمان": "Kuruluş: Osman", "القيامة أرطغرل": "Diriliş: Ertuğrul",
            "القرن العظيم": "Muhteşem Yüzyıl", "حب أسود": "Kara Sevda",
            "الطائر المبكر": "Erkenci Kuş", "الأم": "Anne", "الظل": "Gölge",
            "المدعي": "Savcı", "العروس": "Gelin", "الجار": "Komşu",
            
            // أنمي
            "هجوم العمالقة": "Attack on Titan", "سيف النار": "Demon Slayer",
            "جوجوتسو كايسن": "Jujutsu Kaisen", "بطلي الأكاديمية": "My Hero Academia",
            "ون بيس": "One Piece", "ناروتو": "Naruto", "دراغون بول": "Dragon Ball",
            "منتخب طوكيو": "Tokyo Revengers", "أرض الوعد": "The Promised Neverland",
            "هانتر اكس هانتر": "Hunter x Hunter",
            
            // أفلام عالمية
            "الظلام يزول": "The Dark Knight", "تيتانيك": "Titanic",
            "إنشيبشن": "Inception", "أفنجرز": "Avengers", "العنكبوت": "Spider-Man",
            "الأسد الملك": "The Lion King", "كثيب": "Dune", "الجوكر": "Joker",
            "فورست غامب": "Forrest Gump", "بابادوك": "The Babadook"
        };

        // ========== دالة التحويل الذكي ==========
        function smartTranslateQuery(query) {
            if (!query || query.trim() === "") return query;
            
            const lowerQuery = query.toLowerCase().trim();
            
            for (const [arabic, english] of Object.entries(smartSearchDictionary)) {
                if (lowerQuery.includes(arabic.toLowerCase())) {
                    console.log(`🔤 تحويل "${arabic}" إلى "${english}"`);
                    return english;
                }
            }
            
            return query;
        }

        // ========== نظام اختيار اللغة والعنوان ==========
        function determineLanguageSettings(originalLanguage) {
            let apiLanguage = 'en-US';
            let titleStrategy = 'english';
            let imageLanguages = 'en,null';
            
            if (originalLanguage === 'ja') {
                apiLanguage = 'ja-JP';
                titleStrategy = 'original';
                imageLanguages = 'ja,null,en';
            } else if (['ar', 'tr', 'ko', 'hi'].includes(originalLanguage)) {
                apiLanguage = 'ar-SA';
                titleStrategy = 'arabic';
                imageLanguages = 'ar,null,en';
            } else {
                apiLanguage = 'en-US';
                titleStrategy = 'english';
                imageLanguages = 'en,null';
            }
            
            return { apiLanguage, titleStrategy, imageLanguages };
        }

        // ========== جلب صورة الغلاف الذكية ==========
        async function getSmartPoster(movieId, originalLanguage) {
            const { imageLanguages } = determineLanguageSettings(originalLanguage);
            const imageUrl = `${TMDB_API.baseURL}/movie/${movieId}/images?api_key=${TMDB_API.key}&include_image_language=${imageLanguages}`;
            
            try {
                const response = await fetch(imageUrl);
                if (!response.ok) throw new Error('فشل جلب الصور');
                
                const imageData = await response.json();
                
                if (imageData.posters && imageData.posters.length > 0) {
                    const posterPath = imageData.posters[0].file_path;
                    return `${TMDB_API.imageBase}${posterPath}`;
                }
            } catch (error) {
                console.error("❌ خطأ في جلب الصور:", error);
            }
            
            // صورة افتراضية
            return `${TMDB_API.imageBase}/wwemzKWzjKYJFfCeiB57q3r4Bcm.png`;
        }

        // ========== جلب بيانات فيلم مع العنوان الذكي ==========
        async function fetchSmartMovieData(movieId, originalLanguage) {
            const { apiLanguage, titleStrategy } = determineLanguageSettings(originalLanguage);
            
            const movieUrl = `${TMDB_API.baseURL}/movie/${movieId}?api_key=${TMDB_API.key}&language=${apiLanguage}`;
            
            try {
                const response = await fetch(movieUrl);
                if (!response.ok) throw new Error('فشل جلب بيانات الفيلم');
                
                const movieData = await response.json();
                let finalTitle = movieData.title || movieData.original_title;
                
                // إذا طلبت لغة ولم يوجد ترجمة، استخدم الإنجليزية
                if ((apiLanguage === 'ar-SA' || apiLanguage === 'ja-JP') && 
                    (!movieData.title || movieData.title === movieData.original_title)) {
                    const englishUrl = `${TMDB_API.baseURL}/movie/${movieId}?api_key=${TMDB_API.key}&language=en-US`;
                    const englishResponse = await fetch(englishUrl);
                    const englishData = await englishResponse.json();
                    finalTitle = englishData.title || movieData.original_title;
                }
                
                const posterUrl = await getSmartPoster(movieId, originalLanguage);
                
                return {
                    id: movieData.id,
                    title: finalTitle,
                    original_title: movieData.original_title,
                    poster_path: posterUrl,
                    backdrop_path: movieData.backdrop_path,
                    overview: movieData.overview,
                    release_date: movieData.release_date,
                    vote_average: movieData.vote_average,
                    vote_count: movieData.vote_count,
                    genre_ids: movieData.genre_ids || [],
                    original_language: movieData.original_language,
                    popularity: movieData.popularity,
                    type: "movie"
                };
                
            } catch (error) {
                console.error("❌ خطأ في جلب بيانات الفيلم الذكي:", error);
                return null;
            }
        }

        // ========== البحث الذكي العالمي ==========
        async function performSmartSearch(query, page = 1) {
            const translatedQuery = smartTranslateQuery(query);
            
            searchQueryText.textContent = query;
            searchResultsSection.classList.add('active');
            mainContent.style.display = 'none';
            endOfContent.classList.remove('show');
            
            searchResultsContainer.innerHTML = `
                <div class="search-no-results">
                    <div class="loading-spinner"></div>
                    <p>جاري البحث عن "${query}"...</p>
                </div>
            `;
            
            try {
                const searchUrl = `${TMDB_API.baseURL}/search/multi?api_key=${TMDB_API.key}&query=${encodeURIComponent(translatedQuery)}&language=ar-SA&page=${page}`;
                const response = await fetch(searchUrl);
                
                if (!response.ok) throw new Error('فشل البحث');
                
                const data = await response.json();
                
                if (!data.results || data.results.length === 0) {
                    searchResultsCount.textContent = "0 نتيجة";
                    searchResultsContainer.innerHTML = `
                        <div class="search-no-results">
                            <div>🔍</div>
                            <p>لا توجد نتائج للبحث "${query}"</p>
                            <p class="suggestions">جرب كلمات بحث أخرى أو تحقق من التهجئة</p>
                        </div>
                    `;
                    return [];
                }
                
                // تصفية النتائج لمنع التكرار
                const uniqueResults = [];
                const seenIds = new Set();
                
                for (const item of data.results) {
                    if (!item.poster_path) continue;
                    if (seenIds.has(item.id)) continue;
                    
                    seenIds.add(item.id);
                    uniqueResults.push(item);
                }
                
                searchResultsCount.textContent = `${uniqueResults.length} نتيجة`;
                
                // جلب البيانات الكاملة لكل فيلم
                const processedResults = await Promise.all(
                    uniqueResults.map(async (item) => {
                        const movieData = await fetchSmartMovieData(item.id, item.original_language || 'en');
                        return movieData;
                    })
                );
                
                const validResults = processedResults.filter(item => item !== null);
                
                if (validResults.length === 0) {
                    searchResultsContainer.innerHTML = `
                        <div class="search-no-results">
                            <div>⚠️</div>
                            <p>لا توجد نتائج صالحة للعرض</p>
                        </div>
                    `;
                    return [];
                }
                
                return validResults;
                
            } catch (error) {
                console.error("❌ خطأ في البحث الذكي:", error);
                searchResultsContainer.innerHTML = `
                    <div class="search-no-results">
                        <div>⚠️</div>
                        <p>حدث خطأ أثناء البحث</p>
                        <p class="suggestions">تأكد من اتصال الإنترنت وحاول مرة أخرى</p>
                    </div>
                `;
                return [];
            }
        }

        // ========== عرض اقتراحات البحث ==========
        async function showSearchSuggestions(query) {
            if (!query || query.trim().length < 2) {
                suggestionsContainer.style.display = 'none';
                activeSuggestionIndex = -1;
                return;
            }
            
            const translatedQuery = smartTranslateQuery(query);
            
            suggestionsContainer.innerHTML = `
                <div class="no-results">
                    <div>🔍 جاري البحث عن "${query}"...</div>
                </div>
            `;
            suggestionsContainer.style.display = 'block';
            
            try {
                const url = `${TMDB_API.baseURL}/search/movie?api_key=${TMDB_API.key}&query=${encodeURIComponent(translatedQuery)}&language=ar-SA&page=1`;
                const response = await fetch(url);
                
                if (!response.ok) return;
                
                const data = await response.json();
                const results = data.results ? data.results.slice(0, 8) : [];
                
                if (results.length === 0) {
                    suggestionsContainer.innerHTML = `
                        <div class="no-results">
                            <div>🔍 لا توجد اقتراحات لـ "${query}"</div>
                        </div>
                    `;
                    return;
                }
                
                suggestionsContainer.innerHTML = '';
                activeSuggestionIndex = -1;
                
                results.forEach((item, index) => {
                    if (!item.poster_path) return;
                    
                    const div = document.createElement('div');
                    div.className = 'suggestion-item';
                    div.dataset.index = index;
                    
                    const title = item.title || item.original_title || "غير معروف";
                    const year = item.release_date ? item.release_date.substring(0, 4) : "N/A";
                    
                    const posterUrl = item.poster_path ? 
                        `${TMDB_API.imageBase}${item.poster_path}` : 
                        `${TMDB_API.imageBase}/wwemzKWzjKYJFfCeiB57q3r4Bcm.png`;
                    
                    div.innerHTML = `
                        <img src="${posterUrl}" alt="${title}">
                        <div class="suggestion-info">
                            <div class="suggestion-title">${title}</div>
                            <div class="suggestion-details">🎬 فيلم • ${year}</div>
                        </div>
                    `;
                    
                    div.onclick = async () => {
                        const movieData = await fetchSmartMovieData(item.id, item.original_language || 'en');
                        if (movieData) {
                            showSingleSearchResult(movieData);
                        }
                    };
                    
                    div.onmouseenter = () => {
                        document.querySelectorAll('.suggestion-item').forEach(s => s.classList.remove('active'));
                        div.classList.add('active');
                        activeSuggestionIndex = index;
                    };
                    
                    suggestionsContainer.appendChild(div);
                });
                
            } catch (error) {
                console.error("❌ خطأ في جلب الاقتراحات:", error);
            }
        }

        // ========== عرض نتيجة بحث واحدة ==========
        function showSingleSearchResult(movieData) {
            searchQueryText.textContent = movieData.title;
            searchResultsCount.textContent = "1 نتيجة";
            searchResultsSection.classList.add('active');
            mainContent.style.display = 'none';
            endOfContent.classList.remove('show');
            searchInput.value = '';
            suggestionsContainer.style.display = 'none';
            
            searchResultsContainer.innerHTML = '';
            const card = createMovieCard(movieData);
            searchResultsContainer.appendChild(card);
        }

        // ========== إنشاء بطاقة فيلم ==========
        function createMovieCard(movie) {
            const card = document.createElement("div");
            card.className = "card";
            
            const title = movie.title || "غير معروف";
            const year = movie.release_date ? movie.release_date.substring(0, 4) : "غير معروف";
            const rating = movie.vote_average ? movie.vote_average.toFixed(1) : "N/A";
            const posterUrl = movie.poster_path;
            
            let languageBadge = "";
            let categoryName = "";
            
            if (movie.original_language === 'ja') {
                languageBadge = "🇯🇵 ياباني";
                categoryName = "ياباني";
            } else if (movie.original_language === 'ar') {
                languageBadge = "🇸🇦 عربي";
                categoryName = "عربي";
            } else if (movie.original_language === 'tr') {
                languageBadge = "🇹🇷 تركي";
                categoryName = "تركي";
            } else if (movie.original_language === 'ko') {
                languageBadge = "🇰🇷 كوري";
                categoryName = "كوري";
            } else if (movie.original_language === 'hi') {
                languageBadge = "🇮🇳 هندي";
                categoryName = "هندي";
            } else {
                languageBadge = "🇺🇸 أجنبي";
                categoryName = "أجنبي";
            }
            
            card.innerHTML = `
                <div class="language-badge">${languageBadge}</div>
                <img src="${posterUrl}" alt="${title}" loading="lazy">
                <h3>${title}</h3>
                <div style="padding: 0 12px 12px; display: flex; flex-direction: column; gap: 5px; font-size: 0.8rem;">
                    <div style="display: flex; justify-content: space-between; color: #aaa;">
                        <span>${year}</span>
                        <span>⭐ ${rating}</span>
                    </div>
                    <div style="color: #666; text-align: center; font-size: 0.75rem;">
                        ${categoryName}
                    </div>
                </div>
            `;
            
            card.onclick = () => {
                window.location.href = `details.html?type=movie&id=${movie.id}`;
            };
            
            return card;
        }

        // ========== نظام التحميل التلقائي ==========
        function setupInfiniteScroll() {
            let scrollTimeout;
            
            window.addEventListener('scroll', () => {
                clearTimeout(scrollTimeout);
                
                scrollTimeout = setTimeout(() => {
                    const scrollPosition = window.scrollY + window.innerHeight;
                    const pageHeight = document.documentElement.scrollHeight - 100;
                    
                    if (scrollPosition >= pageHeight * 0.8 && !isLoading && hasMoreMovies) {
                        if (isGlobalSearch) {
                            // إذا كان في وضع البحث العالمي
                            loadMoreSearchResults();
                        } else if (Object.keys(activeFilters).length > 0) {
                            // إذا كان هناك فلاتر نشطة
                            loadMoreFilteredMovies();
                        } else {
                            // الوضع العادي
                            loadMoreMovies();
                        }
                    }
                    
                    backToTopBtn.style.display = window.scrollY > 300 ? "flex" : "none";
                }, 100);
            });
        }

        // ========== التحميل التلقائي للنتائج ==========
        let searchPage = 1;
        let currentSearchQuery = "";
        
        async function loadMoreSearchResults() {
            if (isLoading || !hasMoreMovies) return;
            
            isLoading = true;
            showLoadingIndicator();
            searchPage++;
            
            try {
                const newResults = await performSmartSearch(currentSearchQuery, searchPage);
                
                if (newResults.length > 0) {
                    newResults.forEach(result => {
                        if (!seenMovieIds.has(result.id)) {
                            seenMovieIds.add(result.id);
                            const card = createMovieCard(result);
                            searchResultsContainer.appendChild(card);
                        }
                    });
                } else {
                    hasMoreMovies = false;
                }
            } catch (error) {
                console.error("❌ خطأ في تحميل المزيد من نتائج البحث:", error);
                hasMoreMovies = false;
            } finally {
                isLoading = false;
                hideLoadingIndicator();
                
                if (!hasMoreMovies) {
                    endOfContent.classList.add('show');
                }
            }
        }

        // ========== دوال التحميل الأخرى ==========
        async function loadMoreMovies() {
            if (isLoading || !hasMoreMovies) return;
            
            isLoading = true;
            showLoadingIndicator();
            currentPage++;
            
            try {
                const url = `${TMDB_API.baseURL}/movie/popular?api_key=${TMDB_API.key}&language=en-US&page=${currentPage}`;
                const response = await fetch(url);
                const data = await response.json();
                
                if (data.results && data.results.length > 0) {
                    const newMovies = await Promise.all(
                        data.results.map(async (movie) => {
                            if (seenMovieIds.has(movie.id)) return null;
                            seenMovieIds.add(movie.id);
                            return await fetchSmartMovieData(movie.id, movie.original_language);
                        })
                    );
                    
                    const validMovies = newMovies.filter(movie => movie !== null);
                    
                    if (validMovies.length > 0) {
                        validMovies.forEach(movie => {
                            const card = createMovieCard(movie);
                            mainContent.appendChild(card);
                        });
                        displayedMovies = [...displayedMovies, ...validMovies];
                    }
                    
                    hasMoreMovies = currentPage < (data.total_pages || 1);
                } else {
                    hasMoreMovies = false;
                }
            } catch (error) {
                console.error("❌ خطأ في تحميل المزيد من الأفلام:", error);
                hasMoreMovies = false;
            } finally {
                isLoading = false;
                hideLoadingIndicator();
                
                if (!hasMoreMovies) {
                    endOfContent.classList.add('show');
                }
            }
        }

        async function loadMoreFilteredMovies() {
            if (isLoading || !hasMoreMovies) return;
            
            isLoading = true;
            showLoadingIndicator();
            filterPage++;
            
            try {
                const params = getDiscoverQueryParams();
                params.page = filterPage;
                
                const queryString = Object.keys(params)
                    .map(key => `${key}=${encodeURIComponent(params[key])}`)
                    .join('&');
                
                const url = `${TMDB_API.baseURL}/discover/movie?${queryString}`;
                const response = await fetch(url);
                const data = await response.json();
                
                if (data.results && data.results.length > 0) {
                    const newMovies = await Promise.all(
                        data.results.map(async (movie) => {
                            if (seenMovieIds.has(movie.id)) return null;
                            seenMovieIds.add(movie.id);
                            return await fetchSmartMovieData(movie.id, movie.original_language);
                        })
                    );
                    
                    const validMovies = newMovies.filter(movie => movie !== null);
                    
                    if (validMovies.length > 0) {
                        validMovies.forEach(movie => {
                            const card = createMovieCard(movie);
                            mainContent.appendChild(card);
                        });
                        displayedMovies = [...displayedMovies, ...validMovies];
                    }
                    
                    hasMoreMovies = filterPage < (data.total_pages || 1);
                } else {
                    hasMoreMovies = false;
                }
            } catch (error) {
                console.error("❌ خطأ في تحميل المزيد من الأفلام المفلترة:", error);
                hasMoreMovies = false;
            } finally {
                isLoading = false;
                hideLoadingIndicator();
                
                if (!hasMoreMovies) {
                    endOfContent.classList.add('show');
                }
            }
        }

        // ========== دوال مساعدة ==========
        function getDiscoverQueryParams() {
            let params = {
                api_key: TMDB_API.key,
                language: 'en-US',
                page: filterPage,
                sort_by: 'popularity.desc'
            };
            
            if (activeFilters.category) {
                switch(activeFilters.category.value) {
                    case 'foreign':
                        params.with_original_language = 'en';
                        break;
                    case 'arabic':
                        params.with_original_language = 'ar';
                        break;
                    case 'turkish':
                        params.with_original_language = 'tr';
                        break;
                    case 'asian':
                        params.with_original_language = 'ja|ko|zh|th';
                        break;
                    case 'indian':
                        params.with_original_language = 'hi';
                        break;
                    case 'animation':
                        params.with_genres = '16';
                        break;
                }
            }
            
            if (activeFilters.genre) {
                params.with_genres = activeFilters.genre.value;
            }
            
            if (activeFilters.year && activeFilters.year.value !== 'older') {
                params.primary_release_year = activeFilters.year.value;
            }
            
            if (activeFilters.rating) {
                params['vote_average.gte'] = activeFilters.rating.value;
            }
            
            return params;
        }

        function showLoadingIndicator() {
            const existingIndicator = document.querySelector('.loading-indicator');
            if (!existingIndicator) {
                const indicator = document.createElement('div');
                indicator.className = 'loading-indicator';
                indicator.style.display = 'block';
                indicator.innerHTML = `
                    <div class="loading-spinner"></div>
                    <div>جاري تحميل الأفلام...</div>
                `;
                mainContent.appendChild(indicator);
            }
        }

        function hideLoadingIndicator() {
            const indicator = document.querySelector('.loading-indicator');
            if (indicator) {
                indicator.style.display = 'none';
            }
        }

        // ========== إعدادات البحث ==========
        function setupSearch() {
            if (!searchInput) return;
            
            // البحث أثناء الكتابة
            searchInput.addEventListener('input', () => {
                clearTimeout(searchTimer);
                
                const query = searchInput.value.trim();
                currentSearchQuery = query;
                
                if (query.length >= 2) {
                    showSearchSuggestions(query);
                } else {
                    suggestionsContainer.style.display = 'none';
                }
                
                searchTimer = setTimeout(async () => {
                    if (query.length === 0) {
                        searchResultsSection.classList.remove('active');
                        mainContent.style.display = 'grid';
                        endOfContent.classList.remove('show');
                        isGlobalSearch = false;
                        searchPage = 1;
                        return;
                    }
                    
                    isGlobalSearch = true;
                    searchPage = 1;
                    seenMovieIds.clear();
                    
                    const results = await performSmartSearch(query, searchPage);
                    
                    if (results.length > 0) {
                        searchResultsContainer.innerHTML = '';
                        results.forEach(result => {
                            seenMovieIds.add(result.id);
                            const card = createMovieCard(result);
                            searchResultsContainer.appendChild(card);
                        });
                        hasMoreMovies = true;
                    }
                }, 500);
            });
            
            // التنقل في الاقتراحات
            searchInput.addEventListener('keydown', (e) => {
                const items = suggestionsContainer.querySelectorAll('.suggestion-item');
                if (items.length === 0) return;
                
                switch(e.key) {
                    case 'ArrowDown':
                        e.preventDefault();
                        activeSuggestionIndex = (activeSuggestionIndex + 1) % items.length;
                        updateActiveSuggestion(items);
                        break;
                    case 'ArrowUp':
                        e.preventDefault();
                        activeSuggestionIndex = (activeSuggestionIndex - 1 + items.length) % items.length;
                        updateActiveSuggestion(items);
                        break;
                    case 'Enter':
                        if (activeSuggestionIndex >= 0) {
                            e.preventDefault();
                            items[activeSuggestionIndex].click();
                        } else {
                            searchInput.blur();
                        }
                        break;
                    case 'Escape':
                        suggestionsContainer.style.display = 'none';
                        break;
                }
            });
            
            // إغلاق الاقتراحات عند النقر خارجها
            document.addEventListener('click', (e) => {
                if (!searchInput.contains(e.target) && !suggestionsContainer.contains(e.target)) {
                    suggestionsContainer.style.display = 'none';
                }
            });
        }

        function updateActiveSuggestion(items) {
            items.forEach((item, index) => {
                item.classList.remove('active');
                if (index === activeSuggestionIndex) {
                    item.classList.add('active');
                    item.scrollIntoView({ block: 'nearest' });
                }
            });
        }

        // ========== إعداد الفلاتر ==========
        function setupFilters() {
            document.querySelectorAll('.filter-dropdown button').forEach(item => {
                item.onclick = (e) => {
                    const dropdown = item.closest('.filter-dropdown');
                    if (dropdown) {
                        dropdown.querySelectorAll('button').forEach(b => b.classList.remove('active'));
                        item.classList.add('active');
                        
                        const filterType = dropdown.closest('.filter-group')?.querySelector('.filter-btn')?.dataset.filter;
                        const value = item.dataset.value || "";
                        const displayText = item.textContent;
                        
                        if (value === "") {
                            delete activeFilters[filterType];
                        } else {
                            activeFilters[filterType] = { value, displayText };
                        }
                        
                        dropdown.classList.remove('active');
                        const filterBtn = item.closest('.filter-group')?.querySelector('.filter-btn');
                        if (filterBtn) filterBtn.classList.remove('active');
                        
                        applyFilters();
                        e.stopPropagation();
                    }
                };
            });
        }

        async function applyFilters() {
            displayedMovies = [];
            mainContent.innerHTML = '';
            filterPage = 1;
            hasMoreMovies = true;
            endOfContent.classList.remove('show');
            seenMovieIds.clear();
            
            showLoadingIndicator();
            
            const params = getDiscoverQueryParams();
            const queryString = Object.keys(params)
                .map(key => `${key}=${encodeURIComponent(params[key])}`)
                .join('&');
            
            const url = `${TMDB_API.baseURL}/discover/movie?${queryString}`;
            
            try {
                const response = await fetch(url);
                const data = await response.json();
                
                if (data.results && data.results.length > 0) {
                    const movies = await Promise.all(
                        data.results.map(async (movie) => {
                            seenMovieIds.add(movie.id);
                            return await fetchSmartMovieData(movie.id, movie.original_language);
                        })
                    );
                    
                    const validMovies = movies.filter(movie => movie !== null);
                    
                    if (validMovies.length > 0) {
                        validMovies.forEach(movie => {
                            const card = createMovieCard(movie);
                            mainContent.appendChild(card);
                        });
                        displayedMovies = validMovies;
                    }
                    
                    hasMoreMovies = filterPage < (data.total_pages || 1);
                    
                    searchResultsSection.classList.remove('active');
                    mainContent.style.display = 'grid';
                    isGlobalSearch = false;
                    
                    updateActiveFiltersDisplay();
                    window.scrollTo({ top: 0, behavior: 'smooth' });
                } else {
                    mainContent.innerHTML = `
                        <div class="search-no-results" style="grid-column:1/-1;">
                            <div style="font-size: 3rem; margin-bottom: 20px;">🔍</div>
                            <div style="font-size: 1.2rem; margin-bottom: 10px;">لا توجد نتائج للفلاتر المحددة</div>
                            <div style="color: #888;">جرب تغيير معايير البحث أو استخدام فلاتر مختلفة</div>
                        </div>
                    `;
                }
            } catch (error) {
                console.error("❌ خطأ في تطبيق الفلاتر:", error);
                mainContent.innerHTML = `
                    <div class="search-no-results" style="grid-column:1/-1;">
                        <div style="font-size: 3rem; margin-bottom: 20px;">⚠️</div>
                        <div style="font-size: 1.2rem; margin-bottom: 10px;">حدث خطأ في تطبيق الفلاتر</div>
                        <div style="color: #888;">تأكد من اتصال الإنترنت وحاول مرة أخرى</div>
                    </div>
                `;
            }
            
            hideLoadingIndicator();
        }

        function updateActiveFiltersDisplay() {
            if (!activeFiltersContainer) return;
            
            activeFiltersContainer.innerHTML = '';
            const activeCount = Object.keys(activeFilters).length;
            
            if (activeCount === 0) {
                activeFiltersContainer.style.display = 'none';
                return;
            }
            
            activeFiltersContainer.style.display = 'flex';
            
            const clearBtn = document.createElement('button');
            clearBtn.className = 'clear-all';
            clearBtn.textContent = '🗑️ مسح الكل';
            clearBtn.onclick = clearAllFilters;
            activeFiltersContainer.appendChild(clearBtn);
            
            for (const [type, filter] of Object.entries(activeFilters)) {
                if (!filter || !filter.value) continue;
                
                const tag = document.createElement('div');
                tag.className = 'filter-tag';
                
                const icons = { category: '📁', genre: '🎭', year: '📅', rating: '⭐' };
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
        }

        function clearAllFilters() {
            document.querySelectorAll('.filter-dropdown').forEach(dropdown => {
                dropdown.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
                dropdown.querySelector('button[data-value=""]').classList.add('active');
            });
            
            activeFilters = {};
            displayedMovies = [];
            mainContent.innerHTML = '';
            currentPage = 1;
            filterPage = 1;
            hasMoreMovies = true;
            endOfContent.classList.remove('show');
            seenMovieIds.clear();
            
            loadInitialMovies();
            updateActiveFiltersDisplay();
        }

        // ========== تحميل الأفلام الأولية ==========
        async function loadInitialMovies() {
            showLoadingIndicator();
            
            try {
                const url = `${TMDB_API.baseURL}/movie/popular?api_key=${TMDB_API.key}&language=en-US&page=1`;
                const response = await fetch(url);
                const data = await response.json();
                
                if (data.results && data.results.length > 0) {
                    const movies = await Promise.all(
                        data.results.map(async (movie) => {
                            seenMovieIds.add(movie.id);
                            return await fetchSmartMovieData(movie.id, movie.original_language);
                        })
                    );
                    
                    const validMovies = movies.filter(movie => movie !== null);
                    
                    if (validMovies.length > 0) {
                        validMovies.forEach(movie => {
                            const card = createMovieCard(movie);
                            mainContent.appendChild(card);
                        });
                        displayedMovies = validMovies;
                        hasMoreMovies = true;
                    }
                }
            } catch (error) {
                console.error("❌ خطأ في تحميل الأفلام الأولية:", error);
                mainContent.innerHTML = `
                    <div class="search-no-results" style="grid-column:1/-1;">
                        <div style="font-size: 3rem; margin-bottom: 20px;">⚠️</div>
                        <div style="font-size: 1.2rem; margin-bottom: 10px;">فشل تحميل الأفلام</div>
                        <div style="color: #888;">تأكد من اتصال الإنترنت وحاول مرة أخرى</div>
                        <button onclick="location.reload()" style="
                            margin-top: 20px;
                            padding: 10px 20px;
                            background: var(--accent);
                            color: white;
                            border: none;
                            border-radius: 8px;
                            cursor: pointer;
                            font-family: inherit;
                        ">إعادة المحاولة</button>
                    </div>
                `;
            }
            
            hideLoadingIndicator();
        }

        // ========== إعدادات جانبية ==========
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

        function setupBackToTop() {
            if (!backToTopBtn) return;
            
            backToTopBtn.addEventListener("click", () => {
                window.scrollTo({ top: 0, behavior: "smooth" });
            });
        }

        // ========== التعامل مع القوائم المنسدلة ==========
        document.querySelectorAll('.filter-btn').forEach(btn => {
            btn.onclick = (e) => {
                const dropdown = btn.nextElementSibling;
                const isActive = dropdown.classList.contains('active');

                document.querySelectorAll('.filter-dropdown').forEach(d => d.classList.remove('active'));
                document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));

                if (!isActive) {
                    dropdown.classList.add('active');
                    btn.classList.add('active');
                }
                e.stopPropagation();
            };
        });

        document.addEventListener('click', () => {
            document.querySelectorAll('.filter-dropdown').forEach(d => d.classList.remove('active'));
            document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        });

        // ========== تهيئة التطبيق ==========
        async function initApp() {
            console.log("🎬 تطبيق TAFLIM يعمل...");
            console.log("🔤 البحث الذكي العالمي مفعّل");
            console.log("🌍 نظام اختيار اللغة والصور الذكي جاهز");
            
            setupSidebar();
            setupBackToTop();
            setupInfiniteScroll();
            setupFilters();
            setupSearch();
            
            await loadInitialMovies();
            
            console.log("✅ التطبيق جاهز للاستخدام");
        }

        // بدء تشغيل التطبيق
        document.addEventListener('DOMContentLoaded', initApp);