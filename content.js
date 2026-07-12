let lyrics = [];
let lyricElements = []; 
let syncTimer = null;
let currentActiveIndex = -1;
let currentTrackInfo = null;

let customLyricsButton = null;
let isCustomLyricsVisible = false;
let lastSpotifyScrollPos = 0; 

// 💡 【全新大絕招】精準雷達與貼紙追蹤
function getSpotifyScrollNode() {
    // 1. 先看有沒有被我們貼過貼紙的節點
    let markedNode = document.querySelector('[data-kamishiro-scroll="true"]');
    if (markedNode && document.body.contains(markedNode)) return markedNode;

    // 2. 動態雷達：從 main 往上找，只要誰有捲動高度，誰就是真兇！
    let curr = document.querySelector('main');
    while (curr && curr !== document.body) {
        if (curr.scrollTop > 0) {
            curr.setAttribute('data-kamishiro-scroll', 'true'); // 貼上追蹤貼紙
            return curr;
        }
        curr = curr.parentElement;
    }

    // 3. 防呆機制：如果使用者本來就待在最上面 (高度 = 0)
    curr = document.querySelector('main');
    if (curr) {
        let fallback = curr.closest('.os-viewport') || 
                       curr.closest('.main-view-container__scroll-node') ||
                       curr.parentElement;
        if (fallback) {
            fallback.setAttribute('data-kamishiro-scroll', 'true');
            return fallback;
        }
    }
    return null;
}

// 💡 獨立封裝的高度還原魔法
function restoreSpotifyScroll() {
    const spotifyScrollNode = getSpotifyScrollNode();
    if (spotifyScrollNode) {
        spotifyScrollNode.style.overflowY = 'auto'; // 還原原生滑條
        spotifyScrollNode.scrollTop = lastSpotifyScrollPos; // 灌回記憶高度
        spotifyScrollNode.removeAttribute('data-kamishiro-scroll'); // 撕下貼紙
        console.log("🔄 成功還原高度:", lastSpotifyScrollPos);
    }
}

function getCurrentTrackInfo() {
    const titleEl = document.querySelector('[data-testid="context-item-info-title"] a') || 
                    document.querySelector('[data-testid="context-item-info-title"]');
    const artistEl = document.querySelector('[data-testid="context-item-info-artist"]');

    if (titleEl && artistEl) {
        return `${titleEl.innerText.trim()}_${artistEl.innerText.trim()}`; 
    }
    return null;
}

function applyDynamicTheme(container, textElements) {
    const coverImg = document.querySelector('img[data-testid="cover-art-image"]');
    if (!coverImg) return;

    const img = new Image();
    img.crossOrigin = 'Anonymous';
    img.src = coverImg.src;

    img.onload = function() {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d');
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        try {
            const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
            const data = imageData.data;
            let r = 0, g = 0, b = 0, count = 0;

            for (let i = 0; i < data.length; i += 4 * 10) {
                r += data[i]; g += data[i + 1]; b += data[i + 2]; count++;
            }

            r = Math.floor(r / count); g = Math.floor(g / count); b = Math.floor(b / count);

            container.style.background = `linear-gradient(180deg, rgb(${r},${g},${b}) 0%, rgb(${Math.max(0, r-40)},${Math.max(0, g-40)},${Math.max(0, b-40)}) 100%)`;

            const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
            const activeColor = luminance > 128 ? '#121212' : '#ffffff';
            const inactiveColor = luminance > 128 ? 'rgba(0,0,0,0.3)' : 'rgba(255,255,255,0.4)';

            textElements.forEach(el => {
                el.dataset.activeColor = activeColor;
                el.dataset.inactiveColor = inactiveColor;
                el.style.color = inactiveColor; 
            });
        } catch (e) {
            console.log("Canvas 顏色提取失敗", e);
        }
    };
}

function parseLRC(lrc) {
    const lines = lrc.split('\n');
    const result = [];
    const timeReg = /\[(\d{2}):(\d{2})\.(\d{2,3})\]/;
    for (let line of lines) {
        const match = timeReg.exec(line);
        if (match) {
            const min = parseInt(match[1]);
            const sec = parseInt(match[2]);
            if(line.replace(timeReg, '').trim()) {
                result.push({ time: min * 60 + sec, text: line.replace(timeReg, '').trim() });
            }
        }
    }
    return result;
}

function seekToTime(targetSeconds) {
    const progressBar = document.querySelector('[data-testid="progress-bar"]');
    const durationEl = document.querySelector('[data-testid="playback-duration"]');

    if (!progressBar || !durationEl) {
        console.error("❌ 找不到進度條或時間元素");
        return;
    }

    const durationParts = durationEl.innerText.split(':');
    let totalSeconds = 0;
    if (durationParts.length === 2) {
        totalSeconds = parseInt(durationParts[0]) * 60 + parseInt(durationParts[1]);
    } else if (durationParts.length === 3) {
        totalSeconds = parseInt(durationParts[0]) * 3600 + parseInt(durationParts[1]) * 60 + parseInt(durationParts[2]);
    }

    if (totalSeconds <= 0) return;

    const percentage = Math.min(targetSeconds / totalSeconds, 1);
    const rect = progressBar.getBoundingClientRect();
    
    // 計算出精準的 X 座標
    const clickX = rect.left + (rect.width * percentage);
    const clickY = rect.top + (rect.height / 2);

    console.log(`⏱️ 準備跳轉: 目標 ${targetSeconds}s, 座標 X: ${clickX}`);

    // 💡 關鍵升級：使用 PointerEvent 騙過 React 的觸控/滑鼠監聽器
    const eventOptions = {
        bubbles: true,
        cancelable: true,
        view: window,
        clientX: clickX,
        clientY: clickY,
        button: 0, // 左鍵
        buttons: 1,
        pointerId: 1,
        pointerType: 'mouse',
        isPrimary: true
    };

    // 1. 模擬滑鼠/手指「按下去」
    progressBar.dispatchEvent(new PointerEvent('pointerdown', eventOptions));
    
    // 2. 給予 10 毫秒的延遲，模擬人類放開按鍵的動作
    setTimeout(() => {
        const upOptions = { ...eventOptions, buttons: 0 };
        // 模擬「放開」與「點擊完成」
        progressBar.dispatchEvent(new PointerEvent('pointerup', upOptions));
        progressBar.dispatchEvent(new MouseEvent('click', upOptions));
    }, 10);
}

function renderLyricsUI(lyricsData) {
    const targetContainer = document.querySelector('main');
    if (!targetContainer) return;

    if (getComputedStyle(targetContainer).position === 'static') {
        targetContainer.style.position = 'relative';
    }

    let customWrapper = document.getElementById('kamishiro-lyrics-wrapper');
    if (!customWrapper) {
        customWrapper = document.createElement('div');
        customWrapper.id = 'kamishiro-lyrics-wrapper';
        customWrapper.style.cssText = `
            position: absolute; top: 0; left: 0; width: 100%; height: 100%;
            z-index: 999; overflow-y: auto; overflow-x: hidden; display: none;
            scroll-behavior: smooth; padding-top: 15vh; padding-bottom: 40vh;
            border-radius: 8px; 
        `;
        targetContainer.appendChild(customWrapper);
    }
    customWrapper.innerHTML = ''; 
    customWrapper.style.display = isCustomLyricsVisible ? 'block' : 'none';

    const customLyricsContainer = document.createElement('div');
    customLyricsContainer.style.cssText = `
        display: flex; flex-direction: column; padding: 0 10vw; gap: 32px;
    `;

    lyricElements = []; 
    lyricsData.forEach((item, index) => {
        const lineElement = document.createElement('div');
        lineElement.innerText = item.text;
        lineElement.style.cssText = `
            font-size: 2.6rem; font-weight: 800; cursor: pointer; 
            transform-origin: left center; transition: all 0.3s ease;
            color: rgba(255,255,255,0.35); line-height: 1.4;
        `;
        lineElement.onclick = () => {
            seekToTime(item.time);
        };
        customLyricsContainer.appendChild(lineElement);
        lyricElements.push(lineElement);
    });

    customWrapper.appendChild(customLyricsContainer);
    applyDynamicTheme(customWrapper, lyricElements);

    setTimeout(() => {
        customWrapper.scrollTop = 0; 
        
        if (isCustomLyricsVisible) {
            const spotifyScrollNode = getSpotifyScrollNode();
            if (spotifyScrollNode) {
                spotifyScrollNode.style.overflowY = 'hidden'; 
                spotifyScrollNode.scrollTop = 0; // 強制讓底部原生的畫面也置頂，避免位移
            }
        }
    }, 50);
}

function startSyncing() {
    let lastActiveIndex = -1; 
    if (syncTimer) clearInterval(syncTimer);

    syncTimer = setInterval(() => {
        const timeElement = document.querySelector('[data-testid="playback-position"]');
        const wrapper = document.getElementById('kamishiro-lyrics-wrapper');
        
        if (timeElement && wrapper) {
            const parts = timeElement.innerText.split(':');
            const currentSeconds = parseInt(parts[0]) * 60 + parseInt(parts[1]);

            if (currentSeconds <= 1 && lastActiveIndex === -1) {
                wrapper.scrollTop = 0;
            }

            let newActiveIndex = -1;
            for (let i = 0; i < lyrics.length; i++) {
                if (currentSeconds >= lyrics[i].time) newActiveIndex = i;
                else break;
            }

            if (newActiveIndex !== -1 && newActiveIndex !== lastActiveIndex) {
                lyricElements.forEach((el, index) => {
                    const activeColor = el.dataset.activeColor || '#ffffff';
                    const inactiveColor = el.dataset.inactiveColor || 'rgba(255,255,255,0.35)';

                    if (index === newActiveIndex) {
                        el.style.color = activeColor;
                        el.style.transform = 'scale(1.03)';
                        if (isCustomLyricsVisible) {
                            el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                        }
                    } else {
                        el.style.color = inactiveColor;
                        el.style.transform = 'scale(1)';
                    }
                });
                lastActiveIndex = newActiveIndex;
            }
        }
    }, 400); 
}

function injectCustomLyricsButton() {
    if (document.getElementById('kamishiro-lyric-toggle')) return;

    customLyricsButton = document.createElement('button');
    customLyricsButton.id = 'kamishiro-lyric-toggle';
    customLyricsButton.innerText = '🎵 LRC';
    
    customLyricsButton.style.cssText = `
        position: fixed; right: 30px; bottom: 110px; z-index: 9999;
        background: #282828; color: #b3b3b3; border: none; border-radius: 25px;
        padding: 0 16px; height: 40px; font-weight: bold; cursor: pointer;
        box-shadow: 0 4px 12px rgba(0,0,0,0.6); transition: all 0.2s ease;
        display: none; font-size: 0.9rem;
    `;

    customLyricsButton.onclick = () => {
        const wrapper = document.getElementById('kamishiro-lyrics-wrapper');
        if (!wrapper) return;

        isCustomLyricsVisible = !isCustomLyricsVisible;

        if (isCustomLyricsVisible) {
            // 🎯 【開啟】：先抓節點、存高度、隱藏原生滑條、強制置頂
            const spotifyScrollNode = getSpotifyScrollNode();
            if (spotifyScrollNode) {
                lastSpotifyScrollPos = spotifyScrollNode.scrollTop;
                spotifyScrollNode.style.overflowY = 'hidden';
                spotifyScrollNode.scrollTop = 0; 
                console.log("💾 成功記憶高度:", lastSpotifyScrollPos);
            }

            wrapper.style.display = 'block';
            customLyricsButton.style.background = '#1db954'; 
            customLyricsButton.style.color = '#ffffff';
            
            setTimeout(() => {
                const activeEl = lyricElements.find(el => el.style.transform === 'scale(1.03)');
                if (activeEl) activeEl.scrollIntoView({ block: 'center' });
                else wrapper.scrollTop = 0;
            }, 50);
            
        } else {
            // 🎯 【關閉】：呼叫還原魔法
            wrapper.style.display = 'none';
            customLyricsButton.style.background = '#282828';
            customLyricsButton.style.color = '#b3b3b3';
            restoreSpotifyScroll();
        }
    };
    document.body.appendChild(customLyricsButton);
}

function initOutsideClickListener() {
    document.addEventListener('click', (e) => {
        if (!isCustomLyricsVisible) return;

        const wrapper = document.getElementById('kamishiro-lyrics-wrapper');
        const btn = document.getElementById('kamishiro-lyric-toggle');
        const playerBar = document.querySelector('[data-testid="now-playing-bar"]') || 
                          document.querySelector('aside');

        const isClickInsideWrapper = wrapper && wrapper.contains(e.target);
        const isClickOnButton = btn && btn.contains(e.target);
        const isClickOnPlayerBar = playerBar && (playerBar.contains(e.target) || playerBar === e.target);

        if (!isClickInsideWrapper && !isClickOnButton && !isClickOnPlayerBar) {
            isCustomLyricsVisible = false;
            wrapper.style.display = 'none';
            btn.style.background = '#282828';
            btn.style.color = '#b3b3b3';
            restoreSpotifyScroll();
            console.log("🎯 使用者點擊外部退場，已還原高度。");
        }
    });
}

function clearCustomLyricsUI() {
    const wrapper = document.getElementById('kamishiro-lyrics-wrapper');
    if (wrapper) wrapper.style.display = 'none';
    
    const btn = document.getElementById('kamishiro-lyric-toggle');
    if (btn) {
        btn.style.display = 'none';
        btn.style.background = '#282828';
        btn.style.color = '#b3b3b3';
    }
    
    if (isCustomLyricsVisible) {
        isCustomLyricsVisible = false;
        restoreSpotifyScroll();
    }
    if (syncTimer) clearInterval(syncTimer);
}

function initTrackWatcher() {
    console.log("🕵️ 背景換歌偵測器已啟動...");
    injectCustomLyricsButton();
    
    setInterval(() => {
        const hasOfficialLyrics = document.querySelector('[data-testid="fullscreen-lyric"]');
        if (hasOfficialLyrics) {
            clearCustomLyricsUI();
        }

        const newTrackInfo = getCurrentTrackInfo();
        
        if (newTrackInfo && newTrackInfo !== currentTrackInfo) {
            currentTrackInfo = newTrackInfo;
            
            if (syncTimer) clearInterval(syncTimer);
            
            const wrapper = document.getElementById('kamishiro-lyrics-wrapper');
            if (wrapper) wrapper.innerHTML = ''; 

            const btn = document.getElementById('kamishiro-lyric-toggle');
            if (btn) btn.style.display = 'none'; 

            if (hasOfficialLyrics) return; 

            console.log(`🎵 發現新歌曲！準備向後端討救兵: ${currentTrackInfo}`);
            
            fetch(`https://spotify-lyrics-api-e8a5.onrender.com/api/lyrics?q=${encodeURIComponent(currentTrackInfo)}`)
                .then(response => {
                    if (!response.ok) throw new Error('找不到歌詞');
                    return response.json();
                })
                .then(data => {
                    if (data.success && data.lyrics) {
                        if (!document.querySelector('[data-testid="fullscreen-lyric"]')) {
                            console.log("✅ 成功從後端取得 LRC！開始渲染！");
                            lyrics = parseLRC(data.lyrics);
                            renderLyricsUI(lyrics);
                            startSyncing();

                            if (btn) {
                                btn.style.display = 'block';
                                if (isCustomLyricsVisible) {
                                    btn.style.background = '#1db954';
                                    btn.style.color = '#ffffff';
                                }
                            }
                        }
                    }
                })
                .catch(err => {
                    console.log("❌ 後端回傳失敗或網路錯誤:", err.message);
                    const wrapper = document.getElementById('kamishiro-lyrics-wrapper');
                    if (wrapper) wrapper.style.display = 'none';
                    
                    if (isCustomLyricsVisible) {
                        isCustomLyricsVisible = false;
                        restoreSpotifyScroll();
                        console.log("🚀 [換歌防線] 偵測到沒歌詞，強制退場並還原高度。");
                    }

                    if (btn) {
                        btn.style.display = 'none';
                        btn.style.background = '#282828';
                        btn.style.color = '#b3b3b3';
                    }
                });
        }
    }, 1000);
}

initTrackWatcher();
initOutsideClickListener();