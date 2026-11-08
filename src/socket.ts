import VEE, { EventArgs, EventMap, EventName } from "@wxn0brp/event-emitter";
import { openSSE, postSSE } from "./transport-sse";
import { openWebSocket } from "./transport-ws";
import type { GLC_Opts, InternalEvents } from "./types";

export class GlovesLinkClient<
	InputEvents extends EventMap = {},
	OutputEvents extends EventMap = {},
> {
	_ws: WebSocket;
	_sse: EventSource;
	_sseId: string;
	_ackIdCounter: number;
	_ackCallbacks: Map<number, Function>;
	_handlers = new VEE<InputEvents>();
	_manuallyDisconnected: boolean = false;
	_messageQueue: string[] = [];
	_reconnectAttempts: number = 0;
	_useSSEMode: boolean = false;

	opts: GLC_Opts;
	url: URL;
	connected: boolean = false;

	volatile: {
		emit: <K extends EventName<OutputEvents>>(
			evt: K,
			...args: EventArgs<OutputEvents, K>
		) => void;
		send: <K extends EventName<OutputEvents>>(
			evt: K,
			...args: EventArgs<OutputEvents, K>
		) => void;
	};

	constructor(url: string, opts: Partial<GLC_Opts> = {}) {
		this._ackIdCounter = 1;
		this._ackCallbacks = new Map();
		this.opts = {
			logs: false,
			token: null,
			autoConnect: true,
			statusPath: "/gloves-link/status",
			reConnect: true,
			reConnectInterval: 1000,
			maxReConnectAttempts: 5,
			reConnectBackoffFactor: 2,
			maxBufferedAmount: 1_048_576,
			maxReConnectDelay: 15_000,
			useSSE: false,
			ssePath: "/gloves-link/sse",
			...opts,
		};

		this.url = new URL(
			url,
			typeof window !== "undefined"
				? window.location.href.replace("http", "ws")
				: "ws://localhost",
		);
		if (this.opts.token) this.url.searchParams.set("token", this.opts.token);

		const guardedEmit = <K extends EventName<OutputEvents>>(
			evt: K,
			...args: EventArgs<OutputEvents, K>
		) => {
			if (this._ws && this._ws.bufferedAmount > this.opts.maxBufferedAmount)
				return;
			this.emit(evt, ...args);
		};

		this.volatile = {
			emit: guardedEmit,
			send: guardedEmit,
		};

		if (this.opts.autoConnect) this.connect();
	}

	connect() {
		if (this.opts.useSSE) {
			this.connectSSE();
			return;
		}

		openWebSocket(this);
	}

	connectSSE() {
		openSSE(this);
	}

	_sendViaHTTP(payload: string) {
		return postSSE(this, payload);
	}

	on<K extends EventName<InputEvents & InternalEvents>>(
		event: K,
		listener: (InputEvents & InternalEvents)[K],
	) {
		this._handlers.on(event, listener as any);
	}

	once<K extends EventName<InputEvents & InternalEvents>>(
		event: K,
		listener: (InputEvents & InternalEvents)[K],
	) {
		this._handlers.once(event, listener as any);
	}

	emit<K extends EventName<OutputEvents>>(
		evt: K,
		...args: EventArgs<OutputEvents, K>
	) {
		const ackI = args
			.map((data, i) => {
				if (typeof data === "function") return i;
				return undefined;
			})
			.filter(i => i !== undefined);

		for (let i = 0; i < ackI.length; i++) {
			const ackIndex = ackI[i];
			const ackId = this._ackIdCounter++;
			this._ackCallbacks.set(ackId, args[ackIndex]);
			args[ackIndex] = ackId;
		}

		const payload = JSON.stringify({
			evt,
			data: args || undefined,
			ackI: ackI.length ? ackI : undefined,
		});

		if (this._useSSEMode) {
			if (this.connected) this._sendViaHTTP(payload);
			else this._messageQueue.push(payload);
		} else {
			if (this.connected && this._ws?.readyState === WebSocket.OPEN)
				this._ws.send(payload);
			else this._messageQueue.push(payload);
		}
	}

	send<K extends EventName<OutputEvents>>(
		evt: K,
		...args: EventArgs<OutputEvents, K>
	) {
		return this.emit(evt, ...args);
	}

	disconnect() {
		this._manuallyDisconnected = true;
		if (this._useSSEMode && this._sse) {
			this._sse.close();
		} else if (this._ws) {
			this._ws.close();
		}
	}

	close() {
		if (this._useSSEMode && this._sse) {
			this._sse.close();
		} else if (this._ws) {
			this._ws.close();
		}
	}

	_handlersEmit(evtName: string, ...args: any[]) {
		// @ts-ignore
		this._handlers.emit(evtName, ...args);
	}

	baseOn() {
		const self = this as any;
		self.on("connect", () => console.log("[ws] connected"));
		self.on("disconnect", () => console.log("[ws] disconnected"));
		self.on("error", (...args) => console.error("[ws] error", ...args));
		self.on("connect_forbidden", msg => console.error("[ws] forbidden", msg));
		self.on("connect_unauthorized", msg =>
			console.error("[ws] unauthorized", msg),
		);
		self.on("connect_serverError", msg =>
			console.error("[ws] server error", msg),
		);
		self.on("error.valid", (...args) =>
			console.error("[ws] error valid", ...args),
		);
		self.on("error.spam", (...args) =>
			console.error("[ws] error spam", ...args),
		);
	}
}
