---
description: Build Docker image, start container, and run full browser test of all features
---
Test the boerenbridge app end-to-end:
1. docker build -t boerenbridge .
2. Start container on port 8080
3. Use playwright-cli to click through all features (new game, bidding with blinde regel, results, scoreboard, end game)
4. Report PASS/FAIL per feature with screenshots of failures
