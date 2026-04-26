Feature: Play Endpoint
  Validate the bot play (move generation) endpoint

  Background:
    Given an empty board position of size 3

  Scenario: Play with default bot
    When I request a move for the board position
    Then the response status should be 200
    And the response should contain valid "coords" (x, y, z)

  Scenario: Play with explicit bot_id
    When I request a move for the board position using bot_id "random_bot"
    Then the response status should be 200
    And the response should contain valid "coords" (x, y, z)

  Scenario: Play with strategy parameter
    When I request a move for the board position using strategy "random"
    Then the response status should be 200
    And the response should contain valid "coords" (x, y, z)

  Scenario: Missing position parameter
    When I request a move without the position parameter
    Then the response status should be 400
    And the response should contain an error message about missing position

  Scenario: Invalid position JSON
    When I request a move with invalid JSON as position
    Then the response status should be 400
    And the response should contain an error message about invalid JSON

  Scenario: Position size is invalid
    Given a board position with invalid size
    When I request a move for the board position
    Then the response status should be 400
    And the response should contain an error message about size

  Scenario: Bot resigns
    Given a board position where the bot must resign
    When I request a move for the board position
    Then the response status should be 200
    And the response should contain valid "coords" (x, y, z)
