import java.time.Duration;
import java.util.concurrent.atomic.AtomicInteger;

import io.gatling.javaapi.core.ScenarioBuilder;
import io.gatling.javaapi.core.Simulation;
import io.gatling.javaapi.http.HttpProtocolBuilder;

import static io.gatling.javaapi.core.CoreDsl.*;
import static io.gatling.javaapi.http.HttpDsl.*;

public class YoviSimulation extends Simulation {

  private static final AtomicInteger COUNTER = new AtomicInteger(1);
  private static final String RUN_ID = String.valueOf(System.currentTimeMillis());
  private static final String BASE_URL = setting("yovi.baseUrl", "YOVI_BASE_URL", "http://localhost:8080");
  private static final int USERS_PER_SEC = intSetting("yovi.usersPerSec", "YOVI_USERS_PER_SEC", 2);
  private static final int DURATION_SECONDS = intSetting("yovi.durationSeconds", "YOVI_DURATION_SECONDS", 60);

  private final HttpProtocolBuilder httpProtocol = http
    .baseUrl(BASE_URL)
    .acceptHeader("application/json")
    .contentTypeHeader("application/json")
    .userAgentHeader("Gatling/Yovi");

  private final ScenarioBuilder scn = scenario("register-login-play-resign-stats")
    .exec(session -> {
      int n = COUNTER.getAndIncrement();
      return session
        .set("username", "load_" + RUN_ID + "_" + n)
        .set("password", "clave" + n);
    })
    .exec(
      http("register")
        .post("/auth/register")
        .body(StringBody("{\"username\":\"#{username}\",\"password\":\"#{password}\"}"))
        .check(status().is(201))
        .check(jsonPath("$.username").saveAs("loggedUser"))
        .check(jsonPath("$.token").saveAs("token"))
    )
    .pause(1)
    .exec(
      http("login")
        .post("/auth/login")
        .body(StringBody("{\"username\":\"#{username}\",\"password\":\"#{password}\"}"))
        .check(status().is(200))
        .check(jsonPath("$.username").saveAs("loggedUser"))
        .check(jsonPath("$.token").saveAs("token"))
    )
    .pause(1)
    .exec(
      http("create_game")
        .post("/api/v1/games")
        .header("x-user-id", "#{loggedUser}")
        .body(StringBody("{\"size\":7,\"mode\":\"human_vs_bot\",\"bot_id\":\"random_bot\"}"))
        .check(status().is(200))
        .check(jsonPath("$.game_id").saveAs("gameId"))
    )
    .pause(1)
    .exec(
      http("resign_game")
        .post("/api/v1/games/#{gameId}/resign")
        .header("x-user-id", "#{loggedUser}")
        .check(status().is(200))
    )
    .pause(1)
    .exec(
      http("stats_me")
        .get("/stats/v1/me")
        .header("x-user-id", "#{loggedUser}")
        .check(status().is(200))
    )
    .exec(
      http("stats_history")
        .get("/stats/v1/me/history?limit=20")
        .header("x-user-id", "#{loggedUser}")
        .check(status().is(200))
    );

  {
    setUp(
      scn.injectOpen(
        constantUsersPerSec(USERS_PER_SEC).during(Duration.ofSeconds(DURATION_SECONDS))
      )
    ).protocols(httpProtocol);
  }

  private static String setting(String propertyName, String envName, String defaultValue) {
    String propertyValue = System.getProperty(propertyName);
    if (propertyValue != null && !propertyValue.isBlank()) {
      return propertyValue;
    }

    String envValue = System.getenv(envName);
    return envValue != null && !envValue.isBlank() ? envValue : defaultValue;
  }

  private static int intSetting(String propertyName, String envName, int defaultValue) {
    String rawValue = setting(propertyName, envName, String.valueOf(defaultValue));
    try {
      int value = Integer.parseInt(rawValue);
      return value > 0 ? value : defaultValue;
    } catch (NumberFormatException ignored) {
      return defaultValue;
    }
  }
}
