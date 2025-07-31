// --- DOM Elements ---
const mainContent = document.getElementById('main-content');
const searchBar = document.querySelector('.search-bar');
const searchBtn = document.querySelector('.search-btn');
const sidebarItems = document.querySelectorAll('.sidebar li');
const logo = document.querySelector('.logo');
const exploreBar = document.querySelector('.explore-bar');

// --- App State ---
const API_KEY = 'AIzaSyAMFnIMGPqH6qFoPCgCO_INaD_smXKCcJg';
let nextPageToken = null;
let lastApiUrl = '';
let isLoadingMore = false;
let currentView = 'grid';
let lastVideos = [];

// --- Initialization ---
window.addEventListener('load', () => {
    fetchHomeVideos();
});

// --- Event Listeners ---
logo.addEventListener('click', () => {
    sidebarItems.forEach(i => i.classList.remove('active'));
    document.querySelector('.sidebar li:first-child').classList.add('active');
    fetchHomeVideos();
});

searchBtn.addEventListener('click', handleSearch);
searchBar.addEventListener('keyup', e => e.key === 'Enter' && handleSearch());

sidebarItems.forEach(item => {
    if(item.classList.contains('separator')) return;
    item.addEventListener('click', () => {
        sidebarItems.forEach(i => i.classList.remove('active'));
        item.classList.add('active');
        const section = item.textContent.trim().toLowerCase();
        handleSidebarClick(section);
    });
});

exploreBar.addEventListener('click', (e) => {
    if (e.target.tagName === 'BUTTON') {
        exploreBar.querySelectorAll('button').forEach(btn => btn.classList.remove('active'));
        e.target.classList.add('active');
        const category = e.target.dataset.category;
        handleExploreClick(category);
    }
});

window.addEventListener('scroll', () => {
    if (currentView === 'player' || isLoadingMore || !nextPageToken) return;
    if (window.innerHeight + window.scrollY >= document.body.offsetHeight - 500) {
        loadMoreVideos();
    }
});

// --- Subscriptions ---
function getSubscriptions() {
    return JSON.parse(localStorage.getItem('subscriptions') || '[]');
}

function isSubscribed(channelId) {
    const subscriptions = getSubscriptions();
    return subscriptions.some(sub => sub.id === channelId);
}

function toggleSubscription(channelData, button) {
    let subscriptions = getSubscriptions();
    if (isSubscribed(channelData.id)) {
        subscriptions = subscriptions.filter(sub => sub.id !== channelData.id);
        button.textContent = 'Subscribe';
        button.classList.remove('subscribed');
    } else {
        subscriptions.unshift({ id: channelData.id, title: channelData.title });
        button.textContent = 'Subscribed';
        button.classList.add('subscribed');
    }
    localStorage.setItem('subscriptions', JSON.stringify(subscriptions));
}

async function showSubscriptions() {
    const subscriptions = getSubscriptions();
    if (subscriptions.length === 0) {
        displayMessage('info', 'Aapne kisi channel ko subscribe nahi kiya hai.');
        return;
    }
    // To keep it simple and API-friendly, we'll fetch videos from the most recent subscription.
    const firstSub = subscriptions[0];
    lastApiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&channelId=${firstSub.id}&order=date&type=video&maxResults=20&key=${API_KEY}`;
    const data = await fetchApi(lastApiUrl);
    if (data) {
        nextPageToken = data.nextPageToken;
        lastVideos = data.items;
        displayVideosGrid(data.items, true, false, `Latest from ${firstSub.title}`);
    }
}

// --- Liked Videos ---
function getLikedVideos() {
    return JSON.parse(localStorage.getItem('likedVideos') || '[]');
}

function isVideoLiked(videoId) {
    const likedVideos = getLikedVideos();
    return likedVideos.some(video => video.id === videoId);
}

function toggleLike(videoData, button) {
    let likedVideos = getLikedVideos();
    if (isVideoLiked(videoData.id)) {
        likedVideos = likedVideos.filter(video => video.id !== videoData.id);
        button.classList.remove('liked');
        button.innerHTML = '♡';
    } else {
        likedVideos.unshift(videoData);
        button.classList.add('liked');
        button.innerHTML = '♥';
    }
    localStorage.setItem('likedVideos', JSON.stringify(likedVideos));
}

function showLikedVideos() {
    const likedVideos = getLikedVideos();
    if (likedVideos.length === 0) {
        displayMessage('info', 'Aapne abhi tak koi video like nahi kiya hai.');
        return;
    }
    displayVideosGrid(likedVideos, false, true);
}

// --- History ---
function getHistory() {
    return JSON.parse(localStorage.getItem('videoHistory') || '[]');
}

function addToHistory(videoData) {
    let history = getHistory();
    history = history.filter(item => item.id !== videoData.id);
    history.unshift(videoData);
    if (history.length > 50) history.pop();
    localStorage.setItem('videoHistory', JSON.stringify(history));
}

function showHistory() {
    const history = getHistory();
    if (history.length === 0) {
        displayMessage('info', 'Aapka watch history khaali hai.');
        return;
    }
    displayVideosGrid(history, false, true);
}

// --- Navigation & Core Logic ---
function handleSidebarClick(section) {
    nextPageToken = null;
    switch(section) {
        case 'home': fetchHomeVideos(); break;
        case 'trending': fetchTrendingVideos(); break; 
        case 'shorts': fetchShorts(); break;
        case 'subscriptions': showSubscriptions(); break;
        case 'liked videos': showLikedVideos(); break;
        case 'history': showHistory(); break;
    }
}

function handleExploreClick(category) {
    let videoCategoryId = '';
    
    switch(category) {
        case 'all':
            fetchHomeVideos();
            return;
        case 'music': videoCategoryId = '10'; break;
        case 'gaming': videoCategoryId = '20'; break;
        case 'movies': videoCategoryId = '1'; break;
        case 'news': videoCategoryId = '25'; break;
        case 'sports': videoCategoryId = '17'; break;
        case 'live':
            fetchLiveVideos();
            return;
        case 'podcast':
            searchVideos('podcast');
            return;
    }
    searchByCategory(videoCategoryId, category);
}

function handleSearch() {
    const query = searchBar.value.trim();
    if (query) {
        nextPageToken = null;
        searchVideos(query);
    }
}

// --- API Fetching ---
async function fetchApi(url, isLoadMore = false) {
    if (!isLoadMore) {
         mainContent.innerHTML = '<p class="loading-message">Loading...</p>';
    }
    try {
        const response = await fetch(url);
        if (!response.ok) {
            const errorData = await response.json();
            const errorMessage = errorData.error?.message || 'An unknown API error occurred.';
            throw new Error(errorMessage);
        }
        return await response.json();
    } catch (error) {
        console.error('API Error:', error);
        displayMessage('error', `Videos load nahi ho sake. API key galat ho sakti hai ya quota exceed ho gaya hai. (Error: ${error.message})`);
        return null;
    }
}

async function fetchHomeVideos() {
    lastApiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&maxResults=20&regionCode=IN&key=${API_KEY}`;
    const data = await fetchApi(lastApiUrl);
    if (data) {
        nextPageToken = data.nextPageToken;
        lastVideos = data.items;
        displayVideosGrid(lastVideos);
    }
}

async function fetchTrendingVideos() {
    lastApiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&maxResults=20&regionCode=IN&videoCategoryId=10&key=${API_KEY}`;
     const data = await fetchApi(lastApiUrl);
     if (data) {
         nextPageToken = data.nextPageToken;
         lastVideos = data.items;
         displayVideosGrid(lastVideos);
     }
}

async function fetchShorts() {
    lastApiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&q=%23shorts&type=video&videoDuration=short&maxResults=20&key=${API_KEY}`;
    const data = await fetchApi(lastApiUrl);
    if (data) {
        nextPageToken = data.nextPageToken;
        lastVideos = data.items;
        displayVideosGrid(data.items, true, false, "Shorts");
    }
}

async function fetchLiveVideos() {
    lastApiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&eventType=live&type=video&maxResults=20&regionCode=IN&key=${API_KEY}`;
    const data = await fetchApi(lastApiUrl);
    if (data) {
        nextPageToken = data.nextPageToken;
        lastVideos = data.items;
        displayVideosGrid(lastVideos, true, false, "Abhi Live");
    }
}

async function searchVideos(query) {
    lastApiUrl = `https://www.googleapis.com/youtube/v3/search?part=snippet&maxResults=20&q=${encodeURIComponent(query)}&type=video&key=${API_KEY}`;
    const data = await fetchApi(lastApiUrl);
    if (data) {
        nextPageToken = data.nextPageToken;
        lastVideos = data.items;
        displayVideosGrid(lastVideos, true, false, `"${query}" ke liye results`);
    }
}

async function searchByCategory(videoCategoryId, categoryName) {
    lastApiUrl = `https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&chart=mostPopular&maxResults=20&regionCode=IN&videoCategoryId=${videoCategoryId}&key=${API_KEY}`;
    const data = await fetchApi(lastApiUrl);
    if (data) {
        nextPageToken = data.nextPageToken;
        lastVideos = data.items;
        displayVideosGrid(lastVideos, false, false, `${categoryName.charAt(0).toUpperCase() + categoryName.slice(1)} mein trending`);
    }
}

async function loadMoreVideos() {
    if (!nextPageToken || isLoadingMore) return;
    isLoadingMore = true;
    
    const container = mainContent.querySelector('.grid-view');
    if (!container) {
        isLoadingMore = false;
        return; 
    }

    const loader = document.createElement('div');
    loader.className = 'infinite-scroll-loader';
    loader.innerHTML = 'Aur load ho raha hai...';
    container.appendChild(loader);

    const url = `${lastApiUrl}&pageToken=${nextPageToken}`;
    const data = await fetchApi(url, true);
    
    loader.remove();
    if (data) {
        nextPageToken = data.nextPageToken;
        lastVideos = [...lastVideos, ...data.items];
        appendVideosToGrid(data.items, lastApiUrl.includes('/search'));
    }
    isLoadingMore = false;
}

// --- UI Rendering ---
function displayMessage(type, message) {
    currentView = 'grid';
    mainContent.innerHTML = `<p class="${type}-message">${message}</p>`;
}

function displayVideosGrid(videos, isSearch = false, isHistory = false, title = "") {
    currentView = 'grid';
    mainContent.innerHTML = `
        ${title ? `<h2 style="margin-bottom: 20px;">${title}</h2>` : ''}
        <div class="grid-view"></div>
    `;
    if (!videos || videos.length === 0) {
        displayMessage('info', 'Koi video nahi mila.');
        return;
    }
    appendVideosToGrid(videos, isSearch, isHistory);
}

function appendVideosToGrid(videos, isSearch = false, isHistory = false) {
    const grid = mainContent.querySelector('.grid-view');
    videos.forEach(videoData => {
        const videoId = isHistory ? videoData.id : (isSearch ? videoData.id.videoId : videoData.id);
        if (!videoId) return;

        const snippet = videoData.snippet;
        const thumbnailUrl = snippet.thumbnails.high?.url || snippet.thumbnails.medium.url;

        const videoEl = document.createElement('div');
        videoEl.className = 'video';
        videoEl.innerHTML = `
            <div class="thumbnail-container">
                <img src="${thumbnailUrl}" alt="${snippet.title}" onerror="this.onerror=null;this.src='https://placehold.co/480x360/222222/aaaaaa?text=Image+Not+Found';">
            </div>
            <div class="video-details">
                <div>
                    <h3>${snippet.title}</h3>
                    <p>${snippet.channelTitle}</p>
                </div>
            </div>
        `;
        videoEl.addEventListener('click', () => showVideoPlayer(videoId));
        grid.appendChild(videoEl);
    });
}

async function showVideoPlayer(videoId) {
    currentView = 'player';
    mainContent.innerHTML = `<p class="loading-message">Player load ho raha hai...</p>`;
    mainContent.className = 'player-view';

    const videoDetailsData = await fetchApi(`https://www.googleapis.com/youtube/v3/videos?part=snippet,statistics&id=${videoId}&key=${API_KEY}`);
    if (!videoDetailsData || videoDetailsData.items.length === 0) {
        displayMessage('error', 'Video details load nahi ho sake.');
        return;
    }
    const video = videoDetailsData.items[0];
    addToHistory(video);

    const suggestionsData = await fetchApi(`https://www.googleapis.com/youtube/v3/search?part=snippet&relatedToVideoId=${videoId}&type=video&maxResults=15&key=${API_KEY}`);

    const liked = isVideoLiked(videoId);
    const channelId = video.snippet.channelId;
    const channelTitle = video.snippet.channelTitle;
    const subscribed = isSubscribed(channelId);

    mainContent.innerHTML = `
        <div><button class="back-button" style="margin-bottom: 16px; background: var(--background-secondary); border: 1px solid var(--border-color); color: var(--text-primary); padding: 8px 16px; border-radius: 20px; cursor: pointer;">← Wapas Jaye</button></div>
        <div class="player-main-content">
            <div class="player-main-column">
                <div class="player-iframe-container">
                    <iframe src="https://www.youtube.com/embed/${videoId}?autoplay=1" allow="autoplay; encrypted-media" allowfullscreen></iframe>
                </div>
                <div class="player-video-details">
                    <h2>${video.snippet.title}</h2>
                    <div class="channel-info">
                        <p>${channelTitle} • ${formatViews(video.statistics.viewCount)} • ${formatDate(video.snippet.publishedAt)}</p>
                        <button class="subscribe-btn ${subscribed ? 'subscribed' : ''}">${subscribed ? 'Subscribed' : 'Subscribe'}</button>
                    </div>
                    <div class="actions">
                        <button class="like-btn ${liked ? 'liked' : ''}">${liked ? '♥' : '♡'}</button>
                        <button id="download-btn">Download</button>
                    </div>
                </div>
            </div>
            <div class="player-suggestions-column"></div>
        </div>
    `;
    
    const suggestionsContainer = mainContent.querySelector('.player-suggestions-column');
    if (suggestionsData && suggestionsData.items) {
         suggestionsData.items.forEach(suggestion => {
             if (!suggestion.id.videoId) return;
             const suggestionEl = document.createElement('div');
             suggestionEl.className = 'suggestion-item';
             suggestionEl.innerHTML = `
                 <img src="${suggestion.snippet.thumbnails.medium.url}" alt="${suggestion.snippet.title}">
                 <div class="suggestion-item-details">
                     <h4>${suggestion.snippet.title}</h4>
                     <p>${suggestion.snippet.channelTitle}</p>
                 </div>
             `;
             suggestionEl.addEventListener('click', () => showVideoPlayer(suggestion.id.videoId));
             suggestionsContainer.appendChild(suggestionEl);
         });
    }

    mainContent.querySelector('.back-button').addEventListener('click', () => displayVideosGrid(lastVideos, lastApiUrl.includes('/search')));
    mainContent.querySelector('.like-btn').addEventListener('click', (e) => toggleLike(video, e.target));
    mainContent.querySelector('.subscribe-btn').addEventListener('click', (e) => toggleSubscription({ id: channelId, title: channelTitle }, e.target));
    document.getElementById('download-btn').addEventListener('click', () => alert('Download feature sirf demo ke liye hai.'));
}

// --- Helper Functions ---
const formatViews = (views) => views ? `${Number(views).toLocaleString()} views` : 'No views';
const formatDate = (dateString) => new Date(dateString).toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
