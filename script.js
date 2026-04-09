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

        for (let i = 1; i <= totalPages; i++) {
            const btn = document.createElement('button');
            btn.textContent = i;
            btn.className = (i === browseCurrentPage) ? 'active' : '';
            btn.onclick = () => displayBrowseCharacters(i);
            paginationEl.appendChild(btn);
        }

        const next = document.createElement('button');
        next.textContent = '›';
        next.disabled = browseCurrentPage >= totalPages;
        next.onclick = () => displayBrowseCharacters(browseCurrentPage + 1);
        paginationEl.appendChild(next);
    }
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
        <div class="gacha-orb-wrapper">
            <div class="gacha-orb">
                <div class="gacha-orb-inner">
                    <div class="gacha-orb-ring ring1"></div>
                    <div class="gacha-orb-ring ring2"></div>
                    <div class="gacha-orb-ring ring3"></div>
                    <div class="gacha-orb-core">✦</div>
                </div>
            </div>
            <div class="gacha-sparks" id="gachaSparks"></div>
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

    // Munculkan spark partikel kecil
    const sparksEl = document.getElementById('gachaSparks');
    for (let i = 0; i < 12; i++) {
        const sp = document.createElement('div');
        sp.className = 'spark';
        sp.style.cssText = `--angle:${i * 30}deg; --delay:${(i * 0.08).toFixed(2)}s`;
        sparksEl.appendChild(sp);
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
        rollCharacter(username);
    }, 2200);
}

// rollCharacter - moved to top-level
function rollCharacter(username) {
    const result = document.getElementById("result");
    const gacha = document.getElementById("gachaAnim");

    let resultObj = findBestCharacter();
    let char = resultObj.character;

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
    // Check if username is mapped to a specific character
    const lowerUsername = username.toLowerCase();
    if (nameMapping[lowerUsername]) {
        const mappedCharName = nameMapping[lowerUsername];
        const mappedChar = characters.find(char => char.name === mappedCharName);
        if (mappedChar) {
            return { character: mappedChar, similarity: 100, compatibility: 100 };
        }
    }

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

        // If random mode, treat this as chance-based selection
        if (gachaMode === 'random') {
            // pick randomly with uniform probability
            if (!bestMatch || Math.random() < 1 / characters.length) {
                bestMatch = char;
                bestSimPerc = null;
                bestCompPerc = null;
            }
            return;
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

// Built-in fallback characters from Honkai Star Rail
const builtInCharacters = [
    {
        name: "Seele",
        gender: "female",
        img: "images/seele.png",
        desc: "Pemberani dan lincah, pemimpin yang kuat.",
        details: "Seele adalah sosok yang pemberani dan lincah, selalu siap melindungi teman-temannya dengan segala cara. Keberaniannya yang luar biasa membuatnya menjadi pemimpin yang natural dan dihormati. Ia memiliki intuisi yang tajam dan selalu dapat membuat keputusan tepat dalam situasi sulit. Semangatnya yang membara menginspirasi semua orang di sekitarnya untuk menjadi lebih baik.",
        words: "Aku akan melindungi kalian semua!",
        sound: "sounds/seele.mp3",
        traits: { brave: 3, smart: 1, gentle: 1, leader: 2, warm: 2, cautious: 0 }
    },
    {
        name: "Kafka",
        gender: "female",
        img: "images/kafka.png",
        desc: "Misterius, elegan, dan berbahaya.",
        details: "Kafka adalah sosok yang misterius dan elegan, selalu bermain dengan strategi yang kompleks. Keanggunannya yang alami membuatnya terlihat berbahaya namun menarik. Ia cerdas dalam merencanakan setiap langkah dan selalu memiliki kartu as tersembunyi. Misterinya membuat orang penasaran tentang tujuan sebenarnya.",
        words: "Permainan baru saja dimulai.",
        sound: "sounds/kafka.mp3",
        traits: { brave: 2, smart: 3, gentle: 0, leader: 2, warm: 0, cautious: 2 }
    },
    {
        name: "Silver Wolf",
        gender: "female",
        img: "images/silver_wolf.png",
        desc: "Genius hacker dan pembuat strategi.",
        details: "Silver Wolf adalah genius dalam dunia cyber dan strategi. Kecerdasannya yang luar biasa membuatnya mampu memurnikan masalah kompleks menjadi solusi sederhana. Ia playful namun serius saat bekerja, dan selalu punya rencana cadangan. Kemampuannya dalam teknologi membuat dia tak tertandingi dalam bidangnya.",
        words: "Ini terlalu mudah.",
        sound: "sounds/silver_wolf.mp3",
        traits: { brave: 1, smart: 3, gentle: 1, leader: 1, warm: 1, cautious: 1 }
    },
    {
        name: "Blade",
        gender: "male",
        img: "images/blade.png",
        desc: "Prajurit gelap yang mencari penebusan.",
        details: "Blade adalah prajurit yang kuat namun memiliki masa lalu yang gelap. Ia sedang mencari cara untuk menebus kesalahannya dengan berjuang melawan kegelapan. Keberaniannya dalam pertempuran tidak tertandingi, namun hatinya tersembunyi di balik topeng dingin. Ia percaya pada tindakan lebih dari kata-kata.",
        words: "Perjuangan tidak pernah berakhir.",
        sound: "sounds/blade.mp3",
        traits: { brave: 3, smart: 1, gentle: 0, leader: 1, warm: 0, cautious: 1 }
    },
    {
        name: "Luocha",
        gender: "male",
        img: "images/luocha.png",
        desc: "Mysterious businessman dengan kekuatan supernatural.",
        details: "Luocha adalah businessman yang penuh misteri dengan kekuatan yang belum sepenuhnya dipahami. Elegansinya dan cara berbahasanya yang sopan menyembunyikan tujuan sejatinya. Ia memiliki wawasan yang dalam tentang dunia dan masa depan. Siapa yang mengikuti ajakannya tidak pernah tahu apa yang akan terjadi.",
        words: "Bisnis adalah tentang kesempatan.",
        sound: "sounds/luocha.mp3",
        traits: { brave: 1, smart: 3, gentle: 2, leader: 2, warm: 1, cautious: 2 }
    },
    {
        name: "Dan Heng",
        gender: "male",
        img: "images/dan_heng.png",
        desc: "Pendiam, misterius, dan berhati emas.",
        details: "Dan Heng adalah sosok yang pendiam namun memiliki hati yang emas. Ia menyimpan banyak rahasia tetapi selalu bersedia membantu teman-temannya. Kecerdasannya dan pengalaman hidupnya membuatnya menjadi penasehat yang bijaksana. Misterinya membuat orang penasaran, namun loyalitasnya tidak pernah diragukan.",
        words: "Kadang membungkam lebih baik dari berbicara.",
        sound: "sounds/dan_heng.mp3",
        traits: { brave: 2, smart: 2, gentle: 2, leader: 1, warm: 2, cautious: 1 }
    },
    {
        name: "Asta",
        gender: "female",
        img: "images/asta.png",
        desc: "Diplomat cerdas dengan strategi brilian.",
        details: "Asta adalah diplomat yang cerdas dengan strategi brilian di balik setiap keputusannya. Ia percaya pada kekuatan diplomasi dan bijaksana dalam menyelesaikan masalah. Kepemimpinannya yang inspiratif membuat orang ingin mengikutinya. Ia selalu berpikir beberapa langkah ke depan.",
        words: "Strategi terbaik adalah yang tidak terlihat.",
        sound: "sounds/asta.mp3",
        traits: { brave: 1, smart: 3, gentle: 2, leader: 3, warm: 1, cautious: 1 }
    },
    {
        name: "Bailu",
        gender: "female",
        img: "images/bailu.png",
        desc: "Penyembuh energik dan penuh kasih sayang.",
        details: "Bailu adalah penyembuh yang energik dan penuh kasih sayang terhadap semua orang. Energinya yang tak terbatas menginspirasi orang lain untuk tetap optimis. Ia percaya bahwa setiap orang berhak mendapat kesempatan kedua dan kasih sayang. Kehangatannya membuat lingkungan di sekitarnya menjadi lebih baik.",
        words: "Aku akan menyembuhkan semua luka mu!",
        sound: "sounds/bailu.mp3",
        traits: { brave: 1, smart: 1, gentle: 3, leader: 0, warm: 3, cautious: 0 }
    },
    {
        name: "Clara",
        gender: "female",
        img: "images/clara.png",
        desc: "Gadis manis yang bersama robot raksasa.",
        details: "Clara adalah gadis manis yang selalu bersama robot raksasanya. Ia memiliki hati yang murni dan kasih sayang yang tak terbatas. Kekuatan gaib Clara membuatnya mampu melindungi orang yang ia sayangi. Meskipun muda, ia memiliki wisdom yang melampaui usia.",
        words: "Saat bekerja sama, kami tidak terkalahkan.",
        sound: "sounds/clara.mp3",
        traits: { brave: 2, smart: 1, gentle: 3, leader: 0, warm: 3, cautious: 0 }
    },
    {
        name: "Himeko",
        gender: "female",
        img: "images/himeko.png",
        desc: "Kapten tembak api dan pemimpin tim.",
        details: "Himeko adalah kapten tembak api yang tangguh dan pemimpin tim yang hebat. Pengalamannya yang bertahun-tahun membuat dia veteran dalam petualangan. Ia tidak takut menghadapi tantangan apapun dan selalu melindungi anggota timnya. Keberaniannya menginspirasi semua orang di sekitarnya.",
        words: "Sebagai pemimpin, aku akan membawa kalian ke depan.",
        sound: "sounds/himeko.mp3",
        traits: { brave: 3, smart: 2, gentle: 1, leader: 3, warm: 2, cautious: 0 }
    },
    {
        name: "Natasha",
        gender: "female",
        img: "images/natasha.png",
        desc: "Dokter pengasih dengan masa lalu kelam.",
        details: "Natasha adalah dokter yang pengasih namun memiliki masa lalu yang kelam. Ia telah melalui banyak pengalaman pahit dan kini berdedikasi untuk membantu orang lain. Kesabaran dan belas kasihannya tak terbatas. Ia percaya bahwa setiap jiwa berhak disembuhkan.",
        words: "Kesehatan adalah harta yang paling berharga.",
        sound: "sounds/natasha.mp3",
        traits: { brave: 2, smart: 2, gentle: 3, leader: 1, warm: 3, cautious: 1 }
    },
    {
        name: "Sampo",
        gender: "male",
        img: "images/sampo.png",
        desc: "Penipu cerdas dengan hati yang baik.",
        details: "Sampo adalah penipu cerdas yang selalu memiliki rencana muluk. Meskipun terlihat jahat, dia sebenarnya memiliki hati yang baik. Ia selalu mencari keuntungan tetapi tidak akan melukai teman-temannya. Kecekalannya membuat situasi apapun menjadi menghibur.",
        words: "Hidup adalah tentang mencari peluang.",
        sound: "sounds/sampo.mp3",
        traits: { brave: 1, smart: 3, gentle: 1, leader: 1, warm: 1, cautious: 1 }
    },
    {
        name: "Serval",
        gender: "female",
        img: "images/serval.png",
        desc: "Gadis ceria dengan power petir.",
        details: "Serval adalah gadis ceria dengan kekuatan petir yang luar biasa. Cerianya menular dan membuat orang di sekitarnya merasa bahagia. Ia optimis dalam menghadapi apapun dan selalu mencari sisi positif. Energinya yang membara seperti petir yang ia kuasai.",
        words: "Ayo kita ciptakan ledakan petir!",
        sound: "sounds/serval.mp3",
        traits: { brave: 2, smart: 1, gentle: 1, leader: 1, warm: 2, cautious: 0 }
    },
    {
        name: "Pela",
        gender: "female",
        img: "images/pela.png",
        desc: "Prajurit strategis dari organisasi militer.",
        details: "Pela adalah prajurit strategis dari organisasi militer yang terlatih dengan baik. Disiplinnya yang tinggi membuat dia sangat kompeten dalam pertempuran. Ia taat pada perintah namun juga memiliki pikiran sendiri. Loyalitasnya pada tim tidak pernah goyah.",
        words: "Strategi dan disiplin adalah kunci kemenangan.",
        sound: "sounds/pela.mp3",
        traits: { brave: 2, smart: 2, gentle: 0, leader: 2, warm: 1, cautious: 1 }
    },
    {
        name: "Hook",
        gender: "female",
        img: "images/hook.png",
        desc: "Gadis kecil yang petualang dan berani.",
        details: "Hook adalah gadis kecil yang petualang dan memiliki keberanian luar biasa. Meskipun ukurannya yang kecil, semangatnya sangat besar. Ia tidak takut menghadapi ancaman dan selalu ingin membantu teman-temannya. Keimutannya tidak mengurangi keberanian dan logikanya.",
        words: "Meskipun kecil, aku kuat!",
        sound: "sounds/hook.mp3",
        traits: { brave: 2, smart: 1, gentle: 1, leader: 0, warm: 2, cautious: 0 }
    },
    {
        name: "Arlan",
        gender: "male",
        img: "images/arlan.png",
        desc: "Prajurit berani dengan kode kehormatan.",
        details: "Arlan adalah prajurit berani dengan kode kehormatan yang kuat. Ia percaya pada keadilan dan tidak akan mengkhianati prinsipnya. Keberaniannya dalam pertempuran tidak tertandingi dan ia selalu siap mengorbankan diri untuk teman. Kehormatan adalah segalanya baginya.",
        words: "Kehormatan lebih penting dari hidup.",
        sound: "sounds/arlan.mp3",
        traits: { brave: 3, smart: 1, gentle: 1, leader: 1, warm: 1, cautious: 0 }
    },
    {
        name: "Sushang",
        gender: "female",
        img: "images/sushang.png",
        desc: "Ahli bela diri energik dan ceria.",
        details: "Sushang adalah ahli bela diri yang energik dan ceria dalam menghadapi setiap tantangan. Teknik bela dirinya yang sempurna dikombinasikan dengan semangat yang tak tergoyahkan. Ia membuat suasana lebih ceria dengan sikapnya yang positif. Penalaran dan kecekalannya membuat dia sulit dikalahkan.",
        words: "Mari kita latihan bersama!",
        sound: "sounds/sushang.mp3",
        traits: { brave: 2, smart: 1, gentle: 0, leader: 0, warm: 2, cautious: 0 }
    },
    {
        name: "Gepard",
        gender: "male",
        img: "images/gepard.png",
        desc: "Pemimpin militer tinggi dengan prinsip tegas.",
        details: "Gepard adalah pemimpin militer tinggi dengan prinsip yang sangat tegas. Disiplinnya dan komitmennya pada tugas membuatnya menjadi pemimpin yang dihormati. Ia percaya pada ketertiban dan peraturan, namun juga peduli pada anak buahnya. Keberaniannya dan kebijaksanaan membuatnya menjadi strategist yang hebat.",
        words: "Perintah adalah perintah, tidak ada kompromi.",
        sound: "sounds/gepard.mp3",
        traits: { brave: 2, smart: 2, gentle: 0, leader: 3, warm: 1, cautious: 2 }
    },
    {
        name: "Bronya",
        gender: "female",
        img: "images/bronya.png",
        desc: "Gadis cyber dengan kekuatan robotik.",
        details: "Bronya adalah gadis cyber dengan kekuatan robotik canggih. Ia cerdas dalam teknologi dan strategi pertempuran. Masa lalunya yang berat membuatnya lebih kuat dan determinated. Ia melihat dunia melalui lensa logika tetapi juga memiliki kepedulian yang dalam.",
        words: "Teknologi adalah masa depan.",
        sound: "sounds/bronya.mp3",
        traits: { brave: 1, smart: 3, gentle: 1, leader: 2, warm: 1, cautious: 1 }
    },
    {
        name: "Jing Yuan",
        gender: "male",
        img: "images/jing_yuan.png",
        desc: "Jenderal handal dengan strategi brilian.",
        details: "Jing Yuan adalah jenderal yang handal dengan strategi brilian. Pengalaman bertahun-tahun membuat dia menjadi strategist terbaik. Ia tenang dalam menghadapi krisis dan selalu punya rencana. Kepemimpinannya yang bijaksana menginspirasi banyak orang.",
        words: "Strategi yang baik adalah yang tidak terlihat.",
        sound: "sounds/jing_yuan.mp3",
        traits: { brave: 2, smart: 3, gentle: 1, leader: 3, warm: 1, cautious: 1 }
    },
    {
        name: "Jingliu",
        gender: "female",
        img: "images/jingliu.png",
        desc: "Prajurit legendaris dengan kekuatan beku.",
        details: "Jingliu adalah prajurit legendaris dengan kekuatan beku yang menakutkan. Ia tenang namun sangat berbahaya dalam pertempuran. Pengalamannya yang panjang membuat dia veteran sejati. Kekuatannya yang lembam seperti es menciptakan jarak dengan dunia.",
        words: "Es tidak memiliki emosi.",
        sound: "sounds/jingliu.mp3",
        traits: { brave: 3, smart: 2, gentle: 0, leader: 2, warm: 0, cautious: 1 }
    },
    {
        name: "Hanya",
        gender: "female",
        img: "images/hanya.png",
        desc: "Mandor misterius dengan pengaruh tersembunyi.",
        details: "Hanya adalah mandor misterius dengan pengaruh tersembunyi. Ia menjalankan operasi kompleks di balik layar dengan presisi. Keberadaannya selalu penuh teka-teki dan orang tidak pernah tahu apa rencananya. Ia adalah jenis orang yang dibayar untuk menyelesaikan pekerjaan, tidak peduli seberapa sulit.",
        words: "Pekerjaan adalah pekerjaan.",
        sound: "sounds/hanya.mp3",
        traits: { brave: 2, smart: 3, gentle: 0, leader: 1, warm: 0, cautious: 2 }
    },
    {
        name: "Xueyi",
        gender: "female",
        img: "images/xueyi.png",
        desc: "Pengusaha cerdas dengan jiwa kebebasan.",
        details: "Xueyi adalah pengusaha cerdas dengan jiwa kebebasan yang tidak terikat. Ia percaya pada kemandirian dan tidak suka terikat pada aturan. Kecekalannya dalam bisnis membuat dia sukses. Namun hatinya tetap peduli pada orang-orang yang ia anggap keluarga.",
        words: "Kebebasan adalah yang paling berharga.",
        sound: "sounds/xueyi.mp3",
        traits: { brave: 1, smart: 3, gentle: 1, leader: 1, warm: 2, cautious: 0 }
    },
    {
        name: "Lynx",
        gender: "female",
        img: "images/lynx.png",
        desc: "Penyembuh misterius dari masa depan.",
        details: "Lynx adalah penyembuh misterius yang tampak datang dari masa depan. Ia memiliki pengetahuan yang melampaui waktu biasa. Ketenangan dan kebijaksanaan yang ia miliki membuat orang percaya padanya. Senyumnya yang lembut menyembunyikan kekuatan yang luar biasa.",
        words: "Masa depan sudah diputuskan namun masih berubah.",
        sound: "sounds/lynx.mp3",
        traits: { brave: 1, smart: 3, gentle: 2, leader: 0, warm: 2, cautious: 1 }
    },
    {
        name: "Rover",
        gender: "male",
        img: "images/rover.png",
        desc: "Penjelajah misterius dengan kekuatan tersembunyi.",
        details: "Rover adalah penjelajah misterius yang datang dengan tujuan yang tidak jelas. Ia memiliki kekuatan aneh dan kemampuan adaptasi yang luar biasa. Meskipun pendiam, keputusannya didorong oleh keadilan. Ada misteri dalam dirinya yang membuatnya menarik dan penuh teka-teki.",
        words: "Aku harus menemukan jawabannya.",
        sound: "sounds/rover.mp3",
        traits: { brave: 2, smart: 2, gentle: 1, leader: 1, warm: 1, cautious: 2 }
    },
    {
        name: "Zhezhi",
        gender: "female",
        img: "images/zhezhi.png",
        desc: "Pedagang cerdas dengan simpati mendalam.",
        details: "Zhezhi adalah pedagang cerdas yang memahami nilai setiap barang dan setiap orang. Di balik bisnisnya yang tajam, ia memiliki simpati yang mendalam. Ia membantu mereka yang benar-benar membutuhkan meski itu merugikan bisnis. Kehangatannya tersembunyi namun nyata bagi yang mengenal dirinya.",
        words: "Ada harga untuk segalanya, tapi tidak semuanya dijual.",
        sound: "sounds/zhezhi.mp3",
        traits: { brave: 1, smart: 3, gentle: 2, leader: 1, warm: 2, cautious: 1 }
    },
    {
        name: "Jiyan",
        gender: "male",
        img: "images/jiyan.png",
        desc: "Prajurit terlatih dengan dedikasi tinggi.",
        details: "Jiyan adalah prajurit terlatih dengan disiplin militer yang ketat. Dedikasi dan loyalitasnya terhadap tugasnya tidak tertandingi. Meskipun terlihat tegas, ia memiliki rasa tanggung jawab yang dalam terhadap rekan-rekannya. Keberaniannya di medan perang telah terbukti berkali-kali.",
        words: "Tugas harus diselesaikan dengan sempurna.",
        sound: "sounds/jiyan.mp3",
        traits: { brave: 3, smart: 2, gentle: 1, leader: 2, warm: 1, cautious: 1 }
    },
    {
        name: "Lingyang",
        gender: "female",
        img: "images/lingyang.png",
        desc: "Petarung energik dengan semangat membara.",
        details: "Lingyang adalah petarung energik dengan semangat membara yang tidak pernah surut. Keberaniannya dalam pertarungan tidak kenal takut. Ia percaya pada kekuatan batin dan latihan berkelanjutan. Cerianya menular dan membuat tim tetap bersemangat dalam situasi apapun.",
        words: "Mari kita tunjukkan kekuatan kita!",
        sound: "sounds/lingyang.mp3",
        traits: { brave: 3, smart: 1, gentle: 1, leader: 1, warm: 2, cautious: 0 }
    },
    {
        name: "Changli",
        gender: "female",
        img: "images/changli.png",
        desc: "Ilmuwan dengan kedua belah pikiran.",
        details: "Changli adalah ilmuwan dengan kedua belah pikiran yang sering terlibat dalam drama internal. Kecerdasannya yang luar biasa tidak tertandingi dalam penelitian. Ia memiliki obsesi dengan penemuan dan sering mengabaikan hal-hal lain. Namun di balik keajaiban akademisnya, ia memiliki hati yang peduli.",
        words: "Ilmu pengetahuan adalah jembatan menuju kebenaran.",
        sound: "sounds/changli.mp3",
        traits: { brave: 1, smart: 3, gentle: 1, leader: 1, warm: 1, cautious: 2 }
    },
    {
        name: "Calcharo",
        gender: "male",
        img: "images/calcharo.png",
        desc: "Pemburu berbakat dengan pengalaman luas.",
        details: "Calcharo adalah pemburu berbakat dengan pengalaman melacak dan menangkap berbagai makhluk. Keahliannya yang sangat spesifik membuatnya sosok yang sangat dicari. Meskipun profesional dalam pekerjaan, ia memiliki kode etik sendiri. Loyalitasnya pada yang mempekerjakan adalah mutlak jika mereka adil.",
        words: "Setiap makhluk memiliki pola, aku tahu mereka semua.",
        sound: "sounds/calcharo.mp3",
        traits: { brave: 2, smart: 2, gentle: 1, leader: 1, warm: 1, cautious: 2 }
    },
    {
        name: "Aalto",
        gender: "male",
        img: "images/aalto.png",
        desc: "Pencuri terampil dengan hati seorang pejuang.",
        details: "Aalto adalah pencuri terampil yang menggunakan keterampilannya untuk kebaikan. Meskipun profesinya ilegal, motivasinya murni untuk membantu yang tertindas. Ia memiliki kelincahan luar biasa dan pemikiran yang cepat. Kehangatan dan kebaikan hatinya memperdalam loyalitas rekan-rekannya.",
        words: "Kadang kita harus melanggar aturan untuk berbuat benar.",
        sound: "sounds/aalto.mp3",
        traits: { brave: 2, smart: 2, gentle: 2, leader: 0, warm: 3, cautious: 1 }
    },
    {
        name: "Encore",
        gender: "female",
        img: "images/encore.png",
        desc: "Petunjuk pertunjukan dengan mimpi besar.",
        details: "Encore adalah petunjuk pertunjukan dengan mimpi besar untuk kesuksesan. Ia penuh energi dan optimisme yang menular terhadap proyek-proyeknya. Meskipun terkadang ceroboh dalam eksekusi, visinya yang jelas menginspirasi semua orang. Kehangatannya dan kepedulian terhadap timnya membuat mereka rela bekerja keras.",
        words: "Pertunjukan harus berlanjut!",
        sound: "sounds/encore.mp3",
        traits: { brave: 2, smart: 1, gentle: 2, leader: 2, warm: 3, cautious: 0 }
    },
    {
        name: "Mortefi",
        gender: "male",
        img: "images/mortefi.png",
        desc: "Insinyur cemerlang dengan otak teknis.",
        details: "Mortefi adalah insinyur cemerlang dengan otak teknis yang superior. Ia dapat membangun atau memperbaiki hampir apapun dengan presisi yang menakjubkan. Ketelitiannya dalam pekerjaan tidak tertandingi dan ia tidak pernah puas dengan hasil yang sekedar biasa. Di balik dedicasinya pada pekerjaan, ia adalah teman yang dapat diandalkan.",
        words: "Mekanik yang tepat dapat menyelamatkan nyawa.",
        sound: "sounds/mortefi.mp3",
        traits: { brave: 1, smart: 3, gentle: 1, leader: 1, warm: 1, cautious: 1 }
    },
    {
        name: "Verina-Umbra",
        gender: "female",
        img: "images/verina.png",
        desc: "Pejuang bayangan dengan tekad besi.",
        details: "Verina-Umbra adalah pejuang bayangan dengan tekad besi yang tidak tergoyahkan. Gerakannya anggun namun mematikan dalam pertarungan. Ia bekerja di balik layar untuk mencapai tujuan besarnya. Loyalitas pada alasan yang ia yakini adalah yang paling penting baginya.",
        words: "Bayangan mengetahui semua kebenaran.",
        sound: "sounds/verina.mp3",
        traits: { brave: 2, smart: 2, gentle: 0, leader: 1, warm: 0, cautious: 3 }
    },
    {
        name: "Deshret",
        gender: "male",
        img: "images/deshret.png",
        desc: "Prajurit gurun dengan bijaksana kuno.",
        details: "Deshret adalah prajurit gurun dengan kebijaksanaan kuno yang telah bertahan berabad-abad. Pengalaman dan pengetahuannya tentang alam gurun tidak tertandingi. Ia memiliki tempat khusus di hatinya untuk tradisi dan sejarah. Ketenangan dan kedalaman pemikirannya membuat dia menjadi mentor yang berharga.",
        words: "Pasir mengungkap semua rahasia pada mereka yang menunggu.",
        sound: "sounds/deshret.mp3",
        traits: { brave: 2, smart: 3, gentle: 1, leader: 2, warm: 1, cautious: 1 }
    },
    {
        name: "Tiya",
        gender: "female",
        img: "images/tiya.png",
        desc: "Gadis ceria dengan sifat ketergantungan.",
        details: "Tiya adalah gadis ceria dengan sifat ketergantungan yang membuat dia lucu. Ia penuh energi dan selalu mencari bantuan dari orang-orang di sekitarnya. Meskipun terkadang merepotkan, kepolosannya yang indah membuat orang tidak keberatan membantunya. Hatinya yang murni dan kepedulian pada teman membuat dia disayangi.",
        words: "Tolong bantu aku! *berbintik mata bersalah*",
        sound: "sounds/tiya.mp3",
        traits: { brave: 0, smart: 1, gentle: 2, leader: 0, warm: 3, cautious: 0 }
    },
    {
        name: "Scar",
        gender: "male",
        img: "images/scar.png",
        desc: "Prajurit penyembah dengan masa lalu kelam.",
        details: "Scar adalah prajurit penyembah dengan masa lalu kelam yang membuatnya berbeda. Ia mencari penebusan untuk kesalahan masa lalunya melalui tindakan saat ini. Kedalaman emosi dan pengertian tentang rasa sakit membuat dia bijaksana. Perjalanannya menuju cahaya tetap berlanjut dengan determinasi yang kuat.",
        words: "Aku harus menebus kesalahan saya.",
        sound: "sounds/scar.mp3",
        traits: { brave: 2, smart: 2, gentle: 1, leader: 1, warm: 1, cautious: 1 }
    },
    {
        name: "Yangyang",
        gender: "female",
        img: "images/yangyang.png",
        desc: "Pelayan setia dengan naluri perlindungan.",
        details: "Yangyang adalah pelayan setia dengan naluri perlindungan yang kuat. Ia berdedikasi untuk melayani dan membantu orang-orang yang ia pedulikan. Kelembutannya tidak berarti kelemahan - ia memiliki tekad besi saat diperlukan. Loyalitasnya yang tak tergoyahkan membuat dia menjadi aset berharga bagi siapapun yang bersamanya.",
        words: "Saya akan melindungi anda dari manapun.",
        sound: "sounds/yangyang.mp3",
        traits: { brave: 2, smart: 1, gentle: 3, leader: 0, warm: 3, cautious: 1 }
    },
    {
        name: "Baizhi",
        gender: "female",
        img: "images/baizhi.png",
        desc: "Tabib mahir dengan intuisi mendalam.",
        details: "Baizhi adalah tabib mahir dengan intuisi mendalam tentang penyakit dan penyembuhan. Pengetahuan medisnya dikombinasikan dengan kepercayaan pada kekuatan alami. Ia tenang dalam situasi krisis dan selalu tahu apa yang perlu dilakukan. Komitmennya pada kesehatan pasien tidak pernah tergoyahkan.",
        words: "Kesehatan adalah kekayaan sejati.",
        sound: "sounds/baizhi.mp3",
        traits: { brave: 1, smart: 2, gentle: 3, leader: 0, warm: 2, cautious: 1 }
    },
    {
        name: "Sanhua",
        gender: "female",
        img: "images/sanhua.png",
        desc: "Pejuang gaya tinggi dengan teknik lethean.",
        details: "Sanhua adalah pejuang dengan gaya tinggi dan teknik lethean yang elegan namun mematikan. Gerakannya seperti tari yang indah namun setiap gerakan membawa ancaman. Ia percaya pada keseimbangan sempurna antara keindahan dan kekuatan. Kepribadiannya yang glamor menyembunyikan prajurit profesional sejati.",
        words: "Kecantikan dan kekuatan tidak saling bertentangan.",
        sound: "sounds/sanhua.mp3",
        traits: { brave: 2, smart: 2, gentle: 1, leader: 1, warm: 1, cautious: 1 }
    },
    {
        name: "Carlotta",
        gender: "female",
        img: "images/carlotta.png",
        desc: "Investigator cerdas dengan naluri tajam.",
        details: "Carlotta adalah investigator cerdas dengan naluri tajam untuk menemukan kebenaran. Kecerdasannya dalam menganalisis kasus tidak tertandingi. Ia tidak akan berhenti sampai menemukan jawaban yang benar. Integritas dan komitmen pada keadilan adalah nilai-nilai utamanya.",
        words: "Kebenaran akan selalu terkuak pada akhirnya.",
        sound: "sounds/carlotta.mp3",
        traits: { brave: 2, smart: 3, gentle: 0, leader: 1, warm: 1, cautious: 2 }
    },
    {
        name: "Ling",
        gender: "female",
        img: "images/ling.png",
        desc: "Penari dengan jiwa bebas dan penuh gairah.",
        details: "Ling adalah penari dengan jiwa bebas dan penuh gairah untuk kehidupan. Gerakannya mengekspresikan emosi yang mendalam dan keindahan yang murni. Ia percaya pada kebebasan ekspresi diri dan menginspirasi orang lain untuk berbuat hal sama. Energi dan kehangatannya membuat dia momen cahaya di mana pun ia berada.",
        words: "Menari adalah cara saya berbicara dengan dunia.",
        sound: "sounds/ling.mp3",
        traits: { brave: 1, smart: 1, gentle: 2, leader: 0, warm: 3, cautious: 0 }
    },
    {
        name: "Vertin",
        gender: "female",
        img: "images/vertin.png",
        desc: "Pemimpin tim dengan tekad yang tak tergoyahkan.",
        details: "Vertin adalah pemimpin tim yang kuat dan bijaksana, memandu rekan-rekannya melalui tantangan temporal yang kompleks. Keberaniannya dalam menghadapi ketidakpastian tidak tertandingi. Ia memiliki kemampuan untuk membuat keputusan sulit dengan penuh pertimbangan. Kehangatannya terhadap tim membuat setiap orang percaya padanya sepenuhnya.",
        words: "Bersama kita bisa menghadapi apapun.",
        sound: "sounds/vertin.mp3",
        traits: { brave: 3, smart: 2, gentle: 2, leader: 3, warm: 3, cautious: 1 }
    },
    {
        name: "Schneider",
        gender: "female",
        img: "images/schneider.png",
        desc: "Petarung profesional dengan disiplin baja.",
        details: "Schneider adalah petarung profesional dengan disiplin baja yang ketat. Kekuatan dan teknisnya dalam pertarungan tidak tertandingi. Ia adalah sosok perlindung bagi tim dengan loyalitas yang mutlak. Meskipun terlihat dingin, ia memiliki perhatian mendalam terhadap keselamatan timnya.",
        words: "Biarkan aku menangani ini.",
        sound: "sounds/schneider.mp3",
        traits: { brave: 3, smart: 2, gentle: 1, leader: 2, warm: 1, cautious: 1 }
    },
    {
        name: "Matilda",
        gender: "female",
        img: "images/matilda.png",
        desc: "Ilmuwan berbakat dengan rasa ingin tahu luar biasa.",
        details: "Matilda adalah ilmuwan berbakat dengan rasa ingin tahu yang tak pernah puas. Kecerdasannya dalam memecahkan puzzle temporal sangat tinggi. Ia percaya pada kekuatan penelitian dan eksperimen. Antusiasmenya yang menular membuat orang di sekitarnya tertarik pada penemuan-penemuan barunya.",
        words: "Mari kita cari tahu apa yang terjadi di sini!",
        sound: "sounds/matilda.mp3",
        traits: { brave: 1, smart: 3, gentle: 1, leader: 0, warm: 2, cautious: 0 }
    },
    {
        name: "Druvis III",
        gender: "female",
        img: "images/druvis.png",
        desc: "Seniman gila dengan visi tak terbatas.",
        details: "Druvis III adalah seniman gila dengan visi seni yang tak terbatas. Kreativitasnya yang liar membawa perspektif unik ke setiap situasi. Ia percaya bahwa seni dapat mengubah dunia dengan cara-cara yang orang lain tidak dapat bayangkan. Keberaniannya untuk menjadi berbeda membuatnya sangat berkesan.",
        words: "Seni adalah kebenaran sejati!",
        sound: "sounds/druvis.mp3",
        traits: { brave: 2, smart: 2, gentle: 1, leader: 0, warm: 2, cautious: 0 }
    },
    {
        name: "Leilani",
        gender: "female",
        img: "images/leilani.png",
        desc: "Penyembur api dengan jiwa yang membara.",
        details: "Leilani adalah penyembur api dengan jiwa yang membara penuh semangat. Kekuatannya yang eksplosif dilengkapi dengan keberanian yang sama besarnya. Ia percaya pada aksi langsung dan tidak suka merencanakan terlalu lama. Kehangatan dan keramahan pribadinya membuat dia mudah disukai.",
        words: "Mari tunjukkan kekuatan api kita!",
        sound: "sounds/leilani.mp3",
        traits: { brave: 3, smart: 1, gentle: 1, leader: 1, warm: 2, cautious: 0 }
    },
    {
        name: "Sotheby",
        gender: "male",
        img: "images/sotheby.png",
        desc: "Pedagang cerdas dengan jaringan luas.",
        details: "Sotheby adalah pedagang cerdas dengan jaringan informasi yang sangat luas. Ia tahu bagaimana memanfaatkan setiap situasi untuk keuntungan maksimal. Meskipun bisnisnya tajam, ia memiliki kode etik tersendiri dalam hubungan dengan tim. Kemalasan dan kecerdasannya membuat dia karakter yang menarik.",
        words: "Semua ada harganya.",
        sound: "sounds/sotheby.mp3",
        traits: { brave: 1, smart: 3, gentle: 1, leader: 0, warm: 1, cautious: 2 }
    },
    {
        name: "Regulus",
        gender: "male",
        img: "images/regulus.png",
        desc: "Petarung garis depan dengan semangat tak kenal lelah.",
        details: "Regulus adalah petarung garis depan dengan semangat yang tak kenal lelah. Keberaniannya dalam menghadapi musuh adalah legendarisemangat dan determinasinya tidak pernah surut. Ia adalah tipe yang jatuh bangun terus menerus tanpa pernah menyerah. Loyalitasnya pada tim adalah mutlak.",
        words: "Mari kita pertahankan garis depan!",
        sound: "sounds/regulus.mp3",
        traits: { brave: 3, smart: 1, gentle: 0, leader: 1, warm: 1, cautious: 0 }
    },
    {
        name: "Bingling",
        gender: "female",
        img: "images/bingling.png",
        desc: "Gadis pemula dengan potensi besar.",
        details: "Bingling adalah gadis pemula yang masik belajar tentang dunia. Potensilnya sangat besar meskipun ia masih cuek di banyak hal. Rasa ingin tahunya yang tinggi membuatnya terus bertumbuh. Kepolosan dan ketulusan hatinya membuat dia disukai oleh semua orang.",
        words: "Aku akan terus belajar dan tumbuh!",
        sound: "sounds/bingling.mp3",
        traits: { brave: 1, smart: 1, gentle: 2, leader: 0, warm: 2, cautious: 0 }
    },
    {
        name: "Ulpianus",
        gender: "male",
        img: "images/ulpianus.png",
        desc: "Prajurit aneh dengan kepribadian yang rumit.",
        details: "Ulpianus adalah prajurit dengan kepribadian yang rumit dan sulit dipahami. Ia memiliki kekuatan yang luar biasa namun cara bicaranya selalu aneh dan membingungkan. Loyalitasnya pada tujuan lebih kuat daripada pada orang. Namun di balik anehnya, ia adalah prajurit yang benar-benar berdedikasi.",
        words: "Takdir telah ditentukan, namun kami masih melawan.",
        sound: "sounds/ulpianus.mp3",
        traits: { brave: 2, smart: 2, gentle: 0, leader: 1, warm: 0, cautious: 2 }
    },
    {
        name: "Pickles",
        gender: "male",
        img: "images/pickles.png",
        desc: "Perajin cerdas dengan tangan emas.",
        details: "Pickles adalah perajin cerdas dengan tangan yang dapat memperbaiki hampir apapun. Ketelitiannya dalam bekerja tidak ada tandingannya. Ia pendiam namun siap membantu kapan saja dibutuhkan. Dedikasi pada keahliannya membuat dia menjadi anggota tim yang sangat berharga.",
        words: "Biarkan aku memperbaiki ini.",
        sound: "sounds/pickles.mp3",
        traits: { brave: 1, smart: 3, gentle: 1, leader: 0, warm: 1, cautious: 1 }
    },
    {
        name: "Jessica",
        gender: "female",
        img: "images/jessica.png",
        desc: "Jurnalis berani dengan keinginan untuk kebenaran.",
        details: "Jessica adalah jurnalis berani dengan tekad yang kuat untuk mengungkap kebenaran. Ia tidak takut untuk mengkritik dan mempertanyakan status quo. Kecerdasannya dalam menganalisis situasi sangat tinggi. Keberaniannya untuk berbicara berani membuat dia menjadi suara yang penting dalam tim.",
        words: "Kebenaran harus diungkapkan!",
        sound: "sounds/jessica.mp3",
        traits: { brave: 2, smart: 3, gentle: 0, leader: 1, warm: 1, cautious: 1 }
    },
    {
        name: "Kanjira",
        gender: "female",
        img: "images/kanjira.png",
        desc: "Penyerang cepat dengan seni bela diri.",
        details: "Kanjira adalah penyerang cepat dengan penguasaan seni bela diri yang sempurna. Kelincahannya yang luar biasa membuat dia sulit ditangkap dalam pertarungan. Ia memiliki disiplin tinggi dan fokus yang tajam. Kemalaman dan ketedasan dalam setiap gerakan membuatnya berbahaya.",
        words: "Kecepatan adalah kunci menang.",
        sound: "sounds/kanjira.mp3",
        traits: { brave: 2, smart: 2, gentle: 0, leader: 0, warm: 1, cautious: 1 }
    },
    {
        name: "MedicinePocket",
        gender: "female",
        img: "images/medicinepocket.png",
        desc: "Perawat penyembuh dengan hati yang besar.",
        details: "Medicine Pocket adalah perawat penyembuh dengan hati yang sangat besar untuk membantu orang lain. Kemampuannya dalam penyembuhan tidak tertandingi dan ia selalu siap. Kebaikan dan kepeduliannya membuat dia dicintai oleh semua orang. Meskipun melayani adalah profesinya, ia melakukannya dengan penuh cinta.",
        words: "Biarkan saya membantu Anda pulih.",
        sound: "sounds/medicinepocket.mp3",
        traits: { brave: 1, smart: 2, gentle: 3, leader: 0, warm: 3, cautious: 0 }
    },
    {
        name: "Monday",
        gender: "female",
        img: "images/monday.png",
        desc: "Gadis ceria dengan energi yang menular.",
        details: "Monday adalah gadis ceria dengan energi yang menular ke semua orang di sekitarnya. Cerianya membuat situasi tersulit sekalipun terasa lebih ringan. Ia percaya pada kekuatan kegembiraan dan persahabatan. Ketulusan dan keaslian dirinya membuat dia diterima dengan terbuka oleh semua orang.",
        words: "Mari kita bersenang-senang sambil menyelamatkan dunia!",
        sound: "sounds/monday.mp3",
        traits: { brave: 1, smart: 1, gentle: 2, leader: 0, warm: 3, cautious: 0 }
    },
    {
        name: "Liushen",
        gender: "female",
        img: "images/liushen.png",
        desc: "Pendahulu dengan kebijaksanaan kuno.",
        details: "Liushen adalah pendahulu dengan kebijaksanaan yang telah terakumulasi selama berabad-abad. Ia memiliki pemahaman mendalam tentang kekuatan dan misteri dunia. Ketenangan dan kesabaran yang ia miliki adalah hasil dari pengalaman panjang. Ia adalah mentor yang berharga dengan wawasan yang jarang ditemukan.",
        words: "Waktu akan mengungkapkan semua hal.",
        sound: "sounds/liushen.mp3",
        traits: { brave: 1, smart: 3, gentle: 2, leader: 2, warm: 2, cautious: 2 }
    },
    {
        name: "Sonetto",
        gender: "female",
        img: "images/sonetto.png",
        desc: "Pelindung berpengetahuan dengan dedikasi tinggi.",
        details: "Sonetto adalah pelindung dengan pengetahuan yang luas dan dedikasi yang tinggi pada tugasnya. Ia ahli dalam berbagai bidang ilmu pengetahuan. Keputusannya didorong oleh logika dan pertimbangan yang matang. Meskipun formal, ia memiliki kepedulian mendalam pada keselamatan rekan-rekannya.",
        words: "Pengetahuan adalah senjata terbaik.",
        sound: "sounds/sonetto.mp3",
        traits: { brave: 2, smart: 3, gentle: 1, leader: 2, warm: 1, cautious: 2 }
    },
    {
        name: "Shamane",
        gender: "female",
        img: "images/shamane.png",
        desc: "Dukun mistis dengan koneksi spiritual.",
        details: "Shamane adalah dukun mistis dengan koneksi kuat ke kekuatan spiritual. Ia memiliki intuisi yang sangat tinggi dan pemahaman tentang hal-hal tersembunyi. Sikap mistisnya membuat orang terkesan namun juga sedikit takut. Namun di balik aura mistisnya, ia adalah hati yang peduli dan bijaksana.",
        words: "Roh membisikkan kebenaran kepada mereka yang mendengarkan.",
        sound: "sounds/shamane.mp3",
        traits: { brave: 1, smart: 2, gentle: 2, leader: 1, warm: 2, cautious: 2 }
    },
    {
        name: "AiwassMask",
        gender: "male",
        img: "images/aiwassmask.png",
        desc: "Sosok misterius dengan tujuan tersembunyi.",
        details: "Aiwass dengan topeng adalah sosok misterius yang selalu mengetahui lebih dari yang dia tunjukkan. Motivasinya sering tidak jelas namun tindakannya selalu memiliki maksud. Ia bermain di balik layar dengan percaya diri. Kenangsaannya penuh dengan misteri yang menarik perhatian.",
        words: "Semuanya ada dalam rencana.",
        sound: "sounds/aiwassmask.mp3",
        traits: { brave: 2, smart: 3, gentle: 0, leader: 1, warm: 0, cautious: 3 }
    },
    {
        name: "Tzakol",
        gender: "male",
        img: "images/tzakol.png",
        desc: "Prajurit kuno dengan kekuatan legendaris.",
        details: "Tzakol adalah prajurit kuno dengan kekuatan legendaris dari masa lalu yang jauh. Ia membawa warisan peradaban yang telah hilang. Kedalaman pengalaman dan pengetahuannya membuat dia figur yang menginspirasi rasa hormat. Determinasinya untuk melindungi masa depan tidak pernah goyah.",
        words: "Masa lalu membentuk masa depan.",
        sound: "sounds/tzakol.mp3",
        traits: { brave: 3, smart: 2, gentle: 1, leader: 2, warm: 1, cautious: 1 }
    },
    {
        name: "Hu Tao",
        gender: "female",
        img: "images/hutao.png",
        desc: "Direktur hall api dengan semangat berbisnis.",
        details: "Hu Tao adalah direktur Wangsheng Funeral Parlor dengan bisnis yang menguntungkan. Ia ceria dan suka berbercanda meskipun bekerja dengan hal-hal gelap. Kecerdasannya dalam bisnis tidak tertandingi dan selalu menghibur orang di sekelilingnya.",
        words: "Bisnis adalah seni, dan aku master-nya!",
        sound: "sounds/hutao.mp3",
        traits: { brave: 2, smart: 2, gentle: 1, leader: 2, warm: 3, cautious: 0 }
    },
    {
        name: "Fischl",
        gender: "female",
        img: "images/fischl.png",
        desc: "Investigator misterius dengan bahasa aneh.",
        details: "Fischl adalah investigator untuk Adventurer's Guild dengan kecerdasan yang tajam. Ia sering berbicara dalam bahasa aneh yang sulit dipahami tapi penuh makna. Meskipun terlihat aneh, ia adalah investigator paling andal di organisasinya.",
        words: "Mewah! Investigasi dimulai!",
        sound: "sounds/fischl.mp3",
        traits: { brave: 2, smart: 3, gentle: 1, leader: 1, warm: 1, cautious: 1 }
    },
    {
        name: "Kokomi",
        gender: "female",
        img: "images/kokomi.png",
        desc: "Pemimpin pantai dengan kepedulian mendalam.",
        details: "Kokomi adalah pemimpin Watatsumi Island yang bertanggung jawab dan penuh kasih sayang. Ia memiliki strategi yang brilliant dalam melindungi rakyatnya. Kehangatannya dan empatinya membuat semua orang mempercayainya sepenuhnya.",
        words: "Kita harus melindungi yang kami sayangi.",
        sound: "sounds/kokomi.mp3",
        traits: { brave: 2, smart: 3, gentle: 2, leader: 3, warm: 3, cautious: 1 }
    },
    {
        name: "Albedo",
        gender: "male",
        img: "images/albedo.png",
        desc: "Alchemist misterius dengan rasa ingin tahu.",
        details: "Albedo adalah chief alchemist dengan penelitian yang mendalam tentang dunia. Ia pendiam namun ingin tahu tentang segalanya. Kecerdasannya dalam sains tidak tertandingi dan ia selalu mencari cara baru untuk memahami alam semesta.",
        words: "Ilmu pengetahuan adalah kunci semua misteri.",
        sound: "sounds/albedo.mp3",
        traits: { brave: 1, smart: 3, gentle: 1, leader: 0, warm: 1, cautious: 2 }
    },
    {
        name: "Ayaka",
        gender: "female",
        img: "images/ayaka.png",
        desc: "Putri Klan Kamisato dengan elegan.",
        details: "Ayaka adalah putri dari Klan Kamisato yang terkenal dengan kesopanan dan elegan. Meskipun dari keluarga bangsawan, ia sangat dekat dengan rakyat. Keberaniannya dalam mengambil keputusan sulit membuat dia menjadi pemimpin yang dihormati.",
        words: "Kehormatan keluarga adalah segalanya.",
        sound: "sounds/ayaka.mp3",
        traits: { brave: 2, smart: 2, gentle: 2, leader: 2, warm: 2, cautious: 2 }
    },
    {
        name: "Kazuha",
        gender: "male",
        img: "images/kazuha.png",
        desc: "Samurai pengelana dengan jiwa bebas.",
        details: "Kazuha adalah samurai pengelana yang mencari makna hidup di setiap petualangan. Ia memiliki filosofi yang dalam tentang kehidupan dan keindahan. Meskipun sering wandering, ia memiliki kehangatan dan kebaikan yang mendalam.",
        words: "Angin membawa cerita dari seluruh dunia.",
        sound: "sounds/kazuha.mp3",
        traits: { brave: 2, smart: 2, gentle: 2, leader: 1, warm: 3, cautious: 0 }
    },
    {
        name: "Nahida",
        gender: "female",
        img: "images/nahida.png",
        desc: "Akademisi muda dengan kebijaksanaan kuno.",
        details: "Nahida adalah akademisi muda dengan pengetahuan yang sangat luas tentang dunia. Ia memiliki kebijaksanaan yang tidak sesuai dengan usianya. Kecerdasannya dan kepeduliannya pada pendidikan membuat dia menjadi guru yang sempurna.",
        words: "Pengetahuan harus dibagikan dengan semua orang.",
        sound: "sounds/nahida.mp3",
        traits: { brave: 1, smart: 3, gentle: 2, leader: 2, warm: 2, cautious: 1 }
    },
    {
        name: "Alhaitham",
        gender: "male",
        img: "images/alhaitham.png",
        desc: "Scribe cerdas dengan logika sempurna.",
        details: "Alhaitham adalah chief scribe dengan logika yang sempurna dalam berpikir. Ia analyze setiap masalah dengan detail yang menakjubkan. Meskipun terlihat dingin, ia memiliki kode etik yang kuat dan peduli pada keadilan.",
        words: "Logika adalah fondasi dari semua kebenaran.",
        sound: "sounds/alhaitham.mp3",
        traits: { brave: 1, smart: 3, gentle: 0, leader: 1, warm: 1, cautious: 2 }
    },
    {
        name: "Nilou",
        gender: "female",
        img: "images/nilou.png",
        desc: "Penari indah dengan hati yang tulus.",
        details: "Nilou adalah penari terkenal dengan gerakan yang memukau semua orang. Ia memiliki hati yang tulus dan cinta pada seni yang mendalam. Kehangatannya dan kepeduliannya membuat dia disayangi oleh semua orang yang mengenalnya.",
        words: "Tari adalah bahasa cinta yang universal.",
        sound: "sounds/nilou.mp3",
        traits: { brave: 1, smart: 1, gentle: 3, leader: 0, warm: 3, cautious: 0 }
    },
    {
        name: "Zhongli",
        gender: "male",
        img: "images/zhongli.png",
        desc: "Mantan archon dengan kebijaksanaan eternal.",
        details: "Zhongli adalah mantan Geo Archon dengan ribuan tahun pengalaman. Ia memiliki kebijaksanaan yang tidak tertandingi dan ketenangan dalam menghadapi krisis. Meskipun terlihat santai, ia adalah figur yang paling dihormati dan dipercaya.",
        words: "Dengan kontrak, semua bisa diselesaikan.",
        sound: "sounds/zhongli.mp3",
        traits: { brave: 3, smart: 3, gentle: 2, leader: 3, warm: 2, cautious: 1 }
    },
    {
        name: "Venti",
        gender: "male",
        img: "images/venti.png",
        desc: "Bard ceria dengan kebebasan yang mutlak.",
        details: "Venti adalah bard ceria yang mencintai kebebasan di atas segalanya. Ia bermain musik yang memukau dan membawa kegembiraan kemana pun dia pergi. Meskipun Archon, ia memilih hidup sederhana dan bebas tanpa beban.",
        words: "Cinta dengan kebebasan lebih dari apapun!",
        sound: "sounds/venti.mp3",
        traits: { brave: 2, smart: 2, gentle: 1, leader: 1, warm: 3, cautious: 0 }
    },
    {
        name: "Raiden Shogun",
        gender: "female",
        img: "images/raidenshogun.png",
        desc: "Archon penguasa dengan determinasi besi.",
        details: "Raiden Shogun adalah Electro Archon dengan kekuatan yang tak terbatas. Ia pursuit eternity dengan determinasi yang tidak tergoyahkan. Meskipun terlihat dingin, ia memiliki visi yang jelas untuk masa depan elektro.",
        words: "Eternity adalah tujuan akhir kami.",
        sound: "sounds/raidenshogun.mp3",
        traits: { brave: 3, smart: 3, gentle: 0, leader: 3, warm: 0, cautious: 2 }
    },
    {
        name: "Barbatos",
        gender: "male",
        img: "images/barbatos.png",
        desc: "Dewa angin dengan jiwa yang bebas.",
        details: "Barbatos adalah Anemo Archon dengan semangat yang tidak pernah terlalu serius. Ia mencintai musik dan kebebasan lebih dari apapun. Meskipun powerful, ia lebih suka bersama orang-orang biasa daripada dengan orang-orang penting.",
        words: "Angin membawa segala kemungkinan.",
        sound: "sounds/barbatos.mp3",
        traits: { brave: 2, smart: 2, gentle: 2, leader: 2, warm: 3, cautious: 0 }
    },
    {
        name: "Nahida",
        gender: "female",
        img: "images/nahida2.png",
        desc: "Dendro Archon dengan kebijaksanaan.",
        details: "Nahida adalah Dendro Archon yang baru bangun dari sleep panjang. Ia memiliki pengetahuan yang mencakup semua tanaman dan alam kehidupan. Ketulusan dan kepeduliannya pada semua makhluk hidup terlihat dari setiap tindakannya.",
        words: "Kehidupan adalah hadiah terbesar.",
        sound: "sounds/nahida2.mp3",
        traits: { brave: 1, smart: 3, gentle: 3, leader: 2, warm: 3, cautious: 1 }
    },
    {
        name: "Ganyu",
        gender: "female",
        img: "images/ganyu.png",
        desc: "Adeptus dengan delikat tapi tangguh.",
        details: "Ganyu adalah adeptus setengah qilin dengan pekerjaan berat di telinggan. Ia dedicated pada tugasnya dengan presisi yang menakjubkan. Meskipun bekerja keras, ia memiliki sisi yang lembut dan peduli pada orang lain.",
        words: "Kewajiban adalah prioritas utama saya.",
        sound: "sounds/ganyu.mp3",
        traits: { brave: 2, smart: 3, gentle: 1, leader: 1, warm: 1, cautious: 2 }
    },
    {
        name: "Xingqiu",
        gender: "male",
        img: "images/xingqiu.png",
        desc: "Novel enthusiast dengan hati yang baik.",
        details: "Xingqiu adalah putra keluarga bangsawan yang suka membaca novel seni. Ia memiliki imajinasi yang kaya dan hati yang peduli pada keadilan. Meskipun dari keluarga kaya, ia tidak sombong dan sering membantu orang lain.",
        words: "Cerita memiliki kekuatan untuk mengubah dunia.",
        sound: "sounds/xingqiu.mp3",
        traits: { brave: 1, smart: 2, gentle: 2, leader: 0, warm: 2, cautious: 1 }
    },
    {
        name: "Yelan",
        gender: "female",
        img: "images/yelan.png",
        desc: "Agent tersembunyi dengan tujuan mulia.",
        details: "Yelan adalah agent rahasia yang bekerja untuk melindungi orang-orang yang tidak bisa dilindungi sendiri. Ia cerdas dan dapat menggunakan berbagai teknik untuk mencapai tujuannya. Meskipun mengerjakan hal-hal gelap, hatinya tetap bersih dan penuh kasih.",
        words: "Aku akan melindungi dari bayangan.",
        sound: "sounds/yelan.mp3",
        traits: { brave: 3, smart: 3, gentle: 1, leader: 1, warm: 2, cautious: 2 }
    },
    {
        name: "Hu Tao 2",
        gender: "female",
        img: "images/hutao2.png",
        desc: "Bisnis wanita dengan bisnis yang beruntung.",
        details: "Hu Tao jr adalah asisten direktur yang belajar langsung dari pemimpin. Ia memiliki semangat yang sama dalam berbisnis dan selalu mencari cara baru untuk memberikan layanan terbaik.",
        words: "Pelayanan terbaik adalah komitmen kami!",
        sound: "sounds/hutao2.mp3",
        traits: { brave: 1, smart: 2, gentle: 2, leader: 1, warm: 3, cautious: 0 }
    },
    {
        name: "Mika",
        gender: "male",
        img: "images/mika.png",
        desc: "Prajurit Kapten dengan loyalitas tinggi.",
        details: "Mika adalah prajurit muda dari Favonius dengan dedikasi penuh pada tugas. Ia memiliki tekad besi dan loyalitas yang tidak dapat goyahkan. Meskipun muda, ia sudah menunjukkan kemampuan kepemimpinan yang luar biasa.",
        words: "Favonius adalah kebanggaan saya!",
        sound: "sounds/mika.mp3",
        traits: { brave: 3, smart: 2, gentle: 1, leader: 2, warm: 2, cautious: 0 }
    },
    {
        name: "Freminet",
        gender: "male",
        img: "images/freminet.png",
        desc: "Penyelam berani dengan hati yang hangat.",
        details: "Freminet adalah penyelam profesional yang menggali harta karun dari laut dalam. Ia memiliki keberanian luar biasa namun hati yang sangat hangat. Kasih sayangnya pada saudara dan teman-temannya tidak tertandingi.",
        words: "Laut menyimpan banyak rahasia indah.",
        sound: "sounds/freminet.mp3",
        traits: { brave: 3, smart: 1, gentle: 2, leader: 0, warm: 3, cautious: 0 }
    },
    {
        name: "Lynette",
        gender: "female",
        img: "images/lynette.png",
        desc: "Pencuri terampil dengan hati yang baik.",
        details: "Lynette adalah pencuri terampil yang menggunakan keterampilannya untuk kebaikan. Ia dapat masuk ke mana saja tanpa diketahui dan mencuri kembali yang telah diambil tidak adil. Ketulusan hatinya membuat dia pahlawan yang dicintai rakyat.",
        words: "Keadilan dimulai dari sini.",
        sound: "sounds/lynette.mp3",
        traits: { brave: 2, smart: 2, gentle: 2, leader: 0, warm: 2, cautious: 2 }
    },
    {
        name: "Lyney",
        gender: "male",
        img: "images/lyney.png",
        desc: "Magician ceria dengan trik menakjubkan.",
        details: "Lyney adalah magician profesional dengan trik yang memukau semua orang. Ia ceria dan selalu mencari cara untuk membuat orang tertawa dan senang. Di balik trik-triknya, ia adalah seorang dengan hati yang tulus dan ingin memberikan kebahagiaan.",
        words: "Sihir adalah seni membuat mimpi nyata!",
        sound: "sounds/lyney.mp3",
        traits: { brave: 1, smart: 2, gentle: 2, leader: 1, warm: 3, cautious: 0 }
    },
    {
        name: "Kaeya",
        gender: "male",
        img: "images/kaeya.png",
        desc: "Kapten Calvary dengan rahasia gelap.",
        details: "Kaeya adalah Kapten Cavalry Order dengan masa lalu yang kompleks. Ia memiliki pesona dan kecerdasan yang tajam dalam strategi. Meskipun memiliki rahasia, ia loyal pada orang yang ia pedulikan dan akan melindungi mereka.",
        words: "Setiap rahasia memiliki harga.",
        sound: "sounds/kaeya.mp3",
        traits: { brave: 2, smart: 3, gentle: 1, leader: 2, warm: 1, cautious: 2 }
    },
    {
        name: "Amber",
        gender: "female",
        img: "images/amber.png",
        desc: "Outrider ceria dengan energi tak terbatas.",
        details: "Amber adalah outrider Favonius dengan semangat yang sangat tinggi. Ia optimis dan penuh energi dalam setiap tugas yang diberikan kepadanya. Ketulusan dan kemalasannya membuat dia disayangi oleh semua rekan kerjanya.",
        words: "Mari kita jelajahi petualangan baru!",
        sound: "sounds/amber.mp3",
        traits: { brave: 2, smart: 1, gentle: 1, leader: 0, warm: 3, cautious: 0 }
    },
    {
        name: "Barbara",
        gender: "female",
        img: "images/barbara.png",
        desc: "Deaconess suci dengan kepedulian mendalam.",
        details: "Barbara adalah deaconess Church of Favonius dengan dedikasi pada penyembuhan orang lain. Ia memiliki suara yang indah dan hati yang sangat murah hati. Kepeduliannya pada kesejahteraan orang lain tidak tertandingi oleh apapun.",
        words: "Mari kita sembuhkan semua orang.",
        sound: "sounds/barbara.mp3",
        traits: { brave: 1, smart: 1, gentle: 3, leader: 0, warm: 3, cautious: 0 }
    },
    {
        name: "Sucrose",
        gender: "female",
        img: "images/sucrose.png",
        desc: "Alchemist pemula dengan rasa ingin tahu.",
        details: "Sucrose adalah alchemist pemula dengan rasa ingin tahu yang sangat tinggi. Ia percaya pada kekuatan eksperimen dan discovery. Meskipun sering membuat kesalahan, semangatnya untuk belajar tidak pernah surut dan dia selalu maju.",
        words: "Setiap eksperimen adalah pembelajaran baru!",
        sound: "sounds/sucrose.mp3",
        traits: { brave: 1, smart: 2, gentle: 1, leader: 0, warm: 2, cautious: 1 }
    },
    {
        name: "Bennett",
        gender: "male",
        img: "images/bennett.png",
        desc: "Adventurer bersemangat dengan nasib buruk.",
        details: "Bennett adalah adventurer bersemangat dengan nasib yang selalu menimpa. Meskipun selalu naas, ia tidak pernah menyerah dan tetap optimis. Keberaniannya menghadapi tantangan dengan senyuman membuat dia inspirasi bagi orang lain.",
        words: "Kemenangan datang untuk yang bersemangat!",
        sound: "sounds/bennett.mp3",
        traits: { brave: 3, smart: 1, gentle: 1, leader: 1, warm: 2, cautious: 0 }
    },
    {
        name: "Genshin Master",
        gender: "male",
        img: "images/genshinmaster.png",
        desc: "Petualang legendaris dengan pengetahuan luas.",
        details: "Genshin Master adalah petualang legendaris yang telah mengunjungi setiap sudut dunia. Ia memiliki pengetahuan yang luas tentang berbagai hal dan selalu siap berbagi ilmunya dengan orang lain.",
        words: "Petualangan adalah kehidupan sejati.",
        sound: "sounds/genshinmaster.mp3",
        traits: { brave: 3, smart: 3, gentle: 1, leader: 2, warm: 2, cautious: 1 }
    },
    {
        name: "Diona",
        gender: "female",
        img: "images/diona.png",
        desc: "Bartender kucing dengan resep rahasia.",
        details: "Diona adalah bartender dengan telinga kucing dan resep minuman rahasia. Ia terampil dalam membuat minuman yang sempurna untuk setiap orang. Meskipun terlihat kelam, hatinya sangat hangat dan peduli pada pelanggan setia barnya.",
        words: "Minuman yang sempurna untuk malam yang sempurna.",
        sound: "sounds/diona.mp3",
        traits: { brave: 1, smart: 2, gentle: 1, leader: 0, warm: 2, cautious: 1 }
    },
    {
        name: "Mwendu",
        gender: "male",
        img: "images/mwendu.png",
        desc: "Krieger Afrika dengan hati baik.",
        details: "Mwendu adalah krieger Afrika dengan kekuatan yang luar biasa namun hati yang sangat baik. Ia melindungi orang lemah dan tidak suka ketidakadilan. Kehangatannya dan kepeduliannya membuat dia menjadi pemimpin yang dihormati.",
        words: "Kekuatan harus digunakan untuk melindungi.",
        sound: "sounds/mwendu.mp3",
        traits: { brave: 3, smart: 2, gentle: 2, leader: 3, warm: 3, cautious: 0 }
    },
    {
        name: "Childe",
        gender: "male",
        img: "images/childe.png",
        desc: "Aksial perang dengan cinta pada pertarungan.",
        details: "Childe adalah powerful warrior dari Fatui dengan cinta yang mendalam pada pertarungan. Ia mencari lawan yang kuat untuk dihadapi. Meskipun terlihat kejam, ia memiliki sisi hati yang peduli pada orang-orang dekat dengannya.",
        words: "Pertarungan sejati adalah kebebasan tertinggi.",
        sound: "sounds/childe.mp3",
        traits: { brave: 3, smart: 2, gentle: 0, leader: 1, warm: 1, cautious: 0 }
    },
    {
        name: "Shenhe",
        gender: "female",
        img: "images/shenhe.png",
        desc: "Pelindung dengan kekuatan supernatural.",
        details: "Shenhe adalah pelindung dengan kekuatan supernatural yang diwarisi dari leluhurnya. Ia berdedikasi untuk melindungi orang-orang dari bahaya supernatural. Meskipun terlihat dingin, ia memiliki hati yang sangat peduli pada mereka yang dilindunginya.",
        words: "Perlindungan adalah satu-satunya prioritas saya.",
        sound: "sounds/shenhe.mp3",
        traits: { brave: 3, smart: 2, gentle: 1, leader: 1, warm: 1, cautious: 1 }
    },
    {
        name: "Eula",
        gender: "female",
        img: "images/eula.png",
        desc: "Kapten dengan rasa keadilan yang kuat.",
        details: "Eula adalah kapten Order of Favonius dengan rasa keadilan yang sangat kuat. Ia memiliki kode etik yang ketat dan tidak akan berkompromi dengan ketidakadilan. Keberaniannya dan loyalitasnya membuat dia menjadi pemimpin yang disegani.",
        words: "Keadilan harus ditegakkan apapun harganya.",
        sound: "sounds/eula.mp3",
        traits: { brave: 3, smart: 2, gentle: 0, leader: 3, warm: 1, cautious: 1 }
    },
    {
        name: "Ayato",
        gender: "male",
        img: "images/ayato.png",
        desc: "Ketua klan dengan strategi brilian.",
        details: "Ayato adalah ketua Klan Kamisato dengan strategi bisnis yang brilliant. Ia memiliki wawasan yang tajam tentang masa depan dan selalu membuat keputusan yang tepat. Meskipun sibuk dengan bisnis, ia tetap memiliki waktu untuk keluarganya.",
        words: "Strategi yang tepat membawa kesuksesan.",
        sound: "sounds/ayato.mp3",
        traits: { brave: 2, smart: 3, gentle: 1, leader: 3, warm: 2, cautious: 1 }
    },
    {
        name: "Fischl Lumine",
        gender: "female",
        img: "images/fischllumine.png",
        desc: "Investigator muda dengan kemampuan tumbuh.",
        details: "Fischl Lumine adalah investigator muda yang terus berkembang kemampuannya. Ia belajar dari senior dan selalu mencari cara baru untuk memecahkan kasus. Semangatnya untuk belajar dan adventure tidak pernah surut.",
        words: "Setiap kasus adalah pelajaran baru.",
        sound: "sounds/fischllumine.mp3",
        traits: { brave: 2, smart: 2, gentle: 1, leader: 0, warm: 2, cautious: 1 }
    },
    {
        name: "WW-Rover2",
        gender: "male",
        img: "images/ww_rover2.png",
        desc: "Petualang misterius dengan evolusi kekuatan.",
        details: "WW Rover adalah penjelajah dengan kekuatan yang terus berkembang seiring petualangannya. Ia mencari jawaban atas asal-muasalnya sambil membantu orang-orang di sekitarnya. Ketulusan dan kebaikan hatinya membuat dia teman yang dapat diandalkan.",
        words: "Aku harus terus maju dan mencari jawaban.",
        sound: "sounds/ww_rover2.mp3",
        traits: { brave: 2, smart: 2, gentle: 2, leader: 1, warm: 2, cautious: 1 }
    },
    {
        name: "Sanhua2",
        gender: "female",
        img: "images/sanhua2.png",
        desc: "Pejuang gaya dengan gerakan yang indah.",
        details: "Sanhua adalah pejuang dengan gaya yang elegan dan gerakan yang sangat indah. Ia menggabungkan seni dengan kekuatan pertarungan dengan sempurna. Kepribadian yang glamor menyembunyikan profesional sejati.",
        words: "Keindahan dan kekuatan adalah satu kesatuan.",
        sound: "sounds/sanhua2.mp3",
        traits: { brave: 2, smart: 2, gentle: 1, leader: 1, warm: 2, cautious: 1 }
    },
    {
        name: "Aalto2",
        gender: "male",
        img: "images/aalto2.png",
        desc: "Pencuri dengan moral yang kuat.",
        details: "Aalto adalah pencuri berhati baik yang menggunakan keahliannya untuk membantu orang yang tertindas. Ia memiliki kode etik yang ketat dan tidak akan pernah menyakiti orang yang tidak bersalah. Kehangatan dan loyalitasnya membuat dia dihargai oleh banyak orang.",
        words: "Keadilan dimulai dari hati yang murni.",
        sound: "sounds/aalto2.mp3",
        traits: { brave: 2, smart: 3, gentle: 2, leader: 0, warm: 3, cautious: 1 }
    },
    {
        name: "Jiyan2",
        gender: "male",
        img: "images/jiyan2.png",
        desc: "Prajurit terlatih dengan dedikasi absolut.",
        details: "Jiyan adalah prajurit terlatih dengan disiplin yang ketat dan dedikasi absolut pada tugasnya. Ia pemimpin yang dihormati dan selalu memberikan contoh yang baik kepada bawahannya. Keberaniannya dalam pertempuran tidak tertandingi.",
        words: "Tugas pertama, keluarga kedua.",
        sound: "sounds/jiyan2.mp3",
        traits: { brave: 3, smart: 2, gentle: 1, leader: 2, warm: 2, cautious: 0 }
    },
    {
        name: "Lingyang2",
        gender: "female",
        img: "images/lingyang2.png",
        desc: "Petarung energik dengan semangat berkobar.",
        details: "Lingyang adalah petarung energik dengan semangat yang berkobar-kobar. Ia tidak takut menghadapi tantangan apapun dan selalu siap untuk pertarungan berikutnya. Cerianya menular dan membuat tim tetap antusias.",
        words: "Mari kita pertunjukkan semangat kita!",
        sound: "sounds/lingyang2.mp3",
        traits: { brave: 3, smart: 1, gentle: 1, leader: 1, warm: 3, cautious: 0 }
    },
    {
        name: "Calcharo2",
        gender: "male",
        img: "images/calcharo2.png",
        desc: "Pemburu profesional dengan pengalaman luas.",
        details: "Calcharo adalah pemburu profesional yang telah melacak berbagai jenis makhluk. Keahliannya sangat spesifik dan sangat dicari. Meskipun berbisnis dengan profesional, ia memiliki standar etik yang tinggi.",
        words: "Setiap pemburu memiliki spesialisasi mereka.",
        sound: "sounds/calcharo2.mp3",
        traits: { brave: 2, smart: 3, gentle: 1, leader: 1, warm: 1, cautious: 2 }
    },
    {
        name: "Encore2",
        gender: "female",
        img: "images/encore2.png",
        desc: "Petunjuk pertunjukan dengan impian besar.",
        details: "Encore adalah petunjuk pertunjukan dengan mimpi besar untuk kesuksesan global. Ia penuh energi dan optimisme yang menular. Kehangatannya dan kepedulian pada timnya membuat mereka rela bekerja keras.",
        words: "Pertunjukan must go on, selalu!",
        sound: "sounds/encore2.mp3",
        traits: { brave: 1, smart: 2, gentle: 2, leader: 2, warm: 3, cautious: 0 }
    },
    {
        name: "Mortefi2",
        gender: "male",
        img: "images/mortefi2.png",
        desc: "Insinyur jenius dengan detail sempurna.",
        details: "Mortefi adalah insinyur jenius yang dapat membangun apapun dengan presisi. Ketelitiannya tidak pernah berkompromis dengan hasil yang biasa saja. Di balik dedikasi kerjanya, ia adalah teman yang dapat diandalkan.",
        words: "Presisi adalah kunci kesempurnaan.",
        sound: "sounds/mortefi2.mp3",
        traits: { brave: 1, smart: 3, gentle: 1, leader: 1, warm: 2, cautious: 1 }
    },
    {
        name: "Verina2",
        gender: "female",
        img: "images/verina2.png",
        desc: "Bayangan dengan loyalitas mutlak.",
        details: "Verina adalah bayangan dengan tekad besi dan loyalitas yang mutlak pada tujuannya. Gerakannya elegan namun mematikan dalam pertarungan. Ia bekerja di balik layar untuk mencapai visi besarnya.",
        words: "Bayangan tidak pernah gagal.",
        sound: "sounds/verina2.mp3",
        traits: { brave: 2, smart: 3, gentle: 0, leader: 1, warm: 0, cautious: 3 }
    },
    {
        name: "Deshret2",
        gender: "male",
        img: "images/deshret2.png",
        desc: "Prajurit gurun dengan hikmat kuno.",
        details: "Deshret adalah prajurit gurun dengan kebijaksanaan kuno yang bertahan ribuan tahun. Pengalamannya tentang alam gurun tidak tertandingi. Ia adalah mentor yang berharga dengan wawasan mendalam.",
        words: "Pasir mencatat semua sejarah.",
        sound: "sounds/deshret2.mp3",
        traits: { brave: 2, smart: 3, gentle: 1, leader: 2, warm: 2, cautious: 1 }
    },
    {
        name: "Tiya2",
        gender: "female",
        img: "images/tiya2.png",
        desc: "Gadis ceria dengan sifat yang menggemaskan.",
        details: "Tiya adalah gadis ceria dengan kepribadian yang sangat menggemaskan. Ia selalu optimis dan penuh energi dalam setiap situasi. Kepolosan dan ketulusan hatinya membuat dia disukai oleh semua orang.",
        words: "Hidup itu indah ketika ada yang membantu!",
        sound: "sounds/tiya2.mp3",
        traits: { brave: 0, smart: 1, gentle: 2, leader: 0, warm: 3, cautious: 0 }
    },
    {
        name: "Scar2",
        gender: "male",
        img: "images/scar2.png",
        desc: "Prajurit penyembah dengan harapan baru.",
        details: "Scar adalah prajurit dengan masa lalu kelam yang mencari penebusan melalui tindakan baik. Kedalaman emosi dan pemahamannya membuat dia bijaksana. Perjalanannya menuju cahaya terus berlanjut dengan determinasi.",
        words: "Penebusan adalah tujuan akhir saya.",
        sound: "sounds/scar2.mp3",
        traits: { brave: 2, smart: 2, gentle: 2, leader: 1, warm: 2, cautious: 1 }
    },
    {
        name: "Yangyang2",
        gender: "female",
        img: "images/yangyang2.png",
        desc: "Pelayan setia dengan perlindungan maksimal.",
        details: "Yangyang adalah pelayan setia dengan naluri perlindungan yang sangat kuat. Ia berdedikasi penuh untuk melayani dan melindungi orang yang ia pedulikan. Kelembutannya tidak berarti kelemahan - ia memiliki tekad besi.",
        words: "Perlindungan adalah prioritas utama saya.",
        sound: "sounds/yangyang2.mp3",
        traits: { brave: 2, smart: 1, gentle: 3, leader: 0, warm: 3, cautious: 1 }
    },
    {
        name: "Baizhi2",
        gender: "female",
        img: "images/baizhi2.png",
        desc: "Tabib mahir dengan intuisi tinggi.",
        details: "Baizhi adalah tabib mahir dengan intuisi yang sangat tinggi tentang penyakit. Pengetahuan medisnya dikombinasikan dengan kepercayaan pada kekuatan alam. Ia tenang dalam krisis dan selalu tahu apa yang harus dilakukan.",
        words: "Kesehatan adalah warisan sejati.",
        sound: "sounds/baizhi2.mp3",
        traits: { brave: 1, smart: 2, gentle: 3, leader: 0, warm: 3, cautious: 1 }
    },
    {
        name: "Sanhua3",
        gender: "female",
        img: "images/sanhua3.png",
        desc: "Pejuang glamor dengan teknik sempurna.",
        details: "Sanhua adalah pejuang dengan gaya glamor yang menyembunyikan profesionalisme sejati. Setiap gerakan adalah hasil dari latihan bertahun-tahun. Ia percaya bahwa keindahan dan kekuatan adalah satu kesatuan.",
        words: "Keanggunan adalah kekuatan sejati.",
        sound: "sounds/sanhua3.mp3",
        traits: { brave: 2, smart: 2, gentle: 1, leader: 1, warm: 2, cautious: 1 }
    },
    {
        name: "Carlotta2",
        gender: "female",
        img: "images/carlotta2.png",
        desc: "Investigator cerdas dengan naluri kejam.",
        details: "Carlotta adalah investigator dengan kecerdasan tajam dalam menganalisis kasus. Nalurinya untuk menemukan kebenaran tidak pernah salah. Ia tidak akan berhenti sampai menemukan jawaban yang benar.",
        words: "Kebenaran tidak bisa disembunyikan selamanya.",
        sound: "sounds/carlotta2.mp3",
        traits: { brave: 2, smart: 3, gentle: 0, leader: 1, warm: 1, cautious: 2 }
    },
    {
        name: "Ling2",
        gender: "female",
        img: "images/ling2.png",
        desc: "Penari dengan ekspresi penuh.",
        details: "Ling adalah penari dengan jiwa bebas yang mengekspresikan emosi melalui gerakan. Setiap tarian adalah sebuah cerita yang mendalam. Ia menginspirasi orang lain untuk percaya pada kebebasan ekspresi.",
        words: "Menari adalah bahasa tertua di dunia.",
        sound: "sounds/ling2.mp3",
        traits: { brave: 1, smart: 1, gentle: 2, leader: 0, warm: 3, cautious: 0 }
    },
    {
        name: "WW Master",
        gender: "male",
        img: "images/ww_master.png",
        desc: "Pertarungan master dari Wuthering Waves.",
        details: "WW Master adalah pejuang master dengan pengalaman yang sangat panjang. Ia telah menghadapi berbagai tantangan dan selalu keluar sebagai pemenang. Pengetahuannya tentang seni pertarungan tidak tertandingi.",
        words: "Pengalaman adalah guru terbaik.",
        sound: "sounds/ww_master.mp3",
        traits: { brave: 3, smart: 3, gentle: 1, leader: 2, warm: 1, cautious: 1 }
    },
    {
        name: "Zhezhi2",
        gender: "female",
        img: "images/zhezhi2.png",
        desc: "Pedagang cerdas dengan hati baik.",
        details: "Zhezhi adalah pedagang cerdas yang memahami nilai setiap hal. Di balik bisnisnya yang tajam, ia memiliki simpati mendalam pada mereka yang membutuhkan. Ia bantu mereka meskipun itu merugikan bisnis.",
        words: "Bisnis adalah tentang hubungan manusia.",
        sound: "sounds/zhezhi2.mp3",
        traits: { brave: 1, smart: 3, gentle: 2, leader: 1, warm: 3, cautious: 1 }
    },
    {
        name: "Pickles2",
        gender: "male",
        img: "images/pickles2.png",
        desc: "Perajin dengan tangan ajaib.",
        details: "Pickles adalah perajin dengan kemampuan memperbaiki hampir apapun dengan sempurna. Ketelitiannya dalam pekerjaan tidak ada yang tertandingi. Ia pendiam namun selalu siap membantu saat dibutuhkan.",
        words: "Setiap benda memiliki kehidupan tersendiri.",
        sound: "sounds/pickles2.mp3",
        traits: { brave: 1, smart: 3, gentle: 1, leader: 0, warm: 2, cautious: 1 }
    },
    {
        name: "Jessica2",
        gender: "female",
        img: "images/jessica2.png",
        desc: "Jurnalis berani dengan komitmen kebenaran.",
        details: "Jessica adalah jurnalis berani dengan tekad kuat mengungkap kebenaran. Ia tidak takut mengkritik status quo dan mempertanyakan otoritas. Keberanian dan integritasnya membuat dia tokoh penting.",
        words: "Jurnalisme adalah penjaga kebenaran.",
        sound: "sounds/jessica2.mp3",
        traits: { brave: 3, smart: 3, gentle: 0, leader: 1, warm: 1, cautious: 1 }
    },
    {
        name: "Kanjira2",
        gender: "female",
        img: "images/kanjira2.png",
        desc: "Penyerang cepat dengan disiplin tinggi.",
        details: "Kanjira adalah penyerang dengan kecepatan yang luar biasa. Disiplin tinggi dalam latihan telah menghasilkan teknik yang sempurna. Ia adalah pejuang yang patut ditakuti dalam pertandingan.",
        words: "Kecepatan yang terukur adalah kemenangan.",
        sound: "sounds/kanjira2.mp3",
        traits: { brave: 2, smart: 2, gentle: 0, leader: 0, warm: 1, cautious: 1 }
    },
    {
        name: "Medicine2",
        gender: "female",
        img: "images/medicine2.png",
        desc: "Perawat penyembuh dengan dedikasi cinta.",
        details: "Medicine Pocket adalah perawat dengan hati sangat besar untuk membantu orang. Dedikasi dan kepeduliannya membuat dia dicintai semua orang. Ia melayani dengan penuh kasih sayang.",
        words: "Penyembuhan adalah tujuan saya.",
        sound: "sounds/medicine2.mp3",
        traits: { brave: 1, smart: 2, gentle: 3, leader: 0, warm: 3, cautious: 0 }
    },
    {
        name: "Monday2",
        gender: "female",
        img: "images/monday2.png",
        desc: "Gadis ceria yang menyebarkan kebahagiaan.",
        details: "Monday adalah gadis dengan energi yang menular ke semua orang. Cerianya membuat situasi tersulit terasa lebih ringan. Ia percaya pada kekuatan kegembiraan dan persahabatan.",
        words: "Kegembiraan adalah obat terbaik.",
        sound: "sounds/monday2.mp3",
        traits: { brave: 1, smart: 1, gentle: 2, leader: 0, warm: 3, cautious: 0 }
    },
    {
        name: "Liushen2",
        gender: "female",
        img: "images/liushen2.png",
        desc: "Pendahulu dengan kebijaksanaan abadi.",
        details: "Liushen adalah pendahulu dengan kebijaksanaan yang terakumulasi berabad-abad. Ia memiliki pemahaman mendalam tentang dunia dan misteri. Ketenangan dan kesabarannya adalah hasil pengalaman panjang.",
        words: "Waktu adalah guru semua orang.",
        sound: "sounds/liushen2.mp3",
        traits: { brave: 1, smart: 3, gentle: 2, leader: 2, warm: 2, cautious: 2 }
    },
    {
        name: "Sonetto2",
        gender: "female",
        img: "images/sonetto2.png",
        desc: "Penjaga pengetahuan dengan dedikasi.",
        details: "Sonetto adalah penjaga pengetahuan dengan dedikasi tinggi pada tugasnya. Ia ahli dalam berbagai bidang ilmu dan selalu siap berbagi. Meskipun formal, hatinya sangat peduli pada orang-orang disekelilingnya.",
        words: "Pengetahuan adalah kunci pembebasan.",
        sound: "sounds/sonetto2.mp3",
        traits: { brave: 2, smart: 3, gentle: 1, leader: 2, warm: 2, cautious: 2 }
    },
    {
        name: "Shamane2",
        gender: "female",
        img: "images/shamane2.png",
        desc: "Dukun mistis dengan koneksi spiritual kuat.",
        details: "Shamane adalah dukun dengan koneksi spiritual yang sangat kuat. Ia memiliki intuisi tinggi dan pemahaman tentang hal-hal tersembunyi. Aura mistisnya membuat orang terkesan namun dia sangat bijaksana.",
        words: "Roh berbicara kepada hati yang murni.",
        sound: "sounds/shamane2.mp3",
        traits: { brave: 1, smart: 2, gentle: 2, leader: 1, warm: 2, cautious: 2 }
    },
    {
        name: "Aiwass2",
        gender: "male",
        img: "images/aiwass2.png",
        desc: "Sosok misterius dengan rencana berlapis.",
        details: "Aiwass adalah sosok misterius yang selalu mengetahui lebih dari yang ditunjukkan. Rencana berlapis dan motivasi tersembunyi membuat dia figur yang penuh teka-teki. Ia bermain di balik layar dengan percaya diri penuh.",
        words: "Rencana sejati tidak pernah terungkap.",
        sound: "sounds/aiwass2.mp3",
        traits: { brave: 2, smart: 3, gentle: 0, leader: 1, warm: 0, cautious: 3 }
    },
    {
        name: "Tzakol2",
        gender: "male",
        img: "images/tzakol2.png",
        desc: "Prajurit kuno dengan kekuatan legendaris.",
        details: "Tzakol adalah prajurit kuno dengan kekuatan legendaris dari masa lalu. Ia membawa warisan peradaban yang telah hilang. Determinasinya untuk melindungi masa depan tidak pernah goyah.",
        words: "Warisan masa lalu menuntun masa depan.",
        sound: "sounds/tzakol2.mp3",
        traits: { brave: 3, smart: 2, gentle: 1, leader: 2, warm: 1, cautious: 1 }
    },
    {
        name: "HSR-Seele2",
        gender: "female",
        img: "images/hsr_seele2.png",
        desc: "Pemberani yang bersinar terang.",
        details: "Seele adalah pemberani yang bersinar dengan keberanian luar biasa. Ia memicu aksi dan tidak suka menunggu lama. Kepemimpinannya alami dan menginspirasi orang di sekitarnya.",
        words: "Keberanian adalah cahaya di kegelapan.",
        sound: "sounds/hsr_seele2.mp3",
        traits: { brave: 3, smart: 1, gentle: 1, leader: 2, warm: 2, cautious: 0 }
    },
    {
        name: "Kafka2",
        gender: "female",
        img: "images/kafka2.png",
        desc: "Strategis misterius dengan tujuan tersembunyi.",
        details: "Kafka adalah sosok strategis dengan rencana yang selalu sempurna. Kecerdasan dan kepraktisannya membuat dia selangkah di depan. Misteri yang mengelilinginya membuat orang penasaran namun waspada.",
        words: "Rencana sempurna tidak memerlukan perubahan.",
        sound: "sounds/kafka2.mp3",
        traits: { brave: 2, smart: 3, gentle: 0, leader: 1, warm: 1, cautious: 2 }
    },
    {
        name: "Silver Wolf2",
        gender: "female",
        img: "images/silverwolf2.png",
        desc: "Hacker cemerlang dengan semangat playful.",
        details: "Silver Wolf adalah hacker cemerlang dengan kepribadian playful yang menyenangkan. Kecerdasannya dalam teknologi sangat tinggi namun ia menggunakannya dengan canda. Kehangatannya membuat orang di sekitarnya merasa diterima.",
        words: "Teknologi adalah permainan terbaik!",
        sound: "sounds/silverwolf2.mp3",
        traits: { brave: 2, smart: 3, gentle: 1, leader: 0, warm: 2, cautious: 1 }
    },
    {
        name: "Blade2",
        gender: "male",
        img: "images/blade2.png",
        desc: "Prajurit tangguh dengan tekad besi.",
        details: "Blade adalah prajurit tangguh dengan kekuatan yang luar biasa. Meskipun terlihat dingin dan asing, kode honornya kuat. Perjalanannya penuh dengan atribut gelap namun tujuannya mulia.",
        words: "Kekuatan sejati adalah dalam hati.",
        sound: "sounds/blade2.mp3",
        traits: { brave: 3, smart: 1, gentle: 0, leader: 1, warm: 0, cautious: 1 }
    },
    {
        name: "Luocha2",
        gender: "male",
        img: "images/luocha2.png",
        desc: "Misioner dengan tujuan mulia tersembunyi.",
        details: "Luocha adalah misioner ramah dengan tujuan tersembunyi yang hanya ia ketahui. Kehangatannya membuat orang nyaman di sekitarnya. Di balik senyumannya yang lembut ada ketegasan dan determinasi.",
        words: "Semua sesuai dengan rencana Tuhan.",
        sound: "sounds/luocha2.mp3",
        traits: { brave: 1, smart: 3, gentle: 2, leader: 2, warm: 3, cautious: 2 }
    },
    {
        name: "Dan Heng2",
        gender: "male",
        img: "images/danheng2.png",
        desc: "Pemuda protektif dengan rahasia dalam.",
        details: "Dan Heng adalah pemuda dengan protektivitas yang kuat pada teman-temannya. Masa lalunya misterius dan penuh duri. Meskipun pendiam, kedalaman emosi dan kepeduliannya sangat kuat.",
        words: "Aku akan melindungi apapun yang terjadi.",
        sound: "sounds/danheng2.mp3",
        traits: { brave: 2, smart: 2, gentle: 1, leader: 1, warm: 2, cautious: 2 }
    },
    {
        name: "Asta2",
        gender: "female",
        img: "images/asta2.png",
        desc: "Guru energik dengan semangat tinggi.",
        details: "Asta adalah guru dengan semangat yang tak tergoyahkan dan optimisme menular. Kepemimpinan alaminya menginspirasi orang untuk menjadi lebih baik. Energi tinggi dan kehangatannya membuat dia disayangi semua orang.",
        words: "Semangat adalah energi kehidupan sejati.",
        sound: "sounds/asta2.mp3",
        traits: { brave: 2, smart: 1, gentle: 2, leader: 3, warm: 3, cautious: 0 }
    },
    {
        name: "Bailu2",
        gender: "female",
        img: "images/bailu2.png",
        desc: "Penyembuh lembut dengan hati besar.",
        details: "Bailu adalah tabib muda dengan kelembutan yang menyampaikan kasih sayang. Dedikasi pada penyembuhan dan kepedulian pada setiap pasien sangat tinggi. Ia memiliki intuisi emosional yang tajam.",
        words: "Penyembuhan dimulai dari hati.",
        sound: "sounds/bailu2.mp3",
        traits: { brave: 1, smart: 1, gentle: 3, leader: 0, warm: 3, cautious: 1 }
    },
    {
        name: "Clara2",
        gender: "female",
        img: "images/clara2.png",
        desc: "Gadis berani dengan hati nurani kuat.",
        details: "Clara adalah gadis kecil dengan keberanian luar biasa besar. Keputusannya didorong oleh hati nurani yang kuat. Meskipun mungil, keberaniannya dan determinasinya membuat dia tidak boleh diremehkan.",
        words: "Kebaikan adalah kekuatan sejati.",
        sound: "sounds/clara2.mp3",
        traits: { brave: 3, smart: 1, gentle: 2, leader: 0, warm: 2, cautious: 0 }
    },
    {
        name: "Himeko2",
        gender: "female",
        img: "images/himeko2.png",
        desc: "Pemimpin dewasa dengan kebijaksanaan.",
        details: "Himeko adalah wanita dewasa dengan kepemimpinan yang dihormati semua orang. Keseimbangan sempurna antara tegas dan lembut dalam dirinya. Kehangatannya membuat orang merasa aman dan terlindungi.",
        words: "Kepemimpinan adalah tanggung jawab.",
        sound: "sounds/himeko2.mp3",
        traits: { brave: 2, smart: 2, gentle: 2, leader: 3, warm: 2, cautious: 1 }
    },
    {
        name: "Natasha2",
        gender: "female",
        img: "images/natasha2.png",
        desc: "Dokter berdedikasi dengan passion penyembuhan.",
        details: "Natasha adalah dokter berdedikasi dengan passion untuk menyembuhkan kehidupan. Kecerdasan medis tinggi dikombinasikan dengan empati mendalam. Komitmen pada keadilan dan penyelamatan nyawa tidak pernah goyah.",
        words: "Setiap nyawa memiliki nilai.",
        sound: "sounds/natasha2.mp3",
        traits: { brave: 2, smart: 2, gentle: 3, leader: 1, warm: 3, cautious: 1 }
    },
    {
        name: "Sampo2",
        gender: "male",
        img: "images/sampo2.png",
        desc: "Pengusaha berguna dengan misteri dalam.",
        details: "Sampo adalah karakter berguna dengan berbagai keahlian. Ia mahir beradaptasi dengan situasi apapun. Meskipun berbisnis, ada kedalaman dan tujuan tersembunyi di dalam dirinya.",
        words: "Bisnis adalah seni tawar-menawar.",
        sound: "sounds/sampo2.mp3",
        traits: { brave: 1, smart: 3, gentle: 1, leader: 0, warm: 2, cautious: 2 }
    },
    {
        name: "Serval2",
        gender: "female",
        img: "images/serval2.png",
        desc: "Mekanik energik dengan inovasi.",
        details: "Serval adalah mekanik dengan energi tinggi dan passion pada inovasi. Kecerdasan teknologi tidak tertandingi dalam bidangnya. Antusiasme dan semangat kerjanya menular ke semua orang.",
        words: "Teknologi adalah masa depan.",
        sound: "sounds/serval2.mp3",
        traits: { brave: 2, smart: 3, gentle: 0, leader: 1, warm: 2, cautious: 0 }
    },
    {
        name: "Pela2",
        gender: "female",
        img: "images/pela2.png",
        desc: "Tentara strategis dengan kepemimpinan.",
        details: "Pela adalah tentara strategis dengan pemahaman mendalam tentang perang. Kepemimpinan yang tegas membuat orang ingin mengikutinya. Keputusan didorong oleh logika namun juga pertimbangan manusiawi.",
        words: "Strategi adalah seni perang.",
        sound: "sounds/pela2.mp3",
        traits: { brave: 2, smart: 3, gentle: 1, leader: 3, warm: 1, cautious: 1 }
    },
    {
        name: "Hook2",
        gender: "female",
        img: "images/hook2.png",
        desc: "Anak berani yang tidak takut tantangan.",
        details: "Hook adalah anak kecil dengan keberanian luar biasa. Meskipun kecil, tekad dan keberaniannya membuat dia asset berharga tim. Hati besar dan kepedulian membuat dia disukai semua orang.",
        words: "Ukuran tubuh bukan ukuran keberanian.",
        sound: "sounds/hook2.mp3",
        traits: { brave: 3, smart: 1, gentle: 2, leader: 0, warm: 2, cautious: 0 }
    },
    {
        name: "Arlan2",
        gender: "male",
        img: "images/arlan2.png",
        desc: "Prajurit bersemangat dengan determinasi.",
        details: "Arlan adalah prajurit muda dengan semangat tinggi melindungi yang ia sayangi. Tekad kuat dan determinasi tidak tergoyahkan dalam pertarungan. Kesetiaan pada tim adalah nilai prioritasnya.",
        words: "Semangat adalah bahan bakar kemenangan.",
        sound: "sounds/arlan2.mp3",
        traits: { brave: 3, smart: 1, gentle: 1, leader: 1, warm: 2, cautious: 0 }
    },
    {
        name: "Sushang2",
        gender: "female",
        img: "images/sushang2.png",
        desc: "Penari api yang dinamis dan energik.",
        details: "Sushang adalah penari dengan gerakan elegan menyembunyikan kekuatan mematikan. Ia percaya keseimbangan antara seni dan pertarungan sempurna. Kepribadian ceria dan semangat membara membuat dia tak terlupakan.",
        words: "Tari adalah pernyataan kekuatan.",
        sound: "sounds/sushang2.mp3",
        traits: { brave: 2, smart: 1, gentle: 1, leader: 1, warm: 2, cautious: 0 }
    },
    {
        name: "Gepard2",
        gender: "male",
        img: "images/gepard2.png",
        desc: "Perlindung setia dengan kehormatan tinggi.",
        details: "Gepard adalah perlindung setia dengan tekad tak tergoyahkan melindungi yang disayangi. Kekuatan dan ketahanan luar biasa membuat dia pertahanan pertama. Kehormatan tinggi dan kode etik kuat memandu keputusannya.",
        words: "Perlindungan adalah kewajiban mulia.",
        sound: "sounds/gepard2.mp3",
        traits: { brave: 3, smart: 1, gentle: 1, leader: 2, warm: 2, cautious: 1 }
    },
    {
        name: "Bronya2",
        gender: "female",
        img: "images/bronya2.png",
        desc: "Pemimpin bijak dengan tanggung jawab.",
        details: "Bronya adalah pemimpin bijak memikul beban kepemimpinan dengan dedikasi penuh. Cerdas dalam strategi dengan visi jelas masa depan. Kepemimpinannya didasarkan logika namun juga empati mendalam.",
        words: "Pemimpin yang baik adalah pelayan.",
        sound: "sounds/bronya2.mp3",
        traits: { brave: 2, smart: 3, gentle: 1, leader: 3, warm: 2, cautious: 1 }
    },
    {
        name: "Jing Yuan2",
        gender: "male",
        img: "images/jingyuan2.png",
        desc: "Jenderal mantap dengan pengalaman ribuan tahun.",
        details: "Jing Yuan adalah jenderal dengan pengalaman panjang seni perang. Ketenangan dan kebijaksanaan datang dari pengalaman tak ternilai. Kemampuan melihat gambaran besar sangat tajam dan strategis.",
        words: "Pengalaman adalah guru terbaik.",
        sound: "sounds/jingyuan2.mp3",
        traits: { brave: 2, smart: 3, gentle: 1, leader: 3, warm: 1, cautious: 1 }
    },
    {
        name: "ZZZ-Ellen",
        gender: "female",
        img: "images/zzz_ellen.png",
        desc: "Detektor gadis dengan teknologi canggih.",
        details: "Ellen adalah detektor dari Zenless Zone Zero dengan teknologi canggih. Ia sangat terampil dalam menangani anomali dan hal-hal misterius. Dedikasi pada pekerjaan sangat tinggi namun ia tetap peduli pada rekan timnya.",
        words: "Misteri adalah tantangan terbaik.",
        sound: "sounds/zzz_ellen.mp3",
        traits: { brave: 2, smart: 3, gentle: 1, leader: 1, warm: 2, cautious: 1 }
    },
    {
        name: "ZZZ-Ben",
        gender: "male",
        img: "images/zzz_ben.png",
        desc: "Impactful commander dengan kepemimpinan tegas.",
        details: "Ben adalah commander dengan kepemimpinan tegas dan keputusan strategis. Ia memiliki visi jelas tentang masa depan organisasinya. Keberaniannya dalam mengambil keputusan sulit adalah kualitas utamanya.",
        words: "Kepemimpinan adalah tanggungjawab.",
        sound: "sounds/zzz_ben.mp3",
        traits: { brave: 3, smart: 3, gentle: 1, leader: 3, warm: 1, cautious: 1 }
    },
    {
        name: "ZZZ-Belle",
        gender: "female",
        img: "images/zzz_belle.png",
        desc: "Investigator dengan intuisi tinggi.",
        details: "Belle adalah investigator dengan intuisi yang sangat tinggi dalam menemukan kebenaran. Kecerdasan analitisnya tak tertandingi dalam memecahkan misteri. Dedikasi pada keadilan membuat dia tidak pernah berhenti mencari jawaban.",
        words: "Kebenaran memerlukan dedikasi.",
        sound: "sounds/zzz_belle.mp3",
        traits: { brave: 2, smart: 3, gentle: 0, leader: 1, warm: 1, cautious: 2 }
    },
    {
        name: "ZZZ-Evelyn",
        gender: "female",
        img: "images/zzz_evelyn.png",
        desc: "Profesional misterius dengan masa lalu.",
        details: "Evelyn adalah profesional misterius dengan masa lalu yang kompleks. Ia terampil dalam berbagai bidang dengan keahlian yang jarang ditemukan. Misteri yang melingkupinya membuat orang penasaran namun waspada.",
        words: "Masa lalu tidak pernah hilang sepenuhnya.",
        sound: "sounds/zzz_evelyn.mp3",
        traits: { brave: 2, smart: 3, gentle: 0, leader: 1, warm: 0, cautious: 3 }
    },
    {
        name: "ZZZ-Anby",
        gender: "female",
        img: "images/zzz_anby.png",
        desc: "Anak energik dengan potensi besar.",
        details: "Anby adalah anak dengan energi yang sangat tinggi dan potensi besar. Ia belajar cepat dan selalu bersemangat dalam setiap tugas. Kepolosan dan ketulusan hatinya membuat dia disukai oleh semua orang.",
        words: "Energi adalah kekuatan muda.",
        sound: "sounds/zzz_anby.mp3",
        traits: { brave: 2, smart: 1, gentle: 1, leader: 0, warm: 3, cautious: 0 }
    },
    {
        name: "ZZZ-Corin",
        gender: "male",
        img: "images/zzz_corin.png",
        desc: "Pemimpin berkarisma dengan visi jelas.",
        details: "Corin adalah pemimpin dengan karisma yang kuat dan visi jelas masa depan. Ia menginspirasi orang di sekitarnya untuk percaya padanya. Keputusan strategisnya selalu tepat dan menguntungkan.",
        words: "Visi adalah cahaya pemimpin.",
        sound: "sounds/zzz_corin.mp3",
        traits: { brave: 3, smart: 2, gentle: 1, leader: 3, warm: 2, cautious: 1 }
    },
    {
        name: "ZZZ-Luna",
        gender: "female",
        img: "images/zzz_luna.png",
        desc: "Pendukung tim dengan kehangatannya.",
        details: "Luna adalah pendukung tim dengan kehangatan yang menyampaikan kepedulian. Ia selalu siap membantu rekan timnya dalam situasi apapun. Ketulusan dan loyalitasnya membuat dia disayangi semua orang.",
        words: "Dukungan adalah bentuk cinta.",
        sound: "sounds/zzz_luna.mp3",
        traits: { brave: 1, smart: 1, gentle: 2, leader: 0, warm: 3, cautious: 0 }
    },
    {
        name: "ZZZ-Raven",
        gender: "female",
        img: "images/zzz_raven.png",
        desc: "Spesialis tersembunyi dengan keahlian unik.",
        details: "Raven adalah spesialis tersembunyi dengan keahlian Yang sangat unik dan jarang. Ia bekerja di balik layar dengan presisi tinggi. Misteri dan kedalaman dirinya membuat dia figur yang menarik.",
        words: "Spesialisasi adalah kekuatan sejati.",
        sound: "sounds/zzz_raven.mp3",
        traits: { brave: 1, smart: 3, gentle: 0, leader: 0, warm: 1, cautious: 3 }
    },
    {
        name: "ZZZ-Lucid",
        gender: "male",
        img: "images/zzz_lucid.png",
        desc: "Pemikir analitik dengan logika sempurna.",
        details: "Lucid adalah pemikir dengan logika sempurna dalam menganalisis situasi. Setiap keputusan didasarkan pada data dan analisis mendalam. Kecerdasan tingginya membuat dia asset berharga organisasinya.",
        words: "Logika adalah fondasi semua keputusan.",
        sound: "sounds/zzz_lucid.mp3",
        traits: { brave: 1, smart: 3, gentle: 0, leader: 1, warm: 1, cautious: 2 }
    },
    {
        name: "ZZZ-Zara",
        gender: "female",
        img: "images/zzz_zara.png",
        desc: "Pejuang wanita dengan kepercayaan diri.",
        details: "Zara adalah pejuang wanita dengan kepercayaan diri tinggi dalam pertarungan. Keahlian borunya sangat tinggi dan tekadnya tidak tergoyahkan. Keberaniannya membuat semua orang menghormatinya.",
        words: "Kepercayaan diri adalah senjata.",
        sound: "sounds/zzz_zara.mp3",
        traits: { brave: 3, smart: 2, gentle: 0, leader: 1, warm: 1, cautious: 1 }
    },
    {
        name: "ZZZ-Kira",
        gender: "female",
        img: "images/zzz_kira.png",
        desc: "Gadis cerdas dengan rasa ingin tahu.",
        details: "Kira adalah gadis cerdas dengan rasa ingin tahu yang sangat tinggi. Ia selalu ingin memahami cara kerja segala sesuatu. Semangat belajar dan eksplorasi tidak pernah surut.",
        words: "Pengetahuan adalah petualangan.",
        sound: "sounds/zzz_kira.mp3",
        traits: { brave: 1, smart: 3, gentle: 1, leader: 0, warm: 2, cautious: 1 }
    },
    {
        name: "ZZZ-Marcus",
        gender: "male",
        img: "images/zzz_marcus.png",
        desc: "Veteran pengalaman dengan kebijaksanaan.",
        details: "Marcus adalah veteran dengan pengalaman panjang di organisasi tersebut. Kebijaksanaan dan pengetahuannya sangat berharga bagi generasi baru. Kesetiaan dan dedikasi tidak pernah berkurang.",
        words: "Pengalaman mengajarkan kebijaksanaan.",
        sound: "sounds/zzz_marcus.mp3",
        traits: { brave: 2, smart: 3, gentle: 1, leader: 2, warm: 2, cautious: 2 }
    },
    {
        name: "ZZZ-April",
        gender: "female",
        img: "images/zzz_april.png",
        desc: "Pendamping setia dengan hati hangat.",
        details: "April adalah pendamping setia dengan hati yang sangat hangat. Ia selalu ada untuk mendukung rekan timnya dalam situasi sulit. Kebaikan dan kepeduliannya tidak pernah berkurang.",
        words: "Teman sejati adalah hadiah terbaik.",
        sound: "sounds/zzz_april.mp3",
        traits: { brave: 1, smart: 1, gentle: 3, leader: 0, warm: 3, cautious: 0 }
    },
    {
        name: "ZZZ-Cipher",
        gender: "male",
        img: "images/zzz_cipher.png",
        desc: "Enkriptor dengan teknologi canggih.",
        details: "Cipher adalah enkriptor dengan teknologi enkripsi paling canggih. Keahlian dalam bidang keamanan digital sangat tinggi dan jarang ditemukan. Dedikasi pada perlindungan data adalah prioritasnya.",
        words: "Keamanan adalah prioritas utama.",
        sound: "sounds/zzz_cipher.mp3",
        traits: { brave: 1, smart: 3, gentle: 1, leader: 1, warm: 1, cautious: 2 }
    },
    {
        name: "ZZZ-Nova",
        gender: "female",
        img: "images/zzz_nova.png",
        desc: "Bintang cerah dengan visi futuristik.",
        details: "Nova adalah bintang cerah dengan visi futuristik tentang teknologi. Inovasi adalah passion utamanya dan ide-idenya selalu ahead of time. Inspirasi yang dia berikan membuat orang percaya pada masa depan.",
        words: "Masa depan dimulai dari sekarang.",
        sound: "sounds/zzz_nova.mp3",
        traits: { brave: 2, smart: 3, gentle: 1, leader: 2, warm: 2, cautious: 1 }
    },
    {
        name: "ZZZ-Eclipse",
        gender: "male",
        img: "images/zzz_eclipse.png",
        desc: "Bayangan gelap dengan kedalaman hati.",
        details: "Eclipse adalah bayangan gelap dengan kedalaman hati yang tulus. Meskipun terlihat gelap, dedikasi pada misi sangat kuat. Loyalitas pada kebenaran membuat dia dipercaya rekan-rekannya.",
        words: "Kegelapan dan cahaya adalah bagian dari garis batas.",
        sound: "sounds/zzz_eclipse.mp3",
        traits: { brave: 2, smart: 2, gentle: 1, leader: 1, warm: 1, cautious: 2 }
    },
    {
        name: "ZZZ-Stellar",
        gender: "female",
        img: "images/zzz_stellar.png",
        desc: "Pelindung bintang dengan kekuatan kosmik.",
        details: "Stellar adalah pelindung dengan kekuatan yang seolah berasal dari kosmik. Dedikasi pada perlindungan sangat kuat dan tak tergoyahkan. Kehangatannya membuat orang merasa aman bersama dirinya.",
        words: "Bintang melindungi alam semesta.",
        sound: "sounds/zzz_stellar.mp3",
        traits: { brave: 3, smart: 2, gentle: 2, leader: 2, warm: 3, cautious: 1 }
    },
    {
        name: "R1999-Vertin2",
        gender: "female",
        img: "images/r1999_vertin2.png",
        desc: "Pemimpin dengan determinasi berlapis.",
        details: "Vertin adalah pemimpin dengan determinasi yang berlapis-lapis. Ia memandu tim melewati tantangan temporal yang kompleks dengan bijaksana. Kehangatannya membuat semua orang percaya pada kepemimpinannya.",
        words: "Bersama kita mengatasi apa pun.",
        sound: "sounds/r1999_vertin2.mp3",
        traits: { brave: 3, smart: 3, gentle: 2, leader: 3, warm: 3, cautious: 1 }
    },
    {
        name: "R1999-Schneider2",
        gender: "female",
        img: "images/r1999_schneider2.png",
        desc: "Pejuang profesional dengan focus tinggi.",
        details: "Schneider adalah pejuang profesional dengan fokus tinggi pada misi. Kekuatan dan teknik pertarangannya sangat presisi. Meskipun terlihat dingin, perhatian pada keselamatan tim sangat mendalam.",
        words: "Profesionalisme adalah standar saya.",
        sound: "sounds/r1999_schneider2.mp3",
        traits: { brave: 3, smart: 2, gentle: 1, leader: 2, warm: 1, cautious: 1 }
    },
    {
        name: "R1999-Matilda2",
        gender: "female",
        img: "images/r1999_matilda2.png",
        desc: "Ilmuwan dengan rasa ingin tahu tinggi.",
        details: "Matilda adalah ilmuwan dengan rasa ingin tahu yang tidak pernah puas. Dedikasi pada research temporal sangat kuat. Antusiasme menular membuat tim tertarik pada penemuan-penemuan.",
        words: "Penemuan adalah kegembiraan sejati.",
        sound: "sounds/r1999_matilda2.mp3",
        traits: { brave: 1, smart: 3, gentle: 1, leader: 0, warm: 2, cautious: 0 }
    },
    {
        name: "R1999-Druvis2",
        gender: "female",
        img: "images/r1999_druvis2.png",
        desc: "Seniman dengan visi unlimited.",
        details: "Druvis adalah seniman dengan visi seni yang tidak terbatas. Kreativitas liar membawa perspektif unik ke setiap situasi. Keberanian untuk berbeda membuatnya sangat berkesan pada orang lain.",
        words: "Seni adalah kebenaran akhir.",
        sound: "sounds/r1999_druvis2.mp3",
        traits: { brave: 2, smart: 2, gentle: 1, leader: 0, warm: 2, cautious: 0 }
    },
    {
        name: "R1999-Leilani2",
        gender: "female",
        img: "images/r1999_leilani2.png",
        desc: "Api berbisik dengan semangat membara.",
        details: "Leilani adalah penyembur api dengan jiwa membara penuh semangat. Kekuatannya eksplosif dan keberaniannya sama besarnya. Keramahan pribadi membuat dia mudah disukai semua orang.",
        words: "Api adalah simbol semangat.",
        sound: "sounds/r1999_leilani2.mp3",
        traits: { brave: 3, smart: 1, gentle: 1, leader: 1, warm: 2, cautious: 0 }
    },
    {
        name: "R1999-Sotheby2",
        gender: "male",
        img: "images/r1999_sotheby2.png",
        desc: "Pedagang dengan jaringan luas.",
        details: "Sotheby adalah pedagang dengan jaringan informasi sangat luas. Ia tahu cara memanfaatkan situasi untuk keuntungan. Meskipun bisnisnya tajam, kode etik terhadap tim kuat.",
        words: "Bisnis adalah pertukaran nilai.",
        sound: "sounds/r1999_sotheby2.mp3",
        traits: { brave: 1, smart: 3, gentle: 1, leader: 0, warm: 1, cautious: 2 }
    },
    {
        name: "R1999-Regulus2",
        gender: "male",
        img: "images/r1999_regulus2.png",
        desc: "Petarung garis depan tak kenal lelah.",
        details: "Regulus adalah petarung garis depan dengan semangat tak kenal lelah. Keberanian menghadapi musuh adalah kualitas utamanya. Ia jatuh bangun terus menerus namun loyalitas pada tim mutlak.",
        words: "Garis depan adalah posisi kehormatan.",
        sound: "sounds/r1999_regulus2.mp3",
        traits: { brave: 3, smart: 1, gentle: 0, leader: 1, warm: 1, cautious: 0 }
    },
    {
        name: "R1999-Bingling2",
        gender: "female",
        img: "images/r1999_bingling2.png",
        desc: "Pemula dengan potensi besar.",
        details: "Bingling adalah pemula yang masih belajar tentang dunia. Potensilnya sangat besar meskipun sering cuek. Rasa ingin tahu tinggi membuatnya terus berkembang dan belajar.",
        words: "Pemula adalah awal dari ahli.",
        sound: "sounds/r1999_bingling2.mp3",
        traits: { brave: 1, smart: 1, gentle: 2, leader: 0, warm: 2, cautious: 0 }
    },
    {
        name: "R1999-Ulpianus2",
        gender: "male",
        img: "images/r1999_ulpianus2.png",
        desc: "Prajurit dengan kepribadian rumit.",
        details: "Ulpianus adalah prajurit dengan kepribadian rumit sulit dipahami. Kekuatannya luar biasa namun cara bicaranya aneh. Loyalitas pada tujuan lebih kuat daripada pada orang.",
        words: "Takdir adalah pertanyaan abadi.",
        sound: "sounds/r1999_ulpianus2.mp3",
        traits: { brave: 2, smart: 2, gentle: 0, leader: 1, warm: 0, cautious: 2 }
    },
    {
        name: "R1999-Pickles3",
        gender: "male",
        img: "images/r1999_pickles3.png",
        desc: "Pengrajin dengan keahlian luar biasa.",
        details: "Pickles adalah pengrajin dengan keahlian memperbaiki hampir apapun sempurna. Ketelitiannya dalam pekerjaan tidak tertandingi. Pendiam namun selalu siap membantu saat dibutuhkan.",
        words: "Perbaikan adalah seni tersendiri.",
        sound: "sounds/r1999_pickles3.mp3",
        traits: { brave: 1, smart: 3, gentle: 1, leader: 0, warm: 1, cautious: 1 }
    },
    {
        name: "R1999-Jessica3",
        gender: "female",
        img: "images/r1999_jessica3.png",
        desc: "Jurnalis dengan komitmen kebenaran.",
        details: "Jessica adalah jurnalis berani dengan tekad kuat mengungkap kebenaran. Tidak takut mengkritik dan mempertanyakan otoritas. Integritas dan keberanian membuat dia tokoh penting.",
        words: "Jurnalisme adalah jantung demokrasi.",
        sound: "sounds/r1999_jessica3.mp3",
        traits: { brave: 2, smart: 3, gentle: 0, leader: 1, warm: 1, cautious: 1 }
    },
    {
        name: "R1999-Kanjira3",
        gender: "female",
        img: "images/r1999_kanjira3.png",
        desc: "Penyerang dengan kecepatan menakjubkan.",
        details: "Kanjira adalah penyerang dengan kecepatan luar biasa menakjubkan. Penguasaan seni bela diri sangat sempurna dan terlatih. Disiplin tinggi membuat gerakan sangat tajam dan berbahaya.",
        words: "Kecepatan adalah kesenangan sejati.",
        sound: "sounds/r1999_kanjira3.mp3",
        traits: { brave: 2, smart: 2, gentle: 0, leader: 0, warm: 1, cautious: 1 }
    },
    {
        name: "R1999-Medicine3",
        gender: "female",
        img: "images/r1999_medicine3.png",
        desc: "Perawat penyembuh dengan dedikasi cinta.",
        details: "Medicine Pocket adalah perawat dengan hati besar melayani. Dedikasi penyembuhan dan kepedulian membuat dia dicintai semua. Melayani adalah profesi yang dilakukannya dengan penuh kasih.",
        words: "Penyembuhan adalah hadiah terbesar.",
        sound: "sounds/r1999_medicine3.mp3",
        traits: { brave: 1, smart: 2, gentle: 3, leader: 0, warm: 3, cautious: 0 }
    },
    {
        name: "R1999-Monday3",
        gender: "female",
        img: "images/r1999_monday3.png",
        desc: "Pelenyapu ceria yang menyebarkan kebahagiaan.",
        details: "Monday adalah gadis ceria dengan energi menular membawa kebahagiaan. Kepercayaan pada kegembiraan dan persahabatan sangat kuat. Keaslian diri membuat dia diterima terbuka.",
        words: "Setiap hari adalah petualangan baru.",
        sound: "sounds/r1999_monday3.mp3",
        traits: { brave: 1, smart: 1, gentle: 2, leader: 0, warm: 3, cautious: 0 }
    },
    {
        name: "R1999-Liushen3",
        gender: "female",
        img: "images/r1999_liushen3.png",
        desc: "Pendahulu dengan hikmat abadi.",
        details: "Liushen adalah pendahulu dengan kebijaksanaan terakumulasi berabad-abad. Pemahaman mendalam tentang kekuatan dan misteri dunia dimiliki. Ketenangan dan kesabaran adalah hasil pengalaman panjang.",
        words: "Kebijaksanaan adalah cahaya keabadian.",
        sound: "sounds/r1999_liushen3.mp3",
        traits: { brave: 1, smart: 3, gentle: 2, leader: 2, warm: 2, cautious: 2 }
    },
    {
        name: "R1999-Sonetto3",
        gender: "female",
        img: "images/r1999_sonetto3.png",
        desc: "Penjaga pengetahuan dengan integritas.",
        details: "Sonetto adalah penjaga pengetahuan dengan dedikasi tinggi pada tugas. Ahli dalam berbagai bidang ilmu dan siap berbagi. Formal namun hati sangat peduli pada orang sekitarnya.",
        words: "Pengetahuan adalah pembebasan.",
        sound: "sounds/r1999_sonetto3.mp3",
        traits: { brave: 2, smart: 3, gentle: 1, leader: 2, warm: 1, cautious: 2 }
    },
    {
        name: "R1999-Shamane3",
        gender: "female",
        img: "images/r1999_shamane3.png",
        desc: "Dukun mistis dengan spiritual tinggi.",
        details: "Shamane adalah dukun dengan koneksi spiritual sangat kuat. Intuisi tinggi dan pemahaman hal tersembunyi dimiliki. Aura mistis membuat orang terkesan meskipun sangat bijaksana.",
        words: "Roh berbisik pada hati yang tulus.",
        sound: "sounds/r1999_shamane3.mp3",
        traits: { brave: 1, smart: 2, gentle: 2, leader: 1, warm: 2, cautious: 2 }
    },
    {
        name: "R1999-Aiwass3",
        gender: "male",
        img: "images/r1999_aiwass3.png",
        desc: "Misterius dengan rencana berlapis-lapis.",
        details: "Aiwass adalah sosok misterius yang selalu tahu lebih dari ditunjukkan. Rencana berlapis dan motivasi tersembunyi membuat figur penuh teka-teki. Bermain di balik layar dengan percaya diri penuh.",
        words: "Rencana sejati tidak pernah terungkap.",
        sound: "sounds/r1999_aiwass3.mp3",
        traits: { brave: 2, smart: 3, gentle: 0, leader: 1, warm: 0, cautious: 3 }
    },
    {
        name: "R1999-Tzakol3",
        gender: "male",
        img: "images/r1999_tzakol3.png",
        desc: "Prajurit kuno dengan power legendaris.",
        details: "Tzakol adalah prajurit kuno dengan kekuatan legendaris dari masa lalu. Membawa warisan peradaban telah hilang. Determinasi melindungi masa depan tidak pernah goyah.",
        words: "Masa lalu adalah guru masa depan.",
        sound: "sounds/r1999_tzakol3.mp3",
        traits: { brave: 3, smart: 2, gentle: 1, leader: 2, warm: 1, cautious: 1 }
    },
    { name: "ML-Lapu", gender: "male", img: "images/ml_lapu.png", desc: "Prajurit legendarai dengan pedang sakti.", details: "Lapu-Lapu adalah prajurit legendaris dengan pedang sakti yang tak terkalahkan.", words: "Legenda akan terus hidup!", sound: "sounds/ml_lapu.mp3", traits: { brave: 3, smart: 2, gentle: 1, leader: 2, warm: 1, cautious: 0 } },
    { name: "ML-Fanny", gender: "female", img: "images/ml_fanny.png", desc: "Pembunuh kilat dengan gerakan cepat.", details: "Fanny adalah pembunuh dengan gerakan kilat yang sulit ditangkap musuh.", words: "Kecepatan adalah kunci kemenangan.", sound: "sounds/ml_fanny.mp3", traits: { brave: 2, smart: 2, gentle: 0, leader: 0, warm: 1, cautious: 2 } },
    { name: "ML-Chou", gender: "male", img: "images/ml_chou.png", desc: "Pembawa seni beladiri sejati.", details: "Chou adalah master beladiri dengan teknik yang sangat presisi dan indah.", words: "Seni beladiri adalah satu-satunya jalan.", sound: "sounds/ml_chou.mp3", traits: { brave: 3, smart: 2, gentle: 1, leader: 2, warm: 1, cautious: 1 } },
    { name: "ML-Badang", gender: "male", img: "images/ml_badang.png", desc: "Petarung tangguh dengan power brute.", details: "Badang adalah petarung tangguh dengan kekuatan brute force yang luar biasa.", words: "Kekuatan sejati tidak perlu trik.", sound: "sounds/ml_badang.mp3", traits: { brave: 3, smart: 1, gentle: 0, leader: 1, warm: 1, cautious: 0 } },
    { name: "ML-Gusion", gender: "male", img: "images/ml_gusion.png", desc: "Pembunuh elegan dengan trik magis.", details: "Gusion adalah pembunuh elegan dengan magis yang melumpuhkan musuh.", words: "Keanggunan adalah kekuatan sejati.", sound: "sounds/ml_gusion.mp3", traits: { brave: 2, smart: 3, gentle: 1, leader: 1, warm: 1, cautious: 2 } },
    { name: "ML-Hayabusa", gender: "male", img: "images/ml_hayabusa.png", desc: "Ninja legendaris dengan kecepatan super.", details: "Hayabusa adalah ninja legendaris dengan kecepatan yang melampaui hukum alam.", words: "Ninja bergerak dalam bayangan.", sound: "sounds/ml_hayabusa.mp3", traits: { brave: 2, smart: 3, gentle: 0, leader: 1, warm: 0, cautious: 2 } },
    { name: "ML-Karina", gender: "female", img: "images/ml_karina.png", desc: "Pembunuh misterius dengan tujuan tersembunyi.", details: "Karina adalah pembunuh misterius dengan tujuan hidup yang sangat dalam.", words: "Misteri adalah bagian saya.", sound: "sounds/ml_karina.mp3", traits: { brave: 2, smart: 2, gentle: 0, leader: 0, warm: 1, cautious: 3 } },
    { name: "ML-Yve", gender: "female", img: "images/ml_yve.png", desc: "Tukang sihir dengan kekuatan kosmik.", details: "Yve adalah penyihir dengan kekuatan kosmik yang dapat mengubah pertempuran.", words: "Sihir kosmik mengalir dalam darahku.", sound: "sounds/ml_yve.mp3", traits: { brave: 1, smart: 3, gentle: 1, leader: 1, warm: 1, cautious: 1 } },
    { name: "ML-Benedetta", gender: "female", img: "images/ml_benedetta.png", desc: "Petarung seksi dengan kehendak besi.", details: "Benedetta adalah petarung kuat dengan kehendak yang sangat kokoh.", words: "Kekuatan datang dari dalam.", sound: "sounds/ml_benedetta.mp3", traits: { brave: 3, smart: 2, gentle: 0, leader: 2, warm: 1, cautious: 0 } },
    { name: "ML-Nana", gender: "female", img: "images/ml_nana.png", desc: "Pendukung manis dengan bisikan magic.", details: "Nana adalah pendukung yang manis dengan kemampuan magic yang memperkuat tim.", words: "Dukungan adalah fondasi kemenangan.", sound: "sounds/ml_nana.mp3", traits: { brave: 0, smart: 2, gentle: 3, leader: 1, warm: 3, cautious: 1 } },
    { name: "ML-Alucard", gender: "male", img: "images/ml_alucard.png", desc: "Penyerap darah dengan kekuatan gelap.", details: "Alucard adalah vampire yang menyerap darah musuh untuk kekuatan.", words: "Kegelapan adalah kekuatan saya.", sound: "sounds/ml_alucard.mp3", traits: { brave: 3, smart: 2, gentle: 0, leader: 1, warm: 0, cautious: 1 } },
    { name: "ML-Leomord", gender: "male", img: "images/ml_leomord.png", desc: "Penunggang kuda dengan kehormatan.", details: "Leomord adalah penunggang kuda dengan kehormatan chivalry yang tinggi.", words: "Kehormatan di atas segalanya.", sound: "sounds/ml_leomord.mp3", traits: { brave: 3, smart: 2, gentle: 1, leader: 3, warm: 2, cautious: 0 } },
    { name: "ML-Hilda", gender: "female", img: "images/ml_hilda.png", desc: "Pemburu tangguh dari hutan.", details: "Hilda adalah pemburu tangguh dari hutan dengan skill survival yang hebat.", words: "Alam adalah rumah sejati saya.", sound: "sounds/ml_hilda.mp3", traits: { brave: 3, smart: 2, gentle: 1, leader: 1, warm: 2, cautious: 1 } },
    { name: "ML-Esmeralda", gender: "female", img: "images/ml_esmeralda.png", desc: "Pejaga dengan perisai magis kuat.", details: "Esmeralda adalah pejaga dengan perisai magis yang sangat kuat dan tahan.", words: "Pertahanan adalah seni sejati.", sound: "sounds/ml_esmeralda.mp3", traits: { brave: 2, smart: 2, gentle: 1, leader: 2, warm: 1, cautious: 1 } },
    { name: "ML-Selena", gender: "female", img: "images/ml_selena.png", desc: "Pembunuh reptil dengan transformasi.", details: "Selena adalah pembunuh yang dapat bertransformasi menjadi reptil berbahaya.", words: "Transformasi adalah keahlian kami.", sound: "sounds/ml_selena.mp3", traits: { brave: 2, smart: 2, gentle: 0, leader: 0, warm: 1, cautious: 2 } },
    { name: "ML-Ling", gender: "male", img: "images/ml_ling.png", desc: "Tentang dengan kekuatan surga.", details: "Ling adalah tentara surgawi dengan kekuatan yang melampaui batas dunia.", words: "Kekuatan surga membimbing langkahku.", sound: "sounds/ml_ling.mp3", traits: { brave: 2, smart: 2, gentle: 1, leader: 1, warm: 2, cautious: 1 } },
    { name: "ML-Karrie", gender: "female", img: "images/ml_karrie.png", desc: "Prajurit raja dengan kesetiaan tinggi.", details: "Karrie adalah prajurit setia dengan loyalitas yang tidak akan pernah berkurang.", words: "Kesetiaan adalah amanah suci.", sound: "sounds/ml_karrie.mp3", traits: { brave: 2, smart: 1, gentle: 2, leader: 1, warm: 3, cautious: 0 } },
    { name: "ML-Kagura", gender: "female", img: "images/ml_kagura.png", desc: "Tabib magis dengan penyembuhan dahsyat.", details: "Kagura adalah tabib magis dengan kemampuan penyembuhan yang sangat kuat.", words: "Penyembuhan adalah misi suci kami.", sound: "sounds/ml_kagura.mp3", traits: { brave: 1, smart: 2, gentle: 3, leader: 1, warm: 3, cautious: 1 } },
    { name: "ML-Rafaela", gender: "female", img: "images/ml_rafaela.png", desc: "Malaikat dengan cahaya pelindung.", details: "Rafaela adalah malaikat dengan cahaya yang melindungi semua yang dia sayangi.", words: "Cahaya melawan kegelapan selamanya.", sound: "sounds/ml_rafaela.mp3", traits: { brave: 2, smart: 1, gentle: 3, leader: 2, warm: 3, cautious: 1 } },
    { name: "ML-Aurora", gender: "female", img: "images/ml_aurora.png", desc: "Musim dingin dengan es abadi.", details: "Aurora adalah ratu musim dingin dengan es yang membeku segala yang ia sentuh.", words: "Es abadi adalah detak jantung saya.", sound: "sounds/ml_aurora.mp3", traits: { brave: 2, smart: 2, gentle: 1, leader: 2, warm: 0, cautious: 1 } },
    { name: "ML-Eudora", gender: "female", img: "images/ml_eudora.png", desc: "Penyihir dengan listrik dahsyat.", details: "Eudora adalah penyihir dengan listrik yang dapat meledakkan pertempuran.", words: "Listrik mengacau dengan tatapan saya.", sound: "sounds/ml_eudora.mp3", traits: { brave: 1, smart: 3, gentle: 0, leader: 0, warm: 1, cautious: 1 } },
    { name: "ML-Cyclops", gender: "male", img: "images/ml_cyclops.png", desc: "Penyihir satu mata dengan visi dahsyat.", details: "Cyclops adalah penyihir dengan satu mata yang melihat segalanya dengan jelas.", words: "Visi saya menembus semua ilusi.", sound: "sounds/ml_cyclops.mp3", traits: { brave: 1, smart: 3, gentle: 0, leader: 1, warm: 1, cautious: 1 } },
    { name: "ML-Luo Yi", gender: "female", img: "images/ml_luoyi.png", desc: "Pengurus keseimbangan dengan yin-yang.", details: "Luo Yi adalah penjaga keseimbangan dengan kekuatan yin-yang yang sempurna.", words: "Keseimbangan adalah hukum alam.", sound: "sounds/ml_luoyi.mp3", traits: { brave: 1, smart: 3, gentle: 2, leader: 1, warm: 2, cautious: 1 } },
    { name: "ML-Hoon", gender: "male", img: "images/ml_hoon.png", desc: "Pemburu dengan tracking sempurna.", details: "Hoon adalah pemburu profesional dengan tracking yang tidak pernah meleset.", words: "Jejak menunjukkan segalanya.", sound: "sounds/ml_hoon.mp3", traits: { brave: 2, smart: 2, gentle: 0, leader: 1, warm: 1, cautious: 1 } },
    { name: "ML-Moskov", gender: "male", img: "images/ml_moskov.png", desc: "Pembunuh dengan tombak legendaris.", details: "Moskov adalah pembunuh dengan tombak legendaris yang menembus apapun.", words: "Tombak saya tidak pernah meleset.", sound: "sounds/ml_moskov.mp3", traits: { brave: 2, smart: 1, gentle: 0, leader: 1, warm: 0, cautious: 1 } },
    { name: "ML-Aldous", gender: "male", img: "images/ml_aldous.png", desc: "Mantra dengan ilmu sihir kuno.", details: "Aldous adalah mantra dengan ilmu sihir kuno yang sangat dahsyat.", words: "Sihir kuno tidak dapat dikalahkan.", sound: "sounds/ml_aldous.mp3", traits: { brave: 1, smart: 3, gentle: 0, leader: 1, warm: 0, cautious: 2 } },
    { name: "ML-Harith", gender: "male", img: "images/ml_harith.png", desc: "Pedang dengan energi magis.", details: "Harith adalah petarung dengan pedang berenergi magis yang sangat kuat.", words: "Energi magis adalah takdir saya.", sound: "sounds/ml_harith.mp3", traits: { brave: 2, smart: 2, gentle: 1, leader: 1, warm: 1, cautious: 0 } },
    { name: "ML-Karihmet", gender: "male", img: "images/ml_karihmet.png", desc: "Titan dengan kekuatan alam.", details: "Karihmet adalah titan dengan kekuatan alam yang melampaui manusia.", words: "Alam adalah kekuatan tertinggi.", sound: "sounds/ml_karihmet.mp3", traits: { brave: 3, smart: 1, gentle: 1, leader: 1, warm: 1, cautious: 0 } },
    { name: "ML-Master", gender: "male", img: "images/ml_master.png", desc: "Master Mobile Legends legendaris.", details: "Master adalah petarung legendaris dari Mobile Legends dengan pengalaman tak tertandingi.", words: "Legenda tidak pernah mati.", sound: "sounds/ml_master.mp3", traits: { brave: 3, smart: 3, gentle: 1, leader: 3, warm: 1, cautious: 1 } },
    { name: "Anime-Tsundere", gender: "female", img: "images/anime_tsundere.png", desc: "Gadis yang sulit diekspresikan dengan jujur.", details: "Tsundere adalah tipe watak yang sulit mengekspresikan perasaan sejati dengan jujur.", words: "Bukan berarti aku menyukai mu!", sound: "sounds/anime_tsundere.mp3", traits: { brave: 1, smart: 2, gentle: 1, leader: 0, warm: 1, cautious: 2 } },
    { name: "Anime-Yandere", gender: "female", img: "images/anime_yandere.png", desc: "Gadis dengan cinta yang obsesif.", details: "Yandere adalah tipe watak dengan cinta obsesif yang dapat menjadi berbahaya.", words: "Akulah yang paling mencintai!", sound: "sounds/anime_yandere.mp3", traits: { brave: 2, smart: 2, gentle: 0, leader: 0, warm: 0, cautious: 1 } },
    { name: "Anime-Kuudere", gender: "male", img: "images/anime_kuudere.png", desc: "Pria dingin dengan emosi tertutup.", details: "Kuudere adalah tipe watak yang dingin tapitersembunyi emosi yang dalam.", words: "Emosi adalah kelemahan sejati.", sound: "sounds/anime_kuudere.mp3", traits: { brave: 1, smart: 3, gentle: 0, leader: 1, warm: 1, cautious: 2 } },
    { name: "Anime-Dandere", gender: "female", img: "images/anime_dandere.png", desc: "Gadis pendiam dengan hati emas.", details: "Dandere adalah tipe watak pendiam yang menyembunyikan hati emas di dalamnya.", words: "Keheningan adalah bahasa saya.", sound: "sounds/anime_dandere.mp3", traits: { brave: 0, smart: 2, gentle: 3, leader: 0, warm: 2, cautious: 2 } },
    { name: "Anime-Bokukko", gender: "female", img: "images/anime_bokukko.png", desc: "Gadis dengan karakter tomboy tangguh.", details: "Bokukko adalah gadis dengan karakter tomboy yang tangguh dan berani.", words: "Aku bukan gadis biasa!", sound: "sounds/anime_bokukko.mp3", traits: { brave: 3, smart: 1, gentle: 0, leader: 1, warm: 2, cautious: 0 } },
    { name: "Anime-Deredere", gender: "female", img: "images/anime_deredere.png", desc: "Gadis ceria dengan energi positif.", details: "Deredere adalah gadis ceria dengan energi positif yang menular ke semua orang.", words: "Kegembiraan adalah hadiah terbaik!", sound: "sounds/anime_deredere.mp3", traits: { brave: 1, smart: 1, gentle: 2, leader: 0, warm: 3, cautious: 0 } },
    { name: "Anime-Undere", gender: "female", img: "images/anime_undere.png", desc: "Gadis dengan hati yang tulus.", details: "Undere adalah gadis dengan ketulusan yang mendalam dalam setiap tindakannya.", words: "Ketulusan adalah jantung kami.", sound: "sounds/anime_undere.mp3", traits: { brave: 1, smart: 1, gentle: 3, leader: 0, warm: 3, cautious: 0 } },
    { name: "Anime-Oujodere", gender: "female", img: "images/anime_oujodere.png", desc: "Bangsawan dengan gaya rakus.", details: "Oujodere adalah bangsawan dengan gaya rakus namun hati yang sebenarnya baik.", words: "Kehormatan adalah kewajiban kami.", sound: "sounds/anime_oujodere.mp3", traits: { brave: 1, smart: 2, gentle: 2, leader: 2, warm: 2, cautious: 1 } },
    { name: "Anime-Mayadere", gender: "female", img: "images/anime_mayadere.png", desc: "Gadis dengan sisi misterius gelap.", details: "Mayadere adalah gadis dengan sisi gelap misterius yang jarang ditunjukkan orang.", words: "Kegelapan ada dalam semua orang.", sound: "sounds/anime_mayadere.mp3", traits: { brave: 2, smart: 2, gentle: 0, leader: 1, warm: 1, cautious: 2 } },
    { name: "Anime-Kamidere", gender: "male", img: "images/anime_kamidere.png", desc: "Pria dengan kepercayaan diri super.", details: "Kamidere adalah pria dengan kepercayaan diri yang sangat tinggi pada dirinya.", words: "Aku adalah yang terbaik di sini.", sound: "sounds/anime_kamidere.mp3", traits: { brave: 3, smart: 2, gentle: 0, leader: 3, warm: 1, cautious: 0 } },
    { name: "Anime-Bakadere", gender: "female", img: "images/anime_bakadere.png", desc: "Gadis naif dengan ketulusan tinggi.", details: "Bakadere adalah gadis naif dengan ketulusan tinggi meskipun kurang cerdas.", words: "Hati lebih penting dari otak!", sound: "sounds/anime_bakadere.mp3", traits: { brave: 1, smart: 0, gentle: 2, leader: 0, warm: 3, cautious: 0 } },
    { name: "Anime-Himedere", gender: "female", img: "images/anime_himedere.png", desc: "Putri dengan sikap princess tinggi.", details: "Himedere adalah putri dengan sikap sombong namun memiliki hati yang baik.", words: "Aku adalah ratu di sini!", sound: "sounds/anime_himedere.mp3", traits: { brave: 1, smart: 2, gentle: 1, leader: 3, warm: 1, cautious: 1 } },
    { name: "Anime-Shundere", gender: "male", img: "images/anime_shundere.png", desc: "Pria dengan emosi yang sangat mudah berubah.", details: "Shundere adalah pria yang emosi mudah berubah dari ceria ke sedih.", words: "Emosi adalah yang saya rasakan.", sound: "sounds/anime_shundere.mp3", traits: { brave: 1, smart: 1, gentle: 1, leader: 0, warm: 2, cautious: 1 } },
    { name: "Anime-Maidere", gender: "female", img: "images/anime_maidere.png", desc: "Maid dengan layanan sepenuh hati.", details: "Maidere adalah maid yang melayani dengan sepenuh hati dan dedikasi tinggi.", words: "Melayani adalah kehormatan saya.", sound: "sounds/anime_maidere.mp3", traits: { brave: 1, smart: 1, gentle: 3, leader: 0, warm: 3, cautious: 0 } },
    { name: "Anime-Fujoshidere", gender: "female", img: "images/anime_fujoshidere.png", desc: "Penggemar yaoi dengan imajinasi liar.", details: "Fujoshidere adalah penggemar dengan imajinasi liar tentang karakter favorit.", words: "Imajinasi adalah dunia saya!", sound: "sounds/anime_fujoshidere.mp3", traits: { brave: 1, smart: 2, gentle: 1, leader: 0, warm: 2, cautious: 1 } },
    { name: "Anime-Bocchandere", gender: "male", img: "images/anime_bocchandere.png", desc: "Pria main antagonis tapi baik hati.", details: "Bocchandere adalah pria yang terlihat jahat tapi sebenarnya baik hati.", words: "Kebaikan adalah sifat sejati kami.", sound: "sounds/anime_bocchandere.mp3", traits: { brave: 3, smart: 2, gentle: 2, leader: 2, warm: 3, cautious: 0 } },
    { name: "Anime-Sukebenedere", gender: "female", img: "images/anime_sukebenedere.png", desc: "Gadis tough dengan hati lembut.", details: "Sukebenedere adalah gadis tough yang menyembunyikan hati yang sangat lembut.", words: "Ketangguhan adalah masker saya.", sound: "sounds/anime_sukebenedere.mp3", traits: { brave: 3, smart: 1, gentle: 2, leader: 1, warm: 2, cautious: 0 } },
    { name: "Anime-Smugdere", gender: "male", img: "images/anime_smugdere.png", desc: "Pria sombong dengan pesona misterius.", details: "Smugdere adalah pria sombong dengan pesona misterius yang menarik perhatian.", words: "Keanggunan saya tidak tertandingi.", sound: "sounds/anime_smugdere.mp3", traits: { brave: 2, smart: 3, gentle: 0, leader: 2, warm: 1, cautious: 1 } },
    { name: "Anime-Shrewd", gender: "female", img: "images/anime_shrewd.png", desc: "Gadis cerdas dengan logika tajam.", details: "Shrewd adalah gadis cerdas dengan logika tajam yang selalu menang strategis.", words: "Logika mengalahkan semua emosi.", sound: "sounds/anime_shrewd.mp3", traits: { brave: 1, smart: 3, gentle: 0, leader: 1, warm: 1, cautious: 1 } },
    { name: "Anime-Wagamamanadere", gender: "female", img: "images/anime_wagamamanadere.png", desc: "Gadis egois tapi punya hati emas.", details: "Wagamamanadere adalah gadis egois yang sebenarnya punya hati emas.", words: "Keegoisan adalah perlindungan diri.", sound: "sounds/anime_wagamamanadere.mp3", traits: { brave: 2, smart: 1, gentle: 1, leader: 1, warm: 2, cautious: 0 } },
    { name: "Anime-Oniideredere", gender: "male", img: "images/anime_oniideredere.png", desc: "Kakak laki dengan protektivitas tinggi.", details: "Oniideredere adalah kakak laki dengan protektivitas yang sangat tinggi.", words: "Saudara adalah segalanya bagi kami.", sound: "sounds/anime_oniideredere.mp3", traits: { brave: 3, smart: 2, gentle: 2, leader: 2, warm: 3, cautious: 0 } },
    { name: "Anime-Master", gender: "male", img: "images/anime_master.png", desc: "Master anime dengan karakter sempurna.", details: "Master adalah karakter anime sempurna yang menggabungkan semua tipe dere.", words: "Kesempurnaan adalah standar kami.", sound: "sounds/anime_master.mp3", traits: { brave: 3, smart: 3, gentle: 2, leader: 3, warm: 3, cautious: 1 } },
    { name: "R1999-Axis", gender: "male", img: "images/r1999_axis.png", desc: "Prajurit temporal dengan kontrol waktu.", details: "Axis adalah prajurit yang menguasai dimensi temporal dan dapat memanipulasi alur waktu.", words: "Waktu adalah senjata terkuat kami.", sound: "sounds/r1999_axis.mp3", traits: { brave: 2, smart: 3, gentle: 0, leader: 2, warm: 1, cautious: 2 } },
    { name: "R1999-Obsidian", gender: "female", img: "images/r1999_obsidian.png", desc: "Gadis kegelapan dengan misteri dalam.", details: "Obsidian adalah gadis yang terbungkus kegelapan dengan masa lalu yang penuh misteri.", words: "Kegelapan membisikkan kebenaran.", sound: "sounds/r1999_obsidian.mp3", traits: { brave: 2, smart: 2, gentle: 0, leader: 1, warm: 0, cautious: 3 } },
    { name: "R1999-Prometheus", gender: "male", img: "images/r1999_prometheus.png", desc: "Pria api dengan pencerahan sejati.", details: "Prometheus adalah pria dengan api semangat yang ingin membawa pencerahan ke dunia.", words: "Api adalah cahaya harapan kami.", sound: "sounds/r1999_prometheus.mp3", traits: { brave: 3, smart: 2, gentle: 1, leader: 3, warm: 2, cautious: 0 } },
    { name: "R1999-Cipher", gender: "male", img: "images/r1999_cipher.png", desc: "Pahlawan tersembunyi tanpa wajah.", details: "Cipher adalah sosok misterius yang bergerak dalam bayangan untuk kebenaran.", words: "Identitas palsu adalah alasan saya.", sound: "sounds/r1999_cipher.mp3", traits: { brave: 2, smart: 3, gentle: 0, leader: 1, warm: 1, cautious: 3 } },
    { name: "R1999-Vortex", gender: "female", img: "images/r1999_vortex.png", desc: "Janda badai dengan kekuatan dahsyat.", details: "Vortex adalah janda badai yang membawa kehancuran dan perubahan melalui kekuatannya.", words: "Badai akan mengikis segalanya.", sound: "sounds/r1999_vortex.mp3", traits: { brave: 3, smart: 1, gentle: 0, leader: 2, warm: 0, cautious: 1 } },
    { name: "R1999-Nexus", gender: "male", img: "images/r1999_nexus.png", desc: "Pemimpin jaringan rahasia dunia.", details: "Nexus adalah pemimpin jaringan rahasia yang mengendalikan informasi di balik layar.", words: "Jaringan adalah tulang punggung kami.", sound: "sounds/r1999_nexus.mp3", traits: { brave: 1, smart: 3, gentle: 0, leader: 3, warm: 1, cautious: 2 } },
    { name: "R1999-Echo", gender: "female", img: "images/r1999_echo.png", desc: "Gadis penggema dari masa lalu.", details: "Echo adalah gadis yang menggema suara masa lalu dan membawa pesan dari dimensi lain.", words: "Masa lalu berbicara melalui saya.", sound: "sounds/r1999_echo.mp3", traits: { brave: 1, smart: 2, gentle: 2, leader: 0, warm: 1, cautious: 2 } },
    { name: "R1999-Paradox", gender: "male", img: "images/r1999_paradox.png", desc: "Kontradiksi hidup yang tak terpecahkan.", details: "Paradox adalah sosok kontradiksi yang menantang semua logika dan kebenaran yang dikenal.", words: "Kontradiksi adalah hakikat saya.", sound: "sounds/r1999_paradox.mp3", traits: { brave: 2, smart: 2, gentle: 1, leader: 1, warm: 1, cautious: 1 } },
    { name: "R1999-Requiem", gender: "female", img: "images/r1999_requiem.png", desc: "Penyanyi kematian dengan suara fatal.", details: "Requiem adalah penyanyi yang suaranya dapat membawa kematian atau penyembuhan.", words: "Musik saya adalah nasib Anda.", sound: "sounds/r1999_requiem.mp3", traits: { brave: 1, smart: 2, gentle: 1, leader: 1, warm: 1, cautious: 2 } },
    { name: "R1999-Sentinel", gender: "male", img: "images/r1999_sentinel.png", desc: "Penjaga gerbang dimensi selamanya.", details: "Sentinel adalah penjaga kekal yang melindungi gerbang antar dimensi dari invasi.", words: "Gerbang adalah tanggung jawab saya.", sound: "sounds/r1999_sentinel.mp3", traits: { brave: 3, smart: 2, gentle: 0, leader: 2, warm: 1, cautious: 1 } },
    { name: "R1999-Specter", gender: "female", img: "images/r1999_specter.png", desc: "Hantu yang belum menemukan kedamaian.", details: "Specter adalah hantu yang terjebak antara dunia hidup dan mati, mencari jalan pulang.", words: "Aku adalah angin yang mengganggu.", sound: "sounds/r1999_specter.mp3", traits: { brave: 1, smart: 1, gentle: 1, leader: 0, warm: 2, cautious: 2 } },
    { name: "R1999-Inferno", gender: "male", img: "images/r1999_inferno.png", desc: "Api murni dengan destruksi abadi.", details: "Inferno adalah api murni yang menghancurkan semua yang salah demi penciptaan baru.", words: "Kebakaran adalah regenerasi sejati.", sound: "sounds/r1999_inferno.mp3", traits: { brave: 3, smart: 1, gentle: 0, leader: 2, warm: 0, cautious: 0 } },
    { name: "R1999-Whisper", gender: "female", img: "images/r1999_whisper.png", desc: "Pembisik yang menyebarkan kebenaran.", details: "Whisper adalah gadis yang memisyaratkan kebenaran tersembunyi kepada mereka yang mendengarkan.", words: "Bisik-bisik membawa perubahan.", sound: "sounds/r1999_whisper.mp3", traits: { brave: 1, smart: 2, gentle: 1, leader: 0, warm: 1, cautious: 3 } },
    { name: "R1999-Veil", gender: "female", img: "images/r1999_veil.png", desc: "Pembungkus kebenaran yang tersembunyi.", details: "Veil adalah wanita yang menutupi kebenaran dengan ilusi yang indah namun menipu.", words: "Di balik tabir adalah kebenaran.", sound: "sounds/r1999_veil.mp3", traits: { brave: 1, smart: 3, gentle: 1, leader: 1, warm: 0, cautious: 2 } },
    { name: "R1999-Ascent", gender: "male", img: "images/r1999_ascent.png", desc: "Pendaki menuju takdir tertinggi.", details: "Ascent adalah pria yang terus mendaki menuju takdir tertingginya tanpa henti.", words: "Puncak adalah satu-satunya tujuan.", sound: "sounds/r1999_ascent.mp3", traits: { brave: 3, smart: 2, gentle: 0, leader: 3, warm: 1, cautious: 0 } },
    { name: "R1999-Descent", gender: "female", img: "images/r1999_descent.png", desc: "Pemburu neraka dengan tujuan murni.", details: "Descent adalah wanita yang turun ke kegelapan demi menyelamatkan mereka yang terjebak.", words: "Neraka adalah medan tempurku.", sound: "sounds/r1999_descent.mp3", traits: { brave: 3, smart: 2, gentle: 2, leader: 2, warm: 3, cautious: 0 } },
    { name: "R1999-Twilight", gender: "male", img: "images/r1999_twilight.png", desc: "Pria senja antara dua dunia.", details: "Twilight adalah pria yang hidup di antara cahaya dan kegelapan, tidak berpihak pada keduanya.", words: "Keseimbangan adalah keselamatan kami.", sound: "sounds/r1999_twilight.mp3", traits: { brave: 2, smart: 2, gentle: 1, leader: 1, warm: 1, cautious: 2 } },
    { name: "R1999-Aurora", gender: "female", img: "images/r1999_aurora.png", desc: "Cahaya fajar dengan harapan baru.", details: "Aurora adalah cahaya fajar yang membawa harapan dan awal mula bagi semua orang.", words: "Fajar membawa harapan setiap hari.", sound: "sounds/r1999_aurora.mp3", traits: { brave: 2, smart: 2, gentle: 3, leader: 2, warm: 3, cautious: 0 } },
    { name: "R1999-Midnight", gender: "male", img: "images/r1999_midnight.png", desc: "Prajurit tengah malam dengan misteri.", details: "Midnight adalah prajurit yang bergerak saat dunia tertidur dengan misi rahasia.", words: "Malam adalah waktu kebenaran.", sound: "sounds/r1999_midnight.mp3", traits: { brave: 2, smart: 3, gentle: 0, leader: 2, warm: 1, cautious: 2 } },
    { name: "R1999-Zenith", gender: "female", img: "images/r1999_zenith.png", desc: "Puncak kesempurnaan yang menginspirasi.", details: "Zenith adalah wanita yang mencapai puncak kesempurnaan dan menginspirasi orang lain.", words: "Kesempurnaan adalah tujuan saya.", sound: "sounds/r1999_zenith.mp3", traits: { brave: 2, smart: 3, gentle: 1, leader: 3, warm: 2, cautious: 0 } },
    { name: "R1999-Nadir", gender: "male", img: "images/r1999_nadir.png", desc: "Titik terendah dengan kebangkitan.", details: "Nadir adalah pria yang pernah mencapai titik terendah namun bangkit lebih kuat.", words: "Kekalahan adalah awal kebangkitan.", sound: "sounds/r1999_nadir.mp3", traits: { brave: 3, smart: 2, gentle: 1, leader: 2, warm: 2, cautious: 1 } },
    { name: "R1999-Omen", gender: "female", img: "images/r1999_omen.png", desc: "Pertanda dari masa depan yang gelap.", details: "Omen adalah wanita yang menampilkan pertanda dari masa depan yang penuh gelap.", words: "Masa depan berbicara melalui saya.", sound: "sounds/r1999_omen.mp3", traits: { brave: 1, smart: 2, gentle: 0, leader: 0, warm: 0, cautious: 3 } },
    { name: "R1999-Oracle", gender: "female", img: "images/r1999_oracle.png", desc: "Peramal dengan visi sejati.", details: "Oracle adalah peramal yang memiliki visi sejati tentang apa yang akan terjadi.", words: "Visi saya tidak pernah salah.", sound: "sounds/r1999_oracle.mp3", traits: { brave: 1, smart: 3, gentle: 1, leader: 2, warm: 1, cautious: 2 } },
    { name: "R1999-Phantom", gender: "male", img: "images/r1999_phantom.png", desc: "Bayangan tanpa bentuk asli.", details: "Phantom adalah sosok bayangan yang tidak memiliki bentuk sejati dan terus berpindah.", words: "Saya ada namun tidak ada.", sound: "sounds/r1999_phantom.mp3", traits: { brave: 2, smart: 2, gentle: 0, leader: 1, warm: 0, cautious: 3 } },
    { name: "R1999-Sovereign", gender: "male", img: "images/r1999_sovereign.png", desc: "Penguasa tertinggi dengan kekuasaan mutlak.", details: "Sovereign adalah penguasa dengan kekuasaan mutlak yang tidak tertandingi siapapun.", words: "Kekuasaan adalah takdir saya.", sound: "sounds/r1999_sovereign.mp3", traits: { brave: 3, smart: 2, gentle: 0, leader: 3, warm: 0, cautious: 1 } },
    { name: "R1999-Eclipse", gender: "female", img: "images/r1999_eclipse.png", desc: "Gerhana dengan matahari menutup cahaya.", details: "Eclipse adalah gerhana yang menutup cahaya dan membawa kegelapan sementara.", words: "Kegelapan adalah keniscayaan saya.", sound: "sounds/r1999_eclipse.mp3", traits: { brave: 2, smart: 2, gentle: 0, leader: 1, warm: 0, cautious: 2 } },
    { name: "R1999-Mosaic", gender: "female", img: "images/r1999_mosaic.png", desc: "Mosaik dari ribuan potongan kehidupan.", details: "Mosaic adalah gadis yang terbentuk dari ribuan potongan kehidupan berbeda.", words: "Aku adalah ribuan cerita.", sound: "sounds/r1999_mosaic.mp3", traits: { brave: 2, smart: 1, gentle: 2, leader: 1, warm: 2, cautious: 1 } },
    { name: "R1999-Genesis", gender: "male", img: "images/r1999_genesis.png", desc: "Awal penciptaan dengan kekuatan baru.", details: "Genesis adalah pria yang membawa kekuatan penciptaan untuk dunia baru.", words: "Awal adalah anugerah kami.", sound: "sounds/r1999_genesis.mp3", traits: { brave: 2, smart: 3, gentle: 1, leader: 2, warm: 2, cautious: 0 } },
    { name: "R1999-Apex", gender: "male", img: "images/r1999_apex.png", desc: "Puncak evolusi yang sempurna.", details: "Apex adalah puncak dari semua evolusi dengan sempurna dalam segala hal.", words: "Evolusi adalah takdir semua makhluk.", sound: "sounds/r1999_apex.mp3", traits: { brave: 3, smart: 3, gentle: 1, leader: 3, warm: 1, cautious: 1 } },
    { name: "R1999-Void", gender: "male", img: "images/r1999_void.png", desc: "Kekosongan dengan keheningan mutlak.", details: "Void adalah keheningan mutlak dan kekosongan yang menelan segalanya.", words: "Kekosongan adalah kesempurnaan asli.", sound: "sounds/r1999_void.mp3", traits: { brave: 1, smart: 1, gentle: 0, leader: 0, warm: 0, cautious: 1 } },
    { name: "R1999-Nexthon", gender: "male", img: "images/r1999_nexthon.png", desc: "Prajurit masa depan dari dimensi lain.", details: "Nexthon adalah prajurit dari masa depan yang dikirim kembali untuk mengubah takdir.", words: "Masa depan mengirimku kemari.", sound: "sounds/r1999_nexthon.mp3", traits: { brave: 3, smart: 2, gentle: 0, leader: 1, warm: 1, cautious: 1 } },
    { name: "R1999-Chronos", gender: "male", img: "images/r1999_chronos.png", desc: "Tuhan waktu dengan kontrol penuh.", details: "Chronos adalah pribadi yang menguasai waktu dengan kendali penuh atas alur temporal.", words: "Waktu adalah mainan saya.", sound: "sounds/r1999_chronos.mp3", traits: { brave: 1, smart: 3, gentle: 0, leader: 3, warm: 0, cautious: 1 } },
    { name: "R1999-Zephyr", gender: "female", img: "images/r1999_zephyr.png", desc: "Angin Barat dengan kebebasan sejati.", details: "Zephyr adalah gadis angin Barat yang membawa kebebasan dan perubahan ke mana saja.", words: "Angin membawa perubahan selamanya.", sound: "sounds/r1999_zephyr.mp3", traits: { brave: 2, smart: 1, gentle: 1, leader: 1, warm: 2, cautious: 1 } },
    { name: "Anime-Teasdere", gender: "male", img: "images/anime_teasdere.png", desc: "Pria yang suka menggoda tapi baik hati.", details: "Teasdere adalah pria yang suka menggoda dan menggibah namun punya hati emas.", words: "Menggoda adalah cara saya menunjukkan kasih.", sound: "sounds/anime_teasdere.mp3", traits: { brave: 1, smart: 2, gentle: 1, leader: 0, warm: 2, cautious: 0 } },
    { name: "Anime-Xerioded", gender: "female", img: "images/anime_xerioded.png", desc: "Gadis egoist dengan tujuan tersembunyi.", details: "Xerioded adalah gadis yang egois namun memiliki tujuan mulia tersembunyi.", words: "Egois adalah pertahanan saya.", sound: "sounds/anime_xerioded.mp3", traits: { brave: 2, smart: 2, gentle: 0, leader: 1, warm: 1, cautious: 1 } },
    { name: "Anime-Coquettedere", gender: "female", img: "images/anime_coquettedere.png", desc: "Gadis rayuan dengan pesona misterius.", details: "Coquettedere adalah gadis yang ahli dalam seni rayuan dengan pesona misterius.", words: "Pesona adalah senjata saya.", sound: "sounds/anime_coquettedere.mp3", traits: { brave: 1, smart: 2, gentle: 1, leader: 1, warm: 2, cautious: 1 } },
    { name: "Anime-Pokerface", gender: "male", img: "images/anime_pokerface.png", desc: "Pria dengan ekspresi datar dan misterius.", details: "Pokerface adalah pria dengan ekspresi datar yang menyembunyikan perasaan dalam.", words: "Ekspresi palsu adalah seni saya.", sound: "sounds/anime_pokerface.mp3", traits: { brave: 1, smart: 3, gentle: 0, leader: 1, warm: 0, cautious: 3 } },
    { name: "Anime-Hyper", gender: "female", img: "images/anime_hyper.png", desc: "Gadis super ceria dengan energi tanpa batas.", details: "Hyper adalah gadis dengan energi tanpa batas yang selalu ceria dan penuh semangat.", words: "Energi positif adalah hadiah saya!", sound: "sounds/anime_hyper.mp3", traits: { brave: 2, smart: 1, gentle: 1, leader: 1, warm: 3, cautious: 0 } },
    { name: "Anime-Melancholy", gender: "male", img: "images/anime_melancholy.png", desc: "Pria sedih dengan kedalaman emosi.", details: "Melancholy adalah pria yang selalu sedih namun memiliki kedalaman emosi yang indah.", words: "Kesedihan adalah keindahan sejati.", sound: "sounds/anime_melancholy.mp3", traits: { brave: 0, smart: 2, gentle: 2, leader: 0, warm: 1, cautious: 1 } },
    { name: "Anime-Savage", gender: "male", img: "images/anime_savage.png", desc: "Pria liar dengan hati buas.", details: "Savage adalah pria liar dengan hati buas namun loyal terhadap kelompoknya.", words: "Kehidupan liar adalah kebebasan saya.", sound: "sounds/anime_savage.mp3", traits: { brave: 3, smart: 1, gentle: 0, leader: 2, warm: 1, cautious: 0 } },
    { name: "Anime-Seductress", gender: "female", img: "images/anime_seductress.png", desc: "Wanita menggoda dengan tujuan tersembunyi.", details: "Seductress adalah wanita yang ahli menggoda untuk mencapai tujuan hiddennya.", words: "Godaan adalah strategi saya.", sound: "sounds/anime_seductress.mp3", traits: { brave: 2, smart: 3, gentle: 0, leader: 2, warm: 0, cautious: 1 } },
    { name: "Anime-Naive", gender: "female", img: "images/anime_naive.png", desc: "Gadis polos dengan kepercayaan tinggi.", details: "Naive adalah gadis yang sangat polos dengan kepercayaan tinggi terhadap orang lain.", words: "Kejujuran adalah keindahan dunia.", sound: "sounds/anime_naive.mp3", traits: { brave: 1, smart: 0, gentle: 3, leader: 0, warm: 3, cautious: 0 } },
    { name: "Anime-Sadist", gender: "male", img: "images/anime_sadist.png", desc: "Pria yang senang menggoda dan menyakiti.", details: "Sadist adalah pria yang senang mengincar momen kesakitan orang lain.", words: "Rasa sakit adalah musik indah.", sound: "sounds/anime_sadist.mp3", traits: { brave: 3, smart: 2, gentle: 0, leader: 2, warm: 0, cautious: 0 } },
    { name: "Anime-Masochist", gender: "female", img: "images/anime_masochist.png", desc: "Gadis yang menikmati penderitaan diri.", details: "Masochist adalah gadis yang menerima penderitaan sebagai bentuk cinta sejati.", words: "Penderitaan adalah bentuk kasihku.", sound: "sounds/anime_masochist.mp3", traits: { brave: 2, smart: 1, gentle: 1, leader: 0, warm: 1, cautious: 0 } },
    { name: "Anime-Cynical", gender: "male", img: "images/anime_cynical.png", desc: "Pria sinis dengan pandangan pesimis.", details: "Cynical adalah pria yang sangat sinis dengan pandangan dunia yang pesimis.", words: "Semua berakhir dengan kecewa.", sound: "sounds/anime_cynical.mp3", traits: { brave: 0, smart: 3, gentle: 0, leader: 0, warm: 0, cautious: 2 } },
    { name: "Anime-Optimist", gender: "female", img: "images/anime_optimist.png", desc: "Gadis optimis dengan kegembiraan sejati.", details: "Optimist adalah gadis yang selalu optimis dengan kegembiraan sejati dalam setiap hari.", words: "Masa depan selalu cerah!", sound: "sounds/anime_optimist.mp3", traits: { brave: 2, smart: 1, gentle: 2, leader: 1, warm: 3, cautious: 0 } },
    { name: "Anime-Perfectionist", gender: "male", img: "images/anime_perfectionist.png", desc: "Pria sempurna dengan standar tertinggi.", details: "Perfectionist adalah pria dengan standar sempurna yang tidak bisa dikurangi sedikitpun.", words: "Kesempurnaan atau tidak sama sekali.", sound: "sounds/anime_perfectionist.mp3", traits: { brave: 1, smart: 3, gentle: 0, leader: 2, warm: 0, cautious: 2 } },
    { name: "Anime-Slacker", gender: "female", img: "images/anime_slacker.png", desc: "Gadis pemalas yang sebenarnya cerdas.", details: "Slacker adalah gadis yang terlihat malas namun sebenarnya sangat cerdas dan terampil.", words: "Kenapa capai jika bisa santai.", sound: "sounds/anime_slacker.mp3", traits: { brave: 1, smart: 2, gentle: 1, leader: 0, warm: 1, cautious: 1 } },
    { name: "Anime-Athlete", gender: "male", img: "images/anime_athlete.png", desc: "Pria atlet dengan semangat kompetisi.", details: "Athlete adalah pria atlet dengan semangat kompetisi yang membara setiap saat.", words: "Kemenangan adalah satu-satunya jalan.", sound: "sounds/anime_athlete.mp3", traits: { brave: 3, smart: 1, gentle: 0, leader: 2, warm: 1, cautious: 0 } },
    { name: "Anime-Bookworm", gender: "female", img: "images/anime_bookworm.png", desc: "Gadis ceria pembaca dengan dunia tersendiri.", details: "Bookworm adalah gadis pembaca yang hidup dalam dunia buku yang penuh imajinasi.", words: "Dunia buku adalah rumah sejati saya.", sound: "sounds/anime_bookworm.mp3", traits: { brave: 0, smart: 3, gentle: 1, leader: 0, warm: 1, cautious: 1 } },
    { name: "Anime-Gamer", gender: "male", img: "images/anime_gamer.png", desc: "Pria gamer dengan skill luar biasa.", details: "Gamer adalah pria yang hidup di dunia game dengan skill yang luar biasa tinggi.", words: "Bermain game adalah satu-satunya hidup.", sound: "sounds/anime_gamer.mp3", traits: { brave: 2, smart: 2, gentle: 0, leader: 1, warm: 1, cautious: 1 } },
    { name: "Anime-Artist", gender: "female", img: "images/anime_artist.png", desc: "Seniman dengan visi kreatif tinggi.", details: "Artist adalah seniman wanita dengan visi kreatif yang tinggi dan unik.", words: "Seni adalah ekspresi jiwa sejati.", sound: "sounds/anime_artist.mp3", traits: { brave: 1, smart: 2, gentle: 2, leader: 1, warm: 2, cautious: 0 } },
    { name: "Anime-Musician", gender: "male", img: "images/anime_musician.png", desc: "Musisi dengan jiwa penuh melodi.", details: "Musician adalah musisi dengan jiwa yang penuh melodi dan harmoni indah.", words: "Musik adalah bahasa universal kami.", sound: "sounds/anime_musician.mp3", traits: { brave: 1, smart: 2, gentle: 2, leader: 0, warm: 3, cautious: 0 } },
    { name: "Anime-Cool", gender: "female", img: "images/anime_cool.png", desc: "Gadis cool dengan gaya bergaul sempurna.", details: "Cool adalah gadis dengan gaya bergaul yang sempurna dan selalu trendy.", words: "Gaya adalah identitas sejati kami.", sound: "sounds/anime_cool.mp3", traits: { brave: 1, smart: 2, gentle: 0, leader: 2, warm: 1, cautious: 1 } },
    { name: "Anime-Nerd", gender: "male", img: "images/anime_nerd.png", desc: "Nerd dengan pengetahuan mendalam sekali.", details: "Nerd adalah lelaki dengan pengetahuan mendalam tentang berbagai topik teknis.", words: "Pengetahuan adalah kekuatan sejati.", sound: "sounds/anime_nerd.mp3", traits: { brave: 0, smart: 3, gentle: 1, leader: 0, warm: 1, cautious: 2 } },
    { name: "Anime-Athletic", gender: "female", img: "images/anime_athletic.png", desc: "Gadis atletis dengan kekuatan prima.", details: "Athletic adalah gadis atletis dengan kekuatan dan ketangguhan yang prima.", words: "Tubuh adalah instrumen sempurna kami.", sound: "sounds/anime_athletic.mp3", traits: { brave: 3, smart: 1, gentle: 1, leader: 1, warm: 2, cautious: 0 } },
    { name: "Anime-Peaceful", gender: "male", img: "images/anime_peaceful.png", desc: "Pria damai dengan hati yang tenang.", details: "Peaceful adalah pria yang selalu damai dengan hati yang sangat tenang dan bijak.", words: "Kedamaian adalah kekuatan tertinggi.", sound: "sounds/anime_peaceful.mp3", traits: { brave: 1, smart: 2, gentle: 3, leader: 1, warm: 3, cautious: 1 } },
    { name: "Anime-Regal", gender: "female", img: "images/anime_regal.png", desc: "Bangsawan elegan dengan nuansa kelas.", details: "Regal adalah wanita bangsawan elegan dengan nuansa kelas yang tinggi.", words: "Kebangsawanan adalah darah kami.", sound: "sounds/anime_regal.mp3", traits: { brave: 2, smart: 2, gentle: 1, leader: 3, warm: 1, cautious: 1 } },
    { name: "Anime-Apex2", gender: "male", img: "images/anime_apex2.png", desc: "Karakter anime terlengkap dengan semua sifat.", details: "Apex2 adalah karakter anime yang menggabungkan semua sifat positif dalam satu pribadi.", words: "Saya adalah representasi sempurna.", sound: "sounds/anime_apex2.mp3", traits: { brave: 3, smart: 3, gentle: 2, leader: 3, warm: 3, cautious: 1 } },
    { name: "Anime-Hiiro", gender: "male", img: "images/anime_hiiro.png", desc: "Pemimpin energik dengan semangat tinggi.", details: "Hiiro Kagami adalah pemimpin band yang penuh energi dengan semangat yang menular. Dia memiliki karisma alami yang membuat orang lain bersemangat mengikutinya.", words: "Mari bersama menciptakan musik yang indah!", sound: "sounds/anime_hiiro.mp3", traits: { brave: 3, smart: 2, gentle: 1, leader: 3, warm: 2, cautious: 0 } },
    { name: "Anime-Ena", gender: "female", img: "images/anime_ena.png", desc: "Gadis cerdas dengan kemampuan seni tinggi.", details: "Ena Shinonome adalah gadis cerdas dengan bakat seni yang luar biasa. Dia perfeksionalis yang selalu berusaha memberikan yang terbaik dalam setiap karya.", words: "Kesempurnaan dalam seni adalah tujuan saya.", sound: "sounds/anime_ena.mp3", traits: { brave: 1, smart: 3, gentle: 2, leader: 1, warm: 1, cautious: 2 } },
    { name: "Anime-Mafuyu", gender: "female", img: "images/anime_mafuyu.png", desc: "Gadis pendiam dengan bakat musik tersembunyi.", details: "Mafuyu Asahina adalah gadis pendiam yang menyimpan bakat musik luar biasa. Meskipun pemalu, hatinya penuh dengan melodi indah yang ingin dibagikan.", words: "Musik adalah bahasa hati saya.", sound: "sounds/anime_mafuyu.mp3", traits: { brave: 0, smart: 2, gentle: 3, leader: 0, warm: 2, cautious: 2 } },
    { name: "Anime-Kanade", gender: "female", img: "images/anime_kanade.png", desc: "Komposer berbakat dengan hati yang hangat.", details: "Kanade Yoisaki adalah komposer berbakat yang menciptakan musik untuk menghibur orang. Hatinya yang hangat tercermin dalam setiap melodi yang dia ciptakan.", words: "Lagu saya dilahirkan dari cinta.", sound: "sounds/anime_kanade.mp3", traits: { brave: 1, smart: 3, gentle: 3, leader: 1, warm: 3, cautious: 0 } },
    { name: "Anime-Mizuki", gender: "male", img: "images/anime_mizuki.png", desc: "Pemuda feminin dengan kepribadian ceria.", details: "Mizuki Akiyama adalah pemuda dengan penampilan feminin yang memiliki kepribadian ceria dan menyenangkan. Dia ahli dalam menciptakan suasana yang menyenangkan bagi teman-temannya.", words: "Kesenangan adalah obat terbaik untuk jiwa!", sound: "sounds/anime_mizuki.mp3", traits: { brave: 2, smart: 2, gentle: 3, leader: 1, warm: 3, cautious: 0 } },
    { name: "Anime-Jaehwan", gender: "male", img: "images/anime_jaehwan.png", desc: "Pria kuat dengan masa lalu gelap.", details: "Jaehwan adalah pria kuat dengan masa lalu yang gelap namun hati yang penuh determinasi. Dia berjuang untuk mengubah takdirnya melalui usaha yang gigih.", words: "Takdir bukan penghalang untuk berubah.", sound: "sounds/anime_jaehwan.mp3", traits: { brave: 3, smart: 2, gentle: 1, leader: 2, warm: 1, cautious: 1 } },
    { name: "Anime-Otto", gender: "male", img: "images/anime_otto.png", desc: "Prajurit jatuh dengan kekuatan dahsyat.", details: "Otto Apocalypse adalah prajurit jatuh dengan kekuatan dahsyat namun tujuan yang misterius. Ketenangan di wajahnya menyembunyikan ambisi yang dalam.", words: "Kekuatan adalah alat untuk mencapai cita-cita.", sound: "sounds/anime_otto.mp3", traits: { brave: 3, smart: 3, gentle: 0, leader: 2, warm: 0, cautious: 2 } },
    { name: "Anime-Void", gender: "male", img: "images/anime_void.png", desc: "Entitas kuno dengan kebijaksanaan abadi.", details: "Void Archives adalah entitas kuno dengan kebijaksanaan yang telah terakumulasi selama berabad-abad. Dia memiliki pemahaman mendalam tentang alam semesta.", words: "Pengetahuan kuno adalah cahaya dalam kegelapan.", sound: "sounds/anime_void.mp3", traits: { brave: 1, smart: 3, gentle: 0, leader: 1, warm: 0, cautious: 3 } },
    { name: "Anime-FuHua", gender: "female", img: "images/anime_fuhua.png", desc: "Prajurit Cina kuno yang penuh kebijaksanaan.", details: "Fu Hua adalah prajurit Cina kuno yang penuh kebijaksanaan dan pengalaman. Dia menyembunyikan kekuatan dahsyat di balik makian tenangnya.", words: "Pengalaman adalah guru terbaik hidup.", sound: "sounds/anime_fuhua.mp3", traits: { brave: 3, smart: 3, gentle: 2, leader: 2, warm: 2, cautious: 1 } },
    { name: "Anime-Sirin", gender: "female", img: "images/anime_sirin.png", desc: "Pembunuh surgawi dengan kekuatan absolut.", details: "Sirin adalah pembunuh surgawi dengan kekuatan absolut yang jarang tertandingi. Meskipun terkesan kejam, dia memiliki motivasi yang mendalam di balik tindakannya.", words: "Kekuatan adalah bukti keberadaan sejati.", sound: "sounds/anime_sirin.mp3", traits: { brave: 3, smart: 2, gentle: 0, leader: 1, warm: 0, cautious: 1 } },
    { name: "Anime-Kumiko", gender: "female", img: "images/anime_kumiko.png", desc: "Pemain tuba dengan dedikasi tinggi.", details: "Kumiko Oumae adalah pemain tuba dengan dedikasi tinggi terhadap musiknya. Dia melawan keraguan diri dan terus berjuang untuk kesempurnaan.", words: "Musik adalah dedikasi seumur hidup saya.", sound: "sounds/anime_kumiko.mp3", traits: { brave: 2, smart: 2, gentle: 1, leader: 1, warm: 2, cautious: 1 } },
    { name: "Anime-Hachiman", gender: "male", img: "images/anime_hachiman.png", desc: "Pria pesimis dengan hati yang tulus.", details: "Hikigaya Hachiman adalah pria pesimis yang sarkastis namun memiliki hati yang tulus. Dia memahami dunia dengan perspektif yang tajam dan unik.", words: "Ketulusan adalah kelemahan dan kekuatan.", sound: "sounds/anime_hachiman.mp3", traits: { brave: 1, smart: 3, gentle: 1, leader: 0, warm: 1, cautious: 2 } },
    { name: "Anime-Ichikawa", gender: "male", img: "images/anime_ichikawa.png", desc: "Pemain bola dengan obsesi yang dalam.", details: "Ichikawa Kyoutarou adalah pemain bola dengan obsesi mendalam terhadap permainannya. Dia selalu berusaha menciptakan goal yang sempurna.", words: "Goal sempurna adalah satu-satunya tujuan.", sound: "sounds/anime_ichikawa.mp3", traits: { brave: 3, smart: 2, gentle: 0, leader: 1, warm: 1, cautious: 0 } },
    { name: "Anime-AnnaY", gender: "female", img: "images/anime_annay.png", desc: "Pemain wanita dengan keyakinan kokoh.", details: "Yamada Anna adalah pemain wanita dengan keyakinan yang kokoh terhadap tujuannya. Dia berjuang untuk membuktikan potensinya di dunia yang penuh tantangan.", words: "Wanita juga bisa menjadi monster!", sound: "sounds/anime_annay.mp3", traits: { brave: 3, smart: 2, gentle: 1, leader: 2, warm: 2, cautious: 0 } },
    { name: "Anime-Fumiya", gender: "male", img: "images/anime_fumiya.png", desc: "Pemuda biasa dengan tekad luar biasa.", details: "Fumiya Tomozaki adalah pemuda biasa yang menganggap dirinya karakter rank terbawah. Namun dengan tekad luar biasa, dia terus berkembang dan berubah.", words: "Karakter biasa bisa menjadi istimewa.", sound: "sounds/anime_fumiya.mp3", traits: { brave: 2, smart: 2, gentle: 1, leader: 1, warm: 2, cautious: 1 } },
    { name: "Anime-Yatora", gender: "male", img: "images/anime_yatora.png", desc: "Seniman muda dengan semangat membara.", details: "Yatora Yaguchi adalah seniman muda dengan semangat membara untuk seni. Dia berjuang membuktikan potensinya di akademi seni yang kompetitif.", words: "Seni adalah passion terdalam saya.", sound: "sounds/anime_yatora.mp3", traits: { brave: 2, smart: 2, gentle: 1, leader: 1, warm: 2, cautious: 0 } },
    { name: "Anime-Isagi", gender: "male", img: "images/anime_isagi.png", desc: "Penyerang berbakat dengan insting tajam.", details: "Isagi Yoichi adalah penyerang berbakat dengan insting tajam dalam permainan bola. Dia memiliki kemampuan spatial yang luar biasa untuk membaca permainan.", words: "Insting adalah kunci kemenangan saya.", sound: "sounds/anime_isagi.mp3", traits: { brave: 3, smart: 3, gentle: 0, leader: 2, warm: 1, cautious: 0 } },
    { name: "Anime-Michael", gender: "male", img: "images/anime_michael.png", desc: "Raja lapangan dengan kepribadian ratu.", details: "Michael Kaiser adalah pemain dengan ego besar namun bakat yang sesuai. Dia memiliki magnetism yang membuat orang terpesona sekaligus terganggu.", words: "Saya adalah raja dari lapangan ini.", sound: "sounds/anime_michael.mp3", traits: { brave: 3, smart: 2, gentle: 0, leader: 3, warm: 0, cautious: 0 } },
    { name: "Anime-Ego", gender: "male", img: "images/anime_ego.png", desc: "Pelatih jenius dengan perspektif unik.", details: "Ego Jinpachi adalah pelatih jenius dengan perspektif unik tentang permainan. Dia selalu berpikir di luar kotak untuk menemukan solusi terbaik.", words: "Genius adalah orang yang berpikir berbeda.", sound: "sounds/anime_ego.mp3", traits: { brave: 1, smart: 3, gentle: 0, leader: 3, warm: 0, cautious: 1 } },
    { name: "Anime-Bachira", gender: "male", img: "images/anime_bachira.png", desc: "Pemain dengan kepribadian ceria dan liar.", details: "Meguru Bachira adalah pemain dengan kepribadian ceria dan liar yang membawa energi positif. Dia main dengan hati penuh kegembiraan dan spontanitas.", words: "Main dengan hati adalah cara terbaik!", sound: "sounds/anime_bachira.mp3", traits: { brave: 2, smart: 1, gentle: 1, leader: 1, warm: 3, cautious: 0 } },
    { name: "Anime-Kunigami", gender: "male", img: "images/anime_kunigami.png", desc: "Pemain tangguh dengan determinasi tinggi.", details: "Rensuke Kunigami adalah pemain tangguh dengan determinasi tinggi untuk terus berkembang. Dia loyal dan selalu siap mendukung rekan-rekannya.", words: "Ketekunan adalah kunci kesuksesan sejati.", sound: "sounds/anime_kunigami.mp3", traits: { brave: 3, smart: 2, gentle: 2, leader: 2, warm: 2, cautious: 0 } },
    { name: "Anime-Reo", gender: "male", img: "images/anime_reo.png", desc: "Pemain kaya dengan passion sejati.", details: "Reo Mikage adalah pemain yang memiliki segalanya namun tetap bersemangat bermain. Dia membuktikan bahwa uang bukan segala-galanya dalam bola.", words: "Passion adalah kekayaan sejati yang abadi.", sound: "sounds/anime_reo.mp3", traits: { brave: 2, smart: 2, gentle: 1, leader: 2, warm: 3, cautious: 0 } },
    { name: "Anime-Seele", gender: "female", img: "images/anime_seele.png", desc: "Ratu koloni dengan kekuatan absolut.", details: "Seele Vollerei adalah ratu koloni dengan kekuatan absolut terhadap konspirasi dunia. Dia memiliki visi yang jauh dan determinasi yang tak tergoyang.", words: "Tujuan kami adalah takdir seluruh dunia.", sound: "sounds/anime_seele.mp3", traits: { brave: 3, smart: 3, gentle: 0, leader: 3, warm: 0, cautious: 1 } },
    { name: "Anime-Kousei", gender: "male", img: "images/anime_kousei.png", desc: "Pianis jenius dengan trauma masa lalu.", details: "Kousei Arima adalah pianis jenius namun terikat dengan trauma masa lalu. Musiknya indah tapi dingin sampai dia menemukan inspirasi baru.", words: "Musik adalah terapi jiwa yang penuh cinta.", sound: "sounds/anime_kousei.mp3", traits: { brave: 1, smart: 3, gentle: 2, leader: 1, warm: 1, cautious: 2 } },
    { name: "Anime-Dokja", gender: "male", img: "images/anime_dokja.png", desc: "Pembaca pembunuh dengan pengetahuan mendalam.", details: "Kim Dokja adalah pembaca dengan pengetahuan mendalam tentang cerita dunia. Dia menggunakan pengetahuannya untuk mengubah nasib dan menyelamatkan orang-orang.", words: "Cerita adalah alat terkuat untuk mengubah dunia.", sound: "sounds/anime_dokja.mp3", traits: { brave: 3, smart: 3, gentle: 2, leader: 3, warm: 2, cautious: 1 } }
];

// ============ QUIZ QUESTIONS ARRAY ============
const quizQuestions = [{
        question: "Ketika ada masalah besar, kamu cenderung...",
        answers: [
            { text: "Menghadapinya dengan berani", traits: { brave: 2 } },
            { text: "Berpikir strategis dulu", traits: { smart: 2 } },
            { text: "Mencari bantuan teman", traits: { warm: 2 } },
            { text: "Menunggu dan melihat situasi", traits: { cautious: 2 } }
        ]
    },
    {
        question: "Dalam kelompok, peran kamu biasanya...",
        answers: [
            { text: "Pemimpin yang mengambil inisiatif", traits: { leader: 2 } },
            { text: "Anggota yang setia dan mendukung", traits: { warm: 2 } },
            { text: "Pemikir yang analitis", traits: { smart: 2 } },
            { text: "Pendengki tugas", traits: { cautious: 2 } }
        ]
    },
    {
        question: "Ketika berhadapan dengan ketidakadilan, reaksi pertamamu...",
        answers: [
            { text: "Langsung melawan dengan keras", traits: { brave: 2 } },
            { text: "Mencari solusi yang bijaksana", traits: { smart: 2 } },
            { text: "Merasa sangat tersentuh", traits: { gentle: 2 } },
            { text: "Menunggu waktu yang tepat", traits: { cautious: 2 } }
        ]
    },
    {
        question: "Bagaimana kamu mengatasi stres?",
        answers: [
            { text: "Menghadapinya secara langsung", traits: { brave: 2 } },
            { text: "Mencari carayang logis", traits: { smart: 2 } },
            { text: "Menghabiskan waktu dengan orang terkasih", traits: { warm: 2 } },
            { text: "Berdiam diri dan merenung", traits: { cautious: 2 } }
        ]
    },
    {
        question: "Dalam situasi darurat, kamu cenderung...",
        answers: [
            { text: "Mengambil tanggung jawab dan memimpin", traits: { leader: 2 } },
            { text: "Berpikir dengan jernih tentang solusi", traits: { smart: 2 } },
            { text: "Mendukung yang lain dengan empati", traits: { gentle: 2 } },
            { text: "Berhati-hati dan mengikuti arahan", traits: { cautious: 2 } }
        ]
    },
    {
        question: "Hubungan dengan orang lain yang penting bagi kamu...",
        answers: [
            { text: "Melindungi dan membela mereka", traits: { brave: 2 } },
            { text: "Memberikan nasihat dan bimbingan", traits: { smart: 2 } },
            { text: "Memberikan perhatian dan kasih sayang", traits: { warm: 2 } },
            { text: "Menghormati privasi mereka", traits: { cautious: 2 } }
        ]
    },
    {
        question: "Apa yang paling kamu hargai dalam hidup?",
        answers: [
            { text: "Keberanian dan tantangan", traits: { brave: 2 } },
            { text: "Pengetahuan dan pemahaman", traits: { smart: 2 } },
            { text: "Cinta dan hubungan yang hangat", traits: { warm: 2 } },
            { text: "Kedamaian dan keamanan", traits: { cautious: 2 } }
        ]
    },
    {
        question: "Ketika dimandatkan tanggung jawab besar, perasaanmu...",
        answers: [
            { text: "Siap dan bersemangat mengambilnya", traits: { brave: 2 } },
            { text: "Memikirkan setiap detail dengan matang", traits: { smart: 2 } },
            { text: "Khawatir tapi tetap berusaha", traits: { gentle: 2 } },
            { text: "Merasa berat dan meminta bantuan", traits: { cautious: 2 } }
        ]
    },
    {
        question: "Gaya hidupmu yang ideal adalah...",
        answers: [
            { text: "Petualangan dan aksi penuh", traits: { brave: 2 } },
            { text: "Rutinitas terstruktur dan terukur", traits: { smart: 2 } },
            { text: "Adem ayem dan menyenangkan", traits: { warm: 2 } },
            { text: "Tenang dan terhindar dari konflik", traits: { cautious: 2 } }
        ]
    }
];

// ============ ADMIN FUNCTIONS & UI MANAGEMENT ============

function openAdmin() {
    document.getElementById("home").classList.add("hidden");
    document.getElementById("adminPanel").classList.remove("hidden");
    switchAdminTab('add');
    refreshCharacterList();
    populateCharacterSelect();
    refreshNameMappingList();
}

function closeAdmin() {
    document.getElementById("adminPanel").classList.add("hidden");
    document.getElementById("home").classList.remove("hidden");
}

// ============ ADMIN PANEL FUNCTIONS ============

function addCharacter() {
    const name = document.getElementById("charName").value.trim();
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
    list.innerHTML = "";
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
}

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
                <input id="charName" placeholder="✦ Nama karakter">
                <select id="charGender">
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

                <input id="charDesc" placeholder="Deskripsi singkat karakter">
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
        list.innerHTML = '<h3>Daftar Karakter</h3><div id="characterList"></div>';
        refreshCharacterList();
    } else if (tab === 'edit') {
        form.innerHTML = `
            <h3>✏️ Edit Karakter</h3>
            <div class="form-section-inner">
                <select id="editCharSelect" onchange="loadCharacterForEdit()" style="margin-bottom:15px;">
                    <option value="">Pilih karakter untuk diedit...</option>
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
        // Populate edit select
        const editSelect = document.getElementById('editCharSelect');
        if (editSelect) {
            editSelect.innerHTML = '<option value="">Pilih karakter untuk diedit...</option>';
            characters.forEach(ch => {
                const opt = document.createElement('option');
                opt.value = ch.name;
                opt.textContent = stripCharacterPrefix(ch.name);
                editSelect.appendChild(opt);
            });
        }
        list.innerHTML = '';
    } else if (tab === 'mappings') {
        form.innerHTML = `
            <h3>🔗 Mapping Nama ke Karakter</h3>
            <div style="display:flex;gap:10px;margin-bottom:15px;">
                <input id="mapName" placeholder="Nama user (kecilkan otomatis)" style="flex:1;">
                <select id="mapCharacter" style="flex:1;" onchange="updateCharacterPreview()">
                    <option value="">Pilih karakter...</option>
                </select>
            </div>
            <div id="charPreview" style="display:none;background:rgba(0,0,0,0.3);padding:10px;border-radius:8px;margin-bottom:15px;text-align:center;">
                <img id="previewImg" style="width:60px;height:60px;border-radius:50%;object-fit:cover;margin-bottom:8px;">
                <div><strong id="previewName"></strong></div>
                <div style="font-size:0.9em;color:var(--text-secondary);" id="previewDesc"></div>
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
    
    localStorage.setItem('characters', JSON.stringify(characters));
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
    const byGender = characters.reduce((acc, c) => { acc[c.gender] = (acc[c.gender] || 0) + 1; return acc; }, {});
    el.innerHTML = `<p>Total karakter: ${total}</p><p>By gender: ${JSON.stringify(byGender)}</p>`;
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

if (document.getElementById('adminPanel')) switchAdminTab('characters');