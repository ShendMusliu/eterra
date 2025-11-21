import { afterEach, beforeAll, beforeEach, describe, expect, it, vi } from "vitest";

import {
  emitPCLabQueueRefresh,
  subscribeToPCLabQueueRefresh,
  type PCLabQueueRefreshDetail,
} from "../pclabEvents";

class MockBroadcastChannel {
  static listeners = new Map<string, Set<(event: MessageEvent<PCLabQueueRefreshDetail>) => void>>();
  name: string;

  constructor(name: string) {
    this.name = name;
  }

  postMessage(data: PCLabQueueRefreshDetail) {
    const channelListeners = MockBroadcastChannel.listeners.get(this.name);
    channelListeners?.forEach((listener) => listener({ data } as MessageEvent<PCLabQueueRefreshDetail>));
  }

  addEventListener(event: string, handler: (event: MessageEvent<PCLabQueueRefreshDetail>) => void) {
    if (event !== "message") return;
    const existing = MockBroadcastChannel.listeners.get(this.name) ?? new Set();
    existing.add(handler);
    MockBroadcastChannel.listeners.set(this.name, existing);
  }

  removeEventListener(event: string, handler: (event: MessageEvent<PCLabQueueRefreshDetail>) => void) {
    if (event !== "message") return;
    const existing = MockBroadcastChannel.listeners.get(this.name);
    existing?.delete(handler);
  }

  close() {
    // no-op for mock
  }
}

describe("pclabEvents", () => {
  beforeAll(() => {
    (globalThis as any).BroadcastChannel = MockBroadcastChannel;
  });

  beforeEach(() => {
    MockBroadcastChannel.listeners.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("notifies subscribers when emit is called", () => {
    const handler = vi.fn();
    const unsubscribe = subscribeToPCLabQueueRefresh(handler);

    emitPCLabQueueRefresh({ reservationId: "abc", status: "APPROVED" });

    expect(handler).toHaveBeenCalledTimes(1);
    expect(handler).toHaveBeenCalledWith({ reservationId: "abc", status: "APPROVED" });

    unsubscribe();
  });

  it("stops calling subscribers after unsubscribe", () => {
    const handler = vi.fn();
    const unsubscribe = subscribeToPCLabQueueRefresh(handler);
    unsubscribe();

    emitPCLabQueueRefresh({ reservationId: "late", status: "PENDING" });

    expect(handler).not.toHaveBeenCalled();
  });
});
