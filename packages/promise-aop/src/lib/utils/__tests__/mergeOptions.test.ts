/* eslint-disable @typescript-eslint/no-explicit-any */
import {
  mergeOptions,
  MSG_ERR_MERGE_OPTIONS_TYPE_MISMATCH,
  MSG_ERR_MERGE_OPTIONS_UNKNOWN_PROPERTY,
} from "@/lib/utils/mergeOptions";

describe("mergeOptions", () => {
  // test type definitions
  interface ServerConfig {
    port: number;
    host: string;
    ssl: boolean;
  }

  interface UserSettings {
    displayName: string;
    email: string;
    age: number;
    isActive: boolean;
  }

  interface DatabaseConfig {
    connectionSettings: {
      timeout: number;
      retries: number;
    };
    poolSettings: {
      maxConnections: number;
      minConnections: number;
    };
  }

  interface AppConfig {
    ui: {
      theme: {
        colors: {
          primary: string;
          secondary: string;
        };
      };
    };
    api: {
      endpoints: {
        users: {
          timeout: number;
          retries: number;
        };
      };
    };
  }

  describe("null and undefined handling", () => {
    it("should return source when target is null", () => {
      const baseConfig: ServerConfig = {
        port: 3000,
        host: "localhost",
        ssl: false,
      };

      const result = mergeOptions(baseConfig, null);

      expect(result).toBe(baseConfig);
    });

    it("should return source when target is undefined", () => {
      const baseConfig: ServerConfig = {
        port: 3000,
        host: "localhost",
        ssl: false,
      };

      const result = mergeOptions(baseConfig, undefined);

      expect(result).toBe(baseConfig);
    });
  });

  describe("type mismatch validation", () => {
    it("should throw error when source is string and target is number", () => {
      const stringConfig = "localhost";
      const numberOverride: any = 3000;

      expect(() => mergeOptions(stringConfig, numberOverride)).toThrow(
        MSG_ERR_MERGE_OPTIONS_TYPE_MISMATCH,
      );
    });

    it("should throw error when source is object and target is array", () => {
      const objectConfig = { port: 3000 };
      const arrayOverride: any = [3000, 4000];

      expect(() => mergeOptions(objectConfig, arrayOverride)).toThrow(
        MSG_ERR_MERGE_OPTIONS_UNKNOWN_PROPERTY("0"),
      );
    });

    it("should throw error when source is boolean and target is string", () => {
      const booleanConfig = true;
      const stringOverride: any = "enabled";

      expect(() => mergeOptions(booleanConfig, stringOverride)).toThrow(
        MSG_ERR_MERGE_OPTIONS_TYPE_MISMATCH,
      );
    });
  });

  describe("primitive value replacement", () => {
    it("should replace string values", () => {
      const userSettings: UserSettings = {
        displayName: "John Doe",
        email: "john@example.com",
        age: 30,
        isActive: true,
      };

      const nameUpdate = { displayName: "Jane Smith" };

      const result = mergeOptions(userSettings, nameUpdate);

      expect(result.displayName).toBe("Jane Smith");
      expect(result.email).toBe("john@example.com");
    });

    it("should replace number values", () => {
      const userSettings: UserSettings = {
        displayName: "John Doe",
        email: "john@example.com",
        age: 30,
        isActive: true,
      };

      const ageUpdate = { age: 25 };

      const result = mergeOptions(userSettings, ageUpdate);

      expect(result.age).toBe(25);
      expect(result.displayName).toBe("John Doe");
    });

    it("should replace boolean values", () => {
      const userSettings: UserSettings = {
        displayName: "John Doe",
        email: "john@example.com",
        age: 30,
        isActive: true,
      };

      const statusUpdate = { isActive: false };

      const result = mergeOptions(userSettings, statusUpdate);

      expect(result.isActive).toBe(false);
      expect(result.displayName).toBe("John Doe");
    });
  });

  describe("array handling", () => {
    it("should replace entire array instead of merging elements", () => {
      const menuConfig = {
        items: ["home", "about", "contact"],
        maxItems: 5,
      };

      const itemsOverride = { items: ["dashboard", "profile"] };

      const result = mergeOptions(menuConfig, itemsOverride);

      expect(result.items).toEqual(["dashboard", "profile"]);
      expect(result.maxItems).toBe(5);
    });
  });

  describe("function handling", () => {
    it("should replace entire function", () => {
      const handlerConfig = {
        onSuccess: () => "original success",
        onError: () => "original error",
      };

      const callbackOverride = {
        onSuccess: () => "updated success",
      };

      const result = mergeOptions(handlerConfig, callbackOverride);

      expect(result.onSuccess()).toBe("updated success");
      expect(result.onError()).toBe("original error");
    });
  });

  describe("simple object merging", () => {
    it("should merge flat objects correctly", () => {
      const serverConfig: ServerConfig = {
        port: 3000,
        host: "localhost",
        ssl: false,
      };

      const overrides = {
        port: 8080,
        ssl: true,
      };

      const result = mergeOptions(serverConfig, overrides);

      expect(result).toEqual({
        port: 8080,
        host: "localhost",
        ssl: true,
      });
    });
  });

  describe("recursive object merging", () => {
    it("should handle nested objects with proper recursion", () => {
      const databaseConfig: DatabaseConfig = {
        connectionSettings: {
          timeout: 5000,
          retries: 3,
        },
        poolSettings: {
          maxConnections: 10,
          minConnections: 2,
        },
      };

      const overrides = {
        connectionSettings: {
          timeout: 10000,
        },
        poolSettings: {
          maxConnections: 20,
        },
      };

      const result = mergeOptions(databaseConfig, overrides);

      expect(result).toEqual({
        connectionSettings: {
          timeout: 10000,
          retries: 3,
        },
        poolSettings: {
          maxConnections: 20,
          minConnections: 2,
        },
      });
    });
  });

  describe("deep nesting", () => {
    it("should handle multiple levels of nested objects", () => {
      const appConfig: AppConfig = {
        ui: {
          theme: {
            colors: {
              primary: "#blue",
              secondary: "#gray",
            },
          },
        },
        api: {
          endpoints: {
            users: {
              timeout: 5000,
              retries: 3,
            },
          },
        },
      };

      const deepOverrides = {
        ui: {
          theme: {
            colors: {
              primary: "#red",
            },
          },
        },
        api: {
          endpoints: {
            users: {
              timeout: 10000,
            },
          },
        },
      };

      const result = mergeOptions(appConfig, deepOverrides);

      expect(result.ui.theme.colors.primary).toBe("#red");
      expect(result.ui.theme.colors.secondary).toBe("#gray");
      expect(result.api.endpoints.users.timeout).toBe(10000);
      expect(result.api.endpoints.users.retries).toBe(3);
    });
  });

  describe("partial updates", () => {
    it("should allow updating only some properties", () => {
      const profileSettings = {
        displayName: "John Doe",
        email: "john@example.com",
        preferences: {
          theme: "dark",
          notifications: true,
          language: "en",
        },
      };

      const partialUpdate = {
        displayName: "Jane Smith",
        preferences: {
          theme: "light",
        },
      };

      const result = mergeOptions(profileSettings, partialUpdate);

      expect(result.displayName).toBe("Jane Smith");
      expect(result.email).toBe("john@example.com");
      expect(result.preferences.theme).toBe("light");
      expect(result.preferences.notifications).toBe(true);
      expect(result.preferences.language).toBe("en");
    });
  });

  describe("property validation", () => {
    it("should throw error when target has unknown properties", () => {
      const validConfig: ServerConfig = {
        port: 3000,
        host: "localhost",
        ssl: false,
      };

      const invalidConfigWithExtraProps = {
        port: 8080,
        unknownProperty: "invalid",
      };

      expect(() =>
        mergeOptions(validConfig, invalidConfigWithExtraProps),
      ).toThrow(MSG_ERR_MERGE_OPTIONS_UNKNOWN_PROPERTY("unknownProperty"));
    });

    it("should allow valid property updates", () => {
      const validConfig: ServerConfig = {
        port: 3000,
        host: "localhost",
        ssl: false,
      };

      const validOverrides = {
        host: "production.com",
        ssl: true,
      };

      expect(() => mergeOptions(validConfig, validOverrides)).not.toThrow();
    });
  });

  describe("error message testing", () => {
    it("should provide correct error message for unknown property", () => {
      const config = { validProp: "value" };
      const invalidOverride: any = { invalidProp: "test" };

      expect(() => mergeOptions(config, invalidOverride)).toThrow(
        MSG_ERR_MERGE_OPTIONS_UNKNOWN_PROPERTY("invalidProp"),
      );
    });

    it("should provide correct error message for type mismatch", () => {
      const stringValue = "test";
      const numberValue: any = 123;

      expect(() => mergeOptions(stringValue, numberValue)).toThrow(
        MSG_ERR_MERGE_OPTIONS_TYPE_MISMATCH,
      );
    });
  });

  describe("empty objects", () => {
    it("should handle empty source object", () => {
      const emptySource = {};
      const emptyTarget = {};

      const result = mergeOptions(emptySource, emptyTarget);

      expect(result).toEqual({});
    });

    it("should handle empty target object", () => {
      const sourceConfig = { port: 3000, host: "localhost" };
      const emptyTarget = {};

      const result = mergeOptions(sourceConfig, emptyTarget);

      expect(result).toEqual({ port: 3000, host: "localhost" });
    });
  });

  describe("mixed structures", () => {
    it("should handle objects with both primitives and nested objects", () => {
      const complexConfig = {
        timeout: 5000,
        retries: {
          max: 3,
          delay: 1000,
        },
        enabled: true,
        endpoints: ["api/users", "api/posts"],
        callback: () => "original",
      };

      const mixedOverrides = {
        timeout: 10000,
        retries: {
          max: 5,
        },
        endpoints: ["api/v2/users"],
      };

      const result = mergeOptions(complexConfig, mixedOverrides);

      expect(result.timeout).toBe(10000);
      expect(result.retries.max).toBe(5);
      expect(result.retries.delay).toBe(1000);
      expect(result.enabled).toBe(true);
      expect(result.endpoints).toEqual(["api/v2/users"]);
      expect(result.callback()).toBe("original");
    });
  });

  describe("objects with null and undefined values", () => {
    it("should handle nested null and undefined values properly", () => {
      const configWithNulls = {
        requiredFeature: "enabled",
        optionalFeature: null as string | null,
        experimentalFeature: undefined as string | undefined,
        settings: {
          theme: "dark",
          optionalSetting: null as boolean | null,
        },
      };

      const overridesWithNulls = {
        optionalFeature: "now-enabled",
        settings: {
          optionalSetting: true,
        },
      };

      const result = mergeOptions(configWithNulls, overridesWithNulls);

      expect(result.requiredFeature).toBe("enabled");
      expect(result.optionalFeature).toBe("now-enabled");
      expect(result.experimentalFeature).toBeUndefined();
      expect(result.settings.theme).toBe("dark");
      expect(result.settings.optionalSetting).toBe(true);
    });

    it("should handle updating values to null", () => {
      const config = {
        feature: "enabled",
        setting: true,
      };

      const nullUpdate = {
        feature: null as any,
      };

      const result = mergeOptions(config, nullUpdate);

      expect(result.feature).toBeNull();
      expect(result.setting).toBe(true);
    });
  });
});
