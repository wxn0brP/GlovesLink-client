let WebSocketImpl;
if (typeof window === "undefined") {
    const { WebSocket } = await import("ws");
    WebSocketImpl = WebSocket;
}
else {
    WebSocketImpl = window.WebSocket;
}
export default WebSocketImpl;
