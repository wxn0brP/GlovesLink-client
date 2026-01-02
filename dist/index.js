import VEE from "@wxn0brp/event-emitter";
export class GlovesLinkClient {
    ws;
    ackIdCounter;
    ackCallbacks;
    handlers = new VEE();
    opts;
    url;
    connected = false;
    _manuallyDisconnected = false;
    constructor(url, opts = {}) {
        this.ackIdCounter = 1;
        this.ackCallbacks = new Map();
        this.opts = {
            logs: false,
            reConnect: true,
            reConnectInterval: 1000,
            token: null,
            autoConnect: true,
            ...opts
        };
        this.url = new URL(url, window ? window.location.href.replace("http", "ws") : "ws://localhost");
        if (this.opts.token)
            this.url.searchParams.set("token", this.opts.token);
        if (this.opts.autoConnect)
            this.connect();
    }
    connect() {
        this._manuallyDisconnected = false;
        const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
        this.url.searchParams.set("id", id);
        this.ws = new WebSocket(this.url.href);
        this.ws.onopen = () => {
            this.connected = true;
            if (this.opts.logs)
                console.log("[ws] Connected");
            // @ts-ignore
            this.handlers.emit("connect", this.ws);
        };
        this.ws.onerror = (...err) => {
            if (this.opts.logs)
                console.warn("[ws] Error:", err);
            // @ts-ignore
            this.handlers.emit("error", ...err);
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
            // @ts-ignore
            this.handlers.emit(evt, ...data);
        };
        this.ws.onclose = async (event) => {
            this.connected = false;
            if (this.opts.logs)
                console.log("[ws] Disconnected", event);
            // @ts-ignore
            this.handlers.emit("disconnect", this.ws, event);
            if (this._manuallyDisconnected) {
                this._manuallyDisconnected = false;
                return;
            }
            if (event.code === 1006) {
                if (this.opts.logs)
                    console.log("[ws] Connection closed by server");
                const params = new URLSearchParams();
                params.set("id", id);
                params.set("path", this.url.pathname);
                const data = await fetch("/gloves-link/status?" + params.toString()).then(res => res.json());
                if (data.err) {
                    if (this.opts.logs)
                        console.log("[ws] Status error", data.msg);
                    return;
                }
                const status = data.status;
                if (this.opts.logs)
                    console.log("[ws] Status", status);
                // @ts-ignore
                if (status === 401)
                    this.handlers.emit("unauthorized", this.ws);
                // @ts-ignore
                else if (status === 403)
                    this.handlers.emit("forbidden", this.ws);
                // @ts-ignore
                else if (status === 500)
                    this.handlers.emit("serverError", this.ws);
                return;
            }
            if (!this.opts.reConnect)
                return;
            setTimeout(() => {
                this.connect();
            }, this.opts.reConnectInterval);
        };
    }
    on(event, listener) {
        this.handlers.on(event, listener);
    }
    once(event, listener) {
        this.handlers.once(event, listener);
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
    disconnect() {
        this._manuallyDisconnected = true;
        this.ws.close();
    }
    close() {
        this.ws.close();
    }
}
export { GlovesLinkClient as default, GlovesLinkClient as GLC, GlovesLinkClient as client, };
