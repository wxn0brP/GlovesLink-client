import VEE, { EventArgs, EventMap, EventName } from "@wxn0brp/event-emitter";

export interface GLC_Opts {
    reConnect: boolean,
    reConnectInterval: number,
    logs: boolean;
    token: string;
    autoConnect: boolean;
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
    disconnect: (ws: WebSocket, event: CloseEvent) => void;
    unauthorized: (ws: WebSocket) => void;
    forbidden: (ws: WebSocket) => void;
    serverError: (ws: WebSocket) => void;
}

export class GlovesLinkClient<InputEvents extends EventMap = {}, OutputEvents extends EventMap = {}> {
    public ws: WebSocket;
    public ackIdCounter: number;
    public ackCallbacks: Map<number, Function>;
    public handlers = new VEE<InputEvents>();
    public opts: GLC_Opts;
    public url: URL;
    public connected: boolean = false;
    private _manuallyDisconnected: boolean = false;
    private messageQueue: string[] = [];

    constructor(url: string, opts: Partial<GLC_Opts> = {}) {
        this.ackIdCounter = 1;
        this.ackCallbacks = new Map();
        this.opts = {
            logs: false,
            reConnect: true,
            reConnectInterval: 1000,
            token: null,
            autoConnect: true,
            ...opts
        }

        this.url = new URL(url, window ? window.location.href.replace("http", "ws") : "ws://localhost");
        if (this.opts.token) this.url.searchParams.set("token", this.opts.token);

        if (this.opts.autoConnect) this.connect();
    }

    connect() {
        this._manuallyDisconnected = false;
        const id = Date.now().toString(36) + Math.random().toString(36).substring(2, 10);
        this.url.searchParams.set("id", id);
        this.ws = new WebSocket(this.url.href);

        this.ws.onopen = () => {
            this.connected = true;
            if (this.opts.logs) console.log("[ws] Connected");

            let msg: string;
            while (msg = this.messageQueue.shift()) {
                this.ws.send(msg);
            }

            // @ts-ignore
            this.handlers.emit("connect", this.ws);
        }

        this.ws.onerror = (...err: any) => {
            if (this.opts.logs) console.warn("[ws] Error:", err);
            // @ts-ignore
            this.handlers.emit("error", ...err);
        }

        this.ws.onmessage = (_data) => {
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
                const ackCallback = this.ackCallbacks.get(ackId);
                if (ackCallback) {
                    this.ackCallbacks.delete(ackId);
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
                        this.ws.send(JSON.stringify({
                            ack: ackId,
                            data: res
                        }));
                    };
                }
            }

            // @ts-ignore
            this.handlers.emit(evt, ...data);
        }

        this.ws.onclose = async (event: CloseEvent) => {
            this.connected = false;
            if (this.opts.logs) console.log("[ws] Disconnected", event);
            // @ts-ignore
            this.handlers.emit("disconnect", this.ws, event);

            if (this._manuallyDisconnected) {
                this._manuallyDisconnected = false;
                return;
            }

            if (event.code === 1006) {
                if (this.opts.logs) console.log("[ws] Connection closed by server");

                const params = new URLSearchParams();
                params.set("id", id);
                params.set("path", this.url.pathname);

                const data = await fetch("/gloves-link/status?" + params.toString()).then(res => res.json());
                if (data.err) {
                    if (this.opts.logs) console.log("[ws] Status error", data.msg);
                    return;
                }

                const status = data.status as { status: number, msg?: string };
                if (this.opts.logs) console.log("[ws] Status", status);
                // @ts-ignore
                if (status.status === 401) this.handlers.emit("unauthorized", this.ws);
                // @ts-ignore
                else if (status.status === 403) this.handlers.emit("forbidden", this.ws);
                // @ts-ignore
                else if (status.status === 500) this.handlers.emit("serverError", this.ws);

                return;
            }
            if (!this.opts.reConnect) return;

            setTimeout(() => {
                this.connect();
            }, this.opts.reConnectInterval);
        }
    }

    on<K extends EventName<InputEvents & InternalEvents>>(event: K, listener: (InputEvents & InternalEvents)[K]) {
        this.handlers.on(event, listener as any);
    }

    once<K extends EventName<InputEvents & InternalEvents>>(event: K, listener: (InputEvents & InternalEvents)[K]) {
        this.handlers.once(event, listener as any);
    }

    emit<K extends EventName<OutputEvents>>(evt: K, ...args: EventArgs<OutputEvents, K>) {
        const ackI = args.map((data, i) => {
            if (typeof data === "function") return i;
        }).filter(i => i !== undefined);

        for (let i = 0; i < ackI.length; i++) {
            const ackIndex = ackI[i];
            const ackId = this.ackIdCounter++;
            this.ackCallbacks.set(ackId, args[ackIndex]);
            args[ackIndex] = ackId;
        }

        const payload = JSON.stringify({
            evt,
            data: args || undefined,
            ackI: ackI.length ? ackI : undefined
        });

        if (this.connected && this.ws?.readyState === WebSocket.OPEN)
            this.ws.send(payload);
        else
            this.messageQueue.push(payload);
    }

    send<K extends EventName<OutputEvents>>(evt: K, ...args: EventArgs<OutputEvents, K>) {
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

export {
    GlovesLinkClient as default,
    GlovesLinkClient as GLC,
    GlovesLinkClient as client,
}