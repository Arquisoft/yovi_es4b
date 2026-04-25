Feature: Metrics
  Validate the Prometheus metrics endpoint

  Scenario: Retrieve metrics
    When I make a GET request to "/health"
    And I make a GET request to "/metrics"
    Then the response status should be 200
    And the response text should contain "yovi_http_requests_total"
    And the response text should contain "yovi_process_uptime_seconds"
