type QueueItem = {
  resolve: () => void;
  reject: (error: Error) => void;
  signal?: AbortSignal;
  cleanup?: () => void;
};

export class Semaphore {
  private readonly max: number;
  private current = 0;
  private queue: QueueItem[] = [];
  private aborted = false;
  private abortReason = 'ABORTED';

  constructor(max: number) {
    this.max = Math.max(1, Math.trunc(max));
  }

  get capacity(): number {
    return this.max;
  }

  get activeCount(): number {
    return this.current;
  }

  get pendingCount(): number {
    return this.queue.length;
  }

  get isAborted(): boolean {
    return this.aborted;
  }

  async acquire(signal?: AbortSignal): Promise<void> {
    if (this.aborted) {
      throw new Error(this.abortReason);
    }

    if (signal?.aborted) {
      throw new DOMException('The operation was aborted.', 'AbortError');
    }

    if (this.current < this.max) {
      this.current += 1;
      return;
    }

    return new Promise<void>((resolve, reject) => {
      const item: QueueItem = {
        resolve,
        reject,
        signal,
      };

      if (signal) {
        const onAbort = () => {
          this.queue = this.queue.filter(queueItem => queueItem !== item);
          item.cleanup?.();
          reject(new DOMException('The operation was aborted.', 'AbortError'));
        };

        signal.addEventListener('abort', onAbort, { once: true });
        item.cleanup = () => {
          signal.removeEventListener('abort', onAbort);
        };
      }

      this.queue.push(item);
    });
  }

  release(): void {
    if (this.current > 0) {
      this.current -= 1;
    }

    if (this.aborted) {
      return;
    }

    while (this.queue.length > 0) {
      const next = this.queue.shift();
      if (!next) {
        break;
      }

      if (next.signal?.aborted) {
        next.cleanup?.();
        continue;
      }

      next.cleanup?.();
      this.current += 1;
      next.resolve();
      return;
    }
  }

  abort(reason = 'ABORTED'): void {
    this.aborted = true;
    this.abortReason = reason;
    const error = new Error(reason);

    while (this.queue.length > 0) {
      const item = this.queue.shift();
      if (!item) {
        continue;
      }
      item.cleanup?.();
      item.reject(error);
    }
  }

  reset(): void {
    this.aborted = false;
    this.abortReason = 'ABORTED';
    this.current = 0;

    while (this.queue.length > 0) {
      const item = this.queue.shift();
      item?.cleanup?.();
    }
  }
}
