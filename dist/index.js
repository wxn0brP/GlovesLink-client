import VEE from "@wxn0brp/event-emitter";
export class GlovesLinkClient {
    _ws;
    _ackIdCounter;
    _ackCallbacks;
    _handlers = new VEE();
    _manuallyDisconnected = false;
    _messageQueue = [];
    _reconnectAttempts = 0;
    opts;
    url;
    connected = false;
    constructor(url, opts = {}) {
        this._ackIdCounter = 1;
        this._ackCallbacks = new Map();
        this.opts = {
            logs: false,
            token: null,
            autoConnect: true,
            statusPath: "/gloves-link/status",
            reConnect: true,
            reConnectInterval: 1000,
            maxReConnectAttempts: 5,
            reConnectBackoffFactor: 2,
            maxReConnectDelay: 15_000,
            ...opts
        };
        this.url = new URL(url, typeof window !== "undefined" ? window.location.href.replace("http", "ws") : "ws://localhost");
        if (this.opts.token)
            this.url.searchParams.set("token", this.opts.token);
        if (this.opts.autoConnect)
            this.connect();
    }
    connect() {
        this._manuallyDisconnected = false;
        const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
        this.url.searchParams.set("id", id);
        if (this.opts.connectionData)
            this.url.searchParams.set("data", JSON.stringify(this.opts.connectionData));
        this._ws = new WebSocket(this.url.href);
        this._ws.onopen = () => {
            this.connected = true;
            this._reconnectAttempts = 0;
            if (this.opts.logs)
                console.log("[ws] Connected");
            let msg;
            while (msg = this._messageQueue.shift()) {
                this._ws.send(msg);
            }
            this._handlersEmit("connect");
        };
        this._ws.onerror = (...err) => {
            if (this.opts.logs)
                console.warn("[ws] Error:", err);
            this._handlersEmit("error", ...err);
        };
        this._ws.onmessage = (_data) => {
            const raw = _data?.data?.toString() || _data?.toString() || "";
            let msg;
            try {
                msg = JSON.parse(raw);
            }
            catch {
                if (this.opts.logs)
                    console.warn("[ws] Invalid JSON:", raw);
                return;
            }
            if ("ack" in msg) {
                const ackId = msg.ack;
                const ackCallback = this._ackCallbacks.get(ackId);
                if (ackCallback) {
                    this._ackCallbacks.delete(ackId);
                    ackCallback(...msg.data);
                }
                return;
            }
            const { evt, data, ackI } = msg;
            if (!evt || (data && !Array.isArray(data)))
                return;
            if (Array.isArray(ackI)) {
                for (let i = 0; i < ackI.length; i++) {
                    const ackIndex = ackI[i];
                    if (!data[ackIndex])
                        break;
                    const ackId = data[ackIndex];
                    data[ackIndex] = (...res) => {
                        this._ws.send(JSON.stringify({
                            ack: ackId,
                            data: res
                        }));
                    };
                }
            }
            this._handlersEmit(evt, ...data);
        };
        this._ws.onclose = async (event) => {
            this.connected = false;
            if (this.opts.logs)
                console.log("[ws] Disconnected", event);
            this._handlersEmit("disconnect", event);
            if (this._manuallyDisconnected || !this.opts.reConnect)
                return;
            if (event.code === 1006) {
                if (this.opts.logs)
                    console.log("[ws] Connection closed by server");
                try {
                    const canReconnect = await checkStatus(this, id);
                    if (!canReconnect)
                        return;
                }
                catch (e) {
                    if (this.opts.logs)
                        console.error("[ws] Status error", e);
                }
            }
            this._reconnectAttempts++;
            if (this._reconnectAttempts > this.opts.maxReConnectAttempts) {
                if (this.opts.logs)
                    console.error(`[ws] Max reconnect attempts reached (${this.opts.maxReConnectAttempts})`);
                this._handlersEmit("reconnect_failed");
                return;
            }
            const expDelay = Math.min(this.opts.reConnectInterval * this.opts.reConnectBackoffFactor ** (this._reconnectAttempts - 1), this.opts.maxReConnectDelay);
            const jitter = 1 + Math.random() * 0.5;
            const delay = Math.max(expDelay * jitter, this.opts.reConnectInterval);
            if (this.opts.logs)
                console.log(`[ws] Reconnecting in ${delay.toFixed(0)}ms (attempt ${this._reconnectAttempts})`);
            setTimeout(() => {
                this.connect();
            }, delay);
        };
    }
    on(event, listener) {
        this._handlers.on(event, listener);
    }
    once(event, listener) {
        this._handlers.once(event, listener);
    }
    emit(evt, ...args) {
        const ackI = args.map((data, i) => {
            if (typeof data === "function")
                return i;
        }).filter(i => i !== undefined);
        for (let i = 0; i < ackI.length; i++) {
            const ackIndex = ackI[i];
            const ackId = this._ackIdCounter++;
            this._ackCallbacks.set(ackId, args[ackIndex]);
            args[ackIndex] = ackId;
        }
        const payload = JSON.stringify({
            evt,
            data: args || undefined,
            ackI: ackI.length ? ackI : undefined
        });
        if (this.connected && this._ws?.readyState === WebSocket.OPEN)
            this._ws.send(payload);
        else
            this._messageQueue.push(payload);
    }
    send(evt, ...args) {
        return this.emit(evt, ...args);
    }
    disconnect() {
        this._manuallyDisconnected = true;
        this._ws.close();
    }
    close() {
        this._ws.close();
    }
    _handlersEmit(evtName, ...args) {
        // @ts-ignore
        this._handlers.emit(evtName, ...args);
    }
}
async function checkStatus(client, id) {
    const statusURL = new URL(client.opts.statusPath, client.url.origin);
    statusURL.searchParams.set("id", id);
    statusURL.searchParams.set("path", client.url.pathname);
    const statusUrl = statusURL.toString().replace("ws", "http");
    const res = await fetch(statusUrl);
    if (!res.ok) {
        console.error("[ws] Status error", res.status);
        return true;
    }
    const data = await res.json();
    if (data.err) {
        if (client.opts.logs)
            console.log("[ws] Status error", data.msg);
        return true;
    }
    const status = data.status;
    if (client.opts.logs)
        console.log("[ws] Status", status);
    if (status.status === 401) {
        client._handlersEmit("connect_unauthorized", status.msg);
        return false;
    }
    else if (status.status === 403) {
        client._handlersEmit("connect_forbidden", status.msg);
        return false;
    }
    else if (status.status === 500) {
        client._handlersEmit("connect_serverError", status.msg);
        return false;
    }
    return true;
}
export { GlovesLinkClient as default, GlovesLinkClient as GLC, GlovesLinkClient as client, };
