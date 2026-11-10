let num = 0;
let Blue_random = [];
let Pink_random = [];
let Green_random = [];
let Yellow_random = [];
let Orange_random = [];
let random = [];
let set_random = 0;
let what_do = 0;
const audioList = [];

// Cloudflare WorkerのURLに置き換えてください。
const CLOUD_API_BASE = "https://hyakunin-isshu-save.tcg-nekosuzuki.workers.dev";
let resumeFromSavedPosition = false;

// 再生状態と制御用変数
let isPlaying = false;
let currentPlaylist = [];
let currentIndex = 0;
let currentAudio = null;

function make_random(max, min) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function setup() {
    for (let i = 1; i <= 100; i++) {
        audioList.push({
            id: i,
            title: `トラック ${i}`,
            kamiUrl: `assets/audio/track${i}_kami.mp3`,
            shimoUrl: `assets/audio/track${i}_shimo.mp3`,
            text: `トラック${i}の歌`
        });
    }

    for (let i = 0; random.length < 100; i++) {
        set_random = make_random(100, 1);
        if (!random.includes(set_random)) {
            random.push(set_random);
        }
    }

    F_Reset();
    updateCounterDisplay();
}

function F_Reset() {
    Blue_random = []; Pink_random = []; Yellow_random = []; Green_random = []; Orange_random = [];

    for (let i = 0; Blue_random.length < 20; i++) {
        set_random = make_random(20, 1);
        if (!Blue_random.includes(set_random)) Blue_random.push(set_random);
    }
    for (let i = 0; Pink_random.length < 20; i++) {
        set_random = make_random(40, 21);
        if (!Pink_random.includes(set_random)) Pink_random.push(set_random);
    }
    for (let i = 0; Yellow_random.length < 20; i++) {
        set_random = make_random(60, 41);
        if (!Yellow_random.includes(set_random)) Yellow_random.push(set_random);
    }
    for (let i = 0; Green_random.length < 20; i++) {
        set_random = make_random(80, 61);
        if (!Green_random.includes(set_random)) Green_random.push(set_random);
    }
    for (let i = 0; Orange_random.length < 20; i++) {
        set_random = make_random(100, 81);
        if (!Orange_random.includes(set_random)) Orange_random.push(set_random);
    }
}

function getTargetList() {
    if (what_do == 0) return random;
    if (what_do == 1) return Blue_random;
    if (what_do == 2) return Pink_random;
    if (what_do == 3) return Yellow_random;
    if (what_do == 4) return Green_random;
    if (what_do == 5) return Orange_random;
    return [];
}

function updateCounterDisplay() {
    const targetList = getTargetList();
    const remaining = Math.max(0, targetList.length - currentIndex);
    document.getElementById("remainingCount").textContent = remaining;
}

function updateStatus(text) {
    document.getElementById("statusText").textContent = text;
}

function sleep(ms) {
    return new Promise(resolve => {
        const timer = setTimeout(resolve, ms);
        const checkInterval = setInterval(() => {
            if (!isPlaying) {
                clearTimeout(timer);
                clearInterval(checkInterval);
                resolve();
            }
        }, 100);
    });
}

function playAudioPromise(audioUrl, speechText) {
    return new Promise((resolve) => {
        if (!isPlaying) {
            resolve();
            return;
        }

        currentAudio = new Audio(audioUrl);

        currentAudio.play().then(() => {
            currentAudio.onended = () => {
                currentAudio = null;
                resolve();
            };
        }).catch(() => {
            if ('speechSynthesis' in window) {
                window.speechSynthesis.cancel();
                const uttr = new SpeechSynthesisUtterance(speechText);
                uttr.lang = "ja-JP";
                uttr.rate = 0.85;
                uttr.onend = () => resolve();
                uttr.onerror = () => resolve();
                window.speechSynthesis.speak(uttr);
            } else {
                setTimeout(resolve, 2000);
            }
        });
    });
}

// --- セーブコード生成・読み込み処理 ---

// 1. セーブコード生成
function generateSaveCode() {
    const saveData = {
        w: what_do,
        r: random,
        b: Blue_random,
        p: Pink_random,
        y: Yellow_random,
        g: Green_random,
        o: Orange_random
    };

    // オブジェクトをJSON文字列化してBase64エンコード
    const jsonString = JSON.stringify(saveData);
    const code = btoa(encodeURIComponent(jsonString));

    document.getElementById("generatedCodeInput").value = code;
    updateStatus("セーブコードを発行しました。");
}

// 2. クリップボードへコピー
function copySaveCode() {
    const input = document.getElementById("generatedCodeInput");
    if (!input.value) {
        alert("先に「コード発行」を押してください。");
        return;
    }

    navigator.clipboard.writeText(input.value).then(() => {
        alert("セーブコードをクリップボードにコピーしました！");
    }).catch(() => {
        input.select();
        document.execCommand("copy");
        alert("セーブコードをコピーしました！");
    });
}

// 3. セーブコード読み込み
function loadSaveCode() {
    if (isPlaying) {
        alert("再生中はロードできません。停止してから実行してください。");
        return;
    }

    const code = document.getElementById("loadCodeInput").value.trim();
    if (!code) {
        alert("セーブコードを入力してください。");
        return;
    }

    try {
        // Base64デコードしてJSONパース
        const jsonString = decodeURIComponent(atob(code));
        const saveData = JSON.parse(jsonString);

        if (saveData.w === undefined || !Array.isArray(saveData.r)) {
            throw new Error("無効なコードです");
        }

        // 変数の復元
        what_do = saveData.w;
        random = [...saveData.r];
        Blue_random = [...saveData.b];
        Pink_random = [...saveData.p];
        Yellow_random = [...saveData.y];
        Green_random = [...saveData.g];
        Orange_random = [...saveData.o];

        // UIボタンのアクティブ表示更新
        document.querySelectorAll(".mode-btn").forEach(btn => {
            const btnMode = parseInt(btn.getAttribute("data-mode"), 10);
            if (btnMode === what_do) {
                btn.classList.add("active");
            } else {
                btn.classList.remove("active");
            }
        });

        currentIndex = 0;
        updateCounterDisplay();
        updateStatus("セーブコードから読み込みが完了しました。");
        alert("順序を読み込みました！");
    } catch (e) {
        alert("正しいセーブコードではありません。コードを確認してください。");
    }
}


// --- Cloudflare Worker / KV 保存機能 ---

function getCloudSaveData() {
    return {
        w: what_do, r: random, b: Blue_random, p: Pink_random,
        y: Yellow_random, g: Green_random, o: Orange_random,
        position: currentIndex
    };
}

function validateCloudApi() {
    if (CLOUD_API_BASE.includes("YOUR-WORKER-NAME")) {
        throw new Error("script.jsのCLOUD_API_BASEにWorkerのURLを設定してください。");
    }
}

async function cloudSave() {
    const button = document.getElementById("cloudSaveBtn");
    try {
        validateCloudApi();
        button.disabled = true;
        updateStatus("クラウドに保存しています...");
        const response = await fetch(`${CLOUD_API_BASE}/api/save`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(getCloudSaveData())
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "保存に失敗しました。");
        document.getElementById("cloudIdInput").value = result.id;
        updateStatus("クラウドに保存しました（7日間有効）。");
        alert(`保存しました。\\n保存ID：${result.id}\\n有効期限：7日間`);
    } catch (error) {
        console.error(error);
        updateStatus("クラウド保存に失敗しました。");
        alert(error.message || "クラウド保存に失敗しました。");
    } finally {
        button.disabled = false;
    }
}

async function cloudLoad() {
    if (isPlaying) {
        alert("再生中はロードできません。停止してから実行してください。");
        return;
    }
    const id = document.getElementById("cloudIdInput").value.trim();
    if (!id) {
        alert("保存IDを入力してください。");
        return;
    }
    try {
        validateCloudApi();
        const response = await fetch(`${CLOUD_API_BASE}/api/load/${encodeURIComponent(id)}`);
        const result = await response.json();
        if (!response.ok) throw new Error(result.error || "読み込みに失敗しました。");
        const data = result.data;
        if (!data || !Array.isArray(data.r) || !Array.isArray(data.b) ||
            !Array.isArray(data.p) || !Array.isArray(data.y) ||
            !Array.isArray(data.g) || !Array.isArray(data.o) ||
            !Number.isInteger(data.w) || data.w < 0 || data.w > 5) {
            throw new Error("保存データの形式が正しくありません。");
        }

        what_do = data.w;
        random = [...data.r];
        Blue_random = [...data.b];
        Pink_random = [...data.p];
        Yellow_random = [...data.y];
        Green_random = [...data.g];
        Orange_random = [...data.o];

        const targetList = getTargetList();
        currentIndex = Math.max(0, Math.min(
            Number.isInteger(data.position) ? data.position : 0,
            targetList.length
        ));
        resumeFromSavedPosition = currentIndex > 0;

        document.querySelectorAll(".mode-btn").forEach(btn => {
            btn.classList.toggle("active",
                parseInt(btn.getAttribute("data-mode"), 10) === what_do);
        });
        updateCounterDisplay();
        const expiry = result.expiresAt
            ? new Date(result.expiresAt).toLocaleString("ja-JP")
            : "不明";
        updateStatus(`クラウドから読み込みました（有効期限：${expiry}）`);
        alert(`読み込みました。\\n${currentIndex + 1}曲目から再開できます。\\n「読み上げ開始」を押してください。`);
    } catch (error) {
        console.error(error);
        updateStatus("クラウド読み込みに失敗しました。");
        alert(error.message || "クラウド読み込みに失敗しました。");
    }
}

async function copyCloudId() {
    const input = document.getElementById("cloudIdInput");
    if (!input.value.trim()) {
        alert("保存IDがありません。");
        return;
    }
    try {
        await navigator.clipboard.writeText(input.value.trim());
        alert("保存IDをコピーしました。");
    } catch {
        input.select();
        document.execCommand("copy");
        alert("保存IDをコピーしました。");
    }
}

// --- 読み上げメイン処理 ---
async function main() {
    if (isPlaying) return;

    isPlaying = true;
    if (!resumeFromSavedPosition) currentIndex = 0;
    resumeFromSavedPosition = false;
    currentPlaylist = getTargetList();
    if (currentIndex >= currentPlaylist.length) currentIndex = 0;

    document.getElementById("startButton").disabled = true;
    document.getElementById("stopButton").disabled = false;

    const shouldPlayJoka = document.getElementById("playJokaCheckbox").checked;
    if (shouldPlayJoka) {
        updateStatus("【序歌】難波津に咲くやこの花...");
        await playAudioPromise("assets/audio/joka.mp3", "難波津に 咲くやこの花 冬ごもり 今を春べと 咲くやこの花");

        if (!isPlaying) return;

        const intervalNext = parseFloat(document.getElementById("intervalNext").value) * 1000;
        updateStatus(`間合い中 (${intervalNext / 1000}秒)`);
        await sleep(intervalNext);
    }

    for (; currentIndex < currentPlaylist.length; currentIndex++) {
        if (!isPlaying) break;

        updateCounterDisplay();
        const trackId = currentPlaylist[currentIndex];
        const audioData = audioList.find(audio => audio.id === trackId);

        updateStatus(`[${currentIndex + 1}/${currentPlaylist.length}] No.${trackId} (上の句)`);
        await playAudioPromise(audioData.kamiUrl, `トラック${trackId} 上の句`);

        if (!isPlaying) break;

        const intervalKamiShimo = parseFloat(document.getElementById("intervalKamiShimo").value) * 1000;
        updateStatus(`上の句・下の句の間合い (${intervalKamiShimo / 1000}秒)`);
        await sleep(intervalKamiShimo);

        if (!isPlaying) break;

        updateStatus(`[${currentIndex + 1}/${currentPlaylist.length}] No.${trackId} (下の句)`);
        await playAudioPromise(audioData.shimoUrl, `トラック${trackId} 下の句`);

        if (!isPlaying) break;

        const intervalNext = parseFloat(document.getElementById("intervalNext").value) * 1000;
        updateStatus(`次の歌への間合い (${intervalNext / 1000}秒)`);
        await sleep(intervalNext);
    }

    if (isPlaying) {
        updateStatus("すべての読み上げが完了しました。");
    }
    stopMain();
}

function stopMain() {
    isPlaying = false;

    if (currentAudio) {
        currentAudio.pause();
        currentAudio = null;
    }

    if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
    }

    currentIndex = 0;
    updateCounterDisplay();
    updateStatus("停止中");

    document.getElementById("startButton").disabled = false;
    document.getElementById("stopButton").disabled = true;
}

setup();

// --- イベントリスナー ---

// スライダー調整
document.getElementById("intervalKamiShimo").addEventListener("input", function () {
    document.getElementById("intervalKamiShimoVal").textContent = `${this.value} 秒`;
});

document.getElementById("intervalNext").addEventListener("input", function () {
    document.getElementById("intervalNextVal").textContent = `${this.value} 秒`;
});

// セーブコードボタン
document.getElementById("generateCodeBtn").addEventListener("click", generateSaveCode);
document.getElementById("copyCodeBtn").addEventListener("click", copySaveCode);
document.getElementById("loadCodeBtn").addEventListener("click", loadSaveCode);
document.getElementById("cloudSaveBtn").addEventListener("click", cloudSave);
document.getElementById("cloudLoadBtn").addEventListener("click", cloudLoad);
document.getElementById("cloudCopyBtn").addEventListener("click", copyCloudId);

// モード選択ボタン
document.querySelectorAll(".mode-btn").forEach(button => {
    button.addEventListener("click", function () {
        if (isPlaying) return;

        document.querySelectorAll(".mode-btn").forEach(btn => btn.classList.remove("active"));
        this.classList.add("active");

        what_do = parseInt(this.getAttribute("data-mode"), 10);
        currentIndex = 0;
        updateCounterDisplay();
    });
});

// 開始・停止ボタン
document.getElementById("startButton").addEventListener("click", main);
document.getElementById("stopButton").addEventListener("click", stopMain);