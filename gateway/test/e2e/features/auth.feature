Feature: Authentication and Users
  Validate user registration, login, and profile fetching

  Scenario: Register a new user
    Given a new unique username
    When I register with that username and password "E2eTestPass123!"
    Then the response status should be 200 or 201
    And the response should contain a valid token

  Scenario: Login an existing user
    Given a registered user with password "E2eTestPass123!"
    When I login with that username and password "E2eTestPass123!"
    Then the response status should be 200
    And the response should contain a valid token

  Scenario: Login with wrong password
    Given a registered user with password "E2eTestPass123!"
    When I login with that username and password "wrong_password"
    Then the response status should be 401 or higher

  Scenario: Fetch user profile without token
    When I make a GET request to "/external/v1/users/me"
    Then the response status should be 401

  Scenario: Fetch user profile with valid token
    Given a logged in user
    When I make an authenticated GET request to "/external/v1/users/me"
    Then the response status should be 200
    And the response should contain my username
    And the response should have a "stats" object

  Scenario: Fetch user history without token
    When I make a GET request to "/external/v1/users/me/history"
    Then the response status should be 401

  Scenario: Fetch user history with valid token
    Given a logged in user
    When I make an authenticated GET request to "/external/v1/users/me/history"
    Then the response status should be 200
    And the response should be a valid JSON object
