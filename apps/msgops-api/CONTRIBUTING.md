# How to contribute

## Requirements

- git
- sonar
- docker
- docker-compose

## Authoring

Add your name and mail to the contributors object inside the package.json.

## Development

Install all dependencies, using: `npm install`.

You must create test cases, run eslint and sonar.

_Don't forget to add all endpoint to the openapi.json!_

## Sonar

Run `docker-compose up -d` inside `./test` and change the "token" property from the `sonar-project.ts`.

## Testing

If you want or need to create unit tests, add your file `example.spec.ts` inside the `./test/`.

Run the test environment and the specs using: `npm test`.

## Pre Commit

Before commiting anything, run: `npm run lint && npm run test:cov && npm run sonar`.
