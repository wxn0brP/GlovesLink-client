import type { GlovesLinkClient } from "./socket.js";
export declare function openSSE(client: GlovesLinkClient<any, any>): void;
export declare function postSSE(client: GlovesLinkClient<any, any>, payload: string): Promise<void>;
