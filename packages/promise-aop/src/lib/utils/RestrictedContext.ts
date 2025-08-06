export class RestrictedContext<UnsafeContext> {
  private totalUsedSections: Set<SectionsUsed<UnsafeContext>[number]> =
    new Set();

  constructor(private readonly originalContext: UnsafeContext) {}

  private createRestrictedContext<Sections extends SectionsUsed<UnsafeContext>>(
    sections: Sections,
  ): Restricted<UnsafeContext, Sections> {
    const usedSections = new Set(sections);
    const target = this.originalContext;

    // Return primitive types directly without proxy wrapping
    if (typeof target !== "object" || target === null) {
      return target as Restricted<UnsafeContext, Sections>;
    }

    return new Proxy(target, {
      get: (target, prop, receiver) => {
        // Allow access to symbol properties (internal methods)
        if (typeof prop === "symbol") {
          return Reflect.get(target, prop, receiver);
        }

        const propKey = prop as keyof UnsafeContext;

        //  check if section is granted access in current context
        if (!usedSections.has(propKey)) {
          // distinguish between unauthorized vs. in-use-by-other errors
          if (this.totalUsedSections.has(propKey)) {
            throw new Error(
              MSG_ERR_RESTRICTED_CONTEXT_SECTION_IN_USE_BY_OTHER(String(prop)),
            );
          }

          throw new Error(
            MSG_ERR_RESTRICTED_CONTEXT_NOT_ALLOWED_SECTION(String(prop)),
          );
        }

        return Reflect.get(target, prop, receiver);
      },

      set() {
        throw new Error(MSG_ERR_RESTRICTED_CONTEXT_IMMUTABLE);
      },

      defineProperty() {
        throw new Error(MSG_ERR_RESTRICTED_CONTEXT_IMMUTABLE);
      },

      deleteProperty() {
        throw new Error(MSG_ERR_RESTRICTED_CONTEXT_IMMUTABLE);
      },
    }) as Restricted<UnsafeContext, Sections>;
  }

  async use<T, const Sections extends SectionsUsed<UnsafeContext>>(
    func: (context: Restricted<UnsafeContext, Sections>) => Promise<T>,
    sections: Sections,
  ) {
    // check for section conflicts before acquisition
    const conflictingSections = sections.filter((section) =>
      this.totalUsedSections.has(section),
    );

    if (conflictingSections.length > 0) {
      throw new Error(
        MSG_ERR_RESTRICTED_CONTEXT_SECTION_IN_USE(
          conflictingSections.map((s) => String(s)).join(", "),
        ),
      );
    }

    // atomically acquire all sections
    sections.forEach((section) => this.totalUsedSections.add(section));

    return (
      Promise.resolve()
        .then(() => func(this.createRestrictedContext(sections)))
        // ensure sections are always released, even on error
        .finally(() => {
          sections.forEach((section) => this.totalUsedSections.delete(section));
        })
    );
  }
}

export type SectionsUsed<UnsafeContext> = UnsafeContext extends object
  ? readonly (keyof UnsafeContext)[]
  : [];

export type Restricted<
  UnsafeContext,
  Sections extends SectionsUsed<UnsafeContext> = SectionsUsed<UnsafeContext>,
> = UnsafeContext extends object
  ? {
      readonly [key in Sections[number]]: UnsafeContext[key];
    }
  : UnsafeContext;

export const MSG_ERR_RESTRICTED_CONTEXT_NOT_ALLOWED_SECTION = (prop: string) =>
  `Access to property '${prop}' is not allowed. Use 'use()' method to grant access to this section.`;

export const MSG_ERR_RESTRICTED_CONTEXT_SECTION_IN_USE_BY_OTHER = (
  prop: string,
) =>
  `Property '${prop}' is currently being used by another process. Cannot access section that is already in use.`;

export const MSG_ERR_RESTRICTED_CONTEXT_IMMUTABLE = `Restricted context is immutable. Cannot modify, add, or delete properties.`;

export const MSG_ERR_RESTRICTED_CONTEXT_SECTION_IN_USE = (sections: string) =>
  `Sections [${sections}] are already in use. Cannot acquire sections that are currently being used.`;
