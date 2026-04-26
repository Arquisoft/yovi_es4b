Feature: Game Lifecycle
  Validate the game creation, moves, and resignation lifecycle

  Scenario: Full game lifecycle
    Given a logged in user
    When I create a new game with size 3, mode "human_vs_bot", and bot_id "random_bot"
    Then the game should be created successfully and not be over
    When I get the game state
    Then the response status should be 200
    When I make a move at x=2, y=0, z=0
    Then the response status should indicate success or valid turn
    When I resign the game
    Then the resign response should be successful

  Scenario: Invalid move on an already occupied square (own piece)
    Given a logged in user
    When I create a new game with size 3, mode "human_vs_bot", and bot_id "random_bot"
    Then the game should be created successfully and not be over
    When I make a move at x=2, y=0, z=0
    Then the response status should indicate success or valid turn
    When I make a move at x=2, y=0, z=0
    Then the response status should be 409
    And the response should include an occupied-cell explanation

  Scenario: Invalid move on an already occupied square (opponent piece)
    Given a logged in user
    When I create a new game with size 3, mode "human_vs_bot", and bot_id "random_bot"
    Then the game should be created successfully and not be over
    When I make a move at x=2, y=0, z=0
    Then the response status should indicate success or valid turn
    When I get the game state and move on the opponent's square
    Then the response status should be 409
    And the response should include an occupied-cell explanation
