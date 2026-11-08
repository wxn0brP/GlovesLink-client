const EVENT_NAME_RE = /^[A-Za-z0-9_.:-]{1,64}$/;
const RESERVED_EVENTS = new Set([
    "__proto__",
    "constructor",
    "prototype",
    "hasOwnProperty",
    "isPrototypeOf",
    "propertyIsEnumerable",
    "toLocaleString",
    "toString",
    "valueOf",
    "__defineGetter__",
    "__defineSetter__",
    "__lookupGetter__",
    "__lookupSetter__",
    "connect",
    "disconnect",
]);
export function isPlainObject(value) {
    return typeof value === "object" && value !== null && !Array.isArray(value);
}
export function isValidEventName(evt) {
    return (typeof evt === "string" &&
        EVENT_NAME_RE.test(evt) &&
        !RESERVED_EVENTS.has(evt));
}
export function normalizeAckIndexes(ackI, dataLength) {
    if (!Array.isArray(ackI))
        return [];
    return ackI.filter(index => typeof index === "number" &&
        Number.isInteger(index) &&
        index >= 0 &&
        index < dataLength);
}
