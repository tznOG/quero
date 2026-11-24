import { test, expect } from '@playwright/test';

test('conta, desejo, prioridade, edição, reserva, compartilhamento e segurança', async ({
  page,
  browser,
  baseURL,
}) => {
  const errors: string[] = [];
  page.on('pageerror', (error) => errors.push(error.message));
  const email = `browser.${crypto.randomUUID()}@example.test`;
  const password = 'Minha senha de teste 2026!';
  await page.goto('/');
  await expect(page.locator('.product-card')).toHaveCount(6);
  await page.getByRole('button', { name: 'Entrar', exact: true }).click();
  let dialog = page.getByRole('dialog');
  await dialog.getByLabel('Como podemos te chamar?').fill('Ana Browser');
  await dialog.getByLabel('Seu e-mail').fill(email);
  await dialog.getByLabel('Senha', { exact: true }).fill(password);
  await dialog.getByRole('button', { name: 'Criar minha conta', exact: true }).click();
  await expect(dialog).toHaveCount(0);
  await expect(page.locator('.demo-notice')).toHaveCount(0);
  await page.getByRole('button', { name: 'Adicionar desejo', exact: true }).click();
  dialog = page.getByRole('dialog');
  await dialog.getByLabel('Nome do produto').fill('Fone do teste');
  await dialog.getByLabel('Link da loja').fill('https://example.com/fone');
  await dialog.getByLabel('Preço atual (R$)', { exact: true }).fill('199.90');
  await dialog.getByLabel('Quero pagar até (R$)').fill('150');
  await dialog.getByRole('button', { name: 'Guardar meu desejo' }).click();
  await expect(page.locator('.product-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Marcar como quero muito' }).click();
  await expect(page.locator('.priority-badge')).toHaveText('Quero muito');
  await page.reload();
  await expect(page.locator('.priority-badge')).toHaveText('Quero muito');
  await page.getByRole('button', { name: 'Fone do teste', exact: true }).click();
  await page.getByRole('dialog').getByRole('button', { name: 'Editar', exact: true }).click();
  await page.getByLabel('Preço atual (R$)', { exact: true }).fill('180');
  await page.getByRole('button', { name: 'Salvar alterações', exact: true }).click();
  await expect(page.locator('.product-price-row')).toContainText('180,00');
  await page.getByRole('button', { name: 'Compartilhar lista', exact: true }).click();
  await page.getByRole('button', { name: 'Criar link compartilhável' }).click();
  const link = page.getByRole('textbox', { name: 'Link compartilhável' });
  await expect(link).toHaveValue(/lista=/);
  const sharedUrl = await link.inputValue();
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  const guest = await browser.newContext({ baseURL });
  try {
    const signup = await guest.request.post('/api/auth/signup', {
      data: { name: 'Bia Browser', email: `guest.${crypto.randomUUID()}@example.test`, password },
    });
    expect(signup.ok()).toBeTruthy();
    const visitor = await guest.newPage();
    await visitor.goto(sharedUrl);
    await visitor.getByRole('button', { name: 'Salvar esta lista', exact: true }).click();
    await expect(visitor.getByRole('status')).toContainText('Lista salva');
    await visitor.getByRole('button', { name: 'Vou presentear', exact: true }).click();
    await expect(visitor.getByRole('button', { name: 'Reservado por você' })).toBeVisible();
    await page.reload();
    await expect(page.locator('.product-card')).toHaveCount(1);
    await expect(page.getByText('Reservado por você')).toHaveCount(0);
    await page.getByRole('button', { name: 'Compartilhar lista', exact: true }).click();
    await page.getByRole('button', { name: 'Trocar link', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Link compartilhável' })).not.toHaveValue(
      sharedUrl,
    );
    const guestState = await (await guest.request.get('/api/state')).json();
    expect(guestState.friends).toHaveLength(0);
    await visitor.goto(sharedUrl);
    await expect(
      visitor.getByRole('heading', { name: 'Esse desejo está guardado.' }),
    ).toBeVisible();
    await guest.request.post('/api/auth/delete-account', {
      data: { currentPassword: password, confirmation: 'EXCLUIR' },
    });
  } finally {
    await guest.close();
  }
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  await page.getByRole('button', { name: 'Minha conta', exact: true }).click();
  const downloadPromise = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Baixar meus dados' }).click();
  expect((await downloadPromise).suggestedFilename()).toBe('quero-meus-dados.json');
  await page.getByRole('button', { name: 'Alterar senha ou excluir conta' }).click();
  await page.getByLabel('Senha atual', { exact: true }).fill(password);
  await page.getByLabel('Nova senha', { exact: true }).fill(password + ' nova');
  await page.getByLabel('Repita a nova senha').fill(password + ' nova');
  await page.getByRole('button', { name: 'Atualizar senha' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Minha conta', exact: true }).click();
  await page.getByRole('button', { name: 'Alterar senha ou excluir conta' }).click();
  await page.getByRole('button', { name: 'Quero excluir minha conta' }).click();
  await page.getByLabel('Senha atual', { exact: true }).fill(password + ' nova');
  await page.getByLabel('Digite EXCLUIR para confirmar').fill('EXCLUIR');
  await page.getByRole('button', { name: 'Excluir minha conta definitivamente' }).click();
  await expect(page.locator('.demo-notice')).toBeVisible();
  expect(errors).toEqual([]);
});

test('celular: navegação, busca, filtros, diálogo e ausência de rolagem horizontal', async ({
  page,
}) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto('/');
  await expect(page.locator('.product-card')).toHaveCount(6);
  await page.getByLabel('Buscar um desejo').fill('câmera');
  await expect(page.locator('.product-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Limpar busca' }).click();
  await page.getByLabel('Filtrar categoria').selectOption('Livros');
  await expect(page.locator('.product-card')).toHaveCount(1);
  await page.getByRole('button', { name: 'Mais um capítulo na estante', exact: true }).click();
  await expect(page.getByRole('dialog')).toBeVisible();
  await page.keyboard.press('Escape');
  await expect(page.getByRole('dialog')).toHaveCount(0);
  await page.getByRole('button', { name: 'Abrir menu' }).click();
  await page.getByRole('button', { name: 'Pessoas queridas', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Pessoas queridas.' })).toBeVisible();
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    expect(
      await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth),
    ).toBeTruthy();
  }
});

test('recuperação protege o token na URL e falhas de conexão permitem tentar novamente', async ({
  page,
}) => {
  await page.goto('/?reset=invalid-test-token');
  await expect(page.getByRole('dialog')).toBeVisible();
  await expect(page).not.toHaveURL(/reset=/);
  await page.getByLabel('Nova senha', { exact: true }).fill('Uma senha nova de teste');
  await page.getByRole('button', { name: 'Salvar nova senha' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Este link expirou' })).toBeVisible();
  await page.getByRole('button', { name: 'Fechar', exact: true }).click();
  await page.route('**/api/state', (route) =>
    route.fulfill({
      status: 503,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Conexão de teste indisponível' }),
    }),
  );
  await page.reload();
  await expect(
    page.getByRole('alert').filter({ hasText: 'Conexão de teste indisponível' }),
  ).toBeVisible();
  await expect(page.locator('.demo-notice')).toHaveCount(0);
  await page.unroute('**/api/state');
  await page.getByRole('button', { name: 'Tentar novamente' }).click();
  await expect(page.locator('.product-card')).toHaveCount(6);
});
