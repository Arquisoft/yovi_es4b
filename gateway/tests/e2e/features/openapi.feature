Feature: OpenAPI Documentation
  Validate the Swagger and OpenAPI endpoints

  Scenario: Swagger UI
    When I make a GET request to "/external/docs"
    Then the response status should be 200
    And the response text should contain "SwaggerUIBundle"

  Scenario: OpenAPI JSON specification
    When I make a GET request to "/external/docs/openapi.json"
    Then the response status should be 200
    And the response should contain "info" and "paths"
