# Verifier classification

Read this reference when determining whether verification depends on deterministic code, an LLM, an agent, or a mixture.

Harbor does not provide one universal flag proving verifier type. `tests/test.sh` can invoke arbitrary code, so classification requires reading the relevant call chain and configuration.

Official references checked on 2026-08-18:

- https://www.harborframework.com/docs/tutorials/llm-as-a-judge
- https://www.harborframework.com/docs/rewardkit

## Keep three layers

Record:

- **Declared:** what the vendor or task metadata says.
- **Observed:** what the captured files and static call chain show.
- **Resolved:** your evidence-backed classification, or `unknown`.

Do not rewrite the vendor artifact merely to make your classification visible. Put CASE's classification in the task-version metadata or a dedicated registry record and cite evidence paths.

## Resolved values

- `deterministic`: the score is produced without model or agent judgment for the inputs being evaluated.
- `llm_judge`: an LLM materially determines one or more rewards.
- `agent_judge`: an agent harness or tool-using agent materially determines one or more rewards.
- `hybrid`: deterministic and model- or agent-based criteria both materially affect the reported reward.
- `unknown`: the available static evidence does not support a defensible classification.

Classify the scoring dependency, not the programming language. A Python verifier can be deterministic; a shell script can call a model.

## Evidence to inspect

Trace from the effective `tests/test.sh` or step-specific verifier entrypoint into directly invoked files and configuration. Relevant signals include:

- `[verifier.env]` model-provider key references and model names;
- RewardKit TOML files containing `[judge]` and judge/model configuration;
- calls to RewardKit, provider SDKs, model HTTP APIs, or agent CLIs;
- local-model invocations;
- prompt, rubric, or judge-schema files;
- aggregation logic showing whether judge scores affect the final reward;
- separate verifier-environment configuration and network policy.

API-key variable names are strong signals but not proof: deterministic verifiers may use unrelated secrets, while local judges may need no provider key. Imports are also not enough if the code path never affects the score.

## Record operational requirements separately

Alongside classification, record when supported:

- `requires_model`;
- `requires_network`;
- provider and model or agent identifier;
- credential environment-variable names, never values;
- evidence paths;
- uncertainty and conflicting declarations;
- classifier or evaluator identity and version.

Example:

```json
{
  "declared": "deterministic",
  "observed": "llm_judge",
  "resolved": "llm_judge",
  "requiresModel": true,
  "requiresNetwork": true,
  "provider": "anthropic",
  "model": "claude-sonnet-4-6",
  "credentialEnvNames": ["ANTHROPIC_API_KEY"],
  "evidencePaths": [
    "task.toml",
    "tests/test.sh",
    "tests/quality.toml"
  ],
  "uncertainty": null
}
```

This classification is a static assessment. Only sandbox execution can establish actual calls, costs, nondeterminism, or successful verification.
