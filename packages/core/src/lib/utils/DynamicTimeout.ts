export class DynamicTimeout {
  private readonly resolvers = Promise.withResolvers<never>();
  private readonly startTime: number = Date.now();
  private rejected: boolean;
  private reservedQueue: number[];
  private totalDelay: number;
  private timeoutID: NodeJS.Timeout;

  constructor(
    private readonly rejectValue: unknown,
    private initialDelay: number,
  ) {
    if (initialDelay < 0) {
      throw new Error(MSG_ERR_DYNAMIC_TIMEOUT_INITIAL_DELAY_NEGATIVE);
    }

    this.rejected = false;
    this.reservedQueue = [];
    this.totalDelay = initialDelay;

    // Initialize timeout with arrow function to preserve 'this' context
    this.timeoutID = setTimeout(() => {
      this.handleTimeout();
    }, initialDelay);
  }

  private handleTimeout(): void {
    if (this.rejected) {
      return;
    }

    const nextDelay = this.reservedQueue.shift();

    // No more delays in queue - reject the promise
    if (nextDelay === undefined) {
      this.rejected = true;
      this.resolvers.reject(this.rejectValue);
      return;
    }

    // Process next delay in queue
    this.timeoutID = setTimeout(() => this.handleTimeout(), nextDelay);
  }

  getPromise(): Promise<never> {
    return this.resolvers.promise;
  }

  getInitialDelay(): number {
    return this.initialDelay;
  }

  getTotalDelay(): number {
    return this.totalDelay;
  }

  getStartTime(): number {
    return this.startTime;
  }

  isRejected(): boolean {
    return this.rejected;
  }

  addTimeout(delay: number): void {
    if (this.rejected) {
      throw new Error(MSG_ERR_DYNAMIC_TIMEOUT_ADD_ALREADY_REJECTED);
    }

    if (delay < 0) {
      throw new Error(MSG_ERR_DYNAMIC_TIMEOUT_DELAY_NEGATIVE);
    }

    this.reservedQueue.push(delay);
    this.totalDelay += delay;
  }

  resetTimeout(initialDelay?: number): void {
    if (this.rejected) {
      throw new Error(MSG_ERR_DYNAMIC_TIMEOUT_RESET_ALREADY_REJECTED);
    }

    const newDelay = initialDelay ?? this.initialDelay;

    if (newDelay < 0) {
      throw new Error(MSG_ERR_DYNAMIC_TIMEOUT_INITIAL_DELAY_NEGATIVE);
    }

    clearTimeout(this.timeoutID);

    // Reset state
    this.reservedQueue = [];
    this.initialDelay = newDelay;
    this.totalDelay = newDelay;

    // Start new timeout
    this.timeoutID = setTimeout(() => this.handleTimeout(), newDelay);
  }

  executeTimeout(): void {
    if (this.rejected) {
      throw new Error(MSG_ERR_DYNAMIC_TIMEOUT_EXECUTE_ALREADY_REJECTED);
    }

    clearTimeout(this.timeoutID);

    this.rejected = true;
    this.reservedQueue = [];
    this.resolvers.reject(this.rejectValue);
  }

  cancelTimeout(): void {
    this.reservedQueue = [];

    clearTimeout(this.timeoutID);
  }
}

export const MSG_ERR_DYNAMIC_TIMEOUT_INITIAL_DELAY_NEGATIVE =
  "initial delay must be non-negative";
export const MSG_ERR_DYNAMIC_TIMEOUT_DELAY_NEGATIVE =
  "delay must be non-negative";
export const MSG_ERR_DYNAMIC_TIMEOUT_ADD_ALREADY_REJECTED =
  "cannot add timeout after rejection";
export const MSG_ERR_DYNAMIC_TIMEOUT_RESET_ALREADY_REJECTED =
  "cannot reset timeout after rejection";
export const MSG_ERR_DYNAMIC_TIMEOUT_EXECUTE_ALREADY_REJECTED =
  "cannot execute timeout after rejection";
