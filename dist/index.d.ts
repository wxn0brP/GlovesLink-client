import VEE, { EventArgs, EventMap, EventName } from "@wxn0brp/event-emitter";
export interface GLC_Opts {
    logs: boolean;
    token: string;
    autoConnect: boolean;
    connectionData?: Record<string, any>;
    statusPath: string;
    reConnect: boolean;
    reConnectInterval: number;
    reConnectBackoffFactor: number;
    maxReConnectAttempts: number;
    /** Note: without jitter */
    maxReConnectDelay: number;
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
    reconnect_failed: () => void;
};
export declare class GlovesLinkClient<InputEvents extends EventMap = {}, OutputEvents extends EventMap = {}> {
    _ws: WebSocket;
    _ackIdCounter: number;
    _ackCallbacks: Map<number, Function>;
    _handlers: VEE<InputEvents>;
    _manuallyDisconnected: boolean;
    _messageQueue: string[];
    _reconnectAttempts: number;
    opts: GLC_Opts;
    url: URL;
    connected: boolean;
    constructor(url: string, opts?: Partial<GLC_Opts>);
    connect(): void;
    on<K extends EventName<InputEvents & InternalEvents>>(event: K, listener: (InputEvents & InternalEvents)[K]): void;
    once<K extends EventName<InputEvents & InternalEvents>>(event: K, listener: (InputEvents & InternalEvents)[K]): void;
    emit<K extends EventName<OutputEvents>>(evt: K, ...args: EventArgs<OutputEvents, K>): void;
    send<K extends EventName<OutputEvents>>(evt: K, ...args: EventArgs<OutputEvents, K>): void;
    disconnect(): void;
    close(): void;
    _handlersEmit(evtName: string, ...args: any[]): void;
}
export { GlovesLinkClient as default, GlovesLinkClient as GLC, GlovesLinkClient as client, };
