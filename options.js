const nameInput = document.getElementById("name");
const urlInput = document.getElementById("url");
const list = document.getElementById("list");

document.getElementById("add").onclick = async () => {
    const name = nameInput.value;
    const url = urlInput.value;

    if (!name || !url) return;

    const data = await chrome.storage.local.get("webhooks");

    const webhooks = data.webhooks || [];

    webhooks.push({
        name,
        url,
        enabled: true
    });

    await chrome.storage.local.set({ webhooks });

    render();
};

async function render() {
    const data = await chrome.storage.local.get("webhooks");
    const webhooks = data.webhooks || [];

    list.innerHTML = "";

    webhooks.forEach((wh, index) => {
        const div = document.createElement("div");
        div.className = "item";

        div.innerHTML = `
            <b>${wh.name}</b><br/>
            <small>${wh.url}</small><br/>
            <label>
                <input type="checkbox" ${wh.enabled ? "checked" : ""} data-i="${index}">
                활성화
            </label>
            <button data-del="${index}">삭제</button>
        `;

        list.appendChild(div);
    });

    document.querySelectorAll("input[type=checkbox]").forEach(cb => {
        cb.onchange = async (e) => {
            const i = e.target.dataset.i;
            const data = await chrome.storage.local.get("webhooks");
            data.webhooks[i].enabled = e.target.checked;
            await chrome.storage.local.set({ webhooks: data.webhooks });
        };
    });

    document.querySelectorAll("button[data-del]").forEach(btn => {
        btn.onclick = async (e) => {
            const i = e.target.dataset.del;
            const data = await chrome.storage.local.get("webhooks");

            data.webhooks.splice(i, 1);

            await chrome.storage.local.set({ webhooks: data.webhooks });

            render();
        };
    });
}

render();