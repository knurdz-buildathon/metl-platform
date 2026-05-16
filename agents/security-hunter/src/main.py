import subprocess
import json
import os
import tempfile
import shutil
import requests
from urllib.parse import urlparse

SONARQUBE_URL = os.getenv("SONARQUBE_URL", "http://sonarqube.metl-system.svc.cluster.local:9000")
SONARQUBE_TOKEN = os.getenv("SONARQUBE_TOKEN", "")

def run_deepsec(repo_path: str) -> dict:
    """Run DeepSec security scan"""
    try:
        # Install deepsec if not present
        subprocess.run(
            ["npm", "install", "-g", "deepsec"],
            check=True,
            capture_output=True,
            cwd=repo_path,
        )
        result = subprocess.run(
            ["npx", "deepsec", "scan", "--json"],
            capture_output=True,
            text=True,
            cwd=repo_path,
        )
        return json.loads(result.stdout) if result.stdout else {"findings": []}
    except Exception as e:
        return {"error": str(e), "findings": []}


def run_sonarqube(repo_path: str, project_key: str) -> dict:
    """Run SonarQube scan"""
    try:
        # Generate token
        token = SONARQUBE_TOKEN or "admin"

        # Run sonar-scanner
        subprocess.run(
            [
                "sonar-scanner",
                f"-Dsonar.projectKey={project_key}",
                f"-Dsonar.sources=.",
                f"-Dsonar.host.url={SONARQUBE_URL}",
                f"-Dsonar.login={token}",
            ],
            check=True,
            capture_output=True,
            cwd=repo_path,
        )

        # Fetch issues
        response = requests.get(
            f"{SONARQUBE_URL}/api/issues/search",
            params={"componentKeys": project_key, "resolved": "false"},
            auth=(token, ""),
        )
        return response.json()
    except Exception as e:
        return {"error": str(e), "issues": []}


def clone_and_scan(git_url: str, tenant_id: str) -> dict:
    """Clone repo and run security scans"""
    repo_path = tempfile.mkdtemp(prefix="metl-scan-")

    try:
        # Clone repo
        subprocess.run(
            ["git", "clone", "--depth", "1", git_url, repo_path],
            check=True,
            capture_output=True,
        )

        # Run scans
        deepsec_results = run_deepsec(repo_path)
        sonar_results = run_sonarqube(repo_path, f"metl-{tenant_id}")

        return {
            "gitUrl": git_url,
            "deepsec": deepsec_results,
            "sonarqube": sonar_results,
            "summary": {
                "deepsecFindings": len(deepsec_results.get("findings", [])),
                "sonarIssues": len(sonar_results.get("issues", [])),
            },
        }
    finally:
        shutil.rmtree(repo_path, ignore_errors=True)


def main():
    """CLI entry point for testing"""
    import sys
    if len(sys.argv) < 3:
        print("Usage: python main.py <git_url> <tenant_id>")
        sys.exit(1)

    git_url = sys.argv[1]
    tenant_id = sys.argv[2]

    results = clone_and_scan(git_url, tenant_id)
    print(json.dumps(results, indent=2))


if __name__ == "__main__":
    main()
