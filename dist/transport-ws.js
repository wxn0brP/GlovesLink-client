import { checkStatus } from "./status.js";
import { isPlainObject, isValidEventName, normalizeAckIndexes, } from "./validation.js";
export function openWebSocket(client) {
    client._manuallyDisconnected = false;
    const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
    client.url.searchParams.set("id", id);
    if (client.opts.connectionData)
        client.url.searchParams.set("data", JSON.stringify(client.opts.connectionData));
    client._ws = new WebSocket(client.url.href);
    client._ws.onopen = () => {
        client.connected = true;
        client._reconnectAttempts = 0;
        if (client.opts.logs)
            console.log("[ws] Connected");
        let msg;
        while ((msg = client._messageQueue.shift())) {
            client._ws.send(msg);
        }
        client._handlersEmit("connect");
    };
    client._ws.onerror = (...err) => {
        if (client.opts.logs)
            console.warn("[ws] Error:", err);
        client._handlersEmit("error", ...err);
    };
    client._ws.onmessage = _data => {
        const raw = _data?.data?.toString() || _data?.toString() || "";
        try {
            const msg = JSON.parse(raw);
            if (!isPlainObject(msg)) {
                if (client.opts.logs)
                    console.warn("[ws] Invalid message:", raw);
                return;
            }
            if ("ack" in msg) {
                const ackId = msg.ack;
                if (!Number.isInteger(ackId) || !Array.isArray(msg.data))
                    return;
                const ackCallback = client._ackCallbacks.get(ackId);
                if (ackCallback) {
                    client._ackCallbacks.delete(ackId);
                    ackCallback(...msg.data);
                }
                return;
            }
            const { evt, data, ackI } = msg;
            if (!isValidEventName(evt))
                return;
            if (data !== undefined && !Array.isArray(data))
                return;
            const args = data ?? [];
            const ackIndexes = normalizeAckIndexes(ackI, args.length);
            for (let i = 0; i < ackIndexes.length; i++) {
                const ackIndex = ackIndexes[i];
                const ackId = args[ackIndex];
                if (typeof ackId !== "number")
                    continue;
                args[ackIndex] = (...res) => {
                    client._ws.send(JSON.stringify({
                        ack: ackId,
                        data: res,
                    }));
                };
            }
            client._handlersEmit(evt, ...args);
        }
        catch {
            if (client.opts.logs)
                console.warn("[ws] Invalid message:", raw);
        }
    };
    client._ws.onclose = async (event) => {
        client.connected = false;
        if (client.opts.logs)
            console.log("[ws] Disconnected", event);
        client._handlersEmit("disconnect", event);
        if (client._manuallyDisconnected || !client.opts.reConnect)
            return;
        if (event.code === 1006) {
            if (client.opts.logs)
                console.log("[ws] Connection closed by server");
            try {
                const canReconnect = await checkStatus(client, id);
                if (!canReconnect)
                    return;
            }
            catch (e) {
                if (client.opts.logs)
                    console.error("[ws] Status error", e);
            }
        }
        client._reconnectAttempts++;
        if (client._reconnectAttempts > client.opts.maxReConnectAttempts) {
            if (client.opts.logs)
                console.error(`[ws] Max reconnect attempts reached (${client.opts.maxReConnectAttempts})`);
            client._handlersEmit("reconnect_failed");
            return;
        }
        const expDelay = Math.min(client.opts.reConnectInterval *
            client.opts.reConnectBackoffFactor ** (client._reconnectAttempts - 1), client.opts.maxReConnectDelay);
        const jitter = 1 + Math.random() * 0.5;
        const delay = Math.max(expDelay * jitter, client.opts.reConnectInterval);
        if (client.opts.logs)
            console.log(`[ws] Reconnecting in ${delay.toFixed(0)}ms (attempt ${client._reconnectAttempts})`);
        setTimeout(() => {
            client.connect();
        }, delay);
    };
}
