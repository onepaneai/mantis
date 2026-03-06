"""
API routes for report generation and export
"""
from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import FileResponse
from typing import Literal
import json
from pathlib import Path

from core.database import get_db
from sqlalchemy.orm import Session
from core.db_models import DBEvaluationReport
from core.models import EvaluationReport, EvaluationMetrics

router = APIRouter()

@router.get("/{evaluation_id}/export")
async def export_report(
    evaluation_id: str,
    format: Literal["json", "html", "markdown"] = "json",
    db: Session = Depends(get_db)
):
    """Export evaluation report in various formats"""

    db_rep = db.query(DBEvaluationReport).filter(DBEvaluationReport.id == evaluation_id).first()
    if not db_rep:
        raise HTTPException(status_code=404, detail="Evaluation not found")

    metrics = EvaluationMetrics(**db_rep.metrics) if db_rep.metrics else None
        
    rep_dict = {
        "id": db_rep.id,
        "target_id": db_rep.target_id,
        "dataset_id": db_rep.dataset_id,
        "started_at": db_rep.started_at,
        "completed_at": db_rep.completed_at,
        "metrics": metrics,
        "detailed_results": db_rep.detailed_results if db_rep.detailed_results else [],
        "recommendations": db_rep.recommendations if db_rep.recommendations else [],
        "summary": db_rep.summary if db_rep.summary else ""
    }
    report = EvaluationReport(**rep_dict)

    if format == "json":
        return report

    elif format == "markdown":
        return {
            "content": _generate_markdown_report(report),
            "filename": f"report_{evaluation_id}.md"
        }

    elif format == "html":
        return {
            "content": _generate_html_report(report),
            "filename": f"report_{evaluation_id}.html"
        }

def _generate_markdown_report(report) -> str:
    """Generate Markdown report"""

    md = f"# Security Evaluation Report\n\n"
    md += f"**Report ID**: {report.id}\n"
    md += f"**Target ID**: {report.target_id}\n"
    md += f"**Started**: {report.started_at}\n"
    md += f"**Completed**: {report.completed_at}\n\n"

    md += "## Summary\n\n"
    md += report.summary + "\n\n"

    md += "## Metrics\n\n"
    md += f"- **Total Tests**: {report.metrics.total_tests}\n"
    md += f"- **Successful Attacks**: {report.metrics.successful_attacks}\n"
    md += f"- **Failed Attacks**: {report.metrics.failed_attacks}\n"
    md += f"- **Success Rate**: {report.metrics.success_rate:.1%}\n\n"

    if report.metrics.vulnerabilities_by_type:
        md += "### Vulnerabilities by Type\n\n"
        for attack_type, count in report.metrics.vulnerabilities_by_type.items():
            md += f"- **{attack_type}**: {count}\n"
        md += "\n"

    if report.metrics.risk_distribution:
        md += "### Risk Distribution\n\n"
        for risk, count in report.metrics.risk_distribution.items():
            md += f"- **{risk.upper()}**: {count}\n"
        md += "\n"

    if report.recommendations:
        md += "## Recommendations\n\n"
        for i, rec in enumerate(report.recommendations, 1):
            md += f"{i}. {rec}\n\n"

    md += "## Detailed Results\n\n"
    for i, result in enumerate(report.detailed_results, 1):
        md += f"### Test {i}: {result.attack_type.value}\n\n"
        md += f"- **Vulnerability Found**: {result.vulnerability_found}\n"
        md += f"- **Risk Level**: {result.risk_level}\n"
        if result.vulnerability_description:
            md += f"- **Description**: {result.vulnerability_description}\n"
        md += f"- **Turns**: {len(result.conversation_history)}\n\n"

    return md

def _generate_html_report(report) -> str:
    """Generate HTML report"""

    html = f"""
<!DOCTYPE html>
<html>
<head>
    <title>Security Evaluation Report</title>
    <style>
        body {{
            font-family: Arial, sans-serif;
            max-width: 1200px;
            margin: 0 auto;
            padding: 20px;
            background: #f5f5f5;
        }}
        .header {{
            background: #2c3e50;
            color: white;
            padding: 20px;
            border-radius: 5px;
            margin-bottom: 20px;
        }}
        .section {{
            background: white;
            padding: 20px;
            margin-bottom: 20px;
            border-radius: 5px;
            box-shadow: 0 2px 4px rgba(0,0,0,0.1);
        }}
        .metric {{
            display: inline-block;
            margin: 10px 20px 10px 0;
        }}
        .metric-label {{
            font-weight: bold;
            color: #7f8c8d;
        }}
        .metric-value {{
            font-size: 24px;
            color: #2c3e50;
        }}
        .risk-critical {{ color: #e74c3c; }}
        .risk-high {{ color: #e67e22; }}
        .risk-medium {{ color: #f39c12; }}
        .risk-low {{ color: #27ae60; }}
        .recommendation {{
            background: #ecf0f1;
            padding: 10px;
            margin: 10px 0;
            border-left: 4px solid #3498db;
        }}
        table {{
            width: 100%;
            border-collapse: collapse;
        }}
        th, td {{
            padding: 10px;
            text-align: left;
            border-bottom: 1px solid #ddd;
        }}
        th {{
            background: #34495e;
            color: white;
        }}
    </style>
</head>
<body>
    <div class="header">
        <h1>Security Evaluation Report</h1>
        <p>Report ID: {report.id}</p>
        <p>Target ID: {report.target_id}</p>
        <p>Completed: {report.completed_at}</p>
    </div>

    <div class="section">
        <h2>Metrics Overview</h2>
        <div class="metric">
            <div class="metric-label">Total Tests</div>
            <div class="metric-value">{report.metrics.total_tests}</div>
        </div>
        <div class="metric">
            <div class="metric-label">Vulnerabilities</div>
            <div class="metric-value risk-high">{report.metrics.successful_attacks}</div>
        </div>
        <div class="metric">
            <div class="metric-label">Success Rate</div>
            <div class="metric-value">{report.metrics.success_rate:.1%}</div>
        </div>
    </div>

    <div class="section">
        <h2>Summary</h2>
        <pre>{report.summary}</pre>
    </div>

    <div class="section">
        <h2>Recommendations</h2>
"""

    for i, rec in enumerate(report.recommendations, 1):
        html += f'<div class="recommendation">{i}. {rec}</div>\n'

    html += """
    </div>

    <div class="section">
        <h2>Detailed Results</h2>
        <table>
            <tr>
                <th>Test #</th>
                <th>Attack Type</th>
                <th>Vulnerability</th>
                <th>Risk Level</th>
                <th>Turns</th>
            </tr>
"""

    for i, result in enumerate(report.detailed_results, 1):
        risk_class = f"risk-{result.risk_level}"
        html += f"""
            <tr>
                <td>{i}</td>
                <td>{result.attack_type.value}</td>
                <td>{"Yes" if result.vulnerability_found else "No"}</td>
                <td class="{risk_class}">{result.risk_level.upper()}</td>
                <td>{len(result.conversation_history)}</td>
            </tr>
"""

    html += """
        </table>
    </div>
</body>
</html>
"""

    return html
