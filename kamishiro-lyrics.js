(function KamishiroLyrics() {
    if (!Spicetify.Player || !Spicetify.Platform) {
        setTimeout(KamishiroLyrics, 100);
        return;
    }
    
    console.log("🚀 Spicetify API 載入成功，神代歌詞桌面版啟動！");

    let lyrics = [];
    let lyricElements = [];
    let isCustomLyricsVisible = false;
    let lastSpotifyScrollPos = 0;
    let currentTrackInfo = null;

    try {
        if (Spicetify.Menu) {
            new Spicetify.Menu.Item("🎵 LRC 歌詞切換", isCustomLyricsVisible, (menuItem) => {
                toggleLyricsPanel();
                menuItem.setState(isCustomLyricsVisible);
            }).register();
        }
    } catch (e) {
        console.log("⚠️ 官方選單 API 不支援，單純使用浮動按鈕。");
    }

    function getCurrentTrackInfo() {
        const data = Spicetify?.Player?.data;
        if (!data) return null;

        let title = "";
        let artist = "";

        if (data.item && data.item.name) {
            title = data.item.name;
            artist = data.item.artists ? data.item.artists.map(a => a.name).join(', ') : "";
        } else if (data.track && data.track.metadata) {
            title = data.track.metadata.title;
            artist = data.track.metadata.artist_name;
        }
        
        if (!title || !artist) return null;
        return `${title}_${artist}`;
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

    // 💡 補回來的視覺魔法：抓取桌面版圖片並萃取顏色
    function applyDynamicTheme(container, textElements) {
        // 根據你截圖的線索，使用精準的 class 來抓取圖片
        const coverImg = document.querySelector('img.cover-art-image') || 
                         document.querySelector('.main-nowPlayingWidget-coverArt img');
                         
        if (!coverImg || !coverImg.src) {
            console.log("⚠️ 找不到封面圖片，維持預設深色");
            return;
        }

        const img = new Image();
        img.crossOrigin = 'Anonymous';
        // 如果是 Spotify 內部格式 (spotify:image:)，把它轉成網址，否則 Canvas 會報錯
        img.src = coverImg.src.startsWith('spotify:image:') 
            ? coverImg.src.replace('spotify:image:', 'https://i.scdn.co/image/') 
            : coverImg.src;

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

                // 根據背景明暗決定文字顏色
                const luminance = 0.299 * r + 0.587 * g + 0.114 * b;
                const activeColor = luminance > 140 ? '#121212' : '#ffffff';
                const inactiveColor = luminance > 140 ? 'rgba(0,0,0,0.45)' : 'rgba(255,255,255,0.35)';

                textElements.forEach(el => {
                    el.dataset.activeColor = activeColor;
                    el.dataset.inactiveColor = inactiveColor;
                    // 根據當下狀態套用
                    if (el.style.transform !== 'scale(1.02)') {
                        el.style.color = inactiveColor;
                    } else {
                        el.style.color = activeColor;
                    }
                });
            } catch (e) {
                console.log("🎨 Canvas 顏色提取失敗", e);
            }
        };
    }

    function getSpotifyScrollNode() {
        let markedNode = document.querySelector('[data-kamishiro-scroll="true"]');
        if (markedNode && document.body.contains(markedNode)) return markedNode;

        let curr = document.querySelector('main');
        while (curr && curr !== document.body) {
            if (curr.scrollTop > 0) {
                curr.setAttribute('data-kamishiro-scroll', 'true'); 
                return curr;
            }
            curr = curr.parentElement;
        }

        curr = document.querySelector('main');
        if (curr) {
            let fallback = curr.closest('.os-viewport') || curr.parentElement;
            if (fallback) {
                fallback.setAttribute('data-kamishiro-scroll', 'true');
                return fallback;
            }
        }
        return null;
    }

    function restoreSpotifyScroll() {
        const spotifyScrollNode = getSpotifyScrollNode();
        if (spotifyScrollNode) {
            spotifyScrollNode.style.overflowY = 'auto'; 
            spotifyScrollNode.scrollTop = lastSpotifyScrollPos; 
            spotifyScrollNode.removeAttribute('data-kamishiro-scroll'); 
        }
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
                scroll-behavior: smooth; padding-top: 20vh; padding-bottom: 40vh;
                background: linear-gradient(180deg, #121212 0%, #000000 100%); 
            `;
            targetContainer.appendChild(customWrapper);
        }
        customWrapper.innerHTML = ''; 
        customWrapper.style.display = isCustomLyricsVisible ? 'block' : 'none';

        const customLyricsContainer = document.createElement('div');
        customLyricsContainer.style.cssText = `
            display: flex; flex-direction: column; padding: 0 8vw; gap: 36px;
        `;

        lyricElements = []; 
        lyricsData.forEach((item) => {
            const lineElement = document.createElement('div');
            lineElement.innerText = item.text;
            lineElement.style.cssText = `
                font-size: 2.4rem; font-weight: 800; cursor: pointer; 
                transform-origin: left center; transition: all 0.3s ease;
                color: rgba(255,255,255,0.3); line-height: 1.5;
            `;
            
            lineElement.onclick = () => {
                Spicetify.Player.seek(item.time * 1000); 
            };

            customLyricsContainer.appendChild(lineElement);
            lyricElements.push(lineElement);
        });

        customWrapper.appendChild(customLyricsContainer);

        // 💡 呼叫主題色函數！讓背景活過來！
        applyDynamicTheme(customWrapper, lyricElements);

        setTimeout(() => {
            customWrapper.scrollTop = 0; 
            if (isCustomLyricsVisible) {
                const spotifyScrollNode = getSpotifyScrollNode();
                if (spotifyScrollNode) {
                    spotifyScrollNode.style.overflowY = 'hidden'; 
                    spotifyScrollNode.scrollTop = 0; 
                }
            }
        }, 50);
    }

    function toggleLyricsPanel() {
        const wrapper = document.getElementById('kamishiro-lyrics-wrapper');
        const btn = document.getElementById('kamishiro-lyric-toggle');
        if (!wrapper) return;

        isCustomLyricsVisible = !isCustomLyricsVisible;
        const spotifyScrollNode = getSpotifyScrollNode();

        if (isCustomLyricsVisible) {
            if (spotifyScrollNode) {
                lastSpotifyScrollPos = spotifyScrollNode.scrollTop;
                spotifyScrollNode.style.overflowY = 'hidden';
                spotifyScrollNode.scrollTop = 0; 
            }
            wrapper.style.display = 'block';
            if (btn) {
                btn.style.background = '#1db954'; 
                btn.style.color = '#ffffff';
            }
            syncLyricsPosition(Spicetify.Player.getProgress() / 1000);
        } else {
            wrapper.style.display = 'none';
            if (btn) {
                btn.style.background = '#282828';
                btn.style.color = '#b3b3b3';
            }
            restoreSpotifyScroll();
        }
    }

    function syncLyricsPosition(currentSeconds) {
        const wrapper = document.getElementById('kamishiro-lyrics-wrapper');
        if (!wrapper || lyrics.length === 0) return;

        if (currentSeconds <= 1) {
            wrapper.scrollTop = 0;
        }

        let newActiveIndex = -1;
        for (let i = 0; i < lyrics.length; i++) {
            if (currentSeconds >= lyrics[i].time) newActiveIndex = i;
            else break;
        }

        if (newActiveIndex !== -1 && newActiveIndex !== currentActiveIndex) {
            lyricElements.forEach((el, index) => {
                // 💡 讀取 applyDynamicTheme 存入的自適應顏色
                const activeColor = el.dataset.activeColor || '#ffffff';
                const inactiveColor = el.dataset.inactiveColor || 'rgba(255,255,255,0.3)';

                if (index === newActiveIndex) {
                    el.style.color = activeColor;
                    el.style.transform = 'scale(1.02)';
                    if (isCustomLyricsVisible) {
                        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
                    }
                } else {
                    el.style.color = inactiveColor;
                    el.style.transform = 'scale(1)';
                }
            });
            currentActiveIndex = newActiveIndex;
        }
    }

    function injectCustomLyricsButton() {
        if (document.getElementById('kamishiro-lyric-toggle')) return;

        customLyricsButton = document.createElement('button');
        customLyricsButton.id = 'kamishiro-lyric-toggle';
        customLyricsButton.innerText = '🎵 LRC';
        
        customLyricsButton.style.cssText = `
            position: fixed; right: 40px; bottom: 100px; z-index: 99999;
            background: #282828; color: #b3b3b3; border: none; border-radius: 25px;
            padding: 0 14px; height: 32px; font-weight: bold; cursor: pointer;
            box-shadow: 0 4px 12px rgba(0,0,0,0.5); transition: all 0.2s ease;
            display: none; font-size: 0.8rem;
        `;

        customLyricsButton.onclick = toggleLyricsPanel;
        document.body.appendChild(customLyricsButton);
    }

    document.addEventListener('click', (e) => {
        if (!isCustomLyricsVisible) return;
        const wrapper = document.getElementById('kamishiro-lyrics-wrapper');
        const btn = document.getElementById('kamishiro-lyric-toggle');
        const playerBar = document.querySelector('.main-nowPlayingBar-nowPlayingBar') || 
                          document.querySelector('[data-testid="now-playing-bar"]');

        const isClickInsideWrapper = wrapper && wrapper.contains(e.target);
        const isClickOnButton = btn && btn.contains(e.target);
        const isClickOnPlayerBar = playerBar && (playerBar.contains(e.target) || playerBar === e.target);

        if (!isClickInsideWrapper && !isClickOnButton && !isClickOnPlayerBar) {
            toggleLyricsPanel();
        }
    });

    function fetchAndRenderLyrics() {
        const newTrackInfo = getCurrentTrackInfo();
        if (!newTrackInfo) return; 
        if (newTrackInfo === currentTrackInfo) return;
        
        currentTrackInfo = newTrackInfo;
        currentActiveIndex = -1;

        const wrapper = document.getElementById('kamishiro-lyrics-wrapper');
        if (wrapper) {
            wrapper.innerHTML = '';
            wrapper.scrollTop = 0;
        }

        const btn = document.getElementById('kamishiro-lyric-toggle');
        if (btn) btn.style.display = 'none';

        fetch(`https://spotify-lyrics-api-e8a5.onrender.com/api/lyrics?q=${encodeURIComponent(currentTrackInfo)}`)
            .then(response => {
                if (!response.ok) throw new Error('找不到歌詞');
                return response.json();
            })
            .then(data => {
                if (data.success && data.lyrics) {
                    lyrics = parseLRC(data.lyrics);
                    renderLyricsUI(lyrics);

                    if (btn) {
                        btn.style.display = 'block';
                        if (isCustomLyricsVisible) {
                            btn.style.background = '#1db954';
                            btn.style.color = '#ffffff';
                        }
                    }
                }
            })
            .catch(err => {
                if (wrapper) wrapper.style.display = 'none';
                if (isCustomLyricsVisible) toggleLyricsPanel();
                if (btn) btn.style.display = 'none';
            });
    }

    function initSpicetifyListeners() {
        injectCustomLyricsButton();

        Spicetify.Player.addEventListener("onprogress", (event) => {
            const currentSeconds = event.data / 1000;
            syncLyricsPosition(currentSeconds);
        });

        Spicetify.Player.addEventListener("songchange", fetchAndRenderLyrics);

        fetchAndRenderLyrics();
    }

    initSpicetifyListeners();
})();