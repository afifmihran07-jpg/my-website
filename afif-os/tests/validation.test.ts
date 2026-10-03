import { describe, expect, it } from "vitest";

import { optionalInt, optionalText, optionalUrl, requiredText, uuid } from "@/server/services/common-validation";
import { createBookSchema } from "@/server/services/books-validation";
import { createProjectSchema } from "@/server/services/projects-validation";

/**
 * Regression tests for the shapes HTML forms actually produce.
 *
 * Both of these were live bugs: creating a book without a daily page target
 * failed because `""` coerced to 0 and tripped the minimum, and creating a
 * project without linking a goal failed because the client sends `null` for an
 * unselected reference. Neither is an exotic input — both are the default state
 * of their own form.
 */
describe("optionalInt treats a cleared number input as absent, not zero", () => {
  const schema = optionalInt(1, 5000, "Daily page target");

  it("accepts an empty string", () => {
    expect(schema.safeParse("").success).toBe(true);
    expect(schema.parse("")).toBeNull();
  });

  it("accepts whitespace and null", () => {
    expect(schema.parse("   ")).toBeNull();
    expect(schema.parse(null)).toBeNull();
  });

  it("accepts undefined", () => {
    expect(schema.parse(undefined)).toBeUndefined();
  });

  it("still accepts real numbers and numeric strings", () => {
    expect(schema.parse("30")).toBe(30);
    expect(schema.parse(30)).toBe(30);
  });

  it("still enforces the bounds for values that are present", () => {
    expect(schema.safeParse("0").success).toBe(false);
    expect(schema.safeParse("-5").success).toBe(false);
    expect(schema.safeParse("999999").success).toBe(false);
    expect(schema.safeParse("1.5").success).toBe(false);
  });
});

describe("uuid treats both empty string and null as no reference", () => {
  it("accepts the empty string", () => {
    expect(uuid.parse("")).toBeNull();
    expect(uuid.parse("   ")).toBeNull();
  });

  it("accepts an explicit null, which is what the client sends", () => {
    expect(uuid.parse(null)).toBeNull();
  });

  it("accepts a valid uuid", () => {
    const id = "3f2504e0-4f89-11d3-9a0c-0305e82c3301";
    expect(uuid.parse(id)).toBe(id);
  });

  it("rejects something that is neither", () => {
    expect(uuid.safeParse("not-a-uuid").success).toBe(false);
    expect(uuid.safeParse(123).success).toBe(false);
  });
});

describe("the book form's default state is valid", () => {
  it("creates a book with no daily page target and no domain", () => {
    // Exactly what BooksClient sends when only the title is filled in.
    const payload = {
      title: "A book",
      author: "",
      totalPages: "300",
      status: "want_to_read",
      targetFinishDate: null,
      dailyPageTarget: "",
      domainId: null,
    };
    const result = createBookSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.dailyPageTarget).toBeNull();
      expect(result.data.domainId).toBeNull();
      expect(result.data.author).toBeNull();
    }
  });

  it("rejects a book with no title", () => {
    expect(
      createBookSchema.safeParse({
        title: "",
        author: "",
        totalPages: "",
        status: "want_to_read",
        targetFinishDate: null,
        dailyPageTarget: "",
        domainId: null,
      }).success,
    ).toBe(false);
  });
});

describe("the project form's default state is valid", () => {
  it("creates a project with no goal, dates or URL", () => {
    // Exactly what ProjectsClient sends: `goalId: form.goalId || null`.
    const payload = {
      name: "A project",
      description: "",
      status: "active",
      startDate: null,
      targetDate: null,
      goalId: null,
      url: "",
    };
    const result = createProjectSchema.safeParse(payload);
    expect(result.success).toBe(true);
    if (result.success) {
      expect(result.data.goalId).toBeNull();
      expect(result.data.url).toBeNull();
      expect(result.data.startDate).toBeNull();
    }
  });

  it("rejects a project with no name", () => {
    expect(
      createProjectSchema.safeParse({
        name: "",
        description: "",
        status: "active",
        startDate: null,
        targetDate: null,
        goalId: null,
        url: "",
      }).success,
    ).toBe(false);
  });
});

describe("the other optional helpers still behave", () => {
  it("optionalText maps blank to null and enforces length", () => {
    const schema = optionalText(10, "Note");
    expect(schema.parse("")).toBeNull();
    expect(schema.parse("  ")).toBeNull();
    expect(schema.parse("hello")).toBe("hello");
    expect(schema.safeParse("x".repeat(11)).success).toBe(false);
  });

  it("optionalUrl requires a scheme when a value is given", () => {
    expect(optionalUrl.parse("")).toBeNull();
    expect(optionalUrl.parse("https://example.com")).toBe("https://example.com");
    expect(optionalUrl.safeParse("javascript:alert(1)").success).toBe(false);
    expect(optionalUrl.safeParse("example.com").success).toBe(false);
  });

  it("requiredText rejects blanks", () => {
    expect(requiredText(50, "Title").safeParse("  ").success).toBe(false);
    expect(requiredText(50, "Title").parse("Real title")).toBe("Real title");
  });
});
