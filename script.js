// =====================================================
// Cloudflare WorkerのURL
// 末尾に / を付けないでください
// =====================================================

const CLOUD_API_BASE = "https://hyakunin-isshu-save.tcg-nekosuzuki.workers.dev";


// =====================================================
// データ
// =====================================================

let Blue_random = [];
let Pink_random = [];
let Green_random = [];
let Yellow_random = [];
let Orange_random = [];

let random = [];
let set_random = 0;
let what_do = 0;

let currentPlaylist = [];
let currentIndex = 0;

let isPlaying = false;
let isPaused = false;

let currentAudio = null;
let audioResolve = null;

// 読み上げ速度（1.0～2.0倍）
let playbackSpeed = 1.0;


// =====================================================
// 初期化
// =====================================================

function make_random(max, min) {
    return Math.floor(Math.random() * (max - min + 1)) + min;
}

function makeRandomList(min, max) {
    const result = [];

    while (result.length < max - min + 1) {
        const number = make_random(max, min);

        if (!result.includes(number)) {
            result.push(number);
        }
    }

    return result;
}

function setup() {
    random = makeRandomList(1, 100);

    F_Reset();

    updateCounterDisplay();
    updateIntervalDisplay();
}

function F_Reset() {
    Blue_random = makeRandomList(1, 20);
    Pink_random = makeRandomList(21, 40);
    Yellow_random = makeRandomList(41, 60);
    Green_random = makeRandomList(61, 80);
    Orange_random = makeRandomList(81, 100);
}


// =====================================================
// 読み上げ対象の取得
// =====================================================

function getTargetList() {
    switch (what_do) {
        case 0:
            return random;

        case 1:
            return Blue_random;

        case 2:
            return Pink_random;

        case 3:
            return Yellow_random;

        case 4:
            return Green_random;

        case 5:
            return Orange_random;

        default:
            return [];
    }
}


// =====================================================
// 表示更新
// =====================================================

function updateCounterDisplay() {
    const targetList = getTargetList();

    const remaining = Math.max(
        0,
        targetList.length - currentIndex
    );

    document.getElementById("remainingCount").textContent = remaining;
}

function updateStatus(text) {
    document.getElementById("statusText").textContent = text;
}

function updateIntervalDisplay() {
    const value = document.getElementById("intervalNext").value;

    document.getElementById("intervalNextVal").textContent =
        `${Number(value).toFixed(1)} 秒`;
}

function updateSpeedDisplay() {
    const slider = document.getElementById("playbackSpeed");
    playbackSpeed = Number(slider.value);

    document.getElementById("playbackSpeedVal").textContent =
        `${playbackSpeed.toFixed(1)} 倍`;

    // 再生中に変更した場合は、現在の音声にも即時反映する
    if (currentAudio) {
        currentAudio.playbackRate = playbackSpeed;
    }
}

function updateModeButtons() {
    document.querySelectorAll(".mode-btn").forEach(button => {
        const mode = Number(button.dataset.mode);

        button.classList.toggle("active", mode === what_do);
    });
}

function updateControlButtons() {
    document.getElementById("startButton").disabled =
        isPlaying;

    document.getElementById("pauseButton").disabled =
        !isPlaying;

    document.getElementById("stopButton").disabled =
        !isPlaying;

    document.getElementById("pauseButton").textContent =
        isPaused ? "再開" : "一時停止";
}


// =====================================================
// 一時停止・再開の管理
// =====================================================

function waitUntilResumed() {
    if (!isPaused) {
        return Promise.resolve();
    }

    return new Promise(resolve => {
        const check = () => {
            if (!isPaused || !isPlaying) {
                resolve();
            } else {
                setTimeout(check, 100);
            }
        };

        check();
    });
}

function pauseMain() {
    if (!isPlaying) return;

    if (!isPaused) {
        isPaused = true;

        if (currentAudio) {
            currentAudio.pause();
        }

        updateStatus("一時停止中");
    } else {
        isPaused = false;

        if (currentAudio) {
            currentAudio.play().catch(error => {
                console.error("音声再開エラー:", error);
                stopMain();
            });
        }

        updateStatus("再生中");
    }

    updateControlButtons();
}


// =====================================================
// 待機処理
// 一時停止中は時間を進めない
// =====================================================

async function sleep(ms) {
    let remaining = ms;

    while (remaining > 0 && isPlaying) {
        await waitUntilResumed();

        if (!isPlaying) return;

        const start = Date.now();
        const waitTime = Math.min(remaining, 100);

        await new Promise(resolve => {
            setTimeout(resolve, waitTime);
        });

        if (!isPaused) {
            remaining -= Date.now() - start;
        }
    }
}


// =====================================================
// 音声再生
// =====================================================

function playAudioPromise(audioUrl) {
    return new Promise((resolve, reject) => {
        if (!isPlaying) {
            resolve();
            return;
        }

        currentAudio = new Audio(audioUrl);
        currentAudio.playbackRate = playbackSpeed;

        let completed = false;

        audioResolve = () => {
            if (completed) return;

            completed = true;
            currentAudio = null;
            audioResolve = null;
            resolve();
        };

        currentAudio.onended = () => {
            audioResolve?.();
        };

        currentAudio.onerror = () => {
            if (completed) return;

            completed = true;
            currentAudio = null;
            audioResolve = null;

            reject(new Error(`音声ファイルを読み込めません: ${audioUrl}`));
        };

        currentAudio.play().catch(error => {
            if (completed) return;

            completed = true;
            currentAudio = null;
            audioResolve = null;

            reject(error);
        });
    });
}


// =====================================================
// 音声ファイルのパス
// =====================================================

function getAudioPath(number) {
    const fileNumber = String(number).padStart(3, "0");

    return `assets/a${fileNumber}.mp3`;
}


// =====================================================
// Cloudflare保存データ
// =====================================================

function createSaveData() {
    // Cloudflare Workerの保存形式に合わせた短縮キーを使用する
    return {
        w: what_do,
        r: [...random],
        b: [...Blue_random],
        p: [...Pink_random],
        y: [...Yellow_random],
        g: [...Green_random],
        o: [...Orange_random],
        position: currentIndex,

        // Workerは追加プロパティを許容するため、設定も一緒に保存する
        settings: {
            playJoka: document.getElementById("playJokaCheckbox").checked,
            intervalNext: Number(
                document.getElementById("intervalNext").value
            ),
            playbackSpeed
        }
    };
}


// =====================================================
// Cloudflareに保存
// POST /api/save
// =====================================================

async function saveToCloud() {
    const button = document.getElementById("saveButton");

    button.disabled = true;
    updateStatus("クラウドに保存中...");

    try {
        const payload = createSaveData();

        // 送信前にWorkerと同じ条件でデータを検証する
        validateSaveData(payload);

        const response = await fetch(
            `${CLOUD_API_BASE}/api/save`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            }
        );

        // JSON以外のエラーレスポンスも診断できるよう、まず文字列で取得する
        const responseText = await response.text();
        let result = {};

        try {
            result = responseText ? JSON.parse(responseText) : {};
        } catch {
            result = {};
        }

        if (!response.ok) {
            console.error("Cloudflare Worker response:", {
                status: response.status,
                body: responseText,
                payload
            });

            throw new Error(
                result.error ||
                responseText ||
                `保存に失敗しました (${response.status})`
            );
        }

        if (!result.id) {
            throw new Error("保存IDが返されませんでした。");
        }

        document.getElementById("savedIdInput").value = result.id;

        updateStatus("保存が完了しました。");

        alert(
            `保存が完了しました。\n保存ID: ${result.id}\n有効期限は7日間です。`
        );

    } catch (error) {
        console.error(error);

        updateStatus("保存に失敗しました。");

        alert(
            "クラウドへの保存に失敗しました。\n" +
            "通信状態とCloudflare Workerの設定を確認してください。"
        );

    } finally {
        button.disabled = false;
    }
}


// =====================================================
// 保存IDのコピー
// =====================================================

async function copySaveId() {
    const input = document.getElementById("savedIdInput");

    if (!input.value) {
        alert("先に保存を実行してください。");
        return;
    }

    try {
        await navigator.clipboard.writeText(input.value);
        alert("保存IDをコピーしました。");

    } catch (error) {
        input.select();
        document.execCommand("copy");
        alert("保存IDをコピーしました。");
    }
}


// =====================================================
// 保存データの検証
// =====================================================

function validateSaveData(data) {
    const lists = [
        { key: "r", min: 1, max: 100, length: 100 },
        { key: "b", min: 1, max: 20, length: 20 },
        { key: "p", min: 21, max: 40, length: 20 },
        { key: "y", min: 41, max: 60, length: 20 },
        { key: "g", min: 61, max: 80, length: 20 },
        { key: "o", min: 81, max: 100, length: 20 }
    ];

    if (!Number.isInteger(data.w) || data.w < 0 || data.w > 5) {
        throw new Error("モード情報が不正です。");
    }

    for (const { key, min, max, length } of lists) {
        const list = data[key];

        if (!Array.isArray(list) || list.length !== length) {
            throw new Error(`保存データの配列 ${key} が不正です。`);
        }

        if (
            new Set(list).size !== length ||
            !list.every(number =>
                Number.isInteger(number) && number >= min && number <= max
            )
        ) {
            throw new Error(`保存データの配列 ${key} に不正な値があります。`);
        }
    }

    const maxPosition = data.w === 0 ? 100 : 20;

    if (
        !Number.isInteger(data.position) ||
        data.position < 0 ||
        data.position > maxPosition
    ) {
        throw new Error("再生位置が不正です。");
    }
}


// =====================================================
// Cloudflareから読み込み
// GET /api/load/:id
// =====================================================

async function loadFromCloud() {
    if (isPlaying) {
        alert("再生中は読み込みできません。停止してから実行してください。");
        return;
    }

    const id = document.getElementById("loadIdInput").value.trim();

    if (!id) {
        alert("保存IDを入力してください。");
        return;
    }

    updateStatus("クラウドから読み込み中...");

    try {
        const response = await fetch(
            `${CLOUD_API_BASE}/api/load/${encodeURIComponent(id)}`
        );

        if (response.status === 404) {
            throw new Error("保存データが見つかりません。期限切れの可能性があります。");
        }

        if (!response.ok) {
            throw new Error(`読み込みに失敗しました (${response.status})`);
        }

        const result = await response.json();

        // Workerが { data: {...} } 形式で返す場合にも対応
        const data = result.data ?? result;

        validateSaveData(data);

        // Workerの短縮キーから、アプリ内部の変数名へ復元する
        what_do = data.w;

        random = [...data.r];
        Blue_random = [...data.b];
        Pink_random = [...data.p];
        Yellow_random = [...data.y];
        Green_random = [...data.g];
        Orange_random = [...data.o];

        currentIndex = data.position;

        if (data.settings) {
            document.getElementById("playJokaCheckbox").checked =
                data.settings.playJoka ?? true;

            document.getElementById("intervalNext").value =
                data.settings.intervalNext ?? 4.0;

            document.getElementById("playbackSpeed").value =
                data.settings.playbackSpeed ?? 1.0;
        }

        updateIntervalDisplay();
        updateSpeedDisplay();
        updateModeButtons();
        updateCounterDisplay();

        document.getElementById("savedIdInput").value = id;

        updateStatus("読み込みが完了しました。");

        alert("保存データを読み込みました。");

    } catch (error) {
        console.error(error);

        updateStatus("読み込みに失敗しました。");

        alert(error.message || "読み込みに失敗しました。");
    }
}


// =====================================================
// 読み上げメイン処理
// =====================================================

async function main() {
    if (isPlaying) return;

    isPlaying = true;
    isPaused = false;

    currentPlaylist = [...getTargetList()];

    if (currentIndex >= currentPlaylist.length) {
        currentIndex = 0;
    }

    updateControlButtons();
    updateCounterDisplay();

    try {
        // 序歌は最初の1回だけ再生
        if (
            currentIndex === 0 &&
            document.getElementById("playJokaCheckbox").checked
        ) {
            updateStatus("序歌を再生中");

            await playAudioPromise("assets/naniwadu.mp3");

            if (!isPlaying) return;

            await waitUntilResumed();

            if (!isPlaying) return;

            const intervalNext =
                Number(document.getElementById("intervalNext").value) * 1000;

            updateStatus("次の歌への間合い");

            await sleep(intervalNext);
        }

        // 各歌の読み上げ
        for (
            ;
            currentIndex < currentPlaylist.length;
            currentIndex++
        ) {
            if (!isPlaying) break;

            await waitUntilResumed();

            if (!isPlaying) break;

            const trackId = currentPlaylist[currentIndex];

            updateCounterDisplay();

            updateStatus(
                `読み上げ中 (${currentIndex + 1}/${currentPlaylist.length})`
            );

            // 1首分の音声を再生
            await playAudioPromise(getAudioPath(trackId));

            if (!isPlaying) break;

            await waitUntilResumed();

            if (!isPlaying) break;

            // 次の歌への間合い
            const intervalNext =
                Number(document.getElementById("intervalNext").value) * 1000;

            updateStatus("次の歌への間合い");

            await sleep(intervalNext);
        }

        if (isPlaying) {
            currentIndex = currentPlaylist.length;

            updateCounterDisplay();

            updateStatus("すべての読み上げが完了しました。");
        }

    } catch (error) {
        console.error(error);

        updateStatus("音声の再生に失敗しました。");

        alert(
            "音声ファイルの再生に失敗しました。\n" +
            "ファイル名と配置を確認してください。\n\n" +
            error.message
        );

    } finally {
        if (isPlaying) {
            finishMain();
        }
    }
}


// =====================================================
// 再生終了時の処理
// =====================================================

function finishMain() {
    isPlaying = false;
    isPaused = false;

    currentAudio = null;
    audioResolve = null;

    updateControlButtons();
    updateCounterDisplay();
}


// =====================================================
// 停止
// =====================================================

function stopMain() {
    isPlaying = false;
    isPaused = false;

    if (currentAudio) {
        currentAudio.pause();
        currentAudio.currentTime = 0;
        currentAudio = null;
    }

    // 再生待ちのPromiseを終了させる
    if (audioResolve) {
        audioResolve();
    }

    currentIndex = 0;

    updateCounterDisplay();
    updateStatus("停止中");
    updateControlButtons();
}


// =====================================================
// イベントリスナー
// =====================================================

document.getElementById("intervalNext")
    .addEventListener("input", updateIntervalDisplay);

document.getElementById("playbackSpeed")
    .addEventListener("input", updateSpeedDisplay);

document.getElementById("saveButton")
    .addEventListener("click", saveToCloud);

document.getElementById("copyIdButton")
    .addEventListener("click", copySaveId);

document.getElementById("loadButton")
    .addEventListener("click", loadFromCloud);

document.getElementById("startButton")
    .addEventListener("click", main);

document.getElementById("pauseButton")
    .addEventListener("click", pauseMain);

document.getElementById("stopButton")
    .addEventListener("click", stopMain);


// モード選択
document.querySelectorAll(".mode-btn").forEach(button => {
    button.addEventListener("click", function () {
        if (isPlaying) return;

        what_do = Number(this.dataset.mode);

        currentIndex = 0;

        updateModeButtons();
        updateCounterDisplay();
    });
});


// =====================================================
// 起動
// =====================================================

setup();