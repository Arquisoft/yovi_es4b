Feature: Health Checks
  Validate the health check endpoints of the Gateway

  Scenario: Root health endpoint
    When I make a GET request to "/health"
    Then the response status should be 200
    And the response should contain "status" with value "ok"

  Scenario: External API health endpoint
    When I make a GET request to "/external/v1/health"
    Then the response status should be 200
    And the response should contain "status" with value "ok"
    And the response should contain "api" with value "external"
