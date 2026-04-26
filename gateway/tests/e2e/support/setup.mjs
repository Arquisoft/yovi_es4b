import { setWorldConstructor, setDefaultTimeout } from '@cucumber/cucumber';

setDefaultTimeout(10000);

class CustomWorld {
  constructor() {
    this.GATEWAY_URL = process.env.GATEWAY_URL ?? 'http://localhost:8080';
    this.response = null;
    this.responseText = null;
    this.responseBody = null;
    this.token = null;
    this.username = null;
    this.password = null;
    this.boardPosition = null;
    this.gameId = null;
  }
}

setWorldConstructor(CustomWorld);
