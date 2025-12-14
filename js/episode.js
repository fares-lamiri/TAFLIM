// episode.js
const params = new URLSearchParams(window.location.search);
const mediaType = params.get("type");
const mediaId = params.get("id");
const season = params.get("season") || "1";
const episode = params.get("episode") || "1";

// سيرفرات المشاهدة (يمكن استبدالها ببيانات حقيقية)
const STREAMING_SERVERS = [
    { id: 1, name: "سيرفر 1", url: "https://example.com/video1.mp4", quality: "HD" },
    { id: 2, name: "سيرفر 2", url: "https://example.com/video2.mp4", quality: "FHD" },
    { id: 3, name: "سيرفر 3", url: "https://example.com/video3.mp4", quality: "4K" },
    { id: 4, name: "سيرفر 4", url: "https://example.com/video4.mp4", quality: "HD" }
];

// خيارات التحميل
const DOWNLOAD_OPTIONS = [
    { quality: "1080p", size: "1.2 GB", servers: [
        { name: "Google Drive", url: "#" },
        { name: "Mega", url: "#" },
        { name: "Mediafire", url: "#" }
    ]},
    { quality: "720p", size: "800 MB", servers: [
        { name: "Google Drive", url: "#" },
        { name: "Direct", url: "#" }
    ]},
    { quality: "480p", size: "450 MB", servers: [
        { name: "Mediafire", url: "#" },
        { name: "Mega", url: "#" }
    ]}
];

function initEpisodePage() {
    // تحديث العنوان
    document.getElementById('episode-title').textContent = `الحلقة ${episode}`;
    document.getElementById('episode-subtitle').textContent = 
        `موسم ${season} - الحلقة ${episode}`;
    
    // إضافة سيرفرات المشاهدة
    const serverSelector = document.getElementById('server-selector');
    STREAMING_SERVERS.forEach((server, index) => {
        const tab = document.createElement('div');
        tab.className = `server-tab ${index === 0 ? 'active' : ''}`;
        tab.textContent = `${server.name} (${server.quality})`;
        tab.dataset.url = server.url;
        
        tab.onclick = () => {
            // إزالة النشط من جميع التبويبات
            document.querySelectorAll('.server-tab').forEach(t => 
                t.classList.remove('active'));
            
            // إضافة النشط للتبويب المحدد
            tab.classList.add('active');
            
            // تغيير الفيديو
            loadVideo(server.url);
        };
        
        serverSelector.appendChild(tab);
    });
    
    // إضافة خيارات التحميل
    const downloadGrid = document.getElementById('download-grid');
    DOWNLOAD_OPTIONS.forEach(option => {
        const card = document.createElement('div');
        card.className = 'download-card';
        
        let serversHTML = '';
        option.servers.forEach(server => {
            serversHTML += `
                <button class="download-btn" onclick="window.open('${server.url}', '_blank')">
                    ⬇ ${server.name}
                </button>
            `;
        });
        
        card.innerHTML = `
            <span class="quality-badge">${option.quality}</span>
            <p style="margin: 10px 0;">الحجم: ${option.size}</p>
            ${serversHTML}
        `;
        
        downloadGrid.appendChild(card);
    });
    
    // تحميل أول فيديو
    if (STREAMING_SERVERS[0]) {
        loadVideo(STREAMING_SERVERS[0].url);
    }
}

function loadVideo(videoUrl) {
    const player = document.getElementById('video-player');
    player.innerHTML = `
        <video controls autoplay style="width:100%; height:100%; object-fit:contain;">
            <source src="${videoUrl}" type="video/mp4">
            متصفحك لا يدعم تشغيل الفيديو
        </video>
    `;
}

// بدء التحميل
document.addEventListener('DOMContentLoaded', initEpisodePage);