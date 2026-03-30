/**
 * run-test.js — Template Test Runner Script
 *
 * Được sử dụng bởi Phase 6 (Unit Testing System).
 * Script này là wrapper được gọi TRƯỚC khi chạy `npx hardhat test`.
 * Mục đích: setup môi trường và capture kết quả vào result.json.
 *
 * Trong Phase 3, file này chỉ cần tồn tại (Phase 6 sẽ hoàn thiện).
 * sandboxService sẽ gọi trực tiếp: `npx hardhat test --config /app/project/hardhat.config.js`
 * và parse stdout của Mocha.
 *
 * Output format (ghi vào /app/project/test-result.json):
 * {
 *   "success": true,
 *   "summary": {
 *     "total": 5,
 *     "passing": 4,
 *     "failing": 1,
 *     "duration": 1234
 *   },
 *   "tests": [
 *     { "title": "Should set the owner", "status": "passing", "duration": 45 },
 *     { "title": "Should revert", "status": "failing", "error": "AssertionError: ..." }
 *   ]
 * }
 */

const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");

const RESULT_PATH = path.join("/app/project", "test-result.json");

function parseTestOutput(stdout) {
  const lines = stdout.split("\n");
  const tests = [];
  let passing = 0;
  let failing = 0;
  let duration = 0;

  for (const line of lines) {
    // Match passing: "    ✓ Should do something (45ms)"
    const passMatch = line.match(/^\s+✓\s+(.+?)(?:\s+\((\d+)ms\))?$/);
    if (passMatch) {
      tests.push({
        title: passMatch[1].trim(),
        status: "passing",
        duration: passMatch[2] ? parseInt(passMatch[2]) : 0,
      });
      passing++;
    }

    // Match failing: "    1) Should revert with error"
    const failMatch = line.match(/^\s+\d+\)\s+(.+)$/);
    if (failMatch && !line.includes("passing") && !line.includes("failing")) {
      tests.push({
        title: failMatch[1].trim(),
        status: "failing",
        error: "",
      });
      failing++;
    }

    // Match duration: "  5 passing (1s)" or "  3 passing (234ms)"
    const durationMatch = line.match(/(\d+)\s+passing\s+\((\d+)(ms|s)\)/);
    if (durationMatch) {
      duration =
        durationMatch[3] === "s"
          ? parseInt(durationMatch[2]) * 1000
          : parseInt(durationMatch[2]);
    }
  }

  return { total: passing + failing, passing, failing, duration, tests };
}

function main() {
  try {
    const configPath = "/app/project/hardhat.config.js";

    console.log("[run-test.js] Running Hardhat tests...");

    let stdout = "";
    let success = true;

    try {
      stdout = execSync(
        `npx hardhat test --config ${configPath}`,
        { encoding: "utf-8", cwd: "/app" }
      );
    } catch (err) {
      // execSync throws when exit code != 0 (test failures)
      stdout = err.stdout || "";
      success = false;
    }

    console.log(stdout);

    const summary = parseTestOutput(stdout);
    const result = {
      success: summary.failing === 0,
      summary,
      rawOutput: stdout,
    };

    fs.writeFileSync(RESULT_PATH, JSON.stringify(result, null, 2), "utf-8");
    console.log("[run-test.js] Test result written to", RESULT_PATH);

    process.exit(summary.failing > 0 ? 1 : 0);
  } catch (err) {
    const result = {
      success: false,
      error: err.message,
      details: err.stack,
    };
    fs.writeFileSync(RESULT_PATH, JSON.stringify(result, null, 2), "utf-8");
    console.error("[run-test.js] Fatal error:", err.message);
    process.exit(1);
  }
}

main();
