Feature: Match history lifecycle
  Ensure finished or abandoned matches are persisted in the history view

  Scenario: Played and resigned match is stored in history
    Given I am authenticated with a mocked game and stats backend
    When I start a new match
    And I play one move in the active match
    And I resign the active match
    And I open the stats view
    Then I should see the latest match in history
    And the latest match should have result "Derrota"

  Scenario: Abandoning an active match stores it in history
    Given I am authenticated with a mocked game and stats backend
    When I start a new match
    And I abandon the active match from the sidebar
    And I open the stats view
    Then I should see the latest match in history
    And the latest match should have result "Derrota"