import { pipeAsync } from "@/lib/utils/pipeAsync";

describe("pipeAsync", () => {
  describe("Synchronous Functions", () => {
    it("should pipe two synchronous functions", async () => {
      const addOne = (x: number) => x + 1;
      const multiplyByTwo = (x: number) => x * 2;

      const pipeline = pipeAsync(addOne, multiplyByTwo);
      const result = await pipeline(5);

      expect(result).toBe(12); // (5 + 1) * 2
    });

    it("should pipe three synchronous functions", async () => {
      const addOne = (x: number) => x + 1;
      const multiplyByTwo = (x: number) => x * 2;
      const subtractThree = (x: number) => x - 3;

      const pipeline = pipeAsync(addOne, multiplyByTwo, subtractThree);
      const result = await pipeline(5);

      expect(result).toBe(9); // ((5 + 1) * 2) - 3
    });

    it("should pipe four synchronous functions", async () => {
      const addOne = (x: number) => x + 1;
      const multiplyByTwo = (x: number) => x * 2;
      const subtractThree = (x: number) => x - 3;
      const divideByTwo = (x: number) => x / 2;

      const pipeline = pipeAsync(
        addOne,
        multiplyByTwo,
        subtractThree,
        divideByTwo,
      );
      const result = await pipeline(5);

      expect(result).toBe(4.5); // (((5 + 1) * 2) - 3) / 2
    });

    it("should pipe five synchronous functions", async () => {
      const addOne = (x: number) => x + 1;
      const multiplyByTwo = (x: number) => x * 2;
      const subtractThree = (x: number) => x - 3;
      const divideByTwo = (x: number) => x / 2;
      const addTen = (x: number) => x + 10;

      const pipeline = pipeAsync(
        addOne,
        multiplyByTwo,
        subtractThree,
        divideByTwo,
      );
      const result = await pipeline(5);
      const finalResult = addTen(result);

      expect(finalResult).toBe(14.5); // ((((5 + 1) * 2) - 3) / 2) + 10
    });
  });

  describe("Asynchronous Functions", () => {
    it("should pipe two async functions", async () => {
      const addOneAsync = async (x: number) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return x + 1;
      };
      const multiplyByTwoAsync = async (x: number) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        return x * 2;
      };

      const pipeline = pipeAsync(addOneAsync, multiplyByTwoAsync);
      const result = await pipeline(5);

      expect(result).toBe(12); // (5 + 1) * 2
    });

    it("should pipe three async functions", async () => {
      const addOneAsync = async (x: number) => x + 1;
      const multiplyByTwoAsync = async (x: number) => x * 2;
      const subtractThreeAsync = async (x: number) => x - 3;

      const pipeline = pipeAsync(
        addOneAsync,
        multiplyByTwoAsync,
        subtractThreeAsync,
      );
      const result = await pipeline(5);

      expect(result).toBe(9); // ((5 + 1) * 2) - 3
    });

    it("should handle Promise-returning functions", async () => {
      const addOnePromise = (x: number) => Promise.resolve(x + 1);
      const multiplyByTwoPromise = (x: number) => Promise.resolve(x * 2);

      const pipeline = pipeAsync(addOnePromise, multiplyByTwoPromise);
      const result = await pipeline(5);

      expect(result).toBe(12); // (5 + 1) * 2
    });
  });

  describe("Mixed Sync/Async Functions", () => {
    it("should pipe mixed sync and async functions", async () => {
      const addOne = (x: number) => x + 1;
      const multiplyByTwoAsync = async (x: number) => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return x * 2;
      };
      const subtractThree = (x: number) => x - 3;

      const pipeline = pipeAsync(addOne, multiplyByTwoAsync, subtractThree);
      const result = await pipeline(5);

      expect(result).toBe(9); // ((5 + 1) * 2) - 3
    });

    it("should handle alternating sync/async functions", async () => {
      const syncAdd = (x: number) => x + 1;
      const asyncMultiply = async (x: number) => x * 2;
      const syncSubtract = (x: number) => x - 3;
      const asyncDivide = async (x: number) => x / 2;

      const pipeline = pipeAsync(
        syncAdd,
        asyncMultiply,
        syncSubtract,
        asyncDivide,
      );
      const result = await pipeline(5);

      expect(result).toBe(4.5); // (((5 + 1) * 2) - 3) / 2
    });
  });

  describe("Type Safety", () => {
    it("should handle string transformations", async () => {
      const addPrefix = (s: string) => `prefix-${s}`;
      const addSuffix = (s: string) => `${s}-suffix`;
      const toUpperCase = (s: string) => s.toUpperCase();

      const pipeline = pipeAsync(addPrefix, addSuffix, toUpperCase);
      const result = await pipeline("test");

      expect(result).toBe("PREFIX-TEST-SUFFIX");
    });

    it("should handle type transformations", async () => {
      const numberToString = (n: number) => n.toString();
      const stringLength = (s: string) => s.length;
      const isEven = (n: number) => n % 2 === 0;

      const pipeline = pipeAsync(numberToString, stringLength, isEven);
      const result = await pipeline(12345);

      expect(result).toBe(false); // "12345".length = 5, which is odd
    });

    it("should handle object transformations", async () => {
      interface User {
        id: number;
        name: string;
      }

      interface UserWithEmail {
        id: number;
        name: string;
        email: string;
      }

      interface UserProfile {
        userId: number;
        displayName: string;
        contactEmail: string;
      }

      const addEmail = (user: User): UserWithEmail => ({
        ...user,
        email: `${user.name.toLowerCase()}@example.com`,
      });

      const transformToProfile = async (
        user: UserWithEmail,
      ): Promise<UserProfile> => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return {
          userId: user.id,
          displayName: user.name,
          contactEmail: user.email,
        };
      };

      const pipeline = pipeAsync(addEmail, transformToProfile);
      const result = await pipeline({ id: 1, name: "John" });

      expect(result).toEqual({
        userId: 1,
        displayName: "John",
        contactEmail: "john@example.com",
      });
    });
  });

  describe("Error Handling", () => {
    it("should propagate errors from sync functions", async () => {
      const throwError = () => {
        throw new Error("Sync error");
      };
      const addOne = (x: number) => x + 1;

      const pipeline = pipeAsync(throwError, addOne);

      await expect(pipeline(5)).rejects.toThrow("Sync error");
    });

    it("should propagate errors from async functions", async () => {
      const addOne = (x: number) => x + 1;
      const throwErrorAsync = async () => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        throw new Error("Async error");
      };

      const pipeline = pipeAsync(addOne, throwErrorAsync);

      await expect(pipeline(5)).rejects.toThrow("Async error");
    });

    it("should propagate rejected promises", async () => {
      const addOne = (x: number) => x + 1;
      const rejectPromise = () =>
        Promise.reject(new Error("Promise rejection"));

      const pipeline = pipeAsync(addOne, rejectPromise);

      await expect(pipeline(5)).rejects.toThrow("Promise rejection");
    });

    it("should stop execution at first error", async () => {
      const addOne = (x: number) => x + 1;
      const throwError = () => {
        throw new Error("Middle error");
      };
      const multiplyByTwo = jest.fn((x: number) => x * 2);

      const pipeline = pipeAsync(addOne, throwError, multiplyByTwo);

      await expect(pipeline(5)).rejects.toThrow("Middle error");
      expect(multiplyByTwo).not.toHaveBeenCalled();
    });
  });

  describe("Edge Cases", () => {
    it("should handle single function", async () => {
      const addOne = (x: number) => x + 1;
      const pipeline = pipeAsync(addOne);
      const result = await pipeline(5);

      expect(result).toBe(6);
    });

    it("should handle single async function", async () => {
      const addOneAsync = async (x: number) => {
        await new Promise((resolve) => setTimeout(resolve, 5));
        return x + 1;
      };
      const pipeline = pipeAsync(addOneAsync);
      const result = await pipeline(5);

      expect(result).toBe(6);
    });

    it("should handle identity function", async () => {
      const identity = <T>(x: T) => x;
      const pipeline = pipeAsync(identity);
      const result = await pipeline("test");

      expect(result).toBe("test");
    });

    it("should handle null and undefined values", async () => {
      const returnNull = () => null;
      const handleNull = (x: null) => (x === null ? "was null" : "not null");

      const pipeline = pipeAsync(returnNull, handleNull);
      const result = await pipeline("input");

      expect(result).toBe("was null");
    });

    it("should handle zero values", async () => {
      const returnZero = () => 0;
      const isZero = (x: number) => x === 0;

      const pipeline = pipeAsync(returnZero, isZero);
      const result = await pipeline(123);

      expect(result).toBe(true);
    });

    it("should handle empty string values", async () => {
      const returnEmpty = () => "";
      const isEmpty = (s: string) => s.length === 0;

      const pipeline = pipeAsync(returnEmpty, isEmpty);
      const result = await pipeline("input");

      expect(result).toBe(true);
    });
  });

  describe("Performance", () => {
    it("should execute functions sequentially", async () => {
      const executionOrder: number[] = [];

      const fn1 = async (x: number) => {
        await new Promise((resolve) => setTimeout(resolve, 20));
        executionOrder.push(1);
        return x + 1;
      };

      const fn2 = async (x: number) => {
        await new Promise((resolve) => setTimeout(resolve, 10));
        executionOrder.push(2);
        return x * 2;
      };

      const fn3 = (x: number) => {
        executionOrder.push(3);
        return x - 1;
      };

      const pipeline = pipeAsync(fn1, fn2, fn3);
      const result = await pipeline(5);

      expect(result).toBe(11); // ((5 + 1) * 2) - 1
      expect(executionOrder).toEqual([1, 2, 3]);
    });

    it("should handle large number of functions", async () => {
      const functions = [
        (x: number) => x + 1,
        (x: number) => x + 2,
        (x: number) => x + 3,
        (x: number) => x + 4,
      ] as const;

      const pipeline = pipeAsync(...functions);
      const result = await pipeline(0);

      // 0 + 1 + 2 + 3 + 4 = 10
      expect(result).toBe(10);
    });
  });
});
