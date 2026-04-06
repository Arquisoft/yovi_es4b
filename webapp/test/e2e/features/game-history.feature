Feature: Match history lifecycle
  Ensure finished matches are persisted in the history view and active matches survive sidebar navigation

  Scenario: Played and resigned match is stored in history
    Given I am authenticated with a mocked game and stats backend
    When I start a new match
    And I play one move in the active match
    And I resign the active match
    And I open the stats view
    Then I should see the latest match in history
    And the latest match should have result "Derrota"

  Scenario: Navigating away from an active match keeps it available
    Given I am authenticated with a mocked game and stats backend
    When I start a new match
    And I leave the active match using the sidebar
    Then I should still be able to resume the active match
