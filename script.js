const canvas = document.getElementById("particleCanvas");
const ctx = canvas.getContext("2d");
canvas.width = window.innerWidth;
canvas.height = window.innerHeight;
let particles = [];

let userProfile = {};
let currentQuestion = 0;
let username = "";
let selectedAnswerIdx = -1;
let gachaMode = "personality";
let activeAudios = [];
let pendingImgBase64 = null;
let pendingSoundBase64 = null;

// =============================================
// OPTIMIZATION: Debounce untuk smooth search
// =============================================
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

let cachedFilteredCharacters = [];
let cacheValid = false;
let currentSearchTerm = "";
let currentGenderFilter = "";
let currentTraitFilter = "";
const debouncedDisplayBrowse = debounce(() => {
    cacheValid = false;
    displayBrowseCharacters(1);
}, 300);

// Hentikan semua audio yang sedang berjalan
function stopAllAudio() {
    activeAudios.forEach(a => {
        try { a.pause(); a.currentTime = 0; } catch(e) {}
    });
    activeAudios = [];
}
let browseCurrentPage = 1;
const itemsPerPage = 12;

// Background custom dari localStorage
function loadCustomBackground() {
    const bg = localStorage.getItem('customBackground');
    if (bg) {
        document.body.style.backgroundImage = `url(${bg})`;
        document.body.style.backgroundSize = 'cover';
        document.body.style.backgroundPosition = 'center';
        document.body.style.backgroundAttachment = 'fixed';
    }
}

function saveCustomBackground(dataUrl) {
    localStorage.setItem('customBackground', dataUrl);
    document.body.style.backgroundImage = `url(${dataUrl})`;
    document.body.style.backgroundSize = 'cover';
    document.body.style.backgroundPosition = 'center';
    document.body.style.backgroundAttachment = 'fixed';
}

// =============================================
// FITUR PAMERAN 1: Reset nama otomatis setelah hasil
// FITUR PAMERAN 2: Tombol kembali yang jelas
// FITUR PAMERAN 3: Attract screen idle
// =============================================

// --- ATTRACT SCREEN (Layar Idle) ---
let idleTimer = null;
const IDLE_TIMEOUT = 20000; // 20 detik tidak ada aktivitas

function resetIdleTimer() {
    clearTimeout(idleTimer);
    idleTimer = setTimeout(showAttractScreen, IDLE_TIMEOUT);
}

function showAttractScreen() {
    // Hanya tampilkan jika sedang di halaman home (tidak di tengah quiz/gacha)
    const homeVisible = !document.getElementById('home').classList.contains('hidden');
    if (!homeVisible) {
        resetIdleTimer();
        return;
    }
    document.getElementById('attractScreen').classList.remove('hidden');
    startAttractAnimation();
}

function hideAttractScreen() {
    document.getElementById('attractScreen').classList.add('hidden');
    stopAttractAnimation();
    resetIdleTimer();
    // Fokus ke input nama
    const inp = document.getElementById('username');
    if (inp) { inp.focus(); inp.select(); }
}

let attractAnimFrame = null;
let attractFloatInterval = null;

function startAttractAnimation() {
    // Tampilkan beberapa foto karakter secara acak di attract screen
    const el = document.getElementById('attractChars');
    if (el && characters.length > 0) {
        el.innerHTML = '';
        const picks = [...characters].sort(() => Math.random() - 0.5).slice(0, 5);
        picks.forEach((c, i) => {
            const img = document.createElement('img');
            img.src = c.img;
            img.alt = c.name;
            img.className = 'attract-char-img';
            img.style.setProperty('--i', i);
            img.onerror = () => img.style.display = 'none';
            el.appendChild(img);
        });
    }
    // Update jumlah karakter
    const hint = document.querySelector('.attract-hint');
    if (hint) hint.textContent = `✦ Tersedia ${characters.length} karakter ✦`;
}

function stopAttractAnimation() {
    if (attractAnimFrame) { cancelAnimationFrame(attractAnimFrame); attractAnimFrame = null; }
    if (attractFloatInterval) { clearInterval(attractFloatInterval); attractFloatInterval = null; }
}

// Pasang event listener untuk reset idle timer
['click','keydown','mousemove','touchstart'].forEach(evt => {
    document.addEventListener(evt, () => {
        // Kalau attract screen tampil, klik = hide
        if (!document.getElementById('attractScreen').classList.contains('hidden')) {
            hideAttractScreen();
            return;
        }
        resetIdleTimer();
    }, { passive: true });
});

// --- FUNGSI RESET UNTUK ORANG BERIKUTNYA ---
function resetForNextPerson() {
    // Reset semua state
    username = "";
    userProfile = { brave: 0, smart: 0, gentle: 0, leader: 0, warm: 0, cautious: 0 };
    currentQuestion = 0;
    selectedAnswerIdx = -1;
    gachaMode = "personality";

    stopAllAudio(); // hentikan semua suara
    // Reset background ke awal
    document.body.classList.remove('bg-male', 'bg-female', 'bg-anomali');
    document.body.style.background = '';

    // Sembunyikan semua panel, tampilkan home
    ['quiz','result','gachaAnim','browsePanel','adminPanel'].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.classList.add('hidden');
    });
    document.getElementById('home').classList.remove('hidden');

    // Kosongkan input nama
    const inp = document.getElementById('username');
    if (inp) { inp.value = ''; inp.focus(); }

    // Reset pesan error
    const msg = document.getElementById('message');
    if (msg) msg.textContent = '';

    // Mulai timer idle lagi
    resetIdleTimer();

    // Scroll ke atas
    window.scrollTo({ top: 0, behavior: 'smooth' });
}


document.getElementById("adminBtn").addEventListener("click", openAdmin);


// Gacha lagi dengan nama yang sama (tidak perlu input ulang)
function replayGacha() {
    stopAllAudio(); // hentikan suara karakter sebelumnya
    userProfile = { brave: 0, smart: 0, gentle: 0, leader: 0, warm: 0, cautious: 0 };
    currentQuestion = 0;
    selectedAnswerIdx = -1;

    document.getElementById('result').classList.add('hidden');
    document.body.classList.remove('bg-male', 'bg-female', 'bg-anomali');
    document.body.style.background = '';

    // Kembali ke home dengan nama tetap terisi
    document.getElementById('home').classList.remove('hidden');
    resetIdleTimer();
    window.scrollTo({ top: 0, behavior: 'smooth' });
}

function openBrowse() {
    browseCurrentPage = 1; // Reset to first page
    document.getElementById("home").classList.add("hidden");
    document.getElementById("browsePanel").classList.remove("hidden");
    displayBrowseCharacters(1);
}

function closeBrowse() {
    document.getElementById("browsePanel").classList.add("hidden");
    document.getElementById("home").classList.remove("hidden");
}

function openTutorial() {
    document.getElementById("tutorialModal").classList.remove("hidden");
}

function closeTutorial() {
    document.getElementById("tutorialModal").classList.add("hidden");
}

function displayBrowseCharacters(page) {
    if (!page) page = browseCurrentPage;
    browseCurrentPage = page;

    const list = document.getElementById("browseCharacterList");
    const paginationEl = document.getElementById("pagination");
    list.innerHTML = "";

    const searchTerm = (document.getElementById("searchName")?.value || "").toLowerCase();
    const genderFilter = document.getElementById("filterGender")?.value || "";
    const traitFilter = document.getElementById("filterTrait")?.value || "";

    // OPTIMIZATION: Cache filtering results
    let filtered = cachedFilteredCharacters;
    if (!cacheValid || searchTerm !== currentSearchTerm || genderFilter !== currentGenderFilter || traitFilter !== currentTraitFilter) {
        currentSearchTerm = searchTerm;
        currentGenderFilter = genderFilter;
        currentTraitFilter = traitFilter;
        filtered = characters.filter(char => {
            if (!char || !char.name) return false;
            const matchesSearch = char.name.toLowerCase().includes(searchTerm) || (char.desc && char.desc.toLowerCase().includes(searchTerm));
            const matchesGender = !genderFilter || char.gender === genderFilter;
            const traits = characterTraits[char.name] || {};
            const matchesTrait = !traitFilter || (traits[traitFilter] && traits[traitFilter] > 0);
            return matchesSearch && matchesGender && matchesTrait;
        });
        cachedFilteredCharacters = filtered;
        cacheValid = true;
    }

    const totalPages = Math.max(1, Math.ceil(filtered.length / itemsPerPage));
    const start = (browseCurrentPage - 1) * itemsPerPage;
    const pageItems = filtered.slice(start, start + itemsPerPage);

    // render grid
    const grid = document.createElement('div');
    grid.className = 'browse-grid-container';

    pageItems.forEach(char => {
        const traits = characterTraits[char.name] || {};
        const traitText = Object.entries(traits).filter(([k, v]) => v > 0).map(([k, v]) => `${k}: ${v}`).join(', ') || 'N/A';

        const card = document.createElement('div');
        card.className = 'character-card';
        card.innerHTML = `
            <img src="${char.img}" alt="${char.name}" style="width:100%;aspect-ratio:1/1;object-fit:cover;" loading="lazy" onerror="this.style.display='none'">
            <div class="desc">
                <div class="name">${char.name}</div>
                <div class="gender ${char.gender}">${char.gender === 'male' ? '♂' : char.gender === 'anomali' ? '⚠' : '♀'}</div>
                <div class="short-desc">${char.desc || ''}</div>
            </div>
            <button class="view-btn" onclick="viewCharacter('${char.name}')">Lihat</button>
        `;

        grid.appendChild(card);
    });

    list.appendChild(grid);

    // pagination
    paginationEl.innerHTML = '';
    if (totalPages > 1) {
        const prev = document.createElement('button');
        prev.textContent = '‹';
        prev.disabled = browseCurrentPage <= 1;
        prev.onclick = () => displayBrowseCharacters(browseCurrentPage - 1);
        paginationEl.appendChild(prev);

        // Selalu tampil halaman 1
if (browseCurrentPage > 3) {
    const btn = document.createElement('button');
    btn.textContent = '1';
    btn.onclick = () => displayBrowseCharacters(1);
    paginationEl.appendChild(btn);
    if (browseCurrentPage > 4) {
        const dots = document.createElement('span');
        dots.textContent = '...';
        dots.style.padding = '0 6px';
        paginationEl.appendChild(dots);
    }
}

// Tampil 2 halaman sebelum dan sesudah halaman aktif
for (let i = Math.max(1, browseCurrentPage - 2); i <= Math.min(totalPages, browseCurrentPage + 2); i++) {
    const btn = document.createElement('button');
    btn.textContent = i;
    btn.className = (i === browseCurrentPage) ? 'active' : '';
    btn.onclick = () => displayBrowseCharacters(i);
    paginationEl.appendChild(btn);
}

// Selalu tampil halaman terakhir
if (browseCurrentPage < totalPages - 2) {
    if (browseCurrentPage < totalPages - 3) {
        const dots = document.createElement('span');
        dots.textContent = '...';
        dots.style.padding = '0 6px';
        paginationEl.appendChild(dots);
    }
    const btn = document.createElement('button');
    btn.textContent = totalPages;
    btn.onclick = () => displayBrowseCharacters(totalPages);
    paginationEl.appendChild(btn);
}
        const next = document.createElement('button');
        next.textContent = '›';
        next.disabled = browseCurrentPage >= totalPages;
        next.onclick = () => displayBrowseCharacters(browseCurrentPage + 1);
        paginationEl.appendChild(next);
    }
}
function filterEditSelect() {
    const keyword = (document.getElementById('editSearchInput')?.value || '').toLowerCase();
    const select = document.getElementById('editCharSelect');
    if (!select) return;
    select.innerHTML = '';
    if (!keyword) {
        select.innerHTML = '<option value="">Ketik nama di atas untuk mencari...</option>';
        return;
    }
    const filtered = characters.filter(c =>
        c.name.toLowerCase().includes(keyword)
    ).slice(0, 20);
    if (filtered.length === 0) {
        select.innerHTML = '<option value="">Tidak ditemukan...</option>';
        return;
    }
    filtered.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.name;
        opt.textContent = c.name;
        select.appendChild(opt);
    });
}
function filterCharacters() {
    // reuse displayBrowseCharacters with page reset
    displayBrowseCharacters(1);
}

function viewCharacter(name) {
    const char = characters.find(c => c.name === name);
    if (!char) return;

    const traits = characterTraits[name];
    const traitText = traits ? Object.entries(traits).filter(([k, v]) => v > 0).map(([k, v]) => `${k}: ${v}`).join(", ") : "N/A";

    document.getElementById("result").innerHTML = `
        <h2>Detail Karakter</h2>
        <div class="char-card fadeIn">
            <div class="char-card-top">
                <img src="${char.img}" alt="${char.name}">
                <div class="char-info">
                    <h1>${char.name}</h1>
                    <p><strong>Gender:</strong> ${char.gender === "male" ? "Laki-laki" : char.gender === "anomali" ? "Anomali" : "Perempuan"}</p>
                    <p><strong>Ciri-ciri:</strong> ${char.desc}</p>
                    <p><strong>Deskripsi:</strong> ${char.details}</p>
                    <p><strong>Trait:</strong> ${traitText}</p>
                </div>
            </div>
            <div class="char-card-bottom">
                <img src="${char.img}" alt="${char.name}">
                <p class="char-words">"${char.words}"</p>
            </div>
        </div>
        <button onclick="closeCharacterView()">← Kembali ke Jelajah</button>
    `;

    document.getElementById("browsePanel").classList.add("hidden");
    document.getElementById("result").classList.remove("hidden");
}

function closeCharacterView() {
    document.getElementById("result").classList.add("hidden");
    document.getElementById("browsePanel").classList.remove("hidden");
}

// Load karakter dari localStorage saat halaman muat
// On load: try to load external characters JSON (user-editable). If corrupted,
// fall back to bundled `characters_fixed.json`. Then load localStorage data.
window.addEventListener("load", async () => {
    loadCustomBackground(); // load background custom
    await loadExternalCharacters();
    loadCharactersFromStorage();
    loadNameMappingsFromStorage();
    resetIdleTimer();
});

async function loadExternalCharacters() {
    // Try primary characters.json first
    try {
        const res = await fetch('characters.json', { cache: 'no-store' });
        if (res.ok) {
            const data = await res.json();
            // FIX: characters.json memiliki struktur { characters: [], nameMapping: {} }
            const charArray = data.characters || data;
            if (Array.isArray(charArray) && charArray.length > 0 && charArray.some(c => c && c.name && c.img)) {
                // Replace runtime characters with external file
                characters = charArray.map(c => ({
                    name: c.name || '',
                    gender: c.gender || 'female',
                    img: c.img || '',
                    desc: c.desc || '',
                    details: c.details || '',
                    words: c.words || '',
                    sound: c.sound || ''
                }));

                // If traits provided in file, sync into characterTraits
                charArray.forEach(c => {
                    if (c && c.name && c.traits) characterTraits[c.name] = c.traits;
                });
                
                // Load nameMapping jika ada
                if (data.nameMapping) {
                    Object.assign(nameMapping, data.nameMapping);
                }
                
                console.log(`✅ Berhasil load ${characters.length} karakter dari characters.json`);
                return;
            }
        }
    } catch (e) {
        console.warn('Failed to load characters.json, will try fallback.', e);
    }

    // Fallback to characters_fixed.json if available
    try {
        const res2 = await fetch('characters_fixed.json', { cache: 'no-store' });
        if (res2.ok) {
            const data2 = await res2.json();
            const charArray2 = data2.characters || data2;
            if (Array.isArray(charArray2) && charArray2.length > 0) {
                characters = charArray2.map(c => ({
                    name: c.name || '',
                    gender: c.gender || 'female',
                    img: c.img || '',
                    desc: c.desc || '',
                    details: c.details || '',
                    words: c.words || '',
                    sound: c.sound || ''
                }));
                charArray2.forEach(c => {
                    if (c && c.name && c.traits) characterTraits[c.name] = c.traits;
                });
                if (data2.nameMapping) {
                    Object.assign(nameMapping, data2.nameMapping);
                }
                console.log(`✅ Berhasil load ${characters.length} karakter dari characters_fixed.json`);
                return;
            }
        }
    } catch (e) {
        console.warn('Failed to load characters_fixed.json fallback.', e);
    }

    // If both attempts fail, keep built-in `characters` defined later in file.
    console.warn('⚠️ Tidak ada file karakter eksternal, gunakan built-in characters');
    
    // Add built-in HSR characters
    if (builtInCharacters && builtInCharacters.length > 0) {
        characters = builtInCharacters.map(c => ({
            name: c.name || '',
            gender: c.gender || 'female',
            img: c.img || '',
            desc: c.desc || '',
            details: c.details || '',
            words: c.words || '',
            sound: c.sound || ''
        }));
        builtInCharacters.forEach(c => {
            if (c && c.name && c.traits) characterTraits[c.name] = c.traits;
        });
        console.log(`✅ Berhasil load ${characters.length} karakter built-in dari Honkai Star Rail`);
    }
}

function startRandomGacha(mode) {
    username = document.getElementById("username").value;
    const messageEl = document.getElementById('message');
    if (!username) {
        if (messageEl) messageEl.textContent = 'Isi nama dulu ya!';
        else alert('Isi nama dulu ya!');
        return;
    }
    if (messageEl) messageEl.textContent = '';

    // allow caller to set mode (compatibility/personality/random)
    gachaMode = mode || 'random';
    document.getElementById("home").classList.add("hidden");
    startGachaAnimation();
}

function startQuiz(mode) {
    username = document.getElementById("username").value;
    if (!username) {
        alert("Isi nama dulu ya!");
        return;
    }

    gachaMode = mode;
    document.getElementById("home").classList.add("hidden");
    document.getElementById("quiz").classList.remove("hidden");
    currentQuestion = 0;
    userProfile = { brave: 0, smart: 0, gentle: 0, leader: 0, warm: 0, cautious: 0 };
    selectedAnswerIdx = -1;

    displayQuestion();
}

function displayQuestion() {
    const quizContent = document.getElementById("quizContent");
    const q = quizQuestions[currentQuestion];
    const modeTitle = gachaMode === "personality" ? "🔍 Kamu Mirip Siapa?" : "💕 Pasangan Mu?";

    let html = `
        <div class="quiz-mode-title">${modeTitle}</div>
        <div class="quiz-progress">Pertanyaan ${currentQuestion + 1} dari ${quizQuestions.length}</div>
        <div class="quiz-question large">
            <div class="quiz-question-header">
                <h3>${q.question}</h3>
                <div class="quiz-progress-bar"><div class="quiz-progress-fill" style="width:${Math.round(((currentQuestion)/quizQuestions.length)*100)}%"></div></div>
            </div>
            <div class="quiz-options">
    `;

    q.answers.forEach((answer, idx) => {
        // use button-like div for larger clickable area
        html += `<button class="quiz-option" onclick="selectAnswer(${idx})" aria-pressed="false">${answer.text}</button>`;
    });

    html += `
            </div>
        </div>
        <div class="quiz-button-group">
            <button onclick="previousQuestion()" ${currentQuestion === 0 ? 'disabled' : ''}>← Sebelumnya</button>
            <button onclick="nextQuestion()" id="nextBtn">Selanjutnya →</button>
        </div>
    `;

    quizContent.innerHTML = html;
}

function selectAnswer(idx) {
    selectedAnswerIdx = idx;
    document.querySelectorAll(".quiz-option").forEach((el, i) => {
        const pressed = i === idx;
        el.classList.toggle("selected", pressed);
        el.setAttribute('aria-pressed', pressed ? 'true' : 'false');
    });
}

function nextQuestion() {
    if (selectedAnswerIdx === -1) {
        alert("Pilih jawaban dulu!");
        return;
    }

    const answer = quizQuestions[currentQuestion].answers[selectedAnswerIdx];
    Object.keys(answer.traits).forEach(trait => {
        userProfile[trait] += answer.traits[trait];
    });

    selectedAnswerIdx = -1;
    currentQuestion++;

    if (currentQuestion < quizQuestions.length) {
        displayQuestion();
    } else {
        startGachaAnimation();
    }
}

// previousQuestion - moved to top-level so UI can call it
function previousQuestion() {
    if (currentQuestion > 0) {
        currentQuestion--;
        selectedAnswerIdx = -1;
        displayQuestion();
    }
}

// startGachaAnimation - moved to top-level
function startGachaAnimation() {
    stopAllAudio(); // hentikan suara karakter sebelumnya
    new Audio('gacha.mp3').play();

    document.getElementById("quiz").classList.add("hidden");

    // Inject animasi gacha baru yang keren ke dalam gachaAnim
    const gachaBox = document.getElementById("gachaAnim");
    gachaBox.innerHTML = `
    <div class="card-flip-wrapper">
        <div class="card-flip" id="cardFlip">
            <div class="card-front">
                <div class="card-front-pattern">✦</div>
                <div class="card-front-text">?</div>
            </div>
            <div class="card-back" id="cardBack">
    <div class="card-back-shine"></div>
    <div class="card-back-text">?</div>
    <div id="cardCharImg" style="display:none;width:100%;height:100%;position:absolute;inset:0;border-radius:14px;overflow:hidden;z-index:10;">
        <img id="cardCharImgEl" style="width:100%;height:100%;object-fit:cover;" src="" alt="">
    </div>
</div>
        </div>
    </div>
    <p class="gacha-loading-title" id="gachaText">Memutar gacha...</p>
    <div class="gacha-steps">
        <div class="gacha-step active" id="step1">🔍 Membaca kepribadian</div>
        <div class="gacha-step" id="step2">⚡ Mencocokkan karakter</div>
        <div class="gacha-step" id="step3">✨ Siap ditampilkan!</div>
    </div>
    <div class="gacha-progress-track"><div class="gacha-progress-fill-anim" id="gachaProgressFill"></div></div>
`;
gachaBox.classList.remove("hidden");
gachaBox.style.display = "flex";
    gachaBox.classList.remove("hidden");
    gachaBox.style.display = "flex"; 

    // Munculkan spark partikel kecil
    const sparksEl = document.getElementById('gachaSparks');
    for (let i = 0; i < 12; i++) {
        
    }

    // Animasi step-step loading
    const steps = ['step1','step2','step3'];
    let stepIdx = 0;
    const stepInterval = setInterval(() => {
        if (stepIdx > 0) document.getElementById(steps[stepIdx-1])?.classList.remove('active');
        if (stepIdx < steps.length) {
            document.getElementById(steps[stepIdx])?.classList.add('active');
            stepIdx++;
        }
    }, 600);

    // Progress bar
    let prog = 0;
    const progFill = document.getElementById('gachaProgressFill');
    const progInterval = setInterval(() => {
        prog = Math.min(100, prog + Math.random() * 18 + 4);
        if (progFill) progFill.style.width = prog + '%';
        if (prog >= 100) clearInterval(progInterval);
    }, 120);

    setTimeout(() => {
    clearInterval(stepInterval);
    
    let resultObj = findBestCharacter();
    let char = resultObj.character;
    
    const cardImg = document.getElementById('cardCharImg');
    const cardImgEl = document.getElementById('cardCharImgEl');
    const cardFlip = document.getElementById('cardFlip');
    
    if (cardImgEl && char) {
        cardImgEl.src = char.img;
        cardImg.style.display = 'block';
    }
    if (cardFlip) {
        cardFlip.classList.add('stopped');
    }
    
    rollCharacter(username, resultObj);
    
}, 3000);
}

// rollCharacter - moved to top-level
function rollCharacter(username, resultObj) {
    const result = document.getElementById("result");
    const gacha = document.getElementById("gachaAnim");

    let char = resultObj.character;
    // Catat statistik gacha
const statsRaw = localStorage.getItem('gachaStats');
const gachaStats = statsRaw ? JSON.parse(statsRaw) : {};
gachaStats[char.name] = (gachaStats[char.name] || 0) + 1;
localStorage.setItem('gachaStats', JSON.stringify(gachaStats));

    // === FIX #3: Background Dinamis (tidak butuh file gambar) ===
    // male → biru langit | female → pink muda | anomali → gelap
    document.body.classList.remove('bg-male', 'bg-female', 'bg-anomali');
    document.body.style.background = ''; // reset ke CSS default (sky.jpg)
    if (char.gender === 'male') {
        document.body.classList.add('bg-male');
    } else if (char.gender === 'anomali') {
        document.body.classList.add('bg-anomali');
    } else {
        document.body.classList.add('bg-female');
    }

    // === FIX #4: Suara diputar otomatis - mendukung file path & base64 ===
    function safePlay(src) {
        if (!src) return;
        try {
            const audio = new Audio(src);
            audio.volume = 0.8;
            activeAudios.push(audio); // daftarkan agar bisa dihentikan nanti
            const p = audio.play();
            if (p) p.catch(() => {
                const btn = document.createElement('button');
                btn.textContent = '🔊 Putar Suara Karakter';
                btn.style.cssText = 'margin:10px auto;display:block;padding:8px 20px;background:rgba(245,200,66,0.2);border:1px solid #f5c842;border-radius:20px;color:#ffe77a;font-weight:700;cursor:pointer;';
                btn.onclick = () => { audio.play(); btn.remove(); };
                document.getElementById('result').appendChild(btn);
            });
        } catch(e) { console.warn('Gagal memutar suara:', e); }
    }

    if (char.gender === "anomali") {
        const anomalyAudio = new Audio("sounds/anomali.mp3");
        anomalyAudio.loop = true;
        activeAudios.push(anomalyAudio); // track agar bisa dihentikan
        anomalyAudio.play().catch(() => {});
    } else {
        if (char.sound) safePlay(char.sound);
    }

    // Play backsound khusus Robin dan Astra Yao
    if (char.name === "Robin") safePlay("sounds/robin_sound.mp3");
    if (char.name === "Astra Yao") safePlay("sounds/astra_yao_sound.mp3");

    createParticles(char.gender);
    animateParticles();

    // Gimmick untuk karakter anomali
    if (char.gender === "anomali") {
        // Shake effect
        document.body.classList.add("shake");
        setTimeout(() => {
            document.body.classList.remove("shake");
        }, 500);

        // Show error message
        const errorMsg = document.getElementById("errorMessage");
        errorMsg.style.display = "block";
        setTimeout(() => {
            errorMsg.style.display = "none";
        }, 2000);
    }

    // Show short reveal message in gacha area before revealing full result
    const revealMsg = (gachaMode === 'personality' && resultObj.similarity != null)
        ? `Selamat! Kamu mirip dengan ${char.name} — ${resultObj.similarity}%!`
        : (gachaMode === 'compatibility' && resultObj.compatibility != null)
            ? `Selamat! Kamu cocok dengan ${char.name} — ${resultObj.compatibility}%!`
            : `Selamat! Kamu mendapatkan ${char.name}!`;

    const gachaTextEl = document.getElementById('gachaText');
    if (gachaTextEl) {
        gachaTextEl.textContent = revealMsg;
        gachaTextEl.classList.add('reveal-animate');
    }

    // wait briefly so player can read the reveal message
    setTimeout(() => {
        if (gachaTextEl) gachaTextEl.classList.remove('reveal-animate');

        // burst confetti then reveal
        createParticles('confetti');
        animateParticles();

        gacha.classList.add("hidden");
        result.classList.remove("hidden");

        // populate result HTML after reveal
        renderResultHTML();
    }, 1200);

    // helper to inject result markup (moved out so we can delay showing it)
    function renderResultHTML() {
        // Badge persentase
        let badgeHtml = '';
        let pct = null;
        if (gachaMode === 'personality' && resultObj.similarity != null) {
            pct = resultObj.similarity;
            badgeHtml = `<div id="percentages" class="result-badge similarity-badge" style="opacity:0">
                <span class="badge-icon">🔍</span>
                <span class="badge-label">Kemiripan</span>
                <span class="badge-value">${pct}%</span>
                <div class="badge-bar"><div class="badge-bar-fill" style="width:${pct}%"></div></div>
            </div>`;
        } else if (gachaMode === 'compatibility' && resultObj.compatibility != null) {
            pct = resultObj.compatibility;
            badgeHtml = `<div id="percentages" class="result-badge compat-badge" style="opacity:0">
                <span class="badge-icon">💕</span>
                <span class="badge-label">Kecocokan</span>
                <span class="badge-value">${pct}%</span>
                <div class="badge-bar"><div class="badge-bar-fill" style="width:${pct}%"></div></div>
            </div>`;
        } else {
            badgeHtml = `<div id="percentages" class="result-badge random-badge" style="opacity:0">
                <span class="badge-icon">🎲</span>
                <span class="badge-label">Gacha Acak</span>
            </div>`;
        }

        // Gender label
        const genderLabel = char.gender === 'male' ? '♂ Laki-laki' : char.gender === 'anomali' ? '⚠ Anomali' : '♀ Perempuan';
        const genderClass = char.gender === 'male' ? 'gender-male' : char.gender === 'anomali' ? 'gender-anomali' : 'gender-female';

        result.innerHTML = `
        <div class="result-header fadeIn">
            <div class="result-greeting">✦ Hai, <span class="result-username">${username}</span>!</div>
            <div class="result-subtitle">Karakter yang cocok untukmu adalah...</div>
        </div>

        <div class="result-card fadeIn">
            <!-- Foto + overlay nama -->
            <div class="result-img-wrap">
                <img src="${char.img}" alt="${char.name}" class="result-img" onerror="this.style.background='#e0e7ef'">
                <div class="result-img-overlay">
                    <div class="result-char-name">${char.name}</div>
                    <div class="result-gender-tag ${genderClass}">${genderLabel}</div>
                </div>
            </div>

            <!-- Info panel -->
            <div class="result-info">
                <div class="result-section" id="desc" style="opacity:0;transform:translateY(10px)">
                    <div class="result-section-title">⚡ Ciri-ciri</div>
                    <div class="result-section-body">${char.desc}</div>
                </div>

                <div class="result-section" id="traits" style="opacity:0;transform:translateY(10px)">
                    <div class="result-section-title">📖 Deskripsi</div>
                    <div class="result-section-body">${char.details}</div>
                </div>

                ${badgeHtml}
            </div>
        </div>

        <!-- Kata-kata khas -->
        <div class="result-words-wrap" id="words" style="opacity:0;transform:translateY(8px)">
            <div class="result-words-avatar">
                <img src="${char.img}" alt="${char.name}" onerror="this.style.display='none'">
            </div>
            <div class="result-words-bubble">
                <div class="result-words-text">"${char.words}"</div>
                <div class="result-words-name">— ${char.name}</div>
            </div>
        </div>

        <div class="result-action-row">
            <button class="result-retry-btn" onclick="resetForNextPerson()">👤 Orang Berikutnya</button>
            <button class="result-retry2-btn" onclick="replayGacha()">🎲 Gacha Lagi (Nama Sama)</button>
        </div>
    `;

        const soundEffect = new Audio("sounds/pop.mp3");
        function revealEl(id, delay) {
            setTimeout(() => {
                const el = document.getElementById(id);
                if (!el) return;
                el.style.transition = 'opacity 0.5s ease, transform 0.5s ease';
                el.style.opacity = 1;
                el.style.transform = 'translateY(0)';
                soundEffect.cloneNode().play().catch(()=>{});
            }, delay);
        }
        revealEl('desc', 300);
        revealEl('traits', 700);
        revealEl('percentages', 1100);
        revealEl('words', 1500);
    }

}

// Simple particle helpers (safe no-op fallback if original implementation missing)
function createParticles(kind) {
    particles = [];
    if (kind === 'confetti') {
        const colors = ['#FF5252', '#FFCA28', '#4CAF50', '#2196F3', '#AB47BC', '#FF7043'];
        const count = 80;
        for (let i = 0; i < count; i++) {
            particles.push({
                x: canvas.width / 2 + (Math.random() - 0.5) * 120,
                y: canvas.height / 2 + (Math.random() - 0.5) * 40,
                vx: (Math.random() - 0.5) * 8,
                vy: -2 - Math.random() * 6,
                size: 6 + Math.random() * 8,
                color: colors[Math.floor(Math.random() * colors.length)],
                shape: 'rect',
                life: 120 + Math.random() * 60
            });
        }
        return;
    }

    // default celebratory particles influenced by gender
    const gender = kind || 'female';
    const count = 40;
    for (let i = 0; i < count; i++) {
        particles.push({
            x: Math.random() * canvas.width,
            y: Math.random() * canvas.height,
            vx: (Math.random() - 0.5) * 6,
            vy: (Math.random() - 0.5) * 6,
            size: 2 + Math.random() * 6,
            color: gender === 'male' ? 'rgba(33,150,243,0.85)' : gender === 'anomali' ? 'rgba(0,0,0,0.9)' : 'rgba(255,105,180,0.85)',
            shape: 'circle',
            life: 80 + Math.random() * 60
        });
    }
}

function animateParticles() {
    if (!canvas || !ctx) return;
    let rafId = null;
    function step() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        for (let i = particles.length - 1; i >= 0; i--) {
            const p = particles[i];
            p.x += p.vx; p.y += p.vy;
            p.vy += 0.12; // gravity
            p.life = (p.life || 100) - 1;
            if (p.shape === 'rect') {
                ctx.fillStyle = p.color;
                ctx.fillRect(p.x, p.y, Math.max(2, p.size), Math.max(2, p.size * 0.6));
            } else {
                ctx.beginPath();
                ctx.fillStyle = p.color;
                ctx.arc(p.x, p.y, Math.max(0.5, p.size), 0, Math.PI * 2);
                ctx.fill();
            }
            // fade/cleanup
            if (p.life <= 0 || p.y > canvas.height + 50) particles.splice(i, 1);
        }
        if (particles.length === 0) {
            if (rafId) cancelAnimationFrame(rafId);
            return;
        }
        rafId = requestAnimationFrame(step);
    }
    step();
}

// findBestCharacter - moved to top-level
function findBestCharacter() {
    const lowerUsername = username.toLowerCase();
    if (nameMapping[lowerUsername]) {
        const mappedChar = characters.find(c => c.name === nameMapping[lowerUsername]);
        if (mappedChar) return { character: mappedChar, similarity: 100, compatibility: 100 };
    }

    // ✅ Pindahkan random mode ke SINI, sebelum forEach
    if (gachaMode === 'random') {
        const randomIndex = Math.floor(Math.random() * characters.length);
        return {
            character: characters[randomIndex],
            similarity: null,
            compatibility: null
        };
    }

    // Sisanya tetap sama (personality/compatibility)
    // ... dst

    // Build max possible user trait totals from quiz definition so we can normalize
    const traitKeys = ['brave', 'smart', 'gentle', 'leader', 'warm', 'cautious'];
    const maxPossible = {};
    traitKeys.forEach(t => maxPossible[t] = 0);
    quizQuestions.forEach(q => {
        q.answers.forEach(a => {
            traitKeys.forEach(t => {
                if (a.traits && a.traits[t]) maxPossible[t] += a.traits[t];
            });
        });
    });

    // Helper to compute normalized user trait (0..1)
    const userNorm = {};
    traitKeys.forEach(t => {
        const raw = userProfile[t] || 0;
        const max = maxPossible[t] || 1;
        userNorm[t] = Math.min(1, raw / max);
    });

    let bestMatch = null;
    let bestScore = -Infinity;
    let bestSimPerc = 0;
    let bestCompPerc = 0;

    characters.forEach(char => {
        const traits = characterTraits[char.name] || {};

        // SESUDAH (benar):
if (gachaMode === 'random') {
    const randomIndex = Math.floor(Math.random() * characters.length);
    return {
        character: characters[randomIndex],
        similarity: null,
        compatibility: null
    };
}

        // similarity: average of per-trait product (userNorm * charNorm)
        let simSum = 0;
        let simCount = 0;
        traitKeys.forEach(t => {
            const charNorm = (traits[t] || 0) / 3; // char trait in 0..3
            // only consider trait if character has non-zero or quiz allowed user to have it
            if ((traits[t] || 0) > 0 || (maxPossible[t] || 0) > 0) {
                simSum += (userNorm[t] || 0) * charNorm;
                simCount++;
            }
        });
        const similarityPerc = simCount ? (simSum / simCount) * 100 : 0;

        // compatibility: average of complement distance: 1 - |userNorm - charNorm|
        let compSum = 0;
        let compCount = 0;
        traitKeys.forEach(t => {
            const charNorm = (traits[t] || 0) / 3;
            if ((traits[t] || 0) > 0 || (maxPossible[t] || 0) > 0) {
                compSum += 1 - Math.abs((userNorm[t] || 0) - charNorm);
                compCount++;
            }
        });
        const compatibilityPerc = compCount ? (compSum / compCount) * 100 : 0;

        // Choose best based on selected mode
        const score = (gachaMode === 'personality') ? similarityPerc : compatibilityPerc;
        // add slight randomness to break ties
        const finalScore = score + Math.random() * 3;
        if (finalScore > bestScore) {
            bestScore = finalScore;
            bestMatch = char;
            bestSimPerc = Math.round(similarityPerc);
            bestCompPerc = Math.round(compatibilityPerc);
        }
    });

    return {
        character: bestMatch,
        similarity: bestSimPerc,
        compatibility: bestCompPerc
    };
}

// Characters loaded from characters.json via loadExternalCharacters()
let characters = [];
const characterTraits = {};
const nameMapping = {};

// All character data is loaded from characters.json at runtime
// See loadExternalCharacters() function for details

const quizQuestions = [
    {
        question: "Ketika ada masalah besar, kamu cenderung...",
        answers: [
            { text: "Menghadapinya dengan berani", traits: { brave: 2 } },
            { text: "Berpikir strategis dulu", traits: { smart: 2 } },
            { text: "Mencari bantuan teman", traits: { warm: 2 } },
            { text: "Menunggu dan melihat situasi", traits: { cautious: 2 } },
            { text: "Memimpin dan ambil kendali", traits: { leader: 2 } }
        ]
    },
    {
        question: "Dalam kelompok, peran kamu biasanya...",
        answers: [
            { text: "Pemimpin yang inisiatif", traits: { leader: 2 } },
            { text: "Anggota setia pendukung", traits: { warm: 2 } },
            { text: "Pemikir yang analitis", traits: { smart: 2 } },
            { text: "Penjaga yang berhati-hati", traits: { cautious: 2 } },
            { text: "Pemberani garis depan", traits: { brave: 2 } }
        ]
    },
    {
        question: "Ketika berhadapan dengan ketidakadilan...",
        answers: [
            { text: "Langsung melawan keras", traits: { brave: 2 } },
            { text: "Cari solusi bijaksana", traits: { smart: 2 } },
            { text: "Merasa sangat tersentuh", traits: { gentle: 2 } },
            { text: "Tunggu waktu yang tepat", traits: { cautious: 2 } },
            { text: "Gerakkan orang lain", traits: { leader: 2 } }
        ]
    },
    {
        question: "Bagaimana kamu mengatasi stres?",
        answers: [
            { text: "Hadapi secara langsung", traits: { brave: 2 } },
            { text: "Cari cara yang logis", traits: { smart: 2 } },
            { text: "Bersama orang terkasih", traits: { warm: 2 } },
            { text: "Berdiam diri merenung", traits: { cautious: 2 } },
            { text: "Lakukan sesuatu produktif", traits: { leader: 2 } }
        ]
    },
    {
        question: "Dalam situasi darurat, kamu...",
        answers: [
            { text: "Ambil tanggung jawab", traits: { leader: 2 } },
            { text: "Berpikir jernih dan cepat", traits: { smart: 2 } },
            { text: "Dukung orang lain", traits: { gentle: 2 } },
            { text: "Ikuti arahan dengan hati-hati", traits: { cautious: 2 } },
            { text: "Terjun langsung tanpa pikir", traits: { brave: 2 } }
        ]
    },
    {
        question: "Apa yang paling kamu hargai dalam hidup?",
        answers: [
            { text: "Keberanian dan tantangan", traits: { brave: 2 } },
            { text: "Pengetahuan dan pemahaman", traits: { smart: 2 } },
            { text: "Cinta dan kehangatan", traits: { warm: 2 } },
            { text: "Kedamaian dan keamanan", traits: { cautious: 2 } },
            { text: "Pengaruh dan kepemimpinan", traits: { leader: 2 } }
        ]
    },
    {
        question: "Teman-teman menggambarkanmu sebagai...",
        answers: [
            { text: "Pemberani dan nekat", traits: { brave: 2 } },
            { text: "Cerdas dan analitis", traits: { smart: 2 } },
            { text: "Lembut dan perhatian", traits: { gentle: 2 } },
            { text: "Hangat dan ramah", traits: { warm: 2 } },
            { text: "Tegas dan berwibawa", traits: { leader: 2 } }
        ]
    },
    {
        question: "Saat menghadapi keputusan sulit...",
        answers: [
            { text: "Ikuti insting saja", traits: { brave: 2 } },
            { text: "Analisa semua opsi", traits: { smart: 2 } },
            { text: "Tanya pendapat orang lain", traits: { gentle: 2 } },
            { text: "Pertimbangkan risikonya", traits: { cautious: 2 } },
            { text: "Putuskan dengan tegas", traits: { leader: 2 } }
        ]
    },
    {
        question: "Gaya hidupmu yang ideal adalah...",
        answers: [
            { text: "Penuh petualangan dan aksi", traits: { brave: 2 } },
            { text: "Terstruktur dan terukur", traits: { smart: 2 } },
            { text: "Tenang dan menyenangkan", traits: { warm: 2 } },
            { text: "Aman dan terhindar konflik", traits: { cautious: 2 } },
            { text: "Memimpin dan berpengaruh", traits: { leader: 2 } }
        ]
    },
    {
        question: "Kamu lebih suka...",
        answers: [
            { text: "Olahraga ekstrem", traits: { brave: 2 } },
            { text: "Membaca dan belajar", traits: { smart: 2 } },
            { text: "Merawat orang lain", traits: { gentle: 2 } },
            { text: "Berkumpul bersama teman", traits: { warm: 2 } },
            { text: "Memimpin sebuah proyek", traits: { leader: 2 } }
        ]
    },
    {
        question: "Ketika bertemu orang baru...",
        answers: [
            { text: "Langsung akrab dan berani", traits: { brave: 2 } },
            { text: "Amati dulu sebelum bicara", traits: { smart: 2 } },
            { text: "Dengarkan mereka baik-baik", traits: { gentle: 2 } },
            { text: "Ramah dan hangat", traits: { warm: 2 } },
            { text: "Ambil inisiatif kenalan", traits: { leader: 2 } }
        ]
    },
    {
        question: "Kekuatan terbesar kamu adalah...",
        answers: [
            { text: "Keberanian tanpa batas", traits: { brave: 2 } },
            { text: "Kecerdasan dan logika", traits: { smart: 2 } },
            { text: "Empati yang dalam", traits: { gentle: 2 } },
            { text: "Kehati-hatian dan ketelitian", traits: { cautious: 2 } },
            { text: "Kemampuan memimpin", traits: { leader: 2 } }
        ]
    },
    {
        question: "Saat timmu gagal, kamu...",
        answers: [
            { text: "Bangkit dan coba lagi", traits: { brave: 2 } },
            { text: "Analisa apa yang salah", traits: { smart: 2 } },
            { text: "Hibur anggota tim", traits: { gentle: 2 } },
            { text: "Evaluasi dan berhati-hati", traits: { cautious: 2 } },
            { text: "Motivasi tim untuk maju", traits: { leader: 2 } }
        ]
    },
    {
        question: "Menurutmu, pahlawan sejati adalah...",
        answers: [
            { text: "Yang berani tanpa takut", traits: { brave: 2 } },
            { text: "Yang paling cerdas", traits: { smart: 2 } },
            { text: "Yang paling penyayang", traits: { gentle: 2 } },
            { text: "Yang bijaksana dan hati-hati", traits: { cautious: 2 } },
            { text: "Yang memimpin dengan baik", traits: { leader: 2 } }
        ]
    },
    {
        question: "Apa motivasi terbesarmu?",
        answers: [
            { text: "Membuktikan diri", traits: { brave: 2 } },
            { text: "Mencari kebenaran", traits: { smart: 2 } },
            { text: "Menjaga orang tersayang", traits: { gentle: 2 } },
            { text: "Menciptakan kedamaian", traits: { cautious: 2 } },
            { text: "Membuat perubahan besar", traits: { leader: 2 } }
        ]
    }
];

// ============ QUIZ QUESTIONS ARRAY ============


// ============ ADMIN FUNCTIONS & UI MANAGEMENT ============

function openAdmin() {
    document.getElementById("home").classList.add("hidden");
    document.getElementById("adminPanel").classList.remove("hidden");
    switchAdminTab('add');
    refreshCharacterList();
    populateCharacterSelect();
}

function closeAdmin() {
    document.getElementById("adminPanel").classList.add("hidden");
    document.getElementById("home").classList.remove("hidden");
}

// ============ ADMIN PANEL FUNCTIONS ============

function addCharacter() {
    const name = document.getElementById("charName").value.trim();
    // Update preview real-time
function updateCharPreview() {
    const box = document.getElementById('charPreviewBox');
    if (!box) return;
    const name = document.getElementById('charName')?.value || '';
    const desc = document.getElementById('charDesc')?.value || '';
    const img = pendingImgBase64 || document.getElementById('charImgFallback')?.value || '';
    const gender = document.getElementById('charGender')?.value || '';
    const genderIcon = gender === 'male' ? '♂' : gender === 'anomali' ? '⚠' : '♀';
    const genderColor = gender === 'male' ? '#2563eb' : gender === 'anomali' ? '#d97706' : '#db2777';

    box.innerHTML = `
        ${img ? `<img src="${img}" style="width:100px;height:100px;object-fit:cover;border-radius:50%;border:3px solid var(--blue);margin-bottom:12px;">` : '<div style="width:100px;height:100px;border-radius:50%;background:var(--border);margin:0 auto 12px;display:flex;align-items:center;justify-content:center;font-size:2em;">👤</div>'}
        <div style="font-family:Cinzel,serif;font-size:1.1em;font-weight:900;color:var(--text-primary);">${name || 'Nama Karakter'}</div>
        <div style="color:${genderColor};font-size:0.85em;font-weight:700;margin:4px 0;">${genderIcon} ${gender || '-'}</div>
        <div style="color:var(--text-muted);font-size:0.85em;margin-top:8px;">${desc || 'Deskripsi singkat...'}</div>
    `;
}
    if (!name) {
        alert("Isi nama karakter!");
        return;
    }
    alert("Karakter ditambahkan!");
}

function deleteCharacter() {
    alert("Karakter dihapus!");
}

// Remaining admin functions placeholder
// All functionality will load from characters.json
// End of script file

// =============================================
// FIX #1 & #2: Upload foto & suara → Base64
// File tersimpan di localStorage, tidak butuh server
// =============================================

// Konversi foto ke Base64 dan tampilkan preview
function convertImageToBase64(input) {
    const file = input.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
        alert('Gambar terlalu besar! Maksimal 2MB.\nKompres dulu di: squoosh.app');
        input.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const base64 = e.target.result;
        pendingImgBase64 = base64;

        // Tampilkan preview gambar
        const preview = document.getElementById('imgPreview');
        if (preview) {
            preview.innerHTML = `
                <img src="${base64}" alt="preview"
                    style="max-width:120px;max-height:120px;border-radius:8px;
                           border:2px solid #f5c842;margin-top:6px;display:block;">
                <small style="color:#86efac;font-size:0.75em;">✓ Foto berhasil dimuat (${(file.size/1024).toFixed(0)}KB)</small>
            `;
        }
    };
    reader.readAsDataURL(file);
}

// Konversi suara ke Base64 dan tampilkan preview player
function convertSoundToBase64(input) {
    const file = input.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
        alert('Audio terlalu besar! Maksimal 5MB.\nPotong/kompres dulu menggunakan Audacity.');
        input.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        const base64 = e.target.result;
        pendingSoundBase64 = base64;

        // Tampilkan audio player preview
        const preview = document.getElementById('soundPreview');
        if (preview) {
            preview.innerHTML = `
                <audio controls style="width:100%;margin-top:6px;">
                    <source src="${base64}">
                </audio>
                <small style="color:#86efac;font-size:0.75em;">✓ Audio berhasil dimuat (${(file.size/1024).toFixed(0)}KB)</small>
            `;
        }
    };
    reader.readAsDataURL(file);
}

// === Upload Handlers: konversi file → Base64, simpan ke pendingImgBase64/pendingSoundBase64 ===
function convertImageToBase64(input) {
    const file = input.files[0];
    if (!file) return;

    if (file.size > 2 * 1024 * 1024) {
        alert('Gambar terlalu besar! Maksimal 2MB.\nKompres dulu di: squoosh.app');
        input.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        pendingImgBase64 = e.target.result; // set global variable
        // Tampilkan preview foto
        const previewImg = document.getElementById('imgPreview');
        if (previewImg) {
            previewImg.src = pendingImgBase64;
            previewImg.style.display = 'block';
        }
        const lbl = document.getElementById('imgUploadLabel');
        if (lbl) lbl.textContent = `✅ ${file.name} (${(file.size/1024).toFixed(0)}KB)`;
    };
    reader.readAsDataURL(file);
}

function convertSoundToBase64(input) {
    const file = input.files[0];
    if (!file) return;

    if (file.size > 5 * 1024 * 1024) {
        alert('Audio terlalu besar! Maksimal 5MB.');
        input.value = '';
        return;
    }

    const reader = new FileReader();
    reader.onload = function(e) {
        pendingSoundBase64 = e.target.result; // set global variable
        const lbl = document.getElementById('soundUploadLabel');
        if (lbl) lbl.textContent = `✅ ${file.name} (${(file.size/1024).toFixed(0)}KB)`;
    };
    reader.readAsDataURL(file);
}

function addCharacter() {
    const name = document.getElementById("charName").value.trim();
    const gender = document.getElementById("charGender").value;
    // Gunakan Base64 hasil upload, atau path fallback yang diketik
    const _fallbackImg = (document.getElementById("charImgFallback") || {value:""}).value.trim();
    let img = pendingImgBase64 || _fallbackImg;
    const _fallbackSound = (document.getElementById("charSoundFallback") || {value:""}).value.trim();
    let sound = pendingSoundBase64 || _fallbackSound;
    const desc = document.getElementById("charDesc").value.trim();
    const details = document.getElementById("charDetails").value.trim();
    const words = document.getElementById("charWords").value.trim();

    if (!name || !gender || !img || !sound || !desc || !details || !words) {
        alert("Isi semua field ya!");
        return;
    }

    // Auto-prepend folder paths (skip jika base64 atau path sudah ada)
    if (img && !img.startsWith("images/") && !img.startsWith("data:") && !img.startsWith("http")) {
        img = "images/" + img;
    }
    if (sound && !sound.startsWith("sounds/") && !sound.startsWith("data:") && !sound.startsWith("http")) {
        sound = "sounds/" + sound;
    }

    const traits = {
        brave: parseInt(document.getElementById("traitBrave").value) || 0,
        smart: parseInt(document.getElementById("traitSmart").value) || 0,
        gentle: parseInt(document.getElementById("traitGentle").value) || 0,
        leader: parseInt(document.getElementById("traitLeader").value) || 0,
        warm: parseInt(document.getElementById("traitWarm").value) || 0,
        cautious: parseInt(document.getElementById("traitCautious").value) || 0
    };

    if (editingCharName) {
        // Update existing character
        const charIndex = characters.findIndex(c => c.name === editingCharName);
        if (charIndex !== -1) {
            characters[charIndex] = { name, gender, img, sound, desc, details, words };
            characterTraits[name] = traits;

            // Update localStorage
            let stored = localStorage.getItem("customCharacters");
            const customChars = stored ? JSON.parse(stored) : [];
            const customIndex = customChars.findIndex(c => c.name === editingCharName);
            if (customIndex !== -1) {
                customChars[customIndex] = { name, gender, img, sound, desc, details, words };
                localStorage.setItem("customCharacters", JSON.stringify(customChars));
            }

            // Update traits
            let storedTraits = localStorage.getItem("customTraits");
            const customTraits = storedTraits ? JSON.parse(storedTraits) : {};
            delete customTraits[editingCharName];
            customTraits[name] = traits;
            localStorage.setItem("customTraits", JSON.stringify(customTraits));

            alert(`Karakter ${name} berhasil diupdate!`);
        }
        editingCharName = null;
    } else {
        // Cek duplicate
        if (characters.some(c => c.name === name)) {
            alert("Karakter dengan nama ini sudah ada!");
            return;
        }

        const newChar = { name, gender, img, sound, desc, details, words };

        // Tambah ke array
        characters.push(newChar);
        characterTraits[name] = traits;

        // Simpan ke localStorage
        let stored = localStorage.getItem("customCharacters");
        const customChars = stored ? JSON.parse(stored) : [];
        customChars.push(newChar);
        localStorage.setItem("customCharacters", JSON.stringify(customChars));

        // Simpan traits
        let storedTraits = localStorage.getItem("customTraits");
        const customTraits = storedTraits ? JSON.parse(storedTraits) : {};
        customTraits[name] = traits;
        localStorage.setItem("customTraits", JSON.stringify(customTraits));

        alert(`Karakter ${name} berhasil ditambahkan!`);
    }

    resetForm();
    refreshCharacterList();
}

function deleteCharacter(name) {
    if (!confirm(`Hapus karakter ${name}?`)) return;

    // Cek apakah karakter custom
    let stored = localStorage.getItem("customCharacters");
    const customChars = stored ? JSON.parse(stored) : [];
    const isCustom = customChars.some(c => c.name === name);

    if (!isCustom) {
        alert("Karakter default tidak bisa dihapus!");
        return;
    }

    // Hapus dari array
    characters = characters.filter(c => c.name !== name);
    delete characterTraits[name];

    // Update localStorage
    const updated = customChars.filter(c => c.name !== name);
    localStorage.setItem("customCharacters", JSON.stringify(updated));

    let storedTraits = localStorage.getItem("customTraits");
    const customTraits = storedTraits ? JSON.parse(storedTraits) : {};
    delete customTraits[name];
    localStorage.setItem("customTraits", JSON.stringify(customTraits));

    refreshCharacterList();
}

function resetForm() {
    // Reset semua input teks
    const textFields = ["charName","charDesc","charDetails","charWords"];
    textFields.forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });

    const selFields = ["charGender"];
    selFields.forEach(id => { const el = document.getElementById(id); if (el) el.value = ""; });

    // Reset trait inputs ke 0
    ["traitBrave","traitSmart","traitGentle","traitLeader","traitWarm","traitCautious"].forEach(id => {
        const el = document.getElementById(id); if (el) el.value = "0";
    });

    // Reset Base64 upload (Perbaikan 1 & 3)
    pendingImgBase64 = null;
    pendingSoundBase64 = null;

    // Reset file input
    const imgInput = document.getElementById("imgFileInput");
    if (imgInput) imgInput.value = "";
    const soundInput = document.getElementById("soundFileInput");
    if (soundInput) soundInput.value = "";

    // Reset label tombol upload
    const imgLabel = document.getElementById("imgUploadLabel");
    if (imgLabel) imgLabel.textContent = "📷 Pilih Foto Karakter";
    const soundLabel = document.getElementById("soundUploadLabel");
    if (soundLabel) soundLabel.textContent = "🔊 Pilih File Suara";

    // Sembunyikan preview gambar
    const preview = document.getElementById("imgPreview");
    if (preview) { preview.src = ""; preview.style.display = "none"; }

    // Reset fallback path (untuk karakter bawaan yg punya path file)
    const fallbackImg = document.getElementById("charImgFallback");
    if (fallbackImg) fallbackImg.value = "";
    const fallbackSound = document.getElementById("charSoundFallback");
    if (fallbackSound) fallbackSound.value = "";

    // Reset tombol ke mode tambah
    const addBtn = document.getElementById("addCharBtn");
    if (addBtn) addBtn.textContent = "Tambah Karakter";
    editingCharName = null;

    // Reset mapping fields
    const mapName = document.getElementById("mapName");
    if (mapName) mapName.value = "";
    const mapChar = document.getElementById("mapCharacter");
    if (mapChar) mapChar.value = "";
}

let editingCharName = null;

function refreshCharacterList() {
    const list = document.getElementById("characterList");
    if (!list) return;
    list.innerHTML = "";
    
    const stored = localStorage.getItem("customCharacters");
    const customChars = stored ? JSON.parse(stored) : [];
    
    // Hanya tampilkan 30 karakter pertama di admin
    const limitedChars = characters.slice(0, 30);
    
    limitedChars.forEach(char => {
        const isCustom = customChars.some(c => c.name === char.name);
        const div = document.createElement('div');
        div.className = 'char-item';
        div.innerHTML = `
            <div class="info">
                <div class="name">${char.name}</div>
                <div class="gender">${char.gender}</div>
            </div>
            <div class="char-actions">
                <button onclick="editCharacter('${char.name}')">Edit</button>
                <button onclick="deleteCharacter('${char.name}')">Hapus</button>
            </div>
        `;
        list.appendChild(div);
    });
}
    const stored = localStorage.getItem("customCharacters");
    const customChars = stored ? JSON.parse(stored) : [];

    characters.forEach(char => {
        const traits = characterTraits[char.name];
        const isCustom = customChars.some(c => c.name === char.name);
        const displayName = stripCharacterPrefix(char.name);

        const traitText = traits ? Object.entries(traits).map(([k, v]) => `${k}: ${v}`).join(", ") : "N/A";

        list.innerHTML += `
            <div class="char-item">
                <div class="info">
                    <div class="name">${displayName}</div>
                    <div class="gender">${char.gender === "male" ? "♂ Laki-laki" : char.gender === "anomali" ? "⚠ Anomali" : "♀ Perempuan"}</div>
                    <small style="color: #999;">${traitText}</small>
                </div>
                <div class="char-actions">
                    <button class="char-item-btn ${isCustom ? "" : "disabled"}" onclick="loadCharacterForEdit()" ${!isCustom ? "disabled" : ""}>Edit</button>
                    <button class="char-item-btn ${isCustom ? "" : "disabled"}" onclick="deleteCharacter('${char.name}')" ${!isCustom ? "disabled" : ""}>Hapus</button>
                </div>
            </div>
    `;
    });


function editCharacter(name) {
    const char = characters.find(c => c.name === name);
    if (!char) return;

    editingCharName = name;

    document.getElementById("charName").value = char.name;
    document.getElementById("charGender").value = char.gender;
    // Tampilkan gambar lama di preview saat edit
    const _imgFallback = document.getElementById("charImgFallback");
    if (_imgFallback) _imgFallback.value = char.img || "";
    if (char.img) {
        const _prev = document.getElementById("imgPreview");
        if (_prev) { _prev.src = char.img; _prev.style.display = "block"; }
        const _lbl = document.getElementById("imgUploadLabel");
        if (_lbl) _lbl.textContent = "✅ Foto sudah ada (upload baru untuk ganti)";
    }
    // Tampilkan info suara lama saat edit
    const _soundFallback = document.getElementById("charSoundFallback");
    if (_soundFallback) _soundFallback.value = char.sound || "";
    if (char.sound) {
        const _slbl = document.getElementById("soundUploadLabel");
        if (_slbl) _slbl.textContent = "✅ Suara sudah ada (upload baru untuk ganti)";
    }
    document.getElementById("charDesc").value = char.desc;
    document.getElementById("charDetails").value = char.details;
    document.getElementById("charWords").value = char.words;



    const traits = characterTraits[name] || {};
    document.getElementById("traitBrave").value = traits.brave || 0;
    document.getElementById("traitSmart").value = traits.smart || 0;
    document.getElementById("traitGentle").value = traits.gentle || 0;
    document.getElementById("traitLeader").value = traits.leader || 0;
    document.getElementById("traitWarm").value = traits.warm || 0;
    document.getElementById("traitCautious").value = traits.cautious || 0;

    document.getElementById("addCharBtn").textContent = "Update Karakter";
}

window.addEventListener('resize', () => {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
});

// --- Persistence & Admin helpers ---
function loadCharactersFromStorage() {
    try {
        const stored = localStorage.getItem('customCharacters');
        if (stored) {
            const customChars = JSON.parse(stored);
            // merge without duplicating names
            customChars.forEach(c => {
                if (!characters.some(ch => ch.name === c.name)) characters.push(c);
            });
        }

        const storedTraits = localStorage.getItem('customTraits');
        if (storedTraits) {
            const customTraits = JSON.parse(storedTraits);
            Object.assign(characterTraits, customTraits);
        }
    } catch (e) {
        console.error('Gagal memuat karakter dari storage', e);
    }
}

function loadNameMappingsFromStorage() {
    try {
        const stored = localStorage.getItem('nameMapping');
        if (stored) {
            const mappings = JSON.parse(stored);
            Object.assign(nameMapping, mappings);
        }
    } catch (e) {
        console.error('Gagal memuat mapping nama', e);
    }
}

// Helper: Strip kategori prefix dari nama karakter (ML-Yve → yve, ZZZ-Ellen → ellen, etc)
function stripCharacterPrefix(name) {
    const prefixes = ['ML-', 'ZZZ-', 'Anime-', 'R1999-', 'R1999-', 'HSR-', 'WW-', 'Reverse-'];
    let stripped = name;
    for (const prefix of prefixes) {
        if (name.toLowerCase().startsWith(prefix.toLowerCase())) {
            stripped = name.substring(prefix.length);
            break;
        }
    }
    return stripped.charAt(0).toUpperCase() + stripped.slice(1).toLowerCase();
}

function switchAdminTab(tab) {
    document.querySelectorAll('#adminPanel .nav-btn').forEach(btn => btn.classList.remove('active'));
    let navId = 'nav';
    if (tab === 'add') navId += 'Add';
    else if (tab === 'edit') navId += 'Edit';
    else if (tab === 'mappings') navId += 'Mappings';
    else if (tab === 'stats') navId += 'Stats';
    else if (tab === 'import') navId += 'Import';
    else if (tab === 'background') navId += 'Background';
    document.getElementById(navId).classList.add('active');

    const form = document.getElementById('adminForm');
    const list = document.getElementById('adminList');
    form.innerHTML = '';
    list.innerHTML = '';

    if (tab === 'add') {
        // PERBAIKAN 1 & 3: Form dengan upload foto & suara pakai Base64
        // File dikonversi ke Base64 → disimpan di localStorage → tidak perlu server
        form.innerHTML = `
            <h3>➕ Tambah Karakter Baru</h3>
            <div class="form-section-inner">
                <input id="charName" placeholder="✦ Nama karakter" oninput="updateCharPreview()">
                <select id="charGender" onchange="updateCharPreview()">
                    <option value="">Pilih gender</option>
                    <option value="male">♂ Laki-laki</option>
                    <option value="female">♀ Perempuan</option>
                    <option value="anomali">⚠ Anomali</option>
                </select>

                <!-- UPLOAD FOTO — diklik, konversi jadi Base64, tidak perlu folder images/ -->
                <div class="upload-group">
                    <div class="upload-btn-row">
                        <button type="button" class="upload-file-btn" onclick="document.getElementById('imgFileInput').click()">
                            <span id="imgUploadLabel">📷 Pilih Foto Karakter</span>
                        </button>
                        <img id="imgPreview" style="display:none;width:64px;height:64px;object-fit:cover;border-radius:8px;border:2px solid var(--gold);" alt="preview">
                    </div>
                    <input type="file" id="imgFileInput" accept="image/*" style="display:none" onchange="convertImageToBase64(this)">
                    <small class="upload-hint">Max 2MB · PNG / JPG / GIF · Disimpan otomatis di browser</small>
                    <input id="charImgFallback" class="path-fallback" placeholder="Atau path lama: images/nama.png">
                </div>

                <!-- UPLOAD SUARA — diklik, konversi jadi Base64, tidak perlu folder sounds/ -->
                <div class="upload-group">
                    <button type="button" class="upload-file-btn" onclick="document.getElementById('soundFileInput').click()">
                        <span id="soundUploadLabel">🔊 Pilih File Suara</span>
                    </button>
                    <input type="file" id="soundFileInput" accept="audio/*" style="display:none" onchange="convertSoundToBase64(this)">
                    <small class="upload-hint">Max 5MB · MP3 / OGG / WAV · Disimpan otomatis di browser</small>
                    <input id="charSoundFallback" class="path-fallback" placeholder="Atau path lama: sounds/nama.mp3">
                </div>

                <input id="charDesc" placeholder="Deskripsi singkat karakter" oninput="updateCharPreview()">
                <textarea id="charDetails" placeholder="Deskripsi lengkap karakter..."></textarea>
                <input id="charWords" placeholder="Kata-kata khas karakter">
                <div class="traits-form">
                    <label>⚔️ Brave <input id="traitBrave" type="number" min="0" max="3" value="0"></label>
                    <label>🧠 Smart <input id="traitSmart" type="number" min="0" max="3" value="0"></label>
                    <label>🌸 Gentle <input id="traitGentle" type="number" min="0" max="3" value="0"></label>
                    <label>👑 Leader <input id="traitLeader" type="number" min="0" max="3" value="0"></label>
                    <label>🔥 Warm <input id="traitWarm" type="number" min="0" max="3" value="0"></label>
                    <label>🛡️ Cautious <input id="traitCautious" type="number" min="0" max="3" value="0"></label>
                </div>
                <div class="form-action-row">
                    <button id="addCharBtn" onclick="addCharacter()">✦ Tambah Karakter</button>
                    <button onclick="resetForm()">🔄 Reset</button>
                </div>
            </div>
        `;

        // render list karakter
        list.innerHTML = `
    <div style="padding:20px;">
        <h3 style="font-family:'Cinzel',serif;color:var(--blue);margin-bottom:16px;">👁️ Preview</h3>
        <div id="charPreviewBox" style="background:var(--bg-section);border:1.5px solid var(--border);border-radius:12px;padding:20px;text-align:center;">
            <div style="color:var(--text-muted);font-size:0.9em;">Isi form di kiri untuk melihat preview karakter</div>
        </div>
    </div>
`;
   } else if (tab === 'edit') {
    form.innerHTML = `
        <h3>✏️ Edit Karakter</h3>
        <div class="form-section-inner">
            <input id="editSearchInput" placeholder="🔍 Ketik nama karakter..." 
                oninput="filterEditSelect()" style="margin-bottom:8px;">
            <select id="editCharSelect" onchange="loadCharacterForEdit()" 
                size="5" style="margin-bottom:15px;width:100%;border-radius:8px;padding:6px;">
                <option value="">Ketik nama di atas untuk mencari...</option>
            </select>
            <div id="editForm" style="display:none;">
                <input id="editCharName" placeholder="✦ Nama karakter" readonly>
                <select id="editCharGender">
                    <option value="male">♂ Laki-laki</option>
                    <option value="female">♀ Perempuan</option>
                    <option value="anomali">⚠ Anomali</option>
                </select>
                <input id="editCharDesc" placeholder="Deskripsi singkat">
                <textarea id="editCharDetails" placeholder="Deskripsi lengkap..."></textarea>
                <input id="editCharWords" placeholder="Kata-kata khas">
                <div class="traits-form">
                    <label>⚔️ Brave <input id="editTraitBrave" type="number" min="0" max="3" value="0"></label>
                    <label>🧠 Smart <input id="editTraitSmart" type="number" min="0" max="3" value="0"></label>
                    <label>🌸 Gentle <input id="editTraitGentle" type="number" min="0" max="3" value="0"></label>
                    <label>👑 Leader <input id="editTraitLeader" type="number" min="0" max="3" value="0"></label>
                    <label>🔥 Warm <input id="editTraitWarm" type="number" min="0" max="3" value="0"></label>
                    <label>🛡️ Cautious <input id="editTraitCautious" type="number" min="0" max="3" value="0"></label>
                </div>
                <div class="form-action-row">
                    <button onclick="saveEditedCharacter()">💾 Simpan Perubahan</button>
                    <button onclick="deleteCharacter()">🗑️ Hapus Karakter</button>
                </div>
            </div>
        </div>
    `;
    list.innerHTML = '';
    } else if (tab === 'mappings') {
        form.innerHTML = `
            <h3>🔗 Mapping Nama ke Karakter</h3>
            <div style="flex:1;position:relative;">
            <input id="mapCharSearch" placeholder="🔍 Cari karakter..." 
                style="width:100%;box-sizing:border-box;"
                oninput="filterMapCharSearch()">
            <select id="mapCharacter" size="5" 
                style="width:100%;border-radius:8px;padding:6px;margin-top:4px;">
                <option value="">Ketik nama di atas...</option>
            </select>
        </div>
    </div>
    <button onclick="addNameMapping()">✓ Simpan Mapping</button>
`;

        list.innerHTML = '<h3>Daftar Mapping</h3><div id="mappingList"></div>';
        populateCharacterSelect();
        refreshNameMappingList();
    } else if (tab === 'stats') {
        list.innerHTML = '<h3>Statistik Singkat</h3><div id="statsContent"></div>';
        renderStats();
    } else if (tab === 'background') {
        // Background custom upload
        form.innerHTML = `
            <h3>🖼️ Ubah Background Halaman</h3>
            <div class="upload-group">
                <p style="color:var(--text-secondary);font-size:0.9em;margin-bottom:10px;">Upload gambar untuk background halaman utama</p>
                <button type="button" class="upload-file-btn" onclick="document.getElementById('bgFileInput').click()">
                    📷 Pilih Gambar Background
                </button>
                <input type="file" id="bgFileInput" accept="image/*" style="display:none" onchange="uploadBackground(this)">
                <small class="upload-hint">Max 5MB · PNG / JPG · Direkomendasikan 1920x1080px atau lebih</small>
                <p style="color:var(--text-muted);font-size:0.85em;margin-top:10px;" id="bgMessage"></p>
            </div>
            <div style="margin-top:20px;">
                <button onclick="resetBackground()" style="background:rgba(239,68,68,0.2);border-color:#ef4444;color:#fca5a5;">🔄 Reset ke Background Bawaan</button>
            </div>
        `;
    } else if (tab === 'import') {
        // PERBAIKAN 2 & 5: Backup/Restore database karakter
        // Export → download file JSON sebagai backup
        // Import → restore dari file JSON (data + foto Base64 + suara Base64)
        form.innerHTML = `
            <h3>💾 Backup & Restore Data</h3>

            <div class="import-section">
                <h4>📤 Export (Backup)</h4>
                <p style="color:var(--text-secondary);font-size:0.9em;margin-bottom:10px;">
                    Download semua karakter custom, foto (Base64), suara (Base64), dan mapping ke file JSON.
                    Simpan file ini sebagai cadangan!
                </p>
                <button onclick="exportJSON()">💾 Download Backup JSON</button>
            </div>

            <div class="import-section" style="margin-top:20px">
                <h4>📥 Import (Restore)</h4>
                <p style="color:var(--text-secondary);font-size:0.9em;margin-bottom:10px;">
                    Pilih file backup JSON untuk memulihkan data karakter.
                </p>
                <button type="button" class="upload-file-btn" onclick="document.getElementById('importFileInput').click()">
                    📁 Pilih File JSON
                </button>
                <input type="file" id="importFileInput" accept=".json" style="display:none" onchange="importFromFile(this)">
                <p style="color:var(--text-muted);font-size:0.8em;margin:8px 0;">— atau paste JSON manual —</p>
                <textarea id="importJson" style="width:100%;height:120px;background:rgba(0,0,0,0.3);color:var(--text-primary);border:1px solid var(--glass-border);border-radius:8px;padding:10px;" placeholder="Paste isi file JSON di sini..."></textarea>
                <div style="margin-top:10px"><button onclick="importJSON()">📥 Import dari Teks</button></div>
            </div>

            <div class="import-section" style="margin-top:20px">
                <h4>⚠️ Reset Data</h4>
                <p style="color:var(--text-secondary);font-size:0.9em;margin-bottom:10px;">
                    Hapus semua karakter custom dan mapping. Karakter bawaan tidak terpengaruh.
                </p>
                <button onclick="resetAllCustomData()" style="background:rgba(239,68,68,0.2);border-color:#ef4444;color:#fca5a5;">🗑️ Reset Data Custom</button>
            </div>
        `;
    }
}

// Background upload handler
function uploadBackground(input) {
    const file = input.files[0];
    if (!file) return;
    
    // Check file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
        const msg = document.getElementById('bgMessage');
        if (msg) msg.textContent = '❌ Ukuran file terlalu besar (max 5MB)';
        return;
    }
    
    const reader = new FileReader();
    reader.onload = (e) => {
        const dataUrl = e.target.result;
        saveCustomBackground(dataUrl);
        const msg = document.getElementById('bgMessage');
        if (msg) msg.textContent = '✅ Background berhasil diubah! Refresh halaman untuk melihat perubahan.';
        input.value = '';
    };
    reader.readAsDataURL(file);
}

function resetBackground() {
    localStorage.removeItem('customBackground');
    document.body.style.backgroundImage = '';
    const msg = document.getElementById('bgMessage');
    if (msg) msg.textContent = '✅ Background direset ke bawaan. Refresh halaman.';
}

function populateCharacterSelect() {
    const sel = document.getElementById('mapCharacter');
    if (!sel) return;
    sel.innerHTML = '<option value="">Pilih karakter...</option>';
    characters.forEach(ch => {
        const opt = document.createElement('option');
        opt.value = ch.name;
        opt.textContent = stripCharacterPrefix(ch.name);
        sel.appendChild(opt);
    });
}

function updateCharacterPreview() {
    const sel = document.getElementById('mapCharacter');
    const preview = document.getElementById('charPreview');
    if (!sel || !sel.value) {
        if (preview) preview.style.display = 'none';
        return;
    }
    const char = characters.find(c => c.name === sel.value);
    if (!char) return;
    if (preview) preview.style.display = 'block';
    const img = document.getElementById('previewImg');
    const name = document.getElementById('previewName');
    const desc = document.getElementById('previewDesc');
    if (img) img.src = char.img;
    if (name) name.textContent = stripCharacterPrefix(char.name);
    if (desc) desc.textContent = char.desc || '';
}
function filterMapCharSearch() {
    const keyword = (document.getElementById('mapCharSearch')?.value || '').toLowerCase();
    const select = document.getElementById('mapCharacter');
    if (!select) return;
    select.innerHTML = '';
    
    const filtered = characters.filter(c => 
        c.name.toLowerCase().includes(keyword)
    ).slice(0, 20);
    
    if (filtered.length === 0) {
        select.innerHTML = '<option value="">Tidak ditemukan...</option>';
        return;
    }
    
    filtered.forEach(c => {
        const opt = document.createElement('option');
        opt.value = c.name;
        opt.textContent = stripCharacterPrefix(c.name);
        select.appendChild(opt);
    });
}
 // ← ini sudah ada, jangan dihapus
function refreshNameMappingList() {
    const container = document.getElementById('mappingList') || document.getElementById('adminList');
    if (!container) return;
    const listEl = document.getElementById('mappingList') || container;
    listEl.innerHTML = '';
    const keys = Object.keys(nameMapping).sort();
    if (keys.length === 0) {
        listEl.innerHTML = '<p>Tidak ada mapping tersimpan.</p>';
        return;
    }
    keys.forEach(k => {
        const div = document.createElement('div');
        div.className = 'mapping-item';
        const charName = stripCharacterPrefix(nameMapping[k]);
        div.innerHTML = `<div class="info"><div class="name">${k}</div><div class="character">${charName}</div></div><div class="mapping-actions"><button onclick="deleteNameMapping('${k}')">Hapus</button></div>`;
        listEl.appendChild(div);
    });
}

function addNameMapping() {
    const name = (document.getElementById('mapName')?.value || '').trim().toLowerCase();
    const character = document.getElementById('mapCharacter')?.value || '';
    if (!name || !character) { alert('Isi nama dan pilih karakter.'); return; }
    nameMapping[name] = character;
    localStorage.setItem('nameMapping', JSON.stringify(nameMapping));
    refreshNameMappingList();
    alert('Mapping tersimpan.');
}

function deleteNameMapping(name) {
    if (!confirm(`Hapus mapping untuk ${name}?`)) return;
    delete nameMapping[name];
    localStorage.setItem('nameMapping', JSON.stringify(nameMapping));
    refreshNameMappingList();
}

function loadCharacterForEdit() {
    const select = document.getElementById('editCharSelect');
    const form = document.getElementById('editForm');
    if (!select.value) {
        if (form) form.style.display = 'none';
        return;
    }
    const char = characters.find(c => c.name === select.value);
    if (!char) return;
    if (form) form.style.display = 'block';
    if (document.getElementById('editCharName')) document.getElementById('editCharName').value = select.value;
    if (document.getElementById('editCharGender')) document.getElementById('editCharGender').value = char.gender || 'male';
    if (document.getElementById('editCharDesc')) document.getElementById('editCharDesc').value = char.desc || '';
    if (document.getElementById('editCharDetails')) document.getElementById('editCharDetails').value = char.details || '';
    if (document.getElementById('editCharWords')) document.getElementById('editCharWords').value = char.words || '';
    if (document.getElementById('editTraitBrave')) document.getElementById('editTraitBrave').value = char.traits?.brave || 0;
    if (document.getElementById('editTraitSmart')) document.getElementById('editTraitSmart').value = char.traits?.smart || 0;
    if (document.getElementById('editTraitGentle')) document.getElementById('editTraitGentle').value = char.traits?.gentle || 0;
    if (document.getElementById('editTraitLeader')) document.getElementById('editTraitLeader').value = char.traits?.leader || 0;
    if (document.getElementById('editTraitWarm')) document.getElementById('editTraitWarm').value = char.traits?.warm || 0;
    if (document.getElementById('editTraitCautious')) document.getElementById('editTraitCautious').value = char.traits?.cautious || 0;
}

function saveEditedCharacter() {
    const charName = document.getElementById('editCharName')?.value || '';
    if (!charName) { alert('Pilih karakter dulu'); return; }
    const charIdx = characters.findIndex(c => c.name === charName);
    if (charIdx === -1) { alert('Karakter tidak ditemukan'); return; }
    
    characters[charIdx].gender = document.getElementById('editCharGender')?.value || 'male';
    characters[charIdx].desc = document.getElementById('editCharDesc')?.value || '';
    characters[charIdx].details = document.getElementById('editCharDetails')?.value || '';
    characters[charIdx].words = document.getElementById('editCharWords')?.value || '';
    characters[charIdx].traits = {
        brave: parseInt(document.getElementById('editTraitBrave')?.value || 0),
        smart: parseInt(document.getElementById('editTraitSmart')?.value || 0),
        gentle: parseInt(document.getElementById('editTraitGentle')?.value || 0),
        leader: parseInt(document.getElementById('editTraitLeader')?.value || 0),
        warm: parseInt(document.getElementById('editTraitWarm')?.value || 0),
        cautious: parseInt(document.getElementById('editTraitCautious')?.value || 0)
    };
    
  const customOnly = characters.filter(c => {
    const stored = JSON.parse(localStorage.getItem('customCharacters') || '[]');
    return stored.some(sc => sc.name === c.name);
});
    localStorage.setItem('customCharacters', JSON.stringify(customOnly));
    alert('Karakter berhasil diperbarui!');
    document.getElementById('editCharSelect').value = '';
    document.getElementById('editForm').style.display = 'none';
    switchAdminTab('edit');
}

function deleteCharacter() {
    const charName = document.getElementById('editCharName')?.value || '';
    if (!charName || !confirm(`Hapus karakter ${stripCharacterPrefix(charName)}?`)) return;
    const charIdx = characters.findIndex(c => c.name === charName);
    if (charIdx === -1) return;
    characters.splice(charIdx, 1);
    localStorage.setItem('characters', JSON.stringify(characters));
    alert('Karakter berhasil dihapus!');
    document.getElementById('editCharSelect').value = '';
    document.getElementById('editForm').style.display = 'none';
    switchAdminTab('edit');
}

function exportJSON() {
    const payload = {
        characters: characters,
        characterTraits: characterTraits,
        nameMapping: nameMapping
    };
    const dataStr = JSON.stringify(payload, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'gamegacha_export.json';
    a.click();
    URL.revokeObjectURL(url);
}

function importJSON() {
    const txt = document.getElementById('importJson')?.value;
    if (!txt) { alert('Paste JSON dulu.'); return; }
    try {
        const obj = JSON.parse(txt);
        if (Array.isArray(obj.characters)) {
            // overwrite custom characters
            localStorage.setItem('customCharacters', JSON.stringify(obj.characters));
            // merge into runtime
            loadCharactersFromStorage();
        }
        if (obj.characterTraits) {
            localStorage.setItem('customTraits', JSON.stringify(obj.characterTraits));
            Object.assign(characterTraits, obj.characterTraits);
        }
        if (obj.nameMapping) {
            localStorage.setItem('nameMapping', JSON.stringify(obj.nameMapping));
            Object.assign(nameMapping, obj.nameMapping);
        }
        alert('Import berhasil. Muat ulang halaman jika diperlukan.');
        refreshCharacterList();
        populateCharacterSelect();
        refreshNameMappingList();
    } catch (e) {
        alert('JSON invalid: ' + e.message);
    }
}

function renderStats() {
    const el = document.getElementById('statsContent');
    if (!el) return;

    const total = characters.length;
    const byGender = characters.reduce((acc, c) => {
        acc[c.gender] = (acc[c.gender] || 0) + 1;
        return acc;
    }, {});

    // Ambil data gacha stats
    const statsRaw = localStorage.getItem('gachaStats');
    const gachaStats = statsRaw ? JSON.parse(statsRaw) : {};
    const sorted = Object.entries(gachaStats)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 10);
    const maxCount = sorted.length > 0 ? sorted[0][1] : 1;

    const topHtml = sorted.length === 0
        ? '<p style="color:var(--text-muted);font-size:0.9em;">Belum ada data gacha. Coba gacha dulu!</p>'
        : sorted.map(([ name, count ], i) => {
            const pct = Math.round((count / maxCount) * 100);
            const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i+1}.`;
            const char = characters.find(c => c.name === name);
            return `
                <div style="display:flex;align-items:center;gap:12px;margin-bottom:12px;">
                    <div style="width:28px;text-align:center;font-size:1.1em;">${medal}</div>
                    ${char?.img ? `<img src="${char.img}" style="width:40px;height:40px;border-radius:50%;object-fit:cover;border:2px solid var(--border);">` : '<div style="width:40px;height:40px;border-radius:50%;background:var(--border);"></div>'}
                    <div style="flex:1;">
                        <div style="font-weight:800;font-size:0.9em;color:var(--text-primary);">${name}</div>
                        <div style="height:8px;background:var(--border);border-radius:4px;margin-top:4px;overflow:hidden;">
                            <div style="height:100%;width:${pct}%;background:var(--blue);border-radius:4px;transition:width 0.5s ease;"></div>
                        </div>
                    </div>
                    <div style="font-weight:800;color:var(--blue);font-size:0.95em;min-width:32px;text-align:right;">${count}x</div>
                </div>
            `;
        }).join('');

    el.innerHTML = `
        <div style="margin-bottom:20px;padding:14px;background:var(--bg-section);border:1.5px solid var(--border);border-radius:12px;">
            <div style="display:flex;gap:20px;flex-wrap:wrap;">
                <div style="text-align:center;">
                    <div style="font-size:1.8em;font-weight:900;color:var(--blue);">${total}</div>
                    <div style="font-size:0.8em;color:var(--text-muted);">Total Karakter</div>
                </div>
                <div style="text-align:center;">
                    <div style="font-size:1.8em;font-weight:900;color:#db2777;">${byGender.female || 0}</div>
                    <div style="font-size:0.8em;color:var(--text-muted);">Perempuan ♀</div>
                </div>
                <div style="text-align:center;">
                    <div style="font-size:1.8em;font-weight:900;color:#2563eb;">${byGender.male || 0}</div>
                    <div style="font-size:0.8em;color:var(--text-muted);">Laki-laki ♂</div>
                </div>
                <div style="text-align:center;">
                    <div style="font-size:1.8em;font-weight:900;color:#d97706;">${byGender.anomali || 0}</div>
                    <div style="font-size:0.8em;color:var(--text-muted);">Anomali ⚠</div>
                </div>
            </div>
        </div>

        <div style="padding:14px;background:var(--bg-section);border:1.5px solid var(--border);border-radius:12px;">
            <div style="font-family:'Cinzel',serif;font-weight:700;color:var(--blue);margin-bottom:14px;">🏆 Top Karakter Terpopuler</div>
            ${topHtml}
            ${sorted.length > 0 ? `<button onclick="resetGachaStats()" style="margin-top:12px;background:var(--red-pale);color:var(--red);border:1.5px solid #fecaca;padding:6px 14px;border-radius:8px;font-size:0.8em;font-weight:700;">🗑️ Reset Statistik</button>` : ''}
        </div>
    `;
}
// initialize default admin tab

// =============================================
// PERBAIKAN 2 & 5: Fungsi Import dari File & Reset
// =============================================

// Import dari file JSON yang dipilih user (tidak perlu paste manual)
function importFromFile(input) {
    const file = input.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        document.getElementById('importJson').value = e.target.result;
        importJSON(); // langsung proses
    };
    reader.readAsText(file);
}

function resetGachaStats() {
    if (!confirm('Reset semua statistik gacha?')) return;
    localStorage.removeItem('gachaStats');
    renderStats();
}
// Hapus semua data custom (karakter, traits, mapping) dari localStorage
function resetAllCustomData() {
    if (!confirm('Hapus semua karakter custom dan mapping? Karakter bawaan tidak terpengaruh.')) return;
    localStorage.removeItem('customCharacters');
    localStorage.removeItem('customTraits');
    localStorage.removeItem('nameMapping');

    // Reload halaman agar data bersih
    alert('Data custom berhasil direset. Halaman akan dimuat ulang.');
    location.reload();
}

// Upgrade exportJSON agar lebih informatif
function exportJSON() {
    // Hanya export karakter custom (bukan bawaan) + mapping
    const stored = localStorage.getItem('customCharacters');
    const customChars = stored ? JSON.parse(stored) : [];
    const storedTraits = localStorage.getItem('customTraits');
    const customTraits = storedTraits ? JSON.parse(storedTraits) : {};
    const storedMapping = localStorage.getItem('nameMapping');
    const customMapping = storedMapping ? JSON.parse(storedMapping) : {};

    const payload = {
        _info: "Gacha Personality - Backup Data",
        _date: new Date().toISOString(),
        _totalCharacters: customChars.length,
        characters: customChars,       // sudah include foto & suara dalam Base64
        characterTraits: customTraits,
        nameMapping: customMapping
    };

    const dataStr = JSON.stringify(payload, null, 2);
    const blob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const now = new Date();
    a.download = `gacha_backup_${now.getFullYear()}${(now.getMonth()+1).toString().padStart(2,'0')}${now.getDate().toString().padStart(2,'0')}.json`;
    a.click();
    URL.revokeObjectURL(url);
    alert(`Backup berhasil! ${customChars.length} karakter custom disimpan.`);
}

//if (document.getElementById('adminPanel')) switchAdminTab('characters');