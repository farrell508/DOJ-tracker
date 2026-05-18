console.log("EXTENSION CONTENT SCRIPT LOADED");

let lastUrl = location.href;
let currentTrackingId = null;

// URL 변경 감지
setInterval(() => {
    if (location.href !== lastUrl) {
        lastUrl = location.href;
        console.log("페이지 이동 감지:", location.href);

        checkSubmissionPage();
    }
}, 1000);

// 제출 페이지 체크
async function checkSubmissionPage() {
    if (!location.pathname.includes("/submissions")) return;

    console.log("submissions 페이지 감지");

    const locale = location.pathname.includes("/ko/") ? "ko" : "en";

    const URL =
        `https://dojoi.xyz/api/judge-status?locale=${locale}&limit=5&page=1`;

    try {
        const res = await fetch(URL);
        const data = await res.json();

        const now = Date.now();
        let target = null;

        // 최근 60초 제출 찾기
        for (const sub of data.rows) {
            const created = new Date(sub.createdAt).getTime();
            const diff = (now - created) / 1000;

            if (diff <= 60) {
                target = sub;
                break;
            }
        }

        if (!target) {
            console.log("최근 제출 없음");
            return;
        }

        if (currentTrackingId === target.id) {
            console.log("이미 추적중");
            return;
        }

        currentTrackingId = target.id;

        console.log("최근 제출 발견:", target.problemTitle);

        const FINAL_VERDICTS = [
            "ACCEPTED",
            "WRONG_ANSWER",
            "TIME_LIMIT_EXCEEDED",
            "RUNTIME_ERROR",
            "COMPILE_ERROR",
            "PARTIAL",
            "MEMORY_LIMIT_EXCEEDED",
            "OUTPUT_LIMIT_EXCEEDED"
        ];

        while (true) {
            const res = await fetch(URL);
            const data = await res.json();

            const current =
                data.rows.find(x => x.id === currentTrackingId);

            if (!current) {
                console.log("제출 없음");
                currentTrackingId = null;
                return;
            }

            console.log("현재 상태:", current.verdict);

            if (!FINAL_VERDICTS.includes(current.verdict)) {
                await sleep(3000);
                continue;
            }

            console.log("최종 결과:", current.verdict);

            // ❗ AC만 전송
            if (current.verdict !== "ACCEPTED") {
                console.log("AC 아님 → 전송 안 함");
                currentTrackingId = null;
                return;
            }

            await sendToWebhooks({
                embeds: [
                    {
                        title: `${current.problemDisplayId}번 · ${current.problemTitle}`,
                        url: `https://dojoi.xyz/${locale}/problems/${current.problemSlug}`,
                        description: "🟢 AC",
                        color: 0x57F287,

                        author: {
                            name: cleanHandle(current.handle),
                            url: `https://dojoi.xyz/${locale}/user/${cleanHandle(current.handle)}`
                        },

                        fields: [
                            {
                                name: "언어",
                                value: current.language,
                                inline: true
                            },
                            {
                                name: "점수",
                                value: `${current.score}/${current.maxScore}`,
                                inline: true
                            },
                            {
                                name: "메모리",
                                value: `${Math.floor(current.maxMemoryBytes / 1024)} KB`,
                                inline: true
                            },
                            {
                                name: "시간",
                                value: `${current.maxExecutionTimeMs} ms`,
                                inline: true
                            },
                            {
                                name: "제출 ID",
                                value: current.id,
                                inline: false
                            }
                        ],

                        footer: {
                            text: "DOJ Tracker"
                        },

                        timestamp: new Date().toISOString()
                    }
                ]
            });

            currentTrackingId = null;
            return;
        }
    } catch (e) {
        console.error("ERROR:", e);
        currentTrackingId = null;
    }
}

// 여러 웹훅 전송
async function sendToWebhooks(payload) {
    const data = await chrome.storage.local.get("webhooks");
    const webhooks = data.webhooks || [];

    const enabled = webhooks.filter(w => w.enabled);

    console.log("활성 웹훅 수:", enabled.length);

    for (const wh of enabled) {
        try {
            await fetch(wh.url, {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify(payload)
            });

            console.log("전송 성공:", wh.name);
        } catch (e) {
            console.error("웹훅 실패:", wh.name, e);
        }
    }
}

// @ 제거 함수
function cleanHandle(handle) {
    if (!handle) return "unknown";
    return handle.replace(/^@/, "");
}

// sleep
function sleep(ms) {
    return new Promise(r => setTimeout(r, ms));
}