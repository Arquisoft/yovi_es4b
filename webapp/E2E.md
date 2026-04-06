# E2E tests (Playwright + Cucumber)

This project includes a simple BDD-style E2E setup that uses Playwright for browser automation and Cucumber (`@cucumber/cucumber`) for Gherkin feature files.

Quick commands:

- Set auth environment variables in your terminal session (required by `auth_service`):

  ```powershell
  $env:JWT_SECRET="change_this_secret"
  $env:MONGO_AUTH_DB="mongodb://localhost:27017/auth"
  ```

- Install Playwright browsers (once):

  ```bash
  npm run test:e2e:install-browsers
  ```

- Run E2E tests (requires the app, gateway, and auth service running):

  - Start required services and run tests automatically:

    ```bash
    npm run test:e2e
    ```

  - Or, start services manually and run only the Cucumber flow:

    ```bash
    npm run start:all
    npm run test:e2e:run
    ```

  - Alternative manual startup for auth (outside `start:all`):

    ```bash
    (cd ../auth_service && npm start)
    ```

Files of interest:
- `features/register.feature` - example Gherkin feature
- `test/e2e/steps` - step definitions
- `test/e2e/support` - Cucumber World and Playwright hooks

Notes:
- For CI, ensure Playwright browsers are installed (e.g. `npx playwright install --with-deps`).
- `npm run start:all` starts Vite (`webapp`), `gateway`, and `auth_service` concurrently.
