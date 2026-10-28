
"use strict";

// ========================================
//  基本設定
// ========================================

// スタッフのアイコンに使用する色
const COLORS = [
    { name: "pink", value: "#FFD6E0" },
    { name: "peach", value: "#FFE0C2" },
    { name: "yellow", value: "#FFF0B8" },
    { name: "mint", value: "#D9F2D9" },
    { name: "sky", value: "#D8F0F7" },
    { name: "lavender", value: "#E3D9F7" },
    { name: "lilac", value: "#EED9EC" },
    { name: "pistachio", value: "#DCE8C8" },
    { name: "babyblue", value: "#D9E5F5" },
    { name: "beige", value: "#F3DFD0" }
];

// 曜日の表示に使用する文字
const DAYS = ["日", "月", "火", "水", "木", "金", "土"];

// ブラウザにデータを保存するときのキー
const KEY = "shiftManagerGithubPages_v1";

// HTMLのidから要素を取得する
const $ = id => document.getElementById(id);

// 数字を2桁にそろえる（例：3 → "03"）
const pad = n => String(n).padStart(2, "0");

// 日付を「年-月-日」の形式に変換する
const keyDate = d =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

// 「年-月-日」の文字列をDate型に変換する
const parseDate = s => {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
};

// 日付とスタッフIDを組み合わせた保存キーを作る
const cellKey = (d, id) => `${d}|${id}`;


// ========================================
//  初期データの作成
// ========================================

// 保存データがない場合に使用する初期データ
const empty = () => ({
    employees: [],   // スタッフ一覧
    requests: {},    // スタッフの勤務希望
    shifts: {},      // 確定したシフト
    holidays: [],    // 指定した休業日
    history: [],     // 自動生成の履歴

    // シフト作成に使用する設定
    settings: {
        basicRequired: 3,         // 1日に必要な基本人数
        levelTarget: 3,           // 必要なレベルの基準
        levelRequired: 1,         // 基準レベル以上の必要人数
        consecutiveEnabled: true, // 連勤制限を使用するか
        closedWeekdays: []        // 毎週の定休日
    },

    nextId: 1 // 次に使用するスタッフID
});


// ========================================
//  データの読み込みと保存
// ========================================

// ブラウザに保存されたデータを読み込む
function load() {
    try {
        const x = JSON.parse(localStorage.getItem(KEY));

        // 必要なデータが存在する場合は読み込む
        if (x && x.employees && x.settings) {
            return { ...empty(), ...x };
        }
    } catch (e) {
        // 読み込みに失敗した場合は初期データを使用する
    }

    return empty();
}

// アプリ全体で使用するデータ
let db = load();

// 現在表示している月
let month = new Date();

// 編集中のスタッフID
let editId = null;

// 選択中のスタッフカラーと曜日
let color = COLORS[0].name;
let unavailable = [];
let closed = [];

// 編集対象の勤務希望・シフト
let requestTarget = null;
let shiftTarget = null;

// データをブラウザに保存する
function save() {
    try {
        localStorage.setItem(KEY, JSON.stringify(db));
    } catch (e) {
        alert("保存できませんでした。ブラウザの空き容量を確認してください。");
    }
}

// HTMLに表示する文字列を安全な形式に変換する
function esc(v) {
    return String(v ?? "").replace(/[&<>"']/g, c => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[c]));
}

// 色の名前からカラーコードを取得する
function colorVal(n) {
    return COLORS.find(c => c.name === n)?.value || COLORS[0].value;
}

// 表示月の1日を取得する
function first() {
    return new Date(month.getFullYear(), month.getMonth(), 1);
}

// 表示月の最終日を取得する
function last() {
    return new Date(month.getFullYear(), month.getMonth() + 1, 0);
}

// 指定した日付・スタッフの勤務希望を取得する
function req(d, id) {
    return db.requests[cellKey(d, id)];
}

// 指定した日付・スタッフの確定シフトを取得する
function shift(d, id) {
    return db.shifts[cellKey(d, id)];
}


// ========================================
//  アプリの初期化
// ========================================

// HTMLの読み込み完了後に初期化処理を実行する
document.addEventListener("DOMContentLoaded", init);

// ボタンの動作を登録し、初期画面を表示する
function init() {
    // スタッフカラーの選択肢を表示
    drawColors();

    // スタッフの出勤できない曜日を設定
    drawWeekdays("unavailableChoices", unavailable, v => unavailable = v);

    // 毎週の定休日を設定
    drawWeekdays("closedWeekdays", closed, v => closed = v);

    // 自動生成期間の初期値を表示月に合わせる
    $("generationStart").value = keyDate(first());
    $("generationEnd").value = keyDate(last());

    // 指定休業日の初期値を今日にする
    $("holidayDate").value = keyDate(new Date());

    // 月移動ボタン
    $("prevMonth").onclick = () => moveMonth(-1);
    $("nextMonth").onclick = () => moveMonth(1);

    // 今月のカレンダーに戻る
    $("todayMonth").onclick = () => {
        month = new Date();
        render();
    };

    // 各フォーム・ボタンの動作を登録
    $("staffForm").onsubmit = saveEmployee;
    $("staffCancelEdit").onclick = resetForm;
    $("saveSettings").onclick = saveSettings;
    $("addHoliday").onclick = addHoliday;
    $("generateBtn").onclick = generate;

    // 勤務希望の操作
    $("reqCancel").onclick = () => close("requestModal");
    $("reqSave").onclick = saveRequest;

    // 確定シフトの操作
    $("shiftCancel").onclick = () => close("shiftModal");
    $("shiftSave").onclick = saveShift;

    // 履歴削除とバックアップ
    $("clearHistory").onclick = clearHistory;
    $("exportBtn").onclick = exportData;

    // バックアップ読み込みボタンを押すと、ファイル選択画面を開く
    $("importBtn").onclick = () => {
    $("importFile").click();
    };

    // 選択したファイルを読み込む
    $("importFile").onchange = importData;

    // 保存済みの設定を読み込んで画面を表示
    applySettings();
    render();
}

// 表示月を前後に移動する
function moveMonth(n) {
    month = new Date(month.getFullYear(), month.getMonth() + n, 1);

    // 自動生成期間も表示月に合わせる
    $("generationStart").value = keyDate(first());
    $("generationEnd").value = keyDate(last());

    render();
}

// カレンダー・スタッフ・休業日・履歴を再表示する
function render() {
    drawCalendar();
    drawEmployees();
    drawHolidays();
    drawHistory();
}


// ========================================
// スタッフカラーと曜日の設定
// ========================================

// スタッフのアイコンカラーを表示する
function drawColors() {
    $("colorChoices").innerHTML = COLORS.map(c =>
        `<button type="button"
            class="color-choice ${color === c.name ? "selected" : ""}"
            data-c="${c.name}"
            style="background:${c.value}"
            title="${c.name}"
            aria-label="${c.name}"></button>`
    ).join("");

    // 色をクリックしたら選択状態を更新する
    $("colorChoices").querySelectorAll("button").forEach(b => {
        b.onclick = () => {
            color = b.dataset.c;
            drawColors();
        };
    });
}

// 曜日を選択するボタンを表示する
function drawWeekdays(id, values, changed) {
    const root = $(id);

    root.innerHTML = DAYS.map((d, i) =>
        `<button type="button"
            class="weekday ${values.includes(i) ? "selected" : ""}"
            data-d="${i}">${d}</button>`
    ).join("");

    // 曜日ボタンをクリックしたときの処理
    root.querySelectorAll("button").forEach(b => {
        b.onclick = () => {
            const n = +b.dataset.d;

            // 選択済みなら解除、未選択なら追加する
            values = values.includes(n)
                ? values.filter(x => x !== n)
                : [...values, n].sort();

            // 選択状態を画面に反映する
            root.querySelectorAll("button").forEach(x => {
                x.classList.toggle("selected", values.includes(+x.dataset.d));
            });

            changed(values);
        };
    });
}


// ========================================
//  スタッフの登録・編集・削除
// ========================================

// スタッフを新規登録、または編集内容を保存する
function saveEmployee(e) {
    e.preventDefault();

    // 入力フォームからスタッフ情報を取得する
    const data = {
        name: $("staffName").value.trim(),
        level: +$("staffLevel").value,
        maxConsecutive: +$("staffMax").value,

        // 出勤時間を保存する（未入力なら17:00）
        startTime: $("staffStartTime").value || "17:00",
        // 曜日ごとの出勤時間を保存する
        // 空欄なら基本の出勤時間を使う
        startTimeOverrides: {
            mon: $("startTimeMon").value,
            tue: $("startTimeTue").value,
            wed: $("startTimeWed").value,
            thu: $("startTimeThu").value,
            fri: $("startTimeFri").value,
            sat: $("startTimeSat").value,
            sun: $("startTimeSun").value
        },


        color,
        unavailableWeekdays: [...unavailable]
    };


    // 名前が空欄なら登録しない
    if (!data.name) return;

    if (editId !== null) {
        // 編集中の場合は既存データを更新する
        const old = db.employees.find(x => x.id === editId);
        if (old) Object.assign(old, data);
    } else {
        // 新規登録の場合はIDを付けて追加する
        db.employees.push({ id: db.nextId++, ...data });
    }

    save();
    resetForm();
    render();
}

// 入力フォームを初期状態に戻す
function resetForm() {
    $("staffForm").reset();

    editId = null;
    color = COLORS[0].name;
    unavailable = [];

    drawColors();
    drawWeekdays("unavailableChoices", unavailable, v => unavailable = v);

    $("staffSubmit").textContent = "＋ スタッフ追加";
    $("staffCancelEdit").classList.add("hidden");
}

// 選択したスタッフの情報を編集フォームに表示する
function editEmployee(id) {
    const e = db.employees.find(x => x.id === id);
    if (!e) return;

    editId = id;
    color = e.color;
    unavailable = [...(e.unavailableWeekdays || [])];

    // スタッフ名を復元する
    $("staffName").value = e.name;
    // スタッフレベルを復元
    $("staffLevel").value = e.level;
    // 最大連勤日数を復元
    $("staffMax").value = e.maxConsecutive;
    // 基本の出勤時間を復元する（未設定の場合は17:00）
    $("staffStartTime").value = e.startTime || "17:00";
    // 古いデータに曜日別設定がなくてもエラーにならないようにする
    const times = e.startTimeOverrides || {};
    // 曜日ごとの出勤時間を復元する
    $("startTimeMon").value = times.mon || "";
    $("startTimeTue").value = times.tue || "";
    $("startTimeWed").value = times.wed || "";
    $("startTimeThu").value = times.thu || "";
    $("startTimeFri").value = times.fri || "";
    $("startTimeSat").value = times.sat || "";
    $("startTimeSun").value = times.sun || "";


    drawColors();
    drawWeekdays("unavailableChoices", unavailable, v => unavailable = v);

    $("staffSubmit").textContent = "変更を保存";
    $("staffCancelEdit").classList.remove("hidden");

    // 編集フォームが見える位置まで画面を移動する
    $("staffForm").scrollIntoView({ behavior: "smooth", block: "center" });
}

// スタッフを削除し、関連する勤務希望・シフトも削除する
function deleteEmployee(id) {
    const e = db.employees.find(x => x.id === id);

    if (!e || !confirm(
        `${e.name}さんを削除しますか？関連する希望とシフトも削除されます。`
    )) return;

    // スタッフ一覧から削除する
    db.employees = db.employees.filter(x => x.id !== id);

    // 対象スタッフの勤務希望とシフトを削除する
    [db.requests, db.shifts].forEach(obj => {
        Object.keys(obj).forEach(k => {
            if (k.endsWith("|" + id)) delete obj[k];
        });
    });

    save();

    // 編集中のスタッフを削除した場合はフォームをリセット
    if (editId === id) resetForm();

    render();
}

// スタッフ一覧を画面に表示する
function drawEmployees() {
    $("staffCount").textContent = `${db.employees.length}人`;

    // スタッフがいない場合の表示
    if (!db.employees.length) {
        $("staffList").innerHTML =
            '<div class="empty-state">スタッフを追加すると、ここに一覧が表示されます。</div>';
        return;
    }

    // スタッフ名・レベル・最大連勤日数・操作ボタンを表示する
    $("staffList").innerHTML = db.employees.map(e =>
        `<div class="staff-row">
            <div class="staff-info">
                <span class="color-dot" style="background:${colorVal(e.color)}"></span>
                <div>
                    <div class="staff-name">${esc(e.name)}</div>
                    <div class="staff-meta">Lv${e.level} ・ 最大連勤${e.maxConsecutive}日</div>
                </div>
            </div>
            <div class="row-actions">
                <button class="secondary" data-edit="${e.id}">編集</button>
                <button class="danger" data-del="${e.id}">削除</button>
            </div>
        </div>`
    ).join("");

    // 編集ボタンに処理を登録する
    $("staffList").querySelectorAll("[data-edit]").forEach(b => {
        b.onclick = () => editEmployee(+b.dataset.edit);
    });

    // 削除ボタンに処理を登録する
    $("staffList").querySelectorAll("[data-del]").forEach(b => {
        b.onclick = () => deleteEmployee(+b.dataset.del);
    });
}


// ========================================
//  定休日・必要人数などの設定
// ========================================

// 保存されている設定をフォームに反映する
function applySettings() {
    const s = db.settings;

    $("basicRequired").value = s.basicRequired;
    $("levelTarget").value = s.levelTarget;
    $("levelRequired").value = s.levelRequired;
    $("consecutiveEnabled").checked = s.consecutiveEnabled;

    // 始業時間と、その時間に必要な人数を画面に反映する
    $("requiredStartTime").value = s.requiredStartTime || "17:00";
    $("requiredStartCount").value = s.requiredStartCount ?? 1;

    closed = [...s.closedWeekdays];

    drawWeekdays("closedWeekdays", closed, v => closed = v);
}

// 設定フォームの内容を保存する
function saveSettings() {
    db.settings = {
        basicRequired: Math.max(0, +$("basicRequired").value || 0),
        levelTarget: +$("levelTarget").value,
        levelRequired: Math.max(0, +$("levelRequired").value || 0),
        consecutiveEnabled: $("consecutiveEnabled").checked,
        closedWeekdays: [...closed],

        // 始業時間と、その時間に必要な人数を保存する
        requiredStartTime: $("requiredStartTime").value || "17:00",
        requiredStartCount: Math.max(
            0,
            Math.min(100, Number($("requiredStartCount").value) || 0)
        )
    };

    // 保存して画面を更新する
    save();
    $("settingsMessage").textContent = "保存しました";
    render();
}


// 指定した日付を休業日に追加する
function addHoliday() {
    const d = $("holidayDate").value;

    if (!d) return alert("日付を選択してください");

    // 同じ日付が登録されていない場合だけ追加する
    if (!db.holidays.includes(d)) db.holidays.push(d);

    db.holidays.sort();
    save();
    drawHolidays();
}

// 指定休業日の一覧を表示する
function drawHolidays() {
    $("holidayList").innerHTML = db.holidays.length
        ? db.holidays.map(d =>
            `<span class="holiday-chip">${esc(d)}
                <button data-holiday="${d}" aria-label="削除">×</button>
            </span>`
        ).join("")
        : '<span class="muted">指定休業日はありません。</span>';

    // 削除ボタンを押した休業日を一覧から削除する
    $("holidayList").querySelectorAll("[data-holiday]").forEach(b => {
        b.onclick = () => {
            db.holidays = db.holidays.filter(d => d !== b.dataset.holiday);
            save();
            drawHolidays();
        };
    });
}


// ========================================
//  カレンダーの表示
// ========================================

// 表示月のスタッフ別カレンダーを作成する
function drawCalendar() {
    const root = $("calendar");
    root.innerHTML = "";

    // カレンダーのタイトルを更新する
    $("monthTitle").textContent =
        `${month.getFullYear()}年${month.getMonth() + 1}月`;

    const days = last().getDate();

    // 日付の見出しを作成する
    let h = '<div class="calendar-head">スタッフ</div>';

    for (let d = 1; d <= 31; d++) {
        const dt = new Date(month.getFullYear(), month.getMonth(), d);

        h += `<div class="calendar-head ${
            dt.getDay() === 0 ? "sunday" :
            dt.getDay() === 6 ? "saturday" : ""
        }">${
            d <= days
                ? `<div class="weekday-label">${DAYS[dt.getDay()]}</div>
                   <div class="date-label">${d}日</div>`
                : ""
        }</div>`;
    }

    root.innerHTML = h;

    // スタッフごとに1行ずつカレンダーを作る
    db.employees.forEach(e => {
        const name = document.createElement("div");
        name.className = "employee-name";
        name.innerHTML = `
            <span class="color-dot" style="background:${colorVal(e.color)}"></span>
            <span class="employee-label">${esc(e.name)}</span>
            <small>Lv${e.level}</small>
        `;
        root.appendChild(name);

        // 1日から31日までのセルを作る
        for (let d = 1; d <= 31; d++) {
            const c = document.createElement("div");
            c.className = "day-cell";

            // その月に存在しない日付は空欄にする
            if (d > days) {
                root.appendChild(c);
                continue;
            }

            const dt = new Date(month.getFullYear(), month.getMonth(), d);
            const day = keyDate(dt);
            const r = req(day, e.id);
            const s = shift(day, e.id);

            // 定休日かどうかを判定する
            const isClosed =
                closed.includes(dt.getDay()) || db.holidays.includes(day);

            // スタッフが出勤できない曜日かを判定する
            const isNG = (e.unavailableWeekdays || []).includes(dt.getDay());

            if (isClosed) {
                // 定休日は「休」と表示する
                c.classList.add("closed");
                c.innerHTML = `
                    <div class="day-number">${d}</div>
                    <div class="confirmed-mark">休</div>
                    <div class="preference-mark">定休日</div>
                `;
            } else if (s) {
                // 確定シフトがある場合は出勤・休みを表示する
                c.classList.add(
                    s.status === "work" ? "confirmed-work" : "confirmed-off"
                );

                c.innerHTML = `
                <div class="day-number">${d}</div>
                <div class="confirmed-mark">${
                    s.status === "work" ? "出" : "休"
                }</div>
                ${
                    s.status === "work"
                        ? `<div class="shift-time">${esc(s.startTime || e.startTime || "17:00")}</div>`
                        : ""
                }
                ${
                    r && r.request_type !== "none"
                        ? `<div class="preference-mark ${
                            r.request_type === "work" ? "pref-work" : "pref-off"
                        }">希望:${r.request_type === "work" ? "出" : "休"}</div>`
                        : ""
                }
                `;


                // 確定シフトをクリックすると編集画面を開く
                c.onclick = () => openShift(day, e.id);
            } else if (isNG) {
                // 出勤できない曜日はNGと表示する
                c.classList.add("unavailable");
                c.innerHTML = `
                    <div class="day-number">${d}</div>
                    <div class="confirmed-mark">NG</div>
                `;
            } else {
                // 未確定の日は勤務希望を表示する
                c.innerHTML = `
                    <div class="day-number">${d}</div>
                    ${
                        r && r.request_type !== "none"
                            ? `<div class="preference-mark ${
                                r.request_type === "work" ? "pref-work" : "pref-off"
                            }">${r.request_type === "work" ? "出勤希望" : "休み希望"}</div>`
                            : '<div class="muted">＋ 希望</div>'
                    }
                `;

                // セルをクリックすると勤務希望を入力できる
                c.onclick = () => openRequest(day, e.id);
            }

            root.appendChild(c);
        }
    });
}


// ========================================
//  勤務希望の登録・保存
// ========================================

// 勤務希望を入力する画面を開く
function openRequest(day = keyDate(new Date()), id = null) {
    if (!db.employees.length) {
        return alert("先にスタッフを追加してください");
    }

    // 編集する日付とスタッフを記録する
    requestTarget = {
        day,
        id: id ?? db.employees[0].id
    };

    $("reqDate").value = day;

    // スタッフ選択欄を作成する
    $("reqEmployee").innerHTML = db.employees.map(e =>
        `<option value="${e.id}">${esc(e.name)}</option>`
    ).join("");

    $("reqEmployee").value = requestTarget.id;

    // すでに希望が登録されていればフォームに反映する
    const r = req(day, requestTarget.id);
    $("reqType").value = r?.request_type || "work";
    $("reqComment").value = r?.comment || "";
    // その日の出勤時間を表示する
    const e = db.employees.find(x => x.id === requestTarget.id);
    const s = shift(day, requestTarget.id);

    $("reqStartTime").value =
        s?.startTime || e?.startTime || "17:00";

    $("requestContext").textContent = `${day} の勤務希望`;
    $("requestModal").classList.add("show");
}

// 入力された勤務希望を保存する
function saveRequest() {
    const day = $("reqDate").value;
    const id = +$("reqEmployee").value;
    const type = $("reqType").value;
    const comment = $("reqComment").value.trim();
    // この日の出勤時間を取得する
    const startTime = $("reqStartTime").value || "17:00";

    if (!day || !id) {
        return alert("日付とスタッフを選んでください");
    }

    const k = cellKey(day, id);

    // 希望が未設定でも、出勤時間が基本時間と異なる場合は保存する
    const e = db.employees.find(x => x.id === id);
    const basicTime = e?.startTime || "17:00";

    if (type === "none" && !comment && startTime === basicTime) {
        delete db.requests[k];
    } else {

        // 勤務希望とコメントを保存する
        db.requests[k] = {
            work_date: day,
            employee_id: id,
            request_type: type,
            comment,
            startTime
        };
    }

    save();
    close("requestModal");
    render();
}

// ========================================
//  確定シフトの編集・保存
// ========================================

// 確定シフトの編集画面を開く
function openShift(day, id) {
    // 編集する日付とスタッフを記録する
    shiftTarget = { day, id };

    const e = db.employees.find(x => x.id === id);
    const s = shift(day, id);

    // 編集画面のタイトルを表示する
    $("shiftTitle").textContent = `${day} / ${e?.name || ""}`;

    // 出勤・休みの設定を表示する
    $("shiftStatus").value = s.status;

    // コメントを表示する
    $("shiftComment").value = s.comment || "";

    // この日の勤務時間を表示する
    // 個別設定がなければ、スタッフの基本出勤時間を使う
    $("shiftStartTime").value =
        s.startTime || e?.startTime || "17:00";

    // 編集画面を開く
    $("shiftModal").classList.add("show");
}


 // 編集した確定シフトを保存する
function saveShift() {
    if (!shiftTarget) return;

    const k = cellKey(shiftTarget.day, shiftTarget.id);

    // スタッフの基本情報を取得する
    const e = db.employees.find(
        x => x.id === shiftTarget.id
    );

    // 現在のシフト情報を取得する
    const currentShift = db.shifts[k] || {};

    // 入力された勤務時間を取得する
    const startTime = $("shiftStartTime").value || "17:00";

    // その日・そのスタッフのシフトだけを保存する
    db.shifts[k] = {
        ...currentShift,
        status: $("shiftStatus").value,
        startTime,
        comment: $("shiftComment").value.trim(),
        manually_modified: true
    };

    save();
    close("shiftModal");
    render();
}


// 指定したモーダル画面を閉じる
function close(id) {
    $(id).classList.remove("show");
}

// 自動生成結果などのメッセージを表示する
function message(s, type = "success") {
    $("generationMessage").innerHTML =
        `<div class="notice ${type}">${esc(s)}</div>`;
}


// ========================================
// シフトの自動生成
// ========================================

// 指定期間のシフトを自動作成する
function generate() {
    const start = $("generationStart").value;
    const end = $("generationEnd").value;

    // 生成期間の入力チェック
    if (!start || !end) {
        return message("生成期間を指定してください", "error");
    }

    if (start > end) {
        return message("開始日は終了日以前にしてください", "error");
    }

    if (!db.employees.length) {
        return message("先にスタッフを登録してください", "error");
    }

    const a = parseDate(start);
    const b = parseDate(end);
    const n = Math.round((b - a) / 86400000) + 1;

    // 一度に作成する期間を93日までに制限する
    if (n > 93) {
        return message("一度に生成できる期間は93日までです", "error");
    }

    const s = db.settings;

    // 各スタッフの勤務回数と連勤数を数える
    const totals = Object.fromEntries(db.employees.map(e => [e.id, 0]));
    const streak = Object.fromEntries(db.employees.map(e => [e.id, 0]));

    // 今回作成するシフトと警告メッセージ
    const created = {};
    const warnings = [];

    // 指定期間を1日ずつ処理する
    for (let i = 0; i < n; i++) {
        const dt = new Date(a);
        dt.setDate(dt.getDate() + i);

        const day = keyDate(dt);
        const wd = dt.getDay();

        // 定休日・指定休業日は全員休みにする
        if (s.closedWeekdays.includes(wd) || db.holidays.includes(day)) {
            db.employees.forEach(e => {
                created[cellKey(day, e.id)] = {
                    work_date: day,
                    employee_id: e.id,
                    status: "off",
                    comment: "定休日"
                };

                // 休みの日は連勤数をリセットする
                streak[e.id] = 0;
            });

            continue;
        }

        // 出勤候補者を抽出する
        const candidates = db.employees
            // 出勤できない曜日のスタッフを除外する
            .filter(e => !(e.unavailableWeekdays || []).includes(wd))
            // 各スタッフの勤務希望を取得する
            .map(e => ({ e, r: req(day, e.id) }))
            // 休み希望のスタッフを除外する
            .filter(x =>
                x.r?.request_type !== "off" &&
                // 連勤上限に達しているスタッフを除外する
                !(s.consecutiveEnabled &&
                  streak[x.e.id] >= x.e.maxConsecutive &&
                  x.r?.request_type !== "work")
            );

        // 出勤希望を優先し、勤務回数が少ない人を優先する
        candidates.sort((x, y) =>
            (Number(y.r?.request_type === "work") -
             Number(x.r?.request_type === "work")) * 100 +
            (totals[x.e.id] - totals[y.e.id]) * 5 +
            (y.e.level - x.e.level) * 0.1
        );

        // 出勤希望のスタッフを先に選ぶ
        // 出勤希望が必要人数を超える場合は、希望者全員を選ぶ
        const chosen = new Set(
            candidates
                .filter(x => x.r?.request_type === "work")
                .map(x => x.e.id)
        );

        // 出勤希望者だけで必要人数に達していない場合、
        // 勤務回数が少ない人などを順番に追加する
        for (const x of candidates) {
            if (chosen.size >= s.basicRequired) {
                break;
            }

            chosen.add(x.e.id);
        }


        // 基準レベル以上のスタッフが不足していないか確認する
        let qualified = candidates.filter(
            x => x.e.level >= s.levelTarget && !chosen.has(x.e.id)
        );

        // 必要なレベル人数を満たすまで候補者を入れ替える
        while (
            [...chosen].filter(id =>
                db.employees.find(e => e.id === id)?.level >= s.levelTarget
            ).length < s.levelRequired &&
            qualified.length
        ) {

            // 出勤希望を出していない低レベルスタッフを探す
            // 出勤希望者はレベル条件の入れ替えで外さない
            const low = [...chosen]
                .map(id => db.employees.find(e => e.id === id))
                .find(e =>
                    e &&
                    e.level < s.levelTarget &&
                    req(day, e.id)?.request_type !== "work"
                );

            if (low) {
                // 低レベルスタッフを外す
                chosen.delete(low.id);
            } else if (chosen.size >= s.basicRequired && s.basicRequired > 0) {
                // 入れ替えできない場合は処理を終了する
                break;
            }

            // 基準レベル以上の候補者を追加する
            chosen.add(qualified.shift().e.id);
        }

        // 当日の勤務人数と基準レベル以上の人数を数える
        let wc = 0;
        let lc = 0;

        // 全スタッフの当日のシフトを決定する
        db.employees.forEach(e => {
            const r = req(day, e.id);

            // 選択されたスタッフが候補者に含まれているか確認する
            const work =
                chosen.has(e.id) &&
                candidates.some(x => x.e.id === e.id);

            // 出勤または休みのシフトを作成する
            const requestTime = r?.startTime || e.startTime || "17:00";

            created[cellKey(day, e.id)] = {
            work_date: day,
            employee_id: e.id,
            status: work ? "work" : "off",
            comment: r?.comment || "",
            startTime: work ? requestTime : ""
            };

            if (work) {
                // 出勤したスタッフの勤務回数・連勤数を増やす
                totals[e.id]++;
                streak[e.id]++;
                wc++;

                // 基準レベル以上なら人数を数える
                if (e.level >= s.levelTarget) lc++;
            } else {
                // 休みなら連勤数をリセットする
                streak[e.id] = 0;
            }

            // 出勤希望が反映されなかった場合は警告する
            if (r?.request_type === "work" && !work) {
                warnings.push(`${day}: ${e.name}さんの出勤希望を反映できませんでした`);
            }
        });

        // 必要な出勤人数を満たしているか確認する
        if (wc < s.basicRequired) {
            warnings.push(
                `${day}: 必要人数不足（必要${s.basicRequired}人／配置${wc}人）`
            );
        }

        // 必要なレベル人数を満たしているか確認する
        if (lc < s.levelRequired) {
            warnings.push(
                `${day}: Lv${s.levelTarget}以上が不足（必要${s.levelRequired}人／配置${lc}人）`
            );
        }

        // 17:00に出勤するスタッフが1人以上いるか確認する
        const staffAt1700 = db.employees.filter(e => {
            const shift = created[cellKey(day, e.id)];

            return (
                shift?.status === "work" &&
                (e.startTime || "17:00") === "17:00"
            );
        }).length;

        // 17:00の出勤人数が不足していたら警告する
        if (staffAt1700 < 1) {
            warnings.push(
                `${day}: 始業時間に出勤するスタッフがいません`
            );
        }

        // 設定した始業時間に必要な人数がいるか確認する
        const requiredTime = s.requiredStartTime || "17:00";
        const requiredCount = Math.max(
            0,
            Number(s.requiredStartCount) || 0
        );

                // 設定した始業時間までに出勤するスタッフを数える
        const actualCount = db.employees.filter(e => {
            const shift = created[cellKey(day, e.id)];

            // 休みのスタッフは数えない
            if (shift?.status !== "work") {
                return false;
            }

            // スタッフの実際の始業時間を取得する
            const startTime = shift.startTime || e.startTime || "17:00";

            // 設定時間より早い、または同じ時間なら人数に含める
            return startTime <= requiredTime;
        }).length;

        // 設定時間までに必要人数が揃わなければ警告する
        if (actualCount < requiredCount) {
            warnings.push(
                `${day}: ${requiredTime}までの出勤人数不足（必要${requiredCount}人／配置${actualCount}人）`
            );
        }

    }

    // 生成期間内の既存シフトを削除する
    Object.keys(db.shifts).forEach(k => {
        const d = k.split("|")[0];

        if (d >= start && d <= end) {
            delete db.shifts[k];
        }
    });

    // 今回作成したシフトを保存データに反映する
    Object.assign(db.shifts, created);

    // 自動生成の結果を履歴として保存する
    const hist = {
        start,
        end,
        generatedAt: new Date().toLocaleString("ja-JP"),
        staffCount: db.employees.length,
        days: n,
        shortage: warnings.filter(w => w.includes("必要人数不足")).length,
        levelShortage: warnings.filter(
            w => w.includes("Lv") && w.includes("不足")
        ).length,
        warnings: warnings.slice(0, 15)
    };

    // 最新の履歴を先頭に追加し、最大30件まで残す
    db.history.unshift(hist);
    db.history = db.history.slice(0, 30);

    // データを保存し、画面を更新する
    save();
    render();

    // 生成結果と不足人数を表示する
    message(
        `自動生成しました。${n}日分／必要人数不足：${hist.shortage}日／レベル不足：${hist.levelShortage}日`,
        warnings.length ? "" : "success"
    );

    // 警告があれば、最大8件を画面に表示する
    if (warnings.length) {
        $("generationMessage").innerHTML +=
            `<div class="notice">${
                warnings.slice(0, 8).map(esc).join("<br>")
            }${
                warnings.length > 8 ? `<br>ほか${warnings.length - 8}件` : ""
            }</div>`;
    }
}


// ========================================
// 自動生成の履歴
// ========================================

// 自動生成の履歴を画面に表示する
function drawHistory() {
    // 履歴がない場合の表示
    if (!db.history.length) {
        $("historyList").innerHTML =
            '<div class="empty-state">自動生成を実行すると、ここに履歴が表示されます。</div>';
        return;
    }

    // 履歴の日付・人数・不足状況を表示する
    $("historyList").innerHTML = db.history.map(h =>
        `<div class="history-item">
            <div class="history-date">${esc(h.start)} 〜 ${esc(h.end)}</div>
            <div class="history-summary">
                生成日時：${esc(h.generatedAt)} ・
                スタッフ：${h.staffCount}人 ・
                必要人数不足：${h.shortage}日 ・
                レベル不足：${h.levelShortage}日
            </div>
            ${
                h.warnings?.length
                    ? `<details>
                        <summary class="muted">警告を見る</summary>
                        <p class="history-summary">${h.warnings.map(esc).join("<br>")}</p>
                    </details>`
                    : ""
            }
        </div>`
    ).join("");
}

// 確認後に自動生成の履歴を削除する
function clearHistory() {
    if (db.history.length && confirm("生成履歴を削除しますか？")) {
        db.history = [];
        save();
        drawHistory();
    }
}


// ========================================
//  データのバックアップ
// ========================================

// 保存データをJSONファイルとしてダウンロードする
function exportData() {
    // データをJSON形式のファイルに変換する
    const blob = new Blob(
        [JSON.stringify(db, null, 2)],
        { type: "application/json;charset=utf-8" }
    );

    // ダウンロード用の一時URLを作成する
    const url = URL.createObjectURL(blob);

    // ダウンロードするファイル名を設定する
    const a = document.createElement("a");
    a.href = url;
    a.download = `shift-backup-${keyDate(new Date())}.json`;

    // ダウンロードを実行する
    a.click();

    // 使用した一時URLを解放する
    URL.revokeObjectURL(url);
}

// JSONファイルを読み込んでデータを復元する
async function importData(event) {
    const input = event.target;
    const file = input.files[0];

    // ファイルが選択されていなければ終了する
    if (!file) return;

    try {
        // ファイルの内容を文字列として読み込む
        const text = await file.text();

        // JSON形式に変換する
        const data = JSON.parse(text);

        // バックアップの基本的な形式を確認する
        const isObject = value =>
            value !== null &&
            typeof value === "object" &&
            !Array.isArray(value);

        const isValid =
            isObject(data) &&
            Array.isArray(data.employees) &&
            isObject(data.requests) &&
            isObject(data.shifts) &&
            Array.isArray(data.holidays) &&
            Array.isArray(data.history) &&
            isObject(data.settings) &&
            typeof data.settings.basicRequired === "number" &&
            typeof data.settings.levelTarget === "number" &&
            typeof data.settings.levelRequired === "number" &&
            typeof data.settings.consecutiveEnabled === "boolean" &&
            Array.isArray(data.settings.closedWeekdays) &&
            typeof data.nextId === "number";

        // 形式が違うファイルは読み込まない
        if (!isValid) {
            alert("このファイルはシフト管理アプリのバックアップではないか、データ形式が正しくありません。");
            return;
        }

        // 現在のデータを上書きする前に確認する
        const confirmed = confirm(
            "バックアップを読み込むと、現在のデータが置き換わります。\n" +
            "大切なデータは先に「データを書き出す」で保存してください。\n\n" +
            "復元を実行しますか？"
        );

        // キャンセルされた場合は何も変更しない
        if (!confirmed) return;

        // 足りない設定項目には初期値を補う
        const restoredData = {
            ...empty(),
            ...data,
            settings: {
                ...empty().settings,
                ...data.settings
            }
        };

        // 保存に成功した場合だけ、画面のデータを置き換える
        try {
            localStorage.setItem(KEY, JSON.stringify(restoredData));
        } catch (error) {
            alert("データを保存できませんでした。現在のデータは変更していません。");
            return;
        }

        // 復元したデータをアプリに反映する
        db = restoredData;

        // 設定と画面を更新する
        applySettings();
        render();

        alert("バックアップを復元しました！");
    } catch (error) {
        // JSONの読み込みや解析に失敗した場合
        alert("ファイルを読み込めませんでした。正しいJSONファイルか確認してください。");
    } finally {
        // 同じファイルをもう一度選択できるようにする
        input.value = "";
    }
}


