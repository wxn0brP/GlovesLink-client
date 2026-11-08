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
    maxBufferedAmount: number;
    /** Note: without jitter */
    maxReConnectDelay: number;
    useSSE: boolean;
    ssePath: string;
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
