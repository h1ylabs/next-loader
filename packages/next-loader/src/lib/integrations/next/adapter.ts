import { createExternalResourceAdapter } from "../../features/createResourceAdapter";

export const NEXTJS_FETCH_MAX_TAGS = 128;
export const NEXTJS_FETCH_MAX_TAG_LENGTH = 256;

export const NextJSAdapter = createExternalResourceAdapter<string, Response>(
  ({ tags, options }) => ({
    // resource tag constraints
    validate: (data) => {
      // 0. parameter type check
      if (typeof data !== "string") {
        throw new Error(MSG_ERR_INVALID_PARAMETER_TYPE);
      }

      // 1. next.js fetch can specify up to 128 tags
      if (tags.length > NEXTJS_FETCH_MAX_TAGS) {
        throw new Error(MSG_ERR_INVALID_TAGS);
      }

      // 2. each tag has a limit of 256 characters
      if (tags.some((tag) => tag.length > NEXTJS_FETCH_MAX_TAG_LENGTH)) {
        throw new Error(MSG_ERR_INVALID_TAG_LENGTH);
      }
    },
    load: async (data) => {
      return fetch(data, {
        next: { revalidate: options.staleTime, tags: [...tags] },
      });
    },
  }),
);

export const MSG_ERR_INVALID_PARAMETER_TYPE =
  "invalid parameter type: must be string.";

export const MSG_ERR_INVALID_TAGS = "invalid tags: must be less than 128 tags.";
export const MSG_ERR_INVALID_TAG_LENGTH =
  "invalid tag length: each tag must be 256 characters or less.";
