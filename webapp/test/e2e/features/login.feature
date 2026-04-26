Feature: Login
  Validate login flows with mocked auth backend

  Scenario: Successful login opens the dashboard
    Given I open the login page with a mocked auth backend
    When I log in with valid credentials
    Then I should see the authenticated dashboard greeting

  Scenario: Invalid login credentials show an error
    Given I open the login page with a mocked auth backend
    When I log in with invalid credentials
    Then I should see a login error message
