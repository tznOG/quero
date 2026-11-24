import { test, expect } from '@playwright/test';

for (const width of [1280, 390]) {
  test(`categorias próprias: criar, renomear, filtrar e excluir em ${width}px`, async ({
    page,
  }) => {
    await page.setViewportSize({ width, height: 900 });
    const password = 'Synthetic browser category password!';
    const email = `categories.${crypto.randomUUID()}@example.test`;
    const signup = await page.request.post('/api/auth/signup', {
      data: { name: 'Categorias Demo', email, password },
    });
    expect(signup.ok()).toBeTruthy();
    try {
      const state = await (await page.request.get('/api/state')).json();
      const listId = state.lists[0].id;
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(error.message));
      await page.goto('/');
      await expect(page.getByRole('button', { name: 'Gerenciar categorias' })).toHaveCount(1);
      async function openManager() {
        if (width < 768) await page.getByRole('button', { name: 'Abrir menu' }).click();
        await page.getByRole('button', { name: 'Gerenciar categorias' }).click();
        await expect(page.getByRole('heading', { name: 'Suas categorias' })).toBeVisible();
      }
      await openManager();
      let dialog = page.getByRole('dialog');
      await dialog.getByLabel('Nome da categoria', { exact: true }).fill('Todas');
      await dialog.getByRole('button', { name: 'Criar categoria', exact: true }).click();
      const categoryRow = dialog.getByRole('listitem').filter({ hasText: 'Todas' });
      await expect(
        categoryRow.getByRole('button', { name: 'Renomear Todas', exact: true }),
      ).toBeVisible();
      await dialog.getByLabel('Nome da categoria', { exact: true }).fill('todas');
      await dialog.getByRole('button', { name: 'Criar categoria', exact: true }).click();
      await expect(dialog.getByRole('alert')).toContainText('já tem uma categoria');
      await dialog.getByRole('button', { name: 'Fechar', exact: true }).click();
      // Seed one synthetic item through the API; edit the category through the real item form.
      const created = await page.request.post('/api/items', {
        data: {
          wishlistId: listId,
          name: 'Desejo de demonstração',
          url: 'https://example.com',
          price: 1000,
          category: 'Todas',
          priority: 'Quero',
          notes: 'Guardar',
          image: '',
        },
      });
      expect(created.status()).toBe(201);
      await page.reload();
      await page.getByLabel('Filtrar categoria').selectOption({ label: 'Todas' });
      await expect(page.locator('.product-card')).toHaveCount(1);
      await openManager();
      dialog = page.getByRole('dialog');
      await dialog.getByRole('button', { name: 'Renomear Todas', exact: true }).click();
      await dialog.getByLabel('Novo nome', { exact: true }).fill('Viagens');
      await dialog.getByRole('button', { name: 'Salvar nome', exact: true }).click();
      await expect(
        dialog.getByRole('button', { name: 'Renomear Viagens', exact: true }),
      ).toBeVisible();
      await dialog.getByRole('button', { name: 'Fechar', exact: true }).click();
      await expect(page.getByLabel('Filtrar categoria')).toHaveValue('category:Viagens');
      await expect(page.locator('.product-card')).toHaveCount(1);
      await page.getByRole('button', { name: 'Desejo de demonstração', exact: true }).click();
      await page.getByRole('dialog').getByRole('button', { name: 'Editar', exact: true }).click();
      await expect(page.getByRole('dialog').getByLabel('Categoria', { exact: true })).toHaveValue(
        'Viagens',
      );
      await page
        .getByRole('dialog')
        .getByRole('button', { name: 'Salvar alterações', exact: true })
        .click();
      await expect(page.getByRole('dialog')).toHaveCount(0);
      await openManager();
      dialog = page.getByRole('dialog');
      await dialog.getByRole('button', { name: 'Excluir Viagens', exact: true }).click();
      await expect(dialog.getByText(/Nenhum desejo será excluído/)).toBeVisible();
      await dialog.getByRole('button', { name: 'Cancelar', exact: true }).click();
      await expect(
        dialog.getByRole('button', { name: 'Excluir Viagens', exact: true }),
      ).toBeVisible();
      await dialog.getByRole('button', { name: 'Excluir Viagens', exact: true }).click();
      await dialog.getByRole('button', { name: 'Excluir categoria', exact: true }).click();
      await expect(
        dialog.getByRole('button', { name: 'Excluir Viagens', exact: true }),
      ).toHaveCount(0);
      await dialog.getByLabel('Nome da categoria', { exact: true }).fill('<b>Artes</b>');
      await dialog.getByRole('button', { name: 'Criar categoria', exact: true }).click();
      const literal = dialog.getByRole('listitem').filter({ hasText: '<b>Artes</b>' });
      await expect(literal).toBeVisible();
      await expect(literal.locator('b')).toHaveCount(0);
      expect(await dialog.evaluate((el) => el.scrollWidth <= el.clientWidth)).toBeTruthy();
      await dialog.getByRole('button', { name: 'Fechar', exact: true }).click();
      await expect(page.getByLabel('Filtrar categoria')).toHaveValue('category:');
      await expect(page.locator('.product-card')).toHaveCount(1);
      await expect(page.locator('.product-card')).toContainText('Sem categoria');
      await page.reload();
      await page.getByLabel('Filtrar categoria').selectOption({ label: 'Sem categoria' });
      await expect(page.locator('.product-card')).toHaveCount(1);
      expect(
        await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
      ).toBeTruthy();
      expect(errors).toEqual([]);
    } finally {
      const removed = await page.request.post('/api/auth/delete-account', {
        data: { currentPassword: password, confirmation: 'EXCLUIR' },
      });
      expect(removed.ok()).toBeTruthy();
    }
  });
}
