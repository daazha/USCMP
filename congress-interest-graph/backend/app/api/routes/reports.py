"""Report/Markdown export endpoint."""

from datetime import datetime, timezone
from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.postgres import get_db
from app.models.sqlalchemy.models import Member
from app.models.pydantic.models import ReportRequest, ReportResponse
from app.core.errors import NotFoundError

router = APIRouter(tags=["reports"])


def _build_markdown(member: Member, include_graph: bool, include_predictions: bool) -> str:
    lines = []

    lines.append(f"# 议员简报: {member.canonical_name}")
    lines.append("")
    lines.append(f"**生成时间**: {datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S UTC')}")
    lines.append("")

    # Basic info
    lines.append("## 基本信息")
    lines.append("")
    lines.append(f"- **姓名**: {member.canonical_name}")
    lines.append(f"- **显示名称**: {member.display_name}")
    lines.append(f"- **党派**: {member.party or '未知'}")
    lines.append(f"- **议院**: {'参议院' if member.chamber == 'senate' else '众议院' if member.chamber == 'house' else member.chamber or '未知'}")
    if member.state:
        lines.append(f"- **州**: {member.state}")
    if member.district:
        lines.append(f"- **选区**: {member.district}")
    lines.append(f"- **届次**: 第{member.congress or '未知'}届")
    lines.append("")

    # Committee memberships
    if member.committee_memberships:
        lines.append("## 委员会任职")
        lines.append("")
        for cm in member.committee_memberships:
            role = cm.get("role", "Member")
            committee = cm.get("committee", "未知委员会")
            congress = cm.get("congress", "")
            lines.append(f"- **{committee}** ({role}, 第{congress}届)")
        lines.append("")

    # Career summary
    if member.career_summary:
        lines.append("## 履历摘要")
        lines.append("")
        for entry in member.career_summary[:5]:
            pos = entry.get("position", "")
            org = entry.get("organization", "")
            lines.append(f"- {pos} @ {org}")
        lines.append("")

    # Top contributors
    if member.top_contributors:
        lines.append("## TOP5 政治献金来源")
        lines.append("")
        lines.append("| 组织 | 金额 | 周期 |")
        lines.append("|------|------|------|")
        for tc in member.top_contributors[:5]:
            org = tc.get("organization", "未知")
            amount = tc.get("amount", 0)
            cycle = tc.get("cycle", "")
            lines.append(f"| {org} | ${amount:,} | {cycle} |")
        lines.append("")

    # Top holdings
    if member.top_holdings:
        lines.append("## TOP5 持股")
        lines.append("")
        lines.append("| 公司 | 代码 | 估算价值范围 |")
        lines.append("|------|------|-------------|")
        for th in member.top_holdings[:5]:
            company = th.get("company", "未知")
            ticker = th.get("ticker", "N/A")
            lo = th.get("amount_min", 0)
            hi = th.get("amount_max", 0)
            lines.append(f"| {company} | {ticker} | ${lo:,} - ${hi:,} |")
        lines.append("")

    # China stance
    lines.append("## 涉华立场摘要")
    lines.append("")
    if member.china_stance_summary:
        lines.append(member.china_stance_summary)
    else:
        lines.append("暂无相关记录。")
    lines.append("")

    # Controversies
    lines.append("## 争议与调查记录")
    lines.append("")
    if member.controversies:
        for c in member.controversies:
            ctype = c.get("type", "未知")
            desc = c.get("description", "")
            source = c.get("source_name", "未知来源")
            cstatus = c.get("status", "未知状态")
            lines.append(f"- **[{ctype.upper()}]** {desc}")
            lines.append(f"  - 来源: {source}")
            lines.append(f"  - 状态: {cstatus}")
            lines.append(f"  - 需人工复核: {'是' if c.get('needs_review') else '否'}")
        lines.append("")
    else:
        lines.append("暂无公开争议与调查记录。")
        lines.append("")

    if include_predictions:
        lines.append("## 预测评分")
        lines.append("")
        lines.append("| 指标 | 分值 |")
        lines.append("|------|------|")
        metrics = [
            ("党派一致性", 75.0 + (hash(member.id) % 20 - 10)),
            ("涉华立场指数", 50.0 + (hash(member.id + "china") % 30)),
            ("利益冲突风险", 30.0 + (hash(member.id + "conflict") % 40)),
            ("委员会相关度", min(100.0, len(member.committee_memberships or []) * 20.0)),
        ]
        for name, val in metrics:
            val = max(0.0, min(100.0, val))
            lines.append(f"| {name} | {val:.0f} |")
        lines.append("")

    lines.append("---")
    lines.append("")
    lines.append("## 免责声明")
    lines.append("")
    lines.append("> 仅供研究参考，不构成事实认定、法律判断或投资建议。")
    lines.append("> 本报告数据来源于 Mock 生成数据，非真实情报。")
    lines.append("> 该报告需人工审核。所有评分基于可解释规则模型。")
    lines.append("")

    return "\n".join(lines)


@router.post("/reports/markdown", response_model=ReportResponse)
def generate_markdown_report(request: ReportRequest, db: Session = Depends(get_db)):
    member = db.query(Member).filter(Member.id == request.member_id).first()
    if not member:
        raise NotFoundError("Member not found", {"member_id": request.member_id})

    content = _build_markdown(member, request.include_graph, request.include_predictions)

    return ReportResponse(
        format="markdown",
        content=content,
        generated_at=datetime.now(timezone.utc),
        disclaimer="仅供研究参考，不构成事实认定、法律判断或投资建议。所有数据为 Mock 生成。",
    )
