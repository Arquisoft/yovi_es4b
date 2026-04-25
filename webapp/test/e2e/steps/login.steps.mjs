import { Given, Then, When } from '@cucumber/cucumber'
import assert from 'node:assert'

Given('I open the login page with a mocked auth backend', async function () {
  const page = this.page
  if (!page) throw new Error('Page not initialized')

  this.loginUsername = `${String(this.testUsername ?? 'e2e-login').toLowerCase()}_ok`
  this.loginPassword = 'Test1234'

  await page.route('**/auth/verify', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ user: { username: this.loginUsername } }),
    })
  })

  await page.route('**/auth/login', async (route) => {
    const body = route.request().postData() ?? '{}'
    const payload = JSON.parse(body)

    if (payload.username === this.loginUsername && payload.password === this.loginPassword) {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          token: 'e2e-token',
          username: this.loginUsername,
          message: `Welcome back ${this.loginUsername}!`,
        }),
      })
      return
    }

    await route.fulfill({
      status: 401,
      contentType: 'application/json',
      body: JSON.stringify({ message: 'Invalid credentials' }),
    })
  })

  await page.route('**/stats/v1/me/history**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ items: [] }),
    })
  })

  await page.route('**/stats/v1/me**', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({ totalGames: 0, victories: 0, defeats: 0, updatedAt: null }),
    })
  })

  await page.goto('http://localhost:5173')
  await page.getByRole('tab', { name: 'Login' }).waitFor({ timeout: 10000 })
})

When('I log in with valid credentials', async function () {
  const page = this.page
  if (!page) throw new Error('Page not initialized')

  await page.fill('#login-username', this.loginUsername)
  await page.fill('#login-password', this.loginPassword)
  await page.getByRole('button', { name: 'Login' }).click()
})

When('I log in with invalid credentials', async function () {
  const page = this.page
  if (!page) throw new Error('Page not initialized')

  await page.fill('#login-username', this.loginUsername)
  await page.fill('#login-password', 'wrong-password')
  await page.getByRole('button', { name: 'Login' }).click()
})

Then('I should see the authenticated dashboard greeting', async function () {
  const page = this.page
  if (!page) throw new Error('Page not initialized')

  const greeting = page.getByText(/Hello,/i)
  await greeting.waitFor({ timeout: 10000 })

  const greetingContainer = greeting.locator('..')
  const text = await greetingContainer.textContent()
  const normalizedText = text?.toLowerCase()
  const normalizedUsername = String(this.loginUsername).toLowerCase()
  assert.ok(
    normalizedText?.includes(normalizedUsername),
    `Expected greeting to include username "${this.loginUsername}", got "${String(text)}"`,
  )
})

Then('I should see a login error message', async function () {
  const page = this.page
  if (!page) throw new Error('Page not initialized')

  const error = page.getByText(/invalid credentials/i)
  await error.waitFor({ timeout: 10000 })
})
