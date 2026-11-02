
console.log("shift manager 読み込み完了");

// ========================================
// 基本設定
// ========================================

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

const DAYS = ["日", "月", "火", "水", "木", "金", "土"];
const KEY = "shiftManagerGithubPages_v1";

const $ = id => document.getElementById(id);
const pad = n => String(n).padStart(2, "0");

const keyDate = d =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

const parseDate = s => {
    const [y, m, d] = s.split("-").map(Number);
    return new Date(y, m - 1, d);
};

const cellKey = (d, id) => `${d}|${id}`;

const empty = () => ({
    employees: [],
    requests: {},
    shifts: {},
    holidays: [],
    history: [],
    settings: {
        basicRequired: 3,
        levelTarget: 3,
        levelRequired: 1,
        consecutiveEnabled: true,
        closedWeekdays: [],
        requiredStartTime: "17:00",
        requiredStartCount: 1
    },
    nextId: 1
});

// ========================================
// LocalStorage 読み込み
// ========================================

function load() {
    try {
        const raw = localStorage.getItem(KEY);

        if (!raw) return empty();

        const x = JSON.parse(raw);

        if (
            !x ||
            typeof x !== "object" ||
            Array.isArray(x) ||
            !Array.isArray(x.employees)
        ) {
            throw new Error("保存データの形式が正しくありません");
        }

        const defaults = empty();

        const employees = x.employees.map(e => ({
            startTime: "17:00",
            startTimeOverrides: {},
            maxConsecutive: 5,
            unavailableWeekdays: [],
            color: COLORS[0].name,
            ...e
        }));

        const maxId = employees.reduce(
            (max, e) => Math.max(max, Number(e.id) || 0),
            0
        );

        return {
            ...defaults,
            ...x,
            employees,
            requests: x.requests && typeof x.requests === "object"
                ? x.requests : {},
            shifts: x.shifts && typeof x.shifts === "object"
                ? x.shifts : {},
            holidays: Array.isArray(x.holidays) ? x.holidays : [],
            history: Array.isArray(x.history) ? x.history : [],
            settings: {
                ...defaults.settings,
                ...(x.settings || {})
            },
            nextId: Math.max(Number(x.nextId) || 1, maxId + 1)
        };

    } catch (e) {
        console.error("保存データ読み込みエラー:", e);

        alert(
            "保存データを正常に読み込めませんでした。\n" +
            "既存データを消さずに、バックアップからの復元を確認してください。"
        );

        return empty();
    }
}

let db = load();

// ========================================
// LocalStorage 保存
// ========================================

function save() {
    try {
        localStorage.setItem(KEY, JSON.stringify(db));
        return true;

    } catch (e) {
        console.error("保存エラー:", e);

        alert(
            "データを保存できませんでした。\n" +
            "ブラウザの保存容量を確認してください。"
        );

        return false;
    }
}

// ========================================
// 共通処理
// ========================================

function esc(v) {
    return String(v ?? "").replace(/[&<>"']/g, c => ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#39;"
    }[c]));
}

function colorVal(n) {
    return COLORS.find(c => c.name === n)?.value || COLORS[0].value;
}

function first() {
    return new Date(month.getFullYear(), month.getMonth(), 1);
}

function last() {
    return new Date(month.getFullYear(), month.getMonth() + 1, 0);
}

function req(d, id) {
    return db.requests[cellKey(d, id)];
}

function shift(d, id) {
    return db.shifts[cellKey(d, id)];
}

function getEmployeeStartTime(employee, day) {
    const weekday = parseDate(day).getDay();

    const weekdayKeys = [
        "sun", "mon", "tue", "wed", "thu", "fri", "sat"
    ];

    return employee.startTimeOverrides?.[weekdayKeys[weekday]]
        || employee.startTime
        || "17:00";
}

// ========================================
// 初期化
// ========================================

let month = new Date();
let editId = null;
let color = COLORS[0].name;
let unavailable = [];
let closed = [];
let requestTarget = null;
let shiftTarget = null;

document.addEventListener("DOMContentLoaded", init);

function init() {
    drawColors();

    drawWeekdays(
        "unavailableChoices",
        unavailable,
        v => unavailable = v
    );

    drawWeekdays(
        "closedWeekdays",
        closed,
        v => closed = v
    );

    $("generationStart").value = keyDate(first());
    $("generationEnd").value = keyDate(last());
    $("holidayDate").value = keyDate(new Date());

    $("prevMonth").onclick = () => moveMonth(-1);
    $("nextMonth").onclick = () => moveMonth(1);

    $("todayMonth").onclick = () => {
        month = new Date();
        updateGenerationDates();
        render();
    };

    $("staffForm").onsubmit = saveEmployee;
    $("staffCancelEdit").onclick = resetForm;
    $("saveSettings").onclick = saveSettings;
    $("addHoliday").onclick = addHoliday;
    $("generateBtn").onclick = generate;

    $("reqCancel").onclick = () => close("requestModal");
    $("reqSave").onclick = saveRequest;

    $("shiftCancel").onclick = () => close("shiftModal");
    $("shiftSave").onclick = saveShift;

    $("clearHistory").onclick = clearHistory;
    $("exportBtn").onclick = exportData;
    $("importBtn").onclick = () => $("importFile").click();
    $("importFile").onchange = importData;

    applySettings();
    render();
}

function updateGenerationDates() {
    $("generationStart").value = keyDate(first());
    $("generationEnd").value = keyDate(last());
}

function moveMonth(n) {
    month = new Date(
        month.getFullYear(),
        month.getMonth() + n,
        1
    );

    updateGenerationDates();
    render();
}

function render() {
    drawCalendar();
    drawEmployees();
    drawHolidays();
    drawHistory();
}

// ========================================
// カラー・曜日選択
// ========================================

function drawColors() {
    $("colorChoices").innerHTML = COLORS.map(c =>
        `<button type="button"
            class="color-choice ${color === c.name ? "selected" : ""}"
            data-c="${c.name}"
            style="background:${c.value}"
            title="${c.name}"
            aria-label="${c.name}"></button>`
    ).join("");

    $("colorChoices").querySelectorAll("button").forEach(b => {
        b.onclick = () => {
            color = b.dataset.c;
            drawColors();
        };
    });
}

function drawWeekdays(id, values, changed) {
    const root = $(id);

    root.innerHTML = DAYS.map((d, i) =>
        `<button type="button"
            class="weekday ${values.includes(i) ? "selected" : ""}"
            data-d="${i}">${d}</button>`
    ).join("");

    root.querySelectorAll("button").forEach(b => {
        b.onclick = () => {
            const n = Number(b.dataset.d);

            values = values.includes(n)
                ? values.filter(x => x !== n)
                : [...values, n].sort();

            root.querySelectorAll("button").forEach(x => {
                x.classList.toggle(
                    "selected",
                    values.includes(Number(x.dataset.d))
                );
            });

            changed(values);
        };
    });
}

// ========================================
// スタッフ登録・編集
// ========================================

function saveEmployee(e) {
    e.preventDefault();

    const data = {
        name: $("staffName").value.trim(),
        level: Number($("staffLevel").value),
        maxConsecutive: Number($("staffMax").value),
        startTime: $("staffStartTime").value || "17:00",

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

    if (!data.name) return;

    if (editId !== null) {
        const old = db.employees.find(x => x.id === editId);
        if (!old) return;

        Object.assign(old, data);

    } else {
        db.employees.push({
            id: db.nextId++,
            ...data
        });
    }

    if (!save()) return;

    resetForm();
    render();
}

function resetForm() {
    $("staffForm").reset();

    editId = null;
    color = COLORS[0].name;
    unavailable = [];

    drawColors();

    drawWeekdays(
        "unavailableChoices",
        unavailable,
        v => unavailable = v
    );

    $("staffSubmit").textContent = "＋ スタッフ追加";
    $("staffCancelEdit").classList.add("hidden");
}

function editEmployee(id) {
    const e = db.employees.find(x => x.id === id);
    if (!e) return;

    editId = id;
    color = e.color || COLORS[0].name;
    unavailable = [...(e.unavailableWeekdays || [])];

    $("staffName").value = e.name;
    $("staffLevel").value = String(e.level);
    $("staffMax").value = e.maxConsecutive || 5;
    $("staffStartTime").value = e.startTime || "17:00";

    const times = e.startTimeOverrides || {};

    $("startTimeMon").value = times.mon || "";
    $("startTimeTue").value = times.tue || "";
    $("startTimeWed").value = times.wed || "";
    $("startTimeThu").value = times.thu || "";
    $("startTimeFri").value = times.fri || "";
    $("startTimeSat").value = times.sat || "";
    $("startTimeSun").value = times.sun || "";

    drawColors();

    drawWeekdays(
        "unavailableChoices",
        unavailable,
        v => unavailable = v
    );

    $("staffSubmit").textContent = "変更を保存";
    $("staffCancelEdit").classList.remove("hidden");

    $("staffForm").scrollIntoView({
        behavior: "smooth",
        block: "center"
    });
}

function deleteEmployee(id) {
    const e = db.employees.find(x => x.id === id);

    if (!e || !confirm(
        `${e.name}さんを削除しますか？\n関連する勤務希望とシフトも削除されます。`
    )) return;

    const old = JSON.stringify(db);

    db.employees = db.employees.filter(x => x.id !== id);

    [db.requests, db.shifts].forEach(obj => {
        Object.keys(obj).forEach(k => {
            if (k.endsWith("|" + id)) delete obj[k];
        });
    });

    if (!save()) {
        db = JSON.parse(old);
        return;
    }

    if (editId === id) resetForm();

    render();
}

function drawEmployees() {
    $("staffCount").textContent = `${db.employees.length}人`;

    if (!db.employees.length) {
        $("staffList").innerHTML =
            '<div class="empty-state">スタッフを追加すると、ここに一覧が表示されます。</div>';
        return;
    }

    $("staffList").innerHTML = db.employees.map(e =>
        `<div class="staff-row">
            <div class="staff-info">
                <span class="color-dot" style="background:${colorVal(e.color)}"></span>
                <div>
                    <div class="staff-name">${esc(e.name)}</div>
                    <div class="staff-meta">
                        Lv${e.level} ・ 最大連勤${e.maxConsecutive}日
                    </div>
                </div>
            </div>
            <div class="row-actions">
                <button type="button" class="secondary" data-edit="${e.id}">編集</button>
                <button type="button" class="danger" data-del="${e.id}">削除</button>
            </div>
        </div>`
    ).join("");

    $("staffList").querySelectorAll("[data-edit]").forEach(b => {
        b.onclick = () => editEmployee(Number(b.dataset.edit));
    });

    $("staffList").querySelectorAll("[data-del]").forEach(b => {
        b.onclick = () => deleteEmployee(Number(b.dataset.del));
    });
}

// ========================================
// 生成条件
// ========================================

function applySettings() {
    const s = db.settings;

    $("basicRequired").value = s.basicRequired;
    $("levelTarget").value = s.levelTarget;
    $("levelRequired").value = s.levelRequired;
    $("consecutiveEnabled").checked = s.consecutiveEnabled;

    $("requiredStartTime").value =
        s.requiredStartTime || "17:00";

    $("requiredStartCount").value =
        s.requiredStartCount ?? 1;

    closed = [...(s.closedWeekdays || [])];

    drawWeekdays(
        "closedWeekdays",
        closed,
        v => closed = v
    );
}

function saveSettings() {
    const old = JSON.stringify(db.settings);

    db.settings = {
        basicRequired: Math.max(
            0, Math.min(100, Number($("basicRequired").value) || 0)
        ),

        levelTarget: Number($("levelTarget").value),

        levelRequired: Math.max(
            0, Math.min(100, Number($("levelRequired").value) || 0)
        ),

        consecutiveEnabled: $("consecutiveEnabled").checked,

        closedWeekdays: [...closed],

        requiredStartTime:
            $("requiredStartTime").value || "17:00",

        requiredStartCount: Math.max(
            0,
            Math.min(100, Number($("requiredStartCount").value) || 0)
        )
    };

    if (!save()) {
        db.settings = JSON.parse(old);
        applySettings();
        return;
    }

    $("settingsMessage").textContent = "保存しました";
    render();
}

// ========================================
// 指定休業日
// ========================================

function addHoliday() {
    const d = $("holidayDate").value;

    if (!d) return alert("日付を選択してください");

    if (db.holidays.includes(d)) {
        return alert("この休業日は登録済みです");
    }

    db.holidays.push(d);
    db.holidays.sort();

    if (!save()) {
        db.holidays = db.holidays.filter(x => x !== d);
        return;
    }

    drawHolidays();
}

function drawHolidays() {
    $("holidayList").innerHTML = db.holidays.length
        ? db.holidays.map(d =>
            `<span class="holiday-chip">${esc(d)}
                <button type="button"
                    data-holiday="${esc(d)}"
                    aria-label="削除">×</button>
            </span>`
        ).join("")
        : '<span class="muted">指定休業日はありません。</span>';

    $("holidayList").querySelectorAll("[data-holiday]").forEach(b => {
        b.onclick = () => {
            const d = b.dataset.holiday;

            if (!confirm(`${d}を休業日から削除しますか？`)) return;

            const old = [...db.holidays];
            db.holidays = db.holidays.filter(x => x !== d);

            if (!save()) {
                db.holidays = old;
                return;
            }

            drawHolidays();
            render();
        };
    });
}

// ========================================
// カレンダー
// ========================================

function drawCalendar() {
    const root = $("calendar");
    root.innerHTML = "";

    $("monthTitle").textContent =
        `${month.getFullYear()}年${month.getMonth() + 1}月`;

    const days = last().getDate();

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

    db.employees.forEach(e => {
        const name = document.createElement("div");

        name.className = "employee-name";

        name.innerHTML = `
            <span class="color-dot" style="background:${colorVal(e.color)}"></span>
            <span class="employee-label">${esc(e.name)}</span>
            <small>Lv${e.level}</small>
        `;

        root.appendChild(name);

        for (let d = 1; d <= 31; d++) {
            const c = document.createElement("div");
            c.className = "day-cell";

            if (d > days) {
                root.appendChild(c);
                continue;
            }

            const dt = new Date(month.getFullYear(), month.getMonth(), d);
            const day = keyDate(dt);
            const r = req(day, e.id);
            const s = shift(day, e.id);

            const isClosed =
                closed.includes(dt.getDay()) ||
                db.holidays.includes(day);

            const isNG =
                (e.unavailableWeekdays || []).includes(dt.getDay());

            if (isClosed) {
                c.classList.add("closed");

                c.innerHTML = `
                    <div class="day-number">${d}</div>
                    <div class="confirmed-mark">休</div>
                    <div class="preference-mark">定休日</div>
                `;

            } else if (s) {
                c.classList.add(
                    s.status === "work"
                        ? "confirmed-work"
                        : "confirmed-off"
                );

                c.innerHTML = `
                    <div class="day-number">${d}</div>
                    <div class="confirmed-mark">
                        ${s.status === "work" ? "出" : "休"}
                    </div>

                    ${
                        s.status === "work"
                            ? `<div class="shift-time">${esc(
                                s.startTime || getEmployeeStartTime(e, day)
                            )}</div>`
                            : ""
                    }

                    ${
                        r && r.request_type !== "none"
                            ? `<div class="preference-mark ${
                                r.request_type === "work"
                                    ? "pref-work" : "pref-off"
                            }">
                                希望:${r.request_type === "work" ? "出" : "休"}
                            </div>`
                            : ""
                    }
                `;

                c.onclick = () => openShift(day, e.id);

            } else if (isNG) {
                c.classList.add("unavailable");

                c.innerHTML = `
                    <div class="day-number">${d}</div>
                    <div class="confirmed-mark">NG</div>
                `;

            } else {
                c.innerHTML = `
                    <div class="day-number">${d}</div>
                    ${
                        r && r.request_type !== "none"
                            ? `<div class="preference-mark ${
                                r.request_type === "work"
                                    ? "pref-work" : "pref-off"
                            }">
                                ${r.request_type === "work" ? "出勤希望" : "休み希望"}
                            </div>`
                            : '<div class="muted">＋ 希望</div>'
                    }
                `;

                c.onclick = () => openRequest(day, e.id);
            }

            root.appendChild(c);
        }
    });
}

// ========================================
// 勤務希望
// ========================================

function openRequest(day = keyDate(new Date()), id = null) {
    if (!db.employees.length) {
        return alert("先にスタッフを追加してください");
    }

    requestTarget = {
        day,
        id: id ?? db.employees[0].id
    };

    $("reqDate").value = day;

    $("reqEmployee").innerHTML = db.employees.map(e =>
        `<option value="${e.id}">${esc(e.name)}</option>`
    ).join("");

    $("reqEmployee").value = requestTarget.id;

    const r = req(day, requestTarget.id);
    const e = db.employees.find(x => x.id === requestTarget.id);
    const s = shift(day, requestTarget.id);

    $("reqType").value = r?.request_type || "work";
    $("reqComment").value = r?.comment || "";

    $("reqStartTime").value =
        s?.startTime ||
        r?.startTime ||
        (e ? getEmployeeStartTime(e, day) : "17:00");

    $("requestContext").textContent = `${day} の勤務希望`;

    $("requestModal").classList.add("show");
}

function saveRequest() {
    const day = $("reqDate").value;
    const id = Number($("reqEmployee").value);
    const type = $("reqType").value;
    const comment = $("reqComment").value.trim();
    const startTime = $("reqStartTime").value || "17:00";

    if (!day || !id || !db.employees.some(e => e.id === id)) {
        return alert("日付とスタッフを選んでください");
    }

    const k = cellKey(day, id);
    const e = db.employees.find(x => x.id === id);
    const defaultTime = getEmployeeStartTime(e, day);
    const isCustomTime = startTime !== defaultTime;

    const old = db.requests[k];

    if (type === "none" && !comment && !isCustomTime) {
        delete db.requests[k];
    } else {
        db.requests[k] = {
            work_date: day,
            employee_id: id,
            request_type: type,
            comment,
            startTime,
            startTimeIsCustom: isCustomTime
        };
    }

    if (!save()) {
        if (old) db.requests[k] = old;
        else delete db.requests[k];
        return;
    }

    close("requestModal");
    render();
}

// ========================================
// 確定シフトの編集
// ========================================

function openShift(day, id) {
    shiftTarget = { day, id };

    const e = db.employees.find(x => x.id === id);
    const s = shift(day, id) || {
        status: "off",
        startTime: "",
        comment: ""
    };

    $("shiftTitle").textContent = `${day} / ${e?.name || ""}`;

    $("shiftStatus").value = s.status || "off";
    $("shiftComment").value = s.comment || "";

    $("shiftStartTime").value =
        s.startTime ||
        (e ? getEmployeeStartTime(e, day) : "17:00");

    $("shiftModal").classList.add("show");
}

function saveShift() {
    if (!shiftTarget) return;

    const k = cellKey(shiftTarget.day, shiftTarget.id);
    const old = db.shifts[k];

    const startTime = $("shiftStartTime").value || "17:00";

    db.shifts[k] = {
        ...old,
        work_date: shiftTarget.day,
        employee_id: shiftTarget.id,
        status: $("shiftStatus").value,
        startTime,
        comment: $("shiftComment").value.trim(),
        manually_modified: true
    };

    if (!save()) {
        if (old) db.shifts[k] = old;
        else delete db.shifts[k];
        return;
    }

    close("shiftModal");
    render();
}

function close(id) {
    $(id).classList.remove("show");
}

function message(s, type = "success") {
    $("generationMessage").innerHTML =
        `<div class="notice ${type}">${esc(s)}</div>`;
}

// ========================================
// 自動生成
// ========================================

function generate() {
    const start = $("generationStart").value;
    const end = $("generationEnd").value;

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

    if (n > 91) {
        return message("一度に生成できる期間は91日までです", "error");
    }

    const s = db.settings;

    const totals = Object.fromEntries(
        db.employees.map(e => [e.id, 0])
    );

    const streak = Object.fromEntries(
        db.employees.map(e => [e.id, 0])
    );

    // 期間開始前の既存シフトから連勤状態を取得
    const previousDay = keyDate(
        new Date(a.getFullYear(), a.getMonth(), a.getDate() - 1)
    );

    db.employees.forEach(e => {
        let count = 0;
        let d = parseDate(previousDay);

        for (let i = 0; i < 366; i++) {
            const key = keyDate(d);
            const oldShift = shift(key, e.id);

            if (oldShift) {
                if (oldShift.status === "work") {
                    count++;
                } else {
                    break;
                }
            } else {
                break;
            }

            d.setDate(d.getDate() - 1);
        }

        streak[e.id] = count;
    });

    const created = {};
    const warnings = [];

    for (let i = 0; i < n; i++) {
        const dt = new Date(a);
        dt.setDate(dt.getDate() + i);

        const day = keyDate(dt);
        const wd = dt.getDay();

        const isClosed =
            s.closedWeekdays.includes(wd) ||
            db.holidays.includes(day);

        if (isClosed) {
            db.employees.forEach(e => {
                const k = cellKey(day, e.id);

                // 手動修正済みのシフトは保持する
                if (db.shifts[k]?.manually_modified) {
                    created[k] = db.shifts[k];
                } else {
                    created[k] = {
                        work_date: day,
                        employee_id: e.id,
                        status: "off",
                        comment: "定休日",
                        startTime: ""
                    };
                }

                streak[e.id] = 0;
            });

            continue;
        }

        const candidates = db.employees
            .filter(e => !(e.unavailableWeekdays || []).includes(wd))
            .map(e => ({ e, r: req(day, e.id) }))
            .filter(x =>
                x.r?.request_type !== "off" &&
                !(
                    s.consecutiveEnabled &&
                    streak[x.e.id] >= x.e.maxConsecutive &&
                    x.r?.request_type !== "work"
                )
            );

        candidates.sort((x, y) =>
            (Number(y.r?.request_type === "work") -
             Number(x.r?.request_type === "work")) * 100 +
            (totals[x.e.id] - totals[y.e.id]) * 5 +
            (y.e.level - x.e.level) * 0.1
        );

        const chosen = new Set(
            candidates
                .filter(x => x.r?.request_type === "work")
                .map(x => x.e.id)
        );

        for (const x of candidates) {
            if (chosen.size >= s.basicRequired) break;
            chosen.add(x.e.id);
        }

        let qualified = candidates.filter(
            x => x.e.level >= s.levelTarget && !chosen.has(x.e.id)
        );

        while (
            [...chosen].filter(id =>
                db.employees.find(e => e.id === id)?.level >= s.levelTarget
            ).length < s.levelRequired &&
            qualified.length
        ) {
            const low = [...chosen]
                .map(id => db.employees.find(e => e.id === id))
                .find(e =>
                    e &&
                    e.level < s.levelTarget &&
                    req(day, e.id)?.request_type !== "work"
                );

            if (low) {
                chosen.delete(low.id);
            } else if (chosen.size >= s.basicRequired) {
                break;
            }

            chosen.add(qualified.shift().e.id);
        }

        let wc = 0;
        let lc = 0;

        db.employees.forEach(e => {
            const k = cellKey(day, e.id);
            const r = req(day, e.id);

            // 手動修正したシフトを優先
            if (db.shifts[k]?.manually_modified) {
                created[k] = db.shifts[k];

                if (created[k].status === "work") {
                    totals[e.id]++;
                    streak[e.id]++;
                    wc++;

                    if (e.level >= s.levelTarget) lc++;
                } else {
                    streak[e.id] = 0;
                }

                return;
            }

            const work =
                chosen.has(e.id) &&
                candidates.some(x => x.e.id === e.id);

            const employeeStartTime = getEmployeeStartTime(e, day);

            const requestTime =
                r?.startTimeIsCustom
                    ? r.startTime
                    : employeeStartTime;

            created[k] = {
                work_date: day,
                employee_id: e.id,
                status: work ? "work" : "off",
                comment: r?.comment || "",
                startTime: work ? requestTime : ""
            };

            if (work) {
                totals[e.id]++;
                streak[e.id]++;
                wc++;

                if (e.level >= s.levelTarget) lc++;

            } else {
                streak[e.id] = 0;
            }

            if (r?.request_type === "work" && !work) {
                warnings.push(
                    `${day}: ${e.name}さんの出勤希望を反映できませんでした`
                );
            }
        });

        if (wc < s.basicRequired) {
            warnings.push(
                `${day}: 必要人数不足（必要${s.basicRequired}人／配置${wc}人）`
            );
        }

        if (lc < s.levelRequired) {
            warnings.push(
                `${day}: Lv${s.levelTarget}以上が不足（必要${s.levelRequired}人／配置${lc}人）`
            );
        }

        const requiredTime = s.requiredStartTime || "17:00";
        const requiredCount = Number(s.requiredStartCount) || 0;

        const actualCount = db.employees.filter(e => {
            const sh = created[cellKey(day, e.id)];

            return sh?.status === "work" &&
                (sh.startTime || getEmployeeStartTime(e, day))
                    <= requiredTime;
        }).length;

        if (actualCount < requiredCount) {
            warnings.push(
                `${day}: ${requiredTime}までの出勤人数不足（必要${requiredCount}人／配置${actualCount}人）`
            );
        }
    }

    // 生成期間内の既存シフトを置き換える
    Object.keys(db.shifts).forEach(k => {
        const d = k.split("|")[0];

        if (d >= start && d <= end) {
            delete db.shifts[k];
        }
    });

    Object.assign(db.shifts, created);

    const hist = {
        start,
        end,
        generatedAt: new Date().toLocaleString("ja-JP"),
        staffCount: db.employees.length,
        days: n,
        shortage: warnings.filter(
            w => w.includes("必要人数不足")
        ).length,
        levelShortage: warnings.filter(
            w => w.includes("Lv") && w.includes("不足")
        ).length,
        warnings: warnings.slice(0, 15)
    };

    db.history.unshift(hist);
    db.history = db.history.slice(0, 30);

    if (!save()) return;

    render();

    message(
        `自動生成しました。${n}日分／必要人数不足：${hist.shortage}日／レベル不足：${hist.levelShortage}日`,
        warnings.length ? "" : "success"
    );

    if (warnings.length) {
        $("generationMessage").innerHTML +=
            `<div class="notice">
                ${warnings.slice(0, 8).map(esc).join("<br>")}
                ${warnings.length > 8 ? `<br>ほか${warnings.length - 8}件` : ""}
            </div>`;
    }
}

// ========================================
// 自動生成履歴
// ========================================

function drawHistory() {
    if (!db.history.length) {
        $("historyList").innerHTML =
            '<div class="empty-state">自動生成を実行すると、ここに履歴が表示されます。</div>';
        return;
    }

    $("historyList").innerHTML = db.history.map(h =>
        `<div class="history-item">
            <div class="history-date">
                ${esc(h.start)} 〜 ${esc(h.end)}
            </div>
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
                        <p class="history-summary">
                            ${h.warnings.map(esc).join("<br>")}
                        </p>
                    </details>`
                    : ""
            }
        </div>`
    ).join("");
}

function clearHistory() {
    if (!db.history.length) return;

    if (!confirm("生成履歴を削除しますか？")) return;

    const old = [...db.history];
    db.history = [];

    if (!save()) {
        db.history = old;
        return;
    }

    drawHistory();
}

// ========================================
// JSONバックアップ
// ========================================

function exportData() {
    // 最新データを保存してから書き出す
    if (!save()) return;

    const blob = new Blob(
        [JSON.stringify(db, null, 2)],
        { type: "application/json;charset=utf-8" }
    );

    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");

    a.href = url;
    a.download = `shift-backup-${keyDate(new Date())}.json`;

    document.body.appendChild(a);
    a.click();
    a.remove();

    setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function importData(event) {
    const input = event.target;
    const file = input.files[0];

    if (!file) return;

    try {
        const text = await file.text();
        const data = JSON.parse(text);

        const isObject = v =>
            v !== null &&
            typeof v === "object" &&
            !Array.isArray(v);

        const valid =
            isObject(data) &&
            Array.isArray(data.employees) &&
            data.employees.every(e =>
                isObject(e) &&
                Number.isFinite(Number(e.id)) &&
                typeof e.name === "string"
            ) &&
            (data.requests === undefined || isObject(data.requests)) &&
            (data.shifts === undefined || isObject(data.shifts)) &&
            (data.holidays === undefined || Array.isArray(data.holidays)) &&
            (data.history === undefined || Array.isArray(data.history)) &&
            (data.settings === undefined || isObject(data.settings));

        if (!valid) {
            alert("このファイルは正しいシフト管理アプリのバックアップではありません。");
            return;
        }

        if (!confirm(
            "バックアップを読み込むと、現在のデータが置き換わります。\n" +
            "現在のデータを先にバックアップすることをおすすめします。\n\n" +
            "復元しますか？"
        )) return;

        const defaults = empty();

        const restoredData = {
            ...defaults,
            ...data,

            employees: data.employees.map(e => ({
                startTime: "17:00",
                startTimeOverrides: {},
                maxConsecutive: 5,
                unavailableWeekdays: [],
                color: COLORS[0].name,
                ...e
            })),

            requests: data.requests || {},
            shifts: data.shifts || {},
            holidays: data.holidays || [],
            history: data.history || [],

            settings: {
                ...defaults.settings,
                ...(data.settings || {})
            },

            nextId: Math.max(
                Number(data.nextId) || 1,
                ...data.employees.map(e => Number(e.id) + 1 || 1)
            )
        };

        // 先に保存を試し、成功した場合だけ画面を変更
        try {
            localStorage.setItem(
                KEY,
                JSON.stringify(restoredData)
            );
        } catch (e) {
            alert("保存できませんでした。現在のデータは変更していません。");
            return;
        }

        db = restoredData;

        // 編集状態をリセット
        resetForm();

        // 表示設定を復元
        closed = [...(db.settings.closedWeekdays || [])];

        applySettings();
        render();

        alert("バックアップを復元しました！");

    } catch (e) {
        console.error("復元エラー:", e);
        alert("ファイルを読み込めませんでした。JSONファイルを確認してください。");

    } finally {
        input.value = "";
    }
}
