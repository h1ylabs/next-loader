declare global {
  interface RequestInit {
    cache?: RequestCache;
    next?: {
      revalidate?: number | false;
      tags?: string[];
    };
  }

  // Next.js fetch 타입 정의
  function fetch(
    input: RequestInfo | URL,
    init?: RequestInit,
  ): Promise<Response>;
}

export {};
