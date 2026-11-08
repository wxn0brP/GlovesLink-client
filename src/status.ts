import type { GlovesLinkClient } from "./socket";

export async function checkStatus(
	client: GlovesLinkClient<any, any>,
	id: string,
) {
	const statusURL = new URL(client.opts.statusPath, client.url.origin);
	statusURL.searchParams.set("id", id);
	statusURL.searchParams.set("path", client.url.pathname);

	const statusUrl = statusURL.toString().replace("ws", "http");

	const res = await fetch(statusUrl);
	if (!res.ok) {
		console.error("[ws] Status error", res.status);
		return true;
	}

	const data = await res.json();
	if (data.err) {
		if (client.opts.logs) console.log("[ws] Status error", data.msg);
		return true;
	}

	const status = data.status as {
		status: number;
		msg?: string;
	};
	if (client.opts.logs) console.log("[ws] Status", status);

	if (status.status === 401) {
		client._handlersEmit("connect_unauthorized", status.msg);
		return false;
	} else if (status.status === 403) {
		client._handlersEmit("connect_forbidden", status.msg);
		return false;
	} else if (status.status === 500) {
		client._handlersEmit("connect_serverError", status.msg);
		return false;
	}

	return true;
}
