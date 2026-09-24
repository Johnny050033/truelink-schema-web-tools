/** A bidirectional message channel. Messages are structured-clone-compatible plain data. */
export interface Transport {
  send(message: unknown): void;
  subscribe(listener: (message: unknown) => void): () => void;
}

export interface MessageEventLike {
  readonly origin: string;
  readonly source: unknown;
  readonly data: unknown;
}

export interface MessageReceiverLike {
  addEventListener(type: 'message', listener: (event: MessageEventLike) => void): void;
  removeEventListener(type: 'message', listener: (event: MessageEventLike) => void): void;
}

export interface MessagePeerLike {
  postMessage(message: unknown, targetOrigin: string): void;
}

/**
 * postMessage transport between two windows (for example the Studio and a hidden host
 * iframe). Messages are sent only to `peerOrigin` and accepted only when they come from
 * that exact window and origin; everything else is ignored.
 */
export function windowTransport(options: { readonly receiver: MessageReceiverLike; readonly peer: MessagePeerLike; readonly peerOrigin: string }): Transport {
  const { receiver, peer, peerOrigin } = options;
  if (!peerOrigin || peerOrigin === '*' || peerOrigin === 'null') throw new TypeError('windowTransport needs a concrete peer origin.');
  return {
    send(message) {
      peer.postMessage(message, peerOrigin);
    },
    subscribe(listener) {
      const handler = (event: MessageEventLike) => {
        if (event.origin !== peerOrigin || event.source !== peer) return;
        listener(event.data);
      };
      receiver.addEventListener('message', handler);
      return () => receiver.removeEventListener('message', handler);
    },
  };
}

/**
 * Two connected in-process transports, delivering asynchronously like postMessage.
 * Values are cloned on the way, so neither side can share references with the other.
 */
export function createLinkedTransports(): { readonly client: Transport; readonly host: Transport } {
  const listeners = { client: new Set<(message: unknown) => void>(), host: new Set<(message: unknown) => void>() };
  const side = (self: 'client' | 'host', other: 'client' | 'host'): Transport => ({
    send(message) {
      const copy = structuredClone(message);
      queueMicrotask(() => {
        for (const listener of [...listeners[other]]) listener(copy);
      });
    },
    subscribe(listener) {
      listeners[self].add(listener);
      return () => listeners[self].delete(listener);
    },
  });
  return { client: side('client', 'host'), host: side('host', 'client') };
}
