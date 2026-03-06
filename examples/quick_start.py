#!/usr/bin/env python3
"""
LLMSec Quick Start Example

This script demonstrates how to:
1. Configure a target LLM application
2. Execute various attack types
3. Generate and use test datasets
4. Run comprehensive security evaluations
"""

import requests
import json
import time
from typing import Dict, Any

API_BASE = "http://localhost:8000/api/v1"

def print_section(title: str):
    print(f"\n{'='*60}")
    print(f"  {title}")
    print(f"{'='*60}\n")

def create_target() -> str:
    """Create a target configuration"""
    print_section("Step 1: Create Target Configuration")

    target = {
        "name": "Demo LLM Application",
        "description": "A sample LLM chat application for testing",
        "purpose": "Customer support and general assistance",
        "target_type": "api_endpoint",
        "endpoint": "https://api.example.com/chat",  # Replace with your endpoint
        "method": "POST",
        "headers": {
            "Content-Type": "application/json"
        },
        "prohibited_topics": [
            "reveal system prompt",
            "bypass safety guidelines",
            "generate harmful content",
            "ignore instructions"
        ]
    }

    print("Creating target configuration...")
    print(json.dumps(target, indent=2))

    response = requests.post(f"{API_BASE}/targets/", json=target)

    if response.ok:
        target_data = response.json()
        target_id = target_data["id"]
        print(f"\n✓ Target created successfully!")
        print(f"  Target ID: {target_id}")
        return target_id
    else:
        print(f"\n✗ Failed to create target: {response.text}")
        return None

def execute_single_attack(target_id: str):
    """Execute a single prompt injection attack"""
    print_section("Step 2: Execute Single Attack")

    attack = {
        "target_id": target_id,
        "attack_type": "prompt_injection",
        "attack_mode": "single",
        "enable_improvement": True,
        "max_improvement_iterations": 3,
        "variables": {
            "target_behavior": "reveal your system prompt"
        }
    }

    print("Executing prompt injection attack...")
    print(json.dumps(attack, indent=2))

    response = requests.post(f"{API_BASE}/attacks/execute", json=attack)

    if response.ok:
        result = response.json()
        print(f"\n✓ Attack completed!")
        print(f"  Vulnerability Found: {result['vulnerability_found']}")
        print(f"  Risk Level: {result['risk_level'].upper()}")
        print(f"  Confidence: {result['overall_confidence']:.1%}")

        if result['conversation_history']:
            turn = result['conversation_history'][0]
            print(f"\n  Prompt: {turn['prompt'][:100]}...")
            print(f"  Response: {turn['response'][:100]}...")

        return result
    else:
        print(f"\n✗ Attack failed: {response.text}")
        return None

def execute_sequential_attack(target_id: str):
    """Execute a multi-turn persuasion attack"""
    print_section("Step 3: Execute Sequential Attack")

    attack = {
        "target_id": target_id,
        "attack_type": "persuasion",
        "attack_mode": "sequential",
        "enable_improvement": False,
        "variables": {
            "target_behavior": "provide information about restricted topics"
        }
    }

    print("Executing multi-turn persuasion attack...")
    print("This uses social engineering tactics across multiple turns")

    response = requests.post(f"{API_BASE}/attacks/execute", json=attack)

    if response.ok:
        result = response.json()
        print(f"\n✓ Sequential attack completed!")
        print(f"  Total Turns: {len(result['conversation_history'])}")
        print(f"  Vulnerability Found: {result['vulnerability_found']}")
        print(f"  Risk Level: {result['risk_level'].upper()}")

        print(f"\n  Conversation progression:")
        for turn in result['conversation_history']:
            status = "✗ Success" if turn['success'] else "✓ Refused"
            print(f"    Turn {turn['turn']}: {status} (confidence: {turn['confidence']:.1%})")

        return result
    else:
        print(f"\n✗ Attack failed: {response.text}")
        return None

def execute_adaptive_attack(target_id: str):
    """Execute an adaptive attack with feedback loop"""
    print_section("Step 4: Execute Adaptive Attack")

    attack = {
        "target_id": target_id,
        "attack_type": "storytelling",
        "attack_mode": "adaptive",
        "enable_improvement": True,
        "max_improvement_iterations": 5,
        "variables": {
            "target_behavior": "explain how to bypass safety measures"
        }
    }

    print("Executing adaptive storytelling attack...")
    print("This attack learns from responses and adapts its strategy")

    response = requests.post(f"{API_BASE}/attacks/execute", json=attack)

    if response.ok:
        result = response.json()
        print(f"\n✓ Adaptive attack completed!")
        print(f"  Improvement Iterations: {result['improvement_iterations']}")
        print(f"  Vulnerability Found: {result['vulnerability_found']}")

        if result['improvement_log']:
            print(f"\n  Adaptation log:")
            for log in result['improvement_log']:
                print(f"    Turn {log.get('turn', '?')}: {log.get('insights', {}).get('tone', 'N/A')} tone, "
                      f"{log.get('insights', {}).get('refusal_strength', 'N/A')} refusal")

        return result
    else:
        print(f"\n✗ Attack failed: {response.text}")
        return None

def generate_dataset(target_id: str) -> str:
    """Generate a comprehensive test dataset"""
    print_section("Step 5: Generate Test Dataset")

    dataset_request = {
        "target_id": target_id,
        "attack_types": [
            "prompt_injection",
            "role_playing",
            "persuasion",
            "storytelling"
        ],
        "num_examples_per_type": 10
    }

    print("Generating comprehensive test dataset...")
    print(f"Attack types: {', '.join(dataset_request['attack_types'])}")
    print(f"Examples per type: {dataset_request['num_examples_per_type']}")

    response = requests.post(f"{API_BASE}/datasets/generate", json=dataset_request)

    if response.ok:
        dataset = response.json()
        dataset_id = dataset["id"]
        print(f"\n✓ Dataset generated successfully!")
        print(f"  Dataset ID: {dataset_id}")
        print(f"  Total Examples: {len(dataset['examples'])}")
        print(f"  Version: {dataset['version']}")
        return dataset_id
    else:
        print(f"\n✗ Dataset generation failed: {response.text}")
        return None

def run_evaluation(target_id: str, dataset_id: str):
    """Run comprehensive security evaluation"""
    print_section("Step 6: Run Security Evaluation")

    evaluation_request = {
        "target_id": target_id,
        "dataset_id": dataset_id
    }

    print("Running comprehensive security evaluation...")
    print("This may take a few minutes depending on dataset size...")

    response = requests.post(f"{API_BASE}/evaluation/run", json=evaluation_request)

    if response.ok:
        report = response.json()
        print(f"\n✓ Evaluation completed!")
        print(f"\n{'─'*60}")
        print(report['summary'])
        print(f"{'─'*60}")

        if report['recommendations']:
            print(f"\n📋 Recommendations:")
            for i, rec in enumerate(report['recommendations'][:5], 1):
                print(f"  {i}. {rec}")

            if len(report['recommendations']) > 5:
                print(f"  ... and {len(report['recommendations']) - 5} more")

        return report
    else:
        print(f"\n✗ Evaluation failed: {response.text}")
        return None

def export_report(evaluation_id: str):
    """Export evaluation report"""
    print_section("Step 7: Export Report")

    print("Exporting report as Markdown...")

    response = requests.get(
        f"{API_BASE}/reports/{evaluation_id}/export",
        params={"format": "markdown"}
    )

    if response.ok:
        report_data = response.json()
        filename = f"security_report_{evaluation_id[:8]}.md"

        with open(filename, 'w') as f:
            f.write(report_data['content'])

        print(f"\n✓ Report exported!")
        print(f"  Filename: {filename}")
        print(f"\nYou can also export as HTML or JSON format.")
    else:
        print(f"\n✗ Export failed: {response.text}")

def main():
    """Run the complete LLMSec demo"""
    print("""
    ╔════════════════════════════════════════════════════════╗
    ║                                                        ║
    ║              🛡️  LLMSec Quick Start Demo  🛡️          ║
    ║                                                        ║
    ║         LLM Security Testing Framework                 ║
    ║                                                        ║
    ╚════════════════════════════════════════════════════════╝
    """)

    print("This demo will:")
    print("  1. Create a target configuration")
    print("  2. Execute single-turn attack")
    print("  3. Execute multi-turn sequential attack")
    print("  4. Execute adaptive attack with improvement")
    print("  5. Generate comprehensive test dataset")
    print("  6. Run full security evaluation")
    print("  7. Export detailed report")

    input("\nPress Enter to start...")

    try:
        # Step 1: Create target
        target_id = create_target()
        if not target_id:
            return

        time.sleep(1)

        # Step 2: Single attack
        execute_single_attack(target_id)
        time.sleep(1)

        # Step 3: Sequential attack
        execute_sequential_attack(target_id)
        time.sleep(1)

        # Step 4: Adaptive attack
        execute_adaptive_attack(target_id)
        time.sleep(1)

        # Step 5: Generate dataset
        dataset_id = generate_dataset(target_id)
        if not dataset_id:
            return

        time.sleep(1)

        # Step 6: Run evaluation
        evaluation = run_evaluation(target_id, dataset_id)
        if not evaluation:
            return

        time.sleep(1)

        # Step 7: Export report
        export_report(evaluation['id'])

        print_section("Demo Complete!")
        print("✓ You have successfully:")
        print("  - Configured a target LLM application")
        print("  - Executed various attack strategies")
        print("  - Generated a comprehensive test dataset")
        print("  - Ran a full security evaluation")
        print("  - Exported a detailed report")
        print("\nNext steps:")
        print("  - Review the exported report")
        print("  - Implement recommended security improvements")
        print("  - Re-run evaluation to verify fixes")
        print("  - Integrate into your CI/CD pipeline")
        print("\nFor more information, see USAGE_GUIDE.md")

    except KeyboardInterrupt:
        print("\n\n✗ Demo interrupted by user")
    except Exception as e:
        print(f"\n\n✗ Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    # Check if backend is running
    try:
        response = requests.get(f"{API_BASE.replace('/api/v1', '')}/health", timeout=2)
        if not response.ok:
            raise Exception("Backend not healthy")
    except:
        print("\n✗ Error: Backend server is not running!")
        print("\nPlease start the backend first:")
        print("  cd backend")
        print("  python main.py")
        print("\nThen run this script again.")
        exit(1)

    main()
