import { Given, When, Then } from '@cucumber/cucumber'
import assert from 'assert'

Given('the register page is open', async function () {
  const page = this.page
  if (!page) throw new Error('Page not initialized')
  await page.goto('http://localhost:5173')
  // Click the "Register" tab to switch from the default Login tab
  await page.getByRole('tab', { name: 'Register' }).click()
})

When('I enter {string} as the username and submit', async function (username) {
  const page = this.page
  if (!page) throw new Error('Page not initialized')
  
  this.uniqueUsername = username + Date.now();
  
  await page.fill('#register-username', this.uniqueUsername)
  await page.fill('#register-password', 'Test1234')
  await page.fill('#register-confirm-password', 'Test1234')
  await page.getByRole('button', { name: 'Register' }).click()
})

Then('I should see a welcome message containing {string}', async function (expected) {
  const page = this.page
  if (!page) throw new Error('Page not initialized')
  // After successful registration the app shows the dashboard with "Hello, <username>"
  const greeting = page.locator('text=Hello,')
  await greeting.waitFor({ timeout: 10000 })
  const parent = greeting.locator('..')
  const text = await parent.textContent()
  
  const expectedText = (this.uniqueUsername || expected).toLowerCase()
  
  assert.ok(text && text.toLowerCase().includes(expectedText), `Expected greeting to include "${expectedText}", got: "${text}"`)
})
