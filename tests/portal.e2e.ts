import { expect, test } from '@playwright/test';

test('admin can log in and view the dispatch board', async ({ page }) => {
	await page.goto('/login');
	await page.getByLabel('Email').fill('admin@example.com');
	await page.getByLabel('Password').fill('admin1234');
	await page.getByRole('button', { name: 'Sign in' }).click();

	await expect(page).toHaveURL(/\/admin\/orders$/);
	await expect(page.getByText('Dispatch board')).toBeVisible();
});

test('driver can log in and view driver offers', async ({ page }) => {
	await page.goto('/login');
	await page.getByLabel('Email').fill('driver1@example.com');
	await page.getByLabel('Password').fill('driver1234');
	await page.getByRole('button', { name: 'Sign in' }).click();

	await expect(page).toHaveURL(/\/driver\/offers$/);
	await expect(page.getByText('Driver offers and live jobs')).toBeVisible();
});
