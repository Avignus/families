import { describe, it, expect } from "vitest";

// Pure pledge math logic extracted for testing without DB

function calculatePledgeResult(params: {
  targetPriceCents: number;
  existingPledgeCents: number;
  newPledgeCents: number;
}): {
  isValid: boolean;
  remaining: number;
  newTotal: number;
  isFunded: boolean;
  percent: number;
  error?: string;
} {
  const { targetPriceCents, existingPledgeCents, newPledgeCents } = params;
  const remaining = targetPriceCents - existingPledgeCents;

  if (newPledgeCents <= 0) {
    return { isValid: false, remaining, newTotal: existingPledgeCents, isFunded: false, percent: 0, error: "Pledge must be positive" };
  }
  if (newPledgeCents > remaining) {
    return { isValid: false, remaining, newTotal: existingPledgeCents, isFunded: false, percent: 0, error: "Exceeds remaining" };
  }

  const newTotal = existingPledgeCents + newPledgeCents;
  const isFunded = newTotal >= targetPriceCents;
  const percent = Math.round((newPledgeCents / targetPriceCents) * 100);

  return { isValid: true, remaining, newTotal, isFunded, percent };
}

function validatePledgeOwnership(params: {
  pledgerUserId: string;
  ownerUserId: string | null;
}): { allowed: boolean; error?: string } {
  if (params.ownerUserId === null) return { allowed: true };
  if (params.pledgerUserId === params.ownerUserId) {
    return { allowed: false, error: "Cannot pledge on your own wishlist item" };
  }
  return { allowed: true };
}

function validateUniquenessConstraint(params: {
  familyId: string;
  steamAppId: number;
  existingItems: Array<{ familyId: string; steamAppId: number; status: string }>;
}): { allowed: boolean; existingItem?: { familyId: string; steamAppId: number; status: string }; error?: string } {
  const existing = params.existingItems.find(
    (item) =>
      item.familyId === params.familyId &&
      item.steamAppId === params.steamAppId &&
      item.status !== "cancelled"
  );
  if (existing) {
    return { allowed: false, existingItem: existing, error: "Game already in family wishlist" };
  }
  return { allowed: true };
}

describe("Pledge math", () => {
  describe("calculatePledgeResult", () => {
    it("accepts valid pledge under target", () => {
      const result = calculatePledgeResult({
        targetPriceCents: 10000,
        existingPledgeCents: 3000,
        newPledgeCents: 4000,
      });
      expect(result.isValid).toBe(true);
      expect(result.newTotal).toBe(7000);
      expect(result.isFunded).toBe(false);
      expect(result.remaining).toBe(7000);
      expect(result.percent).toBe(40);
    });

    it("accepts pledge that exactly fills the target", () => {
      const result = calculatePledgeResult({
        targetPriceCents: 10000,
        existingPledgeCents: 6000,
        newPledgeCents: 4000,
      });
      expect(result.isValid).toBe(true);
      expect(result.isFunded).toBe(true);
      expect(result.newTotal).toBe(10000);
    });

    it("rejects pledge that would exceed target", () => {
      const result = calculatePledgeResult({
        targetPriceCents: 10000,
        existingPledgeCents: 8000,
        newPledgeCents: 3000,
      });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("Exceeds remaining");
    });

    it("rejects zero pledge", () => {
      const result = calculatePledgeResult({
        targetPriceCents: 10000,
        existingPledgeCents: 0,
        newPledgeCents: 0,
      });
      expect(result.isValid).toBe(false);
      expect(result.error).toContain("positive");
    });

    it("rejects negative pledge", () => {
      const result = calculatePledgeResult({
        targetPriceCents: 10000,
        existingPledgeCents: 0,
        newPledgeCents: -500,
      });
      expect(result.isValid).toBe(false);
    });

    it("calculates correct percentage for partial pledge", () => {
      const result = calculatePledgeResult({
        targetPriceCents: 20000,
        existingPledgeCents: 0,
        newPledgeCents: 5000,
      });
      expect(result.percent).toBe(25);
    });

    it("handles already fully pledged item", () => {
      const result = calculatePledgeResult({
        targetPriceCents: 10000,
        existingPledgeCents: 10000,
        newPledgeCents: 1,
      });
      expect(result.isValid).toBe(false);
      expect(result.remaining).toBe(0);
    });
  });
});

describe("Pledge ownership validation", () => {
  it("allows pledging on another user's item", () => {
    const result = validatePledgeOwnership({
      pledgerUserId: "user-a",
      ownerUserId: "user-b",
    });
    expect(result.allowed).toBe(true);
  });

  it("rejects owner pledging on their own item", () => {
    const result = validatePledgeOwnership({
      pledgerUserId: "user-a",
      ownerUserId: "user-a",
    });
    expect(result.allowed).toBe(false);
    expect(result.error).toBeDefined();
  });

  it("allows pledge on a family-owned item (null owner)", () => {
    const result = validatePledgeOwnership({
      pledgerUserId: "user-a",
      ownerUserId: null,
    });
    expect(result.allowed).toBe(true);
  });
});

describe("Family wishlist uniqueness", () => {
  const existingItems = [
    { familyId: "family-1", steamAppId: 1145360, status: "open" },
    { familyId: "family-1", steamAppId: 367520, status: "funded" },
    { familyId: "family-1", steamAppId: 999999, status: "cancelled" },
    { familyId: "family-2", steamAppId: 1145360, status: "open" },
  ];

  it("rejects duplicate game in same family", () => {
    const result = validateUniquenessConstraint({
      familyId: "family-1",
      steamAppId: 1145360,
      existingItems,
    });
    expect(result.allowed).toBe(false);
    expect(result.existingItem).toBeDefined();
  });

  it("allows same game in different family", () => {
    const result = validateUniquenessConstraint({
      familyId: "family-3",
      steamAppId: 1145360,
      existingItems,
    });
    expect(result.allowed).toBe(true);
  });

  it("allows a new game not yet in family", () => {
    const result = validateUniquenessConstraint({
      familyId: "family-1",
      steamAppId: 1086940,
      existingItems,
    });
    expect(result.allowed).toBe(true);
  });

  it("allows re-adding a cancelled game", () => {
    const result = validateUniquenessConstraint({
      familyId: "family-1",
      steamAppId: 999999,
      existingItems,
    });
    expect(result.allowed).toBe(true);
  });

  it("rejects funded game (still in family)", () => {
    const result = validateUniquenessConstraint({
      familyId: "family-1",
      steamAppId: 367520,
      existingItems,
    });
    expect(result.allowed).toBe(false);
  });
});
