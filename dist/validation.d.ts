export declare function isPlainObject(value: unknown): value is Record<string, any>;
export declare function isValidEventName(evt: unknown): evt is string;
export declare function normalizeAckIndexes(ackI: unknown, dataLength: number): number[];
