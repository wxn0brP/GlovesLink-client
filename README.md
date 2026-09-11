# GlovesLink

GlovesLink is a WebSocket communication library designed for seamless interaction between clients and servers.

[Main repo](https://github.com/wxn0brP/GlovesLink) |
[Client repo](https://github.com/wxn0brP/GlovesLink-client) |
[Server repo](https://github.com/wxn0brP/GlovesLink-server)

## Features

### General
- **WebSocket Communication**: Establish real-time communication between clients and servers.
- **Automatic Reconnection**: Automatically reconnects after disconnection.
- **Authentication Support**: Token-based authentication for secure connections.
- **Logging**: Optional logging for debugging and monitoring.
- **Rooms**: Organize communication within specific rooms for better organization and control.

### Communication
- **Event Emission**: Send events with arbitrary data.
- **Callbacks**: Handle server/client responses with callback functions.

## Installation

```bash
npm i @wxn0brp/gloves-link-client
```

## Usage

```typescript
import GlovesLinkClient from '@wxn0brp/gloves-link-client';
// or browser
import GlovesLinkClient from 'path/to/your/GlovesLinkClient.js';
// if you use falcon-frame
import GlovesLinkClient from '/gloves-link/client';

const client = new GlovesLinkClient('ws://example.com', {
    reConnect: true,
    reConnectInterval: 5000,
    reConnectBackoffFactor: 2,
    maxReConnectAttempts: 5,
    logs: true,
    token: 'your-auth-token'
});

client.on('connect', () => {
    console.log('Connected to server');
});

client.on('connect_unauthorized', (msg) => {
    console.log('Authentication failed:', msg);
});

client.on('reconnect_failed', () => {
    console.log('Could not reconnect to server');
});

client.on('response', (message) => {
    console.log('Response from server:', message);
});

client.emit('exampleEvent', { hello: 'world' });
```

For typed events:

```typescript
type ServerEvents = {
    message: (text: string) => void;
}

type ClientEvents = {
    sendMessage: (text: string) => void;
}

const client = new GlovesLinkClient<ServerEvents, ClientEvents>('/');
client.on('message', (text) => console.log(text));
client.emit('sendMessage', 'Hello!');
```

## License

MIT License

## Contributing

Contributions are welcome!
