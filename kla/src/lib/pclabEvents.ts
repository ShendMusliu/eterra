export const PCLAB_QUEUE_EVENT = "kla:pclab-reservation:queue-refresh";

export type PCLabQueueRefreshDetail = {
  reservationId?: string;
  status?: string | null;
};

export function emitPCLabQueueRefresh(detail?: PCLabQueueRefreshDetail) {
  if (typeof window === "undefined") return;
  const payload = detail ?? {};

  if (typeof BroadcastChannel !== "undefined") {
    const channel = new BroadcastChannel(PCLAB_QUEUE_EVENT);
    channel.postMessage(payload);
    channel.close();
  }

  const event = new CustomEvent<PCLabQueueRefreshDetail>(PCLAB_QUEUE_EVENT, { detail: payload });
  window.dispatchEvent(event as Event);
}

export function subscribeToPCLabQueueRefresh(callback: (detail?: PCLabQueueRefreshDetail) => void) {
  if (typeof window === "undefined") return () => {};

  const handleCustomEvent = (event: Event) => {
    const custom = event as CustomEvent<PCLabQueueRefreshDetail>;
    callback(custom.detail);
  };

  let broadcastChannel: BroadcastChannel | undefined;
  let broadcastHandler: ((event: MessageEvent<PCLabQueueRefreshDetail>) => void) | undefined;

  const hasBroadcastChannel = typeof BroadcastChannel !== "undefined";

  if (!hasBroadcastChannel) {
    window.addEventListener(PCLAB_QUEUE_EVENT as any, handleCustomEvent as EventListener);
  }

  if (hasBroadcastChannel) {
    broadcastChannel = new BroadcastChannel(PCLAB_QUEUE_EVENT);
    broadcastHandler = (event: MessageEvent<PCLabQueueRefreshDetail>) => {
      callback(event.data);
    };
    broadcastChannel.addEventListener("message", broadcastHandler);
  }

  return () => {
    if (!hasBroadcastChannel) {
      window.removeEventListener(PCLAB_QUEUE_EVENT as any, handleCustomEvent as EventListener);
    }
    if (broadcastChannel && broadcastHandler) {
      broadcastChannel.removeEventListener("message", broadcastHandler);
      broadcastChannel.close();
    }
  };
}
