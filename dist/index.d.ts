export interface GLC_Opts {
    reConnect: boolean;
    reConnectInterval: number;
    logs: boolean;
    token: string;
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
export declare class GlovesLinkClient {
    ws: WebSocket;
    ackIdCounter: number;
    ackCallbacks: Map<number, Function>;
    handlers: {
        [key: string]: Function;
    };
    opts: GLC_Opts;
    url: URL;
    constructor(url: string, opts?: Partial<GLC_Opts>);
    _connect(): void;
    on(evt: string, handler: (...args: any[]) => void | any): void;
    emit(evt: string, ...args: any[]): void;
    send(evt: string, ...args: any[]): void;
    close(): void;
}
export { GlovesLinkClient as default, GlovesLinkClient as GLC, GlovesLinkClient as client, };
