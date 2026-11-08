import VEE, { EventArgs, EventMap, EventName } from "@wxn0brp/event-emitter";
import type { GLC_Opts, InternalEvents } from "./types.js";
export declare class GlovesLinkClient<InputEvents extends EventMap = {}, OutputEvents extends EventMap = {}> {
    _ws: WebSocket;
    _sse: EventSource;
    _sseId: string;
    _ackIdCounter: number;
    _ackCallbacks: Map<number, Function>;
    _handlers: VEE<InputEvents>;
    _manuallyDisconnected: boolean;
    _messageQueue: string[];
    _reconnectAttempts: number;
    _useSSEMode: boolean;
    opts: GLC_Opts;
    url: URL;
    connected: boolean;
    volatile: {
        emit: <K extends EventName<OutputEvents>>(evt: K, ...args: EventArgs<OutputEvents, K>) => void;
        send: <K extends EventName<OutputEvents>>(evt: K, ...args: EventArgs<OutputEvents, K>) => void;
    };
    constructor(url: string, opts?: Partial<GLC_Opts>);
    connect(): void;
    connectSSE(): void;
    _sendViaHTTP(payload: string): Promise<void>;
    on<K extends EventName<InputEvents & InternalEvents>>(event: K, listener: (InputEvents & InternalEvents)[K]): void;
    once<K extends EventName<InputEvents & InternalEvents>>(event: K, listener: (InputEvents & InternalEvents)[K]): void;
    emit<K extends EventName<OutputEvents>>(evt: K, ...args: EventArgs<OutputEvents, K>): void;
    send<K extends EventName<OutputEvents>>(evt: K, ...args: EventArgs<OutputEvents, K>): void;
    disconnect(): void;
    close(): void;
    _handlersEmit(evtName: string, ...args: any[]): void;
    baseOn(): void;
}
