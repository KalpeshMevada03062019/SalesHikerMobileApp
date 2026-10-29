# Test data

There are no committed data files. Every value a flow needs comes from `config\.env`, which is git-ignored. The run scripts pass those values to Maestro as `MAESTRO_*` shell variables, so they never appear on a command line.

| `config\.env` key | Flow variable | Used by | Notes |
|---|---|---|---|
| `APP_ID` | `MAESTRO_APP_ID` | every flow | Defaults to `com.saleshiker.app` inside the flows, so MCP and plain `maestro test` runs work too |
| `TEST_USERNAME` | `MAESTRO_TEST_USERNAME` | `common/login.yaml`, `SMK-02` | Dedicated **beta** QA account. Never a real customer |
| `TEST_PASSWORD` | `MAESTRO_TEST_PASSWORD` | `common/login.yaml`, `SMK-02` | When this or the username is empty, flows tagged `requires-login` are reported as SKIPPED |
| (runner) | `MAESTRO_RECORD` | recording hooks | `true` when a script is run with `-Record` |

## Fixed values inside flows

These are deliberately fake and safe to commit:

| Value | Purpose |
|---|---|
| `qa.nonexistent.user@example.com` / `WrongPassword123` | Unknown-account case (`REG-AUTH-01`). `example.com` is reserved, so it can never be a real user |
| `qa.user@example.com` | Well-formed address for field validation. It is never submitted with a password |
| `not-an-email` | Malformed-email case |
| `Secret123` | Password-visibility checks. It is never submitted with a valid email |

## Rules

- Use a dedicated test account on the beta backend (`accountsbeta.saleshiker.com`). Do not use personal or production accounts.
- To add a new variable, add it to `config\.env.example` with an empty value and a comment. Then expose it in `Invoke-MaestroRun` (`scripts\_common.ps1`) as `MAESTRO_<NAME>`.
- Maestro writes every typed value to `commands.json` and `maestro.log` (verified). After each run, the runner replaces the configured `TEST_PASSWORD` with `***REDACTED***` in the run folder's text files. The username and screenshots are not redacted, so still treat `reports\` as sensitive.
