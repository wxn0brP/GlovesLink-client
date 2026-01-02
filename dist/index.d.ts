import VEE, { EventArgs, EventMap, EventName } from "@wxn0brp/event-emitter";
export interface GLC_Opts {
    reConnect: boolean;
    reConnectInterval: number;
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
    disconnect: (ws: WebSocket, event: CloseEvent) => void;
    connect_unauthorized: (ws: WebSocket, msg: string) => void;
    connect_forbidden: (ws: WebSocket, msg: string) => void;
    connect_serverError: (ws: WebSocket, msg: string) => void;
};
export declare class GlovesLinkClient<InputEvents extends EventMap = {}, OutputEvents extends EventMap = {}> {
    ws: WebSocket;
    ackIdCounter: number;
    ackCallbacks: Map<number, Function>;
    handlers: VEE<InputEvents>;
    opts: GLC_Opts;
    url: URL;
    connected: boolean;
    private _manuallyDisconnected;
    private messageQueue;
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
