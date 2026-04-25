Feature: Bot Catalog
  Validate the bot catalog endpoints of the Gateway

  Scenario: Retrieve the bot catalog
    When I make a GET request to "/external/v1/bots"
    Then the response status should be 200
    And the response should have a "default_bot_id"
    And the response should have a list of "items" with at least 1 bot
    And each bot in the list should have "bot_id", "strategy", and "description"
