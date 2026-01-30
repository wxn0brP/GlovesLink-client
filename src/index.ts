import VEE, { EventArgs, EventMap, EventName } from "@wxn0brp/event-emitter";

export interface GLC_Opts {
    reConnect: boolean,
    reConnectInterval: number,
    logs: boolean;
    token: string;
    autoConnect: boolean;
    connectionData?: Record<string, any>;
}

export interface GLC_DataEvent {
    evt: string;
    data: any[];
    ackI?: number[];
}

export interface GLC_AckEvent {
    ack: number;
    data: any[];
}

export type InternalEvents = {
    connect: (ws: WebSocket) => void;
    error: (...err: any[]) => void;
    disconnect: (event: CloseEvent) => void;
    connect_unauthorized: (msg: string) => void;
    connect_forbidden: (msg: string) => void;
    connect_serverError: (msg: string) => void;
}

export class GlovesLinkClient<InputEvents extends EventMap = {}, OutputEvents extends EventMap = {}> {
    _ws: WebSocket;
    _ackIdCounter: number;
    _ackCallbacks: Map<number, Function>;
    _handlers = new VEE<InputEvents>();
    _manuallyDisconnected: boolean = false;
    _messageQueue: string[] = [];

    opts: GLC_Opts;
    url: URL;
    connected: boolean = false;

    constructor(url: string, opts: Partial<GLC_Opts> = {}) {
        this._ackIdCounter = 1;
        this._ackCallbacks = new Map();
        this.opts = {
            logs: false,
            reConnect: true,
            reConnectInterval: 1000,
            token: null,
            autoConnect: true,
            ...opts
        }

        this.url = new URL(url, typeof window !== "undefined" ? window.location.href.replace("http", "ws") : "ws://localhost");
        if (this.opts.token) this.url.searchParams.set("token", this.opts.token);

        if (this.opts.autoConnect) this.connect();
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
            if (this.opts.logs) console.log("[ws] Connected");

            let msg: string;
            while (msg = this._messageQueue.shift()) {
                this._ws.send(msg);
            }

            this._handlersEmit("connect");
        }

        this._ws.onerror = (...err: any) => {
            if (this.opts.logs) console.warn("[ws] Error:", err);
            this._handlersEmit("error", ...err);
        }

        this._ws.onmessage = (_data) => {
            const raw = _data?.data?.toString() || _data?.toString() || "";
            let msg: GLC_DataEvent | GLC_AckEvent;

            try {
                msg = JSON.parse(raw);
            } catch {
                if (this.opts.logs) console.warn("[ws] Invalid JSON:", raw);
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
            if (!evt || (data && !Array.isArray(data))) return;

            if (Array.isArray(ackI)) {
                for (let i = 0; i < ackI.length; i++) {
                    const ackIndex = ackI[i];
                    if (!data[ackIndex]) break;

                    const ackId = data[ackIndex];
                    data[ackIndex] = (...res: any) => {
                        this._ws.send(JSON.stringify({
                            ack: ackId,
                            data: res
                        }));
                    };
                }
            }

            this._handlersEmit(evt, ...data);
        }

        this._ws.onclose = async (event: CloseEvent) => {
            this.connected = false;
            if (this.opts.logs) console.log("[ws] Disconnected", event);
            this._handlersEmit("disconnect", event);

            if (this._manuallyDisconnected) return;

            if (event.code === 1006) {
                if (this.opts.logs) console.log("[ws] Connection closed by server");

                try {
                    const canReconnect = await checkStatus(this, id);
                    if (!canReconnect) return;
                } catch (e) {
                    if (this.opts.logs)
                        console.error("[ws] Status error", e);
                }
            }

            if (!this.opts.reConnect) return;

            setTimeout(() => {
                this.connect();
            }, this.opts.reConnectInterval);
        }
    }

    on<K extends EventName<InputEvents & InternalEvents>>(event: K, listener: (InputEvents & InternalEvents)[K]) {
        this._handlers.on(event, listener as any);
    }

    once<K extends EventName<InputEvents & InternalEvents>>(event: K, listener: (InputEvents & InternalEvents)[K]) {
        this._handlers.once(event, listener as any);
    }

    emit<K extends EventName<OutputEvents>>(evt: K, ...args: EventArgs<OutputEvents, K>) {
        const ackI = args.map((data, i) => {
            if (typeof data === "function") return i;
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

    send<K extends EventName<OutputEvents>>(evt: K, ...args: EventArgs<OutputEvents, K>) {
        return this.emit(evt, ...args);
    }

    disconnect() {
        this._manuallyDisconnected = true;
        this._ws.close();
    }

    close() {
        this._ws.close();
    }

    _handlersEmit(evtName: string, ...args: any[]) {
        // @ts-ignore
        this._handlers.emit(evtName, ...args);
        // @ts-ignore
        this._handlers.emit("*", evtName, ...args);
    }
}

async function checkStatus(client: GlovesLinkClient, id: string) {
    const params = new URLSearchParams();
    params.set("id", id);
    params.set("path", client.url.pathname);

    const statusUrl = client.url.origin + "/gloves-link/status?" + params.toString();
    const res = await fetch(statusUrl.replace("ws", "http"));
    if (!res.ok) {
        console.error("[ws] Status error", res.status);
        return true;
    }

    const data = await res.json();
    if (data.err) {
        if (client.opts.logs) console.log("[ws] Status error", data.msg);
        return true;
    }

    const status = data.status as { status: number, msg?: string };
    if (client.opts.logs) console.log("[ws] Status", status);

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

export {
    GlovesLinkClient as default,
    GlovesLinkClient as GLC,
    GlovesLinkClient as client,
}