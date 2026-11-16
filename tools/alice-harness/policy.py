import re
import yaml
from pathlib import Path
from typing import Any

def load_policy(repo: Path) -> dict[str, Any]:
    """
    Loads the guardrail policy.
    First loads policy.default.yaml (next to policy.py),
    then overrides with <repo>/.agents/policy.yaml if it exists.
    """
    base_path = Path(__file__).parent
    default_path = base_path / "policy.default.yaml"
    
    if not default_path.exists():
        raise FileNotFoundError(f"Default policy file not found at {default_path}")

    with open(default_path, "r") as f:
        policy = yaml.safe_load(f)

    repo_policy_path = repo / ".agents" / "policy.yaml"
    if repo_policy_path.exists():
        with open(repo_policy_path, "r") as f:
            repo_config = yaml.safe_load(f)
            if not repo_config:
                return policy
            
            # Validate keys
            allowed_keys = {"officialDomains", "denyRead", "protectedWrite", "forbiddenAdded"}
            if "limits" in repo_config:
                raise ValueError("limits não é mais da política: os tamanhos saem de cards.size_model (erro 15)")
            for key in repo_config:
                if key not in allowed_keys:
                    raise ValueError(f"Unknown policy key: {key}")

            # Lists are replaced
            for key in ["officialDomains", "denyRead", "protectedWrite", "forbiddenAdded"]:
                if key in repo_config:
                    policy[key] = repo_config[key]

    # Ensure forbiddenAdded is a list of (label, compiled re.Pattern)
    if "forbiddenAdded" in policy:
        new_forbidden = []
        for item in policy["forbiddenAdded"]:
            if isinstance(item, dict) and "label" in item and "pattern" in item:
                label = item["label"]
                pattern = item["pattern"]
                try:
                    compiled = re.compile(pattern)
                    new_forbidden.append((label, compiled))
                except re.error as e:
                    raise ValueError(f"Invalid regex for {label}: {e}")
            else:
                # If it's already a tuple (from default or previous logic)
                if isinstance(item, tuple) and len(item) == 2 and isinstance(item[1], re.Pattern):
                    new_forbidden.append(item)
                else:
                    raise ValueError("forbiddenAdded items must be dicts with 'label' and 'pattern' or tuples of (label, Pattern)")
        policy["forbiddenAdded"] = new_forbidden

    return policy
