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
//or browser
import GlovesLinkClient from 'path/to/your/GlovesLinkClient.js';
// if you use falcon-frame
import GlovesLinkClient from '/gloves-link/client';

const client = new GlovesLinkClient('ws://example.com', {
    reConnect: true,
    reConnectInterval: 5000,
    logs: true,
    token: 'your-auth-token'
});

client.on('connect', () => {
    console.log('Connected to server');
});

client.on('response', (message) => {
    console.log('Response from server:', message);
});

client.emit('exampleEvent', { hello: 'world' });
```

## License

MIT License

## Contributing

Contributions are welcome!