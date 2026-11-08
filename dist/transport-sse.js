import { isPlainObject, isValidEventName } from "./validation.js";
export function openSSE(client) {
    client._manuallyDisconnected = false;
    client._useSSEMode = true;
    client._sseId = null;
    const sseUrl = new URL(client.opts.ssePath + client.url.pathname, client.url.origin.replace(/^ws/, "http"));
    if (client.opts.token)
        sseUrl.searchParams.set("token", client.opts.token);
    if (client.opts.connectionData) {
        sseUrl.searchParams.set("data", JSON.stringify(client.opts.connectionData));
    }
    client._sse = new EventSource(sseUrl.href);
    client._sse.onopen = () => {
        client.connected = true;
        client._reconnectAttempts = 0;
        client._sseId = null;
        if (client.opts.logs)
            console.log("[sse] Connected");
        client._handlersEmit("connect");
    };
    client._sse.onerror = (err) => {
        client._sseId = null;
        if (client.opts.logs)
            console.warn("[sse] Error:", err);
        client._handlersEmit("error", err);
    };
    client._sse.onmessage = (_data) => {
        try {
            const msg = JSON.parse(_data.data);
            if (!isPlainObject(msg))
                return;
            const { evt, data } = msg;
            if (evt === "__sse_id") {
                client._sseId = data?.[0];
                if (client._sseId)
                    flushQueue(client);
                return;
            }
            if (!isValidEventName(evt))
                return;
            if (data !== undefined && !Array.isArray(data))
                return;
            client._handlersEmit(evt, ...(data ?? []));
        }
        catch {
            if (client.opts.logs)
                console.warn("[sse] Invalid JSON:", _data.data);
        }
    };
}
function flushQueue(client) {
    while (client._messageQueue.length) {
        const msg = client._messageQueue.shift();
        postSSE(client, msg);
    }
}
export async function postSSE(client, payload) {
    if (!client._sseId) {
        client._messageQueue.push(payload);
        return;
    }
    const postUrl = new URL(client.opts.ssePath + client.url.pathname, client.url.origin.replace(/^ws/, "http"));
    postUrl.searchParams.set("sseId", client._sseId);
    try {
        const res = await fetch(postUrl.href, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
            },
            body: payload,
        });
        if (!res.ok && client.opts.logs) {
            console.warn("[sse] POST error:", res.status);
        }
    }
    catch (err) {
        if (client.opts.logs)
            console.warn("[sse] POST failed:", err);
    }
}
