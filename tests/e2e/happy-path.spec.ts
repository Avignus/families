import { test, expect, Page } from "@playwright/test";

// This E2E test uses a mocked Steam auth flow.
// The mock bypasses the real OpenID handshake and injects a test session cookie.
// Requires the app to be running at BASE_URL and the DB seeded with test data.

const BASE_URL = process.env.E2E_BASE_URL ?? "http://localhost:3000";

// Helper: inject a test session cookie that matches the demo user "Igor" from seed
async function loginAsDemoUser(page: Page, userId: string, steamId: string, personaName: string) {
  // Visit the mock login endpoint (only available in test/dev mode)
  await page.goto(`${BASE_URL}/api/auth/mock-login?userId=${userId}&steamId=${steamId}&personaName=${personaName}`);
  await page.waitForURL(`${BASE_URL}/dashboard`);
}

test.describe("Families Happy Path", () => {
  test.skip(
    !process.env.E2E_ENABLED,
    "E2E tests require E2E_ENABLED=1 and a running app instance"
  );

  test("full flow: create family → add wishlist item → pledge → notification", async ({ browser }) => {
    // Two separate browser contexts simulate two different users
    const contextA = await browser.newContext();
    const contextB = await browser.newContext();
    const pageA = await contextA.newPage();
    const pageB = await contextB.newPage();

    // ── User A: Create a family ──────────────────────────────────────────────
    await loginAsDemoUser(pageA, "demo-user-a", "76561198000000099", "TestUserA");

    await pageA.goto(`${BASE_URL}/dashboard`);
    await expect(pageA.getByRole("heading", { name: "Suas Famílias" })).toBeVisible();

    // Open the create family dialog
    await pageA.getByRole("button", { name: /Nova Família/i }).click();
    await pageA.getByPlaceholder(/Turma dos Games/i).fill("E2E Test Family");
    await pageA.getByRole("button", { name: /Criar Família/i }).click();

    // Should navigate to the new family page
    await pageA.waitForURL(/\/families\//);
    await expect(pageA.getByText("Família E2E Test Family")).toBeVisible();

    const familyUrl = pageA.url();
    const familyId = familyUrl.split("/families/")[1];

    // Copy the family ID for User B to join
    expect(familyId).toBeTruthy();

    // ── User A: Add a wishlist item ──────────────────────────────────────────
    // User A is the selected member, so Add Game button should be visible
    await pageA.getByRole("button", { name: /Adicionar Jogo/i }).click();
    await pageA.getByPlaceholder(/Buscar jogos/i).fill("Hades");
    // Wait for search results
    await pageA.waitForSelector("text=Hades", { timeout: 5000 });
    await pageA.getByText("Hades").first().click();

    // Game should appear in the wishlist
    await expect(pageA.getByText("Hades").first()).toBeVisible();

    // ── User B: Join the family ──────────────────────────────────────────────
    await loginAsDemoUser(pageB, "demo-user-b", "76561198000000100", "TestUserB");

    await pageB.goto(`${BASE_URL}/dashboard`);
    await pageB.getByRole("button", { name: /Entrar em Família/i }).click();
    await pageB.getByPlaceholder(/Cole o ID/i).fill(familyId);
    await pageB.getByRole("button", { name: /Solicitar Entrada/i }).click();
    await expect(pageB.getByText(/Solicitação enviada/i)).toBeVisible({ timeout: 3000 });

    // ── User A (chief): Approve User B ────────────────────────────────────────
    await pageA.goto(`${BASE_URL}/families/${familyId}/admin`);
    await expect(pageA.getByText("TestUserB")).toBeVisible();
    // Click the approve button (checkmark)
    await pageA.getByTitle("Approve").first().click();
    await expect(pageA.getByText(/Membro aprovado/i)).toBeVisible({ timeout: 3000 });

    // ── User B: Pledge on User A's Hades item ────────────────────────────────
    await pageB.goto(`${BASE_URL}/families/${familyId}`);
    // Select User A in the members strip
    await pageB.getByText("TestUserA").click();

    // Click Contribuir on the Hades card
    await pageB.getByRole("button", { name: /Contribuir/i }).first().click();
    await pageB.getByRole("spinbutton").fill("10");
    await expect(pageB.getByText(/você vai cobrir/i)).toBeVisible();
    await pageB.getByRole("button", { name: /Confirmar Contribuição/i }).click();
    await expect(pageB.getByText(/Contribuição.*registrada/i)).toBeVisible({ timeout: 3000 });

    // ── User A: Verify notification appeared ────────────────────────────────
    await pageA.goto(`${BASE_URL}/notifications`);
    await expect(pageA.getByText(/Nova contribuição|PLEDGE_RECEIVED/i)).toBeVisible({ timeout: 5000 });

    await contextA.close();
    await contextB.close();
  });
});
