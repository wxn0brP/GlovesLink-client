import WebSocketImpl from "./universal.js";
export class GlovesLinkClient {
    ws;
    ackIdCounter;
    ackCallbacks;
    handlers;
    opts;
    url;
    constructor(url, opts = {}) {
        this.ackIdCounter = 1;
        this.ackCallbacks = new Map();
        this.handlers = {};
        this.opts = {
            logs: false,
            reConnect: true,
            reConnectInterval: 1000,
            token: null,
            ...opts
        };
        this.url = new URL(url, window ? window.location.href.replace("http", "ws") : "ws://localhost");
        if (this.opts.token)
            this.url.searchParams.set("token", this.opts.token);
        this._connect();
    }
    _connect() {
        const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
        this.url.searchParams.set("id", id);
        this.ws = new WebSocketImpl(this.url.href);
        this.ws.onopen = () => {
            if (this.opts.logs)
                console.log("[ws] Connected");
            this.handlers.connect?.(this.ws);
        };
        this.ws.onerror = (...err) => {
            if (this.opts.logs)
                console.warn("[ws] Error:", err);
            this.handlers.error?.(...err);
        };
        this.ws.onmessage = (_data) => {
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
                const ackCallback = this.ackCallbacks.get(ackId);
                if (ackCallback) {
                    this.ackCallbacks.delete(ackId);
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
                        this.ws.send(JSON.stringify({
                            ack: ackId,
                            data: res
                        }));
                    };
                }
            }
            const handler = this.handlers[evt];
            if (!handler)
                return;
            handler(...data);
        };
        this.ws.onclose = (event) => {
            if (this.opts.logs)
                console.log("[ws] Disconnected", event);
            this.handlers.disconnect?.(this.ws, event);
            if (event.code === 1006) {
                if (this.opts.logs)
                    console.log("[ws] Connection closed by server");
                fetch("/gloves-link/status?id=" + id).then(res => res.json()).then(data => {
                    if (data.err) {
                        if (this.opts.logs)
                            console.log("[ws] Status error", data.msg);
                        return;
                    }
                    const status = data.status;
                    if (this.opts.logs)
                        console.log("[ws] Status", status);
                    if (status === 401)
                        this.handlers.unauthorized?.(this.ws);
                    else if (status === 403)
                        this.handlers.forbidden?.(this.ws);
                    else if (status === 500)
                        this.handlers.serverError?.(this.ws);
                });
                return;
            }
            if (!this.opts.reConnect)
                return;
            setTimeout(() => {
                this._connect();
            }, this.opts.reConnectInterval);
        };
    }
    on(evt, handler) {
        this.handlers[evt] = handler;
    }
    emit(evt, ...args) {
        const ackI = args.map((data, i) => {
            if (typeof data === "function")
                return i;
        }).filter(i => i !== undefined);
        for (let i = 0; i < ackI.length; i++) {
            const ackIndex = ackI[i];
            const ackId = this.ackIdCounter++;
            this.ackCallbacks.set(ackId, args[ackIndex]);
            args[ackIndex] = ackId;
        }
        this.ws.send(JSON.stringify({
            evt,
            data: args || undefined,
            ackI: ackI.length ? ackI : undefined
        }));
    }
    send(evt, ...args) {
        return this.emit(evt, ...args);
    }
    close() {
        this.ws.close();
    }
}
export { GlovesLinkClient as default, GlovesLinkClient as GLC, GlovesLinkClient as client, };
