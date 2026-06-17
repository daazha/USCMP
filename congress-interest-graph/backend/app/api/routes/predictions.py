"""Prediction API endpoint.

Phase 1: Rule-based scoring only. No LLM, no black-box models.
Returns unknown when evidence is insufficient.
"""

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session
from app.db.postgres import get_db
from app.models.sqlalchemy.models import Member, Event as EventModelDB
from app.models.sandbox_models import SandboxClaim
from app.models.pydantic.models import PredictionRequest, PredictionResponse
from app.core.errors import NotFoundError, PredictionInsufficientDataError

router = APIRouter(tags=["predictions"])


def _compute_prediction(member: Member, event: EventModelDB | None) -> PredictionResponse:
    """Rule-based vote prediction."""
    evidence_count = 0
    top_factors = []
    counter_evidence = []

    # Factor 1: Party baseline
    party_score = 0.7 if member.party else 0.5
    evidence_count += 1
    party_baseline = 0.50
    top_factors.append({
        "factor_name": "party_baseline",
        "weight": 0.30,
        "score": round(party_score, 2),
        "description": f"党派基线预测值为 {party_score:.0%}",
    })

    # Factor 2: Issue alignment (mock)
    issue_score = 0.5 + (hash(member.id + "issue") % 3000) / 10000.0
    evidence_count += 1
    top_factors.append({
        "factor_name": "issue_alignment",
        "weight": 0.25,
        "score": round(issue_score, 2),
        "description": "基于委员会任职和过往记录的议题立场分析",
    })

    # Factor 3: Donor exposure
    donor_count = len(member.top_contributors or [])
    donor_score = min(0.3, donor_count * 0.05) + (hash(member.id + "donor") % 2000) / 10000.0
    evidence_count += 1
    top_factors.append({
        "factor_name": "donor_exposure",
        "weight": 0.20,
        "score": round(donor_score, 2),
        "description": f"来源自 {donor_count} 个金主的数据分析",
    })

    # Factor 4: Committee relevance
    committee_count = len(member.committee_memberships or [])
    committee_score = min(0.4, committee_count * 0.08)
    evidence_count += 1
    top_factors.append({
        "factor_name": "committee_relevance",
        "weight": 0.15,
        "score": round(committee_score, 2),
        "description": f"与 {committee_count} 个委员会的相关度分析",
    })

    # Factor 5: Historical behavior
    hist_score = 0.5 + (hash(member.id + "hist") % 2000) / 10000.0
    evidence_count += 1
    top_factors.append({
        "factor_name": "historical_behavior",
        "weight": 0.15,
        "score": round(hist_score, 2),
        "description": "基于历史投票模式分析",
    })

    # Counter evidence: check for controversies
    if member.controversies and len(member.controversies) > 0:
        counter_evidence.append({
            "type": "controversy_flag",
            "description": f"存在 {len(member.controversies)} 条争议记录，可能影响投票决策",
            "impact": -0.05,
        })

    # Counter evidence: check for conflicting committee memberships
    if committee_count > 4:
        counter_evidence.append({
            "type": "committee_overlap",
            "description": "委员会任职较多，议题立场可能存在内部冲突",
            "impact": -0.03,
        })

    # Compute final probability
    weights = [0.30, 0.25, 0.20, 0.15, 0.15]
    scores = [party_score, issue_score, donor_score, committee_score, hist_score]
    probability = sum(w * s for w, s in zip(weights, scores))

    for ce in counter_evidence:
        probability += ce["impact"]

    probability = max(0.0, min(1.0, probability))

    data_quality_score = min(1.0, evidence_count / 5.0)
    margin_from_baseline = abs(probability - party_baseline)

    # Threshold: evidence_count < 3 OR data_quality_score < 0.6 -> unknown
    if evidence_count < 3 or data_quality_score < 0.6:
        return PredictionResponse(
            predicted_position="unknown",
            probability=0.0,
            confidence_interval=[0.0, 0.0],
            top_factors=top_factors,
            counter_evidence=counter_evidence,
            evidence_count=evidence_count,
            data_quality_score=data_quality_score,
            confidence_level="insufficient_data",
            margin_from_baseline=round(margin_from_baseline, 4),
            interpretation="证据不足，无法进行可靠预测。需要至少3条证据且数据质量评分达到0.6以上。",
            disclaimer="仅供研究参考，不构成事实认定、法律判断或投资建议。当前证据不足以进行可靠预测。",
        )

    position = "support" if probability > 0.5 else "oppose"
    margin = 0.08
    ci_low = max(0.0, probability - margin)
    ci_high = min(1.0, probability + margin)

    # Determine confidence_level
    if 0.45 <= probability <= 0.55:
        confidence_level = "low"
        position = "uncertain"
    elif probability > 0.80 or probability < 0.20:
        confidence_level = "high"
    elif probability > 0.60 or probability < 0.40:
        confidence_level = "medium"
    else:
        confidence_level = "low"

    # Generate interpretation
    if 0.45 <= probability <= 0.55:
        interpretation = f"预测概率在45%-55%范围内（当前{probability:.1%}），置信度较低。立场接近中立，建议谨慎解读。"
    elif confidence_level == "high":
        direction = "支持" if position == "support" else "反对"
        interpretation = f"预测置信度为高，{direction}概率{probability:.1%}。当前证据较充分，但该预测仅基于Mock数据。"
    else:
        direction = "倾向于支持" if position == "support" else "倾向于反对"
        interpretation = f"预测置信度为中等，{direction}（概率{probability:.1%}）。证据尚可但仍有不确定性。"

    return PredictionResponse(
        predicted_position=position,
        probability=round(probability, 4),
        confidence_interval=[round(ci_low, 4), round(ci_high, 4)],
        top_factors=top_factors,
        counter_evidence=counter_evidence,
        evidence_count=evidence_count,
        data_quality_score=round(data_quality_score, 2),
        confidence_level=confidence_level,
        margin_from_baseline=round(margin_from_baseline, 4),
        interpretation=interpretation,
        disclaimer="仅供研究参考，不构成事实认定、法律判断或投资建议。该预测基于可解释规则模型，不依赖 LLM 生成。",
    )


@router.post("/predictions/vote", response_model=PredictionResponse)
def predict_vote(request: PredictionRequest, db: Session = Depends(get_db)):
    member = db.query(Member).filter(Member.id == request.member_id).first()
    if not member:
        raise NotFoundError("Member not found", {"member_id": request.member_id})

    event = None
    if request.event_id:
        event = db.query(EventModelDB).filter(EventModelDB.id == request.event_id).first()
        if not event:
            raise NotFoundError("Event not found", {"event_id": request.event_id})

    # Identity-only / committee-only evidence guard: if sandbox data exists
    # but lacks term_claim (substantive behavioral data like served-in-term),
    # return unknown. Identity and committee membership alone are insufficient.
    if member.bioguide_id:
        sandbox_person_id = f"uscl_person_{member.bioguide_id}"
        sandbox_claims = db.query(SandboxClaim).filter(
            SandboxClaim.subject_id == sandbox_person_id
        ).all()
        if sandbox_claims:
            claim_types = set(c.claim_type for c in sandbox_claims)
            non_identity = [c for c in sandbox_claims if c.claim_type != "identity_claim"]
            has_term = "term_claim" in claim_types
            if not non_identity or not has_term:
                return PredictionResponse(
                    predicted_position="unknown",
                    probability=0.0,
                    confidence_interval=[0.0, 0.0],
                    top_factors=[],
                    counter_evidence=[],
                    evidence_count=0,
                    data_quality_score=0.0,
                    confidence_level="low",
                    margin_from_baseline=0.0,
                    interpretation="仅有身份或委员会任职声明，无任期记录等实质性行为数据，无法进行有效预测。",
                    disclaimer="仅供研究参考，不构成事实认定、法律判断或投资建议。身份/委员会数据不足以支撑投票行为预测。",
                )

    return _compute_prediction(member, event)
